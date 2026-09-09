import { describe, expect, it } from "vitest";
import type { ParserOptions } from "#/parsers/helpers.js";
import type { ItemLinks, SimplifiedProperty } from "#/types/index.js";
import type { WebElementComponent } from "#/types/website.js";
import type {
  XMLIdentification,
  XMLSimplifiedProperty,
  XMLWebsiteResource,
} from "#/xml/types.js";
import { parseLinks, parseSimplifiedProperties } from "#/parsers/index.js";
import { parseBounds } from "#/parsers/website/bounds.js";
import { WEB_ELEMENT_COMPONENT_PARSERS } from "#/parsers/website/components.js";
import { websitePresentationReader } from "#/parsers/website/reader.js";

const OPTIONS: ParserOptions<readonly ["eng"]> = {
  languages: ["eng"] as const,
  defaultLanguage: "eng",
};

const PAGE_UUID = "10000000-0000-4000-8000-000000000001";
const IMAGE_UUID = "10000000-0000-4000-8000-000000000002";
const LABEL_UUID = "10000000-0000-4000-8000-000000000003";

function identification(label: string): XMLIdentification {
  return {
    label: { content: [{ lang: "eng", string: [{ payload: label }] }] },
  };
}

type XMLPropertyValue = NonNullable<XMLSimplifiedProperty["value"]>[number];

function property(
  label: string,
  value: XMLPropertyValue | string,
  children: Array<XMLSimplifiedProperty> = [],
): XMLSimplifiedProperty {
  return {
    label: { payload: label, uuid: LABEL_UUID },
    value: [typeof value === "string" ? { payload: value } : value],
    property: children,
  };
}

/**
 * The six-field bag every component parser takes, with nothing around it
 *
 * There is no `ochre` envelope, no website tree and no page here: narrowing
 * the parsers to the page slug map is what makes that possible.
 */
function parameters(options: {
  component: string;
  componentProperties?: Array<XMLSimplifiedProperty>;
  links?: XMLWebsiteResource["links"];
  pageSlugs?: ReadonlyMap<string, string>;
}) {
  const elementResource: XMLWebsiteResource = {
    uuid: "10000000-0000-4000-8000-000000000000",
    identification: identification("Element"),
    links: options.links,
  };

  const parsed: Array<SimplifiedProperty<readonly ["eng"]>> =
    parseSimplifiedProperties(
      {
        property: [
          property(
            "component",
            options.component,
            options.componentProperties ?? [],
          ),
        ],
      },
      OPTIONS,
    );
  const componentProperty = parsed[0]!;

  const websiteLinks: ItemLinks<readonly ["eng"]> = parseLinks(
    elementResource.links,
    OPTIONS,
  );

  return {
    componentProperty,
    componentReader: websitePresentationReader(componentProperty.properties),
    elementResource,
    websiteLinks,
    options: OPTIONS,
    pageSlugs: options.pageSlugs,
  };
}

describe("web element component parsers", () => {
  it("reads a flat component from its defaults table", () => {
    const component = WEB_ELEMENT_COMPONENT_PARSERS["empty-space"](
      parameters({
        component: "empty-space",
        componentProperties: [
          property("height", { payload: "20", uuid: LABEL_UUID }),
          property("width", "50%"),
        ],
      }),
    );

    expect(component).toStrictEqual({
      component: "empty-space",
      height: "20",
      width: "50%",
    });
  });

  it("resolves a button target through the page slug map", () => {
    const component = WEB_ELEMENT_COMPONENT_PARSERS.button(
      parameters({
        component: "button",
        componentProperties: [
          property("link-to", {
            payload: "about",
            uuid: PAGE_UUID,
            slug: "about",
          }),
        ],
        pageSlugs: new Map([[PAGE_UUID, "docs/about"]]),
      }),
    );

    expect(component).toMatchObject({
      component: "button",
      href: "docs/about",
      isExternal: false,
      isRelative: true,
    });
  });

  it("falls back to the raw slug when no page slug map is supplied", () => {
    const component = WEB_ELEMENT_COMPONENT_PARSERS.button(
      parameters({
        component: "button",
        componentProperties: [
          property("link-to", {
            payload: "about",
            uuid: PAGE_UUID,
            slug: "about",
          }),
        ],
      }),
    );

    expect(component).toMatchObject({ component: "button", href: "about" });
  });

  it("builds every linked image the same way", () => {
    const component = WEB_ELEMENT_COMPONENT_PARSERS.image(
      parameters({
        component: "image",
        links: {
          resource: [
            {
              uuid: IMAGE_UUID,
              type: "image",
              identification: identification("Photo"),
              image: { width: 120, height: 80 },
            },
          ],
        },
      }),
    );

    expect(component).toMatchObject({
      component: "image",
      images: [{ uuid: IMAGE_UUID, width: 120, height: 80, quality: "high" }],
    });
  });

  it("names the component and the element when a required link is missing", () => {
    expect(() =>
      WEB_ELEMENT_COMPONENT_PARSERS.map(parameters({ component: "map" })),
    ).toThrow(/Map link not found for component “map”/);
  });

  it("covers every component OCHRE can name", () => {
    const componentNames: Array<WebElementComponent["component"]> = Object.keys(
      WEB_ELEMENT_COMPONENT_PARSERS,
    ) as Array<WebElementComponent["component"]>;

    expect(componentNames).toHaveLength(21);
  });
});

describe("parseBounds", () => {
  it("parses the semicolon form", () => {
    expect(parseBounds("1,2;3,4")).toStrictEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("parses the JSON form", () => {
    expect(parseBounds(" [[1,2],[3,4]]")).toStrictEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("rejects malformed JSON", () => {
    expect(() => parseBounds("[[1,2],")).toThrow(/Invalid bounds/);
  });

  it("rejects JSON that is not a pair of number pairs", () => {
    expect(() => parseBounds('[["a","b"],[3,4]]')).toThrow(/Invalid bounds/);
  });

  it("rejects a pair that is not numeric", () => {
    expect(() => parseBounds("1,2;3,x")).toThrow(/Invalid bounds/);
  });

  it("rejects a pair of the wrong length", () => {
    expect(() => parseBounds("1,2,3;4,5")).toThrow(/Invalid bounds/);
  });
});
