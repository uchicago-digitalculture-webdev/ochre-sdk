import type {
  BaseItem,
  Data,
  DataCategory,
  Identification,
  ItemsDataCategory,
  MultilingualText,
} from "../types/index.js";
import type {
  XMLBibliography,
  XMLConcept,
  XMLData,
  XMLIdentification,
  XMLPeriod,
  XMLPerson,
  XMLPropertyValue,
  XMLPropertyVariable,
  XMLResource,
  XMLSet,
  XMLSpatialUnit,
  XMLText,
  XMLTree,
} from "../types/xml/types.js";
import { parseISO } from "date-fns";
import { DEFAULT_LANGUAGE } from "../constants.js";
import { parseXMLContent, parseXMLText } from "./string.js";

/**
 * Parses the identification of an item or project
 * @param rawIdentification - The raw identification from the XML data
 * @param options - The options for the identification
 * @param options.languages - The languages to use
 * @param options.isRichText - Whether to parse the text as rich text
 * @returns The parsed identification
 *
 * @internal
 */
function parseIdentification<V extends ReadonlyArray<string>>(
  rawIdentification: XMLIdentification,
  options: { languages: V; isRichText: boolean },
): Identification<V> {
  return {
    label:
      "content" in rawIdentification.label ?
        (parseXMLContent(rawIdentification.label, {
          languages: options.languages,
          isRichText: options.isRichText,
        }) as MultilingualText<V>)
      : (Object.fromEntries(
          options.languages.map((language) => [
            language,
            parseXMLText(rawIdentification.label as XMLText, {
              isRichText: options.isRichText,
              parseEmail: false,
            }),
          ]),
        ) as MultilingualText<V>),
    abbreviation:
      rawIdentification.abbreviation == null ? null
      : "content" in rawIdentification.abbreviation! ?
        (parseXMLContent(rawIdentification.abbreviation, {
          languages: options.languages,
          isRichText: options.isRichText,
        }) as MultilingualText<V>)
      : (Object.fromEntries(
          options.languages.map((language) => [
            language,
            parseXMLText(rawIdentification.abbreviation as XMLText, {
              isRichText: options.isRichText,
              parseEmail: false,
            }),
          ]),
        ) as MultilingualText<V>),
  };
}

/**
 * Parses the base item from the XML data
 * @param category - The category of the OCHRE item to fetch
 * @param rawItem - The raw XML data
 * @param options - The options for the parser
 * @param options.languages - The languages to use
 * @param options.isRichText - Whether to parse the text as rich text
 * @returns The parsed base item
 *
 * @internal
 */
function parseBaseItem<
  T extends DataCategory,
  V extends ReadonlyArray<string> | undefined = undefined,
>(
  category: T,
  rawItem: T extends "tree" ? XMLTree
  : T extends "bibliography" ? XMLBibliography
  : T extends "concept" ? XMLConcept
  : T extends "spatialUnit" ? XMLSpatialUnit
  : T extends "period" ? XMLPeriod
  : T extends "person" ? XMLPerson
  : T extends "propertyValue" ? XMLPropertyValue
  : T extends "propertyVariable" ? XMLPropertyVariable
  : T extends "resource" ? XMLResource
  : T extends "set" ? XMLSet
  : never,
  options: { languages: V; isRichText: boolean },
): BaseItem<T, V> {
  const returnItem: BaseItem<T, V> = {
    uuid: rawItem.uuid,
    category,
    publicationDateTime:
      rawItem.publicationDateTime == null ?
        null
      : parseISO(rawItem.publicationDateTime),
    context: null, // TODO: parse context
    date: rawItem.date == null ? null : parseISO(rawItem.date),
    license:
      rawItem.availability == null ?
        null
      : {
          content: parseXMLText(rawItem.availability.license, {
            isRichText: false,
            parseEmail: false,
          }),
          target: rawItem.availability.license.target ?? "",
        },
    identification: parseIdentification(rawItem.identification, {
      languages: options.languages ?? [DEFAULT_LANGUAGE],
      isRichText: options.isRichText,
    }),
    creators: null, // TODO: parse creators
    description:
      rawItem.description == null ?
        null
      : parseXMLContent(rawItem.description, {
          languages: options.languages ?? [DEFAULT_LANGUAGE],
          isRichText: options.isRichText,
        }),
    events: null, // TODO: parse events
    items: null, // TODO: parse items
  };

  return returnItem;
}

/**
 * Parses the data from the XML data
 * @param rawData - The raw XML data
 * @param options - The options for the parser
 * @param options.category - The category of the OCHRE item to fetch
 * @param options.itemCategory - The category of items contained in the OCHRE item to fetch (only used for tree and set)
 * @param options.languages - The languages to use
 * @param options.isRichText - Whether to parse the text as rich text
 * @returns The parsed data
 *
 * @internal
 */
export function parseData<
  T extends DataCategory,
  U extends T extends "tree" | "set" ? ItemsDataCategory : never = never,
  V extends ReadonlyArray<string> | undefined = undefined,
>(
  rawData: XMLData,
  options: {
    category?: T;
    itemCategory?: U;
    languages?: V;
    isRichText?: boolean;
  },
): Data<T, U, V> {
  const metadataLanguages = rawData.ochre.metadata.language?.map((language) =>
    parseXMLText(language, {
      isRichText: options.isRichText ?? false,
      parseEmail: false,
    }),
  ) ?? [DEFAULT_LANGUAGE];
  const languagesToUse =
    options.languages != null && options.languages.length > 0 ?
      metadataLanguages.filter((language) =>
        options.languages!.includes(language),
      )
    : metadataLanguages;
  if (
    languagesToUse.length === 0 ||
    (options.languages != null &&
      (options.languages.length !== languagesToUse.length ||
        languagesToUse
          .toSorted((a, b) => a.localeCompare(b, "en-US"))
          .every((language) =>
            options
              .languages!.toSorted((a, b) => a.localeCompare(b, "en-US"))
              .map((language) => language.toLocaleLowerCase("en-US"))
              .includes(language.toLocaleLowerCase("en-US")),
          )))
  ) {
    throw new Error(
      `The language(s) provided are not supported by the dataset: ${
        options.languages != null ?
          options.languages
            .toSorted((a, b) => a.localeCompare(b, "en-US"))
            .join(", ")
        : "(cannot parse input languages)"
      }`,
    );
  }

  const defaultLanguage = languagesToUse.find((language) =>
    language.includes(DEFAULT_LANGUAGE),
  );
  if (defaultLanguage == null) {
    throw new Error("Default language not found");
  }

  const returnData: Data<T, U, V> = {
    uuid: rawData.ochre.uuid,
    belongsTo: {
      uuid: rawData.ochre.uuidBelongsTo,
      abbreviation: rawData.ochre.belongsTo,
    },
    publicationDateTime: parseISO(rawData.ochre.publicationDateTime),
    metadata: {
      dataset: parseXMLText(rawData.ochre.metadata.dataset, {
        isRichText: false,
        parseEmail: false,
      }),
      description: parseXMLText(rawData.ochre.metadata.description, {
        isRichText: false,
        parseEmail: false,
      }),
      publisher: parseXMLText(rawData.ochre.metadata.publisher, {
        isRichText: false,
        parseEmail: false,
      }),
      identifier: parseXMLText(rawData.ochre.metadata.identifier, {
        isRichText: false,
        parseEmail: false,
      }),
      project:
        rawData.ochre.metadata.project == null ?
          null
        : {
            identification: parseIdentification(
              rawData.ochre.metadata.project.identification,
              {
                languages: languagesToUse,
                isRichText: options.isRichText ?? false,
              },
            ) as Identification<V>,
            website:
              rawData.ochre.metadata.project.identification.website == null ?
                null
              : parseXMLText(
                  rawData.ochre.metadata.project.identification.website,
                  { isRichText: false, parseEmail: false },
                ),
          },
      item:
        rawData.ochre.metadata.item == null ?
          null
        : {
            identification: parseIdentification(
              rawData.ochre.metadata.item.identification,
              {
                languages: languagesToUse,
                isRichText: options.isRichText ?? false,
              },
            ) as Identification<V>,
            category: rawData.ochre.metadata.item.category,
            type: rawData.ochre.metadata.item.type,
            maxLength:
              rawData.ochre.metadata.item.maxLength != null ?
                Number(rawData.ochre.metadata.item.maxLength)
              : null,
          },
      defaultLanguage: defaultLanguage as V extends undefined ? Readonly<string>
      : Readonly<NonNullable<V>[number]>,
      languages: languagesToUse as V extends undefined ? Array<string> : V,
    },
    items: [],
  };

  return returnData;
}
