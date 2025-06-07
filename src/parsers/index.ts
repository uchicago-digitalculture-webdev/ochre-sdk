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
} from "../../types/internal.raw.js";
import type {
  Bibliography,
  Concept,
  Context,
  ContextItem,
  Coordinates,
  DataCategory,
  Document,
  Event,
  Footnote,
  Identification,
  Image,
  ImageMap,
  Interpretation,
  ItemsDataCategory,
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
  Set,
  SpatialUnit,
  Tree,
} from "../../types/index.js";
import { propertyValueContentTypeSchema } from "../../schemas.js";
import { getItemCategory } from "../helpers.js";
import {
  parseEmail,
  parseFakeString,
  parseStringContent,
  parseStringDocumentItem,
} from "../string.js";

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

    return { label: "", abbreviation: "" };
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
): Metadata["languages"] {
  if (language == null) {
    // Default to English if no language is provided
    return [{ name: "English", isDefault: true }];
  }

  if (Array.isArray(language)) {
    return language.map((lang) => ({
      name: parseStringContent(lang),
      isDefault: false,
    }));
  } else {
    // TODO: Handle default language parsing
    return [{ name: parseStringContent(language), isDefault: false }];
  }
}

/**
 * Parses raw metadata into the standardized Metadata type
 *
 * @param metadata - Raw metadata from OCHRE format
 * @returns Parsed Metadata object
 */
export function parseMetadata(metadata: OchreMetadata): Metadata {
  let identification: Identification = { label: "", abbreviation: "" };
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
    index: contextItem.n,
    content: parseFakeString(contextItem.content),
  };
}

/**
 * Parses raw context data into the standardized Context type
 *
 * @param context - Raw context data from OCHRE format
 * @returns Parsed Context object
 */
export function parseContext<T extends DataCategory>(
  context: OchreContext,
): Context<T> {
  const contexts =
    Array.isArray(context.context) ? context.context : [context.context];

  const returnContexts: Context<T> = {
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
    context: person.context ? parseContext(person.context) : null,
    date: person.date != null ? new Date(person.date) : null,
    identification:
      person.identification ?
        parseIdentification(person.identification)
      : { label: "", abbreviation: "" },
    license: person.availability ? parseLicense(person.availability) : null,
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
    : "propertyVariable" in linkRaw ? linkRaw.propertyVariable
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
        : "propertyVariable" in linkRaw ? "propertyVariable"
        : null,
      content:
        "content" in link ?
          link.content != null ?
            parseFakeString(link.content)
          : null
        : null,
      href: "href" in link && link.href != null ? link.href : null,
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
    returnString += parseEmail(parseFakeString(documentWithLanguage.string));
  } else {
    const documentItems =
      Array.isArray(documentWithLanguage.string) ?
        documentWithLanguage.string
      : [documentWithLanguage.string];

    for (const item of documentItems) {
      returnString += parseStringDocumentItem(item, footnotes);
    }
  }

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

      returnNotes.push({ number: -1, title: null, content: note, authors: [] });
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
      content = parseEmail(parseFakeString(noteWithLanguage.string));
    } else {
      content = parseEmail(parseDocument(noteWithLanguage).content);
    }

    returnNotes.push({
      number: note.noteNo,
      title:
        noteWithLanguage.title != null ?
          parseFakeString(noteWithLanguage.title)
        : null,
      content,
      authors:
        note.authors ?
          parsePersons(
            Array.isArray(note.authors.author) ?
              note.authors.author
            : [note.authors.author],
          )
        : [],
    });
  }

  return returnNotes;
}

/**
 * Parses raw coordinates data into a standardized Coordinates array
 *
 * @param coordinates - Raw coordinates data in OCHRE format
 * @returns Parsed Coordinates array
 */
export function parseCoordinates(
  coordinates: OchreCoordinates | undefined,
): Array<Coordinates> {
  if (coordinates == null) {
    return [];
  }

  const returnCoordinates: Array<Coordinates> = [];

  const coordsToParse =
    Array.isArray(coordinates.coord) ? coordinates.coord : [coordinates.coord];

  for (const coord of coordsToParse) {
    const source: Coordinates["source"] =
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
    date: observation.date != null ? new Date(observation.date) : null,
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
    const ochreAgent: OchrePerson | null =
      event.agent ?
        {
          uuid: event.agent.uuid,
          identification: { label: parseFakeString(event.agent.content) },
        }
      : null;

    returnEvents.push({
      date: event.dateTime != null ? new Date(event.dateTime) : null,
      label: parseStringContent(event.label),
      agent: ochreAgent ? parsePerson(ochreAgent) : null,
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
    let content: string | number | boolean | Date | Coordinates | null = null;
    let booleanLabel: string | null = null;

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      content = parseFakeString(value);
      const returnValue: PropertyValueContent<"string"> = {
        content,
        booleanLabel,
        isUncertain: false,
        type: "string",
        category: "value",
        uuid: null,
        publicationDateTime: null,
        unit: null,
      };

      return returnValue;
    } else {
      let parsedType: PropertyValueContentType = "string";
      if (value.type != null) {
        const { data, error } = propertyValueContentTypeSchema.safeParse(
          value.type,
        );
        if (error) {
          throw new Error(
            `Invalid property value content type: "${value.type}"`,
          );
        }

        parsedType = data;
      }

      switch (parsedType) {
        case "integer":
        case "decimal": {
          content = Number(value.content);
          break;
        }
        case "date":
        case "dateTime": {
          content =
            value.content ?
              typeof value.content === "string" ?
                new Date(value.content)
              : new Date(parseStringContent({ content: value.content }))
            : null;
          break;
        }
        case "coordinate": {
          content = null;
          break;
        }
        case "boolean": {
          if (value.content != null) {
            booleanLabel = parseStringContent({ content: value.content });
          }

          content = value.booleanValue ?? null;

          break;
        }
        default: {
          if ("slug" in value && value.slug != null) {
            content = parseFakeString(value.slug);
          } else if (value.content != null) {
            content = parseStringContent({ content: value.content });
          }

          break;
        }
      }

      const returnValue: PropertyValueContent<typeof parsedType> = {
        content,
        booleanLabel,
        isUncertain: value.isUncertain ?? false,
        type: parsedType,
        category: value.category ?? "value",
        uuid: value.uuid ?? null,
        publicationDateTime:
          value.publicationDateTime != null ?
            new Date(value.publicationDateTime)
          : null,
        unit: value.unit ?? null,
      };

      return returnValue;
    }
  });

  return {
    label: {
      uuid: property.label.uuid,
      name: parseStringContent(property.label, language)
        .replace(/\s*\.{3}$/, "")
        .trim(),
    },
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
    areas: [],
    width: imageMap.width,
    height: imageMap.height,
  };

  const imageMapAreasToParse =
    Array.isArray(imageMap.area) ? imageMap.area : [imageMap.area];

  const parsedUuids = new Set<string>();
  for (const area of imageMapAreasToParse) {
    if (parsedUuids.has(area.uuid)) {
      continue;
    }

    const allAreas = imageMapAreasToParse.filter((a) => a.uuid === area.uuid);

    returnImageMap.areas.push({
      uuid: area.uuid,
      publicationDateTime:
        area.publicationDateTime != null ?
          new Date(area.publicationDateTime)
        : null,
      type: area.type,
      title: parseFakeString(area.title),
      items: allAreas.map((a) => ({
        shape: a.shape === "rect" ? "rectangle" : "polygon",
        coords: a.coords.split(",").map((coord) => Number.parseInt(coord)),
      })),
    });

    parsedUuids.add(area.uuid);
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
    publicationDateTime:
      propertyValue.publicationDateTime ?
        new Date(propertyValue.publicationDateTime)
      : null,
    context: propertyValue.context ? parseContext(propertyValue.context) : null,
    license:
      propertyValue.availability ?
        parseLicense(propertyValue.availability)
      : null,
    identification: parseIdentification(propertyValue.identification),
    date: propertyValue.date ? new Date(propertyValue.date) : null,
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
export function parseTree<T extends ItemsDataCategory>(
  tree: OchreTree,
  itemsCategory?: T,
): Tree<T> {
  if (typeof tree.items === "string") {
    throw new TypeError("Invalid OCHRE data: Tree has no items");
  }

  const parsedItemCategory =
    itemsCategory ?? getItemCategory(Object.keys(tree.items));

  let items:
    | Array<Resource>
    | Array<SpatialUnit>
    | Array<Concept>
    | Array<Period>
    | Array<Bibliography>
    | Array<Person>
    | Array<PropertyValue> = [];

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

  switch (parsedItemCategory) {
    case "resource": {
      if (!("resource" in tree.items)) {
        throw new Error("Invalid OCHRE data: Tree has no resources");
      }
      items = parseResources(
        Array.isArray(tree.items.resource) ?
          tree.items.resource
        : [tree.items.resource],
      ) as Array<Resource>;
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
      ) as Array<SpatialUnit>;
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
      ) as Array<Concept>;
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
      ) as Array<Period>;
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
      ) as Array<Bibliography>;
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
      ) as Array<Person>;
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
      ) as Array<PropertyValue>;
      break;
    }
    default: {
      throw new Error("Invalid OCHRE data: Tree has no items or is malformed");
    }
  }

  const returnTree: Tree<T> = {
    uuid: tree.uuid,
    category: "tree",
    itemsCategory: itemsCategory!,
    publicationDateTime: new Date(tree.publicationDateTime),
    identification: parseIdentification(tree.identification),
    creators,
    license: parseLicense(tree.availability),
    date,
    type: tree.type,
    number: tree.n,
    items: items as T extends "set" ? Array<Set>
    : T extends "resource" ? Array<Resource>
    : T extends "spatialUnit" ? Array<SpatialUnit>
    : T extends "concept" ? Array<Concept>
    : T extends "period" ? Array<Period>
    : T extends "bibliography" ? Array<Bibliography>
    : T extends "person" ? Array<Person>
    : T extends "propertyValue" ? Array<PropertyValue>
    : T extends "propertyVariable" ? Array<PropertyVariable>
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
export function parseSet<T extends ItemsDataCategory>(
  set: OchreSet,
  itemsCategory?: T,
): Set<T> {
  if (typeof set.items === "string") {
    throw new TypeError("Invalid OCHRE data: Set has no items");
  }

  const parsedItemCategory =
    itemsCategory ?? getItemCategory(Object.keys(set.items));

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
    itemsCategory: itemsCategory!,
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
    items: items as T extends "resource" ? Array<Resource>
    : T extends "spatialUnit" ? Array<SpatialUnit>
    : T extends "concept" ? Array<Concept>
    : T extends "period" ? Array<Period>
    : T extends "bibliography" ? Array<Bibliography>
    : T extends "person" ? Array<Person>
    : T extends "propertyValue" ? Array<PropertyValue>
    : T extends "propertyVariable" ? Array<PropertyVariable>
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
    fileFormat: resource.format ?? null,
    context:
      "context" in resource && resource.context ?
        parseContext(resource.context)
      : null,
    license:
      "availability" in resource && resource.availability ?
        parseLicense(resource.availability)
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

  return returnConcept;
}

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
