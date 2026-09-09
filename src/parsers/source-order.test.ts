import { describe, expect, it } from "vitest";
import { ochreFixture } from "#/fixtures.js";
import { parseItem } from "#/parsers/index.js";
import { XMLData as XMLDataSchema } from "#/xml/schemas.js";

const PUBLICATION_DATE = "2026-01-01T00:00:00Z";
const OCHRE_UUID = "01000000-0000-4000-8000-000000000000";
const PROJECT_UUID = "02000000-0000-4000-8000-000000000000";
const SET_UUID = "03000000-0000-4000-8000-000000000000";

/**
 * A Set whose items interleave two categories in the document
 *
 * `fast-xml-parser` groups same-named elements, so the parsed object holds one
 * array per category and loses the interleaving. Only the source offsets it
 * records alongside can put the items back in the order OCHRE sent them.
 */
function mixedSetXML(): string {
  function resource(uuid: string, label: string): string {
    return `<resource uuid="${uuid}" publicationDateTime="${PUBLICATION_DATE}"><identification><label><content lang="eng"><string>${label}</string></content></label></identification></resource>`;
  }

  function text(uuid: string, label: string): string {
    return `<text uuid="${uuid}" publicationDateTime="${PUBLICATION_DATE}"><identification><label><content lang="eng"><string>${label}</string></content></label></identification></text>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<result>
  <ochre uuid="${OCHRE_UUID}" belongsTo="TEST" uuidBelongsTo="${PROJECT_UUID}" publicationDateTime="${PUBLICATION_DATE}">
    <metadata>
      <dataset>Dataset</dataset>
      <publisher>Publisher</publisher>
      <description>Description</description>
      <identifier>Identifier</identifier>
      <language default="true">eng</language>
      <project uuid="${PROJECT_UUID}">
        <identification><label><content lang="eng"><string>Project</string></content></label></identification>
      </project>
      <item category="set" type="test">
        <identification><label><content lang="eng"><string>Item</string></content></label></identification>
      </item>
    </metadata>
    <set uuid="${SET_UUID}" publicationDateTime="${PUBLICATION_DATE}">
      <identification><label><content lang="eng"><string>Mixed set</string></content></label></identification>
      <items>
        ${resource("04000000-0000-4000-8000-000000000000", "First")}
        ${text("05000000-0000-4000-8000-000000000000", "Second")}
        ${resource("06000000-0000-4000-8000-000000000000", "Third")}
      </items>
    </set>
  </ochre>
</result>`;
}

describe("source order", () => {
  it("returns interleaved Set items in document order, not category order", () => {
    const set = parseItem(ochreFixture(mixedSetXML(), XMLDataSchema), {
      category: "set",
      containedItemCategory: ["resource", "text"] as const,
      languages: ["eng"] as const,
    });

    expect(Array.from(set.items, (item) => item.category)).toStrictEqual([
      "resource",
      "text",
      "resource",
    ]);
    expect(
      Array.from(set.items, (item) => item.identification.label.getText()),
    ).toStrictEqual(["First", "Second", "Third"]);
  });

  it("falls back to category order when the fixture carries no source offsets", () => {
    const withMetadata = ochreFixture(mixedSetXML(), XMLDataSchema);
    const withoutMetadata = structuredClone(withMetadata);

    const set = parseItem(withoutMetadata, {
      category: "set",
      containedItemCategory: ["resource", "text"] as const,
      languages: ["eng"] as const,
    });

    expect(Array.from(set.items, (item) => item.category)).toStrictEqual([
      "resource",
      "resource",
      "text",
    ]);
  });
});
