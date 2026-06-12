import { XMLParser } from "fast-xml-parser";
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
import type { XMLSetItems, XMLSetItemsData } from "#/xml/types.js";
import {
  BELONGS_TO_COLLECTION_UUID,
  DEFAULT_LANGUAGES,
  XML_PARSER_OPTIONS,
} from "#/constants.js";
import { parseSetItems } from "#/parsers/index.js";
import {
  buildAndCtsQueryExpression,
  buildBelongsToCollectionQueryExpression,
  buildQueryPlan,
} from "#/query.js";
import { iso639_3Schema, setItemsParamsSchema } from "#/schemas.js";
import {
  createSchemaValidationError,
  getErrorOutput,
  stringLiteral,
} from "#/utils.js";
import { restoreXMLMetadata } from "#/xml/metadata.js";
import { XMLSetItemsData as XMLSetItemsDataSchema } from "#/xml/schemas.js";

type FetchSetItemsCategory<
  TContainedItemCategories extends ReadonlyArray<SetItemCategory> | undefined,
> =
  TContainedItemCategories extends ReadonlyArray<infer U>
    ? Extract<U, SetItemCategory>
    : SetItemCategory;

type SortWithDirection = Exclude<SetItemsSort, { target: "none" }>;
type PropertyValueSort = Extract<SetItemsSort, { target: "propertyValue" }>;
type PropertyValueSortDataType = PropertyValueSort["dataType"];

function parseLanguages<const T extends ReadonlyArray<string>>(
  languages: T,
): T {
  const parsedLanguages: Array<string> = [];
  for (const language of languages) {
    parsedLanguages.push(v.parse(iso639_3Schema, language));
  }

  return parsedLanguages as unknown as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function collectContentLanguages(value: unknown, languages: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectContentLanguages(item, languages);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const content = value.content;
  if (Array.isArray(content)) {
    for (const contentItem of content) {
      if (!isRecord(contentItem)) {
        continue;
      }

      const language = contentItem.lang;
      if (typeof language === "string" && language !== "zxx") {
        languages.add(language);
      }
    }
  }

  for (const child of Object.values(value)) {
    collectContentLanguages(child, languages);
  }
}

function resolveSetItemsLanguages(
  data: XMLSetItemsData,
  requestedLanguages: ReadonlyArray<string>,
): ReadonlyArray<string> {
  if (requestedLanguages.length > 0) {
    return requestedLanguages;
  }

  const languages = new Set<string>();
  collectContentLanguages(data.result.ochre.items, languages);

  return languages.size > 0 ? [...languages] : [...DEFAULT_LANGUAGES];
}

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

  return dataType === "string" || dataType === "IDREF"
    ? buildStringOrderByClause(direction)
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
 * @param params - The parameters for the fetch
 * @param params.setScopeUuids - An array of Set scope UUIDs to filter by
 * @param params.belongsToCollectionScopeUuids - An array of collection scope UUIDs to filter by
 * @param params.queries - Recursive query tree used to filter matching items
 * @param params.sort - Optional sorting configuration applied before pagination.
 * For propertyValue sorting, dataType is required and the sort key uses the first valid leaf value (value[not(@i)]).
 * @param params.page - The page number (1-indexed)
 * @param params.pageSize - The number of items per page
 * @returns An XQuery string
 */
function buildXQuery(params: {
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
  } = params;

  const startPosition = (page - 1) * pageSize + 1;
  const setScopeValues = setScopeUuids.map((uuid) => stringLiteral(uuid));
  const setScopeDeclaration = `declare variable $setScopeUuids := (${setScopeValues.join(", ")});`;
  const baseItemsExpression = "doc()/ochre/set[@uuid = $setScopeUuids]/items/*";
  const compiledQueryPlan = buildQueryPlan({ queries });
  const itemsQueryExpressions: Array<string> = [];
  const belongsToCollectionQueryExpression =
    buildBelongsToCollectionQueryExpression(
      belongsToCollectionScopeUuids,
      BELONGS_TO_COLLECTION_UUID,
    );

  if (compiledQueryPlan.queryExpression != null) {
    itemsQueryExpressions.push(compiledQueryPlan.queryExpression);
  }

  if (belongsToCollectionQueryExpression != null) {
    itemsQueryExpressions.push(belongsToCollectionQueryExpression);
  }

  const itemsQueryExpression = buildAndCtsQueryExpression(
    itemsQueryExpressions,
  );
  const orderedItemsClause = buildOrderedItemsClause(sort);
  const xqueryDeclarations = ['xquery version "1.0-ml";', setScopeDeclaration];

  if (compiledQueryPlan.prolog !== "") {
    xqueryDeclarations.push(compiledQueryPlan.prolog);
  }

  const itemsClause =
    itemsQueryExpression == null
      ? `let $items := ${baseItemsExpression}`
      : `let $query := ${itemsQueryExpression}
  let $items := cts:search(${baseItemsExpression}, $query)`;

  const xquery = `${xqueryDeclarations.join("\n\n")}

<ochre>{
${itemsClause}
  let $totalCount := count($items)
  ${orderedItemsClause}
  let $pagedItems := subsequence($orderedItems, ${startPosition}, ${pageSize})

  return <items totalCount="{$totalCount}" page="${page}" pageSize="${pageSize}">{
    $pagedItems
  }</items>
}</ochre>`;

  return xquery;
}

/**
 * Fetches and parses Set items from the OCHRE API
 *
 * @param params - The parameters for the fetch
 * @param params.setScopeUuids - The Set scope UUIDs to filter by
 * @param params.queries - Recursive query tree used to filter matching items
 * @param params.sort - Optional sorting configuration applied before pagination.
 * For propertyValue sorting, dataType is required and the sort key uses the first valid leaf value (value[not(@i)]).
 * @param params.page - The page number (1-indexed)
 * @param params.pageSize - The number of items per page
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
  params: {
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
  params: {
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
    } = v.parse(setItemsParamsSchema, params);
    const requestedLanguages: ReadonlyArray<string> =
      options?.languages == null ? [] : parseLanguages(options.languages);

    const xquery = buildXQuery({
      setScopeUuids,
      belongsToCollectionScopeUuids,
      queries,
      sort,
      page,
      pageSize,
    });

    const response = await (options?.fetch ?? fetch)(
      'https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?xquery&xsl=none&lang="*"',
      {
        method: "POST",
        body: xquery,
        headers: { "Content-Type": "application/xquery" },
      },
    );
    if (!response.ok) {
      throw new Error(`OCHRE API responded with status: ${response.status}`, {
        cause: response.statusText,
      });
    }

    const dataRaw = await response.text();
    const parser = new XMLParser(XML_PARSER_OPTIONS);
    const data = parser.parse(dataRaw) as unknown;

    const { success, issues, output } = v.safeParse(
      XMLSetItemsDataSchema,
      data,
    );
    if (!success) {
      throw createSchemaValidationError(
        "Failed to parse OCHRE Set items",
        issues,
      );
    }
    restoreXMLMetadata(output, data);

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

    const languages = resolveSetItemsLanguages(output, requestedLanguages);
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
    const uniqueItems = [...itemsByUuid.values()];

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
