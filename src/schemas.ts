import type { RenderOption, WhitespaceOption } from "./types/internal.raw.js";
import type {
  DataCategory,
  PropertyValueContentType,
  WebElementComponent,
  WebsiteProperties,
} from "./types/main.js";
import { z } from "zod";

/**
 * Schema for validating UUIDs
 * @internal
 */
export const uuidSchema = z.string().uuid({ message: "Invalid UUID provided" });

/**
 * Schema for validating website properties
 * @internal
 */
export const websiteSchema = z.object({
  type: z.enum(
    [
      "traditional",
      "digital-collection",
      "plum",
      "cedar",
      "elm",
      "maple",
      "oak",
      "palm",
    ] as const satisfies ReadonlyArray<WebsiteProperties["type"]>,
    { message: "Invalid website type" },
  ),
  status: z.enum(
    ["development", "preview", "production"] as const satisfies ReadonlyArray<
      WebsiteProperties["status"]
    >,
    { message: "Invalid website status" },
  ),
  privacy: z.enum(
    ["public", "password", "private"] as const satisfies ReadonlyArray<
      WebsiteProperties["privacy"]
    >,
    { message: "Invalid website privacy" },
  ),
});

/**
 * Valid component types for web elements
 * @internal
 */
export const componentSchema = z.enum(
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
    "n-columns",
    "n-rows",
    "network-graph",
    "search-bar",
    "table",
    "text",
    "timeline",
    "video",
  ] as const satisfies ReadonlyArray<WebElementComponent["component"]>,
  { message: "Invalid component" },
);

/**
 * Schema for validating data categories
 * @internal
 */
export const categorySchema = z.enum([
  "resource",
  "spatialUnit",
  "concept",
  "period",
  "bibliography",
  "person",
  "propertyValue",
  "set",
  "tree",
] as const satisfies ReadonlyArray<DataCategory>);

/**
 * Schema for validating property value content types
 * @internal
 */
export const propertyValueContentTypeSchema = z.enum([
  "string",
  "integer",
  "decimal",
  "boolean",
  "date",
  "dateTime",
  "time",
  "coordinate",
  "IDREF",
] as const satisfies ReadonlyArray<PropertyValueContentType>);

/**
 * Schema for validating gallery parameters
 * @internal
 */
export const gallerySchema = z
  .object({
    uuid: z.string().uuid({ message: "Invalid UUID" }),
    filter: z.string().optional(),
    page: z.number().positive({ message: "Page must be positive" }),
    perPage: z.number().positive({ message: "Per page must be positive" }),
  })
  .strict();

/**
 * Schema for validating and parsing render options
 * @internal
 */
export const renderOptionsSchema = z
  .string()
  .transform((str) => str.split(" "))
  .pipe(
    z.array(
      z.enum([
        "bold",
        "italic",
        "underline",
      ] as const satisfies ReadonlyArray<RenderOption>),
    ),
  );

/**
 * Schema for validating and parsing whitespace options
 * @internal
 */
export const whitespaceSchema = z
  .string()
  .transform((str) => str.split(" "))
  .pipe(
    z.array(
      z.enum([
        "newline",
        "trailing",
        "leading",
      ] as const satisfies ReadonlyArray<WhitespaceOption>),
    ),
  );

/**
 * Schema for validating email addresses
 * @internal
 */
export const emailSchema = z.string().email({ message: "Invalid email" });
