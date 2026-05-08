import { deepEqual } from "fast-equals";
import type {
  Property,
  PropertyValueContent,
  SimplifiedProperty,
  SingleHierarchyProperty,
  SingleHierarchySimplifiedProperty,
} from "#/types/index.js";

/**
 * Options for property search operations.
 */
export type PropertyOptions = {
  /** Whether to recursively search through nested properties. */
  includeNestedProperties?: boolean;
  /** Whether to limit property values to leaf values. */
  limitToLeafPropertyValues?: boolean;
};

const DEFAULT_OPTIONS: PropertyOptions = {
  includeNestedProperties: false,
  limitToLeafPropertyValues: true,
};

type PropertyContent<T extends ReadonlyArray<string>> =
  PropertyValueContent<T>["content"];

type SearchableProperty<T extends ReadonlyArray<string>> =
  | Property<T>
  | SingleHierarchyProperty<T>
  | SimplifiedProperty<T>
  | SingleHierarchySimplifiedProperty<T>;

function withDefaultOptions(
  options: PropertyOptions,
): Required<PropertyOptions> {
  return {
    includeNestedProperties: options.includeNestedProperties ?? false,
    limitToLeafPropertyValues: options.limitToLeafPropertyValues ?? true,
  };
}

function findPropertyByVariableUuid<T extends ReadonlyArray<string>>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  labelUuid: string,
): SearchableProperty<T> | null {
  for (const property of properties) {
    if (property.variable.uuid === labelUuid) {
      return property;
    }
  }

  return null;
}

function findPropertyByVariableLabelName<T extends ReadonlyArray<string>>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  labelName: string,
): SearchableProperty<T> | null {
  for (const property of properties) {
    if (getPropertyVariableLabelName(property) === labelName) {
      return property;
    }
  }

  return null;
}

function getPropertyVariableLabelName<T extends ReadonlyArray<string>>(
  property: SearchableProperty<T>,
): string {
  return typeof property.variable.label === "string" ?
      property.variable.label
    : property.variable.label.getText();
}

function propertyHasValue<T extends ReadonlyArray<string>>(
  property: SearchableProperty<T>,
  value: PropertyValueContent<T>,
): boolean {
  for (const candidateValue of property.values) {
    if (deepEqual(candidateValue, value)) {
      return true;
    }
  }

  return false;
}

function propertyHasValueContent<T extends ReadonlyArray<string>>(
  property: SearchableProperty<T>,
  valueContent: PropertyContent<T>,
): boolean {
  for (const value of property.values) {
    if (deepEqual(value.content, valueContent)) {
      return true;
    }
  }

  return false;
}

function propertyValueContentsEqual<T extends ReadonlyArray<string>>(
  property: SearchableProperty<T>,
  valueContents: ReadonlyArray<PropertyContent<T>>,
): boolean {
  if (property.values.length !== valueContents.length) {
    return false;
  }

  for (const [index, value] of property.values.entries()) {
    if (!deepEqual(value.content, valueContents[index])) {
      return false;
    }
  }

  return true;
}

function searchPropertyResult<T extends ReadonlyArray<string>, TResult>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  options: Pick<PropertyOptions, "includeNestedProperties">,
  findDirectResult: (
    properties: ReadonlyArray<SearchableProperty<T>>,
  ) => TResult | null,
  transformNestedResult?: (result: TResult) => TResult | null,
): TResult | null {
  const directResult = findDirectResult(properties);
  if (directResult !== null) {
    return directResult;
  }

  if (options.includeNestedProperties) {
    for (const property of properties) {
      if (!("properties" in property)) {
        continue;
      }

      const nestedResult = searchPropertyResult(
        property.properties,
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

function getPropertyValuesResult<T extends ReadonlyArray<string>>(
  values: ReadonlyArray<PropertyValueContent<T>>,
  limitToLeafPropertyValues: boolean,
  copyValuesWhenUnfiltered: boolean,
): Array<PropertyValueContent<T>> {
  if (limitToLeafPropertyValues) {
    return getLeafPropertyValues(values);
  }

  if (copyValuesWhenUnfiltered) {
    return clonePropertyValues(values);
  }

  return [...values];
}

function clonePropertyValues<T extends ReadonlyArray<string>>(
  values: ReadonlyArray<PropertyValueContent<T>>,
): Array<PropertyValueContent<T>> {
  const clonedValues: Array<PropertyValueContent<T>> = [];
  for (const value of values) {
    switch (value.dataType) {
      case "IDREF":
      case "coordinate":
      case "date":
      case "dateTime":
      case "string": {
        clonedValues.push({ ...value, content: value.content });
        break;
      }
      case "decimal":
      case "integer":
      case "time": {
        clonedValues.push({ ...value, content: value.content });
        break;
      }
      case "boolean": {
        clonedValues.push({ ...value, content: value.content });
        break;
      }
    }
  }

  return clonedValues;
}

function getNormalizedProperty<
  T extends ReadonlyArray<string>,
  TProperty extends SearchableProperty<T>,
>(
  property: TProperty,
  limitToLeafPropertyValues: boolean,
  transformValues?: (
    values: Array<PropertyValueContent<T>>,
  ) => Array<PropertyValueContent<T>>,
): TProperty {
  if (!limitToLeafPropertyValues) {
    return property;
  }

  const values = getLeafPropertyValues(property.values);

  return {
    ...property,
    values: transformValues != null ? transformValues(values) : values,
  } as TProperty;
}

function getFirstPropertyValueResult<T extends ReadonlyArray<string>>(
  values: ReadonlyArray<PropertyValueContent<T>>,
  limitToLeafPropertyValues: boolean,
): PropertyValueContent<T> | null {
  if (limitToLeafPropertyValues) {
    return getLeafPropertyValues(values)[0] ?? null;
  }

  return values[0] ?? null;
}

function getFirstPropertyValueContentResult<T extends ReadonlyArray<string>>(
  values: ReadonlyArray<PropertyValueContent<T>>,
  limitToLeafPropertyValues: boolean,
): PropertyContent<T> | null {
  if (limitToLeafPropertyValues) {
    return getLeafPropertyValues(values)[0]?.content ?? null;
  }

  return values[0]?.content ?? null;
}

function visitProperties<T extends ReadonlyArray<string>>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  includeNestedProperties: boolean,
  visit: (property: SearchableProperty<T>) => void,
): void {
  for (const property of properties) {
    visit(property);

    if (includeNestedProperties && "properties" in property) {
      visitProperties(property.properties, includeNestedProperties, visit);
    }
  }
}

/**
 * Finds a property by its variable UUID in an array of properties.
 *
 * @param properties - Array of properties to search through
 * @param labelUuid - The property variable UUID to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The matching Property object, or null if not found
 */
export function getPropertyByLabelUuid<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<Property<T>>,
  labelUuid: string,
  options?: PropertyOptions,
): Property<T> | null;
export function getPropertyByLabelUuid<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SingleHierarchyProperty<T>>,
  labelUuid: string,
  options?: PropertyOptions,
): SingleHierarchyProperty<T> | null;
export function getPropertyByLabelUuid<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SimplifiedProperty<T>>,
  labelUuid: string,
  options?: PropertyOptions,
): SimplifiedProperty<T> | null;
export function getPropertyByLabelUuid<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SingleHierarchySimplifiedProperty<T>>,
  labelUuid: string,
  options?: PropertyOptions,
): SingleHierarchySimplifiedProperty<T> | null;
export function getPropertyByLabelUuid<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  labelUuid: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): SearchableProperty<T> | null {
  const { includeNestedProperties } = withDefaultOptions(options);

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) =>
      findPropertyByVariableUuid(currentProperties, labelUuid),
  );
}

/**
 * Retrieves all values for a property with the given variable UUID.
 *
 * @param properties - Array of properties to search through
 * @param labelUuid - The property variable UUID to search for
 * @param options - Search options, including whether to include nested properties
 * @returns Array of property values, or null if property not found
 */
export function getPropertyValuesByLabelUuid<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  labelUuid: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Array<PropertyValueContent<T>> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } =
    withDefaultOptions(options);

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      const property = findPropertyByVariableUuid(currentProperties, labelUuid);
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
 * Retrieves all value contents for a property with the given variable UUID.
 *
 * @param properties - Array of properties to search through
 * @param labelUuid - The property variable UUID to search for
 * @param options - Search options, including whether to include nested properties
 * @returns Array of property value contents, or null if property not found
 */
export function getPropertyValueContentsByLabelUuid<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  labelUuid: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Array<PropertyContent<T>> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } =
    withDefaultOptions(options);

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      const property = findPropertyByVariableUuid(currentProperties, labelUuid);
      if (property == null) {
        return null;
      }

      const valueContents: Array<PropertyContent<T>> = [];
      for (const value of getPropertyValuesResult(
        property.values,
        limitToLeafPropertyValues,
        false,
      )) {
        valueContents.push(value.content);
      }

      return valueContents;
    },
  );
}

/**
 * Gets the first value of a property with the given variable UUID.
 *
 * @param properties - Array of properties to search through
 * @param labelUuid - The property variable UUID to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The first property value, or null if property not found
 */
export function getPropertyValueByLabelUuid<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  labelUuid: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): PropertyValueContent<T> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } =
    withDefaultOptions(options);

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      const values = getPropertyValuesByLabelUuid<T>(
        currentProperties,
        labelUuid,
        { includeNestedProperties: false, limitToLeafPropertyValues },
      );
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
 * Gets the first value content of a property with the given variable UUID.
 *
 * @param properties - Array of properties to search through
 * @param labelUuid - The property variable UUID to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The first property value content, or null if property not found
 */
export function getPropertyValueContentByLabelUuid<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  labelUuid: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): PropertyContent<T> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } =
    withDefaultOptions(options);

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      const values = getPropertyValuesByLabelUuid<T>(
        currentProperties,
        labelUuid,
        { includeNestedProperties: false, limitToLeafPropertyValues },
      );
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
 * Finds a property by its variable label name in an array of properties.
 *
 * @param properties - Array of properties to search through
 * @param labelName - The property variable label name to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The matching Property object, or null if not found
 */
export function getPropertyByLabelName<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<Property<T>>,
  labelName: string,
  options?: PropertyOptions,
): Property<T> | null;
export function getPropertyByLabelName<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SingleHierarchyProperty<T>>,
  labelName: string,
  options?: PropertyOptions,
): SingleHierarchyProperty<T> | null;
export function getPropertyByLabelName<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SimplifiedProperty<T>>,
  labelName: string,
  options?: PropertyOptions,
): SimplifiedProperty<T> | null;
export function getPropertyByLabelName<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SingleHierarchySimplifiedProperty<T>>,
  labelName: string,
  options?: PropertyOptions,
): SingleHierarchySimplifiedProperty<T> | null;
export function getPropertyByLabelName<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  labelName: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): SearchableProperty<T> | null {
  const { includeNestedProperties } = withDefaultOptions(options);

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) =>
      findPropertyByVariableLabelName(currentProperties, labelName),
  );
}

/**
 * Finds a property by its variable label name and all values.
 *
 * @param properties - Array of properties to search through
 * @param labelName - The property variable label name to search for
 * @param values - The property values to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The matching Property object, or null if not found or all values do not match
 */
export function getPropertyByLabelNameAndValues<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<Property<T>>,
  labelName: string,
  values: ReadonlyArray<PropertyValueContent<T>>,
  options?: PropertyOptions,
): Property<T> | null;
export function getPropertyByLabelNameAndValues<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SingleHierarchyProperty<T>>,
  labelName: string,
  values: ReadonlyArray<PropertyValueContent<T>>,
  options?: PropertyOptions,
): SingleHierarchyProperty<T> | null;
export function getPropertyByLabelNameAndValues<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SimplifiedProperty<T>>,
  labelName: string,
  values: ReadonlyArray<PropertyValueContent<T>>,
  options?: PropertyOptions,
): SimplifiedProperty<T> | null;
export function getPropertyByLabelNameAndValues<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SingleHierarchySimplifiedProperty<T>>,
  labelName: string,
  values: ReadonlyArray<PropertyValueContent<T>>,
  options?: PropertyOptions,
): SingleHierarchySimplifiedProperty<T> | null;
export function getPropertyByLabelNameAndValues<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  labelName: string,
  values: ReadonlyArray<PropertyValueContent<T>>,
  options: PropertyOptions = DEFAULT_OPTIONS,
): SearchableProperty<T> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } =
    withDefaultOptions(options);

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      for (const property of currentProperties) {
        if (
          getPropertyVariableLabelName(property) === labelName &&
          deepEqual(property.values, values)
        ) {
          return getNormalizedProperty(property, limitToLeafPropertyValues);
        }
      }

      return null;
    },
    (nestedResult) =>
      getNormalizedProperty(nestedResult, limitToLeafPropertyValues),
  );
}

/**
 * Finds a property by its variable label name and all value contents.
 *
 * @param properties - Array of properties to search through
 * @param labelName - The property variable label name to search for
 * @param valueContents - The value contents to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The matching Property object, or null if not found or all value contents do not match
 */
export function getPropertyByLabelNameAndValueContents<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<Property<T>>,
  labelName: string,
  valueContents: ReadonlyArray<PropertyContent<T>>,
  options?: PropertyOptions,
): Property<T> | null;
export function getPropertyByLabelNameAndValueContents<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SingleHierarchyProperty<T>>,
  labelName: string,
  valueContents: ReadonlyArray<PropertyContent<T>>,
  options?: PropertyOptions,
): SingleHierarchyProperty<T> | null;
export function getPropertyByLabelNameAndValueContents<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SimplifiedProperty<T>>,
  labelName: string,
  valueContents: ReadonlyArray<PropertyContent<T>>,
  options?: PropertyOptions,
): SimplifiedProperty<T> | null;
export function getPropertyByLabelNameAndValueContents<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SingleHierarchySimplifiedProperty<T>>,
  labelName: string,
  valueContents: ReadonlyArray<PropertyContent<T>>,
  options?: PropertyOptions,
): SingleHierarchySimplifiedProperty<T> | null;
export function getPropertyByLabelNameAndValueContents<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  labelName: string,
  valueContents: ReadonlyArray<PropertyContent<T>>,
  options: PropertyOptions = DEFAULT_OPTIONS,
): SearchableProperty<T> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } =
    withDefaultOptions(options);

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      for (const property of currentProperties) {
        if (
          getPropertyVariableLabelName(property) === labelName &&
          propertyValueContentsEqual(property, valueContents)
        ) {
          return getNormalizedProperty(
            property,
            limitToLeafPropertyValues,
            clonePropertyValues,
          );
        }
      }

      return null;
    },
    (nestedResult) =>
      getNormalizedProperty(nestedResult, limitToLeafPropertyValues),
  );
}

/**
 * Finds a property by its variable label name and one value.
 *
 * @param properties - Array of properties to search through
 * @param labelName - The property variable label name to search for
 * @param value - The property value to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The matching Property object, or null if not found or value does not match
 */
export function getPropertyByLabelNameAndValue<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<Property<T>>,
  labelName: string,
  value: PropertyValueContent<T>,
  options?: PropertyOptions,
): Property<T> | null;
export function getPropertyByLabelNameAndValue<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SingleHierarchyProperty<T>>,
  labelName: string,
  value: PropertyValueContent<T>,
  options?: PropertyOptions,
): SingleHierarchyProperty<T> | null;
export function getPropertyByLabelNameAndValue<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SimplifiedProperty<T>>,
  labelName: string,
  value: PropertyValueContent<T>,
  options?: PropertyOptions,
): SimplifiedProperty<T> | null;
export function getPropertyByLabelNameAndValue<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SingleHierarchySimplifiedProperty<T>>,
  labelName: string,
  value: PropertyValueContent<T>,
  options?: PropertyOptions,
): SingleHierarchySimplifiedProperty<T> | null;
export function getPropertyByLabelNameAndValue<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  labelName: string,
  value: PropertyValueContent<T>,
  options: PropertyOptions = DEFAULT_OPTIONS,
): SearchableProperty<T> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } =
    withDefaultOptions(options);

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      for (const property of currentProperties) {
        if (
          getPropertyVariableLabelName(property) === labelName &&
          propertyHasValue(property, value)
        ) {
          return getNormalizedProperty(property, limitToLeafPropertyValues);
        }
      }

      return null;
    },
    (nestedResult) =>
      getNormalizedProperty(nestedResult, limitToLeafPropertyValues),
  );
}

/**
 * Finds a property by its variable label name and one value content.
 *
 * @param properties - Array of properties to search through
 * @param labelName - The property variable label name to search for
 * @param valueContent - The value content to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The matching Property object, or null if not found or value content does not match
 */
export function getPropertyByLabelNameAndValueContent<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<Property<T>>,
  labelName: string,
  valueContent: PropertyContent<T>,
  options?: PropertyOptions,
): Property<T> | null;
export function getPropertyByLabelNameAndValueContent<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SingleHierarchyProperty<T>>,
  labelName: string,
  valueContent: PropertyContent<T>,
  options?: PropertyOptions,
): SingleHierarchyProperty<T> | null;
export function getPropertyByLabelNameAndValueContent<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SimplifiedProperty<T>>,
  labelName: string,
  valueContent: PropertyContent<T>,
  options?: PropertyOptions,
): SimplifiedProperty<T> | null;
export function getPropertyByLabelNameAndValueContent<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SingleHierarchySimplifiedProperty<T>>,
  labelName: string,
  valueContent: PropertyContent<T>,
  options?: PropertyOptions,
): SingleHierarchySimplifiedProperty<T> | null;
export function getPropertyByLabelNameAndValueContent<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  labelName: string,
  valueContent: PropertyContent<T>,
  options: PropertyOptions = DEFAULT_OPTIONS,
): SearchableProperty<T> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } =
    withDefaultOptions(options);

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      for (const property of currentProperties) {
        if (
          getPropertyVariableLabelName(property) === labelName &&
          propertyHasValueContent(property, valueContent)
        ) {
          return getNormalizedProperty(property, limitToLeafPropertyValues);
        }
      }

      return null;
    },
    (nestedResult) =>
      getNormalizedProperty(nestedResult, limitToLeafPropertyValues),
  );
}

/**
 * Retrieves all values for a property with the given variable label name.
 *
 * @param properties - Array of properties to search through
 * @param labelName - The property variable label name to search for
 * @param options - Search options, including whether to include nested properties
 * @returns Array of property values, or null if property not found
 */
export function getPropertyValuesByLabelName<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  labelName: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Array<PropertyValueContent<T>> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } =
    withDefaultOptions(options);

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      const property = findPropertyByVariableLabelName(
        currentProperties,
        labelName,
      );
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
 * Gets the first value of a property with the given variable label name.
 *
 * @param properties - Array of properties to search through
 * @param labelName - The property variable label name to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The first property value, or null if property not found
 */
export function getPropertyValueByLabelName<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  labelName: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): PropertyValueContent<T> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } =
    withDefaultOptions(options);

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      const values = getPropertyValuesByLabelName<T>(
        currentProperties,
        labelName,
        { includeNestedProperties: false, limitToLeafPropertyValues },
      );
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
 * Gets the first value content of a property with the given variable label name.
 *
 * @param properties - Array of properties to search through
 * @param labelName - The property variable label name to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The first property value content, or null if property not found
 */
export function getPropertyValueContentByLabelName<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  labelName: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): PropertyContent<T> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } =
    withDefaultOptions(options);

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      const values = getPropertyValuesByLabelName<T>(
        currentProperties,
        labelName,
        { includeNestedProperties: false, limitToLeafPropertyValues },
      );
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
 * Gets all unique properties from an array of properties.
 *
 * @param properties - Array of properties to get unique properties from
 * @param options - Search options, including whether to include nested properties
 * @returns Array of unique properties
 */
export function getUniqueProperties<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<Property<T>>,
  options?: PropertyOptions,
): Array<Property<T>>;
export function getUniqueProperties<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SingleHierarchyProperty<T>>,
  options?: PropertyOptions,
): Array<SingleHierarchyProperty<T>>;
export function getUniqueProperties<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SimplifiedProperty<T>>,
  options?: PropertyOptions,
): Array<SimplifiedProperty<T>>;
export function getUniqueProperties<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SingleHierarchySimplifiedProperty<T>>,
  options?: PropertyOptions,
): Array<SingleHierarchySimplifiedProperty<T>>;
export function getUniqueProperties<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Array<SearchableProperty<T>> {
  const { includeNestedProperties, limitToLeafPropertyValues } =
    withDefaultOptions(options);
  const uniqueProperties: Array<SearchableProperty<T>> = [];

  visitProperties(properties, includeNestedProperties, (property) => {
    for (const uniqueProperty of uniqueProperties) {
      if (uniqueProperty.variable.uuid === property.variable.uuid) {
        return;
      }
    }

    uniqueProperties.push(property);
  });

  if (limitToLeafPropertyValues) {
    const normalizedProperties: Array<SearchableProperty<T>> = [];
    for (const property of uniqueProperties) {
      normalizedProperties.push(
        getNormalizedProperty(property, limitToLeafPropertyValues),
      );
    }

    return normalizedProperties;
  }

  return uniqueProperties;
}

/**
 * Gets all unique property variable label names from an array of properties.
 *
 * @param properties - Array of properties to get unique property variable labels from
 * @param options - Search options, including whether to include nested properties
 * @returns Array of unique property variable label names
 */
export function getUniquePropertyLabelNames<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Array<string> {
  const { includeNestedProperties } = withDefaultOptions(options);
  const uniquePropertyLabels: Array<string> = [];

  visitProperties(properties, includeNestedProperties, (property) => {
    const labelName = getPropertyVariableLabelName(property);
    if (uniquePropertyLabels.includes(labelName)) {
      return;
    }

    uniquePropertyLabels.push(labelName);
  });

  return uniquePropertyLabels;
}

/**
 * Get the leaf property values from an array of property values.
 *
 * @param propertyValues - The array of property values to get the leaf property values from
 * @returns The array of leaf property values
 */
export function getLeafPropertyValues<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  propertyValues: ReadonlyArray<PropertyValueContent<T>>,
): Array<PropertyValueContent<T>> {
  const leafPropertyValues: Array<PropertyValueContent<T>> = [];
  for (const value of propertyValues) {
    if (value.hierarchy.isLeaf) {
      leafPropertyValues.push(value);
    }
  }

  return leafPropertyValues;
}

function contentMatchesFilter<T extends ReadonlyArray<string>>(
  content: PropertyContent<T>,
  filterContent: PropertyContent<T>,
): boolean {
  if (typeof content === "string") {
    return (
      typeof filterContent === "string" &&
      content
        .toLocaleLowerCase("en-US")
        .includes(filterContent.toLocaleLowerCase("en-US"))
    );
  }

  if (typeof content === "number") {
    return typeof filterContent === "number" && content === filterContent;
  }

  return typeof filterContent === "boolean" && content === filterContent;
}

/**
 * Filters a property based on a variable label and value criterion.
 *
 * @param property - The property to filter
 * @param filter - Filter criteria containing variable label and value to match
 * @param filter.labelName - The variable label name to filter by
 * @param filter.value - The value to filter by
 * @param options - Search options, including whether to include nested properties
 * @returns True if the property matches the filter criteria, false otherwise
 */
export function filterProperties<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  property: SearchableProperty<T>,
  filter: { labelName: string; value: PropertyValueContent<T> },
  options: PropertyOptions = DEFAULT_OPTIONS,
): boolean {
  const { includeNestedProperties, limitToLeafPropertyValues } =
    withDefaultOptions(options);

  const isAllFields =
    filter.labelName.toLocaleLowerCase("en-US") === "all fields";

  if (
    isAllFields ||
    getPropertyVariableLabelName(property).toLocaleLowerCase("en-US") ===
      filter.labelName.toLocaleLowerCase("en-US")
  ) {
    const values = getPropertyValuesResult(
      property.values,
      limitToLeafPropertyValues,
      false,
    );
    for (const value of values) {
      if (contentMatchesFilter(value.content, filter.value.content)) {
        return true;
      }
    }
  }

  if (includeNestedProperties && "properties" in property) {
    for (const nestedProperty of property.properties) {
      if (
        filterProperties(nestedProperty, filter, {
          includeNestedProperties: true,
          limitToLeafPropertyValues,
        })
      ) {
        return true;
      }
    }
  }

  return false;
}
