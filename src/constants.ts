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
  "set",
  "property",
  "value",
  "context",
  "creator",
  "author",
  "event",
  "interpretation",
  "observation",
  "observers",
  "heading",
  "note",
  "reference",
  "coord",
  "area",
  "footnote",
  "language",
];

export const XML_PARSER_OPTIONS: X2jOptions = {
  alwaysCreateTextNode: true,
  ignoreAttributes: false,
  removeNSPrefix: true,
  ignorePiTags: true,
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  attributeNamePrefix: "",
  textNodeName: "text",
  stopNodes: ["*.referenceFormatDiv", "*.citationFormatSpan"],
  htmlEntities: true,
  isArray(tagName, jPath, isLeafNode, isAttribute) {
    if (isAttribute) {
      return false;
    }

    if (XML_ARRAY_TAGS.includes(tagName)) {
      return true;
    }

    return false;
  },
  attributeValueProcessor: (attrName, attrValue) => {
    if (attrValue.startsWith("xs:")) {
      return attrValue.replace("xs:", "");
    }

    return null;
  },
};

export const DEFAULT_LANGUAGES: ReadonlyArray<string> = ["eng"];

export const PRESENTATION_ITEM_UUID = "f1c131b6-1498-48a4-95bf-a9edae9fd518";
export const WEBSITE_UUID = "0e500a69-13c3-44e8-82ac-806fbdeaddfd";
export const WEBPAGE_UUID = "a6a82c55-44da-469c-a205-de2276a8e3d2";
export const WEB_BLOCK_UUID = "43861c62-4c0f-4861-8bb5-9cba87055062";
export const WEB_ELEMENT_UUID = "45e7e18c-b1d7-4cba-9503-ca419c62e6ec";
export const COMPONENT_UUID = "d68be7c7-da77-4515-b3e3-9f0f095df52f";
export const CSS_STYLE_UUID = "82e502c1-6631-4b46-b4c4-c49519451030";
export const MOBILE_CSS_STYLE_UUID = "dad47330-c02c-4744-80b6-4a77f19014b7";
export const TITLE_UUID = "52d199a0-26d9-42b2-93df-0153210d7d3e";
export const CITATION_UUID = "b9ca2732-78f4-416e-b77f-dae7647e68a9";
