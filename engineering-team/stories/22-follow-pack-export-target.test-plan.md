# Test Plan: Story 22 — Follow Pack (kind-39089) export target

**Story:** `engineering-team/stories/22-follow-pack-export-target.md`
**ADR:** `engineering-team/decisions/0020-follow-pack-export-target.md`
**Date:** 2026-05-30

## Approach

This feature is overwhelmingly UI/interaction (a modal checkbox, a detail-
panel naddr row, a drift hint, a memory hint) plus two server enrichments
(a kind-specific description and a `followPackStatus`). The repo has **no
UI unit runner**; the established pattern for this exact stack (see Story 19
`nip51-list-export-from-pins.test.js` and Story 21
`collapse-into-export-concept.test.js`) is **source-contract guards** —
grep the UI/server source for the AC-mandated copy, wiring, and gating —
backed by manual/Playwright verification of live interaction.

All new tests live in the existing **`test/collapse-into-export-concept.test.js`**
suite (the natural home — Story 22 extends Story 21's Export modal), run by
`node test/test.js`.

The **write side already landed** (parameterized prepare/publish path,
unchecked checkbox, copy) and was ratified by ADR 0020 — its tests
(AC-1/2/3) already pass. The new tests target the **read side** ADR 0020
adds, and are expected to **fail** until the Implementer builds it.

## Coverage map

| Criterion | Test name | Test file | Level | Expected now |
|---|---|---|---|---|
| AC-1 (target present) | `Story22 AC-1: …offers a Follow Pack (kind-39089) target` | `test/collapse-into-export-concept.test.js` | source-contract | PASS (write-side landed) |
| AC-2 (unchecked default) | `Story22 AC-2: …UNCHECKED by default` | same | source-contract | PASS |
| AC-3 (publishes 39089) | `Story22 AC-3: …publishes with kind 39089` + `(server): …accepts and validates kind 39089` | same | source-contract | PASS |
| AC-4 (disable only when all 3 off) | `Story22 AC-4 (guard): …disabled only when ALL THREE…unchecked` | same | source-contract | PASS (guard) |
| AC-5 (relay preview either list) | `Story22 AC-5 (guard): …renders when either user-signed list…` | same | source-contract | PASS (guard) |
| AC-6 (copy mentions pack) | covered by AC-1 (`Follow Pack` present in modal incl. tooltip/header) | same | source-contract | PASS |
| **AC-7 (pack-specific description)** | `Story22 AC-7: kind-39089 carries a Follow-Pack-specific description…` | same | source-contract | **FAIL** |
| **AC-8 (followPackStatus + 39089 scan)** | `Story22 AC-8: the /pins enricher derives followPackStatus and scans kind-39089` | same | source-contract | **FAIL** |
| **AC-9 (panel naddr row, gated)** | `Story22 AC-9: PinnedListPanel composes a kind-39089 naddr and renders a gated "Follow Pack (naddr)" row` | same | source-contract | **FAIL** |
| **AC-10 (drift hint)** | `Story22 AC-10: a stale Follow Pack shows a "members behind / re-export to update" drift hint` | same | source-contract | **FAIL** |
| AC-10 (snapshot: no auto-republish) | `Story22 AC-10 (snapshot guard): the auto-re-export path does NOT publish kind-39089` | same | source-contract | PASS (invariant guard) |
| **AC-11 (modal memory hint)** | `Story22 AC-11: …surfaces a "last exported as a pack" memory hint without auto-checking` | same | source-contract | **FAIL** |

## Edge cases

- [x] **Pack never exported** → no panel row (gated on `followPackStatus.status !== 'never-exported'`); AC-9 locks the gate.
- [x] **Pack exported then membership drifts** → `stale` → drift hint; AC-10 locks the copy.
- [x] **Snapshot invariant** → a re-tag must NOT silently re-sign the pack; AC-10 snapshot guard locks `publishTagPin.js` free of any kind-39089 publish.
- [x] **Opt-in preserved** → memory hint must not auto-check the box; AC-11 asserts `useState(false)` survives.
- [x] **Follow Pack alone** is a valid export → AC-4 guard (`nothingSelected` requires all three off).
- [ ] **Live `followPackStatus` derivation** (correct `ok-fresh`/`stale` against a real kind-30392 diff) — needs a seeded pin + signed kind-39089 in strfry; **deferred to manual/Playwright** (same boundary Story 19 drew for `nip51ExportStatus`, which is exercised in the publish-flow suite, not the contract suite).
- [ ] **Two NIP-07 prompts** when both Follow Set + Follow Pack checked — interactive; manual verification.

## Test infrastructure

- Runner: Node built-in (`node test/test.js`). No new framework (house rule).
- These tests are **static source-contract guards** — they read files from
  the working tree and need neither the control panel nor strfry running.
- Concept Graph API / firmware: **no change** (ADR 0020 reuses the
  `tag-pinning` z-tag; no concept edits, no `POST /api/firmware/install`).

## How to run

```
npm test                 # full suite (node test/test.js)
node test/collapse-into-export-concept.test.js   # this suite alone
```

## Verification

The four read-side tests (AC-7, AC-8, AC-9, AC-10 drift-hint, AC-11) fail
against the current tree (write-side only). Failing output pasted at the
Test Design gate / commit.
