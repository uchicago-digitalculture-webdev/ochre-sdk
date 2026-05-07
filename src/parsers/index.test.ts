import { describe, expect, it } from "vitest";
import type {
  XMLContent,
  XMLData,
  XMLIdentification,
  XMLResource,
  XMLString,
  XMLText,
} from "#/types/xml/types.js";
import {
  PRESENTATION_ITEM_UUID,
  TEXT_ANNOTATION_TEXT_STYLING_HEADING_LEVEL_UUID,
  TEXT_ANNOTATION_TEXT_STYLING_UUID,
  TEXT_ANNOTATION_TEXT_STYLING_VARIANT_UUID,
  TEXT_ANNOTATION_UUID,
} from "#/constants.js";
import { parseItem } from "#/parsers/index.js";
import { parseXMLContent, parseXMLString } from "#/parsers/string.js";

const PUBLICATION_DATE = "2026-01-01T00:00:00Z";

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
      itemCategory: "resource",
      languages: ["eng", "spa"] as const,
      isRichText: true,
    });

    expect(tree.belongsTo).toStrictEqual({
      uuid: "30000000-0000-4000-8000-000000000000",
      abbreviation: "TEST",
    });
    expect(tree.metadata.dataset).toBe("Dataset");
    expect(tree.identification.label.getExactText("spa")).toBe("Arbol");
    expect(tree.itemsCategory).toBe("resource");
    expect(tree.properties[0]?.label.name).toBe("presentation");
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
      itemCategory: ["tree", "resource", "text"] as const,
      languages: ["eng"] as const,
    });

    expect(set.itemsCategory).toStrictEqual(["tree", "resource", "text"]);
    expect(set.items).toHaveLength(3);
    const itemCategories: Array<string> = [];
    for (const item of set.items) {
      itemCategories.push(item.category);
    }
    expect(itemCategories).toStrictEqual(["tree", "resource", "text"]);
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
});

describe("string parser integration", () => {
  it("does not duplicate text before parsed email links", () => {
    expect(
      parseXMLString(
        { payload: "Contact me@example.com" },
        { isRichText: true, parseEmail: true },
      ),
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
      { languages: ["eng"] as const, isRichText: false },
    );

    expect(parsedContent.getExactText("eng")).toBe("Line one\n");
  });

  it("falls back to available XML content when a requested language is missing", () => {
    const parsedContent = parseXMLContent(
      { content: [{ lang: "spa", string: [{ payload: "Hola" }] }] },
      { languages: ["eng"] as const, isRichText: false },
    );

    expect(parsedContent.getExactText("eng")).toBe("Hola");
  });

  it("ports whitespace options and permanent URL rewriting from the old parser", () => {
    expect(
      parseXMLString(
        { payload: "word", whitespace: "leading trailing" },
        { isRichText: false, parseEmail: false },
      ),
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
      { languages: ["eng"] as const, isRichText: true },
    );

    expect(parsedContent.getExactText("eng")).toBe(
      '<ExternalLink href="https://ochre.lib.uchicago.edu/ochre/v2/ochre.php?uuid=c0000000-0000-4000-8000-000000000000" content="Website">site</ExternalLink>',
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
      { languages: ["eng"] as const, isRichText: true },
    );

    expect(parsedContent.getExactText("eng")).toBe(
      '<Annotation type="text-styling" variant="inline" size="lg" headingLevel="2">Styled</Annotation>',
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
                          height: "120",
                          width: "90",
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
      { languages: ["eng"] as const, isRichText: true },
    );

    expect(parsedContent.getExactText("eng")).toBe(
      '<InternalLink uuid="f0000000-0000-4000-8000-000000000000" properties="f1000000-0000-4000-8000-000000000000" value="f2000000-0000-4000-8000-000000000000" content="Doc">doc</InternalLink><TooltipSpan content="Draft">draft</TooltipSpan><InlineImage uuid="f4000000-0000-4000-8000-000000000000" content="Image" height={120} width={90} />',
    );
  });
});
