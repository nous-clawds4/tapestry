# Story 3: Per-pin curation method, and an explicit pin variant key

**Status:** Draft
**Created:** 2026-09-18
**Type:** Feature *(Light book; **both halves are wire-visible** — the method rides the
published `curationMethod` JSON, and the variant rides the `d` tag, which is the search
backend's permanent subscription key. The irreversibility trigger "a wire format or event
shape" fires twice, so an **ADR is expected**. **Gate A rules the lane**, including whether
this ships as one story or two.)*
**Epic:** `engineering-team/epics/search-index-selection.md` (story 3)
**Book:** `engineering-team/audits/search-index-selection/book.md` (acceptance-frame bullet 3,
"Per-pin curation")
**Design target:** `docs/SEARCH_INDEX_DLIST_SELECTION.md` (rev 3) — § "Design note: per-pin
curation implies multiple pins per tag" (`:187-225`) and § "Why the address encodes identity
and not method" (`:229-243`).
**Ledger:** OPEN 307 (`OPEN.md:363`).

## Background

Two separate anomalies block the book's third acceptance bullet — "the membership method and
the new constraint live on the pin, not the instance-wide dial; a viewer can hold more than
one pin of a tag, each with its own curation and its own list, **without the pin having to be
about a community**."

### (a) The membership method is one instance-wide dial

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
| `enrichRowsWithTLStatus` | `src/api/profile-tags/index.js:1690`, d-tag at `:1715` | Derives each pin's TL `d`-tag to look up publish status. Reads the *variant* (`row.context` → `pinVariantKey`), **not** the method. Untouched by (a); **is** touched by (b). |
| TL status endpoint | `src/api/trustedList/index.js:409-411` | Hand-composes the same `tl-pin-…` string via `pinVariantKey`. Same: variant only. |
| `TLMembershipMethodCard` | `ui/src/pages/grapevine/TrustDetermination.jsx:30-145`; `TL_MEMBERSHIP_METHODS` mirrors the server ids at `:13-22`; reads `:47`, writes `:65` | The operator-facing radio group that sets the dial. Owner-gated `/api/settings`. Its copy at `:93` claims "Published TLs record the active method in a `membership-method` tag" — **that is false today** (see below). |

**What the published TL emits today — verified.** The `membership-method` tag is **stripped**:
`refreshPinnedTags.js:372-374` says so in as many words ("the ladder's membership-method tag is
stripped (never spec'd)"), only `['rigor','0.5']` rides a `certainty` list (`:375`), and
`test/tl-weighted-sum-method.test.js:324`, `:387`, `:426` assert its absence three times. The
note and item lists *do* carry `['curation-method', noteMethod]` (`:574`, `:691`). So a consumer
of a 30392 cannot tell which fold produced it — tolerable while the answer is one deployment-wide
value an operator can look up, **not** tolerable once it is per-pin. Hence AC-4 and open
question 3.

### (b) The only way to hold two pins of one tag is to claim one is about a community

The variant key is *derived*, not stored: `contextSlugOfPin` reads a `39998:<runtimeTA>:<slug>`
`z` off the pin and returns the slug only when it is in `KNOWN_CONTEXT_SLUGS`
(`src/lib/event-tagging/pins.js:99-108`, set at `:23-28`); `pinVariantKey({ contextSlug })`
turns it into the `-in-<ctx>` suffix (`:39-41`) that discriminates all five `d`-tag schemes —
`tlDTag` / `noteTlDTag` / `itemTlDTag` (`:61-73`), plus `computePinEventDTag` (`ui/src/utils/
publishTagPin.js:58-59`) and `computeNoteBookmarkDTag` (`:357`). ADR
`feat-tags-modernization/0001` §2 already anticipated the generalisation — "future 'other ways
to pin the same tag' extend this one helper" (`pins.js:36-37`) — and pinned the suffix's single
job: **replaceability, and no reader parses it** (ADR `feat-tags-modernization/0001:192-193`).

The design doc names the conflation precisely: "context" bundles a **variant key** (lets pins
coexist and take distinct addresses) with a **semantic claim** (this pin is scoped to a
community), and an indexing-curation pin wants the first and not the second
(`docs/SEARCH_INDEX_DLIST_SELECTION.md:198-205`). The fix inverts the dependency: store the
variant on the pin; stamp the context `z` only when the variant genuinely names a community.
Existing contextual pins stay valid — they become variants whose slug happens to be in
`KNOWN_CONTEXTS` and which therefore also carry the `z`.

**Why this is irreversible.** The variant lands in the `d` tag, and the resulting
`30394:<TA>:tl-pin-items-…` address is exactly what the search backend subscribes to,
permanently (book acceptance frame; design doc `:229-239`). A variant slug chosen today cannot
be renamed later without silently changing a consumer's subscription.

### The UX constraint is binding, and it is a modelling problem

"A community context is a **place**. An arbitrary curation variant is a **saved recipe** …
Putting recipes in the same chip row as places is what would make it incomprehensible. Worth a
deliberate design round before building." (`docs/SEARCH_INDEX_DLIST_SELECTION.md:220-225`.)
That row is `ui/src/pages/Tag.jsx:556-575` — `orderedViewerPins` (`:173-177`) sorts the neutral
pin first ("Personal", `:559`) then contexts alphabetically by `contextNameOf` (`:170-172`), and
the row is hidden entirely below two pins (`:556`). The entry point is
`PinToContextModal` ("Pin to a community", `ui/src/components/PinToContextModal.jsx:21-22`,
`:64`) fed `KNOWN_CONTEXTS` from `Tag.jsx:601`, launched from `TagPinAffordance.jsx:77`
("Pin this tag within a community context"). The same place/label logic is duplicated in
`ui/src/components/PinnedListPanel.jsx:135` and `ui/src/pages/Pins.jsx:49`. This story does
**not** spend that design round (see Out of scope, and open question 6 for the minimum).

This stays a **read-time** change: nobody is gated from publishing anything, and the method
only decides how one pin's own list folds its own already-trust-filtered set (CLAUDE.md
invariants 2 and 3). No TA pubkey literal is introduced; the variant's context `z` keeps
composing from the runtime TA (`pins.js:47-49`).

## User-facing description

As a curator, I want each pin of a tag to carry **its own** membership method, and I want to
hold **several pins of the same tag** distinguished by a name I choose rather than by claiming
a community, so that I can run one strictly-curated list — the one a search backend
subscribes to — beside my ordinary lists, without retuning every Trusted List on the
deployment and without pretending my curation is a place.

## Acceptance criteria

### Part A — per-pin membership method

- [ ] **AC-1 — the pin's method wins.** When a pin's `curationMethod` carries the method field
      with an implemented value, `runOnePin` folds by *that* method regardless of the
      instance-wide setting. Same corpus, same observer, two pins differing only in the field
      ⇒ two lists folded differently (the sharpest sentinel: one pin at `count` and one at
      `certainty` on a deployment whose dial says `count`).
- [ ] **AC-2 — absent means today.** A pin whose blob omits the field produces a
      **byte-identical** published 30392 to the one it produces before this story — same `d`,
      members, order, tags, content — with the instance-wide dial still supplying the method
      (`membershipMethods.js:34-42`). Changing the dial still retunes exactly those pins and
      no others. **No already-published pin changes meaning.**
- [ ] **AC-3 — fail-safe, per pin.** An unknown, future-rung, or malformed per-pin value
      resolves the same way the global resolver does — to the instance default rather than
      refusing to refresh (`membershipMethods.js:39-41`) — and the existing degradation "a
      weighted method with no WoT filter downgrades to `count`" (`refreshPinnedTags.js:306-307`)
      still applies to the per-pin value.
- [ ] **AC-4 — the list discloses the method that ran.** Every published 30392 carries a tag
      naming the fold actually executed (post-downgrade), so a consumer can tell a `certainty`
      list from a `count` one without fetching the pin. This **reverses the Story-4 strip**
      (`refreshPinnedTags.js:372-374`) and is the one non-additive wire change here — see open
      question 3, and note the three assertions that must be revised deliberately
      (`test/tl-weighted-sum-method.test.js:324`, `:387`, `:426`).
- [ ] **AC-5 — the curation dialog sets it.** A pin owner can choose the method when creating
      or editing a pin; the published pin's `curationMethod` carries it in **both** copies (the
      `curation-method` tag and `content.tagPinning.curationMethod`,
      `ui/src/utils/publishTagPin.js:160-172`), and the two agree. Editing a pre-story pin must
      not silently stamp a method onto it (the `targetTypes` edit-path precedent,
      `ui/src/components/CurationMethodDialog.jsx:75-81`).

### Part B — explicit pin variant key

- [ ] **AC-6 — a variant that is not a community.** A viewer can create a second pin of the
      same tag by naming a variant that is **not** in `KNOWN_CONTEXTS` (`pins.js:23-28`). The
      resulting pin coexists with the neutral pin, gets its own pin `d`-tag and its own
      30392/30393/30394 `d`-tags, and carries **no** context `z` (`pins.js:47-49`) — nothing
      on the wire claims it is about a community.
- [ ] **AC-7 — contextual pins are unchanged, byte for byte.** Every pin published to date —
      neutral or contextual — keeps its exact `d`-tags across all five schemes
      (`pins.js:61-73`, `publishTagPin.js:58-59`, `:357`), its `z` set, and its published list
      bytes. A pin whose variant *is* a known community slug still emits the context `z` and
      still resolves through `contextSlugOfPin` (`pins.js:99-108`). Newly created community
      pins are indistinguishable on the wire from ones created before this story.
- [ ] **AC-8 — variant uniqueness per (observer, tag).** Two pins of the same tag by the same
      observer cannot take the same variant slug, because they would collide on the address
      (`docs/SEARCH_INDEX_DLIST_SELECTION.md:213-215`). Attempting it is refused with a message
      naming the conflict, and no event is signed or published. Includes the case where the
      chosen name *slugifies* onto an existing variant (`src/lib/event-tagging/slug.js:11-17`),
      and the case where it slugifies onto a `KNOWN_CONTEXTS` slug or onto the neutral pin.
- [ ] **AC-9 — slug rules are the house rules.** The variant slug is derived by the canonical
      `slug()` (`src/lib/event-tagging/slug.js:11-17`); a name that slugifies to the empty
      string is refused; the stored variant is the slug, and any human-readable name is
      display-only.
- [ ] **AC-10 — the reader path resolves variants.** Every derived-`d`-tag reader keys off the
      stored variant rather than the derived context: `enrichRowsWithTLStatus`
      (`src/api/profile-tags/index.js:1690`, `:1715`), the TL status endpoint
      (`src/api/trustedList/index.js:409-411`), and the pin list the Tag page reads
      (`src/api/profile-tags/index.js:900`, `:905`). A non-community variant's TL publish
      status resolves correctly; the neutral pin is still the one with no variant (`:905`).
- [ ] **AC-11 — the minimum switcher UX.** The Pinned tab can reach a non-community variant's
      list without misrepresenting it as a place (`ui/src/pages/Tag.jsx:556-575`). The exact
      minimum is open question 6; whatever is chosen, **recipes are visually distinct from
      places** and the existing "Personal"-first ordering (`:173-177`) is preserved.

## Concepts touched

- `39998:<TA>:tag-pinning` — the pin element carrying `curationMethod` and the new variant
  (ADR-0015 legacy-literal exception applies to the handle only; no new literal).
- `39998:<TA>:trusted-list` — the published 30392 / 30393 / 30394 family whose `d` tags the
  variant discriminates.
- `39998:<runtimeTA>:<contextSlug>` — the community-context concepts (`pins.js:47-49`), which
  become *one* populator of the variant rather than the only one.

## Edge cases

- **E1 — a variant slug that is a known community slug.** Must behave exactly like today's
  contextual pin: context `z` stamped, `contextSlugOfPin` resolves it, `-in-<ctx>` suffix (or
  whatever open question 4 rules). The two paths must not diverge.
- **E2 — a deployment extends `KNOWN_CONTEXTS` after a pin was published.** A variant that was
  a plain recipe yesterday becomes a community slug today. Behaviour must be defined and must
  **not** silently change an already-published pin's address or start/stop emitting a `z` on
  refresh (this is the cross-deployment hazard `contextSlugOfPin`'s known-set matching already
  creates — `pins.js:104-105`).
- **E3 — per-pin method on a note/item pin.** The note and item runners already read
  `noteMethod` per pin (`:530`, `:645`) and never consult the dial. Whether the new profile
  field is the *same* field or a sibling is open question 1; either way, note/item behaviour
  must be unchanged.
- **E4 — a weighted per-pin method with no WoT filter.** Downgrade to `count`
  (`refreshPinnedTags.js:306-307`) and the AC-4 disclosure records the **post-downgrade** fold,
  not the requested one.
- **E5 — per-pin method × `authorConstraint: observer`.** Story 2's AC-7 carve-out (the
  observer's own weight is 1.0 under the constraint, `pins.js:194-199`) must still hold when
  the method comes from the pin rather than the dial — this combination is the day-one search
  list.
- **E6 — the operator flips the instance dial after this story.** Pins carrying an explicit
  method are unaffected; pins without one still move (AC-2). Worth an explicit sentinel, since
  it is the behaviour the Trust Determination page now describes (open question 5).
- **E7 — variant present in the blob but the pin also carries a context `z`, disagreeing.**
  Must resolve deterministically with the stored variant winning (it is what the `d` tag was
  composed from), never producing a `d`-tag the publisher did not compute.
- **E8 — a variant slug long enough to threaten the `d`-tag.** `d` tags already concatenate
  two 8-char prefixes plus the tag slug (`pins.js:61-73`); a length bound or its deliberate
  absence should be stated.
- **E9 — export / bookmark d-tags.** `computeNoteBookmarkDTag` (`publishTagPin.js:357`) takes
  the same variant; the NIP-51 export path must not fall back to the neutral address for a
  variant pin.
- **Not covered:** rung 2 (`author ∈ <list>`); the full places-vs-recipes design round; naming
  the `worth-indexing-for-search` tag; what the search backend does with the list; migrating
  existing contextual pins to carry an explicit variant field (they keep deriving).

## Out of scope

- **The deliberate UX design round** for places vs recipes across the Pinned tab, the Pins page
  (`ui/src/pages/Pins.jsx:49`) and `PinnedListPanel` (`:135`). This story ships the *minimum*
  affordance (AC-11 / open question 6) and defers the rest; the design doc's warning
  (`:220-225`) is treated as binding, not as a to-do.
- **Retiring the instance-wide dial.** It stays as the fallback (AC-2) and keeps its card
  (`TrustDetermination.jsx:30`); at most its copy changes (open question 5).
- **Rung 2 and rung 3** of the guard ladder, and the filter-list picker.
- **Back-filling a variant field onto existing contextual pins.** Derivation stays the
  compatibility path.
- Any change to who may publish a tagging or a pin. Write-time gating is out of bounds.
- Renaming or re-parenting the concept handles (ADR-0015 exception territory).

## Open questions for Gate A

1. **Field name for the per-pin method.** Recommendation: **`membershipMethod`** on the
   `curationMethod` blob, values from `METHOD_IDS` (`membershipMethods.js:20`), absent meaning
   "use the instance dial". It reads as the exact per-pin twin of the setting key it replaces
   (`trustedLists.membershipMethod`, `:38`) and sits naturally beside the existing
   `noteMethod` (`refreshPinnedTags.js:530`) — note/profile stay two fields, because they are
   two different vocabularies (`notes:net-endorsed` vs `count|input|certainty`) and merging
   them would be a semantic change to already-published note pins. Rejected: reusing `method`,
   which is taken by the POV method (`'nip85:rank'`, `refreshPinnedTags.js:253`).

2. **Where does `variant` live — the blob, or a pin tag?** Recommendation: **a dedicated `d`-
   adjacent tag on the pin event, `['variant', '<slug>']`**, not the `curationMethod` blob.
   Reason: the blob is *scoring* config and the variant is *identity* — the exact split ADR
   `feat-tags-modernization/0001` §1 made load-bearing ("context first (identity), then the
   curation (scoring)", `refreshPinnedTags.js:275-278`). Identity must be readable without
   parsing JSON, must be relay-filterable, and must not be buried in a field whose absence
   already means "fall back to a default". It also keeps the variant *out* of the blob that
   `parseCurationMethod` may silently fail to parse (`src/api/profile-tags/index.js:591-604`) —
   an unparseable blob must never silently collapse two pins onto one address. Alternative
   worth a ruling: the blob, for a single carrier.

3. **Does the published 30392 disclose the method (AC-4)?** Recommendation: **yes — restore
   `['membership-method', <fold-that-ran>]`**, matching what the note and item lists already
   emit (`['curation-method', noteMethod]`, `:574`, `:691`) and what the UI already *claims*
   happens (`TrustDetermination.jsx:93`). Once the method is per-pin, "look up the deployment
   setting" stops being an answer, and the list is the permanent consumer interface. Caveats
   the Architect must weigh: it is the one **non-additive** change here (three tests assert its
   absence — `test/tl-weighted-sum-method.test.js:324`, `:387`, `:426` — and they were written
   deliberately at Story 4); and it must record the **post-downgrade** fold (E4). Alternative:
   disclose only when the pin carries an explicit method, keeping dial-driven lists byte-
   identical — narrower blast radius, but a consumer then cannot distinguish "count" from
   "unknown".

4. **`d`-tag composition for a non-community variant.** Recommendation: **`-in-<ctx>` stays,
   unchanged, when the variant names a known community; a non-community variant takes a
   distinct prefix — `pinVariantKey({ variant, isContext })` returning `-in-<slug>` or
   `-v-<slug>`.** Reason: `-in-` is context-shaped English and the community case must stay
   byte-identical (AC-7), while a distinct prefix makes the two kinds of second pin
   distinguishable in a `d` tag *for humans and logs* without any reader parsing it — the
   suffix's one job stays replaceability (ADR `feat-tags-modernization/0001:192-193`).
   Alternative worth ruling: one general form `-v-<slug>` for everything new, accepting that
   the same variant name yields different addresses depending on whether it is a community —
   which I think is worse, because promoting a recipe to a community would move the address.
   Either way `pinVariantKey` (`pins.js:39-41`) stays the single composer for all five schemes.

5. **Does the Trust Determination dial become "the default for new pins"?** Recommendation:
   **yes, in copy only — no behaviour change.** It remains the fallback for pins with no
   explicit field (AC-2), so the honest description is "the default this deployment uses for
   pins that do not choose". Its blurb (`TrustDetermination.jsx:89-94`) must also be corrected
   either way: today it says published TLs carry a `membership-method` tag, which is false
   (`refreshPinnedTags.js:372-374`) — if question 3 lands "yes" it becomes true again; if not,
   the sentence must go. Separately, `TL_MEMBERSHIP_METHODS` (`:13-22`) mirrors the server ids
   by hand ("keep in sync", `:14`), and the curation dialog would become a **second** mirror —
   the Architect should say whether a third copy is acceptable in a no-build project.

6. **The minimum switcher UX (AC-11).** Recommendation: **keep one chip row, with recipes
   visually and semantically separated from places** — places keep the 📌 + community name
   (`Tag.jsx:559`); recipes render with a different glyph and a group label (e.g. a "Your
   curations" divider after the contexts), ordered neutral → places → recipes. Creation is
   *not* added to `PinToContextModal` ("Pin to a community",
   `PinToContextModal.jsx:21,64`) — a recipe is created from the curation dialog, where the
   method and constraint it exists to vary already live. That satisfies the design doc's
   warning (a recipe is never rendered *as* a place) at the cost of one divider, and defers
   the real information-architecture round. Alternative worth ruling: no switcher entry at all
   in this story (variants reachable only by URL), shipping the protocol half and leaving the
   whole UX to the design round — smaller, but then AC-6 is not verifiable through the UI.

7. **Uniqueness enforcement point (AC-8).** Recommendation: **client refuses, and it is the
   only enforcement in this story** — the publisher knows the viewer's existing pins of the
   tag (`src/api/profile-tags/index.js:900-905` already returns them) and can refuse before
   signing, which is the only point where a *message* can be shown. Server-side dedupe is not
   a real backstop here: nostr replaceable-event semantics mean a colliding pin doesn't
   duplicate, it **overwrites** — so a collision silently destroys the earlier pin, which is
   precisely why it must be caught pre-signature. What the server *should* do is stay
   idempotent and never invent a variant. Ruling wanted on whether the refresh runner should
   additionally log/skip on a detected collision rather than publishing over an address.

8. **One story or two?** Recommendation: **split, and run Part A first.** Part A is small,
   additive, fully precedented (`noteMethod` and `targetTypes` already did it), touches one
   runner plus the dialog, and on its own unblocks the book's day-one need — the search-index
   pin can be the tag's *neutral* pin with an explicit method and `authorConstraint`. Part B
   is a different kind of change: identity rather than scoring, five `d`-tag schemes, three
   reader paths, a uniqueness guard, a slug vocabulary and a UX round the design doc explicitly
   flags. They also fail the Light profile's "one subsystem, bounded" scope test together, and
   eleven ACs is roughly double this epic's norm. Concretely: keep this file as **story 3 =
   Part A** (rename to `3-per-pin-membership-method.md`) and lift Part B verbatim into
   **story 4 = `4-explicit-pin-variant-key.md`**, each with its own ADR. Counter-argument for
   one story: both are wire-visible, so a single ADR could state the pin's full "identity vs
   scoring" shape once — but ADR `feat-tags-modernization/0001` already states that split, and
   Part B's ADR can simply extend it. Operator's call.

## Scoped gate proposal *(Gate A to confirm)*

`npm test -- test/per-pin-curation.test.js test/pin-stack-composition.test.js test/context-scoped-pins.test.js test/only-me-curation.test.js test/item-trusted-list.test.js test/note-trusted-list.test.js`

- `test/per-pin-curation.test.js` — **new**, this story's suite (if split, one suite per story).
- Guards (must stay green, unchanged): `test/pin-stack-composition.test.js` (the variant/`d`-tag
  spine and the byte-identity guarantee), `test/context-scoped-pins.test.js` (contextual pins
  keep working), `test/only-me-curation.test.js` (story 2's constraint still composes, E5),
  `test/item-trusted-list.test.js` and `test/note-trusted-list.test.js` (the note/item runners'
  own per-pin method is untouched, E3).
- **Deliberately excluded from the judge gate:** `test/tl-membership-method-selector.test.js`
  (`test/registry.js:205`). Its layer-3 assertions publish through a live control panel and
  strfry (`test/tl-membership-method-selector.test.js:16-20`), so it **hangs without a live
  stack** and cannot run inside a judge's tool cap. It is nonetheless the closest guard to
  Part A — the operator should run it against a running stack at Gate B, and note that if
  question 3 lands "yes" its `membership-method`-tag expectations change (as do
  `test/tl-weighted-sum-method.test.js:324`, `:387`, `:426`).

## Linked artifacts

- Design target: `docs/SEARCH_INDEX_DLIST_SELECTION.md` (rev 3), § "Design note: per-pin
  curation implies multiple pins per tag" (`:187-225`)
- Ledger: `OPEN.md:363` (OPEN 307)
- Precedent stories: `engineering-team/stories/search-index-selection/2-only-me-curation.md`;
  `dlist-item-tagging` #5 (`targetTypes`)
- Precedent ADRs: `engineering-team/decisions/search-index-selection/0001-author-constraint.md`
  (additive field on the blob); `engineering-team/decisions/contextual-pins/0001-context-scoped-pins.md`
  (the pin/TL identity model); `engineering-team/decisions/feat-tags-modernization/0001-pin-stack-composition.md`
  (the variant-key mechanism this story generalises)
- ADR: (filled in after Architecture phase — expected, two wire-visible triggers)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)

## Uniqueness invariant (operator, 2026-09-18 — binding on Part B, not an open question)

A pin's own address is `tag-pin-<slug>-<tagAuthor8>-<viewer8>` plus the variant key, and every
Trusted List it produces derives its address from the same inputs. Replaceable-event semantics
mean a second pin at the same address **silently replaces** the first — pin and lists together.
That is the protection today (a viewer cannot hold two colliding neutral pins) and the trap
for variants. Part B must therefore:

1. put the variant into **both** the pin's address and its lists' addresses by construction
   (as `contextSlug` already is — `pinVariantKey`, `computeTLDTag`, `itemTlDTag`);
2. have the **client refuse** a variant slug already in use for that (observer, tag) **before
   anything is signed** — the only enforcement point that prevents the stomp;
3. have the runner **detect** a collision (two live pin events resolving to one list address)
   and log + skip rather than publish over the earlier list.

Stories 1–2 and Part A touch no address (the author constraint and the membership method ride
the `curationMethod` blob).
