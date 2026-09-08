/* eslint-disable unicorn/prefer-https */
/* eslint-disable unicorn/no-incorrect-template-string-interpolation */
import * as v from "valibot";
import type { OchreRequestOptions } from "#/fetchers/request.js";
import type {
  PropertyRelation,
  PropertyValueQueryItem,
  Query,
  SetAttributeValueQueryItem,
} from "#/types/index.js";
import type { XMLContent } from "#/xml/types.js";
import { DEFAULT_LANGUAGES } from "#/constants.js";
import { getErrorOutput } from "#/errors.js";
import { requestOchre } from "#/fetchers/request.js";
import { MultilingualString } from "#/parsers/multilingual.js";
import { parseXMLContent } from "#/parsers/string.js";
import {
  compileSetItemsQuery,
  getItemFilterQueries,
  getPropertyFacetSelectors,
} from "#/query.js";
import { setPropertyValuesParametersSchema } from "#/schemas.js";
import { stringLiteral } from "#/xquery.js";

type ParsedPropertyValueItem = PropertyValueQueryItem & {
  scope: "global" | "variable";
  variableUuid: string | null;
  globalCount: number | null;
};

type ParsedAttributeValueItem = Omit<SetAttributeValueQueryItem, "content"> & {
  attributeType: "bibliographies" | "periods";
  content: SetAttributeValueQueryItem["content"] | null;
};

type ParsedPropertyValueLabelContent = XMLContent["content"];

type PropertyFacetSelector = {
  uuid: string;
  relation: PropertyRelation | null;
};

function getLabelContentLanguages(
  content: ParsedPropertyValueLabelContent,
): Array<string> {
  const languages: Array<string> = [];
  for (const contentItem of content) {
    if (contentItem.lang !== "zxx" && !languages.includes(contentItem.lang)) {
      languages.push(contentItem.lang);
    }
  }

  return languages.length > 0 ? languages : [...DEFAULT_LANGUAGES];
}

function parsePropertyValueLabelText(
  text: string | null | undefined,
): string | null {
  if (text === "" || text == null) {
    return null;
  }

  return text === "<unassigned>" ? null : text;
}

function parsePropertyValueLabel(
  content: ParsedPropertyValueLabelContent | undefined,
  text: string | null | undefined,
): MultilingualString | null {
  if (content != null && content.length > 0) {
    return parseXMLContent(
      { content },
      { languages: getLabelContentLanguages(content) },
    );
  }

  const parsedText = parsePropertyValueLabelText(text);
  if (parsedText == null) {
    return null;
  }

  return MultilingualString.fromObject({ [DEFAULT_LANGUAGES[0]]: parsedText });
}

/**
 * The prefix OCHRE puts on every `dataType` attribute
 *
 * Kept as a constant because the facet XQuery has to strip the same prefix
 * server-side: it compares `@dataType` against the unprefixed names, so a
 * prefixed value falls through every typed branch.
 */
const XML_SCHEMA_TYPE_PREFIX = "xs:";

function normalizePropertyValueDataType(
  dataType: string,
): PropertyValueQueryItem["dataType"] {
  const normalizedDataType = dataType.startsWith(XML_SCHEMA_TYPE_PREFIX)
    ? dataType.slice(XML_SCHEMA_TYPE_PREFIX.length)
    : dataType;

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

    const label = a.label?.getText() ?? null;
    const otherLabel = b.label?.getText() ?? null;
    if (label !== otherLabel) {
      return label?.localeCompare(otherLabel ?? "") ?? 0;
    }

    return (
      a.content?.toString().localeCompare(b.content?.toString() ?? "") ?? 0
    );
  });
}

function getPropertyValueKey(value: {
  dataType: PropertyValueQueryItem["dataType"];
  content: NonNullable<PropertyValueQueryItem["content"]>;
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
  v.transform((value) => {
    if (value === "") {
      return 1;
    }

    const count = Number(value);

    return Number.isFinite(count) ? count : 1;
  }),
);

const propertyValueLabelStringSchema = v.object({
  payload: v.optional(v.string(), ""),
});

const propertyValueLabelContentSchema = v.object({
  lang: v.string(),
  string: v.array(propertyValueLabelStringSchema),
});

/**
 * Give the canonical value the type its `dataType` implies
 *
 * Which value a facet stands for is decided once, server-side, by
 * `local:value-content`, and travels back as `canonicalValue`. This only gives
 * that string a TypeScript type: re-deriving it here from `rawValue`, `uuid`
 * and the label is what let the facet key and the facet content disagree.
 */
function typePropertyValueContent(
  dataType: PropertyValueQueryItem["dataType"],
  canonicalValue: string | undefined,
): PropertyValueQueryItem["content"] {
  if (canonicalValue == null || canonicalValue === "") {
    return null;
  }

  switch (dataType) {
    case "integer":
    case "decimal":
    case "time": {
      const numericContent = Number(canonicalValue);

      return Number.isNaN(numericContent) ? null : numericContent;
    }
    case "boolean": {
      return canonicalValue === "true";
    }
    default: {
      return canonicalValue;
    }
  }
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
    canonicalValue: v.optional(v.string()),
    rawValue: v.optional(v.string()),
    payload: v.optional(v.string()),
    content: v.optional(v.array(propertyValueLabelContentSchema)),
  }),
  v.transform((value): ParsedPropertyValueItem => {
    const dataType = normalizePropertyValueDataType(value.dataType);

    return {
      uuid: value.uuid !== "" ? value.uuid : null,
      scope: value.scope,
      variableUuid:
        value.variableUuid != null && value.variableUuid !== ""
          ? value.variableUuid
          : null,
      count: value.count,
      globalCount: value.globalCount ?? null,
      dataType,
      content: typePropertyValueContent(dataType, value.canonicalValue),
      label: parsePropertyValueLabel(value.content, value.payload),
    };
  }),
);

const attributeValueQueryItemSchema = v.pipe(
  v.object({
    attributeType: v.picklist(["bibliographies", "periods"]),
    count: countSchema,
    content: v.optional(v.string()),
    payload: v.optional(v.string()),
  }),
  v.transform((value): ParsedAttributeValueItem => ({
    attributeType: value.attributeType,
    count: value.count,
    content:
      value.content != null && value.content !== ""
        ? value.content
        : value.payload != null && value.payload !== ""
          ? value.payload
          : null,
  })),
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
 * @param parameters - The parameters for the fetch
 * @param parameters.setScopeUuids - An array of set scope UUIDs to filter by
 * @param parameters.belongsToCollectionScopeUuids - An array of collection scope UUIDs to filter by
 * @param parameters.queries - Recursive query tree used to filter matching items
 * @param parameters.propertyFacetSelectors - Property variable/relation selectors to aggregate, if any
 * @param parameters.attributes - Whether to return values for bibliographies and periods
 * @param parameters.attributes.bibliographies - Whether to return values for bibliographies
 * @param parameters.attributes.periods - Whether to return values for periods
 * @param parameters.isLimitedToLeafPropertyValues - Whether to limit the property values to leaf property values
 * @returns An XQuery string
 */
function buildXQuery(parameters: {
  setScopeUuids: Array<string>;
  belongsToCollectionScopeUuids: Array<string>;
  queries: Query | null;
  propertyFacetSelectors: Array<PropertyFacetSelector>;
  attributes: { bibliographies: boolean; periods: boolean };
  isLimitedToLeafPropertyValues: boolean;
}): string {
  const {
    setScopeUuids,
    belongsToCollectionScopeUuids,
    queries,
    propertyFacetSelectors,
    attributes,
    isLimitedToLeafPropertyValues,
  } = parameters;

  const valueFilter = isLimitedToLeafPropertyValues ? "[not(@i)]" : "";
  const returnedSequences: Array<string> = [];
  const xqueryDeclarations = [
    'declare namespace map = "http://marklogic.com/xdmp/map";',
    `declare function local:increment-count($counts, $key) {
  let $current := map:get($counts, $key)
  return map:put(
    $counts,
    $key,
    if (empty($current)) then 1 else xs:integer($current) + 1
  )
};

declare function local:normalize-data-type($data-type) {
  if (starts-with($data-type, ${stringLiteral(XML_SCHEMA_TYPE_PREFIX)}))
  then substring($data-type, ${XML_SCHEMA_TYPE_PREFIX.length + 1})
  else $data-type
};

declare function local:value-display-text($v) {
  if ($v/content)
  then string-join($v/content[@xml:lang="eng"]//text(), "")
  else string($v)
};

declare function local:value-label-content($v) {
  if ($v/content) then
    for $content in $v/content
    let $lang := string($content/@xml:lang)
    return <content lang="{$lang}"><string>{string-join($content//text(), "")}</string></content>
  else ()
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
  $canonical-value,
  $display,
  $label-content
) {
  let $existing := map:get($details, $key)
  return
    if (
      empty($existing)
      or (not($existing/content) and exists($label-content))
      or (
        not($existing/content)
        and string-length(string($existing)) = 0
        and string-length($display) gt 0
      )
    ) then
      map:put(
        $details,
        $key,
        <propertyValue scope="{$scope}" variableUuid="{$variable-uuid}" uuid="{$value-uuid}" rawValue="{$raw-value}" dataType="{$data-type}" canonicalValue="{$canonical-value}">{
          if (exists($label-content)) then $label-content else $display
        }</propertyValue>
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
  $canonical-value,
  $display,
  $label-content
) {
  if (exists(map:get($seen, $key))) then ()
  else (
    map:put($seen, $key, true()),
    local:increment-count($counts, $key),
    local:put-property-detail($details, $key, $scope, $variable-uuid, $value-uuid, $raw-value, $data-type, $canonical-value, $display, $label-content)
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

  function buildQueryBlocks(context: {
    items: string;
    notSupplemental: string;
  }): Array<string> {
    const { items, notSupplemental } = context;
    const queryBlocks: Array<string> = [];

    if (propertyFacetSelectors.length > 0) {
      const facetPropertyPredicates: Array<string> = [];
      for (const selector of propertyFacetSelectors) {
        const uuidPredicate = `label/@uuid = ${stringLiteral(selector.uuid)}`;
        facetPropertyPredicates.push(
          selector.relation == null
            ? uuidPredicate
            : `(${uuidPredicate} and label/@relation = ${stringLiteral(selector.relation)})`,
        );
      }
      const facetPropertyPredicate =
        facetPropertyPredicates.length === 1
          ? (facetPropertyPredicates[0] ?? "false()")
          : `(${facetPropertyPredicates.join(" or ")})`;

      queryBlocks.push(`let $global-property-counts := map:map()
let $variable-property-counts := map:map()
let $variable-property-details := map:map()
let $variable-property-global-keys := map:map()
let $_property-aggregation := xdmp:eager(
  for $item in ${items}
  let $global-seen := map:map()
  let $variable-seen := map:map()
  return
    for $p in $item/properties/property[${facetPropertyPredicate}]${notSupplemental}
    let $variable-uuid := string($p/label/@uuid)
    for $v in $p/value${valueFilter}${notSupplemental}
    let $value-uuid := string($v/@uuid)
    let $raw-value := string($v/@rawValue)
    let $data-type := local:normalize-data-type(string($v/@dataType))
    let $display := local:value-display-text($v)
    let $label-content := local:value-label-content($v)
    let $content := local:value-content($data-type, $raw-value, $value-uuid, $display)
    let $value-kind := local:value-kind($data-type)
    let $output-raw-value := local:property-output-raw-value($data-type, $raw-value, $content)
    let $global-key := string-join(($data-type, $value-kind, $content), "||")
    let $variable-key := string-join(($variable-uuid, $data-type, $value-kind, $content), "||")
    where $content != ""
    return (
      local:add-attribute-facet($global-property-counts, $global-seen, $global-key),
      local:add-property-facet($variable-property-counts, $variable-property-details, $variable-seen, $variable-key, "variable", $variable-uuid, $value-uuid, $output-raw-value, $data-type, $content, $display, $label-content),
      map:put($variable-property-global-keys, $variable-key, $global-key)
    )
)

let $property-values :=
  (
    $_property-aggregation,
    for $key in map:keys($variable-property-counts)
    let $detail := map:get($variable-property-details, $key)
    let $global-key := map:get($variable-property-global-keys, $key)
    return <propertyValue scope="variable" variableUuid="{string($detail/@variableUuid)}" uuid="{string($detail/@uuid)}" rawValue="{string($detail/@rawValue)}" dataType="{string($detail/@dataType)}" canonicalValue="{string($detail/@canonicalValue)}" count="{map:get($variable-property-counts, $key)}" globalCount="{map:get($global-property-counts, $global-key)}">{
      $detail/node()
    }</propertyValue>
  )`);
      returnedSequences.push("$property-values");
    }

    if (attributes.bibliographies) {
      queryBlocks.push(`let $bibliography-counts := map:map()
let $_bibliography-aggregation := xdmp:eager(
  for $item in ${items}
  let $seen := map:map()
  return
    for $bibliography in $item/bibliographies/bibliography${notSupplemental}
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
  for $item in ${items}
  let $seen := map:map()
  return
    for $period in $item/periods/period${notSupplemental}
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

    return queryBlocks;
  }

  const xquery = compileSetItemsQuery({
    setScopeUuids,
    belongsToCollectionScopeUuids,
    queries: getItemFilterQueries(queries),
    declarations: xqueryDeclarations,
    body: (context) => {
      const blocks = buildQueryBlocks(context);

      return `${blocks.join("\n\n")}

return (${returnedSequences.join(", ")})`;
    },
  });

  return xquery;
}

function collectPropertyValues(
  parsedPropertyValues: ReadonlyArray<ParsedPropertyValueItem>,
): {
  propertyValuesByPropertyVariableUuid: Record<
    string,
    Array<PropertyValueQueryItem>
  >;
  flattenedPropertyValues: Array<PropertyValueQueryItem>;
} {
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
      uuid: propertyValue.uuid,
      count: propertyValue.count,
      dataType: propertyValue.dataType,
      content: propertyValue.content,
      label: propertyValue.label,
    };

    const globalPropertyValueItem: PropertyValueQueryItem = {
      uuid: propertyValue.uuid,
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

  return {
    propertyValuesByPropertyVariableUuid,
    flattenedPropertyValues: sortPropertyValues(
      flattenedPropertyValuesByKey.values().toArray(),
    ),
  };
}

function collectAttributeValues(
  parsedAttributeValues: ReadonlyArray<ParsedAttributeValueItem>,
): Record<"bibliographies" | "periods", Array<SetAttributeValueQueryItem>> {
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

  return attributeValuesByType;
}

/**
 * Fetches and parses Set property values from the OCHRE API
 *
 * @param parameters - The parameters for the fetch
 * @param parameters.setScopeUuids - An array of set scope UUIDs to filter by
 * @param parameters.queries - Recursive query tree used to filter matching items
 * @param parameters.attributes - Whether to return values for bibliographies and periods
 * @param parameters.attributes.bibliographies - Whether to return values for bibliographies
 * @param parameters.attributes.periods - Whether to return values for periods
 * @param parameters.isLimitedToLeafPropertyValues - Whether to limit the property values to leaf property values
 * @param options - Options for the fetch
 * @param options.fetch - The fetch function to use
 * @returns Parsed Set property values and requested attribute values.
 * Returns empty arrays/objects when no matches are found, and null outputs on fetch/parse errors.
 */
export async function fetchSetPropertyValues(
  parameters: {
    setScopeUuids: Array<string>;
    queries?: Query | null;
    attributes?: { bibliographies: boolean; periods: boolean };
    isLimitedToLeafPropertyValues?: boolean;
  },
  options?: OchreRequestOptions,
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
      detailedError: null;
    }
  | {
      propertyValues: null;
      propertyValuesByPropertyVariableUuid: null;
      attributeValues: null;
      error: string;
      detailedError: string;
    }
> {
  try {
    const {
      setScopeUuids,
      belongsToCollectionScopeUuids,
      queries,
      attributes,
      isLimitedToLeafPropertyValues,
    } = v.parse(setPropertyValuesParametersSchema, parameters);
    const propertyFacetSelectors = getPropertyFacetSelectors(queries);

    if (
      propertyFacetSelectors.length === 0 &&
      !attributes.bibliographies &&
      !attributes.periods
    ) {
      return {
        propertyValues: [],
        propertyValuesByPropertyVariableUuid: {},
        attributeValues: { bibliographies: null, periods: null },
        error: null,
        detailedError: null,
      };
    }

    const xquery = buildXQuery({
      setScopeUuids,
      belongsToCollectionScopeUuids,
      queries,
      propertyFacetSelectors,
      attributes,
      isLimitedToLeafPropertyValues,
    });

    const output = await requestOchre({
      xquery,
      schema: responseSchema,
      label: "OCHRE Set property values",
      options,
    });

    const parsedPropertyValues: Array<ParsedPropertyValueItem> = [
      output.result.ochre.propertyValue ?? [],
    ].flat();
    const parsedAttributeValues: Array<ParsedAttributeValueItem> = [
      output.result.ochre.attributeValue ?? [],
    ].flat();

    const { propertyValuesByPropertyVariableUuid, flattenedPropertyValues } =
      collectPropertyValues(parsedPropertyValues);
    const attributeValuesByType = collectAttributeValues(parsedAttributeValues);

    return {
      propertyValues: flattenedPropertyValues,
      propertyValuesByPropertyVariableUuid,
      attributeValues: {
        bibliographies: attributes.bibliographies
          ? sortAttributeValues(attributeValuesByType.bibliographies)
          : null,
        periods: attributes.periods
          ? sortAttributeValues(attributeValuesByType.periods)
          : null,
      },
      error: null,
      detailedError: null,
    };
  } catch (error) {
    return {
      propertyValues: null,
      propertyValuesByPropertyVariableUuid: null,
      attributeValues: null,
      ...getErrorOutput(error, "Failed to fetch property values"),
    };
  }
}
