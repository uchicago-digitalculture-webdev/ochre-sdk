import { deepEqual } from "fast-equals";
import type {
  LanguageCodes,
  PropertyLike,
  PropertyValueContent,
} from "#/types/index.js";

/**
 * Options for property search operations.
 */
export type PropertyOptions = {
  /**
  Whether to recursively search through nested properties.
  */
  includeNestedProperties?: boolean;
  /**
  Whether to limit property values to leaf values. Applies to the value
  lookups; {@link getProperty} and {@link getUniqueProperties} always return a
  property exactly as it was found.
  */
  limitToLeafPropertyValues?: boolean;
};

type PropertyContent<T extends LanguageCodes> =
  PropertyValueContent<T>["content"];

type SearchableProperty<T extends LanguageCodes> = PropertyLike<T>;

/**
 * Which property to look for
 *
 * A property is named either by its variable UUID or by its variable label, and
 * a label can be narrowed further by the values the property carries. The value
 * forms differ in what they compare: `values` and `valueContents` require the
 * property to carry exactly that sequence, while `value` and `valueContent`
 * only require it to carry that one among others.
 */
export type PropertySelector<T extends LanguageCodes = LanguageCodes> =
  | { uuid: string }
  | { label: string }
  | { label: string; values: ReadonlyArray<PropertyValueContent<T>> }
  | { label: string; valueContents: ReadonlyArray<PropertyContent<T>> }
  | { label: string; value: PropertyValueContent<T> }
  | { label: string; valueContent: PropertyContent<T> };

/**
 * The variable label that asks a filter to match against every property
 */
const ALL_FIELDS_VARIABLE_LABEL = "all-fields";

const DEFAULT_OPTIONS: PropertyOptions = {
  includeNestedProperties: false,
  limitToLeafPropertyValues: true,
};

/**
 * Normalize an OCHRE property variable label for comparison
 *
 * OCHRE varies the casing and the word separator of a property label, so every
 * comparison against a label goes through here. This is the only rule in the
 * SDK for deciding whether a label names a given property.
 * @param value - The label to normalize
 * @returns The normalized label
 */
export function normalizePropertyVariableLabel(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replaceAll(/[\s_]+/g, "-");
}

function withDefaultOptions(
  options: PropertyOptions,
): Required<PropertyOptions> {
  return {
    includeNestedProperties: options.includeNestedProperties ?? false,
    limitToLeafPropertyValues: options.limitToLeafPropertyValues ?? true,
  };
}

function getPropertyVariableLabel<T extends LanguageCodes>(
  property: SearchableProperty<T>,
): string {
  return typeof property.variable.label === "string"
    ? property.variable.label
    : property.variable.label.getText();
}

function hasPropertyValue<T extends LanguageCodes>(
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

function hasPropertyValueContent<T extends LanguageCodes>(
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

function hasEqualPropertyValueContents<T extends LanguageCodes>(
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

/**
 * Compile a selector into a predicate over one property
 *
 * The label is normalized once here rather than once per candidate property.
 */
function createPropertyPredicate<T extends LanguageCodes>(
  selector: PropertySelector<T>,
): (property: SearchableProperty<T>) => boolean {
  if ("uuid" in selector) {
    const { uuid } = selector;

    return (property) => property.variable.uuid === uuid;
  }

  const normalizedLabel = normalizePropertyVariableLabel(selector.label);
  const hasMatchingLabel = (property: SearchableProperty<T>): boolean =>
    normalizePropertyVariableLabel(getPropertyVariableLabel(property)) ===
    normalizedLabel;

  if ("values" in selector) {
    const { values } = selector;

    return (property) =>
      hasMatchingLabel(property) && deepEqual(property.values, values);
  }

  if ("valueContents" in selector) {
    const { valueContents } = selector;

    return (property) =>
      hasMatchingLabel(property) &&
      hasEqualPropertyValueContents(property, valueContents);
  }

  if ("value" in selector) {
    const { value } = selector;

    return (property) =>
      hasMatchingLabel(property) && hasPropertyValue(property, value);
  }

  if ("valueContent" in selector) {
    const { valueContent } = selector;

    return (property) =>
      hasMatchingLabel(property) &&
      hasPropertyValueContent(property, valueContent);
  }

  return hasMatchingLabel;
}

/**
 * Find the first property matching a predicate, descending when asked to
 *
 * Every property at one level is tested before descending, so a match on the
 * item's own properties always wins over one on a nested property.
 */
function findProperty<T extends LanguageCodes>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  isMatch: (property: SearchableProperty<T>) => boolean,
  shouldIncludeNestedProperties: boolean,
): SearchableProperty<T> | null {
  for (const property of properties) {
    if (isMatch(property)) {
      return property;
    }
  }

  if (!shouldIncludeNestedProperties) {
    return null;
  }

  for (const property of properties) {
    if (!("properties" in property)) {
      continue;
    }

    const nestedProperty = findProperty(property.properties, isMatch, true);
    if (nestedProperty !== null) {
      return nestedProperty;
    }
  }

  return null;
}

function getLeafPropertyValues<T extends LanguageCodes>(
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

/**
 * Project a property's values, copying so callers cannot mutate the source
 */
function projectPropertyValues<T extends LanguageCodes>(
  values: ReadonlyArray<PropertyValueContent<T>>,
  shouldLimitToLeafPropertyValues: boolean,
): Array<PropertyValueContent<T>> {
  const projectedValues = shouldLimitToLeafPropertyValues
    ? getLeafPropertyValues(values)
    : values;

  return Array.from(projectedValues, (value) => ({ ...value }));
}

function visitProperties<T extends LanguageCodes>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  shouldIncludeNestedProperties: boolean,
  visit: (property: SearchableProperty<T>) => void,
): void {
  for (const property of properties) {
    visit(property);

    if (shouldIncludeNestedProperties && "properties" in property) {
      visitProperties(
        property.properties,
        shouldIncludeNestedProperties,
        visit,
      );
    }
  }
}

/**
 * Find the property a selector names
 *
 * The property is returned exactly as it was found, so its `values` are
 * whatever the item carries and `limitToLeafPropertyValues` does not apply.
 * Use {@link getPropertyValues} when leaf filtering matters.
 * @param properties - The properties to search
 * @param selector - Which property to look for
 * @param options - Search options
 * @param options.includeNestedProperties - Whether to descend into nested properties
 * @returns The matching property, or null when there is none
 */
export function getProperty<
  T extends LanguageCodes = LanguageCodes,
  TProperty extends PropertyLike<T> = PropertyLike<T>,
>(
  properties: ReadonlyArray<TProperty>,
  selector: PropertySelector<T>,
  options: PropertyOptions = DEFAULT_OPTIONS,
): TProperty | null {
  const { includeNestedProperties } = withDefaultOptions(options);

  return findProperty(
    properties,
    createPropertyPredicate(selector),
    includeNestedProperties,
  ) as TProperty | null;
}

/**
 * Read every value of the property a selector names
 * @param properties - The properties to search
 * @param selector - Which property to look for
 * @param options - Search options
 * @param options.includeNestedProperties - Whether to descend into nested properties
 * @param options.limitToLeafPropertyValues - Whether to keep only leaf values
 * @returns The values, or null when no property matched
 */
export function getPropertyValues<T extends LanguageCodes = LanguageCodes>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  selector: PropertySelector<T>,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Array<PropertyValueContent<T>> | null {
  const { includeNestedProperties, limitToLeafPropertyValues } =
    withDefaultOptions(options);
  const property = findProperty(
    properties,
    createPropertyPredicate(selector),
    includeNestedProperties,
  );

  return property == null
    ? null
    : projectPropertyValues(property.values, limitToLeafPropertyValues);
}

/**
 * Read the first value of the property a selector names
 * @param properties - The properties to search
 * @param selector - Which property to look for
 * @param options - Search options
 * @param options.includeNestedProperties - Whether to descend into nested properties
 * @param options.limitToLeafPropertyValues - Whether to keep only leaf values
 * @returns The first value, or null when no property matched or it has none
 */
export function getPropertyValue<T extends LanguageCodes = LanguageCodes>(
  properties: ReadonlyArray<SearchableProperty<T>>,
  selector: PropertySelector<T>,
  options: PropertyOptions = DEFAULT_OPTIONS,
): PropertyValueContent<T> | null {
  return getPropertyValues(properties, selector, options)?.[0] ?? null;
}

/**
 * Gets all unique properties from an array of properties.
 *
 * Properties are returned exactly as they were found, deduplicated by variable
 * UUID, keeping the first occurrence.
 * @param properties - Array of properties to get unique properties from
 * @param options - Search options
 * @param options.includeNestedProperties - Whether to descend into nested properties
 * @returns Array of unique properties
 */
export function getUniqueProperties<
  T extends LanguageCodes = LanguageCodes,
  TProperty extends PropertyLike<T> = PropertyLike<T>,
>(
  properties: ReadonlyArray<TProperty>,
  options: PropertyOptions = DEFAULT_OPTIONS,
): Array<TProperty> {
  const { includeNestedProperties } = withDefaultOptions(options);
  const uniqueProperties: Array<SearchableProperty<T>> = [];
  const seenVariableUuids = new Set<string>();

  visitProperties(properties, includeNestedProperties, (property) => {
    if (seenVariableUuids.has(property.variable.uuid)) {
      return;
    }

    seenVariableUuids.add(property.variable.uuid);
    uniqueProperties.push(property);
  });

  return uniqueProperties as Array<TProperty>;
}

/**
 * Gets all unique property variable labels from an array of properties.
 * @param properties - Array of properties to get unique property variable labels from
 * @param options - Search options
 * @param options.includeNestedProperties - Whether to descend into nested properties
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
  const seenLabels = new Set<string>();

  visitProperties(properties, includeNestedProperties, (property) => {
    const variableLabel = getPropertyVariableLabel(property);
    if (seenLabels.has(variableLabel)) {
      return;
    }

    seenLabels.add(variableLabel);
    uniquePropertyVariableLabels.push(variableLabel);
  });

  return uniquePropertyVariableLabels;
}

function isContentMatchingFilter<T extends LanguageCodes>(
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
 * Whether a property matches a variable label and value content criterion.
 *
 * Matching is client-side and deliberately loose: string contents match on a
 * case-insensitive substring, numbers and booleans on equality. A
 * `variableLabel` of "all fields" matches against every property.
 * @param property - The property to test
 * @param filter - Filter criteria containing variable label and value to match
 * @param filter.variableLabel - The variable label to filter by
 * @param filter.value - The value to filter by
 * @param options - Search options
 * @param options.includeNestedProperties - Whether to descend into nested properties
 * @param options.limitToLeafPropertyValues - Whether to test only leaf values
 * @returns True if the property matches the filter criteria, false otherwise
 */
export function isPropertyMatchingFilter<
  T extends LanguageCodes = LanguageCodes,
>(
  property: SearchableProperty<T>,
  filter: { variableLabel: string; value: PropertyValueContent<T> },
  options: PropertyOptions = DEFAULT_OPTIONS,
): boolean {
  const { includeNestedProperties, limitToLeafPropertyValues } =
    withDefaultOptions(options);

  const normalizedFilterLabel = normalizePropertyVariableLabel(
    filter.variableLabel,
  );
  const isAllFields = normalizedFilterLabel === ALL_FIELDS_VARIABLE_LABEL;

  if (
    isAllFields ||
    normalizePropertyVariableLabel(getPropertyVariableLabel(property)) ===
      normalizedFilterLabel
  ) {
    const values = limitToLeafPropertyValues
      ? getLeafPropertyValues(property.values)
      : property.values;

    for (const value of values) {
      if (isContentMatchingFilter(value.content, filter.value.content)) {
        return true;
      }
    }
  }

  if (includeNestedProperties && "properties" in property) {
    for (const nestedProperty of property.properties) {
      if (
        isPropertyMatchingFilter(nestedProperty, filter, {
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
