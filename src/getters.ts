import { deepEqual } from "fast-equals";
import type {
  LanguageCodes,
  Property,
  PropertyLike,
  PropertyValueContent,
  SetItemProperty,
  SetItemSimplifiedProperty,
  SimplifiedProperty,
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

type PropertyContent<T extends LanguageCodes> =
  PropertyValueContent<T>["content"];

type SearchableProperty<T extends LanguageCodes> = PropertyLike<T>;

function withDefaultOptions(
  options: PropertyOptions,
): Required<PropertyOptions> {
  return {
    includeNestedProperties: options.includeNestedProperties ?? false,
    limitToLeafPropertyValues: options.limitToLeafPropertyValues ?? true,
  };
}

function findPropertyByVariableUuid<T extends LanguageCodes>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  variableUuid: string,
): SearchableProperty<T> | null {
  for (const property of properties) {
    if (property.variable.uuid === variableUuid) {
      return property;
    }
  }

  return null;
}

function findPropertyByVariableLabel<T extends LanguageCodes>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  variableLabel: string,
): SearchableProperty<T> | null {
  for (const property of properties) {
    if (getPropertyVariableLabel(property) === variableLabel) {
      return property;
    }
  }

  return null;
}

function getPropertyVariableLabel<T extends LanguageCodes>(
  property: SearchableProperty<T>,
): string {
  return typeof property.variable.label === "string"
    ? property.variable.label
    : property.variable.label.getText();
}

function propertyHasValue<T extends LanguageCodes>(
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

function propertyHasValueContent<T extends LanguageCodes>(
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

function propertyValueContentsEqual<T extends LanguageCodes>(
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

function searchPropertyResult<T extends LanguageCodes, TResult>(
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
          transformNestedResult != null
            ? transformNestedResult(nestedResult)
            : nestedResult;
        if (transformedResult !== null) {
          return transformedResult;
        }
      }
    }
  }

  return null;
}

function getPropertyValuesResult<T extends LanguageCodes>(
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

function clonePropertyValues<T extends LanguageCodes>(
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
  T extends LanguageCodes,
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

function getFirstPropertyValueResult<T extends LanguageCodes>(
  values: ReadonlyArray<PropertyValueContent<T>>,
  limitToLeafPropertyValues: boolean,
): PropertyValueContent<T> | null {
  if (limitToLeafPropertyValues) {
    return getLeafPropertyValues(values)[0] ?? null;
  }

  return values[0] ?? null;
}

function getFirstPropertyValueContentResult<T extends LanguageCodes>(
  values: ReadonlyArray<PropertyValueContent<T>>,
  limitToLeafPropertyValues: boolean,
): PropertyContent<T> | null {
  if (limitToLeafPropertyValues) {
    return getLeafPropertyValues(values)[0]?.content ?? null;
  }

  return values[0]?.content ?? null;
}

function visitProperties<T extends LanguageCodes>(
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
 * @param variableUuid - The property variable UUID to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The matching Property object, or null if not found
 */
export function getPropertyByVariableUuid<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<Property<T>>,
  variableUuid: string,
  options?: PropertyOptions,
): Property<T> | null;
export function getPropertyByVariableUuid<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SetItemProperty<T>>,
  variableUuid: string,
  options?: PropertyOptions,
): SetItemProperty<T> | null;
export function getPropertyByVariableUuid<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SimplifiedProperty<T>>,
  variableUuid: string,
  options?: PropertyOptions,
): SimplifiedProperty<T> | null;
export function getPropertyByVariableUuid<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SetItemSimplifiedProperty<T>>,
  variableUuid: string,
  options?: PropertyOptions,
): SetItemSimplifiedProperty<T> | null;
export function getPropertyByVariableUuid<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  variableUuid: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): SearchableProperty<T> | null {
  const { includeNestedProperties } = withDefaultOptions(options);

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) =>
      findPropertyByVariableUuid(currentProperties, variableUuid),
  );
}

/**
 * Retrieves all values for a property with the given variable UUID.
 *
 * @param properties - Array of properties to search through
 * @param variableUuid - The property variable UUID to search for
 * @param options - Search options, including whether to include nested properties
 * @returns Array of property values, or null if property not found
 */
export function getPropertyValuesByVariableUuid<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  variableUuid: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Array<PropertyValueContent<T>> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } =
    withDefaultOptions(options);

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      const property = findPropertyByVariableUuid(
        currentProperties,
        variableUuid,
      );
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
 * @param variableUuid - The property variable UUID to search for
 * @param options - Search options, including whether to include nested properties
 * @returns Array of property value contents, or null if property not found
 */
export function getPropertyValueContentsByVariableUuid<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  variableUuid: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Array<PropertyContent<T>> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } =
    withDefaultOptions(options);

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      const property = findPropertyByVariableUuid(
        currentProperties,
        variableUuid,
      );
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
 * @param variableUuid - The property variable UUID to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The first property value, or null if property not found
 */
export function getPropertyValueByVariableUuid<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  variableUuid: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): PropertyValueContent<T> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } =
    withDefaultOptions(options);

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      const values = getPropertyValuesByVariableUuid<T>(
        currentProperties,
        variableUuid,
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
 * @param variableUuid - The property variable UUID to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The first property value content, or null if property not found
 */
export function getPropertyValueContentByVariableUuid<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  variableUuid: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): PropertyContent<T> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } =
    withDefaultOptions(options);

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      const values = getPropertyValuesByVariableUuid<T>(
        currentProperties,
        variableUuid,
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
 * Finds a property by its variable label in an array of properties.
 *
 * @param properties - Array of properties to search through
 * @param variableLabel - The property variable label to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The matching Property object, or null if not found
 */
export function getPropertyByVariableLabel<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<Property<T>>,
  variableLabel: string,
  options?: PropertyOptions,
): Property<T> | null;
export function getPropertyByVariableLabel<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SetItemProperty<T>>,
  variableLabel: string,
  options?: PropertyOptions,
): SetItemProperty<T> | null;
export function getPropertyByVariableLabel<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SimplifiedProperty<T>>,
  variableLabel: string,
  options?: PropertyOptions,
): SimplifiedProperty<T> | null;
export function getPropertyByVariableLabel<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SetItemSimplifiedProperty<T>>,
  variableLabel: string,
  options?: PropertyOptions,
): SetItemSimplifiedProperty<T> | null;
export function getPropertyByVariableLabel<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  variableLabel: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): SearchableProperty<T> | null {
  const { includeNestedProperties } = withDefaultOptions(options);

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) =>
      findPropertyByVariableLabel(currentProperties, variableLabel),
  );
}

/**
 * Finds a property by its variable label and all values.
 *
 * @param properties - Array of properties to search through
 * @param variableLabel - The property variable label to search for
 * @param values - The property values to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The matching Property object, or null if not found or all values do not match
 */
export function getPropertyByVariableLabelAndValues<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<Property<T>>,
  variableLabel: string,
  values: ReadonlyArray<PropertyValueContent<T>>,
  options?: PropertyOptions,
): Property<T> | null;
export function getPropertyByVariableLabelAndValues<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SetItemProperty<T>>,
  variableLabel: string,
  values: ReadonlyArray<PropertyValueContent<T>>,
  options?: PropertyOptions,
): SetItemProperty<T> | null;
export function getPropertyByVariableLabelAndValues<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SimplifiedProperty<T>>,
  variableLabel: string,
  values: ReadonlyArray<PropertyValueContent<T>>,
  options?: PropertyOptions,
): SimplifiedProperty<T> | null;
export function getPropertyByVariableLabelAndValues<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SetItemSimplifiedProperty<T>>,
  variableLabel: string,
  values: ReadonlyArray<PropertyValueContent<T>>,
  options?: PropertyOptions,
): SetItemSimplifiedProperty<T> | null;
export function getPropertyByVariableLabelAndValues<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  variableLabel: string,
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
          getPropertyVariableLabel(property) === variableLabel &&
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
 * Finds a property by its variable label and all value contents.
 *
 * @param properties - Array of properties to search through
 * @param variableLabel - The property variable label to search for
 * @param valueContents - The value contents to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The matching Property object, or null if not found or all value contents do not match
 */
export function getPropertyByVariableLabelAndValueContents<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<Property<T>>,
  variableLabel: string,
  valueContents: ReadonlyArray<PropertyContent<T>>,
  options?: PropertyOptions,
): Property<T> | null;
export function getPropertyByVariableLabelAndValueContents<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SetItemProperty<T>>,
  variableLabel: string,
  valueContents: ReadonlyArray<PropertyContent<T>>,
  options?: PropertyOptions,
): SetItemProperty<T> | null;
export function getPropertyByVariableLabelAndValueContents<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SimplifiedProperty<T>>,
  variableLabel: string,
  valueContents: ReadonlyArray<PropertyContent<T>>,
  options?: PropertyOptions,
): SimplifiedProperty<T> | null;
export function getPropertyByVariableLabelAndValueContents<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SetItemSimplifiedProperty<T>>,
  variableLabel: string,
  valueContents: ReadonlyArray<PropertyContent<T>>,
  options?: PropertyOptions,
): SetItemSimplifiedProperty<T> | null;
export function getPropertyByVariableLabelAndValueContents<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  variableLabel: string,
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
          getPropertyVariableLabel(property) === variableLabel &&
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
 * Finds a property by its variable label and one value.
 *
 * @param properties - Array of properties to search through
 * @param variableLabel - The property variable label to search for
 * @param value - The property value to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The matching Property object, or null if not found or value does not match
 */
export function getPropertyByVariableLabelAndValue<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<Property<T>>,
  variableLabel: string,
  value: PropertyValueContent<T>,
  options?: PropertyOptions,
): Property<T> | null;
export function getPropertyByVariableLabelAndValue<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SetItemProperty<T>>,
  variableLabel: string,
  value: PropertyValueContent<T>,
  options?: PropertyOptions,
): SetItemProperty<T> | null;
export function getPropertyByVariableLabelAndValue<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SimplifiedProperty<T>>,
  variableLabel: string,
  value: PropertyValueContent<T>,
  options?: PropertyOptions,
): SimplifiedProperty<T> | null;
export function getPropertyByVariableLabelAndValue<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SetItemSimplifiedProperty<T>>,
  variableLabel: string,
  value: PropertyValueContent<T>,
  options?: PropertyOptions,
): SetItemSimplifiedProperty<T> | null;
export function getPropertyByVariableLabelAndValue<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  variableLabel: string,
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
          getPropertyVariableLabel(property) === variableLabel &&
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
 * Finds a property by its variable label and one value content.
 *
 * @param properties - Array of properties to search through
 * @param variableLabel - The property variable label to search for
 * @param valueContent - The value content to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The matching Property object, or null if not found or value content does not match
 */
export function getPropertyByVariableLabelAndValueContent<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<Property<T>>,
  variableLabel: string,
  valueContent: PropertyContent<T>,
  options?: PropertyOptions,
): Property<T> | null;
export function getPropertyByVariableLabelAndValueContent<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SetItemProperty<T>>,
  variableLabel: string,
  valueContent: PropertyContent<T>,
  options?: PropertyOptions,
): SetItemProperty<T> | null;
export function getPropertyByVariableLabelAndValueContent<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SimplifiedProperty<T>>,
  variableLabel: string,
  valueContent: PropertyContent<T>,
  options?: PropertyOptions,
): SimplifiedProperty<T> | null;
export function getPropertyByVariableLabelAndValueContent<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SetItemSimplifiedProperty<T>>,
  variableLabel: string,
  valueContent: PropertyContent<T>,
  options?: PropertyOptions,
): SetItemSimplifiedProperty<T> | null;
export function getPropertyByVariableLabelAndValueContent<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  variableLabel: string,
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
          getPropertyVariableLabel(property) === variableLabel &&
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
 * Retrieves all values for a property with the given variable label.
 *
 * @param properties - Array of properties to search through
 * @param variableLabel - The property variable label to search for
 * @param options - Search options, including whether to include nested properties
 * @returns Array of property values, or null if property not found
 */
export function getPropertyValuesByVariableLabel<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  variableLabel: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Array<PropertyValueContent<T>> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } =
    withDefaultOptions(options);

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      const property = findPropertyByVariableLabel(
        currentProperties,
        variableLabel,
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
 * Gets the first value of a property with the given variable label.
 *
 * @param properties - Array of properties to search through
 * @param variableLabel - The property variable label to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The first property value, or null if property not found
 */
export function getPropertyValueByVariableLabel<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  variableLabel: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): PropertyValueContent<T> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } =
    withDefaultOptions(options);

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      const values = getPropertyValuesByVariableLabel<T>(
        currentProperties,
        variableLabel,
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
 * Gets the first value content of a property with the given variable label.
 *
 * @param properties - Array of properties to search through
 * @param variableLabel - The property variable label to search for
 * @param options - Search options, including whether to include nested properties
 * @returns The first property value content, or null if property not found
 */
export function getPropertyValueContentByVariableLabel<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  variableLabel: string,
  options: PropertyOptions = DEFAULT_OPTIONS,
): PropertyContent<T> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } =
    withDefaultOptions(options);

  return searchPropertyResult(
    properties,
    { includeNestedProperties },
    (currentProperties) => {
      const values = getPropertyValuesByVariableLabel<T>(
        currentProperties,
        variableLabel,
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
export function getUniqueProperties<T extends LanguageCodes = LanguageCodes>(
  properties: ReadonlyArray<Property<T>>,
  options?: PropertyOptions,
): Array<Property<T>>;
export function getUniqueProperties<T extends LanguageCodes = LanguageCodes>(
  properties: ReadonlyArray<SetItemProperty<T>>,
  options?: PropertyOptions,
): Array<SetItemProperty<T>>;
export function getUniqueProperties<T extends LanguageCodes = LanguageCodes>(
  properties: ReadonlyArray<SimplifiedProperty<T>>,
  options?: PropertyOptions,
): Array<SimplifiedProperty<T>>;
export function getUniqueProperties<T extends LanguageCodes = LanguageCodes>(
  properties: ReadonlyArray<SetItemSimplifiedProperty<T>>,
  options?: PropertyOptions,
): Array<SetItemSimplifiedProperty<T>>;
export function getUniqueProperties<T extends LanguageCodes = LanguageCodes>(
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
 * Gets all unique property variable labels from an array of properties.
 *
 * @param properties - Array of properties to get unique property variable labels from
 * @param options - Search options, including whether to include nested properties
 * @returns Array of unique property variable labels
 */
export function getUniquePropertyVariableLabels<
  T extends LanguageCodes = LanguageCodes,
>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Array<string> {
  const { includeNestedProperties } = withDefaultOptions(options);
  const uniquePropertyVariableLabels: Array<string> = [];

  visitProperties(properties, includeNestedProperties, (property) => {
    const variableLabel = getPropertyVariableLabel(property);
    if (uniquePropertyVariableLabels.includes(variableLabel)) {
      return;
    }

    uniquePropertyVariableLabels.push(variableLabel);
  });

  return uniquePropertyVariableLabels;
}

/**
 * Get the leaf property values from an array of property values.
 *
 * @param propertyValues - The array of property values to get the leaf property values from
 * @returns The array of leaf property values
 */
export function getLeafPropertyValues<T extends LanguageCodes = LanguageCodes>(
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

function contentMatchesFilter<T extends LanguageCodes>(
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
 * Filters a property based on a variable label and value content criterion.
 *
 * @param property - The property to filter
 * @param filter - Filter criteria containing variable label and value to match
 * @param filter.variableLabel - The variable label to filter by
 * @param filter.value - The value to filter by
 * @param options - Search options, including whether to include nested properties
 * @returns True if the property matches the filter criteria, false otherwise
 */
export function filterProperties<T extends LanguageCodes = LanguageCodes>(
  property: SearchableProperty<T>,
  filter: { variableLabel: string; value: PropertyValueContent<T> },
  options: PropertyOptions = DEFAULT_OPTIONS,
): boolean {
  const { includeNestedProperties, limitToLeafPropertyValues } =
    withDefaultOptions(options);

  const isAllFields =
    filter.variableLabel.toLocaleLowerCase("en-US") === "all fields";

  if (
    isAllFields ||
    getPropertyVariableLabel(property).toLocaleLowerCase("en-US") ===
      filter.variableLabel.toLocaleLowerCase("en-US")
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
