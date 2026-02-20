import { parseISO } from "date-fns";
import type { DataCategory, Property } from "../types/index.js";
import type { RawFakeString, RawStringContent } from "../types/raw.js";
import { categorySchema } from "../schemas.js";
import { parseFakeString, parseStringContent } from "./string.js";

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
 * Validates a pseudo-UUID string
 * @param value - The string to validate
 * @returns True if the string is a valid pseudo-UUID, false otherwise
 * @internal
 */
export function isPseudoUuid(value: string): boolean {
  return /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value);
}

/**
 * Flatten a properties array
 * @param properties - The properties to flatten
 * @returns The flattened properties
 * @internal
 */
export function flattenProperties(
  properties: Array<Property>,
): Array<Property> {
  const result: Array<Property> = [];
  const queue = [...properties];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const { properties: nestedProperties, ...rest } = current;

    result.push({ ...rest, properties: [] });

    if (nestedProperties.length > 0) {
      queue.push(...nestedProperties);
    }
  }

  return result;
}

/**
 * Parses a citation string into a formatted string.
 *
 * @param raw - Citation string to parse
 * @returns Parsed citation string or null
 */
export function parseCitation(raw: string | undefined): string | null {
  if (!raw) {
    return null;
  }

  try {
    return (JSON.parse(`"${raw}"`) as string)
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">");
  } catch {
    return raw;
  }
}

/**
 * Normalizes a value that may be a single item or an array into an array.
 *
 * @param value - Value to normalize
 * @returns Array of values
 */
export function ensureArray<T>(value: T | Array<T>): Array<T> {
  return Array.isArray(value) ? value : [value];
}

/**
 * Type guard for FakeString (string | number | boolean).
 *
 * @param value - Value to check
 * @returns True if the value is a FakeString
 */
export function isFakeString(value: unknown): value is RawFakeString {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/**
 * Parses a value that is either a FakeString or OchreStringContent.
 *
 * @param value - Value to parse
 * @returns Parsed value
 */
export function parseFakeStringOrContent(
  value: RawFakeString | RawStringContent,
): string {
  return isFakeString(value) ?
      parseFakeString(value)
    : parseStringContent(value);
}

/**
 * Parses an optional ISO date string into a Date or null.
 *
 * @param dateTime - Date string to parse
 * @returns Parsed date or null
 */
export function parseOptionalDate(
  dateTime: string | null | undefined,
): Date | null {
  return dateTime != null ? parseISO(dateTime) : null;
}

/**
 * Cleans an object by removing null values
 * @param object - The object to clean
 * @returns The cleaned object
 */
export function cleanObject<T extends Record<string, unknown>>(object: T): T {
  return Object.fromEntries(
    Object.entries(object).filter(([_, value]) => value != null),
  ) as T;
}
