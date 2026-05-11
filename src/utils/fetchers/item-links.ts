import type { ApiVersion, DataCategory, Item } from "#/types/index.js";
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
} from "#/types/raw.js";
import { ensureArray } from "#/utils/internal.js";
import {
  parseBibliographies,
  parseConcepts,
  parsePeriods,
  parsePersons,
  parsePropertyValues,
  parsePropertyVariables,
  parseResources,
  parseSet,
  parseSpatialUnits,
  parseTexts,
  parseTree,
} from "#/utils/parse/index.js";

/**
 * Build an XQuery string to fetch item links from the OCHRE API
 * @param params - The parameters for the fetch
 * @param params.uuid - The UUID of the OCHRE item to fetch
 * @returns An XQuery string
 */
function buildXQuery(params: { uuid: string }): string {
  const { uuid } = params;

  const xquery = `let $item-uuid := "${uuid}"

let $uuids :=
  distinct-values((

    (: Direct links on most item categories :)
    fn:collection("ochre/resource")/ochre[@uuid = $item-uuid]/resource/links/*/@uuid/string(),
    fn:collection("ochre/bibliography")/ochre[@uuid = $item-uuid]/bibliography/links/*/@uuid/string(),
    fn:collection("ochre/period")/ochre[@uuid = $item-uuid]/period/links/*/@uuid/string(),
    fn:collection("ochre/person")/ochre[@uuid = $item-uuid]/person/links/*/@uuid/string(),
    fn:collection("ochre/propertyVariable")/ochre[@uuid = $item-uuid]/propertyVariable/links/*/@uuid/string(),
    fn:collection("ochre/propertyValue")/ochre[@uuid = $item-uuid]/propertyValue/links/*/@uuid/string(),
    fn:collection("ochre/text")/ochre[@uuid = $item-uuid]/text/links/*/@uuid/string(),
    fn:collection("ochre/tree")/ochre[@uuid = $item-uuid]/tree/links/*/@uuid/string(),
    fn:collection("ochre/set")/ochre[@uuid = $item-uuid]/set/links/*/@uuid/string(),

    (: Special category structures :)
    fn:collection("ochre/spatialUnit")/ochre[@uuid = $item-uuid]/spatialUnit/observations/observation/links/*/@uuid/string(),
    fn:collection("ochre/concept")/ochre[@uuid = $item-uuid]/concept/interpretations/interpretation/links/*/@uuid/string()
  ))

return
    <items>{(
      fn:collection("ochre/resource")/ochre/resource[@uuid = $uuids],
      fn:collection("ochre/bibliography")/ochre/bibliography[@uuid = $uuids],
      fn:collection("ochre/period")/ochre/period[@uuid = $uuids],
      fn:collection("ochre/person")/ochre/person[@uuid = $uuids],
      fn:collection("ochre/propertyVariable")/ochre/propertyVariable[@uuid = $uuids],
      fn:collection("ochre/propertyValue")/ochre/propertyValue[@uuid = $uuids],
      fn:collection("ochre/text")/ochre/text[@uuid = $uuids],
      fn:collection("ochre/tree")/ochre/tree[@uuid = $uuids],
      fn:collection("ochre/set")/ochre/set[@uuid = $uuids],
      fn:collection("ochre/spatialUnit")/ochre/spatialUnit[@uuid = $uuids],
      fn:collection("ochre/concept")/ochre/concept[@uuid = $uuids]
    )}</items>`;

  return `<ochre>{${xquery}}</ochre>`;
}

/**
 * Fetches and parses an OCHRE item links from the OCHRE API
 *
 * @param uuid - The UUID of the OCHRE item to fetch
 * @param category - The category of the OCHRE item to fetch
 * @param itemCategories - The categories of the OCHRE linked items to fetch
 * @param options - The options for the fetch
 * @param options.fetch - The fetch function to use
 * @param options.version - The version of the OCHRE API to use
 * @returns Object containing the parsed OCHRE item links, or an error message if the fetch/parse fails
 */
export async function fetchItemLinks<
  T extends DataCategory = DataCategory,
  U extends DataCategory | Array<DataCategory> = T extends "tree" ?
    Exclude<DataCategory, "tree">
  : T extends "set" ? Array<DataCategory>
  : never,
>(
  uuid: string,
  category?: T,
  itemCategories?: U,
  options?: {
    fetch?: (
      input: string | URL | globalThis.Request,
      init?: RequestInit,
    ) => Promise<Response>;
    version?: ApiVersion;
  },
): Promise<
  { error: null; items: Array<Item<T, U>> } | { error: string; items: never }
> {
  try {
    if (options?.version != null && options.version !== 2) {
      throw new Error("Set item queries only support API version 2");
    }

    const xquery = buildXQuery({ uuid });

    const response = await (options?.fetch ?? fetch)(
      "https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?xquery&format=json",
      {
        method: "POST",
        body: xquery,
        headers: { "Content-Type": "application/xquery" },
      },
    );
    if (!response.ok) {
      throw new Error(`OCHRE API responded with status: ${response.status}`);
    }

    const data = (await response.json()) as {
      result:
        | {
            ochre: {
              items: {
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
      throw new Error("Invalid OCHRE API response");
    }

    const rawItems = data.result.ochre.items;
    const items: Array<Item> = [];

    if (rawItems.resource != null) {
      items.push(...parseResources(ensureArray(rawItems.resource)));
    }
    if (rawItems.spatialUnit != null) {
      items.push(...parseSpatialUnits(ensureArray(rawItems.spatialUnit)));
    }
    if (rawItems.concept != null) {
      items.push(...parseConcepts(ensureArray(rawItems.concept)));
    }
    if (rawItems.period != null) {
      items.push(...parsePeriods(ensureArray(rawItems.period)));
    }
    if (rawItems.bibliography != null) {
      items.push(...parseBibliographies(ensureArray(rawItems.bibliography)));
    }
    if (rawItems.person != null) {
      items.push(...parsePersons(ensureArray(rawItems.person)));
    }
    if (rawItems.propertyVariable != null) {
      items.push(
        ...parsePropertyVariables(ensureArray(rawItems.propertyVariable)),
      );
    }
    if (rawItems.propertyValue != null) {
      items.push(...parsePropertyValues(ensureArray(rawItems.propertyValue)));
    }
    if (rawItems.text != null) {
      items.push(...parseTexts(ensureArray(rawItems.text)));
    }
    if (rawItems.set != null) {
      for (const linkedSet of ensureArray(rawItems.set)) {
        items.push(
          parseSet(
            linkedSet,
            itemCategories as Array<DataCategory> | undefined,
          ),
        );
      }
    }
    if (rawItems.tree != null) {
      for (const linkedTree of ensureArray(rawItems.tree)) {
        items.push(
          parseTree(
            linkedTree,
            itemCategories as Array<Exclude<DataCategory, "tree">> | undefined,
          ),
        );
      }
    }

    return { error: null as never, items: items as Array<Item<T, U>> };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      items: undefined as never,
    };
  }
}
