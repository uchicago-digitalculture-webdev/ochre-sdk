import * as v from "valibot";
import type {
  FetchBaseOptions,
  FetchLanguages,
  FetchRuntimeOptions,
} from "#/parsers/helpers.js";
import type {
  Query,
  SetItem,
  SetItemsSort,
  TreeItemCategory,
} from "#/types/index.js";
import { getErrorOutput } from "#/errors.js";
import { fetchContainerItems } from "#/fetchers/container-items.js";
import { treeItemsParametersSchema } from "#/schemas.js";

type FetchTreeItemsCategory<
  TContainedItemCategories extends ReadonlyArray<TreeItemCategory> | undefined,
> =
  TContainedItemCategories extends ReadonlyArray<infer U>
    ? Extract<U, TreeItemCategory>
    : TreeItemCategory;

/**
 * Fetches and parses Tree items from the OCHRE API
 *
 * The counterpart of {@link fetchSetItems} for a Tree, and the way to read a
 * Tree too large to fetch whole: a Tree of tens of thousands of items is one
 * OCHRE document, so counting, filtering and sorting run inside it rather than
 * over one document per item.
 *
 * Items nested under headings are returned flat, in document order, because a
 * heading groups items for display rather than identifying them. What the
 * returned items carry is whatever the Tree payload carries: OCHRE publishes
 * Tree items as identification-only stubs unless the Tree is published with
 * item properties, so a `property` query or a `propertyValue` sort only works
 * on a Tree that carries them.
 *
 * @param parameters - The parameters for the fetch
 * @param parameters.treeScopeUuids - The Tree scope UUIDs to filter by
 * @param parameters.queries - Recursive query tree used to filter matching items
 * @param parameters.sort - Optional sorting configuration applied before pagination.
 * For propertyValue sorting, dataType is required and the sort key uses the first valid leaf value (value[not(@i)]).
 * @param parameters.page - The page number (1-indexed)
 * @param parameters.pageSize - The number of items per page
 * @param containedItemCategories - The categories of the items to fetch
 * @param options - Options for the fetch
 * @param options.fetch - The fetch function to use
 * @returns The parsed Tree items or null if the fetch/parse fails
 */
export async function fetchTreeItems<
  const TContainedItemCategories extends
    | ReadonlyArray<TreeItemCategory>
    | undefined = undefined,
  const TLanguages extends ReadonlyArray<string> | undefined = undefined,
>(
  parameters: {
    treeScopeUuids: Array<string>;
    queries?: Query | null;
    sort?: SetItemsSort;
    page: number;
    pageSize?: number;
  },
  containedItemCategories?: TContainedItemCategories,
  options?: FetchBaseOptions<TLanguages>,
): Promise<
  | {
      totalCount: number;
      page: number;
      pageSize: number;
      items: Array<
        SetItem<
          FetchTreeItemsCategory<TContainedItemCategories>,
          FetchLanguages<TLanguages>
        >
      >;
      error: null;
      detailedError: null;
    }
  | {
      totalCount: null;
      page: null;
      pageSize: null;
      items: null;
      error: string;
      detailedError: string;
    }
>;
export async function fetchTreeItems(
  parameters: {
    treeScopeUuids: Array<string>;
    queries?: Query | null;
    sort?: SetItemsSort;
    page: number;
    pageSize?: number;
  },
  containedItemCategories?: ReadonlyArray<TreeItemCategory>,
  options?: FetchRuntimeOptions,
): Promise<
  | {
      totalCount: number;
      page: number;
      pageSize: number;
      items: Array<SetItem<TreeItemCategory, ReadonlyArray<string>>>;
      error: null;
      detailedError: null;
    }
  | {
      totalCount: null;
      page: null;
      pageSize: null;
      items: null;
      error: string;
      detailedError: string;
    }
> {
  try {
    const {
      treeScopeUuids,
      belongsToCollectionScopeUuids,
      queries,
      sort,
      page,
      pageSize,
    } = v.parse(treeItemsParametersSchema, parameters);

    const { items, ...pagination } = await fetchContainerItems({
      container: "tree",
      scopeUuids: treeScopeUuids,
      belongsToCollectionScopeUuids,
      queries,
      sort,
      page,
      pageSize,
      containedItemCategories,
      label: "OCHRE Tree items",
      options,
    });

    return {
      ...pagination,
      items: items as Array<SetItem<TreeItemCategory, ReadonlyArray<string>>>,
      error: null,
      detailedError: null,
    };
  } catch (error) {
    return {
      totalCount: null,
      page: null,
      pageSize: null,
      items: null,
      ...getErrorOutput(error, "Failed to fetch Tree items"),
    };
  }
}
