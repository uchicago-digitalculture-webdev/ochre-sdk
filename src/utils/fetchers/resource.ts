import type { Data, Resource } from "../../types/main.js";
import { fetchByUuid } from "../fetchers/generic.js";
import { parseMetadata, parseResource } from "../parse.js";
import { parseFakeString } from "../string.js";

/**
 * Fetches and parses a resource from the OCHRE API
 *
 * @param uuid - The UUID of the resource to fetch
 * @returns Object containing the parsed resource and its metadata, or null if the fetch/parse fails
 *
 * @example
 * ```ts
 * const result = await fetchResource("123e4567-e89b-12d3-a456-426614174000");
 * if (result === null) {
 *   console.error("Failed to fetch resource");
 *   return;
 * }
 * const { metadata, item } = result;
 * console.log(`Fetched resource: ${item.identification.label}`);
 * ```
 *
 * @remarks
 * The returned resource includes:
 * - Full resource metadata
 * - Associated documents and images
 * - Links and reverse links
 * - Creator information
 * - Notes and bibliographic references
 * - Properties and nested resources
 */
export async function fetchResource(uuid: string) {
  try {
    const [error, dataRaw] = await fetchByUuid(uuid);
    if (error !== null) {
      throw new Error(error);
    }

    if (!("resource" in dataRaw.ochre)) {
      throw new Error(
        "Invalid OCHRE data: API response missing 'resource' key",
      );
    }

    const resourceItem = parseResource(dataRaw.ochre.resource);

    const data: Omit<Data, "item"> & { item: Resource } = {
      uuid: parseFakeString(dataRaw.ochre.uuid),
      publicationDateTime: new Date(dataRaw.ochre.publicationDateTime),
      belongsTo: {
        uuid: dataRaw.ochre.uuidBelongsTo,
        abbreviation: parseFakeString(dataRaw.ochre.belongsTo),
      },
      metadata: parseMetadata(dataRaw.ochre.metadata),
      item: resourceItem as Resource,
    };

    return { metadata: data.metadata, resource: data.item };
  } catch (error) {
    console.error(error);
    return null;
  }
}
