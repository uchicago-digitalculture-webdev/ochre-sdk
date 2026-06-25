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
> = { languages?: TLanguages; fetch?: FetchFunction };

export type FetchRuntimeOptions = FetchBaseOptions<ReadonlyArray<string>>;

export type FetchLanguages<
  TLanguages extends ReadonlyArray<string> | undefined,
> = TLanguages extends readonly []
  ? ReadonlyArray<string>
  : TLanguages extends ReadonlyArray<string>
    ? TLanguages
    : ReadonlyArray<string>;

export type ParserOptions<T extends ReadonlyArray<string>> = { languages: T };

const FALLBACK_PARSER_OPTIONS: ParserOptions<ReadonlyArray<string>> = {
  languages: DEFAULT_LANGUAGES,
};

export function getParserOptions<T extends ReadonlyArray<string>>(
  options: ParserOptions<T>,
): ParserOptions<T> {
  return { languages: options.languages };
}

export function cleanObject<T extends Record<string, unknown>>(
  object: T,
): Partial<T> {
  const cleaned: Partial<T> = {};
  for (const [key, value] of Object.entries(object)) {
    if (value !== undefined) {
      cleaned[key as keyof T] = value as T[keyof T];
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

  return MultilingualString.fromObject(content, options.languages);
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

  return parseXMLContent<T>(value, { languages: options.languages });
}

export function parseRequiredContentLike<T extends ReadonlyArray<string>>(
  value: XMLContent | XMLString,
  options: ParserOptions<T>,
): MultilingualString<T> {
  return (
    parseContentLike(value, options) ??
    MultilingualString.empty(options.languages)
  );
}

export function parseContentLikeText<T extends ReadonlyArray<string>>(
  value: XMLContent | XMLString | undefined,
  options: ParserOptions<T>,
): string {
  return parseContentLike(value, options)?.getText().trim() ?? "";
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
    return parseXMLContent(value, { languages: options.languages }).getText();
  }

  return parseXMLString(value).text;
}
