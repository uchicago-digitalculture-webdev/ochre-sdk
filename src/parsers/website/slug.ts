/**
 * How a website page slug is built
 *
 * The rule runs in two places: here, while parsing a website, and inside the
 * website metadata fetcher's XQuery, which resolves a slug to a page without
 * shipping the whole tree. Both adapters live in this module so the rule
 * cannot drift. The only difference between them is how "no prefix" is
 * spelled: `undefined` in TypeScript, the empty string in XQuery, which has no
 * way to pass an absent argument.
 */

import { stringLiteral } from "#/xquery.js";

/**
 * The prefix OCHRE puts on a segment page's slug to keep it unique
 */
export const SEGMENT_UNIQUE_SLUG_PREFIX_PATTERN = String.raw`^\$[^-]*-`;

/**
 * The separator between a slug and its prefix
 */
export const WEBSITE_PAGE_SLUG_SEPARATOR = "/";

const SEGMENT_UNIQUE_SLUG_PREFIX_REGEX = new RegExp(
  SEGMENT_UNIQUE_SLUG_PREFIX_PATTERN,
);

/**
 * The full slug of every page in a website, keyed by the page's UUID
 *
 * Resolved before parsing begins, because a link on any page can point at any
 * other page and the target's slug depends on where that target sits in the
 * tree.
 * @internal
 */
export type WebsitePageSlugs = ReadonlyMap<string, string>;

/**
 * Strip the uniqueness prefix from a website page slug
 * @param slug - The raw slug
 * @returns The cleaned slug, or null when there was none
 * @internal
 */
export function cleanWebsitePageSlug(slug: string | undefined): string | null {
  return slug?.replace(SEGMENT_UNIQUE_SLUG_PREFIX_REGEX, "") ?? null;
}

/**
 * Join a website page slug onto the slug of the segment holding it
 * @param slug - The page slug
 * @param slugPrefix - The slug of the enclosing segment, if any
 * @returns The full slug
 * @internal
 */
export function prefixSlug(
  slug: string,
  slugPrefix: string | undefined,
): string {
  if (slugPrefix === "" || slugPrefix == null) {
    return slug;
  }

  if (slug === "") {
    return slugPrefix;
  }

  return `${slugPrefix}${WEBSITE_PAGE_SLUG_SEPARATOR}${slug}`;
}

/**
 * The slug a page gives its own child pages
 *
 * A page only prefixes its children once it is itself inside a segment, so a
 * top-level website keeps flat page slugs.
 * @param pageSlug - The page's own full slug
 * @param slugPrefix - The prefix the page was resolved with
 * @returns The prefix for the page's children, or undefined for no prefix
 * @internal
 */
export function childSlugPrefix(
  pageSlug: string,
  slugPrefix: string | undefined,
): string | undefined {
  return slugPrefix == null ? undefined : pageSlug;
}

/**
 * The XQuery counterpart of {@link cleanWebsitePageSlug},
 * {@link prefixSlug} and {@link childSlugPrefix}
 *
 * Declares `local:clean-slug`, `local:page-slug` and
 * `local:page-child-slug-prefix`. "No prefix" is the empty string here.
 * @internal
 */
export const WEBSITE_PAGE_SLUG_DECLARATIONS = `declare function local:clean-slug($slug) {
  replace(string($slug), ${stringLiteral(SEGMENT_UNIQUE_SLUG_PREFIX_PATTERN)}, "")
};

declare function local:page-slug($resource, $slug-prefix) {
  let $slug := local:clean-slug($resource/@slug)
  return
    if ($slug-prefix = "") then $slug
    else if ($slug = "") then $slug-prefix
    else concat($slug-prefix, ${stringLiteral(WEBSITE_PAGE_SLUG_SEPARATOR)}, $slug)
};

declare function local:page-child-slug-prefix($resource, $slug-prefix) {
  if ($slug-prefix = "") then ""
  else local:page-slug($resource, $slug-prefix)
};
`;
