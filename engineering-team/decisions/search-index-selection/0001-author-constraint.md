# ADR 0001: `authorConstraint` — an author-scope filter on a pin's Trusted List

**Status:** Proposed
**Date:** 2026-09-18
**Story:** `engineering-team/stories/search-index-selection/2-only-me-curation.md`

## Context

A pin's Trusted List is the permanent consumer interface the search backend reads. Rung 1 of
the guard ladder (`docs/SEARCH_INDEX_DLIST_SELECTION.md` § "The guard principle") needs
*certainty* about membership, and a point of view cannot supply it: the POV predicate is
`wot_rank_<suffix> >= minRank` over a propagated GrapeRank score, and the only adjacent knob
(`alsoTrust`, `src/api/event-tags/index.js:672-674`) *widens* the trusted set. Certainty comes
from constraining the **author** of the counted assertions to the observer — only the observer
can sign as the observer.

Gate A ruled the wire shape (story § "Gate A rulings"): a string field `authorConstraint` on the
pin's `curationMethod` blob with the single value `"observer"`; **absent = unconstrained**;
an unknown value **fails open** to unconstrained; the published Trusted List carries
`['author-constraint','observer']`; `min-rank` / `cutoff` are left as-is. This ADR decides
*where the predicate is applied* and *which files change*; it does not re-open those rulings.

### What the code actually looks like at HEAD (`a20a6052`)

- **The trust predicate is built inside the aggregations, not in the runners.** All three runners
  resolve the POV (`runOnePin` `refreshPinnedTags.js:269`, `runOneNotePin` `:506`,
  `runOneItemPin` `:615`) and hand `{ povSuffix, minRank }` down:
  - profiles → `profileTags.aggregateProfilesTagged({ tagEventId, povSuffix, minRank })`
    (`refreshPinnedTags.js:276`; the aggregation is `src/api/profile-tags/index.js:641`, which
    builds `authorAllowed` at `:663-685` and consumes it in the fold at `:687`, returning it at
    `:710` so callers use the same verdict the counts used);
  - notes and items → `require('../event-tags').aggregateNotesTagged(...)`
    (`refreshPinnedTags.js:512`, `:618`; the aggregation is `src/api/event-tags/index.js:311`,
    which builds `isAsserterTrusted` via `trustPredicateFor` at `:333` and hands it to
    `core.groupTaggingsByTarget` at `:334`).
  So the constraint must reach *inside* the two aggregations; the runners have no seam of their
  own to filter at.
- **The membership fold runs after that filter, in the runner.** `membershipFolds`
  (`refreshPinnedTags.js:284-313`) and `curateNotes` (`:521`, `:635`) consume the already
  trust-filtered `byTarget` / `fullMembers`, and `resolveMembershipMethod`
  (`src/api/trustedList/membershipMethods.js:33-42`) is untouched. Filtering before the fold is
  therefore exactly what AC-7 asks for: no method is special-cased.
- **The carrier needs no parser change.** `parseCurationMethod`
  (`src/api/profile-tags/index.js:588-601`) returns the whole JSON blob from the
  `curation-method` tag (falling back to `content.tagPinning.curationMethod`), so a new field is
  available with zero code change and "absent ⇒ `undefined`" is automatic. `pinTag`
  (`ui/src/utils/publishTagPin.js:138-172`) stringifies the caller's blob into **both** copies
  from one variable (`:169`, `:171`), so AC-2's "the two copies agree" is structural.
- **`extraTags` is a pass-through.** `buildAndPublishTL` appends every entry verbatim after
  `d`/`title`/`metric` and before the members (`src/api/trustedList/index.js:116-133`), so a
  conditional extra tag is a one-line spread at each of the three sites (`:347-360`, `:548-564`,
  `:659-672`).
- **The SDK boundary.** `src/lib/event-tagging/` is a dependency-free CJS tree shipped to the UI
  through the `@tapestry/event-tagging` alias (`ui/vite.config.js:12-32`); all three server
  consumers already require it (`refreshPinnedTags.js:30`, `profile-tags/index.js:27`,
  `event-tags/index.js:24`).

### Concepts touched

- `39998:<TA>:tag-pinning` — the pin element. Its JSON schema
  (`39999:<TA>:tag-pinning-schema`, firmware source
  `firmware/versions/v1.0.0/concepts/tag-pinning/json-schema.json:36-42`) declares
  `curationMethod` as a free-form `object` with a prose list of v1 fields. A new field is
  **structurally** valid today; only the prose enumerates the vocabulary.
- `39998:<TA>:trusted-list` — the published 30392/30393/30394 family. No schema field changes;
  the disclosure is an event tag.

No new concept, no new handle, no TA-pubkey literal (`TA_PUBKEY` in `refreshPinnedTags.js`
comes from `getOwnerAssistantPubkey()`; the UI reads `useConfig().taPubkey`).

## Options considered

### Option A — one shared, pure predicate composer in the SDK, threaded into both aggregations
`src/lib/event-tagging/pins.js` gains `AUTHOR_CONSTRAINTS` + `authorPredicateFor({ authorConstraint,
observer, isAsserterTrusted })`. `aggregateProfilesTagged` and `aggregateNotesTagged` each accept
optional `{ authorConstraint, observer }` and route their existing predicate through it at the one
place they build it. The three runners pass `curation.authorConstraint` and `observer` down.

- **Pros.** One definition of the vocabulary for all three kinds; the predicate lands at exactly
  the point the fold already reads it, so `count`/`input`/`certainty` and the dispute fold compose
  untouched; absent field ⇒ the composer returns the *same function object semantics* as today ⇒
  byte-identity for every existing pin is structural, not a test-only promise; the helper is pure
  string/identity composition, so it stays inside the dependency-free SDK contract and a
  third-party client can reproduce the same reading of a published pin.
- **Cons.** Two aggregation signatures grow a parameter (both are internal; the HTTP read paths
  that also call them simply don't pass it). The vocabulary lives in a client-shipped module, so
  a value added at rung 2 must be added there.

### Option B — filter in the runners, after the aggregation returns
The runners re-derive membership from the aggregation's raw output, dropping assertions not
authored by the observer.

- **Pros.** Aggregations untouched; the constraint is visible in the file a reader of the story
  opens first.
- **Cons.** Fatal for two of the three kinds: `aggregateNotesTagged` returns curated member rows
  (`fullMembers`, `fullItemMembers`), **not** the raw taggings — the per-author information is
  already folded away, so the runner cannot re-filter without re-scanning. For profiles it would
  mean re-implementing the `byTarget` fold (including `weightedInput`/`weightedSum`) in the
  runner: a second source of truth for the one question the counts turn on, which
  `aggregateProfilesTagged`'s own docstring (`:630-637`) exists to prevent. Rejected.

### Option C — pass a pre-composed predicate override into the aggregations
Runners build the `(pk) => pk === observer` predicate themselves and inject it as
`isAsserterTrustedOverride`.

- **Pros.** Aggregations stay ignorant of the vocabulary.
- **Cons.** Vocabulary resolution duplicates into three runners instead of one helper; an
  arbitrary injected predicate is a hole in the POV invariant (any caller can now define "trusted"
  however it likes); and in `aggregateProfilesTagged` the predicate has a twin — `authorWeight`
  (`:679-682`) built from the same Meili docs — so an override desynchronises the verdict from the
  weight. Rejected.

### Sub-options settled by Gate A, recorded for the record
- **(a) Boolean `onlyMe` vs string `authorConstraint: "observer"`.** String. A boolean cannot carry
  rung 2's `author ∈ <list>` without adding a second mechanism; the design doc's shape is "the
  value type is the only thing that changes as the guard loosens". Cost: every reader must compare
  against a vocabulary rather than test truthiness — hence the shared `AUTHOR_CONSTRAINTS`.
- **(c) Unknown value fails open (unconstrained) vs closed (observer-only).** Fails open, matching
  `resolveMembershipMethod`'s posture (`membershipMethods.js:33-42`): an old runner meeting a
  rung-2 value publishes *today's* list rather than silently publishing a narrower list under a
  guarantee it did not compute. The list is then honestly undisclosed (no `author-constraint` tag)
  rather than falsely disclosed. Trade: a rung-2 pin refreshed by an old runner produces a WoT
  list, so rung 2 must ship its own disclosure/migration story.

## Decision

We chose **Option A**.

1. **Where the predicate is applied.** `src/lib/event-tagging/pins.js` gains, beside the existing
   pure pin composers:
   - `AUTHOR_CONSTRAINTS = ['observer']` and `isKnownAuthorConstraint(v)`;
   - `authorPredicateFor({ authorConstraint, observer, isAsserterTrusted })` returning
     `(pk) => pk === observer` when `authorConstraint === 'observer'` and `observer` is 64-char
     hex; `() => false` when the constraint is `'observer'` but `observer` is not hex (unreachable
     — the runners bail first, E2 — but "deny" is the safe corner, never "everyone"); and
     `isAsserterTrusted` (or `() => true` when none was given) for **absent or unknown** values.
   It lives in the SDK rather than beside `trustPredicateFor` (`src/api/event-tags/index.js:189`)
   because two *different* API modules need it and because a client reading a published pin needs
   the same reading; it stays pure (no I/O, no logging), which is the SDK's contract.
   The two aggregations accept `{ authorConstraint, observer }` and compose at their single
   predicate site — `src/api/profile-tags/index.js:663-685` (compose into `authorAllowed`, so the
   returned verdict at `:710` remains the one the counts used; and — **per the operator's ruling,
   2026-09-18** — `authorWeight` composes the same way: when the constraint is `'observer'`, the
   observer's own weight is **1.0** (`(pk) => pk === observer ? 1 : authorWeight(pk)`), so the
   weighted methods (`input` / `certainty`) score a self-curated list as fully certain rather
   than dropping every member for want of a `wot_rank_<suffix>` doc; unconstrained pins keep
   today's weight function untouched) and
   `src/api/event-tags/index.js:333` (compose `trustPredicateFor`'s result before
   `groupTaggingsByTarget`). The one-time "unknown constraint ignored" `console.warn` lives at
   these two call sites, not in the SDK. Both are **before** the fold, so `count` / `input` /
   `certainty` (`refreshPinnedTags.js:284-313`, `membershipMethods.js:20-23`) and `curateNotes`
   see a set that differs only in membership — AC-7 with no method touched.
2. **The pin blob.** No change to `parseCurationMethod` (`profile-tags/index.js:588-601`) — it
   already returns the whole blob, so absent ⇒ `undefined` ⇒ unconstrained, and the field arrives
   in the `/api/profile-tags/pins` rows for free (`:1600-1606`). No change to
   `defaultCurationMethod` (`publishTagPin.js:96-115`): **a new pin is unconstrained by default**,
   because "only me" is a deliberate narrowing of whose word counts — the opposite of the
   permissionless default the rest of the stack assumes — and the dialog is where a curator opts
   in with the consequence in front of them. (This is the one place we diverge from the
   `targetTypes` precedent, which *did* opt new pins in: adding a target type widens what gets
   published; narrowing whose assertions count is not a safe default.) `pinTag` already passes the
   blob through untouched into both copies (`:169`, `:171`) — no change beyond a doc comment.
3. **The dialog.** `ui/src/components/CurationMethodDialog.jsx` gains a **separate two-option
   control**, not a value in the `method` enum. Reason: `method` is gated everywhere as
   `method !== 'nip85:rank' ⇒ unsupported` (`refreshPinnedTags.js:240`, `:478`, `:590`;
   `enrichRowsWithTLStatus`, `profile-tags/index.js:1660`) and the dialog itself validates it
   (`CurationMethodDialog.jsx:115`), so an `only-me` method value would make every existing runner
   mark the pin unsupported; and `authorConstraint` is orthogonal to *how* trust is computed — it
   is *whose assertions are eligible*. Shape: a radio group labelled **"Trust scope"** placed
   directly under the Method select (`:250-270`), options "My web of trust" (value `''`) and
   "Only me" (value `'observer'`). State follows the `initTypes` discipline
   (`:75-81`): seeded from `init.authorConstraint`, rendering as "My web of trust" for anything
   that is not `'observer'`, and — so an edit can never silently *downgrade* a value this build
   does not know — the raw initial value is kept in state and re-emitted verbatim when the user
   does not touch the control. On submit the field is included **only** when the selection is
   `'observer'` (conditional spread, never `authorConstraint: undefined`), so editing a pre-story
   pin reproduces today's blob exactly (E3).
4. **Disclosure.** Each runner's `extraTags` gains a conditional spread
   `...(authorConstraint ? [['author-constraint', authorConstraint]] : [])`, placed immediately
   after `['min-rank', …]` on the 30392 (`refreshPinnedTags.js:350`) and after `['p', observer]`
   on the 30393 (`:554`) and 30394 (`:665`) — the value is the *resolved* constraint, so an
   unknown (fail-open) value emits **no** tag, matching the list that was actually computed.
   Absent ⇒ the tag array is byte-identical, which is what keeps the AC-4 literal fixtures in
   `test/pin-stack-composition.test.js:292-353` green. `buildAndPublishTL` needs no change
   (`trustedList/index.js:116-133`).
   **`retractStaleTLs` `carryOver` (`refreshPinnedTags.js:445-447`) does NOT gain
   `author-constraint`.** That list is identity + provenance + discovery (`title`, `metric`,
   `observer`, `source-tag`, and `z` — added by `dlist-item-tagging/0003` §1 precisely because a
   `#z` consumer must keep seeing the list on its discovery axis). The *scoring* tags `cutoff` and
   `min-rank` are already dropped on retraction, and `author-constraint` is their sibling: a
   retracted list has an empty membership, so there is no curated set left to characterise.
   Reversible and additive if a consumer ever needs it.
5. **Status / read surfaces.** Nothing reads the field today, and nothing server-side needs to:
   the pins API already ships the whole `curationMethod` blob (`profile-tags/index.js:1600-1606`)
   and `enrichRowsWithTLStatus` (`:1646`) only keys on `method` + `observer` + context — untouched.
   The minimum read surface is on the **published list**, not the pin, so the disclosure is what is
   displayed: `ui/src/hooks/useTLDetail.js:63-100` parses one more tag
   (`authorConstraint = findTag('author-constraint')?.[1] || null`) into the `tl` object, and
   `ui/src/components/PinnedListPanel.jsx:465-477` renders one more `<dl>` row when set —
   **"Curation scope: Only me (only the observer's taggings counted)"** — beside the existing
   Observer / Cutoff / Min rank rows. Because rank was not the binding filter, the existing
   `{tl.minRank > 0 && …}` row keeps its wording but sits under the scope row that explains it.
6. **Contextual pins.** Unchanged and orthogonal. The context is the pin's *identity*
   discriminator — recovered from the pin's `z` stamp by `contextSlugOfPin`
   (`src/lib/event-tagging/pins.js`, called at `refreshPinnedTags.js:262`, `:503`, `:613`) and fed
   only to the d-tag composers (`tlDTag` / `noteTlDTag` / `itemTlDTag`, via
   `pinVariantKey({ contextSlug })`) and the context `z`. The constraint is *scoring*: it never
   reaches the d-tag and the d-tag never reaches the predicate. **The observer is the pin's
   observer regardless of context**, so a constrained contextual pin keeps its `-in-<ctx>` d-tag
   and its context `z` byte-identical and merely narrows membership (E4).
7. **Client SDK parity.** The helper and the vocabulary constant live in
   `src/lib/event-tagging/pins.js` and are re-exported by `src/lib/event-tagging/index.js`'s
   `...pins` spread — no new import, no dependency, no `console`, no `require` outside the folder
   (the tree's stated contract, `index.js:1-15`; alias wiring `ui/vite.config.js:12-32`). Rung 2
   extends `AUTHOR_CONSTRAINTS` and `authorPredicateFor` in that one file.

### Invariant check
Read-time only: no publish path is gated, anyone may still tag anything; the constraint decides
only whose assertions **this pin's list** folds in (CLAUDE.md invariants 2 and 3). No TA literal is
introduced. The POV cascade (`resolvePov({ wotPov: 'user', userPubkey: observer })`) is unchanged —
the constraint is applied after it, and under E6 (no POV resolvable) it *replaces* the degenerate
"everyone counts" predicate with "only the observer", the tighter of the two, which is also what
gives AC-6 (the observer's own taggings count regardless of their own rank).

## Consequences

- **Enables** rung 1 of the search-index guard: a list whose membership a consumer can be certain
  about, and which says so on the wire without fetching the pin.
- **Rung 2 is a value change, not a mechanism change**: `AUTHOR_CONSTRAINTS`, one branch in
  `authorPredicateFor`, and the dialog's option list. Nothing else moves.
- **Weighted methods under "Only me" — DECIDED (operator, 2026-09-18: self-weight 1.0).** Under
  the instance-wide `input` / `certainty` methods, per-assertion weight comes from
  `authorWeight` (`profile-tags/index.js:679-682`), which is non-null only when the WoT filter is
  active **and** the author has a `wot_rank_<suffix>` doc. A constrained pin's only author is the
  observer; if the observer has no rank doc, `weightedInput` stays 0 and `certainty`'s
  `score >= 1` predicate (`refreshPinnedTags.js:303-312`) drops every member — a degenerate empty
  list — under the exact method the operator intends to run. **Ruling:** under the constraint the
  observer's own weight is 1.0 ("I am certain about my own taggings"). This is not method
  special-casing (AC-7 still holds — `count` / `input` / `certainty` are untouched); it is the
  weight the author predicate already implies, composed at the same site as the predicate
  (`profile-tags/index.js:679-682`). Only the profile aggregation weights by rank; the note and
  item aggregations fold raw counts through `curateNotes` and need no change. The Tester pins:
  constrained + `certainty` ⇒ members carry a non-zero score; unconstrained ⇒ weight function
  byte-identical.
- **Fail-open means a future value degrades silently** on an un-upgraded runner (see sub-option c).
  Acceptable because the disclosure tag is emitted only for the constraint actually applied, so a
  list never over-claims.
- **Firmware reinstall required? YES** — `firmware/versions/v1.0.0/concepts/tag-pinning/json-schema.json:41`
  is the only human-readable definition of the `curationMethod` vocabulary; its prose field list
  gains `authorConstraint ('observer'; absent = unconstrained)`. It is a description-only edit to
  a free-form object (no structural validation changes, no graph reshape), but the graph copy
  drifts until `POST /api/firmware/install` is run. (Aside: that same prose still omits
  `targetTypes` / `noteMethod` from `dlist-item-tagging` #5 — worth an `OPEN.md` row; correcting it
  in the same edit is at the Implementer's discretion and changes no behaviour.)

## Implementation notes

Blast radius — every file that changes:

- `src/lib/event-tagging/pins.js` — add `AUTHOR_CONSTRAINTS`, `isKnownAuthorConstraint`,
  `authorPredicateFor({ authorConstraint, observer, isAsserterTrusted })`; export all three
  (picked up by `index.js`'s `...pins`). Pure; no logging; no new require.
- `src/api/profile-tags/index.js` — `aggregateProfilesTagged` (`:641`) accepts
  `{ …, authorConstraint, observer }`; route `authorAllowed` (`:663-685`) through
  `authorPredicateFor` before the fold at `:687`; warn once on an unknown value. Docstring at
  `:620-640` updated. `parseCurationMethod` unchanged.
- `src/api/event-tags/index.js` — `aggregateNotesTagged` (`:311`) accepts the same two params;
  compose at `:333` before `core.groupTaggingsByTarget` (`:334`); same warn.
- `src/api/trustedList/refreshPinnedTags.js` — in `runOnePin` (`:232`), `runOneNotePin` (`:471`),
  `runOneItemPin` (`:583`): read `const authorConstraint = curation.authorConstraint` after the
  existing observer bail (order unchanged, E2), pass `{ authorConstraint, observer }` into the
  aggregation call (`:276`, `:512`, `:618`), and add the conditional disclosure tag to
  `extraTags` (`:350`, `:554`, `:665`). `retractStaleTLs` `carryOver` (`:445`) unchanged.
- `ui/src/components/CurationMethodDialog.jsx` — "Trust scope" radio group under the Method field
  (`:250-270`); state seeded per `:75-81` discipline; conditional inclusion in the `custom` blob
  (`:127-136`).
- `ui/src/hooks/useTLDetail.js` — parse `author-constraint` into `tl.authorConstraint` (`:63-100`).
- `ui/src/components/PinnedListPanel.jsx` — one `<dl>` row in the pin detail meta (`:465-477`).
- `ui/src/utils/publishTagPin.js` — comment only in `defaultCurationMethod` (`:96-115`) recording
  that new pins are deliberately unconstrained.
- `firmware/versions/v1.0.0/concepts/tag-pinning/json-schema.json` — `curationMethod` description
  (`:41`) gains the field; then `POST /api/firmware/install`.

Not implementation: the scoped gate (`test/only-me-curation.test.js` new; guards
`test/pin-stack-composition.test.js`, `test/item-trusted-list.test.js`,
`test/note-trusted-list.test.js`, `test/generalized-tag-pinning.test.js`) belongs to Phase 3. The
sharpest sentinel the Tester should reach for is AC-4: same corpus, same observer, a
GrapeRank-trusted third-party tagging present — included without the constraint, excluded with it.

## Out of scope

- Rung 2 (`author ∈ <list>`) and its picker; rung 3 self-attestation.
- Any change to `min-rank` / `cutoff` emission or meaning (Gate A ruling 4: left as-is).
- Per-pin membership method (story 3 / OPEN 307). The self-weight under "Only me" is decided
  here (above), not deferred.
- NIP-51 export surfaces (`enrichRowsWithNip51ExportStatus`) — they carry no curation disclosure
  today and gain none here.
- Publishing the `worth-indexing-for-search` tag, and anything the search backend does with the
  list.
