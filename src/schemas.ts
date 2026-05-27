import * as v from "valibot";
import type {
  Query,
  QueryablePropertyValueDataType,
  QueryLeaf,
  SetItemsSort,
} from "#/types/index.js";
import type { WebElementComponent } from "#/types/website.js";
import { DEFAULT_PAGE_SIZE } from "#/helpers.js";
import { isPseudoUuid } from "#/utils.js";

const positiveNumber = (message: string): v.GenericSchema<unknown, number> =>
  v.pipe(v.number(), v.minValue(1, message));
const defaultString = (value: string): v.GenericSchema<unknown, string> =>
  v.optional(v.string(), value);
const defaultBoolean = (value: boolean): v.GenericSchema<unknown, boolean> =>
  v.optional(v.boolean(), value);
const sortDirectionSchema = v.optional(v.picklist(["asc", "desc"]), "asc");

/**
 * Schema for validating UUIDs
 * @internal
 */
export const uuidSchema = v.pipe(
  v.string(),
  v.check(isPseudoUuid, "Invalid pseudo-UUID"),
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
  ] as const satisfies ReadonlyArray<WebElementComponent["component"]>,
  "Invalid/unknown web element component",
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
 * Schema for validating date data types
 * @internal
 */
const dateDataTypeSchema = v.picklist([
  "date",
  "dateTime",
] as const satisfies ReadonlyArray<
  Extract<QueryablePropertyValueDataType, "date" | "dateTime">
>);

/**
 * Shared schema for query fields
 * @internal
 */
const standardQueryFields = {
  matchMode: v.picklist(["includes", "exact"]),
  isCaseSensitive: v.boolean(),
  language: defaultString("eng"),
  isNegated: defaultBoolean(false),
} as const;

/**
 * Shared schema for Set queries
 * @internal
 */
const setQueryLeafSchema = v.union([
  v.pipe(
    v.strictObject({
      target: v.literal("property"),
      propertyVariable: v.optional(uuidSchema),
      dataType: v.picklist([
        "string",
        "integer",
        "decimal",
        "boolean",
        "time",
        "IDREF",
      ] as const satisfies ReadonlyArray<
        Exclude<QueryablePropertyValueDataType, "date" | "dateTime">
      >),
      value: v.optional(v.string()),
      ...standardQueryFields,
    }),
    v.check(
      (value) => value.propertyVariable != null || value.value != null,
      "Property queries must include at least one propertyVariable or value",
    ),
  ),
  v.strictObject({
    target: v.literal("property"),
    propertyVariable: uuidSchema,
    dataType: dateDataTypeSchema,
    value: v.string(),
    from: v.optional(v.never()),
    to: v.optional(v.never()),
    ...standardQueryFields,
  }),
  v.strictObject({
    target: v.literal("property"),
    propertyVariable: uuidSchema,
    dataType: dateDataTypeSchema,
    value: v.optional(v.never()),
    from: v.string(),
    to: v.optional(v.string()),
    ...standardQueryFields,
  }),
  v.strictObject({
    target: v.literal("property"),
    propertyVariable: uuidSchema,
    dataType: dateDataTypeSchema,
    value: v.optional(v.never()),
    from: v.optional(v.string()),
    to: v.string(),
    ...standardQueryFields,
  }),
  v.strictObject({
    target: v.literal("property"),
    propertyVariable: v.optional(uuidSchema),
    dataType: v.literal("all"),
    value: v.string(),
    ...standardQueryFields,
  }),
  v.strictObject({
    target: v.literal("string"),
    value: v.string(),
    ...standardQueryFields,
  }),
  v.strictObject({
    target: v.picklist([
      "title",
      "description",
      "image",
      "periods",
      "bibliography",
      "notes",
    ]),
    value: v.string(),
    ...standardQueryFields,
  }),
]) satisfies v.GenericSchema<unknown, QueryLeaf>;

/**
 * Schema for validating Set queries
 * @internal
 */
const setQuerySchema: v.GenericSchema<unknown, Query> = v.lazy(() =>
  v.union([
    setQueryLeafSchema,
    v.strictObject({
      and: v.pipe(
        v.array(setQuerySchema),
        v.minLength(1, "AND groups must contain at least one query"),
      ),
    }),
    v.strictObject({
      or: v.pipe(
        v.array(setQuerySchema),
        v.minLength(1, "OR groups must contain at least one query"),
      ),
    }),
  ]),
);

/**
 * Schema for validating Set queries
 * @internal
 */
const setQueriesSchema = v.optional(v.nullable(setQuerySchema), null);

/**
 * Schema for validating Set items sort
 * @internal
 */
const setItemsSortSchema = v.optional(
  v.variant("target", [
    v.strictObject({ target: v.literal("none") }),
    v.strictObject({
      target: v.literal("title"),
      direction: sortDirectionSchema,
      language: defaultString("eng"),
    }),
    v.strictObject({
      target: v.literal("propertyValue"),
      propertyVariableUuid: uuidSchema,
      dataType: v.picklist([
        "string",
        "integer",
        "decimal",
        "boolean",
        "date",
        "dateTime",
        "time",
        "IDREF",
      ] as const satisfies ReadonlyArray<QueryablePropertyValueDataType>),
      direction: sortDirectionSchema,
      language: defaultString("eng"),
    }),
  ]),
  { target: "none" },
) satisfies v.GenericSchema<unknown, SetItemsSort>;

/**
 * Schema for validating the parameters for the Set property values fetching function
 * @internal
 */
export const setPropertyValuesParamsSchema = v.object({
  setScopeUuids: v.pipe(
    v.array(uuidSchema),
    v.minLength(1, "At least one set scope UUID is required"),
  ),
  belongsToCollectionScopeUuids: v.optional(v.array(uuidSchema), []),
  queries: setQueriesSchema,
  attributes: v.optional(
    v.object({
      bibliographies: defaultBoolean(false),
      periods: defaultBoolean(false),
    }),
    { bibliographies: false, periods: false },
  ),
  isLimitedToLeafPropertyValues: defaultBoolean(false),
});

/**
 * Schema for validating Set items parameters
 * @internal
 */
export const setItemsParamsSchema = v.object({
  setScopeUuids: v.pipe(
    v.array(uuidSchema),
    v.minLength(1, "At least one set scope UUID is required"),
  ),
  belongsToCollectionScopeUuids: v.optional(v.array(uuidSchema), []),
  queries: setQueriesSchema,
  sort: setItemsSortSchema,
  page: v.optional(positiveNumber("Page must be positive"), 1),
  pageSize: v.optional(
    positiveNumber("Page size must be positive"),
    DEFAULT_PAGE_SIZE,
  ),
});
