# 0006. Public helpers are not removed for having no in-repo callers

Status: accepted

## Context

Two architecture passes trimmed the public surface using `grep` over `src/` and the README to find exports nothing referenced. That removed fifteen `MultilingualString` instance methods and thirty exported type aliases.

The measurement was wrong for the thing being measured. This is a library, so the callers of a public export are downstream and do not appear in this repository at all. An in-repo reference count answers "does the package use this internally", which is the right question for an `@internal` helper and says nothing at all about a public one. Consumers were using the removed methods.

## Decision

An in-repo call count is not evidence about a public export. Removing one needs a reason that survives the caller being invisible: the capability is reachable another way, or the model behind it no longer exists.

Applying that, three groups come out differently.

**Restored, because the capability was gone with no substitute.** `hasContent`, `isEmpty`, `hasLanguage`, `hasAliases`, `getSupportedLanguages`, `getEntries`, `getTexts`, `getExactTexts`, `withAliases`, plus `mapText` and `filterEntries` in place of the old `map` and `filter`, and `getLeafPropertyValues`. The four predicates also answered a boolean without allocating, where the surviving route copies an array to ask the same thing.

**Not restored, because the capability is intact.** `withText`, `withEntry` and `withoutLanguage` became `with(language, text)`, `with(language, text, { shouldAppend: true })` and `without(language)`. The eighteen `getPropertyBy*` variants became one `getProperty(properties, selector)` that expresses every combination they covered and more. These are renames and consolidations, so a consumer's build names the error and the fix is mechanical.

**Not restored, because the model is gone.** `isRichText` read a `MultilingualOptions.isRichText` flag that no parser ever set. Every entry now carries `richText` next to `text` unconditionally, so there is no longer a whole-string answer to give.

## Consequences

The interface is wider than the passes left it and the implementation is not. The pass-2 collapse conflated two findings: the language fallback chain really was hand-written five times, which was a genuine defect and is still fixed behind one private resolver, and the methods "had no callers", which was not a finding at all. Every restored read is a projection of that one resolver.

`map` came back under a new name because the old one was broken rather than merely unused: it wrote transformed plain text and let the entry's rich text be re-derived, so uppercasing a field turned `<InternalLink uuid="abc">` into markup OCHRE never wrote. `mapText` transforms plain text and rebuilds rich text from the result, and takes `{ text, richText }` for a caller that needs to control both. The corruption case is covered in `src/parsers/multilingual.test.ts`.

The thirty type aliases came back because a pure type alias over a type that still exists has no implementation to maintain, so the only thing deleting them bought was a shorter list.
