# Story 3: Per-pin membership method

**Status:** Approved
**Created:** 2026-09-18
**Type:** Feature *(Light book, **with an ADR**: the method rides the published
`curationMethod` JSON and — per Gate A ruling 3 — the published 30392 records the fold that
ran, so the change is wire-visible twice over. Gate A ruled the lane: **Light + ADR**.)*
**Epic:** `engineering-team/epics/search-index-selection.md` (story 3)
**Book:** `engineering-team/audits/search-index-selection/book.md` (acceptance-frame bullet 3,
"Per-pin curation")
**Design target:** `docs/SEARCH_INDEX_DLIST_SELECTION.md` (rev 3) — § "Design note: per-pin
curation implies multiple pins per tag" (`:187-225`).
**Ledger:** OPEN 307 (`OPEN.md:363`).

## Background

This story is **Part A** of the book's third acceptance bullet — "the membership method and
the new constraint live on the pin, not the instance-wide dial". Part B (a viewer holding
more than one pin of a tag without the pin having to be about a community) was split out at
Gate A into **story 5**, `5-explicit-pin-variant-key.md`.

### The membership method is one instance-wide dial

`resolveMembershipMethod()` reads `trustedLists.membershipMethod` out of operator settings for
the whole deployment (`src/api/trustedList/membershipMethods.js:34-42`), and the profile runner
calls it once per refresh to pick the fold (`src/api/trustedList/refreshPinnedTags.js:303-307`,
dispatching `membershipFolds` at `:308-332`). So tightening the search-index list to `certainty`
would retune **every** Trusted List on the deployment, and there is no way to run one strictly
curated list beside normally curated ones (OPEN 307, `OPEN.md:363`).

The pin already is the right carrier, and the per-pin precedent already exists *for the other
two runners*: the note and item runners read **`curation.noteMethod`** straight off the pin's
blob (`refreshPinnedTags.js:530` and `:645`, defaulting to `'notes:net-endorsed'`), and publish
it on the list as `['curation-method', noteMethod]` (`:574`, `:691`). The profile runner is the
odd one out — it is the only reader of the global dial in the codebase. The blob has also
accumulated fields additively twice already under the rule **absent means the pre-existing
default**: `targetTypes` (`dlist-item-tagging` #5; runner fallback stays `['profile','note']`,
`refreshPinnedTags.js:510`, `:628`) and `authorConstraint` (`search-index-selection` ADR 0001,
read at `:264`, `:507`, `:625`). This story is the third instance of the same move.

Every reader of the global dial, and what it does:

| Reader | `file:line` | What it does |
|---|---|---|
| `runOnePin` (profile TL, kind-30392) | `refreshPinnedTags.js:303-307` | Resolves the method, then downgrades to `count` when the WoT filter did not run (`:306-307`), dispatches `membershipFolds` (`:308-331`), and emits `['rigor','0.5']` only under `certainty` (`:375`). **The only functional consumer.** |
| `runOneNotePin` (kind-30393) | — | Does **not** call it. Uses `curation.noteMethod` (`:530`) — already per-pin. |
| `runOneItemPin` (kind-30394) | — | Does **not** call it. Uses `curation.noteMethod` (`:645`) — already per-pin. |
| `TLMembershipMethodCard` | `ui/src/pages/grapevine/TrustDetermination.jsx:30-145`; `TL_MEMBERSHIP_METHODS` mirrors the server ids at `:13-22`; reads `:47`, writes `:65` | The operator-facing radio group that sets the dial. Owner-gated `/api/settings`. Its copy at `:93` claims "Published TLs record the active method in a `membership-method` tag" — **false today**, true again once AC-4 lands. |

(`enrichRowsWithTLStatus` at `src/api/profile-tags/index.js:1690`/`:1715` and the TL status
endpoint at `src/api/trustedList/index.js:409-411` read the pin's *variant*, not the method —
untouched by this story; they are story 5's problem.)

**What the published TL emits today — verified.** The `membership-method` tag is **stripped**:
`refreshPinnedTags.js:372-374` says so in as many words ("the ladder's membership-method tag is
stripped (never spec'd)"), only `['rigor','0.5']` rides a `certainty` list (`:375`), and
`test/tl-weighted-sum-method.test.js:324`, `:387`, `:426` assert its absence three times. The
note and item lists *do* carry `['curation-method', noteMethod]` (`:574`, `:691`). So a consumer
of a 30392 cannot tell which fold produced it — tolerable while the answer is one deployment-wide
value an operator can look up, **not** tolerable once it is per-pin. Hence AC-4.

### The UX constraint, as it bears on Part A

The design doc's warning — "A community context is a **place**. An arbitrary curation variant is
a **saved recipe** … Putting recipes in the same chip row as places is what would make it
incomprehensible" (`docs/SEARCH_INDEX_DLIST_SELECTION.md:220-225`) — is binding on **story 5**,
not here: Part A adds no second pin and no chip. Its only surface is the existing curation
dialog (`ui/src/components/CurationMethodDialog.jsx`), where the method sits beside the trust
scope and target types it already varies (AC-5). Part A must not add any affordance that
creates a second pin of a tag; that is story 5's, sequenced with story 4's confirm step.

This stays a **read-time** change: nobody is gated from publishing anything, and the method
only decides how one pin's own list folds its own already-trust-filtered set (CLAUDE.md
invariants 2 and 3). No TA pubkey literal is introduced.

## User-facing description

As a curator, I want each pin of a tag to carry **its own** membership method, so that I can run
one strictly-curated list — the one a search backend subscribes to — beside my ordinary lists,
without retuning every Trusted List on the deployment.

## Acceptance criteria

- [ ] **AC-1 — the pin's method wins.** When a pin's `curationMethod` carries
      `membershipMethod` with an implemented value, `runOnePin` folds by *that* method
      regardless of the instance-wide setting. Same corpus, same observer, two pins differing
      only in the field ⇒ two lists folded differently (the sharpest sentinel: one pin at
      `count` and one at `certainty` on a deployment whose dial says `count`).
- [ ] **AC-2 — absent means today.** A pin whose blob omits `membershipMethod` produces a
      **byte-identical** published 30392 to the one it produces before this story — same `d`,
      members, order, tags, content — with the instance-wide dial still supplying the method
      (`membershipMethods.js:34-42`). Changing the dial still retunes exactly those pins and
      no others. **No already-published pin changes meaning.** *(AC-4 is the sole, deliberate
      exception to byte-identity: the disclosure tag now rides every 30392.)*
- [ ] **AC-3 — fail-safe, per pin.** An unknown, future-rung, or malformed per-pin value
      resolves the same way the global resolver does — to the instance default rather than
      refusing to refresh (`membershipMethods.js:39-41`) — and the existing degradation "a
      weighted method with no WoT filter downgrades to `count`" (`refreshPinnedTags.js:306-307`)
      still applies to the per-pin value.
- [ ] **AC-4 — the list discloses the method that ran.** Every published 30392 carries
      `['membership-method', <fold-that-ran>]` naming the fold actually executed
      (post-downgrade), so a consumer can tell a `certainty` list from a `count` one without
      fetching the pin. This **reverses the Story-4 strip** (`refreshPinnedTags.js:372-374`)
      and is the one non-additive wire change here; the three assertions pinning the strip
      (`test/tl-weighted-sum-method.test.js:324`, `:387`, `:426`) are re-aimed by the Tester,
      deliberately, not incidentally.
- [ ] **AC-5 — the curation dialog sets it.** A pin owner can choose the method when creating
      or editing a pin; the published pin's `curationMethod` carries it in **both** copies (the
      `curation-method` tag and `content.tagPinning.curationMethod`,
      `ui/src/utils/publishTagPin.js:160-172`), and the two agree. Editing a pre-story pin must
      not silently stamp a method onto it (the `targetTypes` edit-path precedent,
      `ui/src/components/CurationMethodDialog.jsx:75-81`).
- [ ] **AC-6 — the dial's copy tells the truth.** The Trust Determination card
      (`ui/src/pages/grapevine/TrustDetermination.jsx:30-145`) describes itself as the default
      for pins that do not choose, and its claim that published TLs record the active method
      (`:93`) is accurate rather than aspirational.

## Concepts touched

- `39998:<TA>:tag-pinning` — the pin element carrying `curationMethod` (ADR-0015
  legacy-literal exception applies to the handle only; no new literal).
- `39998:<TA>:trusted-list` — the published kind-30392 whose tags now disclose the fold.

## Edge cases

- **E1 — per-pin method on a note/item pin.** The note and item runners already read
  `noteMethod` per pin (`:530`, `:645`) and never consult the dial. `membershipMethod` is a
  sibling field, not a merge (Gate A ruling 1); note/item behaviour must be unchanged.
- **E2 — a weighted per-pin method with no WoT filter.** Downgrade to `count`
  (`refreshPinnedTags.js:306-307`) and the AC-4 disclosure records the **post-downgrade** fold,
  not the requested one.
- **E3 — per-pin method × `authorConstraint: observer`.** Story 2's AC-7 carve-out (the
  observer's own weight is 1.0 under the constraint, `pins.js:194-199`) must still hold when
  the method comes from the pin rather than the dial — this combination is the day-one search
  list.
- **E4 — the operator flips the instance dial after this story.** Pins carrying an explicit
  method are unaffected; pins without one still move (AC-2). Worth an explicit sentinel, since
  it is the behaviour the Trust Determination page now describes (AC-6).
- **Not covered:** rung 2 (`author ∈ <list>`); naming the `worth-indexing-for-search` tag;
  what the search backend does with the list.

## Out of scope

- **Part B — the explicit pin variant key** (a second pin of a tag that is not about a
  community; the five `d`-tag schemes; the reader paths; the uniqueness guard; the slug
  vocabulary). Lifted verbatim into **story 5**,
  `engineering-team/stories/search-index-selection/5-explicit-pin-variant-key.md`.
- **The first-pin confirm step** — making a default curation that quietly publishes a list
  visible and editable. That is **story 4** (epic item 4), sequenced before or with story 5.
- **The deliberate UX design round** for places vs recipes across the Pinned tab
  (`ui/src/pages/Tag.jsx:556-575`), the Pins page (`ui/src/pages/Pins.jsx:49`) and
  `PinnedListPanel` (`:135`). Binding on story 5; nothing here touches it.
- **Retiring the instance-wide dial.** It stays as the fallback (AC-2) and keeps its card
  (`TrustDetermination.jsx:30`); only its copy changes (AC-6).
- **Rung 2 and rung 3** of the guard ladder, and the filter-list picker.
- Any change to who may publish a tagging or a pin. Write-time gating is out of bounds.
- Renaming or re-parenting the concept handles (ADR-0015 exception territory).

## Gate A rulings (operator, 2026-09-18)

Approved as proposed. The rulings below are settled, not open questions.

1. **Field name for the per-pin method → `membershipMethod`.** On the `curationMethod` blob,
   values from `METHOD_IDS` (`membershipMethods.js:20`), absent meaning "use the instance
   dial". It reads as the exact per-pin twin of the setting key it replaces
   (`trustedLists.membershipMethod`, `:38`) and sits naturally beside the existing `noteMethod`
   (`refreshPinnedTags.js:530`) — note/profile stay two fields, because they are two different
   vocabularies (`notes:net-endorsed` vs `count|input|certainty`) and merging them would be a
   semantic change to already-published note pins. Rejected: reusing `method`, which is taken
   by the POV method (`'nip85:rank'`, `refreshPinnedTags.js:253`).

3. **The published 30392 discloses the method → yes.** Restore
   `['membership-method', <fold-that-ran>]`, matching what the note and item lists already emit
   (`['curation-method', noteMethod]`, `:574`, `:691`) and what the UI already *claims* happens
   (`TrustDetermination.jsx:93`). Once the method is per-pin, "look up the deployment setting"
   stops being an answer, and the list is the permanent consumer interface. This is the one
   **non-additive** change here: three tests assert its absence
   (`test/tl-weighted-sum-method.test.js:324`, `:387`, `:426`) and were written deliberately at
   Story 4 — the **Tester re-aims them**; the Implementer does not quietly delete them. It must
   record the **post-downgrade** fold (E2).

5. **The instance dial stays as the default for pins that don't choose**, with its copy fixed
   (AC-6). No behaviour change to the dial. Its blurb (`TrustDetermination.jsx:89-94`) becomes
   true again under ruling 3.

8. **Split, Part A first.** Part A (this story) is small, additive, fully precedented
   (`noteMethod` and `targetTypes` already did it), touches one runner plus the dialog, and on
   its own unblocks the book's day-one need — the search-index pin can be the tag's *neutral*
   pin with an explicit method and `authorConstraint`. Part B is a different kind of change
   (identity rather than scoring) and becomes story 5, with its own ADR.

## Open questions

- **A third copy of the method vocabulary.** `TL_MEMBERSHIP_METHODS`
  (`TrustDetermination.jsx:13-22`) already mirrors the server ids by hand ("keep in sync",
  `:14`); the curation dialog would become a **second** UI mirror. The Architect should say
  whether a third copy is acceptable in a no-build project, or whether the ids should be
  sourced once.

## Scoped gate *(Gate A confirmed)*

`npm test -- test/per-pin-membership-method.test.js test/pin-stack-composition.test.js test/only-me-curation.test.js test/item-trusted-list.test.js test/note-trusted-list.test.js test/tl-weighted-sum-method.test.js`

- `test/per-pin-membership-method.test.js` — **new**, this story's suite.
- Guards (must stay green, unchanged): `test/pin-stack-composition.test.js` (the `d`-tag spine
  and the byte-identity guarantee), `test/only-me-curation.test.js` (story 2's constraint still
  composes, E3), `test/item-trusted-list.test.js` and `test/note-trusted-list.test.js` (the
  note/item runners' own per-pin method is untouched, E1).
- `test/tl-weighted-sum-method.test.js` — **a re-aim target, not a guard.** Its three
  `membership-method`-absence assertions (`:324`, `:387`, `:426`) are amended by the Tester to
  assert the disclosure tag per AC-4. Every other assertion in the file stays green unchanged.
- **Deliberately excluded from the judge gate:** `test/tl-membership-method-selector.test.js`
  (`test/registry.js:205`). Its layer-3 assertions publish through a live control panel and
  strfry (`:16-20`), so it **hangs without a live stack** and cannot run inside a judge's tool
  cap. It is nonetheless the closest guard to this story — the **operator runs it against a
  running stack at Gate B**, and its `membership-method`-tag expectations change under AC-4.

## Linked artifacts

- Design target: `docs/SEARCH_INDEX_DLIST_SELECTION.md` (rev 3), § "Design note: per-pin
  curation implies multiple pins per tag" (`:187-225`)
- Ledger: `OPEN.md:363` (OPEN 307)
- Split sibling: `engineering-team/stories/search-index-selection/5-explicit-pin-variant-key.md`
- Precedent stories: `engineering-team/stories/search-index-selection/2-only-me-curation.md`;
  `dlist-item-tagging` #5 (`targetTypes`)
- Precedent ADRs: `engineering-team/decisions/search-index-selection/0001-author-constraint.md`
  (additive field on the blob); `engineering-team/decisions/contextual-pins/0001-context-scoped-pins.md`
  (the pin/TL identity model); `engineering-team/decisions/feat-tags-modernization/0001-pin-stack-composition.md`
  (the variant-key mechanism story 5 generalises)
- ADR: (filled in after Architecture phase — expected: `decisions/search-index-selection/0002-…`)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
