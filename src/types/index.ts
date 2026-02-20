/**
 * Represents the OCHRE API version
 */
export type ApiVersion = 1 | 2;

/**
 * Represents the core data structure containing item information and metadata
 */
export type Data<
  T extends DataCategory = DataCategory,
  U extends DataCategory | Array<DataCategory> = T extends "tree" ?
    Exclude<DataCategory, "tree">
  : T extends "set" ? Array<DataCategory>
  : never,
> = {
  uuid: string;
  belongsTo: { uuid: string; abbreviation: string };
  publicationDateTime: Date;
  persistentUrl: string | null;
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
  | "propertyVariable"
  | "propertyValue"
  | "text"
  | "tree"
  | "set";

/**
 * Represents the item of the data, with proper type narrowing based on category
 */
export type Item<
  T extends DataCategory = DataCategory,
  U extends DataCategory | Array<DataCategory> = T extends "tree" ?
    Exclude<DataCategory, "tree">
  : T extends "set" ? Array<DataCategory>
  : never,
> =
  T extends "resource" ? Resource
  : T extends "spatialUnit" ? SpatialUnit
  : T extends "concept" ? Concept
  : T extends "period" ? Period
  : T extends "bibliography" ? Bibliography
  : T extends "person" ? Person
  : T extends "propertyVariable" ? PropertyVariable
  : T extends "propertyValue" ? PropertyValue
  : T extends "text" ? Text
  : T extends "tree" ?
    Tree<
      U extends Array<DataCategory> ? Exclude<U[number], "tree">
      : Exclude<U, "tree">
    >
  : T extends "set" ? Set<U extends Array<DataCategory> ? U : Array<U>>
  : | Resource
    | SpatialUnit
    | Concept
    | Period
    | Bibliography
    | Person
    | PropertyVariable
    | PropertyValue
    | Tree<
        U extends Array<DataCategory> ? Exclude<U[number], "tree">
        : Exclude<U, "tree">
      >
    | Set<U extends Array<DataCategory> ? U : Array<U>>;

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
    uuid: string;
    identification: Identification & { website: string | null };
    dateFormat: string | null;
    page: "item" | "entry" | null;
  } | null;
  collection: {
    uuid: string;
    identification: Identification;
    page: "item" | "entry";
  } | null;
  publication: {
    uuid: string;
    identification: Identification;
    page: "item" | "entry";
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
  belongsTo: { uuid: string; abbreviation: string } | null;
  metadata: Metadata | null;
  publicationDateTime: Date | null;
  persistentUrl: string | null;
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
 * Represents a file format
 */
export type FileFormat =
  | "image/jpeg"
  | "image/gif"
  | "image/tiff"
  | "image/bmp"
  | "image/png"
  | "image/svg+xml"
  | "image/vnd.microsoft.icon"
  | "image/jpeg-imageMap"
  | "image/gif-imageMap"
  | "image/tiff-imageMap"
  | "image/bmp-imageMap"
  | "image/png-imageMap"
  | "image/svg+xml-imageMap"
  | "video/mpeg"
  | "video/mp4"
  | "video/quicktime"
  | "video/x-msvideo"
  | "video/x-ms-wmv"
  | "video/x-ms-asf"
  | "drawing/dwg"
  | "audio/aiff"
  | "audio/basic"
  | "audio/midi"
  | "audio/mp4"
  | "audio/mpeg"
  | "audio/x-ms-wax"
  | "audio/x-ms-wma"
  | "audio/wav"
  | "text/pdf"
  | "text/doc"
  | "text/ppt"
  | "text/html"
  | "text/plain"
  | "application/xls"
  | "application/xlsx"
  | "application/ai"
  | "application/octet-stream"
  | "application/IIIF"
  | "image/fits"
  | "image/ptm"
  | "model/obj";

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
  fileFormat: FileFormat | null;
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
  category: string;
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
  dateTime: string | null;
  label: string;
  agent: {
    uuid: string;
    publicationDateTime: Date | null;
    content: string;
  } | null;
  location: {
    uuid: string;
    publicationDateTime: Date | null;
    content: string;
  } | null;
  comment: string | null;
  other: {
    uuid: string | null;
    category: string | null;
    content: string;
  } | null;
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
  belongsTo: { uuid: string; abbreviation: string } | null;
  metadata: Metadata | null;
  publicationDateTime: Date | null;
  persistentUrl: string | null;
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
  fileFormat: FileFormat | null;
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
  belongsTo: { uuid: string; abbreviation: string } | null;
  metadata: Metadata | null;
  publicationDateTime: Date | null;
  persistentUrl: string | null;
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
  belongsTo: { uuid: string; abbreviation: string } | null;
  metadata: Metadata | null;
  publicationDateTime: Date | null;
  persistentUrl: string | null;
  number: number;
  license: License | null;
  context: Context | null;
  identification: Identification;
  status: "live" | "pending";
  image: Image | null;
  description: string | null;
  coordinates: Array<Coordinate>;
  interpretations: Array<Interpretation>;
  properties: Array<Property>;
  bibliographies: Array<Bibliography>;
};

/**
 * Represents a set that can contain resources, spatial units and concepts
 */
export type Set<U extends Array<DataCategory> = Array<DataCategory>> = {
  uuid: string;
  category: "set";
  belongsTo: { uuid: string; abbreviation: string } | null;
  metadata: Metadata | null;
  itemCategories: U;
  publicationDateTime: Date | null;
  persistentUrl: string | null;
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
  : U extends "propertyVariable" ? Array<PropertyVariable>
  : U extends "propertyValue" ? Array<PropertyValue>
  : U extends "tree" ? Array<Tree<Exclude<DataCategory, "tree">>>
  : U extends "set" ? Array<Set<Array<DataCategory>>>
  : Array<Item>;
};

/**
 * Represents a bibliography entry with citation and publication information
 */
export type Bibliography = {
  uuid: string | null;
  zoteroId: string | null;
  category: "bibliography";
  belongsTo: { uuid: string; abbreviation: string } | null;
  metadata: Metadata | null;
  publicationDateTime: Date | null;
  persistentUrl: string | null;
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
  links: Array<Link>;
  reverseLinks: Array<Link>;
  properties: Array<Property>;
};

/**
 * Represents a time period with identification
 */
export type Period = {
  uuid: string;
  category: "period";
  belongsTo: { uuid: string; abbreviation: string } | null;
  metadata: Metadata | null;
  publicationDateTime: Date | null;
  persistentUrl: string | null;
  type: string | null;
  number: number | null;
  identification: Identification;
  coordinates: Array<Coordinate>;
  description: string | null;
};

/**
 * Represents a property variable
 */
export type PropertyVariable = {
  uuid: string;
  category: "propertyVariable";
  belongsTo: { uuid: string; abbreviation: string } | null;
  metadata: Metadata | null;
  persistentUrl: string | null;
  type: string;
  number: number;
  publicationDateTime: Date | null;
  context: Context | null;
  availability: License | null;
  identification: Identification;
};

/**
 * Represents a property value with type information
 */
export type PropertyValue = {
  uuid: string;
  category: "propertyValue";
  belongsTo: { uuid: string; abbreviation: string } | null;
  metadata: Metadata | null;
  persistentUrl: string | null;
  number: number;
  publicationDateTime: Date | null;
  context: Context | null;
  availability: License | null;
  identification: Identification;
  date: string | null;
  creators: Array<Person>;
  description: string;
  coordinates: Array<Coordinate>;
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
  hierarchy: { isLeaf: boolean; level: number | null };
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
  height: number | null;
  width: number | null;
  fileSize: number | null;
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
  belongsTo: { uuid: string; abbreviation: string } | null;
  metadata: Metadata | null;
  publicationDateTime: Date | null;
  persistentUrl: string | null;
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
  coordinates: Array<Coordinate>;
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
  belongsTo: { uuid: string; abbreviation: string } | null;
  metadata: Metadata | null;
  publicationDateTime: Date | null;
  persistentUrl: string | null;
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
  : U extends "propertyVariable" ? Array<PropertyVariable>
  : U extends "propertyValue" ? Array<PropertyValue>
  : U extends "text" ? Array<Text>
  : U extends "set" ? Array<Set<U extends Array<DataCategory> ? U : Array<U>>>
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
 * Represents a property query item with its UUID, raw value, count, and content
 */
export type PropertyValueQueryItem = {
  count: number;
  dataType: Exclude<PropertyValueContentType, "coordinate">;
  content: string | number | boolean | null;
  label: string | null;
};
