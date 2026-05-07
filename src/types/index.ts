import type { MultilingualString } from "#/types/multilingual.js";
import type { Prettify } from "#/types/utils.js";

/**
 * The category of an item in OCHRE
 */
export type DataCategory =
  | "tree"
  | "bibliography"
  | "concept"
  | "spatialUnit"
  | "period"
  | "person"
  | "propertyVariable"
  | "propertyValue"
  | "resource"
  | "text"
  | "set";

/**
 * The category of items in a Set or Tree
 */
export type ItemsDataCategory = Exclude<DataCategory, "tree">;

/**
 * The category of items in a heading
 */
export type HeadingDataCategory = Exclude<
  DataCategory,
  "tree" | "bibliography" | "spatialUnit" | "concept" | "period"
>;

/**
 * The category of items that are in containers (tree or set)
 */
export type RecursiveDataCategory = Exclude<
  DataCategory,
  "tree" | "person" | "propertyVariable" | "propertyValue" | "set"
>;

/**
 *  Basic identification information
 */
export type Identification<T extends ReadonlyArray<string>> = {
  label: MultilingualString<T>;
  abbreviation: MultilingualString<T> | null;
  alias: { label: string | null; abbreviation: string | null };
  code: string | null;
  email: string | null;
  website: string | null;
};

/**
 *  Metadata in OCHRE
 */
export type Metadata<T extends ReadonlyArray<string>> = {
  dataset: string;
  description: string;
  publisher: string;
  identifier: string;
  project: {
    uuid: string;
    identification: Identification<T>;
    website: string | null;
    dateFormat: string | null;
    page: "item" | "entry" | null;
  } | null;
  collection: {
    uuid: string;
    identification: Identification<T>;
    page: "item" | "entry";
  } | null;
  publication: {
    uuid: string;
    identification: Identification<T>;
    page: "item" | "entry";
  } | null;
  item: {
    identification: Identification<T>;
    category: string;
    type: string;
    maxLength: number | null;
  } | null;
  defaultLanguage: T[number];
  languages: T;
};

/**
 *  License in OCHRE
 */
export type License = { content: string; target: string | null };

/**
 *  Context item in OCHRE
 */
export type ContextItem = {
  uuid: string | null;
  publicationDateTime: Date | null;
  index: number;
  content: string;
};

/**
 *  Context node in OCHRE
 */
export type ContextNode<U extends RecursiveDataCategory> = {
  tree: ContextItem;
  project: ContextItem;
} & Record<U, Array<ContextItem>>;

/**
 *  Context in OCHRE
 */
export type Context<U extends RecursiveDataCategory> = {
  nodes: Array<ContextNode<U>>;
  displayPath: string;
};

/**
 *  Event in OCHRE
 */
export type Event<T extends ReadonlyArray<string>> = {
  date: Date | { start: Date; end: Date } | null;
  label: MultilingualString<T>;
  comment: string | null;
  agent: {
    uuid: string;
    label: MultilingualString<T>;
    publicationDateTime: Date | null;
  } | null;
  location: {
    uuid: string;
    label: MultilingualString<T>;
    publicationDateTime: Date | null;
  } | null;
  other: {
    uuid: string | null;
    category: string | null;
    label: MultilingualString<T>;
  } | null;
};

/**
 *  Source of coordinates in OCHRE
 */
export type CoordinatesSource<T extends ReadonlyArray<string>> =
  | { context: "self"; uuid: string; label: MultilingualString<T> }
  | {
      context: "related";
      uuid: string;
      label: MultilingualString<T>;
      value: MultilingualString<T>;
    }
  | {
      context: "inherited";
      item: { uuid: string | null; label: MultilingualString<T> };
      uuid: string;
      label: MultilingualString<T>;
    };

/**
 *  Coordinates in OCHRE
 */
export type Coordinates<T extends ReadonlyArray<string>> =
  | {
      type: "point";
      latitude: number;
      longitude: number;
      altitude: number | null;
      source: CoordinatesSource<T> | null;
    }
  | {
      type: "plane";
      minimum: { latitude: number; longitude: number };
      maximum: { latitude: number; longitude: number };
      source: CoordinatesSource<T> | null;
    };

/**
 *  Image in OCHRE
 */
export type Image<T extends ReadonlyArray<string>> = {
  publicationDateTime: Date | null;
  identification: Identification<T> | null;
  href: string | null;
  htmlImgSrcPrefix: string | null;
  height: number | null;
  width: number | null;
  fileSize: number | null;
  base64: string | null;
};

/**
 *  Area of an image map in OCHRE
 */
export type ImageMapArea = {
  uuid: string;
  publicationDateTime: Date | null;
  type: string;
  title: string;
  items: Array<
    | { shape: "rectangle"; coords: [number, number, number, number] }
    | { shape: "circle"; center: { x: number; y: number }; radius: number }
    | { shape: "polygon"; coords: Array<number> }
  >;
};

/**
 *  Image map in OCHRE
 */
export type ImageMap = {
  areas: Array<ImageMapArea>;
  width: number;
  height: number;
};

/**
 *  Note in OCHRE
 */
export type Note<T extends ReadonlyArray<string>> = {
  number: number;
  title: string | null;
  content: MultilingualString<T>;
  authors: Array<Person<T>>;
};

/**
 *  Property value content in OCHRE
 */
export type PropertyValueContent<T extends ReadonlyArray<string>> = Prettify<
  {
    hierarchy: { isLeaf: boolean; level: number | null };
    label: MultilingualString<T> | null;
    isUncertain: boolean;
    category: string | null;
    type: string | null;
    uuid: string | null;
    publicationDateTime: Date | null;
    unit: string | null;
    href: string | null;
    height: number | null;
    width: number | null;
    fileSize: number | null;
    slug: string | null;
  } & (
    | {
        dataType: "string" | "coordinate" | "IDREF" | "date" | "dateTime";
        content: string;
      }
    | { dataType: "integer" | "decimal" | "time"; content: number }
    | { dataType: "boolean"; content: boolean }
  )
>;

/**
 *  Property in OCHRE
 */
export type Property<T extends ReadonlyArray<string>> = {
  label: { uuid: string; publicationDateTime: Date | null; name: string };
  values: Array<PropertyValueContent<T>>;
  comment: MultilingualString<T> | null;
  properties: Array<Property<T>>;
};

/**
 *  Base item in OCHRE
 */
export type BaseItem<
  U extends DataCategory | undefined = undefined,
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
> = {
  uuid: string;
  category: U;
  publicationDateTime: Date | null;
  context: Context<RecursiveDataCategory> | null;
  date: Date | null;
  license: License | null;
  copyright: MultilingualString<T> | null;
  watermark: MultilingualString<T> | null;
  identification: Identification<T>;
  creators: Array<Person<T>>;
  description: MultilingualString<T> | null;
  events: Array<Event<T>>;
};

/**
 * An Item in OCHRE (can be a tree, set, bibliography, concept, spatial unit, period, person, property value, property variable, or resource)
 */
export type Item<
  U extends DataCategory | undefined = undefined,
  V extends U extends "tree" | "set" ? ItemsDataCategory : never = never,
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
> = BaseItem<U, T> &
  (U extends "tree" ? Tree<V, T>
  : U extends "set" ? Set<V, T>
  : U extends "bibliography" ? Bibliography<T>
  : U extends "concept" ? Concept<T>
  : U extends "spatialUnit" ? SpatialUnit<T>
  : U extends "period" ? Period<T>
  : U extends "person" ? Person<T>
  : U extends "propertyVariable" ? PropertyVariable<T>
  : U extends "propertyValue" ? PropertyValue<T>
  : U extends "resource" ? Resource<T>
  : U extends "text" ? Text<T>
  : never);

/**
 *  Heading in OCHRE
 */
export type Heading<
  U extends HeadingDataCategory,
  T extends ReadonlyArray<string>,
> = {
  name: string;
  headings: Array<Heading<U, T>>;
  items: Array<Item<U, never, T>>;
};

/**
 *  Tree in OCHRE
 */
export type Tree<
  U extends ItemsDataCategory,
  T extends ReadonlyArray<string>,
> = Prettify<
  BaseItem<"tree", T> & {
    type: string | null;
    itemsCategory: U | null;
    links: Array<Item>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
    bibliographies: Array<Bibliography<T>>;
    items: U extends HeadingDataCategory ?
      Array<Heading<U, T> | Item<U, never, T>>
    : Array<Item<U, never, T>>;
  }
>;

/**
 *  Set in OCHRE
 */
export type Set<
  U extends ItemsDataCategory,
  T extends ReadonlyArray<string>,
> = Prettify<
  BaseItem<"set", T> & {
    itemsCategory: Array<U>;
    isTabularStructure: boolean;
    isSuppressingBlanks: boolean;
    links: Array<Item>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
    items: Array<Item<U, never, T>>;
  }
>;

/**
 *  Person in OCHRE
 */
export type Person<T extends ReadonlyArray<string>> = Prettify<
  BaseItem<"person", T> & {
    type: string;
    image: Image<T> | null;
    address: {
      country: string | null;
      city: string | null;
      state: string | null;
    } | null;
    coordinates: Array<Coordinates<T>>;
    content: MultilingualString<T> | null;
    periods: Array<Period<T>>;
    links: Array<Item>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
  }
>;

/**
 *  Period in OCHRE
 */
export type Period<T extends ReadonlyArray<string>> = Prettify<
  BaseItem<"period", T> & {
    type: string | null;
    coordinates: Array<Coordinates<T>>;
    links: Array<Item>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
    bibliographies: Array<Bibliography<T>>;
    items: Array<Period<T>>;
  }
>;

/**
 *  Bibliography in OCHRE
 */
export type Bibliography<T extends ReadonlyArray<string>> = Prettify<
  BaseItem<"bibliography", T> & {
    citationDetails: string | null;
    citationFormat: MultilingualString<T> | null;
    citationFormatSpan: string | null;
    referenceFormatDiv: string | null;
    publicationInfo: {
      publishers: Array<Person<T>>;
      startDate: Date | null;
    } | null;
    entryInfo: { startIssue: string; startVolume: string } | null;
    source: Item<ItemsDataCategory, never, T> | null;
    authors: Array<Person<T>>;
    periods: Array<Period<T>>;
    links: Array<Item>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
    bibliographies: Array<Bibliography<T>>;
    items: Array<Bibliography<T>>;
  } & (
      | { type: "zotero"; zoteroId: string; uuid: string | null }
      | { type: string | null }
    )
>;

/**
 *  Concept in OCHRE
 */
export type Concept<T extends ReadonlyArray<string>> = Prettify<
  BaseItem<"concept", T> & {
    image: Image<T> | null;
    interpretations: Array<Interpretation<T>>;
    coordinates: Array<Coordinates<T>>;
    items: Array<Concept<T>>;
  }
>;

/**
 *  Interpretation in OCHRE
 */
export type Interpretation<T extends ReadonlyArray<string>> = {
  number: number;
  date: Date | null;
  observers: Array<Person<T>>;
  periods: Array<Period<T>>;
  links: Array<Item>;
  notes: Array<Note<T>>;
  properties: Array<Property<T>>;
  bibliographies: Array<Bibliography<T>>;
};

/**
 *  Spatial unit in OCHRE
 */
export type SpatialUnit<T extends ReadonlyArray<string>> = Prettify<
  BaseItem<"spatialUnit", T> & {
    image: Image<T> | null;
    coordinates: Array<Coordinates<T>>;
    mapData: { geoJSON: { multiPolygon: string; EPSG: number } } | null;
    observations: Array<Observation<T>>;
    bibliographies: Array<Bibliography<T>>;
    items: Array<SpatialUnit<T>>;
  }
>;

/**
 *  Observation in OCHRE
 */
export type Observation<T extends ReadonlyArray<string>> = {
  number: number;
  date: Date | null;
  observers: Array<string> | Array<Person<T>>;
  periods: Array<Period<T>>;
  links: Array<Item>;
  notes: Array<Note<T>>;
  properties: Array<Property<T>>;
  bibliographies: Array<Bibliography<T>>;
};

/**
 *  Property variable in OCHRE
 */
export type PropertyVariable<T extends ReadonlyArray<string>> = Prettify<
  BaseItem<"propertyVariable", T> & {
    type: string | null;
    coordinates: Array<Coordinates<T>>;
    links: Array<Item>;
    notes: Array<Note<T>>;
    bibliographies: Array<Bibliography<T>>;
  }
>;

/**
 *  Property value in OCHRE
 */
export type PropertyValue<T extends ReadonlyArray<string>> = Prettify<
  BaseItem<"propertyValue", T> & {
    coordinates: Array<Coordinates<T>>;
    links: Array<Item>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
    bibliographies: Array<Bibliography<T>>;
  }
>;

/**
 *  Resource in OCHRE
 */
export type Resource<T extends ReadonlyArray<string>> = Prettify<
  BaseItem<"resource", T> & {
    type: string;
    href: string | null;
    fileFormat: string | null;
    fileSize: number | null;
    isInline: boolean;
    height: number | null;
    width: number | null;
    image: Image<T> | null;
    document: MultilingualString<T> | null;
    imageMap: ImageMap | null;
    coordinates: Array<Coordinates<T>>;
    periods: Array<Period<T>>;
    links: Array<Item>;
    reverseLinks: Array<Item>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
    bibliographies: Array<Bibliography<T>>;
    items: Array<Resource<T>>;
  }
>;

/**
 *  Text in OCHRE
 */
export type Text<T extends ReadonlyArray<string>> = Prettify<
  BaseItem<"text", T> & {
    type: string;
    text: string | null;
    language: string | null;
    image: Image<T> | null;
    coordinates: Array<Coordinates<T>>;
    links: Array<Item>;
    reverseLinks: Array<Item>;
    notes: Array<Note<T>>;
    sections: Array<Section<T>>;
    periods: Array<Period<T>>;
    creators: Array<Person<T>>;
    editions: Array<Person<T>>;
  }
>;

/**
 *  Section in OCHRE
 */
export type Section<T extends ReadonlyArray<string>> = {
  uuid: string;
  publicationDateTime: Date | null;
  identification: Identification<T>;
  project: { identification: Identification<T> } | null;
};

/**
 * Parsed data returned from the OCHRE API
 */
export type Data<
  U extends DataCategory | undefined = undefined,
  V extends U extends "tree" | "set" ? ItemsDataCategory : never = never,
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
> = {
  uuid: string;
  belongsTo: { uuid: string; abbreviation: string };
  publicationDateTime: Date;
  metadata: Metadata<T>;
  items: Array<Item<U, V, T>>;
};
