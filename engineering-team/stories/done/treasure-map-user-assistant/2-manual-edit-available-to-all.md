# Story 2: Manual edit available to every viewer

**Status:** Done
**Created:** 2026-09-07
**Type:** Bug *(Light lane — Implementer + Reviewer, one human stop at Gate B; scoped gate:
`node -e "Promise.all(['./test/tl-treasure-map-panel.test.js','./test/tl-treasure-map-optin-publish.test.js','./test/global-publish-gate.test.js','./test/strfry-write-assertion-bracket.test.js','./test/treasure-maps-router-preset.test.js'].map(p=>require(p).run())).then(rs=>{const f=rs.reduce((s,r)=>s+r.fail,0);console.log('TOTAL_FAIL='+f);process.exit(f?1:0)})"`)*

## Background
The hand-edit escape hatch (tl-treasure-map #4) was mounted *inside* `TlOptInCard` — once in
each of its two return branches. Its availability is therefore coupled to that card's, and the
card withholds itself in two situations: the delegation panel is a colored box that only renders
when there is a delegation judgment to show, and — since this book's story 1 — the whole card
returns `null` when the signed-in user has no provisioned assistant (`assistantPubkey` null).
A viewer in that second state sees a found Treasure Map, its entries, and its raw event, but no
way to edit it by hand. The operator hit this on the deployed page (2026-09-07): "the Update by
Hand option is not available when the element with the orange border is not displayed."

The escape hatch is the surface's least-conditional affordance — it needs nothing but a found
event — so nesting it under the most-conditional panel inverted the dependency.

## User-facing description
As anyone viewing my found Treasure Map on this page, I can open "Update your kind 10040 event
Treasure Map by hand" — whether or not the Trusted Lists panel is showing, and whether or not I
have a provisioned assistant.

## Acceptance criteria
- [x] AC-1: The hand-edit panel renders for **every** viewer of a found Map, independent of the
      opt-in card: it is mounted by the page (`TrustedAssertions.jsx`), not by `TlOptInCard`.
- [x] AC-2: `TlOptInCard.jsx` contains no hand-edit affordance at all (negative pin — the
      toggle title, the textarea, and `composeManualUpdate` are gone from that file), so the
      coupling cannot silently return.
- [x] AC-3: Behavior of the editor itself is unchanged: same verbatim toggle title, seeds from
      the current found event (`id`/`sig` included), "Publish updated event" appears only once
      the text differs, drift-guarded NIP-07 sign → `publishOrThrow`, `key={event.id}` re-seed.
- [x] AC-4: Page order is unchanged above it and the editor sits last: Local Strfry → Map
      Entries → raw event → Trusted Lists panel (when shown) → hand edit.
- [x] AC-5: The opt-in card's own behavior is untouched (three states, prompt copy verbatim,
      preview-above-button, per-user assistant delegate from story 1).
- [x] AC-6: No hand-edit affordance in the no-Map-found branch (there is no event to seed
      from — creating a Map from scratch is out of scope, see below).

## Design note *(Light profile — provisional here, ratified at Gate B)*
- **Chosen approach:** extract `ManualEditSection` out of `TlOptInCard.jsx` into its own module
  `ui/src/pages/grapevine/TreasureMapManualEdit.jsx` (default export, logic moved verbatim), and
  mount it in `TrustedAssertions.jsx` as a **sibling** of `<TlOptInCard>`, inside the found-Map
  container, immediately after it. `TlOptInCard` drops both mounts, the component, and its
  now-unused `composeManualUpdate` import.
- **Rejected alternative:** keep the component inside `TlOptInCard.jsx` and add a third render
  path that returns *only* the editor when the card would otherwise be null — rejected: it
  keeps the two features' lifecycles fused (the defect class being fixed), makes the card's
  contract "sometimes I am not a card", and still leaves the editor invisible in any future
  state the card declines to render.
- **Blast radius:** new `TreasureMapManualEdit.jsx`; `TlOptInCard.jsx` (removals only);
  `TrustedAssertions.jsx` (import + one mount); `test/tl-treasure-map-optin-publish.test.js`
  (S7–S9 re-aimed to the new file + page, negative pin added). `treasureMap.js` untouched —
  `composeManualUpdate` moves consumer, not contract. The panel suite does not reference the
  editor (grep-verified), so it is untouched.
- **Wire fidelity:** none — no event shape, publish path, or relay behavior changes.

## Edge cases & not-covered
- **E1 (not derivable from any AC):** the editor and the opt-in card are now independent
  publishers of the same replaceable event, so a user could open the editor, then publish via
  the opt-in button, leaving stale text in an open editor. The existing `key={event.id}`
  re-seed handles it: `onPublished` re-runs the page search, the new event id remounts the
  editor, and stale edits are discarded — the same protection story 4 designed, now load-bearing
  for a second caller.
- E2: null-assistant viewer — card absent, editor present (the reported bug's exact case).
- E3: owner/local (green) state — editor no longer inside the green box; it renders below it.
- **Not covered:** hand-creating a Map when none is found (needs a template seed, not an edit —
  product question, deferred); live multi-user NIP-07 verification (same boundary as story 1).

## Linked artifacts
- ADR: — (no irreversibility trigger: component placement only)
- Test suite: `test/tl-treasure-map-optin-publish.test.js` (re-aimed; scoped gate above)
- Review: `engineering-team/reviews/treasure-map-user-assistant/2-manual-edit-available-to-all.md`

Link by path only — never record verdicts or round history in this file.
