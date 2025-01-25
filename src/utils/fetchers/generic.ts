import type { OchreData } from "../../types/internal.raw.d.ts";
import { z } from "zod";

const uuidSchema = z.string().uuid({ message: "Invalid UUID provided" });

/**
 * Fetches raw OCHRE data by UUID from the OCHRE API
 *
 * @param uuid - The UUID of the OCHRE item to fetch
 * @returns A tuple containing either [null, OchreData] on success or [error message, null] on failure
 *
 * @example
 * ```ts
 * const [error, data] = await fetchByUuid("123e4567-e89b-12d3-a456-426614174000");
 * if (error !== null) {
 *   console.error(`Failed to fetch: ${error}`);
 *   return;
 * }
 * // Process data...
 * ```
 *
 * @internal
 */
export async function fetchByUuid(
  uuid: string,
): Promise<[null, OchreData] | [string, null]> {
  try {
    const result = uuidSchema.safeParse(uuid);
    if (!result.success) {
      throw new Error(result.error.issues[0]?.message);
    }

    const response = await fetch(
      `https://ochre.lib.uchicago.edu/ochre?uuid=${uuid}&format=json&lang="*"`,
    );
    if (!response.ok) {
      throw new Error("Failed to fetch OCHRE data");
    }
    const dataRaw = (await response.json()) as OchreData;
    if (!("ochre" in dataRaw)) {
      throw new Error("Invalid OCHRE data: API response missing 'ochre' key");
    }

    return [null, dataRaw];
  } catch (error) {
    return [error instanceof Error ? error.message : "Unknown error", null];
  }
}
