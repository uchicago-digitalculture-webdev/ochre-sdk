import type {
  OchreData,
  OchreMetadata,
  OchreTree,
} from "../../types/internal.raw.d.ts";
import type { ApiVersion, Website } from "../../types/main.js";
import { apiVersionSuffixSchema } from "../../schemas.js";
import { DEFAULT_API_VERSION } from "../helpers.js";
import { parseWebsite } from "../parse.js";
import { parseFakeString } from "../string.js";

const KNOWN_ABBREVIATIONS: Readonly<Record<string, string>> = {
  "uchicago-node": "60a1e386-7e53-4e14-b8cf-fb4ed953d57e",
  "uchicago-node-staging": "62b60a47-fad5-49d7-a06a-2fa059f6e79a",
  "guerrilla-television": "fad1e1bd-989d-4159-b195-4c32adc5cdc7",
  "mapping-chicagoland": "8db5e83e-0c06-48b7-b4ac-a060d9bb5689",
  "hannah-papanek": "20b2c919-021f-4774-b2c3-2f1ae5b910e7",
  mepa: "85ddaa5a-535b-4809-8714-855d2d812a3e",
  ssmc: "8ff977dd-d440-40f5-ad93-8ad7e2d39e74",
  "sosc-core-at-smart": "db26c953-9b2a-4691-a909-5e8726b531d7",
};

/**
 * Parses the version suffix from an API abbreviation
 *
 * @param abbreviation - The API abbreviation to parse
 * @returns The parsed abbreviation and API version
 */
function parseApiVersionSuffix(abbreviation: string): {
  abbreviation: string;
  version: ApiVersion;
} {
  if (!/-v\d+$/.test(abbreviation)) {
    return { abbreviation, version: DEFAULT_API_VERSION };
  }

  const result = apiVersionSuffixSchema.safeParse(abbreviation);
  if (!result.success) {
    throw new Error("Invalid API version suffix");
  }

  return {
    abbreviation: abbreviation.replace(`-v${result.data}`, ""),
    version: result.data,
  };
}

/**
 * Fetches and parses a website configuration from the OCHRE API
 *
 * @param abbreviation - The abbreviation identifier for the website
 * @returns The parsed website configuration or null if the fetch/parse fails
 *
 * @example
 * ```ts
 * const website = await fetchWebsite("guerrilla-television");
 * if (website === null) {
 *   console.error("Failed to fetch website");
 *   return;
 * }
 * console.log(`Fetched website: ${website.identification.label}`);
 * console.log(`Contains ${website.pages.length.toLocaleString()} pages`);
 * ```
 *
 * @remarks
 * The returned website configuration includes:
 * - Website metadata and identification
 * - Page structure and content
 * - Layout and styling properties
 * - Navigation configuration
 * - Sidebar elements
 * - Project information
 * - Creator details
 *
 * The abbreviation is case-insensitive and should match the website's configured abbreviation in OCHRE.
 */
export async function fetchWebsite(
  abbreviation: string,
  options?: {
    customFetch?: (
      input: string | URL | globalThis.Request,
      init?: RequestInit,
    ) => Promise<Response>;
    version: ApiVersion;
  },
): Promise<[null, Website] | [string, null]> {
  try {
    const cleanAbbreviation = abbreviation.trim().toLocaleLowerCase("en-US");

    const customFetch = options?.customFetch;
    const { abbreviation: parsedAbbreviation, version: parsedVersion } =
      parseApiVersionSuffix(cleanAbbreviation);

    const abbreviationToUse =
      options?.version != null ? cleanAbbreviation : parsedAbbreviation;
    const version = options?.version ?? parsedVersion;

    let metadata: OchreMetadata | null = null;
    let tree: OchreTree | null = null;
    let belongsTo: { uuid: string; abbreviation: string } | null = null;

    if (version === 2) {
      const response = await (customFetch ?? fetch)(
        `https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?xquery=${encodeURIComponent(`collection('ochre/tree')/ochre[tree/identification/abbreviation/content/string='${abbreviationToUse}']`)}&format=json&lang="*"`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch website");
      }

      const data = (await response.json()) as
        | { result: OchreData }
        | { result: [] };

      if (Array.isArray(data.result) || !("tree" in data.result.ochre)) {
        throw new Error("Failed to fetch website");
      }

      metadata = data.result.ochre.metadata;
      tree = data.result.ochre.tree;
      belongsTo = {
        uuid: data.result.ochre.uuidBelongsTo,
        abbreviation: parseFakeString(data.result.ochre.belongsTo),
      };
    } else {
      const uuid = KNOWN_ABBREVIATIONS[abbreviationToUse];

      const response = await (customFetch ?? fetch)(
        uuid != null ?
          `https://ochre.lib.uchicago.edu/ochre?uuid=${uuid}&format=json`
        : `https://ochre.lib.uchicago.edu/ochre?xquery=${encodeURIComponent(`for $q in input()/ochre[tree[@type='lesson'][identification/abbreviation='${abbreviationToUse}']] return $q`)}&format=json`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch website");
      }

      const data = (await response.json()) as
        | OchreData
        | { result: OchreData | [] };

      const result =
        "result" in data && !Array.isArray(data.result) ? data.result
        : !("result" in data) ? data
        : null;

      if (result == null || !("tree" in result.ochre)) {
        throw new Error("Failed to fetch website");
      }

      metadata = result.ochre.metadata;
      tree = result.ochre.tree;
      belongsTo = {
        uuid: result.ochre.uuidBelongsTo,
        abbreviation: parseFakeString(result.ochre.belongsTo),
      };
    }

    const website = parseWebsite(tree, metadata, belongsTo, { version });

    return [null, website];
  } catch (error) {
    console.error(error);
    return [error instanceof Error ? error.message : "Unknown error", null];
  }
}
