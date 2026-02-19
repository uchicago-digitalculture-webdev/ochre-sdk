import type {
  OchreBibliography,
  OchreConcept,
  OchrePeriod,
  OchrePerson,
  OchrePropertyValue,
  OchrePropertyVariable,
  OchreResource,
  OchreSet,
  OchreSpatialUnit,
  OchreText,
  OchreTree,
} from "../../../types/internal.raw.js";
import type {
  ApiVersion,
  DataCategory,
  Item,
  PropertyValueContentType,
} from "../../../types/main.js";
import { BELONGS_TO_COLLECTION_UUID } from "../../../constants.js";
import { setItemsByPropertyValuesParamsSchema } from "../../../schemas.js";
import { DEFAULT_API_VERSION } from "../../helpers.js";
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
 * Build an XQuery string to fetch items by property values from the OCHRE API
 * @param params - The parameters for the fetch
 * @param params.setScopeUuids - An array of Set scope UUIDs to filter by
 * @param params.belongsToCollectionScopeUuids - An array of collection scope UUIDs to filter by
 * @param params.propertyVariableUuids - An array of property variable UUIDs to fetch
 * @param params.propertyValues - An array of property values to fetch
 * @param params.page - The page number (1-indexed)
 * @param params.pageSize - The number of items per page
 * @param params.includeChildItems - Whether to include child items of the same category
 * @param options - Options for the fetch
 * @param options.version - The version of the OCHRE API to use
 * @returns An XQuery string
 */
function buildXQuery(
  params: {
    setScopeUuids: Array<string>;
    belongsToCollectionScopeUuids: Array<string>;
    propertyVariableUuids: Array<string>;
    propertyValues: Array<{
      dataType: Exclude<PropertyValueContentType, "coordinate">;
      value: string;
    }>;
    page: number;
    pageSize: number;
    includeChildItems?: boolean;
  },
  options?: { version: ApiVersion },
): string {
  const version = options?.version ?? DEFAULT_API_VERSION;

  const {
    propertyVariableUuids,
    propertyValues,
    setScopeUuids,
    belongsToCollectionScopeUuids,
    page,
    pageSize,
    includeChildItems = false,
  } = params;

  const startPosition = (page - 1) * pageSize + 1;
  const endPosition = page * pageSize;

  let setScopeFilter = "";

  if (setScopeUuids.length > 0) {
    const setScopeValues = setScopeUuids
      .map((uuid) => `@uuid="${uuid}"`)
      .join(" or ");
    setScopeFilter = `/set[(${setScopeValues})]/items/*`;
  }

  let belongsToCollectionScopeFilter = "";

  if (belongsToCollectionScopeUuids.length > 0) {
    const belongsToCollectionScopeValues = belongsToCollectionScopeUuids
      .map((uuid) => `@uuid="${uuid}"`)
      .join(" or ");

    belongsToCollectionScopeFilter = `[.//properties[property[label/@uuid="${BELONGS_TO_COLLECTION_UUID}" and value/(${belongsToCollectionScopeValues})]]`;
  }

  const propertyVariables = propertyVariableUuids
    .map((uuid) => `@uuid="${uuid}"`)
    .join(" or ");

  const propertyValuesFilters = propertyValues
    .map(({ dataType, value }) => {
      if (dataType === "IDREF") {
        return `value[@uuid="${value}"]`;
      }
      if (
        dataType === "date" ||
        dataType === "dateTime" ||
        dataType === "time" ||
        dataType === "integer" ||
        dataType === "decimal" ||
        dataType === "boolean"
      ) {
        return `value[@rawValue="${value}"]`;
      }
      return `value[.="${value}"]`;
    })
    .join(" or ");

  const xquery = `let $items := ${version === 2 ? "doc()" : "input()"}/ochre
        ${setScopeFilter}
        ${belongsToCollectionScopeFilter}
          //property[label[${propertyVariables}]][${propertyValuesFilters}]]

  let $totalCount := count($items)

  return <items totalCount="{$totalCount}" page="${page}" pageSize="${pageSize}">{
    for $item in $items[position() ge ${startPosition} and position() le ${endPosition}]
      let $category := local-name($item)
      return element { node-name($item) } {
        $item/@*, ${
          includeChildItems ? "$item/node()" : (
            "$item/node()[not(local-name(.) = $category)]"
          )
        }
      }
  }</items>`;

  return `<ochre>{${xquery}}</ochre>`;
}

/**
 * Fetches and parses items by property values from the OCHRE API
 *
 * @param params - The parameters for the fetch
 * @param params.setScopeUuids - The Set scope UUIDs to filter by
 * @param params.belongsToCollectionScopeUuids - The collection scope UUIDs to filter by
 * @param params.propertyVariableUuids - The property variable UUIDs to query by
 * @param params.propertyValues - The property values to query by
 * @param params.page - The page number (1-indexed)
 * @param params.pageSize - The number of items per page
 * @param params.includeChildItems - Whether to include child items of the same category
 * @param categoryParams - The category parameters for the fetch
 * @param categoryParams.category - The category of the items to fetch
 * @param categoryParams.itemCategories - The categories of the items to fetch
 * @param options - Options for the fetch
 * @param options.fetch - The fetch function to use
 * @param options.version - The version of the OCHRE API to use
 * @returns The parsed items by property values or null if the fetch/parse fails
 */
export async function fetchSetItemsByPropertyValues<
  T extends DataCategory = DataCategory,
  U extends DataCategory | Array<DataCategory> = T extends "tree" ?
    Exclude<DataCategory, "tree">
  : T extends "set" ? Array<DataCategory>
  : never,
>(
  params: {
    setScopeUuids: Array<string>;
    belongsToCollectionScopeUuids: Array<string>;
    propertyVariableUuids: Array<string>;
    propertyValues: Array<{
      dataType: Exclude<PropertyValueContentType, "coordinate">;
      value: string;
    }>;
    page: number;
    pageSize?: number;
    includeChildItems?: boolean;
  },
  categoryParams?: { category?: T; itemCategories?: U },
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
      items: Array<Item<T, U>>;
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
      propertyValues,
      page,
      pageSize,
      includeChildItems,
    } = setItemsByPropertyValuesParamsSchema.parse(params);

    const { category, itemCategories } = categoryParams ?? {};

    const xquery = buildXQuery(
      {
        setScopeUuids,
        belongsToCollectionScopeUuids,
        propertyVariableUuids,
        propertyValues,
        includeChildItems,
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
                resource?: OchreResource | Array<OchreResource>;
                spatialUnit?: OchreSpatialUnit | Array<OchreSpatialUnit>;
                concept?: OchreConcept | Array<OchreConcept>;
                period?: OchrePeriod | Array<OchrePeriod>;
                bibliography?: OchreBibliography | Array<OchreBibliography>;
                person?: OchrePerson | Array<OchrePerson>;
                propertyVariable?:
                  | OchrePropertyVariable
                  | Array<OchrePropertyVariable>;
                propertyValue?: OchrePropertyValue | Array<OchrePropertyValue>;
                text?: OchreText | Array<OchreText>;
                set?: OchreSet | Array<OchreSet>;
                tree?: OchreTree | Array<OchreTree>;
              };
            };
          }
        | [];
    };

    if (
      Array.isArray(data.result) ||
      Object.keys(data.result.ochre).length === 0
    ) {
      throw new Error("No items found");
    }

    if (category != null && data.result.ochre.items[category] == null) {
      throw new Error(`No items found for category: ${category}`);
    }

    if (
      (category === "set" || category === "tree") &&
      itemCategories != null &&
      "items" in data.result.ochre.items[category]! &&
      Array.isArray(data.result.ochre.items[category].items) &&
      data.result.ochre.items[category].items.every(
        (item: Item<T, U>) => item.category !== itemCategories,
      )
    ) {
      throw new Error(
        `No items found for category: ${category} and item categories: ${itemCategories}`,
      );
    }

    const items: Array<Item<T, U>> = [];

    if (
      "resource" in data.result.ochre.items &&
      data.result.ochre.items.resource != null
    ) {
      const rawResources =
        Array.isArray(data.result.ochre.items.resource) ?
          data.result.ochre.items.resource
        : [data.result.ochre.items.resource];

      const resources = parseResources(rawResources) as Array<Item<T, U>>;

      items.push(...resources);
    }
    if (
      "spatialUnit" in data.result.ochre.items &&
      data.result.ochre.items.spatialUnit != null
    ) {
      const rawSpatialUnits =
        Array.isArray(data.result.ochre.items.spatialUnit) ?
          data.result.ochre.items.spatialUnit
        : [data.result.ochre.items.spatialUnit];

      const spatialUnits = parseSpatialUnits(rawSpatialUnits) as Array<
        Item<T, U>
      >;

      items.push(...spatialUnits);
    }
    if (
      "concept" in data.result.ochre.items &&
      data.result.ochre.items.concept != null
    ) {
      const rawConcepts =
        Array.isArray(data.result.ochre.items.concept) ?
          data.result.ochre.items.concept
        : [data.result.ochre.items.concept];

      const concepts = parseConcepts(rawConcepts) as Array<Item<T, U>>;

      items.push(...concepts);
    }
    if (
      "period" in data.result.ochre.items &&
      data.result.ochre.items.period != null
    ) {
      const rawPeriods =
        Array.isArray(data.result.ochre.items.period) ?
          data.result.ochre.items.period
        : [data.result.ochre.items.period];

      const periods = parsePeriods(rawPeriods) as Array<Item<T, U>>;

      items.push(...periods);
    }
    if (
      "bibliography" in data.result.ochre.items &&
      data.result.ochre.items.bibliography != null
    ) {
      const rawBibliographies =
        Array.isArray(data.result.ochre.items.bibliography) ?
          data.result.ochre.items.bibliography
        : [data.result.ochre.items.bibliography];

      const bibliographies = parseBibliographies(rawBibliographies) as Array<
        Item<T, U>
      >;

      items.push(...bibliographies);
    }
    if (
      "person" in data.result.ochre.items &&
      data.result.ochre.items.person != null
    ) {
      const rawPersons =
        Array.isArray(data.result.ochre.items.person) ?
          data.result.ochre.items.person
        : [data.result.ochre.items.person];

      const persons = parsePersons(rawPersons) as Array<Item<T, U>>;

      items.push(...persons);
    }
    if (
      "propertyVariable" in data.result.ochre.items &&
      data.result.ochre.items.propertyVariable != null
    ) {
      const rawPropertyVariables =
        Array.isArray(data.result.ochre.items.propertyVariable) ?
          data.result.ochre.items.propertyVariable
        : [data.result.ochre.items.propertyVariable];
      const propertyVariables = parsePropertyVariables(
        rawPropertyVariables,
      ) as Array<Item<T, U>>;
      items.push(...propertyVariables);
    }
    if (
      "propertyValue" in data.result.ochre.items &&
      data.result.ochre.items.propertyValue != null
    ) {
      const rawPropertyValues =
        Array.isArray(data.result.ochre.items.propertyValue) ?
          data.result.ochre.items.propertyValue
        : [data.result.ochre.items.propertyValue];

      const propertyValues = parsePropertyValues(rawPropertyValues) as Array<
        Item<T, U>
      >;

      items.push(...propertyValues);
    }
    if (
      "text" in data.result.ochre.items &&
      data.result.ochre.items.text != null
    ) {
      const rawTexts =
        Array.isArray(data.result.ochre.items.text) ?
          data.result.ochre.items.text
        : [data.result.ochre.items.text];

      const texts = parseTexts(rawTexts) as Array<Item<T, U>>;

      items.push(...texts);
    }
    if (
      "set" in data.result.ochre.items &&
      data.result.ochre.items.set != null
    ) {
      const rawSets =
        Array.isArray(data.result.ochre.items.set) ?
          data.result.ochre.items.set
        : [data.result.ochre.items.set];

      const sets = parseSets(rawSets) as Array<Item<T, U>>;

      items.push(...sets);
    }
    if (
      "tree" in data.result.ochre.items &&
      data.result.ochre.items.tree != null
    ) {
      const rawTrees =
        Array.isArray(data.result.ochre.items.tree) ?
          data.result.ochre.items.tree
        : [data.result.ochre.items.tree];

      const trees = parseTrees(rawTrees) as Array<Item<T, U>>;

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
        error instanceof Error ?
          error.message
        : "Failed to fetch items by property values",
    };
  }
}
