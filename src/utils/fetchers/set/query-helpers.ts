import type { ApiVersion, Query } from "../../../types/index.js";
import { stringLiteral } from "../../internal.js";

const CTS_INCLUDES_STOP_WORDS: Array<string> = ["of", "the", "and", "in", "it"];
const CTS_INCLUDES_STOP_WORDS_VAR = "$ctsIncludesStopWords";

type CompiledQueryFilter = { declarations: Array<string>; predicate: string };

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
 * Build CTS word-query options for API v2 includes search.
 */
function buildCtsQueryOptionsExpression(isCaseSensitive: boolean): string {
  const options: Array<string> = [
    isCaseSensitive ? "case-sensitive" : "case-insensitive",
    "diacritic-insensitive",
    "punctuation-insensitive",
    "whitespace-insensitive",
    "stemmed",
  ];

  return `(${options.map((option) => stringLiteral(option)).join(", ")})`;
}

/**
 * Build a CTS-backed includes predicate for an XQuery string.
 */
function buildCtsIncludesPredicate(params: {
  path: string;
  value: string;
  isCaseSensitive: boolean;
  queryIndex: number;
}): CompiledQueryFilter {
  const { path, value, isCaseSensitive, queryIndex } = params;

  const searchStringVar = `$query${queryIndex}SearchString`;
  const rawTermsVar = `$query${queryIndex}RawTerms`;
  const termsVar = `$query${queryIndex}Terms`;
  const ctsQueryVar = `$query${queryIndex}CtsQuery`;
  const ctsOptionsExpression = buildCtsQueryOptionsExpression(isCaseSensitive);
  const fallbackPredicate = buildRawStringMatchPredicate({
    path,
    value,
    matchMode: "includes",
    isCaseSensitive,
  });

  return {
    declarations: [
      `let ${searchStringVar} := ${stringLiteral(value)}`,
      String.raw`let ${rawTermsVar} := fn:tokenize(${searchStringVar}, "\W+")`,
      `let ${termsVar} :=
  for $term in ${rawTermsVar}
    let $normalizedTerm := fn:lower-case($term)
    where $normalizedTerm ne "" and not($normalizedTerm = ${CTS_INCLUDES_STOP_WORDS_VAR})
    return ${isCaseSensitive ? "$term" : "$normalizedTerm"}`,
      `let ${ctsQueryVar} :=
  if (count(${termsVar}) = 1)
  then cts:word-query(${termsVar}[1], ${ctsOptionsExpression})
  else if (count(${termsVar}) gt 1)
  then cts:near-query((
    for $term in ${termsVar}
      return cts:word-query($term, ${ctsOptionsExpression})
  ), 5, ("unordered"))
  else ()`,
    ],
    predicate: `(if (exists(${ctsQueryVar})) then cts:contains(${path}, ${ctsQueryVar}) else ${fallbackPredicate})`,
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
    return buildCtsIncludesPredicate({
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

  const compiledStringPredicate = buildStringMatchPredicate({
    path: `string-join(value/content[@xml:lang="${query.language}"]/string, "")`,
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
