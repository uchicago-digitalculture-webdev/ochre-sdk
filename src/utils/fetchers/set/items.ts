import type {
  ApiVersion,
  DataCategory,
  Item,
  Query,
  SetItemsSort,
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
import { buildQueryFilters } from "./query-helpers.js";

type SortWithDirection = Exclude<SetItemsSort, { target: "none" }>;
type PropertyValueSort = Extract<SetItemsSort, { target: "propertyValue" }>;
type PropertyValueSortDataType = PropertyValueSort["dataType"];

function mapSortDirectionToXQuery(
  direction: SortWithDirection["direction"],
): "ascending" | "descending" {
  return direction === "desc" ? "descending" : "ascending";
}

function buildStringOrderByClause(
  direction: "ascending" | "descending",
): string {
  return `($sortKey = "") ascending, lower-case($sortKey) ${direction}, $position ascending`;
}

function buildTypedOrderByClause(
  direction: "ascending" | "descending",
): string {
  return `empty($sortKey) ascending, $sortKey ${direction}, $position ascending`;
}

function buildPropertyValueValuePath(sort: PropertyValueSort): string {
  const propertyVariableUuidLiteral = stringLiteral(sort.propertyVariableUuid);

  return `$item//properties//property[label/@uuid=${propertyVariableUuidLiteral}]/value[not(@i)]`;
}

function buildPropertyValueStringSortKeyExpression(
  sort: PropertyValueSort,
): string {
  const languageLiteral = stringLiteral(sort.language ?? "eng");
  const propertyValuePath = buildPropertyValueValuePath(sort);

  return `string((for $v in ${propertyValuePath}
        let $candidate := string-join($v/content[@xml:lang=${languageLiteral}]/string, "")
        where string-length($candidate) gt 0
        return $candidate)[1])`;
}

function buildPropertyValueTypedSortKeyExpression(params: {
  sort: PropertyValueSort;
  dataType: Exclude<PropertyValueSortDataType, "string" | "IDREF">;
}): string {
  const { sort, dataType } = params;
  const propertyValuePath = buildPropertyValueValuePath(sort);

  switch (dataType) {
    case "integer": {
      return `(for $v in ${propertyValuePath}
        let $candidate := normalize-space(string($v/@rawValue))
        where $candidate castable as xs:integer
        return xs:integer($candidate))[1]`;
    }
    case "decimal":
    case "time": {
      return `(for $v in ${propertyValuePath}
        let $candidate := normalize-space(string($v/@rawValue))
        where $candidate castable as xs:decimal
        return xs:decimal($candidate))[1]`;
    }
    case "boolean": {
      return `(for $v in ${propertyValuePath}
        let $candidate := lower-case(normalize-space(string($v/@rawValue)))
        where $candidate = ("true", "false", "1", "0")
        return if ($candidate = ("true", "1")) then 1 else 0)[1]`;
    }
    case "date": {
      return `(for $v in ${propertyValuePath}
        let $candidate := normalize-space(string($v/@rawValue))
        where $candidate castable as xs:date
        return xs:date($candidate))[1]`;
    }
    case "dateTime": {
      return `(for $v in ${propertyValuePath}
        let $candidate := normalize-space(string($v/@rawValue))
        where $candidate castable as xs:dateTime
        return xs:dateTime($candidate))[1]`;
    }
  }
}

function buildPropertyValueOrderByClause(params: {
  dataType: PropertyValueSortDataType;
  direction: "ascending" | "descending";
}): string {
  const { dataType, direction } = params;

  return dataType === "string" || dataType === "IDREF" ?
      buildStringOrderByClause(direction)
    : buildTypedOrderByClause(direction);
}

function buildOrderedItemsClause(sort: SetItemsSort): string {
  if (sort.target === "none") {
    return "let $orderedItems := $items";
  }

  const direction = mapSortDirectionToXQuery(sort.direction);

  if (sort.target === "title") {
    const languageLiteral = stringLiteral(sort.language ?? "eng");
    const sortKeyExpression = `string-join($item/identification/label/content[@xml:lang=${languageLiteral}]/string, "")`;

    return `let $orderedItems :=
    for $item at $position in $items
      let $sortKey := ${sortKeyExpression}
      stable order by ${buildStringOrderByClause(direction)}
      return $item`;
  }

  const sortKeyExpression =
    sort.dataType === "string" || sort.dataType === "IDREF" ?
      buildPropertyValueStringSortKeyExpression(sort)
    : buildPropertyValueTypedSortKeyExpression({
        sort,
        dataType: sort.dataType,
      });

  return `let $orderedItems :=
    for $item at $position in $items
      let $sortKey := ${sortKeyExpression}
      stable order by ${buildPropertyValueOrderByClause({ dataType: sort.dataType, direction })}
      return $item`;
}

/**
 * Build an XQuery string to fetch Set items from the OCHRE API
 * @param params - The parameters for the fetch
 * @param params.setScopeUuids - An array of Set scope UUIDs to filter by
 * @param params.belongsToCollectionScopeUuids - An array of collection scope UUIDs to filter by
 * @param params.propertyVariableUuids - An array of property variable UUIDs to filter by
 * @param params.queries - Ordered queries to combine with AND/OR and optional NOT via negation
 * @param params.sort - Optional sorting configuration applied before pagination.
 * For propertyValue sorting, dataType is required and the sort key uses the first valid leaf value (value[not(@i)]).
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
    sort: SetItemsSort;
    page: number;
    pageSize: number;
  },
  options?: { version: ApiVersion },
): string {
  const version = options?.version ?? DEFAULT_API_VERSION;

  const {
    propertyVariableUuids,
    queries,
    sort,
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

  const queryFilters = buildQueryFilters(queries);

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
  const orderedItemsClause = buildOrderedItemsClause(sort);

  const xquery = `let $rawItems := ${version === 2 ? "doc()" : "input()"}/ochre
        ${setScopeFilter}
        ${itemFilters}

  let $items :=
    for $item at $position in $rawItems
      where empty($rawItems[position() lt $position][@uuid = $item/@uuid])
      return $item

  let $totalCount := count($items)
  ${orderedItemsClause}

  return <items totalCount="{$totalCount}" page="${page}" pageSize="${pageSize}">{
    for $item in $orderedItems[position() ge ${startPosition} and position() le ${endPosition}]
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
 * @param params.sort - Optional sorting configuration applied before pagination.
 * For propertyValue sorting, dataType is required and the sort key uses the first valid leaf value (value[not(@i)]).
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
    sort?: SetItemsSort;
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
      sort,
      page,
      pageSize,
    } = setItemsParamsSchema.parse(params);

    const xquery = buildXQuery(
      {
        setScopeUuids,
        belongsToCollectionScopeUuids,
        propertyVariableUuids,
        queries,
        sort,
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
