# 0004. Domain types keep names that shadow ES and DOM globals

Status: accepted

## Context

Fifteen exported type names collide with globals: `Set`, `Text`, `Image`, `Event`, `Metadata`, `Query`, `Note`, `Person`, `Property`, `Context`, `Heading`, `License`, `Gallery`, `Section` and `Style`. `Set` is the one that looks dangerous, because a consumer who imports it might expect `new Set()` to stop working in that file.

## Decision

The names stay.

## Consequences

The hazard is not real. These are all type-only exports, and TypeScript keeps type-only imports out of the value namespace, so `import { Set } from "@digitalcultureandsociety/ochre-sdk"` leaves `new Set<string>()` working. Checked with `tsc --strict` under both a plain import and `import type`. Under `verbatimModuleSyntax` a plain import is an error at the import line, telling the consumer to use a type-only import, which is a clear message rather than silent breakage.

Against that, these are the OCHRE domain vocabulary. A Set is what OCHRE calls a Set. Renaming all fifteen would be a breaking change to the primary names a consumer works with, in exchange for nothing measurable.

Do not re-propose renaming them without a reported consumer problem.
