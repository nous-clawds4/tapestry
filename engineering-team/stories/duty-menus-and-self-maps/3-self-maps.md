# Story 3: Self-Maps

**Status:** Approved
**Created:** 2026-10-11
**Type:** Doc

## Background

The handoff ([`docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md`](../../../docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md))
splits one question in two (D1):
- what an Assistant key *offers*, which is its Duty Menu;
- what it is *actively* publishing, which is its own Treasure Map, a *self-Map*.

Story 2 ratified the first half as `protocols/drafts/duty-menus.md`. Its § 10 says that *active* is for the key's own
Map to say, and points at Treasure Maps § 9. Nothing there says it yet.

Without this story, three things in the specs go wrong:
- **A self-Map would create duties.** Under Treasure Maps § 9, an entry naming an Assistant is a duty, unless it names
  someone else's Assistant ("Naming someone else's Assistant"). A self-entry is neither case. So an Assistant whose own
  Map names itself would keep a duty alive after its customer dropped it (handoff § 5).
- **A self-Map would break a stated rule.** `protocols/drafts/assistant-designation.md` § Authorship says "A TA cannot
  designate itself", and the instance's Tapestry Assistant is meant to publish a self-Map too.
- **Some insights have nowhere to be found.** Treasure Maps § 3 gives element 3 as "a relay where the insight can be
  found" and allows the empty string, but gives a reader nothing to do when the insight isn't there. Story 2 left
  insights in that state: those in a differing row's part (`duty-menus.md` § 6.2 step 4), and insisted keys that carry
  the empty string (step 5). Two places in `duty-menus.md` (§ 6.2 step 5 and § 14 question 4) wait on Treasure Maps for
  read-time resolution. The same gap is behind the live defect in ledger row
  `2026-10-10-external-assistant-relay-left-empty`, whose code fix is a later book.

This story covers the book's frame bullet 3 (Self-Maps in `treasure-maps.md`, and the narrowed sentence in
`assistant-designation.md`) and the handoff flip in frame bullet 4
([`engineering-team/audits/duty-menus-and-self-maps/book.md`](../../audits/duty-menus-and-self-maps/book.md)).
It also takes story 2's carry-forwards that belong with Self-Maps.

Who is affected: implementers of Tapestry, Brainstorm and other NIP-85 providers and clients. They need to say what an
Assistant publishes right now, read that claim, and find an insight when the relay written in a Map is empty or wrong.

**Proposed scope (the PO, 2026-10-11; the owner decides, open question 2).** Story 2 left a long list of
carry-forwards: the epic's story-3 bullets and the 14 items plus finding 27 in ledger row
`2026-10-11-duty-menus-spec-fold-forwards`. This story takes only those that belong with Self-Maps, and a planned
story 4 takes the rest. ADR 0002 and the owner's gate of 2026-10-11 say that story 3 settles A1-8, A1-9 and A1-10, so
moving them changes terms the owner set. Reasons for the split:
- **They are different kinds of work.** Self-Maps are the handoff's settled design (D1, D6, § 5), and the frame already
  confirms them. The key-grammar questions (A1-8, A1-9, A1-10) are something else: three owner decisions about what
  Treasure Map keys mean for every reader, with or without Self-Maps. They came out of story 2's resolution rules, not
  out of the handoff. If they rode along here, Self-Maps would wait on three unrelated decisions.
- **Size.** Story 2 took three review rounds and seven fix passes for one new spec. The frame's bullet 3 already has
  eight parts. Adding three grammar decisions and the wording items would make a story that no one review can carry.
- **What stays here pairs with Self-Maps:**
  - the read-time fallback, whose first stop is the self-Map;
  - the self-entry's place ahead of the menu when element 3 is filled (finding 26);
  - the two qualifiers on the insisted-key relay and the no-guess rule, which the fallback and finding 26 rely on:
    "insight under K" means in principle (finding 14), and the level of § 6.2 step 5's obligations (finding 20);
  - "the observer's own Assistant" (finding 21);
  - telling a menu from a Concept header at the address `duty-menu` (the epic's `39999:duty-menu` bullet, finding 16).
- **The rest of `duty-menus.md`'s wording goes with story 4, not to a separate doc pass.** Findings 12, 13 and 19 sit
  in § 6.2 paragraphs that story 4 changes to follow its grammar answers, and finding 19 is A1-8's own. Finding 17
  touches § 5.3, which A1-8's answer also changes, and finding 18 rides A1-9. Finding 23 spans § 2, § 6.2 step 3 and
  § 13.3. Findings 15, 22 and 24 are one-line fixes. Putting them in one planned story closes the ledger row in one
  place and means nothing waits on a lane that hasn't been planned.

## User-facing description

As an implementer of an Assistant service, a Tapestry instance or a NIP-85 client, I want Treasure Maps to say:
- what an Assistant's own Map means;
- how a reader uses it;
- where a reader looks when the relay in a Map doesn't hold the insight.

That lets an Assistant tell everyone which duties it is publishing now, without giving itself duties. A client switching
a duty between two Assistants can see which one is already live. And a reader can still find an insight when the relay
written in the Map is empty or wrong.

## Acceptance criteria

Docs-mode: each criterion is checked by reading the specs as they stand after the change. The criteria assume the
recommended answer to open question 2. If the owner picks another, the PO revises them before approval.

- [ ] **AC1, a self-Map is not a customer's Map.** In `treasure-maps.md`, a reader finds that:
  - a self-entry creates no duty and designates no one. An Assistant takes duties only from entries that name it in the
    Maps of the observers it serves.
    - *Check:* observer O's Map drops A for key K, and A's self-Map still lists K. A reader of § 9 concludes that A has
      no duty for K from O.
    - *Check:* the self-entry rule and § 9's existing "Naming someone else's Assistant" rule read as one. For any
      entry, a reader can tell which of the two applies, if either.
  - if `p` tags are adopted for finding Maps (§ 13 question 5), an Assistant skips Maps it wrote itself;
  - the counting rule is stated for outside clients, in the form the owner chooses in open question 5. It covers counts
    of adopters, of participation, and of points of view to enumerate. *Check:* under either answer, an Assistant key
    that serves other observers, and whose Map holds only self-entries, is not counted as an adopter.
- [ ] **AC2, what a self-Map says.** A new § 9.2 defines:
  - **Terms:** *self-entry* and *self-Map*.
  - **Meaning:** a self-entry means "published and maintained at this relay", not merely assigned.
  - **Timing:**
    - added once the first full set of insights has landed on the named relay;
    - kept through brief gaps;
    - removed before upkeep stops.
    - The spec says what follows removal for every insight family: Scores, Lists and Concepts (Treasure Maps principle
      4). For Lists that is the existing retraction convention (`trusted-lists.md`). For Scores the removal is the
      "stopped" signal.
  - **Content:**
    - a self-entry names only the Map's author;
    - its key is the customer's winning key, copied verbatim;
    - its element 3 is the relay where the insights actually are.
    - Where A publishes the insights under one key at more than one relay, the spec says what the self-entry's element
      3 means and whether A may add narrower self-entries. A key with a differing row at another relay
      (`duty-menus.md` § 6.2 step 4) is such a key. The spec also says which of handoff § 5's "one entry per key" and
      "where the insights actually are" gives way. AC4's case 1 checks the result.
    - A self-entry never copies the customer's Preferred/Alternate order or the customer's other providers. A self-Map
      may also carry ordinary entries (AC7).
    - Private duties never go in a self-Map's public tags.
  - **No expiration** (D6).

  `treasure-maps.md` § 9.2 and `duty-menus.md` § 10 point at each other: the menu says *offered*, and the self-Map says
  *active*.
- [ ] **AC3, reading a self-Map.** In Treasure Maps' own terms (Preferred and Alternate, § 7; no new "Backup" term), a
  reader finds that:
  - a **confirmed duty** is an entry naming A in the observer's Map plus a matching self-entry in A's Map. "Matching"
    means the same key, or a key that wins for it under § 6.
  - a confirmed Alternate is a standby that is ready now;
  - a key that lists a duty in its self-Map counts as maintained whatever the insights' age. This refines § 7's "older
    than they'll accept";
  - before relying on a self-entry to switch providers, a client SHOULD spot-check a few insights, because the
    self-entry is a claim and the events are the proof;
  - a Map entry names who is asked to publish. It does not promise that the insight exists;
  - reading a self-Map as a point of view is coherent, and it shows only that key's slice.
- [ ] **AC4, the relay is a hint, with a read-time fallback.** `treasure-maps.md` § 3 says:
  - element 3 is a hint, written when the entry was written;
  - when an insight is not found at the relay its winning entry gives, a reader has a fallback, whatever the cause:
    an empty relay, an unreachable one, or a reachable one that doesn't hold that insight. The fallback re-resolves
    that insight, not the entry's key, against A's current self-Map, then A's Duty Menu, then A's kind 10002 write
    relays as a last resort;
  - whether a storefront menu's rows count in the menu step, consistent with `duty-menus.md` § 7;
  - the order between this fallback and § 7's fallback to the next Alternate. *Check:* for a key with Preferred A and
    Alternate B, where A's insight is not found at element 3, the specs give one answer for whether a reader runs A's
    fallback before moving to B, or the other way round. § 7's fallback sentence agrees with § 3.

  *Check:* for each of these four cases, a reader can trace where to look next:
  1. an insight in a differing row's part (`duty-menus.md` § 6.2 step 4). Where that row offers at another relay, the
     trace reaches that row's relay, not the relay of K's answering row, even when A's self-Map has an entry for K;
  2. an insisted key whose entry carries the empty string (step 5);
  3. a key whose Assistant has no menu found;
  4. the last resort, A's kind 10002 write relays (D3's fallback locator).

  Two more checks:
  - The fallback stays a read-time act. It does not contradict `duty-menus.md` § 6.2 step 5's rule against writing a
    guess into element 3. Each of step 5's obligations states its level, that rule included (finding 20).
  - `duty-menus.md` nowhere says that Treasure Maps lacks read-time resolution. § 6.2 step 5 ("What the entry
    guarantees") and § 14 question 4 both point at the Treasure Maps rule.
- [ ] **AC5, a self-entry when the relay is filled.** When a client fills element 3 of an entry that gives K to A, the
  specs say:
  - **The self-entry comes first.** A's own self-entry for K, if any, gives the relay ahead of the Duty Menu's
    answering row (handoff § 6 step 1, kept by ADR 0002's Consequences of A1).
  - **How it composes with an insisted key.** *Check:* take an insisted key K (`duty-menus.md` § 6.2 step 5) where A's
    self-Map names a relay for K. Reading both specs gives one answer for element 3, and they agree on it.
  - **The insisted key's relay does not move with supported sets.** Every "insight under K" in `duty-menus.md` § 6.2
    means in principle (Treasure Maps § 8), as covering already does (finding 14). *Check:* with menu
    `not-offered 3039x`, `30396:tag` → R1, `30393:tag` → R2, and K = `3039x` kept for A, a reader gets the same entry
    whatever Tags the observer supports.
  - **When no menu is found.** Where A has no self-entry for K and no menu of A's is found, the specs give one answer
    for element 3. This is the case A1 left with the handoff's § 6 steps 3–4. A key whose menu is found but does not
    offer it stays as A1-4 settled it (`duty-menus.md` § 6.2 step 5).
- [ ] **AC6, the address `duty-menu`.** A reader of the specs finds that:
  - the Concept key `39999:duty-menu` never resolves to a Duty Menu, and a Duty Menu is never read as a Concept header;
  - Nous' header and every dictionary copy (`39998:<author>:duty-menu`) stay valid under Treasure Maps' rule for
    reserved words;
  - no Map key asks an Assistant to publish a Concept header at its own menu's address (`39999:<A>:duty-menu`).
    *Check:* this holds for the key `39999:duty-menu` and for the bare Concept kinds `39998` and `39999`, under any
    answer story 4 gives A1-8;
  - `duty-menus.md` § 6.1 says whether its conditions for "is a menu" are complete, and what a reader does with a kind
    39999 event at `d` = `duty-menu` that declares itself a header. *Check:* two readers given the same event agree on
    whether it is a menu (finding 16).
  - `duty-menus.md` § 4's reservation of `duty-menu` as the `d` of a kind-39999 menu stays (ADR 0002 sub-decision 2).
    What `treasure-maps.md` § 4.6 says about `duty-menu` follows the owner's answer to open question 1, and each fact
    about `duty-menu` is normative in one spec only.
- [ ] **AC7, self-Maps from keys the observer runs.**
  - `assistant-designation.md` § Authorship forbids a TA designating itself *on anyone else's behalf* (handoff § 5). Its
    own self-Map therefore no longer contradicts it, and the rest of the user-signed designation is unchanged.
  - Treasure Maps says:
    - the instance's TA publishes a self-Map of what it actually publishes for its owner;
    - that self-Map is never the TA's source of duties;
    - the TA's kind 10040 is both its self-Map and the instance's own Map (the instance as its own person, BIBLE §31).
      Entries in it that name other providers are ordinary entries.
  - Treasure Maps says what the Map of a person who runs their own key as their own Assistant means, so that "a
    self-entry means active" holds for every key.
  - `duty-menus.md` defines "the observer's own Assistant", the one exception to § 7's MUST NOT, per the owner's answer
    to open question 4. The definition is consistent with Self-Maps and with its open question 3 (finding 21).
- [ ] **AC8, bookkeeping and gates.**
  - **Tracking what stays open.** Before the handoff flips, an OPEN ledger row or `_intake.md` entry carries handoff
    Q6 (NosFabrica adoption) and the handoff's later code plan (§ 6 and § 8's engineering steps), beyond what ledger row
    `2026-10-10-external-assistant-relay-left-empty` already covers. It also points at the two placeholder cards the
    `assistant-duty-cards` book added to the Assistant Management hub (Duty Menu, `/assistant/duty-menu`; Your
    Assistant's Treasure Map, `/assistant/treasure-map`), which the later code book replaces rather than duplicates,
    and at that book's open product questions (`engineering-team/audits/assistant-duty-cards/prd-seed.md` § 7).
  - **The handoff.** Its Status line flips as the owner answers open question 3 (finding 27; frame bullet 4). The
    flipped line says:
    - where each part landed in `protocols/`;
    - where each § 9 question still open is now tracked: Q4 private duties, and Q6 NosFabrica adoption at the surface
      above. It also says that Q5 and Q7 were settled by the owner on 2026-10-10;
    - that the code in its §§ 6–8 is a later book and is not built, and where it is tracked. A session that scans
      `*HANDOFF*` Status lines must not read SUPERSEDED as shipped.
  - **The ledger.**
    - Row `2026-10-11-duty-menus-spec-fold-forwards` records which items this story handled and that the rest went to
      story 4. It stays OPEN.
    - Row `2026-10-09-draft-grammar-bare-39999` names story 4, not story 3, as where Treasure Maps settles it. It stays
      OPEN.
  - **ADR 0002's "story 3".** That ADR 0002's "until story 3" and "story 3 settles" for A1-8, A1-9 and A1-10 now mean
    story 4 is on record: in this story's ADR, the epic and the bare-39999 row. ADR 0002's accepted text is not edited
    (ledger row `2026-10-11-implementer-edited-accepted-adr`).
  - **One place for each wire fact** (frame bullet 4). The Self-Map rules and the read-time fallback are normative in
    Treasure Maps, and `duty-menus.md` points to them rather than restating them.
  - **Vocabulary.** No "canonical" or "consensus" in any text this story adds or changes (`docs/NIP_REORG_DESIGN_HANDOFF.md`
    D2).
  - **Gates.** Every link and § reference resolves, `harness-lint` is clean, and the stack-free `npm test` shows no
    regression.
  - **Scope.** Inside `protocols/`, changes are limited to `drafts/treasure-maps.md`, `drafts/assistant-designation.md`
    and `drafts/duty-menus.md`. No BIBLE change: handoff § 8 adds the BIBLE pointer when code ships.

## Concepts touched

None changed (docs-mode). Self-Maps are kind 10040 events (NIP-85), not concept-graph concepts. The Duty Menu header,
`39998:15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270:duty-menu`, is named, not changed, and is still
unpublished. No firmware reinstall.

The counting rule (AC1) decides whose activity is counted for others, which is what Show and Tell covers
(`design-philosophies/show-and-tell.md`). The Architect should read it before writing the rule.

## Out of scope

- **Story 4 (planned), the Treasure Maps key grammar and `duty-menus.md`'s remaining wording**, subject to open question
  2. Each grammar question needs an owner decision:
  - A1-8: the two Concept readings and the order of `39998` and `39999` keys. This is ledger row
    `2026-10-09-draft-grammar-bare-39999`, together with finding 19.
  - A1-9: which kinds take category `39998`, with finding 18 (are replaceable kinds "addressable"?).
  - A1-10: the profiles category slot.

  The other wording items from ledger row `2026-10-11-duty-menus-spec-fold-forwards` also go to story 4: findings 12,
  13, 15, 17, 22, 23 and 24. Until story 4 lands, `duty-menus.md`'s provisional readings (§ 6.2 step 1, § 14 questions
  5–7) stay in force.
- **Any code:**
  - publishing menus and self-Maps;
  - the counting rule in this instance's queries and pages;
  - `/treasure-map`'s fill order, its per-card Not offered/Offered/Active states and its "Make preferred" swap (handoff
    § 6);
  - the fix for ledger row `2026-10-10-external-assistant-relay-left-empty`.

  All of these come in a later book (the book's "Not in this book").
- **Private duties** in a self-Map's `.content` (handoff Q4; Treasure Maps § 13 question 8). This story keeps them out
  of public tags and settles nothing more.
- **NosFabrica adoption** (handoff Q6), beyond giving it a tracking surface (AC8).
- **Nous publishing the header**, which happens outside the repo.
- **The `canonical` uses already in `treasure-maps.md`**: "canonical naddr" and "canonical nevent" in §§ 1, 2, 4.1, 4.3
  and 11, and the metadata header's "Canonical" field. AC8's vocabulary gate covers only text this story adds or
  changes.
- **ADR 0002's ratification fix** (review round 3 finding 25), done in `ab8f2f2b`. Its ledger row is DONE.

## Open questions

Owner decisions this story needs before approval. Each has a recommended default.

**Answered by the owner, 2026-10-11, at story approval:** the recommended default for all five: 1 (a), 2 (a), 3 (a),
4 (a), 5 (a). The book's acceptance frame gains the story-4 bullet that 2 (a) calls for.

1. **What does "`duty-menu` is reserved" mean in Treasure Maps?** The book's frame bullet 3 says "§ 4.6: `duty-menu` is
   reserved". Today:
   - `duty-menus.md` § 4 already reserves `duty-menu` as the `d` of a kind-39999 menu. No key may use it for any other
     kind-39999 event (ADR 0002 sub-decision 2). That already answers the handoff's reason for reserving it (§ 4.2):
     `39999:<d>` is also a Concept key, and such a key would ask an Assistant to publish a header at the address of its
     own menu.
   - Treasure Maps § 4.6's rule for reserved words forbids them as any Concept `d`. Listing `duty-menu` there as it
     stands would forbid Nous' header and every dictionary copy, which ADR 0002's Consequences rule out.

   The options:
   - (a) Treasure Maps § 4.6 names `duty-menu`, points at `duty-menus.md` § 4 for the reservation, and adds only what it
     means for Map keys: `39999:duty-menu` names no Concept, and `39998:duty-menu` stays legal. The reservation is
     normative in `duty-menus.md` alone, and the key rule in Treasure Maps alone.
   - (b) Treasure Maps § 4.6 stays as it is. `duty-menus.md` § 4 remains the only statement, and AC6's key rules sit
     wherever the Architect places them. The owner rereads the frame's "§ 4.6" as met by `duty-menus.md` § 4.
   - (c) A general reservation in § 4.6, as the frame's words read literally. This forbids Nous' header and its copies,
     so D4 and D10 would have to be reopened, and ADR 0002 amended.

   **Recommended: (a).** It keeps the frame's words, places each fact in the spec that owns it, and keeps ADR 0002's
   constraint. If the Architect finds (a) unsound, the question comes back to the owner rather than falling back.
2. **Should the carry-forwards be split, and where does story 4 live?** The owner confirmed A1-8 "as the spec's reading
   of the bare Concept kinds until story 3" (ADR 0002, gate 2026-10-11). ADR 0002 also says story 3 settles A1-9 and
   A1-10. Ledger row `2026-10-09-draft-grammar-bare-39999` stays OPEN "until … story 3". The split in the Background
   changes those terms.
   - (a) Split, with story 4 on this epic and in this book. ADR 0002's "story 3" for A1-8, A1-9 and A1-10 then means
     story 4, and the A1-8 provisional reading holds until story 4 (AC8 records this). The owner extends the
     acceptance frame with a bullet for story 4: the three grammar decisions and the remaining `duty-menus.md` wording.
     Then completion detection does not fire after story 3. The epic's Goal and the book's "stories 1–3" line follow.
   - (b) Split, with a new epic and book for story 4. This book closes after story 3, and the provisional readings hold
     until the new book's story lands. Frame bullet 4 ("each wire fact is normative in exactly one place") is the
     catch. While story 4 is open, `duty-menus.md` holds provisional readings of rules that belong to Treasure Maps.
     At story 3's close, the owner either rereads bullet 4 as met or keeps this book open until the new one lands.
   - (c) No split. Story 3 also settles A1-8, A1-9 and A1-10 and the remaining wording, as ADR 0002 says. The PO
     revises the ACs before approval.

   **Recommended: (a).** The reasons for splitting are in the Background. Keeping story 4 in this book means the frame
   anchors all of the remaining work, and the book doesn't close while `duty-menus.md` still holds provisional
   readings. Ledger row `2026-10-11-duty-menus-spec-fold-forwards` also closes with story 4.
3. **When does the handoff flip to ✅ SUPERSEDED?**
   - (a) In this story. After story 3, every part of the handoff's design is in `protocols/`, and story 4's questions
     aren't in the handoff.
   - (b) When the book closes.

   **Recommended: (a).** The Status line is wrong today (finding 27). Under (b) it stays wrong for another story. One
   cost: the flip takes the handoff off the open roll-up (`/whats-open` lists only 🔴 handoffs), so Q6 and the code plan
   would drop out of sight. AC8 puts them on an open tracking surface before the flip.
4. **What is "the observer's own Assistant"?** It is the one exception to `duty-menus.md` § 7's MUST NOT.
   - (a) A key the observer itself runs: its own instance's TA, or a key it runs as its own Assistant.
   - (b) Any key the observer names in its Map.

   **Recommended: (a).** Under (b), the exception covers every storefront key an observer names, which is the case
   § 7's MUST NOT exists to stop. Open question 3 (non-personalized providers) stays open either way.
5. **Does the counting rule leave out a person who serves as their own Assistant for every duty?** That person's Map is
   all self-entries, so a rule that skips Maps made only of self-entries drops them from counts of adopters, of
   participation, and of points of view to enumerate. A person who names other Assistants for some keys is still
   counted.
   - (a) Accept it, and say so in the spec. Outsiders can't tell such a person from an Assistant without classifying
     keys, and the owner set that aside (handoff § 3).
   - (b) Narrow the rule so such a person still counts. The Architect looks for a signal that needs no key
     classification. If there is none, fall back to (a).

   **Recommended: (a).** Such people are rare today. The cost (one person's point of view not enumerated by others'
   counts) is smaller than reopening key classification. Revisit when such users exist.

Docs-mode note: Test Design is skipped. There is no executable behavior, and the ACs are checked by reading the specs.

## Deviations

Implementer, 2026-10-11 (ADR 0003, under the owner's answers 1(a)–4(a)). Judgment calls the ADR does not dictate:

- **The PO's record is not here yet.** ADR 0003 has the PO record, in this section at its gate, what AC2's "copied
  verbatim" and AC3's "only that key's slice" now read as (question 1), and how AC5's "one answer" reads (question 2).
  It was absent when implementation began. The Implementer does not write it. The specs follow ADR 0003 under 1(a)
  and 2(a).
- **`treasure-maps.md` § 9.2, prose around the quoted rules.** A one-line lead, and a notation sentence (`<key>` → R and
  `not-offered <key>`, as in Duty Menus § 6.2). Four examples taken from the ADR's sub-decision 3 and its AC2 checks:
  `*` → R0 with `3038x` → R1, the nested row, meets that order the other way, and § 13.2's `not-offered 30385`. A
  "Ties" paragraph from sub-decision 2's rationale ("as for a bare `39998` and a `39999` key until this NIP orders
  them"; reworded at fix 1, below). "(TA)" defined at first use, since Treasure Maps did not define it. The confirmed
  Alternate stays normative in § 7, and § 9.2 points there. "This refines § 7's 'older than they'll accept'" is left
  out, because § 7's new text already links the allowance to § 9.2.
- **`treasure-maps.md` § 3, the storefront bullet.** Written from sub-decision 6's guidance: storefront rows never count
  in step 2 for any reader, and Duty Menus § 7's own-Assistant exception is for filling entries, not reading them.
- **`treasure-maps.md` small placements.** § 2's new "Self-entry, self-Map — § 9.2" line sits after "Supported sets".
  Trusted Lists' retraction convention is linked to its `#common-wire-shape` anchor (the ADR links the file only). The
  enumeration sentence's punctuation changed for grammar only.
- **`duty-menus.md` § 6.2 step 5.**
  - The no-guess rule became its own bullet, "No guess", right after the insisted key. Its scope is now every automatic
    fill, not only insisted keys, and the insisted-key bullet points at it. It stays in step 5, as the ADR says.
  - The ADR's guidance sentence on which clients the MUSTs bind sits after "One entry per chosen key"'s two cases.
    Fix 1 scopes it, and "No menu found", to a client that fills element 3 automatically (below).
  - "No menu found" carries the levels table's condition, "if the observer keeps K for A". Sub-decision 8's sentence
    gives the entry without it.
  - In "A new key within K", the no-key case's two sentences are merged under one SHOULD.
- **`duty-menus.md` § 6.2's in-principle sentence** is its own paragraph before "For a Treasure Map key K, exact or scope,
  and a menu:", since that line's colon opens the steps.
- **Metadata Sources lines.** Wording is the Implementer's: each names ADR 0003 for the sections that now rest on it.
- **The handoff.** A blank line follows the ADR's body block, so it does not run into the existing Created line.

Implementer, fix 1 (2026-10-11), after the first review's findings:

- **Step 5's MUSTs are scoped to automatic fills.** The binding sentence and "No menu found" now name "a client that
  fills element 3 automatically". ADR 0003's notes scope "No menu found" "by the same words" as the no-guess sentence,
  which is "scoped to every automatic fill". Read for every client, the MUST would make a client write `""` over a
  relay the observer typed, against Treasure Maps § 3's quoted "The observer may write any relay by hand". Automatic
  fills are bound exactly as before.
- **"The menu gives K no relay" now reads "no answering row gives K a relay"** (the second case under step 5's "One
  entry per chosen key"). The old words clashed with Treasure Maps § 9.2's "the relay A's menu gives the self-entry's
  key (Duty Menus § 6.2 step 5)". Read literally, they gave an insisted key no relay, so no self-entry could be keyed
  it. ADR 0003 has step 5 give an insisted K the relay its offering rows share (sub-decision 8; Verification, AC5). ADR
  0002 (:417–418) took the proposal's "none when the answering row is not a duty row" to mean "the menu gives K no
  relay". The new words restate the proposal's, so the meaning, and the entry a client writes, are unchanged.
- **The bold lead "Every row within K is listed" is restored.** The rename was not asked for, and story 2 and ADR 0002
  cite the bullet by that name. The SHOULD in the sentence sets the level.
- **Treasure Maps § 9.2's Ties** now says that § 6 does not yet order a bare `39998` and a `39999` key, and points at
  Duty Menus § 14 question 5, where the order is open. § 6's "this always picks one winning key" is left as it stands,
  knowingly, for story 4 (ADR 0003, Out of scope).
- **Treasure Maps § 7's "Every listed provider … is asked to publish and maintain the insight"** gains "except as § 9
  says", as principle 2 did. A self-entry is a provider under § 6 but creates no duty. ADR 0003 gave principle 2 the
  same words for the same reason (sub-decision 1).
- **For story 4's PO.** Two sentences here wait on A1-8: Treasure Maps § 3's "a K that is a Concept kind and a colon
  alone … takes no relay from a self-entry until this NIP settles what such a key means", and § 9.2's Ties. § 9.2's
  "A Concept kind and a colon" holds under any answer, but story 4 should check it. Story 4's scope (the epic's
  bullet) names none of them, nor § 6's "always picks one winning key".
- **Left for the PO:** the record named in the first bullet above, still absent at fix 1.
- **Left for the Architect (kicked back; text as ADR 0003 has it):** the fill rules applied to a key writing its own
  self-entry (a storefront that is its own observer's own Assistant; a person with no menu); § 9's Revocation
  sentence after a carve-out under answer 1(a); Assistant Designation's "Each triple delegates"; Duty Menus § 4's
  "Other `z` tags are … ignored" against § 6.1's fifth condition; § 9.2's "Its key" ("wins only duties"); the relay
  rule during a partial move; the guarantee bullet for a client that takes the self-entry; readers of a self-entry
  whose relay is `""`; and what "private duties" means. *Answered by ADR 0003 A1-1 to A1-9 (fix 4, below).*

Implementer, fix 2 (2026-10-11), after the second review's findings:

- **Ledger row `2026-10-09-draft-grammar-bare-39999`.** Its story-3 note now also waits on the two Treasure Maps
  sentences that wait on A1-8 (§ 3's on a Concept kind and a colon alone, and § 9.2's Ties), so story 4 cannot close
  the row on § 4.5, § 6 and § 10 alone. ADR 0003's words stay; its last sentence gains a clause. Sub-decision 15's
  "gains a note naming story 4" covers it. The epic's story-4 bullet is not edited (the notes name only :34).
- **This section.** The first block's Ties quote is marked as reworded at fix 1, and fix 1's ADR 0002 citation now runs
  the right way.
- **Still left for the PO:** the record named in the first block's first bullet, still absent at fix 2.
- **Still left for the Architect:** the nine items listed at fix 1, unchanged. One narrowing, found in checking: § 9's
  Revocation sentence and § 9.2 disagree only where A's self-Map has no self-entry keyed as the entry the observer
  removed, which § 9.2's "Its key" ("where it can", with no keyword) does not rule out. Where A copied that key,
  removing it as a self-entry that speaks for none meets both.
  *Answered by ADR 0003 A1-1 to A1-9 (fix 4, below); this narrowing by ADR 0003 A1-6.*

Implementer, fix 3 (2026-10-11), after the third review's findings:

- **This section.** Fix 1's bullet on "no answering row gives K a relay" now names the case its words are in: the
  second under step 5's "One entry per chosen key", not the first.
- **Still left for the PO:** the record named in the first block's first bullet, still absent at fix 3.
- **Still left for the Architect:** the nine items listed at fix 1, unchanged. One widening, found in checking: the
  relay rule's last sentence ("A key to which A's menu gives another relay, or none, is not one of its self-entries'
  keys") has no move exception of its own, so read alone it is broken by a full move too, not only a partial one.
  *Answered by ADR 0003 A1-1 to A1-9 (fix 4, below); this widening by ADR 0003 A1-1.*

### Owner's answers to ADR 0003's questions (recorded by the PO, 2026-10-11)

These are ADR 0003's four questions (its "Open questions for the owner"), not this story's Open questions above. At the
ADR's gate the owner gave the recommended answer to each: 1 (a), 2 (a), 3 (a), 4 (a). ADR 0003 has the PO record here
what AC2, AC3 and AC5 now read as (its Open questions and Implementation notes). This is the record the Implementer's
blocks above note as absent. The ACs are not edited: read them as below. Where ADR 0003 gives the wording, it is quoted.

**ADR 0003 Amendment A1.** The owner approved ADR 0003's Amendment A1 on 2026-10-11. This record is revised for it at
the four points ADR 0003 A1 names (its "Not A1's"), and cites its items as "ADR 0003 A1-n": a bare A1-n in this story names ADR 0002's.

**Answer 1 (a), per duty.** "An Assistant's self-entry speaks for its duties; a key that serves only itself, for every
insight it wins in its supported sets. The verbatim key gives way only where it would win a duty A does not publish at
its relay (a `not-offered` part, a part at another relay that no narrower self-entry separates, an insisted key's
unoffered parts), or where A's menu gives it another relay. It stays verbatim over carve-outs: in Treasure Maps § 14's
Map, with a menu that offers everything at one relay, the Brainstorm Assistant keeps `*`."
- **AC2's "copied verbatim"** ("its key is the customer's winning key, copied verbatim") now reads "verbatim where that
  key claims nothing false and Its relay (Treasure Maps § 9.2) allows that key the relay where A publishes what it
  claims; narrower keys otherwise" (ADR 0003 A1-3). This departs from the story as approved, not only from the handoff:
  AC2 named only handoff § 5's "one entry per key" and "where the insights actually are" as phrases that may give way
  (ADR 0003 sub-decision 3). It lands in Treasure Maps § 9.2: What a self-entry speaks for, Its key, Its relay, A part
  A does not publish.
  - *Revised for ADR 0003 A1-3.* Before ADR 0003 A1, this record read "and A's menu gives it the relay where A publishes what it
    claims", in ADR 0003 question 1's words. That made A's menu a condition even where A publishes no menu, or only a
    storefront. Its relay asks for the menu's relay only where A publishes a Duty Menu that is not a storefront, save
    during a move (ADR 0003 A1-1), as answer 1(a)'s "or where A's menu gives it another relay" does. Where A publishes
    such a menu, the two readings agree outside a move (ADR 0003 A1-3, Not taken).
  - *The open point is settled.* Whether "Its key" states answer (a) with no second reading was with the Architect
    (kicked back at fix 1). ADR 0003 A1-3 removes the second reading: Its key's first sentence now ends "and Its relay
    (below) allows that relay for that key", so the spec's sentence and this record read AC2 alike.
- **AC3's "only that key's slice"** ("reading a self-Map as a point of view is coherent, and it shows only that key's
  slice") now "holds for the insights the self-entries speak for: stale copies of insights outside the observer's
  supported sets (and, under (a), of insights the observer gave to another key) can show too". ADR 0003 places it the
  same way (sub-decision 5, As a point of view; Verification, AC3):
  - the self-entries show the slice of the observer the key serves, "where it serves one";
  - entries naming other keys are the author's own requests;
  - a self-Map that has both, such as the TA's (AC7), "read as a point of view mixes two observers' views".

  The two kinds of stale copy are the third and fourth cases of Treasure Maps § 9.2's What the allowance rests on.

**Answer 2 (a), SHOULD.** "Both specs state one rule at one level; Duty Menus quotes Treasure Maps' level."
- **AC5's first bullet** reads as worded: "the self-entry keyed K comes first, with no condition" (ADR 0003
  Consequences). Its level is SHOULD (Treasure Maps § 3, Filling element 3, quoted in Duty Menus § 6.2 step 5). ADR
  0003 A1-4 adds one case: a self-entry keyed K whose element 3 is the empty string gives no relay, and the fill goes on
  as for a K with no self-entry (Duty Menus § 6.2 step 5, No menu found included). AC5's words still hold, since such a
  self-entry has no relay to put first. ADR 0003 A1-4 qualifies only ADR 0003's "with no condition", and only for a
  self-entry that breaks § 9.2's "never the empty string".
- **AC5's "one answer"** (its insisted-key check, and When no menu is found) reads as "the two specs agree": both state
  the same rule at the same level. In the insisted case, the relay written is also the same "for every client that
  holds A's current menu, where that menu is not a storefront, except during a move". That relay is `""` when the
  offering rows name two relays (no self-entry is then keyed K), and their shared relay when they name one. In three
  cases, which ADR 0003 lists (question 2), clients can still write different relays and conform:
  1. **No menu of A's that the client may fill from** (none found, or only a storefront whose rows Duty Menus § 7 bars
     because A is not the observer's own Assistant): "one that looks for a self-Map writes the self-entry's relay, one
     that does not writes `""`, and, where A publishes no menu, a client of the service that runs A may write what
     step 5 gives from that service's record".
  2. **A storefront the observer runs as its own Assistant:** "one that fills from the storefront's rows writes where
     its per-customer keys publish; one that takes the storefront key's self-entry keyed K writes where that key itself
     publishes".
  3. **A move:** "until A's self-Map names the new relay, one that takes A's self-entry keyed K writes the old relay,
     which A still updates, and one that fills from A's current menu writes the new one, or `""` where only part of an
     insisted key's rows has moved". ADR 0003 A1-1 makes Treasure Maps § 9.2 say so: while A moves some or all of the
     insights a self-entry speaks for, that self-entry may keep the old relay until A publishes the version that names
     the new one. This case's reading does not change.
- **AC5's When no menu is found** (no self-entry for K, no menu found) therefore reads as follows. A client that fills
  element 3 automatically writes `""` (Duty Menus § 6.2 step 5, No menu found, MUST), "except for a client of the
  service that runs A, which may write what step 5 gives from that service's record" (ADR 0003 Verification, AC5).
  The observer may still write any relay by hand (Treasure Maps § 3). After ADR 0003 A1-4 this also covers a self-entry
  keyed K whose element 3 is the empty string, which gives no relay.

**Answers 3 (a) and 4 (a)** reword no AC, and ADR 0003 names no departure from the story for either (Consequences).
- **3 (a), the stopgap does not ship.** "The stopgap is non-conforming for external Assistants." Duty Menus § 6.2 step
  5's no-guess MUST NOT has no exception, so AC4's no-guess check and AC5's no-menu reading above take it with none.
  Ledger row `2026-10-10-external-assistant-relay-left-empty` gets "a dated note saying so" (sub-decision 15). That row
  is a third, beside the two that AC8's The ledger names, and ADR 0003's gates list all three. This instance's own
  Assistant keeps its Relay Settings fill as the service's MAY "wherever the setting names the relay the instance
  really publishes those insights to, which needs the code's two relays for Scores reconciled first".
- **4 (a), SHOULD for both.** Step 5's listing (Every row within K is listed) and its `not-offered` disclosure are
  SHOULD. ADR 0003's reason: "They are disclosures in a client's UI, every reader reads the saved Map alike (A1-11's
  lesson)". AC4's check asks each of step 5's obligations to state its level (finding 20), and these two are stated at
  SHOULD.

**ADR 0003 Amendment A1's departures from the story** (ADR 0003, Questions for the owner and Consequences of A1). The ACs are
not edited: read them as below.
- **AC3's confirmed duty** ("an entry naming A in the observer's Map plus a matching self-entry in A's Map", where
  matching means "the same key, or a key that wins for it under § 6") has one exception (ADR 0003 A1-4). A self-entry
  keyed as the observer's entry, whose element 3 is the empty string, matches by AC3's words but confirms no duty. Readers take it "to claim nothing:
  it still wins insights among A's self-entries (§ 6), but confirms no duty" (ADR 0003 A1-4's sentence for Treasure
  Maps § 9.2, Its relay). Nothing changes for a self-Map that follows § 9.2, since no self-entry there has an empty
  relay.
  - *Not yet confirmed by name.* The rule was in the text of A1 that the owner approved, but ADR 0003 named this
    departure only at A1's revision 3, after the approval. Until the owner confirms it by name, this line records the
    approved rule.
- **AC7's "the rest of the user-signed designation is unchanged"** gives way, at one sentence of Assistant Designation
  § Relationship to NIP-85, to AC7's "no longer contradicts it" (ADR 0003 A1-9). The sentence follows the quoted "Each
  triple delegates" sentence: "A triple whose provider is the event's own author is the exception: it designates no
  one". The owner approved this departure by name with A1. No reader of both specs does anything new, since Treasure
  Maps § 9 already reads such a triple as a self-entry that designates no one.

If an amendment to ADR 0003 changes any reading above, the PO revises this record.

### Implementer, fix 4 (2026-10-11): ADR 0003's Amendment A1

ADR 0003's Amendment A1, which the owner approved on 2026-10-11, answers the nine items left for the Architect at
fix 1. Its items are cited as "ADR 0003 A1-n", and it as "ADR 0003's A1", because a bare A1 or A1-n in this story
names ADR 0002's. Each spec quote went in as ADR 0003's A1 writes it. No edit adds or removes a line, so the draft
line numbers below are the same before and after.

- KB-rederive/F2, the relay rule during a move: ADR 0003 A1-1, `treasure-maps.md`:361 (Its relay).
- KB-coherence/C1, the fill rules on a key's own self-entry: ADR 0003 A1-2, `treasure-maps.md`:82, `duty-menus.md`:200.
- KB-coherence/C9, Its key's "wins only duties": ADR 0003 A1-3, `treasure-maps.md`:359 and :365.
- KB-coherence/C11, a self-entry whose relay is `""`: ADR 0003 A1-4, `treasure-maps.md`:361, `duty-menus.md`:201, :205.
- KB-coherence/C12, what "private duties" means: ADR 0003 A1-5, `treasure-maps.md`:376.
- KB-coherence/C5, § 9's Revocation after a carve-out: ADR 0003 A1-6, `treasure-maps.md`:333.
- KB-coherence/C10, the guarantee for a client that takes the self-entry: ADR 0003 A1-7, `duty-menus.md`:224.
- KB-coherence/C7, § 4's `z` rule against § 6.1's fifth condition: ADR 0003 A1-8, `duty-menus.md`:90.
- KB-coherence/C6, Assistant Designation's "Each triple delegates": ADR 0003 A1-9, `assistant-designation.md`:32.

Metadata Sources lines (`treasure-maps.md`:5, `duty-menus.md`:6, `assistant-designation.md`:4) now name ADR 0003's
Amendment A1, as that ADR's Implementation notes for A1 word them. Judgment call: this block sits below the PO's
record, under its own heading, so that the record stays the PO's. The fix 1 to 3 blocks above gain only the "Answered
by" lines. The record that their "Left for the PO" lines note as absent is now in place above.

Implementer, fix 5 (2026-10-11), after the review of fix 4:

- **Fix 4's block.** Where it had a bare "A1", it now names ADR 0003's amendment in full, since ADR 0003's Amendment
  A1 (its Why) reads a bare A1 in story 3 as ADR 0002's.
- **Left for the PO (kicked back):** the record above uses a bare "A1" for ADR 0003's amendment (its Amendment A1
  note, AC2's revision bullet, and the departures block), and its AC3 line says that a self-entry whose element 3 is
  the empty string "matches by AC3's words", though AC3's match turns on the self-entry's key.
- **Left for the Architect (kicked back; text as ADR 0003's A1 has it):** Treasure Maps § 9.2's Confirmed duties and
  Meaning do not point at Its relay's "confirms no duty"; Duty Menus § 2's "its own key included" now reaches only
  self-entries, which no fill rule fills (ADR 0003 A1-2); and ADR 0003's "Status of A1: proposed" line follows its
  approval line.

Implementer, fix 6 (2026-10-11), after the review of fix 5:

- **No draft edit.** The five findings on fix 5 were re-checked against the drafts, ADR 0003 and the record above,
  and each still holds. None can be fixed with text that ADR 0003's A1 gives, or in the Implementer's own lines.
- **Still left for the Architect (kicked back again):** the three items fix 5 lists. ADR 0003 A1-4's Why says that
  Confirmed duties' "that the reader takes to speak for it" does not cover a self-entry whose element 3 is the empty
  string, and that ADR's Implementation notes for A1 ("These are the exact edits") give neither Confirmed duties nor
  Meaning an edit. ADR 0003's Verification for A1 says "Duty Menus § 2 is unchanged", so dropping or glossing "its own
  key included" needs a further amendment, at the owner's gate.
- **Still left for the PO (kicked back again):** the two items fix 5 lists.

### Fix 7 (2026-10-11, after the A1 apply pass)

The last check left five non-blocking kick-backs; all five are closed:
- Treasure Maps § 9.2 Meaning and Confirmed duties now carry ADR 0003 A1-4's rule for a self-entry whose element 3 is
  the empty string (it claims nothing; it confirms no duty), so § 9.2 no longer says the opposite of Its relay.
- ADR 0003's "Status of A1" and Questions for the owner now say A1 was approved, matching the approval line.
- The PO block names ADR 0003's amendment as "ADR 0003 A1" throughout, and its AC3 line names the self-entry "keyed as
  the observer's entry".
- Duty Menus § 2's "its own key included" applies nowhere after ADR 0003 A1-2. It is harmless and owner-approved
  wording, so it stays; ledger row `2026-10-11-duty-menus-spec-fold-forwards` carries it to story 4.

## Linked artifacts

- ADR: [`decisions/duty-menus-and-self-maps/0003-self-maps.md`](../../decisions/duty-menus-and-self-maps/0003-self-maps.md)
- Test plan: skipped (docs-mode)
- Review: (filled in after Review phase)
