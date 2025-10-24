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
  CoordinatesItem,
  DataCategory,
  Event,
  Identification,
  Image,
  ImageMap,
  Interpretation,
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
  Resource,
  Set,
  SpatialUnit,
  Style,
  Tree,
  WebBlock,
  WebElement,
  WebElementComponent,
  WebImage,
  Webpage,
  Website,
  WebsiteProperties,
  WebTitle,
} from "../types/main.js";
import {
  componentSchema,
  propertyValueContentTypeSchema,
  websiteSchema,
} from "../schemas.js";
import {
  getPropertyByLabel,
  getPropertyValueByLabel,
} from "../utils/getters.js";
import {
  parseEmail,
  parseFakeString,
  parseStringContent,
  parseStringDocumentItem,
} from "../utils/string.js";
import { getItemCategory } from "./helpers.js";

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

  return { content: license.license.content, url: license.license.target };
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
    category: "person",
    publicationDateTime:
      person.publicationDateTime != null ?
        new Date(person.publicationDateTime)
      : null,
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
          link.fileFormat
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
 * Parses raw coordinates data into a standardized Coordinates structure
 *
 * @param coordinates - Raw coordinates data in OCHRE format
 * @returns Parsed Coordinates object
 */
export function parseCoordinates(
  coordinates: OchreCoordinates | undefined,
): Coordinates {
  if (coordinates == null) {
    return [];
  }

  const returnCoordinates: Array<CoordinatesItem> = [];

  const coordsToParse =
    Array.isArray(coordinates.coord) ? coordinates.coord : [coordinates.coord];

  for (const coord of coordsToParse) {
    const source: CoordinatesItem["source"] =
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
      date: event.dateTime != null ? new Date(event.dateTime) : null,
      label: parseStringContent(event.label),
      location:
        event.location ?
          {
            uuid: event.location.uuid,
            content: parseStringContent(event.location),
          }
        : null,
      agent:
        event.agent ?
          { uuid: event.agent.uuid, content: parseStringContent(event.agent) }
        : null,
      comment: event.comment ? parseStringContent(event.comment) : null,
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
        content,
        label: null,
        dataType: "string",
        isUncertain: false,
        category: "value",
        type: null,
        uuid: null,
        publicationDateTime: null,
        unit: null,
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
        //     content = new Date(parseFakeString(value.rawValue));
        //     label =
        //       value.content ?
        //         parseStringContent({ content: value.content })
        //       : null;
        //   } else {
        //     content =
        //       value.content ?
        //         typeof value.content === "string" ?
        //           new Date(value.content)
        //         : new Date(parseStringContent({ content: value.content }))
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
        content,
        dataType: parsedType,
        isUncertain: value.isUncertain ?? false,
        label,
        category: value.category ?? null,
        type: value.type ?? null,
        uuid: value.uuid ?? null,
        publicationDateTime:
          value.publicationDateTime != null ?
            new Date(value.publicationDateTime)
          : null,
        unit: value.unit ?? null,
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
      date: interpretation.date,
      number: interpretation.interpretationNo,
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
          new Date(area.publicationDateTime)
        : null,
      type: area.type,
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
    zoteroId: bibliography.zoteroId ?? null,
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
 * Parses raw property value data into a standardized PropertyValue structure
 *
 * @param propertyValue - Raw property value data in OCHRE format
 * @returns Parsed PropertyValue object
 */
export function parsePropertyValue(
  propertyValue: OchrePropertyValue,
): PropertyValue {
  return {
    uuid: propertyValue.uuid,
    category: "propertyValue",
    number: propertyValue.n,
    publicationDateTime:
      propertyValue.publicationDateTime ?
        new Date(propertyValue.publicationDateTime)
      : null,
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
 * Parses a raw tree structure into a standardized Tree object
 *
 * @param tree - Raw tree data in OCHRE format
 * @returns Parsed Tree object or null if invalid
 */
export function parseTree<T extends DataCategory, U extends DataCategory>(
  tree: OchreTree,
  itemCategory?: T,
  itemSubCategory?: U,
): Tree<T, U> {
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

  const parsedItemCategory =
    itemSubCategory ?? getItemCategory(Object.keys(tree.items));

  let items:
    | Array<Resource>
    | Array<SpatialUnit>
    | Array<Concept>
    | Array<Period>
    | Array<Bibliography>
    | Array<Person>
    | Array<PropertyValue>
    | Array<Set<U>> = [];

  switch (parsedItemCategory) {
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
    case "set": {
      if (!("set" in tree.items)) {
        throw new Error("Invalid OCHRE data: Tree has no sets");
      }

      const setItems: Array<Set<U>> = [];
      for (const item of Array.isArray(tree.items.set) ?
        tree.items.set
      : [tree.items.set]) {
        setItems.push(parseSet<U>(item, itemSubCategory));
      }

      items = setItems;
      break;
    }
    default: {
      throw new Error("Invalid OCHRE data: Tree has no items or is malformed");
    }
  }

  const returnTree: Tree<T, U> = {
    uuid: tree.uuid,
    category: "tree",
    publicationDateTime: new Date(tree.publicationDateTime),
    identification: parseIdentification(tree.identification),
    creators,
    license: parseLicense(tree.availability),
    date,
    type: tree.type,
    number: tree.n,
    items: items as T extends "resource" ? Array<Resource>
    : T extends "spatialUnit" ? Array<SpatialUnit>
    : T extends "concept" ? Array<Concept>
    : T extends "period" ? Array<Period>
    : T extends "bibliography" ? Array<Bibliography>
    : T extends "person" ? Array<Person>
    : T extends "propertyValue" ? Array<PropertyValue>
    : T extends "set" ? Array<Set<U>>
    : never,
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
export function parseSet<T extends DataCategory>(
  set: OchreSet,
  itemCategory?: T,
): Set<T> {
  if (typeof set.items === "string") {
    throw new TypeError("Invalid OCHRE data: Set has no items");
  }

  const parsedItemCategory =
    itemCategory ?? getItemCategory(Object.keys(set.items));

  let items:
    | Array<Resource>
    | Array<SpatialUnit>
    | Array<Concept>
    | Array<Period>
    | Array<Bibliography>
    | Array<Person>
    | Array<PropertyValue> = [];

  switch (parsedItemCategory) {
    case "resource": {
      if (!("resource" in set.items)) {
        throw new Error("Invalid OCHRE data: Set has no resources");
      }
      items = parseResources(
        Array.isArray(set.items.resource) ?
          set.items.resource
        : [set.items.resource],
      );
      break;
    }
    case "spatialUnit": {
      if (!("spatialUnit" in set.items)) {
        throw new Error("Invalid OCHRE data: Set has no spatial units");
      }
      items = parseSpatialUnits(
        Array.isArray(set.items.spatialUnit) ?
          set.items.spatialUnit
        : [set.items.spatialUnit],
      );
      break;
    }
    case "concept": {
      if (!("concept" in set.items)) {
        throw new Error("Invalid OCHRE data: Set has no concepts");
      }
      items = parseConcepts(
        Array.isArray(set.items.concept) ?
          set.items.concept
        : [set.items.concept],
      );
      break;
    }
    case "period": {
      if (!("period" in set.items)) {
        throw new Error("Invalid OCHRE data: Set has no periods");
      }
      items = parsePeriods(
        Array.isArray(set.items.period) ? set.items.period : [set.items.period],
      );
      break;
    }
    case "bibliography": {
      if (!("bibliography" in set.items)) {
        throw new Error("Invalid OCHRE data: Set has no bibliographies");
      }
      items = parseBibliographies(
        Array.isArray(set.items.bibliography) ?
          set.items.bibliography
        : [set.items.bibliography],
      );
      break;
    }
    case "person": {
      if (!("person" in set.items)) {
        throw new Error("Invalid OCHRE data: Set has no persons");
      }
      items = parsePersons(
        Array.isArray(set.items.person) ? set.items.person : [set.items.person],
      );
      break;
    }
    case "propertyValue": {
      if (!("propertyValue" in set.items)) {
        throw new Error("Invalid OCHRE data: Set has no property values");
      }
      items = parsePropertyValues(
        Array.isArray(set.items.propertyValue) ?
          set.items.propertyValue
        : [set.items.propertyValue],
      );
      break;
    }
    default: {
      throw new Error("Invalid OCHRE data: Set has no items or is malformed");
    }
  }

  return {
    uuid: set.uuid,
    category: "set",
    itemCategory: itemCategory!,
    publicationDateTime:
      set.publicationDateTime ? new Date(set.publicationDateTime) : null,
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
    items: items as T extends "resource" ? Array<Resource>
    : T extends "spatialUnit" ? Array<SpatialUnit>
    : T extends "concept" ? Array<Concept>
    : T extends "period" ? Array<Period>
    : T extends "bibliography" ? Array<Bibliography>
    : T extends "person" ? Array<Person>
    : T extends "propertyValue" ? Array<PropertyValue>
    : never,
  };
}

/**
 * Parses raw resource data into a standardized Resource structure
 *
 * @param resource - Raw resource data in OCHRE format
 * @returns Parsed Resource object
 */
export function parseResource(resource: OchreResource): Resource {
  const returnResource: Resource = {
    uuid: resource.uuid,
    category: "resource",
    publicationDateTime:
      resource.publicationDateTime ?
        new Date(resource.publicationDateTime)
      : null,
    type: resource.type,
    number: resource.n,
    fileFormat: resource.fileFormat ?? null,
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
  const resourcesToParse = Array.isArray(resources) ? resources : [resources];

  for (const resource of resourcesToParse) {
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
export function parseSpatialUnit(spatialUnit: OchreSpatialUnit): SpatialUnit {
  const returnSpatialUnit: SpatialUnit = {
    uuid: spatialUnit.uuid,
    category: "spatialUnit",
    publicationDateTime:
      spatialUnit.publicationDateTime != null ?
        new Date(spatialUnit.publicationDateTime)
      : null,
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
  const spatialUnitsToParse =
    Array.isArray(spatialUnits) ? spatialUnits : [spatialUnits];

  for (const spatialUnit of spatialUnitsToParse) {
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
export function parseConcept(concept: OchreConcept): Concept {
  const returnConcept: Concept = {
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
    image: concept.image ? parseImage(concept.image) : null,
    description:
      concept.description ?
        parseStringContent(concept.description as OchreStringContent)
      : null,
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

    const resourceProperty = resourceProperties.find(
      (property) =>
        property.label === "presentation" &&
        property.values[0]!.content === type,
    );
    if (!resourceProperty) continue;

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
  const conceptsToParse = Array.isArray(concepts) ? concepts : [concepts];

  for (const concept of conceptsToParse) {
    returnConcepts.push(parseConcept(concept));
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
function parseWebElementProperties(
  componentProperty: Property,
  elementResource: OchreResource,
): WebElementComponent {
  const unparsedComponentName = componentProperty.values[0]!.content;
  const { data: componentName } = componentSchema.safeParse(
    unparsedComponentName,
  );

  const properties: Record<string, unknown> = { component: componentName };

  const links =
    elementResource.links ?
      parseLinks(
        Array.isArray(elementResource.links) ?
          elementResource.links
        : [elementResource.links],
      )
    : [];
  const imageLinks = links.filter(
    (link) => link.type === "image" || link.type === "IIIF",
  );

  switch (componentName) {
    case "annotated-document": {
      const documentLink = links.find(
        (link) => link.type === "internalDocument",
      );
      if (!documentLink) {
        throw new Error(
          `Document link not found for the following component: “${componentName}”`,
        );
      }

      properties.documentId = documentLink.uuid;
      break;
    }
    case "annotated-image": {
      if (imageLinks.length === 0) {
        throw new Error(
          `Image link not found for the following component: “${componentName}”`,
        );
      }

      const isFilterDisplayed =
        getPropertyValueByLabel(
          componentProperty.properties,
          "filter-displayed",
        ) === true;

      const isOptionsDisplayed =
        getPropertyValueByLabel(
          componentProperty.properties,
          "options-displayed",
        ) !== false;

      const isAnnotationHighlightsDisplayed =
        getPropertyValueByLabel(
          componentProperty.properties,
          "annotation-highlights-displayed",
        ) !== false;

      const isAnnotationTooltipsDisplayed =
        getPropertyValueByLabel(
          componentProperty.properties,
          "annotation-tooltips-displayed",
        ) !== false;

      properties.imageUuid = imageLinks[0]!.uuid;
      properties.isFilterDisplayed = isFilterDisplayed;
      properties.isOptionsDisplayed = isOptionsDisplayed;
      properties.isAnnotationHighlightsDisplayed =
        isAnnotationHighlightsDisplayed;
      properties.isAnnotationTooltipsDisplayed = isAnnotationTooltipsDisplayed;
      break;
    }
    case "audio-player": {
      const audioLink = links.find((link) => link.type === "audio");
      if (!audioLink) {
        throw new Error(
          `Audio link not found for the following component: “${componentName}”`,
        );
      }

      let isSpeedControlsDisplayed = false;
      const isSpeedControlsDisplayedProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "speed-controls-displayed",
      );
      if (isSpeedControlsDisplayedProperty !== null) {
        isSpeedControlsDisplayed = isSpeedControlsDisplayedProperty === true;
      }

      let isVolumeControlsDisplayed = false;
      const isVolumeControlsDisplayedProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "volume-controls-displayed",
      );
      if (isVolumeControlsDisplayedProperty !== null) {
        isVolumeControlsDisplayed = isVolumeControlsDisplayedProperty === true;
      }

      let isSeekBarDisplayed = false;
      const isSeekBarDisplayedProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "seek-bar-displayed",
      );
      if (isSeekBarDisplayedProperty !== null) {
        isSeekBarDisplayed = isSeekBarDisplayedProperty === true;
      }

      properties.audioId = audioLink.uuid;
      properties.isSpeedControlsDisplayed = isSpeedControlsDisplayed;
      properties.isVolumeControlsDisplayed = isVolumeControlsDisplayed;
      properties.isSeekBarDisplayed = isSeekBarDisplayed;
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
      );
      layout ??= "long";

      let isSourceDocumentDisplayed = true;
      const isSourceDocumentDisplayedProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "source-document-displayed",
      );
      if (isSourceDocumentDisplayedProperty !== null) {
        isSourceDocumentDisplayed = isSourceDocumentDisplayedProperty === true;
      }

      properties.itemUuids = itemLinks
        .map((link) => link.uuid)
        .filter((uuid) => uuid !== null);
      properties.bibliographies = bibliographyLink?.bibliographies ?? [];
      properties.layout = layout;
      properties.isSourceDocumentDisplayed = isSourceDocumentDisplayed;

      break;
    }
    case "button": {
      let variant = getPropertyValueByLabel(
        componentProperty.properties,
        "variant",
      );
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

      let startIcon = null;
      const startIconProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "start-icon",
      );
      if (startIconProperty !== null) {
        startIcon = startIconProperty;
      }

      let endIcon = null;
      const endIconProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "end-icon",
      );
      if (endIconProperty !== null) {
        endIcon = endIconProperty;
      }

      let image: WebImage | null = null;
      if (imageLinks.length > 0) {
        image = {
          url: `https://ochre.lib.uchicago.edu/ochre?uuid=${imageLinks[0]!.uuid}&load`,
          label: imageLinks[0]!.identification?.label ?? null,
          width: imageLinks[0]!.image?.width ?? 0,
          height: imageLinks[0]!.image?.height ?? 0,
          description: imageLinks[0]!.description ?? null,
        };
      }

      properties.variant = variant;
      properties.href = href;
      properties.isExternal = isExternal;
      properties.label =
        elementResource.document && "content" in elementResource.document ?
          parseDocument(elementResource.document.content)
        : null;
      properties.startIcon = startIcon;
      properties.endIcon = endIcon;
      properties.image = image;
      break;
    }
    case "collection": {
      const collectionLink = links.find((link) => link.category === "set");
      if (!collectionLink) {
        throw new Error(
          `Collection link not found for the following component: “${componentName}”`,
        );
      }

      let variant = getPropertyValueByLabel(
        componentProperty.properties,
        "variant",
      );
      variant ??= "full";

      let itemVariant = getPropertyValueByLabel(
        componentProperty.properties,
        "item-variant",
      );
      itemVariant ??= "detailed";

      let paginationVariant = getPropertyValueByLabel(
        componentProperty.properties,
        "pagination-variant",
      );
      paginationVariant ??= "default";

      let isSortDisplayed = false;
      const isSortDisplayedProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "sort-displayed",
      );
      if (isSortDisplayedProperty !== null) {
        isSortDisplayed = isSortDisplayedProperty === true;
      }

      let isFilterDisplayed = false;
      const isFilterDisplayedProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "filter-displayed",
      );
      if (isFilterDisplayedProperty !== null) {
        isFilterDisplayed = isFilterDisplayedProperty === true;
      }

      let filterSort = getPropertyValueByLabel(
        componentProperty.properties,
        "filter-sort",
      );
      filterSort ??= "default";

      let layout = getPropertyValueByLabel(
        componentProperty.properties,
        "layout",
      );
      layout ??= "image-start";

      properties.collectionId = collectionLink.uuid;
      properties.variant = variant;
      properties.itemVariant = itemVariant;
      properties.paginationVariant = paginationVariant;
      properties.isSortDisplayed = isSortDisplayed;
      properties.isFilterDisplayed = isFilterDisplayed;
      properties.filterSort = filterSort;
      properties.layout = layout;
      break;
    }
    case "empty-space": {
      const height = getPropertyValueByLabel(
        componentProperty.properties,
        "height",
      );
      const width = getPropertyValueByLabel(
        componentProperty.properties,
        "width",
      );

      properties.height = height;
      properties.width = width;
      break;
    }
    case "entries": {
      const entriesLink = links.find(
        (link) => link.category === "tree" || link.category === "set",
      );
      if (!entriesLink) {
        throw new Error(
          `Entries link not found for the following component: “${componentName}”`,
        );
      }

      let variant = getPropertyValueByLabel(
        componentProperty.properties,
        "variant",
      ) as "entry" | "item" | null;
      variant ??= "entry";

      let isFilterDisplayed = false;
      const isFilterDisplayedProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "filter-displayed",
      );
      if (isFilterDisplayedProperty !== null) {
        isFilterDisplayed = isFilterDisplayedProperty === true;
      }

      properties.entriesId = entriesLink.uuid;
      properties.variant = variant;
      properties.isFilterDisplayed = isFilterDisplayed;
      break;
    }
    case "iframe": {
      const href = links.find((link) => link.type === "webpage")?.href;
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

      properties.href = href;
      properties.height = height;
      properties.width = width;
      break;
    }
    case "iiif-viewer": {
      const manifestLink = links.find((link) => link.type === "IIIF");
      if (!manifestLink) {
        throw new Error(
          `Manifest link not found for the following component: “${componentName}”`,
        );
      }

      let variant = getPropertyValueByLabel(
        componentProperty.properties,
        "variant",
      );
      variant ??= "universal-viewer";

      properties.IIIFId = manifestLink.uuid;
      properties.variant = variant;
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
          description: imageLink.description ?? null,
        });
      }

      let variant = getPropertyValueByLabel(
        componentProperty.properties,
        "variant",
      );
      variant ??= "default";

      let captionLayout = getPropertyValueByLabel(
        componentProperty.properties,
        "layout-caption",
      );
      captionLayout ??= "bottom";

      let width = null;
      const widthProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "width",
      );
      if (widthProperty !== null) {
        if (typeof widthProperty === "number") {
          width = widthProperty;
        } else if (typeof widthProperty === "string") {
          width = Number.parseFloat(widthProperty);
        }
      }

      let height = null;
      const heightProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "height",
      );
      if (heightProperty !== null) {
        if (typeof heightProperty === "number") {
          height = heightProperty;
        } else if (typeof heightProperty === "string") {
          height = Number.parseFloat(heightProperty);
        }
      }

      let isFullWidth = true;
      const isFullWidthProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "is-full-width",
      );
      if (isFullWidthProperty !== null) {
        isFullWidth = isFullWidthProperty === true;
      }

      let isFullHeight = true;
      const isFullHeightProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "is-full-height",
      );
      if (isFullHeightProperty !== null) {
        isFullHeight = isFullHeightProperty === true;
      }

      let imageQuality = getPropertyValueByLabel(
        componentProperty.properties,
        "image-quality",
      );
      imageQuality ??= "high";

      let captionSource = getPropertyValueByLabel(
        componentProperty.properties,
        "caption-source",
      );
      captionSource ??= "name";

      let altTextSource = getPropertyValueByLabel(
        componentProperty.properties,
        "alt-text-source",
      );
      altTextSource ??= "name";

      let isTransparentBackground = false;
      const isTransparentBackgroundProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "is-transparent",
      );
      if (isTransparentBackgroundProperty !== null) {
        isTransparentBackground = isTransparentBackgroundProperty === true;
      }

      let isCover = false;
      const isCoverProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "is-cover",
      );
      if (isCoverProperty !== null) {
        isCover = isCoverProperty === true;
      }

      const variantProperty = getPropertyByLabel(
        componentProperty.properties,
        "variant",
      );

      let carouselOptions: { secondsPerImage: number } | null = null;
      if (images.length > 1) {
        let secondsPerImage = 5;

        if (variantProperty?.values[0]!.content === "carousel") {
          const secondsPerImageProperty = getPropertyValueByLabel(
            variantProperty.properties,
            "seconds-per-image",
          );
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

      let heroOptions: {
        isBackgroundImageDisplayed: boolean;
        isDocumentDisplayed: boolean;
        isLinkDisplayed: boolean;
      } | null = null;
      if (variantProperty?.values[0]!.content === "hero") {
        const isBackgroundImageDisplayedProperty = getPropertyValueByLabel(
          variantProperty.properties,
          "background-image-displayed",
        );
        const isDocumentDisplayedProperty = getPropertyValueByLabel(
          variantProperty.properties,
          "document-displayed",
        );
        const isLinkDisplayedProperty = getPropertyValueByLabel(
          variantProperty.properties,
          "link-displayed",
        );

        heroOptions = {
          isBackgroundImageDisplayed:
            isBackgroundImageDisplayedProperty !== false,
          isDocumentDisplayed: isDocumentDisplayedProperty !== false,
          isLinkDisplayed: isLinkDisplayedProperty !== false,
        };
      }

      properties.images = images;
      properties.variant = variant;
      properties.width = width;
      properties.height = height;
      properties.isFullWidth = isFullWidth;
      properties.isFullHeight = isFullHeight;
      properties.imageQuality = imageQuality;
      properties.captionLayout = captionLayout;
      properties.captionSource = captionSource;
      properties.altTextSource = altTextSource;
      properties.isTransparentBackground = isTransparentBackground;
      properties.isCover = isCover;
      properties.carouselOptions = carouselOptions;
      properties.heroOptions = heroOptions;
      break;
    }
    case "image-gallery": {
      const galleryLink = links.find(
        (link) => link.category === "tree" || link.category === "set",
      );
      if (!galleryLink) {
        throw new Error(
          `Image gallery link not found for the following component: “${componentName}”`,
        );
      }

      const isFilterDisplayed =
        getPropertyValueByLabel(
          componentProperty.properties,
          "filter-displayed",
        ) === true;

      properties.galleryId = galleryLink.uuid;
      properties.isFilterDisplayed = isFilterDisplayed;
      break;
    }
    case "map": {
      const mapLink = links.find(
        (link) => link.category === "set" || link.category === "tree",
      );
      if (!mapLink) {
        throw new Error(
          `Map link not found for the following component: “${componentName}”`,
        );
      }

      let isInteractive = true;
      const isInteractiveProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "is-interactive",
      );
      if (isInteractiveProperty !== null) {
        isInteractive = isInteractiveProperty === true;
      }

      let isClustered = false;
      const isClusteredProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "is-clustered",
      );
      if (isClusteredProperty !== null) {
        isClustered = isClusteredProperty === true;
      }

      let isUsingPins = false;
      const isUsingPinsProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "is-using-pins",
      );
      if (isUsingPinsProperty !== null) {
        isUsingPins = isUsingPinsProperty === true;
      }

      let customBasemap: string | null = null;
      const customBasemapProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "custom-basemap",
      );
      if (customBasemapProperty !== null) {
        customBasemap = customBasemapProperty as string;
      }

      let isControlsDisplayed = false;
      const isControlsDisplayedProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "controls-displayed",
      );
      if (isControlsDisplayedProperty !== null) {
        isControlsDisplayed = isControlsDisplayedProperty === true;
      }

      let isFullHeight = false;
      const isFullHeightProperty = getPropertyValueByLabel(
        componentProperty.properties,
        "is-full-height",
      );
      if (isFullHeightProperty !== null) {
        isFullHeight = isFullHeightProperty === true;
      }

      properties.mapId = mapLink.uuid;
      properties.isInteractive = isInteractive;
      properties.isClustered = isClustered;
      properties.isUsingPins = isUsingPins;
      properties.customBasemap = customBasemap;
      properties.isControlsDisplayed = isControlsDisplayed;
      properties.isFullHeight = isFullHeight;
      break;
    }
    case "network-graph": {
      // TODO: Implement network graph
      break;
    }
    case "query": {
      const queries: Array<{
        label: string;
        propertyUuids: Array<string>;
        startIcon: string | null;
        endIcon: string | null;
      }> = [];

      const queryProperties = componentProperty.properties;
      if (queryProperties.length === 0) {
        throw new Error(
          `Query properties not found for the following component: “${componentName}”`,
        );
      }

      for (const query of queryProperties) {
        const querySubProperties = query.properties;

        const label = getPropertyValueByLabel(
          querySubProperties,
          "query-prompt",
        );
        if (label === null) {
          throw new Error(
            `Query prompt not found for the following component: “${componentName}”`,
          );
        }

        const propertyUuids =
          querySubProperties
            .find((property) => property.label === "use-property")
            ?.values.map((value) => value.uuid)
            .filter((uuid) => uuid !== null) ?? [];

        const startIcon = getPropertyValueByLabel(
          querySubProperties,
          "start-icon",
        );
        const endIcon = getPropertyValueByLabel(querySubProperties, "end-icon");

        queries.push({
          label: String(label),
          propertyUuids,
          startIcon: startIcon !== null ? String(startIcon) : null,
          endIcon: endIcon !== null ? String(endIcon) : null,
        });
      }

      properties.queries = queries;
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
    case "search-bar": {
      let variant = getPropertyValueByLabel(
        componentProperty.properties,
        "variant",
      );
      variant ??= "default";

      const placeholder = getPropertyValueByLabel(
        componentProperty.properties,
        "placeholder-text",
      );

      const baseQuery = getPropertyValueByLabel(
        componentProperty.properties,
        "base-query",
      );

      properties.variant = variant;
      properties.placeholder =
        placeholder !== null ? String(placeholder) : null;
      properties.baseQuery =
        baseQuery !== null ?
          String(baseQuery)
            .replaceAll(String.raw`\{`, "{")
            .replaceAll(String.raw`\}`, "}")
        : null;
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

      let variantName = "block";
      let variant;

      const variantProperty = getPropertyByLabel(
        componentProperty.properties,
        "variant",
      );
      if (variantProperty !== null) {
        variantName = variantProperty.values[0]!.content as
          | "title"
          | "block"
          | "banner"
          | "paragraph"
          | "label"
          | "heading"
          | "display";

        if (
          variantName === "paragraph" ||
          variantName === "label" ||
          variantName === "heading" ||
          variantName === "display"
        ) {
          const size = getPropertyValueByLabel(
            variantProperty.properties,
            "size",
          );

          variant = {
            name: variantName,
            size: size !== null ? (size as "xs" | "sm" | "md" | "lg") : "md",
          };
        } else {
          variant = { name: variantName };
        }
      } else {
        variant = { name: variantName };
      }

      properties.variant = variant;
      properties.content = content;
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
      isChaptersDislayed ??= true;

      properties.videoId = videoLink.uuid;
      properties.isChaptersDislayed = isChaptersDislayed === true;
      break;
    }
    default: {
      console.warn(
        `Invalid or non-implemented component name “${String(unparsedComponentName)}” for the following element: “${parseStringContent(
          elementResource.identification.label as OchreStringContent,
        )}”`,
      );
      break;
    }
  }

  return properties as WebElementComponent;
}

function parseWebTitle(
  properties: Array<Property>,
  identification: Identification,
  overrides: {
    isNameDisplayed?: boolean;
    isDescriptionDisplayed?: boolean;
    isDateDisplayed?: boolean;
    isCreatorsDisplayed?: boolean;
    isCountDisplayed?: boolean;
  } = {},
): WebTitle {
  const titleProperties = properties.find(
    (property) =>
      property.label === "presentation" &&
      property.values[0]!.content === "title",
  )?.properties;

  let variant: "default" | "simple" = "default";
  let isNameDisplayed = overrides.isNameDisplayed ?? false;
  let isDescriptionDisplayed = false;
  let isDateDisplayed = false;
  let isCreatorsDisplayed = false;
  let isCountDisplayed = overrides.isCountDisplayed ?? false;

  if (titleProperties) {
    const titleVariant = getPropertyValueByLabel(titleProperties, "variant");
    if (titleVariant) {
      variant = titleVariant as "default" | "simple";
    }

    isNameDisplayed =
      getPropertyValueByLabel(titleProperties, "name-displayed") === true;
    isDescriptionDisplayed =
      getPropertyValueByLabel(titleProperties, "description-displayed") ===
      true;
    isDateDisplayed =
      getPropertyValueByLabel(titleProperties, "date-displayed") === true;
    isCreatorsDisplayed =
      getPropertyValueByLabel(titleProperties, "creators-displayed") === true;
    isCountDisplayed =
      getPropertyValueByLabel(titleProperties, "count-displayed") === true;
  }

  return {
    label: identification.label,
    variant,
    properties: {
      isNameDisplayed,
      isDescriptionDisplayed,
      isDateDisplayed,
      isCreatorsDisplayed,
      isCountDisplayed,
    },
  };
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

  const presentationProperty = elementProperties.find(
    (property) => property.label === "presentation",
  );
  if (!presentationProperty) {
    throw new Error(
      `Presentation property not found for element “${identification.label}”`,
    );
  }

  const componentProperty = presentationProperty.properties.find(
    (property) => property.label === "component",
  );
  if (!componentProperty) {
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
    elementResourceProperties.find(
      (property) =>
        property.label === "presentation" &&
        property.values[0]!.content === "css",
    )?.properties ?? [];

  const cssStyles: Array<Style> = [];
  for (const property of cssProperties) {
    const cssStyle = property.values[0]!.content as string;
    cssStyles.push({ label: property.label, value: cssStyle });
  }

  const tabletCssProperties =
    elementResourceProperties.find(
      (property) =>
        property.label === "presentation" &&
        property.values[0]!.content === "css-tablet",
    )?.properties ?? [];

  const cssStylesTablet: Array<Style> = [];
  for (const property of tabletCssProperties) {
    const cssStyle = property.values[0]!.content as string;
    cssStylesTablet.push({ label: property.label, value: cssStyle });
  }

  const mobileCssProperties =
    elementResourceProperties.find(
      (property) =>
        property.label === "presentation" &&
        property.values[0]!.content === "css-mobile",
    )?.properties ?? [];

  const cssStylesMobile: Array<Style> = [];
  for (const property of mobileCssProperties) {
    const cssStyle = property.values[0]!.content as string;
    cssStylesMobile.push({ label: property.label, value: cssStyle });
  }

  const title = parseWebTitle(elementResourceProperties, identification, {
    isNameDisplayed: [
      "annotated-image",
      "annotated-document",
      "collection",
    ].includes(properties.component),
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
function parseWebpage(webpageResource: OchreResource): Webpage | null {
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

  const slug = webpageResource.slug;
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

  const webpageResources =
    webpageResource.resource ?
      Array.isArray(webpageResource.resource) ?
        webpageResource.resource
      : [webpageResource.resource]
    : [];

  const items: Array<WebElement | WebBlock> = [];
  for (const resource of webpageResources) {
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
    ) as "element" | "block" | undefined;
    if (resourceType == null) {
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

  const webpages =
    webpageResource.resource ?
      parseWebpageResources(
        Array.isArray(webpageResource.resource) ?
          webpageResource.resource
        : [webpageResource.resource],
        "page",
      )
    : [];

  let displayedInHeader = true;
  let width: "default" | "full" | "large" | "narrow" = "default";
  let variant: "default" | "no-background" = "default";
  let isSidebarDisplayed = true;
  let isBreadcrumbsDisplayed = false;

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
      displayedInHeader = headerProperty.content === true;
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

    const isSidebarDisplayedProperty = webpageSubProperties.find(
      (property) => property.label === "sidebar-visible",
    )?.values[0];
    if (isSidebarDisplayedProperty) {
      isSidebarDisplayed = isSidebarDisplayedProperty.content === true;
    }

    const isBreadcrumbsDisplayedProperty = webpageSubProperties.find(
      (property) => property.label === "breadcrumbs-visible",
    )?.values[0];
    if (isBreadcrumbsDisplayedProperty) {
      isBreadcrumbsDisplayed = isBreadcrumbsDisplayedProperty.content === true;
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
        value: property.values[0]!.content as string,
      });
    }
  }

  const tabletCssStyleSubProperties = webpageProperties.find(
    (property) =>
      property.label === "presentation" &&
      property.values[0]?.content === "css-tablet",
  )?.properties;
  const cssStylesTablet: Array<Style> = [];
  if (tabletCssStyleSubProperties) {
    for (const property of tabletCssStyleSubProperties) {
      cssStylesTablet.push({
        label: property.label,
        value: property.values[0]!.content as string,
      });
    }
  }

  const mobileCssStyleSubProperties = webpageProperties.find(
    (property) =>
      property.label === "presentation" &&
      property.values[0]?.content === "css-mobile",
  )?.properties;
  const cssStylesMobile: Array<Style> = [];
  if (mobileCssStyleSubProperties) {
    for (const property of mobileCssStyleSubProperties) {
      cssStylesMobile.push({
        label: property.label,
        value: property.values[0]!.content as string,
      });
    }
  }

  return {
    title: identification.label,
    slug,
    items,
    properties: {
      displayedInHeader,
      width,
      variant,
      backgroundImageUrl:
        imageLink ?
          `https://ochre.lib.uchicago.edu/ochre?uuid=${imageLink.uuid}&load`
        : null,
      isSidebarDisplayed,
      isBreadcrumbsDisplayed,
      cssStyles: {
        default: cssStyles,
        tablet: cssStylesTablet,
        mobile: cssStylesMobile,
      },
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
function parseWebpages(webpageResources: Array<OchreResource>): Array<Webpage> {
  const returnPages: Array<Webpage> = [];
  const pagesToParse =
    Array.isArray(webpageResources) ? webpageResources : [webpageResources];

  for (const page of pagesToParse) {
    const webpage = parseWebpage(page);
    if (webpage) {
      returnPages.push(webpage);
    }
  }

  return returnPages;
}

/**
 * Parses raw sidebar data into a standardized Sidebar structure
 *
 * @param resources - Array of raw sidebar resources in OCHRE format
 * @returns Parsed Sidebar object
 */
function parseSidebar(
  resources: Array<OchreResource>,
): Website["sidebar"] | null {
  let sidebar: Website["sidebar"] | null = null;
  const sidebarElements: Array<WebElement> = [];
  const sidebarTitle: WebTitle = {
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
  let sidebarLayout: "start" | "end" = "start";
  let sidebarMobileLayout: "default" | "inline" = "default";
  const sidebarCssStyles: Array<Style> = [];
  const sidebarCssStylesTablet: Array<Style> = [];
  const sidebarCssStylesMobile: Array<Style> = [];

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
        property.properties[0].values[0]?.content === "sidebar",
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
      sidebarLayout = sidebarLayoutProperty.values[0]!.content as
        | "start"
        | "end";
    }

    const sidebarMobileLayoutProperty = sidebarProperties.find(
      (property) => property.label === "layout-mobile",
    );
    if (sidebarMobileLayoutProperty) {
      sidebarMobileLayout = sidebarMobileLayoutProperty.values[0]!.content as
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
      const cssStyle = property.values[0]!.content as string;
      sidebarCssStyles.push({ label: property.label, value: cssStyle });
    }

    const tabletCssProperties =
      sidebarBaseProperties.find(
        (property) =>
          property.label === "presentation" &&
          property.values[0]!.content === "css-tablet",
      )?.properties ?? [];

    for (const property of tabletCssProperties) {
      const cssStyle = property.values[0]!.content as string;
      sidebarCssStylesTablet.push({ label: property.label, value: cssStyle });
    }

    const mobileCssProperties =
      sidebarBaseProperties.find(
        (property) =>
          property.label === "presentation" &&
          property.values[0]!.content === "css-mobile",
      )?.properties ?? [];

    for (const property of mobileCssProperties) {
      const cssStyle = property.values[0]!.content as string;
      sidebarCssStylesMobile.push({ label: property.label, value: cssStyle });
    }

    const titleProperties = sidebarBaseProperties.find(
      (property) =>
        property.label === "presentation" &&
        property.values[0]!.content === "title",
    )?.properties;

    if (titleProperties) {
      const titleVariant = getPropertyValueByLabel(titleProperties, "variant");
      if (titleVariant) {
        sidebarTitle.variant = titleVariant as "default" | "simple";
      }

      sidebarTitle.properties.isNameDisplayed =
        getPropertyValueByLabel(titleProperties, "name-displayed") === true;
      sidebarTitle.properties.isDescriptionDisplayed =
        getPropertyValueByLabel(titleProperties, "description-displayed") ===
        true;
      sidebarTitle.properties.isDateDisplayed =
        getPropertyValueByLabel(titleProperties, "date-displayed") === true;
      sidebarTitle.properties.isCreatorsDisplayed =
        getPropertyValueByLabel(titleProperties, "creators-displayed") === true;
      sidebarTitle.properties.isCountDisplayed =
        getPropertyValueByLabel(titleProperties, "count-displayed") === true;
    }

    const sidebarResources =
      sidebarResource.resource ?
        Array.isArray(sidebarResource.resource) ?
          sidebarResource.resource
        : [sidebarResource.resource]
      : [];

    for (const resource of sidebarResources) {
      const element = parseWebElement(resource);
      sidebarElements.push(element);
    }
  }

  if (sidebarElements.length > 0) {
    sidebar = {
      elements: sidebarElements,
      title: sidebarTitle,
      layout: sidebarLayout,
      mobileLayout: sidebarMobileLayout,
      cssStyles: {
        default: sidebarCssStyles,
        tablet: sidebarCssStylesTablet,
        mobile: sidebarCssStylesMobile,
      },
    };
  }

  return sidebar;
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
    ) as "element" | "block" | undefined;
    if (resourceType == null) {
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
      default: {
        layout: "vertical",
        spacing: undefined,
        gap: undefined,
        alignItems: "start",
        justifyContent: "stretch",
      },
      mobile: null,
      tablet: null,
    } as WebBlock["properties"],
    cssStyles: { default: [], tablet: [], mobile: [] },
  };

  const blockMainProperties = blockProperties.find(
    (property) =>
      property.label === "presentation" &&
      property.values[0]?.content === "block",
  )?.properties;
  if (blockMainProperties) {
    const layoutProperty = blockMainProperties.find(
      (property) => property.label === "layout",
    )?.values[0];
    if (layoutProperty) {
      returnBlock.properties.default.layout = layoutProperty.content as
        | "vertical"
        | "horizontal"
        | "grid"
        | "vertical-flex"
        | "horizontal-flex"
        | "accordion";
    }

    if (returnBlock.properties.default.layout === "accordion") {
      const isAccordionEnabledProperty = blockMainProperties.find(
        (property) => property.label === "accordion-enabled",
      )?.values[0];
      if (isAccordionEnabledProperty) {
        returnBlock.properties.default.isAccordionEnabled =
          isAccordionEnabledProperty.content === true;
      } else {
        returnBlock.properties.default.isAccordionEnabled = true;
      }

      const isAccordionExpandedByDefaultProperty = blockMainProperties.find(
        (property) => property.label === "accordion-expanded",
      )?.values[0];
      if (isAccordionExpandedByDefaultProperty) {
        returnBlock.properties.default.isAccordionExpandedByDefault =
          isAccordionExpandedByDefaultProperty.content === true;
      } else {
        returnBlock.properties.default.isAccordionExpandedByDefault = false;
      }

      const isAccordionSidebarDisplayedProperty = blockMainProperties.find(
        (property) => property.label === "accordion-sidebar-displayed",
      )?.values[0];
      if (isAccordionSidebarDisplayedProperty) {
        returnBlock.properties.default.isAccordionSidebarDisplayed =
          isAccordionSidebarDisplayedProperty.content === true;
      } else {
        returnBlock.properties.default.isAccordionSidebarDisplayed = false;
      }
    }

    const spacingProperty = blockMainProperties.find(
      (property) => property.label === "spacing",
    )?.values[0];
    if (spacingProperty) {
      returnBlock.properties.default.spacing =
        spacingProperty.content as string;
    }

    const gapProperty = blockMainProperties.find(
      (property) => property.label === "gap",
    )?.values[0];
    if (gapProperty) {
      returnBlock.properties.default.gap = gapProperty.content as string;
    }

    const alignItemsProperty = blockMainProperties.find(
      (property) => property.label === "align-items",
    )?.values[0];
    if (alignItemsProperty) {
      returnBlock.properties.default.alignItems = alignItemsProperty.content as
        | "stretch"
        | "start"
        | "center"
        | "end"
        | "space-between";
    }

    const justifyContentProperty = blockMainProperties.find(
      (property) => property.label === "justify-content",
    )?.values[0];
    if (justifyContentProperty) {
      returnBlock.properties.default.justifyContent =
        justifyContentProperty.content as
          | "stretch"
          | "start"
          | "center"
          | "end"
          | "space-between";
    }

    const tabletOverwriteProperty = blockMainProperties.find(
      (property) => property.label === "overwrite-tablet",
    );
    if (tabletOverwriteProperty) {
      const tabletOverwriteProperties = tabletOverwriteProperty.properties;

      const propertiesTablet: WebBlock["properties"]["tablet"] = {};

      const layoutProperty = tabletOverwriteProperties.find(
        (property) => property.label === "layout",
      )?.values[0];
      if (layoutProperty) {
        propertiesTablet.layout = layoutProperty.content as
          | "vertical"
          | "horizontal"
          | "grid"
          | "vertical-flex"
          | "horizontal-flex"
          | "accordion";
      }

      if (
        propertiesTablet.layout === "accordion" ||
        returnBlock.properties.default.layout === "accordion"
      ) {
        const isAccordionEnabledProperty = tabletOverwriteProperties.find(
          (property) => property.label === "accordion-enabled",
        )?.values[0];
        if (isAccordionEnabledProperty) {
          propertiesTablet.isAccordionEnabled =
            isAccordionEnabledProperty.content === true;
        }

        const isAccordionExpandedByDefaultProperty =
          tabletOverwriteProperties.find(
            (property) => property.label === "accordion-expanded",
          )?.values[0];
        if (isAccordionExpandedByDefaultProperty) {
          propertiesTablet.isAccordionExpandedByDefault =
            isAccordionExpandedByDefaultProperty.content === true;
        }

        const isAccordionSidebarDisplayedProperty =
          tabletOverwriteProperties.find(
            (property) => property.label === "accordion-sidebar-displayed",
          )?.values[0];
        if (isAccordionSidebarDisplayedProperty) {
          propertiesTablet.isAccordionSidebarDisplayed =
            isAccordionSidebarDisplayedProperty.content === true;
        }
      }

      const spacingProperty = tabletOverwriteProperties.find(
        (property) => property.label === "spacing",
      )?.values[0];
      if (spacingProperty) {
        propertiesTablet.spacing = spacingProperty.content as string;
      }

      const gapProperty = tabletOverwriteProperties.find(
        (property) => property.label === "gap",
      )?.values[0];
      if (gapProperty) {
        propertiesTablet.gap = gapProperty.content as string;
      }

      const alignItemsProperty = tabletOverwriteProperties.find(
        (property) => property.label === "align-items",
      )?.values[0];
      if (alignItemsProperty) {
        propertiesTablet.alignItems = alignItemsProperty.content as
          | "stretch"
          | "start"
          | "center"
          | "end"
          | "space-between";
      }

      const justifyContentProperty = tabletOverwriteProperties.find(
        (property) => property.label === "justify-content",
      )?.values[0];
      if (justifyContentProperty) {
        propertiesTablet.justifyContent = justifyContentProperty.content as
          | "stretch"
          | "start"
          | "center"
          | "end"
          | "space-between";
      }

      returnBlock.properties.tablet = propertiesTablet;
    }

    const mobileOverwriteProperty = blockMainProperties.find(
      (property) => property.label === "overwrite-mobile",
    );
    if (mobileOverwriteProperty) {
      const mobileOverwriteProperties = mobileOverwriteProperty.properties;

      const propertiesMobile: WebBlock["properties"]["mobile"] = {};

      const layoutProperty = mobileOverwriteProperties.find(
        (property) => property.label === "layout",
      )?.values[0];
      if (layoutProperty) {
        propertiesMobile.layout = layoutProperty.content as
          | "vertical"
          | "horizontal"
          | "grid"
          | "vertical-flex"
          | "horizontal-flex"
          | "accordion";
      }

      if (
        propertiesMobile.layout === "accordion" ||
        returnBlock.properties.default.layout === "accordion"
      ) {
        const isAccordionEnabledProperty = mobileOverwriteProperties.find(
          (property) => property.label === "accordion-enabled",
        )?.values[0];
        if (isAccordionEnabledProperty) {
          propertiesMobile.isAccordionEnabled =
            isAccordionEnabledProperty.content === true;
        }

        const isAccordionExpandedByDefaultProperty =
          mobileOverwriteProperties.find(
            (property) => property.label === "accordion-expanded",
          )?.values[0];
        if (isAccordionExpandedByDefaultProperty) {
          propertiesMobile.isAccordionExpandedByDefault =
            isAccordionExpandedByDefaultProperty.content === true;
        }

        const isAccordionSidebarDisplayedProperty =
          mobileOverwriteProperties.find(
            (property) => property.label === "accordion-sidebar-displayed",
          )?.values[0];
        if (isAccordionSidebarDisplayedProperty) {
          propertiesMobile.isAccordionSidebarDisplayed =
            isAccordionSidebarDisplayedProperty.content === true;
        }
      }

      const spacingProperty = mobileOverwriteProperties.find(
        (property) => property.label === "spacing",
      )?.values[0];
      if (spacingProperty) {
        propertiesMobile.spacing = spacingProperty.content as string;
      }

      const gapProperty = mobileOverwriteProperties.find(
        (property) => property.label === "gap",
      )?.values[0];
      if (gapProperty) {
        propertiesMobile.gap = gapProperty.content as string;
      }

      const alignItemsProperty = mobileOverwriteProperties.find(
        (property) => property.label === "align-items",
      )?.values[0];
      if (alignItemsProperty) {
        propertiesMobile.alignItems = alignItemsProperty.content as
          | "stretch"
          | "start"
          | "center"
          | "end"
          | "space-between";
      }

      const justifyContentProperty = mobileOverwriteProperties.find(
        (property) => property.label === "justify-content",
      )?.values[0];
      if (justifyContentProperty) {
        propertiesMobile.justifyContent = justifyContentProperty.content as
          | "stretch"
          | "start"
          | "center"
          | "end"
          | "space-between";
      }

      returnBlock.properties.mobile = propertiesMobile;
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
      ) as "element" | "block" | undefined;

      if (resourceType !== "element") {
        throw new Error(
          `Accordion only accepts elements, but got “${resourceType}” for the following resource: “${parseStringContent(
            resource.identification.label as OchreStringContent,
          )}”`,
        );
      }

      const presentationProperty = resourceProperties.find(
        (property) => property.label === "presentation",
      );
      const componentProperty = presentationProperty?.properties.find(
        (property) => property.label === "component",
      );
      const componentType = componentProperty?.values[0]?.content;

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
      ) as "element" | "block" | undefined;
      if (resourceType == null) {
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

  const blockCssStyles = blockProperties.find(
    (property) =>
      property.label === "presentation" &&
      property.values[0]?.content === "css",
  )?.properties;
  if (blockCssStyles) {
    for (const property of blockCssStyles) {
      returnBlock.cssStyles.default.push({
        label: property.label,
        value: property.values[0]!.content as string,
      });
    }
  }

  const blockTabletCssStyles = blockProperties.find(
    (property) =>
      property.label === "presentation" &&
      property.values[0]?.content === "css-tablet",
  )?.properties;
  if (blockTabletCssStyles) {
    for (const property of blockTabletCssStyles) {
      returnBlock.cssStyles.tablet.push({
        label: property.label,
        value: property.values[0]!.content as string,
      });
    }
  }

  const blockMobileCssStyles = blockProperties.find(
    (property) =>
      property.label === "presentation" &&
      property.values[0]?.content === "css-mobile",
  )?.properties;
  if (blockMobileCssStyles) {
    for (const property of blockMobileCssStyles) {
      returnBlock.cssStyles.mobile.push({
        label: property.label,
        value: property.values[0]!.content as string,
      });
    }
  }

  return returnBlock;
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

  let type = websiteProperties.find((property) => property.label === "webUI")
    ?.values[0]?.content;
  type ??= "traditional";

  let status = websiteProperties.find((property) => property.label === "status")
    ?.values[0]?.content;
  status ??= "development";

  let privacy = websiteProperties.find(
    (property) => property.label === "privacy",
  )?.values[0]?.content;
  privacy ??= "public";

  const result = websiteSchema.safeParse({ type, status, privacy });
  if (!result.success) {
    throw new Error(`Invalid website properties: ${result.error.message}`);
  }

  let contact: Website["properties"]["contact"] = null;
  const contactProperty = websiteProperties.find(
    (property) => property.label === "contact",
  );
  if (contactProperty) {
    const [name, email] = (contactProperty.values[0]?.content as string).split(
      ";",
    );
    contact = { name: name!, email: email ?? null };
  }

  const logoUuid =
    websiteProperties.find((property) => property.label === "logo")?.values[0]
      ?.uuid ?? null;

  let isHeaderDisplayed = true;
  let headerVariant: "default" | "floating" | "inline" = "default";
  let headerAlignment: "start" | "center" | "end" = "start";
  let isHeaderProjectDisplayed = true;
  let isFooterDisplayed = true;
  let isSidebarDisplayed = false;
  let supportsThemeToggle = true;
  let defaultTheme: "light" | "dark" | null = null;

  const headerProperty = websiteProperties.find(
    (property) => property.label === "navbar-visible",
  )?.values[0];
  if (headerProperty) {
    isHeaderDisplayed = headerProperty.content === true;
  }

  const headerVariantProperty = websiteProperties.find(
    (property) => property.label === "navbar-variant",
  )?.values[0];
  if (headerVariantProperty) {
    headerVariant = headerVariantProperty.content as
      | "default"
      | "floating"
      | "inline";
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
      isHeaderProjectDisplayedProperty.content === true;
  }

  const footerProperty = websiteProperties.find(
    (property) => property.label === "footer-visible",
  )?.values[0];
  if (footerProperty) {
    isFooterDisplayed = footerProperty.content === true;
  }

  const sidebarProperty = websiteProperties.find(
    (property) => property.label === "sidebar-visible",
  )?.values[0];
  if (sidebarProperty) {
    isSidebarDisplayed = sidebarProperty.content === true;
  }

  const supportsThemeToggleProperty = websiteProperties.find(
    (property) => property.label === "supports-theme-toggle",
  )?.values[0];
  if (supportsThemeToggleProperty) {
    supportsThemeToggle = supportsThemeToggleProperty.content === true;
  }

  const defaultThemeProperty = websiteProperties.find(
    (property) => property.label === "default-theme",
  )?.values[0];
  if (defaultThemeProperty) {
    defaultTheme = defaultThemeProperty.content as "light" | "dark";
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
    contact,
    isHeaderDisplayed,
    headerVariant,
    headerAlignment,
    isHeaderProjectDisplayed,
    isFooterDisplayed,
    isSidebarDisplayed,
    supportsThemeToggle,
    defaultTheme,
    logoUrl:
      logoUuid !== null ?
        `https://ochre.lib.uchicago.edu/ochre?uuid=${logoUuid}&load`
      : null,
  };
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
  projectName: FakeString,
  website: FakeString | null,
): Website {
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

  const pages = parseWebpages(resources);

  const sidebar = parseSidebar(resources);

  let globalOptions: Website["globalOptions"] = {
    contexts: {
      flatten: [],
      filter: [],
      sort: [],
      detail: [],
      download: [],
      label: [],
      suppress: [],
    },
  };
  if (websiteTree.websiteOptions) {
    const flattenContextsRaw =
      websiteTree.websiteOptions.flattenContexts != null ?
        Array.isArray(websiteTree.websiteOptions.flattenContexts) ?
          websiteTree.websiteOptions.flattenContexts
        : [websiteTree.websiteOptions.flattenContexts]
      : [];
    const suppressContextsRaw =
      websiteTree.websiteOptions.suppressContexts != null ?
        Array.isArray(websiteTree.websiteOptions.suppressContexts) ?
          websiteTree.websiteOptions.suppressContexts
        : [websiteTree.websiteOptions.suppressContexts]
      : [];
    const filterContextsRaw =
      websiteTree.websiteOptions.filterContexts != null ?
        Array.isArray(websiteTree.websiteOptions.filterContexts) ?
          websiteTree.websiteOptions.filterContexts
        : [websiteTree.websiteOptions.filterContexts]
      : [];
    const sortContextsRaw =
      websiteTree.websiteOptions.sortContexts != null ?
        Array.isArray(websiteTree.websiteOptions.sortContexts) ?
          websiteTree.websiteOptions.sortContexts
        : [websiteTree.websiteOptions.sortContexts]
      : [];
    const detailContextsRaw =
      websiteTree.websiteOptions.detailContexts != null ?
        Array.isArray(websiteTree.websiteOptions.detailContexts) ?
          websiteTree.websiteOptions.detailContexts
        : [websiteTree.websiteOptions.detailContexts]
      : [];
    const downloadContextsRaw =
      websiteTree.websiteOptions.downloadContexts != null ?
        Array.isArray(websiteTree.websiteOptions.downloadContexts) ?
          websiteTree.websiteOptions.downloadContexts
        : [websiteTree.websiteOptions.downloadContexts]
      : [];
    const labelContextsRaw =
      websiteTree.websiteOptions.labelContexts != null ?
        Array.isArray(websiteTree.websiteOptions.labelContexts) ?
          websiteTree.websiteOptions.labelContexts
        : [websiteTree.websiteOptions.labelContexts]
      : [];

    globalOptions = {
      contexts: {
        flatten: parseContexts(flattenContextsRaw),
        filter: parseContexts(filterContextsRaw),
        sort: parseContexts(sortContextsRaw),
        detail: parseContexts(detailContextsRaw),
        download: parseContexts(downloadContextsRaw),
        label: parseContexts(labelContextsRaw),
        suppress: parseContexts(suppressContextsRaw),
      },
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
    sidebar,
    pages,
    properties,
    searchOptions: {
      filters:
        websiteTree.searchOptions?.filterUuids != null ?
          (Array.isArray(websiteTree.searchOptions.filterUuids.uuid) ?
            websiteTree.searchOptions.filterUuids.uuid
          : [websiteTree.searchOptions.filterUuids.uuid]
          ).map((uuid) => ({ uuid: uuid.content, type: uuid.type }))
        : [],
      attributeFilters: {
        bibliographies:
          websiteTree.searchOptions?.filterUuids?.filterBibliography ?? false,
        periods: websiteTree.searchOptions?.filterUuids?.filterPeriods ?? false,
      },
      scopes:
        websiteTree.searchOptions?.scopes != null ?
          (Array.isArray(websiteTree.searchOptions.scopes.scope) ?
            websiteTree.searchOptions.scopes.scope
          : [websiteTree.searchOptions.scopes.scope]
          ).map((scope) => ({
            uuid: scope.uuid.content,
            type: scope.uuid.type,
            identification: parseIdentification(scope.identification),
          }))
        : [],
    },
    globalOptions,
  };
}
