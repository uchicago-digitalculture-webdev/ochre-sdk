import { deepEqual } from "fast-equals";
import type {
  Property,
  PropertyValueContent,
  PropertyValueContentType,
} from "../types/index.js";

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
  const { includeNestedProperties, limitToLeafPropertyValues } = options;
  const property = properties.find((property) => property.uuid === uuid);
  if (property != null) {
    return property;
  }

  if (includeNestedProperties) {
    for (const property of properties) {
      const nestedResult = getPropertyByUuid<T>(
        property.properties as Array<Property<T>>,
        uuid,
        { includeNestedProperties, limitToLeafPropertyValues },
      );
      if (nestedResult !== null) {
        return nestedResult;
      }
    }
  }

  return null;
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

  const property = properties.find((property) => property.uuid === uuid);
  if (property != null) {
    if (limitToLeafPropertyValues) {
      return getLeafPropertyValues<T>(property.values);
    } else {
      return property.values.map((value) => value);
    }
  }

  if (includeNestedProperties) {
    for (const nestedProperty of properties) {
      const nestedResult = getPropertyValuesByUuid<T>(
        nestedProperty.properties as Array<Property<T>>,
        uuid,
        { includeNestedProperties, limitToLeafPropertyValues },
      );
      if (nestedResult !== null) {
        if (limitToLeafPropertyValues) {
          return getLeafPropertyValues<T>(nestedResult);
        } else {
          return nestedResult.map((value) => value);
        }
      }
    }
  }

  return null;
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

  const property = properties.find((property) => property.uuid === uuid);
  if (property != null) {
    if (limitToLeafPropertyValues) {
      return getLeafPropertyValues<T>(property.values).map(
        (value) => value.content,
      );
    } else {
      return property.values.map((value) => value.content);
    }
  }

  if (includeNestedProperties) {
    for (const nestedProperty of properties) {
      const nestedResult = getPropertyValueContentsByUuid<T>(
        nestedProperty.properties as Array<Property<T>>,
        uuid,
        { includeNestedProperties, limitToLeafPropertyValues },
      );
      if (nestedResult !== null) {
        return nestedResult;
      }
    }
  }

  return null;
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
  const values = getPropertyValuesByUuid<T>(properties, uuid, {
    includeNestedProperties,
    limitToLeafPropertyValues,
  });
  if (values !== null && values.length > 0) {
    if (limitToLeafPropertyValues) {
      return getLeafPropertyValues<T>(values)[0] ?? null;
    } else {
      return values[0]!;
    }
  }

  if (includeNestedProperties) {
    for (const nestedProperty of properties) {
      const nestedResult = getPropertyValueByUuid<T>(
        nestedProperty.properties as Array<Property<T>>,
        uuid,
        { includeNestedProperties, limitToLeafPropertyValues },
      );
      if (nestedResult !== null) {
        if (limitToLeafPropertyValues) {
          return getLeafPropertyValues<T>([nestedResult])[0] ?? null;
        } else {
          return nestedResult;
        }
      }
    }
  }

  return null;
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
  const values = getPropertyValuesByUuid<T>(properties, uuid, {
    includeNestedProperties,
    limitToLeafPropertyValues,
  });
  if (values !== null && values.length > 0) {
    if (limitToLeafPropertyValues) {
      return getLeafPropertyValues<T>(values)[0]?.content ?? null;
    } else {
      return values[0]!.content;
    }
  }

  if (includeNestedProperties) {
    for (const nestedProperty of properties) {
      const nestedResult = getPropertyValueContentByUuid<T>(
        nestedProperty.properties as Array<Property<T>>,
        uuid,
        { includeNestedProperties, limitToLeafPropertyValues },
      );
      if (nestedResult !== null) {
        return nestedResult;
      }
    }
  }

  return null;
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
  const { includeNestedProperties, limitToLeafPropertyValues } = options;
  const property = properties.find((property) => property.label === label);
  if (property != null) {
    return property;
  }

  if (includeNestedProperties) {
    for (const nestedProperty of properties) {
      const nestedResult = getPropertyByLabel<T>(
        nestedProperty.properties as Array<Property<T>>,
        label,
        { includeNestedProperties, limitToLeafPropertyValues },
      );
      if (nestedResult !== null) {
        return nestedResult;
      }
    }
  }

  return null;
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
  const property = properties.find(
    (property) =>
      property.label === label && deepEqual(property.values, values),
  );
  if (property != null) {
    if (limitToLeafPropertyValues) {
      return { ...property, values: getLeafPropertyValues<T>(property.values) };
    } else {
      return property;
    }
  }

  if (includeNestedProperties) {
    for (const nestedProperty of properties) {
      const nestedResult = getPropertyByLabelAndValues<T>(
        nestedProperty.properties as Array<Property<T>>,
        label,
        values,
        { includeNestedProperties, limitToLeafPropertyValues },
      );
      if (nestedResult !== null) {
        if (limitToLeafPropertyValues) {
          return {
            ...nestedResult,
            values: getLeafPropertyValues<T>(nestedResult.values),
          };
        } else {
          return nestedResult;
        }
      }
    }
  }

  return null;
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
  const property = properties.find(
    (property) =>
      property.label === label &&
      deepEqual(
        property.values.map((value) => value.content),
        valueContents,
      ),
  );
  if (property != null) {
    if (limitToLeafPropertyValues) {
      return {
        ...property,
        values: getLeafPropertyValues<T>(property.values).map((value) => ({
          ...value,
          content: value.content,
        })),
      };
    } else {
      return property;
    }
  }

  if (includeNestedProperties) {
    for (const nestedProperty of properties) {
      const nestedResult = getPropertyByLabelAndValueContents<T>(
        nestedProperty.properties as Array<Property<T>>,
        label,
        valueContents,
        { includeNestedProperties, limitToLeafPropertyValues },
      );
      if (nestedResult !== null) {
        if (limitToLeafPropertyValues) {
          return {
            ...nestedResult,
            values: getLeafPropertyValues<T>(nestedResult.values),
          };
        } else {
          return nestedResult;
        }
      }
    }
  }

  return null;
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
  const property = properties.find(
    (property) =>
      property.label === label &&
      property.values.some((v) => deepEqual(v, value)),
  );
  if (property != null) {
    if (limitToLeafPropertyValues) {
      return { ...property, values: getLeafPropertyValues<T>(property.values) };
    } else {
      return property;
    }
  }

  if (includeNestedProperties) {
    for (const nestedProperty of properties) {
      const nestedResult = getPropertyByLabelAndValue<T>(
        nestedProperty.properties as Array<Property<T>>,
        label,
        value,
        { includeNestedProperties, limitToLeafPropertyValues },
      );
      if (nestedResult !== null) {
        if (limitToLeafPropertyValues) {
          return {
            ...nestedResult,
            values: getLeafPropertyValues<T>(nestedResult.values),
          };
        } else {
          return nestedResult;
        }
      }
    }
  }

  return null;
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
  const property = properties.find(
    (property) =>
      property.label === label &&
      property.values.some((v) => deepEqual(v.content, valueContent)),
  );
  if (property != null) {
    if (limitToLeafPropertyValues) {
      return { ...property, values: getLeafPropertyValues<T>(property.values) };
    } else {
      return property;
    }
  }

  if (includeNestedProperties) {
    for (const nestedProperty of properties) {
      const nestedResult = getPropertyByLabelAndValueContent<T>(
        nestedProperty.properties as Array<Property<T>>,
        label,
        valueContent,
        { includeNestedProperties, limitToLeafPropertyValues },
      );
      if (nestedResult !== null) {
        if (limitToLeafPropertyValues) {
          return {
            ...nestedResult,
            values: getLeafPropertyValues<T>(nestedResult.values),
          };
        } else {
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
 */
export function getPropertyValuesByLabel<
  T extends PropertyValueContentType = PropertyValueContentType,
>(
  properties: Array<Property<T>>,
  label: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Array<PropertyValueContent<T>> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } = options;
  const property = properties.find((property) => property.label === label);
  if (property != null) {
    if (limitToLeafPropertyValues) {
      return getLeafPropertyValues<T>(property.values);
    } else {
      return property.values;
    }
  }

  if (includeNestedProperties) {
    for (const nestedProperty of properties) {
      const nestedResult = getPropertyValuesByLabel<T>(
        nestedProperty.properties as Array<Property<T>>,
        label,
        { includeNestedProperties, limitToLeafPropertyValues },
      );
      if (nestedResult !== null) {
        if (limitToLeafPropertyValues) {
          return getLeafPropertyValues<T>(nestedResult);
        } else {
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
 */
export function getPropertyValueByLabel<
  T extends PropertyValueContentType = PropertyValueContentType,
>(
  properties: Array<Property<T>>,
  label: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): PropertyValueContent<T> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } = options;
  const values = getPropertyValuesByLabel<T>(properties, label, {
    includeNestedProperties,
    limitToLeafPropertyValues,
  });
  if (values !== null && values.length > 0) {
    if (limitToLeafPropertyValues) {
      return getLeafPropertyValues<T>(values)[0] ?? null;
    } else {
      return values[0]!;
    }
  }

  if (includeNestedProperties) {
    for (const nestedProperty of properties) {
      const nestedResult = getPropertyValueByLabel<T>(
        nestedProperty.properties as Array<Property<T>>,
        label,
        { includeNestedProperties, limitToLeafPropertyValues },
      );
      if (nestedResult !== null) {
        if (limitToLeafPropertyValues) {
          return getLeafPropertyValues<T>([nestedResult])[0] ?? null;
        } else {
          return nestedResult;
        }
      }
    }
  }

  return null;
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
  const values = getPropertyValuesByLabel<T>(properties, label, {
    includeNestedProperties,
    limitToLeafPropertyValues,
  });
  if (values !== null && values.length > 0) {
    if (limitToLeafPropertyValues) {
      return getLeafPropertyValues<T>(values)[0]?.content ?? null;
    } else {
      return values[0]!.content;
    }
  }

  if (includeNestedProperties) {
    for (const nestedProperty of properties) {
      const nestedResult = getPropertyValueContentByLabel<T>(
        nestedProperty.properties as Array<Property<T>>,
        label,
        { includeNestedProperties, limitToLeafPropertyValues },
      );
      if (nestedResult !== null) {
        return nestedResult;
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
 */
export function getUniqueProperties<
  T extends PropertyValueContentType = PropertyValueContentType,
>(
  properties: Array<Property<T>>,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Array<Property<T>> {
  const { includeNestedProperties, limitToLeafPropertyValues } = options;
  const uniqueProperties = new Array<Property<T>>();

  for (const property of properties) {
    if (uniqueProperties.some((p) => p.uuid === property.uuid)) {
      continue;
    }

    uniqueProperties.push(property);

    if (includeNestedProperties) {
      const nestedProperties = getUniqueProperties<T>(
        property.properties as Array<Property<T>>,
        { includeNestedProperties: true, limitToLeafPropertyValues },
      );
      for (const nestedProperty of nestedProperties) {
        if (uniqueProperties.some((p) => p.uuid === nestedProperty.uuid)) {
          continue;
        }

        uniqueProperties.push(nestedProperty);
      }
    }
  }

  if (limitToLeafPropertyValues) {
    return uniqueProperties.map((property) => ({
      ...property,
      values: getLeafPropertyValues<T>(property.values),
    }));
  } else {
    return uniqueProperties;
  }
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
  const { includeNestedProperties, limitToLeafPropertyValues } = options;
  const uniquePropertyLabels = new Array<string>();

  for (const property of properties) {
    if (uniquePropertyLabels.includes(property.label)) {
      continue;
    }

    uniquePropertyLabels.push(property.label);

    if (property.properties.length > 0 && includeNestedProperties) {
      const nestedProperties = getUniquePropertyLabels(property.properties, {
        includeNestedProperties: true,
        limitToLeafPropertyValues,
      });
      for (const nestedProperty of nestedProperties) {
        if (uniquePropertyLabels.includes(nestedProperty)) {
          continue;
        }

        uniquePropertyLabels.push(nestedProperty);
      }
    }
  }

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
