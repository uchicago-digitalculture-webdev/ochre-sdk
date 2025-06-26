import type { MultilingualString } from "./multilingual.js";
import type { Prettify } from "./utils.js";

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
  | "propertyValue"
  | "propertyVariable"
  | "resource"
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
  "tree" | "person" | "propertyValue" | "propertyVariable" | "set"
>;

/**
 *  Basic identification information
 */
export type Identification<T extends ReadonlyArray<string>> = {
  label: MultilingualString<T>;
  abbreviation: MultilingualString<T> | null;
};

/**
 *  Event in OCHRE
 */
export type Event<T extends ReadonlyArray<string>> = {
  date: Date | null;
  label: MultilingualString<T>;
  comment: string | null;
  agent: Person<T> | null;
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
      item: { uuid: string; label: MultilingualString<T> };
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
 *  Link in OCHRE
 */
export type Link<T extends ReadonlyArray<string>> = Prettify<
  {
    uuid: string;
    publicationDateTime: Date | null;
    identification: Identification<T> | null;
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
    label: MultilingualString<T> | null;
    isUncertain: boolean;
    category: string | null;
    type: string | null;
    uuid: string | null;
    publicationDateTime: Date | null;
    unit: string | null;
  } & (
    | { dataType: "string" | "coordinate" | "IDREF" | "date"; content: string }
    | { dataType: "integer" | "decimal" | "time"; content: number }
    | { dataType: "boolean"; content: boolean }
    | { dataType: "dateTime"; content: Date }
  )
>;

/**
 *  Property in OCHRE
 */
export type Property<T extends ReadonlyArray<string>> = {
  label: { uuid: string; name: string };
  values: Array<PropertyValueContent<T>>;
  comment: string | null;
  properties: Array<Property<T>>;
};

/**
 *  Context item in OCHRE
 */
export type ContextItem = {
  uuid: string;
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
 *  License in OCHRE
 */
export type License = { content: string; target: string };

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
  identification: Identification<T>;
  creators: Array<Person<T>>;
  description: MultilingualString<T> | null;
  events: Array<Event<T>>;
  items: U extends RecursiveDataCategory ? Array<Item<U, never, T>> : never;
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
  : U extends "propertyValue" ? PropertyValue<T>
  : U extends "propertyVariable" ? PropertyVariable<T>
  : U extends "resource" ? Resource<T>
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
    type: string;
    itemsCategory: U;
    items: U extends HeadingDataCategory ?
      Array<Heading<U, T> | Item<U, never, T>>
    : Array<Item<U, never, T>>;
    links: Array<Link<T>>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
    bibliographies: Array<Bibliography<T>>;
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
    itemsCategory: U;
    isTabularStructure: boolean;
    isSuppressingBlanks: boolean;
    items: Array<
      Partial<BaseItem<U, T>> & {
        identification: Identification<T>;
        properties: Array<Property<T>>;
      }
    >;
    links: Array<Link<T>>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
  }
>;

/**
 *  Person in OCHRE
 */
export type Person<T extends ReadonlyArray<string>> = Prettify<
  BaseItem<"person", T> & {
    type: string;
    address: {
      country: string | null;
      city: string | null;
      state: string | null;
    } | null;
    coordinates: Array<Coordinates<T>>;
    content: MultilingualString<T> | null;
    periods: Array<Period<T>>;
    links: Array<Link<T>>;
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
    links: Array<Link<T>>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
    bibliographies: Array<Bibliography<T>>;
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
    source: BaseItem<ItemsDataCategory, T> | null;
    authors: Array<Person<T>>;
    periods: Array<Period<T>>;
    links: Array<Link<T>>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
    bibliographies: Array<Bibliography<T>>;
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
    interpretations: Array<Interpretation<T>>;
    coordinates: Array<Coordinates<T>>;
  }
>;

/**
 *  Interpretation in OCHRE
 */
export type Interpretation<T extends ReadonlyArray<string>> = {
  number: number;
  date: Date | null;
  periods: Array<Period<T>>;
  links: Array<Link<T>>;
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
  links: Array<Link<T>>;
  notes: Array<Note<T>>;
  properties: Array<Property<T>>;
  bibliographies: Array<Bibliography<T>>;
};

/**
 *  Property value in OCHRE
 */
export type PropertyValue<T extends ReadonlyArray<string>> = Prettify<
  BaseItem<"propertyValue", T> & {
    coordinates: Array<Coordinates<T>>;
    links: Array<Link<T>>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
    bibliographies: Array<Bibliography<T>>;
  }
>;

/**
 *  Property variable in OCHRE
 */
export type PropertyVariable<T extends ReadonlyArray<string>> = Prettify<
  BaseItem<"propertyVariable", T> & {
    type: string | null;
    coordinates: Array<Coordinates<T>>;
    links: Array<Link<T>>;
    notes: Array<Note<T>>;
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
    links: Array<Link<T>>;
    reverseLinks: Array<Link<T>>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
    bibliographies: Array<Bibliography<T>>;
  }
>;

/**
 *  Image in OCHRE
 */
export type Image<T extends ReadonlyArray<string>> = {
  publicationDateTime: Date | null;
  identification: Identification<T> | null;
  url: string | null;
  htmlPrefix: string | null;
  width: number | null;
  height: number | null;
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
 *  Metadata in OCHRE
 */
export type Metadata<T extends ReadonlyArray<string>> = {
  dataset: string;
  description: string;
  publisher: string;
  identifier: string;
  project: { identification: Identification<T>; website: string | null } | null;
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
