import * as v from "valibot";
import type { ParserOptions } from "#/parsers/helpers.js";
import type { WebsitePresentationReader } from "#/parsers/website/reader.js";
import type {
  Identification,
  ItemLink,
  ItemLinkCategory,
  ItemLinks,
  PropertyValueContent,
  SimplifiedProperty,
} from "#/types/index.js";
import type {
  ContextTree,
  ContextTreeLevel,
  ContextTreeLevelItem,
  Style,
  StylesheetItem,
  WebAccordionItem,
  WebBlock,
  WebBlockItem,
  WebElement,
  WebElementComponent,
  WebImage,
  WebOptions,
  Webpage,
  WebSidebar,
  Website,
  WebsiteSegment,
  WebTitle,
} from "#/types/website.js";
import type {
  XMLWebsiteContext,
  XMLWebsiteContextItem,
  XMLWebsiteData,
  XMLWebsiteFilterContext,
  XMLWebsiteFilterContextItem,
  XMLWebsiteOptions,
  XMLWebsiteProperties,
  XMLWebsiteResource,
  XMLWebsiteResourceItem,
  XMLWebsiteStyle,
  XMLWebsiteTree,
} from "#/xml/types.js";
import {
  cleanObject,
  parseContentLike,
  parseLicense,
  parseStringContent,
} from "#/parsers/helpers.js";
import {
  parseBibliographyList,
  parseIdentification,
  parseLinks,
  parseMetadata,
  parseMetadataLanguages,
  parseNotes,
  parsePersonList,
  parseSimplifiedProperties,
  resolveDefaultLanguage,
  resolveLanguages,
} from "#/parsers/index.js";
import { parseXMLContent } from "#/parsers/string.js";
import { websitePresentationReader } from "#/parsers/website/reader.js";
import { componentSchema } from "#/schemas.js";

type WebsiteLinkCategory = Extract<
  ItemLinkCategory,
  "resource" | "set" | "tree"
>;

type WebsiteParseContext<T extends ReadonlyArray<string>> = Pick<
  Website<T>,
  "belongsTo" | "metadata"
> & {
  pageSlugsByUuid?: ReadonlyMap<string, string>;
  /**
   * The resolved properties and license of the nearest enclosing Website or
   * WebsiteSegment. Segments inherit these so that anything they do not
   * explicitly define cascades down from their parent, while anything they do
   * define overrides it. This keeps inheritance a parsing-time concern so
   * consumers can read a segment's properties naively.
   */
  parentProperties?: Website<T>["properties"];
  parentLicense?: Website<T>["license"];
};

function isWebsiteLink<
  U extends WebsiteLinkCategory,
  T extends ReadonlyArray<string>,
>(link: ItemLinks<T>[number], category: U): link is ItemLink<U, T> {
  return link.category === category;
}

function findWebsiteLink<
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

function findWebsiteLinkByCategories<
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

function getWebsiteLinks<
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

function transformPermanentIdentificationUrlToItemLink(url: string): string {
  return url.replace("https://pi.lib.uchicago.edu/1001/org/ochre/", "/item/");
}

function normalizeWebsiteResources(
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

const SEGMENT_UNIQUE_SLUG_PREFIX_REGEX = /^\$[^-]*-/;

function cleanWebsitePageSlug(slug: string | undefined): string | null {
  return slug?.replace(SEGMENT_UNIQUE_SLUG_PREFIX_REGEX, "") ?? null;
}

function prefixSlug(slug: string, slugPrefix: string | undefined): string {
  if (slugPrefix === "" || slugPrefix == null) {
    return slug;
  }

  if (slug === "") {
    return slugPrefix;
  }

  return `${slugPrefix}/${slug}`;
}

function collectSegmentPageSlugs<T extends ReadonlyArray<string>>(
  trees: ReadonlyArray<XMLWebsiteTree>,
  options: ParserOptions<T>,
  pageSlugsByUuid: Map<string, string>,
  segmentSlugPrefix?: string,
): void {
  for (const tree of trees) {
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

    collectWebsitePageSlugs(
      tree.items?.resource,
      options,
      prefixSlug(segmentSlug, segmentSlugPrefix),
      pageSlugsByUuid,
    );
  }
}

function collectResourcePageSlug<T extends ReadonlyArray<string>>(
  resource: XMLWebsiteResource,
  options: ParserOptions<T>,
  pageSlugsByUuid: Map<string, string>,
  slugPrefix?: string,
): void {
  const slug = cleanWebsitePageSlug(resource.slug);
  if (slug == null) {
    throw new Error(
      `Slug not found for page (${formatXMLWebsiteResourceMetadata(resource)})`,
      { cause: resource },
    );
  }

  const pageSlug = prefixSlug(slug, slugPrefix);
  pageSlugsByUuid.set(resource.uuid, pageSlug);

  collectWebsitePageSlugs(
    resource.resource,
    options,
    slugPrefix == null ? undefined : pageSlug,
    pageSlugsByUuid,
    pageSlug,
  );
}

function collectWebsitePageSlugs<T extends ReadonlyArray<string>>(
  resources: Array<XMLWebsiteResourceItem> | undefined,
  options: ParserOptions<T>,
  slugPrefix?: string,
  pageSlugsByUuid = new Map<string, string>(),
  segmentSlugPrefix = slugPrefix,
): Map<string, string> {
  const slugResources = resources ?? [];
  for (const resource of slugResources) {
    if ("segments" in resource) {
      collectSegmentPageSlugs(
        resource.segments.tree,
        options,
        pageSlugsByUuid,
        segmentSlugPrefix,
      );
      continue;
    }

    if (!("identification" in resource)) {
      collectWebsitePageSlugs(
        resource.resource,
        options,
        slugPrefix,
        pageSlugsByUuid,
        segmentSlugPrefix,
      );
      continue;
    }

    const resourceProperties = parseSimplifiedProperties(
      resource.properties,
      options,
    );
    const resourceType =
      websitePresentationReader(resourceProperties).value<string>(
        "presentation",
      );

    if (resourceType === "page") {
      collectResourcePageSlug(resource, options, pageSlugsByUuid, slugPrefix);
      continue;
    }

    collectWebsitePageSlugs(
      resource.resource,
      options,
      slugPrefix,
      pageSlugsByUuid,
      segmentSlugPrefix,
    );
  }

  return pageSlugsByUuid;
}

function parseWebsiteLinkTarget<T extends ReadonlyArray<string>>(
  value: PropertyValueContent<T> | null,
  context: WebsiteParseContext<T>,
): string | null {
  if (value == null) {
    return null;
  }

  if (value.href != null) {
    return transformPermanentIdentificationUrlToItemLink(value.href);
  }

  return (
    (value.uuid == null
      ? undefined
      : context.pageSlugsByUuid?.get(value.uuid)) ?? value.slug
  );
}

function formatXMLWebsiteResourceMetadata(
  resource: XMLWebsiteResource,
): string {
  const metadata: Array<string> = [
    `label “${parseStringContent(resource.identification.label)}”`,
    `uuid “${resource.uuid}”`,
  ];

  if (resource.slug != null) {
    metadata.push(`slug “${resource.slug}”`);
  }

  if (resource.identification.abbreviation != null) {
    metadata.push(
      `abbreviation “${parseStringContent(
        resource.identification.abbreviation,
      )}”`,
    );
  }

  return metadata.join(", ");
}

function formatComponentError(
  message: string,
  componentName: WebElementComponent["component"] | undefined,
  elementResource: XMLWebsiteResource,
): string {
  return `${message} for component “${componentName ?? "(unknown)"}” (${formatXMLWebsiteResourceMetadata(
    elementResource,
  )})`;
}

/**
 * Extracts CSS style properties for a given presentation variant.
 *
 * @param properties - Array of properties to parse
 * @param cssVariant - CSS variant to parse
 * @returns Array of CSS styles
 */
function parseCssStylesFromProperties(
  properties: Array<SimplifiedProperty<ReadonlyArray<string>>>,
  cssVariant?: string,
): Array<Style> {
  const label = cssVariant != null ? `css-${cssVariant}` : "css";
  const cssProperties = websitePresentationReader(properties).nestedByValue(
    "presentation",
    label,
  ).properties;
  const styles: Array<Style> = [];
  for (const property of cssProperties) {
    const value = property.values[0]?.content.toString();
    if (value != null) {
      styles.push({ label: property.variable.label, value });
    }
  }
  return styles;
}

/**
 * Parses responsive CSS styles (default, tablet, mobile) from properties.
 *
 * @param properties - Array of properties to parse
 * @returns Object containing responsive CSS styles
 */
function parseResponsiveCssStyles(
  properties: Array<SimplifiedProperty<ReadonlyArray<string>>>,
): { default: Array<Style>; tablet: Array<Style>; mobile: Array<Style> } {
  return {
    default: parseCssStylesFromProperties(properties),
    tablet: parseCssStylesFromProperties(properties, "tablet"),
    mobile: parseCssStylesFromProperties(properties, "mobile"),
  };
}

/**
 * Parses raw bounds data into a standardized bounds structure
 *
 * @param bounds - Raw bounds data in OCHRE format
 * @returns Parsed bounds object
 */
export function parseBounds(
  bounds: string,
): [[number, number], [number, number]] {
  const coordinates = bounds.trimStart().startsWith("[")
    ? parseJsonBounds(bounds)
    : bounds
        .split(";")
        .map((pair) =>
          pair.split(",").map((coordinate) => Number(coordinate.trim())),
        );
  const [southWest, northEast] = coordinates;
  if (
    southWest?.length !== 2 ||
    northEast?.length !== 2 ||
    southWest.some((coordinate) => Number.isNaN(coordinate)) ||
    northEast.some((coordinate) => Number.isNaN(coordinate))
  ) {
    throw new Error(`Invalid bounds: ${bounds}`, { cause: bounds });
  }

  return [
    [southWest[0]!, southWest[1]!],
    [northEast[0]!, northEast[1]!],
  ];
}

function parseJsonBounds(bounds: string): Array<Array<number>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bounds) as unknown;
  } catch {
    throw new Error(`Invalid bounds: ${bounds}`, { cause: bounds });
  }

  if (!isNumberPairArray(parsed)) {
    throw new Error(`Invalid bounds: ${bounds}`, { cause: bounds });
  }

  return parsed;
}

function isNumberPairArray(value: unknown): value is Array<Array<number>> {
  return (
    Array.isArray(value) &&
    value.every(
      (pair) =>
        Array.isArray(pair) &&
        pair.every((coordinate) => typeof coordinate === "number"),
    )
  );
}

/**
 * Parses all context option arrays from an options object.
 *
 * @param options - Options object containing context options
 * @param options.flattenContexts - Flatten contexts
 * @param options.suppressContexts - Suppress contexts
 * @param options.filterContexts - Filter contexts
 * @param options.sortContexts - Sort contexts
 * @param options.detailContexts - Detail contexts
 * @param options.downloadContexts - Download contexts
 * @param options.labelContexts - Label contexts
 * @param options.prominentContexts - Prominent contexts
 * @returns Parsed context options
 */
function parseAllOptionContexts<T extends ReadonlyArray<string>>(
  options: {
    flattenContexts?: Array<XMLWebsiteContext> | null;
    suppressContexts?: Array<XMLWebsiteContext> | null;
    filterContexts?: Array<XMLWebsiteFilterContext> | null;
    sortContexts?: Array<XMLWebsiteContext> | null;
    detailContexts?: Array<XMLWebsiteContext> | null;
    downloadContexts?: Array<XMLWebsiteContext> | null;
    labelContexts?: Array<XMLWebsiteContext> | null;
    prominentContexts?: Array<XMLWebsiteContext> | null;
  },
  parserOptions: ParserOptions<T>,
): ContextTree<T> {
  function handleContexts(
    v: Array<XMLWebsiteContext> | null | undefined,
  ): Array<ContextTreeLevel<T>> {
    return parseContexts(v ?? [], parserOptions);
  }

  function handleFilterContexts(
    v: Array<XMLWebsiteFilterContext> | null | undefined,
  ): ContextTree<T>["filter"] {
    return parseFilterContexts(v ?? [], parserOptions);
  }

  return {
    flatten: handleContexts(options.flattenContexts),
    suppress: handleContexts(options.suppressContexts),
    filter: handleFilterContexts(options.filterContexts),
    sort: handleContexts(options.sortContexts),
    detail: handleContexts(options.detailContexts),
    download: handleContexts(options.downloadContexts),
    label: handleContexts(options.labelContexts),
    prominent: handleContexts(options.prominentContexts),
  };
}

function parseWebsiteScopes<T extends ReadonlyArray<string>>(
  scopes: XMLWebsiteOptions["scopes"] | undefined,
  options: ParserOptions<T>,
): WebOptions<T>["scopes"] {
  if (scopes == null) {
    return null;
  }

  const parsedScopes: NonNullable<WebOptions<T>["scopes"]> = Array.from(
    scopes.scope,
    (scope) => ({
      uuid: scope.uuid.payload,
      type: scope.uuid.type,
      identification: parseIdentification(scope.identification, options),
    }),
  );

  return parsedScopes;
}

function parseWebsiteOptions<T extends ReadonlyArray<string>>(
  rawOptions: XMLWebsiteOptions | undefined,
  options: ParserOptions<T>,
): WebOptions<T> {
  const parsedOptions: WebOptions<T> = {
    scopes: parseWebsiteScopes(rawOptions?.scopes, options),
    contextTree:
      rawOptions == null ? null : parseAllOptionContexts(rawOptions, options),
    labels: { title: null },
  };

  const notes = parseNotes(rawOptions?.notes, options);
  for (const note of notes) {
    if (note.title?.getText() !== "Title label") {
      continue;
    }

    parsedOptions.labels.title = note.content;
    break;
  }

  return parsedOptions;
}

function parseStylesheets(
  styles: Array<XMLWebsiteStyle>,
): Array<StylesheetItem> {
  const parsedStyles: Array<StylesheetItem> = [];

  for (const style of styles) {
    const defaultStyles: Array<Style> = [];

    for (const [label, value] of Object.entries(style)) {
      if (
        [
          "variableUuid",
          "valueUuid",
          "category",
          "payload",
          "content",
        ].includes(label)
      ) {
        continue;
      }

      const valueString = value?.toString();
      if (valueString != null) {
        defaultStyles.push({ label, value: valueString });
      }
    }

    const stylesByViewport: StylesheetItem["styles"] = {
      default: defaultStyles,
      tablet: [],
      mobile: [],
    };

    if (style.category === "propertyValue" || style.valueUuid != null) {
      if (style.valueUuid == null) {
        throw new Error(
          `Stylesheet property value "${style.variableUuid}" is missing a value UUID`,
          { cause: style },
        );
      }

      parsedStyles.push({
        uuid: style.valueUuid,
        category: "propertyValue",
        variableUuid: style.variableUuid,
        icon: style.lucideIcon ?? null,
        styles: stylesByViewport,
      });
      continue;
    }

    parsedStyles.push({
      uuid: style.variableUuid,
      category: "propertyVariable",
      icon: style.lucideIcon ?? null,
      styles: stylesByViewport,
    });
  }

  return parsedStyles;
}

type CollectionComponent<T extends ReadonlyArray<string>> = Extract<
  WebElementComponent<T>,
  { component: "collection" }
>;

/**
 * Default values for a collection's display properties, shared between the
 * "collection" component and the "query" component's collection overrides.
 */
const COLLECTION_PROPERTY_DEFAULTS = {
  variant: "slide",
  paginationVariant: "default",
  loadingVariant: "skeleton",
  minimumColumnCount: null,
  maximumColumnCount: null,
  expectedItemCount: null,
  isSortDisplayed: false,
  isUsingQueryParams: false,
  isInteractive: true,
} as const satisfies Partial<
  Extract<WebElementComponent, { component: "collection" }>
>;

/**
 * Default values for a collection's image display properties, merged separately
 * from {@link COLLECTION_PROPERTY_DEFAULTS} because overrides of the nested
 * "image" object are themselves partial.
 */
const COLLECTION_IMAGE_DEFAULTS = {
  layout: "start",
  fit: "fit",
  alignment: null,
  isPlaceholderDisplayed: true,
} as const satisfies Extract<
  WebElementComponent,
  { component: "collection" }
>["image"];

type CollectionPropertyKey = keyof typeof COLLECTION_PROPERTY_DEFAULTS;

/**
 * Reads the collection display properties explicitly set on a reader, omitting
 * any that are unset. The "collection" component merges these over
 * {@link COLLECTION_PROPERTY_DEFAULTS} and {@link COLLECTION_IMAGE_DEFAULTS},
 * while the "query" component uses them as partial overrides for its embedded
 * collection.
 */
function parseCollectionPropertyOverrides<T extends ReadonlyArray<string>>(
  reader: WebsitePresentationReader<T>,
): Partial<Pick<CollectionComponent<T>, CollectionPropertyKey>> & {
  image?: Partial<CollectionComponent<T>["image"]>;
} {
  const overrides: Partial<
    Pick<CollectionComponent<T>, CollectionPropertyKey>
  > = {};
  const imageOverrides: Partial<CollectionComponent<T>["image"]> = {};

  function read<K extends CollectionPropertyKey>(key: K, label: string): void {
    const value = reader.value<CollectionComponent<T>[K]>(label);
    if (value != null) {
      overrides[key] = value;
    }
  }

  function readImage<K extends keyof CollectionComponent<T>["image"]>(
    key: K,
    label: string,
  ): void {
    const value = reader.value<CollectionComponent<T>["image"][K]>(label);
    if (value != null) {
      imageOverrides[key] = value;
    }
  }

  read("variant", "variant");
  read("paginationVariant", "pagination-variant");
  read("loadingVariant", "loading-variant");
  read("minimumColumnCount", "minimum-column-count");
  read("maximumColumnCount", "maximum-column-count");
  read("expectedItemCount", "item-count");
  read("isSortDisplayed", "sort-displayed");
  read("isUsingQueryParams", "is-using-query-params");
  read("isInteractive", "is-interactive");

  readImage("layout", "image-layout");
  readImage("fit", "image-fit");
  readImage("alignment", "image-alignment");
  readImage("isPlaceholderDisplayed", "image-placeholder-displayed");

  return Object.keys(imageOverrides).length > 0
    ? { ...overrides, image: imageOverrides }
    : overrides;
}

/**
 * Parses the "use-property" values defining which item properties a collection
 * displays, returning `null` when none are set.
 */
function parseCollectionDisplayedProperties<T extends ReadonlyArray<string>>(
  reader: WebsitePresentationReader<T>,
): CollectionComponent<T>["displayedProperties"] {
  const property = reader.property("use-property");
  if (property == null) {
    return null;
  }

  return property.values
    .filter((value) => value.uuid !== null)
    .map((value) => ({ uuid: value.uuid!, label: value.label }));
}

function readStringOrNumber<T extends ReadonlyArray<string>>(
  reader: WebsitePresentationReader<T>,
  label: string,
): string | null {
  const value = reader.value<string | number>(label);
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return value.toString();
  }

  return null;
}

type WebElementComponentParameters<T extends ReadonlyArray<string>> = {
  componentProperty: SimplifiedProperty<T>;
  componentReader: WebsitePresentationReader<T>;
  elementResource: XMLWebsiteResource;
  websiteLinks: ItemLinks<T>;
  options: ParserOptions<T>;
  context: WebsiteParseContext<T>;
};

function parse3dViewerComponent<T extends ReadonlyArray<string>>(
  parameters: WebElementComponentParameters<T>,
): WebElementComponent<T> {
  const { componentProperty, componentReader, elementResource, websiteLinks } =
    parameters;

  type ThreeDViewerComponent = Extract<
    WebElementComponent<T>,
    { component: "3d-viewer" }
  >;
  const resourceLink = findWebsiteLink(
    websiteLinks,
    "resource",
    (link) => link.fileFormat === "model/obj",
  );
  if (resourceLink == null) {
    throw new Error(
      formatComponentError(
        "Resource link not found",
        "3d-viewer",
        elementResource,
      ),
      { cause: componentProperty },
    );
  }

  const isInteractive = componentReader.valueOr<
    ThreeDViewerComponent["isInteractive"]
  >("is-interactive", true);
  const isControlsDisplayed = componentReader.valueOr<
    ThreeDViewerComponent["isControlsDisplayed"]
  >("controls-displayed", true);

  return {
    component: "3d-viewer",
    linkUuid: resourceLink.uuid,
    fileSize: resourceLink.fileSize,
    isInteractive,
    isControlsDisplayed,
  };
}

function parseAdvancedSearchComponent<T extends ReadonlyArray<string>>(
  parameters: WebElementComponentParameters<T>,
): WebElementComponent<T> {
  const {
    componentProperty,
    componentReader,
    elementResource,
    options,
    context,
  } = parameters;

  const boundElementPropertyUuid = componentReader.uuid("bound-element");
  const href = parseWebsiteLinkTarget(
    componentReader.valueNode("link-to"),
    context,
  );

  if (boundElementPropertyUuid == null && href == null) {
    throw new Error(
      formatComponentError(
        "Bound element or href not found",
        "advanced-search",
        elementResource,
      ),
      { cause: componentProperty },
    );
  }

  return {
    component: "advanced-search",
    boundElementUuid: boundElementPropertyUuid,
    href,
    options: parseWebsiteOptions(elementResource.options, options),
  };
}

function parseAnnotatedDocumentComponent<T extends ReadonlyArray<string>>(
  parameters: WebElementComponentParameters<T>,
): WebElementComponent<T> {
  const { componentProperty, elementResource, websiteLinks } = parameters;

  const documentLink = findWebsiteLink(
    websiteLinks,
    "resource",
    (link) => link.type === "internalDocument",
  );
  if (documentLink == null) {
    throw new Error(
      formatComponentError(
        "Document link not found",
        "annotated-document",
        elementResource,
      ),
      { cause: componentProperty },
    );
  }

  return { component: "annotated-document", linkUuid: documentLink.uuid };
}

function parseAnnotatedImageComponent<T extends ReadonlyArray<string>>(
  parameters: WebElementComponentParameters<T>,
): WebElementComponent<T> {
  const { componentProperty, componentReader, elementResource, websiteLinks } =
    parameters;

  type AnnotatedImageComponent = Extract<
    WebElementComponent<T>,
    { component: "annotated-image" }
  >;
  const imageLinks = getWebsiteLinks(websiteLinks, "resource").filter(
    (link) => link.type === "image" || link.type === "IIIF",
  );

  if (imageLinks.length === 0) {
    throw new Error(
      formatComponentError(
        "Image link not found",
        "annotated-image",
        elementResource,
      ),
      { cause: componentProperty },
    );
  }

  const isFilterInputDisplayed = componentReader.valueOr<
    AnnotatedImageComponent["isFilterInputDisplayed"]
  >("filter-input-displayed", true);
  const isOptionsDisplayed = componentReader.valueOr<
    AnnotatedImageComponent["isOptionsDisplayed"]
  >("options-displayed", true);
  const isAnnotationHighlightsDisplayed = componentReader.valueOr<
    AnnotatedImageComponent["isAnnotationHighlightsDisplayed"]
  >("annotation-highlights-displayed", true);
  const isAnnotationTooltipsDisplayed = componentReader.valueOr<
    AnnotatedImageComponent["isAnnotationTooltipsDisplayed"]
  >("annotation-tooltips-displayed", true);

  return {
    component: "annotated-image",
    linkUuid: imageLinks[0]!.uuid,
    isFilterInputDisplayed,
    isOptionsDisplayed,
    isAnnotationHighlightsDisplayed,
    isAnnotationTooltipsDisplayed,
  };
}

function parseAudioPlayerComponent<T extends ReadonlyArray<string>>(
  parameters: WebElementComponentParameters<T>,
): WebElementComponent<T> {
  const { componentProperty, componentReader, elementResource, websiteLinks } =
    parameters;

  type AudioPlayerComponent = Extract<
    WebElementComponent<T>,
    { component: "audio-player" }
  >;
  const audioLink = findWebsiteLink(
    websiteLinks,
    "resource",
    (link) => link.type === "audio",
  );
  if (audioLink == null) {
    throw new Error(
      formatComponentError(
        "Audio link not found",
        "audio-player",
        elementResource,
      ),
      { cause: componentProperty },
    );
  }

  const isSpeedControlsDisplayed = componentReader.valueOr<
    AudioPlayerComponent["isSpeedControlsDisplayed"]
  >("speed-controls-displayed", true);
  const isVolumeControlsDisplayed = componentReader.valueOr<
    AudioPlayerComponent["isVolumeControlsDisplayed"]
  >("volume-controls-displayed", true);
  const isSeekBarDisplayed = componentReader.valueOr<
    AudioPlayerComponent["isSeekBarDisplayed"]
  >("seek-bar-displayed", true);

  return {
    component: "audio-player",
    linkUuid: audioLink.uuid,
    isSpeedControlsDisplayed,
    isVolumeControlsDisplayed,
    isSeekBarDisplayed,
  };
}

function parseBibliographyComponent<T extends ReadonlyArray<string>>(
  parameters: WebElementComponentParameters<T>,
): WebElementComponent<T> {
  const {
    componentProperty,
    componentReader,
    elementResource,
    websiteLinks,
    options,
  } = parameters;

  type BibliographyComponent = Extract<
    WebElementComponent<T>,
    { component: "bibliography" }
  >;
  const bibliographies = parseBibliographyList(
    elementResource.bibliographies,
    options,
  );
  if (websiteLinks.length === 0 && bibliographies.length === 0) {
    throw new Error(
      formatComponentError("No links found", "bibliography", elementResource),
      { cause: componentProperty },
    );
  }

  const layout = componentReader.valueOr<BibliographyComponent["layout"]>(
    "layout",
    "long",
  );
  const isSourceDocumentDisplayed = componentReader.valueOr<
    BibliographyComponent["isSourceDocumentDisplayed"]
  >("source-document-displayed", true);

  return {
    component: "bibliography",
    linkUuids: websiteLinks.map((link) => link.uuid),
    bibliographies,
    layout,
    isSourceDocumentDisplayed,
  };
}

function parseButtonComponent<T extends ReadonlyArray<string>>(
  parameters: WebElementComponentParameters<T>,
): WebElementComponent<T> {
  const {
    componentProperty,
    componentReader,
    elementResource,
    websiteLinks,
    options,
    context,
  } = parameters;

  type ButtonComponent = Extract<
    WebElementComponent<T>,
    { component: "button" }
  >;
  const variant = componentReader.valueOr<ButtonComponent["variant"]>(
    "variant",
    "default",
  );

  let isExternal = false;
  let isRelative = false;
  let href = parseWebsiteLinkTarget(
    componentReader.valueNode("navigate-to"),
    context,
  );

  if (href === null) {
    href = parseWebsiteLinkTarget(
      componentReader.valueNode("link-to"),
      context,
    );

    if (href === null) {
      throw new Error(
        formatComponentError(
          "Properties “navigate-to” or “link-to” not found",
          "button",
          elementResource,
        ),
        { cause: componentProperty },
      );
    }
    isExternal = href.startsWith("http");
    isRelative = !href.startsWith("/");
  }

  const startIcon =
    componentReader.value<ButtonComponent["startIcon"]>("start-icon");
  const endIcon = componentReader.value<ButtonComponent["endIcon"]>("end-icon");

  let image: WebImage<T> | null = null;
  const imageLink = findWebsiteLink(
    websiteLinks,
    "resource",
    (link) => link.type === "image" || link.type === "IIIF",
  );
  if (imageLink != null) {
    image = {
      uuid: imageLink.uuid,
      label: imageLink.identification.label,
      width: imageLink.image?.width ?? 0,
      height: imageLink.image?.height ?? 0,
      description: imageLink.description,
      quality: "high",
    };
  }

  const childResources = normalizeWebsiteResources(elementResource.resource);
  const elements: Array<WebElement<T>> = [];
  for (const childResource of childResources) {
    const childReader = websitePresentationReader(
      parseSimplifiedProperties(childResource.properties, options),
    );
    if (childReader.value("presentation") !== "element") {
      continue;
    }
    const childComponent = childReader
      .nestedByValue("presentation", "element")
      .value<string>("component");
    if (childComponent === "button") {
      continue;
    }

    elements.push(parseWebElement(childResource, options, context));
  }

  return {
    component: "button",
    variant,
    href,
    isExternal,
    isRelative,
    label:
      elementResource.document && "content" in elementResource.document
        ? parseXMLContent(elementResource.document, options)
        : null,
    startIcon,
    endIcon,
    image,
    elements,
  };
}

function parseCollectionComponent<T extends ReadonlyArray<string>>(
  parameters: WebElementComponentParameters<T>,
): WebElementComponent<T> {
  const {
    componentProperty,
    componentReader,
    elementResource,
    websiteLinks,
    options,
  } = parameters;

  const setLinks = getWebsiteLinks(websiteLinks, "set");
  if (setLinks.length === 0) {
    throw new Error(
      formatComponentError(
        "Set links not found",
        "collection",
        elementResource,
      ),
      { cause: componentProperty },
    );
  }

  const isFilterResultsBarDisplayed = componentReader.valueOr<
    CollectionComponent<T>["filter"]["isResultsBarDisplayed"]
  >("filter-results-bar-displayed", false);
  const isFilterInputDisplayed = componentReader.valueOr<
    CollectionComponent<T>["filter"]["isInputDisplayed"]
  >("filter-input-displayed", false);
  const isFilterLimitedToInputFilter = componentReader.valueOr<
    CollectionComponent<T>["filter"]["isLimitedToInputFilter"]
  >("filter-limit-to-input-filter", false);
  const isFilterLimitedToLeafPropertyValues = componentReader.valueOr<
    CollectionComponent<T>["filter"]["isLimitedToLeafPropertyValues"]
  >("filter-limit-to-leaf-property-values", false);
  const isFilterSidebarDisplayed = componentReader.valueOr<
    CollectionComponent<T>["filter"]["isSidebarDisplayed"]
  >("filter-sidebar-displayed", false);
  const filterSidebarSort = componentReader.valueOr<
    CollectionComponent<T>["filter"]["sidebarSort"]
  >("filter-sidebar-sort", "default");
  const isFilterSidebarHelpTooltipsDisplayed = componentReader.valueOr<
    CollectionComponent<T>["filter"]["isSidebarHelpTooltipsDisplayed"]
  >("filter-sidebar-help-tooltips-displayed", false);

  const componentOptions = parseWebsiteOptions(
    elementResource.options,
    options,
  );

  const propertyOverrides = parseCollectionPropertyOverrides(componentReader);

  return {
    component: "collection",
    linkUuids: setLinks.map((link) => link.uuid),
    displayedProperties: parseCollectionDisplayedProperties(componentReader),
    ...COLLECTION_PROPERTY_DEFAULTS,
    ...propertyOverrides,
    image: { ...COLLECTION_IMAGE_DEFAULTS, ...propertyOverrides.image },
    filter: {
      isSidebarDisplayed: isFilterSidebarDisplayed,
      isResultsBarDisplayed: isFilterResultsBarDisplayed,
      isInputDisplayed: isFilterInputDisplayed,
      isLimitedToInputFilter: isFilterLimitedToInputFilter,
      isLimitedToLeafPropertyValues: isFilterLimitedToLeafPropertyValues,
      sidebarSort: filterSidebarSort,
      isSidebarHelpTooltipsDisplayed: isFilterSidebarHelpTooltipsDisplayed,
    },
    options: componentOptions,
  };
}

function parseEmptySpaceComponent<T extends ReadonlyArray<string>>(
  parameters: WebElementComponentParameters<T>,
): WebElementComponent<T> {
  const { componentReader } = parameters;

  return {
    component: "empty-space",
    height: componentReader.stringValue("height"),
    width: componentReader.stringValue("width"),
  };
}

function parseEntriesComponent<T extends ReadonlyArray<string>>(
  parameters: WebElementComponentParameters<T>,
): WebElementComponent<T> {
  const { componentProperty, componentReader, elementResource, websiteLinks } =
    parameters;

  type EntriesComponent = Extract<
    WebElementComponent<T>,
    { component: "entries" }
  >;
  const entriesLink = findWebsiteLinkByCategories(websiteLinks, [
    "set",
    "tree",
  ]);
  if (entriesLink == null) {
    throw new Error(
      formatComponentError(
        "Entries link not found",
        "entries",
        elementResource,
      ),
      { cause: componentProperty },
    );
  }

  const variant = componentReader.valueOr<EntriesComponent["variant"]>(
    "variant",
    "entry",
  );
  const isFilterInputDisplayed = componentReader.valueOr<
    EntriesComponent["isFilterInputDisplayed"]
  >("filter-input-displayed", false);

  return {
    component: "entries",
    linkUuid: entriesLink.uuid,
    variant,
    isFilterInputDisplayed,
  };
}

function parseIframeComponent<T extends ReadonlyArray<string>>(
  parameters: WebElementComponentParameters<T>,
): WebElementComponent<T> {
  const { componentProperty, componentReader, elementResource, websiteLinks } =
    parameters;

  const webpageLink = findWebsiteLink(
    websiteLinks,
    "resource",
    (link) => link.type === "webpage",
  );
  if (webpageLink?.href == null) {
    throw new Error(
      formatComponentError("URL not found", "iframe", elementResource),
      { cause: componentProperty },
    );
  }

  return {
    component: "iframe",
    href: transformPermanentIdentificationUrlToItemLink(webpageLink.href),
    height: componentReader.stringValue("height"),
    width: componentReader.stringValue("width"),
  };
}

function parseIiifViewerComponent<T extends ReadonlyArray<string>>(
  parameters: WebElementComponentParameters<T>,
): WebElementComponent<T> {
  const { componentProperty, componentReader, elementResource, websiteLinks } =
    parameters;

  type IIIFViewerComponent = Extract<
    WebElementComponent<T>,
    { component: "iiif-viewer" }
  >;
  const manifestLink = findWebsiteLink(
    websiteLinks,
    "resource",
    (link) => link.type === "IIIF",
  );
  if (manifestLink == null) {
    throw new Error(
      formatComponentError(
        "Manifest link not found",
        "iiif-viewer",
        elementResource,
      ),
      { cause: componentProperty },
    );
  }

  const variant = componentReader.valueOr<IIIFViewerComponent["variant"]>(
    "variant",
    "universal-viewer",
  );

  return { component: "iiif-viewer", linkUuid: manifestLink.uuid, variant };
}

function parseImageComponent<T extends ReadonlyArray<string>>(
  parameters: WebElementComponentParameters<T>,
): WebElementComponent<T> {
  const { componentProperty, componentReader, elementResource, websiteLinks } =
    parameters;

  type ImageComponent = Extract<WebElementComponent<T>, { component: "image" }>;
  if (websiteLinks.length === 0) {
    throw new Error(
      formatComponentError("No links found", "image", elementResource),
      { cause: componentProperty },
    );
  }

  const imageQuality = componentReader.valueOr<ImageComponent["imageQuality"]>(
    "image-quality",
    "high",
  );

  const images: Array<WebImage<T>> = Array.from(websiteLinks, (link) => ({
    uuid: link.uuid,
    label: link.identification.label,
    width: "image" in link ? (link.image?.width ?? 0) : 0,
    height: "image" in link ? (link.image?.height ?? 0) : 0,
    description: link.description,
    quality: imageQuality,
  }));

  const variant = componentReader.valueOr<ImageComponent["variant"]>(
    "variant",
    "default",
  );
  const captionLayout = componentReader.valueOr<
    ImageComponent["captionLayout"]
  >("layout-caption", "bottom");

  const width = readStringOrNumber(componentReader, "width");
  const height = readStringOrNumber(componentReader, "height");

  const isFullWidth = componentReader.valueOr<ImageComponent["isFullWidth"]>(
    "is-full-width",
    true,
  );
  const isFullHeight = componentReader.valueOr<ImageComponent["isFullHeight"]>(
    "is-full-height",
    true,
  );
  const captionSource = componentReader.valueOr<
    ImageComponent["captionSource"]
  >("source-caption", "name");
  const altTextSource = componentReader.valueOr<
    ImageComponent["altTextSource"]
  >("alt-text-source", "name");
  const isTransparentBackground = componentReader.valueOr<
    ImageComponent["isTransparentBackground"]
  >("is-transparent", false);
  const isCover = componentReader.valueOr<ImageComponent["isCover"]>(
    "is-cover",
    false,
  );
  const variantReader = componentReader.nested("variant");

  let carouselOptions: ImageComponent["carouselOptions"] | null = null;
  if (images.length > 1) {
    const secondsPerImage =
      variant === "carousel"
        ? readStringOrNumber(variantReader, "seconds-per-image")
        : null;

    carouselOptions = { secondsPerImage: Number(secondsPerImage ?? 5) };
  }

  let heroOptions: ImageComponent["heroOptions"] = null;
  if (variant === "hero") {
    const isBackgroundImageDisplayed = variantReader.valueOr<
      NonNullable<ImageComponent["heroOptions"]>["isBackgroundImageDisplayed"]
    >("background-image-displayed", true);
    const isDocumentDisplayed = variantReader.valueOr<
      NonNullable<ImageComponent["heroOptions"]>["isDocumentDisplayed"]
    >("document-displayed", true);

    heroOptions = { isBackgroundImageDisplayed, isDocumentDisplayed };
  }

  return {
    component: "image",
    images,
    variant,
    width,
    height,
    isFullWidth,
    isFullHeight,
    imageQuality,
    captionLayout,
    captionSource,
    altTextSource,
    isTransparentBackground,
    isCover,
    carouselOptions,
    heroOptions,
  };
}

function parseImageGalleryComponent<T extends ReadonlyArray<string>>(
  parameters: WebElementComponentParameters<T>,
): WebElementComponent<T> {
  const { componentProperty, componentReader, elementResource, websiteLinks } =
    parameters;

  type ImageGalleryComponent = Extract<
    WebElementComponent<T>,
    { component: "image-gallery" }
  >;
  const galleryLink = findWebsiteLinkByCategories(websiteLinks, [
    "set",
    "tree",
  ]);
  if (galleryLink == null) {
    throw new Error(
      formatComponentError(
        "Image gallery link not found",
        "image-gallery",
        elementResource,
      ),
      { cause: componentProperty },
    );
  }

  const isFilterInputDisplayed = componentReader.valueOr<
    ImageGalleryComponent["isFilterInputDisplayed"]
  >("filter-input-displayed", true);

  return {
    component: "image-gallery",
    linkUuid: galleryLink.uuid,
    isFilterInputDisplayed,
  };
}

function parseMapComponent<T extends ReadonlyArray<string>>(
  parameters: WebElementComponentParameters<T>,
): WebElementComponent<T> {
  const { componentProperty, componentReader, elementResource, websiteLinks } =
    parameters;

  type MapComponent = Extract<WebElementComponent<T>, { component: "map" }>;
  const mapLink = findWebsiteLinkByCategories(websiteLinks, ["set", "tree"]);
  if (mapLink == null) {
    throw new Error(
      formatComponentError("Map link not found", "map", elementResource),
      { cause: componentProperty },
    );
  }

  const isInteractive = componentReader.valueOr<MapComponent["isInteractive"]>(
    "is-interactive",
    true,
  );
  const isClustered = componentReader.valueOr<MapComponent["isClustered"]>(
    "is-clustered",
    false,
  );
  const isUsingPins = componentReader.valueOr<MapComponent["isUsingPins"]>(
    "is-using-pins",
    false,
  );
  const customBasemap =
    componentReader.value<MapComponent["customBasemap"]>("custom-basemap");

  let initialBounds: MapComponent["initialBounds"] | null = null;
  const initialBoundsProperty = componentReader.value<string | number>(
    "initial-bounds",
  );
  if (initialBoundsProperty !== null) {
    initialBounds = parseBounds(String(initialBoundsProperty));
  }

  let maximumBounds: MapComponent["maximumBounds"] | null = null;
  const maximumBoundsProperty = componentReader.value<string | number>(
    "maximum-bounds",
  );
  if (maximumBoundsProperty !== null) {
    maximumBounds = parseBounds(String(maximumBoundsProperty));
  }

  const isControlsDisplayed = componentReader.valueOr<
    MapComponent["isControlsDisplayed"]
  >("controls-displayed", false);
  const isFullHeight = componentReader.valueOr<MapComponent["isFullHeight"]>(
    "is-full-height",
    false,
  );

  return {
    component: "map",
    linkUuid: mapLink.uuid,
    customBasemap,
    initialBounds,
    maximumBounds,
    isInteractive,
    isClustered,
    isUsingPins,
    isControlsDisplayed,
    isFullHeight,
  };
}

type QueryComponentItems<T extends ReadonlyArray<string>> = Extract<
  WebElementComponent<T>,
  { component: "query" }
>["items"];

function parseQueryItemQueries<T extends ReadonlyArray<string>>(
  propertyVariables: ReadonlyArray<PropertyValueContent<T>>,
  queryLanguage: string,
  elementResource: XMLWebsiteResource,
): QueryComponentItems<T>[number]["queries"] {
  const queries: QueryComponentItems<T>[number]["queries"] = [];
  for (const propertyVariable of propertyVariables) {
    if (propertyVariable.uuid === null) {
      throw new Error(
        formatComponentError(
          "Property variable UUID not found",
          "query",
          elementResource,
        ),
        { cause: propertyVariable },
      );
    }

    const dataType = propertyVariable.dataType;
    if (dataType === "coordinate") {
      throw new Error(
        formatComponentError(
          'Query prompts with data type "coordinate" are not supported',
          "query",
          elementResource,
        ),
        { cause: propertyVariable },
      );
    }

    queries.push({
      target: "property",
      propertyVariable: propertyVariable.uuid,
      dataType,
      matchMode: "exact",
      isCaseSensitive: true,
      language: queryLanguage,
    });
  }

  return queries;
}

function parseQueryComponent<T extends ReadonlyArray<string>>(
  parameters: WebElementComponentParameters<T>,
): WebElementComponent<T> {
  const {
    componentProperty,
    componentReader,
    elementResource,
    websiteLinks,
    options,
  } = parameters;

  type QueryComponent = Extract<WebElementComponent<T>, { component: "query" }>;
  const setLinks = getWebsiteLinks(websiteLinks, "set");
  if (setLinks.length === 0) {
    throw new Error(
      formatComponentError("Set links not found", "query", elementResource),
      { cause: componentProperty },
    );
  }

  if (componentProperty.properties.length === 0) {
    throw new Error(
      formatComponentError(
        "Query properties not found",
        "query",
        elementResource,
      ),
      { cause: componentProperty },
    );
  }

  const items: Array<QueryComponent["items"][number]> = [];
  for (const queryItem of componentProperty.properties) {
    const queryReader = websitePresentationReader(queryItem.properties);

    const label = queryReader.multilingualValue("query-prompt", options);
    if (label === null) {
      continue;
    }

    const propertyVariables = queryReader
      .values("use-property")
      .filter((value) => value.uuid !== null);

    const queryLanguage = options.languages[0];
    if (queryLanguage == null) {
      throw new Error(
        formatComponentError(
          "Query language not found",
          "query",
          elementResource,
        ),
      );
    }

    const queries = parseQueryItemQueries(
      propertyVariables,
      queryLanguage,
      elementResource,
    );

    const startIcon =
      queryReader.value<QueryComponent["items"][number]["startIcon"]>(
        "start-icon",
      );
    const endIcon =
      queryReader.value<QueryComponent["items"][number]["endIcon"]>("end-icon");

    items.push({ label, queries, startIcon, endIcon });
  }

  if (items.length === 0) {
    throw new Error(
      formatComponentError("No queries found", "query", elementResource),
      { cause: componentProperty },
    );
  }

  const componentOptions = parseWebsiteOptions(
    elementResource.options,
    options,
  );

  const overrideReader = componentReader.nestedByValue(
    "sub-component-override",
    "collection",
  );

  const collectionProperties: QueryComponent["collectionProperties"] =
    parseCollectionPropertyOverrides(overrideReader);

  const displayedProperties =
    parseCollectionDisplayedProperties(componentReader);
  if (displayedProperties != null) {
    collectionProperties.displayedProperties = displayedProperties;
  }

  return {
    component: "query",
    linkUuids: setLinks.map((link) => link.uuid),
    items,
    options: componentOptions,
    collectionProperties,
  };
}

function parseTableComponent<T extends ReadonlyArray<string>>(
  parameters: WebElementComponentParameters<T>,
): WebElementComponent<T> {
  const { componentProperty, elementResource, websiteLinks } = parameters;

  const tableLink = findWebsiteLink(websiteLinks, "set");
  if (tableLink == null) {
    throw new Error(
      formatComponentError("Table link not found", "table", elementResource),
      { cause: componentProperty },
    );
  }

  return { component: "table", linkUuid: tableLink.uuid };
}

function parseSearchBarComponent<T extends ReadonlyArray<string>>(
  parameters: WebElementComponentParameters<T>,
): WebElementComponent<T> {
  const {
    componentProperty,
    componentReader,
    elementResource,
    options,
    context,
  } = parameters;

  type SearchBarComponent = Extract<
    WebElementComponent<T>,
    { component: "search-bar" }
  >;
  const queryVariant = componentReader.valueOr<
    SearchBarComponent["queryVariant"]
  >("query-variant", "submit");
  const boundElementUuid = componentReader.uuid("bound-element");
  const href = parseWebsiteLinkTarget(
    componentReader.valueNode("link-to"),
    context,
  );

  if (boundElementUuid === null && href === null) {
    throw new Error(
      formatComponentError(
        "Bound element or href not found",
        "search-bar",
        elementResource,
      ),
      { cause: componentProperty },
    );
  }

  const placeholder = componentReader.multilingualValue(
    "placeholder-text",
    options,
  );

  const baseFilterQueries = componentReader.value<
    SearchBarComponent["baseFilterQueries"]
  >("base-filter-queries");

  return {
    component: "search-bar",
    queryVariant,
    placeholder,
    baseFilterQueries:
      baseFilterQueries
        ?.replaceAll(String.raw`\{`, "{")
        .replaceAll(String.raw`\}`, "}") ?? null,
    boundElementUuid,
    href,
  };
}

function parseTextComponent<T extends ReadonlyArray<string>>(
  parameters: WebElementComponentParameters<T>,
): WebElementComponent<T> {
  const { componentProperty, componentReader, elementResource, options } =
    parameters;

  type TextComponent = Extract<WebElementComponent<T>, { component: "text" }>;
  type TextVariantWithName<U extends TextComponent["variant"]["name"]> =
    Extract<TextComponent["variant"], { name: U }>;
  const content =
    elementResource.document && "content" in elementResource.document
      ? parseXMLContent(elementResource.document, options)
      : null;
  if (content == null) {
    throw new Error(
      formatComponentError("Content not found", "text", elementResource),
      { cause: componentProperty },
    );
  }

  let variantName: TextComponent["variant"]["name"] = "block";
  let variant: TextComponent["variant"];

  const variantProperty = componentReader.property("variant");
  if (variantProperty !== null) {
    const variantReader = websitePresentationReader(variantProperty.properties);
    variantName = variantProperty.values[0]!
      .content as TextComponent["variant"]["name"];

    switch (variantName) {
      case "paragraph": {
        variant = {
          name: variantName,
          size: variantReader.valueOr<TextVariantWithName<"paragraph">["size"]>(
            "size",
            "md",
          ),
        };
        break;
      }
      case "label": {
        variant = {
          name: variantName,
          size: variantReader.valueOr<TextVariantWithName<"label">["size"]>(
            "size",
            "md",
          ),
        };
        break;
      }
      case "heading": {
        variant = {
          name: variantName,
          size: variantReader.valueOr<TextVariantWithName<"heading">["size"]>(
            "size",
            "md",
          ),
        };
        break;
      }
      case "display": {
        variant = {
          name: variantName,
          size: variantReader.valueOr<TextVariantWithName<"display">["size"]>(
            "size",
            "md",
          ),
        };
        break;
      }
      default: {
        variant = { name: variantName };
      }
    }
  } else {
    variant = { name: variantName };
  }

  const headingLevel =
    componentReader.value<TextComponent["headingLevel"]>("heading-level");

  return { component: "text", variant, headingLevel, content };
}

function parseTimelineComponent<T extends ReadonlyArray<string>>(
  parameters: WebElementComponentParameters<T>,
): WebElementComponent<T> {
  const { componentProperty, elementResource, websiteLinks } = parameters;

  const timelineLink = findWebsiteLink(websiteLinks, "tree");
  if (timelineLink == null) {
    throw new Error(
      formatComponentError(
        "Timeline link not found",
        "timeline",
        elementResource,
      ),
      { cause: componentProperty },
    );
  }

  return { component: "timeline", linkUuid: timelineLink.uuid };
}

function parseVideoComponent<T extends ReadonlyArray<string>>(
  parameters: WebElementComponentParameters<T>,
): WebElementComponent<T> {
  const { componentProperty, componentReader, elementResource, websiteLinks } =
    parameters;

  const videoLink = findWebsiteLink(
    websiteLinks,
    "resource",
    (link) => link.type === "video",
  );
  if (videoLink == null) {
    throw new Error(
      formatComponentError("Video link not found", "video", elementResource),
      { cause: componentProperty },
    );
  }

  const isChaptersDisplayed = componentReader.valueOr<
    Extract<
      WebElementComponent<T>,
      { component: "video" }
    >["isChaptersDisplayed"]
  >("chapters-displayed", true);

  return { component: "video", linkUuid: videoLink.uuid, isChaptersDisplayed };
}

/**
 * Parses raw web element properties into a standardized WebElementComponent structure
 *
 * @param componentProperty - Raw component property data in OCHRE format
 * @param elementResource - Raw element resource data in OCHRE format
 * @returns Parsed WebElementComponent object
 */
function parseWebElementProperties<T extends ReadonlyArray<string>>(
  componentProperty: SimplifiedProperty<T>,
  elementResource: XMLWebsiteResource,
  options: ParserOptions<T>,
  context: WebsiteParseContext<T>,
): WebElementComponent<T> {
  const unparsedComponentName = componentProperty.values[0]!.content;
  const componentNameResult = v.safeParse(
    componentSchema,
    unparsedComponentName,
  );
  const componentName = componentNameResult.success
    ? componentNameResult.output
    : undefined;

  const websiteLinks = parseLinks(elementResource.links, options);
  const componentReader = websitePresentationReader(
    componentProperty.properties,
  );

  const parameters: WebElementComponentParameters<T> = {
    componentProperty,
    componentReader,
    elementResource,
    websiteLinks,
    options,
    context,
  };

  switch (componentName) {
    case "3d-viewer": {
      return parse3dViewerComponent(parameters);
    }
    case "advanced-search": {
      return parseAdvancedSearchComponent(parameters);
    }
    case "annotated-document": {
      return parseAnnotatedDocumentComponent(parameters);
    }
    case "annotated-image": {
      return parseAnnotatedImageComponent(parameters);
    }
    case "audio-player": {
      return parseAudioPlayerComponent(parameters);
    }
    case "bibliography": {
      return parseBibliographyComponent(parameters);
    }
    case "button": {
      return parseButtonComponent(parameters);
    }
    case "collection": {
      return parseCollectionComponent(parameters);
    }
    case "empty-space": {
      return parseEmptySpaceComponent(parameters);
    }
    case "entries": {
      return parseEntriesComponent(parameters);
    }
    case "iframe": {
      return parseIframeComponent(parameters);
    }
    case "iiif-viewer": {
      return parseIiifViewerComponent(parameters);
    }
    case "image": {
      return parseImageComponent(parameters);
    }
    case "image-gallery": {
      return parseImageGalleryComponent(parameters);
    }
    case "map": {
      return parseMapComponent(parameters);
    }
    case "query": {
      return parseQueryComponent(parameters);
    }
    case "table": {
      return parseTableComponent(parameters);
    }
    case "search-bar": {
      return parseSearchBarComponent(parameters);
    }
    case "text": {
      return parseTextComponent(parameters);
    }
    case "timeline": {
      return parseTimelineComponent(parameters);
    }
    case "video": {
      return parseVideoComponent(parameters);
    }
    default: {
      throw new Error(
        `Invalid or non-implemented component name “${unparsedComponentName.toString()}” for the following element: “${parseStringContent(
          elementResource.identification.label,
          options,
        )}”`,
      );
    }
  }
}

function parseWebTitle<T extends ReadonlyArray<string>>(
  properties: Array<SimplifiedProperty<T>>,
  identification: Identification<T>,
  overrides?: Partial<WebTitle<T>["properties"]>,
): WebTitle<T> {
  const title: WebTitle<T> = {
    label: identification.label,
    variant: "default",
    properties: {
      isNameDisplayed: overrides?.isNameDisplayed ?? false,
      isDescriptionDisplayed: overrides?.isDescriptionDisplayed ?? false,
      isDateDisplayed: overrides?.isDateDisplayed ?? false,
      isCreatorsDisplayed: overrides?.isCreatorsDisplayed ?? false,
      isCountDisplayed: overrides?.isCountDisplayed ?? false,
    },
  };

  const titleReader = websitePresentationReader(properties).nestedByValue(
    "presentation",
    "title",
  );
  if (titleReader.size > 0) {
    title.variant = titleReader.valueOr<WebTitle<T>["variant"]>(
      "variant",
      "default",
    );

    title.properties.isNameDisplayed = titleReader.valueOr<
      WebTitle<T>["properties"]["isNameDisplayed"]
    >("name-displayed", false);

    title.properties.isDescriptionDisplayed = titleReader.valueOr<
      WebTitle<T>["properties"]["isDescriptionDisplayed"]
    >("description-displayed", false);

    title.properties.isDateDisplayed = titleReader.valueOr<
      WebTitle<T>["properties"]["isDateDisplayed"]
    >("date-displayed", false);

    title.properties.isCreatorsDisplayed = titleReader.valueOr<
      WebTitle<T>["properties"]["isCreatorsDisplayed"]
    >("creators-displayed", false);

    title.properties.isCountDisplayed = titleReader.valueOr<
      WebTitle<T>["properties"]["isCountDisplayed"]
    >("count-displayed", false);
  }

  return title;
}

/**
 * Parses raw web element data into a standardized WebElement structure
 *
 * @param elementResource - Raw element resource data in OCHRE format
 * @returns Parsed WebElement object
 */
function parseWebElement<T extends ReadonlyArray<string>>(
  elementResource: XMLWebsiteResource,
  options: ParserOptions<T>,
  context: WebsiteParseContext<T>,
): WebElement<T> {
  const identification = parseIdentification(
    elementResource.identification,
    options,
  );

  const elementProperties = parseSimplifiedProperties(
    elementResource.properties,
    options,
  );
  const elementReader = websitePresentationReader(elementProperties);

  const presentationProperty = elementReader.requiredProperty(
    "presentation",
    `Presentation property not found for element (${formatXMLWebsiteResourceMetadata(
      elementResource,
    )})`,
  );

  const componentProperty = websitePresentationReader(
    presentationProperty.properties,
  ).requiredProperty(
    "component",
    `Component property not found for element (${formatXMLWebsiteResourceMetadata(
      elementResource,
    )})`,
  );

  const properties = parseWebElementProperties(
    componentProperty,
    elementResource,
    options,
    context,
  );

  const cssStyles = parseResponsiveCssStyles(elementProperties);

  const title = parseWebTitle(elementProperties, identification, {
    isNameDisplayed: [
      "annotated-image",
      "annotated-document",
      "collection",
    ].includes(properties.component),
    isCountDisplayed: properties.component === "collection",
  });

  return {
    uuid: elementResource.uuid,
    language: elementResource.lang ?? null,
    type: "element",
    title,
    cssStyles,
    ...properties,
  };
}

function isSidebarResource<T extends ReadonlyArray<string>>(
  resource: XMLWebsiteResource,
  options: ParserOptions<T>,
): boolean {
  const resourceProperties = parseSimplifiedProperties(
    resource.properties,
    options,
  );
  const resourceReader = websitePresentationReader(resourceProperties);

  return (
    resourceReader.value("presentation") === "element" &&
    resourceReader
      .nestedByValue("presentation", "element")
      .value("component") === "sidebar"
  );
}

function parseWebBlockItems<T extends ReadonlyArray<string>>(
  resources: Array<XMLWebsiteResource>,
  options: ParserOptions<T>,
  context: WebsiteParseContext<T>,
): Array<WebBlockItem<T>> {
  const items: Array<WebBlockItem<T>> = [];
  for (const resource of resources) {
    const resourceProperties = parseSimplifiedProperties(
      resource.properties,
      options,
    );

    const resourceType = websitePresentationReader(resourceProperties).value<
      "element" | "block"
    >("presentation");
    if (resourceType === null) {
      continue;
    }

    switch (resourceType) {
      case "element": {
        items.push(parseWebElement(resource, options, context));
        break;
      }
      case "block": {
        const block = parseWebBlock(resource, options, context);
        if (block) {
          items.push(block);
        }
        break;
      }
    }
  }

  return items;
}

function parseWebpageRedirect<T extends ReadonlyArray<string>>(
  redirectValue: PropertyValueContent<T> | null,
  context: WebsiteParseContext<T>,
): Webpage<T>["properties"]["redirect"] {
  const redirectTarget = parseWebsiteLinkTarget(redirectValue, context);
  if (redirectTarget != null) {
    if (redirectValue?.href == null && redirectValue?.uuid != null) {
      return { type: "page", slug: redirectTarget, uuid: redirectValue.uuid };
    }

    return {
      type: "url",
      href: redirectTarget,
      isExternal: redirectTarget.startsWith("http"),
    };
  }

  if (redirectValue?.uuid != null) {
    return { type: "item", uuid: redirectValue.uuid, pageType: "item" };
  }

  return null;
}

/**
 * Parses raw webpage data into a standardized Webpage structure
 *
 * @param webpageResource - Raw webpage resource data in OCHRE format
 * @returns Parsed Webpage object
 */
function parseWebpage<T extends ReadonlyArray<string>>(
  webpageResource: XMLWebsiteResource,
  options: ParserOptions<T>,
  context: WebsiteParseContext<T>,
  slugPrefix?: string,
): Webpage<T> | null {
  const webpageProperties = parseSimplifiedProperties(
    webpageResource.properties,
    options,
  );
  const webpageReader = websitePresentationReader(webpageProperties);

  if (webpageReader.value("presentation") !== "page") {
    return null;
  }

  const identification = parseIdentification(
    webpageResource.identification,
    options,
  );

  // TODO: Remove this once OCHRE is updated to allow segment-unique slugs
  const slug = cleanWebsitePageSlug(webpageResource.slug);

  if (slug == null) {
    throw new Error(
      `Slug not found for page (${formatXMLWebsiteResourceMetadata(webpageResource)})`,
      { cause: webpageResource },
    );
  }

  const returnWebpage: Webpage<T> = {
    uuid: webpageResource.uuid,
    type: "page",
    title: identification.label,
    slug: prefixSlug(slug, slugPrefix),
    publicationDateTime: webpageResource.publicationDateTime ?? null,
    items: [],
    segments: [],
    properties: {
      width: "default",
      variant: "default",
      isBreadcrumbsDisplayed: false,
      isSidebarDisplayed: true,
      isDisplayedInNavbar: true,
      isNavbarSearchBarDisplayed: true,
      redirect: null,
      backgroundImage: null,
      sidebar: null,
      cssStyles: { default: [], tablet: [], mobile: [] },
    },
    webpages: [],
  };

  const websiteLinks = parseLinks(webpageResource.links, options);
  const imageLink = findWebsiteLink(
    websiteLinks,
    "resource",
    (link) => link.type === "image" || link.type === "IIIF",
  );

  const webpageResources = normalizeWebsiteResources(webpageResource.resource);

  returnWebpage.items = parseWebBlockItems(
    webpageResources.filter(
      (resource) => !isSidebarResource(resource, options),
    ),
    options,
    context,
  );

  returnWebpage.webpages = parseWebpages(
    webpageResources,
    options,
    context,
    slugPrefix == null ? undefined : returnWebpage.slug,
  );

  returnWebpage.segments = parseWebsiteSegments(
    webpageResource.resource,
    context,
    options,
    returnWebpage.slug,
  );

  returnWebpage.properties.sidebar = parseSidebar(
    webpageResources,
    options,
    context,
  );

  const pageReader = webpageReader.nestedByValue("presentation", "page");
  if (pageReader.size > 0) {
    returnWebpage.properties.isDisplayedInNavbar = pageReader.valueOr<
      Webpage<T>["properties"]["isDisplayedInNavbar"]
    >("displayed-in-navbar", true);

    returnWebpage.properties.width = pageReader.valueOr<
      Webpage<T>["properties"]["width"]
    >("width", "default");

    returnWebpage.properties.variant = pageReader.valueOr<
      Webpage<T>["properties"]["variant"]
    >("variant", "default");

    returnWebpage.properties.isSidebarDisplayed = pageReader.valueOr<
      Webpage<T>["properties"]["isSidebarDisplayed"]
    >("sidebar-displayed", true);

    returnWebpage.properties.isBreadcrumbsDisplayed = pageReader.valueOr<
      Webpage<T>["properties"]["isBreadcrumbsDisplayed"]
    >("breadcrumbs-displayed", false);

    returnWebpage.properties.isNavbarSearchBarDisplayed = pageReader.valueOr<
      Webpage<T>["properties"]["isNavbarSearchBarDisplayed"]
    >("navbar-search-bar-displayed", true);

    returnWebpage.properties.redirect = parseWebpageRedirect(
      pageReader.valueNode("redirect-to"),
      context,
    );
  }

  if (imageLink != null) {
    returnWebpage.properties.backgroundImage = {
      uuid: imageLink.uuid,
      label: imageLink.identification.label,
      description: imageLink.description,
      width: imageLink.image?.width ?? 0,
      height: imageLink.image?.height ?? 0,
      quality: "high",
    };
  }

  returnWebpage.properties.cssStyles =
    parseResponsiveCssStyles(webpageProperties);

  return returnWebpage;
}

/**
 * Parses raw webpage resources into an array of Webpage objects
 *
 * @param webpageResources - Array of raw webpage resources in OCHRE format
 * @returns Array of parsed Webpage objects
 */
function parseWebpages<T extends ReadonlyArray<string>>(
  webpageResources: Array<XMLWebsiteResource>,
  options: ParserOptions<T>,
  context: WebsiteParseContext<T>,
  slugPrefix?: string,
): Array<Webpage<T>> {
  const returnPages: Array<Webpage<T>> = [];

  for (const webpageResource of webpageResources) {
    const webpage = parseWebpage(webpageResource, options, context, slugPrefix);
    if (webpage !== null) {
      returnPages.push(webpage);
    }
  }

  return returnPages;
}

export function parseWebpageView<T extends ReadonlyArray<string>>(
  view: { resource?: Array<XMLWebsiteResource> } | undefined,
  options: ParserOptions<T>,
  context: Pick<Website<T>, "belongsTo" | "metadata">,
): Webpage<T> | null {
  return parseWebpages(view?.resource ?? [], options, context)[0] ?? null;
}

function parseWebsiteSegments<T extends ReadonlyArray<string>>(
  resources: Array<XMLWebsiteResourceItem> | undefined,
  context: WebsiteParseContext<T>,
  options: ParserOptions<T>,
  slugPrefix: string,
): Array<WebsiteSegment<T>> {
  const segments: Array<WebsiteSegment<T>> = [];

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

      segments.push(
        parseWebsiteTree(
          tree,
          context,
          "segment",
          options,
          prefixSlug(segmentSlug, slugPrefix),
        ),
      );
    }
  }

  return segments;
}

/**
 * Parses raw sidebar data into a standardized Sidebar structure
 *
 * @param resources - Array of raw sidebar resources in OCHRE format
 * @returns Parsed Sidebar object
 */
function parseSidebar<T extends ReadonlyArray<string>>(
  resources: Array<XMLWebsiteResource>,
  options: ParserOptions<T>,
  context: WebsiteParseContext<T>,
): WebSidebar<T> | null {
  const sidebarResource = resources.find((resource) =>
    isSidebarResource(resource, options),
  );
  if (sidebarResource == null) {
    return null;
  }

  const sidebarBaseProperties = parseSimplifiedProperties(
    sidebarResource.properties,
    options,
  );
  const sidebarResources = normalizeWebsiteResources(sidebarResource.resource);
  const items = parseWebBlockItems(sidebarResources, options, context);
  if (items.length === 0) {
    return null;
  }

  const sidebarReader = websitePresentationReader(sidebarBaseProperties)
    .nestedByValue("presentation", "element")
    .nestedByValue("component", "sidebar");

  return {
    isDisplayed: true,
    items,
    title: parseWebTitle(
      sidebarBaseProperties,
      parseIdentification(sidebarResource.identification, options),
    ),
    layout: sidebarReader.valueOr<WebSidebar<T>["layout"]>("layout", "start"),
    mobileLayout: sidebarReader.valueOr<WebSidebar<T>["mobileLayout"]>(
      "layout-mobile",
      "default",
    ),
    cssStyles: parseResponsiveCssStyles(sidebarBaseProperties),
  };
}

function parseWebAccordionItem<T extends ReadonlyArray<string>>(
  elementResource: XMLWebsiteResource,
  childResources: Array<XMLWebsiteResource>,
  options: ParserOptions<T>,
  context: WebsiteParseContext<T>,
): WebAccordionItem<T> {
  const trigger = parseWebElement(
    elementResource,
    options,
    context,
  ) as WebAccordionItem<T>["trigger"];

  const items = parseWebBlockItems(childResources, options, context);

  return { uuid: trigger.uuid, type: "accordion-item", trigger, items };
}

function parseBlockOverwrite<T extends ReadonlyArray<string>>(
  overwriteReader: WebsitePresentationReader<T>,
  isDefaultLayoutAccordion: boolean,
): WebBlock<T>["properties"]["tablet"] {
  if (overwriteReader.size === 0) {
    return null;
  }

  type BlockOverwrite = NonNullable<WebBlock<T>["properties"]["tablet"]>;
  const properties: BlockOverwrite = {
    layout:
      overwriteReader.value<BlockOverwrite["layout"]>("layout") ?? undefined,
    wrap: overwriteReader.value<BlockOverwrite["wrap"]>("wrap") ?? undefined,
    spacing:
      overwriteReader.value<BlockOverwrite["spacing"]>("spacing") ?? undefined,
    gap: overwriteReader.value<BlockOverwrite["gap"]>("gap") ?? undefined,
    isAccordionEnabled: undefined,
    isAccordionExpandedByDefault: undefined,
    isAccordionSidebarDisplayed: undefined,
  };

  if (isDefaultLayoutAccordion || properties.layout === "accordion") {
    properties.isAccordionEnabled =
      overwriteReader.value<BlockOverwrite["isAccordionEnabled"]>(
        "accordion-enabled",
      ) ?? undefined;
    properties.isAccordionExpandedByDefault =
      overwriteReader.value<BlockOverwrite["isAccordionExpandedByDefault"]>(
        "accordion-expanded",
      ) ?? undefined;
    properties.isAccordionSidebarDisplayed =
      overwriteReader.value<BlockOverwrite["isAccordionSidebarDisplayed"]>(
        "accordion-sidebar-displayed",
      ) ?? undefined;
  }

  const cleanedProperties = cleanObject(properties);

  return Object.keys(cleanedProperties).length > 0 ? cleanedProperties : null;
}

function parseAccordionAwareBlockItems<T extends ReadonlyArray<string>>(
  blockResources: Array<XMLWebsiteResource>,
  options: ParserOptions<T>,
  context: WebsiteParseContext<T>,
  isSupportingAccordionItems: boolean,
): Array<WebAccordionItem<T> | WebBlockItem<T>> {
  const blockItems: Array<WebAccordionItem<T> | WebBlockItem<T>> = [];
  for (const resource of blockResources) {
    const resourceProperties = parseSimplifiedProperties(
      resource.properties,
      options,
    );
    const resourceReader = websitePresentationReader(resourceProperties);

    const resourceType = resourceReader.value<"element" | "block">(
      "presentation",
    );
    if (resourceType === null) {
      continue;
    }

    switch (resourceType) {
      case "element": {
        const childResources = normalizeWebsiteResources(resource.resource);
        const componentType = resourceReader
          .nestedByValue("presentation", "element")
          .value<string>("component");

        blockItems.push(
          isSupportingAccordionItems &&
            componentType === "text" &&
            childResources.length > 0
            ? parseWebAccordionItem(resource, childResources, options, context)
            : parseWebElement(resource, options, context),
        );
        break;
      }
      case "block": {
        const block = parseWebBlock(resource, options, context);
        if (block) {
          blockItems.push(block);
        }
        break;
      }
    }
  }

  return blockItems;
}

/**
 * Parses raw block data into a standardized WebBlock structure
 *
 * @param blockResource - Raw block resource data in OCHRE format
 * @returns Parsed WebBlock object
 */
function parseWebBlock<T extends ReadonlyArray<string>>(
  blockResource: XMLWebsiteResource,
  options: ParserOptions<T>,
  context: WebsiteParseContext<T>,
): WebBlock<T> | null {
  const blockProperties = parseSimplifiedProperties(
    blockResource.properties,
    options,
  );

  const returnBlock: WebBlock<T> = {
    uuid: blockResource.uuid,
    language: blockResource.lang ?? null,
    type: "block",
    title: parseWebTitle(
      blockProperties,
      parseIdentification(blockResource.identification, options),
    ),
    items: [],
    properties: {
      default: { layout: "vertical", wrap: "nowrap", spacing: null, gap: null },
      mobile: null,
      tablet: null,
    } as WebBlock<T>["properties"],
    cssStyles: { default: [], tablet: [], mobile: [] },
  };

  const blockReader = websitePresentationReader(blockProperties).nestedByValue(
    "presentation",
    "block",
  );
  if (blockReader.size > 0) {
    returnBlock.properties.default.layout = blockReader.valueOr<
      WebBlock<T>["properties"]["default"]["layout"]
    >("layout", "vertical");

    returnBlock.properties.default.wrap = blockReader.valueOr<
      WebBlock<T>["properties"]["default"]["wrap"]
    >("wrap", "nowrap");

    if (returnBlock.properties.default.layout === "accordion") {
      returnBlock.properties.default.isAccordionEnabled = blockReader.valueOr<
        WebBlock<T>["properties"]["default"]["isAccordionEnabled"]
      >("accordion-enabled", true);

      returnBlock.properties.default.isAccordionExpandedByDefault =
        blockReader.valueOr<
          WebBlock<T>["properties"]["default"]["isAccordionExpandedByDefault"]
        >("accordion-expanded", true);

      returnBlock.properties.default.isAccordionSidebarDisplayed =
        blockReader.valueOr<
          WebBlock<T>["properties"]["default"]["isAccordionSidebarDisplayed"]
        >("accordion-sidebar-displayed", false);
    }

    returnBlock.properties.default.spacing = blockReader.valueOr<
      WebBlock<T>["properties"]["default"]["spacing"]
    >("spacing", null);

    returnBlock.properties.default.gap = blockReader.valueOr<
      WebBlock<T>["properties"]["default"]["gap"]
    >("gap", null);

    const isDefaultLayoutAccordion =
      returnBlock.properties.default.layout === "accordion";
    returnBlock.properties.tablet = parseBlockOverwrite(
      blockReader.nested("overwrite-tablet"),
      isDefaultLayoutAccordion,
    );
    returnBlock.properties.mobile = parseBlockOverwrite(
      blockReader.nested("overwrite-mobile"),
      isDefaultLayoutAccordion,
    );
  }

  const blockResources = normalizeWebsiteResources(blockResource.resource);

  const isSupportingAccordionItems =
    returnBlock.properties.default.layout === "accordion" ||
    returnBlock.properties.tablet?.layout === "accordion" ||
    returnBlock.properties.mobile?.layout === "accordion";

  returnBlock.items = parseAccordionAwareBlockItems(
    blockResources,
    options,
    context,
    isSupportingAccordionItems,
  );

  returnBlock.cssStyles = parseResponsiveCssStyles(blockProperties);

  return returnBlock;
}

/**
 * Parses raw website properties into a standardized Website properties structure
 *
 * @param properties - Array of raw website properties in OCHRE format
 * @returns Parsed WebsiteProperties object
 */
function parseWebsiteProperties<T extends ReadonlyArray<string>>(
  properties: XMLWebsiteProperties["property"],
  websiteTree: XMLWebsiteTree,
  sidebar: WebSidebar<T> | null,
  options: ParserOptions<T>,
  parent: Website<T>["properties"] | null,
): Website<T>["properties"] {
  const mainProperties = parseSimplifiedProperties(
    { property: properties },
    options,
  );
  const websiteReader =
    websitePresentationReader(mainProperties).nested("presentation");

  const type = websiteReader.valueOr<Website<T>["properties"]["type"]>(
    "webUI",
    parent?.type ?? "traditional",
  );

  const status = websiteReader.valueOr<Website<T>["properties"]["status"]>(
    "status",
    parent?.status ?? "development",
  );

  const versionLabel = websiteReader.valueOr<
    Website<T>["properties"]["versionLabel"]
  >("version-label", parent?.versionLabel ?? "release");

  const privacy = websiteReader.valueOr<Website<T>["properties"]["privacy"]>(
    "privacy",
    parent?.privacy ?? "public",
  );

  const returnProperties: Website<T>["properties"] = {
    type,
    status,
    versionLabel,
    privacy,
    contact: parent?.contact ?? null,
    loadingVariant: "spinner",
    theme: { isThemeToggleDisplayed: true, defaultTheme: "system" },
    icon: { logoUuid: null, faviconUuid: null, appleTouchIconUuid: null },
    navbar: {
      isDisplayed: true,
      variant: "default",
      alignment: "start",
      isProjectDisplayed: true,
      searchBarBoundElementUuid: null,
      items: parent?.navbar.items ?? null,
    },
    footer: {
      isDisplayed: true,
      logoUuid: null,
      items: parent?.footer.items ?? null,
    },
    sidebar: sidebar ?? parent?.sidebar ?? null,
    itemPage: {
      isMainContentDisplayed: parent?.itemPage.isMainContentDisplayed ?? true,
      description: {
        isDisplayed: parent?.itemPage.description.isDisplayed ?? true,
        isHeaderDisplayed:
          parent?.itemPage.description.isHeaderDisplayed ?? true,
      },
      document: {
        isDisplayed: parent?.itemPage.document.isDisplayed ?? true,
        isHeaderDisplayed: parent?.itemPage.document.isHeaderDisplayed ?? true,
      },
      notes: {
        isDisplayed: parent?.itemPage.notes.isDisplayed ?? true,
        isHeaderDisplayed: parent?.itemPage.notes.isHeaderDisplayed ?? true,
        variant: parent?.itemPage.notes.variant ?? "discrete",
      },
      events: {
        isDisplayed: parent?.itemPage.events.isDisplayed ?? true,
        isHeaderDisplayed: parent?.itemPage.events.isHeaderDisplayed ?? true,
        variant: parent?.itemPage.events.variant ?? "tabular",
      },
      periods: {
        isDisplayed: parent?.itemPage.periods.isDisplayed ?? true,
        isHeaderDisplayed: parent?.itemPage.periods.isHeaderDisplayed ?? true,
      },
      isPropertiesDisplayed: parent?.itemPage.isPropertiesDisplayed ?? true,
      bibliography: {
        isDisplayed: parent?.itemPage.bibliography.isDisplayed ?? true,
        isHeaderDisplayed:
          parent?.itemPage.bibliography.isHeaderDisplayed ?? true,
      },
      isPropertyValuesGrouped: parent?.itemPage.isPropertyValuesGrouped ?? true,
      isPublicationDateTimeDisplayed:
        parent?.itemPage.isPublicationDateTimeDisplayed ?? true,
      isPersistentIdentifierDisplayed:
        parent?.itemPage.isPersistentIdentifierDisplayed ?? true,
      iiifViewer: parent?.itemPage.iiifViewer ?? "universal-viewer",
    },
    options: {
      contextTree: parent?.options.contextTree ?? null,
      scopes: parent?.options.scopes ?? null,
      labels: { title: parent?.options.labels.title ?? null },
      stylesheets: { properties: parent?.options.stylesheets.properties ?? [] },
    },
  };

  const contactProperty = websiteReader.property("contact");
  if (contactProperty !== null) {
    const contactContent =
      contactProperty.values[0]?.content.toString().split(";") ?? [];
    if (contactContent.length === 2) {
      returnProperties.contact = {
        name: contactContent[0]!,
        email: contactContent[1] ?? null,
      };
    } else {
      throw new Error(
        `Contact property must use “name;email”, got “${contactProperty.values[0]?.content}” (website uuid “${websiteTree.uuid}”)`,
        { cause: websiteTree },
      );
    }
  }

  returnProperties.loadingVariant = websiteReader.valueOr<
    Website<T>["properties"]["loadingVariant"]
  >("loading-variant", parent?.loadingVariant ?? "spinner");

  returnProperties.theme.isThemeToggleDisplayed = websiteReader.valueOr<
    Website<T>["properties"]["theme"]["isThemeToggleDisplayed"]
  >("supports-theme-toggle", parent?.theme.isThemeToggleDisplayed ?? true);

  returnProperties.theme.defaultTheme = websiteReader.valueOr<
    Website<T>["properties"]["theme"]["defaultTheme"]
  >("default-theme", parent?.theme.defaultTheme ?? "system");

  returnProperties.icon.logoUuid =
    websiteReader.uuid("navbar-logo") ?? parent?.icon.logoUuid ?? null;

  returnProperties.icon.faviconUuid =
    websiteReader.uuid("favicon-ico") ?? parent?.icon.faviconUuid ?? null;

  returnProperties.icon.appleTouchIconUuid =
    websiteReader.uuid("favicon-img") ??
    parent?.icon.appleTouchIconUuid ??
    null;

  returnProperties.navbar.isDisplayed = websiteReader.valueOr<
    Website<T>["properties"]["navbar"]["isDisplayed"]
  >("navbar-displayed", parent?.navbar.isDisplayed ?? true);

  returnProperties.navbar.variant = websiteReader.valueOr<
    Website<T>["properties"]["navbar"]["variant"]
  >("navbar-variant", parent?.navbar.variant ?? "default");

  returnProperties.navbar.alignment = websiteReader.valueOr<
    Website<T>["properties"]["navbar"]["alignment"]
  >("navbar-alignment", parent?.navbar.alignment ?? "start");

  returnProperties.navbar.isProjectDisplayed = websiteReader.valueOr<
    Website<T>["properties"]["navbar"]["isProjectDisplayed"]
  >("navbar-project-displayed", parent?.navbar.isProjectDisplayed ?? true);

  returnProperties.navbar.searchBarBoundElementUuid =
    websiteReader.uuid("bound-element-navbar-search-bar") ??
    parent?.navbar.searchBarBoundElementUuid ??
    null;

  returnProperties.footer.isDisplayed = websiteReader.valueOr<
    Website<T>["properties"]["footer"]["isDisplayed"]
  >("footer-displayed", parent?.footer.isDisplayed ?? true);

  returnProperties.footer.logoUuid =
    websiteReader.uuid("footer-logo") ?? parent?.footer.logoUuid ?? null;

  const itemPageReader = websiteReader.nestedByValue("page-type", "item-page");
  if (itemPageReader.size > 0) {
    const itemPageSections = [
      ["description", "description"],
      ["document", "document"],
      ["notes", "notes"],
      ["events", "events"],
      ["periods", "periods"],
      ["bibliography", "bibliography"],
    ] as const;

    for (const [key, slug] of itemPageSections) {
      const section: { isDisplayed: boolean; isHeaderDisplayed: boolean } =
        returnProperties.itemPage[key];

      section.isDisplayed = itemPageReader.valueOr<boolean>(
        `item-page-${slug}-displayed`,
        section.isDisplayed,
      );

      section.isHeaderDisplayed = itemPageReader.valueOr<boolean>(
        `item-page-${slug}-header-displayed`,
        section.isHeaderDisplayed,
      );
    }

    returnProperties.itemPage.notes.variant = itemPageReader.valueOr<
      Website<T>["properties"]["itemPage"]["notes"]["variant"]
    >(
      "item-page-notes-display-variant",
      returnProperties.itemPage.notes.variant,
    );

    returnProperties.itemPage.events.variant = itemPageReader.valueOr<
      Website<T>["properties"]["itemPage"]["events"]["variant"]
    >(
      "item-page-events-display-variant",
      returnProperties.itemPage.events.variant,
    );

    returnProperties.itemPage.isPropertyValuesGrouped = itemPageReader.valueOr<
      Website<T>["properties"]["itemPage"]["isPropertyValuesGrouped"]
    >(
      "item-page-property-values-grouped",
      returnProperties.itemPage.isPropertyValuesGrouped,
    );

    returnProperties.itemPage.isPublicationDateTimeDisplayed =
      itemPageReader.valueOr<
        Website<T>["properties"]["itemPage"]["isPublicationDateTimeDisplayed"]
      >(
        "item-page-publication-date-time-displayed",
        returnProperties.itemPage.isPublicationDateTimeDisplayed,
      );

    returnProperties.itemPage.isPersistentIdentifierDisplayed =
      itemPageReader.valueOr<
        Website<T>["properties"]["itemPage"]["isPersistentIdentifierDisplayed"]
      >(
        "item-page-persistent-identifier-displayed",
        returnProperties.itemPage.isPersistentIdentifierDisplayed,
      );

    returnProperties.itemPage.iiifViewer = itemPageReader.valueOr<
      Website<T>["properties"]["itemPage"]["iiifViewer"]
    >("item-page-iiif-viewer", returnProperties.itemPage.iiifViewer);
  }

  if (websiteTree.options != null) {
    const parsedOptions = parseWebsiteOptions(websiteTree.options, options);
    returnProperties.options.scopes = (
      parsedOptions.scopes != null && parsedOptions.scopes.length > 0
        ? parsedOptions
        : returnProperties.options
    ).scopes;
    returnProperties.options.contextTree =
      parsedOptions.contextTree ?? returnProperties.options.contextTree;
    returnProperties.options.labels = {
      title:
        parsedOptions.labels.title ?? returnProperties.options.labels.title,
    };
  }

  if ("styleOptions" in websiteTree && websiteTree.styleOptions != null) {
    const stylesheetProperties = parseStylesheets(
      websiteTree.styleOptions.style,
    );
    if (stylesheetProperties.length > 0) {
      returnProperties.options.stylesheets.properties = stylesheetProperties;
    }
  }

  return returnProperties;
}

function parseContextItem<T extends ReadonlyArray<string>>(
  contextItemToParse: XMLWebsiteContextItem | XMLWebsiteFilterContextItem,
  options: ParserOptions<T>,
): ContextTreeLevel<T> {
  let type = "";
  const levels: Array<ContextTreeLevelItem> = [];
  const levelsToParse = contextItemToParse.levels?.level ?? [];
  for (const level of levelsToParse) {
    const [rawVariableUuid = "", rawValueUuid] = level.payload.split(",", 2);
    const valueUuid =
      rawValueUuid == null || rawValueUuid.trim() === "null"
        ? null
        : rawValueUuid.trim();
    type = level.dataType ?? type;

    levels.push({ variableUuid: rawVariableUuid.trim(), valueUuid });
  }

  return {
    context: levels,
    type,
    identification: parseIdentification(
      contextItemToParse.identification,
      options,
    ),
    description: parseContentLike(contextItemToParse.description, options),
  };
}

function parseFilterContextDisplay<T extends ReadonlyArray<string>>(
  filterOption:
    | "inline-displayed"
    | "inline-sidebar-displayed-closed"
    | "inline-sidebar-displayed-open"
    | "sidebar-displayed-closed"
    | "sidebar-displayed-open"
    | "inline-sidebar-hidden"
    | undefined,
): Pick<
  ContextTree<T>["filter"][number],
  "isInlineDisplayed" | "isSidebarDisplayed" | "isSidebarOpen"
> {
  switch (filterOption) {
    case "inline-displayed": {
      return {
        isInlineDisplayed: true,
        isSidebarDisplayed: false,
        isSidebarOpen: false,
      };
    }
    case "inline-sidebar-displayed-closed": {
      return {
        isInlineDisplayed: true,
        isSidebarDisplayed: true,
        isSidebarOpen: false,
      };
    }
    case "inline-sidebar-displayed-open": {
      return {
        isInlineDisplayed: true,
        isSidebarDisplayed: true,
        isSidebarOpen: true,
      };
    }
    case "sidebar-displayed-closed": {
      return {
        isInlineDisplayed: false,
        isSidebarDisplayed: true,
        isSidebarOpen: false,
      };
    }
    case "sidebar-displayed-open": {
      return {
        isInlineDisplayed: false,
        isSidebarDisplayed: true,
        isSidebarOpen: true,
      };
    }
    default: {
      return {
        isInlineDisplayed: false,
        isSidebarDisplayed: false,
        isSidebarOpen: false,
      };
    }
  }
}

function parseContexts<T extends ReadonlyArray<string>>(
  contextLevels: Array<XMLWebsiteContext>,
  options: ParserOptions<T>,
): Array<ContextTreeLevel<T>> {
  const contextTreeLevels: Array<ContextTreeLevel<T>> = [];

  for (const contextLevel of contextLevels) {
    for (const contextItemToParse of contextLevel.context) {
      contextTreeLevels.push(parseContextItem(contextItemToParse, options));
    }
  }

  return contextTreeLevels;
}

function parseFilterContexts<T extends ReadonlyArray<string>>(
  filterContextLevels: Array<XMLWebsiteFilterContext>,
  options: ParserOptions<T>,
): ContextTree<T>["filter"] {
  const filterContextTreeLevels: ContextTree<T>["filter"] = [];

  for (const filterContextLevel of filterContextLevels) {
    for (const contextItemToParse of filterContextLevel.context) {
      filterContextTreeLevels.push({
        ...parseContextItem(contextItemToParse, options),
        filterType: contextItemToParse.filterType ?? "property",
        filterVariant: contextItemToParse.filterVariant ?? null,
        ...parseFilterContextDisplay(contextItemToParse.filterOption),
      });
    }
  }

  return filterContextTreeLevels;
}

function parseWebsiteTree<
  const T extends ReadonlyArray<string>,
  TType extends Website<T>["type"],
>(
  websiteTree: XMLWebsiteTree,
  context: WebsiteParseContext<T>,
  type: TType,
  options: ParserOptions<T>,
  slugPrefix?: string,
): Website<T> & { type: TType } {
  if (!websiteTree.properties) {
    throw new Error(
      `Website properties not found (website uuid “${websiteTree.uuid}”)`,
      { cause: websiteTree },
    );
  }

  if (type === "website" && websiteTree.items?.resource == null) {
    throw new Error(
      `Website pages not found (website uuid “${websiteTree.uuid}”)`,
      { cause: websiteTree },
    );
  }

  const resources = normalizeWebsiteResources(websiteTree.items?.resource);
  const pageSlugsByUuid =
    context.pageSlugsByUuid ??
    collectWebsitePageSlugs(websiteTree.items?.resource, options, slugPrefix);
  const treeContext: WebsiteParseContext<T> = { ...context, pageSlugsByUuid };
  const sidebar = parseSidebar(resources, options, treeContext);

  const properties = parseWebsiteProperties(
    websiteTree.properties.property,
    websiteTree,
    sidebar,
    options,
    context.parentProperties ?? null,
  );

  const license =
    parseLicense(websiteTree.availability) ?? context.parentLicense ?? null;

  return {
    uuid: websiteTree.uuid,
    type,
    belongsTo: context.belongsTo,
    metadata: context.metadata,
    publicationDateTime: websiteTree.publicationDateTime ?? null,
    identification: parseIdentification(websiteTree.identification, options),
    creators: websiteTree.creators
      ? parsePersonList(websiteTree.creators.creator, options)
      : [],
    license,
    items: parseWebpages(
      resources,
      options,
      { ...treeContext, parentProperties: properties, parentLicense: license },
      slugPrefix,
    ),
    properties,
  };
}

export function parseWebsite<
  const T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(data: XMLWebsiteData, options?: { languages?: T }): Website<T> {
  const rawOchre = data.result.ochre;
  const metadataLanguages = parseMetadataLanguages(rawOchre);
  const languages = resolveLanguages(options?.languages, metadataLanguages);
  const parserOptions: ParserOptions<T> = { languages };
  const defaultLanguage = resolveDefaultLanguage(rawOchre, languages);
  const websiteTree = rawOchre.tree[0];
  if (websiteTree == null) {
    throw new Error("Website tree not found", { cause: data });
  }

  return parseWebsiteTree(
    websiteTree,
    {
      belongsTo: {
        uuid: rawOchre.uuidBelongsTo,
        abbreviation: rawOchre.belongsTo,
      },
      metadata: parseMetadata(rawOchre, parserOptions, defaultLanguage),
    },
    "website",
    parserOptions,
  );
}
