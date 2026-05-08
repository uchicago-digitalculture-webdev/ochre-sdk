import type { MultilingualString } from "#/parsers/multilingual.js";

type Prettify<T> = { [K in keyof T]: T[K] } & {};

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

export type HierarchyDataCategory = Extract<DataCategory, "tree" | "set">;

/**
 * The category of items in a Tree
 */
export type ItemsDataCategory = Exclude<DataCategory, "tree">;

/**
 * The category of items in a Set
 */
export type SetItemDataCategory = DataCategory;

export type HierarchyItemDataCategory<U extends DataCategory> =
  U extends "tree" ? ItemsDataCategory
  : U extends "set" ? SetItemDataCategory
  : never;

export type HierarchyItemCategoryOption<U extends DataCategory> =
  U extends "tree" ? ItemsDataCategory
  : U extends "set" ? SetItemDataCategory | ReadonlyArray<SetItemDataCategory>
  : never;

export type HierarchyItemCategoryFromOption<
  U extends DataCategory,
  V extends HierarchyItemCategoryOption<U> | undefined,
> =
  V extends ReadonlyArray<infer W> ? Extract<W, HierarchyItemDataCategory<U>>
  : V extends HierarchyItemDataCategory<U> ? V
  : HierarchyItemDataCategory<U>;

/**
 * The category of items in a heading
 */
export type HeadingDataCategory = Exclude<
  DataCategory,
  "tree" | "bibliography" | "spatialUnit" | "concept" | "period"
>;

/**
 * The category of items that are in hierarchies (tree or set)
 */
export type RecursiveDataCategory = Exclude<
  DataCategory,
  "tree" | "person" | "propertyVariable" | "propertyValue" | "set"
>;

/**
 *  The category names that can appear in OCHRE context paths
 */
export type ContextDataCategory = Exclude<
  DataCategory,
  "tree" | "person" | "set"
>;

/**
 *  Basic identification information
 */
export type Identification<T extends ReadonlyArray<string>> = {
  label: MultilingualString<T>;
  abbreviation: MultilingualString<T> | null;
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

export type BelongsTo = { uuid: string; abbreviation: string };

export type ItemLocation = "topLevel" | "nested";

type ItemOrigin<T extends ReadonlyArray<string>, U extends ItemLocation> =
  U extends "topLevel" ? { belongsTo: BelongsTo; metadata: Metadata<T> }
  : { belongsTo: null; metadata: null };

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
export type ContextNode<U extends ContextDataCategory> = {
  tree: ContextItem;
  project: ContextItem;
  heading: Array<ContextItem>;
} & Partial<Record<U, Array<ContextItem>>>;

/**
 *  Context in OCHRE
 */
export type Context<U extends ContextDataCategory> = {
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
  authors: Array<Person<T, "nested">>;
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
 *  Property in a Set item. OCHRE exposes Set item properties as a flat list.
 */
export type SingleHierarchyProperty<T extends ReadonlyArray<string>> = Omit<
  Property<T>,
  "properties"
>;

type WithSingleHierarchyProperties<
  U extends { properties: Array<Property<T>> },
  T extends ReadonlyArray<string>,
> =
  U extends { properties: Array<Property<T>> } ?
    Prettify<
      Omit<U, "properties"> & { properties: Array<SingleHierarchyProperty<T>> }
    >
  : never;

/**
 *  Base item in OCHRE
 */
export type BaseItem<
  U extends DataCategory = DataCategory,
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
  V extends ItemLocation = "topLevel",
> = ItemOrigin<T, V> & {
  uuid: string;
  category: U;
  publicationDateTime: Date | null;
  context: Context<ContextDataCategory> | null;
  date: Date | null;
  license: License | null;
  copyright: MultilingualString<T> | null;
  watermark: MultilingualString<T> | null;
  identification: Identification<T>;
  creators: Array<Person<T, "nested">>;
  description: MultilingualString<T> | null;
  events: Array<Event<T>>;
};

export type ItemLinkCategory = DataCategory | "dictionaryUnit";

/**
 *  Base item data exposed by OCHRE link and reverse-link payloads.
 */
export type BaseItemLink<
  U extends ItemLinkCategory = ItemLinkCategory,
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
> = {
  uuid: string;
  category: U;
  publicationDateTime: Date | null;
  context: Context<ContextDataCategory> | null;
  date: Date | null;
  identification: Identification<T>;
  description: MultilingualString<T> | null;
};

export type BibliographySourceDocument = {
  uuid: string;
  content: string;
  href: string | null;
  publicationDateTime: Date | null;
};

export type BibliographyEntryInfo = {
  content: string | null;
  startIssue: string;
  startVolume: string;
  startPage: string;
  endPage: string;
};

export type ItemLinks<T extends ReadonlyArray<string> = ReadonlyArray<string>> =
  Array<ItemLink<ItemLinkCategory, T>>;

export type TreeItemLink<T extends ReadonlyArray<string>> = Prettify<
  BaseItemLink<"tree", T> & {
    type: string | null;
    itemsCategory: ItemsDataCategory | null;
  }
>;

export type SetItemLink<T extends ReadonlyArray<string>> = Prettify<
  BaseItemLink<"set", T> & {
    type: string | null;
    itemsCategory: Array<SetItemDataCategory> | null;
  }
>;

export type BibliographyItemLink<T extends ReadonlyArray<string>> = Prettify<
  BaseItemLink<"bibliography", T> & {
    type: string | null;
    zoteroId: string | null;
    citationDetails: string | null;
    citationFormat: MultilingualString<T> | null;
    citationFormatSpan: string | null;
    referenceFormatDiv: string | null;
    image: Image<T> | null;
    sourceDocument: BibliographySourceDocument | null;
    publicationInfo: {
      publishers: Array<ItemLink<"person", T>>;
      startDate: Date | null;
    } | null;
    entryInfo: BibliographyEntryInfo | null;
    source: ItemLink<ItemsDataCategory, T> | null;
    authors: Array<ItemLink<"person", T>>;
    periods: Array<ItemLink<"period", T>>;
    properties: Array<Property<T>>;
  }
>;

export type ConceptItemLink<T extends ReadonlyArray<string>> = Prettify<
  BaseItemLink<"concept", T> & {
    image: Image<T> | null;
    coordinates: Array<Coordinates<T>>;
  }
>;

export type SpatialUnitItemLink<T extends ReadonlyArray<string>> = Prettify<
  BaseItemLink<"spatialUnit", T> & {
    image: Image<T> | null;
    coordinates: Array<Coordinates<T>>;
  }
>;

export type PeriodItemLink<T extends ReadonlyArray<string>> = Prettify<
  BaseItemLink<"period", T> & {
    type: string | null;
    coordinates: Array<Coordinates<T>>;
  }
>;

export type PersonItemLink<T extends ReadonlyArray<string>> = Prettify<
  BaseItemLink<"person", T> & {
    type: string | null;
    coordinates: Array<Coordinates<T>>;
  }
>;

export type PropertyVariableItemLink<T extends ReadonlyArray<string>> =
  Prettify<
    BaseItemLink<"propertyVariable", T> & {
      type: string | null;
      coordinates: Array<Coordinates<T>>;
    }
  >;

export type PropertyValueItemLink<T extends ReadonlyArray<string>> = Prettify<
  BaseItemLink<"propertyValue", T> & { coordinates: Array<Coordinates<T>> }
>;

export type ResourceItemLink<T extends ReadonlyArray<string>> = Prettify<
  BaseItemLink<"resource", T> & {
    type: string | null;
    href: string | null;
    fileFormat: string | null;
    fileSize: number | null;
    isInline: boolean;
    isPrimary: boolean;
    height: number | null;
    width: number | null;
    image: Image<T> | null;
    coordinates: Array<Coordinates<T>>;
  }
>;

export type TextItemLink<T extends ReadonlyArray<string>> = Prettify<
  BaseItemLink<"text", T> & {
    type: string | null;
    text: string | null;
    language: string | null;
    image: Image<T> | null;
    coordinates: Array<Coordinates<T>>;
  }
>;

export type DictionaryUnitItemLink<T extends ReadonlyArray<string>> = Prettify<
  BaseItemLink<"dictionaryUnit", T>
>;

/**
 * An abridged item reference exposed inside OCHRE links and reverse links.
 */
export type ItemLink<
  U extends ItemLinkCategory = ItemLinkCategory,
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
> =
  U extends ItemLinkCategory ?
    U extends "tree" ? TreeItemLink<T>
    : U extends "set" ? SetItemLink<T>
    : U extends "bibliography" ? BibliographyItemLink<T>
    : U extends "concept" ? ConceptItemLink<T>
    : U extends "spatialUnit" ? SpatialUnitItemLink<T>
    : U extends "period" ? PeriodItemLink<T>
    : U extends "person" ? PersonItemLink<T>
    : U extends "propertyVariable" ? PropertyVariableItemLink<T>
    : U extends "propertyValue" ? PropertyValueItemLink<T>
    : U extends "resource" ? ResourceItemLink<T>
    : U extends "text" ? TextItemLink<T>
    : U extends "dictionaryUnit" ? DictionaryUnitItemLink<T>
    : never
  : never;

/**
 * An Item in OCHRE (can be a tree, set, bibliography, concept, spatial unit, period, person, property value, property variable, or resource)
 */
export type Item<
  U extends DataCategory = DataCategory,
  V extends HierarchyItemDataCategory<U> = HierarchyItemDataCategory<U>,
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
  W extends ItemLocation = "topLevel",
> =
  U extends DataCategory ?
    U extends "tree" ? Tree<Extract<V, ItemsDataCategory>, T, W>
    : U extends "set" ? Set<Extract<V, SetItemDataCategory>, T, W>
    : U extends "bibliography" ? Bibliography<T, W>
    : U extends "concept" ? Concept<T, W>
    : U extends "spatialUnit" ? SpatialUnit<T, W>
    : U extends "period" ? Period<T, W>
    : U extends "person" ? Person<T, W>
    : U extends "propertyVariable" ? PropertyVariable<T, W>
    : U extends "propertyValue" ? PropertyValue<T, W>
    : U extends "resource" ? Resource<T, W>
    : U extends "text" ? Text<T, W>
    : never
  : never;

/**
 *  Heading in OCHRE
 */
export type Heading<
  U extends HeadingDataCategory,
  T extends ReadonlyArray<string>,
> = {
  name: string;
  headings: Array<Heading<U, T>>;
  items: Array<Item<U, never, T, "nested">>;
};

/**
 *  Tree in OCHRE
 */
export type Tree<
  U extends ItemsDataCategory,
  T extends ReadonlyArray<string>,
  V extends ItemLocation = "topLevel",
> = Prettify<
  BaseItem<"tree", T, V> & {
    type: string | null;
    itemsCategory: U | null;
    links: ItemLinks<T>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
    bibliographies: Array<Bibliography<T, "nested">>;
    items: U extends HeadingDataCategory ?
      Array<Heading<U, T> | Item<U, never, T, "nested">>
    : Array<Item<U, never, T, "nested">>;
  }
>;

/**
 *  Set in OCHRE
 */
export type Set<
  U extends SetItemDataCategory,
  T extends ReadonlyArray<string>,
  V extends ItemLocation = "topLevel",
> = Prettify<
  BaseItem<"set", T, V> & {
    itemsCategory: Array<U>;
    isTabularStructure: boolean;
    isSuppressingBlanks: boolean;
    links: ItemLinks<T>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
    items: Array<SetItem<U, T>>;
  }
>;

export type SetBibliography<T extends ReadonlyArray<string>> =
  Bibliography<T, "nested"> extends infer U ?
    U extends { properties: Array<Property<T>> } ?
      Prettify<
        Omit<U, "properties" | "items"> & {
          properties: Array<SingleHierarchyProperty<T>>;
        }
      >
    : never
  : never;

export type SetConcept<T extends ReadonlyArray<string>> = Prettify<
  Omit<Concept<T, "nested">, "interpretations" | "items"> & {
    properties: Array<SingleHierarchyProperty<T>>;
  }
>;

export type SetSpatialUnit<T extends ReadonlyArray<string>> = Prettify<
  Omit<SpatialUnit<T, "nested">, "observations" | "items"> & {
    properties: Array<SingleHierarchyProperty<T>>;
  }
>;

export type SetPeriod<T extends ReadonlyArray<string>> = Prettify<
  Omit<WithSingleHierarchyProperties<Period<T, "nested">, T>, "items">
>;

export type SetResource<T extends ReadonlyArray<string>> = Prettify<
  Omit<WithSingleHierarchyProperties<Resource<T, "nested">, T>, "items">
>;

export type SetTree<T extends ReadonlyArray<string>> = Prettify<
  Omit<
    WithSingleHierarchyProperties<Tree<ItemsDataCategory, T, "nested">, T>,
    "items"
  >
>;

export type SetItem<
  U extends SetItemDataCategory,
  T extends ReadonlyArray<string>,
> =
  U extends "tree" ? SetTree<T>
  : U extends "bibliography" ? SetBibliography<T>
  : U extends "concept" ? SetConcept<T>
  : U extends "spatialUnit" ? SetSpatialUnit<T>
  : U extends "period" ? SetPeriod<T>
  : U extends "person" ? WithSingleHierarchyProperties<Person<T, "nested">, T>
  : U extends "propertyVariable" ? PropertyVariable<T, "nested">
  : U extends "propertyValue" ?
    WithSingleHierarchyProperties<PropertyValue<T, "nested">, T>
  : U extends "resource" ? SetResource<T>
  : U extends "text" ? Text<T, "nested">
  : U extends "set" ?
    Omit<
      WithSingleHierarchyProperties<Set<SetItemDataCategory, T, "nested">, T>,
      "items"
    >
  : never;

/**
 *  Person in OCHRE
 */
export type Person<
  T extends ReadonlyArray<string>,
  U extends ItemLocation = "topLevel",
> = Prettify<
  BaseItem<"person", T, U> & {
    type: string;
    image: Image<T> | null;
    address: {
      country: string | null;
      city: string | null;
      state: string | null;
      postalCode: string | null;
    } | null;
    coordinates: Array<Coordinates<T>>;
    content: MultilingualString<T> | null;
    periods: Array<Period<T, "nested">>;
    links: ItemLinks<T>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
  }
>;

/**
 *  Period in OCHRE
 */
export type Period<
  T extends ReadonlyArray<string>,
  U extends ItemLocation = "topLevel",
> = Prettify<
  BaseItem<"period", T, U> & {
    type: string | null;
    coordinates: Array<Coordinates<T>>;
    links: ItemLinks<T>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
    bibliographies: Array<Bibliography<T, "nested">>;
    items: Array<Period<T, "nested">>;
  }
>;

/**
 *  Bibliography in OCHRE
 */
export type Bibliography<
  T extends ReadonlyArray<string>,
  U extends ItemLocation = "topLevel",
> = Prettify<
  BaseItem<"bibliography", T, U> & {
    citationDetails: string | null;
    citationFormat: MultilingualString<T> | null;
    citationFormatSpan: string | null;
    referenceFormatDiv: string | null;
    image: Image<T> | null;
    sourceDocument: BibliographySourceDocument | null;
    publicationInfo: {
      publishers: Array<Person<T, "nested">>;
      startDate: Date | null;
    } | null;
    entryInfo: BibliographyEntryInfo | null;
    source: ItemLink<ItemsDataCategory, T> | null;
    authors: Array<Person<T, "nested">>;
    periods: Array<Period<T, "nested">>;
    links: ItemLinks<T>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
    bibliographies: Array<Bibliography<T, "nested">>;
    items: Array<Bibliography<T, "nested">>;
  } & (
      | { type: "zotero"; zoteroId: string; uuid: string | null }
      | { type: string | null }
    )
>;

/**
 *  Concept in OCHRE
 */
export type Concept<
  T extends ReadonlyArray<string>,
  U extends ItemLocation = "topLevel",
> = Prettify<
  BaseItem<"concept", T, U> & {
    image: Image<T> | null;
    interpretations: Array<Interpretation<T>>;
    coordinates: Array<Coordinates<T>>;
    items: Array<Concept<T, "nested">>;
  }
>;

/**
 *  Interpretation in OCHRE
 */
export type Interpretation<T extends ReadonlyArray<string>> = {
  number: number;
  date: Date | null;
  observers: Array<Person<T, "nested">>;
  periods: Array<Period<T, "nested">>;
  links: ItemLinks<T>;
  notes: Array<Note<T>>;
  properties: Array<Property<T>>;
  bibliographies: Array<Bibliography<T, "nested">>;
};

/**
 *  Spatial unit in OCHRE
 */
export type SpatialUnit<
  T extends ReadonlyArray<string>,
  U extends ItemLocation = "topLevel",
> = Prettify<
  BaseItem<"spatialUnit", T, U> & {
    image: Image<T> | null;
    coordinates: Array<Coordinates<T>>;
    mapData: { geoJSON: { multiPolygon: string; EPSG: number } } | null;
    observations: Array<Observation<T>>;
    bibliographies: Array<Bibliography<T, "nested">>;
    items: Array<SpatialUnit<T, "nested">>;
  }
>;

/**
 *  Observation in OCHRE
 */
export type Observation<T extends ReadonlyArray<string>> = {
  number: number;
  date: Date | null;
  observers: Array<string> | Array<Person<T, "nested">>;
  periods: Array<Period<T, "nested">>;
  links: ItemLinks<T>;
  notes: Array<Note<T>>;
  properties: Array<Property<T>>;
  bibliographies: Array<Bibliography<T, "nested">>;
};

/**
 *  Property variable in OCHRE
 */
export type PropertyVariable<
  T extends ReadonlyArray<string>,
  U extends ItemLocation = "topLevel",
> = Prettify<
  BaseItem<"propertyVariable", T, U> & {
    type: string | null;
    coordinates: Array<Coordinates<T>>;
    links: ItemLinks<T>;
    notes: Array<Note<T>>;
    bibliographies: Array<Bibliography<T, "nested">>;
  }
>;

/**
 *  Property value in OCHRE
 */
export type PropertyValue<
  T extends ReadonlyArray<string>,
  U extends ItemLocation = "topLevel",
> = Prettify<
  BaseItem<"propertyValue", T, U> & {
    coordinates: Array<Coordinates<T>>;
    links: ItemLinks<T>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
    bibliographies: Array<Bibliography<T, "nested">>;
  }
>;

/**
 *  Resource in OCHRE
 */
export type Resource<
  T extends ReadonlyArray<string>,
  U extends ItemLocation = "topLevel",
> = Prettify<
  BaseItem<"resource", T, U> & {
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
    periods: Array<Period<T, "nested">>;
    links: ItemLinks<T>;
    reverseLinks: ItemLinks<T>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
    bibliographies: Array<Bibliography<T, "nested">>;
    items: Array<Resource<T, "nested">>;
  }
>;

/**
 *  Text in OCHRE
 */
export type Text<
  T extends ReadonlyArray<string>,
  U extends ItemLocation = "topLevel",
> = Prettify<
  BaseItem<"text", T, U> & {
    type: string;
    text: string | null;
    language: string | null;
    image: Image<T> | null;
    coordinates: Array<Coordinates<T>>;
    links: ItemLinks<T>;
    reverseLinks: ItemLinks<T>;
    notes: Array<Note<T>>;
    sections: Array<Section<T>>;
    periods: Array<Period<T, "nested">>;
    creators: Array<Person<T, "nested">>;
    editions: Array<Person<T, "nested">>;
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
 * Represents a property query item with its UUID, raw value, count, and content
 */
export type PropertyValueQueryItem = {
  count: number;
  dataType: Exclude<
    PropertyValueContent<ReadonlyArray<string>>["dataType"],
    "coordinate"
  >;
  content: string | number | boolean | null;
  label: string | null;
};

/**
 * Represents a grouped Set attribute value query item
 */
export type SetAttributeValueQueryItem = { count: number; content: string };

/**
 * Represents sorting direction for Set items
 */
export type SetItemsSortDirection = "asc" | "desc";

/**
 * Represents sorting options for Set items
 */
export type SetItemsSort =
  | { target: "none" }
  | { target: "title"; direction?: SetItemsSortDirection; language?: string }
  | {
      target: "propertyValue";
      propertyVariableUuid: string;
      dataType: Exclude<
        PropertyValueContent<ReadonlyArray<string>>["dataType"],
        "coordinate"
      >;
      direction?: SetItemsSortDirection;
      language?: string;
    };

/**
 * Represents a leaf query for Set items
 */
export type QueryLeaf =
  | {
      target: "property";
      propertyVariable?: string;
      dataType: Exclude<
        PropertyValueContent<ReadonlyArray<string>>["dataType"],
        "coordinate" | "date" | "dateTime"
      >;
      value?: string;
      from?: never;
      to?: never;
      matchMode: "includes" | "exact";
      isCaseSensitive: boolean;
      language: string;
      isNegated?: boolean;
    }
  | {
      target: "property";
      propertyVariable: string;
      dataType: "date" | "dateTime";
      value: string;
      from?: never;
      to?: never;
      matchMode: "includes" | "exact";
      isCaseSensitive: boolean;
      language: string;
      isNegated?: boolean;
    }
  | {
      target: "property";
      propertyVariable: string;
      dataType: "date" | "dateTime";
      value?: never;
      from: string;
      to?: string;
      matchMode: "includes" | "exact";
      isCaseSensitive: boolean;
      language: string;
      isNegated?: boolean;
    }
  | {
      target: "property";
      propertyVariable: string;
      dataType: "date" | "dateTime";
      value?: never;
      from?: string;
      to: string;
      matchMode: "includes" | "exact";
      isCaseSensitive: boolean;
      language: string;
      isNegated?: boolean;
    }
  | {
      target: "property";
      propertyVariable?: string;
      dataType: "all";
      value: string;
      matchMode: "includes" | "exact";
      isCaseSensitive: boolean;
      language: string;
      isNegated?: boolean;
    }
  | {
      target: "string";
      value: string;
      matchMode: "includes" | "exact";
      isCaseSensitive: boolean;
      language: string;
      isNegated?: boolean;
    }
  | {
      target:
        | "title"
        | "description"
        | "image"
        | "periods"
        | "bibliography"
        | "notes";
      value: string;
      matchMode: "includes" | "exact";
      isCaseSensitive: boolean;
      language: string;
      isNegated?: boolean;
    };

/**
 * Represents a boolean query group for Set items
 */
export type QueryGroup = { and: Array<Query> } | { or: Array<Query> };

/**
 * Represents a query for Set items
 */
export type Query = QueryLeaf | QueryGroup;
