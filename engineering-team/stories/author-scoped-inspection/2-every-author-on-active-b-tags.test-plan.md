# Test plan — author-scoped-inspection #2: every author on Active b-tags

**Story:** `engineering-team/stories/author-scoped-inspection/2-every-author-on-active-b-tags.md`
**ADR:** `engineering-team/decisions/author-scoped-inspection/0002-author-scoped-views-on-active-b-tags.md`
**Suites:** `test/author-scoped-inspection-views.test.js` · `tests/brainstorm/author-scoped-inspection.spec.js`

## Levels and why

The page is JSX and cannot be imported without a transform, so the split follows
`shared-concepts-row-detail`: **S** pins what a browser cannot see (that the scan really stopped
narrowing server-side, rather than narrowing client-side on top of a server filter that is still
there), **E** pins what only a browser can answer (which rows a selection yields), and **R** pins
what must not move.

The Playwright scan stub **honors an `authors` filter**. That is load-bearing: a stub that always
returned everything would let an implementation that kept the server-side narrowing *and* added
client-side filtering pass, while being wrong against a real relay.

## Coverage

| Test | Asserts | AC |
|---|---|---|
| S1 | the `queryRelay` filter carries no `authors`, and still carries `kinds` | AC-1 |
| S2 | the `if (!taPubkey) return` guard is gone — the page renders without the owner's assistant | AC-1 |
| S4 | `author (local)` exists, `author (shared)` survives, and the local one comes first | AC-2 |
| S5 | the subtitle no longer says "locally-authored" | AC-4 |
| S9 | `AuthorCell` names any roster assistant, not only the owner's | AC-2 |
| R1 | the `b-tag-deferred` sentinel is still skipped at row-build time | AC-3 |
| R2 | still exactly one `queryRelay` call | ADR §Decision |
| R3 | the community-relay target lookup is untouched | §Out of scope |
| E2 | Everyone lists all five authors, foreign ones included | AC-1 |
| E3 | the table has both author columns; a foreign row names its signer by pubkey | AC-2 |
| E13 | the sentinel row reaches no row under any selection | AC-3 |

**AC-5** (12 → 16 rows on this dev instance, naming the four newly-visible authors) is a **smoke
step, not an automated assertion**: it is a claim about *this machine's relay contents today*,
which no hermetic suite may depend on. It is verified by hand against `localhost:7778` at
`/cycle-local` time and recorded in the review.

## Expected before implementation

S1, S2, S4, S5, S9 **FAIL**. R1, R2, R3 **PASS** (regression guards). E2, E3, E13 **FAIL**.

## Prerequisites

None for the Node suite. The Playwright spec mocks every HTTP dependency and deliberately lets the
community relay websocket fail, so no stack and no fixtures are needed.
