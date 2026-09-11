/* eslint-disable unicorn/no-incorrect-template-string-interpolation */
import type { FetchRuntimeOptions, ParserOptions } from "#/parsers/helpers.js";
import type {
  ItemCategory,
  Query,
  SetItem,
  SetItemsSort,
} from "#/types/index.js";
import type { XMLSetItems } from "#/xml/types.js";
import { requestOchre } from "#/fetchers/request.js";
import { parseSetItems } from "#/parsers/index.js";
import {
  parseRequestedLanguages,
  resolveContentLanguages,
} from "#/parsers/languages.js";
import { compileContainerItemsQuery } from "#/query.js";
import { XMLSetItemsData as XMLSetItemsDataSchema } from "#/xml/schemas.js";
import { stringLiteral } from "#/xquery.js";

type SortWithDirection = Exclude<SetItemsSort, { target: "none" }>;
type PropertyValueSort = Extract<SetItemsSort, { target: "propertyValue" }>;
type PropertyValueSortDataType = PropertyValueSort["dataType"];

function hasArray<T>(items: Array<T> | undefined): boolean {
  return items != null && items.length > 0;
}

/**
 * Whether a container payload carries any item of a category
 * @param items - The parsed `<items>` payload
 * @param category - The category to look for
 * @returns True when the payload carries at least one item of it
 * @internal
 */
export function hasItemsCategory(
  items: XMLSetItems,
  category: ItemCategory,
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

  if (sort.target === "date") {
    return `let $orderedItems :=
    for $item at $position in $items
      let $sortKey := string(($item/@date, $item/interpretations/interpretation/@date)[1])
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
 * Fetch one page of the items a Set or a Tree holds
 *
 * The only thing that differs between the two containers is the searchable
 * path {@link compileContainerItemsQuery} picks, so counting, sorting,
 * paginating, validating and parsing are written once here and the public
 * fetchers are thin wrappers that name their own scope parameter.
 * @param parameters - The request parameters
 * @param parameters.container - Whether the scope UUIDs name Sets or Trees
 * @param parameters.scopeUuids - The container UUIDs to search within
 * @param parameters.belongsToCollectionScopeUuids - Collection scope UUIDs to narrow to
 * @param parameters.queries - The query tree to filter by, or null to match every item
 * @param parameters.sort - The sort applied before pagination
 * @param parameters.page - The page number, 1-indexed
 * @param parameters.pageSize - The number of items per page
 * @param parameters.containedItemCategories - Categories the payload must carry
 * @param parameters.label - What is being fetched, used in failure messages
 * @param parameters.options - Fetch and parser options
 * @returns The page of items, deduplicated by UUID
 * @throws When the request fails, validation fails, or a category is missing
 * @internal
 */
export async function fetchContainerItems(parameters: {
  container: "set" | "tree";
  scopeUuids: Array<string>;
  belongsToCollectionScopeUuids: Array<string>;
  queries: Query | null;
  sort: SetItemsSort;
  page: number;
  pageSize: number;
  containedItemCategories?: ReadonlyArray<ItemCategory>;
  label: string;
  options?: FetchRuntimeOptions;
}): Promise<{
  totalCount: number;
  page: number;
  pageSize: number;
  items: Array<SetItem<ItemCategory, ReadonlyArray<string>>>;
}> {
  const {
    container,
    scopeUuids,
    belongsToCollectionScopeUuids,
    queries,
    sort,
    page,
    pageSize,
    containedItemCategories,
    label,
    options,
  } = parameters;

  const requestedLanguages = parseRequestedLanguages(options?.languages);
  const startPosition = (page - 1) * pageSize + 1;

  const output = await requestOchre({
    xquery: compileContainerItemsQuery({
      container,
      scopeUuids,
      belongsToCollectionScopeUuids,
      queries,
      body: ({
        items,
        omitSupplemental,
      }) => `  let $totalCount := count(${items})
  ${buildOrderedItemsClause(sort)}
  let $pagedItems := subsequence($orderedItems, ${startPosition}, ${pageSize})

  return <items totalCount="{$totalCount}" page="${page}" pageSize="${pageSize}">{
    ${omitSupplemental("$pagedItems")}
  }</items>`,
    }),
    schema: XMLSetItemsDataSchema,
    label,
    options,
  });

  if (containedItemCategories != null) {
    const missingCategories = containedItemCategories.filter(
      (category) => !hasItemsCategory(output.result.ochre.items, category),
    );

    if (missingCategories.length > 0) {
      throw new Error(
        `No items found for item categories: ${missingCategories.join(", ")}`,
        { cause: missingCategories },
      );
    }
  }

  const languages = resolveContentLanguages(
    output.result.ochre.items,
    requestedLanguages,
  );
  const parserOptions: ParserOptions<ReadonlyArray<string>> = { languages };
  const items = parseSetItems(output.result.ochre.items, {
    containedItemCategories,
    languages: parserOptions.languages,
  });

  const itemsByUuid = new Map<
    string,
    SetItem<ItemCategory, ReadonlyArray<string>>
  >();
  for (const item of items) {
    if (!itemsByUuid.has(item.uuid)) {
      itemsByUuid.set(item.uuid, item);
    }
  }

  return {
    totalCount: output.result.ochre.items.totalCount,
    page: output.result.ochre.items.page,
    pageSize: output.result.ochre.items.pageSize,
    items: itemsByUuid.values().toArray(),
  };
}
