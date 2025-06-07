import type {
  Data,
  DataCategory,
  Identification,
  ItemsDataCategory,
  MultilingualText,
} from "../types/index.js";
import type { XMLData, XMLIdentification } from "../types/xml/types.js";
import { parseISO } from "date-fns";
import { parseXMLContent, parseXMLText } from "./string.js";

/**
 * Parses the data from the XML data
 * @param rawData - The raw XML data
 * @returns The parsed data
 *
 * @internal
 */
export function parseData<
  T extends DataCategory,
  U extends T extends "tree" | "set" ? ItemsDataCategory : never = never,
>(rawData: XMLData): Data<T, U> {
  const languages = rawData.ochre.metadata.language?.map((language) => ({
    name: parseXMLText(language),
    isDefault: language.default === "true",
  })) ?? [{ name: "en", isDefault: true }];

  const returnData: Data<T, U> = {
    uuid: rawData.ochre.uuid,
    belongsTo: {
      uuid: rawData.ochre.uuidBelongsTo,
      abbreviation: rawData.ochre.belongsTo,
    },
    publicationDateTime: parseISO(rawData.ochre.publicationDateTime),
    metadata: {
      dataset: parseXMLText(rawData.ochre.metadata.dataset),
      description: parseXMLText(rawData.ochre.metadata.description),
      publisher: parseXMLText(rawData.ochre.metadata.publisher),
      identifier: parseXMLText(rawData.ochre.metadata.identifier),
      project:
        rawData.ochre.metadata.project == null ?
          null
        : {
            identification: parseIdentification(
              rawData.ochre.metadata.project.identification,
              languages,
            ),
            website:
              rawData.ochre.metadata.project.identification.website == null ?
                null
              : parseXMLText(
                  rawData.ochre.metadata.project.identification.website,
                ),
          },
      item:
        rawData.ochre.metadata.item == null ?
          null
        : {
            identification: parseIdentification(
              rawData.ochre.metadata.item.identification,
              languages,
            ),
            category: rawData.ochre.metadata.item.category,
            type: rawData.ochre.metadata.item.type,
            maxLength:
              rawData.ochre.metadata.item.maxLength != null ?
                Number(rawData.ochre.metadata.item.maxLength)
              : null,
          },
      languages,
    },
    items: [],
  };

  return returnData;
}

// export function parseItem<T extends DataCategory>(
//   rawItem: XMLDataItem,
// ): Item<T> {
//   return rawItem;
// }

/**
 * Parses the identification of an item or project
 * @param rawIdentification - The raw identification from the XML data
 * @param languages - The languages of the item or project
 * @returns The parsed identification
 *
 * @internal
 */
function parseIdentification(
  rawIdentification: XMLIdentification,
  languages: Array<{ name: string; isDefault: boolean }>,
): Identification {
  const label: MultilingualText = {};
  const abbreviation: MultilingualText | null =
    rawIdentification.abbreviation == null ? null : {};

  for (const language of languages) {
    label[language.name] =
      "content" in rawIdentification.label ?
        parseXMLContent(rawIdentification.label, {
          language: language.name,
          isRichText: false,
        })
      : parseXMLText(rawIdentification.label);

    if (rawIdentification.abbreviation != null) {
      abbreviation![language.name] =
        "content" in rawIdentification.abbreviation! ?
          parseXMLContent(rawIdentification.abbreviation, {
            language: language.name,
            isRichText: false,
          })
        : parseXMLText(rawIdentification.abbreviation!);
    }
  }

  return { label, abbreviation };
}
