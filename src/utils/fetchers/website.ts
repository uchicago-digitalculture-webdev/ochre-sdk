import type { OchreData } from "../../types/internal.raw.d.ts";
import { parseIdentification, parseWebsite } from "../parse.js";

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
export async function fetchWebsite(abbreviation: string) {
  try {
    const response = await fetch(
      `https://ochre.lib.uchicago.edu/ochre?xquery=for $q in input()/ochre[tree[@type='lesson'][identification/abbreviation='${abbreviation.toLocaleLowerCase("en-US")}']] return $q&format=json`,
    );
    if (!response.ok) {
      throw new Error("Failed to fetch website");
    }

    const data = (await response.json()) as {
      result: OchreData | [];
    };

    if (!("ochre" in data.result) || !("tree" in data.result.ochre)) {
      throw new Error("Failed to fetch website");
    }

    const projectIdentification =
      data.result.ochre.metadata.project?.identification ?
        parseIdentification(data.result.ochre.metadata.project.identification)
      : null;

    const website = await parseWebsite(
      data.result.ochre.tree,
      projectIdentification?.label ?? "",
      data.result.ochre.metadata.project?.identification.website ?? null,
    );

    return website;
  } catch (error) {
    console.error(error);
    return null;
  }
}
