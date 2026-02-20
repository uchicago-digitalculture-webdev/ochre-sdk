/**
 * Raw string value that can be a string, number, or boolean
 */
export type RawFakeString = string | number | boolean;

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
export type RawStringItemContent = {
  rend?: string; // "bold" | "italic" | "underline" (space separated)
  whitespace?: string; // "newline" | "trailing" | "leading" (space separated)
  content?: RawFakeString;
};

/**
 * Raw string item with language metadata
 */
export type RawStringItem = {
  string:
    | RawFakeString
    | RawStringItem
    | RawStringItemContent
    | Array<RawFakeString | RawStringItemContent>;
  lang?: string; // ISO 639-3 3 character code (zxx = "a.k.a.")
  languages?: string; // ISO 639-3 3 character codes, semicolon separated
};

/**
 * Container for raw string content
 */
export type RawStringContent = {
  content: RawFakeString | RawStringItem | Array<RawStringItem>;
  rend?: string; // "bold" | "italic" | "underline" (space separated)
};

/**
 * Rich text content item with formatting and language metadata
 */
export type RawStringRichTextItemContent = {
  content: RawFakeString;
  title?: RawFakeString;
  lang?: string; // ISO 639-3 3 character code (zxx = "a.k.a.")
  whitespace?: string; // "newline" | "trailing" | "leading" (space separated)
  rend?: string; // "bold" | "italic" | "underline"  (space separated)
};

/**
 * Annotated rich text item with links
 */
export type RawStringRichTextItemAnnotation = {
  annotation: string; // UUID
  string: RawFakeString | RawStringRichTextItemContent;
  links: RawLink | Array<RawLink>;
  properties?: { property: RawProperty | Array<RawProperty> };
};

/**
 * Union type for different rich text item formats
 */
export type RawStringRichTextItem =
  | RawFakeString
  | RawStringRichTextItemContent
  | {
      string:
        | RawStringRichTextItemAnnotation
        | Array<RawStringRichTextItemAnnotation>;
      whitespace?: string; // "newline" | "trailing" | "leading" (space separated)
    }
  | {
      whitespace: string; // "newline" | "trailing" | "leading" (space separated)
    }
  | RawStringRichTextItemAnnotation;

/**
 * Container for rich text content with language metadata
 */
export type RawStringRichText = {
  string: RawFakeString | RawStringRichTextItem | Array<RawStringRichTextItem>;
  title?: RawFakeString;
  lang?: string; // ISO 639-3 3 character code (zxx = "a.k.a.")
};

/**
 * Raw data structure corresponding to the parsed Data type
 */
export type RawData = {
  ochre: {
    uuid: string;
    uuidBelongsTo: string;
    belongsTo: RawFakeString;
    publicationDateTime: string; // YYYY-MM-DDThh:mm:ssZ
    metadata: RawMetadata;
    persistentUrl?: string;
    languages?: string; // ISO 639-3 3 character codes, semicolon separated
  } & (
    | { resource: RawResource }
    | { spatialUnit: RawSpatialUnit }
    | { concept: RawConcept }
    | { period: RawPeriod }
    | { bibliography: RawBibliography }
    | { person: RawPerson }
    | { propertyVariable: RawPropertyVariable }
    | { propertyValue: RawPropertyValue }
    | { text: RawText }
    | { tree: RawTree }
    | { set: RawSet }
  );
};

/**
 * Raw data response structure from the OCHRE API
 */
export type RawDataResponse = RawData | { result: RawData } | { result: [] };

/**
 * Raw metadata structure corresponding to the parsed Metadata type
 */
export type RawMetadata = {
  identifier: RawStringContent | RawFakeString;
  item?: {
    label?: RawStringContent; // Faulty, only exists in old items that have not been republished
    abbreviation?: RawStringContent; // Faulty, only exists in old items that have not been republished
    identification: RawIdentification;
    category: string;
    type: string;
    maxLength?: number;
  };
  publisher: RawStringContent | RawFakeString;
  dataset: RawStringContent | RawFakeString;
  project?: {
    uuid: string;
    identification: RawIdentification;
    dateFormat?: string;
    page?: "item" | "entry";
  };
  collection?: {
    uuid: string;
    identification: RawIdentification;
    page: "item" | "entry";
  };
  publication?: {
    uuid: string;
    identification: RawIdentification;
    page: "item" | "entry";
  };
  language?: string | RawLanguage | Array<string | RawLanguage>;
  description: RawStringContent | RawFakeString;
};

type RawTreeSearchOptionUuid = {
  type: string;
  content: string; // UUID
};

type RawTreeSearchOptionScope = {
  uuid: RawTreeSearchOptionUuid;
  identification: RawIdentification;
};

export type RawLevelContextItemContent =
  | string
  | {
      dataType: string;
      content: string; // "variableUuid, valueUuid|null"
    };

export type RawLevelContextItem = {
  identification: RawIdentification;
  levels: {
    level: RawLevelContextItemContent | Array<RawLevelContextItemContent>;
  };
};

/**
 * Flattening context structure for website-wide item properties
 */
export type RawLevelContext = {
  context: RawLevelContextItem | Array<RawLevelContextItem>;
};

/**
 * Raw tree structure corresponding to the parsed Tree type
 */
export type RawTree = {
  uuid: string;
  publicationDateTime: string; // YYYY-MM-DDThh:mm:ssZ
  type: string;
  n: number;
  availability: RawLicense;
  identification: RawIdentification;
  date?: string; // YYYY-MM-DD
  creators?: { creator: RawPerson | Array<RawPerson> };
  options?: {
    notes?: { note: RawNote | Array<RawNote> };
    scopes?: {
      scope: RawTreeSearchOptionScope | Array<RawTreeSearchOptionScope>;
    };
    flattenContexts?: RawLevelContext | Array<RawLevelContext>;
    suppressContexts?: RawLevelContext | Array<RawLevelContext>;
    filterContexts?: RawLevelContext | Array<RawLevelContext>;
    sortContexts?: RawLevelContext | Array<RawLevelContext>;
    detailContexts?: RawLevelContext | Array<RawLevelContext>;
    downloadContexts?: RawLevelContext | Array<RawLevelContext>;
    labelContexts?: RawLevelContext | Array<RawLevelContext>;
    prominentContexts?: RawLevelContext | Array<RawLevelContext>;
  };
  items:
    | string
    | { resource: RawResource | Array<RawResource> }
    | { spatialUnit: RawSpatialUnit | Array<RawSpatialUnit> }
    | { concept: RawConcept | Array<RawConcept> }
    | { period: RawPeriod | Array<RawPeriod> }
    | { bibliography: RawBibliography | Array<RawBibliography> }
    | { person: RawPerson | Array<RawPerson> }
    | { propertyVariable: RawPropertyVariable | Array<RawPropertyVariable> }
    | { propertyValue: RawPropertyValue | Array<RawPropertyValue> }
    | { text: RawText | Array<RawText> }
    | { set: RawSet | Array<RawSet> };
  properties?: { property: RawProperty | Array<RawProperty> };
};

/**
 * Raw set structure corresponding to the parsed Set type
 */
export type RawSet = {
  uuid: string;
  publicationDateTime: string; // YYYY-MM-DDThh:mm:ssZ
  type: string;
  n: number;
  availability: RawLicense;
  identification: RawIdentification;
  date?: string; // YYYY-MM-DD
  suppressBlanks?: boolean;
  description?: RawStringContent | RawFakeString;
  creators?: { creator: RawPerson | Array<RawPerson> };
  items:
    | string
    | {
        resource?: RawResource | Array<RawResource>;
        spatialUnit?: RawSpatialUnit | Array<RawSpatialUnit>;
        concept?: RawConcept | Array<RawConcept>;
        period?: RawPeriod | Array<RawPeriod>;
        bibliography?: RawBibliography | Array<RawBibliography>;
        person?: RawPerson | Array<RawPerson>;
        propertyVariable?: RawPropertyVariable | Array<RawPropertyVariable>;
        propertyValue?: RawPropertyValue | Array<RawPropertyValue>;
        text?: RawText | Array<RawText>;
      };
};

/**
 * Raw resource structure corresponding to the parsed Resource type
 */
export type RawResource = {
  uuid: string;
  publicationDateTime: string; // YYYY-MM-DDThh:mm:ssZ
  type: string;
  n: number;
  slug?: string;
  context?: RawContext;
  availability?: RawLicense;
  copyright?: RawStringContent;
  watermark?: RawStringContent;
  identification: RawIdentification;
  href?: string;
  description?: RawStringContent | RawFakeString;
  coordinates?: RawCoordinates;
  date?: string; // YYYY-MM-DD
  image?: RawImage;
  creators?: { creator: RawPerson | Array<RawPerson> };
  notes?: { note: RawNote | Array<RawNote> };
  document?: { content: RawStringRichText | Array<RawStringRichText> } | object;
  fileFormat?: string;
  fileSize?: number;
  imagemap?: RawImageMap;
  periods?: { period: RawPeriod | Array<RawPeriod> };
  links?: RawLink | Array<RawLink>;
  reverseLinks?: RawLink | Array<RawLink>;
  properties?: { property: RawProperty | Array<RawProperty> };
  bibliographies?: { bibliography: RawBibliography | Array<RawBibliography> };
  resource?: RawResource | Array<RawResource>;
  options?: {
    notes?: { note: RawNote | Array<RawNote> };
    filterBibliography?: boolean;
    filterPeriods?: boolean;
    scopes?: {
      scope: RawTreeSearchOptionScope | Array<RawTreeSearchOptionScope>;
    };
    flattenContexts?: RawLevelContext | Array<RawLevelContext>;
    suppressContexts?: RawLevelContext | Array<RawLevelContext>;
    filterContexts?: RawLevelContext | Array<RawLevelContext>;
    sortContexts?: RawLevelContext | Array<RawLevelContext>;
    detailContexts?: RawLevelContext | Array<RawLevelContext>;
    downloadContexts?: RawLevelContext | Array<RawLevelContext>;
    labelContexts?: RawLevelContext | Array<RawLevelContext>;
    prominentContexts?: RawLevelContext | Array<RawLevelContext>;
  };
};

/**
 * Raw spatial unit structure corresponding to the parsed SpatialUnit type
 */
export type RawSpatialUnit = {
  uuid: string;
  publicationDateTime?: string; // YYYY-MM-DDThh:mm:ssZ
  n: number;
  availability?: RawLicense;
  context?: RawContext;
  identification: RawIdentification;
  image?: RawImage;
  description?: RawStringContent | RawFakeString;
  coordinates?: RawCoordinates;
  mapData?: { geoJSON: { multiPolygon: string; EPSG: number } };
  events?: { event: RawEvent | Array<RawEvent> };
  observations?: { observation: RawObservation | Array<RawObservation> };
  observation?: RawObservation;
  properties?: { property: RawProperty | Array<RawProperty> };
  bibliographies?: { bibliography: RawBibliography | Array<RawBibliography> };
};

/**
 * Raw concept structure corresponding to the parsed Concept type
 */
export type RawConcept = {
  uuid: string;
  publicationDateTime: string; // YYYY-MM-DDThh:mm:ssZ
  n: number;
  availability?: RawLicense;
  context?: RawContext;
  identification: RawIdentification;
  status?: "live" | "pending";
  image?: RawImage;
  description?: RawStringContent | RawFakeString;
  coordinates?: RawCoordinates;
  interpretations?: {
    interpretation: RawInterpretation | Array<RawInterpretation>;
  };
  properties?: { property: RawProperty | Array<RawProperty> };
  bibliographies?: { bibliography: RawBibliography | Array<RawBibliography> };
};

/**
 * Raw property value structure corresponding to the parsed PropertyValue type
 */
export type RawPropertyValueContent = {
  i?: number;
  inherited?: boolean;
  uuid?: string;
  publicationDateTime?: string; // YYYY-MM-DDThh:mm:ssZ
  dataType?: string;
  category?: string;
  type?: string;
  slug?: string;
  unit?: string;
  height?: number;
  width?: number;
  fileSize?: number;
  isUncertain?: boolean;
  href?: string;
  rawValue?: RawFakeString;
  content?: RawFakeString | RawStringItem | Array<RawStringItem>;
};

/**
 * Raw property structure corresponding to the parsed Property type
 */
export type RawProperty = {
  label: RawStringContent & { uuid: string };
  value?:
    | RawPropertyValueContent
    | Array<RawPropertyValueContent>
    | RawFakeString;
  comment?: RawStringContent;
  property?: RawProperty | Array<RawProperty>;
};

/**
 * Raw identification structure corresponding to the parsed Identification type
 */
export type RawIdentification = {
  label: RawStringContent | RawFakeString;
  abbreviation?: RawStringContent | RawFakeString;
  code?: string;
  MIMEType?: string;
  widthPreview?: number;
  heightPreview?: number;
  height?: number;
  width?: number;
  email?: RawFakeString;
  website?: string;
};

/**
 * Raw license structure corresponding to the parsed License type
 */
export type RawLicense = {
  license: { content: string; target: string } | string;
};

/**
 * Raw language structure for specifying content languages
 */
export type RawLanguage = {
  default?: boolean;
  content: string; // 3 character code
};

/**
 * Raw link item structure for various linked content types
 */
export type RawLinkItem = {
  uuid: string;
  publicationDateTime?: string; // YYYY-MM-DDThh:mm:ssZ
  type?: string;
  identification?: RawIdentification;
  description?: RawStringContent;
  rend?: "inline";
  content?: RawFakeString;
  heightPreview?: number;
  widthPreview?: number;
  height?: number;
  width?: number;
  href?: string;
  slug?: string;
  fileFormat?: string;
  fileSize?: number;
  isPrimary?: boolean;
};

/**
 * Raw link structure corresponding to the parsed Link type
 */
export type RawLink = {
  resource?: RawLinkItem | Array<RawLinkItem>;
  spatialUnit?: RawLinkItem | Array<RawLinkItem>;
  concept?: RawLinkItem | Array<RawLinkItem>;
  person?: RawLinkItem | Array<RawLinkItem>;
  bibliography?: RawBibliography | Array<RawBibliography>;
  propertyVariable?: RawLinkItem | Array<RawLinkItem>;
  propertyValue?: RawLinkItem | Array<RawLinkItem>;
  text?: RawLinkItem | Array<RawLinkItem>;
  tree?: RawLinkItem | Array<RawLinkItem>;
  set?: RawLinkItem | Array<RawLinkItem>;
};

/**
 * Raw image structure corresponding to the parsed Image type
 */
export type RawImage = {
  publicationDateTime?: string; // YYYY-MM-DDThh:mm:ssZ
  identification?: RawIdentification;
  href?: string;
  htmlImgSrcPrefix?: string;
  content?: RawFakeString;
  widthPreview?: number;
  heightPreview?: number;
  width?: number;
  height?: number;
};

/**
 * Raw bibliography structure corresponding to the parsed Bibliography type
 */
export type RawBibliography = {
  uuid?: string;
  zoteroId?: string;
  publicationDateTime?: string; // YYYY-MM-DDThh:mm:ssZ
  type?: string;
  n?: number;
  identification?: RawIdentification;
  project?: { identification: RawIdentification };
  context?: RawContext;
  image?: RawImage;
  publicationInfo?: {
    publishers?: { publishers: { person: RawPerson | Array<RawPerson> } };
    startDate?: { month: number; year: number; day: number };
  };
  entryInfo?: { startIssue: RawFakeString; startVolume: RawFakeString };
  citationDetails?: string;
  citationFormat?: string;
  citationFormatSpan?: string;
  referenceFormatDiv?: string;
  source?: {
    resource:
      | Pick<
          RawResource,
          "uuid" | "type" | "publicationDateTime" | "identification" | "href"
        >
      | Array<
          Pick<
            RawResource,
            "uuid" | "type" | "publicationDateTime" | "identification" | "href"
          >
        >;
  };
  periods?: { period: RawPeriod | Array<RawPeriod> };
  authors?: { person: RawPerson | Array<RawPerson> };
  links?: RawLink | Array<RawLink>;
  reverseLinks?: RawLink | Array<RawLink>;
  properties?: { property: RawProperty | Array<RawProperty> };
};

/**
 * Raw note structure corresponding to the parsed Note type
 */
export type RawNote =
  | string
  | {
      noteNo: number;
      date?: string; // YYYY-MM-DD
      authors?: { author: RawPerson | Array<RawPerson> };
      content?: RawStringRichText | Array<RawStringRichText>;
    };

/**
 * Raw period structure corresponding to the parsed Period type
 */
export type RawPeriod = {
  uuid: string;
  publicationDateTime?: string; // YYYY-MM-DDThh:mm:ssZ
  type?: string;
  n?: number;
  identification: RawIdentification;
  description?: RawStringContent;
  coordinates?: RawCoordinates;
};

/**
 * Raw image map area structure corresponding to the parsed ImageMapArea type
 */
export type RawImageMapArea = {
  uuid: string;
  publicationDateTime?: string; // YYYY-MM-DDThh:mm:ssZ
  type: string;
  title: RawFakeString;
  shape: "rect" | "circle" | "poly";
  coords: string; // comma separated list of numbers
  slug?: RawFakeString;
};

/**
 * Raw image map structure corresponding to the parsed ImageMap type
 */
export type RawImageMap = {
  area: RawImageMapArea | Array<RawImageMapArea>;
  width: number;
  height: number;
};

/**
 * Raw context structure corresponding to the parsed Context type
 */
export type RawContext = {
  context: RawContextValue | Array<RawContextValue>;
  displayPath: string;
};

/**
 * Raw context value structure containing tree, project and spatial unit information
 */
export type RawContextValue = {
  tree: RawContextItem;
  project: RawContextItem;
  spatialUnit?: RawContextItem | Array<RawContextItem>;
  displayPath: string;
};

/**
 * Raw context item structure corresponding to the parsed ContextItem type
 */
export type RawContextItem = {
  uuid: string;
  publicationDateTime?: string; // YYYY-MM-DDThh:mm:ssZ
  n: number; // negative number
  content: RawFakeString;
};

/**
 * Raw person structure corresponding to the parsed Person type
 */
export type RawPerson = {
  uuid: string;
  publicationDateTime?: string; // YYYY-MM-DDThh:mm:ssZ
  type?: string;
  date?: string; // YYYY-MM-DD
  identification?: RawIdentification;
  n?: number;
  context?: RawContext;
  availability?: RawLicense;
  image?: RawImage;
  address?: { country?: string; city?: string; state?: string };
  description?: RawStringContent | RawFakeString;
  coordinates?: RawCoordinates;
  content?: RawFakeString | null;
  notes?: { note: RawNote | Array<RawNote> };
  links?: RawLink | Array<RawLink>;
  events?: { event: RawEvent | Array<RawEvent> };
  properties?: { property: RawProperty | Array<RawProperty> };
  bibliographies?: { bibliography: RawBibliography | Array<RawBibliography> };
};

/**
 * Raw observation structure corresponding to the parsed Observation type
 */
export type RawObservation = {
  observationNo: number;
  date?: string; // YYYY-MM-DD
  observers?: RawPerson | Array<RawPerson>;
  notes?: { note: RawNote | Array<RawNote> };
  links?: RawLink | Array<RawLink>;
  properties?: { property: RawProperty | Array<RawProperty> };
  bibliographies?: { bibliography: RawBibliography | Array<RawBibliography> };
};

/**
 * Raw coordinates item structure corresponding to the parsed CoordinatesItem type
 */
export type RawCoordinatesItem =
  | {
      type: "point";
      source?:
        | { context: "self"; label: RawStringContent & { uuid: string } }
        | {
            context: "related";
            label: RawStringContent & { uuid: string };
            value: RawStringContent & { uuid: string };
          }
        | {
            context: "inherited";
            item: { label: RawStringContent & { uuid: string } };
            label: RawStringContent & { uuid: string };
          };
      latitude: number;
      longitude: number;
      altitude?: number;
    }
  | {
      type: "plane";
      source?:
        | { context: "self"; label: RawStringContent & { uuid: string } }
        | {
            context: "related";
            label: RawStringContent & { uuid: string };
            value: RawStringContent & { uuid: string };
          }
        | {
            context: "inherited";
            item: { label: RawStringContent & { uuid: string } };
            label: RawStringContent & { uuid: string };
          };
      minimum: { latitude: number; longitude: number };
      maximum: { latitude: number; longitude: number };
    };

/**
 * Raw coordinates structure corresponding to the parsed coordinate array type
 */
export type RawCoordinates = {
  coord: RawCoordinatesItem | Array<RawCoordinatesItem>;
};

/**
 * Raw event structure corresponding to the parsed Event type
 */
export type RawEvent = {
  dateTime?: string;
  endDateTime?: string;
  agent?: { uuid: string; publicationDateTime?: string } & RawStringContent;
  location?: { uuid: string; publicationDateTime?: string } & RawStringContent;
  comment?: RawStringContent;
  label: RawStringContent;
  value?: RawFakeString;
  other?: { uuid?: string; category?: string } & RawStringContent;
};

/**
 * Raw interpretation structure corresponding to the parsed Interpretation type
 */
export type RawInterpretation = {
  interpretationNo: number;
  date?: string; // YYYY-MM-DD
  links?: RawLink | Array<RawLink>;
  properties?: { property: RawProperty | Array<RawProperty> };
  bibliographies?: { bibliography: RawBibliography | Array<RawBibliography> };
};

export type RawPropertyVariable = {
  uuid: string;
  publicationDateTime?: string; // YYYY-MM-DDThh:mm:ssZ
  type: string;
  n: number;
  context?: RawContext;
  availability?: RawLicense;
  identification: RawIdentification;
};

/**
 * Raw property value structure corresponding to the parsed PropertyValue type
 */
export type RawPropertyValue = {
  uuid: string;
  publicationDateTime?: string; // YYYY-MM-DDThh:mm:ssZ
  n: number;
  context?: RawContext;
  availability?: RawLicense;
  identification: RawIdentification;
  date?: string; // YYYY-MM-DD
  creators?: { creator: RawPerson | Array<RawPerson> };
  description?: RawStringContent | RawFakeString;
  coordinates?: RawCoordinates;
  notes?: { note: RawNote | Array<RawNote> };
  links?: RawLink | Array<RawLink>;
};

/**
 * Raw text structure corresponding to the parsed Text type
 */
export type RawText = {
  uuid: string;
  publicationDateTime?: string; // YYYY-MM-DDThh:mm:ssZ
  type?: string;
  language?: string;
  n?: number;
  context?: RawContext;
  availability?: RawLicense;
  copyright?: RawStringContent;
  watermark?: RawStringContent;
  identification: RawIdentification;
  description?: RawStringContent | RawFakeString;
  image?: RawImage;
  coordinates?: RawCoordinates;
  properties?: { property: RawProperty | Array<RawProperty> };
  bibliographies?: { bibliography: RawBibliography | Array<RawBibliography> };
  links?: RawLink | Array<RawLink>;
  reverseLinks?: RawLink | Array<RawLink>;
  notes?: { note: RawNote | Array<RawNote> };
  events?: { event: RawEvent | Array<RawEvent> };
  sections?: {
    translation?: { section: RawSection | Array<RawSection> };
    phonemic?: { section: RawSection | Array<RawSection> };
  };
  periods?: { period: RawPeriod | Array<RawPeriod> };
  creators?: { creator: RawPerson | Array<RawPerson> };
  editions?: { editor: RawPerson | Array<RawPerson> };
};

/**
 * Raw section structure corresponding to the parsed Section type
 */
export type RawSection = {
  uuid: string;
  publicationDateTime?: string; // YYYY-MM-DDThh:mm:ssZ
  type: string;
  n?: number;
  identification: RawIdentification;
  project?: { identification: RawIdentification };
};
