/**
 * Represents the core data structure containing item information and metadata
 */
export type Data<T extends DataCategory, U extends DataCategory> = {
  uuid: string;
  belongsTo: { uuid: string; abbreviation: string };
  publicationDateTime: Date;
  metadata: Metadata;
  item:
    | Tree<T, U>
    | Set<T>
    | Resource
    | SpatialUnit
    | Concept
    | Period
    | Bibliography
    | Person
    | PropertyValue;
};

export type DataCategory =
  | "tree"
  | "set"
  | "resource"
  | "spatialUnit"
  | "concept"
  | "period"
  | "bibliography"
  | "person"
  | "propertyValue";

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
  publicationDateTime: Date | null;
  type: string | null;
  number: number | null;
  context: Context | null;
  availability: License | null;
  date: Date | null;
  identification: Identification | null;
  address: {
    country: string | null;
    city: string | null;
    state: string | null;
  } | null;
  description: string | null;
  coordinates: Coordinates;
  content: string | null;
  notes: Array<Note>;
  events: Array<Event>;
  properties: Array<Property>;
};

/**
 * Represents a note with number, title and content
 */
export type Note = { number: number; title: string | null; content: string };

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
 * Geographic coordinates item with optional type and label
 */
export type CoordinatesItem =
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
 * Geographic coordinates with optional type and label
 */
export type Coordinates = Array<CoordinatesItem>;

/**
 * Represents an observation with notes, links and properties
 */
export type Observation = {
  number: number;
  date: Date | null;
  observers: Array<string> | Array<Person>;
  notes: Array<Note>;
  links: Array<Link>;
  properties: Array<Property>;
};

/**
 * Represents an event with date, label and optional agent
 */
export type Event = {
  date: Date | null;
  label: string;
  agent: { uuid: string; content: string } | null;
};

/**
 * Represents an interpretation with date and properties
 */
export type Interpretation = {
  date: Date | null;
  number: number;
  properties: Array<Property>;
};

/**
 * Represents a resource item with associated metadata, content and relationships
 */
export type Resource = {
  uuid: string;
  category: "resource";
  publicationDateTime: Date | null;
  type: string;
  number: number;
  context: Context | null;
  license: License | null;
  copyright: string | null;
  identification: Identification;
  date: Date | null;
  image: Image | null;
  creators: Array<Person>;
  notes: Array<Note>;
  description: string;
  coordinates: Coordinates;
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
  publicationDateTime: Date | null;
  number: number;
  context: Context | null;
  license: License | null;
  identification: Identification;
  image: Image | null;
  description: string | null;
  coordinates: Coordinates;
  mapData: { geoJSON: { multiPolygon: string; EPSG: number } } | null;
  observations: Array<Observation>;
  events: Array<Event>;
  properties: Array<Property>;
};

/**
 * Represents a concept with associated interpretations
 */
export type Concept = {
  uuid: string;
  category: "concept";
  publicationDateTime: Date | null;
  number: number;
  license: License | null;
  context: Context | null;
  identification: Identification;
  interpretations: Array<Interpretation>;
};

/**
 * Represents a set that can contain resources, spatial units and concepts
 */
export type Set<T extends DataCategory> = {
  uuid: string;
  category: "set";
  itemCategory: T;
  publicationDateTime: Date | null;
  type: string;
  number: number;
  date: Date | null;
  license: License | null;
  identification: Identification;
  isSuppressingBlanks: boolean;
  description: string;
  creators: Array<Person>;
  items: T extends "resource" ? Array<Resource>
  : T extends "spatialUnit" ? Array<SpatialUnit>
  : T extends "concept" ? Array<Concept>
  : T extends "period" ? Array<Period>
  : T extends "bibliography" ? Array<Bibliography>
  : T extends "person" ? Array<Person>
  : T extends "propertyValue" ? Array<PropertyValue>
  : never;
};

/**
 * Represents a bibliography entry with citation and publication information
 */
export type Bibliography = {
  uuid: string | null;
  zoteroId: string | null;
  category: "bibliography";
  publicationDateTime: Date | null;
  type: string | null;
  number: number | null;
  identification: Identification | null;
  projectIdentification: Identification | null;
  context: Context | null;
  citation: {
    details: string | null;
    format: string | null;
    short: string | null;
    long: string | null;
  };
  publicationInfo: { publishers: Array<Person>; startDate: Date | null };
  entryInfo: { startIssue: string; startVolume: string } | null;
  source: {
    resource: Pick<
      Resource,
      "uuid" | "publicationDateTime" | "type" | "identification"
    > | null;
    documentUrl: string | null;
  };
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
  number: number;
  publicationDateTime: Date | null;
  context: Context | null;
  availability: License | null;
  identification: Identification;
  date: Date | null;
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
 * Represents a tree structure containing resources, spatial units and concepts
 */
export type Tree<T extends DataCategory, U extends DataCategory> = {
  uuid: string;
  category: "tree";
  publicationDateTime: Date | null;
  type: string;
  number: number;
  date: Date | null;
  license: License | null;
  identification: Identification;
  creators: Array<Person>;
  properties: Array<Property>;
  items: T extends "resource" ? Array<Resource>
  : T extends "spatialUnit" ? Array<SpatialUnit>
  : T extends "concept" ? Array<Concept>
  : T extends "period" ? Array<Period>
  : T extends "bibliography" ? Array<Bibliography>
  : T extends "person" ? Array<Person>
  : T extends "propertyValue" ? Array<PropertyValue>
  : T extends "set" ? Array<Set<U>>
  : never;
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
 * Represents a website with its properties and elements
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
  searchOptions: {
    filters: Array<{ uuid: string; type: string }>;
    scopes: Array<{
      uuid: string;
      type: string;
      identification: Identification;
    }>;
  };
  globalOptions: {
    contexts: {
      flatten: Array<LevelContext>;
      suppress: Array<LevelContext>;
      filter: Array<LevelContext>;
      detail: Array<LevelContext>;
      download: Array<LevelContext>;
      label: Array<LevelContext>;
    };
  };
};

/**
 * Properties for configuring website display and styling
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
  defaultTheme: "light" | "dark" | null;
  logoUrl: string | null;
};

export type Webpage = {
  title: string;
  slug: string;
  properties: WebpageProperties;
  items: Array<WebElement | WebBlock>;
  webpages: Array<Webpage>;
};

/**
 * Properties for configuring webpage display and styling
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
 * Base properties for web elements
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
      isCountDisplayed: boolean;
    };
  };
  isDisplayedInBlockSectionSidebar: boolean;
  cssStyles: Array<Style>;
  cssStylesMobile: Array<Style>;
} & WebElementComponent;

/**
 * Union type of all possible web element components
 */
export type WebElementComponent =
  | { component: "annotated-document"; documentId: string }
  | {
      component: "annotated-image";
      imageUuid: string;
      isFilterDisplayed: boolean;
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
      bibliographies: Array<Bibliography>;
      layout: "long" | "short";
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
    }
  | {
      component: "collection";
      collectionId: string;
      variant: "full" | "highlights";
      itemVariant: "detailed" | "card" | "tile";
      paginationVariant: "default" | "numeric";
      isFilterDisplayed: boolean;
      layout: "image-top" | "image-bottom" | "image-start" | "image-end";
    }
  | { component: "empty-space"; height: string | null; width: string | null }
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
    }
  | {
      component: "search-bar";
      variant: "default" | "full";
      placeholder: string | null;
    }
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
 * Represents an image used in web elements
 */
export type WebImage = {
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

/**
 * Represents a block of vertical or horizontal content alignment
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

export type WebSectionSidebarItem = {
  uuid: string;
  type: "block" | "element";
  name: string | null;
  items: Array<WebSectionSidebarItem> | null;
};
