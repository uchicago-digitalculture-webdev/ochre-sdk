import type { WebsitePageSlugs } from "#/parsers/website/slug.js";
import type {
  ItemLink,
  ItemLinkCategory,
  ItemLinks,
  PropertyValueContent,
} from "#/types/index.js";
import type { WebImage } from "#/types/website.js";
import { transformPermanentIdentificationUrlToItemLink } from "#/parsers/string.js";

/**
 * The link categories a website can point at
 */
export type WebsiteLinkCategory = Extract<
  ItemLinkCategory,
  "resource" | "set" | "tree"
>;

function isWebsiteLink<
  U extends WebsiteLinkCategory,
  T extends ReadonlyArray<string>,
>(link: ItemLinks<T>[number], category: U): link is ItemLink<U, T> {
  return link.category === category;
}

export function findWebsiteLink<
  U extends WebsiteLinkCategory,
  T extends ReadonlyArray<string>,
>(
  links: ItemLinks<T>,
  category: U,
  isMatch?: (link: ItemLink<U, T>) => boolean,
): ItemLink<U, T> | null {
  for (const link of links) {
    if (isWebsiteLink(link, category) && (isMatch == null || isMatch(link))) {
      return link;
    }
  }

  return null;
}

export function findWebsiteLinkByCategories<
  U extends WebsiteLinkCategory,
  T extends ReadonlyArray<string>,
>(links: ItemLinks<T>, categories: ReadonlyArray<U>): ItemLink<U, T> | null {
  for (const link of links) {
    for (const category of categories) {
      if (isWebsiteLink(link, category)) {
        return link;
      }
    }
  }

  return null;
}

export function getWebsiteLinks<
  U extends WebsiteLinkCategory,
  T extends ReadonlyArray<string>,
>(links: ItemLinks<T>, category: U): Array<ItemLink<U, T>> {
  const matchedLinks: Array<ItemLink<U, T>> = [];
  for (const link of links) {
    if (isWebsiteLink(link, category)) {
      matchedLinks.push(link);
    }
  }

  return matchedLinks;
}

/**
 * Where a "link-to", "navigate-to" or "redirect-to" property points
 *
 * An external href is rewritten to an item route; anything else resolves
 * through the page slug map, so a link to a page inside a segment gets that
 * segment's full slug rather than the bare one OCHRE stores on the page.
 * @param value - The raw property value holding the target
 * @param pageSlugs - The website's resolved page slugs
 * @returns The target, or null when the property carries none
 * @internal
 */
export function parseWebsiteLinkTarget<T extends ReadonlyArray<string>>(
  value: PropertyValueContent<T> | null,
  pageSlugs: WebsitePageSlugs | undefined,
): string | null {
  if (value == null) {
    return null;
  }

  if (value.href != null) {
    return transformPermanentIdentificationUrlToItemLink(value.href);
  }

  return (
    (value.uuid == null ? undefined : pageSlugs?.get(value.uuid)) ?? value.slug
  );
}

/**
 * The image a link stands for
 *
 * Built the same way wherever a website shows a linked image, so the six
 * fields and the fallbacks for a link OCHRE has no dimensions for are stated
 * once.
 * @param link - The resource link pointing at the image
 * @param quality - The quality the consumer should request
 * @returns The image
 * @internal
 */
export function webImageFromLink<T extends ReadonlyArray<string>>(
  link: ItemLinks<T>[number],
  quality: WebImage<T>["quality"],
): WebImage<T> {
  const image = "image" in link ? link.image : null;

  return {
    uuid: link.uuid,
    label: link.identification.label,
    description: link.description,
    width: image?.width ?? 0,
    height: image?.height ?? 0,
    quality,
  };
}
