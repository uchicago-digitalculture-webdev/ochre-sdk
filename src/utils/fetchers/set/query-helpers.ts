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
type PropertyQuery = Extract<Query, { target: "property" }>;
type StringPropertyQuery = PropertyQuery & {
  dataType: "string";
  propertyValues: Array<string>;
};

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

/**
 * Build a CTS-backed field includes predicate for an XQuery string.
 */
function buildCtsFieldIncludesPredicate(params: {
  path: string;
  value: string;
  isCaseSensitive: boolean;
  queryKey: string;
}): CompiledQueryFilter {
  const { path, value, isCaseSensitive, queryKey } = params;
  const tokenizedSearchDeclarations = buildTokenizedSearchDeclarations({
    value,
    isCaseSensitive,
    queryKey,
  });
  const ctsQueryVar = `$query${queryKey}CtsQuery`;
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
  queryKey: string;
}): CompiledQueryFilter {
  const { query, version, queryKey } = params;
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
    queryKey,
  });
  const termQueriesVar = `$query${queryKey}TermQueries`;
  const ctsQueryVar = `$query${queryKey}CtsQuery`;

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
  queryKey: string;
}): CompiledQueryFilter {
  const { path, value, matchMode, isCaseSensitive, version, queryKey } = params;

  if (matchMode === "includes" && version === 2) {
    return buildCtsFieldIncludesPredicate({
      path,
      value,
      isCaseSensitive,
      queryKey,
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

function buildOrPredicate(predicates: Array<string>): string {
  if (predicates.length === 1) {
    return predicates[0] ?? "false()";
  }

  return `(${predicates.join(" or ")})`;
}

function buildAndPredicate(predicates: Array<string>): string {
  if (predicates.length === 1) {
    return predicates[0] ?? "false()";
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

  return conditions.join(" and ");
}

/**
 * Build a property label predicate for an XQuery string.
 */
function buildPropertyLabelPredicate(propertyVariables: Array<string>): string {
  const labelPredicates: Array<string> = [];

  for (const propertyVariable of propertyVariables) {
    labelPredicates.push(`@uuid=${stringLiteral(propertyVariable)}`);
  }

  return `label[${buildOrPredicate(labelPredicates)}]`;
}

function buildPropertyValueAttributePredicate(params: {
  propertyValues: Array<string>;
  attributeName: "rawValue" | "uuid";
}): string {
  const { propertyValues, attributeName } = params;
  const valuePredicates: Array<string> = [];

  for (const propertyValue of propertyValues) {
    valuePredicates.push(
      `value[@${attributeName}=${stringLiteral(propertyValue)}]`,
    );
  }

  return buildOrPredicate(valuePredicates);
}

function buildPropertyStringValuePredicate(params: {
  query: StringPropertyQuery;
  version: ApiVersion;
  queryKey: string;
}): CompiledQueryFilter {
  const { query, version, queryKey } = params;
  const propertyValuePath =
    query.matchMode === "includes" && version === 2 ?
      `string-join(value[not(@inherited="true")]/content[@xml:lang="${query.language}"]/string, "")`
    : `string-join(value/content[@xml:lang="${query.language}"]/string, "")`;
  const declarations: Array<string> = [];
  const valuePredicates: Array<string> = [];

  for (const [
    propertyValueIndex,
    propertyValue,
  ] of query.propertyValues.entries()) {
    const compiledStringPredicate = buildStringMatchPredicate({
      path: propertyValuePath,
      value: propertyValue,
      matchMode: query.matchMode,
      isCaseSensitive: query.isCaseSensitive,
      version,
      queryKey: `${queryKey}_${propertyValueIndex + 1}`,
    });

    declarations.push(...compiledStringPredicate.declarations);
    valuePredicates.push(compiledStringPredicate.predicate);
  }

  return { declarations, predicate: buildOrPredicate(valuePredicates) };
}

/**
 * Build a property predicate for an XQuery string.
 */
function buildPropertyPredicate(params: {
  query: PropertyQuery;
  version: ApiVersion;
  queryKey: string;
}): CompiledQueryFilter {
  const { query, version, queryKey } = params;
  const predicateParts: Array<string> = [
    buildPropertyLabelPredicate(query.propertyVariables),
  ];
  const declarations: Array<string> = [];

  if (query.dataType === "date" || query.dataType === "dateTime") {
    predicateParts.push(
      buildDateRangePredicate({ from: query.from, to: query.to }),
    );
  } else if (query.propertyValues != null) {
    switch (query.dataType) {
      case "IDREF": {
        predicateParts.push(
          buildPropertyValueAttributePredicate({
            propertyValues: query.propertyValues,
            attributeName: "uuid",
          }),
        );
        break;
      }
      case "integer":
      case "decimal":
      case "time":
      case "boolean": {
        predicateParts.push(
          buildPropertyValueAttributePredicate({
            propertyValues: query.propertyValues,
            attributeName: "rawValue",
          }),
        );
        break;
      }
      case "string": {
        const compiledStringPredicate = buildPropertyStringValuePredicate({
          query: query as StringPropertyQuery,
          version,
          queryKey,
        });

        declarations.push(...compiledStringPredicate.declarations);
        predicateParts.push(compiledStringPredicate.predicate);
        break;
      }
    }
  }

  return {
    declarations,
    predicate: `.//properties//property[${buildAndPredicate(predicateParts)}]`,
  };
}

/**
 * Build a query predicate for an XQuery string.
 */
function buildQueryPredicate(params: {
  query: Query;
  version: ApiVersion;
  queryKey: string;
}): CompiledQueryFilter {
  const { query, version, queryKey } = params;

  switch (query.target) {
    case "string": {
      return buildItemStringSearchPredicate({ query, version, queryKey });
    }
    case "title": {
      return buildStringMatchPredicate({
        path: `string-join(identification/label/content[@xml:lang="${query.language}"]/string, "")`,
        value: query.value,
        matchMode: query.matchMode,
        isCaseSensitive: query.isCaseSensitive,
        version,
        queryKey,
      });
    }
    case "description": {
      return buildStringMatchPredicate({
        path: `string-join(description/content[@xml:lang="${query.language}"]/string, "")`,
        value: query.value,
        matchMode: query.matchMode,
        isCaseSensitive: query.isCaseSensitive,
        version,
        queryKey,
      });
    }
    case "periods": {
      return buildStringMatchPredicate({
        path: `string-join(periods/period/identification/label/content[@xml:lang="${query.language}"]/string, "")`,
        value: query.value,
        matchMode: query.matchMode,
        isCaseSensitive: query.isCaseSensitive,
        version,
        queryKey,
      });
    }
    case "bibliography": {
      return buildStringMatchPredicate({
        path: `string-join(bibliographies/bibliography/identification/label/content[@xml:lang="${query.language}"]/string, "")`,
        value: query.value,
        matchMode: query.matchMode,
        isCaseSensitive: query.isCaseSensitive,
        version,
        queryKey,
      });
    }
    case "image": {
      return buildStringMatchPredicate({
        path: `string-join(image/identification/label/content[@xml:lang="${query.language}"]/string, "")`,
        value: query.value,
        matchMode: query.matchMode,
        isCaseSensitive: query.isCaseSensitive,
        version,
        queryKey,
      });
    }
    case "property": {
      return buildPropertyPredicate({ query, version, queryKey });
    }
  }
}

/**
 * Build a boolean query clause for an XQuery string.
 */
function buildBooleanQueryClause(params: {
  query: Query;
  version: ApiVersion;
  queryKey: string;
}): CompiledQueryFilter {
  const { query, version, queryKey } = params;
  const compiledQueryPredicate = buildQueryPredicate({
    query,
    version,
    queryKey,
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
      queryKey: `${index + 1}`,
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
