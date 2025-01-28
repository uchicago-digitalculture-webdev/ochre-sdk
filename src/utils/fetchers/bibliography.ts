import type { Bibliography, Data } from "../../types/main.js";
import { parseBibliography, parseMetadata } from "../parse.js";
import { parseFakeString } from "../string.js";
import { fetchByUuid } from "./generic.js";

/**
 * Fetches and parses a bibliography from the OCHRE API
 *
 * @param uuid - The UUID of the bibliography to fetch
 * @returns Object containing the parsed bibliography and its metadata, or null if the fetch/parse fails
 *
 * @example
 * ```ts
 * const result = await fetchBibliography("123e4567-e89b-12d3-a456-426614174000");
 * if (result === null) {
 *   console.error("Failed to fetch bibliography");
 *   return;
 * }
 * const { metadata, item } = result;
 * console.log(`Fetched bibliography: ${item.identification.label}`);
 * ```
 *
 * @remarks
 * The returned bibliography includes:
 * - Full bibliography metadata
 * - Citation and reference information
 * - Publication information
 * - Source information
 * - Author information
 * - Properties
 */
export async function fetchBibliography(uuid: string) {
  try {
    const [error, dataRaw] = await fetchByUuid(uuid);
    if (error !== null) {
      throw new Error(error);
    }

    if (!("bibliography" in dataRaw.ochre)) {
      throw new Error(
        "Invalid OCHRE data: API response missing 'bibliography' key",
      );
    }

    const bibliographyItem = parseBibliography(dataRaw.ochre.bibliography);

    const data: Omit<Data, "item"> & { item: Bibliography } = {
      uuid: parseFakeString(dataRaw.ochre.uuid),
      publicationDateTime: new Date(dataRaw.ochre.publicationDateTime),
      belongsTo: {
        uuid: dataRaw.ochre.uuidBelongsTo,
        abbreviation: parseFakeString(dataRaw.ochre.belongsTo),
      },
      metadata: parseMetadata(dataRaw.ochre.metadata),
      item: bibliographyItem as Bibliography,
    };

    return { metadata: data.metadata, bibliography: data.item };
  } catch (error) {
    console.error(error);
    return null;
  }
}
