/* eslint-disable unicorn/no-incorrect-template-string-interpolation */
import * as v from "valibot";
import type {
  FetchBaseOptions,
  FetchLanguages,
  FetchRuntimeOptions,
} from "#/parsers/helpers.js";
import type {
  Query,
  SetItem,
  SetItemCategory,
  SetItemsSort,
} from "#/types/index.js";
import type { XMLSetItems } from "#/xml/types.js";
import { getErrorOutput } from "#/errors.js";
import { requestOchre } from "#/fetchers/request.js";
import { parseSetItems } from "#/parsers/index.js";
import {
  parseRequestedLanguages,
  resolveContentLanguages,
} from "#/parsers/languages.js";
import { compileSetItemsQuery } from "#/query.js";
import { setItemsParametersSchema } from "#/schemas.js";
import { XMLSetItemsData as XMLSetItemsDataSchema } from "#/xml/schemas.js";
import { stringLiteral } from "#/xquery.js";

type FetchSetItemsCategory<
  TContainedItemCategories extends ReadonlyArray<SetItemCategory> | undefined,
> =
  TContainedItemCategories extends ReadonlyArray<infer U>
    ? Extract<U, SetItemCategory>
    : SetItemCategory;

type SortWithDirection = Exclude<SetItemsSort, { target: "none" }>;
type PropertyValueSort = Extract<SetItemsSort, { target: "propertyValue" }>;
type PropertyValueSortDataType = PropertyValueSort["dataType"];

function hasArray<T>(items: Array<T> | undefined): boolean {
  return items != null && items.length > 0;
}

function hasSetItemsCategory(
  items: XMLSetItems,
  category: SetItemCategory,
): boolean {
  switch (category) {
    case "tree": {
      return hasArray(items.tree);
    }
    case "bibliography": {
      return hasArray(items.bibliography);
    }
    case "concept": {
      return hasArray(items.concept);
    }
    case "spatialUnit": {
      return hasArray(items.spatialUnit);
    }
    case "period": {
      return hasArray(items.period);
    }
    case "person": {
      return hasArray(items.person);
    }
    case "propertyVariable": {
      return hasArray(items.propertyVariable) || hasArray(items.variable);
    }
    case "propertyValue": {
      return hasArray(items.propertyValue) || hasArray(items.value);
    }
    case "resource": {
      return hasArray(items.resource);
    }
    case "text": {
      return hasArray(items.text);
    }
    case "set": {
      return hasArray(items.set);
    }
  }
}

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

function buildPropertyValueTypedSortKeyExpression(parameters: {
  sort: PropertyValueSort;
  dataType: Exclude<PropertyValueSortDataType, "string" | "IDREF">;
}): string {
  const { sort, dataType } = parameters;

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

function buildPropertyValueOrderByClause(parameters: {
  dataType: PropertyValueSortDataType;
  direction: "ascending" | "descending";
}): string {
  const { dataType, direction } = parameters;

  const buildOrderByClause =
    dataType === "string" || dataType === "IDREF"
      ? buildStringOrderByClause
      : buildTypedOrderByClause;
  return buildOrderByClause(direction);
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
    sort.dataType === "string" || sort.dataType === "IDREF"
      ? buildPropertyValueStringSortKeyExpression(sort)
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
 * @param parameters - The parameters for the fetch
 * @param parameters.setScopeUuids - An array of Set scope UUIDs to filter by
 * @param parameters.belongsToCollectionScopeUuids - An array of collection scope UUIDs to filter by
 * @param parameters.queries - Recursive query tree used to filter matching items
 * @param parameters.sort - Optional sorting configuration applied before pagination.
 * For propertyValue sorting, dataType is required and the sort key uses the first valid leaf value (value[not(@i)]).
 * @param parameters.page - The page number (1-indexed)
 * @param parameters.pageSize - The number of items per page
 * @returns An XQuery string
 */
function buildXQuery(parameters: {
  setScopeUuids: Array<string>;
  belongsToCollectionScopeUuids: Array<string>;
  queries: Query | null;
  sort: SetItemsSort;
  page: number;
  pageSize: number;
}): string {
  const {
    queries,
    sort,
    setScopeUuids,
    belongsToCollectionScopeUuids,
    page,
    pageSize,
  } = parameters;

  const startPosition = (page - 1) * pageSize + 1;

  return compileSetItemsQuery({
    setScopeUuids,
    belongsToCollectionScopeUuids,
    queries,
    body: ({ items, omitSupplemental }) => `  let $totalCount := count(${items})
  ${buildOrderedItemsClause(sort)}
  let $pagedItems := subsequence($orderedItems, ${startPosition}, ${pageSize})

  return <items totalCount="{$totalCount}" page="${page}" pageSize="${pageSize}">{
    ${omitSupplemental("$pagedItems")}
  }</items>`,
  });
}

/**
 * Fetches and parses Set items from the OCHRE API
 *
 * @param parameters - The parameters for the fetch
 * @param parameters.setScopeUuids - The Set scope UUIDs to filter by
 * @param parameters.queries - Recursive query tree used to filter matching items
 * @param parameters.sort - Optional sorting configuration applied before pagination.
 * For propertyValue sorting, dataType is required and the sort key uses the first valid leaf value (value[not(@i)]).
 * @param parameters.page - The page number (1-indexed)
 * @param parameters.pageSize - The number of items per page
 * @param containedItemCategories - The categories of the items to fetch
 * @param options - Options for the fetch
 * @param options.fetch - The fetch function to use
 * @returns The parsed Set items or null if the fetch/parse fails
 */
export async function fetchSetItems<
  const TContainedItemCategories extends
    | ReadonlyArray<SetItemCategory>
    | undefined = undefined,
  const TLanguages extends ReadonlyArray<string> | undefined = undefined,
>(
  parameters: {
    setScopeUuids: Array<string>;
    queries?: Query | null;
    sort?: SetItemsSort;
    page: number;
    pageSize?: number;
  },
  containedItemCategories?: TContainedItemCategories,
  options?: FetchBaseOptions<TLanguages>,
): Promise<
  | {
      totalCount: number;
      page: number;
      pageSize: number;
      items: Array<
        SetItem<
          FetchSetItemsCategory<TContainedItemCategories>,
          FetchLanguages<TLanguages>
        >
      >;
      error: null;
      detailedError: null;
    }
  | {
      totalCount: null;
      page: null;
      pageSize: null;
      items: null;
      error: string;
      detailedError: string;
    }
>;
export async function fetchSetItems(
  parameters: {
    setScopeUuids: Array<string>;
    queries?: Query | null;
    sort?: SetItemsSort;
    page: number;
    pageSize?: number;
  },
  containedItemCategories?: ReadonlyArray<SetItemCategory>,
  options?: FetchRuntimeOptions,
): Promise<
  | {
      totalCount: number;
      page: number;
      pageSize: number;
      items: Array<SetItem<SetItemCategory, ReadonlyArray<string>>>;
      error: null;
      detailedError: null;
    }
  | {
      totalCount: null;
      page: null;
      pageSize: null;
      items: null;
      error: string;
      detailedError: string;
    }
> {
  try {
    const {
      setScopeUuids,
      belongsToCollectionScopeUuids,
      queries,
      sort,
      page,
      pageSize,
    } = v.parse(setItemsParametersSchema, parameters);
    const requestedLanguages = parseRequestedLanguages(options?.languages);

    const output = await requestOchre({
      xquery: buildXQuery({
        setScopeUuids,
        belongsToCollectionScopeUuids,
        queries,
        sort,
        page,
        pageSize,
      }),
      schema: XMLSetItemsDataSchema,
      label: "OCHRE Set items",
      options,
    });

    if (containedItemCategories != null) {
      const missingCategories = containedItemCategories.filter(
        (category) => !hasSetItemsCategory(output.result.ochre.items, category),
      );

      if (missingCategories.length > 0) {
        throw new Error(
          `No Set items found for item categories: ${missingCategories.join(", ")}`,
          { cause: missingCategories },
        );
      }
    }

    const languages = resolveContentLanguages(
      output.result.ochre.items,
      requestedLanguages,
    );
    const items = parseSetItems(output.result.ochre.items, {
      containedItemCategories,
      languages,
    });

    const itemsByUuid = new Map<
      string,
      SetItem<SetItemCategory, ReadonlyArray<string>>
    >();
    for (const item of items) {
      if (!itemsByUuid.has(item.uuid)) {
        itemsByUuid.set(item.uuid, item);
      }
    }
    const uniqueItems = itemsByUuid.values().toArray();

    return {
      totalCount: output.result.ochre.items.totalCount,
      page: output.result.ochre.items.page,
      pageSize: output.result.ochre.items.pageSize,
      items: uniqueItems,
      error: null,
      detailedError: null,
    };
  } catch (error) {
    return {
      totalCount: null,
      page: null,
      pageSize: null,
      items: null,
      ...getErrorOutput(error, "Failed to fetch Set items"),
    };
  }
}
