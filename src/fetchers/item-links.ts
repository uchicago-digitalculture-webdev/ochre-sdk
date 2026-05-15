import { XMLParser } from "fast-xml-parser";
import * as v from "valibot";
import type {
  ContainedItemCategoryFromOption,
  ContainedItemCategoryOption,
  Item,
  ItemCategory,
  ItemContainerCategory,
} from "#/types/index.js";
import type { XMLItemLinksData } from "#/xml/types.js";
import { DEFAULT_LANGUAGES, XML_PARSER_OPTIONS } from "#/constants.js";
import { parseLinkedItems } from "#/parsers/index.js";
import { iso639_3Schema, uuidSchema } from "#/schemas.js";
import { createSchemaValidationError, logIssues } from "#/utils.js";
import { restoreXMLMetadata } from "#/xml/metadata.js";
import { XMLItemLinksData as XMLItemLinksDataSchema } from "#/xml/schemas.js";

type FetchFunction = (
  input: string | URL | globalThis.Request,
  init?: RequestInit,
) => Promise<Response>;

type FetchItemLinksBaseOptions<
  TLanguages extends ReadonlyArray<string> | undefined = undefined,
> = { languages?: TLanguages; fetch?: FetchFunction };

type FetchItemLinksRuntimeOptions = FetchItemLinksBaseOptions<
  ReadonlyArray<string>
> & { containedItemCategory?: ContainedItemCategoryOption<ItemCategory> };

type FetchItemLinksLanguages<
  TLanguages extends ReadonlyArray<string> | undefined,
> = TLanguages extends readonly []
  ? ReadonlyArray<string>
  : TLanguages extends ReadonlyArray<string>
    ? TLanguages
    : ReadonlyArray<string>;

function parseLanguages<const T extends ReadonlyArray<string>>(
  languages: T,
): T {
  const parsedLanguages: Array<string> = [];
  for (const language of languages) {
    parsedLanguages.push(v.parse(iso639_3Schema, language));
  }

  return parsedLanguages as unknown as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function collectContentLanguages(value: unknown, languages: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectContentLanguages(item, languages);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const content = value.content;
  if (Array.isArray(content)) {
    for (const contentItem of content) {
      if (!isRecord(contentItem)) {
        continue;
      }

      const language = contentItem.lang;
      if (typeof language === "string" && language !== "zxx") {
        languages.add(language);
      }
    }
  }

  for (const child of Object.values(value)) {
    collectContentLanguages(child, languages);
  }
}

function resolveItemLinksLanguages(
  data: XMLItemLinksData,
  requestedLanguages: ReadonlyArray<string>,
): ReadonlyArray<string> {
  if (requestedLanguages.length > 0) {
    return requestedLanguages;
  }

  const languages = new Set<string>();
  collectContentLanguages(data.result.ochre.items, languages);

  return languages.size > 0 ? [...languages] : [...DEFAULT_LANGUAGES];
}

/**
 * Build an XQuery string to fetch linked items from the OCHRE API.
 *
 * @param uuid - The UUID of the OCHRE item whose links should be fetched
 * @returns An XQuery string
 */
function buildXQuery(uuid: string): string {
  const xquery = `let $item-uuid := "${uuid}"

let $source-items := (
  fn:collection("ochre/resource")/ochre[@uuid = $item-uuid]/resource,
  fn:collection("ochre/bibliography")/ochre[@uuid = $item-uuid]/bibliography,
  fn:collection("ochre/period")/ochre[@uuid = $item-uuid]/period,
  fn:collection("ochre/person")/ochre[@uuid = $item-uuid]/person,
  fn:collection("ochre/propertyVariable")/ochre[@uuid = $item-uuid]/propertyVariable,
  fn:collection("ochre/propertyValue")/ochre[@uuid = $item-uuid]/propertyValue,
  fn:collection("ochre/text")/ochre[@uuid = $item-uuid]/text,
  fn:collection("ochre/tree")/ochre[@uuid = $item-uuid]/tree,
  fn:collection("ochre/set")/ochre[@uuid = $item-uuid]/set,
  fn:collection("ochre/spatialUnit")/ochre[@uuid = $item-uuid]/spatialUnit,
  fn:collection("ochre/concept")/ochre[@uuid = $item-uuid]/concept
)

let $link-nodes := (
  $source-items/links/*,
  $source-items/observations/observation/links/*,
  $source-items/interpretations/interpretation/links/*
)

return
    <items>{
      for $link at $position in $link-nodes
      let $uuid := $link/@uuid/string()
      let $category := name($link)
      where $uuid ne "" and not($uuid = $link-nodes[position() lt $position]/@uuid/string())
      return
        if ($category = "resource") then fn:collection("ochre/resource")/ochre/resource[@uuid = $uuid]
        else if ($category = "bibliography") then fn:collection("ochre/bibliography")/ochre/bibliography[@uuid = $uuid]
        else if ($category = "period") then fn:collection("ochre/period")/ochre/period[@uuid = $uuid]
        else if ($category = "person") then fn:collection("ochre/person")/ochre/person[@uuid = $uuid]
        else if ($category = "propertyVariable" or $category = "variable") then fn:collection("ochre/propertyVariable")/ochre/propertyVariable[@uuid = $uuid]
        else if ($category = "propertyValue" or $category = "value") then fn:collection("ochre/propertyValue")/ochre/propertyValue[@uuid = $uuid]
        else if ($category = "text") then fn:collection("ochre/text")/ochre/text[@uuid = $uuid]
        else if ($category = "tree") then fn:collection("ochre/tree")/ochre/tree[@uuid = $uuid]
        else if ($category = "set") then fn:collection("ochre/set")/ochre/set[@uuid = $uuid]
        else if ($category = "spatialUnit") then fn:collection("ochre/spatialUnit")/ochre/spatialUnit[@uuid = $uuid]
        else if ($category = "concept") then fn:collection("ochre/concept")/ochre/concept[@uuid = $uuid]
        else ()
    }</items>`;

  return `<ochre>{${xquery}}</ochre>`;
}

/**
 * Fetches linked OCHRE items by source-item UUID.
 *
 * @param uuid - The UUID of the OCHRE item whose linked items should be fetched
 * @param options - Fetch and parser options
 * @param options.containedItemCategory - The category of items inside linked Trees/Sets to parse. Tree accepts one category; Set accepts one category or an array.
 * @param options.languages - Language codes to parse. Inline arrays preserve literal types automatically.
 * @param options.fetch - Custom fetch function to use instead of the default fetch
 * @returns An object containing parsed linked items
 */
export async function fetchItemLinks<
  const TContainedItemCategory extends
    | ContainedItemCategoryOption<ItemContainerCategory>
    | undefined = undefined,
  const TLanguages extends ReadonlyArray<string> | undefined = undefined,
>(
  uuid: string,
  options?: FetchItemLinksBaseOptions<TLanguages> & {
    containedItemCategory?: TContainedItemCategory;
  },
): Promise<
  | {
      items: Array<
        Item<
          ItemCategory,
          ContainedItemCategoryFromOption<ItemCategory, TContainedItemCategory>,
          FetchItemLinksLanguages<TLanguages>,
          "embedded"
        >
      >;
      error: null;
    }
  | { items: null; error: string }
>;
export async function fetchItemLinks(
  uuid: string,
  options?: FetchItemLinksRuntimeOptions,
): Promise<
  | {
      items: Array<
        Item<ItemCategory, ItemCategory, ReadonlyArray<string>, "embedded">
      >;
      error: null;
    }
  | { items: null; error: string }
> {
  try {
    const parsedUuid = v.parse(uuidSchema, uuid);
    const requestedLanguages: ReadonlyArray<string> =
      options?.languages == null ? [] : parseLanguages(options.languages);

    const response = await (options?.fetch ?? fetch)(
      'https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?xquery&xsl=none&lang="*"',
      {
        method: "POST",
        body: buildXQuery(parsedUuid),
        headers: { "Content-Type": "application/xquery" },
      },
    );
    if (!response.ok) {
      throw new Error("Failed to fetch OCHRE item links", {
        cause: response.statusText,
      });
    }

    const dataRaw = await response.text();

    const parser = new XMLParser(XML_PARSER_OPTIONS);
    const data = parser.parse(dataRaw) as unknown;

    const { success, issues, output } = v.safeParse(
      XMLItemLinksDataSchema,
      data,
    );
    if (!success) {
      logIssues(issues);
      throw createSchemaValidationError(
        "Failed to parse OCHRE item links",
        issues,
      );
    }
    restoreXMLMetadata(output, data);

    const languages = resolveItemLinksLanguages(output, requestedLanguages);
    const items = parseLinkedItems(output.result.ochre.items, {
      containedItemCategory: options?.containedItemCategory,
      languages,
    });

    return { items, error: null };
  } catch (error) {
    console.error(error);
    return {
      items: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
