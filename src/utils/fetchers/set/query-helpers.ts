import type { Query } from "../../../types/index.js";
import { stringLiteral } from "../../internal.js";

/**
 * Build a string match predicate for an XQuery string
 */
function buildStringMatchPredicate(params: {
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
 * Build a property value predicate for an XQuery string
 */
function buildPropertyValuePredicate(
  query: Extract<Query, { target: "propertyValue" }>,
): string {
  if (query.dataType === "IDREF") {
    return `.//properties//property[value[@uuid=${stringLiteral(query.value)}]]`;
  }

  if (query.dataType === "date" || query.dataType === "dateTime") {
    return `.//properties//property[(label/@uuid=${stringLiteral(query.value)}) and ${buildDateRangePredicate(
      { from: query.from, to: query.to },
    )}]`;
  }

  if (
    query.dataType === "time" ||
    query.dataType === "integer" ||
    query.dataType === "decimal" ||
    query.dataType === "boolean"
  ) {
    return `.//properties//property[value[@rawValue=${stringLiteral(query.value)}]]`;
  }

  return `.//properties//property[${buildStringMatchPredicate({
    path: `string-join(value/content[@xml:lang="${query.language}"]/string, "")`,
    value: query.value,
    matchMode: query.matchMode,
    isCaseSensitive: query.isCaseSensitive,
  })}]`;
}

/**
 * Build a query predicate for an XQuery string
 */
function buildQueryPredicate(query: Query): string {
  switch (query.target) {
    case "title": {
      return buildStringMatchPredicate({
        path: `string-join(identification/label/content[@xml:lang="${query.language}"]/string, "")`,
        value: query.value,
        matchMode: query.matchMode,
        isCaseSensitive: query.isCaseSensitive,
      });
    }
    case "description": {
      return buildStringMatchPredicate({
        path: `string-join(description/content[@xml:lang="${query.language}"]/string, "")`,
        value: query.value,
        matchMode: query.matchMode,
        isCaseSensitive: query.isCaseSensitive,
      });
    }
    case "periods": {
      return buildStringMatchPredicate({
        path: `string-join(periods/period/identification/label/content[@xml:lang="${query.language}"]/string, "")`,
        value: query.value,
        matchMode: query.matchMode,
        isCaseSensitive: query.isCaseSensitive,
      });
    }
    case "bibliography": {
      return buildStringMatchPredicate({
        path: `string-join(bibliographies/bibliography/identification/label/content[@xml:lang="${query.language}"]/string, "")`,
        value: query.value,
        matchMode: query.matchMode,
        isCaseSensitive: query.isCaseSensitive,
      });
    }
    case "image": {
      return buildStringMatchPredicate({
        path: `string-join(image/identification/label/content[@xml:lang="${query.language}"]/string, "")`,
        value: query.value,
        matchMode: query.matchMode,
        isCaseSensitive: query.isCaseSensitive,
      });
    }
    case "propertyValue": {
      return buildPropertyValuePredicate(query);
    }
  }
}

/**
 * Build a boolean query clause for an XQuery string.
 */
function buildBooleanQueryClause(query: Query): string {
  const baseClause = `(${buildQueryPredicate(query)})`;
  return query.isNegated ? `not(${baseClause})` : baseClause;
}

/**
 * Build query filters for an XQuery string.
 */
export function buildQueryFilters(queries: Array<Query>): string {
  return queries
    .map((query, index) => {
      const clause = buildBooleanQueryClause(query);

      if (index === 0) {
        return clause;
      }

      return `${query.operator === "AND" ? "and" : "or"} ${clause}`;
    })
    .join(" ");
}
