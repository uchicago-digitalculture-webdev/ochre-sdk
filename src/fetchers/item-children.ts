import { XMLParser } from "fast-xml-parser";
import * as v from "valibot";
import type { FetchBaseOptions, FetchLanguages } from "#/parsers/helpers.js";
import type {
  ContainedItemCategoryFromOption,
  ContainedItemCategoryOption,
  Item,
  ItemCategory,
  ItemCategoryFromOption,
  ItemCategoryOption,
  ItemContainerCategory,
  SetItemCategory,
  TreeItemCategory,
} from "#/types/index.js";
import type { XMLItemLinksData } from "#/xml/types.js";
import { DEFAULT_LANGUAGES, XML_PARSER_OPTIONS } from "#/constants.js";
import { parseLinkedItems } from "#/parsers/index.js";
import { iso639_3Schema, uuidSchema } from "#/schemas.js";
import {
  createSchemaValidationError,
  getErrorOutput,
  stringLiteral,
} from "#/utils.js";
import { restoreXMLMetadata } from "#/xml/metadata.js";
import { XMLItemLinksData as XMLItemLinksDataSchema } from "#/xml/schemas.js";

type FetchItemChildrenResult<TItems> = Promise<
  | { items: TItems; error: null; detailedError: null }
  | { items: null; error: string; detailedError: string }
>;

type ItemChildCategory<U extends ItemCategory> = U extends "tree"
  ? TreeItemCategory
  : U extends "set"
    ? SetItemCategory
    : U extends "bibliography"
      ? "bibliography"
      : U extends "concept"
        ? "concept"
        : U extends "spatialUnit"
          ? "spatialUnit"
          : U extends "period"
            ? "period"
            : U extends "resource"
              ? "resource"
              : never;

type ItemChildrenPayloadKind<U extends ItemCategory> = U extends "tree" | "set"
  ? "embedded"
  : "standaloneChild";

const ITEM_COLLECTION_CATEGORIES = [
  "tree",
  "bibliography",
  "concept",
  "spatialUnit",
  "period",
  "person",
  "propertyVariable",
  "propertyValue",
  "resource",
  "text",
  "set",
] as const satisfies ReadonlyArray<ItemCategory>;

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

function resolveItemChildrenLanguages(
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

function buildXQuery(
  uuid: string,
  category: ItemCategoryOption | undefined,
): string {
  const categories: ReadonlyArray<ItemCategory> =
    category == null
      ? ITEM_COLLECTION_CATEGORIES
      : typeof category === "string"
        ? [category]
        : category;
  const collectionQueries: Array<string> = [];
  for (const possibleCategory of categories) {
    collectionQueries.push(
      `cts:search(fn:collection("ochre/${possibleCategory}")/ochre, $uuid-query)`,
    );
  }

  return `xquery version "1.0-ml";

declare function local:item-children($nodes as node()*) as node()* {
  for $node in $nodes
  return
    if (local-name($node) = "heading")
    then local:item-children($node/*)
    else $node
};

let $uuid := ${stringLiteral(uuid)}
let $uuid-query := cts:element-attribute-value-query(xs:QName("ochre"), xs:QName("uuid"), $uuid, "exact")
let $ochre := (
  ${collectionQueries.join(",\n  ")}
)[1]
let $item := (
  $ochre/tree,
  $ochre/bibliography,
  $ochre/concept,
  $ochre/spatialUnit,
  $ochre/period,
  $ochre/person,
  $ochre/propertyVariable,
  $ochre/propertyValue,
  $ochre/resource,
  $ochre/text,
  $ochre/set
)[1]
let $category := local-name($item)
let $children :=
  if (empty($item)) then ()
  else if ($category = ("tree", "set")) then local:item-children($item/items/*)
  else if ($category = "bibliography") then $item/bibliography
  else if ($category = "concept") then $item/concept
  else if ($category = "spatialUnit") then $item/spatialUnit
  else if ($category = "period") then $item/period
  else if ($category = "resource") then $item/resource
  else ()
return
  <ochre>
    <items>{$children}</items>
  </ochre>`;
}

/**
 * Fetches direct child items for an OCHRE item UUID without fetching parent
 * item data.
 *
 * @param uuid - The UUID of the OCHRE item whose children should be fetched
 * @param options - Fetch and parser options
 * @param options.category - Optional parent item category. Passing it lets the XQuery search only the matching OCHRE collection.
 * @param options.containedItemCategory - The category of items inside returned Trees/Sets to parse. Tree accepts one category; Set accepts one category or an array.
 * @param options.languages - Language codes to parse. Inline arrays preserve literal types automatically.
 * @param options.fetch - Custom fetch function to use instead of the default fetch
 * @returns An object containing parsed child items
 */
export async function fetchItemChildren<
  const TContainedItemCategory extends
    | ContainedItemCategoryOption<ItemContainerCategory>
    | undefined = undefined,
  const TLanguages extends ReadonlyArray<string> | undefined = undefined,
>(
  uuid: string,
  options?: FetchBaseOptions<TLanguages> & {
    category?: undefined;
    containedItemCategory?: TContainedItemCategory;
  },
): FetchItemChildrenResult<
  Array<
    Item<
      ItemCategory,
      ContainedItemCategoryFromOption<ItemCategory, TContainedItemCategory>,
      FetchLanguages<TLanguages>,
      "embedded" | "standaloneChild"
    >
  >
>;
export async function fetchItemChildren<
  const TCategory extends ItemCategoryOption,
  const TChildCategory extends ItemCategory = ItemChildCategory<
    ItemCategoryFromOption<TCategory>
  >,
  const TContainedItemCategory extends
    | ContainedItemCategoryOption<TChildCategory>
    | undefined = undefined,
  const TLanguages extends ReadonlyArray<string> | undefined = undefined,
>(
  uuid: string,
  options: FetchBaseOptions<TLanguages> & {
    category: TCategory;
    containedItemCategory?: TContainedItemCategory;
  },
): FetchItemChildrenResult<
  Array<
    Item<
      TChildCategory,
      ContainedItemCategoryFromOption<TChildCategory, TContainedItemCategory>,
      FetchLanguages<TLanguages>,
      ItemChildrenPayloadKind<ItemCategoryFromOption<TCategory>>
    >
  >
>;
export async function fetchItemChildren(
  uuid: string,
  options?: FetchBaseOptions<ReadonlyArray<string>> & {
    category?: ItemCategoryOption;
    containedItemCategory?: ContainedItemCategoryOption<ItemCategory>;
  },
): FetchItemChildrenResult<
  Array<
    Item<
      ItemCategory,
      ContainedItemCategoryFromOption<ItemCategory>,
      ReadonlyArray<string>,
      "embedded" | "standaloneChild"
    >
  >
> {
  try {
    const parsedUuid = v.parse(uuidSchema, uuid);
    const requestedLanguages: ReadonlyArray<string> =
      options?.languages == null ? [] : parseLanguages(options.languages);

    const response = await (options?.fetch ?? fetch)(
      'https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?xquery&xsl=none&lang="*"',
      {
        method: "POST",
        body: buildXQuery(parsedUuid, options?.category),
        headers: { "Content-Type": "application/xquery" },
      },
    );
    if (!response.ok) {
      throw new Error("Failed to fetch OCHRE item children", {
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
      throw createSchemaValidationError(
        "Failed to parse OCHRE item children",
        issues,
      );
    }
    restoreXMLMetadata(output, data);

    const languages = resolveItemChildrenLanguages(output, requestedLanguages);
    const items = parseLinkedItems(output.result.ochre.items, {
      containedItemCategory: options?.containedItemCategory,
      languages,
    }) as Array<
      Item<
        ItemCategory,
        ContainedItemCategoryFromOption<ItemCategory>,
        ReadonlyArray<string>,
        "embedded" | "standaloneChild"
      >
    >;

    return { items, error: null, detailedError: null };
  } catch (error) {
    return { items: null, ...getErrorOutput(error, "Unknown error") };
  }
}
