import type { ParserOptions } from "#/parsers/helpers.js";
import type { WebsitePageSlugs } from "#/parsers/website/slug.js";
import type {
  XMLWebsiteResource,
  XMLWebsiteResourceItem,
  XMLWebsiteTree,
} from "#/xml/types.js";
import { parseStringContent } from "#/parsers/helpers.js";
import { parseSimplifiedProperties } from "#/parsers/index.js";
import { formatXMLWebsiteResourceMetadata } from "#/parsers/website/messages.js";
import { websitePresentationReader } from "#/parsers/website/reader.js";
import {
  childSlugPrefix,
  cleanWebsitePageSlug,
  prefixSlug,
  WEBSITE_PAGE_SLUG_DECLARATIONS,
} from "#/parsers/website/slug.js";
import { stringLiteral } from "#/xquery.js";

/**
 * A page in a website, with its slug already resolved
 *
 * OCHRE stores a page's slug relative to the segment holding it, so the full
 * slug depends on the path taken to reach the page. That path is walked once,
 * here, and both the page parser and the slug map read the result instead of
 * each re-deriving it.
 * @internal
 */
export type WebsitePageNode = {
  resource: XMLWebsiteResource;
  slug: string;
  children: Array<WebsitePageNode>;
  segments: Array<{ tree: XMLWebsiteTree; slugPrefix: string }>;
};

/**
 * Flatten the wrapper elements OCHRE nests resources in
 *
 * A `<resource>` holding only more resources is grouping, not content. Note
 * that this drops segment wrappers, which carry neither an identification nor
 * a nested resource list; {@link readWebsitePages} picks those up separately,
 * because a segment becomes its own website rather than a resource.
 * @param resources - The raw resource items
 * @returns The identified resources, in source order
 * @internal
 */
export function normalizeWebsiteResources(
  resources: Array<XMLWebsiteResourceItem> | undefined,
): Array<XMLWebsiteResource> {
  const normalized: Array<XMLWebsiteResource> = [];
  const resourcesToNormalize = resources ?? [];
  for (const resource of resourcesToNormalize) {
    if ("identification" in resource) {
      normalized.push(resource);
      continue;
    }

    if ("resource" in resource) {
      normalized.push(...resource.resource);
    }
  }

  return normalized;
}

function readWebsiteSegments<T extends ReadonlyArray<string>>(
  resources: Array<XMLWebsiteResourceItem> | undefined,
  options: ParserOptions<T>,
  slugPrefix: string,
): WebsitePageNode["segments"] {
  const segments: WebsitePageNode["segments"] = [];
  const segmentResources = resources ?? [];

  for (const resource of segmentResources) {
    if (!("segments" in resource)) {
      continue;
    }

    for (const tree of resource.segments.tree) {
      const segmentSlug =
        tree.identification.abbreviation == null
          ? null
          : parseStringContent(tree.identification.abbreviation, options);
      if (segmentSlug == null) {
        throw new Error(
          `Slug not found for segment website (website uuid “${tree.uuid}”)`,
          { cause: tree },
        );
      }

      segments.push({ tree, slugPrefix: prefixSlug(segmentSlug, slugPrefix) });
    }
  }

  return segments;
}

/**
 * The pages directly under a set of resources, and everything under them
 *
 * Only pages carry routes, so this descends through pages and the segments
 * they hold and stops at anything else. Blocks and elements are the page's
 * content and are parsed by the page, not walked for further pages.
 * @param resources - The raw resource items to read
 * @param options - Parser options
 * @param slugPrefix - The slug of the enclosing segment, if any
 * @returns The page nodes, in source order
 * @internal
 */
export function readWebsitePages<T extends ReadonlyArray<string>>(
  resources: Array<XMLWebsiteResourceItem> | undefined,
  options: ParserOptions<T>,
  slugPrefix?: string,
): Array<WebsitePageNode> {
  const pages: Array<WebsitePageNode> = [];

  for (const resource of normalizeWebsiteResources(resources)) {
    const properties = parseSimplifiedProperties(resource.properties, options);
    if (
      websitePresentationReader(properties).value("presentation") !== "page"
    ) {
      continue;
    }

    const slug = cleanWebsitePageSlug(resource.slug);
    if (slug == null) {
      throw new Error(
        `Slug not found for page (${formatXMLWebsiteResourceMetadata(resource)})`,
        { cause: resource },
      );
    }

    const pageSlug = prefixSlug(slug, slugPrefix);
    pages.push({
      resource,
      slug: pageSlug,
      children: readWebsitePages(
        resource.resource,
        options,
        childSlugPrefix(pageSlug, slugPrefix),
      ),
      segments: readWebsiteSegments(resource.resource, options, pageSlug),
    });
  }

  return pages;
}

/**
 * Every page's full slug, keyed by UUID, including pages inside segments
 * @param pages - The page nodes to collect from
 * @param options - Parser options
 * @param pageSlugsByUuid - The map to fill, for the recursive calls
 * @returns The filled map
 * @internal
 */
export function collectWebsitePageSlugs<T extends ReadonlyArray<string>>(
  pages: ReadonlyArray<WebsitePageNode>,
  options: ParserOptions<T>,
  pageSlugsByUuid = new Map<string, string>(),
): WebsitePageSlugs {
  for (const page of pages) {
    pageSlugsByUuid.set(page.resource.uuid, page.slug);
    collectWebsitePageSlugs(page.children, options, pageSlugsByUuid);

    for (const segment of page.segments) {
      collectWebsitePageSlugs(
        readWebsitePages(
          segment.tree.items?.resource,
          options,
          segment.slugPrefix,
        ),
        options,
        pageSlugsByUuid,
      );
    }
  }

  return pageSlugsByUuid;
}

/**
 * The XQuery counterpart of {@link normalizeWebsiteResources} and the page
 * descent in {@link readWebsitePages}
 *
 * Declares `local:resource-items`, `local:presentation` and, from
 * {@link WEBSITE_PAGE_SLUG_DECLARATIONS}, the slug rules. Segment wrappers are
 * kept here rather than dropped, because the caller filters for pages by
 * presentation and reads segments off the same sequence.
 * @internal
 */
export const WEBSITE_WALK_DECLARATIONS = `declare function local:resource-items($resources) {
  for $resource in $resources
  return
    if ($resource/segments) then $resource
    else if ($resource/identification) then $resource
    else local:resource-items($resource/resource)
};

declare function local:presentation($resource) {
  string(($resource/properties/property[label/string() = ${stringLiteral(
    "presentation",
  )}]/value)[1])
};

${WEBSITE_PAGE_SLUG_DECLARATIONS}`;
