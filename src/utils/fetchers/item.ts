import type { ApiVersion, DataCategory, Item } from "../../types/main.js";
import { DEFAULT_API_VERSION } from "../../constants.js";
import { getItemCategory } from "../internal.js";
import {
  parseBibliography,
  parseConcept,
  parseMetadata,
  parsePeriod,
  parsePerson,
  parsePropertyValue,
  parseResource,
  parseSet,
  parseSpatialUnit,
  parseText,
  parseTree,
} from "../parse.js";
import { parseFakeString } from "../string.js";
import { fetchByUuid } from "./uuid.js";

/**
 * Fetches and parses an OCHRE item from the OCHRE API
 *
 * @param uuid - The UUID of the OCHRE item to fetch
 * @returns Object containing the parsed OCHRE item and its metadata, or null if the fetch/parse fails
 *
 * @example
 * ```ts
 * const result = await fetchItem("123e4567-e89b-12d3-a456-426614174000");
 * if (result === null) {
 *   console.error("Failed to fetch OCHRE item");
 *   return;
 * }
 * const { metadata, belongsTo, item, category } = result;
 * console.log(`Fetched OCHRE item: ${item.identification.label} with category ${category}`);
 * ```
 *
 * Or, if you want to fetch a specific category, you can do so by passing the category as an argument:
 * ```ts
 * const result = await fetchItem("123e4567-e89b-12d3-a456-426614174000", "resource");
 * const { metadata, belongsTo, item, category } = result;
 * console.log(item.category); // "resource"
 * ```
 *
 * @remarks
 * The returned OCHRE item includes:
 * - Item metadata
 * - Item belongsTo information
 * - Item content
 * - Item category
 *
 * If the fetch/parse fails, the returned object will have an `error` property.
 */
export async function fetchItem<
  T extends DataCategory = DataCategory,
  U extends DataCategory | Array<DataCategory> = T extends "tree" ?
    Exclude<DataCategory, "tree">
  : T extends "set" ? Array<DataCategory>
  : never,
>(
  uuid: string,
  category?: T,
  itemCategories?: U,
  options?: {
    customFetch?: (
      input: string | URL | globalThis.Request,
      init?: RequestInit,
    ) => Promise<Response>;
    version: ApiVersion;
  },
): Promise<
  | { error: null; item: Item<T, U>; category: T; itemCategories: U }
  | { error: string; item: never; category: never; itemCategories: never }
> {
  try {
    const customFetch = options?.customFetch;
    const version = options?.version ?? DEFAULT_API_VERSION;

    const [error, data] = await fetchByUuid(uuid, { customFetch, version });
    if (error !== null) {
      throw new Error(error);
    }

    const categoryKey = getItemCategory(Object.keys(data.ochre));

    const belongsTo = {
      uuid: data.ochre.uuidBelongsTo,
      abbreviation: parseFakeString(data.ochre.belongsTo),
    };

    const metadata = parseMetadata(data.ochre.metadata);

    let item: Item<T, U>;

    switch (categoryKey) {
      case "resource": {
        if (!("resource" in data.ochre)) {
          throw new Error(
            "Invalid OCHRE data: API response missing 'resource' key",
          );
        }
        item = parseResource(
          data.ochre.resource,
          metadata,
          data.ochre.persistentUrl,
          belongsTo,
        ) as Item<T, U>;
        break;
      }
      case "spatialUnit": {
        if (!("spatialUnit" in data.ochre)) {
          throw new Error(
            "Invalid OCHRE data: API response missing 'spatialUnit' key",
          );
        }
        item = parseSpatialUnit(
          data.ochre.spatialUnit,
          metadata,
          data.ochre.persistentUrl,
          belongsTo,
        ) as Item<T, U>;
        break;
      }
      case "concept": {
        if (!("concept" in data.ochre)) {
          throw new Error(
            "Invalid OCHRE data: API response missing 'concept' key",
          );
        }
        item = parseConcept(
          data.ochre.concept,
          metadata,
          data.ochre.persistentUrl,
          belongsTo,
        ) as Item<T, U>;
        break;
      }
      case "period": {
        if (!("period" in data.ochre)) {
          throw new Error(
            "Invalid OCHRE data: API response missing 'period' key",
          );
        }
        item = parsePeriod(
          data.ochre.period,
          metadata,
          data.ochre.persistentUrl,
          {
            uuid: data.ochre.uuidBelongsTo,
            abbreviation: parseFakeString(data.ochre.belongsTo),
          },
        ) as Item<T, U>;
        break;
      }
      case "bibliography": {
        if (!("bibliography" in data.ochre)) {
          throw new Error(
            "Invalid OCHRE data: API response missing 'bibliography' key",
          );
        }
        item = parseBibliography(
          data.ochre.bibliography,
          metadata,
          data.ochre.persistentUrl,
          belongsTo,
        ) as Item<T, U>;
        break;
      }
      case "person": {
        if (!("person" in data.ochre)) {
          throw new Error(
            "Invalid OCHRE data: API response missing 'person' key",
          );
        }
        item = parsePerson(
          data.ochre.person,
          metadata,
          data.ochre.persistentUrl,
          belongsTo,
        ) as Item<T, U>;
        break;
      }
      case "propertyValue": {
        if (!("propertyValue" in data.ochre)) {
          throw new Error(
            "Invalid OCHRE data: API response missing 'propertyValue' key",
          );
        }
        item = parsePropertyValue(
          data.ochre.propertyValue,
          metadata,
          data.ochre.persistentUrl,
          belongsTo,
        ) as Item<T, U>;
        break;
      }
      case "text": {
        if (!("text" in data.ochre)) {
          throw new Error(
            "Invalid OCHRE data: API response missing 'text' key",
          );
        }
        item = parseText(
          data.ochre.text,
          metadata,
          data.ochre.persistentUrl,
          belongsTo,
        ) as Item<T, U>;
        break;
      }
      case "set": {
        if (!("set" in data.ochre)) {
          throw new Error("Invalid OCHRE data: API response missing 'set' key");
        }
        item = parseSet(
          data.ochre.set,
          itemCategories as Array<DataCategory> | undefined,
          metadata,
          data.ochre.persistentUrl,
          belongsTo,
        ) as unknown as Item<T, U>;
        break;
      }
      case "tree": {
        if (!("tree" in data.ochre)) {
          throw new Error(
            "Invalid OCHRE data: API response missing 'tree' key",
          );
        }
        item = parseTree(
          data.ochre.tree,
          itemCategories as Array<Exclude<DataCategory, "tree">> | undefined,
          metadata,
          data.ochre.persistentUrl,
          belongsTo,
        ) as unknown as Item<T, U>;
        break;
      }
      default: {
        throw new Error("Invalid category");
      }
    }

    return {
      error: null as never,
      item,
      category: category!,
      itemCategories: itemCategories!,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      item: undefined as never,
      category: undefined as never,
      itemCategories: undefined as never,
    };
  }
}
