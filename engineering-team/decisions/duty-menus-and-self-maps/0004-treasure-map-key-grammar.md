# ADR 0004: The Treasure Maps key grammar — the Concept kinds ordered, `39998:` no key, category `39998` in three List kinds, addressable kinds, and the Profiles category

**Status:** Accepted (by the owner, 2026-10-12, with open questions 1–3 answered as recommended)
**Date:** 2026-10-12
**Story:** `engineering-team/stories/duty-menus-and-self-maps/4-treasure-map-key-grammar.md`

**Revision 1 (2026-10-12)** answers the first review (lenses grammar F1–F6, owner F1–F9, coverage AC-1–AC-7, sources
SRC-1–SRC-5); each finding was re-run on the model (V16–V23). § 4.3 now defines an addressable kind once (Choice 7)
and names the specs that read it narrowly (Open question 3). § 4.5 makes a Concept `d` one segment, and § 4.6 leaves
out headers whose `d` is `dlist-header`. Choices 3 and 6 go to the owner (Open questions 1 and 2). Wording fixes cover
Trusted Lists' bare kinds, Duty Menus steps 3–4 and § 8.1, and Treasure Maps § 6 and § 13. Records add the Dictionary
entry page's reader, the loose-ends order, a wider gate grep, a per-AC checklist and the Sources clauses.

**Revision 2 (2026-10-12)** answers the second review (N1–N3; V24–V26). Assistant Designation's split rule and Trusted
Lists' families sentence now cite § 4.6 for `39999:dlist-header`, and Trusted Lists sends the bare kinds to Treasure
Maps. Assistant Designation's blanket gloss no longer calls the entry the bare `39998`, and a new protocol row asks
whether a bare `39998` names a user's TA. Consequences lists both new protocol rows as departures, which Open question
3 now covers, and the code row adds the My Assistants duties list.

**At acceptance (2026-10-12)** two non-blocking findings of the third review are fixed. The code row names how
`classifyEntry`, `treasureMapDuties` and `findDListEntries` read `39999:duty-menu` (R3-1). Duty Menus step 1's last
bullet, and Assistant Designation's split rule and Sources clause, name both keys that § 4.6 says name no Concept,
`39999:duty-menu` and `39999:dlist-header` (R3-2).

## Context

Story 4 settles in Treasure Maps the three questions that ADR 0002 Amendment A1 read provisionally for Duty Menus:
A1-8 (the Concept kinds), A1-9 (category `39998`) and A1-10 (the profiles category slot). The owner approved the story
on 2026-10-12 with the recommended answer to each open question:

- **1(a).** A1-8 made final: a bare `39998` covers every Concept key, headers declared as kind-39999 items included; a
  bare `39999` covers the `39999:<d>` keys; a `39999` kind slot beats a bare `39998` in § 6.
- **2(a).** A Concept kind and a colon alone (`39998:`, `39999:`) is not a key. Readers ignore a Map entry, menu row or
  self-entry keyed so; writers write the bare kind. Treasure Maps § 4.5 and § 4.7, Assistant Designation's per-DList
  split rule and Trusted Lists' split sentence leave it out or point at the rule.
- **3(a).** Category `39998` takes `30393`, `30394` and `30397` and their Score kinds (Content Categories § 2), and a
  replaceable kind (`0`, `3`, `10000`–`19999`) counts as addressable for `30394`.
- **4(a).** A1-10 made final in all four parts.
- **5(a).** The rest of the Self-Maps fold-forwards go to a planned story 5.

What waits on these answers today:

- **Treasure Maps.** § 4.5 never says what a bare `39999` covers. § 6 cannot order `39998` against a `39999` key: on
  the model, 2 pairs of the 576 keys share an insight and tie (`s4/m1_grammar.py`), so § 6's "this always picks one
  winning key" is false for headers declared as kind-39999 items. § 4.3 and § 4.4 leave category `39998`, replaceable
  kinds and the profiles slot open. § 3 and § 9.2 carry sentences that wait on A1-8, and § 9.2's Ties points at Duty
  Menus § 14 question 5 as open.
- **Duty Menus.** § 5.3, § 6.2 steps 1 and 4 and § 14 questions 5–7 hold the provisional readings.
- **Self-Maps.** Under § 6 as written, ADR 0003 sub-decision 2's normal self-Map `{39998 → Rc, 39999 → Rd}` is barred:
  its `39999` self-entry ties on every header it matches, so it wins none and speaks for none (story 3 review, NB3).
  Story 3 carries a provisional departure from its AC3 under Ties (ADR 0003 A2-4), which ends here.
- **Other specs.** Assistant Designation glosses the blanket entry as "for my kind-39998 DList headers" and splits a
  per-DList key at the first colon, "everything after it is the d-tag". Trusted Lists repeats the split. Spawning § 3.2
  says which List kind a (Tag, category) pair spawns, and its § 2 defers agreement to Treasure Maps § 4.3. Content
  Categories references an event "by `e`, or `a` if addressable" (its table of category types, and § 4).

**Shipped code that reads these keys** (out of scope; AC6 names the differences):
- the card rule, `entryOf`/`appliesTo`/`categoryEntries` in `src/lib/treasureMapCategories.mjs`, used by the page and
  by the server's check, `src/api/assistant/trustedContent.js`;
- the editor, `roleOf`/`FAMILY` in `ui/src/pages/treasure-map/editTreasureMap.js`;
- the Dictionary entry page's curator, `conceptCurator`/`classifyEntry`/`findDListEntries` in
  `ui/src/utils/treasureMap.js` (shown at `ui/src/pages/dictionaries/ConceptEntry.jsx`:202);
- the My Assistants duties list, `treasureMapDuties` in `ui/src/pages/assistants/myAssistants.js`, which reads keys
  through `classifyEntry`;
- the menu reader, `readMenuRows`/`normalizeMenuKey` in `src/lib/duty-menu/index.js`.

No code resolves covering (§ 6.2 step 1). So category `39998`, replaceable kinds and the profiles slot bear on none of
it.

**Concept graph.** The probe failed (stack absent, `curl` exit 7). The story changes no concept: Treasure Map keys are
strings in kind-10040 entries. The DList header and item concepts are named in plain language; their handles are
unresolved here. **Firmware reinstall: not required.**

**Constraints.**
- Docs-mode. Test Design is skipped.
- The four CLAUDE.md invariants hold. Nothing here gates publication: a reader ignores a malformed key, and every
  per-POV choice stays the observer's.
- No new wire surface. Each wire fact is normative in one place, Treasure Maps.
- Specs cite specs and NIPs. Only metadata Sources lines name ADRs.
- No "canonical", "consensus" or "root" in added text, and no deployment details in specs.
- Accepted ADRs are not edited in place, except ADR 0003 at the loose-ends row's items 2 and 3 (AC6). Supersessions
  are recorded here (sub-decision 10).

## Options considered

The owner's answers fix what most keys match. Seven choices are left, mostly about where each rule lands and how it is
worded. The owner ratified Choices 3 and 6 on 2026-10-12 (Open questions 1 and 2).

### Choice 1 — How § 6 states the Concept order

- **Option A (chosen).** One sentence in § 6's kind-slot bullet: "Of the two Concept kinds, `39999` beats `39998`,"
  with its reason. A second sentence names the one case where a matching key names a value the insight lacks, so that
  "this always picks one winning key" reads true.
- **Option B.** Rank the kind slot `39998` as a family wildcard.

On every pair of the model's keys that share an insight, A and B give the same order (5,313 pairs,
`s4/m1_grammar.py`). So the choice is about the words alone. B is shorter, but it calls `39998:restaurants-nashville`
a family. It also blurs § 4.2's kind slot, which for `39998` is still the `kinds` value of a filter. A keeps § 4.2
intact and names the one exception.

### Choice 2 — Where the "not a key" rule lands, and how it is worded

- **Option A (chosen).** One normative rule in § 4.5: readers MUST ignore a Map entry keyed so, as if it were absent,
  self-entries included, and writers SHOULD write the bare kind. § 4.7's `d-tag` becomes non-empty. The § 9.2
  paragraph and the § 3 clause go. Duty Menus § 5.3, Assistant Designation and Trusted Lists point at § 4.5.
- **Option B.** The grammar alone (`d-tag = 1*OCTET`), relying on readers to drop keys that do not parse.
- **Option C.** Keep a rule in each place: § 3, § 9.2 and Duty Menus § 5.3.

B fails "every reader ignores the same things". Treasure Maps has no general reader rule for a key that does not
parse: § 9's "ignores entries it doesn't understand" binds Assistants only. One reader would still count such an
entry's Assistant (the shipped card rule does), and another would take its relay as a hint. "As if it were absent" in
A covers every use at once: providers, relays, counting and self-entries. C breaks "one place per wire fact".

### Choice 3 — Concept headers that no key names alone (Open question 1)

Under 2(a) no key names a Concept header whose `d` is empty. Nor does any key name alone a kind-39998 header whose `d`
is `dlist-header`, which § 4.6 forbids: its only spelling, `39998:dlist-header`, is the bare kind. And
`39999:dlist-header` reads two ways, as a Concept key or as the bare `39999` by analogy with the legacy spelling: with
`[39999:dlist-header, X]` and `[39998, Y]`, the 39999-declared headers go to Y or to X (V18). The owner's answers
settle none of this.
- **Option A (chosen; the owner ratified it).** No key reaches a Concept header whose `d` is empty or `dlist-header`,
  as § 4.6 has it for `39999:duty-menu`; `39999:dlist-header` names no Concept.
- **Option B.** `*` and the bare kinds reach both.

§ 3's fallback resolves an insight by its exact key: its Per-insight bullet says "the reader resolves the insight by
its exact key", and step 2 asks for the menu row "that answers the insight's exact key". Under A, every insight that a
key reaches has an exact key that names it alone and wins it; under B these headers have none (V18). A follows § 4.6's
precedent, and touches only headers to which no conforming writer gives a key.

### Choice 4 — § 9.2 Meaning's tie clause

Meaning says "where § 6 picks no single one of them, no self-entry wins it".
- **Option A (chosen).** Drop the clause and rewrite Ties to say that none arise.
- **Option B.** Keep the clause as a safety net.

With the order, § 6's new sentence that two spellings of one key are one key (sub-decision 3), and § 4.5's
one-segment `d`, no two distinct keys tie (0 of 580 keys, `39998::` and `39999::` included, V18). Where A lists one
key twice, § 7 already keeps the first. B would keep a rule for a case the grammar no longer has, and send readers
looking for one. A supersedes ADR 0003 sub-decision 2's "Why a tie claims nothing" (sub-decision 10).

### Choice 5 — Finding 23's terms

- **Option A (chosen).** § 2 defines "offered" per insight. Step 3 names three outcomes for a key: **offered**,
  **partly offered** (the menu gives K a relay and K has a differing row) and **not offered as a whole**. Step 4's
  differing-row clause then reads "where the menu gives K a relay", so the terms do not define each other.
- **Option B.** Rename step 3's outcome only ("K's answering row offers it").

Under B, `3039x` in § 13.2 would still be both "not offered as a whole" and "partly offered", which is two terms for
one outcome. Under A, `3038x` is partly offered and `3039x` is not offered as a whole, and each K has exactly one
consistent reading (V20). No term reads as "every insight is offered" for a key with a part that is not offered.

### Choice 6 — The Sources lines of Assistant Designation and Trusted Lists (Open question 2)

AC6's Sources bullet asks each spec's Sources line to name this ADR for the sections that rest on it; its scope bullet
limits these two files to "the sentences AC1 names". Sub-decision 5's sentences state rules of their own (a header
declared as a kind-39999 item is covered; a `d-tag` is never empty), so they rest on this ADR, and the bullets
conflict.
- **Option A (chosen; the owner ratified it).** One clause in each Sources line. Repo metadata is not spec text, and
  Assistant Designation's line already names ADR 0003 section by section.
- **Option B.** Leave both lines: a departure from the Sources bullet.

### Choice 7 — How § 4.3 says that a replaceable kind counts as addressable

- **Option A (chosen).** Define the term once in § 4.3: in this NIP an addressable kind is one NIP-01 references by
  address, `0`, `3`, `10000`–`19999` and `30000`–`39999`. § 4.2's table, § 10.3, § 10.7 and § 12 then read right as
  they stand; § 12's row gains a pointer and an example.
- **Option B.** Keep NIP-01's term, and write "addressable or replaceable" in § 4.3's `30394` bullet, § 4.2's table,
  § 10.3's two rows, § 10.7's row and § 12.

The owner's words are "count as addressable". B leaves five places to agree, and this ADR's first draft missed two
(§ 4.2 and § 12; review F1, AC-1). A puts the rule in one place. Its cost: Treasure Maps' "addressable" is wider than
NIP-01's, Content Categories' and Spawning's, so § 4.3 says so and names them.

## Decision

Exact spec text follows. "→" means "replace with". Line numbers are as of `b13bb6b5`.

### 1. The bare Concept kinds, and the headers no key reaches (AC1; Treasure Maps § 4.5, § 4.6, § 5.3, § 10.1, § 10.12)

§ 4.5's first paragraph (:182) → the text below (sub-decisions 1 and 2 together). The second paragraph (:184) stays.

```text
Concept keys keep the shape ratified in assistant-designation.md: `39998:<d-tag>` (or `39999:<d-tag>` for a header declared as a kind-39999 item). Split at the **first** colon; the rest is the `d` tag, verbatim, and may contain colons. The `d` is one segment, however many colons it holds, and a value: § 4.1's rule that a segment never contains `:`, and § 4.4's empty segments and trimming, don't apply to it. So under § 6, `39998::` (`d` = `:`) beats `39998`.

- **The bare kinds.** The bare kind `39998` means all of the observer's Concept headers, those declared as kind-39999 items included; the legacy spelling `39998:dlist-header` means the same and stays valid. The bare kind `39999` means the observer's headers declared as kind-39999 items. Where a Map has both, § 6 gives those headers to `39999`. Neither reaches the headers that § 4.6 and the next bullet leave out.
- **A Concept kind and a colon alone** (`39998:`, `39999:`) is not a key: it names no `d` tag, and it is not a spelling of the bare kind. Readers MUST ignore a Map entry keyed so, a self-entry (§ 9.2) included, as if it were absent; writers SHOULD write the bare kind instead. So no key names a Concept header whose `d` is empty, and, as for the headers § 4.6 leaves out, no key reaches one: `*`, `39998` and `39999` never do.
- System words don't apply to Concept keys, and `*:tag` or `*:dlist` never match a Concept.
```

- **§ 4.6** (after :192). Add:

  ```text
  Nor does any key match a Concept header whose `d` is `dlist-header`, of either kind, such as an event that breaks the reservation above. `39998:dlist-header` is the bare `39998` (§ 4.5); `39999:dlist-header` names no Concept and asks for nothing, and a client builds no filter for it (§ 5.3); and `*`, `39998` and `39999` never reach such a header.
  ```
- **§ 5.3** (:248). The parenthetical → "(No key reaches a kind-`39999` header whose `d` is `duty-menu`, a Concept
  header whose `d` is `dlist-header`, or one whose `d` is empty: §§ 4.5 and 4.6.)"
- **§ 10.1** (:440). The `39998` row's text → "…my Concept Graph — my DList headers, those declared as kind-39999
  items included, and the items filed under them — except where this Map says otherwise." Add after it:
  `` | `39999` | …my DList headers declared as kind-39999 items, and the items filed under them, except where this Map says otherwise. | ``
- **§ 10.12** (:570). "(The bare `39998` is in § 10.1.)" → "(The bare `39998` and `39999` are in § 10.1.)"

### 2. A Concept kind and a colon alone is not a key (AC1; § 4.5, § 4.7, § 3, § 9.2)

- **§ 4.5.** The second bullet above is the one normative statement.
- **§ 4.7** (:204, :209). The scope line's comment `; Concept kinds only; rest of string` → `; Concept kinds only
  (§ 4.5)`. After the `metric` line, add:
  `` d-tag     = 1*OCTET                                     ; the rest of the key, verbatim, colons included (§ 4.5) ``
- **§ 3, Filling element 3** (:82). Delete "; a K that is a Concept kind and a colon alone (`39998:`, `39999:`) takes
  no relay from a self-entry until this NIP settles what such a key means". The sentence ends "…so `39998:dlist-header`
  is `39998`."
- **§ 9.2** (:380). Delete the paragraph "**A Concept kind and a colon.** …". § 4.5 names self-entries.

A self-entry, a Map entry and (sub-decision 8) a menu row keyed so all read alike: each is ignored.

### 3. § 6 orders the Concept kinds (AC1)

§ 6's lead, bullets and first sentence after them (:265–270) → the text below. The table and "Why left-most" stay.

```text
When several entries match an insight, the entry with the most specific key wins. Keys are read as §§ 4.1, 4.4 and 4.5 read them, so two spellings of one key are one key: `30396:tag::` is `30396:tag`, and `39998:dlist-header` is `39998`. Compare keys segment by segment, left to right. At the first segment where they differ, the more specific one wins:

- kind slot: exact kind, then family wildcard, then `*`. Of the two Concept kinds, `39999` beats `39998`: a bare `39998` reaches both kinds of Concept header (§ 4.5), as a family reaches its kinds.
- any later segment: a value beats empty or omitted.

A bare `39998` that matches a header declared as a kind-39999 item is the one case where a matching key names a value the insight does not have, and there the kind-slot rule orders it below every `39999` key. Apart from that case, every matching key agrees with the insight wherever it names a value; so this always picks one winning key. Every entry with that key is a provider for the insight, in order (§ 7). Entries with other keys are ignored for it.
```

"Two consequences:" (:294) → "Three consequences:". After the "left-most difference" bullet (:297), add:

```text
- **The two Concept kinds.** With `["39998", B, …]` and `["39999", C, …]`, B is the provider for the kind-`39998` Concept headers and C for the headers declared as kind-`39999` items, apart from those no key reaches (§§ 4.5 and 4.6).
```

### 4. Self-Maps follow (AC1; § 9.2; story 3 review NB3 and B2)

- **Meaning** (:351). "…found by § 6 among A's self-entries alone; A's other entries take no part, and where § 6
  picks no single one of them, no self-entry wins it." → "…found by § 6 among A's self-entries alone, and A's other
  entries take no part (Ties)."
- **Ties** (:357) → the text below.

```text
**Ties.** None arise. § 6 picks one winning key among A's self-entries for each insight they match, a `39999` key over a bare `39998` included, and where A lists that key more than once, § 7 keeps the first. So with A's menu `39998` → Rc, `39999` → Rd, and duties among headers of both kinds, A's self-Map `39998` → Rc, `39999` → Rd says that A publishes its duties among the headers declared as kind-39999 items at Rd, and its other Concept duties at Rc. Each self-entry still needs an insight it speaks for (When it changes): while no header declared as a kind-39999 item is among A's duties, `39999` → Rd speaks for none, and A leaves it out.
```

What a reader can now tell:
- **NB3.** § 9.2's MUST NOT ("speaks for none of the insights it wins") and the order agree. The self-Map
  `{39998 → Rc, 39999 → Rd}` meets it exactly when each of its two self-entries wins a duty it speaks for. With duties
  of only one kind, the other self-entry is left out.
- **B2.** With A's self-Map `{* → R0, 39998 → Rc, 39999 → Rd, 39999:c1 → Rd}` and the observer's `[39999:c1, A]`, the
  self-entry `39999:c1` → Rd wins the header, and it is the observer's key. So AC3's "the same key" holds, and ADR
  0003 A2-4's departure ends.
- **Sub-decision 2.** It holds: the order does not rank a bare `39998` above `39999`, and no self-Map claim becomes
  false (V13–V15).

### 5. Assistant Designation and Trusted Lists point at Treasure Maps (AC1)

- **`assistant-designation.md` :38.** "— "for my kind-39998 DList headers, the authoring provider is `<TA-pubkey>`,
  fetchable at `<relayURL>`." The provider pubkey…" → "— "for my DList headers, the authoring provider is
  `<TA-pubkey>`, fetchable at `<relayURL>`." Which headers that covers, those declared as kind-39999 items included,
  is for [Treasure Maps](./treasure-maps.md) § 4.5 to say. The provider pubkey…"
- **`assistant-designation.md` :64,** the per-DList split rule. "…everything after it is the d-tag, which may itself
  contain colons." → "…everything after it is the d-tag, which may itself contain colons and is never empty: a kind
  and a colon alone (`39998:`, `39999:`) is not a key, and `39999:dlist-header` and `39999:duty-menu` name no
  header ([Treasure Maps](./treasure-maps.md) §§ 4.5 and 4.6)."
- **`trusted-lists.md` :103–106,** the families sentence. "The `39998`/`39999` families — the blanket Tapestry
  Assistant designation and per-DList curation entries — are specified in [assistant-designation.md](./assistant-designation.md);
  for those, readers split the first element at the **first** colon and treat the remainder as an opaque d-tag." →
  "The `39998`/`39999` families are Concept keys, not Trusted List entries: the bare kinds `39998` and `39999`,
  specified in [Treasure Maps](./treasure-maps.md) § 4.5, and the blanket Tapestry Assistant designation and
  per-DList curation entries, specified in [assistant-designation.md](./assistant-designation.md). What each covers
  is for Treasure Maps §§ 4.5 and 4.6 to say. For a key with a d-tag, readers split the first element at the
  **first** colon and treat the remainder as an opaque d-tag, never empty: a kind and a colon alone (`39998:`,
  `39999:`) is not a key."

A reader of either spec alone, given an entry keyed `39998:`, learns that it is not a key. Given `39999:dlist-header`,
it learns that the key names no header (Assistant Designation) or is sent to §§ 4.5 and 4.6, which say so (Trusted
Lists; V24). Given a header declared as a kind-39999 item under a blanket entry, it learns that the entry covers it,
and is sent to Treasure Maps § 4.5. A Trusted Lists reader given a bare `39998` or `39999` (the editor writes both) is
sent there too, and no longer takes it for a generic Trusted List entry.

Assistant Designation still names no bare kind. Revision 1 had it say "As a Treasure Map key the entry is the bare
`39998`". With that, its dual-author lookup's step 2, which finds the TA "from U's kind-10040 `39998:dlist-header`
entry", read two ways for the editor's Map: no TA, or the Assistant given Concepts (V25). The other option was to
confine the sentence to matching ("For which headers it asks for, the entry is … the bare `39998`"). That would
settle step 2 by implication, for the literal spelling alone. Whether a bare `39998` entry names a user's TA lies
outside the Assistant Designation sentences AC1 names. It goes to a new protocol row (sub-decision 11; Open question 3).

### 6. Category `39998`, and addressable kinds (AC2; Treasure Maps § 4.3, § 12)

§ 4.3's agreement bullets for `30393` and `30394` (:158, :159) → the two bullets below. After the list (:162), add the
two paragraphs below. The other bullets stay.

```text
- `30393` — a non-addressable event kind (below), the *DList headers* category (`39998`), or a DList whose subject is `e`;
- `30394` — an addressable event kind (below), the *DList headers* category (`39998`), or a DList whose subject is `a`;

**Addressable kinds.** In this NIP an *addressable* event kind is one whose events NIP-01 references by address, with an `a` tag: `30000`–`39999`, and the replaceable kinds `0`, `3` and `10000`–`19999`. So `3039x:tag:10002` matches `30394` lists only. This departs from [Content Categories](./content-categories.md) (its table of category types, and § 4) and [Spawning](./spawning.md) § 3.2, which use NIP-01's narrower term and so give a replaceable kind's events `e`, and `30393`.

**Category `39998` takes three List kinds**, as Content Categories § 2 gives them, and their Score kinds `30383`, `30384` and `30387`: `30393` lists headers referenced by id, as a `9998` or `9999` header must be; `30394` lists headers referenced by address (`39998`, `39999`); and `30397` lists headers as lists, whatever their kind. So `3039x:tag:39998` covers three lists for each Tag, and one header tagged T can sit in a `30394` list and in a `30397` list.
```

- **§ 12** (:614). "`30393:tag:<kind>[:<Tag>]`; for an addressable kind such as `34550` communities,
  `30394:tag:<kind>[:<Tag>]`" → "`30393:tag:<kind>[:<Tag>]`; for an addressable kind (§ 4.3), such as `34550`
  communities or `10002` relay lists, `30394:tag:<kind>[:<Tag>]`".
- **Content Categories and Spawning.** Category `39998` agrees with Content Categories § 1.3 and § 2. Addressable kinds
  agree with § 2's "referenced by address", since NIP-01's `a` tag refers to "an addressable or replaceable event", but
  not, read with NIP-01's term, with Content Categories' type table and § 4 or with Spawning § 3.2; § 4.3 now says so
  (AC2). Spawning § 3.2 also spawns one List kind, `30397`, for (T, `39998`) (Consequences). Neither file is in AC6's
  scope (Open question 3).
- **§ 10.10 and § 10.11.** Their keys still read true. `30397:tag:39998:⟨Local⟩` names one list, the `30397` one, and
  `30387:tag:39998:…:<metric>` names one Score kind (V5).

### 7. The Profiles category (AC3; Treasure Maps § 4.4, § 10.5, § 13)

§ 4.4's bullets (:175–178) → the text below.

```text
- An **omitted** trailing segment, or an **empty** segment, means *any*, except as the Profiles category below says. `30396:tag` and `30396:tag::` both mean every Tag-based list of DList items, for any DList and any Tag.
- An empty segment may sit in the middle: `30396:tag::⟨Vegan⟩` covers the Vegan list of every DList.
- The system slot can't be empty. To cover every system, stop after the kind: `30396`.
- **The Profiles category.** In a `tag` or `pin` key whose kind slot is `30392` or `30382`, an empty category with a value in some later segment is the Profiles category, whose slot value is empty (§ 4.3), not *any*. So `30392:tag::⟨Podcaster⟩` names one list, the profiles tagged Podcaster, and does not cover `30392:tag:⟨Nashville Chefs⟩:⟨Podcaster⟩`, whose category is a DList of people.
  - An omitted category, or a trailing empty one, still means any category: `30392:tag::` is the key `30392:tag`, which covers both lists.
  - The rule reads the key's own kind slot. In a family or `*` key an empty category means any category, for every kind the key reaches: `3039x:tag::⟨Podcaster⟩` covers `30392:tag:⟨Nashville Chefs⟩:⟨Podcaster⟩` as well as `30392:tag::⟨Podcaster⟩`.
  - So a profile kind has no key for one Tag, Pin or metric in every category (§ 13, question 2). A Map names each category's key, or leaves out the Tag, Pin or metric as well (`30392:tag`).
- A key whose slots are all filled is exact. So is a key whose only empty slot is the Profiles category: `30392:tag::⟨Podcaster⟩` is exact.
```

- **§ 10.5 `30392:tag`** (:485): "…for each Tag in my supported Tags for profiles, except…" → "…for each Tag in my
  supported Tags, in each category of profiles it is supported in (the Profiles category, or a DList of people),
  except…".
- **§ 10.5 `30382:tag`** (:488): "…a Score for each Tag in my supported Tags for profiles, in every metric, except…" →
  "…a Score for each Tag in my supported Tags, in each category of profiles it is supported in, in every metric,
  except…". (`30392:tag` and `30382:tag` match the DList categories too, V6; the other § 10.5 rows and § 6's
  Podcasters row already read the Profiles category.)
- **§ 13 question 2** (:631) → "**Empty categories.** Here an empty category is always a scope, except where § 4.4
  makes it the Profiles category: in a profile kind's `tag` or `pin` key, with a value after it. So there is no single
  "Bitcoin events of any kind" list, and no key for one Tag's profile lists in every category; clients combine the
  per-category lists. Should an "any category" list exist too?"
- **§ 13 question 3** (:632). Before the final period, append "; in a profile kind's `tag` or `pin` key, an empty
  category with a value after it is the Profiles category (§ 4.4)".

### 8. Duty Menus follows (AC4; `duty-menus.md` § 5.3, § 6.2, § 13.3, § 14)

- **§ 5.3** (:123). The bullet "A row keyed `39998:` or `39999:` … instead." → "So is a row keyed with a Concept kind
  and a colon alone (`39998:`, `39999:`): it is not a key (Treasure Maps § 4.5)." It follows :122's "A row whose key
  does not parse is ignored."
- **§ 6.2 step 1, lead** (:167). Delete "Where it leaves a question open (the Concept kinds, category `39998`, and the
  profiles category slot), this spec reads it as below until Treasure Maps settles it (open questions 5 to 7 below)."
- **Step 1, the event-kind bullet** (:169) → "an event-kind number agrees with the List kinds Treasure Maps § 4.3
  gives that number, and with their Score kinds. So `30394` covers `3039x:tag:10002`, a replaceable kind, and `30397`
  does not cover `3039x:tag:39998`, which also matches `30393` and `30394` lists;"
- **Step 1, the empty-category bullet and its three sub-bullets** (:171–174) → one bullet: "an empty category means any
  category (Treasure Maps § 4.4), except the Profiles category that § 4.4 gives a `tag` or `pin` key whose kind slot is
  `30392` or `30382`. So `30392:tag::⟨T⟩` is exact, and `3039x:tag::⟨T⟩` matches `30392:tag:⟨D⟩:⟨T⟩`;"
- **Step 1, Concept kinds** (:184–187). Delete the block "The Concept kinds, until Treasure Maps settles them …". In
  the examples list, before the `*:<scope>` bullet (:183), add: "a bare `39998` covers every Concept key, `39999` and
  `39999:<d>` included, and a bare `39999` covers the `39999:<d>` keys (§ 4.5);"
- **Step 1, last bullet** (:188). "says so for `39999:duty-menu`" → "says so for `39999:duty-menu` and
  `39999:dlist-header`". Append: "Nor has a Map entry keyed `39998:` or `39999:`, which is not a key: readers ignore
  the entry (Treasure Maps § 4.5)." This answers finding 19.
- **Step 2** (:189). It drops "with step 1's order for the Concept kinds". Sub-decision 9 (finding 13) gives the
  step's whole new text.
- **Step 4, the meet** (:193). "It is a Treasure Maps § 4.7 key, with two exceptions. The meets of a Map key `39998:`
  or `39999:` wait on Treasure Maps (open question 5 below). And a meet that would be…(step 1), while…" → "It is a
  Treasure Maps § 4.7 key, with one exception: a meet that would be a `tag` or `pin` key with kind slot `30392` or
  `30382`, and an empty category with a value after it, has no key when neither K nor the row is limited to the
  Profiles category, since that spelling means the Profiles category only (Treasure Maps § 4.4), while the insights
  both keys match span every category." ("With a value after it": a meet with its category omitted, such as
  `30392:tag` from K = `30392` and the row `3039x:tag`, is a key for any category, V21.)
- **§ 13.3** (after :366). Add the row
  `` | `39999` | `39998` (a bare `39998` covers every Concept key, Treasure Maps § 4.5) | Offered: `["39999", "<A>", "wss://concepts.example"]` | ``.
  This is AC4's check made visible. 1(a) gives the provisional reading's answer, so no existing example changes.
  (Under 1(b) the entry would be `["39999", "<A>", ""]`, V7.)
- **§ 14** (:374–376). Each question becomes resolved, as question 4 is:
  - "5. ~~The Concept kinds~~ — resolved: [Treasure Maps](./treasure-maps.md) § 4.5 and § 6."
  - "6. ~~Category `39998`~~ — resolved: Treasure Maps § 4.3."
  - "7. ~~The profiles category slot~~ — resolved: Treasure Maps § 4.4."

After the change, no Duty Menus sentence says that Treasure Maps leaves these questions open.

### 9. Duty Menus wording (AC5)

- **Finding 12** (step 5, :214, :216). Append to the "no substitute" bullet: "Outside K, such a key may still take
  insights from the observer's other entries." In the second example, "choosing `30396:tag::⟨T⟩` changes nothing,
  because K names D at the third segment." → "choosing `30396:tag::⟨T⟩` changes nothing under K, because K names D at
  the third segment, though outside K it may take `30396:tag:⟨D′⟩:⟨T⟩`, for another DList D′, from a broader entry."
  The first example is a true no-op and stays.
- **Finding 13** (step 2, :189). Step 2 → "The **answering row** is the most specific covering row, by Treasure Maps
  § 6, among `duty` and `not-offered` rows together. Two covering rows never tie, and among the covering rows the same
  one is the most specific for every insight under K."
- **Finding 15** (§ 8.1, :258). "…: a relay, too, returns only the latest version at the address." → "…: a relay, too,
  SHOULD return only the latest version at the address, as NIP-01 asks for replaceable events." NIP-01 states that
  SHOULD for replaceable events; for addressable ones it has relays store the latest and lets them discard the rest.
- **Finding 17:**
  - **§ 5.3** (:124). Append to the duplicates bullet: "Ignored rows (§ 5.1 and above) take no part, so `["duty",
    "3038x", ""]` followed by `["duty", "3038x", "wss://r"]` offers `3038x` at `wss://r`."
  - **§ 5.4** (:129). "At most one `json` tag." → "At most one `json` tag; a reader that finds several uses the first
    and ignores the rest."
  - **§ 4** (:94). "at most one: per-duty details (§ 5.4)." → "at most one: per-duty details (§ 5.4). Where a menu
    carries several, the first counts."
- **Finding 22** (§ 5.1, :106). "still names a provider" → "still names an Assistant".
- **Finding 23** (§ 2 :50, step 3 :190, step 4 :196 and :197, § 13.3 :363 and :365):
  - § 2 → "**Offered** — of an insight: the row that wins it among the menu's rows (Treasure Maps § 6) is a `duty`
    row, so the key will publish it at that row's relay if a Treasure Map assigns it to the key. § 6.2 step 3 says
    when a Treasure Map key is offered, partly offered, or not offered as a whole."
  - Step 3 → "If the answering row is a `duty` row, the menu gives K its relay: K is **offered** at that relay, or
    **partly offered** if K has a differing row (step 4). If the answering row is a `not-offered` row, or no row covers
    K, the menu gives K no relay, and K is **not offered as a whole**, whatever rows within K offer."
  - Step 4, the differing-row clause (:196): "with `not-offered`, where K is offered; or with an offer, where K is not
    offered as a whole." → "with `not-offered`, where the menu gives K a relay (step 3); or with an offer, where it
    gives K none."
  - Step 4 (:197): "K is **partly offered** when it has at least one differing row." → "A K that the menu gives a
    relay is **partly offered** when it has at least one differing row (step 3)." The next sentence stays.
  - § 6.2's other uses already use step 3's terms or say "as a whole", and stay: :197's per-insight "offered", :203,
    :228 and :231.
  - § 13.3's `30385:rank` result: "Not offered" → "Not offered as a whole".
  - § 13.3's `3039x` result: "Not offered as a whole; partly offered through `3039x:tag`." → "Not offered as a whole:
    `3039x:tag`, within it, offers its part." The rest of the cell stays.
  - So with § 13.2's menu, `3038x` is partly offered and `3039x` is not offered as a whole. Each has one term (V20).
- **Finding 24.**
  - **§ 8.2** (:271). After the filter, add: "A reader sends it to Nous' kind 10002 write relays, where every publisher
    SHOULD send its menu (§ 8.1), and to any other relays it chooses."
  - **§ 4** (:96). "…so a `#z` query on that handle finds them all." → "…so a `#z` query on that handle finds every menu
    that the relays it asks hold (§ 8.2)."
- **§ 2's own Assistant** (:46). Delete ", its own key included". After ADR 0003 A1-2 no fill rule reaches a
  self-entry, so the clause applied nowhere.
- **§ 14 question 3** (:372, ledger self-maps row item 8). Append: "And what do such a key's self-entries speak for,
  with no one observer whose Map and supported sets they are read over ([Treasure Maps](./treasure-maps.md) § 9.2)?"

### 10. Records and supersessions (AC6)

- **ADR 0002 A1-8** was answered by 1(a) and 2(a). Its readings are now Treasure Maps § 4.5 and § 6, and every "until
  story 3" in it has ended. Its "What a Map key `39998:` or `39999:` matches, and so its meets" is answered: it is not a
  key, so it has nothing to resolve. A1-1's Concept example, A1-2's "Without A1-8" paragraph and A1-3's Concept-meet
  exception now rest on Treasure Maps.
- **A1-9** was answered by 3(a). Its first bullet now also reads a replaceable kind as `30394` (finding 18).
- **A1-10** was answered by 4(a), in all four parts.
- **ADR 0003.** It reads ADR 0002's "story 3" for these items as this story.
  - Sub-decision 2's "Why a tie claims nothing", and the Meaning clause it wrote, are superseded by sub-decision 4 and
    Choice 4.
  - Sub-decision 3's "Concept kind and a colon" bullet and sub-decision 8's § 3 clause are superseded by
    sub-decision 2.
  - A2-4's provisional departure ends.
  - A2's "NB10 … for story 4's ADR" now means story 5, which the owner's answer 5(a) planned. So does the § 5.4
    Enumerate question that A2 left "for story 4 or a later docs pass".
- Neither ADR's text is edited, except ADR 0003 at the loose-ends row's items 2 and 3 (sub-decision 11).

### 11. Bookkeeping (AC6)

- **Metadata:**
  - **`treasure-maps.md` :5.** After "…a retracted List, § 7)", add ", and ADR 0004 (the key grammar: § 4.3's category
    `39998` and addressable kinds, § 4.4's Profiles category, § 4.5's bare Concept kinds and a Concept kind and a
    colon, § 4.6's `dlist-header` headers, § 4.7's `d-tag`, and § 6's order of the Concept kinds; and §§ 3, 5.3, 9.2,
    10.1, 10.5, 10.12 and 12 and § 13 questions 2 and 3, which follow them)".
  - **`duty-menus.md` :6.** In ADR 0003's parenthesis, "§ 6.2's lead and step 5, § 10 and § 14" → "§ 6.2's lead, step
    1's last bullet and step 5, § 7's own-Assistant exception, § 10 and § 14". Then add ", and ADR 0004 (the key
    grammar Treasure Maps §§ 4.3–4.6 and 6 settles, which § 5.3, § 6.2 and § 14 follow, and the wording of §§ 2, 4, 5,
    6.2, 8 and 13.3)".
  - **`duty-menus.md` :5,** Implementation → "partial. An instance publishes a signed-in person's Assistant's menu
    when the person asks, with rows naming the instance's own relay, and reads a key's published menu (§ 8.1) for its
    Duty Menu check. Nothing yet fills a Treasure Map entry's relay from a menu (§ 6.2 step 5), and Nous' header is not
    yet published."
  - **`assistant-designation.md` :4** (Choice 6). After "…a triple naming its own author)", add ";
    `duty-menus-and-self-maps` ADR 0004 (§ Relationship to NIP-85 and § Per-DList curation entries: which headers the
    blanket entry covers, a d-tag that is never empty, and the keys `39999:dlist-header` and `39999:duty-menu`,
    which name no header, as Treasure Maps §§ 4.5 and 4.6 say)".
  - **`trusted-lists.md` :4–7** (Choice 6). After "(`event-tagging` ADR 0016)", add "; and `duty-menus-and-self-maps`
    ADR 0004 (§ Treasure-Map advertisement: the `39998`/`39999` families, read as Treasure Maps §§ 4.5 and 4.6
    say)".
- **`protocols/README.md`:**
  - **:65.** The Treasure Maps row's first cell → "Treasure Maps: key grammar, scopes, precedence, Preferred/Alternate,
    Self-Maps (what a key publishes now) and the read-time fallback for an entry's relay (companion to NIP-85 kind
    10040)".
  - **:73.** The Duty Menus row's note → "**Working copy here.** An instance publishes a person's Assistant's menu on
    request and reads a key's menu; nothing fills Treasure Map entries from menus yet, and Nous' header is not yet
    published."
- **The handoff** (`docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md`):
  - **:3.** "code NOT built (tracked in …)" → "code partly built: book `assistant-duty-menu` publishes and reads Duty
    Menus, and book `assistant-self-map` (open) builds self-Maps; the rest is tracked in …". The pointers are kept.
  - **:14.** "§ Authorship." → "§ Authorship and § Relationship to NIP-85."
- **Ledger:**
  - **`2026-10-09-draft-grammar-bare-39999`.** DONE. Dated note: settled by 1(a) and 2(a) in Treasure Maps § 4.5, § 6,
    § 10.1 and § 10.12, with § 3 and § 9.2 updated (story 4, ADR 0004).
  - **`2026-10-11-duty-menus-spec-fold-forwards`.** DONE. Title → "Story 2's review round 3 left non-blocking wording
    gaps in the Duty Menus spec". Dated note on where each item landed: findings 12, 13, 15, 17, 22, 23 and 24 in AC5;
    18 in Treasure Maps § 4.3; 19 in Treasure Maps § 4.5 and Duty Menus § 6.2 step 1; the "its own key included" note
    in § 2.
  - **`2026-10-12-self-maps-record-loose-ends`.** DONE, in the order below.
  - **`2026-10-12-self-maps-spec-fold-forwards`.** Title → "…for story 5 of the epic to fold in". Dated note: items 3,
    8 and 15 are done in story 4; items 5, 9, 10, 12, 13, 19 and 20 and the § 5.4 Enumerate question go to story 5
    (owner, 5(a); NB10 included, per sub-decision 10). It stays OPEN.
  - **`2026-10-12-duty-menu-code-cross-book-notes`.** Dated note: item 1's spec texts (`duty-menus.md`:5, the README
    row) and the handoff's Status line are done in story 4; its intake part and items 2–4 stay with the code books. It
    also points at the new code row below.
  - **New row `2026-10-12-treasure-map-concept-key-readers`** (type `bug`), titled "Four shipped readers take some
    Concept keys otherwise than Treasure Maps §§ 4.5, 4.6 and 6: the /treasure-map card rule, its editor, the
    Dictionary entry page and the My Assistants duties list". It names:
    - **Created by story 4.** `entryOf`/`appliesTo` count an entry keyed `39998:`, `39999:` or `39999:dlist-header`
      for Concepts; that reaches the card, its details and the server's check (`categoryAssistants`,
      `src/api/assistant/trustedContent.js`). `roleOf` lists a `39998:` entry as an individually assigned Concept duty,
      which the override switch removes; only a hand-written Map, or another client's, reaches this, since the editor
      writes the bare kinds. `conceptCurator` (`ui/src/utils/treasureMap.js`) gives a header declared as a kind-39999
      item to the blanket `39998:dlist-header` entry, where § 6 gives it to a `39999` entry (Case A), and
      `classifyEntry` lists `39999:dlist-header` as a per-DList entry, which the My Assistants duties list
      (`treasureMapDuties`) shows as the duty "Curated DList: dlist-header". That list shows no duty for a bare `39999`.
    - **Older.** `conceptCurator` ignores a bare `39998` (§ 4.5's legacy spelling) and falls back to the local
      Assistant (Case B). The card rule counts `39999:duty-menu` (§ 4.6). `classifyEntry` lists `39999:duty-menu` as a
      per-DList entry, which `treasureMapDuties` shows as the duty "Curated DList: duty-menu", and `findDListEntries`
      keeps it. `readMenuRows` drops a `duty` row whose relay is not `ws://`/`wss://`, which the spec keeps.
      `treasureMapDuties` shows no duty for a bare `39998`.
    - **What already agrees:** a bare `39998` hiding `*` on the Concepts card (1(a)); a bare `39999` not hiding it;
      trimming `30392:tag::` (4(a)); `readMenuRows`, which ignores `39998:`/`39999:` rows and drops an empty-relay row
      before the duplicate check (finding 17); and `findDListEntries` in ignoring `39998:` and `39999:dlist-header`
      (not `39999:duty-menu`, above). No other reader was checked.
    - Book `assistant-self-map`'s "Provisional key grammar" line is now settled.
    - Fix shape: `entryOf` returns null for exactly `39998:` or `39999:`; `appliesTo` leaves out `39999:dlist-header`
      and `39999:duty-menu`; `conceptCurator` follows § 6 for the bare kinds; `classifyEntry` and
      `findDListEntries` leave out `39999:dlist-header` and `39999:duty-menu`, and `treasureMapDuties` reads the bare
      kinds as § 4.5 does; each with a test.
  - **New row `2026-10-12-addressable-kinds-spawning-content-categories`** (type `protocol`), under Open question 3
    (a); under (b) it names Content Categories alone. Titled "Spawning § 3.2 and Content Categories read
    "addressable" as NIP-01 does, and Spawning spawns one List kind for category `39998`, where Treasure Maps § 4.3
    now differs". It names `spawning.md` § 3.2's
    "(non-addressable)" row (:64), which gives a replaceable kind `30393`, a key that matches nothing; its *DList
    headers* row (:68), which spawns `30397` only while `3039x:tag` asks for three List kinds; and
    `content-categories.md` :23 and :193, "`a` if addressable". Fix shape: point the first and third at Treasure Maps
    § 4.3. The second asks what an Assistant spawns for (T, `39998`) under its support gate. The PO places the row
    (story 5 or a later docs pass).
  - **New row `2026-10-12-bare-39998-ta-discovery`** (type `protocol`), under Open question 3 (a) or (b). Titled
    "Assistant Designation finds a user's TA from the `39998:dlist-header` entry, which Treasure Maps § 4.5 makes the
    same key as a bare `39998`: whether a bare `39998` entry names the TA is not settled". It names Assistant
    Designation :38 (the provider "is" the user's TA) and :152 (step 2), and Treasure Maps § 4.5's legacy spelling.
    The editor writes a bare `39998` and `39999` for the Assistant given Concepts (`FAMILY.concepts`), which need not
    be a TA (§ 10.1's Bob's Brainstorm Assistant). Read by its literal spelling, step 2 finds no TA in that Map; read as
    a Treasure Map key, it takes that Assistant for the TA (V25). Shipped `classifyEntry` takes only the literal
    spelling as the designation. Fix shape: an owner decision, then one sentence in Assistant Designation. The PO
    places the row (story 5, which edits Assistant Designation for item 10, or a later docs pass).
- **Order of the loose-ends items** (row `2026-10-12-self-maps-record-loose-ends`):
  1. **Architect, items 2 and 3, in ADR 0003,** with this ADR's `adr:` commit once the owner approves.
     - Item 2. In Verification, AC3 (:1482–1483), the marker → "*(Amended by A2-1: the third and fourth cases each also
       say "and a List the key retracted as one with no members (§ 7)". See Verification for A2.)*". After :1485 add
       "  *(Amended by A2-5: § 3's sentence reads "…publish an insight, except as § 9 says." See Verification for A2.)*".
     - Item 3. At the end of A2's Questions for the owner (after :2447) add "*Approved by the owner on 2026-10-12,
       without the extra reader rule, as Status of A2 says.*"
  2. **PO, item 4 and the A2-4 line,** in story 3's record, in a `story:` commit of their own before Implementation.
     Item 4 adds the AC3 gloss clause. The A2-4 line (story 3 :511 ff.) says that the departure ended when Treasure Maps
     § 6 ordered the Concept kinds (story 4): under the order, § 6 picks one self-entry of A for every insight, and in
     the review's case `39999:c1` → Rd wins and confirms the duty.
  3. **Implementer, item 1.** Under story 3's "Implementer, round 2 fix 1" block (:633), the line "*2026-10-12 (story
     4): three of the four kick-backs above were done before story 4: the departures heading (`fe163bc0`), the A2-2
     markers (`38947382`) and the approval line (`11cc0008`). The fourth, the § 3 part of A2-5's marker, was done in
     ADR 0004's `adr:` commit (loose-ends row, item 2). None is open.*" Then, last, the Implementer flips the row DONE
     after checking that items 2–4 are in; if one is missing, the row stays OPEN and the Implementer kicks that item
     back to its role.

## Consequences

- **One reading per key.** Readers that follow Treasure Maps and Duty Menus pick the same provider and relay for every
  insight under any Map:
  - no two keys that share an insight tie (0 of 580 keys, Concept keys whose `d` holds colons included);
  - every insight that a key reaches has an exact key that names it alone and wins it; no key reaches the Concept
    headers whose `d` is empty, `dlist-header`, or (kind `39999`) `duty-menu`;
  - Duty Menus' answering row is stable, its guarantee holds, each K has one term, and none of its random checks fails.
  - Evidence: `s4/m1_grammar.py`, `s4/m2_menus.py` over 40,000 menus, and `s4/rev1/r1_checks.py`.
- **No provisional readings remain.** Duty Menus § 5.3, § 6.2 and § 14 point at Treasure Maps. Story 3's A2-4
  departure ends, and ADR 0003 sub-decision 2's normal self-Map is allowed.
- **Costs the owner accepted with the answers:**
  - no key names a Concept header whose `d` is empty, so no per-DList entry can curate such a list (2(a));
  - an entry keyed `39998:` that another client wrote is ignored, whatever its writer meant (2(a));
  - an Assistant given `3039x:tag` or `*` is asked for three List kinds in category `39998` (3(a)), where Treasure Maps
    § 8, § 10.10 and § 10.11, and Spawning § 3.2, name only `30397`;
  - a profile kind has no key for one Tag in every category (4(a); § 13 question 2 keeps the question).
- **At this gate** (2026-10-12) the owner answered Open questions 1–3 as recommended, so the ADR stands as written.
- **Other specs.** Under 3(a), Spawning § 3.2's "event kind k (non-addressable)" row gives a replaceable kind `30393`,
  a key that matches nothing (V16), so an Assistant that follows it publishes a list no Map key reaches. Its *DList
  headers* row spawns `30397` only, so such an Assistant cannot keep a `3039x:tag` or `*` self-entry while
  (T, `39998`) is supported: the self-entry would win `30393` and `30394` lists it does not publish (§ 9.2, A part A
  does not publish; V17). Content Categories' "`a` if addressable" reads the same narrow way. § 4.3 names the
  departure, Spawning § 2 already defers agreement to § 4.3, and the first new protocol row carries the fix (Open
  question 3).
- **Self-Maps.** Under the order, a self-entry `39999` wins the headers declared as kind-39999 items. So a self-Map
  holds it only while such a header is among the duties it speaks for; with all Concepts at one relay, `39998` alone
  says it all. No self-Map that was valid under the old Ties text becomes false or barred (0 of 93,256,
  `s4/m3_selfmaps.py`): under Ties, a `39999` key beside a bare `39998` could never win anything, and § 4.6's new rule
  only removes insights from what self-entries win. The reference deployment has published no self-Map yet (book
  `assistant-self-map`'s survey).
- **Shipped code.** The answers create the differences named in the new code row: the card rule and editor count
  entries that are not keys or name no Concept, the Dictionary entry page reads a bare `39999` otherwise than § 6
  (Case A), and the duties list shows `39999:dlist-header` as a duty and no duty for a bare `39999`. The row lists what
  already agrees; code it does not name was not checked.
- **New wire surface:** none. § 4.7 narrows `d-tag` to non-empty, §§ 4.5–4.6 leave out headers to which no conforming
  writer gives a key, and § 4.3 states which kinds already agree.
- **Departures from story 4 as approved**, both from AC6's scope bullet:
  - Choice 6's Option A adds one metadata clause in each of two files (Open question 2);
  - the two new `protocol` rows (sub-decision 11). The bullet allows a new row only where it names a difference from
    shipped code, and these name questions between specs. CLAUDE.md's ledger write discipline, which gives a loose end
    found in a session a row, is the reason (Open question 3).

  None other.
- **Firmware reinstall required?** No. No concept definition changes.

## Open questions for the owner

This ADR is written to each recommendation.

**Answered by the owner, 2026-10-12, at this ADR's gate:** 1 (a), 2 (a), 3 (a), each as recommended.

1. **Which Concept headers no key reaches** (Choice 3). Under 2(a) no key *names* a Concept header whose `d` is empty;
   whether `*`, `39998` and `39999` still *reach* it is open. So is a header whose `d` is the reserved `dlist-header`
   (§ 4.6), which no key names alone when it is of kind `39998`, and `39999:dlist-header` has two readings that give
   different providers.
   - (a) No key reaches either, as § 4.6 has it for `39999:duty-menu`, and `39999:dlist-header` names no Concept. Every
     insight a key reaches then has an exact key that wins it, as § 3's fallback assumes. The cost: § 4.5's and
     § 10.1's "all" headers, and Assistant Designation's "all the user's … header authorship", leave these out.
   - (b) `*` and the bare kinds reach both. Neither then has an exact key, so § 3's step 2 has no row to ask for them,
     and Consequences' exact-key claim must leave them out. `39999:dlist-header` still needs a reading; "names no
     Concept" fits (b) too.
   - **Recommended: (a).** It costs only headers that no conforming writer can give a key of their own: § 4.6 forbids
     the second, and under 2(a) no key names the first. *Owner: (a).*
2. **The Sources lines of Assistant Designation and Trusted Lists** (Choice 6). AC6's Sources and scope bullets
   conflict for these two files.
   - (a) One clause in each Sources line (sub-decision 11): a departure from the scope bullet's list.
   - (b) Leave both lines: a departure from the Sources bullet.
   - **Recommended: (a).** It makes both Sources lines true, as Assistant Designation's already is for ADR 0003, at one
     clause of repo metadata per file and no spec text. *Owner: (a).*
3. **The two new protocol rows** (sub-decisions 5, 6 and 11). This story leaves two spec questions outside AC6's scope:
   Spawning § 3.2 and Content Categories read "addressable" as NIP-01 does, and Spawning spawns one List kind of three
   for category `39998`; and whether a bare `39998` entry names a user's TA (Assistant Designation's dual-author
   lookup, step 2). AC6's scope bullet allows a new ledger row only where it names a difference from shipped code.
   - (a) A new `protocol` row for each, for the PO to place in story 5 or a later docs pass: a departure from the scope
     bullet, for CLAUDE.md's ledger write discipline. Treasure Maps § 4.3 names the first departure meanwhile.
   - (b) As (a), but the PO widens AC6 by Spawning § 3.2's two rows, and this story fixes them. The first row then
     names Content Categories alone.
   - (c) No new row: each goes as an item on row `2026-10-12-self-maps-spec-fold-forwards`, for story 5. That keeps
     within the scope bullet, but it puts two items that are not about Self-Maps into story 5 before the PO sizes it.
   - **Recommended: (a).** The *DList headers* row is not a wording fix: it asks what an Assistant spawns for
     (T, `39998`) under its support gate, which this story's ACs do not cover. The TA question asks the owner who a
     user's TA is, not how a sentence reads. Meanwhile § 4.3, with Spawning § 2's deferral to it, points a careful
     reader at one answer, and Assistant Designation is silent on a bare `39998`, as it was before this story.
     *Owner: (a).*

## Implementation notes

Docs-mode. The Implementer makes sub-decisions 1–9 and 11's edits, except the PO's and the Architect's items.

- **`protocols/drafts/treasure-maps.md`:** :5 (11); :82 (2); :158, :159, after :162 (6); :175–178 (7); :182 (1);
  after :192 (1); :204, :209 (2); :248 (1); :265–270, :294, :297 (3); :351, :357 (4); :380 (2); :440 (1); :485, :488
  (7); :570 (1); :614 (6); :631, :632 (7).
- **`protocols/drafts/duty-menus.md`:** :5, :6 (11); :46, :50 (9); :94, :96 (9); :106 (9); :123 (8); :124 (9); :129
  (9); :167–188 (8); :189 (8, 9); :190 (9); :193 (8); :196, :197 (9); :214, :216 (9); :258, :271 (9); :363, :365 (9);
  after :366 (8); :372 (9); :374–376 (8).
- **`protocols/drafts/assistant-designation.md`** :4 (11), :38, :64 (5), and **`protocols/drafts/trusted-lists.md`**
  :4–7 (11), :103–106 (5): only these lines.
- **`protocols/README.md`** :65, :73, and the **handoff** :3, :14 (11).
- **Ledger:** the five rows and the three new rows (11).
- **Story 3's file:** the Implementer's item-1 line, after the PO's `story:` commit (sub-decision 11's order).
- **Not edited:** BIBLE, Content Categories, Spawning (Open question 3), `protocols/drafts/treasure-map.md`, ADR 0002,
  ADR 0003 (beyond the Architect's items 2 and 3), the epic and the book, and code.
- **Gates:**
  - Every link and § reference resolves. The new `./treasure-maps.md` links in Assistant Designation and Trusted Lists
    are relative to `protocols/drafts/`.
  - `git diff` adds no "canonical", "consensus" or "root".
  - Over the four drafts, `grep -niE "until (treasure maps|this nip) settles|does not yet order|open questions? [5-7]( to 7)? below|wait on treasure maps|treasure maps leaves|leaves .* open"`
    finds nothing. It finds 11 lines today.
  - `bash scripts/harness-lint.sh` is clean, and the stack-free `npm test` shows no regression.
  - `git diff --stat -- protocols/` touches only the four drafts and the README.
- **Branches:** `staging` only. This is a docs change with no port.

## Verification

Re-derive each case from the drafts as changed. Then run the scripts with `python3 -I` from
`/tmp/claude-0/-home-user-tapestry/49f2f34d-5be3-5f81-82eb-f2caf54a3031/scratchpad/s4/`. They load `../r4/tm4.py`, and
`tmfinal.py` overrides it with the final grammar and the variants set aside. `rev1/r1_checks.py` and
`rev2/r2_checks.py` add each revision's cases, and `node rev1/cc.mjs <repo>/ui/src/utils/treasureMap.js` and
`node rev2/code.mjs <repo>` run the shipped readers. The scratchpad is not durable: if the scripts are gone, rebuild
them from sub-decisions 1–7.

**Treasure Maps, matching and § 6** (`m1_grammar.py`):
- **V1 (AC1, order).** Map `["39998", A, …]`, `["39999", B, …]`: header `39998:c1` → A, header `39999:c1` → B. Under
  § 6 as written, `39999:c1` ties. Under the reverse order it goes to A.
- **V2 (§ 6 never ties).** 576 keys: 0 tied pairs that share an insight. Under § 6 as written: 2 (`39998`/`39999` and
  `39998`/`39999:c1`). Choice 1's two wordings order all 5,313 sharing pairs alike.
- **V3 (AC1, bare kinds).** A bare `39998` matches `39998:c1`, `39998:c2` and `39999:c1`. A bare `39999` matches
  `39999:c1`. `39998:dlist-header` is `39998`.
- **V4 (AC1, not a key).** `39998:` and `39999:` are not keys; `39998::` is a key, with `d` = `:`. For Map
  `["39998:", X]`, `["*", Y]`, readers keep only `*`, and header `39998:c1` → Y.
- **V5 (AC2).** `3039x:tag:39998` → `30393`, `30394`, `30397`. `3038x:tag:39998` → `30383`, `30384`, `30387`.
  `3039x:tag:10002` → `30394` (under the other reading, `30393`). `30397:tag:39998:T1` and `30387:tag:39998:T1:conf`
  each name one insight.
- **V6 (AC3).** `30392:tag::T1` matches the Profiles category only, so it does not cover `30392:tag:D1:T1`.
  `30392:tag::` is `30392:tag`. `3039x:tag::T1` matches `30392:tag:D1:T1` and `30392:tag::T1`. No key matches exactly
  T1's `30392` lists in every category. `30392:tag` and `30382:tag` match D1, D2 and Profiles (§ 10.5).

**Duty Menus** (`m2_menus.py`):
- **V7 (AC4, § 13.2 and § 13.3).**

  | K | Answering row | Differing rows | Term | Entry |
  |---|---|---|---|---|
  | `30382:rank` | `3038x` | none | offered | `wss://scores.example` |
  | `30385:rank` | `not-offered 30385` | none | not offered as a whole | insisted: `""` |
  | `3038x` | `3038x` | `not-offered 30385` | partly offered | `wss://scores.example` |
  | `3039x` | none | `3039x:tag` | not offered as a whole | insisted: `wss://lists.example` |
  | `39998` | `39998` | none | offered | `wss://concepts.example` |
  | `39999` | `39998` | none | offered | `wss://concepts.example` |

  Under 1(b), `39999` gives `""`.
- **V8 (finding 12).** Choosing `3039x:tag:1` under K = `30393` changes 0 winners. Choosing `30396:tag::T1` under
  K = `30396:tag:D1`, with Map `30396` → B and `30396:tag:D1` → A, changes 0 under K and 1 outside it
  (`30396:tag:D2:T1`).
- **V9 (finding 13).** For K = `3038x`, the covering rows are `3038x` alone; `not-offered 30385` wins the `30385`
  insights.
- **V10 (finding 17).** `["duty","3038x",""]`, `["duty","3038x","wss://r"]` keeps `wss://r`. If ignored rows took part,
  it would keep nothing.
- **V11 (finding 18).** Menu `3039x` → R0, `30394` → R1, K = `3039x:tag:10002`: R1 (answering row `30394`). Under the
  other reading it is R0.
- **V12 (random, 40,000 menus).** Ties, unstable answering rows, rows within that cover K, meets that miss § 6, the
  listing, the guarantee, the insisted key and "row key iff no effect" fail 0 times. The 32 keyless meets all lie in
  the Profiles class that step 4 names, an empty category with a value after it (0 outside it).

**Self-Maps** (`m3_selfmaps.py`):
- **V13 (B2).** `{* → R0, 39998 → Rc, 39999 → Rd, 39999:c1 → Rd}`, header `39999:c1`: `39999:c1` → Rd wins. Under § 6
  as written, the result is a tie.
- **V14 (NB3).** Menu `39998` → Rc, `39999` → Rd; self-Map `{39998 → Rc, 39999 → Rd}`.

  | Duties | Under the order | Under § 6 as written | Under the reverse order |
  |---|---|---|---|
  | Both kinds | both claims true | `39999` speaks for none | `39999:c1` claimed at Rc, false |
  | Kind 39998 only | `39999` speaks for none | `39999` speaks for none | `39999` speaks for none |
  | 39999-declared only | `39998` speaks for none | both speak for none | `39999:c1` claimed at Rc, false |

- **V15 (random, 20,000 menus, 16,079 cases).** Of 93,256 self-Maps valid under the old Ties text, 0 become false or
  barred under the order. Sub-decision 2's normal self-Map is valid in 58 of 58 cases under the order, and in 0 under
  Ties or the reverse order.

**Revision 1** (`rev1/r1_checks.py`; V22 `rev1/cc.mjs`):
- **V16 (sub-decision 6; F1, AC-1, SRC-1, owner F4).** Under 3(a), § 12's and Spawning § 3.2's keys as they stand,
  `30393:tag:10002`, `30393:tag:10002:T1`, `30383:tag:10002:T1:rank` and `30393:tag:0:T1`, match 0 insights;
  `30394:tag:10002:T1` and `30394:tag:0:T1` match 1 each.
- **V17 (Consequences; F2).** In category `39998`, `3039x:tag` matches T1's `30393`, `30394` and `30397` lists. A
  self-entry `3039x:tag` of an Assistant that publishes only `30397:tag:39998:T1` wins two lists it does not publish.
- **V18 (Choice 3, sub-decision 1; F3, F4).** With headers whose `d` is `dlist-header`, `:` or empty added:
  - first wording: the kind-39998 `dlist-header` header is won by `39998`, which does not name it alone; with
    `[39999:dlist-header, X]`, `[39998, Y]`, header `39999:c1` goes to Y as a Concept key and to X as the bare `39999`;
    with a Concept `d` split at its colons, the `39998::` and `39999::` headers have no single winner;
  - revision 1 (one-segment `d`, § 4.6's extension): every reached header has a single winning key that names it
    alone; no key reaches the `dlist-header`, `duty-menu` or empty-`d` headers; 580 keys, 0 tied pairs that share an
    insight.
- **V19 (sub-decision 3; F9, AC-2, SRC-3).** The only (key, insight) pair where a matching key names a value the insight
  lacks is a bare `39998` on a header of kind `39999`.
- **V20 (finding 23; owner F1).** With § 13.2's menu, under the first wording K = `3038x` has no consistent reading;
  under revision 1 `3038x` is partly offered and `3039x` not offered as a whole. Over 4,000 random menus, cases without
  exactly one consistent reading: 2 under the first wording, 0 under revision 1.
- **V21 (sub-decision 8; AC-7).** K = `30392`, row `3039x:tag`: the meet `30392:tag` names the shared insights
  exactly; the first wording calls it keyless, revision 1 does not. Over 20,000 random menus the first wording calls
  11 correct meets keyless; revision 1 calls none, and still calls every incorrect meet keyless.
- **V22 (sub-decision 11; owner F6).** The shipped `conceptCurator`: Case A (`["39998:dlist-header", TA]`,
  `["39999", B]`, a 39999-declared header) → TA, "catch-all"; Case B (the editor's bare kinds) → the local Assistant.
  `classifyEntry` reads `39999:dlist-header` as a per-DList entry; `findDListEntries` drops it.
- **V23 (sub-decision 7; owner F8).** `30392:tag::` matches D1, D2 and Profiles; `30392:tag::T1` and
  `30382:tag:::conf` match Profiles only.

**Revision 2** (`rev2/r2_checks.py`; `rev2/code.mjs`):
- **V24 (sub-decision 5; N1).** With a header `39999:<A>:dlist-header` (an event that breaks the reservation), § 4.5
  alone has `39999:dlist-header` match it, and Map `[39999:dlist-header, X]`, `[39998, Y]` gives it X. §§ 4.5 and 4.6
  together match nothing and give it no provider. Assistant Designation's Reconstruction alone addresses
  `39999:<A>:dlist-header`. Shipped `classifyEntry` reads the key as a per-DList entry, and `treasureMapDuties` shows the
  duty "Curated DList: dlist-header".
- **V25 (sub-decision 5; N2).** TA discovery by the literal spelling, and by the Treasure Map key: the editor's Map
  `[39998, X]`, `[39999, X]` gives no TA (step 3) or X; `[39998, X]`, `[39998:dlist-header, TA]` gives TA or X. Maps
  with only `39998:dlist-header`, or with it first, agree. Shipped `classifyEntry` takes only `39998:dlist-header` as
  the designation, and `treasureMapDuties` shows no duty for a bare `39998` or `39999`.
- **V26 (Consequences; N3).** Story 4's AC6 scope bullet allows "any new row that names a difference from shipped
  code". Of this ADR's three new rows, only the code row does.

**Reading checklist** (each AC bullet, where to look, and what the Reviewer finds):

| AC bullet | Where | Finds |
|---|---|---|
| AC1 bare kinds | TM § 4.5, § 10.1, § 10.12 | "The bare kind `39999` means…"; § 10.1's `39999` row; "(The bare `39998` and `39999` are in § 10.1.)" |
| AC1 order | TM § 6 | "Of the two Concept kinds, `39999` beats `39998`"; "Apart from that case"; the third consequence |
| AC1 colon | TM § 4.5, § 4.7; DM § 5.3 | "is not a key"; `d-tag = 1*OCTET`; DM § 5.3's pointer at § 4.5 |
| AC1 other specs | AD :38, :64; TL :103–106 | AD: "for [Treasure Maps](./treasure-maps.md) § 4.5 to say", no "bare `39998`", "never empty", "`39999:dlist-header` and `39999:duty-menu` name no header", "§§ 4.5 and 4.6"; TL: "the bare kinds `39998` and `39999`, specified in [Treasure Maps]", "§§ 4.5 and 4.6 to say", "never empty" |
| AC1 Self-Maps | TM § 3, § 9.2 | no "until this NIP settles"; Ties opens "None arise"; no "A Concept kind and a colon" paragraph |
| AC1 duty-menu | TM § 4.6 | the `duty-menu` paragraph unchanged; the new `dlist-header` paragraph |
| AC2 | TM § 4.3, § 12; DM step 1 | the two bullets; "Addressable kinds", naming Content Categories and Spawning; "Category `39998` takes three List kinds"; § 12's "(§ 4.3)"; DM's `3039x:tag:10002` example |
| AC3 | TM § 4.4, § 10.5, § 13 q2–3 | "The Profiles category" and its three sub-bullets; "in each category of profiles"; "with a value after it" (q2, q3) |
| AC4 | DM § 5.3, § 6.2 steps 1, 2, 4, § 13.3, § 14 | the gate grep finds nothing; step 1's last bullet: "for `39999:duty-menu` and `39999:dlist-header`"; the § 13.3 `39999` row; questions 5–7 struck through with pointers |
| AC5 f12, f13 | DM step 5, step 2 | "changes nothing under K"; "Outside K, such a key may still take"; "the same one is the most specific" |
| AC5 f15, f17, f22 | DM § 8.1, § 5.3, § 5.4, § 4, § 5.1 | "SHOULD return only the latest version"; "Ignored rows (§ 5.1 and above) take no part"; "uses the first"; "the first counts"; "names an Assistant" |
| AC5 f23, f24 | DM § 2, steps 3–4, § 13.3, § 8.2, § 4 | "Offered — of an insight"; "where the menu gives K a relay (step 3)"; "Not offered as a whole" twice; "Nous' kind 10002 write relays"; "that the relays it asks hold" |
| AC5 own key, q3 | DM § 2, § 14 | no "its own key included"; "what do such a key's self-entries speak for" |
| AC6 | metadata, README, handoff, ledger, story 3, ADR 0003 | sub-decision 11, item by item, in the loose-ends order |

**Vocabulary.** No "canonical", "consensus" or "root" in any added line.

## Out of scope

- **Story 5.** The rest of ledger row `2026-10-12-self-maps-spec-fold-forwards` (items 5, 9, 10, 12, 13, 19, 20) and
  the § 5.4 Enumerate question.
- **Other spec text.**
  - Assistant Designation and Trusted Lists beyond sub-decision 5's sentences and sub-decision 11's Sources clauses.
    That includes Assistant Designation's dual-author precedence, whose subject stays kind-`39998` headers, and its
    step 2's TA discovery (the second new protocol row).
  - Spawning and Content Categories (Open question 3 and the first new protocol row), BIBLE, and the older
    `treasure-map.md` draft (row `2026-09-27-old-treasure-map-draft-overlaps`).
- **New grammar.** A key for one Tag in every category of a profile kind, and § 13 question 2's "any category" list.
- **The `canonical` uses** already in `treasure-maps.md`.
- **Duty Menus § 14 questions 1–3,** beyond question 3's added clause.
- **All code.** That includes the new code row's fixes, the cross-book row's items 2–4, and the readers that books
  `assistant-self-map` and the later code book build.
