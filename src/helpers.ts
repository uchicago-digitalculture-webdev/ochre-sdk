import type {
  DataCategory,
  HierarchyItemDataCategory,
  Item,
  ItemLocation,
  Property,
  SingleHierarchyProperty,
} from "#/types/index.js";
import { flattenProperties } from "#/utils.js";

type FlattenedItem<U, T extends ReadonlyArray<string>> = Omit<
  U,
  "properties"
> & { properties: Array<SingleHierarchyProperty<T>> };

type PropertySource<T extends ReadonlyArray<string>> = {
  properties: ReadonlyArray<Property<T> | SingleHierarchyProperty<T>>;
};

type ObservationPropertySource<T extends ReadonlyArray<string>> = {
  observations: ReadonlyArray<PropertySource<T>>;
};

type InterpretationPropertySource<T extends ReadonlyArray<string>> = {
  interpretations: ReadonlyArray<PropertySource<T>>;
};

type BibliographyPropertySource<T extends ReadonlyArray<string>> = {
  bibliographies: ReadonlyArray<PropertySource<T>>;
};

/**
 * The default page size to use for fetching paginated items
 */
export const DEFAULT_PAGE_SIZE = 48;

/**
 * Flatten the properties of an item
 * @param item - The item whose properties to flatten
 * @returns The item with the properties flattened
 */
export function flattenItemProperties<
  U extends DataCategory = DataCategory,
  V extends HierarchyItemDataCategory<U> = HierarchyItemDataCategory<U>,
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
  W extends ItemLocation = "topLevel",
>(item: Item<U, V, T, W>): FlattenedItem<Item<U, V, T, W>, T> {
  const allProperties: Array<Property<T> | SingleHierarchyProperty<T>> = [];

  if ("properties" in item) {
    allProperties.push(...item.properties);
  }

  if ("observations" in item) {
    const { observations } = item as ObservationPropertySource<T>;
    for (const observation of observations) {
      allProperties.push(...observation.properties);
    }
  }

  if ("interpretations" in item) {
    const { interpretations } = item as InterpretationPropertySource<T>;
    for (const interpretation of interpretations) {
      allProperties.push(...interpretation.properties);
    }
  }

  if ("bibliographies" in item) {
    const { bibliographies } = item as BibliographyPropertySource<T>;
    for (const bibliography of bibliographies) {
      allProperties.push(...bibliography.properties);
    }
  }

  return {
    ...item,
    properties: flattenProperties(allProperties),
  } as FlattenedItem<Item<U, V, T, W>, T>;
}
