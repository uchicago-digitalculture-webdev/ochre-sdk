import type {
  Data,
  DataCategory,
  Identification,
  ItemsDataCategory,
} from "../types/index.js";
import type { XMLData, XMLIdentification } from "../types/xml/types.js";
import { parseISO } from "date-fns";
import { parseXMLContent, parseXMLText } from "./string.js";

export function parseData<
  T extends DataCategory,
  U extends T extends "tree" | "set" ? ItemsDataCategory : never = never,
>(rawData: XMLData): Data<T, U> {
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
            ),
            category: rawData.ochre.metadata.item.category,
            type: rawData.ochre.metadata.item.type,
            maxLength:
              rawData.ochre.metadata.item.maxLength != null ?
                Number(rawData.ochre.metadata.item.maxLength)
              : null,
          },
      languages:
        rawData.ochre.metadata.language?.map((language) => ({
          name: parseXMLText(language),
          isDefault: language.default === "true",
        })) ?? [],
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

function parseIdentification(
  rawIdentification: XMLIdentification,
): Identification {
  return {
    label:
      "content" in rawIdentification.label ?
        parseXMLContent(rawIdentification.label, {
          language: "en",
          isRichText: false,
        })
      : parseXMLText(rawIdentification.label),
    abbreviation:
      rawIdentification.abbreviation == null ? null
      : "content" in rawIdentification.abbreviation ?
        parseXMLContent(rawIdentification.abbreviation, {
          language: "en",
          isRichText: false,
        })
      : parseXMLText(rawIdentification.abbreviation),
  };
}
