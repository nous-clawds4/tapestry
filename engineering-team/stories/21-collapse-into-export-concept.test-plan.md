# Test Plan: Story 21 — Collapse pin publication into a single "Export" concept

**Story:** `engineering-team/stories/21-collapse-into-export-concept.md`
**ADR:** `engineering-team/decisions/0019-collapse-into-export-concept.md`
**Date:** 2026-05-29

## Strategy

This story is overwhelmingly **UI/interaction** (an Export modal with a
disclosure + checkboxes, a per-assertion re-export orchestrator that fires
a NIP-07 prompt, a live two-line sync-status state machine, debounce). The
repo has **no UI unit-test runner** (the `ui/` package is vite-only — no
jest/vitest); the node harness (`node test/test.js`) tests server APIs and
**source-contract guards** (see the `syncWoT.sh` / absent-endpoint guards in
`test/nip51-list-export-from-pins.test.js`). Per the PO's explicit steer —
*"it's okay if there aren't many tests as this is very UI dependent"* — the
automated layer:

1. **Asserts the one server-observable change** (default curation cutoff
   2 → 1).
2. **Locks the AC-mandated user-visible copy** (help lines, the disclosure
   label, the four sync-status messages) — this also pins the exact
   phrasing the Implementer must use.
3. **Asserts the collapse** (the standalone "Refresh now" affordance is
   gone) and the **orchestrator wiring** (defined once, invoked from both
   assertion entry points, gated on the export footprint).

The genuinely interactive behaviours that source guards cannot reach are
listed under **Manual / Playwright verification** below and are the
Reviewer's responsibility to confirm in a running app.

All automated tests live in `test/collapse-into-export-concept.test.js`
(registered in `test/test.js`).

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 (one Export; Refresh folded in) | `AC-1: the standalone "Refresh now" affordance is collapsed into Export` | `test/collapse-into-export-concept.test.js` | source guard |
| AC-3 (both targets, in modal) | `AC-3: the Export modal offers both a Follow Set and a Trusted List target` | same | source guard |
| AC-4 (disclosure) | `AC-4: the Export modal has a "What will be exported?" disclosure` | same | source guard |
| AC-8 (30392 help line) | `AC-8: ... "curation pipelines" help line` | same | source guard |
| AC-9 (30000 help line) | `AC-9: ... "Lists and Follow Sets" help line` | same | source guard |
| AC-11 (naddr both kinds, not raw id) | `AC-11: the detail panel composes an naddr for BOTH kind-30392 and kind-30000` | same | source guard |
| AC-12/13 (orchestrator defined) | `AC-13: a shared re-export orchestrator (syncPinnedExportsForTag) is defined` | same | source guard |
| AC-12/13 (tag-page wiring) | `AC-13: the tag-page assertion path invokes the orchestrator` | same | source guard |
| AC-12/13 (profile-page wiring) | `AC-13: the profile-page assertion path invokes the orchestrator` | same | source guard |
| AC-15/16 (footprint gate) | `AC-15/16: the orchestrator gates the kind-30000 re-export on the export footprint` | same | source guard |
| AC-18 (in-sync line) | `AC-18: the in-sync status line names the current Pin` | same | source guard |
| AC-19 (transient out-of-sync) | `AC-19: the transient out-of-sync line says "Pinned list changed"` | same | source guard |
| AC-20 (other-caused caveat) | `AC-20: ... "background list refresh coming soon" caveat` | same | source guard |
| AC-21 (cutoff fallback → 1) | `AC-21: refreshPinnedTags cutoff fallback is 1, not 2` | same | source guard (server) |
| AC-22 (cutoff copy → 1) | `AC-22: the /pins cutoff help copy says default 1, not default 2` | same | source guard |
| AC-23 (explicit cutoff honored) | `AC-23: an explicit finite cutoff is still honored` | same | **regression guard (green now)** |

### ACs covered only by manual / Playwright verification

These are interaction/runtime behaviours with no source-guard proxy. The
Reviewer confirms them in a running app (the existing Playwright harness
under `tests/brainstorm/` is the home for any future automation).

- **AC-2** — clicking the single Export affordance opens the modal.
- **AC-5** — unchecking **both** targets disables the Export button;
  re-checking one re-enables it.
- **AC-6 / AC-7** — confirming with both checked publishes a recomputed
  kind-30392 **and** a user-signed kind-30000 (NIP-07 prompt); with one
  checked, only that kind publishes and the other is left untouched.
- **AC-10** — a kind's naddr row appears only after that kind is exported.
- **AC-12 / AC-13 (runtime)** — Apply/Dispute (and a curation reconfig) on
  a *pinned, previously-exported* tag triggers a silent 30392 recompute +
  a NIP-07-prompted 30000 re-export; rapid actions are debounced into one.
- **AC-14** — declining the re-export signature leaves the 30392 updated
  and shows "out of sync — Export to update"; the original tagging still
  succeeds.
- **AC-17** — the "Last exported …" timestamp line renders whenever an
  export exists, and flips to "Exporting…" during a re-export.
- **AC-24** — internal surfaces (Pinned-tab members, Search "Pinned tag"
  filter) still read the kind-30392; no regression.
- **AC-25 / AC-26** — POV/decentralization invariants: two viewers pinning
  the same tag get independent exports; the kind-30000 stays user-signed,
  the kind-30392 TA-signed; no write-time gating added. (Partly assured by
  the server endpoints' existing `pin author == session` checks, exercised
  by the Story 19 suites; this story adds no new signing path.)

## Edge cases

- [x] **Tagging a tag the viewer hasn't pinned** → no re-export (AC-16;
  guarded indirectly via the footprint/orchestrator guards; confirmed at
  runtime).
- [ ] **Rapid successive taggings** of the same pinned tag → a single
  coalesced recompute + one NIP-07 prompt (debounce; manual).
- [ ] **Both checkboxes unchecked** → Export disabled (AC-5; manual).
- [ ] **30000 re-export declined mid-flow** → 30392 stands, status shows
  out-of-sync, tagging unaffected (AC-14; manual).
- [ ] **Curation cutoff explicitly set to >1** → honored, not normalized
  (AC-23 regression guard + Story 12 integration suite).
- [ ] **Profile-page tagging** (no PinnedListPanel mounted) → re-export
  still runs headlessly; no transient UI required (manual).

## Test infrastructure

- Framework: node harness (`node test/test.js`) — no live stack, no
  Concept Graph API, no firmware required for this suite (pure source
  guards + file reads).
- New suite: `test/collapse-into-export-concept.test.js`, registered in
  `test/test.js`.
- No new firmware concept; no `POST /api/firmware/install` precondition.
- Playwright (`tests/brainstorm/`) is available for future interaction
  coverage but no new spec is mandated by this plan.

## How to run

```
node test/collapse-into-export-concept.test.js   # this suite, standalone
npm test                                          # full harness
```

## Verification

The new tests fail with the current code. Confirmed 2026-05-29 (standalone
run, pre-implementation):

```
--- collapse-into-export-concept tests (Story 21) ---
  FAIL  AC-21: refreshPinnedTags cutoff fallback is 1, not 2
  PASS  AC-23: an explicit finite cutoff is still honored (only the unset case is normalized)
  FAIL  AC-22: the /pins cutoff help copy says default 1, not default 2
  FAIL  AC-1: the standalone "Refresh now" affordance is collapsed into Export
  FAIL  AC-4: the Export modal has a "What will be exported?" disclosure
  FAIL  AC-3: the Export modal offers both a Follow Set and a Trusted List target
  FAIL  AC-9: the kind-30000 detail row carries the "Lists and Follow Sets" help line
  FAIL  AC-8: the kind-30392 detail row carries the "curation pipelines" help line
  FAIL  AC-11: the detail panel composes an naddr for BOTH kind-30392 and kind-30000
  FAIL  AC-18: the in-sync status line names the current Pin
  FAIL  AC-19: the transient out-of-sync line says "Pinned list changed"
  FAIL  AC-20: other-caused divergence carries the "background list refresh coming soon" caveat
  FAIL  AC-13: a shared re-export orchestrator (syncPinnedExportsForTag) is defined
  FAIL  AC-13: the tag-page assertion path invokes the orchestrator
  FAIL  AC-13: the profile-page assertion path invokes the orchestrator
  FAIL  AC-15/16: the orchestrator gates the kind-30000 re-export on the export footprint

collapse-into-export-concept: 1 passed, 15 failed
```

The single green (AC-23) is an intentional **regression guard**: the
cutoff resolution already honors an explicit finite value, and the AC-21
fix must not remove that branch (e.g. by hardcoding `cutoff = 1`). Every
other AC with a source-guard proxy is red and turns green only once the
Implementer ships the feature.
