import { DEFAULT_LANGUAGES } from "#/constants.js";

/**
 * One text entry for a language. When OCHRE exposes multiple entries for the
 * same language, the first one is primary.
 */
export type MultilingualStringEntry = {
  text: string;
  richText: string;
  isPrimary: boolean;
};

export type MultilingualStringText = { text: string; richText: string };

export type MultilingualStringInput =
  | string
  | { text: string; richText?: string };

export type MultilingualStringJSON<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
> = {
  content: Partial<Record<T[number], Array<MultilingualStringEntry>>>;
  aliases: Array<string>;
};

export type MultilingualStringObject<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
> = Partial<Record<T[number], MultilingualStringInput>>;

export type MultilingualStringEntries<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
> = Partial<Record<T[number], ReadonlyArray<MultilingualStringInput>>>;

/**
 * Options for creating and working with multilingual strings
 */
export type MultilingualOptions = {
  /** Default language to use for fallbacks */
  defaultLanguage?: string;
  /** Available languages for this string */
  availableLanguages?: ReadonlyArray<string>;
  /** Alias values carried by OCHRE as zxx content */
  aliases?: ReadonlyArray<string>;
};

type MultilingualContent<T extends ReadonlyArray<string>> = Partial<
  Record<T[number], ReadonlyArray<MultilingualStringEntry>>
>;

const MULTILINGUAL_STRING_INTERNAL_INIT = Symbol(
  "MultilingualString.internalInit",
);

type MultilingualStringInternalInit<T extends ReadonlyArray<string>> = {
  readonly [MULTILINGUAL_STRING_INTERNAL_INIT]: true;
  content: MultilingualContent<T>;
  options: Required<MultilingualOptions>;
  availableLanguages: ReadonlyArray<T[number]>;
};

function normalizeInputText(
  text: MultilingualStringInput,
): MultilingualStringText {
  return typeof text === "string" ?
      { text, richText: text }
    : { text: text.text, richText: text.richText ?? text.text };
}

function normalizeAliases(
  aliases: ReadonlyArray<string> | undefined,
): Array<string> {
  const normalizedAliases: Array<string> = [];
  for (const alias of aliases ?? []) {
    if (alias !== "") {
      normalizedAliases.push(alias);
    }
  }

  return normalizedAliases;
}

function entriesFromTexts(
  texts: ReadonlyArray<MultilingualStringInput>,
): Array<MultilingualStringEntry> {
  const entries: Array<MultilingualStringEntry> = [];
  for (const text of texts) {
    entries.push({
      ...normalizeInputText(text),
      isPrimary: entries.length === 0,
    });
  }

  return entries;
}

function cloneContent<T extends ReadonlyArray<string>>(
  content: MultilingualContent<T>,
): MultilingualContent<T> {
  const clonedContent: Partial<
    Record<T[number], Array<MultilingualStringEntry>>
  > = {};
  const entriesByLanguage = Object.entries(content) as Array<
    [T[number], ReadonlyArray<MultilingualStringEntry> | undefined]
  >;
  for (const [language, entries] of entriesByLanguage) {
    const clonedEntries: Array<MultilingualStringEntry> = [];
    for (const entry of entries ?? []) {
      clonedEntries.push({
        text: entry.text,
        richText: entry.richText,
        isPrimary: entry.isPrimary,
      });
    }
    clonedContent[language] = normalizePrimary(clonedEntries);
  }

  return clonedContent;
}

function normalizePrimary(
  entries: ReadonlyArray<MultilingualStringEntry>,
): Array<MultilingualStringEntry> {
  const normalizedEntries: Array<MultilingualStringEntry> = [];
  for (const entry of entries) {
    normalizedEntries.push({
      text: entry.text,
      richText: entry.richText,
      isPrimary: normalizedEntries.length === 0,
    });
  }

  return normalizedEntries;
}

function getLanguagesWithEntries<T extends ReadonlyArray<string>>(
  content: MultilingualContent<T>,
  languages: ReadonlyArray<T[number]>,
): Array<T[number]> {
  const availableLanguages: Array<T[number]> = [];
  for (const language of languages) {
    if ((content[language]?.length ?? 0) > 0) {
      availableLanguages.push(language);
    }
  }

  return availableLanguages;
}

function getImplicitLanguages(
  content: Partial<Record<string, ReadonlyArray<MultilingualStringInput>>>,
  options: MultilingualOptions,
): ReadonlyArray<string> {
  const languages: Array<string> = [];

  for (const language of options.availableLanguages ?? []) {
    if (!languages.includes(language)) {
      languages.push(language);
    }
  }

  for (const language of Object.keys(content)) {
    if (!languages.includes(language)) {
      languages.push(language);
    }
  }

  return languages.length > 0 ? languages : [...DEFAULT_LANGUAGES];
}

function isInternalInit<T extends ReadonlyArray<string>>(
  value: unknown,
): value is MultilingualStringInternalInit<T> {
  return (
    typeof value === "object" &&
    value != null &&
    MULTILINGUAL_STRING_INTERNAL_INIT in value
  );
}

/**
 * Multilingual string
 */
export class MultilingualString<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
> {
  private readonly _content: Readonly<MultilingualContent<T>>;
  private readonly _options: Required<MultilingualOptions>;
  private readonly _availableLanguages: ReadonlyArray<T[number]>;
  private readonly _aliases: ReadonlyArray<string>;

  /**
   * Create a new multilingual string from an object of language codes to text.
   */
  /** @internal */
  constructor(init: MultilingualStringInternalInit<T>);
  constructor(
    content: MultilingualStringObject<T>,
    languages: T,
    options?: MultilingualOptions,
  );
  constructor(
    content?: Partial<Record<string, MultilingualStringInput>>,
    languages?: undefined,
    options?: MultilingualOptions,
  );
  constructor(
    content:
      | Partial<Record<string, MultilingualStringInput>>
      | MultilingualStringInternalInit<T> = {},
    languages?: T,
    options: MultilingualOptions = {},
  ) {
    if (isInternalInit<T>(content)) {
      this._content = Object.freeze(cloneContent(content.content));
      this._options = Object.freeze({ ...content.options });
      this._availableLanguages = Object.freeze([...content.availableLanguages]);
      this._aliases = Object.freeze([...content.options.aliases]);
      return;
    }

    const parsed =
      languages === undefined ?
        MultilingualString.fromObject(content, undefined, options)
      : MultilingualString.fromObject(content, languages, options);

    this._content = parsed._content;
    this._options = parsed._options;
    this._availableLanguages = parsed._availableLanguages;
    this._aliases = parsed._aliases;
  }

  private static fromNormalized<U extends ReadonlyArray<string>>(
    content: MultilingualContent<U>,
    options: Required<MultilingualOptions>,
    availableLanguages: ReadonlyArray<U[number]>,
  ): MultilingualString<U> {
    return new MultilingualString<U>({
      [MULTILINGUAL_STRING_INTERNAL_INIT]: true,
      content,
      options,
      availableLanguages,
    });
  }

  /**
   * Create a new multilingual string from an object of language codes to text
   */
  static fromObject<U extends ReadonlyArray<string>>(
    content: MultilingualStringObject<U>,
    languages: U,
    options?: MultilingualOptions,
  ): MultilingualString<U>;
  static fromObject(
    content: Partial<Record<string, MultilingualStringInput>>,
    languages?: undefined,
    options?: MultilingualOptions,
  ): MultilingualString<ReadonlyArray<string>>;
  static fromObject<U extends ReadonlyArray<string>>(
    content: Partial<Record<string, MultilingualStringInput>>,
    languages?: U,
    options: MultilingualOptions = {},
  ): MultilingualString<U> | MultilingualString<ReadonlyArray<string>> {
    const entries: Partial<
      Record<string, ReadonlyArray<MultilingualStringInput>>
    > = {};
    for (const [language, text] of Object.entries(content)) {
      if (text != null) {
        entries[language] = [text];
      }
    }

    if (languages === undefined) {
      return MultilingualString.fromEntries(entries, undefined, options);
    }

    return MultilingualString.fromEntries(entries, languages, options);
  }

  /**
   * Create a new multilingual string from language entries.
   */
  static fromEntries<U extends ReadonlyArray<string>>(
    content: MultilingualStringEntries<U>,
    languages: U,
    options?: MultilingualOptions,
  ): MultilingualString<U>;
  static fromEntries(
    content: Partial<Record<string, ReadonlyArray<MultilingualStringInput>>>,
    languages?: undefined,
    options?: MultilingualOptions,
  ): MultilingualString<ReadonlyArray<string>>;
  static fromEntries<U extends ReadonlyArray<string>>(
    content: Partial<Record<string, ReadonlyArray<MultilingualStringInput>>>,
    languages?: U,
    options: MultilingualOptions = {},
  ): MultilingualString<U> | MultilingualString<ReadonlyArray<string>> {
    if (languages === undefined) {
      const actualLanguages = getImplicitLanguages(content, options);
      const normalizedContent: Partial<
        Record<string, Array<MultilingualStringEntry>>
      > = {};
      for (const language of actualLanguages) {
        normalizedContent[language] = entriesFromTexts(content[language] ?? []);
      }

      const availableLanguages = getLanguagesWithEntries<ReadonlyArray<string>>(
        normalizedContent,
        actualLanguages,
      );
      const defaultOptions: Required<MultilingualOptions> = {
        defaultLanguage:
          options.defaultLanguage ??
          availableLanguages[0] ??
          actualLanguages[0]!,
        availableLanguages: actualLanguages,
        aliases: normalizeAliases(options.aliases),
      };

      return MultilingualString.fromNormalized(
        normalizedContent,
        defaultOptions,
        availableLanguages,
      ) as MultilingualString<ReadonlyArray<string>>;
    }

    const normalizedContent: Partial<
      Record<U[number], Array<MultilingualStringEntry>>
    > = {};
    for (const language of languages) {
      const typedLanguage = language as U[number];
      normalizedContent[typedLanguage] = entriesFromTexts(
        content[typedLanguage] ?? [],
      );
    }

    const availableLanguages = getLanguagesWithEntries(
      normalizedContent,
      languages,
    );
    const defaultOptions: Required<MultilingualOptions> = {
      defaultLanguage:
        options.defaultLanguage ?? availableLanguages[0] ?? languages[0]!,
      availableLanguages: languages,
      aliases: normalizeAliases(options.aliases),
    };

    return MultilingualString.fromNormalized(
      normalizedContent,
      defaultOptions,
      availableLanguages,
    );
  }

  /**
   * Create a new multilingual string for a single language
   */
  static create<U extends ReadonlyArray<string>>(
    language: U[number],
    text: MultilingualStringInput,
    languages: U,
    options?: MultilingualOptions,
  ): MultilingualString<U>;
  static create(
    language: string,
    text: MultilingualStringInput,
    languages?: undefined,
    options?: MultilingualOptions,
  ): MultilingualString<ReadonlyArray<string>>;
  static create<U extends ReadonlyArray<string>>(
    language: string,
    text: MultilingualStringInput,
    languages?: U,
    options: MultilingualOptions = {},
  ): MultilingualString<U> | MultilingualString<ReadonlyArray<string>> {
    if (languages === undefined) {
      return MultilingualString.fromObject({ [language]: text }, undefined, {
        ...options,
        defaultLanguage: language,
      });
    }

    return MultilingualString.fromObject(
      { [language]: text } as Partial<
        Record<U[number], MultilingualStringInput>
      >,
      languages,
      { ...options, defaultLanguage: language },
    );
  }

  /**
   * Create an empty multilingual string
   */
  static empty<U extends ReadonlyArray<string>>(
    languages: U,
    options?: MultilingualOptions,
  ): MultilingualString<U>;
  static empty(
    languages?: undefined,
    options?: MultilingualOptions,
  ): MultilingualString<ReadonlyArray<string>>;
  static empty<U extends ReadonlyArray<string>>(
    languages?: U,
    options: MultilingualOptions = {},
  ): MultilingualString<U> | MultilingualString<ReadonlyArray<string>> {
    if (languages === undefined) {
      return MultilingualString.fromObject({}, undefined, options);
    }

    return MultilingualString.fromObject({}, languages, options);
  }

  /**
   * Recreate a multilingual string from its JSON representation.
   */
  static fromJSON<U extends ReadonlyArray<string>>(
    json: MultilingualStringJSON<U>,
    languages: U,
    options?: Omit<MultilingualOptions, "aliases">,
  ): MultilingualString<U>;
  static fromJSON(
    json: MultilingualStringJSON,
    languages?: undefined,
    options?: Omit<MultilingualOptions, "aliases">,
  ): MultilingualString<ReadonlyArray<string>>;
  static fromJSON<U extends ReadonlyArray<string>>(
    json: MultilingualStringJSON | MultilingualStringJSON<U>,
    languages?: U,
    options: Omit<MultilingualOptions, "aliases"> = {},
  ): MultilingualString<U> | MultilingualString<ReadonlyArray<string>> {
    const content = json.content as Partial<
      Record<string, ReadonlyArray<MultilingualStringInput>>
    >;
    const mergedOptions = { ...options, aliases: json.aliases };

    if (languages === undefined) {
      return MultilingualString.fromEntries(content, undefined, mergedOptions);
    }

    return MultilingualString.fromEntries(content, languages, mergedOptions);
  }

  private getPrimaryEntry(language: T[number]): MultilingualStringEntry | null {
    const entries = this._content[language] ?? [];
    for (const entry of entries) {
      if (entry.isPrimary) {
        return entry;
      }
    }

    return entries[0] ?? null;
  }

  /**
   * Get text in a specific language with automatic fallback
   */
  getText(language?: T[number]): string {
    if (language == null) {
      const defaultEntry = this.getPrimaryEntry(
        this._options.defaultLanguage as T[number],
      );
      if (defaultEntry != null) return defaultEntry.text;
    }

    if (language != null) {
      const requestedEntry = this.getPrimaryEntry(language);
      if (requestedEntry != null) return requestedEntry.text;
    }

    const defaultEntry = this.getPrimaryEntry(
      this._options.defaultLanguage as T[number],
    );
    if (defaultEntry != null) return defaultEntry.text;

    for (const availableLanguage of this._availableLanguages) {
      const entry = this.getPrimaryEntry(availableLanguage);
      if (entry != null) return entry.text;
    }

    return "";
  }

  /**
   * Get rich text in a specific language with automatic fallback
   */
  getRichText(language?: T[number]): string {
    if (language == null) {
      const defaultEntry = this.getPrimaryEntry(
        this._options.defaultLanguage as T[number],
      );
      if (defaultEntry != null) return defaultEntry.richText;
    }

    if (language != null) {
      const requestedEntry = this.getPrimaryEntry(language);
      if (requestedEntry != null) return requestedEntry.richText;
    }

    const defaultEntry = this.getPrimaryEntry(
      this._options.defaultLanguage as T[number],
    );
    if (defaultEntry != null) return defaultEntry.richText;

    for (const availableLanguage of this._availableLanguages) {
      const entry = this.getPrimaryEntry(availableLanguage);
      if (entry != null) return entry.richText;
    }

    return "";
  }

  /**
   * Get primary text in a specific language without fallback
   */
  getExactText(language: T[number]): string | null {
    return this.getPrimaryEntry(language)?.text ?? null;
  }

  /**
   * Get primary rich text in a specific language without fallback
   */
  getExactRichText(language: T[number]): string | null {
    return this.getPrimaryEntry(language)?.richText ?? null;
  }

  /**
   * Get all text entries in a specific language without fallback
   */
  getExactTexts(language: T[number]): Array<string> {
    const texts: Array<string> = [];
    for (const entry of this._content[language] ?? []) {
      texts.push(entry.text);
    }

    return texts;
  }

  /**
   * Get all rich text entries in a specific language without fallback
   */
  getExactRichTexts(language: T[number]): Array<string> {
    const texts: Array<string> = [];
    for (const entry of this._content[language] ?? []) {
      texts.push(entry.richText);
    }

    return texts;
  }

  /**
   * Get all text entries in a specific language with fallback
   */
  getTexts(language?: T[number]): Array<string> {
    if (language != null && (this._content[language]?.length ?? 0) > 0) {
      return this.getExactTexts(language);
    }

    const defaultLanguage = this._options.defaultLanguage as T[number];
    if ((this._content[defaultLanguage]?.length ?? 0) > 0) {
      return this.getExactTexts(defaultLanguage);
    }

    const firstLanguage = this._availableLanguages[0];
    return firstLanguage == null ? [] : this.getExactTexts(firstLanguage);
  }

  /**
   * Get all rich text entries in a specific language with fallback
   */
  getRichTexts(language?: T[number]): Array<string> {
    if (language != null && (this._content[language]?.length ?? 0) > 0) {
      return this.getExactRichTexts(language);
    }

    const defaultLanguage = this._options.defaultLanguage as T[number];
    if ((this._content[defaultLanguage]?.length ?? 0) > 0) {
      return this.getExactRichTexts(defaultLanguage);
    }

    const firstLanguage = this._availableLanguages[0];
    return firstLanguage == null ? [] : this.getExactRichTexts(firstLanguage);
  }

  /**
   * Get all entries in a specific language without fallback
   */
  getExactEntries(language: T[number]): Array<MultilingualStringEntry> {
    const entries: Array<MultilingualStringEntry> = [];
    for (const entry of this._content[language] ?? []) {
      entries.push({
        text: entry.text,
        richText: entry.richText,
        isPrimary: entry.isPrimary,
      });
    }

    return entries;
  }

  /**
   * Get all entries in a specific language with fallback
   */
  getEntries(language?: T[number]): Array<MultilingualStringEntry> {
    if (language != null && (this._content[language]?.length ?? 0) > 0) {
      return this.getExactEntries(language);
    }

    const defaultLanguage = this._options.defaultLanguage as T[number];
    if ((this._content[defaultLanguage]?.length ?? 0) > 0) {
      return this.getExactEntries(defaultLanguage);
    }

    const firstLanguage = this._availableLanguages[0];
    return firstLanguage == null ? [] : this.getExactEntries(firstLanguage);
  }

  /**
   * Get aliases carried by OCHRE as zxx content
   */
  getAliases(): Array<string> {
    return [...this._aliases];
  }

  /**
   * Check if text exists for a specific language
   */
  hasLanguage(language: T[number]): boolean {
    return (this._content[language]?.length ?? 0) > 0;
  }

  /**
   * Check if aliases exist
   */
  hasAliases(): boolean {
    return this._aliases.length > 0;
  }

  /**
   * Get all available languages
   */
  getAvailableLanguages(): ReadonlyArray<T[number]> {
    return this._availableLanguages;
  }

  /**
   * Get all supported languages (the full language array passed to constructor)
   */
  getSupportedLanguages(): T {
    return this._options.availableLanguages as T;
  }

  /**
   * Check if the multilingual string is empty (no content in any language)
   */
  isEmpty(): boolean {
    return this._availableLanguages.length === 0;
  }

  /**
   * Check if the multilingual string has any content
   */
  hasContent(): boolean {
    const contentEntries = Object.values(this._content) as Array<
      ReadonlyArray<MultilingualStringEntry> | undefined
    >;
    for (const entries of contentEntries) {
      for (const entry of entries ?? []) {
        if (entry.text.trim().length > 0 || entry.richText.trim().length > 0) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get the default language
   */
  getDefaultLanguage(): T[number] {
    return this._options.defaultLanguage as T[number];
  }

  /**
   * Add or update the primary text for a language (returns new instance)
   */
  withText(
    language: T[number],
    text: MultilingualStringInput,
  ): MultilingualString<T> {
    const newContent = cloneContent(this._content);
    newContent[language] = entriesFromTexts([text]);
    const newAvailableLanguages = getLanguagesWithEntries(
      newContent,
      this._options.availableLanguages as ReadonlyArray<T[number]>,
    );

    return MultilingualString.fromNormalized(
      newContent,
      this._options,
      newAvailableLanguages,
    );
  }

  /**
   * Add another text entry for a language (returns new instance)
   */
  withEntry(
    language: T[number],
    text: MultilingualStringInput,
  ): MultilingualString<T> {
    const newContent = cloneContent(this._content);
    const existingEntries = newContent[language] ?? [];
    newContent[language] = normalizePrimary([
      ...existingEntries,
      { ...normalizeInputText(text), isPrimary: false },
    ]);
    const newAvailableLanguages = getLanguagesWithEntries(
      newContent,
      this._options.availableLanguages as ReadonlyArray<T[number]>,
    );

    return MultilingualString.fromNormalized(
      newContent,
      this._options,
      newAvailableLanguages,
    );
  }

  /**
   * Replace aliases (returns new instance)
   */
  withAliases(aliases: ReadonlyArray<string>): MultilingualString<T> {
    return MultilingualString.fromNormalized(
      this._content,
      { ...this._options, aliases: normalizeAliases(aliases) },
      this._availableLanguages,
    );
  }

  /**
   * Remove text for a language (returns new instance)
   */
  withoutLanguage(language: T[number]): MultilingualString<T> {
    const newContent: Partial<
      Record<T[number], Array<MultilingualStringEntry>>
    > = {};
    const currentContent = cloneContent(this._content);
    for (const supportedLanguage of this._options
      .availableLanguages as ReadonlyArray<T[number]>) {
      if (supportedLanguage !== language) {
        newContent[supportedLanguage] = normalizePrimary(
          currentContent[supportedLanguage] ?? [],
        );
      }
    }

    const newAvailableLanguages = getLanguagesWithEntries(
      newContent,
      this._options.availableLanguages as ReadonlyArray<T[number]>,
    );
    const newDefaultLanguage =
      this._options.defaultLanguage === language ?
        (newAvailableLanguages[0] ?? this._options.availableLanguages[0])
      : this._options.defaultLanguage;

    return MultilingualString.fromNormalized(
      newContent,
      { ...this._options, defaultLanguage: newDefaultLanguage! },
      newAvailableLanguages,
    );
  }

  /**
   * Transform all language versions (returns new instance)
   */
  map(
    fn: (text: string, language: T[number]) => string,
  ): MultilingualString<T> {
    const newContent: Partial<
      Record<T[number], Array<MultilingualStringEntry>>
    > = {};
    for (const language of this._availableLanguages) {
      const mappedEntries: Array<MultilingualStringEntry> = [];
      for (const entry of this._content[language] ?? []) {
        mappedEntries.push({
          text: fn(entry.text, language),
          richText: fn(entry.richText, language),
          isPrimary: entry.isPrimary,
        });
      }
      newContent[language] = normalizePrimary(mappedEntries);
    }

    return MultilingualString.fromNormalized(
      newContent,
      this._options,
      this._availableLanguages,
    );
  }

  /**
   * Filter languages based on predicate (returns new instance)
   */
  filter(
    predicate: (text: string, language: T[number]) => boolean,
  ): MultilingualString<T> {
    const newContent: Partial<
      Record<T[number], Array<MultilingualStringEntry>>
    > = {};

    for (const language of this._availableLanguages) {
      const entries: Array<MultilingualStringEntry> = [];
      for (const entry of this._content[language] ?? []) {
        if (predicate(entry.text, language)) {
          entries.push(entry);
        }
      }
      newContent[language] = normalizePrimary(entries);
    }

    const newAvailableLanguages = getLanguagesWithEntries(
      newContent,
      this._options.availableLanguages as ReadonlyArray<T[number]>,
    );
    const defaultLanguage = this._options.defaultLanguage as T[number];
    const newDefaultLanguage =
      (newContent[defaultLanguage]?.length ?? 0) > 0 ?
        this._options.defaultLanguage
      : (newAvailableLanguages[0] ?? this._options.availableLanguages[0]);

    return MultilingualString.fromNormalized(
      newContent,
      { ...this._options, defaultLanguage: newDefaultLanguage! },
      newAvailableLanguages,
    );
  }

  /**
   * Get the string representation (uses default language)
   */
  toString(): string {
    return this.getText();
  }

  /**
   * Get JSON representation
   */
  toJSON(): MultilingualStringJSON<T> {
    const content: Partial<Record<T[number], Array<MultilingualStringEntry>>> =
      {};
    for (const language of this._availableLanguages) {
      content[language] = this.getExactEntries(language);
    }

    return { content, aliases: this.getAliases() };
  }
}
