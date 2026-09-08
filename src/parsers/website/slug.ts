/**
 * The prefix OCHRE puts on a segment page's slug to keep it unique
 *
 * Kept as a pattern string rather than only a `RegExp`, because the website
 * metadata fetcher has to strip the same prefix inside XQuery. Both the
 * TypeScript and the XQuery side read it from here so they cannot drift.
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
