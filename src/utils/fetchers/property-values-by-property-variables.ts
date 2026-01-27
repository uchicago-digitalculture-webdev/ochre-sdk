import * as z from "zod";
import type { ApiVersion, PropertyQueryItem } from "../../types/main.js";
import { BELONG_TO_COLLECTION_UUID } from "../../constants.js";
import { stringContentSchema, uuidSchema } from "../../schemas.js";
import { DEFAULT_API_VERSION } from "../helpers.js";

/**
 * Schema for a single property value by property variable item in the OCHRE API response
 */

const responseItemSchema = z.object({
  property: uuidSchema,
  category: z.object({ uuid: uuidSchema, content: z.string() }),
  value: z.object({
    uuid: uuidSchema.optional(),
    category: z.string().optional(),
    type: z.string().optional(),
    dataType: z.string().optional(), // this should not be optional
    publicationDateTime: z.string().optional(),
    content: z
      .union([
        z.string(),
        z.number(),
        z.boolean(),
        stringContentSchema,
        z.array(stringContentSchema),
      ])
      .optional(),
    rawValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  }),
});

/**
 * Schema for the property values by property variables OCHRE API response
 */
const responseSchema = z.object({
  result: z.object({
    ochre: z.object({
      item: z.union([responseItemSchema, z.array(responseItemSchema)]),
    }),
  }),
});

/**
 * Build an XQuery string to fetch property values by property variables from the OCHRE API
 * @param params - The parameters for the fetch
 * @param params.projectScopeUuid - The UUID of the project scope
 * @param params.belongsToCollectionScopeUuids - An array of collection scope UUIDs to filter by
 * @param params.propertyUuids - An array of property UUIDs to fetch
 * @param options - Options for the fetch
 * @param options.version - The version of the OCHRE API to use
 * @returns An XQuery string
 */
function buildXQuery(
  params: {
    projectScopeUuid: string;
    belongsToCollectionScopeUuids: Array<string>;
    propertyUuids: Array<string>;
  },
  options?: { version: ApiVersion },
): string {
  const version = options?.version ?? DEFAULT_API_VERSION;

  const { projectScopeUuid, belongsToCollectionScopeUuids, propertyUuids } =
    params;

  let collectionScopeFilter = "";

  if (belongsToCollectionScopeUuids.length > 0) {
    const belongsToCollectionScopeValues = belongsToCollectionScopeUuids
      .map((uuid) => `@uuid="${uuid}"`)
      .join(" or ");

    collectionScopeFilter = `[properties/property[label/@uuid="${BELONG_TO_COLLECTION_UUID}"][value[${belongsToCollectionScopeValues}]]]`;
  }

  const propertyFilters = propertyUuids
    .map((uuid) => `@uuid="${uuid}"`)
    .join(" or ");

  const xquery = `for $q in ${version === 2 ? "doc()" : "input()"}/ochre[@uuidBelongsTo="${projectScopeUuid}"]/*${collectionScopeFilter}/properties//property[label[${propertyFilters}]]
return <item>
<property>{xs:string($q/label/@uuid)}</property>
<value> {$q/*[2]/@*} {$q/*[2]/text()} {$q/*[2]/content} </value>
<category> {$q/ancestor::node()[local-name(.)="properties"]/../@uuid}  {local-name($q/ancestor::node()[local-name(.)="properties"]/../self::node())} </category>
</item>`;

  return `<ochre>{${xquery}}</ochre>`;
}

/**
 * Fetches and parses property values by property variables from the OCHRE API
 *
 * @param params - The parameters for the fetch
 * @param params.projectScopeUuid - The UUID of the project scope
 * @param params.belongsToCollectionScopeUuids - The collection scope UUIDs to filter by
 * @param params.propertyUuids - The property UUIDs to query by
 * @param options - Options for the fetch
 * @param options.customFetch - A custom fetch function to use instead of the default fetch
 * @param options.version - The version of the OCHRE API to use
 * @returns The parsed property values by property variables or null if the fetch/parse fails
 */
export async function fetchPropertyValuesByPropertyVariables(
  params: {
    projectScopeUuid: string;
    belongsToCollectionScopeUuids: Array<string>;
    propertyUuids: Array<string>;
  },
  options?: {
    customFetch?: (
      input: string | URL | globalThis.Request,
      init?: RequestInit,
    ) => Promise<Response>;
    version: ApiVersion;
  },
): Promise<
  | { items: Array<PropertyQueryItem> | null; error: null }
  | { items: null; error: string }
> {
  try {
    const customFetch = options?.customFetch;
    const version = options?.version ?? DEFAULT_API_VERSION;

    const { belongsToCollectionScopeUuids, propertyUuids, projectScopeUuid } =
      params;

    const xquery = buildXQuery(
      { projectScopeUuid, belongsToCollectionScopeUuids, propertyUuids },
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

    const items: Record<string, PropertyQueryItem> = {};
    for (const item of parsedItems) {
      const categoryUuid = item.category.uuid;
      const valueUuid = item.value.uuid;
      const valueContent =
        ((
          (item.value.rawValue ??
          (typeof item.value.content === "string" ||
            typeof item.value.content === "number" ||
            typeof item.value.content === "boolean"))
        ) ?
          item.value.content?.toString()
        : Array.isArray(item.value.content) ?
          item.value.content
            .find((content) => content.lang === "eng")
            ?.string.toString()
        : item.value.content?.string.toString()) ?? "";

      if (valueContent in items) {
        items[valueContent]!.resultUuids.push(categoryUuid);
      } else {
        items[valueContent] = {
          value: {
            uuid: valueUuid ?? null,
            category: item.value.category ?? null,
            type: item.value.type ?? null,
            dataType: item.value.dataType ?? null,
            publicationDateTime: item.value.publicationDateTime ?? null,
            content: valueContent,
            label:
              item.value.rawValue != null && item.value.content != null ?
                (
                  typeof item.value.content === "string" ||
                  typeof item.value.content === "number" ||
                  typeof item.value.content === "boolean"
                ) ?
                  item.value.content.toString()
                : Array.isArray(item.value.content) ?
                  (item.value.content
                    .find((content) => content.lang === "eng")
                    ?.string.toString() ?? "")
                : item.value.content.string.toString()
              : null,
          },
          resultUuids: [categoryUuid],
        };
      }
    }

    const returnedItems = Object.values(items).toSorted((a, b) => {
      const aValue = a.value.label ?? a.value.content;
      const bValue = b.value.label ?? b.value.content;

      return aValue.localeCompare(bValue, "en-US");
    });

    return { items: returnedItems, error: null };
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
