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
import {
  isItemCategoryWithEmbeddedItems,
  isItemContainerCategory,
  ITEM_CATEGORIES_WITH_EMBEDDED_ITEMS,
  ITEM_CONTAINER_CATEGORIES,
} from "#/categories.js";
import { getErrorOutput } from "#/errors.js";
import { requestOchre } from "#/fetchers/request.js";
import { parseItem } from "#/parsers/index.js";
import { parseRequestedLanguages } from "#/parsers/languages.js";
import { parseWebpageView } from "#/parsers/website/index.js";
import { uuidSchema } from "#/schemas.js";
import { XMLData as XMLDataSchema } from "#/xml/schemas.js";
import {
  compileOchreQuery,
  OCHRE_RESPONSE_PADDING,
  stringLiteral,
} from "#/xquery.js";

type FetchItemResult<TItem> = Promise<
  | { item: TItem; error: null; detailedError: null }
  | { item: null; error: string; detailedError: string }
>;

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

/**
 * Build an XQuery string to fetch a single OCHRE item document by UUID.
 *
 * Nodes marked `supplemental="true"` are always dropped. `$item` only ever
 * binds the item categories that carry embedded items, so the omission branch
 * is a no-op for every other category.
 *
 * @param parameters - The parameters for the fetch
 * @param parameters.uuid - The UUID of the OCHRE item to fetch
 * @param parameters.shouldOmitEmbeddedItems - Whether to drop the embedded item hierarchy
 * @returns An XQuery string
 */
function buildXQuery(parameters: {
  uuid: string;
  shouldOmitEmbeddedItems: boolean;
}): string {
  const { uuid, shouldOmitEmbeddedItems } = parameters;

  const letClauses = [`let $ochre := doc(${stringLiteral(uuid)})/ochre`];
  let itemNodesExpression = "$ochre/node()";

  if (shouldOmitEmbeddedItems) {
    letClauses.push(
      `let $item := (
${ITEM_CATEGORIES_WITH_EMBEDDED_ITEMS.map((category) => `  $ochre/${category}`).join(",\n")}
)[1]`,
      `let $embedded-child-name := if (local-name($item) = (${ITEM_CONTAINER_CATEGORIES.map((category) => stringLiteral(category)).join(", ")})) then "items" else local-name($item)`,
    );
    itemNodesExpression = `(
      for $node in $ochre/node()
      return
        if ($node is $item)
        then element { node-name($item) } { $item/@*, $item/node()[not(self::*[local-name() = $embedded-child-name])] }
        else $node
    )`;
  }

  return compileOchreQuery({
    body: ({ omitSupplemental }) => `${letClauses.join("\n")}
return
  if (empty($ochre)) then <ochre>${OCHRE_RESPONSE_PADDING}</ochre>
  else element ochre {
    $ochre/@*,
    ${omitSupplemental(itemNodesExpression)}
  }`,
  });
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
    const languages = parseRequestedLanguages(options?.languages);

    const output = await requestOchre({
      xquery: buildXQuery({ uuid: parsedUuid, shouldOmitEmbeddedItems }),
      schema: XMLDataSchema,
      label: "OCHRE item",
      options,
      checkRawData: (data) => {
        const uuidOnPayload = (
          data as { result?: { ochre?: { uuid?: string } } }
        ).result?.ochre?.uuid;
        if (uuidOnPayload == null) {
          throw new Error(`No OCHRE item found for UUID "${parsedUuid}"`, {
            cause: data,
          });
        }
      },
    });

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
