import type { XMLWebsiteData } from "../../types/xml.types.js";
import { writeFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";
import * as v from "valibot";
import { XMLWebsiteData as XMLWebsiteDataSchema } from "../../types/xml.raw.js";
import { XML_ARRAY_TAGS } from "../constants.js";
import { logIssues } from "../helpers.js";

/**
 * Fetches raw OCHRE website data by abbreviation from the OCHRE API
 *
 * @param abbreviation - The abbreviation of the OCHRE item to fetch
 * @param options - Optional options object
 * @param options.fetch - Custom fetch function to use instead of the default fetch
 * @returns A tuple containing either [null, OchreData] on success or [error message, null] on failure
 *
 * @example
 * ```ts
 * const [error, data] = await fetchWebsite("idalion");
 * if (error !== null) {
 *   console.error(`Failed to fetch: ${error}`);
 *   return;
 * }
 * // Process data...
 * ```
 */
export async function fetchWebsite(
  abbreviation: string,
  options?: {
    fetch?: (
      input: string | URL | globalThis.Request,
      init?: RequestInit,
    ) => Promise<Response>;
  },
): Promise<[null, XMLWebsiteData] | [string, null]> {
  try {
    const response = await (options?.fetch ?? fetch)(
      `https://ochre.lib.uchicago.edu/ochre?xquery=${encodeURIComponent(`for $q in input()/ochre[tree[@type='lesson'][identification/abbreviation='${abbreviation.toLocaleLowerCase("en-US")}']] return $q`)}&xsl=none&lang="*"`,
    );
    if (!response.ok) {
      throw new Error("Failed to fetch OCHRE website data");
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

    const { success, issues, output } = v.safeParse(XMLWebsiteDataSchema, data);
    if (!success) {
      logIssues(issues);
      throw new Error("Failed to parse OCHRE website data");
    }

    return [null, output];
  } catch (error) {
    console.error(error);
    return [error instanceof Error ? error.message : "Unknown error", null];
  }
}
