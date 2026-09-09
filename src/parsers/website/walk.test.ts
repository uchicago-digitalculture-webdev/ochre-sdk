import { describe, expect, it } from "vitest";
import type { ParserOptions } from "#/parsers/helpers.js";
import type {
  XMLIdentification,
  XMLWebsiteResource,
  XMLWebsiteResourceItem,
  XMLWebsiteSegment,
  XMLWebsiteTree,
} from "#/xml/types.js";
import {
  collectWebsitePageSlugs,
  normalizeWebsiteResources,
  readWebsitePages,
} from "#/parsers/website/walk.js";

const PRESENTATION_UUID = "10000000-0000-4000-8000-000000000099";

const OPTIONS: ParserOptions<readonly ["eng"]> = {
  languages: ["eng"] as const,
  defaultLanguage: "eng",
};

function identification(
  label: string,
  abbreviation?: string,
): XMLIdentification {
  const value: XMLIdentification = {
    label: { content: [{ lang: "eng", string: [{ payload: label }] }] },
  };
  if (abbreviation != null) {
    value.abbreviation = {
      content: [{ lang: "eng", string: [{ payload: abbreviation }] }],
    };
  }

  return value;
}

function resource(parameters: {
  uuid: string;
  slug?: string;
  presentation: string;
  children?: Array<XMLWebsiteResourceItem>;
}): XMLWebsiteResource {
  return {
    uuid: parameters.uuid,
    slug: parameters.slug,
    identification: identification(parameters.uuid),
    properties: {
      property: [
        {
          label: { payload: "presentation", uuid: PRESENTATION_UUID },
          value: [
            { payload: parameters.presentation, uuid: PRESENTATION_UUID },
          ],
        },
      ],
    },
    resource: parameters.children,
  };
}

function segmentWrapper(uuid: string, abbreviation: string): XMLWebsiteSegment {
  return {
    uuid: `${uuid}-wrapper`,
    segments: { tree: [segmentTree(uuid, abbreviation)] },
  };
}

function segmentTree(uuid: string, abbreviation: string): XMLWebsiteTree {
  return {
    uuid,
    identification: identification(uuid, abbreviation),
    items: {
      resource: [
        resource({ uuid: `${uuid}-home`, slug: "", presentation: "page" }),
        resource({
          uuid: `${uuid}-about`,
          slug: "about",
          presentation: "page",
        }),
      ],
    },
  };
}

describe("normalizeWebsiteResources", () => {
  it("flattens grouping wrappers and drops segment wrappers", () => {
    const page = resource({ uuid: "page", slug: "p", presentation: "page" });
    const normalized = normalizeWebsiteResources([
      { resource: [page] },
      segmentWrapper("seg", "docs"),
      page,
    ]);

    expect(normalized.map((item) => item.uuid)).toStrictEqual(["page", "page"]);
  });
});

describe("readWebsitePages", () => {
  it("leaves top-level page slugs unprefixed and prefixes nested ones only inside a segment", () => {
    const pages = readWebsitePages(
      [
        resource({
          uuid: "home",
          slug: "",
          presentation: "page",
          children: [
            resource({ uuid: "child", slug: "child", presentation: "page" }),
          ],
        }),
      ],
      OPTIONS,
    );

    expect(pages).toHaveLength(1);
    expect(pages[0]?.slug).toBe("");
    expect(pages[0]?.children[0]?.slug).toBe("child");
  });

  it("prefixes every page under a segment with the segment slug", () => {
    const pages = readWebsitePages(
      [
        resource({
          uuid: "top",
          slug: "top",
          presentation: "page",
          children: [
            resource({ uuid: "nested", slug: "nested", presentation: "page" }),
          ],
        }),
      ],
      OPTIONS,
      "docs",
    );

    expect(pages[0]?.slug).toBe("docs/top");
    expect(pages[0]?.children[0]?.slug).toBe("docs/top/nested");
  });

  it("does not descend into resources that are not pages", () => {
    const pages = readWebsitePages(
      [
        resource({
          uuid: "block",
          presentation: "block",
          children: [
            resource({ uuid: "buried", slug: "buried", presentation: "page" }),
          ],
        }),
      ],
      OPTIONS,
    );

    expect(pages).toStrictEqual([]);
  });

  it("reads a page's segments with the page slug as their prefix", () => {
    const pages = readWebsitePages(
      [
        resource({
          uuid: "home",
          slug: "home",
          presentation: "page",
          children: [segmentWrapper("seg", "docs")],
        }),
      ],
      OPTIONS,
    );

    expect(pages[0]?.segments).toHaveLength(1);
    expect(pages[0]?.segments[0]?.slugPrefix).toBe("home/docs");
  });

  it("throws when a page carries no slug", () => {
    expect(() =>
      readWebsitePages(
        [resource({ uuid: "no-slug", presentation: "page" })],
        OPTIONS,
      ),
    ).toThrow(/Slug not found for page/);
  });

  it("throws when a segment tree carries no abbreviation", () => {
    const wrapper = segmentWrapper("seg", "docs");
    delete wrapper.segments.tree[0]!.identification.abbreviation;

    expect(() =>
      readWebsitePages(
        [
          resource({
            uuid: "home",
            slug: "home",
            presentation: "page",
            children: [wrapper],
          }),
        ],
        OPTIONS,
      ),
    ).toThrow(/Slug not found for segment website/);
  });
});

describe("collectWebsitePageSlugs", () => {
  it("maps every page, including pages reached through a segment", () => {
    const pages = readWebsitePages(
      [
        resource({
          uuid: "home",
          slug: "",
          presentation: "page",
          children: [
            resource({ uuid: "child", slug: "child", presentation: "page" }),
            segmentWrapper("seg", "docs"),
          ],
        }),
      ],
      OPTIONS,
    );

    expect(
      Object.fromEntries(collectWebsitePageSlugs(pages, OPTIONS)),
    ).toStrictEqual({
      home: "",
      child: "child",
      "seg-home": "docs",
      "seg-about": "docs/about",
    });
  });

  it("records nothing for a page the parser would never reach", () => {
    const pages = readWebsitePages(
      [
        resource({
          uuid: "element",
          presentation: "element",
          children: [
            resource({ uuid: "buried", slug: "buried", presentation: "page" }),
          ],
        }),
      ],
      OPTIONS,
    );

    expect(collectWebsitePageSlugs(pages, OPTIONS).size).toBe(0);
  });
});
