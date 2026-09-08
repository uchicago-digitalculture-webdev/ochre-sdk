import type {
  ItemCategory,
  ItemCategoryWithEmbeddedItems,
  ItemContainerCategory,
  ItemLinkCategory,
} from "#/types/index.js";

/**
 * Every element name OCHRE serves an item category under, canonical name first
 *
 * OCHRE serves two of these categories under an alias as well as their
 * canonical name, so anything matching on the element name has to accept both.
 * This is the one place the set of categories is written down: the parsers key
 * their dispatch table off it and the fetchers generate their XQuery collection
 * lists from it.
 */
export const ITEM_CATEGORY_ALIASES = {
  tree: ["tree"],
  bibliography: ["bibliography"],
  concept: ["concept"],
  spatialUnit: ["spatialUnit"],
  period: ["period"],
  person: ["person"],
  propertyVariable: ["propertyVariable", "variable"],
  propertyValue: ["propertyValue", "value"],
  resource: ["resource"],
  text: ["text"],
  set: ["set"],
  dictionaryUnit: ["dictionaryUnit"],
} as const satisfies Record<ItemLinkCategory, ReadonlyArray<string>>;

/**
 * The OCHRE collections an item document can live in
 *
 * Document URIs are bare item UUIDs, so a lookup by UUID does not need these.
 * A search does: `fn:collection("ochre/<category>")`.
 * @internal
 */
export const OCHRE_COLLECTION_CATEGORIES = [
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

/**
 * The item categories that hold other items under a `containedItemCategory`
 * @internal
 */
export const ITEM_CONTAINER_CATEGORIES = [
  "tree",
  "set",
] as const satisfies ReadonlyArray<ItemContainerCategory>;

/**
 * The item categories that carry an embedded item hierarchy
 * @internal
 */
export const ITEM_CATEGORIES_WITH_EMBEDDED_ITEMS = [
  "tree",
  "bibliography",
  "concept",
  "spatialUnit",
  "period",
  "resource",
  "set",
] as const satisfies ReadonlyArray<ItemCategoryWithEmbeddedItems>;

/**
 * Whether an item of this category holds other items
 * @param category - The item category
 * @returns True when the category accepts a `containedItemCategory`
 * @internal
 */
export function isItemContainerCategory(
  category: ItemCategory,
): category is ItemContainerCategory {
  return ITEM_CONTAINER_CATEGORIES.includes(category as ItemContainerCategory);
}

/**
 * Whether an item of this category carries an embedded item hierarchy
 * @param category - The item category
 * @returns True when the category exposes embedded items
 * @internal
 */
export function isItemCategoryWithEmbeddedItems(
  category: ItemCategory,
): category is ItemCategoryWithEmbeddedItems {
  return ITEM_CATEGORIES_WITH_EMBEDDED_ITEMS.includes(
    category as ItemCategoryWithEmbeddedItems,
  );
}
