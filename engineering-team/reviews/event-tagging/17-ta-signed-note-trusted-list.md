# Review: TA-signed note Trusted List (event-tagging #17 / issue #336) + TL kind spec & applicability re-kinding

**Date:** 2026-07-06
**Reviewer phase.** Story `engineering-team/stories/event-tagging/17-ta-signed-note-trusted-list.md`;
ADR `engineering-team/decisions/event-tagging/0016-ta-signed-note-trusted-list.md`; test plan
`…/17-…test-plan.md`; spec `protocols/drafts/trusted-lists.md`.
**Range reviewed:** `2ced0fca~1..e439413d` (feat/tags) — the applicability-core refactor, the note TL,
and the TL spec + `30393→30394` applicability migration.

## Verdict: **PASS**

Faithful to the ADR, all acceptance criteria met, well-tested (125/125 across 9 suites), and the two
highest-risk changes were both inspected *and* live-verified. Minor non-blocking notes below.

## Acceptance criteria

| AC (story #17) | Verdict | Evidence |
|---|---|---|
| TA-signed note TL for a note-targeting pin (e-tags, observer POV) | ✅ | `runOneNotePin` (refreshPinnedTags.js); test N1; live smoke: bird note TL, 7 e-members |
| Curated by the pin's `noteMethod` | ✅ | `curateNotes(members, noteMethod)`; test N3 |
| Distinct, non-colliding identity | ✅ | kind-30393 (≠ pubkey 30392) + `tl-pin-notes-…` d-tag; tests N1/N2; retraction separated by kind |
| Empty ⇒ empty-membership replacement | ✅ | test N4; `items:[]` published |
| Refreshed alongside the pubkey TL | ✅ | `refreshAllPinnedTags` + viewer path; test S3; live smoke |
| Additive — pubkey TL + kind-30003 export unchanged | ✅ | diff touches neither `publishTagPin` nor `runOnePin`'s 30392 path |

**Operator-directed additions (ratified this cycle, in ADR 0016):**
- **Kind is 30393, not the originally-drafted 30394** — corrected to the NIP-85 convention (e-tags → 30393). ✅
- **TL kind-family spec** `protocols/drafts/trusted-lists.md` + README registration. ✅
- **Applicability lists migrated 30393 → 30394** (addressable members = NIP-85 30384 +10), legacy 30393 retracted in place, idempotent. Tests D6 (re-kinded) + D8 (retraction); live-verified (30394 published 7 members each, 30393 retracted). ✅

## ADR adherence

Option A implemented as specified: `aggregateNotesTagged` extracted and **shared** by `handleForTag`
and `runOneNotePin`; `trustPredicateFor` factored out of `buildTrustPredicate`; note TL wire shape
(kind, d-tag, metric, `e`-members, observer/source-tag/curation, empty-retraction) matches the ADR;
kind-parameterized `retractStaleTLs`. The ADR's post-implementation note (return is `{ members, … }`,
not a bare array) is accurate to the code.

## Risk areas audited

1. **`handleForTag` re-point (unguarded by any runnable suite).** The extracted `aggregateNotesTagged`
   is a **verbatim** move of steps 1–4 (event-tags/index.js), and `handleForTag`'s downstream (the
   kind-1 resolution `let notes = []…` and the response `body`) is **byte-identical** — it destructures
   every intermediate (`members, mine, candidates, countByTarget, mineByTarget, latestByNote, noteIds,
   total, truncated, povSuffix, minRank`) the old code used. `buildTrustPredicate`'s return contract is
   preserved exactly (`povSuffix||null`, `minRank: wotFiltering?minRank:null`, `()=>true` when not
   filtering). The one delta — `idComparators[sort] || idComparators.recent` — is defensive-only
   (`handleForTag` pre-validates `sort` against `FOR_TAG_SORTS`). **Live smoke confirmed parity**
   (`/api/event-tags/for-tag` → success, notes/members/total and all response keys intact). No regression.

2. **Retraction cross-contamination (`tl-pin-notes-` ⊂ `tl-pin-`).** Not an issue: the pubkey retraction
   scans `{kinds:[30392]}` and note TLs are always kind-30393, so they never appear in that scan; the
   note retraction scopes to `{kinds:[30393], dPrefix:'tl-pin-notes-'}`, which excludes the applicability
   d-tags (`tag-applicability-…`). Cleanly separated by kind. Live smoke confirmed the applicability list
   was undisturbed.

3. **Migration data-safety.** `retractLegacyKind` is idempotent (skips absent/already-retracted), retracts
   in place (empty + `status:retracted`), and runs after the new lists publish. No consumer reads the
   applicability list by kind-30393 (the picker uses the live `/api/tags/applicability`); the generic TL
   browser UI already queries `[30392,30393,30394,30395]`. Live-verified.

## Test coverage

- New `test/note-trusted-list.test.js` — 9 tests, hermetic (injected `{lookupTag, aggregateNotesTagged,
  publishTL}`), covering kind/d-tag/metric/members/curation/empty/gate/default. Registered in `test/test.js`.
- `test/tag-applicability.test.js` — D6 re-kinded to 30394; new D8 covers the legacy retraction.
- Independent reviewer run: **125 pass / 0 fail** across note-trusted-list, tag-applicability(+picker),
  unified-tag-index, event-tagging-core/for-tag/read-api, profile-tags, generalized-tag-pinning — the
  for-tag & read-api suites (which exercise the shared core) confirm the extraction didn't regress.

## Minor findings (non-blocking)

1. **Doc drift:** `src/manage/taskQueue/taskRegistry.json:619` (`refreshPinnedTagTLs`) still says
   "Generate or refresh **kind-30392** Trusted List events" — it now also generates the kind-30393 note
   TLs. Worth a one-line description update (cosmetic; no behavior impact).
2. **Discoverability:** the note TL is findable only by exact `d`-tag (kind+author+`#d`); the `#a`/`#p`
   discovery tags were **deliberately deferred by the operator** — tracked, not a defect.
3. **`DListItems.jsx`** manual publisher still offers only `p`/`e`; `a` (30394) / `i` (30395) options are
   noted as follow-ups in the spec. Out of scope here.
4. **Publish-failure edge:** if `runOneNotePin` throws on publish (`status:'error'`), its d-tag is not added
   to `currentNoteDTags`, so a transient failure could retract that pin's prior note TL next pass — this
   exactly mirrors the existing pubkey `runOnePin` behavior, so it's consistent, not a new defect.

## Deploy note (not a code issue)

Both refresh jobs (`refreshPinnedTagTLs`, `refreshApplicabilityLists`) are seeded **disabled**; the note
TLs and the 30394 re-kinding materialize on tags.b.w only when the refresh runs (schedule enablement,
on-pin, or the manual loopback trigger). Expected, per the existing scheduler design.
