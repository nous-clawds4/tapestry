# Review: Story 3 — Self-Maps

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-12
**Diff:** `git diff 57fbb432 8a9a420d -- protocols/ engineering-team/stories/duty-menus-and-self-maps/3-self-maps.md engineering-team/epics/duty-menus-and-self-maps.md engineering-team/stories/_intake.md docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md ledger/`.
- Story 3's commits:
  - `05225a6b`: the first pass, and fixes 1–3.
  - `fc4d55ab`: ADR 0003 A1 proposed, and the PO's record.
  - `bc37a62c`: A1 applied, and fixes 4–7.
  - `8a9a420d`: the owner confirms A1-4's AC3 departure.
- The range's other commits belong to books `assistant-duty-menu` and `assistant-shared-categories`. Checked commit by
  commit, none of them touches `protocols/`, this story, ADR 0003, the handoff, the intake entry or this epic.

**Mode:** docs-mode (Protocol-Spec workflow). Test Design was skipped, so there is no test plan. This review audits the
accuracy and consistency of the spec prose, and the gate is a regression check only.

**Inputs:**
- story `stories/duty-menus-and-self-maps/3-self-maps.md` (Approved; owner answers 1a–5a; § Deviations, with the PO's
  record);
- ADR `decisions/duty-menus-and-self-maps/0003-self-maps.md` (Accepted; owner answers 1a–4a; Amendment A1 approved
  2026-10-11; A1-4's AC3 departure confirmed by name);
- background: ADR 0002, the handoff, `audits/duty-menus-and-self-maps/book.md` and the epic.

**Filename note:** this is a storied docs-mode story, so it has ACs and uses the numbered filename. That is the known
template defect `ledger/2026-10-10-review-template-docs-mode-filename.md`.

**Method:**
- I read the three drafts at HEAD in full, against the diff and against ADR 0003's Decision, Implementation notes and A1.
- I re-ran all 22 cited model scripts myself, with `python3 -I` from each script's own directory, into
  `scratchpad/rv-s3/reviewer/runs/`.
- I fetched NIP-01, 09, 40, 65 and 85 with curl through the proxy.
- Five auditor lenses (re-derivation, sources, conformance, coherence, intent) reported 29 findings. I checked each
  one against the sources before using it: C1 is blocking (B1, with S4 folded in), RD-1 is blocking (B2, after the
  independent check below), and the rest are merged into the non-blocking list.
- **An independent check was applied.** A separate checker audited this review before commit and reported seven
  findings (CK-1 to CK-7). I re-verified each against the sources and my own runs (new scratch only under
  `scratchpad/rv-s3/finalize/`), found all seven right, and corrected the review: B1's impact (CK-1), NB2 promoted to
  blocking B2 (CK-2), fix 7's citation (CK-3), the reproducibility tally (CK-4), NB10's ask (CK-5), NB4's count
  (CK-6) and the cross-book row's title (CK-7). The verdict was already CHANGES_REQUESTED and stays so.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test`, run as `GATE_LABEL=duty-menus-3-review npm test` on a clean tree at `8a9a420d`. `npm run -s gate:status -- --label duty-menus-3-review` reports:
  `20261012T004348Z-29738-6124 [duty-menus-3-review] started 2026-10-12T00:43:48.151Z on 8a9a420d — PASS, exit 0, 5720 passed, 0 failed, 591 skipped, 303/303 suites`
  The diff touches no code and no test, so the green run means no regression.
- [x] `npm run test:playwright`: not applicable (no UI).
- [x] `bash scripts/harness-lint.sh | tail -1`: `harness-lint: clean (0 violations)`. I ran it before writing anything,
  and again with this review and its ledger rows in place.
- [x] _Lint, typecheck and build are not configured, so they were skipped._
- [x] **Links.** 63 relative links in the three drafts, the handoff and the story resolve, with their `#` anchors
  (`#2-terms`, `trusted-lists.md#common-wire-shape`, and others). I checked them with a script, and 0 failed.
- [x] **Vocabulary (AC8).** The added lines of the scoped diff (`05225a6b^..8a9a420d`) contain no
  "canonical"/"consensus", and no "root" as a word.
- [x] **Citations in spec bodies.** In added spec lines outside the `>` metadata block, a grep finds no
  ADR/story/A1-/handoff/`engineering-team`/ledger/`brainstorm.world`.
- [x] **External sources** (raw `nostr-protocol/nips` master):
  - `85.md:115`: `<relay hint>`.
  - `85.md:137`: "only if the contents of each event actually change".
  - `85.md:39`: a key per user only "when the algorithm is personalized".
  - `85.md:109`: `.content`, NIP-44.
  - `01.md:101`: lowest id on a tie.
  - `65.md:27`: write relays.
  - `09.md:35`: the `a` "up to the `created_at`".
  - NIP-40's `expiration`.
- [x] **Model scripts.** All 22 exit 0, and every figure the ADR cites reproduces: every count value matches the
  saved `.out` files. Whole-file comparison is run-dependent, because at least five scripts print dict or set
  orderings that vary between runs:
  - in my run, 18 outputs were byte-identical; `a1` was among them, but the checker's run of it differs at line 11
    (the named partial-move case prints its two keys in the other order);
  - `m2_order` and `r2/m2s` differ in an example line;
  - `r1/m3r` (line 41) and `r2/m3s` (lines 29–31) differ in the order of a dict printed inside a count line, with
    every count equal.

## Claims adherence (docs-mode)

TM is `protocols/drafts/treasure-maps.md`, DM is `duty-menus.md`, and AD is `assistant-designation.md`, all at
`8a9a420d`.

| # | Claim | Where | Evidence | OK |
|---|---|---|---|---|
| 1 | Element 3 is what NIP-85 calls a relay hint | TM:78 | `85.md:115`, `["<kind:tag>", "<service key>", "<relay hint>"]`. | ✓ |
| 2 | The fallback's last step is A's kind 10002 write relays | TM:88 | `65.md:27`: "clients SHOULD use the **write** relays of that user". | ✓ |
| 3 | Storefront rows say where per-customer keys publish, not the storefront key | TM:94 | DM:244–245. | ✓ |
| 4 | Rows in a service's record say, as a published menu's do, where A's insights will be published | TM:82 | DM:105 (§ 5.1). | ✓ |
| 5 | DM § 4 reserves `duty-menu` as the `d` of a kind-39999 menu | TM:190 | DM:95. | ✓ |
| 6 | One key may serve several observers, "as NIP-85 allows for an algorithm that is not personalized" | TM:353 | `85.md:39`. | ✓ (NB7 on TM:329) |
| 7 | What such a key's self-entries speak for is open "with the other questions about such keys (DM § 14 Q3)" | TM:353 | DM:372 asks only about storefront rows. ADR AC2 mandates the citation. | ✓ (NB8) |
| 8 | § 6 does not yet order a bare `39998` and a `39999` key (DM § 14 Q5) | TM:357 | TM:265–268: two different exact kinds have no rank. DM:374 holds the order open. | ✓ |
| 9 | NIP-01 keeps the lowest id when two versions share a `created_at` | TM:389, :401 | `01.md:101` ("should be retained"). | ✓ |
| 10 | Lists are retracted "by the retraction convention" | TM:393 | trusted-lists.md:71–73 defines the marker for "a list that no longer has members (or is being migrated off a kind)". TM uses it for any List A "stops maintaining", including one A is still asked to publish. | **✗ B1** |
| 11 | Published Score values stay on relays (§ 9, Revocation) | TM:394 | TM:333. | ✓ |
| 12 | A curated header and its `b` stay (AD, Revocation) | TM:395 | AD:84 ("The header and its `b` remain on relays"). | ✓ |
| 13 | Curation copies "follow AD § Curation copies" | TM:395 | AD:96–112 has no rule for a stop. | ✓ (NB10) |
| 14 | NIP-85 asks providers to republish only on change | TM:405 | `85.md:137`. | ✓ |
| 15 | The TA's kind 10040 is the instance's own Map, the instance being its own person | TM:422 | AD:167–169 ("the Tapestry instance is its own person whose key is the TA"). | ✓ |
| 16 | Private entries are NIP-85's `.content` entries | TM:376, :425 | `85.md:109`. | ✓ |
| 17 | Whether private duties may go in a self-Map's `.content` is "§ 13, question 8" | TM:376 | TM:637 does not pose it. W22 is Closed (worksheet.md:260). | ✓ (NB9) |
| 18 | `expiration` is NIP-40's | TM:378 | NIP-40. | ✓ |
| 19 | Header declaration by `["z","list"]` or a `z` to a `concept-header` (DLHD § 2), and DLHD § 6's migration exception | DM:151, :153 | dlist-header-declaration.md:25–39 (both forms), :101–103 (§ 6's MAY for known firmware kinds). | ✓ |
| 20 | TM § 3 asks for the self-entry first (SHOULD) and lets the service read its record (MAY) | DM:201 | TM:82: the levels match. | ✓ |
| 21 | A's own word is its self-entry keyed K or what step 5 gives; a guess is not | DM:232 | TM:82 (the MAY). Its examples include "a relay the Map gives A for another key", which settles answer 3(a). | ✓ |
| 22 | The guarantee covers "an entry filled from A's menu"; a reader may still miss a part ("Fewer relays") | DM:224, :226 | DM:201 (a client that takes the self-entry's relay does not fill from the menu); DM:260. | ✓ |
| 23 | Q4 resolved: TM § 3 | DM:373 | TM:84–97. | ✓ |
| 24 | A triple naming its own author designates no one (Authorship; TM § 9) | AD:32 | AD:52; TM:330. | ✓ |
| 25 | Q5 and Q7 were settled on 2026-10-10 (story 2, Out of scope) | handoff:19–21 | Story 2 :76–78. | ✓ |
| 26 | Every Map entry "names who is asked to publish" | TM:80 | Read for a self-entry, this clashes with TM:330. § 9's specific rule governs. | ✓ (NB6) |

## Spec adherence (acceptance criteria, read as the PO's record says)

| AC | Where it is met | Read as | OK |
|---|---|---|---|
| AC1 | TM:330 (self-entries; "judges element 2 against the Map's author first"); :331 ("An entry other than a self-entry"); principle 2 :47; § 13 Q5 :634; Counting Maps :425 | Answer 5(a): the own-Assistant-for-everything person is left out, and the spec says so. | ✓ |
| AC2 | § 9.2 terms :349; meaning :351; content :359–380; timing :384–389; per family :393–395; no expiration :378; more than one relay :365–368; mutual pointers :427 ↔ DM:290 | "Copied verbatim" per the PO record (ADR 0003 A1-3). AC2 asked for "the existing retraction convention" for Lists, and :393 has it. B1 is about what a *reader* does with it. | ✓ |
| AC3 | Confirmed duties :403; § 7 :306; Maintained :405 with § 7 :304; Spot-check :407; § 3 :80; As a point of view :409 | The A1-4 departure is confirmed by name (story :502–509). "Only that key's slice" per the record. A second, provisional departure under Ties is unnamed: a self-entry keyed as the observer's entry that ties with a bare `39998` confirms nothing, though AC3's "the same key" confirms it (B2). | **✗ until the Ties departure is named (B2)** |
| AC4 | § 3 :78–97 (hint, trigger, three steps, "skipping any it has already asked", "does not end the search", per insight, read-time, storefront clause, enumeration, closing pointer); § 7 :304–305; DM step 5 levels :202–235; DM:373 | The four cases and the order re-derive (table below). `grep "does not yet define\|Treasure Maps does not yet"` on DM finds nothing. | ✓ |
| AC5 | TM:82 (SHOULD; key comparison; `39998:`/`39999:`; the service's MAY; A1-2); DM:163 (in principle); DM:200–235 | Answer 2(a): "the two specs agree". The three conforming differences are listed in the record. The no-menu reading includes ADR 0003 A1-4's blank self-entry. | ✓ |
| AC6 | TM:190–192, :248; DM:90 (A1-8), :95, :145–153, :188 | Answer 1(a). The reservation is in DM alone, and the key rule in TM alone. | ✓ |
| AC7 | AD:52, :32 (A1-9); TM:422–423; DM:46, :245 (link to `#2-terms`), :372 | A1-9's departure from "the rest … is unchanged" was owner-approved by name with A1 (story :510–514). | ✓ |
| AC8 | Intake `_intake.md`:2844–2886; handoff :3–24; ledger notes in `2026-10-09-draft-grammar-bare-39999`, `2026-10-10-external-assistant-relay-left-empty` and `2026-10-11-duty-menus-spec-fold-forwards`; epic :34 | See "AC8, in detail" below. | ✓ |

**AC8, in detail:**
- **The fenced blocks are verbatim.** The intake entry, the handoff block, and two of the three ledger notes match
  ADR 0003's fenced blocks byte for byte (script). The bare-39999 note adds fix 2's recorded clause.
- **The intake entry** starts at column 0 and sits at the end of the file. `/whats-open` lists it under "No PICKED UP",
  and no longer lists the handoff among the 🔴 OPEN handoffs.
- **The handoff.** Its only `Status:` line carries "SUPERSEDED" and "NOT built", and no 🔴.
- **The ledger rows** all stay OPEN.
- **Untouched files.** In the range, ADR 0002, `protocols/README.md`, OPEN.md and book.md are unchanged.
- **Stale text.** Some of this tracking text is now stale because of another book's code (NB17).

## ADR adherence

| Item | Spec | Verdict |
|---|---|---|
| 1 Self-entries create no duty; the order is spelled out in both bullets; principle 2 | TM:330–331, :47 | ✓ |
| 2 Terms, meaning, speaks for (with the D5/N3 sentences), what a reader can tell, ties | TM:349–357. Fix 7 adds the blank-relay sentence to Meaning (judged below). | ✓ |
| 3 Its key (A1-3), its relay (A1-1, A1-4), more than one relay (A1-3) with both examples, the MUST NOT with § 13.2's example, no order or copies, private duties (A1-5), no expiration, Concept kind and a colon | TM:359–380 | ✓ |
| 4 Timing with levels, the move, `created_at`; per family; finding a self-Map | TM:384–401. The Lists rule is ADR text verbatim. B1 is the reader-side gap it leaves. | ✓ (B1) |
| 5 Confirmed duty, confirmed Alternate, maintained at its relay, spot-check, point of view (§ 2 clause), the allowance's four cases and the multi-observer sentence | TM:403–418, :306, :57 | ✓ (NB1) |
| 6 § 3: hint, not a promise, the fallback with its trigger, per insight, read-time, storefront rows, enumeration; § 5 lead; principle 1 | TM:78–97, :214, :46 | ✓ |
| 7 § 7: the fallback sentences, each provider in turn, "first provider, in order" | TM:304–305 | ✓ |
| 8 § 3 Filling element 3 (SHOULD; key comparison; the service's MAY; A1-2's last sentence; A1-4) | TM:82 | ✓ |
| 9 DM § 6.2 lead; step 1 pointer; step 5 lead (A1-2, A1-4 phrases), levels table, guarantee (A1-7), No guess, No menu found; Q4 | DM:163, :188, :200–235, :373 | ✓ |
| 10 § 4.6 `duty-menu` paragraphs; § 5.3 pointer | TM:190–192, :248 | ✓ |
| 11 DM § 6.1 fifth condition, "when, and only when", the sentences after | DM:145–153 | ✓ |
| 12 Keys the observer runs; AD § Authorship; DM § 2 definition (no § 9.2 pointer); § 7 link; Q3 clause | TM:420–423; AD:52; DM:46, :245, :372 | ✓ |
| 13 Counting Maps | TM:425 | ✓ |
| 14 § 13 Q5 | TM:634 | ✓ |
| 15 Bookkeeping (intake, handoff, the three ledger notes, epic :34, ADR 0002 untouched) | See AC8 | ✓ |
| Implementation notes: § 9.2 paragraph order; untouched sections | The § 9.2 order matches items 1–7. The diff touches only TM §§ 1, 2, 3, 4.6, 5 lead, 5.3, 7, 9, 9.2 and 13. DM §§ 5.1, 5.3, steps 1–4 (except the lead and step 1's last bullet), 8 and Q5–7 are untouched. | ✓ |
| A1-1 to A1-9 | All 12 A1 block quotes appear verbatim in the drafts (script). The A1 metadata Sources lines are at TM:5, DM:6 and AD:4. | ✓ |

## Deviations, judged

- **The Implementer's first block** (story :330–359) is accepted:
  - the § 9.2 lead, the notation sentence and the examples (each one re-derives below);
  - the Ties paragraph;
  - "(TA)";
  - dropping the "This refines" sentence, because § 7 :304 now carries the allowance;
  - the storefront bullet;
  - the `#common-wire-shape` anchor;
  - No guess as its own bullet;
  - "No menu found"'s "if the observer keeps K for A", the levels table's condition;
  - the placement of the in-principle paragraph;
  - the metadata Sources lines;
  - the blank line in the handoff.
- **Fix 1** (story :361–392) is accepted, item by item:
  - **Automatic fills.** Scoping step 5's MUSTs to automatic fills keeps TM:82's "The observer may write any relay by
    hand" true. A client that fills from the menu is an automatic fill anyway.
  - **"No answering row gives K a relay."** DM:203 reads the same as ADR 0002's proposal, and lets an insisted key's
    shared relay be "what step 5 gives".
  - **The restored bold lead** (DM:207).
  - **Ties points at DM Q5.**
  - **§ 7's "except as § 9 says"** (TM:306), as in principle 2.
- **Fix 2** (the bare-39999 note's extra clause, :396–399) and **fix 3** (bookkeeping) are accepted.
- **The PO's record** (story :419–516) is accepted. Every reading it states matches ADR 0003 and A1's "Not A1's" four
  points, but its AC3 bullet's "has one exception" misses the Ties case, so B2 asks for one more line.
- **Fix 4** (A1 applied, :518–538) is accepted: 12 of 12 quotes are verbatim, and the cited line numbers hold.
- **Fixes 5 and 6** (naming; no draft edit) are accepted.
- **Fix 7** (:563–572) is accepted in substance:
  - Meaning's "A self-entry whose element 3 is the empty string claims nothing (Its relay)" and Confirmed duties' "whose
    element 3 is not the empty string" restate A1-4's approved rule (Its relay's last sentence). A1-4 qualifies
    sub-decision 5's Confirmed duty (ADR 0003:1799–1801), but it does not name Meaning (sub-decision 2), and A1's
    "exact edits" (ADR 0003:2004) give neither paragraph an edit. So the change is right in substance but carries no
    amendment authority or marker (Harness friction 1). (Corrected by the independent check, CK-3.)
  - But the second sentence of Confirmed duties was not carried (NB1), so fix 7's "§ 9.2 no longer says the opposite of
    Its relay" overstates.
  - The block records Architect and PO edits beside its own, with no role named, all in one `impl:` commit
    (Harness friction 1).

## Verification cases, re-derived

Each case was worked by hand from the drafts at `8a9a420d`. Where a script covers the case, my own run of it agrees.

| Case (ADR 0003 Verification) | Expected | Re-derived from the specs | OK |
|---|---|---|---|
| AC1: O drops A for K; A's self-Map still `[K, A, R]` | No duty for K from O | TM:330 says duties come only from observers' Maps, "never from its own Map". TM:387 has A remove the self-entry "as soon as it learns" | ✓ |
| AC1: an entry in A's Map naming A while A serves O | A self-entry, not "someone else's Assistant" | TM:330, "judges element 2 against the Map's author first"; TM:331 opens "other than a self-entry". `m7_enum`: 0 ambiguous combinations with the order, 4 without | ✓ |
| AC1: counting | Not counted: self-only, emptied, all-self person, all-private, empty. Counted: names B publicly, TA's mixed Map, ordinary person | TM:425 public-entry test. `m7_enum`, `r1/m7r` | ✓ |
| AC2: menu `3039x`→R0, `3039x:tag`→R1, O's `3039x` | `3039x`→R0, `3039x:tag`→R1 | Its key (TM:359): `3039x` keeps every insight it wins and speaks for at R0, and the menu gives it R0. The meet `3039x:tag` is answered by its own row, R1 | ✓ |
| AC2: … plus `30396:tag`→R0 | Adds `30396:tag`→R0 | Without it, `3039x:tag`→R1 wins the 30396 Tag lists that A publishes at R0, which the MUST NOT (TM:370) forbids. TM:367 | ✓ |
| AC2: `3039x`→R0, `30396:tag::⟨T⟩`→R1, `3039x:tag:⟨D⟩`→R2, O's `30396` | Adds `30396:tag:⟨D⟩:⟨T⟩`→R1 | The menu gives `30396:tag:⟨D⟩:⟨T⟩` R1 (an exact kind beats a family). Among the meets, `30396:tag:⟨D⟩` beats `30396:tag::⟨T⟩` (a value at the category slot), so R2 is wrong. Writing the meet of the meets fixes it. TM:368 | ✓ |
| AC2: § 13.2 menu, O's `[3038x, A, R]` | `30382`, `30383`, `30384`, `30386`, `30387`→R; no `3038x` | `3038x` would win `30385`, a duty A does not publish, which the MUST NOT forbids. TM:372 | ✓ |
| AC2: menu `*`→R0, `3038x`→R1, O's `*`, with Lists and Concepts given to B | `3038x`→R1, not `*`→R1 | Its relay allows `*` only R0, and `*`→R0 would win the Scores at R1. TM:363; `a13r2` | ✓ |
| AC2: O's `30396:tag`, T2 unpinned | `30396:tag` stays; A retracts T2 lists | The T2 lists leave what the self-entry speaks for (TM:353). TM:393; `m6s` Part A | ✓ |
| AC2: menu `3039x`→R1, O's `3039x:tag`; T2 pinned and `30396:tag:⟨D1⟩:⟨T2⟩` given to B in one save | `3039x:tag`→R1 stays | That insight is not among those the self-entry speaks for, so TM:385's narrowing does not fire. Its key holds over what the self-entry speaks for. `a1` (32 won, 1 not a duty, all spoken-for at R1) | ✓ |
| AC3: TA Map `3038x`→TA R1, `30382:rank`→X R2 | `3038x`→R1 confirms the TA's ranks | TM:351: § 6 among self-entries alone. `m7_enum` | ✓ |
| AC3: `m6_age` S1–S5; `r1/m6r` Parts 1–2; `r2/m6s` Part A | As listed | My run: S1 relay→(A,R1,v2), S2→(A,R1,v1), S3→(A,R,v1), S4→B, S5→(A,R1,v1). Part A gives "A says the list is retracted" with the SHOULD | ✓ |
| AC4: case 1, differing part with a self-entry for K | Asks R0, then R1 | The trigger fires at R0. Step 1 gives R0, already asked. Step 2 answers `30392:tag::⟨T⟩` with `3039x:tag` → R1 | ✓ |
| AC4: case 2, insisted `[3039x, A, ""]` | 30396 at R1, 30393 at R2, 30392 at Rw only | Step 2 answers each exact key. A `not-offered` answer gives nothing, and step 3 follows | ✓ |
| AC4: cases 3 and 4 | Self-entry relay, then Rw | TM:86, :88 | ✓ |
| AC4: order, `[3039x,A,R0]`, `[3039x,B,S0]` | Profiles list tagged T from A at R1 | TM:304: "runs it for each provider in turn". `m2_order` named | ✓ |
| AC4: "No menu, entry relay empty, old copy at A's menu relay R1, current at Rw" | Rw | Read as "no self-Map" (the script's case): step 2's R1 copy is refused (too old, not maintained) and "does not end the search", and step 3 gives Rw. Read as "no menu": step 2 gives nothing, and Rw again. The checklist's wording is inconsistent (NB16) | ✓ |
| AC4: Preferred A, Alternates B and C | B | B's § 3 step 2 (its `3039x:tag` row, S1) runs before C. `r2/m2s`: 8,480 of 8,480 | ✓ |
| AC5: menu `*`→R0, `30382:rank`→R1, self-Map `*`→R0; `30382:rank` given to A | R1 | There is no self-entry keyed `30382:rank`, so the menu's exact row gives R1 | ✓ |
| AC5: menu `*`→R0, `3038x`→R1; B's Lists and Concepts given back | R0 | `*`→R1 is illegal. The keys given back are answered by `*` → R0 | ✓ |
| AC5: insisted `3039x`, rows at R1/R2, then both at R1; then a move | `""`; R1; the two clients differ | DM:229–230 (shared relay, else `""`). TM:361 (no self-entry keyed K when step 5 gives none). A1-1's move clause. `r4/n1` | ✓ |
| AC5: no self-entry, no menu; storefront not own; finding 14's menu | `""` (the service MAY differ); `""`; `""` whatever Tags | DM:235, :163. `m4_principle`: 626 of 16,493 | ✓ |
| AC6: `duty-menu` keys; § 6.1 readers; `39999:duty-menu` | No key reaches it; no menu for every reader; nothing to resolve | TM:192; DM:151 ("whoever its author"); DM:188. `m7_enum` under all four readings | ✓ |
| AC7 / AC8 text checks | As listed | See the AC table | ✓ |
| A1-1: insisted `3039x` with a partial and a full move; O also gives `30396:tag` to B; reverse order | Conforms while moving; narrow first; reverse does not conform | TM:361's last-but-one sentence ("some or all … speaks for", "whatever A's menu now gives its key"). `a1`: 417 of 417 legal, 199 full moves | ✓ |
| A1-2 | Storefront and no-menu person bound by § 9.2 alone | TM:82 last sentence; DM:200 | ✓ |
| A1-3 | `3039x:tag`→R1 stays; :363's `*` fails Its key | `a13r2`: 228/228/220; `a1`: 60 of 207, 143 of 568 | ✓ |
| A1-4: self-Map `*`→R0, `3038x`→`""`; with menu `3038x`→R1 | No Score confirmed; `*` does not take over; fill `""`, or R1 with the menu | TM:361's last sentence, :403. DM:201, :205. `a1`: 2 false confirmations in 2 of 104 if blanks are ignored, 0 under the rule | ✓ |
| A1-5 to A1-9 | As listed | TM:376, :333; DM:224, :90; AD:32. `a1`: 255/7; 202 of 707, 485; 4/2/2 | ✓ |
| *Added:* B1's case. O's `3039x:tag` → [A Preferred, B Alternate]; A's service ends; A removes its self-entry and retracts | — | Two readings: empty until the retraction ages past the reader's limit, or B's list at once (B1) | **✗** |
| *Added:* B2's case. A's self-Map `{* → R0, 39998 → Rc, 39999 → Rd, 39999:c1 → Rd}`, O's `[39999:c1, A]` | AC3: confirmed (the same key) | `39999:c1` ties with `39998` (TM:182, :357), so no self-entry wins c1 and :403 confirms nothing. `rv-s3/rederive/probe/p1_tie_ac3.out` | **✗** |

## Scope

- **Inside `protocols/`**, the range changes exactly the three allowed drafts.
- **Outside it**, story 3's commits change only:
  - the story, the epic and the intake entry;
  - the handoff;
  - the three ledger rows ADR 0003 names;
  - ADR 0003 itself (A1 and its markers, Architect-phase).
- **Untouched:** BIBLE, OPEN.md, README, ADR 0002 and the book file.
- AC8 holds.

## Concept-graph integrity

- [x] The only handle, `39998:15f7dafc…c7270:duty-menu`, is in `kind:pubkey:slug` form and unchanged.
- [x] No concept definitions changed, so no firmware reinstall is needed (ADR: "No").
- [x] There is no code, so the orient-via-summaries check does not apply. The specs carry no TA literal: "the TA" is a
  role, resolved per deployment.

## Things tests can't catch

- [x] No secrets, no debug content and no commented-out text.
- [x] No deployment details in spec bodies (grep above). "An instance's Tapestry Assistant" is Assistant Designation's
  term, not a deployment.
- [x] **The four invariants hold.**
  - **POV-first.** Confirmation, the allowance and counting are each reader's own, per point of view.
  - **Decentralized-first.** Every new MUST binds a key's own claims. § 6.1's fifth condition and the counting rule are
    read-time rules, and nothing gates publication.
  - **Filter at view time.** The fallback is read-time and writes nothing into the Map (TM:93).
  - **Local-first.** Pending requests stay "off the Map" in the person's own state (TM:423), and nothing discards local
    graph state.
- [ ] **Edge cases in prose.** One reachable case reads two ways (B1), and one departs from AC3 without a name (B2).
  The rest are NB1 and NB3–NB16.

## House rules check

- [x] Concept Graph API authority respected (no code).
- [x] No new lint, typecheck or build tooling.
- [x] No TA pubkey literal. The `LEGACY_*` constants are untouched.
- [x] Vocabulary: no "canonical"/"consensus"/"root" in added text.
- [x] Specs cite specs and NIPs. ADRs appear only in the metadata Sources lines.

## Product-guide adherence

- n/a: no PRD and no UI copy.

## Findings

### Blocking

1. **B1 — protocols/drafts/treasure-maps.md:393 with :304 and :84: the specs do not say what a reader does with a List
   that its still-named Preferred provider has retracted, and two honest readings give different results.**
   - **The new state.**
     - § 9.2 now asks a provider to retract "each List it stops maintaining, whatever the reason" (:393). That
       includes the stops at :386: "the service ended, the key was retired, or it can no longer publish it".
     - In those stops the observer's Map still names A. The handoff's own example of such a stop is non-payment
       ("Remove it before upkeep stops (revocation, non-payment, retirement). Then retract Lists", handoff:143–144).
     - Before this story, no spec retracted a List while its provider was still named on the winning key with its
       gates passing: Spawning retires only when a gate fails (spawning.md:28, :170–171).
   - **The case.** O's Map has `["3039x:tag", A, R]` then `["3039x:tag", B, S]`. A's service ends, so A removes its
     self-entry (MUST, :386) and retracts its Lists at R (SHOULD, :393). B is current at S, with a confirmed
     self-entry. A reader of O's Map asks for `30392:tag::⟨T⟩`, and at R it finds A's retraction, a minute old.
   - **Reading 1 (the literal one): an empty list, for a while.** § 7 defines "A copy is accepted when it is no
     older than the reader will accept" (:304), and the retraction is fresh, so it is accepted. "Clients use the
     Preferred provider's insight", so the reader shows an empty list. That lasts until the retraction itself is
     older than the reader accepts. Then nothing counts it as maintained (the allowance at :405 needs "the self-entry
     that wins it", which A removed), § 3's trigger (:84) fires, every relay § 3 asks holds the same aged retraction,
     A's insight "is not found" (:90), and § 7 moves on to B. So the retraction restarts the clock that § 7's
     fallback to B waits on. Two sources support reading the marker as the List's content:
     - Trusted Lists defines the marker as "a list that no longer has members" (trusted-lists.md:71–73).
     - `s3/r2/m6s.py` Part C models a reader that takes the latest version across relays, and that reader uses a
       retraction as the List's content. Part C labels the result wrong in its own case (a move, where A still
       maintains the List elsewhere). It models that reader; it is not ADR 0003's ruling on what a retraction means.
   - **Reading 2: B's list.** The marker means "A no longer maintains this List" (that is the use :393 gives it), so
     A offers no copy of the insight. § 3 finds nothing more from A, and § 7 moves on to B. This reading is also
     supported:
     - It is the handoff's design: "§ 7's fallback already handles 'can't be found'" (handoff:163).
     - It is what an Alternate is for: "standbys that are already up to date" (:306).
     - ADR 0003's own rationale for the Lists rule: "A retraction is A's current word, so a reader that finds it at
       the self-entry's relay reads the List as withdrawn, not stale content" (ADR 0003:469–471). "Withdrawn" leans
       this way, though it does not say what the reader then shows.
   - **Nothing in Treasure Maps picks one.**
     - § 3's trigger list (:84) has no retraction case.
     - :416 says only that a retracted List is not taken as a stale copy that is maintained.
     - The probe `rv-s3/coherence/probe/p3_retraction_read.out` encodes both readings at one fresh age: "A at R:
       RETRACTED []" against "B at S: LIST ['x','y','z']". My aged copy (`rv-s3/finalize/p3_aged.out`, limit 300)
       gives reading 1 A's empty list at retraction ages 5 to 300 and B's list from 301; reading 2 gives B's list at
       every age.
   - Every reader of such a Map is affected, in a reachable state where A did exactly what § 9.2 asks. Before the
     change, A left its last list, and readers moved on to B once that list was older than they accept. Under
     reading 1, A's conforming retraction is newer, so a reader shows an empty list until the retraction itself ages
     past its limit, and only then reads B. The window is bounded, but it is counted from the retraction, not from
     A's last list; under reading 2 there is no window. Auditor finding C1; S4 is the same mismatch seen from the
     citation side. (The independent check corrected an earlier "indefinitely" here, CK-1.)
   - **Asked change.** The rule is ADR 0003 text (sub-decision 4; § 7 in sub-decision 7). So:
     - The Architect picks the reading in an amendment (A2) at the owner's gate, since it adds a reading rule.
     - One sentence then lands in § 7 or in § 3's trigger list. It says whether a List carrying
       `["status","retracted"]` is a copy the reader accepts from that provider. It also says what the marker means in
       Treasure Maps, beside Trusted Lists' "no longer has members".
     - Whichever way it goes, check the rule against four cases:
       - (a) the case above;
       - (b) the observer drops a Tag from its supported sets, and both A and B retract;
       - (c) the allowance's fourth case (:416);
       - (d) a move, which retracts nothing (:388), so stays unaffected.
     - The next round re-derives each case, and any wording taken from this review, as a fresh claim.
2. **B2 — the story's § Deviations, the PO's AC3 bullet (story :502–504), with protocols/drafts/treasure-maps.md:357
   and :403: a second departure from AC3 that no one has named.**
   - **The case.** Take A's self-Map `{* → R0, 39998 → Rc, 39999 → Rd, 39999:c1 → Rd}` and O's `[39999:c1, A]`. The
     bare `39998` "means all of the observer's Concept headers" (TM:182), and § 6 does not order a bare `39998`
     against a `39999` key (Ties, :357). So `39999:c1` ties with `39998`, no self-entry wins c1, and Confirmed duties
     (:403) confirms nothing.
   - **AC3 says otherwise.** Its confirmed duty is an entry naming A "plus a matching self-entry", and matching means
     "the same key, or a key that wins for it under § 6" (story :116–117). The self-entry `39999:c1` has the same key.
     `rv-s3/rederive/probe/p1_tie_ac3.out`: "AC3 literal (same key present): confirmed=True; 9.2 Confirmed duties:
     confirmed=False".
   - **Nothing names it.** The PO's record says AC3 "has one exception (ADR 0003 A1-4)" (story :502–504). ADR 0003's
     departures from the story (:1144) and A1-4's named departure do not include it. The Ties rule itself is
     owner-approved ADR text (ties "claim nothing meanwhile", ADR 0003:1596), so the spec is right to carry it. What
     is missing is the departure's name.
   - **Why it blocks.** It is A1-4's pattern: an approved rule that departs from AC3's words, which this story had the
     owner confirm by name before review (`8a9a420d`). Until it is named, AC3 is unmet. AC3 is about what a reader
     concludes from any self-Map it meets, so it does not matter that the case may need a self-Map that breaks :387
     under NB3's vacuous reading: A1-4's case also needs one that breaks § 9.2 (ADR 0003:1843), and it was named.
     Auditor finding RD-1, filed as non-blocking NB2 until the independent check (CK-2).
   - **Asked change.** No draft edit. The PO adds a line to the record's AC3 bullet: a provisional second exception,
     until story 4 orders the Concept kinds. The owner names it, at A2's gate or on its own.

### Non-blocking

Items 1 and 3–16 are collected, with their fold-forward target, in ledger row
`2026-10-12-self-maps-spec-fold-forwards` (item 2 there points at B2). The fix round MAY fold any of them in. Items that change ADR 0003 text need the Architect's amendment, and the rest go
to story 4, which edits both specs anyway.

1. **protocols/drafts/treasure-maps.md:403**, Confirmed duties, second sentence. "An entry is confirmed for the
   insights a self-entry wins and that the reader takes it to speak for" still covers a self-entry whose element 3 is
   `""`.
   - What a self-entry speaks for turns on its key, not its relay (ADR 0003 A1-4's Why). So, read alone, this sentence
     confirms what the first sentence and Its relay (:361, "confirms no duty") deny.
   - It is reachable only for a self-Map that breaks "never the empty string", and two explicit statements outvote it.
   - *Ask (B1 round):* "for the insights such a self-entry wins …", and correct fix 7's first bullet. (CONF-1, C4.)
2. *Promoted to blocking B2 by the independent check (CK-2).* The number is kept so that the other items and the
   ledger row keep theirs.
3. **protocols/drafts/treasure-maps.md:387 with :357 and :270.** Read vacuously, "MUST NOT add a self-entry that
   speaks for none of the insights it wins" forbids a bare `39999` self-entry whenever a bare `39998` one exists.
   - Under Ties that `39999` self-entry wins nothing. Without it, `39998`→Rc wins the 39999-declared headers that A
     publishes at Rd, against :370.
   - So the `{39998→Rc, 39999→Rd}` self-Map that ADR 0003 sub-decision 2 calls normal is illegal on that reading, and
     only full Concept keys remain.
   - Meanwhile § 6 still says it "always picks one winning key" (:270), and TM § 13 has no question for it.
   - This bears on writers only: no reader is told anything false under either reading. It is provisional, and scoped
     to story 4 by the owner-approved ADR ("ties … claim nothing meanwhile").
   - *Ask:* story 4 checks :387 against its § 6 answer, with row `2026-10-09-draft-grammar-bare-39999`. (C7.)
4. **protocols/drafts/treasure-maps.md:361**, Its relay: "the relay A's menu gives the self-entry's key (Duty Menus
   § 6.2 step 5)". Step 5 gives entries only for keys the observer chooses (DM:200), and gives an unoffered key a
   relay only "if the observer keeps K for A" (DM:203).
   - Read strictly, a self-entry key the observer never chose has no step-5 value. That reaches § 9.2's own nested-row
     example (:367): `3039x:tag` → R1, for the observer's `3039x`, is offered as a whole but was never chosen. So the
     "would give" wording below is the intended reading.
   - `rv-s3/coherence/probe/p1_insisted_selfkey.out` counts a narrower set: 15 of 1,138 build3 self-entries are
     keyed with a key that is neither offered as a whole nor chosen. It leaves out keys like :367's.
   - This bears only on whether a writer conforms, and the example settles it. The strict reading makes A say less,
     never something false.
   - *Ask:* "the relay step 5 would give that key if the observer chose it, and kept it, for A". (C3; the count's
     description corrected by the independent check, CK-6.)
5. **protocols/drafts/treasure-maps.md:353**, What a self-entry speaks for. Two phrases can be read wider than meant:
   - "Read as § 9 has an Assistant read an entry" can be read to import § 9's "limited to the insight kinds and
     systems it can produce" (:327).
   - "An Assistant's self-entries" literally includes a key that serves only itself (§ 2's Assistant).
   - The colon's gloss, § 13.2's example (:372) and the next sentence (with :423) each settle the intended reading.
   - *Optional rewording.* (C2, IN-2.)
6. **protocols/drafts/treasure-maps.md:80.** "A Map entry names who is asked to publish an insight" is unscoped for
   self-entries, unlike principle 2 (:47) and § 7 (:306). § 9 (:330) is specific and governs.
   - *Ask:* "except as § 9 says". (IN-1.)
7. **protocols/drafts/treasure-maps.md:329**, One key per observer. This older text says without qualification that a
   service signs each person's insights with a separate key. § 9.2 now recognises a key that serves several
   observers (:353) and cites this bullet (:409). `85.md:39` requires a key per user only for a personalized
   algorithm.
   - *Ask:* qualify the bullet, tied to DM § 14 Q3. (C6.)
8. **protocols/drafts/duty-menus.md:372**, § 14 Q3. TM:353 sends the self-entry question for a key that serves
   several observers here, but Q3 does not pose it.
   - *Ask:* add one clause. (S3.)
9. **protocols/drafts/treasure-maps.md:376 and :637; handoff:19–21.** Q4 (private duties in a self-Map's
   `.content`) is routed to TM § 13 Q8, DM § 14 Q1 and worksheet W22.
   - Q8 does not ask the question. Its pending clause names "delegation entries", while a self-entry "designates no
     one".
   - DM Q1 is about menus.
   - W22 is Closed (worksheet.md:260).
   - AC8's tracking is met only loosely.
   - *Ask:* one sentence in Q8: "Whether a self-Map may carry private duties in its `.content` is open." (S2.)
10. **protocols/drafts/treasure-maps.md:395.** "Curation copies follow Assistant Designation § Curation copies" points
    at a section with no rule for a stop (AD:96–112).
    - Assistant Designation has no rule for copies when curation stops. Revocation keeps only "The header and its
      `b`" (AD:84), and "deletes the copies it no longer accepts" (AD:98) could be read either way. Saying what
      holds would be new normative text, and :395's sentence is ADR 0003 text.
    - *Ask (Architect, or story 4's ADR):* decide what a stopped Assistant does with its curation copies, keep or
      delete. (C8; the ask corrected by the independent check, CK-5.)
11. **protocols/drafts/treasure-maps.md:95**, Enumerating. The gloss "those of A's self-entries and menu rows that win
    any of them" leaves out step 3's write relays, and does not exclude storefront rows, which step 2 does (:94).
    - *Ask:* "the relays this fallback's three steps give for any of the insights under the key". (C9.)
12. **protocols/drafts/treasure-maps.md:306.** "Alternates are standbys that are already up to date" (older text) now
    sits beside "An Alternate whose duty is confirmed (§ 9.2) is a standby that is ready now".
    - *Optional:* make the first sentence read as intent. (C5.)
13. **protocols/drafts/treasure-maps.md:431 and :214.** § 10's lead ("I entrust …") and § 5's "the observer (the Map's
    author)" read every entry as a designation.
    - *Optional:* one clause for self-entries in § 10's lead. (C10.)
14. **protocols/drafts/duty-menus.md:284**, § 9, "What trusted people do". It counts Maps that name keys linked to a
    storefront, but does not point at TM § 9.2's "A self-entry never counts as its key's choice of a provider".
    - *Ask (story 4):* add the pointer. (IN-7.)
15. **Metadata and landing lists.** Three are incomplete:
    - **Duty Menus' Sources line** (DM:6) omits § 6.2 step 1's last bullet and § 7.
    - **The handoff's § 5 landing line** (handoff:14–15) omits AD § Relationship to NIP-85 (A1-9).
    - **`protocols/README.md`'s Treasure Maps row** does not mention Self-Maps or the fallback. AC8 puts it out of
      reach, so it rides in the ledger row. (S5.)
16. **engineering-team/decisions/duty-menus-and-self-maps/0003-self-maps.md:1480–1481**, Verification AC4's third
    case. It says "No menu", then names "A's menu relay R1". `s3/r1/m6r.py`:93 describes "No self-Map".
    - The answer, Rw, holds under both wordings.
    - *Ask (Architect, with A2):* "No self-Map". (RD-2.)
17. **Cross-book notes: the `assistant-duty-menu` book's code.** None of these is a story-3 defect. The shipped code
    agrees with story 3's wire rules: `isDutyMenu` matches § 6.1's five conditions, and `buildMenuTags` matches § 4's
    `z` rule.
    - Four texts are now partly stale:
      - the handoff's "code NOT built";
      - DM:5's "nothing publishes or reads menus";
      - README:73;
      - the intake entry's steps 1–2 and its Duty Menu placeholder card.
    - The intake entry's reconcile list misses `BRAINSTORM_RELAY_URL`, which the published menu gives for all three
      families (`src/api/assistant/dutyMenu.js`:100–103; `src/lib/duty-menu/index.js`:132–140). `/treasure-map`
      fills from Relay Settings (`ui/src/pages/treasure-map/editTreasureMap.js`:209–215).
    - The intake entry does not point at row `2026-10-11-self-entry-reads-as-another-assistant`.
    - `CONCEPT_HEADER_Z`'s `/i` (`src/lib/duty-menu/index.js`:29) rejects an uppercase-hex `concept-header` `z` that
      § 6.1 would ignore.
    - Collected in the new ledger row `2026-10-12-duty-menu-code-cross-book-notes`. (S1, CONF-3, IN-3 to IN-6, C11.)
18. **ledger/2026-10-11-duty-menus-spec-fold-forwards.md:1.** The title still says "for story 3 to fold in", while its
    note sends most items to story 4. AC8 asked only for the note, so AC8 is met.
    - *Optional:* retitle the row when story 4 is planned. (CONF-4.)

### Harness friction

1. **An `impl:` commit again carried Architect-phase and PO-record edits** (CONF-2).
   - `bc37a62c` changes ADR 0003's status line, "Status of A1", the revision-3 paragraph, A1-4's departure bullet,
     "Named after approval" and "Not A1's". It also changes the PO's record.
   - The story's "Fix 7" block lists those edits beside its own § 9.2 edits, with no role named.
   - No ADR 0003 rule changed, and ADR 0002 is untouched.
   - This recurs `meta` row `2026-10-11-implementer-edited-accepted-adr`. I appended a dated note to that row.
2. **Known items, no new rows:**
   - The dispatch again holds the commit for an independent checker, against `workflows/5-review.md`
     (`2026-10-11-reviewer-dispatch-tools-and-commit`).
   - The template's "On PASS" heading reads as a verdict (`2026-10-07-on-pass-heading-reads-as-verdict`), so the last
     section here is "Close-out".
   - The template's docs-mode filename note (`2026-10-10-review-template-docs-mode-filename`).
3. **Reproducing the model scripts.** At least five of the 22 (`a1` among them) print dict or set orderings that
   vary between runs, in example lines and inside count lines, so a byte comparison with the saved `.out` can fail
   although every count matches.
   - Future reviews should compare the count values, not whole lines or files. This is not a defect (the ADR cites
     only counts), so it gets no row.

## Verdict
**CHANGES_REQUESTED**

Two blockers:
- B1 (`protocols/drafts/treasure-maps.md:393` with `:304` and `:84`). § 9.2 now has a Preferred provider that stops
  (non-payment, retirement) retract its Lists while observers' Maps still name it, and the specs give two readings of
  that retraction: an empty list until the retraction itself is older than the reader accepts, or the Alternate's
  list at once.
- B2 (story :502–504 with `treasure-maps.md:357` and `:403`). Under § 9.2 Ties, a self-entry keyed as the observer's
  entry can confirm nothing where AC3's "the same key" confirms it, and no one has named that departure.

Everything else checks out:
- AC1, AC2 and AC4–AC8 are met as the PO's record reads them, and AC3 is met but for B2;
- ADR 0003 and A1 are carried faithfully (12 of 12 A1 quotes verbatim);
- every Verification case re-derives;
- all 22 scripts reproduce every cited count;
- the gate is green.

The story stays `Approved`.

Asks, in order:
- **The Architect:** ADR 0003 amendment A2 for B1, picking the reading and stating the marker's meaning in Treasure
  Maps (S4). NB3, NB4, NB10 and NB16 may ride in it.
- **The owner:** approve A2 at its gate, and name B2's provisional AC3 departure.
- **The PO:** B2's line in the record, and any revision A2 calls for.
- **The Implementer:**
  - apply A2's exact edits and NB1 (one word, plus fix 7's bullet);
  - optionally fold NB5–NB9 and NB11–NB15 as logged deviations;
  - label the next Deviations block by role;
  - re-run the gates.

## Close-out

- The story's `**Status:**` stays `Approved`. It is not marked Done, and no file moves.
- Completion detection was not run. The book cannot be complete while story 3 is open and story 4 is planned.
- Ledger:
  - new rows `2026-10-12-self-maps-spec-fold-forwards` (NB1 and NB3–NB16; its item 2 points at B2) and
    `2026-10-12-duty-menu-code-cross-book-notes` (NB17);
  - a dated recurrence note appended to `2026-10-11-implementer-edited-accepted-adr`.
- Committed after the independent check (Method), with the story's review link and the ledger rows.
