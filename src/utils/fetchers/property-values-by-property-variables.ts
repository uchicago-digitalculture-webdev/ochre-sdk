import * as z from "zod";
import type { ApiVersion, PropertyValueQueryItem } from "../../types/main.js";
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
    const { identification, ...rest } = val;

    let value = { ...rest };

    switch (val.dataType) {
      case "IDREF":
      case "string":
      case "date":
      case "dateTime": {
        value = { ...value, content: val.content?.toString() ?? null };
        break;
      }
      case "integer":
      case "decimal":
      case "time": {
        value = {
          ...value,
          content: val.content !== null ? Number(val.content) : null,
        };
        break;
      }
      case "boolean": {
        value = {
          ...value,
          content: val.content !== null ? Boolean(val.content) : null,
        };
        break;
      }
      default: {
        // throw new Error(`Invalid data type: ${val.dataType}`);
        break;
      }
    }

    if ("identification" in value && value.identification != null) {
      value = {
        ...value,
        content:
          identification?.label.content != null ?
            parseStringContent({ content: identification.label.content })
          : null,
      };
    }

    return value;
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

  const xquery = `let $props := ${version === 2 ? "doc()" : "input()"}/ochre[@uuidBelongsTo="${projectScopeUuid}"]
      /*${collectionScopeFilter}
      /properties//property[label[${propertyVariableFilters}]]

  let $values := $props/value

  let $uuid-values := $values[@uuid]
  let $uuid-vals := distinct-values($uuid-values/@uuid)
  let $uuid-dataType := string($uuid-values[1]/@dataType)
  let $uuid-items :=
    for $val in $uuid-vals
    let $matching-prop := ($props[value/@uuid = $val])[1]
    let $count := count($uuid-values[@uuid = $val])
    let $identification := $matching-prop/ancestor::*[parent::ochre]/identification
    let $label := string($identification/label/content/string/text())
    order by $count descending, $label ascending
    return <item count="{$count}" uuid="{$val}" dataType="{$uuid-dataType}">{$identification}</item>

  let $raw-values := $values[@rawValue]
  let $raw-vals := distinct-values($raw-values/@rawValue)
  let $raw-dataType := string($raw-values[1]/@dataType)
  let $raw-items :=
    for $val in $raw-vals
    let $count := count($raw-values[@rawValue = $val])
    let $label := string($raw-values[@rawValue = $val][1])
    order by $count descending, $label ascending
    return <item count="{$count}" rawValue="{$val}" dataType="{$raw-dataType}" label="{$label}">{$val}</item>

  let $text-values := $values[not(@uuid) and not(@rawValue)]
  let $text-vals := distinct-values(for $v in $text-values return string($v))
  let $text-dataType := string($text-values[1]/@dataType)
  let $text-items :=
    for $val in $text-vals
    let $count := count($text-values[string(.) = $val])
    order by $count descending, $val ascending
    return <item count="{$count}" dataType="{$text-dataType}">{$val}</item>

  return ($uuid-items, $raw-items, $text-items)`;

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

    const items = parsedItems.filter(
      (item) => item.content?.toString().trim() !== "",
    ) as Array<PropertyValueQueryItem>;

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
