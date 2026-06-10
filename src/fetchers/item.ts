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
  ItemCategoryWithEmbeddedItems,
  ItemContainerCategory,
  ItemWithoutEmbeddedItems,
  SetItemCategory,
} from "#/types/index.js";
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
  category: ItemCategoryOption | undefined,
  containedItemCategory: ContainedItemCategoryOption<ItemCategory> | undefined,
): void {
  if (category == null || containedItemCategory == null) {
    return;
  }

  const categories = typeof category === "string" ? [category] : category;
  for (const possibleCategory of categories) {
    if (isItemContainerCategory(possibleCategory)) {
      return;
    }
  }

  throw new Error(
    `containedItemCategory can only be used when category is "tree" or "set"; received category "${categories.join(", ")}"`,
  );
}

function buildOmitEmbeddedItemsXQuery(
  uuid: string,
  category:
    | ItemCategoryWithEmbeddedItems
    | ReadonlyArray<ItemCategoryWithEmbeddedItems>
    | undefined,
): string {
  const collectionCategories: Array<ItemCategoryWithEmbeddedItems> = [];
  const categories: ReadonlyArray<ItemCategoryWithEmbeddedItems> =
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
      : typeof category === "string"
        ? [category]
        : category;

  for (const possibleCategory of categories) {
    if (!collectionCategories.includes(possibleCategory)) {
      collectionCategories.push(possibleCategory);
    }
  }

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

  return itemWithoutEmbeddedItems;
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
 * @param options.category - The category of the OCHRE item to fetch. Pass a
 * single category when it is known, or an array when the item may be any
 * category in that list.
 * @param options.containedItemCategory - The category of items inside the OCHRE item to fetch. Only valid for Trees and Sets. Tree accepts one category; Set accepts one category or an array.
 * @param options.shouldOmitEmbeddedItems - Whether to omit the embedded item hierarchy when fetching a recursive item category. Ignored when the fetched item does not expose recursive embedded items.
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
  | ItemWithoutEmbeddedItems<
      ItemCategoryWithEmbeddedItems,
      ContainedItemCategoryFromOption<
        ItemContainerCategory,
        TContainedItemCategory
      >,
      FetchLanguages<TLanguages>
    >
  | Item<
      Exclude<ItemCategory, ItemCategoryWithEmbeddedItems>,
      never,
      FetchLanguages<TLanguages>
    >
>;
export async function fetchItem<
  const TCategory extends ItemCategoryOption,
  const TContainedItemCategory extends
    | ContainedItemCategoryOption<ItemCategoryFromOption<TCategory>>
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
    ItemCategoryFromOption<TCategory>,
    ContainedItemCategoryFromOption<
      ItemCategoryFromOption<TCategory>,
      TContainedItemCategory
    >,
    FetchLanguages<TLanguages>
  >
>;
export async function fetchItem<
  const TCategory extends ItemCategoryOption,
  const TContainedItemCategory extends
    | ContainedItemCategoryOption<
        Extract<
          ItemCategoryFromOption<TCategory>,
          ItemCategoryWithEmbeddedItems
        >
      >
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
  | ItemWithoutEmbeddedItems<
      Extract<ItemCategoryFromOption<TCategory>, ItemCategoryWithEmbeddedItems>,
      ContainedItemCategoryFromOption<
        Extract<
          ItemCategoryFromOption<TCategory>,
          ItemCategoryWithEmbeddedItems
        >,
        TContainedItemCategory
      >,
      FetchLanguages<TLanguages>
    >
  | Item<
      Exclude<ItemCategoryFromOption<TCategory>, ItemCategoryWithEmbeddedItems>,
      never,
      FetchLanguages<TLanguages>
    >
>;
export async function fetchItem(
  uuid: string,
  options?: FetchBaseOptions<ReadonlyArray<string>> & {
    category?: ItemCategoryOption;
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
    let shouldFetchOmittedEmbeddedItems = shouldOmitEmbeddedItems;
    let omitEmbeddedItemsCategory:
      | ItemCategoryWithEmbeddedItems
      | ReadonlyArray<ItemCategoryWithEmbeddedItems>
      | undefined;
    if (options?.category != null) {
      if (typeof options.category === "string") {
        if (isItemCategoryWithEmbeddedItems(options.category)) {
          omitEmbeddedItemsCategory = options.category;
        } else {
          shouldFetchOmittedEmbeddedItems = false;
        }
      } else {
        const categories: Array<ItemCategoryWithEmbeddedItems> = [];
        for (const possibleCategory of options.category) {
          if (isItemCategoryWithEmbeddedItems(possibleCategory)) {
            categories.push(possibleCategory);
          }
        }
        omitEmbeddedItemsCategory = categories;
        shouldFetchOmittedEmbeddedItems =
          shouldOmitEmbeddedItems && categories.length > 0;
      }
    }
    const languages: ReadonlyArray<string> =
      options?.languages == null ? [] : parseLanguages(options.languages);

    const fetcher = options?.fetch ?? fetch;
    const regularItemUrl = `https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?uuid=${parsedUuid}&xsl=none&lang="*"`;
    let response = shouldFetchOmittedEmbeddedItems
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
      : await fetcher(regularItemUrl);
    if (!response.ok) {
      throw new Error("Failed to fetch OCHRE data", {
        cause: response.statusText,
      });
    }

    const dataRaw = await response.text();

    const parser = new XMLParser(XML_PARSER_OPTIONS);
    let data = parser.parse(dataRaw) as unknown;
    if (
      shouldFetchOmittedEmbeddedItems &&
      typeof data === "object" &&
      data != null &&
      "result" in data
    ) {
      const result = data.result;
      if (typeof result === "object" && result != null && "ochre" in result) {
        const ochre = result.ochre;
        if (
          typeof ochre === "object" &&
          ochre != null &&
          (Object.keys(ochre).length === 0 ||
            ("payload" in ochre &&
              ochre.payload === "" &&
              Object.keys(ochre).length === 1))
        ) {
          response = await fetcher(regularItemUrl);
          if (!response.ok) {
            throw new Error("Failed to fetch OCHRE data", {
              cause: response.statusText,
            });
          }
          data = parser.parse(await response.text()) as unknown;
        }
      }
    }

    const { success, issues, output } = v.safeParse(XMLDataSchema, data);
    if (!success) {
      throw createSchemaValidationError("Failed to parse OCHRE data", issues);
    }
    restoreXMLMetadata(output, data);

    const parsedItem = parseItem(output, {
      category: options?.category,
      containedItemCategory: options?.containedItemCategory,
      languages,
      parseResourceView: (view, context) =>
        parseWebpageView(
          view,
          { languages: context.metadata.languages },
          context,
        ),
    });
    assertItemCategoryAllowed(
      parsedItem.category,
      options?.containedItemCategory,
    );

    const item =
      shouldOmitEmbeddedItems && isItemWithEmbeddedItems(parsedItem)
        ? omitEmbeddedItems(parsedItem)
        : parsedItem;

    return { item, error: null, detailedError: null };
  } catch (error) {
    return { item: null, ...getErrorOutput(error, "Unknown error") };
  }
}
