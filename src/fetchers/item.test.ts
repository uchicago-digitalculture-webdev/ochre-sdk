import { XMLParser } from "fast-xml-parser";
import * as v from "valibot";
import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  BaseItem,
  DataCategory,
  Item,
  Note,
  Property,
  SetItem,
  SetItemDataCategory,
  SingleHierarchyProperty,
} from "#/types/index.js";
import type {
  XMLBaseItem,
  XMLBibliography,
  XMLConcept,
  XMLContent,
  XMLContext,
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
import { parseItem } from "#/parsers/index.js";
import { MultilingualString } from "#/parsers/multilingual.js";
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

type CategoryFixture = { category: DataCategory; uuids: ReadonlyArray<string> };

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
  DataCategory,
  SetItemDataCategory,
  typeof TEST_LANGUAGES
>;

type ParsedSetItem = SetItem<SetItemDataCategory, typeof TEST_LANGUAGES>;

type ParsedPropertyFields =
  | Property<typeof TEST_LANGUAGES>
  | SingleHierarchyProperty<typeof TEST_LANGUAGES>;

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

type RawSetItemEntry = { category: SetItemDataCategory; item: XMLSetItem };

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

const parser = new XMLParser(XML_PARSER_OPTIONS);

function normalizeCategory(category: string | undefined): string | null {
  if (category == null) {
    return null;
  }

  return category === "variable" ? "propertyVariable" : category;
}

function parseOptionalDate(value: string | undefined): Date | null {
  if (value == null || value === "") {
    return null;
  }

  return new Date(value.replace(" ", "T"));
}

function parseNumber(value: string | XMLString | undefined): number | null {
  if (value == null || value === "") {
    return null;
  }

  const parsedValue = Number(typeof value === "string" ? value : value.payload);
  return Number.isNaN(parsedValue) ? null : parsedValue;
}

function parseNumberOrZero(value: string | XMLString | undefined): number {
  return parseNumber(value) ?? 0;
}

function isXMLContent(value: XMLContent | XMLString): value is XMLContent {
  return "content" in value;
}

function parseStringLikeForTest(
  value: XMLString | string | undefined,
  options?: { isRichText: boolean; parseEmail?: boolean },
): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  return parseXMLString(value, {
    isRichText: options?.isRichText ?? true,
    parseEmail: options?.parseEmail ?? false,
  });
}

function transformPermanentIdentificationUrlForTest(
  value: string | null | undefined,
): string | null {
  return value == null ? null : transformPermanentIdentificationUrl(value);
}

function parseContentLikeForTest(
  value: XMLContent | XMLString | string | undefined,
  options?: { isRichText: boolean; parseEmail?: boolean },
): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (isXMLContent(value)) {
    return parseXMLContent(value, {
      languages: TEST_LANGUAGES,
      isRichText: options?.isRichText ?? true,
    }).getText("eng");
  }

  return parseStringLikeForTest(value, options);
}

function formatSchemaIssues(issues: Array<v.BaseIssue<unknown>>): string {
  const messages: Array<string> = [];
  for (const issue of issues) {
    const path: Array<string> = [];
    for (const pathItem of issue.path ?? []) {
      path.push(String(pathItem.key));
    }
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
  category: DataCategory,
): TopLevelItemForTest {
  return parseItem(rawData, {
    category,
    languages: TEST_LANGUAGES,
    isRichText: true,
  }) as TopLevelItemForTest;
}

function getTopLevelRawItems(
  rawData: XMLData,
  category: DataCategory,
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
  const rawPublisher =
    Array.isArray(rawMetadata.publisher) ?
      rawMetadata.publisher[0]
    : rawMetadata.publisher;

  expect(metadata.dataset).toBe(
    parseStringLikeForTest(rawMetadata.dataset, { isRichText: false }),
  );
  expect(metadata.description).toBe(
    parseStringLikeForTest(rawMetadata.description, { isRichText: false }),
  );
  expect(metadata.publisher).toBe(
    parseStringLikeForTest(rawPublisher, { isRichText: false }),
  );
  expect(metadata.identifier).toBe(
    transformPermanentIdentificationUrlForTest(
      parseStringLikeForTest(rawMetadata.identifier, { isRichText: false }),
    ),
  );

  if (rawMetadata.item != null) {
    expect(metadata.item?.category).toBe(
      normalizeCategory(rawMetadata.item.category),
    );
    expect(metadata.item?.type).toBe(rawMetadata.item.type);
    expect(metadata.item?.maxLength).toBe(
      parseNumber(rawMetadata.item.maxLength),
    );
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
    parseStringLikeForTest(rawIdentification.code, { isRichText: false }),
  );
  expect(parsedIdentification.email).toBe(
    parseStringLikeForTest(rawIdentification.email, { isRichText: false }),
  );
  expect(parsedIdentification.website).toBe(
    parseStringLikeForTest(rawIdentification.website, { isRichText: false }),
  );

  const labelAliases =
    isXMLContent(rawIdentification.label) ?
      extractAliases(rawIdentification.label, { isRichText: true })
    : null;
  const abbreviationAliases =
    (
      rawIdentification.abbreviation != null &&
      isXMLContent(rawIdentification.abbreviation)
    ) ?
      extractAliases(rawIdentification.abbreviation, { isRichText: true })
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
    count += context.context.length;
  }

  return count;
}

function countContextHeadings(rawContext: XMLContext): number {
  let count = 0;
  for (const context of rawContext) {
    for (const contextItem of context.context) {
      count += contextItem.heading?.length ?? 0;
    }
  }

  return count;
}

function countRawContextItems(rawContext: XMLContext, key: string): number {
  let count = 0;
  for (const context of rawContext) {
    for (const contextItem of context.context) {
      const value = (contextItem as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        count += value.length;
      }
    }
  }

  return count;
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
  expect(parsedContext?.displayPath).toBe(rawContext[0]?.displayPath ?? "");

  let parsedHeadingCount = 0;
  let parsedPropertyVariableCount = 0;
  let parsedPropertyValueCount = 0;
  for (const node of parsedContext?.nodes ?? []) {
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
  rawItem: Partial<XMLBaseItem> & {
    uuid?: string;
    publicationDateTime?: string;
  },
  parsedItem: BaseItem<
    DataCategory,
    typeof TEST_LANGUAGES,
    "topLevel" | "nested"
  >,
  category: DataCategory,
): void {
  expect(parsedItem.uuid).toBe(rawItem.uuid ?? "");
  expect(parsedItem.category).toBe(category);
  expect(parsedItem.publicationDateTime?.toISOString() ?? null).toBe(
    parseOptionalDate(rawItem.publicationDateTime)?.toISOString() ?? null,
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
      parseStringLikeForTest(rawItem.availability.license, {
        isRichText: false,
      }),
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
  expect(parsedProperty.label.uuid).toBe(rawProperty.label.uuid);
  expect(parsedProperty.label.name).toBe(
    parseContentLikeForTest(rawProperty.label),
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
      rawValue.content == null ?
        null
      : parseContentLikeForTest(rawValue as XMLContent);
    const expectedContent =
      rawValue.rawValue ?? rawValue.payload ?? rawLabel ?? rawValue.slug ?? "";

    expect(parsedValue.uuid).toBe(
      rawValue.uuid == null || rawValue.uuid === "" ? null : rawValue.uuid,
    );
    expect(parsedValue.category).toBe(rawValue.category ?? null);
    expect(parsedValue.type).toBe(rawValue.type ?? null);
    expect(parsedValue.content).toBe(
      parsedValue.dataType === "boolean" ? expectedContent === "true"
      : (
        parsedValue.dataType === "integer" ||
        parsedValue.dataType === "decimal" ||
        parsedValue.dataType === "time"
      ) ?
        parseNumberOrZero(expectedContent)
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
    const rawProperty = rawPropertyItem!;
    const parsedProperty = parsedProperties[index]!;

    expectPropertyFieldsMatchRaw(rawProperty, parsedProperty);
    expectPropertiesMatchRaw(
      rawProperty.property == null ?
        undefined
      : { property: rawProperty.property },
      parsedProperty.properties,
    );
  }
}

function expectSingleHierarchyPropertiesMatchRaw(
  rawProperties: { property: Array<XMLProperty> } | undefined,
  parsedProperties: Array<SingleHierarchyProperty<typeof TEST_LANGUAGES>>,
): void {
  const rawPropertyItems = rawProperties?.property ?? [];
  expect(parsedProperties).toHaveLength(rawPropertyItems.length);

  for (const [index, rawPropertyItem] of rawPropertyItems.entries()) {
    const rawProperty = rawPropertyItem!;
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
    const rawNote = rawNoteItem!;
    const parsedNote = parsedNotes[index]!;
    const expectedContent =
      rawNote.content == null ?
        parseXMLString(rawNote, { isRichText: true, parseEmail: true })
      : parseContentLikeForTest(rawNote as XMLContent);

    expect(parsedNote.number).toBe(parseNumberOrZero(rawNote.noteNo));
    expect(parsedNote.content.getText("eng")).toBe(expectedContent);
  }
}

function countResourceItems(
  rawResources:
    | Array<XMLResource | { resource: Array<XMLResource> }>
    | undefined,
): number {
  let count = 0;
  for (const resource of rawResources ?? []) {
    if (!("uuid" in resource)) {
      count += resource.resource.length;
      continue;
    }

    count += 1;
  }

  return count;
}

function hasCategory(
  categories: ReadonlyArray<DataCategory> | undefined,
  category: DataCategory,
): boolean {
  return categories == null || categories.includes(category);
}

function countItemsInHierarchy(
  hierarchy: XMLItemHierarchy | undefined,
  categories?: ReadonlyArray<DataCategory>,
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

  for (const tree of hierarchy.tree ?? []) {
    entries.push({ category: "tree", item: tree });
  }
  for (const bibliography of hierarchy.bibliography ?? []) {
    entries.push({ category: "bibliography", item: bibliography });
  }
  for (const concept of hierarchy.concept ?? []) {
    entries.push({ category: "concept", item: concept });
  }
  for (const spatialUnit of hierarchy.spatialUnit ?? []) {
    entries.push({ category: "spatialUnit", item: spatialUnit });
  }
  for (const period of hierarchy.period ?? []) {
    entries.push({ category: "period", item: period });
  }
  for (const person of hierarchy.person ?? []) {
    entries.push({ category: "person", item: person });
  }
  for (const propertyVariable of hierarchy.propertyVariable ?? []) {
    entries.push({ category: "propertyVariable", item: propertyVariable });
  }
  for (const propertyVariable of hierarchy.variable ?? []) {
    entries.push({ category: "propertyVariable", item: propertyVariable });
  }
  for (const propertyValue of hierarchy.propertyValue ?? []) {
    entries.push({ category: "propertyValue", item: propertyValue });
  }
  for (const resource of hierarchy.resource ?? []) {
    if (!("uuid" in resource)) {
      for (const nestedResource of resource.resource) {
        entries.push({ category: "resource", item: nestedResource });
      }
      continue;
    }

    entries.push({ category: "resource", item: resource });
  }
  for (const text of hierarchy.text ?? []) {
    entries.push({ category: "text", item: text });
  }
  for (const set of hierarchy.set ?? []) {
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
    expectSingleHierarchyPropertiesMatchRaw(
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
  const rawItemEntries = getRawSetItemEntries(
    rawSet.items as XMLItemHierarchy | undefined,
  );
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
  category: DataCategory,
  rawItem: XMLTopLevelItem,
  parsedItem: TopLevelItemForTest,
): void {
  switch (category) {
    case "tree": {
      const rawTree = rawItem as XMLTree;
      expectCommonLinkedStructures(rawTree, parsedItem);
      if (!("items" in parsedItem) || !("itemsCategory" in parsedItem)) {
        throw new Error("Parsed tree is missing tree fields");
      }
      if (parsedItem.itemsCategory != null) {
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
      const rawConcept = rawItem as XMLConcept;
      if (!("interpretations" in parsedItem)) {
        throw new Error("Parsed concept is missing concept fields");
      }
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
      const rawSpatialUnit = rawItem as XMLSpatialUnit;
      if (!("observations" in parsedItem)) {
        throw new Error("Parsed spatial unit is missing spatial unit fields");
      }
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
          parseStringLikeForTest(rawPerson.address.country, {
            isRichText: false,
          }),
        );
        expect(parsedItem.address?.city).toBe(
          parseStringLikeForTest(rawPerson.address.city, { isRichText: false }),
        );
        expect(parsedItem.address?.state).toBe(
          parseStringLikeForTest(rawPerson.address.state, {
            isRichText: false,
          }),
        );
        expect(parsedItem.address?.postalCode).toBe(
          parseStringLikeForTest(rawPerson.address.postalCode, {
            isRichText: false,
          }),
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
      expect(parsedItem.fileSize).toBe(parseNumber(rawResource.fileSize));
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
      const rawText = rawItem as XMLText;
      if (!("sections" in parsedItem)) {
        throw new Error("Parsed text is missing text fields");
      }
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
      if (!("itemsCategory" in parsedItem) || !("items" in parsedItem)) {
        throw new Error("Parsed set is missing set fields");
      }
      const parsedSet = parsedItem as Item<
        "set",
        SetItemDataCategory,
        typeof TEST_LANGUAGES
      >;
      expect(parsedSet.items).toHaveLength(
        countItemsInHierarchy(rawSet.items as XMLItemHierarchy | undefined),
      );
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
  for (const translation of rawText.sections.translation ?? []) {
    count += translation.section.length;
  }
  for (const phonemic of rawText.sections.phonemic ?? []) {
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
  category: DataCategory,
): void {
  const rawOchre = rawData.result.ochre;
  const rawItems = getTopLevelRawItems(rawData, category);
  expect(rawItems).toHaveLength(1);
  const rawItem = rawItems[0]!;

  expect(data.belongsTo).toStrictEqual({
    uuid: rawOchre.uuidBelongsTo,
    abbreviation: rawOchre.belongsTo,
  });
  expect(data.persistentUrl).toBe(
    transformPermanentIdentificationUrlForTest(rawOchre.persistentUrl),
  );
  expectMetadataMatchesRaw(rawOchre.metadata, data);
  expectBaseItemMatchesRaw(rawItem, data, category);
  expectCategorySpecificFields(category, rawItem, data);
}

async function expectUuidParsesAndMatchesRaw(
  uuid: string,
  category: DataCategory,
): Promise<void> {
  const rawData = await fetchXMLData(uuid);
  const data = parseRawData(rawData, category);
  expectDataMatchesRaw(rawData, data, category);
}

describe("fetchItem", () => {
  it("keeps language getters broad when languages are omitted", async () => {
    const implicitString = MultilingualString.create("spa", "Etiqueta");
    const explicitString = MultilingualString.create(
      "eng",
      "Label",
      defineLanguages("eng", "spa"),
    );
    const result = fetchItem(RESOURCE_UUIDS[0]!, {
      category: "resource",
      fetch: async () => new Response("", { status: 500 }),
    });

    expectTypeOf(implicitString.getExactText)
      .parameter(0)
      .toEqualTypeOf<string>();
    expectTypeOf(explicitString.getExactText)
      .parameter(0)
      .toEqualTypeOf<"eng" | "spa">();
    expectTypeOf(result).toEqualTypeOf<
      Promise<
        | { item: Item<"resource", never, ReadonlyArray<string>>; error: null }
        | { item: null; error: string }
      >
    >();
    await expect(result).resolves.toStrictEqual({
      item: null,
      error: "Failed to fetch OCHRE data",
    });
  });

  it("defines reusable language tuples without array branding", () => {
    const languages = defineLanguages("eng", "spa");

    expect(languages).toStrictEqual(["eng", "spa"]);
    expectTypeOf(languages).toEqualTypeOf<readonly ["eng", "spa"]>();
    expect(() => defineLanguages("english")).toThrow(
      "Language code must be exactly 3 characters",
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
          }
        | { item: null; error: string }
      >
    >();
    await expect(result).resolves.toStrictEqual({
      item: null,
      error: "Failed to fetch OCHRE data",
    });
  });

  it("rejects itemCategory for non-hierarchy categories before fetching", async () => {
    let didFetch = false;
    const result = await fetchItem(RESOURCE_UUIDS[0]!, {
      category: "resource",
      itemCategory: "text" as never,
      fetch: async () => {
        didFetch = true;
        throw new Error("fetch should not be called");
      },
    });

    expect(didFetch).toBe(false);
    expect(result.item).toBeNull();
    expect(result.error).toBe(
      'itemCategory can only be used when category is "tree" or "set"; received category "resource"',
    );
  });

  it(
    "uses the same schema and transformation path as direct parsing",
    async () => {
      const uuid = RESOURCE_UUIDS[0]!;
      const result = await fetchItem(uuid, {
        category: "resource",
        languages: TEST_LANGUAGES,
        isRichText: true,
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
