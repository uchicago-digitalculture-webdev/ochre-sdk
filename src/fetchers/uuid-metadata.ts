import type { UuidMetadataResponse } from "../../types/internal.raw.js";
import type { UuidMetadata } from "../../types/website.js";
import * as v from "valibot";
import { uuidSchema } from "../../schemas.js";
import { parseIdentification } from "../parse/old.js";

/**
 * Fetches raw OCHRE metadata by UUID from the OCHRE API
 *
 * @param uuid - The UUID of the OCHRE item to fetch
 * @param options - Optional options object
 * @param options.fetch - Custom fetch function to use instead of the default fetch
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
  options?: {
    fetch?: (
      input: string | URL | globalThis.Request,
      init?: RequestInit,
    ) => Promise<Response>;
  },
): Promise<
  { data: UuidMetadata; error: null } | { data: null; error: string }
> {
  try {
    const parsedUuid = v.parse(uuidSchema, uuid);

    const response = await (options?.fetch ?? fetch)(
      `https://ochre.lib.uchicago.edu/ochre?xquery=${encodeURIComponent(`for $q in input()/ochre[@uuid='${parsedUuid}']/metadata return ($q/item, $q/project)`)}&xsl=none&lang="*"`,
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

    return { data: uuidMetadata, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
