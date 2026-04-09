import type { Query, QueryGroup, QueryLeaf } from "#/types/index.js";
import { stringLiteral } from "#/utils/internal.js";

const CTS_INCLUDES_STOP_WORDS = new Set<string>([
  "and",
  "at",
  "in",
  "it",
  "of",
  "the",
  "to",
]);
const CTS_INCLUDES_TOKEN_SPLIT_REGEX = /\W+/u;

type QueryMatchMode = "includes" | "exact";
type TextTargetQuery = Extract<
  QueryLeaf,
  {
    target:
      | "title"
      | "description"
      | "image"
      | "periods"
      | "bibliography"
      | "notes";
  }
>;
type PropertyQuery = Extract<QueryLeaf, { target: "property" }>;
type AllPropertyQuery = Extract<PropertyQuery, { dataType: "all" }>;

const CONTENT_TARGET_CONTAINER_ELEMENTS: Record<
  Exclude<TextTargetQuery["target"], "notes">,
  string
> = {
  title: "identification",
  description: "description",
  image: "image",
  periods: "period",
  bibliography: "bibliography",
};

function tokenizeIncludesSearchValue(params: {
  value: string;
  isCaseSensitive: boolean;
}): Array<string> {
  const { value, isCaseSensitive } = params;
  const tokenSource = isCaseSensitive ? value : value.toLowerCase();
  const rawTerms = tokenSource.split(CTS_INCLUDES_TOKEN_SPLIT_REGEX);
  const terms: Array<string> = [];

  for (const term of rawTerms) {
    const normalizedTerm = term.toLowerCase();

    if (normalizedTerm !== "" && !CTS_INCLUDES_STOP_WORDS.has(normalizedTerm)) {
      terms.push(term);
    }
  }

  return terms;
}

function buildCtsMatchOptionsExpression(params: {
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
}): string {
  const { isCaseSensitive } = params;
  const options: Array<string> = [
    isCaseSensitive ? "case-sensitive" : "case-insensitive",
    "diacritic-insensitive",
    "punctuation-insensitive",
    "whitespace-insensitive",
    "unstemmed",
    "unwildcarded",
  ];

  return `(${options.map((option) => stringLiteral(option)).join(", ")})`;
}

function buildCtsWordQueryExpression(params: {
  value: string;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
}): string {
  const { value, matchMode, isCaseSensitive } = params;

  return `cts:word-query(${stringLiteral(value)}, ${buildCtsMatchOptionsExpression({ matchMode, isCaseSensitive })})`;
}

function buildCtsElementWordQueryExpression(params: {
  elementName: string;
  value: string;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
}): string {
  const { elementName, value, matchMode, isCaseSensitive } = params;

  return `cts:element-word-query(xs:QName("${elementName}"), ${stringLiteral(value)}, ${buildCtsMatchOptionsExpression({ matchMode, isCaseSensitive })})`;
}

function buildCtsElementAttributeWordQueryExpression(params: {
  elementName: string;
  attributeName: string;
  value: string;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
}): string {
  const { elementName, attributeName, value, matchMode, isCaseSensitive } =
    params;

  return `cts:element-attribute-word-query(xs:QName("${elementName}"), xs:QName("${attributeName}"), ${stringLiteral(value)}, ${buildCtsMatchOptionsExpression({ matchMode, isCaseSensitive })})`;
}

function buildCtsElementValueQueryExpression(params: {
  elementName: string;
  value: string;
  isCaseSensitive: boolean;
}): string {
  const { elementName, value, isCaseSensitive } = params;

  return `cts:element-value-query(xs:QName("${elementName}"), ${stringLiteral(value)}, ${buildCtsMatchOptionsExpression({ matchMode: "exact", isCaseSensitive })})`;
}

function buildCtsElementAttributeValueQueryExpression(params: {
  elementName: string;
  attributeName: string;
  value: string;
  isCaseSensitive: boolean;
}): string {
  const { elementName, attributeName, value, isCaseSensitive } = params;

  return `cts:element-attribute-value-query(xs:QName("${elementName}"), xs:QName("${attributeName}"), ${stringLiteral(value)}, ${buildCtsMatchOptionsExpression({ matchMode: "exact", isCaseSensitive })})`;
}

function buildPlainElementAttributeValueQueryExpression(params: {
  elementName: string;
  attributeName: string;
  value: string;
}): string {
  const { elementName, attributeName, value } = params;

  return `cts:element-attribute-value-query(xs:QName("${elementName}"), xs:QName("${attributeName}"), ${stringLiteral(value)})`;
}

function buildSearchableContentTextQueryExpression(params: {
  value: string;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
}): string {
  const { value, matchMode, isCaseSensitive } = params;

  if (matchMode === "exact") {
    return buildCtsWordQueryExpression({ value, matchMode, isCaseSensitive });
  }

  return buildOrCtsQueryExpressionInternal([
    buildCtsElementWordQueryExpression({
      elementName: "string",
      value,
      matchMode,
      isCaseSensitive,
    }),
    buildCtsWordQueryExpression({ value, matchMode, isCaseSensitive }),
  ]);
}

function buildNestedElementQuery(
  elementNames: Array<string>,
  queryExpression: string,
): string {
  let wrappedQueryExpression = queryExpression;

  for (const elementName of elementNames.toReversed()) {
    wrappedQueryExpression = `cts:element-query(xs:QName("${elementName}"), ${wrappedQueryExpression})`;
  }

  return wrappedQueryExpression;
}

function buildNotCtsQueryExpression(queryExpression: string): string {
  return `cts:not-query(${queryExpression})`;
}

function buildAndCtsQueryExpressionInternal(
  queryExpressions: Array<string>,
): string {
  if (queryExpressions.length === 0) {
    return "cts:true-query()";
  }

  if (queryExpressions.length === 1) {
    return queryExpressions[0] ?? "cts:true-query()";
  }

  return `cts:and-query((${queryExpressions.join(", ")}))`;
}

function buildOrCtsQueryExpressionInternal(
  queryExpressions: Array<string>,
): string {
  if (queryExpressions.length === 0) {
    return "cts:false-query()";
  }

  if (queryExpressions.length === 1) {
    return queryExpressions[0] ?? "cts:false-query()";
  }

  return `cts:or-query((${queryExpressions.join(", ")}))`;
}

export function buildAndCtsQueryExpression(
  queryExpressions: Array<string>,
): string | null {
  if (queryExpressions.length === 0) {
    return null;
  }

  return buildAndCtsQueryExpressionInternal(queryExpressions);
}

function buildContentLanguageQuery(language: string): string {
  return buildPlainElementAttributeValueQueryExpression({
    elementName: "content",
    attributeName: "xml:lang",
    value: language,
  });
}

function buildPropertyLabelQuery(propertyVariable: string): string {
  return buildPlainElementAttributeValueQueryExpression({
    elementName: "label",
    attributeName: "uuid",
    value: propertyVariable,
  });
}

function buildValueNotInheritedQuery(): string {
  return buildNotCtsQueryExpression(
    buildPlainElementAttributeValueQueryExpression({
      elementName: "value",
      attributeName: "inherited",
      value: "true",
    }),
  );
}

function buildValueNotIdRefQuery(): string {
  return buildNotCtsQueryExpression(
    buildPlainElementAttributeValueQueryExpression({
      elementName: "value",
      attributeName: "dataType",
      value: "IDREF",
    }),
  );
}

function buildValueContentInnerQuery(params: {
  language: string;
  value: string;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
}): string {
  const { language, value, matchMode, isCaseSensitive } = params;

  return buildNestedElementQuery(
    ["content"],
    buildAndCtsQueryExpressionInternal([
      buildContentLanguageQuery(language),
      buildSearchableContentTextQueryExpression({
        value,
        matchMode,
        isCaseSensitive,
      }),
    ]),
  );
}

function buildValueDirectTextInnerQuery(params: {
  value: string;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
}): string {
  const { value, matchMode, isCaseSensitive } = params;
  const directTextQuery =
    matchMode === "exact" ?
      buildCtsElementValueQueryExpression({
        elementName: "value",
        value,
        isCaseSensitive,
      })
    : buildCtsElementWordQueryExpression({
        elementName: "value",
        value,
        matchMode,
        isCaseSensitive,
      });

  return buildAndCtsQueryExpressionInternal([
    buildNotCtsQueryExpression(
      buildNestedElementQuery(["content"], "cts:true-query()"),
    ),
    directTextQuery,
  ]);
}

function buildValueRawValueInnerQuery(params: {
  value: string;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
}): string {
  const { value, matchMode, isCaseSensitive } = params;

  if (matchMode === "exact") {
    return buildCtsElementAttributeValueQueryExpression({
      elementName: "value",
      attributeName: "rawValue",
      value,
      isCaseSensitive,
    });
  }

  return buildCtsElementAttributeWordQueryExpression({
    elementName: "value",
    attributeName: "rawValue",
    value,
    matchMode,
    isCaseSensitive,
  });
}

function buildNotesQueryExpression(params: {
  value: string;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
  language: string;
}): string {
  const { value, matchMode, isCaseSensitive, language } = params;

  return buildNestedElementQuery(
    ["notes", "note", "content"],
    buildAndCtsQueryExpressionInternal([
      buildContentLanguageQuery(language),
      buildOrCtsQueryExpressionInternal([
        matchMode === "exact" ?
          buildCtsElementAttributeValueQueryExpression({
            elementName: "content",
            attributeName: "title",
            value,
            isCaseSensitive,
          })
        : buildCtsElementAttributeWordQueryExpression({
            elementName: "content",
            attributeName: "title",
            value,
            matchMode,
            isCaseSensitive,
          }),
        buildSearchableContentTextQueryExpression({
          value,
          matchMode,
          isCaseSensitive,
        }),
      ]),
    ]),
  );
}

function buildContentTargetQueryExpression(params: {
  target: Exclude<TextTargetQuery["target"], "notes">;
  value: string;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
  language: string;
}): string {
  const { target, value, matchMode, isCaseSensitive, language } = params;
  const containerElement = CONTENT_TARGET_CONTAINER_ELEMENTS[target];

  return buildNestedElementQuery(
    [containerElement],
    buildAndCtsQueryExpressionInternal([
      buildContentLanguageQuery(language),
      buildSearchableContentTextQueryExpression({
        value,
        matchMode,
        isCaseSensitive,
      }),
    ]),
  );
}

function buildPropertyQueryExpression(params: {
  propertyVariable?: string;
  queryExpression: string;
}): string {
  const { propertyVariable, queryExpression } = params;
  const propertyQueryExpressions: Array<string> = [queryExpression];

  if (propertyVariable != null) {
    propertyQueryExpressions.unshift(buildPropertyLabelQuery(propertyVariable));
  }

  return buildNestedElementQuery(
    ["properties", "property"],
    buildAndCtsQueryExpressionInternal(propertyQueryExpressions),
  );
}

function buildPropertyStringQueryExpression(params: {
  propertyVariable?: string;
  value: string;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
  language: string;
}): string {
  const { propertyVariable, value, matchMode, isCaseSensitive, language } =
    params;

  return buildPropertyQueryExpression({
    propertyVariable,
    queryExpression: buildNestedElementQuery(
      ["value"],
      buildAndCtsQueryExpressionInternal([
        buildValueNotInheritedQuery(),
        buildValueContentInnerQuery({
          language,
          value,
          matchMode,
          isCaseSensitive,
        }),
      ]),
    ),
  });
}

function buildPropertyScalarQueryExpression(params: {
  propertyVariable?: string;
  value: string;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
}): string {
  const { propertyVariable, value, matchMode, isCaseSensitive } = params;

  return buildPropertyQueryExpression({
    propertyVariable,
    queryExpression: buildNestedElementQuery(
      ["value"],
      buildOrCtsQueryExpressionInternal([
        buildValueRawValueInnerQuery({ value, matchMode, isCaseSensitive }),
        buildValueDirectTextInnerQuery({ value, matchMode, isCaseSensitive }),
      ]),
    ),
  });
}

function buildPropertyAllQueryExpression(params: {
  query: AllPropertyQuery;
  value: string;
  matchMode: QueryMatchMode;
}): string {
  const { query, value, matchMode } = params;

  if (matchMode === "exact") {
    return buildPropertyQueryExpression({
      propertyVariable: query.propertyVariable,
      queryExpression: buildNestedElementQuery(
        ["value"],
        buildAndCtsQueryExpressionInternal([
          buildValueNotIdRefQuery(),
          buildCtsWordQueryExpression({
            value,
            matchMode,
            isCaseSensitive: query.isCaseSensitive,
          }),
        ]),
      ),
    });
  }

  return buildPropertyQueryExpression({
    propertyVariable: query.propertyVariable,
    queryExpression: buildNestedElementQuery(
      ["value"],
      buildAndCtsQueryExpressionInternal([
        buildValueNotIdRefQuery(),
        buildOrCtsQueryExpressionInternal([
          buildValueRawValueInnerQuery({
            value,
            matchMode,
            isCaseSensitive: query.isCaseSensitive,
          }),
          buildValueDirectTextInnerQuery({
            value,
            matchMode,
            isCaseSensitive: query.isCaseSensitive,
          }),
          buildValueContentInnerQuery({
            language: query.language,
            value,
            matchMode,
            isCaseSensitive: query.isCaseSensitive,
          }),
        ]),
      ]),
    ),
  });
}

function buildPropertyIdRefQueryExpression(params: {
  propertyVariable?: string;
  value: string;
}): string {
  const { propertyVariable, value } = params;

  return buildPropertyQueryExpression({
    propertyVariable,
    queryExpression: buildNestedElementQuery(
      ["value"],
      buildPlainElementAttributeValueQueryExpression({
        elementName: "value",
        attributeName: "uuid",
        value,
      }),
    ),
  });
}

function buildPropertyDateRangeQueryExpression(
  query: Extract<
    PropertyQuery,
    { dataType: "date" | "dateTime"; from?: string; to?: string }
  >,
): string {
  const rangeQueryExpressions: Array<string> = [];

  if (query.from != null) {
    rangeQueryExpressions.push(
      `cts:element-attribute-range-query(xs:QName("value"), xs:QName("rawValue"), ">=", xs:${query.dataType}(${stringLiteral(query.from)}))`,
    );
  }

  if (query.to != null) {
    rangeQueryExpressions.push(
      `cts:element-attribute-range-query(xs:QName("value"), xs:QName("rawValue"), "<=", xs:${query.dataType}(${stringLiteral(query.to)}))`,
    );
  }

  return buildPropertyQueryExpression({
    propertyVariable: query.propertyVariable,
    queryExpression: buildNestedElementQuery(
      ["value"],
      buildAndCtsQueryExpressionInternal(rangeQueryExpressions),
    ),
  });
}

function buildItemStringQueryExpression(params: {
  value: string;
  matchMode: QueryMatchMode;
  isCaseSensitive: boolean;
  language: string;
}): string {
  const { value, matchMode, isCaseSensitive, language } = params;

  return buildOrCtsQueryExpressionInternal([
    buildContentTargetQueryExpression({
      target: "title",
      value,
      matchMode,
      isCaseSensitive,
      language,
    }),
    buildPropertyStringQueryExpression({
      value,
      matchMode,
      isCaseSensitive,
      language,
    }),
  ]);
}

function getLeafSearchValue(query: QueryLeaf): string | null {
  switch (query.target) {
    case "string":
    case "title":
    case "description":
    case "image":
    case "periods":
    case "bibliography":
    case "notes": {
      return query.value;
    }
    case "property": {
      return "value" in query && query.value != null ? query.value : null;
    }
  }
}

function buildLeafValueQueryExpression(params: {
  query: QueryLeaf;
  value: string;
  matchMode: QueryMatchMode;
}): string {
  const { query, value, matchMode } = params;

  switch (query.target) {
    case "string": {
      return buildItemStringQueryExpression({
        value,
        matchMode,
        isCaseSensitive: query.isCaseSensitive,
        language: query.language,
      });
    }
    case "notes": {
      return buildNotesQueryExpression({
        value,
        matchMode,
        isCaseSensitive: query.isCaseSensitive,
        language: query.language,
      });
    }
    case "title":
    case "description":
    case "image":
    case "periods":
    case "bibliography": {
      return buildContentTargetQueryExpression({
        target: query.target,
        value,
        matchMode,
        isCaseSensitive: query.isCaseSensitive,
        language: query.language,
      });
    }
    case "property": {
      switch (query.dataType) {
        case "all": {
          return buildPropertyAllQueryExpression({ query, value, matchMode });
        }
        case "IDREF": {
          return buildPropertyIdRefQueryExpression({
            propertyVariable: query.propertyVariable,
            value,
          });
        }
        case "string": {
          return buildPropertyStringQueryExpression({
            propertyVariable: query.propertyVariable,
            value,
            matchMode,
            isCaseSensitive: query.isCaseSensitive,
            language: query.language,
          });
        }
        case "integer":
        case "decimal":
        case "time":
        case "boolean":
        case "date":
        case "dateTime": {
          return buildPropertyScalarQueryExpression({
            propertyVariable: query.propertyVariable,
            value,
            matchMode,
            isCaseSensitive: query.isCaseSensitive,
          });
        }
      }
    }
  }
}

function buildLeafQueryExpression(query: QueryLeaf): string {
  if (
    query.target === "property" &&
    (query.dataType === "date" || query.dataType === "dateTime") &&
    query.value == null
  ) {
    return buildPropertyDateRangeQueryExpression(query);
  }

  const searchValue = getLeafSearchValue(query);

  if (searchValue == null) {
    throw new Error("Missing searchable value for query leaf");
  }

  if (query.matchMode === "exact") {
    return buildLeafValueQueryExpression({
      query,
      value: searchValue,
      matchMode: "exact",
    });
  }

  const terms = tokenizeIncludesSearchValue({
    value: searchValue,
    isCaseSensitive: query.isCaseSensitive,
  });

  if (terms.length === 0) {
    return "cts:false-query()";
  }

  const termQueryExpressions: Array<string> = [];

  for (const term of terms) {
    termQueryExpressions.push(
      buildLeafValueQueryExpression({
        query,
        value: term,
        matchMode: "includes",
      }),
    );
  }

  return buildAndCtsQueryExpressionInternal(termQueryExpressions);
}

type IncludesGroupMember = { buildTermQuery: (term: string) => string };

function getGroupableIncludesValue(query: QueryLeaf): string | null {
  if (query.matchMode !== "includes" || query.isNegated === true) {
    return null;
  }

  switch (query.target) {
    case "string":
    case "title":
    case "description":
    case "image":
    case "periods":
    case "bibliography":
    case "notes": {
      return query.value;
    }
    case "property": {
      if (
        !("value" in query) ||
        query.value == null ||
        query.dataType === "IDREF"
      ) {
        return null;
      }

      return query.value;
    }
  }
}

function isQueryLeaf(query: Query): query is QueryLeaf {
  return "target" in query;
}

function getQueryGroupChildren(query: QueryGroup): Array<Query> {
  return "and" in query ? query.and : query.or;
}

function getQueryGroupOperator(query: QueryGroup): "and" | "or" {
  return "and" in query ? "and" : "or";
}

function getCompatibleIncludesGroupLeaves(
  query: QueryGroup,
): Array<QueryLeaf> | null {
  if (!("or" in query) || query.or.length <= 1) {
    return null;
  }

  const leafQueries: Array<QueryLeaf> = [];

  for (const childQuery of query.or) {
    if (!isQueryLeaf(childQuery)) {
      return null;
    }

    leafQueries.push(childQuery);
  }

  const firstQuery = leafQueries[0];

  if (firstQuery == null) {
    return null;
  }

  const groupValue = getGroupableIncludesValue(firstQuery);

  if (groupValue == null) {
    return null;
  }

  for (const leafQuery of leafQueries) {
    if (
      getGroupableIncludesValue(leafQuery) !== groupValue ||
      leafQuery.isCaseSensitive !== firstQuery.isCaseSensitive ||
      leafQuery.language !== firstQuery.language
    ) {
      return null;
    }
  }

  return leafQueries;
}

function buildIncludesGroupMember(query: QueryLeaf): IncludesGroupMember {
  return {
    buildTermQuery: (term) =>
      buildLeafValueQueryExpression({
        query,
        value: term,
        matchMode: "includes",
      }),
  };
}

function buildIncludesGroupQueryExpression(queries: Array<QueryLeaf>): string {
  const firstQuery = queries[0];

  if (firstQuery == null) {
    throw new Error("Cannot build an includes group without queries");
  }

  const groupValue = getGroupableIncludesValue(firstQuery);

  if (groupValue == null) {
    throw new Error("Cannot build an includes group without a search value");
  }

  const terms = tokenizeIncludesSearchValue({
    value: groupValue,
    isCaseSensitive: firstQuery.isCaseSensitive,
  });

  if (terms.length === 0) {
    return "cts:false-query()";
  }

  const members = queries.map((query) => buildIncludesGroupMember(query));
  const perTermQueryExpressions: Array<string> = [];

  for (const term of terms) {
    const fieldQueryExpressions: Array<string> = [];

    for (const member of members) {
      fieldQueryExpressions.push(member.buildTermQuery(term));
    }

    perTermQueryExpressions.push(
      buildOrCtsQueryExpressionInternal(fieldQueryExpressions),
    );
  }

  return buildAndCtsQueryExpressionInternal(perTermQueryExpressions);
}

function buildQueryNode(query: Query): string {
  if (isQueryLeaf(query)) {
    const queryExpression = buildLeafQueryExpression(query);

    return query.isNegated === true ?
        buildNotCtsQueryExpression(queryExpression)
      : queryExpression;
  }

  const optimizedIncludesGroupQueries = getCompatibleIncludesGroupLeaves(query);

  if (optimizedIncludesGroupQueries != null) {
    return buildIncludesGroupQueryExpression(optimizedIncludesGroupQueries);
  }

  const childQueryExpressions: Array<string> = [];

  for (const childQuery of getQueryGroupChildren(query)) {
    childQueryExpressions.push(buildQueryNode(childQuery));
  }

  return getQueryGroupOperator(query) === "and" ?
      buildAndCtsQueryExpressionInternal(childQueryExpressions)
    : buildOrCtsQueryExpressionInternal(childQueryExpressions);
}

export function buildBelongsToCollectionQueryExpression(
  belongsToCollectionScopeUuids: Array<string>,
  belongsToCollectionPropertyVariableUuid: string,
): string | null {
  if (belongsToCollectionScopeUuids.length === 0) {
    return null;
  }

  const collectionValueQueryExpressions: Array<string> = [];

  for (const uuid of belongsToCollectionScopeUuids) {
    collectionValueQueryExpressions.push(
      buildPlainElementAttributeValueQueryExpression({
        elementName: "value",
        attributeName: "uuid",
        value: uuid,
      }),
    );
  }

  return buildPropertyQueryExpression({
    propertyVariable: belongsToCollectionPropertyVariableUuid,
    queryExpression: buildNestedElementQuery(
      ["value"],
      buildOrCtsQueryExpressionInternal(collectionValueQueryExpressions),
    ),
  });
}

export function buildQueryPlan(params: { queries: Query | null }): {
  queryExpression: string | null;
} {
  const { queries } = params;

  if (queries == null) {
    return { queryExpression: null };
  }

  return { queryExpression: buildQueryNode(queries) };
}
