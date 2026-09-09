import { describe, expect, it } from "vitest";
import { MultilingualString } from "#/parsers/multilingual.js";

const LANGUAGES = ["eng", "spa", "deu"] as const;

function build(
  content: Partial<Record<"eng" | "spa" | "deu", Array<string>>>,
  options?: { defaultLanguage?: string; aliases?: Array<string> },
) {
  return MultilingualString.fromEntries(content, LANGUAGES, {
    defaultLanguage: options?.defaultLanguage ?? "eng",
    aliases: options?.aliases,
  });
}

describe("hasContent and isEmpty", () => {
  it("disagree for a language whose only entry is whitespace", () => {
    const value = build({ eng: [" ".repeat(3)] });

    expect(value.isEmpty()).toBe(false);
    expect(value.hasContent()).toBe(false);
    expect(value.hasLanguage("eng")).toBe(true);
  });

  it("finds text carried by a non-primary entry", () => {
    const value = build({ eng: ["", "Second"] });

    expect(value.getText()).toBe("");
    expect(value.hasContent()).toBe(true);
  });

  it("finds text in a language other than the default", () => {
    const value = build({ spa: ["Hola"] }, { defaultLanguage: "eng" });

    expect(value.hasContent()).toBe(true);
    expect(value.hasLanguage("eng")).toBe(false);
    expect(value.hasLanguage("spa")).toBe(true);
  });

  it("reports an empty string as empty and contentless", () => {
    const value = MultilingualString.empty(LANGUAGES);

    expect(value.isEmpty()).toBe(true);
    expect(value.hasContent()).toBe(false);
  });

  it("treats a string carrying only aliases as empty", () => {
    const value = build({}, { aliases: ["ABC"] });

    expect(value.isEmpty()).toBe(true);
    expect(value.hasContent()).toBe(false);
    expect(value.hasAliases()).toBe(true);
  });
});

describe("language lists", () => {
  it("separates the languages configured from the languages carrying content", () => {
    const value = build({ eng: ["Hello"] });

    expect(value.getSupportedLanguages()).toStrictEqual(["eng", "spa", "deu"]);
    expect(value.getAvailableLanguages()).toStrictEqual(["eng"]);
  });

  it("hands back a copy rather than the internal list", () => {
    const value = build({ eng: ["Hello"] });
    value.getSupportedLanguages().push("fra" as never);

    expect(value.getSupportedLanguages()).toHaveLength(3);
  });
});

describe("multi-entry reads", () => {
  it("returns every entry for the resolved language", () => {
    const value = build({ eng: ["First", "Second"] });

    expect(value.getTexts()).toStrictEqual(["First", "Second"]);
    expect(value.getEntries().map((entry) => entry.isPrimary)).toStrictEqual([
      true,
      false,
    ]);
  });

  it("falls back to a language that has content", () => {
    const value = build(
      { spa: ["Hola", "Buenas"] },
      { defaultLanguage: "eng" },
    );

    expect(value.getTexts("deu")).toStrictEqual(["Hola", "Buenas"]);
    expect(value.getExactTexts("deu")).toStrictEqual([]);
    expect(value.getExactTexts("spa")).toStrictEqual(["Hola", "Buenas"]);
  });

  it("carries rich text alongside plain text on every entry", () => {
    const value = build({ eng: ["*One*", "Two"] });

    expect(value.getEntries()[0]?.richText).toBe(value.getRichText());
    expect(value.getEntries()).toHaveLength(2);
  });
});

describe("mapText", () => {
  it("rebuilds rich text from the transformed text instead of transforming markup", () => {
    const value = MultilingualString.fromEntries(
      {
        eng: [
          {
            text: "Linked callout",
            richText: '<InternalLink uuid="abc">Linked callout</InternalLink>',
          },
        ],
      },
      LANGUAGES,
      { defaultLanguage: "eng" },
    );

    const mapped = value.mapText((text) => text.toLocaleUpperCase("en-US"));

    expect(mapped.getText()).toBe("LINKED CALLOUT");
    expect(mapped.getRichText()).not.toContain("INTERNALLINK");
    expect(mapped.getRichText()).not.toContain("UUID");
  });

  it("uses both fields when the transform supplies them", () => {
    const value = build({ eng: ["one"] });

    const mapped = value.mapText((text) => ({
      text: text.toLocaleUpperCase("en-US"),
      richText: `<em>${text}</em>`,
    }));

    expect(mapped.getText()).toBe("ONE");
    expect(mapped.getRichText()).toBe("<em>one</em>");
  });

  it("keeps every language, entry count and primary flag", () => {
    const value = build({ eng: ["a", "b"], spa: ["c"] });

    const mapped = value.mapText((text) => `${text}!`);

    expect(mapped.getAvailableLanguages()).toStrictEqual(["eng", "spa"]);
    expect(mapped.getExactTexts("eng")).toStrictEqual(["a!", "b!"]);
    expect(mapped.getExactTexts("spa")).toStrictEqual(["c!"]);
    expect(mapped.getEntries()[0]?.isPrimary).toBe(true);
  });

  it("leaves the original untouched", () => {
    const value = build({ eng: ["one"] });
    value.mapText(() => "changed");

    expect(value.getText()).toBe("one");
  });
});

describe("filterEntries", () => {
  it("drops entries and re-marks the first survivor as primary", () => {
    const value = build({ eng: ["skip", "keep"] });

    const filtered = value.filterEntries((entry) => entry.text === "keep");

    expect(filtered.getExactTexts("eng")).toStrictEqual(["keep"]);
    expect(filtered.getEntries()[0]?.isPrimary).toBe(true);
  });

  it("moves the default language when it loses every entry", () => {
    const value = build(
      { eng: ["drop"], spa: ["keep"] },
      { defaultLanguage: "eng" },
    );

    const filtered = value.filterEntries((entry) => entry.text === "keep");

    expect(filtered.hasLanguage("eng")).toBe(false);
    expect(filtered.getDefaultLanguage()).toBe("spa");
    expect(filtered.getText()).toBe("keep");
  });

  it("keeps the default language when it still has an entry", () => {
    const value = build(
      { eng: ["keep"], spa: ["drop"] },
      { defaultLanguage: "eng" },
    );

    const filtered = value.filterEntries((entry) => entry.text === "keep");

    expect(filtered.getDefaultLanguage()).toBe("eng");
  });

  it("can empty the string entirely", () => {
    const value = build({ eng: ["one"] });

    const filtered = value.filterEntries(() => false);

    expect(filtered.isEmpty()).toBe(true);
    expect(filtered.getText()).toBe("");
  });

  it("sees rich text and the primary flag, not just the text", () => {
    const value = build({ eng: ["one", "two"] });

    const filtered = value.filterEntries((entry) => entry.isPrimary);

    expect(filtered.getExactTexts("eng")).toStrictEqual(["one"]);
  });
});

describe("withAliases", () => {
  it("replaces the aliases and drops empty ones", () => {
    const value = build({ eng: ["one"] }, { aliases: ["OLD"] });

    const updated = value.withAliases(["A", "", "B"]);

    expect(updated.getAliases()).toStrictEqual(["A", "B"]);
    expect(value.getAliases()).toStrictEqual(["OLD"]);
  });

  it("leaves the content and default language alone", () => {
    const value = build(
      { eng: ["one"], spa: ["uno"] },
      { defaultLanguage: "spa" },
    );

    const updated = value.withAliases(["A"]);

    expect(updated.getText()).toBe("uno");
    expect(updated.getDefaultLanguage()).toBe("spa");
    expect(updated.getAvailableLanguages()).toStrictEqual(["eng", "spa"]);
  });

  it("survives a JSON round-trip", () => {
    const value = build({ eng: ["one"] }).withAliases(["A"]);

    const restored = MultilingualString.fromJSON(value.toJSON(), LANGUAGES);

    expect(restored.getAliases()).toStrictEqual(["A"]);
    expect(restored.getText()).toBe("one");
    expect(restored.getDefaultLanguage()).toBe("eng");
  });
});
