import type {
  ApiVersion,
  DataCategory,
  Item,
  Query,
} from "../../../types/index.js";
import type {
  RawBibliography,
  RawConcept,
  RawPeriod,
  RawPerson,
  RawPropertyValue,
  RawPropertyVariable,
  RawResource,
  RawSet,
  RawSpatialUnit,
  RawText,
  RawTree,
} from "../../../types/raw.js";
import { BELONGS_TO_COLLECTION_UUID } from "../../../constants.js";
import { setItemsParamsSchema } from "../../../schemas.js";
import { DEFAULT_API_VERSION } from "../../helpers.js";
import { stringLiteral } from "../../internal.js";
import {
  parseBibliographies,
  parseConcepts,
  parsePeriods,
  parsePersons,
  parsePropertyValues,
  parsePropertyVariables,
  parseResources,
  parseSets,
  parseSpatialUnits,
  parseTexts,
  parseTrees,
} from "../../parse/index.js";

/**
 * Build a string match predicate for an XQuery string
 * @param params - The parameters for the predicate
 * @param params.path - The path to the string
 * @param params.value - The value to match
 * @param params.matchMode - The match mode (includes or exact)
 * @param params.isCaseSensitive - Whether to match case-sensitively
 * @returns The string match predicate
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
 * @param query - The propertyValue query
 * @returns The property value predicate
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
 * @param query - The query to build the predicate for
 * @returns The query predicate
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
 * Build an XQuery string to fetch Set items from the OCHRE API
 * @param params - The parameters for the fetch
 * @param params.setScopeUuids - An array of Set scope UUIDs to filter by
 * @param params.belongsToCollectionScopeUuids - An array of collection scope UUIDs to filter by
 * @param params.propertyVariableUuids - An array of property variable UUIDs to filter by
 * @param params.queries - Ordered queries to combine with AND/OR and optional NOT via negation
 * @param params.page - The page number (1-indexed)
 * @param params.pageSize - The number of items per page
 * @param options - Options for the fetch
 * @param options.version - The version of the OCHRE API to use
 * @returns An XQuery string
 */
function buildXQuery(
  params: {
    setScopeUuids: Array<string>;
    belongsToCollectionScopeUuids: Array<string>;
    propertyVariableUuids: Array<string>;
    queries: Array<Query>;
    page: number;
    pageSize: number;
  },
  options?: { version: ApiVersion },
): string {
  const version = options?.version ?? DEFAULT_API_VERSION;

  const {
    propertyVariableUuids,
    queries,
    setScopeUuids,
    belongsToCollectionScopeUuids,
    page,
    pageSize,
  } = params;

  const startPosition = (page - 1) * pageSize + 1;
  const endPosition = page * pageSize;

  const setScopeValues = setScopeUuids
    .map((uuid) => `@uuid="${uuid}"`)
    .join(" or ");
  const setScopeFilter = `/set[(${setScopeValues})]/items/*`;

  const queryFilters = queries
    .map((query, index) => {
      const clause = buildBooleanQueryClause(query);

      if (index === 0) {
        return clause;
      }

      return `${query.operator === "OR" ? "or" : "and"} ${clause}`;
    })
    .join(" ");

  const filterPredicates: Array<string> = [];

  if (belongsToCollectionScopeUuids.length > 0) {
    const belongsToCollectionScopeValues = belongsToCollectionScopeUuids
      .map((uuid) => `@uuid="${uuid}"`)
      .join(" or ");

    filterPredicates.push(
      `.//properties[property[label/@uuid="${BELONGS_TO_COLLECTION_UUID}" and value/(${belongsToCollectionScopeValues})]]`,
    );
  }

  if (propertyVariableUuids.length > 0) {
    const propertyVariables = propertyVariableUuids
      .map((uuid) => `@uuid="${uuid}"`)
      .join(" or ");

    filterPredicates.push(
      `.//properties//property[label[${propertyVariables}]]`,
    );
  }

  if (queryFilters.length > 0) {
    filterPredicates.push(`(${queryFilters})`);
  }

  const itemFilters =
    filterPredicates.length > 0 ? `[${filterPredicates.join(" and ")}]` : "";

  const xquery = `let $items := ${version === 2 ? "doc()" : "input()"}/ochre
        ${setScopeFilter}
        ${itemFilters}

  let $totalCount := count($items)

  return <items totalCount="{$totalCount}" page="${page}" pageSize="${pageSize}">{
    for $item in $items[position() ge ${startPosition} and position() le ${endPosition}]
      return element { node-name($item) } {
        $item/@*, $item/node()
      }
  }</items>`;

  return `<ochre>{${xquery}}</ochre>`;
}

/**
 * Fetches and parses Set items from the OCHRE API
 *
 * @param params - The parameters for the fetch
 * @param params.setScopeUuids - The Set scope UUIDs to filter by
 * @param params.belongsToCollectionScopeUuids - The collection scope UUIDs to filter by
 * @param params.propertyVariableUuids - The property variable UUIDs to filter by
 * @param params.queries - Ordered queries to combine with AND/OR and optional NOT via negation
 * @param params.page - The page number (1-indexed)
 * @param params.pageSize - The number of items per page
 * @param itemCategories - The categories of the items to fetch
 * @param options - Options for the fetch
 * @param options.fetch - The fetch function to use
 * @param options.version - The version of the OCHRE API to use
 * @returns The parsed Set items or null if the fetch/parse fails
 */
export async function fetchSetItems<
  U extends Array<DataCategory> = Array<DataCategory>,
>(
  params: {
    setScopeUuids: Array<string>;
    belongsToCollectionScopeUuids: Array<string>;
    propertyVariableUuids: Array<string>;
    queries: Array<Query>;
    page: number;
    pageSize?: number;
  },
  itemCategories?: U,
  options?: {
    fetch?: (
      input: string | URL | globalThis.Request,
      init?: RequestInit,
    ) => Promise<Response>;
    version?: ApiVersion;
  },
): Promise<
  | {
      totalCount: number;
      page: number;
      pageSize: number;
      items: Array<Item<"set", U>>;
      error: null;
    }
  | { totalCount: null; page: null; pageSize: null; items: null; error: string }
> {
  try {
    const version = options?.version ?? DEFAULT_API_VERSION;

    const {
      setScopeUuids,
      belongsToCollectionScopeUuids,
      propertyVariableUuids,
      queries,
      page,
      pageSize,
    } = setItemsParamsSchema.parse(params);

    const xquery = buildXQuery(
      {
        setScopeUuids,
        belongsToCollectionScopeUuids,
        propertyVariableUuids,
        queries,
        page,
        pageSize,
      },
      { version },
    );

    const response = await (options?.fetch ?? fetch)(
      version === 2 ?
        `https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?xquery=${encodeURIComponent(xquery)}&format=json&lang="*"`
      : `https://ochre.lib.uchicago.edu/ochre?xquery=${encodeURIComponent(xquery)}&format=json&lang="*"`,
    );
    if (!response.ok) {
      throw new Error(`OCHRE API responded with status: ${response.status}`);
    }

    const data = (await response.json()) as {
      result:
        | {
            ochre: {
              items: {
                totalCount: number;
                page: number;
                pageSize: number;
                resource?: RawResource | Array<RawResource>;
                spatialUnit?: RawSpatialUnit | Array<RawSpatialUnit>;
                concept?: RawConcept | Array<RawConcept>;
                period?: RawPeriod | Array<RawPeriod>;
                bibliography?: RawBibliography | Array<RawBibliography>;
                person?: RawPerson | Array<RawPerson>;
                propertyVariable?:
                  | RawPropertyVariable
                  | Array<RawPropertyVariable>;
                propertyValue?: RawPropertyValue | Array<RawPropertyValue>;
                text?: RawText | Array<RawText>;
                set?: RawSet | Array<RawSet>;
                tree?: RawTree | Array<RawTree>;
              };
            };
          }
        | [];
    };

    if (Array.isArray(data.result) || Object.keys(data.result).length === 0) {
      throw new Error("No items found");
    }

    if (itemCategories != null) {
      const itemCategoriesSet = new Set(Object.keys(data.result.ochre.items));
      const missingCategories = itemCategories.filter(
        (category) => !itemCategoriesSet.has(category),
      );

      if (missingCategories.length > 0) {
        throw new Error(
          `No Set items found for item categories: ${missingCategories.join(", ")}`,
        );
      }
    }

    const items: Array<Item<"set", U>> = [];

    if (
      (itemCategories == null || itemCategories.includes("resource")) &&
      "resource" in data.result.ochre.items &&
      data.result.ochre.items.resource != null
    ) {
      const rawResources =
        Array.isArray(data.result.ochre.items.resource) ?
          data.result.ochre.items.resource
        : [data.result.ochre.items.resource];

      const resources = parseResources(rawResources) as unknown as Array<
        Item<"set", U>
      >;

      items.push(...resources);
    }
    if (
      (itemCategories == null || itemCategories.includes("spatialUnit")) &&
      "spatialUnit" in data.result.ochre.items &&
      data.result.ochre.items.spatialUnit != null
    ) {
      const rawSpatialUnits =
        Array.isArray(data.result.ochre.items.spatialUnit) ?
          data.result.ochre.items.spatialUnit
        : [data.result.ochre.items.spatialUnit];

      const spatialUnits = parseSpatialUnits(
        rawSpatialUnits,
      ) as unknown as Array<Item<"set", U>>;

      items.push(...spatialUnits);
    }
    if (
      (itemCategories == null || itemCategories.includes("concept")) &&
      "concept" in data.result.ochre.items &&
      data.result.ochre.items.concept != null
    ) {
      const rawConcepts =
        Array.isArray(data.result.ochre.items.concept) ?
          data.result.ochre.items.concept
        : [data.result.ochre.items.concept];

      const concepts = parseConcepts(rawConcepts) as unknown as Array<
        Item<"set", U>
      >;

      items.push(...concepts);
    }
    if (
      (itemCategories == null || itemCategories.includes("period")) &&
      "period" in data.result.ochre.items &&
      data.result.ochre.items.period != null
    ) {
      const rawPeriods =
        Array.isArray(data.result.ochre.items.period) ?
          data.result.ochre.items.period
        : [data.result.ochre.items.period];

      const periods = parsePeriods(rawPeriods) as unknown as Array<
        Item<"set", U>
      >;

      items.push(...periods);
    }
    if (
      (itemCategories == null || itemCategories.includes("bibliography")) &&
      "bibliography" in data.result.ochre.items &&
      data.result.ochre.items.bibliography != null
    ) {
      const rawBibliographies =
        Array.isArray(data.result.ochre.items.bibliography) ?
          data.result.ochre.items.bibliography
        : [data.result.ochre.items.bibliography];

      const bibliographies = parseBibliographies(
        rawBibliographies,
      ) as unknown as Array<Item<"set", U>>;

      items.push(...bibliographies);
    }
    if (
      (itemCategories == null || itemCategories.includes("person")) &&
      "person" in data.result.ochre.items &&
      data.result.ochre.items.person != null
    ) {
      const rawPersons =
        Array.isArray(data.result.ochre.items.person) ?
          data.result.ochre.items.person
        : [data.result.ochre.items.person];

      const persons = parsePersons(rawPersons) as unknown as Array<
        Item<"set", U>
      >;

      items.push(...persons);
    }
    if (
      (itemCategories == null || itemCategories.includes("propertyVariable")) &&
      "propertyVariable" in data.result.ochre.items &&
      data.result.ochre.items.propertyVariable != null
    ) {
      const rawPropertyVariables =
        Array.isArray(data.result.ochre.items.propertyVariable) ?
          data.result.ochre.items.propertyVariable
        : [data.result.ochre.items.propertyVariable];

      const propertyVariables = parsePropertyVariables(
        rawPropertyVariables,
      ) as unknown as Array<Item<"set", U>>;

      items.push(...propertyVariables);
    }
    if (
      (itemCategories == null || itemCategories.includes("propertyValue")) &&
      "propertyValue" in data.result.ochre.items &&
      data.result.ochre.items.propertyValue != null
    ) {
      const rawPropertyValues =
        Array.isArray(data.result.ochre.items.propertyValue) ?
          data.result.ochre.items.propertyValue
        : [data.result.ochre.items.propertyValue];

      const propertyValues = parsePropertyValues(
        rawPropertyValues,
      ) as unknown as Array<Item<"set", U>>;

      items.push(...propertyValues);
    }
    if (
      (itemCategories == null || itemCategories.includes("text")) &&
      "text" in data.result.ochre.items &&
      data.result.ochre.items.text != null
    ) {
      const rawTexts =
        Array.isArray(data.result.ochre.items.text) ?
          data.result.ochre.items.text
        : [data.result.ochre.items.text];

      const texts = parseTexts(rawTexts) as unknown as Array<Item<"set", U>>;

      items.push(...texts);
    }
    if (
      (itemCategories == null || itemCategories.includes("set")) &&
      "set" in data.result.ochre.items &&
      data.result.ochre.items.set != null
    ) {
      const rawSets =
        Array.isArray(data.result.ochre.items.set) ?
          data.result.ochre.items.set
        : [data.result.ochre.items.set];

      const sets = parseSets(rawSets) as unknown as Array<Item<"set", U>>;

      items.push(...sets);
    }
    if (
      (itemCategories == null || itemCategories.includes("tree")) &&
      "tree" in data.result.ochre.items &&
      data.result.ochre.items.tree != null
    ) {
      const rawTrees =
        Array.isArray(data.result.ochre.items.tree) ?
          data.result.ochre.items.tree
        : [data.result.ochre.items.tree];

      const trees = parseTrees(rawTrees) as unknown as Array<Item<"set", U>>;

      items.push(...trees);
    }

    return {
      totalCount: data.result.ochre.items.totalCount,
      page: data.result.ochre.items.page,
      pageSize: data.result.ochre.items.pageSize,
      items,
      error: null,
    };
  } catch (error) {
    console.error(error);
    return {
      totalCount: null,
      page: null,
      pageSize: null,
      items: null,
      error:
        error instanceof Error ? error.message : "Failed to fetch Set items",
    };
  }
}
