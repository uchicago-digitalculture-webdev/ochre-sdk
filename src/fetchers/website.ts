import type { OchreRequestOptions } from "#/fetchers/request.js";
import type { LanguageCodes } from "#/types/index.js";
import type { ProtectedWebsite, Website } from "#/types/website.js";
import { isOchreJsonAccepted, requestOchre } from "#/fetchers/request.js";
import { parseLanguages } from "#/parsers/languages.js";
import { parseWebsite } from "#/parsers/website/index.js";
import {
  getErrorOutput,
  omitSupplemental,
  stringLiteral,
  SUPPLEMENTAL_XQUERY_PROLOG,
} from "#/utilities.js";
import { XMLWebsiteData as XMLWebsiteDataSchema } from "#/xml/schemas.js";

async function areWebsiteCredentialsValid(
  uuid: string,
  credentials: string | { username: string; password: string },
  options: OchreRequestOptions | undefined,
): Promise<boolean> {
  const security =
    typeof credentials === "string"
      ? { validate: credentials }
      : { validate: credentials.password, userOCHRE: credentials.username };

  return isOchreJsonAccepted({
    body: { uuid, data: { security } },
    label: "website credentials",
    options,
  });
}

/**
 * Build an XQuery string to fetch a website tree document by abbreviation.
 *
 * @param abbreviation - The lowercased website abbreviation to match
 * @returns An XQuery string
 */
function buildXQuery(abbreviation: string): string {
  return `xquery version "1.0-ml";

${SUPPLEMENTAL_XQUERY_PROLOG}

for $ochre in collection("ochre/tree")/ochre[tree/identification/abbreviation/content/string = ${stringLiteral(abbreviation)}]
return element ochre { $ochre/@*, ${omitSupplemental("$ochre/node()")} }`;
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
  options?: OchreRequestOptions & {
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
    const cleanAbbreviation = abbreviation.trim().toLocaleLowerCase("en-US");
    const languages =
      options?.languages == null
        ? undefined
        : parseLanguages(options.languages);

    const output = await requestOchre({
      xquery: buildXQuery(cleanAbbreviation),
      schema: XMLWebsiteDataSchema,
      label: "OCHRE website",
      options,
    });

    const website = parseWebsite(output, { languages });

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

      const isValid = await areWebsiteCredentialsValid(
        website.uuid,
        options.credentials,
        options,
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
