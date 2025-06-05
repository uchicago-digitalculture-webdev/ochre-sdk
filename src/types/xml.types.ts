export type XMLDataCategory =
  | "tree"
  | "bibliography"
  | "spatialUnit"
  | "concept"
  | "period"
  | "person"
  | "propertyValue"
  | "propertyVariable"
  | "resource"
  | "set";

export type XMLHeadingDataCategory = Exclude<
  XMLDataCategory,
  "tree" | "bibliography" | "spatialUnit" | "concept" | "period"
>;

export type XMLNonRecursiveDataCategory = Exclude<
  XMLDataCategory,
  "tree" | "person" | "propertyValue" | "propertyVariable" | "set"
>;

export type XMLText = { text?: string; rend?: string; whitespace?: string };

export type XMLString = {
  string:
    | Array<XMLText>
    | Array<{
        links: Array<XMLLink>;
        properties?: { property: Array<XMLProperty> };
        string?: Array<XMLText>;
        annotation: string;
      }>;
  rend?: string;
  whitespace?: string;
};

export type XMLContent = {
  content: Array<{
    string: Array<XMLText | XMLString | { whitespace: string }>;
    title?: string;
    lang: string;
  }>;
};

export type XMLNumber = string;

export type XMLBoolean = string;

export type XMLIdentification = {
  label: XMLText | XMLContent;
  abbreviation?: XMLText | XMLContent;
  email?: string;
  website?: { text: string };
};

export type XMLMetadata = {
  dataset: XMLText;
  description: XMLText;
  publisher: XMLText;
  identifier: XMLText;
  language?: Array<{ text: string; default?: "true" }>;
  project?: { identification: XMLIdentification };
  item?: {
    identification: XMLIdentification;
    category: XMLDataCategory;
    type: string;
    maxLength?: XMLNumber;
  };
};

export type XMLLicense = XMLText & { target?: string };

export type XMLContextValue = {
  uuid: string;
  publicationDateTime?: string;
  n: XMLNumber;
  text: string;
};

export type XMLContextItem = {
  project: XMLContextValue;
  tree: Array<XMLContextValue>;
  displayPath: string;
} & Partial<Record<XMLNonRecursiveDataCategory, Array<XMLContextValue>>>;

export type XMLContext = Array<{
  context: Array<XMLContextItem>;
  displayPath: string;
}>;

export type XMLEvent = {
  dateTime?: string;
  agent?: { uuid: string; text: string };
  comment?: XMLText;
  label: XMLContent;
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
  content?: string;
  height?: XMLNumber;
  width?: XMLNumber;
  heightPreview?: XMLNumber;
  widthPreview?: XMLNumber;
};

export type XMLLink = Record<
  string,
  Array<{
    uuid: string;
    publicationDateTime?: string;
    identification?: XMLIdentification;
    type?: string;
    rend?: "inline";
    content?: string;
    isPrimary?: XMLBoolean;
    image?: XMLImage;
    href?: string;
  }>
>;

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

export type XMLNote = {
  note: Array<
    | (XMLContent & {
        noteNo: XMLNumber;
        authors?: { author: Array<XMLPerson> };
      })
    | XMLText
  >;
  rend?: string;
};

export type XMLProperty = {
  label: XMLContent & { uuid: string; publicationDateTime?: string };
  value?: Array<
    Partial<XMLContent> & {
      uuid?: string;
      publicationDateTime?: string;
      type?: string;
      category?: string;
      slug?: string;
      unit?: string;
      booleanValue?: string;
      isUncertain?: "true";
    }
  >;
  comment?: string;
  properties?: { property: Array<XMLProperty> };
};

export type XMLBaseItem = {
  uuid: string;
  publicationDateTime?: string;
  date?: string;
  availability?: { license: XMLLicense };
  project?: { identification: XMLIdentification };
  identification: XMLIdentification;
  context?: XMLContext;
  creators?: { creator: Array<XMLPerson> };
  description?: XMLContent;
  events?: { event: Array<XMLEvent> };
};

export type XMLBibliography = XMLBaseItem & {
  type?: string;
  project?: { identification: XMLIdentification };
  ZoteroID?: string;
  sourceDocument?: { uuid: string; text: string };
  publicationInfo?: {
    publishers?: { publisher: Array<XMLPerson> };
    startDate?: { month: XMLNumber; year: XMLNumber; day: XMLNumber };
  };
  entryInfo?: { startIssue: string; startVolume: string };
  citationFormat?: XMLText;
  citationFormatSpan?: XMLText;
  referenceFormatDiv?: XMLText;
  source?: {
    resource?: {
      uuid: string;
      type: string;
      publicationDateTime?: string;
      identification: XMLIdentification;
    };
  };
  authors?: { person: Array<XMLPerson> };
  periods?: { period: Array<XMLPeriod> };
  links?: Array<XMLLink>;
  notes?: XMLNote;
  properties?: { property: Array<XMLProperty> };
  citedBibliography?: { reference: Array<XMLBibliography> };
  bibliography?: Array<XMLBibliography>;
};

export type XMLInterpretation = {
  interpretationNo: XMLNumber;
  date?: string;
  observers?: { observer: Array<XMLPerson> };
  periods?: { period: Array<XMLPeriod> };
  links?: Array<XMLLink>;
  notes?: XMLNote;
  properties?: { property: Array<XMLProperty> };
  citedBibliography?: { reference: Array<XMLBibliography> };
};

export type XMLConcept = XMLBaseItem & {
  interpretations?: { interpretation: Array<XMLInterpretation> };
  coordinates?: XMLCoordinates;
  concept?: Array<XMLConcept>;
};

export type XMLObservation = {
  observationNo: XMLNumber;
  date?: string;
  observers?: { observer: Array<XMLPerson> };
  periods?: { period: Array<XMLPeriod> };
  links?: Array<XMLLink>;
  notes?: XMLNote;
  properties?: { property: Array<XMLProperty> };
  citedBibliography?: { reference: Array<XMLBibliography> };
};

export type XMLSpatialUnit = XMLBaseItem & {
  image?: XMLImage;
  coordinates?: XMLCoordinates;
  mapData?: { geoJSON: { multiPolygon: string; EPSG: XMLNumber } };
  observations?: { observation: Array<XMLObservation> };
  citedBibliography?: { reference: Array<XMLBibliography> };
  spatialUnit?: Array<XMLSpatialUnit>;
};

export type XMLPeriod = XMLBaseItem & {
  type?: string;
  coordinates?: XMLCoordinates;
  links?: Array<XMLLink>;
  notes?: XMLNote;
  properties?: { property: Array<XMLProperty> };
  citedBibliography?: { reference: Array<XMLBibliography> };
  period?: Array<XMLPeriod>;
};

export type XMLPerson = XMLBaseItem &
  XMLContent & {
    type?: string;
    address?: { country?: string; city?: string; state?: string };
    coordinates?: XMLCoordinates;
    periods?: { period: Array<XMLPeriod> };
    links?: Array<XMLLink>;
    notes?: XMLNote;
    properties?: { property: Array<XMLProperty> };
    citedBibliography?: { reference: Array<XMLBibliography> };
  };

export type XMLPropertyValue = XMLBaseItem & {
  coordinates?: XMLCoordinates;
  links?: Array<XMLLink>;
  notes?: XMLNote;
  properties?: { property: Array<XMLProperty> };
  citedBibliography?: { reference: Array<XMLBibliography> };
};

export type XMLPropertyVariable = XMLBaseItem & {
  type?: string;
  coordinates?: XMLCoordinates;
  links?: Array<XMLLink>;
  notes?: XMLNote;
  citedBibliography?: { reference: Array<XMLBibliography> };
};

export type XMLResource = XMLBaseItem & {
  type?: string;
  date?: string;
  href?: string;
  fileFormat?: string;
  image?: XMLImage;
  imagemap?: XMLImageMap;
  document?: XMLContent;
  coordinates?: XMLCoordinates;
  periods?: { period: Array<XMLPeriod> };
  links?: Array<XMLLink>;
  reverseLinks?: Array<XMLDataItem>;
  notes?: XMLNote;
  properties?: { property: Array<XMLProperty> };
  citedBibliography?: { reference: Array<XMLBibliography> };
  resource?: Array<XMLResource>;
};

export type XMLHeading = {
  name: string;
  abbreviation?: string;
  heading?: Array<XMLHeading>;
} & (
  | { person?: Array<XMLPerson> }
  | { propertyValue?: Array<XMLPropertyValue> }
  | { propertyVariable?: Array<XMLPropertyVariable> }
  | { resource?: Array<XMLResource> }
  | { set?: Array<XMLSet> }
);

export type XMLTree = XMLBaseItem & {
  date?: string;
  links?: Array<XMLLink>;
  notes?: XMLNote;
  properties?: { property: Array<XMLProperty> };
  items?: { heading?: Array<XMLHeading> } & (
    | { bibliography?: Array<XMLBibliography> }
    | { concept?: Array<XMLConcept> }
    | { spatialUnit?: Array<XMLSpatialUnit> }
    | { period?: Array<XMLPeriod> }
    | { person?: Array<XMLPerson> }
    | { propertyValue?: Array<XMLPropertyValue> }
    | { propertyVariable?: Array<XMLPropertyVariable> }
    | { resource?: Array<XMLResource> }
    | { set?: Array<XMLSet> }
  );
};

export type XMLSet = XMLBaseItem & {
  type?: string;
  suppressBlanks?: XMLBoolean;
  tabularStructure?: XMLBoolean;
  links?: Array<XMLLink>;
  notes?: XMLNote;
  properties?: { property: Array<XMLProperty> };
  items?: {
    tree?: Array<XMLTree>;
    bibliography?: Array<XMLBibliography>;
    concept?: Array<XMLConcept>;
    spatialUnit?: Array<XMLSpatialUnit>;
    period?: Array<XMLPeriod>;
    person?: Array<XMLPerson>;
    propertyValue?: Array<XMLPropertyValue>;
    propertyVariable?: Array<XMLPropertyVariable>;
    resource?: Array<XMLResource>;
    set?: Array<XMLSet>;
  };
};

export type XMLDataItem =
  | { tree: Array<XMLTree> }
  | { bibliography: Array<XMLBibliography> }
  | { concept: Array<XMLConcept> }
  | { spatialUnit: Array<XMLSpatialUnit> }
  | { period: Array<XMLPeriod> }
  | { person: Array<XMLPerson> }
  | { propertyValue: Array<XMLPropertyValue> }
  | { propertyVariable: Array<XMLPropertyVariable> }
  | { resource: Array<XMLResource> }
  | { set: Array<XMLSet> };

export type XMLData = {
  ochre: {
    uuid: string;
    belongsTo: string;
    uuidBelongsTo: string;
    publicationDateTime: string;
    metadata: XMLMetadata;
    languages?: string;
  } & XMLDataItem;
};
