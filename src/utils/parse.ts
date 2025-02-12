import type {
  FakeString,
  OchreBibliography,
  OchreConcept,
  OchreContext,
  OchreContextItem,
  OchreCoordinates,
  OchreEvent,
  OchreIdentification,
  OchreImage,
  OchreImageMap,
  OchreInterpretation,
  OchreLanguage,
  OchreLicense,
  OchreLink,
  OchreMetadata,
  OchreNestedConcept,
  OchreNestedResource,
  OchreNestedSpatialUnit,
  OchreNote,
  OchreObservation,
  OchrePeriod,
  OchrePerson,
  OchreProperty,
  OchreResource,
  OchreSet,
  OchreSpatialUnit,
  OchreStringContent,
  OchreStringRichText,
  OchreTree,
} from "../types/internal.raw.d.ts";
import type {
  Bibliography,
  Concept,
  Context,
  ContextItem,
  Coordinates,
  Document,
  Event,
  Footnote,
  Identification,
  Image,
  ImageMap,
  Interpretation,
  License,
  Link,
  Metadata,
  NestedConcept,
  NestedResource,
  NestedSpatialUnit,
  Note,
  Observation,
  Period,
  Person,
  Property,
  PropertyValue,
  PropertyValueType,
  Resource,
  Set,
  SpatialUnit,
  Style,
  Tree,
  WebElement,
  WebElementComponent,
  WebImage,
  Webpage,
  Website,
  WebsiteProperties,
} from "../types/main.js";
import { z } from "zod";
import { fetchResource } from "../utils/fetchers/resource.js";
import {
  getPropertyByLabel,
  getPropertyValueByLabel,
} from "../utils/getters.js";
import {
  parseEmailAndUrl,
  parseFakeString,
  parseStringContent,
  parseStringDocumentItem,
  trimEndLineBreaks,
} from "../utils/string.js";

/**
 * Schema for validating website properties
 */
const websiteSchema = z.object({
  type: z.enum(
    [
      "traditional",
      "digital-collection",
      "plum",
      "cedar",
      "elm",
      "maple",
      "oak",
      "palm",
    ] as const satisfies ReadonlyArray<WebsiteProperties["type"]>,
    { message: "Invalid website type" },
  ),
  status: z.enum(
    ["development", "preview", "production"] as const satisfies ReadonlyArray<
      WebsiteProperties["status"]
    >,
    { message: "Invalid website status" },
  ),
  privacy: z.enum(
    ["public", "password", "private"] as const satisfies ReadonlyArray<
      WebsiteProperties["privacy"]
    >,
    { message: "Invalid website privacy" },
  ),
});

/**
 * Valid component types for web elements
 */
const componentSchema = z.enum(
  [
    "annotated-document",
    "annotated-image",
    "bibliography",
    "blog",
    "button",
    "collection",
    "iiif-viewer",
    "image",
    "image-gallery",
    "item-gallery",
    "n-columns",
    "n-rows",
    "network-graph",
    "table",
    "text",
    "text-image",
    "timeline",
    "video",
  ] as const satisfies ReadonlyArray<WebElementComponent["component"]>,
  { message: "Invalid component" },
);

/**
 * Parses raw identification data into the standardized Identification type
 *
 * @param identification - Raw identification data from OCHRE format
 * @returns Parsed Identification object with label and abbreviation
 */
export function parseIdentification(
  identification: OchreIdentification,
): Identification {
  try {
    const returnIdentification: Identification = {
      label:
        ["string", "number", "boolean"].includes(typeof identification.label) ?
          parseFakeString(identification.label as FakeString)
        : parseStringContent(identification.label as OchreStringContent),
      abbreviation: "",
    };

    for (const key of Object.keys(identification).filter(
      (key) => key !== "label",
    )) {
      returnIdentification[key as keyof Identification] = parseStringContent(
        identification[key as keyof OchreIdentification]! as OchreStringContent,
      );
    }

    return returnIdentification;
  } catch (error) {
    console.error(error);

    return {
      label: "",
      abbreviation: "",
    };
  }
}

/**
 * Parses raw language data into an array of language codes
 *
 * @param language - Raw language data, either single or array
 * @returns Array of language codes as strings
 */
export function parseLanguages(
  language: OchreLanguage | Array<OchreLanguage> | undefined,
): Array<string> {
  if (language == null) {
    // Default to English if no language is provided
    return ["eng"];
  }

  if (Array.isArray(language)) {
    return language.map((lang) => parseStringContent(lang));
  } else {
    return [parseStringContent(language)];
  }
}

/**
 * Parses raw metadata into the standardized Metadata type
 *
 * @param metadata - Raw metadata from OCHRE format
 * @returns Parsed Metadata object
 */
export function parseMetadata(metadata: OchreMetadata): Metadata {
  let identification: Identification = {
    label: "",
    abbreviation: "",
  };
  if (metadata.item) {
    if (metadata.item.label || metadata.item.abbreviation) {
      let label = "";
      let abbreviation = "";

      if (metadata.item.label) {
        label = parseStringContent(metadata.item.label);
      }
      if (metadata.item.abbreviation) {
        abbreviation = parseStringContent(metadata.item.abbreviation);
      }

      identification = { label, abbreviation };
    } else {
      identification = parseIdentification(metadata.item.identification);
    }
  }

  let projectIdentification:
    | (Identification & { website: string | null })
    | null = null;
  const baseProjectIdentification =
    metadata.project?.identification ?
      parseIdentification(metadata.project.identification)
    : null;
  if (baseProjectIdentification) {
    projectIdentification = {
      ...baseProjectIdentification,
      website: metadata.project?.identification.website ?? null,
    };
  }

  return {
    project:
      projectIdentification ? { identification: projectIdentification } : null,
    item:
      metadata.item ?
        {
          identification,
          category: metadata.item.category,
          type: metadata.item.type,
          maxLength: metadata.item.maxLength ?? null,
        }
      : null,
    dataset: parseStringContent(metadata.dataset),
    publisher: parseStringContent(metadata.publisher),
    languages: parseLanguages(metadata.language),
    identifier: parseStringContent(metadata.identifier),
    description: parseStringContent(metadata.description),
  };
}

/**
 * Parses raw context item data into the standardized ContextItem type
 *
 * @param contextItem - Raw context item data from OCHRE format
 * @returns Parsed ContextItem object
 */
function parseContextItem(contextItem: OchreContextItem): ContextItem {
  return {
    uuid: contextItem.uuid,
    publicationDateTime:
      contextItem.publicationDateTime != null ?
        new Date(contextItem.publicationDateTime)
      : null,
    number: contextItem.n,
    content: parseFakeString(contextItem.content),
  };
}

/**
 * Parses raw context data into the standardized Context type
 *
 * @param context - Raw context data from OCHRE format
 * @returns Parsed Context object
 */
export function parseContext(context: OchreContext): Context {
  const contexts =
    Array.isArray(context.context) ? context.context : [context.context];

  const returnContexts: Context = {
    nodes: contexts.map((context) => {
      const spatialUnit: Array<ContextItem> = [];
      if ("spatialUnit" in context && context.spatialUnit) {
        const contextsToParse =
          Array.isArray(context.spatialUnit) ?
            context.spatialUnit
          : [context.spatialUnit];

        for (const contextItem of contextsToParse) {
          spatialUnit.push(parseContextItem(contextItem));
        }
      }

      return {
        tree: parseContextItem(context.tree),
        project: parseContextItem(context.project),
        spatialUnit,
      };
    }),
    displayPath: context.displayPath,
  };

  return returnContexts;
}

/**
 * Parses raw license data into the standardized License type
 *
 * @param license - Raw license data from OCHRE format
 * @returns Parsed License object or null if invalid
 */
export function parseLicense(license: OchreLicense): License | null {
  if (typeof license.license === "string") {
    return null;
  }

  return {
    content: license.license.content,
    url: license.license.target,
  };
}

/**
 * Parses raw person data into the standardized Person type
 *
 * @param person - Raw person data from OCHRE format
 * @returns Parsed Person object
 */
export function parsePerson(person: OchrePerson): Person {
  return {
    uuid: person.uuid,
    publicationDateTime:
      person.publicationDateTime != null ?
        new Date(person.publicationDateTime)
      : null,
    type: person.type ?? null,
    date: person.date != null ? new Date(person.date) : null,
    identification:
      person.identification ? parseIdentification(person.identification) : null,
    content: person.content != null ? parseFakeString(person.content) : null,
  };
}

/**
 * Parses raw person data into the standardized Person type
 *
 * @param persons - Array of raw person data from OCHRE format
 * @returns Array of parsed Person objects
 */
export function parsePersons(persons: Array<OchrePerson>): Array<Person> {
  const returnPersons: Array<Person> = [];
  for (const person of persons) {
    returnPersons.push(parsePerson(person));
  }

  return returnPersons;
}

/**
 * Parses an array of raw links into standardized Link objects
 *
 * @param linkRaw - Raw OCHRE link
 * @returns Parsed Link object
 */
export function parseLink(linkRaw: OchreLink): Array<Link> {
  const links =
    "resource" in linkRaw ? linkRaw.resource
    : "concept" in linkRaw ? linkRaw.concept
    : "set" in linkRaw ? linkRaw.set
    : "tree" in linkRaw ? linkRaw.tree
    : "person" in linkRaw ? linkRaw.person
    : "bibliography" in linkRaw ? linkRaw.bibliography
    : "epigraphicUnit" in linkRaw ? linkRaw.epigraphicUnit
    : null;
  if (!links) {
    throw new Error(
      `Invalid link provided: ${JSON.stringify(linkRaw, null, 2)}`,
    );
  }

  const linksToParse = Array.isArray(links) ? links : [links];
  const returnLinks: Array<Link> = [];

  for (const link of linksToParse) {
    const returnLink: Link = {
      category:
        "resource" in linkRaw ? "resource"
        : "concept" in linkRaw ? "concept"
        : "set" in linkRaw ? "set"
        : "person" in linkRaw ? "person"
        : "tree" in linkRaw ? "tree"
        : "bibliography" in linkRaw ? "bibliography"
        : "epigraphicUnit" in linkRaw ? "epigraphicUnit"
        : null,
      content:
        "content" in link ?
          link.content != null ?
            parseFakeString(link.content)
          : null
        : null,
      uuid: link.uuid,
      type: link.type ?? null,
      identification:
        link.identification ? parseIdentification(link.identification) : null,
      image: null,
      bibliographies:
        "bibliography" in linkRaw ?
          parseBibliographies(
            Array.isArray(linkRaw.bibliography) ?
              linkRaw.bibliography
            : [linkRaw.bibliography],
          )
        : null,
      publicationDateTime:
        link.publicationDateTime != null ?
          new Date(link.publicationDateTime)
        : null,
    };

    if (
      "height" in link &&
      link.height != null &&
      link.width != null &&
      link.heightPreview != null &&
      link.widthPreview != null
    ) {
      returnLink.image = {
        isInline: link.rend === "inline",
        heightPreview: link.heightPreview,
        widthPreview: link.widthPreview,
        height: link.height,
        width: link.width,
      };
    }

    returnLinks.push(returnLink);
  }

  return returnLinks;
}

/**
 * Parses an array of raw links into standardized Link objects
 *
 * @param links - Array of raw OCHRE links
 * @returns Array of parsed Link objects
 */
export function parseLinks(links: Array<OchreLink>): Array<Link> {
  const returnLinks: Array<Link> = [];

  for (const link of links) {
    returnLinks.push(...parseLink(link));
  }

  return returnLinks;
}

/**
 * Parses raw document content into a standardized Document structure
 *
 * @param document - Raw document content in OCHRE format
 * @param language - Language code to use for content selection (defaults to "eng")
 * @returns Parsed Document object with content and footnotes
 */
export function parseDocument(
  document: OchreStringRichText | Array<OchreStringRichText>,
  language = "eng",
): Document {
  let returnString = "";
  const footnotes: Array<Footnote> = [];
  const documentWithLanguage =
    Array.isArray(document) ?
      document.find((doc) => doc.lang === language)!
    : document;

  if (
    typeof documentWithLanguage.string === "string" ||
    typeof documentWithLanguage.string === "number" ||
    typeof documentWithLanguage.string === "boolean"
  ) {
    returnString += parseEmailAndUrl(
      parseFakeString(documentWithLanguage.string),
    );
  } else {
    const documentItems =
      Array.isArray(documentWithLanguage.string) ?
        documentWithLanguage.string
      : [documentWithLanguage.string];

    for (const item of documentItems) {
      returnString += parseStringDocumentItem(item, footnotes);
    }
  }

  returnString = trimEndLineBreaks(returnString);

  return { content: returnString, footnotes };
}

/**
 * Parses raw image data into a standardized Image structure
 *
 * @param image - Raw image data in OCHRE format
 * @returns Parsed Image object or null if invalid
 */
export function parseImage(image: OchreImage): Image | null {
  return {
    publicationDateTime:
      image.publicationDateTime != null ?
        new Date(image.publicationDateTime)
      : null,
    identification:
      image.identification ? parseIdentification(image.identification) : null,
    url:
      image.href ??
      (image.htmlImgSrcPrefix == null && image.content != null ?
        parseFakeString(image.content)
      : null),
    htmlPrefix: image.htmlImgSrcPrefix ?? null,
    content:
      image.htmlImgSrcPrefix != null && image.content != null ?
        parseFakeString(image.content)
      : null,
    widthPreview: image.widthPreview ?? null,
    heightPreview: image.heightPreview ?? null,
    width: image.width ?? null,
    height: image.height ?? null,
  };
}

/**
 * Parses raw notes into standardized Note objects
 *
 * @param notes - Array of raw notes in OCHRE format
 * @param language - Language code for content selection (defaults to "eng")
 * @returns Array of parsed Note objects
 */
export function parseNotes(
  notes: Array<OchreNote>,
  language = "eng",
): Array<Note> {
  const returnNotes: Array<Note> = [];
  for (const note of notes) {
    if (typeof note === "string") {
      if (note === "") {
        continue;
      }

      returnNotes.push({
        number: -1,
        title: null,
        content: note,
      });
      continue;
    }

    let content = "";

    const notesToParse =
      Array.isArray(note.content) ? note.content : [note.content];

    let noteWithLanguage = notesToParse.find((item) => item.lang === language);
    if (!noteWithLanguage) {
      noteWithLanguage = notesToParse[0];
      if (!noteWithLanguage) {
        throw new Error(
          `Note does not have a valid content item: ${JSON.stringify(
            note,
            null,
            2,
          )}`,
        );
      }
    }

    if (
      typeof noteWithLanguage.string === "string" ||
      typeof noteWithLanguage.string === "number" ||
      typeof noteWithLanguage.string === "boolean"
    ) {
      content = parseEmailAndUrl(parseFakeString(noteWithLanguage.string));
    } else {
      content = parseEmailAndUrl(parseDocument(noteWithLanguage).content);
    }

    returnNotes.push({
      number: note.noteNo,
      title:
        noteWithLanguage.title != null ?
          parseFakeString(noteWithLanguage.title)
        : null,
      content,
    });
  }

  return returnNotes;
}

/**
 * Parses raw coordinates data into a standardized Coordinates structure
 *
 * @param coordinates - Raw coordinates data in OCHRE format
 * @returns Parsed Coordinates object
 */
export function parseCoordinates(coordinates: OchreCoordinates): Coordinates {
  return {
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    type: coordinates.coord?.coordType ?? null,
    label:
      coordinates.coord?.coordLabel != null ?
        parseFakeString(coordinates.coord.coordLabel)
      : null,
  };
}

/**
 * Parses a raw observation into a standardized Observation structure
 *
 * @param observation - Raw observation data in OCHRE format
 * @returns Parsed Observation object
 */
export function parseObservation(observation: OchreObservation): Observation {
  return {
    number: observation.observationNo,
    date: observation.date != null ? new Date(observation.date) : null,
    observers:
      observation.observers != null ?
        parseFakeString(observation.observers)
          .split(";")
          .map((observer) => observer.trim())
      : [],
    notes:
      observation.notes ?
        parseNotes(
          Array.isArray(observation.notes.note) ?
            observation.notes.note
          : [observation.notes.note],
        )
      : [],
    links:
      observation.links ?
        parseLinks(
          Array.isArray(observation.links) ?
            observation.links
          : [observation.links],
        )
      : [],
    properties:
      observation.properties ?
        parseProperties(
          Array.isArray(observation.properties.property) ?
            observation.properties.property
          : [observation.properties.property],
        )
      : [],
  };
}

/**
 * Parses an array of raw observations into standardized Observation objects
 *
 * @param observations - Array of raw observations in OCHRE format
 * @returns Array of parsed Observation objects
 */
export function parseObservations(
  observations: Array<OchreObservation>,
): Array<Observation> {
  const returnObservations: Array<Observation> = [];
  for (const observation of observations) {
    returnObservations.push(parseObservation(observation));
  }
  return returnObservations;
}

/**
 * Parses an array of raw events into standardized Event objects
 *
 * @param events - Array of raw events in OCHRE format
 * @returns Array of parsed Event objects
 */
export function parseEvents(events: Array<OchreEvent>): Array<Event> {
  const returnEvents: Array<Event> = [];
  for (const event of events) {
    returnEvents.push({
      date: event.dateTime != null ? new Date(event.dateTime) : null,
      label: parseStringContent(event.label),
      agent:
        event.agent ?
          {
            uuid: event.agent.uuid,
            content: parseFakeString(event.agent.content),
          }
        : null,
    });
  }

  return returnEvents;
}

/**
 * Parses raw properties into standardized Property objects
 *
 * @param properties - Array of raw properties in OCHRE format
 * @param language - Language code for content selection (defaults to "eng")
 * @returns Array of parsed Property objects
 */
export function parseProperties(
  properties: Array<OchreProperty>,
  language = "eng",
): Array<Property> {
  const returnProperties: Array<Property> = [];
  for (const property of properties) {
    const valuesToParse =
      "value" in property && property.value ?
        Array.isArray(property.value) ?
          property.value
        : [property.value]
      : [];

    const values: Array<PropertyValue> = valuesToParse.map((value) =>
      (
        !["string", "number", "boolean"].includes(typeof value) &&
        typeof value === "object"
      ) ?
        {
          content:
            value.slug ?
              parseFakeString(value.slug)
            : parseStringContent(value),
          type: value.type as PropertyValueType,
          category:
            value.category !== "value" ? (value.category ?? null) : null,
          uuid: value.uuid ?? null,
          publicationDateTime:
            value.publicationDateTime != null ?
              new Date(value.publicationDateTime)
            : null,
        }
      : {
          content: parseFakeString(value as FakeString),
          type: "string",
          category: "value",
          uuid: null,
          publicationDateTime: null,
        },
    );

    returnProperties.push({
      label: parseStringContent(property.label, language)
        .replace(/\s*\.{3}$/, "")
        .trim(),
      values,
      comment:
        property.comment != null ? parseFakeString(property.comment) : null,
      properties:
        property.property ?
          parseProperties(
            Array.isArray(property.property) ?
              property.property
            : [property.property],
          )
        : [],
    });
  }

  return returnProperties;
}

/**
 * Parses raw interpretations into standardized Interpretation objects
 *
 * @param interpretations - Array of raw interpretations in OCHRE format
 * @returns Array of parsed Interpretation objects
 */
export function parseInterpretations(
  interpretations: Array<OchreInterpretation>,
): Array<Interpretation> {
  const returnInterpretations: Array<Interpretation> = [];
  for (const interpretation of interpretations) {
    returnInterpretations.push({
      date: new Date(interpretation.date),
      number: interpretation.interpretationNo,
      properties:
        interpretation.properties ?
          parseProperties(
            Array.isArray(interpretation.properties.property) ?
              interpretation.properties.property
            : [interpretation.properties.property],
          )
        : [],
    });
  }

  return returnInterpretations;
}

/**
 * Parses raw image map data into a standardized ImageMap structure
 *
 * @param imageMap - Raw image map data in OCHRE format
 * @returns Parsed ImageMap object
 */
export function parseImageMap(imageMap: OchreImageMap): ImageMap {
  const returnImageMap: ImageMap = {
    area: [],
    width: imageMap.width,
    height: imageMap.height,
  };

  const imageMapAreasToParse =
    Array.isArray(imageMap.area) ? imageMap.area : [imageMap.area];
  for (const area of imageMapAreasToParse) {
    returnImageMap.area.push({
      uuid: area.uuid,
      publicationDateTime:
        area.publicationDateTime != null ?
          new Date(area.publicationDateTime)
        : null,
      type: area.type,
      title: parseFakeString(area.title),
      shape: area.shape === "rect" ? "rectangle" : "polygon",
      coords: area.coords.split(",").map((coord) => Number.parseInt(coord)),
    });
  }

  return returnImageMap;
}

/**
 * Parses raw period data into a standardized Period structure
 *
 * @param period - Raw period data in OCHRE format
 * @returns Parsed Period object
 */
export function parsePeriod(period: OchrePeriod): Period {
  return {
    uuid: period.uuid,
    category: "period",
    publicationDateTime:
      period.publicationDateTime != null ?
        new Date(period.publicationDateTime)
      : null,
    type: period.type ?? null,
    number: period.n ?? null,
    identification: parseIdentification(period.identification),
    description:
      period.description ? parseStringContent(period.description) : null,
  };
}

/**
 * Parses an array of raw periods into standardized Period objects
 *
 * @param periods - Array of raw periods in OCHRE format
 * @returns Array of parsed Period objects
 */
export function parsePeriods(periods: Array<OchrePeriod>): Array<Period> {
  const returnPeriods: Array<Period> = [];
  for (const period of periods) {
    returnPeriods.push(parsePeriod(period));
  }
  return returnPeriods;
}

/**
 * Parses raw bibliography data into a standardized Bibliography structure
 *
 * @param bibliography - Raw bibliography data in OCHRE format
 * @returns Parsed Bibliography object
 */
export function parseBibliography(
  bibliography: OchreBibliography,
): Bibliography {
  let resource: Bibliography["source"]["resource"] | null = null;
  if (bibliography.source?.resource) {
    resource = {
      uuid: bibliography.source.resource.uuid,
      publicationDateTime:
        bibliography.source.resource.publicationDateTime ?
          new Date(bibliography.source.resource.publicationDateTime)
        : null,
      type: bibliography.source.resource.type,
      identification: parseIdentification(
        bibliography.source.resource.identification,
      ),
    };
  }

  return {
    uuid: bibliography.uuid,
    category: "bibliography",
    publicationDateTime:
      bibliography.publicationDateTime != null ?
        new Date(bibliography.publicationDateTime)
      : null,
    type: bibliography.type ?? null,
    number: bibliography.n ?? null,
    identification:
      bibliography.identification ?
        parseIdentification(bibliography.identification)
      : null,
    projectIdentification:
      bibliography.project?.identification ?
        parseIdentification(bibliography.project.identification)
      : null,
    context: bibliography.context ? parseContext(bibliography.context) : null,
    citation: {
      format: bibliography.citationFormat ?? null,
      short:
        bibliography.citationFormatSpan ?
          parseFakeString(
            "default:span" in bibliography.citationFormatSpan ?
              bibliography.citationFormatSpan["default:span"].content
            : bibliography.citationFormatSpan.span.content,
          )
        : null,
      long:
        bibliography.referenceFormatDiv ?
          parseFakeString(
            "default:div" in bibliography.referenceFormatDiv ?
              bibliography.referenceFormatDiv["default:div"]["default:div"]
                .content
            : bibliography.referenceFormatDiv.div.div.content,
          )
        : null,
    },
    publicationInfo: {
      publishers:
        bibliography.publicationInfo?.publishers ?
          parsePersons(
            (
              Array.isArray(
                bibliography.publicationInfo.publishers.publishers.person,
              )
            ) ?
              bibliography.publicationInfo.publishers.publishers.person
            : [bibliography.publicationInfo.publishers.publishers.person],
          )
        : [],
      startDate:
        bibliography.publicationInfo?.startDate ?
          new Date(
            bibliography.publicationInfo.startDate.year,
            bibliography.publicationInfo.startDate.month,
            bibliography.publicationInfo.startDate.day,
          )
        : null,
    },
    entryInfo:
      bibliography.entryInfo ?
        {
          startIssue: parseFakeString(bibliography.entryInfo.startIssue),
          startVolume: parseFakeString(bibliography.entryInfo.startVolume),
        }
      : null,
    source: {
      resource,
      documentUrl:
        bibliography.sourceDocument ?
          `https://ochre.lib.uchicago.edu/ochre?uuid=${bibliography.sourceDocument.uuid}&load`
        : null,
    },
    periods:
      bibliography.periods ?
        parsePeriods(
          Array.isArray(bibliography.periods.period) ?
            bibliography.periods.period
          : [bibliography.periods.period],
        )
      : [],
    authors:
      bibliography.authors ?
        parsePersons(
          Array.isArray(bibliography.authors.person) ?
            bibliography.authors.person
          : [bibliography.authors.person],
        )
      : [],
    properties:
      bibliography.properties ?
        parseProperties(
          Array.isArray(bibliography.properties.property) ?
            bibliography.properties.property
          : [bibliography.properties.property],
        )
      : [],
  };
}

/**
 * Parses an array of raw bibliographies into standardized Bibliography objects
 *
 * @param bibliographies - Array of raw bibliographies in OCHRE format
 * @returns Array of parsed Bibliography objects
 */
export function parseBibliographies(
  bibliographies: Array<OchreBibliography>,
): Array<Bibliography> {
  const returnBibliographies: Array<Bibliography> = [];
  for (const bibliography of bibliographies) {
    returnBibliographies.push(parseBibliography(bibliography));
  }
  return returnBibliographies;
}

/**
 * Parses a raw tree structure into a standardized Tree object
 *
 * @param tree - Raw tree data in OCHRE format
 * @returns Parsed Tree object or null if invalid
 */
export function parseTree(tree: OchreTree): Tree | null {
  let creators: Array<Person> = [];
  if (tree.creators) {
    creators = parsePersons(
      Array.isArray(tree.creators.creator) ?
        tree.creators.creator
      : [tree.creators.creator],
    );
  }

  let date = null;
  if (tree.date != null) {
    date = new Date(tree.date);
  }

  let resources: Array<Resource> = [];
  let spatialUnits: Array<SpatialUnit> = [];
  let concepts: Array<Concept> = [];
  let periods: Array<Period> = [];
  let bibliographies: Array<Bibliography> = [];
  let persons: Array<Person> = [];

  if (typeof tree.items !== "string" && "resource" in tree.items) {
    resources = parseResources(
      Array.isArray(tree.items.resource) ?
        tree.items.resource
      : [tree.items.resource],
    ) as Array<Resource>;
  }
  if (typeof tree.items !== "string" && "spatialUnit" in tree.items) {
    spatialUnits = parseSpatialUnits(
      Array.isArray(tree.items.spatialUnit) ?
        tree.items.spatialUnit
      : [tree.items.spatialUnit],
    ) as Array<SpatialUnit>;
  }
  if (typeof tree.items !== "string" && "concept" in tree.items) {
    concepts = parseConcepts(
      Array.isArray(tree.items.concept) ?
        tree.items.concept
      : [tree.items.concept],
    ) as Array<Concept>;
  }
  if (typeof tree.items !== "string" && "period" in tree.items) {
    periods = parsePeriods(
      Array.isArray(tree.items.period) ?
        tree.items.period
      : [tree.items.period],
    );
  }
  if (typeof tree.items !== "string" && "bibliography" in tree.items) {
    bibliographies = parseBibliographies(
      Array.isArray(tree.items.bibliography) ?
        tree.items.bibliography
      : [tree.items.bibliography],
    );
  }
  if (typeof tree.items !== "string" && "person" in tree.items) {
    persons = parsePersons(
      Array.isArray(tree.items.person) ?
        tree.items.person
      : [tree.items.person],
    );
  }

  const returnTree: Tree = {
    uuid: tree.uuid,
    category: "tree",
    publicationDateTime: new Date(tree.publicationDateTime),
    identification: parseIdentification(tree.identification),
    creators,
    license: parseLicense(tree.availability),
    date,
    type: tree.type,
    number: tree.n,
    items: {
      resources,
      spatialUnits,
      concepts,
      periods,
      bibliographies,
      persons,
    },
    properties:
      tree.properties ?
        parseProperties(
          Array.isArray(tree.properties.property) ?
            tree.properties.property
          : [tree.properties.property],
        )
      : [],
  };

  return returnTree;
}

/**
 * Parses raw set data into a standardized Set structure
 *
 * @param set - Raw set data in OCHRE format
 * @returns Parsed Set object
 */
export function parseSet(set: OchreSet): Set {
  let resources: Array<NestedResource> = [];
  let spatialUnits: Array<NestedSpatialUnit> = [];
  let concepts: Array<NestedConcept> = [];
  let periods: Array<Period> = [];
  let bibliographies: Array<Bibliography> = [];
  let persons: Array<Person> = [];

  if (typeof set.items !== "string" && "resource" in set.items) {
    resources = parseResources(
      Array.isArray(set.items.resource) ?
        set.items.resource
      : [set.items.resource],
      true,
    ) as Array<NestedResource>;
  }
  if (typeof set.items !== "string" && "spatialUnit" in set.items) {
    spatialUnits = parseSpatialUnits(
      Array.isArray(set.items.spatialUnit) ?
        set.items.spatialUnit
      : [set.items.spatialUnit],
      true,
    );
  }
  if (typeof set.items !== "string" && "concept" in set.items) {
    concepts = parseConcepts(
      Array.isArray(set.items.concept) ?
        set.items.concept
      : [set.items.concept],
      true,
    ) as Array<NestedConcept>;
  }
  if (typeof set.items !== "string" && "period" in set.items) {
    periods = parsePeriods(
      Array.isArray(set.items.period) ? set.items.period : [set.items.period],
    );
  }
  if (typeof set.items !== "string" && "bibliography" in set.items) {
    bibliographies = parseBibliographies(
      Array.isArray(set.items.bibliography) ?
        set.items.bibliography
      : [set.items.bibliography],
    );
  }
  if (typeof set.items !== "string" && "person" in set.items) {
    persons = parsePersons(
      Array.isArray(set.items.person) ? set.items.person : [set.items.person],
    );
  }

  return {
    uuid: set.uuid,
    category: "set",
    publicationDateTime:
      set.publicationDateTime ? new Date(set.publicationDateTime) : null,
    date: set.date != null ? new Date(set.date) : null,
    license: parseLicense(set.availability),
    identification: parseIdentification(set.identification),
    isSuppressingBlanks: set.suppressBlanks ?? false,
    description:
      set.description ?
        ["string", "number", "boolean"].includes(typeof set.description) ?
          parseFakeString(set.description as FakeString)
        : parseStringContent(set.description as OchreStringContent)
      : "",
    creators:
      set.creators ?
        parsePersons(
          Array.isArray(set.creators.creator) ?
            set.creators.creator
          : [set.creators.creator],
        )
      : [],
    type: set.type,
    number: set.n,
    items: {
      resources,
      spatialUnits,
      concepts,
      periods,
      bibliographies,
      persons,
    },
  };
}

/**
 * Parses raw resource data into a standardized Resource structure
 *
 * @param resource - Raw resource data in OCHRE format
 * @returns Parsed Resource object
 */
export function parseResource(
  resource: OchreResource | OchreNestedResource,
  isNested = false,
): Resource | NestedResource {
  const returnResource: Resource = {
    uuid: resource.uuid,
    category: "resource",
    publicationDateTime:
      resource.publicationDateTime ?
        new Date(resource.publicationDateTime)
      : null,
    type: resource.type,
    number: resource.n,
    format: resource.format ?? null,
    context:
      "context" in resource && resource.context ?
        parseContext(resource.context)
      : null,
    license:
      "availability" in resource && resource.availability ?
        parseLicense(resource.availability)
      : null,
    copyright:
      "copyright" in resource && resource.copyright != null ?
        parseFakeString(resource.copyright)
      : null,
    identification: parseIdentification(resource.identification),
    date: resource.date != null ? new Date(resource.date) : null,
    image: resource.image ? parseImage(resource.image) : null,
    creators:
      resource.creators ?
        parsePersons(
          Array.isArray(resource.creators.creator) ?
            resource.creators.creator
          : [resource.creators.creator],
        )
      : [],
    notes:
      // TODO: Remove this check once the { rend: "splitNotes" } issue is fixed
      resource.notes && "note" in resource.notes ?
        parseNotes(
          Array.isArray(resource.notes.note) ?
            resource.notes.note
          : [resource.notes.note],
        )
      : [],
    description:
      resource.description ? parseStringContent(resource.description) : "",
    document:
      resource.document ? parseDocument(resource.document.content) : null,
    href: resource.href ?? null,
    imageMap: resource.imagemap ? parseImageMap(resource.imagemap) : null,
    periods:
      resource.periods ?
        parsePeriods(
          Array.isArray(resource.periods.period) ?
            resource.periods.period
          : [resource.periods.period],
        )
      : [],
    links:
      resource.links ?
        parseLinks(
          Array.isArray(resource.links) ? resource.links : [resource.links],
        )
      : [],
    reverseLinks:
      resource.reverseLinks ?
        parseLinks(
          Array.isArray(resource.reverseLinks) ?
            resource.reverseLinks
          : [resource.reverseLinks],
        )
      : [],
    properties:
      resource.properties ?
        parseProperties(
          Array.isArray(resource.properties.property) ?
            resource.properties.property
          : [resource.properties.property],
        )
      : [],
    citedBibliographies:
      resource.citedBibliography ?
        parseBibliographies(
          Array.isArray(resource.citedBibliography.reference) ?
            resource.citedBibliography.reference
          : [resource.citedBibliography.reference],
        )
      : [],
    resources:
      resource.resource ?
        (parseResources(
          Array.isArray(resource.resource) ?
            resource.resource
          : [resource.resource],
          true,
        ) as Array<NestedResource>)
      : [],
  };

  if (isNested) {
    const returnNestedResource: NestedResource & {
      publicationDateTime?: null;
      context?: null;
      license?: null;
      copyright?: null;
    } = {
      ...returnResource,
      publicationDateTime: null,
      context: null,
      license: null,
      copyright: null,
    };

    delete returnNestedResource.publicationDateTime;
    delete returnNestedResource.license;
    delete returnNestedResource.copyright;

    return returnNestedResource as NestedResource;
  }

  return returnResource;
}

/**
 * Parses raw resource data into a standardized Resource structure
 *
 * @param resources - Raw resource data in OCHRE format
 * @returns Parsed Resource object
 */
export function parseResources(
  resources: Array<OchreResource> | Array<OchreNestedResource>,
  isNested = false,
): Array<Resource> | Array<NestedResource> {
  const returnResources: Array<Resource> | Array<NestedResource> = [];
  const resourcesToParse = Array.isArray(resources) ? resources : [resources];

  for (const resource of resourcesToParse) {
    returnResources.push(parseResource(resource, isNested) as Resource);
  }

  return returnResources;
}

/**
 * Parses raw spatial units into standardized SpatialUnit or NestedSpatialUnit objects
 *
 * @param spatialUnit - Raw spatial unit in OCHRE format
 * @param isNested - Whether to parse as nested spatial units
 * @returns Parsed SpatialUnit or NestedSpatialUnit object
 */
export function parseSpatialUnit(
  spatialUnit: OchreSpatialUnit | OchreNestedSpatialUnit,
  isNested = false,
): SpatialUnit | NestedSpatialUnit {
  const returnSpatialUnit: SpatialUnit = {
    uuid: spatialUnit.uuid,
    category: "spatialUnit",
    publicationDateTime:
      spatialUnit.publicationDateTime != null ?
        new Date(spatialUnit.publicationDateTime)
      : null,
    type: spatialUnit.type,
    number: spatialUnit.n,
    context:
      "context" in spatialUnit && spatialUnit.context ?
        parseContext(spatialUnit.context)
      : null,
    license:
      "availability" in spatialUnit && spatialUnit.availability ?
        parseLicense(spatialUnit.availability)
      : null,
    identification: parseIdentification(spatialUnit.identification),
    image: spatialUnit.image ? parseImage(spatialUnit.image) : null,
    description:
      spatialUnit.description ?
        (
          ["string", "number", "boolean"].includes(
            typeof spatialUnit.description,
          )
        ) ?
          parseFakeString(spatialUnit.description as FakeString)
        : parseStringContent(spatialUnit.description as OchreStringContent)
      : "",
    coordinates:
      spatialUnit.coordinates ?
        parseCoordinates(spatialUnit.coordinates)
      : null,
    observations:
      "observations" in spatialUnit && spatialUnit.observations ?
        parseObservations(
          Array.isArray(spatialUnit.observations.observation) ?
            spatialUnit.observations.observation
          : [spatialUnit.observations.observation],
        )
      : spatialUnit.observation ? [parseObservation(spatialUnit.observation)]
      : [],
    events:
      "events" in spatialUnit && spatialUnit.events ?
        parseEvents(
          Array.isArray(spatialUnit.events.event) ?
            spatialUnit.events.event
          : [spatialUnit.events.event],
        )
      : [],
  };

  if (isNested) {
    const returnNestedSpatialUnit: NestedSpatialUnit & {
      publicationDateTime?: null;
      license?: null;
    } = {
      ...returnSpatialUnit,
      publicationDateTime: null,
      license: null,
      properties:
        "properties" in spatialUnit && spatialUnit.properties ?
          parseProperties(
            Array.isArray(spatialUnit.properties.property) ?
              spatialUnit.properties.property
            : [spatialUnit.properties.property],
          )
        : [],
    };

    delete returnNestedSpatialUnit.publicationDateTime;
    delete returnNestedSpatialUnit.license;

    return returnNestedSpatialUnit as NestedSpatialUnit;
  }

  return returnSpatialUnit;
}

/**
 * Parses an array of raw spatial units into standardized SpatialUnit or NestedSpatialUnit objects
 *
 * @param spatialUnits - Array of raw spatial units in OCHRE format
 * @param isNested - Whether to parse as nested spatial units
 * @returns Array of parsed SpatialUnit or NestedSpatialUnit objects
 */
export function parseSpatialUnits<T extends boolean>(
  spatialUnits: Array<
    T extends true ? OchreNestedSpatialUnit : OchreSpatialUnit
  >,
  isNested: T = false as T,
): Array<T extends true ? NestedSpatialUnit : SpatialUnit> {
  const returnSpatialUnits: Array<
    T extends true ? NestedSpatialUnit : SpatialUnit
  > = [];
  const spatialUnitsToParse =
    Array.isArray(spatialUnits) ? spatialUnits : [spatialUnits];

  for (const spatialUnit of spatialUnitsToParse) {
    returnSpatialUnits.push(
      parseSpatialUnit(spatialUnit, isNested) as T extends true ?
        NestedSpatialUnit
      : SpatialUnit,
    );
  }

  return returnSpatialUnits;
}

/**
 * Parses a raw concept into a standardized Concept or NestedConcept object
 *
 * @param concept - Raw concept data in OCHRE format
 * @param isNested - Whether to parse as a nested concept
 * @returns Parsed Concept or NestedConcept object
 */
export function parseConcept(
  concept: OchreConcept | OchreNestedConcept,
  isNested = false,
): Concept | NestedConcept {
  const returnConcept: Concept | NestedConcept = {
    uuid: concept.uuid,
    category: "concept",
    publicationDateTime:
      concept.publicationDateTime ?
        new Date(concept.publicationDateTime)
      : null,
    number: concept.n,
    license:
      "availability" in concept && concept.availability ?
        parseLicense(concept.availability)
      : null,
    context:
      "context" in concept && concept.context ?
        parseContext(concept.context)
      : null,
    identification: parseIdentification(concept.identification),
    interpretations: parseInterpretations(
      Array.isArray(concept.interpretations.interpretation) ?
        concept.interpretations.interpretation
      : [concept.interpretations.interpretation],
    ),
  };

  if (isNested) {
    const returnNestedConcept: NestedConcept & {
      publicationDateTime?: null;
      context?: null;
      license?: null;
    } = {
      ...returnConcept,
      publicationDateTime: null,
      context: null,
      license: null,
    };

    delete returnNestedConcept.publicationDateTime;
    delete returnNestedConcept.license;

    return returnNestedConcept as NestedConcept;
  }

  return returnConcept;
}

/**
 * Parses raw webpage resources into standardized WebElement or Webpage objects
 *
 * @param webpageResources - Array of raw webpage resources in OCHRE format
 * @param type - Type of resource to parse ("element" or "page")
 * @returns Array of parsed WebElement or Webpage objects
 */
const parseWebpageResources = async <T extends "element" | "page">(
  webpageResources: Array<OchreResource>,
  type: T,
): Promise<Array<T extends "element" ? WebElement : Webpage>> => {
  const returnElements: Array<T extends "element" ? WebElement : Webpage> = [];

  for (const resource of webpageResources) {
    const resourceProperties =
      resource.properties ?
        parseProperties(
          Array.isArray(resource.properties.property) ?
            resource.properties.property
          : [resource.properties.property],
        )
      : [];

    const resourceProperty = resourceProperties.find(
      (property) =>
        property.label === "presentation" &&
        property.values[0]!.content === type,
    );
    if (!resourceProperty) continue;

    if (type === "element") {
      const element = await parseWebElement(
        resource,
        resourceProperty.properties,
      );

      returnElements.push(
        element as T extends "element" ? WebElement : Webpage,
      );
    } else {
      const webpage = await parseWebpage(resource);
      if (webpage) {
        returnElements.push(
          webpage as T extends "element" ? WebElement : Webpage,
        );
      }
    }
  }

  return returnElements;
};

/**
 * Parses raw concept data into standardized Concept or NestedConcept objects
 *
 * @param concepts - Array of raw concept data in OCHRE format
 * @param isNested - Whether to parse as nested concepts
 * @returns Array of parsed Concept or NestedConcept objects
 */
export function parseConcepts(
  concepts: Array<OchreConcept> | Array<OchreNestedConcept>,
  isNested = false,
): Array<Concept> | Array<NestedConcept> {
  const returnConcepts: Array<Concept> | Array<NestedConcept> = [];
  const conceptsToParse = Array.isArray(concepts) ? concepts : [concepts];

  for (const concept of conceptsToParse) {
    returnConcepts.push(parseConcept(concept, isNested) as Concept);
  }

  return returnConcepts;
}

/**
 * Parses raw web element properties into a standardized WebElementComponent structure
 *
 * @param componentProperty - Raw component property data in OCHRE format
 * @param elementResource - Raw element resource data in OCHRE format
 * @returns Parsed WebElementComponent object
 */
async function parseWebElementProperties(
  componentProperty: Property,
  elementResource: OchreResource,
): Promise<WebElementComponent> {
  const componentName = componentSchema.parse(
    componentProperty.values[0]!.content,
  );

  const properties: Record<string, unknown> = {
    component: componentName,
  };

  const links =
    elementResource.links ?
      parseLinks(
        Array.isArray(elementResource.links) ?
          elementResource.links
        : [elementResource.links],
      )
    : [];
  const imageLinks = links.filter((link) => link.type === "image");

  let document: Document | null =
    elementResource.document ?
      parseDocument(elementResource.document.content)
    : null;
  if (document === null) {
    const documentLink = links.find((link) => link.type === "internalDocument");
    if (documentLink) {
      const documentResource = await fetchResource(documentLink.uuid);
      if (documentResource === null) {
        throw new Error("Failed to fetch OCHRE data");
      }

      document = documentResource.resource.document;
    }
  }

  switch (componentName) {
    case "annotated-document": {
      if (!document) {
        throw new Error(
          `Document not found for the following component: “${componentName}”`,
        );
      }

      properties.document = document;
      break;
    }
    case "annotated-image": {
      if (imageLinks.length === 0) {
        throw new Error(
          `Image link not found for the following component: “${componentName}”`,
        );
      }

      const isSearchable =
        getPropertyValueByLabel(
          componentProperty.properties,
          "is-searchable",
        ) === "Yes";

      properties.imageUuid = imageLinks[0]!.uuid;
      properties.isSearchable = isSearchable;
      break;
    }
    case "bibliography": {
      const bibliographyLink = links.find(
        (link) => link.category === "bibliography",
      );
      if (!bibliographyLink) {
        throw new Error(
          `Bibliography link not found for the following component: “${componentName}”`,
        );
      }

      if (!bibliographyLink.bibliographies) {
        throw new Error(
          `Bibliography not found for the following component: “${componentName}”`,
        );
      }

      let layout = getPropertyValueByLabel(
        componentProperty.properties,
        "layout",
      );
      if (layout === null) {
        layout = "long";
      }

      properties.bibliographies = bibliographyLink.bibliographies;
      properties.layout = layout;

      break;
    }
    case "blog": {
      const blogLink = links.find((link) => link.category === "tree");
      if (!blogLink) {
        throw new Error(
          `Blog link not found for the following component: “${componentName}”`,
        );
      }

      properties.blogId = blogLink.uuid;
      break;
    }
    case "button": {
      let isExternal = false;
      let href = getPropertyValueByLabel(
        componentProperty.properties,
        "navigate-to",
      );
      if (href === null) {
        href = getPropertyValueByLabel(componentProperty.properties, "link-to");
        if (href === null) {
          throw new Error(
            `Properties “navigate-to” or “link-to” not found for the following component: “${componentName}”`,
          );
        } else {
          isExternal = true;
        }
      }

      properties.href = href;
      properties.isExternal = isExternal;
      properties.label =
        (
          ["string", "number", "boolean"].includes(
            typeof elementResource.identification.label,
          )
        ) ?
          parseFakeString(elementResource.identification.label as FakeString)
        : parseStringContent(
            elementResource.identification.label as OchreStringContent,
          );
      break;
    }
    case "collection": {
      let variant = getPropertyValueByLabel(
        componentProperty.properties,
        "variant",
      );
      if (variant === null) {
        variant = "full";
      }

      let layout = getPropertyValueByLabel(
        componentProperty.properties,
        "layout",
      );
      if (layout === null) {
        layout = "image-start";
      }

      const collectionLink = links.find((link) => link.category === "set");
      if (!collectionLink) {
        throw new Error(
          `Collection link not found for the following component: “${componentName}”`,
        );
      }

      properties.variant = variant;
      properties.layout = layout;
      properties.collectionId = collectionLink.uuid;
      break;
    }
    case "iiif-viewer": {
      const manifestLink = links.find((link) => link.type === "IIIF");
      if (!manifestLink) {
        throw new Error(
          `Manifest link not found for the following component: “${componentName}”`,
        );
      }

      properties.IIIFId = manifestLink.uuid;
      break;
    }
    case "image": {
      if (imageLinks.length === 0) {
        throw new Error(
          `Image link not found for the following component: “${componentName}”`,
        );
      }

      const images: Array<WebImage> = [];
      for (const imageLink of imageLinks) {
        images.push({
          url: `https://ochre.lib.uchicago.edu/ochre?uuid=${imageLink.uuid}&load`,
          label: imageLink.identification?.label ?? null,
          width: imageLink.image?.width ?? 0,
          height: imageLink.image?.height ?? 0,
        });
      }

      let variant = getPropertyValueByLabel(
        componentProperty.properties,
        "variant",
      );
      if (variant === null) {
        variant = "default";
      }

      let captionLayout = getPropertyValueByLabel(
        componentProperty.properties,
        "caption-layout",
      );
      if (captionLayout === null) {
        captionLayout = "bottom";
      }

      let imageQuality = getPropertyValueByLabel(
        componentProperty.properties,
        "image-quality",
      );
      if (imageQuality === null) {
        imageQuality = "high";
      }

      let captionSource = getPropertyValueByLabel(
        componentProperty.properties,
        "caption-source",
      );
      if (captionSource === null) {
        captionSource = "name";
      }

      let altTextSource = getPropertyValueByLabel(
        componentProperty.properties,
        "alt-text-source",
      );
      if (altTextSource === null) {
        altTextSource = "name";
      }

      let carouselOptions: {
        secondsPerImage: number | null;
        isFullWidth: boolean | null;
        isFullHeight: boolean | null;
      } | null = null;
      if (images.length > 1) {
        const variantProperty = getPropertyByLabel(
          componentProperty.properties,
          "variant",
        );

        let secondsPerImage = 5;
        let isFullWidth = false;
        let isFullHeight = false;

        if (
          variantProperty &&
          variantProperty.values[0]!.content === "carousel"
        ) {
          const secondsPerImageProperty = getPropertyValueByLabel(
            variantProperty.properties,
            "seconds-per-image",
          );
          if (secondsPerImageProperty !== null) {
            secondsPerImage = Number.parseFloat(secondsPerImageProperty);
          }

          const isFullWidthProperty = getPropertyValueByLabel(
            variantProperty.properties,
            "is-full-width",
          );
          if (isFullWidthProperty !== null) {
            isFullWidth = isFullWidthProperty === "Yes";
          }

          const isFullHeightProperty = getPropertyValueByLabel(
            variantProperty.properties,
            "is-full-height",
          );
          if (isFullHeightProperty !== null) {
            isFullHeight = isFullHeightProperty === "Yes";
          }
        }

        carouselOptions = {
          secondsPerImage,
          isFullWidth,
          isFullHeight,
        };
      }

      properties.images = images;
      properties.variant = variant;
      properties.carouselOptions = carouselOptions;
      properties.imageQuality = imageQuality;
      properties.captionLayout = captionLayout;
      properties.captionSource = captionSource;
      properties.altTextSource = altTextSource;
      break;
    }
    case "image-gallery": {
      const galleryLink = links.find((link) => link.category === "tree");
      if (!galleryLink) {
        throw new Error(
          `Image gallery link not found for the following component: “${componentName}”`,
        );
      }

      const isSearchable =
        getPropertyValueByLabel(
          componentProperty.properties,
          "is-searchable",
        ) === "Yes";

      properties.galleryId = galleryLink.uuid;
      properties.isSearchable = isSearchable;
      break;
    }
    case "item-gallery": {
      const galleryLink = links.find((link) => link.category === "tree");
      if (!galleryLink) {
        throw new Error(
          `Item gallery link not found for the following component: “${componentName}”`,
        );
      }

      const isSearchable =
        getPropertyValueByLabel(
          componentProperty.properties,
          "is-searchable",
        ) === "Yes";

      properties.galleryId = galleryLink.uuid;
      properties.isSearchable = isSearchable;
      break;
    }
    case "n-columns": {
      const subElements =
        elementResource.resource ?
          await parseWebpageResources(
            Array.isArray(elementResource.resource) ?
              elementResource.resource
            : [elementResource.resource],
            "element",
          )
        : [];

      properties.columns = subElements;

      break;
    }
    case "n-rows": {
      const subElements =
        elementResource.resource ?
          await parseWebpageResources(
            Array.isArray(elementResource.resource) ?
              elementResource.resource
            : [elementResource.resource],
            "element",
          )
        : [];

      properties.rows = subElements;
      break;
    }
    case "network-graph": {
      // TODO: Implement network graph
      break;
    }
    case "table": {
      const tableLink = links.find((link) => link.category === "set");
      if (!tableLink) {
        throw new Error(
          `Table link not found for the following component: “${componentName}”`,
        );
      }

      properties.tableId = tableLink.uuid;
      break;
    }
    case "text": {
      if (!document) {
        throw new Error(
          `Document not found for the following component: “${componentName}”`,
        );
      }

      let variant = getPropertyValueByLabel(
        componentProperty.properties,
        "variant",
      );
      if (variant === null) {
        variant = "block";
      }

      properties.variant = variant;
      properties.content = document.content;
      break;
    }
    case "text-image": {
      if (!document) {
        throw new Error(
          `Document not found for the following component: “${componentName}”`,
        );
      }

      let variant = getPropertyValueByLabel(
        componentProperty.properties,
        "variant",
      );
      if (variant === null) {
        variant = "block";
      }

      let layout = getPropertyValueByLabel(
        componentProperty.properties,
        "layout",
      );
      if (layout === null) {
        layout = "image-start";
      }

      let captionLayout = getPropertyValueByLabel(
        componentProperty.properties,
        "caption-layout",
      );
      if (captionLayout === null) {
        captionLayout = "bottom";
      }

      const imageLink = links.find(
        (link) => link.type === "image" || link.type === "IIIF",
      );
      if (!imageLink) {
        throw new Error(
          `Image link not found for the following component: “${componentName}”: ${JSON.stringify(
            links,
          )}`,
        );
      }

      let imageQuality = getPropertyValueByLabel(
        componentProperty.properties,
        "image-quality",
      );
      if (imageQuality === null) {
        imageQuality = "high";
      }

      let captionSource = getPropertyValueByLabel(
        componentProperty.properties,
        "caption-source",
      );
      if (captionSource === null) {
        captionSource = "name";
      }

      let altTextSource = getPropertyValueByLabel(
        componentProperty.properties,
        "alt-text-source",
      );
      if (altTextSource === null) {
        altTextSource = "name";
      }

      properties.variant = variant;
      properties.image = {
        url: `https://ochre.lib.uchicago.edu/ochre?uuid=${imageLink.uuid}&preview`,
        label: imageLink.identification?.label ?? null,
        width: imageLink.image?.width ?? 0,
        height: imageLink.image?.height ?? 0,
      };
      properties.imageQuality = imageQuality;
      properties.layout = layout;
      properties.captionSource = captionSource;
      properties.captionLayout = captionLayout;
      properties.altTextSource = altTextSource;
      properties.content = document.content;
      break;
    }
    case "timeline": {
      const timelineLink = links.find((link) => link.category === "tree");
      if (!timelineLink) {
        throw new Error(
          `Timeline link not found for the following component: “${componentName}”`,
        );
      }

      properties.timelineId = timelineLink.uuid;
      break;
    }
    case "video": {
      const videoLink = links.find((link) => link.type === "video");
      if (!videoLink) {
        throw new Error(
          `Video link not found for the following component: “${componentName}”`,
        );
      }

      let isChaptersDislayed = getPropertyValueByLabel(
        componentProperty.properties,
        "chapters-displayed",
      );
      if (isChaptersDislayed == null) {
        isChaptersDislayed = "Yes";
      }

      properties.videoId = videoLink.uuid;
      properties.isChaptersDislayed = isChaptersDislayed === "Yes";
      break;
    }
    default: {
      console.warn(
        `Invalid or non-implemented component name “${componentName as string}” for the following element: “${parseStringContent(
          elementResource.identification.label as OchreStringContent,
        )}”`,
      );
      break;
    }
  }

  return properties as WebElementComponent;
}

/**
 * Parses raw web element data into a standardized WebElement structure
 *
 * @param elementResource - Raw element resource data in OCHRE format
 * @param elementProperties - Array of raw element properties in OCHRE format
 * @returns Parsed WebElement object
 */
async function parseWebElement(
  elementResource: OchreResource,
  elementProperties: Array<Property>,
): Promise<WebElement> {
  const identification = parseIdentification(elementResource.identification);

  const componentProperty = elementProperties.find(
    (property) => property.label === "component",
  );
  if (!componentProperty) {
    throw new Error(
      `Component for element “${identification.label}” not found`,
    );
  }

  const properties = await parseWebElementProperties(
    componentProperty,
    elementResource,
  );

  const elementResourceProperties =
    elementResource.properties?.property ?
      parseProperties(
        Array.isArray(elementResource.properties.property) ?
          elementResource.properties.property
        : [elementResource.properties.property],
      )
    : [];

  const cssProperties =
    elementResourceProperties.find(
      (property) =>
        property.label === "presentation" &&
        property.values[0]!.content === "css",
    )?.properties ?? [];

  const cssStyles: Array<Style> = [];
  for (const property of cssProperties) {
    const cssStyle = property.values[0]!.content;
    cssStyles.push({ label: property.label, value: cssStyle });
  }

  const titleProperties = elementResourceProperties.find(
    (property) =>
      property.label === "presentation" &&
      property.values[0]!.content === "title",
  )?.properties;

  let variant: "default" | "simple" = "default";
  let isNameDisplayed = false;
  let isDescriptionDisplayed = false;
  let isDateDisplayed = false;
  let isCreatorsDisplayed = false;

  if (titleProperties) {
    const titleVariant = getPropertyValueByLabel(titleProperties, "variant");
    if (titleVariant) {
      variant = titleVariant as "default" | "simple";
    }

    const titleShow = titleProperties.filter(
      (property) => property.label === "display",
    );
    if (titleShow.length > 0) {
      isNameDisplayed = titleShow.some(
        (property) => property.values[0]!.content === "name",
      );
      isDescriptionDisplayed = titleShow.some(
        (property) => property.values[0]!.content === "description",
      );
      isDateDisplayed = titleShow.some(
        (property) => property.values[0]!.content === "date",
      );
      isCreatorsDisplayed = titleShow.some(
        (property) => property.values[0]!.content === "creators",
      );
    }
  }

  return {
    uuid: elementResource.uuid,
    title: {
      label: identification.label,
      variant,
      properties: {
        isNameDisplayed,
        isDescriptionDisplayed,
        isDateDisplayed,
        isCreatorsDisplayed,
      },
    },
    cssStyles,
    ...properties,
  };
}

/**
 * Parses raw webpage data into a standardized Webpage structure
 *
 * @param webpageResource - Raw webpage resource data in OCHRE format
 * @returns Parsed Webpage object
 */
async function parseWebpage(
  webpageResource: OchreResource,
): Promise<Webpage | null> {
  const webpageProperties =
    webpageResource.properties ?
      parseProperties(
        Array.isArray(webpageResource.properties.property) ?
          webpageResource.properties.property
        : [webpageResource.properties.property],
      )
    : [];

  if (
    webpageProperties.length === 0 ||
    webpageProperties.find((property) => property.label === "presentation")
      ?.values[0]?.content !== "page"
  ) {
    // Skip global elements
    return null;
  }

  const identification = parseIdentification(webpageResource.identification);

  // TODO: Remove this "/" check once OCHRE is updated
  const slug = webpageResource.slug === "/" ? "" : webpageResource.slug;
  if (slug === undefined) {
    throw new Error(`Slug not found for page “${identification.label}”`);
  }

  const links =
    webpageResource.links ?
      parseLinks(
        Array.isArray(webpageResource.links) ?
          webpageResource.links
        : [webpageResource.links],
      )
    : [];
  const imageLink = links.find(
    (link) => link.type === "image" || link.type === "IIIF",
  );

  const elements =
    webpageResource.resource ?
      await parseWebpageResources(
        Array.isArray(webpageResource.resource) ?
          webpageResource.resource
        : [webpageResource.resource],
        "element",
      )
    : [];

  const webpages =
    webpageResource.resource ?
      await parseWebpageResources(
        Array.isArray(webpageResource.resource) ?
          webpageResource.resource
        : [webpageResource.resource],
        "page",
      )
    : [];

  let displayedInHeader = true;
  let width: "default" | "full" | "large" | "narrow" = "default";
  let variant: "default" | "no-background" = "default";

  const webpageSubProperties = webpageProperties.find(
    (property) =>
      property.label === "presentation" &&
      property.values[0]?.content === "page",
  )?.properties;

  if (webpageSubProperties) {
    const headerProperty = webpageSubProperties.find(
      (property) => property.label === "header",
    )?.values[0];
    if (headerProperty) {
      displayedInHeader = headerProperty.content === "Yes";
    }

    const widthProperty = webpageSubProperties.find(
      (property) => property.label === "width",
    )?.values[0];
    if (widthProperty) {
      width = widthProperty.content as "default" | "full" | "large" | "narrow";
    }

    const variantProperty = webpageSubProperties.find(
      (property) => property.label === "variant",
    )?.values[0];
    if (variantProperty) {
      variant = variantProperty.content as "default" | "no-background";
    }
  }

  const cssStyleSubProperties = webpageProperties.find(
    (property) =>
      property.label === "presentation" &&
      property.values[0]?.content === "css",
  )?.properties;
  const cssStyles: Array<Style> = [];
  if (cssStyleSubProperties) {
    for (const property of cssStyleSubProperties) {
      cssStyles.push({
        label: property.label,
        value: property.values[0]!.content,
      });
    }
  }

  return {
    title: identification.label,
    slug,
    elements,
    properties: {
      displayedInHeader,
      width,
      variant,
      backgroundImageUrl:
        imageLink ?
          `https://ochre.lib.uchicago.edu/ochre?uuid=${imageLink.uuid}&load`
        : null,
      cssStyles,
    },
    webpages,
  };
}

/**
 * Parses raw webpage resources into an array of Webpage objects
 *
 * @param webpageResources - Array of raw webpage resources in OCHRE format
 * @returns Array of parsed Webpage objects
 */
async function parseWebpages(
  webpageResources: Array<OchreResource>,
): Promise<Array<Webpage>> {
  const returnPages: Array<Webpage> = [];
  const pagesToParse =
    Array.isArray(webpageResources) ? webpageResources : [webpageResources];

  for (const page of pagesToParse) {
    const webpage = await parseWebpage(page);
    if (webpage) {
      returnPages.push(webpage);
    }
  }

  return returnPages;
}

/**
 * Parses raw website properties into a standardized WebsiteProperties structure
 *
 * @param properties - Array of raw website properties in OCHRE format
 * @returns Parsed WebsiteProperties object
 */
function parseWebsiteProperties(
  properties: Array<OchreProperty>,
): WebsiteProperties {
  const mainProperties = parseProperties(properties);
  const websiteProperties = mainProperties.find(
    (property) => property.label === "presentation",
  )?.properties;
  if (!websiteProperties) {
    throw new Error("Presentation property not found");
  }

  const type = websiteProperties.find((property) => property.label === "webUI")
    ?.values[0]?.content;
  if (type == null) {
    throw new Error("Website type not found");
  }

  const status = websiteProperties.find(
    (property) => property.label === "status",
  )?.values[0]?.content;
  if (status == null) {
    throw new Error("Website status not found");
  }

  let privacy = websiteProperties.find(
    (property) => property.label === "privacy",
  )?.values[0]?.content;
  if (privacy == null) {
    privacy = "public";
  }

  const result = websiteSchema.safeParse({
    type,
    status,
    privacy,
  });
  if (!result.success) {
    throw new Error(`Invalid website properties: ${result.error.message}`);
  }

  const logoUuid =
    websiteProperties.find((property) => property.label === "logo")?.values[0]
      ?.uuid ?? null;

  let isHeaderDisplayed = true;
  let headerVariant: "default" | "floating" = "default";
  let headerAlignment: "start" | "center" | "end" = "start";
  let isHeaderProjectDisplayed = true;
  let isFooterDisplayed = true;
  let isSidebarDisplayed = false;
  let searchCollectionUuid: string | null = null;
  let supportsThemeToggle = true;

  const headerProperty = websiteProperties.find(
    (property) => property.label === "navbar-visible",
  )?.values[0];
  if (headerProperty) {
    isHeaderDisplayed = headerProperty.content === "Yes";
  }

  const headerVariantProperty = websiteProperties.find(
    (property) => property.label === "navbar-variant",
  )?.values[0];
  if (headerVariantProperty) {
    headerVariant = headerVariantProperty.content as "default" | "floating";
  }

  const headerAlignmentProperty = websiteProperties.find(
    (property) => property.label === "navbar-alignment",
  )?.values[0];
  if (headerAlignmentProperty) {
    headerAlignment = headerAlignmentProperty.content as
      | "start"
      | "center"
      | "end";
  }

  const isHeaderProjectDisplayedProperty = websiteProperties.find(
    (property) => property.label === "navbar-project-visible",
  )?.values[0];
  if (isHeaderProjectDisplayedProperty) {
    isHeaderProjectDisplayed =
      isHeaderProjectDisplayedProperty.content === "Yes";
  }

  const footerProperty = websiteProperties.find(
    (property) => property.label === "footer-visible",
  )?.values[0];
  if (footerProperty) {
    isFooterDisplayed = footerProperty.content === "Yes";
  }

  const sidebarProperty = websiteProperties.find(
    (property) => property.label === "sidebar-visible",
  )?.values[0];
  if (sidebarProperty) {
    isSidebarDisplayed = sidebarProperty.content === "Yes";
  }

  const collectionSearchProperty = websiteProperties.find(
    (property) => property.label === "search-collection",
  )?.values[0];
  if (collectionSearchProperty) {
    searchCollectionUuid = collectionSearchProperty.uuid;
  }

  const supportsThemeToggleProperty = websiteProperties.find(
    (property) => property.label === "supports-theme-toggle",
  )?.values[0];
  if (supportsThemeToggleProperty) {
    supportsThemeToggle = supportsThemeToggleProperty.content === "Yes";
  }

  const {
    type: validatedType,
    status: validatedStatus,
    privacy: validatedPrivacy,
  } = result.data;

  return {
    type: validatedType,
    privacy: validatedPrivacy,
    status: validatedStatus,
    isHeaderDisplayed,
    headerVariant,
    headerAlignment,
    isHeaderProjectDisplayed,
    isFooterDisplayed,
    isSidebarDisplayed,
    supportsThemeToggle,
    searchCollectionUuid,
    logoUrl:
      logoUuid !== null ?
        `https://ochre.lib.uchicago.edu/ochre?uuid=${logoUuid}&load`
      : null,
  };
}

export async function parseWebsite(
  websiteTree: OchreTree,
  projectName: FakeString,
  website: FakeString | null,
): Promise<Website> {
  if (!websiteTree.properties) {
    throw new Error("Website properties not found");
  }

  const properties = parseWebsiteProperties(
    Array.isArray(websiteTree.properties.property) ?
      websiteTree.properties.property
    : [websiteTree.properties.property],
  );

  if (
    typeof websiteTree.items === "string" ||
    !("resource" in websiteTree.items)
  ) {
    throw new Error("Website pages not found");
  }

  const resources =
    Array.isArray(websiteTree.items.resource) ?
      websiteTree.items.resource
    : [websiteTree.items.resource];

  const pages = await parseWebpages(resources);

  let sidebar: Website["sidebar"] | null = null;
  const sidebarElements: Array<WebElement> = [];
  const sidebarTitle: WebElement["title"] = {
    label: "",
    variant: "default",
    properties: {
      isNameDisplayed: false,
      isDescriptionDisplayed: false,
      isDateDisplayed: false,
      isCreatorsDisplayed: false,
    },
  };
  let sidebarLayout: "start" | "end" = "start";
  const sidebarCssStyles: Array<Style> = [];

  const sidebarResource = resources.find((resource) => {
    const resourceProperties =
      resource.properties ?
        parseProperties(
          Array.isArray(resource.properties.property) ?
            resource.properties.property
          : [resource.properties.property],
        )
      : [];
    return resourceProperties.some(
      (property) =>
        property.label === "presentation" &&
        property.values[0]?.content === "element" &&
        property.properties[0]?.label === "component" &&
        property.properties[0]?.values[0]?.content === "sidebar",
    );
  });
  if (sidebarResource) {
    sidebarTitle.label =
      (
        typeof sidebarResource.identification.label === "string" ||
        typeof sidebarResource.identification.label === "number" ||
        typeof sidebarResource.identification.label === "boolean"
      ) ?
        parseFakeString(sidebarResource.identification.label)
      : parseStringContent(sidebarResource.identification.label);

    const sidebarProperties =
      sidebarResource.properties ?
        parseProperties(
          Array.isArray(sidebarResource.properties.property) ?
            sidebarResource.properties.property
          : [sidebarResource.properties.property],
        )
      : [];

    const sidebarLayoutProperty = sidebarProperties.find(
      (property) => property.label === "layout",
    );
    if (sidebarLayoutProperty) {
      sidebarLayout = sidebarLayoutProperty.values[0]!.content as
        | "start"
        | "end";
    }

    const cssProperties =
      sidebarProperties.find(
        (property) =>
          property.label === "presentation" &&
          property.values[0]!.content === "css",
      )?.properties ?? [];

    for (const property of cssProperties) {
      const cssStyle = property.values[0]!.content;
      sidebarCssStyles.push({ label: property.label, value: cssStyle });
    }

    const titleProperties = sidebarProperties.find(
      (property) =>
        property.label === "presentation" &&
        property.values[0]!.content === "title",
    )?.properties;

    if (titleProperties) {
      const titleVariant = getPropertyValueByLabel(titleProperties, "variant");
      if (titleVariant) {
        sidebarTitle.variant = titleVariant as "default" | "simple";
      }

      const titleShow = titleProperties.filter(
        (property) => property.label === "display",
      );
      if (titleShow.length > 0) {
        sidebarTitle.properties.isNameDisplayed = titleShow.some(
          (property) => property.values[0]!.content === "name",
        );
        sidebarTitle.properties.isDescriptionDisplayed = titleShow.some(
          (property) => property.values[0]!.content === "description",
        );
        sidebarTitle.properties.isDateDisplayed = titleShow.some(
          (property) => property.values[0]!.content === "date",
        );
        sidebarTitle.properties.isCreatorsDisplayed = titleShow.some(
          (property) => property.values[0]!.content === "creators",
        );
      }
    }

    const sidebarResources =
      sidebarResource.resource ?
        Array.isArray(sidebarResource.resource) ?
          sidebarResource.resource
        : [sidebarResource.resource]
      : [];

    for (const resource of sidebarResources) {
      const sidebarResourceProperties =
        resource.properties ?
          parseProperties(
            Array.isArray(resource.properties.property) ?
              resource.properties.property
            : [resource.properties.property],
          )
        : [];

      const element = await parseWebElement(
        resource,
        sidebarResourceProperties.find(
          (property) =>
            property.label === "presentation" &&
            property.values[0]?.content === "element",
        )?.properties ?? [],
      );
      sidebarElements.push(element);
    }
  }

  if (sidebarElements.length > 0) {
    sidebar = {
      elements: sidebarElements,
      title: sidebarTitle,
      layout: sidebarLayout,
      cssStyles: sidebarCssStyles,
    };
  }

  return {
    uuid: websiteTree.uuid,
    publicationDateTime:
      websiteTree.publicationDateTime ?
        new Date(websiteTree.publicationDateTime)
      : null,
    identification: parseIdentification(websiteTree.identification),
    project: {
      name: parseFakeString(projectName),
      website: website !== null ? parseFakeString(website) : null,
    },
    creators:
      websiteTree.creators ?
        parsePersons(
          Array.isArray(websiteTree.creators.creator) ?
            websiteTree.creators.creator
          : [websiteTree.creators.creator],
        )
      : [],
    license: parseLicense(websiteTree.availability),
    pages,
    sidebar,
    properties,
  };
}
