import type {
  Bibliography,
  Document,
  Identification,
  License,
  Person,
  Resource,
} from "./index.js";

/**
 * Represents a Gallery (used in the OCHRE Viewer)
 */
export type Gallery = {
  identification: Identification;
  projectIdentification: Identification;
  resources: Array<Resource>;
  maxLength: number;
};

/**
 * Represents a metadata object given a UUID (used in the OCHRE Viewer)
 */
export type UuidMetadata = {
  item: { uuid: string; name: string; type: string };
  project: { name: string; website: string | null };
} | null;

/**
 * Represents a Website
 */
export type Website = {
  uuid: string;
  publicationDateTime: Date | null;
  identification: Identification;
  project: { name: string; website: string | null };
  creators: Array<Person>;
  license: License | null;
  pages: Array<Webpage>;
  sidebar: {
    elements: Array<WebElement>;
    title: WebElement["title"];
    layout: "start" | "end";
    mobileLayout: "default" | "inline";
    cssStyles: Array<Style>;
    cssStylesMobile: Array<Style>;
  } | null;
  properties: WebsiteProperties;
  collectionOptions: {
    uuids: Array<string>;
    properties: {
      metadataUuids: Array<string>;
      searchUuids: Array<string>;
      labelUuids: Array<string>;
    };
  } | null;
};

/**
 * Properties of a Website
 */
export type WebsiteProperties = {
  type:
    | "traditional"
    | "digital-collection"
    | "plum"
    | "cedar"
    | "elm"
    | "maple"
    | "oak"
    | "palm";
  privacy: "public" | "password" | "private";
  status: "development" | "preview" | "production";
  contact: { name: string; email: string | null } | null;
  isHeaderDisplayed: boolean;
  headerVariant: "default" | "floating" | "inline";
  headerAlignment: "start" | "center" | "end";
  isHeaderProjectDisplayed: boolean;
  isFooterDisplayed: boolean;
  isSidebarDisplayed: boolean;
  supportsThemeToggle: boolean;
  logoUrl: string | null;
};

/**
 * Represents a Page
 */
export type Webpage = {
  title: string;
  slug: string;
  properties: WebpageProperties;
  items: Array<WebElement | WebBlock>;
  webpages: Array<Webpage>;
};

/**
 * Properties of a Page
 */
export type WebpageProperties = {
  displayedInHeader: boolean;
  width: "full" | "large" | "narrow" | "default";
  variant: "default" | "no-background";
  backgroundImageUrl: string | null;
  isSidebarDisplayed: boolean;
  isBreadcrumbsDisplayed: boolean;
  cssStyles: Array<Style>;
  cssStylesMobile: Array<Style>;
};

/**
 * Represents an Element in a Page or Block
 */
export type WebElement = {
  uuid: string;
  type: "element";
  title: {
    label: string;
    variant: "default" | "simple";
    properties: {
      isNameDisplayed: boolean;
      isDescriptionDisplayed: boolean;
      isDateDisplayed: boolean;
      isCreatorsDisplayed: boolean;
    };
  };
  isDisplayedInBlockSectionSidebar: boolean;
  cssStyles: Array<Style>;
  cssStylesMobile: Array<Style>;
} & WebElementComponent;

/**
 * Union type of all possible Element components
 */
export type WebElementComponent =
  | { component: "annotated-document"; document: Document }
  | { component: "annotated-image"; imageUuid: string; isSearchable: boolean }
  | {
      component: "bibliography";
      bibliographies: Array<Bibliography>;
      layout: "long" | "short";
    }
  | {
      component: "entries";
      entriesId: string;
      variant: "entry" | "item";
      isSearchable: boolean;
    }
  | {
      component: "button";
      variant: "default" | "transparent";
      href: string;
      isExternal: boolean;
      label: string;
      icon: string | null;
    }
  | {
      component: "collection";
      collectionId: string;
      variant: "full" | "highlights";
      itemVariant: "default" | "card";
      paginationVariant: "default" | "numeric";
      isSearchable: boolean;
      showCount: boolean;
      layout: "image-top" | "image-bottom" | "image-start" | "image-end";
    }
  | { component: "empty-space"; height: string | null; width: string | null }
  | { component: "filter-categories"; filterId: string }
  | {
      component: "iframe";
      href: string;
      height: string | null;
      width: string | null;
    }
  | { component: "iiif-viewer"; IIIFId: string }
  | {
      component: "image";
      images: Array<WebImage>;
      variant: "default" | "carousel";
      width: number | null;
      height: number | null;
      isFullWidth: boolean;
      isFullHeight: boolean;
      imageQuality: "high" | "low";
      captionSource: "name" | "abbreviation" | "description";
      captionLayout: "top" | "bottom" | "inset" | "suppress";
      altTextSource: "name" | "abbreviation" | "description";
      isTransparentBackground: boolean;
      isCover: boolean;
      carouselOptions: { secondsPerImage: number } | null;
    }
  | { component: "image-gallery"; galleryId: string; isSearchable: boolean }
  | {
      component: "map";
      mapId: string;
      customBasemap: string | null;
      isControlsDisplayed: boolean;
      isInteractive: boolean;
      isClustered: boolean;
      isUsingPins: boolean;
      isFullHeight: boolean;
    }
  | { component: "n-columns"; columns: Array<WebElement> }
  | { component: "n-rows"; rows: Array<WebElement> }
  | { component: "network-graph" }
  | { component: "search-bar"; variant: "default" | "full" }
  | { component: "table"; tableId: string }
  | {
      component: "text";
      variant: "title" | "block" | "banner";
      heading: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | null;
      content: string;
    }
  | { component: "timeline"; timelineId: string }
  | { component: "video"; isChaptersDislayed: boolean };

/**
 * Represents an image used in an Element
 */
export type WebImage = {
  url: string;
  label: string | null;
  width: number;
  height: number;
};

/**
 * Represents a CSS Style
 */
export type Style = { label: string; value: string };

/**
 * Represents a Block in a Webpage
 */
export type WebBlock = {
  uuid: string;
  type: "block";
  layout: "vertical" | "horizontal" | "grid";
  items: Array<WebElement | WebBlock>;
  properties: {
    /**
     * valid `gridTemplateColumns` or `gridTemplateRows` CSS property value
     */
    spacing: string | undefined;
    /**
     * `gap` CSS property value
     */
    gap: string | undefined;
    /**
     * `align-items` CSS property value
     */
    alignItems: "stretch" | "start" | "center" | "end" | "space-between";
    /**
     * `justify-content` CSS property value
     */
    justifyContent: "stretch" | "start" | "center" | "end" | "space-between";
    sectionSidebarItems: Array<WebSectionSidebarItem> | null;
  };
  propertiesMobile: Record<string, string> | null;
  cssStyles: Array<Style>;
  cssStylesMobile: Array<Style>;
};

/**
 * Represents the section sidebar in a Block
 */
export type WebSectionSidebarItem = {
  uuid: string;
  type: "block" | "element";
  name: string | null;
  items: Array<WebSectionSidebarItem> | null;
};
