/**
 * Reading values whose shape is not known at compile time
 *
 * The SDK used to do this with five copies of a
 * `value is Record<string, unknown>` predicate over
 * `typeof value === "object" && value != null`. That predicate lies three ways:
 * it is true for arrays, `Date`, `Map` and every other object; it claims a
 * string index signature the value does not have, so every read produces
 * `unknown` and callers add a second cast to get anything out of it; and being
 * an `&&` of unrelated checks, its `false` branch does not mean "not a record",
 * which is what a type predicate promises.
 *
 * These take `unknown` and hand back `unknown`. They assert nothing they have
 * not checked, so the one unavoidable cast at the boundary lives here instead
 * of being repeated at every call site. Where the shape *is* known, validate it
 * with a valibot schema and `v.is` rather than reaching for these.
 */

/**
 * Whether a value is a non-null object
 *
 * Narrows to `object`, which is honest: arrays, `Date` and class instances are
 * objects too. Callers that need to tell them apart still have to ask.
 * @param value - The value to test
 * @returns True when the value is a non-null object
 * @internal
 */
export function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

/**
 * Read one property from a value of unknown shape
 *
 * Uses `Reflect.get`, so there is no cast: a missing property, a non-object and
 * a property holding `undefined` are all `undefined`, and the caller has to
 * narrow whatever comes back.
 * @param value - The value to read from
 * @param key - The property to read
 * @returns The property value, or undefined when there is none
 * @internal
 */
export function readProperty(value: unknown, key: PropertyKey): unknown {
  if (!isObject(value)) {
    return undefined;
  }

  const property: unknown = Reflect.get(value, key);

  return property;
}

/**
 * Read the own enumerable string-keyed entries of a value of unknown shape
 * @param value - The value to read from
 * @returns The entries, or an empty array when the value is not an object
 * @internal
 */
export function readEntries(value: unknown): Array<[string, unknown]> {
  if (!isObject(value)) {
    return [];
  }

  const entries: Array<[string, unknown]> = Object.entries(value);

  return entries;
}

/**
 * Read a property that should hold an array, from a value of unknown shape
 * @param value - The value to read from
 * @param key - The property to read
 * @returns The array, or an empty array when the property is absent or not one
 * @internal
 */
export function readArrayProperty(
  value: unknown,
  key: PropertyKey,
): ReadonlyArray<unknown> {
  const property = readProperty(value, key);

  return Array.isArray(property) ? property : [];
}

/**
 * Read a property that should hold a string, from a value of unknown shape
 * @param value - The value to read from
 * @param key - The property to read
 * @returns The string, or null when the property is absent or not one
 * @internal
 */
export function readStringProperty(
  value: unknown,
  key: PropertyKey,
): string | null {
  const property = readProperty(value, key);

  return typeof property === "string" ? property : null;
}
