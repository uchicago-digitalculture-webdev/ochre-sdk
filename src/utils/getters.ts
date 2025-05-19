import type { Property } from "../types/main.js";

/**
 * Options for property search operations
 */
type PropertyOptions = {
  /** Whether to recursively search through nested properties */
  includeNestedProperties: boolean;
};

const DEFAULT_OPTIONS: PropertyOptions = { includeNestedProperties: false };

/**
 * Finds a property by its label in an array of properties
 *
 * @param properties - Array of properties to search through
 * @param label - The label to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The matching Property object, or null if not found
 *
 * @example
 * ```ts
 * const property = getPropertyByLabel(properties, "author", { includeNestedProperties: true });
 * if (property) {
 *   console.log(property.values);
 * }
 * ```
 */
export function getPropertyByLabel(
  properties: Array<Property>,
  label: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Property | null {
  const { includeNestedProperties } = options;
  const property = properties.find((property) => property.label === label);
  if (property) {
    return property;
  }

  if (includeNestedProperties) {
    for (const property of properties) {
      if (property.properties.length > 0) {
        const nestedResult = getPropertyByLabel(property.properties, label, {
          includeNestedProperties,
        });
        if (nestedResult) {
          return nestedResult;
        }
      }
    }
  }

  return null;
}

/**
 * Retrieves all values for a property with the given label
 *
 * @param properties - Array of properties to search through
 * @param label - The label to search for
 * @param options - Search options, including whether to include nested properties
 * @returns Array of property values as strings, or null if property not found
 *
 * @example
 * ```ts
 * const values = getPropertyValuesByLabel(properties, "keywords");
 * if (values) {
 *   for (const value of values) {
 *     console.log(value);
 *   }
 * }
 * ```
 */
export function getPropertyValuesByLabel(
  properties: Array<Property>,
  label: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Array<string | number | boolean | Date | null> | null {
  const { includeNestedProperties } = options;

  const property = properties.find((property) => property.label === label);
  if (property) {
    return property.values.map((value) => value.content);
  }

  if (includeNestedProperties) {
    for (const property of properties) {
      if (property.properties.length > 0) {
        const nestedResult = getPropertyValuesByLabel(
          property.properties,
          label,
          { includeNestedProperties },
        );
        if (nestedResult) {
          return nestedResult;
        }
      }
    }
  }

  return null;
}

/**
 * Gets the first value of a property with the given label
 *
 * @param properties - Array of properties to search through
 * @param label - The label to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The first property value as string, or null if property not found
 *
 * @example
 * ```ts
 * const title = getPropertyValueByLabel(properties, "title");
 * if (title) {
 *   console.log(`Document title: ${title}`);
 * }
 * ```
 */
export function getPropertyValueByLabel(
  properties: Array<Property>,
  label: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): string | number | boolean | Date | null {
  const { includeNestedProperties } = options;
  const values = getPropertyValuesByLabel(properties, label, {
    includeNestedProperties,
  });
  if (values !== null && values.length > 0) {
    return values[0]!;
  }

  if (includeNestedProperties) {
    for (const property of properties) {
      if (property.properties.length > 0) {
        const nestedResult = getPropertyValueByLabel(
          property.properties,
          label,
          { includeNestedProperties },
        );
        if (nestedResult !== null) {
          return nestedResult;
        }
      }
    }
  }

  return null;
}

/**
 * Gets all unique properties from an array of properties
 *
 * @param properties - Array of properties to get unique properties from
 * @param options - Search options, including whether to include nested properties
 * @returns Array of unique properties
 *
 * @example
 * ```ts
 * const properties = getAllUniqueProperties(properties, { includeNestedProperties: true });
 * console.log(`Available properties: ${properties.map((p) => p.label).join(", ")}`);
 * ```
 */
export function getUniqueProperties(
  properties: Array<Property>,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Array<Property> {
  const { includeNestedProperties } = options;
  const uniqueProperties = new Array<Property>();

  for (const property of properties) {
    if (uniqueProperties.some((p) => p.uuid === property.uuid)) {
      continue;
    }

    uniqueProperties.push(property);

    if (property.properties.length > 0 && includeNestedProperties) {
      const nestedProperties = getUniqueProperties(property.properties, {
        includeNestedProperties: true,
      });
      for (const property of nestedProperties) {
        if (uniqueProperties.some((p) => p.uuid === property.uuid)) {
          continue;
        }

        uniqueProperties.push(property);
      }
    }
  }

  return uniqueProperties;
}

/**
 * Filters a property based on a label and value criteria
 *
 * @param property - The property to filter
 * @param filter - Filter criteria containing label and value to match
 * @param filter.label - The label to filter by
 * @param filter.value - The value to filter by
 * @param options - Search options, including whether to include nested properties
 * @returns True if the property matches the filter criteria, false otherwise
 *
 * @example
 * ```ts
 * const matches = filterProperties(property, {
 *   label: "category",
 *   value: "book"
 * });
 * if (matches) {
 *   console.log("Property matches filter criteria");
 * }
 * ```
 */
export function filterProperties(
  property: Property,
  filter: { label: string; value: string | number | boolean | Date },
  options: PropertyOptions = DEFAULT_OPTIONS,
): boolean {
  const { includeNestedProperties } = options;

  const isAllFields = filter.label.toLocaleLowerCase("en-US") === "all fields";

  if (
    isAllFields ||
    property.label.toLocaleLowerCase("en-US") ===
      filter.label.toLocaleLowerCase("en-US")
  ) {
    let isFound = property.values.some((value) => {
      if (value.content === null) {
        return false;
      }

      if (typeof value.content === "string") {
        if (typeof filter.value !== "string") {
          return false;
        }

        return value.content
          .toLocaleLowerCase("en-US")
          .includes(filter.value.toLocaleLowerCase("en-US"));
      }

      if (typeof value.content === "number") {
        if (typeof filter.value !== "number") {
          return false;
        }

        return value.content === filter.value;
      }

      if (typeof value.content === "boolean") {
        if (typeof filter.value !== "boolean") {
          return false;
        }

        return value.booleanValue === filter.value;
      }

      if (value.content instanceof Date) {
        if (!(filter.value instanceof Date)) {
          return false;
        }

        return value.content.getTime() === filter.value.getTime();
      }

      return false;
    });

    if (!isFound && includeNestedProperties) {
      isFound = property.properties.some((property) =>
        filterProperties(property, filter, { includeNestedProperties: true }),
      );
    }

    return isFound;
  }

  return false;
}
