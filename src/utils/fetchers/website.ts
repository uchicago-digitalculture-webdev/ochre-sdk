import type { OchreData } from "../../types/internal.raw.d.ts";
import type { Website } from "../../types/main.js";
import { parseIdentification, parseWebsite } from "../parse.js";

const KNOWN_ABBREVIATIONS: Record<string, string> = {
  "uchicago-node": "60a1e386-7e53-4e14-b8cf-fb4ed953d57e",
  "uchicago-node-staging": "62b60a47-fad5-49d7-a06a-2fa059f6e79a",
  "guerrilla-television": "fad1e1bd-989d-4159-b195-4c32adc5cdc7",
  "mapping-chicagoland": "8db5e83e-0c06-48b7-b4ac-a060d9bb5689",
  "hannah-papanek": "20b2c919-021f-4774-b2c3-2f1ae5b910e7",
  mepa: "85ddaa5a-535b-4809-8714-855d2d812a3e",
  ssmc: "8ff977dd-d440-40f5-ad93-8ad7e2d39e74",
};

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
  customFetch?: (
    input: string | URL | globalThis.Request,
    init?: RequestInit,
  ) => Promise<Response>,
): Promise<[null, Website] | [string, null]> {
  try {
    const uuid = KNOWN_ABBREVIATIONS[abbreviation.toLocaleLowerCase("en-US")];

    const response = await (customFetch ?? fetch)(
      uuid != null ?
        `https://ochre.lib.uchicago.edu/ochre?uuid=${uuid}&format=json`
      : `https://ochre.lib.uchicago.edu/ochre?xquery=for $q in input()/ochre[tree[@type='lesson'][identification/abbreviation='${abbreviation.toLocaleLowerCase("en-US")}']] return $q&format=json`,
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

    const projectIdentification =
      result.ochre.metadata.project?.identification ?
        parseIdentification(result.ochre.metadata.project.identification)
      : null;

    const website = await parseWebsite(
      result.ochre.tree,
      projectIdentification?.label ?? "",
      result.ochre.metadata.project?.identification.website ?? null,
    );

    return [null, website];
  } catch (error) {
    console.error(error);
    return [error instanceof Error ? error.message : "Unknown error", null];
  }
}
