export type XMLItemCategory =
  | "tree"
  | "bibliography"
  | "spatialUnit"
  | "concept"
  | "period"
  | "person"
  | "propertyVariable"
  | "variable"
  | "propertyValue"
  | "value"
  | "text"
  | "resource"
  | "set";

export type XMLHeadingItemCategory = Exclude<
  XMLItemCategory,
  "tree" | "bibliography" | "spatialUnit" | "concept" | "period"
>;

export type XMLRecursiveItemCategory = Exclude<
  XMLItemCategory,
  "tree" | "person" | "propertyVariable" | "propertyValue" | "set"
>;

export type XMLString = {
  payload?: string;
  rend?: string;
  whitespace?: string;
  links?: XMLLink;
  properties?: { property: Array<XMLProperty> };
  annotation?: string;
  string?: Array<XMLString>;
};

export type XMLContent = {
  content: Array<{ string: Array<XMLString>; lang: string; title?: string }>;
};

export type XMLNumber = number;

export type XMLBoolean = boolean;

export type XMLIdentification = {
  label: XMLContent | XMLString;
  abbreviation?: XMLContent | XMLString;
  code?: XMLString | string;
  email?: XMLString | string;
  website?: XMLString | string;
};

export type XMLMetadata = {
  dataset: XMLString;
  description: XMLString;
  publisher: XMLString | Array<XMLString>;
  identifier: XMLString;
  language?: Array<{ payload: string; default?: "true" }>;
  project?: {
    uuid?: string;
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
    uuid?: string;
    identification: XMLIdentification;
    category: XMLItemCategory;
    type: string;
    maxLength?: XMLNumber;
  };
};

export type XMLLicense = XMLString & { target?: string };

export type XMLContextValue = {
  uuid?: string;
  publicationDateTime?: Date;
  n: XMLNumber;
  payload: string;
};

export type XMLContextItem = {
  project: XMLContextValue;
  tree: Array<XMLContextValue>;
  displayPath: string;
} & Partial<
  Record<
    | XMLRecursiveItemCategory
    | "heading"
    | "propertyVariable"
    | "variable"
    | "propertyValue"
    | "value",
    Array<XMLContextValue>
  >
>;

export type XMLEmptyContext = { payload: string };

export type XMLContextGroup = {
  context: Array<XMLContextItem | XMLEmptyContext>;
  displayPath: string;
};

export type XMLContext = Array<XMLContextGroup | XMLEmptyContext>;

export type XMLEvent = {
  dateTime?: Date;
  endDateTime?: Date;
  agent?: XMLContent & { uuid: string; publicationDateTime?: Date };
  location?: XMLContent & { uuid: string; publicationDateTime?: Date };
  comment?: XMLContent;
  label: XMLContent;
  other?: XMLContent & { uuid?: string; category?: XMLItemCategory };
};

export type XMLCoordinatesSource =
  | { context: "self"; label: XMLContent & { uuid: string } }
  | {
      context: "related";
      label: XMLContent & { uuid: string };
      value: Array<(XMLContent | XMLString) & { uuid?: string }>;
    }
  | {
      context: "inherited";
      label: XMLContent & { uuid: string };
      value?: Array<(XMLContent | XMLString) & { uuid?: string }>;
      item: {
        uuid?: string;
        label: (XMLContent | XMLString) & { uuid?: string };
      };
    };

export type XMLCoordinate =
  | {
      type: "point";
      latitude: XMLNumber;
      longitude: XMLNumber;
      altitude?: XMLNumber;
      source?: XMLCoordinatesSource;
    }
  | {
      type: "plane";
      minimum: { latitude: XMLNumber; longitude: XMLNumber };
      maximum: { latitude: XMLNumber; longitude: XMLNumber };
      source?: XMLCoordinatesSource;
    };

export type XMLCoordinates = { coord: Array<XMLCoordinate> };

export type XMLImage = {
  publicationDateTime?: Date;
  identification?: XMLIdentification;
  href?: string;
  htmlImgSrcPrefix?: string;
  height?: XMLNumber;
  width?: XMLNumber;
  fileSize?: XMLNumber;
  payload?: string;
};

export type XMLImageMapArea = {
  uuid: string;
  publicationDateTime?: Date;
  type: string;
  title: string;
  slug?: string;
  shape: "rect" | "circle" | "poly" | "point";
  coords: string;
};

export type XMLImageMap = {
  area: Array<XMLImageMapArea>;
  width: XMLNumber;
  height: XMLNumber;
};

export type XMLNote = Partial<XMLContent> &
  XMLString & {
    noteNo?: XMLNumber;
    title?: string;
    authors?: { author: Array<XMLPerson> };
  };

export type XMLPropertyRelation = "related" | "inverse";

export type XMLProperty = {
  label: (XMLContent | XMLString) & {
    uuid: string;
    publicationDateTime?: Date;
    relation?: XMLPropertyRelation;
  };
  value?: Array<
    Partial<XMLContent> & {
      i?: XMLNumber;
      inherited?: XMLBoolean;
      uuid?: string;
      publicationDateTime?: Date;
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
      payload?: string;
    }
  >;
  comment?: XMLContent;
  property?: Array<XMLProperty>;
};

export type XMLSimplifiedProperty = {
  label: (XMLContent | XMLString) & {
    uuid: string;
    publicationDateTime?: Date;
    relation?: XMLPropertyRelation;
  };
  value?: Array<
    Partial<XMLContent> & {
      i?: XMLNumber;
      inherited?: XMLBoolean;
      uuid?: string;
      publicationDateTime?: Date;
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
      payload?: string;
    }
  >;
  comment?: XMLContent;
  property?: Array<XMLSimplifiedProperty>;
};

export type XMLBaseItem = {
  uuid: string;
  publicationDateTime?: Date;
  date?: Date | XMLString;
  availability?: { license: XMLLicense };
  copyright?: XMLContent | XMLString;
  watermark?: XMLContent | XMLString;
  identification: XMLIdentification;
  context?: XMLContext;
  creators?: { creator: Array<XMLPerson> };
  description?: XMLContent;
  events?: { event: Array<XMLEvent> };
};

export type XMLBibliography = Partial<XMLBaseItem> & {
  type?: string;
  zoteroId?: string;
  sourceDocument?: {
    uuid: string;
    payload: string;
    href?: string;
    publicationDateTime?: Date;
  };
  image?: XMLImage;
  publicationInfo?: {
    publishers?:
      | { publisher: Array<XMLPerson> }
      | { publishers: { person: Array<XMLPerson> } };
    startDate?: { month?: XMLNumber; year?: XMLNumber; day?: XMLNumber };
  };
  entryInfo?: {
    payload?: string;
    startIssue?: string;
    startVolume?: string;
    startPage?: string;
    endPage?: string;
  };
  citationDetails?: string;
  citationFormat?: XMLString | string;
  citationFormatSpan?: XMLString;
  referenceFormatDiv?: XMLString;
  source?: XMLDataItem;
  authors?: { person: Array<XMLPerson> };
  periods?: { period: Array<XMLPeriod> };
  links?: XMLLink;
  reverseLinks?: XMLLink | XMLDataItem | Array<XMLLink | XMLDataItem>;
  notes?: { note: Array<XMLNote> };
  properties?: { property: Array<XMLProperty> };
  bibliographies?: { bibliography: Array<XMLBibliography> };
  bibliography?: Array<XMLBibliography>;
};

export type XMLLinkedBaseItem = Partial<Omit<XMLBaseItem, "uuid">> & {
  uuid: string;
};

export type XMLLinkedTree = XMLLinkedBaseItem & { type?: string };

export type XMLLinkedSet = XMLLinkedBaseItem & { type?: string };

export type XMLLinkedBibliography = XMLLinkedBaseItem & {
  type?: string;
  zoteroId?: string;
  sourceDocument?: XMLBibliography["sourceDocument"];
  image?: XMLImage;
  publicationInfo?: {
    publishers?:
      | { publisher: Array<XMLLinkedPerson> }
      | { publishers: { person: Array<XMLLinkedPerson> } };
    startDate?: { month?: XMLNumber; year?: XMLNumber; day?: XMLNumber };
  };
  entryInfo?: XMLBibliography["entryInfo"];
  citationDetails?: string;
  citationFormat?: XMLString | string;
  citationFormatSpan?: XMLString;
  referenceFormatDiv?: XMLString;
  source?: XMLLink | XMLDataItem;
  authors?: { person: Array<XMLLinkedPerson> };
  periods?: { period: Array<XMLLinkedPeriod> };
  properties?: { property: Array<XMLProperty> };
};

export type XMLLinkedConcept = XMLLinkedBaseItem & {
  image?: XMLImage;
  coordinates?: XMLCoordinates;
};

export type XMLLinkedSpatialUnit = XMLLinkedBaseItem & {
  image?: XMLImage;
  coordinates?: XMLCoordinates;
};

export type XMLLinkedPeriod = XMLLinkedBaseItem & {
  type?: string;
  coordinates?: XMLCoordinates;
};

export type XMLLinkedPerson = XMLLinkedBaseItem & {
  type?: string;
  coordinates?: XMLCoordinates;
};

export type XMLLinkedPropertyVariable = XMLLinkedBaseItem & {
  type?: string;
  coordinates?: XMLCoordinates;
};

export type XMLLinkedPropertyValue = XMLLinkedBaseItem & {
  coordinates?: XMLCoordinates;
};

export type XMLLinkedResource = XMLLinkedBaseItem & {
  type?: string;
  date?: Date | XMLString;
  href?: string;
  fileFormat?: string;
  fileSize?: XMLNumber;
  rend?: "inline";
  isPrimary?: XMLBoolean;
  height?: XMLNumber;
  width?: XMLNumber;
  image?: XMLImage;
  coordinates?: XMLCoordinates;
};

export type XMLLinkedText = XMLLinkedBaseItem & {
  type?: string;
  text?: string;
  language?: string;
  image?: XMLImage;
  coordinates?: XMLCoordinates;
};

export type XMLDictionaryUnit = XMLLinkedBaseItem;

export type XMLInterpretation = {
  interpretationNo: XMLNumber;
  date?: Date;
  observers?: { observer: Array<XMLPerson> };
  periods?: { period: Array<XMLPeriod> };
  links?: XMLLink;
  reverseLinks?: XMLLink | XMLDataItem | Array<XMLLink | XMLDataItem>;
  notes?: { note: Array<XMLNote> };
  properties?: { property: Array<XMLProperty> };
  bibliographies?: { bibliography: Array<XMLBibliography> };
};

export type XMLConcept = XMLBaseItem & {
  status?: "live";
  image?: XMLImage;
  interpretations?: { interpretation: Array<XMLInterpretation> };
  coordinates?: XMLCoordinates;
  properties?: { property: Array<XMLProperty> };
  concept?: Array<XMLConcept>;
};

export type XMLObservation = {
  observationNo: XMLNumber;
  date?: Date;
  observers?: { observer: Array<XMLPerson> };
  periods?: { period: Array<XMLPeriod> };
  links?: XMLLink;
  reverseLinks?: XMLLink | XMLDataItem | Array<XMLLink | XMLDataItem>;
  notes?: { note: Array<XMLNote> };
  properties?: { property: Array<XMLProperty> };
  bibliographies?: { bibliography: Array<XMLBibliography> };
};

export type XMLSpatialUnit = XMLBaseItem & {
  image?: XMLImage;
  coordinates?: XMLCoordinates;
  mapData?: { geoJSON: { multiPolygon: { payload: string }; EPSG: XMLNumber } };
  observations?: { observation: Array<XMLObservation> };
  properties?: { property: Array<XMLProperty> };
  bibliographies?: { bibliography: Array<XMLBibliography> };
  spatialUnit?: Array<XMLSpatialUnit>;
};

export type XMLPeriod = XMLBaseItem & {
  type?: string;
  coordinates?: XMLCoordinates;
  links?: XMLDataItem;
  reverseLinks?: XMLLink | XMLDataItem | Array<XMLLink | XMLDataItem>;
  notes?: { note: Array<XMLNote> };
  properties?: { property: Array<XMLProperty> };
  bibliographies?: { bibliography: Array<XMLBibliography> };
  period?: Array<XMLPeriod>;
};

export type XMLPerson = XMLBaseItem &
  Partial<XMLContent> & {
    type?: string;
    image?: XMLImage;
    address?: {
      country?: XMLString | string;
      city?: XMLString | string;
      state?: XMLString | string;
      postalCode?: XMLString | string;
    };
    coordinates?: XMLCoordinates;
    periods?: { period: Array<XMLPeriod> };
    links?: XMLLink;
    reverseLinks?: XMLLink | XMLDataItem | Array<XMLLink | XMLDataItem>;
    notes?: { note: Array<XMLNote> };
    properties?: { property: Array<XMLProperty> };
    bibliographies?: { bibliography: Array<XMLBibliography> };
  };

export type XMLPropertyVariable = XMLBaseItem & {
  type?: string;
  coordinates?: XMLCoordinates;
  links?: XMLLink;
  reverseLinks?: XMLLink | XMLDataItem | Array<XMLLink | XMLDataItem>;
  notes?: { note: Array<XMLNote> };
  bibliographies?: { bibliography: Array<XMLBibliography> };
};

export type XMLPropertyValue = XMLBaseItem & {
  coordinates?: XMLCoordinates;
  links?: XMLLink;
  reverseLinks?: XMLLink | XMLDataItem | Array<XMLLink | XMLDataItem>;
  notes?: { note: Array<XMLNote> };
  properties?: { property: Array<XMLProperty> };
  bibliographies?: { bibliography: Array<XMLBibliography> };
};

export type XMLResource = XMLBaseItem & {
  lang?: string;
  type?: string;
  date?: Date | XMLString;
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
  reverseLinks?: XMLLink | XMLDataItem | Array<XMLLink | XMLDataItem>;
  notes?: { note: Array<XMLNote> };
  properties?: { property: Array<XMLProperty> };
  bibliographies?: { bibliography: Array<XMLBibliography> };
  resource?: Array<XMLResource>;
  view?: { resource?: Array<XMLWebsiteResource> };
};

export type XMLSection = {
  uuid: string;
  publicationDateTime?: Date;
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
  reverseLinks?: XMLLink | XMLDataItem | Array<XMLLink | XMLDataItem>;
  notes?: { note: Array<XMLNote> };
  sections?:
    | XMLString
    | {
        translation?: Array<{ section: Array<XMLSection> }>;
        phonemic?: Array<{ section: Array<XMLSection> }>;
      };
  periods?: { period: Array<XMLPeriod> };
  creators?: { creator: Array<XMLPerson> };
  editions?: {
    edition?: Array<XMLPerson>;
    editor?: Array<XMLPerson>;
    publisher?: Array<XMLPerson>;
  };
};

export type XMLHeading = {
  name: string;
  abbreviation?: string;
  heading?: Array<XMLHeading>;
} & (
  | { person?: Array<XMLPerson> }
  | { propertyVariable?: Array<XMLPropertyVariable> }
  | { variable?: Array<XMLPropertyVariable> }
  | { propertyValue?: Array<XMLPropertyValue> }
  | { resource?: Array<XMLResource | { resource: Array<XMLResource> }> }
  | { text?: Array<XMLText> }
  | { set?: Array<XMLSet> }
);

export type XMLTree = XMLBaseItem & {
  type?: string;
  date?: Date | XMLString;
  links?: XMLLink;
  reverseLinks?: XMLLink | XMLDataItem | Array<XMLLink | XMLDataItem>;
  notes?: { note: Array<XMLNote> };
  properties?: { property: Array<XMLProperty> };
  bibliographies?: { bibliography: Array<XMLBibliography> };
  items?: { heading?: Array<XMLHeading> } & Partial<{
    bibliography: Array<XMLBibliography>;
    concept: Array<XMLConcept>;
    spatialUnit: Array<XMLSpatialUnit>;
    period: Array<XMLPeriod>;
    person: Array<XMLPerson>;
    propertyVariable: Array<XMLPropertyVariable>;
    variable: Array<XMLPropertyVariable>;
    propertyValue: Array<XMLPropertyValue>;
    resource: Array<XMLResource | { resource: Array<XMLResource> }>;
    text: Array<XMLText>;
    set: Array<XMLSet>;
  }>;
};

export type XMLWebsiteContextLevel = XMLString & {
  payload: string;
  dataType?: string;
};

export type XMLWebsiteContextItem = {
  identification: XMLIdentification;
  levels?: { level: Array<XMLWebsiteContextLevel> };
};

export type XMLWebsiteFilterContextItem = XMLWebsiteContextItem & {
  filterType?: "property" | "coordinates" | "bibliography" | "period";
  filterOption?:
    | "inline-displayed"
    | "inline-sidebar-displayed-closed"
    | "inline-sidebar-displayed-open"
    | "sidebar-displayed-closed"
    | "sidebar-displayed-open"
    | "inline-sidebar-hidden";
};

export type XMLWebsiteContext = { context: Array<XMLWebsiteContextItem> };

export type XMLWebsiteFilterContext = {
  context: Array<XMLWebsiteFilterContextItem>;
};

export type XMLWebsiteScope = {
  uuid: XMLString & { payload: string; type: string };
  identification: XMLIdentification;
};

export type XMLWebsiteOptions = {
  notes?: { note: Array<XMLNote> };
  scopes?: { scope: Array<XMLWebsiteScope> };
  flattenContexts?: Array<XMLWebsiteContext>;
  suppressContexts?: Array<XMLWebsiteContext>;
  filterContexts?: Array<XMLWebsiteFilterContext>;
  sortContexts?: Array<XMLWebsiteContext>;
  detailContexts?: Array<XMLWebsiteContext>;
  downloadContexts?: Array<XMLWebsiteContext>;
  labelContexts?: Array<XMLWebsiteContext>;
  prominentContexts?: Array<XMLWebsiteContext>;
};

export type XMLWebsiteStyle = XMLString & {
  variableUuid: string;
  valueUuid?: string;
  category?: string;
  lucideIcon?: string;
  payload: string;
} & Record<string, unknown>;

export type XMLWebsiteProperties = {
  property: Array<XMLSimplifiedProperty>;
  simplify?: XMLBoolean;
};

export type XMLWebsiteResourceGroup = { resource: Array<XMLWebsiteResource> };

export type XMLWebsiteSegment = {
  segments: { tree: Array<XMLWebsiteTree> };
  uuid: string;
  publicationDateTime?: Date;
};

export type XMLWebsiteResourceItem =
  | XMLWebsiteResource
  | XMLWebsiteResourceGroup
  | XMLWebsiteSegment;

export type XMLWebsiteResource = Omit<
  XMLResource,
  "properties" | "resource" | "view"
> & {
  format?: string;
  slug?: string;
  options?: XMLWebsiteOptions;
  properties?: XMLWebsiteProperties;
  resource?: Array<XMLWebsiteResourceItem>;
};

export type XMLWebsiteTree = Omit<XMLTree, "items" | "properties"> & {
  options?: XMLWebsiteOptions;
  styleOptions?: { style: Array<XMLWebsiteStyle> };
  properties?: XMLWebsiteProperties;
  items?: { resource?: Array<XMLWebsiteResourceItem> };
};

export type XMLSet = XMLBaseItem & {
  type?: string;
  suppressBlanks?: XMLBoolean;
  tabularStructure?: XMLBoolean;
  links?: XMLLink;
  reverseLinks?: XMLLink | XMLDataItem | Array<XMLLink | XMLDataItem>;
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
    variable?: Array<XMLPropertyVariable>;
    propertyValue?: Array<XMLPropertyValue>;
    resource?: Array<XMLResource | { resource: Array<XMLResource> }>;
    text?: Array<XMLText>;
    set?: Array<XMLSet>;
  };
};

export type XMLLink = {
  tree?: Array<XMLLinkedTree>;
  bibliography?: Array<XMLLinkedBibliography>;
  concept?: Array<XMLLinkedConcept>;
  spatialUnit?: Array<XMLLinkedSpatialUnit>;
  period?: Array<XMLLinkedPeriod>;
  person?: Array<XMLLinkedPerson>;
  propertyVariable?: Array<XMLLinkedPropertyVariable>;
  variable?: Array<XMLLinkedPropertyVariable>;
  propertyValue?: Array<XMLLinkedPropertyValue>;
  value?: Array<XMLLinkedPropertyValue>;
  resource?: Array<XMLLinkedResource>;
  text?: Array<XMLLinkedText>;
  set?: Array<XMLLinkedSet>;
  dictionaryUnit?: Array<XMLDictionaryUnit>;
};

export type XMLDataItem =
  | { tree: Array<XMLTree> }
  | { bibliography: Array<XMLBibliography> }
  | { concept: Array<XMLConcept> }
  | { spatialUnit: Array<XMLSpatialUnit> }
  | { period: Array<XMLPeriod> }
  | { person: Array<XMLPerson> }
  | { propertyVariable: Array<XMLPropertyVariable> }
  | { variable: Array<XMLPropertyVariable> }
  | { propertyValue: Array<XMLPropertyValue> }
  | { value: Array<XMLPropertyValue> }
  | { resource: Array<XMLResource> }
  | { text: Array<XMLText> }
  | { set: Array<XMLSet> };

export type XMLItemLinks = Partial<{
  payload: string;
  tree: Array<XMLTree>;
  bibliography: Array<XMLBibliography>;
  concept: Array<XMLConcept>;
  spatialUnit: Array<XMLSpatialUnit>;
  period: Array<XMLPeriod>;
  person: Array<XMLPerson>;
  propertyVariable: Array<XMLPropertyVariable>;
  variable: Array<XMLPropertyVariable>;
  propertyValue: Array<XMLPropertyValue>;
  value: Array<XMLPropertyValue>;
  resource: Array<XMLResource>;
  text: Array<XMLText>;
  set: Array<XMLSet>;
}>;

export type XMLItemLinksData = {
  result: { ochre: { payload?: string; items?: XMLItemLinks } };
};

export type XMLGallery = {
  payload?: string;
  project: {
    uuid?: string;
    identification: XMLIdentification;
    dateFormat?: string;
    page?: "item" | "entry";
  };
  item: {
    uuid?: string;
    identification: XMLIdentification;
    category?: XMLItemCategory;
    type?: string;
    maxLength?: XMLNumber;
  };
  resource?: Array<XMLResource>;
  maxLength: XMLNumber;
};

export type XMLGalleryData = { result: { ochre: { gallery: XMLGallery } } };

export type XMLSetItems = XMLItemLinks & {
  totalCount: XMLNumber;
  page: XMLNumber;
  pageSize: XMLNumber;
};

export type XMLSetItemsData = { result: { ochre: { items: XMLSetItems } } };

export type XMLData = {
  result: {
    ochre: {
      uuid: string;
      belongsTo: string;
      uuidBelongsTo: string;
      publicationDateTime: Date;
      metadata: XMLMetadata;
      persistentUrl?: string;
      languages?: string;
    } & XMLDataItem;
  };
};

export type XMLWebsiteData = {
  result: {
    ochre: {
      uuid: string;
      belongsTo: string;
      uuidBelongsTo: string;
      publicationDateTime: Date;
      metadata: XMLMetadata;
      persistentUrl?: string;
      languages?: string;
      tree: Array<XMLWebsiteTree>;
    };
  };
};
