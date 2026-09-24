/**
 * Build a string literal for an XQuery string
 * @param value - The string value to escape
 * @returns The escaped string literal
 * @internal
 */
export function stringLiteral(value: string): string {
  const escapedDoubleQuote = value.replaceAll('"', '""');
  return `"${escapedDoubleQuote}"`;
}

/**
 * A comment every query puts inside the `<ochre>` element it returns
 *
 * The API answers a failed query with a bare `<result><ochre/></result>`, and
 * sends the same response whenever the returned `<ochre>` element holds fewer
 * than 25 characters. Padding keeps an empty or not-found result above that
 * cutoff, so the bare response only ever means failure. The XML parser drops
 * comments, so no schema sees it.
 * @internal
 */
export const OCHRE_RESPONSE_PADDING =
  "<!--ochre-sdk: keeps an empty result distinct from a failed query-->";

/**
 * XQuery prolog declaring `local:omit-supplemental`, which drops every element
 * carrying `supplemental="true"` from a node sequence, at any depth.
 *
 * Subtrees without a supplemental descendant are returned by reference, so
 * nodes are only copied along the path leading to an omitted element. The
 * lookahead walks the attribute axis (`//@supplemental`) rather than testing
 * every element, which measures around three times faster on large documents.
 *
 * Private on purpose: it is only correct when it precedes a body that calls it,
 * and {@link compileOchreQuery} is the only thing that can guarantee that.
 */
const SUPPLEMENTAL_XQUERY_PROLOG = `declare function local:omit-supplemental($nodes as node()*) as node()* {
  for $node in $nodes
  return
    if ($node instance of element())
    then
      if ($node/@supplemental = "true")
      then ()
      else if (empty($node//@supplemental[. = "true"]))
      then $node
      else element { node-name($node) } {
        $node/@*,
        local:omit-supplemental($node/node())
      }
    else $node
};`;

/**
 * What a query body can ask the surrounding document for
 *
 * Handed to the body rather than imported by it, so a body cannot reference a
 * prolog declaration the document did not emit.
 */
export type OchreQueryContext = {
  /**
   * Wrap a node expression so supplemental nodes are omitted from it
   * @param expression - The XQuery expression returning the nodes to filter
   * @returns The wrapped XQuery expression
   */
  omitSupplemental: (expression: string) => string;
  /**
   * An XQuery predicate keeping only nodes that are neither supplemental
   * themselves nor nested inside a supplemental node. Use it when aggregating
   * over nodes instead of returning them.
   */
  notSupplemental: string;
};

const NOT_SUPPLEMENTAL_PREDICATE =
  '[not(ancestor-or-self::*[@supplemental = "true"])]';

/**
 * Compile a complete XQuery document for the OCHRE API
 *
 * Owns the version declaration, the prolog ordering, and the
 * supplemental-stripping helper. The body receives what it is allowed to call,
 * so the helper cannot be invoked without having been declared, and every
 * fetcher stops restating the same preamble.
 * @param parameters - The document parameters
 * @param parameters.declarations - Prolog declarations, emitted in order before the supplemental helper
 * @param parameters.body - Builds the query body
 * @returns A complete XQuery document
 * @internal
 */
export function compileOchreQuery(parameters: {
  declarations?: ReadonlyArray<string>;
  body: (context: OchreQueryContext) => string;
}): string {
  const { declarations = [], body } = parameters;

  const prologDeclarations: Array<string> = [
    'xquery version "1.0-ml";',
    ...declarations,
    SUPPLEMENTAL_XQUERY_PROLOG,
  ];

  return `${prologDeclarations.join("\n\n")}

${body({
  omitSupplemental: (expression) => `local:omit-supplemental(${expression})`,
  notSupplemental: NOT_SUPPLEMENTAL_PREDICATE,
})}`;
}
