import { XMLParser } from "fast-xml-parser";
import * as v from "valibot";
import type {
  FetchBaseOptions,
  FetchLanguages,
  ParserOptions,
} from "#/parsers/helpers.js";
import type { WebsiteMetadata } from "#/types/website.js";
import type { XMLWebsiteData } from "#/xml/types.js";
import { XML_PARSER_OPTIONS } from "#/constants.js";
import { parseStringLike } from "#/parsers/helpers.js";
import {
  parseIdentification,
  parseMetadataLanguages,
  parseSimplifiedProperties,
  resolveLanguages,
} from "#/parsers/index.js";
import { websitePresentationReader } from "#/parsers/website/reader.js";
import { iso639_3Schema } from "#/schemas.js";
import {
  createSchemaValidationError,
  getErrorOutput,
  stringLiteral,
} from "#/utilities.js";
import { restoreXMLMetadata } from "#/xml/metadata.js";
import { XMLWebsiteData as XMLWebsiteDataSchema } from "#/xml/schemas.js";

function parseWebsiteMetadata<T extends ReadonlyArray<string>>(
  data: XMLWebsiteData,
  options: ParserOptions<T>,
): WebsiteMetadata<T> {
  const rawOchre = data.result.ochre;
  const websiteTree = rawOchre.tree[0];

  if (websiteTree == null) {
    throw new Error("Website tree not found", { cause: data });
  }

  const identification = parseIdentification(
    websiteTree.identification,
    options,
  );
  const websiteName = identification.label.getText().trim();
  const metadataDescription = (
    parseStringLike(rawOchre.metadata.description) ?? ""
  ).trim();
  const properties = parseSimplifiedProperties(websiteTree.properties, options);
  const reader = websitePresentationReader(properties);

  const webpage = websiteTree.items?.resource?.[0] ?? null;
  const webpageTitle =
    webpage != null && "identification" in webpage
      ? parseIdentification(webpage.identification, options).label
      : null;

  return {
    uuid: websiteTree.uuid,
    belongsTo: {
      uuid: rawOchre.uuidBelongsTo,
      abbreviation: rawOchre.belongsTo,
    },
    identification,
    description:
      websiteName === ""
        ? metadataDescription
        : metadataDescription !== "" && metadataDescription !== websiteName
          ? `${websiteName} - ${metadataDescription}`
          : websiteName,
    webpageTitle,
    properties: {
      icon: {
        faviconUuid: reader.uuid("favicon-ico"),
        appleTouchIconUuid: reader.uuid("favicon-img"),
      },
    },
  };
}

function buildXQuery(parameters: {
  abbreviation: string;
  slug: string;
}): string {
  return String.raw`xquery version "1.0-ml";

declare function local:resource-items($resources) {
  for $resource in $resources
  return
    if ($resource/segments) then $resource
    else if ($resource/identification) then $resource
    else local:resource-items($resource/resource)
};

declare function local:presentation($resource) {
  string(($resource/properties/property[label/string() = "presentation"]/value)[1])
};

declare function local:clean-slug($slug) {
  replace(string($slug), "^\$[^-]*-", "")
};

declare function local:page-slug($resource, $slug-prefix) {
  let $slug := local:clean-slug($resource/@slug)
  return
    if ($slug-prefix = "") then $slug
    else if ($slug = "") then $slug-prefix
    else concat($slug-prefix, "/", $slug)
};

declare function local:matches-page-slug($resource, $target-slug, $slug-prefix) {
  local:page-slug($resource, $slug-prefix) = $target-slug
};

declare function local:page-child-slug-prefix($resource, $slug-prefix) {
  if ($slug-prefix = "") then ""
  else local:page-slug($resource, $slug-prefix)
};

declare function local:metadata-page($resource) {
  element resource {
    attribute uuid { string($resource/@uuid) },
    $resource/identification
  }
};

declare function local:matching-pages($resources, $target-slug, $slug-prefix) {
  for $resource in $resources
  let $children := local:resource-items($resource/resource)
  let $page-slug := local:page-slug($resource, $slug-prefix)
  let $child-slug-prefix := local:page-child-slug-prefix($resource, $slug-prefix)
  return (
    if (local:matches-page-slug($resource, $target-slug, $slug-prefix)) then
      local:metadata-page($resource)
    else (),
    local:matching-pages(
      $children[local:presentation(.) = "page"],
      $target-slug,
      $child-slug-prefix
    ),
    for $segment in $children[segments]/segments/tree
    return local:matching-pages(
      local:resource-items($segment/items/resource),
      $target-slug,
      $page-slug
    )
  )
};

declare function local:metadata-tree($tree, $target-slug, $slug-prefix) {
  let $resources := local:resource-items($tree/items/resource)
  let $icon-properties := $tree/properties/property[label/string() = "presentation"][value/string() = "website"]/property[label/string() = ("favicon-ico", "favicon-img")]
  return
    element tree {
      attribute uuid { string($tree/@uuid) },
      $tree/identification,
      if (empty($icon-properties)) then () else element properties { $icon-properties },
      element items {
        local:matching-pages(
          $resources[local:presentation(.) = "page"],
          $target-slug,
          $slug-prefix
        )
      }
    }
};

let $website := collection("ochre/tree")/ochre[tree/identification/abbreviation/content/string = ${stringLiteral(
    parameters.abbreviation,
  )}][1]
let $target-slug := ${stringLiteral(parameters.slug)}
return
  <ochre>{
    $website/@uuid,
    $website/@uuidBelongsTo,
    $website/@belongsTo,
    $website/@publicationDateTime,
    $website/@languages,
    $website/metadata,
    local:metadata-tree($website/tree[1], $target-slug, "")
  }</ochre>`;
}

/**
 * Fetches and parses a page-scoped website metadata projection from the OCHRE
 * API.
 */
export async function fetchWebsiteMetadata<
  const TLanguages extends ReadonlyArray<string> | undefined = undefined,
>(
  abbreviation: string,
  options: FetchBaseOptions<TLanguages> & { slug: string },
): Promise<
  | {
      websiteMetadata: WebsiteMetadata<FetchLanguages<TLanguages>>;
      error: null;
      detailedError: null;
    }
  | { websiteMetadata: null; error: string; detailedError: string }
>;
export async function fetchWebsiteMetadata(
  abbreviation: string,
  options?: FetchBaseOptions<ReadonlyArray<string>> & { slug?: string },
): Promise<
  | {
      websiteMetadata: WebsiteMetadata<ReadonlyArray<string>>;
      error: null;
      detailedError: null;
    }
  | { websiteMetadata: null; error: string; detailedError: string }
> {
  try {
    if (options?.slug == null) {
      throw new Error("Website metadata slug is required");
    }

    const cleanAbbreviation = abbreviation.trim().toLocaleLowerCase("en-US");
    const slug = options.slug.trim().replaceAll(/^\/+|\/+$/g, "");
    const requestedLanguages: Array<string> = Array.from(
      options.languages ?? [],
      (language) => v.parse(iso639_3Schema, language),
    );

    const response = await (options.fetch ?? fetch)(
      'https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?xquery&xsl=none&lang="*"',
      {
        method: "POST",
        body: buildXQuery({ abbreviation: cleanAbbreviation, slug }),
        headers: { "Content-Type": "application/xquery" },
      },
    );
    if (!response.ok) {
      throw new Error("Failed to fetch website metadata", {
        cause: response.statusText,
      });
    }

    const dataRaw = await response.text();
    const parser = new XMLParser(XML_PARSER_OPTIONS);
    const data = parser.parse(dataRaw) as unknown;

    const { success, issues, output } = v.safeParse(XMLWebsiteDataSchema, data);
    if (!success) {
      throw createSchemaValidationError(
        "Failed to parse website metadata XML",
        issues,
      );
    }
    restoreXMLMetadata(output, data);

    const metadataLanguages = parseMetadataLanguages(output.result.ochre);
    const languages = resolveLanguages(requestedLanguages, metadataLanguages);
    const websiteMetadata = parseWebsiteMetadata(output, { languages });

    return { websiteMetadata, error: null, detailedError: null };
  } catch (error) {
    return { websiteMetadata: null, ...getErrorOutput(error, "Unknown error") };
  }
}
