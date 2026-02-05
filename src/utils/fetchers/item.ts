import type { ApiVersion, DataCategory, Item } from "../../types/main.js";
import { DEFAULT_API_VERSION } from "../helpers.js";
import { getItemCategory } from "../internal.js";
import {
  parseBibliography,
  parseConcept,
  parseMetadata,
  parsePeriod,
  parsePerson,
  parsePropertyValue,
  parsePropertyVariable,
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
 * @returns Object containing the parsed OCHRE item, or an error message if the fetch/parse fails
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
    fetch?: (
      input: string | URL | globalThis.Request,
      init?: RequestInit,
    ) => Promise<Response>;
    version?: ApiVersion;
  },
): Promise<{ error: null; item: Item<T, U> } | { error: string; item: never }> {
  try {
    const version = options?.version ?? DEFAULT_API_VERSION;

    const [error, data] = await fetchByUuid(uuid, { fetch, version });
    if (error !== null) {
      throw new Error(error);
    }

    const categoryKey = category ?? getItemCategory(Object.keys(data.ochre));

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
      case "propertyVariable": {
        if (!("propertyVariable" in data.ochre)) {
          throw new Error(
            "Invalid OCHRE data: API response missing 'propertyVariable' key",
          );
        }
        item = parsePropertyVariable(
          data.ochre.propertyVariable,
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

    return { error: null as never, item };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error",
      item: undefined as never,
    };
  }
}
