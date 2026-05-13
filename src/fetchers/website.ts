import { XMLParser } from "fast-xml-parser";
import * as v from "valibot";
import type { LanguageCodes } from "#/types/index.js";
import type { Website } from "#/types/website.js";
import { XML_PARSER_OPTIONS } from "#/constants.js";
import { parseWebsite } from "#/parsers/website/index.js";
import { logIssues } from "#/utils.js";
import { restoreXMLMetadata } from "#/xml/metadata.js";
import { XMLWebsiteData as XMLWebsiteDataSchema } from "#/xml/schemas.js";

type FetchFunction = (
  input: string | URL | globalThis.Request,
  init?: RequestInit,
) => Promise<Response>;

/**
 * Fetches and parses a website configuration from the OCHRE API
 *
 * @param abbreviation - The abbreviation identifier for the website
 * @returns The parsed website configuration or null if the fetch/parse fails
 */
export async function fetchWebsite<
  const T extends LanguageCodes = LanguageCodes,
>(
  abbreviation: string,
  options?: { fetch?: FetchFunction; languages?: T },
): Promise<
  { website: Website<T>; error: null } | { website: null; error: string }
> {
  try {
    const cleanAbbreviation = abbreviation.trim().toLocaleLowerCase("en-US");

    const response = await (options?.fetch ?? fetch)(
      `https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?xquery=${encodeURIComponent(`collection('ochre/tree')/ochre[tree/identification/abbreviation/content/string='${cleanAbbreviation}']`)}&xsl=none&lang="*"`,
    );
    if (!response.ok) {
      throw new Error("Failed to fetch website");
    }

    const dataRaw = await response.text();

    const parser = new XMLParser(XML_PARSER_OPTIONS);
    const data = parser.parse(dataRaw) as unknown;

    const { success, issues, output } = v.safeParse(XMLWebsiteDataSchema, data);
    if (!success) {
      logIssues(issues);
      throw new Error("Failed to parse website XML");
    }
    restoreXMLMetadata(output, data);

    const website = parseWebsite(output, { languages: options?.languages });

    return { website, error: null };
  } catch (error) {
    console.error(error);
    return {
      website: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
