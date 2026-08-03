import { expect, it } from "vitest";
import type { Query } from "#/types/index.js";
import { fetchSetItems } from "#/fetchers/set/items.js";

const UCHICAGO_NODE_SET_SCOPE_UUIDS = [
  "10268bd8-5e97-4f8c-b3f7-89d85d93a776",
  "6b81459f-978c-4958-affa-3f0e895bf86e",
  "a6af0d98-5e68-4565-953d-2633a6ce145c",
  "e59a10d4-c873-4aad-8a2f-f4e62240c5a3",
  "c103ea19-5617-480e-bdfa-8ae8e1d1f83f",
  "606c62dd-80ad-41db-ae1d-7a8b2ff7ef27",
] as const;

function buildInputValueQueries(value: string) {
  return {
    or: [
      {
        target: "title" as const,
        value,
        matchMode: "includes" as const,
        isCaseSensitive: false,
        language: "eng",
      },
      {
        target: "description" as const,
        value,
        matchMode: "includes" as const,
        isCaseSensitive: false,
        language: "eng",
      },
      {
        target: "bibliography" as const,
        value,
        matchMode: "includes" as const,
        isCaseSensitive: false,
        language: "eng",
      },
      {
        target: "periods" as const,
        value,
        matchMode: "includes" as const,
        isCaseSensitive: false,
        language: "eng",
      },
      {
        target: "property" as const,
        dataType: "all" as const,
        value,
        matchMode: "includes" as const,
        isCaseSensitive: false,
        language: "eng",
      },
    ],
  };
}

it("should fetch uchicago-node Set items for query: 'maps of Pilsen'", async () => {
  const { totalCount } = await fetchSetItems({
    setScopeUuids: [...UCHICAGO_NODE_SET_SCOPE_UUIDS],
    queries: buildInputValueQueries("maps of Pilsen"),
    page: 1,
    pageSize: 48,
  });

  expect(totalCount).toBe(2);
});

it("should fetch uchicago-node Set items for query: 'west garfield' and properties", async () => {
  const { totalCount } = await fetchSetItems({
    setScopeUuids: [...UCHICAGO_NODE_SET_SCOPE_UUIDS],
    queries: {
      and: [
        buildInputValueQueries("west garfield"),
        {
          target: "property",
          propertyVariable: "cf4b9fdc-6cef-4cc6-b6b6-7182aca93fb8",
          dataType: "date",
          from: "1886-01-01T00:00:00Z",
          to: "1896-12-31T23:59:59Z",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "9f4ba746-585e-45b0-a654-43d52c9d840b",
          dataType: "IDREF",
          value: "ede04283-36d5-471b-a8ca-3f5836fd992d",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: "4c9fc941-5c23-4c22-84a8-628177d772bc",
          dataType: "IDREF",
          value: "0092cc2f-934d-4ae6-a69f-dd53ac41e6ff",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
      ],
    },
    page: 1,
    pageSize: 48,
  });

  expect(totalCount).toBe(3);
});

it("should fetch uchicago-node Set items for query: 'chicago' and property query: 'Media type filter' = 'Map'", async () => {
  const { totalCount } = await fetchSetItems({
    setScopeUuids: [...UCHICAGO_NODE_SET_SCOPE_UUIDS],
    queries: {
      and: [
        buildInputValueQueries("chicago"),
        {
          target: "property",
          propertyVariable: "8383140a-e676-417f-b5d8-863d9df6d905",
          dataType: "string",
          value: "Map",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
      ],
    },
    page: 1,
    pageSize: 48,
  });

  expect(totalCount).toBe(1741);
});

it("should fetch uchicago-node Set items for query: 'chicago' and exact property OR facet: 'Media type filter' in ('Map', 'Video')", async () => {
  const { totalCount } = await fetchSetItems({
    setScopeUuids: [...UCHICAGO_NODE_SET_SCOPE_UUIDS],
    queries: {
      and: [
        buildInputValueQueries("chicago"),
        {
          or: [
            {
              target: "property",
              propertyVariable: "8383140a-e676-417f-b5d8-863d9df6d905",
              dataType: "string",
              value: "Map",
              matchMode: "exact",
              isCaseSensitive: true,
              language: "eng",
            },
            {
              target: "property",
              propertyVariable: "8383140a-e676-417f-b5d8-863d9df6d905",
              dataType: "string",
              value: "Video",
              matchMode: "exact",
              isCaseSensitive: true,
              language: "eng",
            },
          ],
        },
      ],
    },
    page: 1,
    pageSize: 48,
  });

  expect(totalCount).toBe(2220);
});

it("should fetch uchicago-node Set items for query: 'ca. 1870'", async () => {
  const { totalCount } = await fetchSetItems({
    setScopeUuids: [...UCHICAGO_NODE_SET_SCOPE_UUIDS],
    queries: buildInputValueQueries("ca. 1870"),
    page: 1,
    pageSize: 48,
  });

  expect(totalCount).toBe(177);
});

it("should fetch uchicago-node Set items for query: 'cat'", async () => {
  const { totalCount } = await fetchSetItems({
    setScopeUuids: [...UCHICAGO_NODE_SET_SCOPE_UUIDS],
    queries: buildInputValueQueries("cat"),
    page: 1,
    pageSize: 48,
  });

  expect(totalCount).toBe(1);
});

it("should fetch sosc-core-at-smart Set items for bibliographies query: 'Aristotle, The Politics'", async () => {
  const { totalCount } = await fetchSetItems({
    setScopeUuids: ["16f5a39a-47b9-492d-9f9c-b7e4ec4156b6"],
    queries: {
      target: "bibliography",
      value: "David Walker, An Appeal to the Colored Citizens of the World",
      matchMode: "exact",
      isCaseSensitive: true,
      language: "eng",
    },
    page: 1,
    pageSize: 48,
  });

  expect(totalCount).toBe(7);
});

it("should fetch sosc-core-at-smart Set items for periods query: '19th century CE'", async () => {
  const { totalCount } = await fetchSetItems({
    setScopeUuids: ["16f5a39a-47b9-492d-9f9c-b7e4ec4156b6"],
    queries: {
      target: "periods",
      value: "19th century CE",
      matchMode: "exact",
      isCaseSensitive: true,
      language: "eng",
    },
    page: 1,
    pageSize: 48,
  });

  expect(totalCount).toBe(16);
});

it("should fetch more uchicago-node Set items for wildcard query: 'cat*'", async () => {
  const { totalCount: catCount } = await fetchSetItems({
    setScopeUuids: [...UCHICAGO_NODE_SET_SCOPE_UUIDS],
    queries: buildInputValueQueries("cat"),
    page: 1,
    pageSize: 48,
  });
  const { totalCount: wildcardCount } = await fetchSetItems({
    setScopeUuids: [...UCHICAGO_NODE_SET_SCOPE_UUIDS],
    queries: buildInputValueQueries("cat*"),
    page: 1,
    pageSize: 48,
  });

  expect(catCount).toBe(1);
  expect(wildcardCount).toBe(28);
  expect(wildcardCount).toBeGreaterThan(catCount!);
});

it("should fetch uchicago-node Set items for stemmed query: 'train'", async () => {
  const { totalCount } = await fetchSetItems({
    setScopeUuids: [...UCHICAGO_NODE_SET_SCOPE_UUIDS],
    queries: buildInputValueQueries("train"),
    page: 1,
    pageSize: 48,
  });

  expect(totalCount).toBe(8);
});

const OCR_SET_SCOPE_UUIDS = [
  "96551f43-4905-49c3-8493-4d7c3bf0234e",
  "9ae7119e-de20-4221-a3d5-eb185f863002",
] as const;
const OCR_ITEM_UUIDS = [
  "518be69e-0a3d-4f2c-993e-3b352b2dfc11",
  "b350600d-e0f6-4a67-bb62-199849b6aad3",
];

async function fetchOcrItemUuids(
  query: Omit<Extract<Query, { target: "ocr" }>, "target">,
): Promise<{ totalCount: number | null; uuids: Array<string> }> {
  const { totalCount, items } = await fetchSetItems({
    setScopeUuids: [...OCR_SET_SCOPE_UUIDS],
    queries: { target: "ocr", ...query },
    page: 1,
    pageSize: 48,
  });

  return {
    totalCount,
    uuids: Array.from(items ?? [], (item) => item.uuid).toSorted((a, b) =>
      a.localeCompare(b),
    ),
  };
}

it("should fetch Set items whose OCR text contains an adjacent phrase", async () => {
  const { totalCount, uuids } = await fetchOcrItemUuids({
    value: "magna cum laude",
    matchMode: "includes",
    isCaseSensitive: false,
  });

  expect(totalCount).toBe(2);
  expect(uuids).toStrictEqual(OCR_ITEM_UUIDS);
});

it("should not match OCR phrases whose words are not adjacent", async () => {
  const { totalCount } = await fetchOcrItemUuids({
    value: "the laude",
    matchMode: "includes",
    isCaseSensitive: false,
  });

  expect(totalCount).toBe(0);
});

it("should match OCR words with stemming and wildcards, but not partial words", async () => {
  const stemmed = await fetchOcrItemUuids({
    value: "colleges",
    matchMode: "includes",
    isCaseSensitive: false,
  });
  const wildcarded = await fetchOcrItemUuids({
    value: "CAPPAER*",
    matchMode: "includes",
    isCaseSensitive: false,
  });
  const partial = await fetchOcrItemUuids({
    value: "laud",
    matchMode: "exact",
    isCaseSensitive: false,
  });

  expect(stemmed.uuids).toStrictEqual(OCR_ITEM_UUIDS);
  expect(wildcarded.uuids).toStrictEqual(OCR_ITEM_UUIDS);
  expect(partial.totalCount).toBe(0);
});

it("should exclude OCR matches when the OCR query is negated", async () => {
  const { totalCount: matchedCount } = await fetchOcrItemUuids({
    value: "magna cum laude",
    matchMode: "includes",
    isCaseSensitive: false,
  });
  const { totalCount: excludedCount, uuids } = await fetchOcrItemUuids({
    value: "magna cum laude",
    matchMode: "includes",
    isCaseSensitive: false,
    isNegated: true,
  });
  const { totalCount: unfilteredCount } = await fetchSetItems({
    setScopeUuids: [...OCR_SET_SCOPE_UUIDS],
    queries: null,
    page: 1,
    pageSize: 48,
  });

  expect(excludedCount).toBe(unfilteredCount! - matchedCount!);
  for (const uuid of OCR_ITEM_UUIDS) {
    expect(uuids).not.toContain(uuid);
  }
});

it("should narrow OCR matches when AND-ed with another target", async () => {
  const { totalCount: matchingTitle } = await fetchSetItems({
    setScopeUuids: [...OCR_SET_SCOPE_UUIDS],
    queries: {
      and: [
        {
          target: "ocr",
          value: "magna cum laude",
          matchMode: "includes",
          isCaseSensitive: false,
        },
        {
          target: "title",
          value: "Convocation",
          matchMode: "includes",
          isCaseSensitive: false,
          language: "eng",
        },
      ],
    },
    page: 1,
    pageSize: 48,
  });
  const { totalCount: missingTitle } = await fetchSetItems({
    setScopeUuids: [...OCR_SET_SCOPE_UUIDS],
    queries: {
      and: [
        {
          target: "ocr",
          value: "magna cum laude",
          matchMode: "includes",
          isCaseSensitive: false,
        },
        {
          target: "title",
          value: "Zzzznotpresent",
          matchMode: "includes",
          isCaseSensitive: false,
          language: "eng",
        },
      ],
    },
    page: 1,
    pageSize: 48,
  });

  expect(matchingTitle).toBe(2);
  expect(missingTitle).toBe(0);
});
