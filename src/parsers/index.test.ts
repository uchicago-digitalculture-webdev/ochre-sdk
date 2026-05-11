import { describe, expect, it } from "vitest";
import type {
  XMLContent,
  XMLData,
  XMLIdentification,
  XMLProperty,
  XMLResource,
  XMLString,
  XMLText,
} from "#/xml/types.js";
import {
  PRESENTATION_ITEM_UUID,
  TEXT_ANNOTATION_TEXT_STYLING_HEADING_LEVEL_UUID,
  TEXT_ANNOTATION_TEXT_STYLING_UUID,
  TEXT_ANNOTATION_TEXT_STYLING_VARIANT_UUID,
  TEXT_ANNOTATION_UUID,
} from "#/constants.js";
import { parseItem } from "#/parsers/index.js";
import { parseXMLContent, parseXMLString } from "#/parsers/string.js";

const PUBLICATION_DATE = new Date("2026-01-01T00:00:00Z");

function xmlString(payload: string): XMLString {
  return { payload };
}

function content(values: Partial<Record<"eng" | "spa", string>>): XMLContent {
  const contentItems: XMLContent["content"] = [];
  for (const [lang, value] of Object.entries(values)) {
    contentItems.push({ lang, string: [xmlString(value)] });
  }

  return { content: contentItems };
}

function identification(
  label: Partial<Record<"eng" | "spa", string>>,
): XMLIdentification {
  return { label: content(label) };
}

function textAnnotationProperty(properties: Array<XMLProperty>): XMLProperty {
  return {
    label: { payload: "presentation", uuid: PRESENTATION_ITEM_UUID },
    value: [
      {
        payload: "text-annotation",
        uuid: TEXT_ANNOTATION_UUID,
        dataType: "xs:string",
      },
    ],
    property: properties,
  };
}

function textStylingProperty(properties: Array<XMLProperty>): XMLProperty {
  return {
    label: {
      payload: "variant",
      uuid: TEXT_ANNOTATION_TEXT_STYLING_VARIANT_UUID,
    },
    value: [
      {
        payload: "text-styling",
        uuid: TEXT_ANNOTATION_TEXT_STYLING_UUID,
        dataType: "xs:string",
      },
    ],
    property: properties,
  };
}

function paragraphAnnotation(text: string): XMLString {
  return {
    properties: {
      property: [
        textAnnotationProperty([
          textStylingProperty([
            {
              label: {
                payload: "variant",
                uuid: TEXT_ANNOTATION_TEXT_STYLING_VARIANT_UUID,
              },
              value: [{ payload: "paragraph", dataType: "xs:string" }],
              property: [
                {
                  label: {
                    payload: "size",
                    uuid: "e0000000-0000-4000-8000-000000000000",
                  },
                  value: [{ payload: "md", dataType: "xs:string" }],
                },
              ],
            },
          ]),
        ]),
      ],
    },
    string: [{ payload: text }],
  };
}

function metadata(
  category: "tree" | "variable" | "set",
): XMLData["result"]["ochre"]["metadata"] {
  return {
    dataset: xmlString("Dataset"),
    description: xmlString("Description"),
    publisher: xmlString("Publisher"),
    identifier: xmlString("Identifier"),
    language: [{ payload: "eng", default: "true" }, { payload: "spa" }],
    project: {
      uuid: "10000000-0000-4000-8000-000000000000",
      identification: identification({ eng: "Project", spa: "Proyecto" }),
      dateFormat: "yyyy-MM-dd",
    },
    item: {
      identification: identification({ eng: "Item", spa: "Elemento" }),
      category,
      type: "test",
    },
  };
}

function resource(uuid: string, label: string): XMLResource {
  return {
    uuid,
    publicationDateTime: PUBLICATION_DATE,
    identification: identification({ eng: label, spa: `${label} ES` }),
  };
}

function text(uuid: string, label: string): XMLText {
  return {
    uuid,
    publicationDateTime: PUBLICATION_DATE,
    identification: identification({ eng: label, spa: `${label} ES` }),
    text: label,
    language: "eng",
  };
}

describe("parseItem", () => {
  it("parses multilingual tree items, payload-only property labels, and resource wrappers", () => {
    const rawData: XMLData = {
      result: {
        ochre: {
          uuid: "20000000-0000-4000-8000-000000000000",
          belongsTo: "TEST",
          uuidBelongsTo: "30000000-0000-4000-8000-000000000000",
          publicationDateTime: PUBLICATION_DATE,
          metadata: metadata("tree"),
          tree: [
            {
              uuid: "40000000-0000-4000-8000-000000000000",
              publicationDateTime: PUBLICATION_DATE,
              identification: identification({ eng: "Tree", spa: "Arbol" }),
              properties: {
                property: [
                  {
                    label: {
                      payload: "presentation",
                      uuid: "50000000-0000-4000-8000-000000000000",
                      publicationDateTime: PUBLICATION_DATE,
                    },
                    value: [
                      {
                        payload: "website",
                        dataType: "string",
                        uuid: "60000000-0000-4000-8000-000000000000",
                      },
                    ],
                  },
                ],
              },
              items: {
                resource: [
                  {
                    resource: [
                      resource(
                        "70000000-0000-4000-8000-000000000000",
                        "Wrapped resource",
                      ),
                    ],
                  },
                ],
              },
            },
          ],
        },
      },
    };

    const tree = parseItem(rawData, {
      category: "tree",
      containedItemCategory: "resource",
      languages: ["eng", "spa"] as const,
    });

    expect(tree.belongsTo).toStrictEqual({
      uuid: "30000000-0000-4000-8000-000000000000",
      abbreviation: "TEST",
    });
    expect(tree.metadata.dataset).toBe("Dataset");
    expect(tree.identification.label.getExactText("spa")).toBe("Arbol");
    expect(tree.containedItemCategory).toBe("resource");
    expect(tree.properties[0]?.variable.uuid).toBe(
      "50000000-0000-4000-8000-000000000000",
    );
    expect(tree.properties[0]?.variable.publicationDateTime).toStrictEqual(
      PUBLICATION_DATE,
    );
    expect(tree.properties[0]?.variable.label.getText()).toBe("presentation");
    expect(tree.properties[0]?.values[0]?.content).toBe("website");
    const firstTreeItem = tree.items[0];
    expect(
      firstTreeItem != null && "category" in firstTreeItem ?
        firstTreeItem.category
      : null,
    ).toBe("resource");
  });

  it("rejects tree XML with multiple item categories", () => {
    const rawData: XMLData = {
      result: {
        ochre: {
          uuid: "b0000000-0000-4000-8000-000000000000",
          belongsTo: "TEST",
          uuidBelongsTo: "c0000000-0000-4000-8000-000000000000",
          publicationDateTime: PUBLICATION_DATE,
          metadata: metadata("tree"),
          tree: [
            {
              uuid: "d0000000-0000-4000-8000-000000000000",
              publicationDateTime: PUBLICATION_DATE,
              identification: identification({ eng: "Mixed tree" }),
              items: {
                resource: [
                  resource("e0000000-0000-4000-8000-000000000000", "Resource"),
                ],
                text: [text("f0000000-0000-4000-8000-000000000000", "Text")],
              },
            },
          ],
        },
      },
    };

    expect(() =>
      parseItem(rawData, { category: "tree", languages: ["eng"] as const }),
    ).toThrow("Expected Tree items to contain one category");
  });

  it("parses links as abridged item links instead of full embedded items", () => {
    const rawData: XMLData = {
      result: {
        ochre: {
          uuid: "a1000000-0000-4000-8000-000000000000",
          belongsTo: "TEST",
          uuidBelongsTo: "a2000000-0000-4000-8000-000000000000",
          publicationDateTime: PUBLICATION_DATE,
          metadata: metadata("set"),
          resource: [
            {
              uuid: "a3000000-0000-4000-8000-000000000000",
              publicationDateTime: PUBLICATION_DATE,
              identification: identification({ eng: "Resource" }),
              links: {
                resource: [
                  {
                    uuid: "a4000000-0000-4000-8000-000000000000",
                    publicationDateTime: PUBLICATION_DATE,
                    type: "image",
                    href: "https://example.com/image.jpg",
                    fileFormat: "image/jpeg",
                    fileSize: 42,
                    rend: "inline",
                    isPrimary: true,
                    height: 120,
                    width: 90,
                    identification: identification({ eng: "Linked image" }),
                  },
                ],
                value: [
                  {
                    uuid: "a5000000-0000-4000-8000-000000000000",
                    identification: identification({ eng: "Linked value" }),
                  },
                ],
                dictionaryUnit: [
                  {
                    uuid: "a6000000-0000-4000-8000-000000000000",
                    identification: identification({
                      eng: "Linked dictionary unit",
                    }),
                  },
                ],
              },
            },
          ],
        },
      },
    };

    const parsedResource = parseItem(rawData, {
      category: "resource",
      languages: ["eng"] as const,
    });

    expect(parsedResource.links).toHaveLength(3);
    let linkedResource = parsedResource.links[0]!;
    for (const link of parsedResource.links) {
      if (link.category === "resource") {
        linkedResource = link;
        break;
      }
    }
    expect(linkedResource.category).toBe("resource");
    expect(Object.hasOwn(linkedResource, "links")).toBe(false);
    expect(Object.hasOwn(linkedResource, "items")).toBe(false);
    if (linkedResource.category !== "resource") {
      throw new Error("Expected resource item link");
    }
    expect(linkedResource.type).toBe("image");
    expect(linkedResource.href).toBe("https://example.com/image.jpg");
    expect(linkedResource.fileSize).toBe(42);
    expect(linkedResource.isInline).toBe(true);
    expect(linkedResource.isPrimary).toBe(true);
    expect(linkedResource.height).toBe(120);
    expect(linkedResource.width).toBe(90);
    expect(linkedResource.identification.label.getText("eng")).toBe(
      "Linked image",
    );

    const linkedCategories: Array<string> = [];
    for (const link of parsedResource.links) {
      linkedCategories.push(link.category);
    }
    expect(linkedCategories).toContain("propertyValue");
    expect(linkedCategories).toContain("dictionaryUnit");
  });

  it("preserves mixed item categories for sets", () => {
    const rawData: XMLData = {
      result: {
        ochre: {
          uuid: "01000000-0000-4000-8000-000000000000",
          belongsTo: "TEST",
          uuidBelongsTo: "02000000-0000-4000-8000-000000000000",
          publicationDateTime: PUBLICATION_DATE,
          metadata: metadata("set"),
          set: [
            {
              uuid: "03000000-0000-4000-8000-000000000000",
              publicationDateTime: PUBLICATION_DATE,
              identification: identification({ eng: "Mixed set" }),
              items: {
                tree: [
                  {
                    uuid: "03500000-0000-4000-8000-000000000000",
                    publicationDateTime: PUBLICATION_DATE,
                    identification: identification({ eng: "Tree" }),
                  },
                ],
                resource: [
                  resource("04000000-0000-4000-8000-000000000000", "Resource"),
                ],
                text: [text("05000000-0000-4000-8000-000000000000", "Text")],
              },
            },
          ],
        },
      },
    };

    const set = parseItem(rawData, {
      category: "set",
      containedItemCategory: ["tree", "resource", "text"] as const,
      languages: ["eng"] as const,
    });

    expect(set.containedItemCategories).toStrictEqual([
      "tree",
      "resource",
      "text",
    ]);
    expect(set.items).toHaveLength(3);
    const containedItemCategories: Array<string> = [];
    for (const item of set.items) {
      containedItemCategories.push(item.category);
    }
    expect(containedItemCategories).toStrictEqual(["tree", "resource", "text"]);
  });

  it("normalizes top-level variable XML into propertyVariable output", () => {
    const rawData: XMLData = {
      result: {
        ochre: {
          uuid: "80000000-0000-4000-8000-000000000000",
          belongsTo: "TEST",
          uuidBelongsTo: "90000000-0000-4000-8000-000000000000",
          publicationDateTime: PUBLICATION_DATE,
          metadata: metadata("variable"),
          variable: [
            {
              uuid: "a0000000-0000-4000-8000-000000000000",
              publicationDateTime: PUBLICATION_DATE,
              type: "link",
              identification: identification({ eng: "Variable" }),
            },
          ],
        },
      },
    };

    const propertyVariable = parseItem(rawData, {
      category: "propertyVariable",
      languages: ["eng"] as const,
    });

    expect(propertyVariable.metadata.item?.category).toBe("propertyVariable");
    expect(propertyVariable.category).toBe("propertyVariable");
    expect(propertyVariable.type).toBe("link");
  });

  it("preserves repeated language entries and aliases on multilingual fields", () => {
    const rawData: XMLData = {
      result: {
        ochre: {
          uuid: "11000000-0000-4000-8000-000000000000",
          belongsTo: "TEST",
          uuidBelongsTo: "12000000-0000-4000-8000-000000000000",
          publicationDateTime: PUBLICATION_DATE,
          metadata: metadata("set"),
          resource: [
            {
              uuid: "13000000-0000-4000-8000-000000000000",
              publicationDateTime: PUBLICATION_DATE,
              identification: {
                label: {
                  content: [
                    { lang: "eng", string: [xmlString("Primary label")] },
                    { lang: "eng", string: [xmlString("Secondary label")] },
                    { lang: "spa", string: [xmlString("Etiqueta")] },
                    { lang: "zxx", string: [xmlString("Alias one")] },
                    { lang: "zxx", string: [xmlString("Alias two")] },
                  ],
                },
              },
            },
          ],
        },
      },
    };

    const resource = parseItem(rawData, {
      category: "resource",
      languages: ["eng", "spa"] as const,
    });

    expect(resource.identification.label.getExactText("eng")).toBe(
      "Primary label",
    );
    expect(resource.identification.label.getExactTexts("eng")).toStrictEqual([
      "Primary label",
      "Secondary label",
    ]);
    expect(resource.identification.label.getExactEntries("eng")).toStrictEqual([
      { text: "Primary label", richText: "Primary label", isPrimary: true },
      {
        text: "Secondary label",
        richText: "Secondary label",
        isPrimary: false,
      },
    ]);
    expect(resource.identification.label.getAliases()).toStrictEqual([
      "Alias one",
      "Alias two",
    ]);
  });
});

describe("string parser integration", () => {
  it("does not duplicate text before parsed email links", () => {
    expect(
      parseXMLString(
        { payload: "Contact me@example.com" },
        { parseEmail: true },
      ).richText,
    ).toBe(
      'Contact <ExternalLink href="mailto:me@example.com">me@example.com</ExternalLink>',
    );
  });

  it("applies standalone whitespace without duplicating existing content", () => {
    const parsedContent = parseXMLContent(
      {
        content: [
          {
            lang: "eng",
            string: [{ payload: "Line one" }, { whitespace: "newline" }],
          },
        ],
      },
      { languages: ["eng"] as const },
    );

    expect(parsedContent.getExactText("eng")).toBe("Line one\n");
  });

  it("falls back to available XML content when a requested language is missing", () => {
    const parsedContent = parseXMLContent(
      { content: [{ lang: "spa", string: [{ payload: "Hola" }] }] },
      { languages: ["eng"] as const },
    );

    expect(parsedContent.getExactText("eng")).toBe("Hola");
  });

  it("ports whitespace options and permanent URL rewriting from the old parser", () => {
    expect(
      parseXMLString(
        { payload: "word", whitespace: "leading trailing" },
        { parseEmail: false },
      ).text,
    ).toBe(" word ");

    const parsedContent = parseXMLContent(
      {
        content: [
          {
            lang: "eng",
            string: [
              {
                string: [
                  {
                    links: {
                      resource: [
                        {
                          uuid: "b0000000-0000-4000-8000-000000000000",
                          type: "webpage",
                          href: "https://pi.lib.uchicago.edu/1001/org/ochre/c0000000-0000-4000-8000-000000000000",
                          identification: identification({ eng: "Website" }),
                        },
                      ],
                    },
                    string: [{ payload: "site" }],
                  },
                ],
              },
            ],
          },
        ],
      },
      { languages: ["eng"] as const },
    );

    expect(parsedContent.getExactRichText("eng")).toBe(
      '<ExternalLink href="https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?uuid=c0000000-0000-4000-8000-000000000000" content="Website">site</ExternalLink>',
    );
  });

  it("renders rich text links whose text is carried by the same XML string node", () => {
    const parsedContent = parseXMLContent(
      {
        content: [
          {
            lang: "eng",
            string: [
              {
                string: [
                  { payload: "Before ", whitespace: "trailing" },
                  {
                    links: {
                      resource: [
                        {
                          uuid: "b0000000-0000-4000-8000-000000000000",
                          type: "webpage",
                          href: "http://example.com",
                          publicationDateTime: PUBLICATION_DATE,
                          identification: identification({ eng: "Example" }),
                        },
                      ],
                    },
                    payload: "linked text",
                  },
                  { payload: " after", whitespace: "leading" },
                ],
              },
            ],
          },
        ],
      },
      { languages: ["eng"] as const },
    );

    expect(parsedContent.getExactRichText("eng")).toBe(
      'Before  <ExternalLink href="http://example.com" content="Example">linked text</ExternalLink>  after',
    );
  });

  it("renders text-styling annotations carried by rich text properties", () => {
    const parsedContent = parseXMLContent(
      {
        content: [
          {
            lang: "eng",
            string: [
              {
                string: [
                  {
                    properties: {
                      property: [
                        {
                          label: {
                            payload: "presentation",
                            uuid: PRESENTATION_ITEM_UUID,
                          },
                          value: [
                            {
                              payload: "text annotation",
                              uuid: TEXT_ANNOTATION_UUID,
                              dataType: "IDREF",
                            },
                          ],
                          property: [
                            {
                              label: {
                                payload: "text annotation type",
                                uuid: "d0000000-0000-4000-8000-000000000000",
                              },
                              value: [
                                {
                                  payload: "text styling",
                                  uuid: TEXT_ANNOTATION_TEXT_STYLING_UUID,
                                  dataType: "IDREF",
                                },
                              ],
                              property: [
                                {
                                  label: {
                                    payload: "variant",
                                    uuid: TEXT_ANNOTATION_TEXT_STYLING_VARIANT_UUID,
                                  },
                                  value: [
                                    { payload: "inline", dataType: "string" },
                                  ],
                                  property: [
                                    {
                                      label: {
                                        payload: "size",
                                        uuid: "e0000000-0000-4000-8000-000000000000",
                                      },
                                      value: [
                                        { payload: "lg", dataType: "string" },
                                      ],
                                    },
                                  ],
                                },
                                {
                                  label: {
                                    payload: "heading level",
                                    uuid: TEXT_ANNOTATION_TEXT_STYLING_HEADING_LEVEL_UUID,
                                  },
                                  value: [
                                    { payload: "2", dataType: "integer" },
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                    string: [{ payload: "Styled" }],
                  },
                ],
              },
            ],
          },
        ],
      },
      { languages: ["eng"] as const },
    );

    expect(parsedContent.getExactText("eng")).toBe("Styled");
    expect(parsedContent.getExactRichText("eng")).toBe(
      '<Annotation type="text-styling" variant="inline" size="lg" headingLevel="2">Styled</Annotation>',
    );
  });

  it("uses text annotation marker links as metadata instead of tooltip text", () => {
    const parsedContent = parseXMLContent(
      {
        content: [
          {
            lang: "eng",
            string: [
              {
                string: [
                  {
                    links: {
                      propertyValue: [
                        {
                          uuid: TEXT_ANNOTATION_UUID,
                          identification: identification({
                            eng: "Text Annotation",
                          }),
                        },
                      ],
                    },
                    properties: {
                      property: [
                        textAnnotationProperty([
                          textStylingProperty([
                            {
                              label: {
                                payload: "heading-level",
                                uuid: TEXT_ANNOTATION_TEXT_STYLING_HEADING_LEVEL_UUID,
                              },
                              value: [{ payload: "h2", dataType: "xs:string" }],
                            },
                            {
                              label: {
                                payload: "variant",
                                uuid: TEXT_ANNOTATION_TEXT_STYLING_VARIANT_UUID,
                              },
                              value: [
                                { payload: "label", dataType: "xs:string" },
                              ],
                              property: [
                                {
                                  label: {
                                    payload: "size",
                                    uuid: "a0000000-0000-4000-8000-000000000000",
                                  },
                                  value: [
                                    { payload: "lg", dataType: "xs:string" },
                                  ],
                                },
                              ],
                            },
                            {
                              label: {
                                payload: "color",
                                uuid: "a1000000-0000-4000-8000-000000000000",
                              },
                              value: [
                                {
                                  payload: "var(--color-brand-700)",
                                  dataType: "xs:string",
                                },
                              ],
                            },
                          ]),
                        ]),
                      ],
                    },
                    string: [{ payload: "UChicagoNode" }],
                  },
                ],
              },
            ],
          },
        ],
      },
      { languages: ["eng"] as const },
    );

    expect(parsedContent.getExactText("eng")).toBe("UChicagoNode");
    expect(parsedContent.getExactRichText("eng")).toBe(
      '<Annotation type="text-styling" variant="label" size="lg" headingLevel="h2" cssStyles={{default: [{"label":"color","value":"var(--color-brand-700)"}], tablet: [], mobile: []}}>UChicagoNode</Annotation>',
    );
  });

  it("recursively preserves nested website rich text links and annotations", () => {
    const parsedContent = parseXMLContent(
      {
        content: [
          {
            lang: "eng",
            string: [
              {
                string: [
                  paragraphAnnotation("Featured image:"),
                  { payload: " ", whitespace: "leading trailing" },
                  {
                    links: {
                      resource: [
                        {
                          uuid: "4cbd30d0-18dc-4ef2-b872-b4dce7880c04",
                          type: "webpage",
                          href: "https://ark.lib.uchicago.edu/ark:61001/b23w8rj3328d",
                          publicationDateTime: new Date("2026-04-11T01:59:27Z"),
                          identification: identification({
                            eng: "Snyder's 1885 map",
                          }),
                        },
                      ],
                    },
                    string: [
                      { payload: "Snyder's map of Hyde Park, Illinois, 1885" },
                    ],
                  },
                  { payload: ". ", whitespace: "trailing" },
                  paragraphAnnotation("From the"),
                  { payload: " ", whitespace: "leading trailing" },
                  {
                    links: {
                      resource: [
                        {
                          uuid: "fdb5bc51-a2d2-4378-aa25-df501a87f6b5",
                          type: "webpage",
                          href: "https://node.uchicago.edu/collection/mapping-chicagoland",
                          publicationDateTime: new Date("2026-04-11T02:10:27Z"),
                          identification: identification({
                            eng: "Mapping Chicagoland",
                          }),
                        },
                      ],
                    },
                    string: [{ payload: "Mapping Chicagoland" }],
                  },
                  {
                    payload:
                      " collection. Holding institution: Chicago History Museum. ",
                    whitespace: "leading trailing",
                  },
                ],
                whitespace: "newline",
              },
            ],
          },
        ],
      },
      { languages: ["eng"] as const },
    );

    expect(parsedContent.getExactRichText("eng")).toBe(
      '<br />\n<Annotation type="text-styling" variant="paragraph" size="md">Featured image:</Annotation>   <ExternalLink href="https://ark.lib.uchicago.edu/ark:61001/b23w8rj3328d" content="Snyder\'s 1885 map">Snyder\'s map of Hyde Park, Illinois, 1885</ExternalLink>.  <Annotation type="text-styling" variant="paragraph" size="md">From the</Annotation>   <ExternalLink href="https://node.uchicago.edu/collection/mapping-chicagoland" content="Mapping Chicagoland">Mapping Chicagoland</ExternalLink>  collection. Holding institution: Chicago History Museum.  ',
    );
  });

  it("ports old resource-link variants without turning unpublished resources into links", () => {
    const parsedContent = parseXMLContent(
      {
        content: [
          {
            lang: "eng",
            string: [
              {
                string: [
                  {
                    links: {
                      resource: [
                        {
                          uuid: "f0000000-0000-4000-8000-000000000000",
                          type: "internalDocument",
                          publicationDateTime: PUBLICATION_DATE,
                          identification: identification({ eng: "Doc" }),
                        },
                      ],
                    },
                    properties: {
                      property: [
                        {
                          label: {
                            payload: "relation",
                            uuid: "f1000000-0000-4000-8000-000000000000",
                          },
                          value: [
                            {
                              payload: "cites",
                              uuid: "f2000000-0000-4000-8000-000000000000",
                            },
                          ],
                        },
                      ],
                    },
                    string: [{ payload: "doc" }],
                  },
                  {
                    links: {
                      resource: [
                        {
                          uuid: "f3000000-0000-4000-8000-000000000000",
                          type: "externalDocument",
                          identification: identification({ eng: "Draft" }),
                        },
                      ],
                    },
                    string: [{ payload: "draft" }],
                  },
                  {
                    links: {
                      resource: [
                        {
                          uuid: "f4000000-0000-4000-8000-000000000000",
                          type: "IIIF",
                          rend: "inline",
                          height: 120,
                          width: 90,
                          identification: identification({ eng: "Image" }),
                        },
                      ],
                    },
                    string: [{ payload: "image" }],
                  },
                ],
              },
            ],
          },
        ],
      },
      { languages: ["eng"] as const },
    );

    expect(parsedContent.getExactRichText("eng")).toBe(
      '<InternalLink uuid="f0000000-0000-4000-8000-000000000000" properties="f1000000-0000-4000-8000-000000000000" value="f2000000-0000-4000-8000-000000000000" content="Doc">doc</InternalLink><TooltipSpan content="Draft">draft</TooltipSpan><InlineImage uuid="f4000000-0000-4000-8000-000000000000" content="Image" height={120} width={90} />',
    );
  });
});
