import type {
  OchreBibliography,
  OchreConcept,
  OchrePeriod,
  OchrePerson,
  OchrePropertyValue,
  OchreResource,
  OchreSet,
  OchreSpatialUnit,
  OchreText,
  OchreTree,
} from "../../types/internal.raw.js";
import type { ApiVersion, DataCategory, Item } from "../../types/main.js";
import {
  BELONG_TO_COLLECTION_UUID,
  DEFAULT_API_VERSION,
} from "../../constants.js";
import {
  parseBibliographies,
  parseConcepts,
  parsePeriods,
  parsePersons,
  parsePropertyValues,
  parseResources,
  parseSets,
  parseSpatialUnits,
  parseTexts,
  parseTrees,
} from "../parse.js";

/**
 * Build an XQuery string to fetch items by property value from the OCHRE API
 * @param scopeUuids - An array of scope UUIDs to filter by
 * @param propertyVariableUuids - An array of property variable UUIDs to fetch
 * @param propertyValueUuids - An array of property value UUIDs to fetch
 * @param projectScopeUuid - The UUID of the project scope
 * @returns An XQuery string
 */
function buildXQuery(
  scopeUuids: Array<string>,
  propertyVariableUuids: Array<string>,
  propertyValueUuids: Array<string>,
  projectScopeUuid: string,
  options?: { version: ApiVersion },
): string {
  const version = options?.version ?? DEFAULT_API_VERSION;

  let collectionScopeFilter = "";

  if (scopeUuids.length > 0) {
    const collectionValues = scopeUuids
      .map((uuid) => `@uuid="${uuid}"`)
      .join(" or ");

    collectionScopeFilter = `[properties/property[label/@uuid="${BELONG_TO_COLLECTION_UUID}"][value[${collectionValues}]]]`;
  }

  const propertyVariables = propertyVariableUuids
    .map((uuid) => `@uuid="${uuid}"`)
    .join(" or ");

  const propertyValues = propertyValueUuids
    .map((uuid) => `@uuid="${uuid}"`)
    .join(" or ");

  const xquery = `for $q in ${version === 2 ? "doc()" : "input()"}/ochre[@uuidBelongsTo="${projectScopeUuid}"]/*${collectionScopeFilter}/properties//property[label[${propertyVariables}]][value[${propertyValues}]]

let $item := $q/ancestor::*[parent::ochre]
let $category := local-name($item)

return element { node-name($item) } {
  $item/@*,
  $item/node()[not(local-name(.) = $category)]
}`;

  return `<ochre>{${xquery}}</ochre>`;
}

/**
 * Fetches and parses items by property value from the OCHRE API
 *
 * @param params - The parameters for the fetch
 * @param params.scopeUuids - The scope UUIDs to filter by
 * @param params.propertyVariableUuids - The property variable UUIDs to query by
 * @param params.propertyValueUuids - The property value UUIDs to query by
 * @param params.projectScopeUuid - The UUID of the project scope
 * @param categoryParams - The category parameters for the fetch
 * @param categoryParams.category - The category of the items to fetch
 * @param categoryParams.itemCategories - The categories of the items to fetch
 * @param options - Options for the fetch
 * @param options.customFetch - A custom fetch function to use instead of the default fetch
 * @param options.version - The version of the OCHRE API to use
 * @returns The parsed items by property value or null if the fetch/parse fails
 */
export async function fetchItemsByPropertyValue<
  T extends DataCategory = DataCategory,
  U extends DataCategory | Array<DataCategory> = T extends "tree" ?
    Exclude<DataCategory, "tree">
  : T extends "set" ? Array<DataCategory>
  : never,
>(
  params: {
    scopeUuids: Array<string>;
    propertyVariableUuids: Array<string>;
    propertyValueUuids: Array<string>;
    projectScopeUuid: string;
  },
  categoryParams?: { category?: T; itemCategories?: U },
  options?: {
    customFetch?: (
      input: string | URL | globalThis.Request,
      init?: RequestInit,
    ) => Promise<Response>;
    version: ApiVersion;
  },
): Promise<
  { items: Array<Item<T, U>>; error: null } | { items: null; error: string }
> {
  try {
    const customFetch = options?.customFetch;
    const version = options?.version ?? DEFAULT_API_VERSION;

    const {
      scopeUuids,
      propertyVariableUuids,
      propertyValueUuids,
      projectScopeUuid,
    } = params;
    const { category, itemCategories } = categoryParams ?? {};

    const xquery = buildXQuery(
      scopeUuids,
      propertyVariableUuids,
      propertyValueUuids,
      projectScopeUuid,
      { version },
    );

    const response = await (customFetch ?? fetch)(
      version === 2 ?
        `https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?xquery=${encodeURIComponent(xquery)}&format=json&lang="*"`
      : `https://ochre.lib.uchicago.edu/ochre?xquery=${encodeURIComponent(xquery)}&format=json&lang="*"`,
    );
    if (!response.ok) {
      throw new Error(`OCHRE API responded with status: ${response.status}`);
    }

    const data = (await response.json()) as {
      result: {
        ochre: {
          resource?: OchreResource | Array<OchreResource>;
          spatialUnit?: OchreSpatialUnit | Array<OchreSpatialUnit>;
          concept?: OchreConcept | Array<OchreConcept>;
          period?: OchrePeriod | Array<OchrePeriod>;
          bibliography?: OchreBibliography | Array<OchreBibliography>;
          person?: OchrePerson | Array<OchrePerson>;
          propertyValue?: OchrePropertyValue | Array<OchrePropertyValue>;
          text?: OchreText | Array<OchreText>;
          set?: OchreSet | Array<OchreSet>;
          tree?: OchreTree | Array<OchreTree>;
        };
      };
    };

    if (Object.keys(data.result.ochre).length === 0) {
      throw new Error("No items found");
    }

    if (category != null && data.result.ochre[category] == null) {
      throw new Error(`No items found for category: ${category}`);
    }

    if (
      (category === "set" || category === "tree") &&
      itemCategories != null &&
      "items" in data.result.ochre[category]! &&
      Array.isArray(data.result.ochre[category].items) &&
      data.result.ochre[category].items.every(
        (item: Item<T, U>) => item.category !== itemCategories,
      )
    ) {
      throw new Error(
        `No items found for category: ${category} and item categories: ${itemCategories}`,
      );
    }

    const items: Array<Item<T, U>> = [];

    if ("resource" in data.result.ochre && data.result.ochre.resource != null) {
      const rawResources =
        Array.isArray(data.result.ochre.resource) ?
          data.result.ochre.resource
        : [data.result.ochre.resource];

      const resources = parseResources(rawResources) as Array<Item<T, U>>;

      items.push(...resources);
    }
    if (
      "spatialUnit" in data.result.ochre &&
      data.result.ochre.spatialUnit != null
    ) {
      const rawSpatialUnits =
        Array.isArray(data.result.ochre.spatialUnit) ?
          data.result.ochre.spatialUnit
        : [data.result.ochre.spatialUnit];

      const spatialUnits = parseSpatialUnits(rawSpatialUnits) as Array<
        Item<T, U>
      >;

      items.push(...spatialUnits);
    }
    if ("concept" in data.result.ochre && data.result.ochre.concept != null) {
      const rawConcepts =
        Array.isArray(data.result.ochre.concept) ?
          data.result.ochre.concept
        : [data.result.ochre.concept];

      const concepts = parseConcepts(rawConcepts) as Array<Item<T, U>>;

      items.push(...concepts);
    }
    if ("period" in data.result.ochre && data.result.ochre.period != null) {
      const rawPeriods =
        Array.isArray(data.result.ochre.period) ?
          data.result.ochre.period
        : [data.result.ochre.period];

      const periods = parsePeriods(rawPeriods) as Array<Item<T, U>>;

      items.push(...periods);
    }
    if (
      "bibliography" in data.result.ochre &&
      data.result.ochre.bibliography != null
    ) {
      const rawBibliographies =
        Array.isArray(data.result.ochre.bibliography) ?
          data.result.ochre.bibliography
        : [data.result.ochre.bibliography];

      const bibliographies = parseBibliographies(rawBibliographies) as Array<
        Item<T, U>
      >;

      items.push(...bibliographies);
    }
    if ("person" in data.result.ochre && data.result.ochre.person != null) {
      const rawPersons =
        Array.isArray(data.result.ochre.person) ?
          data.result.ochre.person
        : [data.result.ochre.person];

      const persons = parsePersons(rawPersons) as Array<Item<T, U>>;

      items.push(...persons);
    }
    if (
      "propertyValue" in data.result.ochre &&
      data.result.ochre.propertyValue != null
    ) {
      const rawPropertyValues =
        Array.isArray(data.result.ochre.propertyValue) ?
          data.result.ochre.propertyValue
        : [data.result.ochre.propertyValue];

      const propertyValues = parsePropertyValues(rawPropertyValues) as Array<
        Item<T, U>
      >;

      items.push(...propertyValues);
    }
    if ("text" in data.result.ochre && data.result.ochre.text != null) {
      const rawTexts =
        Array.isArray(data.result.ochre.text) ?
          data.result.ochre.text
        : [data.result.ochre.text];

      const texts = parseTexts(rawTexts) as Array<Item<T, U>>;

      items.push(...texts);
    }
    if ("set" in data.result.ochre && data.result.ochre.set != null) {
      const rawSets =
        Array.isArray(data.result.ochre.set) ?
          data.result.ochre.set
        : [data.result.ochre.set];

      const sets = parseSets(rawSets) as Array<Item<T, U>>;

      items.push(...sets);
    }
    if ("tree" in data.result.ochre && data.result.ochre.tree != null) {
      const rawTrees =
        Array.isArray(data.result.ochre.tree) ?
          data.result.ochre.tree
        : [data.result.ochre.tree];

      const trees = parseTrees(rawTrees) as Array<Item<T, U>>;

      items.push(...trees);
    }

    return { items, error: null };
  } catch (error) {
    console.error(error);
    return {
      items: null,
      error:
        error instanceof Error ?
          error.message
        : "Failed to fetch items by property value",
    };
  }
}
