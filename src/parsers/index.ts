import { parseISO } from "date-fns";
import type {
  BaseItem,
  BaseItemLink,
  Bibliography,
  BibliographyEntryInfo,
  BibliographySourceDocument,
  Concept,
  Context,
  ContextDataCategory,
  ContextItem,
  ContextNode,
  Coordinates,
  CoordinatesSource,
  DataCategory,
  Event,
  Gallery,
  Heading,
  HeadingDataCategory,
  HierarchyItemCategoryFromOption,
  HierarchyItemCategoryOption,
  HierarchyItemDataCategory,
  Identification,
  Image,
  ImageMap,
  ImageMapArea,
  Interpretation,
  Item,
  ItemLink,
  ItemLinkCategory,
  ItemLinks,
  ItemsDataCategory,
  Metadata,
  Note,
  Observation,
  Period,
  Person,
  Property,
  PropertyValue,
  PropertyValueContent,
  PropertyVariable,
  Resource,
  Section,
  Set,
  SetBibliography,
  SetConcept,
  SetItem,
  SetItemDataCategory,
  SetPeriod,
  SetResource,
  SetSpatialUnit,
  SetTree,
  SingleHierarchyProperty,
  SpatialUnit,
  Text,
  Tree,
} from "#/types/index.js";
import type {
  XMLBaseItem,
  XMLBibliography,
  XMLConcept,
  XMLContent,
  XMLContext,
  XMLContextValue,
  XMLCoordinate,
  XMLCoordinates,
  XMLData,
  XMLDataItem,
  XMLDictionaryUnit,
  XMLEvent,
  XMLGalleryData,
  XMLHeading,
  XMLIdentification,
  XMLImage,
  XMLImageMap,
  XMLImageMapArea,
  XMLInterpretation,
  XMLItemLinks,
  XMLLink,
  XMLLinkedBibliography,
  XMLLinkedConcept,
  XMLLinkedPeriod,
  XMLLinkedPerson,
  XMLLinkedPropertyValue,
  XMLLinkedPropertyVariable,
  XMLLinkedResource,
  XMLLinkedSet,
  XMLLinkedSpatialUnit,
  XMLLinkedText,
  XMLLinkedTree,
  XMLMetadata,
  XMLNote,
  XMLObservation,
  XMLPeriod,
  XMLPerson,
  XMLProperty,
  XMLPropertyValue as XMLPropertyValueItem,
  XMLPropertyVariable,
  XMLResource,
  XMLSection,
  XMLSet,
  XMLSetItems,
  XMLSpatialUnit,
  XMLString,
  XMLText,
  XMLTree,
} from "#/xml/types.js";
import { DEFAULT_LANGUAGES } from "#/constants.js";
import { MultilingualString } from "#/parsers/multilingual.js";
import {
  parseXMLContent,
  parseXMLString,
  transformPermanentIdentificationUrl,
} from "#/parsers/string.js";

export type ParserOptions<T extends ReadonlyArray<string>> = {
  languages: T;
  isRichText: boolean;
};

export function getParserOptions<T extends ReadonlyArray<string>>(
  options: ParserOptions<T>,
): ParserOptions<T> {
  return { languages: options.languages, isRichText: options.isRichText };
}

type XMLItemHierarchy = Partial<{
  heading: Array<XMLHeading>;
  tree: Array<XMLTree>;
  bibliography: Array<XMLBibliography>;
  concept: Array<XMLConcept>;
  spatialUnit: Array<XMLSpatialUnit>;
  period: Array<XMLPeriod>;
  person: Array<XMLPerson>;
  propertyVariable: Array<XMLPropertyVariable>;
  variable: Array<XMLPropertyVariable>;
  propertyValue: Array<XMLPropertyValueItem>;
  value: Array<XMLPropertyValueItem>;
  resource: Array<XMLResource | { resource: Array<XMLResource> }>;
  text: Array<XMLText>;
  set: Array<XMLSet>;
}>;

type XMLItemLinkHierarchy = Partial<{
  tree: Array<XMLLinkedTree>;
  bibliography: Array<XMLLinkedBibliography>;
  concept: Array<XMLLinkedConcept>;
  spatialUnit: Array<XMLLinkedSpatialUnit>;
  period: Array<XMLLinkedPeriod>;
  person: Array<XMLLinkedPerson>;
  propertyVariable: Array<XMLLinkedPropertyVariable>;
  variable: Array<XMLLinkedPropertyVariable>;
  propertyValue: Array<XMLLinkedPropertyValue>;
  value: Array<XMLLinkedPropertyValue>;
  resource: Array<XMLLinkedResource | { resource: Array<XMLLinkedResource> }>;
  text: Array<XMLLinkedText>;
  set: Array<XMLLinkedSet>;
  dictionaryUnit: Array<XMLDictionaryUnit>;
}>;

export type RawOchre = XMLData["result"]["ochre"];

type SetItemCategoryFromCategories<
  T extends ReadonlyArray<SetItemDataCategory> | undefined,
> =
  T extends ReadonlyArray<infer U> ? Extract<U, SetItemDataCategory>
  : SetItemDataCategory;

type PropertyDataType =
  | "string"
  | "coordinate"
  | "IDREF"
  | "date"
  | "dateTime"
  | "integer"
  | "decimal"
  | "time"
  | "boolean";

type XMLPropertyValueNode = NonNullable<XMLProperty["value"]>[number] & {
  payload?: string;
};

type XMLContextValueHierarchy = Record<
  string,
  Array<XMLContextValue> | undefined
>;

const TREE_ITEM_DATA_CATEGORIES = [
  "bibliography",
  "concept",
  "spatialUnit",
  "period",
  "person",
  "propertyVariable",
  "propertyValue",
  "resource",
  "text",
  "set",
] as const satisfies ReadonlyArray<ItemsDataCategory>;

const SET_ITEM_DATA_CATEGORIES = [
  "tree",
  ...TREE_ITEM_DATA_CATEGORIES,
] as const satisfies ReadonlyArray<SetItemDataCategory>;

const HEADING_DATA_CATEGORIES = [
  "person",
  "propertyVariable",
  "propertyValue",
  "resource",
  "text",
  "set",
] as const satisfies ReadonlyArray<HeadingDataCategory>;

const CONTEXT_CATEGORY_MAPPINGS = [
  { raw: "bibliography", parsed: "bibliography" },
  { raw: "concept", parsed: "concept" },
  { raw: "spatialUnit", parsed: "spatialUnit" },
  { raw: "period", parsed: "period" },
  { raw: "propertyVariable", parsed: "propertyVariable" },
  { raw: "variable", parsed: "propertyVariable" },
  { raw: "propertyValue", parsed: "propertyValue" },
  { raw: "value", parsed: "propertyValue" },
  { raw: "resource", parsed: "resource" },
  { raw: "text", parsed: "text" },
] as const satisfies ReadonlyArray<{
  raw: string;
  parsed: ContextDataCategory;
}>;

const PROPERTY_DATA_TYPES = [
  "string",
  "coordinate",
  "IDREF",
  "date",
  "dateTime",
  "integer",
  "decimal",
  "time",
  "boolean",
] as const satisfies ReadonlyArray<PropertyDataType>;

export function parseOptionalDate(value: string | undefined): Date | null {
  if (value == null || value === "") {
    return null;
  }

  return parseISO(value.replace(" ", "T"));
}

function parseOptionalDateLike(
  value: string | XMLString | undefined,
): Date | null {
  if (value == null || typeof value !== "string") {
    return null;
  }

  return parseOptionalDate(value);
}

export function parseNumber(
  value: string | XMLString | undefined,
): number | null {
  if (value == null || value === "") {
    return null;
  }

  const parsedValue = Number(typeof value === "string" ? value : value.payload);
  return Number.isNaN(parsedValue) ? null : parsedValue;
}

export function parseNumberOrZero(
  value: string | XMLString | undefined,
): number {
  return parseNumber(value) ?? 0;
}

export function parseBoolean(value: string | undefined): boolean {
  return value === "true";
}

export function parseStringLike(
  value: XMLString | string | undefined,
  options: { isRichText: boolean; parseEmail?: boolean },
): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return parseXMLString(value, {
    isRichText: options.isRichText,
    parseEmail: options.parseEmail ?? false,
  });
}

function isXMLContent(value: XMLContent | XMLString): value is XMLContent {
  return "content" in value;
}

function multilingualFromText<T extends ReadonlyArray<string>>(
  text: string,
  options: ParserOptions<T>,
): MultilingualString<T> {
  const content: Partial<Record<T[number], string>> = {};
  for (const language of options.languages) {
    content[language as T[number]] = text;
  }

  return MultilingualString.fromObject(content, options.languages, {
    isRichText: options.isRichText,
  });
}

function parseContentLike<T extends ReadonlyArray<string>>(
  value: XMLContent | XMLString | string | undefined,
  options: ParserOptions<T>,
): MultilingualString<T> | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    return multilingualFromText(value, options);
  }

  if (!isXMLContent(value)) {
    return multilingualFromText(
      parseXMLString(value, {
        isRichText: options.isRichText,
        parseEmail: true,
      }),
      options,
    );
  }

  return parseXMLContent<T>(value, {
    languages: options.languages,
    isRichText: options.isRichText,
  });
}

function parseRequiredContentLike<T extends ReadonlyArray<string>>(
  value: XMLContent | XMLString,
  options: ParserOptions<T>,
): MultilingualString<T> {
  return (
    parseContentLike(value, options) ??
    MultilingualString.empty(options.languages, {
      isRichText: options.isRichText,
    })
  );
}

function parseContentLikeText<T extends ReadonlyArray<string>>(
  value: XMLContent | XMLString | undefined,
  options: ParserOptions<T>,
): string {
  return parseContentLike(value, options)?.getText().trim() ?? "";
}

export function parseIdentification<T extends ReadonlyArray<string>>(
  rawIdentification: XMLIdentification,
  options: ParserOptions<T>,
): Identification<T> {
  const label = parseRequiredContentLike(rawIdentification.label, options);
  const abbreviation = parseContentLike(
    rawIdentification.abbreviation,
    options,
  );

  return {
    label,
    abbreviation,
    code: parseStringLike(rawIdentification.code, { isRichText: false }),
    email: parseStringLike(rawIdentification.email, { isRichText: false }),
    website: parseStringLike(rawIdentification.website, { isRichText: false }),
  };
}

function emptyIdentification<T extends ReadonlyArray<string>>(
  options: ParserOptions<T>,
): Identification<T> {
  return {
    label: MultilingualString.empty(options.languages, {
      isRichText: options.isRichText,
    }),
    abbreviation: null,
    code: null,
    email: null,
    website: null,
  };
}

function parseOptionalIdentification<T extends ReadonlyArray<string>>(
  rawIdentification: XMLIdentification | undefined,
  options: ParserOptions<T>,
): Identification<T> {
  return rawIdentification == null ?
      emptyIdentification(options)
    : parseIdentification(rawIdentification, options);
}

function parseContextItem(contextItem: XMLContextValue): ContextItem {
  return {
    uuid: contextItem.uuid ?? null,
    publicationDateTime: parseOptionalDate(contextItem.publicationDateTime),
    index: parseNumberOrZero(contextItem.n),
    content: contextItem.payload,
  };
}

function emptyContextItem(): ContextItem {
  return { uuid: null, publicationDateTime: null, index: 0, content: "" };
}

function parseContext(rawContext: XMLContext): Context<ContextDataCategory> {
  const nodes: Array<ContextNode<ContextDataCategory>> = [];

  for (const rawContextOuterItem of rawContext) {
    for (const rawContextItem of rawContextOuterItem.context) {
      const node: ContextNode<ContextDataCategory> = {
        tree:
          rawContextItem.tree[0] == null ?
            emptyContextItem()
          : parseContextItem(rawContextItem.tree[0]),
        project: parseContextItem(rawContextItem.project),
        heading: [],
      };

      const rawContextValues =
        rawContextItem as unknown as XMLContextValueHierarchy;
      for (const heading of rawContextValues.heading ?? []) {
        node.heading.push(parseContextItem(heading));
      }

      for (const { raw, parsed } of CONTEXT_CATEGORY_MAPPINGS) {
        const contextValues = rawContextValues[raw] ?? [];
        for (const contextValue of contextValues) {
          const parsedItems = node[parsed] ?? [];
          parsedItems.push(parseContextItem(contextValue));
          node[parsed] = parsedItems;
        }
      }

      nodes.push(node);
    }
  }

  return { nodes, displayPath: rawContext[0]?.displayPath ?? "" };
}

function parseEventReference<T extends ReadonlyArray<string>>(
  rawReference:
    | (XMLContent & { uuid: string; publicationDateTime?: string })
    | undefined,
  options: ParserOptions<T>,
): {
  uuid: string;
  label: MultilingualString<T>;
  publicationDateTime: Date | null;
} | null {
  if (rawReference == null) {
    return null;
  }

  return {
    uuid: rawReference.uuid,
    label: parseRequiredContentLike(rawReference, options),
    publicationDateTime: parseOptionalDate(rawReference.publicationDateTime),
  };
}

function parseEvent<T extends ReadonlyArray<string>>(
  rawEvent: XMLEvent,
  options: ParserOptions<T>,
): Event<T> {
  const startDate = parseOptionalDate(rawEvent.dateTime);
  const endDate = parseOptionalDate(rawEvent.endDateTime);
  const date =
    startDate == null ? null
    : endDate == null ? startDate
    : { start: startDate, end: endDate };

  return {
    date,
    label: parseRequiredContentLike(rawEvent.label, options),
    comment: parseContentLike(rawEvent.comment, options)?.getText() ?? null,
    agent: parseEventReference(rawEvent.agent, options),
    location: parseEventReference(rawEvent.location, options),
    other:
      rawEvent.other == null ?
        null
      : {
          uuid: rawEvent.other.uuid ?? null,
          category: normalizeCategory(rawEvent.other.category),
          label: parseRequiredContentLike(rawEvent.other, options),
        },
  };
}

function parseBaseItem<U extends DataCategory, T extends ReadonlyArray<string>>(
  category: U,
  rawItem: Partial<XMLBaseItem> & {
    uuid?: string;
    publicationDateTime?: string;
    date?: string | XMLString;
  },
  options: ParserOptions<T>,
): BaseItem<U, T, "nested"> {
  const events: Array<Event<T>> = [];
  for (const event of rawItem.events?.event ?? []) {
    events.push(parseEvent(event, options));
  }

  const creators: Array<Person<T, "nested">> = [];
  for (const creator of rawItem.creators?.creator ?? []) {
    creators.push(parsePerson(creator, options));
  }

  return {
    uuid: rawItem.uuid ?? "",
    category,
    belongsTo: null,
    metadata: null,
    persistentUrl: null,
    publicationDateTime: parseOptionalDate(rawItem.publicationDateTime),
    context: rawItem.context == null ? null : parseContext(rawItem.context),
    date: parseOptionalDateLike(rawItem.date),
    license:
      rawItem.availability == null ?
        null
      : {
          content:
            parseStringLike(rawItem.availability.license, {
              isRichText: false,
            }) ?? "",
          target: rawItem.availability.license.target ?? null,
        },
    copyright:
      rawItem.copyright == null ?
        null
      : parseContentLike(rawItem.copyright, options),
    watermark:
      rawItem.watermark == null ?
        null
      : parseContentLike(rawItem.watermark, options),
    identification: parseOptionalIdentification(
      rawItem.identification,
      options,
    ),
    creators,
    description: parseContentLike(rawItem.description, options),
    events,
  };
}

function normalizeCategory(category: string | undefined): DataCategory | null {
  if (category == null) {
    return null;
  }

  if (category === "variable") {
    return "propertyVariable";
  }

  if (category === "value") {
    return "propertyValue";
  }

  for (const dataCategory of SET_ITEM_DATA_CATEGORIES) {
    if (category === dataCategory) {
      return dataCategory;
    }
  }

  return null;
}

function isHeadingDataCategory(
  category: ItemsDataCategory,
): category is HeadingDataCategory {
  return HEADING_DATA_CATEGORIES.includes(category as HeadingDataCategory);
}

function pushCategoryIfPresent(
  categories: Array<SetItemDataCategory>,
  category: SetItemDataCategory,
  items: Array<unknown> | undefined,
): void {
  if ((items?.length ?? 0) === 0) {
    return;
  }

  pushCategory(categories, category);
}

function pushCategory(
  categories: Array<SetItemDataCategory>,
  category: SetItemDataCategory,
): void {
  if (!categories.includes(category)) {
    categories.push(category);
  }
}

function inferItemCategories(
  hierarchy: XMLItemHierarchy | undefined,
): Array<SetItemDataCategory> {
  const categories: Array<SetItemDataCategory> = [];
  if (hierarchy == null) {
    return categories;
  }

  for (const heading of hierarchy.heading ?? []) {
    for (const category of inferItemCategories(heading as XMLItemHierarchy)) {
      pushCategory(categories, category);
    }
  }

  for (const category of SET_ITEM_DATA_CATEGORIES) {
    if (category === "propertyVariable") {
      pushCategoryIfPresent(categories, category, hierarchy.propertyVariable);
      pushCategoryIfPresent(categories, category, hierarchy.variable);
      continue;
    }

    if (category === "propertyValue") {
      pushCategoryIfPresent(categories, category, hierarchy.propertyValue);
      pushCategoryIfPresent(categories, category, hierarchy.value);
      continue;
    }

    pushCategoryIfPresent(categories, category, hierarchy[category]);
  }

  return categories;
}

function normalizeSetItemCategories<U extends SetItemDataCategory>(
  itemCategory: U | ReadonlyArray<U> | undefined,
): Array<U> | null {
  if (itemCategory == null) {
    return null;
  }

  const categories =
    typeof itemCategory === "string" ? [itemCategory] : itemCategory;
  const uniqueCategories: Array<U> = [];
  for (const category of categories) {
    if (!uniqueCategories.includes(category)) {
      uniqueCategories.push(category);
    }
  }

  return uniqueCategories;
}

function normalizeTreeItemCategory(
  itemCategory:
    | SetItemDataCategory
    | ReadonlyArray<SetItemDataCategory>
    | undefined,
): ItemsDataCategory | undefined {
  if (itemCategory != null && typeof itemCategory !== "string") {
    throw new Error("Tree itemCategory must be a single category");
  }

  if (itemCategory === "tree") {
    throw new Error('Tree itemCategory cannot be "tree"');
  }

  return itemCategory;
}

function resolveTreeItemCategory<U extends ItemsDataCategory>(
  rawTree: XMLTree,
  itemCategory: U | undefined,
): U | null {
  const inferredCategories = inferItemCategories(rawTree.items);
  if (inferredCategories.length > 1) {
    throw new Error(
      `Expected Tree items to contain one category, received ${inferredCategories.join(", ")}`,
    );
  }

  const inferredCategory = inferredCategories[0] ?? null;
  if (inferredCategory === "tree") {
    throw new Error('Tree items cannot contain category "tree"');
  }

  if (
    itemCategory != null &&
    inferredCategory != null &&
    itemCategory !== inferredCategory
  ) {
    throw new Error(
      `Tree itemCategory "${itemCategory}" does not match XML items category "${inferredCategory}"`,
    );
  }

  return itemCategory ?? (inferredCategory as U | null);
}

function parseImage<T extends ReadonlyArray<string>>(
  rawImage: XMLImage | undefined,
  options: ParserOptions<T>,
): Image<T> | null {
  if (rawImage == null) {
    return null;
  }

  return {
    publicationDateTime: parseOptionalDate(rawImage.publicationDateTime),
    identification:
      rawImage.identification == null ?
        null
      : parseIdentification(rawImage.identification, options),
    href: parseHref(rawImage.href),
    htmlImgSrcPrefix: rawImage.htmlImgSrcPrefix ?? null,
    height: parseNumber(rawImage.height),
    width: parseNumber(rawImage.width),
    fileSize: parseNumber(rawImage.fileSize),
    base64: rawImage.payload ?? null,
  };
}

function parseHref(href: string | undefined): string | null {
  return href == null ? null : transformPermanentIdentificationUrl(href);
}

function parseCoordinatesSource<T extends ReadonlyArray<string>>(
  source: XMLCoordinate["source"] | undefined,
  options: ParserOptions<T>,
): CoordinatesSource<T> | null {
  if (source == null) {
    return null;
  }

  switch (source.context) {
    case "self": {
      return {
        context: "self",
        uuid: source.label.uuid,
        label: parseRequiredContentLike(source.label, options),
      };
    }
    case "related": {
      const value = source.value[0];
      return {
        context: "related",
        uuid: source.label.uuid,
        label: parseRequiredContentLike(source.label, options),
        value:
          value == null ?
            MultilingualString.empty(options.languages, {
              isRichText: options.isRichText,
            })
          : parseRequiredContentLike(value, options),
      };
    }
    case "inherited": {
      return {
        context: "inherited",
        uuid: source.label.uuid,
        label: parseRequiredContentLike(source.label, options),
        item: {
          uuid: source.item.label.uuid ?? source.item.uuid ?? null,
          label: parseRequiredContentLike(source.item.label, options),
        },
      };
    }
  }
}

function parseCoordinate<T extends ReadonlyArray<string>>(
  coordinate: XMLCoordinate,
  options: ParserOptions<T>,
): Coordinates<T> {
  switch (coordinate.type) {
    case "point": {
      return {
        type: "point",
        latitude: parseNumberOrZero(coordinate.latitude),
        longitude: parseNumberOrZero(coordinate.longitude),
        altitude: parseNumber(coordinate.altitude),
        source: parseCoordinatesSource(coordinate.source, options),
      };
    }
    case "plane": {
      return {
        type: "plane",
        minimum: {
          latitude: parseNumberOrZero(coordinate.minimum.latitude),
          longitude: parseNumberOrZero(coordinate.minimum.longitude),
        },
        maximum: {
          latitude: parseNumberOrZero(coordinate.maximum.latitude),
          longitude: parseNumberOrZero(coordinate.maximum.longitude),
        },
        source: parseCoordinatesSource(coordinate.source, options),
      };
    }
  }
}

function parseCoordinates<T extends ReadonlyArray<string>>(
  rawCoordinates: XMLCoordinates | undefined,
  options: ParserOptions<T>,
): Array<Coordinates<T>> {
  const coordinates: Array<Coordinates<T>> = [];
  for (const coordinate of rawCoordinates?.coord ?? []) {
    coordinates.push(parseCoordinate(coordinate, options));
  }

  return coordinates;
}

function parseImageMapArea(area: XMLImageMapArea): ImageMapArea {
  const coords: Array<number> = [];
  for (const coord of area.coords.split(",")) {
    const parsedCoord = Number(coord.trim());
    coords.push(Number.isNaN(parsedCoord) ? 0 : parsedCoord);
  }

  const shape =
    area.shape === "rectangle" || area.shape === "rect" ? "rectangle"
    : area.shape === "circle" ? "circle"
    : "polygon";

  return {
    uuid: area.uuid,
    publicationDateTime: parseOptionalDate(area.publicationDateTime),
    type: area.type,
    title: area.title,
    items:
      shape === "rectangle" ?
        [
          {
            shape,
            coords: [
              coords[0] ?? 0,
              coords[1] ?? 0,
              coords[2] ?? 0,
              coords[3] ?? 0,
            ],
          },
        ]
      : shape === "circle" ?
        [
          {
            shape,
            center: { x: coords[0] ?? 0, y: coords[1] ?? 0 },
            radius: coords[2] ?? 0,
          },
        ]
      : [{ shape, coords }],
  };
}

function parseImageMap(rawImageMap: XMLImageMap | undefined): ImageMap | null {
  if (rawImageMap == null) {
    return null;
  }

  const areas: Array<ImageMapArea> = [];
  for (const area of rawImageMap.area) {
    areas.push(parseImageMapArea(area));
  }

  return {
    areas,
    width: parseNumberOrZero(rawImageMap.width),
    height: parseNumberOrZero(rawImageMap.height),
  };
}

function parseNote<T extends ReadonlyArray<string>>(
  rawNote: XMLNote,
  options: ParserOptions<T>,
): Note<T> {
  const authors: Array<Person<T, "nested">> = [];
  for (const author of rawNote.authors?.author ?? []) {
    authors.push(parsePerson(author, options));
  }

  let title = rawNote.title ?? null;
  if (title == null) {
    for (const content of rawNote.content ?? []) {
      if (options.languages.includes(content.lang) && content.title != null) {
        title = content.title;
        break;
      }
    }
  }

  const content =
    rawNote.content == null ?
      multilingualFromText(
        parseXMLString(rawNote, {
          isRichText: options.isRichText,
          parseEmail: true,
        }),
        options,
      )
    : parseRequiredContentLike(rawNote as XMLContent, options);

  return { number: parseNumberOrZero(rawNote.noteNo), title, content, authors };
}

export function parseNotes<T extends ReadonlyArray<string>>(
  rawNotes: { note: Array<XMLNote> } | undefined,
  options: ParserOptions<T>,
): Array<Note<T>> {
  const notes: Array<Note<T>> = [];
  for (const note of rawNotes?.note ?? []) {
    notes.push(parseNote(note, options));
  }

  return notes;
}

function parsePropertyDataType(dataType: string | undefined): PropertyDataType {
  if (dataType == null || dataType === "") {
    return "string";
  }

  for (const propertyDataType of PROPERTY_DATA_TYPES) {
    if (dataType === propertyDataType) {
      return propertyDataType;
    }
  }

  throw new Error(`Invalid property value data type: ${dataType}`);
}

function parsePropertyValueContent<T extends ReadonlyArray<string>>(
  value: XMLPropertyValueNode,
  options: ParserOptions<T>,
): PropertyValueContent<T> {
  const dataType = parsePropertyDataType(value.dataType);
  const rawLabel =
    value.content == null ?
      null
    : parseRequiredContentLike(value as XMLContent, options);
  const displayText = rawLabel?.getText() ?? value.payload ?? value.slug ?? "";
  const contentText = value.rawValue ?? value.payload ?? displayText;
  const common = {
    hierarchy: {
      isLeaf: value.inherited == null || !parseBoolean(value.inherited),
      level: parseNumber(value.i),
    },
    label: rawLabel,
    isUncertain: value.isUncertain === "true",
    category: value.category ?? null,
    type: value.type ?? null,
    uuid: value.uuid == null || value.uuid === "" ? null : value.uuid,
    publicationDateTime: parseOptionalDate(value.publicationDateTime),
    unit: value.unit ?? null,
    href: parseHref(value.href),
    height: parseNumber(value.height),
    width: parseNumber(value.width),
    fileSize: parseNumber(value.fileSize),
    slug: value.slug ?? null,
  };

  switch (dataType) {
    case "integer":
    case "decimal":
    case "time": {
      return { ...common, dataType, content: parseNumberOrZero(contentText) };
    }
    case "boolean": {
      return { ...common, dataType, content: contentText === "true" };
    }
    case "string":
    case "coordinate":
    case "IDREF":
    case "date":
    case "dateTime": {
      return { ...common, dataType, content: contentText };
    }
  }
}

function parseProperty<T extends ReadonlyArray<string>>(
  rawProperty: XMLProperty,
  options: ParserOptions<T>,
): Property<T> {
  const values: Array<PropertyValueContent<T>> = [];
  for (const value of rawProperty.value ?? []) {
    values.push(parsePropertyValueContent(value, options));
  }

  const properties: Array<Property<T>> = [];
  for (const property of rawProperty.property ?? []) {
    properties.push(parseProperty(property, options));
  }

  return {
    label: {
      uuid: rawProperty.label.uuid,
      publicationDateTime: parseOptionalDate(
        rawProperty.label.publicationDateTime,
      ),
      name: parseContentLikeText(rawProperty.label, options),
    },
    values,
    comment: parseContentLike(rawProperty.comment, options),
    properties,
  };
}

export function parseProperties<T extends ReadonlyArray<string>>(
  rawProperties: { property: Array<XMLProperty> } | undefined,
  options: ParserOptions<T>,
): Array<Property<T>> {
  const properties: Array<Property<T>> = [];
  for (const property of rawProperties?.property ?? []) {
    properties.push(parseProperty(property, options));
  }

  return properties;
}

function parseSingleHierarchyProperty<T extends ReadonlyArray<string>>(
  rawProperty: XMLProperty,
  options: ParserOptions<T>,
): SingleHierarchyProperty<T> {
  const property = parseProperty(rawProperty, options);
  return {
    label: property.label,
    values: property.values,
    comment: property.comment,
  };
}

function parseSingleHierarchyProperties<T extends ReadonlyArray<string>>(
  rawProperties: { property: Array<XMLProperty> } | undefined,
  options: ParserOptions<T>,
): Array<SingleHierarchyProperty<T>> {
  const properties: Array<SingleHierarchyProperty<T>> = [];
  for (const property of rawProperties?.property ?? []) {
    properties.push(parseSingleHierarchyProperty(property, options));
  }

  return properties;
}

function withSingleHierarchyProperties<
  U extends { properties: Array<Property<T>> },
  T extends ReadonlyArray<string>,
>(
  item: U,
  rawProperties: { property: Array<XMLProperty> } | undefined,
  options: ParserOptions<T>,
): Omit<U, "properties"> & { properties: Array<SingleHierarchyProperty<T>> } {
  return {
    ...item,
    properties: parseSingleHierarchyProperties(rawProperties, options),
  };
}

function withoutItems<U extends { items: unknown }>(item: U): Omit<U, "items"> {
  const { items: _items, ...itemWithoutItems } = item;
  return itemWithoutItems;
}

function parseItemHierarchy<T extends ReadonlyArray<string>>(
  hierarchy: XMLItemHierarchy | undefined,
  options: ParserOptions<T>,
  categories?: ReadonlyArray<DataCategory>,
): Array<Item<DataCategory, SetItemDataCategory, T, "nested">> {
  const items: Array<Item<DataCategory, SetItemDataCategory, T, "nested">> = [];
  if (hierarchy == null) {
    return items;
  }

  const shouldParse = (category: DataCategory): boolean =>
    categories == null || categories.includes(category);

  if (shouldParse("tree")) {
    for (const tree of hierarchy.tree ?? []) {
      items.push(
        parseTree(tree, options) as Item<
          DataCategory,
          SetItemDataCategory,
          T,
          "nested"
        >,
      );
    }
  }

  if (shouldParse("bibliography")) {
    for (const bibliography of hierarchy.bibliography ?? []) {
      items.push(
        parseBibliography(bibliography, options) as Item<
          DataCategory,
          SetItemDataCategory,
          T,
          "nested"
        >,
      );
    }
  }

  if (shouldParse("concept")) {
    for (const concept of hierarchy.concept ?? []) {
      items.push(
        parseConcept(concept, options) as Item<
          DataCategory,
          SetItemDataCategory,
          T,
          "nested"
        >,
      );
    }
  }

  if (shouldParse("spatialUnit")) {
    for (const spatialUnit of hierarchy.spatialUnit ?? []) {
      items.push(
        parseSpatialUnit(spatialUnit, options) as Item<
          DataCategory,
          SetItemDataCategory,
          T,
          "nested"
        >,
      );
    }
  }

  if (shouldParse("period")) {
    for (const period of hierarchy.period ?? []) {
      items.push(
        parsePeriod(period, options) as Item<
          DataCategory,
          SetItemDataCategory,
          T,
          "nested"
        >,
      );
    }
  }

  if (shouldParse("person")) {
    for (const person of hierarchy.person ?? []) {
      items.push(
        parsePerson(person, options) as Item<
          DataCategory,
          SetItemDataCategory,
          T,
          "nested"
        >,
      );
    }
  }

  if (shouldParse("propertyVariable")) {
    for (const propertyVariable of hierarchy.propertyVariable ?? []) {
      items.push(
        parsePropertyVariable(propertyVariable, options) as Item<
          DataCategory,
          SetItemDataCategory,
          T,
          "nested"
        >,
      );
    }

    for (const propertyVariable of hierarchy.variable ?? []) {
      items.push(
        parsePropertyVariable(propertyVariable, options) as Item<
          DataCategory,
          SetItemDataCategory,
          T,
          "nested"
        >,
      );
    }
  }

  if (shouldParse("propertyValue")) {
    for (const propertyValue of hierarchy.propertyValue ?? []) {
      items.push(
        parsePropertyValue(propertyValue, options) as Item<
          DataCategory,
          SetItemDataCategory,
          T,
          "nested"
        >,
      );
    }

    for (const propertyValue of hierarchy.value ?? []) {
      items.push(
        parsePropertyValue(propertyValue, options) as Item<
          DataCategory,
          SetItemDataCategory,
          T,
          "nested"
        >,
      );
    }
  }

  if (shouldParse("resource")) {
    for (const resource of hierarchy.resource ?? []) {
      if (!("uuid" in resource)) {
        for (const nestedResource of resource.resource) {
          items.push(
            parseResource(nestedResource, options) as Item<
              DataCategory,
              SetItemDataCategory,
              T,
              "nested"
            >,
          );
        }
        continue;
      }

      items.push(
        parseResource(resource, options) as Item<
          DataCategory,
          SetItemDataCategory,
          T,
          "nested"
        >,
      );
    }
  }

  if (shouldParse("text")) {
    for (const text of hierarchy.text ?? []) {
      items.push(
        parseText(text, options) as Item<
          DataCategory,
          SetItemDataCategory,
          T,
          "nested"
        >,
      );
    }
  }

  if (shouldParse("set")) {
    for (const set of hierarchy.set ?? []) {
      items.push(
        parseSet(set, options) as Item<
          DataCategory,
          SetItemDataCategory,
          T,
          "nested"
        >,
      );
    }
  }

  return items;
}

function parseSetItemHierarchy<T extends ReadonlyArray<string>>(
  hierarchy: XMLItemHierarchy | undefined,
  options: ParserOptions<T>,
  categories?: ReadonlyArray<SetItemDataCategory>,
): Array<SetItem<SetItemDataCategory, T>> {
  const items: Array<SetItem<SetItemDataCategory, T>> = [];
  if (hierarchy == null) {
    return items;
  }

  const shouldParse = (category: SetItemDataCategory): boolean =>
    categories == null || categories.includes(category);

  if (shouldParse("tree")) {
    for (const tree of hierarchy.tree ?? []) {
      items.push(
        parseSetTree(tree, options) as SetItem<SetItemDataCategory, T>,
      );
    }
  }

  if (shouldParse("bibliography")) {
    for (const bibliography of hierarchy.bibliography ?? []) {
      items.push(
        parseSetBibliography(bibliography, options) as SetItem<
          SetItemDataCategory,
          T
        >,
      );
    }
  }

  if (shouldParse("concept")) {
    for (const concept of hierarchy.concept ?? []) {
      items.push(
        parseSetConcept(concept, options) as SetItem<SetItemDataCategory, T>,
      );
    }
  }

  if (shouldParse("spatialUnit")) {
    for (const spatialUnit of hierarchy.spatialUnit ?? []) {
      items.push(
        parseSetSpatialUnit(spatialUnit, options) as SetItem<
          SetItemDataCategory,
          T
        >,
      );
    }
  }

  if (shouldParse("period")) {
    for (const period of hierarchy.period ?? []) {
      items.push(
        parseSetPeriod(period, options) as SetItem<SetItemDataCategory, T>,
      );
    }
  }

  if (shouldParse("person")) {
    for (const person of hierarchy.person ?? []) {
      items.push(
        withSingleHierarchyProperties(
          parsePerson(person, options),
          person.properties,
          options,
        ) as SetItem<SetItemDataCategory, T>,
      );
    }
  }

  if (shouldParse("propertyVariable")) {
    for (const propertyVariable of hierarchy.propertyVariable ?? []) {
      items.push(
        parsePropertyVariable(propertyVariable, options) as SetItem<
          SetItemDataCategory,
          T
        >,
      );
    }

    for (const propertyVariable of hierarchy.variable ?? []) {
      items.push(
        parsePropertyVariable(propertyVariable, options) as SetItem<
          SetItemDataCategory,
          T
        >,
      );
    }
  }

  if (shouldParse("propertyValue")) {
    for (const propertyValue of hierarchy.propertyValue ?? []) {
      items.push(
        withSingleHierarchyProperties(
          parsePropertyValue(propertyValue, options),
          propertyValue.properties,
          options,
        ) as SetItem<SetItemDataCategory, T>,
      );
    }

    for (const propertyValue of hierarchy.value ?? []) {
      items.push(
        withSingleHierarchyProperties(
          parsePropertyValue(propertyValue, options),
          propertyValue.properties,
          options,
        ) as SetItem<SetItemDataCategory, T>,
      );
    }
  }

  if (shouldParse("resource")) {
    for (const resource of hierarchy.resource ?? []) {
      if (!("uuid" in resource)) {
        for (const nestedResource of resource.resource) {
          items.push(
            parseSetResource(nestedResource, options) as SetItem<
              SetItemDataCategory,
              T
            >,
          );
        }
        continue;
      }

      items.push(
        parseSetResource(resource, options) as SetItem<SetItemDataCategory, T>,
      );
    }
  }

  if (shouldParse("text")) {
    for (const text of hierarchy.text ?? []) {
      items.push(parseText(text, options) as SetItem<SetItemDataCategory, T>);
    }
  }

  if (shouldParse("set")) {
    for (const set of hierarchy.set ?? []) {
      items.push(parseSetSet(set, options) as SetItem<SetItemDataCategory, T>);
    }
  }

  return items;
}

function normalizeTreeLinkItemsCategory(
  type: string | undefined,
): ItemsDataCategory | null {
  const category = normalizeCategory(type);
  if (category == null || category === "tree") {
    return null;
  }

  return category;
}

function normalizeSetLinkItemsCategory(
  type: string | undefined,
): Array<SetItemDataCategory> | null {
  const category = normalizeCategory(type);
  return category == null ? null : [category];
}

function parseBaseItemLink<
  U extends ItemLinkCategory,
  T extends ReadonlyArray<string>,
>(
  category: U,
  rawItem: {
    uuid?: string;
    publicationDateTime?: string;
    context?: XMLContext;
    date?: string | XMLString;
    identification?: XMLIdentification;
    description?: XMLContent;
  },
  options: ParserOptions<T>,
): BaseItemLink<U, T> {
  return {
    uuid: rawItem.uuid ?? "",
    category,
    publicationDateTime: parseOptionalDate(rawItem.publicationDateTime),
    context: rawItem.context == null ? null : parseContext(rawItem.context),
    date: parseOptionalDateLike(rawItem.date),
    identification: parseOptionalIdentification(
      rawItem.identification,
      options,
    ),
    description: parseContentLike(rawItem.description, options),
  };
}

function parseBibliographySourceDocument(
  sourceDocument: XMLBibliography["sourceDocument"] | undefined,
): BibliographySourceDocument | null {
  if (sourceDocument == null) {
    return null;
  }

  return {
    uuid: sourceDocument.uuid,
    content: sourceDocument.payload,
    href: parseHref(sourceDocument.href),
    publicationDateTime: parseOptionalDate(sourceDocument.publicationDateTime),
  };
}

function parseBibliographyStartDate(
  startDate:
    | NonNullable<NonNullable<XMLBibliography["publicationInfo"]>["startDate"]>
    | undefined,
): Date | null {
  if (startDate == null) {
    return null;
  }

  return new Date(
    parseNumberOrZero(startDate.year),
    Math.max(parseNumberOrZero(startDate.month) - 1, 0),
    parseNumberOrZero(startDate.day),
  );
}

function parseBibliographyEntryInfo(
  entryInfo: XMLBibliography["entryInfo"] | undefined,
): BibliographyEntryInfo | null {
  if (
    entryInfo == null ||
    (entryInfo.payload == null &&
      entryInfo.startIssue == null &&
      entryInfo.startVolume == null &&
      entryInfo.startPage == null &&
      entryInfo.endPage == null)
  ) {
    return null;
  }

  return {
    content: entryInfo.payload ?? null,
    startIssue: entryInfo.startIssue ?? "",
    startVolume: entryInfo.startVolume ?? "",
    startPage: entryInfo.startPage ?? "",
    endPage: entryInfo.endPage ?? "",
  };
}

function firstItemLink<
  U extends ItemLinkCategory,
  T extends ReadonlyArray<string>,
>(
  rawLinks: XMLLink | XMLDataItem | undefined,
  options: ParserOptions<T>,
): ItemLink<U, T> | null {
  const links = parseLinks(rawLinks, options);
  const link = links[0];
  return link == null ? null : (link as ItemLink<U, T>);
}

function parsePersonItemLinks<T extends ReadonlyArray<string>>(
  rawPersons: Array<XMLLinkedPerson> | undefined,
  options: ParserOptions<T>,
): Array<ItemLink<"person", T>> {
  const people: Array<ItemLink<"person", T>> = [];
  for (const person of rawPersons ?? []) {
    people.push(parsePersonItemLink(person, options));
  }

  return people;
}

function parsePeriodItemLinks<T extends ReadonlyArray<string>>(
  rawPeriods: Array<XMLLinkedPeriod> | undefined,
  options: ParserOptions<T>,
): Array<ItemLink<"period", T>> {
  const periods: Array<ItemLink<"period", T>> = [];
  for (const period of rawPeriods ?? []) {
    periods.push(parsePeriodItemLink(period, options));
  }

  return periods;
}

function parseTreeItemLink<T extends ReadonlyArray<string>>(
  rawTree: XMLLinkedTree,
  options: ParserOptions<T>,
): ItemLink<"tree", T> {
  return {
    ...parseBaseItemLink("tree", rawTree, options),
    type: rawTree.type ?? null,
    itemsCategory: normalizeTreeLinkItemsCategory(rawTree.type),
  };
}

function parseSetItemLink<T extends ReadonlyArray<string>>(
  rawSet: XMLLinkedSet,
  options: ParserOptions<T>,
): ItemLink<"set", T> {
  return {
    ...parseBaseItemLink("set", rawSet, options),
    type: rawSet.type ?? null,
    itemsCategory: normalizeSetLinkItemsCategory(rawSet.type),
  };
}

function parseBibliographyItemLink<T extends ReadonlyArray<string>>(
  rawBibliography: XMLLinkedBibliography,
  options: ParserOptions<T>,
): ItemLink<"bibliography", T> {
  return {
    ...parseBaseItemLink("bibliography", rawBibliography, options),
    type: rawBibliography.type ?? null,
    zoteroId: rawBibliography.zoteroId ?? null,
    citationDetails: rawBibliography.citationDetails ?? null,
    citationFormat: parseContentLike(rawBibliography.citationFormat, options),
    citationFormatSpan: parseStringLike(rawBibliography.citationFormatSpan, {
      isRichText: options.isRichText,
    }),
    referenceFormatDiv: parseStringLike(rawBibliography.referenceFormatDiv, {
      isRichText: options.isRichText,
    }),
    image: parseImage(rawBibliography.image, options),
    sourceDocument: parseBibliographySourceDocument(
      rawBibliography.sourceDocument,
    ),
    publicationInfo:
      rawBibliography.publicationInfo == null ?
        null
      : {
          publishers: parsePersonItemLinks(
            rawBibliography.publicationInfo.publishers == null ? undefined
            : "publisher" in rawBibliography.publicationInfo.publishers ?
              rawBibliography.publicationInfo.publishers.publisher
            : rawBibliography.publicationInfo.publishers.publishers.person,
            options,
          ),
          startDate: parseBibliographyStartDate(
            rawBibliography.publicationInfo.startDate,
          ),
        },
    entryInfo: parseBibliographyEntryInfo(rawBibliography.entryInfo),
    source: firstItemLink<ItemsDataCategory, T>(
      rawBibliography.source,
      options,
    ),
    authors: parsePersonItemLinks(rawBibliography.authors?.person, options),
    periods: parsePeriodItemLinks(rawBibliography.periods?.period, options),
    properties: parseProperties(rawBibliography.properties, options),
  };
}

function parseConceptItemLink<T extends ReadonlyArray<string>>(
  rawConcept: XMLLinkedConcept,
  options: ParserOptions<T>,
): ItemLink<"concept", T> {
  return {
    ...parseBaseItemLink("concept", rawConcept, options),
    image: parseImage(rawConcept.image, options),
    coordinates: parseCoordinates(rawConcept.coordinates, options),
  };
}

function parseSpatialUnitItemLink<T extends ReadonlyArray<string>>(
  rawSpatialUnit: XMLLinkedSpatialUnit,
  options: ParserOptions<T>,
): ItemLink<"spatialUnit", T> {
  return {
    ...parseBaseItemLink("spatialUnit", rawSpatialUnit, options),
    image: parseImage(rawSpatialUnit.image, options),
    coordinates: parseCoordinates(rawSpatialUnit.coordinates, options),
  };
}

function parsePeriodItemLink<T extends ReadonlyArray<string>>(
  rawPeriod: XMLLinkedPeriod,
  options: ParserOptions<T>,
): ItemLink<"period", T> {
  return {
    ...parseBaseItemLink("period", rawPeriod, options),
    type: rawPeriod.type ?? null,
    coordinates: parseCoordinates(rawPeriod.coordinates, options),
  };
}

function parsePersonItemLink<T extends ReadonlyArray<string>>(
  rawPerson: XMLLinkedPerson,
  options: ParserOptions<T>,
): ItemLink<"person", T> {
  return {
    ...parseBaseItemLink("person", rawPerson, options),
    type: rawPerson.type ?? null,
    coordinates: parseCoordinates(rawPerson.coordinates, options),
  };
}

function parsePropertyVariableItemLink<T extends ReadonlyArray<string>>(
  rawPropertyVariable: XMLLinkedPropertyVariable,
  options: ParserOptions<T>,
): ItemLink<"propertyVariable", T> {
  return {
    ...parseBaseItemLink("propertyVariable", rawPropertyVariable, options),
    type: rawPropertyVariable.type ?? null,
    coordinates: parseCoordinates(rawPropertyVariable.coordinates, options),
  };
}

function parsePropertyValueItemLink<T extends ReadonlyArray<string>>(
  rawPropertyValue: XMLLinkedPropertyValue,
  options: ParserOptions<T>,
): ItemLink<"propertyValue", T> {
  return {
    ...parseBaseItemLink("propertyValue", rawPropertyValue, options),
    coordinates: parseCoordinates(rawPropertyValue.coordinates, options),
  };
}

function parseResourceItemLink<T extends ReadonlyArray<string>>(
  rawResource: XMLLinkedResource,
  options: ParserOptions<T>,
): ItemLink<"resource", T> {
  return {
    ...parseBaseItemLink("resource", rawResource, options),
    type: rawResource.type ?? null,
    href: parseHref(rawResource.href),
    fileFormat: rawResource.fileFormat ?? null,
    fileSize: parseNumber(rawResource.fileSize),
    isInline: rawResource.rend === "inline",
    isPrimary: parseBoolean(rawResource.isPrimary),
    height: parseNumber(rawResource.height),
    width: parseNumber(rawResource.width),
    image: parseImage(rawResource.image, options),
    coordinates: parseCoordinates(rawResource.coordinates, options),
  };
}

function parseTextItemLink<T extends ReadonlyArray<string>>(
  rawText: XMLLinkedText,
  options: ParserOptions<T>,
): ItemLink<"text", T> {
  return {
    ...parseBaseItemLink("text", rawText, options),
    type: rawText.type ?? null,
    text: rawText.text ?? null,
    language: rawText.language ?? null,
    image: parseImage(rawText.image, options),
    coordinates: parseCoordinates(rawText.coordinates, options),
  };
}

function parseDictionaryUnitItemLink<T extends ReadonlyArray<string>>(
  rawDictionaryUnit: XMLDictionaryUnit,
  options: ParserOptions<T>,
): ItemLink<"dictionaryUnit", T> {
  return parseBaseItemLink("dictionaryUnit", rawDictionaryUnit, options);
}

export function parseLinks<T extends ReadonlyArray<string>>(
  rawLinks: XMLLink | XMLDataItem | undefined,
  options: ParserOptions<T>,
): ItemLinks<T> {
  const links: ItemLinks<T> = [];
  if (rawLinks == null) {
    return links;
  }

  const hierarchy = rawLinks as XMLItemLinkHierarchy;

  for (const tree of hierarchy.tree ?? []) {
    links.push(parseTreeItemLink(tree, options));
  }
  for (const bibliography of hierarchy.bibliography ?? []) {
    links.push(parseBibliographyItemLink(bibliography, options));
  }
  for (const concept of hierarchy.concept ?? []) {
    links.push(parseConceptItemLink(concept, options));
  }
  for (const spatialUnit of hierarchy.spatialUnit ?? []) {
    links.push(parseSpatialUnitItemLink(spatialUnit, options));
  }
  for (const period of hierarchy.period ?? []) {
    links.push(parsePeriodItemLink(period, options));
  }
  for (const person of hierarchy.person ?? []) {
    links.push(parsePersonItemLink(person, options));
  }
  for (const propertyVariable of hierarchy.propertyVariable ?? []) {
    links.push(parsePropertyVariableItemLink(propertyVariable, options));
  }
  for (const propertyVariable of hierarchy.variable ?? []) {
    links.push(parsePropertyVariableItemLink(propertyVariable, options));
  }
  for (const propertyValue of hierarchy.propertyValue ?? []) {
    links.push(parsePropertyValueItemLink(propertyValue, options));
  }
  for (const propertyValue of hierarchy.value ?? []) {
    links.push(parsePropertyValueItemLink(propertyValue, options));
  }
  for (const resource of hierarchy.resource ?? []) {
    if (!("uuid" in resource)) {
      for (const nestedResource of resource.resource) {
        links.push(parseResourceItemLink(nestedResource, options));
      }
      continue;
    }

    links.push(parseResourceItemLink(resource, options));
  }
  for (const text of hierarchy.text ?? []) {
    links.push(parseTextItemLink(text, options));
  }
  for (const set of hierarchy.set ?? []) {
    links.push(parseSetItemLink(set, options));
  }
  for (const dictionaryUnit of hierarchy.dictionaryUnit ?? []) {
    links.push(parseDictionaryUnitItemLink(dictionaryUnit, options));
  }

  return links;
}

function parseReverseLinks<T extends ReadonlyArray<string>>(
  rawLinks: XMLLink | XMLDataItem | Array<XMLLink | XMLDataItem> | undefined,
  options: ParserOptions<T>,
): ItemLinks<T> {
  const links: ItemLinks<T> = [];
  const rawLinksToParse =
    rawLinks == null ? []
    : Array.isArray(rawLinks) ? rawLinks
    : [rawLinks];
  for (const rawLink of rawLinksToParse) {
    links.push(...parseLinks(rawLink, options));
  }

  return links;
}

function parsePeriodList<T extends ReadonlyArray<string>>(
  rawPeriods: { period: Array<XMLPeriod> } | undefined,
  options: ParserOptions<T>,
): Array<Period<T, "nested">> {
  const periods: Array<Period<T, "nested">> = [];
  for (const period of rawPeriods?.period ?? []) {
    periods.push(parsePeriod(period, options));
  }

  return periods;
}

export function parseBibliographyList<T extends ReadonlyArray<string>>(
  rawBibliographies: { bibliography: Array<XMLBibliography> } | undefined,
  options: ParserOptions<T>,
): Array<Bibliography<T, "nested">> {
  const bibliographies: Array<Bibliography<T, "nested">> = [];
  for (const bibliography of rawBibliographies?.bibliography ?? []) {
    bibliographies.push(parseBibliography(bibliography, options));
  }

  return bibliographies;
}

export function parsePersonList<T extends ReadonlyArray<string>>(
  rawPersons: Array<XMLPerson> | undefined,
  options: ParserOptions<T>,
): Array<Person<T, "nested">> {
  const persons: Array<Person<T, "nested">> = [];
  for (const person of rawPersons ?? []) {
    persons.push(parsePerson(person, options));
  }

  return persons;
}

function parseInterpretation<T extends ReadonlyArray<string>>(
  rawInterpretation: XMLInterpretation,
  options: ParserOptions<T>,
): Interpretation<T> {
  return {
    number: parseNumberOrZero(rawInterpretation.interpretationNo),
    date: parseOptionalDate(rawInterpretation.date),
    observers: parsePersonList(rawInterpretation.observers?.observer, options),
    periods: parsePeriodList(rawInterpretation.periods, options),
    links: parseLinks(rawInterpretation.links, options),
    notes: parseNotes(rawInterpretation.notes, options),
    properties: parseProperties(rawInterpretation.properties, options),
    bibliographies: parseBibliographyList(
      rawInterpretation.bibliographies,
      options,
    ),
  };
}

function parseObservation<T extends ReadonlyArray<string>>(
  rawObservation: XMLObservation,
  options: ParserOptions<T>,
): Observation<T> {
  return {
    number: parseNumberOrZero(rawObservation.observationNo),
    date: parseOptionalDate(rawObservation.date),
    observers: parsePersonList(rawObservation.observers?.observer, options),
    periods: parsePeriodList(rawObservation.periods, options),
    links: parseLinks(rawObservation.links, options),
    notes: parseNotes(rawObservation.notes, options),
    properties: parseProperties(rawObservation.properties, options),
    bibliographies: parseBibliographyList(
      rawObservation.bibliographies,
      options,
    ),
  };
}

function parseSection<T extends ReadonlyArray<string>>(
  rawSection: XMLSection,
  options: ParserOptions<T>,
): Section<T> {
  return {
    uuid: rawSection.uuid,
    publicationDateTime: parseOptionalDate(rawSection.publicationDateTime),
    identification: parseIdentification(rawSection.identification, options),
    project:
      rawSection.project == null ?
        null
      : {
          identification: parseIdentification(
            rawSection.project.identification,
            options,
          ),
        },
  };
}

function parseSections<T extends ReadonlyArray<string>>(
  rawSections: XMLText["sections"] | undefined,
  options: ParserOptions<T>,
): Array<Section<T>> {
  const sections: Array<Section<T>> = [];
  if (
    rawSections == null ||
    (!("translation" in rawSections) && !("phonemic" in rawSections))
  ) {
    return sections;
  }

  for (const translation of rawSections.translation ?? []) {
    for (const section of translation.section) {
      sections.push(parseSection(section, options));
    }
  }

  for (const phonemic of rawSections.phonemic ?? []) {
    for (const section of phonemic.section) {
      sections.push(parseSection(section, options));
    }
  }

  return sections;
}

function parseHeading<
  U extends HeadingDataCategory,
  T extends ReadonlyArray<string>,
>(
  rawHeading: XMLHeading,
  itemCategory: U,
  options: ParserOptions<T>,
): Heading<U, T> {
  const headings: Array<Heading<U, T>> = [];
  for (const heading of rawHeading.heading ?? []) {
    headings.push(parseHeading(heading, itemCategory, options));
  }

  return {
    name: rawHeading.name,
    headings,
    items: parseItemHierarchy(rawHeading as XMLItemHierarchy, options, [
      itemCategory,
    ]) as Array<Item<U, never, T, "nested">>,
  };
}

function parseTree<
  U extends ItemsDataCategory = ItemsDataCategory,
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  rawTree: XMLTree,
  options: ParserOptions<T> & { itemCategory?: U },
): Tree<U, T, "nested"> {
  const childOptions = getParserOptions(options);
  const itemCategory = resolveTreeItemCategory(
    rawTree,
    normalizeTreeItemCategory(options.itemCategory),
  );

  const items: Array<
    Heading<U & HeadingDataCategory, T> | Item<U, never, T, "nested">
  > = [];
  if (itemCategory != null && isHeadingDataCategory(itemCategory)) {
    for (const heading of rawTree.items?.heading ?? []) {
      items.push(
        parseHeading(heading, itemCategory, childOptions) as Heading<
          U & HeadingDataCategory,
          T
        >,
      );
    }
  }

  if (itemCategory != null) {
    items.push(
      ...(parseItemHierarchy(rawTree.items, childOptions, [
        itemCategory,
      ]) as Array<Item<U, never, T, "nested">>),
    );
  }

  return {
    ...parseBaseItem("tree", rawTree, childOptions),
    type: rawTree.type ?? null,
    itemsCategory: itemCategory as U | null,
    links: parseLinks(rawTree.links, childOptions),
    notes: parseNotes(rawTree.notes, childOptions),
    properties: parseProperties(rawTree.properties, childOptions),
    bibliographies: parseBibliographyList(rawTree.bibliographies, childOptions),
    items: items as Tree<U, T, "nested">["items"],
  };
}

function parseSet<
  U extends SetItemDataCategory = SetItemDataCategory,
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  rawSet: XMLSet,
  options: ParserOptions<T> & { itemCategory?: U | ReadonlyArray<U> },
): Set<U, T, "nested"> {
  const childOptions = getParserOptions(options);
  const optionCategories = normalizeSetItemCategories(options.itemCategory);
  const itemCategories = optionCategories ?? inferItemCategories(rawSet.items);

  return {
    ...parseBaseItem("set", rawSet, childOptions),
    itemsCategory: itemCategories as Array<U>,
    isTabularStructure: parseBoolean(rawSet.tabularStructure),
    isSuppressingBlanks: parseBoolean(rawSet.suppressBlanks),
    links: parseLinks(rawSet.links, childOptions),
    notes: parseNotes(rawSet.notes, childOptions),
    properties: parseProperties(rawSet.properties, childOptions),
    items: parseSetItemHierarchy(
      rawSet.items,
      childOptions,
      itemCategories,
    ) as Array<SetItem<U, T>>,
  };
}

function parseSetBibliography<T extends ReadonlyArray<string>>(
  rawBibliography: XMLBibliography,
  options: ParserOptions<T>,
): SetBibliography<T> {
  return withoutItems(
    withSingleHierarchyProperties(
      parseBibliography(rawBibliography, options),
      rawBibliography.properties,
      options,
    ),
  ) as SetBibliography<T>;
}

function parseSetConcept<T extends ReadonlyArray<string>>(
  rawConcept: XMLConcept,
  options: ParserOptions<T>,
): SetConcept<T> {
  return {
    ...parseBaseItem("concept", rawConcept, options),
    image: parseImage(rawConcept.image, options),
    coordinates: parseCoordinates(rawConcept.coordinates, options),
    properties: parseSingleHierarchyProperties(rawConcept.properties, options),
  };
}

function parseSpatialUnitMapData(
  mapData: XMLSpatialUnit["mapData"],
): SpatialUnit<ReadonlyArray<string>, "nested">["mapData"] {
  if (mapData == null) {
    return null;
  }

  return {
    geoJSON: {
      multiPolygon: mapData.geoJSON.multiPolygon.payload,
      EPSG: parseNumberOrZero(mapData.geoJSON.EPSG),
    },
  };
}

function parseSetSpatialUnit<T extends ReadonlyArray<string>>(
  rawSpatialUnit: XMLSpatialUnit,
  options: ParserOptions<T>,
): SetSpatialUnit<T> {
  return {
    ...parseBaseItem("spatialUnit", rawSpatialUnit, options),
    image: parseImage(rawSpatialUnit.image, options),
    coordinates: parseCoordinates(rawSpatialUnit.coordinates, options),
    mapData: parseSpatialUnitMapData(rawSpatialUnit.mapData),
    properties: parseSingleHierarchyProperties(
      rawSpatialUnit.properties,
      options,
    ),
    bibliographies: parseBibliographyList(
      rawSpatialUnit.bibliographies,
      options,
    ),
  };
}

function parseSetPeriod<T extends ReadonlyArray<string>>(
  rawPeriod: XMLPeriod,
  options: ParserOptions<T>,
): SetPeriod<T> {
  return withoutItems(
    withSingleHierarchyProperties(
      parsePeriod(rawPeriod, options),
      rawPeriod.properties,
      options,
    ),
  );
}

function parseSetResource<T extends ReadonlyArray<string>>(
  rawResource: XMLResource,
  options: ParserOptions<T>,
): SetResource<T> {
  return withoutItems(
    withSingleHierarchyProperties(
      parseResource(rawResource, options),
      rawResource.properties,
      options,
    ),
  );
}

function parseSetTree<T extends ReadonlyArray<string>>(
  rawTree: XMLTree,
  options: ParserOptions<T>,
): SetTree<T> {
  return withoutItems(
    withSingleHierarchyProperties(
      parseTree(rawTree, options),
      rawTree.properties,
      options,
    ),
  ) as SetTree<T>;
}

function parseSetSet<T extends ReadonlyArray<string>>(
  rawSet: XMLSet,
  options: ParserOptions<T>,
): SetItem<"set", T> {
  return withoutItems(
    withSingleHierarchyProperties(
      parseSet(rawSet, options),
      rawSet.properties,
      options,
    ),
  ) as SetItem<"set", T>;
}

function parseBibliography<T extends ReadonlyArray<string>>(
  rawBibliography: XMLBibliography,
  options: ParserOptions<T>,
): Bibliography<T, "nested"> {
  const sourceItems =
    rawBibliography.source == null ?
      []
    : parseLinks(rawBibliography.source, options);
  const bibliographies = parseBibliographyList(
    rawBibliography.bibliographies,
    options,
  );
  const items: Array<Bibliography<T, "nested">> = [];
  for (const bibliography of rawBibliography.bibliography ?? []) {
    items.push(parseBibliography(bibliography, options));
  }

  const baseBibliography = {
    ...parseBaseItem("bibliography", rawBibliography, options),
    citationDetails: rawBibliography.citationDetails ?? null,
    citationFormat: parseContentLike(rawBibliography.citationFormat, options),
    citationFormatSpan: parseStringLike(rawBibliography.citationFormatSpan, {
      isRichText: options.isRichText,
    }),
    referenceFormatDiv: parseStringLike(rawBibliography.referenceFormatDiv, {
      isRichText: options.isRichText,
    }),
    image: parseImage(rawBibliography.image, options),
    sourceDocument: parseBibliographySourceDocument(
      rawBibliography.sourceDocument,
    ),
    publicationInfo:
      rawBibliography.publicationInfo == null ?
        null
      : {
          publishers: parsePersonList(
            rawBibliography.publicationInfo.publishers == null ? undefined
            : "publisher" in rawBibliography.publicationInfo.publishers ?
              rawBibliography.publicationInfo.publishers.publisher
            : rawBibliography.publicationInfo.publishers.publishers.person,
            options,
          ),
          startDate: parseBibliographyStartDate(
            rawBibliography.publicationInfo.startDate,
          ),
        },
    entryInfo: parseBibliographyEntryInfo(rawBibliography.entryInfo),
    source:
      sourceItems[0] == null ?
        null
      : (sourceItems[0] as ItemLink<ItemsDataCategory, T>),
    authors: parsePersonList(rawBibliography.authors?.person, options),
    periods: parsePeriodList(rawBibliography.periods, options),
    links: parseLinks(rawBibliography.links, options),
    notes: parseNotes(rawBibliography.notes, options),
    properties: parseProperties(rawBibliography.properties, options),
    bibliographies,
    items,
  };

  if (rawBibliography.type === "zotero" && rawBibliography.zoteroId != null) {
    return {
      ...baseBibliography,
      type: "zotero",
      zoteroId: rawBibliography.zoteroId,
    };
  }

  return { ...baseBibliography, type: rawBibliography.type ?? null };
}

function parseConcept<T extends ReadonlyArray<string>>(
  rawConcept: XMLConcept,
  options: ParserOptions<T>,
): Concept<T, "nested"> {
  const interpretations: Array<Interpretation<T>> = [];
  for (const interpretation of rawConcept.interpretations?.interpretation ??
    []) {
    interpretations.push(parseInterpretation(interpretation, options));
  }

  const items: Array<Concept<T, "nested">> = [];
  for (const concept of rawConcept.concept ?? []) {
    items.push(parseConcept(concept, options));
  }

  return {
    ...parseBaseItem("concept", rawConcept, options),
    image: parseImage(rawConcept.image, options),
    interpretations,
    coordinates: parseCoordinates(rawConcept.coordinates, options),
    items,
  };
}

function parseSpatialUnit<T extends ReadonlyArray<string>>(
  rawSpatialUnit: XMLSpatialUnit,
  options: ParserOptions<T>,
): SpatialUnit<T, "nested"> {
  const observations: Array<Observation<T>> = [];
  for (const observation of rawSpatialUnit.observations?.observation ?? []) {
    observations.push(parseObservation(observation, options));
  }

  const items: Array<SpatialUnit<T, "nested">> = [];
  for (const spatialUnit of rawSpatialUnit.spatialUnit ?? []) {
    items.push(parseSpatialUnit(spatialUnit, options));
  }

  return {
    ...parseBaseItem("spatialUnit", rawSpatialUnit, options),
    image: parseImage(rawSpatialUnit.image, options),
    coordinates: parseCoordinates(rawSpatialUnit.coordinates, options),
    mapData: parseSpatialUnitMapData(rawSpatialUnit.mapData),
    observations,
    bibliographies: parseBibliographyList(
      rawSpatialUnit.bibliographies,
      options,
    ),
    items,
  };
}

function parsePeriod<T extends ReadonlyArray<string>>(
  rawPeriod: XMLPeriod,
  options: ParserOptions<T>,
): Period<T, "nested"> {
  const items: Array<Period<T, "nested">> = [];
  for (const period of rawPeriod.period ?? []) {
    items.push(parsePeriod(period, options));
  }

  return {
    ...parseBaseItem("period", rawPeriod, options),
    type: rawPeriod.type ?? null,
    coordinates: parseCoordinates(rawPeriod.coordinates, options),
    links: parseLinks(rawPeriod.links, options),
    notes: parseNotes(rawPeriod.notes, options),
    properties: parseProperties(rawPeriod.properties, options),
    bibliographies: parseBibliographyList(rawPeriod.bibliographies, options),
    items,
  };
}

function parsePerson<T extends ReadonlyArray<string>>(
  rawPerson: XMLPerson,
  options: ParserOptions<T>,
): Person<T, "nested"> {
  return {
    ...parseBaseItem("person", rawPerson, options),
    type: rawPerson.type ?? "",
    image: parseImage(rawPerson.image, options),
    address:
      rawPerson.address == null ?
        null
      : {
          country: parseStringLike(rawPerson.address.country, {
            isRichText: false,
          }),
          city: parseStringLike(rawPerson.address.city, { isRichText: false }),
          state: parseStringLike(rawPerson.address.state, {
            isRichText: false,
          }),
          postalCode: parseStringLike(rawPerson.address.postalCode, {
            isRichText: false,
          }),
        },
    coordinates: parseCoordinates(rawPerson.coordinates, options),
    content:
      rawPerson.content == null ?
        null
      : parseRequiredContentLike(rawPerson as XMLContent, options),
    periods: parsePeriodList(rawPerson.periods, options),
    links: parseLinks(rawPerson.links, options),
    notes: parseNotes(rawPerson.notes, options),
    properties: parseProperties(rawPerson.properties, options),
  };
}

function parsePropertyVariable<T extends ReadonlyArray<string>>(
  rawPropertyVariable: XMLPropertyVariable,
  options: ParserOptions<T>,
): PropertyVariable<T, "nested"> {
  return {
    ...parseBaseItem("propertyVariable", rawPropertyVariable, options),
    type: rawPropertyVariable.type ?? null,
    coordinates: parseCoordinates(rawPropertyVariable.coordinates, options),
    links: parseLinks(rawPropertyVariable.links, options),
    notes: parseNotes(rawPropertyVariable.notes, options),
    bibliographies: parseBibliographyList(
      rawPropertyVariable.bibliographies,
      options,
    ),
  };
}

function parsePropertyValue<T extends ReadonlyArray<string>>(
  rawPropertyValue: XMLPropertyValueItem,
  options: ParserOptions<T>,
): PropertyValue<T, "nested"> {
  return {
    ...parseBaseItem("propertyValue", rawPropertyValue, options),
    coordinates: parseCoordinates(rawPropertyValue.coordinates, options),
    links: parseLinks(rawPropertyValue.links, options),
    notes: parseNotes(rawPropertyValue.notes, options),
    properties: parseProperties(rawPropertyValue.properties, options),
    bibliographies: parseBibliographyList(
      rawPropertyValue.bibliographies,
      options,
    ),
  };
}

function parseResource<T extends ReadonlyArray<string>>(
  rawResource: XMLResource,
  options: ParserOptions<T>,
): Resource<T, "nested"> {
  const items: Array<Resource<T, "nested">> = [];
  for (const resource of rawResource.resource ?? []) {
    items.push(parseResource(resource, options));
  }

  return {
    ...parseBaseItem("resource", rawResource, options),
    type: rawResource.type ?? "",
    href: parseHref(rawResource.href),
    fileFormat: rawResource.fileFormat ?? null,
    fileSize: parseNumber(rawResource.fileSize),
    isInline: rawResource.rend === "inline",
    height: parseNumber(rawResource.height),
    width: parseNumber(rawResource.width),
    image: parseImage(rawResource.image, options),
    document: parseContentLike(rawResource.document, options),
    imageMap: parseImageMap(rawResource.imagemap),
    coordinates: parseCoordinates(rawResource.coordinates, options),
    periods: parsePeriodList(rawResource.periods, options),
    links: parseLinks(rawResource.links, options),
    reverseLinks: parseReverseLinks(rawResource.reverseLinks, options),
    notes: parseNotes(rawResource.notes, options),
    properties: parseProperties(rawResource.properties, options),
    bibliographies: parseBibliographyList(rawResource.bibliographies, options),
    items,
  };
}

function parseText<T extends ReadonlyArray<string>>(
  rawText: XMLText,
  options: ParserOptions<T>,
): Text<T, "nested"> {
  const editions: Array<Person<T, "nested">> = [];
  for (const edition of rawText.editions?.edition ?? []) {
    editions.push(parsePerson(edition, options));
  }
  for (const editor of rawText.editions?.editor ?? []) {
    editions.push(parsePerson(editor, options));
  }
  for (const publisher of rawText.editions?.publisher ?? []) {
    editions.push(parsePerson(publisher, options));
  }

  return {
    ...parseBaseItem("text", rawText, options),
    type: rawText.type ?? "",
    text: rawText.text ?? null,
    language: rawText.language ?? null,
    image: parseImage(rawText.image, options),
    coordinates: parseCoordinates(rawText.coordinates, options),
    links: parseLinks(rawText.links, options),
    reverseLinks: parseReverseLinks(rawText.reverseLinks, options),
    notes: parseNotes(rawText.notes, options),
    sections: parseSections(rawText.sections, options),
    periods: parsePeriodList(rawText.periods, options),
    creators: parsePersonList(rawText.creators?.creator, options),
    editions,
  };
}

export function parseMetadataLanguages(rawOchre: {
  metadata: XMLMetadata;
  languages?: string;
}): Array<string> {
  const languages: Array<string> = [];

  for (const language of rawOchre.metadata.language ?? []) {
    const parsedLanguage = parseStringLike(language, { isRichText: false });
    if (parsedLanguage != null) {
      languages.push(parsedLanguage);
    }
  }

  if (languages.length > 0) {
    return languages;
  }

  if (rawOchre.languages != null) {
    for (const language of rawOchre.languages.split(";")) {
      if (language !== "") {
        languages.push(language);
      }
    }
  }

  return languages.length > 0 ? languages : [...DEFAULT_LANGUAGES];
}

export function resolveLanguages<T extends ReadonlyArray<string>>(
  requestedLanguages: T,
  metadataLanguages: Array<string>,
): T {
  if (requestedLanguages.length === 0) {
    return metadataLanguages as unknown as T;
  }

  const unsupportedLanguages: Array<string> = [];
  for (const requestedLanguage of requestedLanguages) {
    const isSupported = metadataLanguages.some(
      (metadataLanguage) =>
        metadataLanguage.toLocaleLowerCase("en-US") ===
        requestedLanguage.toLocaleLowerCase("en-US"),
    );
    if (!isSupported) {
      unsupportedLanguages.push(requestedLanguage);
    }
  }

  if (unsupportedLanguages.length > 0) {
    throw new Error(
      `The following language(s) are not supported by the dataset: ${unsupportedLanguages
        .toSorted((a, b) => a.localeCompare(b, "en-US"))
        .join(", ")}. Available languages: ${metadataLanguages
        .toSorted((a, b) => a.localeCompare(b, "en-US"))
        .join(", ")}`,
    );
  }

  return requestedLanguages;
}

export function resolveDefaultLanguage<T extends ReadonlyArray<string>>(
  rawOchre: { metadata: XMLMetadata },
  languages: T,
): T[number] {
  for (const language of rawOchre.metadata.language ?? []) {
    const parsedLanguage = parseStringLike(language, { isRichText: false });
    if (
      parsedLanguage != null &&
      language.default === "true" &&
      languages.includes(parsedLanguage)
    ) {
      return parsedLanguage;
    }
  }

  for (const language of languages) {
    if (language === DEFAULT_LANGUAGES[0]) {
      return language;
    }
  }

  const firstLanguage = languages[0];
  if (firstLanguage == null) {
    throw new Error("Default language not found");
  }

  return firstLanguage;
}

function parseMetadataPublisher(
  rawPublisher: RawOchre["metadata"]["publisher"],
): string {
  const publisher =
    Array.isArray(rawPublisher) ? rawPublisher[0] : rawPublisher;
  return parseStringLike(publisher, { isRichText: false }) ?? "";
}

export function parseMetadata<T extends ReadonlyArray<string>>(
  rawOchre: { uuidBelongsTo: string; metadata: XMLMetadata },
  options: ParserOptions<T>,
  defaultLanguage: T[number],
): Metadata<T> {
  const metadataOptions = { ...options, isRichText: false };
  const rawMetadata = rawOchre.metadata;

  return {
    dataset: parseStringLike(rawMetadata.dataset, { isRichText: false }) ?? "",
    description:
      parseStringLike(rawMetadata.description, { isRichText: false }) ?? "",
    publisher: parseMetadataPublisher(rawMetadata.publisher),
    identifier: transformPermanentIdentificationUrl(
      parseStringLike(rawMetadata.identifier, { isRichText: false }) ?? "",
    ),
    project:
      rawMetadata.project == null ?
        null
      : {
          uuid: rawMetadata.project.uuid ?? rawOchre.uuidBelongsTo,
          identification: parseIdentification(
            rawMetadata.project.identification,
            metadataOptions,
          ),
          website: parseStringLike(rawMetadata.project.identification.website, {
            isRichText: false,
          }),
          dateFormat: rawMetadata.project.dateFormat ?? null,
          page: rawMetadata.project.page ?? null,
        },
    collection:
      rawMetadata.collection == null ?
        null
      : {
          uuid: rawMetadata.collection.uuid,
          identification: parseIdentification(
            rawMetadata.collection.identification,
            metadataOptions,
          ),
          page: rawMetadata.collection.page,
        },
    publication:
      rawMetadata.publication == null ?
        null
      : {
          uuid: rawMetadata.publication.uuid,
          identification: parseIdentification(
            rawMetadata.publication.identification,
            metadataOptions,
          ),
          page: rawMetadata.publication.page,
        },
    item:
      rawMetadata.item == null ?
        null
      : {
          identification: parseIdentification(
            rawMetadata.item.identification,
            metadataOptions,
          ),
          category:
            normalizeCategory(rawMetadata.item.category) ??
            rawMetadata.item.category,
          type: rawMetadata.item.type,
          maxLength: parseNumber(rawMetadata.item.maxLength),
        },
    defaultLanguage,
    languages: options.languages,
  };
}

function inferTopLevelCategory(rawOchre: RawOchre): DataCategory {
  for (const category of SET_ITEM_DATA_CATEGORIES) {
    if (category in rawOchre) {
      return category;
    }
  }

  if ("variable" in rawOchre) {
    return "propertyVariable";
  }

  if ("value" in rawOchre) {
    return "propertyValue";
  }

  throw new Error("Could not infer OCHRE item category");
}

function getSingleTopLevelRawItem<T>(
  items: Array<T> | null,
  category: string,
): T {
  if (items == null || items.length === 0) {
    throw new Error(`${category} not found`);
  }

  if (items.length > 1) {
    throw new Error(`Expected one ${category}, received ${items.length}`);
  }

  return items[0]!;
}

function parseTopLevelItem<
  U extends DataCategory,
  V extends HierarchyItemDataCategory<U>,
  T extends ReadonlyArray<string>,
>(
  rawOchre: RawOchre,
  category: U,
  options: ParserOptions<T> & { itemCategory?: V | ReadonlyArray<V> },
): Item<U, V, T, "nested"> {
  switch (category) {
    case "tree": {
      return parseTree(
        getSingleTopLevelRawItem(
          "tree" in rawOchre ? rawOchre.tree : null,
          "tree",
        ),
        {
          ...options,
          itemCategory: normalizeTreeItemCategory(options.itemCategory),
        },
      ) as unknown as Item<U, V, T, "nested">;
    }
    case "bibliography": {
      return parseBibliography(
        getSingleTopLevelRawItem(
          "bibliography" in rawOchre ? rawOchre.bibliography : null,
          "bibliography",
        ),
        options,
      ) as unknown as Item<U, V, T, "nested">;
    }
    case "concept": {
      return parseConcept(
        getSingleTopLevelRawItem(
          "concept" in rawOchre ? rawOchre.concept : null,
          "concept",
        ),
        options,
      ) as unknown as Item<U, V, T, "nested">;
    }
    case "spatialUnit": {
      return parseSpatialUnit(
        getSingleTopLevelRawItem(
          "spatialUnit" in rawOchre ? rawOchre.spatialUnit : null,
          "spatial unit",
        ),
        options,
      ) as unknown as Item<U, V, T, "nested">;
    }
    case "period": {
      return parsePeriod(
        getSingleTopLevelRawItem(
          "period" in rawOchre ? rawOchre.period : null,
          "period",
        ),
        options,
      ) as unknown as Item<U, V, T, "nested">;
    }
    case "person": {
      return parsePerson(
        getSingleTopLevelRawItem(
          "person" in rawOchre ? rawOchre.person : null,
          "person",
        ),
        options,
      ) as unknown as Item<U, V, T, "nested">;
    }
    case "propertyVariable": {
      const propertyVariables =
        "propertyVariable" in rawOchre ? rawOchre.propertyVariable
        : "variable" in rawOchre ? rawOchre.variable
        : null;
      return parsePropertyVariable(
        getSingleTopLevelRawItem(propertyVariables, "property variable"),
        options,
      ) as unknown as Item<U, V, T, "nested">;
    }
    case "propertyValue": {
      const propertyValues =
        "propertyValue" in rawOchre ? rawOchre.propertyValue
        : "value" in rawOchre ? rawOchre.value
        : null;
      return parsePropertyValue(
        getSingleTopLevelRawItem(propertyValues, "property value"),
        options,
      ) as unknown as Item<U, V, T, "nested">;
    }
    case "resource": {
      return parseResource(
        getSingleTopLevelRawItem(
          "resource" in rawOchre ? rawOchre.resource : null,
          "resource",
        ),
        options,
      ) as unknown as Item<U, V, T, "nested">;
    }
    case "text": {
      return parseText(
        getSingleTopLevelRawItem(
          "text" in rawOchre ? rawOchre.text : null,
          "text",
        ),
        options,
      ) as unknown as Item<U, V, T, "nested">;
    }
    case "set": {
      return parseSet(
        getSingleTopLevelRawItem(
          "set" in rawOchre ? rawOchre.set : null,
          "set",
        ),
        options,
      ) as unknown as Item<U, V, T, "nested">;
    }
  }
}

export function parseDataItems<
  const TItemCategory extends
    | HierarchyItemCategoryOption<DataCategory>
    | undefined = undefined,
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  rawItems: XMLItemLinks | undefined,
  options: { itemCategory?: TItemCategory; languages: T; isRichText?: boolean },
): Array<
  Item<
    DataCategory,
    HierarchyItemCategoryFromOption<DataCategory, TItemCategory>,
    T,
    "nested"
  >
> {
  const parserOptions: ParserOptions<T> & {
    itemCategory?: HierarchyItemCategoryOption<DataCategory>;
  } = {
    languages: options.languages,
    isRichText: options.isRichText ?? false,
    itemCategory: options.itemCategory,
  };
  const items: Array<Item<DataCategory, SetItemDataCategory, T, "nested">> = [];

  for (const tree of rawItems?.tree ?? []) {
    items.push(
      parseTree(tree, {
        ...parserOptions,
        itemCategory: normalizeTreeItemCategory(options.itemCategory),
      }) as Item<DataCategory, SetItemDataCategory, T, "nested">,
    );
  }

  for (const bibliography of rawItems?.bibliography ?? []) {
    items.push(parseBibliography(bibliography, parserOptions));
  }

  for (const concept of rawItems?.concept ?? []) {
    items.push(parseConcept(concept, parserOptions));
  }

  for (const spatialUnit of rawItems?.spatialUnit ?? []) {
    items.push(parseSpatialUnit(spatialUnit, parserOptions));
  }

  for (const period of rawItems?.period ?? []) {
    items.push(parsePeriod(period, parserOptions));
  }

  for (const person of rawItems?.person ?? []) {
    items.push(parsePerson(person, parserOptions));
  }

  for (const propertyVariable of rawItems?.propertyVariable ?? []) {
    items.push(parsePropertyVariable(propertyVariable, parserOptions));
  }

  for (const propertyVariable of rawItems?.variable ?? []) {
    items.push(parsePropertyVariable(propertyVariable, parserOptions));
  }

  for (const propertyValue of rawItems?.propertyValue ?? []) {
    items.push(parsePropertyValue(propertyValue, parserOptions));
  }

  for (const propertyValue of rawItems?.value ?? []) {
    items.push(parsePropertyValue(propertyValue, parserOptions));
  }

  for (const resource of rawItems?.resource ?? []) {
    items.push(parseResource(resource, parserOptions));
  }

  for (const text of rawItems?.text ?? []) {
    items.push(parseText(text, parserOptions));
  }

  for (const set of rawItems?.set ?? []) {
    items.push(parseSet(set, parserOptions));
  }

  return items as Array<
    Item<
      DataCategory,
      HierarchyItemCategoryFromOption<DataCategory, TItemCategory>,
      T,
      "nested"
    >
  >;
}

export function parseSetDataItems<
  const TItemCategories extends ReadonlyArray<SetItemDataCategory> | undefined =
    undefined,
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  rawItems: XMLSetItems | undefined,
  options: {
    itemCategories?: TItemCategories;
    languages: T;
    isRichText?: boolean;
  },
): Array<SetItem<SetItemCategoryFromCategories<TItemCategories>, T>> {
  const parserOptions: ParserOptions<T> = {
    languages: options.languages,
    isRichText: options.isRichText ?? false,
  };
  const categories = normalizeSetItemCategories(options.itemCategories);

  return parseSetItemHierarchy(
    rawItems,
    parserOptions,
    categories ?? undefined,
  ) as Array<SetItem<SetItemCategoryFromCategories<TItemCategories>, T>>;
}

export function parseGallery<T extends ReadonlyArray<string>>(
  rawData: XMLGalleryData,
  options: ParserOptions<T>,
): Gallery<T> {
  const gallery = rawData.result.ochre.gallery;
  const resources: Array<Resource<T, "nested">> = [];
  for (const resource of gallery.resource ?? []) {
    resources.push(parseResource(resource, options));
  }

  return {
    identification: parseIdentification(gallery.item.identification, options),
    projectIdentification: parseIdentification(
      gallery.project.identification,
      options,
    ),
    resources,
    maxLength: parseNumberOrZero(gallery.maxLength),
  };
}

export function parseItem<
  const TItemCategory extends
    | HierarchyItemCategoryOption<DataCategory>
    | undefined = undefined,
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  rawData: XMLData,
  options: {
    category?: undefined;
    itemCategory?: TItemCategory;
    languages: T;
    isRichText?: boolean;
  },
): Item<
  DataCategory,
  HierarchyItemCategoryFromOption<DataCategory, TItemCategory>,
  T
>;
export function parseItem<
  const TCategory extends DataCategory,
  const TItemCategory extends
    | HierarchyItemCategoryOption<TCategory>
    | undefined = undefined,
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  rawData: XMLData,
  options: {
    category: TCategory;
    itemCategory?: TItemCategory;
    languages: T;
    isRichText?: boolean;
  },
): Item<
  TCategory,
  HierarchyItemCategoryFromOption<TCategory, TItemCategory>,
  T
>;
export function parseItem(
  rawData: XMLData,
  options: {
    category?: DataCategory;
    itemCategory?: HierarchyItemCategoryOption<DataCategory>;
    languages: ReadonlyArray<string>;
    isRichText?: boolean;
  },
): Item<DataCategory, SetItemDataCategory, ReadonlyArray<string>>;
export function parseItem(
  rawData: XMLData,
  options: {
    category?: DataCategory;
    itemCategory?: HierarchyItemCategoryOption<DataCategory>;
    languages: ReadonlyArray<string>;
    isRichText?: boolean;
  },
): Item<DataCategory, SetItemDataCategory, ReadonlyArray<string>> {
  const rawOchre = rawData.result.ochre;
  const metadataLanguages = parseMetadataLanguages(rawOchre);
  const languagesToUse = resolveLanguages(options.languages, metadataLanguages);
  const parserOptions: ParserOptions<ReadonlyArray<string>> & {
    itemCategory?: HierarchyItemCategoryOption<DataCategory>;
  } = {
    languages: languagesToUse,
    isRichText: options.isRichText ?? false,
    itemCategory: options.itemCategory,
  };
  const category =
    options.category ??
    normalizeCategory(rawOchre.metadata.item?.category) ??
    inferTopLevelCategory(rawOchre);
  const defaultLanguage = resolveDefaultLanguage(rawOchre, languagesToUse);

  const item = parseTopLevelItem(rawOchre, category, parserOptions);

  return {
    ...item,
    belongsTo: {
      uuid: rawOchre.uuidBelongsTo,
      abbreviation: rawOchre.belongsTo,
    },
    metadata: parseMetadata(rawOchre, parserOptions, defaultLanguage),
    persistentUrl: parseHref(rawOchre.persistentUrl),
  };
}
