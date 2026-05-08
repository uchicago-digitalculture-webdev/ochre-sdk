import { XMLParser } from "fast-xml-parser";
import * as v from "valibot";
import type {
  PropertyValueContent,
  PropertyValueQueryItem,
  Query,
  SetAttributeValueQueryItem,
} from "#/types/index.js";
import { BELONGS_TO_COLLECTION_UUID, XML_PARSER_OPTIONS } from "#/constants.js";
import {
  buildAndCtsQueryExpression,
  buildBelongsToCollectionQueryExpression,
  buildQueryPlan,
} from "#/query.js";
import { setPropertyValuesParamsSchema } from "#/schemas.js";
import { logIssues, stringLiteral } from "#/utils.js";

type ParsedPropertyValueItem = {
  scope: "global" | "variable";
  variableUuid: string | null;
  count: number;
  globalCount: number | null;
  dataType: PropertyValueQueryDataType;
  content: string | number | boolean | null;
  label: string | null;
};

type ParsedAttributeValueItem = {
  attributeType: "bibliographies" | "periods";
  count: number;
  content: string | null;
};

type PropertyValueQueryDataType = Exclude<
  PropertyValueContent<ReadonlyArray<string>>["dataType"],
  "coordinate"
>;

function parsePropertyValueLabel(
  content: string | null | undefined,
): string | null {
  if (content == null || content === "") {
    return null;
  }

  return content === "<unassigned>" ? null : content;
}

function parsePropertyValueBooleanContent(
  rawValue: string | null | undefined,
): boolean | null {
  if (rawValue == null || rawValue === "") {
    return null;
  }

  return rawValue.toLocaleLowerCase("en-US") === "true";
}

function normalizePropertyValueDataType(
  dataType: string,
): PropertyValueQueryDataType {
  const normalizedDataType =
    dataType.startsWith("xs:") ? dataType.slice(3) : dataType;

  switch (normalizedDataType) {
    case "IDREF":
    case "boolean":
    case "date":
    case "dateTime":
    case "decimal":
    case "integer":
    case "string":
    case "time": {
      return normalizedDataType;
    }
    default: {
      return "string";
    }
  }
}

function sortPropertyValues(
  values: Array<PropertyValueQueryItem>,
): Array<PropertyValueQueryItem> {
  return values.toSorted((a, b) => {
    if (a.count !== b.count) {
      return b.count - a.count;
    }

    if (a.label !== b.label) {
      return a.label?.localeCompare(b.label ?? "") ?? 0;
    }

    return (
      a.content?.toString().localeCompare(b.content?.toString() ?? "") ?? 0
    );
  });
}

function getPropertyValueKey(value: {
  dataType: PropertyValueQueryDataType;
  content: string | number | boolean;
}): string {
  return `${value.dataType}|${typeof value.content}:${value.content.toLocaleString("en-US")}`;
}

function sortAttributeValues(
  values: Array<SetAttributeValueQueryItem>,
): Array<SetAttributeValueQueryItem> {
  return values.toSorted((a, b) => {
    if (a.count !== b.count) {
      return b.count - a.count;
    }

    return a.content.localeCompare(b.content);
  });
}

const countSchema = v.pipe(
  v.optional(v.union([v.number(), v.string()]), 1),
  v.transform((val) => {
    if (val === "") {
      return 1;
    }

    const count = Number(val);

    return Number.isFinite(count) ? count : 1;
  }),
);

function getPropertyVariableUuidsFromQueries(
  queries: Query | null,
): Array<string> {
  const propertyVariableUuids = new Set<string>();

  if (queries == null) {
    return [];
  }

  const pendingQueries: Array<Query> = [queries];

  for (const query of pendingQueries) {
    if ("target" in query) {
      if (query.target !== "property") {
        continue;
      }

      if (query.propertyVariable != null) {
        propertyVariableUuids.add(query.propertyVariable);
      }

      continue;
    }

    pendingQueries.push(...("and" in query ? query.and : query.or));
  }

  return [...propertyVariableUuids];
}

function getItemFilterQueriesFromPropertyValueQueries(
  queries: Query | null,
): Query | null {
  if (queries == null) {
    return null;
  }

  if ("target" in queries) {
    if (queries.target !== "property") {
      return queries;
    }

    if (queries.dataType === "date" || queries.dataType === "dateTime") {
      return queries;
    }

    return "value" in queries && queries.value != null ? queries : null;
  }

  const filteredChildren: Array<Query> = [];
  const childQueries = "and" in queries ? queries.and : queries.or;

  for (const childQuery of childQueries) {
    const filteredChildQuery =
      getItemFilterQueriesFromPropertyValueQueries(childQuery);

    if (filteredChildQuery != null) {
      filteredChildren.push(filteredChildQuery);
    }
  }

  if (filteredChildren.length === 0) {
    return null;
  }

  if (filteredChildren.length === 1) {
    return filteredChildren[0] ?? null;
  }

  return "and" in queries ?
      { and: filteredChildren }
    : { or: filteredChildren };
}

/**
 * Schema for a single property value query item in the OCHRE API response
 */
const propertyValueQueryItemSchema = v.pipe(
  v.object({
    uuid: v.optional(v.string(), ""),
    scope: v.optional(v.picklist(["global", "variable"]), "global"),
    variableUuid: v.optional(v.string()),
    count: countSchema,
    globalCount: v.nullish(countSchema),
    dataType: v.optional(v.string(), "string"),
    rawValue: v.optional(v.string()),
    payload: v.optional(v.string()),
  }),
  v.transform((val): ParsedPropertyValueItem => {
    const dataType = normalizePropertyValueDataType(val.dataType);
    const label = parsePropertyValueLabel(val.payload);
    const returnValue: ParsedPropertyValueItem = {
      scope: val.scope,
      variableUuid:
        val.variableUuid != null && val.variableUuid !== "" ?
          val.variableUuid
        : null,
      count: val.count,
      globalCount: val.globalCount ?? null,
      dataType,
      content: null,
      label,
    };

    switch (dataType) {
      case "IDREF": {
        returnValue.content = val.uuid !== "" ? val.uuid : null;
        break;
      }
      case "integer":
      case "decimal":
      case "time": {
        if (val.rawValue != null && val.rawValue !== "") {
          const numericContent = Number(val.rawValue);
          returnValue.content =
            Number.isNaN(numericContent) ? null : numericContent;
        }
        break;
      }
      case "boolean": {
        returnValue.content = parsePropertyValueBooleanContent(val.rawValue);
        break;
      }
      default: {
        returnValue.content =
          val.rawValue != null && val.rawValue !== "" ?
            val.rawValue.toString()
          : (label ?? null);
        break;
      }
    }

    return returnValue;
  }),
);

const attributeValueQueryItemSchema = v.pipe(
  v.object({
    attributeType: v.picklist(["bibliographies", "periods"]),
    count: countSchema,
    content: v.optional(v.string()),
    payload: v.optional(v.string()),
  }),
  v.transform(
    (val): ParsedAttributeValueItem => ({
      attributeType: val.attributeType,
      count: val.count,
      content:
        val.content != null && val.content !== "" ? val.content
        : val.payload != null && val.payload !== "" ? val.payload
        : null,
    }),
  ),
);

/**
 * Schema for the property values OCHRE API response
 */
const responseSchema = v.object({
  result: v.object({
    ochre: v.object({
      payload: v.optional(v.string()),
      propertyValue: v.optional(
        v.union([
          v.array(propertyValueQueryItemSchema),
          propertyValueQueryItemSchema,
        ]),
      ),
      attributeValue: v.optional(
        v.union([
          v.array(attributeValueQueryItemSchema),
          attributeValueQueryItemSchema,
        ]),
      ),
    }),
  }),
});

/**
 * Build an XQuery string to fetch property values from the OCHRE API
 * @param params - The parameters for the fetch
 * @param params.setScopeUuids - An array of set scope UUIDs to filter by
 * @param params.belongsToCollectionScopeUuids - An array of collection scope UUIDs to filter by
 * @param params.queries - Recursive query tree used to filter matching items
 * @param params.propertyVariableUuids - Property variable UUIDs to aggregate, if any
 * @param params.attributes - Whether to return values for bibliographies and periods
 * @param params.attributes.bibliographies - Whether to return values for bibliographies
 * @param params.attributes.periods - Whether to return values for periods
 * @param params.isLimitedToLeafPropertyValues - Whether to limit the property values to leaf property values
 * @returns An XQuery string
 */
function buildXQuery(params: {
  setScopeUuids: Array<string>;
  belongsToCollectionScopeUuids: Array<string>;
  queries: Query | null;
  propertyVariableUuids: Array<string>;
  attributes: { bibliographies: boolean; periods: boolean };
  isLimitedToLeafPropertyValues: boolean;
}): string {
  const {
    setScopeUuids,
    belongsToCollectionScopeUuids,
    queries,
    propertyVariableUuids,
    attributes,
    isLimitedToLeafPropertyValues,
  } = params;

  const setScopeValues = setScopeUuids.map((uuid) => stringLiteral(uuid));
  const setScopeDeclaration = `declare variable $setScopeUuids := (${setScopeValues.join(", ")});`;
  const baseItemsExpression = "doc()/ochre/set[@uuid = $setScopeUuids]/items/*";
  const compiledQueryPlan = buildQueryPlan({
    queries: getItemFilterQueriesFromPropertyValueQueries(queries),
  });
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
  const valueFilter = isLimitedToLeafPropertyValues ? "[not(@i)]" : "";
  const queryBlocks: Array<string> = [];
  const returnedSequences: Array<string> = [];
  const xqueryDeclarations = [
    'xquery version "1.0-ml";',
    'declare namespace map = "http://marklogic.com/xdmp/map";',
    setScopeDeclaration,
    `declare function local:increment-count($counts, $key) {
  let $current := map:get($counts, $key)
  return map:put(
    $counts,
    $key,
    if (empty($current)) then 1 else xs:integer($current) + 1
  )
};

declare function local:value-display($v) {
  if ($v/content)
  then string-join($v/content[@xml:lang="eng"]//text(), "")
  else string($v)
};

declare function local:value-content($data-type, $raw-value, $value-uuid, $display) {
  if ($data-type = "IDREF") then $value-uuid
  else if ($data-type = ("integer", "decimal", "time")) then
    if ($raw-value castable as xs:double)
    then string(xs:double($raw-value))
    else ""
  else if ($data-type = "boolean") then
    if ($raw-value = "") then ""
    else if (lower-case($raw-value) = "true") then "true"
    else "false"
  else if ($raw-value != "") then $raw-value
  else if ($display != "" and $display != "<unassigned>") then $display
  else ""
};

declare function local:value-kind($data-type) {
  if ($data-type = ("integer", "decimal", "time")) then "number"
  else if ($data-type = "boolean") then "boolean"
  else "string"
};

declare function local:property-output-raw-value($data-type, $raw-value, $content) {
  if ($data-type = ("integer", "decimal", "time", "boolean")) then $content
  else $raw-value
};

declare function local:put-property-detail(
  $details,
  $key,
  $scope,
  $variable-uuid,
  $value-uuid,
  $raw-value,
  $data-type,
  $display
) {
  let $existing := map:get($details, $key)
  return
    if (
      empty($existing)
      or (string-length(string($existing)) = 0 and string-length($display) gt 0)
    ) then
      map:put(
        $details,
        $key,
        <propertyValue scope="{$scope}" variableUuid="{$variable-uuid}" uuid="{$value-uuid}" rawValue="{$raw-value}" dataType="{$data-type}">{$display}</propertyValue>
      )
    else ()
};

declare function local:add-property-facet(
  $counts,
  $details,
  $seen,
  $key,
  $scope,
  $variable-uuid,
  $value-uuid,
  $raw-value,
  $data-type,
  $display
) {
  if (exists(map:get($seen, $key))) then ()
  else (
    map:put($seen, $key, true()),
    local:increment-count($counts, $key),
    local:put-property-detail($details, $key, $scope, $variable-uuid, $value-uuid, $raw-value, $data-type, $display)
  )
};

declare function local:add-attribute-facet($counts, $seen, $key) {
  if (exists(map:get($seen, $key))) then ()
  else (
    map:put($seen, $key, true()),
    local:increment-count($counts, $key)
  )
};`,
  ];

  if (compiledQueryPlan.prolog !== "") {
    xqueryDeclarations.push(compiledQueryPlan.prolog);
  }

  if (propertyVariableUuids.length > 0) {
    const propertyVariableValues = propertyVariableUuids.map((uuid) =>
      stringLiteral(uuid),
    );

    xqueryDeclarations.push(
      `declare variable $facetLabelUuids := (${propertyVariableValues.join(", ")});`,
    );
    queryBlocks.push(`let $global-property-counts := map:map()
let $variable-property-counts := map:map()
let $variable-property-details := map:map()
let $variable-property-global-keys := map:map()
let $_property-aggregation := xdmp:eager(
  for $item in $items
  let $global-seen := map:map()
  let $variable-seen := map:map()
  return
    for $p in $item/properties/property[label/@uuid = $facetLabelUuids]
    let $variable-uuid := string($p/label/@uuid)
    for $v in $p/value${valueFilter}
    let $value-uuid := string($v/@uuid)
    let $raw-value := string($v/@rawValue)
    let $data-type := string($v/@dataType)
    let $display := local:value-display($v)
    let $content := local:value-content($data-type, $raw-value, $value-uuid, $display)
    let $value-kind := local:value-kind($data-type)
    let $output-raw-value := local:property-output-raw-value($data-type, $raw-value, $content)
    let $global-key := string-join(($data-type, $value-kind, $content), "||")
    let $variable-key := string-join(($variable-uuid, $data-type, $value-kind, $content), "||")
    where $content != ""
    return (
      local:add-attribute-facet($global-property-counts, $global-seen, $global-key),
      local:add-property-facet($variable-property-counts, $variable-property-details, $variable-seen, $variable-key, "variable", $variable-uuid, $value-uuid, $output-raw-value, $data-type, $display),
      map:put($variable-property-global-keys, $variable-key, $global-key)
    )
)

let $property-values :=
  (
    $_property-aggregation,
    for $key in map:keys($variable-property-counts)
    let $detail := map:get($variable-property-details, $key)
    let $global-key := map:get($variable-property-global-keys, $key)
    return <propertyValue scope="variable" variableUuid="{string($detail/@variableUuid)}" uuid="{string($detail/@uuid)}" rawValue="{string($detail/@rawValue)}" dataType="{string($detail/@dataType)}" count="{map:get($variable-property-counts, $key)}" globalCount="{map:get($global-property-counts, $global-key)}">{
      string($detail)
    }</propertyValue>
  )`);
    returnedSequences.push("$property-values");
  }

  if (attributes.bibliographies) {
    queryBlocks.push(`let $bibliography-counts := map:map()
let $_bibliography-aggregation := xdmp:eager(
  for $item in $items
  let $seen := map:map()
  return
    for $bibliography in $item/bibliographies/bibliography
    let $label := string-join($bibliography/identification/label/content[@xml:lang="eng"]//text(), "")
    where string-length($label) gt 0
    return local:add-attribute-facet($bibliography-counts, $seen, $label)
)

let $bibliography-values :=
  (
    $_bibliography-aggregation,
    for $label in map:keys($bibliography-counts)
    return <attributeValue attributeType="bibliographies" count="{map:get($bibliography-counts, $label)}" content="{$label}" />
  )`);
    returnedSequences.push("$bibliography-values");
  }

  if (attributes.periods) {
    queryBlocks.push(`let $period-counts := map:map()
let $_period-aggregation := xdmp:eager(
  for $item in $items
  let $seen := map:map()
  return
    for $period in $item/periods/period
    let $label := string-join($period/identification/label/content[@xml:lang="eng"]//text(), "")
    where string-length($label) gt 0
    return local:add-attribute-facet($period-counts, $seen, $label)
)

let $period-values :=
  (
    $_period-aggregation,
    for $label in map:keys($period-counts)
    return <attributeValue attributeType="periods" count="{map:get($period-counts, $label)}" content="{$label}" />
  )`);
    returnedSequences.push("$period-values");
  }

  const itemsClause =
    itemsQueryExpression == null ?
      `let $items := ${baseItemsExpression}`
    : `let $query := ${itemsQueryExpression}
  let $items := cts:search(${baseItemsExpression}, $query)`;

  const xquery = `${xqueryDeclarations.join("\n\n")}

<ochre>{
${itemsClause}
${queryBlocks.join("\n\n")}

return (${returnedSequences.join(", ")})
}</ochre>`;

  return xquery;
}

/**
 * Fetches and parses Set property values from the OCHRE API
 *
 * @param params - The parameters for the fetch
 * @param params.setScopeUuids - An array of set scope UUIDs to filter by
 * @param params.queries - Recursive query tree used to filter matching items
 * @param params.attributes - Whether to return values for bibliographies and periods
 * @param params.attributes.bibliographies - Whether to return values for bibliographies
 * @param params.attributes.periods - Whether to return values for periods
 * @param params.isLimitedToLeafPropertyValues - Whether to limit the property values to leaf property values
 * @param options - Options for the fetch
 * @param options.fetch - The fetch function to use
 * @returns Parsed Set property values and requested attribute values.
 * Returns empty arrays/objects when no matches are found, and null outputs on fetch/parse errors.
 */
export async function fetchSetPropertyValues(
  params: {
    setScopeUuids: Array<string>;
    queries?: Query | null;
    attributes?: { bibliographies: boolean; periods: boolean };
    isLimitedToLeafPropertyValues?: boolean;
  },
  options?: {
    fetch?: (
      input: string | URL | globalThis.Request,
      init?: RequestInit,
    ) => Promise<Response>;
  },
): Promise<
  | {
      propertyValues: Array<PropertyValueQueryItem>;
      propertyValuesByPropertyVariableUuid: Record<
        string,
        Array<PropertyValueQueryItem>
      >;
      attributeValues: {
        bibliographies: Array<SetAttributeValueQueryItem> | null;
        periods: Array<SetAttributeValueQueryItem> | null;
      };
      error: null;
    }
  | {
      propertyValues: null;
      propertyValuesByPropertyVariableUuid: null;
      attributeValues: null;
      error: string;
    }
> {
  try {
    const {
      setScopeUuids,
      belongsToCollectionScopeUuids,
      queries,
      attributes,
      isLimitedToLeafPropertyValues,
    } = v.parse(setPropertyValuesParamsSchema, params);
    const propertyVariableUuids = getPropertyVariableUuidsFromQueries(queries);

    if (
      propertyVariableUuids.length === 0 &&
      !attributes.bibliographies &&
      !attributes.periods
    ) {
      return {
        propertyValues: [],
        propertyValuesByPropertyVariableUuid: {},
        attributeValues: { bibliographies: null, periods: null },
        error: null,
      };
    }

    const xquery = buildXQuery({
      setScopeUuids,
      belongsToCollectionScopeUuids,
      queries,
      propertyVariableUuids,
      attributes,
      isLimitedToLeafPropertyValues,
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
      throw new Error(`OCHRE API responded with status: ${response.status}`);
    }

    const dataRaw = await response.text();
    const parser = new XMLParser(XML_PARSER_OPTIONS);
    const data = parser.parse(dataRaw) as unknown;

    const { success, issues, output } = v.safeParse(responseSchema, data);
    if (!success) {
      logIssues(issues);
      throw new Error("Failed to parse OCHRE Set property values");
    }

    const parsedPropertyValues: Array<ParsedPropertyValueItem> = [];
    const parsedAttributeValues: Array<ParsedAttributeValueItem> = [];

    if (output.result.ochre.propertyValue != null) {
      parsedPropertyValues.push(
        ...(Array.isArray(output.result.ochre.propertyValue) ?
          output.result.ochre.propertyValue
        : [output.result.ochre.propertyValue]),
      );
    }

    if (output.result.ochre.attributeValue != null) {
      parsedAttributeValues.push(
        ...(Array.isArray(output.result.ochre.attributeValue) ?
          output.result.ochre.attributeValue
        : [output.result.ochre.attributeValue]),
      );
    }

    const propertyValuesByPropertyVariableUuid: Record<
      string,
      Array<PropertyValueQueryItem>
    > = {};
    const flattenedPropertyValuesByKey = new Map<
      string,
      PropertyValueQueryItem
    >();

    for (const propertyValue of parsedPropertyValues) {
      if (propertyValue.content == null) {
        continue;
      }

      const propertyValueItem: PropertyValueQueryItem = {
        count: propertyValue.count,
        dataType: propertyValue.dataType,
        content: propertyValue.content,
        label: propertyValue.label,
      };

      const globalPropertyValueItem: PropertyValueQueryItem = {
        count: propertyValue.globalCount ?? propertyValue.count,
        dataType: propertyValue.dataType,
        content: propertyValue.content,
        label: propertyValue.label,
      };
      const globalPropertyValueKey = getPropertyValueKey({
        dataType: globalPropertyValueItem.dataType,
        content: propertyValue.content,
      });
      const existingGlobalPropertyValue = flattenedPropertyValuesByKey.get(
        globalPropertyValueKey,
      );

      if (existingGlobalPropertyValue == null) {
        flattenedPropertyValuesByKey.set(
          globalPropertyValueKey,
          globalPropertyValueItem,
        );
      } else if (
        existingGlobalPropertyValue.label == null &&
        globalPropertyValueItem.label != null
      ) {
        existingGlobalPropertyValue.label = globalPropertyValueItem.label;
      }

      if (propertyValue.scope === "global") {
        continue;
      }

      if (propertyValue.variableUuid != null) {
        const valuesByPropertyVariableUuid =
          (propertyValuesByPropertyVariableUuid[propertyValue.variableUuid] ??=
            []);
        valuesByPropertyVariableUuid.push(propertyValueItem);
      }
    }

    for (const [propertyVariableUuid, values] of Object.entries(
      propertyValuesByPropertyVariableUuid,
    )) {
      propertyValuesByPropertyVariableUuid[propertyVariableUuid] =
        sortPropertyValues(values);
    }

    const attributeValuesByType: Record<
      "bibliographies" | "periods",
      Array<SetAttributeValueQueryItem>
    > = { bibliographies: [], periods: [] };

    for (const attributeValue of parsedAttributeValues) {
      if (attributeValue.content == null || attributeValue.content === "") {
        continue;
      }

      attributeValuesByType[attributeValue.attributeType].push({
        count: attributeValue.count,
        content: attributeValue.content,
      });
    }

    return {
      propertyValues: sortPropertyValues([
        ...flattenedPropertyValuesByKey.values(),
      ]),
      propertyValuesByPropertyVariableUuid,
      attributeValues: {
        bibliographies:
          attributes.bibliographies ?
            sortAttributeValues(attributeValuesByType.bibliographies)
          : null,
        periods:
          attributes.periods ?
            sortAttributeValues(attributeValuesByType.periods)
          : null,
      },
      error: null,
    };
  } catch (error) {
    console.error(error);
    return {
      propertyValues: null,
      propertyValuesByPropertyVariableUuid: null,
      attributeValues: null,
      error:
        error instanceof Error ?
          error.message
        : "Failed to fetch property values",
    };
  }
}
