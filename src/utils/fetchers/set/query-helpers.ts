import type { ApiVersion, Query } from "../../../types/index.js";
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

type CompiledQueryFilter = { declarations: Array<string>; predicate: string };

type TokenizedSearchDeclarations = {
  declarations: Array<string>;
  termsVar: string;
};

type ItemStringQuery = Extract<Query, { target: "string" }>;

/**
 * Build a string match predicate for an XQuery string.
 */
function buildRawStringMatchPredicate(params: {
  path: string;
  value: string;
  matchMode: "includes" | "exact";
  isCaseSensitive: boolean;
}): string {
  const { path, value, matchMode, isCaseSensitive } = params;

  const comparedPath = isCaseSensitive ? path : `lower-case(${path})`;
  const comparedValue = isCaseSensitive ? value : value.toLowerCase();
  const comparedValueLiteral = stringLiteral(comparedValue);

  if (matchMode === "includes") {
    return `contains(${comparedPath}, ${comparedValueLiteral})`;
  }

  return `${comparedPath} = ${comparedValueLiteral}`;
}

/**
 * Build a combined raw string match predicate for multiple paths.
 */
function buildCombinedRawStringMatchPredicate(params: {
  paths: Array<string>;
  value: string;
  matchMode: "includes" | "exact";
  isCaseSensitive: boolean;
}): string {
  const { paths, value, matchMode, isCaseSensitive } = params;
  const predicates: Array<string> = [];

  for (const path of paths) {
    predicates.push(
      buildRawStringMatchPredicate({ path, value, matchMode, isCaseSensitive }),
    );
  }

  if (predicates.length === 1) {
    return predicates[0] ?? "false()";
  }

  return `(${predicates.join(" or ")})`;
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
  queryIndex: number;
}): TokenizedSearchDeclarations {
  const { value, isCaseSensitive, queryIndex } = params;
  const searchStringVar = `$query${queryIndex}SearchString`;
  const rawTermsVar = `$query${queryIndex}RawTerms`;
  const termsVar = `$query${queryIndex}Terms`;
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

/**
 * Build a CTS-backed field includes predicate for an XQuery string.
 */
function buildCtsFieldIncludesPredicate(params: {
  path: string;
  value: string;
  isCaseSensitive: boolean;
  queryIndex: number;
}): CompiledQueryFilter {
  const { path, value, isCaseSensitive, queryIndex } = params;
  const tokenizedSearchDeclarations = buildTokenizedSearchDeclarations({
    value,
    isCaseSensitive,
    queryIndex,
  });
  const ctsQueryVar = `$query${queryIndex}CtsQuery`;
  const fallbackPredicate = buildRawStringMatchPredicate({
    path,
    value,
    matchMode: "includes",
    isCaseSensitive,
  });

  return {
    declarations: [
      ...tokenizedSearchDeclarations.declarations,
      `let ${ctsQueryVar} :=
  if (count(${tokenizedSearchDeclarations.termsVar}) = 1)
  then ${buildCtsWordQueryExpression({
    termExpression: `${tokenizedSearchDeclarations.termsVar}[1]`,
    isCaseSensitive,
  })}
  else if (count(${tokenizedSearchDeclarations.termsVar}) gt 1)
  then cts:and-query((
    for $term in ${tokenizedSearchDeclarations.termsVar}
      return ${buildCtsWordQueryExpression({
        termExpression: "$term",
        isCaseSensitive,
      })}
  ))
  else ()`,
    ],
    predicate: `(if (exists(${ctsQueryVar})) then cts:contains(${path}, ${ctsQueryVar}) else ${fallbackPredicate})`,
  };
}

/**
 * Build the raw search paths for item-level string search.
 */
function buildItemStringSearchPaths(language: string): Array<string> {
  return [
    `string-join(identification/label/content[@xml:lang="${language}"]/string, "")`,
    `string-join(properties//property/value[not(@inherited="true")]/content[@xml:lang="${language}"]/string, "")`,
  ];
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
function buildItemStringSearchPredicate(params: {
  query: ItemStringQuery;
  version: ApiVersion;
  queryIndex: number;
}): CompiledQueryFilter {
  const { query, version, queryIndex } = params;
  const fallbackPredicate = buildCombinedRawStringMatchPredicate({
    paths: buildItemStringSearchPaths(query.language),
    value: query.value,
    matchMode: query.matchMode,
    isCaseSensitive: query.isCaseSensitive,
  });

  if (query.matchMode !== "includes" || version !== 2) {
    return { declarations: [], predicate: fallbackPredicate };
  }

  const tokenizedSearchDeclarations = buildTokenizedSearchDeclarations({
    value: query.value,
    isCaseSensitive: query.isCaseSensitive,
    queryIndex,
  });
  const termQueriesVar = `$query${queryIndex}TermQueries`;
  const ctsQueryVar = `$query${queryIndex}CtsQuery`;

  return {
    declarations: [
      ...tokenizedSearchDeclarations.declarations,
      `let ${termQueriesVar} :=
  for $term in ${tokenizedSearchDeclarations.termsVar}
    return
      cts:or-query((
        ${buildItemStringIdentificationBranch({
          termExpression: "$term",
          isCaseSensitive: query.isCaseSensitive,
          language: query.language,
        })},
        ${buildItemStringPropertyValueBranch({
          termExpression: "$term",
          isCaseSensitive: query.isCaseSensitive,
          language: query.language,
        })}
      ))`,
      `let ${ctsQueryVar} :=
  if (count(${tokenizedSearchDeclarations.termsVar}) = 1)
  then ${termQueriesVar}[1]
  else if (count(${tokenizedSearchDeclarations.termsVar}) gt 1)
  then cts:and-query(${termQueriesVar})
  else ()`,
    ],
    predicate: `(if (exists(${ctsQueryVar})) then cts:contains(., ${ctsQueryVar}) else ${fallbackPredicate})`,
  };
}

/**
 * Build a string match predicate for an XQuery string.
 */
function buildStringMatchPredicate(params: {
  path: string;
  value: string;
  matchMode: "includes" | "exact";
  isCaseSensitive: boolean;
  version: ApiVersion;
  queryIndex: number;
}): CompiledQueryFilter {
  const { path, value, matchMode, isCaseSensitive, version, queryIndex } =
    params;

  if (matchMode === "includes" && version === 2) {
    return buildCtsFieldIncludesPredicate({
      path,
      value,
      isCaseSensitive,
      queryIndex,
    });
  }

  return {
    declarations: [],
    predicate: buildRawStringMatchPredicate({
      path,
      value,
      matchMode,
      isCaseSensitive,
    }),
  };
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

  return conditions.join(" and ");
}

/**
 * Build a property value predicate for an XQuery string.
 */
function buildPropertyValuePredicate(params: {
  query: Extract<Query, { target: "propertyValue" }>;
  version: ApiVersion;
  queryIndex: number;
}): CompiledQueryFilter {
  const { query, version, queryIndex } = params;

  if (query.dataType === "IDREF") {
    return {
      declarations: [],
      predicate: `.//properties//property[value[@uuid=${stringLiteral(query.value)}]]`,
    };
  }

  if (query.dataType === "date" || query.dataType === "dateTime") {
    return {
      declarations: [],
      predicate: `.//properties//property[(label/@uuid=${stringLiteral(query.value)}) and ${buildDateRangePredicate(
        { from: query.from, to: query.to },
      )}]`,
    };
  }

  if (
    query.dataType === "time" ||
    query.dataType === "integer" ||
    query.dataType === "decimal" ||
    query.dataType === "boolean"
  ) {
    return {
      declarations: [],
      predicate: `.//properties//property[value[@rawValue=${stringLiteral(query.value)}]]`,
    };
  }

  const propertyValuePath =
    query.matchMode === "includes" && version === 2 ?
      `string-join(value[not(@inherited="true")]/content[@xml:lang="${query.language}"]/string, "")`
    : `string-join(value/content[@xml:lang="${query.language}"]/string, "")`;
  const compiledStringPredicate = buildStringMatchPredicate({
    path: propertyValuePath,
    value: query.value,
    matchMode: query.matchMode,
    isCaseSensitive: query.isCaseSensitive,
    version,
    queryIndex,
  });

  return {
    declarations: compiledStringPredicate.declarations,
    predicate: `.//properties//property[${compiledStringPredicate.predicate}]`,
  };
}

/**
 * Build a query predicate for an XQuery string.
 */
function buildQueryPredicate(params: {
  query: Query;
  version: ApiVersion;
  queryIndex: number;
}): CompiledQueryFilter {
  const { query, version, queryIndex } = params;

  switch (query.target) {
    case "string": {
      return buildItemStringSearchPredicate({ query, version, queryIndex });
    }
    case "title": {
      return buildStringMatchPredicate({
        path: `string-join(identification/label/content[@xml:lang="${query.language}"]/string, "")`,
        value: query.value,
        matchMode: query.matchMode,
        isCaseSensitive: query.isCaseSensitive,
        version,
        queryIndex,
      });
    }
    case "description": {
      return buildStringMatchPredicate({
        path: `string-join(description/content[@xml:lang="${query.language}"]/string, "")`,
        value: query.value,
        matchMode: query.matchMode,
        isCaseSensitive: query.isCaseSensitive,
        version,
        queryIndex,
      });
    }
    case "periods": {
      return buildStringMatchPredicate({
        path: `string-join(periods/period/identification/label/content[@xml:lang="${query.language}"]/string, "")`,
        value: query.value,
        matchMode: query.matchMode,
        isCaseSensitive: query.isCaseSensitive,
        version,
        queryIndex,
      });
    }
    case "bibliography": {
      return buildStringMatchPredicate({
        path: `string-join(bibliographies/bibliography/identification/label/content[@xml:lang="${query.language}"]/string, "")`,
        value: query.value,
        matchMode: query.matchMode,
        isCaseSensitive: query.isCaseSensitive,
        version,
        queryIndex,
      });
    }
    case "image": {
      return buildStringMatchPredicate({
        path: `string-join(image/identification/label/content[@xml:lang="${query.language}"]/string, "")`,
        value: query.value,
        matchMode: query.matchMode,
        isCaseSensitive: query.isCaseSensitive,
        version,
        queryIndex,
      });
    }
    case "propertyValue": {
      return buildPropertyValuePredicate({ query, version, queryIndex });
    }
  }
}

/**
 * Build a boolean query clause for an XQuery string.
 */
function buildBooleanQueryClause(params: {
  query: Query;
  version: ApiVersion;
  queryIndex: number;
}): CompiledQueryFilter {
  const { query, version, queryIndex } = params;
  const compiledQueryPredicate = buildQueryPredicate({
    query,
    version,
    queryIndex,
  });
  const baseClause = `(${compiledQueryPredicate.predicate})`;

  return {
    declarations: compiledQueryPredicate.declarations,
    predicate: query.isNegated ? `not(${baseClause})` : baseClause,
  };
}

/**
 * Build query filters for an XQuery string.
 */
export function buildQueryFilters(params: {
  queries: Array<Query>;
  version: ApiVersion;
}): CompiledQueryFilter {
  const { queries, version } = params;
  const declarations: Array<string> = [];
  const predicateParts: Array<string> = [];
  let hasCtsIncludesClauses = false;

  for (const [index, query] of queries.entries()) {
    const compiledClause = buildBooleanQueryClause({
      query,
      version,
      queryIndex: index + 1,
    });

    if (compiledClause.declarations.length > 0) {
      hasCtsIncludesClauses = true;
      declarations.push(...compiledClause.declarations);
    }

    if (index === 0) {
      predicateParts.push(compiledClause.predicate);
      continue;
    }

    predicateParts.push(
      `${query.operator === "AND" ? "and" : "or"} ${compiledClause.predicate}`,
    );
  }

  if (hasCtsIncludesClauses) {
    declarations.unshift(
      `let ${CTS_INCLUDES_STOP_WORDS_VAR} := (${CTS_INCLUDES_STOP_WORDS.map((stopWord) => stringLiteral(stopWord)).join(", ")})`,
    );
  }

  return { declarations, predicate: predicateParts.join(" ") };
}
