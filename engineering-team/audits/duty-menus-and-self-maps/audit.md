# Build Audit: Duty Menus and Self-Maps — ratify the specs

**Book:** `engineering-team/audits/duty-menus-and-self-maps/book.md`
**Date:** 2026-10-13 (opened 2026-10-10)
**Branch / commit range:** `eeb2f859^..d234c066` on `staging`. The book's own commits are the 54 whose subject carries
"(duty-menus-and-self-maps", from `eeb2f859` (story 1, with `book.md` and the epic) to `d234c066` (the PO's record of
story 5's owner answers in the epic). The other 127 commits in the range belong to other sessions. Only one of them
touches a file this book delivered: `273d4441` (book `assistant-duties-settings`) rewrote `duty-menus.md`:5, the
Implementation line, documented in its own commit and checked by story 5's review. When this audit was written,
`origin/staging` stood at `91665c4c`, which holds every story, ADR and review of the book. `d234c066` and this close
are local until the close commit is pushed (workflow step 13).
**Provenance:** Acceptance-frame (no PRD). The owner confirmed the frame at kickoff (2026-10-10), added bullet 5 at
story 3's approval (2026-10-11) and bullet 6 at story 4's approval (2026-10-12). Docs-mode under the Protocol-Spec
workflow: the deliverables are `protocols/` prose, with no code, and Test Design was skipped for every story.
**Confidence:** high for the record. Every frame bullet traces to a story whose last review round is PASS, and the
owner approved every gate. The questions the book leaves open are in § 6, among them Treasure Maps § 13 question 13,
which the owner has not confirmed (§ 4 #13). Three limits:
- The specs are 📝 pre-NIP drafts. No one outside this repo has read or implemented them yet.
- Code follows them only in part. Books `assistant-duty-menu` and `assistant-duties-settings` publish and read Duty
  Menus, and `assistant-self-map` (open) builds self-Maps. Some shipped readers take Concept keys otherwise than the
  grammar settled here (§ 5).
- `d234c066` is not yet on `staging` (above).

> The Build Audit is the **as-built record**: what the product *is* now, factual and source-linked. It does not propose
> changes; that is the seed's job. In this book "the product" is a set of protocol specs.

## 1. What shipped

Every bullet of the acceptance frame is met at `d234c066`. Line numbers are as of that commit.

- [x] **The self-pointing `b` is normative.** `protocols/drafts/inherit-from.md` § "The `b` tag", Self-declaration
      (:38): a pointer-typed or untyped `b` whose element 2 is its carrier's own a-coordinate offers the header as a
      shared concept. It is not deference, makes no path and carries no aggregation weight. `shared-concepts.md`
      § Declared affiliation (:39) points at it in one paragraph, with no second normative copy. `amendments-2026-09.md`
      § 3 is struck through "— applied", with an "Applied 2026-10-10" note (:35, :37). Story 1, ADR 0001.
- [x] **The Duty Menus pre-NIP.** `protocols/drafts/duty-menus.md` is new (371 lines, 📝 pre-NIP) and indexed at
      `protocols/README.md`:73. It covers the handoff's D4 (Nous' key publishes the header, § 3), D5 (no price or tier),
      D7 (one key per algorithm), D8 (the name), D9 (Nous' `z` on every menu, § 4), D10 (a self-declared shared header,
      adopted by pointer-`b`), and the handoff's § 4 shapes: the header (§ 3), the item (§ 4), rows (§ 5), storefronts
      (§ 7) and lookup and publishing (§ 8). ADR 0002 changed three of those shapes (§ 4 #1). Story 2, ADR 0002 with
      Amendment A1.
- [x] **Self-Maps in Treasure Maps.** In `protocols/drafts/treasure-maps.md`:
  - § 9: a self-entry creates no duty and designates no one (:346);
  - the new § 9.2 Self-Maps (:361);
  - § 3: element 3 is a hint (:78), with a read-time fallback when the insight is not there (:84–90);
  - § 4.6: `duty-menu` (:202–204), as the owner's answer 1(a) reads "reserved" (§ 4 #4);
  - § 7: a confirmed Alternate is a ready standby (:322);
  - § 13 question 5: an Assistant skips Maps it wrote itself (:649);
  - the counting rule, Counting Maps (:439).

  `assistant-designation.md` § Authorship now says "A TA cannot designate itself on anyone else's behalf" (:52), and
  § Relationship to NIP-85 says that a triple naming its own author designates no one (§ 4 #7). Story 3, ADR 0003
  with Amendments A1 and A2.
- [x] **One place per wire fact; links; the W1 note; the handoff.** Stories 4 and 5's reviews checked that each wire
      fact is normative in one place: Treasure Maps alone holds key matching and § 6's order, and Trusted Lists alone
      holds the retraction marker's meaning, which Spawning points at. At this close the 10 specs and indexes the book
      changed, the handoff, the epic, `book.md`, this audit and the seed hold 235 relative links, and none is broken
      after the epic close-out (§ 8). The W1 note is at `protocols/worksheet.md`:21. The handoff reads ✅ SUPERSEDED
      (`docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md`:3), with a map of where each decision landed.
- [x] **The key grammar is settled (bullet 5).** Treasure Maps § 4.5 says what the bare Concept kinds cover (:188–194),
      § 6 orders them, `39999` before `39998` (:282), § 4.3 gives category `39998` the List kinds `30393`, `30394` and
      `30397` and counts replaceable kinds as addressable (:158–164), and § 4.4 settles the Profiles category slot
      (:182–186). `duty-menus.md` follows: § 5.3, and § 14 questions 5–7 struck through as resolved (:369–371); no
      "provisional" reading is left. Row `2026-10-11-duty-menus-spec-fold-forwards` is DONE. Story 4, ADR 0004.
- [x] **The rules that keep a self-Map true (bullet 6).** Row `2026-10-12-self-maps-spec-fold-forwards` is DONE, and
      its closing note gives each item's landing (`ledger/2026-10-12-self-maps-spec-fold-forwards.md`:116–129). Among
      them:
  - item 10: `assistant-designation.md` § Curation copies, When curation stops (:110), and Revocation (:84);
  - item 19: Trusted Lists' marker bullet (:74–79), Spawning §§ 4 and 5, and Treasure Maps § 7;
  - the § 5.4 question: Enumerate (`treasure-maps.md`:270);
  - Treasure Maps § 9.2, What follows a stop (:405).

  Story 5, ADR 0005.
- [x] **Throughout: no "canonical" or "consensus" in normative text.** At story 5's approval (2026-10-12) the owner
      confirmed that this covers only text the book adds or changes (story 5, Open questions, "Answered by the owner").
      Three lines the book's commits added under `protocols/` and to the handoff contain either word, and none is
      normative: the struck-through original heading of amendments § 3 (:35), the `**Canonical:** not yet published`
      metadata field every draft carries (`duty-menus.md`:3), and the handoff's line saying the rule is worded without
      it (:99). The uses already in `treasure-maps.md` are on row `2026-10-12-treasure-maps-canonical-uses` (§ 6).
- [x] **Done looks like.** Every story's last review round is PASS (§ 2) and on `staging` (`91665c4c`), and the handoff
      is ✅ SUPERSEDED. `d234c066`, which came after story 5's PASS, rides with the close push.

**What the specs now let an implementer do.**
- Find what any Assistant key offers, and on which relay: look up its kind-39999 item at `d` `duty-menu` in the three
  places Duty Menus § 8.1 names, then read its `duty` and `not-offered` rows (§ 5).
- Resolve any Treasure Map key against a menu (Duty Menus § 6.2). This fills an entry's relay for an Assistant the
  instance doesn't run, and never by guessing: an entry with no answering row carries no relay (step 5).
- Tell what an Assistant is actively publishing, not just offering (Treasure Maps § 9.2; Duty Menus § 10): its own
  Map's self-entries. Tell whether an Alternate is a ready standby (§ 7).
- Know where to look when the relay in a Map doesn't hold the insight. Treasure Maps § 3's read-time fallback goes to
  the Assistant's self-Map, then its Duty Menu, then its kind 10002 write relays.
- Count people by their Maps without counting an Assistant's own Map (Counting Maps).
- Read every Concept, category-`39998` and profile key one way (Treasure Maps §§ 4.3–4.6, 6).
- Know what a stopped Assistant does with its curation copies, and what a List's retraction marker means to a reader
  (Assistant Designation; Trusted Lists; Treasure Maps §§ 5.4, 7).

## 2. Epics & stories rolled up

### Epic: `duty-menus-and-self-maps`

| Story | Delivered | Rounds | Review | ADR |
|---|---|---|---|---|
| #1 ratify-self-pointing-b | The self-pointing `b` in Inherit-From; Shared Concepts' pointer; amendments § 3 applied | 1: PASS (2026-10-10) | `reviews/done/duty-menus-and-self-maps/1-ratify-self-pointing-b.md` | 0001 |
| #2 duty-menus-pre-nip | `duty-menus.md`, its README row, the W1 note | 3: CHANGES_REQUESTED, CHANGES_REQUESTED, PASS (2026-10-11) | `…/2-duty-menus-pre-nip.md` | 0002, A1 |
| #3 self-maps | Treasure Maps Self-Maps, the § 3 fallback, § 4.6, the counting rule; AD narrowed; DM follows; the handoff flipped | 2: CHANGES_REQUESTED, PASS (2026-10-12) | `…/3-self-maps.md` | 0003, A1, A2 |
| #4 treasure-map-key-grammar | The key grammar in Treasure Maps; Duty Menus' remaining wording; AD and TL point at TM | 1: PASS (2026-10-12) | `…/4-treasure-map-key-grammar.md` | 0004 |
| #5 self-map-upkeep | Curation copies at a stop; one reading of the marker; Enumerate; the rest of the Self-Maps row | 1: PASS (2026-10-12, finalized 2026-10-13) | `…/5-self-map-upkeep.md` | 0005 |

All five stories are `**Status:** Done`, and ADRs 0001–0005 are Accepted. Stories, ADRs and reviews now sit under
`engineering-team/{stories,decisions,reviews}/done/duty-menus-and-self-maps/` (§ 8).

**Commits, by story** (all on `staging` except `d234c066`):
- **#1:** `eeb2f859` story (with `book.md` and the epic) · `4c9a7e42`, `dafbfe50` ADR · `4dae3e7a` impl ·
  `31755ed4` review.
- **#2:** `1b6602e6` story · `7635a185`, `d88a1fea`, `029b20cf` ADR · `eb67b78d` impl · `72d34d23` review round 1 ·
  `d130e0c3` fix (the review heading, § 7 P7) · `c17c945f` impl · `b8909914` review round 2 · `01498f02`, `02bd64c6` A1 ·
  `b591f6c0` impl · `cf2085d1` A1-9 to A1-12 proposed · `427b0123` impl and the owner's gate · `a26fc4e7` review
  round 3 · `ab8f2f2b` A1-11's added words ratified, after the PASS.
- **#3:** `5d362f8f`, `57ee1b67` story · `70031a89`, `8de8e198`, `d891b4a8`, `07f167b1` ADR · `05225a6b` impl ·
  `fc4d55ab` A1 proposed and the PO's record · `bc37a62c` impl · `8a9a420d` the owner's confirmation of A1-4 ·
  `b25f89ac` review round 1 · `38947382`, `11cc0008` A2 · `fe163bc0` impl · `8c5973ab` review round 2.
- **#4:** `912681b2`, `b13bb6b5` story · `00341d7e`, `e4b656d8` ADR · `899253ee` records · `ae888a7e` impl ·
  `0311cca3` clarifications after acceptance · `05954589` impl · `e29a99b4` review.
- **#5:** `f98c6072`, `7ab2c955` story · `6179df3d`, `ec801369` ADR · `984c7cc8` impl · `8287d951` clarifications after
  acceptance · `930c5454` impl · `91665c4c` review · `d234c066` the PO's epic record (review non-blocking 4).

## 3. As-built inventory

Derived from `git diff eeb2f859^ d234c066` over the book's deliverables: 11 files, +602 / −63.

| File | +/− | Stories | What changed |
|---|---|---|---|
| `protocols/drafts/duty-menus.md` | +371 (new) | 2, 3, 4, 5 | The whole spec |
| `protocols/drafts/treasure-maps.md` | +164 / −38 | 3, 4, 5 | §§ 1–3, 4.3–4.6, 5.4, 6, 7, 9, 9.2, 10, 11, 13; metadata |
| `protocols/drafts/trusted-lists.md` | +17 / −8 | 4, 5 | Concept-key sentences point at TM; the marker's meaning; Sources |
| `protocols/drafts/assistant-designation.md` | +10 / −6 | 3, 4, 5 | Authorship narrowed; § Relationship to NIP-85; § Curation copies; Sources |
| `protocols/drafts/spawning.md` | +2 / −2 | 5 | § 4 and § 5 Refresh: a maintained List is never marked |
| `protocols/drafts/inherit-from.md` | +4 / −2 | 1 | § "The `b` tag", Self-declaration |
| `protocols/drafts/shared-concepts.md` | +3 / −1 | 1 | § Declared affiliation pointer |
| `protocols/drafts/amendments-2026-09.md` | +4 / −2 | 1 | § 3 marked applied |
| `protocols/README.md` | +2 / −1 | 2, 4 | The Duty Menus row |
| `protocols/worksheet.md` | +2 | 2 | The W1 note |
| `docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md` | +23 / −3 | 1, 3, 4, 5 | ✅ SUPERSEDED; where each part landed; Open questions |

- **User-facing:** none. No screen, route, endpoint or command changed.
- **Domain:** no concept definition or firmware change, and no reinstall.
- **Data & contracts (specified here, built elsewhere or not yet):**
  - **Duty Menu.** Nous' self-declared header `39998:<Nous>:duty-menu`. One kind-39999 item per Assistant key, at `d`
    `duty-menu`, signed by that key, with one `p` naming itself and Nous' `z`. Rows are `duty` (a key and a relay,
    meaning offered) and `not-offered` (exceptions), plus a self-pointing `storefront` marker. These are the new
    multi-letter tags.
  - **Self-Map.** No new kind: a kind-10040 Treasure Map's self-entries (element 2 is the Map's author).
  - **Key grammar.** Treasure Maps §§ 4.3–4.6 and 6, settled. `39998:` and `39999:` alone are not keys.
  - **Retraction marker.** Its only meaning is that the List is no longer maintained at its `d`. A maintained List is
    never marked, and a marked List is never a copy.
- **Records:** 5 stories, 5 ADRs (with A1 to ADR 0002, A1 and A2 to ADR 0003, and clarifications after acceptance to
  ADRs 0004 and 0005), 5 review files holding 8 rounds.
- **Ledger:** the book opened 17 rows. Five are DONE (`2026-10-11-duty-menus-adr-0002-ratification-open`,
  `2026-10-11-duty-menus-spec-fold-forwards`, `2026-10-12-self-maps-spec-fold-forwards`,
  `2026-10-12-self-maps-record-loose-ends`, `2026-10-12-key-grammar-review-fold-forwards`) and 12 are OPEN (§ 6, § 7).
  It closed one older row, `2026-10-09-draft-grammar-bare-39999`, and added notes to four others.
- **Records outside the book's own, each prescribed:** the book created the intake entry "2026-10-11 — Duty Menus
  and Self-Maps in code" and added a note to row `2026-10-10-external-assistant-relay-left-empty` (opened with the
  handoff, `5b266225`), both in `05225a6b` as ADR 0003's bookkeeping. It added two notes to book
  `assistant-self-map`'s row `2026-10-12-list-d-tags-not-treasure-maps` (`984c7cc8`, `91665c4c`).

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame bullet 2: the handoff's § 4 shapes | A `storefront` tag instead of `q`; `duty` rows recommended, not required (story 2 AC2 said "requires"); exceptions get their own `not-offered` tag; namespace `dutyMenu` | intentional-change | ADR 0002 Consequences; owner (a)–(c) at the ADR gate, 2026-10-10; review 2 round 1 ("the ADR rules here") | Wire shape differs from the handoff's sketch. No code had shipped on the sketch | — |
| 2 | ADR 0002 sub-decision 5: resolution and the relay guarantee | Amendment A1 (A1-1 to A1-12): rows within a key, the meet, differing rows; menus supply relays, never keys; an insisted key takes the offering rows' shared relay, else `""`; Nous' relays from its kind 10002; readers ask all three § 8.1 places | constraint-discovered | Review 2 round 2 B3, B4 (cases C and D falsified the guarantee); owner approved A1 on 2026-10-11, replacing A1-11 at the gate. Fix pass 5's "unless they are listed on it" was ratified afterwards (`ab8f2f2b`) | The guarantee holds for offered keys only, and says so | — |
| 3 | Handoff Q4, Q5, Q7 | Q5 (a bare `["z","duty-menu"]`) and Q7 (storefront discovery) left out: Nous' header is the one meeting point, and the storefront is the provider's main-key menu under Nous' header, with its kind 0 website an ordinary hint. Q4 (private duties) unanswered | deferred (Q4); intentional-change (Q5, Q7) | Owner, 2026-10-10 (story 2, Out of scope) | No private duty can be confirmed | §6: TM § 13 q8, DM § 14 q1 |
| 4 | Frame bullet 3: "§ 4.6: `duty-menu` is reserved" | TM § 4.6 names `duty-menu` and points at DM § 4. `39999:duty-menu` names no Concept, and `39998:duty-menu` stays a legal Concept `d`. The reservation is normative only in Duty Menus | interpretation | Owner 1(a), story 3 Open question 1 | None | — |
| 5 | Story 3 AC2: a self-entry's key "copied verbatim" | Verbatim only where it claims nothing false and the key's relay allows; narrower keys otherwise | intentional-change | ADR 0003 A1-3; owner Q1(a) | Publishers carry more entries | Code: intake entry |
| 6 | Story 3 AC3: a self-entry keyed as the observer's entry confirms the duty | Two named departures. A1-4: a self-entry with an empty relay confirms nothing (owner, by name, 2026-10-11). A2-4: under § 9.2 Ties, provisional, ended by story 4 when `39999` came to beat a bare `39998` | constraint-discovered | Review 3 round 1 B2 (found by the independent check); ADR 0003 A1-4, A2-4; ADR 0004 sub-decision 3 | A1-4 stands; A2-4 has no effect left | — |
| 7 | Story 3 AC7: the rest of Assistant Designation unchanged | One added sentence in § Relationship to NIP-85: a triple naming its own author designates no one | intentional-change | ADR 0003 A1-9, approved by name | None | — |
| 8 | ADR 0003 A2-1 (the owner's option (c) for review 3 B1): a retracted List is still a copy where the provider's self-Map claims it | **Superseded by ADR 0005**, with ADR 0003 sub-decision 4's reading of a removed self-entry as a stop. A maintained List with no members is never marked, a marked List is never a copy, and removing a self-entry alone is no stop. A2-1's send clause, the search past a retraction and the Residual stay | intentional-change | Owner 2(a) and 1(a) at story 5's approval; ADR 0005 sub-decisions 4 and 9 (record below) | One reading for every reader. The remaining cost falls on a publisher that marks a List it still maintains | Code: row `2026-10-12-list-d-tags-not-treasure-maps` (two shipped paths mark a pinned List) |
| 9 | Frame bullet 5; ADR 0002 A1-8 to A1-10 (provisional) | Final: a bare `39998` covers every Concept header, kind-39999-declared ones included; `39999` beats `39998`; `39998:` is not a key; category `39998` takes `30393`, `30394`, `30397`; replaceable kinds count as addressable; the Profiles carve-out | interpretation (owner's choices) | Owner 1(a)–4(a) at story 4; ADR 0004 | TM §§ 8 and 10.10–10.11 and Spawning § 3.2 name only `30397` for category `39998`, and Spawning § 3.2 gives a replaceable kind `30393`, which matches nothing | §6: protocol row (addressable kinds); code row (concept-key readers) |
| 10 | Story 4 AC6: the scope of its bookkeeping | Two departures: a Sources clause each in Assistant Designation and Trusted Lists, and two new `protocol` rows | intentional-change | Owner 2(a), 3(a) at ADR 0004's gate | None | §6: the two protocol rows |
| 11 | Frame bullet 6: items 5, 9, 10, 12, 13, 19 and 20 of the Self-Maps row, and the § 5.4 question | Also two late items that `05954589` added to that row without logging them (review 4 NB6), and items 1–5 of row `2026-10-12-key-grammar-review-fold-forwards` | added-beyond-scope (owner-placed) | Owner 4(a) at story 5's approval; the frame did not change | None | — |
| 12 | Frame "Throughout": no "canonical" or "consensus" in normative text | Applied to text the book adds or changes. Uses already in `treasure-maps.md`, and the "self-declared canonical" slips in three other specs, were left | interpretation (owner-confirmed) | Owner, at story 5's approval (2026-10-12); stories 3–5 Out of scope | None now; the words remain in older text | §6: two docs rows |
| 13 | ADRs 0004 and 0005 as accepted | Clarifications after acceptance: ADR 0004 KB-1 to KB-3, ADR 0005 KB-C2, KB-RD-1 and KB-RD-2. None changes a rule. KB-C2 and KB-RD-2 open Treasure Maps § 13 question 13 (does an Alternate entry for a list ask that Assistant to curate it?), which the owner had not confirmed. At story 5's review gate (2026-10-13) the owner was asked whether question 13 should stay on ledger row `2026-10-12-bare-39998-ta-discovery` or move; the owner answered "Proceed." and did not move it, so it stays on that row for the docs pass after the book | added-beyond-scope (a question only) | ADR 0004 § Clarifications (`0311cca3`); ADR 0005 § Clarifications (`8287d951`); reviews 4 and 5 | None until the docs pass answers it | §6: row `2026-10-12-bare-39998-ta-discovery`; §7 P6 |

**ADR supersessions, recorded here as ADR 0005 sub-decision 9 asks.** By design, no ADR's text or Status line was
edited for these: each later ADR records what it changes.
- **ADR 0005 supersedes ADR 0003 Amendment A2-1** (the reading of a retraction that a self-entry claims as a List with
  no members) **and ADR 0003 sub-decision 4's reading of a removed self-entry as a stop.** It also replaces A2's
  Verification cases (a)–(e) with its V1. ADR 0003's Status line still reads "amended by A1 and A2".
- **ADR 0004 supersedes in ADR 0003:** sub-decision 2's tie clause, now Ties: "None arise"; the "Concept kind and a
  colon" bullet, now not a key (§ 4.5); and A2-4's provisional AC3 departure.
- **ADR 0004 makes ADR 0002's A1-8, A1-9 and A1-10 final.** With ADRs 0003 and 0005 it also changes accepted ADR 0002
  text: the § 4 `z` rule, a fifth § 6.1 condition, "the observer's own Assistant", findings 15, 17, 23 and 24, the
  word "addressable", the Implementation line, and the § 5.2 gloss. ADR 0002's Status line names only A1.

**Undocumented work:** none. Every changed line of the 11 files traces, by `git blame` over the range, to a book
commit with a story or ADR, except `duty-menus.md`:5 (`273d4441`, above). The commits made after a story's PASS are
each documented: `ab8f2f2b` (ADR 0002), `e4b656d8` and `899253ee` (audited by story 4's review), and `d234c066`. No
review covers `d234c066`, so this close audited it: it changes only the epic's story-5 entry and adds a note to row
`2026-10-12-self-map-upkeep-review-fold-forwards`, and its wording matches story 5's Open questions and ADR 0005.
No book commit touched `src/`, `ui/`, `test/`, `BIBLE.md` or `product-team/`.

## 5. Quality state at close

- **Test gate at close (step 10):** `20261013T012836Z-10508-bed2 [duty-menus-book-close] started
  2026-10-13T01:28:36.177Z on d234c066+dirty — PASS, exit 0, 5857 passed, 0 failed, 591 skipped, 307/307 suites`.
  It ran over the closed-out tree: after the book flip, the epic close-out and the independent-check fixes. The
  dirty flag is this close's uncommitted changes, which are docs, ledger rows and folder moves only. Two wording
  fixes to this audit (§§ 5, 8) landed while it ran, and this line after it; harness lint was re-run on the final
  tree. This is a docs-mode book, so the gate is a regression check only; no story added or changed a test.
- **The stories' review gates** (`npm run gate:status` lines quoted in each review):

  | Review | Run | On | Result |
  |---|---|---|---|
  | #1 | `20261010T222804Z-7814-1784` | `4dae3e7a` | FAIL, 27 failed: all from another book's Tester-phase commit (`ad61b9ad`); a strict subset of the `dafbfe50` baseline's 28 |
  | #2 round 1 | `20261010T235454Z-5682-05fc` | `eb67b78d` | FAIL, 27 failed: the same baseline |
  | #2 round 2 | `20261011T001826Z-819-fd63` | `c17c945f` | PASS, 5578 passed, 0 failed |
  | #2 round 3 | `20261011T152827Z-18435-6761` | `427b0123` | PASS, 5578 passed, 0 failed |
  | #3 round 1 | `20261012T004348Z-29738-6124` | `8a9a420d` | PASS, 5720 passed, 0 failed |
  | #3 round 2 | `20261012T031805Z-5307-95e8`, then `20261012T032424Z-11118-3178` | `11cc0008` | FAIL (RW7, the known load flake), then PASS, 5744 passed, 0 failed |
  | #4 | `20261012T180237Z-24852-917c` | `05954589` | PASS, 5744 passed, 0 failed |
  | #5 | `20261012T235154Z-29366-6e28` | `930c5454` | PASS, 5854 passed, 0 failed |

- **Harness lint at this close:** clean, 0 violations, before the gate and again on the final tree.
- **Independent check.** Before the gate, three read-only checkers (accuracy, completeness, structure) audited this
  close: about 60 factual claims, the counts, the links and the working tree. The Reviewer re-derived each finding
  from the tree before using it. All three found that the close's commit guidance left
  `audits/treasure-map-card-details/audit.md` out of the commit (§ 7 P21). Also folded in: the confidence line
  (above), the 35 backticked pointers into the moved folders (§ 8, P20), fix pass 7 in P5, the § 6 grouping, the
  ports column, the § 3 record of the intake entry, what the owner confirmed at ADR 0005's gate (§ 6), three wording
  fixes in the seed (§§ 1, 6, 7) and one in row `2026-10-13-review-independent-check-uncodified`. One
  checker's precedent count was off (close `04f4eba4` added four other audits, not five); the record uses four.
- **Debt the ADRs logged, rolled up:**
  - The empty-relay stopgap is a guess that Duty Menus § 6.2 step 5 forbids for external Assistants (ADR 0003, Q3):
    row `2026-10-10-external-assistant-relay-left-empty`.
  - Four shipped readers take some Concept keys otherwise than Treasure Maps §§ 4.5, 4.6 and 6 (ADR 0004): row
    `2026-10-12-treasure-map-concept-key-readers`.
  - Two shipped failure paths mark a List whose pin still stands, against 2(a) (ADR 0005): row
    `2026-10-12-list-d-tags-not-treasure-maps`.
  - Spawning § 3.2 and Content Categories read "addressable" as NIP-01 does (ADR 0004): row
    `2026-10-12-addressable-kinds-spawning-content-categories`.
  - `CONCEPT_HEADER_Z`'s `/i` rejects a menu that § 6.1 accepts, through a malformed tag only: row
    `2026-10-12-duty-menu-code-cross-book-notes`, item 4.

## 6. Carry-forward register

**For the docs pass after this book** (the owner's answer 5(a) to story 5's open question 5):
- [ ] **Does a bare `39998` entry name a user's TA?** Also on that row: does a bare `39998` ask the Assistant to curate
  a list with no entry of its own (the owner confirmed at ADR 0005's gate that it rides on this row), and Treasure
  Maps § 13 question 13, which stays there (§ 4 #13). Ledger row `2026-10-12-bare-39998-ta-discovery`.
- [ ] **"Addressable" in Spawning § 3.2 and Content Categories,** and what an Assistant spawns for (T, `39998`)
  (§ 4 #9). Ledger row `2026-10-12-addressable-kinds-spawning-content-categories`.
- [ ] **Story 5's review wording, items 1–5:** the marker "at its address"; the § 9.2 stop lead; § 13 question 13's
  "(principle 3)"; Spawning § 5's Hand-off and Retire for a § 3.6 Concept; Assistant Designation's Deployment status.
  Ledger row `2026-10-12-self-map-upkeep-review-fold-forwards`.

**For a doc-lane pass (vocabulary and wording):**
- [ ] **The "canonical" uses already in `treasure-maps.md`** (§ 4 #12), and the one "root" text ADR 0003 left out (note
  added at this close). Ledger row `2026-10-12-treasure-maps-canonical-uses`.
- [ ] **"Self-declared canonical"** in three other specs, stale "amendments § 3" pointers, and four wording notes from
  story 1's review. Ledger row `2026-10-10-self-declared-canonical-wording`.
- [ ] **`tapestry-concepts.md` § Data storage:** "namespaced by the concept's camelCase key". Ledger row
  `2026-10-11-tapestry-concepts-namespace-wording`.

**For the code books** (the frame's "separate book, opened after this one"; see the seed § 6):
- [ ] **The rest of the intake entry** "2026-10-11 — Duty Menus and Self-Maps in code"
  (`engineering-team/stories/_intake.md`). Book `assistant-duty-menu` (closed) built the Duty Menu, and
  `assistant-self-map` (open) builds self-Maps. Still open: the element-3 fill and the "Make preferred" swap on
  `/treasure-map`, the read-time fallback in readers, the § 3 relay reconciliation (row
  `2026-10-11-nip85-home-relay-without-copy`), and NosFabrica adoption (handoff Q6).
- [ ] **The empty relay for an external Assistant.** Ledger row `2026-10-10-external-assistant-relay-left-empty`.
- [ ] **Shipped Concept-key readers.** Ledger row `2026-10-12-treasure-map-concept-key-readers`.
- [ ] **Duty Menu code, cross-book notes** items 2 and 4 (items 1 and 3 are met; note added at this close). Ledger row
  `2026-10-12-duty-menu-code-cross-book-notes`.
- [ ] **Self-Map upkeep, cross-book notes** for `assistant-self-map` and the curation code: the "off" button is no stop,
  the stop points, Supported Scores, Concepts, Lists. Ledger row `2026-10-12-self-map-upkeep-cross-book-notes`.
- [ ] **List `d` tags and the marker:** an old `d` kept as an alias, and the two failure paths (§ 4 #8). Ledger row
  `2026-10-12-list-d-tags-not-treasure-maps`.
- [ ] **Nous publishes the Duty Menu header** (outside the repo). It is in the intake entry's "Before or with it", and
  `audits/assistant-duty-menu/audit.md` §6 carries it.

**Spec open questions the book leaves** (the spec is their surface; no row):
- [ ] **Private duties** (handoff Q4): Treasure Maps § 13 question 8, for a self-Map's `.content`; Duty Menus § 14
  question 1, for menus.
- [ ] **Duty Menus § 14 questions 2 and 3:** identical per-customer menus, and non-personalized providers. Question 3 also
  asks what a non-personalized key's self-entries speak for.
- [ ] **Treasure Maps § 13 question 2:** a key for one Tag in every category of a profile kind.

**Named out of scope** (product or protocol to decide whether to pursue; only the last has a surface of its own):
- [ ] **An upstream NIP-85 proposal for Duty Menus** (ADR 0002, Out of scope). `protocols/README.md` lists the spec as
  📝 pre-NIP.
- [ ] **A Show and Tell worked example once a provider directory is built** (ADR 0002, Consequences). The ADR asks for
  a ledger row "at that time"; no directory exists yet.
- [ ] **Whose view the TA's own insights carry** (BIBLE §31; ADR 0003, Out of scope).
- [ ] **NIP-40 expiration on a Map with no self-entry,** which the spec neither allows nor forbids (ADR 0003).
- [ ] **How long a brief gap in a self-Map may last.** Book `assistant-self-map` chose two missed runs, and § 9.2 sets
  no length (ADR 0005; story 5, Out of scope).
- [ ] **The counting rule and a person who serves as their own Assistant.** Under 5(a) they are left out of others'
  counts; the story says to revisit when such users exist (story 3, Open question 5).
- [ ] **The older draft `protocols/drafts/treasure-map.md`,** which contradicts `treasure-maps.md` on the wire. It is
  another book's row and was out of scope here. Ledger row `2026-09-27-old-treasure-map-draft-overlaps`.

## 7. Process findings (harness)

`scripts/harness-stats.sh` at retro time (2026-10-13, at `d234c066`, exit 0):
- **This book:** 53 phase commits (11 `story:`, 22 `adr:`, 0 `test:`, 12 `impl:`, 8 `review:`). The 54th tagged
  commit, `d130e0c3`, is `fix:` and is not counted. Book "open, 3d" before this close. Story→review: 0d for each story
  except `self-maps`, 2d.
- **Whole project:** 359 phase commits; 296 reviews decided, kick-back rate 0%, 74 with kick-back history, churn 3;
  Direction-mode gates approve 94, kick-back 14, halt 6; books 9 open, 83 closed; median cycle time 0d (48 of 321
  stories matched).
- **What the instrument misses:** three of the book's eight review rounds were CHANGES_REQUESTED. The script counts
  files, not rounds, so they show only as two reviews with kick-back history and add no churn (P14).

| # | Finding | Source | Ports to the other flow? | Terminal state |
|---|---|---|---|---|
| P1 | **The review template treats a storied docs-mode review as a doc-lane one.** Read literally, it drops the ACs and the numbered filename. All five reviews worked around it. | Review 1, Harness friction 1; each later review's Filename note | Yes: the same template | OPEN.md row `2026-10-10-review-template-docs-mode-filename` (opened by this book; recurrence note added) |
| P2 | **Review dispatches held the commit,** against `5-review.md`'s per-phase commits. Every review's dispatch held it (from story 2's round 3 on, so that an independent checker could read first), and the orchestrator committed story 1's. | Reviews 1–5, Harness friction | Yes: the same Reviewer agent | OPEN.md row `2026-10-11-reviewer-dispatch-tools-and-commit` (opened by this book; note added) |
| P3 | **A dispatch named WebFetch, which the Reviewer agent lacks.** curl through the proxy worked. | Review 2 round 2, friction 2 | Yes | OPEN.md row `2026-10-11-reviewer-dispatch-tools-and-commit` (in its body) |
| P4 | **Where completion detection is recorded.** The template says the chat. Reviews 1 and 3 (round 2) wrote it in the file; reviews 2 (round 3), 4 and 5 kept it in the chat. | Review 4, friction 3; review 5, friction 2 | Yes | OPEN.md row `2026-10-11-reviewer-dispatch-tools-and-commit` (third defect; this book's instances noted) |
| P5 | **Roles edited each other's text, and commits mixed roles.** The Implementer edited accepted ADR 0002 (fix passes 5–7). Gate-time ADR text landed in `impl:` commits (`427b0123`, `bc37a62c`). PO lines landed in `impl:` (`fe163bc0`). An Architect script rewrote a PO line. Implementer lines landed in a `story:` commit (`899253ee`). `fc4d55ab` and `8a9a420d` mixed roles, each named in its subject. | Review 2 round 3, review 3 rounds 1–2, review 4 (friction 1, NB9); this close | Yes | OPEN.md row `2026-10-11-implementer-edited-accepted-adr` (opened by this book; five notes during the book, one from this close) |
| P6 | **A post-acceptance ADR section names no approver.** Seen in ADR 0004 KB-1 to KB-3 and ADR 0005 KB-C2, KB-RD-1 and KB-RD-2. Each landed in its own `adr:` commit, as the row's fix shape (b) asks. KB-C2 opened a question the owner had not confirmed: Treasure Maps § 13 question 13. At story 5's review gate (2026-10-13) the owner was asked whether question 13 should stay on ledger row `2026-10-12-bare-39998-ta-discovery` or move; the owner answered "Proceed." and did not move it, so it stays on that row for the docs pass after the book. | Review 4, friction 2; review 5, friction 1 | Yes: a Director answers the same gates | OPEN.md row `2026-10-11-implementer-edited-accepted-adr` (notes at review 4, review 5 and this close) |
| P7 | **The template's "On PASS" heading reads as the verdict.** Review 2 round 1 linted red until `d130e0c3`; later reviews named the section "Close-out". | Review 2 round 1 | Yes | OPEN.md row `2026-10-07-on-pass-heading-reads-as-verdict` (fourth occurrence noted in `d130e0c3`) |
| P8 | **RW7's timing flake under load** hit review 3 round 2's first gate run, while the Reviewer's model scripts shared the machine; the quiet rerun passed. | Review 3 round 2, friction 2 | Yes | OPEN.md row `2026-10-08-realtime-wrapper-timing-flake-under-load` (occurrence noted in `8c5973ab`) |
| P9 | **Another book's red tests on shared `staging`.** Reviews 1 and 2 (round 1) gated red and proved non-regression by subset. A later dispatch quoted the stale red baseline. | Reviews 1 and 2, Quality gates; review 2 round 2, friction 1 | Yes | OPEN.md row `2026-10-07-staging-sessions-push-red-tests` (note added) |
| P10 | **A rebase onto shared `staging` orphaned a cited hash** (`18d0cb9f` → `b25f89ac`). | Review 3 round 2 | Yes | OPEN.md row `2026-10-11-phase-docs-cite-rebased-hashes` (note added) |
| P11 | **Edits a gate gave the PO landed late.** Story 5's approval commit omitted the epic record its Approval paragraph promised (found at review, NB4; fixed after the PASS in `d234c066`). Story 3's PO record, which ADR 0003 asked for, was absent through three fix passes. | Review 5 NB4; story 3 Deviations | Partly: the Director's journal records decisions, not the edits they promise | OPEN.md row `2026-10-13-gate-promised-edits-unchecked` (new, meta) |
| P12 | **An implementation pass widened a ledger row the frame names as a story's closing condition** (`05954589`, two items, unlogged). | Review 4 NB6 | n/a (declined) | Declined: the Deviations rule already requires logging. The review caught it, and the owner placed both items at the next gate (4(a)), which is the designed path. One occurrence |
| P13 | **An independent checker changed findings that mattered.** In review 3 round 1 it promoted NB2 to blocking B2, and every later check corrected evidence slips. No workflow asks for it. | Reviews 2 (round 3)–5, Method and Independent check | It is the human-gated counterpart of Direction's blinded judges | OPEN.md row `2026-10-13-review-independent-check-uncodified` (new, meta) |
| P14 | **`harness-stats.sh` counts review files, not rounds,** so this book's three CHANGES_REQUESTED rounds are invisible to churn and the kick-back rate. | This close (stats run) | Yes | OPEN.md row `2026-09-20-inplace-pass-erases-kickback-history` (sibling note added; its fix shape 1 covers it) |
| P15 | **Model-script output order varied between runs** (review 3 round 1). | Review 3 round 1, friction 3 | n/a (declined) | Declined: the Reviewer judged it no defect, since the ADR cites only counts. It did not recur in three later reviews |
| P16 | **A Deviations kick-back list went stale in its own commit** (story 3, round 2 fix 1: three of four "open" items were done). | Review 3 round 2 NB21 | Yes | OPEN.md row `2026-09-21-deviations-not-revised-on-rework` (note added) |
| P17 | **Story 5's gate account named three of five runs.** Both omitted runs were PASS. | Review 5, CK-2 | n/a (declined) | Declined: the review recorded it, nothing was hidden, and it is one occurrence |
| P18 | **Implementers kicked unanswered questions back to the Architect** instead of inventing answers: four in story 2 and nine in story 3, each answered by an amendment. | Stories 2 and 3, Deviations | n/a (declined) | Declined: no defect; `roles/implementer.md` step 8 worked |
| P19 | **The frame's "Throughout" bullet did not say whether it covered existing text.** Three stories read it the same way, and the owner confirmed the reading at story 5's approval. | Stories 3–5, Out of scope | n/a (declined) | Declined: an anchor-wording matter that the gate settled, not a harness defect |
| P20 | **The epic close-out broke 18 links inside the moved story files,** 10 of them the Linked artifacts lines that `5-review.md` § Epic close-out says "stay intact". It holds within one folder, not across the stories, decisions and reviews folders. It also left 35 backticked pointers in 19 live files naming the old folders; this close repointed 34 (§ 8). | This close (§ 8; independent check) | Yes: every epic close-out | OPEN.md row `2026-09-20-done-move-breaks-inbound-refs` (note added) |
| P21 | **The close-commit line leaves out files the close edits:** the epic file (step 9), other books' audits whose §6 items step 5 ticks, and any file whose pointers the epic close-out repoints. Run as written plus the epic file, it would leave `audits/treasure-map-card-details/audit.md` and the handoff unstaged. | This close (independent check) | Yes: a Direction-mode close runs the same workflow | OPEN.md row `2026-09-20-close-commit-line-omits-epic-file` (note added) |

## 8. Epic close-out

`duty-menus-and-self-maps`: all five stories are Done, and every story's commits are on `origin/staging`
(`91665c4c`). The book was developed directly on `staging`, so there is no branch to merge. The epic is now **Done**,
and its three folders moved with one `git mv` each:
- `engineering-team/stories/duty-menus-and-self-maps` → `engineering-team/stories/done/duty-menus-and-self-maps`;
- `engineering-team/decisions/duty-menus-and-self-maps` → `engineering-team/decisions/done/duty-menus-and-self-maps`;
- `engineering-team/reviews/duty-menus-and-self-maps` → `engineering-team/reviews/done/duty-menus-and-self-maps`.

**Links after the move** (a script over every markdown link; scratch only):
- **Live files.** Of 1,513 live `.md` files, none has a markdown link into the moved folders. The files this book owns (the 15 of § 1, bullet 4, and the 24 ledger rows dated 2026-10-10 to 2026-10-13 that name
  the book) hold 236 relative links. The one hit, in row `2026-10-12-self-map-upkeep-review-fold-forwards`:25, is a
  link quoted inside a code span, which renders as text.
- **Inside the moved files.** 18 links that resolved before the move now resolve one level short, all in the five
  story files: their Linked artifacts (ADR and review, 10) and their links out to `docs/`, `protocols/` and `book.md`
  (8). Another 44 were broken before the move, since they are spec text quoted with its own `./` links. These files
  are under `done/`, read-only by convention, and were left as they are (§ 7 P20; row
  `2026-09-20-done-move-breaks-inbound-refs`).
- **Backticked pointers.** 35 lines in 19 live files named the old folders in backticks: the epic's five story
  pointers, one in the handoff, and 29 in 17 ledger rows, 12 of them OPEN. They are not markdown links, but they are
  the inbound pointers later work follows, and row
  `2026-09-20-done-move-breaks-inbound-refs` counts them as breakage. This close repointed 34 of them to the `done/`
  paths, as close `04f4eba4` did. The 35th stays: it is the path inside `git show 427b0123 -- …` in row
  `2026-10-11-implementer-edited-accepted-adr`, where the file lived at that commit. The three move lines above also
  stay as written.

**Other closes' registers.** One §6 item in another audit is resolved by this book and is ticked with a dated note:
`audits/treasure-map-card-details/audit.md` §6 (whether a bare `39999` is named in the grammar: story 4, ADR 0004).
Items this book bears on, but whose remaining work is code, stay unticked: `manage-treasure-map` §6 and
`treasure-map-edit` §6 (one 10040 key parser), `my-assistants` §6, `assistant-duty-cards` and `assistant-duty-menu` §6
(the FAQ), and `dlist-curation` §6.

**Loose ends (step 11).** None needs a new row. Dated notes went on this book's rows: the bare-39998 row (the owner's
"Proceed."), the Duty Menu cross-book row (items 1 and 3 met), and the canonical-uses row (the "root" text). Larger
deferred scope is in §6, and harness lessons are in §7.

**For step 13.1, after the close commit.** Two durable notes still read this book's grammar work as pending: the intake
entry's title ("waits on the specs") and its "Before or with it" line ("story 4's key-grammar answers"), and the
"Provisional key grammar" bullet in `audits/assistant-self-map/book.md`, which is that open book's to change
(Treasure Maps §§ 4.5 and 6 now settle it).
