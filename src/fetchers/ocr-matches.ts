/* eslint-disable unicorn/no-incorrect-template-string-interpolation */
import { XMLParser } from "fast-xml-parser";
import * as v from "valibot";
import type { FetchFunction } from "#/parsers/helpers.js";
import type { OcrMatch } from "#/types/index.js";
import { XML_PARSER_OPTIONS } from "#/constants.js";
import { parseOcrMatches } from "#/parsers/index.js";
import { buildOcrTermQueryExpressions } from "#/query.js";
import { ocrMatchesParametersSchema } from "#/schemas.js";
import {
  createSchemaValidationError,
  getErrorOutput,
  stringLiteral,
} from "#/utilities.js";
import { restoreXMLMetadata } from "#/xml/metadata.js";
import { XMLOcrMatchesData as XMLOcrMatchesDataSchema } from "#/xml/schemas.js";

/**
 * Build an XQuery string to fetch OCR match locations from the OCHRE API
 *
 * Each OCR word is matched with `cts:contains` against the same per-term CTS
 * queries the Set item filter compiles, so hit locations always agree with what
 * the filter matched — including stemming and wildcards, which cannot be
 * reproduced outside MarkLogic.
 *
 * @param parameters - The parameters for the fetch
 * @param parameters.uuids - The resource UUIDs to search
 * @param parameters.termQueryExpressions - One CTS query expression per search term, in word order
 * @param parameters.maxMatchesPerItem - The cap on returned matches per requested UUID
 * @returns An XQuery string
 */
function buildXQuery(parameters: {
  uuids: Array<string>;
  termQueryExpressions: Array<string>;
  maxMatchesPerItem: number;
}): string {
  const { uuids, termQueryExpressions, maxMatchesPerItem } = parameters;
  const uuidValues = Array.from(uuids, (uuid) => stringLiteral(uuid));

  return `xquery version "1.0-ml";

declare variable $uuids := (${uuidValues.join(", ")});

declare variable $termQueries := (
  ${termQueryExpressions.join(",\n  ")}
);

declare variable $termCount := ${termQueryExpressions.length};

<ochre>{
  <ocrMatches>{
    for $uuid in $uuids
    let $matches :=
      for $page in doc($uuid)//ocr/Page
      let $words := $page//TextLine/string
      let $wordCount := count($words)
      let $resourceUuid := string($page/ancestor::resource[1]/@uuid)
      for $word at $index in $words
      where $index + $termCount - 1 le $wordCount
        and (every $offset in (1 to $termCount)
             satisfies cts:contains($words[$index + $offset - 1], $termQueries[$offset]))
      return <ocrMatch resourceUuid="{$resourceUuid}">{
        $page/@n, $page/@fileName, $page/@WIDTH, $page/@HEIGHT,
        subsequence($words, $index, $termCount)
      }</ocrMatch>
    return <ocrItem uuid="{$uuid}" matchCount="{count($matches)}">{
      subsequence($matches, 1, ${maxMatchesPerItem})
    }</ocrItem>
  }</ocrMatches>
}</ochre>`;
}

/**
 * Fetches the locations of OCR text matches within OCHRE resources
 *
 * Matching mirrors the `ocr` Set item query target, so the same value and match
 * mode that selected an item will locate its hits. `matchCountsByUuid` reports
 * the untruncated count, which can exceed the returned matches when
 * `maxMatchesPerItem` caps them.
 *
 * @param parameters - The parameters for the fetch
 * @param parameters.uuids - The resource UUIDs to search, typically from a filtered Set item fetch
 * @param parameters.value - The search value
 * @param parameters.matchMode - Whether to match loosely (stemming and wildcards) or on whole OCR words, defaults to "includes"
 * @param parameters.isCaseSensitive - Whether matching is case sensitive, defaults to false
 * @param parameters.maxMatchesPerItem - The cap on returned matches per requested UUID, defaults to 50
 * @param options - Options for the fetch
 * @param options.fetch - The fetch function to use
 * @returns The OCR matches, or null if the fetch/parse fails
 */
export async function fetchOcrMatches(
  parameters: {
    uuids: Array<string>;
    value: string;
    matchMode?: "includes" | "exact";
    isCaseSensitive?: boolean;
    maxMatchesPerItem?: number;
  },
  options?: { fetch?: FetchFunction },
): Promise<
  | {
      matches: Array<OcrMatch>;
      matchesByUuid: Record<string, Array<OcrMatch>>;
      matchCountsByUuid: Record<string, number>;
      error: null;
      detailedError: null;
    }
  | {
      matches: null;
      matchesByUuid: null;
      matchCountsByUuid: null;
      error: string;
      detailedError: string;
    }
> {
  try {
    const { uuids, value, matchMode, isCaseSensitive, maxMatchesPerItem } =
      v.parse(ocrMatchesParametersSchema, parameters);
    const termQueryExpressions = buildOcrTermQueryExpressions({
      value,
      matchMode,
      isCaseSensitive,
    });

    if (termQueryExpressions.length === 0) {
      return {
        matches: [],
        matchesByUuid: {},
        matchCountsByUuid: {},
        error: null,
        detailedError: null,
      };
    }

    const response = await (options?.fetch ?? fetch)(
      'https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?xquery&xsl=none&lang="*"',
      {
        method: "POST",
        body: buildXQuery({ uuids, termQueryExpressions, maxMatchesPerItem }),
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

    const { success, issues, output } = v.safeParse(
      XMLOcrMatchesDataSchema,
      data,
    );
    if (!success) {
      throw createSchemaValidationError(
        "Failed to parse OCHRE OCR matches",
        issues,
      );
    }
    restoreXMLMetadata(output, data);

    const rawOcrItems = output.result.ochre.ocrMatches?.ocrItem ?? [];
    const matches = parseOcrMatches(rawOcrItems);
    const matchesByUuid: Record<string, Array<OcrMatch>> = {};
    const matchCountsByUuid: Record<string, number> = {};

    for (const uuid of uuids) {
      matchesByUuid[uuid] = [];
      matchCountsByUuid[uuid] = 0;
    }
    for (const rawOcrItem of rawOcrItems) {
      matchCountsByUuid[rawOcrItem.uuid] = rawOcrItem.matchCount;
    }
    for (const match of matches) {
      matchesByUuid[match.uuid]?.push(match);
    }

    return {
      matches,
      matchesByUuid,
      matchCountsByUuid,
      error: null,
      detailedError: null,
    };
  } catch (error) {
    return {
      matches: null,
      matchesByUuid: null,
      matchCountsByUuid: null,
      ...getErrorOutput(error, "Unknown error"),
    };
  }
}
