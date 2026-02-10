import { UTCDate } from "@date-fns/utc";
import { parseISO, set } from "date-fns";
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
  OchreLevelContext,
  OchreLicense,
  OchreLink,
  OchreMetadata,
  OchreNote,
  OchreObservation,
  OchrePeriod,
  OchrePerson,
  OchreProperty,
  OchrePropertyValue,
  OchrePropertyVariable,
  OchreResource,
  OchreSection,
  OchreSet,
  OchreSpatialUnit,
  OchreStringContent,
  OchreStringRichText,
  OchreText,
  OchreTree,
} from "../types/internal.raw.d.ts";
import type {
  ApiVersion,
  Bibliography,
  Concept,
  Context,
  ContextItem,
  Coordinate,
  DataCategory,
  Event,
  FileFormat,
  Identification,
  Image,
  ImageMap,
  Interpretation,
  Item,
  LevelContext,
  LevelContextItem,
  License,
  Link,
  Metadata,
  Note,
  Observation,
  Period,
  Person,
  Property,
  PropertyValue,
  PropertyValueContent,
  PropertyValueContentType,
  PropertyVariable,
  Resource,
  Section,
  Set,
  SpatialUnit,
  Style,
  Text,
  Tree,
  WebBlock,
  WebElement,
  WebElementComponent,
  WebImage,
  Webpage,
  WebSegment,
  WebSegmentItem,
  Website,
  WebTitle,
} from "../types/main.js";
import {
  boundsSchema,
  componentSchema,
  propertyValueContentTypeSchema,
} from "../schemas.js";
import {
  getPropertyByLabel,
  getPropertyByLabelAndValue,
  getPropertyValueByLabel,
} from "../utils/getters.js";
import {
  parseEmail,
  parseFakeString,
  parseStringContent,
  parseStringDocumentItem,
} from "../utils/string.js";
import { DEFAULT_API_VERSION } from "./helpers.js";
import { getItemCategories, getItemCategory } from "./internal.js";

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
      code: identification.code ?? null,
    };

    for (const key of Object.keys(identification).filter(
      (key) => key !== "label" && key !== "code",
    )) {
      returnIdentification[key as keyof Identification] =
        typeof identification[key as keyof OchreIdentification] === "string" ?
          parseFakeString(
            identification[key as keyof OchreIdentification]! as FakeString,
          )
        : parseStringContent(
            identification[
              key as keyof OchreIdentification
            ]! as OchreStringContent,
          );
    }

    return returnIdentification;
  } catch (error) {
    console.error(error);

    return { label: "", abbreviation: "", code: null };
  }
}

/**
 * Parses raw language data into an array of language codes
 *
 * @param language - Raw language data, either single or array
 * @returns Array of language codes as strings
 */
export function parseLanguages(
  language: string | OchreLanguage | Array<string | OchreLanguage> | undefined,
): Array<string> {
  if (language == null) {
    // Default to English if no language is provided
    return ["eng"];
  }

  if (typeof language === "string") {
    return [language];
  }

  if (Array.isArray(language)) {
    return language.map((lang) =>
      typeof lang === "object" ? parseStringContent(lang) : lang,
    );
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
    code: null,
  };
  if (metadata.item) {
    if (metadata.item.label || metadata.item.abbreviation) {
      let label = "";
      let abbreviation = "";
      let code: string | null = null;

      if (metadata.item.label) {
        label = parseStringContent(metadata.item.label);
      }
      if (metadata.item.abbreviation) {
        abbreviation = parseStringContent(metadata.item.abbreviation);
      }
      if (metadata.item.identification.code) {
        code = metadata.item.identification.code;
      }

      identification = { label, abbreviation, code };
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

  let collectionIdentification: Identification | null = null;
  if (metadata.collection) {
    collectionIdentification = parseIdentification(
      metadata.collection.identification,
    );
  }

  let publicationIdentification: Identification | null = null;
  if (metadata.publication) {
    publicationIdentification = parseIdentification(
      metadata.publication.identification,
    );
  }

  return {
    project:
      projectIdentification ?
        {
          identification: projectIdentification,
          dateFormat: metadata.project?.dateFormat ?? null,
          page: metadata.project?.page ?? null,
        }
      : null,
    collection:
      metadata.collection != null && collectionIdentification ?
        {
          identification: collectionIdentification,
          page: metadata.collection.page,
        }
      : null,
    publication:
      metadata.publication != null && publicationIdentification ?
        {
          identification: publicationIdentification,
          page: metadata.publication.page,
        }
      : null,
    item:
      metadata.item ?
        {
          identification,
          category: metadata.item.category,
          type: metadata.item.type,
          maxLength: metadata.item.maxLength ?? null,
        }
      : null,
    dataset:
      typeof metadata.dataset === "object" ?
        parseStringContent(metadata.dataset)
      : parseFakeString(metadata.dataset),
    publisher:
      typeof metadata.publisher === "object" ?
        parseStringContent(metadata.publisher)
      : parseFakeString(metadata.publisher),
    languages: parseLanguages(metadata.language),
    identifier:
      typeof metadata.identifier === "object" ?
        parseStringContent(metadata.identifier)
      : parseFakeString(metadata.identifier),
    description:
      typeof metadata.description === "object" ?
        parseStringContent(metadata.description)
      : parseFakeString(metadata.description),
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
        parseISO(contextItem.publicationDateTime)
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

  return { content: license.license.content, url: license.license.target };
}

/**
 * Parses raw person data into the standardized Person type
 *
 * @param person - Raw person data from OCHRE format
 * @returns Parsed Person object
 */
export function parsePerson(
  person: OchrePerson,
  metadata?: Metadata,
  persistentUrl?: string | null,
  belongsTo?: { uuid: string; abbreviation: string },
): Person {
  return {
    uuid: person.uuid,
    category: "person",
    belongsTo: belongsTo ?? null,
    metadata: metadata ?? null,
    publicationDateTime:
      person.publicationDateTime != null ?
        parseISO(person.publicationDateTime)
      : null,
    persistentUrl: persistentUrl ?? null,
    type: person.type ?? null,
    number: person.n ?? null,
    context: person.context ? parseContext(person.context) : null,
    date: person.date ?? null,
    identification:
      person.identification ? parseIdentification(person.identification) : null,
    availability:
      person.availability ? parseLicense(person.availability) : null,
    image: person.image ? parseImage(person.image) : null,
    address:
      person.address ?
        {
          country: person.address.country ?? null,
          city: person.address.city ?? null,
          state: person.address.state ?? null,
        }
      : null,
    description:
      person.description ?
        (
          typeof person.description === "string" ||
          typeof person.description === "number" ||
          typeof person.description === "boolean"
        ) ?
          parseFakeString(person.description)
        : parseStringContent(person.description)
      : null,
    coordinates: parseCoordinates(person.coordinates),
    content: person.content != null ? parseFakeString(person.content) : null,
    notes:
      person.notes ?
        parseNotes(
          Array.isArray(person.notes.note) ?
            person.notes.note
          : [person.notes.note],
        )
      : [],
    links:
      person.links ?
        parseLinks(Array.isArray(person.links) ? person.links : [person.links])
      : [],
    events:
      person.events ?
        parseEvents(
          Array.isArray(person.events.event) ?
            person.events.event
          : [person.events.event],
        )
      : [],
    properties:
      person.properties ?
        parseProperties(
          Array.isArray(person.properties.property) ?
            person.properties.property
          : [person.properties.property],
        )
      : [],
    bibliographies:
      person.bibliographies ?
        parseBibliographies(
          Array.isArray(person.bibliographies.bibliography) ?
            person.bibliographies.bibliography
          : [person.bibliographies.bibliography],
        )
      : [],
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
    : "spatialUnit" in linkRaw ? linkRaw.spatialUnit
    : "concept" in linkRaw ? linkRaw.concept
    : "set" in linkRaw ? linkRaw.set
    : "tree" in linkRaw ? linkRaw.tree
    : "person" in linkRaw ? linkRaw.person
    : "bibliography" in linkRaw ? linkRaw.bibliography
    : "propertyVariable" in linkRaw ? linkRaw.propertyVariable
    : "propertyValue" in linkRaw ? linkRaw.propertyValue
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
        : "spatialUnit" in linkRaw ? "spatialUnit"
        : "concept" in linkRaw ? "concept"
        : "set" in linkRaw ? "set"
        : "person" in linkRaw ? "person"
        : "tree" in linkRaw ? "tree"
        : "bibliography" in linkRaw ? "bibliography"
        : "propertyVariable" in linkRaw ? "propertyVariable"
        : "propertyValue" in linkRaw ? "propertyValue"
        : null,
      content:
        "content" in link ?
          link.content != null ?
            parseFakeString(link.content)
          : null
        : null,
      href: "href" in link && link.href != null ? link.href : null,
      fileFormat:
        "fileFormat" in link && link.fileFormat != null ?
          (link.fileFormat as FileFormat)
        : null,
      fileSize:
        "fileSize" in link && link.fileSize != null ? link.fileSize : null,
      uuid: link.uuid ?? null,
      type: link.type ?? null,
      identification:
        link.identification ? parseIdentification(link.identification) : null,
      description:
        "description" in link && link.description != null ?
          parseStringContent(link.description)
        : null,
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
          parseISO(link.publicationDateTime)
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
        isPrimary: link.isPrimary ?? false,
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
): string {
  let returnString = "";
  const documentWithLanguage =
    Array.isArray(document) ?
      document.find((doc) => doc.lang === language)!
    : document;

  if (
    typeof documentWithLanguage.string === "string" ||
    typeof documentWithLanguage.string === "number" ||
    typeof documentWithLanguage.string === "boolean"
  ) {
    returnString += parseEmail(parseFakeString(documentWithLanguage.string));
  } else {
    const documentItems =
      Array.isArray(documentWithLanguage.string) ?
        documentWithLanguage.string
      : [documentWithLanguage.string];

    for (const item of documentItems) {
      returnString += parseStringDocumentItem(item);
    }
  }

  return returnString;
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
        parseISO(image.publicationDateTime)
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
        date: null,
        authors: [],
        content: note,
      });
      continue;
    }

    let content = "";

    const notesToParse =
      note.content != null ?
        Array.isArray(note.content) ?
          note.content
        : [note.content]
      : [];

    if (notesToParse.length === 0) {
      continue;
    }

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
      content = parseEmail(parseFakeString(noteWithLanguage.string));
    } else {
      content = parseEmail(parseDocument(noteWithLanguage));
    }

    returnNotes.push({
      number: note.noteNo,
      title:
        noteWithLanguage.title != null ?
          parseFakeString(noteWithLanguage.title)
        : null,
      date: note.date ?? null,
      authors:
        note.authors ?
          parsePersons(
            Array.isArray(note.authors.author) ?
              note.authors.author
            : [note.authors.author],
          )
        : [],
      content,
    });
  }

  return returnNotes;
}

/**
 * Parses raw coordinates data into a standardized array of Coordinate structures
 *
 * @param coordinates - Raw coordinates data in OCHRE format
 * @returns Parsed array of Coordinate objects
 */
export function parseCoordinates(
  coordinates: OchreCoordinates | undefined,
): Array<Coordinate> {
  if (coordinates == null) {
    return [];
  }

  const returnCoordinates: Array<Coordinate> = [];

  const coordsToParse =
    Array.isArray(coordinates.coord) ? coordinates.coord : [coordinates.coord];

  for (const coord of coordsToParse) {
    const source: Coordinate["source"] =
      "source" in coord && coord.source ?
        coord.source.context === "self" ?
          {
            context: "self",
            uuid: coord.source.label.uuid,
            label: parseStringContent(coord.source.label),
          }
        : coord.source.context === "related" ?
          {
            context: "related",
            uuid: coord.source.label.uuid,
            label: parseStringContent(coord.source.label),
            value: parseStringContent(coord.source.value),
          }
        : {
            context: "inherited",
            uuid: coord.source.label.uuid,
            item: {
              uuid: coord.source.item.label.uuid,
              label: parseStringContent(coord.source.item.label),
            },
            label: parseStringContent(coord.source.label),
          }
      : null;

    switch (coord.type) {
      case "point": {
        returnCoordinates.push({
          type: coord.type,
          latitude: coord.latitude,
          longitude: coord.longitude,
          altitude: coord.altitude ?? null,
          source,
        });
        break;
      }
      case "plane": {
        returnCoordinates.push({
          type: coord.type,

          minimum: {
            latitude: coord.minimum.latitude,
            longitude: coord.minimum.longitude,
          },
          maximum: {
            latitude: coord.maximum.latitude,
            longitude: coord.maximum.longitude,
          },
          source,
        });
        break;
      }
    }
  }

  return returnCoordinates;
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
    date: observation.date ?? null,
    observers:
      observation.observers != null ?
        (
          typeof observation.observers === "string" ||
          typeof observation.observers === "number" ||
          typeof observation.observers === "boolean"
        ) ?
          parseFakeString(observation.observers)
            .split(";")
            .map((observer) => observer.trim())
        : parsePersons(
            Array.isArray(observation.observers) ?
              observation.observers
            : [observation.observers],
          )
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
    bibliographies:
      observation.bibliographies ?
        parseBibliographies(
          Array.isArray(observation.bibliographies.bibliography) ?
            observation.bibliographies.bibliography
          : [observation.bibliographies.bibliography],
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
      dateTime:
        event.endDateTime != null ?
          `${event.dateTime}/${event.endDateTime}`
        : (event.dateTime ?? null),
      label: parseStringContent(event.label),
      location:
        event.location ?
          {
            uuid: event.location.uuid,
            publicationDateTime:
              event.location.publicationDateTime != null ?
                parseISO(event.location.publicationDateTime)
              : null,
            content: parseStringContent(event.location),
          }
        : null,
      agent:
        event.agent ?
          {
            uuid: event.agent.uuid,
            publicationDateTime:
              event.agent.publicationDateTime != null ?
                parseISO(event.agent.publicationDateTime)
              : null,
            content: parseStringContent(event.agent),
          }
        : null,
      comment: event.comment ? parseStringContent(event.comment) : null,
      other:
        event.other != null ?
          {
            uuid: event.other.uuid ?? null,
            category: event.other.category ?? null,
            content: parseStringContent(event.other),
          }
        : null,
      value: event.value ? parseFakeString(event.value) : null,
    });
  }

  return returnEvents;
}

export function parseProperty(
  property: OchreProperty,
  language = "eng",
): Property {
  const valuesToParse =
    "value" in property && property.value ?
      Array.isArray(property.value) ?
        property.value
      : [property.value]
    : [];

  const values = valuesToParse.map((value) => {
    let content: string | number | boolean | Date | null = null;
    let label: string | null = null;

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      content = parseFakeString(value);
      const returnValue: PropertyValueContent<"string"> = {
        hierarchy: { isLeaf: true, level: null },
        content,
        label: null,
        dataType: "string",
        isUncertain: false,
        category: "value",
        type: null,
        uuid: null,
        publicationDateTime: null,
        unit: null,
        height: null,
        width: null,
        fileSize: null,
        href: null,
        slug: null,
      };

      return returnValue;
    } else {
      let parsedType: PropertyValueContentType = "string";
      if (value.dataType != null) {
        const { data, error } = propertyValueContentTypeSchema.safeParse(
          value.dataType,
        );
        if (error) {
          throw new Error(
            `Invalid property value content type: "${value.dataType}"`,
          );
        }

        parsedType = data;
      }

      switch (parsedType) {
        case "integer":
        case "decimal":
        case "time": {
          if (value.rawValue != null) {
            content = Number(value.rawValue);
            label =
              value.content ?
                parseStringContent({ content: value.content })
              : null;
          } else {
            content = Number(value.content);
            label = null;
          }
          break;
        }
        // case "date":
        // case "dateTime": {
        //   if (value.rawValue != null) {
        //     content = parseISO(parseFakeString(value.rawValue));
        //     label =
        //       value.content ?
        //         parseStringContent({ content: value.content })
        //       : null;
        //   } else {
        //     content =
        //       value.content ?
        //         typeof value.content === "string" ?
        //           parseISO(value.content)
        //         : parseISO(parseStringContent({ content: value.content }))
        //       : null;
        //   }
        //   break;
        // }
        case "boolean": {
          if (value.rawValue != null) {
            content = value.rawValue === "true";
            label =
              value.content ?
                parseStringContent({ content: value.content })
              : null;
          } else {
            content = value.content === true;
            label = null;
          }
          break;
        }
        default: {
          if ("slug" in value && value.slug != null) {
            content = parseFakeString(value.slug);
          } else if (value.content != null) {
            if (value.rawValue != null) {
              content = parseFakeString(value.rawValue);
              label =
                value.content ?
                  parseStringContent({ content: value.content })
                : null;
            } else {
              content = parseStringContent({ content: value.content });
              label = null;
            }
          }

          break;
        }
      }

      const returnValue: PropertyValueContent<typeof parsedType> = {
        hierarchy: {
          isLeaf: value.inherited == null || !value.inherited,
          level: value.i ?? null,
        },
        content,
        dataType: parsedType,
        isUncertain: value.isUncertain ?? false,
        label,
        category: value.category ?? null,
        type: value.type ?? null,
        uuid: value.uuid ?? null,
        publicationDateTime:
          value.publicationDateTime != null ?
            parseISO(value.publicationDateTime)
          : null,
        unit: value.unit ?? null,
        height: value.height ?? null,
        width: value.width ?? null,
        fileSize: value.fileSize ?? null,
        href: value.href ?? null,
        slug: value.slug ?? null,
      };

      return returnValue;
    }
  });

  return {
    uuid: property.label.uuid,
    label: parseStringContent(property.label, language)
      .replace(/\s*\.{3}$/, "")
      .trim(),
    values,
    comment:
      property.comment != null ? parseStringContent(property.comment) : null,
    properties:
      property.property ?
        parseProperties(
          Array.isArray(property.property) ?
            property.property
          : [property.property],
        )
      : [],
  };
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
    returnProperties.push(parseProperty(property, language));
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
      date: interpretation.date ?? null,
      number: interpretation.interpretationNo,
      links:
        interpretation.links ?
          parseLinks(
            Array.isArray(interpretation.links) ?
              interpretation.links
            : [interpretation.links],
          )
        : [],
      properties:
        interpretation.properties ?
          parseProperties(
            Array.isArray(interpretation.properties.property) ?
              interpretation.properties.property
            : [interpretation.properties.property],
          )
        : [],
      bibliographies:
        interpretation.bibliographies ?
          parseBibliographies(
            Array.isArray(interpretation.bibliographies.bibliography) ?
              interpretation.bibliographies.bibliography
            : [interpretation.bibliographies.bibliography],
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
          parseISO(area.publicationDateTime)
        : null,
      category: area.type,
      title: parseFakeString(area.title),
      shape:
        area.shape === "rect" ? "rectangle"
        : area.shape === "circle" ? "circle"
        : "polygon",
      coords: area.coords.split(",").map((coord) => Number.parseInt(coord)),
      slug: area.slug ? parseFakeString(area.slug) : null,
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
export function parsePeriod(
  period: OchrePeriod,
  metadata?: Metadata,
  persistentUrl?: string | null,
  belongsTo?: { uuid: string; abbreviation: string },
): Period {
  return {
    uuid: period.uuid,
    category: "period",
    belongsTo: belongsTo ?? null,
    metadata: metadata ?? null,
    publicationDateTime:
      period.publicationDateTime != null ?
        parseISO(period.publicationDateTime)
      : null,
    persistentUrl: persistentUrl ?? null,
    type: period.type ?? null,
    number: period.n ?? null,
    identification: parseIdentification(period.identification),
    description:
      period.description ? parseStringContent(period.description) : null,
    coordinates: parseCoordinates(period.coordinates),
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
  metadata?: Metadata,
  persistentUrl?: string | null,
  belongsTo?: { uuid: string; abbreviation: string },
): Bibliography {
  const sourceResources: Bibliography["sourceResources"] = [];
  if (bibliography.source?.resource) {
    const resourcesToParse =
      Array.isArray(bibliography.source.resource) ?
        bibliography.source.resource
      : [bibliography.source.resource];
    for (const resource of resourcesToParse) {
      sourceResources.push({
        uuid: resource.uuid,
        category: "resource",
        publicationDateTime: parseISO(resource.publicationDateTime),
        type: resource.type,
        identification: parseIdentification(resource.identification),
        href: resource.href ?? null,
      });
    }
  }

  let shortCitation = null;
  let longCitation = null;
  if (bibliography.citationFormatSpan) {
    try {
      shortCitation = (
        JSON.parse(`"${bibliography.citationFormatSpan}"`) as string
      )
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">");
    } catch {
      shortCitation = bibliography.citationFormatSpan;
    }
  }
  if (bibliography.referenceFormatDiv) {
    try {
      longCitation = (
        JSON.parse(`"${bibliography.referenceFormatDiv}"`) as string
      )
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">");
    } catch {
      longCitation = bibliography.referenceFormatDiv;
    }
  }

  return {
    uuid: bibliography.uuid ?? null,
    belongsTo: belongsTo ?? null,
    zoteroId: bibliography.zoteroId ?? null,
    category: "bibliography",
    metadata: metadata ?? null,
    publicationDateTime:
      bibliography.publicationDateTime != null ?
        parseISO(bibliography.publicationDateTime)
      : null,
    persistentUrl: persistentUrl ?? null,
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
    image: bibliography.image ? parseImage(bibliography.image) : null,
    citation: {
      details: bibliography.citationDetails ?? null,
      format: bibliography.citationFormat ?? null,
      short: shortCitation,
      long: longCitation,
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
          set(new UTCDate(0, 0, 0, 0, 0, 0, 0), {
            year: bibliography.publicationInfo.startDate.year,
            month: bibliography.publicationInfo.startDate.month,
            date: bibliography.publicationInfo.startDate.day,
          })
        : null,
    },
    entryInfo:
      bibliography.entryInfo ?
        {
          startIssue: parseFakeString(bibliography.entryInfo.startIssue),
          startVolume: parseFakeString(bibliography.entryInfo.startVolume),
        }
      : null,
    sourceResources,
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
    links:
      bibliography.links ?
        parseLinks(
          Array.isArray(bibliography.links) ?
            bibliography.links
          : [bibliography.links],
        )
      : [],
    reverseLinks:
      bibliography.reverseLinks ?
        parseLinks(
          Array.isArray(bibliography.reverseLinks) ?
            bibliography.reverseLinks
          : [bibliography.reverseLinks],
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
 * Parses raw property variable data into a standardized PropertyVariable structure
 *
 * @param propertyVariable - Raw property variable data in OCHRE format
 * @returns Parsed PropertyVariable object
 */
export function parsePropertyVariable(
  propertyVariable: OchrePropertyVariable,
  metadata?: Metadata,
  persistentUrl?: string | null,
  belongsTo?: { uuid: string; abbreviation: string },
): PropertyVariable {
  return {
    uuid: propertyVariable.uuid,
    category: "propertyVariable",
    belongsTo: belongsTo ?? null,
    metadata: metadata ?? null,
    persistentUrl: persistentUrl ?? null,
    type: propertyVariable.type,
    number: propertyVariable.n,
    publicationDateTime:
      propertyVariable.publicationDateTime ?
        parseISO(propertyVariable.publicationDateTime)
      : null,
    context:
      propertyVariable.context ? parseContext(propertyVariable.context) : null,
    availability:
      propertyVariable.availability ?
        parseLicense(propertyVariable.availability)
      : null,
    identification: parseIdentification(propertyVariable.identification),
  };
}

/**
 * Parses an array of raw property variables into standardized PropertyVariable objects
 *
 * @param propertyVariables - Array of raw property variables in OCHRE format
 * @returns Array of parsed PropertyVariable objects
 */
export function parsePropertyVariables(
  propertyVariables: Array<OchrePropertyVariable>,
): Array<PropertyVariable> {
  const returnPropertyVariables: Array<PropertyVariable> = [];
  for (const propertyVariable of propertyVariables) {
    returnPropertyVariables.push(parsePropertyVariable(propertyVariable));
  }
  return returnPropertyVariables;
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
 * Parses raw property value data into a standardized PropertyValue structure
 *
 * @param propertyValue - Raw property value data in OCHRE format
 * @returns Parsed PropertyValue object
 */
export function parsePropertyValue(
  propertyValue: OchrePropertyValue,
  metadata?: Metadata,
  persistentUrl?: string | null,
  belongsTo?: { uuid: string; abbreviation: string },
): PropertyValue {
  return {
    uuid: propertyValue.uuid,
    category: "propertyValue",
    belongsTo: belongsTo ?? null,
    metadata: metadata ?? null,
    number: propertyValue.n,
    publicationDateTime:
      propertyValue.publicationDateTime ?
        parseISO(propertyValue.publicationDateTime)
      : null,
    persistentUrl: persistentUrl ?? null,
    context: propertyValue.context ? parseContext(propertyValue.context) : null,
    availability:
      propertyValue.availability ?
        parseLicense(propertyValue.availability)
      : null,
    identification: parseIdentification(propertyValue.identification),
    date: propertyValue.date ?? null,
    creators:
      propertyValue.creators ?
        parsePersons(
          Array.isArray(propertyValue.creators.creator) ?
            propertyValue.creators.creator
          : [propertyValue.creators.creator],
        )
      : [],
    description:
      propertyValue.description ?
        (
          typeof propertyValue.description === "string" ||
          typeof propertyValue.description === "number" ||
          typeof propertyValue.description === "boolean"
        ) ?
          parseFakeString(propertyValue.description)
        : parseStringContent(propertyValue.description)
      : "",
    coordinates: parseCoordinates(propertyValue.coordinates),
    notes:
      propertyValue.notes ?
        parseNotes(
          Array.isArray(propertyValue.notes.note) ?
            propertyValue.notes.note
          : [propertyValue.notes.note],
        )
      : [],
    links:
      propertyValue.links ?
        parseLinks(
          Array.isArray(propertyValue.links) ?
            propertyValue.links
          : [propertyValue.links],
        )
      : [],
  };
}

/**
 * Parses an array of raw property values into standardized PropertyValue objects
 *
 * @param propertyValues - Array of raw property values in OCHRE format
 * @returns Array of parsed PropertyValue objects
 */
export function parsePropertyValues(
  propertyValues: Array<OchrePropertyValue>,
): Array<PropertyValue> {
  const returnPropertyValues: Array<PropertyValue> = [];

  for (const propertyValue of propertyValues) {
    returnPropertyValues.push(parsePropertyValue(propertyValue));
  }

  return returnPropertyValues;
}

/**
 * Parses raw text data into a standardized Text object
 *
 * @param text - Raw text data in OCHRE format
 * @returns Parsed Text object
 */
export function parseText(
  text: OchreText,
  metadata?: Metadata,
  persistentUrl?: string | null,
  belongsTo?: { uuid: string; abbreviation: string },
): Text {
  return {
    uuid: text.uuid,
    category: "text",
    belongsTo: belongsTo ?? null,
    metadata: metadata ?? null,
    publicationDateTime:
      text.publicationDateTime ? parseISO(text.publicationDateTime) : null,
    persistentUrl: persistentUrl ?? null,
    type: text.type ?? null,
    language: text.language ?? null,
    number: text.n ?? 0,
    context: text.context ? parseContext(text.context) : null,
    license:
      "availability" in text && text.availability ?
        parseLicense(text.availability)
      : null,
    copyright:
      "copyright" in text && text.copyright != null ?
        parseStringContent(text.copyright)
      : null,
    watermark:
      "watermark" in text && text.watermark != null ?
        parseStringContent(text.watermark)
      : null,
    identification: parseIdentification(text.identification),
    image: text.image ? parseImage(text.image) : null,
    creators:
      text.creators ?
        parsePersons(
          Array.isArray(text.creators.creator) ?
            text.creators.creator
          : [text.creators.creator],
        )
      : [],
    editors:
      text.editions ?
        parsePersons(
          Array.isArray(text.editions.editor) ?
            text.editions.editor
          : [text.editions.editor],
        )
      : [],
    notes:
      text.notes ?
        parseNotes(
          Array.isArray(text.notes.note) ? text.notes.note : [text.notes.note],
        )
      : [],
    description:
      text.description ?
        parseStringContent(text.description as OchreStringContent)
      : "",
    coordinates: parseCoordinates(text.coordinates),
    periods:
      text.periods ?
        parsePeriods(
          Array.isArray(text.periods.period) ?
            text.periods.period
          : [text.periods.period],
        )
      : [],
    links:
      text.links ?
        parseLinks(Array.isArray(text.links) ? text.links : [text.links])
      : [],
    reverseLinks:
      text.reverseLinks ?
        parseLinks(
          Array.isArray(text.reverseLinks) ?
            text.reverseLinks
          : [text.reverseLinks],
        )
      : [],
    properties:
      text.properties ?
        parseProperties(
          Array.isArray(text.properties.property) ?
            text.properties.property
          : [text.properties.property],
        )
      : [],
    bibliographies:
      text.bibliographies ?
        parseBibliographies(
          Array.isArray(text.bibliographies.bibliography) ?
            text.bibliographies.bibliography
          : [text.bibliographies.bibliography],
        )
      : [],
    sections: text.sections ? parseSections(text.sections) : [],
  };
}

/**
 * Parses an array of raw texts into standardized Text objects
 *
 * @param texts - Array of raw texts in OCHRE format
 * @returns Array of parsed Text objects
 */
export function parseTexts(texts: Array<OchreText>): Array<Text> {
  const returnTexts: Array<Text> = [];

  for (const text of texts) {
    returnTexts.push(parseText(text));
  }

  return returnTexts;
}

/**
 * Parses a raw section data into a standardized Section object
 *
 * @param section - Raw section data in OCHRE format
 * @returns Parsed Section object
 */
export function parseSection(
  section: OchreSection,
  variant: "translation" | "phonemic",
): Section {
  return {
    uuid: section.uuid,
    variant,
    type: section.type,
    identification: parseIdentification(section.identification),
    projectIdentification:
      section.project?.identification ?
        parseIdentification(section.project.identification)
      : null,
  };
}

/**
 * Parses raw sections data into a standardized Section object
 *
 * @param sections - Raw sections data in OCHRE format
 * @param sections.translation - Translation sections
 * @param sections.phonemic - Phonemic sections
 * @param sections.translation.section - Translation sections
 * @param sections.phonemic.section - Phonemic sections
 * @returns Parsed Section object
 */
export function parseSections(sections: {
  translation?: { section: OchreSection | Array<OchreSection> };
  phonemic?: { section: OchreSection | Array<OchreSection> };
}): Array<Section> {
  const returnSections: Array<Section> = [];

  const translationSections =
    sections.translation ?
      Array.isArray(sections.translation.section) ?
        sections.translation.section
      : [sections.translation.section]
    : [];
  const phonemicSections =
    sections.phonemic ?
      Array.isArray(sections.phonemic.section) ?
        sections.phonemic.section
      : [sections.phonemic.section]
    : [];

  for (const section of translationSections) {
    returnSections.push(parseSection(section, "translation"));
  }

  for (const section of phonemicSections) {
    returnSections.push(parseSection(section, "phonemic"));
  }

  return returnSections;
}

/**
 * Parses a raw tree structure into a standardized Tree object
 *
 * @param tree - Raw tree data in OCHRE format
 * @returns Parsed Tree object or null if invalid
 */
export function parseTree<U extends Exclude<DataCategory, "tree">>(
  tree: OchreTree,
  itemCategories?: Array<Exclude<DataCategory, "tree">>,
  metadata?: Metadata,
  persistentUrl?: string | null,
  belongsTo?: { uuid: string; abbreviation: string },
): Tree<U> {
  if (typeof tree.items === "string") {
    throw new TypeError("Invalid OCHRE data: Tree has no items");
  }

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
    date = tree.date;
  }

  const parsedItemCategories =
    itemCategories ?? getItemCategory(Object.keys(tree.items));

  let items:
    | Array<Resource>
    | Array<SpatialUnit>
    | Array<Concept>
    | Array<Period>
    | Array<Bibliography>
    | Array<Person>
    | Array<PropertyVariable>
    | Array<PropertyValue>
    | Array<Text>
    | Array<Set<Array<U>>> = [];

  switch (parsedItemCategories) {
    case "resource": {
      if (!("resource" in tree.items)) {
        throw new Error("Invalid OCHRE data: Tree has no resources");
      }
      items = parseResources(
        Array.isArray(tree.items.resource) ?
          tree.items.resource
        : [tree.items.resource],
      );
      break;
    }
    case "spatialUnit": {
      if (!("spatialUnit" in tree.items)) {
        throw new Error("Invalid OCHRE data: Tree has no spatial units");
      }
      items = parseSpatialUnits(
        Array.isArray(tree.items.spatialUnit) ?
          tree.items.spatialUnit
        : [tree.items.spatialUnit],
      );
      break;
    }
    case "concept": {
      if (!("concept" in tree.items)) {
        throw new Error("Invalid OCHRE data: Tree has no concepts");
      }
      items = parseConcepts(
        Array.isArray(tree.items.concept) ?
          tree.items.concept
        : [tree.items.concept],
      );
      break;
    }
    case "period": {
      if (!("period" in tree.items)) {
        throw new Error("Invalid OCHRE data: Tree has no periods");
      }
      items = parsePeriods(
        Array.isArray(tree.items.period) ?
          tree.items.period
        : [tree.items.period],
      );
      break;
    }
    case "bibliography": {
      if (!("bibliography" in tree.items)) {
        throw new Error("Invalid OCHRE data: Tree has no bibliographies");
      }
      items = parseBibliographies(
        Array.isArray(tree.items.bibliography) ?
          tree.items.bibliography
        : [tree.items.bibliography],
      );
      break;
    }
    case "person": {
      if (!("person" in tree.items)) {
        throw new Error("Invalid OCHRE data: Tree has no persons");
      }
      items = parsePersons(
        Array.isArray(tree.items.person) ?
          tree.items.person
        : [tree.items.person],
      );
      break;
    }
    case "propertyVariable": {
      if (!("propertyVariable" in tree.items)) {
        throw new Error("Invalid OCHRE data: Tree has no property variables");
      }
      items = parsePropertyVariables(
        Array.isArray(tree.items.propertyVariable) ?
          tree.items.propertyVariable
        : [tree.items.propertyVariable],
      );
      break;
    }
    case "propertyValue": {
      if (!("propertyValue" in tree.items)) {
        throw new Error("Invalid OCHRE data: Tree has no property values");
      }
      items = parsePropertyValues(
        Array.isArray(tree.items.propertyValue) ?
          tree.items.propertyValue
        : [tree.items.propertyValue],
      );
      break;
    }
    case "text": {
      if (!("text" in tree.items)) {
        throw new Error("Invalid OCHRE data: Tree has no texts");
      }
      items = parseTexts(
        Array.isArray(tree.items.text) ? tree.items.text : [tree.items.text],
      );
      break;
    }
    case "set": {
      if (!("set" in tree.items)) {
        throw new Error("Invalid OCHRE data: Tree has no sets");
      }

      const setItems: Array<Set<Array<U>>> = [];
      for (const item of Array.isArray(tree.items.set) ?
        tree.items.set
      : [tree.items.set]) {
        setItems.push(parseSet<Array<U>>(item, itemCategories as Array<U>));
      }

      items = setItems;
      break;
    }
    default: {
      throw new Error("Invalid OCHRE data: Tree has no items or is malformed");
    }
  }

  const returnTree: Tree<U> = {
    uuid: tree.uuid,
    category: "tree",
    belongsTo: belongsTo ?? null,
    metadata: metadata ?? null,
    publicationDateTime: parseISO(tree.publicationDateTime),
    persistentUrl: persistentUrl ?? null,
    identification: parseIdentification(tree.identification),
    creators,
    license: parseLicense(tree.availability),
    date,
    type: tree.type,
    number: tree.n,
    items: items as Tree<U>["items"],
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
 * Parses raw trees data into a standardized Trees structure
 *
 * @param trees - Raw trees data in OCHRE format
 * @returns Parsed Trees object
 */
export function parseTrees<U extends Exclude<DataCategory, "tree">>(
  trees: Array<OchreTree>,
): Array<Tree<U>> {
  const returnTrees: Array<Tree<U>> = [];

  for (const tree of trees) {
    returnTrees.push(parseTree<U>(tree));
  }

  return returnTrees;
}

/**
 * Parses raw set data into a standardized Set structure
 *
 * @param set - Raw set data in OCHRE format
 * @returns Parsed Set object
 */
export function parseSet<U extends Array<DataCategory>>(
  set: OchreSet,
  itemCategories?: U,
  metadata?: Metadata,
  persistentUrl?: string | null,
  belongsTo?: { uuid: string; abbreviation: string },
): Set<U> {
  if (typeof set.items === "string") {
    throw new TypeError("Invalid OCHRE data: Set has no items");
  }

  const parsedItemCategories =
    itemCategories ?? getItemCategories(Object.keys(set.items));

  const items: Array<Item<U[number]>> = [];

  for (const itemCategory of parsedItemCategories) {
    switch (itemCategory) {
      case "resource": {
        if (!("resource" in set.items) || set.items.resource == null) {
          throw new Error("Invalid OCHRE data: Set has no resources");
        }
        items.push(
          ...(parseResources(
            Array.isArray(set.items.resource) ?
              set.items.resource
            : [set.items.resource],
          ) as Array<Item<U[number]>>),
        );
        break;
      }
      case "spatialUnit": {
        if (!("spatialUnit" in set.items) || set.items.spatialUnit == null) {
          throw new Error("Invalid OCHRE data: Set has no spatial units");
        }
        items.push(
          ...(parseSpatialUnits(
            Array.isArray(set.items.spatialUnit) ?
              set.items.spatialUnit
            : [set.items.spatialUnit],
          ) as Array<Item<U[number]>>),
        );
        break;
      }
      case "concept": {
        if (!("concept" in set.items) || set.items.concept == null) {
          throw new Error("Invalid OCHRE data: Set has no concepts");
        }
        items.push(
          ...(parseConcepts(
            Array.isArray(set.items.concept) ?
              set.items.concept
            : [set.items.concept],
          ) as Array<Item<U[number]>>),
        );
        break;
      }
      case "period": {
        if (!("period" in set.items) || set.items.period == null) {
          throw new Error("Invalid OCHRE data: Set has no periods");
        }
        items.push(
          ...(parsePeriods(
            Array.isArray(set.items.period) ?
              set.items.period
            : [set.items.period],
          ) as Array<Item<U[number]>>),
        );
        break;
      }
      case "bibliography": {
        if (!("bibliography" in set.items) || set.items.bibliography == null) {
          throw new Error("Invalid OCHRE data: Set has no bibliographies");
        }
        items.push(
          ...(parseBibliographies(
            Array.isArray(set.items.bibliography) ?
              set.items.bibliography
            : [set.items.bibliography],
          ) as Array<Item<U[number]>>),
        );
        break;
      }
      case "person": {
        if (!("person" in set.items) || set.items.person == null) {
          throw new Error("Invalid OCHRE data: Set has no persons");
        }
        items.push(
          ...(parsePersons(
            Array.isArray(set.items.person) ?
              set.items.person
            : [set.items.person],
          ) as Array<Item<U[number]>>),
        );
        break;
      }
      case "propertyVariable": {
        if (
          !("propertyVariable" in set.items) ||
          set.items.propertyVariable == null
        ) {
          throw new Error("Invalid OCHRE data: Set has no property variables");
        }
        items.push(
          ...(parsePropertyVariables(
            Array.isArray(set.items.propertyVariable) ?
              set.items.propertyVariable
            : [set.items.propertyVariable],
          ) as Array<Item<U[number]>>),
        );
        break;
      }
      case "propertyValue": {
        if (
          !("propertyValue" in set.items) ||
          set.items.propertyValue == null
        ) {
          throw new Error("Invalid OCHRE data: Set has no property values");
        }
        items.push(
          ...(parsePropertyValues(
            Array.isArray(set.items.propertyValue) ?
              set.items.propertyValue
            : [set.items.propertyValue],
          ) as Array<Item<U[number]>>),
        );
        break;
      }
      case "text": {
        if (!("text" in set.items) || set.items.text == null) {
          throw new Error("Invalid OCHRE data: Set has no texts");
        }
        items.push(
          ...(parseTexts(
            Array.isArray(set.items.text) ? set.items.text : [set.items.text],
          ) as Array<Item<U[number]>>),
        );
        break;
      }
      default: {
        throw new Error("Invalid OCHRE data: Set has no items or is malformed");
      }
    }
  }

  return {
    uuid: set.uuid,
    category: "set",
    belongsTo: belongsTo ?? null,
    metadata: metadata ?? null,
    itemCategories: parsedItemCategories as U,
    publicationDateTime:
      set.publicationDateTime ? parseISO(set.publicationDateTime) : null,
    persistentUrl: persistentUrl ?? null,
    date: set.date ?? null,
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
    items: items as unknown as Set<U>["items"],
  };
}

/**
 * Parses raw sets data into a standardized Sets structure
 *
 * @param sets - Raw sets data in OCHRE format
 * @returns Parsed Sets object
 */
export function parseSets<U extends Array<DataCategory>>(
  sets: Array<OchreSet>,
): Array<Set<U>> {
  const returnSets: Array<Set<U>> = [];

  for (const set of sets) {
    returnSets.push(parseSet<U>(set));
  }

  return returnSets;
}

/**
 * Parses raw resource data into a standardized Resource structure
 *
 * @param resource - Raw resource data in OCHRE format
 * @returns Parsed Resource object
 */
export function parseResource(
  resource: OchreResource,
  metadata?: Metadata,
  persistentUrl?: string | null,
  belongsTo?: { uuid: string; abbreviation: string },
): Resource {
  const returnResource: Resource = {
    uuid: resource.uuid,
    category: "resource",
    belongsTo: belongsTo ?? null,
    metadata: metadata ?? null,
    publicationDateTime:
      resource.publicationDateTime ?
        parseISO(resource.publicationDateTime)
      : null,
    persistentUrl: persistentUrl ?? null,
    type: resource.type,
    number: resource.n,
    fileFormat: (resource.fileFormat as FileFormat | undefined) ?? null,
    fileSize: resource.fileSize ?? null,
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
        parseStringContent(resource.copyright)
      : null,
    watermark:
      "watermark" in resource && resource.watermark != null ?
        parseStringContent(resource.watermark)
      : null,
    identification: parseIdentification(resource.identification),
    date: resource.date ?? null,
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
      resource.notes ?
        parseNotes(
          Array.isArray(resource.notes.note) ?
            resource.notes.note
          : [resource.notes.note],
        )
      : [],
    description:
      resource.description ?
        ["string", "number", "boolean"].includes(typeof resource.description) ?
          parseFakeString(resource.description as FakeString)
        : parseStringContent(resource.description as OchreStringContent)
      : "",
    coordinates:
      resource.coordinates ? parseCoordinates(resource.coordinates) : [],
    document:
      resource.document && "content" in resource.document ?
        parseDocument(resource.document.content)
      : null,
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
    bibliographies:
      resource.bibliographies ?
        parseBibliographies(
          Array.isArray(resource.bibliographies.bibliography) ?
            resource.bibliographies.bibliography
          : [resource.bibliographies.bibliography],
        )
      : [],
    resources:
      resource.resource ?
        parseResources(
          Array.isArray(resource.resource) ?
            resource.resource
          : [resource.resource],
        )
      : [],
  };

  return returnResource;
}

/**
 * Parses raw resource data into a standardized Resource structure
 *
 * @param resources - Raw resource data in OCHRE format
 * @returns Parsed Resource object
 */
export function parseResources(
  resources: Array<OchreResource>,
): Array<Resource> {
  const returnResources: Array<Resource> = [];

  for (const resource of resources) {
    returnResources.push(parseResource(resource));
  }

  return returnResources;
}

/**
 * Parses raw spatial units into standardized SpatialUnit objects
 *
 * @param spatialUnit - Raw spatial unit in OCHRE format
 * @returns Parsed SpatialUnit object
 */
export function parseSpatialUnit(
  spatialUnit: OchreSpatialUnit,
  metadata?: Metadata,
  persistentUrl?: string | null,
  belongsTo?: { uuid: string; abbreviation: string },
): SpatialUnit {
  const returnSpatialUnit: SpatialUnit = {
    uuid: spatialUnit.uuid,
    category: "spatialUnit",
    belongsTo: belongsTo ?? null,
    metadata: metadata ?? null,
    publicationDateTime:
      spatialUnit.publicationDateTime != null ?
        parseISO(spatialUnit.publicationDateTime)
      : null,
    persistentUrl: persistentUrl ?? null,
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
    coordinates: parseCoordinates(spatialUnit.coordinates),
    mapData: spatialUnit.mapData ?? null,
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
    properties:
      "properties" in spatialUnit && spatialUnit.properties ?
        parseProperties(
          Array.isArray(spatialUnit.properties.property) ?
            spatialUnit.properties.property
          : [spatialUnit.properties.property],
        )
      : [],
    bibliographies:
      spatialUnit.bibliographies ?
        parseBibliographies(
          Array.isArray(spatialUnit.bibliographies.bibliography) ?
            spatialUnit.bibliographies.bibliography
          : [spatialUnit.bibliographies.bibliography],
        )
      : [],
  };

  return returnSpatialUnit;
}

/**
 * Parses an array of raw spatial units into standardized SpatialUnit objects
 *
 * @param spatialUnits - Array of raw spatial units in OCHRE format
 * @returns Array of parsed SpatialUnit objects
 */
export function parseSpatialUnits(
  spatialUnits: Array<OchreSpatialUnit>,
): Array<SpatialUnit> {
  const returnSpatialUnits: Array<SpatialUnit> = [];

  for (const spatialUnit of spatialUnits) {
    returnSpatialUnits.push(parseSpatialUnit(spatialUnit));
  }

  return returnSpatialUnits;
}

/**
 * Parses a raw concept into a standardized Concept object
 *
 * @param concept - Raw concept data in OCHRE format
 * @returns Parsed Concept object
 */
export function parseConcept(
  concept: OchreConcept,
  metadata?: Metadata,
  persistentUrl?: string | null,
  belongsTo?: { uuid: string; abbreviation: string },
): Concept {
  const returnConcept: Concept = {
    uuid: concept.uuid,
    category: "concept",
    belongsTo: belongsTo ?? null,
    metadata: metadata ?? null,
    publicationDateTime:
      concept.publicationDateTime ?
        parseISO(concept.publicationDateTime)
      : null,
    persistentUrl: persistentUrl ?? null,
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
    image: concept.image ? parseImage(concept.image) : null,
    description:
      concept.description ?
        parseStringContent(concept.description as OchreStringContent)
      : null,
    coordinates: parseCoordinates(concept.coordinates),
    interpretations:
      concept.interpretations ?
        parseInterpretations(
          Array.isArray(concept.interpretations.interpretation) ?
            concept.interpretations.interpretation
          : [concept.interpretations.interpretation],
        )
      : [],
    properties:
      concept.properties ?
        parseProperties(
          Array.isArray(concept.properties.property) ?
            concept.properties.property
          : [concept.properties.property],
        )
      : [],
    bibliographies:
      concept.bibliographies ?
        parseBibliographies(
          Array.isArray(concept.bibliographies.bibliography) ?
            concept.bibliographies.bibliography
          : [concept.bibliographies.bibliography],
        )
      : [],
  };

  return returnConcept;
}

/**
 * Parses raw webpage resources into standardized WebElement or Webpage objects
 *
 * @param webpageResources - Array of raw webpage resources in OCHRE format
 * @param type - Type of resource to parse ("element" or "page")
 * @returns Array of parsed WebElement or Webpage objects
 */
const parseWebpageResources = <T extends "element" | "page" | "block">(
  webpageResources: Array<OchreResource>,
  type: T,
): Array<
  T extends "element" ? WebElement
  : T extends "page" ? Webpage
  : WebBlock
> => {
  const returnElements: Array<
    T extends "element" ? WebElement
    : T extends "page" ? Webpage
    : WebBlock
  > = [];

  for (const resource of webpageResources) {
    const resourceProperties =
      resource.properties ?
        parseProperties(
          Array.isArray(resource.properties.property) ?
            resource.properties.property
          : [resource.properties.property],
        )
      : [];

    const resourceProperty = getPropertyByLabelAndValue(
      resourceProperties,
      "presentation",
      type,
    );
    if (resourceProperty === null) {
      continue;
    }

    switch (type) {
      case "element": {
        const element = parseWebElement(resource);

        returnElements.push(
          element as T extends "element" ? WebElement
          : T extends "page" ? Webpage
          : WebBlock,
        );

        break;
      }
      case "page": {
        const webpage = parseWebpage(resource);
        if (webpage) {
          returnElements.push(
            webpage as T extends "element" ? WebElement
            : T extends "page" ? Webpage
            : WebBlock,
          );
        }

        break;
      }
      case "block": {
        const block = parseWebBlock(resource);
        if (block) {
          returnElements.push(
            block as T extends "element" ? WebElement
            : T extends "page" ? Webpage
            : WebBlock,
          );
        }

        break;
      }
    }
  }

  return returnElements;
};

/**
 * Parses raw concept data into standardized Concept objects
 *
 * @param concepts - Array of raw concept data in OCHRE format
 * @returns Array of parsed Concept objects
 */
export function parseConcepts(concepts: Array<OchreConcept>): Array<Concept> {
  const returnConcepts: Array<Concept> = [];

  for (const concept of concepts) {
    returnConcepts.push(parseConcept(concept));
  }

  return returnConcepts;
}

function parseBounds(bounds: string): [[number, number], [number, number]] {
  const result = boundsSchema.safeParse(bounds);
  if (!result.success) {
    throw new Error(`Invalid bounds: ${result.error.message}`);
  }

  return result.data;
}

/**
 * Parses raw web element properties into a standardized WebElementComponent structure
 *
 * @param componentProperty - Raw component property data in OCHRE format
 * @param elementResource - Raw element resource data in OCHRE format
 * @returns Parsed WebElementComponent object
 */
function parseWebElementProperties(
  componentProperty: Property,
  elementResource: OchreResource,
): WebElementComponent {
  const unparsedComponentName = componentProperty.values[0]!.content;
  const { data: componentName } = componentSchema.safeParse(
    unparsedComponentName,
  );

  let properties: WebElementComponent | null = null;

  const links =
    elementResource.links ?
      parseLinks(
        Array.isArray(elementResource.links) ?
          elementResource.links
        : [elementResource.links],
      )
    : [];

  switch (componentName) {
    case "3d-viewer": {
      const resourceLink = links.find(
        (link) =>
          link.category === "resource" && link.fileFormat === "model/obj",
      );
      if (resourceLink?.uuid == null) {
        throw new Error(
          `Resource link not found for the following component: “${componentName}”`,
        );
      }

      let isInteractive = getPropertyValueByLabel(
        componentProperty.properties,
        "is-interactive",
      ) as
        | Extract<
            WebElementComponent,
            { component: "3d-viewer" }
          >["isInteractive"]
        | null;
      isInteractive ??= true;

      let isControlsDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "controls-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "3d-viewer" }
          >["isControlsDisplayed"]
        | null;
      isControlsDisplayed ??= true;

      properties = {
        component: "3d-viewer",
        linkUuid: resourceLink.uuid,
        fileSize: resourceLink.fileSize,
        isInteractive,
        isControlsDisplayed,
      };
      break;
    }
    case "advanced-search": {
      const boundElementPropertyUuid =
        getPropertyByLabel(componentProperty.properties, "bound-element")
          ?.values[0]?.uuid ?? null;

      const linkToProperty = getPropertyByLabel(
        componentProperty.properties,
        "link-to",
      );
      const href =
        linkToProperty?.values[0]?.href ??
        linkToProperty?.values[0]?.slug ??
        null;

      if (boundElementPropertyUuid == null && href == null) {
        throw new Error(
          `Bound element or href not found for the following component: “${componentName}”`,
        );
      }

      properties = {
        component: "advanced-search",
        boundElementUuid: boundElementPropertyUuid,
        href,
      };
      break;
    }
    case "annotated-document": {
      const documentLink = links.find(
        (link) => link.type === "internalDocument",
      );
      if (documentLink?.uuid == null) {
        throw new Error(
          `Document link not found for the following component: “${componentName}”`,
        );
      }

      properties = {
        component: "annotated-document",
        linkUuid: documentLink.uuid,
      };
      break;
    }
    case "annotated-image": {
      const imageLinks = links.filter(
        (link) => link.type === "image" || link.type === "IIIF",
      );

      if (imageLinks.length === 0 || imageLinks[0]!.uuid == null) {
        throw new Error(
          `Image link not found for the following component: “${componentName}”`,
        );
      }

      let isFilterInputDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "filter-input-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "annotated-image" }
          >["isFilterInputDisplayed"]
        | null;
      isFilterInputDisplayed ??= true;

      let isOptionsDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "options-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "annotated-image" }
          >["isOptionsDisplayed"]
        | null;
      isOptionsDisplayed ??= true;

      let isAnnotationHighlightsDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "annotation-highlights-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "annotated-image" }
          >["isAnnotationHighlightsDisplayed"]
        | null;
      isAnnotationHighlightsDisplayed ??= true;

      let isAnnotationTooltipsDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "annotation-tooltips-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "annotated-image" }
          >["isAnnotationTooltipsDisplayed"]
        | null;
      isAnnotationTooltipsDisplayed ??= true;

      properties = {
        component: "annotated-image",
        linkUuid: imageLinks[0]!.uuid,
        isFilterInputDisplayed,
        isOptionsDisplayed,
        isAnnotationHighlightsDisplayed,
        isAnnotationTooltipsDisplayed,
      };
      break;
    }
    case "audio-player": {
      const audioLink = links.find((link) => link.type === "audio");
      if (audioLink?.uuid == null) {
        throw new Error(
          `Audio link not found for the following component: “${componentName}”`,
        );
      }

      let isSpeedControlsDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "speed-controls-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "audio-player" }
          >["isSpeedControlsDisplayed"]
        | null;
      isSpeedControlsDisplayed ??= true;

      let isVolumeControlsDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "volume-controls-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "audio-player" }
          >["isVolumeControlsDisplayed"]
        | null;
      isVolumeControlsDisplayed ??= true;

      let isSeekBarDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "seek-bar-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "audio-player" }
          >["isSeekBarDisplayed"]
        | null;
      isSeekBarDisplayed ??= true;

      properties = {
        component: "audio-player",
        linkUuid: audioLink.uuid,
        isSpeedControlsDisplayed,
        isVolumeControlsDisplayed,
        isSeekBarDisplayed,
      };
      break;
    }
    case "bibliography": {
      const itemLinks = links.filter(
        (link) => link.category !== "bibliography",
      );
      const bibliographyLink = links.find(
        (link) => link.category === "bibliography",
      );
      if (itemLinks.length === 0 && bibliographyLink?.bibliographies == null) {
        throw new Error(
          `No links found for the following component: “${componentName}”`,
        );
      }

      let layout = getPropertyValueByLabel(
        componentProperty.properties,
        "layout",
      ) as
        | Extract<WebElementComponent, { component: "bibliography" }>["layout"]
        | null;
      layout ??= "long";

      let isSourceDocumentDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "source-document-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "bibliography" }
          >["isSourceDocumentDisplayed"]
        | null;
      isSourceDocumentDisplayed ??= true;

      properties = {
        component: "bibliography",
        linkUuids: itemLinks
          .map((link) => link.uuid)
          .filter((uuid) => uuid !== null),
        bibliographies: bibliographyLink?.bibliographies ?? [],
        layout,
        isSourceDocumentDisplayed,
      };
      break;
    }
    case "button": {
      let variant = getPropertyValueByLabel(
        componentProperty.properties,
        "variant",
      ) as
        | Extract<WebElementComponent, { component: "button" }>["variant"]
        | null;
      variant ??= "default";

      let isExternal = false;
      const navigateToProperty = getPropertyByLabel(
        componentProperty.properties,
        "navigate-to",
      );

      let href =
        navigateToProperty?.values[0]?.href ??
        navigateToProperty?.values[0]?.slug ??
        null;

      if (href === null) {
        const linkToProperty = getPropertyByLabel(
          componentProperty.properties,
          "link-to",
        );
        href =
          linkToProperty?.values[0]?.href ??
          linkToProperty?.values[0]?.slug ??
          null;

        if (href === null) {
          throw new Error(
            `Properties “navigate-to” or “link-to” not found for the following component: “${componentName}”`,
          );
        } else {
          isExternal = true;
        }
      }

      let startIcon = getPropertyValueByLabel(
        componentProperty.properties,
        "start-icon",
      ) as
        | Extract<WebElementComponent, { component: "button" }>["startIcon"]
        | null;
      startIcon ??= null;

      let endIcon = getPropertyValueByLabel(
        componentProperty.properties,
        "end-icon",
      ) as
        | Extract<WebElementComponent, { component: "button" }>["endIcon"]
        | null;
      endIcon ??= null;

      let image: WebImage | null = null;
      const imageLink = links.find(
        (link) => link.type === "image" || link.type === "IIIF",
      );
      if (imageLink != null) {
        image = {
          uuid: imageLink.uuid,
          label: imageLink.identification?.label ?? null,
          width: imageLink.image?.width ?? 0,
          height: imageLink.image?.height ?? 0,
          description: imageLink.description ?? null,
          quality: "high",
        };
      }

      properties = {
        component: "button",
        variant,
        href,
        isExternal,
        label:
          elementResource.document && "content" in elementResource.document ?
            parseDocument(elementResource.document.content)
          : null,
        startIcon,
        endIcon,
        image,
      };

      break;
    }
    case "collection": {
      const collectionLinks = links.filter((link) => link.category === "set");
      if (collectionLinks.every((link) => link.uuid === null)) {
        throw new Error(
          `Collection links not found for the following component: “${componentName}”`,
        );
      }

      const displayedProperties = getPropertyByLabel(
        componentProperty.properties,
        "use-property",
      );

      let variant = getPropertyValueByLabel(
        componentProperty.properties,
        "variant",
      ) as
        | Extract<WebElementComponent, { component: "collection" }>["variant"]
        | null;
      variant ??= "full";

      let itemVariant = getPropertyValueByLabel(
        componentProperty.properties,
        "item-variant",
      ) as
        | Extract<
            WebElementComponent,
            { component: "collection" }
          >["itemVariant"]
        | null;
      itemVariant ??= "detailed";

      let paginationVariant = getPropertyValueByLabel(
        componentProperty.properties,
        "pagination-variant",
      ) as
        | Extract<
            WebElementComponent,
            { component: "collection" }
          >["paginationVariant"]
        | null;
      paginationVariant ??= "default";

      let imageQuality = getPropertyValueByLabel(
        componentProperty.properties,
        "image-quality",
      ) as
        | Extract<
            WebElementComponent,
            { component: "collection" }
          >["imageQuality"]
        | null;
      imageQuality ??= "low";

      let isUsingQueryParams = getPropertyValueByLabel(
        componentProperty.properties,
        "is-using-query-params",
      ) as
        | Extract<
            WebElementComponent,
            { component: "collection" }
          >["isUsingQueryParams"]
        | null;
      isUsingQueryParams ??= false;

      let isFilterResultsBarDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "filter-results-bar-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "collection" }
          >["filter"]["isResultsBarDisplayed"]
        | null;
      isFilterResultsBarDisplayed ??= false;

      let isFilterMapDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "filter-map-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "collection" }
          >["filter"]["isMapDisplayed"]
        | null;
      isFilterMapDisplayed ??= false;

      let isFilterInputDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "filter-input-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "collection" }
          >["filter"]["isInputDisplayed"]
        | null;
      isFilterInputDisplayed ??= false;

      let isFilterLimitedToTitleQuery = getPropertyValueByLabel(
        componentProperty.properties,
        "filter-limit-to-title-query",
      ) as
        | Extract<
            WebElementComponent,
            { component: "collection" }
          >["filter"]["isLimitedToTitleQuery"]
        | null;
      isFilterLimitedToTitleQuery ??= false;

      let isFilterLimitedToLeafPropertyValues = getPropertyValueByLabel(
        componentProperty.properties,
        "filter-limit-to-leaf-property-values",
      ) as
        | Extract<
            WebElementComponent,
            { component: "collection" }
          >["filter"]["isLimitedToLeafPropertyValues"]
        | null;
      isFilterLimitedToLeafPropertyValues ??= false;

      let isSortDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "sort-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "collection" }
          >["isSortDisplayed"]
        | null;
      isSortDisplayed ??= false;

      let isFilterSidebarDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "filter-sidebar-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "collection" }
          >["filter"]["isSidebarDisplayed"]
        | null;
      isFilterSidebarDisplayed ??= false;

      let filterSidebarSort = getPropertyValueByLabel(
        componentProperty.properties,
        "filter-sidebar-sort",
      ) as
        | Extract<
            WebElementComponent,
            { component: "collection" }
          >["filter"]["sidebarSort"]
        | null;
      filterSidebarSort ??= "default";

      let layout = getPropertyValueByLabel(
        componentProperty.properties,
        "layout",
      ) as
        | Extract<WebElementComponent, { component: "collection" }>["layout"]
        | null;
      layout ??= "image-start";

      const options: Extract<
        WebElementComponent,
        { component: "collection" }
      >["options"] = {
        attributeFilters: {
          bibliographies: elementResource.options?.filterBibliography ?? false,
          periods: elementResource.options?.filterPeriods ?? false,
        },
        scopes:
          elementResource.options?.scopes != null ?
            (Array.isArray(elementResource.options.scopes.scope) ?
              elementResource.options.scopes.scope
            : [elementResource.options.scopes.scope]
            ).map((scope) => ({
              uuid: scope.uuid.content,
              type: scope.uuid.type,
              identification: parseIdentification(scope.identification),
            }))
          : null,
        contexts: null,
        labels: { title: null },
      };

      if ("options" in elementResource && elementResource.options) {
        const flattenContextsRaw =
          elementResource.options.flattenContexts != null ?
            Array.isArray(elementResource.options.flattenContexts) ?
              elementResource.options.flattenContexts
            : [elementResource.options.flattenContexts]
          : [];
        const suppressContextsRaw =
          elementResource.options.suppressContexts != null ?
            Array.isArray(elementResource.options.suppressContexts) ?
              elementResource.options.suppressContexts
            : [elementResource.options.suppressContexts]
          : [];
        const filterContextsRaw =
          elementResource.options.filterContexts != null ?
            Array.isArray(elementResource.options.filterContexts) ?
              elementResource.options.filterContexts
            : [elementResource.options.filterContexts]
          : [];
        const sortContextsRaw =
          elementResource.options.sortContexts != null ?
            Array.isArray(elementResource.options.sortContexts) ?
              elementResource.options.sortContexts
            : [elementResource.options.sortContexts]
          : [];
        const detailContextsRaw =
          elementResource.options.detailContexts != null ?
            Array.isArray(elementResource.options.detailContexts) ?
              elementResource.options.detailContexts
            : [elementResource.options.detailContexts]
          : [];
        const downloadContextsRaw =
          elementResource.options.downloadContexts != null ?
            Array.isArray(elementResource.options.downloadContexts) ?
              elementResource.options.downloadContexts
            : [elementResource.options.downloadContexts]
          : [];
        const labelContextsRaw =
          elementResource.options.labelContexts != null ?
            Array.isArray(elementResource.options.labelContexts) ?
              elementResource.options.labelContexts
            : [elementResource.options.labelContexts]
          : [];
        const prominentContextsRaw =
          elementResource.options.prominentContexts != null ?
            Array.isArray(elementResource.options.prominentContexts) ?
              elementResource.options.prominentContexts
            : [elementResource.options.prominentContexts]
          : [];

        options.contexts = {
          flatten: parseContexts(flattenContextsRaw),
          filter: parseContexts(filterContextsRaw),
          sort: parseContexts(sortContextsRaw),
          detail: parseContexts(detailContextsRaw),
          download: parseContexts(downloadContextsRaw),
          label: parseContexts(labelContextsRaw),
          suppress: parseContexts(suppressContextsRaw),
          prominent: parseContexts(prominentContextsRaw),
        };

        if (
          "notes" in elementResource.options &&
          elementResource.options.notes
        ) {
          const labelNotes = parseNotes(
            Array.isArray(elementResource.options.notes.note) ?
              elementResource.options.notes.note
            : [elementResource.options.notes.note],
          );
          options.labels.title =
            labelNotes.find((note) => note.title === "Title label")?.content ??
            null;
        }
      }

      properties = {
        component: "collection",
        linkUuids: collectionLinks
          .map((link) => link.uuid)
          .filter((uuid) => uuid !== null),
        displayedProperties:
          displayedProperties?.values
            .filter(({ uuid }) => uuid !== null)
            .map((value) => ({
              uuid: value.uuid!,
              label: value.content?.toString() ?? "",
            })) ?? null,
        variant,
        itemVariant,
        paginationVariant,
        layout,
        imageQuality,
        isUsingQueryParams,
        isSortDisplayed,
        filter: {
          isSidebarDisplayed: isFilterSidebarDisplayed,
          isResultsBarDisplayed: isFilterResultsBarDisplayed,
          isMapDisplayed: isFilterMapDisplayed,
          isInputDisplayed: isFilterInputDisplayed,
          isLimitedToTitleQuery: isFilterLimitedToTitleQuery,
          isLimitedToLeafPropertyValues: isFilterLimitedToLeafPropertyValues,
          sidebarSort: filterSidebarSort,
        },
        options,
      };
      break;
    }
    case "empty-space": {
      const height = getPropertyValueByLabel(
        componentProperty.properties,
        "height",
      ) as string | number | null;
      const width = getPropertyValueByLabel(
        componentProperty.properties,
        "width",
      ) as string | number | null;

      properties = {
        component: "empty-space",
        height: height?.toString() ?? null,
        width: width?.toString() ?? null,
      };
      break;
    }
    case "entries": {
      const entriesLink = links.find(
        (link) => link.category === "tree" || link.category === "set",
      );
      if (entriesLink?.uuid == null) {
        throw new Error(
          `Entries link not found for the following component: “${componentName}”`,
        );
      }

      let variant = getPropertyValueByLabel(
        componentProperty.properties,
        "variant",
      ) as
        | Extract<WebElementComponent, { component: "entries" }>["variant"]
        | null;
      variant ??= "entry";

      let isFilterInputDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "filter-input-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "entries" }
          >["isFilterInputDisplayed"]
        | null;
      isFilterInputDisplayed ??= false;

      properties = {
        component: "entries",
        linkUuid: entriesLink.uuid,
        variant,
        isFilterInputDisplayed,
      };
      break;
    }
    case "iframe": {
      const href = links.find((link) => link.type === "webpage")?.href as
        | string
        | null;
      if (!href) {
        throw new Error(
          `URL not found for the following component: “${componentName}”`,
        );
      }

      const height = getPropertyValueByLabel(
        componentProperty.properties,
        "height",
      );
      const width = getPropertyValueByLabel(
        componentProperty.properties,
        "width",
      );

      properties = {
        component: "iframe",
        href,
        height: height?.toString() ?? null,
        width: width?.toString() ?? null,
      };
      break;
    }
    case "iiif-viewer": {
      const manifestLink = links.find((link) => link.type === "IIIF");
      if (manifestLink?.uuid == null) {
        throw new Error(
          `Manifest link not found for the following component: “${componentName}”`,
        );
      }

      let variant = getPropertyValueByLabel(
        componentProperty.properties,
        "variant",
      ) as
        | Extract<WebElementComponent, { component: "iiif-viewer" }>["variant"]
        | null;
      variant ??= "universal-viewer";

      properties = {
        component: "iiif-viewer",
        linkUuid: manifestLink.uuid,
        variant,
      };
      break;
    }
    case "image": {
      if (links.length === 0) {
        throw new Error(
          `No links found for the following component: “${componentName}”`,
        );
      }

      let imageQuality = getPropertyValueByLabel(
        componentProperty.properties,
        "image-quality",
      ) as
        | Extract<WebElementComponent, { component: "image" }>["imageQuality"]
        | null;
      imageQuality ??= "high";

      const images: Array<WebImage> = [];
      for (const link of links) {
        if (link.uuid === null) {
          continue;
        }

        images.push({
          uuid: link.uuid,
          label: link.identification?.label ?? null,
          width: link.image?.width ?? 0,
          height: link.image?.height ?? 0,
          description: link.description ?? null,
          quality: imageQuality,
        });
      }

      let variant = getPropertyValueByLabel(
        componentProperty.properties,
        "variant",
      ) as
        | Extract<WebElementComponent, { component: "image" }>["variant"]
        | null;
      variant ??= "default";

      let captionLayout = getPropertyValueByLabel(
        componentProperty.properties,
        "layout-caption",
      ) as
        | Extract<WebElementComponent, { component: "image" }>["captionLayout"]
        | null;
      captionLayout ??= "bottom";

      let width: number | null = null;
      const widthProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "width",
      ) as string | number | null;
      if (widthProperty !== null) {
        if (typeof widthProperty === "number") {
          width = widthProperty;
        } else if (typeof widthProperty === "string") {
          width = Number.parseFloat(widthProperty);
        }
      }

      let height: number | null = null;
      const heightProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "height",
      ) as string | number | null;
      if (heightProperty !== null) {
        if (typeof heightProperty === "number") {
          height = heightProperty;
        } else if (typeof heightProperty === "string") {
          height = Number.parseFloat(heightProperty);
        }
      }

      let isFullWidth = getPropertyValueByLabel(
        componentProperty.properties,
        "is-full-width",
      ) as
        | Extract<WebElementComponent, { component: "image" }>["isFullWidth"]
        | null;
      isFullWidth ??= true;

      let isFullHeight = getPropertyValueByLabel(
        componentProperty.properties,
        "is-full-height",
      ) as
        | Extract<WebElementComponent, { component: "image" }>["isFullHeight"]
        | null;
      isFullHeight ??= true;

      let captionSource = getPropertyValueByLabel(
        componentProperty.properties,
        "source-caption",
      ) as
        | Extract<WebElementComponent, { component: "image" }>["captionSource"]
        | null;
      captionSource ??= "name";

      let altTextSource = getPropertyValueByLabel(
        componentProperty.properties,
        "alt-text-source",
      ) as
        | Extract<WebElementComponent, { component: "image" }>["altTextSource"]
        | null;
      altTextSource ??= "name";

      let isTransparentBackground = getPropertyValueByLabel(
        componentProperty.properties,
        "is-transparent",
      ) as
        | Extract<
            WebElementComponent,
            { component: "image" }
          >["isTransparentBackground"]
        | null;
      isTransparentBackground ??= false;

      let isCover = getPropertyValueByLabel(
        componentProperty.properties,
        "is-cover",
      ) as
        | Extract<WebElementComponent, { component: "image" }>["isCover"]
        | null;
      isCover ??= false;

      const variantProperty = getPropertyByLabel(
        componentProperty.properties,
        "variant",
      );

      let carouselOptions:
        | Extract<
            WebElementComponent,
            { component: "image" }
          >["carouselOptions"]
        | null = null;
      if (images.length > 1) {
        let secondsPerImage = 5;

        if (variantProperty?.values[0]!.content === "carousel") {
          const secondsPerImageProperty = getPropertyValueByLabel(
            variantProperty.properties,
            "seconds-per-image",
          ) as string | number | null;
          if (secondsPerImageProperty !== null) {
            if (typeof secondsPerImageProperty === "number") {
              secondsPerImage = secondsPerImageProperty;
            } else if (typeof secondsPerImageProperty === "string") {
              secondsPerImage = Number.parseFloat(secondsPerImageProperty);
            }
          }
        }

        carouselOptions = { secondsPerImage };
      }

      let heroOptions: Extract<
        WebElementComponent,
        { component: "image" }
      >["heroOptions"] = null;
      if (variantProperty?.values[0]!.content === "hero") {
        let isBackgroundImageDisplayed = getPropertyValueByLabel(
          variantProperty.properties,
          "background-image-displayed",
        ) as
          | NonNullable<
              Extract<
                WebElementComponent,
                { component: "image" }
              >["heroOptions"]
            >["isBackgroundImageDisplayed"]
          | null;
        isBackgroundImageDisplayed ??= true;

        let isDocumentDisplayed = getPropertyValueByLabel(
          variantProperty.properties,
          "document-displayed",
        ) as
          | NonNullable<
              Extract<
                WebElementComponent,
                { component: "image" }
              >["heroOptions"]
            >["isDocumentDisplayed"]
          | null;
        isDocumentDisplayed ??= true;

        heroOptions = { isBackgroundImageDisplayed, isDocumentDisplayed };
      }

      properties = {
        component: "image",
        images,
        variant,
        width,
        height,
        isFullWidth,
        isFullHeight,
        imageQuality,
        captionLayout,
        captionSource,
        altTextSource,
        isTransparentBackground,
        isCover,
        carouselOptions,
        heroOptions,
      };
      break;
    }
    case "image-gallery": {
      const galleryLink = links.find(
        (link) => link.category === "tree" || link.category === "set",
      );
      if (galleryLink?.uuid == null) {
        throw new Error(
          `Image gallery link not found for the following component: “${componentName}”`,
        );
      }

      let isFilterInputDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "filter-input-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "image-gallery" }
          >["isFilterInputDisplayed"]
        | null;
      isFilterInputDisplayed ??= true;

      properties = {
        component: "image-gallery",
        linkUuid: galleryLink.uuid,
        isFilterInputDisplayed,
      };
      break;
    }
    case "map": {
      const mapLink = links.find(
        (link) => link.category === "set" || link.category === "tree",
      );
      if (mapLink?.uuid == null) {
        throw new Error(
          `Map link not found for the following component: “${componentName}”`,
        );
      }

      let isInteractive = getPropertyValueByLabel(
        componentProperty.properties,
        "is-interactive",
      ) as
        | Extract<WebElementComponent, { component: "map" }>["isInteractive"]
        | null;
      isInteractive ??= true;

      let isClustered = getPropertyValueByLabel(
        componentProperty.properties,
        "is-clustered",
      ) as
        | Extract<WebElementComponent, { component: "map" }>["isClustered"]
        | null;
      isClustered ??= false;

      let isUsingPins = getPropertyValueByLabel(
        componentProperty.properties,
        "is-using-pins",
      ) as
        | Extract<WebElementComponent, { component: "map" }>["isUsingPins"]
        | null;
      isUsingPins ??= false;

      let customBasemap = getPropertyValueByLabel(
        componentProperty.properties,
        "custom-basemap",
      ) as
        | Extract<WebElementComponent, { component: "map" }>["customBasemap"]
        | null;
      customBasemap ??= null;

      let initialBounds:
        | Extract<WebElementComponent, { component: "map" }>["initialBounds"]
        | null = null;
      const initialBoundsProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "initial-bounds",
      ) as string | number | null;
      if (initialBoundsProperty !== null) {
        initialBounds = parseBounds(String(initialBoundsProperty));
      }

      let maximumBounds:
        | Extract<WebElementComponent, { component: "map" }>["maximumBounds"]
        | null = null;
      const maximumBoundsProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "maximum-bounds",
      ) as string | number | null;
      if (maximumBoundsProperty !== null) {
        maximumBounds = parseBounds(String(maximumBoundsProperty));
      }

      let isControlsDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "controls-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "map" }
          >["isControlsDisplayed"]
        | null;
      isControlsDisplayed ??= false;

      let isFullHeight = getPropertyValueByLabel(
        componentProperty.properties,
        "is-full-height",
      ) as
        | Extract<WebElementComponent, { component: "map" }>["isFullHeight"]
        | null;
      isFullHeight ??= false;

      properties = {
        component: "map",
        linkUuid: mapLink.uuid,
        customBasemap,
        initialBounds,
        maximumBounds,
        isInteractive,
        isClustered,
        isUsingPins,
        isControlsDisplayed,
        isFullHeight,
      };
      break;
    }
    case "query": {
      const queries: Array<
        Extract<WebElementComponent, { component: "query" }>["queries"][number]
      > = [];

      let itemCategory = getPropertyValueByLabel(
        componentProperty.properties,
        "item-category",
      ) as
        | Extract<WebElementComponent, { component: "query" }>["itemCategory"]
        | null;
      itemCategory ??= null;

      if (componentProperty.properties.length === 0) {
        throw new Error(
          `Query properties not found for the following component: “${componentName}”`,
        );
      }

      for (const query of componentProperty.properties) {
        const querySubProperties = query.properties;

        const label = getPropertyValueByLabel(
          querySubProperties,
          "query-prompt",
        ) as
          | Extract<
              WebElementComponent,
              { component: "query" }
            >["queries"][number]["label"]
          | null;
        if (label === null) {
          continue;
        }

        const propertyVariableUuids =
          getPropertyByLabel(querySubProperties, "use-property")
            ?.values.map((value) => value.uuid)
            .filter((uuid) => uuid !== null) ?? [];

        let startIcon = getPropertyValueByLabel(
          querySubProperties,
          "start-icon",
        ) as
          | Extract<
              WebElementComponent,
              { component: "query" }
            >["queries"][number]["startIcon"]
          | null;
        startIcon ??= null;

        let endIcon = getPropertyValueByLabel(
          querySubProperties,
          "end-icon",
        ) as
          | Extract<
              WebElementComponent,
              { component: "query" }
            >["queries"][number]["endIcon"]
          | null;
        endIcon ??= null;

        queries.push({ label, propertyVariableUuids, startIcon, endIcon });
      }

      if (queries.length === 0) {
        throw new Error(
          `No queries found for the following component: “${componentName}”`,
        );
      }

      const displayedProperties = getPropertyByLabel(
        componentProperty.properties,
        "use-property",
      );

      let itemVariant = getPropertyValueByLabel(
        componentProperty.properties,
        "item-variant",
      ) as
        | Extract<WebElementComponent, { component: "query" }>["itemVariant"]
        | null;
      itemVariant ??= "detailed";

      let paginationVariant = getPropertyValueByLabel(
        componentProperty.properties,
        "pagination-variant",
      ) as
        | Extract<
            WebElementComponent,
            { component: "query" }
          >["paginationVariant"]
        | null;
      paginationVariant ??= "default";

      let layout = getPropertyValueByLabel(
        componentProperty.properties,
        "layout",
      ) as
        | Extract<WebElementComponent, { component: "query" }>["layout"]
        | null;
      layout ??= "image-start";

      properties = {
        component: "query",
        itemCategory,
        queries,
        displayedProperties:
          displayedProperties?.values
            .filter((value) => value.uuid !== null)
            .map((value) => ({
              uuid: value.uuid!,
              label: value.content?.toString() ?? "",
            })) ?? null,
        itemVariant,
        paginationVariant,
        layout,
      };
      break;
    }
    case "table": {
      const tableLink = links.find((link) => link.category === "set");
      if (tableLink?.uuid == null) {
        throw new Error(
          `Table link not found for the following component: “${componentName}”`,
        );
      }

      properties = { component: "table", linkUuid: tableLink.uuid };
      break;
    }
    case "search-bar": {
      let queryVariant:
        | Extract<
            WebElementComponent,
            { component: "search-bar" }
          >["queryVariant"]
        | null = null;
      queryVariant = getPropertyValueByLabel(
        componentProperty.properties,
        "query-variant",
      ) as
        | Extract<
            WebElementComponent,
            { component: "search-bar" }
          >["queryVariant"]
        | null;
      queryVariant ??= "submit";

      const boundElementUuid =
        getPropertyByLabel(componentProperty.properties, "bound-element")
          ?.values[0]?.uuid ?? null;

      const linkToProperty = getPropertyByLabel(
        componentProperty.properties,
        "link-to",
      );
      const href =
        linkToProperty?.values[0]?.href ??
        linkToProperty?.values[0]?.slug ??
        null;

      if (!boundElementUuid && !href) {
        throw new Error(
          `Bound element or href not found for the following component: “${componentName}”`,
        );
      }

      let placeholder = getPropertyValueByLabel(
        componentProperty.properties,
        "placeholder-text",
      ) as
        | Extract<
            WebElementComponent,
            { component: "search-bar" }
          >["placeholder"]
        | null;
      placeholder ??= null;

      let baseFilterQueries = getPropertyValueByLabel(
        componentProperty.properties,
        "base-filter-queries",
      ) as
        | Extract<
            WebElementComponent,
            { component: "search-bar" }
          >["baseFilterQueries"]
        | null;
      baseFilterQueries ??= null;

      properties = {
        component: "search-bar",
        queryVariant,
        placeholder,
        baseFilterQueries:
          baseFilterQueries
            ?.replaceAll(String.raw`\{`, "{")
            .replaceAll(String.raw`\}`, "}") ?? null,
        boundElementUuid,
        href,
      };
      break;
    }
    case "text": {
      const content =
        elementResource.document && "content" in elementResource.document ?
          parseDocument(elementResource.document.content as OchreStringRichText)
        : null;
      if (!content) {
        throw new Error(
          `Content not found for the following component: “${componentName}”`,
        );
      }

      let variantName: Extract<
        WebElementComponent,
        { component: "text" }
      >["variant"]["name"] = "block";
      let variant: Extract<
        WebElementComponent,
        { component: "text" }
      >["variant"];

      const variantProperty = getPropertyByLabel(
        componentProperty.properties,
        "variant",
      );
      if (variantProperty !== null) {
        variantName = variantProperty.values[0]!.content as Extract<
          WebElementComponent,
          { component: "text" }
        >["variant"]["name"];

        if (
          variantName === "paragraph" ||
          variantName === "label" ||
          variantName === "heading" ||
          variantName === "display"
        ) {
          let size = getPropertyValueByLabel(
            variantProperty.properties,
            "size",
          ) as "xs" | "sm" | "md" | "lg" | null;
          size ??= "md";

          variant = { name: variantName, size };
        } else {
          variant = { name: variantName };
        }
      } else {
        variant = { name: variantName };
      }

      let headingLevel = getPropertyValueByLabel(
        componentProperty.properties,
        "heading-level",
      ) as
        | Extract<WebElementComponent, { component: "text" }>["headingLevel"]
        | null;
      headingLevel ??= null;

      properties = { component: "text", variant, headingLevel, content };
      break;
    }
    case "timeline": {
      const timelineLink = links.find((link) => link.category === "tree");
      if (timelineLink?.uuid == null) {
        throw new Error(
          `Timeline link not found for the following component: “${componentName}”`,
        );
      }

      properties = { component: "timeline", linkUuid: timelineLink.uuid };
      break;
    }
    case "video": {
      const videoLink = links.find((link) => link.type === "video");
      if (videoLink?.uuid == null) {
        throw new Error(
          `Video link not found for the following component: “${componentName}”`,
        );
      }

      let isChaptersDisplayed = getPropertyValueByLabel(
        componentProperty.properties,
        "chapters-displayed",
      ) as
        | Extract<
            WebElementComponent,
            { component: "video" }
          >["isChaptersDisplayed"]
        | null;
      isChaptersDisplayed ??= true;

      properties = {
        component: "video",
        linkUuid: videoLink.uuid,
        isChaptersDisplayed,
      };
      break;
    }
    default: {
      console.warn(
        `Invalid or non-implemented component name “${unparsedComponentName?.toString() ?? "(unknown)"}” for the following element: “${parseStringContent(
          elementResource.identification.label as OchreStringContent,
        )}”`,
      );
      break;
    }
  }

  if (properties === null) {
    throw new Error(
      `Properties not found for the following component: “${componentName}”`,
    );
  }

  return properties;
}

function parseWebTitle(
  properties: Array<Property>,
  identification: Identification,
  overrides?: Partial<WebTitle["properties"]>,
): WebTitle {
  const title: WebTitle = {
    label: identification.label,
    variant: "default",
    properties: {
      isNameDisplayed: overrides?.isNameDisplayed ?? false,
      isDescriptionDisplayed: overrides?.isDescriptionDisplayed ?? false,
      isDateDisplayed: overrides?.isDateDisplayed ?? false,
      isCreatorsDisplayed: overrides?.isCreatorsDisplayed ?? false,
      isCountDisplayed: overrides?.isCountDisplayed ?? false,
    },
  };

  const titleProperties =
    getPropertyByLabelAndValue(properties, "presentation", "title")
      ?.properties ?? [];
  if (titleProperties.length > 0) {
    title.variant =
      (getPropertyValueByLabel(titleProperties, "variant") as
        | WebTitle["variant"]
        | null) ?? "default";

    title.properties.isNameDisplayed =
      (getPropertyValueByLabel(titleProperties, "name-displayed") as
        | WebTitle["properties"]["isNameDisplayed"]
        | null) ?? false;

    title.properties.isDescriptionDisplayed =
      (getPropertyValueByLabel(titleProperties, "description-displayed") as
        | WebTitle["properties"]["isDescriptionDisplayed"]
        | null) ?? false;

    title.properties.isDateDisplayed =
      (getPropertyValueByLabel(titleProperties, "date-displayed") as
        | WebTitle["properties"]["isDateDisplayed"]
        | null) ?? false;

    title.properties.isCreatorsDisplayed =
      (getPropertyValueByLabel(titleProperties, "creators-displayed") as
        | WebTitle["properties"]["isCreatorsDisplayed"]
        | null) ?? false;

    title.properties.isCountDisplayed =
      (getPropertyValueByLabel(titleProperties, "count-displayed") as
        | WebTitle["properties"]["isCountDisplayed"]
        | null) ?? false;
  }

  return title;
}

/**
 * Parses raw web element data into a standardized WebElement structure
 *
 * @param elementResource - Raw element resource data in OCHRE format
 * @returns Parsed WebElement object
 */
function parseWebElement(elementResource: OchreResource): WebElement {
  const identification = parseIdentification(elementResource.identification);

  const elementProperties =
    elementResource.properties?.property ?
      parseProperties(
        Array.isArray(elementResource.properties.property) ?
          elementResource.properties.property
        : [elementResource.properties.property],
      )
    : [];

  const presentationProperty = getPropertyByLabel(
    elementProperties,
    "presentation",
  );
  if (presentationProperty === null) {
    throw new Error(
      `Presentation property not found for element “${identification.label}”`,
    );
  }

  const componentProperty = getPropertyByLabel(
    presentationProperty.properties,
    "component",
  );
  if (componentProperty === null) {
    throw new Error(
      `Component for element “${identification.label}” not found`,
    );
  }

  const properties = parseWebElementProperties(
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
    getPropertyByLabelAndValue(elementResourceProperties, "presentation", "css")
      ?.properties ?? [];

  const cssStyles: Array<Style> = [];
  for (const property of cssProperties) {
    const cssStyle = property.values[0]!.content?.toString();
    if (cssStyle != null) {
      cssStyles.push({ label: property.label, value: cssStyle });
    }
  }

  const tabletCssProperties =
    getPropertyByLabelAndValue(
      elementResourceProperties,
      "presentation",
      "css-tablet",
    )?.properties ?? [];

  const cssStylesTablet: Array<Style> = [];
  for (const property of tabletCssProperties) {
    const cssStyle = property.values[0]!.content?.toString();
    if (cssStyle != null) {
      cssStylesTablet.push({ label: property.label, value: cssStyle });
    }
  }

  const mobileCssProperties =
    getPropertyByLabelAndValue(
      elementResourceProperties,
      "presentation",
      "css-mobile",
    )?.properties ?? [];

  const cssStylesMobile: Array<Style> = [];
  for (const property of mobileCssProperties) {
    const cssStyle = property.values[0]!.content?.toString();
    if (cssStyle != null) {
      cssStylesMobile.push({ label: property.label, value: cssStyle });
    }
  }

  const title = parseWebTitle(elementResourceProperties, identification, {
    isNameDisplayed:
      properties.component === "annotated-image" ||
      properties.component === "annotated-document" ||
      properties.component === "collection",
    isCountDisplayed:
      properties.component === "collection" && properties.variant === "full",
  });

  return {
    uuid: elementResource.uuid,
    type: "element",
    title,
    cssStyles: {
      default: cssStyles,
      tablet: cssStylesTablet,
      mobile: cssStylesMobile,
    },
    ...properties,
  };
}

/**
 * Parses raw webpage data into a standardized Webpage structure
 *
 * @param webpageResource - Raw webpage resource data in OCHRE format
 * @returns Parsed Webpage object
 */
function parseWebpage(
  webpageResource: OchreResource,
  slugPrefix?: string,
): Webpage | null {
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
    getPropertyValueByLabel(webpageProperties, "presentation") !== "page"
  ) {
    return null;
  }

  const identification = parseIdentification(webpageResource.identification);

  // TODO: Remove this once OCHRE is updated to allow segment-unique slugs
  const slug = webpageResource.slug?.replace(/^\$[^-]*-/, "") ?? null;

  if (slug == null) {
    throw new Error(`Slug not found for page “${identification.label}”`);
  }

  const returnWebpage: Webpage = {
    uuid: webpageResource.uuid,
    type: "page",
    title: identification.label,
    slug:
      slugPrefix != null ? `${slugPrefix}/${slug}`.replace(/\/$/, "") : slug,
    publicationDateTime:
      webpageResource.publicationDateTime ?
        parseISO(webpageResource.publicationDateTime)
      : null,
    items: [],
    properties: {
      width: "default",
      variant: "default",
      isBreadcrumbsDisplayed: false,
      isSidebarDisplayed: true,
      isDisplayedInNavbar: true,
      isNavbarSearchBarDisplayed: true,
      backgroundImage: null,
      cssStyles: { default: [], tablet: [], mobile: [] },
    },
    webpages: [],
  };

  const links =
    webpageResource.links != null ?
      parseLinks(
        Array.isArray(webpageResource.links) ?
          webpageResource.links
        : [webpageResource.links],
      )
    : [];
  const imageLink = links.find(
    (link) => link.type === "image" || link.type === "IIIF",
  );

  const webpageResources =
    webpageResource.resource != null ?
      Array.isArray(webpageResource.resource) ?
        webpageResource.resource
      : [webpageResource.resource]
    : [];

  const items: Array<WebSegment | WebElement | WebBlock> = [];
  for (const resource of webpageResources) {
    const resourceProperties =
      resource.properties != null ?
        parseProperties(
          Array.isArray(resource.properties.property) ?
            resource.properties.property
          : [resource.properties.property],
        )
      : [];

    const resourceType = getPropertyValueByLabel(
      resourceProperties,
      "presentation",
    ) as "segment" | "element" | "block" | null;
    if (resourceType === null) {
      continue;
    }

    switch (resourceType) {
      case "segment": {
        const segment = parseWebSegment(resource);
        if (segment) {
          items.push(segment);
        }
        break;
      }
      case "element": {
        const element = parseWebElement(resource);
        items.push(element);
        break;
      }
      case "block": {
        const block = parseWebBlock(resource);
        if (block) {
          items.push(block);
        }
        break;
      }
    }
  }

  returnWebpage.webpages =
    webpageResource.resource != null ?
      parseWebpageResources(
        Array.isArray(webpageResource.resource) ?
          webpageResource.resource
        : [webpageResource.resource],
        "page",
      )
    : [];

  const webpageSubProperties =
    getPropertyByLabelAndValue(webpageProperties, "presentation", "page")
      ?.properties ?? [];

  if (webpageSubProperties.length > 0) {
    returnWebpage.properties.isDisplayedInNavbar =
      (getPropertyValueByLabel(webpageSubProperties, "displayed-in-navbar") as
        | Webpage["properties"]["isDisplayedInNavbar"]
        | null) ?? true;

    returnWebpage.properties.width =
      (getPropertyValueByLabel(webpageSubProperties, "width") as
        | Webpage["properties"]["width"]
        | null) ?? "default";

    returnWebpage.properties.variant =
      (getPropertyValueByLabel(webpageSubProperties, "variant") as
        | Webpage["properties"]["variant"]
        | null) ?? "default";

    returnWebpage.properties.isSidebarDisplayed =
      (getPropertyValueByLabel(webpageSubProperties, "sidebar-displayed") as
        | Webpage["properties"]["isSidebarDisplayed"]
        | null) ?? true;

    returnWebpage.properties.isBreadcrumbsDisplayed =
      (getPropertyValueByLabel(
        webpageSubProperties,
        "breadcrumbs-displayed",
      ) as Webpage["properties"]["isBreadcrumbsDisplayed"] | null) ?? false;

    returnWebpage.properties.isNavbarSearchBarDisplayed =
      (getPropertyValueByLabel(
        webpageSubProperties,
        "navbar-search-bar-displayed",
      ) as Webpage["properties"]["isNavbarSearchBarDisplayed"] | null) ?? true;
  }

  if (imageLink?.uuid != null) {
    returnWebpage.properties.backgroundImage = {
      uuid: imageLink.uuid,
      label: imageLink.identification?.label ?? null,
      description: imageLink.description ?? null,
      width: imageLink.image?.width ?? 0,
      height: imageLink.image?.height ?? 0,
      quality: "high",
    };
  }

  const cssStyleSubProperties =
    getPropertyByLabelAndValue(webpageProperties, "presentation", "css")
      ?.properties ?? [];
  const cssStyles: Array<Style> = [];
  for (const property of cssStyleSubProperties) {
    const cssStyle = property.values[0]!.content?.toString();
    if (cssStyle != null) {
      cssStyles.push({ label: property.label, value: cssStyle });
    }
  }

  const tabletCssStyleSubProperties =
    getPropertyByLabelAndValue(webpageProperties, "presentation", "css-tablet")
      ?.properties ?? [];
  const cssStylesTablet: Array<Style> = [];
  for (const property of tabletCssStyleSubProperties) {
    const cssStyle = property.values[0]!.content?.toString();
    if (cssStyle != null) {
      cssStylesTablet.push({ label: property.label, value: cssStyle });
    }
  }

  const mobileCssStyleSubProperties =
    getPropertyByLabelAndValue(webpageProperties, "presentation", "css-mobile")
      ?.properties ?? [];
  const cssStylesMobile: Array<Style> = [];
  for (const property of mobileCssStyleSubProperties) {
    const cssStyle = property.values[0]!.content?.toString();
    if (cssStyle != null) {
      cssStylesMobile.push({ label: property.label, value: cssStyle });
    }
  }

  return returnWebpage;
}

/**
 * Parses raw webpage resources into an array of Webpage objects
 *
 * @param webpageResources - Array of raw webpage resources in OCHRE format
 * @returns Array of parsed Webpage objects
 */
function parseWebpages(
  webpageResources: Array<OchreResource>,
  slugPrefix?: string,
): Array<Webpage> {
  const returnPages: Array<Webpage> = [];

  for (const webpageResource of webpageResources) {
    const webpage = parseWebpage(webpageResource, slugPrefix);
    if (webpage !== null) {
      returnPages.push(webpage);
    }
  }

  return returnPages;
}

/**
 * Parses raw segment resource into a standardized WebSegment object
 *
 * @param segmentResource - Raw segment resource in OCHRE format
 * @returns Parsed WebSegment object
 */
function parseWebSegment(
  segmentResource: OchreResource,
  slugPrefix?: string,
): WebSegment | null {
  const webpageProperties =
    segmentResource.properties ?
      parseProperties(
        Array.isArray(segmentResource.properties.property) ?
          segmentResource.properties.property
        : [segmentResource.properties.property],
      )
    : [];

  if (
    webpageProperties.length === 0 ||
    getPropertyValueByLabel(webpageProperties, "presentation") !== "segment"
  ) {
    return null;
  }

  const identification = parseIdentification(segmentResource.identification);

  const slug =
    segmentResource.identification.abbreviation != null ?
      typeof segmentResource.identification.abbreviation === "object" ?
        parseStringContent(segmentResource.identification.abbreviation)
      : parseFakeString(segmentResource.identification.abbreviation)
    : null;
  if (slug == null) {
    throw new Error(`Slug not found for segment “${identification.label}”`);
  }

  const returnSegment: WebSegment = {
    uuid: segmentResource.uuid,
    type: "segment",
    title: identification.label,
    slug,
    publicationDateTime:
      segmentResource.publicationDateTime ?
        parseISO(segmentResource.publicationDateTime)
      : null,
    items: [],
  };

  const childResources =
    segmentResource.resource ?
      Array.isArray(segmentResource.resource) ?
        segmentResource.resource
      : [segmentResource.resource]
    : [];

  returnSegment.items = parseWebSegmentItems(
    childResources,
    slugPrefix != null ? `${slugPrefix}/${slug}`.replace(/\/$/, "") : slug,
  );

  return returnSegment;
}

/**
 * Parses raw segment resources into an array of WebSegment objects
 *
 * @param segmentResources - Array of raw segment resources in OCHRE format
 * @returns Array of parsed WebSegment objects
 */
function parseSegments(
  segmentResources: Array<OchreResource>,
  slugPrefix?: string,
): Array<WebSegment> {
  const returnSegments: Array<WebSegment> = [];

  for (const segmentResource of segmentResources) {
    const segment = parseWebSegment(segmentResource, slugPrefix);
    if (segment !== null) {
      returnSegments.push(segment);
    }
  }

  return returnSegments;
}

/**
 * Parses raw segment item into a standardized WebSegmentItem object
 *
 * @param segmentItemResource - Raw segment item resource in OCHRE format
 * @returns Parsed WebSegmentItem object
 */
function parseWebSegmentItem(
  segmentItemResource: OchreResource,
  slugPrefix?: string,
): WebSegmentItem | null {
  const webpageProperties =
    segmentItemResource.properties ?
      parseProperties(
        Array.isArray(segmentItemResource.properties.property) ?
          segmentItemResource.properties.property
        : [segmentItemResource.properties.property],
      )
    : [];

  if (
    webpageProperties.length === 0 ||
    getPropertyValueByLabel(webpageProperties, "presentation") !==
      "segment-item"
  ) {
    return null;
  }

  const identification = parseIdentification(
    segmentItemResource.identification,
  );

  const slug =
    segmentItemResource.identification.abbreviation != null ?
      typeof segmentItemResource.identification.abbreviation === "object" ?
        parseStringContent(segmentItemResource.identification.abbreviation)
      : parseFakeString(segmentItemResource.identification.abbreviation)
    : null;
  if (slug == null) {
    throw new Error(
      `Slug not found for segment item “${identification.label}”`,
    );
  }

  const returnSegmentItem: WebSegmentItem = {
    uuid: segmentItemResource.uuid,
    type: "segment-item",
    title: identification.label,
    slug,
    publicationDateTime:
      segmentItemResource.publicationDateTime ?
        parseISO(segmentItemResource.publicationDateTime)
      : null,
    items: [],
  };

  const resources =
    segmentItemResource.resource ?
      Array.isArray(segmentItemResource.resource) ?
        segmentItemResource.resource
      : [segmentItemResource.resource]
    : [];

  returnSegmentItem.items.push(
    ...parseWebpages(
      resources,
      slugPrefix != null ? `${slugPrefix}/${slug}`.replace(/\/$/, "") : slug,
    ),
    ...parseSegments(
      resources,
      slugPrefix != null ? `${slugPrefix}/${slug}`.replace(/\/$/, "") : slug,
    ),
  );

  return returnSegmentItem;
}

/**
 * Parses raw segment items into an array of WebSegmentItem objects
 *
 * @param segmentItems - Array of raw segment items in OCHRE format
 * @returns Array of parsed WebSegmentItem objects
 */
function parseWebSegmentItems(
  segmentItems: Array<OchreResource>,
  slugPrefix?: string,
): Array<WebSegmentItem> {
  const returnItems: Array<WebSegmentItem> = [];

  for (const segmentItem of segmentItems) {
    const segmentItemParsed = parseWebSegmentItem(segmentItem, slugPrefix);
    if (segmentItemParsed !== null) {
      returnItems.push(segmentItemParsed);
    }
  }

  return returnItems;
}

/**
 * Parses raw sidebar data into a standardized Sidebar structure
 *
 * @param resources - Array of raw sidebar resources in OCHRE format
 * @returns Parsed Sidebar object
 */
function parseSidebar(
  resources: Array<OchreResource>,
): Website["properties"]["sidebar"] | null {
  let returnSidebar: Website["properties"]["sidebar"] | null = null;

  const items: NonNullable<Website["properties"]["sidebar"]>["items"] = [];
  const title: WebTitle = {
    label: "",
    variant: "default",
    properties: {
      isNameDisplayed: false,
      isDescriptionDisplayed: false,
      isDateDisplayed: false,
      isCreatorsDisplayed: false,
      isCountDisplayed: false,
    },
  };
  let layout: "start" | "end" = "start";
  let mobileLayout: "default" | "inline" = "default";
  const cssStyles: NonNullable<Website["properties"]["sidebar"]>["cssStyles"] =
    { default: [], tablet: [], mobile: [] };

  const sidebarResource = resources.find((resource) => {
    const resourceProperties =
      resource.properties ?
        parseProperties(
          Array.isArray(resource.properties.property) ?
            resource.properties.property
          : [resource.properties.property],
        )
      : [];

    return (
      getPropertyValueByLabel(resourceProperties, "presentation") ===
        "element" &&
      getPropertyValueByLabel(
        resourceProperties[0]?.properties ?? [],
        "component",
      ) === "sidebar"
    );
  });
  if (sidebarResource != null) {
    title.label =
      (
        typeof sidebarResource.identification.label === "string" ||
        typeof sidebarResource.identification.label === "number" ||
        typeof sidebarResource.identification.label === "boolean"
      ) ?
        parseFakeString(sidebarResource.identification.label)
      : parseStringContent(sidebarResource.identification.label);

    const sidebarBaseProperties =
      sidebarResource.properties ?
        parseProperties(
          Array.isArray(sidebarResource.properties.property) ?
            sidebarResource.properties.property
          : [sidebarResource.properties.property],
        )
      : [];

    const sidebarProperties =
      sidebarBaseProperties
        .find(
          (property) =>
            property.label === "presentation" &&
            property.values[0]?.content === "element",
        )
        ?.properties.find(
          (property) =>
            property.label === "component" &&
            property.values[0]?.content === "sidebar",
        )?.properties ?? [];

    const sidebarLayoutProperty = sidebarProperties.find(
      (property) => property.label === "layout",
    );
    if (sidebarLayoutProperty) {
      layout = sidebarLayoutProperty.values[0]!.content as "start" | "end";
    }

    const sidebarMobileLayoutProperty = sidebarProperties.find(
      (property) => property.label === "layout-mobile",
    );
    if (sidebarMobileLayoutProperty) {
      mobileLayout = sidebarMobileLayoutProperty.values[0]!.content as
        | "default"
        | "inline";
    }

    const cssProperties =
      sidebarBaseProperties.find(
        (property) =>
          property.label === "presentation" &&
          property.values[0]!.content === "css",
      )?.properties ?? [];

    for (const property of cssProperties) {
      const cssStyle = property.values[0]!.content?.toString();
      if (cssStyle != null) {
        cssStyles.default.push({ label: property.label, value: cssStyle });
      }
    }

    const tabletCssProperties =
      sidebarBaseProperties.find(
        (property) =>
          property.label === "presentation" &&
          property.values[0]!.content === "css-tablet",
      )?.properties ?? [];

    for (const property of tabletCssProperties) {
      const cssStyle = property.values[0]!.content?.toString();
      if (cssStyle != null) {
        cssStyles.tablet.push({ label: property.label, value: cssStyle });
      }
    }

    const mobileCssProperties =
      sidebarBaseProperties.find(
        (property) =>
          property.label === "presentation" &&
          property.values[0]!.content === "css-mobile",
      )?.properties ?? [];

    for (const property of mobileCssProperties) {
      const cssStyle = property.values[0]!.content?.toString();
      if (cssStyle != null) {
        cssStyles.mobile.push({ label: property.label, value: cssStyle });
      }
    }

    const titleProperties = sidebarBaseProperties.find(
      (property) =>
        property.label === "presentation" &&
        property.values[0]!.content === "title",
    )?.properties;

    if (titleProperties) {
      const titleVariant = getPropertyValueByLabel(titleProperties, "variant");
      if (titleVariant) {
        title.variant = titleVariant as "default" | "simple";
      }

      title.properties.isNameDisplayed =
        getPropertyValueByLabel(titleProperties, "name-displayed") === true;
      title.properties.isDescriptionDisplayed =
        getPropertyValueByLabel(titleProperties, "description-displayed") ===
        true;
      title.properties.isDateDisplayed =
        getPropertyValueByLabel(titleProperties, "date-displayed") === true;
      title.properties.isCreatorsDisplayed =
        getPropertyValueByLabel(titleProperties, "creators-displayed") === true;
      title.properties.isCountDisplayed =
        getPropertyValueByLabel(titleProperties, "count-displayed") === true;
    }

    const sidebarResources =
      sidebarResource.resource ?
        Array.isArray(sidebarResource.resource) ?
          sidebarResource.resource
        : [sidebarResource.resource]
      : [];

    for (const resource of sidebarResources) {
      const resourceProperties =
        resource.properties ?
          parseProperties(
            Array.isArray(resource.properties.property) ?
              resource.properties.property
            : [resource.properties.property],
          )
        : [];

      const resourceType = getPropertyValueByLabel(
        resourceProperties,
        "presentation",
      ) as "element" | "block" | null;
      if (resourceType === null) {
        continue;
      }

      switch (resourceType) {
        case "element": {
          const element = parseWebElement(resource);
          items.push(element);
          break;
        }
        case "block": {
          const block = parseWebBlock(resource);
          if (block) {
            items.push(block);
          }
          break;
        }
      }
    }
  }

  if (items.length > 0) {
    returnSidebar = {
      isDisplayed: true,
      items,
      title,
      layout,
      mobileLayout,
      cssStyles,
    };
  }

  return returnSidebar;
}

/**
 * Parses raw text element data for accordion layout with items support
 *
 * @param elementResource - Raw element resource data in OCHRE format
 * @returns Parsed text WebElement with items array
 */
function parseWebElementForAccordion(
  elementResource: OchreResource,
): Extract<WebElement, { component: "text" }> & {
  items: Array<WebElement | WebBlock>;
} {
  const textElement = parseWebElement(elementResource) as Extract<
    WebElement,
    { component: "text" }
  >;

  const childResources =
    elementResource.resource ?
      Array.isArray(elementResource.resource) ?
        elementResource.resource
      : [elementResource.resource]
    : [];

  const items: Array<WebElement | WebBlock> = [];
  for (const resource of childResources) {
    const resourceProperties =
      resource.properties ?
        parseProperties(
          Array.isArray(resource.properties.property) ?
            resource.properties.property
          : [resource.properties.property],
        )
      : [];

    const resourceType = getPropertyValueByLabel(
      resourceProperties,
      "presentation",
    ) as "element" | "block" | null;
    if (resourceType === null) {
      continue;
    }

    switch (resourceType) {
      case "element": {
        const element = parseWebElement(resource);
        items.push(element);
        break;
      }
      case "block": {
        const block = parseWebBlock(resource);
        if (block) {
          items.push(block);
        }
        break;
      }
    }
  }

  return { ...textElement, items };
}

/**
 * Parses raw block data into a standardized WebBlock structure
 *
 * @param blockResource - Raw block resource data in OCHRE format
 * @returns Parsed WebBlock object
 */
function parseWebBlock(blockResource: OchreResource): WebBlock | null {
  const blockProperties =
    blockResource.properties ?
      parseProperties(
        Array.isArray(blockResource.properties.property) ?
          blockResource.properties.property
        : [blockResource.properties.property],
      )
    : [];

  const returnBlock: WebBlock = {
    uuid: blockResource.uuid,
    type: "block",
    title: parseWebTitle(
      blockProperties,
      parseIdentification(blockResource.identification),
    ),
    items: [],
    properties: {
      default: { layout: "vertical", spacing: null, gap: null },
      mobile: null,
      tablet: null,
    } as WebBlock["properties"],
    cssStyles: { default: [], tablet: [], mobile: [] },
  };

  const blockMainProperties =
    getPropertyByLabelAndValue(blockProperties, "presentation", "block")
      ?.properties ?? [];
  if (blockMainProperties.length > 0) {
    returnBlock.properties.default.layout =
      (getPropertyValueByLabel(blockMainProperties, "layout") as
        | WebBlock["properties"]["default"]["layout"]
        | null) ?? "vertical";

    if (returnBlock.properties.default.layout === "accordion") {
      returnBlock.properties.default.isAccordionEnabled =
        (getPropertyValueByLabel(blockMainProperties, "accordion-enabled") as
          | WebBlock["properties"]["default"]["isAccordionEnabled"]
          | null) ?? true;

      returnBlock.properties.default.isAccordionExpandedByDefault =
        (getPropertyValueByLabel(blockMainProperties, "accordion-expanded") as
          | WebBlock["properties"]["default"]["isAccordionExpandedByDefault"]
          | null) ?? true;

      returnBlock.properties.default.isAccordionSidebarDisplayed =
        (getPropertyValueByLabel(
          blockMainProperties,
          "accordion-sidebar-displayed",
        ) as
          | WebBlock["properties"]["default"]["isAccordionSidebarDisplayed"]
          | null) ?? false;
    }

    returnBlock.properties.default.spacing =
      (getPropertyValueByLabel(blockMainProperties, "spacing") as
        | WebBlock["properties"]["default"]["spacing"]
        | null) ?? null;

    returnBlock.properties.default.gap =
      (getPropertyValueByLabel(blockMainProperties, "gap") as
        | WebBlock["properties"]["default"]["gap"]
        | null) ?? null;

    const tabletOverwriteProperty = getPropertyByLabel(
      blockMainProperties,
      "overwrite-tablet",
    );
    if (tabletOverwriteProperty !== null) {
      const tabletOverwriteProperties = tabletOverwriteProperty.properties;

      const propertiesTablet: NonNullable<WebBlock["properties"]["tablet"]> = {
        layout:
          (getPropertyValueByLabel(tabletOverwriteProperties, "layout") as
            | NonNullable<WebBlock["properties"]["tablet"]>["layout"]
            | null) ?? undefined,
        spacing:
          (getPropertyValueByLabel(tabletOverwriteProperties, "spacing") as
            | NonNullable<WebBlock["properties"]["tablet"]>["spacing"]
            | null) ?? undefined,
        gap:
          (getPropertyValueByLabel(tabletOverwriteProperties, "gap") as
            | NonNullable<WebBlock["properties"]["tablet"]>["gap"]
            | null) ?? undefined,
        isAccordionEnabled: undefined,
        isAccordionExpandedByDefault: undefined,
        isAccordionSidebarDisplayed: undefined,
      };

      if (
        propertiesTablet.layout === "accordion" ||
        returnBlock.properties.default.layout === "accordion"
      ) {
        propertiesTablet.isAccordionEnabled =
          (getPropertyValueByLabel(
            tabletOverwriteProperties,
            "accordion-enabled",
          ) as
            | NonNullable<
                WebBlock["properties"]["tablet"]
              >["isAccordionEnabled"]
            | null) ?? undefined;

        propertiesTablet.isAccordionExpandedByDefault =
          (getPropertyValueByLabel(
            tabletOverwriteProperties,
            "accordion-expanded",
          ) as
            | NonNullable<
                WebBlock["properties"]["tablet"]
              >["isAccordionExpandedByDefault"]
            | null) ?? undefined;

        propertiesTablet.isAccordionSidebarDisplayed =
          (getPropertyValueByLabel(
            tabletOverwriteProperties,
            "accordion-sidebar-displayed",
          ) as
            | NonNullable<
                WebBlock["properties"]["tablet"]
              >["isAccordionSidebarDisplayed"]
            | null) ?? undefined;
      }

      if (Object.values(propertiesTablet).every((value) => value != null)) {
        returnBlock.properties.tablet = propertiesTablet;
      }
    }

    const mobileOverwriteProperty = getPropertyByLabel(
      blockMainProperties,
      "overwrite-tablet",
    );
    if (mobileOverwriteProperty !== null) {
      const mobileOverwriteProperties = mobileOverwriteProperty.properties;

      const propertiesMobile: NonNullable<WebBlock["properties"]["mobile"]> = {
        layout:
          (getPropertyValueByLabel(mobileOverwriteProperties, "layout") as
            | NonNullable<WebBlock["properties"]["default"]>["layout"]
            | null) ?? undefined,
        spacing:
          (getPropertyValueByLabel(mobileOverwriteProperties, "spacing") as
            | NonNullable<WebBlock["properties"]["default"]>["spacing"]
            | null) ?? undefined,
        gap:
          (getPropertyValueByLabel(mobileOverwriteProperties, "gap") as
            | NonNullable<WebBlock["properties"]["default"]>["gap"]
            | null) ?? undefined,
        isAccordionEnabled: undefined,
        isAccordionExpandedByDefault: undefined,
        isAccordionSidebarDisplayed: undefined,
      };

      if (
        propertiesMobile.layout === "accordion" ||
        returnBlock.properties.default.layout === "accordion"
      ) {
        propertiesMobile.isAccordionEnabled =
          (getPropertyValueByLabel(
            mobileOverwriteProperties,
            "accordion-enabled",
          ) as
            | NonNullable<
                WebBlock["properties"]["mobile"]
              >["isAccordionEnabled"]
            | null) ?? undefined;

        propertiesMobile.isAccordionExpandedByDefault =
          (getPropertyValueByLabel(
            mobileOverwriteProperties,
            "accordion-expanded",
          ) as
            | NonNullable<
                WebBlock["properties"]["mobile"]
              >["isAccordionExpandedByDefault"]
            | null) ?? undefined;

        propertiesMobile.isAccordionSidebarDisplayed =
          (getPropertyValueByLabel(
            mobileOverwriteProperties,
            "accordion-sidebar-displayed",
          ) as
            | NonNullable<
                WebBlock["properties"]["mobile"]
              >["isAccordionSidebarDisplayed"]
            | null) ?? undefined;
      }

      if (Object.values(propertiesMobile).every((value) => value != null)) {
        returnBlock.properties.mobile = propertiesMobile;
      }
    }
  }

  const blockResources =
    blockResource.resource ?
      Array.isArray(blockResource.resource) ?
        blockResource.resource
      : [blockResource.resource]
    : [];

  if (returnBlock.properties.default.layout === "accordion") {
    const accordionItems: Array<
      Extract<WebElement, { component: "text" }> & {
        items: Array<WebElement | WebBlock>;
      }
    > = [];

    for (const resource of blockResources) {
      const resourceProperties =
        resource.properties ?
          parseProperties(
            Array.isArray(resource.properties.property) ?
              resource.properties.property
            : [resource.properties.property],
          )
        : [];

      const resourceType = getPropertyValueByLabel(
        resourceProperties,
        "presentation",
      ) as "element" | "block" | null;

      if (resourceType !== "element") {
        throw new Error(
          `Accordion only accepts elements, but got “${resourceType}” for the following resource: “${parseStringContent(
            resource.identification.label as OchreStringContent,
          )}”`,
        );
      }

      const presentationProperty = getPropertyByLabel(
        resourceProperties,
        "presentation",
      );
      const componentType = getPropertyValueByLabel(
        presentationProperty?.properties ?? [],
        "component",
      ) as string | null;

      if (componentType !== "text") {
        throw new Error(
          `Accordion only accepts text components, but got “${componentType}” for the following resource: “${parseStringContent(
            resource.identification.label as OchreStringContent,
          )}”`,
        );
      }

      const element = parseWebElementForAccordion(resource);
      accordionItems.push(element);
    }

    returnBlock.items = accordionItems;
  } else {
    const blockItems: Array<WebElement | WebBlock> = [];
    for (const resource of blockResources) {
      const resourceProperties =
        resource.properties ?
          parseProperties(
            Array.isArray(resource.properties.property) ?
              resource.properties.property
            : [resource.properties.property],
          )
        : [];

      const resourceType = getPropertyValueByLabel(
        resourceProperties,
        "presentation",
      ) as "element" | "block" | null;
      if (resourceType === null) {
        continue;
      }

      switch (resourceType) {
        case "element": {
          const element = parseWebElement(resource);
          blockItems.push(element);
          break;
        }
        case "block": {
          const block = parseWebBlock(resource);
          if (block) {
            blockItems.push(block);
          }
          break;
        }
      }
    }

    returnBlock.items = blockItems;
  }

  const blockCssStyles =
    getPropertyByLabelAndValue(blockProperties, "presentation", "css")
      ?.properties ?? [];
  if (blockCssStyles.length > 0) {
    for (const property of blockCssStyles) {
      const cssStyle = property.values[0]!.content?.toString();
      if (cssStyle != null) {
        returnBlock.cssStyles.default.push({
          label: property.label,
          value: cssStyle,
        });
      }
    }
  }

  const blockTabletCssStyles =
    getPropertyByLabelAndValue(blockProperties, "presentation", "css-tablet")
      ?.properties ?? [];
  if (blockTabletCssStyles.length > 0) {
    for (const property of blockTabletCssStyles) {
      const cssStyle = property.values[0]!.content?.toString();
      if (cssStyle != null) {
        returnBlock.cssStyles.tablet.push({
          label: property.label,
          value: cssStyle,
        });
      }
    }
  }

  const blockMobileCssStyles =
    getPropertyByLabelAndValue(blockProperties, "presentation", "css-mobile")
      ?.properties ?? [];
  if (blockMobileCssStyles.length > 0) {
    for (const property of blockMobileCssStyles) {
      const cssStyle = property.values[0]!.content?.toString();
      if (cssStyle != null) {
        returnBlock.cssStyles.mobile.push({
          label: property.label,
          value: cssStyle,
        });
      }
    }
  }

  return returnBlock;
}

/**
 * Parses raw website properties into a standardized Website properties structure
 *
 * @param properties - Array of raw website properties in OCHRE format
 * @returns Parsed WebsiteProperties object
 */
function parseWebsiteProperties(
  properties: Array<OchreProperty>,
  websiteTree: OchreTree,
  sidebar: Website["properties"]["sidebar"] | null,
): Website["properties"] {
  const mainProperties = parseProperties(properties);
  const websiteProperties =
    getPropertyByLabel(mainProperties, "presentation")?.properties ?? [];

  let type = getPropertyValueByLabel(websiteProperties, "webUI") as
    | Website["properties"]["type"]
    | null;
  type ??= "traditional";

  let status = getPropertyValueByLabel(websiteProperties, "status") as
    | Website["properties"]["status"]
    | null;
  status ??= "development";

  let privacy = getPropertyValueByLabel(websiteProperties, "privacy") as
    | Website["properties"]["privacy"]
    | null;
  privacy ??= "public";

  const returnProperties: Website["properties"] = {
    type,
    status,
    privacy,
    contact: null,
    theme: { isThemeToggleDisplayed: true, defaultTheme: "system" },
    icon: { logoUuid: null, faviconUuid: null, appleTouchIconUuid: null },
    navbar: {
      isDisplayed: true,
      variant: "default",
      alignment: "start",
      isProjectDisplayed: true,
      searchBarBoundElementUuid: null,
      items: null,
    },
    footer: { isDisplayed: true, items: null },
    sidebar,
    itemPage: {
      isMainContentDisplayed: true,
      isDescriptionDisplayed: true,
      isDocumentDisplayed: true,
      isNotesDisplayed: true,
      isEventsDisplayed: true,
      isPeriodsDisplayed: true,
      isPropertiesDisplayed: true,
      isBibliographyDisplayed: true,
      isPropertyValuesGrouped: true,
      iiifViewer: "universal-viewer",
    },
    options: { contexts: null, scopes: null, labels: { title: null } },
  };

  const contactProperty = getPropertyByLabel(websiteProperties, "contact");
  if (contactProperty !== null) {
    const contactContent = contactProperty.values[0]?.content
      ?.toString()
      .split(";");
    if (contactContent?.length === 2) {
      returnProperties.contact = {
        name: contactContent[0]!,
        email: contactContent[1] ?? null,
      };
    } else {
      throw new Error(
        `Contact property must be in the format “name;email”, but got “${contactProperty.values[0]?.content}”`,
      );
    }
  }

  returnProperties.theme.isThemeToggleDisplayed =
    (getPropertyValueByLabel(websiteProperties, "supports-theme-toggle") as
      | Website["properties"]["theme"]["isThemeToggleDisplayed"]
      | null) ?? true;

  returnProperties.theme.defaultTheme =
    (getPropertyValueByLabel(websiteProperties, "default-theme") as
      | Website["properties"]["theme"]["defaultTheme"]
      | null) ?? "system";

  returnProperties.icon.logoUuid =
    getPropertyByLabel(websiteProperties, "logo")?.values[0]?.uuid ?? null;

  returnProperties.navbar.isDisplayed =
    (getPropertyValueByLabel(websiteProperties, "navbar-displayed") as
      | Website["properties"]["navbar"]["isDisplayed"]
      | null) ?? true;

  returnProperties.navbar.variant =
    (getPropertyValueByLabel(websiteProperties, "navbar-variant") as
      | Website["properties"]["navbar"]["variant"]
      | null) ?? "default";

  returnProperties.navbar.alignment =
    (getPropertyValueByLabel(websiteProperties, "navbar-alignment") as
      | Website["properties"]["navbar"]["alignment"]
      | null) ?? "start";

  returnProperties.navbar.isProjectDisplayed =
    (getPropertyValueByLabel(websiteProperties, "navbar-project-displayed") as
      | Website["properties"]["navbar"]["isProjectDisplayed"]
      | null) ?? true;

  returnProperties.navbar.searchBarBoundElementUuid =
    getPropertyByLabel(websiteProperties, "bound-element-navbar-search-bar")
      ?.values[0]?.uuid ?? null;

  returnProperties.footer.isDisplayed =
    (getPropertyValueByLabel(websiteProperties, "footer-displayed") as
      | Website["properties"]["footer"]["isDisplayed"]
      | null) ?? true;

  const itemPageTypeProperty = getPropertyByLabelAndValue(
    websiteProperties,
    "page-type",
    "item-page",
  );
  if (itemPageTypeProperty !== null) {
    returnProperties.itemPage.isMainContentDisplayed =
      (getPropertyValueByLabel(
        itemPageTypeProperty.properties,
        "item-page-main-content-displayed",
      ) as
        | Website["properties"]["itemPage"]["isMainContentDisplayed"]
        | null) ?? true;

    returnProperties.itemPage.isDescriptionDisplayed =
      (getPropertyValueByLabel(
        itemPageTypeProperty.properties,
        "item-page-description-displayed",
      ) as
        | Website["properties"]["itemPage"]["isDescriptionDisplayed"]
        | null) ?? true;

    returnProperties.itemPage.isDocumentDisplayed =
      (getPropertyValueByLabel(
        itemPageTypeProperty.properties,
        "item-page-document-displayed",
      ) as Website["properties"]["itemPage"]["isDocumentDisplayed"] | null) ??
      true;

    returnProperties.itemPage.isNotesDisplayed =
      (getPropertyValueByLabel(
        itemPageTypeProperty.properties,
        "item-page-notes-displayed",
      ) as Website["properties"]["itemPage"]["isNotesDisplayed"] | null) ??
      true;

    returnProperties.itemPage.isEventsDisplayed =
      (getPropertyValueByLabel(
        itemPageTypeProperty.properties,
        "item-page-events-displayed",
      ) as Website["properties"]["itemPage"]["isEventsDisplayed"] | null) ??
      true;

    returnProperties.itemPage.isPeriodsDisplayed =
      (getPropertyValueByLabel(
        itemPageTypeProperty.properties,
        "item-page-periods-displayed",
      ) as Website["properties"]["itemPage"]["isPeriodsDisplayed"] | null) ??
      true;

    returnProperties.itemPage.isPropertiesDisplayed =
      (getPropertyValueByLabel(
        itemPageTypeProperty.properties,
        "item-page-properties-displayed",
      ) as Website["properties"]["itemPage"]["isPropertiesDisplayed"] | null) ??
      true;

    returnProperties.itemPage.isBibliographyDisplayed =
      (getPropertyValueByLabel(
        itemPageTypeProperty.properties,
        "item-page-bibliography-displayed",
      ) as
        | Website["properties"]["itemPage"]["isBibliographyDisplayed"]
        | null) ?? true;

    returnProperties.itemPage.isPropertyValuesGrouped =
      (getPropertyValueByLabel(
        itemPageTypeProperty.properties,
        "item-page-property-values-grouped",
      ) as
        | Website["properties"]["itemPage"]["isPropertyValuesGrouped"]
        | null) ?? true;

    returnProperties.itemPage.iiifViewer =
      (getPropertyValueByLabel(
        itemPageTypeProperty.properties,
        "item-page-iiif-viewer",
      ) as Website["properties"]["itemPage"]["iiifViewer"] | null) ??
      "universal-viewer";
  }

  if ("options" in websiteTree && websiteTree.options) {
    returnProperties.options.scopes =
      websiteTree.options.scopes != null ?
        (Array.isArray(websiteTree.options.scopes.scope) ?
          websiteTree.options.scopes.scope
        : [websiteTree.options.scopes.scope]
        ).map((scope) => ({
          uuid: scope.uuid.content,
          type: scope.uuid.type,
          identification: parseIdentification(scope.identification),
        }))
      : null;

    const flattenContextsRaw =
      websiteTree.options.flattenContexts != null ?
        Array.isArray(websiteTree.options.flattenContexts) ?
          websiteTree.options.flattenContexts
        : [websiteTree.options.flattenContexts]
      : [];
    const suppressContextsRaw =
      websiteTree.options.suppressContexts != null ?
        Array.isArray(websiteTree.options.suppressContexts) ?
          websiteTree.options.suppressContexts
        : [websiteTree.options.suppressContexts]
      : [];
    const filterContextsRaw =
      websiteTree.options.filterContexts != null ?
        Array.isArray(websiteTree.options.filterContexts) ?
          websiteTree.options.filterContexts
        : [websiteTree.options.filterContexts]
      : [];
    const sortContextsRaw =
      websiteTree.options.sortContexts != null ?
        Array.isArray(websiteTree.options.sortContexts) ?
          websiteTree.options.sortContexts
        : [websiteTree.options.sortContexts]
      : [];
    const detailContextsRaw =
      websiteTree.options.detailContexts != null ?
        Array.isArray(websiteTree.options.detailContexts) ?
          websiteTree.options.detailContexts
        : [websiteTree.options.detailContexts]
      : [];
    const downloadContextsRaw =
      websiteTree.options.downloadContexts != null ?
        Array.isArray(websiteTree.options.downloadContexts) ?
          websiteTree.options.downloadContexts
        : [websiteTree.options.downloadContexts]
      : [];
    const labelContextsRaw =
      websiteTree.options.labelContexts != null ?
        Array.isArray(websiteTree.options.labelContexts) ?
          websiteTree.options.labelContexts
        : [websiteTree.options.labelContexts]
      : [];
    const prominentContextsRaw =
      websiteTree.options.prominentContexts != null ?
        Array.isArray(websiteTree.options.prominentContexts) ?
          websiteTree.options.prominentContexts
        : [websiteTree.options.prominentContexts]
      : [];

    returnProperties.options.contexts = {
      flatten: parseContexts(flattenContextsRaw),
      suppress: parseContexts(suppressContextsRaw),
      filter: parseContexts(filterContextsRaw),
      sort: parseContexts(sortContextsRaw),
      detail: parseContexts(detailContextsRaw),
      download: parseContexts(downloadContextsRaw),
      label: parseContexts(labelContextsRaw),
      prominent: parseContexts(prominentContextsRaw),
    };

    if ("notes" in websiteTree.options && websiteTree.options.notes != null) {
      const labelNotes = parseNotes(
        Array.isArray(websiteTree.options.notes.note) ?
          websiteTree.options.notes.note
        : [websiteTree.options.notes.note],
      );

      returnProperties.options.labels.title =
        labelNotes.find((note) => note.title === "Title label")?.content ??
        null;
    }
  }

  return returnProperties;
}

function parseContexts(
  contexts: Array<OchreLevelContext>,
): Array<LevelContext> {
  const contextsParsed: Array<LevelContext> = [];

  for (const mainContext of contexts) {
    const contextItemsToParse =
      Array.isArray(mainContext.context) ?
        mainContext.context
      : [mainContext.context];

    for (const contextItemToParse of contextItemsToParse) {
      const levelsToParse =
        Array.isArray(contextItemToParse.levels.level) ?
          contextItemToParse.levels.level
        : [contextItemToParse.levels.level];

      let type = "";

      const levels: Array<LevelContextItem> = levelsToParse.map((level) => {
        let variableUuid = "";
        let valueUuid: string | null = null;

        if (typeof level === "string") {
          const splitLevel = level.split(", ");

          variableUuid = splitLevel[0]!;
          valueUuid = splitLevel[1] === "null" ? null : splitLevel[1]!;
        } else {
          const splitLevel = level.content.split(", ");

          type = level.dataType;
          variableUuid = splitLevel[0]!;
          valueUuid = splitLevel[1] === "null" ? null : splitLevel[1]!;
        }

        return { variableUuid, valueUuid };
      });

      contextsParsed.push({
        context: levels,
        type,
        identification: parseIdentification(contextItemToParse.identification),
      });
    }
  }

  return contextsParsed;
}

export function parseWebsite(
  websiteTree: OchreTree,
  metadata: OchreMetadata,
  belongsTo: { uuid: string; abbreviation: string } | null,
  { version = DEFAULT_API_VERSION }: { version?: ApiVersion } = {},
): Website {
  if (!websiteTree.properties) {
    throw new Error("Website properties not found");
  }

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

  const items = [...parseWebpages(resources), ...parseSegments(resources)];

  const sidebar = parseSidebar(resources);

  const properties = parseWebsiteProperties(
    Array.isArray(websiteTree.properties.property) ?
      websiteTree.properties.property
    : [websiteTree.properties.property],
    websiteTree,
    sidebar,
  );

  return {
    uuid: websiteTree.uuid,
    version,
    belongsTo: belongsTo ?? null,
    metadata: parseMetadata(metadata),
    publicationDateTime:
      websiteTree.publicationDateTime ?
        parseISO(websiteTree.publicationDateTime)
      : null,
    identification: parseIdentification(websiteTree.identification),
    creators:
      websiteTree.creators ?
        parsePersons(
          Array.isArray(websiteTree.creators.creator) ?
            websiteTree.creators.creator
          : [websiteTree.creators.creator],
        )
      : [],
    license: parseLicense(websiteTree.availability),
    items,
    properties,
  };
}
