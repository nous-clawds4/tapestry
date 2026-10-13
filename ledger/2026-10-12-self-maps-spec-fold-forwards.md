# Story 3's review left non-blocking wording gaps in the Self-Maps text of Treasure Maps and Duty Menus for story 5 of the epic to fold in

**Id:** 2026-10-12-self-maps-spec-fold-forwards
**Type:** protocol
**Opened:** 2026-10-12 (`duty-menus-and-self-maps` #3 review, non-blocking findings 1 and 3–16)
**Status:** DONE
**Done:** 2026-10-12 (`duty-menus-and-self-maps` #5, ADR 0005): items 5, 9, 10, 12, 13, 19 and 20, the § 5.4 Enumerate question and the two late items landed in the drafts (note, story 5); the rest by stories 3 and 4, and item 2 was no fold-forward.

Story 3 (Self-Maps) was reviewed CHANGES_REQUESTED on two blockers: B1, what a reader does with a retracted List, and
B2, an unnamed second departure from AC3 under § 9.2 Ties. The review's non-blocking findings below are wording gaps
and provisional-state interplays. None makes a reader do
something false today. Story 3's fix round MAY fold any of them in. Items marked *(Architect)* change ADR 0003 text
and need its amendment. The rest go to story 4 of the epic, which edits both specs anyway. Each item points at the
review's numbered finding, which holds the evidence.

1. `treasure-maps.md` § 9.2 Confirmed duties, second sentence (:403). It lacks the empty-relay condition that fix 7
   put in the first sentence. Write "for the insights such a self-entry wins …" (carries ADR 0003 A1-4; review NB1).
2. *Not a fold-forward.* The AC3 Ties departure is the review's blocker B2, a condition of story 3 itself (the PO's
   line in the record, and the owner naming it). The number is kept so that the items match the review's.
3. *(Architect, or story 4 with A1-8)* Under Ties, read literally, the MUST NOT on "a self-entry that speaks for none
   of the insights it wins" (:387) forbids the bare `39999` self-entry, and with it the {`39998` → Rc, `39999` → Rd}
   self-Map that ADR 0003 sub-decision 2 calls normal. § 6's "this always picks one winning key" (:270) still stands.
   Treasure Maps § 13 has no question for the Concept order. Story 4 checks :387 against its § 6 answer, together
   with row `2026-10-09-draft-grammar-bare-39999` (review NB3).
4. *(Architect)* Its relay's "the relay A's menu gives the self-entry's key (Duty Menus § 6.2 step 5)" (:361). Step 5
   gives a relay only for a key the observer chooses (`duty-menus.md`:200–203), so read strictly it would also rule
   out § 9.2's own nested-row example (:367). Say "the relay step 5 would give that key if the observer chose it, and
   kept it, for A" (review NB4).
5. § 9.2 What a self-entry speaks for (:353). "Read as § 9 has an Assistant read an entry" can import § 9's
   capability limit (:327), and "an Assistant's self-entries" literally includes a key that serves only itself. The
   example at :372 and the next sentence settle both. Rewording is optional (review NB5).
6. § 3 (:80). "A Map entry names who is asked to publish an insight" is unscoped for self-entries, unlike principle 2
   and § 7. Add "except as § 9 says" (review NB6).
7. § 9 One key per observer (:329). It is unqualified against § 9.2's key that serves several observers (:353, :409).
   NIP-85 `85.md`:39 requires a key per user only for a personalized algorithm. Qualify the bullet with Duty Menus
   § 14 question 3 (review NB7).
8. § 9.2 points the open question "what a key that serves several observers speaks for" at Duty Menus § 14 question 3
   (`duty-menus.md`:372), which does not pose it. Add a clause there (review NB8).
9. § 9.2 Private duties (:376), § 13 question 8 (:637) and the handoff's Status line route handoff Q4 to Q8, Duty Menus
   § 14 question 1 and worksheet W22. None of them asks whether a self-Map may carry private duties in `.content`, and
   W22 is Closed (`protocols/worksheet.md`:260). Add the question to Q8 (review NB9).
10. *(Architect, or story 4's ADR; open question)* § 9.2 Concepts (:395). "Curation copies follow Assistant
    Designation § Curation copies" points at a section with no rule for a stop (`assistant-designation.md`:84, :96–112).
    Decide what a stopped Assistant does with its curation copies, keep or delete; either answer is new normative text
    (review NB10).
11. § 3 Enumerating (:95). The gloss leaves out step 3's write relays, and does not exclude storefront rows. Write
    "the relays this fallback's three steps give for any of the insights under the key" (review NB11).
12. § 7 (:306). "Alternates are standbys that are already up to date" (older text) sits beside the new "An Alternate
    whose duty is confirmed … is ready now". Optional rewording (review NB12).
13. § 10's lead (:431) and § 5's lead (:214) read every entry as a designation. Add one clause for self-entries
    (review NB13).
14. Duty Menus § 9, What trusted people do (`duty-menus.md`:284). Point it at Treasure Maps § 9.2 Counting Maps
    (review NB14).
15. Metadata and landing lists (review NB15):
    - Duty Menus' Sources line (`duty-menus.md`:6) omits § 6.2 step 1's last bullet and § 7.
    - The handoff's § 5 landing line omits Assistant Designation § Relationship to NIP-85.
    - `protocols/README.md`'s Treasure Maps row still describes only the grammar. That row is outside story 3's
      scope (AC8), so it rides here.
16. *(Architect)* ADR 0003 Verification AC4's third case (ADR :1480–1481) says "No menu", then names "A's menu relay
    R1". The script it rests on describes "No self-Map". Either wording gives Rw (review NB16).

**Pointer:** `engineering-team/reviews/done/duty-menus-and-self-maps/3-self-maps.md` § Findings; story
`engineering-team/stories/done/duty-menus-and-self-maps/3-self-maps.md`; ADR
`engineering-team/decisions/done/duty-menus-and-self-maps/0003-self-maps.md`; related rows
`2026-10-09-draft-grammar-bare-39999` and `2026-10-11-duty-menus-spec-fold-forwards`.

**Note, 2026-10-12 (story 3, Implementer round 2; ADR `duty-menus-and-self-maps/0003` Amendment A2).** Folded this
round: items 1 (NB1, A2-5), 4 (NB4, A2-2), 6 (NB6, A2-5), 7 (NB7), 11 (NB11, A2-5) and 14 (NB14) in the drafts, and
16 (NB16) by A2-3's marker on ADR 0003's check. Item 2 was blocker B2, which the owner named (A2-4). Items 3, 5, 8, 9,
10, 12, 13 and 15 stay, for story 4 or a later docs pass. One more question stays with them, from ADR 0003's
Consequences of A2 ("Not in A2") rather than from the review: Treasure Maps § 5.4 Enumerate (`treasure-maps.md`:255)
keeps every list of a provider's under the scope, retracted Lists included, and § 3's Enumerating line (:95) points at
it. Whether it drops a retraction that § 7 (:304) reads as no copy is open, for story 4 or a later docs pass. The row
stays OPEN.

**Note, 2026-10-12 (story 3, review round 2).** Two more items, numbered as the review's findings:
19. Trusted Lists and Spawning read two ways on whether a List that is still maintained but has no members carries
    `["status", "retracted"]`.
    - Trusted Lists replaces "a list that no longer has members" with the marker event (`trusted-lists.md`:71–73).
      Spawning gives `status` only "on retirement" (`spawning.md`:28, :160, § 5's Refresh against Retire).
    - The reference publisher marks only a removed pin or a migration off a kind
      (`src/api/trustedList/refreshPinnedTags.js`:197–232 against :270–298; `refreshApplicabilityLists.js`:61–73).
    - Under Treasure Maps § 7 (:304), a reader without self-Maps reads the two forms differently: the marked form as no
      copy (the next Alternate's List), the unmarked form as A's empty List while it is young enough to accept.
    - Settle the rule in Trusted Lists or Spawning. If such a List carries no marker, note that ADR 0003 A2's case (e)
      arises only for a publisher that marks a live empty List (review NB19).
20. Treasure Maps § 9.2, What the allowance rests on, second case (:414). Make it "until the key has read a change to the
    observer's Map or supported sets". A re-pin is a change to the supported sets (Pin-based lists, § 8), not to the
    kind 10040. Until the key restarts the List, a reader that holds the sets takes its old retraction as a maintained
    List with no members (:304, :405). The same gap already applied to Scores and Concepts. Optionally, say so in the
    third case (review NB20).

The row stays OPEN.

**Note, 2026-10-12 (story 4, ADR `duty-menus-and-self-maps/0004`).** Story 4 did items 3, 8 and 15:
- 3 (NB3): Treasure Maps § 6 orders the Concept kinds, and § 9.2's Ties says that none arise. § 9.2's MUST NOT on a
  self-entry that speaks for none of the insights it wins agrees with the order: ADR 0003 sub-decision 2's
  {`39998` → Rc, `39999` → Rd} meets it when each of its self-entries wins a duty it speaks for.
- 8 (NB8): Duty Menus § 14 question 3 asks what the self-entries of a key that serves several observers speak for.
- 15 (NB15): Duty Menus' Sources line names § 6.2 step 1's last bullet and § 7; the handoff's § 5 landing line names
  Assistant Designation § Relationship to NIP-85; `protocols/README.md`'s Treasure Maps row names Self-Maps and the
  read-time fallback.

Items 5, 9, 10, 12, 13, 19 and 20, and the § 5.4 Enumerate question, go to story 5 of the epic (the owner's answer
5(a) to story 4's open question 5). That includes NB10 (item 10), which ADR 0003 A2 left "for story 4's ADR" (ADR 0004
sub-decision 10). The title names story 5. The row stays OPEN.

- *Added 2026-10-12 (story 4, after ADR 0004's clarifications):* two small Treasure Maps wording items for story 5 or
  a later docs pass, neither a rule change:
  - Principle 8 ("A shorter key covers more", `treasure-maps.md` § 1) has no exceptions, while the At a glance bullet
    that says the same now names them (§ 4.4's Profiles category; a Concept key's `d`, § 4.5). Gloss it, or accept the
    segment reading.
  - Treasure Maps' metadata Sources line names numbered sections only, so it does not list the At a glance wording
    ADR 0004's KB-2 clarification changed; Duty Menus' Sources line lists every section touched. Align the two.

**Note, 2026-10-12 (story 5, ADR `duty-menus-and-self-maps/0005`).** Story 5 did the rest of the row, under the
owner's answers to its open questions: 1(a) a stopped assistant keeps its curation copies, 2(a) a List still
maintained is never marked and a marked List is never a copy, 3(a) Enumerate reads the marker as § 7 does, and 4(a)
the two late items ride here. Where each item landed, with ADR 0005's sub-decision:
- 5: Treasure Maps § 9.2, What a self-entry speaks for (7);
- 9: Treasure Maps § 13 question 8 and § 9.2 Private duties, and the handoff's Open questions line (7);
- 10: Assistant Designation § Curation copies, When curation stops, with its worked copy and Revocation, and Treasure
  Maps § 9.2, What follows a stop (1, 2);
- 12: Treasure Maps § 7, the Alternates bullet (7);
- 13: the leads of Treasure Maps §§ 10 and 5 (7);
- 19: Trusted Lists § Common wire shape, Spawning §§ 4 and 5, and Treasure Maps § 7 with §§ 3 and 9.2 (3, 4);
- 20: Treasure Maps § 9.2, What the allowance rests on, second case (6);
- the § 5.4 question: Treasure Maps § 5.4, Enumerate (5);
- the two late items: Treasure Maps principle 8, and its Sources line's ADR 0004 clause (8, 10).

ADR 0005 supersedes two things in ADR 0003 (ADR 0005 sub-decision 9), whose text is not edited:
- Amendment A2-1's reading of a retraction that a self-entry claims as the List with no members, with every passage
  that ADR 0005 sub-decision 4 lists. A2-1's send clause, § 3's search past a retraction and the Residual stay;
- sub-decision 4's reading of a removed self-entry as a stop: the Lists bullet's "its self-entry was removed", the
  Scores bullet's "stopped" signal, and the Concepts bullet's "the removed self-entry says that curation has stopped"
  and "their removal follows Assistant Designation § Curation copies".

The book's close audit should list ADR 0005 as superseding ADR 0003 A2-1 and sub-decision 4's reading of a removed
self-entry as a stop (ADR 0005 sub-decision 9).

ADR 0003's NB10 (item 10) is answered by 1(a), and its "Not in A2" (the § 5.4 question) by 3(a).
