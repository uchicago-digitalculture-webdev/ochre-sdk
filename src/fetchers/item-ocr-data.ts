/* eslint-disable unicorn/no-incorrect-template-string-interpolation */
import { XMLParser } from "fast-xml-parser";
import * as v from "valibot";
import type { OcrString } from "#/types/index.js";
import { XML_PARSER_OPTIONS } from "#/constants.js";
import { itemOcrDataParametersSchema } from "#/schemas.js";
import {
  createSchemaValidationError,
  getErrorOutput,
  stringLiteral,
} from "#/utilities.js";

const OCR_STRING_VERTEX_REGEX =
  /\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g;

/**
 * Schema for a single matched OCR string in the OCHRE API response
 */
const ocrStringSchema = v.object({
  resourceUuid: v.optional(v.string(), ""),
  content: v.optional(v.string(), ""),
  x: v.optional(v.string(), ""),
  y: v.optional(v.string(), ""),
  width: v.optional(v.string(), ""),
  height: v.optional(v.string(), ""),
  vertices: v.optional(v.string(), ""),
});

/**
 * Schema for the item OCR data OCHRE API response
 */
const responseSchema = v.object({
  result: v.object({
    ochre: v.object({
      ocrStrings: v.object({
        found: v.optional(v.string(), "false"),
        ocrString: v.optional(
          v.union([v.array(ocrStringSchema), ocrStringSchema]),
        ),
      }),
    }),
  }),
});

function getSearchTerms(parameters: {
  value: string;
  isCaseSensitive: boolean;
}): Array<string> {
  const { value, isCaseSensitive } = parameters;
  const terms: Array<string> = [];

  for (const term of value.split(/\s+/u)) {
    if (term !== "") {
      terms.push(isCaseSensitive ? term : term.toLocaleLowerCase("en-US"));
    }
  }

  return terms;
}

function parseOcrStringNumber(value: string): number | null {
  const trimmedValue = value.trim();

  if (trimmedValue === "") {
    return null;
  }

  const numericValue = Number(trimmedValue);

  return Number.isFinite(numericValue) ? numericValue : null;
}

function parseOcrStringVertices(
  value: string,
): Array<{ x: number; y: number }> {
  const vertices: Array<{ x: number; y: number }> = [];

  for (const match of value.matchAll(OCR_STRING_VERTEX_REGEX)) {
    const x = Number(match[1]);
    const y = Number(match[2]);

    if (Number.isFinite(x) && Number.isFinite(y)) {
      vertices.push({ x, y });
    }
  }

  return vertices;
}

/**
 * Build an XQuery string to fetch matching OCR strings from the OCHRE API
 *
 * The `<ocr>` layer is marked supplemental, so it is deliberately read without
 * the supplemental stripping the other fetchers apply. Word nodes are projected
 * at any depth, because OCHRE does not guarantee the shape of the surrounding
 * hierarchy.
 *
 * Both the container and the word nodes are matched on a case-folded
 * `local-name()` rather than a name test, because OCHRE varies the casing of
 * these elements and may serve them in a namespace. A plain `//ocr//string`
 * name test silently matches nothing in either of those cases.
 *
 * The matches are wrapped in an `<ocrStrings>` element rather than returned
 * directly under `<ochre>`: the API collapses an `<ochre>` element that has no
 * element children down to a bare `<ochre/>`, which would drop the `found`
 * flag and make "no such item" indistinguishable from "no matches".
 * @param parameters - The parameters for the fetch
 * @param parameters.uuid - The UUID of the OCHRE item to read the OCR layer of
 * @param parameters.terms - The whitespace-separated search terms to match against, already lowercased for case-insensitive matching
 * @param parameters.matchMode - Whether a term has to be contained in a string's content or equal it
 * @param parameters.isCaseSensitive - Whether matching is case sensitive
 * @returns An XQuery string
 */
function buildXQuery(parameters: {
  uuid: string;
  terms: Array<string>;
  matchMode: "includes" | "exact";
  isCaseSensitive: boolean;
}): string {
  const { uuid, terms, matchMode, isCaseSensitive } = parameters;

  const termValues = terms.map((term) => stringLiteral(term));
  const contentExpression = isCaseSensitive
    ? "string($string/@CONTENT)"
    : "lower-case(string($string/@CONTENT))";
  const matchExpression =
    matchMode === "exact"
      ? `normalize-space(${contentExpression}) = $term`
      : `contains(${contentExpression}, $term)`;

  return `xquery version "1.0-ml";

declare variable $terms := (${termValues.join(", ")});

let $ochre := doc(${stringLiteral(uuid)})/ochre
let $ocrStrings :=
  for $string in $ochre//*[lower-case(local-name(.)) = "ocr"]//*[lower-case(local-name(.)) = "string"][@CONTENT]
  where (some $term in $terms satisfies ${matchExpression})
  return <ocrString
    resourceUuid="{string($string/ancestor::*[local-name(.) = "resource"][1]/@uuid)}"
    content="{string($string/@CONTENT)}"
    x="{string($string/@HPOS)}"
    y="{string($string/@VPOS)}"
    width="{string($string/@WIDTH)}"
    height="{string($string/@HEIGHT)}"
    vertices="{string($string/@VERTICES)}"/>

return <ochre><ocrStrings found="{exists($ochre)}">{$ocrStrings}</ocrStrings></ochre>`;
}

/**
 * Fetches and parses the OCR strings of an OCHRE item that match a search value
 *
 * Resources may carry an `<ocr>` layer whose internal hierarchy is irregular
 * and therefore not parsed. Only its word nodes are returned, wherever they
 * occur in that subtree, in document order. A word node is any element whose
 * name is `string` in any casing and any namespace, and matching reads its
 * `CONTENT` attribute rather than its text content.
 *
 * Each word node holds a single OCR word, so a multi-word search value is split
 * on whitespace and a node is returned when it matches any one term. Nested
 * child Resources are searched too, with `resourceUuid` naming the Resource
 * each match belongs to.
 *
 * @param uuid - The UUID of the OCHRE item to read the OCR layer of
 * @param value - The search value to match against each OCR string's content
 * @param options - Options for the fetch
 * @param options.matchMode - Whether a term has to be contained in a string's content ("includes", the default) or equal it ("exact")
 * @param options.isCaseSensitive - Whether matching is case sensitive, defaulting to false
 * @param options.fetch - The fetch function to use
 * @returns The matching OCR strings, an empty array when the item has no OCR
 * layer or nothing matches, and a null output on fetch/parse errors
 */
export async function fetchItemOcrData(
  uuid: string,
  value: string,
  options?: {
    matchMode?: "includes" | "exact";
    isCaseSensitive?: boolean;
    fetch?: (
      input: string | URL | globalThis.Request,
      init?: RequestInit,
    ) => Promise<Response>;
  },
): Promise<
  | { ocrStrings: Array<OcrString>; error: null; detailedError: null }
  | { ocrStrings: null; error: string; detailedError: string }
> {
  try {
    const parameters = v.parse(itemOcrDataParametersSchema, {
      uuid,
      value,
      matchMode: options?.matchMode,
      isCaseSensitive: options?.isCaseSensitive,
    });
    const terms = getSearchTerms({
      value: parameters.value,
      isCaseSensitive: parameters.isCaseSensitive,
    });

    const xquery = buildXQuery({
      uuid: parameters.uuid,
      terms,
      matchMode: parameters.matchMode,
      isCaseSensitive: parameters.isCaseSensitive,
    });

    const response = await (options?.fetch ?? fetch)(
      'https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?xquery&xsl=none&lang="*"',
      {
        method: "POST",
        body: xquery,
        headers: { "Content-Type": "application/xquery" },
      },
    );
    if (!response.ok) {
      throw new Error(`OCHRE API responded with status: ${response.status}`, {
        cause: response.statusText,
      });
    }

    const dataRaw = await response.text();
    const parser = new XMLParser(XML_PARSER_OPTIONS);
    const data = parser.parse(dataRaw) as unknown;

    const { success, issues, output } = v.safeParse(responseSchema, data);
    if (!success) {
      throw createSchemaValidationError(
        "Failed to parse OCHRE item OCR data",
        issues,
      );
    }

    const { found, ocrString } = output.result.ochre.ocrStrings;

    if (found !== "true") {
      throw new Error(`No OCHRE item found for UUID: ${parameters.uuid}`, {
        cause: parameters.uuid,
      });
    }

    const parsedOcrStrings =
      ocrString == null
        ? []
        : Array.isArray(ocrString)
          ? ocrString
          : [ocrString];
    const ocrStrings: Array<OcrString> = Array.from(
      parsedOcrStrings,
      (parsedOcrString) => ({
        resourceUuid:
          parsedOcrString.resourceUuid !== ""
            ? parsedOcrString.resourceUuid
            : null,
        content: parsedOcrString.content,
        x: parseOcrStringNumber(parsedOcrString.x),
        y: parseOcrStringNumber(parsedOcrString.y),
        width: parseOcrStringNumber(parsedOcrString.width),
        height: parseOcrStringNumber(parsedOcrString.height),
        vertices: parseOcrStringVertices(parsedOcrString.vertices),
      }),
    );

    return { ocrStrings, error: null, detailedError: null };
  } catch (error) {
    return {
      ocrStrings: null,
      ...getErrorOutput(error, "Failed to fetch item OCR data"),
    };
  }
}
