import { XMLParser } from "fast-xml-parser";
import * as v from "valibot";
import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  BaseItem,
  Item,
  ItemCategory,
  ItemWithoutEmbeddedItems,
  Note,
  Property,
  SetItem,
  SetItemCategory,
  SetItemProperty,
} from "#/types/index.js";
import type {
  XMLBaseItem,
  XMLBibliography,
  XMLConcept,
  XMLContent,
  XMLContext,
  XMLContextGroup,
  XMLData,
  XMLDataItem,
  XMLIdentification,
  XMLLink,
  XMLMetadata,
  XMLNote,
  XMLPeriod,
  XMLPerson,
  XMLProperty,
  XMLPropertyValue,
  XMLPropertyVariable,
  XMLResource,
  XMLSet,
  XMLSpatialUnit,
  XMLString,
  XMLText,
  XMLTree,
} from "#/xml/types.js";
import { XML_PARSER_OPTIONS } from "#/constants.js";
import { defineLanguages, fetchItem } from "#/fetchers/item.js";
import { MultilingualString } from "#/index.js";
import { parseItem } from "#/parsers/index.js";
import {
  extractAliases,
  parseXMLContent,
  parseXMLString,
  transformPermanentIdentificationUrl,
} from "#/parsers/string.js";
import { XMLData as XMLDataSchema } from "#/xml/schemas.js";

const LIVE_TEST_TIMEOUT_MS = 180_000;
const TEST_LANGUAGES = ["eng"] as const;

const TREE_UUIDS: ReadonlyArray<string> = [
  "55a24a30-15d6-4c2b-aba4-d14d6b3ae883",
  "9b972a47-dcaa-40dd-8931-e687fdbb42e9",
  "47d170bf-9f1e-44d9-9f9d-50e387ebc420",
  "c4898452-b601-4f6f-a887-15791cd54428",
  "af34bfce-1d9f-4e7d-9c6b-5d77e176c352",
];
const BIBLIOGRAPHY_UUIDS: ReadonlyArray<string> = [
  "3ef836c8-d73b-4b84-b739-8a5ad8b99394",
  "6ca9abf6-fdc1-4da4-a280-32268eb52eb2",
  "0ba44014-f8d5-41d6-96fe-3020d1978d92",
  "148a3acb-ca28-47ae-92c4-d21e8fd127aa",
  "954d5fce-e9c3-4c89-a727-d877edd76bdc",
];
const CONCEPT_UUIDS: ReadonlyArray<string> = [
  "f4feb402-dafa-4d43-b2b8-112f620249a7",
  "20a96d26-e056-47ac-96ad-ab4c90c3b301",
  "a9b62ab9-5cc2-4df8-b1cf-6547428ac127",
  "f865bc96-c6b9-41a7-aa27-f27e5468134d",
  "937f08cd-0f11-461d-85e1-2ae1c3a7cc9f",
];
const SPATIAL_UNIT_UUIDS: ReadonlyArray<string> = [
  "8ff5da6a-17fe-4eed-8913-2043202a2704",
  "3289df93-d1e4-4bf6-998f-efa409461470",
  "1d0e34cd-13b4-43bb-9616-5f0c7d006933",
  "64bf1757-08f4-4861-b226-faea869dcfbd",
  "7b0e3bc1-5043-4d0f-a9bb-6b8d6de11fa4",
];
const PERIOD_UUIDS: ReadonlyArray<string> = [
  "eddce67b-134a-4194-aae0-c054cbe262c5",
  "6ec0458e-31e5-461e-aaae-2ad8c9ca147e",
  "638832b0-e020-42c3-b479-5d3e4f234d68",
  "fb7fc934-c8ad-4e3c-8456-9fd8ac342ecd",
  "9219ae6b-36f3-45ea-b1a2-00fdc77368f9",
];
const PERSON_UUIDS: ReadonlyArray<string> = [
  "7d1859aa-2423-0965-f895-73be13fb71f5",
  "f59b2dbc-447d-4b65-a97d-195e3ad62c78",
  "4eabcf53-d051-4d8a-a221-fac53aced8d9",
  "e9250788-df90-4b20-ad42-c6c7eb574abc",
  "5947a502-8f51-4df8-924d-2ac35b6391cc",
];
const PROPERTY_VARIABLE_UUIDS: ReadonlyArray<string> = [
  "8383140a-e676-417f-b5d8-863d9df6d905",
  "54849917-e4d9-4058-abd3-3618597c5f04",
  "a5075cc3-a399-4a34-af2a-e0399d522958",
  "84f73401-b675-4061-8a7d-baae8025ae1e",
  "ea030d95-0539-4ece-8004-3a94f3921340",
];
const PROPERTY_VALUE_UUIDS: ReadonlyArray<string> = [
  "e01d7a0b-b354-492f-a7a5-26f41e2fcaa0",
  "2bbaacf5-a321-42f0-8e1d-ffa4324cd990",
  "d62e86c5-6083-4821-9625-4e3c80984a7f",
  "3e7de8e2-cefe-4f77-bbdc-71aa58fe506a",
  "adfd2930-268d-420a-b36d-bd8fc6dfa8f4",
];
const RESOURCE_UUIDS: ReadonlyArray<string> = [
  "c9031a0e-1510-4fdc-90ba-2d8c62dc4e99",
  "92b81272-e38a-417b-b0f1-f7914fdc9e21",
  "d78f0331-f385-412d-8950-0cf787ea995c",
  "bc79ecae-d95a-40a1-8f25-e19335c65a23",
  "65259615-a8d7-45e3-97c8-6a9ca0b133a0",
];
const TEXT_UUIDS: ReadonlyArray<string> = [
  "1a1fb727-4917-4c93-accf-f4a6d04fa79e",
  "1daf54b7-ab8c-4e95-b750-e00dc24393e8",
  "294e6e8e-e336-4d99-863c-62b13e983440",
  "2aaa4464-eba9-43eb-a974-1fe77a6af70e",
  "2fb6b468-a82a-4011-8c3c-121bff463ebf",
];
const SET_UUIDS: ReadonlyArray<string> = [
  "e59a10d4-c873-4aad-8a2f-f4e62240c5a3",
  "b4fc0684-b5f4-4503-8e35-2ade58d1492e",
  "56470da1-e5bc-4358-9adf-19f4c0a5fb84",
  "34937ce0-b5bd-4114-9965-302996fa5d8e",
  "7ccec23f-d351-4f01-b1bf-ac23695fc691",
];

type CategoryFixture = { category: ItemCategory; uuids: ReadonlyArray<string> };

type XMLTopLevelItem =
  | XMLTree
  | XMLBibliography
  | XMLConcept
  | XMLSpatialUnit
  | XMLPeriod
  | XMLPerson
  | XMLPropertyVariable
  | XMLPropertyValue
  | XMLResource
  | XMLText
  | XMLSet;

type TopLevelItemForTest = Item<
  ItemCategory,
  SetItemCategory,
  typeof TEST_LANGUAGES
>;

type ParsedSetItem = SetItem<SetItemCategory, typeof TEST_LANGUAGES>;

type ParsedPropertyFields =
  | Property<typeof TEST_LANGUAGES>
  | SetItemProperty<typeof TEST_LANGUAGES>;

type XMLSetItem =
  | XMLTree
  | XMLBibliography
  | XMLConcept
  | XMLSpatialUnit
  | XMLPeriod
  | XMLPerson
  | XMLPropertyVariable
  | XMLPropertyValue
  | XMLResource
  | XMLText
  | XMLSet;

type RawSetItemEntry = { category: SetItemCategory; item: XMLSetItem };

type XMLItemHierarchy = Partial<{
  tree: Array<XMLTree>;
  bibliography: Array<XMLBibliography>;
  concept: Array<XMLConcept>;
  spatialUnit: Array<XMLSpatialUnit>;
  period: Array<XMLPeriod>;
  person: Array<XMLPerson>;
  propertyVariable: Array<XMLPropertyVariable>;
  variable: Array<XMLPropertyVariable>;
  propertyValue: Array<XMLPropertyValue>;
  resource: Array<XMLResource | { resource: Array<XMLResource> }>;
  text: Array<XMLText>;
  set: Array<XMLSet>;
}>;

type XMLLinkLike =
  | XMLLink
  | XMLDataItem
  | Array<XMLLink | XMLDataItem>
  | undefined;

const CATEGORY_FIXTURES = [
  { category: "tree", uuids: TREE_UUIDS },
  { category: "bibliography", uuids: BIBLIOGRAPHY_UUIDS },
  { category: "concept", uuids: CONCEPT_UUIDS },
  { category: "spatialUnit", uuids: SPATIAL_UNIT_UUIDS },
  { category: "period", uuids: PERIOD_UUIDS },
  { category: "person", uuids: PERSON_UUIDS },
  { category: "propertyVariable", uuids: PROPERTY_VARIABLE_UUIDS },
  { category: "propertyValue", uuids: PROPERTY_VALUE_UUIDS },
  { category: "resource", uuids: RESOURCE_UUIDS },
  { category: "set", uuids: SET_UUIDS },
] as const satisfies ReadonlyArray<CategoryFixture>;

const TEST_PROJECT_UUID = "0c0aae37-7246-495b-9547-e25dbf5b99a3";
const parser = new XMLParser(XML_PARSER_OPTIONS);

function normalizeCategory(category: string | undefined): string | null {
  if (category == null) {
    return null;
  }

  return category === "variable" ? "propertyVariable" : category;
}

function isXMLContent(value: XMLContent | XMLString): value is XMLContent {
  return "content" in value;
}

function createXMLContent(label: string): string {
  return `<content xml:lang="eng"><string>${label}</string></content>`;
}

function createXMLIdentification(label: string): string {
  return `<identification><label>${createXMLContent(label)}</label></identification>`;
}

function getTestItemType(category: "tree" | "resource" | "set"): string {
  switch (category) {
    case "tree": {
      return "Tree";
    }
    case "resource": {
      return "Resource";
    }
    case "set": {
      return "Set";
    }
  }
}

function createFetchItemXML(parameters: {
  uuid: string;
  category: "tree" | "resource" | "set";
  itemContent?: string;
}): string {
  const { uuid, category, itemContent = "" } = parameters;
  const type = getTestItemType(category);

  return `<result><ochre uuid="${uuid}" uuidBelongsTo="${TEST_PROJECT_UUID}" belongsTo="Test" languages="eng" publicationDateTime="2026-05-10T10:08:35Z" persistentUrl="https://pi.lib.uchicago.edu/1001/org/ochre/${uuid}"><metadata><dataset>Dataset</dataset><description>Description</description><publisher>Publisher</publisher><identifier>https://pi.lib.uchicago.edu/1001/org/ochre/${uuid}</identifier><language default="true">eng</language><project uuid="${TEST_PROJECT_UUID}" dateFormat="yyyy-MM-dd" page="item">${createXMLIdentification("Project")}</project><item uuid="${uuid}" category="${category}" type="${type}">${createXMLIdentification(type)}</item></metadata><${category} uuid="${uuid}" publicationDateTime="2026-05-10T10:08:35Z">${createXMLIdentification(type)}${itemContent}</${category}></ochre></result>`;
}

function parseStringLikeForTest(
  value: XMLString | string | undefined,
): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return parseXMLString(value).text;
}

function transformPermanentIdentificationUrlForTest(
  value: string | null | undefined,
): string | null {
  return value == null ? null : transformPermanentIdentificationUrl(value);
}

function parseContentLikeForTest(
  value: XMLContent | XMLString | string | undefined,
): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (isXMLContent(value)) {
    return parseXMLContent(value, { languages: TEST_LANGUAGES }).getText("eng");
  }

  return parseStringLikeForTest(value);
}

function formatSchemaIssues(issues: Array<v.BaseIssue<unknown>>): string {
  const messages: Array<string> = [];
  for (const issue of issues) {
    const path: Array<string> = Array.from(issue.path ?? [], (pathItem) =>
      String(pathItem.key),
    );
    messages.push(`${path.join(".")}: ${issue.message}`);
  }

  return messages.join("\n");
}

async function fetchXMLData(uuid: string): Promise<XMLData> {
  const response = await fetch(
    `https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?uuid=${uuid}&xsl=none&lang="*"`,
  );
  expect(response.ok).toBe(true);

  const xml = await response.text();
  const parsed = parser.parse(xml) as unknown;
  const result = v.safeParse(XMLDataSchema, parsed, { abortEarly: false });
  if (!result.success) {
    throw new Error(formatSchemaIssues(result.issues));
  }

  return result.output;
}

function parseRawData(
  rawData: XMLData,
  category: ItemCategory,
): TopLevelItemForTest {
  return parseItem(rawData, { category, languages: TEST_LANGUAGES });
}

function getTopLevelRawItems(
  rawData: XMLData,
  category: ItemCategory,
): Array<XMLTopLevelItem> {
  const rawOchre = rawData.result.ochre;
  switch (category) {
    case "tree": {
      return "tree" in rawOchre ? rawOchre.tree : [];
    }
    case "bibliography": {
      return "bibliography" in rawOchre ? rawOchre.bibliography : [];
    }
    case "concept": {
      return "concept" in rawOchre ? rawOchre.concept : [];
    }
    case "spatialUnit": {
      return "spatialUnit" in rawOchre ? rawOchre.spatialUnit : [];
    }
    case "period": {
      return "period" in rawOchre ? rawOchre.period : [];
    }
    case "person": {
      return "person" in rawOchre ? rawOchre.person : [];
    }
    case "propertyVariable": {
      if ("propertyVariable" in rawOchre) {
        return rawOchre.propertyVariable;
      }
      return "variable" in rawOchre ? rawOchre.variable : [];
    }
    case "propertyValue": {
      return "propertyValue" in rawOchre ? rawOchre.propertyValue : [];
    }
    case "resource": {
      return "resource" in rawOchre ? rawOchre.resource : [];
    }
    case "text": {
      return "text" in rawOchre ? rawOchre.text : [];
    }
    case "set": {
      return "set" in rawOchre ? rawOchre.set : [];
    }
  }
}

function expectMetadataMatchesRaw(
  rawMetadata: XMLMetadata,
  data: TopLevelItemForTest,
): void {
  const metadata = data.metadata;
  const rawPublisher = Array.isArray(rawMetadata.publisher)
    ? rawMetadata.publisher[0]
    : rawMetadata.publisher;

  expect(metadata.dataset).toBe(parseStringLikeForTest(rawMetadata.dataset));
  expect(metadata.description).toBe(
    parseStringLikeForTest(rawMetadata.description),
  );
  expect(metadata.publisher).toBe(parseStringLikeForTest(rawPublisher));
  expect(metadata.identifier).toBe(
    transformPermanentIdentificationUrlForTest(
      parseStringLikeForTest(rawMetadata.identifier),
    ),
  );

  if (rawMetadata.item != null) {
    expect(metadata.item?.category).toBe(
      normalizeCategory(rawMetadata.item.category),
    );
    expect(metadata.item?.type).toBe(rawMetadata.item.type);
    expect(metadata.item?.maxLength).toBe(rawMetadata.item.maxLength ?? null);
  }
}

function expectIdentificationMatchesRaw(
  rawIdentification: XMLIdentification,
  parsedIdentification: TopLevelItemForTest["identification"],
): void {
  expect(parsedIdentification.label.getText("eng")).toBe(
    parseContentLikeForTest(rawIdentification.label),
  );

  if (rawIdentification.abbreviation != null) {
    expect(parsedIdentification.abbreviation?.getText("eng")).toBe(
      parseContentLikeForTest(rawIdentification.abbreviation),
    );
  } else {
    expect(parsedIdentification.abbreviation).toBeNull();
  }

  expect(parsedIdentification.code).toBe(
    parseStringLikeForTest(rawIdentification.code),
  );
  expect(parsedIdentification.email).toBe(
    parseStringLikeForTest(rawIdentification.email),
  );
  expect(parsedIdentification.website).toBe(
    parseStringLikeForTest(rawIdentification.website),
  );

  const labelAliases = isXMLContent(rawIdentification.label)
    ? extractAliases(rawIdentification.label)
    : null;
  const abbreviationAliases =
    rawIdentification.abbreviation != null &&
    isXMLContent(rawIdentification.abbreviation)
      ? extractAliases(rawIdentification.abbreviation)
      : null;

  expect(parsedIdentification.label.getAliases()).toStrictEqual(
    labelAliases ?? [],
  );
  expect(parsedIdentification.abbreviation?.getAliases() ?? []).toStrictEqual(
    abbreviationAliases ?? [],
  );
}

function countContextNodes(rawContext: XMLContext): number {
  let count = 0;
  for (const context of rawContext) {
    if (!isXMLContextGroup(context)) {
      continue;
    }

    for (const contextItem of context.context) {
      if ("project" in contextItem) {
        count += 1;
      }
    }
  }

  return count;
}

function countContextHeadings(rawContext: XMLContext): number {
  let count = 0;
  for (const context of rawContext) {
    if (!isXMLContextGroup(context)) {
      continue;
    }

    for (const contextItem of context.context) {
      if (!("project" in contextItem)) {
        continue;
      }

      count += contextItem.heading?.length ?? 0;
    }
  }

  return count;
}

function countRawContextItems(rawContext: XMLContext, key: string): number {
  let count = 0;
  for (const context of rawContext) {
    if (!isXMLContextGroup(context)) {
      continue;
    }

    for (const contextItem of context.context) {
      if (!("project" in contextItem)) {
        continue;
      }

      const value = (contextItem as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        count += value.length;
      }
    }
  }

  return count;
}

function isXMLContextGroup(
  rawContextItem: XMLContext[number],
): rawContextItem is XMLContextGroup {
  return "context" in rawContextItem;
}

function getRawContextDisplayPath(rawContext: XMLContext): string {
  for (const context of rawContext) {
    if (isXMLContextGroup(context)) {
      return context.displayPath;
    }
  }

  return "";
}

function expectContextMatchesRaw(
  rawContext: XMLContext | undefined,
  parsedContext: TopLevelItemForTest["context"],
): void {
  if (rawContext == null) {
    expect(parsedContext).toBeNull();
    return;
  }

  expect(parsedContext).not.toBeNull();
  expect(parsedContext?.nodes).toHaveLength(countContextNodes(rawContext));
  expect(parsedContext?.displayPath).toBe(getRawContextDisplayPath(rawContext));

  let parsedHeadingCount = 0;
  let parsedPropertyVariableCount = 0;
  let parsedPropertyValueCount = 0;
  const parsedNodes = parsedContext?.nodes ?? [];
  for (const node of parsedNodes) {
    parsedHeadingCount += node.heading.length;
    parsedPropertyVariableCount += node.propertyVariable?.length ?? 0;
    parsedPropertyValueCount += node.propertyValue?.length ?? 0;
  }

  expect(parsedHeadingCount).toBe(countContextHeadings(rawContext));
  expect(parsedPropertyVariableCount).toBe(
    countRawContextItems(rawContext, "propertyVariable") +
      countRawContextItems(rawContext, "variable"),
  );
  expect(parsedPropertyValueCount).toBe(
    countRawContextItems(rawContext, "propertyValue") +
      countRawContextItems(rawContext, "value"),
  );
}

function expectBaseItemMatchesRaw(
  rawItem: Partial<XMLBaseItem> & { uuid?: string; publicationDateTime?: Date },
  parsedItem: BaseItem<
    ItemCategory,
    typeof TEST_LANGUAGES,
    "topLevel" | "embedded"
  >,
  category: ItemCategory,
): void {
  expect(parsedItem.uuid).toBe(rawItem.uuid ?? "");
  expect(parsedItem.category).toBe(category);
  expect(parsedItem.publicationDateTime?.toISOString() ?? null).toBe(
    rawItem.publicationDateTime?.toISOString() ?? null,
  );
  expectContextMatchesRaw(rawItem.context, parsedItem.context);

  if (rawItem.identification != null) {
    expectIdentificationMatchesRaw(
      rawItem.identification,
      parsedItem.identification,
    );
  }

  if (rawItem.description != null) {
    expect(parsedItem.description?.getText("eng")).toBe(
      parseContentLikeForTest(rawItem.description),
    );
  } else {
    expect(parsedItem.description).toBeNull();
  }

  if (rawItem.availability != null) {
    expect(parsedItem.license?.content).toBe(
      parseStringLikeForTest(rawItem.availability.license),
    );
    expect(parsedItem.license?.target).toBe(
      rawItem.availability.license.target ?? null,
    );
  } else {
    expect(parsedItem.license).toBeNull();
  }

  if (rawItem.copyright != null) {
    expect(parsedItem.copyright?.getText("eng")).toBe(
      parseContentLikeForTest(rawItem.copyright),
    );
  } else {
    expect(parsedItem.copyright).toBeNull();
  }

  if (rawItem.watermark != null) {
    expect(parsedItem.watermark?.getText("eng")).toBe(
      parseContentLikeForTest(rawItem.watermark),
    );
  } else {
    expect(parsedItem.watermark).toBeNull();
  }

  expect(parsedItem.creators).toHaveLength(
    rawItem.creators?.creator.length ?? 0,
  );
  expect(parsedItem.events).toHaveLength(rawItem.events?.event.length ?? 0);
}

function expectPropertyFieldsMatchRaw(
  rawProperty: XMLProperty,
  parsedProperty: ParsedPropertyFields,
): void {
  expect(parsedProperty.variable.uuid).toBe(rawProperty.label.uuid);
  expect(
    parsedProperty.variable.publicationDateTime?.toISOString() ?? null,
  ).toBe(rawProperty.label.publicationDateTime?.toISOString() ?? null);
  expect(parsedProperty.variable.label.getText()).toBe(
    parseContentLikeForTest(rawProperty.label),
  );
  expect(parsedProperty.variable.relation).toBe(
    rawProperty.label.relation ?? null,
  );
  expect(parsedProperty.values).toHaveLength(rawProperty.value?.length ?? 0);

  for (
    let valueIndex = 0;
    valueIndex < (rawProperty.value?.length ?? 0);
    valueIndex += 1
  ) {
    const rawValue = rawProperty.value![valueIndex]!;
    const parsedValue = parsedProperty.values[valueIndex]!;
    const rawLabel =
      rawValue.content != null
        ? parseContentLikeForTest(rawValue)
        : rawValue.payload != null && rawValue.payload !== ""
          ? rawValue.payload
          : null;
    const expectedContent =
      rawValue.rawValue ?? rawValue.payload ?? rawLabel ?? rawValue.slug ?? "";
    const expectedNumericContent = Number(expectedContent);

    expect(parsedValue.uuid).toBe(
      rawValue.uuid == null || rawValue.uuid === "" ? null : rawValue.uuid,
    );
    expect(parsedValue.category).toBe(rawValue.category ?? null);
    expect(parsedValue.type).toBe(rawValue.type ?? null);
    expect(parsedValue.content).toBe(
      parsedValue.dataType === "boolean"
        ? expectedContent === "true"
        : ["integer", "decimal", "time"].includes(parsedValue.dataType)
          ? Number.isNaN(expectedNumericContent)
            ? 0
            : expectedNumericContent
          : expectedContent,
    );

    if (rawLabel != null) {
      expect(parsedValue.label?.getText("eng")).toBe(rawLabel);
    } else {
      expect(parsedValue.label).toBeNull();
    }
  }
}

function expectPropertiesMatchRaw(
  rawProperties: { property: Array<XMLProperty> } | undefined,
  parsedProperties: Array<Property<typeof TEST_LANGUAGES>>,
): void {
  const rawPropertyItems = rawProperties?.property ?? [];
  expect(parsedProperties).toHaveLength(rawPropertyItems.length);

  for (const [index, rawPropertyItem] of rawPropertyItems.entries()) {
    const rawProperty = rawPropertyItem;
    const parsedProperty = parsedProperties[index]!;

    expectPropertyFieldsMatchRaw(rawProperty, parsedProperty);
    expectPropertiesMatchRaw(
      rawProperty.property == null
        ? undefined
        : { property: rawProperty.property },
      parsedProperty.properties,
    );
  }
}

function expectSetItemPropertiesMatchRaw(
  rawProperties: { property: Array<XMLProperty> } | undefined,
  parsedProperties: Array<SetItemProperty<typeof TEST_LANGUAGES>>,
): void {
  const rawPropertyItems = rawProperties?.property ?? [];
  expect(parsedProperties).toHaveLength(rawPropertyItems.length);

  for (const [index, rawPropertyItem] of rawPropertyItems.entries()) {
    const rawProperty = rawPropertyItem;
    const parsedProperty = parsedProperties[index]!;

    expectPropertyFieldsMatchRaw(rawProperty, parsedProperty);
    expect(Object.hasOwn(parsedProperty, "properties")).toBe(false);
  }
}

function expectNotesMatchRaw(
  rawNotes: { note: Array<XMLNote> } | undefined,
  parsedNotes: Array<Note<typeof TEST_LANGUAGES>>,
): void {
  const rawNoteItems = rawNotes?.note ?? [];
  expect(parsedNotes).toHaveLength(rawNoteItems.length);

  for (const [index, rawNoteItem] of rawNoteItems.entries()) {
    const rawNote = rawNoteItem;
    const parsedNote = parsedNotes[index]!;
    const expectedContent =
      rawNote.content == null
        ? parseXMLString(rawNote).text
        : parseContentLikeForTest(rawNote);

    expect(parsedNote.number).toBe(rawNote.noteNo ?? 0);
    expect(parsedNote.content.getText("eng")).toBe(expectedContent);
  }
}

function countResourceItems(
  rawResources:
    | Array<XMLResource | { resource: Array<XMLResource> }>
    | undefined,
): number {
  let count = 0;
  const resources = rawResources ?? [];
  for (const resource of resources) {
    if (!("uuid" in resource)) {
      count += resource.resource.length;
      continue;
    }

    count += 1;
  }

  return count;
}

function hasCategory(
  categories: ReadonlyArray<ItemCategory> | undefined,
  category: ItemCategory,
): boolean {
  return categories == null || categories.includes(category);
}

function countItemsInHierarchy(
  hierarchy: XMLItemHierarchy | undefined,
  categories?: ReadonlyArray<ItemCategory>,
): number {
  if (hierarchy == null) {
    return 0;
  }

  let count = 0;
  if (hasCategory(categories, "tree")) count += hierarchy.tree?.length ?? 0;
  if (hasCategory(categories, "bibliography")) {
    count += hierarchy.bibliography?.length ?? 0;
  }
  if (hasCategory(categories, "concept"))
    count += hierarchy.concept?.length ?? 0;
  if (hasCategory(categories, "spatialUnit")) {
    count += hierarchy.spatialUnit?.length ?? 0;
  }
  if (hasCategory(categories, "period")) count += hierarchy.period?.length ?? 0;
  if (hasCategory(categories, "person")) count += hierarchy.person?.length ?? 0;
  if (hasCategory(categories, "propertyVariable")) {
    count += hierarchy.propertyVariable?.length ?? 0;
    count += hierarchy.variable?.length ?? 0;
  }
  if (hasCategory(categories, "propertyValue")) {
    count += hierarchy.propertyValue?.length ?? 0;
  }
  if (hasCategory(categories, "resource")) {
    count += countResourceItems(hierarchy.resource);
  }
  if (hasCategory(categories, "text")) count += hierarchy.text?.length ?? 0;
  if (hasCategory(categories, "set")) count += hierarchy.set?.length ?? 0;

  return count;
}

function getRawSetItemEntries(
  hierarchy: XMLItemHierarchy | undefined,
): Array<RawSetItemEntry> {
  const entries: Array<RawSetItemEntry> = [];
  if (hierarchy == null) {
    return entries;
  }

  const trees = hierarchy.tree ?? [];
  for (const tree of trees) {
    entries.push({ category: "tree", item: tree });
  }
  const bibliographies = hierarchy.bibliography ?? [];
  for (const bibliography of bibliographies) {
    entries.push({ category: "bibliography", item: bibliography });
  }
  const concepts = hierarchy.concept ?? [];
  for (const concept of concepts) {
    entries.push({ category: "concept", item: concept });
  }
  const spatialUnits = hierarchy.spatialUnit ?? [];
  for (const spatialUnit of spatialUnits) {
    entries.push({ category: "spatialUnit", item: spatialUnit });
  }
  const periods = hierarchy.period ?? [];
  for (const period of periods) {
    entries.push({ category: "period", item: period });
  }
  const persons = hierarchy.person ?? [];
  for (const person of persons) {
    entries.push({ category: "person", item: person });
  }
  const propertyVariables = hierarchy.propertyVariable ?? [];
  for (const propertyVariable of propertyVariables) {
    entries.push({ category: "propertyVariable", item: propertyVariable });
  }
  const variables = hierarchy.variable ?? [];
  for (const propertyVariable of variables) {
    entries.push({ category: "propertyVariable", item: propertyVariable });
  }
  const propertyValues = hierarchy.propertyValue ?? [];
  for (const propertyValue of propertyValues) {
    entries.push({ category: "propertyValue", item: propertyValue });
  }
  const resources = hierarchy.resource ?? [];
  for (const resource of resources) {
    if (!("uuid" in resource)) {
      for (const embeddedResource of resource.resource) {
        entries.push({ category: "resource", item: embeddedResource });
      }
      continue;
    }

    entries.push({ category: "resource", item: resource });
  }
  const texts = hierarchy.text ?? [];
  for (const text of texts) {
    entries.push({ category: "text", item: text });
  }
  const sets = hierarchy.set ?? [];
  for (const set of sets) {
    entries.push({ category: "set", item: set });
  }

  return entries;
}

function getRawSetItemProperties(
  rawItem: XMLSetItem,
): { property: Array<XMLProperty> } | undefined {
  return "properties" in rawItem ? rawItem.properties : undefined;
}

function expectSetItemMatchesRaw(
  rawEntry: RawSetItemEntry,
  parsedItem: ParsedSetItem,
): void {
  expectBaseItemMatchesRaw(rawEntry.item, parsedItem, rawEntry.category);
  expect(Object.hasOwn(parsedItem, "items")).toBe(false);

  if ("properties" in parsedItem) {
    expectSetItemPropertiesMatchRaw(
      getRawSetItemProperties(rawEntry.item),
      parsedItem.properties,
    );
  }

  switch (rawEntry.category) {
    case "concept": {
      const rawConcept = rawEntry.item as XMLConcept;
      const parsedConcept = parsedItem as SetItem<
        "concept",
        typeof TEST_LANGUAGES
      >;
      expect(Object.hasOwn(parsedConcept, "interpretations")).toBe(false);
      expect(parsedConcept.coordinates).toHaveLength(
        rawConcept.coordinates?.coord.length ?? 0,
      );
      break;
    }
    case "spatialUnit": {
      const rawSpatialUnit = rawEntry.item as XMLSpatialUnit;
      const parsedSpatialUnit = parsedItem as SetItem<
        "spatialUnit",
        typeof TEST_LANGUAGES
      >;
      expect(Object.hasOwn(parsedSpatialUnit, "observations")).toBe(false);
      expect(parsedSpatialUnit.coordinates).toHaveLength(
        rawSpatialUnit.coordinates?.coord.length ?? 0,
      );
      expect(parsedSpatialUnit.bibliographies).toHaveLength(
        rawSpatialUnit.bibliographies?.bibliography.length ?? 0,
      );
      break;
    }
    case "tree":
    case "bibliography":
    case "period":
    case "resource":
    case "set":
    case "person":
    case "propertyVariable":
    case "propertyValue":
    case "text": {
      break;
    }
  }
}

function expectSetItemsMatchRaw(
  rawSet: XMLSet,
  parsedSet: { items: ReadonlyArray<ParsedSetItem> },
): void {
  const rawItemEntries = getRawSetItemEntries(rawSet.items);
  expect(parsedSet.items).toHaveLength(rawItemEntries.length);

  for (const [index, rawEntry] of rawItemEntries.entries()) {
    expectSetItemMatchesRaw(rawEntry, parsedSet.items[index]!);
  }
}

function countLinkItems(rawLinks: XMLLinkLike): number {
  if (rawLinks == null) {
    return 0;
  }

  if (Array.isArray(rawLinks)) {
    let count = 0;
    for (const rawLink of rawLinks) {
      count += countItemsInHierarchy(rawLink as XMLItemHierarchy);
    }
    return count;
  }

  return countItemsInHierarchy(rawLinks as XMLItemHierarchy);
}

function expectCommonLinkedStructures(
  rawItem: {
    links?: XMLLinkLike;
    notes?: { note: Array<XMLNote> };
    properties?: { property: Array<XMLProperty> };
    bibliographies?: { bibliography: Array<XMLBibliography> };
  },
  parsedItem: TopLevelItemForTest,
): void {
  if ("links" in parsedItem) {
    expect(parsedItem.links).toHaveLength(countLinkItems(rawItem.links));
  }
  if ("notes" in parsedItem) {
    expectNotesMatchRaw(rawItem.notes, parsedItem.notes);
  }
  if ("properties" in parsedItem) {
    expectPropertiesMatchRaw(rawItem.properties, parsedItem.properties);
  }
  if ("bibliographies" in parsedItem) {
    expect(parsedItem.bibliographies).toHaveLength(
      rawItem.bibliographies?.bibliography.length ?? 0,
    );
  }
}

function expectCategorySpecificFields(
  category: ItemCategory,
  rawItem: XMLTopLevelItem,
  parsedItem: TopLevelItemForTest,
): void {
  switch (category) {
    case "tree": {
      const rawTree = rawItem as XMLTree;
      expectCommonLinkedStructures(rawTree, parsedItem);
      if (
        !("items" in parsedItem) ||
        !("containedItemCategory" in parsedItem)
      ) {
        throw new Error("Parsed tree is missing tree fields");
      }
      if (parsedItem.containedItemCategory != null) {
        expect(parsedItem.items.length).toBeGreaterThanOrEqual(0);
      }
      break;
    }
    case "bibliography": {
      const rawBibliography = rawItem as XMLBibliography;
      expectCommonLinkedStructures(rawBibliography, parsedItem);
      if (!("sourceDocument" in parsedItem)) {
        throw new Error("Parsed bibliography is missing bibliography fields");
      }
      expect(parsedItem.image == null).toBe(rawBibliography.image == null);
      expect(parsedItem.sourceDocument?.uuid ?? null).toBe(
        rawBibliography.sourceDocument?.uuid ?? null,
      );
      expect(parsedItem.sourceDocument?.content ?? null).toBe(
        rawBibliography.sourceDocument?.payload ?? null,
      );
      expect(parsedItem.periods).toHaveLength(
        rawBibliography.periods?.period.length ?? 0,
      );
      expect(parsedItem.authors).toHaveLength(
        rawBibliography.authors?.person.length ?? 0,
      );
      expect(parsedItem.items).toHaveLength(
        rawBibliography.bibliography?.length ?? 0,
      );
      break;
    }
    case "concept": {
      if (!("interpretations" in parsedItem)) {
        throw new Error("Parsed concept is missing concept fields");
      }
      const rawConcept = rawItem as XMLConcept;
      expect(parsedItem.interpretations).toHaveLength(
        rawConcept.interpretations?.interpretation.length ?? 0,
      );
      expect(parsedItem.coordinates).toHaveLength(
        rawConcept.coordinates?.coord.length ?? 0,
      );
      expect(parsedItem.items).toHaveLength(rawConcept.concept?.length ?? 0);
      break;
    }
    case "spatialUnit": {
      if (!("observations" in parsedItem)) {
        throw new Error("Parsed spatial unit is missing spatial unit fields");
      }
      const rawSpatialUnit = rawItem as XMLSpatialUnit;
      expect(parsedItem.observations).toHaveLength(
        rawSpatialUnit.observations?.observation.length ?? 0,
      );
      expect(parsedItem.coordinates).toHaveLength(
        rawSpatialUnit.coordinates?.coord.length ?? 0,
      );
      expect(parsedItem.bibliographies).toHaveLength(
        rawSpatialUnit.bibliographies?.bibliography.length ?? 0,
      );
      expect(parsedItem.items).toHaveLength(
        rawSpatialUnit.spatialUnit?.length ?? 0,
      );
      break;
    }
    case "period": {
      const rawPeriod = rawItem as XMLPeriod;
      expectCommonLinkedStructures(rawPeriod, parsedItem);
      if (!("items" in parsedItem) || !("coordinates" in parsedItem)) {
        throw new Error("Parsed period is missing period fields");
      }
      expect(parsedItem.coordinates).toHaveLength(
        rawPeriod.coordinates?.coord.length ?? 0,
      );
      expect(parsedItem.items).toHaveLength(rawPeriod.period?.length ?? 0);
      break;
    }
    case "person": {
      const rawPerson = rawItem as XMLPerson;
      expectCommonLinkedStructures(rawPerson, parsedItem);
      if (!("address" in parsedItem)) {
        throw new Error("Parsed person is missing person fields");
      }
      if (rawPerson.address == null) {
        expect(parsedItem.address).toBeNull();
      } else {
        expect(parsedItem.address?.country).toBe(
          parseStringLikeForTest(rawPerson.address.country),
        );
        expect(parsedItem.address?.city).toBe(
          parseStringLikeForTest(rawPerson.address.city),
        );
        expect(parsedItem.address?.state).toBe(
          parseStringLikeForTest(rawPerson.address.state),
        );
        expect(parsedItem.address?.postalCode).toBe(
          parseStringLikeForTest(rawPerson.address.postalCode),
        );
      }
      expect(parsedItem.coordinates).toHaveLength(
        rawPerson.coordinates?.coord.length ?? 0,
      );
      expect(parsedItem.periods).toHaveLength(
        rawPerson.periods?.period.length ?? 0,
      );
      break;
    }
    case "propertyVariable": {
      const rawPropertyVariable = rawItem as XMLPropertyVariable;
      expectCommonLinkedStructures(rawPropertyVariable, parsedItem);
      if (!("coordinates" in parsedItem)) {
        throw new Error("Parsed property variable is missing fields");
      }
      expect(parsedItem.coordinates).toHaveLength(
        rawPropertyVariable.coordinates?.coord.length ?? 0,
      );
      break;
    }
    case "propertyValue": {
      const rawPropertyValue = rawItem as XMLPropertyValue;
      expectCommonLinkedStructures(rawPropertyValue, parsedItem);
      if (!("coordinates" in parsedItem)) {
        throw new Error("Parsed property value is missing fields");
      }
      expect(parsedItem.coordinates).toHaveLength(
        rawPropertyValue.coordinates?.coord.length ?? 0,
      );
      break;
    }
    case "resource": {
      const rawResource = rawItem as XMLResource;
      expectCommonLinkedStructures(rawResource, parsedItem);
      if (!("href" in parsedItem)) {
        throw new Error("Parsed resource is missing resource fields");
      }
      expect(parsedItem.href).toBe(
        transformPermanentIdentificationUrlForTest(rawResource.href),
      );
      expect(parsedItem.fileFormat).toBe(rawResource.fileFormat ?? null);
      expect(parsedItem.fileSize).toBe(rawResource.fileSize ?? null);
      expect(parsedItem.image == null).toBe(rawResource.image == null);
      expect(parsedItem.document?.getText("eng") ?? null).toBe(
        parseContentLikeForTest(rawResource.document),
      );
      expect(parsedItem.coordinates).toHaveLength(
        rawResource.coordinates?.coord.length ?? 0,
      );
      expect(parsedItem.periods).toHaveLength(
        rawResource.periods?.period.length ?? 0,
      );
      expect(parsedItem.reverseLinks).toHaveLength(
        countLinkItems(rawResource.reverseLinks),
      );
      expect(parsedItem.items).toHaveLength(rawResource.resource?.length ?? 0);
      break;
    }
    case "text": {
      if (!("sections" in parsedItem)) {
        throw new Error("Parsed text is missing text fields");
      }
      const rawText = rawItem as XMLText;
      expect(parsedItem.text).toBe(rawText.text ?? null);
      expect(parsedItem.language).toBe(rawText.language ?? null);
      expect(parsedItem.coordinates).toHaveLength(
        rawText.coordinates?.coord.length ?? 0,
      );
      expect(parsedItem.links).toHaveLength(countLinkItems(rawText.links));
      expect(parsedItem.reverseLinks).toHaveLength(
        countLinkItems(rawText.reverseLinks),
      );
      expectNotesMatchRaw(rawText.notes, parsedItem.notes);
      expect(parsedItem.sections).toHaveLength(countRawSections(rawText));
      expect(parsedItem.periods).toHaveLength(
        rawText.periods?.period.length ?? 0,
      );
      expect(parsedItem.creators).toHaveLength(
        rawText.creators?.creator.length ?? 0,
      );
      expect(parsedItem.editions).toHaveLength(countRawTextEditions(rawText));
      break;
    }
    case "set": {
      const rawSet = rawItem as XMLSet;
      expectCommonLinkedStructures(rawSet, parsedItem);
      if (
        !("containedItemCategories" in parsedItem) ||
        !("items" in parsedItem)
      ) {
        throw new Error("Parsed set is missing set fields");
      }
      const parsedSet = parsedItem;
      expect(parsedSet.items).toHaveLength(countItemsInHierarchy(rawSet.items));
      expectSetItemsMatchRaw(rawSet, parsedSet);
      break;
    }
  }
}

function countRawSections(rawText: XMLText): number {
  if (
    rawText.sections == null ||
    !("translation" in rawText.sections || "phonemic" in rawText.sections)
  ) {
    return 0;
  }

  let count = 0;
  const translations = rawText.sections.translation ?? [];
  for (const translation of translations) {
    count += translation.section.length;
  }
  const phonemics = rawText.sections.phonemic ?? [];
  for (const phonemic of phonemics) {
    count += phonemic.section.length;
  }

  return count;
}

function countRawTextEditions(rawText: XMLText): number {
  let count = 0;
  count += rawText.editions?.edition?.length ?? 0;
  count += rawText.editions?.editor?.length ?? 0;
  count += rawText.editions?.publisher?.length ?? 0;
  return count;
}

function expectDataMatchesRaw(
  rawData: XMLData,
  data: TopLevelItemForTest,
  category: ItemCategory,
): void {
  const rawOchre = rawData.result.ochre;
  const rawItems = getTopLevelRawItems(rawData, category);
  expect(rawItems).toHaveLength(1);
  const rawItem = rawItems[0]!;

  expect(data.belongsTo).toStrictEqual({
    uuid: rawOchre.uuidBelongsTo,
    abbreviation: rawOchre.belongsTo,
  });
  expect(data.persistentUrl).toBe(rawOchre.persistentUrl ?? null);
  expectMetadataMatchesRaw(rawOchre.metadata, data);
  expectBaseItemMatchesRaw(rawItem, data, category);
  expectCategorySpecificFields(category, rawItem, data);
}

async function expectUuidParsesAndMatchesRaw(
  uuid: string,
  category: ItemCategory,
): Promise<void> {
  const rawData = await fetchXMLData(uuid);
  const data = parseRawData(rawData, category);
  expectDataMatchesRaw(rawData, data, category);
}

describe("fetchItem", () => {
  it("keeps language getters broad when languages are omitted", async () => {
    const languages = defineLanguages("eng", "spa");
    const implicitString = MultilingualString.create("spa", "Etiqueta");
    const explicitString = MultilingualString.create("eng", "Label", languages);
    const constructedString = new MultilingualString(
      {
        eng: "Label",
        spa: { text: "Etiqueta", richText: "<strong>Etiqueta</strong>" },
      },
      languages,
      { aliases: ["Alias"] },
    );
    const roundTrippedString = MultilingualString.fromJSON(
      constructedString.toJSON(),
      languages,
    );
    const result = fetchItem(RESOURCE_UUIDS[0]!, {
      category: "resource",
      fetch: async () => new Response("", { status: 500 }),
    });

    expectTypeOf(implicitString.getExactText.bind(implicitString))
      .parameter(0)
      .toEqualTypeOf<string>();
    expectTypeOf(explicitString.getExactText.bind(explicitString))
      .parameter(0)
      .toEqualTypeOf<"eng" | "spa">();
    expectTypeOf(constructedString.getExactText.bind(constructedString))
      .parameter(0)
      .toEqualTypeOf<"eng" | "spa">();
    expect(roundTrippedString.getRichText("spa")).toBe(
      "<strong>Etiqueta</strong>",
    );
    expect(roundTrippedString.getAliases()).toStrictEqual(["Alias"]);
    expectTypeOf(result).toEqualTypeOf<
      Promise<
        | {
            item: Item<"resource", never, ReadonlyArray<string>>;
            error: null;
            detailedError: null;
          }
        | { item: null; error: string; detailedError: string }
      >
    >();
    await expect(result).resolves.toStrictEqual({
      item: null,
      error: "Failed to fetch OCHRE data",
      detailedError: "Error\nMessage: Failed to fetch OCHRE data",
    });
  });

  it("defines reusable language tuples without array branding", () => {
    const languages = defineLanguages("eng", "spa");

    expect(languages).toStrictEqual(["eng", "spa"]);
    expectTypeOf(languages).toEqualTypeOf<readonly ["eng", "spa"]>();
    expect(() => defineLanguages("english")).toThrow(
      "Language code must be exactly 3 lowercase letters",
    );
  });

  it("infers inline language arrays without a helper", async () => {
    const result = fetchItem(RESOURCE_UUIDS[0]!, {
      category: "resource",
      languages: ["eng", "spa"],
      fetch: async () => new Response("", { status: 500 }),
    });

    expectTypeOf(result).toEqualTypeOf<
      Promise<
        | {
            item: Item<"resource", never, readonly ["eng", "spa"]>;
            error: null;
            detailedError: null;
          }
        | { item: null; error: string; detailedError: string }
      >
    >();
    await expect(result).resolves.toStrictEqual({
      item: null,
      error: "Failed to fetch OCHRE data",
      detailedError: "Error\nMessage: Failed to fetch OCHRE data",
    });
  });

  it("types shouldOmitEmbeddedItems for recursive and non-recursive item category overloads", async () => {
    const omittedSetResult = fetchItem(SET_UUIDS[0]!, {
      category: "set",
      shouldOmitEmbeddedItems: true,
      languages: ["eng", "spa"],
      fetch: async () => new Response("", { status: 500 }),
    });
    const omittedTreeResult = fetchItem(TREE_UUIDS[0]!, {
      category: "tree",
      containedItemCategory: "resource",
      shouldOmitEmbeddedItems: true,
      fetch: async () => new Response("", { status: 500 }),
    });
    const omittedResourceResult = fetchItem(RESOURCE_UUIDS[0]!, {
      category: "resource",
      shouldOmitEmbeddedItems: true,
      fetch: async () => new Response("", { status: 500 }),
    });
    const omittedTextFetchCalls: Array<{
      input: string | URL | globalThis.Request;
      init?: RequestInit;
    }> = [];
    const omittedTextResult = fetchItem(TEXT_UUIDS[0]!, {
      category: "text",
      shouldOmitEmbeddedItems: true,
      fetch: async (input, init) => {
        omittedTextFetchCalls.push({ input, init });

        return new Response("", { status: 500 });
      },
    });

    expectTypeOf(omittedSetResult).toEqualTypeOf<
      Promise<
        | {
            item: ItemWithoutEmbeddedItems<
              "set",
              SetItemCategory,
              readonly ["eng", "spa"]
            >;
            error: null;
            detailedError: null;
          }
        | { item: null; error: string; detailedError: string }
      >
    >();
    expectTypeOf(omittedTreeResult).toEqualTypeOf<
      Promise<
        | {
            item: ItemWithoutEmbeddedItems<
              "tree",
              "resource",
              ReadonlyArray<string>
            >;
            error: null;
            detailedError: null;
          }
        | { item: null; error: string; detailedError: string }
      >
    >();
    expectTypeOf(omittedResourceResult).toEqualTypeOf<
      Promise<
        | {
            item: ItemWithoutEmbeddedItems<
              "resource",
              never,
              ReadonlyArray<string>
            >;
            error: null;
            detailedError: null;
          }
        | { item: null; error: string; detailedError: string }
      >
    >();
    expectTypeOf(omittedTextResult).toEqualTypeOf<
      Promise<
        | {
            item: Item<"text", never, ReadonlyArray<string>>;
            error: null;
            detailedError: null;
          }
        | { item: null; error: string; detailedError: string }
      >
    >();
    await expect(omittedTextResult).resolves.toStrictEqual({
      item: null,
      error: "Failed to fetch OCHRE data",
      detailedError: "Error\nMessage: Failed to fetch OCHRE data",
    });
    expect(omittedTextFetchCalls).toStrictEqual([
      {
        input: `https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?uuid=${TEXT_UUIDS[0]!}&xsl=none&lang="*"`,
        init: undefined,
      },
    ]);
  });

  for (const category of ["tree", "resource", "set"] as const) {
    it(`fetches ${category} without embedded items via XQuery`, async () => {
      const uuid =
        category === "tree"
          ? TREE_UUIDS[0]!
          : category === "resource"
            ? RESOURCE_UUIDS[0]!
            : SET_UUIDS[0]!;
      const fetchCalls: Array<{
        input: string | URL | globalThis.Request;
        init?: RequestInit;
      }> = [];
      const result = await fetchItem(uuid, {
        category,
        shouldOmitEmbeddedItems: true,
        languages: TEST_LANGUAGES,
        fetch: async (input, init) => {
          fetchCalls.push({ input, init });

          return new Response(createFetchItemXML({ uuid, category }), {
            status: 200,
          });
        },
      });

      expect(fetchCalls).toHaveLength(1);
      expect(fetchCalls[0]?.input).toBe(
        'https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?xquery&xsl=none&lang="*"',
      );
      expect(fetchCalls[0]?.init?.method).toBe("POST");
      expect(fetchCalls[0]?.init?.headers).toStrictEqual({
        "Content-Type": "application/xquery",
      });

      const body = fetchCalls[0]?.init?.body;
      expect(typeof body).toBe("string");
      if (typeof body === "string") {
        expect(body).toContain(
          'cts:element-attribute-value-query(xs:QName("ochre"), xs:QName("uuid"), $uuid, "exact")',
        );
        expect(body).toContain(`fn:collection("ochre/${category}")/ochre`);
        expect(body).toContain(
          'if (local-name($item) = ("tree", "set")) then "items" else local-name($item)',
        );
        expect(body).toContain(
          "not(self::*[local-name() = $embedded-child-name])",
        );
      }

      expect(result.error).toBeNull();
      if (result.error !== null) {
        throw new Error(result.detailedError);
      }

      expect(result.item.category).toBe(category);
      expect("items" in result.item).toBe(false);
      if (result.item.category === "set") {
        expect(result.item.containedItemCategories).toStrictEqual([]);
      } else if (result.item.category === "tree") {
        expect(result.item.containedItemCategory).toBeNull();
      } else {
        expect(result.item.category).toBe("resource");
      }
    });
  }

  it("keeps embedded items for array categories when omission is false", async () => {
    const uuid = TREE_UUIDS[0]!;
    const resourceUuid = RESOURCE_UUIDS[0]!;
    const fetchCalls: Array<{
      input: string | URL | globalThis.Request;
      init?: RequestInit;
    }> = [];
    const result = await fetchItem(uuid, {
      category: ["tree", "set"],
      containedItemCategory: "resource",
      shouldOmitEmbeddedItems: false,
      languages: TEST_LANGUAGES,
      fetch: async (input, init) => {
        fetchCalls.push({ input, init });

        return new Response(
          createFetchItemXML({
            uuid,
            category: "tree",
            itemContent: `<items><resource uuid="${resourceUuid}" publicationDateTime="2026-05-10T10:08:35Z">${createXMLIdentification("Embedded Resource")}</resource></items>`,
          }),
          { status: 200 },
        );
      },
    });

    expect(fetchCalls).toStrictEqual([
      {
        input: `https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?uuid=${uuid}&xsl=none&lang="*"`,
        init: undefined,
      },
    ]);
    expect(result.error).toBeNull();
    if (result.error !== null) {
      throw new Error(result.detailedError);
    }

    expect(result.item.category).toBe("tree");
    if (result.item.category !== "tree") {
      throw new Error("Expected a tree item");
    }

    expect(result.item.containedItemCategory).toBe("resource");
    expect(result.item.items).toHaveLength(1);
    const [item] = result.item.items;
    if (item == null || !("category" in item)) {
      throw new Error("Expected an embedded resource item");
    }
    expect(item.uuid).toBe(resourceUuid);
  });

  it("rejects containedItemCategory for non-hierarchy categories before fetching", async () => {
    let didFetch = false;
    const result = await fetchItem(RESOURCE_UUIDS[0]!, {
      category: "resource",
      containedItemCategory: "text" as never,
      fetch: async () => {
        didFetch = true;
        throw new Error("fetch should not be called");
      },
    });

    expect(didFetch).toBe(false);
    expect(result.item).toBeNull();
    expect(result.error).toBe(
      'containedItemCategory can only be used when category is "tree" or "set"; received category "resource"',
    );
  });

  it(
    "uses the same schema and transformation path as direct parsing",
    async () => {
      const uuid = RESOURCE_UUIDS[0]!;
      const result = await fetchItem(uuid, {
        category: "resource",
        languages: TEST_LANGUAGES,
      });

      expect(result.error).toBeNull();
      expect(result.item?.uuid).toBe(uuid);
      expect(result.item?.category).toBe("resource");
      expect(result.item?.belongsTo.uuid).toBeTruthy();
      expect(result.item?.metadata.item?.category).toBe("resource");

      const inferredResult = await fetchItem(uuid);
      expect(inferredResult.error).toBeNull();
      if (inferredResult.error === null) {
        const inferredItem: Item = inferredResult.item;
        expect(inferredItem.uuid).toBe(uuid);
        expect(inferredItem.category).toBe("resource");
        expect(inferredResult.item.metadata.item?.category).toBe("resource");
      }
    },
    LIVE_TEST_TIMEOUT_MS,
  );
});

describe("item parser integration", () => {
  for (const fixture of CATEGORY_FIXTURES) {
    it(
      `parses and preserves ${fixture.category} XML fixtures`,
      async () => {
        for (const uuid of fixture.uuids) {
          await expectUuidParsesAndMatchesRaw(uuid, fixture.category);
        }
      },
      LIVE_TEST_TIMEOUT_MS,
    );
  }

  it(
    "fetches representative text items through the API and preserves their sections",
    async () => {
      for (const uuid of TEXT_UUIDS) {
        await expectUuidParsesAndMatchesRaw(uuid, "text");
      }
    },
    LIVE_TEST_TIMEOUT_MS,
  );
});
