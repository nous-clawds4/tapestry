# Story 1: Simple Lists pages must work on a large relay

**Status:** Draft
**Created:** 2026-09-07
**Type:** Bug

## Background

The Tapestry control panel's **Simple Lists** section has two pages — *List Headers*
(`/tapestry/lists`) and *List Items* (`/tapestry/lists/items`). On two of the four running
deployments both pages show `Error: stdout maxBuffer length exceeded` where their content
should be. The operator reported it on 2026-09-07.

Both pages ask the relay for **every list item that exists**, with no bound. The relay-scan
path they use has a fixed ~10 MB ceiling on the response it will assemble; past roughly
11,000 items the request fails and the pages get nothing back. This is a data-volume
threshold, not a configuration difference — measured 2026-09-07 across all four deployments:

| Deployment | List items on relay | Simple Lists pages |
|---|---:|---|
| `staging.brainstorm.world` | 473,101 | fail — response would be ~416 MB, 40× the ceiling |
| `tags.brainstorm.world` | 451,662 | fail — ~397 MB |
| `tapestry.brainstorm.world` (prod) | 8,897 | work — **7.7 MB**, 2.3 MB under the ceiling |
| `localhost:7778` | 9,497 | work — **8.5 MB**, 1.5 MB under the ceiling |

Two things follow from those numbers. First, staging and tags are not an exotic edge case —
they are the deployments with real accumulated data, and they are the ones broken. Second,
**prod and local are not healthy**: about 1,700 more list items and they show the same error,
with no code change and no warning.

Worth naming because it shapes what "fixed" means: the *List Headers* page never displays
the items it fetches. It pulls all of them solely to compute one number per row — how many
items each list has — to fill an "Items" column for a few hundred rows. Hundreds of megabytes
move across the wire to produce a few hundred integers.

**Who is affected:** anyone using Simple Lists on staging or tags today (both pages, fully
blocked); operators on prod and local shortly, on the current growth path.

## User-facing description

As an operator inspecting the Tapestry control panel, I want the Simple Lists pages to load
and show me lists and their items no matter how many items the relay holds, so that I can
inspect list data on any deployment instead of hitting an error page on exactly the ones with
the most data in them.

## Acceptance criteria

- [ ] Given a deployment whose relay holds ≥ 450,000 list items (staging and tags as of
      2026-09-07), when an operator opens **List Headers**, then the page renders its table of
      list headers with no error message.
- [ ] Given that same deployment, when an operator reads any row's **Items** count, then the
      number shown is the true count of items belonging to that list — exact, not capped, not
      approximate. An item belonging to two lists counts in **both** rows.
- [ ] Given a set of lists that share items, when an operator reads the page **total**, then each
      item is counted **once** across all lists. Two lists of 10 sharing 5 items read as "10",
      "10", and a total of 15 — the per-list counts deliberately do not sum to the total.
- [ ] Given that same deployment, when an operator opens **List Items**, then the page renders
      a bounded set of items with no error, and states on screen both how many it is showing
      and how many exist in total (e.g. "showing 500 of 473,101"). A truncated view is never
      presented as a complete one.
- [ ] Given any request to the shared relay-scan API whose filter matches an unbounded number
      of events — including the exact request these pages make today,
      `{"kinds":[9999,39999]}` — when it is served, then the caller receives either a bounded
      successful result or an explicit refusal naming what to do instead. It never receives a
      `maxBuffer` failure, and never a result that is quietly partial or quietly empty.
- [ ] Given a deployment holding far fewer items than the bound (prod and local as of
      2026-09-07, ~9,000), when an operator opens either page, then neither errors and **List
      Items** shows the same set of items it shows today. Counts follow the two criteria above,
      which corrects them where today's page is wrong — measured on the local relay: 7 of 28
      counted rows read higher, and the total reads 9,368 rather than 9,497 once items belonging
      to no list stop being counted.

## Concepts touched

Handles are per-deployment; `<TA>` is the local Tapestry Assistant pubkey, resolved at runtime
(on this dev instance it is `e00ed090…9df36` — never hardcode it).

- `39998:<TA>:list` — **list** ("A list header with associated list items") — the concept both
  pages surface. List Headers renders the headers; List Items renders the items.
- `39998:<TA>:concept-header` — **concept header** — kind-39998 events carry both `ListHeader`
  and `ConceptHeader` labels, so the headers page lists concept headers too. Relevant because
  whatever supplies the per-list counts has to be right for these as well.

## Out of scope

- **Pagination or "load more" on List Items.** Decided at planning: a bounded set with its
  total stated is what this story delivers. Full browsability is feature work and can follow.
- **The sibling unbounded scan, `filterTaggingsUsingTag`.** Same class of defect, already
  triaged to the event-tagging epic's performance hardening (`stories/_intake.md`, 2026-07).
  Left there.
- **Auditing every other relay-scan caller.** Considered and declined at planning; the
  endpoint guard is what protects them.
- **The relay-scan API returning HTTP 200 with a failure in the body.** Real and adjacent — a
  failed scan is currently indistinguishable from a successful one at the transport layer —
  but changing it is a contract change affecting callers this story does not touch. Recorded
  here rather than fixed; worth an intake entry if it is not picked up.
- **Reducing the ~430,000 accumulated kind-9999 items on staging and tags.** This story makes
  the pages work *at* that scale. It does not clean data.

## Open questions

- None blocking. The size of the bounded set on List Items is an implementation choice for
  Architecture — the story constrains only that the number shown and the true total are both
  on screen, not what the bound is.

**Resolved 2026-09-07 (at the Architecture gate).** Architecture measured that the page's
current attribution rule — first `z` tag, else first `e` — is an artifact of `getTag()` rather
than a design, and undercounts every item belonging to more than one list (427 of 9,497 items
locally). The operator specified the intended semantics: per-list counts are set membership (an
item in two lists counts in both); the page total is the union (that item counts once). Criteria
2, 3 and 6 above are the amended form. See
`engineering-team/decisions/relay-scan-bounds/0001-bounded-scan-contract-and-grouped-tally.md`.

## Deviations

Judgment calls made during implementation, logged for the book-close audit.

- **Corrected a stale bullet in ADR 0001's implementation notes.** One line still
  described the superseded generic-tally sketch
  (`/api/strfry/scan/tally?...&groupBy=z,e`), contradicting the ADR's own Decision
  section and its `src/api/dlists/itemCounts.js` bullet. An en-dash in the source
  text made an earlier edit miss it. Editorial only — no decision changed.
- **Tightened one test assertion rather than degrading the code to satisfy it.**
  `U3` required `/limit:\s*\d+/`, a literal digit, which forbade the named
  constant the ADR itself specifies (`ITEMS_LIMIT = 500`). The assertion now
  accepts either form *and* additionally requires `ITEMS_LIMIT = <number>` to
  exist — strictly stronger than what it replaced, not weaker.
- **Second test-assertion correction, same cause as the first.** `D5` banned the
  substring `total.toLocaleString()` — but that substring appears in the *guarded*
  form too, so the assertion could not tell guarded from unguarded. It now requires
  a null guard to exist wherever a member is read off `total`. Mutation-verified:
  removing the guard fails it, restoring it passes. Two of the three static JSX pins
  written for this story have needed correction; crude regexes over JSX are the
  common cause, recorded as harness friction in the review rather than fixed here.
- **`total` is `null`, not a number, when a bounded read cannot learn the true
  count.** The reviewer's suggested shape left `total = events.length` alongside
  `truncated: true`, which reads as "showing 500 of 500, truncated". Reporting the
  total as unknown is the honest form, so `resolveTotal` returns `null` and both the
  relay client and the List Items render handle it. This is slightly wider than the
  literal ask and was taken deliberately.
- **`DataTable` gets `pageSize={50}` on List Items.** The ADR called for the
  component's opt-in pagination; 50 rows per page is the concrete value. 500 rows
  in one table is technically fine but unpleasant to read.

## Found, not fixed (out of scope)

- **`useProfiles` batches an unbounded pubkey set into a querystring**, so
  `GET /api/profiles?pubkeys=…` returns **400** on any page with many distinct
  authors. Same class as this story's bug — an unbounded request — but a
  different endpoint, and neither the story nor the ADR covers it. Measured on
  the local relay: List Items used to send **4,506** authors (~293 KB of URL) and
  now sends **221** (~14 KB). So this story improves it about 20× and does not
  resolve it; both exceed the ~8 KB limit. It degrades gracefully — author names
  fall back to truncated pubkeys. Worth its own story.

## Linked artifacts
- ADR: `engineering-team/decisions/relay-scan-bounds/0001-bounded-scan-contract-and-grouped-tally.md`
- Test plan: `engineering-team/stories/relay-scan-bounds/1-bound-simple-lists-relay-scans.test-plan.md`
- Review: `engineering-team/reviews/relay-scan-bounds/1-bound-simple-lists-relay-scans.md`
