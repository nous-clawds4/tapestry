# Story 2: Tag surfaces are honest when the selected POV can't actually filter

**Status:** Draft
**Created:** 2026-07-09
**Type:** Feature (epic: pov-selectable-tag-surfaces; Story 2 of 2)
**Provenance:** OPEN.md #17 / the epic's scope note in Story 1; ADR 0001's "NIP-85 alignment" note
(Story 2's "provisioned" definition). Depends on Story 1 (the selected-POV threading, shipped).

## Background
Story 1 made one explicit POV selection govern every tag surface. But when the selected POV **cannot
actually filter**, the reads today fail *silently*, in three distinct ways (verified in code
2026-07-09):

1. **Count-everyone.** When no delegate or no rank threshold resolves (fresh install, dev box, POV
   with no prefs), the trust predicate falls back to `() => true` — **every author counts**
   (`trustPredicateFor`, `src/api/event-tags/index.js:114-117`; same `wotFiltering` guard shape in
   profile-tags). Unfiltered counts are presented exactly as if they were trusted counts.
2. **Silent house substitution.** Selecting "my own" when my WoT was never computed (no `rankAuthor`
   in my prefs file) silently falls through to the **house** delegate (`resolvePov`,
   `src/api/_shared/pov.js:60`). The user believes they're seeing their own POV; they're seeing
   house, with no indication.
3. **Silent emptiness.** When a POV *resolves* to a suffix but its `wot_rank_<suffix>` columns were
   never computed (or went stale), the predicate finds no ranks and **everyone fails the filter** —
   surfaces render as "no tags," indistinguishable from genuinely-untagged. The opposite failure of
   (1), equally unexplained.

All three violate the same principle: **the surface presents a filtered-looking answer without
disclosing that no (or a different) filter ran.** This is the honesty analog of the note-TL partial
signal (`["truncated", …]`): a consumer must be able to tell a complete/filtered answer from a
degraded one. Search already treats the own-POV-not-ready case explicitly (its "my WoT ready"
machinery); the tag surfaces have nothing.

Per ADR 0001's alignment note, **"provisioned" is derived from the actual machinery** — a selected
POV is provisioned iff it resolves to a delegate/suffix whose `wot_rank_<suffix>` scores actually
exist — never from a separately-administered registry (POV-first invariant: the answer comes from
the computation's own state).

## User-facing description
As someone viewing tags under a selected point of view, when that POV isn't actually usable —
my own POV was never computed, or this instance has no computed scores for the selection — I want
the tag surfaces to **tell me plainly what I'm actually seeing** (and why), so I'm never misled into
reading unfiltered counts, someone else's POV, or an artificially empty page as if it were my
selected POV's honest answer.

## Acceptance criteria
Testable from the outside (the POV/provisioning state is the input; what the surface shows/reports
is the observable output).

- [ ] **Own-POV-not-computed is disclosed, not silently house-substituted.** Given I am logged in and
  select "my own" POV but my WoT has never been computed on this instance, when I view a tag surface,
  then it clearly indicates my POV isn't available (and what I'm seeing instead) — it does NOT
  present results under the house delegate as if they were mine.

- [ ] **Unfiltered-counts are disclosed.** Given the active POV resolves no trust filter at all (no
  delegate or no rank threshold — e.g. a fresh/dev instance), when I view a tag surface, then the
  surface still works but visibly discloses that the counts are **not trust-filtered** — unfiltered
  numbers are never silently presented as trusted ones.

- [ ] **Not-computed is distinguishable from genuinely-empty.** Given the selected POV resolves to a
  delegate whose scores were never computed on this instance, when I view a tag surface, then I can
  tell "this POV isn't computed here" apart from "nothing is tagged" — the surface does not render a
  bare empty state.

- [ ] **The read itself reports its honesty.** Given any of the three degraded states, when a tag
  read is served, then the response carries an explicit machine-readable signal of what actually ran
  (filtered normally / unfiltered / fell back / not computed) — so any consumer (our UI, an
  integrator) can detect it without heuristics, mirroring the note-TL partial-signal doctrine.

- [ ] **Provisioned POVs are untouched.** Given a normally-provisioned POV (house with computed
  scores, or my own after computation), tag surfaces look and count exactly as they do today —
  strict no-regression, including fresh-install/dev instances continuing to *function* (disclosure,
  not blockage).

- [ ] **Consistency across surfaces.** The disclosure appears with the same meaning on every tag
  surface Story 1 threads (tags on a note, tag page, tags directory, profile tags, tagged-by view) —
  one definition of "provisioned," derived from the scoring machinery itself, not a hand-maintained
  list.

- [ ] **Unfiltered wording distinguishes no-delegate from no-threshold.** *(Added 2026-07-09, after
  live testing.)* Given the read is `unfiltered`, when a **delegate resolved but no rank threshold is
  set** (`povSuffix` present, `minRank` null — e.g. the rank filter is off), then the disclosure says
  the point of view has **no trust threshold set** — NOT "this instance has no point of view
  configured" (which must only appear when no delegate resolved, `povSuffix` null). The two unfiltered
  causes are already distinguishable from the `povResolution` the read returns (`povSuffix`), so the
  wording must reflect them.

## Concepts touched
(Plain-language; the Architect resolves specifics.)
- The trust-predicate/POV resolution shared by the tag reads (event-tag + profile-tag stacks).
- The selected-POV mechanism from Story 1 (`PovContext` — consumes, not changes).
- The per-POV score columns (`wot_rank_<suffix>`) whose existence defines "provisioned."

## Out of scope
- **Provisioning itself** — computing scores for a new/named POV, onboarding customers, `resolvePov`
  named branches: the "external/named POV provisioning via NIP-85" epic (`_intake.md` 2026-07-09).
- **Search's own treatment** — search already has its own own-POV-readiness machinery; do not
  regress it, and converging its wording/UX with the tag surfaces' is optional polish, not required.
- **The applicability picker** (stays instance-global; unchanged).
- **Changing what counts** — this story only *discloses* degraded states; it does not change any
  filtering outcome (the count-everyone/house-fallback *behaviors* stay; they become visible).
  Whether any of them should be *blocked* rather than disclosed is a later product decision the
  disclosure signal enables.

## Open questions (for Architecture)
- **Where "what actually ran" is computed and reported** — the reads already return
  `povSuffix`/`minRank` (nullable), which distinguishes case (1); cases (2) and (3) need the
  resolution to say *which branch* it took and whether the suffix's scores exist. One shared
  resolution-status shape across both stacks, or per-endpoint?
- **How "scores exist for this suffix" is checked** affordably at read time (and whether it's
  cached) — the provisioned-definition from ADR 0001's alignment note.
- **The disclosure UX** — banner over results vs. replaced state, per degraded mode; reuse of an
  existing banner/notice pattern; exact wording. (AC-5 requires dev instances keep functioning, so
  at least case (1) must be disclosure-over-results, not blockage.)

## Scope note (for the gate)
This completes the 2-story epic. Story 1 shipped the *plumbing* (one selection governs everything);
this story ships the *honesty* (the selection's degraded states are visible, machine-readable, and
consistent). The three degraded modes are one story because they are one mechanism: a single
resolution-status signal computed where the trust predicate is built, disclosed uniformly by the
surfaces Story 1 already threads.

## Deviations
- `useNotesForTag`/`usePinnedNotes` thread the selected POV (gate amendment) but do NOT expose
  `povResolution` — the ADR designates the `useTagDetail` page-level banner as the single Tag-page
  disclosure surface, so a second per-notes signal would be redundant. Threading only, as specified.

## Linked artifacts
- ADR: `engineering-team/decisions/pov-selectable-tag-surfaces/0002-per-read-pov-resolution-status.md` (Accepted, with gate amendment)
- Test plan: `engineering-team/stories/pov-selectable-tag-surfaces/2-honest-state-for-unprovisioned-pov.test-plan.md`
- Tests: `test/pov-resolution-status.test.js` (wired into `test/test.js`)
- Review: (after Review)
