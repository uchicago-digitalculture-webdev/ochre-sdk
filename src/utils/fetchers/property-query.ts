import type { PropertyQueryItem } from "../../types/main.js";
import * as z from "zod";
import { UNASSIGNED_UUID } from "../../constants.js";

// Hard-coded to UChicago Node (for now)
const PROJECT_SCOPE = "0c0aae37-7246-495b-9547-e25dbf5b99a3";
const BELONG_TO_COLLECTION_UUID = "30054cb2-909a-4f34-8db9-8fe7369d691d";

/**
 * Check if a string is a valid UUID
 * @param value - The string to check
 * @returns True if the string is a valid UUID, false otherwise
 */
function isUUID(value: string): boolean {
  const uuidRegex = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Schema for a single item in the OCHRE API response
 */

const responseItemSchema = z.object({
  property: z.string().refine(isUUID),
  category: z.object({ uuid: z.string().refine(isUUID), content: z.string() }),
  value: z.object({
    uuid: z.string().refine(isUUID).optional(),
    category: z.string().optional(),
    type: z.string().optional(),
    dataType: z.string(),
    publicationDateTime: z.iso.datetime().optional(),
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
 * Build an XQuery string to fetch properties from the OCHRE API
 * @param scopeUuids - An array of scope UUIDs to filter by
 * @param propertyUuids - An array of property UUIDs to fetch
 * @returns An XQuery string
 */
function buildXQuery(
  scopeUuids: Array<string>,
  propertyUuids: Array<string>,
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

  const xquery = `for $q in input()/ochre[@uuidBelongsTo="${PROJECT_SCOPE}"]/*${collectionScopeFilter}/properties//property[label[${propertyFilters}]]
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
 * @param scopeUuids - The scope UUIDs to filter by
 * @param propertyUuids - The property UUIDs to query by
 * @param options - Options for the fetch
 * @param options.customFetch - A custom fetch function to use instead of the default fetch
 * @param options.isVersion2 - Whether to use the v2 API
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
  scopeUuids: Array<string>,
  propertyUuids: Array<string>,
  options?: {
    customFetch?: (
      input: string | URL | globalThis.Request,
      init?: RequestInit,
    ) => Promise<Response>;
    isVersion2?: boolean;
  },
): Promise<
  | { items: Array<PropertyQueryItem> | null; error: null }
  | { items: null; error: string }
> {
  try {
    const customFetch = options?.customFetch;
    const isVersion2 = options?.isVersion2 ?? false;

    const xquery = buildXQuery(scopeUuids, propertyUuids);

    const response = await (customFetch ?? fetch)(
      isVersion2 ?
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
            dataType: item.value.dataType,
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

    const returnedItems = Object.values(items)
      .filter((result) => result.value.uuid !== UNASSIGNED_UUID)
      .toSorted((a, b) => {
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
