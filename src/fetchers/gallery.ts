/* eslint-disable unicorn/no-incorrect-template-string-interpolation */
import * as v from "valibot";
import type {
  FetchBaseOptions,
  FetchLanguages,
  FetchRuntimeOptions,
} from "#/parsers/helpers.js";
import type { Gallery } from "#/types/index.js";
import { getErrorOutput } from "#/errors.js";
import { requestOchre } from "#/fetchers/request.js";
import { parseGallery } from "#/parsers/index.js";
import {
  parseRequestedLanguages,
  resolveContentLanguages,
} from "#/parsers/languages.js";
import { gallerySchema } from "#/schemas.js";
import { XMLGalleryData as XMLGalleryDataSchema } from "#/xml/schemas.js";
import { compileOchreQuery, stringLiteral } from "#/xquery.js";

function buildXQuery(parameters: {
  uuid: string;
  filter: string | undefined;
  page: number;
  perPage: number;
}): string {
  const { uuid, filter, page, perPage } = parameters;
  const start = (page - 1) * perPage + 1;
  const filterLiteral = stringLiteral(filter?.trim() ?? "");

  return compileOchreQuery({
    body: ({ omitSupplemental }) => `<ochre>{
  for $q in doc()/ochre[@uuid=${stringLiteral(uuid)}]
  let $filter := ${filterLiteral}
  let $resources := $q//items/resource
  let $filtered :=
    if ($filter = "")
    then $resources
    else $resources[contains(lower-case(string-join(identification/label//text(), "")), lower-case($filter))]
  let $maxLength := count($filtered)
  return <gallery maxLength="{$maxLength}">{
    ${omitSupplemental(`(
      $q/metadata/project,
      $q/metadata/item,
      subsequence($filtered, ${start}, ${perPage})
    )`)}
  }</gallery>
}</ochre>`,
  });
}

/**
 * Fetches and parses a gallery from the OCHRE API
 *
 * @param parameters - The parameters for the fetch
 * @param parameters.uuid - The UUID of the gallery
 * @param parameters.filter - The filter to apply to the gallery
 * @param parameters.page - The page number to fetch
 * @param parameters.perPage - The number of items per page
 * @param options - The options for the fetch
 * @param options.languages - Language codes to parse. Inline arrays preserve literal types automatically.
 * @param options.fetch - The fetch function to use
 * @returns The parsed gallery or an error message if the fetch/parse fails
 */
export async function fetchGallery<
  const TLanguages extends ReadonlyArray<string> | undefined = undefined,
>(
  parameters: { uuid: string; filter?: string; page: number; perPage: number },
  options?: FetchBaseOptions<TLanguages>,
): Promise<
  | {
      gallery: Gallery<FetchLanguages<TLanguages>>;
      error: null;
      detailedError: null;
    }
  | { gallery: null; error: string; detailedError: string }
>;
export async function fetchGallery(
  parameters: { uuid: string; filter?: string; page: number; perPage: number },
  options?: FetchRuntimeOptions,
): Promise<
  | {
      gallery: Gallery<ReadonlyArray<string>>;
      error: null;
      detailedError: null;
    }
  | { gallery: null; error: string; detailedError: string }
> {
  try {
    const { uuid, filter, page, perPage } = v.parse(gallerySchema, parameters);
    const requestedLanguages = parseRequestedLanguages(options?.languages);

    const output = await requestOchre({
      xquery: buildXQuery({ uuid, filter, page, perPage }),
      schema: XMLGalleryDataSchema,
      label: "OCHRE gallery",
      options,
    });

    const languages = resolveContentLanguages(
      output.result.ochre.gallery,
      requestedLanguages,
    );
    const gallery = parseGallery(output, { languages });

    return { gallery, error: null, detailedError: null };
  } catch (error) {
    return {
      gallery: null,
      ...getErrorOutput(error, "Failed to fetch OCHRE gallery"),
    };
  }
}
