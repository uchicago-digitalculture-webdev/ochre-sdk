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
import { logIssues } from "#/utils.js";
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

let $uuids :=
  distinct-values((

    (: Direct links on most item categories :)
    fn:collection("ochre/resource")/ochre[@uuid = $item-uuid]/resource/links/*/@uuid/string(),
    fn:collection("ochre/bibliography")/ochre[@uuid = $item-uuid]/bibliography/links/*/@uuid/string(),
    fn:collection("ochre/period")/ochre[@uuid = $item-uuid]/period/links/*/@uuid/string(),
    fn:collection("ochre/person")/ochre[@uuid = $item-uuid]/person/links/*/@uuid/string(),
    fn:collection("ochre/propertyVariable")/ochre[@uuid = $item-uuid]/propertyVariable/links/*/@uuid/string(),
    fn:collection("ochre/propertyValue")/ochre[@uuid = $item-uuid]/propertyValue/links/*/@uuid/string(),
    fn:collection("ochre/text")/ochre[@uuid = $item-uuid]/text/links/*/@uuid/string(),
    fn:collection("ochre/tree")/ochre[@uuid = $item-uuid]/tree/links/*/@uuid/string(),
    fn:collection("ochre/set")/ochre[@uuid = $item-uuid]/set/links/*/@uuid/string(),

    (: Special category structures :)
    fn:collection("ochre/spatialUnit")/ochre[@uuid = $item-uuid]/spatialUnit/observations/observation/links/*/@uuid/string(),
    fn:collection("ochre/concept")/ochre[@uuid = $item-uuid]/concept/interpretations/interpretation/links/*/@uuid/string()
  ))

return
    <items>{(
      fn:collection("ochre/resource")/ochre/resource[@uuid = $uuids],
      fn:collection("ochre/bibliography")/ochre/bibliography[@uuid = $uuids],
      fn:collection("ochre/period")/ochre/period[@uuid = $uuids],
      fn:collection("ochre/person")/ochre/person[@uuid = $uuids],
      fn:collection("ochre/propertyVariable")/ochre/propertyVariable[@uuid = $uuids],
      fn:collection("ochre/propertyValue")/ochre/propertyValue[@uuid = $uuids],
      fn:collection("ochre/text")/ochre/text[@uuid = $uuids],
      fn:collection("ochre/tree")/ochre/tree[@uuid = $uuids],
      fn:collection("ochre/set")/ochre/set[@uuid = $uuids],
      fn:collection("ochre/spatialUnit")/ochre/spatialUnit[@uuid = $uuids],
      fn:collection("ochre/concept")/ochre/concept[@uuid = $uuids]
    )}</items>`;

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
      throw new Error("Failed to fetch OCHRE item links");
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
      throw new Error("Failed to parse OCHRE item links");
    }

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
