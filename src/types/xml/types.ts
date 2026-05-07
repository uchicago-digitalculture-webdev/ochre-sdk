export type XMLDataCategory =
  | "tree"
  | "bibliography"
  | "spatialUnit"
  | "concept"
  | "period"
  | "person"
  | "propertyVariable"
  | "propertyValue"
  | "text"
  | "resource"
  | "set";

export type XMLHeadingDataCategory = Exclude<
  XMLDataCategory,
  "tree" | "bibliography" | "spatialUnit" | "concept" | "period"
>;

export type XMLRecursiveDataCategory = Exclude<
  XMLDataCategory,
  "tree" | "person" | "propertyVariable" | "propertyValue" | "set"
>;

export type XMLString = {
  payload?: string;
  rend?: string;
  whitespace?: string;
  string?: Array<{
    links?: XMLLink;
    properties?: { property: Array<XMLProperty> };
    string?: Array<XMLString>;
    annotation: string;
  }>;
};

export type XMLContent = {
  content: Array<{ string: Array<XMLString>; lang: string }>;
};

export type XMLNumber = string;

export type XMLBoolean = string;

export type XMLIdentification = {
  label: XMLContent;
  abbreviation?: XMLContent;
  code?: { payload: string };
  email?: { payload: string };
  website?: { payload: string };
};

export type XMLMetadata = {
  dataset: XMLString;
  description: XMLString;
  publisher: XMLString;
  identifier: XMLString;
  language?: Array<{ payload: string; default?: "true" }>;
  project?: {
    uuid: string;
    identification: XMLIdentification;
    dateFormat?: string;
    page?: "item" | "entry";
  };
  collection?: {
    uuid: string;
    identification: XMLIdentification;
    page: "item" | "entry";
  };
  publication?: {
    uuid: string;
    identification: XMLIdentification;
    page: "item" | "entry";
  };
  item?: {
    uuid: string;
    identification: XMLIdentification;
    category: XMLDataCategory;
    type: string;
    maxLength?: XMLNumber;
  };
};

export type XMLLicense = XMLString & { target?: string };

export type XMLContextValue = {
  uuid: string;
  publicationDateTime?: string;
  n: XMLNumber;
  payload: string;
};

export type XMLContextItem = {
  project: XMLContextValue;
  tree: Array<XMLContextValue>;
  displayPath: string;
} & Partial<Record<XMLRecursiveDataCategory, Array<XMLContextValue>>>;

export type XMLContext = Array<{
  context: Array<XMLContextItem>;
  displayPath: string;
}>;

export type XMLEvent = {
  dateTime?: string;
  endDateTime?: string;
  agent?: XMLContent & { uuid: string; publicationDateTime?: string };
  location?: XMLContent & { uuid: string; publicationDateTime?: string };
  comment?: XMLContent;
  label: XMLContent;
  other?: XMLContent & { uuid?: string; category?: XMLDataCategory };
};

export type XMLCoordinatesSource =
  | { context: "self"; label: XMLContent & { uuid: string } }
  | {
      context: "related";
      label: XMLContent & { uuid: string };
      value: XMLContent & { uuid: string };
    }
  | {
      context: "inherited";
      label: XMLContent & { uuid: string };
      item: { label: XMLContent & { uuid: string } };
    };

export type XMLCoordinates =
  | {
      type: "point";
      latitude: XMLNumber;
      longitude: XMLNumber;
      altitude?: XMLNumber;
      source: XMLCoordinatesSource;
    }
  | {
      type: "plane";
      minimum: { latitude: XMLNumber; longitude: XMLNumber };
      maximum: { latitude: XMLNumber; longitude: XMLNumber };
      source: XMLCoordinatesSource;
    };

export type XMLImage = {
  publicationDateTime?: string;
  identification?: XMLIdentification;
  href?: string;
  htmlImgSrcPrefix?: string;
  height?: XMLNumber;
  width?: XMLNumber;
  fileSize?: XMLNumber;
  content?: Array<string>;
};

export type XMLImageMapArea = {
  uuid: string;
  publicationDateTime: string;
  type: string;
  title: string;
  shape: string;
  coords: string;
};

export type XMLImageMap = {
  area: Array<XMLImageMapArea>;
  width: XMLNumber;
  height: XMLNumber;
};

export type XMLNote = XMLContent & {
  noteNo: XMLNumber;
  title?: string;
  authors?: { author: Array<XMLPerson> };
};

export type XMLProperty = {
  label: XMLContent & { uuid: string; publicationDateTime?: string };
  value?: Array<
    Partial<XMLContent> & {
      i?: XMLNumber;
      inherited?: XMLBoolean;
      uuid?: string;
      publicationDateTime?: string;
      dataType?: string;
      category?: string;
      type?: string;
      slug?: string;
      unit?: string;
      height?: XMLNumber;
      width?: XMLNumber;
      fileSize?: XMLNumber;
      href?: string;
      rawValue?: string;
      isUncertain?: "true";
    }
  >;
  comment?: XMLContent;
  property?: Array<XMLProperty>;
};

export type XMLSimplifiedProperty = {
  label: XMLContent & { uuid: string; publicationDateTime?: string };
  value?: Array<{
    i?: XMLNumber;
    inherited?: XMLBoolean;
    uuid?: string;
    publicationDateTime?: string;
    dataType?: string;
    category?: string;
    type?: string;
    slug?: string;
    unit?: string;
    height?: XMLNumber;
    width?: XMLNumber;
    fileSize?: XMLNumber;
    href?: string;
    rawValue?: string;
    isUncertain?: "true";
    payload: string;
  }>;
  comment?: XMLContent;
  property?: Array<XMLSimplifiedProperty>;
};

export type XMLBaseItem = {
  uuid: string;
  publicationDateTime?: string;
  date?: string;
  availability?: { license: XMLLicense };
  copyright?: XMLString;
  watermark?: XMLString;
  identification: XMLIdentification;
  context?: XMLContext;
  creators?: { creator: Array<XMLPerson> };
  description?: XMLContent;
  events?: { event: Array<XMLEvent> };
};

export type XMLBibliography = Partial<XMLBaseItem> & {
  type?: string;
  zoteroId?: string;
  sourceDocument?: { uuid: string; payload: string };
  publicationInfo?: {
    publishers?: { publisher: Array<XMLPerson> };
    startDate?: { month: XMLNumber; year: XMLNumber; day: XMLNumber };
  };
  entryInfo?: { startIssue: string; startVolume: string };
  citationDetails?: string;
  citationFormat?: XMLString;
  citationFormatSpan?: XMLString;
  referenceFormatDiv?: XMLString;
  source?: XMLDataItem;
  authors?: { person: Array<XMLPerson> };
  periods?: { period: Array<XMLPeriod> };
  links?: XMLLink;
  notes?: { note: Array<XMLNote> };
  properties?: { property: Array<XMLProperty> };
  bibliographies?: { bibliography: Array<XMLBibliography> };
};

export type XMLInterpretation = {
  interpretationNo: XMLNumber;
  date?: string;
  observers?: { observer: Array<XMLPerson> };
  periods?: { period: Array<XMLPeriod> };
  links?: XMLLink;
  notes?: { note: Array<XMLNote> };
  properties?: { property: Array<XMLProperty> };
  bibliographies?: { bibliography: Array<XMLBibliography> };
};

export type XMLConcept = XMLBaseItem & {
  status?: "live";
  image?: XMLImage;
  interpretations?: { interpretation: Array<XMLInterpretation> };
  coordinates?: XMLCoordinates;
  concept?: Array<XMLConcept>;
};

export type XMLObservation = {
  observationNo: XMLNumber;
  date?: string;
  observers?: { observer: Array<XMLPerson> };
  periods?: { period: Array<XMLPeriod> };
  links?: XMLLink;
  notes?: { note: Array<XMLNote> };
  properties?: { property: Array<XMLProperty> };
  bibliographies?: { bibliography: Array<XMLBibliography> };
};

export type XMLSpatialUnit = XMLBaseItem & {
  image?: XMLImage;
  coordinates?: XMLCoordinates;
  mapData?: { geoJSON: { multiPolygon: { payload: string }; EPSG: XMLNumber } };
  observations?: { observation: Array<XMLObservation> };
  bibliographies?: { bibliography: Array<XMLBibliography> };
  spatialUnit?: Array<XMLSpatialUnit>;
};

export type XMLPeriod = XMLBaseItem & {
  type?: string;
  coordinates?: XMLCoordinates;
  links?: XMLDataItem;
  notes?: { note: Array<XMLNote> };
  properties?: { property: Array<XMLProperty> };
  bibliographies?: { bibliography: Array<XMLBibliography> };
  period?: Array<XMLPeriod>;
};

export type XMLPerson = XMLBaseItem &
  Partial<XMLContent> & {
    type?: string;
    image?: XMLImage;
    address?: { country?: string; city?: string; state?: string };
    coordinates?: XMLCoordinates;
    periods?: { period: Array<XMLPeriod> };
    links?: XMLLink;
    notes?: { note: Array<XMLNote> };
    properties?: { property: Array<XMLProperty> };
    bibliographies?: { bibliography: Array<XMLBibliography> };
  };

export type XMLPropertyVariable = XMLBaseItem & {
  type?: string;
  coordinates?: XMLCoordinates;
  links?: XMLLink;
  notes?: { note: Array<XMLNote> };
  bibliographies?: { bibliography: Array<XMLBibliography> };
};

export type XMLPropertyValue = XMLBaseItem & {
  coordinates?: XMLCoordinates;
  links?: XMLLink;
  notes?: { note: Array<XMLNote> };
  properties?: { property: Array<XMLProperty> };
  bibliographies?: { bibliography: Array<XMLBibliography> };
};

export type XMLResource = XMLBaseItem & {
  type?: string;
  date?: string;
  href?: string;
  fileFormat?: string;
  fileSize?: XMLNumber;
  rend?: "inline";
  height?: XMLNumber;
  width?: XMLNumber;
  image?: XMLImage;
  imagemap?: XMLImageMap;
  document?: XMLContent;
  coordinates?: XMLCoordinates;
  periods?: { period: Array<XMLPeriod> };
  links?: XMLLink;
  reverseLinks?: Array<XMLLink>;
  notes?: { note: Array<XMLNote> };
  properties?: { property: Array<XMLProperty> };
  bibliographies?: { bibliography: Array<XMLBibliography> };
  resource?: Array<XMLResource>;
};

export type XMLSection = {
  uuid: string;
  publicationDateTime?: string;
  type: string;
  identification: XMLIdentification;
  project?: { identification: XMLIdentification };
};

export type XMLText = XMLBaseItem & {
  type?: string;
  text?: string;
  language?: string;
  image?: XMLImage;
  coordinates?: XMLCoordinates;
  links?: XMLLink;
  reverseLinks?: Array<XMLLink>;
  notes?: { note: Array<XMLNote> };
  sections?: {
    translation?: { section: Array<XMLSection> };
    phonemic?: { section: Array<XMLSection> };
  };
  periods?: { period: Array<XMLPeriod> };
  creators?: { creator: Array<XMLPerson> };
  editions?: { edition: Array<XMLPerson> };
};

export type XMLHeading = {
  name: string;
  abbreviation?: string;
  heading?: Array<XMLHeading>;
} & (
  | { person?: Array<XMLPerson> }
  | { propertyVariable?: Array<XMLPropertyVariable> }
  | { propertyValue?: Array<XMLPropertyValue> }
  | { resource?: Array<XMLResource> }
  | { set?: Array<XMLSet> }
);

export type XMLTree = XMLBaseItem & {
  type?: string;
  date?: string;
  links?: XMLLink;
  notes?: { note: Array<XMLNote> };
  properties?: { property: Array<XMLProperty> };
  items?: { heading?: Array<XMLHeading> } & (
    | { bibliography: Array<XMLBibliography> }
    | { concept: Array<XMLConcept> }
    | { spatialUnit: Array<XMLSpatialUnit> }
    | { period: Array<XMLPeriod> }
    | { person: Array<XMLPerson> }
    | { propertyVariable: Array<XMLPropertyVariable> }
    | { propertyValue: Array<XMLPropertyValue> }
    | { resource: Array<XMLResource> }
    | { text: Array<XMLText> }
    | { set: Array<XMLSet> }
  );
};

export type XMLSet = XMLBaseItem & {
  type?: string;
  suppressBlanks?: XMLBoolean;
  tabularStructure?: XMLBoolean;
  links?: XMLLink;
  notes?: { note: Array<XMLNote> };
  properties?: { property: Array<XMLProperty> };
  items?: {
    tree?: Array<XMLTree>;
    bibliography?: Array<XMLBibliography>;
    concept?: Array<XMLConcept>;
    spatialUnit?: Array<XMLSpatialUnit>;
    period?: Array<XMLPeriod>;
    person?: Array<XMLPerson>;
    propertyVariable?: Array<XMLPropertyVariable>;
    propertyValue?: Array<XMLPropertyValue>;
    resource?: Array<XMLResource>;
    text?: Array<XMLText>;
    set?: Array<XMLSet>;
  };
};

export type XMLLink = {
  tree?: Array<XMLTree>;
  bibliography?: Array<XMLBibliography>;
  concept?: Array<XMLConcept>;
  spatialUnit?: Array<XMLSpatialUnit>;
  period?: Array<XMLPeriod>;
  person?: Array<XMLPerson>;
  propertyVariable?: Array<XMLPropertyVariable>;
  propertyValue?: Array<XMLPropertyValue>;
  resource?: Array<XMLResource>;
  text?: Array<XMLText>;
  set?: Array<XMLSet>;
};

export type XMLDataItem =
  | { tree: Array<XMLTree> }
  | { bibliography: Array<XMLBibliography> }
  | { concept: Array<XMLConcept> }
  | { spatialUnit: Array<XMLSpatialUnit> }
  | { period: Array<XMLPeriod> }
  | { person: Array<XMLPerson> }
  | { propertyVariable: Array<XMLPropertyVariable> }
  | { propertyValue: Array<XMLPropertyValue> }
  | { resource: Array<XMLResource> }
  | { text: Array<XMLText> }
  | { set: Array<XMLSet> };

export type XMLData = {
  result: {
    ochre: {
      uuid: string;
      belongsTo: string;
      uuidBelongsTo: string;
      publicationDateTime: string;
      metadata: XMLMetadata;
      persistentUrl?: string;
      languages?: string;
    } & XMLDataItem;
  };
};
