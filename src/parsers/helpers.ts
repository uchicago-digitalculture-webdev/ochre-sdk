import type { License } from "#/types/index.js";
import type { XMLContent, XMLString } from "#/xml/types.js";
import { DEFAULT_LANGUAGES } from "#/constants.js";
import { MultilingualString } from "#/parsers/multilingual.js";
import { parseXMLContent, parseXMLString } from "#/parsers/string.js";

export type FetchFunction = (
  input: string | URL | globalThis.Request,
  init?: RequestInit,
) => Promise<Response>;

export type FetchBaseOptions<
  TLanguages extends ReadonlyArray<string> | undefined = undefined,
> = {
  languages?: TLanguages;
  /**
   * Fetch only this language of every multilingual field, instead of every
   * language OCHRE holds. A field without it keeps its `fallbackLanguage`
   * content, else its content in any language; aliases are always kept.
   */
  language?: string;
  /**
   * The language shown for fields that have no `language` content, typically
   * the website's default language (defaults to `"eng"`)
   */
  fallbackLanguage?: string;
  fetch?: FetchFunction;
  signal?: AbortSignal;
  timeoutMilliseconds?: number;
};

export type FetchRuntimeOptions = FetchBaseOptions<ReadonlyArray<string>>;

export type FetchLanguages<
  TLanguages extends ReadonlyArray<string> | undefined,
> = TLanguages extends readonly []
  ? ReadonlyArray<string>
  : TLanguages extends ReadonlyArray<string>
    ? TLanguages
    : ReadonlyArray<string>;

export type ParserOptions<T extends ReadonlyArray<string>> = {
  languages: T;
  /**
   * The language the dataset declares as its default
   *
   * Threaded into every {@link MultilingualString} so a read with no language
   * resolves to the dataset's default rather than whichever language happens to
   * come first in the payload.
   */
  defaultLanguage?: T[number];
};

const FALLBACK_PARSER_OPTIONS: ParserOptions<ReadonlyArray<string>> = {
  languages: DEFAULT_LANGUAGES,
};

export function getParserOptions<T extends ReadonlyArray<string>>(
  options: ParserOptions<T>,
): ParserOptions<T> {
  return {
    languages: options.languages,
    defaultLanguage: options.defaultLanguage,
  };
}

/**
 * Drop the keys whose value is undefined
 *
 * Constrained to `object` rather than `Record<string, unknown>`, which an
 * interface never satisfies for want of an index signature. `Object.entries`
 * cannot be typed precisely, so the one cast that costs is here rather than at
 * the call site.
 * @param object - The object to clean
 * @returns A copy carrying only the defined keys
 */
export function cleanObject<T extends object>(object: T): Partial<T> {
  const entries = Object.entries(object) as Array<[keyof T, T[keyof T]]>;
  const cleaned: Partial<T> = {};
  for (const [key, value] of entries) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }

  return cleaned;
}

export function parseLicense(
  availability: { license: XMLString & { target?: string } } | undefined,
): License | null {
  if (availability == null) {
    return null;
  }

  return {
    content: parseStringLike(availability.license) ?? "",
    target: availability.license.target ?? null,
  };
}

export function parseStringLike(
  value: XMLString | string | undefined,
): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return parseXMLString(value).text;
}

export function isXMLContent(
  value: XMLContent | XMLString,
): value is XMLContent {
  return "content" in value;
}

export function multilingualFromText<T extends ReadonlyArray<string>>(
  text: string | { text: string; richText: string },
  options: ParserOptions<T>,
): MultilingualString<T> {
  const content: Partial<
    Record<T[number], string | { text: string; richText: string }>
  > = {};
  for (const language of options.languages) {
    content[language as T[number]] = text;
  }

  return MultilingualString.fromObject(content, options.languages, {
    defaultLanguage: options.defaultLanguage,
  });
}

export function parseContentLike<T extends ReadonlyArray<string>>(
  value: XMLContent | XMLString | string | undefined,
  options: ParserOptions<T>,
): MultilingualString<T> | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    return multilingualFromText(value, options);
  }

  if (!isXMLContent(value)) {
    return multilingualFromText(parseXMLString(value), options);
  }

  return parseXMLContent<T>(value, {
    languages: options.languages,
    defaultLanguage: options.defaultLanguage,
  });
}

export function parseRequiredContentLike<T extends ReadonlyArray<string>>(
  value: XMLContent | XMLString,
  options: ParserOptions<T>,
): MultilingualString<T> {
  return (
    parseContentLike(value, options) ??
    MultilingualString.empty(options.languages, {
      defaultLanguage: options.defaultLanguage,
    })
  );
}

export function parseContentLikeText<T extends ReadonlyArray<string>>(
  value: XMLContent | XMLString | undefined,
  options: ParserOptions<T>,
): string {
  const content = parseContentLike(value, options);
  return content?.getText(content.getDefaultLanguage()).trim() ?? "";
}

export function parseStringContent(
  value: XMLContent | XMLString | string | undefined,
  options: ParserOptions<ReadonlyArray<string>> = FALLBACK_PARSER_OPTIONS,
): string {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (isXMLContent(value)) {
    const content = parseXMLContent(value, {
      languages: options.languages,
      defaultLanguage: options.defaultLanguage,
    });
    return content.getText(content.getDefaultLanguage());
  }

  return parseXMLString(value).text;
}
