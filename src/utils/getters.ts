import { deepEqual } from "fast-equals";
import type {
  Property,
  PropertyValueContent,
  PropertyValueContentType,
} from "#/types/index.js";

/**
 * Options for property search operations
 */
type PropertyOptions = {
  /** Whether to recursively search through nested properties */
  includeNestedProperties?: boolean;
  /** Whether to limit the search to leaf properties */
  limitToLeafPropertyValues?: boolean;
};

const DEFAULT_OPTIONS: PropertyOptions = {
  includeNestedProperties: false,
  limitToLeafPropertyValues: true,
};

/**
 * Searches for a property in an array of properties
 * @param properties - The array of properties to search through
 * @param options - The options for the search
 * @param findDirectResult - A function to find the direct result
 * @param transformNestedResult - A function to transform the nested result
 * @returns The result of the search, or null if not found
 */
function searchPropertyResult<
  T extends PropertyValueContentType = PropertyValueContentType,
  TResult = Property<T>,
>(
  properties: Array<Property<T>>,
  options: PropertyOptions,
  findDirectResult: (properties: Array<Property<T>>) => TResult | null,
  transformNestedResult?: (result: TResult) => TResult | null,
): TResult | null {
  const directResult = findDirectResult(properties);
  if (directResult !== null) {
    return directResult;
  }

  if (options.includeNestedProperties) {
    for (const property of properties) {
      const nestedResult = searchPropertyResult(
        property.properties as Array<Property<T>>,
        options,
        findDirectResult,
        transformNestedResult,
      );
      if (nestedResult !== null) {
        const transformedResult =
          transformNestedResult != null ?
            transformNestedResult(nestedResult)
          : nestedResult;
        if (transformedResult !== null) {
          return transformedResult;
        }
      }
    }
  }

  return null;
}

function getPropertyValuesResult<
  T extends PropertyValueContentType = PropertyValueContentType,
>(
  values: Array<PropertyValueContent<T>>,
  limitToLeafPropertyValues: boolean | undefined,
  copyValuesWhenUnfiltered: boolean,
): Array<PropertyValueContent<T>> {
  if (limitToLeafPropertyValues) {
    return getLeafPropertyValues(values);
  }

  if (copyValuesWhenUnfiltered) {
    return values.map((value) => value);
  }

  return values;
}

function clonePropertyValues<
  T extends PropertyValueContentType = PropertyValueContentType,
>(values: Array<PropertyValueContent<T>>): Array<PropertyValueContent<T>> {
  return values.map((value) => ({ ...value, content: value.content }));
}

function getNormalizedProperty<
  T extends PropertyValueContentType = PropertyValueContentType,
>(
  property: Property<T>,
  limitToLeafPropertyValues: boolean | undefined,
  transformValues?: (
    values: Array<PropertyValueContent<T>>,
  ) => Array<PropertyValueContent<T>>,
): Property<T> {
  if (!limitToLeafPropertyValues) {
    return property;
  }

  const values = getLeafPropertyValues(property.values);

  return {
    ...property,
    values: transformValues != null ? transformValues(values) : values,
  };
}

function getFirstPropertyValueResult<
  T extends PropertyValueContentType = PropertyValueContentType,
>(
  values: Array<PropertyValueContent<T>>,
  limitToLeafPropertyValues: boolean | undefined,
): PropertyValueContent<T> | null {
  if (limitToLeafPropertyValues) {
    return getLeafPropertyValues(values)[0] ?? null;
  }

  return values[0] ?? null;
}

function getFirstPropertyValueContentResult<
  T extends PropertyValueContentType = PropertyValueContentType,
>(
  values: Array<PropertyValueContent<T>>,
  limitToLeafPropertyValues: boolean | undefined,
): PropertyValueContent<T>["content"] | null {
  if (limitToLeafPropertyValues) {
    return getLeafPropertyValues(values)[0]?.content ?? null;
  }

  return values[0]?.content ?? null;
}

function visitProperties<
  T extends PropertyValueContentType = PropertyValueContentType,
>(
  properties: Array<Property<T>>,
  includeNestedProperties: boolean | undefined,
  visit: (property: Property<T>) => void,
): void {
  for (const property of properties) {
    visit(property);

    if (includeNestedProperties) {
      visitProperties(
        property.properties as Array<Property<T>>,
        includeNestedProperties,
        visit,
      );
    }
  }
}

/**
 * Finds a property by its UUID in an array of properties
 *
 * @param properties - Array of properties to search through
 * @param uuid - The UUID to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The matching Property object, or null if not found
 */
export function getPropertyByUuid<
  T extends PropertyValueContentType = PropertyValueContentType,
>(
  properties: Array<Property<T>>,
  uuid: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Property<T> | null {
  const { includeNestedProperties } = options;

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) =>
      currentProperties.find((property) => property.uuid === uuid) ?? null,
  );
}

/**
 * Retrieves all values for a property with the given UUID
 *
 * @param properties - Array of properties to search through
 * @param uuid - The UUID to search for
 * @param options - Search options, including whether to include nested properties
 * @returns Array of property values as strings, or null if property not found
 */
export function getPropertyValuesByUuid<
  T extends PropertyValueContentType = PropertyValueContentType,
>(
  properties: Array<Property<T>>,
  uuid: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Array<PropertyValueContent<T>> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } = options;

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      const property =
        currentProperties.find(
          (currentProperty) => currentProperty.uuid === uuid,
        ) ?? null;
      if (property == null) {
        return null;
      }

      return getPropertyValuesResult(
        property.values,
        limitToLeafPropertyValues,
        true,
      );
    },
    (nestedResult) =>
      getPropertyValuesResult(nestedResult, limitToLeafPropertyValues, true),
  );
}

/**
 * Retrieves all value contents for a property with the given UUID
 *
 * @param properties - Array of properties to search through
 * @param uuid - The UUID to search for
 * @param options - Search options, including whether to include nested properties
 * @returns Array of property value contents as strings, or null if property not found
 */
export function getPropertyValueContentsByUuid<
  T extends PropertyValueContentType = PropertyValueContentType,
>(
  properties: Array<Property<T>>,
  uuid: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Array<PropertyValueContent<T>["content"]> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } = options;

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      const property =
        currentProperties.find(
          (currentProperty) => currentProperty.uuid === uuid,
        ) ?? null;
      if (property == null) {
        return null;
      }

      return getPropertyValuesResult(
        property.values,
        limitToLeafPropertyValues,
        false,
      ).map((value) => value.content);
    },
  );
}

/**
 * Gets the first value of a property with the given UUID
 *
 * @param properties - Array of properties to search through
 * @param uuid - The UUID to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The first property value as string, or null if property not found
 */
export function getPropertyValueByUuid<
  T extends PropertyValueContentType = PropertyValueContentType,
>(
  properties: Array<Property<T>>,
  uuid: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): PropertyValueContent<T> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } = options;

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      const values = getPropertyValuesByUuid<T>(currentProperties, uuid, {
        includeNestedProperties: false,
        limitToLeafPropertyValues,
      });
      if (values === null || values.length === 0) {
        return null;
      }

      return getFirstPropertyValueResult(values, limitToLeafPropertyValues);
    },
    (nestedResult) =>
      getFirstPropertyValueResult([nestedResult], limitToLeafPropertyValues),
  );
}

/**
 * Gets the first value content of a property with the given UUID
 *
 * @param properties - Array of properties to search through
 * @param uuid - The UUID to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The first property value content as string, or null if property not found
 */
export function getPropertyValueContentByUuid<
  T extends PropertyValueContentType = PropertyValueContentType,
>(
  properties: Array<Property<T>>,
  uuid: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): PropertyValueContent<T>["content"] | null {
  const { includeNestedProperties, limitToLeafPropertyValues } = options;

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      const values = getPropertyValuesByUuid<T>(currentProperties, uuid, {
        includeNestedProperties: false,
        limitToLeafPropertyValues,
      });
      if (values === null || values.length === 0) {
        return null;
      }

      return getFirstPropertyValueContentResult(
        values,
        limitToLeafPropertyValues,
      );
    },
  );
}

/**
 * Finds a property by its label in an array of properties
 *
 * @param properties - Array of properties to search through
 * @param label - The label to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The matching Property object, or null if not found
 */
export function getPropertyByLabel<
  T extends PropertyValueContentType = PropertyValueContentType,
>(
  properties: Array<Property<T>>,
  label: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Property<T> | null {
  const { includeNestedProperties } = options;

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) =>
      currentProperties.find((property) => property.label === label) ?? null,
  );
}

/**
 * Finds a property by its label and all values in an array of properties
 *
 * @param properties - Array of properties to search through
 * @param label - The label to search for
 * @param values - The values to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The matching Property object, or null if not found or all values do not match
 */
export function getPropertyByLabelAndValues<
  T extends PropertyValueContentType = PropertyValueContentType,
>(
  properties: Array<Property<T>>,
  label: string,
  values: Array<PropertyValueContent<T>>,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Property<T> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } = options;

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      const property =
        currentProperties.find(
          (currentProperty) =>
            currentProperty.label === label &&
            deepEqual(currentProperty.values, values),
        ) ?? null;
      if (property == null) {
        return null;
      }

      return getNormalizedProperty(property, limitToLeafPropertyValues);
    },
    (nestedResult) =>
      getNormalizedProperty(nestedResult, limitToLeafPropertyValues),
  );
}

/**
 * Finds a property by its label and all values in an array of properties
 *
 * @param properties - Array of properties to search through
 * @param label - The label to search for
 * @param valueContents - The value contents to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The matching Property object, or null if not found or all values do not match
 */
export function getPropertyByLabelAndValueContents<
  T extends PropertyValueContentType = PropertyValueContentType,
>(
  properties: Array<Property<T>>,
  label: string,
  valueContents: Array<PropertyValueContent<T>["content"]>,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Property<T> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } = options;

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      const property =
        currentProperties.find(
          (currentProperty) =>
            currentProperty.label === label &&
            deepEqual(
              currentProperty.values.map((value) => value.content),
              valueContents,
            ),
        ) ?? null;
      if (property == null) {
        return null;
      }

      return getNormalizedProperty(
        property,
        limitToLeafPropertyValues,
        clonePropertyValues,
      );
    },
    (nestedResult) =>
      getNormalizedProperty(nestedResult, limitToLeafPropertyValues),
  );
}

/**
 * Finds a property by its label and value in an array of properties
 *
 * @param properties - Array of properties to search through
 * @param label - The label to search for
 * @param value - The value to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The matching Property object, or null if not found or value does not match
 */
export function getPropertyByLabelAndValue<
  T extends PropertyValueContentType = PropertyValueContentType,
>(
  properties: Array<Property<T>>,
  label: string,
  value: PropertyValueContent<T>,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Property<T> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } = options;

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      const property =
        currentProperties.find(
          (currentProperty) =>
            currentProperty.label === label &&
            currentProperty.values.some((candidateValue) =>
              deepEqual(candidateValue, value),
            ),
        ) ?? null;
      if (property == null) {
        return null;
      }

      return getNormalizedProperty(property, limitToLeafPropertyValues);
    },
    (nestedResult) =>
      getNormalizedProperty(nestedResult, limitToLeafPropertyValues),
  );
}

/**
 * Finds a property by its label and value content in an array of properties
 *
 * @param properties - Array of properties to search through
 * @param label - The label to search for
 * @param valueContent - The value content to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The matching Property object, or null if not found or value content does not match
 */
export function getPropertyByLabelAndValueContent<
  T extends PropertyValueContentType = PropertyValueContentType,
>(
  properties: Array<Property<T>>,
  label: string,
  valueContent: PropertyValueContent<T>["content"],
  options: PropertyOptions = DEFAULT_OPTIONS,
): Property<T> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } = options;

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      const property =
        currentProperties.find(
          (currentProperty) =>
            currentProperty.label === label &&
            currentProperty.values.some((value) =>
              deepEqual(value.content, valueContent),
            ),
        ) ?? null;
      if (property == null) {
        return null;
      }

      return getNormalizedProperty(property, limitToLeafPropertyValues);
    },
    (nestedResult) =>
      getNormalizedProperty(nestedResult, limitToLeafPropertyValues),
  );
}

/**
 * Retrieves all values for a property with the given label
 *
 * @param properties - Array of properties to search through
 * @param label - The label to search for
 * @param options - Search options, including whether to include nested properties
 * @returns Array of property values as strings, or null if property not found
 */
export function getPropertyValuesByLabel<
  T extends PropertyValueContentType = PropertyValueContentType,
>(
  properties: Array<Property<T>>,
  label: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Array<PropertyValueContent<T>> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } = options;

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      const property =
        currentProperties.find(
          (currentProperty) => currentProperty.label === label,
        ) ?? null;
      if (property == null) {
        return null;
      }

      return getPropertyValuesResult(
        property.values,
        limitToLeafPropertyValues,
        false,
      );
    },
    (nestedResult) =>
      getPropertyValuesResult(nestedResult, limitToLeafPropertyValues, false),
  );
}

/**
 * Gets the first value of a property with the given label
 *
 * @param properties - Array of properties to search through
 * @param label - The label to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The first property value as string, or null if property not found
 */
export function getPropertyValueByLabel<
  T extends PropertyValueContentType = PropertyValueContentType,
>(
  properties: Array<Property<T>>,
  label: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): PropertyValueContent<T> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } = options;

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      const values = getPropertyValuesByLabel<T>(currentProperties, label, {
        includeNestedProperties: false,
        limitToLeafPropertyValues,
      });
      if (values === null || values.length === 0) {
        return null;
      }

      return getFirstPropertyValueResult(values, limitToLeafPropertyValues);
    },
    (nestedResult) =>
      getFirstPropertyValueResult([nestedResult], limitToLeafPropertyValues),
  );
}

/**
 * Gets the first value content of a property with the given label
 *
 * @param properties - Array of properties to search through
 * @param label - The label to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The first property value content as string, or null if property not found
 */
export function getPropertyValueContentByLabel<
  T extends PropertyValueContentType = PropertyValueContentType,
>(
  properties: Array<Property<T>>,
  label: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): PropertyValueContent<T>["content"] | null {
  const { includeNestedProperties, limitToLeafPropertyValues } = options;

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      const values = getPropertyValuesByLabel<T>(currentProperties, label, {
        includeNestedProperties: false,
        limitToLeafPropertyValues,
      });
      if (values === null || values.length === 0) {
        return null;
      }

      return getFirstPropertyValueContentResult(
        values,
        limitToLeafPropertyValues,
      );
    },
  );
}

/**
 * Gets all unique properties from an array of properties
 *
 * @param properties - Array of properties to get unique properties from
 * @param options - Search options, including whether to include nested properties
 * @returns Array of unique properties
 */
export function getUniqueProperties<
  T extends PropertyValueContentType = PropertyValueContentType,
>(
  properties: Array<Property<T>>,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Array<Property<T>> {
  const { includeNestedProperties, limitToLeafPropertyValues } = options;
  const uniqueProperties = new Array<Property<T>>();

  visitProperties(properties, includeNestedProperties, (property) => {
    if (uniqueProperties.some((p) => p.uuid === property.uuid)) {
      return;
    }

    uniqueProperties.push(property);
  });

  if (limitToLeafPropertyValues) {
    return uniqueProperties.map((property) =>
      getNormalizedProperty(property, limitToLeafPropertyValues),
    );
  }

  return uniqueProperties;
}

/**
 * Gets all unique property labels from an array of properties
 *
 * @param properties - Array of properties to get unique property labels from
 * @param options - Search options, including whether to include nested properties
 * @returns Array of unique property labels
 */
export function getUniquePropertyLabels<
  T extends PropertyValueContentType = PropertyValueContentType,
>(
  properties: Array<Property<T>>,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Array<string> {
  const { includeNestedProperties } = options;
  const uniquePropertyLabels = new Array<string>();

  visitProperties(properties, includeNestedProperties, (property) => {
    if (uniquePropertyLabels.includes(property.label)) {
      return;
    }

    uniquePropertyLabels.push(property.label);
  });

  return uniquePropertyLabels;
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

/**
 * Filters a property based on a label and value criteria
 *
 * @param property - The property to filter
 * @param filter - Filter criteria containing label and value to match
 * @param filter.label - The label to filter by
 * @param filter.value - The value to filter by
 * @param options - Search options, including whether to include nested properties
 * @returns True if the property matches the filter criteria, false otherwise
 */
export function filterProperties<
  T extends PropertyValueContentType = PropertyValueContentType,
>(
  property: Property<T>,
  filter: { label: string; value: PropertyValueContent<T> },
  options: PropertyOptions = DEFAULT_OPTIONS,
): boolean {
  const { includeNestedProperties, limitToLeafPropertyValues } = options;

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
        if (typeof filter.value.content !== "string") {
          return false;
        }

        return value.content
          .toLocaleLowerCase("en-US")
          .includes(filter.value.content.toLocaleLowerCase("en-US"));
      }

      if (typeof value.content === "number") {
        if (typeof filter.value.content !== "number") {
          return false;
        }

        return value.content === filter.value.content;
      }

      if (typeof value.content === "boolean") {
        if (typeof filter.value.content !== "boolean") {
          return false;
        }

        return value.content === filter.value.content;
      }

      return false;
    });

    if (!isFound && includeNestedProperties) {
      isFound = property.properties.some((nestedProperty) =>
        filterProperties<T>(nestedProperty as Property<T>, filter, {
          includeNestedProperties: true,
          limitToLeafPropertyValues,
        }),
      );
    }

    return isFound;
  }

  return false;
}
