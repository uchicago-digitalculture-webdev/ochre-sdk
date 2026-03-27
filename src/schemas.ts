import * as z from "zod";
import type {
  ApiVersion,
  DataCategory,
  PropertyValueContentType,
  Query,
  QueryLeaf,
  SetItemsSort,
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

export const fakeStringSchema = z.union([z.string(), z.number(), z.boolean()]);

export const richTextStringContentSchema = z.union([
  fakeStringSchema,
  z.object({
    content: fakeStringSchema.optional(),
    rend: z.string().optional(),
    whitespace: z.string().optional(),
  }),
]);

/**
 * Schema for validating rich text string content
 * @internal
 */
export const richTextStringSchema = z.object({
  string: z.union([
    fakeStringSchema,
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
 * Shared schema for Set queries
 * @internal
 */
const setQueryLeafSchema = z.union([
  z
    .object({
      target: z.literal("property"),
      propertyVariable: uuidSchema.optional(),
      dataType: z.enum([
        "string",
        "integer",
        "decimal",
        "boolean",
        "time",
        "IDREF",
      ] as const satisfies ReadonlyArray<
        Exclude<
          Exclude<PropertyValueContentType, "coordinate">,
          "date" | "dateTime"
        >
      >),
      propertyValues: z
        .array(z.string())
        .min(1, "At least one property value is required")
        .optional(),
      matchMode: z.enum(["includes", "exact"]),
      isCaseSensitive: z.boolean(),
      language: z.string().default("eng"),
      isNegated: z.boolean().optional().default(false),
    })
    .strict()
    .superRefine((value, ctx) => {
      if (value.propertyVariable == null && value.propertyValues == null) {
        ctx.addIssue({
          code: "custom",
          message:
            "Property queries must include at least one propertyVariable or propertyValue",
        });
      }
    }),
  z
    .object({
      target: z.literal("property"),
      propertyVariable: uuidSchema,
      dataType: z.enum(["date", "dateTime"] as const satisfies ReadonlyArray<
        Extract<
          Exclude<PropertyValueContentType, "coordinate">,
          "date" | "dateTime"
        >
      >),
      from: z.string(),
      to: z.string().optional(),
      matchMode: z.enum(["includes", "exact"]),
      isCaseSensitive: z.boolean(),
      language: z.string().default("eng"),
      isNegated: z.boolean().optional().default(false),
    })
    .strict(),
  z
    .object({
      target: z.literal("property"),
      propertyVariable: uuidSchema,
      dataType: z.enum(["date", "dateTime"] as const satisfies ReadonlyArray<
        Extract<
          Exclude<PropertyValueContentType, "coordinate">,
          "date" | "dateTime"
        >
      >),
      from: z.string().optional(),
      to: z.string(),
      matchMode: z.enum(["includes", "exact"]),
      isCaseSensitive: z.boolean(),
      language: z.string().default("eng"),
      isNegated: z.boolean().optional().default(false),
    })
    .strict(),
  z
    .object({
      target: z.literal("string"),
      value: z.string(),
      matchMode: z.enum(["includes", "exact"]),
      isCaseSensitive: z.boolean(),
      language: z.string().default("eng"),
      isNegated: z.boolean().optional().default(false),
    })
    .strict(),
  z
    .object({
      target: z.enum([
        "title",
        "description",
        "image",
        "periods",
        "bibliography",
      ]),
      value: z.string(),
      matchMode: z.enum(["includes", "exact"]),
      isCaseSensitive: z.boolean(),
      language: z.string().default("eng"),
      isNegated: z.boolean().optional().default(false),
    })
    .strict(),
]) satisfies z.ZodType<QueryLeaf>;

const setQuerySchema: z.ZodType<Query> = z.lazy(() =>
  z.union([
    setQueryLeafSchema,
    z
      .object({
        and: z
          .array(setQuerySchema)
          .min(1, "AND groups must contain at least one query"),
      })
      .strict(),
    z
      .object({
        or: z
          .array(setQuerySchema)
          .min(1, "OR groups must contain at least one query"),
      })
      .strict(),
  ]),
);

const setQueriesSchema = setQuerySchema.nullable().default(null);

const setItemsSortSchema = z
  .discriminatedUnion("target", [
    z.object({ target: z.literal("none") }).strict(),
    z
      .object({
        target: z.literal("title"),
        direction: z.enum(["asc", "desc"]).default("asc"),
        language: z.string().default("eng"),
      })
      .strict(),
    z
      .object({
        target: z.literal("propertyValue"),
        propertyVariableUuid: uuidSchema,
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
        direction: z.enum(["asc", "desc"]).default("asc"),
        language: z.string().default("eng"),
      })
      .strict(),
  ])
  .default({ target: "none" }) satisfies z.ZodType<SetItemsSort>;

function hasPropertyQueryWithPropertyVariable(
  query: Query | null | undefined,
): boolean {
  if (query == null) {
    return false;
  }

  if ("target" in query) {
    return query.target === "property" && query.propertyVariable != null;
  }

  const groupQueries = "and" in query ? query.and : query.or;

  for (const groupQuery of groupQueries) {
    if (hasPropertyQueryWithPropertyVariable(groupQuery)) {
      return true;
    }
  }

  return false;
}

/**
 * Schema for validating the parameters for the Set property values fetching function
 * @internal
 */
export const setPropertyValuesParamsSchema = z
  .object({
    setScopeUuids: z
      .array(uuidSchema)
      .min(1, "At least one set scope UUID is required"),
    belongsToCollectionScopeUuids: z.array(uuidSchema).default([]),
    queries: setQueriesSchema,
    attributes: z
      .object({
        bibliographies: z.boolean().default(false),
        periods: z.boolean().default(false),
      })
      .default({ bibliographies: false, periods: false }),
    isLimitedToLeafPropertyValues: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (!hasPropertyQueryWithPropertyVariable(value.queries)) {
      ctx.addIssue({
        code: "custom",
        path: ["queries"],
        message:
          "At least one property query with propertyVariable is required",
      });
    }
  });

export const setItemsParamsSchema = z.object({
  setScopeUuids: z
    .array(uuidSchema)
    .min(1, "At least one set scope UUID is required"),
  belongsToCollectionScopeUuids: z.array(uuidSchema).default([]),
  queries: setQueriesSchema,
  sort: setItemsSortSchema,
  page: z.number().min(1, "Page must be positive").default(1),
  pageSize: z
    .number()
    .min(1, "Page size must be positive")
    .default(DEFAULT_PAGE_SIZE),
});
