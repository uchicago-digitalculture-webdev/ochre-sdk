import type { MultilingualString } from "#/multilingual.js";
import type {
  Bibliography,
  DataCategory,
  Identification,
  License,
  Metadata,
  Person,
  PropertyValueContent,
} from "#/types/index.js";

type WebsitePropertyValueDataType = Exclude<
  PropertyValueContent<ReadonlyArray<string>>["dataType"],
  "coordinate"
>;

/**
 * Represents a context tree level item with a variable and value
 */
export type ContextTreeLevelItem = {
  variableUuid: string;
  valueUuid: string | null;
};
/**
 * Represents a context tree level with a context item
 */
export type ContextTreeLevel<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
> = {
  context: Array<ContextTreeLevelItem>;
  identification: Identification<T>;
  type: string;
};

/**
 * Represents a filter context tree level with a context item
 */
export type ContextTreeFilterLevel<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
> = {
  context: Array<ContextTreeLevelItem>;
  identification: Identification<T>;
  type: string;
  filterType: "property" | "coordinates" | "bibliography" | "period";
  isInlineDisplayed: boolean;
  isSidebarDisplayed: boolean;
  isSidebarOpen: boolean;
};

/**
 * Represents a context tree with levels grouped by behavior
 */
export type ContextTree<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
> = {
  flatten: Array<ContextTreeLevel<T>>;
  suppress: Array<ContextTreeLevel<T>>;
  filter: Array<ContextTreeFilterLevel<T>>;
  sort: Array<ContextTreeLevel<T>>;
  detail: Array<ContextTreeLevel<T>>;
  download: Array<ContextTreeLevel<T>>;
  label: Array<ContextTreeLevel<T>>;
  prominent: Array<ContextTreeLevel<T>>;
};

/**
 * Represents a scope with its UUID, type and identification
 */
export type Scope<T extends ReadonlyArray<string> = ReadonlyArray<string>> = {
  uuid: string;
  type: string;
  identification: Identification<T>;
};

/**
 * Represents a stylesheet item with its UUID and category
 */
export type StylesheetCategory = Extract<
  DataCategory,
  "propertyVariable" | "propertyValue"
>;

export type StylesheetItem =
  | {
      uuid: string;
      category: "propertyVariable";
      icon: string | null;
      styles: {
        default: Array<Style>;
        tablet: Array<Style>;
        mobile: Array<Style>;
      };
    }
  | {
      uuid: string;
      category: "propertyValue";
      variableUuid: string;
      icon: string | null;
      styles: {
        default: Array<Style>;
        tablet: Array<Style>;
        mobile: Array<Style>;
      };
    };

export type WebsitePropertyQueryNode<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
> = {
  target: "property";
  propertyVariable: string;
  dataType: WebsitePropertyValueDataType;
  matchMode: "includes" | "exact";
  isCaseSensitive: boolean;
  language: T[number];
};

export type WebsitePropertyQuery<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
> =
  | WebsitePropertyQueryNode<T>
  | { and: Array<WebsitePropertyQuery<T>> }
  | { or: Array<WebsitePropertyQuery<T>> };

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
export type Website<T extends ReadonlyArray<string> = ReadonlyArray<string>> = {
  uuid: string;
  belongsTo: { uuid: string; abbreviation: string } | null;
  metadata: Metadata<T>;
  publicationDateTime: Date | null;
  identification: Identification<T>;
  creators: Array<Person<T, "nested">>;
  license: License | null;
  items: Array<Webpage<T> | WebSegment<T>>;
  properties: {
    type: WebsiteType;
    status: "development" | "preview" | "production";
    privacy: "public" | "password" | "private";
    contact: { name: string; email: string | null } | null;
    loadingVariant: "spinner" | "skeleton" | "animation" | "none";
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
      items: Array<WebElement<T> | WebBlock<T>> | null;
    };
    footer: {
      isDisplayed: boolean;
      logoUuid: string | null;
      items: Array<WebElement<T> | WebBlock<T>> | null;
    };
    sidebar: {
      isDisplayed: boolean;
      items: Array<WebElement<T> | WebBlock<T>>;
      title: WebTitle<T>;
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
      isPublicationDateTimeDisplayed: boolean;
      isPersistentIdentifierDisplayed: boolean;
      iiifViewer: "universal-viewer" | "clover";
    };
    options: {
      contextTree: ContextTree<T> | null;
      scopes: Array<Scope<T>> | null;
      labels: { title: MultilingualString<T> | null };
      stylesheets: { properties: Array<StylesheetItem> };
    };
  };
};

/**
 * Represents a webpage with its title, slug, properties, items and subpages
 */
export type Webpage<T extends ReadonlyArray<string> = ReadonlyArray<string>> = {
  uuid: string;
  type: "page";
  title: MultilingualString<T>;
  slug: string;
  publicationDateTime: Date | null;
  items: Array<WebSegment<T> | WebElement<T> | WebBlock<T>>;
  properties: {
    width: "full" | "large" | "narrow" | "default";
    variant: "default" | "no-background";
    isBreadcrumbsDisplayed: boolean;
    isSidebarDisplayed: boolean;
    isDisplayedInNavbar: boolean;
    isNavbarSearchBarDisplayed: boolean;
    backgroundImage: WebImage<T> | null;
    cssStyles: {
      default: Array<Style>;
      tablet: Array<Style>;
      mobile: Array<Style>;
    };
  };
  webpages: Array<Webpage<T>>;
};

/**
 * Represents a web segment
 */
export type WebSegment<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
> = {
  uuid: string;
  type: "segment";
  title: MultilingualString<T>;
  slug: string;
  publicationDateTime: Date | null;
  items: Array<WebSegmentItem<T>>;
};

/**
 * Represents a web segment item
 */
export type WebSegmentItem<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
> = {
  uuid: string;
  type: "segment-item";
  title: MultilingualString<T>;
  slug: string;
  publicationDateTime: Date | null;
  items: Array<Webpage<T> | WebSegment<T>>;
};

/**
 * Represents a title with its label and variant
 */
export type WebTitle<T extends ReadonlyArray<string> = ReadonlyArray<string>> =
  {
    label: MultilingualString<T>;
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
export type WebElement<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
> = {
  uuid: string;
  type: "element";
  title: WebTitle<T>;
  cssStyles: {
    default: Array<Style>;
    tablet: Array<Style>;
    mobile: Array<Style>;
  };
} & WebElementComponent<T>;

/**
 * Union type of all possible web element components
 */
export type WebElementComponent<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
> =
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
      bibliographies: Array<Bibliography<T, "nested">>;
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
      label: MultilingualString<T> | null;
      startIcon: string | null;
      endIcon: string | null;
      image: WebImage<T> | null;
    }
  | {
      component: "collection";
      linkUuids: Array<string>;
      displayedProperties: Array<{
        uuid: string;
        label: MultilingualString<T> | null;
      }> | null;
      variant: "slide" | "table" | "card" | "tile" | "showcase";
      paginationVariant: "default" | "numeric";
      loadingVariant: "spinner" | "skeleton" | "animation" | "none";
      imageLayout: "top" | "bottom" | "start" | "end" | null;
      isSortDisplayed: boolean;
      isUsingQueryParams: boolean;
      filter: {
        isSidebarDisplayed: boolean;
        isResultsBarDisplayed: boolean;
        isInputDisplayed: boolean;
        isLimitedToInputFilter: boolean;
        isLimitedToLeafPropertyValues: boolean;
        sidebarSort: "default" | "alphabetical";
      };
      options: {
        scopes: Array<Scope<T>> | null;
        contextTree: ContextTree<T> | null;
        labels: { title: MultilingualString<T> | null };
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
      images: Array<WebImage<T>>;
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
      items: Array<{
        label: string;
        queries: Array<WebsitePropertyQuery<T>>;
        startIcon: string | null;
        endIcon: string | null;
      }>;
      options: {
        scopes: Array<Scope<T>> | null;
        contextTree: ContextTree<T> | null;
        labels: { title: MultilingualString<T> | null };
      };
      collectionProperties: {
        displayedProperties: Extract<
          WebElementComponent<T>,
          { component: "collection" }
        >["displayedProperties"];
        variant: Extract<
          WebElementComponent<T>,
          { component: "collection" }
        >["variant"];
        paginationVariant: Extract<
          WebElementComponent<T>,
          { component: "collection" }
        >["paginationVariant"];
        loadingVariant: Extract<
          WebElementComponent<T>,
          { component: "collection" }
        >["loadingVariant"];
        imageLayout: Extract<
          WebElementComponent<T>,
          { component: "collection" }
        >["imageLayout"];
      };
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
      content: MultilingualString<T>;
    }
  | { component: "timeline"; linkUuid: string }
  | { component: "video"; linkUuid: string; isChaptersDisplayed: boolean };

/**
 * Represents an image used in web elements
 */
export type WebImage<T extends ReadonlyArray<string> = ReadonlyArray<string>> =
  {
    uuid: string | null;
    label: MultilingualString<T> | null;
    description: MultilingualString<T> | null;
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
export type WebBlock<
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
  U extends WebBlockLayout = WebBlockLayout,
> = {
  uuid: string;
  type: "block";
  title: WebTitle<T>;
  items: U extends "accordion" ?
    Array<
      Extract<WebElement<T>, { component: "text" }> & {
        items: Array<WebElement<T> | WebBlock<T>>;
      }
    >
  : Array<WebElement<T> | WebBlock<T>>;
  properties: {
    default: {
      layout: U;
      wrap: "nowrap" | "wrap" | "wrap-reverse";
      /**
       * valid `gridTemplateColumns` or `gridTemplateRows` CSS property value
       */
      spacing: string | null;
      /**
       * `gap` CSS property value
       */
      gap: string | null;
      isAccordionEnabled: U extends "accordion" ? boolean : never;
      isAccordionExpandedByDefault: U extends "accordion" ? boolean : never;
      isAccordionSidebarDisplayed: U extends "accordion" ? boolean : never;
    };
    tablet: Partial<WebBlock<T>["properties"]["default"]> | null;
    mobile: Partial<WebBlock<T>["properties"]["default"]> | null;
  };
  cssStyles: {
    default: Array<Style>;
    tablet: Array<Style>;
    mobile: Array<Style>;
  };
};
