import type {
  OchreLevelContext,
  OchreMetadata,
  OchreProperty,
  OchreResource,
  OchreStringContent,
  OchreStringRichText,
  OchreTree,
} from "../../types/internal.raw.d.ts";
import type {
  ApiVersion,
  Identification,
  Property,
} from "../../types/index.js";
import type {
  LevelContext,
  LevelContextItem,
  Style,
  WebBlock,
  WebElement,
  WebElementComponent,
  WebImage,
  Webpage,
  WebSegment,
  WebSegmentItem,
  Website,
  WebTitle,
} from "../../types/website.js";
import { boundsSchema, componentSchema } from "../../schemas.js";
import {
  getPropertyByLabel,
  getPropertyByLabelAndValue,
  getPropertyValueByLabel,
} from "../../utils/getters.js";
import { parseStringContent } from "../../utils/string.js";
import { DEFAULT_API_VERSION } from "../helpers.js";
import {
  cleanObject,
  ensureArray,
  parseFakeStringOrContent,
  parseOptionalDate,
} from "../internal.js";
import {
  parseDocument,
  parseIdentification,
  parseLicense,
  parseLinks,
  parseMetadata,
  parseNotes,
  parsePersons,
  parseProperties,
} from "./index.js";

/**
 * Extracts CSS style properties for a given presentation variant.
 *
 * @param properties - Array of properties to parse
 * @param cssVariant - CSS variant to parse
 * @returns Array of CSS styles
 */
function parseCssStylesFromProperties(
  properties: Array<Property>,
  cssVariant?: string,
): Array<Style> {
  const label = cssVariant != null ? `css-${cssVariant}` : "css";
  const cssProperties =
    getPropertyByLabelAndValue(properties, "presentation", label)?.properties ??
    [];
  const styles: Array<Style> = [];
  for (const property of cssProperties) {
    const value = property.values[0]?.content?.toString();
    if (value != null) {
      styles.push({ label: property.label, value });
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
function parseResponsiveCssStyles(properties: Array<Property>): {
  default: Array<Style>;
  tablet: Array<Style>;
  mobile: Array<Style>;
} {
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
  const result = boundsSchema.safeParse(bounds);
  if (!result.success) {
    throw new Error(`Invalid bounds: ${result.error.message}`);
  }

  return result.data;
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
function parseAllOptionContexts(options: {
  flattenContexts?: OchreLevelContext | Array<OchreLevelContext> | null;
  suppressContexts?: OchreLevelContext | Array<OchreLevelContext> | null;
  filterContexts?: OchreLevelContext | Array<OchreLevelContext> | null;
  sortContexts?: OchreLevelContext | Array<OchreLevelContext> | null;
  detailContexts?: OchreLevelContext | Array<OchreLevelContext> | null;
  downloadContexts?: OchreLevelContext | Array<OchreLevelContext> | null;
  labelContexts?: OchreLevelContext | Array<OchreLevelContext> | null;
  prominentContexts?: OchreLevelContext | Array<OchreLevelContext> | null;
}): {
  flatten: Array<LevelContext>;
  suppress: Array<LevelContext>;
  filter: Array<LevelContext>;
  sort: Array<LevelContext>;
  detail: Array<LevelContext>;
  download: Array<LevelContext>;
  label: Array<LevelContext>;
  prominent: Array<LevelContext>;
} {
  function handleContexts(
    v: OchreLevelContext | Array<OchreLevelContext> | null | undefined,
  ): Array<LevelContext> {
    return parseContexts(v != null ? ensureArray(v) : []);
  }

  return {
    flatten: handleContexts(options.flattenContexts),
    suppress: handleContexts(options.suppressContexts),
    filter: handleContexts(options.filterContexts),
    sort: handleContexts(options.sortContexts),
    detail: handleContexts(options.detailContexts),
    download: handleContexts(options.downloadContexts),
    label: handleContexts(options.labelContexts),
    prominent: handleContexts(options.prominentContexts),
  };
}

/**
 * Parses raw web element properties into a standardized WebElementComponent structure
 *
 * @param componentProperty - Raw component property data in OCHRE format
 * @param elementResource - Raw element resource data in OCHRE format
 * @returns Parsed WebElementComponent object
 */
function parseWebElementProperties(
  componentProperty: Property,
  elementResource: OchreResource,
): WebElementComponent {
  const unparsedComponentName = componentProperty.values[0]!.content;
  const { data: componentName } = componentSchema.safeParse(
    unparsedComponentName,
  );

  let properties: WebElementComponent | null = null;

  const links =
    elementResource.links ? parseLinks(ensureArray(elementResource.links)) : [];

  switch (componentName) {
    case "3d-viewer": {
      const resourceLink = links.find(
        (link) =>
          link.category === "resource" && link.fileFormat === "model/obj",
      );
      if (resourceLink?.uuid == null) {
        throw new Error(
          `Resource link not found for the following component: “${componentName}”`,
        );
      }

      let isInteractive = getPropertyValueByLabel(
        componentProperty.properties,
        "is-interactive",
      ) as
        | Extract<
            WebElementComponent,
            { component: "3d-viewer" }
          >["isInteractive"]
        | null;
      isInteractive ??= true;

      let isControlsDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "controls-displayed",
      ) as
        | Extract<
            WebElementComponent,
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
        getPropertyByLabel(componentProperty.properties, "bound-element")
          ?.values[0]?.uuid ?? null;

      const linkToProperty = getPropertyByLabel(
        componentProperty.properties,
        "link-to",
      );
      const href =
        linkToProperty?.values[0]?.href ??
        linkToProperty?.values[0]?.slug ??
        null;

      if (boundElementPropertyUuid == null && href == null) {
        throw new Error(
          `Bound element or href not found for the following component: “${componentName}”`,
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
      const documentLink = links.find(
        (link) => link.type === "internalDocument",
      );
      if (documentLink?.uuid == null) {
        throw new Error(
          `Document link not found for the following component: “${componentName}”`,
        );
      }

      properties = {
        component: "annotated-document",
        linkUuid: documentLink.uuid,
      };
      break;
    }
    case "annotated-image": {
      const imageLinks = links.filter(
        (link) => link.type === "image" || link.type === "IIIF",
      );

      if (imageLinks.length === 0 || imageLinks[0]!.uuid == null) {
        throw new Error(
          `Image link not found for the following component: “${componentName}”`,
        );
      }

      let isFilterInputDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "filter-input-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "annotated-image" }
          >["isFilterInputDisplayed"]
        | null;
      isFilterInputDisplayed ??= true;

      let isOptionsDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "options-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "annotated-image" }
          >["isOptionsDisplayed"]
        | null;
      isOptionsDisplayed ??= true;

      let isAnnotationHighlightsDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "annotation-highlights-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "annotated-image" }
          >["isAnnotationHighlightsDisplayed"]
        | null;
      isAnnotationHighlightsDisplayed ??= true;

      let isAnnotationTooltipsDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "annotation-tooltips-displayed",
      ) as
        | Extract<
            WebElementComponent,
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
      const audioLink = links.find((link) => link.type === "audio");
      if (audioLink?.uuid == null) {
        throw new Error(
          `Audio link not found for the following component: “${componentName}”`,
        );
      }

      let isSpeedControlsDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "speed-controls-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "audio-player" }
          >["isSpeedControlsDisplayed"]
        | null;
      isSpeedControlsDisplayed ??= true;

      let isVolumeControlsDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "volume-controls-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "audio-player" }
          >["isVolumeControlsDisplayed"]
        | null;
      isVolumeControlsDisplayed ??= true;

      let isSeekBarDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "seek-bar-displayed",
      ) as
        | Extract<
            WebElementComponent,
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
      const itemLinks = links.filter(
        (link) => link.category !== "bibliography",
      );
      const bibliographyLink = links.find(
        (link) => link.category === "bibliography",
      );
      if (itemLinks.length === 0 && bibliographyLink?.bibliographies == null) {
        throw new Error(
          `No links found for the following component: “${componentName}”`,
        );
      }

      let layout = getPropertyValueByLabel(
        componentProperty.properties,
        "layout",
      ) as
        | Extract<WebElementComponent, { component: "bibliography" }>["layout"]
        | null;
      layout ??= "long";

      let isSourceDocumentDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "source-document-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "bibliography" }
          >["isSourceDocumentDisplayed"]
        | null;
      isSourceDocumentDisplayed ??= true;

      properties = {
        component: "bibliography",
        linkUuids: itemLinks
          .map((link) => link.uuid)
          .filter((uuid) => uuid !== null),
        bibliographies: bibliographyLink?.bibliographies ?? [],
        layout,
        isSourceDocumentDisplayed,
      };
      break;
    }
    case "button": {
      let variant = getPropertyValueByLabel(
        componentProperty.properties,
        "variant",
      ) as
        | Extract<WebElementComponent, { component: "button" }>["variant"]
        | null;
      variant ??= "default";

      let isExternal = false;
      const navigateToProperty = getPropertyByLabel(
        componentProperty.properties,
        "navigate-to",
      );

      let href =
        navigateToProperty?.values[0]?.href ??
        navigateToProperty?.values[0]?.slug ??
        null;

      if (href === null) {
        const linkToProperty = getPropertyByLabel(
          componentProperty.properties,
          "link-to",
        );
        href =
          linkToProperty?.values[0]?.href ??
          linkToProperty?.values[0]?.slug ??
          null;

        if (href === null) {
          throw new Error(
            `Properties “navigate-to” or “link-to” not found for the following component: “${componentName}”`,
          );
        } else {
          isExternal = true;
        }
      }

      let startIcon = getPropertyValueByLabel(
        componentProperty.properties,
        "start-icon",
      ) as
        | Extract<WebElementComponent, { component: "button" }>["startIcon"]
        | null;
      startIcon ??= null;

      let endIcon = getPropertyValueByLabel(
        componentProperty.properties,
        "end-icon",
      ) as
        | Extract<WebElementComponent, { component: "button" }>["endIcon"]
        | null;
      endIcon ??= null;

      let image: WebImage | null = null;
      const imageLink = links.find(
        (link) => link.type === "image" || link.type === "IIIF",
      );
      if (imageLink != null) {
        image = {
          uuid: imageLink.uuid,
          label: imageLink.identification?.label ?? null,
          width: imageLink.image?.width ?? 0,
          height: imageLink.image?.height ?? 0,
          description: imageLink.description ?? null,
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
            parseDocument(elementResource.document.content)
          : null,
        startIcon,
        endIcon,
        image,
      };

      break;
    }
    case "collection": {
      const setLinks = links.filter((link) => link.category === "set");
      if (setLinks.every((link) => link.uuid === null)) {
        throw new Error(
          `Set links not found for the following component: “${componentName}”`,
        );
      }

      const displayedProperties = getPropertyByLabel(
        componentProperty.properties,
        "use-property",
      );

      let variant = getPropertyValueByLabel(
        componentProperty.properties,
        "variant",
      ) as
        | Extract<WebElementComponent, { component: "collection" }>["variant"]
        | null;
      variant ??= "full";

      let itemVariant = getPropertyValueByLabel(
        componentProperty.properties,
        "item-variant",
      ) as
        | Extract<
            WebElementComponent,
            { component: "collection" }
          >["itemVariant"]
        | null;
      itemVariant ??= "detailed";

      let paginationVariant = getPropertyValueByLabel(
        componentProperty.properties,
        "pagination-variant",
      ) as
        | Extract<
            WebElementComponent,
            { component: "collection" }
          >["paginationVariant"]
        | null;
      paginationVariant ??= "default";

      let imageQuality = getPropertyValueByLabel(
        componentProperty.properties,
        "image-quality",
      ) as
        | Extract<
            WebElementComponent,
            { component: "collection" }
          >["imageQuality"]
        | null;
      imageQuality ??= "low";

      let isUsingQueryParams = getPropertyValueByLabel(
        componentProperty.properties,
        "is-using-query-params",
      ) as
        | Extract<
            WebElementComponent,
            { component: "collection" }
          >["isUsingQueryParams"]
        | null;
      isUsingQueryParams ??= false;

      let isFilterResultsBarDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "filter-results-bar-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "collection" }
          >["filter"]["isResultsBarDisplayed"]
        | null;
      isFilterResultsBarDisplayed ??= false;

      let isFilterMapDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "filter-map-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "collection" }
          >["filter"]["isMapDisplayed"]
        | null;
      isFilterMapDisplayed ??= false;

      let isFilterInputDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "filter-input-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "collection" }
          >["filter"]["isInputDisplayed"]
        | null;
      isFilterInputDisplayed ??= false;

      let isFilterLimitedToTitleQuery = getPropertyValueByLabel(
        componentProperty.properties,
        "filter-limit-to-title-query",
      ) as
        | Extract<
            WebElementComponent,
            { component: "collection" }
          >["filter"]["isLimitedToTitleQuery"]
        | null;
      isFilterLimitedToTitleQuery ??= false;

      let isFilterLimitedToLeafPropertyValues = getPropertyValueByLabel(
        componentProperty.properties,
        "filter-limit-to-leaf-property-values",
      ) as
        | Extract<
            WebElementComponent,
            { component: "collection" }
          >["filter"]["isLimitedToLeafPropertyValues"]
        | null;
      isFilterLimitedToLeafPropertyValues ??= false;

      let isSortDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "sort-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "collection" }
          >["isSortDisplayed"]
        | null;
      isSortDisplayed ??= false;

      let isFilterSidebarDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "filter-sidebar-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "collection" }
          >["filter"]["isSidebarDisplayed"]
        | null;
      isFilterSidebarDisplayed ??= false;

      let filterSidebarSort = getPropertyValueByLabel(
        componentProperty.properties,
        "filter-sidebar-sort",
      ) as
        | Extract<
            WebElementComponent,
            { component: "collection" }
          >["filter"]["sidebarSort"]
        | null;
      filterSidebarSort ??= "default";

      let layout = getPropertyValueByLabel(
        componentProperty.properties,
        "layout",
      ) as
        | Extract<WebElementComponent, { component: "collection" }>["layout"]
        | null;
      layout ??= "image-start";

      const options: Extract<
        WebElementComponent,
        { component: "collection" }
      >["options"] = {
        attributeFilters: {
          bibliographies: elementResource.options?.filterBibliography ?? false,
          periods: elementResource.options?.filterPeriods ?? false,
        },
        scopes:
          elementResource.options?.scopes != null ?
            ensureArray(elementResource.options.scopes.scope).map((scope) => ({
              uuid: scope.uuid.content,
              type: scope.uuid.type,
              identification: parseIdentification(scope.identification),
            }))
          : null,
        contexts: null,
        labels: { title: null },
      };

      if ("options" in elementResource && elementResource.options) {
        options.contexts = parseAllOptionContexts(elementResource.options);

        if (
          "notes" in elementResource.options &&
          elementResource.options.notes
        ) {
          const labelNotes = parseNotes(
            ensureArray(elementResource.options.notes.note),
          );
          options.labels.title =
            labelNotes.find((note) => note.title === "Title label")?.content ??
            null;
        }
      }

      properties = {
        component: "collection",
        linkUuids: setLinks
          .map((link) => link.uuid)
          .filter((uuid) => uuid !== null),
        displayedProperties:
          displayedProperties?.values
            .filter(({ uuid }) => uuid !== null)
            .map((value) => ({
              uuid: value.uuid!,
              label: value.content?.toString() ?? "",
            })) ?? null,
        variant,
        itemVariant,
        paginationVariant,
        layout,
        imageQuality,
        isUsingQueryParams,
        isSortDisplayed,
        filter: {
          isSidebarDisplayed: isFilterSidebarDisplayed,
          isResultsBarDisplayed: isFilterResultsBarDisplayed,
          isMapDisplayed: isFilterMapDisplayed,
          isInputDisplayed: isFilterInputDisplayed,
          isLimitedToTitleQuery: isFilterLimitedToTitleQuery,
          isLimitedToLeafPropertyValues: isFilterLimitedToLeafPropertyValues,
          sidebarSort: filterSidebarSort,
        },
        options,
      };
      break;
    }
    case "empty-space": {
      const height = getPropertyValueByLabel(
        componentProperty.properties,
        "height",
      ) as string | number | null;
      const width = getPropertyValueByLabel(
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
      const entriesLink = links.find(
        (link) => link.category === "tree" || link.category === "set",
      );
      if (entriesLink?.uuid == null) {
        throw new Error(
          `Entries link not found for the following component: “${componentName}”`,
        );
      }

      let variant = getPropertyValueByLabel(
        componentProperty.properties,
        "variant",
      ) as
        | Extract<WebElementComponent, { component: "entries" }>["variant"]
        | null;
      variant ??= "entry";

      let isFilterInputDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "filter-input-displayed",
      ) as
        | Extract<
            WebElementComponent,
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
      const href = links.find((link) => link.type === "webpage")?.href as
        | string
        | null;
      if (!href) {
        throw new Error(
          `URL not found for the following component: “${componentName}”`,
        );
      }

      const height = getPropertyValueByLabel(
        componentProperty.properties,
        "height",
      );
      const width = getPropertyValueByLabel(
        componentProperty.properties,
        "width",
      );

      properties = {
        component: "iframe",
        href,
        height: height?.toString() ?? null,
        width: width?.toString() ?? null,
      };
      break;
    }
    case "iiif-viewer": {
      const manifestLink = links.find((link) => link.type === "IIIF");
      if (manifestLink?.uuid == null) {
        throw new Error(
          `Manifest link not found for the following component: “${componentName}”`,
        );
      }

      let variant = getPropertyValueByLabel(
        componentProperty.properties,
        "variant",
      ) as
        | Extract<WebElementComponent, { component: "iiif-viewer" }>["variant"]
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
      if (links.length === 0) {
        throw new Error(
          `No links found for the following component: “${componentName}”`,
        );
      }

      let imageQuality = getPropertyValueByLabel(
        componentProperty.properties,
        "image-quality",
      ) as
        | Extract<WebElementComponent, { component: "image" }>["imageQuality"]
        | null;
      imageQuality ??= "high";

      const images: Array<WebImage> = [];
      for (const link of links) {
        if (link.uuid === null) {
          continue;
        }

        images.push({
          uuid: link.uuid,
          label: link.identification?.label ?? null,
          width: link.image?.width ?? 0,
          height: link.image?.height ?? 0,
          description: link.description ?? null,
          quality: imageQuality,
        });
      }

      let variant = getPropertyValueByLabel(
        componentProperty.properties,
        "variant",
      ) as
        | Extract<WebElementComponent, { component: "image" }>["variant"]
        | null;
      variant ??= "default";

      let captionLayout = getPropertyValueByLabel(
        componentProperty.properties,
        "layout-caption",
      ) as
        | Extract<WebElementComponent, { component: "image" }>["captionLayout"]
        | null;
      captionLayout ??= "bottom";

      let width: number | null = null;
      const widthProperty = getPropertyValueByLabel(
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
      const heightProperty = getPropertyValueByLabel(
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

      let isFullWidth = getPropertyValueByLabel(
        componentProperty.properties,
        "is-full-width",
      ) as
        | Extract<WebElementComponent, { component: "image" }>["isFullWidth"]
        | null;
      isFullWidth ??= true;

      let isFullHeight = getPropertyValueByLabel(
        componentProperty.properties,
        "is-full-height",
      ) as
        | Extract<WebElementComponent, { component: "image" }>["isFullHeight"]
        | null;
      isFullHeight ??= true;

      let captionSource = getPropertyValueByLabel(
        componentProperty.properties,
        "source-caption",
      ) as
        | Extract<WebElementComponent, { component: "image" }>["captionSource"]
        | null;
      captionSource ??= "name";

      let altTextSource = getPropertyValueByLabel(
        componentProperty.properties,
        "alt-text-source",
      ) as
        | Extract<WebElementComponent, { component: "image" }>["altTextSource"]
        | null;
      altTextSource ??= "name";

      let isTransparentBackground = getPropertyValueByLabel(
        componentProperty.properties,
        "is-transparent",
      ) as
        | Extract<
            WebElementComponent,
            { component: "image" }
          >["isTransparentBackground"]
        | null;
      isTransparentBackground ??= false;

      let isCover = getPropertyValueByLabel(
        componentProperty.properties,
        "is-cover",
      ) as
        | Extract<WebElementComponent, { component: "image" }>["isCover"]
        | null;
      isCover ??= false;

      const variantProperty = getPropertyByLabel(
        componentProperty.properties,
        "variant",
      );

      let carouselOptions:
        | Extract<
            WebElementComponent,
            { component: "image" }
          >["carouselOptions"]
        | null = null;
      if (images.length > 1) {
        let secondsPerImage = 5;

        if (variantProperty?.values[0]!.content === "carousel") {
          const secondsPerImageProperty = getPropertyValueByLabel(
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
        WebElementComponent,
        { component: "image" }
      >["heroOptions"] = null;
      if (variantProperty?.values[0]!.content === "hero") {
        let isBackgroundImageDisplayed = getPropertyValueByLabel(
          variantProperty.properties,
          "background-image-displayed",
        ) as
          | NonNullable<
              Extract<
                WebElementComponent,
                { component: "image" }
              >["heroOptions"]
            >["isBackgroundImageDisplayed"]
          | null;
        isBackgroundImageDisplayed ??= true;

        let isDocumentDisplayed = getPropertyValueByLabel(
          variantProperty.properties,
          "document-displayed",
        ) as
          | NonNullable<
              Extract<
                WebElementComponent,
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
      const galleryLink = links.find(
        (link) => link.category === "tree" || link.category === "set",
      );
      if (galleryLink?.uuid == null) {
        throw new Error(
          `Image gallery link not found for the following component: “${componentName}”`,
        );
      }

      let isFilterInputDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "filter-input-displayed",
      ) as
        | Extract<
            WebElementComponent,
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
      const mapLink = links.find(
        (link) => link.category === "set" || link.category === "tree",
      );
      if (mapLink?.uuid == null) {
        throw new Error(
          `Map link not found for the following component: “${componentName}”`,
        );
      }

      let isInteractive = getPropertyValueByLabel(
        componentProperty.properties,
        "is-interactive",
      ) as
        | Extract<WebElementComponent, { component: "map" }>["isInteractive"]
        | null;
      isInteractive ??= true;

      let isClustered = getPropertyValueByLabel(
        componentProperty.properties,
        "is-clustered",
      ) as
        | Extract<WebElementComponent, { component: "map" }>["isClustered"]
        | null;
      isClustered ??= false;

      let isUsingPins = getPropertyValueByLabel(
        componentProperty.properties,
        "is-using-pins",
      ) as
        | Extract<WebElementComponent, { component: "map" }>["isUsingPins"]
        | null;
      isUsingPins ??= false;

      let customBasemap = getPropertyValueByLabel(
        componentProperty.properties,
        "custom-basemap",
      ) as
        | Extract<WebElementComponent, { component: "map" }>["customBasemap"]
        | null;
      customBasemap ??= null;

      let initialBounds:
        | Extract<WebElementComponent, { component: "map" }>["initialBounds"]
        | null = null;
      const initialBoundsProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "initial-bounds",
      ) as string | number | null;
      if (initialBoundsProperty !== null) {
        initialBounds = parseBounds(String(initialBoundsProperty));
      }

      let maximumBounds:
        | Extract<WebElementComponent, { component: "map" }>["maximumBounds"]
        | null = null;
      const maximumBoundsProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "maximum-bounds",
      ) as string | number | null;
      if (maximumBoundsProperty !== null) {
        maximumBounds = parseBounds(String(maximumBoundsProperty));
      }

      let isControlsDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "controls-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "map" }
          >["isControlsDisplayed"]
        | null;
      isControlsDisplayed ??= false;

      let isFullHeight = getPropertyValueByLabel(
        componentProperty.properties,
        "is-full-height",
      ) as
        | Extract<WebElementComponent, { component: "map" }>["isFullHeight"]
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
      const setLinks = links.filter((link) => link.category === "set");
      if (setLinks.every((link) => link.uuid === null)) {
        throw new Error(
          `Set links not found for the following component: “${componentName}”`,
        );
      }

      const queries: Array<
        Extract<WebElementComponent, { component: "query" }>["queries"][number]
      > = [];

      if (componentProperty.properties.length === 0) {
        throw new Error(
          `Query properties not found for the following component: “${componentName}”`,
        );
      }

      for (const query of componentProperty.properties) {
        const querySubProperties = query.properties;

        const label = getPropertyValueByLabel(
          querySubProperties,
          "query-prompt",
        ) as
          | Extract<
              WebElementComponent,
              { component: "query" }
            >["queries"][number]["label"]
          | null;
        if (label === null) {
          continue;
        }

        const propertyVariableUuids =
          getPropertyByLabel(querySubProperties, "use-property")
            ?.values.map((value) => value.uuid)
            .filter((uuid) => uuid !== null) ?? [];

        let startIcon = getPropertyValueByLabel(
          querySubProperties,
          "start-icon",
        ) as
          | Extract<
              WebElementComponent,
              { component: "query" }
            >["queries"][number]["startIcon"]
          | null;
        startIcon ??= null;

        let endIcon = getPropertyValueByLabel(
          querySubProperties,
          "end-icon",
        ) as
          | Extract<
              WebElementComponent,
              { component: "query" }
            >["queries"][number]["endIcon"]
          | null;
        endIcon ??= null;

        queries.push({ label, propertyVariableUuids, startIcon, endIcon });
      }

      if (queries.length === 0) {
        throw new Error(
          `No queries found for the following component: “${componentName}”`,
        );
      }

      const displayedProperties = getPropertyByLabel(
        componentProperty.properties,
        "use-property",
      );

      let itemVariant = getPropertyValueByLabel(
        componentProperty.properties,
        "item-variant",
      ) as
        | Extract<WebElementComponent, { component: "query" }>["itemVariant"]
        | null;
      itemVariant ??= "detailed";

      let paginationVariant = getPropertyValueByLabel(
        componentProperty.properties,
        "pagination-variant",
      ) as
        | Extract<
            WebElementComponent,
            { component: "query" }
          >["paginationVariant"]
        | null;
      paginationVariant ??= "default";

      let layout = getPropertyValueByLabel(
        componentProperty.properties,
        "layout",
      ) as
        | Extract<WebElementComponent, { component: "query" }>["layout"]
        | null;
      layout ??= "image-start";

      properties = {
        component: "query",
        linkUuids: setLinks
          .map((link) => link.uuid)
          .filter((uuid) => uuid !== null),
        queries,
        displayedProperties:
          displayedProperties?.values
            .filter((value) => value.uuid !== null)
            .map((value) => ({
              uuid: value.uuid!,
              label: value.content?.toString() ?? "",
            })) ?? null,
        itemVariant,
        paginationVariant,
        layout,
      };
      break;
    }
    case "table": {
      const tableLink = links.find((link) => link.category === "set");
      if (tableLink?.uuid == null) {
        throw new Error(
          `Table link not found for the following component: “${componentName}”`,
        );
      }

      properties = { component: "table", linkUuid: tableLink.uuid };
      break;
    }
    case "search-bar": {
      let queryVariant:
        | Extract<
            WebElementComponent,
            { component: "search-bar" }
          >["queryVariant"]
        | null = null;
      queryVariant = getPropertyValueByLabel(
        componentProperty.properties,
        "query-variant",
      ) as
        | Extract<
            WebElementComponent,
            { component: "search-bar" }
          >["queryVariant"]
        | null;
      queryVariant ??= "submit";

      const boundElementUuid =
        getPropertyByLabel(componentProperty.properties, "bound-element")
          ?.values[0]?.uuid ?? null;

      const linkToProperty = getPropertyByLabel(
        componentProperty.properties,
        "link-to",
      );
      const href =
        linkToProperty?.values[0]?.href ??
        linkToProperty?.values[0]?.slug ??
        null;

      if (!boundElementUuid && !href) {
        throw new Error(
          `Bound element or href not found for the following component: “${componentName}”`,
        );
      }

      let placeholder = getPropertyValueByLabel(
        componentProperty.properties,
        "placeholder-text",
      ) as
        | Extract<
            WebElementComponent,
            { component: "search-bar" }
          >["placeholder"]
        | null;
      placeholder ??= null;

      let baseFilterQueries = getPropertyValueByLabel(
        componentProperty.properties,
        "base-filter-queries",
      ) as
        | Extract<
            WebElementComponent,
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
          parseDocument(elementResource.document.content as OchreStringRichText)
        : null;
      if (!content) {
        throw new Error(
          `Content not found for the following component: “${componentName}”`,
        );
      }

      let variantName: Extract<
        WebElementComponent,
        { component: "text" }
      >["variant"]["name"] = "block";
      let variant: Extract<
        WebElementComponent,
        { component: "text" }
      >["variant"];

      const variantProperty = getPropertyByLabel(
        componentProperty.properties,
        "variant",
      );
      if (variantProperty !== null) {
        variantName = variantProperty.values[0]!.content as Extract<
          WebElementComponent,
          { component: "text" }
        >["variant"]["name"];

        if (
          variantName === "paragraph" ||
          variantName === "label" ||
          variantName === "heading" ||
          variantName === "display"
        ) {
          let size = getPropertyValueByLabel(
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

      let headingLevel = getPropertyValueByLabel(
        componentProperty.properties,
        "heading-level",
      ) as
        | Extract<WebElementComponent, { component: "text" }>["headingLevel"]
        | null;
      headingLevel ??= null;

      properties = { component: "text", variant, headingLevel, content };
      break;
    }
    case "timeline": {
      const timelineLink = links.find((link) => link.category === "tree");
      if (timelineLink?.uuid == null) {
        throw new Error(
          `Timeline link not found for the following component: “${componentName}”`,
        );
      }

      properties = { component: "timeline", linkUuid: timelineLink.uuid };
      break;
    }
    case "video": {
      const videoLink = links.find((link) => link.type === "video");
      if (videoLink?.uuid == null) {
        throw new Error(
          `Video link not found for the following component: “${componentName}”`,
        );
      }

      let isChaptersDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "chapters-displayed",
      ) as
        | Extract<
            WebElementComponent,
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
        `Invalid or non-implemented component name “${unparsedComponentName?.toString() ?? "(unknown)"}” for the following element: “${parseStringContent(
          elementResource.identification.label as OchreStringContent,
        )}”`,
      );
      break;
    }
  }

  if (properties === null) {
    throw new Error(
      `Properties not found for the following component: “${componentName}”`,
    );
  }

  return properties;
}

function parseWebTitle(
  properties: Array<Property>,
  identification: Identification,
  overrides?: Partial<WebTitle["properties"]>,
): WebTitle {
  const title: WebTitle = {
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
    getPropertyByLabelAndValue(properties, "presentation", "title")
      ?.properties ?? [];
  if (titleProperties.length > 0) {
    title.variant =
      (getPropertyValueByLabel(titleProperties, "variant") as
        | WebTitle["variant"]
        | null) ?? "default";

    title.properties.isNameDisplayed =
      (getPropertyValueByLabel(titleProperties, "name-displayed") as
        | WebTitle["properties"]["isNameDisplayed"]
        | null) ?? false;

    title.properties.isDescriptionDisplayed =
      (getPropertyValueByLabel(titleProperties, "description-displayed") as
        | WebTitle["properties"]["isDescriptionDisplayed"]
        | null) ?? false;

    title.properties.isDateDisplayed =
      (getPropertyValueByLabel(titleProperties, "date-displayed") as
        | WebTitle["properties"]["isDateDisplayed"]
        | null) ?? false;

    title.properties.isCreatorsDisplayed =
      (getPropertyValueByLabel(titleProperties, "creators-displayed") as
        | WebTitle["properties"]["isCreatorsDisplayed"]
        | null) ?? false;

    title.properties.isCountDisplayed =
      (getPropertyValueByLabel(titleProperties, "count-displayed") as
        | WebTitle["properties"]["isCountDisplayed"]
        | null) ?? false;
  }

  return title;
}

/**
 * Parses raw web element data into a standardized WebElement structure
 *
 * @param elementResource - Raw element resource data in OCHRE format
 * @returns Parsed WebElement object
 */
function parseWebElement(elementResource: OchreResource): WebElement {
  const identification = parseIdentification(elementResource.identification);

  const elementProperties =
    elementResource.properties?.property ?
      parseProperties(
        Array.isArray(elementResource.properties.property) ?
          elementResource.properties.property
        : [elementResource.properties.property],
      )
    : [];

  const presentationProperty = getPropertyByLabel(
    elementProperties,
    "presentation",
  );
  if (presentationProperty === null) {
    throw new Error(
      `Presentation property not found for element “${identification.label}”`,
    );
  }

  const componentProperty = getPropertyByLabel(
    presentationProperty.properties,
    "component",
  );
  if (componentProperty === null) {
    throw new Error(
      `Component for element “${identification.label}” not found`,
    );
  }

  const properties = parseWebElementProperties(
    componentProperty,
    elementResource,
  );

  const cssStyles = parseResponsiveCssStyles(elementProperties);

  const title = parseWebTitle(elementProperties, identification, {
    isNameDisplayed:
      properties.component === "annotated-image" ||
      properties.component === "annotated-document" ||
      properties.component === "collection",
    isCountDisplayed:
      properties.component === "collection" && properties.variant === "full",
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
const parseWebpageResources = <T extends "element" | "page" | "block">(
  webpageResources: Array<OchreResource>,
  type: T,
): Array<
  T extends "element" ? WebElement
  : T extends "page" ? Webpage
  : WebBlock
> => {
  const returnElements: Array<
    T extends "element" ? WebElement
    : T extends "page" ? Webpage
    : WebBlock
  > = [];

  for (const resource of webpageResources) {
    const resourceProperties =
      resource.properties ?
        parseProperties(ensureArray(resource.properties.property))
      : [];

    const resourceProperty = getPropertyByLabelAndValue(
      resourceProperties,
      "presentation",
      type,
    );
    if (resourceProperty === null) {
      continue;
    }

    switch (type) {
      case "element": {
        const element = parseWebElement(resource);

        returnElements.push(
          element as T extends "element" ? WebElement
          : T extends "page" ? Webpage
          : WebBlock,
        );

        break;
      }
      case "page": {
        const webpage = parseWebpage(resource);
        if (webpage) {
          returnElements.push(
            webpage as T extends "element" ? WebElement
            : T extends "page" ? Webpage
            : WebBlock,
          );
        }

        break;
      }
      case "block": {
        const block = parseWebBlock(resource);
        if (block) {
          returnElements.push(
            block as T extends "element" ? WebElement
            : T extends "page" ? Webpage
            : WebBlock,
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
function parseWebpage(
  webpageResource: OchreResource,
  slugPrefix?: string,
): Webpage | null {
  const webpageProperties =
    webpageResource.properties ?
      parseProperties(ensureArray(webpageResource.properties.property))
    : [];

  if (
    webpageProperties.length === 0 ||
    getPropertyValueByLabel(webpageProperties, "presentation") !== "page"
  ) {
    return null;
  }

  const identification = parseIdentification(webpageResource.identification);

  // TODO: Remove this once OCHRE is updated to allow segment-unique slugs
  const slug = webpageResource.slug?.replace(/^\$[^-]*-/, "") ?? null;

  if (slug == null) {
    throw new Error(`Slug not found for page “${identification.label}”`);
  }

  const returnWebpage: Webpage = {
    uuid: webpageResource.uuid,
    type: "page",
    title: identification.label,
    slug:
      slugPrefix != null ? `${slugPrefix}/${slug}`.replace(/\/$/, "") : slug,
    publicationDateTime: parseOptionalDate(webpageResource.publicationDateTime),
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

  const links =
    webpageResource.links != null ?
      parseLinks(ensureArray(webpageResource.links))
    : [];
  const imageLink = links.find(
    (link) => link.type === "image" || link.type === "IIIF",
  );

  const webpageResources =
    webpageResource.resource != null ?
      ensureArray(webpageResource.resource)
    : [];

  const items: Array<WebSegment | WebElement | WebBlock> = [];
  for (const resource of webpageResources) {
    const resourceProperties =
      resource.properties != null ?
        parseProperties(ensureArray(resource.properties.property))
      : [];

    const resourceType = getPropertyValueByLabel(
      resourceProperties,
      "presentation",
    ) as "segment" | "element" | "block" | null;
    if (resourceType === null) {
      continue;
    }

    switch (resourceType) {
      case "segment": {
        const segment = parseWebSegment(resource);
        if (segment) {
          items.push(segment);
        }
        break;
      }
      case "element": {
        const element = parseWebElement(resource);
        items.push(element);
        break;
      }
      case "block": {
        const block = parseWebBlock(resource);
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
      parseWebpageResources(ensureArray(webpageResource.resource), "page")
    : [];

  const webpageSubProperties =
    getPropertyByLabelAndValue(webpageProperties, "presentation", "page")
      ?.properties ?? [];

  if (webpageSubProperties.length > 0) {
    returnWebpage.properties.isDisplayedInNavbar =
      (getPropertyValueByLabel(webpageSubProperties, "displayed-in-navbar") as
        | Webpage["properties"]["isDisplayedInNavbar"]
        | null) ?? true;

    returnWebpage.properties.width =
      (getPropertyValueByLabel(webpageSubProperties, "width") as
        | Webpage["properties"]["width"]
        | null) ?? "default";

    returnWebpage.properties.variant =
      (getPropertyValueByLabel(webpageSubProperties, "variant") as
        | Webpage["properties"]["variant"]
        | null) ?? "default";

    returnWebpage.properties.isSidebarDisplayed =
      (getPropertyValueByLabel(webpageSubProperties, "sidebar-displayed") as
        | Webpage["properties"]["isSidebarDisplayed"]
        | null) ?? true;

    returnWebpage.properties.isBreadcrumbsDisplayed =
      (getPropertyValueByLabel(
        webpageSubProperties,
        "breadcrumbs-displayed",
      ) as Webpage["properties"]["isBreadcrumbsDisplayed"] | null) ?? false;

    returnWebpage.properties.isNavbarSearchBarDisplayed =
      (getPropertyValueByLabel(
        webpageSubProperties,
        "navbar-search-bar-displayed",
      ) as Webpage["properties"]["isNavbarSearchBarDisplayed"] | null) ?? true;
  }

  if (imageLink?.uuid != null) {
    returnWebpage.properties.backgroundImage = {
      uuid: imageLink.uuid,
      label: imageLink.identification?.label ?? null,
      description: imageLink.description ?? null,
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
function parseWebpages(
  webpageResources: Array<OchreResource>,
  slugPrefix?: string,
): Array<Webpage> {
  const returnPages: Array<Webpage> = [];

  for (const webpageResource of webpageResources) {
    const webpage = parseWebpage(webpageResource, slugPrefix);
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
function parseWebSegment(
  segmentResource: OchreResource,
  slugPrefix?: string,
): WebSegment | null {
  const webpageProperties =
    segmentResource.properties ?
      parseProperties(ensureArray(segmentResource.properties.property))
    : [];

  if (
    webpageProperties.length === 0 ||
    getPropertyValueByLabel(webpageProperties, "presentation") !== "segment"
  ) {
    return null;
  }

  const identification = parseIdentification(segmentResource.identification);

  const slug =
    segmentResource.identification.abbreviation != null ?
      parseFakeStringOrContent(segmentResource.identification.abbreviation)
    : null;
  if (slug == null) {
    throw new Error(`Slug not found for segment “${identification.label}”`);
  }

  const returnSegment: WebSegment = {
    uuid: segmentResource.uuid,
    type: "segment",
    title: identification.label,
    slug,
    publicationDateTime: parseOptionalDate(segmentResource.publicationDateTime),
    items: [],
  };

  const childResources =
    segmentResource.resource ? ensureArray(segmentResource.resource) : [];

  returnSegment.items = parseWebSegmentItems(
    childResources,
    slugPrefix != null ? `${slugPrefix}/${slug}`.replace(/\/$/, "") : slug,
  );

  return returnSegment;
}

/**
 * Parses raw segment resources into an array of WebSegment objects
 *
 * @param segmentResources - Array of raw segment resources in OCHRE format
 * @returns Array of parsed WebSegment objects
 */
function parseSegments(
  segmentResources: Array<OchreResource>,
  slugPrefix?: string,
): Array<WebSegment> {
  const returnSegments: Array<WebSegment> = [];

  for (const segmentResource of segmentResources) {
    const segment = parseWebSegment(segmentResource, slugPrefix);
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
function parseWebSegmentItem(
  segmentItemResource: OchreResource,
  slugPrefix?: string,
): WebSegmentItem | null {
  const webpageProperties =
    segmentItemResource.properties ?
      parseProperties(ensureArray(segmentItemResource.properties.property))
    : [];

  if (
    webpageProperties.length === 0 ||
    getPropertyValueByLabel(webpageProperties, "presentation") !==
      "segment-item"
  ) {
    return null;
  }

  const identification = parseIdentification(
    segmentItemResource.identification,
  );

  const slug =
    segmentItemResource.identification.abbreviation != null ?
      parseFakeStringOrContent(segmentItemResource.identification.abbreviation)
    : null;
  if (slug == null) {
    throw new Error(
      `Slug not found for segment item “${identification.label}”`,
    );
  }

  const returnSegmentItem: WebSegmentItem = {
    uuid: segmentItemResource.uuid,
    type: "segment-item",
    title: identification.label,
    slug,
    publicationDateTime: parseOptionalDate(
      segmentItemResource.publicationDateTime,
    ),
    items: [],
  };

  const resources =
    segmentItemResource.resource ?
      ensureArray(segmentItemResource.resource)
    : [];

  returnSegmentItem.items.push(
    ...parseWebpages(
      resources,
      slugPrefix != null ? `${slugPrefix}/${slug}`.replace(/\/$/, "") : slug,
    ),
    ...parseSegments(
      resources,
      slugPrefix != null ? `${slugPrefix}/${slug}`.replace(/\/$/, "") : slug,
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
function parseWebSegmentItems(
  segmentItems: Array<OchreResource>,
  slugPrefix?: string,
): Array<WebSegmentItem> {
  const returnItems: Array<WebSegmentItem> = [];

  for (const segmentItem of segmentItems) {
    const segmentItemParsed = parseWebSegmentItem(segmentItem, slugPrefix);
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
function parseSidebar(
  resources: Array<OchreResource>,
): Website["properties"]["sidebar"] | null {
  let returnSidebar: Website["properties"]["sidebar"] | null = null;

  const items: NonNullable<Website["properties"]["sidebar"]>["items"] = [];
  const title: WebTitle = {
    label: "",
    variant: "default",
    properties: {
      isNameDisplayed: false,
      isDescriptionDisplayed: false,
      isDateDisplayed: false,
      isCreatorsDisplayed: false,
      isCountDisplayed: false,
    },
  };
  let layout: "start" | "end" = "start";
  let mobileLayout: "default" | "inline" = "default";
  const cssStyles: NonNullable<Website["properties"]["sidebar"]>["cssStyles"] =
    { default: [], tablet: [], mobile: [] };

  const sidebarResource = resources.find((resource) => {
    const resourceProperties =
      resource.properties ?
        parseProperties(ensureArray(resource.properties.property))
      : [];

    return (
      getPropertyValueByLabel(resourceProperties, "presentation") ===
        "element" &&
      getPropertyValueByLabel(
        resourceProperties[0]?.properties ?? [],
        "component",
      ) === "sidebar"
    );
  });
  if (sidebarResource != null) {
    title.label = parseFakeStringOrContent(
      sidebarResource.identification.label,
    );

    const sidebarBaseProperties =
      sidebarResource.properties ?
        parseProperties(ensureArray(sidebarResource.properties.property))
      : [];

    const sidebarProperties =
      sidebarBaseProperties
        .find(
          (property) =>
            property.label === "presentation" &&
            property.values[0]?.content === "element",
        )
        ?.properties.find(
          (property) =>
            property.label === "component" &&
            property.values[0]?.content === "sidebar",
        )?.properties ?? [];

    const sidebarLayoutProperty = sidebarProperties.find(
      (property) => property.label === "layout",
    );
    if (sidebarLayoutProperty) {
      layout = sidebarLayoutProperty.values[0]!.content as "start" | "end";
    }

    const sidebarMobileLayoutProperty = sidebarProperties.find(
      (property) => property.label === "layout-mobile",
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

    const titleProperties = sidebarBaseProperties.find(
      (property) =>
        property.label === "presentation" &&
        property.values[0]!.content === "title",
    )?.properties;

    if (titleProperties) {
      const titleVariant = getPropertyValueByLabel(titleProperties, "variant");
      if (titleVariant) {
        title.variant = titleVariant as "default" | "simple";
      }

      title.properties.isNameDisplayed =
        getPropertyValueByLabel(titleProperties, "name-displayed") === true;
      title.properties.isDescriptionDisplayed =
        getPropertyValueByLabel(titleProperties, "description-displayed") ===
        true;
      title.properties.isDateDisplayed =
        getPropertyValueByLabel(titleProperties, "date-displayed") === true;
      title.properties.isCreatorsDisplayed =
        getPropertyValueByLabel(titleProperties, "creators-displayed") === true;
      title.properties.isCountDisplayed =
        getPropertyValueByLabel(titleProperties, "count-displayed") === true;
    }

    const sidebarResources =
      sidebarResource.resource ? ensureArray(sidebarResource.resource) : [];

    for (const resource of sidebarResources) {
      const resourceProperties =
        resource.properties ?
          parseProperties(ensureArray(resource.properties.property))
        : [];

      const resourceType = getPropertyValueByLabel(
        resourceProperties,
        "presentation",
      ) as "element" | "block" | null;
      if (resourceType === null) {
        continue;
      }

      switch (resourceType) {
        case "element": {
          const element = parseWebElement(resource);
          items.push(element);
          break;
        }
        case "block": {
          const block = parseWebBlock(resource);
          if (block) {
            items.push(block);
          }
          break;
        }
      }
    }
  }

  if (items.length > 0) {
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
function parseWebElementForAccordion(
  elementResource: OchreResource,
): Extract<WebElement, { component: "text" }> & {
  items: Array<WebElement | WebBlock>;
} {
  const textElement = parseWebElement(elementResource) as Extract<
    WebElement,
    { component: "text" }
  >;

  const childResources =
    elementResource.resource ? ensureArray(elementResource.resource) : [];

  const items: Array<WebElement | WebBlock> = [];
  for (const resource of childResources) {
    const resourceProperties =
      resource.properties ?
        parseProperties(ensureArray(resource.properties.property))
      : [];

    const resourceType = getPropertyValueByLabel(
      resourceProperties,
      "presentation",
    ) as "element" | "block" | null;
    if (resourceType === null) {
      continue;
    }

    switch (resourceType) {
      case "element": {
        const element = parseWebElement(resource);
        items.push(element);
        break;
      }
      case "block": {
        const block = parseWebBlock(resource);
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
function parseWebBlock(blockResource: OchreResource): WebBlock | null {
  const blockProperties =
    blockResource.properties ?
      parseProperties(ensureArray(blockResource.properties.property))
    : [];

  const returnBlock: WebBlock = {
    uuid: blockResource.uuid,
    type: "block",
    title: parseWebTitle(
      blockProperties,
      parseIdentification(blockResource.identification),
    ),
    items: [],
    properties: {
      default: { layout: "vertical", spacing: null, gap: null },
      mobile: null,
      tablet: null,
    } as WebBlock["properties"],
    cssStyles: { default: [], tablet: [], mobile: [] },
  };

  const blockMainProperties =
    getPropertyByLabelAndValue(blockProperties, "presentation", "block")
      ?.properties ?? [];
  if (blockMainProperties.length > 0) {
    returnBlock.properties.default.layout =
      (getPropertyValueByLabel(blockMainProperties, "layout") as
        | WebBlock["properties"]["default"]["layout"]
        | null) ?? "vertical";

    if (returnBlock.properties.default.layout === "accordion") {
      returnBlock.properties.default.isAccordionEnabled =
        (getPropertyValueByLabel(blockMainProperties, "accordion-enabled") as
          | WebBlock["properties"]["default"]["isAccordionEnabled"]
          | null) ?? true;

      returnBlock.properties.default.isAccordionExpandedByDefault =
        (getPropertyValueByLabel(blockMainProperties, "accordion-expanded") as
          | WebBlock["properties"]["default"]["isAccordionExpandedByDefault"]
          | null) ?? true;

      returnBlock.properties.default.isAccordionSidebarDisplayed =
        (getPropertyValueByLabel(
          blockMainProperties,
          "accordion-sidebar-displayed",
        ) as
          | WebBlock["properties"]["default"]["isAccordionSidebarDisplayed"]
          | null) ?? false;
    }

    returnBlock.properties.default.spacing =
      (getPropertyValueByLabel(blockMainProperties, "spacing") as
        | WebBlock["properties"]["default"]["spacing"]
        | null) ?? null;

    returnBlock.properties.default.gap =
      (getPropertyValueByLabel(blockMainProperties, "gap") as
        | WebBlock["properties"]["default"]["gap"]
        | null) ?? null;

    const tabletOverwriteProperty = getPropertyByLabel(
      blockMainProperties,
      "overwrite-tablet",
    );
    if (tabletOverwriteProperty !== null) {
      const tabletOverwriteProperties = tabletOverwriteProperty.properties;

      const propertiesTablet: NonNullable<WebBlock["properties"]["tablet"]> = {
        layout:
          (getPropertyValueByLabel(tabletOverwriteProperties, "layout") as
            | NonNullable<WebBlock["properties"]["tablet"]>["layout"]
            | null) ?? undefined,
        spacing:
          (getPropertyValueByLabel(tabletOverwriteProperties, "spacing") as
            | NonNullable<WebBlock["properties"]["tablet"]>["spacing"]
            | null) ?? undefined,
        gap:
          (getPropertyValueByLabel(tabletOverwriteProperties, "gap") as
            | NonNullable<WebBlock["properties"]["tablet"]>["gap"]
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
          (getPropertyValueByLabel(
            tabletOverwriteProperties,
            "accordion-enabled",
          ) as
            | NonNullable<
                WebBlock["properties"]["tablet"]
              >["isAccordionEnabled"]
            | null) ?? undefined;

        propertiesTablet.isAccordionExpandedByDefault =
          (getPropertyValueByLabel(
            tabletOverwriteProperties,
            "accordion-expanded",
          ) as
            | NonNullable<
                WebBlock["properties"]["tablet"]
              >["isAccordionExpandedByDefault"]
            | null) ?? undefined;

        propertiesTablet.isAccordionSidebarDisplayed =
          (getPropertyValueByLabel(
            tabletOverwriteProperties,
            "accordion-sidebar-displayed",
          ) as
            | NonNullable<
                WebBlock["properties"]["tablet"]
              >["isAccordionSidebarDisplayed"]
            | null) ?? undefined;
      }

      const cleanedPropertiesTablet = cleanObject(propertiesTablet);

      if (Object.keys(cleanedPropertiesTablet).length > 0) {
        returnBlock.properties.tablet = cleanedPropertiesTablet;
      }
    }

    const mobileOverwriteProperty = getPropertyByLabel(
      blockMainProperties,
      "overwrite-mobile",
    );
    if (mobileOverwriteProperty !== null) {
      const mobileOverwriteProperties = mobileOverwriteProperty.properties;

      const propertiesMobile: NonNullable<WebBlock["properties"]["mobile"]> = {
        layout:
          (getPropertyValueByLabel(mobileOverwriteProperties, "layout") as
            | NonNullable<WebBlock["properties"]["default"]>["layout"]
            | null) ?? undefined,
        spacing:
          (getPropertyValueByLabel(mobileOverwriteProperties, "spacing") as
            | NonNullable<WebBlock["properties"]["default"]>["spacing"]
            | null) ?? undefined,
        gap:
          (getPropertyValueByLabel(mobileOverwriteProperties, "gap") as
            | NonNullable<WebBlock["properties"]["default"]>["gap"]
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
          (getPropertyValueByLabel(
            mobileOverwriteProperties,
            "accordion-enabled",
          ) as
            | NonNullable<
                WebBlock["properties"]["mobile"]
              >["isAccordionEnabled"]
            | null) ?? undefined;

        propertiesMobile.isAccordionExpandedByDefault =
          (getPropertyValueByLabel(
            mobileOverwriteProperties,
            "accordion-expanded",
          ) as
            | NonNullable<
                WebBlock["properties"]["mobile"]
              >["isAccordionExpandedByDefault"]
            | null) ?? undefined;

        propertiesMobile.isAccordionSidebarDisplayed =
          (getPropertyValueByLabel(
            mobileOverwriteProperties,
            "accordion-sidebar-displayed",
          ) as
            | NonNullable<
                WebBlock["properties"]["mobile"]
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
    blockResource.resource ? ensureArray(blockResource.resource) : [];

  if (returnBlock.properties.default.layout === "accordion") {
    const accordionItems: Array<
      Extract<WebElement, { component: "text" }> & {
        items: Array<WebElement | WebBlock>;
      }
    > = [];

    for (const resource of blockResources) {
      const resourceProperties =
        resource.properties ?
          parseProperties(ensureArray(resource.properties.property))
        : [];

      const resourceType = getPropertyValueByLabel(
        resourceProperties,
        "presentation",
      ) as "element" | "block" | null;

      if (resourceType !== "element") {
        throw new Error(
          `Accordion only accepts elements, but got “${resourceType}” for the following resource: “${parseStringContent(
            resource.identification.label as OchreStringContent,
          )}”`,
        );
      }

      const presentationProperty = getPropertyByLabel(
        resourceProperties,
        "presentation",
      );
      const componentType = getPropertyValueByLabel(
        presentationProperty?.properties ?? [],
        "component",
      ) as string | null;

      if (componentType !== "text") {
        throw new Error(
          `Accordion only accepts text components, but got “${componentType}” for the following resource: “${parseStringContent(
            resource.identification.label as OchreStringContent,
          )}”`,
        );
      }

      const element = parseWebElementForAccordion(resource);
      accordionItems.push(element);
    }

    returnBlock.items = accordionItems;
  } else {
    const blockItems: Array<WebElement | WebBlock> = [];
    for (const resource of blockResources) {
      const resourceProperties =
        resource.properties ?
          parseProperties(ensureArray(resource.properties.property))
        : [];

      const resourceType = getPropertyValueByLabel(
        resourceProperties,
        "presentation",
      ) as "element" | "block" | null;
      if (resourceType === null) {
        continue;
      }

      switch (resourceType) {
        case "element": {
          const element = parseWebElement(resource);
          blockItems.push(element);
          break;
        }
        case "block": {
          const block = parseWebBlock(resource);
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
function parseWebsiteProperties(
  properties: Array<OchreProperty>,
  websiteTree: OchreTree,
  sidebar: Website["properties"]["sidebar"] | null,
): Website["properties"] {
  const mainProperties = parseProperties(properties);
  const websiteProperties =
    getPropertyByLabel(mainProperties, "presentation")?.properties ?? [];

  let type = getPropertyValueByLabel(websiteProperties, "webUI") as
    | Website["properties"]["type"]
    | null;
  type ??= "traditional";

  let status = getPropertyValueByLabel(websiteProperties, "status") as
    | Website["properties"]["status"]
    | null;
  status ??= "development";

  let privacy = getPropertyValueByLabel(websiteProperties, "privacy") as
    | Website["properties"]["privacy"]
    | null;
  privacy ??= "public";

  const returnProperties: Website["properties"] = {
    type,
    status,
    privacy,
    contact: null,
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
    footer: { isDisplayed: true, items: null },
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
      iiifViewer: "universal-viewer",
    },
    options: { contexts: null, scopes: null, labels: { title: null } },
  };

  const contactProperty = getPropertyByLabel(websiteProperties, "contact");
  if (contactProperty !== null) {
    const contactContent = contactProperty.values[0]?.content
      ?.toString()
      .split(";");
    if (contactContent?.length === 2) {
      returnProperties.contact = {
        name: contactContent[0]!,
        email: contactContent[1] ?? null,
      };
    } else {
      throw new Error(
        `Contact property must be in the format “name;email”, but got “${contactProperty.values[0]?.content}”`,
      );
    }
  }

  returnProperties.theme.isThemeToggleDisplayed =
    (getPropertyValueByLabel(websiteProperties, "supports-theme-toggle") as
      | Website["properties"]["theme"]["isThemeToggleDisplayed"]
      | null) ?? true;

  returnProperties.theme.defaultTheme =
    (getPropertyValueByLabel(websiteProperties, "default-theme") as
      | Website["properties"]["theme"]["defaultTheme"]
      | null) ?? "system";

  returnProperties.icon.logoUuid =
    getPropertyByLabel(websiteProperties, "logo")?.values[0]?.uuid ?? null;

  returnProperties.icon.faviconUuid =
    getPropertyByLabel(websiteProperties, "favicon-ico")?.values[0]?.uuid ??
    null;

  returnProperties.icon.appleTouchIconUuid =
    getPropertyByLabel(websiteProperties, "favicon-img")?.values[0]?.uuid ??
    null;

  returnProperties.navbar.isDisplayed =
    (getPropertyValueByLabel(websiteProperties, "navbar-displayed") as
      | Website["properties"]["navbar"]["isDisplayed"]
      | null) ?? true;

  returnProperties.navbar.variant =
    (getPropertyValueByLabel(websiteProperties, "navbar-variant") as
      | Website["properties"]["navbar"]["variant"]
      | null) ?? "default";

  returnProperties.navbar.alignment =
    (getPropertyValueByLabel(websiteProperties, "navbar-alignment") as
      | Website["properties"]["navbar"]["alignment"]
      | null) ?? "start";

  returnProperties.navbar.isProjectDisplayed =
    (getPropertyValueByLabel(websiteProperties, "navbar-project-displayed") as
      | Website["properties"]["navbar"]["isProjectDisplayed"]
      | null) ?? true;

  returnProperties.navbar.searchBarBoundElementUuid =
    getPropertyByLabel(websiteProperties, "bound-element-navbar-search-bar")
      ?.values[0]?.uuid ?? null;

  returnProperties.footer.isDisplayed =
    (getPropertyValueByLabel(websiteProperties, "footer-displayed") as
      | Website["properties"]["footer"]["isDisplayed"]
      | null) ?? true;

  const itemPageTypeProperty = getPropertyByLabelAndValue(
    websiteProperties,
    "page-type",
    "item-page",
  );
  if (itemPageTypeProperty !== null) {
    returnProperties.itemPage.isMainContentDisplayed =
      (getPropertyValueByLabel(
        itemPageTypeProperty.properties,
        "item-page-main-content-displayed",
      ) as
        | Website["properties"]["itemPage"]["isMainContentDisplayed"]
        | null) ?? true;

    returnProperties.itemPage.isDescriptionDisplayed =
      (getPropertyValueByLabel(
        itemPageTypeProperty.properties,
        "item-page-description-displayed",
      ) as
        | Website["properties"]["itemPage"]["isDescriptionDisplayed"]
        | null) ?? true;

    returnProperties.itemPage.isDocumentDisplayed =
      (getPropertyValueByLabel(
        itemPageTypeProperty.properties,
        "item-page-document-displayed",
      ) as Website["properties"]["itemPage"]["isDocumentDisplayed"] | null) ??
      true;

    returnProperties.itemPage.isNotesDisplayed =
      (getPropertyValueByLabel(
        itemPageTypeProperty.properties,
        "item-page-notes-displayed",
      ) as Website["properties"]["itemPage"]["isNotesDisplayed"] | null) ??
      true;

    returnProperties.itemPage.isEventsDisplayed =
      (getPropertyValueByLabel(
        itemPageTypeProperty.properties,
        "item-page-events-displayed",
      ) as Website["properties"]["itemPage"]["isEventsDisplayed"] | null) ??
      true;

    returnProperties.itemPage.isPeriodsDisplayed =
      (getPropertyValueByLabel(
        itemPageTypeProperty.properties,
        "item-page-periods-displayed",
      ) as Website["properties"]["itemPage"]["isPeriodsDisplayed"] | null) ??
      true;

    returnProperties.itemPage.isPropertiesDisplayed =
      (getPropertyValueByLabel(
        itemPageTypeProperty.properties,
        "item-page-properties-displayed",
      ) as Website["properties"]["itemPage"]["isPropertiesDisplayed"] | null) ??
      true;

    returnProperties.itemPage.isBibliographyDisplayed =
      (getPropertyValueByLabel(
        itemPageTypeProperty.properties,
        "item-page-bibliography-displayed",
      ) as
        | Website["properties"]["itemPage"]["isBibliographyDisplayed"]
        | null) ?? true;

    returnProperties.itemPage.isPropertyValuesGrouped =
      (getPropertyValueByLabel(
        itemPageTypeProperty.properties,
        "item-page-property-values-grouped",
      ) as
        | Website["properties"]["itemPage"]["isPropertyValuesGrouped"]
        | null) ?? true;

    returnProperties.itemPage.iiifViewer =
      (getPropertyValueByLabel(
        itemPageTypeProperty.properties,
        "item-page-iiif-viewer",
      ) as Website["properties"]["itemPage"]["iiifViewer"] | null) ??
      "universal-viewer";
  }

  if ("options" in websiteTree && websiteTree.options) {
    returnProperties.options.scopes =
      websiteTree.options.scopes != null ?
        ensureArray(websiteTree.options.scopes.scope).map((scope) => ({
          uuid: scope.uuid.content,
          type: scope.uuid.type,
          identification: parseIdentification(scope.identification),
        }))
      : null;

    returnProperties.options.contexts = parseAllOptionContexts(
      websiteTree.options,
    );

    if ("notes" in websiteTree.options && websiteTree.options.notes != null) {
      const labelNotes = parseNotes(
        ensureArray(websiteTree.options.notes.note),
      );

      returnProperties.options.labels.title =
        labelNotes.find((note) => note.title === "Title label")?.content ??
        null;
    }
  }

  return returnProperties;
}

function parseContexts(
  contexts: Array<OchreLevelContext>,
): Array<LevelContext> {
  const contextsParsed: Array<LevelContext> = [];

  for (const mainContext of contexts) {
    for (const contextItemToParse of ensureArray(mainContext.context)) {
      const levelsToParse = ensureArray(contextItemToParse.levels.level);

      let type = "";

      const levels: Array<LevelContextItem> = levelsToParse.map((level) => {
        let variableUuid = "";
        let valueUuid: string | null = null;

        if (typeof level === "string") {
          const splitLevel = level.split(", ");

          variableUuid = splitLevel[0]!;
          valueUuid = splitLevel[1] === "null" ? null : splitLevel[1]!;
        } else {
          const splitLevel = level.content.split(", ");

          type = level.dataType;
          variableUuid = splitLevel[0]!;
          valueUuid = splitLevel[1] === "null" ? null : splitLevel[1]!;
        }

        return { variableUuid, valueUuid };
      });

      contextsParsed.push({
        context: levels,
        type,
        identification: parseIdentification(contextItemToParse.identification),
      });
    }
  }

  return contextsParsed;
}

export function parseWebsite(
  websiteTree: OchreTree,
  metadata: OchreMetadata,
  belongsTo: { uuid: string; abbreviation: string } | null,
  { version = DEFAULT_API_VERSION }: { version?: ApiVersion } = {},
): Website {
  if (!websiteTree.properties) {
    throw new Error("Website properties not found");
  }

  if (
    typeof websiteTree.items === "string" ||
    !("resource" in websiteTree.items)
  ) {
    throw new Error("Website pages not found");
  }

  const resources = ensureArray(websiteTree.items.resource);

  const items = [...parseWebpages(resources), ...parseSegments(resources)];

  const sidebar = parseSidebar(resources);

  const properties = parseWebsiteProperties(
    ensureArray(websiteTree.properties.property),
    websiteTree,
    sidebar,
  );

  return {
    uuid: websiteTree.uuid,
    version,
    belongsTo: belongsTo ?? null,
    metadata: parseMetadata(metadata),
    publicationDateTime: parseOptionalDate(websiteTree.publicationDateTime),
    identification: parseIdentification(websiteTree.identification),
    creators:
      websiteTree.creators ?
        parsePersons(ensureArray(websiteTree.creators.creator))
      : [],
    license: parseLicense(websiteTree.availability),
    items,
    properties,
  };
}
