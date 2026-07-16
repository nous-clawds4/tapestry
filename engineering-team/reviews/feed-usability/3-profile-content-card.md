# Review: feed-usability #3 — Pinned-note-aware profile "Content" card

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-03
**Diff:** `git diff bb680843..HEAD` (through commit `573e3f9c`)
**Story:** `feed-usability/3-profile-content-card.md`
**ADR:** `feed-usability/0003-profile-content-card.md`
**Test plan:** `feed-usability/3-profile-content-card.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **`profile-content-card` 18/18**; the other two epic suites still green
  (`notes-replies-toggle` 21/21, `feed-pagination` 17/17); `note-surfaces-ui` back to its
  baseline **18/1** (U3 now passes on `useProfileContent`; the 1 is the pre-existing
  `NoteCard`-variant R2). Overall harness is FAIL, but a **clean** run (stack stable) shows only
  pre-existing/unrelated failures: `tl-publication-from-pins` + `most-pinned-tag-index-publish`
  (flaky live-relay publish suites), `note-surfaces-ui` + `event-page-ui` (the `NoteCard`-variant
  R2 — `NoteCard.jsx` is not in this diff), `b-tag-primitive` + `b-tag-seeds` (communityReference
  scope guards). Story 3 introduces **zero** new failures.
  - *(An earlier full run showed many live-stack suites failing wholesale — an artifact of a
    `brainstorm` container restart I ran concurrently for the smoke test, not a regression. The
    clean re-run above is the authoritative result.)*
- [x] `npm run build` (ui/) — clean.
- [x] Local runtime smoke (`:7778`): **the pinned path verified against real data** — the test
  pubkey actually has a kind-10001 pin list, and `GET /api/user/:pubkey/content` returned
  `status:OK, pinned:true` with a resolved note. Invalid pubkey → 400 `INVALID`. The two UI-only
  visual states (the "Pinned" badge render; the NO_TOPLEVEL message) are covered by sentinels +
  the confirmed server states, not a browser (host lacks the Chrome extension / Playwright libs).
- [ ] Lint / typecheck — _not configured._

## Spec adherence

All six ACs covered by passing tests:
- **Pinned wins + labelled** — SB1 (`pinned:true`, item is the pin) + U3 (badge); confirmed live.
- **One of several** — SB2 (first `e`-tag) / SB2b (first *resolvable*).
- **Unresolvable pins fall through** — SB3 (→ top-level, `pinned:false`, never an error/stuck).
- **No pin → latest top-level** — SB4 (skips a newer reply via `isReply`).
- **Reply-only → explicit state** — SB5 (`NO_TOPLEVEL`) + U4 (message) + U5 (notes link stays).
- **Existing empty preserved** — SB6 (`EMPTY`) + U4 (`CONTENT_COPY.EMPTY` retained).
No behavior beyond the story (single note; no carousel; read-only; `/feed` + `/notes` untouched).

## ADR adherence

- New self-contained `src/api/notes/profileContentReadPath.js` on **`_shared/relaySource`** (the
  third consumer — the consolidation the note-surfaces ADR logged) + shared `enrichNotes`.
  Discriminated `status` union {OK, NO_TOPLEVEL, EMPTY, INVALID} with `pinned`/`item` on OK,
  behind the injectable-deps seam. Selection order exactly as specified (pinned first-resolvable
  `e`-tag → latest `!isReply` → NO_TOPLEVEL → EMPTY). New one-shot `useProfileContent(pubkey)`
  hook; section shows `data.item` + a "Pinned" badge; `/api/user/:pubkey/content` registered
  beside `/notes`. **No new dependency** (relaySource + enrichNotes only).

## Concept-graph integrity
- No concept definitions/schemas/handles changed. kind-10001 is read as a selector, kind-1/kind-0
  read as before. **No firmware reinstall required** (ADR states this). No hardcoded TA pubkey —
  the relay set resolves by slug at runtime (house rule honored). No BIBLE re-derivation.

## Things tests can't catch
- No secrets, no `console.log`/debug, no commented-out code, no TODOs in the new files.
- No hardcoded pubkeys (`grep` clean) — TA identity resolved at runtime.
- Input validation: `HEX64` gates the pubkey before any relay/Neo4j call (SB7). Pin ids come
  from untrusted relay data but are used only as `{ids}` filter values (never shell/cypher
  interpolation); the pinned note is `kind===1`-gated after fetch.
- Route order: `/api/user/:pubkey/content` is a distinct sibling of `/notes` — no shadowing
  (confirmed live). Registered in the public block before any SPA fallback.
- Best-effort selection: an older top-level note beyond the 50-note recent window reads as
  NO_TOPLEVEL — the same best-effort posture as the sibling cards, documented in the ADR.

## House rules check
- [x] Concept Graph API authority respected (no concept work); TA pubkey resolved at runtime.
- [x] No new lint/typecheck/build tooling; no new dependency.

## Findings

### Blocking
_None._

### Non-blocking
1. **`profileContentReadPath.js` (fallback window)** — "no top-level in the most-recent 50"
   reports NO_TOPLEVEL even if an older top-level note exists further back. Intended, ADR-documented
   (best-effort recent window). No action.
2. **Visual confirmation** — the "Pinned" badge and NO_TOPLEVEL copy were verified by source
   sentinel + server state, not a rendered browser (standing host limitation). Worth an eyeball on
   the live `feat/tags` deploy.

## Verdict
**PASS** — the diff matches the story, ADR, and test plan; the Story 3 suite is green and the
pinned path is confirmed against real relay data; all remaining harness failures are pre-existing
and unrelated; no concept/firmware change and no new dependency. Mergeable as-is.
