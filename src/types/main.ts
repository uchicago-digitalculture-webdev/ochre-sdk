import type { Language } from "iso-639-3";

/**
 * Represents the core data structure containing item information and metadata
 */
export type Data = {
  uuid: string;
  belongsTo: {
    uuid: string;
    abbreviation: string;
  };
  publicationDateTime: Date;
  metadata: Metadata;
  item:
    | Tree
    | Set
    | Resource
    | SpatialUnit
    | Concept
    | Period
    | Bibliography
    | Person;
};

/**
 * Basic identification information used across multiple types
 */
export type Identification = {
  label: string;
  abbreviation: string;
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
  languages: Array<Language["iso6393"]>;
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
export type Context = {
  nodes: Array<ContextNode>;
  displayPath: string;
};

/**
 * License information for content items
 */
export type License = {
  content: string;
  url: string;
};

/**
 * Represents a person (author, creator, etc.) with their identification and metadata
 */
export type Person = {
  uuid: string;
  publicationDateTime: Date | null;
  type: string | null;
  date: Date | null;
  identification: Identification | null;
  content: string | null;
};

/**
 * Represents a note with number, title and content
 */
export type Note = {
  number: number;
  title: string | null;
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
  uuid: string;
  publicationDateTime: Date | null;
  type: string | null;
  category:
    | "resource"
    | "spatialUnit"
    | "concept"
    | "set"
    | "tree"
    | "person"
    | "bibliography"
    | "epigraphicUnit"
    | null;
  identification: Identification | null;
  content: string | null;
  href: string | null;
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
  shape: "rectangle" | "polygon";
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
 * Geographic coordinates with optional type and label
 */
export type Coordinates = {
  latitude: number;
  longitude: number;
  type: string | null;
  label: string | null;
};

/**
 * Represents an observation with notes, links and properties
 */
export type Observation = {
  number: number;
  date: Date | null;
  observers: Array<string>;
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
  agent: {
    uuid: string;
    content: string;
  } | null;
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
 * Represents a document with content and footnotes
 */
export type Document = {
  content: string;
  footnotes: Array<Footnote>;
};

/**
 * Represents a footnote in a document
 */
export type Footnote = {
  uuid: string;
  label: string;
  content: string;
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
  document: Document | null;
  href: string | null;
  imageMap: ImageMap | null;
  periods: Array<Period>;
  format: string | null;
  links: Array<Link>;
  reverseLinks: Array<Link>;
  properties: Array<Property>;
  citedBibliographies: Array<Bibliography>;
  resources: Array<NestedResource>;
};

/**
 * A nested version of Resource type without certain metadata fields
 */
export type NestedResource = Omit<
  Resource,
  "publicationDateTime" | "license" | "copyright"
>;

/**
 * Represents a spatial unit with geographic coordinates and observations
 */
export type SpatialUnit = {
  uuid: string;
  category: "spatialUnit";
  publicationDateTime: Date | null;
  type: string;
  number: number;
  context: Context | null;
  license: License | null;
  identification: Identification;
  image: Image | null;
  description: string | null;
  coordinates: Coordinates | null;
  observations: Array<Observation>;
  events: Array<Event>;
};

/**
 * A nested version of SpatialUnit type without certain metadata fields
 */
export type NestedSpatialUnit = Omit<
  SpatialUnit,
  "publicationDateTime" | "license" | "observations" | "events"
> & {
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
 * A nested version of Concept type without certain metadata fields
 */
export type NestedConcept = Omit<Concept, "publicationDateTime" | "license">;

/**
 * Represents a set that can contain resources, spatial units and concepts
 */
export type Set = {
  uuid: string;
  category: "set";
  publicationDateTime: Date | null;
  type: string;
  number: number;
  date: Date | null;
  license: License | null;
  identification: Identification;
  isSuppressingBlanks: boolean;
  description: string;
  creators: Array<Person>;
  items: {
    resources: Array<NestedResource>;
    spatialUnits: Array<NestedSpatialUnit>;
    concepts: Array<NestedConcept>;
    periods: Array<Period>;
    bibliographies: Array<Bibliography>;
    persons: Array<Person>;
  };
};

/**
 * Represents a bibliography entry with citation and publication information
 */
export type Bibliography = {
  uuid: string;
  category: "bibliography";
  publicationDateTime: Date | null;
  type: string | null;
  number: number | null;
  identification: Identification | null;
  projectIdentification: Identification | null;
  context: Context | null;
  citation: {
    format: string | null;
    short: string | null;
    long: string | null;
  };
  publicationInfo: {
    publishers: Array<Person>;
    startDate: Date | null;
  };
  entryInfo: {
    startIssue: string;
    startVolume: string;
  } | null;
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
 * Valid types for property values
 */
export type PropertyValueType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "date"
  | "dateTime"
  | "time"
  | "IDREF";

/**
 * Represents a property value with type information
 */
export type PropertyValue = {
  content: string;
  type: PropertyValueType;
  category: string | null;
  uuid: string | null;
  publicationDateTime: Date | null;
};

/**
 * Represents a property with label, values and nested properties
 */
export type Property = {
  label: string;
  values: Array<PropertyValue>;
  comment: string | null;
  properties: Array<Property>;
};

/**
 * Represents a tree structure containing resources, spatial units and concepts
 */
export type Tree = {
  uuid: string;
  category: "tree";
  publicationDateTime: Date | null;
  type: string;
  number: number;
  date: Date | null;
  license: License | null;
  identification: Identification;
  creators: Array<Person>;
  items: {
    resources: Array<Resource>;
    spatialUnits: Array<SpatialUnit>;
    concepts: Array<Concept>;
    periods: Array<Period>;
    bibliographies: Array<Bibliography>;
    persons: Array<Person>;
  };
  properties: Array<Property>;
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
 * Represents a website with its properties and elements
 */
export type Website = {
  uuid: string;
  publicationDateTime: Date | null;
  identification: Identification;
  project: {
    name: string;
    website: string | null;
  };
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
  isHeaderDisplayed: boolean;
  headerVariant: "default" | "floating" | "inline";
  headerAlignment: "start" | "center" | "end";
  isHeaderProjectDisplayed: boolean;
  isFooterDisplayed: boolean;
  isSidebarDisplayed: boolean;
  supportsThemeToggle: boolean;
  searchCollectionUuid: string | null;
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
    };
  };
  cssStyles: Array<Style>;
  cssStylesMobile: Array<Style>;
} & WebElementComponent;

/**
 * Union type of all possible web element components
 */
export type WebElementComponent =
  | {
      component: "annotated-document";
      document: Document;
    }
  | { component: "annotated-image"; imageUuid: string; isSearchable: boolean }
  | {
      component: "bibliography";
      bibliographies: Array<Bibliography>;
      layout: "long" | "short";
    }
  | { component: "blog"; blogId: string }
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
      layout: "image-top" | "image-bottom" | "image-start" | "image-end";
      isSearchable: boolean;
    }
  | { component: "empty-space"; height: string | null; width: string | null }
  | { component: "iframe"; url: string }
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
      captionLayout: "top" | "bottom" | "suppress";
      altTextSource: "name" | "abbreviation" | "description";
      isTransparentBackground: boolean;
      isCover: boolean;
      carouselOptions: {
        secondsPerImage: number;
      } | null;
    }
  | { component: "image-gallery"; galleryId: string; isSearchable: boolean }
  | { component: "item-gallery"; galleryId: string; isSearchable: boolean }
  | { component: "n-columns"; columns: Array<WebElement> }
  | { component: "n-rows"; rows: Array<WebElement> }
  | { component: "network-graph" }
  | { component: "table"; tableId: string }
  | {
      component: "text";
      variant: "title" | "block" | "banner";
      heading: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | null;
      content: string;
    }
  | {
      component: "text-image";
      variant: "title" | "block" | "banner";
      image: WebImage;
      imageQuality: "high" | "low";
      layout:
        | "image-top"
        | "image-bottom"
        | "image-start"
        | "image-end"
        | "image-background";
      captionSource: "name" | "abbreviation" | "description";
      captionLayout: "top" | "bottom" | "suppress";
      altTextSource: "name" | "abbreviation" | "description";
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
  width: number;
  height: number;
};

/**
 * Represents a CSS style with label and value
 */
export type Style = {
  label: string;
  value: string;
};

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
  };
  propertiesMobile: Record<string, string> | null;
  cssStyles: Array<Style>;
  cssStylesMobile: Array<Style>;
};
