import * as v from "valibot";
import type { FetchBaseOptions, FetchLanguages } from "#/parsers/helpers.js";
import type {
  ContainedItemCategoryFromOption,
  ContainedItemCategoryOption,
  Item,
  ItemCategory,
  ItemContainerCategory,
} from "#/types/index.js";
import {
  ITEM_CATEGORY_ALIASES,
  OCHRE_COLLECTION_CATEGORIES,
} from "#/categories.js";
import { requestOchre } from "#/fetchers/request.js";
import { parseLinkedItems } from "#/parsers/index.js";
import {
  parseRequestedLanguages,
  resolveContentLanguages,
} from "#/parsers/languages.js";
import { uuidSchema } from "#/schemas.js";
import {
  getErrorOutput,
  omitSupplemental,
  stringLiteral,
  SUPPLEMENTAL_XQUERY_PROLOG,
} from "#/utilities.js";
import { XMLItemLinksData as XMLItemLinksDataSchema } from "#/xml/schemas.js";

/**
 * Build an XQuery string to fetch linked items from the OCHRE API.
 *
 * @param uuid - The UUID of the OCHRE item whose links should be fetched
 * @returns An XQuery string
 */
function buildXQuery(uuid: string): string {
  const linkedItemBranches = OCHRE_COLLECTION_CATEGORIES.map((category) => {
    const aliasTest = ITEM_CATEGORY_ALIASES[category]
      .map((alias) => `$category = ${stringLiteral(alias)}`)
      .join(" or ");

    return `if (${aliasTest}) then fn:collection("ochre/${category}")/ochre/${category}[@uuid = $uuid]`;
  });

  const linkedItems = `for $link at $position in $link-nodes
      let $uuid := $link/@uuid/string()
      let $category := name($link)
      where $uuid ne "" and not($uuid = $link-nodes[position() lt $position]/@uuid/string())
      return
        ${linkedItemBranches.join("\n        else ")}
        else ()`;

  const xquery = `let $item-uuid := ${stringLiteral(uuid)}

let $source-items := (
${OCHRE_COLLECTION_CATEGORIES.map((category) => `  fn:collection("ochre/${category}")/ochre[@uuid = $item-uuid]/${category}`).join(",\n")}
)

let $link-nodes := (
  $source-items/links/*,
  $source-items/observations/observation/links/*,
  $source-items/interpretations/interpretation/links/*
)

return
    <items>{
      ${omitSupplemental(linkedItems)}
    }</items>`;

  return `xquery version "1.0-ml";

${SUPPLEMENTAL_XQUERY_PROLOG}

<ochre>{${xquery}}</ochre>`;
}

/**
 * Fetches linked OCHRE items by source-item UUID.
 *
 * @param uuid - The UUID of the OCHRE item whose linked items should be fetched
 * @param options - Fetch and parser options
 * @param options.containedItemCategory - The category of items inside linked Trees/Sets to parse. Tree accepts one category; Set accepts one category or an array.
 * @param options.languages - Language codes to parse. Inline arrays preserve literal types automatically.
 * @param options.fetch - Custom fetch function to use instead of the default fetch
 * @returns An object containing parsed linked items
 */
export async function fetchItemLinks<
  const TContainedItemCategory extends
    | ContainedItemCategoryOption<ItemContainerCategory>
    | undefined = undefined,
  const TLanguages extends ReadonlyArray<string> | undefined = undefined,
>(
  uuid: string,
  options?: FetchBaseOptions<TLanguages> & {
    containedItemCategory?: TContainedItemCategory;
  },
): Promise<
  | {
      items: Array<
        Item<
          ItemCategory,
          ContainedItemCategoryFromOption<ItemCategory, TContainedItemCategory>,
          FetchLanguages<TLanguages>,
          "embedded"
        >
      >;
      error: null;
      detailedError: null;
    }
  | { items: null; error: string; detailedError: string }
>;
export async function fetchItemLinks(
  uuid: string,
  options?: FetchBaseOptions<ReadonlyArray<string>> & {
    containedItemCategory?: ContainedItemCategoryOption<ItemCategory>;
  },
): Promise<
  | {
      items: Array<
        Item<ItemCategory, ItemCategory, ReadonlyArray<string>, "embedded">
      >;
      error: null;
      detailedError: null;
    }
  | { items: null; error: string; detailedError: string }
> {
  try {
    const parsedUuid = v.parse(uuidSchema, uuid);
    const requestedLanguages = parseRequestedLanguages(options?.languages);

    const output = await requestOchre({
      xquery: buildXQuery(parsedUuid),
      schema: XMLItemLinksDataSchema,
      label: "OCHRE item links",
      options,
    });

    const languages = resolveContentLanguages(
      output.result.ochre.items,
      requestedLanguages,
    );
    const items = parseLinkedItems(output.result.ochre.items, {
      containedItemCategory: options?.containedItemCategory,
      languages,
    });

    return { items, error: null, detailedError: null };
  } catch (error) {
    return { items: null, ...getErrorOutput(error, "Unknown error") };
  }
}
