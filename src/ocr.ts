import { stringLiteral } from "#/xquery.js";

// The namespace is an identifier matched verbatim against the documents, not
// an address, so it has to stay on http.
// eslint-disable-next-line unicorn/prefer-https -- XML namespace identifier, not a URL
const ALTO_NAMESPACE = "http://www.loc.gov/standards/alto/ns-v2#";

/**
 * The local names OCHRE serves OCR word elements under
 *
 * OCHRE varies the casing, and serves the elements both in the ALTO namespace
 * and in no namespace at all. Every selector over the layer has to accept all
 * of them: an `xs:QName("String")` narrowing matches 2 of the 18,446 documents
 * carrying an OCR layer, while the ALTO-namespaced `String` matches 14,650.
 */
const OCR_WORD_LOCAL_NAMES = ["String", "string"] as const;

const OCR_WORD_CASE_FOLDED_LOCAL_NAME = "string";

/**
 * The name of the element wrapping an OCR layer inside an OCHRE document
 * @internal
 */
export const OCR_LAYER_ELEMENT_NAME = "ocr";

/**
 * The attribute an OCR word element holds its word in
 *
 * The word is in the attribute rather than in the element's text content.
 * @internal
 */
export const OCR_WORD_CONTENT_ATTRIBUTE = "CONTENT";

/**
 * An XQuery sequence of every QName an OCR word element can carry
 *
 * Use with the `cts:element-*` query constructors, which need concrete QNames
 * and cannot match on a case-folded local name the way {@link buildOcrWordPath}
 * does. This has to stay in agreement with that path: a word element the
 * narrowing misses is a document the search silently drops.
 * @internal
 */
export const OCR_WORD_QNAMES = `(${[
  ...OCR_WORD_LOCAL_NAMES.map(
    (localName) =>
      `fn:QName(${stringLiteral(ALTO_NAMESPACE)}, ${stringLiteral(localName)})`,
  ),
  ...OCR_WORD_LOCAL_NAMES.map(
    (localName) => `xs:QName(${stringLiteral(localName)})`,
  ),
].join(", ")})`;

/**
 * Build an XQuery path selecting every OCR word element beneath a node
 *
 * Matches the layer and the word elements on a case-folded `local-name()`
 * rather than a name test, because a name test silently matches nothing when
 * OCHRE varies the casing or serves the elements in a namespace. Word elements
 * are selected at any depth, because the hierarchy between the layer and its
 * words is irregular and is not parsed.
 * @param rootExpression - The XQuery expression to select from
 * @returns The XQuery path
 * @internal
 */
export function buildOcrWordPath(rootExpression: string): string {
  return `${rootExpression}//*[lower-case(local-name(.)) = ${stringLiteral(OCR_LAYER_ELEMENT_NAME)}]//*[lower-case(local-name(.)) = ${stringLiteral(OCR_WORD_CASE_FOLDED_LOCAL_NAME)}][@${OCR_WORD_CONTENT_ATTRIBUTE}]`;
}
