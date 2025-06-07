import type { XMLData } from "../types/xml/types.js";
import { XMLParser } from "fast-xml-parser";
import * as v from "valibot";
import { XML_PARSER_OPTIONS } from "../constants.js";
import { uuidSchema } from "../schemas.js";
import { XMLData as XMLDataSchema } from "../types/xml/schemas.js";
import { logIssues } from "../utils.js";

/**
 * Fetches raw OCHRE data by UUID from the OCHRE API
 *
 * @param uuid - The UUID of the OCHRE item to fetch
 * @param options - Optional options object
 * @param options.fetch - Custom fetch function to use instead of the default fetch
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
  options?: {
    fetch?: (
      input: string | URL | globalThis.Request,
      init?: RequestInit,
    ) => Promise<Response>;
  },
): Promise<{ data: XMLData; error: null } | { data: null; error: string }> {
  try {
    const parsedUuid = v.parse(uuidSchema, uuid);

    const response = await (options?.fetch ?? fetch)(
      `https://ochre.lib.uchicago.edu/ochre?uuid=${parsedUuid}&xsl=none&lang="*"`,
    );
    if (!response.ok) {
      throw new Error("Failed to fetch OCHRE data");
    }

    const dataRaw = await response.text();

    const parser = new XMLParser(XML_PARSER_OPTIONS);

    const data = parser.parse(dataRaw) as unknown;

    const { success, issues, output } = v.safeParse(XMLDataSchema, data);
    if (!success) {
      logIssues(issues);
      throw new Error("Failed to parse OCHRE data");
    }

    return { data: output, error: null };
  } catch (error) {
    console.error(error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
