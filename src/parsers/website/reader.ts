import type { ParserOptions } from "#/parsers/helpers.js";
import type { MultilingualString } from "#/parsers/multilingual.js";
import type {
  LanguageCodes,
  PropertyValueContent,
  SimplifiedProperty,
} from "#/types/index.js";
import { getProperty, getPropertyValue } from "#/getters.js";
import { multilingualFromText } from "#/parsers/helpers.js";

type WebsitePropertyContent<T extends LanguageCodes> =
  PropertyValueContent<T>["content"];

export class WebsitePresentationReader<T extends LanguageCodes> {
  private readonly sourceProperties: ReadonlyArray<SimplifiedProperty<T>>;

  constructor(sourceProperties: ReadonlyArray<SimplifiedProperty<T>>) {
    this.sourceProperties = sourceProperties;
  }

  property(label: string): SimplifiedProperty<T> | null {
    return getProperty(this.sourceProperties, { label });
  }

  requiredProperty(label: string, message: string): SimplifiedProperty<T> {
    const property = this.property(label);
    if (property === null) {
      throw new Error(message, { cause: this.sourceProperties });
    }

    return property;
  }

  propertyByValue(
    label: string,
    value: WebsitePropertyContent<T>,
  ): SimplifiedProperty<T> | null {
    return getProperty(this.sourceProperties, { label, valueContent: value });
  }

  valueNode(label: string): PropertyValueContent<T> | null {
    return getPropertyValue(this.sourceProperties, { label });
  }

  values(label: string): Array<PropertyValueContent<T>> {
    return this.property(label)?.values ?? [];
  }

  value<U = WebsitePropertyContent<T>>(label: string): U | null {
    const value = this.valueNode(label)?.content;
    return (value ?? null) as U | null;
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

    if (typeof value !== "string" || value.trim() === "") {
      return null;
    }

    const parsedValue = Number(value);
    return Number.isNaN(parsedValue) ? null : parsedValue;
  }

  uuid(label: string): string | null {
    return this.valueNode(label)?.uuid ?? null;
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

  /**
   * Overwrite a field from a labeled OCHRE property
   *
   * The field's current value is the default, so the caller writes the
   * inherited default once where the object is built and names the OCHRE label
   * once here, instead of restating both plus the field's type path.
   * @param target - The object holding the field
   * @param key - The field to overwrite
   * @param label - The OCHRE property label to read
   */
  readInto<O extends object, K extends keyof O>(
    target: O,
    key: K,
    label: string,
  ): void {
    target[key] = this.valueOr<O[K]>(label, target[key]);
  }

  /**
   * Overwrite a UUID field from the UUID a labeled OCHRE property points at
   * @param target - The object holding the field
   * @param key - The field to overwrite
   * @param label - The OCHRE property label to read
   */
  readUuidInto<O extends Record<K, string | null>, K extends keyof O>(
    target: O,
    key: K,
    label: string,
  ): void {
    target[key] = (this.uuid(label) ?? target[key]) as O[K];
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
