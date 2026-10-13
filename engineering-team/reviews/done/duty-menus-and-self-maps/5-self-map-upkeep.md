# Review: Story 5 — The rules that keep a self-Map true

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-12 (finalized 2026-10-13, after an independent check)
**Diff:** `git diff 7ab2c955 930c5454 -- protocols/ docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md ledger/
engineering-team/stories/duty-menus-and-self-maps/5-self-map-upkeep.md
engineering-team/decisions/duty-menus-and-self-maps/0005-self-map-upkeep.md`.
- Story 5's commits:
  - `6179df3d`: ADR 0005 drafted;
  - `ec801369`: ADR 0005 accepted (Open question 1 answered (b); N3 and N4 folded in);
  - `984c7cc8`: the Implementer's first pass;
  - `8287d951`: ADR 0005's Clarifications after acceptance (KB-C2, KB-RD-1, KB-RD-2);
  - `930c5454`: the kick-backs applied.
- The range's other commits belong to books `assistant-self-map` (via the merge `f51fe70d`) and
  `assistant-duties-settings`. Checked commit by commit, the only ones that touch a file in this review's scope are
  `273d4441` (Duty Menus' Implementation line, :5, and the new row `2026-10-12-settings-json-written-in-place`) and
  the merge's own ledger rows. None touches a line story 5 changed. BIBLE is outside these paths (see Scope). Duty
  Menus' metadata keeps `273d4441`'s Implementation line beside story 5's Sources edit, as it should.

**Mode:** docs-mode (Protocol-Spec workflow). Test Design was skipped, so there is no test plan. This review audits
the accuracy and consistency of the spec prose. The gate is a regression check only.

**Inputs:**
- story `stories/duty-menus-and-self-maps/5-self-map-upkeep.md` (Approved; owner answers 1a, 2a, 3a, 4a, 5a, and the
  confirmation that the vocabulary gate covers only added or changed text; § Deviations, Implementer block);
- ADR `decisions/duty-menus-and-self-maps/0005-self-map-upkeep.md` (Accepted 2026-10-12; Open question 1 answered
  (b); Revisions 1–2; N3 and N4 at acceptance; Clarifications after acceptance KB-C2, KB-RD-1 and KB-RD-2, none
  changing a rule). It supersedes ADR 0003 A2-1 and sub-decision 4's reading of a removed self-entry as a stop;
- background: ADR 0004, ADR 0003 A2, and `audits/duty-menus-and-self-maps/book.md` (frame bullet 6 is this story;
  bullets 1–5 are stories 1–4, all Done).

**Filename note:** a docs-mode story with ACs, so the numbered filename (known template defect
`ledger/2026-10-10-review-template-docs-mode-filename.md`).

**Method:**
- I read Treasure Maps §§ 2, 3, 7, 8, 9 and 9.2 in full at HEAD, Assistant Designation § Per-DList curation entries
  and § Curation copies, Trusted Lists' Common wire shape and Migration note, Spawning §§ 1, 3.6, 4 and 5, and the
  changed lines of Duty Menus, against the word-diff and against ADR 0005's Decision, Clarifications, Implementation
  notes and Verification.
- I re-ran the six model scripts the ADR names, with `python3 -I` from each script's own directory, into
  `scratchpad/rv-s5/reviewer/`. All six exit 0 and are byte-identical to their saved outputs.
- I fetched NIP-01 and NIP-09 with curl through the proxy, into a directory of their own.
- Five auditor lenses (re-derivation, sources, conformance, coherence, intent) reported six findings, all
  non-blocking, and no blocker. I checked each against the sources before using it. All six hold. Conformance NB1
  and intent OI-1 are the same finding and are merged (NB4). The coherence lens also raised two pre-existing
  observations outside the story's scope; I checked both and carry them as NB6 and NB7, so that each has a surface.
- My own pass found no blocker. I looked for: wrong normative text; a case with two honest readings that give
  different results; an ADR item not carried; an AC not met; a misleading citation.
- An independent checker then re-checked this review (2026-10-13): the gate record, the lint, the vocabulary grep,
  the links, the six model scripts (into `rv-s5/checker/`, byte-identical), NIP-01 and NIP-09 fetched fresh, and
  spot-checks of claims rows, ACs and code citations. It found no blocker and three non-blocking imprecisions in
  this review's own evidence text. I verified each and corrected the text (§ Independent check).

## Quality gates (run by reviewer, not trusted)

- [x] `npm test`, run as `GATE_LABEL=duty-menus-5-review npm test` on a clean tree at `930c5454`.
  `npm run -s gate:status -- --label duty-menus-5-review` reports:
  `20261012T235154Z-29366-6e28 [duty-menus-5-review] started 2026-10-12T23:51:54.198Z on 930c5454 — PASS, exit 0, 5854 passed, 0 failed, 591 skipped, 307/307 suites`
  The record has `git.dirty: false`. The story's commits change no code and no test, so the green run means no
  regression. The kick-back pass's own run on the committed, clean `930c5454` corroborates it:
  `20261012T230809Z-9404-bed4 [duty-menus-5-impl] started 2026-10-12T23:08:09.349Z on 930c5454 — PASS, exit 0, 5854 passed, 0 failed, 591 skipped, 307/307 suites`
  (`dirty: false`; it started six seconds after the commit). The three runs the story names (§ Deviations, Gates)
  show 304 suites, and so does a fourth it does not name, `20261012T223549Z-22871-555a` (`s5-impl-fix3`, PASS). All
  four ran on `6179df3d` with the story's edits uncommitted (`dirty: true`, 15 files), before the merge `f51fe70d`
  and `e05f033d` added three suites (`test/registry.js`) to this line.
- [x] `npm run test:playwright`: not applicable (no UI).
- [x] `bash scripts/harness-lint.sh | tail -1`: `harness-lint: clean (0 violations)`, before I wrote anything and
  again with this review, the story's status and the ledger edits in place.
- [x] _Lint, typecheck and build are not configured, so they were skipped._
- [x] **Vocabulary (AC5).** `git diff -U0 7ab2c955 930c5454 -- protocols/ docs/ | grep '^+' | grep -icE
  'canonical|consensus'` gives 0. Across `ledger/` too, the only added hits are the new row
  `2026-10-12-treasure-maps-canonical-uses`, which exists to list the old uses. Its list matches Treasure Maps
  (:3, :52, :70, :101, :105–107, :153, :594, :596).
- [x] **Citations in spec bodies.** The added spec lines outside the `>` metadata blocks name no ADR, story, ledger
  row, handoff or deployment. Their only RFC keywords (§ 3's SHOULD, § 7's MAY, the Lists bullet's SHOULD) were there
  before.
- [x] **Links.** 82 relative links in the five drafts, the handoff and the story resolve with their anchors, including
  `#curation-copies` and `./trusted-lists.md#common-wire-shape` (script `rv-s5/reviewer/links.py`, 0 bad; 81 before
  the story's Linked artifacts named this review).
- [x] **Scope (V13).** `git diff -U0 -- protocols/` hunks: TM :5, :53, :84, :164, :229, :270, :320, :322, :369,
  :392, :405, :407–409, :427–430, :445, :506, :606, :652, and Q13 after :656; AD :4, :84, after :109, after :146;
  SP :160, :169; TL :8, :73–75; DM :6 and :113 (DM :5 is `273d4441`'s). These are exactly the Implementation notes'
  lines. Story 5's commits outside `protocols/` touch only the handoff, the seven named ledger rows, the story and
  the ADR.
- [x] **ADR text carried verbatim.** I read every "→" and blockquote of the Decision and the Clarifications against
  the word-diff. All are in, as written: sub-decisions 1–8, the Sources clauses of sub-decision 10, KB-RD-1's § 11
  text, KB-RD-2's question 13 and its Sources-clause ending, and KB-C2's two ledger texts. The cross-book row's items
  1–5 are the ADR's Consequences items word for word.
- [x] **External sources** (raw `nostr-protocol/nips` master, fetched today):
  - `01.md:99`: for an addressable event "only the latest event MUST be stored by relays";
  - `01.md:101`: on equal timestamps, "the event with the lowest id … should be retained";
  - `09.md:35`: with an `a` tag, relays delete "all versions … up to the `created_at`" of the request. No new text
    sends a deletion, so this bears only on Removal's unchanged case, as sub-decision 1 says.
- [x] **Model scripts.** `s5/model.py ../s3r2/a2.py 4000`, `s5/wording.py`, `s5/r1/r1.py`, `s5/r2/n1.py`,
  `s5impl/n34.py` and `s5impl/fix2/kbrd1.py` (against `s5impl/verify/check3/kbrd1.out`): all exit 0 and `cmp` equal.

## Claims adherence (docs-mode)

TM is `protocols/drafts/treasure-maps.md`, AD `assistant-designation.md`, TL `trusted-lists.md`, SP `spawning.md`
and DM `duty-menus.md`, all at `930c5454`.

| # | Claim | Where | Evidence | OK |
|---|---|---|---|---|
| 1 | A List carrying the marker is no copy, whatever the provider's self-Map says | TM:320 | `model.out` Part 1: the new rule gives one answer for all five readers in every named case but (d) and (r3), which differ under both rules for reasons other than the marker: (d) from § 3's step 1 and the allowance, (r3) from the allowance (sub-decision 6, § 9.2's second case). A sweep of TM for `retract`, `no members`, `as maintained` finds no line that reads a retraction as a copy | ✓ |
| 2 | § 3's causes end "or a retracted List, § 7" | TM:84 | § 7 (row 1); "A copy the reader does not accept does not end the search" (TM:90) unchanged | ✓ |
| 3 | Enumerate leaves out a List whose latest version found (NIP-01) carries the marker | TM:270 | `01.md:99`, `:101`. Part 4: Enumerate lists L1 and L4, and every reader's § 7 matches it. `r1.out` Part C: "A not listed" asking R and Rw, listed from Rw asking Rw alone | ✓ |
| 4 | A self-entry removed or narrowed while the key keeps publishing is no stop, and nothing in What follows a stop follows from it | TM:405 | AC1's check reads one way (below). `r1.out` Part D: narrowing `3038x` keeps 98 of 116 Scores, drops the 18 `30385` | ✓ (NB2) |
| 5 | Lists: the reasons to retract are reasons to stop; a List given by an exact key stays a duty when its Tag leaves the supported sets | TM:407 | § 9 (:342), § 8 (an exact key "is a duty whether or not …"); SP principle 3(b) | ✓ |
| 6 | Scores: a reader sees a stop only as the removed or narrowed self-entry | TM:408 | Maintained, at its relay (:419) | ✓ |
| 7 | Concepts: header, `b` and copies stay | TM:409; AD:110 | AD Revocation (:84) and When curation stops (:110); TM § 9 Revocation (:349) unchanged | ✓ (NB6 on SP § 5) |
| 8 | First, third and fourth allowance cases: the key's retraction of a List is no copy | TM:427, :429, :430 | `r1.out` Part B3 (a relay that missed the retraction still holds a copy, which is why the text says "the key's retraction") | ✓ |
| 9 | Second case names the supported sets, and a re-pin until Spawning § 5 Restore | TM:428; SP:172 | Part 1: (r1) B's List, (r2) not found, for every reader; (r3) A's old Score for F, N, Z2 | ✓ |
| 10 | § 9's capability limit bounds the to-do list, not self-entries; the one-observer sentence excludes a key that serves only itself | TM:369 | `wording.out` part 2: "TRUE … against the example" with the limit, "false: A narrows" without | ✓ |
| 11 | Private duties in `.content` are open, in question 8 | TM:392, :652 | Q8 now separates W22's decided pattern from the two open parts | ✓ |
| 12 | Alternates: the Map asks a standby that is up to date, which it does not show; "ready now" only when confirmed | TM:322 | Confirmed duties (:417) | ✓ |
| 13 | A self-entry entrusts no one and § 10's rows do not read it; § 5's observer for a self-entry | TM:445, :229 | § 2 Observer (:57), § 9 Self-entries (:346) | ✓ |
| 14 | Principle 8 and § 11 give At a glance's two exceptions; § 11's colon counts | TM:53, :606 | `kbrd1.out`: tag List 3, Score 4; dlist 2 and 3; native 1; `30382:tag::T1` a scope. `wording.out` parts 1 and 3 | ✓ |
| 15 | § 10.5's `30382:tag:::<metric>` is the Profiles category; § 4.3 cites CC's opening table | TM:506, :164 | `wording.out` part 4; CC:18–24 | ✓ |
| 16 | Question 13 asks whether an Alternate on a per-list Concept key curates, and answers nothing | TM:657 | Premises: TM § 7 (:322) and § 9 (:342) count Alternates; SP principle 3 (:24–26, "An exact key passes (b) on its own"); AD :78 ("at most one per (kind, d-tag)", "the first occurrence wins") and :110. `n34.out` C4 | ✓ (NB3; awaiting the owner, below) |
| 17 | When curation stops: copies stay, no deletion request, nothing more copied or deleted, resume only while empowered; Removal is never a step of stopping | AD:110 | AC1 check (below) | ✓ |
| 18 | Revocation keeps the copies; the worked copy stops while Fido's copy stands | AD:84, :149 | "If instead, while Fido's copy stands" sets the stop as an alternative to the deletion at :134–146 | ✓ |
| 19 | The marker means only "no longer maintained there"; a maintained List, even empty, is never marked | TL:74–79 | Agrees with TL's Migration note (:148–150), SP principle 5, Hand-off and Retire | ✓ (NB1) |
| 20 | SP's `status` row and Refresh point at TL and turn on "maintained" | SP:160, :169 | Read alone, SP answers both AC2 checks | ✓ |
| 21 | DM § 5.2's gloss reads per insight | DM:113 | `wording.out`: 17 `30385` insights to `not-offered`, `30385:rank` to the `duty` row | ✓ |
| 22 | Sources lines | TM:5, DM:6, AD:4, TL:8–9 | `grep -n 'ADR 0005'` hits all four. TM's ADR 0004 clause names At a glance's second bullet; DM's ADR 0003 clause names A1 and A2 and § 9's Counting Maps pointer (DM:278) | ✓ |
| 23 | The handoff's Q4 line | handoff:19–22 | TM § 13 q8 asks it; DM § 14 q1 (:365) asks about menus; worksheet W22 (:260) "Closed" | ✓ |

## Spec adherence (acceptance criteria)

| AC | Where it is met | Read as | OK |
|---|---|---|---|
| AC1 copies | AD:84, :110, :149; TM:349 (unchanged), :409 | 1(a). Check: Alice republishes without `["39998:dogs", …]`. From AD alone, the copies under `39998:<alice's assistant>:dogs` stay, no NIP-09 request is sent, and nothing more is copied or deleted | ✓ |
| AC1 no stop | TM:405–409; AD:110 last sentence | Check: the assistant removes its self-entry and keeps curating. § 9.2's lead says no stop and nothing below follows, so nothing is retracted or deleted; the self-entry's claim ends. AD agrees | ✓ |
| AC2 item 19 | TL:74–79; SP:28, :160, :169, :170–171 | 2(a). Check: TL alone and SP alone each give an unmarked List with no members, and the marker at the old `d` after a move | ✓ (NB1) |
| AC2 § 7 | TM:320; TM:84, :407, :427, :429, :430 | 2(a). Check: A stopped and retracted; a reader holds an older self-Map whose self-entry wins the List. § 7: no copy, whatever the self-Map says, so the reader goes on as § 3 and § 7 say. No sentence of TM reads that retraction another way (claims row 1) | ✓ |
| AC2 A2's cost | ADR 0005 Consequences | Cases (e), (e′), the private entry; and the change to A2-1, recorded in sub-decisions 4 and 9 | ✓ |
| AC2 Enumerate | TM:270; TM:95 unchanged | 3(a) with OQ1(b). Check: of the three lists, Enumerate lists the one with members only; both retractions are left out, matching § 7 for each | ✓ |
| AC2 item 20 | TM:428 | Check: after a re-pin, before A restarts T's List, the allowance does not rest on A's word for that List, and the reader finds A's old retraction, which is no copy | ✓ |
| AC3 | TM:369, :392, :652, :322, :445, :229; handoff:19–22 | Items 5, 9, 12, 13, each with its check (claims rows 10–13, 23). The handoff's § 9 list is unchanged, as history | ✓ |
| AC4 | TM:53, :606, :506, :164; DM:113; TM:5; DM:6 | 4(a), every bullet. Check: none of At a glance, principle 8 and § 11 calls `30392:tag::⟨Podcaster⟩` a scope or gives a Concept key a fixed number of colons | ✓ |
| AC5 | See "AC5, in detail" | | ✓ (NB4 on the epic, outside this story's phases) |

**AC5, in detail:**
- **Ledger.**
  - `2026-10-12-self-maps-spec-fold-forwards` is DONE with `**Done:**` filled. Its story-5 note gives every item's
    landing place with the ADR's sub-decision, and the supersession record. The story-4 addendum now follows the
    story-4 note (:108–114), in date order.
  - `2026-10-12-key-grammar-review-fold-forwards` is DONE with a note: items 1–5 landed, item 6 resolved by 4(a).
  - `2026-10-12-addressable-kinds-spawning-content-categories` and `2026-10-12-bare-39998-ta-discovery` carry dated
    notes naming 5(a) and stay OPEN. The bare-`39998` note carries KB-C2's text.
  - `2026-10-12-list-d-tags-not-treasure-maps` has its note: an old `d`, an alias, § 5.1, the reference publishers on
    a run that succeeds, and the two failure paths. I checked the code facts at HEAD: `refreshPinnedTags.js` :146,
    :341 (no `d`), :387 (`status: 'error'`), :405–409 (only `ok` note `d` tags kept); `retractLegacyKind` in
    `refreshApplicabilityLists.js`. NB5 is on its alias bullet.
  - The new rows `2026-10-12-treasure-maps-canonical-uses` and `2026-10-12-self-map-upkeep-cross-book-notes` exist,
    type `docs`, each `**Id:**` matching its file name.
- **Earlier ADRs.** ADR 0005 sub-decision 9 records NB10, the § 5.4 question and the A2-1 change. ADRs 0003 and 0004
  are untouched in the range.
- **Shipped code and book `assistant-self-map`.** The cross-book row's items 1–5 name the "off" button, the stop
  points, the supported-Scores reading, Concepts upkeep and Lists. The intent lens ran the reorder check
  (`s5sk/check3/reorder.mjs`); I read `curatedDListRows`/`curatedDListAccess` (`ui/src/utils/treasureMap.js`:313–323,
  :357–371) and agree with item 4.
- **Metadata.** Claims row 22. Spawning has no Sources line.
- **One place for each wire fact.** The marker's meaning is in TL alone, and SP points at it. The copies at a stop are
  in AD alone, and TM § 9.2 points at it (§ 9 agrees). The reading of a marked List is in TM § 7, and §§ 3, 5.4 and
  9.2 point at it.
- **Vocabulary, gates, scope.** Above.

## ADR adherence

| Item | Spec | Verdict |
|---|---|---|
| 1 When curation stops; worked copy; Revocation; TM § 9 unchanged | AD:110, :149, :84; TM:349 | ✓ |
| 2 What follows a stop (lead and three bullets) | TM:405–409 | ✓ |
| 3 TL marker bullet; SP § 4 row and § 5 Refresh; principle 5, Hand-off, Retire unchanged | TL:74–79; SP:160, :169 | ✓ |
| 4 § 7; § 3; first, third, fourth cases | TM:320, :84, :427, :429, :430 | ✓ |
| 5 § 5.4 with OQ1(b); § 3 Enumerating unchanged | TM:270, :95 | ✓ |
| 6 Second case | TM:428 | ✓ |
| 7 Items 5, 9, 12, 13; the handoff | TM:369, :652, :392, :322, :445, :229; handoff:19–22 | ✓ |
| 8 Principle 8; § 11 (as KB-RD-1); § 10.5; § 4.3; DM § 5.2 | TM:53, :606, :506, :164; DM:113 | ✓ |
| 9 Records; ADR 0003 not edited | ADR 0005; the self-maps row's note | ✓ |
| 10 Sources lines; ledger | TM:5, DM:6, AD:4, TL:8–9; seven rows | ✓ |
| KB-C2, KB-RD-1, KB-RD-2 | TM:606, :657, :5; bare-`39998` note; cross-book item 4 | ✓ |
| Implementation notes 1–8; not-edited list; gates | Hunks on the listed lines; nothing in the not-edited list changed in story 5's commits; gates above | ✓ |

## Deviations, judged

The Implementer's block (story :499–542) is accepted. Each claim checks:
- line numbers: no draft, the handoff or a scoped ledger row changed between `7ab2c955` and `6179df3d`
  (`git diff --stat` is empty for `protocols/ docs/ ledger/`), and the hunks sit on the ADR's lines;
- TL's rewrap, the handoff's one extra line (:19–22), the Sources clause placements, and the lead's period;
- the ledger notes' extra substance, each of which restates the ADR or its Context and adds no rule;
- the cross-book row verbatim, with a preamble that glosses references only;
- N3 and N4 reaching the deliverables only through the two rows;
- the three gate runs it names exist and passed (`tmp/gate-runs/`). Their records show `6179df3d` with 15 uncommitted
  files, so they tested the story's edits before other sessions' commits were interleaved under them. That is
  enough for a docs-only change, and my run on the committed `930c5454` covers the rest. The block names three of
  the story's five runs: it leaves out the fourth fix-round run (`20261012T223549Z-22871-555a`, PASS) and the
  kick-back pass's run on `930c5454` (`20261012T230809Z-9404-bed4`, PASS, clean). Neither hides a failure, and both
  are recorded here (Quality gates);
- the KB-C2, KB-RD-1 and KB-RD-2 lines, which carry the ADR's text.

The block does not need to cover the Clarifications as deviations: they are the ADR's text, landed in `8287d951`, an
`adr:` commit of their own, before the next `impl:` (Harness friction 1).

## Verification cases, re-derived

| Case | Expected | Re-derived from the specs | OK |
|---|---|---|---|
| V1 | One reading of a retraction | Claims rows 1, 2, 8; `model.out` Part 1 | ✓ |
| V2 | 178/1,597; 949/0; 0/723; 0/0 | `model.out` Part 3 (my run) | ✓ |
| V3 | The Residual | `model.out` Part 2; `r1.out` A1, A1c, A2 | ✓ |
| V4 | Enumerate lists L1 and L4 | TM:270; Part 4; `r1.out` Part C | ✓ |
| V5 | Unmarked empty List; marker at the old `d` | TL:74–79; SP:160, :169 | ✓ |
| V6, V7 | Copies stay; the "off" button is no stop | AD:110, :84, :149; TM:405 | ✓ |
| V8 | Re-pin | TM:428 | ✓ |
| V9 | Item 5 | TM:369; `wording.out` part 2 | ✓ |
| V10 | Items 9, 12, 13 | TM:652, :392, :322, :445; handoff | ✓ |
| V11 | AC4 | TM:53, :606, :164, :506; DM:113; Sources | ✓ |
| V12 | One place per wire fact | AC5, in detail | ✓ |
| V13 | Bookkeeping and scope | AC5, in detail; Quality gates | ✓ |
| V14 | S1 0/115; S3 98/18; S2, C3; C1, C2; C4, C5 | `n1.out`, `n34.out` (my runs) | ✓ |
| V15 | Clarifications change no rule | No MUST/SHOULD/MAY in their hunks; `grep -n 'same[ ]question'` finds nothing in the ADR or the two rows; `kbrd1.out` | ✓ |

## Scope

- **Inside `protocols/`:** the five drafts, at the lines named. Nothing else.
- **Outside it:** the handoff's Open questions line; the seven named ledger rows (five notes, two new); the story's
  § Deviations; ADR 0005 itself. BIBLE's four hunks in the range (:527, :567, :1072, :1384; two commits, `476f8b17`
  through the merge and `273d4441`) are other books'.
- **Departures:** none from the story as approved.

## Concept-graph integrity

- [x] No handle changes. The diff names concepts in plain language only.
- [x] No concept definitions changed, so no firmware reinstall is needed (ADR: "No").
- [x] No code, so the orient-via-summaries check does not apply. No TA literal was added; the `LEGACY_*` constants are
  untouched.

## Things tests can't catch

- [x] No secrets, debug content or commented-out text.
- [x] No deployment details in spec bodies.
- [x] **The four invariants hold.**
  - **Nothing gates publication.** The new rules bind readers (§ 7, § 5.4) and a key's own conduct (When curation
    stops, What follows a stop). None tells a relay or reader to reject an event.
  - **Per point of view.** Every reading runs over the observer's Map and the reader's own view of the self-Map.
  - **Filter at view time.** Nothing stores a per-POV result.
  - **Local-first.** Nothing deletes: copies, header and `b` stay, and the marker replaces rather than deletes.
- [x] **Edge cases in prose.** No case reads two ways with different results. NB1 and NB2 are sentences a careful
  reader reconciles from the normative text beside them.

## House rules check

- [x] Concept Graph API authority respected (no code).
- [x] No new lint, typecheck or build tooling.
- [x] Vocabulary: no "canonical" or "consensus" in added or changed spec or handoff text.
- [x] Specs cite specs and NIPs. ADRs appear only in the metadata Sources lines.

## Product-guide adherence

- n/a: no PRD and no UI copy.

## Awaiting the owner (not a finding)

- **Treasure Maps § 13 question 13** (ADR 0005 KB-C2): does an Alternate entry on a per-list Concept key ask that
  Assistant to curate the list, and what empowers it? The Architect added it after acceptance, and the owner has not
  confirmed it. It is stated as open: it sits in § 13 Open questions, is phrased as a question, and answers nothing.
  Row `2026-10-12-bare-39998-ta-discovery` and the cross-book row's item 4 both say that the owner has not confirmed
  it, and that the docs pass must answer it on its own. The owner may confirm it there or move it to another row.

## Findings

### Blocking

None.

### Non-blocking

Items 1–4, 6 and 7 go to the new ledger row `2026-10-12-self-map-upkeep-review-fold-forwards`: items 1–3, 6 and 7
for the docs pass after the book, item 4 for the PO before or at `/close-book`. Item 5 goes to a dated note on row
`2026-10-12-list-d-tags-not-treasure-maps`, for the code book. None changes a rule.

1. **protocols/drafts/trusted-lists.md:75–78**, the marker bullet; also SP:160 and TL:8–9. The marker's meaning is
   pinned to the `d` ("stops maintaining a list at its `d`", "no longer maintained there"), but one reason the same
   sentence lists, "migrates it off a kind", keeps the `d`: TL's Migration note (:148–150) retracts the `30393` lists
   "at the same `d` tags" while the list goes on at that `d` on `30394`.
   - Not blocking: the same sentence names migration as a reason to mark, and SP principle 5 and Retire cover the old
     key, so every reader marks the old-kind list. (Coherence NB1.)
   - *Ask (docs pass):* "at its address (its kind and `d`)" in all three places.
2. **protocols/drafts/treasure-maps.md:405**, What follows a stop, the lead. It names the insights a reader stops
   counting as "the insights that no remaining self-entry of the key wins and speaks for", an objective set. The
   paragraphs it cites (Confirmed duties :417; Maintained :419) and the third case (:429) make it the reader's
   judgment ("that the reader takes to speak for it").
   - Not blocking: a reader can judge "speaks for" only through What a reader can tell, and the lead's own
     parenthetical sends it there, so readers converge. (Coherence NB2.)
   - *Ask (docs pass):* "…wins and that the reader takes to speak for (What a reader can tell)".
3. **protocols/drafts/treasure-maps.md:657**, question 13's `[Spawning](./spawning.md)'s two gates (principle 3)`.
   In Treasure Maps a bare "(principle N)" is Treasure Maps' own (:344, :353, :405), whose principle 3 ("What and
   where, never how") has no gates. The possessive leads to Spawning § 1 principle 3 (SP:24–26), so the citation is
   loose, not misleading. It is KB-RD-2's text as written. (Sources SRC-NB1.)
   - *Ask (docs pass):* "Spawning's two gates (Spawning § 1, principle 3)".
4. **engineering-team/epics/duty-menus-and-self-maps.md:42**, the story-5 entry. It still ends "The owner decides at
   approval, and this entry then records the answers to the story's open questions 2, 4 and 5", and records none.
   The approval commit `7ab2c955` touches only the story (6+/1−), though the story's Approval paragraph (:492–495)
   says the PO commits the epic with it; story 4's approval (`b13bb6b5`) did. AC5 Scope gives epic edits to approval,
   so the Implementer rightly left it, and the answers are recorded in the story and the ADR's Context. No spec
   reader is misled. (Conformance NB1, intent OI-1.)
   - *Ask (PO, before or at `/close-book`):* record 2(a), 4(a) and 5(a) in the entry, as the new row's item 6 words
     them.
5. **ledger/2026-10-12-list-d-tags-not-treasure-maps.md**, the story-5 note's second bullet ("an old `d` kept as an
   alias stays maintained and unmarked"). It is accurate under 2(a), and AC5 asked for both options, but it does not
   say that TM § 12 (:637) and Pins § 10 (`pins.md`:234) already ask for the old `tl-pin-…` Lists to be retracted in
   place. Shipped readers still read `tl-pin-` `d` tags (`ui/src/hooks/useTagMemberSets.js`:56, :93;
   `src/api/profile-tags/index.js`:1635), so the alias is a live option for the code book. (Intent OI-2.)
   - *Done here:* a dated note on the row with both spec pointers.
6. **protocols/drafts/spawning.md:170–171**, § 5's Hand-off ("The old one retracts") and Retire ("retract in place").
   Read for a § 3.6 Concept, which has no retraction convention, they sit against AD's rule that the header, its `b`
   and now the copies stay at a stop (AD:84, :110). The header part predates story 5, ADR 0005 scopes Spawning § 5 out
   except Refresh, and AC5 bars it. The cross-book row's item 4 tells the code book what to do, so no build is misled.
   (Coherence observation, checked here.)
   - *Ask (docs pass):* say that a Concept's Hand-off and Retire follow AD § Curation copies, When curation stops.
7. **protocols/drafts/assistant-designation.md:177**, Deployment status (not normative): "nothing copies items yet
   (stories 3–5)". The shipped curation code makes `copy-` items (`src/api/dlist-curation/updateEvents.js`:50–52).
   Pre-existing, outside AC5's scope. (Coherence observation, checked here.)
   - *Ask (docs pass):* bring the sentence up to date.

### Harness friction

1. **A post-acceptance ADR section again names no approver.** ADR 0005's Clarifications after acceptance landed in
   `8287d951` (`adr:`) between the Implementer's two passes, as fix shape (b) of meta row
   `2026-10-11-implementer-edited-accepted-adr` asks, and the Implementer edited no ADR. But the section names no
   approver, and KB-C2 opens a question the owner has not confirmed. I appended a dated note to that row.
2. **Known items, no new rows:**
   - The first review dispatch held the commit, against `workflows/5-review.md`
     (`2026-10-11-reviewer-dispatch-tools-and-commit`); the finalizing dispatch committed it.
   - The template's "On PASS" heading reads as a verdict (`2026-10-07-on-pass-heading-reads-as-verdict`), so the last
     section here is "Close-out".
   - The template's docs-mode filename note (`2026-10-10-review-template-docs-mode-filename`).
   - The template records completion detection in the chat, not in this file; this review follows it.
3. **Script output stayed stable.** All six model scripts printed byte-identical output on my runs.

## Independent check

An independent checker re-checked this review on 2026-10-13 (Method), and its PASS stands. It raised three
findings, all non-blocking. I verified each against the record before acting on it:

- **CK-1, completion and the commit (holds).** The book's "Done looks like" asks that every story pass review and
  be on `staging`. When the check ran, this story's PASS record (this review, `**Status:** Done`, the new row and
  the two dated notes) was uncommitted, and `staging` stood level with `origin/staging` at `930c5454`.
  *Done here:* Close-out says the record lands in the review commit, and that any offer to close the book waits on
  that commit reaching `staging` (it is not pushed) as well as on NB4.
- **CK-2, the gate account (holds).** The story's Gates bullet names three of five runs. Records
  `20261012T223549Z-22871-555a` (`s5-impl-fix3`, `6179df3d`, 15 dirty, PASS, 304 suites) and
  `20261012T230809Z-9404-bed4` (`duty-menus-5-impl`, `930c5454`, clean, PASS, 307 suites; commit 23:08:03Z, run
  23:08:09Z) exist. *Done here:* Quality gates narrows "the Implementer's runs" to the three the story names,
  names the fourth, and cites the clean run as corroboration; Deviations, judged, records the omission.
- **CK-3, three evidence imprecisions (holds).** (a) ADR 0005 sub-decision 4 puts (d) on § 3's step 1 and the
  allowance, and (r3) on the allowance (sub-decision 6); `model.out` (r3) gives A's old Score to F, N and Z2.
  (b) `git diff -U0 7ab2c955 930c5454 -- BIBLE.md` has four hunks, from `476f8b17` and `273d4441`. (c) `273d4441`
  also adds `ledger/2026-10-12-settings-json-written-in-place.md`, and BIBLE is outside the Diff's paths.
  *Done here:* claims row 1, § Scope and the header's Diff paragraph are corrected.

None of the three changes a conclusion, an AC or a V case. In the same pass I ran `links.py` on this review and the
new row. NB3's quote and the row's item 3 rendered a spec link (`./spawning.md`) relative to their own folders,
where it is broken. Both now quote it as code (`links.py` does not skip code spans, so it still lists the two).

## Verdict
**PASS**

Story 5 lands ADR 0005 and its three clarifications verbatim in the five drafts, the handoff and the ledger, under
the owner's answers 1(a)–5(a) and Open question 1(b). Every AC and V case re-derives from the specs and the
reproduced models, and the gate is green. The seven non-blocking items are wording, bookkeeping and pre-existing
text, each with a surface. An independent check confirmed the verdict and corrected three details of this review's
evidence text.

## Close-out

- The story's `**Status:**` is now `Done`, set in place, and its Linked artifacts name this review. No file moves
  (retirement is per epic).
- Completion detection was run against `audits/duty-menus-and-self-maps/book.md`; the result goes with this review's
  return, not here (template).
- Ledger:
  - a new row, `2026-10-12-self-map-upkeep-review-fold-forwards` (NB1–NB4, NB6, NB7);
  - a dated note on `2026-10-12-list-d-tags-not-treasure-maps` (NB5);
  - a dated note on `2026-10-11-implementer-edited-accepted-adr` (Harness friction 1).
- Committed in the review commit, after the independent check. Not pushed, by the dispatch. The book's "Done looks
  like" asks that every story be on `staging`, so this story counts only once that commit reaches `staging`. Any
  offer to close the book waits on that and on NB4's epic edit (CK-1).
