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

/**
 * The fields of an object that hold a UUID, which are the only ones
 * {@link WebsitePresentationReader.readAllUuids} can write
 */
type UuidKeys<O> = {
  [K in keyof O]-?: O[K] extends string | null ? K : never;
}[keyof O];

/**
 * Reads a website's presentation properties
 *
 * OCHRE stores everything a website declares about itself as labeled property
 * values nested under a "presentation" property, so every read is "find the
 * property with this label, then take its first value". This owns that walk
 * and the coercions that go with it, and hands back readers for nested levels
 * so the caller never touches the raw property array.
 */
export class WebsitePresentationReader<T extends LanguageCodes> {
  private readonly sourceProperties: ReadonlyArray<SimplifiedProperty<T>>;

  constructor(sourceProperties: ReadonlyArray<SimplifiedProperty<T>>) {
    this.sourceProperties = sourceProperties;
  }

  private propertyByValue(
    label: string,
    value: WebsitePropertyContent<T>,
  ): SimplifiedProperty<T> | null {
    return getProperty(this.sourceProperties, { label, valueContent: value });
  }

  /**
   * Overwrite one field from a labeled OCHRE property
   *
   * Private because {@link readAll} covers every caller: a single-field read
   * is a one-entry label map, and going through the map keeps the field's type
   * coming from the target rather than from a type argument.
   */
  private readOne<O extends object, K extends keyof O>(
    target: O,
    key: K,
    label: string,
  ): void {
    target[key] = this.valueOr<O[K]>(label, target[key]);
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

  valueNode(label: string): PropertyValueContent<T> | null {
    return getPropertyValue(this.sourceProperties, { label });
  }

  value<U = WebsitePropertyContent<T>>(label: string): U | null {
    const value = this.valueNode(label)?.content;
    return (value ?? null) as U | null;
  }

  valueOr<U>(label: string, fallback: U): U {
    return this.value<U>(label) ?? fallback;
  }

  /**
   * Read a property whose field is a string but whose OCHRE value may not be
   *
   * OCHRE types a dimension like "width" from what was entered, so the same
   * property arrives as `"50%"` on one resource and `50` on another. Anything
   * that is neither is treated as unset rather than stringified, so a stray
   * boolean does not become the literal text "true".
   * @param label - The OCHRE property label to read
   * @returns The string, or null when the property is unset or not string-like
   */
  stringValue(label: string): string | null {
    const value = this.value<WebsitePropertyContent<T>>(label);
    if (typeof value === "string") {
      return value;
    }

    return typeof value === "number" ? value.toString() : null;
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
   * Overwrite several fields from the OCHRE properties naming them
   *
   * The defaults object carries the shape and the fallback values, and the
   * label map carries the OCHRE names, so a component states each property
   * twice rather than five times: once as a default and once as a label. The
   * field's type comes from the defaults object, so no type argument is needed.
   * @param target - The object holding the fields, pre-filled with defaults
   * @param labels - The OCHRE property label for each field to overwrite
   */
  readAll<O extends object>(
    target: O,
    labels: Partial<Record<keyof O, string>>,
  ): void {
    for (const [key, label] of Object.entries(labels) as Array<
      [keyof O, string | undefined]
    >) {
      if (label != null) {
        this.readOne(target, key, label);
      }
    }
  }

  /**
   * Overwrite several UUID fields from the UUIDs labeled OCHRE properties
   * point at
   *
   * The same shape as {@link readAll}, for the fields that take the value's
   * target rather than its content.
   * @param target - The object holding the fields, pre-filled with defaults
   * @param labels - The OCHRE property label for each field to overwrite
   */
  readAllUuids<O extends object>(
    target: O,
    labels: Partial<Record<UuidKeys<O>, string>>,
  ): void {
    for (const [key, label] of Object.entries(labels) as Array<
      [UuidKeys<O>, string | undefined]
    >) {
      if (label != null) {
        target[key] = (this.uuid(label) ?? target[key]) as O[UuidKeys<O>];
      }
    }
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
}

export function websitePresentationReader<T extends LanguageCodes>(
  properties: ReadonlyArray<SimplifiedProperty<T>>,
): WebsitePresentationReader<T> {
  return new WebsitePresentationReader(properties);
}
