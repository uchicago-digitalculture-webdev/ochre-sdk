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
import { OCHRE_COLLECTION_CATEGORIES } from "#/categories.js";
import { getErrorOutput } from "#/errors.js";
import { requestOchre } from "#/fetchers/request.js";
import { parseLinkedItems } from "#/parsers/index.js";
import {
  parseRequestedLanguages,
  resolveContentLanguages,
} from "#/parsers/languages.js";
import { uuidSchema } from "#/schemas.js";
import { XMLItemLinksData as XMLItemLinksDataSchema } from "#/xml/schemas.js";
import {
  compileOchreQuery,
  OCHRE_RESPONSE_PADDING,
  stringLiteral,
} from "#/xquery.js";

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

function buildXQuery(
  uuid: string,
  category: ItemCategoryOption | undefined,
): string {
  const categories: ReadonlyArray<ItemCategory> =
    category == null
      ? OCHRE_COLLECTION_CATEGORIES
      : typeof category === "string"
        ? [category]
        : category;
  const collectionQueries: Array<string> = Array.from(
    categories,
    (possibleCategory) =>
      `cts:search(fn:collection("ochre/${possibleCategory}")/ochre, $uuid-query)`,
  );

  return compileOchreQuery({
    declarations: [
      `declare function local:item-children($nodes as node()*) as node()* {
  for $node in $nodes
  return
    if (local-name($node) = "heading")
    then local:item-children($node/*)
    else $node
};`,
    ],
    body: ({ omitSupplemental }) => `
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
  <ochre>${OCHRE_RESPONSE_PADDING}
    <items>{${omitSupplemental("$children")}}</items>
  </ochre>`,
  });
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
    const requestedLanguages = parseRequestedLanguages(options?.languages);

    const output = await requestOchre({
      xquery: buildXQuery(parsedUuid, options?.category),
      schema: XMLItemLinksDataSchema,
      label: "OCHRE item children",
      options,
    });

    const languages = resolveContentLanguages(
      output.result.ochre.items,
      requestedLanguages,
    );
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
