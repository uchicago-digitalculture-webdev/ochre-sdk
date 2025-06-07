import type {
  FakeString,
  OchreProperty,
  OchreResource,
  OchreStringContent,
  OchreTree,
} from "../../types/internal.raw.d.ts";
import type { Document, Property } from "../../types/index.js";
import type {
  Style,
  WebBlock,
  WebElement,
  WebElementComponent,
  WebImage,
  Webpage,
  WebSectionSidebarItem,
  Website,
  WebsiteProperties,
} from "../../types/website.js";
import { componentSchema, websiteSchema } from "../../schemas.js";
import {
  getPropertyByLabel,
  getPropertyValueByLabel,
} from "../../utils/getters.js";
import { parseFakeString, parseStringContent } from "../../utils/string.js";
import { fetchItem } from "../db/item.js";
import {
  parseDocument,
  parseIdentification,
  parseLicense,
  parseLinks,
  parseProperties,
} from "./old.js";

/**
 * Parses raw webpage resources into standardized WebElement or Webpage objects
 *
 * @param webpageResources - Array of raw webpage resources in OCHRE format
 * @param type - Type of resource to parse ("element" or "page")
 * @returns Array of parsed WebElement or Webpage objects
 */
const parseWebpageResources = async <T extends "element" | "page" | "block">(
  webpageResources: Array<OchreResource>,
  type: T,
): Promise<
  Array<
    T extends "element" ? WebElement
    : T extends "page" ? Webpage
    : WebBlock
  >
> => {
  const returnElements: Array<
    T extends "element" ? WebElement
    : T extends "page" ? Webpage
    : WebBlock
  > = [];

  for (const resource of webpageResources) {
    const resourceProperties =
      resource.properties ?
        parseProperties(
          Array.isArray(resource.properties.property) ?
            resource.properties.property
          : [resource.properties.property],
        )
      : [];

    const resourceProperty = resourceProperties.find(
      (property) =>
        property.label.name === "presentation" &&
        property.values[0]!.content === type,
    );
    if (!resourceProperty) continue;

    switch (type) {
      case "element": {
        const element = await parseWebElement(resource);

        returnElements.push(
          element as T extends "element" ? WebElement
          : T extends "page" ? Webpage
          : WebBlock,
        );

        break;
      }
      case "page": {
        const webpage = await parsePage(resource);
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
        const block = await parseBlock(resource);
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
 * Parses raw Element properties into individual Element component properties
 *
 * @param componentProperty - Raw component property data in OCHRE format
 * @param elementResource - Raw element resource data in OCHRE format
 * @returns Parsed Element component properties
 */
async function parseElementProperties(
  componentProperty: Property,
  elementResource: OchreResource,
): Promise<WebElementComponent> {
  const componentName = componentSchema.parse(
    componentProperty.values[0]!.content,
  );

  const properties: Record<string, unknown> = { component: componentName };

  const links =
    elementResource.links ?
      parseLinks(
        Array.isArray(elementResource.links) ?
          elementResource.links
        : [elementResource.links],
      )
    : [];
  const imageLinks = links.filter(
    (link) => "type" in link && (link.type === "image" || link.type === "IIIF"),
  );

  let document: Document | null =
    elementResource.document && "content" in elementResource.document ?
      parseDocument(elementResource.document.content)
    : null;
  if (document === null) {
    const documentLink = links.find(
      (link) => "type" in link && link.type === "internalDocument",
    );
    if (documentLink) {
      const { item, error } = await fetchItem(documentLink.uuid, "resource");
      if (error !== null) {
        throw new Error("Failed to fetch OCHRE data");
      }

      document = item.document;
    }
  }

  switch (componentName) {
    case "annotated-document": {
      if (!document) {
        throw new Error(
          `Document not found for the following component: “${componentName}”`,
        );
      }

      properties.document = document;
      break;
    }
    case "annotated-image": {
      if (imageLinks.length === 0) {
        throw new Error(
          `Image link not found for the following component: “${componentName}”`,
        );
      }

      const isSearchable =
        getPropertyValueByLabel(
          componentProperty.properties,
          "is-searchable",
        ) === true;

      properties.imageUuid = imageLinks[0]!.uuid;
      properties.isSearchable = isSearchable;
      break;
    }
    case "bibliography": {
      const bibliographyLink = links.find(
        (link) => link.category === "bibliography",
      );
      if (!bibliographyLink) {
        throw new Error(
          `Bibliography link not found for the following component: “${componentName}”`,
        );
      }

      if (!bibliographyLink.bibliographies) {
        throw new Error(
          `Bibliography not found for the following component: “${componentName}”`,
        );
      }

      let layout = getPropertyValueByLabel(
        componentProperty.properties,
        "layout",
      );
      layout ??= "long";

      properties.bibliographies = bibliographyLink.bibliographies;
      properties.layout = layout;

      break;
    }
    case "button": {
      let variant = getPropertyValueByLabel(
        componentProperty.properties,
        "variant",
      );
      variant ??= "default";

      let isExternal = false;
      let href = getPropertyValueByLabel(
        componentProperty.properties,
        "navigate-to",
      );
      if (href === null) {
        href = getPropertyValueByLabel(componentProperty.properties, "link-to");
        if (href === null) {
          throw new Error(
            `Properties “navigate-to” or “link-to” not found for the following component: “${componentName}”`,
          );
        } else {
          isExternal = true;
        }
      }

      let icon = null;
      const iconProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "icon",
      );
      if (iconProperty !== null) {
        icon = iconProperty;
      }

      properties.variant = variant;
      properties.href = href;
      properties.isExternal = isExternal;
      properties.label =
        (
          ["string", "number", "boolean"].includes(
            typeof elementResource.identification.label,
          )
        ) ?
          parseFakeString(elementResource.identification.label as FakeString)
        : parseStringContent(
            elementResource.identification.label as OchreStringContent,
          );
      properties.icon = icon;
      break;
    }
    case "collection": {
      const collectionLink = links.find((link) => link.category === "set");
      if (!collectionLink) {
        throw new Error(
          `Collection link not found for the following component: “${componentName}”`,
        );
      }

      let variant = getPropertyValueByLabel(
        componentProperty.properties,
        "variant",
      );
      variant ??= "full";

      let itemVariant = getPropertyValueByLabel(
        componentProperty.properties,
        "item-variant",
      );
      itemVariant ??= "default";

      let showCount = false;
      const showCountProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "show-count",
      );
      if (showCountProperty !== null) {
        showCount = showCountProperty === true;
      }

      let isSearchable = false;
      const isSearchableProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "is-searchable",
      );
      if (isSearchableProperty !== null) {
        isSearchable = isSearchableProperty === true;
      }

      let layout = getPropertyValueByLabel(
        componentProperty.properties,
        "layout",
      );
      layout ??= "image-start";

      properties.collectionId = collectionLink.uuid;
      properties.variant = variant;
      properties.itemVariant = itemVariant;
      properties.isSearchable = isSearchable;
      properties.showCount = showCount;
      properties.layout = layout;
      break;
    }
    case "empty-space": {
      const height = getPropertyValueByLabel(
        componentProperty.properties,
        "height",
      );
      const width = getPropertyValueByLabel(
        componentProperty.properties,
        "width",
      );

      properties.height = height;
      properties.width = width;
      break;
    }
    case "entries": {
      const entriesLink = links.find((link) => link.category === "tree");
      if (!entriesLink) {
        throw new Error(
          `Entries link not found for the following component: “${componentName}”`,
        );
      }

      let variant = getPropertyValueByLabel(
        componentProperty.properties,
        "variant",
      ) as "entry" | "item" | null;
      variant ??= "entry";

      let isSearchable = false;
      const isSearchableProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "is-searchable",
      );
      if (isSearchableProperty !== null) {
        isSearchable = isSearchableProperty === true;
      }

      properties.entriesId = entriesLink.uuid;
      properties.variant = variant;
      properties.isSearchable = isSearchable;
      break;
    }
    case "filter-categories": {
      const filterLink = links.find((link) => link.category === "set");
      if (!filterLink) {
        throw new Error(
          `Filter link not found for the following component: “${componentName}”`,
        );
      }

      properties.filterId = filterLink.uuid;
      break;
    }
    case "iframe": {
      const href = links.find(
        (link) => "type" in link && link.type === "webpage",
      )?.href;
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

      properties.href = href;
      properties.height = height;
      properties.width = width;
      break;
    }
    case "iiif-viewer": {
      const manifestLink = links.find(
        (link) => "type" in link && link.type === "IIIF",
      );
      if (!manifestLink) {
        throw new Error(
          `Manifest link not found for the following component: “${componentName}”`,
        );
      }

      properties.IIIFId = manifestLink.uuid;
      break;
    }
    case "image": {
      if (imageLinks.length === 0) {
        throw new Error(
          `Image link not found for the following component: “${componentName}”`,
        );
      }

      const images: Array<WebImage> = [];
      for (const imageLink of imageLinks) {
        images.push({
          url: `https://ochre.lib.uchicago.edu/ochre?uuid=${imageLink.uuid}&load`,
          label: imageLink.identification?.label ?? null,
          width: "image" in imageLink ? (imageLink.image?.width ?? 0) : null,
          height: "image" in imageLink ? (imageLink.image?.height ?? 0) : null,
        });
      }

      let variant = getPropertyValueByLabel(
        componentProperty.properties,
        "variant",
      );
      variant ??= "default";

      let captionLayout = getPropertyValueByLabel(
        componentProperty.properties,
        "layout-caption",
      );
      captionLayout ??= "bottom";

      let width = null;
      const widthProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "width",
      );
      if (widthProperty !== null) {
        if (typeof widthProperty === "number") {
          width = widthProperty;
        } else if (typeof widthProperty === "string") {
          width = Number.parseFloat(widthProperty);
        }
      }

      let height = null;
      const heightProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "height",
      );
      if (heightProperty !== null) {
        if (typeof heightProperty === "number") {
          height = heightProperty;
        } else if (typeof heightProperty === "string") {
          height = Number.parseFloat(heightProperty);
        }
      }

      let isFullWidth = true;
      const isFullWidthProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "is-full-width",
      );
      if (isFullWidthProperty !== null) {
        isFullWidth = isFullWidthProperty === true;
      }

      let isFullHeight = true;
      const isFullHeightProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "is-full-height",
      );
      if (isFullHeightProperty !== null) {
        isFullHeight = isFullHeightProperty === true;
      }

      let imageQuality = getPropertyValueByLabel(
        componentProperty.properties,
        "image-quality",
      );
      imageQuality ??= "high";

      let captionSource = getPropertyValueByLabel(
        componentProperty.properties,
        "caption-source",
      );
      captionSource ??= "name";

      let altTextSource = getPropertyValueByLabel(
        componentProperty.properties,
        "alt-text-source",
      );
      altTextSource ??= "name";

      let isTransparentBackground = false;
      const isTransparentBackgroundProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "is-transparent",
      );
      if (isTransparentBackgroundProperty !== null) {
        isTransparentBackground = isTransparentBackgroundProperty === true;
      }

      let isCover = false;
      const isCoverProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "is-cover",
      );
      if (isCoverProperty !== null) {
        isCover = isCoverProperty === true;
      }

      let carouselOptions: { secondsPerImage: number } | null = null;
      if (images.length > 1) {
        const variantProperty = getPropertyByLabel(
          componentProperty.properties,
          "variant",
        );

        let secondsPerImage = 5;

        if (
          variantProperty &&
          variantProperty.values[0]!.content === "carousel"
        ) {
          const secondsPerImageProperty = getPropertyValueByLabel(
            variantProperty.properties,
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

      properties.images = images;
      properties.variant = variant;
      properties.width = width;
      properties.height = height;
      properties.isFullWidth = isFullWidth;
      properties.isFullHeight = isFullHeight;
      properties.imageQuality = imageQuality;
      properties.captionLayout = captionLayout;
      properties.captionSource = captionSource;
      properties.altTextSource = altTextSource;
      properties.isTransparentBackground = isTransparentBackground;
      properties.isCover = isCover;
      properties.carouselOptions = carouselOptions;
      break;
    }
    case "image-gallery": {
      const galleryLink = links.find(
        (link) => link.category === "tree" || link.category === "set",
      );
      if (!galleryLink) {
        throw new Error(
          `Image gallery link not found for the following component: “${componentName}”`,
        );
      }

      const isSearchable =
        getPropertyValueByLabel(
          componentProperty.properties,
          "is-searchable",
        ) === true;

      properties.galleryId = galleryLink.uuid;
      properties.isSearchable = isSearchable;
      break;
    }
    case "map": {
      const mapLink = links.find(
        (link) => link.category === "set" || link.category === "tree",
      );
      if (!mapLink) {
        throw new Error(
          `Map link not found for the following component: “${componentName}”`,
        );
      }

      let isInteractive = true;
      const isInteractiveProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "is-interactive",
      );
      if (isInteractiveProperty !== null) {
        isInteractive = isInteractiveProperty === true;
      }

      let isClustered = false;
      const isClusteredProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "is-clustered",
      );
      if (isClusteredProperty !== null) {
        isClustered = isClusteredProperty === true;
      }

      let isUsingPins = false;
      const isUsingPinsProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "is-using-pins",
      );
      if (isUsingPinsProperty !== null) {
        isUsingPins = isUsingPinsProperty === true;
      }

      let customBasemap: string | null = null;
      const customBasemapProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "custom-basemap",
      );
      if (customBasemapProperty !== null) {
        customBasemap = customBasemapProperty as string;
      }

      let isControlsDisplayed = false;
      const isControlsDisplayedProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "controls-displayed",
      );
      if (isControlsDisplayedProperty !== null) {
        isControlsDisplayed = isControlsDisplayedProperty === true;
      }

      properties.mapId = mapLink.uuid;
      properties.isInteractive = isInteractive;
      properties.isClustered = isClustered;
      properties.isUsingPins = isUsingPins;
      properties.customBasemap = customBasemap;
      properties.isControlsDisplayed = isControlsDisplayed;
      break;
    }
    case "n-columns": {
      const subElements =
        elementResource.resource ?
          await parseWebpageResources(
            Array.isArray(elementResource.resource) ?
              elementResource.resource
            : [elementResource.resource],
            "element",
          )
        : [];

      properties.columns = subElements;

      break;
    }
    case "n-rows": {
      const subElements =
        elementResource.resource ?
          await parseWebpageResources(
            Array.isArray(elementResource.resource) ?
              elementResource.resource
            : [elementResource.resource],
            "element",
          )
        : [];

      properties.rows = subElements;
      break;
    }
    case "network-graph": {
      // TODO: Implement network graph
      break;
    }
    case "table": {
      const tableLink = links.find((link) => link.category === "set");
      if (!tableLink) {
        throw new Error(
          `Table link not found for the following component: “${componentName}”`,
        );
      }

      properties.tableId = tableLink.uuid;
      break;
    }
    case "search-bar": {
      let variant = getPropertyValueByLabel(
        componentProperty.properties,
        "variant",
      );
      variant ??= "default";

      properties.variant = variant;
      break;
    }
    case "text": {
      if (!document) {
        throw new Error(
          `Document not found for the following component: “${componentName}”`,
        );
      }

      let variant = getPropertyValueByLabel(
        componentProperty.properties,
        "variant",
      );
      variant ??= "block";

      const heading = getPropertyValueByLabel(
        componentProperty.properties,
        "heading",
      );

      properties.variant = variant;
      properties.heading = heading;
      properties.content = document.content;
      break;
    }
    case "timeline": {
      const timelineLink = links.find((link) => link.category === "tree");
      if (!timelineLink) {
        throw new Error(
          `Timeline link not found for the following component: “${componentName}”`,
        );
      }

      properties.timelineId = timelineLink.uuid;
      break;
    }
    case "video": {
      const videoLink = links.find(
        (link) => "type" in link && link.type === "video",
      );
      if (!videoLink) {
        throw new Error(
          `Video link not found for the following component: “${componentName}”`,
        );
      }

      let isChaptersDislayed = getPropertyValueByLabel(
        componentProperty.properties,
        "chapters-displayed",
      );
      isChaptersDislayed ??= true;

      properties.videoId = videoLink.uuid;
      properties.isChaptersDislayed = isChaptersDislayed === true;
      break;
    }
    default: {
      console.warn(
        `Invalid or non-implemented component name “${componentName as string}” for the following element: “${parseStringContent(
          elementResource.identification.label as OchreStringContent,
        )}”`,
      );
      break;
    }
  }

  return properties as WebElementComponent;
}

/**
 * Parses raw web element data into a standardized WebElement structure
 *
 * @param elementResource - Raw element resource data in OCHRE format
 * @returns Parsed WebElement object
 */
async function parseWebElement(
  elementResource: OchreResource,
): Promise<WebElement> {
  const identification = parseIdentification(elementResource.identification);

  const elementProperties =
    elementResource.properties?.property ?
      parseProperties(
        Array.isArray(elementResource.properties.property) ?
          elementResource.properties.property
        : [elementResource.properties.property],
      )
    : [];

  const presentationProperty = elementProperties.find(
    (property) => property.label.name === "presentation",
  );
  if (!presentationProperty) {
    throw new Error(
      `Presentation property not found for element “${identification.label}”`,
    );
  }

  const componentProperty = presentationProperty.properties.find(
    (property) => property.label.name === "component",
  );
  if (!componentProperty) {
    throw new Error(
      `Component for element “${identification.label}” not found`,
    );
  }

  const properties = await parseElementProperties(
    componentProperty,
    elementResource,
  );

  const blockSectionSidebarProperty = presentationProperty.properties.find(
    (property) => property.label.name === "section-sidebar-displayed",
  );
  const isDisplayedInBlockSectionSidebar =
    blockSectionSidebarProperty?.values[0]?.content === true;

  const elementResourceProperties =
    elementResource.properties?.property ?
      parseProperties(
        Array.isArray(elementResource.properties.property) ?
          elementResource.properties.property
        : [elementResource.properties.property],
      )
    : [];

  const cssProperties =
    elementResourceProperties.find(
      (property) =>
        property.label.name === "presentation" &&
        property.values[0]!.content === "css",
    )?.properties ?? [];

  const cssStyles: Array<Style> = [];
  for (const property of cssProperties) {
    const cssStyle = property.values[0]!.content as string;
    cssStyles.push({ label: property.label.name, value: cssStyle });
  }

  const mobileCssProperties =
    elementResourceProperties.find(
      (property) =>
        property.label.name === "presentation" &&
        property.values[0]!.content === "css-mobile",
    )?.properties ?? [];

  const cssStylesMobile: Array<Style> = [];
  for (const property of mobileCssProperties) {
    const cssStyle = property.values[0]!.content as string;
    cssStylesMobile.push({ label: property.label.name, value: cssStyle });
  }

  const titleProperties = elementResourceProperties.find(
    (property) =>
      property.label.name === "presentation" &&
      property.values[0]!.content === "title",
  )?.properties;

  let variant: "default" | "simple" = "default";
  let isNameDisplayed = false;
  let isDescriptionDisplayed = false;
  let isDateDisplayed = false;
  let isCreatorsDisplayed = false;

  if (titleProperties) {
    const titleVariant = getPropertyValueByLabel(titleProperties, "variant");
    if (titleVariant) {
      variant = titleVariant as "default" | "simple";
    }

    const titleShow = titleProperties.filter(
      (property) => property.label.name === "display",
    );
    if (titleShow.length > 0) {
      isNameDisplayed = titleShow.some(
        (property) => property.values[0]!.content === "name",
      );
      isDescriptionDisplayed = titleShow.some(
        (property) => property.values[0]!.content === "description",
      );
      isDateDisplayed = titleShow.some(
        (property) => property.values[0]!.content === "date",
      );
      isCreatorsDisplayed = titleShow.some(
        (property) => property.values[0]!.content === "creators",
      );
    }
  }

  return {
    uuid: elementResource.uuid,
    type: "element",
    title: {
      label: identification.label,
      variant,
      properties: {
        isNameDisplayed,
        isDescriptionDisplayed,
        isDateDisplayed,
        isCreatorsDisplayed,
      },
    },
    isDisplayedInBlockSectionSidebar,
    cssStyles,
    cssStylesMobile,
    ...properties,
  };
}

/**
 * Parses raw Pages into Page items
 *
 * @param pageResource - Raw Page data in OCHRE format
 * @returns Parsed Page item
 */
async function parsePage(pageResource: OchreResource): Promise<Webpage | null> {
  const webpageProperties =
    pageResource.properties ?
      parseProperties(
        Array.isArray(pageResource.properties.property) ?
          pageResource.properties.property
        : [pageResource.properties.property],
      )
    : [];

  if (
    webpageProperties.length === 0 ||
    webpageProperties.find((property) => property.label.name === "presentation")
      ?.values[0]?.content !== "page"
  ) {
    // Skip global elements
    return null;
  }

  const identification = parseIdentification(pageResource.identification);

  const slug = pageResource.slug;
  if (slug === undefined) {
    throw new Error(`Slug not found for page “${identification.label}”`);
  }

  const links =
    pageResource.links ?
      parseLinks(
        Array.isArray(pageResource.links) ?
          pageResource.links
        : [pageResource.links],
      )
    : [];
  const imageLink = links.find(
    (link) => "type" in link && (link.type === "image" || link.type === "IIIF"),
  );

  const webpageResources =
    pageResource.resource ?
      Array.isArray(pageResource.resource) ?
        pageResource.resource
      : [pageResource.resource]
    : [];

  const items: Array<WebElement | WebBlock> = [];
  for (const resource of webpageResources) {
    const resourceProperties =
      resource.properties ?
        parseProperties(
          Array.isArray(resource.properties.property) ?
            resource.properties.property
          : [resource.properties.property],
        )
      : [];

    const resourceType = getPropertyValueByLabel(
      resourceProperties,
      "presentation",
    ) as "element" | "block" | undefined;
    if (resourceType == null) {
      continue;
    }

    switch (resourceType) {
      case "element": {
        const element = await parseWebElement(resource);
        items.push(element);
        break;
      }
      case "block": {
        const block = await parseBlock(resource);
        if (block) {
          items.push(block);
        }
        break;
      }
    }
  }

  const webpages =
    pageResource.resource ?
      await parseWebpageResources(
        Array.isArray(pageResource.resource) ?
          pageResource.resource
        : [pageResource.resource],
        "page",
      )
    : [];

  let displayedInHeader = true;
  let width: "default" | "full" | "large" | "narrow" = "default";
  let variant: "default" | "no-background" = "default";
  let isSidebarDisplayed = true;

  const webpageSubProperties = webpageProperties.find(
    (property) =>
      property.label.name === "presentation" &&
      property.values[0]?.content === "page",
  )?.properties;

  if (webpageSubProperties) {
    const headerProperty = webpageSubProperties.find(
      (property) => property.label.name === "header",
    )?.values[0];
    if (headerProperty) {
      displayedInHeader = headerProperty.content === true;
    }

    const widthProperty = webpageSubProperties.find(
      (property) => property.label.name === "width",
    )?.values[0];
    if (widthProperty) {
      width = widthProperty.content as "default" | "full" | "large" | "narrow";
    }

    const variantProperty = webpageSubProperties.find(
      (property) => property.label.name === "variant",
    )?.values[0];
    if (variantProperty) {
      variant = variantProperty.content as "default" | "no-background";
    }

    const isSidebarDisplayedProperty = webpageSubProperties.find(
      (property) => property.label.name === "sidebar-visible",
    )?.values[0];
    if (isSidebarDisplayedProperty) {
      isSidebarDisplayed = isSidebarDisplayedProperty.content === true;
    }
  }

  const cssStyleSubProperties = webpageProperties.find(
    (property) =>
      property.label.name === "presentation" &&
      property.values[0]?.content === "css",
  )?.properties;
  const cssStyles: Array<Style> = [];
  if (cssStyleSubProperties) {
    for (const property of cssStyleSubProperties) {
      cssStyles.push({
        label: property.label.name,
        value: property.values[0]!.content as string,
      });
    }
  }

  const mobileCssStyleSubProperties = webpageProperties.find(
    (property) =>
      property.label.name === "presentation" &&
      property.values[0]?.content === "css-mobile",
  )?.properties;
  const cssStylesMobile: Array<Style> = [];
  if (mobileCssStyleSubProperties) {
    for (const property of mobileCssStyleSubProperties) {
      cssStylesMobile.push({
        label: property.label.name,
        value: property.values[0]!.content as string,
      });
    }
  }

  return {
    title: identification.label,
    slug,
    items,
    properties: {
      displayedInHeader,
      width,
      variant,
      backgroundImageUrl:
        imageLink ?
          `https://ochre.lib.uchicago.edu/ochre?uuid=${imageLink.uuid}&load`
        : null,
      isSidebarDisplayed,
      cssStyles,
      cssStylesMobile,
    },
    webpages,
  };
}

/**
 * Parses raw Pages into an array of Page items
 *
 * @param pageResources - Array of raw page resources in OCHRE format
 * @returns Array of parsed Page items
 */
async function parsePages(
  pageResources: Array<OchreResource>,
): Promise<Array<Webpage>> {
  const returnPages: Array<Webpage> = [];
  const pagesToParse =
    Array.isArray(pageResources) ? pageResources : [pageResources];

  for (const page of pagesToParse) {
    const webpage = await parsePage(page);
    if (webpage) {
      returnPages.push(webpage);
    }
  }

  return returnPages;
}

/**
 * Parses raw Blocks into Block items
 *
 * @param blockResource - Raw block resource data in OCHRE format
 * @returns Parsed Block item
 */
async function parseBlock(
  blockResource: OchreResource,
): Promise<WebBlock | null> {
  const returnBlock: WebBlock = {
    uuid: blockResource.uuid,
    type: "block",
    layout: "vertical",
    items: [],
    properties: {
      spacing: undefined,
      gap: undefined,
      alignItems: "start",
      justifyContent: "stretch",
      sectionSidebarItems: null,
    },
    propertiesMobile: null,
    cssStyles: [],
    cssStylesMobile: [],
  };

  const blockProperties =
    blockResource.properties ?
      parseProperties(
        Array.isArray(blockResource.properties.property) ?
          blockResource.properties.property
        : [blockResource.properties.property],
      )
    : [];

  const blockMainProperties = blockProperties.find(
    (property) =>
      property.label.name === "presentation" &&
      property.values[0]?.content === "block",
  )?.properties;
  if (blockMainProperties) {
    const layoutProperty = blockMainProperties.find(
      (property) => property.label.name === "layout",
    )?.values[0];
    if (layoutProperty) {
      returnBlock.layout = layoutProperty.content as
        | "vertical"
        | "horizontal"
        | "grid";
    }

    const spacingProperty = blockMainProperties.find(
      (property) => property.label.name === "spacing",
    )?.values[0];
    if (spacingProperty) {
      returnBlock.properties.spacing = spacingProperty.content as string;
    }

    const gapProperty = blockMainProperties.find(
      (property) => property.label.name === "gap",
    )?.values[0];
    if (gapProperty) {
      returnBlock.properties.gap = gapProperty.content as string;
    }

    const alignItemsProperty = blockMainProperties.find(
      (property) => property.label.name === "align-items",
    )?.values[0];
    if (alignItemsProperty) {
      returnBlock.properties.alignItems = alignItemsProperty.content as
        | "stretch"
        | "start"
        | "center"
        | "end"
        | "space-between";
    }

    const justifyContentProperty = blockMainProperties.find(
      (property) => property.label.name === "justify-content",
    )?.values[0];
    if (justifyContentProperty) {
      returnBlock.properties.justifyContent = justifyContentProperty.content as
        | "stretch"
        | "start"
        | "center"
        | "end"
        | "space-between";
    }

    const mobileOverwriteProperty = blockMainProperties.find(
      (property) => property.label.name === "overwrite-mobile",
    );
    if (mobileOverwriteProperty) {
      const mobileOverwriteProperties = mobileOverwriteProperty.properties;

      const propertiesMobile: Record<string, string> = {};
      for (const property of mobileOverwriteProperties) {
        propertiesMobile[property.label.name] = property.values[0]!
          .content as string;
      }

      returnBlock.propertiesMobile = propertiesMobile;
    }
  }

  const blockResources =
    blockResource.resource ?
      Array.isArray(blockResource.resource) ?
        blockResource.resource
      : [blockResource.resource]
    : [];
  const blockItems: Array<WebElement | WebBlock> = [];
  for (const resource of blockResources) {
    const resourceProperties =
      resource.properties ?
        parseProperties(
          Array.isArray(resource.properties.property) ?
            resource.properties.property
          : [resource.properties.property],
        )
      : [];

    const resourceType = getPropertyValueByLabel(
      resourceProperties,
      "presentation",
    ) as "element" | "block" | undefined;
    if (resourceType == null) {
      continue;
    }

    switch (resourceType) {
      case "element": {
        const element = await parseWebElement(resource);
        blockItems.push(element);
        break;
      }
      case "block": {
        const block = await parseBlock(resource);
        if (block) {
          blockItems.push(block);
        }
        break;
      }
    }
  }

  returnBlock.items = blockItems;

  const blockCssStyles = blockProperties.find(
    (property) =>
      property.label.name === "presentation" &&
      property.values[0]?.content === "css",
  )?.properties;
  if (blockCssStyles) {
    for (const property of blockCssStyles) {
      returnBlock.cssStyles.push({
        label: property.label.name,
        value: property.values[0]!.content as string,
      });
    }
  }

  const blockMobileCssStyles = blockProperties.find(
    (property) =>
      property.label.name === "presentation" &&
      property.values[0]?.content === "css-mobile",
  )?.properties;
  if (blockMobileCssStyles) {
    for (const property of blockMobileCssStyles) {
      returnBlock.cssStylesMobile.push({
        label: property.label.name,
        value: property.values[0]!.content as string,
      });
    }
  }

  returnBlock.properties.sectionSidebarItems =
    parseSectionSidebarItems(returnBlock);

  return returnBlock;
}

function parseSectionSidebarItems(
  block: WebBlock,
): Array<WebSectionSidebarItem> | null {
  const sectionSidebarItems: Array<WebSectionSidebarItem> = [];

  for (const item of block.items) {
    switch (item.type) {
      case "block": {
        const subItems = parseSectionSidebarItems(item);
        if (subItems !== null) {
          sectionSidebarItems.push({
            uuid: item.uuid,
            type: "block",
            name: null,
            items: subItems,
          });
        }
        break;
      }
      case "element": {
        const isDisplayedInSectionSidebar =
          item.isDisplayedInBlockSectionSidebar;
        if (!isDisplayedInSectionSidebar) {
          continue;
        }

        sectionSidebarItems.push({
          uuid: item.uuid,
          type: "element",
          name: item.title.label,
          items: null,
        });
        break;
      }
    }
  }

  return sectionSidebarItems.length > 0 ? sectionSidebarItems : null;
}

/**
 * Parses raw website properties into a standardized WebsiteProperties structure
 *
 * @param properties - Array of raw website properties in OCHRE format
 * @returns Parsed WebsiteProperties object
 */
function parseWebsiteProperties(
  properties: Array<OchreProperty>,
): WebsiteProperties {
  const mainProperties = parseProperties(properties);
  const websiteProperties = mainProperties.find(
    (property) => property.label.name === "presentation",
  )?.properties;
  if (!websiteProperties) {
    throw new Error("Presentation property not found");
  }

  let type = websiteProperties.find(
    (property) => property.label.name === "webUI",
  )?.values[0]?.content;
  type ??= "traditional";

  let status = websiteProperties.find(
    (property) => property.label.name === "status",
  )?.values[0]?.content;
  status ??= "development";

  let privacy = websiteProperties.find(
    (property) => property.label.name === "privacy",
  )?.values[0]?.content;
  privacy ??= "public";

  const result = websiteSchema.safeParse({ type, status, privacy });
  if (!result.success) {
    throw new Error(`Invalid website properties: ${result.error.message}`);
  }

  let contact: Website["properties"]["contact"] = null;
  const contactProperty = websiteProperties.find(
    (property) => property.label.name === "contact",
  );
  if (contactProperty) {
    const [name, email] = (contactProperty.values[0]?.content as string).split(
      ";",
    );
    contact = { name: name!, email: email ?? null };
  }

  const logoUuid =
    websiteProperties.find((property) => property.label.name === "logo")
      ?.values[0]?.uuid ?? null;

  let isHeaderDisplayed = true;
  let headerVariant: "default" | "floating" | "inline" = "default";
  let headerAlignment: "start" | "center" | "end" = "start";
  let isHeaderProjectDisplayed = true;
  let isFooterDisplayed = true;
  let isSidebarDisplayed = false;
  let supportsThemeToggle = true;

  const headerProperty = websiteProperties.find(
    (property) => property.label.name === "navbar-visible",
  )?.values[0];
  if (headerProperty) {
    isHeaderDisplayed = headerProperty.content === true;
  }

  const headerVariantProperty = websiteProperties.find(
    (property) => property.label.name === "navbar-variant",
  )?.values[0];
  if (headerVariantProperty) {
    headerVariant = headerVariantProperty.content as
      | "default"
      | "floating"
      | "inline";
  }

  const headerAlignmentProperty = websiteProperties.find(
    (property) => property.label.name === "navbar-alignment",
  )?.values[0];
  if (headerAlignmentProperty) {
    headerAlignment = headerAlignmentProperty.content as
      | "start"
      | "center"
      | "end";
  }

  const isHeaderProjectDisplayedProperty = websiteProperties.find(
    (property) => property.label.name === "navbar-project-visible",
  )?.values[0];
  if (isHeaderProjectDisplayedProperty) {
    isHeaderProjectDisplayed =
      isHeaderProjectDisplayedProperty.content === true;
  }

  const footerProperty = websiteProperties.find(
    (property) => property.label.name === "footer-visible",
  )?.values[0];
  if (footerProperty) {
    isFooterDisplayed = footerProperty.content === true;
  }

  const sidebarProperty = websiteProperties.find(
    (property) => property.label.name === "sidebar-visible",
  )?.values[0];
  if (sidebarProperty) {
    isSidebarDisplayed = sidebarProperty.content === true;
  }

  const supportsThemeToggleProperty = websiteProperties.find(
    (property) => property.label.name === "supports-theme-toggle",
  )?.values[0];
  if (supportsThemeToggleProperty) {
    supportsThemeToggle = supportsThemeToggleProperty.content === true;
  }

  const {
    type: validatedType,
    status: validatedStatus,
    privacy: validatedPrivacy,
  } = result.data;

  return {
    type: validatedType,
    privacy: validatedPrivacy,
    status: validatedStatus,
    contact,
    isHeaderDisplayed,
    headerVariant,
    headerAlignment,
    isHeaderProjectDisplayed,
    isFooterDisplayed,
    isSidebarDisplayed,
    supportsThemeToggle,
    logoUrl:
      logoUuid !== null ?
        `https://ochre.lib.uchicago.edu/ochre?uuid=${logoUuid}&load`
      : null,
  };
}

export async function parseWebsite(
  websiteTree: OchreTree,
  projectName: FakeString,
  website: FakeString | null,
): Promise<Website> {
  if (!websiteTree.properties) {
    throw new Error("Website properties not found");
  }

  const properties = parseWebsiteProperties(
    Array.isArray(websiteTree.properties.property) ?
      websiteTree.properties.property
    : [websiteTree.properties.property],
  );

  if (
    typeof websiteTree.items === "string" ||
    !("resource" in websiteTree.items)
  ) {
    throw new Error("Website pages not found");
  }

  const resources =
    Array.isArray(websiteTree.items.resource) ?
      websiteTree.items.resource
    : [websiteTree.items.resource];

  const pages = await parsePages(resources);

  let sidebar: Website["sidebar"] | null = null;
  const sidebarElements: Array<WebElement> = [];
  const sidebarTitle: WebElement["title"] = {
    label: "",
    variant: "default",
    properties: {
      isNameDisplayed: false,
      isDescriptionDisplayed: false,
      isDateDisplayed: false,
      isCreatorsDisplayed: false,
    },
  };
  let sidebarLayout: "start" | "end" = "start";
  let sidebarMobileLayout: "default" | "inline" = "default";
  const sidebarCssStyles: Array<Style> = [];
  const sidebarCssStylesMobile: Array<Style> = [];

  const sidebarResource = resources.find((resource) => {
    const resourceProperties =
      resource.properties ?
        parseProperties(
          Array.isArray(resource.properties.property) ?
            resource.properties.property
          : [resource.properties.property],
        )
      : [];
    return resourceProperties.some(
      (property) =>
        property.label.name === "presentation" &&
        property.values[0]?.content === "element" &&
        property.properties[0]?.label.name === "component" &&
        property.properties[0].values[0]?.content === "sidebar",
    );
  });
  if (sidebarResource) {
    sidebarTitle.label =
      (
        typeof sidebarResource.identification.label === "string" ||
        typeof sidebarResource.identification.label === "number" ||
        typeof sidebarResource.identification.label === "boolean"
      ) ?
        parseFakeString(sidebarResource.identification.label)
      : parseStringContent(sidebarResource.identification.label);

    const sidebarBaseProperties =
      sidebarResource.properties ?
        parseProperties(
          Array.isArray(sidebarResource.properties.property) ?
            sidebarResource.properties.property
          : [sidebarResource.properties.property],
        )
      : [];

    const sidebarProperties =
      sidebarBaseProperties
        .find(
          (property) =>
            property.label.name === "presentation" &&
            property.values[0]?.content === "element",
        )
        ?.properties.find(
          (property) =>
            property.label.name === "component" &&
            property.values[0]?.content === "sidebar",
        )?.properties ?? [];

    const sidebarLayoutProperty = sidebarProperties.find(
      (property) => property.label.name === "layout",
    );
    if (sidebarLayoutProperty) {
      sidebarLayout = sidebarLayoutProperty.values[0]!.content as
        | "start"
        | "end";
    }

    const sidebarMobileLayoutProperty = sidebarProperties.find(
      (property) => property.label.name === "layout-mobile",
    );
    if (sidebarMobileLayoutProperty) {
      sidebarMobileLayout = sidebarMobileLayoutProperty.values[0]!.content as
        | "default"
        | "inline";
    }

    const cssProperties =
      sidebarBaseProperties.find(
        (property) =>
          property.label.name === "presentation" &&
          property.values[0]!.content === "css",
      )?.properties ?? [];

    for (const property of cssProperties) {
      const cssStyle = property.values[0]!.content as string;
      sidebarCssStyles.push({ label: property.label.name, value: cssStyle });
    }

    const mobileCssProperties =
      sidebarBaseProperties.find(
        (property) =>
          property.label.name === "presentation" &&
          property.values[0]!.content === "css-mobile",
      )?.properties ?? [];

    for (const property of mobileCssProperties) {
      const cssStyle = property.values[0]!.content as string;
      sidebarCssStylesMobile.push({
        label: property.label.name,
        value: cssStyle,
      });
    }

    const titleProperties = sidebarBaseProperties.find(
      (property) =>
        property.label.name === "presentation" &&
        property.values[0]!.content === "title",
    )?.properties;

    if (titleProperties) {
      const titleVariant = getPropertyValueByLabel(titleProperties, "variant");
      if (titleVariant) {
        sidebarTitle.variant = titleVariant as "default" | "simple";
      }

      const titleShow = titleProperties.filter(
        (property) => property.label.name === "display",
      );
      if (titleShow.length > 0) {
        sidebarTitle.properties.isNameDisplayed = titleShow.some(
          (property) => property.values[0]!.content === "name",
        );
        sidebarTitle.properties.isDescriptionDisplayed = titleShow.some(
          (property) => property.values[0]!.content === "description",
        );
        sidebarTitle.properties.isDateDisplayed = titleShow.some(
          (property) => property.values[0]!.content === "date",
        );
        sidebarTitle.properties.isCreatorsDisplayed = titleShow.some(
          (property) => property.values[0]!.content === "creators",
        );
      }
    }

    const sidebarResources =
      sidebarResource.resource ?
        Array.isArray(sidebarResource.resource) ?
          sidebarResource.resource
        : [sidebarResource.resource]
      : [];

    for (const resource of sidebarResources) {
      const element = await parseWebElement(resource);
      sidebarElements.push(element);
    }
  }

  if (sidebarElements.length > 0) {
    sidebar = {
      elements: sidebarElements,
      title: sidebarTitle,
      layout: sidebarLayout,
      mobileLayout: sidebarMobileLayout,
      cssStyles: sidebarCssStyles,
      cssStylesMobile: sidebarCssStylesMobile,
    };
  }

  let collectionOptions: Website["collectionOptions"] | null = null;
  if (websiteTree.collectionOptions) {
    const collectionUuids = [];
    for (const page of pages) {
      for (const item of page.items) {
        if (item.type === "element" && item.component === "collection") {
          collectionUuids.push(item.collectionId);
        }
      }
    }

    collectionOptions = {
      uuids: collectionUuids,
      properties: {
        metadataUuids:
          websiteTree.collectionOptions.metadataUuids.uuid ?
            (Array.isArray(websiteTree.collectionOptions.metadataUuids.uuid) ?
              websiteTree.collectionOptions.metadataUuids.uuid
            : [websiteTree.collectionOptions.metadataUuids.uuid]
            ).map((uuid) => uuid.content)
          : [],
        searchUuids:
          websiteTree.collectionOptions.searchUuids.uuid ?
            (Array.isArray(websiteTree.collectionOptions.searchUuids.uuid) ?
              websiteTree.collectionOptions.searchUuids.uuid
            : [websiteTree.collectionOptions.searchUuids.uuid]
            ).map((uuid) => uuid.content)
          : [],
        labelUuids:
          websiteTree.collectionOptions.labelUuids.uuid ?
            (Array.isArray(websiteTree.collectionOptions.labelUuids.uuid) ?
              websiteTree.collectionOptions.labelUuids.uuid
            : [websiteTree.collectionOptions.labelUuids.uuid]
            ).map((uuid) => uuid.content)
          : [],
      },
    };
  }

  return {
    uuid: websiteTree.uuid,
    publicationDateTime:
      websiteTree.publicationDateTime ?
        new Date(websiteTree.publicationDateTime)
      : null,
    identification: parseIdentification(websiteTree.identification),
    project: {
      name: parseFakeString(projectName),
      website: website !== null ? parseFakeString(website) : null,
    },
    creators:
      websiteTree.creators ?
        parsePersons(
          Array.isArray(websiteTree.creators.creator) ?
            websiteTree.creators.creator
          : [websiteTree.creators.creator],
        )
      : [],
    license: parseLicense(websiteTree.availability),
    pages,
    sidebar,
    properties,
    collectionOptions,
  };
}
