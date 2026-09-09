import * as v from "valibot";
import type { ParserOptions } from "#/parsers/helpers.js";
import type { WebsitePresentationReader } from "#/parsers/website/reader.js";
import type { WebsitePageSlugs } from "#/parsers/website/slug.js";
import type {
  Identification,
  ItemLinks,
  PropertyValueContent,
  SimplifiedProperty,
} from "#/types/index.js";
import type {
  WebElement,
  WebElementComponent,
  WebImage,
  WebTitle,
} from "#/types/website.js";
import type { XMLWebsiteResource } from "#/xml/types.js";
import { parseStringContent } from "#/parsers/helpers.js";
import {
  parseBibliographyList,
  parseIdentification,
  parseLinks,
  parseSimplifiedProperties,
} from "#/parsers/index.js";
import {
  parseXMLContent,
  transformPermanentIdentificationUrlToItemLink,
} from "#/parsers/string.js";
import { parseBounds } from "#/parsers/website/bounds.js";
import {
  findWebsiteLink,
  findWebsiteLinkByCategories,
  getWebsiteLinks,
  parseWebsiteLinkTarget,
  webImageFromLink,
} from "#/parsers/website/links.js";
import {
  formatComponentError,
  formatXMLWebsiteResourceMetadata,
} from "#/parsers/website/messages.js";
import { parseWebsiteOptions } from "#/parsers/website/options.js";
import { websitePresentationReader } from "#/parsers/website/reader.js";
import { parseResponsiveCssStyles } from "#/parsers/website/styles.js";
import { normalizeWebsiteResources } from "#/parsers/website/walk.js";
import { componentSchema } from "#/schemas.js";

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

  return property.values.flatMap((value) =>
    value.uuid === null ? [] : [{ uuid: value.uuid, label: value.label }],
  );
}

/**
 * What every component parser is handed
 *
 * `pageSlugs` is the only thing the component, element and block parsers read
 * from the enclosing website, so it is passed on its own rather than as part
 * of a wider parse context. That keeps this module reachable from a test with
 * a six-field object instead of a whole OCHRE website envelope.
 */
export type WebElementComponentParameters<T extends ReadonlyArray<string>> = {
  componentProperty: SimplifiedProperty<T>;
  componentReader: WebsitePresentationReader<T>;
  elementResource: XMLWebsiteResource;
  websiteLinks: ItemLinks<T>;
  options: ParserOptions<T>;
  pageSlugs: WebsitePageSlugs | undefined;
};

const THREE_D_VIEWER_COMPONENT_DEFAULTS: Pick<
  Extract<WebElementComponent, { component: "3d-viewer" }>,
  "isInteractive" | "isControlsDisplayed"
> = { isInteractive: true, isControlsDisplayed: true };

function parse3dViewerComponent<T extends ReadonlyArray<string>>(
  parameters: WebElementComponentParameters<T>,
): WebElementComponent<T> {
  const { componentProperty, componentReader, elementResource, websiteLinks } =
    parameters;

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

  const properties = { ...THREE_D_VIEWER_COMPONENT_DEFAULTS };
  componentReader.readAll(properties, {
    isInteractive: "is-interactive",
    isControlsDisplayed: "controls-displayed",
  });
  const { isInteractive, isControlsDisplayed } = properties;

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
    pageSlugs,
  } = parameters;

  const boundElementPropertyUuid = componentReader.uuid("bound-element");
  const href = parseWebsiteLinkTarget(
    componentReader.valueNode("link-to"),
    pageSlugs,
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

const ANNOTATED_IMAGE_COMPONENT_DEFAULTS: Pick<
  Extract<WebElementComponent, { component: "annotated-image" }>,
  | "isFilterInputDisplayed"
  | "isOptionsDisplayed"
  | "isAnnotationHighlightsDisplayed"
  | "isAnnotationTooltipsDisplayed"
> = {
  isFilterInputDisplayed: true,
  isOptionsDisplayed: true,
  isAnnotationHighlightsDisplayed: true,
  isAnnotationTooltipsDisplayed: true,
};

function parseAnnotatedImageComponent<T extends ReadonlyArray<string>>(
  parameters: WebElementComponentParameters<T>,
): WebElementComponent<T> {
  const { componentProperty, componentReader, elementResource, websiteLinks } =
    parameters;

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

  const properties = { ...ANNOTATED_IMAGE_COMPONENT_DEFAULTS };
  componentReader.readAll(properties, {
    isFilterInputDisplayed: "filter-input-displayed",
    isOptionsDisplayed: "options-displayed",
    isAnnotationHighlightsDisplayed: "annotation-highlights-displayed",
    isAnnotationTooltipsDisplayed: "annotation-tooltips-displayed",
  });
  const {
    isFilterInputDisplayed,
    isOptionsDisplayed,
    isAnnotationHighlightsDisplayed,
    isAnnotationTooltipsDisplayed,
  } = properties;

  return {
    component: "annotated-image",
    linkUuid: imageLinks[0]!.uuid,
    isFilterInputDisplayed,
    isOptionsDisplayed,
    isAnnotationHighlightsDisplayed,
    isAnnotationTooltipsDisplayed,
  };
}

const AUDIO_PLAYER_COMPONENT_DEFAULTS: Pick<
  Extract<WebElementComponent, { component: "audio-player" }>,
  | "isSpeedControlsDisplayed"
  | "isVolumeControlsDisplayed"
  | "isSeekBarDisplayed"
> = {
  isSpeedControlsDisplayed: true,
  isVolumeControlsDisplayed: true,
  isSeekBarDisplayed: true,
};

function parseAudioPlayerComponent<T extends ReadonlyArray<string>>(
  parameters: WebElementComponentParameters<T>,
): WebElementComponent<T> {
  const { componentProperty, componentReader, elementResource, websiteLinks } =
    parameters;

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

  const properties = { ...AUDIO_PLAYER_COMPONENT_DEFAULTS };
  componentReader.readAll(properties, {
    isSpeedControlsDisplayed: "speed-controls-displayed",
    isVolumeControlsDisplayed: "volume-controls-displayed",
    isSeekBarDisplayed: "seek-bar-displayed",
  });
  const {
    isSpeedControlsDisplayed,
    isVolumeControlsDisplayed,
    isSeekBarDisplayed,
  } = properties;

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
    pageSlugs,
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
    pageSlugs,
  );

  if (href === null) {
    href = parseWebsiteLinkTarget(
      componentReader.valueNode("link-to"),
      pageSlugs,
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

  const imageLink = findWebsiteLink(
    websiteLinks,
    "resource",
    (link) => link.type === "image" || link.type === "IIIF",
  );
  const image = imageLink == null ? null : webImageFromLink(imageLink, "high");

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

    elements.push(parseWebElement(childResource, options, pageSlugs));
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

const COLLECTION_FILTER_DEFAULTS: Extract<
  WebElementComponent,
  { component: "collection" }
>["filter"] = {
  isResultsBarDisplayed: false,
  isInputDisplayed: false,
  isLimitedToInputFilter: false,
  isLimitedToLeafPropertyValues: false,
  isSidebarDisplayed: false,
  sidebarSort: "default",
  isSidebarHelpTooltipsDisplayed: false,
};

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

  const filter = { ...COLLECTION_FILTER_DEFAULTS };
  componentReader.readAll(filter, {
    isResultsBarDisplayed: "filter-results-bar-displayed",
    isInputDisplayed: "filter-input-displayed",
    isLimitedToInputFilter: "filter-limit-to-input-filter",
    isLimitedToLeafPropertyValues: "filter-limit-to-leaf-property-values",
    isSidebarDisplayed: "filter-sidebar-displayed",
    sidebarSort: "filter-sidebar-sort",
    isSidebarHelpTooltipsDisplayed: "filter-sidebar-help-tooltips-displayed",
  });

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
    filter,
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

/**
 * The defaults an image component falls back to
 *
 * Annotated rather than `as const`, so each field keeps the full union its
 * type allows and the parser can still compare against the other members.
 */
const IMAGE_COMPONENT_DEFAULTS: Pick<
  Extract<WebElementComponent, { component: "image" }>,
  | "imageQuality"
  | "variant"
  | "captionLayout"
  | "isFullWidth"
  | "isFullHeight"
  | "captionSource"
  | "altTextSource"
  | "isTransparentBackground"
  | "isCover"
> = {
  imageQuality: "high",
  variant: "default",
  captionLayout: "bottom",
  isFullWidth: true,
  isFullHeight: true,
  captionSource: "name",
  altTextSource: "name",
  isTransparentBackground: false,
  isCover: false,
};

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

  const properties = { ...IMAGE_COMPONENT_DEFAULTS };
  componentReader.readAll(properties, {
    imageQuality: "image-quality",
    variant: "variant",
    captionLayout: "layout-caption",
    isFullWidth: "is-full-width",
    isFullHeight: "is-full-height",
    captionSource: "source-caption",
    altTextSource: "alt-text-source",
    isTransparentBackground: "is-transparent",
    isCover: "is-cover",
  });
  const {
    imageQuality,
    variant,
    captionLayout,
    isFullWidth,
    isFullHeight,
    captionSource,
    altTextSource,
    isTransparentBackground,
    isCover,
  } = properties;

  const images: Array<WebImage<T>> = Array.from(websiteLinks, (link) =>
    webImageFromLink(link, imageQuality),
  );

  const width = componentReader.stringValue("width");
  const height = componentReader.stringValue("height");
  const variantReader = componentReader.nested("variant");

  let carouselOptions: ImageComponent["carouselOptions"] | null = null;
  if (images.length > 1) {
    const secondsPerImage =
      variant === "carousel"
        ? variantReader.stringValue("seconds-per-image")
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

const MAP_COMPONENT_DEFAULTS: Pick<
  Extract<WebElementComponent, { component: "map" }>,
  | "isInteractive"
  | "isClustered"
  | "isUsingPins"
  | "isControlsDisplayed"
  | "isFullHeight"
> = {
  isInteractive: true,
  isClustered: false,
  isUsingPins: false,
  isControlsDisplayed: false,
  isFullHeight: false,
};

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

  const properties = { ...MAP_COMPONENT_DEFAULTS };
  componentReader.readAll(properties, {
    isInteractive: "is-interactive",
    isClustered: "is-clustered",
    isUsingPins: "is-using-pins",
    isControlsDisplayed: "controls-displayed",
    isFullHeight: "is-full-height",
  });
  const {
    isInteractive,
    isClustered,
    isUsingPins,
    isControlsDisplayed,
    isFullHeight,
  } = properties;

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

    const propertyVariables =
      queryReader
        .property("use-property")
        ?.values.filter((value) => value.uuid !== null) ?? [];

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
    pageSlugs,
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
    pageSlugs,
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
/**
 * The parser for each web element component, keyed by its OCHRE component name
 *
 * Every component parser takes the same {@link WebElementComponentParameters}
 * bag, so this is a table rather than a `switch`: a missing component is a type
 * error here instead of a runtime throw, and each parser can be exercised on
 * its own.
 */
export const WEB_ELEMENT_COMPONENT_PARSERS = {
  "3d-viewer": parse3dViewerComponent,
  "advanced-search": parseAdvancedSearchComponent,
  "annotated-document": parseAnnotatedDocumentComponent,
  "annotated-image": parseAnnotatedImageComponent,
  "audio-player": parseAudioPlayerComponent,
  bibliography: parseBibliographyComponent,
  button: parseButtonComponent,
  collection: parseCollectionComponent,
  "empty-space": parseEmptySpaceComponent,
  entries: parseEntriesComponent,
  iframe: parseIframeComponent,
  "iiif-viewer": parseIiifViewerComponent,
  image: parseImageComponent,
  "image-gallery": parseImageGalleryComponent,
  map: parseMapComponent,
  query: parseQueryComponent,
  table: parseTableComponent,
  "search-bar": parseSearchBarComponent,
  text: parseTextComponent,
  timeline: parseTimelineComponent,
  video: parseVideoComponent,
} as const satisfies Record<
  WebElementComponent["component"],
  <T extends ReadonlyArray<string>>(
    parameters: WebElementComponentParameters<T>,
  ) => WebElementComponent<T>
>;

function parseWebElementProperties<T extends ReadonlyArray<string>>(
  componentProperty: SimplifiedProperty<T>,
  elementResource: XMLWebsiteResource,
  options: ParserOptions<T>,
  pageSlugs: WebsitePageSlugs | undefined,
): WebElementComponent<T> {
  const unparsedComponentName = componentProperty.values[0]!.content;
  const componentNameResult = v.safeParse(
    componentSchema,
    unparsedComponentName,
  );
  const parse = componentNameResult.success
    ? WEB_ELEMENT_COMPONENT_PARSERS[componentNameResult.output]
    : undefined;

  if (parse == null) {
    throw new Error(
      `Invalid or non-implemented component name \u{201C}${unparsedComponentName.toString()}\u{201D} for the following element: \u{201C}${parseStringContent(
        elementResource.identification.label,
        options,
      )}\u{201D}`,
    );
  }

  return parse({
    componentProperty,
    componentReader: websitePresentationReader(componentProperty.properties),
    elementResource,
    websiteLinks: parseLinks(elementResource.links, options),
    options,
    pageSlugs,
  });
}

export function parseWebTitle<T extends ReadonlyArray<string>>(
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
    titleReader.readAll(title, { variant: "variant" });
    titleReader.readAll(title.properties, {
      isNameDisplayed: "name-displayed",
      isDescriptionDisplayed: "description-displayed",
      isDateDisplayed: "date-displayed",
      isCreatorsDisplayed: "creators-displayed",
      isCountDisplayed: "count-displayed",
    });
  }

  return title;
}

/**
 * Parses raw web element data into a standardized WebElement structure
 *
 * @param elementResource - Raw element resource data in OCHRE format
 * @returns Parsed WebElement object
 */
export function parseWebElement<T extends ReadonlyArray<string>>(
  elementResource: XMLWebsiteResource,
  options: ParserOptions<T>,
  pageSlugs: WebsitePageSlugs | undefined,
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
    pageSlugs,
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
