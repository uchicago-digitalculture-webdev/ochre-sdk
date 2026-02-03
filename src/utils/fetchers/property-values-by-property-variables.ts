import * as z from "zod";
import type {
  ApiVersion,
  PropertyValueContentType,
  PropertyValueQueryItem,
} from "../../types/main.js";
import { BELONG_TO_COLLECTION_UUID } from "../../constants.js";
import { identificationSchema } from "../../schemas.js";
import { DEFAULT_API_VERSION } from "../helpers.js";
import { parseStringContent } from "../string.js";

/**
 * Schema for a single property value query item in the OCHRE API response
 */
const propertyValueQueryItemSchema = z
  .object({
    uuid: z.string().optional(),
    dataType: z.string(),
    identification: identificationSchema.optional(),
    rawValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
    value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  })
  .transform((val) => {
    const returnValue: {
      dataType: Exclude<PropertyValueContentType, "coordinate">;
      content: string | number | boolean | null;
      label: string | null;
    } = {
      dataType: val.dataType as Exclude<PropertyValueContentType, "coordinate">,
      content: null,
      label: null,
    };

    switch (val.dataType) {
      case "IDREF": {
        returnValue.content = val.uuid != null ? val.uuid || null : null;
        returnValue.label =
          val.identification != null ?
            parseStringContent({ content: val.identification.label.content })
          : null;
        break;
      }
      case "string":
      case "date":
      case "dateTime": {
        returnValue.content = val.rawValue?.toString() ?? null;
        returnValue.label = val.value?.toString() ?? null;
        break;
      }
      case "integer":
      case "decimal":
      case "time": {
        returnValue.content =
          val.rawValue != null ? Number(val.rawValue) : null;
        returnValue.label = val.value?.toString() ?? null;
        break;
      }
      case "boolean": {
        returnValue.content =
          val.rawValue != null ? Boolean(val.rawValue) : null;
        returnValue.label = val.value?.toString() ?? null;
        break;
      }
      default: {
        returnValue.content = val.rawValue?.toString() ?? null;
        returnValue.label = val.value?.toString() ?? null;
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
        item: z.union([
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
 * @param params.projectScopeUuid - The UUID of the project scope
 * @param params.belongsToCollectionScopeUuids - An array of collection scope UUIDs to filter by
 * @param params.propertyVariableUuids - An array of property variable UUIDs to fetch
 * @param options - Options for the fetch
 * @param options.version - The version of the OCHRE API to use
 * @returns An XQuery string
 */
function buildXQuery(
  params: {
    projectScopeUuid: string;
    belongsToCollectionScopeUuids: Array<string>;
    propertyVariableUuids: Array<string>;
  },
  options?: { version: ApiVersion },
): string {
  const version = options?.version ?? DEFAULT_API_VERSION;

  const {
    projectScopeUuid,
    belongsToCollectionScopeUuids,
    propertyVariableUuids,
  } = params;

  let collectionScopeFilter = "";

  if (belongsToCollectionScopeUuids.length > 0) {
    const belongsToCollectionScopeValues = belongsToCollectionScopeUuids
      .map((uuid) => `@uuid="${uuid}"`)
      .join(" or ");

    collectionScopeFilter = `[properties/property[label/@uuid="${BELONG_TO_COLLECTION_UUID}"][value[${belongsToCollectionScopeValues}]]]`;
  }

  const propertyVariableFilters = propertyVariableUuids
    .map((uuid) => `@uuid="${uuid}"`)
    .join(" or ");

  const xquery = `let $values := ${version === 2 ? "doc()" : "input()"}/ochre[@uuidBelongsTo="${projectScopeUuid}"]
      /*${collectionScopeFilter}
      /properties//property[label[${propertyVariableFilters}]]
      /value

  for $v in $values
  return <item uuid="{$v/@uuid}" rawValue="{$v/@rawValue}" dataType="{$v/@dataType}" value="{string($v)}">{
    if (string($v/@uuid) != "") then $v/ancestor::*[parent::ochre]/identification else ()
  }</item>`;

  return `<ochre>{${xquery}}</ochre>`;
}

/**
 * Fetches and parses property values by property variables from the OCHRE API
 *
 * @param params - The parameters for the fetch
 * @param params.projectScopeUuid - The UUID of the project scope
 * @param params.belongsToCollectionScopeUuids - The collection scope UUIDs to filter by
 * @param params.propertyVariableUuids - The property variable UUIDs to query by
 * @param options - Options for the fetch
 * @param options.customFetch - A custom fetch function to use instead of the default fetch
 * @param options.version - The version of the OCHRE API to use
 * @returns The parsed property values by property variables or null if the fetch/parse fails
 */
export async function fetchPropertyValuesByPropertyVariables(
  params: {
    projectScopeUuid: string;
    belongsToCollectionScopeUuids: Array<string>;
    propertyVariableUuids: Array<string>;
  },
  options?: {
    customFetch?: (
      input: string | URL | globalThis.Request,
      init?: RequestInit,
    ) => Promise<Response>;
    version: ApiVersion;
  },
): Promise<
  | { items: Array<PropertyValueQueryItem> | null; error: null }
  | { items: null; error: string }
> {
  try {
    const customFetch = options?.customFetch;
    const version = options?.version ?? DEFAULT_API_VERSION;

    const {
      belongsToCollectionScopeUuids,
      propertyVariableUuids,
      projectScopeUuid,
    } = params;

    const xquery = buildXQuery(
      {
        projectScopeUuid,
        belongsToCollectionScopeUuids,
        propertyVariableUuids,
      },
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

    const data = await response.json();

    const parsedResultRaw = responseSchema.parse(data);
    if (Array.isArray(parsedResultRaw.result)) {
      throw new TypeError("No items found");
    }

    const parsedItems =
      Array.isArray(parsedResultRaw.result.ochre.item) ?
        parsedResultRaw.result.ochre.item
      : [parsedResultRaw.result.ochre.item];

    const groupedItems: Array<PropertyValueQueryItem> = [];
    for (const item of parsedItems) {
      const existingItem = groupedItems.find((i) => i.content === item.content);
      if (existingItem == null) {
        groupedItems.push({ count: 1, ...item });
      } else {
        existingItem.count++;
      }
    }
    return {
      items: groupedItems.toSorted((a, b) => {
        if (a.count !== b.count) {
          return b.count - a.count;
        }

        if (a.label !== b.label) {
          return a.label?.localeCompare(b.label ?? "") ?? 0;
        }

        return (
          a.content?.toString().localeCompare(b.content?.toString() ?? "") ?? 0
        );
      }),
      error: null,
    };
  } catch (error) {
    console.error(error);
    return {
      items: null,
      error:
        error instanceof Error ?
          error.message
        : "Failed to fetch property values by property variables",
    };
  }
}
