import * as v from "valibot";
import { describe, expect, it } from "vitest";
import type {
  XMLContent,
  XMLIdentification,
  XMLSimplifiedProperty,
  XMLString,
} from "#/xml/types.js";
import { fetchWebsite } from "#/fetchers/website.js";
import { parseWebsite } from "#/parsers/website.js";
import { XMLWebsiteData as XMLWebsiteDataSchema } from "#/xml/schemas.js";

const PUBLICATION_DATE = "2026-01-01T00:00:00Z";

const UUID = {
  ochre: "10000000-0000-4000-8000-000000000000",
  project: "10000000-0000-4000-8000-000000000001",
  website: "10000000-0000-4000-8000-000000000002",
  page: "10000000-0000-4000-8000-000000000003",
  element: "10000000-0000-4000-8000-000000000004",
  linkedResource: "10000000-0000-4000-8000-000000000005",
  presentation: "10000000-0000-4000-8000-000000000006",
  component: "10000000-0000-4000-8000-000000000007",
  variant: "10000000-0000-4000-8000-000000000008",
  variable: "10000000-0000-4000-8000-000000000009",
  value: "10000000-0000-4000-8000-000000000010",
  scope: "10000000-0000-4000-8000-000000000011",
  segmentWrapper: "10000000-0000-4000-8000-000000000012",
  segmentTree: "10000000-0000-4000-8000-000000000013",
} as const;

function xmlString(payload: string): XMLString {
  return { payload };
}

function content(payload: string): XMLContent {
  return { content: [{ lang: "eng", string: [xmlString(payload)] }] };
}

function identification(label: string): XMLIdentification {
  return { label: content(label) };
}

function property(
  label: string,
  payload: string,
  children: Array<XMLSimplifiedProperty> = [],
): XMLSimplifiedProperty {
  return {
    label: { payload: label, uuid: UUID.presentation },
    value: [{ payload, dataType: "string" }],
    property: children,
  };
}

function documentWithDirectLinkedString() {
  return {
    content: [
      {
        lang: "eng",
        string: [
          {
            links: {
              resource: [
                {
                  uuid: UUID.linkedResource,
                  publicationDateTime: PUBLICATION_DATE,
                  type: "webpage",
                  href: "https://example.com/resource",
                  identification: identification("Linked resource"),
                },
              ],
            },
            properties: {
              property: [
                {
                  label: { payload: "<missing item>", uuid: "" },
                  value: [{ payload: "--Value--", dataType: "" }],
                },
              ],
            },
            string: [xmlString("Linked callout")],
            annotation: "10000000-0000-4000-8000-000000000014",
          },
        ],
      },
    ],
  };
}

function elementResource() {
  return {
    uuid: UUID.element,
    publicationDateTime: PUBLICATION_DATE,
    identification: identification("Text element"),
    properties: {
      property: [
        property("presentation", "element", [
          property("component", "text", [property("variant", "banner")]),
        ]),
      ],
      simplify: "true",
    },
    document: documentWithDirectLinkedString(),
  };
}

function segmentTree() {
  return {
    uuid: UUID.segmentTree,
    publicationDateTime: PUBLICATION_DATE,
    identification: {
      ...identification("Embedded website"),
      abbreviation: content("embedded-website"),
    },
    properties: {
      property: [property("presentation", "website")],
      simplify: "true",
    },
  };
}

function pageResource() {
  return {
    uuid: UUID.page,
    publicationDateTime: PUBLICATION_DATE,
    identification: identification("Home"),
    slug: "",
    properties: {
      property: [property("presentation", "page")],
      simplify: "true",
    },
    resource: [
      elementResource(),
      {
        uuid: UUID.segmentWrapper,
        publicationDateTime: PUBLICATION_DATE,
        segments: { tree: [segmentTree()] },
      },
    ],
  };
}

function websiteData() {
  return {
    result: {
      ochre: {
        uuid: UUID.ochre,
        belongsTo: "TEST",
        uuidBelongsTo: UUID.project,
        publicationDateTime: PUBLICATION_DATE,
        metadata: {
          dataset: xmlString("Dataset"),
          description: xmlString("Description"),
          publisher: xmlString("Publisher"),
          identifier: xmlString("Identifier"),
          language: [{ payload: "eng", default: "true" }],
          project: {
            uuid: UUID.project,
            identification: identification("Project"),
          },
          item: {
            identification: identification("Website"),
            category: "tree",
            type: "lesson",
          },
        },
        tree: [
          {
            uuid: UUID.website,
            publicationDateTime: PUBLICATION_DATE,
            identification: identification("Website"),
            properties: {
              property: [property("presentation", "website")],
              simplify: "true",
            },
            options: {
              scopes: {
                scope: [
                  {
                    uuid: { payload: UUID.scope, type: "tree" },
                    identification: identification("Scope"),
                  },
                ],
              },
              filterContexts: [
                {
                  context: [
                    {
                      identification: identification("Filter"),
                      filterOption: "inline-displayed",
                      levels: {
                        level: [
                          {
                            payload: `${UUID.variable},${UUID.value}`,
                            dataType: "string",
                          },
                        ],
                      },
                    },
                  ],
                },
              ],
              notes: {
                note: [
                  {
                    noteNo: "1",
                    title: "Title label",
                    payload: "Browse title",
                  },
                ],
              },
            },
            styleOptions: {
              style: [
                {
                  payload: "Important",
                  variableUuid: UUID.variable,
                  valueUuid: UUID.value,
                  category: "value",
                  textColor: "#880000",
                  lucideIcon: "search",
                },
              ],
            },
            items: { resource: [pageResource()] },
          },
        ],
      },
    },
  };
}

function minimalWebsiteXML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<result>
  <ochre uuid="${UUID.ochre}" belongsTo="TEST" uuidBelongsTo="${UUID.project}" publicationDateTime="${PUBLICATION_DATE}">
    <metadata>
      <dataset>Dataset</dataset>
      <description>Description</description>
      <publisher>Publisher</publisher>
      <identifier>Identifier</identifier>
      <language default="true">eng</language>
      <item category="tree" type="lesson">
        <identification>
          <label><content lang="eng"><string>Website</string></content></label>
        </identification>
      </item>
    </metadata>
    <tree uuid="${UUID.website}" publicationDateTime="${PUBLICATION_DATE}">
      <identification>
        <label><content lang="eng"><string>Website</string></content></label>
      </identification>
      <properties simplify="true">
        <property>
          <label uuid="${UUID.presentation}">presentation</label>
          <value dataType="string">website</value>
        </property>
      </properties>
      <items>
        <resource uuid="${UUID.page}" slug="" publicationDateTime="${PUBLICATION_DATE}">
          <identification>
            <label><content lang="eng"><string>Home</string></content></label>
          </identification>
          <properties simplify="true">
            <property>
              <label uuid="${UUID.presentation}">presentation</label>
              <value dataType="string">page</value>
            </property>
          </properties>
        </resource>
      </items>
    </tree>
  </ochre>
</result>`;
}

describe("parseWebsite", () => {
  it("parses Website XML options, simplified properties, segment wrappers, and direct linked text", () => {
    const rawData = websiteData();
    const parsedSchema = v.safeParse(XMLWebsiteDataSchema, rawData);
    expect(parsedSchema.success).toBe(true);
    if (!parsedSchema.success) {
      throw new Error("Website XML fixture should satisfy the schema");
    }

    const website = parseWebsite(parsedSchema.output, {
      languages: ["eng"] as const,
    });

    expect(website.uuid).toBe(UUID.website);
    expect(website.belongsTo).toStrictEqual({
      uuid: UUID.project,
      abbreviation: "TEST",
    });
    expect(website.properties.options.scopes?.[0]?.uuid).toBe(UUID.scope);
    expect(website.properties.options.labels.title?.getText()).toBe(
      "Browse title",
    );
    expect(website.properties.options.stylesheets.properties[0]).toMatchObject({
      uuid: UUID.value,
      variableUuid: UUID.variable,
      category: "propertyValue",
      icon: "search",
    });

    const filter = website.properties.options.contextTree?.filter[0];
    expect(filter?.filterType).toBe("property");
    expect(filter?.isInlineDisplayed).toBe(true);
    expect(filter?.context).toStrictEqual([
      { variableUuid: UUID.variable, valueUuid: UUID.value },
    ]);

    const page = website.items[0];
    if (page?.type !== "page") {
      throw new Error("Expected first Website item to be a page");
    }

    expect(page.slug).toBe("");
    expect(page.items).toHaveLength(1);

    const element = page.items[0];
    if (element?.type !== "element") {
      throw new Error("Expected first page item to be an element");
    }
    if (element.component !== "text") {
      throw new Error("Expected first element to be a text component");
    }

    expect(element.variant).toStrictEqual({ name: "banner" });
    expect(element.content.getRichText()).toContain(
      '<ExternalLink href="https://example.com/resource" content="Linked resource">Linked callout</ExternalLink>',
    );
  });
});

describe("fetchWebsite", () => {
  it("fetches Website XML by normalized abbreviation and parses it", async () => {
    let requestedUrl = "";

    const result = await fetchWebsite(" TEST-WEBSITE ", {
      fetch: async (input) => {
        requestedUrl = input.toString();
        return new Response(minimalWebsiteXML());
      },
    });

    expect(result.error).toBeNull();
    if (result.website == null) {
      throw new Error("Expected fetchWebsite to parse the XML response");
    }

    expect(decodeURIComponent(requestedUrl)).toContain("test-website");
    expect(requestedUrl).toContain("xsl=none");
    expect(result.website.uuid).toBe(UUID.website);
    expect(result.website.items[0]?.type).toBe("page");
  });
});
