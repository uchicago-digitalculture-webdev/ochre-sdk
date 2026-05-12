import { XMLParser } from "fast-xml-parser";
import * as v from "valibot";
import type { Gallery } from "#/types/index.js";
import type { XMLGalleryData } from "#/xml/types.js";
import { DEFAULT_LANGUAGES, XML_PARSER_OPTIONS } from "#/constants.js";
import { parseGallery } from "#/parsers/index.js";
import { gallerySchema, iso639_3Schema } from "#/schemas.js";
import { logIssues, stringLiteral } from "#/utils.js";
import { XMLGalleryData as XMLGalleryDataSchema } from "#/xml/schemas.js";

type FetchFunction = (
  input: string | URL | globalThis.Request,
  init?: RequestInit,
) => Promise<Response>;

type FetchGalleryBaseOptions<
  TLanguages extends ReadonlyArray<string> | undefined = undefined,
> = { languages?: TLanguages; fetch?: FetchFunction };

type FetchGalleryRuntimeOptions = FetchGalleryBaseOptions<
  ReadonlyArray<string>
>;

type FetchGalleryLanguages<
  TLanguages extends ReadonlyArray<string> | undefined,
> = TLanguages extends readonly []
  ? ReadonlyArray<string>
  : TLanguages extends ReadonlyArray<string>
    ? TLanguages
    : ReadonlyArray<string>;

function parseLanguages<const T extends ReadonlyArray<string>>(
  languages: T,
): T {
  const parsedLanguages: Array<string> = [];
  for (const language of languages) {
    parsedLanguages.push(v.parse(iso639_3Schema, language));
  }

  return parsedLanguages as unknown as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function collectContentLanguages(value: unknown, languages: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectContentLanguages(item, languages);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const content = value.content;
  if (Array.isArray(content)) {
    for (const contentItem of content) {
      if (!isRecord(contentItem)) {
        continue;
      }

      const language = contentItem.lang;
      if (typeof language === "string" && language !== "zxx") {
        languages.add(language);
      }
    }
  }

  for (const child of Object.values(value)) {
    collectContentLanguages(child, languages);
  }
}

function resolveGalleryLanguages(
  data: XMLGalleryData,
  requestedLanguages: ReadonlyArray<string>,
): ReadonlyArray<string> {
  if (requestedLanguages.length > 0) {
    return requestedLanguages;
  }

  const languages = new Set<string>();
  collectContentLanguages(data.result.ochre.gallery, languages);

  return languages.size > 0 ? [...languages] : [...DEFAULT_LANGUAGES];
}

function buildXQuery(params: {
  uuid: string;
  filter: string | undefined;
  page: number;
  perPage: number;
}): string {
  const { uuid, filter, page, perPage } = params;
  const start = (page - 1) * perPage + 1;
  const filterLiteral = stringLiteral(filter?.trim() ?? "");

  return `<ochre>{
  for $q in doc()/ochre[@uuid=${stringLiteral(uuid)}]
  let $filter := ${filterLiteral}
  let $resources := $q//items/resource
  let $filtered :=
    if ($filter = "")
    then $resources
    else $resources[contains(lower-case(string-join(identification/label//text(), "")), lower-case($filter))]
  let $maxLength := count($filtered)
  return <gallery maxLength="{$maxLength}">{
    $q/metadata/project,
    $q/metadata/item,
    subsequence($filtered, ${start}, ${perPage})
  }</gallery>
}</ochre>`;
}

/**
 * Fetches and parses a gallery from the OCHRE API
 *
 * @param params - The parameters for the fetch
 * @param params.uuid - The UUID of the gallery
 * @param params.filter - The filter to apply to the gallery
 * @param params.page - The page number to fetch
 * @param params.perPage - The number of items per page
 * @param options - The options for the fetch
 * @param options.languages - Language codes to parse. Inline arrays preserve literal types automatically.
 * @param options.fetch - The fetch function to use
 * @returns The parsed gallery or an error message if the fetch/parse fails
 */
export async function fetchGallery<
  const TLanguages extends ReadonlyArray<string> | undefined = undefined,
>(
  params: { uuid: string; filter?: string; page: number; perPage: number },
  options?: FetchGalleryBaseOptions<TLanguages>,
): Promise<
  | { gallery: Gallery<FetchGalleryLanguages<TLanguages>>; error: null }
  | { gallery: null; error: string }
>;
export async function fetchGallery(
  params: { uuid: string; filter?: string; page: number; perPage: number },
  options?: FetchGalleryRuntimeOptions,
): Promise<
  | { gallery: Gallery<ReadonlyArray<string>>; error: null }
  | { gallery: null; error: string }
> {
  try {
    const { uuid, filter, page, perPage } = v.parse(gallerySchema, params);
    const requestedLanguages: ReadonlyArray<string> =
      options?.languages == null ? [] : parseLanguages(options.languages);

    const response = await (options?.fetch ?? fetch)(
      'https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?xquery&xsl=none&lang="*"',
      {
        method: "POST",
        body: buildXQuery({ uuid, filter, page, perPage }),
        headers: { "Content-Type": "application/xquery" },
      },
    );
    if (!response.ok) {
      throw new Error("Error fetching gallery items, please try again later.");
    }

    const dataRaw = await response.text();
    const parser = new XMLParser(XML_PARSER_OPTIONS);
    const data = parser.parse(dataRaw) as unknown;

    const { success, issues, output } = v.safeParse(XMLGalleryDataSchema, data);
    if (!success) {
      logIssues(issues);
      throw new Error("Failed to parse gallery XML");
    }

    const languages = resolveGalleryLanguages(output, requestedLanguages);
    const gallery = parseGallery(output, { languages });

    return { gallery, error: null };
  } catch (error) {
    console.error(error);
    return {
      gallery: null,
      error: error instanceof Error ? error.message : "Failed to fetch gallery",
    };
  }
}
