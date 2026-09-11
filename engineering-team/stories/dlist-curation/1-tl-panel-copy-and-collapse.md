# Story 1: Trusted Lists panel — new prompt copy, collapsed-by-default status line

**Status:** Done
**Created:** 2026-09-10
**Type:** Feature

## Background
The TA Treasure Map page's "Trusted Lists for Pubkeys (30392)" panel (tl-treasure-map #3, per-user
assistant fix in treasure-map-user-assistant #1) asks whether the local Tapestry instance should
publish the user's pubkey Trusted Lists. Two things are wrong with it for the operator's purposes.
The prompt never says *why* a 30392 Trusted List matters — Vespa search on brainstorm.world
consumes one per Tag — so the opt-in reads as an unmotivated request. And the panel is always
fully expanded, holding the page's attention even when the delegation is already set. This book
adds a second panel (DList Curation) to the same page, so the page needs panels that fold to a
one-line status by default; this story establishes that behavior on the existing panel.

## User-facing description
As a signed-in user viewing my Treasure Map, I want the Trusted Lists panel to fold to a single
line telling me at a glance whether my pubkey Trusted Lists are delegated to my Tapestry Assistant,
to someone else, or not at all — and, when I open it, to explain why publishing them matters before
asking me to opt in — so that the page stays scannable and the opt-in decision is an informed one.

## Acceptance criteria
- [ ] **AC-1 (copy).** In the absent and external states the prompt reads verbatim: "Tags of
      pubkeys greatly enrich Vespa search on brainstorm.world. For this to work, a kind 30392
      Trusted List should be published for each Tag. Would you like the local Tapestry instance to
      publish your Trusted Lists for pubkeys on your behalf? If so, you will need to update your
      Treasure Map so external clients can find your Trusted Lists." *(The fourth sentence is
      today's continuation — kept, operator decision at the story gate 2026-09-10.)*
- [ ] **AC-2 (collapsed by default).** On every load of a found Map the panel renders collapsed:
      one line carrying the title "Trusted Lists for Pubkeys (30392)" and a status indicator, and
      nothing else of the panel's body. This holds in all three states, including when the
      delegation is already local.
- [ ] **AC-3 (three-state indicator).** The collapsed line distinguishes, in text and visually:
      **local** — delegated to my Tapestry Assistant; **external** — delegated to a different
      pubkey, shown in short form; **absent** — not set. The baseline is the signed-in user's
      assistant, never the instance owner's, and no state renders until that assistant has
      resolved. Labels (operator-approved at the story gate 2026-09-10): "✅ Your Tapestry
      Assistant" · "⚠️ Another publisher · <8>…<4>" · "○ Not set".
- [ ] **AC-4 (expand / collapse).** Activating the header line by mouse or keyboard expands the
      panel to today's full body — status sentence, prompt, preview toggle, publish button, error
      display — and activating it again collapses it. The expanded body behaves exactly as before
      this story. Open state is not remembered across page loads.
- [ ] **AC-5 (null assistant unchanged).** A viewer with no provisioned assistant still gets no
      panel at all.
- [ ] **AC-6 (rest of the page unchanged).** Relay presence, Map Entries, the raw-event toggle,
      the hand-edit panel, and the no-Map path are untouched.

## Concepts touched
- `39998:<TA>:tapestry-assistant` — tapestry assistant (the delegate the status is judged
  against; per-deployment pubkey, resolved at runtime — never hardcoded)

## Out of scope
- Remembering the panel's open/closed state (an open question the treasure-map-relay-presence
  prd-seed left; not taken up here).
- Any change to what the opt-in flow composes, signs, or publishes.
- The DList Curation panel and the Map Entries changes (later stories of this epic).
- Sharing a component with the "Where this Map lives" panel is not required by this story.

## Open questions
None — both kickoff questions (AC-1's fourth sentence; AC-3's labels) were settled by the
operator at the story gate, 2026-09-10.

## Deviations
- **Test S5's anchor was amended during Phase 4, in the Tester's lane** (commit `8d8e2027`, before any
  implementation commit). As written it took the *first occurrence* of the title text, which under
  ADR 0001 §2 is the control's `aria-label`, not the heading; the amended S5 anchors on the `<h4>`
  element itself — stricter, and what AC-2/AC-4 mean. The implementation follows the ADR verbatim.
- **Live keyboard check.** The automated browser's key action reaches neither this control nor the
  shipped relay-presence one (control experiment), so AC-4's keyboard path was verified by
  dispatching real `keydown` events at the control: Space folds, Enter unfolds, both with the
  default prevented. Mouse toggle, all three collapsed labels, and the expanded body's copy were
  verified on screen via the fetch-stub remount (no NIP-07 in the automated browser).

## Linked artifacts
- ADR: `engineering-team/decisions/dlist-curation/0001-tl-panel-disclosure-and-copy.md`
- Test plan: `engineering-team/stories/dlist-curation/1-tl-panel-copy-and-collapse.test-plan.md` (suite: `test/dlist-curation-tl-panel.test.js`)
- Review: `engineering-team/reviews/dlist-curation/1-tl-panel-copy-and-collapse.md`

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
