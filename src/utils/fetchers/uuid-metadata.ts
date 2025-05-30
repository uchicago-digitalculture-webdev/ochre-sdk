import type { UuidMetadataResponse } from "../../types/internal.raw.js";
import type { UuidMetadata } from "../../types/main.js";
import { uuidSchema } from "../../schemas.js";
import { parseIdentification } from "../parse.js";

/**
 * Fetches raw OCHRE metadata by UUID from the OCHRE API
 *
 * @param uuid - The UUID of the OCHRE item to fetch
 * @returns An object containing the OCHRE metadata or an error message
 *
 * @example
 * ```ts
 * const { item, error } = await fetchByUuidMetadata("123e4567-e89b-12d3-a456-426614174000");
 * if (error !== null) {
 *   console.error(`Failed to fetch: ${error}`);
 *   return;
 * }
 * // Process data...
 * ```
 */
export async function fetchByUuidMetadata(
  uuid: string,
  customFetch?: (
    input: string | URL | globalThis.Request,
    init?: RequestInit,
  ) => Promise<Response>,
): Promise<{ item: UuidMetadata | null; error: string | null }> {
  try {
    const parsedUuid = uuidSchema.parse(uuid);

    const response = await (customFetch ?? fetch)(
      `https://ochre.lib.uchicago.edu/ochre?xquery=${encodeURIComponent(`for $q in input()/ochre[@uuid='${parsedUuid}']/metadata return ($q/item, $q/project)`)}&format=json`,
    );
    if (!response.ok) {
      throw new Error("Failed to fetch metadata");
    }

    const data = (await response.json()) as UuidMetadataResponse;

    const baseProjectIdentification = parseIdentification(
      data.result.project.identification,
    );
    const projectIdentification = {
      ...baseProjectIdentification,
      website: data.result.project.identification.website ?? null,
    };

    const uuidMetadata: UuidMetadata = {
      item: {
        uuid,
        name: parseIdentification(data.result.item.identification).label,
        type: data.result.item.type,
      },
      project: {
        name: projectIdentification.label,
        website: projectIdentification.website ?? null,
      },
    };

    return { item: uuidMetadata, error: null };
  } catch (error) {
    return {
      item: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
