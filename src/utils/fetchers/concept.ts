import type { Concept, Data } from "../../types/main.js";
import { fetchByUuid } from "../fetchers/generic.js";
import { parseConcept, parseMetadata } from "../parse.js";
import { parseFakeString } from "../string.js";

/**
 * Fetches and parses a concept from the OCHRE API
 *
 * @param uuid - The UUID of the concept to fetch
 * @returns Object containing the parsed concept and its metadata, or null if the fetch/parse fails
 *
 * @example
 * ```ts
 * const result = await fetchConcept("123e4567-e89b-12d3-a456-426614174000");
 * if (result === null) {
 *   console.error("Failed to fetch concept");
 *   return;
 * }
 * const { metadata, item } = result;
 * console.log(`Fetched concept: ${item.identification.label}`);
 * ```
 *
 * @remarks
 * The returned concept includes:
 * - Full concept metadata
 * - Interpretations and their properties
 * - Context information
 * - License details
 */
export async function fetchConcept(uuid: string) {
  try {
    const [error, dataRaw] = await fetchByUuid(uuid);
    if (error !== null) {
      throw new Error(error);
    }

    if (!("concept" in dataRaw.ochre)) {
      throw new Error("Invalid OCHRE data: API response missing 'concept' key");
    }

    const conceptItem = parseConcept(dataRaw.ochre.concept);

    const data: Omit<Data, "item"> & { item: Concept } = {
      uuid: parseFakeString(dataRaw.ochre.uuid),
      publicationDateTime: new Date(dataRaw.ochre.publicationDateTime),
      belongsTo: {
        uuid: dataRaw.ochre.uuidBelongsTo,
        abbreviation: parseFakeString(dataRaw.ochre.belongsTo),
      },
      metadata: parseMetadata(dataRaw.ochre.metadata),
      item: conceptItem as Concept,
    };

    return { metadata: data.metadata, concept: data.item };
  } catch (error) {
    console.error(error);
    return null;
  }
}
