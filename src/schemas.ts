import * as v from "valibot";
import { isPseudoUuid } from "#/utils.js";

/**
 * Schema for validating UUIDs
 * @internal
 */
export const uuidSchema = v.pipe(
  v.string(),
  v.check(isPseudoUuid, "Invalid pseudo-UUID provided"),
);

/**
 * Schema for validating language codes
 * @internal
 */
export const iso639_3Schema = v.pipe(
  v.string("Language code must be a string"),
  v.length(3, "Language code must be exactly 3 characters"),
  v.regex(/^[a-z]{3}$/, "Language code must be exactly 3 lowercase letters"),
);

/**
 * Valid component types for web elements
 * @internal
 */
export const componentSchema = v.picklist(
  [
    "3d-viewer",
    "advanced-search",
    "annotated-document",
    "annotated-image",
    "audio-player",
    "bibliography",
    "button",
    "collection",
    "empty-space",
    "entries",
    "iframe",
    "iiif-viewer",
    "image",
    "image-gallery",
    "map",
    "query",
    "search-bar",
    "table",
    "text",
    "timeline",
    "video",
  ],
  "Invalid component",
);

/**
 * Schema for validating gallery parameters
 * @internal
 */
export const gallerySchema = v.object({
  uuid: v.pipe(v.string(), v.check(isPseudoUuid, "Invalid pseudo-UUID")),
  filter: v.optional(v.string()),
  page: v.pipe(
    v.number("Page must be positive"),
    v.check((n) => n > 0, "Page must be positive"),
  ),
  perPage: v.pipe(
    v.number("Per page must be positive"),
    v.check((n) => n > 0, "Per page must be positive"),
  ),
});

/**
 * Schema for validating and parsing render options
 * @internal
 */
export const renderOptionsSchema = v.pipe(
  v.string(),
  v.transform((str) => str.split(" ")),
  v.array(v.picklist(["bold", "italic", "underline"])),
);

/**
 * Schema for validating and parsing whitespace options
 * @internal
 */
export const whitespaceSchema = v.pipe(
  v.string(),
  v.transform((str) => str.split(" ")),
  v.array(v.picklist(["newline", "trailing", "leading"])),
);

/**
 * Schema for validating email addresses
 * @internal
 */
export const emailSchema = v.pipe(v.string(), v.email("Invalid email address"));
