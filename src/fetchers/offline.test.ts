import { describe, expect, it } from "vitest";
import { fetchGallery } from "#/fetchers/gallery.js";
import { fetchItemChildren } from "#/fetchers/item-children.js";
import { fetchItemLinks } from "#/fetchers/item-links.js";
import { fetchItemOcrData } from "#/fetchers/item-ocr-data.js";
import { fetchWebsiteMetadata } from "#/fetchers/website-metadata.js";
import { ochreFixtureFetch } from "#/fixtures.js";

const ITEM_UUID = "10000000-0000-4000-8000-000000000000";
const CHILD_UUID = "10000000-0000-4000-8000-000000000001";
const PAGE_UUID = "10000000-0000-4000-8000-000000000002";

function ochre(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<result><ochre uuid="${ITEM_UUID}" belongsTo="TEST" uuidBelongsTo="${ITEM_UUID}" publicationDateTime="2026-01-01T00:00:00Z">${body}</ochre></result>`;
}

function linkedResourceXML(uuid: string, label: string): string {
  return `<resource uuid="${uuid}">
  <identification><label><content lang="eng"><string>${label}</string></content></label></identification>
</resource>`;
}

describe("fetchItemLinks", () => {
  it("posts a query branching on every collection category alias and parses the links", async () => {
    const mock = ochreFixtureFetch(
      ochre(`<items>${linkedResourceXML(CHILD_UUID, "Linked")}</items>`),
    );

    const result = await fetchItemLinks(ITEM_UUID, { fetch: mock.fetch });

    expect(result.error).toBeNull();
    expect(result.items?.[0]?.uuid).toBe(CHILD_UUID);

    const body = mock.requests[0]!.body;
    expect(body).toContain(`let $item-uuid := "${ITEM_UUID}"`);
    expect(body).toContain("$source-items/observations/observation/links/*");
    expect(body).toContain('fn:collection("ochre/resource")');
    expect(body).toContain("local:omit-supplemental(");
  });

  it("reports an invalid UUID without reaching the network", async () => {
    const mock = ochreFixtureFetch("");

    const result = await fetchItemLinks("not-a-uuid", { fetch: mock.fetch });

    expect(result.items).toBeNull();
    expect(result.error).not.toBeNull();
    expect(mock.requests).toHaveLength(0);
  });
});

describe("fetchItemChildren", () => {
  it("posts a child query for the requested item and parses the children", async () => {
    const mock = ochreFixtureFetch(
      ochre(`<items>${linkedResourceXML(CHILD_UUID, "Child")}</items>`),
    );

    const result = await fetchItemChildren(ITEM_UUID, { fetch: mock.fetch });

    expect(result.error).toBeNull();
    expect(result.items?.[0]?.uuid).toBe(CHILD_UUID);
    expect(mock.requests[0]!.body).toContain(ITEM_UUID);
  });
});

describe("fetchGallery", () => {
  it("parses a gallery projection and posts the project abbreviation", async () => {
    const mock = ochreFixtureFetch(
      ochre(`<gallery maxLength="1">
  <project uuid="${ITEM_UUID}">
    <identification><label><content lang="eng"><string>Project</string></content></label></identification>
  </project>
  <item uuid="${ITEM_UUID}" category="resource">
    <identification><label><content lang="eng"><string>Item</string></content></label></identification>
  </item>
  ${linkedResourceXML(CHILD_UUID, "Gallery resource")}
</gallery>`),
    );

    const result = await fetchGallery(
      { uuid: ITEM_UUID, page: 1, perPage: 10 },
      { fetch: mock.fetch },
    );

    expect(result.error).toBeNull();
    expect(result.gallery?.resources[0]?.uuid).toBe(CHILD_UUID);
    expect(result.gallery?.maxLength).toBe(1);
    expect(mock.requests[0]!.body).toContain(ITEM_UUID);
  });
});

describe("fetchItemOcrData", () => {
  it("matches OCR words by case-folded local name and scopes the search to one document", async () => {
    const mock = ochreFixtureFetch(
      ochre(`<ocrStrings found="true">
  <ocrString resourceUuid="${CHILD_UUID}" content="Chicago" x="10" y="20" width="30" height="40" vertices="" />
</ocrStrings>`),
    );

    const result = await fetchItemOcrData(ITEM_UUID, "Chicago", {
      fetch: mock.fetch,
    });

    expect(result.error).toBeNull();
    expect(result.ocrStrings?.[0]).toMatchObject({
      resourceUuid: CHILD_UUID,
      content: "Chicago",
      x: 10,
      y: 20,
    });

    const body = mock.requests[0]!.body;
    expect(body).toContain(`doc("${ITEM_UUID}")`);
    expect(body).toContain('lower-case(local-name(.)) = "ocr"');
    expect(body).toContain('lower-case(local-name(.)) = "string"');
    expect(body).not.toContain("local:omit-supplemental(");
  });

  it("reports an item with no OCR layer as an error rather than an empty result", async () => {
    const mock = ochreFixtureFetch(ochre(`<ocrStrings found="false" />`));

    const result = await fetchItemOcrData(ITEM_UUID, "Chicago", {
      fetch: mock.fetch,
    });

    expect(result.ocrStrings).toBeNull();
    expect(result.error).not.toBeNull();
  });
});

describe("fetchWebsiteMetadata", () => {
  it("resolves a slug through the shared page slug rules", async () => {
    const mock = ochreFixtureFetch(
      ochre(`<metadata>
  <dataset>Dataset</dataset>
  <publisher>Publisher</publisher>
  <description>Description</description>
  <identifier>Identifier</identifier>
  <language default="true">eng</language>
  <project uuid="${ITEM_UUID}">
    <identification><label><content lang="eng"><string>Project</string></content></label></identification>
  </project>
  <item category="tree" type="website">
    <identification><label><content lang="eng"><string>Website</string></content></label></identification>
  </item>
</metadata>
<tree uuid="${ITEM_UUID}">
  <identification><label><content lang="eng"><string>Website</string></content></label></identification>
  <properties simplify="true">
    <property><label uuid="${ITEM_UUID}">presentation</label><value>website</value></property>
  </properties>
  <items>
    <resource uuid="${PAGE_UUID}">
      <identification><label><content lang="eng"><string>About</string></content></label></identification>
    </resource>
  </items>
</tree>`),
    );

    const result = await fetchWebsiteMetadata("TEST-WEBSITE", {
      slug: "/docs/about/",
      fetch: mock.fetch,
    });

    expect(result.error).toBeNull();
    expect(result.websiteMetadata?.uuid).toBe(ITEM_UUID);
    expect(result.websiteMetadata?.webpageTitle?.getText()).toBe("About");

    const body = mock.requests[0]!.body;
    expect(body).toContain('let $target-slug := "docs/about"');
    expect(body).toContain('$website/tree[1], $target-slug, ""');
    expect(body).toContain("declare function local:page-slug(");
    expect(body).toContain("declare function local:page-child-slug-prefix(");
  });

  it("requires a slug", async () => {
    const mock = ochreFixtureFetch("");

    const result = await fetchWebsiteMetadata("TEST-WEBSITE", {
      slug: undefined!,
      fetch: mock.fetch,
    });

    expect(result.websiteMetadata).toBeNull();
    expect(result.error).not.toBeNull();
    expect(mock.requests).toHaveLength(0);
  });
});
