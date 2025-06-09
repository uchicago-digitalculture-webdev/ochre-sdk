import type { Prettify } from "./utils.js";

/**
 * Represents the core data structure containing item information and metadata
 */
export type Data<
  T extends DataCategory | undefined = undefined,
  U extends T extends "tree" | "set" ? ItemsDataCategory : never = never,
  V extends ReadonlyArray<string> | undefined = undefined,
> = {
  uuid: string;
  belongsTo: { uuid: string; abbreviation: string };
  publicationDateTime: Date;
  metadata: Metadata<V>;
  items: Array<Item<T, U, V>>;
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
export type ItemsDataCategory = Exclude<DataCategory, "tree">;

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
export type RecursiveDataCategory = Exclude<
  DataCategory,
  "tree" | "person" | "propertyValue" | "propertyVariable" | "set"
>;

/**
 * Represents the category of items that are in containers (tree or set)
 */
export type ContainerDataCategory = Extract<DataCategory, "tree" | "set">;

/**
 * Represents a multilingual text with a language code as the key and the text as the value
 */
export type MultilingualText<
  V extends ReadonlyArray<string> | undefined = undefined,
> =
  V extends undefined ? Prettify<Partial<Record<"en" | (string & {}), string>>>
  : Record<NonNullable<V>[number], string>;

/**
 * Metadata information for items including project, item, publisher, and language details
 */
export type Metadata<V extends ReadonlyArray<string> | undefined = undefined> =
  {
    dataset: string;
    description: string;
    publisher: string;
    identifier: string;
    project: {
      identification: Identification<V>;
      website: string | null;
    } | null;
    item: {
      identification: Identification<V>;
      category: string;
      type: string;
      maxLength: number | null;
    } | null;
    defaultLanguage: V extends undefined ? Readonly<string>
    : Readonly<NonNullable<V>[number]>;
    languages: V extends undefined ? ReadonlyArray<string> : V;
  };

/**
 * Basic identification information used across multiple types
 */
export type Identification<
  V extends ReadonlyArray<string> | undefined = undefined,
> = { label: MultilingualText<V>; abbreviation: MultilingualText<V> | null };

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
export type Event<V extends ReadonlyArray<string> | undefined = undefined> = {
  date: Date | null;
  label: string;
  comment: string | null;
  agent: Person<V> | null;
};

export type CoordinatesSource<
  V extends ReadonlyArray<string> | undefined = undefined,
> =
  | { context: "self"; uuid: string; label: MultilingualText<V> }
  | {
      context: "related";
      uuid: string;
      label: MultilingualText<V>;
      value: MultilingualText<V>;
    }
  | {
      context: "inherited";
      item: { uuid: string; label: MultilingualText<V> };
      uuid: string;
      label: MultilingualText<V>;
    };

/**
 * Geographic coordinates item with optional type and label
 */
export type Coordinates<
  V extends ReadonlyArray<string> | undefined = undefined,
> =
  | {
      type: "point";
      latitude: number;
      longitude: number;
      altitude: number | null;
      source: CoordinatesSource<V> | null;
    }
  | {
      type: "plane";
      minimum: { latitude: number; longitude: number };
      maximum: { latitude: number; longitude: number };
      source: CoordinatesSource<V> | null;
    };

/**
 * Represents a link to another item
 */
export type Link<V extends ReadonlyArray<string> | undefined = undefined> =
  Prettify<
    {
      uuid: string;
      publicationDateTime: Date | null;
      identification: Identification<V> | null;
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
export type Note<V extends ReadonlyArray<string> | undefined = undefined> = {
  number: number;
  title: string | null;
  content: MultilingualText<V>;
  authors: Array<Person<V>>;
};

/**
 * Represents a heading under a Tree
 */
export type Heading<
  T extends HeadingDataCategory,
  V extends ReadonlyArray<string> | undefined = undefined,
> = {
  name: string;
  headings: Array<Heading<T, V>>;
  items: Array<Item<T, never, V>>;
};

/**
 * Represents a generic item in OCHRE
 */
export type BaseItem<
  T extends DataCategory | undefined = undefined,
  V extends ReadonlyArray<string> | undefined = undefined,
> = {
  uuid: string;
  category: T;
  publicationDateTime: Date | null;
  context: T extends "tree" ? never : Context<DataCategory>;
  date: Date | null;
  license: License | null;
  identification: Identification<V>;
  creators: Array<Person<V>>;
  description: MultilingualText<V> | null;
  events: Array<Event<V>>;
  items: T extends RecursiveDataCategory ? Array<Item<T, never, V>> : never;
};

export type Item<
  T extends DataCategory | undefined = undefined,
  U extends T extends "tree" | "set" ? ItemsDataCategory : never = never,
  V extends ReadonlyArray<string> | undefined = undefined,
> = BaseItem<T, V> &
  (T extends "tree" ? Tree<U, V>
  : T extends "set" ? Set<U, V>
  : T extends "bibliography" ? Bibliography<V>
  : T extends "concept" ? Concept<V>
  : T extends "spatialUnit" ? SpatialUnit<V>
  : T extends "period" ? Period<V>
  : T extends "person" ? Person<V>
  : T extends "propertyValue" ? PropertyValue<V>
  : T extends "propertyVariable" ? PropertyVariable<V>
  : T extends "resource" ? Resource<V>
  : never);

/**
 * Represents a Tree item in OCHRE
 */
export type Tree<
  T extends ItemsDataCategory,
  V extends ReadonlyArray<string> | undefined = undefined,
> = Prettify<
  BaseItem<"tree", V> & {
    type: string;
    itemsCategory: T;
    items: T extends HeadingDataCategory ?
      Array<Heading<T, V> | Item<T, never, V>>
    : Array<Item<T, never, V>>;
    links: Array<Link<V>>;
    notes: Array<Note<V>>;
    properties: Array<Property<V>>;
    bibliographies: Array<Bibliography<V>>;
  }
>;

/**
 * Represents a Set item in OCHRE
 */
export type Set<
  T extends ItemsDataCategory,
  V extends ReadonlyArray<string> | undefined = undefined,
> = Prettify<
  BaseItem<"set", V> & {
    itemsCategory: T;
    isTabularStructure: boolean;
    isSuppressingBlanks: boolean;
    items: Array<
      Partial<BaseItem<T, V>> & {
        identification: Identification<V>;
        properties: Array<Property<V>>;
      }
    >;
    links: Array<Link<V>>;
    notes: Array<Note<V>>;
    properties: Array<Property<V>>;
  }
>;

/**
 * Represents a Bibliography item in OCHRE
 */
export type Bibliography<
  V extends ReadonlyArray<string> | undefined = undefined,
> = Prettify<
  BaseItem<"bibliography", V> & {
    type: string | null;
    citationFormat: string | null;
    referenceFormat: string | null;
    publicationInfo: {
      publishers: Array<Person<V>>;
      startDate: Date | null;
    } | null;
    entryInfo: { startIssue: string; startVolume: string } | null;
    source: BaseItem<ItemsDataCategory, V> | null;
    authors: Array<Person<V>>;
    periods: Array<Period<V>>;
    links: Array<Link<V>>;
    notes: Array<Note<V>>;
    properties: Array<Property<V>>;
    bibliographies: Array<Bibliography<V>>;
  } & (
      | { type: "zotero"; zoteroId: string; uuid: string | null }
      | { type: string }
    )
>;

/**
 * Represents a Concept item in OCHRE
 */
export type Concept<V extends ReadonlyArray<string> | undefined = undefined> =
  Prettify<
    BaseItem<"concept", V> & {
      interpretations: Array<Interpretation<V>>;
      coordinates: Array<Coordinates<V>>;
    }
  >;

/**
 * Represents an interpretation of a Concept
 */
export type Interpretation<
  V extends ReadonlyArray<string> | undefined = undefined,
> = {
  number: number;
  date: Date | null;
  periods: Array<Period<V>>;
  links: Array<Link<V>>;
  notes: Array<Note<V>>;
  properties: Array<Property<V>>;
  bibliographies: Array<Bibliography<V>>;
};

/**
 * Represents a Spatial Unit item in OCHRE
 */
export type SpatialUnit<
  V extends ReadonlyArray<string> | undefined = undefined,
> = Prettify<
  BaseItem<"spatialUnit", V> & {
    image: Image<V> | null;
    coordinates: Array<Coordinates<V>>;
    mapData: { geoJSON: { multiPolygon: string; EPSG: number } } | null;
    observations: Array<Observation<V>>;
    bibliographies: Array<Bibliography<V>>;
  }
>;

/**
 * Represents an observation of a Spatial Unit in OCHRE
 */
export type Observation<
  V extends ReadonlyArray<string> | undefined = undefined,
> = {
  number: number;
  date: Date | null;
  observers: Array<string> | Array<Person<V>>;
  periods: Array<Period<V>>;
  links: Array<Link<V>>;
  notes: Array<Note<V>>;
  properties: Array<Property<V>>;
  bibliographies: Array<Bibliography<V>>;
};

/**
 * Represents a Period item in OCHRE
 */
export type Period<V extends ReadonlyArray<string> | undefined = undefined> =
  Prettify<
    BaseItem<"period", V> & {
      type: string | null;
      coordinates: Array<Coordinates<V>>;
      links: Array<Link<V>>;
      notes: Array<Note<V>>;
      properties: Array<Property<V>>;
      bibliographies: Array<Bibliography<V>>;
    }
  >;

/**
 * Represents a Person/Organization item in OCHRE
 */
export type Person<V extends ReadonlyArray<string> | undefined = undefined> =
  Prettify<
    BaseItem<"person", V> & {
      type: string;
      address: {
        country: string | null;
        city: string | null;
        state: string | null;
      } | null;
      coordinates: Array<Coordinates<V>>;
      content: MultilingualText<V> | null;
      periods: Array<Period<V>>;
      links: Array<Link<V>>;
      notes: Array<Note<V>>;
      properties: Array<Property<V>>;
    }
  >;

/**
 * Represents a Property Value item in OCHRE
 */
export type PropertyValue<
  V extends ReadonlyArray<string> | undefined = undefined,
> = Prettify<
  BaseItem<"propertyValue", V> & {
    coordinates: Array<Coordinates<V>>;
    links: Array<Link<V>>;
    notes: Array<Note<V>>;
    properties: Array<Property<V>>;
    bibliographies: Array<Bibliography<V>>;
  }
>;

/**
 * Represents a Property Variable item in OCHRE
 */
export type PropertyVariable<
  V extends ReadonlyArray<string> | undefined = undefined,
> = Prettify<
  BaseItem<"propertyVariable", V> & {
    type: string | null;
    coordinates: Array<Coordinates<V>>;
    links: Array<Link<V>>;
    notes: Array<Note<V>>;
    bibliographies: Array<Bibliography<V>>;
  }
>;

/**
 * Represents a Resource item in OCHRE
 */
export type Resource<V extends ReadonlyArray<string> | undefined = undefined> =
  Prettify<
    BaseItem<"resource", V> & {
      type: string;
      href: string | null;
      fileFormat: string | null;
      fileSize: number | null;
      isInline: boolean;
      height: number | null;
      width: number | null;
      image: Image<V> | null;
      document: MultilingualText<V> | null;
      imageMap: ImageMap | null;
      coordinates: Array<Coordinates<V>>;
      periods: Array<Period<V>>;
      links: Array<Link<V>>;
      reverseLinks: Array<Link<V>>;
      notes: Array<Note<V>>;
      properties: Array<Property<V>>;
      bibliographies: Array<Bibliography<V>>;
    }
  >;

/**
 * Represents the image of an item in OCHRE
 */
export type Image<V extends ReadonlyArray<string> | undefined = undefined> = {
  publicationDateTime: Date | null;
  identification: Identification<V> | null;
  url: string | null;
  htmlPrefix: string | null;
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
export type PropertyValueContent<
  V extends ReadonlyArray<string> | undefined = undefined,
> = Prettify<
  {
    label: MultilingualText<V> | null;
    isUncertain: boolean;
    category: string | null;
    type: string | null;
    uuid: string | null;
    publicationDateTime: Date | null;
    unit: string | null;
  } & (
    | { dataType: "string" | "coordinate" | "IDREF"; content: string }
    | { dataType: "integer" | "decimal"; content: number }
    | { dataType: "boolean"; content: boolean }
    | { dataType: "date" | "dateTime" | "time"; content: Date }
  )
>;

/**
 * Represents a property with label, values and nested properties
 */
export type Property<V extends ReadonlyArray<string> | undefined = undefined> =
  {
    label: { uuid: string; name: string };
    values: Array<PropertyValueContent<V>>;
    comment: string | null;
    properties: Array<Property<V>>;
  };
