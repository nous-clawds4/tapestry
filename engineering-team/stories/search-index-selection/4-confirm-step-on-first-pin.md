# Story 4: A confirm step on first pin — make the default curation visible before it publishes

**Status:** Draft
**Created:** 2026-09-18
**Type:** Feature *(Light book — **no wire change**: this story reorders *when* the same pin
event and the same curation blob are published, not what is in them. The irreversibility
triggers are therefore not tripped and a **Design note** is expected, not an ADR. Gate A
rules. **The one risk that would flip this:** if the interstitial changes the DEFAULT blob a
first pin publishes, that IS wire-visible and the trigger fires. Recommendation: it must
not — the interstitial only makes the existing `defaultCurationMethod` visible and editable.
See AC-2's byte-identity sentinel.)*
**Epic:** `engineering-team/epics/search-index-selection.md` (story 4)
**Book:** `engineering-team/audits/search-index-selection/book.md` (decision log, 2026-09-18 —
"New story 4 (operator): a confirm step on first pin")
**Design target:** `docs/SEARCH_INDEX_DLIST_SELECTION.md` (rev 3) — the "place vs recipe"
warning at `:221-224` is binding on story 5 and bears here: this story must not turn the
interstitial into a variant-naming surface.

## Background

**What quietly happens today.** On the tag detail page the Pin button is a single-click
action (`ui/src/components/TagPinAffordance.jsx:8-10`, `:33`, `:40`). `handlePin`
(`ui/src/pages/Tag.jsx:268-274`) calls `publishWithCuration(defaultCurationMethod(user.pubkey))`
with no confirmation of any kind. That default
(`ui/src/utils/publishTagPin.js:100-118`) is, today, after story 2:

- `observer` = the viewer's pubkey
- `method` = `'nip85:rank'` (the viewer's web of trust)
- `cutoff` = 1
- `includeScoreInTL` = true
- `targetTypes` = `['profile', 'note', 'item']`
- `noteMethod` = `'notes:net-endorsed'`
- **no `authorConstraint`** — deliberately unconstrained (ADR
  `search-index-selection/0001` §2, cited in the comment at `publishTagPin.js:96-99`)

One click then produces, without the user having seen any of the above:

1. a signed kind-39999 pin carrying that blob twice — the `curation-method` tag and
   `content.tagPinning.curationMethod` (`ui/src/utils/publishTagPin.js:160-172`) — signed
   through NIP-07 and published (`:174-176`);
2. an **awaited** `POST /api/trusted-list/refresh-pinned-tag` (`ui/src/pages/Tag.jsx:234-238`),
   which is `refreshOnePinnedTagById` (`src/api/trustedList/refreshPinnedTags.js:414-437`)
   and runs **all three** runners — `runOnePin`, `runOneNotePin`, `runOneItemPin` (`:430-432`)
   — so the TA-signed Trusted Lists (kind-30392 / 30393 / 30394) are published **immediately
   on pin**, not on the next cron refresh;
3. a second NIP-07 prompt: the user-signed kind-30000 NIP-51 follow-set export, fire-and-forget
   (`ui/src/pages/Tag.jsx:246-252`);
4. a third publish when notes are selected — the kind-30003 note bookmark set
   (`ui/src/pages/Tag.jsx:256-262`).

The user first *sees* any of this **after** it has all been signed and published: `refetchHeader()`
then `setActiveTab('pinned')` (`ui/src/pages/Tag.jsx:221-227`) drops them on the Pinned tab
where the already-published list is rendered. There is no point in the flow at which the
curation is reviewable before it becomes a permanent signed event.

**Why this was right once and is wrong now.** The interstitial used to exist and was removed
deliberately: ADR 0016 ("Pin button friction", `decisions/0016-…:31-35`, decision option 3A at
`:190-196`) argued the dialog was "a settings interstitial in front of a one-click action"
because Story 17's defaults matched the Curated view the user was already looking at —
**WYSIWYG** (`:69-71`). That premise has since expired. The blob has accumulated `targetTypes`
and `noteMethod` (story 12 / ADR 0015), `authorConstraint` (this epic's story 2), and is about
to accumulate `membershipMethod` (story 3, Approved) and a variant key (story 5, Draft). None
of those are visible in the Curated view, so "what you see is what you get" is no longer true.
The operator (2026-09-18): *"the default TL that quietly happens can be a bit confusing and
will only get more so as we make the TL options richer and richer."*

**What must not be lost.** The operator is explicit that the one-gesture training value stays:
*"the 'pin → TL' in one go is a nice user-training thing (vs having them pin and then requiring
them to ALSO create a TL)."* So the confirm step is an **interstitial, not a second step**: the
dialog's primary action publishes the pin; there is never a later "now also create a TL".
Cancel publishes nothing at all.

**The surface already exists.** `ui/src/components/CurationMethodDialog.jsx` already edits every
field in the blob — cutoff (`:69`), includeScoreInTL (`:70`), method (`:71`), the three target
types (`:73-81`), noteMethod (`:82`), authorConstraint/trust scope (`:89-93`), observer (`:95-98`)
— and it already has a `mode='create'` branch with the title "Pin curation method" (`:201`) and
the submit label "Pin with these settings" (`:166`). That create mode is **currently dead code**:
the only live mount is `PinnedListPanel.jsx:781-789` with `mode="edit"`. This story re-lights it.

## User-facing description

As someone pinning a tag for the first time, I want to see — and be able to change — the
curation that is about to be published on my behalf, so that the Trusted List that appears
under my name is one I chose, not one that quietly happened.

## Acceptance criteria

- [ ] **AC-1 — the first pin opens an interstitial.** A signed-in viewer who has not pinned this
      tag clicks Pin and gets a confirmation dialog pre-filled with today's defaults
      (`defaultCurationMethod`, `ui/src/utils/publishTagPin.js:100-118`). **Nothing is signed
      or published before the dialog's primary action is taken** — no kind-39999, no
      refresh call, no NIP-51 export, no NIP-07 prompt.
- [ ] **AC-2 — confirming untouched is byte-identical to today (sentinel).** Opening the
      interstitial and confirming without changing any field publishes the *same* kind-39999
      the silent path publishes today: same `d`, same `e`/`a`/`z` tags in the same order, same
      `curation-method` JSON, same `content` — and the two copies of the blob agree. The
      downstream sequence is unchanged too: the refresh call is awaited before the exports fire
      (`ui/src/pages/Tag.jsx:232-238`), and the same three Trusted Lists result.
- [ ] **AC-3 — cancelling publishes nothing.** Dismissing the interstitial (button, ×, Escape,
      backdrop) leaves zero events published, the tag unpinned, the viewer on the tab they
      started on, and no error surfaced. Re-clicking Pin re-opens it cleanly with defaults.
- [ ] **AC-4 — edits land in the first pin, in one publish.** Changing fields in the
      interstitial and confirming publishes **one** kind-39999 carrying the edited blob. There
      is no publish-then-amend: no pin is ever signed with the defaults and then re-signed, and
      the user is never asked to take a second action to get their list.
- [ ] **AC-5 — "Pin to community" goes through the same interstitial.** The community-context
      pin path (`PinToContextModal` → `handlePinToContext`, `ui/src/pages/Tag.jsx:280-320`)
      shows the same interstitial after the context is picked, with the chosen context shown
      and fixed. Confirming publishes the context-stamped pin exactly as today (the context
      `d`-tag and context `z` stamp unchanged); cancelling publishes nothing and leaves the
      viewer unpinned in that context.
- [ ] **AC-6 — existing pins are untouched.** The "Edit curation" path
      (`PinnedListPanel.jsx:781-789`, `mode="edit"`) keeps its title, its "Save changes" label,
      its Unpin affordance, and its edit-path field fallbacks — in particular the `targetTypes`
      fallback `['profile','note']` (`CurationMethodDialog.jsx:73-81`) and the untouched-
      `authorConstraint` re-emit rule (`:88-93`, `:137-139`), so editing an old pin still cannot
      silently add a type or a constraint.
- [ ] **AC-7 — a returning viewer sees no interstitial.** A viewer who already holds a pin of
      this tag (in this context) gets today's behaviour from the Pin affordance: the button is
      the Pinned/Back tab toggle (`TagPinAffordance.jsx:29-32`, `:41-45`) and no dialog opens.
      The interstitial is bound to *publishing a new pin*, not to "the user is new".

## Concepts touched

- `39998:<TA>:tag-pinning` — the pin element whose `curationMethod` the interstitial displays.
  No shape change (ADR-0015 legacy-literal exception applies to the handle only; no new literal).
- `39998:<TA>:trusted-list` — the 30392 / 30393 / 30394 family the pin materializes. No change.
- `39998:<TA>:tag` — the pinned tag. Read-only here.

## Edge cases

- **E1 — signer refusal mid-flow.** The user confirms, then rejects the NIP-07 prompt.
  Nothing is published; the dialog must surface the error inline (the existing `setError`
  path, `CurationMethodDialog.jsx:158-161`) and stay open with the user's edits intact, so
  confirming again does not re-type the form. The pin state stays unpinned.
- **E1b — refusal on the *second* prompt.** Confirm succeeds, the pin and the Trusted Lists
  publish, then the user rejects the kind-30000 export prompt. Unchanged from today: the pin
  stands and the export is recoverable from `/pins` (`ui/src/pages/Tag.jsx:246-252`). The
  interstitial must not make this path look like a failed pin.
- **E2 — the worked example (day-one search pin).** The curator opens the interstitial on
  `worth-indexing-for-search`, switches the trust scope to **"Only me"** and leaves items
  selected, then confirms. One pin publishes, carrying `authorConstraint: 'observer'` and
  `targetTypes` including `item` — the exact combination the epic's acceptance frame needs,
  reached in a single gesture with the setting visible before it was signed. This case is the
  clearest argument for the story: today it requires pin-with-wrong-defaults, then edit.
- **E3 — a viewer with no WoT computed.** The dialog must render and submit normally. The
  Tag page already surfaces this separately via `PovStatusNotice` on `povResolution`
  (`ui/src/pages/Tag.jsx:391`, mode `not-computed` per `NoteTags.jsx:163`); whether the
  interstitial repeats that notice is open question 3. It must not *block* the pin — a
  not-computed POV is precisely when "Only me" is the useful choice.
- **E4 — double-click / in-flight guard.** Clicking Pin twice, or confirming twice, must
  publish one pin. Today `pinning`/`loading` guards the button (`TagPinAffordance.jsx:28`,
  `:63`) and `submitting` guards the dialog (`CurationMethodDialog.jsx:155-165`); the new
  wiring must not open a gap between them.
- **E5 — not signed in.** Unchanged: the affordance renders nothing without a user
  (`TagPinAffordance.jsx:23`). The interstitial is never the login prompt.
- **E6 — pinning the same tag into a second context.** The viewer already has a neutral pin
  and picks a community. That is a *new* pin, so AC-5 applies (interstitial shown) even though
  AC-7's "already pinned" is true for the neutral pin. "First pin" means first pin *of this
  identity* (tag × observer × context), not first pin ever.
- **Not covered:** a preview of the resulting membership (open question 4); a "don't show
  again" (open question 3); the variant-name field (story 5); any change to the pin switcher
  or the Pinned tab's layout; any change to what the runners compute.

## Out of scope

- **Any change to `defaultCurationMethod`.** The interstitial reveals the default; it does not
  re-decide it. Changing it is a wire-visible act and belongs in its own story.
- **The pin switcher / Pinned-tab layout** — story 5's surface, and the design doc's
  "place vs recipe" warning (`docs/SEARCH_INDEX_DLIST_SELECTION.md:221-224`) governs it there.
  This story leaves the switcher untouched.
- **The variant-key field** (story 5) and the **membership-method field** (story 3). Both land
  in the same dialog; both arrive through their own stories. This story must not pre-build
  their controls, only avoid making room for them impossible.
- **Re-pin / edit / unpin flows**, `/pins`, `PinDetail`, and the ExportModal.
- **The bulk `refresh-pinned-tags-for-viewer` path** and the cron backstop.
- Any change to who may publish a tagging or a pin. Write-time gating is out of bounds
  (CLAUDE.md invariant 2).

## Open questions for Gate A

1. **Reuse `CurationMethodDialog` in `mode='create'`, or build a new component?**
   **Recommendation: reuse** — one dialog, two entry modes. It already edits every field of
   the blob, already has the `mode='create'` branch wired end-to-end (title `:201`, submit
   label `:166`, no Unpin `:419`, `:429`), and that branch is currently dead. A second
   component would immediately fork: story 3's `membershipMethod` and story 5's variant key
   each need to appear in *both*, and the `targetTypes` / `authorConstraint` fallback discipline
   (`:73-81`, `:88-93`) would have to be maintained twice — exactly the drift that produced the
   guard tests this story runs against. **What differs in first-pin mode** (recommended):
   title reads as a confirmation rather than a settings editor (e.g. "Pin this tag"), primary
   button "Pin" / "Pin with these settings" (the existing label is already right), and **one
   added explanation line**: *"Pinning publishes a Trusted List under your point of view with
   this curation."* Nothing else changes. The Architect rules on whether first-pin is a third
   `mode` value or `mode='create'` plus a flag.
2. **Copy, and a "what's a Trusted List?" affordance.** Recommendation: **yes, one inline
   affordance** — the explanatory sentence above plus a small expandable "What's a Trusted
   List?" that says, in one or two sentences, that it is a list published under the user's
   point of view that other nostr apps can read. The Pin button's existing tooltip
   (`TagPinAffordance.jsx:48`) already carries roughly this copy and is the obvious source. It
   must be collapsed by default — the dialog is a confirm step, not a tutorial. Exact wording
   is the operator's call at Gate A.
3. **Add a "don't show this again"?** **Recommendation: no.** Visibility is the entire point
   of the story, and a suppressed interstitial re-creates exactly the silent-publish behaviour
   the operator asked to remove — with the added harm that it would be invisible to the person
   debugging why a list appeared. AC-7 already means a returning pinner of the same tag never
   sees it; the frequency argument is weaker than it looks. (Related sub-question: should the
   dialog echo the `povResolution` notice for a viewer with no WoT? Recommendation: **defer** —
   E3 says it must not block; the Tag page already shows the banner a few pixels away.)
4. **Should the interstitial preview the resulting list ("this would currently include N
   members")?** **Recommendation: defer.** It is the most compelling version of this feature
   and the one that would most reduce surprise — but it needs a live aggregation call against a
   pin that does not exist yet, i.e. a dry-run path through `runOnePin`/`runOneNotePin`/
   `runOneItemPin` (`refreshPinnedTags.js:430-432`) keyed on an unsigned blob. That is a server
   change, a new endpoint, and a latency budget inside a modal — a story of its own, and one
   worth writing *after* stories 3 and 5 settle what the blob contains. Record it in the epic
   as a candidate, not here.
5. **Ordering versus story 5.** **Recommendation: 4 before 5.** Story 5 adds a variant-name
   field to this same dialog and needs a place for it; landing the interstitial first means
   story 5 gets a first-pin surface to name the variant *at creation time*, which is where
   naming a "saved recipe" actually belongs. Doing 5 first would build the field into an
   edit-only dialog and then have to re-home it. The epic already sequences story 4
   "before or with" story 5 (`epics/search-index-selection.md`, story 4 entry).
6. **Does the interstitial fire for *any* new pin, or only the viewer's very first ever?**
   **Recommendation: any new pin** (per E6 — tag × observer × context is the pin identity).
   "First pin" in the operator's phrasing means "the pin that is about to be created", and a
   per-account one-shot would be a "don't show again" by another name (question 3).

## Design note *(provisional — Gate A classifies, Reviewer ratifies at Gate B)*

- **Chosen approach:** move the existing curation dialog in front of the first publish rather
  than after it — the same component, the same blob, the same publish sequence, reordered.
  No event shape changes; `defaultCurationMethod` is not touched.
- **Rejected alternative:** a new lightweight "confirm" component showing a read-only summary
  with an "advanced" link to the real dialog. Rejected because the operator's stated purpose is
  that the curation be *editable* at that moment, and because two components guarantee drift as
  stories 3 and 5 add fields to the blob.
- **Blast radius:** the tag-detail pin flow (`ui/src/pages/Tag.jsx`), the pin affordance
  (`ui/src/components/TagPinAffordance.jsx`), and the create-mode branch of
  `ui/src/components/CurationMethodDialog.jsx`. Non-consumers to grep-verify: the server
  runners (`src/api/trustedList/refreshPinnedTags.js`), `ui/src/utils/publishTagPin.js`'s
  `pinTag` signature and `defaultCurationMethod` body, and the edit mounts
  (`PinnedListPanel.jsx:781`, PinDetail, `/pins`).
- **Supersedes:** ADR 0016's "Pin button friction" decision (option 3A,
  `decisions/0016-curated-mobile-affordances-and-pin-state-polish.md:31-35`, `:190-196`). Its
  premise — WYSIWYG, the defaults match what the user is already looking at (`:69-71`) — no
  longer holds now that the blob carries `targetTypes`, `noteMethod`, `authorConstraint`, and
  soon `membershipMethod` and a variant key. The Architect should state this reversal
  explicitly wherever ADR 0016 is cited.
- **Classification risk:** if the Architect finds any reason the interstitial would alter the
  published default blob, the "wire format or event shape" trigger fires and the story
  escalates to Standard with a full ADR.

## Scoped gate proposal *(Gate A to confirm)*

`npm test -- test/confirm-step-on-first-pin.test.js test/generalized-tag-pinning.test.js test/only-me-curation.test.js test/pin-stack-composition.test.js test/context-scoped-pins.test.js`

- `test/confirm-step-on-first-pin.test.js` — **new**, this story's suite (must carry AC-2's
  byte-identity sentinel and AC-3's publishes-nothing assertion).
- Guards (must stay green, unchanged): `test/generalized-tag-pinning.test.js`,
  `test/only-me-curation.test.js`, `test/pin-stack-composition.test.js`,
  `test/context-scoped-pins.test.js`.

## Linked artifacts
- ADR: (none expected — Design note above; filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
