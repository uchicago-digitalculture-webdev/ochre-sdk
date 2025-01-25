import type { Language } from "iso-639-3";

/**
 * Raw string value that can be a string, number, or boolean
 */
export type FakeString = string | number | boolean;

/**
 * Text rendering options for string content
 */
export type RenderOption = "bold" | "italic" | "underline";

/**
 * Whitespace handling options for string content
 */
export type WhitespaceOption = "newline" | "trailing" | "leading";

/**
 * Raw content item with rendering and whitespace options
 */
export type OchreStringItemContent = {
  rend?: string; // "bold" | "italic" | "underline" (space separated)
  whitespace?: string; // "newline" | "trailing" | "leading" (space separated)
  content: FakeString;
};

/**
 * Raw string item with language metadata
 */
export type OchreStringItem = {
  string: FakeString | OchreStringItemContent | Array<OchreStringItemContent>;
  lang?: Language["iso6393"]; // 3 character code (zxx = "a.k.a.")
  languages?: string; // 3 character codes, semicolon separated
};

/**
 * Container for raw string content
 */
export type OchreStringContent = {
  content: FakeString | OchreStringItem | Array<OchreStringItem>;
};

/**
 * Rich text content item with formatting and language metadata
 */
export type OchreStringRichTextItemContent = {
  content: FakeString;
  title?: FakeString;
  lang?: Language["iso6393"]; // 3 character code (zxx = "a.k.a.")
  whitespace?: string; // "newline" | "trailing" | "leading" (space separated)
  rend?: string; // "bold" | "italic" | "underline"  (space separated)
};

/**
 * Annotated rich text item with links
 */
export type OchreStringRichTextItemAnnotation = {
  annotation: string; // UUID
  string: FakeString;
  links: OchreLink | Array<OchreLink>;
};

/**
 * Union type for different rich text item formats
 */
export type OchreStringRichTextItem =
  | FakeString
  | OchreStringRichTextItemContent
  | {
      string:
        | OchreStringRichTextItemAnnotation
        | Array<OchreStringRichTextItemAnnotation>;
      whitespace?: string; // "newline" | "trailing" | "leading" (space separated)
    }
  | {
      whitespace: string; // "newline" | "trailing" | "leading" (space separated)
    }
  | OchreStringRichTextItemAnnotation;

/**
 * Container for rich text content with language metadata
 */
export type OchreStringRichText = {
  string: FakeString | OchreStringRichTextItem | Array<OchreStringRichTextItem>;
  title?: FakeString;
  lang?: Language["iso6393"]; // 3 character code (zxx = "a.k.a.")
};

/**
 * Raw data structure corresponding to the parsed Data type
 */
export type OchreData = {
  ochre: {
    uuid: string;
    uuidBelongsTo: string;
    belongsTo: FakeString;
    publicationDateTime: string; // YYYY-MM-DDThh:mm:ssZ
    metadata: OchreMetadata;
    languages?: string; // 3 character codes, semicolon separated
  } & (
    | { tree: OchreTree }
    | { set: OchreSet }
    | { resource: OchreResource }
    | { spatialUnit: OchreSpatialUnit }
    | { concept: OchreConcept }
    | { bibliography: OchreBibliography }
  );
};

/**
 * Raw metadata structure corresponding to the parsed Metadata type
 */
export type OchreMetadata = {
  identifier: OchreStringContent;
  item?: {
    label?: OchreStringContent; // Faulty, only exists in old items that have not been republished
    abbreviation?: OchreStringContent; // Faulty, only exists in old items that have not been republished
    identification: OchreIdentification;
    category: string;
    type: string;
    maxLength?: number;
  };
  publisher: OchreStringContent;
  dataset: OchreStringContent;
  project?: { identification: OchreIdentification };
  language: OchreLanguage | Array<OchreLanguage>;
  description: OchreStringContent;
};

/**
 * Raw tree structure corresponding to the parsed Tree type
 */
export type OchreTree = {
  uuid: string;
  publicationDateTime: string; // YYYY-MM-DDThh:mm:ssZ
  type: string;
  n: number;
  availability: OchreLicense;
  identification: OchreIdentification;
  date?: string; // YYYY-MM-DD
  creators?: { creator: OchrePerson | Array<OchrePerson> };
  items:
    | string
    | {
        resource: OchreResource | Array<OchreResource>;
      }
    | { spatialUnit: OchreSpatialUnit | Array<OchreSpatialUnit> }
    | { concept: OchreConcept | Array<OchreConcept> }
    | { period: OchrePeriod | Array<OchrePeriod> };
  properties?: { property: OchreProperty | Array<OchreProperty> };
};

/**
 * Raw set structure corresponding to the parsed Set type
 */
export type OchreSet = {
  uuid: string;
  publicationDateTime: string; // YYYY-MM-DDThh:mm:ssZ
  type: string;
  n: number;
  availability: OchreLicense;
  identification: OchreIdentification;
  date?: string; // YYYY-MM-DD
  suppressBlanks?: boolean;
  description?: OchreStringContent;
  creators?: { creator: OchrePerson | Array<OchrePerson> };
  items:
    | string
    | { resource: OchreResource | Array<OchreResource> }
    | { spatialUnit: OchreSpatialUnit | Array<OchreSpatialUnit> }
    | { concept: OchreConcept | Array<OchreConcept> }
    | { period: OchrePeriod | Array<OchrePeriod> };
};

/**
 * Raw resource structure corresponding to the parsed Resource type
 */
export type OchreResource = {
  uuid: string;
  publicationDateTime: string; // YYYY-MM-DDThh:mm:ssZ
  type: string;
  n: number;
  slug?: string;
  format?: string;
  context?: OchreContext;
  availability?: OchreLicense;
  copyright?: FakeString;
  identification: OchreIdentification;
  href?: string;
  description?: OchreStringContent;
  date?: string; // YYYY-MM-DD
  image?: OchreImage;
  creators?: { creator: OchrePerson | Array<OchrePerson> };
  notes?: { note: OchreNote | Array<OchreNote> };
  document?: {
    content: OchreStringRichText | Array<OchreStringRichText>;
  };
  imagemap?: OchreImageMap;
  periods?: { period: OchrePeriod | Array<OchrePeriod> };
  links?: OchreLink | Array<OchreLink>;
  reverseLinks?: OchreLink | Array<OchreLink>;
  properties?: { property: OchreProperty | Array<OchreProperty> };
  citedBibliography?: {
    reference: OchreBibliography | Array<OchreBibliography>;
  };
  resource?: OchreNestedResource | Array<OchreNestedResource>;
};

/**
 * Raw nested resource structure corresponding to the parsed NestedResource type
 */
export type OchreNestedResource = Omit<
  OchreResource,
  "context" | "availability" | "copyright"
>;

/**
 * Raw spatial unit structure corresponding to the parsed SpatialUnit type
 */
export type OchreSpatialUnit = {
  uuid: string;
  publicationDateTime?: string; // YYYY-MM-DDThh:mm:ssZ
  type: string;
  n: number;
  availability?: OchreLicense;
  context?: OchreContext;
  identification: OchreIdentification;
  image?: OchreImage;
  description?: OchreStringContent;
  coordinates?: OchreCoordinates;
  events?: { event: OchreEvent | Array<OchreEvent> };
  observations?: { observation: OchreObservation | Array<OchreObservation> };
  observation?: OchreObservation;
};

/**
 * Raw nested spatial unit structure corresponding to the parsed NestedSpatialUnit type
 */
export type OchreNestedSpatialUnit = Omit<
  OchreSpatialUnit,
  "context" | "availability" | "observations" | "events"
> & {
  properties?: { property: OchreProperty | Array<OchreProperty> };
};

/**
 * Raw concept structure corresponding to the parsed Concept type
 */
export type OchreConcept = {
  uuid: string;
  publicationDateTime: string; // YYYY-MM-DDThh:mm:ssZ
  n: number;
  availability?: OchreLicense;
  context?: OchreContext;
  identification: OchreIdentification;
  interpretations: {
    interpretation: OchreInterpretation | Array<OchreInterpretation>;
  };
};

/**
 * Raw nested concept structure corresponding to the parsed NestedConcept type
 */
export type OchreNestedConcept = Omit<OchreConcept, "context" | "availability">;

/**
 * Raw property value structure corresponding to the parsed PropertyValue type
 */
export type OchrePropertyValue = OchreStringContent & {
  uuid?: string;
  publicationDateTime?: string; // YYYY-MM-DDThh:mm:ssZ
  type: string;
  category?: string;
};

/**
 * Raw property structure corresponding to the parsed Property type
 */
export type OchreProperty = {
  label: OchreStringContent & { uuid: string };
  value?: OchrePropertyValue | Array<OchrePropertyValue>;
  comment?: FakeString;
  property?: OchreProperty | Array<OchreProperty>;
};

/**
 * Raw identification structure corresponding to the parsed Identification type
 */
export type OchreIdentification = {
  label: OchreStringContent;
  abbreviation?: OchreStringContent;
  MIMEType?: string;
  widthPreview?: number;
  heightPreview?: number;
  height?: number;
  width?: number;
  website?: string;
};

/**
 * Raw license structure corresponding to the parsed License type
 */
export type OchreLicense = {
  license: { content: string; target: string } | string;
};

/**
 * Raw language structure for specifying content languages
 */
export type OchreLanguage = {
  default?: boolean;
  content: string; // 3 character code
};

/**
 * Raw link item structure for various linked content types
 */
export type OchreLinkItem = {
  uuid: string;
  publicationDateTime?: string; // YYYY-MM-DDThh:mm:ssZ
  type?: string;
  identification?: OchreIdentification;
  rend?: "inline";
  content?: FakeString;
  heightPreview?: number;
  widthPreview?: number;
  height?: number;
  width?: number;
};

/**
 * Raw link structure corresponding to the parsed Link type
 */
export type OchreLink =
  | { resource: OchreLinkItem | Array<OchreLinkItem> }
  | { concept: OchreLinkItem | Array<OchreLinkItem> }
  | { set: OchreLinkItem | Array<OchreLinkItem> }
  | { tree: OchreLinkItem | Array<OchreLinkItem> }
  | { person: OchreLinkItem | Array<OchreLinkItem> }
  | { epigraphicUnit: OchreLinkItem | Array<OchreLinkItem> }
  | { bibliography: OchreBibliography | Array<OchreBibliography> };

/**
 * Raw image structure corresponding to the parsed Image type
 */
export type OchreImage = {
  publicationDateTime?: string; // YYYY-MM-DDThh:mm:ssZ
  identification?: OchreIdentification;
  href?: string;
  htmlImgSrcPrefix?: string;
  content?: FakeString;
};

/**
 * Raw bibliography structure corresponding to the parsed Bibliography type
 */
export type OchreBibliography = {
  uuid: string;
  publicationDateTime?: string; // YYYY-MM-DDThh:mm:ssZ
  type?: string;
  n?: number;
  identification?: OchreIdentification;
  project?: { identification: OchreIdentification };
  context?: OchreContext;
  sourceDocument?: {
    uuid: string;
    content: FakeString;
  };
  publicationInfo?: {
    publishers?: { publishers: { person: OchrePerson | Array<OchrePerson> } };
    startDate?: {
      month: number;
      year: number;
      day: number;
    };
  };
  entryInfo?: {
    startIssue: FakeString;
    startVolume: FakeString;
  };
  citationFormat?: string;
  citationFormatSpan?:
    | {
        span: {
          content: FakeString;
        };
      }
    | {
        "default:span": {
          content: FakeString;
        };
      };
  referenceFormatDiv?:
    | {
        div: {
          div: {
            class: string;
            content: FakeString;
          };
          style: string;
          class: string;
        };
      }
    | {
        "default:div": {
          "default:div": {
            class: string;
            content: FakeString;
          };
          style: string;
          class: string;
        };
      };
  source?: {
    resource: Pick<
      OchreResource,
      "uuid" | "type" | "publicationDateTime" | "identification"
    >;
  };
  authors?: { person: OchrePerson | Array<OchrePerson> };
  properties?: { property: OchreProperty | Array<OchreProperty> };
};

/**
 * Raw note structure corresponding to the parsed Note type
 */
export type OchreNote =
  | string
  | {
      noteNo: number;
      content: OchreStringRichText | Array<OchreStringRichText>;
    };

/**
 * Raw period structure corresponding to the parsed Period type
 */
export type OchrePeriod = {
  uuid: string;
  publicationDateTime?: string; // YYYY-MM-DDThh:mm:ssZ
  type?: string;
  n?: number;
  identification: OchreIdentification;
  description?: OchreStringContent;
};

/**
 * Raw image map area structure corresponding to the parsed ImageMapArea type
 */
export type OchreImageMapArea = {
  uuid: string;
  publicationDateTime?: string; // YYYY-MM-DDThh:mm:ssZ
  type: string;
  title: FakeString;
  shape: "rect" | "poly";
  coords: string; // comma separated list of numbers
};

/**
 * Raw image map structure corresponding to the parsed ImageMap type
 */
export type OchreImageMap = {
  area: OchreImageMapArea | Array<OchreImageMapArea>;
  width: number;
  height: number;
};

/**
 * Raw context structure corresponding to the parsed Context type
 */
export type OchreContext = {
  context: OchreContextValue | Array<OchreContextValue>;
  displayPath: string;
};

/**
 * Raw context value structure containing tree, project and spatial unit information
 */
export type OchreContextValue = {
  tree: OchreContextItem;
  project: OchreContextItem;
  spatialUnit?: OchreContextItem | Array<OchreContextItem>;
  displayPath: string;
};

/**
 * Raw context item structure corresponding to the parsed ContextItem type
 */
export type OchreContextItem = {
  uuid: string;
  publicationDateTime?: string; // YYYY-MM-DDThh:mm:ssZ
  n: number; // negative number
  content: FakeString;
};

/**
 * Raw person structure corresponding to the parsed Person type
 */
export type OchrePerson = {
  uuid: string;
  publicationDateTime?: string; // YYYY-MM-DDThh:mm:ssZ
  type?: string;
  date?: string; // YYYY-MM-DD
  identification?: OchreIdentification;
  content?: FakeString | null;
};

/**
 * Raw observation structure corresponding to the parsed Observation type
 */
export type OchreObservation = {
  observationNo: number;
  date?: string; // YYYY-MM-DD
  observers?: FakeString;
  notes?: { note: OchreNote | Array<OchreNote> };
  links?: OchreLink | Array<OchreLink>;
  properties?: { property: OchreProperty | Array<OchreProperty> };
};

/**
 * Raw coordinates structure corresponding to the parsed Coordinates type
 */
export type OchreCoordinates = {
  latitude: number;
  longitude: number;
  coordinatesArray?: string;
  coord?: {
    coordLatitude: number;
    coordLongitude: number;
    coordType: string;
    coordLabel: FakeString;
    arrayString: string;
    uuid: string;
  };
};

/**
 * Raw event structure corresponding to the parsed Event type
 */
export type OchreEvent = {
  dateTime?: string; // YYYY-MM-DD
  agent?: {
    uuid: string;
    content: FakeString;
  };
  label: OchreStringContent;
};

/**
 * Raw interpretation structure corresponding to the parsed Interpretation type
 */
export type OchreInterpretation = {
  date: string; // YYYY-MM-DD
  interpretationNo: number;
  properties?: { property: OchreProperty | Array<OchreProperty> };
};
