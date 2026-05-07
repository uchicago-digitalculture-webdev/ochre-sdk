/* eslint-disable ts/no-use-before-define */
import * as v from "valibot";
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
  XMLSimplifiedProperty as XMLSimplifiedPropertyType,
  XMLSpatialUnit as XMLSpatialUnitType,
  XMLString as XMLStringType,
  XMLText as XMLTextType,
  XMLTree as XMLTreeType,
} from "#/types/xml/types.js";
import { isPseudoUuid } from "#/utils.js";

const DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/;

// Custom datetime validation for format "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DDTHH:mm:ss"
function customDateTime(message?: string) {
  return v.union([
    v.pipe(v.string(), v.isoDate()),
    v.pipe(v.string(), v.isoDateTime()),
    v.pipe(v.string(), v.isoTimestamp()),
    v.pipe(
      v.string(),
      v.regex(
        DATETIME_REGEX,
        message ??
          "Invalid datetime format. Expected YYYY-MM-DD HH:mm:ss or YYYY-MM-DDTHH:mm:ss",
      ),
    ),
  ]);
}

const DATA_CATEGORIES = [
  "tree",
  "bibliography",
  "spatialUnit",
  "concept",
  "period",
  "person",
  "propertyVariable",
  "variable",
  "propertyValue",
  "resource",
  "text",
  "set",
] as const;

const XMLDataCategory = v.picklist(DATA_CATEGORIES);

const XMLString: v.GenericSchema<XMLStringType> = v.object(
  {
    payload: v.optional(v.string("XMLString: payload is string and optional")),
    rend: v.optional(v.string("XMLString: rend is string and optional")),
    whitespace: v.optional(
      v.string("XMLString: whitespace is string and optional"),
    ),
    string: v.optional(
      v.array(
        v.object({
          links: v.optional(v.lazy(() => XMLLink)),
          properties: v.optional(
            v.object({
              property: v.array(
                v.lazy(() => XMLProperty),
                "XMLString: properties is array of XMLProperty",
              ),
            }),
          ),
          string: v.optional(
            v.array(
              v.lazy(() => XMLString),
              "XMLString: string is array of XMLString",
            ),
          ),
          annotation: v.optional(
            v.string("XMLString: annotation is string and optional"),
          ),
          rend: v.optional(v.string("XMLString: rend is string and optional")),
          whitespace: v.optional(
            v.string("XMLString: whitespace is string and optional"),
          ),
        }),
      ),
    ),
  },
  "XMLString: Shape error",
);

const XMLContent = v.object(
  {
    content: v.array(
      v.object({
        string: v.array(XMLString),
        title: v.optional(v.string("XMLContent: title is string and optional")),
        lang: v.string("XMLContent: lang is string and required"),
      }),
      "XMLContent: content is array of object with string, title, and lang",
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
    label: v.union([XMLContent, XMLString]),
    abbreviation: v.optional(v.union([XMLContent, XMLString])),
    code: v.optional(
      v.union([
        XMLString,
        v.string("XMLIdentification: code is string and optional"),
      ]),
    ),
    email: v.optional(
      v.union([
        XMLString,
        v.string("XMLIdentification: email is string and optional"),
      ]),
    ),
    website: v.optional(
      v.union([
        XMLString,
        v.string("XMLIdentification: website is string and optional"),
      ]),
    ),
  },
  "XMLIdentification: Shape error",
);

const XMLMetadata: v.GenericSchema<XMLMetadataType> = v.object({
  dataset: XMLString,
  description: XMLString,
  publisher: v.union([XMLString, v.array(XMLString)]),
  identifier: XMLString,
  language: v.optional(
    v.array(
      v.object(
        {
          payload: v.string("XMLMetadata: language is string and required"),
          default: v.optional(
            v.literal("true", "XMLMetadata: default is true"),
          ),
        },
        "XMLMetadata: language is array of object with payload and default",
      ),
      "XMLMetadata: language is array of object with payload and default",
    ),
  ),
  project: v.optional(
    v.object(
      {
        uuid: v.optional(
          v.pipe(
            v.string("XMLMetadata: uuid is string and optional"),
            v.check(
              isPseudoUuid,
              "XMLMetadata: uuid is not a valid pseudo-UUID",
            ),
          ),
        ),
        identification: XMLIdentification,
        dateFormat: v.optional(
          v.string("XMLMetadata: dateFormat is string and optional"),
        ),
        page: v.optional(
          v.picklist(
            ["item", "entry"],
            "XMLMetadata: page is item or entry and optional",
          ),
        ),
      },
      "XMLMetadata: project is object with uuid and identification",
    ),
  ),
  collection: v.optional(
    v.object(
      {
        uuid: v.pipe(
          v.string("XMLMetadata: uuid is string and required"),
          v.check(isPseudoUuid, "XMLMetadata: uuid is not a valid pseudo-UUID"),
        ),
        identification: XMLIdentification,
        page: v.picklist(
          ["item", "entry"],
          "XMLMetadata: page is item or entry",
        ),
      },
      "XMLMetadata: collection is object with uuid, identification, and page",
    ),
  ),
  publication: v.optional(
    v.object(
      {
        uuid: v.pipe(
          v.string("XMLMetadata: uuid is string and required"),
          v.check(isPseudoUuid, "XMLMetadata: uuid is not a valid pseudo-UUID"),
        ),
        identification: XMLIdentification,
        page: v.picklist(
          ["item", "entry"],
          "XMLMetadata: page is item or entry and required",
        ),
      },
      "XMLMetadata: publication is object with uuid, identification, and page",
    ),
  ),
  item: v.optional(
    v.object(
      {
        uuid: v.optional(
          v.pipe(
            v.string("XMLMetadata: uuid is string and optional"),
            v.check(
              isPseudoUuid,
              "XMLMetadata: uuid is not a valid pseudo-UUID",
            ),
          ),
        ),
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
    payload: v.string("XMLLicense: payload is string and required"),
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
    uuid: v.optional(
      v.pipe(
        v.string("XMLContextValue: uuid is string and optional"),
        v.check(
          isPseudoUuid,
          "XMLContextValue: uuid is not a valid pseudo-UUID",
        ),
      ),
    ),
    publicationDateTime: v.optional(
      customDateTime(
        "XMLContextValue: publicationDateTime is not a valid datetime",
      ),
    ),
    n: XMLNumber,
    payload: v.string("XMLContextValue: payload is string and required"),
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
    endDateTime: v.optional(
      customDateTime("XMLEvent: endDateTime is not a valid datetime"),
    ),
    agent: v.optional(
      v.object(
        {
          ...XMLContent.entries,
          uuid: v.pipe(
            v.string("XMLEvent: uuid is string and required"),
            v.check(isPseudoUuid, "XMLEvent: uuid is not a valid pseudo-UUID"),
          ),
          publicationDateTime: v.optional(
            customDateTime(
              "XMLEvent: publicationDateTime is not a valid datetime",
            ),
          ),
        },
        "XMLEvent: agent is object with uuid and payload",
      ),
    ),
    location: v.optional(
      v.object(
        {
          ...XMLContent.entries,
          uuid: v.pipe(
            v.string("XMLEvent: uuid is string and required"),
            v.check(isPseudoUuid, "XMLEvent: uuid is not a valid pseudo-UUID"),
          ),
          publicationDateTime: v.optional(
            customDateTime(
              "XMLEvent: publicationDateTime is not a valid datetime",
            ),
          ),
        },
        "XMLEvent: location is object with uuid",
      ),
    ),
    comment: v.optional(XMLContent),
    label: XMLContent,
    other: v.optional(
      v.object(
        {
          ...XMLContent.entries,
          uuid: v.optional(
            v.pipe(
              v.string("XMLEvent: uuid is string and optional"),
              v.check(
                isPseudoUuid,
                "XMLEvent: uuid is not a valid pseudo-UUID",
              ),
            ),
          ),
          category: v.optional(XMLDataCategory),
        },
        "XMLEvent: other is object",
      ),
    ),
  },
  "XMLEvent: Shape error",
);

const XMLCoordinatesSourceLabel = v.object(
  {
    ...XMLContent.entries,
    uuid: v.pipe(
      v.string("XMLCoordinatesSource: uuid is string and required"),
      v.check(isPseudoUuid, "XMLCoordinatesSource: uuid is not a valid UUID"),
    ),
  },
  "XMLCoordinatesSource: Shape error",
);

const XMLCoordinatesSourceValue = v.intersect([
  v.union([XMLContent, XMLString]),
  v.object({
    uuid: v.optional(
      v.pipe(
        v.string("XMLCoordinatesSource: uuid is string and optional"),
        v.check(isPseudoUuid, "XMLCoordinatesSource: uuid is not a valid UUID"),
      ),
    ),
  }),
]);

const XMLCoordinatesSource: v.GenericSchema<XMLCoordinatesSourceType> =
  v.variant("context", [
    v.object(
      {
        context: v.literal("self", "XMLCoordinatesSource: context is self"),
        label: XMLCoordinatesSourceLabel,
      },
      "XMLCoordinatesSource: Shape error",
    ),
    v.object(
      {
        context: v.literal(
          "related",
          "XMLCoordinatesSource: context is related",
        ),
        label: XMLCoordinatesSourceLabel,
        value: v.array(XMLCoordinatesSourceValue),
      },
      "XMLCoordinatesSource: Shape error",
    ),
    v.object(
      {
        context: v.literal(
          "inherited",
          "XMLCoordinatesSource: context is inherited",
        ),
        label: XMLCoordinatesSourceLabel,
        value: v.optional(v.array(XMLCoordinatesSourceValue)),
        item: v.object(
          {
            uuid: v.optional(
              v.pipe(
                v.string("XMLCoordinatesSource: uuid is string and optional"),
                v.check(
                  isPseudoUuid,
                  "XMLCoordinatesSource: uuid is not a valid UUID",
                ),
              ),
            ),
            label: XMLCoordinatesSourceValue,
          },
          "XMLCoordinatesSource: Shape error",
        ),
      },
      "XMLCoordinatesSource: Shape error",
    ),
  ]);

const XMLCoordinate = v.variant(
  "type",
  [
    v.object(
      {
        type: v.literal("point", "XMLCoordinates: type is point"),
        latitude: XMLNumber,
        longitude: XMLNumber,
        altitude: v.optional(XMLNumber),
        source: v.optional(XMLCoordinatesSource),
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
        source: v.optional(XMLCoordinatesSource),
      },
      "XMLCoordinates: Shape error",
    ),
  ],
  "XMLCoordinates: Shape error",
);

const XMLCoordinates: v.GenericSchema<XMLCoordinatesType> = v.object(
  { coord: v.array(XMLCoordinate) },
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
    height: v.optional(XMLNumber),
    width: v.optional(XMLNumber),
    fileSize: v.optional(XMLNumber),
    payload: v.optional(v.string("XMLImage: payload is string and optional")),
  },
  "XMLImage: Shape error",
);

const XMLImageMapArea: v.GenericSchema<XMLImageMapAreaType> = v.object(
  {
    uuid: v.pipe(
      v.string("XMLImageMapArea: uuid is string and required"),
      v.check(isPseudoUuid, "XMLImageMapArea: uuid is not a valid pseudo-UUID"),
    ),
    publicationDateTime: customDateTime(
      "XMLImageMapArea: publicationDateTime is not a valid datetime",
    ),
    type: v.string("XMLImageMapArea: type is string and required"),
    title: v.string("XMLImageMapArea: title is string and required"),
    shape: v.picklist(
      ["rectangle", "circle", "poly"],
      "XMLImageMapArea: shape is rectangle, circle, or poly",
    ),
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
    content: v.optional(XMLContent.entries.content),
    payload: v.optional(v.string("XMLNote: payload is string and optional")),
    rend: v.optional(v.string("XMLNote: rend is string and optional")),
    whitespace: v.optional(
      v.string("XMLNote: whitespace is string and optional"),
    ),
    noteNo: XMLNumber,
    date: v.optional(customDateTime("XMLNote: date is not a valid datetime")),
    authors: v.optional(
      v.object(
        { author: v.array(v.lazy(() => XMLPerson)) },
        "XMLNote: authors is object with author array of XMLPerson",
      ),
    ),
  },
  "XMLNote: Shape error",
);

const XMLProperty: v.GenericSchema<XMLPropertyType> = v.lazy(() =>
  v.object(
    {
      label: v.intersect([
        v.union([XMLContent, XMLString]),
        v.object(
          {
            uuid: v.pipe(
              v.string("XMLProperty: uuid is string and required"),
              v.check(
                isPseudoUuid,
                "XMLProperty: uuid is not a valid pseudo-UUID",
              ),
            ),
            publicationDateTime: v.optional(
              customDateTime(
                "XMLProperty: publicationDateTime is not a valid datetime",
              ),
            ),
          },
          "XMLProperty: label is object with uuid",
        ),
      ]),
      value: v.optional(
        v.array(
          v.object({
            ...v.partial(XMLContent).entries,
            i: v.optional(XMLNumber),
            inherited: v.optional(XMLBoolean),
            uuid: v.optional(
              v.union([
                v.literal(""),
                v.pipe(
                  v.string("XMLProperty: uuid is string and optional"),
                  v.check(
                    isPseudoUuid,
                    "XMLProperty: uuid is not a valid pseudo-UUID",
                  ),
                ),
              ]),
            ),
            publicationDateTime: v.optional(
              customDateTime(
                "XMLProperty: publicationDateTime is not a valid datetime",
              ),
            ),
            dataType: v.optional(
              v.string("XMLProperty: dataType is string and optional"),
            ),
            category: v.optional(
              v.string("XMLProperty: category is string and optional"),
            ),
            type: v.optional(
              v.string("XMLProperty: type is string and optional"),
            ),
            slug: v.optional(
              v.string("XMLProperty: slug is string and optional"),
            ),
            unit: v.optional(
              v.string("XMLProperty: unit is string and optional"),
            ),
            height: v.optional(XMLNumber),
            width: v.optional(XMLNumber),
            fileSize: v.optional(XMLNumber),
            rawValue: v.optional(
              v.string("XMLProperty: rawValue is string and optional"),
            ),
            isUncertain: v.optional(
              v.literal("true", "XMLProperty: isUncertain is true"),
            ),
            href: v.optional(
              v.string("XMLProperty: href is string and optional"),
            ),
            payload: v.optional(
              v.string("XMLProperty: payload is string and optional"),
            ),
          }),
          "XMLProperty: value is array of objects with payload",
        ),
      ),
      comment: v.optional(XMLContent),
      property: v.optional(
        v.array(XMLProperty, "XMLProperty: property is array of XMLProperty"),
      ),
    },
    "XMLProperty: Shape error",
  ),
);

const XMLSimplifiedProperty: v.GenericSchema<XMLSimplifiedPropertyType> =
  v.lazy(() =>
    v.object(
      {
        label: v.intersect([
          v.union([XMLContent, XMLString]),
          v.object(
            {
              uuid: v.pipe(
                v.string("XMLSimplifiedProperty: uuid is string and required"),
                v.check(
                  isPseudoUuid,
                  "XMLSimplifiedProperty: uuid is not a valid pseudo-UUID",
                ),
              ),
              publicationDateTime: v.optional(
                customDateTime(
                  "XMLSimplifiedProperty: publicationDateTime is not a valid datetime",
                ),
              ),
            },
            "XMLSimplifiedProperty: label is object with uuid",
          ),
        ]),
        value: v.optional(
          v.array(
            v.object({
              i: v.optional(XMLNumber),
              inherited: v.optional(XMLBoolean),
              uuid: v.optional(
                v.union([
                  v.literal(""),
                  v.pipe(
                    v.string(
                      "XMLSimplifiedProperty: uuid is string and optional",
                    ),
                    v.check(
                      isPseudoUuid,
                      "XMLSimplifiedProperty: uuid is not a valid pseudo-UUID",
                    ),
                  ),
                ]),
              ),
              publicationDateTime: v.optional(
                customDateTime(
                  "XMLSimplifiedProperty: publicationDateTime is not a valid datetime",
                ),
              ),
              dataType: v.optional(
                v.string(
                  "XMLSimplifiedProperty: dataType is string and optional",
                ),
              ),
              category: v.optional(
                v.string(
                  "XMLSimplifiedProperty: category is string and optional",
                ),
              ),
              type: v.optional(
                v.string("XMLSimplifiedProperty: type is string and optional"),
              ),
              slug: v.optional(
                v.string("XMLSimplifiedProperty: slug is string and optional"),
              ),
              unit: v.optional(
                v.string("XMLSimplifiedProperty: unit is string and optional"),
              ),
              height: v.optional(XMLNumber),
              width: v.optional(XMLNumber),
              fileSize: v.optional(XMLNumber),
              rawValue: v.optional(
                v.string(
                  "XMLSimplifiedProperty: rawValue is string and optional",
                ),
              ),
              isUncertain: v.optional(
                v.literal("true", "XMLSimplifiedProperty: isUncertain is true"),
              ),
              href: v.optional(
                v.string("XMLSimplifiedProperty: href is string and optional"),
              ),
              payload: v.string("XMLSimplifiedProperty: payload is string"),
            }),
            "XMLSimplifiedProperty: value is array of objects with payload",
          ),
        ),
        comment: v.optional(XMLContent),
        property: v.optional(
          v.array(
            XMLSimplifiedProperty,
            "XMLSimplifiedProperty: property is array of XMLSimplifiedProperty",
          ),
        ),
      },
      "XMLSimplifiedProperty: Shape error",
    ),
  );

const XMLBaseItem = v.object(
  {
    uuid: v.pipe(
      v.string("XMLBaseItem: uuid is string and required"),
      v.check(isPseudoUuid, "XMLBaseItem: uuid is not a valid pseudo-UUID"),
    ),
    publicationDateTime: v.optional(
      customDateTime(
        "XMLBaseItem: publicationDateTime is not a valid datetime",
      ),
    ),
    date: v.optional(v.union([customDateTime(), XMLString])),
    availability: v.optional(v.object({ license: XMLLicense })),
    copyright: v.optional(v.union([XMLContent, XMLString])),
    watermark: v.optional(v.union([XMLContent, XMLString])),
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
    v.optional(v.object({ person: v.array(v.lazy(() => XMLPerson)) })),
    v.optional(
      v.object({
        propertyVariable: v.array(v.lazy(() => XMLPropertyVariable)),
      }),
    ),
    v.optional(
      v.object({ variable: v.array(v.lazy(() => XMLPropertyVariable)) }),
    ),
    v.optional(
      v.object({ propertyValue: v.array(v.lazy(() => XMLPropertyValue)) }),
    ),
    v.optional(
      v.object({
        resource: v.array(
          v.union([
            v.lazy(() => XMLResource),
            v.object({ resource: v.array(v.lazy(() => XMLResource)) }),
          ]),
        ),
      }),
    ),
    v.optional(v.object({ text: v.array(v.lazy(() => XMLText)) })),
    v.optional(v.object({ set: v.array(v.lazy(() => XMLSet)) })),
  ]),
]);

const XMLTree: v.GenericSchema<XMLTreeType> = v.object(
  {
    ...XMLBaseItem.entries,
    date: v.optional(
      v.union([
        customDateTime("XMLTree: date is not a valid datetime"),
        XMLString,
      ]),
    ),
    links: v.optional(v.lazy(() => XMLLink)),
    notes: v.optional(v.object({ note: v.array(XMLNote) })),
    properties: v.optional(v.object({ property: v.array(XMLProperty) })),
    bibliographies: v.optional(
      v.object({ bibliography: v.array(v.lazy(() => XMLBibliography)) }),
    ),
    items: v.optional(
      v.object({
        heading: v.optional(v.array(v.lazy(() => XMLHeading))),
        bibliography: v.optional(v.array(v.lazy(() => XMLBibliography))),
        concept: v.optional(v.array(v.lazy(() => XMLConcept))),
        spatialUnit: v.optional(v.array(v.lazy(() => XMLSpatialUnit))),
        period: v.optional(v.array(v.lazy(() => XMLPeriod))),
        person: v.optional(v.array(v.lazy(() => XMLPerson))),
        propertyVariable: v.optional(
          v.array(v.lazy(() => XMLPropertyVariable)),
        ),
        variable: v.optional(v.array(v.lazy(() => XMLPropertyVariable))),
        propertyValue: v.optional(v.array(v.lazy(() => XMLPropertyValue))),
        resource: v.optional(
          v.array(
            v.union([
              v.lazy(() => XMLResource),
              v.object({ resource: v.array(v.lazy(() => XMLResource)) }),
            ]),
          ),
        ),
        text: v.optional(v.array(v.lazy(() => XMLText))),
        set: v.optional(v.array(v.lazy(() => XMLSet))),
      }),
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
    links: v.optional(v.lazy(() => XMLLink)),
    notes: v.optional(v.object({ note: v.array(XMLNote) })),
    properties: v.optional(v.object({ property: v.array(XMLProperty) })),
    items: v.optional(
      v.object({
        tree: v.optional(v.array(v.lazy(() => XMLTree))),
        bibliography: v.optional(v.array(v.lazy(() => XMLBibliography))),
        concept: v.optional(v.array(v.lazy(() => XMLConcept))),
        spatialUnit: v.optional(v.array(v.lazy(() => XMLSpatialUnit))),
        period: v.optional(v.array(v.lazy(() => XMLPeriod))),
        person: v.optional(v.array(v.lazy(() => XMLPerson))),
        propertyVariable: v.optional(
          v.array(v.lazy(() => XMLPropertyVariable)),
        ),
        variable: v.optional(v.array(v.lazy(() => XMLPropertyVariable))),
        propertyValue: v.optional(v.array(v.lazy(() => XMLPropertyValue))),
        resource: v.optional(
          v.array(
            v.union([
              v.lazy(() => XMLResource),
              v.object({ resource: v.array(v.lazy(() => XMLResource)) }),
            ]),
          ),
        ),
        text: v.optional(v.array(v.lazy(() => XMLText))),
        set: v.optional(v.array(v.lazy(() => XMLSet))),
      }),
    ),
  },
  "XMLSet: Shape error",
);

const XMLBibliography: v.GenericSchema<XMLBibliographyType> = v.object(
  {
    ...v.partial(XMLBaseItem).entries,
    type: v.optional(v.string("XMLBibliography: type is string and optional")),
    zoteroId: v.optional(
      v.string("XMLBibliography: zoteroId is string and optional"),
    ),
    sourceDocument: v.optional(
      v.object(
        {
          uuid: v.pipe(
            v.string("XMLBibliography: uuid is string and required"),
            v.check(
              isPseudoUuid,
              "XMLBibliography: uuid is not a valid pseudo-UUID",
            ),
          ),
          payload: v.string("XMLBibliography: payload is string and required"),
          href: v.optional(
            v.string("XMLBibliography: href is string and optional"),
          ),
          publicationDateTime: v.optional(
            customDateTime(
              "XMLBibliography: publicationDateTime is not a valid datetime",
            ),
          ),
        },
        "XMLBibliography: sourceDocument is object with uuid and payload",
      ),
    ),
    image: v.optional(XMLImage),
    publicationInfo: v.optional(
      v.object(
        {
          publishers: v.optional(
            v.union([
              v.object({ publisher: v.array(v.lazy(() => XMLPerson)) }),
              v.object({
                publishers: v.object({
                  person: v.array(v.lazy(() => XMLPerson)),
                }),
              }),
            ]),
          ),
          startDate: v.optional(
            v.object({
              month: v.optional(v.union([XMLNumber, XMLString])),
              year: v.optional(v.union([XMLNumber, XMLString])),
              day: v.optional(v.union([XMLNumber, XMLString])),
            }),
          ),
        },
        "XMLBibliography: publicationInfo is object with publishers and startDate",
      ),
    ),
    entryInfo: v.optional(
      v.object(
        {
          payload: v.optional(
            v.string("XMLBibliography: payload is string and optional"),
          ),
          startIssue: v.optional(
            v.string("XMLBibliography: startIssue is string and optional"),
          ),
          startVolume: v.optional(
            v.string("XMLBibliography: startVolume is string and optional"),
          ),
          startPage: v.optional(
            v.string("XMLBibliography: startPage is string and optional"),
          ),
          endPage: v.optional(
            v.string("XMLBibliography: endPage is string and optional"),
          ),
        },
        "XMLBibliography: entryInfo is object",
      ),
    ),
    citationDetails: v.optional(
      v.string("XMLBibliography: citationDetails is string and optional"),
    ),
    citationFormat: v.optional(v.union([XMLString, v.string()])),
    citationFormatSpan: v.optional(XMLString),
    referenceFormatDiv: v.optional(XMLString),
    source: v.optional(v.lazy(() => XMLDataItem)),
    authors: v.optional(v.object({ person: v.array(v.lazy(() => XMLPerson)) })),
    periods: v.optional(v.object({ period: v.array(v.lazy(() => XMLPeriod)) })),
    links: v.optional(v.lazy(() => XMLLink)),
    notes: v.optional(v.object({ note: v.array(XMLNote) })),
    properties: v.optional(v.object({ property: v.array(XMLProperty) })),
    bibliographies: v.optional(
      v.object({ bibliography: v.array(v.lazy(() => XMLBibliography)) }),
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
    links: v.optional(v.lazy(() => XMLLink)),
    notes: v.optional(v.object({ note: v.array(XMLNote) })),
    properties: v.optional(v.object({ property: v.array(XMLProperty) })),
    bibliographies: v.optional(
      v.object({ bibliography: v.array(XMLBibliography) }),
    ),
  },
  "XMLInterpretation: Shape error",
);

const XMLConcept: v.GenericSchema<XMLConceptType> = v.object(
  {
    ...XMLBaseItem.entries,
    image: v.optional(XMLImage),
    interpretations: v.optional(
      v.object({ interpretation: v.array(XMLInterpretation) }),
    ),
    coordinates: v.optional(XMLCoordinates),
    properties: v.optional(v.object({ property: v.array(XMLProperty) })),
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
    links: v.optional(v.lazy(() => XMLLink)),
    notes: v.optional(v.object({ note: v.array(XMLNote) })),
    properties: v.optional(v.object({ property: v.array(XMLProperty) })),
    bibliographies: v.optional(
      v.object({ bibliography: v.array(XMLBibliography) }),
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
            multiPolygon: v.object({
              payload: v.string(
                "XMLSpatialUnit: multiPolygon is string and required",
              ),
            }),
            EPSG: XMLNumber,
          }),
        },
        "XMLSpatialUnit: mapData is object with geoJSON",
      ),
    ),
    observations: v.optional(
      v.object({ observation: v.array(XMLObservation) }),
    ),
    properties: v.optional(v.object({ property: v.array(XMLProperty) })),
    bibliographies: v.optional(
      v.object({ bibliography: v.array(XMLBibliography) }),
    ),
    spatialUnit: v.optional(v.array(v.lazy(() => XMLSpatialUnit))),
  },
  "XMLSpatialUnit: Shape error",
);

const XMLPeriod: v.GenericSchema<XMLPeriodType> = v.object(
  {
    ...XMLBaseItem.entries,
    type: v.optional(v.string("XMLPeriod: type is string and optional")),
    coordinates: v.optional(XMLCoordinates),
    links: v.optional(v.lazy(() => XMLDataItem)),
    notes: v.optional(v.object({ note: v.array(XMLNote) })),
    properties: v.optional(v.object({ property: v.array(XMLProperty) })),
    bibliographies: v.optional(
      v.object({ bibliography: v.array(XMLBibliography) }),
    ),
    period: v.optional(v.array(v.lazy(() => XMLPeriod))),
  },
  "XMLPeriod: Shape error",
);

const XMLPerson: v.GenericSchema<XMLPersonType> = v.object(
  {
    ...XMLBaseItem.entries,
    ...v.partial(XMLContent).entries,
    type: v.optional(v.string("XMLPerson: type is string and optional")),
    image: v.optional(XMLImage),
    address: v.optional(
      v.object(
        {
          country: v.optional(
            v.union([
              XMLString,
              v.string("XMLPerson: country is string and optional"),
            ]),
          ),
          city: v.optional(
            v.union([
              XMLString,
              v.string("XMLPerson: city is string and optional"),
            ]),
          ),
          state: v.optional(
            v.union([
              XMLString,
              v.string("XMLPerson: state is string and optional"),
            ]),
          ),
          postalCode: v.optional(
            v.union([
              XMLString,
              v.string("XMLPerson: postalCode is string and optional"),
            ]),
          ),
        },
        "XMLPerson: address is object with country, city, and state",
      ),
    ),
    coordinates: v.optional(XMLCoordinates),
    periods: v.optional(v.object({ period: v.array(XMLPeriod) })),
    links: v.optional(v.lazy(() => XMLLink)),
    notes: v.optional(v.object({ note: v.array(XMLNote) })),
    properties: v.optional(v.object({ property: v.array(XMLProperty) })),
  },
  "XMLPerson: Shape error",
);

const XMLPropertyValue: v.GenericSchema<XMLPropertyValueType> = v.object(
  {
    ...XMLBaseItem.entries,
    coordinates: v.optional(XMLCoordinates),
    links: v.optional(v.lazy(() => XMLLink)),
    notes: v.optional(v.object({ note: v.array(XMLNote) })),
    properties: v.optional(v.object({ property: v.array(XMLProperty) })),
    bibliographies: v.optional(
      v.object({ bibliography: v.array(XMLBibliography) }),
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
    links: v.optional(v.lazy(() => XMLLink)),
    notes: v.optional(v.object({ note: v.array(XMLNote) })),
    bibliographies: v.optional(
      v.object({ bibliography: v.array(XMLBibliography) }),
    ),
  },
  "XMLPropertyVariable: Shape error",
);

const XMLResource: v.GenericSchema<XMLResourceType> = v.object(
  {
    ...XMLBaseItem.entries,
    type: v.optional(v.string("XMLResource: type is string and optional")),
    date: v.optional(
      v.union([
        customDateTime("XMLResource: date is not a valid datetime"),
        XMLString,
      ]),
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
    fileSize: v.optional(XMLNumber),
    rend: v.optional(v.literal("inline", "XMLResource: rend is inline")),
    height: v.optional(XMLNumber),
    width: v.optional(XMLNumber),
    image: v.optional(XMLImage),
    imagemap: v.optional(XMLImageMap),
    document: v.optional(XMLContent),
    coordinates: v.optional(XMLCoordinates),
    periods: v.optional(v.object({ period: v.array(XMLPeriod) })),
    links: v.optional(v.lazy(() => XMLLink)),
    reverseLinks: v.optional(
      v.union([
        v.lazy(() => XMLLink),
        v.lazy(() => XMLDataItem),
        v.array(v.union([v.lazy(() => XMLLink), v.lazy(() => XMLDataItem)])),
      ]),
    ),
    notes: v.optional(v.object({ note: v.array(XMLNote) })),
    properties: v.optional(v.object({ property: v.array(XMLProperty) })),
    bibliographies: v.optional(
      v.object({ bibliography: v.array(XMLBibliography) }),
    ),
    resource: v.optional(v.array(v.lazy(() => XMLResource))),
  },
  "XMLResource: Shape error",
);

const XMLSection = v.object(
  {
    uuid: v.pipe(
      v.string("XMLSection: uuid is string and required"),
      v.check(isPseudoUuid, "XMLSection: uuid is not a valid pseudo-UUID"),
    ),
    publicationDateTime: v.optional(
      customDateTime("XMLSection: publicationDateTime is not a valid datetime"),
    ),
    type: v.string("XMLSection: type is string and required"),
    identification: XMLIdentification,
    project: v.optional(v.object({ identification: XMLIdentification })),
  },
  "XMLSection: Shape error",
);

const XMLText: v.GenericSchema<XMLTextType> = v.object(
  {
    ...XMLBaseItem.entries,
    type: v.optional(v.string("XMLText: type is string and optional")),
    text: v.optional(v.string("XMLText: text is string and optional")),
    language: v.optional(v.string("XMLText: language is string and optional")),
    image: v.optional(XMLImage),
    coordinates: v.optional(XMLCoordinates),
    links: v.optional(v.lazy(() => XMLLink)),
    reverseLinks: v.optional(
      v.union([
        v.lazy(() => XMLLink),
        v.lazy(() => XMLDataItem),
        v.array(v.union([v.lazy(() => XMLLink), v.lazy(() => XMLDataItem)])),
      ]),
    ),
    notes: v.optional(v.object({ note: v.array(XMLNote) })),
    sections: v.optional(
      v.union([
        XMLString,
        v.object({
          translation: v.optional(
            v.array(v.object({ section: v.array(XMLSection) })),
          ),
          phonemic: v.optional(
            v.array(v.object({ section: v.array(XMLSection) })),
          ),
        }),
      ]),
    ),
    periods: v.optional(v.object({ period: v.array(XMLPeriod) })),
    creators: v.optional(
      v.object(
        { creator: v.array(v.lazy(() => XMLPerson)) },
        "XMLText: creators is object with creator array of XMLPerson",
      ),
    ),
    editions: v.optional(
      v.object(
        {
          edition: v.optional(v.array(v.lazy(() => XMLPerson))),
          editor: v.optional(v.array(v.lazy(() => XMLPerson))),
          publisher: v.optional(v.array(v.lazy(() => XMLPerson))),
        },
        "XMLText: editions is object with edition array of XMLPerson",
      ),
    ),
  },
  "XMLText: Shape error",
);

export const XMLLink: v.GenericSchema<XMLLinkType> = v.pipe(
  v.object(
    {
      tree: v.optional(v.array(XMLTree)),
      bibliography: v.optional(v.array(XMLBibliography)),
      concept: v.optional(v.array(XMLConcept)),
      spatialUnit: v.optional(v.array(XMLSpatialUnit)),
      period: v.optional(v.array(XMLPeriod)),
      person: v.optional(v.array(XMLPerson)),
      propertyVariable: v.optional(v.array(XMLPropertyVariable)),
      variable: v.optional(v.array(XMLPropertyVariable)),
      propertyValue: v.optional(v.array(XMLPropertyValue)),
      resource: v.optional(v.array(XMLResource)),
      text: v.optional(v.array(XMLText)),
      set: v.optional(v.array(XMLSet)),
      dictionaryUnit: v.optional(v.unknown()),
    },
    "XMLLink: Shape error",
  ),
  v.check((val) => {
    if (Object.keys(val).length > 0) {
      return true;
    }

    for (const dataCategory of DATA_CATEGORIES) {
      if (val[dataCategory] != null) {
        return true;
      }
    }

    return false;
  }, "XMLLink: at least one link category is required"),
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
      { propertyVariable: v.array(XMLPropertyVariable) },
      "XMLDataItem: propertyVariable is array of XMLPropertyVariable",
    ),
    v.object(
      { variable: v.array(XMLPropertyVariable) },
      "XMLDataItem: variable is array of XMLPropertyVariable",
    ),
    v.object(
      { propertyValue: v.array(XMLPropertyValue) },
      "XMLDataItem: propertyValue is array of XMLPropertyValue",
    ),
    v.object(
      { resource: v.array(XMLResource) },
      "XMLDataItem: resource is array of XMLResource",
    ),
    v.object(
      { text: v.array(XMLText) },
      "XMLDataItem: text is array of XMLText",
    ),
    v.object({ set: v.array(XMLSet) }, "XMLDataItem: set is array of XMLSet"),
  ],
  "XMLDataItem: Shape error",
);

export const XMLData: v.GenericSchema<XMLDataType> = v.object(
  {
    result: v.object({
      ochre: v.intersect([
        v.object(
          {
            uuid: v.pipe(
              v.string("XMLData: uuid is string and required"),
              v.check(isPseudoUuid, "XMLData: uuid is not a valid pseudo-UUID"),
            ),
            belongsTo: v.string("XMLData: belongsTo is string and required"),
            uuidBelongsTo: v.pipe(
              v.string("XMLData: uuidBelongsTo is string and required"),
              v.check(
                isPseudoUuid,
                "XMLData: uuidBelongsTo is not a valid pseudo-UUID",
              ),
            ),
            publicationDateTime: customDateTime(
              "XMLData: publicationDateTime is not a valid datetime",
            ),
            metadata: XMLMetadata,
            persistentUrl: v.optional(
              v.pipe(
                v.string("XMLData: persistentUrl is string and optional"),
                v.url("XMLData: persistentUrl is not a valid URL"),
              ),
            ),
            languages: v.optional(
              v.string("XMLData: languages is string and optional"),
            ),
          },
          "XMLData: ochre is object with uuid, belongsTo, uuidBelongsTo, publicationDateTime, metadata, and languages",
        ),
        XMLDataItem,
      ]),
    }),
  },
  "XMLData: Shape error",
);
