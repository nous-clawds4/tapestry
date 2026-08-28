# Review: Story 4 — Manual Treasure-Map editor

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-27
**Diff:** `git diff c4002d21...HEAD` (tests `93c3d97f` → impl `27763f0b` → review-fix commit),
branch `feat/tl-treasure-map-manual-editor`

## Quality gates (run by reviewer, not trusted)

- [x] Scoped gate (story's Type-block command, brace-redirect, foreground) — **TOTAL_FAIL=0,
      EXIT=0** re-run after the docblock fix (22 + 8 + 6 + 5). The J3 judge's runs: one
      transient red (guard H2 timeout, unrelated environmental — see Harness friction), then
      fully green with 0 skips.
- [x] Story-2 panel suite — EXIT=0 (18/18; cross-suite regression net).
- [x] `cd ui && npm run build` (vite) — **EXIT=0**.
- [x] Browser (localhost:7778, rebuilt bundle): route loads, **zero console errors**; logged-in
      flow is Gate B's (same NIP-07 boundary as stories 2–3).
- [x] `bash scripts/harness-lint.sh` — clean at review commit.
- [ ] Full `npm test` — deferred to book close (imminent; the close runs the full registry).

## Spec adherence

| AC | Verdict | Evidence |
|---|---|---|
| AC-1 toggle, exact title, all states | ✅ | S7 (verbatim title; ≥2 `<ManualEditSection` mounts — green and amber branches both) |
| AC-2 current found event verbatim, editable | ✅ | S8 (`JSON.stringify(event, null, 2)` seed — the found event with id/sig, not the derived preview); S7 (`<textarea`) |
| AC-3 publish only when dirty | ✅ | S8 (`text !== baseline` textual gate; `Publish updated event` verbatim); pristine text renders no button |
| AC-4 re-stamp policy + drift-guarded sign + gated publish + re-search | ✅ | U8 (id/sig dropped, tags honored, skew-proof created_at, kind default); S9 + S1 (helper + signer/publish chain); R3/R4 (gate + both-fail contract intact); `onPublished` chains to the page's existing `search` |
| AC-5 invalid input → error, no publish | ✅ | U9 (eight invalid shapes each throw with a message — incl. absent tags, non-string items, non-string content); the section's own catch renders its own error box (source-verified; see Findings on S9's thin assertion) |
| AC-6 opt-in flow unchanged | ✅ | S1/S2/R1 green in the same runs; impl diff touches only the util (additive) and the card |

- [x] No criterion silently dropped; no behavior beyond the story.

## ADR adherence
- [x] No wire decisions added (J1 walked the triggers): the published object is user-authored;
      replacement mechanics (fresh skew-proof `created_at`, signer identity, full-event
      replace) are ADR 0001 §3 as already shipped. `kind`-defaults-to-10040 is a client input
      default, not a convention readers must parse.
- [x] Consumed-not-modified: publish utils and `TrustedAssertions.jsx` absent from the diff.

## Concept-graph integrity
- [x] No concept definitions changed; no firmware reinstall; no new handles.

## Things tests can't catch
- [x] Rules of hooks: `ManualEditSection` is a proper module-level component; all hooks precede
      any conditional return; keyed mounts (`key={event.id}`) legally remount on event change —
      E1's stale-edit discard works by construction.
- [x] The dirty gate can never fire while closed (`dirty = open && …`), so no phantom publish
      button after toggling shut.
- [x] Injection: textarea content is state, never rendered as markup; errors render as text
      nodes; the composed object goes to the signer, not to any HTML sink.
- [x] The manual path cannot bypass the signer-drift guard or the deployment publish gate —
      same chain as the opt-in path (`getActiveSignerOrThrow` → `signEvent` → `publishOrThrow`).
- [x] Destructive-but-valid edits (`tags: []`) publish as the user wrote them (E4, deliberate —
      the editor is an escape hatch, not a nanny); the hint line discloses the re-stamp policy.

## House rules check
- [x] No pubkey/relay literals (R5 covers the card and util); no new tooling or dependencies.

## Gate-A classification (ratified)
**Design note, no ADR — correct.** Client-side escape hatch over ratified mechanics; J1
confirmed no trigger fires. Ratified per light-profile.md Gate B.

## Findings

### Blocking
None.

### Non-blocking
1. **test S9 (J2's flag, confirmed)** — S9's name promises "its own error surface" but asserts
   only the helper import/wiring; the error-surface behavior is actually carried by U9 (throws)
   + the section's own catch/error box, which I verified in source. If the suite is ever
   re-aimed, give S9 a real error-render assertion.
2. **treasureMap.js docblock (J3's cosmetic catch, fixed here)** — the impl commit had left
   `upsertGenericTlTag`'s docblock dangling above `composeManualUpdate`; both docblocks now sit
   with their functions (review-fix commit in this branch).

### Harness friction
1. Guard test H2 (`strfry-write-assertion-bracket`) flaked red once on a timeout during J3's
   gate run with the stack demonstrably up, green 6/6 with 0 skips on immediate re-run →
   **OPEN.md row 184** (meta): give H-class probes retry-once or a longer timeout.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection: the book's acceptance frame was already fully met after story 3;
      story 4 (operator pre-close addition) extends the panel beyond the frame without opening
      new frame debt. Book still looks complete; `/close-book` remains **offered**, operator
      ratifies.
