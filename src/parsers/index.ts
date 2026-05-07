import { parseISO } from "date-fns";
import type {
  BaseItem,
  Bibliography,
  Concept,
  Context,
  ContextItem,
  ContextNode,
  Coordinates,
  CoordinatesSource,
  Data,
  DataCategory,
  Event,
  Heading,
  HeadingDataCategory,
  Identification,
  Image,
  ImageMap,
  ImageMapArea,
  Interpretation,
  Item,
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
  RecursiveDataCategory,
  Resource,
  Section,
  Set,
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
  XMLDataCategory,
  XMLDataItem,
  XMLEvent,
  XMLHeading,
  XMLIdentification,
  XMLImage,
  XMLImageMap,
  XMLImageMapArea,
  XMLInterpretation,
  XMLLink,
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
  XMLSpatialUnit,
  XMLString,
  XMLText,
  XMLTree,
} from "#/types/xml/types.js";
import { DEFAULT_LANGUAGES } from "#/constants.js";
import {
  extractAliases,
  parseXMLContent,
  parseXMLString,
} from "#/parsers/string.js";
import { MultilingualString } from "#/types/multilingual.js";

type ParserOptions<T extends ReadonlyArray<string>> = {
  languages: T;
  isRichText: boolean;
};

type XMLItemContainer = Partial<{
  tree: Array<XMLTree>;
  bibliography: Array<XMLBibliography>;
  concept: Array<XMLConcept>;
  spatialUnit: Array<XMLSpatialUnit>;
  period: Array<XMLPeriod>;
  person: Array<XMLPerson>;
  propertyVariable: Array<XMLPropertyVariable>;
  variable: Array<XMLPropertyVariable>;
  propertyValue: Array<XMLPropertyValueItem>;
  resource: Array<XMLResource | { resource: Array<XMLResource> }>;
  text: Array<XMLText>;
  set: Array<XMLSet>;
}>;

type RawOchre = XMLData["result"]["ochre"];

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

const ITEM_DATA_CATEGORIES = [
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

const HEADING_DATA_CATEGORIES = [
  "person",
  "propertyVariable",
  "propertyValue",
  "resource",
  "text",
  "set",
] as const satisfies ReadonlyArray<HeadingDataCategory>;

const RECURSIVE_CONTEXT_CATEGORIES = [
  "bibliography",
  "concept",
  "spatialUnit",
  "period",
  "resource",
  "text",
] as const satisfies ReadonlyArray<RecursiveDataCategory>;

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

function parseOptionalDate(value: string | undefined): Date | null {
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

function parseNumber(value: string | undefined): number | null {
  if (value == null || value === "") {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isNaN(parsedValue) ? null : parsedValue;
}

function parseNumberOrZero(value: string | undefined): number {
  return parseNumber(value) ?? 0;
}

function parseBoolean(value: string | undefined): boolean {
  return value === "true";
}

function parseStringLike(
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
  value: XMLContent | XMLString | undefined,
  options: ParserOptions<T>,
): MultilingualString<T> | null {
  if (value == null) {
    return null;
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

  const matchedContent: XMLContent["content"] = [];
  for (const content of value.content) {
    if (options.languages.includes(content.lang)) {
      matchedContent.push(content);
    }
  }

  if (matchedContent.length > 0) {
    return parseXMLContent<T>(
      { content: matchedContent },
      { languages: options.languages, isRichText: options.isRichText },
    );
  }

  const fallbackContent = value.content[0];
  if (fallbackContent == null) {
    return MultilingualString.empty(options.languages, {
      isRichText: options.isRichText,
    });
  }

  const fallbackLanguages = [fallbackContent.lang] as const;
  const fallbackText = parseXMLContent(
    { content: [fallbackContent] },
    { languages: fallbackLanguages, isRichText: options.isRichText },
  ).getText(fallbackContent.lang);

  return multilingualFromText(fallbackText, options);
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

function parseIdentification<T extends ReadonlyArray<string>>(
  rawIdentification: XMLIdentification,
  options: ParserOptions<T>,
): Identification<T> {
  const label = parseRequiredContentLike(rawIdentification.label, options);
  const abbreviation = parseContentLike(
    rawIdentification.abbreviation,
    options,
  );
  const labelAliases =
    isXMLContent(rawIdentification.label) ?
      extractAliases(rawIdentification.label, {
        isRichText: options.isRichText,
      })
    : null;
  const abbreviationAliases =
    (
      rawIdentification.abbreviation != null &&
      isXMLContent(rawIdentification.abbreviation)
    ) ?
      extractAliases(rawIdentification.abbreviation, {
        isRichText: options.isRichText,
      })
    : null;

  return {
    label,
    abbreviation,
    alias: {
      label: labelAliases?.[0] ?? null,
      abbreviation: abbreviationAliases?.[0] ?? null,
    },
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
    alias: { label: null, abbreviation: null },
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

function parseContext(rawContext: XMLContext): Context<RecursiveDataCategory> {
  const nodes: Array<ContextNode<RecursiveDataCategory>> = [];

  for (const rawContextOuterItem of rawContext) {
    for (const rawContextItem of rawContextOuterItem.context) {
      const node: ContextNode<RecursiveDataCategory> = {
        tree:
          rawContextItem.tree[0] == null ?
            emptyContextItem()
          : parseContextItem(rawContextItem.tree[0]),
        project: parseContextItem(rawContextItem.project),
        bibliography: [],
        concept: [],
        spatialUnit: [],
        period: [],
        resource: [],
        text: [],
      };

      for (const category of RECURSIVE_CONTEXT_CATEGORIES) {
        const contextValues = rawContextItem[category] ?? [];
        for (const contextValue of contextValues) {
          node[category].push(parseContextItem(contextValue));
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
): BaseItem<U, T> {
  const events: Array<Event<T>> = [];
  for (const event of rawItem.events?.event ?? []) {
    events.push(parseEvent(event, options));
  }

  const creators: Array<Person<T>> = [];
  for (const creator of rawItem.creators?.creator ?? []) {
    creators.push(parsePerson(creator, options));
  }

  return {
    uuid: rawItem.uuid ?? "",
    category,
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
      : multilingualFromText(
          parseXMLString(rawItem.copyright, {
            isRichText: options.isRichText,
            parseEmail: false,
          }),
          options,
        ),
    watermark:
      rawItem.watermark == null ?
        null
      : multilingualFromText(
          parseXMLString(rawItem.watermark, {
            isRichText: options.isRichText,
            parseEmail: false,
          }),
          options,
        ),
    identification: parseOptionalIdentification(
      rawItem.identification,
      options,
    ),
    creators,
    description: parseContentLike(rawItem.description, options),
    events,
  };
}

function normalizeCategory(
  category: XMLDataCategory | DataCategory | undefined,
): DataCategory | null {
  if (category == null) {
    return null;
  }

  return category === "variable" ? "propertyVariable" : category;
}

function isHeadingDataCategory(
  category: ItemsDataCategory,
): category is HeadingDataCategory {
  return HEADING_DATA_CATEGORIES.includes(category as HeadingDataCategory);
}

function pushCategoryIfPresent(
  categories: Array<ItemsDataCategory>,
  category: ItemsDataCategory,
  items: Array<unknown> | undefined,
): void {
  if ((items?.length ?? 0) === 0) {
    return;
  }

  if (!categories.includes(category)) {
    categories.push(category);
  }
}

function inferItemCategories(
  container: XMLItemContainer | undefined,
): Array<ItemsDataCategory> {
  const categories: Array<ItemsDataCategory> = [];
  if (container == null) {
    return categories;
  }

  for (const category of ITEM_DATA_CATEGORIES) {
    if (category === "propertyVariable") {
      pushCategoryIfPresent(categories, category, container.propertyVariable);
      pushCategoryIfPresent(categories, category, container.variable);
      continue;
    }

    pushCategoryIfPresent(categories, category, container[category]);
  }

  return categories;
}

function normalizeItemCategoryArray<U extends ItemsDataCategory>(
  itemCategory: U | Array<U> | undefined,
): Array<U> | null {
  if (itemCategory == null) {
    return null;
  }

  return Array.isArray(itemCategory) ? itemCategory : [itemCategory];
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
    href: rawImage.href ?? null,
    htmlImgSrcPrefix: rawImage.htmlImgSrcPrefix ?? null,
    height: parseNumber(rawImage.height),
    width: parseNumber(rawImage.width),
    fileSize: parseNumber(rawImage.fileSize),
    base64: rawImage.payload ?? null,
  };
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
  const authors: Array<Person<T>> = [];
  for (const author of rawNote.authors?.author ?? []) {
    authors.push(parsePerson(author, options));
  }

  let title = rawNote.title ?? null;
  if (title == null) {
    for (const content of rawNote.content) {
      if (options.languages.includes(content.lang) && content.title != null) {
        title = content.title;
        break;
      }
    }
  }

  return {
    number: parseNumberOrZero(rawNote.noteNo),
    title,
    content: parseRequiredContentLike(rawNote, options),
    authors,
  };
}

function parseNotes<T extends ReadonlyArray<string>>(
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
    label: value.rawValue == null ? null : rawLabel,
    isUncertain: value.isUncertain === "true",
    category: value.category ?? null,
    type: value.type ?? null,
    uuid: value.uuid == null || value.uuid === "" ? null : value.uuid,
    publicationDateTime: parseOptionalDate(value.publicationDateTime),
    unit: value.unit ?? null,
    href: value.href ?? null,
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

function parseProperties<T extends ReadonlyArray<string>>(
  rawProperties: { property: Array<XMLProperty> } | undefined,
  options: ParserOptions<T>,
): Array<Property<T>> {
  const properties: Array<Property<T>> = [];
  for (const property of rawProperties?.property ?? []) {
    properties.push(parseProperty(property, options));
  }

  return properties;
}

function parseItemContainer<T extends ReadonlyArray<string>>(
  container: XMLItemContainer | undefined,
  options: ParserOptions<T>,
  categories?: ReadonlyArray<DataCategory>,
): Array<Item<DataCategory, ItemsDataCategory, T>> {
  const items: Array<Item<DataCategory, ItemsDataCategory, T>> = [];
  if (container == null) {
    return items;
  }

  const shouldParse = (category: DataCategory): boolean =>
    categories == null || categories.includes(category);

  if (shouldParse("tree")) {
    for (const tree of container.tree ?? []) {
      items.push(
        parseTree(tree, options) as Item<DataCategory, ItemsDataCategory, T>,
      );
    }
  }

  if (shouldParse("bibliography")) {
    for (const bibliography of container.bibliography ?? []) {
      items.push(
        parseBibliography(bibliography, options) as Item<
          DataCategory,
          ItemsDataCategory,
          T
        >,
      );
    }
  }

  if (shouldParse("concept")) {
    for (const concept of container.concept ?? []) {
      items.push(
        parseConcept(concept, options) as Item<
          DataCategory,
          ItemsDataCategory,
          T
        >,
      );
    }
  }

  if (shouldParse("spatialUnit")) {
    for (const spatialUnit of container.spatialUnit ?? []) {
      items.push(
        parseSpatialUnit(spatialUnit, options) as Item<
          DataCategory,
          ItemsDataCategory,
          T
        >,
      );
    }
  }

  if (shouldParse("period")) {
    for (const period of container.period ?? []) {
      items.push(
        parsePeriod(period, options) as Item<
          DataCategory,
          ItemsDataCategory,
          T
        >,
      );
    }
  }

  if (shouldParse("person")) {
    for (const person of container.person ?? []) {
      items.push(
        parsePerson(person, options) as Item<
          DataCategory,
          ItemsDataCategory,
          T
        >,
      );
    }
  }

  if (shouldParse("propertyVariable")) {
    for (const propertyVariable of container.propertyVariable ?? []) {
      items.push(
        parsePropertyVariable(propertyVariable, options) as Item<
          DataCategory,
          ItemsDataCategory,
          T
        >,
      );
    }

    for (const propertyVariable of container.variable ?? []) {
      items.push(
        parsePropertyVariable(propertyVariable, options) as Item<
          DataCategory,
          ItemsDataCategory,
          T
        >,
      );
    }
  }

  if (shouldParse("propertyValue")) {
    for (const propertyValue of container.propertyValue ?? []) {
      items.push(
        parsePropertyValue(propertyValue, options) as Item<
          DataCategory,
          ItemsDataCategory,
          T
        >,
      );
    }
  }

  if (shouldParse("resource")) {
    for (const resource of container.resource ?? []) {
      if (!("uuid" in resource)) {
        for (const nestedResource of resource.resource) {
          items.push(
            parseResource(nestedResource, options) as Item<
              DataCategory,
              ItemsDataCategory,
              T
            >,
          );
        }
        continue;
      }

      items.push(
        parseResource(resource, options) as Item<
          DataCategory,
          ItemsDataCategory,
          T
        >,
      );
    }
  }

  if (shouldParse("text")) {
    for (const text of container.text ?? []) {
      items.push(
        parseText(text, options) as Item<DataCategory, ItemsDataCategory, T>,
      );
    }
  }

  if (shouldParse("set")) {
    for (const set of container.set ?? []) {
      items.push(
        parseSet(set, options) as Item<DataCategory, ItemsDataCategory, T>,
      );
    }
  }

  return items;
}

function parseLinks<T extends ReadonlyArray<string>>(
  rawLinks: XMLLink | XMLDataItem | undefined,
  options: ParserOptions<T>,
): Array<Item> {
  return parseItemContainer(
    rawLinks as XMLItemContainer | undefined,
    options,
  ) as Array<Item>;
}

function parseReverseLinks<T extends ReadonlyArray<string>>(
  rawLinks: XMLLink | XMLDataItem | Array<XMLLink | XMLDataItem> | undefined,
  options: ParserOptions<T>,
): Array<Item> {
  const links: Array<Item> = [];
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
): Array<Period<T>> {
  const periods: Array<Period<T>> = [];
  for (const period of rawPeriods?.period ?? []) {
    periods.push(parsePeriod(period, options));
  }

  return periods;
}

function parseBibliographyList<T extends ReadonlyArray<string>>(
  rawBibliographies: { bibliography: Array<XMLBibliography> } | undefined,
  options: ParserOptions<T>,
): Array<Bibliography<T>> {
  const bibliographies: Array<Bibliography<T>> = [];
  for (const bibliography of rawBibliographies?.bibliography ?? []) {
    bibliographies.push(parseBibliography(bibliography, options));
  }

  return bibliographies;
}

function parsePersonList<T extends ReadonlyArray<string>>(
  rawPersons: Array<XMLPerson> | undefined,
  options: ParserOptions<T>,
): Array<Person<T>> {
  const persons: Array<Person<T>> = [];
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
    items: parseItemContainer(rawHeading as XMLItemContainer, options, [
      itemCategory,
    ]) as Array<Item<U, never, T>>,
  };
}

function parseTree<
  U extends ItemsDataCategory = ItemsDataCategory,
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  rawTree: XMLTree,
  options: ParserOptions<T> & { itemCategory?: U | Array<U> },
): Tree<U, T> {
  const optionCategories = normalizeItemCategoryArray(options.itemCategory);
  const inferredCategories = inferItemCategories(rawTree.items);
  const itemCategory = optionCategories?.[0] ?? inferredCategories[0] ?? null;

  const items: Array<Heading<U & HeadingDataCategory, T> | Item<U, never, T>> =
    [];
  if (itemCategory != null && isHeadingDataCategory(itemCategory)) {
    for (const heading of rawTree.items?.heading ?? []) {
      items.push(
        parseHeading(heading, itemCategory, options) as Heading<
          U & HeadingDataCategory,
          T
        >,
      );
    }
  }

  if (itemCategory != null) {
    items.push(
      ...(parseItemContainer(rawTree.items, options, [itemCategory]) as Array<
        Item<U, never, T>
      >),
    );
  }

  return {
    ...parseBaseItem("tree", rawTree, options),
    type: rawTree.type ?? null,
    itemsCategory: itemCategory as U | null,
    links: parseLinks(rawTree.links, options),
    notes: parseNotes(rawTree.notes, options),
    properties: parseProperties(rawTree.properties, options),
    bibliographies: parseBibliographyList(rawTree.bibliographies, options),
    items: items as Tree<U, T>["items"],
  };
}

function parseSet<
  U extends ItemsDataCategory = ItemsDataCategory,
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  rawSet: XMLSet,
  options: ParserOptions<T> & { itemCategory?: U | Array<U> },
): Set<U, T> {
  const optionCategories = normalizeItemCategoryArray(options.itemCategory);
  const itemCategories = optionCategories ?? inferItemCategories(rawSet.items);

  return {
    ...parseBaseItem("set", rawSet, options),
    itemsCategory: itemCategories as Array<U>,
    isTabularStructure: parseBoolean(rawSet.tabularStructure),
    isSuppressingBlanks: parseBoolean(rawSet.suppressBlanks),
    links: parseLinks(rawSet.links, options),
    notes: parseNotes(rawSet.notes, options),
    properties: parseProperties(rawSet.properties, options),
    items: parseItemContainer(rawSet.items, options, itemCategories) as Array<
      Item<U, never, T>
    >,
  };
}

function parseBibliography<T extends ReadonlyArray<string>>(
  rawBibliography: XMLBibliography,
  options: ParserOptions<T>,
): Bibliography<T> {
  const sourceItems =
    rawBibliography.source == null ?
      []
    : parseItemContainer(rawBibliography.source as XMLItemContainer, options);
  const bibliographies = parseBibliographyList(
    rawBibliography.bibliographies,
    options,
  );
  const items: Array<Bibliography<T>> = [];
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
          startDate:
            rawBibliography.publicationInfo.startDate == null ?
              null
            : new Date(
                parseNumberOrZero(
                  rawBibliography.publicationInfo.startDate.year,
                ),
                Math.max(
                  parseNumberOrZero(
                    rawBibliography.publicationInfo.startDate.month,
                  ) - 1,
                  0,
                ),
                parseNumberOrZero(
                  rawBibliography.publicationInfo.startDate.day,
                ),
              ),
        },
    entryInfo:
      (
        rawBibliography.entryInfo == null ||
        (rawBibliography.entryInfo.startIssue == null &&
          rawBibliography.entryInfo.startVolume == null)
      ) ?
        null
      : {
          startIssue: rawBibliography.entryInfo.startIssue ?? "",
          startVolume: rawBibliography.entryInfo.startVolume ?? "",
        },
    source:
      sourceItems[0] == null ?
        null
      : (sourceItems[0] as Item<ItemsDataCategory, never, T>),
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
): Concept<T> {
  const interpretations: Array<Interpretation<T>> = [];
  for (const interpretation of rawConcept.interpretations?.interpretation ??
    []) {
    interpretations.push(parseInterpretation(interpretation, options));
  }

  const items: Array<Concept<T>> = [];
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
): SpatialUnit<T> {
  const observations: Array<Observation<T>> = [];
  for (const observation of rawSpatialUnit.observations?.observation ?? []) {
    observations.push(parseObservation(observation, options));
  }

  const items: Array<SpatialUnit<T>> = [];
  for (const spatialUnit of rawSpatialUnit.spatialUnit ?? []) {
    items.push(parseSpatialUnit(spatialUnit, options));
  }

  return {
    ...parseBaseItem("spatialUnit", rawSpatialUnit, options),
    image: parseImage(rawSpatialUnit.image, options),
    coordinates: parseCoordinates(rawSpatialUnit.coordinates, options),
    mapData:
      rawSpatialUnit.mapData == null ?
        null
      : {
          geoJSON: {
            multiPolygon: rawSpatialUnit.mapData.geoJSON.multiPolygon.payload,
            EPSG: parseNumberOrZero(rawSpatialUnit.mapData.geoJSON.EPSG),
          },
        },
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
): Period<T> {
  const items: Array<Period<T>> = [];
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
): Person<T> {
  return {
    ...parseBaseItem("person", rawPerson, options),
    type: rawPerson.type ?? "",
    image: parseImage(rawPerson.image, options),
    address:
      rawPerson.address == null ?
        null
      : {
          country: rawPerson.address.country ?? null,
          city: rawPerson.address.city ?? null,
          state: rawPerson.address.state ?? null,
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
): PropertyVariable<T> {
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
): PropertyValue<T> {
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
): Resource<T> {
  const items: Array<Resource<T>> = [];
  for (const resource of rawResource.resource ?? []) {
    items.push(parseResource(resource, options));
  }

  return {
    ...parseBaseItem("resource", rawResource, options),
    type: rawResource.type ?? "",
    href: rawResource.href ?? null,
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
): Text<T> {
  const editions: Array<Person<T>> = [];
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

function parseMetadataLanguages(rawOchre: RawOchre): Array<string> {
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

function resolveLanguages<T extends ReadonlyArray<string>>(
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

function resolveDefaultLanguage<T extends ReadonlyArray<string>>(
  rawOchre: RawOchre,
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

function parseMetadata<T extends ReadonlyArray<string>>(
  rawOchre: RawOchre,
  options: ParserOptions<T>,
  defaultLanguage: T[number],
): Metadata<T> {
  const metadataOptions = { ...options, isRichText: false };
  const rawMetadata = rawOchre.metadata;

  return {
    dataset: parseStringLike(rawMetadata.dataset, { isRichText: false }) ?? "",
    description:
      parseStringLike(rawMetadata.description, { isRichText: false }) ?? "",
    publisher:
      parseStringLike(rawMetadata.publisher, { isRichText: false }) ?? "",
    identifier:
      parseStringLike(rawMetadata.identifier, { isRichText: false }) ?? "",
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
  for (const category of ["tree", ...ITEM_DATA_CATEGORIES] as const) {
    if (category in rawOchre) {
      return category;
    }
  }

  if ("variable" in rawOchre) {
    return "propertyVariable";
  }

  throw new Error("Could not infer OCHRE item category");
}

function parseTopLevelItems<
  U extends DataCategory,
  V extends U extends "tree" | "set" ? ItemsDataCategory : never,
  T extends ReadonlyArray<string>,
>(
  rawOchre: RawOchre,
  category: U,
  options: ParserOptions<T> & { itemCategory?: V | Array<V> },
): Array<Item<U, V, T>> {
  const items: Array<Item<U, V, T>> = [];

  switch (category) {
    case "tree": {
      if (!("tree" in rawOchre)) {
        throw new Error("Tree not found");
      }
      for (const tree of rawOchre.tree) {
        items.push(parseTree(tree, options) as unknown as Item<U, V, T>);
      }
      break;
    }
    case "bibliography": {
      if (!("bibliography" in rawOchre)) {
        throw new Error("Bibliography not found");
      }
      for (const bibliography of rawOchre.bibliography) {
        items.push(
          parseBibliography(bibliography, options) as unknown as Item<U, V, T>,
        );
      }
      break;
    }
    case "concept": {
      if (!("concept" in rawOchre)) {
        throw new Error("Concept not found");
      }
      for (const concept of rawOchre.concept) {
        items.push(parseConcept(concept, options) as unknown as Item<U, V, T>);
      }
      break;
    }
    case "spatialUnit": {
      if (!("spatialUnit" in rawOchre)) {
        throw new Error("Spatial unit not found");
      }
      for (const spatialUnit of rawOchre.spatialUnit) {
        items.push(
          parseSpatialUnit(spatialUnit, options) as unknown as Item<U, V, T>,
        );
      }
      break;
    }
    case "period": {
      if (!("period" in rawOchre)) {
        throw new Error("Period not found");
      }
      for (const period of rawOchre.period) {
        items.push(parsePeriod(period, options) as unknown as Item<U, V, T>);
      }
      break;
    }
    case "person": {
      if (!("person" in rawOchre)) {
        throw new Error("Person not found");
      }
      for (const person of rawOchre.person) {
        items.push(parsePerson(person, options) as unknown as Item<U, V, T>);
      }
      break;
    }
    case "propertyVariable": {
      const propertyVariables =
        "propertyVariable" in rawOchre ? rawOchre.propertyVariable
        : "variable" in rawOchre ? rawOchre.variable
        : null;
      if (propertyVariables == null) {
        throw new Error("Property variable not found");
      }
      for (const propertyVariable of propertyVariables) {
        items.push(
          parsePropertyVariable(propertyVariable, options) as unknown as Item<
            U,
            V,
            T
          >,
        );
      }
      break;
    }
    case "propertyValue": {
      if (!("propertyValue" in rawOchre)) {
        throw new Error("Property value not found");
      }
      for (const propertyValue of rawOchre.propertyValue) {
        items.push(
          parsePropertyValue(propertyValue, options) as unknown as Item<
            U,
            V,
            T
          >,
        );
      }
      break;
    }
    case "resource": {
      if (!("resource" in rawOchre)) {
        throw new Error("Resource not found");
      }
      for (const resource of rawOchre.resource) {
        items.push(
          parseResource(resource, options) as unknown as Item<U, V, T>,
        );
      }
      break;
    }
    case "text": {
      if (!("text" in rawOchre)) {
        throw new Error("Text not found");
      }
      for (const text of rawOchre.text) {
        items.push(parseText(text, options) as unknown as Item<U, V, T>);
      }
      break;
    }
    case "set": {
      if (!("set" in rawOchre)) {
        throw new Error("Set not found");
      }
      for (const set of rawOchre.set) {
        items.push(parseSet(set, options) as unknown as Item<U, V, T>);
      }
      break;
    }
  }

  return items;
}

export function parseData<
  U extends DataCategory,
  V extends U extends "tree" | "set" ? ItemsDataCategory : never = never,
  T extends ReadonlyArray<string> = ReadonlyArray<string>,
>(
  rawData: XMLData,
  options: {
    category?: U;
    itemCategory?: V | Array<V>;
    languages: T;
    isRichText?: boolean;
  },
): Data<U, V, T> {
  const rawOchre = rawData.result.ochre;
  const metadataLanguages = parseMetadataLanguages(rawOchre);
  const languagesToUse = resolveLanguages(options.languages, metadataLanguages);
  const parserOptions: ParserOptions<T> & { itemCategory?: V | Array<V> } = {
    languages: languagesToUse,
    isRichText: options.isRichText ?? false,
    itemCategory: options.itemCategory,
  };
  const category =
    options.category ??
    (normalizeCategory(rawOchre.metadata.item?.category) as U | null) ??
    (inferTopLevelCategory(rawOchre) as U);
  const defaultLanguage = resolveDefaultLanguage(rawOchre, languagesToUse);

  return {
    uuid: rawOchre.uuid,
    belongsTo: {
      uuid: rawOchre.uuidBelongsTo,
      abbreviation: rawOchre.belongsTo,
    },
    publicationDateTime:
      parseOptionalDate(rawOchre.publicationDateTime) ?? new Date(0),
    metadata: parseMetadata(rawOchre, parserOptions, defaultLanguage),
    items: parseTopLevelItems(rawOchre, category, parserOptions),
  };
}
