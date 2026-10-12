# Review: Story 4 — The Treasure Maps key grammar

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-12
**Diff:** `git diff b13bb6b5 05954589 -- protocols/ docs/ ledger/ engineering-team/stories/duty-menus-and-self-maps/ engineering-team/decisions/duty-menus-and-self-maps/`.
- Story 4's commits:
  - `00341d7e`: ADR 0004 drafted;
  - `e4b656d8`: ADR 0004 accepted, with ADR 0003's items 2 and 3;
  - `899253ee`: the PO's records (stories 3 and 4);
  - `ae888a7e`: the Implementer's first pass;
  - `0311cca3`: ADR 0004's Clarifications after acceptance (KB-1 to KB-3);
  - `05954589`: the kick-backs applied.
- The range's other commits (`bbc13751`, `2c82f157`, `acce34c4`, `f5ad2fe7`, `388394f8`) belong to book
  `assistant-self-map`. Checked commit by commit, none of them touches `protocols/`, `docs/`, this epic's stories or
  ADRs, or any ledger row named below. The ledger rows `2026-10-12-list-d-tags-not-treasure-maps` and
  `2026-10-12-ta-scores-stopped-landing` come from `acce34c4` and are not reviewed here.

**Mode:** docs-mode (Protocol-Spec workflow). Test Design was skipped, so there is no test plan. This review audits
the accuracy and consistency of the spec prose. The gate is a regression check only.

**Inputs:**
- story `stories/duty-menus-and-self-maps/4-treasure-map-key-grammar.md` (Approved; owner answers 1a, 2a, 3a/a, 4a,
  5a; § Deviations, with the PO's record and the Implementer's block);
- ADR `decisions/duty-menus-and-self-maps/0004-treasure-map-key-grammar.md` (Accepted 2026-10-12, owner answers 1a,
  2a, 3a; R3-1 and R3-2 fixed at acceptance; Clarifications after acceptance KB-1 to KB-3, which change no rule);
- background: ADR 0002 (A1-8, A1-9, A1-10, made final here), ADR 0003 (A2-4's departure ends here), and
  `audits/duty-menus-and-self-maps/book.md` (frame bullet 5 is this story, bullet 6 is story 5).

**Filename note:** this is a docs-mode story with ACs, so it uses the numbered filename. That is the known template
defect `ledger/2026-10-10-review-template-docs-mode-filename.md`.

**Method:**
- I read Treasure Maps and Duty Menus at HEAD in full, and the changed passages of Assistant Designation and Trusted
  Lists, against the word-diff and against ADR 0004's Decision, Clarifications, Implementation notes and Verification.
- I re-ran the seven model scripts the ADR cites, with `python3 -I` from each script's own directory, into
  `scratchpad/rv-s4/reviewer/runs/`. I also ran the shipped readers with node (`rv-s4/reviewer/code/`).
- I fetched NIP-01, 09 and 65 with curl through the proxy, into a directory of their own.
- Five auditor lenses (re-derivation, sources, conformance, coherence, intent) reported 11 findings, all
  non-blocking, and no blocker. I checked each one against the sources and the code before using it. All 11 hold.
  Duplicates are merged below (NB-1 with OWN-3, and NB-3 with OWN-1), which leaves nine non-blocking items.
- An independent check was applied after this review was drafted (see "Independent check" below). It found no
  blocker and two wording slips in this file, both corrected here.
- My own pass found no blocker either. I looked for these in particular:
  - wrong normative text;
  - a case with two honest readings that give different results;
  - an ADR item that was not carried;
  - an AC that is not met;
  - a misleading citation.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test`, run as `GATE_LABEL=duty-menus-4-review npm test` on a clean tree at `05954589`.
  `npm run -s gate:status -- --label duty-menus-4-review` reports:
  `20261012T180237Z-24852-917c [duty-menus-4-review] started 2026-10-12T18:02:37.879Z on 05954589 — PASS, exit 0, 5744 passed, 0 failed, 591 skipped, 304/304 suites`
  The range changes no code and no test, so the green run means no regression.
- [x] `npm run test:playwright`: not applicable (no UI).
- [x] `bash scripts/harness-lint.sh | tail -1`: `harness-lint: clean (0 violations)`. I ran it before writing anything,
  and again with this review, the story's status and the ledger edits in place.
- [x] _Lint, typecheck and build are not configured, so they were skipped._
- [x] **The ADR's gate grep** (Implementation notes) over the four drafts finds 0 lines at HEAD. At `b13bb6b5` it
  found 11 (Treasure Maps 2, Duty Menus 9).
- [x] **`grep -n replaceable protocols/drafts/duty-menus.md`** finds only :169 (step 1's `10002`), :252 (§ 8.1's NIP-01
  clauses) and :292 (§ 11's NIP-09 quotation), as KB-3 asks.
- [x] **Scope.** `git diff --stat b13bb6b5 05954589 -- protocols/` touches the four drafts and `README.md` only.
- [x] **Links.** All 98 relative links in the four drafts, the README, the handoff and the story resolve, with their
  anchors. I checked them with a script (`rv-s4/reviewer/links.py`), and 0 failed.
- [x] **Vocabulary (AC6).** The added lines of the scoped diff contain no "canonical", "consensus" or "root" as a word.
  The only hits in story 4's commits are ADR 0004 lines that state the ban itself.
- [x] **Citations in spec bodies.** In the added spec lines outside the `>` metadata blocks, a grep finds no ADR,
  story, A1-, handoff, `engineering-team`, ledger or `brainstorm.world`.
- [x] **ADR text carried verbatim.** All 23 lines of the Decision's `text` blocks appear in the drafts (script
  `rv-s4/reviewer/verbatim.py`). I read each "→" replacement against the word-diff, and every one is in, with two
  exceptions, each as KB-3 intends:
  - sub-decision 9's finding-15 text for § 8.1, which KB-3 supersedes (DM:252);
  - sub-decision 11's Duty Menus Sources clause, "§§ 2, 4, 5, 6.2, 8 and 13.3" (ADR 0004:487–488), which KB-3
    extends with § 11 (ADR 0004:52–53; DM:6).

  KB-1 and KB-2 change lines (TM:504, :39) the Decision gave no "→" text for, so they add no third exception. ADR
  0003's and the ledger texts were read from their own diffs.
- [x] **External sources** (raw `nostr-protocol/nips` master, fetched today):
  - `01.md:80–82`: the `a` tag refers to "an addressable or replaceable event", with the replaceable form
    `<kind>:<pubkey>:`;
  - `01.md:97`: replaceable kinds `0`, `3` and `10000`–`19999`;
  - `01.md:99`: addressable kinds `30000`–`39999`, with "only the latest event MUST be stored by relays";
  - `01.md:101`: the lowest-id tie rule, "in case of replaceable events";
  - `01.md:103`: "SHOULD return just the latest one", for replaceable events.
- [x] **Model scripts.** All seven exit 0.
  - `m1_grammar`, `m2_menus`, `m3_selfmaps`, `rev1/r1_checks` and `rev2/r2_checks` are byte-identical to their saved
    outputs.
  - `kb/check/glance.py` reproduces V28: 1,528 variants, and 15 that do not cover more (8 + 6 + 1).
  - `s4impl/verify/rederive/row105.py` reproduces V27.

## Claims adherence (docs-mode)

TM is `protocols/drafts/treasure-maps.md`, DM is `duty-menus.md`, AD is `assistant-designation.md`, TL is
`trusted-lists.md` and CC is `content-categories.md`, all at `05954589`.

| # | Claim | Where | Evidence | OK |
|---|---|---|---|---|
| 1 | A replaceable kind is one NIP-01 references by address, with an `a` tag | TM:164 | `01.md:80–82`, `:97`, `:99` | ✓ |
| 2 | That departs from CC's type table and § 4, and from Spawning § 3.2 | TM:164 | CC:23 and CC:193 ("`e`, or `a` if addressable"); spawning.md:64 ("event kind k (non-addressable)" → `30393`) | ✓ (NB4) |
| 3 | Category `39998` takes `30393`, `30394` and `30397` "as Content Categories § 2 gives them" | TM:158–159, :166 | CC § 2's table (:79–86) gives event kinds by id `30393`, by address `30394`, and lists `30397`. CC § 1.3 counts four header kinds | ✓ |
| 4 | A `9998` or `9999` header must be referenced by id | TM:166 | TM § 4.1 :106 (immutable headers as nevent); CC:195 ("`e` if `9998`/`9999`") | ✓ |
| 5 | The Profiles category's slot value is empty (§ 4.3) | TM:182 | TM:150 | ✓ |
| 6 | A Concept `d` is one segment, and § 4.1's and § 4.4's segment rules don't apply to it | TM:190 | § 4.5 (:190) sets aside § 4.1's rule (:103) for the `d`, and the grammar's new `d-tag` (:224) agrees. `m1`: `39998::` is a key (`d` = `:`); `r1`: it beats `39998`, and 580 keys give 0 tied pairs | ✓ |
| 7 | `39998:` and `39999:` are not keys, and readers ignore such an entry as if absent | TM:193; DM:123, :182; AD:64; TL:110–111 | All four texts agree. `m1`: "is `39998:` a key? False" | ✓ |
| 8 | No key reaches a Concept header whose `d` is empty or `dlist-header`, or a kind-`39999` header whose `d` is `duty-menu` | TM:193, :204, :206, :263 | `r1` (rule rev1): the reserved and empty-`d` headers are reached by no key. `r2` (V24): `39999:dlist-header` matches nothing under §§ 4.5 and 4.6 together | ✓ |
| 9 | In § 6, `39999` beats `39998`, and a bare `39998` on a 39999-declared header is the only case where a matching key names a value the insight lacks | TM:282, :285 | V19 (`r1`); V2: 576 keys, 0 tied pairs under the order, 2 under § 6 as it was (`m1`) | ✓ |
| 10 | The third consequence: B gets the kind-`39998` headers and C the 39999-declared ones | TM:313 | V1 (`m1`: `39998:c1` → A, `39999:c1` → B) | ✓ |
| 11 | § 9.2 Ties: "None arise". The self-Map `39998` → Rc, `39999` → Rd is true, and a `39999` self-entry with no 39999-declared duty speaks for none | TM:373 | V13 and V14 (`m3`); V15: 0 of 93,256 self-Maps that were valid under the old Ties become false or barred | ✓ |
| 12 | At a glance: the only exceptions to "covers more" are an empty Profiles category and a Concept `d` (KB-2) | TM:39 | V28 (`glance.py`, my run) | ✓ (NB1 on § 11's sibling sentence) |
| 13 | `30392:tag` and `30382:tag` cover the DList categories of people too; `30382:tag::<Tag>` covers the Profiles category only | TM:500, :503, :504 | V6, V23 and V27 (`m1`, `r1`, `row105`) | ✓ (NB3 on :506) |
| 14 | § 12: a `10002` relay list takes `30394` (§ 4.3) | TM:629 | V16 (`r1`): `30394:tag:10002:T1` → 1 insight; `30393:tag:10002:T1` → 0 | ✓ |
| 15 | § 8.1: "NIP-01 asks this for replaceable events, and this spec asks it for menus, which are addressable" (KB-3) | DM:252 | `01.md:103` and `:99`. The tie clause's NIP-01 attribution (`01.md:101`) is true | ✓ |
| 16 | The menu is one addressable kind-`39999` event (KB-3) | DM:87, :289 | `01.md:99` | ✓ |
| 17 | § 8.2: a reader sends the `#z` filter to Nous' write relays, where every publisher SHOULD send its menu (§ 8.1) | DM:265 | DM:257 | ✓ |
| 18 | Ignored rows take no part in the duplicate check, so `["duty","3038x",""]` then `["duty","3038x","wss://r"]` offers `wss://r` | DM:124 | V10 (`m2`) | ✓ |
| 19 | Step 2: two covering rows never tie, and the same one is the most specific for every insight under K | DM:183 | V9; V12 over 40,000 menus: 0 ties, 0 unstable (`m2`) | ✓ |
| 20 | Step 4: a meet has no key only in the Profiles class, "with a value after it" | DM:187 | V12: all 32 keyless meets are in that class, 0 outside it (`m2`). V21: 0 right meets called keyless (`r1`) | ✓ |
| 21 | Finding 12's example changes nothing under K, but may take `30396:tag:⟨D′⟩:⟨T⟩` outside it | DM:208, :210 | V8 (`m2`: 0 under K, 1 outside, `30396:tag:D2:T1`) | ✓ |
| 22 | § 13.3: K = `39999` is answered by `39998` and gets `wss://concepts.example` | DM:361 | V7 (`m2`), and DM § 13.2's menu (:331–350) | ✓ |
| 23 | Q5–Q7 are resolved by TM § 4.5 and § 6, § 4.3, and § 4.4 | DM:369–371 | Those sections say so (rows 1–9 above) | ✓ |
| 24 | AD's blanket entry and per-DList split, and TL's families sentence, point at TM §§ 4.5–4.6 for what a key covers | AD:38, :64; TL:105–111 | The pointers land on text that says so | ✓ |
| 25 | Implementation: an instance publishes a person's Assistant's menu on request, and reads a key's menu for its check | DM:5; README:73 | `src/api/assistant/dutyMenu.js` (lookup per § 8.1's three places), `src/lib/duty-menu/index.js` (`readMenuRows`, `buildMenuTags`) | ✓ |
| 26 | Handoff: book `assistant-duty-menu` publishes and reads menus; book `assistant-self-map` (open) builds self-Maps | handoff:3 | `audits/assistant-duty-menu/book.md` is Closed; `audits/assistant-self-map/book.md` is Open; intake heading at `_intake.md`:2844 | ✓ |
| 27 | The two new `protocol` rows' line citations | ledger rows | spawning.md:64 and :68; CC:23 and :193; AD:38 and :152, each read | ✓ |

## Spec adherence (acceptance criteria)

| AC | Where it is met | Read as | OK |
|---|---|---|---|
| AC1 bare kinds | TM:192, :454–455, :585 | 1(a): a bare `39998` covers both kinds and a bare `39999` the 39999-declared headers. § 4.5, § 10.1 and § 10.12 say the same | ✓ |
| AC1 order | TM:282, :285, :313 | Check: with `[39998, A]` and `[39999, B]`, exactly one provider for each header kind (V1) | ✓ |
| AC1 colon | TM:193, :218, :224; DM:123 | 2(a): a Map entry, a menu row and a self-entry keyed so are each ignored. § 4.7's `d-tag = 1*OCTET` | ✓ |
| AC1 other specs | AD:38, :64; TL:105–111 | Check: a reader of AD alone, given `39998:`, learns it is not a key. Given a 39999-declared header under a blanket entry, it is sent to TM § 4.5. TL sends the bare kinds to TM § 4.5 | ✓ |
| AC1 Self-Maps | TM:82 (the § 3 clause is gone), :367, :373 (Ties), § 9.2's colon paragraph gone | NB3 check: `{39998 → Rc, 39999 → Rd}` is allowed when each self-entry wins a duty it speaks for. B2 check: `39999:c1` → Rd wins (V13). No self-Map claim becomes false (V15) | ✓ |
| AC1 duty-menu | TM:204 unchanged; :206 added | No key reaches `39999:<A>:duty-menu` (`r1`, rev1) | ✓ |
| AC2 | TM:158–159, :164, :166, :629; DM:169 | 3(a)/(a). `3039x:tag:39998` gives `30393`, `30394` and `30397`. `3039x:tag:10002` gives `30394` in both specs (V5, V11). § 10.10 and § 10.11 still name one list and one Score kind each (V5) | ✓ |
| AC3 | TM:179–186, :500–504, :646–647 | 4(a), all four parts. Checks: `30392:tag::⟨T⟩` does not cover `30392:tag:⟨D⟩:⟨T⟩`; `30392:tag::` is `30392:tag`; no key for every category, and the spec says so (:185); `3039x:tag::⟨T⟩` reaches `30392:tag:⟨D⟩:⟨T⟩` (V6). § 6's table is unchanged and agrees | ✓ |
| AC4 | DM:123, :167–182, :187, :361, :369–371 | The gate grep finds nothing. Q5–Q7 are struck through with pointers, the finding-19 sentence is at :182, and the § 13.3 row matches the AC's 1(a) entry | ✓ |
| AC5 | DM:46 (own key), :50, :94, :96, :106, :124, :129, :183–191, :208–210, :252, :265, :357–359, :367 | Findings 12, 13, 15 (as KB-3 has it), 17, 22, 23 and 24, the "own key" clause and Q3's clause are all in. Finding 23 check: `3038x` is partly offered and `3039x` is not offered as a whole (V20) | ✓ (NB2 on § 5.2) |
| AC6 | Metadata TM:5, DM:5–6, AD:4, TL:4–8; README:65, :73; handoff:3, :14; the ledger rows; story 3 :429–431, :454–455, :461–463, :511–538, :660–662; ADR 0003's two hunks | See "AC6, in detail" | ✓ |

**AC6, in detail:**
- **Ledger.**
  - `2026-10-09-draft-grammar-bare-39999` and `2026-10-11-duty-menus-spec-fold-forwards` are DONE, each with a dated
    note. The second row's title no longer names story 3.
  - `2026-10-12-self-maps-record-loose-ends` is DONE. Items 2 and 3 are in ADR 0003 (`e4b656d8`, `adr:`), item 4 in
    story 3's record (`899253ee`, `story:`), and item 1's line in story 3 (:660). NB9 is on which commit carried that
    line.
  - `2026-10-12-self-maps-spec-fold-forwards` has its story-4 note and its story-5 title, and stays OPEN. NB6 is on
    the addendum that `05954589` put above that note.
  - `2026-10-12-duty-menu-code-cross-book-notes` has its note.
- **Story 3's record.** The A2-4 line now says the departure has ended, with the B2 case worked, and the NB3 line is
  settled.
- **Earlier ADRs.** ADR 0002 is untouched. ADR 0003 has exactly two hunks: item 2's marker split at :1482–1486, and
  item 3's approval line at :2450. ADR 0004 sub-decision 10 records how each of A1-8, A1-9 and A1-10 was answered,
  and that A2's NB10 now means story 5.
- **Metadata and landing lists.** Each spec's Sources line names ADR 0004 for the sections that rest on it. NB5 is on
  Duty Menus' ADR 0003 clause. The README rows, the handoff's Status line and its § 5 landing line all say what AC6
  asks.
- **Shipped code.** The new row `2026-10-12-treasure-map-concept-key-readers` names the differences. Its general
  sentence covers the `39999:<d>` case in words, but its example and fix shape do not (NB7).
- **One place for each wire fact.** What a key matches, and § 6's order, are normative in TM alone. DM, AD and TL
  point at it.
- **Scope.** AD changes only at :4, :38 and :64, and TL only at :4–8 and :103–111. BIBLE, Content Categories,
  Spawning, the older `treasure-map.md`, the epic and the book are untouched. The departures from AC6's scope bullet
  are the two that the owner approved by name at ADR 0004's gate (story § Deviations, ADR answers 2(a) and 3(a)).

## ADR adherence

| Item | Spec | Verdict |
|---|---|---|
| 1 Bare kinds; § 4.6 `dlist-header`; § 5.3; § 10.1; § 10.12 | TM:190–194, :206, :263, :454–455, :585 | ✓ |
| 2 Not a key; § 4.7; § 3 clause and § 9.2 paragraph deleted | TM:193, :218, :224, :82; the § 9.2 paragraph is gone | ✓ |
| 3 § 6 lead, kind-slot sentence, "Apart from that case", third consequence | TM:280–285, :309, :313 | ✓ |
| 4 Meaning and Ties | TM:367, :373 | ✓ |
| 5 AD :38, :64; TL families sentence | AD:38, :64; TL:105–111 | ✓ |
| 6 § 4.3 bullets and two paragraphs; § 12 | TM:158–159, :164, :166, :629 | ✓ |
| 7 § 4.4; § 10.5 :485, :488; § 13 q2, q3 | TM:179–186, :500, :503, :646–647 | ✓ |
| 8 DM § 5.3; step 1 lead, bullets, Concept examples, last bullet; step 2; step 4's meet; § 13.3 row; § 14 | DM:123, :167–182, :183, :187, :361, :369–371 | ✓ |
| 9 Findings 12, 13, 15 (per KB-3), 17, 22, 23, 24; own key; q3 | DM:46, :50, :94, :96, :106, :124, :129, :183–191, :208–210, :252, :265, :357–359, :367 | ✓ |
| 10 Records and supersessions | ADR 0004 text; story 3's record | ✓ |
| 11 Metadata, README, handoff, ledger, loose-ends order | See AC6. The order held in substance, but its commit packaging did not (NB9) | ✓ |
| Clarifications KB-1 to KB-3 | TM:39, :504; DM:6, :87, :252, :289 | ✓ |
| Implementation notes: only the named lines; not-edited list; gates | Diff hunks match the named lines. Not-edited list holds. Gates above | ✓ |

## Deviations, judged

- **The PO's record of ADR 0004's answers** (story :419–429) is accepted. It names the two scope departures the owner
  approved, and no other departure exists.
- **The Implementer's block** (story :431–454) is accepted:
  - line numbers, wrapping, § 8.2's placement and the extra notes in the ledger rows;
  - the loose-ends row flip, which happened after items 2–4 were checked in.
  - The "Commits" bullet (:445–447) says the `story:` commit carries "the PO's text". `899253ee` also carries this
    block and the Implementer's item-1 line in story 3 (NB9).
- **KB-1 to KB-3** are accepted. Each changes wording to agree with a rule approved at the gate:
  - KB-1 follows § 4.4 (V27);
  - KB-2's exceptions are the only ones on the model (V28);
  - KB-3's attribution matches `01.md:99`, `:101` and `:103`.

  They landed in an `adr:` commit of their own, before the next `impl:` commit. The record does not name who chose
  option (a) for each one (Harness friction 2).
- **The two items `05954589` added to the self-maps row** are not in the ADR or in the story's Deviations (NB6).

## Verification cases, re-derived

I worked each V case by hand from the drafts at `05954589`. Where a script covers the case, my run of it agrees, and
the outputs are byte-identical to the saved ones.

| Case | Expected | Re-derived from the specs | OK |
|---|---|---|---|
| V1, V2 | One provider per header kind; 0 ties over 576 keys | TM:282 orders the kind slot, and TM:285 names the one off-value case | ✓ |
| V3, V4 | Bare kinds as AC1; `39998:` not a key; `39998::` a key; `[39998:,X],[*,Y]` → Y | TM:190–193 | ✓ |
| V5 | `3039x:tag:39998` → 3 List kinds; `3039x:tag:10002` → `30394` | TM:158–159, :164, :166 | ✓ |
| V6, V23 | The Profiles category | TM:182–186 | ✓ |
| V7 | § 13.3's six rows | DM:355–361, with § 13.2's menu | ✓ |
| V8–V11 | Findings 12, 13, 17, 18 | DM:208–210, :183, :124, :169 | ✓ |
| V12 | 40,000 menus, 0 failures; 32 keyless meets, all in the Profiles class | `m2` | ✓ |
| V13–V15 | B2; NB3's table; 0 of 93,256 | TM:373 with § 6 | ✓ |
| V16, V17 | § 12's old `30393` keys match nothing; a `3039x:tag` self-entry and Spawning's one-kind spawn | TM:629 now says `30394`. Spawning's two rows go to the protocol row | ✓ |
| V18, V19 | Reserved and empty-`d` headers are reached by no key; the only off-value pair | TM:193, :206; `r1` | ✓ |
| V20, V21 | One term per K; no right meet called keyless | DM:184, :187, :190–191 | ✓ |
| V22, V24, V25 | Shipped `conceptCurator`, `classifyEntry` and TA discovery | My node runs: Case A → TA "catch-all", Case B → local. `r2`: TA discovery reads two ways | ✓ |
| V26 | Only the code row names a code difference | The two protocol rows name spec questions | ✓ |
| V27–V29 | KB-1, KB-2, KB-3 | `row105`, `glance`, NIP-01 | ✓ |
| *Added:* `[39998:dlist-header, TA]`, `[39999:c1, B]`, header `39999:B:c1` | § 6 gives B | TM:282: `39999:c1` beats `39998`. The shipped `conceptCurator` gives TA (NB7) | ✓ spec |

## Scope

- **Inside `protocols/`:** the four drafts and the README, at the lines named.
- **Outside it:** the handoff (:3, :14); story 3 (the record, and item 1's line); ADR 0003 (items 2 and 3); the five
  named ledger rows and three new ones; ADR 0004 and story 4 themselves.
- **Departures:** the two the owner approved (ADR 0004 answers 2(a) and 3(a)). The two items added to the self-maps
  row are a placement question, not a change of scope (NB6).

## Concept-graph integrity

- [x] No handle changes. The only handle in the diff is Nous' `39998:15f7…7270:duty-menu`, unchanged and in
  `kind:pubkey:slug` form.
- [x] No concept definitions changed, so no firmware reinstall is needed (ADR: "No").
- [x] There is no code, so the orient-via-summaries check does not apply. No TA literal was added, and the `LEGACY_*`
  constants are untouched.

## Things tests can't catch

- [x] No secrets, no debug content and no commented-out text.
- [x] No deployment details in spec bodies. The Implementation lines are metadata.
- [x] **The four invariants hold.**
  - **Nothing gates publication.** The new MUST binds readers of a Map; writers get only a SHOULD (TM:193).
  - **Per point of view.** Every key is read over the observer's own Map.
  - **Filter at view time.** Nothing stores a per-POV result.
  - **Local-first.** Nothing discards local state.
- [x] **Edge cases in prose.** No case reads two ways with different results. The coherence items (NB1–NB3) are
  sentences that a careful reader reconciles from the normative text nearby.

## House rules check

- [x] Concept Graph API authority respected (no code).
- [x] No new lint, typecheck or build tooling.
- [x] Vocabulary: no "canonical"/"consensus"/"root" in added text.
- [x] Specs cite specs and NIPs. ADRs appear only in the metadata Sources lines.

## Product-guide adherence

- n/a: no PRD and no UI copy.

## Findings

### Blocking

None.

### Non-blocking

Items 1–5 go to the new ledger row `2026-10-12-key-grammar-review-fold-forwards`, for the PO to place (story 5 or a
later docs pass), and item 6's placement question is item 6 there. Items 7 and 8 go to a dated note on row `2026-10-12-treasure-map-concept-key-readers`. Item 9 goes to
a dated note on meta row `2026-10-11-implementer-edited-accepted-adr`. None changes a rule.

1. **protocols/drafts/treasure-maps.md:606**, § 11 "How many colons?". "Fewer segments, or an empty one, makes a
   scope" is not true of the Profiles category: `30392:tag::⟨Podcaster⟩` is exact (TM:186). It also says "the same for
   every kind", but a Concept key has no system and its `d` may hold colons (TM:190).
   - KB-2 fixed the same claim in At a glance (TM:39), and its other sibling, principle 8 (TM:53), is on the self-maps
     row. This sentence is on no surface.
   - The tension predates story 4: old § 4.4 already said the profiles slot "doesn't count". § 11 is the "format
     questions" section, and § 4.4 governs. (Coherence F1.)
   - *Ask:* give it KB-2's exceptions, or fold it with principle 8.
2. **protocols/drafts/duty-menus.md:113**, § 5.2's gloss "the key does not offer the insights under this key".
   Story 4 made § 2's Offered per insight (DM:50). So with `not-offered 30385` and `duty 30385:rank` → R, the rank
   insights are offered.
   - The next bullet (:114, "takes part in precedence like any row") and step 4 (DM:186–191) settle it, so there is
     one reading. The gloss was per row before story 4 too. (Coherence F2.)
   - *Ask:* "An exception: the insights this row wins (§ 6.2) are not offered."
3. **protocols/drafts/treasure-maps.md:506**, § 10.5 `30382:tag:::<metric>`. Its "my supported Tags for profiles"
   sits two rows below :500 and :503, where story 4 wrote "each category of profiles" for the Profiles category plus
   DLists of people.
   - The key matches the Profiles category only (V23, V27), and KB-1 read :506 by analogy with § 10.6's "for notes".
     But next to :500, an honest reader can take "for profiles" to mean every category. The rule in § 4.4 is clear.
     (Coherence F3.)
   - *Ask:* "…for each Tag in my supported Tags in the Profiles category, except where this Map says otherwise", as
     :504 reads.
4. **protocols/drafts/treasure-maps.md:164**, "Content Categories (its table of category types, and § 4)". CC has
   three tables organized by category type:
   - the opening table (:19–24), the one meant: :23 says "`e`, or `a` if addressable";
   - § 2's list-kind table (:79–86), whose first column is "Category type". It agrees with § 4.3;
   - § 3.1's "Content category types" (:98–117).

   The most natural referent, the table of the "four types" (:17), is right, and § 4 (:193) is unambiguous. So the
   citation is imprecise but not misleading. It is ADR 0004's verbatim text. (Sources SRC-NB1.)
   - *Ask:* "its opening table of the four category types". This can ride with row
     `2026-10-12-addressable-kinds-spawning-content-categories`, which points CC at § 4.3 anyway.
5. **protocols/drafts/duty-menus.md:6**, the Sources line's ADR 0003 clause. It now names step 1's last bullet and § 7,
   as AC6 asked. It still leaves out § 9's pointer to TM § 9.2 Counting Maps, and it names "Amendment A1" only.
   - That pointer came with the owner's NB14 fold under A2 (`fe163bc0`; ADR 0003:2418, :2504).
   - The self-maps row's new item (`ledger/2026-10-12-self-maps-spec-fold-forwards.md`:67–68) says Duty Menus'
     Sources line "lists every section touched". That holds for the ADR 0004 clause, not the ADR 0003 one. AC6 is
     met. (Sources SRC-NB2.)
   - *Ask:* "ADR 0003 with Amendments A1 and A2 (… § 7's own-Assistant exception, § 9's Counting Maps pointer, § 10
     and § 14 follow)", in the same pass as the self-maps row's Sources-line item.
6. **ledger/2026-10-12-self-maps-spec-fold-forwards.md:62–68**, the addendum from `05954589`. It adds two items to the
   row the owner gave story 5 to close: principle 8's gloss, and aligning Treasure Maps' Sources line with At a glance.
   It marks them "for story 5 or a later docs pass".
   - Book frame bullet 6 (`audits/duty-menus-and-self-maps/book.md`:30) and the epic's story-5 entry
     (`epics/duty-menus-and-self-maps.md`:42) define story 5 by an item list, and say the row closes with it. If
     either item goes to a later pass, story 5 cannot close the row. If it goes to story 5, that widens story 5 past
     the owner's list.
   - The addendum sits above the older dated notes (:75, :84), and the row's own story-4 note (:112) still lists
     only the owner's items. Story 4's Deviations do not mention it.
   - No AC is unmet: AC6 asked for the note at :103–114, and it is there. (Conformance NB-1, intent OWN-3.)
   - *Ask (PO, at story 5's planning):* move the two items to a row of their own, such as this review's new row, so
     that story 5 can close the self-maps row as the frame says. Or take them into story 5 with the owner's OK. Place
     the bullet in date order.
7. **ledger/2026-10-12-treasure-map-concept-key-readers.md:23–26, :31–32, :45–48**, the code row's
   `conceptCurator` lines. `conceptCurator` (`ui/src/utils/treasureMap.js`:229) assigns only from `e.kind === 39998`
   entries, so it ignores every `39999:<d>` entry. My node run (`rv-s4/reviewer/code/cc.mjs`) gives:
   - `[["39998:dlist-header", TA], ["39999:c1", B]]` with coord `39999:B:c1` → TA, "catch-all". § 6 now gives B.
     Before story 4 these two keys tied (V2), so story 4 created this difference;
   - `[["39999:c1", B]]` alone → the local Assistant. § 4.5 gives B, before and after story 4, so this one is older;
   - the `39998:c1` version of the first case → B, "assigned", which agrees with § 6.

   The row's general sentence ("where § 6 gives it to a `39999` entry") covers the first case in words. Its Case A
   example and its fix shape ("follows § 6 for the bare kinds") name only the bare `39999`. The Older bullet's
   "(§ 4.5's legacy spelling)" reads as if the bare `39998` were the legacy spelling; the legacy spelling is
   `39998:dlist-header`. (Conformance NB-3, intent OWN-1.)
   - *Done here:* a dated note on the row with both cases and the wider fix shape: `conceptCurator` follows § 6 for
     every Concept key, `39999:<d>` included.
8. **ledger/2026-10-12-treasure-map-concept-key-readers.md:20–22**, the `roleOf` bullet. My node run
   (`rv-s4/reviewer/code/role.mjs`) shows `entryRole('concepts', …)` returns "individual" for `39998:`, `39999:`,
   `39999:dlist-header` and `39999:duty-menu`. `individualDuties` lists all four, so the override switch counts and
   removes duties that §§ 4.5 and 4.6 say do not exist (`ui/src/pages/treasure-map/editTreasureMap.js`:36).
   - The row names only `39998:`. Its fix shape, through `entryOf` and `appliesTo`, would correct all four.
     (Intent OWN-2.)
   - *Done here:* the same dated note names the other three: `39999:` and `39999:dlist-header` created by story 4,
     and `39999:duty-menu` older.
9. **engineering-team/stories/duty-menus-and-self-maps/4-treasure-map-key-grammar.md:445–447**, the "Commits" bullet,
   with commit `899253ee`.
   - ADR 0004 asks for the PO's edits "in a `story:` commit of their own", and for the Implementer's item-1 line "after
     the PO's `story:` commit" (sub-decision 11; Implementation notes).
   - `899253ee` (`story:`) carries the PO's text, the Implementer's Deviations block and the Implementer's item-1 line
     in story 3 (:660–662). `ae888a7e` (`impl:`) does not touch story 3.
   - The text is right, and the loose-ends check holds. Only which role the history credits is off.
     (Conformance NB-2.)
   - *Ask:* none on history; this review records it. Harness friction 1.

### Harness friction

1. **Commit packaging recurred.** The Implementer's lines landed in the PO's `story:` commit (NB9). This is the
   commit-packaging case of meta row `2026-10-11-implementer-edited-accepted-adr`, and I appended a dated note there.
2. **An accepted ADR gained a section after acceptance, and the record names no approver.** ADR 0004's
   "Clarifications after acceptance" (`0311cca3`) answers the Implementer's three kick-backs, "each by option (a)".
   It does not say who chose (a). ADR 0003's amendments, by contrast, went through owner gates.
   - Each one changes no rule (verified above), and it landed in its own `adr:` commit before the next `impl:`, as
     that row's fix shape (b) asks.
   - The gap is the one row `2026-10-08-new-browser-spec-amendments-unratified` names for test plans: who ratifies a
     no-rule-change amendment. The same dated note records it.
3. **Known items, no new rows:**
   - The first dispatch held the commit, against `workflows/5-review.md`
     (`2026-10-11-reviewer-dispatch-tools-and-commit`). The review is committed after the independent check.
   - The template's "On PASS" heading reads as a verdict (`2026-10-07-on-pass-heading-reads-as-verdict`), so the last
     section here is "Close-out".
   - The template's docs-mode filename note (`2026-10-10-review-template-docs-mode-filename`).
   - The template says completion detection's result is recorded in the chat, never in the review file. Story 3's
     round-2 review recorded it in the file. This review follows the template.
4. **Story 3's round-1 friction 3 (script output that varies between runs) did not recur.** All seven scripts
   printed byte-identical output.

## Independent check

A read-only checker (scratch under `rv-s4/checker/`) re-ran the gate status line (run on `05954589`, `dirty: false`,
304/304 suites), harness-lint, the ADR's gate grep (0 at HEAD, 11 at `b13bb6b5`), the `replaceable` grep, the
verbatim, link (99 with the story's new link) and vocabulary checks, NIP-01's lines, and the models (`m1`, `r1`,
`glance`). It spot-checked claims rows 2–5, 7, 14, 15, 17 and 25–27, ADR items 5, 6, 8 and 11, story 3's lines and
the CC, Spawning and AD lines, and reproduced NB7, NB8 and NB9 from the source. It confirmed that all 11 auditor
findings are carried, none of them blocking, and that the verdict and completion detection stand. It raised two
non-blocking findings in this file. I checked each against the sources before using it:

- **CHK-1** (Quality gates, "ADR text carried verbatim"): the text said "two exceptions" and named one. Confirmed:
  DM:6 reads "§§ 2, 4, 5, 6.2, 8, 11 and 13.3", against sub-decision 11's "8 and 13.3" (ADR 0004:487–488) and KB-3's
  replacement (ADR 0004:52–53). *Fixed:* both exceptions are named.
- **CHK-2** (claims row 6): the evidence said § 4.5's one-segment `d` "agrees with TM:103". TM:103 is § 4.1's "A
  segment never contains `:`", the rule TM:190 sets aside. *Fixed:* the row says :190 sets :103 aside for the `d`.
  The checker's suggested wording was checked as a fresh claim: a re-run of `r1` is byte-identical to the saved
  output, with `39998::` beating `39998` (1 = beats) and 0 tied pairs over 580 keys; `m1` shows `39998::` is a key
  only, so the row now credits each script with its own part.

Neither finding touches a spec, the story, the ADR or a ledger row, and neither changes the verdict.

## Verdict
**PASS**

Story 4 settles A1-8, A1-9 and A1-10 in Treasure Maps as the owner answered, and Duty Menus, Assistant Designation and
Trusted Lists now point at it. ADR 0004 and KB-1 to KB-3 are carried verbatim, every AC and V case re-derives from the
specs and the reproduced models, and the gate is green. The nine non-blocking items are wording, metadata and ledger
precision, each with a surface.

## Close-out

- The story's `**Status:**` is now `Done`, set in place, and its Linked artifacts name this review. No file moves
  (retirement is per epic).
- Completion detection was run against `audits/duty-menus-and-self-maps/book.md`. The result is reported with this
  review's return, not recorded here (template).
- Ledger:
  - a new row, `2026-10-12-key-grammar-review-fold-forwards` (NB1–NB5, with NB6's placement question);
  - a dated note on `2026-10-12-treasure-map-concept-key-readers` (NB7, NB8);
  - a dated note on `2026-10-11-implementer-edited-accepted-adr` (NB9; Harness friction 1 and 2).
- Committed after the independent check, in one review commit with the story's status and the ledger edits. Not
  pushed.
