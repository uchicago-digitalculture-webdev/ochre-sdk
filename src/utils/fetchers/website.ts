import type { ApiVersion } from "../../types/index.js";
import type { RawData, RawMetadata, RawTree } from "../../types/raw.js";
import type { Website } from "../../types/website.js";
import { apiVersionSuffixSchema } from "../../schemas.js";
import { DEFAULT_API_VERSION } from "../helpers.js";
import { parseWebsite } from "../parse/website.js";
import { parseFakeString } from "../string.js";

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

  const result = apiVersionSuffixSchema.safeParse(abbreviation.slice(-3));
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
 */
export async function fetchWebsite(
  abbreviation: string,
  options?: {
    fetch?: (
      input: string | URL | globalThis.Request,
      init?: RequestInit,
    ) => Promise<Response>;
    version?: ApiVersion;
  },
): Promise<
  { error: null; website: Website } | { error: string; website: null }
> {
  try {
    const cleanAbbreviation = abbreviation.trim().toLocaleLowerCase("en-US");

    const { abbreviation: parsedAbbreviation, version: parsedVersion } =
      parseApiVersionSuffix(cleanAbbreviation);

    const abbreviationToUse =
      options?.version != null ? cleanAbbreviation : parsedAbbreviation;
    const version = options?.version ?? parsedVersion;

    let metadata: RawMetadata | null = null;
    let tree: RawTree | null = null;
    let belongsTo: { uuid: string; abbreviation: string } | null = null;

    if (version === 2) {
      const response = await (options?.fetch ?? fetch)(
        `https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?xquery=${encodeURIComponent(`collection('ochre/tree')/ochre[tree/identification/abbreviation/content/string='${abbreviationToUse}']`)}&format=json&lang="*"`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch website");
      }

      const data = (await response.json()) as
        | { result: RawData }
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
      const response = await (options?.fetch ?? fetch)(
        `https://ochre.lib.uchicago.edu/ochre?xquery=${encodeURIComponent(`for $q in input()/ochre[tree[@type='lesson'][identification/abbreviation='${abbreviationToUse}']] return $q`)}&format=json`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch website");
      }

      const data = (await response.json()) as
        | RawData
        | { result: RawData | [] };

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

    return { error: null, website };
  } catch (error) {
    console.error(error);
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      website: null,
    };
  }
}
