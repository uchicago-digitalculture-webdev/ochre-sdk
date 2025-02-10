import type { Data, Person } from "../../types/main.js";
import { parseMetadata, parsePerson } from "../parse.js";
import { parseFakeString } from "../string.js";
import { fetchByUuid } from "./generic.js";

/**
 * Fetches and parses a person from the OCHRE API
 *
 * @param uuid - The UUID of the person to fetch
 * @returns Object containing the parsed person and its metadata, or null if the fetch/parse fails
 *
 * @example
 * ```ts
 * const result = await fetchPerson("123e4567-e89b-12d3-a456-426614174000");
 * if (result === null) {
 *   console.error("Failed to fetch person");
 *   return;
 * }
 * const { metadata, item } = result;
 * console.log(`Fetched person: ${item.identification.label}`);
 * ```
 *
 * @remarks
 * The returned person includes:
 * - Full person metadata
 */
export async function fetchPerson(uuid: string) {
  try {
    const [error, dataRaw] = await fetchByUuid(uuid);
    if (error !== null) {
      throw new Error(error);
    }

    if (!("person" in dataRaw.ochre)) {
      throw new Error("Invalid OCHRE data: API response missing 'person' key");
    }

    const personItem = parsePerson(dataRaw.ochre.person);

    const data: Omit<Data, "item"> & { item: Person } = {
      uuid: parseFakeString(dataRaw.ochre.uuid),
      publicationDateTime: new Date(dataRaw.ochre.publicationDateTime),
      belongsTo: {
        uuid: dataRaw.ochre.uuidBelongsTo,
        abbreviation: parseFakeString(dataRaw.ochre.belongsTo),
      },
      metadata: parseMetadata(dataRaw.ochre.metadata),
      item: personItem as Person,
    };

    return { metadata: data.metadata, person: data.item };
  } catch (error) {
    console.error(error);
    return null;
  }
}
