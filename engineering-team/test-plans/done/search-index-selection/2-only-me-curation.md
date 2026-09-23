# Test Plan: search-index-selection #2 — "Only me" curation

**Story:** `engineering-team/stories/search-index-selection/2-only-me-curation.md` (Approved; Light lane, Gate A 2026-09-18, AC-7 amended 2026-09-18)
**ADR:** `engineering-team/decisions/search-index-selection/0001-author-constraint.md` (**Accepted**, J1 round 2)
**Design target:** `docs/SEARCH_INDEX_DLIST_SELECTION.md` (rev 3) — "The guard principle", build progression step 1
**Date:** 2026-09-18
**Suite:** `test/only-me-curation.test.js` (new; registered in `test/registry.js` beside `tag-a-list-header.test.js`)

## Scoped gate (Gate A)

```
test/only-me-curation.test.js   (new — this story's suite)
test/pin-stack-composition.test.js
test/item-trusted-list.test.js
test/note-trusted-list.test.js
test/generalized-tag-pinning.test.js
```

**Guard-suite carve-out (templates/adr.md).** Phase 4 must not edit any of the four guard
suites. In particular `test/pin-stack-composition.test.js` **AC-4** (`:292-353`) holds the
*literal whole-event* fixtures for a neutral pin's 30392 (count + certainty) and 30393. Those
fixtures — not this suite — are AC-3's byte-identity guard; this plan deliberately does **not**
duplicate them (handle **R5** cites them). A red AC-4 in pin-stack means the disclosure tag or
the aggregation parameters leaked into the unconstrained path.

## Test classes

| Class | What it drives | Level |
|---|---|---|
| **U** | the pure SDK vocabulary + predicate composer, `src/lib/event-tagging/pins.js` (+ the `index.js` re-export) | unit, relay-free |
| **H** | `runOnePin` / `runOneNotePin` / `runOneItemPin` through **injected deps** — what the aggregation receives, the published `extraTags`, fail-open, context orthogonality, the E2 bail | behavioral, stack-free |
| **A** | the aggregation rule: a pure composer seam (see below) + two call-site source sentinels | unit + structure |
| **S** | source sentinels: dialog, client default, TL read surfaces, firmware schema, no-TA-literal | structure |
| **R** | regression sentinels on the deliberately untouched surfaces (green **before and after**) | unit + structure |

## Coverage map

| Criterion | Handle | What it pins | Level |
|---|---|---|---|
| **AC-1** the dialog option | S1, S2, U1 | a two-option "Trust scope" radio labelled "My web of trust" / "Only me"; it writes the constraint; the vocabulary it writes is the closed SDK one | structure + unit |
| **AC-2** the pin blob carries the value | S2, H1, H4, H6 | the dialog emits `authorConstraint` into the `custom` blob (which `pinTag` stringifies into **both** copies from one variable, `publishTagPin.js:169,171` — the two copies agreeing is structural, see "Not covered"); the runners read it back off the parsed pin and hand it on | structure + behavioral |
| **AC-3** absent means today | H3, H5, H7, U4, A3, S4 | the unconstrained 30392/30393/30394 tag arrays byte-identical; the composer's verdicts and weights identical; new pins unconstrained by default. Whole-event byte identity: guard `pin-stack-composition` AC-4 (cited, R5) | behavioral + unit |
| **AC-4** all three runners honour it | U2, H1, H4, H6, A1, A4, A5 | the sharpest sentinel — a GrapeRank-**trusted** stranger excluded under the constraint, included without it; the pair reaches all three aggregation calls; both aggregations compose before their fold | unit + behavioral + structure |
| **AC-5** the published list discloses it | H2, H4, H6, S5, S6 | `['author-constraint','observer']` exactly once, **after `['min-rank',…]`** on the 30392 and **after `['p', observer]`** on the 30393/30394; parsed by `useTLDetail`; rendered as a "Curation scope" row | behavioral + structure |
| **AC-6** the observer's own taggings always count | U3, A1 | the constraint **replaces** the POV predicate (deny-all POV, or no POV at all ⇒ the observer still counts) | unit |
| **AC-7** the membership methods compose (as amended) | A2, A3, R3, R4 | under `count`, filtering happens before the fold and no method is special-cased; under `input`/`certainty` the constrained observer weighs **1.0** with no rank doc, while the unconstrained weight is still `rank/100` (0.42 for rank 42) | unit + structure |
| **AC-8** regression sentinels | R1, R2, R3, R4, R5, H3, H5, H7, H9 | `carryOver` gains nothing; `min-rank`/`cutoff` emission unchanged; the method registry and the three folds untouched; contextual d-tag/`z` unchanged; the guard suites stay the byte-identity owners | unit + structure |

## Edge cases

| Edge case | Handle | How it is covered |
|---|---|---|
| **E1** the observer disputes their own tagging | R4 (proxy) | The fold is unchanged and reads the already-filtered `byTarget` with the pin's cutoff, so a self-dispute nets out exactly as a third-party dispute does today. **Not covered directly:** the relay round-trip of a self-dispute (needs a live corpus; Gate B). |
| **E2** `observer` absent or malformed | H10, U6 | The runner still returns `{status:'error', errorReason:'observer pubkey missing or malformed'}`, publishes nothing and aggregates nothing — order unchanged. U6 pins the unreachable corner: the composer denies **everyone** rather than admitting everyone. |
| **E3** a pre-story pin | S2, S4, H3/H5/H7 | The dialog never emits `authorConstraint: undefined`, seeds from `init.authorConstraint`, and new pins are unconstrained by default; the unconstrained runner output is byte-identical. |
| **E4** constrained pin × contextual pin | H9 | Same d-tag (`…-in-lfo`) and byte-identical `z` tags with and without the constraint; the *only* tag difference is the disclosure. |
| **E5** the observer has tagged nothing | — | **Not covered by a new handle.** No runner behaviour changes: the item runner's existing empty-set skip (`refreshPinnedTags.js:634-636`) and the profile/note empty-set behaviour are owned by `item-trusted-list` / `note-trusted-list` (guards). The constraint only narrows the input set. |
| **E6** no POV resolvable for the observer | U3 | With no POV predicate given (today's "everyone counts"), the constrained composer degrades to "only the observer" — the tighter of the two wins. |
| **E7** closed vocabulary / unknown value | U1, U5, H8, A3 | `AUTHOR_CONSTRAINTS === ['observer']`, case-exact; an unknown value fails **open** to today's verdicts *and* today's weights; the runner emits **no** disclosure tag for it (the tag is the *resolved* constraint) and must resolve through `isKnownAuthorConstraint`. |
| **E8** a third party republishes an identical tagging | U2, A1 | Membership is decided by who signed: the stranger's identical assertion is excluded even while the POV trusts them. |

### Not derivable from any acceptance criterion (J2 rubric 1)

- **U6** — constraint `'observer'` with a *non-hex* observer (`''`, `'nothex'`, 63 chars, upper-case
  hex) must admit **nobody**. Unreachable through the runners (E2 bails first), which is exactly
  why it needs a handle: the natural implementation `(pk) => pk === observer` silently becomes
  "admit everyone whose pubkey is `undefined`" if the guard is dropped.
- **U7** — the SDK purity contract: `pins.js` may `require` only siblings and must contain no
  `console.*` (the ADR puts the "unknown constraint ignored" warn at the two *call sites*). A
  `console.warn` in the SDK breaks the dependency-free client tree, and no AC mentions it.
- **S8** — no 64-hex literal may appear in any touched file, and `src/api/event-tags/index.js`
  may keep **exactly one** (the ADR-0015 `CANONICAL_AUTHORITY`) and gain no other.
- **R1** — `retractStaleTLs`'s `carryOver` must *not* learn `author-constraint`. Nothing in the
  ACs says so; the ADR §4 does, and the tempting "carry every tag forward" edit is invisible
  until a consumer reads a retracted list as still self-curated.
- **A3 (second half)** — an *unknown* constraint must not get the 1.0 weight carve-out either.
  The fail-open rule is usually stated only about the predicate.

### Error paths for the external dependencies the design touches

| Dependency | Covered? |
|---|---|
| **Meili** (`meiliFetchProfilesByPubkey`, behind `authorAllowed`/`authorWeight`) | Covered as *behaviour* via A1–A3: the seam is driven with `authorWeight` returning `null` (the "no `wot_rank` doc" case, which is what a Meili miss looks like) and with a POV predicate denying everyone. **Not covered:** a Meili *throw* — unchanged from today, the aggregation has no new failure mode and no injectable client. |
| **strfry** (`federatedScan` / `strfryScan` inside both aggregations) | **Not covered, deliberately.** The constraint is applied after the scan; scan truncation and failure behaviour is untouched and owned by `note-trusted-list` / `item-trusted-list` (guards). |
| **publishTL / relay refusal** | **Not covered by a new handle** — unchanged; `item-trusted-list` already drives the `publishThrows` path. |
| **Settings store** (`resolveMembershipMethod`) | R3: still fail-safe to `'count'` when settings are unreadable (this host has none). |
| **The concept graph / firmware install** | S7 pins the schema text only. The `POST /api/firmware/install` step is an operator action verified at Gate B, not by this suite. |

## The seam specified for the Implementer

`aggregateProfilesTagged` builds `authorAllowed` **and** `authorWeight` from Meili docs it
fetches itself (`src/api/profile-tags/index.js:663-685`); `aggregateNotesTagged` builds
`isAsserterTrusted` from `trustPredicateFor` (`src/api/event-tags/index.js:333`). **Neither has
an injectable relay/Meili seam**, so the AC-7 weight carve-out is not reachable by driving the
aggregation. It is pinned instead through a pure export the Implementer must add:

```js
/** Compose the pin's author constraint into this POV's verdict AND weight, at the one site
 *  they are built. Absent/unknown constraint ⇒ both returned unchanged (fail open).
 *  Constraint 'observer' ⇒ authorAllowed = (pk) => pk === observer  (ADR §1)
 *                          authorWeight  = (pk) => pk === observer ? 1 : authorWeight(pk)
 *  (AC-7 carve-out, operator ruling 2026-09-18). */
composeAuthorPredicates({ authorConstraint, observer, authorAllowed, authorWeight })
  // => { authorAllowed, authorWeight }
```

exported from `src/api/profile-tags/index.js`. **Accepted alternative** (the suite resolves
either): export `authorWeightFor({ authorConstraint, observer, authorWeight })` beside
`authorPredicateFor` in `src/lib/event-tagging/pins.js` — the suite then composes the pair
itself. Either way the rule must live in **one** pure place; A4/A5 additionally assert that the
two aggregations call the shared helper (not a second inline vocabulary) and compose **before**
their fold.

The three runners already honour injected deps (`options.deps || options`), so the H class needs
no new testability contract.

## Test infrastructure

- Framework: Node built-in runner, house `module.exports = { run }` shape returning
  `{pass, fail, skipped, failures}`. Harness modelled on `test/pin-stack-composition.test.js`
  (injected deps + `process.env.TA_PUBKEY` provisioned at load) and `test/item-trusted-list.test.js`.
- **No live stack, no relay, no graph state, no Playwright.** No
  `POST /api/firmware/install` prerequisite. `BRAINSTORM_BASE_URL=http://localhost:8778` is set
  in the run command for house consistency; this suite never calls it. **No suite was skipped
  for want of the stack** (skipped = 0).
- `TA_PUBKEY` is provisioned to a fixture stand-in (`f…f1`) *before* any server module loads, and
  every `z` expectation is derived from `profileTags.TA_PUBKEY` at runtime — never a literal.
- Fixtures: `makePin({ authorConstraint, contextSlug, cutoff, targetTypes })` builds a kind-39999
  pin whose `curation-method` tag omits `authorConstraint` entirely when unset (a pre-story pin).
  Two asserters throughout: `OBS` (the observer, "me") and `STRANGER` (a GrapeRank-trusted third
  party with rank 42 ⇒ unconstrained weight 0.42).
- Module loads go through `safeRequire` / `rd`, so a missing export or file reports as a named
  assertion, never a crashed run.

## How to run

```
{ timeout 120 env BRAINSTORM_BASE_URL=http://localhost:8778 direnv exec . node -e "require('./test/only-me-curation.test.js').run().then(r=>{console.log(r);process.exit(r.fail?1:0)})"; echo "EXIT=$?"; } 2>&1
```

Scoped gate (Gate A): `npm test -- test/only-me-curation.test.js test/pin-stack-composition.test.js test/item-trusted-list.test.js test/note-trusted-list.test.js test/generalized-tag-pinning.test.js`.
Full gate (`npm test`) at book close / promotion.

## Verification — pre-implementation

Run 2026-09-18 at commit `6ebfdf34` (branch `feat/search-index-selection`), before any
implementation: **12 passed, 23 failed, 0 skipped** (exit 1).

Failing (the feature does not exist yet): **U1–U7, H1, H2, H4, H6, H8, A1–A5, S1, S2, S3, S5,
S6, S7**.
Passing by design — invariant confirmations that must stay green **after** the work too:
**H3, H5, H7** (AC-3: today's unconstrained tag arrays), **H9** (contextual d-tag/`z`
orthogonality — true today, must survive), **H10** (E2 bail ordering), **S4** (new pins
unconstrained), **S8** (no TA literal), **R1–R5**.

```
  ✗ U1 (AC-1, E7): the SDK publishes a CLOSED author-constraint vocabulary of exactly ["observer"]
      src/lib/event-tagging/pins.js must export AUTHOR_CONSTRAINTS (ADR §1). Load error: none.
  ✗ U2 (AC-4): with the constraint set, only the observer counts — a GrapeRank-trusted stranger does not
      pins.js must export authorPredicateFor({ authorConstraint, observer, isAsserterTrusted }) (ADR §1). Load error: none.
  ✗ U3 (AC-6, E6): the observer counts under the constraint even when the POV predicate trusts nobody (or is absent)
      pins.js must export authorPredicateFor.
  ✗ U4 (AC-3): an ABSENT constraint returns today's predicate untouched (and "everyone" when none was given)
      pins.js must export authorPredicateFor.
  ✗ U5 (E7): an UNKNOWN constraint value fails OPEN to the POV predicate — never deny-all, never a silent new meaning
      pins.js must export authorPredicateFor.
  ✗ U6 (E2): the constraint with a missing or malformed observer admits NOBODY (deny is the safe corner)
      pins.js must export authorPredicateFor.
  ✗ U7 (ADR §7): the vocabulary and the composer reach a client through the SDK index, with no new dependency
      ADR §7: AUTHOR_CONSTRAINTS must be re-exported by the SDK index (the ...pins spread) so a third-party client reads a published pin the same way the server does.
  ✗ H1 (AC-4, profiles): runOnePin threads { authorConstraint, observer } into the profile aggregation
      ADR §1: the runner must pass authorConstraint through to aggregateProfilesTagged (the predicate is built INSIDE the aggregation); got {"tagEventId":"cccc…","povSuffix":"deadbeef","minRank":0.25}.
  ✗ H2 (AC-5, profiles): the published 30392 discloses the constraint exactly once, right after ["min-rank", …]
      AC-5: exactly one ['author-constraint','observer'] tag; got 0 (extraTags: [["observer","aaaa…"],["source-tag","cccc…","bbbb…","funny"],["cutoff","1"],["min-rank","0.25"],["z","39998:…:trusted-list"],["z","39999:…:tl:funny-tls"]]).
  ✓ H3 (AC-3, profiles): an UNCONSTRAINED pin publishes the same 30392 metadata tags as today, with no disclosure
  ✗ H4 (AC-4 + AC-5, notes): runOneNotePin threads the pair and discloses after ["p", observer]
      ADR §1: runOneNotePin must pass { authorConstraint, observer } into aggregateNotesTagged; got {"tagAuthor":"bbbb…","slug":"funny","authorities":["ffff…"],"povSuffix":null,"minRank":null,"sort":"recent"}.
  ✓ H5 (AC-3, notes): an unconstrained note pin publishes the same 30393 tags as today
  ✗ H6 (AC-4 + AC-5, items): runOneItemPin threads the pair and discloses after ["p", observer]
      ADR §1: runOneItemPin must pass { authorConstraint, observer } into aggregateNotesTagged; got {"tagAuthor":"bbbb…","slug":"funny","authorities":["ffff…"],"povSuffix":"deadbeef","minRank":0.25,"sort":"recent"}.
  ✓ H7 (AC-3, items): an unconstrained item pin publishes the same 30394 tags as today
  ✗ H8 (E7): an unknown constraint value publishes NO disclosure tag — a list never over-claims
      ADR §4: the disclosure must be gated on the shared isKnownAuthorConstraint (the RESOLVED constraint), not on truthiness — otherwise a rung-2 value would be disclosed on a list computed without it.
  ✓ H9 (E4): a constrained CONTEXTUAL pin keeps its d-tag and context z byte-identical; only membership narrows
  ✓ H10 (E2): a constrained pin with a malformed observer still errors on the observer, before anything else
  ✗ A1 (AC-4, AC-6): the composed author verdict admits the observer and excludes a rank-42 trusted stranger
      TESTABILITY CONTRACT … export composeAuthorPredicates({ authorConstraint, observer, authorAllowed, authorWeight }) => { authorAllowed, authorWeight } from src/api/profile-tags/index.js (or export authorWeightFor beside authorPredicateFor in src/lib/event-tagging/pins.js). Neither exists.
  ✗ A2 (AC-7 carve-out): under the constraint the observer's own weight is 1.0 even with no wot_rank doc
      TESTABILITY CONTRACT … Neither exists.
  ✗ A3 (AC-3, AC-7): with no constraint the verdict AND the weight function are today's, unchanged
      TESTABILITY CONTRACT … Neither exists.
  ✗ A4 (AC-4, profiles): aggregateProfilesTagged accepts the two params and composes BEFORE the fold
      ADR §1: aggregateProfilesTagged must accept { …, authorConstraint, observer }; signature was: async function aggregateProfilesTagged({ tagEventId, povSuffix, minRank }) {
  ✗ A5 (AC-4, notes/items): aggregateNotesTagged composes the constraint before groupTaggingsByTarget
      ADR §1: aggregateNotesTagged must accept { …, authorConstraint, observer }; signature was: async function aggregateNotesTagged({ tagAuthor, slug, authorities, povSuffix, minRank, viewerPubkey, sort = 'recent' }) {
  ✗ S1 (AC-1): the curation dialog offers a two-option "Trust scope" — "My web of trust" and "Only me"
      AC-1 / ADR §3: the dialog needs a control labelled "Trust scope" (a separate control, NOT a value in the method enum).
  ✗ S2 (E3, AC-3): the dialog defaults to web-of-trust and emits authorConstraint ONLY when "Only me" is chosen
      ADR §3: the dialog must read and write authorConstraint.
  ✗ S3 (ADR §3): an initial value this build does not recognise is re-emitted verbatim, never silently downgraded
      ADR §3: the dialog must handle authorConstraint.
  ✓ S4 (AC-3): the client's defaultCurationMethod leaves NEW pins unconstrained
  ✗ S5 (AC-5): the TL read surface parses the author-constraint tag
      ADR §5: useTLDetail must parse findTag('author-constraint') into the tl object — the disclosure is on the LIST, which is the surface a consumer actually has.
  ✗ S6 (AC-5): the pin detail panel renders a "Curation scope" row reading "Only me"
      ADR §5: the pin detail meta gains a "Curation scope" row so a reader can tell a self-curated list from a WoT threshold.
  ✗ S7 (concept graph): the tag-pinning firmware schema documents the new curationMethod field
      ADR Consequences: the schema's curationMethod description is the only human-readable definition of the vocabulary — it must gain authorConstraint ('observer'; absent = unconstrained), then POST /api/firmware/install.
  ✓ S8 (CLAUDE.md): no deployment TA pubkey literal is introduced by any touched file
  ✓ R1 (AC-8): retractStaleTLs carries over identity/provenance/discovery only — never the scoring tags
  ✓ R2 (AC-8): min-rank and cutoff are still emitted, with their pre-story values
  ✓ R3 (AC-7): the membership-method registry and its fail-safe resolver are untouched
  ✓ R4 (AC-7): the three membership folds in runOnePin are unchanged and constraint-blind
  ✓ R5: the guard suites this story must not edit are present, and still own unconstrained byte-identity

only-me-curation: 12 passed, 23 failed, 0 skipped
EXIT=1
```

Every failure names the missing piece (a missing export, a missing parameter, missing UI/schema
text). None is an import or require error — H3/H5/H7/H9/H10 prove the runners load and execute
through their injected deps today, and R1–R5 prove every source file reads cleanly.

## Ambiguities in the ADR and how they were resolved

1. **What the aggregation receives for an *unknown* constraint value.** ADR §4 fixes the wire
   ("the value is the *resolved* constraint, so an unknown value emits **no** tag") but §1 has the
   runner pass `curation.authorConstraint` straight through, with the fail-open decided inside
   `authorPredicateFor`. Both readings are coherent, so **H8 asserts only what the ADR fixes**:
   no disclosure tag, the aggregation is never told `'observer'`, and the emission is gated on
   `isKnownAuthorConstraint`. Passing the raw value down or normalising it to `undefined` are
   both left to the Implementer.
2. **Whether `authorPredicateFor` must return the *same function object*** when the constraint is
   absent. The ADR says it "returns `isAsserterTrusted`". **U4 asserts verdict-identity, not
   reference-identity** — identical behaviour is what AC-3 actually requires, and reference
   equality would over-constrain a `composeAuthorPredicates`-style implementation.
3. **No named weight composer.** The ADR composes the 1.0 carve-out as an inline lambda at
   `profile-tags/index.js:679-682`, which is unreachable from a test. The plan therefore
   **specifies** the seam (above) and accepts either shape. This is the one place the suite asks
   for something the ADR did not name; flagged for the Reviewer at Gate B.
4. **Tag ordering.** ADR §4 says "immediately after" for all three kinds; H2/H4/H6 assert exact
   adjacency (`index(author-constraint) === index(min-rank|p) + 1`) rather than mere presence,
   because a permanent consumer interface is easier to keep stable than to fix later.

## Not covered (explicit)

- **The two `curationMethod` copies agreeing** (AC-2's second clause). `pinTag` stringifies one
  variable into both the `curation-method` tag and `content.tagPinning.curationMethod`
  (`publishTagPin.js:169,171`), so agreement is structural; testing it would need the ESM
  client-publisher probe and a signer. Covered by inspection at Gate B.
- **The rendered dialog and pin-detail panel in a browser** (Gate B / operator local test). No
  Playwright spec is added; S1/S2/S3/S6 are source sentinels.
- **The relay round-trip**: publishing a constrained pin, refreshing it against a real corpus and
  reading the 30392 back. That is the operator's local test at Gate B.
- **`POST /api/firmware/install`** and the graph-side concept copy (S7 pins the schema file only).
  The ADR's aside about the schema prose also omitting `targetTypes`/`noteMethod` is an OPEN row,
  not a test.
- **Rung 2** (`author ∈ <list>`), rung 3 self-attestation, per-pin membership method (story 3),
  the `worth-indexing-for-search` tag, and anything the search backend does with the list.
- **NIP-51 export surfaces** — they carry no curation disclosure today and gain none here.
