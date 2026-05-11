import type { ParserOptions } from "#/parsers/helpers.js";
import type { MultilingualString } from "#/parsers/multilingual.js";
import type {
  LanguageCodes,
  PropertyValueContent,
  SimplifiedProperty,
} from "#/types/index.js";
import {
  getPropertyByVariableLabel,
  getPropertyByVariableLabelAndValueContent,
  getPropertyValueByVariableLabel,
} from "#/getters.js";
import { multilingualFromText } from "#/parsers/helpers.js";

type WebsitePropertyContent<T extends LanguageCodes> =
  PropertyValueContent<T>["content"];

export class WebsitePresentationReader<T extends LanguageCodes> {
  constructor(
    private readonly sourceProperties: ReadonlyArray<SimplifiedProperty<T>>,
  ) {}

  property(label: string): SimplifiedProperty<T> | null {
    return getPropertyByVariableLabel(this.sourceProperties, label);
  }

  requiredProperty(label: string, message: string): SimplifiedProperty<T> {
    const property = this.property(label);
    if (property === null) {
      throw new Error(message);
    }

    return property;
  }

  propertyByValue(
    label: string,
    value: WebsitePropertyContent<T>,
  ): SimplifiedProperty<T> | null {
    return getPropertyByVariableLabelAndValueContent(
      this.sourceProperties,
      label,
      value,
    );
  }

  valueNode(label: string): PropertyValueContent<T> | null {
    return getPropertyValueByVariableLabel(this.sourceProperties, label);
  }

  values(label: string): Array<PropertyValueContent<T>> {
    return this.property(label)?.values ?? [];
  }

  value<U = WebsitePropertyContent<T>>(label: string): U | null {
    const value = this.valueNode(label)?.content;
    return value == null ? null : (value as U);
  }

  valueOr<U>(label: string, fallback: U): U {
    return this.value<U>(label) ?? fallback;
  }

  stringValue(label: string): string | null {
    const value = this.value<WebsitePropertyContent<T>>(label);
    return value == null ? null : value.toString();
  }

  numberValue(label: string): number | null {
    const value = this.value<WebsitePropertyContent<T>>(label);
    if (typeof value === "number") {
      return value;
    }

    if (typeof value !== "string") {
      return null;
    }

    const parsedValue = Number.parseFloat(value);
    return Number.isNaN(parsedValue) ? null : parsedValue;
  }

  uuid(label: string): string | null {
    return this.valueNode(label)?.uuid ?? null;
  }

  linkTarget(
    label: string,
    transformHref: (href: string) => string,
  ): string | null {
    const value = this.valueNode(label);
    if (value?.href != null) {
      return transformHref(value.href);
    }

    return value?.slug ?? null;
  }

  multilingualValue(
    label: string,
    options: ParserOptions<T>,
  ): MultilingualString<T> | null {
    const value = this.valueNode(label);
    if (value == null) {
      return null;
    }

    if (value.label != null) {
      return value.label;
    }

    return typeof value.content === "string"
      ? multilingualFromText(value.content, options)
      : null;
  }

  nested(label: string): WebsitePresentationReader<T> {
    return new WebsitePresentationReader(
      this.property(label)?.properties ?? [],
    );
  }

  nestedByValue(
    label: string,
    value: WebsitePropertyContent<T>,
  ): WebsitePresentationReader<T> {
    return new WebsitePresentationReader(
      this.propertyByValue(label, value)?.properties ?? [],
    );
  }

  get size(): number {
    return this.sourceProperties.length;
  }

  get properties(): ReadonlyArray<SimplifiedProperty<T>> {
    return this.sourceProperties;
  }
}

export function websitePresentationReader<T extends LanguageCodes>(
  properties: ReadonlyArray<SimplifiedProperty<T>>,
): WebsitePresentationReader<T> {
  return new WebsitePresentationReader(properties);
}
