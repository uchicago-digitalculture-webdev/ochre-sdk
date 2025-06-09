import type { Data, DataCategory, ItemsDataCategory } from "../types/index.js";
import { XMLParser } from "fast-xml-parser";
import * as v from "valibot";
import { XML_PARSER_OPTIONS } from "../constants.js";
import { parseData } from "../parsers/index.js";
import { iso639_3Schema, uuidSchema } from "../schemas.js";
import { XMLData as XMLDataSchema } from "../types/xml/schemas.js";
import { logIssues } from "../utils.js";

/**
 * Branded type to ensure languages have been validated through withLanguages()
 * @internal
 */
export type ValidatedLanguages<T extends ReadonlyArray<string>> = T & {
  readonly __validated: unique symbol;
};

/**
 * Helper function to create a languages array with proper type inference
 * @param languages - Array of language codes
 * @returns The same array with preserved literal types and validation branding
 */
export function withLanguages<const T extends ReadonlyArray<string>>(
  languages: T,
): ValidatedLanguages<T> {
  const parsedLanguages = [];
  for (const language of languages) {
    parsedLanguages.push(v.parse(iso639_3Schema, language));
  }

  return parsedLanguages as unknown as ValidatedLanguages<T>;
}

/**
 * Fetches an OCHRE item by UUID from the OCHRE API
 *
 * @param uuid - The UUID of the OCHRE item to fetch
 * @param options - Optional options object
 * @param options.category - The category of the OCHRE item to fetch
 * @param options.itemCategory - The category of items contained in the OCHRE item to fetch (only used for tree and set)
 * @param options.languages - The languages to use (must be created with withLanguages())
 * @param options.isRichText - Whether to parse the text as rich text
 * @param options.fetch - Custom fetch function to use instead of the default fetch
 * @returns An object containing the parsed data or an error message
 */
export async function fetchItem<
  T extends DataCategory | undefined = undefined,
  U extends T extends "tree" | "set" ? ItemsDataCategory : never = never,
  V extends ValidatedLanguages<ReadonlyArray<string>> | undefined = undefined,
>(
  uuid: string,
  options?: {
    category?: T;
    itemCategory?: U;
    languages?: V;
    isRichText?: boolean;
    fetch?: (
      input: string | URL | globalThis.Request,
      init?: RequestInit,
    ) => Promise<Response>;
  },
): Promise<
  { data: Data<T, U, V>; error: null } | { data: null; error: string }
> {
  try {
    const parsedUuid = v.parse(uuidSchema, uuid);

    const response = await (options?.fetch ?? fetch)(
      `https://ochre.lib.uchicago.edu/ochre?uuid=${parsedUuid}&xsl=none&lang="*"`,
    );
    if (!response.ok) {
      throw new Error("Failed to fetch OCHRE data");
    }

    const dataRaw = await response.text();

    const parser = new XMLParser(XML_PARSER_OPTIONS);

    const data = parser.parse(dataRaw) as unknown;

    const { success, issues, output } = v.safeParse(XMLDataSchema, data);
    if (!success) {
      logIssues(issues);
      throw new Error("Failed to parse OCHRE data");
    }

    const parsedData = parseData(output, {
      category: options?.category,
      itemCategory: options?.itemCategory,
      languages: options?.languages,
      isRichText: options?.isRichText ?? false,
    });

    return { data: parsedData as Data<T, U, V>, error: null };
  } catch (error) {
    console.error(error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
