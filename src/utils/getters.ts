import type { Property } from "../types/main.js";

/**
 * Options for property search operations
 */
type PropertyOptions = {
  /** Whether to recursively search through nested properties */
  searchNestedProperties: boolean;
};

const DEFAULT_OPTIONS: PropertyOptions = {
  searchNestedProperties: false,
};

/**
 * Finds a property by its label in an array of properties
 *
 * @param properties - Array of properties to search through
 * @param label - The label to search for
 * @param options - Search options, including whether to search nested properties
 * @returns The matching Property object, or null if not found
 *
 * @example
 * ```ts
 * const property = getPropertyByLabel(properties, "author", { searchNestedProperties: true });
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
  const { searchNestedProperties } = options;
  const property = properties.find((property) => property.label === label);
  if (property) {
    return property;
  }

  if (searchNestedProperties) {
    for (const property of properties) {
      if (property.properties.length > 0) {
        const nestedResult = getPropertyByLabel(property.properties, label, {
          searchNestedProperties,
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
 * @param options - Search options, including whether to search nested properties
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
): Array<string> | null {
  const { searchNestedProperties } = options;

  const property = properties.find((property) => property.label === label);
  if (property) {
    return property.values.map((value) => value.content);
  }

  if (searchNestedProperties) {
    for (const property of properties) {
      if (property.properties.length > 0) {
        const nestedResult = getPropertyValuesByLabel(
          property.properties,
          label,
          { searchNestedProperties },
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
 * @param options - Search options, including whether to search nested properties
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
): string | null {
  const { searchNestedProperties } = options;
  const values = getPropertyValuesByLabel(properties, label, {
    searchNestedProperties,
  });
  if (values !== null && values.length > 0) {
    return values[0]!;
  }

  if (searchNestedProperties) {
    for (const property of properties) {
      if (property.properties.length > 0) {
        const nestedResult = getPropertyValueByLabel(
          property.properties,
          label,
          { searchNestedProperties },
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
 * Gets all unique property labels from an array of properties
 *
 * @param properties - Array of properties to get labels from
 * @param options - Search options, including whether to include nested property labels
 * @returns Array of unique property labels
 *
 * @example
 * ```ts
 * const labels = getAllPropertyLabels(properties, { searchNestedProperties: true });
 * console.log(`Available properties: ${labels.join(", ")}`);
 * ```
 */
export function getAllPropertyLabels(
  properties: Array<Property>,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Array<string> {
  const { searchNestedProperties } = options;
  const labels = new Set<string>();

  for (const property of properties) {
    labels.add(property.label);

    if (property.properties.length > 0 && searchNestedProperties) {
      const nestedLabels = getAllPropertyLabels(property.properties, {
        searchNestedProperties: true,
      });
      for (const label of nestedLabels) {
        labels.add(label);
      }
    }
  }

  return [...labels];
}

/**
 * Filters a property based on a label and value criteria
 *
 * @param property - The property to filter
 * @param filter - Filter criteria containing label and value to match
 * @param filter.label - The label to filter by
 * @param filter.value - The value to filter by
 * @param options - Search options, including whether to search nested properties
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
  filter: { label: string; value: string },
  options: PropertyOptions = DEFAULT_OPTIONS,
) {
  const { searchNestedProperties } = options;

  const isAllFields = filter.label.toLocaleLowerCase("en-US") === "all fields";

  if (
    isAllFields ||
    property.label.toLocaleLowerCase("en-US") ===
      filter.label.toLocaleLowerCase("en-US")
  ) {
    let isFound = property.values.some((value) =>
      value.content
        .toLocaleLowerCase("en-US")
        .includes(filter.value.toLocaleLowerCase("en-US")),
    );

    if (!isFound && searchNestedProperties) {
      isFound = property.properties.some((property) =>
        filterProperties(property, filter, { searchNestedProperties: true }),
      );
    }

    return isFound;
  }

  return false;
}
