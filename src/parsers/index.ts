import type { ParserOptions } from "#/parsers/helpers.js";
import type {
  BaseItem,
  BaseItemLink,
  Bibliography,
  BibliographyEntryInfo,
  BibliographySourceDocument,
  Concept,
  ContainedItemCategory,
  ContainedItemCategoryFromOption,
  ContainedItemCategoryOption,
  Context,
  ContextItem,
  ContextItemCategory,
  ContextNode,
  Coordinates,
  CoordinatesSource,
  Event,
  Gallery,
  Heading,
  HeadingItemCategory,
  Identification,
  Image,
  ImageMap,
  ImageMapArea,
  Interpretation,
  Item,
  ItemCategory,
  ItemLink,
  ItemLinkCategory,
  ItemLinks,
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
  SetItemCategory,
  SetItemProperty,
  SetPeriod,
  SetResource,
  SetSpatialUnit,
  SetTree,
  SimplifiedProperty,
  SpatialUnit,
  Text,
  Tree,
  TreeItemCategory,
} from "#/types/index.js";
import type {
  XMLBaseItem,
  XMLBibliography,
  XMLConcept,
  XMLContent,
  XMLContext,
  XMLContextGroup,
  XMLContextItem,
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
  XMLSimplifiedProperty,
  XMLSpatialUnit,
  XMLString,
  XMLText,
  XMLTree,
} from "#/xml/types.js";
import { DEFAULT_LANGUAGES } from "#/constants.js";
import {
  getParserOptions,
  multilingualFromText,
  parseContentLike,
  parseContentLikeText,
  parseLicense,
  parseRequiredContentLike,
  parseStringLike,
} from "#/parsers/helpers.js";
import { MultilingualString } from "#/parsers/multilingual.js";
import {
  parseXMLString,
  transformPermanentIdentificationUrl,
} from "#/parsers/string.js";
import { getXMLSourceIndex } from "#/xml/metadata.js";

export type { ParserOptions } from "#/parsers/helpers.js";
export { getParserOptions, parseStringLike } from "#/parsers/helpers.js";

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
  T extends ReadonlyArray<SetItemCategory> | undefined,
> =
  T extends ReadonlyArray<infer U>
    ? Extract<U, SetItemCategory>
    : SetItemCategory;

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

function isXMLContextGroup(
  context: XMLContext[number],
): context is XMLContextGroup {
  return "context" in context;
}

function isXMLContextItem(
  context: XMLContextGroup["context"][number],
): context is XMLContextItem {
  return "project" in context;
}

type HierarchyEntryCategory = ItemLinkCategory | "heading";

type HierarchyEntry = {
  category: HierarchyEntryCategory;
  item: unknown;
  fallbackIndex: number;
};

type EmbeddedItemParserOptions<T extends ReadonlyArray<string>> =
  ParserOptions<T> & {
    containedItemCategory?: ContainedItemCategoryOption<ItemCategory>;
  };

const TREE_ITEM_CATEGORIES = [
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
] as const satisfies ReadonlyArray<TreeItemCategory>;

const SET_ITEM_CATEGORIES = [
  "tree",
  ...TREE_ITEM_CATEGORIES,
] as const satisfies ReadonlyArray<SetItemCategory>;

const HEADING_ITEM_CATEGORIES = [
  "person",
  "propertyVariable",
  "propertyValue",
  "resource",
  "text",
  "set",
] as const satisfies ReadonlyArray<HeadingItemCategory>;

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
  parsed: ContextItemCategory;
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
    code: parseStringLike(rawIdentification.code),
    email: parseStringLike(rawIdentification.email),
    website: parseStringLike(rawIdentification.website),
  };
}

function emptyIdentification<T extends ReadonlyArray<string>>(
  options: ParserOptions<T>,
): Identification<T> {
  return {
    label: MultilingualString.empty(options.languages),
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
  return rawIdentification == null
    ? emptyIdentification(options)
    : parseIdentification(rawIdentification, options);
}

function parseContextItem(contextItem: XMLContextValue): ContextItem {
  return {
    uuid: contextItem.uuid ?? null,
    publicationDateTime: contextItem.publicationDateTime ?? null,
    index: contextItem.n,
    content: contextItem.payload,
  };
}

function emptyContextItem(): ContextItem {
  return { uuid: null, publicationDateTime: null, index: 0, content: "" };
}

function parseContext(rawContext: XMLContext): Context<ContextItemCategory> {
  const nodes: Array<ContextNode<ContextItemCategory>> = [];
  let displayPath = "";

  for (const rawContextOuterItem of rawContext) {
    if (!isXMLContextGroup(rawContextOuterItem)) {
      continue;
    }

    displayPath = displayPath || rawContextOuterItem.displayPath;

    for (const rawContextItem of rawContextOuterItem.context) {
      if (!isXMLContextItem(rawContextItem)) {
        continue;
      }

      const node: ContextNode<ContextItemCategory> = {
        tree:
          rawContextItem.tree[0] == null
            ? emptyContextItem()
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

  return { nodes, displayPath };
}

function parseEventReference<T extends ReadonlyArray<string>>(
  rawReference:
    | (XMLContent & { uuid: string; publicationDateTime?: Date })
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
    publicationDateTime: rawReference.publicationDateTime ?? null,
  };
}

function parseEvent<T extends ReadonlyArray<string>>(
  rawEvent: XMLEvent,
  options: ParserOptions<T>,
): Event<T> {
  const startDate = rawEvent.dateTime ?? null;
  const endDate = rawEvent.endDateTime ?? null;
  const date =
    startDate == null
      ? null
      : endDate == null
        ? startDate
        : { start: startDate, end: endDate };

  return {
    date,
    label: parseRequiredContentLike(rawEvent.label, options),
    comment: parseContentLike(rawEvent.comment, options),
    agent: parseEventReference(rawEvent.agent, options),
    location: parseEventReference(rawEvent.location, options),
    other:
      rawEvent.other == null
        ? null
        : {
            uuid: rawEvent.other.uuid ?? null,
            category: normalizeCategory(rawEvent.other.category),
            label: parseRequiredContentLike(rawEvent.other, options),
          },
  };
}

function parseBaseItem<U extends ItemCategory, T extends ReadonlyArray<string>>(
  category: U,
  rawItem: Partial<XMLBaseItem> & {
    uuid?: string;
    publicationDateTime?: Date;
    date?: Date | XMLString;
  },
  options: ParserOptions<T>,
): BaseItem<U, T, "embedded"> {
  const events: Array<Event<T>> = [];
  for (const event of rawItem.events?.event ?? []) {
    events.push(parseEvent(event, options));
  }

  const creators: Array<Person<T, "embedded">> = [];
  for (const creator of rawItem.creators?.creator ?? []) {
    creators.push(parsePerson(creator, options));
  }

  return {
    uuid: rawItem.uuid ?? "",
    category,
    belongsTo: null,
    metadata: null,
    persistentUrl: null,
    publicationDateTime: rawItem.publicationDateTime ?? null,
    context: rawItem.context == null ? null : parseContext(rawItem.context),
    date: rawItem.date instanceof Date ? rawItem.date : null,
    license: parseLicense(rawItem.availability),
    copyright:
      rawItem.copyright == null
        ? null
        : parseContentLike(rawItem.copyright, options),
    watermark:
      rawItem.watermark == null
        ? null
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

function normalizeCategory(category: string | undefined): ItemCategory | null {
  if (category == null) {
    return null;
  }

  if (category === "variable") {
    return "propertyVariable";
  }

  if (category === "value") {
    return "propertyValue";
  }

  for (const knownCategory of SET_ITEM_CATEGORIES) {
    if (category === knownCategory) {
      return knownCategory;
    }
  }

  return null;
}

function isHeadingItemCategory(
  category: TreeItemCategory,
): category is HeadingItemCategory {
  return HEADING_ITEM_CATEGORIES.includes(category as HeadingItemCategory);
}

function pushCategory(
  categories: Array<SetItemCategory>,
  category: SetItemCategory,
): void {
  if (!categories.includes(category)) {
    categories.push(category);
  }
}

function getHierarchyEntryCategory(key: string): HierarchyEntryCategory | null {
  switch (key) {
    case "heading":
    case "tree":
    case "bibliography":
    case "concept":
    case "spatialUnit":
    case "period":
    case "person":
    case "resource":
    case "text":
    case "set":
    case "dictionaryUnit": {
      return key;
    }
    case "propertyVariable":
    case "variable": {
      return "propertyVariable";
    }
    case "propertyValue":
    case "value": {
      return "propertyValue";
    }
    default: {
      return null;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null;
}

function isResourceWrapper(
  value: unknown,
): value is { resource: Array<unknown> } {
  return isRecord(value) && !("uuid" in value) && Array.isArray(value.resource);
}

function sourceOrderSort(left: HierarchyEntry, right: HierarchyEntry): number {
  const leftIndex = getXMLSourceIndex(left.item);
  const rightIndex = getXMLSourceIndex(right.item);
  if (leftIndex != null && rightIndex != null && leftIndex !== rightIndex) {
    return leftIndex - rightIndex;
  }

  return left.fallbackIndex - right.fallbackIndex;
}

function collectHierarchyEntries(
  hierarchy: Partial<Record<string, unknown>> | undefined,
  categories?: ReadonlyArray<HierarchyEntryCategory>,
): Array<HierarchyEntry> {
  const entries: Array<HierarchyEntry> = [];
  if (hierarchy == null) {
    return entries;
  }

  let fallbackIndex = 0;
  for (const key of Object.keys(hierarchy)) {
    const category = getHierarchyEntryCategory(key);
    if (
      category == null ||
      !(categories == null || categories.includes(category))
    ) {
      continue;
    }

    const values = hierarchy[key];
    if (!Array.isArray(values)) {
      continue;
    }

    for (const value of values) {
      if (category === "resource" && isResourceWrapper(value)) {
        for (const resource of value.resource) {
          entries.push({ category, item: resource, fallbackIndex });
          fallbackIndex += 1;
        }
        continue;
      }

      entries.push({ category, item: value, fallbackIndex });
      fallbackIndex += 1;
    }
  }

  entries.sort(sourceOrderSort);
  return entries;
}

function inferItemCategories(
  hierarchy: XMLItemHierarchy | undefined,
): Array<SetItemCategory> {
  const categories: Array<SetItemCategory> = [];
  if (hierarchy == null) {
    return categories;
  }

  for (const entry of collectHierarchyEntries(hierarchy)) {
    if (entry.category === "heading") {
      for (const category of inferItemCategories(
        entry.item as XMLItemHierarchy,
      )) {
        pushCategory(categories, category);
      }
      continue;
    }

    if (entry.category === "dictionaryUnit") {
      continue;
    }

    pushCategory(categories, entry.category);
  }

  return categories;
}

function normalizeSetItemCategories<U extends SetItemCategory>(
  containedItemCategory: U | ReadonlyArray<U> | undefined,
): Array<U> | null {
  if (containedItemCategory == null) {
    return null;
  }

  const categories =
    typeof containedItemCategory === "string"
      ? [containedItemCategory]
      : containedItemCategory;
  const uniqueCategories: Array<U> = [];
  for (const category of categories) {
    if (!uniqueCategories.includes(category)) {
      uniqueCategories.push(category);
    }
  }

  return uniqueCategories;
}

function normalizeTreeItemCategory(
  containedItemCategory:
    | SetItemCategory
    | ReadonlyArray<SetItemCategory>
    | undefined,
): TreeItemCategory | undefined {
  if (
    containedItemCategory != null &&
    typeof containedItemCategory !== "string"
  ) {
    throw new Error("Tree containedItemCategory must be a single category", {
      cause: containedItemCategory,
    });
  }

  if (containedItemCategory === "tree") {
    throw new Error('Tree containedItemCategory cannot be "tree"', {
      cause: containedItemCategory,
    });
  }

  return containedItemCategory;
}

function resolveTreeItemCategory<U extends TreeItemCategory>(
  rawTree: XMLTree,
  containedItemCategory: U | undefined,
): U | null {
  const inferredCategories = inferItemCategories(rawTree.items);
  if (inferredCategories.length > 1) {
    throw new Error(
      `Expected Tree items to contain one category, received ${inferredCategories.join(", ")}`,
      { cause: inferredCategories },
    );
  }

  const inferredCategory = inferredCategories[0] ?? null;
  if (inferredCategory === "tree") {
    throw new Error('Tree items cannot contain category "tree"', {
      cause: inferredCategory,
    });
  }

  if (
    containedItemCategory != null &&
    inferredCategory != null &&
    containedItemCategory !== inferredCategory
  ) {
    throw new Error(
      `Tree containedItemCategory "${containedItemCategory}" does not match XML items category "${inferredCategory}"`,
      { cause: { containedItemCategory, inferredCategory } },
    );
  }

  return containedItemCategory ?? (inferredCategory as U | null);
}

function parseImage<T extends ReadonlyArray<string>>(
  rawImage: XMLImage | undefined,
  options: ParserOptions<T>,
): Image<T> | null {
  if (rawImage == null) {
    return null;
  }

  return {
    publicationDateTime: rawImage.publicationDateTime ?? null,
    identification:
      rawImage.identification == null
        ? null
        : parseIdentification(rawImage.identification, options),
    href: parseHref(rawImage.href),
    htmlImgSrcPrefix: rawImage.htmlImgSrcPrefix ?? null,
    height: rawImage.height ?? null,
    width: rawImage.width ?? null,
    fileSize: rawImage.fileSize ?? null,
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
          value == null
            ? MultilingualString.empty(options.languages)
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
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        altitude: coordinate.altitude ?? null,
        source: parseCoordinatesSource(coordinate.source, options),
      };
    }
    case "plane": {
      return {
        type: "plane",
        minimum: {
          latitude: coordinate.minimum.latitude,
          longitude: coordinate.minimum.longitude,
        },
        maximum: {
          latitude: coordinate.maximum.latitude,
          longitude: coordinate.maximum.longitude,
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
    area.shape === "rect"
      ? "rectangle"
      : area.shape === "circle"
        ? "circle"
        : "polygon";

  return {
    uuid: area.uuid,
    publicationDateTime: area.publicationDateTime,
    type: area.type,
    title: area.title,
    slug: area.slug ?? null,
    items:
      shape === "rectangle"
        ? [
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
        : shape === "circle"
          ? [
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

  return { areas, width: rawImageMap.width, height: rawImageMap.height };
}

function parseNote<T extends ReadonlyArray<string>>(
  rawNote: XMLNote,
  options: ParserOptions<T>,
): Note<T> {
  const authors: Array<Person<T, "embedded">> = [];
  for (const author of rawNote.authors?.author ?? []) {
    authors.push(parsePerson(author, options));
  }

  const content =
    rawNote.content == null
      ? multilingualFromText(
          parseXMLString(rawNote, { parseEmail: true }),
          options,
        )
      : parseRequiredContentLike(rawNote as XMLContent, options);

  return {
    number: rawNote.noteNo ?? 0,
    title: parseNoteTitle(rawNote, options),
    content,
    authors,
  };
}

function parseNoteTitle<T extends ReadonlyArray<string>>(
  rawNote: XMLNote,
  options: ParserOptions<T>,
): MultilingualString<T> | null {
  if (rawNote.title != null) {
    return multilingualFromText(rawNote.title, options);
  }

  const titleContent: Partial<Record<T[number], string>> = {};
  for (const content of rawNote.content ?? []) {
    if (!options.languages.includes(content.lang) || content.title == null) {
      continue;
    }

    titleContent[content.lang as T[number]] = content.title;
  }

  if (Object.keys(titleContent).length > 0) {
    return MultilingualString.fromObject(titleContent, options.languages);
  }

  for (const content of rawNote.content ?? []) {
    if (content.lang !== "zxx" && content.title != null) {
      return multilingualFromText(content.title, options);
    }
  }

  return null;
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

  throw new Error(`Invalid property value data type: ${dataType}`, {
    cause: dataType,
  });
}

function parsePropertyValueContent<T extends ReadonlyArray<string>>(
  value: XMLPropertyValueNode,
  options: ParserOptions<T>,
): PropertyValueContent<T> {
  const dataType = parsePropertyDataType(value.dataType);
  const rawLabel =
    value.content == null
      ? null
      : parseRequiredContentLike(value as XMLContent, options);
  const displayText = rawLabel?.getText() ?? value.payload ?? value.slug ?? "";
  const contentText = value.rawValue ?? value.payload ?? displayText;
  const common = {
    hierarchy: {
      isLeaf: value.inherited == null || !value.inherited,
      level: value.i ?? null,
    },
    label: rawLabel,
    isUncertain: value.isUncertain === "true",
    category: value.category ?? null,
    type: value.type ?? null,
    uuid: value.uuid == null || value.uuid === "" ? null : value.uuid,
    publicationDateTime: value.publicationDateTime ?? null,
    unit: value.unit ?? null,
    href: parseHref(value.href),
    height: value.height ?? null,
    width: value.width ?? null,
    fileSize: value.fileSize ?? null,
    slug: value.slug ?? null,
  };

  switch (dataType) {
    case "integer":
    case "decimal":
    case "time": {
      const numericContent = Number(contentText);
      return {
        ...common,
        dataType,
        content: Number.isNaN(numericContent) ? 0 : numericContent,
      };
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
    variable: {
      uuid: rawProperty.label.uuid,
      label: parseRequiredContentLike(rawProperty.label, options),
      publicationDateTime: rawProperty.label.publicationDateTime ?? null,
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

function parseSimplifiedProperty<T extends ReadonlyArray<string>>(
  rawProperty: XMLSimplifiedProperty,
  options: ParserOptions<T>,
): SimplifiedProperty<T> {
  const values: Array<PropertyValueContent<T>> = [];
  for (const value of rawProperty.value ?? []) {
    values.push(parsePropertyValueContent(value, options));
  }

  const properties: Array<SimplifiedProperty<T>> = [];
  for (const property of rawProperty.property ?? []) {
    properties.push(parseSimplifiedProperty(property, options));
  }

  return {
    variable: {
      uuid: rawProperty.label.uuid,
      label: parseContentLikeText(rawProperty.label, options),
      publicationDateTime: rawProperty.label.publicationDateTime ?? null,
    },
    values,
    comment: parseContentLike(rawProperty.comment, options),
    properties,
  };
}

export function parseSimplifiedProperties<T extends ReadonlyArray<string>>(
  rawProperties: { property: Array<XMLSimplifiedProperty> } | undefined,
  options: ParserOptions<T>,
): Array<SimplifiedProperty<T>> {
  const properties: Array<SimplifiedProperty<T>> = [];
  for (const property of rawProperties?.property ?? []) {
    properties.push(parseSimplifiedProperty(property, options));
  }

  return properties;
}

function parseSetItemProperty<T extends ReadonlyArray<string>>(
  rawProperty: XMLProperty,
  options: ParserOptions<T>,
): SetItemProperty<T> {
  const property = parseProperty(rawProperty, options);
  return {
    variable: property.variable,
    values: property.values,
    comment: property.comment,
  };
}

function parseSetItemProperties<T extends ReadonlyArray<string>>(
  rawProperties: { property: Array<XMLProperty> } | undefined,
  options: ParserOptions<T>,
): Array<SetItemProperty<T>> {
  const properties: Array<SetItemProperty<T>> = [];
  for (const property of rawProperties?.property ?? []) {
    properties.push(parseSetItemProperty(property, options));
  }

  return properties;
}

function withSetItemProperties<
  U extends { properties: Array<Property<T>> },
  T extends ReadonlyArray<string>,
>(
  item: U,
  rawProperties: { property: Array<XMLProperty> } | undefined,
  options: ParserOptions<T>,
): Omit<U, "properties"> & { properties: Array<SetItemProperty<T>> } {
  return {
    ...item,
    properties: parseSetItemProperties(rawProperties, options),
  };
}

function withoutItems<U extends { items: unknown }>(item: U): Omit<U, "items"> {
  const { items: _items, ...itemWithoutItems } = item;
  return itemWithoutItems;
}

function parseEmbeddedItemEntry<T extends ReadonlyArray<string>>(
  entry: HierarchyEntry,
  options: EmbeddedItemParserOptions<T>,
): Item<ItemCategory, SetItemCategory, T, "embedded"> | null {
  switch (entry.category) {
    case "tree": {
      return parseTree(entry.item as XMLTree, {
        ...options,
        containedItemCategory: normalizeTreeItemCategory(
          options.containedItemCategory,
        ),
      }) as Item<ItemCategory, SetItemCategory, T, "embedded">;
    }
    case "bibliography": {
      return parseBibliography(entry.item as XMLBibliography, options) as Item<
        ItemCategory,
        SetItemCategory,
        T,
        "embedded"
      >;
    }
    case "concept": {
      return parseConcept(entry.item as XMLConcept, options) as Item<
        ItemCategory,
        SetItemCategory,
        T,
        "embedded"
      >;
    }
    case "spatialUnit": {
      return parseSpatialUnit(entry.item as XMLSpatialUnit, options) as Item<
        ItemCategory,
        SetItemCategory,
        T,
        "embedded"
      >;
    }
    case "period": {
      return parsePeriod(entry.item as XMLPeriod, options) as Item<
        ItemCategory,
        SetItemCategory,
        T,
        "embedded"
      >;
    }
    case "person": {
      return parsePerson(entry.item as XMLPerson, options) as Item<
        ItemCategory,
        SetItemCategory,
        T,
        "embedded"
      >;
    }
    case "propertyVariable": {
      return parsePropertyVariable(
        entry.item as XMLPropertyVariable,
        options,
      ) as Item<ItemCategory, SetItemCategory, T, "embedded">;
    }
    case "propertyValue": {
      return parsePropertyValue(
        entry.item as XMLPropertyValueItem,
        options,
      ) as Item<ItemCategory, SetItemCategory, T, "embedded">;
    }
    case "resource": {
      return parseResource(entry.item as XMLResource, options) as Item<
        ItemCategory,
        SetItemCategory,
        T,
        "embedded"
      >;
    }
    case "text": {
      return parseText(entry.item as XMLText, options) as Item<
        ItemCategory,
        SetItemCategory,
        T,
        "embedded"
      >;
    }
    case "set": {
      return parseSet(entry.item as XMLSet, options) as Item<
        ItemCategory,
        SetItemCategory,
        T,
        "embedded"
      >;
    }
    case "dictionaryUnit":
    case "heading": {
      return null;
    }
  }
}

function parseItemHierarchy<T extends ReadonlyArray<string>>(
  hierarchy: XMLItemHierarchy | undefined,
  options: ParserOptions<T>,
  categories?: ReadonlyArray<ItemCategory>,
): Array<Item<ItemCategory, SetItemCategory, T, "embedded">> {
  const items: Array<Item<ItemCategory, SetItemCategory, T, "embedded">> = [];
  if (hierarchy == null) {
    return items;
  }

  for (const entry of collectHierarchyEntries(hierarchy, categories)) {
    const item = parseEmbeddedItemEntry(entry, options);
    if (item != null) {
      items.push(item);
    }
  }

  return items;
}

function parseSetItemHierarchy<T extends ReadonlyArray<string>>(
  hierarchy: XMLItemHierarchy | undefined,
  options: ParserOptions<T>,
  categories?: ReadonlyArray<SetItemCategory>,
): Array<SetItem<SetItemCategory, T>> {
  const items: Array<SetItem<SetItemCategory, T>> = [];
  if (hierarchy == null) {
    return items;
  }

  for (const entry of collectHierarchyEntries(hierarchy, categories)) {
    switch (entry.category) {
      case "tree": {
        items.push(
          parseSetTree(entry.item as XMLTree, options) as SetItem<
            SetItemCategory,
            T
          >,
        );
        break;
      }
      case "bibliography": {
        items.push(
          parseSetBibliography(
            entry.item as XMLBibliography,
            options,
          ) as SetItem<SetItemCategory, T>,
        );
        break;
      }
      case "concept": {
        items.push(
          parseSetConcept(entry.item as XMLConcept, options) as SetItem<
            SetItemCategory,
            T
          >,
        );
        break;
      }
      case "spatialUnit": {
        items.push(
          parseSetSpatialUnit(entry.item as XMLSpatialUnit, options) as SetItem<
            SetItemCategory,
            T
          >,
        );
        break;
      }
      case "period": {
        items.push(
          parseSetPeriod(entry.item as XMLPeriod, options) as SetItem<
            SetItemCategory,
            T
          >,
        );
        break;
      }
      case "person": {
        const person = entry.item as XMLPerson;
        items.push(
          withSetItemProperties(
            parsePerson(person, options),
            person.properties,
            options,
          ) as SetItem<SetItemCategory, T>,
        );
        break;
      }
      case "propertyVariable": {
        items.push(
          parsePropertyVariable(
            entry.item as XMLPropertyVariable,
            options,
          ) as SetItem<SetItemCategory, T>,
        );
        break;
      }
      case "propertyValue": {
        const propertyValue = entry.item as XMLPropertyValueItem;
        items.push(
          withSetItemProperties(
            parsePropertyValue(propertyValue, options),
            propertyValue.properties,
            options,
          ) as SetItem<SetItemCategory, T>,
        );
        break;
      }
      case "resource": {
        items.push(
          parseSetResource(entry.item as XMLResource, options) as SetItem<
            SetItemCategory,
            T
          >,
        );
        break;
      }
      case "text": {
        items.push(
          parseText(entry.item as XMLText, options) as SetItem<
            SetItemCategory,
            T
          >,
        );
        break;
      }
      case "set": {
        items.push(
          parseSetSet(entry.item as XMLSet, options) as SetItem<
            SetItemCategory,
            T
          >,
        );
        break;
      }
      case "dictionaryUnit":
      case "heading": {
        break;
      }
    }
  }

  return items;
}

function normalizeTreeLinkItemsCategory(
  type: string | undefined,
): TreeItemCategory | null {
  const category = normalizeCategory(type);
  if (category == null || category === "tree") {
    return null;
  }

  return category;
}

function normalizeSetLinkItemsCategory(
  type: string | undefined,
): Array<SetItemCategory> | null {
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
    publicationDateTime?: Date;
    context?: XMLContext;
    date?: Date | XMLString;
    identification?: XMLIdentification;
    description?: XMLContent;
  },
  options: ParserOptions<T>,
): BaseItemLink<U, T> {
  return {
    uuid: rawItem.uuid ?? "",
    category,
    publicationDateTime: rawItem.publicationDateTime ?? null,
    context: rawItem.context == null ? null : parseContext(rawItem.context),
    date: rawItem.date instanceof Date ? rawItem.date : null,
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
    publicationDateTime: sourceDocument.publicationDateTime ?? null,
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
    startDate.year ?? 0,
    Math.max((startDate.month ?? 0) - 1, 0),
    startDate.day ?? 0,
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
    containedItemCategory: normalizeTreeLinkItemsCategory(rawTree.type),
  };
}

function parseSetItemLink<T extends ReadonlyArray<string>>(
  rawSet: XMLLinkedSet,
  options: ParserOptions<T>,
): ItemLink<"set", T> {
  return {
    ...parseBaseItemLink("set", rawSet, options),
    type: rawSet.type ?? null,
    containedItemCategories: normalizeSetLinkItemsCategory(rawSet.type),
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
    citationFormatSpan: parseStringLike(rawBibliography.citationFormatSpan),
    referenceFormatDiv: parseStringLike(rawBibliography.referenceFormatDiv),
    image: parseImage(rawBibliography.image, options),
    sourceDocument: parseBibliographySourceDocument(
      rawBibliography.sourceDocument,
    ),
    publicationInfo:
      rawBibliography.publicationInfo == null
        ? null
        : {
            publishers: parsePersonItemLinks(
              rawBibliography.publicationInfo.publishers == null
                ? undefined
                : "publisher" in rawBibliography.publicationInfo.publishers
                  ? rawBibliography.publicationInfo.publishers.publisher
                  : rawBibliography.publicationInfo.publishers.publishers
                      .person,
              options,
            ),
            startDate: parseBibliographyStartDate(
              rawBibliography.publicationInfo.startDate,
            ),
          },
    entryInfo: parseBibliographyEntryInfo(rawBibliography.entryInfo),
    source: firstItemLink<TreeItemCategory, T>(rawBibliography.source, options),
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
    fileSize: rawResource.fileSize ?? null,
    isInline: rawResource.rend === "inline",
    isPrimary: rawResource.isPrimary ?? false,
    height: rawResource.height ?? null,
    width: rawResource.width ?? null,
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

  for (const entry of collectHierarchyEntries(hierarchy)) {
    switch (entry.category) {
      case "tree": {
        links.push(parseTreeItemLink(entry.item as XMLLinkedTree, options));
        break;
      }
      case "bibliography": {
        links.push(
          parseBibliographyItemLink(
            entry.item as XMLLinkedBibliography,
            options,
          ),
        );
        break;
      }
      case "concept": {
        links.push(
          parseConceptItemLink(entry.item as XMLLinkedConcept, options),
        );
        break;
      }
      case "spatialUnit": {
        links.push(
          parseSpatialUnitItemLink(entry.item as XMLLinkedSpatialUnit, options),
        );
        break;
      }
      case "period": {
        links.push(parsePeriodItemLink(entry.item as XMLLinkedPeriod, options));
        break;
      }
      case "person": {
        links.push(parsePersonItemLink(entry.item as XMLLinkedPerson, options));
        break;
      }
      case "propertyVariable": {
        links.push(
          parsePropertyVariableItemLink(
            entry.item as XMLLinkedPropertyVariable,
            options,
          ),
        );
        break;
      }
      case "propertyValue": {
        links.push(
          parsePropertyValueItemLink(
            entry.item as XMLLinkedPropertyValue,
            options,
          ),
        );
        break;
      }
      case "resource": {
        links.push(
          parseResourceItemLink(entry.item as XMLLinkedResource, options),
        );
        break;
      }
      case "text": {
        links.push(parseTextItemLink(entry.item as XMLLinkedText, options));
        break;
      }
      case "set": {
        links.push(parseSetItemLink(entry.item as XMLLinkedSet, options));
        break;
      }
      case "dictionaryUnit": {
        links.push(
          parseDictionaryUnitItemLink(entry.item as XMLDictionaryUnit, options),
        );
        break;
      }
      case "heading": {
        break;
      }
    }
  }

  return links;
}

function parseReverseLinks<T extends ReadonlyArray<string>>(
  rawLinks: XMLLink | XMLDataItem | Array<XMLLink | XMLDataItem> | undefined,
  options: ParserOptions<T>,
): ItemLinks<T> {
  const links: ItemLinks<T> = [];
  const rawLinksToParse =
    rawLinks == null ? [] : Array.isArray(rawLinks) ? rawLinks : [rawLinks];
  for (const rawLink of rawLinksToParse) {
    links.push(...parseLinks(rawLink, options));
  }

  return links;
}

function parsePeriodList<T extends ReadonlyArray<string>>(
  rawPeriods: { period: Array<XMLPeriod> } | undefined,
  options: ParserOptions<T>,
): Array<Period<T, "embedded">> {
  const periods: Array<Period<T, "embedded">> = [];
  for (const period of rawPeriods?.period ?? []) {
    periods.push(parsePeriod(period, options));
  }

  return periods;
}

export function parseBibliographyList<T extends ReadonlyArray<string>>(
  rawBibliographies: { bibliography: Array<XMLBibliography> } | undefined,
  options: ParserOptions<T>,
): Array<Bibliography<T, "embedded">> {
  const bibliographies: Array<Bibliography<T, "embedded">> = [];
  for (const bibliography of rawBibliographies?.bibliography ?? []) {
    bibliographies.push(parseBibliography(bibliography, options));
  }

  return bibliographies;
}

export function parsePersonList<T extends ReadonlyArray<string>>(
  rawPersons: Array<XMLPerson> | undefined,
  options: ParserOptions<T>,
): Array<Person<T, "embedded">> {
  const persons: Array<Person<T, "embedded">> = [];
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
    number: rawInterpretation.interpretationNo,
    date: rawInterpretation.date ?? null,
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
    number: rawObservation.observationNo,
    date: rawObservation.date ?? null,
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
    publicationDateTime: rawSection.publicationDateTime ?? null,
    identification: parseIdentification(rawSection.identification, options),
    project:
      rawSection.project == null
        ? null
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
  U extends HeadingItemCategory,
  T extends ReadonlyArray<string>,
>(
  rawHeading: XMLHeading,
  containedItemCategory: U,
  options: ParserOptions<T>,
): Heading<U, T> {
  const headings: Array<Heading<U, T>> = [];
  for (const heading of rawHeading.heading ?? []) {
    headings.push(parseHeading(heading, containedItemCategory, options));
  }

  return {
    name: rawHeading.name,
    headings,
    items: parseItemHierarchy(rawHeading as XMLItemHierarchy, options, [
      containedItemCategory,
    ]) as Array<Item<U, never, T, "embedded">>,
  };
}

function parseTree<
  U extends TreeItemCategory = TreeItemCategory,
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  rawTree: XMLTree,
  options: ParserOptions<T> & { containedItemCategory?: U },
): Tree<U, T, "embedded"> {
  const childOptions = getParserOptions(options);
  const containedItemCategory = resolveTreeItemCategory(
    rawTree,
    normalizeTreeItemCategory(options.containedItemCategory),
  );

  const items: Array<
    Heading<U & HeadingItemCategory, T> | Item<U, never, T, "embedded">
  > = [];
  if (containedItemCategory != null) {
    const itemCategories: Array<HierarchyEntryCategory> = [
      containedItemCategory,
    ];
    if (isHeadingItemCategory(containedItemCategory)) {
      itemCategories.push("heading");
    }

    for (const entry of collectHierarchyEntries(
      rawTree.items,
      itemCategories,
    )) {
      if (entry.category === "heading") {
        if (!isHeadingItemCategory(containedItemCategory)) {
          continue;
        }

        items.push(
          parseHeading(
            entry.item as XMLHeading,
            containedItemCategory,
            childOptions,
          ) as Heading<U & HeadingItemCategory, T>,
        );
        continue;
      }

      const item = parseEmbeddedItemEntry(entry, childOptions);
      if (item != null) {
        items.push(item as Item<U, never, T, "embedded">);
      }
    }
  }

  return {
    ...parseBaseItem("tree", rawTree, childOptions),
    type: rawTree.type ?? null,
    containedItemCategory: containedItemCategory as U | null,
    links: parseLinks(rawTree.links, childOptions),
    notes: parseNotes(rawTree.notes, childOptions),
    properties: parseProperties(rawTree.properties, childOptions),
    bibliographies: parseBibliographyList(rawTree.bibliographies, childOptions),
    items: items as Tree<U, T, "embedded">["items"],
  };
}

function parseSet<
  U extends SetItemCategory = SetItemCategory,
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  rawSet: XMLSet,
  options: ParserOptions<T> & { containedItemCategory?: U | ReadonlyArray<U> },
): Set<U, T, "embedded"> {
  const childOptions = getParserOptions(options);
  const optionCategories = normalizeSetItemCategories(
    options.containedItemCategory,
  );
  const containedItemCategories =
    optionCategories ?? inferItemCategories(rawSet.items);

  return {
    ...parseBaseItem("set", rawSet, childOptions),
    containedItemCategories: containedItemCategories as Array<U>,
    isTabularStructure: rawSet.tabularStructure ?? false,
    isSuppressingBlanks: rawSet.suppressBlanks ?? false,
    links: parseLinks(rawSet.links, childOptions),
    notes: parseNotes(rawSet.notes, childOptions),
    properties: parseProperties(rawSet.properties, childOptions),
    items: parseSetItemHierarchy(
      rawSet.items,
      childOptions,
      containedItemCategories,
    ) as Array<SetItem<U, T>>,
  };
}

function parseSetBibliography<T extends ReadonlyArray<string>>(
  rawBibliography: XMLBibliography,
  options: ParserOptions<T>,
): SetBibliography<T> {
  return withoutItems(
    withSetItemProperties(
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
    properties: parseSetItemProperties(rawConcept.properties, options),
  };
}

function parseSpatialUnitMapData(
  mapData: XMLSpatialUnit["mapData"],
): SpatialUnit<ReadonlyArray<string>, "embedded">["mapData"] {
  if (mapData == null) {
    return null;
  }

  return {
    geoJSON: {
      multiPolygon: mapData.geoJSON.multiPolygon.payload,
      EPSG: mapData.geoJSON.EPSG,
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
    properties: parseSetItemProperties(rawSpatialUnit.properties, options),
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
    withSetItemProperties(
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
    withSetItemProperties(
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
    withSetItemProperties(
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
    withSetItemProperties(
      parseSet(rawSet, options),
      rawSet.properties,
      options,
    ),
  ) as SetItem<"set", T>;
}

function parseBibliography<T extends ReadonlyArray<string>>(
  rawBibliography: XMLBibliography,
  options: ParserOptions<T>,
): Bibliography<T, "embedded"> {
  const sourceItems =
    rawBibliography.source == null
      ? []
      : parseLinks(rawBibliography.source, options);
  const bibliographies = parseBibliographyList(
    rawBibliography.bibliographies,
    options,
  );
  const items: Array<Bibliography<T, "embedded">> = [];
  for (const bibliography of rawBibliography.bibliography ?? []) {
    items.push(parseBibliography(bibliography, options));
  }

  const baseBibliography = {
    ...parseBaseItem("bibliography", rawBibliography, options),
    citationDetails: rawBibliography.citationDetails ?? null,
    citationFormat: parseContentLike(rawBibliography.citationFormat, options),
    citationFormatSpan: parseStringLike(rawBibliography.citationFormatSpan),
    referenceFormatDiv: parseStringLike(rawBibliography.referenceFormatDiv),
    image: parseImage(rawBibliography.image, options),
    sourceDocument: parseBibliographySourceDocument(
      rawBibliography.sourceDocument,
    ),
    publicationInfo:
      rawBibliography.publicationInfo == null
        ? null
        : {
            publishers: parsePersonList(
              rawBibliography.publicationInfo.publishers == null
                ? undefined
                : "publisher" in rawBibliography.publicationInfo.publishers
                  ? rawBibliography.publicationInfo.publishers.publisher
                  : rawBibliography.publicationInfo.publishers.publishers
                      .person,
              options,
            ),
            startDate: parseBibliographyStartDate(
              rawBibliography.publicationInfo.startDate,
            ),
          },
    entryInfo: parseBibliographyEntryInfo(rawBibliography.entryInfo),
    source:
      sourceItems[0] == null
        ? null
        : (sourceItems[0] as ItemLink<TreeItemCategory, T>),
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
): Concept<T, "embedded"> {
  const interpretations: Array<Interpretation<T>> = [];
  for (const interpretation of rawConcept.interpretations?.interpretation ??
    []) {
    interpretations.push(parseInterpretation(interpretation, options));
  }

  const items: Array<Concept<T, "embedded">> = [];
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
): SpatialUnit<T, "embedded"> {
  const observations: Array<Observation<T>> = [];
  for (const observation of rawSpatialUnit.observations?.observation ?? []) {
    observations.push(parseObservation(observation, options));
  }

  const items: Array<SpatialUnit<T, "embedded">> = [];
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
): Period<T, "embedded"> {
  const items: Array<Period<T, "embedded">> = [];
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
): Person<T, "embedded"> {
  return {
    ...parseBaseItem("person", rawPerson, options),
    type: rawPerson.type ?? "",
    image: parseImage(rawPerson.image, options),
    address:
      rawPerson.address == null
        ? null
        : {
            country: parseStringLike(rawPerson.address.country),
            city: parseStringLike(rawPerson.address.city),
            state: parseStringLike(rawPerson.address.state),
            postalCode: parseStringLike(rawPerson.address.postalCode),
          },
    coordinates: parseCoordinates(rawPerson.coordinates, options),
    content:
      rawPerson.content == null
        ? null
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
): PropertyVariable<T, "embedded"> {
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
): PropertyValue<T, "embedded"> {
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
): Resource<T, "embedded"> {
  const items: Array<Resource<T, "embedded">> = [];
  for (const resource of rawResource.resource ?? []) {
    items.push(parseResource(resource, options));
  }

  return {
    ...parseBaseItem("resource", rawResource, options),
    type: rawResource.type ?? "",
    href: parseHref(rawResource.href),
    fileFormat: rawResource.fileFormat ?? null,
    fileSize: rawResource.fileSize ?? null,
    isInline: rawResource.rend === "inline",
    height: rawResource.height ?? null,
    width: rawResource.width ?? null,
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
): Text<T, "embedded"> {
  const editions: Array<Person<T, "embedded">> = [];
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
    const parsedLanguage = parseStringLike(language);
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
      { cause: unsupportedLanguages },
    );
  }

  return requestedLanguages;
}

export function resolveDefaultLanguage<T extends ReadonlyArray<string>>(
  rawOchre: { metadata: XMLMetadata },
  languages: T,
): T[number] {
  for (const language of rawOchre.metadata.language ?? []) {
    const parsedLanguage = parseStringLike(language);
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
    throw new Error("Default language not found", { cause: languages });
  }

  return firstLanguage;
}

function parseMetadataPublisher(
  rawPublisher: RawOchre["metadata"]["publisher"],
): string {
  const publisher = Array.isArray(rawPublisher)
    ? rawPublisher[0]
    : rawPublisher;
  return parseStringLike(publisher) ?? "";
}

export function parseMetadata<T extends ReadonlyArray<string>>(
  rawOchre: { uuidBelongsTo: string; metadata: XMLMetadata },
  options: ParserOptions<T>,
  defaultLanguage: T[number],
): Metadata<T> {
  const metadataOptions = options;
  const rawMetadata = rawOchre.metadata;

  return {
    dataset: parseStringLike(rawMetadata.dataset) ?? "",
    description: parseStringLike(rawMetadata.description) ?? "",
    publisher: parseMetadataPublisher(rawMetadata.publisher),
    identifier: transformPermanentIdentificationUrl(
      parseStringLike(rawMetadata.identifier) ?? "",
    ),
    project:
      rawMetadata.project == null
        ? null
        : {
            uuid: rawMetadata.project.uuid ?? rawOchre.uuidBelongsTo,
            identification: parseIdentification(
              rawMetadata.project.identification,
              metadataOptions,
            ),
            website: parseStringLike(
              rawMetadata.project.identification.website,
            ),
            dateFormat: rawMetadata.project.dateFormat ?? null,
            page: rawMetadata.project.page ?? null,
          },
    collection:
      rawMetadata.collection == null
        ? null
        : {
            uuid: rawMetadata.collection.uuid,
            identification: parseIdentification(
              rawMetadata.collection.identification,
              metadataOptions,
            ),
            page: rawMetadata.collection.page,
          },
    publication:
      rawMetadata.publication == null
        ? null
        : {
            uuid: rawMetadata.publication.uuid,
            identification: parseIdentification(
              rawMetadata.publication.identification,
              metadataOptions,
            ),
            page: rawMetadata.publication.page,
          },
    item:
      rawMetadata.item == null
        ? null
        : {
            identification: parseIdentification(
              rawMetadata.item.identification,
              metadataOptions,
            ),
            category:
              normalizeCategory(rawMetadata.item.category) ??
              rawMetadata.item.category,
            type: rawMetadata.item.type,
            maxLength: rawMetadata.item.maxLength ?? null,
          },
    defaultLanguage,
    languages: options.languages,
  };
}

function inferTopLevelCategory(rawOchre: RawOchre): ItemCategory {
  for (const category of SET_ITEM_CATEGORIES) {
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

  throw new Error("Could not infer OCHRE item category", { cause: rawOchre });
}

function getSingleTopLevelRawItem<T>(
  items: Array<T> | null,
  category: string,
): T {
  if (items == null || items.length === 0) {
    throw new Error(`${category} not found`, { cause: items });
  }

  if (items.length > 1) {
    throw new Error(`Expected one ${category}, received ${items.length}`, {
      cause: items,
    });
  }

  return items[0]!;
}

function parseTopLevelItem<
  U extends ItemCategory,
  V extends ContainedItemCategory<U>,
  T extends ReadonlyArray<string>,
>(
  rawOchre: RawOchre,
  category: U,
  options: ParserOptions<T> & { containedItemCategory?: V | ReadonlyArray<V> },
): Item<U, V, T, "embedded"> {
  switch (category) {
    case "tree": {
      return parseTree(
        getSingleTopLevelRawItem(
          "tree" in rawOchre ? rawOchre.tree : null,
          "tree",
        ),
        {
          ...options,
          containedItemCategory: normalizeTreeItemCategory(
            options.containedItemCategory,
          ),
        },
      ) as unknown as Item<U, V, T, "embedded">;
    }
    case "bibliography": {
      return parseBibliography(
        getSingleTopLevelRawItem(
          "bibliography" in rawOchre ? rawOchre.bibliography : null,
          "bibliography",
        ),
        options,
      ) as unknown as Item<U, V, T, "embedded">;
    }
    case "concept": {
      return parseConcept(
        getSingleTopLevelRawItem(
          "concept" in rawOchre ? rawOchre.concept : null,
          "concept",
        ),
        options,
      ) as unknown as Item<U, V, T, "embedded">;
    }
    case "spatialUnit": {
      return parseSpatialUnit(
        getSingleTopLevelRawItem(
          "spatialUnit" in rawOchre ? rawOchre.spatialUnit : null,
          "spatial unit",
        ),
        options,
      ) as unknown as Item<U, V, T, "embedded">;
    }
    case "period": {
      return parsePeriod(
        getSingleTopLevelRawItem(
          "period" in rawOchre ? rawOchre.period : null,
          "period",
        ),
        options,
      ) as unknown as Item<U, V, T, "embedded">;
    }
    case "person": {
      return parsePerson(
        getSingleTopLevelRawItem(
          "person" in rawOchre ? rawOchre.person : null,
          "person",
        ),
        options,
      ) as unknown as Item<U, V, T, "embedded">;
    }
    case "propertyVariable": {
      const propertyVariables =
        "propertyVariable" in rawOchre
          ? rawOchre.propertyVariable
          : "variable" in rawOchre
            ? rawOchre.variable
            : null;
      return parsePropertyVariable(
        getSingleTopLevelRawItem(propertyVariables, "property variable"),
        options,
      ) as unknown as Item<U, V, T, "embedded">;
    }
    case "propertyValue": {
      const propertyValues =
        "propertyValue" in rawOchre
          ? rawOchre.propertyValue
          : "value" in rawOchre
            ? rawOchre.value
            : null;
      return parsePropertyValue(
        getSingleTopLevelRawItem(propertyValues, "property value"),
        options,
      ) as unknown as Item<U, V, T, "embedded">;
    }
    case "resource": {
      return parseResource(
        getSingleTopLevelRawItem(
          "resource" in rawOchre ? rawOchre.resource : null,
          "resource",
        ),
        options,
      ) as unknown as Item<U, V, T, "embedded">;
    }
    case "text": {
      return parseText(
        getSingleTopLevelRawItem(
          "text" in rawOchre ? rawOchre.text : null,
          "text",
        ),
        options,
      ) as unknown as Item<U, V, T, "embedded">;
    }
    case "set": {
      return parseSet(
        getSingleTopLevelRawItem(
          "set" in rawOchre ? rawOchre.set : null,
          "set",
        ),
        options,
      ) as unknown as Item<U, V, T, "embedded">;
    }
  }
}

export function parseLinkedItems<
  const TContainedItemCategory extends
    | ContainedItemCategoryOption<ItemCategory>
    | undefined = undefined,
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  rawItems: XMLItemLinks | undefined,
  options: { containedItemCategory?: TContainedItemCategory; languages: T },
): Array<
  Item<
    ItemCategory,
    ContainedItemCategoryFromOption<ItemCategory, TContainedItemCategory>,
    T,
    "embedded"
  >
> {
  const parserOptions: ParserOptions<T> & {
    containedItemCategory?: ContainedItemCategoryOption<ItemCategory>;
  } = {
    languages: options.languages,
    containedItemCategory: options.containedItemCategory,
  };
  const items: Array<Item<ItemCategory, SetItemCategory, T, "embedded">> = [];

  for (const entry of collectHierarchyEntries(rawItems)) {
    const item = parseEmbeddedItemEntry(entry, parserOptions);
    if (item != null) {
      items.push(item);
    }
  }

  return items as Array<
    Item<
      ItemCategory,
      ContainedItemCategoryFromOption<ItemCategory, TContainedItemCategory>,
      T,
      "embedded"
    >
  >;
}

export function parseSetItems<
  const TContainedItemCategories extends
    | ReadonlyArray<SetItemCategory>
    | undefined = undefined,
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  rawItems: XMLSetItems | undefined,
  options: { containedItemCategories?: TContainedItemCategories; languages: T },
): Array<SetItem<SetItemCategoryFromCategories<TContainedItemCategories>, T>> {
  const parserOptions: ParserOptions<T> = { languages: options.languages };
  const categories = normalizeSetItemCategories(
    options.containedItemCategories,
  );

  return parseSetItemHierarchy(
    rawItems,
    parserOptions,
    categories ?? undefined,
  ) as Array<
    SetItem<SetItemCategoryFromCategories<TContainedItemCategories>, T>
  >;
}

export function parseGallery<T extends ReadonlyArray<string>>(
  rawData: XMLGalleryData,
  options: ParserOptions<T>,
): Gallery<T> {
  const gallery = rawData.result.ochre.gallery;
  const resources: Array<Resource<T, "embedded">> = [];
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
    maxLength: gallery.maxLength,
  };
}

export function parseItem<
  const TContainedItemCategory extends
    | ContainedItemCategoryOption<ItemCategory>
    | undefined = undefined,
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  rawData: XMLData,
  options: {
    category?: undefined;
    containedItemCategory?: TContainedItemCategory;
    languages: T;
  },
): Item<
  ItemCategory,
  ContainedItemCategoryFromOption<ItemCategory, TContainedItemCategory>,
  T
>;
export function parseItem<
  const TCategory extends ItemCategory,
  const TContainedItemCategory extends
    | ContainedItemCategoryOption<TCategory>
    | undefined = undefined,
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  rawData: XMLData,
  options: {
    category: TCategory;
    containedItemCategory?: TContainedItemCategory;
    languages: T;
  },
): Item<
  TCategory,
  ContainedItemCategoryFromOption<TCategory, TContainedItemCategory>,
  T
>;
export function parseItem(
  rawData: XMLData,
  options: {
    category?: ItemCategory;
    containedItemCategory?: ContainedItemCategoryOption<ItemCategory>;
    languages: ReadonlyArray<string>;
  },
): Item<ItemCategory, SetItemCategory, ReadonlyArray<string>>;
export function parseItem(
  rawData: XMLData,
  options: {
    category?: ItemCategory;
    containedItemCategory?: ContainedItemCategoryOption<ItemCategory>;
    languages: ReadonlyArray<string>;
  },
): Item<ItemCategory, SetItemCategory, ReadonlyArray<string>> {
  const rawOchre = rawData.result.ochre;
  const metadataLanguages = parseMetadataLanguages(rawOchre);
  const languagesToUse = resolveLanguages(options.languages, metadataLanguages);
  const parserOptions: ParserOptions<ReadonlyArray<string>> & {
    containedItemCategory?: ContainedItemCategoryOption<ItemCategory>;
  } = {
    languages: languagesToUse,
    containedItemCategory: options.containedItemCategory,
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
