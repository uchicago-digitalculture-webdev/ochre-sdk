import * as v from "valibot";
import type { XMLMetadata } from "#/xml/types.js";
import { DEFAULT_LANGUAGES } from "#/constants.js";
import { parseStringLike } from "#/parsers/helpers.js";
import { iso639_3Schema } from "#/schemas.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null;
}

function collectContentLanguages(value: unknown, languages: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectContentLanguages(item, languages);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const content = value.content;
  if (Array.isArray(content)) {
    for (const contentItem of content) {
      if (!isRecord(contentItem)) {
        continue;
      }

      const language = contentItem.lang;
      if (typeof language === "string" && language !== "zxx") {
        languages.add(language);
      }
    }
  }

  for (const child of Object.values(value)) {
    collectContentLanguages(child, languages);
  }
}

/**
 * Validate language codes while preserving literal tuple inference
 * @param languages - The language codes to validate
 * @returns The same tuple, with its literal types intact
 * @internal
 */
export function parseLanguages<const T extends ReadonlyArray<string>>(
  languages: T,
): T {
  for (const language of languages) {
    v.parse(iso639_3Schema, language);
  }

  return languages;
}

/**
 * Define a reusable languages tuple with validation and literal type inference
 *
 * Inline arrays can be passed directly to a fetcher
 * (`fetchItem(uuid, { languages: ["eng", "spa"] })`); use this when the
 * language set is stored separately.
 * @param languages - The language codes to validate
 * @returns The same tuple, with its literal types intact
 */
export function defineLanguages<const TLanguages extends ReadonlyArray<string>>(
  ...languages: TLanguages
): TLanguages {
  return parseLanguages(languages);
}

/**
 * Validate an optional caller-supplied language tuple
 * @param languages - The language codes to validate, or undefined
 * @returns The validated codes, or an empty array when none were requested
 * @internal
 */
export function parseRequestedLanguages(
  languages: ReadonlyArray<string> | undefined,
): ReadonlyArray<string> {
  return languages == null ? [] : parseLanguages(languages);
}

/**
 * Resolve which languages to parse from the content of a payload
 *
 * Requested languages win. Otherwise every `content/@xml:lang` found anywhere
 * beneath the node is used, falling back to {@link DEFAULT_LANGUAGES} when the
 * payload carries no tagged content at all.
 * @param node - The payload node to walk
 * @param requestedLanguages - The languages the caller asked for
 * @returns The languages to parse
 * @internal
 */
export function resolveContentLanguages(
  node: unknown,
  requestedLanguages: ReadonlyArray<string>,
): ReadonlyArray<string> {
  if (requestedLanguages.length > 0) {
    return requestedLanguages;
  }

  const languages = new Set<string>();
  collectContentLanguages(node, languages);

  return languages.size > 0 ? [...languages] : [...DEFAULT_LANGUAGES];
}

/**
 * Read the languages a dataset declares in its metadata
 * @param rawOchre - The raw OCHRE payload root
 * @param rawOchre.metadata - The payload metadata declaring the languages
 * @param rawOchre.languages - The semicolon-separated fallback language list
 * @returns The declared languages, falling back to {@link DEFAULT_LANGUAGES}
 * @internal
 */
export function parseMetadataLanguages(rawOchre: {
  metadata: XMLMetadata;
  languages?: string;
}): Array<string> {
  const languages: Array<string> = [];

  const metadataLanguages = rawOchre.metadata.language ?? [];
  for (const language of metadataLanguages) {
    const parsedLanguage = parseStringLike(language);
    if (parsedLanguage != null) {
      languages.push(parsedLanguage);
    }
  }

  if (languages.length > 0) {
    return languages;
  }

  if (rawOchre.languages != null) {
    for (const language of rawOchre.languages.split(";")) {
      if (language !== "") {
        languages.push(language);
      }
    }
  }

  return languages.length > 0 ? languages : [...DEFAULT_LANGUAGES];
}

/**
 * Reconcile requested languages against the ones a dataset declares
 * @param requestedLanguages - The languages the caller asked for
 * @param metadataLanguages - The languages the dataset declares
 * @returns The languages to parse
 * @throws When a requested language is not offered by the dataset
 * @internal
 */
export function resolveLanguages<T extends ReadonlyArray<string>>(
  requestedLanguages: T | undefined,
  metadataLanguages: Array<string>,
): T {
  if (requestedLanguages == null || requestedLanguages.length === 0) {
    const resolvedLanguages: unknown = metadataLanguages;
    return resolvedLanguages as T;
  }

  const unsupportedLanguages: Array<string> = [];
  for (const requestedLanguage of requestedLanguages) {
    const isSupported = metadataLanguages.some(
      (metadataLanguage) =>
        metadataLanguage.toLocaleLowerCase("en-US") ===
        requestedLanguage.toLocaleLowerCase("en-US"),
    );
    if (!isSupported) {
      unsupportedLanguages.push(requestedLanguage);
    }
  }

  if (unsupportedLanguages.length > 0) {
    throw new Error(
      `The following language(s) are not supported by the dataset: ${unsupportedLanguages
        .toSorted((a, b) => a.localeCompare(b, "en-US"))
        .join(", ")}. Available languages: ${metadataLanguages
        .toSorted((a, b) => a.localeCompare(b, "en-US"))
        .join(", ")}`,
      { cause: unsupportedLanguages },
    );
  }

  return requestedLanguages;
}

/**
 * Pick the language a dataset treats as its default
 * @param rawOchre - The raw OCHRE payload root
 * @param rawOchre.metadata - The payload metadata declaring the default
 * @param languages - The languages being parsed
 * @returns The default language
 * @throws When `languages` is empty
 * @internal
 */
export function resolveDefaultLanguage<T extends ReadonlyArray<string>>(
  rawOchre: { metadata: XMLMetadata },
  languages: T,
): T[number] {
  const metadataLanguages = rawOchre.metadata.language ?? [];
  for (const language of metadataLanguages) {
    const parsedLanguage = parseStringLike(language);
    if (
      parsedLanguage != null &&
      language.default === "true" &&
      languages.includes(parsedLanguage)
    ) {
      return parsedLanguage;
    }
  }

  for (const language of languages) {
    if (language === DEFAULT_LANGUAGES[0]) {
      return language;
    }
  }

  const firstLanguage = languages[0];
  if (firstLanguage == null) {
    throw new Error("Default language not found", { cause: languages });
  }

  return firstLanguage;
}
