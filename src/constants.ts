import type { X2jOptions } from "fast-xml-parser";

export const XML_ARRAY_TAGS: ReadonlyArray<string> = [
  "string",
  "content",
  "tree",
  "bibliography",
  "spatialUnit",
  "concept",
  "person",
  "period",
  "propertyValue",
  "propertyVariable",
  "resource",
  "text",
  "set",
  "dictionaryUnit",
  "variable",
  "property",
  "value",
  "context",
  "creator",
  "author",
  "event",
  "interpretation",
  "interpreter",
  "observation",
  "observer",
  "heading",
  "note",
  "reference",
  "coord",
  "area",
  "footnote",
  "language",
  "section",
  "translation",
  "phonemic",
  "editor",
  "publisher",
  "scope",
  "level",
  "style",
  "flattenContexts",
  "suppressContexts",
  "filterContexts",
  "sortContexts",
  "detailContexts",
  "downloadContexts",
  "labelContexts",
  "prominentContexts",
];

export const XML_PARSER_OPTIONS: X2jOptions = {
  alwaysCreateTextNode: true,
  captureMetaData: true,
  ignoreAttributes: false,
  removeNSPrefix: true,
  ignorePiTags: true,
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  attributeNamePrefix: "",
  textNodeName: "payload",
  stopNodes: ["*.referenceFormatDiv", "*.citationFormatSpan"],
  htmlEntities: true,
  isArray(tagName, _, __, isAttribute) {
    if (isAttribute) {
      return false;
    }

    return XML_ARRAY_TAGS.includes(tagName);
  },
  attributeValueProcessor: (_, attributeValue) => {
    if (attributeValue.startsWith("xs:")) {
      return attributeValue.replace("xs:", "");
    }

    return null;
  },
};

export const DEFAULT_LANGUAGES = ["eng"] as const;

/**
 * The default page size to use for fetching paginated items
 */
export const DEFAULT_PAGE_SIZE = 48;

export const OCHRE_ENDPOINT =
  "https://ochre.lib.uchicago.edu/ochre/v2/ochre.php";

export const PERMANENT_IDENTIFICATION_URL_PREFIX =
  "https://pi.lib.uchicago.edu/1001/org/ochre/";

/**
 * Build the URL of an OCHRE item document
 * @param uuid - The UUID of the OCHRE item
 * @param searchParameters - Extra query string parameters to append
 * @returns The item document URL
 * @internal
 */
export function getOchreItemUrl(
  uuid: string,
  searchParameters?: string,
): string {
  const suffix = searchParameters == null ? "" : `&${searchParameters}`;

  return `${OCHRE_ENDPOINT}?uuid=${uuid}${suffix}`;
}

export const BELONGS_TO_COLLECTION_UUID =
  "30054cb2-909a-4f34-8db9-8fe7369d691d";

export const PRESENTATION_ITEM_UUID = "f1c131b6-1498-48a4-95bf-a9edae9fd518";
export const TEXT_ANNOTATION_UUID = "b9ca2732-78f4-416e-b77f-dae7647e68a9";
export const TEXT_ANNOTATION_HOVER_CARD_UUID =
  "c7f6a08a-f07b-49b6-bcb1-af485da3c58f";
export const TEXT_ANNOTATION_ITEM_PAGE_VARIANT_UUID =
  "bf4476ab-6bc8-40d0-a001-1446213c72ce";
export const TEXT_ANNOTATION_ENTRY_PAGE_VARIANT_UUID =
  "9d52db95-a9cf-45f7-a0bf-fc9ba9f0aae0";
export const TEXT_ANNOTATION_TEXT_STYLING_UUID =
  "3e6f86ab-df81-45ae-8257-e2867357df56";
export const TEXT_ANNOTATION_TEXT_STYLING_VARIANT_UUID =
  "e1647bef-d801-4100-bdde-d081c422f763";
export const TEXT_ANNOTATION_TEXT_STYLING_HEADING_LEVEL_UUID =
  "d4266f0b-3f8d-4b32-8c15-4b229c8bb11e";
