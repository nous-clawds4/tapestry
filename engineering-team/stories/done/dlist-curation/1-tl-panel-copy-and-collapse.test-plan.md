# Test Plan: Story 1 — Trusted Lists panel: new prompt copy, collapsed-by-default status line

**Story:** `engineering-team/stories/dlist-curation/1-tl-panel-copy-and-collapse.md`
**ADR:** `engineering-team/decisions/dlist-curation/0001-tl-panel-disclosure-and-copy.md`
**Date:** 2026-09-10

## Coverage map

Suite: `test/dlist-curation-tl-panel.test.js` — the house three-class pattern (U behavioral via ESM
import of `ui/src/utils/treasureMap.js`; S source-structure over `TlOptInCard.jsx`; R regression
sentinels that pass before and after). Registered in `test/test.js` (require, run, results line,
overall verdict, skip aggregate).

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 copy | S7 the prompt reads the operator's four sentences, verbatim | `test/dlist-curation-tl-panel.test.js` | structure |
| AC-2 collapsed by default | S2 a real disclosure control whose expanded state gates the body · S3 the fold state is initialised false · S5 one title, in the header, with the glyph | same | structure |
| AC-3 three-state indicator | U3 absent · U4 local · U5 external (short form) · U6 never throws · U7 composed with `findGenericTlDelegation` · S1 the card calls the helper · S6 labels live in the helper, not the card | same | unit + structure |
| AC-4 expand / collapse | S2 (control + gate) · S4 Enter and Space toggle, Space doesn't scroll · S5 aria-label · R2 the expanded body's affordances survive | same | structure |
| AC-5 null assistant | U2 no baseline → null · R3 the guard `!assistantPubkey → return null` stays | same | unit + structure |
| AC-6 rest of page | R1 single mount, `onPublished={search}`, page order · R4 neighbouring panels untouched · R5 the util's existing exports and upsert semantics | same | structure + unit |

**AC→handle lines:** AC-1 → S7 · AC-2 → S2, S3, S5 · AC-3 → U3, U4, U5, U6, U7, S1, S6 ·
AC-4 → S2, S4, S5, R2 · AC-5 → U2, R3 · AC-6 → R1, R4, R5 · U1 is the export precondition.

## Edge cases

Beyond the ACs (the first two are not derivable from any criterion):

- [x] **E1 — garbage never throws** (U6): a delegate-less row, `{}`, a string, a number, an array,
      a non-string pubkey all read as `absent`; the descriptor runs on every render and must never
      take the page down.
- [x] **E2 — the assistant resolves late** (U2 + S3): before `assistantPubkey` resolves the helper
      returns null and the card renders nothing (AC-5's guard); once it resolves, the card mounts
      *folded* — the late arrival must not open the panel.
- [x] **E3 — composition rules inherited from ADR tl-treasure-map/0001** (U7): a named-only
      `30392:<name>` entry is inert → absent; wild duplicate generic entries → first occurrence
      wins and the label names that delegate.
- [x] **Sentinel by construction** (S6): passes today because the card carries no labels yet; it
      binds the moment the card renders a status line, forbidding hard-coded label text.
- [ ] **Not covered — live fold behaviour in a browser** (B-class). The card renders only for a
      signed-in user with a provisioned assistant, which the automated browser cannot supply (no
      NIP-07 signer, no dev bypass). A source scan proves the control, its initial state, and its
      keyboard handler exist; it cannot prove a click folds the panel on a screen. The operator's
      live check at review is the verification, the same boundary tl-treasure-map #3 drew.
- [ ] **Not covered — colours/tones on screen**: the `tone` key is asserted (U3–U5); its rendering is
      the browser check above.
- [ ] **Not applicable — Concept Graph API**: no concept behaviour changes; no live-API suite.

## Test infrastructure
- Test framework: Node's built-in runner (`node test/test.js`); no Playwright half for this story
  (see "Not covered" above).
- Concept Graph API: not exercised.
- Firmware state: none required.
- Fixtures: inline — two synthetic 64-hex pubkeys (`'a'.repeat(64)`, a hex pattern), synthetic
  kind-10040 tag lists. No relay, no network, no DOM.

## How to run

Full suite:
```
npm test
```

Story-scoped gate (this suite plus the four guard suites that pin the neighbouring panels and the
opt-in card's existing contracts):
```
node -e "Promise.all(['./test/dlist-curation-tl-panel.test.js','./test/tl-treasure-map-optin-publish.test.js','./test/tl-treasure-map-panel.test.js','./test/treasure-map-panel-summary.test.js','./test/treasure-map-relay-presence.test.js','./test/treasure-map-relay-sync.test.js'].map(p=>require(p).run())).then(rs=>{const f=rs.reduce((s,r)=>s+r.fail,0);console.log('TOTAL_FAIL='+f);process.exit(f?1:0)})"
```

## Verification
The new tests fail with the current code — the U class on the missing export (not an import
error: the util loads and its existing exports are exercised by R5), the S class on the specific
missing structure and copy. Confirmed on 2026-09-10 at commit bacefa2e (working tree = that commit
plus this suite and its runner registration):

```
  ✗ U1: describeTlDelegation is exported from the treasure-map util
      ui/src/utils/treasureMap.js must export describeTlDelegation(delegation, assistantPubkey) (ADR 0001 §1)
  ✗ U2: no baseline, no judgment — a missing assistant pubkey yields null in every state
  ✗ U3: absent — no delegation reads "○ Not set"
  ✗ U4: local — the delegate IS the signed-in user's assistant
  ✗ U5: external — another delegate is named in short form
  ✗ U6: never throws — a delegate-less row and garbage inputs read as absent
  ✗ U7: composed with findGenericTlDelegation the way the card composes them
      (U2–U7: same missing-export message)
  ✗ S1: the card takes its verdict from describeTlDelegation, imported from the shared util
      AC-3: the card calls describeTlDelegation for the status line
  ✗ S2: a real disclosure control whose expanded state gates the body
      AC-4: the header carries aria-expanded={<state>} (a control, not a clickable div)
  ✗ S3: collapsed by default — the fold state is initialised false
      AC-2: needs the disclosure control first (S2)
  ✗ S4: keyboard — Enter and Space toggle, and Space does not scroll the page
      AC-4: the control handles keyboard activation
  ✗ S5: one title, in the header, with the disclosure glyph beside it
      AC-2: exactly one <h4> (the header owns the title); found 2
  ✓ S6: the status labels come from the helper — none is hard-coded in the card
  ✗ S7: the prompt reads the operator's four sentences, verbatim
      AC-1: the four-sentence prompt, verbatim, as one string
  ✓ R1: the page still mounts the card once, refreshes via onPublished={search}, in the same position
  ✓ R2: the publish chain and the body's affordances survive the fold
  ✓ R3: the baseline is the signed-in user's assistant, guarded while unresolved; no owner TA, no hex literal
  ✓ R4: the neighbouring panels are untouched
  ✓ R5: the util's existing exports are all still there
RESULT {"pass":6,"fail":13,"skipped":0}

Guard suites at the same commit (all green):
tl-treasure-map-optin-publish → 23 passed, 0 failed · tl-treasure-map-panel → 18/0 ·
treasure-map-panel-summary → 18/0 · treasure-map-relay-presence → 35/0 · treasure-map-relay-sync → 22/0
```
