import type { FootnotesResponse } from "../../types/internal.raw.js";
import type { Footnote } from "../../types/main.js";
import { parseStringDocumentItem } from "../string.js";

/**
 * Fetches and parses footnotes from the OCHRE API
 *
 * @param uuid - The UUID of the footnote
 * @returns The parsed footnotes or null if the fetch/parse fails
 *
 * @example
 * ```ts
 * const { item: footnotes } = await fetchFootnotes("9c4da06b-f15e-40af-a747-0933eaf3587e");
 * if (footnotes === null) {
 *   console.error("Failed to fetch footnotes");
 *   return;
 * }
 * console.log(`Fetched footnotes: ${footnotes.length.toLocaleString()} footnotes`);
 * ```
 */
export async function fetchFootnotes(
  uuid: string,
  customFetch?: (
    input: string | URL | globalThis.Request,
    init?: RequestInit,
  ) => Promise<Response>,
): Promise<
  | { items: Array<Footnote> | null; error: null }
  | { items: null; error: string }
> {
  try {
    const response = await (customFetch ?? fetch)(
      `https://ochre.lib.uchicago.edu/ochre?xquery=${encodeURIComponent(`
        for $q in input()/ochre[@uuid='${uuid}']/resource/document/content//string[@annotation][links][properties/property/value/@uuid="b254b5a4-d91f-4954-8bbc-658faefc626c"]/links/child::node(), $r in input()/ochre[@uuid=$q/@uuid]
          return <footnote> {$r/resource/document} { $r/@uuid} </footnote>`)}
    &format=json&lang="*"`,
    );
    if (!response.ok) {
      throw new Error("Error fetching footnote, please try again later.");
    }

    const data = (await response.json()) as FootnotesResponse;

    if (!("footnote" in data.result)) {
      throw new Error("Failed to fetch footnote");
    }

    const footnotesRaw =
      Array.isArray(data.result.footnote) ?
        data.result.footnote
      : [data.result.footnote];

    const footnotes: Array<Footnote> = footnotesRaw.map((footnote) => {
      let returnString = "";
      const footnoteItems =
        Array.isArray(footnote.document.string) ?
          footnote.document.string
        : [footnote.document.string];

      for (const item of footnoteItems) {
        returnString += parseStringDocumentItem(item);
      }

      return { uuid: footnote.uuid, label: "", content: returnString };
    });

    return { items: footnotes, error: null };
  } catch (error) {
    console.error(error);
    return {
      items: null,
      error:
        error instanceof Error ? error.message : "Failed to fetch footnote",
    };
  }
}
