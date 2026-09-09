import { DEFAULT_LANGUAGES } from "#/constants.js";
import { serializeMDXText } from "#/parsers/mdx.js";
import { readProperty } from "#/reflection.js";

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
  /**
   * The language reads fall back to first
   *
   * Optional so payloads written before it existed still parse; when absent the
   * first available language is used, which is what the old shape implied.
   */
  defaultLanguage?: string;
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
  /**
  Default language to use for fallbacks
  */
  defaultLanguage?: string;
  /**
  Available languages for this string
  */
  availableLanguages?: ReadonlyArray<string>;
  /**
  Alias values carried by OCHRE as zxx content
  */
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
  return typeof text === "string"
    ? { text, richText: serializeMDXText(text) }
    : {
        text: text.text,
        richText: text.richText ?? serializeMDXText(text.text),
      };
}

function normalizeAliases(
  aliases: ReadonlyArray<string> | undefined,
): Array<string> {
  const normalizedAliases: Array<string> = [];
  const candidateAliases = aliases ?? [];
  for (const alias of candidateAliases) {
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
    const clonedEntries: Array<MultilingualStringEntry> = Array.from(
      entries ?? [],
      (entry) => ({
        text: entry.text,
        richText: entry.richText,
        isPrimary: entry.isPrimary,
      }),
    );
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
  const availableLanguages = options.availableLanguages ?? [];

  for (const language of availableLanguages) {
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

/**
 * Pick the language reads should fall back to first
 * @param availableLanguages - The languages carrying content, in order
 * @param supportedLanguages - Every language the string was created for
 * @returns The default language
 */
function resolveDefaultLanguageOption(
  availableLanguages: ReadonlyArray<string>,
  supportedLanguages: ReadonlyArray<string>,
): string {
  return availableLanguages[0] ?? supportedLanguages[0] ?? DEFAULT_LANGUAGES[0];
}

/**
 * Whether a constructor argument is the module's own normalized init
 *
 * The assertion is earned by the brand rather than by inspecting the fields:
 * {@link MULTILINGUAL_STRING_INTERNAL_INIT} is a module-private symbol, so no
 * caller outside this file can produce a value carrying it, and the single
 * producer is `fromNormalized`. That is what makes the narrowing sound; a
 * field-by-field check would only re-state what the brand already guarantees.
 * @param value - The constructor argument
 * @returns True when the value carries the internal brand
 */
function isInternalInit<T extends ReadonlyArray<string>>(
  value: unknown,
): value is MultilingualStringInternalInit<T> {
  return readProperty(value, MULTILINGUAL_STRING_INTERNAL_INIT) === true;
}

/**
 * Multilingual string
 */
export class MultilingualString<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
> {
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
      return this.fromEntries(entries, undefined, options);
    }

    return this.fromEntries(entries, languages, options);
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
          resolveDefaultLanguageOption(availableLanguages, actualLanguages),
        availableLanguages: actualLanguages,
        aliases: normalizeAliases(options.aliases),
      };

      return this.fromNormalized(
        normalizedContent,
        defaultOptions,
        availableLanguages,
      );
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
        options.defaultLanguage ??
        resolveDefaultLanguageOption(availableLanguages, languages),
      availableLanguages: languages,
      aliases: normalizeAliases(options.aliases),
    };

    return this.fromNormalized(
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
      return this.fromObject({ [language]: text }, undefined, {
        ...options,
        defaultLanguage: language,
      });
    }

    return this.fromObject(
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
      return this.fromObject({}, undefined, options);
    }

    return this.fromObject({}, languages, options);
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
    const mergedOptions = {
      defaultLanguage: json.defaultLanguage,
      ...options,
      aliases: json.aliases,
    };

    if (languages === undefined) {
      return this.fromEntries(content, undefined, mergedOptions);
    }

    return this.fromEntries(content, languages, mergedOptions);
  }

  private readonly _content: Readonly<MultilingualContent<T>>;
  private readonly _options: Required<MultilingualOptions>;
  private readonly _availableLanguages: ReadonlyArray<T[number]>;
  private readonly _aliases: ReadonlyArray<string>;

  /**
   * Create a new multilingual string from an object of language codes to text.
   */
  /**
  @internal
  */
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
      languages === undefined
        ? MultilingualString.fromObject(content, undefined, options)
        : MultilingualString.fromObject(content, languages, options);

    this._content = parsed._content;
    this._options = parsed._options;
    this._availableLanguages = parsed._availableLanguages;
    this._aliases = parsed._aliases;
  }

  /**
   * Resolve the entries to read for a language
   *
   * The fallback order is requested language, then the dataset's default
   * language, then the first language that has any content. This is the only
   * place that order is written down; every reader below is a projection of it.
   */
  private resolveEntries(
    language: T[number] | undefined,
    isExact: boolean,
  ): ReadonlyArray<MultilingualStringEntry> {
    const candidateLanguages: Array<T[number] | undefined> = isExact
      ? [language]
      : [language, this._options.defaultLanguage, ...this._availableLanguages];

    for (const candidateLanguage of candidateLanguages) {
      if (candidateLanguage == null) {
        continue;
      }

      const entries = this._content[candidateLanguage] ?? [];
      if (entries.length > 0) {
        return entries;
      }
    }

    return [];
  }

  private resolvePrimaryEntry(
    language: T[number] | undefined,
    isExact: boolean,
  ): MultilingualStringEntry | null {
    const entries = this.resolveEntries(language, isExact);
    for (const entry of entries) {
      if (entry.isPrimary) {
        return entry;
      }
    }

    return entries[0] ?? null;
  }

  /**
   * Get text in a specific language, falling back when it has none
   */
  getText(language?: T[number]): string {
    return this.resolvePrimaryEntry(language, false)?.text ?? "";
  }

  /**
   * Get rich text in a specific language, falling back when it has none
   */
  getRichText(language?: T[number]): string {
    return this.resolvePrimaryEntry(language, false)?.richText ?? "";
  }

  /**
   * Get text in a specific language, with no fallback
   */
  getExactText(language: T[number]): string {
    return this.resolvePrimaryEntry(language, true)?.text ?? "";
  }

  /**
   * Get rich text in a specific language, with no fallback
   */
  getExactRichText(language: T[number]): string {
    return this.resolvePrimaryEntry(language, true)?.richText ?? "";
  }

  /**
   * Get every entry for a specific language, with no fallback
   */
  getExactEntries(language: T[number]): Array<MultilingualStringEntry> {
    return Array.from(this.resolveEntries(language, true), (entry) => ({
      ...entry,
    }));
  }

  /**
   * Get every entry for a language, falling back when it has none
   *
   * The multi-entry counterpart of {@link MultilingualString.getText}: OCHRE
   * can carry several entries for one language, and this returns all of them
   * rather than only the primary. Each entry carries both `text` and
   * `richText`, so a caller rendering a rich field reads them from here.
   * @param language - The language to read, or undefined for the default
   * @returns The entries, or an empty array when no language has any
   */
  getEntries(language?: T[number]): Array<MultilingualStringEntry> {
    return Array.from(this.resolveEntries(language, false), (entry) => ({
      ...entry,
    }));
  }

  /**
   * Get the text of every entry for a language, falling back when it has none
   * @param language - The language to read, or undefined for the default
   * @returns The texts, or an empty array when no language has any
   */
  getTexts(language?: T[number]): Array<string> {
    return Array.from(
      this.resolveEntries(language, false),
      (entry) => entry.text,
    );
  }

  /**
   * Get the text of every entry for a language, with no fallback
   * @param language - The language to read
   * @returns The texts, or an empty array when that language has none
   */
  getExactTexts(language: T[number]): Array<string> {
    return Array.from(
      this.resolveEntries(language, true),
      (entry) => entry.text,
    );
  }

  /**
   * Get the alias values OCHRE carries as `zxx` content
   */
  getAliases(): Array<string> {
    return [...this._aliases];
  }

  /**
   * Get the languages that actually carry content
   */
  getAvailableLanguages(): Array<T[number]> {
    return [...this._availableLanguages];
  }

  /**
   * Get the language reads fall back to before trying the rest
   */
  getDefaultLanguage(): T[number] {
    return this._options.defaultLanguage;
  }

  /**
   * Get every language this string was built to hold
   *
   * The configured language list, which is not the same question as
   * {@link MultilingualString.getAvailableLanguages}: that one answers which
   * languages actually carry content, and is a subset of this.
   * @returns The supported languages
   */
  getSupportedLanguages(): Array<T[number]> {
    return [...this._options.availableLanguages] as Array<T[number]>;
  }

  /**
   * Whether any language carries an entry
   *
   * Answers the structural question. A language whose only entry is blank
   * still counts here; {@link MultilingualString.hasContent} is the question
   * about text. Aliases are not entries, so a string carrying only aliases is
   * empty by this measure and {@link MultilingualString.hasAliases} is true.
   * @returns True when no language carries an entry
   */
  isEmpty(): boolean {
    return this._availableLanguages.length === 0;
  }

  /**
   * Whether any entry in any language carries text that is not whitespace
   *
   * Deliberately not the negation of {@link MultilingualString.isEmpty}, which
   * only asks whether entries exist. OCHRE does serve fields holding a single
   * whitespace entry, so a caller deciding whether to render something wants
   * this one, and it looks at every entry rather than only the primary.
   * @returns True when some entry has non-whitespace text
   */
  hasContent(): boolean {
    for (const language of this._availableLanguages) {
      const entries = this._content[language] ?? [];
      for (const entry of entries) {
        if (entry.text.trim() !== "") {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Whether a specific language carries an entry, with no fallback
   * @param language - The language to test
   * @returns True when that language carries at least one entry
   */
  hasLanguage(language: T[number]): boolean {
    return (this._content[language]?.length ?? 0) > 0;
  }

  /**
   * Whether OCHRE carried any `zxx` alias values for this string
   * @returns True when there is at least one alias
   */
  hasAliases(): boolean {
    return this._aliases.length > 0;
  }

  /**
   * Set the text for a language, or append another entry to it
   * @param language - The language to write
   * @param text - The text to write
   * @param options - Write options
   * @param options.shouldAppend - Append as an additional entry instead of replacing
   * @returns A new multilingual string
   */
  with(
    language: T[number],
    text: MultilingualStringInput,
    options: { shouldAppend?: boolean } = {},
  ): MultilingualString<T> {
    const newContent = cloneContent(this._content);
    newContent[language] =
      options.shouldAppend === true
        ? normalizePrimary([
            ...(newContent[language] ?? []),
            { ...normalizeInputText(text), isPrimary: false },
          ])
        : entriesFromTexts([text]);

    return MultilingualString.fromNormalized(
      newContent,
      this._options,
      getLanguagesWithEntries(
        newContent,
        this._options.availableLanguages as ReadonlyArray<T[number]>,
      ),
    );
  }

  /**
   * Remove the content for a language
   *
   * When the removed language was the default, the default moves to the first
   * language that still has content, so reads keep resolving.
   * @param language - The language to remove
   * @returns A new multilingual string
   */
  without(language: T[number]): MultilingualString<T> {
    const currentContent = cloneContent(this._content);
    const newContent: Partial<
      Record<T[number], Array<MultilingualStringEntry>>
    > = {};
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

    return MultilingualString.fromNormalized(
      newContent,
      {
        ...this._options,
        defaultLanguage:
          this._options.defaultLanguage === language
            ? resolveDefaultLanguageOption(
                newAvailableLanguages,
                this._options.availableLanguages,
              )
            : this._options.defaultLanguage,
      },
      newAvailableLanguages,
    );
  }

  /**
   * Replace the alias values
   *
   * Aliases are the `zxx` content OCHRE carries alongside a field's languages,
   * so they are set as a whole rather than per language. Empty strings are
   * dropped, matching how they are read from a payload.
   * @param aliases - The aliases to carry
   * @returns A new multilingual string
   */
  withAliases(aliases: ReadonlyArray<string>): MultilingualString<T> {
    return MultilingualString.fromNormalized(
      cloneContent(this._content),
      { ...this._options, aliases: normalizeAliases(aliases) },
      this._availableLanguages,
    );
  }

  /**
   * Transform the text of every entry in every language
   *
   * Replaces the old `map`, which corrupted rich text: it wrote the
   * transformed plain text and left the entry's `richText` to be re-derived,
   * so a transform such as uppercasing turned `<InternalLink uuid="abc">` into
   * markup OCHRE never wrote. The transform here runs against plain text only,
   * and the entry's rich text is rebuilt from the result, so the two can never
   * disagree.
   *
   * A transform that needs to keep or rewrite markup returns
   * `{ text, richText }` instead of a string, and both are used verbatim.
   * @param transform - Produces the new text for one entry
   * @returns A new multilingual string
   */
  mapText(
    transform: (text: string, language: T[number]) => MultilingualStringInput,
  ): MultilingualString<T> {
    const newContent: Partial<
      Record<T[number], Array<MultilingualStringEntry>>
    > = {};

    for (const language of this._availableLanguages) {
      const currentEntries = this._content[language] ?? [];
      newContent[language] = normalizePrimary(
        Array.from(currentEntries, (entry) => ({
          ...normalizeInputText(transform(entry.text, language)),
          isPrimary: entry.isPrimary,
        })),
      );
    }

    return MultilingualString.fromNormalized(
      newContent,
      this._options,
      this._availableLanguages,
    );
  }

  /**
   * Keep only the entries a predicate accepts
   *
   * The callback receives the whole entry rather than just its text, so it
   * can also test `richText` and `isPrimary`. Dropping every entry of a
   * language removes that language, and when that was the default the default
   * moves to the first language that still has content, so reads keep
   * resolving.
   * @param shouldKeep - Whether to keep one entry
   * @returns A new multilingual string
   */
  filterEntries(
    shouldKeep: (
      entry: MultilingualStringEntry,
      language: T[number],
    ) => boolean,
  ): MultilingualString<T> {
    const newContent: Partial<
      Record<T[number], Array<MultilingualStringEntry>>
    > = {};

    for (const language of this._availableLanguages) {
      const currentEntries = this._content[language] ?? [];
      const entries: Array<MultilingualStringEntry> = [];
      for (const entry of currentEntries) {
        if (shouldKeep({ ...entry }, language)) {
          entries.push({ ...entry });
        }
      }
      newContent[language] = normalizePrimary(entries);
    }

    const newAvailableLanguages = getLanguagesWithEntries(
      newContent,
      this._options.availableLanguages as ReadonlyArray<T[number]>,
    );

    return MultilingualString.fromNormalized(
      newContent,
      {
        ...this._options,
        defaultLanguage: newAvailableLanguages.includes(
          this._options.defaultLanguage as T[number],
        )
          ? this._options.defaultLanguage
          : resolveDefaultLanguageOption(
              newAvailableLanguages,
              this._options.availableLanguages,
            ),
      },
      newAvailableLanguages,
    );
  }

  /**
   * Get the string representation, using the default language
   */
  toString(): string {
    return this.getText();
  }

  /**
   * Get the JSON representation
   *
   * Carries `defaultLanguage`, because it is not derivable from the content:
   * without it {@link MultilingualString.fromJSON} would fall back to the first
   * available language and `getText()` would resolve differently.
   */
  toJSON(): MultilingualStringJSON<T> {
    const content: Partial<Record<T[number], Array<MultilingualStringEntry>>> =
      {};
    for (const language of this._availableLanguages) {
      content[language] = this.getExactEntries(language);
    }

    return {
      content,
      aliases: this.getAliases(),
      defaultLanguage: this._options.defaultLanguage,
    };
  }
}
