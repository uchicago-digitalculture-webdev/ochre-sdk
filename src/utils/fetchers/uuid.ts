import type { ApiVersion } from "../../types/index.js";
import type { RawData, RawDataResponse } from "../../types/raw.js";
import { uuidSchema } from "../../schemas.js";
import { DEFAULT_API_VERSION } from "../helpers.js";

/**
 * Fetches raw OCHRE data by UUID from the OCHRE API
 *
 * @param uuid - The UUID of the OCHRE item to fetch
 * @returns A tuple containing either [null, OchreData] on success or [error message, null] on failure
 * @internal
 */
export async function fetchByUuid(
  uuid: string,
  options?: {
    fetch?: (
      input: string | URL | globalThis.Request,
      init?: RequestInit,
    ) => Promise<Response>;
    version?: ApiVersion;
  },
): Promise<[null, RawData] | [string, null]> {
  try {
    const version = options?.version ?? DEFAULT_API_VERSION;

    const parsedUuid = uuidSchema.parse(uuid);

    const response = await (options?.fetch ?? fetch)(
      version === 2 ?
        `https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?uuid=${parsedUuid}&format=json&lang="*"`
      : `https://ochre.lib.uchicago.edu/ochre?uuid=${parsedUuid}&format=json&lang="*"`,
    );
    if (!response.ok) {
      throw new Error("Failed to fetch OCHRE data");
    }
    const dataRaw = (await response.json()) as RawDataResponse;
    if (
      (version === 2 &&
        (!("result" in dataRaw) || !("ochre" in dataRaw.result))) ||
      (version !== 2 && !("ochre" in dataRaw))
    ) {
      throw new Error("Invalid OCHRE data: API response missing 'ochre' key");
    }

    return [
      null,
      (
        "result" in dataRaw &&
        !Array.isArray(dataRaw.result) &&
        "ochre" in dataRaw.result
      ) ?
        dataRaw.result
      : "ochre" in dataRaw ? dataRaw
      : (null as never),
    ];
  } catch (error) {
    return [error instanceof Error ? error.message : "Unknown error", null];
  }
}
