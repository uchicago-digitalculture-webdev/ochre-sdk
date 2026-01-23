import type { DataCategory, Item, Property } from "../types/main.js";
import { flattenProperties } from "./internal.js";

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
