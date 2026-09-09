import type {
  FetchBaseOptions,
  FetchLanguages,
  ParserOptions,
} from "#/parsers/helpers.js";
import type { WebsiteMetadata } from "#/types/website.js";
import type { XMLWebsiteData } from "#/xml/types.js";
import { getErrorOutput } from "#/errors.js";
import { requestOchre } from "#/fetchers/request.js";
import { parseStringLike } from "#/parsers/helpers.js";
import {
  parseIdentification,
  parseSimplifiedProperties,
} from "#/parsers/index.js";
import {
  parseMetadataLanguages,
  parseRequestedLanguages,
  resolveLanguages,
} from "#/parsers/languages.js";
import { websitePresentationReader } from "#/parsers/website/reader.js";
import { WEBSITE_WALK_DECLARATIONS } from "#/parsers/website/walk.js";
import { XMLWebsiteData as XMLWebsiteDataSchema } from "#/xml/schemas.js";
import { compileOchreQuery, stringLiteral } from "#/xquery.js";

/**
 * The presentation properties the metadata projection carries
 *
 * The XQuery whitelists exactly these labels and the parser reads exactly
 * these labels, so they come from one list: whitelisting a label the parser
 * ignores is dead weight, and reading one the whitelist drops silently yields
 * the default.
 */
const METADATA_PRESENTATION_LABELS = {
  privacy: "privacy",
  faviconIco: "favicon-ico",
  faviconImg: "favicon-img",
} as const;

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
      privacy: reader.valueOr<WebsiteMetadata<T>["properties"]["privacy"]>(
        METADATA_PRESENTATION_LABELS.privacy,
        "public",
      ),
      icon: {
        faviconUuid: reader.uuid(METADATA_PRESENTATION_LABELS.faviconIco),
        appleTouchIconUuid: reader.uuid(
          METADATA_PRESENTATION_LABELS.faviconImg,
        ),
      },
    },
  };
}

function buildXQuery(parameters: {
  abbreviation: string;
  slug: string;
}): string {
  return compileOchreQuery({
    declarations: [
      `${WEBSITE_WALK_DECLARATIONS}
declare function local:matches-page-slug($resource, $target-slug, $slug-prefix) {
  local:page-slug($resource, $slug-prefix) = $target-slug
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
  let $presentation-properties := $tree/properties/property[label/string() = "presentation"][value/string() = "website"]/property[label/string() = (${Object.values(
    METADATA_PRESENTATION_LABELS,
  )
    .map((label) => stringLiteral(label))
    .join(", ")})]
  return
    element tree {
      attribute uuid { string($tree/@uuid) },
      $tree/identification,
      if (empty($presentation-properties)) then () else element properties { $presentation-properties },
      element items {
        local:matching-pages(
          $resources[local:presentation(.) = "page"],
          $target-slug,
          $slug-prefix
        )
      }
    }
};

`,
    ],
    body: ({
      omitSupplemental,
    }) => `let $website := collection("ochre/tree")/ochre[tree/identification/abbreviation/content/string = ${stringLiteral(
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
    ${omitSupplemental(`(
      $website/metadata,
      local:metadata-tree($website/tree[1], $target-slug, "")
    )`)}
  }</ochre>`,
  });
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
    const requestedLanguages = parseRequestedLanguages(options.languages);

    const output = await requestOchre({
      xquery: buildXQuery({ abbreviation: cleanAbbreviation, slug }),
      schema: XMLWebsiteDataSchema,
      label: "OCHRE website metadata",
      options,
    });

    const metadataLanguages = parseMetadataLanguages(output.result.ochre);
    const languages = resolveLanguages(requestedLanguages, metadataLanguages);
    const websiteMetadata = parseWebsiteMetadata(output, { languages });

    return { websiteMetadata, error: null, detailedError: null };
  } catch (error) {
    return { websiteMetadata: null, ...getErrorOutput(error, "Unknown error") };
  }
}
