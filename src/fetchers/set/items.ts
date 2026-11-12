import * as v from "valibot";
import type {
  FetchBaseOptions,
  FetchLanguages,
  FetchRuntimeOptions,
} from "#/parsers/helpers.js";
import type {
  Query,
  SetItem,
  SetItemCategory,
  SetItemsSort,
} from "#/types/index.js";
import { getErrorOutput } from "#/errors.js";
import { fetchContainerItems } from "#/fetchers/container-items.js";
import { setItemsParametersSchema } from "#/schemas.js";

type FetchSetItemsCategory<
  TContainedItemCategories extends ReadonlyArray<SetItemCategory> | undefined,
> =
  TContainedItemCategories extends ReadonlyArray<infer U>
    ? Extract<U, SetItemCategory>
    : SetItemCategory;

/**
Fetches and parses Set items from the OCHRE API

@param parameters - The parameters for the fetch
@param parameters.setScopeUuids - The Set scope UUIDs to filter by
@param parameters.queries - Recursive query tree used to filter matching items
@param parameters.sort - Optional sorting configuration applied before pagination.
For propertyValue sorting, dataType is required and the sort key uses the first valid leaf value (value[not(@i)]).
@param parameters.page - The page number (1-indexed)
@param parameters.pageSize - The number of items per page
@param containedItemCategories - The categories of the items to fetch
@param options - Options for the fetch
@param options.fetch - The fetch function to use
@returns The parsed Set items or null if the fetch/parse fails
*/
export async function fetchSetItems<
  const TContainedItemCategories extends
    | ReadonlyArray<SetItemCategory>
    | undefined = undefined,
  const TLanguages extends ReadonlyArray<string> | undefined = undefined,
>(
  parameters: {
    setScopeUuids: Array<string>;
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
          FetchSetItemsCategory<TContainedItemCategories>,
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
export async function fetchSetItems(
  parameters: {
    setScopeUuids: Array<string>;
    queries?: Query | null;
    sort?: SetItemsSort;
    page: number;
    pageSize?: number;
  },
  containedItemCategories?: ReadonlyArray<SetItemCategory>,
  options?: FetchRuntimeOptions,
): Promise<
  | {
      totalCount: number;
      page: number;
      pageSize: number;
      items: Array<SetItem<SetItemCategory, ReadonlyArray<string>>>;
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
      setScopeUuids,
      belongsToCollectionScopeUuids,
      queries,
      sort,
      page,
      pageSize,
    } = v.parse(setItemsParametersSchema, parameters);

    return {
      ...(await fetchContainerItems({
        container: "set",
        scopeUuids: setScopeUuids,
        belongsToCollectionScopeUuids,
        queries,
        sort,
        page,
        pageSize,
        containedItemCategories,
        label: "OCHRE Set items",
        options,
      })),
      error: null,
      detailedError: null,
    };
  } catch (error) {
    return {
      totalCount: null,
      page: null,
      pageSize: null,
      items: null,
      ...getErrorOutput(error, "Failed to fetch Set items"),
    };
  }
}
