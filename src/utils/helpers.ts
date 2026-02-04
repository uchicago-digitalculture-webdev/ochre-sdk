import type {
  DataCategory,
  Item,
  Property,
  PropertyValueContent,
  PropertyValueContentType,
} from "../types/main.js";
import { flattenProperties } from "./internal.js";

/**
 * The default API version to use
 *
 * @remarks
 * Version 1 of the OCHRE API is deprecated and will be removed in the future.
 * It points to the old Tamino server.
 *
 * Version 2 of the OCHRE API is the current version and is the default.
 * It points to the new MarkLogic server.
 */
export const DEFAULT_API_VERSION = 2;

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
  T extends DataCategory = DataCategory,
  U extends DataCategory | Array<DataCategory> = T extends "tree" ?
    Exclude<DataCategory, "tree">
  : T extends "set" ? Array<DataCategory>
  : never,
>(item: Item<T, U>): Item<T, U> {
  const allProperties: Array<Property> = [];

  if ("properties" in item) {
    allProperties.push(...item.properties);
  }

  if ("observations" in item) {
    for (const observation of item.observations) {
      allProperties.push(...observation.properties);
    }
  }

  if ("interpretations" in item) {
    for (const interpretation of item.interpretations) {
      allProperties.push(...interpretation.properties);
    }
  }

  if ("bibliographies" in item) {
    for (const bibliography of item.bibliographies) {
      allProperties.push(...bibliography.properties);
    }
  }

  return { ...item, properties: flattenProperties(allProperties) };
}

/**
 * Get the leaf property values from an array of property values
 * @param propertyValues - The array of property values to get the leaf property values from
 * @returns The array of leaf property values
 */
export function getLeafPropertyValues<
  T extends PropertyValueContentType = PropertyValueContentType,
>(
  propertyValues: Array<PropertyValueContent<T>>,
): Array<PropertyValueContent<T>> {
  return propertyValues.filter((value) => value.hierarchy.isLeaf);
}
