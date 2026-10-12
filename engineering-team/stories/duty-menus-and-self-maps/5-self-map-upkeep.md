# Story 5: The rules that keep a self-Map true

**Status:** Draft
**Created:** 2026-10-12
**Type:** Doc

## Background

Story 3 put Self-Maps in Treasure Maps § 9.2. A key's own kind 10040 reports which of its duties it is publishing now,
and the key must remove or narrow a self-entry before it stops. Story 3's two review rounds left wording gaps and three
open rules on ledger row `2026-10-12-self-maps-spec-fold-forwards`. Story 4 did items 3, 8 and 15. At story 4's
approval the owner sent the rest here (answer 5(a)), and added the book's last frame bullet
([`engineering-team/audits/duty-menus-and-self-maps/book.md`](../../audits/duty-menus-and-self-maps/book.md)): "The
rules that keep a self-Map true are settled: items 5, 9, 10, 12, 13, 19 and 20 of ledger row
`2026-10-12-self-maps-spec-fold-forwards` … and the § 5.4 Enumerate question, and that row is closed (story 5)."

**What is open.** Items keep the row's numbers.
- **Curation copies when an Assistant stops (item 10).** § 9.2's Concepts bullet says "Curation copies follow Assistant
  Designation § Curation copies", but that section has no rule for a stop. Its Revocation paragraph keeps only "the
  header and its `b`", and "deletes the copies it no longer accepts" can be read either way. Either answer is new
  normative text (story 3's review, NB10). ADR 0003 A2 left this "for story 4's ADR". ADR 0004 sub-decision 10 records
  that this now means story 5.
- **A removed self-entry that is no stop** (found at this story's planning). § 9.2's What follows a stop reads a
  removed self-entry as a stop. For Concepts it "says that curation has stopped", for Scores it is "their 'stopped'
  signal", and for Lists it is a reason to retract. But a self-Map is only a SHOULD (§ 9.2, Terms), so a key may
  remove its self-entries and keep publishing, as book `assistant-self-map`'s "off" button does (below).
- **A List that is still maintained but has no members (item 19).** The two specs read two ways:
  - Trusted Lists replaces "a list that no longer has members" with an empty event that carries
    `["status", "retracted"]`;
  - Spawning gives `status` only "on retirement", and keeps Refresh apart from Retire;
  - the reference publisher marks only a removed pin or a move off a kind.

  Since ADR 0003 A2, Treasure Maps § 7 reads a marked List as no copy unless the provider's self-Map still claims it,
  and a claimed one as the List with no members. So a reader without self-Maps now gets a different List from each
  form (A2's case (e)). A2-1 kept that claimed branch for one reason only: reading the marker as never a copy would
  pass over a provider that still maintains a List with no members (A2-1, Not taken). Item 19's answer can remove that
  reason, so § 7's reading belongs to the same question.
- **Enumerate and the marker (ADR 0003, Consequences of A2, "Not in A2").** § 5.4's Enumerate keeps every list of A's
  whose `d` starts with the scope, retractions included, and § 3's Enumerating line points at it. It is open whether
  Enumerate drops a retraction that § 7 reads as no copy.
- **A change to the supported sets (item 20).** § 9.2's "What the allowance rests on", second case, names only a change
  to the observer's Map. A re-pin changes the supported sets (Pin-based lists, § 8), not the kind 10040. Until the key
  restarts the List, a reader that holds the sets takes the key's old retraction as a maintained List with no members.
- **Wording (items 5, 9, 12 and 13).**
  - 5: in § 9.2's "What a self-entry speaks for", "read as § 9 has an Assistant read an entry" can bring in § 9's limit
    to "the insight kinds and systems it can produce". And "an Assistant's self-entries" literally includes a key that
    serves only itself.
  - 9: § 9.2's Private duties sends "whether they may go in its `.content`" to § 13 question 8, which does not ask it,
    and which is headed "Decided (W22)". The handoff's Open questions line sends Q4 to that question, to Duty Menus
    § 14 question 1, which asks about menus, and to worksheet W22, which is Closed.
  - 12: § 7's older "Alternates are standbys that are already up to date" sits beside the newer "An Alternate whose
    duty is confirmed … is a standby that is ready now".
  - 13: § 10's lead ("I entrust …") and § 5's lead read every entry as a designation.

**What came after the owner's list.**
- **Two items story 4 added to the same row** (`05954589`):
  - principle 8, "A shorter key covers more", names no exceptions, while At a glance now names them;
  - Treasure Maps' Sources line does not list the At a glance wording that ADR 0004's KB-2 changed.

  The frame defines story 5 by a list of items and closes the row with it. So story 4's review (NB6) asks the PO to
  take the two items in with the owner's OK, or move them off the row.
- **Row `2026-10-12-key-grammar-review-fold-forwards`** (story 4's review, NB1–NB6). Five wording and metadata gaps:
  - in Treasure Maps, § 11 "How many colons?", § 10.5's `30382:tag:::<metric>` row, and § 4.3's Content Categories
    citation;
  - in Duty Menus, § 5.2's `not-offered` gloss and the Sources line's ADR 0003 clause.

  Item 6 is NB6's placement question. None of them changes a rule.
- **Two `protocol` rows from ADR 0004** (the owner's answer 3(a)), "for the PO to place in story 5 or a later docs
  pass":
  - `2026-10-12-addressable-kinds-spawning-content-categories`. Spawning § 3.2 and Content Categories read
    "addressable" as NIP-01 does. Spawning also spawns only `30397` for category `39998`, while Treasure Maps § 4.3 now
    gives three List kinds. Two pointer fixes, and one rule: what an Assistant spawns for (T, `39998`);
  - `2026-10-12-bare-39998-ta-discovery`. Assistant Designation's dual-author lookup finds a user's TA from the
    `39998:dlist-header` entry. It does not say whether a bare `39998` entry, the same key under Treasure Maps § 4.5,
    names the TA.

**What book `assistant-self-map` needs from this story.** That open book builds self-Maps that the instance keeps true.
Its records (book § Design notes, story 1, ADR 0001) raise these questions, which this story's rules answer:
- **Its stop points:** a customer leaving, a relay moving, Scores not landing, and the person's Map dropping or
  re-giving a key. None is a change to the person's supported sets (item 20).
- **Turning the self-Map off** (its Decision 1) is no stop: the instance removes the self-entries, and the keys keep
  publishing. Read as § 9.2 now words it, a code book would retract Lists on "off", or under question 1(b) delete
  curation copies. AC1 closes that gap.
- **Lists.** It leaves "§ 9.2 also asks a stopped List to be retracted" to its Architect, and needs item 19's answer
  for a List it keeps with no members. It claims no List yet (its ADR 0001, open question 2), since this instance's
  Lists use their own `d` tags. Ledger row `2026-10-12-list-d-tags-not-treasure-maps`, which that book opened, asks for
  the Treasure Maps `d` tags, with the old ones "retracted or kept as aliases". Item 19's answer says what such a move
  publishes at an old `d`.
- **Concepts** have "no stop to detect". What it does with curation copies when the person's Map drops a Concept key
  is item 10.
- **Supported Scores.** Under a scope key, it reads a `30382` self-entry as speaking for the eleven metrics the instance
  computes (its ADR 0001, open question 1). Item 5's wording says whether § 9's capability limit is part of what a
  self-entry speaks for, so the answer bears on that reading.

It also asks how long a brief gap may last (its story 1, open question 1: two missed runs). § 9.2 gives examples of a
brief gap but no length, and no row asks the spec to set one, so this story does not take it.

**Why it matters.** A self-Map is the key's word that a duty is live. Readers count a copy as maintained on that word
(§ 9.2, Maintained), and switch providers on it (Confirmed duties). These rules decide what a key does when it stops,
when a List empties, and when the supported sets change. They keep that word true, and give every reader one reading
of the marker.

**Who is affected:** implementers of Assistant services that publish self-Maps, Trusted Lists and curation copies
(book `assistant-self-map`, the reference Trusted List publishers, the curation code), and of Treasure Map and Trusted
List readers.

**Proposed scope (the PO, 2026-10-12; the owner decides, open questions 4 and 5).**
- **The frame bullet in full.** Items 5, 9, 10, 12, 13, 19 and 20, and the § 5.4 question (AC1–AC3). With them, § 7's
  reading of the marker, which item 19's answer bears on (open question 2), and the removed self-entry that is no stop
  (AC1). The row closes (AC5).
- **The two late items, and the key-grammar row's items 1–5** (AC4), so that both wording rows close. Reasons:
  - each is a one-line wording or metadata fix in the two specs this story edits, with no rule change and no owner
    decision;
  - they come in pairs. Principle 8 and § 11 make the same claim, which At a glance now qualifies. The two Sources-line
    items sit on lines this story changes anyway, to name its own ADR. Fixing one of a pair leaves the other wrong;
  - taking them closes the self-maps row as the frame says, with nothing moved between rows.
- **Not the two protocol rows.** They go to a later docs pass after the book. Reasons:
  - **Neither is about keeping a self-Map true.** One asks what an Assistant spawns for a Tag in category `39998`. The
    other asks who a user's TA is. Each needs an owner decision on a subject this book has not scoped.
  - **Each widens the files.** The first needs Spawning § 3.2 and Content Categories. The second needs Assistant
    Designation's NIP-85 section and its dual-author lookup, which a shipped reader (`classifyEntry`) follows.
  - **What each leaves meanwhile.** The first leaves no reader with a false answer. Treasure Maps § 4.3 names its
    departure from Spawning and Content Categories. And § 9.2's "A part A does not publish" keeps the self-Map of an
    Assistant that spawns fewer List kinds true, since it narrows. The second leaves the TA lookup reading two ways
    for every Map the shipped editor writes, since the editor keys Concepts as a bare `39998` and `39999` (ADR 0004
    V25). A Map with only those gives no TA or the Assistant given Concepts. With a `39998:dlist-header` entry beside
    them, it gives that TA or the Assistant given Concepts. Shipped `classifyEntry` takes the literal spelling, so this
    instance gives one answer. That state predates this story, is recorded on the row, and touches no self-Map.
- **Size.** Three owner decisions (questions 1–3):
  - one rule in Assistant Designation;
  - one rule in Trusted Lists, with § 7's reader rule and its pointers in § 3 and § 9.2;
  - one sentence in § 5.4.

  On top of those: two wording rules (item 20, and the removed self-entry) and about a dozen one-line fixes. That is
  smaller than story 3, and has fewer decisions than story 4. No split. If the owner picks a non-default answer to
  questions 1–3, the PO checks the size again before approval.

**After this story, the book can close.** This story meets the last frame bullet. These are left for after the book,
each on the surface named:
- the two protocol rows (a later docs pass, under 5(a));
- code. That means rows `2026-10-12-treasure-map-concept-key-readers`, `2026-10-12-duty-menu-code-cross-book-notes`
  (item 1's intake part, and items 2–4) and `2026-10-12-list-d-tags-not-treasure-maps` (book `assistant-self-map`'s
  owner), and whatever AC5 names for the code books;
- two `docs` rows this book's reviews opened, for a later doc-lane pass: `2026-10-10-self-declared-canonical-wording`
  (story 1) and `2026-10-11-tapestry-concepts-namespace-wording` (story 2). Neither is a frame bullet;
- the "canonical" uses already in `treasure-maps.md`: "canonical naddr" and "canonical nevent" in §§ 1, 2, 4.1, 4.3
  and 11, and the metadata's "Canonical" field. Stories 3 and 4 read the frame's "Throughout: no 'canonical' or
  'consensus' in normative text" as covering the text the book adds or changes, and this story reads it the same way.
  The owner confirms that reading at approval, and the close audit records it. AC5 opens a `docs` row for these uses,
  so that they have a surface. Whether "canonical naddr" falls under D2 is that pass's call;
- what the book already leaves out:
  - Duty Menus § 14 questions 1–3;
  - private duties (handoff Q4). After this story, § 13 question 8 asks whether a self-Map may carry them in
    `.content`, but nothing answers it. Until it does, no reader can confirm a privately given duty, and its copies get
    no allowance at its relay. Under 2(a) and 2(b), ADR 0003 A2's other cost for it ends: a List the provider still
    maintains carries no marker, so no reader reads it as no copy. Under 2(c) and 2(d), that cost stays;
  - NosFabrica (Q6);
  - the older `treasure-map.md` draft (row `2026-09-27-old-treasure-map-draft-overlaps`).

## User-facing description

As an implementer of an Assistant service that keeps a self-Map, or of a Treasure Map or Trusted List reader, I want
the specs to say:
- what a key does with its curation copies when it stops curating, and that removing a self-entry is not by itself a
  stop;
- whether a List it still keeps with no members carries the retraction marker, and how a reader takes a List that
  does;
- how Enumerate and the allowance treat a retraction.

I also want the Self-Maps text to read one way. Then a self-Map stays true through a stop, an empty List or a re-pin,
and every reader takes the marker the same way.

## Acceptance criteria

Docs-mode: each criterion is checked by reading the specs as they stand after the change. The criteria hold under the
recommended answers to open questions 1–5. They also hold under every other option there, except those marked "ACs
revised". Where a check names an outcome, the outcome is the one the owner's answer gives.

- [ ] **AC1, curation copies when curation stops (item 10; open question 1).**
  - **What happens to the copies.** In `assistant-designation.md` § Curation copies, a reader finds what the curating
    assistant does with its copies when it stops curating a list, whatever the reason: its Map entry was removed
    (Revocation), the service ended, the key was retired, or it can no longer publish. The section keeps this apart
    from "deletes the copies it no longer accepts", which is the curation method's choice while it curates. *Check:* in
    the section's worked example, Alice republishes her Map without `["39998:dogs", …]`. A reader of Assistant
    Designation alone can say:
    - whether the copies filed under `39998:<alice's assistant pubkey>:dogs` stay on relays or get a NIP-09 deletion;
    - whether the assistant copies or deletes anything for that list afterwards.
  - **The other texts agree.** The per-DList entries' Revocation paragraph agrees with the rule. So does Treasure Maps
    § 9's Revocation bullet, "Insights already published stay on relays", where a Concept is a header with its items
    (§ 2). So does § 9.2's Concepts bullet. Its pointer, "Curation copies follow Assistant Designation § Curation
    copies", leads to a rule for a stop.
  - **A removed self-entry alone is no stop.** § 9.2's What follows a stop does not read a self-entry that its key
    removes while it keeps publishing as a stop. That holds for the Lists bullet's reasons to retract, and for what the
    Scores and Concepts bullets say a removed self-entry signals. The copies rule applies when curation stops, never
    on a self-entry's removal alone. *Check:* Alice's assistant turns its self-Map off. It removes its self-entry for
    `39998:dogs` and keeps curating. A reader of § 9.2 and Assistant Designation can tell two things:
    - nothing is retracted or deleted;
    - the removal ends the self-entry's claim, but does not say that curation stopped.
- [ ] **AC2, one reading of the retraction marker (items 19 and 20, and the § 5.4 question; open questions 2 and 3).**
  - **A List kept with no members (item 19).** Trusted Lists' common wire shape says whether a List whose publisher
    still maintains it, and whose members are all gone, carries `["status", "retracted"]`. Spawning gives the same
    answer or points at Trusted Lists, in § 1 principle 5, § 4's `status` row and § 5's Refresh and Retire. *Check:*
    ask "A still maintains T's List, and its computed members are now none. What does A publish?" A reader of Trusted
    Lists alone and a reader of Spawning alone give the same answer. Under 2(a) and 2(b), both can also say what A
    publishes at the old `d` when it moves the List to another `d` of the same kind (Treasure Maps § 12).
  - **§ 7's reading (open question 2).** Treasure Maps § 7 says how a reader takes a List that carries the marker, as
    the owner's answer gives:
    - under 2(a), as no copy, whatever the provider's self-Map says;
    - under 2(b), as now, but worded as a reader rule for a self-Map that contradicts the marker, not as what the
      marker means;
    - under 2(c) and 2(d), as now.

    Whatever § 7 cites in Trusted Lists still exists and means what § 7 takes it to mean. § 3's list of causes agrees
    with § 7. So do § 9.2's lines on a retraction: the Lists bullet of What follows a stop, and the third and fourth
    cases of What the allowance rests on. *Check:* A has stopped T's List and retracted it. A reader holds an older
    self-Map of A's, whose self-entry still wins the List. A reader of § 7 can say what that reader takes from A for
    T's List, and no sentence of Treasure Maps reads that retraction another way.
  - **ADR 0003 A2's cost.** This story's ADR says how the answer bears on A2's "cost of the owner's choice":
    - cases (e) and (e′);
    - a List given to the provider only by a private entry.

    Under 2(a) and 2(b), that cost arises only for a publisher that marks a List it still maintains, and such a
    publisher no longer conforms. Under 2(c) and 2(d), the cost stays. Under 2(a), the ADR also records the change to
    A2-1, as the owner approved it: the reading A2-1 calls Reading 2, which it did not take only because of case (e).
    ADR 0003's text is not edited.
  - **Enumerate (§ 5.4).** § 5.4 says what Enumerate does with a List that carries the marker, and § 3's Enumerating
    line agrees. *Check:* under the scope `30396:tag:⟨D⟩`, A has three lists:
    - one with members;
    - one retracted, which a self-entry of A's still wins and speaks for;
    - one retracted, which no self-entry of A's claims.

    A reader of § 5.4 can say which of the three Enumerate lists. Under 3(a), its answer for each matches what § 7
    makes of that List.
  - **A change to the supported sets (item 20).** In § 9.2's "What the allowance rests on":
    - the second case names a change to the observer's supported sets beside a change to its Map;
    - the second or third case says what a reader that holds the sets sees between a re-pin (Spawning § 5's Restore)
      and the key's restart of the List: the key's old retraction, as § 7 reads it.

    *Check:* T is re-pinned, and A has not yet restarted T's List. A reader of § 9.2 can tell that the allowance does
    not rest on A's word for that List, and what such a reader then sees.
- [ ] **AC3, the rest of the Self-Maps row (items 5, 9, 12 and 13).** Each gets the change the row asks, or another
  change that meets its check:
  - **Item 5.** In § 9.2's "What a self-entry speaks for":
    - a reader can tell that § 9's "limited to the insight kinds and systems it can produce" is not part of what a
      self-entry speaks for. *Check:* take Duty Menus § 13.2's menu (`3038x` → R, `not-offered 30385`) and the
      observer's `["3038x", A, R]`. No reading of the paragraph makes a `3038x` self-entry true for A, as the example
      under "A part A does not publish" says;
    - the sentence on an Assistant's self-entries does not read as covering a key that serves only itself. The
      paragraph's own sentence for such keys still governs them.
  - **Item 9.** Three changes:
    - § 13 question 8 asks whether a self-Map may carry private duties in its `.content`, and its "Decided (W22)"
      label no longer reads as covering that question;
    - § 9.2's Private duties points at it;
    - the handoff's Open questions line sends a reader looking for Q4 to § 13 question 8. Any other place it still
      names for Q4 is marked for what it is: Duty Menus § 14 question 1 as the question for menus, and W22 as Closed.

    The handoff's § 9 list stays as written, as history, since the handoff is superseded. *Check:* each Q4 pointer in
    the handoff's Open questions line leads to the self-Map question, or to a place that the line says asks something
    else.
  - **Item 12.** § 7's bullet on Alternates says what the Map asks of an Alternate. It says "ready now" only of a
    confirmed one. *Check:* from § 7 alone, a reader cannot take an Alternate whose duty is not confirmed to be up to
    date.
  - **Item 13.** § 10's lead says that a self-entry, in its own key's Map, is read as § 9.2 says, and not as the "I
    entrust …" of the tables. § 5's lead does not say otherwise. *Check:* given the TA's `["39998", TA, R]` in the TA's
    own kind 10040, a reader of § 10 is sent to § 9.2.
- [ ] **AC4, wording left from story 4 (open question 4).** Under 4(a), each item gets the change its row asks, or
  another change that meets its check:
  - **Principle 8 and § 11** (the self-maps row's late item 1; the key-grammar row's item 1). Treasure Maps § 1
    principle 8 and § 11 "How many colons?" each give the exceptions that At a glance names, or point at them: the
    Profiles category (§ 4.4) and a Concept key's `d` (§ 4.5). *Check:* none of At a glance, principle 8 and § 11 calls
    `30392:tag::⟨Podcaster⟩` a scope, or gives a Concept key a system's fixed number of colons.
  - **§ 10.5** (key-grammar row, item 3). The `30382:tag:::<metric>` row says the Profiles category, as the
    `30382:tag::<Tag>` row does.
  - **§ 4.3** (key-grammar row, item 4). Its Content Categories citation names the opening table of the four category
    types.
  - **Duty Menus § 5.2** (key-grammar row, item 2). The `not-offered` gloss reads per insight. *Check:* with
    `["not-offered", "30385"]` and `["duty", "30385:rank", R]`, § 5.2 does not say that the rank insights are not
    offered.
  - **The Sources lines** (the self-maps row's late item 2; the key-grammar row's item 5). Two clauses, one in each
    spec:
    - Treasure Maps' ADR 0004 clause names the At a glance wording that ADR 0004 changed;
    - Duty Menus' ADR 0003 clause names Amendments A1 and A2, and § 9's Counting Maps pointer.

    *Check:* those two clauses list those items. The lines' other clauses are outside this AC. AC5's Metadata bullet
    covers this story's own ADR.

  Under 4(b), this AC keeps the first and last bullets only. Under 4(c), it keeps none, and AC5's ledger bullets
  change to match.
- [ ] **AC5, bookkeeping and gates.**
  - **The ledger.**
    - Row `2026-10-12-self-maps-spec-fold-forwards` is DONE. A dated note says where each item landed: items 5, 9, 10,
      12, 13, 19 and 20, the § 5.4 question, and the two late items. The row's story-4 addendum sits in date order
      (story 4's review, NB6). Under 4(c), before the row flips:
      - the two late items are added to row `2026-10-12-key-grammar-review-fold-forwards` as numbered items, each with
        its ask: principle 8's gloss, and Treasure Maps' Sources line against At a glance;
      - that row's item 6 is marked resolved;
      - the self-maps row's note says that the two items moved there.
    - Row `2026-10-12-key-grammar-review-fold-forwards` is DONE under 4(a), with a dated note. Under 4(b) or 4(c), a
      dated note says what was done here and that the rest goes to the later docs pass, and the row stays OPEN.
    - Rows `2026-10-12-addressable-kinds-spawning-content-categories` and `2026-10-12-bare-39998-ta-discovery` each get
      a dated note that names the owner's placement (open question 5). Under 5(a), both stay OPEN for a later docs pass
      after this book.
    - Row `2026-10-12-list-d-tags-not-treasure-maps` gets a dated note on how question 2's answer bears on its move to
      Treasure Maps `d` tags: what is published at an old `d`, whether retracted or kept as an alias. The same note says
      how the answer bears on the reference Trusted List publishers' use of the marker (item 19).
    - A new `docs` row holds the "canonical" uses already in `treasure-maps.md` (After this story).
  - **Earlier ADRs.** This story's ADR records how ADR 0003 A2's NB10 and § 5.4 question were answered, and, under
    2(a), the change to A2-1. The text of ADR 0003 and ADR 0004 is not edited.
  - **Shipped code and book `assistant-self-map`.** An answer may depart from shipped code, or bear on what book
    `assistant-self-map` builds. Where one does, a ledger row, or a dated note on an existing row, names the difference
    for the code books. That covers:
    - what the instance does with curation copies when curation stops (item 10);
    - that book's stop points (item 20), its supported-Scores reading (item 5) and its Concepts upkeep (item 10);
    - that turning its self-Map off is no stop under any answer, so nothing is retracted or deleted (AC1).

    The marker's use by the reference publishers goes on the list-`d`-tags row (above). No code changes.
  - **Metadata.** Each spec this story changes names this story's ADR in its Sources line, where it has one, for the
    sections that now rest on it.
  - **One place for each wire fact.**
    - What the marker means, as its publisher's act, is normative in Trusted Lists alone. Spawning agrees with it or
      points at it.
    - What happens to curation copies when curation stops is normative in Assistant Designation alone. Treasure Maps
      § 9 and § 9.2 agree with it or point at it.
    - How a reader takes a List that carries the marker is normative in Treasure Maps § 7. § 3, § 5.4 and § 9.2 point
      at it or agree with it, and none reads a retraction another way.
  - **Vocabulary.** No "canonical" or "consensus" appears in any text this story adds or changes
    (`docs/NIP_REORG_DESIGN_HANDOFF.md` D2).
  - **Gates.** Every link and § reference resolves. `harness-lint` is clean. The stack-free `npm test` shows no
    regression.
  - **Scope.** Inside `protocols/`, changes are limited to:
    - `drafts/treasure-maps.md`;
    - `drafts/duty-menus.md`: § 5.2 and the Sources line;
    - `drafts/assistant-designation.md`: § Curation copies, the per-DList entries' Revocation paragraph where it must
      agree, and the Sources line;
    - `drafts/trusted-lists.md`: the marker's bullet and the Sources line;
    - `drafts/spawning.md`: only its lines on the marker (§ 1 principle 5, § 4's `status` row, § 5), where open
      question 2's answer needs them.

    Outside `protocols/`, this story changes only:
    - the handoff's Open questions line (item 9);
    - the ledger rows above, and any new row AC5 needs.

    No change to BIBLE, Content Categories, the README, the worksheet, or the text of ADRs 0003 and 0004. Any epic and
    book edits that the owner's answers need are made at approval (see Approval), not by this story's later phases.

## Concepts touched

None are changed (docs-mode). The story names these, but does not change them:
- curation copies, which are kind-`39999` events;
- the curated header, a kind-`39998` DList header;
- the Trusted List kinds `30392`–`30397`.

No firmware reinstall.

## Out of scope

- **The two protocol rows**, subject to open question 5. Under the recommended answer they go to a later docs pass
  after this book, and each stays OPEN with a dated note:
  - `2026-10-12-addressable-kinds-spawning-content-categories` (Spawning § 3.2, Content Categories, and what an
    Assistant spawns for (T, `39998`));
  - `2026-10-12-bare-39998-ta-discovery` (whether a bare `39998` entry names a user's TA).
- **Any code.** That includes:
  - row `2026-10-12-treasure-map-concept-key-readers`;
  - row `2026-10-12-duty-menu-code-cross-book-notes`: item 1's intake part, and items 2–4;
  - row `2026-10-12-list-d-tags-not-treasure-maps`, which book `assistant-self-map`'s owner places. This story adds
    only a dated note;
  - the reference Trusted List publishers;
  - the curation code;
  - book `assistant-self-map`'s upkeep, its "off" button and its readers.

  They follow the answers in the code books. AC5 only names any difference.
- **How long a brief gap may last.** Book `assistant-self-map` chose two missed runs. § 9.2 sets no length, and no row
  asks it to. If the owner wants the spec to set one, that needs a new row.
- **Answering the private-duties question.** Item 9 asks it in § 13 question 8. Settling it is handoff Q4, which the
  book leaves out.
- **The reader rule A2-1 did not take**, for a failed send of a retraction. The owner approved ADR 0003 A2 without it.
- **Spawning beyond its lines on the marker, and Content Categories.**
- **Duty Menus § 14 questions 1–3**, NosFabrica adoption (Q6), and Nous publishing the header.
- **The older draft `protocols/drafts/treasure-map.md`** (row `2026-09-27-old-treasure-map-draft-overlaps`).
- **The two `docs` rows from stories 1 and 2** (After this story).
- **The `canonical` uses already in `treasure-maps.md`.** AC5's vocabulary gate covers only text this story adds or
  changes. AC5 opens a `docs` row for them.

## Open questions

These are owner decisions. The story needs each one before approval, and each has a recommended default. If the
Architect finds a default unsound, the question goes back to the owner rather than falling back to another option.

1. **What does a stopped assistant do with its curation copies?** (Item 10.) Every option applies when curation stops,
   never on a removed self-entry alone (AC1).
   - (a) **Keep them.** The copies stay, as the header and its `b` do, and the assistant stops copying and deleting.
   - (b) **Delete them.** As it stops, the assistant sends a NIP-09 deletion for each copy, in Removal's form, and the
     curated header is left with no items. A key that can no longer publish cannot send them, so its copies stay.
     Treasure Maps § 9's "Insights already published stay on relays" gains an exception.
   - (c) **Either.** The assistant MAY keep them or delete them, and § 9's Revocation bullet says so. Readers then
     cannot tell a stopped curation from its copies either way.

   **Recommended: (a).** It matches what the specs already keep at a stop:
   - the header and its `b` (Assistant Designation, Revocation);
   - published insights (Treasure Maps § 9, Revocation), a Score's values among them (§ 9.2, What follows a stop).

   Other headers may point at the header, and its items are the owner's curation as it last stood. (b) empties that
   curation for every reader, and a later re-grant must copy everything again. NIP-09 deletion is also a request that
   relays may ignore, so (b) cannot promise an empty list. The cost of (a): a reader that reads neither the owner's Map
   nor the self-Map takes the frozen copies for live curation, as it already takes the header.
2. **Does a List that is still maintained, with no members, carry the retraction marker? And how does § 7 then read a
   List that carries it?** (Item 19, with ADR 0003 A2-1.)
   - (a) **No, and a marked List is never a copy.** A publisher publishes a List it still maintains with its members,
     even when there are none, and never marks it. The marker means that the publisher stopped maintaining the List at
     that `d`, for any reason: a retirement, a hand-off, a move off a kind, or a move to another `d` (Treasure Maps
     § 12). Trusted Lists' "a list that no longer has members" is reworded. Spawning's "on retirement" already says
     this. Treasure Maps § 7 then reads a List that carries the marker as no copy, whatever the provider's self-Map
     says (A2-1's Reading 2), and § 3 and § 9.2 follow.
   - (b) **No, and § 7 keeps A2-1's claimed branch.** The publisher rule is as in (a). § 7 still reads a retraction
     that a self-entry claims as the List with no members, now as a reader rule for a self-Map that contradicts the
     marker.
   - (c) **Yes.** Any List with no members carries the marker, maintained or not, as Trusted Lists reads today.
     Spawning's Refresh then says so. A2-1 stands.
   - (d) **Either.** Both specs allow both forms. A2-1 stands.

   **Recommended: (a).**
   - It is what Spawning and the reference publisher already do, and § 12 already asks for it at a move.
   - It gives the marker one meaning, "stopped", for its publisher and for every reader.
   - A2-1 kept its claimed branch for one reason: reading the marker as never a copy would pass over a provider that
     still maintains a List with no members (case (e)). Under (a), such a provider does not mark the List, so the
     reason is gone. The branch would then fire only on a stale claim, or in item 20's re-pin window. There A has in
     fact stopped or not yet started, and the branch would show A's empty List in place of the next Alternate's.
   - Without the branch, the readers that cannot tell (§ 9.2's third and fourth cases; A2's cases (b), (c2) and (c3))
     get the same answer as those that can.

   The cost of (a):
   - Trusted Lists' text changes;
   - a publisher that marks a List it still maintains no longer conforms, and readers pass it over for the next
     Alternate, though they show no stale members;
   - A2-1, which the owner approved, changes. This story's ADR records the change.

   (b) keeps A2-1's words, but under (a)'s publisher rule its branch fires only on stale claims, and reads them wrong.
   (c) keeps Trusted Lists' text, but makes case (e)'s cost permanent. (d) keeps both of the readings that item 19
   found.
3. **What does Enumerate do with a retracted List?** (The § 5.4 question.)
   - (a) **As § 7 reads it.** Enumerate lists a List that carries the marker only where § 7 takes it as a copy, and
     § 5.4 points at § 7. Under 2(a) that is never, so Enumerate drops every retraction. Under 2(b)–(d), it keeps one
     that a self-entry of A's still wins and speaks for, as A's List with no members.
   - (b) **Keep every list.** Enumerate lists everything A has under the scope, retractions included. § 5.4 says that
     a client reads each list by § 7 before using it.
   - (c) **Drop every retraction.** Enumerate never lists a List that carries the marker. Under 2(a), this is (a).
     Under 2(b)–(d), § 5.4 then disagrees with § 7 where a self-entry claims the List, and AC5's one-place bullet does
     not hold (ACs revised).

   **Recommended: (a).** § 5.4 says that Enumerate shows "which lists an Assistant actually publishes". (a) makes that
   mean what § 7 means, so the marker reads one way across the spec. ADR 0003 A2 set out to do that: "One reading of
   the marker", with "§ 7 holds the rule, and § 3 and § 9.2 point at it". Under 2(a), an enumerating client needs no
   self-Map for it. Under 2(b)–(d), it must read A's self-Map to keep a claimed retraction. One that does not leaves
   out every retraction, as § 7 does without a self-Map. (b) is the smallest change, but it lists as "actually
   published" a List that § 7 says is no copy.
4. **Do the two late items and the key-grammar row ride in this story?**
   - (a) **All of them.** This story takes both late items and the key-grammar row's items 1–5, and both rows close.
   - (b) **The late items and their twins.** This story takes both late items, and their twins on the key-grammar row:
     item 1 (§ 11) and item 5 (Duty Menus' Sources line). Items 2–4 stay on that row for the later docs pass.
   - (c) **The review's suggestion.** Move both late items to the key-grammar row, and take none of that row. This story
     then covers the owner's list alone, and the key-grammar row goes to the later docs pass with seven items.

   Each option closes the self-maps row, as the frame says. (a) and (b) widen this story past the epic's item list, so
   they need the owner's OK (story 4's review, NB6).

   **Recommended: (a).** The reasons are under Proposed scope. The cost is about seven one-line changes, each with a
   check for the review.
5. **Where do the two protocol rows go?**
   - (a) **A later docs pass, after this book.** Each row gets a dated note, and both stay OPEN.
   - (b) **Take `2026-10-12-bare-39998-ta-discovery` into this story,** since the story edits Assistant Designation
     anyway. That adds one owner decision (does a bare `39998` entry name a user's TA?), one sentence and an AC (ACs
     revised). The other row goes to the later pass.
   - (c) **Take both.** That adds Spawning § 3.2, Content Categories, and a rule for what an Assistant spawns for
     (T, `39998`). The PO would split them into a story 6 in this book, and the frame would gain a bullet (ACs
     revised).

   **Recommended: (a).** Neither row is about keeping a self-Map true, and each needs an owner decision on a subject
   this book has not scoped. Against (a): the bare-`39998` row leaves the TA lookup reading two ways for every Map the
   shipped editor writes (ADR 0004 V25), and (b) would settle that in a file this story already edits. The PO still
   recommends (a) for three reasons:
   - the question is who a user's TA is, not what a self-Map claims;
   - the two readings predate this story and are recorded on the row;
   - the shipped reader gives one answer meanwhile.

Docs-mode note: Test Design is skipped. There is no executable behavior, and the ACs are checked by reading the specs.

**Approval.** At approval the PO commits this story together with the epic. The epic's story-5 entry then records the
owner's answers to questions 2, 4 and 5. Only 5(c) changes the book's frame: it adds a bullet and a story 6. At the
same gate the owner confirms the book's reading of the frame's "Throughout" (After this story), which the close audit
records.

## Deviations

None.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: skipped (docs-mode)
- Review: (filled in after Review phase)
