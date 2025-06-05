/* eslint-disable ts/no-use-before-define */
import type {
  XMLBibliography as XMLBibliographyType,
  XMLBoolean as XMLBooleanType,
  XMLConcept as XMLConceptType,
  XMLContextItem as XMLContextItemType,
  XMLContext as XMLContextType,
  XMLContextValue as XMLContextValueType,
  XMLCoordinatesSource as XMLCoordinatesSourceType,
  XMLCoordinates as XMLCoordinatesType,
  XMLDataItem as XMLDataItemType,
  XMLData as XMLDataType,
  XMLEvent as XMLEventType,
  XMLHeading as XMLHeadingType,
  XMLIdentification as XMLIdentificationType,
  XMLImageMapArea as XMLImageMapAreaType,
  XMLImageMap as XMLImageMapType,
  XMLImage as XMLImageType,
  XMLInterpretation as XMLInterpretationType,
  XMLLicense as XMLLicenseType,
  XMLLink as XMLLinkType,
  XMLMetadata as XMLMetadataType,
  XMLNote as XMLNoteType,
  XMLNumber as XMLNumberType,
  XMLObservation as XMLObservationType,
  XMLPeriod as XMLPeriodType,
  XMLPerson as XMLPersonType,
  XMLProperty as XMLPropertyType,
  XMLPropertyValue as XMLPropertyValueType,
  XMLPropertyVariable as XMLPropertyVariableType,
  XMLResource as XMLResourceType,
  XMLSet as XMLSetType,
  XMLSpatialUnit as XMLSpatialUnitType,
  XMLString as XMLStringType,
  XMLText as XMLTextType,
  XMLTree as XMLTreeType,
} from "./xml.types.js";
import * as v from "valibot";

// Custom datetime validation for format "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DDTHH:mm:ss"
function customDateTime(message?: string) {
  return v.union([
    v.pipe(v.string(), v.isoDate()),
    v.pipe(
      v.string(),
      v.regex(
        /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/,
        message ??
          "Invalid datetime format. Expected YYYY-MM-DD HH:mm:ss or YYYY-MM-DDTHH:mm:ss",
      ),
    ),
  ]);
}

const CATEGORIES = [
  "tree",
  "bibliography",
  "spatialUnit",
  "concept",
  "period",
  "person",
  "propertyValue",
  "propertyVariable",
  "resource",
  "set",
] as const;

const XMLDataCategory = v.picklist(CATEGORIES);

const XMLHeadingDataCategory = v.picklist(
  CATEGORIES.filter(
    (category) =>
      category !== "tree" &&
      category !== "bibliography" &&
      category !== "spatialUnit" &&
      category !== "concept" &&
      category !== "period",
  ),
);

const XMLNonRecursiveDataCategory = v.picklist(
  CATEGORIES.filter(
    (category) =>
      category !== "tree" &&
      category !== "person" &&
      category !== "propertyValue" &&
      category !== "propertyVariable" &&
      category !== "set",
  ),
);

const XMLText: v.GenericSchema<XMLTextType> = v.object(
  {
    text: v.optional(v.string("XMLText: text is string and required")),
    rend: v.optional(v.string("XMLText: rend is string and optional")),
    whitespace: v.optional(
      v.string("XMLText: whitespace is string and optional"),
    ),
  },
  "XMLText: Shape error",
);

const XMLString: v.GenericSchema<XMLStringType> = v.object(
  {
    string: v.union([
      v.array(XMLText, "XMLString: string is array of XMLText"),
      v.array(
        v.object({
          links: v.array(
            v.lazy(() => XMLLink),
            "XMLString: links is array of XMLLink",
          ),
          properties: v.optional(
            v.object({
              property: v.array(
                v.lazy(() => XMLProperty),
                "XMLString: properties is array of XMLProperty",
              ),
            }),
          ),
          string: v.optional(
            v.array(XMLText, "XMLString: string is array of XMLText"),
          ),
          annotation: v.string("XMLString: annotation is string and required"),
        }),
      ),
    ]),
    rend: v.optional(v.string("XMLString: rend is string and optional")),
    whitespace: v.optional(
      v.string("XMLString: whitespace is string and optional"),
    ),
  },
  "XMLString: Shape error",
);

const XMLContent = v.object(
  {
    content: v.array(
      v.object({
        string: v.array(
          v.union(
            [
              XMLText,
              XMLString,
              v.object({
                whitespace: v.string(
                  "XMLContent: whitespace is string and required",
                ),
              }),
            ],
            "XMLContent: string is array of XMLText, XMLString, or whitespace",
          ),
          "XMLContent: string is array of XMLText, XMLString, or whitespace",
        ),
        title: v.optional(v.string("XMLContent: title is string and optional")),
        lang: v.string("XMLContent: lang is string and required"),
      }),
      "XMLContent: content is array of object with string and lang",
    ),
  },
  "XMLContent: Shape error",
);

const XMLNumber: v.GenericSchema<XMLNumberType> = v.pipe(
  v.string("XMLNumber: string is string and required"),
  v.check(
    (val) => !Number.isNaN(Number(val)),
    "XMLNumber: string is not a number",
  ),
);

const XMLBoolean: v.GenericSchema<XMLBooleanType> = v.pipe(
  v.string("XMLBoolean: string is string and required"),
  v.check(
    (val) => val === "true" || val === "false",
    "XMLBoolean: string is not a boolean",
  ),
);

const XMLIdentification: v.GenericSchema<XMLIdentificationType> = v.object(
  {
    label: v.union([XMLText, XMLContent]),
    abbreviation: v.optional(v.union([XMLText, XMLContent])),
    email: v.optional(
      v.string("XMLIdentification: email is string and optional"),
    ),
    website: v.optional(
      v.object({
        text: v.string("XMLIdentification: website is string and optional"),
      }),
    ),
  },
  "XMLIdentification: Shape error",
);

const XMLMetadata: v.GenericSchema<XMLMetadataType> = v.object({
  dataset: XMLText,
  description: XMLText,
  publisher: XMLText,
  identifier: XMLText,
  language: v.optional(
    v.array(
      v.object(
        {
          text: v.pipe(
            v.string("XMLMetadata: language is string and required"),
            v.length(3),
          ),
          default: v.optional(
            v.literal("true", "XMLMetadata: default is true"),
          ),
        },
        "XMLMetadata: language is array of object with text and default",
      ),
      "XMLMetadata: language is array of object with text and default",
    ),
  ),
  project: v.optional(
    v.object(
      { identification: XMLIdentification },
      "XMLMetadata: project is object with identification",
    ),
  ),
  item: v.optional(
    v.object(
      {
        identification: XMLIdentification,
        category: XMLDataCategory,
        type: v.string("XMLMetadata: type is string and required"),
        maxLength: v.optional(XMLNumber),
      },
      "XMLMetadata: item is object with identification, category, type, and maxLength",
    ),
  ),
});

const XMLLicense: v.GenericSchema<XMLLicenseType> = v.object(
  {
    text: v.string("XMLLicense: text is string and required"),
    target: v.optional(
      v.pipe(
        v.string("XMLLicense: target is string and optional"),
        v.url("XMLLicense: target is not a valid URL"),
      ),
    ),
  },
  "XMLLicense: Shape error",
);

const XMLContextValue: v.GenericSchema<XMLContextValueType> = v.object(
  {
    uuid: v.pipe(
      v.string("XMLContextValue: uuid is string and required"),
      v.uuid("XMLContextValue: uuid is not a valid UUID"),
    ),
    publicationDateTime: v.optional(
      customDateTime(
        "XMLContextValue: publicationDateTime is not a valid datetime",
      ),
    ),
    n: XMLNumber,
    text: v.string("XMLContextValue: text is string and required"),
  },
  "XMLContextValue: Shape error",
);

const XMLContextItem: v.GenericSchema<XMLContextItemType> = v.objectWithRest(
  {
    project: XMLContextValue,
    tree: v.array(XMLContextValue),
    displayPath: v.string("XMLContextItem: displayPath is string and required"),
  },
  v.array(XMLContextValue),
  "XMLContextItem: Shape error",
);

const XMLContext: v.GenericSchema<XMLContextType> = v.array(
  v.object(
    {
      context: v.array(
        XMLContextItem,
        "XMLContext: context is array of XMLContextItem",
      ),
      displayPath: v.string("XMLContext: displayPath is string and required"),
    },
    "XMLContext: Shape error",
  ),
);

const XMLEvent: v.GenericSchema<XMLEventType> = v.object(
  {
    dateTime: v.optional(
      customDateTime("XMLEvent: dateTime is not a valid datetime"),
    ),
    agent: v.optional(
      v.object(
        {
          uuid: v.pipe(
            v.string("XMLEvent: uuid is string and required"),
            v.uuid("XMLEvent: uuid is not a valid UUID"),
          ),
          text: v.string("XMLEvent: text is string and required"),
        },
        "XMLEvent: agent is object with uuid and text",
      ),
    ),
    comment: v.optional(XMLText),
    label: XMLContent,
  },
  "XMLEvent: Shape error",
);

const XMLCoordinatesSource: v.GenericSchema<XMLCoordinatesSourceType> =
  v.variant("context", [
    v.object(
      {
        context: v.literal("self", "XMLCoordinatesSource: context is self"),
        label: v.object(
          {
            ...XMLContent.entries,
            uuid: v.pipe(
              v.string("XMLCoordinatesSource: uuid is string and required"),
              v.uuid("XMLCoordinatesSource: uuid is not a valid UUID"),
            ),
          },
          "XMLCoordinatesSource: Shape error",
        ),
      },
      "XMLCoordinatesSource: Shape error",
    ),
    v.object(
      {
        context: v.literal(
          "related",
          "XMLCoordinatesSource: context is related",
        ),
        label: v.object(
          {
            ...XMLContent.entries,
            uuid: v.pipe(
              v.string("XMLCoordinatesSource: uuid is string and required"),
              v.uuid("XMLCoordinatesSource: uuid is not a valid UUID"),
            ),
          },
          "XMLCoordinatesSource: Shape error",
        ),
        value: v.object(
          {
            ...XMLContent.entries,
            uuid: v.pipe(
              v.string("XMLCoordinatesSource: uuid is string and required"),
              v.uuid("XMLCoordinatesSource: uuid is not a valid UUID"),
            ),
          },
          "XMLCoordinatesSource: Shape error",
        ),
      },
      "XMLCoordinatesSource: Shape error",
    ),
    v.object(
      {
        context: v.literal(
          "inherited",
          "XMLCoordinatesSource: context is inherited",
        ),
        label: v.object(
          {
            ...XMLContent.entries,
            uuid: v.pipe(
              v.string("XMLCoordinatesSource: uuid is string and required"),
              v.uuid("XMLCoordinatesSource: uuid is not a valid UUID"),
            ),
          },
          "XMLCoordinatesSource: Shape error",
        ),
        item: v.object(
          {
            label: v.object(
              {
                ...XMLContent.entries,
                uuid: v.pipe(
                  v.string("XMLCoordinatesSource: uuid is string and required"),
                  v.uuid("XMLCoordinatesSource: uuid is not a valid UUID"),
                ),
              },
              "XMLCoordinatesSource: Shape error",
            ),
          },
          "XMLCoordinatesSource: Shape error",
        ),
      },
      "XMLCoordinatesSource: Shape error",
    ),
  ]);

const XMLCoordinates: v.GenericSchema<XMLCoordinatesType> = v.variant(
  "type",
  [
    v.object(
      {
        type: v.literal("point", "XMLCoordinates: type is point"),
        latitude: XMLNumber,
        longitude: XMLNumber,
        altitude: v.optional(XMLNumber, "XMLCoordinates: altitude is optional"),
        source: XMLCoordinatesSource,
      },
      "XMLCoordinates: Shape error",
    ),
    v.object(
      {
        type: v.literal("plane", "XMLCoordinates: type is plane"),
        minimum: v.object(
          { latitude: XMLNumber, longitude: XMLNumber },
          "XMLCoordinates: minimum is object with latitude and longitude",
        ),
        maximum: v.object(
          { latitude: XMLNumber, longitude: XMLNumber },
          "XMLCoordinates: maximum is object with latitude and longitude",
        ),
        source: XMLCoordinatesSource,
      },
      "XMLCoordinates: Shape error",
    ),
  ],
  "XMLCoordinates: Shape error",
);

const XMLImage: v.GenericSchema<XMLImageType> = v.object(
  {
    publicationDateTime: v.optional(
      customDateTime("XMLImage: publicationDateTime is not a valid datetime"),
    ),
    identification: v.optional(XMLIdentification),
    href: v.optional(
      v.pipe(
        v.string("XMLImage: href is string and optional"),
        v.url("XMLImage: href is not a valid URL"),
      ),
    ),
    htmlImgSrcPrefix: v.optional(
      v.string("XMLImage: htmlImgSrcPrefix is string and optional"),
    ),
    content: v.optional(v.string("XMLImage: content is string and optional")),
    height: v.optional(XMLNumber, "XMLImage: height is optional"),
    width: v.optional(XMLNumber, "XMLImage: width is optional"),
    heightPreview: v.optional(XMLNumber, "XMLImage: heightPreview is optional"),
    widthPreview: v.optional(XMLNumber, "XMLImage: widthPreview is optional"),
  },
  "XMLImage: Shape error",
);

const XMLLink: v.GenericSchema<XMLLinkType> = v.record(
  XMLDataCategory,
  v.array(
    v.object(
      {
        uuid: v.pipe(
          v.string("XMLLink: uuid is string and required"),
          v.uuid("XMLLink: uuid is not a valid UUID"),
        ),
        publicationDateTime: v.optional(
          customDateTime(
            "XMLLink: publicationDateTime is not a valid datetime",
          ),
        ),
        identification: v.optional(XMLIdentification),
        type: v.optional(v.string("XMLLink: type is string and optional")),
        rend: v.optional(v.literal("inline", "XMLLink: rend is inline")),
        content: v.optional(
          v.string("XMLLink: content is string and optional"),
        ),
        isPrimary: v.optional(XMLBoolean),
        image: v.optional(XMLImage),
        href: v.optional(
          v.pipe(
            v.string("XMLLink: href is string and optional"),
            v.url("XMLLink: href is not a valid URL"),
          ),
        ),
      },
      "XMLLink: Shape error",
    ),
  ),
  "XMLLink: Shape error",
);

const XMLImageMapArea: v.GenericSchema<XMLImageMapAreaType> = v.object(
  {
    uuid: v.pipe(
      v.string("XMLImageMapArea: uuid is string and required"),
      v.uuid("XMLImageMapArea: uuid is not a valid UUID"),
    ),
    publicationDateTime: customDateTime(
      "XMLImageMapArea: publicationDateTime is not a valid datetime",
    ),
    type: v.string("XMLImageMapArea: type is string and required"),
    title: v.string("XMLImageMapArea: title is string and required"),
    shape: v.string("XMLImageMapArea: shape is string and required"),
    coords: v.string("XMLImageMapArea: coords is string and required"),
  },
  "XMLImageMapArea: Shape error",
);

const XMLImageMap: v.GenericSchema<XMLImageMapType> = v.object(
  {
    area: v.array(
      XMLImageMapArea,
      "XMLImageMap: area is array of XMLImageMapArea",
    ),
    width: XMLNumber,
    height: XMLNumber,
  },
  "XMLImageMap: Shape error",
);

const XMLNote: v.GenericSchema<XMLNoteType> = v.object(
  {
    note: v.array(
      v.union([
        v.object(
          {
            ...XMLContent.entries,
            noteNo: XMLNumber,
            authors: v.optional(
              v.object(
                { author: v.array(v.lazy(() => XMLPerson)) },
                "XMLNote: authors is object with author array of XMLPerson",
              ),
            ),
          },
          "XMLNote: note is array of object with noteNo and authors",
        ),
        XMLText,
      ]),
      "XMLNote: note is array of object with noteNo and authors or XMLText",
    ),
    rend: v.optional(v.string("XMLNote: rend is string and optional")),
  },
  "XMLNote: Shape error",
);

const XMLProperty: v.GenericSchema<XMLPropertyType> = v.lazy(() =>
  v.object(
    {
      label: v.object(
        {
          ...XMLContent.entries,
          uuid: v.pipe(
            v.string("XMLProperty: uuid is string and required"),
            v.uuid("XMLProperty: uuid is not a valid UUID"),
          ),
          publicationDateTime: v.optional(
            customDateTime(
              "XMLProperty: publicationDateTime is not a valid datetime",
            ),
          ),
        },
        "XMLProperty: label is object with uuid",
      ),
      value: v.optional(
        v.array(
          v.object({
            ...v.partial(XMLContent).entries,
            uuid: v.optional(
              v.pipe(
                v.string("XMLProperty: uuid is string and optional"),
                v.uuid("XMLProperty: uuid is not a valid UUID"),
              ),
            ),
            publicationDateTime: v.optional(
              customDateTime(
                "XMLProperty: publicationDateTime is not a valid datetime",
              ),
            ),
            type: v.optional(
              v.string("XMLProperty: type is string and optional"),
            ),
            category: v.optional(
              v.string("XMLProperty: category is string and optional"),
            ),
            slug: v.optional(
              v.string("XMLProperty: slug is string and optional"),
            ),
            unit: v.optional(
              v.string("XMLProperty: unit is string and optional"),
            ),
            booleanValue: v.optional(
              v.string("XMLProperty: booleanValue is string and optional"),
            ),
            isUncertain: v.optional(
              v.literal("true", "XMLProperty: isUncertain is true"),
            ),
          }),
          "XMLProperty: value is array of objects with text",
        ),
      ),
      comment: v.optional(
        v.string("XMLProperty: comment is string and optional"),
      ),
      properties: v.optional(
        v.object(
          { property: v.array(XMLProperty) },
          "XMLProperty: properties is object with property array of XMLProperty",
        ),
      ),
    },
    "XMLProperty: Shape error",
  ),
);

const XMLBaseItem = v.object(
  {
    uuid: v.pipe(
      v.string("XMLBaseItem: uuid is string and required"),
      v.uuid("XMLBaseItem: uuid is not a valid UUID"),
    ),
    publicationDateTime: v.optional(
      customDateTime(
        "XMLBaseItem: publicationDateTime is not a valid datetime",
      ),
    ),
    date: v.optional(customDateTime()),
    availability: v.optional(v.object({ license: XMLLicense })),
    identification: XMLIdentification,
    context: v.optional(XMLContext),
    creators: v.optional(
      v.object(
        { creator: v.array(v.lazy(() => XMLPerson)) },
        "XMLBaseItem: creators is object with creator array of XMLPerson",
      ),
    ),
    description: v.optional(XMLContent),
    events: v.optional(
      v.object(
        { event: v.array(XMLEvent) },
        "XMLBaseItem: events is object with event array of XMLEvent",
      ),
    ),
  },
  "XMLBaseItem: Shape error",
);

const XMLHeading: v.GenericSchema<XMLHeadingType> = v.intersect([
  v.object(
    {
      name: v.string("XMLHeading: name is string and required"),
      abbreviation: v.optional(
        v.string("XMLHeading: abbreviation is string and optional"),
      ),
      heading: v.optional(v.array(v.lazy(() => XMLHeading))),
    },
    "XMLHeading: Shape error",
  ),
  v.union([
    v.object({ person: v.optional(v.array(v.lazy(() => XMLPerson))) }),
    v.object({
      propertyValue: v.optional(v.array(v.lazy(() => XMLPropertyValue))),
    }),
    v.object({
      propertyVariable: v.optional(v.array(v.lazy(() => XMLPropertyVariable))),
    }),
    v.object({ resource: v.optional(v.array(v.lazy(() => XMLResource))) }),
    v.object({ set: v.optional(v.array(v.lazy(() => XMLSet))) }),
  ]),
]);

const XMLTree: v.GenericSchema<XMLTreeType> = v.object(
  {
    ...XMLBaseItem.entries,
    date: v.optional(customDateTime("XMLTree: date is not a valid datetime")),
    links: v.optional(v.array(XMLLink)),
    notes: v.optional(XMLNote),
    properties: v.optional(v.object({ property: v.array(XMLProperty) })),
    items: v.optional(
      v.union([
        v.object({ heading: v.optional(v.array(v.lazy(() => XMLHeading))) }),
        v.object({
          bibliography: v.optional(v.array(v.lazy(() => XMLBibliography))),
        }),
        v.object({ concept: v.optional(v.array(v.lazy(() => XMLConcept))) }),
        v.object({
          spatialUnit: v.optional(v.array(v.lazy(() => XMLSpatialUnit))),
        }),
        v.object({ period: v.optional(v.array(v.lazy(() => XMLPeriod))) }),
        v.object({ person: v.optional(v.array(v.lazy(() => XMLPerson))) }),
        v.object({
          propertyValue: v.optional(v.array(v.lazy(() => XMLPropertyValue))),
        }),
        v.object({
          propertyVariable: v.optional(
            v.array(v.lazy(() => XMLPropertyVariable)),
          ),
        }),
        v.object({ resource: v.optional(v.array(v.lazy(() => XMLResource))) }),
        v.object({ set: v.optional(v.array(v.lazy(() => XMLSet))) }),
      ]),
    ),
  },
  "XMLTree: Shape error",
);

const XMLSet: v.GenericSchema<XMLSetType> = v.object(
  {
    ...XMLBaseItem.entries,
    type: v.optional(v.string("XMLSet: type is string and optional")),
    suppressBlanks: v.optional(XMLBoolean),
    tabularStructure: v.optional(XMLBoolean),
    links: v.optional(v.array(XMLLink)),
    notes: v.optional(XMLNote),
    properties: v.optional(v.object({ property: v.array(XMLProperty) })),
    items: v.optional(
      v.union([
        v.object({ tree: v.optional(v.array(v.lazy(() => XMLTree))) }),
        v.object({
          bibliography: v.optional(v.array(v.lazy(() => XMLBibliography))),
        }),
        v.object({ concept: v.optional(v.array(v.lazy(() => XMLConcept))) }),
        v.object({
          spatialUnit: v.optional(v.array(v.lazy(() => XMLSpatialUnit))),
        }),
        v.object({ period: v.optional(v.array(v.lazy(() => XMLPeriod))) }),
        v.object({ person: v.optional(v.array(v.lazy(() => XMLPerson))) }),
        v.object({
          propertyValue: v.optional(v.array(v.lazy(() => XMLPropertyValue))),
        }),
        v.object({
          propertyVariable: v.optional(
            v.array(v.lazy(() => XMLPropertyVariable)),
          ),
        }),
        v.object({ resource: v.optional(v.array(v.lazy(() => XMLResource))) }),
        v.object({ set: v.optional(v.array(v.lazy(() => XMLSet))) }),
      ]),
    ),
  },
  "XMLSet: Shape error",
);

const XMLBibliography: v.GenericSchema<XMLBibliographyType> = v.object(
  {
    ...XMLBaseItem.entries,
    type: v.optional(v.string("XMLBibliography: type is string and optional")),
    project: v.optional(v.object({ identification: XMLIdentification })),
    ZoteroID: v.optional(
      v.string("XMLBibliography: ZoteroID is string and optional"),
    ),
    sourceDocument: v.optional(
      v.object(
        {
          uuid: v.pipe(
            v.string("XMLBibliography: uuid is string and required"),
            v.uuid("XMLBibliography: uuid is not a valid UUID"),
          ),
          text: v.string("XMLBibliography: text is string and required"),
        },
        "XMLBibliography: sourceDocument is object with uuid and text",
      ),
    ),
    publicationInfo: v.optional(
      v.object(
        {
          publishers: v.optional(
            v.object({ publisher: v.array(v.lazy(() => XMLPerson)) }),
          ),
          startDate: v.optional(
            v.object({ month: XMLNumber, year: XMLNumber, day: XMLNumber }),
          ),
        },
        "XMLBibliography: publicationInfo is object with publishers and startDate",
      ),
    ),
    entryInfo: v.optional(
      v.object(
        {
          startIssue: v.string(
            "XMLBibliography: startIssue is string and required",
          ),
          startVolume: v.string(
            "XMLBibliography: startVolume is string and required",
          ),
        },
        "XMLBibliography: entryInfo is object with startIssue and startVolume",
      ),
    ),
    citationFormat: v.optional(XMLText),
    citationFormatSpan: v.optional(XMLText),
    referenceFormatDiv: v.optional(XMLText),
    source: v.optional(
      v.object(
        {
          resource: v.object(
            {
              uuid: v.pipe(
                v.string(
                  "XMLBibliography: resource uuid is string and required",
                ),
                v.uuid("XMLBibliography: resource uuid is not a valid UUID"),
              ),
              type: v.string(
                "XMLBibliography: resource type is string and required",
              ),
              publicationDateTime: v.optional(
                customDateTime(
                  "XMLBibliography: resource publicationDateTime is not a valid datetime",
                ),
              ),
              identification: XMLIdentification,
            },
            "XMLBibliography: source is object with resource",
          ),
        },
        "XMLBibliography: source is object with resource",
      ),
    ),
    authors: v.optional(v.object({ person: v.array(v.lazy(() => XMLPerson)) })),
    periods: v.optional(v.object({ period: v.array(v.lazy(() => XMLPeriod)) })),
    links: v.optional(v.array(XMLLink)),
    notes: v.optional(XMLNote),
    properties: v.optional(v.object({ property: v.array(XMLProperty) })),
    citedBibliography: v.optional(
      v.object({ reference: v.array(v.lazy(() => XMLBibliography)) }),
    ),
    bibliography: v.optional(v.array(v.lazy(() => XMLBibliography))),
  },
  "XMLBibliography: Shape error",
);

const XMLInterpretation: v.GenericSchema<XMLInterpretationType> = v.object(
  {
    interpretationNo: XMLNumber,
    date: v.optional(
      customDateTime("XMLInterpretation: date is not a valid datetime"),
    ),
    observers: v.optional(
      v.object({ observer: v.array(v.lazy(() => XMLPerson)) }),
    ),
    periods: v.optional(v.object({ period: v.array(v.lazy(() => XMLPeriod)) })),
    links: v.optional(v.array(XMLLink)),
    notes: v.optional(XMLNote),
    properties: v.optional(v.object({ property: v.array(XMLProperty) })),
    citedBibliography: v.optional(
      v.object({ reference: v.array(XMLBibliography) }),
    ),
  },
  "XMLInterpretation: Shape error",
);

const XMLConcept: v.GenericSchema<XMLConceptType> = v.object(
  {
    ...XMLBaseItem.entries,
    interpretations: v.optional(
      v.object({ interpretation: v.array(XMLInterpretation) }),
    ),
    coordinates: v.optional(XMLCoordinates),
    concept: v.optional(v.array(v.lazy(() => XMLConcept))),
  },
  "XMLConcept: Shape error",
);

const XMLObservation: v.GenericSchema<XMLObservationType> = v.object(
  {
    observationNo: XMLNumber,
    date: v.optional(
      customDateTime("XMLObservation: date is not a valid datetime"),
    ),
    observers: v.optional(
      v.object({ observer: v.array(v.lazy(() => XMLPerson)) }),
    ),
    periods: v.optional(v.object({ period: v.array(v.lazy(() => XMLPeriod)) })),
    links: v.optional(v.array(XMLLink)),
    notes: v.optional(XMLNote),
    properties: v.optional(v.object({ property: v.array(XMLProperty) })),
    citedBibliography: v.optional(
      v.object({ reference: v.array(XMLBibliography) }),
    ),
  },
  "XMLObservation: Shape error",
);

const XMLSpatialUnit: v.GenericSchema<XMLSpatialUnitType> = v.object(
  {
    ...XMLBaseItem.entries,
    image: v.optional(XMLImage),
    coordinates: v.optional(XMLCoordinates),
    mapData: v.optional(
      v.object(
        {
          geoJSON: v.object({
            multiPolygon: v.string(
              "XMLSpatialUnit: multiPolygon is string and required",
            ),
            EPSG: XMLNumber,
          }),
        },
        "XMLSpatialUnit: mapData is object with geoJSON",
      ),
    ),
    observations: v.optional(
      v.object({ observation: v.array(XMLObservation) }),
    ),
    citedBibliography: v.optional(
      v.object({ reference: v.array(XMLBibliography) }),
    ),
    spatialUnit: v.optional(v.array(v.lazy(() => XMLSpatialUnit))),
  },
  "XMLSpatialUnit: Shape error",
);

const XMLPeriod: v.GenericSchema<XMLPeriodType> = v.object(
  {
    ...XMLBaseItem.entries,
    type: v.optional(v.string("XMLPeriod: type is string and optional")),
    links: v.optional(v.array(XMLLink)),
    notes: v.optional(XMLNote),
    properties: v.optional(v.object({ property: v.array(XMLProperty) })),
    citedBibliography: v.optional(
      v.object({ reference: v.array(XMLBibliography) }),
    ),
    period: v.optional(v.array(v.lazy(() => XMLPeriod))),
  },
  "XMLPeriod: Shape error",
);

const XMLPerson: v.GenericSchema<XMLPersonType> = v.object(
  {
    ...XMLBaseItem.entries,
    ...XMLContent.entries,
    type: v.optional(v.string("XMLPerson: type is string and optional")),
    address: v.optional(
      v.object(
        {
          country: v.optional(
            v.string("XMLPerson: country is string and optional"),
          ),
          city: v.optional(v.string("XMLPerson: city is string and optional")),
          state: v.optional(
            v.string("XMLPerson: state is string and optional"),
          ),
        },
        "XMLPerson: address is object with country, city, and state",
      ),
    ),
    coordinates: v.optional(XMLCoordinates),
    periods: v.optional(v.object({ period: v.array(XMLPeriod) })),
    links: v.optional(v.array(XMLLink)),
    notes: v.optional(XMLNote),
    properties: v.optional(v.object({ property: v.array(XMLProperty) })),
  },
  "XMLPerson: Shape error",
);

const XMLPropertyValue: v.GenericSchema<XMLPropertyValueType> = v.object(
  {
    ...XMLBaseItem.entries,
    coordinates: v.optional(XMLCoordinates),
    links: v.optional(v.array(XMLLink)),
    notes: v.optional(XMLNote),
    properties: v.optional(v.object({ property: v.array(XMLProperty) })),
    citedBibliography: v.optional(
      v.object({ reference: v.array(XMLBibliography) }),
    ),
  },
  "XMLPropertyValue: Shape error",
);

const XMLPropertyVariable: v.GenericSchema<XMLPropertyVariableType> = v.object(
  {
    ...XMLBaseItem.entries,
    type: v.optional(
      v.string("XMLPropertyVariable: type is string and optional"),
    ),
    coordinates: v.optional(XMLCoordinates),
    links: v.optional(v.array(XMLLink)),
    notes: v.optional(XMLNote),
    citedBibliography: v.optional(
      v.object({ reference: v.array(XMLBibliography) }),
    ),
  },
  "XMLPropertyVariable: Shape error",
);

const XMLResource: v.GenericSchema<XMLResourceType> = v.object(
  {
    ...XMLBaseItem.entries,
    type: v.optional(v.string("XMLResource: type is string and optional")),
    date: v.optional(
      customDateTime("XMLResource: date is not a valid datetime"),
    ),
    href: v.optional(
      v.pipe(
        v.string("XMLResource: href is string and optional"),
        v.url("XMLResource: href is not a valid URL"),
      ),
    ),
    fileFormat: v.optional(
      v.string("XMLResource: fileFormat is string and optional"),
    ),
    image: v.optional(XMLImage),
    imagemap: v.optional(XMLImageMap),
    document: v.optional(XMLContent),
    coordinates: v.optional(XMLCoordinates),
    periods: v.optional(v.object({ period: v.array(XMLPeriod) })),
    links: v.optional(v.array(XMLLink)),
    reverseLinks: v.optional(v.array(v.lazy(() => XMLDataItem))),
    notes: v.optional(XMLNote),
    properties: v.optional(v.object({ property: v.array(XMLProperty) })),
    citedBibliography: v.optional(
      v.object({ reference: v.array(XMLBibliography) }),
    ),
    resource: v.optional(v.array(v.lazy(() => XMLResource))),
  },
  "XMLResource: Shape error",
);

export const XMLDataItem: v.GenericSchema<XMLDataItemType> = v.union(
  [
    v.object(
      { tree: v.array(XMLTree) },
      "XMLDataItem: tree is array of XMLTree",
    ),
    v.object(
      { bibliography: v.array(XMLBibliography) },
      "XMLDataItem: bibliography is array of XMLBibliography",
    ),
    v.object(
      { concept: v.array(XMLConcept) },
      "XMLDataItem: concept is array of XMLConcept",
    ),
    v.object(
      { spatialUnit: v.array(XMLSpatialUnit) },
      "XMLDataItem: spatialUnit is array of XMLSpatialUnit",
    ),
    v.object(
      { period: v.array(XMLPeriod) },
      "XMLDataItem: period is array of XMLPeriod",
    ),
    v.object(
      { person: v.array(XMLPerson) },
      "XMLDataItem: person is array of XMLPerson",
    ),
    v.object(
      { propertyValue: v.array(XMLPropertyValue) },
      "XMLDataItem: propertyValue is array of XMLPropertyValue",
    ),
    v.object(
      { propertyVariable: v.array(XMLPropertyVariable) },
      "XMLDataItem: propertyVariable is array of XMLPropertyVariable",
    ),
    v.object(
      { resource: v.array(XMLResource) },
      "XMLDataItem: resource is array of XMLResource",
    ),
    v.object({ set: v.array(XMLSet) }, "XMLDataItem: set is array of XMLSet"),
  ],
  "XMLDataItem: Shape error",
);

export const XMLData: v.GenericSchema<XMLDataType> = v.object(
  {
    ochre: v.intersect([
      v.object(
        {
          uuid: v.pipe(
            v.string("XMLData: uuid is string and required"),
            v.uuid("XMLData: uuid is not a valid UUID"),
          ),
          belongsTo: v.string("XMLData: belongsTo is string and required"),
          uuidBelongsTo: v.pipe(
            v.string("XMLData: uuidBelongsTo is string and required"),
            v.uuid("XMLData: uuidBelongsTo is not a valid UUID"),
          ),
          publicationDateTime: customDateTime(
            "XMLData: publicationDateTime is not a valid datetime",
          ),
          metadata: XMLMetadata,
          languages: v.optional(
            v.pipe(
              v.string("XMLData: languages is string and optional"),
              v.check((val) =>
                val
                  .split(";")
                  .every(
                    (lang) =>
                      lang.length === 3 &&
                      lang === lang.toLocaleLowerCase("en-US"),
                  ),
              ),
            ),
          ),
        },
        "XMLData: ochre is object with uuid, belongsTo, uuidBelongsTo, publicationDateTime, metadata, and languages",
      ),
      XMLDataItem,
    ]),
  },
  "XMLData: Shape error",
);
