# 0001. The raw XML types stay hand-written rather than derived from the schemas

Status: accepted

## Context

`src/xml/types.ts` declares what an OCHRE response looks like, and `src/xml/schemas.ts` validates it. Two declarations of the same thing invites drift, and it did drift: six pairs disagreed, which is how every Tree came to lose its `type`.

The obvious fix is to delete the hand-written types and derive them with `v.InferOutput`.

## Decision

The declared types stay, and are checked against the schemas instead.

Each schema infers its own shape, and 62 of the pairs are asserted against their declared type: the key sets must match exactly, so an extra or missing field fails the build, and the output must still satisfy the declared type.

## Consequences

Deriving the types would have rewritten the public type surface in 37 places. Those 37 pairs are mutually assignable but not structurally identical: optional key versus undefined-valued, union ordering, intersections versus flattened objects. Consumers read these names, so changing their spelling is a breaking change with no behavior behind it, and the drift the derivation was meant to prevent is now a build error anyway.

Five roots are annotated `v.GenericSchema<unknown, T>` because their inferred types exceed what the compiler will serialize. A side effect is that `v.InferInput` on those roots is `unknown`, so nothing can be typed against the pre-transform shape of a whole response. See [0005](0005-object-fixtures-in-the-item-parser-tests.md).
