import type { Property } from "../types/main.js";

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
