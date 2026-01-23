import * as z from "zod";
import type { ApiVersion, PropertyQueryItem } from "../../types/main.js";
import { BELONG_TO_COLLECTION_UUID } from "../../constants.js";
import { uuidSchema } from "../../schemas.js";
import { DEFAULT_API_VERSION } from "../helpers.js";

/**
 * Schema for a single item in the OCHRE API response
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
    content: z.string().optional(),
    rawValue: z.string().optional(),
  }),
});

/**
 * Schema for the OCHRE API response
 */
const responseSchema = z.object({
  result: z.object({
    item: z.union([responseItemSchema, z.array(responseItemSchema)]),
  }),
});

/**
 * Build an XQuery string to fetch property query items from the OCHRE API
 * @param scopeUuids - An array of scope UUIDs to filter by
 * @param propertyUuids - An array of property UUIDs to fetch
 * @param projectScopeUuid - The UUID of the project scope
 * @returns An XQuery string
 */
function buildXQuery(
  scopeUuids: Array<string>,
  propertyUuids: Array<string>,
  projectScopeUuid: string,
): string {
  let collectionScopeFilter = "";

  if (scopeUuids.length > 0) {
    const collectionValues = scopeUuids
      .map((uuid) => `@uuid="${uuid}"`)
      .join(" or ");

    collectionScopeFilter = `[properties/property[label/@uuid="${BELONG_TO_COLLECTION_UUID}"][value[${collectionValues}]]]`;
  }

  const propertyFilters = propertyUuids
    .map((uuid) => `@uuid="${uuid}"`)
    .join(" or ");

  const xquery = `for $q in input()/ochre[@uuidBelongsTo="${projectScopeUuid}"]/*${collectionScopeFilter}/properties//property[label[${propertyFilters}]]
return <item>
<property>{xs:string($q/label/@uuid)}</property>
<value> {$q/*[2]/@*} {$q/*[2]/content[1]/string/text()} </value>
<category> {$q/ancestor::node()[local-name(.)="properties"]/../@uuid}  {local-name($q/ancestor::node()[local-name(.)="properties"]/../self::node())} </category>
</item>`;

  return xquery;
}

/**
 * Fetches and parses a property query from the OCHRE API
 *
 * @param params - The parameters for the fetch
 * @param params.scopeUuids - The scope UUIDs to filter by
 * @param params.propertyUuids - The property UUIDs to query by
 * @param params.projectScopeUuid - The UUID of the project scope
 * @param options - Options for the fetch
 * @param options.customFetch - A custom fetch function to use instead of the default fetch
 * @param options.version - The version of the OCHRE API to use
 * @returns The parsed property query or null if the fetch/parse fails
 *
 * @example
 * ```ts
 * const propertyQuery = await fetchPropertyQuery(["0c0aae37-7246-495b-9547-e25dbf5b99a3"], ["9c4da06b-f15e-40af-a747-0933eaf3587e"]);
 * if (propertyQuery === null) {
 *   console.error("Failed to fetch property query");
 *   return;
 * }
 * console.log(`Fetched property query: ${propertyQuery.item}`);
 * ```
 *
 * @remarks
 * The returned property query includes:
 * - Property items
 */
export async function fetchPropertyQuery(
  params: {
    scopeUuids: Array<string>;
    propertyUuids: Array<string>;
    projectScopeUuid: string;
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

    const { scopeUuids, propertyUuids, projectScopeUuid } = params;

    const xquery = buildXQuery(scopeUuids, propertyUuids, projectScopeUuid);

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
      Array.isArray(parsedResultRaw.result.item) ?
        parsedResultRaw.result.item
      : [parsedResultRaw.result.item];

    const items: Record<string, PropertyQueryItem> = {};
    for (const item of parsedItems) {
      const categoryUuid = item.category.uuid;
      const valueUuid = item.value.uuid;
      const valueContent = item.value.rawValue ?? item.value.content ?? "";

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
            content: item.value.rawValue ?? item.value.content ?? "",
            label:
              item.value.rawValue != null && item.value.content != null ?
                item.value.content
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
        : "Failed to fetch property query",
    };
  }
}
