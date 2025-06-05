import type { XMLData as XMLDataType } from "../../types/xml.types.js";
import { writeFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";
import * as v from "valibot";
import { uuidSchema } from "../../schemas.js";
import { XMLData } from "../../types/xml.raw.js";
import { XML_ARRAY_TAGS } from "../constants.js";

function logIssues(
  issues: ReturnType<typeof v.safeParse>["issues"],
  depth = 0,
) {
  if (issues == null) {
    return;
  }

  for (const issue of issues) {
    console.error("\t".repeat(depth), issue.message);
    if (issue.issues != null && issue.issues.length > 0) {
      logIssues(issue.issues, depth + 1);
    }
  }
}

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
): Promise<[null, XMLDataType] | [string, null]> {
  try {
    const parsedUuid = uuidSchema.parse(uuid);

    const response = await (options?.fetch ?? fetch)(
      `https://ochre.lib.uchicago.edu/ochre?uuid=${parsedUuid}&xsl=none&lang="*"`,
    );
    if (!response.ok) {
      throw new Error("Failed to fetch OCHRE data");
    }

    const dataRaw = await response.text();

    const parser = new XMLParser({
      alwaysCreateTextNode: true,
      ignoreAttributes: false,
      removeNSPrefix: true,
      ignorePiTags: true,
      trimValues: false,
      parseTagValue: false,
      parseAttributeValue: false,
      attributeNamePrefix: "",
      textNodeName: "text",
      stopNodes: ["*.referenceFormatDiv", "*.citationFormatSpan"],
      htmlEntities: true,
      isArray(tagName, jPath, isLeafNode, isAttribute) {
        if (isAttribute) {
          return false;
        }

        if (XML_ARRAY_TAGS.includes(tagName)) {
          return true;
        }

        return false;
      },
      attributeValueProcessor: (attrName, attrValue) => {
        if (attrValue.startsWith("xs:")) {
          return attrValue.replace("xs:", "");
        }

        return null;
      },
    });

    const data = parser.parse(dataRaw) as unknown;
    writeFileSync("data.json", JSON.stringify(data, null, 2));

    const { success, issues, output } = v.safeParse(XMLData, data);
    if (!success) {
      logIssues(issues);
      throw new Error("Failed to parse OCHRE data");
    }

    return [null, output];
  } catch (error) {
    console.error(error);
    return [error instanceof Error ? error.message : "Unknown error", null];
  }
}
