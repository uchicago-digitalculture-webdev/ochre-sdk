import * as v from "valibot";

/**
 * Schema for validating UUIDs
 * @internal
 */
export const uuidSchema = v.pipe(v.string(), v.uuid("Invalid UUID provided"));

/**
 * Valid component types for web elements
 * @internal
 */
export const componentSchema = v.picklist(
  [
    "annotated-document",
    "annotated-image",
    "bibliography",
    "button",
    "collection",
    "empty-space",
    "entries",
    "filter-categories",
    "iframe",
    "iiif-viewer",
    "image",
    "image-gallery",
    "map",
    "n-columns",
    "n-rows",
    "network-graph",
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
  uuid: v.pipe(v.string(), v.uuid("Invalid UUID")),
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
