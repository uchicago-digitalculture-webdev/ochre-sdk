import { XMLParser } from "fast-xml-parser";
import * as v from "valibot";
import type { FetchBaseOptions, FetchLanguages } from "#/parsers/helpers.js";
import type {
  ContainedItemCategory,
  ContainedItemCategoryFromOption,
  ContainedItemCategoryOption,
  Item,
  ItemCategory,
  ItemCategoryWithEmbeddedItems,
  ItemContainerCategory,
  ItemWithoutEmbeddedItems,
  SetItemCategory,
} from "#/types/index.js";
import type { XMLData } from "#/xml/types.js";
import { XML_PARSER_OPTIONS } from "#/constants.js";
import { parseItem } from "#/parsers/index.js";
import { parseWebpageView } from "#/parsers/website/index.js";
import { iso639_3Schema, uuidSchema } from "#/schemas.js";
import {
  createSchemaValidationError,
  getErrorOutput,
  stringLiteral,
} from "#/utils.js";
import { restoreXMLMetadata } from "#/xml/metadata.js";
import { XMLData as XMLDataSchema } from "#/xml/schemas.js";

type FetchItemResult<TItem> = Promise<
  | { item: TItem; error: null; detailedError: null }
  | { item: null; error: string; detailedError: string }
>;

function isItemContainerCategory(
  category: ItemCategory,
): category is ItemContainerCategory {
  return category === "tree" || category === "set";
}

function isItemCategoryWithEmbeddedItems(
  category: ItemCategory,
): category is ItemCategoryWithEmbeddedItems {
  return (
    category === "tree" ||
    category === "bibliography" ||
    category === "concept" ||
    category === "spatialUnit" ||
    category === "period" ||
    category === "resource" ||
    category === "set"
  );
}

function isItemWithEmbeddedItems(
  item: Item<ItemCategory, SetItemCategory, ReadonlyArray<string>>,
): item is Item<
  ItemCategoryWithEmbeddedItems,
  SetItemCategory,
  ReadonlyArray<string>
> {
  return isItemCategoryWithEmbeddedItems(item.category);
}

function assertItemCategoryAllowed(
  category: ItemCategory | undefined,
  containedItemCategory: ContainedItemCategoryOption<ItemCategory> | undefined,
): void {
  if (
    category == null ||
    containedItemCategory == null ||
    isItemContainerCategory(category)
  ) {
    return;
  }

  throw new Error(
    `containedItemCategory can only be used when category is "tree" or "set"; received category "${category}"`,
  );
}

function assertShouldOmitEmbeddedItemsAllowed(
  category: ItemCategory | undefined,
  shouldOmitEmbeddedItems: boolean,
): void {
  if (
    !shouldOmitEmbeddedItems ||
    category == null ||
    isItemCategoryWithEmbeddedItems(category)
  ) {
    return;
  }

  throw new Error(
    `shouldOmitEmbeddedItems can only be used when the item category contains embedded items; received category "${category}"`,
  );
}

function normalizeFetchedCategory(
  category: string | undefined,
): ItemCategory | null {
  switch (category) {
    case "tree":
    case "bibliography":
    case "concept":
    case "spatialUnit":
    case "period":
    case "person":
    case "propertyVariable":
    case "propertyValue":
    case "resource":
    case "text":
    case "set": {
      return category;
    }
    case "variable": {
      return "propertyVariable";
    }
    case "value": {
      return "propertyValue";
    }
    default: {
      return null;
    }
  }
}

function inferFetchItemCategory(
  rawOchre: XMLData["result"]["ochre"],
): ItemCategory {
  const metadataCategory = normalizeFetchedCategory(
    rawOchre.metadata.item?.category,
  );
  if (metadataCategory != null) {
    return metadataCategory;
  }

  if ("tree" in rawOchre) return "tree";
  if ("bibliography" in rawOchre) return "bibliography";
  if ("concept" in rawOchre) return "concept";
  if ("spatialUnit" in rawOchre) return "spatialUnit";
  if ("period" in rawOchre) return "period";
  if ("person" in rawOchre) return "person";
  if ("propertyVariable" in rawOchre || "variable" in rawOchre) {
    return "propertyVariable";
  }
  if ("propertyValue" in rawOchre || "value" in rawOchre) {
    return "propertyValue";
  }
  if ("resource" in rawOchre) return "resource";
  if ("text" in rawOchre) return "text";
  if ("set" in rawOchre) return "set";

  throw new Error("Could not infer OCHRE item category", { cause: rawOchre });
}

function buildOmitEmbeddedItemsXQuery(
  uuid: string,
  category: ItemCategoryWithEmbeddedItems | undefined,
): string {
  const collectionCategories: Array<ItemCategoryWithEmbeddedItems> =
    category == null
      ? [
          "tree",
          "bibliography",
          "concept",
          "spatialUnit",
          "period",
          "resource",
          "set",
        ]
      : [category];
  const collectionQueries: Array<string> = [];
  for (const collectionCategory of collectionCategories) {
    collectionQueries.push(
      `cts:search(fn:collection("ochre/${collectionCategory}")/ochre, $uuid-query)`,
    );
  }

  return `xquery version "1.0-ml";

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
  $ochre/resource,
  $ochre/set
)[1]
let $embedded-child-name := if (local-name($item) = ("tree", "set")) then "items" else local-name($item)
return
  if (empty($ochre) or empty($item)) then ()
  else element ochre {
    $ochre/@*,
    for $node in $ochre/node()
    return
      if ($node is $item)
      then element { node-name($item) } { $item/@*, $item/node()[not(self::*[local-name() = $embedded-child-name])] }
      else $node
  }`;
}

function omitEmbeddedItems(
  item: Item<
    ItemCategoryWithEmbeddedItems,
    SetItemCategory,
    ReadonlyArray<string>
  >,
): ItemWithoutEmbeddedItems<
  ItemCategoryWithEmbeddedItems,
  SetItemCategory,
  ReadonlyArray<string>
> {
  const { items: _items, ...itemWithoutEmbeddedItems } = item;

  return itemWithoutEmbeddedItems as ItemWithoutEmbeddedItems<
    ItemCategoryWithEmbeddedItems,
    SetItemCategory,
    ReadonlyArray<string>
  >;
}

/**
 * Validate language codes while preserving literal tuple inference.
 */
function parseLanguages<const T extends ReadonlyArray<string>>(
  languages: T,
): T {
  const parsedLanguages: Array<string> = [];
  for (const language of languages) {
    parsedLanguages.push(v.parse(iso639_3Schema, language));
  }

  return parsedLanguages as unknown as T;
}

/**
 * Defines a reusable languages tuple with validation and literal type inference.
 *
 * Inline arrays can be passed directly to fetchItem:
 * `fetchItem(uuid, { languages: ["eng", "spa"] })`.
 *
 * Use this helper when the language set is stored separately:
 * `const languages = defineLanguages("eng", "spa")`.
 */
export function defineLanguages<const TLanguages extends ReadonlyArray<string>>(
  ...languages: TLanguages
): TLanguages {
  return parseLanguages(languages);
}

/**
 * @deprecated Pass inline language arrays directly to fetchItem, or use
 * defineLanguages("eng", "spa") for reusable language tuples.
 */
export function withLanguages<const TLanguages extends ReadonlyArray<string>>(
  languages: TLanguages,
): TLanguages {
  return parseLanguages(languages);
}

/**
 * Fetches an OCHRE item by UUID from the OCHRE API
 *
 * @param uuid - The UUID of the OCHRE item to fetch
 * @param options - Required options object
 * @param options.category - The category of the OCHRE item to fetch
 * @param options.containedItemCategory - The category of items inside the OCHRE item to fetch. Only valid for Trees and Sets. Tree accepts one category; Set accepts one category or an array.
 * @param options.shouldOmitEmbeddedItems - Whether to omit the embedded item hierarchy when fetching a recursive item category.
 * @param options.languages - Language codes to parse. Inline arrays preserve literal types automatically.
 * @param options.fetch - Custom fetch function to use instead of the default fetch
 * @returns An object containing the parsed item
 */
export async function fetchItem<
  const TContainedItemCategory extends
    | ContainedItemCategoryOption<ItemContainerCategory>
    | undefined = undefined,
  const TLanguages extends ReadonlyArray<string> | undefined = undefined,
>(
  uuid: string,
  options?: FetchBaseOptions<TLanguages> & {
    category?: undefined;
    containedItemCategory?: TContainedItemCategory;
    shouldOmitEmbeddedItems?: false;
  },
): FetchItemResult<
  Item<
    ItemCategory,
    ContainedItemCategoryFromOption<ItemCategory, TContainedItemCategory>,
    FetchLanguages<TLanguages>
  >
>;
export async function fetchItem<
  const TContainedItemCategory extends
    | ContainedItemCategoryOption<ItemContainerCategory>
    | undefined = undefined,
  const TLanguages extends ReadonlyArray<string> | undefined = undefined,
>(
  uuid: string,
  options: FetchBaseOptions<TLanguages> & {
    category?: undefined;
    containedItemCategory?: TContainedItemCategory;
    shouldOmitEmbeddedItems?: true;
  },
): FetchItemResult<
  ItemWithoutEmbeddedItems<
    ItemCategoryWithEmbeddedItems,
    ContainedItemCategoryFromOption<
      ItemContainerCategory,
      TContainedItemCategory
    >,
    FetchLanguages<TLanguages>
  >
>;
export async function fetchItem<
  const TCategory extends ItemContainerCategory,
  const TContainedItemCategory extends
    | ContainedItemCategoryOption<TCategory>
    | undefined = undefined,
  const TLanguages extends ReadonlyArray<string> | undefined = undefined,
>(
  uuid: string,
  options: FetchBaseOptions<TLanguages> & {
    category: TCategory;
    containedItemCategory?: TContainedItemCategory;
    shouldOmitEmbeddedItems?: false;
  },
): FetchItemResult<
  Item<
    TCategory,
    ContainedItemCategoryFromOption<TCategory, TContainedItemCategory>,
    FetchLanguages<TLanguages>
  >
>;
export async function fetchItem<
  const TCategory extends ItemCategoryWithEmbeddedItems,
  const TContainedItemCategory extends
    | ContainedItemCategoryOption<Extract<TCategory, ItemContainerCategory>>
    | undefined = undefined,
  const TLanguages extends ReadonlyArray<string> | undefined = undefined,
>(
  uuid: string,
  options: FetchBaseOptions<TLanguages> & {
    category: TCategory;
    containedItemCategory?: TContainedItemCategory;
    shouldOmitEmbeddedItems: true;
  },
): FetchItemResult<
  ItemWithoutEmbeddedItems<
    TCategory,
    ContainedItemCategoryFromOption<
      Extract<TCategory, ItemContainerCategory>,
      TContainedItemCategory
    >,
    FetchLanguages<TLanguages>
  >
>;
export async function fetchItem<
  const TCategory extends ItemCategory,
  const TLanguages extends ReadonlyArray<string> | undefined = undefined,
>(
  uuid: string,
  options: FetchBaseOptions<TLanguages> & {
    category: TCategory;
    containedItemCategory?: never;
    shouldOmitEmbeddedItems?: false;
  },
): FetchItemResult<
  Item<TCategory, ContainedItemCategory<TCategory>, FetchLanguages<TLanguages>>
>;
export async function fetchItem(
  uuid: string,
  options?: FetchBaseOptions<ReadonlyArray<string>> & {
    category?: ItemCategory;
    containedItemCategory?: ContainedItemCategoryOption<ItemCategory>;
    shouldOmitEmbeddedItems?: boolean;
  },
): Promise<
  | {
      item:
        | Item<ItemCategory, SetItemCategory, ReadonlyArray<string>>
        | ItemWithoutEmbeddedItems<
            ItemCategoryWithEmbeddedItems,
            SetItemCategory,
            ReadonlyArray<string>
          >;
      error: null;
      detailedError: null;
    }
  | { item: null; error: string; detailedError: string }
> {
  try {
    const parsedUuid = v.parse(uuidSchema, uuid);
    assertItemCategoryAllowed(
      options?.category,
      options?.containedItemCategory,
    );
    const shouldOmitEmbeddedItems = options?.shouldOmitEmbeddedItems === true;
    assertShouldOmitEmbeddedItemsAllowed(
      options?.category,
      shouldOmitEmbeddedItems,
    );
    const omitEmbeddedItemsCategory =
      options?.category == null ||
      isItemCategoryWithEmbeddedItems(options.category)
        ? options?.category
        : undefined;
    const languages: ReadonlyArray<string> =
      options?.languages == null ? [] : parseLanguages(options.languages);

    const fetcher = options?.fetch ?? fetch;
    const response = shouldOmitEmbeddedItems
      ? await fetcher(
          'https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?xquery&xsl=none&lang="*"',
          {
            method: "POST",
            body: buildOmitEmbeddedItemsXQuery(
              parsedUuid,
              omitEmbeddedItemsCategory,
            ),
            headers: { "Content-Type": "application/xquery" },
          },
        )
      : await fetcher(
          `https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?uuid=${parsedUuid}&xsl=none&lang="*"`,
        );
    if (!response.ok) {
      throw new Error("Failed to fetch OCHRE data", {
        cause: response.statusText,
      });
    }

    const dataRaw = await response.text();

    const parser = new XMLParser(XML_PARSER_OPTIONS);
    const data = parser.parse(dataRaw) as unknown;

    const { success, issues, output } = v.safeParse(XMLDataSchema, data);
    if (!success) {
      throw createSchemaValidationError("Failed to parse OCHRE data", issues);
    }
    restoreXMLMetadata(output, data);

    const category =
      options?.category ?? inferFetchItemCategory(output.result.ochre);
    assertItemCategoryAllowed(category, options?.containedItemCategory);
    assertShouldOmitEmbeddedItemsAllowed(category, shouldOmitEmbeddedItems);

    const parsedItem = parseItem(output, {
      category,
      containedItemCategory: options?.containedItemCategory,
      languages,
      parseResourceView: (view, context) =>
        parseWebpageView(
          view,
          { languages: context.metadata.languages },
          context,
        ),
    });

    const item =
      shouldOmitEmbeddedItems && isItemWithEmbeddedItems(parsedItem)
        ? omitEmbeddedItems(parsedItem)
        : parsedItem;

    return { item, error: null, detailedError: null };
  } catch (error) {
    return { item: null, ...getErrorOutput(error, "Unknown error") };
  }
}
