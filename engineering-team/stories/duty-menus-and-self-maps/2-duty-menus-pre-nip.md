# Story 2: The Duty Menus pre-NIP

**Status:** Approved
**Created:** 2026-10-10
**Type:** Doc

## Background

A Tapestry instance that gives a duty to an external Assistant has no way to learn whether that Assistant offers the duty,
or on which relay it would publish it
([`docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md`](../../../docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md) § 1). Today
the `/treasure-map` page writes an empty relay for any Assistant it doesn't run, and that breaks readers (OPEN.md row
`2026-10-10-external-assistant-relay-left-empty`).

The owner settled the answer: each Assistant key publishes a **Duty Menu**, one item under a shared header that Nous
publishes (handoff D4, D8–D10). Story 1 made the self-pointing `b` that header relies on normative. This story writes the
Duty Menu spec itself.

## User-facing description

As an implementer of a Tapestry or Brainstorm instance, or of another NIP-85 provider, I want one spec that says how an
Assistant key publishes what it offers and where, and how a reader finds and interprets it, so that any instance can fill
a Treasure Map entry's relay for an Assistant it doesn't run, show what each Assistant offers, and list the service
providers its community trusts.

## Acceptance criteria

- [ ] **AC1, exists and indexed.** `protocols/drafts/duty-menus.md` exists with the standard metadata header (📝 pre-NIP;
  Sources naming the handoff and this story's ADR), and `protocols/README.md` gains its index row.
- [ ] **AC2, the header.** The spec defines the single shared Duty Menu header:
  - published by Nous, named by pubkey;
  - offered as a self-declared Shared Concept, citing `inherit-from.md`'s Self-declaration rule;
  - declares the item tags it requires (the Assistant, the duty rows) and allows (name, description, a storefront link,
    per-duty details).

  It says how a person adds Duty Menu to their own dictionary by affiliating their header with Nous', and that those
  declarations must be on Nous' header before anyone adopts it.
- [ ] **AC3, the item.**
  - One replaceable item per Assistant key, at a fixed identifier.
  - **Every** menu, storefront and per-customer alike, points at Nous' header (D9).
  - Each duty row is a Treasure Map key plus a relay, with at most one row per key.
  - Rows mean *offered*, never *active*.
  - Only the key's own item counts.
  - Per-duty details are allowed; price and tier never are (D5).
- [ ] **AC4, reading a menu.**
  - Which row answers a given duty follows the Treasure Map's most-specific rule (`treasure-maps.md` § 6), and no matching
    row means not offered.
  - It gives how to find one key's menu knowing only its pubkey, and how to list all menus under the header, filtered per
    point of view.
  - It covers storefront versus per-customer menus, the link between them, and how a reader tells them apart. One key per
    algorithm means one menu per key (D7).
  - The storefront menus under the header, read through their authors' kind 0 profiles and filtered per point of view,
    form a directory of service providers. This is the owner's addition, 2026-10-10, and may be non-normative.
  - A provider that publishes no storefront stays out of that directory; its per-customer menus never pose as storefronts.
- [ ] **AC5, fits with the rest.**
  - It states the boundary: the menu says *offered*, and the key's own Treasure Map says *active*. Self-Maps themselves
    are story 3, so this spec does not define them.
  - `protocols/worksheet.md` W1 notes that Nous holds the Duty Menu header, a Shared Concept rather than a per-deployment
    copy.
  - No "canonical" or "consensus" in normative text (`docs/NIP_REORG_DESIGN_HANDOFF.md` D2).
- [ ] **AC6, gates and scope.**
  - Links resolve, `harness-lint` is clean, and the stack-free `npm test` shows no regressions.
  - `protocols/` changes are limited to `duty-menus.md`, `README.md` and `worksheet.md`.

## Concepts touched

None changed (docs-mode). The Duty Menu concept comes into being when Nous publishes the header; the spec names its
address.

## Out of scope

- Self-Maps, and reserving `duty-menu` in `treasure-maps.md` § 4.6: both story 3.
- Nous actually publishing the header (outside the repo; publishing is the author's act).
- Any code.
- Private duties (handoff Q4) and NosFabrica adoption (handoff Q6).
- A bare `["z", "duty-menu"]` meeting point (handoff Q5): left out, owner 2026-10-10, because Nous' header is the one
  meeting point (D9).
- A new mechanism for finding a storefront before joining (handoff Q7): the storefront is the provider's main-key menu
  under Nous' header, and its kind 0 website is an ordinary hint (NIP-85's discovery appendix). Owner, 2026-10-10.

## Open questions

None blocking. The Architect settles the rest within the handoff's § 4 shapes.

## Deviations

Small judgment calls by the Implementer (2026-10-10), none outside ADR 0002:

- **§ 9, the provider directory, does not cite the repo's Show and Tell document.** ADR 0002 sub-decision 9 leans on its
  H3. The spec states the same signals in plain words (what trusted people say, what they do, the reuse questions) instead
  of linking `design-philosophies/`. *Corrected in round 2:* the reason first given here ("a protocol spec does not cite
  repo-internal advisory docs") was wrong, because other drafts do cite Show and Tell (e.g. `dlist-auxiliary-events.md`).
  Plain words were simply judged clearer for implementers outside the repo; a citation would also have been acceptable.
- **The examples use neutral names and relays** (`Example WoT Service`, `wss://*.example`) rather than a real deployment's
  relays, following the same boundary rule: deployment details stay out of specs.
- **§ 6.2 step 4 adds one sentence for a narrower `not-offered` row:** the client says those insights won't come from this
  key. This follows from ADR 0002 sub-decision 5 ("partly offered") and the worked example. *Round 3:* this is now ADR
  0002 A1-4's listing of every row within K (§ 6.2 step 5, "Every row within K is listed"), which also shows any row
  nested inside a `not-offered` part.
- **The vocabulary gate.** Treasure Maps § 4.1's naddr rule is described as "decoded and re-encoded" rather than
  "canonicalized", so the AC5 grep finds only the metadata label.

Round 2 (2026-10-11), answering review round 1:

- **B1:** principle 5 now says a menu may *name* an algorithm (§ 5.4), as NIP-85 asks a service key's kind 0 to, while
  a method's parameters, point of view and cutoffs stay off. It no longer claims parity with Treasure Maps principle 3.
- **B2:** open question 1 now cites accurately. NIP-85 allows encrypted 10040 entries in `.content`, but Treasure Maps
  § 13 Q8 keeps delegation entries public for now.
- **§ 6.2 resolution, generalized beyond ADR 0002 sub-decision 5's wording** (review non-blocking 1):
  - "covers" now cites Treasure Maps §§ 4.2, 4.4 and 4.5;
  - "partly offered" counts any row that wins part of K by § 6, overlapping rows included, not only narrower ones;
  - for an overlapping row, the client writes the segment-by-segment intersection key (`3039x` with `*:tag` gives
    `3039x:tag`), because writing the row's own key would lose to K in the Map's § 6;
  - the no-answering-row case is stated.

  *Round 3 (ADR 0002 A1):* the detection part stands, as A1-3's rows within K and differing rows. The intersection key
  is withdrawn as an entry the client writes. It survives as the meet, a key the client offers the observer (A1-4).
- **Smaller fixes from round 1:**
  - Concept keys are exempt from trailing-segment trimming;
  - withdrawal is a SHOULD again and says "travels by the same sync";
  - the deletion's `e` names earlier versions, never the empty menu;
  - § 5.4 names the camelCase namespace explicitly;
  - the W1 note says "tags-branch ADR 0015" and "a person adds".
- **Nous' relays are found through Nous' own kind 10002 write relays** (§ 8.1 step 3). Added in round 2, though round 1
  did not ask for it (review round 2, NB10). It gives readers a way to find "the relays where Nous' header is published",
  using D3's fallback locator. Ratified by ADR 0002 A1-7, which also brings the publisher sentence into line (round 3).
- **Open question 3** (non-personalized providers) added, per the owner's answer (a), 2026-10-11.

Round 3 (2026-10-11), carrying ADR 0002 Amendment A1, which answers review round 2:

- **B3, "covers"** → A1-1 and A1-8. § 6.2 step 1 defines covering by matching under Treasure Maps §§ 4.2–4.5, for every
  insight in principle, with § 4.3 agreement judged from the key alone. Its examples include the bare `*`, an empty
  middle segment, a row that covers through § 4.3, "no `*:<scope>` key covers a Concept key", and A1-8's reading and
  order for the bare Concept kinds.
- **B4, the multi-entry option** → A1-3 to A1-5. § 6.2 step 4 defines rows within K, the meet, a row's part and
  differing rows. Step 5 writes one entry per chosen key, lists every row within K, offers each differing row's meet,
  gives the guarantee in A1-4's words, and gives the insisted key its offering rows' shared relay, else the empty string.
  § 13.3's `3039x` row follows A1-5.
- **The deletion's timestamp** → A1-6. § 11's deletion has a `created_at` strictly earlier than the empty menu's, cites
  NIP-09's `a` rule, and its `e` tags never name an empty menu, old or new.
- **NB10** → A1-7. § 8.1's publisher sentence names the key's own kind 10002 write relays, the relays its `duty` rows
  name, and Nous' kind 10002 write relays.
- **NB11** → A1-8. § 5.3 ignores rows keyed `39998:` or `39999:` and carries the writers' SHOULD. § 14 gains question 4
  (read-time resolution) and question 5 (the Concept kinds).
- **Judgment calls A1 does not dictate:**
  - § 1 principle 3 gains a pointer to § 6.2 for the relay such an entry carries, since A1-4 qualifies sub-decision 10,
    which principle 3 states.
  - § 2 gains one line pointing to Treasure Maps § 2 for "observer" and "insight", which the new § 6.2 leans on. The
    terms § 6.2 introduces (covers, answering row, row within K, meet, part, differing row) stay defined in place, as
    "covers" and "answering row" already were.
  - § 7's MUST NOT now reads "fill a Treasure Map entry naming the storefront key from a storefront's rows" instead of
    "turn a storefront's rows into Treasure Map entries", so it no longer implies that rows become entries (A1-4: menus
    supply relays, never keys). What it forbids is unchanged.
  - A1-4's "Backup" offer is written in Treasure Maps § 7's words: "Alternates", "fallback provider". Treasure Maps has
    no term "Backup". *Fix pass 4:* A1-11 replaced the offer. Step 5's Alternates bullet keeps Treasure Maps § 7's
    words. It no longer has the client offer to carry K's providers onto the new key in K's order; the client MAY
    offer to add them, and the observer chooses which, and in what order.
  - A1-1's agreement rules name the Score kinds beside the List kinds (an event kind with `30383`/`30393` and so on; a
    NIP-73 type with `30385`/`30395`), following Treasure Maps § 4.3's rule that a Score key is its List key plus a
    metric, as the model scripts do.
  - § 6.2 opens with a shorthand for its examples: `<key>` → R for a `duty` row, `not-offered <key>` for a `not-offered`
    row.
  - The insisted-key bullet says the client does not replace the empty string with a guess, naming A's kind 10002 write
    relays and the relay where it found the menu, from A1-4's "Set aside" list, so that a client does not reach for D3's
    locator there. *(Fix pass 1:* first written as "R is never a guess", which reads as a ban on those relays' values.
    Under A1-7 the offering rows' shared relay is often one of them. The rule is about where R comes from.)
  - The examples in § 6.2 are A1's: case D (step 4, and a new key taking insights back), the nested case (listing), the
    § 4.3 case and case C's second step (a row's own key that does nothing), and A1-1's `30392` against
    `3039x:tag:⟨D⟩`.
- **Fix pass 1, answering the round-3 verifiers** (none outside A1):
  - Step 4's "A differing row is not an exception" was false: a `not-offered` row within an offered K is both. It now
    says the two terms differ, as A1-3 does, with § 13.3's `not-offered 30385` within `3038x` as the case.
  - The listing compares the rows' own keys, not their meets, and case C shows the two orders disagree. A1-3 defines a
    part by rows beating rows, so this states what A1 means; it adds no rule.
  - The warning is a MAY in step 5, as in principle 3. A1-4 amends sub-decision 10 only for the relay (ADR 0002,
    sub-decision 10's marker), so its MAY stands.
  - Step 2 points to step 1's Concept-kind order, which step 1 already applies wherever keys are compared.
  - Step 5's lead says "one entry for each key and Assistant", since Alternates share a key (Treasure Maps § 7). The
    bolded "Menus supply relays, never keys" (A1-4's words) became "Menus supply relays; only the observer chooses
    keys", because the client does offer meets as keys. The MUST NOT under it is unchanged.
  - A1-4's "the family entry an editor adds when a category is assigned" became "a whole-class entry (Treasure Maps
    § 10.1) that an editor writes when the observer gives A all of their Scores, Lists or Concepts". "Category" is a
    Treasure Maps term (a content category) used a few lines earlier in another sense.
  - § 11: the `a` removes versions only up to the deletion's own `created_at`, so the sentence no longer says it removes
    every earlier version. The `e` tags name them all. A1-6's "Why" has the same overstatement; its MUST is unchanged.
    "A deletion made later" is now stated by timestamps, since the bullet before says timestamps decide.
  - The meet is "always a Treasure Maps § 4.7 key" except for a Map key `39998:` or `39999:`, and § 14 question 5 says
    "and so its meets", carrying A1-8's last clause.
  - Pointers to this spec's § 14 read "open question N below", since the bare § numbers around them are Treasure Maps'.
  - Worked cases in steps 4 and 5 sit in their own "Example:" sub-bullets; "insisted key" and its scope are defined in
    one sentence; "partly offered" notes that every insight may be offered; § 5.3 names the two readings of `39998:`.
- **Kicked back to the Architect in fix pass 1**, with the text left as A1 says: which kinds category `39998` agrees
  with (A1-1's bullet); where A sits when K's other providers are carried onto a new key (A1-4's Backups); and whether an
  empty category in a `30392`/`30382` key is "any" (A1-1) or the profiles category (Treasure Maps § 4.4, § 13 q2).
- **Fix pass 2:** the verifiers raised all three again. They stay kicked back, with the text unchanged, because A1 has
  not answered them. Each changes a Map entry, and A1's model does not decide it: it has no `30394`, no `30397` and no
  category `39998`, and it reads an empty profiles category as "any". *(Fix pass 4: all three are answered, and this
  note on the model is superseded.)* The questions for the Architect:
  - *Category `39998`.* Does it agree with `30397` only, or also with `30394`, since `39998` is an addressable kind?
    Treasure Maps § 4.3 lists both. Take a menu `3039x` → R0, `30397` → R1, and K = `3039x:tag:39998`. The first reading
    gives the entry R1. The second gives R0, with `30397` as a differing row.
  - *Where A goes on a new key.* When K's other providers are carried onto a new key within K, does A keep its place
    from K, or go first? With K's entries [B, A], the new key's Preferred provider (Treasure Maps § 7) is B under the
    first answer and A under the second.
  - *An empty category in a `30392` or `30382` key.* Is it "any", or the Profiles category, which makes `30392:tag::⟨T⟩`
    exact (Treasure Maps § 4.4's last bullet, § 13 question 2)? Take a menu `30392` → R0, `30392:tag::⟨T⟩` → R1, and
    K = `30392:tag:⟨D⟩:⟨T⟩`. The first reading gives R1, the second R0.
  - A new § 14 question or story-3 carry-forward for any of them also needs the Architect. A1's notes list the § 14
    questions and the carry-forwards this round adds.
- **Fix pass 3:** the three questions above were raised again. They stay kicked back, with the text unchanged, because
  A1 has not answered them. The verifiers also found a fourth question. It is kicked back the same way, and § 8.1 and
  § 11 stay as A1-6 and A1-7 say:
  - *A stale menu at an old row's relay.* A1-7 has a key publish its menu to the relays its `duty` rows name. When the
    key withdraws, or moves a row to another relay, its new menu no longer names the old relay. § 11 does not say where
    a deletion goes. So the replaced version stays at the old relay. That relay is element 3 of the observer's entry,
    and § 8.1 step 1 looks there first. A reader that stops at the first menu it finds reads the stale offers. A reader
    that keeps the newest copy across all three steps reads the new menu. Take a menu `3038x` → `wss://scores.example`
    that is then withdrawn. The first reader writes `["30382:rank", "<A>", "wss://scores.example"]`, and the second
    writes `["30382:rank", "<A>", ""]`. Should § 11 send a republished menu (the empty one included) and any deletion
    to the relays named by the replaced version's `duty` rows? Or should a § 8.1 reader that finds a menu at a step-1
    hint also check step 2 and keep the latest `created_at`? Or both? *(Fix pass 4: both, widened, by A1-12. The
    example is corrected below.)*
- **Fix pass 4 (owner gate, 2026-10-11).** The owner approved ADR 0002's A1-9, A1-10 and A1-12 as written. A1-11, and
  A1-4's Backups bullet with it, were replaced by a short rule (ADR 0002, revision 4). Each question kicked back in fix
  passes 1 to 3 now has its answer:
  - *Category `39998`* → A1-9. It agrees with `30393`, `30394` and `30397`, and with their Score kinds. So Fix pass 2's
    example gives R0, with `30397` → R1 as a differing row (meet `30397:tag:39998`).
  - *The profiles category slot* → A1-10. In a `tag` or `pin` key whose kind slot is `30392` or `30382`, an empty
    category left after trimming is the Profiles category, so `30392:tag::⟨T⟩` is exact. Fix pass 2's example gives R0.
  - *Where A goes on a new key* → A1-11. Neither answer is prescribed. The observer chooses the new key's providers and
    their order. The client shows them, and says that K's other providers do not back the new key up unless they
    are listed on it.
  - *The stale menu* → A1-12. Both of Fix pass 3's options, widened. Publishers send each version, the empty menu
    included, to every relay an earlier version's `duty` rows named, and a deletion wherever the empty menu goes.
    Readers ask every relay in all three § 8.1 places and keep the latest version.
  - What changed in the spec: § 6.2 step 1 (A1-9; A1-10, with A1-1's empty-segment example given the exception); step 4
    (A1-10's meets with no key); step 5 (A1-10 in the listing and in "A new key within K"; A1-11 in "Alternates"); § 8.1
    and § 11 (A1-12); § 12's new Lookups bullet (A1-12); § 14's questions 6 (A1-9) and 7 (A1-10).
  - Fix pass 3's example, tightened on two points. The reader that keeps the newest copy writes
    `["30382:rank", "<A>", ""]` only if the observer keeps K for A (the insisted key); otherwise it writes no entry. And
    the old relay keeps the stale copy only when it is not also one of A's or Nous' kind 10002 write relays.
  - Fix pass 2's last bullet, settled: A1-9 and A1-10 add § 14's questions 6 and 7 and two story-3 carry-forwards in the
    epic. A1-11 and A1-12 add neither.
  - Fix pass 2's note on the model: A1's earlier model had no `30394`, no `30397` and no category `39998`, and read an
    empty profiles category as "any". A1-9 and A1-10 were checked on a model that has all of these (ADR 0002, A1-10's
    "The model").
  - Judgment calls A1 does not dictate:
    - Step 4 says a keyless meet arises when "neither K nor the row is limited to the Profiles category", for A1-10's
      "has the Profiles category". The Profiles category is spelled by an empty slot, so "has" could be read as naming a
      category value.
    - Step 1 keeps two one-line examples from A1-9's and A1-10's rules: `30397` does not cover `3039x:tag:39998`, and
      `3039x:tag::⟨T⟩` matches `30392:tag:⟨D⟩:⟨T⟩`. The kick-back examples then re-derive from the text.
    - § 8.1 keeps its numbered list, so "step 1" to "step 3" still resolve, and step 3 keeps A1-7's "the relays where
      Nous' header is published". The reader rule's details and the publisher rule's reasons follow as short bullets.
      The publisher sentence says "the relays that version's `duty` rows name", A1-7's target made per version.
    - § 8.1 gives A1-12's "as on a relay, which keeps only the latest version at the address" as "a relay, too, returns
      only the latest version at the address". NIP-01 lets a relay store older versions, but it SHOULD return only the
      latest.
    - § 8.1's stale-hint bullet names all three of A1-12's examples (a `storefront` link's relay, a hand-written entry,
      an entry filled before the menu was found), not only the `storefront` link the notes name.
    - § 14 question 7 spells out A1-10's "per key" and "per insight" (judged by the key's own kind slot, or by each
      insight's kind), since the spec does not use those terms.
    - § 12's Lookups bullet sits after Listing, and § 11's deletion SHOULD sits under the deletion bullet.
    - Fix passes 2 and 3 get short inline pointers to this block, so their stale text does not mislead.
- **Fix pass 5, answering the verifiers of fix pass 4** (none outside A1):
  - The inline *Fix pass 4* note on the Backup offer said the Alternates bullet "no longer offers to bring K's
    providers over". The bullet still lets the client offer to add them (MAY). What A1-11 dropped is the offer to carry
    them over in K's order. The note now says so, and so does the ADR 0002 implementation note it came from.
  - The Alternates SHOULD said "say that K's other providers do not back it up". That is false when the new key already
    lists one of them: with `3039x` → [B, A] and `3039x:tag` → [B] in the Map, `3039x:tag` chosen for A has B. It now
    ends "unless they are listed on it", from A1-11's own "Why". ADR 0002's rule and its four restatements gain the
    same words, and the line above on A1-11 does too.
  - Judgment calls A1 does not dictate:
    - The Alternates bullet says "Assistants" where A1-11 says "providers". § 2 defines a provider as whoever runs
      Assistant keys, and one provider may run two keys listed on one Map key. A1-11 means Treasure Maps § 7's
      providers: the Assistants named in a key's entries.
    - The bullet says that adding one of K's other Assistants chooses the new key for it, so its entry is filled as for
      any chosen key. A client that copied that Assistant's entry for K would keep K's relay, where its menu may name
      another for the new key. The sentence names no Assistant and no order.
    - A1-10 follow-ons. Step 4 defines a row's part as the insights both K and the row's key match, not "the insights
      of its meet", since a meet may have no key. Step 5 says "A meet that is a key beats K", as step 4 does. § 14
      question 4 no longer says the observer can always choose the meet: where it has no key, the observer can choose
      the row's own key, when that beats K, or keys for some of the part's categories.
    - § 8.2 keeps only the latest version at each address, as § 8.1 does, and an address whose latest version is not a
      menu has none. As written, § 8.2 could show a version that § 8.1 does not count, or two versions of one menu.
      A1-12 did not name § 8.2; this carries its "the latest version counts" there. A bullet notes that the `#z` query
      does not return a later version that dropped Nous' `z`, while § 8.1's query does. It adds no rule.
    - Not changed: the meet's first sentence and step 5's "A new key within K" lead. Step 4 states the exception for a
      meet with no key in the same bullet, and step 5's "Where the meet has no key" bullet says what the client offers
      instead.
- **Fix pass 6, answering the verifiers of fix pass 5** (none outside A1):
  - Fix pass 5 changed ADR 0002's approved A1-11 rule without marking it, so a reader of the ADR alone took "unless
    they are listed on it" for owner-approved wording. ADR 0002 now marks it: an "After approval" paragraph after the
    owner's Approved line says what fix pass 5 changed and why, and that the words await the Architect's
    ratification. A1-11's rule points to it, and so does the lead of the implementation notes for A1-9 to A1-12.
  - Judgment call: the words stay, in the ADR and in the spec. Without them the SHOULD is false once the observer
    lists one of K's other providers on the new key, as the rule allows. They come from A1-11's own Why, and the
    verifier found the substance sound. The owner's Approved line is left as the owner gave it.
- **Fix pass 7, answering the verifiers of fix pass 6** (none outside A1):
  - ADR 0002's "After approval" paragraph said the client may offer to add K's providers "but not to carry them over in
    K's order". That reads as a ban, and A1-11 bans no suggestion: the spec sets no default. It now says that A1-11
    dropped A1-4's SHOULD to offer them in K's order, as the implementation note and fix pass 5's note above say. The
    spec had no such ban, so it is unchanged.

## Linked artifacts

- ADR: [`engineering-team/decisions/duty-menus-and-self-maps/0002-the-duty-menus-pre-nip.md`](../../decisions/duty-menus-and-self-maps/0002-the-duty-menus-pre-nip.md)
- Test plan: skipped (docs-mode)
- Review: [`engineering-team/reviews/duty-menus-and-self-maps/2-duty-menus-pre-nip.md`](../../reviews/duty-menus-and-self-maps/2-duty-menus-pre-nip.md)
