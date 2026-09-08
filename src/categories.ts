import type {
  ContextItemCategory,
  HeadingItemCategory,
  ItemCategory,
  ItemCategoryWithEmbeddedItems,
  ItemContainerCategory,
  ItemLinkCategory,
  TreeItemCategory,
} from "#/types/index.js";

/**
 * Every category an item hierarchy entry can carry, including the
 * pseudo-category OCHRE uses to group entries
 */
export type HierarchyEntryCategory = ItemLinkCategory | "heading";

/**
 * Everything the SDK knows about one OCHRE item category
 *
 * The set of categories used to be spelled out in four `switch` statements,
 * four constant tables, three XQuery collection lists and a second module of
 * membership lists. It is one row per category here, and every list below is
 * derived from it, so adding a category is one edit.
 */
type ItemCategoryFacts = {
  /** The element names OCHRE serves this category under, canonical name first */
  aliases: ReadonlyArray<string>;
  /** The name used in "not found" and "expected one" errors */
  label: string;
  /** Whether an item document of this category lives in its own OCHRE collection */
  hasCollection: boolean;
  /** Whether an item of this category can sit directly inside a Tree */
  isTreeItem: boolean;
  /** Whether an item of this category can sit directly inside a Set */
  isSetItem: boolean;
  /** Whether an item of this category can sit under a heading */
  isHeadingItem: boolean;
  /** Whether an item of this category can appear in an item's context path */
  isContextItem: boolean;
  /** Whether an item of this category holds other items under a `containedItemCategory` */
  isContainer: boolean;
  /** Whether an item of this category carries an embedded item hierarchy */
  hasEmbeddedItems: boolean;
};

/**
 * The one table describing the OCHRE item categories
 * @internal
 */
export const ITEM_CATEGORY_FACTS = {
  tree: {
    aliases: ["tree"],
    label: "tree",
    hasCollection: true,
    isTreeItem: false,
    isSetItem: true,
    isHeadingItem: false,
    isContextItem: false,
    isContainer: true,
    hasEmbeddedItems: true,
  },
  bibliography: {
    aliases: ["bibliography"],
    label: "bibliography",
    hasCollection: true,
    isTreeItem: true,
    isSetItem: true,
    isHeadingItem: false,
    isContextItem: true,
    isContainer: false,
    hasEmbeddedItems: true,
  },
  concept: {
    aliases: ["concept"],
    label: "concept",
    hasCollection: true,
    isTreeItem: true,
    isSetItem: true,
    isHeadingItem: false,
    isContextItem: true,
    isContainer: false,
    hasEmbeddedItems: true,
  },
  spatialUnit: {
    aliases: ["spatialUnit"],
    label: "spatial unit",
    hasCollection: true,
    isTreeItem: true,
    isSetItem: true,
    isHeadingItem: false,
    isContextItem: true,
    isContainer: false,
    hasEmbeddedItems: true,
  },
  period: {
    aliases: ["period"],
    label: "period",
    hasCollection: true,
    isTreeItem: true,
    isSetItem: true,
    isHeadingItem: false,
    isContextItem: true,
    isContainer: false,
    hasEmbeddedItems: true,
  },
  person: {
    aliases: ["person"],
    label: "person",
    hasCollection: true,
    isTreeItem: true,
    isSetItem: true,
    isHeadingItem: true,
    isContextItem: false,
    isContainer: false,
    hasEmbeddedItems: false,
  },
  propertyVariable: {
    aliases: ["propertyVariable", "variable"],
    label: "property variable",
    hasCollection: true,
    isTreeItem: true,
    isSetItem: true,
    isHeadingItem: true,
    isContextItem: true,
    isContainer: false,
    hasEmbeddedItems: false,
  },
  propertyValue: {
    aliases: ["propertyValue", "value"],
    label: "property value",
    hasCollection: true,
    isTreeItem: true,
    isSetItem: true,
    isHeadingItem: true,
    isContextItem: true,
    isContainer: false,
    hasEmbeddedItems: false,
  },
  resource: {
    aliases: ["resource"],
    label: "resource",
    hasCollection: true,
    isTreeItem: true,
    isSetItem: true,
    isHeadingItem: true,
    isContextItem: true,
    isContainer: false,
    hasEmbeddedItems: true,
  },
  text: {
    aliases: ["text"],
    label: "text",
    hasCollection: true,
    isTreeItem: true,
    isSetItem: true,
    isHeadingItem: true,
    isContextItem: true,
    isContainer: false,
    hasEmbeddedItems: false,
  },
  set: {
    aliases: ["set"],
    label: "set",
    hasCollection: true,
    isTreeItem: true,
    isSetItem: true,
    isHeadingItem: true,
    isContextItem: false,
    isContainer: true,
    hasEmbeddedItems: true,
  },
  dictionaryUnit: {
    aliases: ["dictionaryUnit"],
    label: "dictionary unit",
    hasCollection: false,
    isTreeItem: false,
    isSetItem: false,
    isHeadingItem: false,
    isContextItem: false,
    isContainer: false,
    hasEmbeddedItems: false,
  },
  heading: {
    aliases: ["heading"],
    label: "heading",
    hasCollection: false,
    isTreeItem: false,
    isSetItem: false,
    isHeadingItem: false,
    isContextItem: false,
    isContainer: false,
    hasEmbeddedItems: false,
  },
} as const satisfies Record<HierarchyEntryCategory, ItemCategoryFacts>;

/**
 * Every element name OCHRE serves an item category under, canonical name first
 * @internal
 */
export const ITEM_CATEGORY_ALIASES = {
  tree: ITEM_CATEGORY_FACTS.tree.aliases,
  bibliography: ITEM_CATEGORY_FACTS.bibliography.aliases,
  concept: ITEM_CATEGORY_FACTS.concept.aliases,
  spatialUnit: ITEM_CATEGORY_FACTS.spatialUnit.aliases,
  period: ITEM_CATEGORY_FACTS.period.aliases,
  person: ITEM_CATEGORY_FACTS.person.aliases,
  propertyVariable: ITEM_CATEGORY_FACTS.propertyVariable.aliases,
  propertyValue: ITEM_CATEGORY_FACTS.propertyValue.aliases,
  resource: ITEM_CATEGORY_FACTS.resource.aliases,
  text: ITEM_CATEGORY_FACTS.text.aliases,
  set: ITEM_CATEGORY_FACTS.set.aliases,
  dictionaryUnit: ITEM_CATEGORY_FACTS.dictionaryUnit.aliases,
} as const satisfies Record<ItemLinkCategory, ReadonlyArray<string>>;

function categoriesWhere(
  isIncluded: (facts: ItemCategoryFacts) => boolean,
): Array<HierarchyEntryCategory> {
  const categories: Array<HierarchyEntryCategory> = [];
  for (const [category, facts] of Object.entries(ITEM_CATEGORY_FACTS)) {
    if (isIncluded(facts)) {
      categories.push(category as HierarchyEntryCategory);
    }
  }

  return categories;
}

/**
 * The canonical category each element name maps to
 * @internal
 */
export const ITEM_CATEGORY_BY_ALIAS: ReadonlyMap<
  string,
  HierarchyEntryCategory
> = new Map(
  Object.entries(ITEM_CATEGORY_FACTS).flatMap(([category, facts]) =>
    facts.aliases.map(
      (alias) => [alias, category as HierarchyEntryCategory] as const,
    ),
  ),
);

/**
 * The OCHRE collections an item document can live in
 *
 * Document URIs are bare item UUIDs, so a lookup by UUID does not need these.
 * A search does: `fn:collection("ochre/<category>")`.
 * @internal
 */
export const OCHRE_COLLECTION_CATEGORIES = categoriesWhere(
  (facts) => facts.hasCollection,
) as Array<ItemCategory>;

/**
 * The item categories that can sit directly inside a Tree
 * @internal
 */
export const TREE_ITEM_CATEGORIES = categoriesWhere(
  (facts) => facts.isTreeItem,
) as Array<TreeItemCategory>;

/**
 * The item categories that can sit directly inside a Set
 * @internal
 */
export const SET_ITEM_CATEGORIES = categoriesWhere(
  (facts) => facts.isSetItem,
) as Array<ItemCategory>;

/**
 * The item categories that can sit under a heading
 * @internal
 */
export const HEADING_ITEM_CATEGORIES = categoriesWhere(
  (facts) => facts.isHeadingItem,
) as Array<HeadingItemCategory>;

/**
 * The item categories that hold other items under a `containedItemCategory`
 * @internal
 */
export const ITEM_CONTAINER_CATEGORIES = categoriesWhere(
  (facts) => facts.isContainer,
) as Array<ItemContainerCategory>;

/**
 * The item categories that carry an embedded item hierarchy
 * @internal
 */
export const ITEM_CATEGORIES_WITH_EMBEDDED_ITEMS = categoriesWhere(
  (facts) => facts.hasEmbeddedItems,
) as Array<ItemCategoryWithEmbeddedItems>;

/**
 * Each element name that can appear in a context path, and the category it means
 * @internal
 */
export const CONTEXT_CATEGORY_ALIASES: ReadonlyArray<{
  alias: string;
  category: ContextItemCategory;
}> = Object.entries(ITEM_CATEGORY_FACTS).flatMap(([category, facts]) =>
  facts.isContextItem
    ? facts.aliases.map((alias) => ({
        alias,
        category: category as ContextItemCategory,
      }))
    : [],
);

/**
 * Whether an item of this category holds other items
 * @param category - The item category
 * @returns True when the category accepts a `containedItemCategory`
 * @internal
 */
export function isItemContainerCategory(
  category: ItemCategory,
): category is ItemContainerCategory {
  return ITEM_CATEGORY_FACTS[category].isContainer;
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
  return ITEM_CATEGORY_FACTS[category].hasEmbeddedItems;
}

/**
 * Whether an item of this category can sit under a heading
 * @param category - The item category
 * @returns True when the category is allowed under a heading
 * @internal
 */
export function isHeadingItemCategory(
  category: TreeItemCategory,
): category is HeadingItemCategory {
  return ITEM_CATEGORY_FACTS[category].isHeadingItem;
}

/**
 * Resolve an OCHRE element name to the category it means
 * @param category - The element name, which may be an alias
 * @returns The canonical category, or null when the name is not one
 * @internal
 */
export function normalizeItemCategory(
  category: string | undefined,
): ItemCategory | null {
  if (category == null) {
    return null;
  }

  const normalizedCategory = ITEM_CATEGORY_BY_ALIAS.get(category);

  return normalizedCategory != null &&
    ITEM_CATEGORY_FACTS[normalizedCategory].isSetItem
    ? (normalizedCategory as ItemCategory)
    : null;
}
