type Prettify<T> = { [K in keyof T]: T[K] } & {};

/**
 * Represents the core data structure containing item information and metadata
 */
export type Data<
  T extends DataCategory,
  U extends T extends "tree" | "set" ? ItemsDataCategory : never = never,
> = {
  uuid: string;
  belongsTo: { uuid: string; abbreviation: string };
  publicationDateTime: Date;
  metadata: Metadata;
  items: Array<Item<T, U>>;
};

/**
 * Represents the category of an item in OCHRE
 */
export type DataCategory =
  | "tree"
  | "bibliography"
  | "concept"
  | "spatialUnit"
  | "period"
  | "person"
  | "propertyValue"
  | "propertyVariable"
  | "resource"
  | "set";

/**
 * Represents the category of items in a Set or Tree
 */
export type ItemsDataCategory = Exclude<DataCategory, "tree" | "set">;

/**
 * Represents the category of items in a heading
 */
export type HeadingDataCategory = Exclude<
  DataCategory,
  "tree" | "bibliography" | "spatialUnit" | "concept" | "period"
>;

/**
 * Represents the category of items that are non-recursive
 */
export type NonRecursiveDataCategory = Exclude<
  DataCategory,
  "tree" | "person" | "propertyValue" | "propertyVariable" | "set"
>;

/**
 * Metadata information for items including project, publisher and language details
 */
export type Metadata = {
  dataset: string;
  description: string;
  publisher: string;
  identifier: string;
  project: {
    identification: Identification & { website: string | null };
  } | null;
  item: {
    identification: Identification;
    category: string;
    type: string;
    maxLength: number | null;
  } | null;
  languages: Array<{ name: string; isDefault: boolean }>;
};

/**
 * Basic identification information used across multiple types
 */
export type Identification = { label: string; abbreviation: string | null };

/**
 * Represents a single item in a context hierarchy with its metadata
 */
export type ContextItem = {
  uuid: string;
  publicationDateTime: Date | null;
  index: number;
  content: string;
};

/**
 * Represents a node in the context tree containing tree, project and spatial unit information
 */
export type ContextNode<T extends DataCategory> = {
  tree: ContextItem;
  project: ContextItem;
} & Record<T, Array<ContextItem>>;

/**
 * Contains the full context information including nodes and display path
 */
export type Context<T extends DataCategory> = {
  nodes: Array<ContextNode<T>>;
  displayPath: string;
};

/**
 * License information for content items
 */
export type License = { content: string; target: string };

/**
 * Represents an event with date, label and optional agent
 */
export type Event = {
  date: Date | null;
  label: string;
  comment: string | null;
  agent: Person | null;
};

/**
 * Geographic coordinates item with optional type and label
 */
export type Coordinates =
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
 * Represents a link to another item
 */
export type Link = Prettify<
  {
    uuid: string;
    publicationDateTime: Date | null;
    identification: Identification | null;
    type: string | null;
  } & (
    | {
        category: "resource";
        content: string | null;
        href: string | null;
        fileFormat: string | null;
        fileSize: number | null;
        height: number | null;
        width: number | null;
        image: {
          href: string | null;
          htmlImgSrcPrefix: string | null;
          content: string | null;
          height: number;
          width: number;
        } | null;
      }
    | { category: Exclude<DataCategory, "resource"> }
  )
>;

/**
 * Represents the note of an item in OCHRE
 */
export type Note = {
  number: number;
  title: string | null;
  content: string;
  authors: Array<Person>;
};

/**
 * Represents a heading under a Tree
 */
export type Heading<T extends HeadingDataCategory> = {
  name: string;
  headings: Array<Heading<T>>;
  items: Array<Item<T>>;
};

/**
 * Represents a generic item in OCHRE
 */
export type Item<
  T extends DataCategory,
  U extends T extends "tree" | "set" ? ItemsDataCategory : never = never,
> = {
  uuid: string;
  category: T;
  publicationDateTime: Date;
  context: T extends "tree" ? never : Context<DataCategory>;
  date: Date | null;
  license: License | null;
  identification: Identification;
  creators: Array<Person>;
  description: string | null;
  events: Array<Event>;
  items: Array<Item<T, U>>;
};

/**
 * Represents a Tree item in OCHRE
 */
export type Tree<T extends ItemsDataCategory> = Prettify<
  Item<"tree"> & {
    type: string;
    itemsCategory: T;
    items: Array<Item<T>>;
    links: Array<Link>;
    notes: Array<Note>;
    properties: Array<Property>;
    citedBibliographies: Array<Bibliography>;
  }
>;

/**
 * Represents a Set item in OCHRE
 */
export type Set<T extends ItemsDataCategory> = Prettify<
  Item<"set"> & {
    itemsCategory: T;
    isTabularStructure: boolean;
    isSuppressingBlanks: boolean;
    items: Array<
      Partial<Item<T>> & {
        identification: Identification;
        properties?: Array<Property>;
      }
    >;
    links: Array<Link>;
    notes: Array<Note>;
    properties: Array<Property>;
  }
>;

/**
 * Represents a Bibliography item in OCHRE
 */
export type Bibliography = Prettify<
  Item<"bibliography"> & {
    type: string | null;
    zoteroId: string | null;
    projectIdentification: Identification | null;
    citationFormat: string | null;
    referenceFormat: string | null;
    publicationInfo: {
      publishers: Array<Person>;
      startDate: Date | null;
    } | null;
    entryInfo: { startIssue: string; startVolume: string } | null;
    source: DataItem | null;
    authors: Array<Person>;
    periods: Array<Period>;
    links: Array<Link>;
    notes: Array<Note>;
    properties: Array<Property>;
    citedBibliographies: Array<Bibliography>;
  }
>;

/**
 * Represents a Concept item in OCHRE
 */
export type Concept = Prettify<
  Item<"concept"> & {
    interpretations: Array<Interpretation>;
    coordinates: Array<Coordinates>;
  }
>;

/**
 * Represents an interpretation of a Concept
 */
export type Interpretation = {
  number: number;
  date: Date | null;
  periods: Array<Period>;
  links: Array<Link>;
  notes: Array<Note>;
  properties: Array<Property>;
  citedBibliographies: Array<Bibliography>;
};

/**
 * Represents a Spatial Unit item in OCHRE
 */
export type SpatialUnit = Prettify<
  Item<"spatialUnit"> & {
    image: Image | null;
    coordinates: Array<Coordinates>;
    mapData: { geoJSON: { multiPolygon: string; EPSG: number } } | null;
    observations: Array<Observation>;
    citedBibliographies: Array<Bibliography>;
  }
>;

/**
 * Represents an observation of a Spatial Unit in OCHRE
 */
export type Observation = {
  number: number;
  date: Date | null;
  observers: Array<string> | Array<Person>;
  periods: Array<Period>;
  links: Array<Link>;
  notes: Array<Note>;
  properties: Array<Property>;
  citedBibliographies: Array<Bibliography>;
};

/**
 * Represents a Period item in OCHRE
 */
export type Period = Prettify<
  Item<"period"> & {
    type: string | null;
    coordinates: Array<Coordinates>;
    links: Array<Link>;
    notes: Array<Note>;
    properties: Array<Property>;
    citedBibliographies: Array<Bibliography>;
  }
>;

/**
 * Represents a Person/Organization item in OCHRE
 */
export type Person = Prettify<
  Item<"person"> & {
    type: string;
    address: {
      country: string | null;
      city: string | null;
      state: string | null;
    } | null;
    coordinates: Array<Coordinates>;
    content: string | null;
    periods: Array<Period>;
    links: Array<Link>;
    notes: Array<Note>;
    properties: Array<Property>;
  }
>;

/**
 * Represents a Property Value item in OCHRE
 */
export type PropertyValue = Prettify<
  Item<"propertyValue"> & {
    coordinates: Array<Coordinates>;
    links: Array<Link>;
    notes: Array<Note>;
    properties: Array<Property>;
    citedBibliographies: Array<Bibliography>;
  }
>;

/**
 * Represents a Property Variable item in OCHRE
 */
export type PropertyVariable = Prettify<
  Item<"propertyVariable"> & {
    type: string | null;
    coordinates: Array<Coordinates>;
    links: Array<Link>;
    notes: Array<Note>;
    citedBibliographies: Array<Bibliography>;
  }
>;

/**
 * Represents a Resource item in OCHRE
 */
export type Resource = Prettify<
  Item<"resource"> & {
    type: string;
    href: string | null;
    fileFormat: string | null;
    fileSize: number | null;
    height: number | null;
    width: number | null;
    image: Image | null;
    document: Document | null;
    imageMap: ImageMap | null;
    coordinates: Array<Coordinates>;
    periods: Array<Period>;
    links: Array<Link>;
    reverseLinks: Array<Link>;
    notes: Array<Note>;
    properties: Array<Property>;
    citedBibliographies: Array<Bibliography>;
  }
>;

/**
 * Represents the image of an item in OCHRE
 */
export type Image = {
  publicationDateTime: Date | null;
  identification: Identification | null;
  url: string | null;
  htmlPrefix: string | null;
  content: string | null;
  width: number | null;
  height: number | null;
};

/**
 * Represents a clickable/interactive area on an image map
 */
export type ImageMapArea = {
  uuid: string;
  publicationDateTime: Date | null;
  type: string;
  title: string;
  items: Array<{ shape: "rectangle" | "polygon"; coords: Array<number> }>;
};

/**
 * Contains image map areas and dimensions
 */
export type ImageMap = {
  areas: Array<ImageMapArea>;
  width: number;
  height: number;
};

/**
 * Represents a document with content and footnotes
 */
export type Document = { content: string; footnotes: Array<Footnote> };

/**
 * Represents a footnote in a document
 */
export type Footnote = { uuid: string; label: string; content: string };

/**
 * Represents the content type of a property value
 */
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
  dataType: T;
  content:
    | (T extends "integer" | "decimal" ? number
      : T extends "boolean" ? boolean
      : T extends "date" | "dateTime" | "time" ? Date
      : string)
    | null;
  label: string | null;
  isUncertain: boolean;
  category: string | null;
  type: string | null;
  uuid: string | null;
  publicationDateTime: Date | null;
  unit: string | null;
};

/**
 * Represents a property with label, values and nested properties
 */
export type Property<
  T extends PropertyValueContentType = PropertyValueContentType,
> = {
  label: { uuid: string; name: string };
  values: Array<PropertyValueContent<T>>;
  comment: string | null;
  properties: Array<Property>;
};
