# ADR 0005: Keeping a self-Map true — curation copies stay at a stop, a removed self-entry is no stop, the marker means "stopped", and a retracted List is never a copy

**Status:** Proposed
**Date:** 2026-10-12
**Story:** `engineering-team/stories/duty-menus-and-self-maps/5-self-map-upkeep.md`

**Revision 1 (2026-10-12)** answers the first review (reading F1–F3, owner OI-1–OI-6, coverage, sources SRC-1–SRC-3).
Each reading claim was re-run on the model (`s5/r1/r1.py`), and each code claim checked in the source. § 9.2's first
case now reads a retraction as § 7 does. The lead of What follows a stop drops only what no remaining self-entry
claims, and the Lists bullet's reasons follow § 9's duties. Spawning's Refresh turns on "maintained", and an assistant
may resume curating while a Map entry empowers it. The publisher claim is narrowed to a run that succeeds, and two
failure paths go to the code books. The supersession record adds sub-decision 4's reading of a removal as a stop.
Which version Enumerate reads goes to the owner (Open question 1).

**Revision 2 (2026-10-12)** answers the second review (N1, N2). N1 was re-checked on a model (`s5/r2/n1.py`) and N2
against the draft's order. The cross-book notes now treat a change to the person's Map as a stop only for what no
remaining entry gives the Assistant (Scores, Lists) or empowers it to curate (Concepts). Re-giving a key to the same
Assistant is no stop. The worked copy's new sentence is set while Fido's copy stands, so it no longer comes after
that copy's deletion.

## Context

Story 5 is the book's last frame bullet. It settles the open rules and wording on ledger row
`2026-10-12-self-maps-spec-fold-forwards` (items 5, 9, 10, 12, 13, 19 and 20, and the § 5.4 Enumerate question), and
takes story 4's two late items and row `2026-10-12-key-grammar-review-fold-forwards` items 1–5. Docs-mode: this ADR
designs prose. Test Design is skipped.

**The owner's answers (2026-10-12), which this ADR implements and does not reopen:**
- **1(a).** A stopped assistant keeps its curation copies. Every option applies only when curation stops (the Map
  entry removed, the service ended, the key retired, it cannot publish), never on a removed self-entry alone.
- **2(a).** A List that is still maintained, with no members, is never marked `["status", "retracted"]`. The marker
  means only "stopped" at that `d`, a move to another `d` included. Treasure Maps § 7 reads a marked List as never a
  copy, whatever the self-Map says. This revises ADR 0003 A2-1 (the owner's option (c) for story 3's B1).
- **3(a).** Enumerate reads a retracted List as § 7 does, so under 2(a) it drops every retraction.
- **4(a).** The two late items and the key-grammar row's items 1–5 ride in this story.
- **5(a).** The two `protocol` rows from ADR 0004 go to a docs pass after the book.
- **The frame's "Throughout".** "No canonical or consensus" covers only the text the book adds or changes. A new
  `docs` row tracks the existing uses.

**What the specs say now** (line numbers as of `7ab2c955`, which is level with `origin/staging`):
- **Treasure Maps § 9.2, What follows a stop (:405–409).** It reads a removed self-entry as a stop in all three
  bullets:
  - Lists: "whatever the reason: its self-entry was removed";
  - Scores: "The removed self-entry is their 'stopped' signal";
  - Concepts: "the removed self-entry says that curation has stopped".

  A self-Map is a SHOULD (:365), and book `assistant-self-map`'s "off" button removes self-entries while the keys keep
  publishing.
- **Assistant Designation, § Curation copies (:96–145) and Revocation (:84).** These have no rule for a stop.
  Revocation keeps "the header and its `b`". § 9.2's Concepts bullet points there (item 10, story 3's review NB10).
- **Trusted Lists (:73–75).** It marks "a list that no longer has members (or is being migrated off a kind)". Spawning
  gives `status` only "on retirement" (:28, :160, § 5). The reference publishers mark a removed pin's List
  (`retractStaleTLs`, `src/api/trustedList/refreshPinnedTags.js`:277–300) and the legacy `30393` applicability Lists
  (`retractLegacyKind`, `refreshApplicabilityLists.js`:61–73). A pin's List with no members goes out unmarked
  (`runOnePin`, :203–235). So on a run that succeeds, the shipped code does what 2(a) asks (item 19). Two failure
  paths do not. `refreshAllPinnedTags` keeps only the `d` tags its runs return, and `retractStaleTLs` marks the rest
  (:405–409), so a List whose pin still stands is marked on the same run when:
  - its note List (`30393`) fails to publish: `runOneNotePin` returns `status: 'error'` (:387), and :406 keeps only
    `ok`. A failed pubkey List keeps its `d` (:405; `tag-stack-merge-hardening` ADR 0001, B4a);
  - the pin's tag event is missing from local strfry: `runOnePin` (:146) and `runOneNotePin` (:341) return no `d`.

  Under 2(a) the first is a brief gap, not a stop (Treasure Maps § 9.2, When it changes: "a failed run"). Whether the
  second is a gap or a stop is for the code books. Sub-decision 10 names both on the list-`d`-tags row.
- **Treasure Maps § 7 (:320), from ADR 0003 A2-1.** A marked List is a copy, "the List with no members", only where
  the provider's self-Map still claims it. Otherwise it is no copy. § 3's list of causes (:84) and § 9.2's Lists
  bullet, third case and fourth case (:407, :429, :430) point at it, and ADR 0003 reads the first case (:427) the
  same way (Consequences of A2, "A removal a reader never sees"). A2-1 kept the claimed branch for one reason
  only: Reading 2 ("never a copy") would pass over a provider that still maintains a List with no members (A2's case
  (e)). Under 2(a) such a provider does not mark the List, so that reason is gone.
- **§ 5.4 Enumerate (:270).** It keeps every list under the scope, retractions included. ADR 0003 left this open
  ("Not in A2"), and ADR 0004 sub-decision 10 sent it here.
- **§ 9.2, What the allowance rests on, second case (:428).** It names only a change to the observer's Map. A re-pin
  changes the supported sets (§ 8) (item 20).

**Code this bears on.** Book `assistant-self-map` (open) builds the self-Map writer and its upkeep:
- its "off" button (Decision 1);
- its stop points (book § Design notes);
- its reading of supported Scores as the eleven computed metrics (its ADR 0001, open question 1);
- its Concepts upkeep, where "there is no stop to detect".

The shipped curation code keeps copies on Revoke. The DList Curation panel republishes the Map without the entry and
deletes nothing (`ui/src/pages/grapevine/DListCurationPanel.jsx`:186–188, :298).

**Concept Graph.** The stack is absent in this container (`/api/concept-graph/summaries` on the default port did not
answer). The concepts are named in plain language: curation copies (kind-`39999` items), the curated DList header
(kind `39998`), and the Trusted List kinds `30392`–`30397`. Their handles are unresolved here. None changes.

**Constraints:**
- no new wire surface;
- one place per wire fact (AC5);
- no "canonical" or "consensus" in added or changed spec text;
- specs cite specs and NIPs, never stories or ADRs (metadata Sources lines may);
- no deployment details in spec text;
- ADRs 0003 and 0004 are not edited (AC5);
- every reading claim is checked on a model.

## Options considered

The owner's answers settle every rule. These are the choices of form that remain.

### Choice 1 — Where "a removed self-entry is no stop" lands (AC1)
- **A (chosen): in the lead of What follows a stop.** One sentence defines a stop and says that a removal alone is
  none. Each bullet then drops its clause that reads the removal as the stop. It holds for all three families, in
  the paragraph AC1 names.
- **B: a new bullet under When it changes.** That paragraph says what the key must do. The misreading is in What
  follows a stop, so the bullets there would still need editing.
- **C: edit each bullet alone.** That makes three statements of one rule.

### Choice 2 — Where the copies rule lands in Assistant Designation (AC1)
- **A (chosen): a new paragraph, When curation stops, in § Curation copies.** It names all four causes. Revocation and
  the worked copy point at it or follow it. The copies are defined in this section, so the rule sits with them.
- **B: in the Revocation paragraph.** Revocation is one cause of four, and it sits in Per-DList curation entries, away
  from the copies.

### Choice 3 — § 7's sentence (AC2)
- **A (chosen): the reader rule alone.** "…is no copy, whatever the provider's self-Map says." It keeps the form of
  A2's first revision: the spec says what the reader does, not what the marker says about the provider. What the marker
  means is Trusted Lists' wire fact.
- **B: the rule plus a reason** ("its publisher stopped maintaining it there, Trusted Lists"). That repeats a wire
  fact in a second place.

### Choice 4 — What § 5.4 drops (AC2, 3(a))
- **A (chosen): exactly the marked Lists.** It adds "leaving out any List whose latest version it finds carries the
  marker, which is no copy (§ 7)". Under 2(a) this is 3(a). Which version counts when a client finds two at different
  relays is Open question 1.
- **B: "keeps those § 7 takes as copies".** This is more general, but it would also pull § 7's age and allowance tests
  into Enumerate, so an old but current List would drop out. That changes Enumerate beyond the question.

### Choice 5 — Spawning (AC2)
- **A (chosen): two lines.** The `status` row of § 4 says when the marker goes on (the list stops being maintained
  at its `d`), and says never on a maintained list, with a pointer to Trusted Lists. § 5's Refresh says that a list
  with no members is republished unmarked. Read alone, Spawning then answers both checks: a List with no members, and
  a move to another `d`.
- **B: no edit.** Spawning already implies the first answer ("on retirement"), but it says nothing about a move to
  another `d`, which the check asks of a reader of Spawning alone.
- **C: principle 5 as well.** It already agrees ("no longer passes both gates"), so editing it adds nothing.

### Choice 6 — Where item 20 lands
- **A (chosen): the second case.** It is the case about a duty the key "has not started". A re-pin brings back such
  duties, so the second case names the supported sets and says what a reader sees.
- **B: the third case.** That case is about the drop, not the window before the restart.

### Choice 7 — Item 9's question
- **A (chosen): split question 8 into its decided part (W22) and two open parts.** The self-Map question is one of
  the open parts. AC3 requires question 8 itself to ask it.
- **B: a new question 13.** That leaves question 8's "Decided" label beside the pointer that § 9.2 already gives.

## Decision

We chose A in each choice. The spec text to land follows. "→" means "replace with". Line numbers are as of
`7ab2c955`.

### 1. Curation copies when curation stops (AC1, item 10; owner 1(a))

- **`assistant-designation.md` § Curation copies.** After Removal (:108), insert:
  > **When curation stops.** An assistant stops curating a list when it stops keeping the list's copies up to date,
  > whatever the reason: the Map entry that empowers it was removed (Revocation, above), its service ended, its key
  > was retired, or it can no longer publish. Its copies then stay on relays, as the header and its `b` do: it sends
  > no deletion request for them, and it copies or deletes nothing more for that list until it curates the list
  > again, which it may do only while a Map entry empowers it (above). Deleting the copies it no longer accepts
  > (Removal) is the curation method's work while the assistant curates, never a step of stopping. An assistant that
  > keeps curating has not stopped, even if it removes its own report that it curates the list (a self-entry,
  > [Treasure Maps](./treasure-maps.md) § 9.2).

  "Until it curates the list again" fits all four causes. After an outage or a service that comes back, the Map entry
  still stands, so the assistant may resume at once. After a Revocation it needs a new entry.
- **The worked copy.** After the deletion example (:145), add:
  > If instead, while Fido's copy stands, Alice republishes her Map without `["39998:dogs", …]`, curation stops: the
  > header, its `b` and every copy, Fido's among them, stay on relays, no deletion request is sent for them, and her
  > assistant copies and deletes nothing more for the list.

  "Instead, while Fido's copy stands" makes the stop an alternative to the deletion at :132–145, not a later step.
  A plain "then" would keep a copy that the example has just deleted.
- **Revocation (:84).** "The header and its `b` remain on relays; there is no expiry field." → "The header and its
  `b` remain on relays, and so do the assistant's curation copies ([Curation copies](#curation-copies), When curation
  stops); there is no expiry field."
- **Treasure Maps § 9, Revocation (:349).** Unchanged. "Insights already published stay on relays" already agrees,
  since a Concept is a header with its items (§ 2).
- **NIP-09.** This rule adds no deletion, so NIP-09's timing ("all versions … up to the `created_at`" of an `a`-tag
  request) bears on no new text. Removal's existing case is left as it is: a copy made again at a deleted copy's
  address needs a later `created_at` than the deletion, which a later run gives.

### 2. A removed self-entry is no stop (AC1)

**Treasure Maps § 9.2, What follows a stop (:405–409)** →

> **What follows a stop**, for each family (principle 4). A stop is the key's ceasing to keep an insight up to date
> (When it changes). A self-entry that the key removes or narrows while it keeps publishing what the self-entry spoke
> for is no stop: it ends that self-entry's claim, so a reader that sees the change no longer takes as confirmed or
> maintained (Confirmed duties; Maintained, at its relay) the insights that no remaining self-entry of the key wins
> and speaks for, and nothing below follows from it.
>
> - **Lists.** A SHOULD retract each List it stops maintaining, whatever the reason: the service ended, the key was
>   retired, or the List is no longer among A's duties (§ 9), because the observer's Map no longer gives it to A or it
>   left the supported sets over which a scope key gave it (§ 8). It retracts it by the retraction convention, at each
>   relay where it published the List: an empty replacement carrying `["status", "retracted"]`
>   ([Trusted Lists](./trusted-lists.md#common-wire-shape)), with a `created_at` later than the list's last version
>   (NIP-01). A List it moved to another relay and still maintains there is not one it stops maintaining. § 7 reads a
>   retraction as no copy.
> - **Scores** have no retraction convention, and published values stay on relays (§ 9, Revocation). A reader sees a
>   stop only as the removed or narrowed self-entry, which ends the allowance (Maintained, at its relay), as it does
>   when the key keeps publishing. A Score that left what a self-entry speaks for keeps the allowance for a reader
>   that cannot tell (below).
> - **Concepts.** The curated header and its `b` stay ([Assistant Designation](./assistant-designation.md),
>   Revocation), and so do A's curation copies (Assistant Designation § Curation copies, When curation stops). A
>   does not delete the header, which other headers may point at.

What changes:
- **The lead.** A narrowing leaves alone what a remaining self-entry wins. When A narrows `3038x` → R to the five
  Score kinds of § 9.2's example (A part A does not publish), 98 of the 116 Scores it spoke for stay confirmed and
  maintained. Only the 18 `30385` Scores lose the claim (`s5/r1/r1.out`, Part D).
- **Lists.** The reasons to retract are now reasons to stop. "Its self-entry was removed" is gone. "The List left
  the insights the self-entry speaks for" becomes "no longer among A's duties", which needs no self-entry, so it holds
  with the self-Map off. A List given by an exact key stays a duty when its Tag leaves the supported sets (§ 8), so
  that is no reason to retract it.
- **Scores.** "Stopped signal" becomes what a reader can see. The removed self-entry looks the same whether A stopped
  or only turned its self-Map off, and readers treat the two alike: no allowance, so a copy is accepted only while it
  is no older than the reader accepts.
- **Concepts.** The bullet loses "says that curation has stopped" and gains the copies. Its pointer now leads to a
  rule.

### 3. The marker means "stopped" (AC2, item 19; owner 2(a))

- **`trusted-lists.md`, Common wire shape (:73–75)** →
  > - `["status", "retracted"]` on an **empty-membership replacement** — the retraction convention. A publisher that
  >   stops maintaining a list at its `d`, for any reason (it retires the list, hands it off, migrates it off a kind,
  >   or moves it to another `d`), replaces it in place with an empty event carrying this marker, rather than deleting
  >   it. The marker means only that the list is no longer maintained there: a list its publisher still maintains is
  >   published with its members, even when it has none, and never carries the marker.
- **`spawning.md` § 4, the `status` row (:160)** →
  > | `status` | when the list stops being maintained at its `d` (§ 5) | `retracted`; never on a list still maintained, even one with no members ([Trusted Lists](./trusted-lists.md#common-wire-shape)) |
- **`spawning.md` § 5, Refresh (:169)** → "2. **Refresh** — republish when inputs change, with the members as
  computed, even when none remain: a list still maintained carries no `status` tag, even one with no members (§ 4).
  The replaceable event means consumers always see the latest." The condition is "maintained", as § 4's row and
  Trusted Lists word it. "Passes both gates" would not do: the gates test only the observer's Map and supported sets
  (principle 3), and a list that passes them still stops when its publisher's service ends.
- Principle 5, Hand-off and Retire already agree and stay. Spawning has no Sources line.
- **The AC2 check.** A still maintains T's List, and its computed members are now none. Read alone, either spec
  answers: an unmarked List with no members. At a move to another `d`: the marker at the old `d`.

### 4. A retracted List is never a copy; this supersedes ADR 0003 A2-1 (AC2; owner 2(a))

**The new text:**
- **§ 7, second bullet (:320).** "A List that carries `["status", "retracted"]` ([Trusted Lists](…)) is a copy only
  where … Otherwise, as where the reader finds no self-Map of the provider, it is no copy." → "A List that carries
  `["status", "retracted"]` ([Trusted Lists](./trusted-lists.md#common-wire-shape)) is no copy, whatever the provider's
  self-Map says."
- **§ 3, When the insight is not there (:84).** "…, or a retracted List that is no copy, § 7)" → "…, or a retracted
  List, § 7)".
- **§ 9.2.**
  - The Lists bullet's last sentence is in sub-decision 2.
  - **First case (:427).** "…for a key whose kind 10002 does not answer;" → "…for a key whose kind 10002 does not
    answer. The key's retraction of a List is no copy in either case (§ 7);". Its "keeps its last insights counted as
    maintained" stays true of copies.
  - **Third case (:429).** "…so it takes such a copy as maintained, and a List the key retracted as one with no
    members (§ 7); a reader that holds them does not (What a reader can tell);" → "…so it takes such a copy as
    maintained; a reader that holds them does not (What a reader can tell). The key's retraction of a List is no copy
    for either (§ 7);"
  - **Fourth case (:430).** "…so it takes a stale copy of such an insight as maintained, and a List the key retracted
    as one with no members (§ 7)." → "…so it takes a stale copy of such an insight as maintained; the key's
    retraction of a List is no copy (§ 7)."
  - The three say "the key's retraction", not "a List the key retracted": at a relay that missed the retraction, the
    List's last version is still a copy (the Residual; `r1.out` Part B3).

**What stays of A2-1:**
- the send clause ("at each relay where it published the List");
- the search going on past a retraction (§ 3's "A copy the reader does not accept does not end the search");
- the Residual of a failed send.

**What is superseded in ADR 0003** (its text is not edited; sub-decision 9):
- every passage that reads a retraction a self-entry claims as a List with no members. Among them:
  - A2-1's three § 7 sentences, its § 3 wording, and its three § 9.2 clauses: the Lists bullet's last sentence, and
    the third and fourth cases;
  - its "How Treasure Maps reads the marker", the last two sentences of "Why § 7", "Why the self-Map", and the
    reason it gave for not taking Reading 2;
  - the "Amended by A2-1" notes in sub-decision 4 (the Lists bullet and its C1 note) and in the Known limits;
  - in Consequences of A2, the last sentence of "One reading of the marker", the retraction parts of "Readers that
    cannot tell" and "A removal a reader never sees", and the last two sentences of "Publishers": the order of
    removal and retraction no longer decides how a retraction reads;
- sub-decision 4's reading of a removed self-entry as a stop (sub-decision 2 above):
  - the Lists bullet's reason "its self-entry was removed";
  - the Scores bullet's "The removed self-entry is their 'stopped' signal";
  - the Concepts bullet's "the removed self-entry says that curation has stopped", and "their removal follows
    Assistant Designation § Curation copies", since the copies now stay at a stop (sub-decision 1).

  Its C1 note on "whatever the reason" stands, for a List that is no longer among A's duties;
- "The cost of the owner's choice", narrowed as below;
- "Not in A2", now answered (sub-decision 5);
- A2's Verification checks for A2-1, cases (a)–(e), replaced by V1 below.

**Re-run on the model** (`s5/model.py`). It executes `s3r2/a2.py`'s model section verbatim, with A2's five readers:
- F follows § 3 and holds self-Maps, the supported sets and the observer's Map;
- N follows § 3 and holds self-Maps;
- X follows § 3 and holds no self-Maps;
- Z1 stops at the entry's relay;
- Z2 stops at the entry's relay and holds self-Maps.

It uses A2's four retraction ages (5, 299, 301 and 30,000, against a limit of 300). Under the new rule, every case
below gives one answer at every age, the same for all five readers. The last column is A2's answer, under A2-1 and
with A2's publishers, which marked a maintained List with no members. Where it names readers, the others gave the new
answer.

| Case | New answer, every reader | Under A2 |
|---|---|---|
| B1 (story 3's review): A's service ends, A removes its self-entry and retracts at R | B's List | the same |
| (a) as B1, retracted at R and at the write relay Rw | B's List | the same |
| (b) O unpins T, and A and B retract T's lists | not found | N, Z2: A's empty List |
| (c1) O gives `30396:tag:⟨D1⟩:⟨T2⟩` to B, read through O's Map | B's List | the same |
| (c2) the same, read through P's Map | C's List | N, Z2: A's empty List |
| (c3) the same, A's self-Map read as a point of view | not found | N, Z2: A's empty List |
| (e) A maintains the List with no members, unmarked under 2(a) | A's empty List | X, Z1: B's List (A marked it) |
| (e′) as (e), and A keeps no self-Map | A's empty List | B's List (A marked it) |
| (p) as (e), the List given to A only by a private entry | A's empty List | B's List (A marked it) |
| (e″) A marks a List it still maintains, against 2(a) | B's List | F, N, Z2: A's empty List |
| (r1) item 20: T re-pinned, A not yet restarted, B has | B's List | F, N, Z2: A's empty List |
| (a″) a reader holds A's self-Map from before the removal | B's List | F, N, Z2: A's empty List |
| (B2) a key stops without removing its self-entry, and retracts at R (`r1.out`) | B's List | F, N, Z2: A's empty List |

- **(d), a move from R to R1 with no retraction.** It reads no marker, and it gives the same answers under every
  rule: F and N give A's List at R1, and X, Z1 and Z2 give B's List. That difference comes from § 3's step 1 and from
  the allowance, as before A2. It is not about how a reader reads the marker.
- **(r3), a re-pinned Score from before the drop.** It also differs, and it is the allowance that sub-decision 6
  states.
- **(B3), the first case's copies** (`r1.out`). A's retraction reached Rw but not R, and the reader holds A's
  self-Map from before the removal. Under both rules, F, N and Z2 count A's last List at R as maintained at every
  age. X and Z1 take it at age 60 and B's List at age 5,000. That is the first case's allowance, not the marker.
- **Random Maps** (4,000 Maps; providers maintain the List, maintain it with no members, stop and retract it, or move
  it; 799 Maps with T dropped):
  - **Old publisher, A2-1.** F's answer differs from the truth in 178 Maps, which reproduces A2's figure. The
    self-Map pairs (N against X, Z2 against Z1) differ in 1,597 Maps.
  - **New publisher, new rule.** F differs in 0 Maps, the pairs in 0, and no reader's answer changes with age.
  - **Old publisher, new rule.** F differs in 949 Maps (A2's Reading 2 figure). Each is a Map where a provider marks
    a List it still maintains, which 2(a) no longer allows.
  - **New publisher, A2-1.** F differs in 0 Maps, but the pairs still differ in 723. With no maintained List marked,
    A2-1's claimed branch fires only on a claim the reader cannot tell is stale, a dropped Tag's retraction.
  - The other differences between readers, 2,247 Maps, all set a § 3 reader against one that stops at the entry's
    relay. They are not about the marker.

### 5. Enumerate (AC2, § 5.4; owner 3(a))

- **§ 5.4, item 2 (:270).** "…and keeps those whose `d` tag starts with the scope." → "…and keeps those whose `d`
  tag starts with the scope, leaving out any List whose latest version it finds (NIP-01) carries
  `["status", "retracted"]`, which is no copy (§ 7)." That is Open question 1's recommended answer. Under the other
  answer, the clause ends "leaving out each version it finds that carries `["status", "retracted"]`, which is no copy
  (§ 7)."
- **§ 3, Enumerating (:95).** Unchanged. It enumerates "(§ 5.4)", so it agrees.
- **The AC2 check, on the model** (Part 4). Under `30396:tag:⟨D⟩`, A has four lists:
  - one with members;
  - a retraction that a self-entry wins and speaks for;
  - a retraction that no self-entry claims;
  - a maintained List with no members.

  Enumerate lists the first and the fourth. Under the new rule, § 7 takes exactly those two as copies for every
  reader. Under A2-1, F, N and Z2 would also have taken the second.
- **Two relays** (`r1.out` Part C, the Residual: R holds A's retraction, and Rw missed it). A client that asks both
  lists nothing from A under the recommended answer, and A's last version under the other, at every age. One that
  asks only Rw lists A's last version under both. § 7's reader F takes A's last version at age 60, and B's List at
  age 5,000.

### 6. A change to the supported sets (AC2, item 20)

**§ 9.2, What the allowance rests on, second case (:428)** →

> - until the key has read a change to the observer's Map or supported sets (§ 8), its self-entries can win a new
>   duty it has not started. So after a re-pin, until the key restarts what was re-pinned (Spawning § 5, Restore), a
>   reader that takes a self-entry to speak for those insights counts a Score or Concept that the key published
>   before the drop as maintained at the self-entry's relay, and finds the key's old retraction of a List, which is
>   no copy (§ 7);

On the model:
- **(r1) and (r2).** Every reader moves on to B, or finds nothing if B has not restarted either.
- **(r3).** F, N and Z2 count A's Score from before the drop (age 5,000) as maintained. X and Z1 take B's Score.

### 7. The rest of the Self-Maps row (AC3: items 5, 9, 12, 13)

- **Item 5. § 9.2, What a self-entry speaks for (:369).** Its first two sentences →
  > A self-entry with a scope key speaks only for insights in the supported sets of the observer its key serves
  > (§ 8), and one with an exact key for its one insight, whatever its key can produce: § 9's limit to "the insight
  > kinds and systems it can produce" bounds an Assistant's to-do list, not its self-entries, so a key leaves out what
  > it does not publish with narrower keys (A part A does not publish). Of those, the self-entries of a key that serves
  > one observer other than itself speak only for its duties (§ 9): the insights that the observer's Map gives to it.

  The rest of the paragraph is unchanged. Its sentences on a key that serves only itself and on a key that serves
  several observers now each govern their own case.
  - **On the model** (`s5/wording.py`, part 2). Take Duty Menus § 13.2's menu and the observer's `["3038x", A, R]`.
    With § 9's limit, a `3038x` → R self-entry would speak for 98 insights, all published, and so be true, against
    the example. Without it, the self-entry speaks for 116, of which 18 (`30385`) are not published. A narrows, as the
    example says.
- **Item 9.**
  - **§ 13 question 8 (:652)** →
    > 8. **Private entries.** Private items follow one pattern everywhere, as decided in W22: they are published by
    >    the owner's Assistant, NIP-44-encrypted to itself, and marked `["private", "1"]`. Two things are open.
    >    Delegation entries in the Map stay public until NIP-85's current private-entry text is checked. And a
    >    self-Map keeps private duties out of its public tags (§ 9.2): may it carry them in its `.content`?
  - **§ 9.2, Private duties (:392).** "Whether they may go in its `.content` is § 13, question 8." → "Whether they may
    go in its `.content` is open (§ 13, question 8)."
  - **The handoff, Open questions (`docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md`:19–20).** "Q4 (private duties) is
    tracked in `treasure-maps.md` § 13 question 8, `duty-menus.md` § 14 question 1 and worksheet W22;" → "Q4 (private
    duties in a self-Map's `.content`) is asked in `treasure-maps.md` § 13 question 8; `duty-menus.md` § 14 question 1
    asks the same of menus, and worksheet W22, which is Closed, decided the pattern for private items;". The
    handoff's § 9 list stays as history.
- **Item 12. § 7, fourth bullet (:322)** → "Every listed provider, Preferred or Alternate, is asked to publish and
  maintain the insight, except as § 9 says: the Map asks each Alternate to be a standby that is already up to date,
  which the Map alone does not show. An Alternate whose duty is confirmed (§ 9.2) is a standby that is ready now."
- **Item 13.**
  - **§ 10's lead (:445).** Append: "A self-entry (§ 9), whose element 2 is the Map's own author, entrusts no one, and
    these rows do not read it: § 9.2 says what it reports."
  - **§ 5's lead (:229).** "the observer (the Map's author)" → "the observer (the Map's author, or for a self-entry
    the observer its key serves, § 2)".

### 8. Wording left from story 4 (AC4; owner 4(a))

- **Principle 8 (:53).** "A shorter key covers more." → "A shorter key covers more, except where § 4.4 makes an empty
  category the Profiles category, and within a Concept key's `d` (§ 4.5)."
- **§ 11, How many colons? (:606)** → "A fixed number per system (§ 4.3), the same for every Score kind and for every
  List kind. A Concept key has no system: its `d` is one segment, which may hold colons (§ 4.5). Fewer segments, or an
  empty one, makes a scope, except where § 4.4 makes an empty category the Profiles category: `30392:tag::⟨Podcaster⟩`
  is exact."
- **§ 10.5, `30382:tag:::<metric>` (:506).** "…in my supported Tags for profiles, …" → "…in my supported Tags in the
  Profiles category, …".
- **§ 4.3, Addressable kinds (:164).** "(its table of category types, and § 4)" → "(its opening table of the four
  category types, and § 4)".
- **`duty-menus.md` § 5.2 (:113).** "An exception: the key does not offer the insights under this key." → "An
  exception: the insights this row wins among the menu's rows (§ 2, Offered) are not offered."
- **Model** (`s5/wording.py`):
  - **§ 5.2.** With `not-offered 30385` and `duty 30385:rank` → R, 17 `30385` insights go to the first row and one,
    `30385:rank`, to the second. The old gloss called it not offered.
  - **The Profiles category.** `30392:tag::T1` matches one insight, so it is exact. It does not cover
    `30392:tag:D1:T1`.
  - **A Concept key.** `39998:a` does not cover `39998:a:b`, whose `d` is the single segment `a:b`.
  - **§ 10.5's row.** `30382:tag:::rank` reaches only the Profiles category.
- **The two Sources clauses** are in sub-decision 10.

### 9. Records (AC2, AC5)

- **ADR 0003 A2-1, and sub-decision 4's reading of a removed self-entry as a stop,** are superseded as sub-decision 4
  lists. The owner approved both at story 5. 2(a) takes A2-1's Reading 2, which A2-1 set aside only for case (e).
  1(a) applies at a stop, "never on a removed self-entry alone".
- **ADR 0003's NB10** (A2, Questions for the owner) is answered by 1(a). **The § 5.4 question** is answered by 3(a).
- **ADR 0004 sub-decision 10's pointers** for both ("now means story 5") are fulfilled.
- **How ADR 0003 is marked: it is not.** Its text, its "(Amended by …)" markers and its Status line stay as they are:
  - AC5 says "The text of ADR 0003 and ADR 0004 is not edited".
  - The epic's own precedent agrees. ADR 0004 sub-decision 10 recorded its supersessions of ADR 0003 in ADR 0004 alone.
  - The repo's other convention is not used. Elsewhere a note goes on the superseded ADR's Status line (for example
    `done/my-curated-dlists/0003`), but AC5 rules that edit out here.
  - The record lives in three places: this sub-decision, the closing note on row
    `2026-10-12-self-maps-spec-fold-forwards`, and the book's close audit. The audit should list ADR 0005 as
    superseding ADR 0003 A2-1 and sub-decision 4's reading of a removal as a stop.
- **Story 3's record** (`3-self-maps.md`:454–455, AC3's gloss "for a List the key retracted, a List with no members")
  is history and is not edited.

### 10. Bookkeeping (AC5)

**Metadata Sources lines:**
- **`treasure-maps.md` (:5).**
  - In the ADR 0004 clause, "and §§ 3, 5.3, 9.2, …" → "and At a glance's second bullet, §§ 3, 5.3, 9.2, …".
  - At the end, before the final ".", add: "; and ADR 0005 (keeping a self-Map true: § 7's reading of a retracted
    List, which replaces ADR 0003 A2's, with § 3, § 5.4's Enumerate, and § 9.2's What follows a stop and What the
    allowance rests on; and the wording of principle 8, §§ 4.3, 5, 7, 9.2, 10, 10.5 and 11, and § 13 question 8)".
- **`duty-menus.md` (:6).**
  - In the ADR 0003 clause, "ADR 0003 with Amendment A1 (" → "ADR 0003 with Amendments A1 and A2 (".
  - In the same clause, "§ 7's own-Assistant exception, § 10 and § 14 follow" → "§ 7's own-Assistant exception, § 9's
    Counting Maps pointer, § 10 and § 14 follow".
  - At the end, add ", and ADR 0005 (the wording of § 5.2)".
- **`assistant-designation.md` (:4).** Add "; `duty-menus-and-self-maps` ADR 0005 (§ Curation copies: what an
  assistant does with its copies when curation stops, which § Per-DList curation entries' Revocation follows)".
- **`trusted-lists.md` (:4–10; the ADR 0004 parenthesis ends at :8).** After that parenthesis, add "and ADR 0005
  (§ Common wire shape: the retraction marker means that a list is no longer maintained at its `d`)".

**The ledger.** Every dated note is dated on the Implementer's day.
- **`2026-10-12-self-maps-spec-fold-forwards`** goes DONE.
  - A note says where each item landed, by spec section, with this ADR's sub-decision:
    - 5: Treasure Maps § 9.2, What a self-entry speaks for (7);
    - 9: Treasure Maps § 13 question 8 and § 9.2 Private duties, and the handoff's Open questions line (7);
    - 10: Assistant Designation § Curation copies, When curation stops, with its worked copy and Revocation, and
      Treasure Maps § 9.2, What follows a stop (1, 2);
    - 12: Treasure Maps § 7, the Alternates bullet (7);
    - 13: the leads of Treasure Maps §§ 10 and 5 (7);
    - 19: Trusted Lists § Common wire shape, Spawning §§ 4 and 5, and Treasure Maps § 7 with §§ 3 and 9.2 (3, 4);
    - 20: Treasure Maps § 9.2, What the allowance rests on, second case (6);
    - the § 5.4 question: Treasure Maps § 5.4, Enumerate (5);
    - the two late items: Treasure Maps principle 8, and its Sources line's ADR 0004 clause (8, 10).

    The same note names what ADR 0005 supersedes in ADR 0003 (sub-decision 9).
  - The "*Added 2026-10-12 (story 4, after ADR 0004's clarifications)*" addendum moves below the "Note, 2026-10-12
    (story 4, ADR …0004)" note, into date order (story 4's review, NB6).
- **`2026-10-12-key-grammar-review-fold-forwards`** goes DONE, with a note. Item 1 landed in Treasure Maps § 11, 2 in
  Duty Menus § 5.2, 3 in Treasure Maps § 10.5, 4 in § 4.3, and 5 in Duty Menus' Sources line (sub-decisions 8 and
  10). Item 6 was resolved by the owner's 4(a).
- **`2026-10-12-addressable-kinds-spawning-content-categories`** and **`2026-10-12-bare-39998-ta-discovery`** each
  get a note: the owner placed the row in a docs pass after this book (5(a)). Both stay OPEN. The bare-`39998` row's
  note adds one question for that pass: does a bare `39998` ask the Assistant to curate a list that has no entry of
  its own in the Map? Treasure Maps § 10.1 gives it "the items filed under" the person's headers, but Assistant
  Designation's blanket entry "names no individual list" (cross-book item 4).
- **`2026-10-12-list-d-tags-not-treasure-maps`** gets a note:
  - under 2(a), an old `d` gets the marker when this instance stops maintaining a List there;
  - an old `d` kept as an alias stays maintained and unmarked, even with no members;
  - a Treasure Map reader never reads an old `d` (§ 5.1);
  - on a run that succeeds, the reference publishers use the marker only for a stop: `retractStaleTLs` for a removed
    pin and `retractLegacyKind` for the move off `30393`. `runOnePin` publishes a List with no members unmarked;
  - two failure paths depart from 2(a), for the code books (Context). A note List that fails to publish is marked on
    the same run, though its pin stands. Under 2(a) that is a brief gap, so its `d` should stay in
    `currentNoteDTags`, as B4a keeps the pubkey List's. A pin whose tag event is missing from local strfry has both
    its Lists marked; whether that is a gap or a stop is the code books' call. Until the next run republishes such a
    List, every reader reads it as no copy (§ 7).
- **New row `<date>-treasure-maps-canonical-uses`** (type `docs`; a new row's id carries the day it is opened). It
  holds the `canonical` uses that book `duty-menus-and-self-maps` left in `treasure-maps.md`:
  - "canonical naddr" and "canonical nevent" in §§ 1, 2, 4.1, 4.3 and 11;
  - the metadata's "Canonical" field.

  Whether "canonical naddr" falls under handoff D2 is that pass's call.
- **New row `<date>-self-map-upkeep-cross-book-notes`** (type `docs`). Its title: "Story 5's rules for keeping a
  self-Map true, for book assistant-self-map and the curation code". Its body is the five items under Consequences,
  "For book `assistant-self-map` and the curation code".

**Story 5's record.** The Implementer adds a block to § Deviations, labelled by role, only if a change departs from
this ADR's text.

## Consequences

- **One reading of the marker, for every reader.** A retraction is never a copy, whoever reads it and whatever
  self-Map it holds. Every named case gives one answer at every age, the same for readers with and without self-Maps.
  On 4,000 random Maps with conforming publishers, the self-Map pairs never differ and F always finds the first
  provider that maintains the List. The remaining differences between readers come from § 3 and the allowance, as
  before A2: (d), (r3), (B3), and a reader that stops at the entry's relay.
- **ADR 0003 A2's cost (AC2):**
  - **Cases (e) and (e′).** A conforming provider publishes a maintained List with no members unmarked. Every reader
    then takes A's empty List: at the self-entry's relay whatever its age, and elsewhere while it is no older than the
    reader accepts.
  - **The remaining cost.** It arises only for a publisher that marks a List it still maintains, and that publisher
    no longer conforms (the shipped failure paths in Context are such marks). Every reader reads that List as no
    copy, and takes the next Alternate, or finds the insight not found if there is none (949 of 4,000 Maps under the
    old publisher model; `r1.out` Part A2). Where a relay that § 3 asks next missed the marked update, a reader that
    follows § 3 takes that relay's earlier version, with members A has since dropped, while it is no older than the
    reader accepts, as in the Residual (Part A1: F, N and X at age 60, and B's List for every reader at age 5,000).
    Under A2-1, X alone did. A conforming publisher's unmarked List is taken at R first (Part A1c).
  - **A List given only by a private entry** is no longer read as no copy, so A2's cost for it ends. Its duty still
    has no self-entry of its own (§ 9.2, Private duties) until § 13 question 8 is settled.
- **Gains beyond B1.** Readers that cannot tell (cases (b), (c2) and (c3)) no longer show an empty List. Nor does a
  reader that never saw A's removal (a″), or one in the re-pin window (r1). § 9.2's order (remove or narrow, then
  stop, then retract) now matters only for the allowance of copies that are not retractions. A key that retracts
  first is read as no copy at once.
- **What stays as A2 left it:**
  - the send clause, and the Residual of a failed send (model Part 2: A's last version at Rw while it is young, then
    B's List, under both rules);
  - a removal a reader never sees still keeps the key's last copies counted as maintained at the self-entry's relay
    (first case): Scores, Concepts, and a List whose retraction did not reach that relay (Part B3). Its retraction,
    where the reader finds it, is no copy (Part B1).
- **Enumerate** reads the marker as § 7 does, and applies no age test (Choice 4). Where relays disagree (Part C), a
  client that asks only a relay that missed a retraction lists A's last version there whatever its age, while § 7
  takes it only while it is young. A client that also finds the retraction leaves the List out under Open question
  1's recommended answer, where a § 3 reader may still take the older version while it is young (the Residual).
  Under the other answer it lists the older version, whatever its age.
- **Turning a self-Map off retracts and deletes nothing.** Removing self-entries changes only what readers grant
  (confirmation, the allowance). Without the allowance, readers accept the key's insights only while they are no
  older than the reader accepts. So a List, Score or Concept that has not changed for longer falls to the next
  Alternate, or is not found ((off2): every reader takes B's List).
- **For book `assistant-self-map` and the curation code** (the new cross-book row):
  1. **The "off" button** (its Decision 1, story 2) is no stop. It removes self-entries, and the keys go on
     publishing. Nothing is retracted, and no copy is deleted. It does end the allowance: readers then accept the
     keys' insights only while they are no older than the reader accepts, so stable Lists, Scores and Concepts fall
     to the next Alternate, or are not found.
  2. **Its stop points:**
     - a customer leaving `active` is a stop for every family that customer's key publishes;
     - a relay that moves is a move: When it changes publishes the new relay first, and nothing is retracted;
     - Scores that stop landing are a stop for those Scores: narrow or remove the self-entry, and the values stay;
     - the person's Map dropping a key, or giving it to another key, is a stop only for the Scores and Lists that no
       remaining entry of that Map gives to the Assistant (§ 9). Those Lists SHOULD be retracted. An insight that
       another entry still gives the Assistant (`*` after `3038x` is dropped, say) stays a duty. Re-giving a key to
       the same Assistant, at the same relay or another, is no stop. For Concepts, see item 4.

     None of these changes the supported sets. The re-pin window (sub-decision 6) arises once the instance reads real
     supported sets.
  3. **Supported Scores.** A self-entry speaks for the observer's supported Scores under its key, not for what the
     instance computes (item 5). The instance's reading, the eleven metrics, holds as a reading of the supported
     Scores while no supported-Scores set is published. Once one names a metric the instance does not compute, a
     `30382` self-entry claims it falsely, and the self-Map must narrow to `30382:<metric>` keys (A part A does not
     publish). Its ADR 0001 already plans to read a real set.
  4. **Concepts.** The instance stops curating a list when no entry in the person's Map empowers it any longer
     (Assistant Designation, Revocation), or for another cause in When curation stops (sub-decision 1). It narrows or
     removes its self-entries as § 9.2's When it changes asks. It keeps the header, its `b` and the copies, sends no
     deletion, and copies nothing more for that list. A Map change that leaves the list's own entry naming the
     Assistant is no stop for that list: dropping a bare `39998`, say, or re-giving the entry at another relay.
     - **A bare `39998` in the same Map.** If the Map drops a list's entry but keeps a bare `39998` naming the
       Assistant, curation of that list ends, because the blanket entry names no list (Assistant Designation). Yet
       Treasure Maps § 9 still gives the list's Concept to the Assistant through the bare key, so a bare `39998`
       self-entry would still win and speak for it. The self-Map therefore narrows to exact keys. Whether a bare
       `39998` asks for curation is left to the docs pass (sub-decision 10).
     - Shipped Revoke conforms.
     - Update list opens only for a list the Map names (`curatedDListAccess`, `ui/src/utils/treasureMap.js`:357–371).
       `POST /api/dlist-curation/update` does not itself check the Map entry, so "copies and deletes nothing more"
       rests on the page.
  5. **Lists.** Today it claims none (`older-form`). Sub-decision 10's note on the list-`d`-tags row says what an old
     `d` gets.
- **Departures from story 5 as approved:** none. Treasure Maps § 9 and § 3's Enumerating line are checked and left
  unchanged, since each already agrees (AC1, AC2).
- **New wire surface:** none. The marker's tag is unchanged; only its stated meaning narrows to the meaning that
  Spawning gives it, and that the reference publishers give it on a run that succeeds (Context).
- **Firmware reinstall required?** No. No concept definitions change.

## Open questions for the owner

1. **Which version of a List does Enumerate read, when a client finds more than one?** (F3; 3(a).) A client that
   enumerates at several relays (§ 3, Enumerating) can find A's retraction at one relay and A's older version at a
   relay that missed it (a failed send, the Residual).
   - (a) **Each version alone.** Enumerate leaves out each version that carries the marker, as § 7 judges each copy.
     It then lists A's older version from the relay that missed the retraction, whatever its age, since Enumerate
     applies no age test. This is the narrower reading of 3(a). It also keeps Enumerate apart from the reader rule
     that A2-1 did not take ("takes no older version"), which story 5 leaves out of scope.
   - (b) **The latest version found (NIP-01).** Enumerate reads one version per List, the latest it finds, and
     leaves the List out when that version carries the marker. Wherever the client also finds the retraction, a
     stopped List is not listed.

   **Recommended: (b).** Enumerate shows "which lists an Assistant actually publishes", and the latest version is
   A's current word, as NIP-01 has it for an address. Under (a), a stopped List stays listed for as long as any relay
   that missed its retraction keeps the old version. A2-1's reasons for not taking that rule in § 3 do not reach
   Enumerate. There, the answer turned on which relay a reader meets first, and the rule added a memory to § 3's walk
   across relays. Enumerate gathers its relays' answers in no order and compares them at once. The cost of (b): in
   the Residual, Enumerate leaves out a List that a § 3 reader may still take while it is young. Sub-decision 5 gives
   the text for each answer.

## Implementation notes

Docs-mode. The exact text is in the Decision. Line numbers are as of `7ab2c955`; find each edit by its quoted text.
Edit in this order, so that each pointer lands after its target.

1. **`protocols/drafts/trusted-lists.md`:** :73–75 (sub-decision 3), then the Sources line (sub-decision 10).
2. **`protocols/drafts/spawning.md`:** :160 and :169 (sub-decision 3). No other line.
3. **`protocols/drafts/assistant-designation.md`:** When curation stops after :108, the worked copy's sentence after
   :145, and Revocation at :84 (sub-decision 1); then the Sources line at :4.
4. **`protocols/drafts/treasure-maps.md`:**
   - :53, :164, :506 and :606 (sub-decision 8);
   - :84 and :320 (sub-decision 4);
   - :229, :322, :369, :392, :445 and :652 (sub-decision 7);
   - :270 (sub-decision 5);
   - :405–409 (sub-decision 2);
   - :427–430 (sub-decisions 4 and 6);
   - :5 (sub-decision 10).
5. **`protocols/drafts/duty-menus.md`:** :113 and :6 (sub-decisions 8 and 10).
6. **`docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md`:** :19–20 (sub-decision 7). Nothing else.
7. **`ledger/`:** the five notes and the two new rows (sub-decision 10). Then flip the self-maps and key-grammar rows
   DONE last, once the drafts are in.

Not edited:
- ADRs 0003 and 0004;
- BIBLE;
- Content Categories;
- `protocols/README.md`;
- the worksheet;
- the epic and the book;
- any code or test.

Gates:
- `git diff --stat -- protocols/` touches only the five drafts, in the sections V13 lists;
- every link and anchor resolves, including `#curation-copies` and `./trusted-lists.md#common-wire-shape`;
- `git diff -U0 -- protocols/ docs/ | grep '^+' | grep -iE 'canonical|consensus'` finds nothing;
- `bash scripts/harness-lint.sh` is clean;
- the stack-free `npm test` shows no regression against a baseline taken before the edit.

## Verification

Re-derive each check from the drafts as changed. Then run the scripts with `python3 -I` from the scratchpad folder:
- `s5/model.py s3r2/a2.py 4000` writes `s5/model.out`;
- `s5/wording.py .` writes `s5/wording.out`;
- `s5/r1/r1.py .` writes `s5/r1/r1.out` (revision 1);
- `s5/r2/n1.py .` writes `s5/r2/n1.out` (revision 2).

Each prints the same output on every run.

- **V1. A2-1's cases under 2(a)** (sub-decision 4). § 7 has the one new sentence, with no "claims" clause left. § 3's
  list ends "or a retracted List, § 7". The first, third and fourth cases say that the key's retraction of a List is
  no copy. Part 1 of `model.out` prints "one answer for all five readers" for the new rule in B1, (a), (b),
  (c1)–(c3), (e), (e′), (p), (e″), (r1), (r2), (off1), (off2) and (a″), with the answers in sub-decision 4's table,
  V7 and V8. `r1.out` Part B prints "all five agree" for B1 and B2 under the new rule. (d) and (r3) print "SELF-MAP
  PAIRS DIFFER" under both rules, and so does B3 at age 5,000. A sweep of `treasure-maps.md` with
  `grep -n -iE 'retract|no members|as maintained'` finds no line that reads a retraction as a copy or as a List with
  no members.
- **V2. Random Maps** (Part 3).
  - Old publisher with A2-1: F differs from the truth in 178 Maps, the pairs in 1,597.
  - Old publisher with the new rule: F 949, pairs 0.
  - New publisher with A2-1: F 0, pairs 723, all 723 with T dropped.
  - New publisher with the new rule: F 0, pairs 0, among § 3 readers 0, between Z1 and Z2 0.
  - No reader's answer depends on age anywhere.
- **V3. The Residual** (Part 2). At age 60, A's last version at Rw under both rules. At age 5,000, B's List. A
  non-conforming mark (`r1.out` Part A1): at age 60, F, N and X take A's earlier version at Rw, and Z1 and Z2 take B's
  List; at age 5,000 every reader takes B's List. With no Alternate (A2), every reader answers not found. The
  conforming twin (A1c) gives A's unmarked List at R to every reader.
- **V4. Enumerate** (Part 4, AC2). Enumerate lists `L1 members` and `L4 maintained, no members`. The new rule gives
  "every reader matches Enumerate". A2-1 gives F, N and Z2 "!= Enumerate". At two relays, `r1.out` Part C prints the
  answers sub-decision 5 gives for each answer to Open question 1.
- **V5. A List with no members** (AC2, item 19). Read alone, Trusted Lists and Spawning each say that it is an
  unmarked List with no members, and that a move to another `d` puts the marker at the old `d`. Spawning's Refresh
  turns on "maintained", not on the gates.
- **V6. Curation copies** (AC1). Alice drops `["39998:dogs", …]`. From Assistant Designation alone:
  - the copies stay, with no NIP-09 request;
  - nothing more is copied or deleted.

  Revocation and the worked copy say the same. After an outage, with the Map entry standing, the assistant may curate
  again. The worked copy sets its stop while Fido's copy stands, so no copy is both deleted and kept.
- **V7. The "off" button** (AC1). Alice's assistant removes its `39998:dogs` self-entry and keeps curating. From
  § 9.2's lead: no stop, so nothing is retracted or deleted, and the claim ends. Assistant Designation's last
  sentence agrees. On the model, (off1) gives A's List to every reader, and (off2) gives B's List to every reader.
- **V8. A re-pin** (AC2, item 20). The second case names the supported sets. On the model, (r1) gives B's List and
  (r2) not found, for every reader. (r3) gives A's old Score to F, N and Z2, which the second case states.
- **V9. Item 5.** `wording.out` part 2 prints "TRUE: … against the example" with § 9's limit, and "false: A narrows"
  without it. The paragraph no longer says "read as § 9 has an Assistant read an entry", and its one-observer sentence
  excludes a key that serves only itself.
- **V10. Items 9, 12 and 13** (AC3).
  - Question 8 asks the `.content` question outside its W22 sentence, and § 9.2 says "is open (§ 13, question 8)".
  - The handoff line sends Q4 to question 8, and names Duty Menus question 1 (menus) and W22 (Closed) for what they
    are.
  - § 7 says "ready now" only of a confirmed Alternate.
  - § 10's lead sends the TA's `["39998", TA, R]` in its own kind 10040 to § 9.2.
- **V11. AC4.** `wording.out` parts 1, 3 and 4 print as in sub-decision 8. Principle 8 and § 11 name the Profiles
  category and a Concept key's `d`. § 4.3 cites the opening table of the four category types. The two Sources clauses
  list At a glance's second bullet, Amendment A2 and § 9's Counting Maps pointer.
- **V12. One place per wire fact** (AC5).
  - The marker's meaning is in Trusted Lists alone; Spawning points at it.
  - The copies at a stop are in Assistant Designation alone; Treasure Maps § 9.2 points at it.
  - The reading of a marked List is in § 7 alone; §§ 3, 5.4 and 9.2 point at it.
- **V13. Bookkeeping and scope** (AC5).
  - The self-maps and key-grammar rows read `**Status:** DONE`, with `**Done:**` filled. Each note gives what
    sub-decision 10 lists for it. The story-4 addendum sits after the story-4 note.
  - The two `protocol` rows and the list-`d`-tags row carry their notes and stay OPEN. The two new rows exist, each
    with an `**Id:**` that matches its file name.
  - `grep -n 'ADR 0005'` hits the Sources lines of `treasure-maps.md`, `duty-menus.md`, `assistant-designation.md` and
    `trusted-lists.md`.
  - `git diff -U0 -- protocols/` has hunks only in AC5's sections:
    - in `duty-menus.md`, § 5.2 and :6;
    - in `assistant-designation.md`, :4, Revocation and § Curation copies;
    - in `trusted-lists.md`, the Sources lines and the marker bullet;
    - in `spawning.md`, :160 and :169.
  - `git diff --stat` outside `protocols/` lists only the handoff, `ledger/` and the story file.
- **V14. The cross-book notes** (N1). Items 2 and 4 call a change to the person's Map a stop only for what no
  remaining entry gives the Assistant or, for Concepts, empowers it to curate. `n1.out` shows:
  - S1: dropping `3038x` under `*` stops none of the 115 duties `3038x` won, where the first wording stopped all 115;
  - S3: giving `3038x` to B, beside `30385` → A, stops 98 and keeps 18;
  - S2 and C3: re-giving to the same Assistant at another relay changes nothing;
  - C1: dropping the bare `39998` keeps `39998:c1`;
  - C2: dropping `39998:c1` beside a bare `39998` keeps the § 9 duty, while the list's empowerment ends.

The scratchpad is not durable. To rebuild `model.py`:
1. Exec `a2.py`'s model section, the lines above its "Part 1" line.
2. Add the cases in sub-decision 4's table.
3. Take Part 3 from `a2.py`, drawing random numbers in the same order. Add an `EMPTY` body, an unmarked List with no
   members, for the new publisher.
4. Add Part 4 from sub-decision 5.

To rebuild `wording.py`, exec `r4/tm4.py` and `s4/tmfinal.py`, as `s4/m1_grammar.py` does, and run the four checks of
sub-decisions 7 and 8. To rebuild `r1/r1.py`, exec `a2.py`'s model section for Parts A–C: the cases that V1, V3 and
V4 name. Part D uses the grammar model as `wording.py` does. To rebuild `r2/n1.py`, exec the grammar model as
`wording.py` does. Compute § 9's duties with `win` over a Map before and after each change, and take empowerment as
the named `39998:<d>` and `39999:<d>` entries that name A.

## Out of scope

- **The two `protocol` rows** (5(a)): what an Assistant spawns for (T, `39998`), and whether a bare `39998` entry
  names a user's TA. The second also gets sub-decision 10's question: whether a bare `39998` asks for curation.
- **Any code**, including the update endpoint's own Map-entry check (Consequences, item 4).
- **How long a brief gap may last.**
- **Answering § 13 question 8.**
- **The reader rule A2-1 did not take**, for a failed send, in § 3. Which version Enumerate reads is Open question 1.
- **Spawning beyond § 4's `status` row and § 5's Refresh**, and Content Categories.
- **Duty Menus § 14 questions 1–3**, NosFabrica (Q6), and the older `treasure-map.md` draft.
- **The two `docs` rows from stories 1 and 2**, and the existing `canonical` uses (new row, sub-decision 10).
- **Removal's re-copy timing under NIP-09** (sub-decision 1). It is noted, and nothing asks for it.
