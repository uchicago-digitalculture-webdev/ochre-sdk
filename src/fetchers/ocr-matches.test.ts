import { describe, expect, it } from "vitest";
import type { Query } from "#/types/index.js";
import { fetchOcrMatches } from "#/fetchers/ocr-matches.js";
import { fetchSetItems } from "#/fetchers/set/items.js";
import { buildOcrTermQueryExpressions } from "#/query.js";

const OCR_PARENT_UUID = "518be69e-0a3d-4f2c-993e-3b352b2dfc11";
const OCR_PAGE_UUID = "b350600d-e0f6-4a67-bb62-199849b6aad3";
const MISSING_UUID = "00000000-0000-4000-8000-000000000000";
const OCR_SET_SCOPE_UUIDS = [
  "96551f43-4905-49c3-8493-4d7c3bf0234e",
  "9ae7119e-de20-4221-a3d5-eb185f863002",
];
const PHRASE = "magna cum laude";
const EMPTY_RESPONSE = "<result><ochre><ocrMatches/></ochre></result>";

async function captureOcrMatchesQuery(parameters: {
  uuids: Array<string>;
  value: string;
  matchMode?: "includes" | "exact";
  isCaseSensitive?: boolean;
  maxMatchesPerItem?: number;
}): Promise<string> {
  let postedBody = "";

  await fetchOcrMatches(parameters, {
    fetch: async (_input, init) => {
      postedBody = String(init?.body ?? "");

      return new Response(EMPTY_RESPONSE);
    },
  });

  return postedBody;
}

async function captureSetItemsOcrQuery(query: Query): Promise<string> {
  let postedBody = "";

  await fetchSetItems(
    { setScopeUuids: OCR_SET_SCOPE_UUIDS, queries: query, page: 1 },
    undefined,
    {
      fetch: async (_input, init) => {
        postedBody = String(init?.body ?? "");

        return new Response(
          '<result><ochre><items totalCount="0" page="1" pageSize="48"/></ochre></result>',
        );
      },
    },
  );

  return postedBody;
}

describe("fetchOcrMatches query assembly", () => {
  it("compiles one CTS query per term and matches each OCR word against it", async () => {
    const postedBody = await captureOcrMatchesQuery({
      uuids: [OCR_PARENT_UUID],
      value: PHRASE,
    });

    expect(postedBody).toContain("declare variable $termCount := 3;");
    expect(postedBody).toContain(
      "satisfies cts:contains($words[$index + $offset - 1], $termQueries[$offset])",
    );
    expect(postedBody).toContain(
      `declare variable $uuids := ("${OCR_PARENT_UUID}");`,
    );
    expect(postedBody).toContain("subsequence($words, $index, $termCount)");
  });

  it("uses whole-word equality for single-token exact searches", async () => {
    const postedBody = await captureOcrMatchesQuery({
      uuids: [OCR_PARENT_UUID],
      value: "laude",
      matchMode: "exact",
    });

    expect(postedBody).toContain("declare variable $termCount := 1;");
    expect(postedBody).toContain(
      'cts:element-value-query(xs:QName("string"), "laude"',
    );
  });

  // Highlighting has to agree with filtering, including stemming and wildcards,
  // which cannot be reproduced outside MarkLogic.
  it("reuses the exact term queries the Set item ocr filter compiles", async () => {
    for (const matchMode of ["includes", "exact"] as const) {
      const termQueryExpressions = buildOcrTermQueryExpressions({
        value: PHRASE,
        matchMode,
        isCaseSensitive: false,
      });
      const matchesBody = await captureOcrMatchesQuery({
        uuids: [OCR_PARENT_UUID],
        value: PHRASE,
        matchMode,
      });
      const setItemsBody = await captureSetItemsOcrQuery({
        target: "ocr",
        value: PHRASE,
        matchMode,
        isCaseSensitive: false,
      });

      expect(termQueryExpressions).toHaveLength(3);
      for (const termQueryExpression of termQueryExpressions) {
        expect(matchesBody).toContain(termQueryExpression);
        expect(setItemsBody).toContain(termQueryExpression);
      }
    }
  });

  it("caps returned matches per item, defaulting to 50", async () => {
    const defaultBody = await captureOcrMatchesQuery({
      uuids: [OCR_PARENT_UUID],
      value: PHRASE,
    });
    const cappedBody = await captureOcrMatchesQuery({
      uuids: [OCR_PARENT_UUID],
      value: PHRASE,
      maxMatchesPerItem: 2,
    });

    expect(defaultBody).toContain("subsequence($matches, 1, 50)");
    expect(cappedBody).toContain("subsequence($matches, 1, 2)");
  });

  it("returns an empty result without fetching when a value has no searchable tokens", async () => {
    let didFetch = false;
    const result = await fetchOcrMatches(
      { uuids: [OCR_PARENT_UUID], value: "***" },
      {
        fetch: async () => {
          didFetch = true;

          throw new Error("fetch should not be called");
        },
      },
    );

    expect(didFetch).toBe(false);
    expect(result.matches).toStrictEqual([]);
    expect(result.matchCountsByUuid).toStrictEqual({});
  });

  it("rejects empty UUID lists and empty search values", async () => {
    const noUuids = await fetchOcrMatches(
      { uuids: [], value: PHRASE },
      { fetch: async () => new Response(EMPTY_RESPONSE) },
    );
    const noValue = await fetchOcrMatches(
      { uuids: [OCR_PARENT_UUID], value: "" },
      { fetch: async () => new Response(EMPTY_RESPONSE) },
    );

    expect(noUuids.error).not.toBeNull();
    expect(noValue.error).not.toBeNull();
  });
});

describe("fetchOcrMatches response parsing", () => {
  it("parses match runs with page metadata and word geometry", async () => {
    const result = await fetchOcrMatches(
      { uuids: [OCR_PARENT_UUID, MISSING_UUID], value: PHRASE },
      {
        fetch: async () =>
          new Response(
            `<result><ochre><ocrMatches><ocrItem uuid="${OCR_PARENT_UUID}" matchCount="16"><ocrMatch resourceUuid="${OCR_PAGE_UUID}" n="1" fileName="firat.tif" WIDTH="2067" HEIGHT="3064"><string HPOS="309" VPOS="237" WIDTH="68" HEIGHT="18" CONTENT="magna" VERTICES="[(309,237), (376,234), (377,252), (310,255)]">magna</string><string HPOS="384" VPOS="234" WIDTH="42" HEIGHT="17" CONTENT="cum">cum</string></ocrMatch></ocrItem><ocrItem uuid="${MISSING_UUID}" matchCount="0"/></ocrMatches></ochre></result>`,
          ),
      },
    );

    expect(result.error).toBeNull();
    expect(result.matches).toStrictEqual([
      {
        uuid: OCR_PARENT_UUID,
        resourceUuid: OCR_PAGE_UUID,
        page: { number: 1, fileName: "firat.tif", width: 2067, height: 3064 },
        content: "magna cum",
        words: [
          {
            content: "magna",
            x: 309,
            y: 237,
            width: 68,
            height: 18,
            vertices: [
              { x: 309, y: 237 },
              { x: 376, y: 234 },
              { x: 377, y: 252 },
              { x: 310, y: 255 },
            ],
          },
          {
            content: "cum",
            x: 384,
            y: 234,
            width: 42,
            height: 17,
            vertices: [],
          },
        ],
      },
    ]);
  });

  it("reports untruncated counts and seeds every requested UUID", async () => {
    const result = await fetchOcrMatches(
      {
        uuids: [OCR_PARENT_UUID, MISSING_UUID],
        value: PHRASE,
        maxMatchesPerItem: 1,
      },
      {
        fetch: async () =>
          new Response(
            `<result><ochre><ocrMatches><ocrItem uuid="${OCR_PARENT_UUID}" matchCount="16"><ocrMatch resourceUuid="${OCR_PAGE_UUID}" n="1"><string HPOS="1" VPOS="2" WIDTH="3" HEIGHT="4" CONTENT="magna">magna</string></ocrMatch></ocrItem><ocrItem uuid="${MISSING_UUID}" matchCount="0"/></ocrMatches></ochre></result>`,
          ),
      },
    );

    expect(result.matchCountsByUuid).toStrictEqual({
      [OCR_PARENT_UUID]: 16,
      [MISSING_UUID]: 0,
    });
    expect(result.matchesByUuid?.[OCR_PARENT_UUID]).toHaveLength(1);
    expect(result.matchesByUuid?.[MISSING_UUID]).toStrictEqual([]);
    expect(result.matches?.[0]?.page).toStrictEqual({
      number: 1,
      fileName: null,
      width: null,
      height: null,
    });
  });
});

describe("fetchOcrMatches live", () => {
  it("locates every phrase hit with its bounding boxes", async () => {
    const { matches, matchCountsByUuid, error } = await fetchOcrMatches({
      uuids: [OCR_PARENT_UUID, OCR_PAGE_UUID, MISSING_UUID],
      value: PHRASE,
    });

    expect(error).toBeNull();
    expect(matchCountsByUuid).toStrictEqual({
      [OCR_PARENT_UUID]: 16,
      [OCR_PAGE_UUID]: 16,
      [MISSING_UUID]: 0,
    });
    expect(matches).toHaveLength(32);

    const foundMatches = matches ?? [];
    for (const match of foundMatches) {
      expect(match.content).toBe(PHRASE);
      expect(match.words).toHaveLength(3);
      expect(match.resourceUuid).toBe(OCR_PAGE_UUID);
      expect(match.page.number).toBe(1);
      for (const word of match.words) {
        expect(word.width).toBeGreaterThan(0);
        expect(word.vertices).toHaveLength(4);
      }
    }

    expect(matches?.[0]?.words[0]).toStrictEqual({
      content: "magna",
      x: 309,
      y: 237,
      width: 68,
      height: 18,
      vertices: [
        { x: 309, y: 237 },
        { x: 376, y: 234 },
        { x: 377, y: 252 },
        { x: 310, y: 255 },
      ],
    });
  }, 120_000);

  it("truncates to maxMatchesPerItem while still counting every hit", async () => {
    const { matches, matchCountsByUuid } = await fetchOcrMatches({
      uuids: [OCR_PAGE_UUID],
      value: PHRASE,
      maxMatchesPerItem: 3,
    });

    expect(matches).toHaveLength(3);
    expect(matchCountsByUuid?.[OCR_PAGE_UUID]).toBe(16);
  }, 120_000);

  it("applies stemming, wildcards, and whole-word exactness like the filter", async () => {
    const stemmed = await fetchOcrMatches({
      uuids: [OCR_PAGE_UUID],
      value: "colleges",
    });
    const wildcarded = await fetchOcrMatches({
      uuids: [OCR_PAGE_UUID],
      value: "CAPPAER*",
    });
    const exactWord = await fetchOcrMatches({
      uuids: [OCR_PAGE_UUID],
      value: "laude",
      matchMode: "exact",
    });
    const partialWord = await fetchOcrMatches({
      uuids: [OCR_PAGE_UUID],
      value: "laud",
      matchMode: "exact",
    });
    const nonAdjacent = await fetchOcrMatches({
      uuids: [OCR_PAGE_UUID],
      value: "the laude",
    });

    expect(stemmed.matches?.[0]?.content).toBe("COLLEGE");
    expect(wildcarded.matches?.[0]?.content).toBe("CAPPAERT");
    expect(exactWord.matchCountsByUuid?.[OCR_PAGE_UUID]).toBe(31);
    expect(partialWord.matches).toStrictEqual([]);
    expect(nonAdjacent.matches).toStrictEqual([]);
  }, 120_000);

  // Phase 1 selects the items, phase 2 locates the hits inside them; a filtered
  // item with no locatable hit would mean the two disagree.
  it("locates hits in every item the ocr Set item filter returns", async () => {
    const { items } = await fetchSetItems({
      setScopeUuids: OCR_SET_SCOPE_UUIDS,
      queries: {
        target: "ocr",
        value: PHRASE,
        matchMode: "includes",
        isCaseSensitive: false,
      },
      page: 1,
    });
    const uuids = Array.from(items ?? [], (item) => item.uuid);
    const { matchCountsByUuid } = await fetchOcrMatches({
      uuids,
      value: PHRASE,
    });

    expect(uuids.length).toBeGreaterThan(0);
    for (const uuid of uuids) {
      expect(matchCountsByUuid?.[uuid]).toBeGreaterThan(0);
    }
  }, 120_000);
});
