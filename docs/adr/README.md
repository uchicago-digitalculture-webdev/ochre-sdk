# Architecture decision records

One file per decision that a future reader would otherwise re-litigate. These exist because the reasons were previously recorded only in commit bodies, which meant every architecture review had to re-derive them from `git log` before it could avoid re-proposing work that had already been reasoned through and rejected.

Record a decision here when the reason is durable and specific to this codebase. Skip it when the reason is "not worth it right now" or self-evident from the code. For what the OCHRE words mean, see [CONTEXT.md](../../CONTEXT.md).

| ADR                                                      | Decision                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------ |
| [0001](0001-hand-written-xml-types.md)                   | The raw XML types stay hand-written rather than derived from the schemas |
| [0002](0002-written-out-item-link-parsers.md)            | The repeated item link and Set parsers stay written out                  |
| [0003](0003-facet-value-resolved-server-side.md)         | A Property facet's value is decided once, in XQuery                      |
| [0004](0004-domain-type-names-shadow-globals.md)         | Domain types keep names that shadow ES and DOM globals                   |
| [0005](0005-object-fixtures-in-the-item-parser-tests.md) | The item parser tests keep object fixtures                               |
