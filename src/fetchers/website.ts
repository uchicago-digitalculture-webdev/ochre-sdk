import type { XMLWebsiteData } from "../types/xml/types.js";
import { XMLParser } from "fast-xml-parser";
import * as v from "valibot";
import { XML_PARSER_OPTIONS } from "../constants.js";
import { XMLWebsiteData as XMLWebsiteDataSchema } from "../types/xml/schemas.js";
import { logIssues } from "../utils.js";

/**
 * Fetches raw OCHRE website data by abbreviation from the OCHRE API
 *
 * @param abbreviation - The abbreviation of the OCHRE item to fetch
 * @param options - Optional options object
 * @param options.fetch - Custom fetch function to use instead of the default fetch
 * @returns A tuple containing either [null, OchreData] on success or [error message, null] on failure
 *
 * @example
 * ```ts
 * const [error, data] = await fetchWebsite("idalion");
 * if (error !== null) {
 *   console.error(`Failed to fetch: ${error}`);
 *   return;
 * }
 * // Process data...
 * ```
 */
export async function fetchWebsite(
  abbreviation: string,
  options?: {
    fetch?: (
      input: string | URL | globalThis.Request,
      init?: RequestInit,
    ) => Promise<Response>;
  },
): Promise<
  { data: XMLWebsiteData; error: null } | { data: null; error: string }
> {
  try {
    const response = await (options?.fetch ?? fetch)(
      `https://ochre.lib.uchicago.edu/ochre?xquery=${encodeURIComponent(`for $q in input()/ochre[tree[@type='lesson'][identification/abbreviation='${abbreviation.toLocaleLowerCase("en-US")}']] return $q`)}&xsl=none&lang="*"`,
    );
    if (!response.ok) {
      throw new Error("Failed to fetch OCHRE website data");
    }

    const dataRaw = await response.text();

    const parser = new XMLParser(XML_PARSER_OPTIONS);

    const data = parser.parse(dataRaw) as unknown;

    const { success, issues, output } = v.safeParse(XMLWebsiteDataSchema, data);
    if (!success) {
      logIssues(issues);
      throw new Error("Failed to parse OCHRE website data");
    }

    return { data: output, error: null };
  } catch (error) {
    console.error(error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
