# Review: Story 2 — Manual edit available to every viewer

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-07
**Diff:** working tree over `4fcda896` (branch `fix/treasure-map-manual-edit-placement`, cut from
`origin/staging`)

## Quality gates (run by reviewer, not trusted)

- [x] Scoped gate — **TOTAL_FAIL=0**: panel 18/18, optin 23/23, guards 8+6+5. Red→green
      demonstrated: S7/S8/S9/S10 were red (19/23) against the pre-move components.
- [x] `cd ui && npm run build` (vite) — EXIT=0; `bash scripts/harness-lint.sh` — clean.
- [x] Browser (localhost:7778, rebuilt bundle): route loads, **zero console errors**
      (logged-out path; the logged-in view is the standing NIP-07 boundary — see Findings 1).
- [x] **Faithful-move check:** diffed the old `ManualEditSection` body against the new module
      body — identical except two intentional deltas, both named below. No logic drift.
- [x] Base freshness: staging moved 25 commits (a whole `trusted-lists` epic) since this
      surface last shipped; all six Treasure-Map files verified untouched by those commits, so
      the branch carries no silent conflict.

## Spec adherence

| AC | Verdict | Evidence |
|---|---|---|
| AC-1 editor mounted by the page, independent of the card | ✅ | S7 (module exists; page imports and mounts it; `key={event.id}`; `onPublished={search}`) |
| AC-2 card carries no hand-edit affordance (negative pin) | ✅ | S10 (title, `<textarea`, `ManualEditSection`, `composeManualUpdate` all absent from the card); grep count 0 |
| AC-3 editor behavior unchanged | ✅ | S7/S8/S9 (title verbatim, seed from found event, dirty gate, `getActiveSignerOrThrow` + `publishOrThrow`, `composeManualUpdate`); faithful-move diff |
| AC-4 page order, editor last | ✅ | S10 positional chain: entries → raw event → TL panel → hand edit |
| AC-5 card behavior untouched | ✅ | S1/S2/S5 green unchanged (three states, prompt verbatim, preview, per-user delegate from story 1); the card diff is removals only |
| AC-6 no editor in the no-Map branch | ✅ | S10 (mount precedes the not-found headline); module also self-guards `if (!event) return null` |

## Things tests can't catch
- [x] **Rules of hooks in the new module:** all four `useState` and the `useMemo` run before the
      `if (!event) return null` guard — no conditional-hook hazard introduced by the extraction.
- [x] **Two publishers, one replaceable event (E1):** the card and the editor can now both
      publish. Both are wired to `onPublished={search}`, and the editor is keyed on `event.id`,
      so a card publish remounts the editor against the new event and discards stale text. The
      protection story 4 designed for a single caller holds for two; verified by reading the
      page wiring, not just the suite.
- [x] **The two intentional deltas** in the moved body: (a) `if (!event) return null` — new
      defensive guard, correct for a page-level mount; (b) container `marginTop` 0.75rem → 1rem
      — spacing appropriate now that the panel is a page block, not a nested card section.
      Nothing else changed.
- [x] **Availability, the actual point:** the editor now renders for a viewer with no
      provisioned assistant — the reported case — because nothing about it consults
      `assistantPubkey` or the delegation state any more.

## Findings

### Blocking
None.

### Non-blocking
1. **Logged-in verification** remains the operator's / a real user's (no NIP-07 identity on this
   machine). The structural pins are strong — the negative pin plus the positional order chain
   would both fail if the coupling returned — but a human still confirms the pixels.
2. **Hand-creating a Map when none is found** stays out of scope (story "Not covered"): the
   editor edits a seed event; creating one from a blank template is a different feature. Worth a
   product decision if users without Maps start asking.

### Harness friction
1. **My own S10 pin was too loose on first write** and failed for the wrong reason: it anchored
   the "editor is inside the found-Map block" check on the string `Not found`, which also
   appears as a code comment inside `search()` 174 lines earlier. Re-anchored on the not-found
   branch's own headline (`No Trusted Assertions event found`) with a comment saying why.
   Lesson (positional source assertions must anchor on strings unique to the region they mean)
   is local to this suite and now documented in it — no ledger row.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection: the book's frame now reads 5 of 6 bullets met — story 1's four plus
      this story's hand-edit bullet; the escaped-defect ledger row (188) flips at the close, and
      the recovery bullet still awaits the team member's opt-in re-run. Book close remains
      **offered**, not run.
