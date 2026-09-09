# 0003. A Property facet's value is decided once, in XQuery

Status: accepted

## Context

The facet query and its response decoder both worked out which value a facet stands for. Only the TypeScript half handled OCHRE's `xs:` prefix on `dataType`, which is what made the typed branches dead: OCHRE always sends `xs:integer`, never `integer`.

## Decision

The query computes the canonical value it already needs for its grouping key and returns it as `canonicalValue`. The decoder gives that string a type rather than re-deriving the value from `rawValue`, `uuid` and the label.

The facet XQuery stays in `src/fetchers/set/property-values.ts` rather than moving into `src/query.ts`. `query.ts` owns query fragments that more than one fetcher composes; the facet projection has one caller and is meaningless without the decoder sitting beside it.

## Consequences

The facet key and the facet content can no longer disagree.

Verified unchanged on the `uchicago-node` scope: 947 IDREF facets, counts summing to 32815, every content equal to its value UUID; string facets keep their content and counts.
