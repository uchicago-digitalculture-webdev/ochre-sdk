import type { Data, Period } from "../../types/main.js";
import { parseMetadata, parsePeriod } from "../parse.js";
import { parseFakeString } from "../string.js";
import { fetchByUuid } from "./generic.js";

/**
 * Fetches and parses a period from the OCHRE API
 *
 * @param uuid - The UUID of the period to fetch
 * @returns Object containing the parsed period and its metadata, or null if the fetch/parse fails
 *
 * @example
 * ```ts
 * const result = await fetchPeriod("123e4567-e89b-12d3-a456-426614174000");
 * if (result === null) {
 *   console.error("Failed to fetch period");
 *   return;
 * }
 * const { metadata, item } = result;
 * console.log(`Fetched period: ${item.identification.label}`);
 * ```
 *
 * @remarks
 * The returned period includes:
 * - Full period metadata
 * - Identification information
 * - Description
 * - Properties
 */
export async function fetchPeriod(uuid: string) {
  try {
    const [error, dataRaw] = await fetchByUuid(uuid);
    if (error !== null) {
      throw new Error(error);
    }

    if (!("period" in dataRaw.ochre)) {
      throw new Error("Invalid OCHRE data: API response missing 'period' key");
    }

    const periodItem = parsePeriod(dataRaw.ochre.period);

    const data: Omit<Data, "item"> & { item: Period } = {
      uuid: parseFakeString(dataRaw.ochre.uuid),
      publicationDateTime: new Date(dataRaw.ochre.publicationDateTime),
      belongsTo: {
        uuid: dataRaw.ochre.uuidBelongsTo,
        abbreviation: parseFakeString(dataRaw.ochre.belongsTo),
      },
      metadata: parseMetadata(dataRaw.ochre.metadata),
      item: periodItem as Period,
    };

    return { metadata: data.metadata, period: data.item };
  } catch (error) {
    console.error(error);
    return null;
  }
}
