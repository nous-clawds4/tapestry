# Story 2: "Only me" curation — an `author` constraint on the pin

**Status:** Approved
**Created:** 2026-09-18
**Type:** Feature *(Light book; **wire-visible** — the constraint rides the published
`curationMethod` JSON and is permanent once signed, so the irreversibility trigger "a wire
format or event shape" fires and an **ADR is expected**. Gate A rules.)*
**Epic:** `engineering-team/epics/search-index-selection.md` (story 2)
**Book:** `engineering-team/audits/search-index-selection/book.md` (acceptance-frame bullet 2)
**Design target:** `docs/SEARCH_INDEX_DLIST_SELECTION.md` (rev 3) — "The guard principle"
and "Build progression" step 1.

## Background

The search backend reads exactly one thing, permanently: a Trusted List whose members are
the DList header coordinates to index (design doc, "The consumer contract (settled)"). The
engine has hardcoded presentation for one list today, so **the pipeline must not hand it a
list it cannot render** — the guard is capability-matched, not timidity. Rung 1 of the
guard ladder therefore needs *certainty* about membership, and **a point of view cannot
supply it**: the POV predicate is `wot_rank_<suffix> >= minRank` over a propagated
GrapeRank score (`src/api/event-tags/index.js:189-200`,
`src/api/profile-tags/index.js:672-678`), rank flows through the follow graph with
attenuation, and the only adjacent knob — `alsoTrust` — *widens* the trusted set rather
than narrowing it (`src/api/event-tags/index.js:672-674`). "Follows one account" is not
"trusts only that account". Certainty comes from a different shape: constrain the
tagging's **author** to the observer, because only the observer can sign as the observer
(design doc, "Rejected alternatives" → *A point of view narrowed to one account, for
certainty*).

The mechanism is the same seam everything else already uses. The trust filter is a plain
function `(pk) => boolean` — `trustPredicateFor` / `buildTrustPredicate`
(`src/api/event-tags/index.js:189`, `:202`) on the event side, `authorAllowed`
(`src/api/profile-tags/index.js:663-678`) on the profile side — and `alsoTrust` is
existing precedent for an *identity* predicate composed into that slot
(`src/api/event-tags/index.js:672-674`). "Only me" is `(pk) => pk === observer` in the
same position. Each of the three pin runners resolves its POV per observer and hands the
result to an aggregation: `runOnePin` at `src/api/trustedList/refreshPinnedTags.js:269`,
`runOneNotePin` at `:506`, `runOneItemPin` at `:615` — all three via
`resolvePov({ wotPov: 'user', userPubkey: observer })`, and all three read the pin's
curation through `profileTags.parseCurationMethod(pinEvent)` (`:239`, `:477`, `:589`;
the parser itself is `src/api/profile-tags/index.js:588-601`).

The carrier already exists and has an established additive convention. The pin's
`curationMethod` blob (`ui/src/utils/publishTagPin.js:98-116`, ridden onto the event as
both the `curation-method` tag and `content.tagPinning.curationMethod`, `:160-172`)
accumulated `targetTypes` in `dlist-item-tagging` #5 under the rule **absent means the
pre-existing default** — the client's new-pin default includes `'item'`
(`ui/src/utils/publishTagPin.js:112`) while every runner's fallback stays
`['profile','note']` (`src/api/trustedList/refreshPinnedTags.js:487`, `:599`) and the
dialog's edit-path fallback likewise stays `['profile','note']` so editing an old pin
cannot silently add a type (`ui/src/components/CurationMethodDialog.jsx:75-81`). That is
the exact model this story copies: **not one already-published pin changes meaning.**

Finally, this is a **read-time filter on whose assertions count**, not write-time gating
(CLAUDE.md invariants 2 and 3): anyone may still publish a tagging of anything; the
constraint only decides whose assertions this pin's list folds in. No TA pubkey literal is
introduced.

## User-facing description

As a curator, I want a pin to count **only my own taggings**, so that the Trusted List it
publishes contains exactly what I tagged — certain, because only I can sign as me — and a
search backend can safely index it.

## Acceptance criteria

- [ ] **AC-1 — the dialog option.** The curation dialog offers a trust scope of "Only me"
      alongside today's web-of-trust scope. Choosing it and saving publishes a pin whose
      curation says the author must equal the observer.
- [ ] **AC-2 — the pin blob carries the value.** The published pin's `curationMethod`
      (both the `curation-method` tag and `content.tagPinning.curationMethod`) carries the
      constraint field with the `observer` value, and the two copies agree.
- [ ] **AC-3 — absent means today.** A pin whose curation omits the field produces a
      **byte-identical** published Trusted List to the one it produces before this story,
      for all three kinds (30392 / 30393 / 30394): same `d`, same members, same order,
      same tags, same content. No existing pin changes meaning.
- [ ] **AC-4 — all three runners honour it.** With the constraint set, `runOnePin`,
      `runOneNotePin` and `runOneItemPin` each fold only assertions authored by the pin's
      observer. A tagging published by **any other pubkey is excluded even when it is
      GrapeRank-trusted** under the observer's POV (the sharpest sentinel: same corpus,
      same observer, constraint present vs absent ⇒ different membership).
- [ ] **AC-5 — the published list discloses it.** Each published Trusted List produced by
      a constrained pin carries a tag disclosing the constraint, so a consumer reading only
      the event can tell the list is self-curated rather than WoT-derived. Absent on an
      unconstrained pin (additive; see open question 3).
- [ ] **AC-6 — the observer's own taggings always count.** A tagging by the observer is
      included regardless of the observer's own rank, POV resolvability, or whether WoT
      filtering is active at all (including the no-POV "everyone counts" path).
- [ ] **AC-7 — the membership methods compose.** All three methods (`count`, `input`,
      `certainty`, `src/api/trustedList/membershipMethods.js:20-23`) fold over the
      already-trust-filtered set and none is special-cased. Under `count`, membership over
      the constrained set equals membership over an unconstrained set containing only the
      observer's assertions. Under the weighted methods (`input` / `certainty`) the
      **observer's own weight is 1.0 when the constraint is set** (operator ruling,
      2026-09-18 — otherwise an observer with no `wot_rank` doc would publish an empty
      list under the very method intended for use), so a constrained pin scores its members
      as fully certain; the unconstrained weight function is byte-identical to today's.
- [ ] **AC-8 — regression sentinels.** Unconstrained pins, contextual pins, target-type
      selection, d-tag composition, cutoff and dispute handling, and the `min-rank` /
      `observer` / `cutoff` tags on the published list are all unchanged.

## Concepts touched

- `39998:<TA>:tag-pinning` — the concept the pin element belongs to (the pin carries `curationMethod`; (ADR-0015 legacy
  literal exception applies to the handle only; no new literal).
- `39998:<TA>:trusted-list` — the published list family (30392 / 30393 / 30394).
- `39998:b83a28b7…:github-accounts` — the day-one target header (story 1 made it taggable).

## Edge cases

- **E1 — the observer disputes their own tagging.** Latest-wins dedupe and the dispute
  fold are unchanged; the constraint filters by author before the fold, so a
  self-dispute removes the member exactly as a trusted third-party dispute would today.
- **E2 — `observer` absent or malformed in the blob.** All three runners already bail with
  `observer pubkey missing or malformed` (`refreshPinnedTags.js:244`, `:482`, `:594`).
  The constraint must not change that ordering — a constrained pin with no valid observer
  is an error, never "trust nobody" and never "trust everyone".
- **E3 — a pre-story pin.** Field absent ⇒ AC-3. Editing such a pin in the dialog must not
  silently add the constraint (the `targetTypes` edit-path precedent,
  `CurationMethodDialog.jsx:75-81`).
- **E4 — constrained pin combined with a context pin.** The context is the pin's identity
  discriminator and the constraint is scoring; they are orthogonal
  (`refreshPinnedTags.js:264`, "context first (identity), then the curation (scoring)").
  A constrained contextual pin keeps its context `d`-tag and context `z` unchanged.
- **E5 — the observer has tagged nothing.** Item runner already skips rather than
  publishing an empty 30394 (`refreshPinnedTags.js:634-636`); the profile and note runners
  keep their existing empty-set behaviour. The constraint must not invent a new one.
- **E6 — no POV resolvable for the observer.** Today that degrades to "all assertions
  count". Under the constraint it must degrade to "only the observer's assertions count" —
  the constraint is the tighter of the two and wins.
- **E7 — closed vocabulary.** The value is `observer` only. Any other value must be
  handled fail-safe and explicitly (see open question 1); `∈ <list>` is reserved for rung 2
  and is not accepted now.
- **E8 — a third party republishes an identical tagging.** Excluded. Membership is
  determined by who signed, not by what was claimed.
- **Not covered:** rung 2 and rung 3 behaviour; per-pin membership method; the naming of
  the `worth-indexing-for-search` tag; what the search backend does with the list.

## Out of scope

- **Rung 2** — the `author ∈ <list>` value and its filter-list picker (design doc,
  "Deferred to rung 2").
- **Per-pin membership method** and the explicit pin variant key — that is story 3
  (OPEN 307). This story does not move the instance-wide dial onto the pin.
- **Self-attestation / self-tagging as a credential** — a different predicate, kept for
  rung 3 (design doc, "The guard principle").
- Publishing the actual `worth-indexing-for-search` tag and the tagging (no code; design
  doc build-progression step 3).
- Any change to who may *publish* a tagging. Write-time gating is out of bounds.

## Open questions for Gate A

1. **The JSON field name and value vocabulary.** Recommendation: a single field
   `authorConstraint` with the string value `'observer'`, absent meaning unconstrained.
   A string (not a boolean) is what lets rung 2 widen the *value* rather than add a second
   mechanism, which is the design doc's explicit shape ("its value type is the only thing
   that changes as the guard loosens"). Unknown values must **fail closed to unconstrained**
   (matching `resolveMembershipMethod`'s fail-safe posture,
   `membershipMethods.js:33-42`) rather than silently mean something new — an old runner
   meeting a rung-2 value must not publish a list it cannot compute. Alternative worth a
   ruling: fail *closed to observer-only* instead, which errs toward a smaller list.

2. **Third radio, or a checkbox?** Recommendation: a **trust-scope control with two
   options — "My web of trust" (today's behaviour) and "Only me"** — presented as the
   zero point of an axis that already exists rather than a bespoke toggle. The dialog's
   `method` picker currently enumerates `nip85:rank` / `follows` / `trust-everyone` /
   `trusted-list` with only the first enabled (`CurationMethodDialog.jsx:26-29`), so the
   Architect should rule whether "Only me" belongs *in* that enum or beside it as a
   separate control. A checkbox reads as a modifier, which under-sells that this is the
   thing that makes the list certain. Cutoff and target-type controls stay where they are.

3. **Should the published TL disclose the constraint?** Recommendation: **yes** — an
   additive extra tag, e.g. `['author-constraint', 'observer']`, next to the existing
   `observer` / `min-rank` / `cutoff` tags (`refreshPinnedTags.js:347-350`, and the
   note/item equivalents at `:548-554` and `:659-665`). Reason: the list is the permanent
   consumer interface and a consumer must be able to tell "this set is self-curated and
   certain" from "this set is a WoT threshold" *without* fetching the pin — which may not
   even be on the consumer's relay. It also makes the list self-describing for audit, and
   it is additive: absent on every pin published to date, so no existing subscriber
   changes behaviour. Exact tag name and whether it belongs in `content` as well is the
   Architect's call.

4. **Does "Only me" also suppress the `min-rank` / `cutoff` tags?** Recommendation:
   **leave them as-is.** They stay honest records of what the pipeline ran, `cutoff` still
   has real meaning under the constraint (a cutoff ≥ 2 becomes unsatisfiable from a single
   author, which is a legitimate configuration to be able to read back), and suppressing
   tags is a *subtractive* wire change where everything else here is additive. Worth
   ruling explicitly, because `min-rank` on a constrained list is arguably misleading — an
   acceptable resolution is to keep the tag and let question 3's disclosure tag be what
   tells a consumer the rank was not the binding filter.

## Scoped gate proposal *(Gate A to confirm)*

`npm test -- test/only-me-curation.test.js test/pin-stack-composition.test.js test/item-trusted-list.test.js test/note-trusted-list.test.js test/generalized-tag-pinning.test.js`

- `test/only-me-curation.test.js` — **new**, this story's suite.
- Guards (must stay green, unchanged): `test/pin-stack-composition.test.js`,
  `test/item-trusted-list.test.js`, `test/note-trusted-list.test.js`,
  `test/generalized-tag-pinning.test.js`.

## Linked artifacts

- Design target: `docs/SEARCH_INDEX_DLIST_SELECTION.md` (rev 3)
- Precedent story: `engineering-team/stories/search-index-selection/1-tag-a-list-header.md`
- Additive-field precedent: `dlist-item-tagging` #5 (`targetTypes`)
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)

## Gate A rulings (operator, 2026-09-18 — "let's move on to Story 2"; the four recommendations adopted as proposed, overridable at the ADR gate)

Light lane with an ADR (wire-visible trigger: the value rides the published `curationMethod`
JSON and the disclosure tag rides the published Trusted List). Scoped gate:
`test/only-me-curation.test.js` (new) + guards `test/pin-stack-composition.test.js`,
`test/item-trusted-list.test.js`, `test/note-trusted-list.test.js`,
`test/generalized-tag-pinning.test.js`.

1. **Field:** `authorConstraint: "observer"`, a string; absent = unconstrained (today's
   behaviour, byte-identical for every existing pin); an unknown value **fails open** to
   unconstrained, matching `resolveMembershipMethod`'s posture. The vocabulary is closed to
   `observer` for now; a list value is reserved for rung 2 and is not implemented here.
2. **Dialog:** a two-option trust scope — "My web of trust" / "Only me" — not a checkbox.
   Where it sits relative to the existing `method` enum is the Architect's call.
3. **Disclosure:** the published TL carries `['author-constraint', 'observer']` beside the
   existing `observer` / `min-rank` / `cutoff` tags. Additive; absent on every TL to date.
4. **`min-rank` / `cutoff` under "Only me":** left as-is. They record what ran; `cutoff`
   still binds; the disclosure tag is what tells a consumer rank was not the binding filter.

Gate B for story 1 is **held** (operator tested header tagging locally: "works well"); the
operator will test story 2 locally too, and the two may ship to `feat/tags` together.
