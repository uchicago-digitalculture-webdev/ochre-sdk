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
} from "../../types/internal.raw.d.ts";
import type {
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
  Text,
  Tree,
} from "../../types/index.js";
import { propertyValueContentTypeSchema } from "../../schemas.js";
import {
  parseEmail,
  parseFakeString,
  parseStringContent,
  parseStringDocumentItem,
} from "../../utils/string.js";
import {
  ensureArray,
  getItemCategories,
  getItemCategory,
  isFakeString,
  parseCitation,
  parseFakeStringOrContent,
  parseOptionalDate,
} from "../internal.js";

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
    const result: Identification = {
      label: parseFakeStringOrContent(identification.label),
      abbreviation: "",
      code: identification.code ?? null,
    };

    for (const key of Object.keys(identification)) {
      if (key === "label" || key === "code") continue;
      const raw = identification[key as keyof OchreIdentification]!;
      result[key as keyof Identification] = parseFakeStringOrContent(
        raw as FakeString | OchreStringContent,
      );
    }

    return result;
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
      identification = {
        label:
          metadata.item.label ? parseStringContent(metadata.item.label) : "",
        abbreviation:
          metadata.item.abbreviation ?
            parseStringContent(metadata.item.abbreviation)
          : "",
        code: metadata.item.identification.code ?? null,
      };
    } else {
      identification = parseIdentification(metadata.item.identification);
    }
  }

  const projectId =
    metadata.project?.identification ?
      parseIdentification(metadata.project.identification)
    : null;

  return {
    project:
      projectId ?
        {
          identification: {
            ...projectId,
            website: metadata.project?.identification.website ?? null,
          },
          dateFormat: metadata.project?.dateFormat ?? null,
          page: metadata.project?.page ?? null,
        }
      : null,
    collection:
      metadata.collection ?
        {
          identification: parseIdentification(
            metadata.collection.identification,
          ),
          page: metadata.collection.page,
        }
      : null,
    publication:
      metadata.publication ?
        {
          identification: parseIdentification(
            metadata.publication.identification,
          ),
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
    dataset: parseFakeStringOrContent(metadata.dataset),
    publisher: parseFakeStringOrContent(metadata.publisher),
    languages: parseLanguages(metadata.language),
    identifier: parseFakeStringOrContent(metadata.identifier),
    description: parseFakeStringOrContent(metadata.description),
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
    publicationDateTime: parseOptionalDate(contextItem.publicationDateTime),
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
  return {
    nodes: ensureArray(context.context).map((ctx) => ({
      tree: parseContextItem(ctx.tree),
      project: parseContextItem(ctx.project),
      spatialUnit:
        "spatialUnit" in ctx && ctx.spatialUnit ?
          ensureArray(ctx.spatialUnit).map((element) =>
            parseContextItem(element),
          )
        : [],
    })),
    displayPath: context.displayPath,
  };
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
    publicationDateTime: parseOptionalDate(person.publicationDateTime),
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
      person.description ? parseFakeStringOrContent(person.description) : null,
    coordinates: parseCoordinates(person.coordinates),
    content: person.content != null ? parseFakeString(person.content) : null,
    notes: person.notes ? parseNotes(ensureArray(person.notes.note)) : [],
    links: person.links ? parseLinks(ensureArray(person.links)) : [],
    events: person.events ? parseEvents(ensureArray(person.events.event)) : [],
    properties:
      person.properties ?
        parseProperties(ensureArray(person.properties.property))
      : [],
    bibliographies:
      person.bibliographies ?
        parseBibliographies(ensureArray(person.bibliographies.bibliography))
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
  return persons.map((person) => parsePerson(person));
}

/**
 * Parses an array of raw links into standardized Link objects
 *
 * @param linkRaw - Raw OCHRE link
 * @returns Parsed Link object
 */
export function parseLink(linkRaw: OchreLink): Array<Link> {
  const linkCategoryKeys = [
    "resource",
    "spatialUnit",
    "concept",
    "set",
    "tree",
    "person",
    "bibliography",
    "propertyVariable",
    "propertyValue",
  ] as const;

  const categoryKey = linkCategoryKeys.find((key) => key in linkRaw);
  if (!categoryKey) {
    throw new Error(
      `Invalid link provided: ${JSON.stringify(linkRaw, null, 2)}`,
    );
  }

  const links = linkRaw[categoryKey];
  if (links == null) {
    return [];
  }

  return ensureArray(links).map((link) => {
    const returnLink: Link = {
      category: categoryKey,
      content:
        "content" in link && link.content != null ?
          parseFakeString(link.content)
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
        "bibliography" in linkRaw && linkRaw.bibliography != null ?
          parseBibliographies(ensureArray(linkRaw.bibliography))
        : null,
      publicationDateTime: parseOptionalDate(link.publicationDateTime),
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

    return returnLink;
  });
}

/**
 * Parses an array of raw links into standardized Link objects
 *
 * @param links - Array of raw OCHRE links
 * @returns Array of parsed Link objects
 */
export function parseLinks(links: Array<OchreLink>): Array<Link> {
  const result: Array<Link> = [];
  for (const link of links) {
    result.push(...parseLink(link));
  }
  return result;
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
  const doc =
    Array.isArray(document) ?
      document.find((d) => d.lang === language)!
    : document;

  if (isFakeString(doc.string)) {
    return parseEmail(parseFakeString(doc.string));
  }

  let result = "";
  for (const item of ensureArray(doc.string)) {
    result += parseStringDocumentItem(item);
  }
  return result;
}

/**
 * Parses raw image data into a standardized Image structure
 *
 * @param image - Raw image data in OCHRE format
 * @returns Parsed Image object or null if invalid
 */
export function parseImage(image: OchreImage): Image | null {
  return {
    publicationDateTime: parseOptionalDate(image.publicationDateTime),
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
  const result: Array<Note> = [];

  for (const note of notes) {
    if (typeof note === "string") {
      if (note !== "") {
        result.push({
          number: -1,
          title: null,
          date: null,
          authors: [],
          content: note,
        });
      }
      continue;
    }

    const notesToParse = note.content != null ? ensureArray(note.content) : [];
    if (notesToParse.length === 0) continue;

    const noteWithLanguage =
      notesToParse.find((item) => item.lang === language) ?? notesToParse[0];
    if (!noteWithLanguage) {
      throw new Error(
        `Note does not have a valid content item: ${JSON.stringify(note, null, 2)}`,
      );
    }

    const content =
      isFakeString(noteWithLanguage.string) ?
        parseEmail(parseFakeString(noteWithLanguage.string))
      : parseEmail(parseDocument(noteWithLanguage));

    result.push({
      number: note.noteNo,
      title:
        noteWithLanguage.title != null ?
          parseFakeString(noteWithLanguage.title)
        : null,
      date: note.date ?? null,
      authors:
        note.authors ? parsePersons(ensureArray(note.authors.author)) : [],
      content,
    });
  }

  return result;
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

  const result: Array<Coordinate> = [];

  for (const coord of ensureArray(coordinates.coord)) {
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
        result.push({
          type: coord.type,
          latitude: coord.latitude,
          longitude: coord.longitude,
          altitude: coord.altitude ?? null,
          source,
        });
        break;
      }
      case "plane": {
        result.push({
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

  return result;
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
        isFakeString(observation.observers) ?
          parseFakeString(observation.observers)
            .split(";")
            .map((observer) => observer.trim())
        : parsePersons(ensureArray(observation.observers))
      : [],
    notes:
      observation.notes ? parseNotes(ensureArray(observation.notes.note)) : [],
    links: observation.links ? parseLinks(ensureArray(observation.links)) : [],
    properties:
      observation.properties ?
        parseProperties(ensureArray(observation.properties.property))
      : [],
    bibliographies:
      observation.bibliographies ?
        parseBibliographies(
          ensureArray(observation.bibliographies.bibliography),
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
  return observations.map((obs) => parseObservation(obs));
}

/**
 * Parses an array of raw events into standardized Event objects
 *
 * @param events - Array of raw events in OCHRE format
 * @returns Array of parsed Event objects
 */
export function parseEvents(events: Array<OchreEvent>): Array<Event> {
  return events.map((event) => ({
    dateTime:
      event.endDateTime != null ?
        `${event.dateTime}/${event.endDateTime}`
      : (event.dateTime ?? null),
    label: parseStringContent(event.label),
    location:
      event.location ?
        {
          uuid: event.location.uuid,
          publicationDateTime: parseOptionalDate(
            event.location.publicationDateTime,
          ),
          content: parseStringContent(event.location),
        }
      : null,
    agent:
      event.agent ?
        {
          uuid: event.agent.uuid,
          publicationDateTime: parseOptionalDate(
            event.agent.publicationDateTime,
          ),
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
  }));
}

export function parseProperty(
  property: OchreProperty,
  language = "eng",
): Property {
  const valuesToParse =
    "value" in property && property.value ? ensureArray(property.value) : [];

  const values = valuesToParse.map((value) => {
    let content: string | number | boolean | Date | null = null;
    let label: string | null = null;

    if (isFakeString(value)) {
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
        publicationDateTime: parseOptionalDate(value.publicationDateTime),
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
      property.property ? parseProperties(ensureArray(property.property)) : [],
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
  return properties.map((prop) => parseProperty(prop, language));
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
  return interpretations.map((interp) => ({
    date: interp.date ?? null,
    number: interp.interpretationNo,
    links: interp.links ? parseLinks(ensureArray(interp.links)) : [],
    properties:
      interp.properties ?
        parseProperties(ensureArray(interp.properties.property))
      : [],
    bibliographies:
      interp.bibliographies ?
        parseBibliographies(ensureArray(interp.bibliographies.bibliography))
      : [],
  }));
}

/**
 * Parses raw image map data into a standardized ImageMap structure
 *
 * @param imageMap - Raw image map data in OCHRE format
 * @returns Parsed ImageMap object
 */
export function parseImageMap(imageMap: OchreImageMap): ImageMap {
  return {
    width: imageMap.width,
    height: imageMap.height,
    area: ensureArray(imageMap.area).map((area) => ({
      uuid: area.uuid,
      publicationDateTime: parseOptionalDate(area.publicationDateTime),
      category: area.type,
      title: parseFakeString(area.title),
      shape:
        area.shape === "rect" ? "rectangle"
        : area.shape === "circle" ? "circle"
        : "polygon",
      coords: area.coords.split(",").map((coord) => Number.parseInt(coord)),
      slug: area.slug ? parseFakeString(area.slug) : null,
    })),
  };
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
    publicationDateTime: parseOptionalDate(period.publicationDateTime),
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
  return periods.map((period) => parsePeriod(period));
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
  const sourceResources: Bibliography["sourceResources"] =
    bibliography.source?.resource ?
      ensureArray(bibliography.source.resource).map((resource) => ({
        uuid: resource.uuid,
        category: "resource" as const,
        publicationDateTime: parseISO(resource.publicationDateTime),
        type: resource.type,
        identification: parseIdentification(resource.identification),
        href: resource.href ?? null,
      }))
    : [];

  return {
    uuid: bibliography.uuid ?? null,
    belongsTo: belongsTo ?? null,
    zoteroId: bibliography.zoteroId ?? null,
    category: "bibliography",
    metadata: metadata ?? null,
    publicationDateTime: parseOptionalDate(bibliography.publicationDateTime),
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
      short: parseCitation(bibliography.citationFormatSpan),
      long: parseCitation(bibliography.referenceFormatDiv),
    },
    publicationInfo: {
      publishers:
        bibliography.publicationInfo?.publishers ?
          parsePersons(
            ensureArray(
              bibliography.publicationInfo.publishers.publishers.person,
            ),
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
        parsePeriods(ensureArray(bibliography.periods.period))
      : [],
    authors:
      bibliography.authors ?
        parsePersons(ensureArray(bibliography.authors.person))
      : [],
    links:
      bibliography.links ? parseLinks(ensureArray(bibliography.links)) : [],
    reverseLinks:
      bibliography.reverseLinks ?
        parseLinks(ensureArray(bibliography.reverseLinks))
      : [],
    properties:
      bibliography.properties ?
        parseProperties(ensureArray(bibliography.properties.property))
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
    publicationDateTime: parseOptionalDate(
      propertyVariable.publicationDateTime,
    ),
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
  return propertyVariables.map((pv) => parsePropertyVariable(pv));
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
  return bibliographies.map((bib) => parseBibliography(bib));
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
    publicationDateTime: parseOptionalDate(propertyValue.publicationDateTime),
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
        parsePersons(ensureArray(propertyValue.creators.creator))
      : [],
    description:
      propertyValue.description ?
        parseFakeStringOrContent(propertyValue.description)
      : "",
    coordinates: parseCoordinates(propertyValue.coordinates),
    notes:
      propertyValue.notes ?
        parseNotes(ensureArray(propertyValue.notes.note))
      : [],
    links:
      propertyValue.links ? parseLinks(ensureArray(propertyValue.links)) : [],
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
  return propertyValues.map((pv) => parsePropertyValue(pv));
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
    publicationDateTime: parseOptionalDate(text.publicationDateTime),
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
      text.creators ? parsePersons(ensureArray(text.creators.creator)) : [],
    editors:
      text.editions ? parsePersons(ensureArray(text.editions.editor)) : [],
    notes: text.notes ? parseNotes(ensureArray(text.notes.note)) : [],
    description:
      text.description ?
        parseStringContent(text.description as OchreStringContent)
      : "",
    coordinates: parseCoordinates(text.coordinates),
    periods: text.periods ? parsePeriods(ensureArray(text.periods.period)) : [],
    links: text.links ? parseLinks(ensureArray(text.links)) : [],
    reverseLinks:
      text.reverseLinks ? parseLinks(ensureArray(text.reverseLinks)) : [],
    properties:
      text.properties ?
        parseProperties(ensureArray(text.properties.property))
      : [],
    bibliographies:
      text.bibliographies ?
        parseBibliographies(ensureArray(text.bibliographies.bibliography))
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
  return texts.map((text) => parseText(text));
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
  const translation =
    sections.translation ?
      ensureArray(sections.translation.section).map((s) =>
        parseSection(s, "translation"),
      )
    : [];
  const phonemic =
    sections.phonemic ?
      ensureArray(sections.phonemic.section).map((s) =>
        parseSection(s, "phonemic"),
      )
    : [];

  return [...translation, ...phonemic];
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

  const creators =
    tree.creators ? parsePersons(ensureArray(tree.creators.creator)) : [];
  const date = tree.date ?? null;

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
      items = parseResources(ensureArray(tree.items.resource));
      break;
    }
    case "spatialUnit": {
      if (!("spatialUnit" in tree.items)) {
        throw new Error("Invalid OCHRE data: Tree has no spatial units");
      }
      items = parseSpatialUnits(ensureArray(tree.items.spatialUnit));
      break;
    }
    case "concept": {
      if (!("concept" in tree.items)) {
        throw new Error("Invalid OCHRE data: Tree has no concepts");
      }
      items = parseConcepts(ensureArray(tree.items.concept));
      break;
    }
    case "period": {
      if (!("period" in tree.items)) {
        throw new Error("Invalid OCHRE data: Tree has no periods");
      }
      items = parsePeriods(ensureArray(tree.items.period));
      break;
    }
    case "bibliography": {
      if (!("bibliography" in tree.items)) {
        throw new Error("Invalid OCHRE data: Tree has no bibliographies");
      }
      items = parseBibliographies(ensureArray(tree.items.bibliography));
      break;
    }
    case "person": {
      if (!("person" in tree.items)) {
        throw new Error("Invalid OCHRE data: Tree has no persons");
      }
      items = parsePersons(ensureArray(tree.items.person));
      break;
    }
    case "propertyVariable": {
      if (!("propertyVariable" in tree.items)) {
        throw new Error("Invalid OCHRE data: Tree has no property variables");
      }
      items = parsePropertyVariables(ensureArray(tree.items.propertyVariable));
      break;
    }
    case "propertyValue": {
      if (!("propertyValue" in tree.items)) {
        throw new Error("Invalid OCHRE data: Tree has no property values");
      }
      items = parsePropertyValues(ensureArray(tree.items.propertyValue));
      break;
    }
    case "text": {
      if (!("text" in tree.items)) {
        throw new Error("Invalid OCHRE data: Tree has no texts");
      }
      items = parseTexts(ensureArray(tree.items.text));
      break;
    }
    case "set": {
      if (!("set" in tree.items)) {
        throw new Error("Invalid OCHRE data: Tree has no sets");
      }
      items = ensureArray(tree.items.set).map((item) =>
        parseSet<Array<U>>(item, itemCategories as Array<U>),
      );
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
        parseProperties(ensureArray(tree.properties.property))
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
  return trees.map((tree) => parseTree<U>(tree));
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
          ...(parseResources(ensureArray(set.items.resource)) as Array<
            Item<U[number]>
          >),
        );
        break;
      }
      case "spatialUnit": {
        if (!("spatialUnit" in set.items) || set.items.spatialUnit == null) {
          throw new Error("Invalid OCHRE data: Set has no spatial units");
        }
        items.push(
          ...(parseSpatialUnits(ensureArray(set.items.spatialUnit)) as Array<
            Item<U[number]>
          >),
        );
        break;
      }
      case "concept": {
        if (!("concept" in set.items) || set.items.concept == null) {
          throw new Error("Invalid OCHRE data: Set has no concepts");
        }
        items.push(
          ...(parseConcepts(ensureArray(set.items.concept)) as Array<
            Item<U[number]>
          >),
        );
        break;
      }
      case "period": {
        if (!("period" in set.items) || set.items.period == null) {
          throw new Error("Invalid OCHRE data: Set has no periods");
        }
        items.push(
          ...(parsePeriods(ensureArray(set.items.period)) as Array<
            Item<U[number]>
          >),
        );
        break;
      }
      case "bibliography": {
        if (!("bibliography" in set.items) || set.items.bibliography == null) {
          throw new Error("Invalid OCHRE data: Set has no bibliographies");
        }
        items.push(
          ...(parseBibliographies(ensureArray(set.items.bibliography)) as Array<
            Item<U[number]>
          >),
        );
        break;
      }
      case "person": {
        if (!("person" in set.items) || set.items.person == null) {
          throw new Error("Invalid OCHRE data: Set has no persons");
        }
        items.push(
          ...(parsePersons(ensureArray(set.items.person)) as Array<
            Item<U[number]>
          >),
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
            ensureArray(set.items.propertyVariable),
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
            ensureArray(set.items.propertyValue),
          ) as Array<Item<U[number]>>),
        );
        break;
      }
      case "text": {
        if (!("text" in set.items) || set.items.text == null) {
          throw new Error("Invalid OCHRE data: Set has no texts");
        }
        items.push(
          ...(parseTexts(ensureArray(set.items.text)) as Array<
            Item<U[number]>
          >),
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
    publicationDateTime: parseOptionalDate(set.publicationDateTime),
    persistentUrl: persistentUrl ?? null,
    date: set.date ?? null,
    license: parseLicense(set.availability),
    identification: parseIdentification(set.identification),
    isSuppressingBlanks: set.suppressBlanks ?? false,
    description:
      set.description ? parseFakeStringOrContent(set.description) : "",
    creators:
      set.creators ? parsePersons(ensureArray(set.creators.creator)) : [],
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
  return sets.map((s) => parseSet<U>(s));
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
  return {
    uuid: resource.uuid,
    category: "resource",
    belongsTo: belongsTo ?? null,
    metadata: metadata ?? null,
    publicationDateTime: parseOptionalDate(resource.publicationDateTime),
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
        parsePersons(ensureArray(resource.creators.creator))
      : [],
    notes: resource.notes ? parseNotes(ensureArray(resource.notes.note)) : [],
    description:
      resource.description ?
        parseFakeStringOrContent(resource.description)
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
        parsePeriods(ensureArray(resource.periods.period))
      : [],
    links: resource.links ? parseLinks(ensureArray(resource.links)) : [],
    reverseLinks:
      resource.reverseLinks ?
        parseLinks(ensureArray(resource.reverseLinks))
      : [],
    properties:
      resource.properties ?
        parseProperties(ensureArray(resource.properties.property))
      : [],
    bibliographies:
      resource.bibliographies ?
        parseBibliographies(ensureArray(resource.bibliographies.bibliography))
      : [],
    resources:
      resource.resource ? parseResources(ensureArray(resource.resource)) : [],
  };
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
  return resources.map((resource) => parseResource(resource));
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
  return {
    uuid: spatialUnit.uuid,
    category: "spatialUnit",
    belongsTo: belongsTo ?? null,
    metadata: metadata ?? null,
    publicationDateTime: parseOptionalDate(spatialUnit.publicationDateTime),
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
        parseFakeStringOrContent(spatialUnit.description)
      : "",
    coordinates: parseCoordinates(spatialUnit.coordinates),
    mapData: spatialUnit.mapData ?? null,
    observations:
      "observations" in spatialUnit && spatialUnit.observations ?
        parseObservations(ensureArray(spatialUnit.observations.observation))
      : spatialUnit.observation ? [parseObservation(spatialUnit.observation)]
      : [],
    events:
      "events" in spatialUnit && spatialUnit.events ?
        parseEvents(ensureArray(spatialUnit.events.event))
      : [],
    properties:
      "properties" in spatialUnit && spatialUnit.properties ?
        parseProperties(ensureArray(spatialUnit.properties.property))
      : [],
    bibliographies:
      spatialUnit.bibliographies ?
        parseBibliographies(
          ensureArray(spatialUnit.bibliographies.bibliography),
        )
      : [],
  };
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
  return spatialUnits.map((su) => parseSpatialUnit(su));
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
  return {
    uuid: concept.uuid,
    category: "concept",
    belongsTo: belongsTo ?? null,
    metadata: metadata ?? null,
    publicationDateTime: parseOptionalDate(concept.publicationDateTime),
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
          ensureArray(concept.interpretations.interpretation),
        )
      : [],
    properties:
      concept.properties ?
        parseProperties(ensureArray(concept.properties.property))
      : [],
    bibliographies:
      concept.bibliographies ?
        parseBibliographies(ensureArray(concept.bibliographies.bibliography))
      : [],
  };
}

/**
 * Parses raw concept data into standardized Concept objects
 *
 * @param concepts - Array of raw concept data in OCHRE format
 * @returns Array of parsed Concept objects
 */
export function parseConcepts(concepts: Array<OchreConcept>): Array<Concept> {
  return concepts.map((concept) => parseConcept(concept));
}
