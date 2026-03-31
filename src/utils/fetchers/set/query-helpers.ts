import type {
  ApiVersion,
  Query,
  QueryGroup,
  QueryLeaf,
} from "../../../types/index.js";
import { stringLiteral } from "../../internal.js";

const CTS_INCLUDES_STOP_WORDS: Array<string> = [
  "and",
  "at",
  "in",
  "it",
  "of",
  "the",
  "to",
];
const CTS_INCLUDES_STOP_WORDS_VAR = "$ctsIncludesStopWords";
const CTS_INCLUDES_TOKEN_SPLIT_REGEX = /\W+/u;

type CompiledQueryClause = {
  declarations: Array<string>;
  predicate: string;
  candidateQueryVar: string | null;
};

type CompiledQueryPlan = {
  declarations: Array<string>;
  itemsExpression: string;
  predicate: string;
};

type CompiledQueryNode = {
  declarations: Array<string>;
  predicate: string;
  candidateQueryVars: Array<string>;
};

type TokenizedSearchDeclarations = {
  declarations: Array<string>;
  termsVar: string;
};

type CandidateTermQueryBuilder = (termExpression: string) => string;

type ItemStringQuery = Extract<QueryLeaf, { target: "string" }>;
type ContentTargetQuery = Extract<
  QueryLeaf,
  { target: "title" | "description" | "image" | "periods" | "bibliography" }
>;
type PropertyQuery = Extract<QueryLeaf, { target: "property" }>;
type StringPropertyQuery = PropertyQuery & {
  dataType: "string";
  value: string;
};

type IncludesGroupMember = {
  rawPredicate: string;
  buildTokenPredicate: (termsExpression: string) => string;
  buildCandidateTermQuery: CandidateTermQueryBuilder;
};

type ContentTargetConfig = {
  containerElementName: string;
  getContentNodesExpression: (language: string) => string;
};

const CONTENT_TARGET_CONFIGS = {
  title: {
    containerElementName: "identification",
    getContentNodesExpression: (language) =>
      `identification/label/content[@xml:lang="${language}"]`,
  },
  description: {
    containerElementName: "description",
    getContentNodesExpression: (language) =>
      `description/content[@xml:lang="${language}"]`,
  },
  image: {
    containerElementName: "image",
    getContentNodesExpression: (language) =>
      `image/identification/label/content[@xml:lang="${language}"]`,
  },
  periods: {
    containerElementName: "period",
    getContentNodesExpression: (language) =>
      `periods/period/identification/label/content[@xml:lang="${language}"]`,
  },
  bibliography: {
    containerElementName: "bibliography",
    getContentNodesExpression: (language) =>
      `bibliographies/bibliography/identification/label/content[@xml:lang="${language}"]`,
  },
} satisfies Record<ContentTargetQuery["target"], ContentTargetConfig>;

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

    if (
      normalizedTerm !== "" &&
      !CTS_INCLUDES_STOP_WORDS.includes(normalizedTerm)
    ) {
      terms.push(term);
    }
  }

  return terms;
}

function buildFlattenedContentValuesExpression(
  contentNodesExpression: string,
): string {
  return `for $content in ${contentNodesExpression}
    return string-join($content//text(), "")`;
}

function buildNodeStringValuesExpression(nodesExpression: string): string {
  return `for $node in ${nodesExpression}
    return string($node)`;
}

function buildSearchableContentNodesExpression(
  contentNodesExpression: string,
): string {
  return `for $content in ${contentNodesExpression}
    return (
      $content//string[not(ancestor::string)],
      $content[not(.//string)]
    )`;
}

function buildCombinedSearchableContentNodesExpression(
  contentNodesExpressions: Array<string>,
): string {
  const searchableExpressions: Array<string> = [];

  for (const contentNodesExpression of contentNodesExpressions) {
    searchableExpressions.push(
      buildSearchableContentNodesExpression(contentNodesExpression),
    );
  }

  if (searchableExpressions.length === 0) {
    return "()";
  }

  if (searchableExpressions.length === 1) {
    return searchableExpressions[0] ?? "()";
  }

  return `(${searchableExpressions.join(", ")})`;
}

function buildTokenizedSearchPredicate(params: {
  searchableNodesExpression: string;
  termsExpression: string;
  isCaseSensitive: boolean;
}): string {
  const { searchableNodesExpression, termsExpression, isCaseSensitive } =
    params;

  return `(every $term in ${termsExpression}
  satisfies some $searchNode in (${searchableNodesExpression})
    satisfies cts:contains(
      $searchNode,
      ${buildCtsWordQueryExpression({
        termExpression: "$term",
        isCaseSensitive,
      })}
    ))`;
}

/**
 * Build a string match predicate for an XQuery string.
 */
function buildRawStringMatchPredicate(params: {
  valueExpression: string;
  value: string;
  matchMode: "includes" | "exact";
  isCaseSensitive: boolean;
}): string {
  const { valueExpression, value, matchMode, isCaseSensitive } = params;
  const comparedValue = isCaseSensitive ? value : value.toLowerCase();
  const comparedValueLiteral = stringLiteral(comparedValue);
  const candidateVar = "$candidate";
  const comparedCandidate =
    isCaseSensitive ? candidateVar : `lower-case(${candidateVar})`;

  if (matchMode === "includes") {
    return `some ${candidateVar} in (${valueExpression})
  satisfies contains(${comparedCandidate}, ${comparedValueLiteral})`;
  }

  return `some ${candidateVar} in (${valueExpression})
  satisfies ${comparedCandidate} = ${comparedValueLiteral}`;
}

/**
 * Build a combined raw string match predicate for multiple paths.
 */
function buildCombinedRawStringMatchPredicate(params: {
  valueExpressions: Array<string>;
  value: string;
  matchMode: "includes" | "exact";
  isCaseSensitive: boolean;
}): string {
  const { valueExpressions, value, matchMode, isCaseSensitive } = params;
  const predicates: Array<string> = [];

  for (const valueExpression of valueExpressions) {
    predicates.push(
      buildRawStringMatchPredicate({
        valueExpression,
        value,
        matchMode,
        isCaseSensitive,
      }),
    );
  }

  return buildOrPredicate(predicates);
}

/**
 * Build CTS word-query options for API v2 includes search.
 */
function buildCtsQueryOptionsExpression(isCaseSensitive: boolean): string {
  const options: Array<string> = [
    isCaseSensitive ? "case-sensitive" : "case-insensitive",
    "diacritic-insensitive",
    "punctuation-insensitive",
  ];

  return `(${options.map((option) => stringLiteral(option)).join(", ")})`;
}

/**
 * Build a CTS word-query expression for an XQuery term.
 */
function buildCtsWordQueryExpression(params: {
  termExpression: string;
  isCaseSensitive: boolean;
}): string {
  const { termExpression, isCaseSensitive } = params;

  return `cts:word-query(${termExpression}, ${buildCtsQueryOptionsExpression(isCaseSensitive)})`;
}

/**
 * Build tokenized search declarations for CTS-backed queries.
 */
function buildTokenizedSearchDeclarations(params: {
  value: string;
  isCaseSensitive: boolean;
  queryKey: string;
}): TokenizedSearchDeclarations {
  const { value, isCaseSensitive, queryKey } = params;
  const searchStringVar = `$query${queryKey}SearchString`;
  const rawTermsVar = `$query${queryKey}RawTerms`;
  const termsVar = `$query${queryKey}Terms`;
  const tokenSourceExpression =
    isCaseSensitive ? searchStringVar : `fn:lower-case(${searchStringVar})`;

  return {
    declarations: [
      `let ${searchStringVar} := ${stringLiteral(value)}`,
      String.raw`let ${rawTermsVar} := fn:tokenize(${tokenSourceExpression}, "\W+")`,
      `let ${termsVar} :=
  for $term in ${rawTermsVar}
    let $normalizedTerm := fn:lower-case($term)
    where $normalizedTerm ne "" and not($normalizedTerm = ${CTS_INCLUDES_STOP_WORDS_VAR})
    return $term`,
    ],
    termsVar,
  };
}

function buildTokenizedCtsClause(params: {
  value: string;
  isCaseSensitive: boolean;
  queryKey: string;
  fallbackPredicate: string;
  buildTermQueryExpression: CandidateTermQueryBuilder;
  buildTokenPredicate: (termsExpression: string) => string;
}): CompiledQueryClause {
  const {
    value,
    isCaseSensitive,
    queryKey,
    fallbackPredicate,
    buildTermQueryExpression,
    buildTokenPredicate,
  } = params;
  const tokenizedSearchDeclarations = buildTokenizedSearchDeclarations({
    value,
    isCaseSensitive,
    queryKey,
  });
  const termQueriesVar = `$query${queryKey}TermQueries`;
  const candidateQueryVar = `$query${queryKey}CandidateQuery`;
  const tokenizedTerms = tokenizeIncludesSearchValue({
    value,
    isCaseSensitive,
  });

  if (tokenizedTerms.length === 0) {
    return {
      declarations: [],
      predicate: fallbackPredicate,
      candidateQueryVar: null,
    };
  }

  return {
    declarations: [
      ...tokenizedSearchDeclarations.declarations,
      `let ${termQueriesVar} :=
  for $term in ${tokenizedSearchDeclarations.termsVar}
    return ${buildTermQueryExpression("$term")}`,
      `let ${candidateQueryVar} :=
  if (count(${tokenizedSearchDeclarations.termsVar}) = 1)
  then ${termQueriesVar}[1]
  else if (count(${tokenizedSearchDeclarations.termsVar}) gt 1)
  then cts:and-query(${termQueriesVar})
  else ()`,
    ],
    predicate: buildTokenPredicate(tokenizedSearchDeclarations.termsVar),
    candidateQueryVar,
  };
}

function buildCtsIncludesPredicate(params: {
  searchableNodesExpression: string;
  fallbackValueExpression: string;
  value: string;
  isCaseSensitive: boolean;
  queryKey: string;
  buildCandidateTermQuery: CandidateTermQueryBuilder;
}): CompiledQueryClause {
  const {
    searchableNodesExpression,
    fallbackValueExpression,
    value,
    isCaseSensitive,
    queryKey,
    buildCandidateTermQuery,
  } = params;

  return buildTokenizedCtsClause({
    value,
    isCaseSensitive,
    queryKey,
    fallbackPredicate: buildRawStringMatchPredicate({
      valueExpression: fallbackValueExpression,
      value,
      matchMode: "includes",
      isCaseSensitive,
    }),
    buildTermQueryExpression: buildCandidateTermQuery,
    buildTokenPredicate: (termsExpression) =>
      buildTokenizedSearchPredicate({
        searchableNodesExpression,
        termsExpression,
        isCaseSensitive,
      }),
  });
}

/**
 * Build the raw search paths for item-level string search.
 */
function buildItemStringSearchPaths(language: string): Array<string> {
  return [
    buildFlattenedContentValuesExpression(
      `identification/label/content[@xml:lang="${language}"]`,
    ),
    buildFlattenedContentValuesExpression(
      `properties//property/value[not(@inherited="true")]/content[@xml:lang="${language}"]`,
    ),
  ];
}

function buildItemStringSearchableNodesExpression(language: string): string {
  return buildCombinedSearchableContentNodesExpression([
    `identification/label/content[@xml:lang="${language}"]`,
    `properties//property/value[not(@inherited="true")]/content[@xml:lang="${language}"]`,
  ]);
}

/**
 * Build the identification branch for an item-level CTS string search.
 */
function buildItemStringIdentificationBranch(params: {
  termExpression: string;
  isCaseSensitive: boolean;
  language: string;
}): string {
  const { termExpression, isCaseSensitive, language } = params;

  return `cts:element-query(xs:QName("identification"),
        cts:and-query((
          cts:element-attribute-value-query(xs:QName("content"), xs:QName("xml:lang"), ${stringLiteral(language)}),
          ${buildCtsWordQueryExpression({ termExpression, isCaseSensitive })}
        ))
      )`;
}

/**
 * Build the property value branch for an item-level CTS string search.
 */
function buildItemStringPropertyValueBranch(params: {
  termExpression: string;
  isCaseSensitive: boolean;
  language: string;
}): string {
  const { termExpression, isCaseSensitive, language } = params;

  return `cts:element-query(xs:QName("properties"),
        cts:element-query(xs:QName("property"),
          cts:element-query(xs:QName("value"),
            cts:and-query((
              cts:not-query(cts:element-attribute-value-query(xs:QName("value"), xs:QName("inherited"), "true")),
              cts:element-query(xs:QName("content"),
                cts:and-query((
                  cts:element-attribute-value-query(xs:QName("content"), xs:QName("xml:lang"), ${stringLiteral(language)}),
                  ${buildCtsWordQueryExpression({ termExpression, isCaseSensitive })}
                ))
              )
            ))
          )
        )
      )`;
}

/**
 * Build an item-level CTS string search predicate.
 */
function buildItemStringSearchClause(params: {
  query: ItemStringQuery;
  version: ApiVersion;
  queryKey: string;
}): CompiledQueryClause {
  const { query, version, queryKey } = params;
  const fallbackPredicate = buildCombinedRawStringMatchPredicate({
    valueExpressions: buildItemStringSearchPaths(query.language),
    value: query.value,
    matchMode: query.matchMode,
    isCaseSensitive: query.isCaseSensitive,
  });

  if (query.matchMode !== "includes" || version !== 2) {
    return {
      declarations: [],
      predicate: fallbackPredicate,
      candidateQueryVar: null,
    };
  }

  return buildCtsIncludesPredicate({
    searchableNodesExpression: buildItemStringSearchableNodesExpression(
      query.language,
    ),
    fallbackValueExpression: `(${buildItemStringSearchPaths(query.language).join(", ")})`,
    value: query.value,
    isCaseSensitive: query.isCaseSensitive,
    queryKey,
    buildCandidateTermQuery: (termExpression) =>
      `cts:or-query((
        ${buildItemStringIdentificationBranch({
          termExpression,
          isCaseSensitive: query.isCaseSensitive,
          language: query.language,
        })},
        ${buildItemStringPropertyValueBranch({
          termExpression,
          isCaseSensitive: query.isCaseSensitive,
          language: query.language,
        })}
      ))`,
  });
}

function buildOrPredicate(predicates: Array<string>): string {
  if (predicates.length === 0) {
    return "false()";
  }

  if (predicates.length === 1) {
    return predicates[0] ?? "false()";
  }

  return `(${predicates.join(" or ")})`;
}

function buildAndPredicate(predicates: Array<string>): string {
  if (predicates.length === 0) {
    return "true()";
  }

  if (predicates.length === 1) {
    return predicates[0] ?? "true()";
  }

  return `(${predicates.join(" and ")})`;
}

/**
 * Build a date/dateTime range predicate for an XQuery string.
 */
function buildDateRangePredicate(params: {
  from?: string;
  to?: string;
}): string {
  const { from, to } = params;
  const conditions: Array<string> = [];

  if (from != null) {
    conditions.push(`(value/@rawValue ge ${stringLiteral(from)})`);
  }

  if (to != null) {
    conditions.push(`(value/@rawValue le ${stringLiteral(to)})`);
  }

  return buildAndPredicate(conditions);
}

/**
 * Build a property label predicate for an XQuery string.
 */
function buildPropertyLabelPredicate(propertyVariable: string): string {
  return `label[@uuid=${stringLiteral(propertyVariable)}]`;
}

function buildOrCtsQueryExpression(queries: Array<string>): string {
  if (queries.length === 1) {
    return queries[0] ?? "cts:false-query()";
  }

  return `cts:or-query((${queries.join(", ")}))`;
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

function getContentTargetConfig(
  target: ContentTargetQuery["target"],
): ContentTargetConfig {
  return CONTENT_TARGET_CONFIGS[target];
}

function buildContentTargetCandidateBranch(params: {
  containerElementName: string;
  termExpression: string;
  isCaseSensitive: boolean;
  language: string;
}): string {
  const { containerElementName, termExpression, isCaseSensitive, language } =
    params;

  return `cts:element-query(xs:QName("${containerElementName}"),
        cts:and-query((
          cts:element-attribute-value-query(xs:QName("content"), xs:QName("xml:lang"), ${stringLiteral(language)}),
          ${buildCtsWordQueryExpression({ termExpression, isCaseSensitive })}
        ))
      )`;
}

function buildPropertyStringCandidateBranch(params: {
  termExpression: string;
  isCaseSensitive: boolean;
  language: string;
}): string {
  const { termExpression, isCaseSensitive, language } = params;

  return `cts:element-query(xs:QName("properties"),
        cts:element-query(xs:QName("property"),
          cts:element-query(xs:QName("value"),
            cts:and-query((
              cts:not-query(cts:element-attribute-value-query(xs:QName("value"), xs:QName("inherited"), "true")),
              cts:element-query(xs:QName("content"),
                cts:and-query((
                  cts:element-attribute-value-query(xs:QName("content"), xs:QName("xml:lang"), ${stringLiteral(language)}),
                  ${buildCtsWordQueryExpression({ termExpression, isCaseSensitive })}
                ))
              )
            ))
          )
        )
      )`;
}

function buildPropertyRawValueCandidateBranch(params: {
  termExpression: string;
  isCaseSensitive: boolean;
}): string {
  const { termExpression, isCaseSensitive } = params;

  return `cts:element-query(xs:QName("properties"),
        cts:element-query(xs:QName("property"),
          cts:element-attribute-word-query(
            xs:QName("value"),
            xs:QName("rawValue"),
            ${termExpression},
            ${buildCtsQueryOptionsExpression(isCaseSensitive)}
          )
        )
      )`;
}

function buildPropertySimpleValueTextCandidateBranch(params: {
  termExpression: string;
  isCaseSensitive: boolean;
}): string {
  const { termExpression, isCaseSensitive } = params;

  return `cts:element-query(xs:QName("properties"),
        cts:element-query(xs:QName("property"),
          cts:element-word-query(
            xs:QName("value"),
            ${termExpression},
            ${buildCtsQueryOptionsExpression(isCaseSensitive)}
          )
        )
      )`;
}

function buildPropertySimpleValueRawValueExpression(): string {
  return buildNodeStringValuesExpression("value/@rawValue");
}

function buildPropertySimpleValueTextExpression(): string {
  return buildNodeStringValuesExpression("value[not(*)]/text()");
}

function buildPropertySimpleValueSearchableNodesExpression(): string {
  return "value[not(*)]";
}

function buildPropertyRawValueOrTextRawPredicate(params: {
  value: string;
  matchMode: "includes" | "exact";
  isCaseSensitive: boolean;
}): string {
  const { value, matchMode, isCaseSensitive } = params;

  return buildOrPredicate([
    buildRawStringMatchPredicate({
      valueExpression: buildPropertySimpleValueRawValueExpression(),
      value,
      matchMode,
      isCaseSensitive,
    }),
    buildRawStringMatchPredicate({
      valueExpression: buildPropertySimpleValueTextExpression(),
      value,
      matchMode,
      isCaseSensitive,
    }),
  ]);
}

function buildPropertyRawValueOrTextTokenPredicate(params: {
  termsExpression: string;
  isCaseSensitive: boolean;
}): string {
  const { termsExpression, isCaseSensitive } = params;
  const rawValueQuery = `cts:element-attribute-word-query(
        xs:QName("value"),
        xs:QName("rawValue"),
        $term,
        ${buildCtsQueryOptionsExpression(isCaseSensitive)}
      )`;
  const textQuery = `cts:element-word-query(
        xs:QName("value"),
        $term,
        ${buildCtsQueryOptionsExpression(isCaseSensitive)}
      )`;

  return `(every $term in ${termsExpression}
  satisfies some $searchNode in (${buildPropertySimpleValueSearchableNodesExpression()})
    satisfies (
      cts:contains($searchNode, ${rawValueQuery})
      or
      cts:contains($searchNode, ${textQuery})
    ))`;
}

function buildIncludesGroupMemberFromTokenSource(params: {
  rawPredicate: string;
  searchableNodesExpression: string;
  isCaseSensitive: boolean;
  buildCandidateTermQuery: CandidateTermQueryBuilder;
}): IncludesGroupMember {
  const {
    rawPredicate,
    searchableNodesExpression,
    isCaseSensitive,
    buildCandidateTermQuery,
  } = params;

  return {
    rawPredicate,
    buildTokenPredicate: (termsExpression) =>
      buildTokenizedSearchPredicate({
        searchableNodesExpression,
        termsExpression,
        isCaseSensitive,
      }),
    buildCandidateTermQuery,
  };
}

function getGroupableIncludesValue(query: QueryLeaf): string | null {
  switch (query.target) {
    case "string":
    case "title":
    case "description":
    case "image":
    case "periods":
    case "bibliography": {
      return query.value;
    }
    case "property": {
      if (query.dataType === "IDREF") {
        return null;
      }

      if (query.dataType === "date" || query.dataType === "dateTime") {
        return "value" in query && query.value != null ? query.value : null;
      }

      return query.value ?? null;
    }
  }
}

function isCompatibleIncludesGroupQuery(params: {
  query: QueryLeaf;
  value: string;
  isCaseSensitive: boolean;
  language: string;
  version: ApiVersion;
}): boolean {
  const { query, value, isCaseSensitive, language, version } = params;

  if (
    version !== 2 ||
    query.matchMode !== "includes" ||
    query.isNegated === true
  ) {
    return false;
  }

  const queryValue = getGroupableIncludesValue(query);

  return (
    queryValue != null &&
    queryValue === value &&
    query.isCaseSensitive === isCaseSensitive &&
    query.language === language
  );
}

function buildContentTargetIncludesGroupMember(params: {
  query: ContentTargetQuery;
}): IncludesGroupMember {
  const { query } = params;
  const config = getContentTargetConfig(query.target);
  const contentNodesExpression = config.getContentNodesExpression(
    query.language,
  );

  return buildIncludesGroupMemberFromTokenSource({
    rawPredicate: buildRawStringMatchPredicate({
      valueExpression: buildFlattenedContentValuesExpression(
        contentNodesExpression,
      ),
      value: query.value,
      matchMode: "includes",
      isCaseSensitive: query.isCaseSensitive,
    }),
    searchableNodesExpression: buildSearchableContentNodesExpression(
      contentNodesExpression,
    ),
    isCaseSensitive: query.isCaseSensitive,
    buildCandidateTermQuery: (termExpression) =>
      buildContentTargetCandidateBranch({
        containerElementName: config.containerElementName,
        termExpression,
        isCaseSensitive: query.isCaseSensitive,
        language: query.language,
      }),
  });
}

function buildItemStringIncludesGroupMember(
  query: ItemStringQuery,
): IncludesGroupMember {
  return buildIncludesGroupMemberFromTokenSource({
    rawPredicate: buildCombinedRawStringMatchPredicate({
      valueExpressions: buildItemStringSearchPaths(query.language),
      value: query.value,
      matchMode: "includes",
      isCaseSensitive: query.isCaseSensitive,
    }),
    searchableNodesExpression: buildItemStringSearchableNodesExpression(
      query.language,
    ),
    isCaseSensitive: query.isCaseSensitive,
    buildCandidateTermQuery: (termExpression) =>
      `cts:or-query((
        ${buildItemStringIdentificationBranch({
          termExpression,
          isCaseSensitive: query.isCaseSensitive,
          language: query.language,
        })},
        ${buildItemStringPropertyValueBranch({
          termExpression,
          isCaseSensitive: query.isCaseSensitive,
          language: query.language,
        })}
      ))`,
  });
}

function buildPropertyStringIncludesGroupMember(
  query: StringPropertyQuery,
): IncludesGroupMember {
  const propertyVariable = query.propertyVariable;
  const predicateParts: Array<string> = [];
  const propertyContentNodesExpression = `value[not(@inherited="true")]/content[@xml:lang="${query.language}"]`;
  const valueExpression = buildFlattenedContentValuesExpression(
    propertyContentNodesExpression,
  );
  const propertyValue = query.value;

  if (propertyVariable != null) {
    predicateParts.push(buildPropertyLabelPredicate(propertyVariable));
  }

  return buildIncludesGroupMemberFromTokenSource({
    rawPredicate: buildPropertyPredicateExpression([
      ...predicateParts,
      buildRawStringMatchPredicate({
        valueExpression,
        value: propertyValue,
        matchMode: "includes",
        isCaseSensitive: query.isCaseSensitive,
      }),
    ]),
    searchableNodesExpression: buildPropertyPredicateExpression([
      ...predicateParts,
      buildSearchableContentNodesExpression(propertyContentNodesExpression),
    ]),
    isCaseSensitive: query.isCaseSensitive,
    buildCandidateTermQuery: (termExpression) =>
      buildPropertyStringCandidateBranch({
        termExpression,
        isCaseSensitive: query.isCaseSensitive,
        language: query.language,
      }),
  });
}

function buildPropertyRawValueOrTextIncludesGroupMember(
  query: PropertyQuery,
): IncludesGroupMember {
  const propertyVariable = query.propertyVariable;
  const predicateParts: Array<string> = [];
  const propertyValue = getGroupableIncludesValue(query);

  if (propertyValue == null) {
    throw new Error(
      "Cannot build a rawValue/text includes group without a search value",
    );
  }

  if (propertyVariable != null) {
    predicateParts.push(buildPropertyLabelPredicate(propertyVariable));
  }

  return {
    rawPredicate: buildPropertyPredicateExpression([
      ...predicateParts,
      buildPropertyRawValueOrTextRawPredicate({
        value: propertyValue,
        matchMode: "includes",
        isCaseSensitive: query.isCaseSensitive,
      }),
    ]),
    buildTokenPredicate: (termsExpression) =>
      buildPropertyPredicateExpression([
        ...predicateParts,
        buildPropertyRawValueOrTextTokenPredicate({
          termsExpression,
          isCaseSensitive: query.isCaseSensitive,
        }),
      ]),
    buildCandidateTermQuery: (termExpression) =>
      buildOrCtsQueryExpression([
        buildPropertyRawValueCandidateBranch({
          termExpression,
          isCaseSensitive: query.isCaseSensitive,
        }),
        buildPropertySimpleValueTextCandidateBranch({
          termExpression,
          isCaseSensitive: query.isCaseSensitive,
        }),
      ]),
  };
}

function buildIncludesGroupMember(query: QueryLeaf): IncludesGroupMember {
  switch (query.target) {
    case "string": {
      return buildItemStringIncludesGroupMember(query);
    }
    case "title":
    case "description":
    case "periods":
    case "bibliography":
    case "image": {
      return buildContentTargetIncludesGroupMember({ query });
    }
    case "property": {
      if (query.dataType === "string") {
        return buildPropertyStringIncludesGroupMember(
          query as StringPropertyQuery,
        );
      }

      return buildPropertyRawValueOrTextIncludesGroupMember(query);
    }
  }
}

function getCompatibleIncludesGroupLeaves(params: {
  query: QueryGroup;
  version: ApiVersion;
}): Array<QueryLeaf> | null {
  const { query, version } = params;

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

  if (
    groupValue == null ||
    !isCompatibleIncludesGroupQuery({
      query: firstQuery,
      value: groupValue,
      isCaseSensitive: firstQuery.isCaseSensitive,
      language: firstQuery.language,
      version,
    })
  ) {
    return null;
  }

  for (const leafQuery of leafQueries.slice(1)) {
    if (
      !isCompatibleIncludesGroupQuery({
        query: leafQuery,
        value: groupValue,
        isCaseSensitive: firstQuery.isCaseSensitive,
        language: firstQuery.language,
        version,
      })
    ) {
      return null;
    }
  }

  return leafQueries;
}

function buildIncludesGroupClause(params: {
  queries: Array<QueryLeaf>;
  queryKey: string;
}): CompiledQueryClause {
  const { queries, queryKey } = params;
  const firstQuery = queries[0];

  if (firstQuery == null) {
    throw new Error("Cannot build an includes group without queries");
  }

  const groupValue = getGroupableIncludesValue(firstQuery);

  if (groupValue == null) {
    throw new Error("Cannot build an includes group without a search value");
  }

  const members = queries.map((query) => buildIncludesGroupMember(query));

  return buildTokenizedCtsClause({
    value: groupValue,
    isCaseSensitive: firstQuery.isCaseSensitive,
    queryKey,
    fallbackPredicate: buildOrPredicate(
      members.map((member) => member.rawPredicate),
    ),
    buildTermQueryExpression: (termExpression) =>
      buildOrCtsQueryExpression(
        members.map((member) => member.buildCandidateTermQuery(termExpression)),
      ),
    buildTokenPredicate: (termsExpression) =>
      buildOrPredicate(
        members.map((member) => member.buildTokenPredicate(termsExpression)),
      ),
  });
}

/**
 * Build a string match predicate for an XQuery string.
 */
function buildStringMatchClause(params: {
  contentNodesExpression: string;
  value: string;
  matchMode: "includes" | "exact";
  isCaseSensitive: boolean;
  version: ApiVersion;
  queryKey: string;
  buildCandidateTermQuery?: CandidateTermQueryBuilder;
}): CompiledQueryClause {
  const {
    contentNodesExpression,
    value,
    matchMode,
    isCaseSensitive,
    version,
    queryKey,
    buildCandidateTermQuery,
  } = params;
  const valueExpression = buildFlattenedContentValuesExpression(
    contentNodesExpression,
  );

  if (
    matchMode === "includes" &&
    version === 2 &&
    buildCandidateTermQuery != null
  ) {
    return buildCtsIncludesPredicate({
      searchableNodesExpression: buildSearchableContentNodesExpression(
        contentNodesExpression,
      ),
      fallbackValueExpression: valueExpression,
      value,
      isCaseSensitive,
      queryKey,
      buildCandidateTermQuery,
    });
  }

  return {
    declarations: [],
    predicate: buildRawStringMatchPredicate({
      valueExpression,
      value,
      matchMode,
      isCaseSensitive,
    }),
    candidateQueryVar: null,
  };
}

function buildPropertyValueAttributePredicate(params: {
  value: string;
  attributeName: "rawValue" | "uuid";
}): string {
  const { value, attributeName } = params;

  return `value[@${attributeName}=${stringLiteral(value)}]`;
}

function buildPropertyRawValueOrTextMatchClause(params: {
  value: string;
  matchMode: "includes" | "exact";
  isCaseSensitive: boolean;
  version: ApiVersion;
  queryKey: string;
}): CompiledQueryClause {
  const { value, matchMode, isCaseSensitive, version, queryKey } = params;
  const fallbackPredicate = buildPropertyRawValueOrTextRawPredicate(params);

  if (matchMode !== "includes" || version !== 2) {
    return {
      declarations: [],
      predicate: fallbackPredicate,
      candidateQueryVar: null,
    };
  }

  return buildTokenizedCtsClause({
    value,
    isCaseSensitive,
    queryKey,
    fallbackPredicate,
    buildTermQueryExpression: (termExpression) =>
      buildOrCtsQueryExpression([
        buildPropertyRawValueCandidateBranch({
          termExpression,
          isCaseSensitive,
        }),
        buildPropertySimpleValueTextCandidateBranch({
          termExpression,
          isCaseSensitive,
        }),
      ]),
    buildTokenPredicate: (termsExpression) =>
      buildPropertyRawValueOrTextTokenPredicate({
        termsExpression,
        isCaseSensitive,
      }),
  });
}

function buildPropertyPredicateExpression(
  propertyPredicates: Array<string>,
): string {
  let propertyExpression = ".//properties//property";

  for (const propertyPredicate of propertyPredicates) {
    propertyExpression += `[${propertyPredicate}]`;
  }

  return propertyExpression;
}

function buildPropertyStringValueClause(params: {
  query: StringPropertyQuery;
  version: ApiVersion;
  queryKey: string;
}): CompiledQueryClause {
  const { query, version, queryKey } = params;
  const propertyContentNodesExpression =
    query.matchMode === "includes" && version === 2 ?
      `value[not(@inherited="true")]/content[@xml:lang="${query.language}"]`
    : `value/content[@xml:lang="${query.language}"]`;

  return buildStringMatchClause({
    contentNodesExpression: propertyContentNodesExpression,
    value: query.value,
    matchMode: query.matchMode,
    isCaseSensitive: query.isCaseSensitive,
    version,
    queryKey,
    buildCandidateTermQuery: (termExpression) =>
      buildPropertyStringCandidateBranch({
        termExpression,
        isCaseSensitive: query.isCaseSensitive,
        language: query.language,
      }),
  });
}

/**
 * Build a property predicate for an XQuery string.
 */
function buildPropertyClause(params: {
  query: PropertyQuery;
  version: ApiVersion;
  queryKey: string;
}): CompiledQueryClause {
  const { query, version, queryKey } = params;
  const predicateParts: Array<string> = [];
  const declarations: Array<string> = [];
  const propertyVariable = query.propertyVariable;
  let candidateQueryVar: string | null = null;

  if (propertyVariable != null) {
    predicateParts.push(buildPropertyLabelPredicate(propertyVariable));
  }

  if (query.dataType === "date" || query.dataType === "dateTime") {
    if ("value" in query && query.value != null) {
      const compiledScalarClause = buildPropertyRawValueOrTextMatchClause({
        value: query.value,
        matchMode: query.matchMode,
        isCaseSensitive: query.isCaseSensitive,
        version,
        queryKey,
      });

      declarations.push(...compiledScalarClause.declarations);
      predicateParts.push(compiledScalarClause.predicate);
      candidateQueryVar = compiledScalarClause.candidateQueryVar;
    } else {
      predicateParts.push(
        buildDateRangePredicate({ from: query.from, to: query.to }),
      );
    }
  } else if (query.value != null) {
    switch (query.dataType) {
      case "IDREF": {
        predicateParts.push(
          buildPropertyValueAttributePredicate({
            value: query.value,
            attributeName: "uuid",
          }),
        );
        break;
      }
      case "integer":
      case "decimal":
      case "time":
      case "boolean": {
        const compiledScalarClause = buildPropertyRawValueOrTextMatchClause({
          value: query.value,
          matchMode: query.matchMode,
          isCaseSensitive: query.isCaseSensitive,
          version,
          queryKey,
        });

        declarations.push(...compiledScalarClause.declarations);
        predicateParts.push(compiledScalarClause.predicate);
        candidateQueryVar = compiledScalarClause.candidateQueryVar;
        break;
      }
      case "string": {
        const compiledStringClause = buildPropertyStringValueClause({
          query: query as StringPropertyQuery,
          version,
          queryKey,
        });

        declarations.push(...compiledStringClause.declarations);
        predicateParts.push(compiledStringClause.predicate);
        candidateQueryVar = compiledStringClause.candidateQueryVar;
        break;
      }
    }
  }

  return {
    declarations,
    predicate: buildPropertyPredicateExpression(predicateParts),
    candidateQueryVar,
  };
}

/**
 * Build a query predicate for an XQuery string.
 */
function buildQueryClause(params: {
  query: QueryLeaf;
  version: ApiVersion;
  queryKey: string;
}): CompiledQueryClause {
  const { query, version, queryKey } = params;

  switch (query.target) {
    case "string": {
      return buildItemStringSearchClause({ query, version, queryKey });
    }
    case "title":
    case "description":
    case "periods":
    case "bibliography":
    case "image": {
      const config = getContentTargetConfig(query.target);

      return buildStringMatchClause({
        contentNodesExpression: config.getContentNodesExpression(
          query.language,
        ),
        value: query.value,
        matchMode: query.matchMode,
        isCaseSensitive: query.isCaseSensitive,
        version,
        queryKey,
        buildCandidateTermQuery: (termExpression) =>
          buildContentTargetCandidateBranch({
            containerElementName: config.containerElementName,
            termExpression,
            isCaseSensitive: query.isCaseSensitive,
            language: query.language,
          }),
      });
    }
    case "property": {
      return buildPropertyClause({ query, version, queryKey });
    }
  }
}

/**
 * Build a boolean query clause for an XQuery string.
 */
function buildBooleanQueryNode(params: {
  query: QueryLeaf;
  version: ApiVersion;
  queryKey: string;
}): CompiledQueryNode {
  const { query, version, queryKey } = params;
  const compiledQueryClause = buildQueryClause({ query, version, queryKey });
  const baseClause = `(${compiledQueryClause.predicate})`;

  return {
    declarations: compiledQueryClause.declarations,
    predicate: query.isNegated ? `not(${baseClause})` : baseClause,
    candidateQueryVars:
      query.isNegated || compiledQueryClause.candidateQueryVar == null ?
        []
      : [compiledQueryClause.candidateQueryVar],
  };
}

function buildQueryNode(params: {
  query: Query;
  version: ApiVersion;
  queryKey: string;
}): CompiledQueryNode {
  const { query, version, queryKey } = params;

  if (isQueryLeaf(query)) {
    return buildBooleanQueryNode({ query, version, queryKey });
  }

  const groupQueries = getQueryGroupChildren(query);
  const optimizedIncludesGroupQueries = getCompatibleIncludesGroupLeaves({
    query,
    version,
  });

  if (groupQueries.length === 1) {
    const onlyQuery = groupQueries[0];

    if (onlyQuery == null) {
      return { declarations: [], predicate: "", candidateQueryVars: [] };
    }

    return buildQueryNode({ query: onlyQuery, version, queryKey });
  }

  if (optimizedIncludesGroupQueries != null) {
    const compiledClause = buildIncludesGroupClause({
      queries: optimizedIncludesGroupQueries,
      queryKey,
    });

    return {
      declarations: compiledClause.declarations,
      predicate: compiledClause.predicate,
      candidateQueryVars:
        compiledClause.candidateQueryVar == null ?
          []
        : [compiledClause.candidateQueryVar],
    };
  }

  const declarations: Array<string> = [];
  const predicates: Array<string> = [];
  const candidateQueryVars: Array<string> = [];

  for (const [groupIndex, groupQuery] of groupQueries.entries()) {
    const compiledQueryNode = buildQueryNode({
      query: groupQuery,
      version,
      queryKey: `${queryKey}_${groupIndex + 1}`,
    });

    declarations.push(...compiledQueryNode.declarations);
    predicates.push(compiledQueryNode.predicate);
    candidateQueryVars.push(...compiledQueryNode.candidateQueryVars);
  }

  return {
    declarations,
    predicate:
      getQueryGroupOperator(query) === "and" ?
        buildAndPredicate(predicates)
      : buildOrPredicate(predicates),
    candidateQueryVars,
  };
}

export function buildQueryPlan(params: {
  queries: Query | null;
  version: ApiVersion;
  baseItemsExpression: string;
}): CompiledQueryPlan {
  const { queries, version, baseItemsExpression } = params;
  const declarations: Array<string> = [];
  let predicate = "";
  let candidateQueryVars: Array<string> = [];

  if (queries != null) {
    const compiledQueryNode = buildQueryNode({
      query: queries,
      version,
      queryKey: "1",
    });

    if (compiledQueryNode.declarations.length > 0) {
      declarations.push(
        `let ${CTS_INCLUDES_STOP_WORDS_VAR} := (${CTS_INCLUDES_STOP_WORDS.map((stopWord) => stringLiteral(stopWord)).join(", ")})`,
        ...compiledQueryNode.declarations,
      );
    }

    predicate = compiledQueryNode.predicate;
    candidateQueryVars = compiledQueryNode.candidateQueryVars;
  }

  let itemsExpression = `(${baseItemsExpression})`;

  if (candidateQueryVars.length > 0) {
    const candidateQueriesExpression = `(${candidateQueryVars.join(", ")})`;
    const candidateItemsQueryVar = "$candidateItemsQuery";

    declarations.push(`let ${candidateItemsQueryVar} :=
  if (count(${candidateQueriesExpression}) = 1)
  then ${candidateQueriesExpression}[1]
  else if (count(${candidateQueriesExpression}) gt 1)
  then cts:or-query(${candidateQueriesExpression})
  else ()`);

    itemsExpression = `(if (exists(${candidateItemsQueryVar}))
  then cts:search(${baseItemsExpression}, ${candidateItemsQueryVar})
  else ${baseItemsExpression})`;
  }

  return { declarations, itemsExpression, predicate };
}
