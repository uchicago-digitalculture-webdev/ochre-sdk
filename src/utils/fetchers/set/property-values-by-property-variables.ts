import * as z from "zod";
import type {
  ApiVersion,
  PropertyValueContentType,
  PropertyValueQueryItem,
} from "../../../types/index.js";
import { BELONGS_TO_COLLECTION_UUID } from "../../../constants.js";
import {
  richTextStringSchema,
  setPropertyValuesByPropertyVariablesParamsSchema,
} from "../../../schemas.js";
import { DEFAULT_API_VERSION } from "../../helpers.js";
import { parseFakeString, parseStringContent } from "../../string.js";

/**
 * Schema for a single property value query item in the OCHRE API response
 */
const propertyValueQueryItemSchema = z
  .object({
    uuid: z.string(),
    itemUuid: z.string().optional(),
    dataType: z.string(),
    rawValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
    content: z
      .union([
        z.string(),
        z.number(),
        z.boolean(),
        richTextStringSchema,
        z.array(richTextStringSchema),
      ])
      .optional(),
  })
  .transform((val) => {
    const returnValue: {
      itemUuid: string | null;
      dataType: Exclude<PropertyValueContentType, "coordinate">;
      content: string | number | boolean | null;
      label: string | null;
    } = {
      itemUuid:
        val.itemUuid != null && val.itemUuid !== "" ? val.itemUuid : null,
      dataType: val.dataType as Exclude<PropertyValueContentType, "coordinate">,
      content: null,
      label: null,
    };

    switch (val.dataType) {
      case "IDREF": {
        returnValue.content = val.uuid !== "" ? val.uuid : null;
        returnValue.label =
          val.content != null && val.content !== "" ?
            typeof val.content === "object" ?
              parseStringContent({ content: val.content })
            : parseFakeString(val.content)
          : null;
        break;
      }
      case "integer":
      case "decimal":
      case "time": {
        returnValue.content =
          val.rawValue != null && val.rawValue !== "" ?
            Number(val.rawValue)
          : null;
        returnValue.label =
          val.content != null && val.content !== "" ?
            val.content.toString()
          : null;
        break;
      }
      case "boolean": {
        returnValue.content =
          val.rawValue != null && val.rawValue !== "" ?
            Boolean(val.rawValue)
          : null;
        returnValue.label =
          val.content != null && val.content !== "" ?
            val.content.toString()
          : null;
        break;
      }
      default: {
        returnValue.content =
          val.rawValue != null && val.rawValue !== "" ?
            val.rawValue.toString()
          : null;
        returnValue.label =
          val.content != null && val.content !== "" ?
            val.content.toString()
          : null;
        break;
      }
    }

    return returnValue;
  });

/**
 * Schema for the property values by property variables OCHRE API response
 */
const responseSchema = z.object({
  result: z.union([
    z.object({
      ochre: z.object({
        propertyValue: z.union([
          propertyValueQueryItemSchema,
          z.array(propertyValueQueryItemSchema),
        ]),
      }),
    }),
    z.array(z.unknown()).length(0),
  ]),
});

/**
 * Build an XQuery string to fetch property values by property variables from the OCHRE API
 * @param params - The parameters for the fetch
 * @param params.setScopeUuids - An array of set scope UUIDs to filter by
 * @param params.belongsToCollectionScopeUuids - An array of collection scope UUIDs to filter by
 * @param params.propertyVariableUuids - An array of property variable UUIDs to fetch
 * @param options - Options for the fetch
 * @param options.version - The version of the OCHRE API to use
 * @returns An XQuery string
 */
function buildXQuery(
  params: {
    setScopeUuids: Array<string>;
    belongsToCollectionScopeUuids: Array<string>;
    propertyVariableUuids: Array<string>;
  },
  options?: { version: ApiVersion },
): string {
  const version = options?.version ?? DEFAULT_API_VERSION;

  const {
    setScopeUuids,
    belongsToCollectionScopeUuids,
    propertyVariableUuids,
  } = params;

  let setScopeFilter = "";

  if (setScopeUuids.length > 0) {
    const setScopeValues = setScopeUuids
      .map((uuid) => `@uuid="${uuid}"`)
      .join(" or ");
    setScopeFilter = `/set[(${setScopeValues})]/items`;
  }
  let collectionScopeFilter = "";

  if (belongsToCollectionScopeUuids.length > 0) {
    const belongsToCollectionScopeValues = belongsToCollectionScopeUuids
      .map((uuid) => `@uuid="${uuid}"`)
      .join(" or ");

    collectionScopeFilter = `//properties[property[label/@uuid="${BELONGS_TO_COLLECTION_UUID}" and value/(${belongsToCollectionScopeValues})]]`;
  }

  const propertyVariableFilters = propertyVariableUuids
    .map((uuid) => `@uuid="${uuid}"`)
    .join(" or ");

  const xquery = `let $matching-props := ${version === 2 ? "doc()" : "input()"}/ochre
      ${setScopeFilter}
      ${collectionScopeFilter}
      //property[label/(${propertyVariableFilters})]

  for $v in $matching-props/value
    let $item-uuid := $v/ancestor::*[parent::items]/@uuid
    return <propertyValue uuid="{$v/@uuid}" rawValue="{$v/@rawValue}" dataType="{$v/@dataType}" itemUuid="{$item-uuid}">{
      if ($v/content) then $v/content else $v/text()
    }</propertyValue>`;

  return `<ochre>{${xquery}}</ochre>`;
}

/**
 * Fetches and parses Set property values by property variables from the OCHRE API
 *
 * @param params - The parameters for the fetch
 * @param params.setScopeUuids - An array of set scope UUIDs to filter by
 * @param params.belongsToCollectionScopeUuids - The collection scope UUIDs to filter by
 * @param params.propertyVariableUuids - The property variable UUIDs to query by
 * @param options - Options for the fetch
 * @param options.fetch - The fetch function to use
 * @param options.version - The version of the OCHRE API to use
 * @returns The parsed Set property values by property variables or null if the fetch/parse fails
 */
export async function fetchSetPropertyValuesByPropertyVariables(
  params: {
    setScopeUuids: Array<string>;
    belongsToCollectionScopeUuids: Array<string>;
    propertyVariableUuids: Array<string>;
  },
  options?: {
    fetch?: (
      input: string | URL | globalThis.Request,
      init?: RequestInit,
    ) => Promise<Response>;
    version?: ApiVersion;
  },
): Promise<
  | { propertyValues: Array<PropertyValueQueryItem> | null; error: null }
  | { propertyValues: null; error: string }
> {
  try {
    const version = options?.version ?? DEFAULT_API_VERSION;

    const {
      setScopeUuids,
      belongsToCollectionScopeUuids,
      propertyVariableUuids,
    } = setPropertyValuesByPropertyVariablesParamsSchema.parse(params);

    const xquery = buildXQuery(
      { setScopeUuids, belongsToCollectionScopeUuids, propertyVariableUuids },
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

    const data = await response.json();

    const parsedResultRaw = responseSchema.parse(data);
    if (Array.isArray(parsedResultRaw.result)) {
      throw new TypeError("No property values found");
    }

    const parsedPropertyValues =
      Array.isArray(parsedResultRaw.result.ochre.propertyValue) ?
        parsedResultRaw.result.ochre.propertyValue
      : [parsedResultRaw.result.ochre.propertyValue];

    const groupedPropertyValuesMap = new Map<
      string | number | boolean | null,
      {
        dataType: Exclude<PropertyValueContentType, "coordinate">;
        content: string | number | boolean | null;
        label: string | null;
        itemUuids: Set<string | null>;
      }
    >();

    for (const propertyValue of parsedPropertyValues) {
      const existing = groupedPropertyValuesMap.get(propertyValue.content);
      if (existing == null) {
        groupedPropertyValuesMap.set(propertyValue.content, {
          dataType: propertyValue.dataType,
          content: propertyValue.content,
          label: propertyValue.label,
          itemUuids: new Set([propertyValue.itemUuid]),
        });
      } else {
        existing.itemUuids.add(propertyValue.itemUuid);
      }
    }

    const groupedPropertyValues: Array<PropertyValueQueryItem> = [];
    for (const group of groupedPropertyValuesMap.values()) {
      groupedPropertyValues.push({
        count: group.itemUuids.size,
        dataType: group.dataType,
        content: group.content,
        label: group.label,
      });
    }

    return {
      propertyValues: groupedPropertyValues
        .filter((propertyValue) => propertyValue.content !== null)
        .toSorted((a, b) => {
          if (a.count !== b.count) {
            return b.count - a.count;
          }

          if (a.label !== b.label) {
            return a.label?.localeCompare(b.label ?? "") ?? 0;
          }

          return (
            a.content?.toString().localeCompare(b.content?.toString() ?? "") ??
            0
          );
        }),
      error: null,
    };
  } catch (error) {
    console.error(error);
    return {
      propertyValues: null,
      error:
        error instanceof Error ?
          error.message
        : "Failed to fetch property values by property variables",
    };
  }
}
