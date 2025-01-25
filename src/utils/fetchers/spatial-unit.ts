import type { Data, SpatialUnit } from "../../types/main.js";
import { fetchByUuid } from "../fetchers/generic.js";
import { parseMetadata, parseSpatialUnit } from "../parse.js";
import { parseFakeString } from "../string.js";

/**
 * Fetches and parses a spatial unit from the OCHRE API
 *
 * @param uuid - The UUID of the spatial unit to fetch
 * @returns Object containing the parsed spatial unit and its metadata, or null if the fetch/parse fails
 *
 * @example
 * ```ts
 * const result = await fetchSpatialUnit("123e4567-e89b-12d3-a456-426614174000");
 * if (result === null) {
 *   console.error("Failed to fetch spatial unit");
 *   return;
 * }
 * const { metadata, item } = result;
 * console.log(`Fetched spatial unit: ${item.identification.label}`);
 * if (item.coordinates) {
 *   console.log(`Location: ${item.coordinates.latitude}, ${item.coordinates.longitude}`);
 * }
 * ```
 *
 * @remarks
 * The returned spatial unit includes:
 * - Full spatial unit metadata
 * - Geographic coordinates
 * - Observations and events
 * - Associated images
 * - Context information
 * - License details
 */
export async function fetchSpatialUnit(uuid: string) {
  try {
    const [error, dataRaw] = await fetchByUuid(uuid);
    if (error !== null) {
      throw new Error(error);
    }

    if (!("spatialUnit" in dataRaw.ochre)) {
      throw new Error(
        "Invalid OCHRE data: API response missing 'spatialUnit' key",
      );
    }

    const spatialUnitItem = parseSpatialUnit(dataRaw.ochre.spatialUnit);

    const data: Omit<Data, "item"> & { item: SpatialUnit } = {
      uuid: parseFakeString(dataRaw.ochre.uuid),
      publicationDateTime: new Date(dataRaw.ochre.publicationDateTime),
      belongsTo: {
        uuid: dataRaw.ochre.uuidBelongsTo,
        abbreviation: parseFakeString(dataRaw.ochre.belongsTo),
      },
      metadata: parseMetadata(dataRaw.ochre.metadata),
      item: spatialUnitItem as SpatialUnit,
    };

    return { metadata: data.metadata, spatialUnit: data.item };
  } catch (error) {
    console.error(error);
    return null;
  }
}
