# Story 4: The Treasure Maps key grammar

**Status:** Draft
**Created:** 2026-10-12
**Type:** Doc

## Background

To resolve Treasure Map keys against menu rows, story 2 (Duty Menus) needed to know exactly what each key matches. It
found three places where Treasure Maps does not say. ADR 0002 Amendment A1 gave the Duty Menus spec a provisional
reading of each one. At story 3's approval the owner moved settling them in Treasure Maps to this story (story 3,
open question 2(a)), and added the book's last frame bullet for it
([`engineering-team/audits/duty-menus-and-self-maps/book.md`](../../audits/duty-menus-and-self-maps/book.md)). The three
questions:
- **The Concept kinds (ADR 0002 A1-8).**
  - § 4.5 gives a bare `39998` "all of the observer's Concept headers", but never says what a bare `39999` covers. Yet
    `/treasure-map`'s editor writes both on every Concepts assignment (ledger row `2026-10-09-draft-grammar-bare-39999`).
  - § 6 has no order between a `39999` key and a bare `39998`. So its "this always picks one winning key" is not true for
    headers declared as kind-39999 items.
  - A Concept kind followed by a colon and nothing else (`39998:`, `39999:`) reads two ways: as the bare kind with an
    empty segment (§ 4.4), or as a Concept key with an empty `d` (§ 4.5).
  - Treasure Maps is not the only spec that says how a Concept key reads. § 4.5 says Concept keys "keep the shape
    ratified in" Assistant Designation, which glosses the blanket entry as "for my kind-39998 DList headers" and splits
    a per-DList key at the first colon ("everything after it is the d-tag"). Trusted Lists repeats that split for the
    `39998`/`39999` families. Whatever Treasure Maps settles, those sentences must agree with it or point at it, or the
    frame's "each wire fact is normative in exactly one place" fails.
- **Category `39998` (A1-9).**
  - § 4.3 gives `30397` "the *DList headers* category (`39998`)" and `30394` "an addressable event kind". It does not
    say whether the first takes `39998` away from the other kinds. Content Categories (§ 1.3, § 2) counts headers of
    four kinds, which may be referenced by id, by address or as lists.
  - Nor does it say whether replaceable kinds (0, 3, 10000–19999) count as addressable for `30394`. NIP-01 references
    them by address (story 2's review round 3, finding 18).
- **The profiles category slot (A1-10).** § 4.4 says "for profiles the category slot is always empty and doesn't count".
  That predates § 13 question 3, which made a DList whose subject is `p` a category of `30392`.

Until this story lands:
- the Duty Menus spec's provisional readings hold (§ 5.3, § 6.2 step 1, § 14 questions 5–7);
- two sentences story 3 wrote in Treasure Maps wait on A1-8: § 3's on a key that is a Concept kind and a colon alone,
  and § 9.2's Ties;
- story 3 carries a provisional departure from its AC3 under Ties (ADR 0003 A2-4), which the owner confirmed. It ends
  when this story orders the Concept kinds.

Why it matters: two careful readers of the same Map can pick different providers or relays for one insight. ADR 0002's
models found that readers holding different readings get wrong relays that no one is told about.

Who is affected: implementers of Treasure Map readers and writers (Tapestry's `/treasure-map`, Brainstorm, other NIP-85
clients), of Duty Menu readers, and of Assistant services that publish menus and self-Maps. That includes the open book
`assistant-self-map`, whose key matching follows these answers (`engineering-team/stories/_intake.md`, "Duty Menus and
Self-Maps in code").

**Proposed scope (the PO, 2026-10-12; the owner decides, open question 5).** This story covers the book's last frame
bullet in full:
- the three questions, settled in Treasure Maps, with the sentences in Assistant Designation and Trusted Lists that say
  how a Concept key reads (AC1–AC3);
- Duty Menus following the answers (AC4);
- the rest of ledger row `2026-10-11-duty-menus-spec-fold-forwards`, so that the row closes (AC5).

It also takes the items that sit on the same text:
- the Self-Maps sentences that wait on A1-8, and story 3's review NB3 (AC1);
- the end of story 3's provisional AC3 departure;
- small metadata and bookkeeping items (AC6).

It leaves out most of the Self-Maps fold-forwards from story 3's review (ledger row
`2026-10-12-self-maps-spec-fold-forwards`), and proposes a story 5 for them. Reasons:
- **The frame does not need them.** The last frame bullet names the three questions, Duty Menus following, and one
  ledger row. The Self-Maps row is not that row.
- **They are different work.** The row has ten items left, and one question in its note. Item 3 (NB3) turns on the
  Concept order, and items 8 and 15 sit on lines this story changes, so those three ride here. The other seven items
  and the question touch no key grammar:
  - item 10 needs an owner decision and new normative text in Assistant Designation;
  - item 19 needs a rule in Trusted Lists or Spawning;
  - item 20 and the § 5.4 Enumerate question are about how a reader takes a retracted List;
  - items 5, 12 and 13 are optional rewordings, and item 9 adds a question to § 13.
- **Size.** Story 3 ran to eight ACs, two ADR amendments and two review rounds. This story already carries three
  owner decisions with sub-parts, and nine wording fixes.

Within the frame there is no split. The wording fixes sit in the § 6.2 paragraphs that AC4 changes, and most are one
line, so a story of their own would add a full cycle for one-liners. If the owner picks a non-default answer to
questions 1–4, the PO re-checks the size before approval and may move A1-10 to a story of its own.

## User-facing description

As an implementer of a Treasure Map reader or writer, a Duty Menu reader, or an Assistant service, I want Treasure Maps
to say exactly what each Concept key, category-`39998` key and profile key matches, and how § 6 orders them. Then every
reader picks the same provider and relay for an insight, and the other specs point at one rule instead of carrying
readings of their own.

## Acceptance criteria

Docs-mode: each criterion is checked by reading the specs as they stand after the change. The criteria hold under the
recommended answers to open questions 1–4, and under every other option there except those that say they need the ACs
revised. Where a check names an outcome, the outcome is the one the owner's answer gives.

- [ ] **AC1, the Concept kinds (A1-8; open questions 1 and 2).** In `treasure-maps.md`, a reader finds:
  - **What the bare kinds cover.** What a bare `39998` covers, including whether it covers headers declared as kind-39999
    items, and what a bare `39999` covers. § 4.5, § 10.1 and § 10.12 say the same.
  - **The order.** How § 6 orders a `39999` key against a bare `39998`, so that "this always picks one winning key" holds
    for Concept keys. *Check:* with a Map `["39998", A, …]`, `["39999", B, …]`, a reader of § 6 gets exactly one
    provider for a `39998:<d>` header, and exactly one for a header declared as a kind-39999 item.
  - **A Concept kind and a colon.** What `39998:` and `39999:` mean as a Map entry's key, a menu row's key and a
    self-entry's key. All three read alike, or the spec says why one differs. § 4.7's grammar reads `39998:` and
    `39999:` as the answer says: not a key, the bare kind, or a Concept key with an empty `d`.
  - **The other specs that say how a Concept key reads.** In `assistant-designation.md`, the text on what the blanket
    entry covers and the per-DList entry's split rule, and in `trusted-lists.md`, the split sentence for the
    `39998`/`39999` families, give Treasure Maps' answers or point at Treasure Maps for them. *Check:* a reader of
    either spec alone, given a Map entry keyed `39998:`, and a header declared as a kind-39999 item under a blanket
    entry, gets Treasure Maps' answer or is sent to Treasure Maps.
  - **Self-Maps follows.**
    - § 3's sentence on "a K that is a Concept kind and a colon alone" no longer waits for the NIP to settle it.
    - § 9.2's Ties says what holds under the order, and no longer points at Duty Menus § 14 question 5 as open.
    - § 9.2's rule for a self-entry keyed `39998:` or `39999:` agrees with the answer above.
    - § 9.2's "MUST NOT add a self-entry that speaks for none of the insights it wins" and the order agree (story 3's
      review, NB3). *Check:* a reader can tell whether the self-Map `{39998 → Rc, 39999 → Rd}` is allowed. ADR 0003
      sub-decision 2 calls that self-Map normal.
    - *Check (story 3's review, B2):* with A's self-Map `{* → R0, 39998 → Rc, 39999 → Rd, 39999:c1 → Rd}` and the
      observer's `[39999:c1, A]`, a reader finds which of A's self-entries wins that header, or the spec says why none
      does.
    - No self-Map claim becomes false under the answer. ADR 0003 sub-decision 2 holds only for an answer that does not
      rank a bare `39998` above `39999`.
  - **The reserved `duty-menu`.** § 4.6's rule still holds: no key reaches a kind-39999 header whose `d` is `duty-menu`.
- [ ] **AC2, category `39998` (A1-9; open question 3).** Treasure Maps § 4.3 says:
  - which List kinds take category `39998`, and so which Score kinds do, and whether that agrees with Content Categories
    § 1.3 and § 2. Where it departs from them, it says so. *Check:* for `3039x:tag:39998`, a reader of § 4.3 can list
    the List kinds whose lists the key matches;
  - whether replaceable kinds count as addressable for `30394` (finding 18). *Check:* for `3039x:tag:10002`, a reader
    gets one answer for which List kinds' lists the key matches;
  - § 10.10's and § 10.11's category-`39998` keys still read true.
- [ ] **AC3, the profiles category slot (A1-10; open question 4).** § 4.4's profiles bullet is restated, agrees with
  § 13 question 3, and answers four things:
  - whether an empty category in a `30392` or `30382` key is the Profiles category. *Check:* whether `30392:tag::⟨T⟩`
    covers `30392:tag:⟨D⟩:⟨T⟩`, where D is a DList whose subject is `p`;
  - whether `30392:tag::` is the same key as `30392:tag`;
  - whether a profile kind has a key for a Tag, Pin or metric in every category. If it has none, the spec says so;
  - whether an empty category in a family or `*` key reaches a profile kind's DList categories. *Check:* whether
    `3039x:tag::⟨T⟩` matches `30392:tag:⟨D⟩:⟨T⟩`.

  § 6's table, § 10.5's rows, and § 13 questions 2 and 3 agree with § 4.4.
- [ ] **AC4, Duty Menus follows.** In `duty-menus.md`:
  - **No provisional reading remains.** Each of these follows Treasure Maps' answer, stated there and pointed at here:
    - § 5.3's rule for rows keyed `39998:` or `39999:`;
    - § 6.2 step 1's lead ("this spec reads it as below until Treasure Maps settles it"), its Concept-kinds bullets, its
      category-`39998` clause and its profiles exception;
    - step 1's event-kind-number clause ("`30393` for a non-addressable kind, `30394` for an addressable one"), which
      follows Treasure Maps § 4.3's answer for replaceable kinds (finding 18). *Check:* for `3039x:tag:10002`, both
      specs give the same List kinds;
    - step 4's two exceptions for meets.

    No sentence says that Treasure Maps leaves these questions open.
  - **§ 14.** Questions 5–7 are marked resolved, each with a pointer, as question 4 is.
  - **A Map key `39998:` or `39999:`** (finding 19). A reader can tell what it matches, its rows within, and its meets,
    or that it has nothing to resolve.
  - **The examples.** Where an answer differs from the provisional reading, § 6.2's and § 13.3's examples change to
    match. *Check:* Duty Menus § 6.2, with § 13.2's menu and K = `39999` kept for A, gives the entry that Treasure
    Maps' answer to open question 1 implies: `["39999", "<A>", "wss://concepts.example"]` (answering row `39998`)
    under 1(a), and `["39999", "<A>", ""]` under 1(b).
- [ ] **AC5, the rest of Duty Menus' wording.** Each item gets the change story 2's review round 3 asked for, or
  another change that meets its check:
  - finding 12: step 5's second "no substitute" example says "changes nothing under K", and the bullet says that such a
    key may still take insights outside K from other entries;
  - finding 13: step 2's "the same row answers for every insight under K" no longer reads as "wins every insight".
    *Check:* with § 13.2's menu and K = `3038x`, step 2 does not contradict `not-offered 30385` winning the `30385`
    insights;
  - finding 15: § 8.1's "a relay, too, returns only the latest version" states NIP-01's level (SHOULD);
  - finding 17, two parts:
    - a menu reader gets one answer for whether an ignored `duty` row takes part in § 5.3's duplicate check. *Check:*
      `["duty", "3038x", ""]` followed by `["duty", "3038x", "wss://r"]`;
    - § 4 and § 5.4 say which `json` tag counts when a menu carries several;
  - finding 22: § 5.1's "still names a provider" uses § 2's terms (an Assistant, not a Provider);
  - finding 23: a reader of § 2, § 6.2 step 3 and § 13.3 finds one term for each of the outcomes for `3038x` and
    `3039x` under § 13.2's menu. No term reads as "every insight is offered" for a key that has a `not-offered` part;
  - finding 24: § 8.2 says where to send its `#z` query, and § 4's "a `#z` query on that handle finds them all" is
    limited to the relays that hold the menus;
  - § 2's "its own key included" in "the observer's own Assistant" is dropped, or the spec says where it applies
    (ledger row `2026-10-11-duty-menus-spec-fold-forwards`, the note from ADR 0003 A1-2);
  - § 14 question 3 asks what the self-entries of a key that serves several observers speak for, as Treasure Maps § 9.2
    says it does (ledger row `2026-10-12-self-maps-spec-fold-forwards`, item 8).
- [ ] **AC6, bookkeeping and gates.**
  - **The ledger.**
    - Rows `2026-10-09-draft-grammar-bare-39999` and `2026-10-11-duty-menus-spec-fold-forwards` are DONE, each with a
      dated note saying where its items landed. The second row's title no longer says story 3 (story 3's review,
      CONF-4).
    - Row `2026-10-12-self-maps-record-loose-ends` is DONE. Each item is done by the role it names, and item 4 (the
      PO's) goes in with the record revision below.
    - Row `2026-10-12-self-maps-spec-fold-forwards` gets a dated note: items 3, 8 and 15 are done here, and the rest go
      where the owner's answer to open question 5 sends them. Its title names that place instead of story 4 (story 5
      under 5(a), no story under 5(b)). Under 5(c) it is DONE.
    - Row `2026-10-12-duty-menu-code-cross-book-notes` gets a dated note. Item 1's spec texts and handoff text are done
      here. Its intake part, and items 2–4, stay with the code books.
  - **Story 3's record.** The PO revises the record's AC3 line on the Ties departure (ADR 0003 A2-4) to match the
    order this story sets, as that line asks.
  - **Earlier ADRs' story numbers.**
    - ADR 0003 reads ADR 0002's "story 3" for A1-8, A1-9 and A1-10 as this story. This story's ADR records how each of
      those items was answered.
    - ADR 0003 A2, approved by the owner, leaves NB10 (the self-maps row's item 10) "for story 4's ADR". Under 5(a) or
      5(b), this story's ADR records that this now means where the owner's answer sends it, and the self-maps row's
      note points there.
    - Neither ADR's text is edited, except ADR 0003 at items 2 and 3 of the loose-ends row.
  - **Metadata and landing lists** (Self-Maps row item 15; cross-book row item 1):
    - each spec's Sources line names this story's ADR for the sections that now rest on it. Duty Menus' line also names
      § 6.2 step 1's last bullet and § 7, which rest on ADR 0003;
    - Duty Menus' Implementation line and `protocols/README.md`'s Duty Menus row say what the reference deployment
      builds now;
    - the README's Treasure Maps row mentions Self-Maps and the read-time fallback;
    - the handoff's Status line no longer says that no code is built, now that part of it is, and its § 5 landing line
      names Assistant Designation § Relationship to NIP-85.
  - **Shipped code.** The answers bear on shipped code: the `/treasure-map` card rule and editor, the server's
    Scores/Lists/Concepts check that uses the card rule, and book `assistant-duty-menu`'s menu reading, its duplicate
    check included (AC5, finding 17). Where an answer departs from what that code does, a ledger row or a dated note on
    the cross-book row names the difference for the code books.
  - **One place for each wire fact.** What a key matches, and how § 6 orders keys, is normative in Treasure Maps alone.
    Duty Menus points at it, and Assistant Designation and Trusted Lists agree with it or point at it (AC1). The older
    draft `treasure-map.md` still conflicts on the wire, and its own row tracks that (Out of scope).
  - **Vocabulary.** No "canonical" or "consensus" in any text this story adds or changes (`docs/NIP_REORG_DESIGN_HANDOFF.md`
    D2).
  - **Gates.** Every link and § reference resolves, `harness-lint` is clean, and the stack-free `npm test` shows no
    regression.
  - **Scope.** Inside `protocols/`, changes are limited to:
    - `drafts/treasure-maps.md` and `drafts/duty-menus.md`;
    - the sentences AC1 names in `drafts/assistant-designation.md` and `drafts/trusted-lists.md`;
    - `README.md`.

    Outside it, this story's changes are:
    - the handoff's Status and § 5 landing lines;
    - story 3's file: the record, and the loose-ends row's item 1;
    - ADR 0003, at the loose-ends row's items 2 and 3;
    - the ledger rows above, and any new row that names a difference from shipped code.

    No change to BIBLE or to Content Categories. The epic and book edits that the owner's answer to open question 5
    needs are made at approval (see Approval), not by this story's later phases.

## Concepts touched

None changed (docs-mode). Treasure Map keys are strings inside kind 10040 entries (NIP-85), not concept-graph concepts.
The Concept kinds `39998` and `39999`, which are DList headers and items, are named, not changed. No firmware reinstall.

## Out of scope

- **The rest of the Self-Maps fold-forwards**, subject to open question 5: ledger row
  `2026-10-12-self-maps-spec-fold-forwards`, items 5, 9, 10, 12, 13, 19 and 20, and the § 5.4 Enumerate question in its
  note of 2026-10-12. Under the recommended answer they go to a planned story 5, which follows this one because both
  edit Treasure Maps § 9.2 and § 13.
- **Assistant Designation and Trusted Lists beyond the sentences AC1 names.** That includes Assistant Designation
  § Curation copies (the Self-Maps row's item 10), which goes where open question 5 sends it.
- **The older draft `protocols/drafts/treasure-map.md`** and its retirement. Ledger row
  `2026-09-27-old-treasure-map-draft-overlaps` (OPEN) tracks its conflict with `treasure-maps.md`. Open question 1 cites
  it as evidence only.
- **Any code**, including the shipped code that reads these keys:
  - the `/treasure-map` card rule and editor, and the server's check that uses the card rule;
  - book `assistant-duty-menu`'s menu reading;
  - the readers' key matching that book `assistant-self-map` and the later code book build.

  They follow the answers in the code books. The intake entry already says the code waits on this story's answers.
  AC6 only names any difference.
- **The cross-book row's code-side items**, which stay in ledger row `2026-10-12-duty-menu-code-cross-book-notes` for
  the code books:
  - item 1's intake part. The code books' pick-up notes on the intake entry already say what is built, but its
    "Replaces, does not add" bullet still calls the Duty Menu card a placeholder;
  - item 2, the relay reconcile list;
  - item 3, the hub's self-entry reading, which book `assistant-self-map` now takes, and the "own assistant" naming
    note;
  - item 4, the `/i` edge. If that book's owner prefers the spec-side fix, "any case variant counts", it comes back as a
    docs item.
- **New grammar.** A key for a Tag in every category of a profile kind is out of scope, unless the owner picks 4(b).
  So is § 13 question 2's "any category" list.
- **Content Categories.** It is not edited. If the answer to open question 3 departs from it, Treasure Maps says so
  (AC2). Option 4(c) would need it edited, so that option needs the scope revised.
- **The `canonical` uses already in `treasure-maps.md`** (§§ 1, 2, 4.1, 4.3 and 11, and the metadata's "Canonical"
  field). AC6's vocabulary gate covers only text this story adds or changes.
- **Duty Menus § 14 questions 1–3**, apart from item 8's clause in question 3 (AC5). Also out of scope: private duties
  (handoff Q4), NosFabrica adoption (Q6), and Nous publishing the header.

## Open questions

Owner decisions this story needs before approval. Each has a recommended default. Where a provisional reading exists,
the default makes it final. If the Architect finds a default unsound, the question comes back to the owner rather than
falling back to another option.

1. **What do the bare Concept kinds cover, and how does § 6 order them?** This is A1-8, and the decision ledger row
   `2026-10-09-draft-grammar-bare-39999` asks for.
   - (a) A1-8's reading, made final:
     - a bare `39998` covers every Concept key, `39999` headers included;
     - a bare `39999` covers the `39999:<d>` keys;
     - a `39999` kind slot beats a bare `39998` in § 6, as an exact kind beats a family.
   - (b) Two separate kinds. A bare `39998` covers only `39998:<d>`, and a bare `39999` only `39999:<d>`, so no order is
     needed between the bare kinds. ADR 0002 A1-8 set this aside for two reasons:
     - it reads § 4.5's "all of the observer's Concept headers" against its words;
     - a menu that offers `39998` alone would leave the editor's `39999` entry with an empty relay.
   - (c) A bare `39999` is another spelling of a bare `39998`, written only for readers that look a kind up exactly
     (the ledger row's second option), as `39998:dlist-header` is today. Both cover every Concept key, and entries under
     either spelling are one key's providers, in Map order (§ 7). A `39999:<d>` key still takes (a)'s order against
     them. The cost falls on self-Maps: ADR 0003 sub-decision 2's `{39998 → Rc, 39999 → Rd}` becomes two self-entries
     with one key, so under § 9.2 no single one wins a Concept and the self-Map claims none. Sub-decision 2 would need
     amending, which these ACs do not carry, so (c) needs the ACs revised.

   Any order that ranks a bare `39998` above a `39999` key is not offered. Under it, sub-decision 2's self-Map
   `{39998 → Rc, 39999 → Rd}` claims 39999-declared headers at Rc while A publishes them at Rd, which is false (AC1).
   It too would need sub-decision 2 amended.

   Evidence beyond Treasure Maps:
   - Assistant Designation glosses the blanket entry, which § 4.5 makes the same key as a bare `39998`, as "for my
     kind-39998 DList headers". Its table calls it "blanket … for all the user's DList-header authorship". (a) and (c)
     agree with the table, and AC1 brings the gloss into line. (b) agrees with the gloss.
   - The owner's earliest statement on a bare `39999`, in the older draft `treasure-map.md`, makes
     `[39999, <assistant_pubkey>, <relay>]` a valid entry because a header "can be kind 39999 rather than kind 39998".
     It does not say whether a bare `39998` also covers such headers. Each option keeps the entry valid.

   **Recommended: (a).** It matches the wording of § 4.5 and § 10.1, the card rule's reading, and what Duty Menus reads
   now. The editor's `39999` entry gets the relay a menu gives `39998` (ADR 0002 A1-8's § 13.2 example). And self-Maps
   stay true, since the answer does not rank `39998` above `39999` (ADR 0003 sub-decision 2).
2. **What is a key made of a Concept kind and a colon alone (`39998:`, `39999:`)?** This is A1-8's other half, with
   finding 19.
   - (a) It is not a key. Readers ignore a Map entry, menu row or self-entry keyed so, and writers write the bare kind.
     That is today's provisional rule for menu rows (Duty Menus § 5.3) and self-entries (Treasure Maps § 9.2), extended
     to Map entries. Treasure Maps § 4.5 and § 4.7, Assistant Designation's per-DList split rule and Trusted Lists'
     split sentence then each leave out a key with nothing after the colon, or point at the rule that does (AC1).
   - (b) It is the bare kind: `39998:` is `39998`. That is how § 4.4 trims every other trailing empty segment, and how
     § 13 question 12 reads `*:` as `*`. Duty Menus would then read such a row as the bare kind's row, under its
     duplicate rule, Self-Maps would follow, and the three split texts would trim it.
   - (c) It is a Concept key with an empty `d`: the header whose `d` is the empty string, which NIP-01 allows. This is
     what Assistant Designation's per-DList entry ("everything after it is the d-tag") and Trusted Lists' split
     sentence say today, and how Treasure Maps § 4.5 ("the rest is the `d` tag, verbatim") and § 4.7's grammar read
     literally. § 6 would then need a rule so that it beats the bare kind, as `39998:<d>` does, rather than tying with
     it (ADR 0002 A1-8).

   Shipped code reads the key both ways. Book `assistant-duty-menu`'s menu reading ignores such rows, as (a) does. The
   `/treasure-map` card rule and editor, and the server's check that uses the card rule, read a Map entry keyed
   `39998:` as (c): a Concept key on its own, counted for Concepts and not trimmed to `39998`.

   The cost of each:
   - (a): no key names a Concept header whose `d` is empty, and an entry keyed `39998:` that another client wrote is
     ignored, whatever its writer meant. It changes four spec texts (§ 4.5, § 4.7, Assistant Designation, Trusted
     Lists) and the shipped Map reading.
   - (c): it keeps those four texts and the Map reading, but changes both provisional rules and the shipped menu
     reading, and adds a § 6 rule. A writer who meant "all Concepts" by `39998:`, as `*:` means `*`, gets a key for
     one header.
   - (b): it is the most forgiving reading. It changes both provisional rules, the three split texts, and both shipped
     readings.

   **Recommended: (a).** This is the closest of the five calls. It makes final the rule in both places that already
   have one, and it is the cautious reading: since no rule has said what such a key means, no reader acts on one, so no
   two readers act on it differently. No known writer writes such a key, since the editor writes the bare kinds. (c) is
   a sound alternative if the owner prefers to keep the texts that state the split today.
3. **Which List and Score kinds take category `39998`, and do replaceable kinds count as addressable?** This is A1-9,
   with finding 18.
   - Which kinds take category `39998`:
     - (a) A1-9 made final: `30393`, `30394` and `30397`, and their Score kinds `30383`, `30384` and `30387`;
     - (b) `30397` and `30387` only. This reads § 4.3's bullet as a mapping, as § 10.10's examples do;
     - (c) `30394` and `30397`, and their Score kinds. This is the literal § 4.3 reading, since `39998` is an
       addressable kind number.
   - Replaceable kinds (0, 3, 10000–19999):
     - (a) They count as addressable, so they take `30394`. NIP-01 references them by address, and Content Categories
       § 2 gives "items referenced by address" `30394`;
     - (b) "Addressable" means NIP-01's 30000–39999 only, so replaceable kinds take `30393`.

   **Recommended: (a) for both.** As a settled rule, the first follows Content Categories § 2: the List kind says how
   members are referenced. So the *DList headers* category gives `30393` for headers referenced by id (`9998`, `9999`),
   `30394` for those referenced by address (`39998`, `39999`), and `30397` for headers taken as lists. One header
   tagged T can then sit in a `30394` list and a `30397` list for the same Tag, and Treasure Maps needs no departure
   from Content Categories. Its cost: an Assistant given `3039x:tag` or `*` is asked for all three List kinds for
   category `39998`, while § 8, § 10.10 and § 10.11 name only `30397` and `30387` (AC2 checks that those still read
   true). (b) gives one List kind per category, as § 10.10 reads, but a Tag-based list of headers taken as events then
   has no key, and Treasure Maps names its departure from Content Categories (AC2). (c) leaves out headers referenced
   by id. A side note: ADR 0002's models found (a) the only reading under which a reader that built a narrower one
   meanwhile gets no wrong relay without a warning.

   The second has no provisional reading to make final. Its (a) follows the same Content Categories rule that § 4.3's
   category slot already takes.
4. **What does an empty category mean in a profile key?** This is A1-10.
   - (a) A1-10 made final, in all four parts:
     - an empty category left after trimming, in a `tag` or `pin` key whose kind slot is `30392` or `30382`, is the
       Profiles category, so `30392:tag::⟨T⟩` is exact;
     - a trailing empty category is trimmed, so `30392:tag::` is `30392:tag`;
     - a profile kind has no key for a Tag, Pin or metric in every category, and the spec says so;
     - in a family or `*` key, an empty category means any category, judged by the key's own kind slot. So
       `3039x:tag::⟨T⟩` reaches `30392:tag:⟨D⟩:⟨T⟩`.
   - (b) As (a), but add a key for a Tag in every category of a profile kind. This is new grammar. It would also give a
     key to the Duty Menus meets that have none.
   - (c) "Any" everywhere: an empty category means any category in profile keys too, and the Profiles category gets
     another spelling. This reverses § 6's table, § 10.5 and § 13 question 2. It also departs from Content Categories
     § 2, which gives the Profiles category the empty slot. That spec is out of scope, so (c) needs the scope revised.
   - (d) As (a), but family and `*` keys are judged by each insight's kind.

   **Recommended: (a).** It is how § 6's table, § 10.5 and § 13 question 2 already read profile keys, and how Duty Menus
   reads them now. ADR 0002 A1-10's models compared the readings for family and `*` keys. Per key, meets never reach
   outside K. Per insight, meets reach outside K about five times as often as per-key meets fall short. (b) can come
   later without changing (a).
5. **Where do the remaining Self-Maps fold-forwards go?** These are items 5, 9, 10, 12, 13, 19 and 20 of ledger row
   `2026-10-12-self-maps-spec-fold-forwards`, and its § 5.4 Enumerate question.
   - (a) A planned story 5 on this epic and in this book. The owner adds a frame bullet: "ledger row
     `2026-10-12-self-maps-spec-fold-forwards` is closed (story 5)". The epic gets a story-5 entry and a Goal bullet,
     and the book's "stories 1–4" line becomes "stories 1–5". The book closes after story 5. Story 5 follows this one.
   - (b) A later docs pass outside this book. The row stays OPEN, retitled to name no story, and the book can close
     after this story.
   - (c) Into this story. Item 10 adds new normative text to Assistant Designation beyond the sentences AC1 names. The
     PO revises the ACs before approval, with the size risk story 3 showed.

   (a) and (b) change a placement the owner approved. ADR 0003 A2's questions for the owner, approved at its gate,
   leave NB10 (item 10) "for story 4's ADR". Story 3's open question 2 called out the same kind of change. AC6 records
   the new placement. The § 5.4 question, which A2 left "for story 4 or a later docs pass", fits either.

   **Recommended: (a).** Items 10, 19 and 20 say what a key does when it stops curating, keeps an empty List, or meets a
   change to the supported sets. Those are the rules that keep a self-Map true, and book `assistant-self-map` is building
   self-Maps that the instance keeps true. The spec should settle them before that code settles them by default. (a)
   also keeps Self-Maps' spec work in the book that ratifies Self-Maps. The cost is one more story before the book
   closes, and a second extension of the frame.

Docs-mode note: Test Design is skipped. There is no executable behavior, and the ACs are checked by reading the specs.

**Approval.** At approval the PO commits this story with the epic, whose story-4 entry then records the owner's answer
to open question 5. Under 5(a), the commit also carries the book's new frame bullet and its "stories 1–5" line, and the
epic's story-5 entry and Goal bullet, as story 3's approval did for story 4.

## Deviations

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: skipped (docs-mode)
- Review: (filled in after Review phase)
