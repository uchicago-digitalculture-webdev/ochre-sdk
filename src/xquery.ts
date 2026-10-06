import { DEFAULT_LANGUAGES } from "#/constants.js";

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
 * XQuery prolog declaring `local:select-language`, which keeps one language of
 * every multilingual field in a node sequence
 *
 * A field's `content` children are reduced to the one in `$language`, else the
 * one in `$fallback`, else the first in any language, which is the choice the
 * API's own `lang` parameter makes. `zxx` content is always kept, since it holds
 * a field's aliases rather than a translation; the API's `lang` parameter drops
 * it, which is why the SDK selects languages itself. Leaf elements are
 * returned by reference; testing for multilingual descendants before copying a
 * subtree measured slower than copying it.
 */
const LANGUAGE_XQUERY_PROLOG = `declare function local:select-language($nodes as node()*, $language as xs:string, $fallback as xs:string) as node()* {
  for $node in $nodes
  return
    typeswitch ($node)
    case element() return
      if (empty($node/*))
      then $node
      else
        let $contents := $node/content[@xml:lang]
        let $selected :=
          if (empty($contents))
          then ()
          else (
            $contents[@xml:lang = $language],
            $contents[@xml:lang = $fallback],
            $contents[@xml:lang != "zxx"]
          )[1]
        return element { node-name($node) } {
          $node/@*,
          for $child in $node/node()
          return
            if ($child instance of element(content) and exists($child/@xml:lang))
            then
              if ($child is $selected or $child/@xml:lang = "zxx")
              then $child
              else ()
            else local:select-language($child, $language, $fallback)
        }
    default return $node
};`;

/**
 * Which language a query should return, and what to show where it is missing
 */
export type OchreContentLanguage = {
  language: string;
  fallbackLanguage: string;
};

/**
 * Resolve the content language a fetch asked for
 * @param options - The fetch options
 * @param options.language - The language to keep
 * @param options.fallbackLanguage - The language shown where `language` is missing
 * @returns The content language, or null to keep every language
 * @internal
 */
export function getContentLanguage(options?: {
  language?: string;
  fallbackLanguage?: string;
}): OchreContentLanguage | null {
  if (options?.language == null) {
    return null;
  }

  return {
    language: options.language,
    fallbackLanguage: options.fallbackLanguage ?? DEFAULT_LANGUAGES[0],
  };
}

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
 * @param parameters.contentLanguage - Keep only this language of every multilingual field in the result
 * @returns A complete XQuery document
 * @internal
 */
export function compileOchreQuery(parameters: {
  declarations?: ReadonlyArray<string>;
  body: (context: OchreQueryContext) => string;
  contentLanguage?: OchreContentLanguage | null;
}): string {
  const { declarations = [], body, contentLanguage } = parameters;

  const prologDeclarations: Array<string> = [
    'xquery version "1.0-ml";',
    ...declarations,
    SUPPLEMENTAL_XQUERY_PROLOG,
    ...(contentLanguage == null ? [] : [LANGUAGE_XQUERY_PROLOG]),
  ];

  const bodyExpression = body({
    omitSupplemental: (expression) => `local:omit-supplemental(${expression})`,
    notSupplemental: NOT_SUPPLEMENTAL_PREDICATE,
  });

  return `${prologDeclarations.join("\n\n")}

${
  contentLanguage == null
    ? bodyExpression
    : `local:select-language((
${bodyExpression}
), ${stringLiteral(contentLanguage.language)}, ${stringLiteral(contentLanguage.fallbackLanguage)})`
}`;
}
