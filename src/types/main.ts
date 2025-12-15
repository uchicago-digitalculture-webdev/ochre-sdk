/**
 * Represents the core data structure containing item information and metadata
 */
export type Data<
  T extends DataCategory = DataCategory,
  U extends DataCategory = T extends "tree" ? Exclude<DataCategory, "tree">
  : T extends "set" ? DataCategory
  : never,
> = {
  uuid: string;
  belongsTo: { uuid: string; abbreviation: string };
  publicationDateTime: Date;
  item: Item<T, U>;
};

/**
 * Represents the category of the data
 */
export type DataCategory =
  | "resource"
  | "spatialUnit"
  | "concept"
  | "period"
  | "bibliography"
  | "person"
  | "propertyValue"
  | "text"
  | "tree"
  | "set";

/**
 * Represents the item of the data, with proper type narrowing based on category
 */
export type Item<
  T extends DataCategory = DataCategory,
  U extends DataCategory = T extends "tree" ? Exclude<DataCategory, "tree">
  : T extends "set" ? DataCategory
  : never,
> =
  T extends "resource" ? Resource
  : T extends "spatialUnit" ? SpatialUnit
  : T extends "concept" ? Concept
  : T extends "period" ? Period
  : T extends "bibliography" ? Bibliography
  : T extends "person" ? Person
  : T extends "propertyValue" ? PropertyValue
  : T extends "text" ? Text
  : T extends "tree" ? Tree<Exclude<U, "tree">>
  : T extends "set" ? Set<U>
  : | Resource
    | SpatialUnit
    | Concept
    | Period
    | Bibliography
    | Person
    | PropertyValue
    | Tree<Exclude<U, "tree">>
    | Set<U>;

/**
 * Basic identification information used across multiple types
 */
export type Identification = {
  label: string;
  abbreviation: string;
  code: string | null;
};

/**
 * Metadata information for items including project, publisher and language details
 */
export type Metadata = {
  project: {
    identification: Identification & { website: string | null };
  } | null;
  item: {
    identification: Identification;
    category: string;
    type: string;
    maxLength: number | null;
  } | null;
  dataset: string;
  publisher: string;
  languages: Array<string>;
  identifier: string;
  description: string;
};

/**
 * Represents a single item in a context hierarchy with its metadata
 */
export type ContextItem = {
  uuid: string;
  publicationDateTime: Date | null;
  number: number;
  content: string;
};

/**
 * Represents a node in the context tree containing tree, project and spatial unit information
 */
export type ContextNode = {
  tree: ContextItem;
  project: ContextItem;
  spatialUnit: Array<ContextItem>;
};

/**
 * Contains the full context information including nodes and display path
 */
export type Context = { nodes: Array<ContextNode>; displayPath: string };

/**
 * License information for content items
 */
export type License = { content: string; url: string };

/**
 * Represents a person (author, creator, etc.) with their identification and metadata
 */
export type Person = {
  uuid: string;
  category: "person";
  metadata: Metadata | null;
  publicationDateTime: Date | null;
  type: string | null;
  number: number | null;
  context: Context | null;
  availability: License | null;
  date: string | null;
  identification: Identification | null;
  image: Image | null;
  address: {
    country: string | null;
    city: string | null;
    state: string | null;
  } | null;
  description: string | null;
  coordinates: Array<Coordinate>;
  content: string | null;
  notes: Array<Note>;
  links: Array<Link>;
  events: Array<Event>;
  properties: Array<Property>;
  bibliographies: Array<Bibliography>;
};

/**
 * Represents a note with number, title and content
 */
export type Note = {
  number: number;
  title: string | null;
  date: string | null;
  authors: Array<Person>;
  content: string;
};

/**
 * Represents an image with its metadata and content
 */
export type Image = {
  publicationDateTime: Date | null;
  identification: Identification | null;
  url: string | null;
  htmlPrefix: string | null;
  content: string | null;
  widthPreview: number | null;
  heightPreview: number | null;
  width: number | null;
  height: number | null;
};

/**
 * Represents a link to another item with optional image and bibliographic references
 */
export type Link = {
  uuid: string | null;
  publicationDateTime: Date | null;
  type: string | null;
  category: string | null;
  identification: Identification | null;
  description: string | null;
  content: string | null;
  href: string | null;
  fileFormat: string | null;
  fileSize: number | null;
  image: {
    isInline: boolean;
    isPrimary: boolean;
    heightPreview: number;
    widthPreview: number;
    height: number;
    width: number;
  } | null;
  bibliographies: Array<Bibliography> | null;
};

/**
 * Represents a clickable/interactive area on an image map
 */
export type ImageMapArea = {
  uuid: string;
  publicationDateTime: Date | null;
  type: string;
  title: string;
  shape: "rectangle" | "circle" | "polygon";
  coords: Array<number>;
  slug: string | null;
};

/**
 * Contains image map areas and dimensions
 */
export type ImageMap = {
  area: Array<ImageMapArea>;
  width: number;
  height: number;
};

/**
 * Geographic coordinate with optional type and label
 */
export type Coordinate =
  | {
      type: "point";
      latitude: number;
      longitude: number;
      altitude: number | null;
      source:
        | { context: "self"; uuid: string; label: string }
        | { context: "related"; uuid: string; label: string; value: string }
        | {
            context: "inherited";
            item: { uuid: string; label: string };
            uuid: string;
            label: string;
          }
        | null;
    }
  | {
      type: "plane";
      minimum: { latitude: number; longitude: number };
      maximum: { latitude: number; longitude: number };
      source:
        | { context: "self"; uuid: string; label: string }
        | { context: "related"; uuid: string; label: string; value: string }
        | {
            context: "inherited";
            item: { uuid: string; label: string };
            uuid: string;
            label: string;
          }
        | null;
    };

/**
 * Represents an observation with notes, links and properties
 */
export type Observation = {
  number: number;
  date: string | null;
  observers: Array<string> | Array<Person>;
  notes: Array<Note>;
  links: Array<Link>;
  properties: Array<Property>;
  bibliographies: Array<Bibliography>;
};

/**
 * Represents an event with date, label and optional agent
 */
export type Event = {
  date: Date | null;
  label: string;
  agent: { uuid: string; content: string } | null;
  location: { uuid: string; content: string } | null;
  comment: string | null;
  value: string | null;
};

/**
 * Represents an interpretation with date and properties
 */
export type Interpretation = {
  date: string | null;
  number: number;
  links: Array<Link>;
  properties: Array<Property>;
  bibliographies: Array<Bibliography>;
};

/**
 * Represents a resource item with associated metadata, content and relationships
 */
export type Resource = {
  uuid: string;
  category: "resource";
  metadata: Metadata | null;
  publicationDateTime: Date | null;
  type: string;
  number: number;
  context: Context | null;
  license: License | null;
  copyright: string | null;
  watermark: string | null;
  identification: Identification;
  date: string | null;
  image: Image | null;
  creators: Array<Person>;
  notes: Array<Note>;
  description: string;
  coordinates: Array<Coordinate>;
  document: string | null;
  href: string | null;
  fileFormat: string | null;
  fileSize: number | null;
  imageMap: ImageMap | null;
  periods: Array<Period>;
  links: Array<Link>;
  reverseLinks: Array<Link>;
  properties: Array<Property>;
  bibliographies: Array<Bibliography>;
  resources: Array<Resource>;
};

/**
 * Represents a spatial unit with geographic coordinates and observations
 */
export type SpatialUnit = {
  uuid: string;
  category: "spatialUnit";
  metadata: Metadata | null;
  publicationDateTime: Date | null;
  number: number;
  context: Context | null;
  license: License | null;
  identification: Identification;
  image: Image | null;
  description: string | null;
  coordinates: Array<Coordinate>;
  mapData: { geoJSON: { multiPolygon: string; EPSG: number } } | null;
  observations: Array<Observation>;
  events: Array<Event>;
  properties: Array<Property>;
  bibliographies: Array<Bibliography>;
};

/**
 * Represents a concept with associated interpretations
 */
export type Concept = {
  uuid: string;
  category: "concept";
  metadata: Metadata | null;
  publicationDateTime: Date | null;
  number: number;
  license: License | null;
  context: Context | null;
  identification: Identification;
  image: Image | null;
  description: string | null;
  interpretations: Array<Interpretation>;
  properties: Array<Property>;
  bibliographies: Array<Bibliography>;
};

/**
 * Represents a set that can contain resources, spatial units and concepts
 */
export type Set<U extends DataCategory = DataCategory> = {
  uuid: string;
  category: "set";
  metadata: Metadata | null;
  itemCategory: U;
  publicationDateTime: Date | null;
  type: string;
  number: number;
  date: string | null;
  license: License | null;
  identification: Identification;
  isSuppressingBlanks: boolean;
  description: string;
  creators: Array<Person>;
  items: [DataCategory] extends [U] ? Array<Item>
  : U extends "resource" ? Array<Resource>
  : U extends "spatialUnit" ? Array<SpatialUnit>
  : U extends "concept" ? Array<Concept>
  : U extends "period" ? Array<Period>
  : U extends "bibliography" ? Array<Bibliography>
  : U extends "person" ? Array<Person>
  : U extends "propertyValue" ? Array<PropertyValue>
  : U extends "tree" ? Array<Tree<Exclude<DataCategory, "tree">>>
  : U extends "set" ? Array<Set<DataCategory>>
  : Array<Item>;
};

/**
 * Represents a bibliography entry with citation and publication information
 */
export type Bibliography = {
  uuid: string | null;
  zoteroId: string | null;
  category: "bibliography";
  metadata: Metadata | null;
  publicationDateTime: Date | null;
  type: string | null;
  number: number | null;
  identification: Identification | null;
  projectIdentification: Identification | null;
  context: Context | null;
  image: Image | null;
  citation: {
    details: string | null;
    format: string | null;
    short: string | null;
    long: string | null;
  };
  publicationInfo: { publishers: Array<Person>; startDate: Date | null };
  entryInfo: { startIssue: string; startVolume: string } | null;
  sourceResources: Array<
    Pick<
      Resource,
      | "uuid"
      | "category"
      | "publicationDateTime"
      | "type"
      | "identification"
      | "href"
    >
  >;
  periods: Array<Period>;
  authors: Array<Person>;
  properties: Array<Property>;
};

/**
 * Represents a time period with identification
 */
export type Period = {
  uuid: string;
  category: "period";
  metadata: Metadata | null;
  publicationDateTime: Date | null;
  type: string | null;
  number: number | null;
  identification: Identification;
  description: string | null;
};

/**
 * Represents a property value with type information
 */
export type PropertyValue = {
  uuid: string;
  category: "propertyValue";
  metadata: Metadata | null;
  number: number;
  publicationDateTime: Date | null;
  context: Context | null;
  availability: License | null;
  identification: Identification;
  date: string | null;
  creators: Array<Person>;
  description: string;
  notes: Array<Note>;
  links: Array<Link>;
};

export type PropertyValueContentType =
  | "string"
  | "integer"
  | "decimal"
  | "boolean"
  | "date"
  | "dateTime"
  | "time"
  | "coordinate"
  | "IDREF";

/**
 * Represents a property value with type information
 */
export type PropertyValueContent<T extends PropertyValueContentType> = {
  content:
    | (T extends "integer" ? number
      : T extends "decimal" ? number
      : T extends "time" ? number
      : T extends "boolean" ? boolean
      : // : T extends "date" ? Date
        // : T extends "dateTime" ? Date
        string)
    | null;
  dataType: T;
  label: string | null;
  isUncertain: boolean;
  unit: string | null;
  category: string | null;
  type: string | null;
  uuid: string | null;
  publicationDateTime: Date | null;
  href: string | null;
  slug: string | null;
};

/**
 * Represents a property with label, values and nested properties
 */
export type Property<
  T extends PropertyValueContentType = PropertyValueContentType,
> = {
  uuid: string;
  label: string;
  values: Array<PropertyValueContent<T>>;
  comment: string | null;
  properties: Array<Property>;
};

/**
 * Represents a resource item with associated metadata, content and relationships
 */
export type Text = {
  uuid: string;
  category: "text";
  metadata: Metadata | null;
  publicationDateTime: Date | null;
  type: string | null;
  language: string | null;
  number: number;
  context: Context | null;
  license: License | null;
  copyright: string | null;
  watermark: string | null;
  identification: Identification;
  image: Image | null;
  creators: Array<Person>;
  editors: Array<Person>;
  notes: Array<Note>;
  description: string;
  periods: Array<Period>;
  links: Array<Link>;
  reverseLinks: Array<Link>;
  properties: Array<Property>;
  bibliographies: Array<Bibliography>;
  sections: Array<Section>;
};

/**
 * Represents a section of a text
 */
export type Section = {
  uuid: string;
  variant: "translation" | "phonemic";
  type: string;
  identification: Identification;
  projectIdentification: Identification | null;
};

/**
 * Represents a tree structure containing resources, spatial units and concepts
 */
export type Tree<
  U extends Exclude<DataCategory, "tree"> = Exclude<DataCategory, "tree">,
> = {
  uuid: string;
  category: "tree";
  metadata: Metadata | null;
  publicationDateTime: Date | null;
  type: string;
  number: number;
  date: string | null;
  license: License | null;
  identification: Identification;
  creators: Array<Person>;
  properties: Array<Property>;
  items: [Exclude<DataCategory, "tree">] extends [U] ? Array<Item>
  : U extends "resource" ? Array<Resource>
  : U extends "spatialUnit" ? Array<SpatialUnit>
  : U extends "concept" ? Array<Concept>
  : U extends "period" ? Array<Period>
  : U extends "bibliography" ? Array<Bibliography>
  : U extends "person" ? Array<Person>
  : U extends "propertyValue" ? Array<PropertyValue>
  : U extends "text" ? Array<Text>
  : U extends "set" ? Array<Set<DataCategory>>
  : Array<Item>;
};

/**
 * Represents a gallery with its identification, project identification, resources and max length
 */
export type Gallery = {
  identification: Identification;
  projectIdentification: Identification;
  resources: Array<Resource>;
  maxLength: number;
};

/**
 * Represents a property query item with its item and value UUIDs
 */
export type PropertyQueryItem = {
  value: {
    uuid: string | null;
    category: string | null;
    type: string | null;
    dataType: string;
    publicationDateTime: string | null;
    content: string;
    label: string | null;
  };
  resultUuids: Array<string>;
};

/**
 * Represents a metadata object given a UUID
 */
export type UuidMetadata = {
  item: { uuid: string; name: string; type: string };
  project: { name: string; website: string | null };
} | null;

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
 * Represents a website with its properties and elements
 */
export type Website = {
  uuid: string;
  version: 1 | 2;
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
    cssStyles: {
      default: Array<Style>;
      tablet: Array<Style>;
      mobile: Array<Style>;
    };
  } | null;
  properties: {
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
    headerSearchBarBoundElementUuid: string | null;
    supportsThemeToggle: boolean;
    defaultTheme: "light" | "dark" | null;
    logoUrl: string | null;
    itemPage: {
      iiifViewer: "universal-viewer" | "clover";
      options: { contexts: PropertyContexts };
    };
  };
};

/**
 * Represents a webpage with its title, slug, properties, items and subpages
 */
export type Webpage = {
  title: string;
  slug: string;
  properties: {
    displayedInHeader: boolean;
    width: "full" | "large" | "narrow" | "default";
    variant: "default" | "no-background";
    backgroundImageUrl: string | null;
    isBreadcrumbsDisplayed: boolean;
    isSidebarDisplayed: boolean;
    isHeaderSearchBarDisplayed: boolean;
    cssStyles: {
      default: Array<Style>;
      tablet: Array<Style>;
      mobile: Array<Style>;
    };
  };
  items: Array<WebElement | WebBlock>;
  webpages: Array<Webpage>;
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
      resourceId: string;
      fileSize: number | null;
      isInteractive: boolean;
      isControlsDisplayed: boolean;
    }
  | {
      component: "advanced-search";
      boundElementUuid: string | null;
      href: string | null;
    }
  | { component: "annotated-document"; documentId: string }
  | {
      component: "annotated-image";
      imageUuid: string;
      isFilterDisplayed: boolean;
      isOptionsDisplayed: boolean;
      isAnnotationHighlightsDisplayed: boolean;
      isAnnotationTooltipsDisplayed: boolean;
    }
  | {
      component: "audio-player";
      audioId: string;
      isSpeedControlsDisplayed: boolean;
      isVolumeControlsDisplayed: boolean;
      isSeekBarDisplayed: boolean;
    }
  | {
      component: "bibliography";
      itemUuids: Array<string>;
      bibliographies: Array<Bibliography>;
      layout: "long" | "short";
      isSourceDocumentDisplayed: boolean;
    }
  | {
      component: "entries";
      entriesId: string;
      variant: "entry" | "item";
      isFilterDisplayed: boolean;
    }
  | {
      component: "button";
      variant: "default" | "transparent" | "link";
      href: string;
      isExternal: boolean;
      label: string;
      startIcon: string | null;
      endIcon: string | null;
      image: WebImage | null;
    }
  | {
      component: "collection";
      collectionIds: Array<string>;
      displayedProperties: Array<{ uuid: string; label: string }> | null;
      variant: "full" | "highlights";
      itemVariant: "detailed" | "card" | "tile";
      paginationVariant: "default" | "numeric";
      layout: "image-top" | "image-bottom" | "image-start" | "image-end";
      isSortDisplayed: boolean;
      isUsingQueryParams: boolean;
      filter: {
        isSidebarDisplayed: boolean;
        isResultsBarDisplayed: boolean;
        isMapDisplayed: boolean;
        isInputDisplayed: boolean;
        sidebarSort: "default" | "alphabetical";
      };
      options: {
        attributeFilters: { bibliographies: boolean; periods: boolean };
        scopes: Array<{
          uuid: string;
          type: string;
          identification: Identification;
        }>;
        contexts: PropertyContexts;
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
      iiifId: string;
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
        isLinkDisplayed: boolean;
      } | null;
    }
  | {
      component: "image-gallery";
      galleryId: string;
      isFilterDisplayed: boolean;
    }
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
  | { component: "network-graph" }
  | {
      component: "query";
      queries: Array<{
        label: string;
        propertyUuids: Array<string>;
        startIcon: string | null;
        endIcon: string | null;
      }>;
      scopes: Array<{
        uuid: string;
        type: string;
        identification: Identification;
      }>;
    }
  | {
      component: "search-bar";
      placeholder: string | null;
      baseFilterQueries: string | null;
      boundElementUuid: string | null;
      href: string | null;
    }
  | { component: "table"; tableId: string }
  | {
      component: "text";
      variant:
        | { name: "title" | "block" | "banner" }
        | { name: "paragraph"; size: "xs" | "sm" | "md" | "lg" }
        | { name: "label"; size: "xs" | "sm" | "md" | "lg" | "xl" }
        | { name: "heading"; size: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" }
        | { name: "display"; size: "xs" | "sm" | "md" | "lg" };
      content: string;
    }
  | { component: "timeline"; timelineId: string }
  | { component: "video"; isChaptersDislayed: boolean };

/**
 * Represents an image used in web elements
 */
export type WebImage = {
  uuid: string | null;
  url: string;
  label: string | null;
  description: string | null;
  width: number;
  height: number;
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
