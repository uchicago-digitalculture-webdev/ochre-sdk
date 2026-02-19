import * as z from "zod";
import type {
  ApiVersion,
  DataCategory,
  PropertyValueContentType,
} from "./types/index.js";
import type { RenderOption, WhitespaceOption } from "./types/raw.js";
import type { WebElementComponent } from "./types/website.js";
import { DEFAULT_PAGE_SIZE } from "./utils/helpers.js";
import { isPseudoUuid } from "./utils/internal.js";

/**
 * Schema for validating UUIDs
 * @internal
 */
export const uuidSchema = z
  .string()
  .refine(isPseudoUuid, { error: "Invalid pseudo-UUID" });

export const richTextStringContentSchema = z.object({
  content: z.union([z.string(), z.number(), z.boolean()]).optional(),
  rend: z.string().optional(),
  whitespace: z.string().optional(),
});

/**
 * Schema for validating rich text string content
 * @internal
 */
export const richTextStringSchema = z.object({
  string: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    richTextStringContentSchema,
    z.array(richTextStringContentSchema),
  ]),
  lang: z.string().optional(),
});

/**
 * Schema for validating identification
 * @internal
 */
export const identificationSchema = z.object({
  label: z.object({
    content: z.union([richTextStringSchema, z.array(richTextStringSchema)]),
  }),
  abbreviation: z.object({
    content: z
      .union([richTextStringSchema, z.array(richTextStringSchema)])
      .optional(),
  }),
  code: z.string().optional(),
});

/**
 * Schema for validating filters
 * @internal
 */
export const filterSchema = z.string().optional();

/**
 * Schema for validating data options
 * @internal
 */
export const dataOptionsSchema = z
  .object({
    filter: z.string().optional().default(""),
    start: z
      .number()
      .positive({ error: "Start must be positive" })
      .optional()
      .default(1),
    limit: z
      .number()
      .positive({ error: "Limit must be positive" })
      .optional()
      .default(40),
  })
  .optional()
  .default({ filter: "", start: 1, limit: 40 });

export const apiVersionSuffixSchema = z
  .enum(["-v1", "-v2"])
  .transform(
    (suffix) => Number.parseInt(suffix.replace("-v", ""), 10) as ApiVersion,
  );

/**
 * Valid component types for web elements
 * @internal
 */
export const componentSchema = z.enum(
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
  ] as const satisfies ReadonlyArray<WebElementComponent["component"]>,
  { error: "Invalid component" },
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
  "propertyVariable",
  "propertyValue",
  "text",
  "tree",
  "set",
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
export const emailSchema = z.email({ error: "Invalid email" });

/**
 * Schema for parsing and validating a string in the format "[[number, number], [number, number]]"
 * into an array with exactly two bounds
 * @internal
 */
export const boundsSchema = z
  .string()
  .transform((str, ctx): unknown => {
    const trimmed = str.trim();

    if (!trimmed.startsWith("[[") || !trimmed.endsWith("]]")) {
      ctx.addIssue({
        code: "invalid_format",
        format: "string",
        message: "String must start with '[[' and end with ']]'",
      });
      return z.NEVER;
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return parsed;
    } catch {
      ctx.addIssue({
        code: "invalid_format",
        format: "string",
        message: "Invalid JSON format",
      });
      return z.NEVER;
    }
  })
  .pipe(
    z.tuple(
      [z.tuple([z.number(), z.number()]), z.tuple([z.number(), z.number()])],
      { message: "Must contain exactly 2 coordinate pairs" },
    ),
  );

/**
 * Schema for validating the parameters for the Set property values by property variables fetching function
 * @internal
 */
export const setPropertyValuesByPropertyVariablesParamsSchema = z.object({
  setScopeUuids: z
    .array(uuidSchema)
    .min(1, "At least one set scope UUID is required"),
  belongsToCollectionScopeUuids: z.array(uuidSchema).default([]),
  propertyVariableUuids: z
    .array(uuidSchema)
    .min(1, "At least one property variable UUID is required"),
});

export const setItemsByPropertyValuesParamsSchema = z.object({
  ...setPropertyValuesByPropertyVariablesParamsSchema.shape,
  propertyValues: z
    .array(
      z.object({
        dataType: z.enum([
          "string",
          "integer",
          "decimal",
          "boolean",
          "date",
          "dateTime",
          "time",

          "IDREF",
        ] as const satisfies ReadonlyArray<
          Exclude<PropertyValueContentType, "coordinate">
        >),
        value: z.string(),
      }),
    )
    .min(1, "At least one property value is required"),
  page: z.number().min(1, "Page must be at least 1").default(1),
  pageSize: z
    .number()
    .min(1, "Page size must be at least 1")
    .default(DEFAULT_PAGE_SIZE),
  itemCategory: z
    .enum(["resource", "spatialUnit", "concept", "text"])
    .optional(),
  includeChildItems: z.boolean().optional().default(false),
});
