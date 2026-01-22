import type { DataCategory, Item, Property } from "../types/main.js";
import { categorySchema } from "../schemas.js";
import { flattenProperties } from "./internal.js";

/**
 * Get the category of an item from the OCHRE API response
 * @param keys - The keys of the OCHRE API response
 * @returns The category of the item
 * @internal
 */
export function getItemCategory(keys: ReadonlyArray<string>): DataCategory {
  const categoryFound = keys.find(
    (key) => categorySchema.safeParse(key).success,
  );
  if (!categoryFound) {
    const unknownKey = keys.find(
      (key) =>
        ![
          "uuid",
          "uuidBelongsTo",
          "belongsTo",
          "publicationDateTime",
          "metadata",
          "languages",
        ].includes(key),
    );

    throw new Error(`Invalid OCHRE data; found unexpected "${unknownKey}" key`);
  }

  const categoryKey = categorySchema.parse(categoryFound);

  return categoryKey;
}

/**
 * Get the categories of items from the OCHRE API response
 * @param keys - The keys of the OCHRE API response
 * @returns The categories of the items
 * @internal
 */
export function getItemCategories(
  keys: ReadonlyArray<string>,
): Array<DataCategory> {
  const categories = keys.map((key) => categorySchema.safeParse(key));
  if (categories.some((result) => !result.success)) {
    throw new Error(
      `Invalid OCHRE data; found unexpected keys: ${categories
        .filter((result) => !result.success)
        .map((result) => result.error.message)
        .join(", ")}`,
    );
  }

  return categories
    .filter((result) => result.success)
    .map((result) => result.data);
}

/**
 * Flatten the properties of an item
 * @param item - The item whose properties to flatten
 * @returns The item with the properties flattened
 */
export function flattenItemProperties<
  T extends DataCategory,
  U extends DataCategory,
>(item: Item<T, U>): Item<T, U> {
  if ("properties" in item) {
    return { ...item, properties: flattenProperties(item.properties) };
  }

  // Check for observations, interpretations, or bibliographies
  function collectPropertiesFromSubNodes(): Array<Property> {
    const allProperties: Array<Property> = [];

    if ("observations" in item) {
      const typedItem = item as {
        observations: Array<{ properties: Array<Property> }>;
      };
      for (const observation of typedItem.observations) {
        allProperties.push(...observation.properties);
      }
    }

    if ("interpretations" in item) {
      const typedItem = item as {
        interpretations: Array<{ properties: Array<Property> }>;
      };
      for (const interpretation of typedItem.interpretations) {
        allProperties.push(...interpretation.properties);
      }
    }

    if ("bibliographies" in item) {
      const typedItem = item as {
        bibliographies: Array<{ properties: Array<Property> }>;
      };
      for (const bibliography of typedItem.bibliographies) {
        allProperties.push(...bibliography.properties);
      }
    }

    return flattenProperties(allProperties);
  }

  return { ...item, properties: collectPropertiesFromSubNodes() };
}
