import * as z from "zod";
import type {
  ApiVersion,
  PropertyValueContentType,
  PropertyValueQueryItem,
} from "../../types/main.js";
import { BELONG_TO_COLLECTION_UUID } from "../../constants.js";
import { identificationSchema, uuidSchema } from "../../schemas.js";
import { DEFAULT_API_VERSION } from "../helpers.js";
import { parseStringContent } from "../string.js";

/**
 * Schema for a single property value query item in the OCHRE API response
 */
const propertyValueQueryItemSchema = z
  .object({
    uuid: uuidSchema.optional().transform((val) => val ?? null),
    count: z.number(),
    // dataType: propertyValueContentTypeSchema,
    dataType: z.string(),
    identification: identificationSchema.optional(),
    label: z
      .union([z.string(), z.number(), z.boolean()])
      .optional()
      .transform((val) => val?.toString() ?? null),
    content: z
      .union([z.string(), z.number(), z.boolean()])
      .optional()
      .transform((val) => val ?? null),
  })
  .transform((val) => {
    let value = val;

    switch (val.dataType) {
      case "IDREF":
      case "string":
      case "date":
      case "dateTime": {
        value = { ...val, content: val.content?.toString() ?? null };
        break;
      }
      case "integer":
      case "decimal":
      case "time": {
        value = {
          ...val,
          content: val.content !== null ? Number(val.content) : null,
        };
        break;
      }
      case "boolean": {
        value = {
          ...val,
          content: val.content !== null ? Boolean(val.content) : null,
        };
        break;
      }
      default: {
        // throw new Error(`Invalid data type: ${val.dataType}`);
        value = val;
        break;
      }
    }

    if ("identification" in value && value.identification != null) {
      const { identification, ...rest } = value;

      value = {
        ...rest,
        content: parseStringContent({ content: identification.label.content }),
      };
    }

    return value;
  });

/**
 * Schema for the property values by property variables OCHRE API response
 */
const responseSchema = z.object({
  result: z.object({
    ochre: z.object({
      item: z.union([
        propertyValueQueryItemSchema,
        z.array(propertyValueQueryItemSchema),
      ]),
    }),
  }),
});

/**
 * Build an XQuery string to fetch property values by property variables from the OCHRE API
 * @param params - The parameters for the fetch
 * @param params.projectScopeUuid - The UUID of the project scope
 * @param params.belongsToCollectionScopeUuids - An array of collection scope UUIDs to filter by
 * @param params.propertyVariables - An array of property variables to fetch
 * @param params.propertyVariables.dataType - The data type of the property variables
 * @param params.propertyVariables.uuids - The UUIDs of the property variables
 * @param options - Options for the fetch
 * @param options.version - The version of the OCHRE API to use
 * @returns An XQuery string
 */
function buildXQuery(
  params: {
    projectScopeUuid: string;
    belongsToCollectionScopeUuids: Array<string>;
    propertyVariables: {
      dataType: PropertyValueContentType;
      uuids: Array<string>;
    };
  },
  options?: { version: ApiVersion },
): string {
  const version = options?.version ?? DEFAULT_API_VERSION;

  const { projectScopeUuid, belongsToCollectionScopeUuids, propertyVariables } =
    params;

  let collectionScopeFilter = "";

  if (belongsToCollectionScopeUuids.length > 0) {
    const belongsToCollectionScopeValues = belongsToCollectionScopeUuids
      .map((uuid) => `@uuid="${uuid}"`)
      .join(" or ");

    collectionScopeFilter = `[properties/property[label/@uuid="${BELONG_TO_COLLECTION_UUID}"][value[${belongsToCollectionScopeValues}]]]`;
  }

  const propertyVariableFilters = propertyVariables.uuids
    .map((uuid) => `@uuid="${uuid}"`)
    .join(" or ");

  const isIDREF = propertyVariables.dataType === "IDREF";

  const xquery = `let $matching-props := ${version === 2 ? "doc()" : "input()"}/ochre[@uuidBelongsTo="${projectScopeUuid}"]
      /*${collectionScopeFilter}
      /properties//property[label[${propertyVariableFilters}]]

  let $pairs :=
    for $prop in $matching-props
      return <p
        v="{$prop/${
          isIDREF ? "value/@uuid"
          : (
            propertyVariables.dataType === "date" ||
            propertyVariables.dataType === "dateTime" ||
            propertyVariables.dataType === "time" ||
            propertyVariables.dataType === "integer" ||
            propertyVariables.dataType === "decimal" ||
            propertyVariables.dataType === "boolean"
          ) ?
            "value/@rawValue"
          : "value"
        }}"
        r="{$prop/value/@rawValue}"
        d="{$prop/value/@dataType}"
        i="{$prop/ancestor::*[parent::ochre]/@uuid}">
          ${isIDREF ? "{$prop/ancestor::*[parent::ochre]/identification}" : "{$prop/value/content/string()} {$prop/value/text()}"}
        </p>

  let $distinct-vals := distinct-values($pairs/@v)

  for $val in $distinct-vals
    let $matching := $pairs[@v = $val][1]
    let $count := count(distinct-values($pairs[@v = $val]/@i))
    let $rawValue := string($matching/@r)
    let $dataType := string($matching/@d)
    ${
      isIDREF ?
        `let $identification := $matching[1]/identification
    let $sortLabel := string($identification/label/content/string/text())
    order by $count descending, $sortLabel ascending

  return
    <item count="{$count}" uuid="{$val}" dataType="IDREF">{$identification}</item>`
      : `let $content := $matching/text()
    order by $count descending, $content ascending

  return
    if ($rawValue != "") then
      <item count="{$count}" label="{$content}" dataType="{$dataType}">{$rawValue}</item>
    else
      <item count="{$count}" dataType="{$dataType}">{$content}</item>`
    }`;

  return `<ochre>{${xquery}}</ochre>`;
}

/**
 * Fetches and parses property values by property variables from the OCHRE API
 *
 * @param params - The parameters for the fetch
 * @param params.projectScopeUuid - The UUID of the project scope
 * @param params.belongsToCollectionScopeUuids - The collection scope UUIDs to filter by
 * @param params.propertyVariables - The property variables to query by
 * @param params.propertyVariables.dataType - The data type of the property variables
 * @param params.propertyVariables.uuids - The UUIDs of the property variables
 * @param options - Options for the fetch
 * @param options.customFetch - A custom fetch function to use instead of the default fetch
 * @param options.version - The version of the OCHRE API to use
 * @returns The parsed property values by property variables or null if the fetch/parse fails
 */
export async function fetchPropertyValuesByPropertyVariables(
  params: {
    projectScopeUuid: string;
    belongsToCollectionScopeUuids: Array<string>;
    propertyVariables: {
      dataType: PropertyValueContentType;
      uuids: Array<string>;
    };
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
      propertyVariables,
      projectScopeUuid,
    } = params;

    const xquery = buildXQuery(
      { projectScopeUuid, belongsToCollectionScopeUuids, propertyVariables },
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
    const parsedItems =
      Array.isArray(parsedResultRaw.result.ochre.item) ?
        parsedResultRaw.result.ochre.item
      : [parsedResultRaw.result.ochre.item];

    const items = parsedItems.filter(
      (item) => String(item.content).trim() !== "",
    );

    return { items, error: null };
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
