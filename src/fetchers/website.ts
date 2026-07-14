import { XMLParser } from "fast-xml-parser";
import * as v from "valibot";
import type { FetchFunction } from "#/parsers/helpers.js";
import type { LanguageCodes } from "#/types/index.js";
import type { ProtectedWebsite, Website } from "#/types/website.js";
import { XML_PARSER_OPTIONS } from "#/constants.js";
import { parseWebsite } from "#/parsers/website/index.js";
import { createSchemaValidationError, getErrorOutput } from "#/utilities.js";
import { restoreXMLMetadata } from "#/xml/metadata.js";
import { XMLWebsiteData as XMLWebsiteDataSchema } from "#/xml/schemas.js";

async function validateWebsiteCredentials(
  uuid: string,
  credentials: string | { username: string; password: string },
  fetcher: FetchFunction,
): Promise<boolean> {
  const security =
    typeof credentials === "string"
      ? { validate: credentials }
      : { validate: credentials.password, userOCHRE: credentials.username };

  const response = await fetcher(
    "https://ochre.lib.uchicago.edu/ochre/v2/ochre.php",
    {
      method: "POST",
      body: JSON.stringify({ uuid, data: { security } }),
      headers: { "Content-Type": "application/json" },
    },
  );

  return response.ok;
}

/**
 * Fetches and parses a website configuration from the OCHRE API.
 *
 * For password-protected or OCHRE-credential-protected websites, if no credentials
 * are provided the function returns a minimal `protectedWebsite` object instead of
 * the full website. Pass `credentials` (a shared password string, or an object with
 * `username` and `password` for OCHRE accounts) to authenticate and receive the full
 * website data.
 */
export async function fetchWebsite<
  const T extends LanguageCodes = LanguageCodes,
>(
  abbreviation: string,
  options?: {
    fetch?: FetchFunction;
    languages?: T;
    credentials?: string | { username: string; password: string };
  },
): Promise<
  | {
      website: Website<T>;
      protectedWebsite: null;
      error: null;
      detailedError: null;
    }
  | {
      website: null;
      protectedWebsite: ProtectedWebsite<T>;
      error: null;
      detailedError: null;
    }
  | {
      website: null;
      protectedWebsite: null;
      error: string;
      detailedError: string;
    }
> {
  try {
    const fetcher = options?.fetch ?? fetch;
    const cleanAbbreviation = abbreviation.trim().toLocaleLowerCase("en-US");

    const response = await fetcher(
      `https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?xquery=${encodeURIComponent(`collection('ochre/tree')/ochre[tree/identification/abbreviation/content/string='${cleanAbbreviation}']`)}&xsl=none&lang="*"`,
    );
    if (!response.ok) {
      throw new Error("Failed to fetch website", {
        cause: response.statusText,
      });
    }

    const dataRaw = await response.text();

    const parser = new XMLParser(XML_PARSER_OPTIONS);
    const data = parser.parse(dataRaw) as unknown;

    const { success, issues, output } = v.safeParse(XMLWebsiteDataSchema, data);
    if (!success) {
      throw createSchemaValidationError("Failed to parse website XML", issues);
    }
    restoreXMLMetadata(output, data);

    const website = parseWebsite(output, { languages: options?.languages });

    if (website.properties.privacy !== "public") {
      if (options?.credentials == null) {
        return {
          website: null,
          protectedWebsite: {
            uuid: website.uuid,
            identification: website.identification,
            properties: { privacy: website.properties.privacy },
          },
          error: null,
          detailedError: null,
        };
      }

      const isValid = await validateWebsiteCredentials(
        website.uuid,
        options.credentials,
        fetcher,
      );
      if (!isValid) {
        throw new Error("Invalid credentials for protected website");
      }
    }

    return {
      website,
      protectedWebsite: null,
      error: null,
      detailedError: null,
    };
  } catch (error) {
    return {
      website: null,
      protectedWebsite: null,
      ...getErrorOutput(error, "Unknown error"),
    };
  }
}
