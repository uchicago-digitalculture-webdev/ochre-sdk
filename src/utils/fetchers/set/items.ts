import type {
  ApiVersion,
  DataCategory,
  Item,
  PropertyValueContentType,
} from "../../../types/index.js";
import type { RawSet } from "../../../types/raw.js";
import { BELONGS_TO_COLLECTION_UUID } from "../../../constants.js";
import { setItemsParamsSchema } from "../../../schemas.js";
import { DEFAULT_API_VERSION } from "../../helpers.js";
import { parseSets } from "../../parse/index.js";

/**
 * Build an XQuery string to fetch Set items from the OCHRE API
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
          ${propertyVariables.length > 0 && propertyValuesFilters.length > 0 ? `//property[label[${propertyVariables}]][${propertyValuesFilters}]]` : ""}

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
 * Fetches and parses Set items from the OCHRE API
 *
 * @param params - The parameters for the fetch
 * @param params.setScopeUuids - The Set scope UUIDs to filter by
 * @param params.belongsToCollectionScopeUuids - The collection scope UUIDs to filter by
 * @param params.propertyVariableUuids - The property variable UUIDs to query by
 * @param params.propertyValues - The property values to query by
 * @param params.page - The page number (1-indexed)
 * @param params.pageSize - The number of items per page
 * @param params.includeChildItems - Whether to include child items of the same category
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
    propertyValues: Array<{
      dataType: Exclude<PropertyValueContentType, "coordinate">;
      value: string;
    }>;
    page: number;
    pageSize?: number;
    includeChildItems?: boolean;
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
      propertyValues,
      page,
      pageSize,
      includeChildItems,
    } = setItemsParamsSchema.parse(params);

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
                set: RawSet | Array<RawSet>;
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

    if (
      itemCategories != null &&
      "items" in data.result.ochre.items.set &&
      Array.isArray(data.result.ochre.items.set.items) &&
      data.result.ochre.items.set.items.every(
        (item: Item<"set", U>) => !itemCategories.includes(item.category),
      )
    ) {
      throw new Error(
        `No Set items found for item categories: ${itemCategories.join(", ")}`,
      );
    }

    const items: Array<Item<"set", U>> = [];

    const rawSets =
      Array.isArray(data.result.ochre.items.set) ?
        data.result.ochre.items.set
      : [data.result.ochre.items.set];

    const sets = parseSets(rawSets) as Array<Item<"set", U>>;

    items.push(...sets);

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
