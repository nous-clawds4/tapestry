# Review: Story 7 — Event-tagging read, the viewer's own stance ("mine" channel)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-30
**Diff:** `git diff f11937f7..db752c9c` (impl commit `db752c9c`, tests `f11937f7`)
**Story:** `engineering-team/stories/event-tagging/7-event-tagging-read-viewer-own-stance.md`
**ADR:** `engineering-team/decisions/event-tagging/0007-event-tagging-read-viewer-own-stance.md`

## Quality gates (run by reviewer, not trusted)

- [x] `node test/event-tagging-read-viewer-stance.test.js` — **12 passed, 0 failed** (classifier + source-contract + live HTTP smoke).
- [x] `node test/event-tagging-read-api.test.js` (Story 4, additive guard) — **11 passed, 0 failed** — the change did not alter existing read behavior.
- [x] `node test/event-tagging-core.test.js` — **15 passed, 0 failed**, incl. the purity guard that now scans the modified `classify.js` → the classifier is still dependency-/IO-free.
- [x] `node test/event-tagging-write-path.test.js` (sanity) — **19 passed, 0 failed**.
- [x] `package.json` untouched — no new deps/lint/build tooling (CLAUDE.md honored).
- [ ] _Lint / typecheck / build — not configured; none added._

## Spec adherence (acceptance criteria → passing test)

- [x] **My applied tag reflected when POV untrusts me** → `mine: a viewer the POV does NOT trust still sees their own APPLIED tag in mine`. `classify.js:104-110` routes the viewer's own candidate to `mine` **before** the trust filter at `:112`.
- [x] **My disputed tag reflected, same condition** → `mine: …DISPUTED…` (stance from the polarity bucket).
- [x] **Distinct from the community count + no tally inflation** → `mine: …surfaced in mine but NEVER inflates the counted tally`. The trust filter (`:112`) still gates the counted set only; the untrusted viewer never reaches `tagsMap`.
- [x] **Latest-wins reflects a flip** → `mine: reflects the current (deduped-latest) stance…`. `mineMap` keeps latest-by-`createdAt` (`:106-109`); the apply↔dispute collapse is inherited from upstream `dedupeReplaceable` + the deterministic assertion `d` (documented; proven in the write-path suite).
- [x] **Backward-compatible + additive** → `mine: …omitting viewerPubkey yields mine:[] and byte-identical tags/unverifiable`. No `viewerPubkey` → `mineMap` stays empty → `mine: []`, and `tags`/`unverifiable` are unchanged (deep-equality asserted).
- [x] **How the viewer is identified (hex-validated)** → `src: for-event threads a hex-validated req.query.viewerPubkey…`. `index.js:142` uses the existing `isHexPubkey` (`:35`); malformed → `undefined` → no `mine`.
- [x] No behavior added beyond the story. UI consumption correctly **deferred to Story 6**.

### ADR-resolved edges (also tested)

- [x] **Open-Q1 — own *unverifiable* assertion excluded from `mine`** (stays in `unverifiable`): handled by the pre-existing `continue` at the header-absent gate, which runs before the `mine` block. Test green.
- [x] **Own assertion under an *un-honored authority* excluded from `mine`**: the legitimacy `continue` (`:90`) runs before the `mine` block. Test green.
- [x] **`mine` is additive, not exclusive** — a TRUSTED viewer appears in both `tags` and `mine`. Test green.
- [x] **`mine` entry shape** `{ tag:{authorPubkey,slug}, stance, eventId, createdAt }`. Test green.

## ADR adherence

- [x] **Option A, verbatim.** The `viewerPubkey`/`mine` logic lives in the pure core `classifyEventTaggings` (not the handler), exactly as ADR 0007 decided over Options B (handler-side, drift) and C (double-pass). `classify.js:99-103` is the key reorder — polarity bucket computed **before** the trust filter so it gates both channels.
- [x] **Legitimacy-gated, trust-unfiltered.** The `mine` block sits *after* the header/honored-authority/tag-identity gates and *before* the trust filter — precisely the ADR's "two axes, bypass trust only."
- [x] **Purely additive contract.** One optional param, one new return field; no `viewerPubkey` → identical output. Covered by the read-api + purity suites staying green.
- [x] **Handler thread-through** matches the ADR's implementation notes (`index.js:142-150`): read hex-validated `req.query.viewerPubkey`, pass to the classifier, add `mine` to `res.json`. No change to scan/headers/authorities/POV.

## Concept-graph integrity

- [x] No concept/firmware change → no reinstall (as ADR states).
- [x] No hardcoded TA/author literals introduced. The viewer/author matching is pure pubkey equality; tag identity continues to come from the header's `a`-coordinate.

## Things tests can't catch

- [x] No secrets, no debug logging, no commented-out code in the diff.
- [x] Comments are accurate and explain *why* the bucket moved (gates both channels) and *why* `mine` is latest-by-createdAt (defensive; upstream dedupes).
- [x] Input validation at the boundary: `viewerPubkey` hex-validated before use; a malformed value degrades to "no viewer" rather than erroring or composing anything.
- [x] Concurrency: the classifier is pure with no shared state; the handler is stateless. No races.
- [x] End-to-end confirmed against the live stack (after restarting the in-container `brainstorm` process to load the new code): `for-event` returns `mine` with and without `viewerPubkey`; `tags`/`unverifiable` unchanged.

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint/typecheck/build tooling without an ADR.
- [x] Server-side edits require an in-container process restart (Node doesn't hot-reload `require`d modules under the bind-mount) — done; the HTTP gate is green against fresh code.

## Findings

### Blocking
_None._

### Non-blocking
1. **`classify.js:97,121`** — `readPolarity(c)` is evaluated twice per counted candidate (once in `bucketize(readPolarity(c))`, once building the entry's `polarity`). This is a **pre-existing** micro-redundancy (not introduced here) on a pure, cheap function — noting only for awareness; no change requested.
2. **`classify.js` — asymmetry between `mine` (a `Map`, one latest entry per tag) and the counted set (arrays of all trusted asserters).** This is *intentional and correct* — `mine` is the viewer's single current stance, the counted set is a list — and it's documented in the JSDoc. Called out so a future reader doesn't "normalize" the two.

## Verdict

**PASS**

The implementation is the smallest change that satisfies the ADR: a reordered legitimacy/trust split plus a `mine` `Map` in the pure core, and a two-line handler thread-through. All 10 acceptance criteria (plus the ADR-resolved edges) have passing tests; the counted tally is provably unaffected; the change is additive and backward-compatible (Story-4 read-api + core purity stay green). This unblocks Story 6.
