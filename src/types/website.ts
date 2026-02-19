import type {
  ApiVersion,
  Bibliography,
  Identification,
  License,
  Metadata,
  Person,
} from "./index.js";

/**
 * Represents a level context item with a variable and value
 */
export type LevelContextItem = {
  variableUuid: string;
  valueUuid: string | null;
};
/**
 * Represents a level context with a context item
 */
export type LevelContext = {
  context: Array<LevelContextItem>;
  identification: Identification;
  type: string;
};

/**
 * Represents property contexts with its levels
 */
export type PropertyContexts = {
  flatten: Array<LevelContext>;
  suppress: Array<LevelContext>;
  filter: Array<LevelContext>;
  sort: Array<LevelContext>;
  detail: Array<LevelContext>;
  download: Array<LevelContext>;
  label: Array<LevelContext>;
  prominent: Array<LevelContext>;
};

/**
 * Represents a scope with its UUID, type and identification
 */
export type Scope = {
  uuid: string;
  type: string;
  identification: Identification;
};

/**
 * Represents the OCHRE website type
 */
export type WebsiteType =
  | "traditional"
  | "digital-collection"
  | "plum"
  | "cedar"
  | "elm"
  | "maple"
  | "oak"
  | "palm";

/**
 * Represents a website with its properties and elements
 */
export type Website = {
  uuid: string;
  version: ApiVersion;
  belongsTo: { uuid: string; abbreviation: string } | null;
  metadata: Metadata;
  publicationDateTime: Date | null;
  identification: Identification;
  creators: Array<Person>;
  license: License | null;
  items: Array<Webpage | WebSegment>;
  properties: {
    type: WebsiteType;
    status: "development" | "preview" | "production";
    privacy: "public" | "password" | "private";
    contact: { name: string; email: string | null } | null;
    theme: {
      isThemeToggleDisplayed: boolean;
      defaultTheme: "light" | "dark" | "system";
    };
    icon: {
      logoUuid: string | null;
      faviconUuid: string | null;
      appleTouchIconUuid: string | null;
    };
    navbar: {
      isDisplayed: boolean;
      variant: "default" | "floating" | "inline";
      alignment: "start" | "center" | "end";
      isProjectDisplayed: boolean;
      searchBarBoundElementUuid: string | null;
      items: Array<WebElement | WebBlock> | null;
    };
    footer: {
      isDisplayed: boolean;
      items: Array<WebElement | WebBlock> | null;
    };
    sidebar: {
      isDisplayed: boolean;
      items: Array<WebElement | WebBlock>;
      title: WebElement["title"];
      layout: "start" | "end";
      mobileLayout: "default" | "inline";
      cssStyles: {
        default: Array<Style>;
        tablet: Array<Style>;
        mobile: Array<Style>;
      };
    } | null;
    itemPage: {
      isMainContentDisplayed: boolean;
      isDescriptionDisplayed: boolean;
      isDocumentDisplayed: boolean;
      isNotesDisplayed: boolean;
      isEventsDisplayed: boolean;
      isPeriodsDisplayed: boolean;
      isPropertiesDisplayed: boolean;
      isBibliographyDisplayed: boolean;
      isPropertyValuesGrouped: boolean;
      iiifViewer: "universal-viewer" | "clover";
    };
    options: {
      contexts: PropertyContexts | null;
      scopes: Array<Scope> | null;
      labels: { title: string | null };
    };
  };
};

/**
 * Represents a webpage with its title, slug, properties, items and subpages
 */
export type Webpage = {
  uuid: string;
  type: "page";
  title: string;
  slug: string;
  publicationDateTime: Date | null;
  items: Array<WebSegment | WebElement | WebBlock>;
  properties: {
    width: "full" | "large" | "narrow" | "default";
    variant: "default" | "no-background";
    isBreadcrumbsDisplayed: boolean;
    isSidebarDisplayed: boolean;
    isDisplayedInNavbar: boolean;
    isNavbarSearchBarDisplayed: boolean;
    backgroundImage: WebImage | null;
    cssStyles: {
      default: Array<Style>;
      tablet: Array<Style>;
      mobile: Array<Style>;
    };
  };
  webpages: Array<Webpage>;
};

/**
 * Represents a web segment
 */
export type WebSegment = {
  uuid: string;
  type: "segment";
  title: string;
  slug: string;
  publicationDateTime: Date | null;
  items: Array<WebSegmentItem>;
};

/**
 * Represents a web segment item
 */
export type WebSegmentItem = {
  uuid: string;
  type: "segment-item";
  title: string;
  slug: string;
  publicationDateTime: Date | null;
  items: Array<Webpage | WebSegment>;
};

/**
 * Represents a title with its label and variant
 */
export type WebTitle = {
  label: string;
  variant: "default" | "simple";
  properties: {
    isNameDisplayed: boolean;
    isDescriptionDisplayed: boolean;
    isDateDisplayed: boolean;
    isCreatorsDisplayed: boolean;
    isCountDisplayed: boolean;
  };
};

/**
 * Base properties for web elements
 */
export type WebElement = {
  uuid: string;
  type: "element";
  title: WebTitle;
  cssStyles: {
    default: Array<Style>;
    tablet: Array<Style>;
    mobile: Array<Style>;
  };
} & WebElementComponent;

/**
 * Union type of all possible web element components
 */
export type WebElementComponent =
  | {
      component: "3d-viewer";
      linkUuid: string;
      fileSize: number | null;
      isInteractive: boolean;
      isControlsDisplayed: boolean;
    }
  | {
      component: "advanced-search";
      boundElementUuid: string | null;
      href: string | null;
    }
  | { component: "annotated-document"; linkUuid: string }
  | {
      component: "annotated-image";
      linkUuid: string;
      isFilterInputDisplayed: boolean;
      isOptionsDisplayed: boolean;
      isAnnotationHighlightsDisplayed: boolean;
      isAnnotationTooltipsDisplayed: boolean;
    }
  | {
      component: "audio-player";
      linkUuid: string;
      isSpeedControlsDisplayed: boolean;
      isVolumeControlsDisplayed: boolean;
      isSeekBarDisplayed: boolean;
    }
  | {
      component: "bibliography";
      linkUuids: Array<string>;
      bibliographies: Array<Bibliography>;
      layout: "long" | "short";
      isSourceDocumentDisplayed: boolean;
    }
  | {
      component: "entries";
      linkUuid: string;
      variant: "entry" | "item";
      isFilterInputDisplayed: boolean;
    }
  | {
      component: "button";
      variant: "default" | "transparent" | "link";
      href: string;
      isExternal: boolean;
      label: string | null;
      startIcon: string | null;
      endIcon: string | null;
      image: WebImage | null;
    }
  | {
      component: "collection";
      linkUuids: Array<string>;
      displayedProperties: Array<{ uuid: string; label: string }> | null;
      variant: "full" | "highlights";
      itemVariant: "detailed" | "card" | "tile" | "showcase";
      paginationVariant: "default" | "numeric";
      layout: "image-top" | "image-bottom" | "image-start" | "image-end";
      imageQuality: "high" | "low";
      isSortDisplayed: boolean;
      isUsingQueryParams: boolean;
      filter: {
        isSidebarDisplayed: boolean;
        isResultsBarDisplayed: boolean;
        isMapDisplayed: boolean;
        isInputDisplayed: boolean;
        isLimitedToTitleQuery: boolean;
        isLimitedToLeafPropertyValues: boolean;
        sidebarSort: "default" | "alphabetical";
      };
      options: {
        attributeFilters: { bibliographies: boolean; periods: boolean };
        scopes: Array<Scope> | null;
        contexts: PropertyContexts | null;
        labels: { title: string | null };
      };
    }
  | { component: "empty-space"; height: string | null; width: string | null }
  | {
      component: "iframe";
      href: string;
      height: string | null;
      width: string | null;
    }
  | {
      component: "iiif-viewer";
      linkUuid: string;
      variant: "universal-viewer" | "clover";
    }
  | {
      component: "image";
      images: Array<WebImage>;
      variant: "default" | "carousel" | "grid" | "hero";
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
      heroOptions: {
        isBackgroundImageDisplayed: boolean;
        isDocumentDisplayed: boolean;
      } | null;
    }
  | {
      component: "image-gallery";
      linkUuid: string;
      isFilterInputDisplayed: boolean;
    }
  | {
      component: "map";
      linkUuid: string;
      customBasemap: string | null;
      initialBounds: [[number, number], [number, number]] | null;
      maximumBounds: [[number, number], [number, number]] | null;
      isControlsDisplayed: boolean;
      isInteractive: boolean;
      isClustered: boolean;
      isUsingPins: boolean;
      isFullHeight: boolean;
    }
  | {
      component: "query";
      linkUuids: Array<string>;
      queries: Array<{
        label: string;
        propertyVariableUuids: Array<string>;
        startIcon: string | null;
        endIcon: string | null;
      }>;
      options: {
        attributeFilters: { bibliographies: boolean; periods: boolean };
        scopes: Array<Scope> | null;
        contexts: PropertyContexts | null;
        labels: { title: string | null };
      };
      displayedProperties: Array<{ uuid: string; label: string }> | null;
      itemVariant: Extract<
        WebElementComponent,
        { component: "collection" }
      >["itemVariant"];
      paginationVariant: Extract<
        WebElementComponent,
        { component: "collection" }
      >["paginationVariant"];
      layout: Extract<
        WebElementComponent,
        { component: "collection" }
      >["layout"];
    }
  | {
      component: "search-bar";
      queryVariant: "submit" | "change";
      placeholder: string | null;
      baseFilterQueries: string | null;
      boundElementUuid: string | null;
      href: string | null;
    }
  | { component: "table"; linkUuid: string }
  | {
      component: "text";
      variant:
        | { name: "title" | "block" | "banner" }
        | { name: "paragraph"; size: "xs" | "sm" | "md" | "lg" }
        | { name: "label"; size: "xs" | "sm" | "md" | "lg" | "xl" }
        | { name: "heading"; size: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" }
        | { name: "display"; size: "xs" | "sm" | "md" | "lg" };
      headingLevel: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | null;
      content: string;
    }
  | { component: "timeline"; linkUuid: string }
  | { component: "video"; linkUuid: string; isChaptersDisplayed: boolean };

/**
 * Represents an image used in web elements
 */
export type WebImage = {
  uuid: string | null;
  label: string | null;
  description: string | null;
  width: number;
  height: number;
  quality: "low" | "high";
};

/**
 * Represents a CSS style with label and value
 */
export type Style = { label: string; value: string };

export type WebBlockLayout =
  | "vertical"
  | "horizontal"
  | "grid"
  | "vertical-flex"
  | "horizontal-flex"
  | "accordion";

/**
 * Represents a block of vertical or horizontal content alignment
 */
export type WebBlock<T extends WebBlockLayout = WebBlockLayout> = {
  uuid: string;
  type: "block";
  title: WebTitle;
  items: T extends "accordion" ?
    Array<
      Extract<WebElement, { component: "text" }> & {
        items: Array<WebElement | WebBlock>;
      }
    >
  : Array<WebElement | WebBlock>;
  properties: {
    default: {
      layout: T;
      /**
       * valid `gridTemplateColumns` or `gridTemplateRows` CSS property value
       */
      spacing: string | null;
      /**
       * `gap` CSS property value
       */
      gap: string | null;
      isAccordionEnabled: T extends "accordion" ? boolean : never;
      isAccordionExpandedByDefault: T extends "accordion" ? boolean : never;
      isAccordionSidebarDisplayed: T extends "accordion" ? boolean : never;
    };
    tablet: Partial<WebBlock["properties"]["default"]> | null;
    mobile: Partial<WebBlock["properties"]["default"]> | null;
  };
  cssStyles: {
    default: Array<Style>;
    tablet: Array<Style>;
    mobile: Array<Style>;
  };
};
