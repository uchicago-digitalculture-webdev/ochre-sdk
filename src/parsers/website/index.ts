import * as v from "valibot";
import type { ParserOptions } from "#/parsers/helpers.js";
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
> & { pageSlugsByUuid?: ReadonlyMap<string, string> };

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
  predicate?: (link: ItemLink<U, T>) => boolean,
): ItemLink<U, T> | null {
  for (const link of links) {
    if (
      isWebsiteLink(link, category) &&
      (predicate == null || predicate(link))
    ) {
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
  for (const resource of resources ?? []) {
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
  if (slugPrefix == null || slugPrefix === "") {
    return slug;
  }

  if (slug === "") {
    return slugPrefix;
  }

  return `${slugPrefix}/${slug}`;
}

function collectWebsitePageSlugs<T extends ReadonlyArray<string>>(
  resources: Array<XMLWebsiteResourceItem> | undefined,
  options: ParserOptions<T>,
  slugPrefix?: string,
  pageSlugsByUuid = new Map<string, string>(),
  segmentSlugPrefix = slugPrefix,
): Map<string, string> {
  for (const resource of resources ?? []) {
    if ("segments" in resource) {
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

        collectWebsitePageSlugs(
          tree.items?.resource,
          options,
          prefixSlug(segmentSlug, segmentSlugPrefix),
          pageSlugsByUuid,
        );
      }

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

    const resourceProperties =
      resource.properties != null
        ? parseSimplifiedProperties(resource.properties, options)
        : [];
    const resourceType =
      websitePresentationReader(resourceProperties).value<string>(
        "presentation",
      );

    if (resourceType === "page") {
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
  const coordinates = bounds.trim().startsWith("[")
    ? parseJsonBounds(bounds)
    : bounds
        .split(";")
        .map((pair) =>
          pair
            .split(",")
            .map((coordinate) => Number.parseFloat(coordinate.trim())),
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

type ParsedWebsiteOptions<T extends ReadonlyArray<string>> = Extract<
  WebElementComponent<T>,
  { component: "collection" }
>["options"];

function parseWebsiteScopes<T extends ReadonlyArray<string>>(
  scopes: XMLWebsiteOptions["scopes"] | undefined,
  options: ParserOptions<T>,
): ParsedWebsiteOptions<T>["scopes"] {
  if (scopes == null) {
    return null;
  }

  const parsedScopes: NonNullable<ParsedWebsiteOptions<T>["scopes"]> = [];
  for (const scope of scopes.scope) {
    parsedScopes.push({
      uuid: scope.uuid.payload,
      type: scope.uuid.type,
      identification: parseIdentification(scope.identification, options),
    });
  }

  return parsedScopes;
}

function parseWebsiteOptions<T extends ReadonlyArray<string>>(
  rawOptions: XMLWebsiteOptions | undefined,
  options: ParserOptions<T>,
): ParsedWebsiteOptions<T> {
  const parsedOptions: ParsedWebsiteOptions<T> = {
    scopes: parseWebsiteScopes(rawOptions?.scopes, options),
    contextTree:
      rawOptions == null ? null : parseAllOptionContexts(rawOptions, options),
    labels: { title: null },
  };

  for (const note of parseNotes(rawOptions?.notes, options)) {
    if (note.title?.getText() === "Title label") {
      parsedOptions.labels.title = note.content;
      break;
    }
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
        label === "variableUuid" ||
        label === "valueUuid" ||
        label === "category" ||
        label === "payload" ||
        label === "content"
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

  let properties: WebElementComponent<T> | null = null;

  const websiteLinks = parseLinks(elementResource.links, options);
  const componentReader = websitePresentationReader(
    componentProperty.properties,
  );

  switch (componentName) {
    case "3d-viewer": {
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
            componentName,
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

      properties = {
        component: "3d-viewer",
        linkUuid: resourceLink.uuid,
        fileSize: resourceLink.fileSize,
        isInteractive,
        isControlsDisplayed,
      };
      break;
    }
    case "advanced-search": {
      const boundElementPropertyUuid = componentReader.uuid("bound-element");
      const href = parseWebsiteLinkTarget(
        componentReader.valueNode("link-to"),
        context,
      );

      if (boundElementPropertyUuid == null && href == null) {
        throw new Error(
          formatComponentError(
            "Bound element or href not found",
            componentName,
            elementResource,
          ),
          { cause: componentProperty },
        );
      }

      properties = {
        component: "advanced-search",
        boundElementUuid: boundElementPropertyUuid,
        href,
      };
      break;
    }
    case "annotated-document": {
      const documentLink = findWebsiteLink(
        websiteLinks,
        "resource",
        (link) => link.type === "internalDocument",
      );
      if (documentLink == null) {
        throw new Error(
          formatComponentError(
            "Document link not found",
            componentName,
            elementResource,
          ),
          { cause: componentProperty },
        );
      }

      properties = {
        component: "annotated-document",
        linkUuid: documentLink.uuid,
      };
      break;
    }
    case "annotated-image": {
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
            componentName,
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

      properties = {
        component: "annotated-image",
        linkUuid: imageLinks[0]!.uuid,
        isFilterInputDisplayed,
        isOptionsDisplayed,
        isAnnotationHighlightsDisplayed,
        isAnnotationTooltipsDisplayed,
      };
      break;
    }
    case "audio-player": {
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
            componentName,
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

      properties = {
        component: "audio-player",
        linkUuid: audioLink.uuid,
        isSpeedControlsDisplayed,
        isVolumeControlsDisplayed,
        isSeekBarDisplayed,
      };
      break;
    }
    case "bibliography": {
      type BibliographyComponent = Extract<
        WebElementComponent<T>,
        { component: "bibliography" }
      >;
      const itemLinks = websiteLinks.filter(
        (link) => link.category === "bibliography",
      );
      const bibliographies = parseBibliographyList(
        elementResource.bibliographies,
        options,
      );
      if (itemLinks.length === 0 && bibliographies.length === 0) {
        throw new Error(
          formatComponentError(
            "No links found",
            componentName,
            elementResource,
          ),
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

      properties = {
        component: "bibliography",
        linkUuids: itemLinks.map((link) => link.uuid),
        bibliographies,
        layout,
        isSourceDocumentDisplayed,
      };
      break;
    }
    case "button": {
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
              componentName,
              elementResource,
            ),
            { cause: componentProperty },
          );
        } else {
          isExternal = href.startsWith("http");
          isRelative = !href.startsWith("/");
        }
      }

      const startIcon =
        componentReader.value<ButtonComponent["startIcon"]>("start-icon");
      const endIcon =
        componentReader.value<ButtonComponent["endIcon"]>("end-icon");

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

      properties = {
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
      };

      break;
    }
    case "collection": {
      type CollectionComponent = Extract<
        WebElementComponent<T>,
        { component: "collection" }
      >;
      const setLinks = getWebsiteLinks(websiteLinks, "set");
      if (setLinks.length === 0) {
        throw new Error(
          formatComponentError(
            "Set links not found",
            componentName,
            elementResource,
          ),
          { cause: componentProperty },
        );
      }

      const displayedProperties = componentReader.property("use-property");
      const variant = componentReader.valueOr<CollectionComponent["variant"]>(
        "variant",
        "slide",
      );
      const paginationVariant = componentReader.valueOr<
        CollectionComponent["paginationVariant"]
      >("pagination-variant", "default");
      const loadingVariant = componentReader.valueOr<
        CollectionComponent["loadingVariant"]
      >("loading-variant", "skeleton");
      const expectedItemCount = componentReader.valueOr<
        CollectionComponent["expectedItemCount"]
      >("item-count", null);
      const isUsingQueryParams = componentReader.valueOr<
        CollectionComponent["isUsingQueryParams"]
      >("is-using-query-params", false);
      const isFilterResultsBarDisplayed = componentReader.valueOr<
        CollectionComponent["filter"]["isResultsBarDisplayed"]
      >("filter-results-bar-displayed", false);
      const isFilterInputDisplayed = componentReader.valueOr<
        CollectionComponent["filter"]["isInputDisplayed"]
      >("filter-input-displayed", false);
      const isFilterLimitedToInputFilter = componentReader.valueOr<
        CollectionComponent["filter"]["isLimitedToInputFilter"]
      >("filter-limit-to-input-filter", false);
      const isFilterLimitedToLeafPropertyValues = componentReader.valueOr<
        CollectionComponent["filter"]["isLimitedToLeafPropertyValues"]
      >("filter-limit-to-leaf-property-values", false);
      const isSortDisplayed = componentReader.valueOr<
        CollectionComponent["isSortDisplayed"]
      >("sort-displayed", false);
      const isFilterSidebarDisplayed = componentReader.valueOr<
        CollectionComponent["filter"]["isSidebarDisplayed"]
      >("filter-sidebar-displayed", false);
      const filterSidebarSort = componentReader.valueOr<
        CollectionComponent["filter"]["sidebarSort"]
      >("filter-sidebar-sort", "default");
      const imageLayout = componentReader.valueOr<
        CollectionComponent["imageLayout"]
      >("image-layout", "start");
      const isImagePlaceholderDisplayed = componentReader.valueOr<
        CollectionComponent["isImagePlaceholderDisplayed"]
      >("image-placeholder-displayed", true);
      const isInteractive = componentReader.valueOr<
        CollectionComponent["isInteractive"]
      >("is-interactive", false);

      const componentOptions = parseWebsiteOptions(
        elementResource.options,
        options,
      );

      properties = {
        component: "collection",
        linkUuids: setLinks.map((link) => link.uuid),
        displayedProperties:
          displayedProperties?.values
            .filter(({ uuid }) => uuid !== null)
            .map((value) => ({ uuid: value.uuid!, label: value.label })) ??
          null,
        variant,
        paginationVariant,
        loadingVariant,
        imageLayout,
        isImagePlaceholderDisplayed,
        expectedItemCount,
        isSortDisplayed,
        isUsingQueryParams,
        isInteractive,
        filter: {
          isSidebarDisplayed: isFilterSidebarDisplayed,
          isResultsBarDisplayed: isFilterResultsBarDisplayed,
          isInputDisplayed: isFilterInputDisplayed,
          isLimitedToInputFilter: isFilterLimitedToInputFilter,
          isLimitedToLeafPropertyValues: isFilterLimitedToLeafPropertyValues,
          sidebarSort: filterSidebarSort,
        },
        options: componentOptions,
      };
      break;
    }
    case "empty-space": {
      properties = {
        component: "empty-space",
        height: componentReader.stringValue("height"),
        width: componentReader.stringValue("width"),
      };
      break;
    }
    case "entries": {
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
            componentName,
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

      properties = {
        component: "entries",
        linkUuid: entriesLink.uuid,
        variant,
        isFilterInputDisplayed,
      };
      break;
    }
    case "iframe": {
      const webpageLink = findWebsiteLink(
        websiteLinks,
        "resource",
        (link) => link.type === "webpage",
      );
      if (webpageLink?.href == null) {
        throw new Error(
          formatComponentError("URL not found", componentName, elementResource),
          { cause: componentProperty },
        );
      }

      properties = {
        component: "iframe",
        href: transformPermanentIdentificationUrlToItemLink(webpageLink.href),
        height: componentReader.stringValue("height"),
        width: componentReader.stringValue("width"),
      };
      break;
    }
    case "iiif-viewer": {
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
            componentName,
            elementResource,
          ),
          { cause: componentProperty },
        );
      }

      const variant = componentReader.valueOr<IIIFViewerComponent["variant"]>(
        "variant",
        "universal-viewer",
      );

      properties = {
        component: "iiif-viewer",
        linkUuid: manifestLink.uuid,
        variant,
      };
      break;
    }
    case "image": {
      type ImageComponent = Extract<
        WebElementComponent<T>,
        { component: "image" }
      >;
      if (websiteLinks.length === 0) {
        throw new Error(
          formatComponentError(
            "No links found",
            componentName,
            elementResource,
          ),
          { cause: componentProperty },
        );
      }

      const imageQuality = componentReader.valueOr<
        ImageComponent["imageQuality"]
      >("image-quality", "high");

      const images: Array<WebImage<T>> = [];
      for (const link of websiteLinks) {
        images.push({
          uuid: link.uuid,
          label: link.identification.label,
          width: "image" in link ? (link.image?.width ?? 0) : 0,
          height: "image" in link ? (link.image?.height ?? 0) : 0,
          description: link.description,
          quality: imageQuality,
        });
      }

      const variant = componentReader.valueOr<ImageComponent["variant"]>(
        "variant",
        "default",
      );
      const captionLayout = componentReader.valueOr<
        ImageComponent["captionLayout"]
      >("layout-caption", "bottom");

      let width: number | null = null;
      const widthProperty = componentReader.value<string | number>("width");
      if (widthProperty !== null) {
        if (typeof widthProperty === "number") {
          width = widthProperty;
        } else if (typeof widthProperty === "string") {
          width = Number.parseFloat(widthProperty);
        }
      }

      let height: number | null = null;
      const heightProperty = componentReader.value<string | number>("height");
      if (heightProperty !== null) {
        if (typeof heightProperty === "number") {
          height = heightProperty;
        } else if (typeof heightProperty === "string") {
          height = Number.parseFloat(heightProperty);
        }
      }

      const isFullWidth = componentReader.valueOr<
        ImageComponent["isFullWidth"]
      >("is-full-width", true);
      const isFullHeight = componentReader.valueOr<
        ImageComponent["isFullHeight"]
      >("is-full-height", true);
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
        let secondsPerImage = 5;

        if (variant === "carousel") {
          const secondsPerImageProperty = variantReader.value<string | number>(
            "seconds-per-image",
          );
          if (secondsPerImageProperty !== null) {
            if (typeof secondsPerImageProperty === "number") {
              secondsPerImage = secondsPerImageProperty;
            } else if (typeof secondsPerImageProperty === "string") {
              secondsPerImage = Number.parseFloat(secondsPerImageProperty);
            }
          }
        }

        carouselOptions = { secondsPerImage };
      }

      let heroOptions: ImageComponent["heroOptions"] = null;
      if (variant === "hero") {
        const isBackgroundImageDisplayed = variantReader.valueOr<
          NonNullable<
            ImageComponent["heroOptions"]
          >["isBackgroundImageDisplayed"]
        >("background-image-displayed", true);
        const isDocumentDisplayed = variantReader.valueOr<
          NonNullable<ImageComponent["heroOptions"]>["isDocumentDisplayed"]
        >("document-displayed", true);

        heroOptions = { isBackgroundImageDisplayed, isDocumentDisplayed };
      }

      properties = {
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
      break;
    }
    case "image-gallery": {
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
            componentName,
            elementResource,
          ),
          { cause: componentProperty },
        );
      }

      const isFilterInputDisplayed = componentReader.valueOr<
        ImageGalleryComponent["isFilterInputDisplayed"]
      >("filter-input-displayed", true);

      properties = {
        component: "image-gallery",
        linkUuid: galleryLink.uuid,
        isFilterInputDisplayed,
      };
      break;
    }
    case "map": {
      type MapComponent = Extract<WebElementComponent<T>, { component: "map" }>;
      const mapLink = findWebsiteLinkByCategories(websiteLinks, [
        "set",
        "tree",
      ]);
      if (mapLink == null) {
        throw new Error(
          formatComponentError(
            "Map link not found",
            componentName,
            elementResource,
          ),
          { cause: componentProperty },
        );
      }

      const isInteractive = componentReader.valueOr<
        MapComponent["isInteractive"]
      >("is-interactive", true);
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
      const isFullHeight = componentReader.valueOr<
        MapComponent["isFullHeight"]
      >("is-full-height", false);

      properties = {
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
      break;
    }
    case "query": {
      type QueryComponent = Extract<
        WebElementComponent<T>,
        { component: "query" }
      >;
      type CollectionComponent = Extract<
        WebElementComponent<T>,
        { component: "collection" }
      >;
      const setLinks = getWebsiteLinks(websiteLinks, "set");
      if (setLinks.length === 0) {
        throw new Error(
          formatComponentError(
            "Set links not found",
            componentName,
            elementResource,
          ),
          { cause: componentProperty },
        );
      }

      const items: Array<QueryComponent["items"][number]> = [];

      if (componentProperty.properties.length === 0) {
        throw new Error(
          formatComponentError(
            "Query properties not found",
            componentName,
            elementResource,
          ),
          { cause: componentProperty },
        );
      }

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
              componentName,
              elementResource,
            ),
          );
        }

        const queries: QueryComponent["items"][number]["queries"] = [];
        for (const propertyVariable of propertyVariables) {
          if (propertyVariable.uuid === null) {
            throw new Error(
              formatComponentError(
                "Property variable UUID not found",
                componentName,
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
                componentName,
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

        const startIcon =
          queryReader.value<QueryComponent["items"][number]["startIcon"]>(
            "start-icon",
          );
        const endIcon =
          queryReader.value<QueryComponent["items"][number]["endIcon"]>(
            "end-icon",
          );

        items.push({ label, queries, startIcon, endIcon });
      }

      if (items.length === 0) {
        throw new Error(
          formatComponentError(
            "No queries found",
            componentName,
            elementResource,
          ),
          { cause: componentProperty },
        );
      }

      const componentOptions = parseWebsiteOptions(
        elementResource.options,
        options,
      );

      const collectionProperties: QueryComponent["collectionProperties"] = {};

      const displayedProperties = componentReader.property("use-property");
      if (displayedProperties != null) {
        collectionProperties.displayedProperties = displayedProperties.values
          .filter((value) => value.uuid !== null)
          .map((value) => ({ uuid: value.uuid!, label: value.label }));
      }

      const overrideReader = componentReader.nestedByValue(
        "sub-component-override",
        "collection",
      );

      const variant =
        overrideReader.value<CollectionComponent["variant"]>("variant");
      if (variant != null) {
        collectionProperties.variant = variant;
      }

      const paginationVariant =
        overrideReader.value<CollectionComponent["paginationVariant"]>(
          "pagination-variant",
        );
      if (paginationVariant != null) {
        collectionProperties.paginationVariant = paginationVariant;
      }

      const loadingVariant =
        overrideReader.value<CollectionComponent["loadingVariant"]>(
          "loading-variant",
        );
      if (loadingVariant != null) {
        collectionProperties.loadingVariant = loadingVariant;
      }

      const imageLayout =
        overrideReader.value<CollectionComponent["imageLayout"]>(
          "image-layout",
        );
      if (imageLayout != null) {
        collectionProperties.imageLayout = imageLayout;
      }

      const isImagePlaceholderDisplayed = overrideReader.value<
        CollectionComponent["isImagePlaceholderDisplayed"]
      >("image-placeholder-displayed");
      if (isImagePlaceholderDisplayed != null) {
        collectionProperties.isImagePlaceholderDisplayed =
          isImagePlaceholderDisplayed;
      }

      const expectedItemCount =
        overrideReader.value<CollectionComponent["expectedItemCount"]>(
          "item-count",
        );
      if (expectedItemCount != null) {
        collectionProperties.expectedItemCount = expectedItemCount;
      }

      const isSortDisplayed =
        overrideReader.value<CollectionComponent["isSortDisplayed"]>(
          "sort-displayed",
        );
      if (isSortDisplayed != null) {
        collectionProperties.isSortDisplayed = isSortDisplayed;
      }

      const isUsingQueryParams = overrideReader.value<
        CollectionComponent["isUsingQueryParams"]
      >("is-using-query-params");
      if (isUsingQueryParams != null) {
        collectionProperties.isUsingQueryParams = isUsingQueryParams;
      }

      const isInteractive =
        overrideReader.value<CollectionComponent["isInteractive"]>(
          "is-interactive",
        );
      if (isInteractive != null) {
        collectionProperties.isInteractive = isInteractive;
      }

      properties = {
        component: "query",
        linkUuids: setLinks.map((link) => link.uuid),
        items,
        options: componentOptions,
        collectionProperties,
      };
      break;
    }
    case "table": {
      const tableLink = findWebsiteLink(websiteLinks, "set");
      if (tableLink == null) {
        throw new Error(
          formatComponentError(
            "Table link not found",
            componentName,
            elementResource,
          ),
          { cause: componentProperty },
        );
      }

      properties = { component: "table", linkUuid: tableLink.uuid };
      break;
    }
    case "search-bar": {
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
            componentName,
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

      properties = {
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
      break;
    }
    case "text": {
      type TextComponent = Extract<
        WebElementComponent<T>,
        { component: "text" }
      >;
      type TextVariantWithName<U extends TextComponent["variant"]["name"]> =
        Extract<TextComponent["variant"], { name: U }>;
      const content =
        elementResource.document && "content" in elementResource.document
          ? parseXMLContent(elementResource.document, options)
          : null;
      if (content == null) {
        throw new Error(
          formatComponentError(
            "Content not found",
            componentName,
            elementResource,
          ),
          { cause: componentProperty },
        );
      }

      let variantName: TextComponent["variant"]["name"] = "block";
      let variant: TextComponent["variant"];

      const variantProperty = componentReader.property("variant");
      if (variantProperty !== null) {
        const variantReader = websitePresentationReader(
          variantProperty.properties,
        );
        variantName = variantProperty.values[0]!
          .content as TextComponent["variant"]["name"];

        switch (variantName) {
          case "paragraph": {
            variant = {
              name: variantName,
              size: variantReader.valueOr<
                TextVariantWithName<"paragraph">["size"]
              >("size", "md"),
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
              size: variantReader.valueOr<
                TextVariantWithName<"heading">["size"]
              >("size", "md"),
            };
            break;
          }
          case "display": {
            variant = {
              name: variantName,
              size: variantReader.valueOr<
                TextVariantWithName<"display">["size"]
              >("size", "md"),
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

      properties = { component: "text", variant, headingLevel, content };
      break;
    }
    case "timeline": {
      const timelineLink = findWebsiteLink(websiteLinks, "tree");
      if (timelineLink == null) {
        throw new Error(
          formatComponentError(
            "Timeline link not found",
            componentName,
            elementResource,
          ),
          { cause: componentProperty },
        );
      }

      properties = { component: "timeline", linkUuid: timelineLink.uuid };
      break;
    }
    case "video": {
      const videoLink = findWebsiteLink(
        websiteLinks,
        "resource",
        (link) => link.type === "video",
      );
      if (videoLink == null) {
        throw new Error(
          formatComponentError(
            "Video link not found",
            componentName,
            elementResource,
          ),
          { cause: componentProperty },
        );
      }

      const isChaptersDisplayed = componentReader.valueOr<
        Extract<
          WebElementComponent<T>,
          { component: "video" }
        >["isChaptersDisplayed"]
      >("chapters-displayed", true);

      properties = {
        component: "video",
        linkUuid: videoLink.uuid,
        isChaptersDisplayed,
      };
      break;
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

  return properties;
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

  const elementProperties = elementResource.properties?.property
    ? parseSimplifiedProperties(elementResource.properties, options)
    : [];
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
    isNameDisplayed:
      properties.component === "annotated-image" ||
      properties.component === "annotated-document" ||
      properties.component === "collection",
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
  const webpageProperties = webpageResource.properties
    ? parseSimplifiedProperties(webpageResource.properties, options)
    : [];
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

  const webpageResources =
    webpageResource.resource != null
      ? normalizeWebsiteResources(webpageResource.resource)
      : [];

  const items: Array<WebElement<T> | WebBlock<T>> = [];
  for (const resource of webpageResources) {
    const resourceProperties =
      resource.properties != null
        ? parseSimplifiedProperties(resource.properties, options)
        : [];

    const resourceType = websitePresentationReader(resourceProperties).value<
      "element" | "block"
    >("presentation");
    if (resourceType === null) {
      continue;
    }

    switch (resourceType) {
      case "element": {
        const componentName = websitePresentationReader(resourceProperties)
          .nestedByValue("presentation", "element")
          .value<string>("component");

        if (componentName === "sidebar") {
          continue;
        }

        const element = parseWebElement(resource, options, context);
        items.push(element);
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

  returnWebpage.items = items;

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

  for (const resource of resources ?? []) {
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
  let returnSidebar: WebSidebar<T> | null = null;

  const items: WebSidebar<T>["items"] = [];
  let title: WebTitle<T> | null = null;
  let layout: "start" | "end" = "start";
  let mobileLayout: "default" | "inline" = "default";
  const cssStyles: WebSidebar<T>["cssStyles"] = {
    default: [],
    tablet: [],
    mobile: [],
  };

  const sidebarResource = resources.find((resource) => {
    const resourceProperties = resource.properties
      ? parseSimplifiedProperties(resource.properties, options)
      : [];
    const resourceReader = websitePresentationReader(resourceProperties);

    return (
      resourceReader.value("presentation") === "element" &&
      resourceReader
        .nestedByValue("presentation", "element")
        .value("component") === "sidebar"
    );
  });
  if (sidebarResource != null) {
    const sidebarBaseProperties = sidebarResource.properties
      ? parseSimplifiedProperties(sidebarResource.properties, options)
      : [];

    title = parseWebTitle(
      sidebarBaseProperties,
      parseIdentification(sidebarResource.identification, options),
    );

    const sidebarReader = websitePresentationReader(sidebarBaseProperties)
      .nestedByValue("presentation", "element")
      .nestedByValue("component", "sidebar");

    layout = sidebarReader.valueOr<typeof layout>("layout", "start");
    mobileLayout = sidebarReader.valueOr<typeof mobileLayout>(
      "layout-mobile",
      "default",
    );

    const parsedCssStyles = parseResponsiveCssStyles(sidebarBaseProperties);
    cssStyles.default = parsedCssStyles.default;
    cssStyles.tablet = parsedCssStyles.tablet;
    cssStyles.mobile = parsedCssStyles.mobile;

    const sidebarResources = sidebarResource.resource
      ? normalizeWebsiteResources(sidebarResource.resource)
      : [];

    for (const resource of sidebarResources) {
      const resourceProperties = resource.properties
        ? parseSimplifiedProperties(resource.properties, options)
        : [];

      const resourceType = websitePresentationReader(resourceProperties).value<
        "element" | "block"
      >("presentation");
      if (resourceType === null) {
        continue;
      }

      switch (resourceType) {
        case "element": {
          const element = parseWebElement(resource, options, context);
          items.push(element);
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
  }

  if (items.length > 0 && title != null) {
    returnSidebar = {
      isDisplayed: true,
      items,
      title,
      layout,
      mobileLayout,
      cssStyles,
    };
  }

  return returnSidebar;
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

  const items: Array<WebBlockItem<T>> = [];
  for (const resource of childResources) {
    const resourceProperties = resource.properties
      ? parseSimplifiedProperties(resource.properties, options)
      : [];

    const resourceType = websitePresentationReader(resourceProperties).value<
      "element" | "block"
    >("presentation");
    if (resourceType === null) {
      continue;
    }

    switch (resourceType) {
      case "element": {
        const element = parseWebElement(resource, options, context);
        items.push(element);
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

  return { uuid: trigger.uuid, type: "accordion-item", trigger, items };
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
  const blockProperties = blockResource.properties
    ? parseSimplifiedProperties(blockResource.properties, options)
    : [];

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

    const tabletOverwriteReader = blockReader.nested("overwrite-tablet");
    if (tabletOverwriteReader.size > 0) {
      const propertiesTablet: NonNullable<WebBlock<T>["properties"]["tablet"]> =
        {
          layout:
            tabletOverwriteReader.value<
              NonNullable<WebBlock<T>["properties"]["tablet"]>["layout"]
            >("layout") ?? undefined,
          wrap:
            tabletOverwriteReader.value<
              NonNullable<WebBlock<T>["properties"]["tablet"]>["wrap"]
            >("wrap") ?? undefined,
          spacing:
            tabletOverwriteReader.value<
              NonNullable<WebBlock<T>["properties"]["tablet"]>["spacing"]
            >("spacing") ?? undefined,
          gap:
            tabletOverwriteReader.value<
              NonNullable<WebBlock<T>["properties"]["tablet"]>["gap"]
            >("gap") ?? undefined,
          isAccordionEnabled: undefined,
          isAccordionExpandedByDefault: undefined,
          isAccordionSidebarDisplayed: undefined,
        };

      if (
        propertiesTablet.layout === "accordion" ||
        returnBlock.properties.default.layout === "accordion"
      ) {
        propertiesTablet.isAccordionEnabled =
          tabletOverwriteReader.value<
            NonNullable<
              WebBlock<T>["properties"]["tablet"]
            >["isAccordionEnabled"]
          >("accordion-enabled") ?? undefined;

        propertiesTablet.isAccordionExpandedByDefault =
          tabletOverwriteReader.value<
            NonNullable<
              WebBlock<T>["properties"]["tablet"]
            >["isAccordionExpandedByDefault"]
          >("accordion-expanded") ?? undefined;

        propertiesTablet.isAccordionSidebarDisplayed =
          tabletOverwriteReader.value<
            NonNullable<
              WebBlock<T>["properties"]["tablet"]
            >["isAccordionSidebarDisplayed"]
          >("accordion-sidebar-displayed") ?? undefined;
      }

      const cleanedPropertiesTablet = cleanObject(propertiesTablet);

      if (Object.keys(cleanedPropertiesTablet).length > 0) {
        returnBlock.properties.tablet = cleanedPropertiesTablet;
      }
    }

    const mobileOverwriteReader = blockReader.nested("overwrite-mobile");
    if (mobileOverwriteReader.size > 0) {
      const propertiesMobile: NonNullable<WebBlock<T>["properties"]["mobile"]> =
        {
          layout:
            mobileOverwriteReader.value<
              NonNullable<WebBlock<T>["properties"]["default"]>["layout"]
            >("layout") ?? undefined,
          wrap:
            mobileOverwriteReader.value<
              NonNullable<WebBlock<T>["properties"]["mobile"]>["wrap"]
            >("wrap") ?? undefined,
          spacing:
            mobileOverwriteReader.value<
              NonNullable<WebBlock<T>["properties"]["default"]>["spacing"]
            >("spacing") ?? undefined,
          gap:
            mobileOverwriteReader.value<
              NonNullable<WebBlock<T>["properties"]["default"]>["gap"]
            >("gap") ?? undefined,
          isAccordionEnabled: undefined,
          isAccordionExpandedByDefault: undefined,
          isAccordionSidebarDisplayed: undefined,
        };

      if (
        propertiesMobile.layout === "accordion" ||
        returnBlock.properties.default.layout === "accordion"
      ) {
        propertiesMobile.isAccordionEnabled =
          mobileOverwriteReader.value<
            NonNullable<
              WebBlock<T>["properties"]["mobile"]
            >["isAccordionEnabled"]
          >("accordion-enabled") ?? undefined;

        propertiesMobile.isAccordionExpandedByDefault =
          mobileOverwriteReader.value<
            NonNullable<
              WebBlock<T>["properties"]["mobile"]
            >["isAccordionExpandedByDefault"]
          >("accordion-expanded") ?? undefined;

        propertiesMobile.isAccordionSidebarDisplayed =
          mobileOverwriteReader.value<
            NonNullable<
              WebBlock<T>["properties"]["mobile"]
            >["isAccordionSidebarDisplayed"]
          >("accordion-sidebar-displayed") ?? undefined;
      }

      const cleanedPropertiesMobile = cleanObject(propertiesMobile);

      if (Object.keys(cleanedPropertiesMobile).length > 0) {
        returnBlock.properties.mobile = cleanedPropertiesMobile;
      }
    }
  }

  const blockResources = blockResource.resource
    ? normalizeWebsiteResources(blockResource.resource)
    : [];

  const supportsAccordionItems =
    returnBlock.properties.default.layout === "accordion" ||
    returnBlock.properties.tablet?.layout === "accordion" ||
    returnBlock.properties.mobile?.layout === "accordion";

  const blockItems: Array<WebAccordionItem<T> | WebBlockItem<T>> = [];
  for (const resource of blockResources) {
    const resourceProperties = resource.properties
      ? parseSimplifiedProperties(resource.properties, options)
      : [];
    const resourceReader = websitePresentationReader(resourceProperties);

    const resourceType = resourceReader.value<"element" | "block">(
      "presentation",
    );
    if (resourceType === null) {
      continue;
    }

    switch (resourceType) {
      case "element": {
        const childResources = resource.resource
          ? normalizeWebsiteResources(resource.resource)
          : [];
        const componentType = resourceReader
          .nestedByValue("presentation", "element")
          .value<string>("component");

        if (
          supportsAccordionItems &&
          componentType === "text" &&
          childResources.length > 0
        ) {
          const item = parseWebAccordionItem(
            resource,
            childResources,
            options,
            context,
          );
          blockItems.push(item);
          break;
        }

        const element = parseWebElement(resource, options, context);
        blockItems.push(element);
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

  returnBlock.items = blockItems;

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
): Website<T>["properties"] {
  const mainProperties = parseSimplifiedProperties(
    { property: properties },
    options,
  );
  const websiteReader =
    websitePresentationReader(mainProperties).nested("presentation");

  const type = websiteReader.valueOr<Website<T>["properties"]["type"]>(
    "webUI",
    "traditional",
  );

  const status = websiteReader.valueOr<Website<T>["properties"]["status"]>(
    "status",
    "development",
  );

  const versionLabel = websiteReader.valueOr<
    Website<T>["properties"]["versionLabel"]
  >("version-label", "release");

  const privacy = websiteReader.valueOr<Website<T>["properties"]["privacy"]>(
    "privacy",
    "public",
  );

  const returnProperties: Website<T>["properties"] = {
    type,
    status,
    versionLabel,
    privacy,
    contact: null,
    loadingVariant: "spinner",
    theme: { isThemeToggleDisplayed: true, defaultTheme: "system" },
    icon: { logoUuid: null, faviconUuid: null, appleTouchIconUuid: null },
    navbar: {
      isDisplayed: true,
      variant: "default",
      alignment: "start",
      isProjectDisplayed: true,
      searchBarBoundElementUuid: null,
      items: null,
    },
    footer: { isDisplayed: true, logoUuid: null, items: null },
    sidebar,
    itemPage: {
      isMainContentDisplayed: true,
      isDescriptionDisplayed: true,
      isDocumentDisplayed: true,
      isNotesDisplayed: true,
      isEventsDisplayed: true,
      isPeriodsDisplayed: true,
      isPropertiesDisplayed: true,
      isBibliographyDisplayed: true,
      isPropertyValuesGrouped: true,
      isPublicationDateTimeDisplayed: true,
      isPersistentIdentifierDisplayed: true,
      iiifViewer: "universal-viewer",
    },
    options: {
      contextTree: null,
      scopes: null,
      labels: { title: null },
      stylesheets: { properties: [] },
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
  >("loading-variant", "spinner");

  returnProperties.theme.isThemeToggleDisplayed = websiteReader.valueOr<
    Website<T>["properties"]["theme"]["isThemeToggleDisplayed"]
  >("supports-theme-toggle", true);

  returnProperties.theme.defaultTheme = websiteReader.valueOr<
    Website<T>["properties"]["theme"]["defaultTheme"]
  >("default-theme", "system");

  returnProperties.icon.logoUuid = websiteReader.uuid("navbar-logo");

  returnProperties.icon.faviconUuid = websiteReader.uuid("favicon-ico");

  returnProperties.icon.appleTouchIconUuid = websiteReader.uuid("favicon-img");

  returnProperties.navbar.isDisplayed = websiteReader.valueOr<
    Website<T>["properties"]["navbar"]["isDisplayed"]
  >("navbar-displayed", true);

  returnProperties.navbar.variant = websiteReader.valueOr<
    Website<T>["properties"]["navbar"]["variant"]
  >("navbar-variant", "default");

  returnProperties.navbar.alignment = websiteReader.valueOr<
    Website<T>["properties"]["navbar"]["alignment"]
  >("navbar-alignment", "start");

  returnProperties.navbar.isProjectDisplayed = websiteReader.valueOr<
    Website<T>["properties"]["navbar"]["isProjectDisplayed"]
  >("navbar-project-displayed", true);

  returnProperties.navbar.searchBarBoundElementUuid = websiteReader.uuid(
    "bound-element-navbar-search-bar",
  );

  returnProperties.footer.isDisplayed = websiteReader.valueOr<
    Website<T>["properties"]["footer"]["isDisplayed"]
  >("footer-displayed", true);

  returnProperties.footer.logoUuid = websiteReader.uuid("footer-logo");

  const itemPageReader = websiteReader.nestedByValue("page-type", "item-page");
  if (itemPageReader.size > 0) {
    returnProperties.itemPage.isMainContentDisplayed = itemPageReader.valueOr<
      Website<T>["properties"]["itemPage"]["isMainContentDisplayed"]
    >("item-page-main-content-displayed", true);

    returnProperties.itemPage.isDescriptionDisplayed = itemPageReader.valueOr<
      Website<T>["properties"]["itemPage"]["isDescriptionDisplayed"]
    >("item-page-description-displayed", true);

    returnProperties.itemPage.isDocumentDisplayed = itemPageReader.valueOr<
      Website<T>["properties"]["itemPage"]["isDocumentDisplayed"]
    >("item-page-document-displayed", true);

    returnProperties.itemPage.isNotesDisplayed = itemPageReader.valueOr<
      Website<T>["properties"]["itemPage"]["isNotesDisplayed"]
    >("item-page-notes-displayed", true);

    returnProperties.itemPage.isEventsDisplayed = itemPageReader.valueOr<
      Website<T>["properties"]["itemPage"]["isEventsDisplayed"]
    >("item-page-events-displayed", true);

    returnProperties.itemPage.isPeriodsDisplayed = itemPageReader.valueOr<
      Website<T>["properties"]["itemPage"]["isPeriodsDisplayed"]
    >("item-page-periods-displayed", true);

    returnProperties.itemPage.isPropertiesDisplayed = itemPageReader.valueOr<
      Website<T>["properties"]["itemPage"]["isPropertiesDisplayed"]
    >("item-page-properties-displayed", true);

    returnProperties.itemPage.isBibliographyDisplayed = itemPageReader.valueOr<
      Website<T>["properties"]["itemPage"]["isBibliographyDisplayed"]
    >("item-page-bibliography-displayed", true);

    returnProperties.itemPage.isPropertyValuesGrouped = itemPageReader.valueOr<
      Website<T>["properties"]["itemPage"]["isPropertyValuesGrouped"]
    >("item-page-property-values-grouped", true);

    returnProperties.itemPage.isPublicationDateTimeDisplayed =
      itemPageReader.valueOr<
        Website<T>["properties"]["itemPage"]["isPublicationDateTimeDisplayed"]
      >("item-page-publication-date-time-displayed", true);

    returnProperties.itemPage.isPersistentIdentifierDisplayed =
      itemPageReader.valueOr<
        Website<T>["properties"]["itemPage"]["isPersistentIdentifierDisplayed"]
      >("item-page-persistent-identifier-displayed", true);

    returnProperties.itemPage.iiifViewer = itemPageReader.valueOr<
      Website<T>["properties"]["itemPage"]["iiifViewer"]
    >("item-page-iiif-viewer", "universal-viewer");
  }

  if (websiteTree.options != null) {
    const parsedOptions = parseWebsiteOptions(websiteTree.options, options);
    returnProperties.options.scopes = parsedOptions.scopes;
    returnProperties.options.contextTree = parsedOptions.contextTree;
    returnProperties.options.labels = parsedOptions.labels;
  }

  if ("styleOptions" in websiteTree && websiteTree.styleOptions != null) {
    returnProperties.options.stylesheets.properties = parseStylesheets(
      websiteTree.styleOptions.style,
    );
  }

  return returnProperties;
}

function parseContextItem<T extends ReadonlyArray<string>>(
  contextItemToParse: XMLWebsiteContextItem | XMLWebsiteFilterContextItem,
  options: ParserOptions<T>,
): ContextTreeLevel<T> {
  let type = "";
  const levels: Array<ContextTreeLevelItem> = [];
  for (const level of contextItemToParse.levels?.level ?? []) {
    const [rawVariableUuid = "", rawValueUuid] = level.payload.split(",");
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
  );

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
    license: parseLicense(websiteTree.availability),
    items: parseWebpages(resources, options, treeContext, slugPrefix),
    properties,
  };
}

export function parseWebsite<
  const T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(data: XMLWebsiteData, options?: { languages?: T }): Website<T> {
  const rawOchre = data.result.ochre;
  const metadataLanguages = parseMetadataLanguages(rawOchre);
  const languages = resolveLanguages(
    options?.languages ?? ([] as unknown as T),
    metadataLanguages,
  );
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
