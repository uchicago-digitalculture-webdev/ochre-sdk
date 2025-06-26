import { DEFAULT_LANGUAGES } from "../constants.js";

/**
 * Options for creating and working with multilingual strings
 */
export type MultilingualOptions = {
  /** Whether this string contains rich text/HTML content */
  isRichText?: boolean;
  /** Default language to use for fallbacks */
  defaultLanguage?: string;
  /** Available languages for this string */
  availableLanguages?: ReadonlyArray<string>;
};

/**
 * Type-safe multilingual string that provides autocomplete for specific language arrays
 */
export class MultilingualString<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
> {
  private readonly _content: Readonly<Partial<Record<T[number], string>>>;
  private readonly _options: Required<MultilingualOptions>;
  private readonly _availableLanguages: ReadonlyArray<T[number]>;

  private constructor(
    content: Partial<Record<T[number], string>>,
    options: Required<MultilingualOptions>,
    availableLanguages: ReadonlyArray<T[number]>,
  ) {
    this._content = Object.freeze({ ...content });
    this._options = Object.freeze({ ...options });
    this._availableLanguages = Object.freeze([...availableLanguages]);
  }

  /**
   * Create a new typed multilingual string from an object of language codes to text
   */
  static fromObject<U extends ReadonlyArray<string>>(
    content: Partial<Record<U[number], string>>,
    languages: U,
    options?: MultilingualOptions,
  ): MultilingualString<U>;
  static fromObject(
    content: Partial<Record<string, string>>,
    languages?: undefined,
    options?: MultilingualOptions,
  ): MultilingualString<typeof DEFAULT_LANGUAGES>;
  static fromObject<U extends ReadonlyArray<string>>(
    content: Partial<Record<string, string>>,
    languages?: U,
    options: MultilingualOptions = {},
  ): MultilingualString<U> | MultilingualString<typeof DEFAULT_LANGUAGES> {
    if (languages === undefined) {
      const actualLanguages = DEFAULT_LANGUAGES;
      const availableLanguages = Object.keys(content).filter((lang) =>
        actualLanguages.includes(lang as (typeof DEFAULT_LANGUAGES)[number]),
      ) as Array<(typeof DEFAULT_LANGUAGES)[number]>;

      const defaultOptions: Required<MultilingualOptions> = {
        isRichText: options.isRichText ?? false,
        defaultLanguage:
          options.defaultLanguage ??
          availableLanguages[0] ??
          actualLanguages[0]!,
        availableLanguages: actualLanguages,
      };

      return new MultilingualString(
        content as Partial<Record<(typeof DEFAULT_LANGUAGES)[number], string>>,
        defaultOptions,
        availableLanguages,
      ) as MultilingualString<typeof DEFAULT_LANGUAGES>;
    } else {
      const availableLanguages = Object.keys(content).filter((lang) =>
        languages.includes(lang as U[number]),
      ) as Array<U[number]>;

      const defaultOptions: Required<MultilingualOptions> = {
        isRichText: options.isRichText ?? false,
        defaultLanguage:
          options.defaultLanguage ?? availableLanguages[0] ?? languages[0]!,
        availableLanguages: languages,
      };

      return new MultilingualString(
        content as Partial<Record<U[number], string>>,
        defaultOptions,
        availableLanguages,
      );
    }
  }

  /**
   * Create a new multilingual string with a single language
   */
  static create<U extends ReadonlyArray<string>>(
    language: U[number],
    text: string,
    languages: U,
    options?: MultilingualOptions,
  ): MultilingualString<U>;
  static create(
    language: (typeof DEFAULT_LANGUAGES)[number],
    text: string,
    languages?: undefined,
    options?: MultilingualOptions,
  ): MultilingualString<typeof DEFAULT_LANGUAGES>;
  static create<U extends ReadonlyArray<string>>(
    language: string,
    text: string,
    languages?: U,
    options: MultilingualOptions = {},
  ): MultilingualString<U> | MultilingualString<typeof DEFAULT_LANGUAGES> {
    if (languages === undefined) {
      return MultilingualString.fromObject(
        { [language]: text } as Partial<
          Record<(typeof DEFAULT_LANGUAGES)[number], string>
        >,
        undefined,
        { ...options, defaultLanguage: language },
      );
    } else {
      return MultilingualString.fromObject(
        { [language]: text } as Partial<Record<U[number], string>>,
        languages,
        { ...options, defaultLanguage: language },
      );
    }
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
  ): MultilingualString<typeof DEFAULT_LANGUAGES>;
  static empty<U extends ReadonlyArray<string>>(
    languages?: U,
    options: MultilingualOptions = {},
  ): MultilingualString<U> | MultilingualString<typeof DEFAULT_LANGUAGES> {
    if (languages === undefined) {
      return MultilingualString.fromObject({}, undefined, options);
    } else {
      return MultilingualString.fromObject({}, languages, options);
    }
  }

  /**
   * Get text in a specific language with automatic fallback
   * Provides autocomplete for the exact languages passed to the constructor
   */
  getText(language?: T[number]): string {
    // If no language specified, use default
    if (language == null) {
      const defaultText =
        this._content[this._options.defaultLanguage as T[number]];
      if (defaultText != null) return defaultText;
    }

    // Try the requested language
    if (language != null && this._content[language] != null) {
      return this._content[language]!;
    }

    // Fallback to default language
    const defaultText =
      this._content[this._options.defaultLanguage as T[number]];
    if (defaultText != null) return defaultText;

    // Fallback to first available language
    const firstAvailable = this._availableLanguages.find(
      (lang) => this._content[lang] != null,
    );
    return firstAvailable != null ? this._content[firstAvailable]! : "";
  }

  /**
   * Get text in a specific language without fallback
   * Provides autocomplete for the exact languages passed to the constructor
   */
  getExactText(language: T[number]): string | null {
    return this._content[language] ?? null;
  }

  /**
   * Check if text exists in a specific language
   * Provides autocomplete for the exact languages passed to the constructor
   */
  hasLanguage(language: T[number]): boolean {
    return this._content[language] != null;
  }

  /**
   * Get all available languages (with proper typing)
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
    return Object.values(this._content).some(
      (text) => typeof text === "string" && text.trim().length > 0,
    );
  }

  /**
   * Get the default language
   */
  getDefaultLanguage(): T[number] {
    return this._options.defaultLanguage as T[number];
  }

  /**
   * Check if this string contains rich text
   */
  isRichText(): boolean {
    return this._options.isRichText;
  }

  /**
   * Add or update text for a language (returns new instance)
   */
  withText(language: T[number], text: string): MultilingualString<T> {
    const newContent = { ...this._content, [language]: text };
    const newAvailableLanguages = [
      ...new Set([...this._availableLanguages, language]),
    ] as Array<T[number]>;

    return new MultilingualString(
      newContent,
      this._options,
      newAvailableLanguages,
    );
  }

  /**
   * Remove text for a language (returns new instance)
   */
  withoutLanguage(language: T[number]): MultilingualString<T> {
    const newContent = Object.fromEntries(
      Object.entries(this._content).filter(([key]) => key !== language),
    ) as Partial<Record<T[number], string>>;

    const newAvailableLanguages = this._availableLanguages.filter(
      (lang) => lang !== language,
    );

    const newDefaultLanguage =
      this._options.defaultLanguage === language ?
        (newAvailableLanguages[0] ?? this._options.availableLanguages[0])
      : this._options.defaultLanguage;

    return new MultilingualString(
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
    const newContent: Partial<Record<T[number], string>> = {};
    for (const language of this._availableLanguages) {
      const text = this._content[language];
      if (text != null) {
        newContent[language] = fn(text, language);
      }
    }
    return new MultilingualString(
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
    const newContent: Partial<Record<T[number], string>> = {};
    const newAvailableLanguages: Array<T[number]> = [];

    for (const language of this._availableLanguages) {
      const text = this._content[language];
      if (text != null && predicate(text, language)) {
        newContent[language] = text;
        newAvailableLanguages.push(language);
      }
    }

    const newDefaultLanguage =
      newContent[this._options.defaultLanguage as T[number]] != null ?
        this._options.defaultLanguage
      : (newAvailableLanguages[0] ?? this._options.availableLanguages[0]);

    return new MultilingualString(
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
  toJSON(): Partial<Record<T[number], string>> {
    return { ...this._content };
  }
}
