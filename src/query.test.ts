import { describe, expect, it } from "vitest";
import type { Query, SetItemsSort } from "#/types/index.js";
import { fetchSetItems } from "#/fetchers/set/items.js";
import { fetchSetPropertyValues } from "#/fetchers/set/property-values.js";
import {
  buildBelongsToCollectionQueryExpression,
  buildQueryPlan,
} from "#/query.js";

const BASE_ITEMS_EXPRESSION = "doc()/ochre/set[@uuid = $setScopeUuids]/items/*";
const ITEMS_BINDING = "\n  let $items := ";
const QUERY_BINDING = "let $query := ";

const SET_UUID = "41f855f5-202e-4ec9-95d6-a87b793a9dcb";
const COLLECTION_UUID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MEDIA_TYPE_UUID = "8383140a-e676-417f-b5d8-863d9df6d905";
const LOCI_VERTICAL_RELATION_UUID = "7657d3a8-fbe7-4f22-aea1-f2f20c68db7e";
const LOCUS_6082_UUID = "c7c11ce1-9927-41c2-97e4-22243e54f277";
const COLLECTION_PROPERTY_UUID = "30054cb2-909a-4f34-8db9-8fe7369d691d";

function compiledItemsClause(queries: Query | null): string {
  return buildQueryPlan({ queries, baseItemsExpression: BASE_ITEMS_EXPRESSION })
    .itemsClause;
}

/**
 * Compile a query tree and read back the single CTS query it binds to `$query`,
 * which is null when the plan resolves without one
 */
function compiledQueryPlan(parameters: { queries: Query | null }): {
  prolog: string;
  queryExpression: string | null;
} {
  const { prolog, itemsClause } = buildQueryPlan({
    queries: parameters.queries,
    baseItemsExpression: BASE_ITEMS_EXPRESSION,
  });
  const startIndex = itemsClause.indexOf(QUERY_BINDING);
  const endIndex = itemsClause.lastIndexOf(ITEMS_BINDING);

  return {
    prolog,
    queryExpression:
      startIndex === -1 || endIndex === -1
        ? null
        : itemsClause.slice(startIndex + QUERY_BINDING.length, endIndex),
  };
}

function compiledQueryText(queries: Query | null): string {
  const { prolog, queryExpression } = compiledQueryPlan({ queries });

  return `${prolog}\n${queryExpression ?? ""}`;
}

function expectContainsAll(value: string, expectedParts: Array<string>): void {
  for (const expectedPart of expectedParts) {
    expect(value).toContain(expectedPart);
  }
}

function expectContainsNone(
  value: string,
  unexpectedParts: Array<string>,
): void {
  for (const unexpectedPart of unexpectedParts) {
    expect(value).not.toContain(unexpectedPart);
  }
}

function countOccurrences(value: string, search: string): number {
  return value.split(search).length - 1;
}

async function captureSetItemsQuery(parameters: {
  setScopeUuids: Array<string>;
  queries?: Query | null;
  sort?: SetItemsSort;
  page: number;
  pageSize?: number;
}): Promise<string> {
  let postedBody = "";

  await fetchSetItems(parameters, undefined, {
    fetch: async (_input, init) => {
      postedBody = String(init?.body ?? "");

      return new Response(
        '<result><ochre><items totalCount="0" page="1" pageSize="10"/></ochre></result>',
      );
    },
  });

  return postedBody;
}

async function captureSetPropertyValuesQuery(parameters: {
  setScopeUuids: Array<string>;
  queries?: Query | null;
  attributes?: { bibliographies: boolean; periods: boolean };
  isLimitedToLeafPropertyValues?: boolean;
}): Promise<string> {
  let postedBody = "";

  await fetchSetPropertyValues(parameters, {
    fetch: async (_input, init) => {
      postedBody = String(init?.body ?? "");

      return new Response("<result><ochre/></result>");
    },
  });

  return postedBody;
}

describe("query helpers", () => {
  it("searches the base items expression directly for a null query tree", () => {
    const { prolog, queryExpression } = compiledQueryPlan({ queries: null });

    expect(prolog).toBe("");
    expect(queryExpression).toBeNull();
    expect(compiledItemsClause(null)).toBe(
      `let $items := ${BASE_ITEMS_EXPRESSION}`,
    );
  });

  it("builds collection membership queries through the property scope", () => {
    const queryExpression = buildBelongsToCollectionQueryExpression(
      [COLLECTION_UUID],
      COLLECTION_PROPERTY_UUID,
    );

    expect(queryExpression).not.toBeNull();
    expectContainsAll(queryExpression ?? "", [
      'cts:element-query(xs:QName("properties")',
      'cts:element-query(xs:QName("property")',
      `cts:element-attribute-value-query(xs:QName("label"), xs:QName("uuid"), "${COLLECTION_PROPERTY_UUID}")`,
      `cts:element-attribute-value-query(xs:QName("value"), xs:QName("uuid"), "${COLLECTION_UUID}")`,
    ]);
  });
});

describe("content target queries", () => {
  const contentTargetCases = [
    { target: "title", path: ["identification", "label", "content"] },
    { target: "description", path: ["description", "content"] },
    { target: "image", path: ["image", "identification", "label", "content"] },
    {
      target: "periods",
      path: ["periods", "period", "identification", "label", "content"],
    },
    {
      target: "bibliography",
      path: [
        "bibliographies",
        "bibliography",
        "identification",
        "label",
        "content",
      ],
    },
  ] as const;

  for (const { target, path } of contentTargetCases) {
    it(`compiles exact ${target} queries under the expected content path`, () => {
      const queryText = compiledQueryText({
        target,
        value: "fortification",
        matchMode: "exact",
        isCaseSensitive: true,
        language: "eng",
      });

      for (const elementName of path) {
        expect(queryText).toContain(
          `cts:element-query(xs:QName("${elementName}")`,
        );
      }

      expectContainsAll(queryText, [
        'cts:element-attribute-value-query(xs:QName("content"), xs:QName("xml:lang"), "eng")',
        'cts:word-query("fortification"',
        "local:queryHelper1()",
      ]);
    });
  }

  it("compiles includes queries with stemming and language options", () => {
    const queryText = compiledQueryText({
      target: "title",
      value: "fortification",
      matchMode: "includes",
      isCaseSensitive: false,
      language: "eng",
    });

    expectContainsAll(queryText, [
      "declare function local:queryHelper2($value as xs:string) as cts:query",
      'cts:word-query($value, ("case-insensitive"',
      '"stemmed"',
      '"unwildcarded"',
      '"lang=eng"',
      'local:queryHelper2("fortification")',
    ]);
  });

  it("compiles wildcard includes queries as wildcarded and unstemmed", () => {
    const queryText = compiledQueryText({
      target: "title",
      value: "map*",
      matchMode: "includes",
      isCaseSensitive: false,
      language: "eng",
    });

    expectContainsAll(queryText, [
      'cts:word-query($value, ("case-insensitive"',
      '"unstemmed"',
      '"wildcarded"',
      'local:queryHelper2("map*")',
    ]);
  });

  it("returns a false query when an includes search only has stop words", () => {
    const { queryExpression } = compiledQueryPlan({
      queries: {
        target: "title",
        value: "of the",
        matchMode: "includes",
        isCaseSensitive: false,
        language: "eng",
      },
    });

    expect(queryExpression).toBe("cts:false-query()");
  });

  it("uses the exact fallback for includes values with punctuation", () => {
    const { queryExpression } = compiledQueryPlan({
      queries: {
        target: "title",
        value: "north-south road",
        matchMode: "includes",
        isCaseSensitive: false,
        language: "eng",
      },
    });

    expectContainsAll(queryExpression ?? "", [
      "cts:or-query((",
      "local:queryHelper1()",
      'local:queryHelper2("north")',
      'local:queryHelper2("south")',
      'local:queryHelper2("road")',
    ]);
  });
});

describe("notes target queries", () => {
  it("compiles notes queries under notes/note/content", () => {
    const queryText = compiledQueryText({
      target: "notes",
      value: "draft",
      matchMode: "exact",
      isCaseSensitive: true,
      language: "eng",
    });

    expectContainsAll(queryText, [
      'cts:element-query(xs:QName("notes")',
      'cts:element-query(xs:QName("note")',
      'cts:element-query(xs:QName("content")',
      'cts:word-query("draft"',
    ]);
  });
});

describe("string target queries", () => {
  it("compiles item-wide string queries against title and string property values", () => {
    const queryText = compiledQueryText({
      target: "string",
      value: "fortification",
      matchMode: "exact",
      isCaseSensitive: true,
      language: "eng",
    });

    expectContainsAll(queryText, [
      "cts:or-query((",
      'cts:element-query(xs:QName("identification")',
      'cts:element-query(xs:QName("properties")',
      "let $contentQuery :=",
      "let $rawValueQuery :=",
      "let $bareValueQuery :=",
      'cts:element-attribute-value-query(xs:QName("value"), xs:QName("rawValue"), "fortification"',
      'cts:element-value-query(xs:QName("value"), "fortification"',
    ]);
  });
});

describe("ocr target queries", () => {
  const ocrQuery = {
    target: "ocr",
    value: "Cappaert",
    matchMode: "includes",
    isCaseSensitive: false,
  } as const;
  const titleQuery = {
    target: "title",
    value: "Convocation",
    matchMode: "includes",
    isCaseSensitive: false,
    language: "eng",
  } as const;

  it("resolves includes searches through a Resource document join", () => {
    const itemsClause = compiledItemsClause(ocrQuery);

    expectContainsAll(itemsClause, [
      'let $ocrItemUuids1 := cts:search(/ochre/resource, cts:element-query(xs:QName("ocr"), cts:element-attribute-word-query(',
      'xs:QName("CONTENT"), "cappaert"',
      ")/@uuid/string()",
      `let $items := ${BASE_ITEMS_EXPRESSION}[@uuid = $ocrItemUuids1]`,
    ]);
    expectContainsNone(itemsClause, [QUERY_BINDING, '"unstemmed"']);
  });

  it("compiles exact searches as an ordered run of whole content values", () => {
    const itemsClause = compiledItemsClause({
      ...ocrQuery,
      value: "THE COLLEGE",
      matchMode: "exact",
    });

    expectContainsAll(itemsClause, [
      "cts:and-query((cts:element-attribute-value-query(",
      'xs:QName("CONTENT"), "THE"',
      'xs:QName("CONTENT"), "COLLEGE"',
      'where local:ocrHasPhrase($ocrResource, ("THE", "COLLEGE"), false())',
    ]);
  });

  it("binds an empty sequence instead of searching for an unmatchable value", () => {
    expect(compiledItemsClause({ ...ocrQuery, value: "of the" })).toBe(
      `let $ocrItemUuids1 := ()\n  let $items := ${BASE_ITEMS_EXPRESSION}[@uuid = $ocrItemUuids1]`,
    );
  });

  it("negates through the item predicate rather than a CTS query", () => {
    expect(compiledItemsClause({ ...ocrQuery, isNegated: true })).toContain(
      `let $items := ${BASE_ITEMS_EXPRESSION}[not(@uuid = $ocrItemUuids1)]`,
    );
  });

  it("reuses one binding for repeated OCR searches in the same tree", () => {
    const itemsClause = compiledItemsClause({
      and: [ocrQuery, titleQuery, ocrQuery],
    });

    expect(countOccurrences(itemsClause, "let $ocrItemUuids1 :=")).toBe(1);
    expect(itemsClause).toContain(
      `let $items := cts:search(${BASE_ITEMS_EXPRESSION}[@uuid = $ocrItemUuids1], $query)`,
    );
  });

  it("unions OCR arms of an OR group, keeping the CTS arms in one search", () => {
    const itemsClause = compiledItemsClause({
      or: [ocrQuery, titleQuery, { ...titleQuery, target: "notes" }],
    });

    expect(countOccurrences(itemsClause, "cts:search(doc()")).toBe(1);
    expectContainsAll(itemsClause, [
      "let $query := cts:or-query((",
      `let $items := (cts:search(${BASE_ITEMS_EXPRESSION}, $query) | ${BASE_ITEMS_EXPRESSION}[@uuid = $ocrItemUuids1])`,
    ]);
  });

  it("intersects when an OCR union sits under an AND group", () => {
    const itemsClause = compiledItemsClause({
      and: [titleQuery, { or: [ocrQuery, { ...titleQuery, value: "2025" }] }],
    });

    expectContainsAll(itemsClause, [
      "let $query1 :=",
      "let $query2 :=",
      ` intersect (cts:search(${BASE_ITEMS_EXPRESSION}, $query2) | ${BASE_ITEMS_EXPRESSION}[@uuid = $ocrItemUuids1])`,
    ]);
  });

  it("keeps OCR filters when compiling property value facets", async () => {
    const postedBody = await captureSetPropertyValuesQuery({
      setScopeUuids: [SET_UUID],
      queries: {
        and: [
          ocrQuery,
          {
            target: "property",
            propertyVariable: MEDIA_TYPE_UUID,
            dataType: "string",
            matchMode: "includes",
            isCaseSensitive: false,
            language: "eng",
          },
        ],
      },
    });

    expectContainsAll(postedBody, [
      "let $ocrItemUuids1 := cts:search(/ochre/resource,",
      `let $items := ${BASE_ITEMS_EXPRESSION}[@uuid = $ocrItemUuids1]`,
      `label/@uuid = "${MEDIA_TYPE_UUID}"`,
    ]);
  });
});

describe("property target queries", () => {
  it("compiles property-variable presence queries", () => {
    const { prolog, queryExpression } = compiledQueryPlan({
      queries: {
        target: "property",
        propertyVariable: MEDIA_TYPE_UUID,
        dataType: "string",
        matchMode: "exact",
        isCaseSensitive: true,
        language: "eng",
      },
    });

    expect(prolog).toBe("");
    expectContainsAll(queryExpression ?? "", [
      'cts:element-query(xs:QName("properties")',
      'cts:element-query(xs:QName("property")',
      `cts:element-attribute-value-query(xs:QName("label"), xs:QName("uuid"), "${MEDIA_TYPE_UUID}")`,
      "cts:true-query()",
    ]);
  });

  it("compiles relation-only property presence queries", () => {
    const { prolog, queryExpression } = compiledQueryPlan({
      queries: {
        target: "property",
        propertyRelation: "related",
        dataType: "IDREF",
        matchMode: "exact",
        isCaseSensitive: true,
        language: "eng",
      },
    });

    expect(prolog).toBe("");
    expectContainsAll(queryExpression ?? "", [
      'cts:element-query(xs:QName("properties")',
      'cts:element-query(xs:QName("property")',
      'cts:element-attribute-value-query(xs:QName("label"), xs:QName("relation"), "related")',
      "cts:true-query()",
    ]);
    expect(queryExpression).not.toContain('xs:QName("value")');
  });

  it("compiles exact string property queries as indexed value equality against content/string, rawValue, and direct text", () => {
    const queryText = compiledQueryText({
      target: "property",
      propertyVariable: MEDIA_TYPE_UUID,
      propertyRelation: "related",
      dataType: "string",
      value: "Map",
      matchMode: "exact",
      isCaseSensitive: true,
      language: "eng",
    });

    expectContainsAll(queryText, [
      `cts:element-attribute-value-query(xs:QName("label"), xs:QName("uuid"), "${MEDIA_TYPE_UUID}")`,
      'cts:element-attribute-value-query(xs:QName("label"), xs:QName("relation"), "related")',
      "let $contentQuery :=",
      "let $rawValueQuery :=",
      "let $bareValueQuery :=",
      'cts:element-value-query(xs:QName("string"), "Map"',
      'cts:element-attribute-value-query(xs:QName("value"), xs:QName("rawValue"), "Map"',
      'cts:element-value-query(xs:QName("value"), "Map"',
    ]);
    expectContainsNone(queryText, [
      "cts:word-query(",
      'cts:not-query(cts:element-attribute-value-query(xs:QName("value"), xs:QName("inherited"), "true"))',
    ]);
  });

  it("compiles includes string property queries as content word queries", () => {
    const queryText = compiledQueryText({
      target: "property",
      propertyVariable: MEDIA_TYPE_UUID,
      dataType: "string",
      value: "Map",
      matchMode: "includes",
      isCaseSensitive: false,
      language: "eng",
    });

    expectContainsAll(queryText, [
      `cts:element-attribute-value-query(xs:QName("label"), xs:QName("uuid"), "${MEDIA_TYPE_UUID}")`,
      "let $contentQuery :=",
      "cts:word-query(",
    ]);
  });

  it("compiles all-property text queries while excluding IDREF values", () => {
    const queryText = compiledQueryText({
      target: "property",
      propertyVariable: MEDIA_TYPE_UUID,
      dataType: "all",
      value: "Map",
      matchMode: "exact",
      isCaseSensitive: true,
      language: "eng",
    });

    expectContainsAll(queryText, [
      `cts:element-attribute-value-query(xs:QName("label"), xs:QName("uuid"), "${MEDIA_TYPE_UUID}")`,
      'cts:not-query(cts:element-attribute-value-query(xs:QName("value"), xs:QName("dataType"), "IDREF"))',
      "let $contentQuery :=",
      "let $rawValueQuery :=",
      "let $bareValueQuery :=",
    ]);
  });

  it("compiles IDREF property queries against value UUID attributes", () => {
    const queryText = compiledQueryText({
      target: "property",
      propertyVariable: LOCI_VERTICAL_RELATION_UUID,
      propertyRelation: "inverse",
      dataType: "IDREF",
      value: LOCUS_6082_UUID,
      matchMode: "exact",
      isCaseSensitive: true,
      language: "eng",
    });

    expectContainsAll(queryText, [
      `cts:element-attribute-value-query(xs:QName("label"), xs:QName("uuid"), "${LOCI_VERTICAL_RELATION_UUID}")`,
      'cts:element-attribute-value-query(xs:QName("label"), xs:QName("relation"), "inverse")',
      `cts:element-attribute-value-query(xs:QName("value"), xs:QName("uuid"), "${LOCUS_6082_UUID}")`,
    ]);
    expectContainsNone(queryText, [
      'xs:QName("rawValue")',
      "let $contentQuery",
    ]);
  });

  const scalarPropertyCases = [
    { dataType: "integer", value: "42" },
    { dataType: "decimal", value: "42.5" },
    { dataType: "time", value: "12:30:00" },
    { dataType: "boolean", value: "true" },
  ] as const;

  for (const { dataType, value } of scalarPropertyCases) {
    it(`compiles ${dataType} property value queries against rawValue and direct text`, () => {
      const queryText = compiledQueryText({
        target: "property",
        propertyVariable: MEDIA_TYPE_UUID,
        dataType,
        value,
        matchMode: "exact",
        isCaseSensitive: true,
        language: "eng",
      });

      expectContainsAll(queryText, [
        `cts:element-attribute-value-query(xs:QName("label"), xs:QName("uuid"), "${MEDIA_TYPE_UUID}")`,
        `cts:element-attribute-value-query(xs:QName("value"), xs:QName("rawValue"), "${value}"`,
        `cts:element-value-query(xs:QName("value"), "${value}"`,
      ]);
    });
  }

  it("compiles date property value queries against rawValue and direct text", () => {
    const queryText = compiledQueryText({
      target: "property",
      propertyVariable: MEDIA_TYPE_UUID,
      dataType: "date",
      value: "2025-03-21",
      matchMode: "exact",
      isCaseSensitive: true,
      language: "eng",
    });

    expectContainsAll(queryText, [
      `cts:element-attribute-value-query(xs:QName("label"), xs:QName("uuid"), "${MEDIA_TYPE_UUID}")`,
      'cts:element-attribute-value-query(xs:QName("value"), xs:QName("rawValue"), "2025-03-21"',
      'cts:element-value-query(xs:QName("value"), "2025-03-21"',
    ]);
  });

  it("compiles dateTime property value queries against rawValue and direct text", () => {
    const queryText = compiledQueryText({
      target: "property",
      propertyVariable: MEDIA_TYPE_UUID,
      dataType: "dateTime",
      value: "2025-03-21T10:00:00Z",
      matchMode: "exact",
      isCaseSensitive: true,
      language: "eng",
    });

    expectContainsAll(queryText, [
      `cts:element-attribute-value-query(xs:QName("label"), xs:QName("uuid"), "${MEDIA_TYPE_UUID}")`,
      'cts:element-attribute-value-query(xs:QName("value"), xs:QName("rawValue"), "2025-03-21T10:00:00Z"',
      'cts:element-value-query(xs:QName("value"), "2025-03-21T10:00:00Z"',
    ]);
  });

  it("compiles date range property queries with from and to bounds", () => {
    const { prolog, queryExpression } = compiledQueryPlan({
      queries: {
        target: "property",
        propertyVariable: MEDIA_TYPE_UUID,
        propertyRelation: "inverse",
        dataType: "date",
        from: "2018-01-01T00:00:00Z",
        to: "2018-12-31T23:59:59Z",
        matchMode: "exact",
        isCaseSensitive: true,
        language: "eng",
      },
    });

    expect(prolog).toBe("");
    expectContainsAll(queryExpression ?? "", [
      `cts:element-attribute-value-query(xs:QName("label"), xs:QName("uuid"), "${MEDIA_TYPE_UUID}")`,
      'cts:element-attribute-value-query(xs:QName("label"), xs:QName("relation"), "inverse")',
      'cts:element-attribute-range-query(xs:QName("value"), xs:QName("rawValue"), ">=", "2018-01-01T00:00:00Z")',
      'cts:element-attribute-range-query(xs:QName("value"), xs:QName("rawValue"), "<=", "2018-12-31T23:59:59Z")',
    ]);
  });

  it("keeps relation-specific helpers distinct for otherwise identical property queries", () => {
    const queryText = compiledQueryText({
      or: [
        {
          target: "property",
          propertyVariable: LOCI_VERTICAL_RELATION_UUID,
          propertyRelation: "related",
          dataType: "string",
          value: "Locus 6082",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
        {
          target: "property",
          propertyVariable: LOCI_VERTICAL_RELATION_UUID,
          propertyRelation: "inverse",
          dataType: "string",
          value: "Locus 6082",
          matchMode: "exact",
          isCaseSensitive: true,
          language: "eng",
        },
      ],
    });

    expect(countOccurrences(queryText, 'xs:QName("relation"), "related"')).toBe(
      1,
    );
    expect(countOccurrences(queryText, 'xs:QName("relation"), "inverse"')).toBe(
      1,
    );
    expectContainsAll(queryText, [
      "local:queryHelper1()",
      "local:queryHelper2()",
    ]);
  });
});

describe("query groups", () => {
  it("compiles AND groups", () => {
    const { queryExpression } = compiledQueryPlan({
      queries: {
        and: [
          {
            target: "title",
            value: "Hippos",
            matchMode: "exact",
            isCaseSensitive: true,
            language: "eng",
          },
          {
            target: "description",
            value: "fortification",
            matchMode: "exact",
            isCaseSensitive: true,
            language: "eng",
          },
        ],
      },
    });

    expect(queryExpression).toBe(
      "cts:and-query((local:queryHelper1(), local:queryHelper2()))",
    );
  });

  it("compiles OR groups", () => {
    const { queryExpression } = compiledQueryPlan({
      queries: {
        or: [
          {
            target: "title",
            value: "Hippos",
            matchMode: "exact",
            isCaseSensitive: true,
            language: "eng",
          },
          {
            target: "description",
            value: "fortification",
            matchMode: "exact",
            isCaseSensitive: true,
            language: "eng",
          },
        ],
      },
    });

    expect(queryExpression).toBe(
      "cts:or-query((local:queryHelper1(), local:queryHelper2()))",
    );
  });

  it("wraps negated leaves in cts:not-query", () => {
    const { queryExpression } = compiledQueryPlan({
      queries: {
        target: "title",
        value: "Hippos",
        matchMode: "exact",
        isCaseSensitive: true,
        language: "eng",
        isNegated: true,
      },
    });

    expect(queryExpression).toBe("cts:not-query(local:queryHelper1())");
  });

  it("optimizes compatible OR groups of includes leaves with the same value", () => {
    const { prolog, queryExpression } = compiledQueryPlan({
      queries: {
        or: [
          {
            target: "title",
            value: "fortification wall",
            matchMode: "includes",
            isCaseSensitive: false,
            language: "eng",
          },
          {
            target: "description",
            value: "fortification wall",
            matchMode: "includes",
            isCaseSensitive: false,
            language: "eng",
          },
          {
            target: "property",
            dataType: "all",
            value: "fortification wall",
            matchMode: "includes",
            isCaseSensitive: false,
            language: "eng",
          },
        ],
      },
    });

    expect(prolog).toContain("cts:or-query");
    expectContainsAll(queryExpression ?? "", [
      "cts:and-query((",
      '"fortification"',
      '"wall"',
    ]);
  });

  it("does not optimize OR includes groups with mismatched languages", () => {
    const { queryExpression } = compiledQueryPlan({
      queries: {
        or: [
          {
            target: "title",
            value: "fortification",
            matchMode: "includes",
            isCaseSensitive: false,
            language: "eng",
          },
          {
            target: "description",
            value: "fortification",
            matchMode: "includes",
            isCaseSensitive: false,
            language: "heb",
          },
        ],
      },
    });

    expect(queryExpression).toBe(
      'cts:or-query((local:queryHelper2("fortification"), local:queryHelper4("fortification")))',
    );
  });
});

describe("fetchSetItems query assembly", () => {
  it("compiles a standalone exact string property filter as an indexed CTS query", async () => {
    const postedBody = await captureSetItemsQuery({
      setScopeUuids: [SET_UUID],
      queries: {
        target: "property",
        propertyVariable: LOCI_VERTICAL_RELATION_UUID,
        propertyRelation: "related",
        dataType: "string",
        value: "Locus 6082",
        matchMode: "exact",
        isCaseSensitive: true,
        language: "eng",
      },
      page: 1,
      pageSize: 10,
    });

    expectContainsAll(postedBody, [
      `cts:element-attribute-value-query(xs:QName("label"), xs:QName("uuid"), "${LOCI_VERTICAL_RELATION_UUID}")`,
      'cts:element-attribute-value-query(xs:QName("label"), xs:QName("relation"), "related")',
      'cts:element-value-query(xs:QName("string"), "Locus 6082"',
      "let $items := cts:search(",
    ]);
    expectContainsNone(postedBody, [
      "let $items := $searchedItems[",
      'content[@xml:lang = "eng"]/string = "Locus 6082"',
    ]);
  });

  it("compiles AND groups with exact string properties entirely through CTS", async () => {
    const postedBody = await captureSetItemsQuery({
      setScopeUuids: [SET_UUID],
      queries: {
        and: [
          {
            target: "title",
            value: "Hippos",
            matchMode: "exact",
            isCaseSensitive: true,
            language: "eng",
          },
          {
            target: "property",
            propertyVariable: MEDIA_TYPE_UUID,
            dataType: "string",
            value: "Map",
            matchMode: "exact",
            isCaseSensitive: true,
            language: "eng",
          },
        ],
      },
      page: 1,
      pageSize: 10,
    });

    expectContainsAll(postedBody, [
      "let $query := cts:and-query((",
      "let $items := cts:search(",
      `cts:element-attribute-value-query(xs:QName("label"), xs:QName("uuid"), "${MEDIA_TYPE_UUID}")`,
      'cts:element-value-query(xs:QName("string"), "Map"',
    ]);
    expectContainsNone(postedBody, [
      "let $items := $searchedItems[",
      'content[@xml:lang = "eng"]/string = "Map"',
    ]);
  });

  it("compiles OR groups with exact string properties through CTS, not XPath extraction", async () => {
    const postedBody = await captureSetItemsQuery({
      setScopeUuids: [SET_UUID],
      queries: {
        or: [
          {
            target: "title",
            value: "Hippos",
            matchMode: "exact",
            isCaseSensitive: true,
            language: "eng",
          },
          {
            target: "property",
            propertyVariable: MEDIA_TYPE_UUID,
            dataType: "string",
            value: "Map",
            matchMode: "exact",
            isCaseSensitive: true,
            language: "eng",
          },
        ],
      },
      page: 1,
      pageSize: 10,
    });

    expectContainsAll(postedBody, [
      "let $query := cts:or-query((",
      "let $items := cts:search(",
      'cts:element-value-query(xs:QName("string"), "Map"',
    ]);
    expect(postedBody).not.toContain("let $items := $searchedItems[");
  });

  it("compiles a text OR AND-ed with an exact-property OR (search box + multi-select facet) through CTS", async () => {
    const postedBody = await captureSetItemsQuery({
      setScopeUuids: [SET_UUID],
      queries: {
        and: [
          {
            or: [
              {
                target: "title",
                value: "chicago",
                matchMode: "includes",
                isCaseSensitive: false,
                language: "eng",
              },
              {
                target: "property",
                dataType: "all",
                value: "chicago",
                matchMode: "includes",
                isCaseSensitive: false,
                language: "eng",
              },
            ],
          },
          {
            or: [
              {
                target: "property",
                propertyVariable: MEDIA_TYPE_UUID,
                dataType: "string",
                value: "Map",
                matchMode: "exact",
                isCaseSensitive: true,
                language: "eng",
              },
              {
                target: "property",
                propertyVariable: MEDIA_TYPE_UUID,
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
      pageSize: 10,
    });

    expectContainsAll(postedBody, [
      "let $items := cts:search(",
      'cts:element-value-query(xs:QName("string"), "Map"',
      'cts:element-value-query(xs:QName("string"), "Video"',
    ]);
    expect(postedBody).not.toContain("let $items := $searchedItems[");
  });

  it("compiles title sort and pagination", async () => {
    const postedBody = await captureSetItemsQuery({
      setScopeUuids: [SET_UUID],
      queries: null,
      sort: { target: "title", direction: "desc", language: "eng" },
      page: 2,
      pageSize: 20,
    });

    expectContainsAll(postedBody, [
      'string-join($item/identification/label/content[@xml:lang="eng"]/string, "")',
      'stable order by ($sortKey = "") ascending, lower-case($sortKey) descending, $position ascending',
      "let $pagedItems := subsequence($orderedItems, 21, 20)",
    ]);
  });

  it("compiles typed propertyValue sort keys", async () => {
    const postedBody = await captureSetItemsQuery({
      setScopeUuids: [SET_UUID],
      queries: null,
      sort: {
        target: "propertyValue",
        propertyVariableUuid: MEDIA_TYPE_UUID,
        dataType: "decimal",
        direction: "asc",
      },
      page: 1,
      pageSize: 10,
    });

    expectContainsAll(postedBody, [
      `$item//properties//property[label/@uuid="${MEDIA_TYPE_UUID}"]/value[not(@i)]`,
      "where $candidate castable as xs:decimal",
      "stable order by empty($sortKey) ascending, $sortKey ascending, $position ascending",
    ]);
  });
});

describe("fetchSetPropertyValues query assembly", () => {
  it("returns early without posting a query when no facets or attributes are requested", async () => {
    let didFetch = false;

    const result = await fetchSetPropertyValues(
      { setScopeUuids: [SET_UUID], queries: null },
      {
        fetch: async () => {
          didFetch = true;

          return new Response("<result><ochre/></result>");
        },
      },
    );

    expect(didFetch).toBe(false);
    expect(result.propertyValues).toStrictEqual([]);
    expect(result.propertyValuesByPropertyVariableUuid).toStrictEqual({});
  });

  it("keeps relation filters in property facet selectors", async () => {
    const postedBody = await captureSetPropertyValuesQuery({
      setScopeUuids: [SET_UUID],
      queries: {
        or: [
          {
            target: "property",
            propertyVariable: LOCI_VERTICAL_RELATION_UUID,
            propertyRelation: "related",
            dataType: "IDREF",
            matchMode: "exact",
            isCaseSensitive: true,
            language: "eng",
          },
          {
            target: "property",
            propertyVariable: LOCI_VERTICAL_RELATION_UUID,
            propertyRelation: "inverse",
            dataType: "IDREF",
            matchMode: "exact",
            isCaseSensitive: true,
            language: "eng",
          },
        ],
      },
    });

    expectContainsAll(postedBody, [
      `label/@uuid = "${LOCI_VERTICAL_RELATION_UUID}" and label/@relation = "related"`,
      `label/@uuid = "${LOCI_VERTICAL_RELATION_UUID}" and label/@relation = "inverse"`,
      "let $items := doc()/ochre/set[@uuid = $setScopeUuids]/items/*",
    ]);
    expect(postedBody).not.toContain("let $query :=");
  });

  it("filters items when property value queries also include a value", async () => {
    const postedBody = await captureSetPropertyValuesQuery({
      setScopeUuids: [SET_UUID],
      queries: {
        target: "property",
        propertyVariable: LOCI_VERTICAL_RELATION_UUID,
        propertyRelation: "inverse",
        dataType: "IDREF",
        value: LOCUS_6082_UUID,
        matchMode: "exact",
        isCaseSensitive: true,
        language: "eng",
      },
    });

    expectContainsAll(postedBody, [
      "let $query := local:queryHelper1()",
      "let $items := cts:search(",
      `cts:element-attribute-value-query(xs:QName("value"), xs:QName("uuid"), "${LOCUS_6082_UUID}")`,
      `label/@uuid = "${LOCI_VERTICAL_RELATION_UUID}" and label/@relation = "inverse"`,
    ]);
  });

  it("limits property value aggregation to leaf values when requested", async () => {
    const postedBody = await captureSetPropertyValuesQuery({
      setScopeUuids: [SET_UUID],
      queries: {
        target: "property",
        propertyVariable: MEDIA_TYPE_UUID,
        dataType: "string",
        matchMode: "exact",
        isCaseSensitive: true,
        language: "eng",
      },
      isLimitedToLeafPropertyValues: true,
    });

    expect(postedBody).toContain("for $v in $p/value[not(@i)]");
  });

  it("compiles requested bibliography and period attribute facets", async () => {
    const postedBody = await captureSetPropertyValuesQuery({
      setScopeUuids: [SET_UUID],
      queries: null,
      attributes: { bibliographies: true, periods: true },
    });

    expectContainsAll(postedBody, [
      'attributeType="bibliographies"',
      'attributeType="periods"',
      "$bibliography-values",
      "$period-values",
    ]);
  });
});
