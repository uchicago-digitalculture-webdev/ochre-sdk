import type { Data, Metadata, PropertyValue } from "../../types/main.js";
import { parseMetadata, parsePropertyValue } from "../parse.js";
import { parseFakeString } from "../string.js";
import { fetchByUuid } from "./generic.js";

/**
 * Fetches and parses a property value from the OCHRE API
 *
 * @param uuid - The UUID of the property value to fetch
 * @returns Object containing the parsed property value and its metadata, or null if the fetch/parse fails
 *
 * @example
 * ```ts
 * const result = await fetchPropertyValue("123e4567-e89b-12d3-a456-426614174000");
 * if (result === null) {
 *   console.error("Failed to fetch property value");
 *   return;
 * }
 * const { metadata, item } = result;
 * console.log(`Fetched property value: ${item.identification.label}`);
 * ```
 *
 * @remarks
 * The returned property value includes:
 * - Identification
 * - Description
 * - Notes
 * - Links
 */
export async function fetchPropertyValue(uuid: string): Promise<{
  metadata: Metadata;
  propertyValue: PropertyValue;
} | null> {
  try {
    const [error, dataRaw] = await fetchByUuid(uuid);
    if (error !== null) {
      throw new Error(error);
    }

    if (!("propertyValue" in dataRaw.ochre)) {
      throw new Error(
        "Invalid OCHRE data: API response missing 'propertyValue' key",
      );
    }

    const propertyValueItem = parsePropertyValue(dataRaw.ochre.propertyValue);

    const data: Omit<Data, "item"> & { item: PropertyValue } = {
      uuid: parseFakeString(dataRaw.ochre.uuid),
      publicationDateTime: new Date(dataRaw.ochre.publicationDateTime),
      belongsTo: {
        uuid: dataRaw.ochre.uuidBelongsTo,
        abbreviation: parseFakeString(dataRaw.ochre.belongsTo),
      },
      metadata: parseMetadata(dataRaw.ochre.metadata),
      item: propertyValueItem as PropertyValue,
    };

    return { metadata: data.metadata, propertyValue: data.item };
  } catch (error) {
    console.error(error);
    return null;
  }
}
