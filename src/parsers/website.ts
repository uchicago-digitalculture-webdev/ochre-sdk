import * as v from "valibot";
import type { ParserOptions } from "#/parsers/helpers.js";
import type { MultilingualString } from "#/parsers/multilingual.js";
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
  WebBlock,
  WebElement,
  WebElementComponent,
  WebImage,
  Webpage,
  WebSegment,
  WebSegmentItem,
  Website,
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
  getPropertyByVariableLabel,
  getPropertyByVariableLabelAndValueContent,
  getPropertyValueByVariableLabel,
  getPropertyValueContentByVariableLabel,
} from "#/getters.js";
import {
  cleanObject,
  multilingualFromText,
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
import { componentSchema } from "#/schemas.js";

type WebsiteLinkCategory = Extract<
  ItemLinkCategory,
  "resource" | "set" | "tree"
>;

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
const TRAILING_SLASH_REGEX = /\/$/;

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
  const cssProperties =
    getPropertyByVariableLabelAndValueContent(properties, "presentation", label)
      ?.properties ?? [];
  const styles: Array<Style> = [];
  for (const property of cssProperties) {
    const value = property.values[0]?.content.toString();
    if (value != null) {
      styles.push({ label: property.variable.label, value });
    }
  }
  return styles;
}

function getPropertyValueMultilingualContent<T extends ReadonlyArray<string>>(
  propertyValue: PropertyValueContent<T> | null,
  options: ParserOptions<T>,
): MultilingualString<T> | null {
  if (propertyValue == null) {
    return null;
  }

  if (propertyValue.label != null) {
    return propertyValue.label;
  }

  if (typeof propertyValue.content === "string") {
    return multilingualFromText(propertyValue.content, options);
  }

  return null;
}

function getPropertyMultilingualValueByLabelName<
  T extends ReadonlyArray<string>,
>(
  properties: ReadonlyArray<SimplifiedProperty<T>>,
  labelName: string,
  options: ParserOptions<T>,
): MultilingualString<T> | null {
  return getPropertyValueMultilingualContent(
    getPropertyValueByVariableLabel(properties, labelName),
    options,
  );
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
  const coordinates = bounds
    .split(";")
    .map((pair) =>
      pair.split(",").map((coordinate) => Number.parseFloat(coordinate.trim())),
    );
  const [southWest, northEast] = coordinates;
  if (
    southWest?.length !== 2 ||
    northEast?.length !== 2 ||
    southWest.some((coordinate) => Number.isNaN(coordinate)) ||
    northEast.some((coordinate) => Number.isNaN(coordinate))
  ) {
    throw new Error(`Invalid bounds: ${bounds}`);
  }

  return [
    [southWest[0]!, southWest[1]!],
    [northEast[0]!, northEast[1]!],
  ];
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
): WebElementComponent<T> {
  const unparsedComponentName = componentProperty.values[0]!.content;
  const componentNameResult = v.safeParse(
    componentSchema,
    unparsedComponentName,
  );
  const componentName =
    componentNameResult.success ? componentNameResult.output : undefined;

  let properties: WebElementComponent<T> | null = null;

  const websiteLinks = parseLinks(elementResource.links, options);

  switch (componentName) {
    case "3d-viewer": {
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
        );
      }

      let isInteractive = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "is-interactive",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "3d-viewer" }
          >["isInteractive"]
        | null;
      isInteractive ??= true;

      let isControlsDisplayed = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "controls-displayed",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "3d-viewer" }
          >["isControlsDisplayed"]
        | null;
      isControlsDisplayed ??= true;

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
      const boundElementPropertyUuid =
        getPropertyByVariableLabel(
          componentProperty.properties,
          "bound-element",
        )?.values[0]?.uuid ?? null;

      const linkToProperty = getPropertyByVariableLabel(
        componentProperty.properties,
        "link-to",
      );
      const href =
        linkToProperty?.values[0]?.href != null ?
          transformPermanentIdentificationUrlToItemLink(
            linkToProperty.values[0].href,
          )
        : (linkToProperty?.values[0]?.slug ?? null);

      if (boundElementPropertyUuid == null && href == null) {
        throw new Error(
          formatComponentError(
            "Bound element or href not found",
            componentName,
            elementResource,
          ),
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
        );
      }

      properties = {
        component: "annotated-document",
        linkUuid: documentLink.uuid,
      };
      break;
    }
    case "annotated-image": {
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
        );
      }

      let isFilterInputDisplayed = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "filter-input-displayed",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "annotated-image" }
          >["isFilterInputDisplayed"]
        | null;
      isFilterInputDisplayed ??= true;

      let isOptionsDisplayed = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "options-displayed",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "annotated-image" }
          >["isOptionsDisplayed"]
        | null;
      isOptionsDisplayed ??= true;

      let isAnnotationHighlightsDisplayed =
        getPropertyValueContentByVariableLabel(
          componentProperty.properties,
          "annotation-highlights-displayed",
        ) as
          | Extract<
              WebElementComponent<T>,
              { component: "annotated-image" }
            >["isAnnotationHighlightsDisplayed"]
          | null;
      isAnnotationHighlightsDisplayed ??= true;

      let isAnnotationTooltipsDisplayed =
        getPropertyValueContentByVariableLabel(
          componentProperty.properties,
          "annotation-tooltips-displayed",
        ) as
          | Extract<
              WebElementComponent<T>,
              { component: "annotated-image" }
            >["isAnnotationTooltipsDisplayed"]
          | null;
      isAnnotationTooltipsDisplayed ??= true;

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
        );
      }

      let isSpeedControlsDisplayed = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "speed-controls-displayed",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "audio-player" }
          >["isSpeedControlsDisplayed"]
        | null;
      isSpeedControlsDisplayed ??= true;

      let isVolumeControlsDisplayed = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "volume-controls-displayed",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "audio-player" }
          >["isVolumeControlsDisplayed"]
        | null;
      isVolumeControlsDisplayed ??= true;

      let isSeekBarDisplayed = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "seek-bar-displayed",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "audio-player" }
          >["isSeekBarDisplayed"]
        | null;
      isSeekBarDisplayed ??= true;

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
      const itemLinks = websiteLinks.filter(
        (link) => link.category !== "bibliography",
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
        );
      }

      let layout = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "layout",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "bibliography" }
          >["layout"]
        | null;
      layout ??= "long";

      let isSourceDocumentDisplayed = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "source-document-displayed",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "bibliography" }
          >["isSourceDocumentDisplayed"]
        | null;
      isSourceDocumentDisplayed ??= true;

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
      let variant = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "variant",
      ) as
        | Extract<WebElementComponent<T>, { component: "button" }>["variant"]
        | null;
      variant ??= "default";

      let isExternal = false;
      const navigateToProperty = getPropertyByVariableLabel(
        componentProperty.properties,
        "navigate-to",
      );

      let href =
        navigateToProperty?.values[0]?.href != null ?
          transformPermanentIdentificationUrlToItemLink(
            navigateToProperty.values[0].href,
          )
        : (navigateToProperty?.values[0]?.slug ?? null);

      if (href === null) {
        const linkToProperty = getPropertyByVariableLabel(
          componentProperty.properties,
          "link-to",
        );
        href =
          linkToProperty?.values[0]?.href != null ?
            transformPermanentIdentificationUrlToItemLink(
              linkToProperty.values[0].href,
            )
          : (linkToProperty?.values[0]?.slug ?? null);

        if (href === null) {
          throw new Error(
            formatComponentError(
              "Properties “navigate-to” or “link-to” not found",
              componentName,
              elementResource,
            ),
          );
        } else {
          isExternal = true;
        }
      }

      let startIcon = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "start-icon",
      ) as
        | Extract<WebElementComponent<T>, { component: "button" }>["startIcon"]
        | null;
      startIcon ??= null;

      let endIcon = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "end-icon",
      ) as
        | Extract<WebElementComponent<T>, { component: "button" }>["endIcon"]
        | null;
      endIcon ??= null;

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
        label:
          elementResource.document && "content" in elementResource.document ?
            parseXMLContent(elementResource.document, options)
          : null,
        startIcon,
        endIcon,
        image,
      };

      break;
    }
    case "collection": {
      const setLinks = getWebsiteLinks(websiteLinks, "set");
      if (setLinks.length === 0) {
        throw new Error(
          formatComponentError(
            "Set links not found",
            componentName,
            elementResource,
          ),
        );
      }

      const displayedProperties = getPropertyByVariableLabel(
        componentProperty.properties,
        "use-property",
      );

      let variant = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "variant",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "collection" }
          >["variant"]
        | null;
      variant ??= "slide";

      let paginationVariant = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "pagination-variant",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "collection" }
          >["paginationVariant"]
        | null;
      paginationVariant ??= "default";

      let loadingVariant = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "loading-variant",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "collection" }
          >["loadingVariant"]
        | null;
      loadingVariant ??= "skeleton";

      let isUsingQueryParams = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "is-using-query-params",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "collection" }
          >["isUsingQueryParams"]
        | null;
      isUsingQueryParams ??= false;

      let isFilterResultsBarDisplayed = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "filter-results-bar-displayed",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "collection" }
          >["filter"]["isResultsBarDisplayed"]
        | null;
      isFilterResultsBarDisplayed ??= false;

      let isFilterInputDisplayed = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "filter-input-displayed",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "collection" }
          >["filter"]["isInputDisplayed"]
        | null;
      isFilterInputDisplayed ??= false;

      let isFilterLimitedToInputFilter = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "filter-limit-to-input-filter",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "collection" }
          >["filter"]["isLimitedToInputFilter"]
        | null;
      isFilterLimitedToInputFilter ??= false;

      let isFilterLimitedToLeafPropertyValues =
        getPropertyValueContentByVariableLabel(
          componentProperty.properties,
          "filter-limit-to-leaf-property-values",
        ) as
          | Extract<
              WebElementComponent<T>,
              { component: "collection" }
            >["filter"]["isLimitedToLeafPropertyValues"]
          | null;
      isFilterLimitedToLeafPropertyValues ??= false;

      let isSortDisplayed = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "sort-displayed",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "collection" }
          >["isSortDisplayed"]
        | null;
      isSortDisplayed ??= false;

      let isFilterSidebarDisplayed = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "filter-sidebar-displayed",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "collection" }
          >["filter"]["isSidebarDisplayed"]
        | null;
      isFilterSidebarDisplayed ??= false;

      let filterSidebarSort = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "filter-sidebar-sort",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "collection" }
          >["filter"]["sidebarSort"]
        | null;
      filterSidebarSort ??= "default";

      let imageLayout = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "image-layout",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "collection" }
          >["imageLayout"]
        | null;
      imageLayout ??= "start";

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
        isUsingQueryParams,
        isSortDisplayed,
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
      const height = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "height",
      ) as string | number | null;
      const width = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "width",
      ) as string | number | null;

      properties = {
        component: "empty-space",
        height: height?.toString() ?? null,
        width: width?.toString() ?? null,
      };
      break;
    }
    case "entries": {
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
        );
      }

      let variant = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "variant",
      ) as
        | Extract<WebElementComponent<T>, { component: "entries" }>["variant"]
        | null;
      variant ??= "entry";

      let isFilterInputDisplayed = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "filter-input-displayed",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "entries" }
          >["isFilterInputDisplayed"]
        | null;
      isFilterInputDisplayed ??= false;

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
        );
      }

      const height = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "height",
      );
      const width = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "width",
      );

      properties = {
        component: "iframe",
        href: transformPermanentIdentificationUrlToItemLink(webpageLink.href),
        height: height?.toString() ?? null,
        width: width?.toString() ?? null,
      };
      break;
    }
    case "iiif-viewer": {
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
        );
      }

      let variant = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "variant",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "iiif-viewer" }
          >["variant"]
        | null;
      variant ??= "universal-viewer";

      properties = {
        component: "iiif-viewer",
        linkUuid: manifestLink.uuid,
        variant,
      };
      break;
    }
    case "image": {
      const imageLinks = getWebsiteLinks(websiteLinks, "resource").filter(
        (link) => link.type === "image" || link.type === "IIIF",
      );
      if (imageLinks.length === 0) {
        throw new Error(
          formatComponentError(
            "No links found",
            componentName,
            elementResource,
          ),
        );
      }

      let imageQuality = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "image-quality",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "image" }
          >["imageQuality"]
        | null;
      imageQuality ??= "high";

      const images: Array<WebImage<T>> = [];
      for (const link of imageLinks) {
        images.push({
          uuid: link.uuid,
          label: link.identification.label,
          width: link.image?.width ?? 0,
          height: link.image?.height ?? 0,
          description: link.description,
          quality: imageQuality,
        });
      }

      let variant = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "variant",
      ) as
        | Extract<WebElementComponent<T>, { component: "image" }>["variant"]
        | null;
      variant ??= "default";

      let captionLayout = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "layout-caption",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "image" }
          >["captionLayout"]
        | null;
      captionLayout ??= "bottom";

      let width: number | null = null;
      const widthProperty = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "width",
      ) as string | number | null;
      if (widthProperty !== null) {
        if (typeof widthProperty === "number") {
          width = widthProperty;
        } else if (typeof widthProperty === "string") {
          width = Number.parseFloat(widthProperty);
        }
      }

      let height: number | null = null;
      const heightProperty = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "height",
      ) as string | number | null;
      if (heightProperty !== null) {
        if (typeof heightProperty === "number") {
          height = heightProperty;
        } else if (typeof heightProperty === "string") {
          height = Number.parseFloat(heightProperty);
        }
      }

      let isFullWidth = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "is-full-width",
      ) as
        | Extract<WebElementComponent<T>, { component: "image" }>["isFullWidth"]
        | null;
      isFullWidth ??= true;

      let isFullHeight = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "is-full-height",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "image" }
          >["isFullHeight"]
        | null;
      isFullHeight ??= true;

      let captionSource = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "source-caption",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "image" }
          >["captionSource"]
        | null;
      captionSource ??= "name";

      let altTextSource = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "alt-text-source",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "image" }
          >["altTextSource"]
        | null;
      altTextSource ??= "name";

      let isTransparentBackground = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "is-transparent",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "image" }
          >["isTransparentBackground"]
        | null;
      isTransparentBackground ??= false;

      let isCover = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "is-cover",
      ) as
        | Extract<WebElementComponent<T>, { component: "image" }>["isCover"]
        | null;
      isCover ??= false;

      const variantProperty = getPropertyByVariableLabel(
        componentProperty.properties,
        "variant",
      );

      let carouselOptions:
        | Extract<
            WebElementComponent<T>,
            { component: "image" }
          >["carouselOptions"]
        | null = null;
      if (images.length > 1) {
        let secondsPerImage = 5;

        if (variantProperty?.values[0]!.content === "carousel") {
          const secondsPerImageProperty =
            getPropertyValueContentByVariableLabel(
              variantProperty.properties,
              "seconds-per-image",
            ) as string | number | null;
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

      let heroOptions: Extract<
        WebElementComponent<T>,
        { component: "image" }
      >["heroOptions"] = null;
      if (variantProperty?.values[0]!.content === "hero") {
        let isBackgroundImageDisplayed = getPropertyValueContentByVariableLabel(
          variantProperty.properties,
          "background-image-displayed",
        ) as
          | NonNullable<
              Extract<
                WebElementComponent<T>,
                { component: "image" }
              >["heroOptions"]
            >["isBackgroundImageDisplayed"]
          | null;
        isBackgroundImageDisplayed ??= true;

        let isDocumentDisplayed = getPropertyValueContentByVariableLabel(
          variantProperty.properties,
          "document-displayed",
        ) as
          | NonNullable<
              Extract<
                WebElementComponent<T>,
                { component: "image" }
              >["heroOptions"]
            >["isDocumentDisplayed"]
          | null;
        isDocumentDisplayed ??= true;

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
        );
      }

      let isFilterInputDisplayed = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "filter-input-displayed",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "image-gallery" }
          >["isFilterInputDisplayed"]
        | null;
      isFilterInputDisplayed ??= true;

      properties = {
        component: "image-gallery",
        linkUuid: galleryLink.uuid,
        isFilterInputDisplayed,
      };
      break;
    }
    case "map": {
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
        );
      }

      let isInteractive = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "is-interactive",
      ) as
        | Extract<WebElementComponent<T>, { component: "map" }>["isInteractive"]
        | null;
      isInteractive ??= true;

      let isClustered = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "is-clustered",
      ) as
        | Extract<WebElementComponent<T>, { component: "map" }>["isClustered"]
        | null;
      isClustered ??= false;

      let isUsingPins = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "is-using-pins",
      ) as
        | Extract<WebElementComponent<T>, { component: "map" }>["isUsingPins"]
        | null;
      isUsingPins ??= false;

      let customBasemap = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "custom-basemap",
      ) as
        | Extract<WebElementComponent<T>, { component: "map" }>["customBasemap"]
        | null;
      customBasemap ??= null;

      let initialBounds:
        | Extract<WebElementComponent<T>, { component: "map" }>["initialBounds"]
        | null = null;
      const initialBoundsProperty = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "initial-bounds",
      ) as string | number | null;
      if (initialBoundsProperty !== null) {
        initialBounds = parseBounds(String(initialBoundsProperty));
      }

      let maximumBounds:
        | Extract<WebElementComponent<T>, { component: "map" }>["maximumBounds"]
        | null = null;
      const maximumBoundsProperty = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "maximum-bounds",
      ) as string | number | null;
      if (maximumBoundsProperty !== null) {
        maximumBounds = parseBounds(String(maximumBoundsProperty));
      }

      let isControlsDisplayed = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "controls-displayed",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "map" }
          >["isControlsDisplayed"]
        | null;
      isControlsDisplayed ??= false;

      let isFullHeight = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "is-full-height",
      ) as
        | Extract<WebElementComponent<T>, { component: "map" }>["isFullHeight"]
        | null;
      isFullHeight ??= false;

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
      const setLinks = getWebsiteLinks(websiteLinks, "set");
      if (setLinks.length === 0) {
        throw new Error(
          formatComponentError(
            "Set links not found",
            componentName,
            elementResource,
          ),
        );
      }

      const items: Array<
        Extract<WebElementComponent<T>, { component: "query" }>["items"][number]
      > = [];

      if (componentProperty.properties.length === 0) {
        throw new Error(
          formatComponentError(
            "Query properties not found",
            componentName,
            elementResource,
          ),
        );
      }

      for (const queryItem of componentProperty.properties) {
        const querySubProperties = queryItem.properties;

        const label = getPropertyMultilingualValueByLabelName(
          querySubProperties,
          "query-prompt",
          options,
        );
        if (label === null) {
          continue;
        }

        const propertyVariables =
          getPropertyByVariableLabel(
            querySubProperties,
            "use-property",
          )?.values.filter((value) => value.uuid !== null) ?? [];

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

        const queries: Extract<
          WebElementComponent<T>,
          { component: "query" }
        >["items"][number]["queries"] = [];
        for (const propertyVariable of propertyVariables) {
          if (propertyVariable.uuid === null) {
            throw new Error(
              formatComponentError(
                "Property variable UUID not found",
                componentName,
                elementResource,
              ),
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

        let startIcon = getPropertyValueContentByVariableLabel(
          querySubProperties,
          "start-icon",
        ) as
          | Extract<
              WebElementComponent<T>,
              { component: "query" }
            >["items"][number]["startIcon"]
          | null;
        startIcon ??= null;

        let endIcon = getPropertyValueContentByVariableLabel(
          querySubProperties,
          "end-icon",
        ) as
          | Extract<
              WebElementComponent<T>,
              { component: "query" }
            >["items"][number]["endIcon"]
          | null;
        endIcon ??= null;

        items.push({ label, queries, startIcon, endIcon });
      }

      if (items.length === 0) {
        throw new Error(
          formatComponentError(
            "No queries found",
            componentName,
            elementResource,
          ),
        );
      }

      const componentOptions = parseWebsiteOptions(
        elementResource.options,
        options,
      );

      const displayedProperties = getPropertyByVariableLabel(
        componentProperty.properties,
        "use-property",
      );

      let variant = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "variant",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "query" }
          >["collectionProperties"]["variant"]
        | null;
      variant ??= "slide";

      let paginationVariant = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "pagination-variant",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "query" }
          >["collectionProperties"]["paginationVariant"]
        | null;
      paginationVariant ??= "default";

      let loadingVariant = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "loading-variant",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "query" }
          >["collectionProperties"]["loadingVariant"]
        | null;
      loadingVariant ??= "skeleton";

      let imageLayout = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "image-layout",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "query" }
          >["collectionProperties"]["imageLayout"]
        | null;
      imageLayout ??= "start";

      properties = {
        component: "query",
        linkUuids: setLinks.map((link) => link.uuid),
        items,
        options: componentOptions,
        collectionProperties: {
          displayedProperties:
            displayedProperties?.values
              .filter((value) => value.uuid !== null)
              .map((value) => ({ uuid: value.uuid!, label: value.label })) ??
            null,
          variant,
          paginationVariant,
          loadingVariant,
          imageLayout,
        },
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
        );
      }

      properties = { component: "table", linkUuid: tableLink.uuid };
      break;
    }
    case "search-bar": {
      let queryVariant:
        | Extract<
            WebElementComponent<T>,
            { component: "search-bar" }
          >["queryVariant"]
        | null = null;
      queryVariant = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "query-variant",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "search-bar" }
          >["queryVariant"]
        | null;
      queryVariant ??= "submit";

      const boundElementUuid =
        getPropertyByVariableLabel(
          componentProperty.properties,
          "bound-element",
        )?.values[0]?.uuid ?? null;

      const linkToProperty = getPropertyByVariableLabel(
        componentProperty.properties,
        "link-to",
      );
      const href =
        linkToProperty?.values[0]?.href != null ?
          transformPermanentIdentificationUrlToItemLink(
            linkToProperty.values[0].href,
          )
        : (linkToProperty?.values[0]?.slug ?? null);

      if (!boundElementUuid && !href) {
        throw new Error(
          formatComponentError(
            "Bound element or href not found",
            componentName,
            elementResource,
          ),
        );
      }

      let placeholder = getPropertyMultilingualValueByLabelName(
        componentProperty.properties,
        "placeholder-text",
        options,
      );
      placeholder ??= null;

      let baseFilterQueries = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "base-filter-queries",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "search-bar" }
          >["baseFilterQueries"]
        | null;
      baseFilterQueries ??= null;

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
      const content =
        elementResource.document && "content" in elementResource.document ?
          parseXMLContent(elementResource.document, options)
        : null;
      if (content == null) {
        throw new Error(
          formatComponentError(
            "Content not found",
            componentName,
            elementResource,
          ),
        );
      }

      let variantName: Extract<
        WebElementComponent<T>,
        { component: "text" }
      >["variant"]["name"] = "block";
      let variant: Extract<
        WebElementComponent<T>,
        { component: "text" }
      >["variant"];

      const variantProperty = getPropertyByVariableLabel(
        componentProperty.properties,
        "variant",
      );
      if (variantProperty !== null) {
        variantName = variantProperty.values[0]!.content as Extract<
          WebElementComponent<T>,
          { component: "text" }
        >["variant"]["name"];

        if (
          variantName === "paragraph" ||
          variantName === "label" ||
          variantName === "heading" ||
          variantName === "display"
        ) {
          let size = getPropertyValueContentByVariableLabel(
            variantProperty.properties,
            "size",
          ) as "xs" | "sm" | "md" | "lg" | null;
          size ??= "md";

          variant = { name: variantName, size };
        } else {
          variant = { name: variantName };
        }
      } else {
        variant = { name: variantName };
      }

      let headingLevel = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "heading-level",
      ) as
        | Extract<WebElementComponent<T>, { component: "text" }>["headingLevel"]
        | null;
      headingLevel ??= null;

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
        );
      }

      let isChaptersDisplayed = getPropertyValueContentByVariableLabel(
        componentProperty.properties,
        "chapters-displayed",
      ) as
        | Extract<
            WebElementComponent<T>,
            { component: "video" }
          >["isChaptersDisplayed"]
        | null;
      isChaptersDisplayed ??= true;

      properties = {
        component: "video",
        linkUuid: videoLink.uuid,
        isChaptersDisplayed,
      };
      break;
    }
    default: {
      console.warn(
        `Invalid or non-implemented component name “${unparsedComponentName.toString()}” for the following element: “${parseStringContent(
          elementResource.identification.label,
          options,
        )}”`,
      );
      break;
    }
  }

  if (properties === null) {
    throw new Error(
      formatComponentError(
        "Properties not found",
        componentName,
        elementResource,
      ),
    );
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

  const titleProperties =
    getPropertyByVariableLabelAndValueContent(
      properties,
      "presentation",
      "title",
    )?.properties ?? [];
  if (titleProperties.length > 0) {
    title.variant =
      (getPropertyValueContentByVariableLabel(titleProperties, "variant") as
        | WebTitle<T>["variant"]
        | null) ?? "default";

    title.properties.isNameDisplayed =
      (getPropertyValueContentByVariableLabel(
        titleProperties,
        "name-displayed",
      ) as WebTitle<T>["properties"]["isNameDisplayed"] | null) ?? false;

    title.properties.isDescriptionDisplayed =
      (getPropertyValueContentByVariableLabel(
        titleProperties,
        "description-displayed",
      ) as WebTitle<T>["properties"]["isDescriptionDisplayed"] | null) ?? false;

    title.properties.isDateDisplayed =
      (getPropertyValueContentByVariableLabel(
        titleProperties,
        "date-displayed",
      ) as WebTitle<T>["properties"]["isDateDisplayed"] | null) ?? false;

    title.properties.isCreatorsDisplayed =
      (getPropertyValueContentByVariableLabel(
        titleProperties,
        "creators-displayed",
      ) as WebTitle<T>["properties"]["isCreatorsDisplayed"] | null) ?? false;

    title.properties.isCountDisplayed =
      (getPropertyValueContentByVariableLabel(
        titleProperties,
        "count-displayed",
      ) as WebTitle<T>["properties"]["isCountDisplayed"] | null) ?? false;
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
): WebElement<T> {
  const identification = parseIdentification(
    elementResource.identification,
    options,
  );

  const elementProperties =
    elementResource.properties?.property ?
      parseSimplifiedProperties(elementResource.properties, options)
    : [];

  const presentationProperty = getPropertyByVariableLabel(
    elementProperties,
    "presentation",
  );
  if (presentationProperty === null) {
    throw new Error(
      `Presentation property not found for element (${formatXMLWebsiteResourceMetadata(
        elementResource,
      )})`,
    );
  }

  const componentProperty = getPropertyByVariableLabel(
    presentationProperty.properties,
    "component",
  );
  if (componentProperty === null) {
    throw new Error(
      `Component property not found for element (${formatXMLWebsiteResourceMetadata(
        elementResource,
      )})`,
    );
  }

  const properties = parseWebElementProperties(
    componentProperty,
    elementResource,
    options,
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
    type: "element",
    title,
    cssStyles,
    ...properties,
  };
}

/**
 * Parses raw webpage resources into standardized WebElement or Webpage objects
 *
 * @param webpageResources - Array of raw webpage resources in OCHRE format
 * @param type - Type of resource to parse ("element" or "page")
 * @returns Array of parsed WebElement or Webpage objects
 */
const parseWebpageResources = <
  TResource extends "element" | "page" | "block",
  T extends ReadonlyArray<string>,
>(
  webpageResources: Array<XMLWebsiteResource>,
  type: TResource,
  options: ParserOptions<T>,
): Array<
  TResource extends "element" ? WebElement<T>
  : TResource extends "page" ? Webpage<T>
  : WebBlock<T>
> => {
  const returnElements: Array<
    TResource extends "element" ? WebElement<T>
    : TResource extends "page" ? Webpage<T>
    : WebBlock<T>
  > = [];

  for (const resource of webpageResources) {
    const resourceProperties =
      resource.properties ?
        parseSimplifiedProperties(resource.properties, options)
      : [];

    const resourceProperty = getPropertyByVariableLabelAndValueContent(
      resourceProperties,
      "presentation",
      type,
    );
    if (resourceProperty === null) {
      continue;
    }

    switch (type) {
      case "element": {
        const element = parseWebElement(resource, options);

        returnElements.push(
          element as TResource extends "element" ? WebElement<T>
          : TResource extends "page" ? Webpage<T>
          : WebBlock<T>,
        );

        break;
      }
      case "page": {
        const webpage = parseWebpage(resource, options);
        if (webpage) {
          returnElements.push(
            webpage as TResource extends "element" ? WebElement<T>
            : TResource extends "page" ? Webpage<T>
            : WebBlock<T>,
          );
        }

        break;
      }
      case "block": {
        const block = parseWebBlock(resource, options);
        if (block) {
          returnElements.push(
            block as TResource extends "element" ? WebElement<T>
            : TResource extends "page" ? Webpage<T>
            : WebBlock<T>,
          );
        }

        break;
      }
    }
  }

  return returnElements;
};

/**
 * Parses raw webpage data into a standardized Webpage structure
 *
 * @param webpageResource - Raw webpage resource data in OCHRE format
 * @returns Parsed Webpage object
 */
function parseWebpage<T extends ReadonlyArray<string>>(
  webpageResource: XMLWebsiteResource,
  options: ParserOptions<T>,
  slugPrefix?: string,
): Webpage<T> | null {
  const webpageProperties =
    webpageResource.properties ?
      parseSimplifiedProperties(webpageResource.properties, options)
    : [];

  if (
    webpageProperties.length === 0 ||
    getPropertyValueContentByVariableLabel(
      webpageProperties,
      "presentation",
    ) !== "page"
  ) {
    return null;
  }

  const identification = parseIdentification(
    webpageResource.identification,
    options,
  );

  // TODO: Remove this once OCHRE is updated to allow segment-unique slugs
  const slug =
    webpageResource.slug?.replace(SEGMENT_UNIQUE_SLUG_PREFIX_REGEX, "") ?? null;

  if (slug == null) {
    throw new Error(
      `Slug not found for page (${formatXMLWebsiteResourceMetadata(webpageResource)})`,
    );
  }

  const returnWebpage: Webpage<T> = {
    uuid: webpageResource.uuid,
    type: "page",
    title: identification.label,
    slug:
      slugPrefix != null ?
        `${slugPrefix}/${slug}`.replace(TRAILING_SLASH_REGEX, "")
      : slug,
    publicationDateTime: webpageResource.publicationDateTime ?? null,
    items: [],
    properties: {
      width: "default",
      variant: "default",
      isBreadcrumbsDisplayed: false,
      isSidebarDisplayed: true,
      isDisplayedInNavbar: true,
      isNavbarSearchBarDisplayed: true,
      backgroundImage: null,
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
    webpageResource.resource != null ?
      normalizeWebsiteResources(webpageResource.resource)
    : [];

  const items: Array<WebSegment<T> | WebElement<T> | WebBlock<T>> = [];
  for (const resource of webpageResources) {
    const resourceProperties =
      resource.properties != null ?
        parseSimplifiedProperties(resource.properties, options)
      : [];

    const resourceType = getPropertyValueContentByVariableLabel(
      resourceProperties,
      "presentation",
    ) as "segment" | "element" | "block" | null;
    if (resourceType === null) {
      continue;
    }

    switch (resourceType) {
      case "segment": {
        const segment = parseWebSegment(resource, options);
        if (segment) {
          items.push(segment);
        }
        break;
      }
      case "element": {
        const element = parseWebElement(resource, options);
        items.push(element);
        break;
      }
      case "block": {
        const block = parseWebBlock(resource, options);
        if (block) {
          items.push(block);
        }
        break;
      }
    }
  }

  returnWebpage.items = items;

  returnWebpage.webpages =
    webpageResource.resource != null ?
      parseWebpageResources(
        normalizeWebsiteResources(webpageResource.resource),
        "page",
        options,
      )
    : [];

  const webpageSubProperties =
    getPropertyByVariableLabelAndValueContent(
      webpageProperties,
      "presentation",
      "page",
    )?.properties ?? [];

  if (webpageSubProperties.length > 0) {
    returnWebpage.properties.isDisplayedInNavbar =
      (getPropertyValueContentByVariableLabel(
        webpageSubProperties,
        "displayed-in-navbar",
      ) as Webpage<T>["properties"]["isDisplayedInNavbar"] | null) ?? true;

    returnWebpage.properties.width =
      (getPropertyValueContentByVariableLabel(webpageSubProperties, "width") as
        | Webpage<T>["properties"]["width"]
        | null) ?? "default";

    returnWebpage.properties.variant =
      (getPropertyValueContentByVariableLabel(
        webpageSubProperties,
        "variant",
      ) as Webpage<T>["properties"]["variant"] | null) ?? "default";

    returnWebpage.properties.isSidebarDisplayed =
      (getPropertyValueContentByVariableLabel(
        webpageSubProperties,
        "sidebar-displayed",
      ) as Webpage<T>["properties"]["isSidebarDisplayed"] | null) ?? true;

    returnWebpage.properties.isBreadcrumbsDisplayed =
      (getPropertyValueContentByVariableLabel(
        webpageSubProperties,
        "breadcrumbs-displayed",
      ) as Webpage<T>["properties"]["isBreadcrumbsDisplayed"] | null) ?? false;

    returnWebpage.properties.isNavbarSearchBarDisplayed =
      (getPropertyValueContentByVariableLabel(
        webpageSubProperties,
        "navbar-search-bar-displayed",
      ) as Webpage<T>["properties"]["isNavbarSearchBarDisplayed"] | null) ??
      true;
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
  slugPrefix?: string,
): Array<Webpage<T>> {
  const returnPages: Array<Webpage<T>> = [];

  for (const webpageResource of webpageResources) {
    const webpage = parseWebpage(webpageResource, options, slugPrefix);
    if (webpage !== null) {
      returnPages.push(webpage);
    }
  }

  return returnPages;
}

/**
 * Parses raw segment resource into a standardized WebSegment object
 *
 * @param segmentResource - Raw segment resource in OCHRE format
 * @returns Parsed WebSegment object
 */
function parseWebSegment<T extends ReadonlyArray<string>>(
  segmentResource: XMLWebsiteResource,
  options: ParserOptions<T>,
  slugPrefix?: string,
): WebSegment<T> | null {
  const webpageProperties =
    segmentResource.properties ?
      parseSimplifiedProperties(segmentResource.properties, options)
    : [];

  if (
    webpageProperties.length === 0 ||
    getPropertyValueContentByVariableLabel(
      webpageProperties,
      "presentation",
    ) !== "segment"
  ) {
    return null;
  }

  const identification = parseIdentification(
    segmentResource.identification,
    options,
  );

  const slug =
    segmentResource.identification.abbreviation != null ?
      parseStringContent(segmentResource.identification.abbreviation, options)
    : null;
  if (slug == null) {
    throw new Error(
      `Slug not found for segment (${formatXMLWebsiteResourceMetadata(
        segmentResource,
      )})`,
    );
  }

  const returnSegment: WebSegment<T> = {
    uuid: segmentResource.uuid,
    type: "segment",
    title: identification.label,
    slug,
    publicationDateTime: segmentResource.publicationDateTime ?? null,
    items: [],
  };

  const childResources =
    segmentResource.resource ?
      normalizeWebsiteResources(segmentResource.resource)
    : [];

  returnSegment.items = parseWebSegmentItems(
    childResources,
    options,
    slugPrefix != null ?
      `${slugPrefix}/${slug}`.replace(TRAILING_SLASH_REGEX, "")
    : slug,
  );

  return returnSegment;
}

/**
 * Parses raw segment resources into an array of WebSegment objects
 *
 * @param segmentResources - Array of raw segment resources in OCHRE format
 * @returns Array of parsed WebSegment objects
 */
function parseSegments<T extends ReadonlyArray<string>>(
  segmentResources: Array<XMLWebsiteResource>,
  options: ParserOptions<T>,
  slugPrefix?: string,
): Array<WebSegment<T>> {
  const returnSegments: Array<WebSegment<T>> = [];

  for (const segmentResource of segmentResources) {
    const segment = parseWebSegment(segmentResource, options, slugPrefix);
    if (segment !== null) {
      returnSegments.push(segment);
    }
  }

  return returnSegments;
}

/**
 * Parses raw segment item into a standardized WebSegmentItem object
 *
 * @param segmentItemResource - Raw segment item resource in OCHRE format
 * @returns Parsed WebSegmentItem object
 */
function parseWebSegmentItem<T extends ReadonlyArray<string>>(
  segmentItemResource: XMLWebsiteResource,
  options: ParserOptions<T>,
  slugPrefix?: string,
): WebSegmentItem<T> | null {
  const webpageProperties =
    segmentItemResource.properties ?
      parseSimplifiedProperties(segmentItemResource.properties, options)
    : [];

  if (
    webpageProperties.length === 0 ||
    getPropertyValueContentByVariableLabel(
      webpageProperties,
      "presentation",
    ) !== "segment-item"
  ) {
    return null;
  }

  const identification = parseIdentification(
    segmentItemResource.identification,
    options,
  );

  const slug =
    segmentItemResource.identification.abbreviation != null ?
      parseStringContent(
        segmentItemResource.identification.abbreviation,
        options,
      )
    : null;
  if (slug == null) {
    throw new Error(
      `Slug not found for segment item (${formatXMLWebsiteResourceMetadata(
        segmentItemResource,
      )})`,
    );
  }

  const returnSegmentItem: WebSegmentItem<T> = {
    uuid: segmentItemResource.uuid,
    type: "segment-item",
    title: identification.label,
    slug,
    publicationDateTime: segmentItemResource.publicationDateTime ?? null,
    items: [],
  };

  const resources =
    segmentItemResource.resource ?
      normalizeWebsiteResources(segmentItemResource.resource)
    : [];

  returnSegmentItem.items.push(
    ...parseWebpages(
      resources,
      options,
      slugPrefix != null ?
        `${slugPrefix}/${slug}`.replace(TRAILING_SLASH_REGEX, "")
      : slug,
    ),
    ...parseSegments(
      resources,
      options,
      slugPrefix != null ?
        `${slugPrefix}/${slug}`.replace(TRAILING_SLASH_REGEX, "")
      : slug,
    ),
  );

  return returnSegmentItem;
}

/**
 * Parses raw segment items into an array of WebSegmentItem objects
 *
 * @param segmentItems - Array of raw segment items in OCHRE format
 * @returns Array of parsed WebSegmentItem objects
 */
function parseWebSegmentItems<T extends ReadonlyArray<string>>(
  segmentItems: Array<XMLWebsiteResource>,
  options: ParserOptions<T>,
  slugPrefix?: string,
): Array<WebSegmentItem<T>> {
  const returnItems: Array<WebSegmentItem<T>> = [];

  for (const segmentItem of segmentItems) {
    const segmentItemParsed = parseWebSegmentItem(
      segmentItem,
      options,
      slugPrefix,
    );
    if (segmentItemParsed !== null) {
      returnItems.push(segmentItemParsed);
    }
  }

  return returnItems;
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
): Website<T>["properties"]["sidebar"] | null {
  let returnSidebar: Website<T>["properties"]["sidebar"] | null = null;

  const items: NonNullable<Website<T>["properties"]["sidebar"]>["items"] = [];
  let title: WebTitle<T> | null = null;
  let layout: "start" | "end" = "start";
  let mobileLayout: "default" | "inline" = "default";
  const cssStyles: NonNullable<
    Website<T>["properties"]["sidebar"]
  >["cssStyles"] = { default: [], tablet: [], mobile: [] };

  const sidebarResource = resources.find((resource) => {
    const resourceProperties =
      resource.properties ?
        parseSimplifiedProperties(resource.properties, options)
      : [];

    return (
      getPropertyValueContentByVariableLabel(
        resourceProperties,
        "presentation",
      ) === "element" &&
      getPropertyValueContentByVariableLabel(
        resourceProperties[0]?.properties ?? [],
        "component",
      ) === "sidebar"
    );
  });
  if (sidebarResource != null) {
    const sidebarBaseProperties =
      sidebarResource.properties ?
        parseSimplifiedProperties(sidebarResource.properties, options)
      : [];

    title = parseWebTitle(
      sidebarBaseProperties,
      parseIdentification(sidebarResource.identification, options),
    );

    const sidebarProperties =
      sidebarBaseProperties
        .find(
          (property) =>
            property.variable.label === "presentation" &&
            property.values[0]?.content === "element",
        )
        ?.properties.find(
          (property) =>
            property.variable.label === "component" &&
            property.values[0]?.content === "sidebar",
        )?.properties ?? [];

    const sidebarLayoutProperty = sidebarProperties.find(
      (property) => property.variable.label === "layout",
    );
    if (sidebarLayoutProperty) {
      layout = sidebarLayoutProperty.values[0]!.content as "start" | "end";
    }

    const sidebarMobileLayoutProperty = sidebarProperties.find(
      (property) => property.variable.label === "layout-mobile",
    );
    if (sidebarMobileLayoutProperty) {
      mobileLayout = sidebarMobileLayoutProperty.values[0]!.content as
        | "default"
        | "inline";
    }

    const parsedCssStyles = parseResponsiveCssStyles(sidebarBaseProperties);
    cssStyles.default = parsedCssStyles.default;
    cssStyles.tablet = parsedCssStyles.tablet;
    cssStyles.mobile = parsedCssStyles.mobile;

    const sidebarResources =
      sidebarResource.resource ?
        normalizeWebsiteResources(sidebarResource.resource)
      : [];

    for (const resource of sidebarResources) {
      const resourceProperties =
        resource.properties ?
          parseSimplifiedProperties(resource.properties, options)
        : [];

      const resourceType = getPropertyValueContentByVariableLabel(
        resourceProperties,
        "presentation",
      ) as "element" | "block" | null;
      if (resourceType === null) {
        continue;
      }

      switch (resourceType) {
        case "element": {
          const element = parseWebElement(resource, options);
          items.push(element);
          break;
        }
        case "block": {
          const block = parseWebBlock(resource, options);
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

/**
 * Parses raw text element data for accordion layout with items support
 *
 * @param elementResource - Raw element resource data in OCHRE format
 * @returns Parsed text WebElement with items array
 */
function parseWebElementForAccordion<T extends ReadonlyArray<string>>(
  elementResource: XMLWebsiteResource,
  options: ParserOptions<T>,
): Extract<WebElement<T>, { component: "text" }> & {
  items: Array<WebElement<T> | WebBlock<T>>;
} {
  const textElement = parseWebElement(elementResource, options) as Extract<
    WebElement<T>,
    { component: "text" }
  >;

  const childResources =
    elementResource.resource ?
      normalizeWebsiteResources(elementResource.resource)
    : [];

  const items: Array<WebElement<T> | WebBlock<T>> = [];
  for (const resource of childResources) {
    const resourceProperties =
      resource.properties ?
        parseSimplifiedProperties(resource.properties, options)
      : [];

    const resourceType = getPropertyValueContentByVariableLabel(
      resourceProperties,
      "presentation",
    ) as "element" | "block" | null;
    if (resourceType === null) {
      continue;
    }

    switch (resourceType) {
      case "element": {
        const element = parseWebElement(resource, options);
        items.push(element);
        break;
      }
      case "block": {
        const block = parseWebBlock(resource, options);
        if (block) {
          items.push(block);
        }
        break;
      }
    }
  }

  return { ...textElement, items };
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
): WebBlock<T> | null {
  const blockProperties =
    blockResource.properties ?
      parseSimplifiedProperties(blockResource.properties, options)
    : [];

  const returnBlock: WebBlock<T> = {
    uuid: blockResource.uuid,
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

  const blockMainProperties =
    getPropertyByVariableLabelAndValueContent(
      blockProperties,
      "presentation",
      "block",
    )?.properties ?? [];
  if (blockMainProperties.length > 0) {
    returnBlock.properties.default.layout =
      (getPropertyValueContentByVariableLabel(blockMainProperties, "layout") as
        | WebBlock<T>["properties"]["default"]["layout"]
        | null) ?? "vertical";

    returnBlock.properties.default.wrap =
      (getPropertyValueContentByVariableLabel(blockMainProperties, "wrap") as
        | WebBlock<T>["properties"]["default"]["wrap"]
        | null) ?? "nowrap";

    if (returnBlock.properties.default.layout === "accordion") {
      returnBlock.properties.default.isAccordionEnabled =
        (getPropertyValueContentByVariableLabel(
          blockMainProperties,
          "accordion-enabled",
        ) as
          | WebBlock<T>["properties"]["default"]["isAccordionEnabled"]
          | null) ?? true;

      returnBlock.properties.default.isAccordionExpandedByDefault =
        (getPropertyValueContentByVariableLabel(
          blockMainProperties,
          "accordion-expanded",
        ) as
          | WebBlock<T>["properties"]["default"]["isAccordionExpandedByDefault"]
          | null) ?? true;

      returnBlock.properties.default.isAccordionSidebarDisplayed =
        (getPropertyValueContentByVariableLabel(
          blockMainProperties,
          "accordion-sidebar-displayed",
        ) as
          | WebBlock<T>["properties"]["default"]["isAccordionSidebarDisplayed"]
          | null) ?? false;
    }

    returnBlock.properties.default.spacing =
      (getPropertyValueContentByVariableLabel(
        blockMainProperties,
        "spacing",
      ) as WebBlock<T>["properties"]["default"]["spacing"] | null) ?? null;

    returnBlock.properties.default.gap =
      (getPropertyValueContentByVariableLabel(blockMainProperties, "gap") as
        | WebBlock<T>["properties"]["default"]["gap"]
        | null) ?? null;

    const tabletOverwriteProperty = getPropertyByVariableLabel(
      blockMainProperties,
      "overwrite-tablet",
    );
    if (tabletOverwriteProperty !== null) {
      const tabletOverwriteProperties = tabletOverwriteProperty.properties;

      const propertiesTablet: NonNullable<WebBlock<T>["properties"]["tablet"]> =
        {
          layout:
            (getPropertyValueContentByVariableLabel(
              tabletOverwriteProperties,
              "layout",
            ) as
              | NonNullable<WebBlock<T>["properties"]["tablet"]>["layout"]
              | null) ?? undefined,
          wrap:
            (getPropertyValueContentByVariableLabel(
              tabletOverwriteProperties,
              "wrap",
            ) as
              | NonNullable<WebBlock<T>["properties"]["tablet"]>["wrap"]
              | null) ?? undefined,
          spacing:
            (getPropertyValueContentByVariableLabel(
              tabletOverwriteProperties,
              "spacing",
            ) as
              | NonNullable<WebBlock<T>["properties"]["tablet"]>["spacing"]
              | null) ?? undefined,
          gap:
            (getPropertyValueContentByVariableLabel(
              tabletOverwriteProperties,
              "gap",
            ) as
              | NonNullable<WebBlock<T>["properties"]["tablet"]>["gap"]
              | null) ?? undefined,
          isAccordionEnabled: undefined,
          isAccordionExpandedByDefault: undefined,
          isAccordionSidebarDisplayed: undefined,
        };

      if (
        propertiesTablet.layout === "accordion" ||
        returnBlock.properties.default.layout === "accordion"
      ) {
        propertiesTablet.isAccordionEnabled =
          (getPropertyValueContentByVariableLabel(
            tabletOverwriteProperties,
            "accordion-enabled",
          ) as
            | NonNullable<
                WebBlock<T>["properties"]["tablet"]
              >["isAccordionEnabled"]
            | null) ?? undefined;

        propertiesTablet.isAccordionExpandedByDefault =
          (getPropertyValueContentByVariableLabel(
            tabletOverwriteProperties,
            "accordion-expanded",
          ) as
            | NonNullable<
                WebBlock<T>["properties"]["tablet"]
              >["isAccordionExpandedByDefault"]
            | null) ?? undefined;

        propertiesTablet.isAccordionSidebarDisplayed =
          (getPropertyValueContentByVariableLabel(
            tabletOverwriteProperties,
            "accordion-sidebar-displayed",
          ) as
            | NonNullable<
                WebBlock<T>["properties"]["tablet"]
              >["isAccordionSidebarDisplayed"]
            | null) ?? undefined;
      }

      const cleanedPropertiesTablet = cleanObject(propertiesTablet);

      if (Object.keys(cleanedPropertiesTablet).length > 0) {
        returnBlock.properties.tablet = cleanedPropertiesTablet;
      }
    }

    const mobileOverwriteProperty = getPropertyByVariableLabel(
      blockMainProperties,
      "overwrite-mobile",
    );
    if (mobileOverwriteProperty !== null) {
      const mobileOverwriteProperties = mobileOverwriteProperty.properties;

      const propertiesMobile: NonNullable<WebBlock<T>["properties"]["mobile"]> =
        {
          layout:
            (getPropertyValueContentByVariableLabel(
              mobileOverwriteProperties,
              "layout",
            ) as
              | NonNullable<WebBlock<T>["properties"]["default"]>["layout"]
              | null) ?? undefined,
          wrap:
            (getPropertyValueContentByVariableLabel(
              mobileOverwriteProperties,
              "wrap",
            ) as
              | NonNullable<WebBlock<T>["properties"]["mobile"]>["wrap"]
              | null) ?? undefined,
          spacing:
            (getPropertyValueContentByVariableLabel(
              mobileOverwriteProperties,
              "spacing",
            ) as
              | NonNullable<WebBlock<T>["properties"]["default"]>["spacing"]
              | null) ?? undefined,
          gap:
            (getPropertyValueContentByVariableLabel(
              mobileOverwriteProperties,
              "gap",
            ) as
              | NonNullable<WebBlock<T>["properties"]["default"]>["gap"]
              | null) ?? undefined,
          isAccordionEnabled: undefined,
          isAccordionExpandedByDefault: undefined,
          isAccordionSidebarDisplayed: undefined,
        };

      if (
        propertiesMobile.layout === "accordion" ||
        returnBlock.properties.default.layout === "accordion"
      ) {
        propertiesMobile.isAccordionEnabled =
          (getPropertyValueContentByVariableLabel(
            mobileOverwriteProperties,
            "accordion-enabled",
          ) as
            | NonNullable<
                WebBlock<T>["properties"]["mobile"]
              >["isAccordionEnabled"]
            | null) ?? undefined;

        propertiesMobile.isAccordionExpandedByDefault =
          (getPropertyValueContentByVariableLabel(
            mobileOverwriteProperties,
            "accordion-expanded",
          ) as
            | NonNullable<
                WebBlock<T>["properties"]["mobile"]
              >["isAccordionExpandedByDefault"]
            | null) ?? undefined;

        propertiesMobile.isAccordionSidebarDisplayed =
          (getPropertyValueContentByVariableLabel(
            mobileOverwriteProperties,
            "accordion-sidebar-displayed",
          ) as
            | NonNullable<
                WebBlock<T>["properties"]["mobile"]
              >["isAccordionSidebarDisplayed"]
            | null) ?? undefined;
      }

      const cleanedPropertiesMobile = cleanObject(propertiesMobile);

      if (Object.keys(cleanedPropertiesMobile).length > 0) {
        returnBlock.properties.mobile = cleanedPropertiesMobile;
      }
    }
  }

  const blockResources =
    blockResource.resource ?
      normalizeWebsiteResources(blockResource.resource)
    : [];

  if (returnBlock.properties.default.layout === "accordion") {
    const accordionItems: Array<
      Extract<WebElement<T>, { component: "text" }> & {
        items: Array<WebElement<T> | WebBlock<T>>;
      }
    > = [];

    for (const resource of blockResources) {
      const resourceProperties =
        resource.properties ?
          parseSimplifiedProperties(resource.properties, options)
        : [];

      const resourceType = getPropertyValueContentByVariableLabel(
        resourceProperties,
        "presentation",
      ) as "element" | "block" | null;

      if (resourceType !== "element") {
        throw new Error(
          `Accordion only accepts elements, but got “${resourceType}” (${formatXMLWebsiteResourceMetadata(
            resource,
          )})`,
        );
      }

      const presentationProperty = getPropertyByVariableLabel(
        resourceProperties,
        "presentation",
      );
      const componentType = getPropertyValueContentByVariableLabel(
        presentationProperty?.properties ?? [],
        "component",
      ) as string | null;

      if (componentType !== "text") {
        throw new Error(
          `Accordion only accepts text components, but got “${componentType}” (${formatXMLWebsiteResourceMetadata(
            resource,
          )})`,
        );
      }

      const element = parseWebElementForAccordion(resource, options);
      accordionItems.push(element);
    }

    returnBlock.items = accordionItems;
  } else {
    const blockItems: Array<WebElement<T> | WebBlock<T>> = [];
    for (const resource of blockResources) {
      const resourceProperties =
        resource.properties ?
          parseSimplifiedProperties(resource.properties, options)
        : [];

      const resourceType = getPropertyValueContentByVariableLabel(
        resourceProperties,
        "presentation",
      ) as "element" | "block" | null;
      if (resourceType === null) {
        continue;
      }

      switch (resourceType) {
        case "element": {
          const element = parseWebElement(resource, options);
          blockItems.push(element);
          break;
        }
        case "block": {
          const block = parseWebBlock(resource, options);
          if (block) {
            blockItems.push(block);
          }
          break;
        }
      }
    }

    returnBlock.items = blockItems;
  }

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
  sidebar: Website<T>["properties"]["sidebar"] | null,
  options: ParserOptions<T>,
): Website<T>["properties"] {
  const mainProperties = parseSimplifiedProperties(
    { property: properties },
    options,
  );
  const websiteProperties =
    getPropertyByVariableLabel(mainProperties, "presentation")?.properties ??
    [];

  let type = getPropertyValueContentByVariableLabel(
    websiteProperties,
    "webUI",
  ) as Website<T>["properties"]["type"] | null;
  type ??= "traditional";

  let status = getPropertyValueContentByVariableLabel(
    websiteProperties,
    "status",
  ) as Website<T>["properties"]["status"] | null;
  status ??= "development";

  let privacy = getPropertyValueContentByVariableLabel(
    websiteProperties,
    "privacy",
  ) as Website<T>["properties"]["privacy"] | null;
  privacy ??= "public";

  const returnProperties: Website<T>["properties"] = {
    type,
    status,
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

  const contactProperty = getPropertyByVariableLabel(
    websiteProperties,
    "contact",
  );
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
      );
    }
  }

  returnProperties.loadingVariant =
    (getPropertyValueContentByVariableLabel(
      websiteProperties,
      "loading-variant",
    ) as Website<T>["properties"]["loadingVariant"] | null) ?? "spinner";

  returnProperties.theme.isThemeToggleDisplayed =
    (getPropertyValueContentByVariableLabel(
      websiteProperties,
      "supports-theme-toggle",
    ) as Website<T>["properties"]["theme"]["isThemeToggleDisplayed"] | null) ??
    true;

  returnProperties.theme.defaultTheme =
    (getPropertyValueContentByVariableLabel(
      websiteProperties,
      "default-theme",
    ) as Website<T>["properties"]["theme"]["defaultTheme"] | null) ?? "system";

  returnProperties.icon.logoUuid =
    getPropertyByVariableLabel(websiteProperties, "navbar-logo")?.values[0]
      ?.uuid ?? null;

  returnProperties.icon.faviconUuid =
    getPropertyByVariableLabel(websiteProperties, "favicon-ico")?.values[0]
      ?.uuid ?? null;

  returnProperties.icon.appleTouchIconUuid =
    getPropertyByVariableLabel(websiteProperties, "favicon-img")?.values[0]
      ?.uuid ?? null;

  returnProperties.navbar.isDisplayed =
    (getPropertyValueContentByVariableLabel(
      websiteProperties,
      "navbar-displayed",
    ) as Website<T>["properties"]["navbar"]["isDisplayed"] | null) ?? true;

  returnProperties.navbar.variant =
    (getPropertyValueContentByVariableLabel(
      websiteProperties,
      "navbar-variant",
    ) as Website<T>["properties"]["navbar"]["variant"] | null) ?? "default";

  returnProperties.navbar.alignment =
    (getPropertyValueContentByVariableLabel(
      websiteProperties,
      "navbar-alignment",
    ) as Website<T>["properties"]["navbar"]["alignment"] | null) ?? "start";

  returnProperties.navbar.isProjectDisplayed =
    (getPropertyValueContentByVariableLabel(
      websiteProperties,
      "navbar-project-displayed",
    ) as Website<T>["properties"]["navbar"]["isProjectDisplayed"] | null) ??
    true;

  returnProperties.navbar.searchBarBoundElementUuid =
    getPropertyByVariableLabel(
      websiteProperties,
      "bound-element-navbar-search-bar",
    )?.values[0]?.uuid ?? null;

  returnProperties.footer.isDisplayed =
    (getPropertyValueContentByVariableLabel(
      websiteProperties,
      "footer-displayed",
    ) as Website<T>["properties"]["footer"]["isDisplayed"] | null) ?? true;

  returnProperties.footer.logoUuid =
    getPropertyByVariableLabel(websiteProperties, "footer-logo")?.values[0]
      ?.uuid ?? null;

  const itemPageTypeProperty = getPropertyByVariableLabelAndValueContent(
    websiteProperties,
    "page-type",
    "item-page",
  );
  if (itemPageTypeProperty !== null) {
    returnProperties.itemPage.isMainContentDisplayed =
      (getPropertyValueContentByVariableLabel(
        itemPageTypeProperty.properties,
        "item-page-main-content-displayed",
      ) as
        | Website<T>["properties"]["itemPage"]["isMainContentDisplayed"]
        | null) ?? true;

    returnProperties.itemPage.isDescriptionDisplayed =
      (getPropertyValueContentByVariableLabel(
        itemPageTypeProperty.properties,
        "item-page-description-displayed",
      ) as
        | Website<T>["properties"]["itemPage"]["isDescriptionDisplayed"]
        | null) ?? true;

    returnProperties.itemPage.isDocumentDisplayed =
      (getPropertyValueContentByVariableLabel(
        itemPageTypeProperty.properties,
        "item-page-document-displayed",
      ) as
        | Website<T>["properties"]["itemPage"]["isDocumentDisplayed"]
        | null) ?? true;

    returnProperties.itemPage.isNotesDisplayed =
      (getPropertyValueContentByVariableLabel(
        itemPageTypeProperty.properties,
        "item-page-notes-displayed",
      ) as Website<T>["properties"]["itemPage"]["isNotesDisplayed"] | null) ??
      true;

    returnProperties.itemPage.isEventsDisplayed =
      (getPropertyValueContentByVariableLabel(
        itemPageTypeProperty.properties,
        "item-page-events-displayed",
      ) as Website<T>["properties"]["itemPage"]["isEventsDisplayed"] | null) ??
      true;

    returnProperties.itemPage.isPeriodsDisplayed =
      (getPropertyValueContentByVariableLabel(
        itemPageTypeProperty.properties,
        "item-page-periods-displayed",
      ) as Website<T>["properties"]["itemPage"]["isPeriodsDisplayed"] | null) ??
      true;

    returnProperties.itemPage.isPropertiesDisplayed =
      (getPropertyValueContentByVariableLabel(
        itemPageTypeProperty.properties,
        "item-page-properties-displayed",
      ) as
        | Website<T>["properties"]["itemPage"]["isPropertiesDisplayed"]
        | null) ?? true;

    returnProperties.itemPage.isBibliographyDisplayed =
      (getPropertyValueContentByVariableLabel(
        itemPageTypeProperty.properties,
        "item-page-bibliography-displayed",
      ) as
        | Website<T>["properties"]["itemPage"]["isBibliographyDisplayed"]
        | null) ?? true;

    returnProperties.itemPage.isPropertyValuesGrouped =
      (getPropertyValueContentByVariableLabel(
        itemPageTypeProperty.properties,
        "item-page-property-values-grouped",
      ) as
        | Website<T>["properties"]["itemPage"]["isPropertyValuesGrouped"]
        | null) ?? true;

    returnProperties.itemPage.isPublicationDateTimeDisplayed =
      (getPropertyValueContentByVariableLabel(
        itemPageTypeProperty.properties,
        "item-page-publication-date-time-displayed",
      ) as
        | Website<T>["properties"]["itemPage"]["isPublicationDateTimeDisplayed"]
        | null) ?? true;

    returnProperties.itemPage.isPersistentIdentifierDisplayed =
      (getPropertyValueContentByVariableLabel(
        itemPageTypeProperty.properties,
        "item-page-persistent-identifier-displayed",
      ) as
        | Website<T>["properties"]["itemPage"]["isPersistentIdentifierDisplayed"]
        | null) ?? true;

    returnProperties.itemPage.iiifViewer =
      (getPropertyValueContentByVariableLabel(
        itemPageTypeProperty.properties,
        "item-page-iiif-viewer",
      ) as Website<T>["properties"]["itemPage"]["iiifViewer"] | null) ??
      "universal-viewer";
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
      rawValueUuid == null || rawValueUuid.trim() === "null" ?
        null
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
    throw new Error("Website tree not found");
  }

  if (!websiteTree.properties) {
    throw new Error(
      `Website properties not found (website uuid “${websiteTree.uuid}”)`,
    );
  }

  if (websiteTree.items?.resource == null) {
    throw new Error(
      `Website pages not found (website uuid “${websiteTree.uuid}”)`,
    );
  }

  const resources = normalizeWebsiteResources(websiteTree.items.resource);

  const items = [
    ...parseWebpages(resources, parserOptions),
    ...parseSegments(resources, parserOptions),
  ];

  const sidebar = parseSidebar(resources, parserOptions);

  const properties = parseWebsiteProperties(
    websiteTree.properties.property,
    websiteTree,
    sidebar,
    parserOptions,
  );

  return {
    uuid: websiteTree.uuid,
    belongsTo: {
      uuid: rawOchre.uuidBelongsTo,
      abbreviation: rawOchre.belongsTo,
    },
    metadata: parseMetadata(rawOchre, parserOptions, defaultLanguage),
    publicationDateTime: websiteTree.publicationDateTime ?? null,
    identification: parseIdentification(
      websiteTree.identification,
      parserOptions,
    ),
    creators:
      websiteTree.creators ?
        parsePersonList(websiteTree.creators.creator, parserOptions)
      : [],
    license: parseLicense(websiteTree.availability),
    items,
    properties,
  };
}
