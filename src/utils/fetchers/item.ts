import type {
  Bibliography,
  Concept,
  DataCategory,
  Metadata,
  Period,
  Person,
  PropertyValue,
  Resource,
  Set,
  SpatialUnit,
  Tree,
} from "../../types/main.js";
import { getItemCategory } from "../helpers.js";
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
export async function fetchItem<T extends DataCategory, U extends DataCategory>(
  uuid: string,
  category?: T,
  setCategory?: T extends "set" ? U : never,
  customFetch?: (
    input: string | URL | globalThis.Request,
    init?: RequestInit,
  ) => Promise<Response>,
): Promise<
  | {
      error: null;
      metadata: Metadata;
      belongsTo: { uuid: string; abbreviation: string };
      item: T extends "resource" ? Resource
      : T extends "spatialUnit" ? SpatialUnit
      : T extends "concept" ? Concept
      : T extends "period" ? Period
      : T extends "bibliography" ? Bibliography
      : T extends "person" ? Person
      : T extends "propertyValue" ? PropertyValue
      : T extends "set" ? Set<U>
      : T extends "tree" ? Tree<T, U>
      : never;
      category: T;
    }
  | {
      error: string;
      metadata: never;
      belongsTo: never;
      item: never;
      category: never;
    }
> {
  try {
    const [error, data] = await fetchByUuid(uuid, customFetch);
    if (error !== null) {
      throw new Error(error);
    }

    const categoryKey = getItemCategory(Object.keys(data.ochre));

    let item;

    switch (categoryKey) {
      case "resource": {
        if (!("resource" in data.ochre)) {
          throw new Error(
            "Invalid OCHRE data: API response missing 'resource' key",
          );
        }
        item = parseResource(data.ochre.resource);
        break;
      }
      case "spatialUnit": {
        if (!("spatialUnit" in data.ochre)) {
          throw new Error(
            "Invalid OCHRE data: API response missing 'spatialUnit' key",
          );
        }
        item = parseSpatialUnit(data.ochre.spatialUnit);
        break;
      }
      case "concept": {
        if (!("concept" in data.ochre)) {
          throw new Error(
            "Invalid OCHRE data: API response missing 'concept' key",
          );
        }
        item = parseConcept(data.ochre.concept);
        break;
      }
      case "period": {
        if (!("period" in data.ochre)) {
          throw new Error(
            "Invalid OCHRE data: API response missing 'period' key",
          );
        }
        item = parsePeriod(data.ochre.period);
        break;
      }
      case "bibliography": {
        if (!("bibliography" in data.ochre)) {
          throw new Error(
            "Invalid OCHRE data: API response missing 'bibliography' key",
          );
        }
        item = parseBibliography(data.ochre.bibliography);
        break;
      }
      case "person": {
        if (!("person" in data.ochre)) {
          throw new Error(
            "Invalid OCHRE data: API response missing 'person' key",
          );
        }
        item = parsePerson(data.ochre.person);
        break;
      }
      case "propertyValue": {
        if (!("propertyValue" in data.ochre)) {
          throw new Error(
            "Invalid OCHRE data: API response missing 'propertyValue' key",
          );
        }
        item = parsePropertyValue(data.ochre.propertyValue);
        break;
      }
      case "set": {
        if (!("set" in data.ochre)) {
          throw new Error("Invalid OCHRE data: API response missing 'set' key");
        }
        item = parseSet<U>(data.ochre.set, setCategory);
        break;
      }
      case "tree": {
        if (!("tree" in data.ochre)) {
          throw new Error(
            "Invalid OCHRE data: API response missing 'tree' key",
          );
        }
        item = parseTree<T, U>(data.ochre.tree, category, setCategory);
        break;
      }
      default: {
        throw new Error("Invalid category");
      }
    }

    const metadata = parseMetadata(data.ochre.metadata);
    const belongsTo = {
      uuid: data.ochre.uuidBelongsTo,
      abbreviation: parseFakeString(data.ochre.belongsTo),
    };

    return {
      error: null as never,
      metadata,
      belongsTo,
      item: item as T extends "resource" ? Resource
      : T extends "spatialUnit" ? SpatialUnit
      : T extends "concept" ? Concept
      : T extends "period" ? Period
      : T extends "bibliography" ? Bibliography
      : T extends "person" ? Person
      : T extends "propertyValue" ? PropertyValue
      : never,
      category: category!,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      metadata: undefined as never,
      belongsTo: undefined as never,
      item: undefined as never,
      category: undefined as never,
    };
  }
}
