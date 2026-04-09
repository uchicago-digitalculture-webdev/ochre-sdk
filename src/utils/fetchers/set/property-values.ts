import * as z from "zod";
import type {
  ApiVersion,
  PropertyValueContentType,
  PropertyValueQueryItem,
  Query,
  SetAttributeValueQueryItem,
} from "#/types/index.js";
import type { RawFakeString, RawStringItem } from "#/types/raw.js";
import { BELONGS_TO_COLLECTION_UUID } from "#/constants.js";
import {
  fakeStringSchema,
  richTextStringSchema,
  setPropertyValuesParamsSchema,
} from "#/schemas.js";
import {
  buildAndCtsQueryExpression,
  buildBelongsToCollectionQueryExpression,
  buildQueryPlan,
} from "#/utils/query.js";
import { parseFakeString, parseStringContent } from "#/utils/string.js";

type ParsedPropertyValueItem = {
  variableUuid: string | null;
  itemUuid: string | null;
  dataType: Exclude<PropertyValueContentType, "coordinate">;
  content: string | number | boolean | null;
  label: string | null;
};

type AggregatePropertyValueItem = Omit<ParsedPropertyValueItem, "variableUuid">;

type ParsedAttributeValueItem = {
  attributeType: "bibliographies" | "periods";
  itemUuid: string | null;
  content: string | null;
};

function parsePropertyValueLabel(
  content: RawFakeString | RawStringItem | Array<RawStringItem> | undefined,
): string | null {
  if (content == null || content === "") {
    return null;
  }

  if (typeof content === "object") {
    return parseStringContent({ content });
  }

  return parseFakeString(content);
}

function parsePropertyValueBooleanContent(
  rawValue: RawFakeString | undefined,
): boolean | null {
  if (rawValue == null || rawValue === "") {
    return null;
  }

  if (typeof rawValue === "boolean") {
    return rawValue;
  }

  return rawValue.toString().toLocaleLowerCase("en-US") === "true";
}

function getPropertyValueGroupKey(value: AggregatePropertyValueItem): string {
  const contentKey =
    value.content == null ?
      "null"
    : `${typeof value.content}:${value.content.toLocaleString("en-US")}`;

  return `${value.dataType}|${contentKey}`;
}

function aggregatePropertyValues(
  values: Array<AggregatePropertyValueItem>,
): Array<PropertyValueQueryItem> {
  const groupedPropertyValuesMap = new Map<
    string,
    {
      dataType: Exclude<PropertyValueContentType, "coordinate">;
      content: string | number | boolean | null;
      label: string | null;
      itemUuids: Set<string | null>;
    }
  >();

  for (const value of values) {
    const key = getPropertyValueGroupKey(value);
    const existing = groupedPropertyValuesMap.get(key);

    if (existing == null) {
      groupedPropertyValuesMap.set(key, {
        dataType: value.dataType,
        content: value.content,
        label: value.label,
        itemUuids: new Set([value.itemUuid]),
      });
      continue;
    }

    existing.itemUuids.add(value.itemUuid);
    if (existing.label == null && value.label != null) {
      existing.label = value.label;
    }
  }

  const groupedPropertyValues: Array<PropertyValueQueryItem> = [];
  for (const group of groupedPropertyValuesMap.values()) {
    if (group.content == null) {
      continue;
    }

    groupedPropertyValues.push({
      count: group.itemUuids.size,
      dataType: group.dataType,
      content: group.content,
      label: group.label,
    });
  }

  return groupedPropertyValues.toSorted((a, b) => {
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

function aggregateAttributeValues(
  values: Array<ParsedAttributeValueItem>,
): Array<SetAttributeValueQueryItem> {
  const groupedAttributeValuesMap = new Map<
    string,
    { content: string; itemUuids: Set<string | null> }
  >();

  for (const value of values) {
    if (value.content == null || value.content === "") {
      continue;
    }

    const existing = groupedAttributeValuesMap.get(value.content);

    if (existing == null) {
      groupedAttributeValuesMap.set(value.content, {
        content: value.content,
        itemUuids: new Set([value.itemUuid]),
      });
      continue;
    }

    existing.itemUuids.add(value.itemUuid);
  }

  const groupedAttributeValues: Array<SetAttributeValueQueryItem> = [];
  for (const group of groupedAttributeValuesMap.values()) {
    groupedAttributeValues.push({
      count: group.itemUuids.size,
      content: group.content,
    });
  }

  return groupedAttributeValues.toSorted((a, b) => {
    if (a.count !== b.count) {
      return b.count - a.count;
    }

    return a.content.localeCompare(b.content);
  });
}

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
const propertyValueQueryItemSchema = z
  .object({
    uuid: z.string(),
    variableUuid: z.string().optional(),
    itemUuid: z.string().optional(),
    dataType: z.string(),
    rawValue: fakeStringSchema.optional(),
    content: z
      .union([
        fakeStringSchema,
        richTextStringSchema,
        z.array(richTextStringSchema),
      ])
      .optional(),
  })
  .transform((val): ParsedPropertyValueItem => {
    const returnValue: ParsedPropertyValueItem = {
      variableUuid:
        val.variableUuid != null && val.variableUuid !== "" ?
          val.variableUuid
        : null,
      itemUuid:
        val.itemUuid != null && val.itemUuid !== "" ? val.itemUuid : null,
      dataType: val.dataType as Exclude<PropertyValueContentType, "coordinate">,
      content: null,
      label: null,
    };

    switch (val.dataType) {
      case "IDREF": {
        returnValue.content = val.uuid !== "" ? val.uuid : null;
        returnValue.label = parsePropertyValueLabel(val.content);
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

        returnValue.label = parsePropertyValueLabel(val.content);
        break;
      }
      case "boolean": {
        returnValue.content = parsePropertyValueBooleanContent(val.rawValue);
        returnValue.label = parsePropertyValueLabel(val.content);
        break;
      }
      default: {
        returnValue.content =
          val.rawValue != null && val.rawValue !== "" ? val.rawValue.toString()
          : val.content != null && val.content !== "<unassigned>" ?
            parseStringContent({ content: val.content })
          : null;
        returnValue.label = parsePropertyValueLabel(val.content);
        break;
      }
    }

    return returnValue;
  });

const attributeValueQueryItemSchema = z
  .object({
    attributeType: z.enum(["bibliographies", "periods"]),
    itemUuid: z.string().optional(),
    content: z.string().optional(),
  })
  .transform(
    (val): ParsedAttributeValueItem => ({
      attributeType: val.attributeType,
      itemUuid:
        val.itemUuid != null && val.itemUuid !== "" ? val.itemUuid : null,
      content: val.content != null && val.content !== "" ? val.content : null,
    }),
  );

/**
 * Schema for the property values OCHRE API response
 */
const responseSchema = z.object({
  result: z.union([
    z.object({
      ochre: z.object({
        propertyValue: z
          .union([
            propertyValueQueryItemSchema,
            z.array(propertyValueQueryItemSchema),
          ])
          .optional(),
        attributeValue: z
          .union([
            attributeValueQueryItemSchema,
            z.array(attributeValueQueryItemSchema),
          ])
          .optional(),
      }),
    }),
    z.array(z.unknown()).length(0),
  ]),
});

/**
 * Build an XQuery string to fetch property values from the OCHRE API
 * @param params - The parameters for the fetch
 * @param params.setScopeUuids - An array of set scope UUIDs to filter by
 * @param params.belongsToCollectionScopeUuids - An array of collection scope UUIDs to filter by
 * @param params.queries - Recursive query tree used to filter matching items
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
  attributes: { bibliographies: boolean; periods: boolean };
  isLimitedToLeafPropertyValues: boolean;
}): string {
  const {
    setScopeUuids,
    belongsToCollectionScopeUuids,
    queries,
    attributes,
    isLimitedToLeafPropertyValues,
  } = params;

  let setScopeFilter = "/set/items/*";

  if (setScopeUuids.length > 0) {
    const setScopeValues = setScopeUuids
      .map((uuid) => `@uuid="${uuid}"`)
      .join(" or ");
    setScopeFilter = `/set[(${setScopeValues})]/items/*`;
  }

  const propertyVariableFilters = getPropertyVariableUuidsFromQueries(queries)
    .map((uuid) => `@uuid="${uuid}"`)
    .join(" or ");
  const baseItemsExpression = `doc()/ochre${setScopeFilter}`;
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
  const queryBlocks: Array<string> = [
    `let $matching-props := $items//property[label[${propertyVariableFilters}]]

let $property-values :=
  for $p in $matching-props
  for $v in $p/value${valueFilter}
    let $item-uuid := $v/ancestor::*[parent::items]/@uuid
    let $variable-uuid := $p/label/@uuid
    return <propertyValue uuid="{$v/@uuid}" rawValue="{$v/@rawValue}" dataType="{$v/@dataType}" itemUuid="{$item-uuid}" variableUuid="{$variable-uuid}">{
      if ($v/content) then string-join($v/content[@xml:lang="eng"]//text(), "") else $v/text()
    }</propertyValue>`,
  ];
  const returnedSequences: Array<string> = ["$property-values"];

  if (attributes.bibliographies) {
    queryBlocks.push(`let $bibliography-values :=
  for $item in $items
  for $bibliography in $item/bibliographies/bibliography
    let $label := string-join($bibliography/identification/label/content[@xml:lang="eng"]//text(), "")
    where string-length($label) gt 0
    return <attributeValue attributeType="bibliographies" itemUuid="{$item/@uuid}" content="{$label}" />`);
    returnedSequences.push("$bibliography-values");
  }

  if (attributes.periods) {
    queryBlocks.push(`let $period-values :=
  for $item in $items
  for $period in $item/periods/period
    let $label := string-join($period/identification/label/content[@xml:lang="eng"]//text(), "")
    where string-length($label) gt 0
    return <attributeValue attributeType="periods" itemUuid="{$item/@uuid}" content="{$label}" />`);
    returnedSequences.push("$period-values");
  }

  const itemsClause =
    itemsQueryExpression == null ?
      `let $items := ${baseItemsExpression}`
    : `let $items := ${baseItemsExpression}[cts:contains(., ${itemsQueryExpression})]`;

  const xquery = `${itemsClause}

${queryBlocks.join("\n\n")}

return (${returnedSequences.join(", ")})`;

  return `<ochre>{${xquery}}</ochre>`;
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
 * @param options.version - The version of the OCHRE API to use
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
    version?: ApiVersion;
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
    if (options?.version != null && options.version !== 2) {
      throw new Error("Set property value queries only support API version 2");
    }

    const {
      setScopeUuids,
      belongsToCollectionScopeUuids,
      queries,
      attributes,
      isLimitedToLeafPropertyValues,
    } = setPropertyValuesParamsSchema.parse(params);

    const xquery = buildXQuery({
      setScopeUuids,
      belongsToCollectionScopeUuids,
      queries,
      attributes,
      isLimitedToLeafPropertyValues,
    });

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

    const data = await response.json();

    const parsedResultRaw = responseSchema.parse(data);
    const parsedPropertyValues: Array<ParsedPropertyValueItem> = [];
    const parsedAttributeValues: Array<ParsedAttributeValueItem> = [];

    if (!Array.isArray(parsedResultRaw.result)) {
      if (parsedResultRaw.result.ochre.propertyValue != null) {
        parsedPropertyValues.push(
          ...(Array.isArray(parsedResultRaw.result.ochre.propertyValue) ?
            parsedResultRaw.result.ochre.propertyValue
          : [parsedResultRaw.result.ochre.propertyValue]),
        );
      }

      if (parsedResultRaw.result.ochre.attributeValue != null) {
        parsedAttributeValues.push(
          ...(Array.isArray(parsedResultRaw.result.ochre.attributeValue) ?
            parsedResultRaw.result.ochre.attributeValue
          : [parsedResultRaw.result.ochre.attributeValue]),
        );
      }
    }

    const propertyValuesByPropertyVariableUuidRaw: Record<
      string,
      Array<AggregatePropertyValueItem>
    > = {};
    const flattenedPropertyValues: Array<AggregatePropertyValueItem> = [];

    for (const propertyValue of parsedPropertyValues) {
      const aggregatePropertyValueItem: AggregatePropertyValueItem = {
        itemUuid: propertyValue.itemUuid,
        dataType: propertyValue.dataType,
        content: propertyValue.content,
        label: propertyValue.label,
      };

      flattenedPropertyValues.push(aggregatePropertyValueItem);

      if (propertyValue.variableUuid == null) {
        continue;
      }

      const valuesByPropertyVariableUuid =
        (propertyValuesByPropertyVariableUuidRaw[propertyValue.variableUuid] ??=
          []);
      valuesByPropertyVariableUuid.push(aggregatePropertyValueItem);
    }

    const propertyValuesByPropertyVariableUuid: Record<
      string,
      Array<PropertyValueQueryItem>
    > = {};

    for (const [propertyVariableUuid, values] of Object.entries(
      propertyValuesByPropertyVariableUuidRaw,
    )) {
      const aggregatedValues = aggregatePropertyValues(values);

      if (aggregatedValues.length > 0) {
        propertyValuesByPropertyVariableUuid[propertyVariableUuid] =
          aggregatedValues;
      }
    }

    const attributeValuesByTypeRaw: Record<
      "bibliographies" | "periods",
      Array<ParsedAttributeValueItem>
    > = { bibliographies: [], periods: [] };

    for (const attributeValue of parsedAttributeValues) {
      attributeValuesByTypeRaw[attributeValue.attributeType].push(
        attributeValue,
      );
    }

    return {
      propertyValues: aggregatePropertyValues(flattenedPropertyValues),
      propertyValuesByPropertyVariableUuid,
      attributeValues: {
        bibliographies:
          attributes.bibliographies ?
            aggregateAttributeValues(attributeValuesByTypeRaw.bibliographies)
          : null,
        periods:
          attributes.periods ?
            aggregateAttributeValues(attributeValuesByTypeRaw.periods)
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
