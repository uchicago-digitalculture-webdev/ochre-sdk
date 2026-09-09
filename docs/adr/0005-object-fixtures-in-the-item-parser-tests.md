# 0005. The item parser tests keep object fixtures

Status: accepted

## Context

`src/parsers/index.test.ts` builds its fixtures as object literals typed `XMLData`, which is the shape after the schema has run. Two things follow: the fixture never passes through a schema, so it can take a shape OCHRE could not send; and it carries none of the source-offset metadata `fast-xml-parser` attaches, so the two source-order sorts in the parser silently take their declaration-order fallback.

`ochreFixture` in `src/fixtures.ts` fixes both by decoding XML the way the fetchers do.

## Decision

Fixtures that need the real thing are written as XML and go through `ochreFixture`. The existing object fixtures in `src/parsers/index.test.ts` stay as they are.

## Consequences

Moving those fixtures to the pre-transform side needs a type for the pre-transform shape, and there is not one: the schema roots are `v.GenericSchema<unknown, T>` (see [0001](0001-hand-written-xml-types.md)), so `v.InferInput` on them is `unknown`. Deriving it instead, by mapping `Date`, `number` and `boolean` fields back to `string`, does type-check, but it cascades into every fixture helper and the compiler starts reporting twenty-line expanded types. Dropping the annotations entirely would trade compile-time shape checking for runtime schema checking, which is not obviously a gain.

The behavior that only an XML fixture can reach is covered directly, in `src/parsers/source-order.test.ts`, including the negative case: the same fixture with its metadata stripped comes back in category order rather than document order.

Revisit if the schema roots ever stop needing the `GenericSchema` annotation.
