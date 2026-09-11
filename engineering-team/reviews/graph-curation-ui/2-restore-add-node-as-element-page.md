# Review: Story 2 — Restore the "Add Node as Element" page

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-09
**Diff:** `git diff origin/staging...HEAD` (implementation commit `23a851ff`)
**Story:** `engineering-team/stories/graph-curation-ui/2-restore-add-node-as-element-page.md`
**ADR:** `engineering-team/decisions/graph-curation-ui/0002-shared-author-display-util.md`

## Quality gates (run by reviewer, not trusted)

- [x] **Story suite — 14/14 pass.** `test/add-node-as-element-restore.test.js`: U1–U5 (executed
      against the new util), S1–S4 (source), R1–R5 (regression sentinels). Re-run by the
      reviewer, not taken on the Implementer's word.
- [x] **Affected-suite regression run — 497 passed, 0 failed, 2 skipped across 25 suites.**
      The 25 are every suite under `test/` that references any file this diff touches
      (`App.jsx`, `useProfiles`, `AddNodeAsElement`, `pages/nodes/Index`, `authorDisplay`),
      enumerated by grep rather than chosen by hand.
- [ ] **Full `npm test` — NOT COMPLETED, and not claimed.** Two separate obstacles, both
      pre-existing and neither caused by this diff:
      1. `npm test` buffers: after 20 minutes it had emitted **zero bytes**, which reads as a
         hang. Running `node test/test.js` directly streams normally — so the "hang" was the
         wrapper, not the runner.
      2. Run directly, it reached roughly 6 of ~100 suites in 5 minutes and was still crawling
         through relay-I/O publish-flow suites against the live local stack. This is the
         condition OPEN.md row 27 describes; the repo's own practice is that the binding gate
         is the stack-free subset with Docker **down**, which is not available here because the
         operator's stack is in use. The affected-suite run above is the substitute, and it is
         narrower than a full run. Stated plainly rather than papered over.
- [x] Manual verification (the test plan assigns this to the Reviewer — it is not optional here,
      because nothing in the suite mounts the page). Performed on `:7778` after
      `npm --prefix ui run build` + `docker cp dist/.`. Details under *Spec adherence*.
- [ ] _Playwright — not applicable (owner-gated flow, no NIP-07 signer in the automated browser)._
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build: `npm --prefix ui run build` succeeded (11.07s); `dist/` is gitignored and not committed._

## Spec adherence

Every acceptance criterion, checked against the live page — not inferred from the tests.

| AC | Verified how | Result |
|---|---|---|
| 1 — picker renders, no error screen | Opened the route; picker rendered, 200+ candidates, page usable | ✅ |
| 2 — author filter shows display names, narrows | Dropdown rendered `🤖 Tapestry Assistant`, `tapestry_dev (82b75e47…)`, `david's Brainstorm Assistant (919ba08a…)`; selecting the TA narrowed the list | ✅ |
| 3 — label filter narrows | `ConceptHeader` narrowed 200+ → 57 | ✅ |
| 4 — already-added marked | `nostr relay` rendered as **"already element"** | ✅ |
| 5 — confirm adds the element | Selection → `→ Review Selection` → review page renders the exact edge: `(superset for the concept of firmware concepts) —[:HAS_ELEMENT]→ (…)`. **The final Confirm click was deliberately NOT performed** — see below | ⚠️ partial |
| 6 — breadcrumb | Reads "Add Node as Element"; route path unchanged | ✅ |

- [x] No criterion silently dropped.
- [x] No behavior added that isn't in the story — one guard excepted, recorded as finding NB-3.
- [ ] **AC-5 is verified through every step except the terminal write.** Clicking Confirm would
      add an element the operator did not ask for (the session's instruction was `nostr relay`
      only, with the wider survey deliberately deferred). Everything up to the write is proven:
      selection state, the review page, and the rendered relationship. The write path itself
      rests on R4 + R5 (client and server wiring) plus the fact that this same endpoint was
      exercised successfully earlier in the session. **Confirmed no accidental write:**
      `firmware concept` still reports `elementCount: 1` after the walkthrough.

## ADR adherence

- [x] Files changed match the ADR's implementation notes **exactly** — the five it named, no others:
      `ui/src/utils/authorDisplay.js` (new), `AddNodeAsElement.jsx`, `nodes/Index.jsx`,
      `useProfiles.js`, `App.jsx`. +24/−21.
- [x] Layering respected: the util is pure — no React, no fetch, no imports at all. Executable
      by the Node runner, which is the property the ADR was chosen for.
- [x] No new dependencies.
- [x] Route path `elements/add-node` unchanged, as the ADR required (four inbound links).
- [x] **Bug class eliminated tree-wide:** a sweep for `.get(` on any profiles value across
      `ui/src` returns nothing.
- [ ] Two documented deviations from the ADR's letter — NB-2 and NB-3 below. Neither changes the
      design; both are recorded rather than waved through.

## Concept-graph integrity

- [x] Handles remain `kind:pubkey:slug`; the diff constructs none.
- [x] **No TA-pubkey literal anywhere in the new code.** The util takes every identity as a
      parameter; callers pass `taPubkey` from `useConfig()`, resolved at runtime (CLAUDE.md).
      This is stronger than what it replaced, which closed over component-scope constants.
- [x] No concept definition changed → **no firmware reinstall required.**
- [x] No new code re-derives domain knowledge from BIBLE.md.

## Things tests can't catch

- [x] No secrets. Swept the diff for 64-hex strings and `nsec1` — none.
- [x] No `console.log`, no `debugger`, no commented-out code, no TODO/FIXME in the diff.
- [x] Edge cases handled: absent/empty/null profiles, unnamed identities, `display_name`
      fallback, unmatched pubkey.
- [x] Concurrency: not applicable — the util is pure and synchronous.
- [x] Security: no new input boundary. The util only reads and formats; the owner gate on the
      write path is untouched.
- [x] Dead code: the removed copies are gone, not commented out.

## House rules check

- [x] Concept Graph API authority respected (no source-of-truth bypass).
- [x] No lint/typecheck/build tooling added.
- [x] TA pubkey never hardcoded.

## Findings

### Blocking

None.

### Non-blocking

1. **NB-1 — `engineering-team/decisions/graph-curation-ui/0002…md` "The duplication": the ADR
   says "two copies of one function." There are seven.** Five remain after this story:
   `ui/src/pages/databases/Neo4jOverview.jsx:45`, `ui/src/pages/lists/Index.jsx:153`,
   `ui/src/pages/concepts/ConceptElements.jsx:230`, `ui/src/pages/concepts/ConceptList.jsx:188`,
   `ui/src/pages/events/DListItemsList.jsx:123`. Four are byte-identical to the extracted
   version; **`Neo4jOverview.jsx:48` has already diverged**, computing `short` via a
   `shortPubkey(pk)` helper instead of the inline slice. So the ADR's rationale — "one function
   instead of two … cannot re-diverge" — is only partly achieved, and divergence beyond the two
   the ADR knew about had already begun before this story.
   *Why not blocking:* every remaining copy is **correct** (the tree-wide `.get(` sweep is
   clean), the story's acceptance criteria are all met, and folding in five more working pages
   would exceed both the story's scope and the ADR's authorization — it needs its own ADR, not a
   kick-back. Optional improvement: file a follow-up story to retire the remaining five onto the
   new util, and correct the ADR's count in place so the record isn't wrong.

2. **NB-2 — `ui/src/pages/concepts/AddNodeAsElement.jsx:56` and `ui/src/pages/nodes/Index.jsx:57`
   introduce a thin `authorLabel(pk)` wrapper** instead of calling the imported
   `authorDisplayName` directly, which is what the ADR's implementation notes said to do.
   *This is correct, not drift:* a local `function authorDisplayName` in the component body
   would **shadow** the module import, silently making the import dead and leaving the old code
   path in force — precisely the failure the story exists to fix. The ADR's literal instruction
   was not safely implementable as written. Optional improvement: footnote the ADR so the next
   reader doesn't "fix" the wrapper away.

3. **NB-3 — `ui/src/utils/authorDisplay.js:33` adds a falsy-pubkey guard the ADR did not
   authorize.** ADR 0002 says "Behavior is the existing function's, preserved exactly"; this
   returns `''` where the original would have thrown on `pk.slice`. The change is defensive and
   sound — without it an `undefined` pubkey compares equal to an `undefined` `ownerPubkey` and
   wrongly earns the owner's crown, a latent bug in both copies it replaces — and it is
   unreachable with today's callers (`WHERE n.pubkey IS NOT NULL` upstream). Accepted, but on
   the record as a deviation rather than absorbed silently.

4. **NB-4 — AC-5's terminal write is unproven by any automated test and by this review.** See
   *Spec adherence*. The first real add of the operator's concept survey is the natural
   exercise; if it fails there, this story is implicated.

### Harness friction *(each becomes an OPEN.md row, type `meta`)*

1. **These stories have no book.** The `graph-curation-ui` book
   (`engineering-team/audits/graph-curation-ui/book.md`) is **Closed** (2026-07-23) and covers
   story 1 only. Stories #2/#3 were opened into a closed-book epic because `/plan-feature` does
   not perform the Phase-0 eager anchor — the recurrence of **OPEN.md row 29**, now with a second
   instance. Consequence for this gate: **completion detection has no anchor to compute against,
   so `/close-book` is not offered.**
2. **CLAUDE.md's local-dev note is wrong about this container.** It states the repo is
   bind-mounted to `/usr/local/lib/node_modules/brainstorm` so "source edits are live."
   `docker inspect tapestry` shows **no bind mount** — four data volumes only; the code and
   `dist/` are baked into the image. The container was serving a stale `index.html` pointing at
   the pre-fix bundle, which cost the Implementer a detour. The working path is the one
   `.claude/skills/cycle-local/SKILL.md` documents: build, then
   `docker cp dist/. tapestry:/usr/local/lib/node_modules/brainstorm/dist/`.
3. **`npm test` emits nothing while running.** Zero bytes after 20 minutes; `node test/test.js`
   directly streams fine. Distinct from OPEN.md row 27 (which is about *duration* against a live
   stack) — this is *buffering*, and it makes a slow run indistinguishable from a hung one.

## Verdict

**PASS**

The diff does exactly what the story asked and exactly what the ADR specified — the five named
files, no more. The defect class is gone tree-wide, the story suite passes 14/14, and 25
affected suites pass 497/0. All six acceptance criteria were verified against the running page,
not merely against the tests.

Two things keep this verdict honest rather than clean: the full `npm test` could not be
completed in this environment for documented pre-existing reasons, and AC-5's terminal write was
deliberately not exercised. Both are recorded above rather than smoothed over. Neither is
grounds to block: the substitute gate is real and targeted, and the unexercised step is one the
operator will run within the hour.

NB-1 is the finding worth carrying forward — the ADR's central claim about duplication was
factually wrong, and five copies remain — but the remedy is a follow-up story, not a kick-back
to an Implementer who built what was specified.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed: **no book covers this story** (the epic's book is Closed;
      harness friction item 1). No book arithmetic is possible, and `/close-book` is **not**
      offered. Recorded here as a structural fact about the work, not as a verdict.
