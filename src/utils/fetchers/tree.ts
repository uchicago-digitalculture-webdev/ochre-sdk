import type { Data, Tree } from "../../types/main.js";
import { fetchByUuid } from "../fetchers/generic.js";
import { parseMetadata, parseTree } from "../parse.js";
import { parseFakeString } from "../string.js";

/**
 * Fetches and parses a tree from the OCHRE API
 *
 * @param uuid - The UUID of the tree to fetch
 * @returns Object containing the parsed tree and its metadata, or null if the fetch/parse fails
 *
 * @example
 * ```ts
 * const result = await fetchTree("123e4567-e89b-12d3-a456-426614174000");
 * if (result === null) {
 *   console.error("Failed to fetch tree");
 *   return;
 * }
 * const { metadata, item } = result;
 * console.log(`Fetched tree: ${item.identification.label}`);
 * console.log(`Contains ${item.items.resources.length} resources`);
 * ```
 *
 * @remarks
 * The returned tree includes:
 * - Full tree metadata
 * - Hierarchical structure of resources, spatial units, and concepts
 * - Creator information
 * - Properties and type information
 * - License details
 */
export async function fetchTree(uuid: string) {
  try {
    const [error, dataRaw] = await fetchByUuid(uuid);
    if (error !== null) {
      throw new Error(error);
    }

    if (!("tree" in dataRaw.ochre)) {
      throw new Error("Invalid OCHRE data: API response missing 'tree' key");
    }

    const tree = parseTree(dataRaw.ochre.tree);
    if (!tree) {
      throw new Error("Invalid OCHRE data: Could not parse tree");
    }

    const data: Omit<Data, "item"> & { item: Tree } = {
      uuid: parseFakeString(dataRaw.ochre.uuid),
      publicationDateTime: new Date(dataRaw.ochre.publicationDateTime),
      belongsTo: {
        uuid: dataRaw.ochre.uuidBelongsTo,
        abbreviation: parseFakeString(dataRaw.ochre.belongsTo),
      },
      metadata: parseMetadata(dataRaw.ochre.metadata),
      item: tree,
    };

    return { metadata: data.metadata, tree: data.item };
  } catch (error) {
    console.error(error);
    return null;
  }
}
