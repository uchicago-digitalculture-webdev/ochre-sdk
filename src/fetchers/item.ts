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
import type { XMLData } from "#/xml/types.js";
import { XML_PARSER_OPTIONS } from "#/constants.js";
import { parseItem } from "#/parsers/index.js";
import { iso639_3Schema, uuidSchema } from "#/schemas.js";
import { logIssues } from "#/utils.js";
import { XMLData as XMLDataSchema } from "#/xml/schemas.js";

type FetchFunction = (
  input: string | URL | globalThis.Request,
  init?: RequestInit,
) => Promise<Response>;

type FetchItemBaseOptions<
  TLanguages extends ReadonlyArray<string> | undefined = undefined,
> = { languages?: TLanguages; isRichText?: boolean; fetch?: FetchFunction };

type FetchItemRuntimeOptions = FetchItemBaseOptions<ReadonlyArray<string>> & {
  category?: DataCategory;
  itemCategory?: HierarchyItemCategoryOption<DataCategory>;
};

type FetchItemLanguages<TLanguages extends ReadonlyArray<string> | undefined> =
  TLanguages extends readonly [] ? ReadonlyArray<string>
  : TLanguages extends ReadonlyArray<string> ? TLanguages
  : ReadonlyArray<string>;

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
 * Validate language codes while preserving literal tuple inference.
 */
function parseLanguages<const T extends ReadonlyArray<string>>(
  languages: T,
): T {
  const parsedLanguages: Array<string> = [];
  for (const language of languages) {
    parsedLanguages.push(v.parse(iso639_3Schema, language));
  }

  return parsedLanguages as unknown as T;
}

/**
 * Defines a reusable languages tuple with validation and literal type inference.
 *
 * Inline arrays can be passed directly to fetchItem:
 * `fetchItem(uuid, { languages: ["eng", "spa"] })`.
 *
 * Use this helper when the language set is stored separately:
 * `const languages = defineLanguages("eng", "spa")`.
 */
export function defineLanguages<const TLanguages extends ReadonlyArray<string>>(
  ...languages: TLanguages
): TLanguages {
  return parseLanguages(languages);
}

/**
 * @deprecated Pass inline language arrays directly to fetchItem, or use
 * defineLanguages("eng", "spa") for reusable language tuples.
 */
export function withLanguages<const TLanguages extends ReadonlyArray<string>>(
  languages: TLanguages,
): TLanguages {
  return parseLanguages(languages);
}

/**
 * Fetches an OCHRE item by UUID from the OCHRE API
 *
 * @param uuid - The UUID of the OCHRE item to fetch
 * @param options - Required options object
 * @param options.category - The category of the OCHRE item to fetch
 * @param options.itemCategory - The category of items inside the OCHRE item to fetch. Only valid for Trees and Sets. Tree accepts one category; Set accepts one category or an array.
 * @param options.languages - Language codes to parse. Inline arrays preserve literal types automatically.
 * @param options.isRichText - Whether to parse the text as rich text
 * @param options.fetch - Custom fetch function to use instead of the default fetch
 * @returns An object containing the parsed item
 */
export async function fetchItem<
  const TItemCategory extends
    | HierarchyItemCategoryOption<HierarchyDataCategory>
    | undefined = undefined,
  const TLanguages extends ReadonlyArray<string> | undefined = undefined,
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
        FetchItemLanguages<TLanguages>
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
  const TLanguages extends ReadonlyArray<string> | undefined = undefined,
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
        FetchItemLanguages<TLanguages>
      >;
      error: null;
    }
  | { item: null; error: string }
>;
export async function fetchItem<
  const TCategory extends DataCategory,
  const TLanguages extends ReadonlyArray<string> | undefined = undefined,
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
        FetchItemLanguages<TLanguages>
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
    const languages: ReadonlyArray<string> =
      options?.languages == null ? [] : parseLanguages(options.languages);

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
      languages,
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
