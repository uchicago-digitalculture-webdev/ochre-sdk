import type { Data, Set } from "../../types/main.js";
import { fetchByUuid } from "../fetchers/generic.js";
import { parseMetadata, parseSet } from "../parse.js";
import { parseFakeString } from "../string.js";

/**
 * Fetches and parses a set from the OCHRE API
 *
 * @param uuid - The UUID of the set to fetch
 * @returns Object containing the parsed set and its metadata, or null if the fetch/parse fails
 *
 * @example
 * ```ts
 * const result = await fetchSet("123e4567-e89b-12d3-a456-426614174000");
 * if (result === null) {
 *   console.error("Failed to fetch set");
 *   return;
 * }
 * const { metadata, item } = result;
 * console.log(`Fetched set: ${item.identification.label}`);
 * console.log(`Contains ${item.items.resources.length.toLocaleString()} resources`);
 * ```
 *
 * @remarks
 * The returned set includes:
 * - Full set metadata
 * - Nested resources, spatial units, and concepts
 * - Creator information
 * - Description and type information
 * - License details
 */
export async function fetchSet(uuid: string) {
  try {
    const [error, dataRaw] = await fetchByUuid(uuid);
    if (error !== null) {
      throw new Error(error);
    }

    if (!("set" in dataRaw.ochre)) {
      throw new Error("Invalid OCHRE data: API response missing 'set' key");
    }

    const setItem = parseSet(dataRaw.ochre.set);

    const data: Omit<Data, "item"> & { item: Set } = {
      uuid: parseFakeString(dataRaw.ochre.uuid),
      publicationDateTime: new Date(dataRaw.ochre.publicationDateTime),
      belongsTo: {
        uuid: dataRaw.ochre.uuidBelongsTo,
        abbreviation: parseFakeString(dataRaw.ochre.belongsTo),
      },
      metadata: parseMetadata(dataRaw.ochre.metadata),
      item: setItem,
    };

    return { metadata: data.metadata, set: data.item };
  } catch (error) {
    console.error(error);
    return null;
  }
}
