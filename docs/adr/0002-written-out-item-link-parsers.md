# 0002. The repeated item link and Set parsers stay written out

Status: accepted

## Context

`src/parsers/index.ts` holds five `parse*ItemLink` functions with byte-identical bodies, and five identical Set variants. They look like an obvious candidate for one generic function.

## Decision

They stay written out.

## Consequences

A single generic cannot prove an object literal matches `ItemLink<U, T>` for a generic `U`, so collapsing them requires casting through the discriminated union at the one place that currently gets checked. Trading that type safety for roughly twenty lines is the wrong way round.

Revisit only if TypeScript gains a way to check an object literal against a generic member of a discriminated union.
