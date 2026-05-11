import type { MultilingualString } from "#/parsers/multilingual.js";

type Prettify<T> = { [K in keyof T]: T[K] } & {};

/**
 * Language-code tuple or array used by OCHRE multilingual fields.
 *
 * Use the default when the consumer does not need to narrow a value to a
 * specific language tuple.
 */
export type LanguageCodes = ReadonlyArray<string>;

/**
 * The category of an item in OCHRE
 */
export type ItemCategory =
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
 * OCHRE item categories that can contain other items in API payloads.
 */
export type ItemContainerCategory = Extract<ItemCategory, "tree" | "set">;

/**
 * The category of items in a Tree
 */
export type TreeItemCategory = Exclude<ItemCategory, "tree">;

/**
 * The category of items in a Set
 */
export type SetItemCategory = ItemCategory;

export type ContainedItemCategory<U extends ItemCategory = ItemCategory> =
  U extends "tree" ? TreeItemCategory
  : U extends "set" ? SetItemCategory
  : never;

export type ContainedItemCategoryOption<U extends ItemCategory = ItemCategory> =
  U extends "tree" ? TreeItemCategory
  : U extends "set" ? SetItemCategory | ReadonlyArray<SetItemCategory>
  : never;

export type ContainedItemCategoryFromOption<
  U extends ItemCategory = ItemCategory,
  V extends ContainedItemCategoryOption<U> | undefined = undefined,
> =
  V extends ReadonlyArray<infer W> ? Extract<W, ContainedItemCategory<U>>
  : V extends ContainedItemCategory<U> ? V
  : ContainedItemCategory<U>;

/**
 * The category of items in a heading
 */
export type HeadingItemCategory = Exclude<
  ItemCategory,
  "tree" | "bibliography" | "spatialUnit" | "concept" | "period"
>;

/**
 * The category of items that expose recursive subitem structures.
 */
export type RecursiveItemCategory = Exclude<
  ItemCategory,
  "tree" | "person" | "propertyVariable" | "propertyValue" | "set"
>;

/**
 *  The category names that can appear in OCHRE context paths
 */
export type ContextItemCategory = Exclude<
  ItemCategory,
  "tree" | "person" | "set"
>;

/**
 *  Basic identification information
 */
export type Identification<T extends LanguageCodes = LanguageCodes> = {
  label: MultilingualString<T>;
  abbreviation: MultilingualString<T> | null;
  code: string | null;
  email: string | null;
  website: string | null;
};

/**
 *  Metadata in OCHRE
 */
export type Metadata<T extends LanguageCodes = LanguageCodes> = {
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

export type ItemPayloadKind = "topLevel" | "embedded";

type ItemEnvelopeFields<T extends LanguageCodes, U extends ItemPayloadKind> =
  U extends "topLevel" ?
    {
      belongsTo: BelongsTo;
      metadata: Metadata<T>;
      persistentUrl: string | null;
    }
  : { belongsTo: null; metadata: null; persistentUrl: null };

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
export type ContextNode<U extends ContextItemCategory = ContextItemCategory> = {
  tree: ContextItem;
  project: ContextItem;
  heading: Array<ContextItem>;
} & Partial<Record<U, Array<ContextItem>>>;

/**
 *  Context in OCHRE
 */
export type Context<U extends ContextItemCategory = ContextItemCategory> = {
  nodes: Array<ContextNode<U>>;
  displayPath: string;
};

/**
 *  Event in OCHRE
 */
export type Event<T extends LanguageCodes = LanguageCodes> = {
  date: Date | { start: Date; end: Date } | null;
  label: MultilingualString<T>;
  comment: MultilingualString<T> | null;
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
export type CoordinatesSource<T extends LanguageCodes = LanguageCodes> =
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
export type Coordinates<T extends LanguageCodes = LanguageCodes> =
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
export type Image<T extends LanguageCodes = LanguageCodes> = {
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
export type Note<T extends LanguageCodes = LanguageCodes> = {
  number: number;
  title: MultilingualString<T> | null;
  content: MultilingualString<T>;
  authors: Array<Person<T, "embedded">>;
};

/**
 *  Property value content in OCHRE
 */
export type PropertyValueContent<T extends LanguageCodes = LanguageCodes> =
  Prettify<
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
export type Property<T extends LanguageCodes = LanguageCodes> = {
  variable: {
    uuid: string;
    label: MultilingualString<T>;
    publicationDateTime: Date | null;
  };
  values: Array<PropertyValueContent<T>>;
  comment: MultilingualString<T> | null;
  properties: Array<Property<T>>;
};

/**
 * Simplified property in OCHRE website payloads. Simplified property variables
 * expose scalar labels rather than multilingual labels.
 */
export type SimplifiedProperty<T extends LanguageCodes = LanguageCodes> = {
  variable: { uuid: string; label: string; publicationDateTime: Date | null };
  values: Array<PropertyValueContent<T>>;
  comment: MultilingualString<T> | null;
  properties: Array<SimplifiedProperty<T>>;
};

/**
 *  Property in a Set item. OCHRE exposes Set item properties as a flat list.
 */
export type SetItemProperty<T extends LanguageCodes = LanguageCodes> = Omit<
  Property<T>,
  "properties"
>;

export type SetItemSimplifiedProperty<T extends LanguageCodes = LanguageCodes> =
  Omit<SimplifiedProperty<T>, "properties">;

export type PropertyLike<T extends LanguageCodes = LanguageCodes> =
  | Property<T>
  | SetItemProperty<T>
  | SimplifiedProperty<T>
  | SetItemSimplifiedProperty<T>;

export type ItemProperty<T extends LanguageCodes = LanguageCodes> =
  | Property<T>
  | SetItemProperty<T>;

export type PropertyValueDataType = PropertyValueContent["dataType"];

export type QueryablePropertyValueDataType = Exclude<
  PropertyValueDataType,
  "coordinate"
>;

type WithSetItemProperties<
  U extends { properties: Array<Property<T>> },
  T extends LanguageCodes,
> =
  U extends { properties: Array<Property<T>> } ?
    Prettify<Omit<U, "properties"> & { properties: Array<SetItemProperty<T>> }>
  : never;

/**
 *  Base item in OCHRE
 */
export type BaseItem<
  U extends ItemCategory = ItemCategory,
  T extends LanguageCodes = LanguageCodes,
  V extends ItemPayloadKind = "topLevel",
> = ItemEnvelopeFields<T, V> & {
  uuid: string;
  category: U;
  publicationDateTime: Date | null;
  context: Context<ContextItemCategory> | null;
  date: Date | null;
  license: License | null;
  copyright: MultilingualString<T> | null;
  watermark: MultilingualString<T> | null;
  identification: Identification<T>;
  creators: Array<Person<T, "embedded">>;
  description: MultilingualString<T> | null;
  events: Array<Event<T>>;
};

export type ItemLinkCategory = ItemCategory | "dictionaryUnit";

/**
 *  Base item data exposed by OCHRE link and reverse-link payloads.
 */
export type BaseItemLink<
  U extends ItemLinkCategory = ItemLinkCategory,
  T extends LanguageCodes = LanguageCodes,
> = {
  uuid: string;
  category: U;
  publicationDateTime: Date | null;
  context: Context<ContextItemCategory> | null;
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

export type ItemLinks<T extends LanguageCodes = LanguageCodes> = Array<
  ItemLink<ItemLinkCategory, T>
>;

export type TreeItemLink<T extends LanguageCodes = LanguageCodes> = Prettify<
  BaseItemLink<"tree", T> & {
    type: string | null;
    containedItemCategory: TreeItemCategory | null;
  }
>;

export type SetItemLink<T extends LanguageCodes = LanguageCodes> = Prettify<
  BaseItemLink<"set", T> & {
    type: string | null;
    containedItemCategories: Array<SetItemCategory> | null;
  }
>;

export type BibliographyItemLink<T extends LanguageCodes = LanguageCodes> =
  Prettify<
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
      source: ItemLink<TreeItemCategory, T> | null;
      authors: Array<ItemLink<"person", T>>;
      periods: Array<ItemLink<"period", T>>;
      properties: Array<Property<T>>;
    }
  >;

export type ConceptItemLink<T extends LanguageCodes = LanguageCodes> = Prettify<
  BaseItemLink<"concept", T> & {
    image: Image<T> | null;
    coordinates: Array<Coordinates<T>>;
  }
>;

export type SpatialUnitItemLink<T extends LanguageCodes = LanguageCodes> =
  Prettify<
    BaseItemLink<"spatialUnit", T> & {
      image: Image<T> | null;
      coordinates: Array<Coordinates<T>>;
    }
  >;

export type PeriodItemLink<T extends LanguageCodes = LanguageCodes> = Prettify<
  BaseItemLink<"period", T> & {
    type: string | null;
    coordinates: Array<Coordinates<T>>;
  }
>;

export type PersonItemLink<T extends LanguageCodes = LanguageCodes> = Prettify<
  BaseItemLink<"person", T> & {
    type: string | null;
    coordinates: Array<Coordinates<T>>;
  }
>;

export type PropertyVariableItemLink<T extends LanguageCodes = LanguageCodes> =
  Prettify<
    BaseItemLink<"propertyVariable", T> & {
      type: string | null;
      coordinates: Array<Coordinates<T>>;
    }
  >;

export type PropertyValueItemLink<T extends LanguageCodes = LanguageCodes> =
  Prettify<
    BaseItemLink<"propertyValue", T> & { coordinates: Array<Coordinates<T>> }
  >;

export type ResourceItemLink<T extends LanguageCodes = LanguageCodes> =
  Prettify<
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

export type TextItemLink<T extends LanguageCodes = LanguageCodes> = Prettify<
  BaseItemLink<"text", T> & {
    type: string | null;
    text: string | null;
    language: string | null;
    image: Image<T> | null;
    coordinates: Array<Coordinates<T>>;
  }
>;

export type DictionaryUnitItemLink<T extends LanguageCodes = LanguageCodes> =
  Prettify<BaseItemLink<"dictionaryUnit", T>>;

/**
 * An abridged item reference exposed inside OCHRE links and reverse links.
 */
export type ItemLink<
  U extends ItemLinkCategory = ItemLinkCategory,
  T extends LanguageCodes = LanguageCodes,
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
  U extends ItemCategory = ItemCategory,
  V extends ContainedItemCategory<U> = ContainedItemCategory<U>,
  T extends LanguageCodes = LanguageCodes,
  W extends ItemPayloadKind = "topLevel",
> =
  U extends ItemCategory ?
    U extends "tree" ? Tree<Extract<V, TreeItemCategory>, T, W>
    : U extends "set" ? Set<Extract<V, SetItemCategory>, T, W>
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

export type TopLevelItem<
  U extends ItemCategory = ItemCategory,
  V extends ContainedItemCategory<U> = ContainedItemCategory<U>,
  T extends LanguageCodes = LanguageCodes,
> = Item<U, V, T, "topLevel">;

export type EmbeddedItem<
  U extends ItemCategory = ItemCategory,
  V extends ContainedItemCategory<U> = ContainedItemCategory<U>,
  T extends LanguageCodes = LanguageCodes,
> = Item<U, V, T, "embedded">;

export type AnyItem<
  U extends ItemCategory = ItemCategory,
  V extends ContainedItemCategory<U> = ContainedItemCategory<U>,
  T extends LanguageCodes = LanguageCodes,
> = Item<U, V, T, ItemPayloadKind>;

/**
 *  Heading in OCHRE
 */
export type Heading<
  U extends HeadingItemCategory = HeadingItemCategory,
  T extends LanguageCodes = LanguageCodes,
> = {
  name: string;
  headings: Array<Heading<U, T>>;
  items: Array<Item<U, never, T, "embedded">>;
};

/**
 *  Tree in OCHRE
 */
export type Tree<
  U extends TreeItemCategory = TreeItemCategory,
  T extends LanguageCodes = LanguageCodes,
  V extends ItemPayloadKind = "topLevel",
> = Prettify<
  BaseItem<"tree", T, V> & {
    type: string | null;
    containedItemCategory: U | null;
    links: ItemLinks<T>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
    bibliographies: Array<Bibliography<T, "embedded">>;
    items: U extends HeadingItemCategory ?
      Array<Heading<U, T> | Item<U, never, T, "embedded">>
    : Array<Item<U, never, T, "embedded">>;
  }
>;

/**
 *  Set in OCHRE
 */
export type Set<
  U extends SetItemCategory = SetItemCategory,
  T extends LanguageCodes = LanguageCodes,
  V extends ItemPayloadKind = "topLevel",
> = Prettify<
  BaseItem<"set", T, V> & {
    containedItemCategories: Array<U>;
    isTabularStructure: boolean;
    isSuppressingBlanks: boolean;
    links: ItemLinks<T>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
    items: Array<SetItem<U, T>>;
  }
>;

export type SetBibliography<T extends LanguageCodes = LanguageCodes> =
  Bibliography<T, "embedded"> extends infer U ?
    U extends { properties: Array<Property<T>> } ?
      Prettify<
        Omit<U, "properties" | "items"> & {
          properties: Array<SetItemProperty<T>>;
        }
      >
    : never
  : never;

export type SetConcept<T extends LanguageCodes = LanguageCodes> = Prettify<
  Omit<Concept<T, "embedded">, "interpretations" | "items"> & {
    properties: Array<SetItemProperty<T>>;
  }
>;

export type SetSpatialUnit<T extends LanguageCodes = LanguageCodes> = Prettify<
  Omit<SpatialUnit<T, "embedded">, "observations" | "items"> & {
    properties: Array<SetItemProperty<T>>;
  }
>;

export type SetPeriod<T extends LanguageCodes = LanguageCodes> = Prettify<
  Omit<WithSetItemProperties<Period<T, "embedded">, T>, "items">
>;

export type SetResource<T extends LanguageCodes = LanguageCodes> = Prettify<
  Omit<WithSetItemProperties<Resource<T, "embedded">, T>, "items">
>;

export type SetTree<T extends LanguageCodes = LanguageCodes> = Prettify<
  Omit<WithSetItemProperties<Tree<TreeItemCategory, T, "embedded">, T>, "items">
>;

export type SetItem<
  U extends SetItemCategory = SetItemCategory,
  T extends LanguageCodes = LanguageCodes,
> =
  U extends "tree" ? SetTree<T>
  : U extends "bibliography" ? SetBibliography<T>
  : U extends "concept" ? SetConcept<T>
  : U extends "spatialUnit" ? SetSpatialUnit<T>
  : U extends "period" ? SetPeriod<T>
  : U extends "person" ? WithSetItemProperties<Person<T, "embedded">, T>
  : U extends "propertyVariable" ? PropertyVariable<T, "embedded">
  : U extends "propertyValue" ?
    WithSetItemProperties<PropertyValue<T, "embedded">, T>
  : U extends "resource" ? SetResource<T>
  : U extends "text" ? Text<T, "embedded">
  : U extends "set" ?
    Omit<WithSetItemProperties<Set<SetItemCategory, T, "embedded">, T>, "items">
  : never;

/**
 *  Person in OCHRE
 */
export type Person<
  T extends LanguageCodes = LanguageCodes,
  U extends ItemPayloadKind = "topLevel",
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
    periods: Array<Period<T, "embedded">>;
    links: ItemLinks<T>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
  }
>;

/**
 *  Period in OCHRE
 */
export type Period<
  T extends LanguageCodes = LanguageCodes,
  U extends ItemPayloadKind = "topLevel",
> = Prettify<
  BaseItem<"period", T, U> & {
    type: string | null;
    coordinates: Array<Coordinates<T>>;
    links: ItemLinks<T>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
    bibliographies: Array<Bibliography<T, "embedded">>;
    items: Array<Period<T, "embedded">>;
  }
>;

/**
 *  Bibliography in OCHRE
 */
export type Bibliography<
  T extends LanguageCodes = LanguageCodes,
  U extends ItemPayloadKind = "topLevel",
> = Prettify<
  BaseItem<"bibliography", T, U> & {
    citationDetails: string | null;
    citationFormat: MultilingualString<T> | null;
    citationFormatSpan: string | null;
    referenceFormatDiv: string | null;
    image: Image<T> | null;
    sourceDocument: BibliographySourceDocument | null;
    publicationInfo: {
      publishers: Array<Person<T, "embedded">>;
      startDate: Date | null;
    } | null;
    entryInfo: BibliographyEntryInfo | null;
    source: ItemLink<TreeItemCategory, T> | null;
    authors: Array<Person<T, "embedded">>;
    periods: Array<Period<T, "embedded">>;
    links: ItemLinks<T>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
    bibliographies: Array<Bibliography<T, "embedded">>;
    items: Array<Bibliography<T, "embedded">>;
  } & (
      | { type: "zotero"; zoteroId: string; uuid: string | null }
      | { type: string | null }
    )
>;

/**
 *  Concept in OCHRE
 */
export type Concept<
  T extends LanguageCodes = LanguageCodes,
  U extends ItemPayloadKind = "topLevel",
> = Prettify<
  BaseItem<"concept", T, U> & {
    image: Image<T> | null;
    interpretations: Array<Interpretation<T>>;
    coordinates: Array<Coordinates<T>>;
    items: Array<Concept<T, "embedded">>;
  }
>;

/**
 *  Interpretation in OCHRE
 */
export type Interpretation<T extends LanguageCodes = LanguageCodes> = {
  number: number;
  date: Date | null;
  observers: Array<Person<T, "embedded">>;
  periods: Array<Period<T, "embedded">>;
  links: ItemLinks<T>;
  notes: Array<Note<T>>;
  properties: Array<Property<T>>;
  bibliographies: Array<Bibliography<T, "embedded">>;
};

/**
 *  Spatial unit in OCHRE
 */
export type SpatialUnit<
  T extends LanguageCodes = LanguageCodes,
  U extends ItemPayloadKind = "topLevel",
> = Prettify<
  BaseItem<"spatialUnit", T, U> & {
    image: Image<T> | null;
    coordinates: Array<Coordinates<T>>;
    mapData: { geoJSON: { multiPolygon: string; EPSG: number } } | null;
    observations: Array<Observation<T>>;
    bibliographies: Array<Bibliography<T, "embedded">>;
    items: Array<SpatialUnit<T, "embedded">>;
  }
>;

/**
 *  Observation in OCHRE
 */
export type Observation<T extends LanguageCodes = LanguageCodes> = {
  number: number;
  date: Date | null;
  observers: Array<string> | Array<Person<T, "embedded">>;
  periods: Array<Period<T, "embedded">>;
  links: ItemLinks<T>;
  notes: Array<Note<T>>;
  properties: Array<Property<T>>;
  bibliographies: Array<Bibliography<T, "embedded">>;
};

/**
 *  Property variable in OCHRE
 */
export type PropertyVariable<
  T extends LanguageCodes = LanguageCodes,
  U extends ItemPayloadKind = "topLevel",
> = Prettify<
  BaseItem<"propertyVariable", T, U> & {
    type: string | null;
    coordinates: Array<Coordinates<T>>;
    links: ItemLinks<T>;
    notes: Array<Note<T>>;
    bibliographies: Array<Bibliography<T, "embedded">>;
  }
>;

/**
 *  Property value in OCHRE
 */
export type PropertyValue<
  T extends LanguageCodes = LanguageCodes,
  U extends ItemPayloadKind = "topLevel",
> = Prettify<
  BaseItem<"propertyValue", T, U> & {
    coordinates: Array<Coordinates<T>>;
    links: ItemLinks<T>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
    bibliographies: Array<Bibliography<T, "embedded">>;
  }
>;

/**
 *  Resource in OCHRE
 */
export type Resource<
  T extends LanguageCodes = LanguageCodes,
  U extends ItemPayloadKind = "topLevel",
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
    periods: Array<Period<T, "embedded">>;
    links: ItemLinks<T>;
    reverseLinks: ItemLinks<T>;
    notes: Array<Note<T>>;
    properties: Array<Property<T>>;
    bibliographies: Array<Bibliography<T, "embedded">>;
    items: Array<Resource<T, "embedded">>;
  }
>;

/**
 *  Text in OCHRE
 */
export type Text<
  T extends LanguageCodes = LanguageCodes,
  U extends ItemPayloadKind = "topLevel",
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
    periods: Array<Period<T, "embedded">>;
    creators: Array<Person<T, "embedded">>;
    editions: Array<Person<T, "embedded">>;
  }
>;

/**
 *  Section in OCHRE
 */
export type Section<T extends LanguageCodes = LanguageCodes> = {
  uuid: string;
  publicationDateTime: Date | null;
  identification: Identification<T>;
  project: { identification: Identification<T> } | null;
};

export type EmbeddedTree<
  U extends TreeItemCategory = TreeItemCategory,
  T extends LanguageCodes = LanguageCodes,
> = Tree<U, T, "embedded">;

export type AnyTree<
  U extends TreeItemCategory = TreeItemCategory,
  T extends LanguageCodes = LanguageCodes,
> = Tree<U, T, ItemPayloadKind>;

export type EmbeddedSet<
  U extends SetItemCategory = SetItemCategory,
  T extends LanguageCodes = LanguageCodes,
> = Set<U, T, "embedded">;

export type AnySet<
  U extends SetItemCategory = SetItemCategory,
  T extends LanguageCodes = LanguageCodes,
> = Set<U, T, ItemPayloadKind>;

export type EmbeddedBibliography<T extends LanguageCodes = LanguageCodes> =
  Bibliography<T, "embedded">;

export type AnyBibliography<T extends LanguageCodes = LanguageCodes> =
  Bibliography<T, ItemPayloadKind>;

export type EmbeddedConcept<T extends LanguageCodes = LanguageCodes> = Concept<
  T,
  "embedded"
>;

export type AnyConcept<T extends LanguageCodes = LanguageCodes> = Concept<
  T,
  ItemPayloadKind
>;

export type EmbeddedSpatialUnit<T extends LanguageCodes = LanguageCodes> =
  SpatialUnit<T, "embedded">;

export type AnySpatialUnit<T extends LanguageCodes = LanguageCodes> =
  SpatialUnit<T, ItemPayloadKind>;

export type EmbeddedPeriod<T extends LanguageCodes = LanguageCodes> = Period<
  T,
  "embedded"
>;

export type AnyPeriod<T extends LanguageCodes = LanguageCodes> = Period<
  T,
  ItemPayloadKind
>;

export type EmbeddedPerson<T extends LanguageCodes = LanguageCodes> = Person<
  T,
  "embedded"
>;

export type AnyPerson<T extends LanguageCodes = LanguageCodes> = Person<
  T,
  ItemPayloadKind
>;

export type EmbeddedPropertyVariable<T extends LanguageCodes = LanguageCodes> =
  PropertyVariable<T, "embedded">;

export type AnyPropertyVariable<T extends LanguageCodes = LanguageCodes> =
  PropertyVariable<T, ItemPayloadKind>;

export type EmbeddedPropertyValue<T extends LanguageCodes = LanguageCodes> =
  PropertyValue<T, "embedded">;

export type AnyPropertyValue<T extends LanguageCodes = LanguageCodes> =
  PropertyValue<T, ItemPayloadKind>;

export type EmbeddedResource<T extends LanguageCodes = LanguageCodes> =
  Resource<T, "embedded">;

export type AnyResource<T extends LanguageCodes = LanguageCodes> = Resource<
  T,
  ItemPayloadKind
>;

export type EmbeddedText<T extends LanguageCodes = LanguageCodes> = Text<
  T,
  "embedded"
>;

export type AnyText<T extends LanguageCodes = LanguageCodes> = Text<
  T,
  ItemPayloadKind
>;

/**
 * Represents a gallery with its identification, project identification, resources and max length
 */
export type Gallery<T extends LanguageCodes = LanguageCodes> = {
  identification: Identification<T>;
  projectIdentification: Identification<T>;
  resources: Array<Resource<T, "embedded">>;
  maxLength: number;
};

/**
 * Represents a property query item with its UUID, raw value, count, and content
 */
export type PropertyValueQueryItem = {
  count: number;
  dataType: QueryablePropertyValueDataType;
  content: string | number | boolean | null;
  label: MultilingualString | null;
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
      dataType: QueryablePropertyValueDataType;
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
      dataType: Exclude<QueryablePropertyValueDataType, "date" | "dateTime">;
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
