import type { MultilingualString } from "#/parsers/multilingual.js";
import type {
  Bibliography,
  Identification,
  ItemCategory,
  LanguageCodes,
  License,
  Metadata,
  Person,
  Prettify,
  QueryablePropertyValueDataType,
} from "#/types/index.js";

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
export type ContextTreeLevel<T extends LanguageCodes = LanguageCodes> = {
  context: Array<ContextTreeLevelItem>;
  identification: Identification<T>;
  type: string;
};

/**
 * Represents a filter context tree level with a context item
 */
export type ContextTreeFilterLevel<T extends LanguageCodes = LanguageCodes> = {
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
export type ContextTree<T extends LanguageCodes = LanguageCodes> = {
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
export type Scope<T extends LanguageCodes = LanguageCodes> = {
  uuid: string;
  type: string;
  identification: Identification<T>;
};

/**
 * Represents a stylesheet item with its UUID and category
 */
export type StylesheetCategory = Extract<
  ItemCategory,
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

export type WebsitePropertyQueryNode<T extends LanguageCodes = LanguageCodes> =
  {
    target: "property";
    propertyVariable: string;
    dataType: QueryablePropertyValueDataType;
    matchMode: "includes" | "exact";
    isCaseSensitive: boolean;
    language: T[number];
  };

export type WebsitePropertyQuery<T extends LanguageCodes = LanguageCodes> =
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
 * Represents a sidebar with its title, items, layout and responsive styles
 */
export type WebSidebar<T extends LanguageCodes = LanguageCodes> = {
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
};

/**
 * Represents a website with its properties and items
 */
export type Website<T extends LanguageCodes = LanguageCodes> = {
  uuid: string;
  type: "website" | "segment";
  belongsTo: { uuid: string; abbreviation: string } | null;
  metadata: Metadata<T>;
  publicationDateTime: Date | null;
  identification: Identification<T>;
  creators: Array<Person<T, "embedded">>;
  license: License | null;
  items: Array<Webpage<T>>;
  properties: {
    type: WebsiteType;
    status: "development" | "preview" | "production";
    versionLabel:
      | "experimental"
      | "alpha"
      | "beta"
      | "test"
      | "staging"
      | "pre-release"
      | "release";
    privacy: "public" | "password" | "password-ochre";
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
    sidebar: WebSidebar<T> | null;
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

export type WebsiteSegment<T extends LanguageCodes = LanguageCodes> =
  Website<T> & { type: "segment" };

/**
 * Represents a webpage with its title, slug, properties, items and subpages
 */
export type Webpage<T extends LanguageCodes = LanguageCodes> = {
  uuid: string;
  type: "page";
  title: MultilingualString<T>;
  slug: string;
  publicationDateTime: Date | null;
  items: Array<WebElement<T> | WebBlock<T>>;
  segments: Array<WebsiteSegment<T>>;
  properties: {
    width: "full" | "large" | "narrow" | "default";
    variant: "default" | "no-background";
    isBreadcrumbsDisplayed: boolean;
    isSidebarDisplayed: boolean;
    isDisplayedInNavbar: boolean;
    isNavbarSearchBarDisplayed: boolean;
    redirect:
      | { type: "url"; href: string; isExternal: boolean }
      | { type: "page"; slug: string; uuid: string }
      | { type: "item"; uuid: string; pageType: "item" | "entry" }
      | null;
    backgroundImage: WebImage<T> | null;
    sidebar: WebSidebar<T> | null;
    cssStyles: {
      default: Array<Style>;
      tablet: Array<Style>;
      mobile: Array<Style>;
    };
  };
  webpages: Array<Webpage<T>>;
};

/**
 * Represents a title with its label and variant
 */
export type WebTitle<T extends LanguageCodes = LanguageCodes> = {
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
export type WebElement<T extends LanguageCodes = LanguageCodes> = {
  uuid: string;
  language: string | null;
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
export type WebElementComponent<T extends LanguageCodes = LanguageCodes> =
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
      bibliographies: Array<Bibliography<T, "embedded">>;
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
      isRelative: boolean;
      label: MultilingualString<T> | null;
      startIcon: string | null;
      endIcon: string | null;
      image: WebImage<T> | null;
      elements: Array<WebElement<T>>;
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
      isImagePlaceholderDisplayed: boolean;
      minimumColumnCount: number | null;
      maximumColumnCount: number | null;
      expectedItemCount: number | null;
      isSortDisplayed: boolean;
      isUsingQueryParams: boolean;
      isInteractive: boolean;
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
      width: string | null;
      height: string | null;
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
        label: MultilingualString<T>;
        queries: Array<WebsitePropertyQuery<T>>;
        startIcon: string | null;
        endIcon: string | null;
      }>;
      options: {
        scopes: Array<Scope<T>> | null;
        contextTree: ContextTree<T> | null;
        labels: { title: MultilingualString<T> | null };
      };
      collectionProperties: Prettify<
        Partial<
          Omit<
            Extract<WebElementComponent<T>, { component: "collection" }>,
            "component" | "linkUuids" | "options"
          >
        >
      >;
    }
  | {
      component: "search-bar";
      queryVariant: "submit" | "change";
      placeholder: MultilingualString<T> | null;
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

export type WebElementComponentName = WebElementComponent["component"];

export type WebElementComponentOf<
  U extends WebElementComponentName,
  T extends LanguageCodes = LanguageCodes,
> = Extract<WebElementComponent<T>, { component: U }>;

export type WebElementOf<
  U extends WebElementComponentName,
  T extends LanguageCodes = LanguageCodes,
> = Extract<WebElement<T>, { component: U }>;

/**
 * Represents an image used in web elements
 */
export type WebImage<T extends LanguageCodes = LanguageCodes> = {
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

export type WebBlockItem<T extends LanguageCodes = LanguageCodes> =
  | WebElement<T>
  | WebBlock<T>;

export type WebAccordionItem<T extends LanguageCodes = LanguageCodes> = {
  uuid: string;
  type: "accordion-item";
  trigger: WebElementOf<"text", T>;
  items: Array<WebBlockItem<T>>;
};

/**
 * Represents a block of vertical or horizontal content alignment
 */
export type WebBlock<
  T extends LanguageCodes = LanguageCodes,
  U extends WebBlockLayout = WebBlockLayout,
> = {
  uuid: string;
  language: string | null;
  type: "block";
  title: WebTitle<T>;
  items: U extends "accordion"
    ? Array<WebAccordionItem<T> | WebBlockItem<T>>
    : Array<WebBlockItem<T>>;
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

export type WebBlockByLayout<
  U extends WebBlockLayout = WebBlockLayout,
  T extends LanguageCodes = LanguageCodes,
> = WebBlock<T, U>;

export type AccordionWebBlock<T extends LanguageCodes = LanguageCodes> =
  WebBlock<T, "accordion">;

export type WebsiteMetadata<T extends LanguageCodes = LanguageCodes> = {
  uuid: string;
  belongsTo: { uuid: string; abbreviation: string } | null;
  identification: Identification<T>;
  description: string;
  webpageTitle: MultilingualString<T> | null;
  properties: {
    icon: { faviconUuid: string | null; appleTouchIconUuid: string | null };
  };
};

export type ProtectedWebsite<T extends LanguageCodes = LanguageCodes> = {
  uuid: string;
  identification: Identification<T>;
  properties: { privacy: "password" | "password-ochre" };
};
