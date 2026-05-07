import { XMLParser } from "fast-xml-parser";
import * as v from "valibot";
import type {
  DataCategory,
  HierarchyDataCategory,
  HierarchyItemCategoryFromOption,
  HierarchyItemCategoryOption,
  HierarchyItemDataCategory,
  Item,
  SetItemDataCategory,
} from "#/types/index.js";
import type { XMLData } from "#/types/xml/types.js";
import { DEFAULT_LANGUAGES, XML_PARSER_OPTIONS } from "#/constants.js";
import { parseItem } from "#/parsers/index.js";
import { iso639_3Schema, uuidSchema } from "#/schemas.js";
import { XMLData as XMLDataSchema } from "#/types/xml/schemas.js";
import { logIssues } from "#/utils.js";

/**
 * Branded type to ensure languages have been validated through withLanguages()
 * @internal
 */
export type ValidatedLanguages<T extends ReadonlyArray<string>> = T & {
  readonly __validated: unique symbol;
};

type FetchFunction = (
  input: string | URL | globalThis.Request,
  init?: RequestInit,
) => Promise<Response>;

type FetchItemBaseOptions<
  TLanguages extends ValidatedLanguages<ReadonlyArray<string>> | undefined =
    undefined,
> = { languages?: TLanguages; isRichText?: boolean; fetch?: FetchFunction };

type FetchItemRuntimeOptions = FetchItemBaseOptions<
  ValidatedLanguages<ReadonlyArray<string>>
> & {
  category?: DataCategory;
  itemCategory?: HierarchyItemCategoryOption<DataCategory>;
};

function isHierarchyCategory(
  category: DataCategory,
): category is HierarchyDataCategory {
  return category === "tree" || category === "set";
}

function assertItemCategoryAllowed(
  category: DataCategory | undefined,
  itemCategory: HierarchyItemCategoryOption<DataCategory> | undefined,
): void {
  if (
    category == null ||
    itemCategory == null ||
    isHierarchyCategory(category)
  ) {
    return;
  }

  throw new Error(
    `itemCategory can only be used when category is "tree" or "set"; received category "${category}"`,
  );
}

function normalizeFetchedCategory(
  category: string | undefined,
): DataCategory | null {
  switch (category) {
    case "tree":
    case "bibliography":
    case "concept":
    case "spatialUnit":
    case "period":
    case "person":
    case "propertyVariable":
    case "propertyValue":
    case "resource":
    case "text":
    case "set": {
      return category;
    }
    case "variable": {
      return "propertyVariable";
    }
    case "value": {
      return "propertyValue";
    }
    default: {
      return null;
    }
  }
}

function inferFetchItemCategory(
  rawOchre: XMLData["result"]["ochre"],
): DataCategory {
  const metadataCategory = normalizeFetchedCategory(
    rawOchre.metadata.item?.category,
  );
  if (metadataCategory != null) {
    return metadataCategory;
  }

  if ("tree" in rawOchre) return "tree";
  if ("bibliography" in rawOchre) return "bibliography";
  if ("concept" in rawOchre) return "concept";
  if ("spatialUnit" in rawOchre) return "spatialUnit";
  if ("period" in rawOchre) return "period";
  if ("person" in rawOchre) return "person";
  if ("propertyVariable" in rawOchre || "variable" in rawOchre) {
    return "propertyVariable";
  }
  if ("propertyValue" in rawOchre || "value" in rawOchre) {
    return "propertyValue";
  }
  if ("resource" in rawOchre) return "resource";
  if ("text" in rawOchre) return "text";
  if ("set" in rawOchre) return "set";

  throw new Error("Could not infer OCHRE item category");
}

/**
 * Helper function to create a languages array with proper type inference
 * @param languages - Array of language codes
 * @returns The same array with preserved literal types and validation branding
 */
export function withLanguages<const T extends ReadonlyArray<string>>(
  languages: T,
): ValidatedLanguages<T> {
  const parsedLanguages = [];
  for (const language of languages) {
    parsedLanguages.push(v.parse(iso639_3Schema, language));
  }

  return parsedLanguages as unknown as ValidatedLanguages<T>;
}

/**
 * Fetches an OCHRE item by UUID from the OCHRE API
 *
 * @param uuid - The UUID of the OCHRE item to fetch
 * @param options - Required options object
 * @param options.category - The category of the OCHRE item to fetch
 * @param options.itemCategory - The category of items inside the OCHRE item to fetch. Only valid for Trees and Sets. Tree accepts one category; Set accepts one category or an array.
 * @param options.languages - The languages to use ***(must be created with withLanguages())***
 * @param options.isRichText - Whether to parse the text as rich text
 * @param options.fetch - Custom fetch function to use instead of the default fetch
 * @returns An object containing the parsed item
 */
export async function fetchItem<
  const TItemCategory extends
    | HierarchyItemCategoryOption<HierarchyDataCategory>
    | undefined = undefined,
  const TLanguages extends
    | ValidatedLanguages<ReadonlyArray<string>>
    | undefined = undefined,
>(
  uuid: string,
  options?: FetchItemBaseOptions<TLanguages> & {
    category?: undefined;
    itemCategory?: TItemCategory;
  },
): Promise<
  | {
      item: Item<
        DataCategory,
        HierarchyItemCategoryFromOption<DataCategory, TItemCategory>,
        TLanguages extends ValidatedLanguages<infer U> ? U
        : ReadonlyArray<string>
      >;
      error: null;
    }
  | { item: null; error: string }
>;
export async function fetchItem<
  const TCategory extends HierarchyDataCategory,
  const TItemCategory extends
    | HierarchyItemCategoryOption<TCategory>
    | undefined = undefined,
  const TLanguages extends
    | ValidatedLanguages<ReadonlyArray<string>>
    | undefined = undefined,
>(
  uuid: string,
  options: FetchItemBaseOptions<TLanguages> & {
    category: TCategory;
    itemCategory?: TItemCategory;
  },
): Promise<
  | {
      item: Item<
        TCategory,
        HierarchyItemCategoryFromOption<TCategory, TItemCategory>,
        TLanguages extends ValidatedLanguages<infer U> ? U
        : ReadonlyArray<string>
      >;
      error: null;
    }
  | { item: null; error: string }
>;
export async function fetchItem<
  const TCategory extends DataCategory,
  const TLanguages extends
    | ValidatedLanguages<ReadonlyArray<string>>
    | undefined = undefined,
>(
  uuid: string,
  options: FetchItemBaseOptions<TLanguages> & {
    category: TCategory;
    itemCategory?: never;
  },
): Promise<
  | {
      item: Item<
        TCategory,
        HierarchyItemDataCategory<TCategory>,
        TLanguages extends ValidatedLanguages<infer U> ? U
        : ReadonlyArray<string>
      >;
      error: null;
    }
  | { item: null; error: string }
>;
export async function fetchItem(
  uuid: string,
  options?: FetchItemRuntimeOptions,
): Promise<
  | {
      item: Item<DataCategory, SetItemDataCategory, ReadonlyArray<string>>;
      error: null;
    }
  | { item: null; error: string }
> {
  try {
    const parsedUuid = v.parse(uuidSchema, uuid);
    assertItemCategoryAllowed(options?.category, options?.itemCategory);

    const response = await (options?.fetch ?? fetch)(
      `https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?uuid=${parsedUuid}&xsl=none&lang="*"`,
    );
    if (!response.ok) {
      throw new Error("Failed to fetch OCHRE data");
    }

    const dataRaw = await response.text();

    const parser = new XMLParser(XML_PARSER_OPTIONS);
    const data = parser.parse(dataRaw) as unknown;

    const { success, issues, output } = v.safeParse(XMLDataSchema, data);
    if (!success) {
      logIssues(issues);
      throw new Error("Failed to parse OCHRE data");
    }

    const category =
      options?.category ?? inferFetchItemCategory(output.result.ochre);
    assertItemCategoryAllowed(category, options?.itemCategory);

    const parsedItem = parseItem(output, {
      category,
      itemCategory: options?.itemCategory,
      languages: options?.languages ?? DEFAULT_LANGUAGES,
      isRichText: options?.isRichText ?? false,
    });

    return { item: parsedItem, error: null };
  } catch (error) {
    console.error(error);
    return {
      item: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
