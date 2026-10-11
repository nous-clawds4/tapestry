# ADR 0003: Self-Maps — a key's own Map reports what is live, and element 3 is a hint resolved per insight at read time

**Status:** Proposed
**Date:** 2026-10-11
**Story:** `engineering-team/stories/duty-menus-and-self-maps/3-self-maps.md`

## Context

**The story** (docs-mode, Approved 2026-10-11) asks for Self-Maps in `protocols/drafts/treasure-maps.md`, the narrowed
sentence in `assistant-designation.md`, and the parts of story 2's carry-forwards that pair with Self-Maps:
- AC1: a self-entry creates no duty, and reads as one with § 9's "Naming someone else's Assistant"; § 13 question 5
  skips one's own Map; a counting rule for outside clients;
- AC2: a new § 9.2 (terms, meaning, timing per insight family, content, no expiration), with the multi-relay question
  answered, and § 9.2 and `duty-menus.md` § 10 pointing at each other;
- AC3: confirmed duties and Alternates in § 7's terms, "maintained whatever the age", a spot-check SHOULD, "an entry is
  not a promise", and a self-Map read as a point of view;
- AC4: element 3 is a hint, with a read-time fallback in § 3 (self-Map, then Duty Menu, then kind 10002), per insight,
  whatever the cause; storefront rows; its order against § 7's next Alternate; four traceable cases; finding 20's levels;
  `duty-menus.md` stops saying that Treasure Maps lacks read-time resolution;
- AC5: when a client fills element 3, the self-entry comes first; how it composes with an insisted key; "insight under
  K" means in principle (finding 14); one answer when no menu is found;
- AC6: the address `duty-menu` (§ 4.6 under answer 1(a)); `duty-menus.md` § 6.1's completeness (finding 16);
- AC7: the TA's self-Map, the narrowed sentence, a person who is their own Assistant, and "the observer's own Assistant"
  (answer 4(a), finding 21);
- AC8: a tracking surface for handoff Q6 and the code plan, the handoff flip (answer 3(a)), the ledger notes, the
  record that ADR 0002's "story 3" for A1-8, A1-9 and A1-10 now means story 4 (answer 2(a)), one place per wire fact,
  vocabulary, gates, scope (only the three drafts inside `protocols/`).

**The owner's answers at approval (2026-10-11):** 1(a) § 4.6 names `duty-menu`, points at `duty-menus.md` § 4, and adds
only the Map-key rule; 2(a) the key-grammar questions and the rest of the wording are story 4, in this book; 3(a) the
handoff flips in this story, after Q6 and the code plan get an open surface; 4(a) "the observer's own Assistant" is a
key the observer itself runs; 5(a) the counting rule leaves out a person whose Map is only self-entries, and says so.

**Settled inputs.**
- Handoff (`docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md`): D1 (offered vs active), D3 (kind 10002 as a fallback
  locator), D6 (no expiration on self-Maps), § 5 (Self-Maps, proposed), § 6 step 1 (self-entry first), § 7 (the live
  defect, and "A stopgap can ship first").
- ADR 0002: sub-decision 2 (`duty-menu` reserved as the `d` of a kind-39999 menu) and its Consequences (`duty-menu` is
  not reserved as a general Concept `d`); A1-3 (differing rows and their parts); A1-4 (one entry per chosen key, the
  insisted key's relay, no guess); A1-11's lesson (a client's suggestion is not made normative where every reader reads
  the saved Map alike); A1-12 (a replaced version reaches the relays earlier versions named, and readers use the latest
  version); Consequences of A1 ("Step 1 (the self-entry) is story 3's and stays first").
- Story 2's review round 3 findings 14, 16, 20, 21, 26 and 27 (ledger row `2026-10-11-duty-menus-spec-fold-forwards`).

**What the specs say today.**
- `treasure-maps.md`: § 2 (:57) "Observer — the author of the Map. The insights it names are *for* the observer"; § 3
  (:77) "Element 3 is a relay where the insight can be found. It MAY be the empty string", and nothing for a reader when
  the insight is not there; § 7 (:280) falls back to the next Alternate "when it can't be found (missing from the relay,
  relay unreachable) or is older than they'll accept"; § 9 (:301, :305) every entry naming an Assistant is a duty, except
  one naming someone else's Assistant; § 4.6 (:168) a reserved word is never a Concept `d`; § 5.3 (:224) builds a filter
  for any Concept key; § 13 question 5 (:524) `p` tags; question 8 (:527) private entries.
- `duty-menus.md`: § 6.1 (:144–149) four conditions, "only when" (necessary only); § 6.2 step 1 (:182) "A key that
  matches no insight … has nothing to resolve" names only § 4.3 disagreement; step 5 (:194–223) carries obligations with
  no RFC level, says read-time resolution is undefined (:218), and keeps the no-guess rule (:222); § 7 (:233) "the
  observer's own Assistant", undefined; § 10 (:278) points at Treasure Maps § 9; § 14 question 4 (:361).
- `assistant-designation.md` § Authorship (:52): "A TA cannot designate itself." § Per-DList curation entries, Relay
  hint (:82): "A Tapestry instance writing the entry fills element 3 from `settings.aRelays.aDListRelays[0]`".
- `dlist-header-declaration.md` § 2: a kind-39999 event declares itself a header with `["z","list"]` or a `z` naming a
  `concept-header` header; § 4: readers union "the community handle, plus the handles of deployments they honor"; § 6:
  readers MAY treat known firmware concepts as headers during migration.

**External specs** (fetched 2026-10-11 through the proxy, `raw.githubusercontent.com/nostr-protocol/nips/master/`; the
copies in `s3/r1/nips/` match the earlier ones byte for byte):
- NIP-85: its kind 10040 example names element 3 `<relay hint>` (`85.md:115`); "Service providers SHOULD update Trusted
  Assertions … but only if the contents of each event actually change" (`:137`); "Users can share these settings
  publicly or keep them private by … encrypting the tag list within the `.content` field using NIP-44" (`:109`).
- NIP-01: kind 10040 is replaceable, 3039x lists are addressable; "In case of replaceable events with the same timestamp,
  the event with the lowest id … should be retained" (`01.md:101`); relays "SHOULD return just the latest one" (`:103`).
- NIP-65: "When downloading events **from** a user, clients SHOULD use the **write** relays of that user" (`65.md:27`).
- NIP-40: the `expiration` tag. NIP-09: deletion requests.

**Show and Tell** (`design-philosophies/show-and-tell.md`). Counting Maps counts what people do (S-5, the reuse hazard).
An Assistant's self-Map is a report published to be read, not a person's choice of providers; counting it as adoption
is a misreading of the kind the hazard's third question ("would they endorse our reading?") warns about. A person who
keeps their whole Map private has said even more plainly that their choices are not for others' counts.

**Concepts:** none changed. Self-Maps are kind 10040 events. The Duty Menu header
(`39998:15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270:duty-menu`) is unpublished. The stack is
absent this session (no Docker; `TAPESTRY_PORT` unset), so no handle was read from a live graph.

**Constraints.** No "canonical" or "consensus" in added or changed normative text; avoid "root". Specs cite specs and
NIPs, never stories or ADR passages (metadata Sources may name ADRs). No deployment details in specs. No new wire
surface unless argued. The four invariants. ADR 0002's accepted text is not edited (ledger row
`2026-10-11-implementer-edited-accepted-adr`).

**Revision 1 (2026-10-11)** re-derives sub-decisions 2–15 with new model runs in `s3/r1/` (Verification), corrects
several citations and model reports, and adds four questions the owner has not decided (Open questions for the owner).
Until the owner answers, this ADR is written under each question's recommended answer.

**Revision 2 (2026-10-11)** answers a third review round (findings C1–C10) with new model runs in `s3/r2/`:
- a self-entry is read over the supported sets of the observer its key serves, as § 9 reads a scope key, and the
  stale copies that leaves are stated; a List that stops for any reason other than a move is retracted (C1, C8);
- every self-entry names the relay A's own menu gives its key, so the fill takes A's self-entry keyed K as AC5 words
  it, with no condition (C3, C5);
- the remove rule reads "wins and speaks for", a self-entry that speaks for nothing is removed, and the brief gap covers
  only an insight that will land at the self-entry's relay (C2, C5);
- a client of the service that runs A fills element 3 from where that service publishes A's insights, which the
  no-guess rule no longer forbids (C4);
- the fallback runs for each provider in turn (C7); the point-of-view sentence, the `39998:` key in the fill, and the
  handoff's landing list say no more than holds (C6, C9, C10).

## Options considered

### Option A — Self-Maps and the read-time rules normative in Treasure Maps; per-insight meaning; Duty Menus points

Treasure Maps owns the self-entry rule (§ 9), Self-Maps (new § 9.2), element 3 as a hint with the fill order and the
read-time fallback (§ 3), and the `duty-menu` key rule (§ 4.6). A self-entry's claim is read per insight: the self-entry
that wins an insight among the key's self-entries says where it is, and that it is live. Duty Menus keeps its own rules
(resolution, the insisted key, no guess, the no-menu entry, what counts as a menu) and points at Treasure Maps for the
rest.

Pros:
- One home per fact, as the frame and AC8 ask: the fallback and Self-Maps in Treasure Maps, menu rules in Duty Menus.
- A reader of Treasure Maps alone, such as a NIP-85 client that never reads menus, still learns the self-Map and kind
  10002 steps.
- Every claim it states holds in the model, and each limit it cannot remove is stated (Verification).

Cons:
- Treasure Maps grows by one subsection and several paragraphs, and now cites Duty Menus.
- It departs from the handoff's § 5 in several places (Consequences), and from AC2's "copied verbatim" and AC3's "only
  that key's slice", which are the owner's to ratify (question 1).

### Option B — The handoff's § 5 as written

One self-entry per key of the customer's Map, copied verbatim; a fallback that a client MAY run "when element 3 is empty
or unreachable", taking the "most specific matching self-entry, then its Duty Menu"; a self-entry makes an insight
"maintained, whatever the insights' age".

Pros: no reinterpretation of the captured design.

Cons, each checked in the model:
- An insight in a differing row's part sits behind a relay that answers but does not hold it. "Empty or unreachable"
  never fires there (the epic's first carry-forward).
- Re-resolving the entry's key finds nothing new: 0 of 3,429 missed insights (`s3/m1_fallback.py`).
- Verbatim self-entries claim duties the key does not publish. In Duty Menus' own § 13.2, `3038x` with `not-offered 30385`
  would report every `30385` Score active. Across 6,000 model Maps they claim 18,106 unpublished duties and put 60 at
  the wrong relay (`s3/r1/m3r.py`, policy V).
- "Most specific matching self-entry" fills a new key from a broader self-entry that does not yet speak for it: wrong in
  18 of 6,000 targeted trials (`s3/m5_fill.py`).
- "Whatever the age", read for any copy, accepts a stale copy at a relay the key has left (`s3/m6_age.py`, S1).

### Option C — Read-time resolution and the fill order normative in Duty Menus; Treasure Maps points there

Duty Menus already owns resolution, so it would also own where a reader looks when an insight is not found, and the fill
order.

Pros: the resolution machinery sits in one spec.

Cons:
- Two of the fallback's three steps (the self-Map and kind 10002) have nothing to do with menus. A reader with no menu
  found would have to read a menu spec to learn them.
- AC4 places the fallback in Treasure Maps § 3, and AC8 makes "the Self-Map rules and the read-time fallback …
  normative in Treasure Maps".
- Treasure Maps defines element 3. Its meaning, and what a reader does without it, belong there.

## Decision

We chose **Option A**.

**Sub-decisions** (what the Implementer writes; quoted sentences are load-bearing, the rest is guidance for prose).
Where a sub-decision depends on an open owner question, it says so.

1. **Self-entries create no duty** (`treasure-maps.md` § 9; AC1).
   - A new bullet, before "Naming someone else's Assistant": "**Self-entries.** An entry whose element 2 is the Map's own
     author is a *self-entry*: that key's report of what it is publishing now (§ 9.2). It creates no duty and designates
     no one. An Assistant takes duties only from entries that name it in the Maps of the observers it serves, never from
     its own Map. A reader judges element 2 against the Map's author first: an entry that names the author is a
     self-entry, whatever else that key signs for, and the next bullet is for every other entry."
   - "Naming someone else's Assistant" begins: "An entry other than a self-entry may name a key that signs for someone
     else — …". The rest of that bullet is unchanged.
   - **Why the order is spelled out in both bullets.** Both rules create no duty, so the order changes no duty; it
     decides which meaning an entry carries. Read without it, both rules apply to an Assistant naming itself while it
     serves someone else (`s3/m7_enum.py`: 4 combinations without the order, 0 with it). Bullet placement alone does not
     say which applies, so each bullet says it.
   - § 1 principle 2's "Each entry naming it is a duty" gains "except as § 9 says". The sentence already conflicted
     with "Naming someone else's Assistant", and a self-entry is a second exception.
   - *Check (AC1):* O's Map drops A for K, and A's self-Map still lists K. By the bullet, A has no duty for K from O.
     A removes the self-entry before it stops (sub-decision 4).

2. **What a self-entry says** (new § 9.2; AC2, AC7).
   - **Terms.** "A *self-entry* is as § 9 defines it. A key's *self-Map* is its own kind 10040, read for its
     self-entries. Every Assistant SHOULD keep a self-Map, so that clients can tell which of its duties are live."
   - **Meaning, per insight.** "A self-entry `[K, A, R]` says that A is publishing at R, and keeping up to date, each
     insight it speaks for that this self-entry wins. The self-entry that wins an insight is found by § 6 among A's
     self-entries alone; A's other entries take no part, and where § 6 picks no single one of them, no self-entry wins
     it. An insight that no self-entry wins is not reported as active." It means published and maintained, not merely
     assigned (handoff § 5).
   - **What a self-entry speaks for** (C1; the second sentence under question 1's recommended answer (a)): "A
     self-entry is read as § 9 has an Assistant read an entry: one with a scope key speaks only for insights in the
     supported sets of the observer its key serves (§ 8), and one with an exact key for its one insight. Of those, an
     Assistant's self-entries speak only for its duties (§ 9): the insights that the Map of the observer it serves gives
     to it. They say nothing about the other insights under their keys: those the observer gave to another key, and
     those outside its supported sets. A key that serves only itself, such as a person who publishes their own insights
     with their own key, speaks for every insight its self-entries win, read over its own supported sets." Under answer
     (b) the second sentence goes, and so does "those the observer gave to another key".
   - **Why over the supported sets** (C1). In principle a scope key covers every Tag and every DList (§ 8). Read that
     way, a self-entry `30396:tag` would claim the lists of every Tag anyone has made, which no key publishes, so the
     MUST NOT in sub-decision 3 would forbid it, and with it `*` and every family, kind and system key that reaches a
     Tag, a DList, a metric or a Concept: only exact keys would remain. Even in the model's closed world (two Tags, two
     DLists, two metrics, two Concepts), the in-principle reading keeps 526 of 834 keys given wholly at one relay,
     against 790 over the supported sets, and claims 75.5% of published duties, against 96.5% (`s3/r2/m3s.py`). § 9
     already reads a scope key this way for the Assistant ("It expands scope keys over the observer's supported sets"),
     and the exact-key clause follows § 8 ("An exact key doesn't depend on supported sets"). Duty Menus § 6.2 reads
     covering in principle for the opposite reason: a menu row speaks to every observer and must not move with one
     observer's pins, while a self-entry reports one observer's live work, which follows that observer's supported sets.
     - Revision 1 left the reading unstated, and its model could not tell the two apart: every insight was supported
       (`s3sk/check2/c2_supported.out`).
     - What a scope self-entry then wins but does not speak for is sub-decision 5's limit.
   - **Why per insight, among self-entries alone.** A self-Map may hold ordinary entries (sub-decision 12). In the TA's
     Map, `["3038x", TA, R1]` with `["30382:rank", X, R2]`, § 6 over the whole Map gives ranks to X, so the TA's own ranks
     would read as unreported. Over the self-entries alone, `3038x` → R1 (`s3/m7_enum.py`).
   - **Why a key that serves only itself speaks for every insight it wins.** It has no customer's Map, so "its duties"
     would be empty: a self-entry creates no duty (sub-decision 1), and its self-entries would report nothing. Readers
     cannot tell such a key from an Assistant, and they read every self-Map the same way, per insight among
     self-entries. So the key's own self-entries must hold for every insight they win in its supported sets. A person
     whose Map is `["*", P, R]` and `["30382:rank", B, S]` therefore cannot keep `*` (it would claim ranks P gets from
     B); P writes narrower keys, and a reader that looks P's ranks up finds no self-entry of P winning them
     (`s3/r1/m7r.py`).
   - **Why a tie claims nothing.** Treasure Maps § 6 as written does not order a bare `39998` against a `39999` key, and
     a self-Map holds both when A publishes 39999-declared headers at another relay (the menu `39998` → Rc, `39999` → Rd,
     under the observer's `39998`). Under § 6 as written those headers tie, and no self-entry wins them: the self-Map
     says less, never something false. Under Duty Menus' provisional order (§ 6.2 step 1) `39999` → Rd wins them. Either
     way no claim is wrong, under any answer story 4 gives A1-8 that does not rank a bare `39998` above `39999`
     (`s3/r1/m7r.py`; `s3/r1/m3r.py`, named).
   - **Not taken:** *§ 6 over the whole Map* (the TA case above). The self-contained claim is not rejected here; it is
     question 1's answer (b).

3. **What a self-Map holds** (§ 9.2; AC2, D6).
   - **Its key.** "Where it can, an Assistant uses as a self-entry's key the key of the observer's entry that gives it
     the duties, copied verbatim: where that key, beside A's other self-entries, wins only duties A publishes at one
     relay. Otherwise it writes narrower keys (below). A key that serves only itself chooses its keys under the same
     rule." The verbatim key is the default, not universal; question 1 asks the owner to ratify that.
   - **Its relay** (C3). "Element 3 is the relay where A publishes the insights the self-entry wins that it speaks
     for. It is never the empty string. Where A publishes a Duty Menu that is not a storefront
     ([Duty Menus](./duty-menus.md) § 7), it is also the relay A's menu gives the self-entry's key (Duty Menus § 6.2
     step 5), save while A moves those insights to that relay (below). A key to which A's menu gives another relay, or
     none, is not one of its self-entries' keys."
     - Why: A's self-entry keyed K and A's menu then agree on K, so the fill can take the self-entry first, as AC5
       words it, with no condition (sub-decision 8). Without the rule, a self-entry can be true and still differ from
       the menu: with the menu `*` → R0, `3038x` → R1 and an observer who gave A's Lists and Concepts to B, A's duties
       under `*` are Scores at R1, and `*` → R1 is true (`s3sk/resolution/k3_exact_fill.out`). Under the rule A writes
       `3038x` → R1 instead.
     - It costs little, because the construction below meets it already: the meet of the observer's key with every row
       that matches a duty gets from step 5 the relay where A publishes that duty (3,818 of 3,818 such meets,
       `s3/r2/chk_meet.py`). Over 6,000 Maps it lowers the published duties claimed from 96.6% to 96.5%, and keeps
       every key given wholly at one relay that would be kept without it (`s3/r2/m3s.py`).
     - A storefront's rows say where per-customer keys publish, not the storefront key (Duty Menus § 7), so a
       storefront's self-entries are bound by the MUST NOT alone.
   - **More than one relay.** "Where A publishes some of the duties under one key at another relay (a differing row's
     part, [Duty Menus](./duty-menus.md) § 6.2 step 4), A adds narrower self-entries naming that relay, so that each
     self-entry wins only duties A publishes at its relay. The meet of the observer's key with the row that sends them
     there (Duty Menus § 6.2 step 4) is such a key only when no other row within the key sends part of the meet
     elsewhere, and when the meets order as their rows do; Duty Menus § 6.2 step 5 shows meets that order the other
     way. A writes as many narrower self-entries as that takes, such as the meet of the key with a row nested in the
     part, or the meet of two meets, and checks the whole against the rule below."
     - *Nested row* (Duty Menus § 6.2 step 4's menu): `3039x` → R0, `3039x:tag` → R1, `30396:tag` → R0, observer's
       `3039x`. The verbatim `3039x` → R0 with the differing row's meet `3039x:tag` → R1 claims the Tag-based `30396`
       lists at R1, where A does not publish them (4 wrong claims). Adding the nested row's meet, `30396:tag` → R0,
       fixes it.
     - *Meets ordering the other way* (step 5's menu): `3039x` → R0, `30396:tag::⟨T⟩` → R1, `3039x:tag:⟨D⟩` → R2,
       observer's `30396`. The meets `30396:tag::⟨T⟩` → R1 and `30396:tag:⟨D⟩` → R2 give `30396:tag:⟨D⟩:⟨T⟩` R2, but A
       publishes it at R1. Adding the meet of the two meets, `30396:tag:⟨D⟩:⟨T⟩` → R1, fixes it.
     - *One construction that always works* (guidance, not spec text; `s3/r1/sm2.py`, `s3/r2/sm3.py`): the verbatim key
       with the relay Duty Menus § 6.2 step 5 gives it; then, for each duty, the meet of the observer's key with every
       menu row that matches the duty, which wins the duty among all such meets because it names every value any of
       them names, with the relay where A publishes the duty (the relay step 5 gives that meet); then drop any
       self-entry that breaks the rule below; then add narrower keys that break nothing, each with the relay step 5
       gives it; then drop any self-entry that speaks for none of the insights it wins (sub-decision 4). Where that meet
       has no key (Duty Menus § 6.2 step 4: A1-10's profile case, the Concept meets), the duty stays unclaimed unless a
       narrower key covers it.
   - **A part A does not publish.** "A key MUST NOT write a self-entry, or keep one past a brief gap (below), that wins
     an insight it speaks for but does not publish at that self-entry's relay. Where the observer's key would do so,
     because A does not publish part of it (a `not-offered` row within it) or publishes part of it at a relay that no
     narrower self-entry separates, A writes narrower keys in its place and leaves out what it cannot claim truly. A
     self-Map says less rather than more."
     - Example: § 13.2's menu `3038x` → R, `not-offered 30385`, with the observer's `["3038x", A, R]`. A writes
       `30382`, `30383`, `30384`, `30386` and `30387` → R, not `3038x`. If the observer later gives `30385` to another
       Assistant, `30385` is no longer A's duty, and A may write `3038x` again.
     - A also removes a self-entry that speaks for none of the insights it wins (a MUST, sub-decision 4): it would say
       nothing to A's observer, and something false to anyone who reads the self-Map alone (sub-decision 5's limit).
   - **Which of handoff § 5's phrases gives way, and AC2.** "Where the insights actually are" holds for every insight.
     "One entry per key" gives way: it now means that no key appears twice, and a self-Map may hold more self-entries
     than the observer's Map gives A keys. AC2's "its key is the customer's winning key, copied verbatim" gives way too,
     wherever that key would claim a duty A does not publish at its relay, or A's menu gives that key another relay (the
     relay rule above). AC2 offered only the first two phrases as the ones that may give way, so this is a departure
     from the approved story, not only from the handoff: question 1.
   - **The model, every insight supported** (revision 1: `s3/r1/m3r.py`, 6,000 Maps with an Assistant B beside A;
     `s3/r1/m3r.out`):

     | Way of writing the self-Map | Wrong relay | Claimed but not published | Published duties claimed right | Keys given wholly at one relay kept verbatim | Non-duties won |
     |---|---|---|---|---|---|
     | V: verbatim, one per key | 60 | 18,106 | 78.7% | 735 of 736 | 854 |
     | VN: V plus the meets of differing rows (revision 0's guidance) | 2 | 18,120 | 99.8% | 735 of 736 | 899 |
     | VMC: V plus the meet closure above | 0 | 18,120 | 99.9% | 735 of 736 | 895 |
     | RULE: VMC, dropping what breaks the MUST NOT (per duty) | 0 | 0 | 95.0% | 732 of 736 | 171 |
     | RULE+: RULE, adding narrower keys that break nothing (per duty) | 0 | 0 | 97.5% | 732 of 736 | 198 |
     | RULE (self-contained, question 1 (b)) | 0 | 0 | 87.4% | 708 of 736 | 0 |
     | RULE+ (self-contained) | 0 | 0 | 92.7% | 708 of 736 | 0 |

     - VN's two wrong relays are the two shapes above (a nested row; meets ordering the other way), not parts with no
       key: in both, every meet is a key and the exact intersection (`s3sk/resolution/k2_vn_wrong.out`).
     - Most of V's unpublished claims are insisted keys and `not-offered` parts.
     - "Non-duties won" are insights a self-entry wins that the observer gave to another key: the exposure sub-decision
       5's limit states, and what answer (b) removes.
     - RULE+ is a greedy single pass, so its coverage is a lower bound. It writes § 13.2's per-kind self-Map (named
       case).
     - No two self-entries tie under Duty Menus' provisional Concept order; under § 6 as written, the RULE policies
       leave no tie either (VMC's one tie is between a `39998` and a `39999` key, and claims nothing).
   - **The model, with supported sets** (revision 2: `s3/r2/m3s.py`, 6,000 Maps with B beside A, each with supported
     sets that leave out each of T2, D2, `conf` and c2 with probability 0.35; sub-decision 2's reading, the relay rule
     above, RULE+, and a self-entry that speaks for nothing removed; `s3/r2/m3s.out`). No self-Map breaks the MUST NOT
     or the relay rule.

     | Reading | Published duties claimed right | Keys given wholly at one relay kept verbatim | Won, given to another key | Won, outside the supported sets |
     |---|---|---|---|---|
     | Over the supported sets, answer (a) | 96.5% | 790 of 834 | 108 | 1,521 |
     | Over the supported sets, answer (b) | 93.1% | 775 of 834 | 0 | 1,468 |
     | In principle, answer (a) (not taken) | 75.5% | 526 of 834 | 91 | — |

     - The last two columns are insights a self-entry wins but does not speak for, which a reader that lacks the
       observer's Map or its supported sets cannot tell apart (sub-decision 5's limit). Only those A published before
       they left what it speaks for have a copy to be found.
     - Revision 1's RULE+ won 198 non-duties with every insight supported; 22 of them came from 72 self-entries that
       spoke for no duty, which A now removes (`s3/r2/chk_prune.py`). The two runs draw different Maps, so their counts
       are not paired.
   - **No order, no copies.** A self-entry never copies the observer's Preferred and Alternate order or its other
     providers. "An entry in A's Map that names another key is A's own request, read by § 9 like any entry. Copying the
     observer's entries would give those keys duties for A." A self-Map may also carry such ordinary entries
     (sub-decision 12).
   - **Private duties** (§ 13 question 8) never go in a self-Map's public tags. Whether they may go in `.content` stays
     with that question.
   - **No expiration** (D6): "A kind 10040 that carries a self-entry carries no `expiration` tag (NIP-40). A self-entry
     lasts until its key removes it." D6 is about self-Maps; a Map with no self-entry is untouched by this rule, and this
     story neither allows nor forbids NIP-40 there.
   - **Concept kind and a colon.** "A self-entry's key is never a Concept kind followed by a colon and nothing else
     (`39998:`, `39999:`); readers ignore such a self-entry." What such a key means is story 4's (A1-8); this keeps
     self-Maps out of the question under any answer. A self-entry writes the bare kind or a full Concept key.

4. **When a self-Map changes, and where to find it** (§ 9.2; AC2).
   - **Timing, with levels:**
     - "A key MUST NOT add a self-entry before the first full set of the insights it wins, of those it speaks for, has
       landed at its relay."
     - "It MAY keep a self-entry through a brief gap: a failed run, a relay that is down for a while, or an insight new
       under its key that it will publish at the self-entry's relay and that has not landed there yet. A self-entry says
       that the key is keeping the insights up to date, not that every update has landed. An insight new under its key
       that it will publish at another relay, or not at all, is no gap: as soon as the key learns of it, it narrows or
       removes the self-entry so that it does not win that insight, and adds a self-entry for it once its first full set
       has landed."
     - "It MUST remove or narrow a self-entry before it stops keeping up to date any insight that the self-entry wins
       and speaks for, whatever the reason: the service ended, the key was retired, or it can no longer publish it. A
       brief gap never covers a stop. A self-entry that speaks for none of the insights it wins, as when the observer
       drops the key, MUST be removed before the key stops keeping up to date the insights it last spoke for."
     - "A move to another relay ends the self-entry at the old relay, not the insights: the key first publishes a
       version whose self-entries name the new relay, and only then stops updating the copies at the old one. It does
       not retract what it moved; the copy left at the old relay is an older version."
     - "A key changes its self-Map by publishing a new version. Each version's `created_at` MUST be later than the
       version it replaces: NIP-01 keeps the version with the lowest id when two share a `created_at`, so an equal one
       can leave a removed self-entry in place. No NIP-09 deletion is needed."
   - **Why the gap is narrower** (C5). Revision 1's gap covered any "insight new under its key that has not landed
     yet". With the menu `*` → R0, `3038x` → R1, a self-entry `*` → R0 for an observer who had given its Scores to B,
     and the Scores then given back to A, it let A keep `*` → R0 while 94 new duties read as confirmed at R0, where A
     never publishes them (`s3/r2/m6s.py`, Part E). Narrowing first (`3039x`, `39998` and `39999` → R0) leaves none;
     once the Scores land, A may write `*` → R0 with `3038x` → R1. Until A reads the change at all, its self-Map can
     still win a new duty: sub-decision 5 states it, and the spot-check guards a switch.
   - **Why "wins and speaks for"** (C2). Revision 1's "before it stops keeping up to date the insights it wins" had two
     readings. Read for each insight, it forbade what answer (a) allows: keeping `*` → R0 after the observer gave
     `30382:rank` to B and A stopped ranks. Read for all of them together, it let a self-entry outlive part of what it
     speaks for. The new sentence is per insight, over what the self-entry speaks for. Under answer (a) that alone never
     fires when the observer drops the key, since the key then speaks for nothing; the second sentence covers it
     (`s3/r2/m6s.py`, Part D).
   - **Why a move ends the self-entry first.** Revision 0 let a self-Map lag a move "through a brief gap". A reader in
     the gap read the old self-Map and accepted the copy left at the old relay as maintained, however stale
     (`s3/r1/m6r.py`, Part 2). With the new order, a copy at the relay the self-Map names is always one the key still
     updates.
     - Revision 1 called a move "a stop at the old one", which, with the List rule below, invited A to retract a List
       it had moved. A retraction is a newer version at the same address, so it would replace the moved List for any
       reader that takes the latest version across relays, until A next republishes it, which NIP-85 asks only when
       its content changes (`s3/r2/m6s.py`, Part C; C8).
   - **What follows a stop, per family** (principle 4):
     - **Lists.** "A SHOULD retract each List it stops maintaining, whatever the reason: its self-entry was removed, or
       the List left the insights the self-entry speaks for (the observer gave it to another key, or dropped it from its
       supported sets). It retracts it by the retraction convention: an empty replacement carrying
       `["status", "retracted"]` ([Trusted Lists](./trusted-lists.md)), with a `created_at` later than the list's last
       version (NIP-01). A List it moved to another relay and still maintains there is not one it stops maintaining."
       - Why "whatever the reason" (C1): a List that left what a self-entry speaks for can still be won by it, and its
         stale copy would count as maintained (sub-decision 5's limit). A retraction is A's current word, so a reader
         that finds it at the self-entry's relay reads the List as withdrawn, not stale content (`s3/r2/m6s.py`, Part
         A).
       - § 9's Revocation ("Insights already published stay on relays") gains a pointer to this sentence, so the two do
         not read as contradicting each other.
     - **Scores** have no retraction convention. The removed self-entry is their "stopped" signal, and published values
       stay on relays (§ 9, Revocation). A Score that left what a self-entry speaks for has no signal (sub-decision 5).
     - **Concepts.** "The curated header and its `b` stay ([Assistant Designation](./assistant-designation.md),
       Revocation); the removed self-entry says that curation has stopped." A does not delete the header, which other
       headers may point at. This spec says nothing new about curation copies; their removal follows Assistant
       Designation § Curation copies.
   - **Finding a self-Map** (ADR 0002 A1-12's rules, for self-Maps):
     - "A self-Map is A's kind 10040: `{"kinds":[10040], "authors":["<A>"]}`."
     - Publishers: "A SHOULD send each version, including one that removes a self-entry, to its kind 10002 write
       relays, to the relays its self-entries name, and to every relay that a self-entry of an earlier version named. It
       may drop a relay it knows is gone."
     - Readers: "A reader SHOULD ask A's kind 10002 write relays (NIP-65), every relay hint it holds for A (element 3 of
       the entries naming A), and the relay that each self-entry it reads names. It uses the latest version among the
       answers: the latest `created_at`, and on a tie the lowest id (NIP-01). The order says where to look first, not
       where to stop. A relay that does not answer within the reader's own timeout is skipped. A reader may ask fewer
       relays, and may then get an older version."
     - **Why A1-12's rules.** A removal names no relay for the self-entry it removes, so revision 0's "the relays its
       self-entries name" never sent it there. A reader holding that relay as a hint, for a key with no kind 10002 or
       none that answers, kept the old version and counted the key's last copies there as maintained. With A1-12's
       publisher rule the removal reaches every relay an earlier self-entry named, and the reader uses B: `s3/r1/m6r.py`
       Part 1 (a removal; two moves then a removal; a hint at a middle relay; each with and without kind 10002). The
       reader's third place, the relays the self-entries it reads name, catches a stale version picked up at a hint that
       missed an update (Part 1b: without it, A's stale rank counts as maintained; with it, the reader uses B), the way
       A1-12's places 2 and 3 do for menus.
     - **The residual.** A self-Map has no third place like Nous' relays. If the send of a removal to a named relay
       fails and the key has no kind 10002 that answers, a reader there still reads the old version (Part 1, last
       lines). Sub-decision 5 states it.
   - **Not taken:**
     - *A NIP-09 deletion of the old version.* An `a` deletion of a kind 10040 removes every version up to its
       `created_at`, the new one too if it is not later. Replacement alone is enough.
     - *Granting the age allowance only to a version read at A's kind 10002 write relays.* It narrows AC3's approved
       rule, a key with no kind 10002 would never get the allowance, and a write relay that missed an update still holds
       an old version.

5. **Reading a self-Map** (§ 9.2, § 7; AC3).
   - **Confirmed duty.** "A duty of A is confirmed when A's self-Map has a self-entry that wins it and speaks for it:
     the same key as the observer's entry, or another key that wins it among A's self-entries (§ 6)." That is handoff
     § 5's "matching" ("the same key, or one that wins for it under § 6"), read per insight. An entry is confirmed for
     the insights a self-entry wins and speaks for, and for no others. "And speaks for it" (C1) keeps a scope self-entry
     from confirming an insight outside the observer's supported sets, about which it says nothing; the observer's
     client, which switches its own providers, holds those sets.
   - **A confirmed Alternate** (§ 7, third bullet): "An Alternate whose duty is confirmed (§ 9.2) is a standby that is
     ready now." No new "Backup" term.
   - **Maintained, at its relay.**
     - "An insight found at the relay of the self-entry that wins it counts as maintained, whatever its age. NIP-85 asks
       providers to republish only when an insight's content changes, so a current insight can be old."
     - A copy found at another relay gets no such allowance, and § 3 looks further for a newer one (sub-decision 6).
     - This refines § 7's "older than they'll accept".
     - The model (`s3/m6_age.py`): when A has moved ranks from R to R1 and a stale copy remains at R (S1), the rule
       reads A's current copy at R1. Read for any copy, it accepts the stale one at R, and a reader that falls back only
       on "not found" drops to B. A stable old score at the self-entry's relay is accepted under every reading (S3).
   - **Spot-check.**
     - "Before relying on a self-entry to switch an insight to its key, as when making an Alternate Preferred, a client
       SHOULD fetch a few of the insights the self-entry wins, at its relay: the self-entry is the key's claim, and the
       events are the proof."
     - A SHOULD fits here, against A1-11's lesson, because this verifies a third party's claim before acting on it. It
       is the same kind of check as `duty-menus.md` § 12's NIP-05 SHOULD. It prescribes nothing about what the observer
       chooses.
   - **As a point of view** (C6). "Read as a point of view, like any Map, a self-Map's self-entries show the view of
     the observer its key serves (§ 9, One key per observer): the slice the key publishes, for the insights they speak
     for. They can also win insights the key no longer keeps up to date (below), so the view can carry stale copies.
     Entries in it that name other keys are its author's own requests (§ 9). A self-Map that has both, such as an
     instance's Tapestry Assistant's, read as a point of view mixes two observers' views." Readers that know nothing of
     self-Maps read it that way already. Which observer the TA's own insights speak for stays out of scope.
     - § 2's Observer line gains: "…are *for* the observer; those a self-entry names are for the observer its key serves
       (§ 9.2)."
   - **What the allowance rests on** (normative text, C1, C5): "The allowance rests on the key's own word. It holds
     while the key removes or narrows a self-entry before it stops, and while readers see the change. It does not hold
     in four cases:
     - a key that stops without removing its self-entries (it crashed, lost its key, or was abandoned) keeps its last
       insights counted as maintained, since a self-Map does not expire; so does a removal a reader never sees, such as
       one that missed the relay a reader holds for a key whose kind 10002 does not answer;
     - until the key has read a change to the observer's Map, its self-entries can win a new duty it has not started;
     - a self-entry with a scope key also wins insights outside the observer's supported sets, about which it says
       nothing. Copies the key published before the observer dropped them from its supported sets are no longer kept up
       to date: the key should retract the Lists (above), but Scores and Concepts stay as they were. A reader that does
       not hold the observer's supported sets, a reader of the observer's own Map included, cannot tell, and may take
       such a copy as maintained; a reader that holds them can tell;
     - a self-entry can also win an insight that the observer its key serves gave to another key (above). A reader of a
       Map that names the key as someone else's Assistant, or of the self-Map as a point of view, cannot tell, and may
       take a stale copy of such an insight as maintained, unless it is a List the key retracted.

     An observer's remedy is its own Map: drop the key, reorder its providers, or give the insight to another key."
     - The fourth case holds under question 1's answer (a). Under (b) it goes: a self-entry then speaks for every
       insight it wins in the supported sets, and A narrows before it stops any of them. The third case holds under
       both answers.
     - The model (`s3/r2/m6s.py`, Part B). Over 1,500 shrinks of the supported sets, a self-entry still wins, at the
       copy's relay, 64 stale Lists, 192 stale Scores and 1 stale Concept for a reader of the observer's own Map, under
       either answer; the retraction SHOULD turns the Lists into retractions. Over 1,295 carve-outs, under (a), 23 Lists
       and 134 Scores for other readers; under (b), none. Part A traces one: the observer unpins Tag T2, keeps
       `30396:tag` for A, and its own reader asks for a T2 list.
     - `s3/r1/m6r.py`, Part 4: the carve-out (`*` → R0 kept after `30382:rank` went to B) read as a point of view or
       through O2's Map takes A's stale rank as maintained; an Assistant that stopped without removing its self-entry
       keeps a stale rank in use ahead of a fresh Alternate.
     - The third case is the cost of reading self-entries over the supported sets, the only reading under which a
       scope self-entry can exist (sub-decision 2). For Scores, the age check it bypasses was never a staleness signal:
       NIP-85 asks providers to republish only when content changes, so a current Score can be as old as a stale one.
     - **Not taken:** *narrowing a self-entry whenever a Score or Concept it wins leaves the supported sets.* Each
       unpinned metric would turn a `3038x` self-entry into per-kind, per-metric keys, the cost answer (a) declines for
       carve-outs. *Asking readers to check the supported sets before granting the allowance:* § 8 says that "Clients
       don't need supported sets", and a reader that holds them can tell already.
     - The guarantee is stated no stronger than it holds. The spot-check SHOULD still guards a switch; nothing guards a
       routine read beyond the observer's own choices.

6. **Element 3 is a hint, with a read-time fallback** (`treasure-maps.md` § 3; AC4).
   - "Element 3 is a relay where the insight can be found: a hint, written when the entry was written (NIP-85 calls it a
     relay hint). It MAY be the empty string, which says that no relay is known; the entry keeps three elements."
   - "A Map entry names who is asked to publish an insight. It does not promise that the insight exists."
   - **When the insight is not there** (C7 for "a provider's entry"). "A reader that finds no copy of an insight that
     it accepts (§ 7) at the relay a provider's entry gives, for an entry with the insight's winning key (the empty
     string, a relay that does not answer, one that answers without it, or a copy older than the reader accepts that
     does not count as maintained, § 9.2), SHOULD look for it from that provider, A, at these relays, in order,
     skipping any it has already asked:
     1. the relay of the self-entry in A's self-Map that wins the insight (§ 9.2);
     2. the relay of the `duty` row of A's Duty Menu that answers the insight's exact key ([Duty Menus](./duty-menus.md)
        § 6.2), where A's menu is found (Duty Menus § 8.1) and is not a storefront (Duty Menus § 7);
     3. the write relays of A's kind 10002 relay list (NIP-65).

     A copy the reader does not accept does not end the search. If none of these relays gives a copy it accepts, A's
     insight is not found (§ 7)."
   - **Per insight.** "The reader resolves the insight by its exact key, not the entry's key: under a scope key, A may
     publish part of the insights at another relay (Duty Menus § 6.2 step 4)." In the model, resolving the exact key gives
     the row that wins the insight every time. For the 3,429 insights missed at the entry's relay, resolving the
     insight finds all of them, and re-resolving the entry's key finds none (`s3/m1_fallback.py`; the same zeros under
     A1-9 reading A).
   - **Read-time only.** "It takes A's current self-Map and menu each time it reads, and writes nothing into the Map."
     So it does not contradict `duty-menus.md` § 6.2 step 5's rule against writing a guess (sub-decision 9).
   - **A copy it does not accept is a trigger, and does not end the search.** Under sub-decision 5 a copy at a relay that
     A's self-entry does not name gets no age allowance. Without this trigger, a reader would drop A for B while A's
     current copy sits at R1 (`s3/m6_age.py`, relay-nf). And a reader that stopped at a too-old copy at step 2 would drop
     A while A's current copy sits at step 3 (`s3/r1/m6r.py`, Part 3). The rest of § 7's age judgement is the reader's
     own.
   - **Storefront rows** do not count in step 2, for any reader. A storefront's rows say where its provider's
     per-customer keys publish, not the storefront key (Duty Menus § 7). § 7's one exception, the observer's own
     Assistant, depends on what the observer knows about its own keys, which other readers cannot know. At read time
     every reader of one Map should look in the same places, so the exception is not carried over. The observer's own
     Assistant still has steps 1 and 3. If Duty Menus § 14 question 3 lets a storefront row speak for the key itself,
     step 2 can follow it then.
     - *Not taken:* counting them only for the observer's own Assistant (revision 0): the same Map would resolve
       differently for the observer's client and for everyone else. Counting them for every reader: it reads rows as
       claims about a key they do not describe.
   - **Enumerating** (§ 5.4): a client MAY also enumerate at the relays this fallback gives for the insights under the
     key, those of A's self-entries and menu rows that win any of them.
   - § 5's lead gains: "When R is empty, or does not hold the insight, § 3 says where to look next." Principle 1's
     "which relay" gains the same pointer.
   - **The four carried cases** (AC4), each traced in `s3/m1_fallback.py`:
     1. A differing row's part at another relay, even with a self-entry for K. With menu `3039x` → R0, `3039x:tag` → R1
        and the entry `[3039x, A, R0]`, the insight `30392:tag::⟨T⟩` is asked at R0, then R1.
        - With a self-Map that has only `3039x` → R0, R0 is skipped as asked and step 2 gives R1. If R0 still holds a
          copy, it is a current one: a self-Map that follows § 9.2 names R1 before A stops updating R0 (sub-decision 4),
          so a self-Map that still says R0 means A still updates R0. A self-Map that lags a move breaks § 9.2, and a
          reader of it can stop at a stale copy at R0 (`s3sk/resolution/k4_case1_stale.out`).
        - With the narrower self-entry, step 1 gives R1.
        - Re-resolving K would ask R0 and then A's write relays, never R1, when A's self-Map has only `3039x` or none.
     2. An insisted key with the empty string. With menu `not-offered 3039x`, `30396:tag` → R1, `30393:tag` → R2 and
        `[3039x, A, ""]`: a Tag-based `30396` list is asked at R1, a Tag-based `30393` list at R2, and a `30392` list
        (not offered) at A's write relays only.
     3. No menu found: A's self-entry relay, if any, then A's write relays.
     4. The last resort: A's kind 10002 write relays (D3's fallback locator).
   - **Not taken:**
     - *MAY*, as the handoff wrote. Readers that skip it lose insights a reader could find from A's own word.
     - *MUST.* Up to three lookups per Assistant plus the relays they name (Duty Menus § 8.1's 5 to 9 for the menu alone)
       is a cost some readers will not pay. SHOULD says what a careful reader does.
     - *A's relays from the menu only when no self-Map answers* (stop at the first step that gives a relay). Case 1 fails
       when the self-entry is broader than the part.
     - *The relay where A's menu was found.* It is where the menu is, not the insights.

7. **The fallback's order against the next Alternate** (§ 7; AC4).
   - § 7's sentence becomes: "Clients use the Preferred provider's insight. They fall back to the next Alternate when
     they find no copy of it that they accept: none at the relay its entry gives, nor, for a reader that follows § 3, at
     the relays § 3 looks at next. A reader that follows § 3 runs it for each provider in turn before moving to the
     next. A copy is accepted when it is no older than the reader will accept, or when it counts as maintained (§ 9.2).
     A reader that does not follow § 3 moves on after the entry's relay. They MAY show or compare Alternates."
   - Add: "A client may ask several providers' relays at once. It uses the insight of the first provider, in order,
     whose copy it accepts." Queries may run in parallel, but the order of use is fixed.
   - Why: "Clients use the Preferred provider's insight" (§ 7). An insight A publishes at another relay is still A's.
     For a reader that follows § 3, the Preferred provider's whole fallback runs before the next Alternate. In the model
     the Preferred provider is used for every insight it publishes (13,809 of 13,809). Asking B's entry relay before A's
     fallback uses B for 209 of them (`s3/m2_order.py`).
   - Why each provider in turn (C7): § 6's winning key can carry several providers, and revision 1 said only that the
     Preferred provider's fallback runs before the next Alternate. With Preferred A and Alternates B and C, where A does
     not publish an insight and B does, running § 3 for each provider uses B for 8,480 of 8,480; running it for the
     Preferred alone and then trying each Alternate's entry relay misses B for 721 of them, 33 of which go to C
     (`s3/r2/m2s.py`; named: B publishes the part a differing row of its menu sends to S1).
   - § 3's fallback is SHOULD, so § 7 now says what a reader that skips it does: one reading, not two.
   - **Not taken:** *the Alternate's entry relay first, then A's fallback.* It is faster, but it overrides the
     observer's order whenever A's insight sits behind a relay that answers without it, the very case AC4 opens with.

8. **Filling element 3** (§ 3, with `duty-menus.md` § 6.2 step 5; AC5).
   - § 3 gains: "**Filling element 3.** When a client writes an entry `[K, A, …]` and fills element 3 from what A
     publishes, it SHOULD take the relay of A's self-entry whose key is K, where A's self-Map has one (§ 9.2). Keys are
     compared as §§ 4.1, 4.4 and 4.5 read them, so `39998:dlist-header` is `39998`; a K that is a Concept kind and a
     colon alone (`39998:`, `39999:`) takes no relay from a self-entry until this NIP settles what such a key means.
     Otherwise it fills element 3 from A's Duty Menu as Duty Menus § 6.2 step 5 says, which also says what to write for
     a key the menu does not offer and for an Assistant with no menu found. A client of the Assistant service that runs
     A (§ 9), such as an instance writing an entry for its own Tapestry Assistant, MAY instead take the relay where that
     service publishes A's insights under K: that is A's own word, as its self-Map or menu would give it. The observer
     may write any relay by hand."
   - **Why the self-entry whose key is K, with no condition** (C3, C5). AC5 asks that "A's own self-entry for K, if
     any, gives the relay ahead of the Duty Menu's answering row". Under sub-decision 3's relay rule that self-entry
     names the relay A's menu gives K, so the two agree while the client holds A's current menu: 0 of 12,029 fills
     differ when A's self-Map was built for an earlier Map, however many saves ago, and 0 of 4,000 on a re-fill; in
     4,000 carve-and-return trials neither is wrong (`s3/r2/m5s.py`). That holds by construction, not only in the
     trials, while A follows the rule; during a move the self-entry names the old relay, which A still updates. The
     self-entry still comes first because it answers when no menu is found or the client holds an older menu version.
     - A broader self-entry's relay is a guess for a key A did not hold. With menu `*` → R0, `30382:rank` → R1, the Map
       `["*", A]`, `["30382:rank", B]` and A's self-Map `*` → R0, giving `30382:rank` to A: the covering rule writes R0;
       the rule above finds no self-entry keyed `30382:rank`, falls to the menu and writes R1 (`s3/m5_fill.py`, named;
       `s3/r2/m5s.py`, named). The covering rule is wrong in 18 of 6,000 targeted trials.
     - **Not taken:** *revision 1's condition* ("where … the Map already gives A every insight that the entry gives it
       under K"). It departed from AC5's words without saying so (C3). And it checked the Map, not the self-Map: a
       self-entry `*` → R1 kept through a brief gap passed it on a later save and wrote R1 for Lists A publishes at R0
       (`s3sk/check2/c1_lag.out`; C5). The relay rule removes both: `*` → R1 is no longer a self-entry there, and a
       self-entry's relay no longer depends on A's duties.
     - **Not taken:** *keeping the condition and recording it as a departure from AC5* (C3's first fix). It keeps a
       rule that checks the wrong thing; the relay rule costs 0.1 point of claimed duties (sub-decision 3).
   - **Key comparison.** §§ 4.1 and 4.4 alone would leave `39998:dlist-header` unequal to `39998`, so a TA self-entry
     keyed one would not match an editor's K keyed the other. § 4.5 makes them one key. A K keyed `39998:` or `39999:`
     is the bare kind under § 4.4 and a Concept key with an empty `d` under § 4.5; which reading holds is story 4's
     (A1-8). Revision 1 said such a K "matches no self-entry", which settled it by the back door (C9). The provisional
     sentence keeps the fill out of the question, as Duty Menus § 5.3 does for menu rows; story 4 replaces it.
   - **The service that runs A** (C4). Revision 1's no-menu MUST and its no-guess rule ("by any other means") forbade
     every fill not taken from A's self-Map or menu. Nothing publishes menus or self-Maps today, so a client following
     Duty Menus would blank the relay of its own instance's Assistant, against Assistant Designation's Relay hint ("A
     Tapestry instance writing the entry fills element 3 from `settings.aRelays.aDListRelays[0]`") and against
     `/treasure-map`, which fills this instance's own Assistant from Relay Settings (handoff § 1). The live defect
     (ledger row `2026-10-10-external-assistant-relay-left-empty`) would then reach every user, not only those of
     external Assistants.
     - A service's own record of where it publishes a key's insights is that key's own word, the one its self-Map and
       menu would carry. It is none of the guesses the no-guess rule names. Duty Menus' own lead already frames menus as
       what an instance reads for "an Assistant it doesn't run".
     - The Relay hint is then one case of the MAY, and stays as it is.
     - Scoped by who runs A, not by "the observer's own Assistant" (Duty Menus § 2): what makes the relay A's word is
       running A. A client of a service that hosts per-customer keys knows where each publishes, though under answer
       4(a) such a key is not its customer's own Assistant; a person's client elsewhere does not know where its own
       instance's Assistant publishes.
     - **Not taken:** *amending the Relay hint to point at Treasure Maps § 3 with an interim note* (C4's second fix).
       The specs would disagree until the code changed, and `/treasure-map`'s own-Assistant fill would be
       non-conforming meanwhile.
   - **SHOULD, not MUST** (question 2). A self-entry and a menu row are both A's own word, and the read-time fallback
     repairs a stale hint. The order is a quality rule for the hint, not something every reader needs to read alike
     (A1-11's lesson).
   - **Composition with an insisted key** (finding 26). Under sub-decision 3's relay rule, A has a self-entry keyed an
     insisted K only where step 5 gives K a relay (the one K's offering rows share), and it names that relay. With menu
     `not-offered 3039x`, `30396:tag` → R1, `30393:tag` → R2, step 5 gives the empty string, no self-entry is keyed
     `3039x`, and every client writes `""`; with both rows at R1, a self-entry keyed `3039x` names R1, and every client
     writes R1 (`s3/r2/m5s.py`, named). The client MAY still warn that the menu does not offer K as a whole.
     - Revision 1's truthful `3039x` → R1 with rows at R1 and R2 (where the observer gave every other part of `3039x`
       away, `s3sk/resolution/k5_insisted_selfentry.out`) is not a self-entry under the relay rule; A writes
       `30396:tag` → R1.
     - Under § 9.2 an insisted key seldom keeps a self-entry keyed K: 2 of 11,155 insisted observer keys, each naming
       step 5's relay (`s3/r2/m3ins2.py`). Element 3 then comes from the menu, and the read-time fallback finds each
       part.
   - **No menu found** (AC5). Where element 3 comes neither from A's self-entry nor from the service that runs A, and no
     menu of A's is found (Duty Menus § 8.1), the entry is `[K, <A>, ""]`, and the client MAY warn that A publishes no
     menu. This replaces the handoff's § 6 step 3, which A1-4 already set aside for a key whose menu is found: "the same
     category" is undefined, and a relay A uses for another key is a guess for this one. Whether the live defect's
     stopgap may still ship for external Assistants is question 3.

9. **Duty Menus § 6.2: in principle, nothing to resolve, levels, and the guarantee** (AC4, AC5, AC6; findings 14, 20,
   26).
   - **§ 6.2's lead** (finding 14): "In steps 1 to 5, an insight under K is every insight K matches in principle
     (Treasure Maps § 8), not only those in the observer's supported sets."
     - *Check:* menu `not-offered 3039x`, `30396:tag` → R1, `30393:tag` → R2, K = `3039x` kept for A, gives
       `[3039x, A, ""]` whatever Tags the observer supports. Counted over supported sets with no Tag-based `30393`
       lists, it would give R1 (`s3/m4_principle.py`).
     - Over 16,493 random keys, 626 entries would move with the supported sets if counted that way, 615 of them
       insisted keys.
   - **Step 1's last bullet** gains a pointer: "A key that matches no insight, because its kind and category disagree
     (§ 4.3) or because Treasure Maps § 4.6 says so for `39999:duty-menu`, has nothing to resolve." Without it, every row
     "covers" a key that matches nothing, and two exact-kind rows tie as its answering row (`s3/r1/m7r.py`). It is a
     pointer, not a restatement: the key rule stays normative in Treasure Maps alone. It is the only change to steps 1–4
     outside the lead; story 4 rewrites the rest.
   - **Step 5's lead** (finding 26), quoting Treasure Maps' levels rather than stating them as fact: "Treasure Maps
     § 3 asks a client to take element 3 from A's self-entry keyed K first (SHOULD), and lets a client of the Assistant
     service that runs A take it from where that service publishes A's insights (MAY). A client that does either does
     not fill from the menu. Otherwise, a client that fills the entry from A's menu resolves K:". The MUSTs below bind a
     client that fills from the menu; the no-guess MUST NOT binds every client that fills element 3 automatically.
   - **Step 5's levels** (finding 20). Each obligation states its level:

     | Obligation | Level |
     |---|---|
     | When the answering row is a `duty` row, write `[K, <A>, <answering row's relay>]` | MUST |
     | When the observer keeps a key the menu does not offer as a whole, write the insisted-key entry | MUST (§ 1, principle 3) |
     | When element 3 comes neither from A's self-entry nor from the service that runs A (Treasure Maps § 3), no menu of A's is found, and the observer keeps K for A, write `[K, <A>, ""]` | MUST (§ 1, principle 3) |
     | Write no entry the observer did not choose | MUST NOT (unchanged) |
     | List every row within K, with its meet (or a description of its part) and its answer | SHOULD (question 4) |
     | For a `not-offered` part, say that those insights won't come from A | SHOULD (question 4) |
     | Offer each differing row's meet, or the row's own key, or say that no key covers the part | SHOULD |
     | The Alternates bullet | SHOULD and MAY (unchanged) |
     | Write a relay that is not A's own word (a guess), for any client that fills element 3 automatically | MUST NOT (question 3) |
     | Warn that A does not offer K as a whole, or publishes no menu | MAY |

     Finding 20's example made the listing MUST and the offer SHOULD. This ADR makes the listing SHOULD:
     - it is a disclosure in a client's UI, and every reader reads the saved Map alike (A1-11's lesson);
     - for an offering differing row, the read-time fallback now finds the part at its row's relay (sub-decision 6), so
       the entry's correctness no longer rests on the listing there;
     - for a `not-offered` part the fallback finds nothing, since A publishes it nowhere. The listing is then the
       observer's only cue to give the part to another Assistant. SHOULD still matches § 1 principle 3, which makes the
       warning for a key not offered as a whole a MAY.

     This is the owner's call (question 4).
   - **"What the entry guarantees"** (AC4): "the entry's relay is the menu's relay for every insight under K except those
     in a differing row's part, which a reader that follows Treasure Maps § 3 looks for at read time." "Treasure Maps
     does not yet define" goes, and so does "The client lists every differing row" in this bullet; the listing keeps its
     own bullet at SHOULD. The guarantee says where a careful reader looks, not that it finds: the fallback is SHOULD,
     and a reader that gets an older menu (§ 8.1, "Fewer relays") or meets a part no self-entry claims and no write relay
     holds can still miss it.
   - **The no-guess rule** keeps its place in step 5, at MUST NOT, and its scope is stated (C4): "A client that fills
     element 3 automatically MUST NOT write a relay that is not A's own word for K. A's own word is A's self-entry keyed
     K, A's menu, or, for a client of the Assistant service that runs A, where that service publishes A's insights under
     K (Treasure Maps § 3). A guess, such as one of A's kind 10002 write relays, the relay where the client found the
     menu, or a relay the Map gives A for another key, is not." Only the observer, writing by hand, chooses another
     relay. Its reason is restated without "gives a reader no cue to look further", which the fallback has made untrue
     for readers that follow it:
     - "a guess looks like A's own word: a reader asks it first, a reader that does not fall back asks nowhere else, and
       no one can later tell it from a relay A named";
     - "the empty string says at once that no relay is known".
   - **§ 14 question 4** becomes resolved, in Treasure Maps' style for settled questions: "~~Read-time resolution~~ —
     resolved: Treasure Maps § 3." The question keeps its number, because questions 5 to 7 are cited by number.

10. **`duty-menu` and Map keys** (`treasure-maps.md` § 4.6; AC6, answer 1(a)).
    - A paragraph after the reserved-word list:
      - "`duty-menu` is not a reserved word in this sense: a kind-`39998` Concept header may use it as its `d`, as the
        Duty Menu header and its dictionary copies do. [Duty Menus](./duty-menus.md) § 4 reserves it as the `d` of a
        kind-`39999` menu."
      - "For Map keys: no key matches a kind-`39999` Concept header whose `d` is `duty-menu`, such as an event that
        breaks that reservation. So `39999:duty-menu` names no Concept and asks for nothing, a client builds no filter for
        it (§ 5.3), and `*`, `39998` and `39999` never reach such a header, whatever they cover. `39998:duty-menu` is an
        ordinary Concept key."
    - § 5.3 gains a pointer after its filter: "(No key reaches a kind-`39999` header whose `d` is `duty-menu`, § 4.6.)"
      The filter § 5.3 would build for `39999:duty-menu` is exactly a menu's filter, so the pointer sits where a
      reader builds it.
    - Revision 0's "a Concept header may use it" said more than Duty Menus § 4 allows ("A key MUST NOT use it for any
      other kind-39999 event"). The kind-`39998` wording agrees with it, and the key rule stays as a defence against
      events that break the reservation.
    - The rule excludes one insight from every key, so it holds under any answer story 4 gives A1-8. `s3/m7_enum.py`
      checks it under all four readings of the bare kinds: without the rule, `*`, `39998`, `39999` and `39999:duty-menu`
      reach such a header; with it, none does, and `39998:duty-menu` still reaches the `39998` header.
    - **One place each.** The reservation stays normative in `duty-menus.md` § 4 alone. The key rule is normative in
      Treasure Maps alone; Duty Menus § 6.2 step 1 points at it (sub-decision 9).
    - **Not taken:** answers 1(b) and 1(c), which the owner declined.

11. **Duty Menus § 6.1 is complete** (AC6; finding 16).
    - A fifth condition, stated from the event alone: "it carries no `["z", "list"]`, and no `z` whose value is the
      address of a kind-`39998` event with `d` = `concept-header`, whoever its author ([DList Header
      Declaration](./dlist-header-declaration.md) § 2)." "Only when" becomes "when, and only when", so the five
      conditions are both necessary and sufficient.
    - After the list: "An event at `d` = `duty-menu` that fails any of them is not a menu. One that declares itself a
      header breaks § 4's reservation; a reader treats it as no menu, and § 8.1 and § 8.2 treat the key as having none at
      that version. A menu is never read as a header: a reader does not apply DList Header Declaration § 6's migration
      exception to it."
    - **Why from the event alone.** DList Header Declaration makes the address form a declaration for "the community
      handle, plus the handles of deployments they honor" (§ 4). Read through that set, a menu that also names another
      deployment's `concept-header` is a menu to one reader and not to another (`s3sk/sources/k_sources.out`). Read from
      the event, every reader agrees (`s3/r1/m7r.py`). § 6's migration MAY could make a conforming menu that carries a `z`
      to a known firmware concept a header; the last sentence keeps it a menu.
    - Two readers now agree on every event: a header-declaring event is never a menu, and a menu is never a header
      (`s3/m7_enum.py`, `s3/r1/m7r.py`). Since no Map key reaches it as a Concept either (sub-decision 10), a menu is
      never read as a Concept header.
    - **Not taken:** *"the four are sufficient".* A header-declaring menu would still be a header under DList Header
      Declaration. Fixing that needs an edit outside AC8's three files.

12. **Keys the observer runs** (§ 9.2, `assistant-designation.md`, `duty-menus.md` § 2; AC7, answer 4(a)).
    - **The TA.** "An instance's Tapestry Assistant keeps a self-Map too: its self-entries report what it publishes for
      its owner, and it never takes duties from them; it takes them from its owner's Map (§ 9)."
      - "The TA's kind 10040 is both its self-Map and the instance's own Map, the instance being its own person
        ([Assistant Designation](./assistant-designation.md), § Relationship to instance identity). Entries in it that
        name other keys are ordinary entries."
      - Cite that spec's section rather than BIBLE, so the spec cites a spec.
    - **A key that serves only itself.** "A person who publishes their own insights with their own key has no
      customer's Map to read. What they mean to publish next is theirs to keep, off the Map. Their Map names their key
      only for what is live, as self-entries added and removed as this section says. Their self-entries speak for every
      insight they win in their own supported sets, so for them too a self-entry means published and maintained." That
      grounds AC7's "a self-entry means active" in the meaning rule (sub-decision 2), not beside it.
    - **`assistant-designation.md` § Authorship.** "A TA cannot designate itself." becomes "A TA cannot designate itself
      on anyone else's behalf." It gains one sentence: "Its own kind 10040 may name itself, as a self-Map ([Treasure
      Maps](./treasure-maps.md) § 9.2); such entries report what it publishes and designate no one." Nothing else in
      the user-signed designation changes.
    - **`duty-menus.md` § 2 defines "The observer's own Assistant"** (answer 4(a)): "a key the observer itself runs: the
      Tapestry Assistant of its own instance ([Assistant Designation](./assistant-designation.md)), or any other key the
      observer runs to publish its own insights, its own key included. A key the observer only names in its Map is not
      its own Assistant."
      - No pointer to Treasure Maps § 9.2: its paragraph covers a person's own key only, and answer 4(a) covers any key
        the observer runs, a separate self-hosted key too.
      - § 7's exception links to it.
      - § 14 question 3 gains one clause: a non-personalized provider's key is not the observer's own Assistant, so
        the question stays open.
      - The definition is for filling entries (§ 7). At read time no reader needs it: storefront rows never count in
        Treasure Maps § 3's step 2 (sub-decision 6).

13. **Counting Maps** (§ 9.2; AC1, answer 5(a)).
    - "A self-entry never counts as its key's choice of a provider. A client that counts people by their Maps
      (adopters, participation, points of view to enumerate) SHOULD count a Map only when at least one of its public
      entries names a key other than its author."
    - "So it leaves out a self-Map made only of self-entries, and an empty Map. It also leaves out the Map of a person
      who serves as their own Assistant for every insight, since a reader cannot tell that Map from an Assistant's
      without deciding which keys are Assistants, which this NIP does not ask of it; and a Map whose entries are all
      private (NIP-85's `.content`), which outsiders cannot read. A person who names another key in a public entry is
      counted."
    - **Why SHOULD.** Counts are each reader's own, per point of view. The spec names no exception; answer 5(a) asked it
      to accept the loss and say so, and revision 0's mention of a client that knows whose key it is went beyond that.
    - **Public entries.** Private entries are open (§ 13 question 8), and outsiders cannot read them. A whole-private
      Map is a person's choice to keep their providers to themselves; leaving it out of others' counts is the side
      Show and Tell's reuse hazard prefers. Revision 0 dropped such Maps without saying so.
    - **The first sentence** also covers counts of how many Maps name a provider (Duty Menus § 9's "what trusted people
      do").
    - `s3/m7_enum.py` and `s3/r1/m7r.py` list the cases: the self-Map, the emptied self-Map, the all-self person, the
      all-private Map and the empty Map are not counted; the person who names B in a public entry, the TA's mixed Map and
      an ordinary person's Map are counted.

14. **§ 13 question 5** (AC1): "If they are adopted, an Assistant that finds Maps by `#p` skips any Map it wrote itself:
    its self-entries name it but create no duty (§ 9)."

15. **Bookkeeping** (AC8; answers 2(a) and 3(a)).
    - **Tracking surface: an `_intake.md` entry**, written before the handoff flips. `_intake.md` is the home for
      triaged-but-unbuilt features (OPEN.md's surfaces table). The later code book closes it with a PICKED UP marker,
      and `/whats-open` lists it while it is unmarked. Q6 rides in it as the handoff's § 8 step 5. Text in the
      Implementation notes, in a fenced block so that it is copied without quote marks (the intake reader matches
      `## 20YY-` at line start, `scripts/lib/collect-intake.sh`).
      - *Not taken:* a ledger row (the ledger is for items with no other home, and this one has one); both (two surfaces
        for one item).
    - **The handoff flips** to ✅ SUPERSEDED. Its first Status line says, on that line, that the code is not built and
      where it is tracked, because `/whats-open` and CLAUDE.md read SUPERSEDED as shipped. Where each part landed
      follows as body text.
    - **Story 3 → story 4, by scope** (answer 2(a)). Every "story 3" in ADR 0002's A1-8, A1-9 and A1-10, and in the lines
      elsewhere in ADR 0002 that speak of them, means story 4 of this epic, whatever its wording: sub-decision 3's A1-8
      note (:152), the A1 approval (:425), A1-1 (:467), A1-8 (:628–666), A1-9 (:667–723), A1-10 (:724–814), and the
      Consequences of A1 bullets on A1-8 and A1-9 and the carry-forward bullet (:928–937, :948–949). The "story 3" of
      read-time resolution, Self-Maps, the § 4.5 care for `39999:duty-menu` and the self-entry fill step (:50, :93,
      :170, :220, :310, :557, :570, :915, :921–922, :940) stays story 3 and is met here. This ADR is the record; the
      epic and ledger row `2026-10-09-draft-grammar-bare-39999` say the same. ADR 0002 is not edited.
    - **Ledger row `2026-10-11-duty-menus-spec-fold-forwards`** gains a note: story 3 handled findings 14, 16, 20, 21, 26
      and 27; 12, 13, 15, 17, 18, 19, 22, 23 and 24 went to story 4. It stays OPEN.
    - **Ledger row `2026-10-09-draft-grammar-bare-39999`** gains a note naming story 4. It stays OPEN.
    - **Ledger row `2026-10-10-external-assistant-relay-left-empty`** gains a note on its stopgap, worded by the owner's
      answer to question 3. The flipped handoff points readers at this row for the code, so the row must not recommend
      a fill the specs forbid. It stays OPEN.
    - **The story's Deviations section** records the owner's answer to question 1 (and to question 2 if it changes how
      AC5's "one answer" is read). The PO writes it at this ADR's gate; the Implementer does not edit the ACs.
    - **One place per fact.** Self-Maps (meaning, content, timing, finding, reading, counting), the fallback, the fill
      order's first step and the `duty-menu` key rule are normative in Treasure Maps. Menu resolution, the insisted
      key, the no-guess rule, the no-menu entry, § 6.1 and "the observer's own Assistant" are normative in Duty Menus.
      Each spec points at the other.

**The owner's answers, mapped.** 1(a) → sub-decision 10. 2(a) → 15 and Out of scope. 3(a) → 15. 4(a) → 12. 5(a) → 13.

**The four invariants.**
- *POV-first:* counts and the fallback are each reader's own; a self-Map read as a point of view is its observer's
  slice, and a mixed one says so.
- *Decentralized-first:* no self-entry gates anything; a client never refuses an entry for want of one; the spot-check
  verifies before a switch and never gates publication.
- *Filter at view time:* the fallback re-resolves on every read, looks in the same places for every reader of one Map,
  and writes nothing back.
- *Local-first:* a person's pending requests stay in their own state, and nothing here discards local graph state.

## Open questions for the owner

Each needs the owner's decision at this ADR's gate. The ADR is written under each recommended answer; the Implementation
notes say what changes under another.

1. **What does a self-entry claim, and how far do AC2's "copied verbatim" and AC3's "only that key's slice" give way?**
   AC2 asks that a self-entry's key be "the customer's winning key, copied verbatim" and its relay "the relay where the
   insights actually are", and allows only "one entry per key" or "where the insights actually are" to give way. AC3
   asks that a self-Map read as a point of view show "only that key's slice", and that a listed duty count as maintained
   "whatever the insights' age". With `not-offered` parts, carve-outs and supported sets, these cannot all hold.
   - **Under every answer** (C1, C3): a self-entry is read over the supported sets of the observer its key serves, the
     only reading under which a scope self-entry can exist (sub-decision 2), and its relay is the one A's menu gives its
     key (sub-decision 3). So a scope self-entry also wins insights outside those sets, and stale copies of those it
     stopped can show to a point-of-view reader and count as maintained for a reader without the sets (sub-decision 5,
     third case). AC3's "only that key's slice" then holds for the insights a self-entry speaks for, not for every
     insight it wins.
   - **(a) Per duty — recommended.** An Assistant's self-entry speaks for its duties; a key that serves only itself, for
     every insight it wins in its supported sets. The verbatim key gives way only where it would win a duty A does not
     publish at its relay (a `not-offered` part, a part at another relay that no narrower self-entry separates, an
     insisted key's unoffered parts), or where A's menu gives it another relay. It stays verbatim over carve-outs: in
     Treasure Maps § 14's Map, with a menu that offers everything at one relay, the Brainstorm Assistant keeps `*`.
     - Cost: a self-entry can also win an insight the observer gave to another key. A reader of a Map that names A as
       someone else's Assistant, or of A's self-Map as a point of view, may take a stale copy of it as maintained,
       unless it is a List A retracted. The spec states it (sub-decision 5, fourth case). Model (`s3/r2/m3s.py`, with
       supported sets): 790 of 834 keys given wholly at one relay kept verbatim; 96.5% of published duties claimed; 108
       insights given to another key won per 6,000 Maps. Stale copies after carve-outs (`s3/r2/m6s.py`): 23 Lists and
       134 Scores per 1,295 trials.
   - **(b) Self-contained.** A self-entry speaks for every insight it wins in the supported sets. The verbatim key gives
     way also where the observer gave part of it to another key.
     - Gains: one meaning for every key; within the supported sets, the age allowance and the point-of-view reading hold
       for every reader; no limit about carve-outs. The supported-set limit stays, as under (a).
     - Cost: longer self-Maps wherever a Map carves exceptions, the usual case. In § 14's Map the Brainstorm Assistant
       cannot write `*`; it writes `3038x`, `3039x:pin`, `3039x:dlist`, `3039x:contexts` and one Concept key per Concept
       it curates. Bob's Assistant cannot write `3039x:tag`; it writes one key per List kind and, for `30396`, one per
       DList but Restaurants in Nashville. Model: 775 of 834 kept; 93.1% claimed; 0 insights given to another key won.
     - Changes if chosen: sub-decision 2's "What a self-entry speaks for" loses its second sentence and "those the
       observer gave to another key"; sub-decision 5's limit loses its fourth case; nothing else.
   - **(c) Verbatim always.** AC2's words as written. A self-entry then claims duties A does not publish (V: 18,106
     unpublished duties claimed and 60 at a wrong relay per 6,000 Maps, `s3/r1/m3r.py`), so "confirmed" and the age
     allowance cannot be trusted wherever a key has a `not-offered` part. It contradicts AC2's own "where the insights
     actually are".
   - **Why (a).** It keeps the handoff's verbatim keys and short self-Maps in the common case, the switching client the
     handoff was written for (an observer comparing its own Preferred and Alternate) is served exactly, and the
     carve-out exposure is confined to two readings that § 9 ("Naming someone else's Assistant") and the counting rule
     already treat as secondary. Under the supported-set reading, (b) no longer makes the allowance hold for every
     reader: it removes the carve-out case and leaves the supported-set one. (b) is still a fair choice if the owner
     weighs standalone readability higher.
   - **Either way**, the story's Deviations section records that AC2's "copied verbatim" now reads "verbatim where that
     key claims nothing false and A's menu gives it the relay where A publishes what it claims; narrower keys otherwise"
     (plus, under (b), "and nothing the observer gave another key"), and that AC3's "shows only that key's slice" holds
     for the insights the self-entries speak for: stale copies of insights outside the observer's supported sets (and,
     under (a), of insights the observer gave to another key) can show too.

2. **At what level does the self-entry come first, and what does AC5's "one answer" mean?**
   AC5: "Reading both specs gives one answer for element 3, and they agree on it." Under sub-decision 3's relay rule,
   A's self-entry keyed K and A's menu give K the same relay whenever the client holds A's current menu (0 of 12,029
   lagged fills differ, `s3/r2/m5s.py`). In AC5's insisted case every client therefore writes the same: `""` when the
   offering rows name two relays, since no self-entry is then keyed K, and their shared relay when they name one.
   Clients still differ when no menu of A's is found: one that looks for a self-Map writes the self-entry's relay, one
   that does not writes `""`. Both conform.
   - **(a) SHOULD — recommended.** Both specs state one rule at one level; Duty Menus quotes Treasure Maps' level. AC5's
     check reads as "the two specs agree", and they now agree on the relay too wherever a menu is found. Reason: element
     3 is a hint, the fallback repairs it (its step 1 is that self-entry), and A1-11's lesson keeps a client's choices
     out of MUSTs that readers do not need.
   - **(b) A conditional MUST:** a client that holds A's self-Map MUST take the self-entry. Clients that did and did not
     look still differ when no menu is found.
   - **(c) MUST look, and MUST take.** One answer for every client, at the cost of a self-Map lookup (A's kind 10002
     and the hints) on every fill.

3. **May the live defect's stopgap still ship?**
   The handoff's § 7 says "A stopgap can ship first", and ledger row `2026-10-10-external-assistant-relay-left-empty`
   gives it: "when the Map already gives that Assistant a relay in the same category, reuse it; otherwise warn in the
   save note before writing a Scores entry with no relay." Under sub-decision 9 that reuse is a guess, which the
   no-guess rule forbids to any client that fills element 3 automatically. Not in question (C4): a client of the
   service that runs the Assistant, such as `/treasure-map` filling this instance's own Assistant from Relay Settings,
   or a Tapestry instance following Assistant Designation's Relay hint, takes A's own word (Treasure Maps § 3's MAY).
   - **(a) No — recommended.** The stopgap is non-conforming for external Assistants. The four readers' fix is Treasure
     Maps § 3's fallback: today, with no menus or self-Maps published, its step 3 (the Assistant's kind 10002 write
     relays). The ledger row gets a dated note saying so.
   - **(b) Yes, as a MAY.** Duty Menus adds to step 5: "Where A's own word gives no relay (no self-entry keyed K, no
     menu of A's found, and the client is not a client of the service that runs A), a client MAY write a relay the Map
     already gives A for another key of the same family (`3038x`, `3039x`, or the Concept kinds), and SHOULD tell the
     observer it is a guess." The no-guess MUST NOT names it as its one exception. Readers cannot tell it from A's word,
     which is the reason the no-guess rule exists.
   - **Why (a).** "Same category" is undefined, a guess looks like A's own word to every later reader, and the readers'
     fix is about as small as the stopgap and is the lasting one. The case that matters most today, this instance's own
     Assistant, is already covered by the MAY.

4. **At what level are step 5's listing and its `not-offered` disclosure?**
   - **(a) SHOULD for both — recommended.** They are disclosures in a client's UI, every reader reads the saved Map
     alike (A1-11's lesson), and § 1 principle 3 makes the warning for a key not offered as a whole a MAY. For an
     offering differing row the fallback finds the part; for a `not-offered` part it does not, and the disclosure is the
     observer's only cue.
   - **(b) MUST for a `not-offered` part only, SHOULD for the rest.** It guards the one case the fallback cannot repair,
     but makes a part's disclosure stronger than the warning for the whole key.
   - **(c) MUST for the listing throughout,** as finding 20's example had it.

## Consequences

- **A client switching a duty can tell whether the other Assistant is live** (confirmed Alternate), and readers find
  insights whose Map relay is empty, gone or wrong, from the Assistant's own word first.
- **A dropped duty is not kept alive by the Assistant's own Map** (§ 9), and a removed self-entry reaches readers by
  A1-12's rules. The TA's self-Map no longer contradicts `assistant-designation.md`.
- **Departures from the handoff's § 5 and § 6**, each argued above:
  - the fallback fires per insight on "no copy it accepts", at SHOULD, with kind 10002 as a third step (§ 5 had "empty
    or unreachable", MAY, two steps), runs for each provider in turn, and storefront rows never count in it;
  - a self-entry is read over the observer's supported sets and claims only what holds, so a verbatim key gives way to
    narrower ones where it would claim too much, or where A's menu gives it another relay;
  - the fill takes the self-entry whose key is K, not "the winning self-entry", and a client of the service that runs A
    may fill from where that service publishes;
  - "maintained whatever the age" holds at the self-entry's relay only, for the insights it speaks for, and rests on
    the key removing or narrowing its self-entries;
  - the brief gap covers only an insight that will land at the self-entry's relay;
  - a move to another relay ends the self-entry at the old relay first, not a brief gap, and is not a stop for the
    insights;
  - A should retract a List whenever it stops it, other than by a move, not only after a removal;
  - the handoff's § 6 step 3 (same-category relay) is gone for the no-menu case too, subject to question 3.
- **Departures from the approved story:** AC2's "copied verbatim" and AC3's "shows only that key's slice" (question 1).
  The story's Deviations section records the owner's answer. AC5 is met as worded: the self-entry keyed K comes first,
  with no condition.
- **Publishers carry more:** a self-Map that stays true may need narrower keys than the observer's (96.5% of published
  duties claimable in the model without a single false claim under answer (a); 93.1% under (b)); each self-entry names
  the relay A's menu gives its key; a new duty at another relay means narrowing first; every version needs a later
  `created_at`; each version goes to every relay an earlier self-entry named; a List A stops should be retracted.
- **Readers pay more lookups** for a missing insight: A's kind 10002, A's self-Map (its write relays, the hints, the
  relays its self-entries name), A's menu (Duty Menus § 8.1), then the relays they name. A reader can remember them per
  Assistant and exact key while it reads.
- **Known limits, stated in the spec:** an Assistant that stops without removing its self-entries, or whose removal a
  reader never sees, keeps its last insights counted as maintained until the observer changes its Map; until it reads a
  change to the observer's Map, its self-entries can win a new duty it has not started; a scope self-entry can make a
  stale Score or Concept (or a List it did not retract) outside the observer's supported sets count as maintained for
  any reader without those sets, the observer's own included; under answer (a), a self-entry can make a stale copy of an
  insight its observer gave elsewhere count as maintained for a reader of someone else's Assistant or of a self-Map as a
  point of view.
- **The live defect's stopgap** becomes non-conforming for external Assistants under question 3's recommended answer.
  The ledger row says so, and the intake entry points at it. This instance's own Assistant keeps its Relay Settings
  fill, and Assistant Designation's Relay hint stays as written: both are the MAY for the service that runs A.
- **Story 4 still owns** the Concept order in § 6 (A1-8). Until it lands, a self-Map that names `39998` and `39999` at
  different relays claims nothing for 39999-declared headers under § 6 as written (a tie claims nothing); under Duty
  Menus' provisional order, `39999` claims them. No claim is false under either. A Map key `39998:` or `39999:` takes no
  relay from a self-entry in the fill until story 4 says what it means. A self-entry is never keyed `39998:` or
  `39999:`.
- **Two levels are judgement calls for the owner:** the fill order's SHOULD (question 2) and step 5's listing
  (question 4).
- **New wire surface:** none. Self-Maps are kind 10040 entries. § 6.1's fifth condition, § 4.6's key rule, the tie rule
  and the counting rule are reading rules; the publishing and lookup rules say where events go and which copy counts.
- **Firmware reinstall required?** No. No concept definition changes.

## Implementation notes

Docs-mode (protocol-spec workflow § 3): the Implementer writes exactly these, under the owner's answers to the four
questions (the recommended ones unless the owner chooses otherwise; each question says what changes). Inside
`protocols/`, only the three drafts change. Line numbers are as of `57ee1b67`.

**`protocols/drafts/treasure-maps.md`**
- **Metadata Sources** (:5): add [`duty-menus.md`](./duty-menus.md), the handoff, and `duty-menus-and-self-maps` ADR 0003
  (Self-Maps, the read-time fallback). Leave "Canonical:" as is (story Out of scope).
- **§ 1 principle 1** (:46): after "which relay", add "(§ 3 says where to look when element 3 does not)". **Principle 2**
  (:47): "…for that person, except as § 9 says." (sub-decision 1).
- **§ 2 Terms** (:55–69): the Observer line (:57) gains sub-decision 5's clause; add one line, "**Self-entry**,
  **self-Map** — § 9.2."
- **§ 3** (:71–77), rewritten: the hint paragraph and "not a promise" (sub-decision 6); "**Filling element 3.**" with
  the SHOULD, the key comparison and its `39998:`/`39999:` sentence, the menu step, and the MAY for a client of the
  service that runs A (sub-decision 8); "**When the insight is not there.**" keyed to a provider's entry, with the three
  steps, per insight, read-time only, the search that a refused copy does not end, the storefront clause in step 2, the
  enumeration MAY (sub-decision 6); one closing line: "§ 7 says when a reader moves on to the next Alternate."
- **§ 4.6** (:166–168): the `duty-menu` paragraph (sub-decision 10).
- **§ 5 lead** (:190): the pointer sentence (sub-decision 6). **§ 5.3** (:224): the § 4.6 pointer (sub-decision 10).
- **§ 7** (:279–281): the fallback sentences, "each provider in turn", and the "first provider, in order" sentence
  (sub-decision 7); the confirmed Alternate sentence after "Alternates are standbys that are already up to date"
  (sub-decision 5).
- **§ 9** (:299–307): the "Self-entries" bullet before "Naming someone else's Assistant", and that bullet's new opening
  "An entry other than a self-entry may name…" (:305) (sub-decision 1). Revocation (:307) gains: "The Assistant updates
  its self-Map (§ 9.2) before it stops updating them; § 9.2 also asks it to retract its Lists." (sub-decision 4).
- **New § 9.2 Self-Maps**, after § 9.1, normative, in this order, with bold-lead paragraphs:
  1. terms, meaning, what a self-entry speaks for (read over the supported sets), ties (sub-decision 2);
  2. what a self-Map holds: its key, its relay (the menu's relay for its key), more than one relay, the MUST NOT, no
     order or copies, private duties, no expiration, no `39998:`/`39999:` key (sub-decision 3);
  3. when it changes (the gap for a same-relay insight only, the two removal MUSTs, the move), what follows a stop, and
     finding it (sub-decision 4);
  4. reading a self-Map: confirmed duty ("wins it and speaks for it") and Alternate, maintained at its relay,
     spot-check, as a point of view (with its stale-copy sentence), what the allowance rests on (its four cases)
     (sub-decision 5);
  5. keys the observer runs (sub-decision 12);
  6. counting Maps (sub-decision 13);
  7. "**Offered and active.** A key's Duty Menu ([Duty Menus](./duty-menus.md) § 10) says what it offers; its self-Map
     says what is active." (AC2's mutual pointer, to Duty Menus § 10 specifically.)
- **§ 13 question 5** (:524): sub-decision 14's sentence. **Question 8** (:527): add "A self-Map keeps private duties
  out of its public tags (§ 9.2)."
- No change to §§ 4.1–4.5, 4.7, 5.1, 5.2, 5.4, 5.5, 6, 8, 9.1, 10–12, 14.
- *Under question 1 (b):* § 9.2's "What a self-entry speaks for" loses its second sentence and "those the observer gave
  to another key", and the limit paragraph drops its fourth case.

**`protocols/drafts/duty-menus.md`**
- **Metadata Sources** (:6): add ADR 0003.
- **§ 2 Terms** (:40–51): "**The observer's own Assistant**" (sub-decision 12).
- **§ 6.1** (:142–153): the fifth condition, "when, and only when", and the sentences after the list (sub-decision 11).
- **§ 6.2 lead** (:157–159): the in-principle sentence (sub-decision 9).
- **§ 6.2 step 1's last bullet** (:182): the § 4.6 pointer (sub-decision 9).
- **§ 6.2 step 5** (:194–223), per sub-decision 9:
  - the lead (finding 26), quoting Treasure Maps' two levels (the self-entry's SHOULD, the service's MAY);
  - the levels table's keywords on the existing sentences;
  - the guarantee bullet;
  - the no-guess sentence, at MUST NOT, scoped to every automatic fill and naming A's own word (its self-entry keyed K,
    its menu, the service that runs it), with its new reason and examples;
  - a new last bullet, "**No menu found.**" (sub-decision 8), at MUST, scoped by the same words.
  - *Under question 3 (b):* the MAY in that question, and the no-guess sentence naming it as the one exception. *Under
    question 4 (b) or (c):* the listing rows' levels.
- **§ 7** (:233): link "the observer's own Assistant" to § 2.
- **§ 10** (:278): "see Treasure Maps § 9" → "see [Treasure Maps](./treasure-maps.md) § 9.2, Self-Maps".
- **§ 14 question 3** (:360): the clause from sub-decision 12. **Question 4** (:361): resolved (sub-decision 9).
- Story 4's items stay untouched: § 5.1, § 5.3, steps 1–4 apart from the lead and step 1's last bullet, § 8.1, § 8.2, and
  § 14 questions 5 to 7.

**`protocols/drafts/assistant-designation.md`**
- **§ Authorship bullet** (:52): sub-decision 12's narrowed sentence and its pointer.
- **Metadata Sources** (:4): add `duty-menus-and-self-maps` ADR 0003.
- The Relay hint (:82) stays as written: it is a case of Treasure Maps § 3's MAY for a client of the service that runs
  A (sub-decision 8, C4).

**`engineering-team/stories/_intake.md`**: a new entry at the end, written before the handoff flips, copied as it stands
in this block (no quote marks; the heading starts at column 0):

```markdown
## 2026-10-11 — Duty Menus and Self-Maps in code: publish and read them, and the /treasure-map changes (feature; waits on the specs)

- **Origin:** `docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md` §§ 6–8 (✅ SUPERSEDED: its design is in `protocols/`;
  its code is not built). The book `duty-menus-and-self-maps` ratified the specs and left code to "a separate book,
  opened after this one".
- **What a build would do** (handoff § 8's engineering steps, as the specs now read):
  1. Nous' header coordinate as one shared constant; reader helpers for menu lookup (Duty Menus § 8.1), self-Map
     lookup (Treasure Maps § 9.2), resolution (Duty Menus § 6.2), and the read-time fallback (Treasure Maps § 3).
  2. A Duty Menu and a self-Map for each of this instance's Assistant keys, the TA and customer keys, naming the
     relays the insights really go to, and kept true as Treasure Maps § 9.2 says (each self-entry naming the relay its
     menu gives its key; narrower keys where a key is only partly published; narrowing before a new duty lands
     elsewhere; a move published before the old relay stops; Lists retracted when stopped, not when moved). Reconcile
     `BRAINSTORM_NIP85_HOME_RELAY`, `aTrustedAssertionRelays` and the router presets first.
  3. `/treasure-map` (handoff § 6):
     - element 3 filled per Treasure Maps § 3 and Duty Menus § 6.2 step 5;
     - relays read only from the Assistant being assigned (OPEN.md row 188);
     - per-card Not offered / Offered / Active, and "Standby ready" for a confirmed Alternate;
     - the "Make preferred" swap.
  4. Readers:
     - the read-time fallback in `useTrustWeights.js`, `BrainstormSearch.jsx`, `BrainstormSettings.jsx`,
       `nip50-proxy/src/wot-pipeline.js` and the house-POV setup;
     - the counting rule (Treasure Maps § 9.2) in `get-nip85-participation-data.js`,
       `get-all-10040-authors-locally.js` and `public/pages/about-trusted-assertions.html`.
  5. **Handoff Q6, NosFabrica adoption:** who asks NosFabrica to publish menus and self-Maps for Brainstorm's keys,
     and when. Open.
- **Replaces, does not add:** the two placeholder cards the `assistant-duty-cards` book put on the Assistant
  Management hub, Duty Menu (`/assistant/duty-menu`) and Your Assistant's Treasure Map (`/assistant/treasure-map`).
  Their open product questions are `engineering-team/audits/assistant-duty-cards/prd-seed.md` § 7, all five: is
  "always marked" right until they are built; when is each card done; read-only or act; who sees a person's Duty Menu;
  "Your" or "My". These lean Product Team first.
  - One constraint from the specs: a self-Map never lists a duty its Assistant does not publish at the relay it names
    (Treasure Maps § 9.2). So prd-seed § 7's suggested "done" for the Treasure Map card ("once the self-Map lists every
    duty the person's own Map gives this Assistant") cannot be met wherever the menu leaves part of a key unoffered.
- **Related:** ledger row `2026-10-10-external-assistant-relay-left-empty`. Its stopgap (reuse a relay the Map gives
  an external Assistant in the same category) is a guess that Duty Menus § 6.2 step 5 forbids. Filling this instance's
  own Assistant from Relay Settings stays: Treasure Maps § 3 lets a client of the service that runs an Assistant take
  that service's own word. The readers' fix is Treasure Maps § 3's fallback, whose last step, the Assistant's kind
  10002 write relays, works before anyone publishes menus.
- **Before or with it:** Nous publishes the header (outside the repo); story 4's key-grammar answers, which readers'
  key matching follows; a BIBLE pointer section when code ships (handoff § 8).
- **Classification:** feature, Standard. The two hub pages lean Product Team first (prd-seed § 7); the readers and
  publishers go straight to engineering.
```

*Under question 3 (b),* the **Related** bullet reads instead: "Its stopgap is allowed as Duty Menus § 6.2 step 5's MAY
(a relay the Map gives the Assistant for another key of the same family, with a note that it is a guess); the lasting
fix is Treasure Maps § 3."

**`docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md`**, line 3 replaced by one line, then a blank line and a body block.
No line that contains "Status:" may carry 🔴.

```markdown
**Status:** ✅ SUPERSEDED (2026-10-11): spec ratified in `protocols/`; code NOT built (tracked in `engineering-team/stories/_intake.md` § "2026-10-11 — Duty Menus and Self-Maps in code" and ledger row `2026-10-10-external-assistant-relay-left-empty`).

**Where each part landed** (book `duty-menus-and-self-maps`):
- D1: *offered* → `protocols/drafts/duty-menus.md` (§§ 1, 10); *active* → `protocols/drafts/treasure-maps.md` § 9.2.
- D4, D5, D7, D8, D9 and the § 4 shapes → `duty-menus.md` (§§ 3–5, 7, 8). D2 (not kind 0) is a reason recorded only in
  this handoff's § 2; D3's reason is in ADR `duty-menus-and-self-maps/0002`, and its fallback-locator role →
  `treasure-maps.md` § 3.
- D6 (no expiration on self-Maps) → `treasure-maps.md` § 9.2.
- D10, the self-pointing `b` → `protocols/drafts/inherit-from.md` § "The `b` tag", with a pointer in
  `shared-concepts.md`; the header itself → `duty-menus.md` § 3.
- § 4.2's reservation of `duty-menu` → `duty-menus.md` § 4, and the Map-key rule → `treasure-maps.md` § 4.6.
- § 5, Self-Maps → `treasure-maps.md` §§ 1, 2, 3, 7, 9, 9.2 and 13, and `protocols/drafts/assistant-designation.md`
  § Authorship.
- The spec half of § 6 (filling the relay) → `treasure-maps.md` § 3 and `duty-menus.md` § 6.2 step 5.
- The W1 note → `protocols/worksheet.md`.

**Open questions:** Q4 (private duties) is tracked in `treasure-maps.md` § 13 question 8, `duty-menus.md` § 14
question 1 and worksheet W22; Q6 (NosFabrica adoption) in the intake entry above; Q5 and Q7 were settled by the owner
on 2026-10-10 (`engineering-team/stories/duty-menus-and-self-maps/2-duty-menus-pre-nip.md` § Out of scope).
```

**`ledger/2026-10-11-duty-menus-spec-fold-forwards.md`**: append a note. **Status** stays OPEN.

```markdown
**Note, 2026-10-11 (story 3, ADR `duty-menus-and-self-maps/0003`).** Story 3 handled findings 14, 16, 20, 21 and 26,
and 27 (the handoff's Status line). Findings 12, 13, 15, 17, 18 (with A1-9), 19 (with A1-8), 22, 23 and 24 went to
story 4 of the epic (owner, 2026-10-11, story 3's open question 2(a)). The row stays OPEN until story 4 lands.
```

**`ledger/2026-10-09-draft-grammar-bare-39999.md`**: append a note. **Status** stays OPEN.

```markdown
**Note, 2026-10-11 (story 3's approval).** The owner moved the key-grammar questions to story 4 of the epic (story 3,
open question 2(a)). Read "story 3" above, and every "story 3" in ADR `duty-menus-and-self-maps/0002`'s A1-8, A1-9 and
A1-10 and the lines that speak of them, as story 4 (recorded in ADR 0003). The row stays OPEN until Treasure Maps
§ 4.5, § 6 and § 10 say so.
```

**`ledger/2026-10-10-external-assistant-relay-left-empty.md`**: append a note (question 3 (a)'s wording). **Status**
stays OPEN.

```markdown
**Note, 2026-10-11 (ADR `duty-menus-and-self-maps/0003`).** The stopgap above (reuse a relay the Map already gives that
Assistant in the same category) is now a guess that Duty Menus § 6.2 step 5 forbids to any client that fills element 3
automatically (MUST NOT). Filling this instance's own Assistant from Relay Settings is not affected: a client of the
service that runs an Assistant takes that service's own word (Treasure Maps § 3, MAY). The lasting fix is Treasure
Maps § 3 (the fill order, and the read-time fallback for readers, whose last step is the Assistant's kind 10002 write
relays) with Duty Menus § 6.2 step 5. The handoff's § 6,
named above, is SUPERSEDED by them. The code is the later book's (`engineering-team/stories/_intake.md` § "2026-10-11 —
Duty Menus and Self-Maps in code").
```

*Under question 3 (b),* the note says the stopgap is allowed as Duty Menus § 6.2 step 5's MAY, with its note to the
observer, and the rest stands.

**`engineering-team/epics/duty-menus-and-self-maps.md`** :34. Replace "Whether to split … the Goal above follows." with:
"The owner accepted the split at story 3's approval (2026-10-11): every "story 3" in ADR 0002's A1-8, A1-9 and A1-10,
and in the lines that speak of them, means this story (recorded in ADR 0003), and `duty-menus.md`'s provisional
readings (§ 6.2 step 1, § 14 questions 5–7) hold until it lands. The acceptance frame carries its bullet."

**`engineering-team/stories/duty-menus-and-self-maps/3-self-maps.md`**: the PO records question 1's answer (and
question 2's, if it changes how AC5 is read) in § Deviations at this ADR's gate. Not the Implementer's edit.

**Not edited:** ADR 0002, OPEN.md's table, `protocols/README.md`, BIBLE, the book file.

**Gates** (AC8):
- No "canonical" or "consensus" in any added or changed line of the story's diff, outside the metadata label:
  `git diff -U0 -- protocols/ docs/ ledger/ engineering-team/stories/_intake.md engineering-team/epics/ | grep '^+' | grep -n -i -E "canonical|consensus"`
  finds nothing but `**Canonical:**` labels (none of which this story adds).
- `grep -n -w root` finds none in added lines.
- Every link and § reference resolves, including `#` anchors to the new § 9.2 and to `duty-menus.md` § 2.
- `bash scripts/harness-lint.sh` is clean.
- The stack-free `npm test` shows no regression against the clean-tree baseline.
- `git diff --stat` touches, inside `protocols/`, only the three drafts. Outside it, it touches the story (Linked
  artifacts, and § Deviations by the PO), `_intake.md`, the handoff, the three ledger rows and the epic.

## Verification

For the Reviewer: re-derive each case from the specs as changed, and run the scripts.

**Per AC: where to look, and what it must say**
- **AC1.**
  - § 9's "Self-entries" bullet: creates no duty, designates no one, duties only from the Maps of observers served,
    and "judges element 2 against the Map's author first". "Naming someone else's Assistant" opens with "An entry other
    than a self-entry". Principle 2 says "except as § 9 says".
  - § 13 question 5: an Assistant that finds Maps by `#p` skips any Map it wrote itself.
  - § 9.2's counting paragraph: the SHOULD, "public entries", and the five left-out cases, the all-private Map among
    them.
  - *Checks:* O's Map drops A for K, A's self-Map still has `[K, A, R]`: A has no duty for K from O. An entry in A's own
    Map naming A is a self-entry even when A serves someone else; any other entry is "Naming someone else's Assistant"
    or a duty. Not counted: an Assistant's self-Map of self-entries only, the same emptied, a person who is their own
    Assistant for everything, a Map whose entries are all private, an empty Map. Counted: a person naming B in a public
    entry, the TA's Map with an ordinary entry, an ordinary person's Map.
- **AC2.**
  - § 9.2's terms (*self-entry*, *self-Map*); the meaning sentence (published and maintained, per insight, among
    self-entries alone, a tie claims nothing); what a self-entry speaks for (a scope self-entry over the supported sets
    of the observer its key serves, an exact one for its insight; then question 1's answer).
  - Its key (verbatim where it can, not universal), its relay (never empty; the relay A's non-storefront menu gives its
    key, save during a move), more than one relay (with the nested-row and meet-order caveats), the MUST NOT, no order
    and no copies, private duties out of public tags, no `expiration` on a kind 10040 that carries a self-entry, no
    `39998:`/`39999:` key.
  - Timing with levels (MUST NOT add early; MAY keep through a gap, for a new insight only one that will land at the
    self-entry's relay, narrowing first otherwise; MUST remove or narrow before stopping any insight the self-entry
    wins and speaks for; MUST remove a self-entry that speaks for nothing; a move ends the self-entry at the old relay
    first and retracts nothing; later `created_at`), and per family: Lists retracted whenever stopped (empty plus
    `["status","retracted"]`, later `created_at`), Scores left with the removal as the stopped signal, Concepts' header
    and `b` left in place. § 9's Revocation points at the List rule.
  - § 9.2's "Offered and active" names Duty Menus § 10, and Duty Menus § 10 names Treasure Maps § 9.2.
  - *Checks:* menu `3039x` → R0, `3039x:tag` → R1, O's `[3039x, A, R0]`: A's self-Map is `3039x` → R0 and `3039x:tag` →
    R1. With `30396:tag` → R0 added to the menu, it also has `30396:tag` → R0. Menu `3039x` → R0, `30396:tag::⟨T⟩` → R1,
    `3039x:tag:⟨D⟩` → R2, O's `30396`: the self-Map has `30396:tag:⟨D⟩:⟨T⟩` → R1. § 13.2's `3038x` → R with
    `not-offered 30385`, O's `[3038x, A, R]`: `30382`, `30383`, `30384`, `30386` and `30387` → R, and no `3038x`. Menu
    `*` → R0, `3038x` → R1, O's `*` with Lists and Concepts given to B: `3038x` → R1, not `*` → R1. O's `[30396:tag, A]`
    with T2 unpinned: `30396:tag` stays, and says nothing about T2's lists; A retracts those it published.
- **AC3.**
  - § 9.2: the confirmed-duty sentence ("wins it and speaks for it"); "maintained, whatever its age" at the winning
    self-entry's relay only; the spot-check SHOULD; the point-of-view sentence (self-entries are the served observer's
    slice for the insights they speak for, and can carry stale copies; other entries are the author's requests; a mixed
    self-Map mixes two views); the paragraph on what the allowance rests on, with its four cases (the third under every
    answer, the fourth under (a)).
  - § 7: the confirmed Alternate sentence. § 3: "A Map entry names who is asked to publish an insight. It does not
    promise that the insight exists." § 2: the Observer line's clause.
  - *Checks:* the TA's Map `["3038x", TA, R1]`, `["30382:rank", X, R2]`: among self-entries alone, `3038x` → R1 confirms
    the TA's ranks. `s3/m6_age.py` "relay": S1 reads A's v2 at R1; S2 reads A at R1; S3 accepts the old score at R; S4
    moves to B; S5 reads R1. `s3/r1/m6r.py`: Part 1 with A1-12's publisher rule gives B in every scenario whose sends
    arrive; Part 2's revision 1 order never reads a stale copy as maintained. `s3/r2/m6s.py`, Part A: with T2 unpinned
    and `30396:tag` kept, O's own reader takes A's last T2 list as maintained unless A retracted it or the reader holds
    O's supported sets.
- **AC4.**
  - § 3: the hint paragraph; "When the insight is not there" with the trigger (no copy it accepts at the relay a
    provider's entry gives), the three steps,
    "skipping any it has already asked", step 2's storefront clause, "A copy the reader does not accept does not end the
    search", per insight, read-time only; the enumeration MAY; the closing pointer to § 7. § 5's lead and principle 1
    point at § 3.
  - § 7: the conditional fallback sentence, "runs it for each provider in turn before moving to the next", "A reader
    that does not follow § 3 moves on after the entry's relay", and "the first provider, in order, whose copy it
    accepts".
  - Duty Menus § 6.2 step 5: the levels on every obligation, the no-guess MUST NOT with its scope; the guarantee bullet
    with "a reader that follows Treasure Maps § 3 looks for at read time"; § 14 question 4 struck through and pointing at
    Treasure Maps § 3. `grep -n "does not yet define\|Treasure Maps does not yet" protocols/drafts/duty-menus.md` finds
    nothing.
  - *Checks:* the four cases as in sub-decision 6. The order: O's `[3039x, A, R0]`, `[3039x, B, S0]`; A's menu `3039x` →
    R0, `3039x:tag` → R1. The Profiles list tagged T is read from A at R1, not from B. No menu, entry relay empty, an old
    copy at A's menu relay R1 and a current one at A's write relay Rw: the reader uses Rw. Preferred A, Alternates B
    and C on `3039x`; A does not publish the Profiles list tagged T, B publishes it at S1 (its menu's `3039x:tag` row),
    C at T0: the reader uses B.
- **AC5.**
  - § 3's "Filling element 3" (SHOULD, the self-entry keyed K with no other condition, keys compared by §§ 4.1, 4.4 and
    4.5, no self-entry relay for a K keyed `39998:` or `39999:`, the MAY for a client of the service that runs A).
    Duty Menus § 6.2's lead (in principle) and step 5's lead (quoting both levels), the no-guess MUST NOT naming A's own
    word, the "No menu found" bullet at MUST.
  - *Checks:* menu `*` → R0, `30382:rank` → R1, A's self-Map `*` → R0: giving `30382:rank` to A writes R1. Menu `*` →
    R0, `3038x` → R1: A's self-Map cannot hold `*` → R1, so giving B's Lists and Concepts back to A writes R0. Insisted
    `3039x` with offering rows at R1 and R2: no self-entry is keyed `3039x`, and every client writes `""`; with both at
    R1: the self-entry names R1, and every client writes R1. No self-entry and no menu found: `""`, except for a client
    of the service that runs A, which may write where that service publishes. Menu `not-offered 3039x`, `30396:tag` →
    R1, `30393:tag` → R2, K = `3039x` kept: `""` whatever Tags are supported. Assistant Designation's Relay hint reads
    as a case of the MAY.
- **AC6.**
  - § 4.6's paragraph (a kind-`39998` header may use `duty-menu`; no key matches a kind-39999 header at `d` =
    `duty-menu`; no filter for `39999:duty-menu`); § 5.3's pointer. Duty Menus § 4 unchanged; § 6.1's five conditions
    with "when, and only when", the syntactic fifth condition and the DLHD § 6 sentence; § 6.2 step 1's pointer.
  - *Checks:* no key reaches a kind-39999 header at `d` = `duty-menu`, under any reading of the bare kinds;
    `39998:duty-menu` names the `39998` header. A kind-39999 `duty-menu` event with `["z","list"]`, or with a `z` to any
    author's `concept-header`, is no menu for every reader. K = `39999:duty-menu` has nothing to resolve.
- **AC7.**
  - § 9.2's TA paragraph (reports what it publishes for its owner; never its source of duties; both its self-Map and
    the instance's own Map; other entries ordinary) and the paragraph on a key that serves only itself (self-entries
    speak for every insight they win in its supported sets).
  - `assistant-designation.md` § Authorship reads "…on anyone else's behalf", with its pointer. Duty Menus § 2 defines
    "The observer's own Assistant" without a § 9.2 pointer; § 7 links to it; § 14 question 3 stays open with its clause.
- **AC8.**
  - The intake entry exists, starts at column 0 with `## 2026-10-11 —`, and has the five steps, Q6, both cards, all five
    prd-seed § 7 questions, the "done" constraint, and the Related bullet's line for this instance's own Assistant.
    `bash scripts/whats-open.sh` lists it under "No PICKED UP …" and
    no longer lists the handoff under "🔴 OPEN handoffs".
  - `grep -m1 'Status:' docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md` prints a line containing "SUPERSEDED" and
    "NOT built", and no line containing "Status:" carries 🔴. The landing list says D2 is recorded only in the
    handoff's § 2.
  - The three ledger notes are in, with all three rows OPEN. The epic sentence is replaced. ADR 0002 is unchanged
    (`git diff --stat` shows no change to it). The gates pass.

**The model scripts.** Run with `python3 -I` from the session scratchpad. Outputs are saved beside each script as
`.out`. `s3/tm4.py` is `r4/tm4.py`, copied unchanged; `s3/sm.py` and `s3/r1/sm2.py` add the helpers.
- Revision 0's scripts in `s3/`, unchanged and still cited:
  - `m1_fallback.py 20000`: under readings C/b1 and A/b1, 0 exact keys that are not exact, and 0
    `exact_ans_ne_winner`; of the insights missed at the entry's relay (3,429 and 2,963), `found_by_insight` finds all
    and `found_by_key` finds 0; then the four named cases. The C/any line is not the spec's reading.
  - `m2_order.py 20000`: `X_uses_A` equals `A_publishes` (13,809), `X_misses_A` 0, and `differ` 209.
  - `m4_principle.py 20000`: the finding 14 example (`''` in principle, `'R1'` restricted), and 626 of 16,493 entries.
  - `m5_fill.py 6000`: the targeted trials give `wrong_cover` 18; the named case.
  - `m6_age.py`: the S1–S5 table above.
  - `m7_enum.py`: counting, the § 9 classification (0 with the order, 4 without), the `duty-menu` rule, § 6.1.
- Revision 1's scripts in `s3/r1/`:
  - `m3r.py 6000`: the table in sub-decision 3, and the named cases (multi-relay, nested row, meets ordering the other
    way, unpublished part, carve-out, insisted key, Concept kinds).
  - `m3ins.py 6000`: 3 of 11,155 insisted observer keys keep a self-entry keyed K (answer (a)); 0 under (b).
  - `m5r.py 4000`: carve-and-return with the k3 self-Map, `exact_wrong` 4 of 2,741, `qual_wrong` 0, `menu_wrong` 0; with
    sub-decision 3's self-Maps, all 0 of 4,000; re-fill of an unchanged Map, all 0 of 4,000; the named cases.
  - `m6r.py`: Part 1 (A1-12's publisher rule gives B in every scenario whose sends arrive; revision 0's leaves a stale copy "maintained"
    for a key with no kind 10002; a failed send of the removal still does, which sub-decision 5 states); Part 1b (the
    reader's third place turns a hint that missed the removal from A's stale rank to B); Part 2 (the move); Part 3 (a
    refused copy does not end the search); Part 4 (the stated limits).
  - `m7r.py`: counting with an all-private Map; § 6.1's fifth condition read from the event (both readers agree) and
    through the honored set (they differ); `39999:duty-menu` in Duty Menus' covering; a key that serves only itself; a
    tie claims nothing.
- Revision 2's scripts in `s3/r2/`, with `sm3.py`'s helpers (supported sets, the to-do list, "speaks for", the relay
  rule, the construction with its removal of self-entries that speak for nothing):
  - `m3s.py 6000`: the supported-set table in sub-decision 3; answer (a), relay rule on: 96.5% claimed, 790 of 834, 108
    and 1,521 won without speaking for them; off: 96.6%; answer (b): 93.1%, 775 of 834, 0 and 1,468; in principle:
    75.5%, 526 of 834; no self-Map breaks either rule; the named cases (C1's T2, § 14's Brainstorm Assistant, k3, §
    13.2, the nested row, meets ordering the other way, both insisted menus).
  - `chk_meet.py`: 3,818 of 3,818 meet-closure keys get, from step 5, the relay where A publishes the duty.
  - `chk_prune.py`: of revision 1's 198 non-duties won, 22 came from 72 self-entries that spoke for no duty.
  - `m3ins2.py 6000`: 2 of 11,155 insisted observer keys keep a self-entry keyed K under the relay rule, each naming
    step 5's relay.
  - `m5s.py 4000`: carve-and-return, `self_wrong` 0 and `menu_wrong` 0 of 4,000; any lag, `differ` 0 of 12,029 fills;
    re-fill, `differ` 0 of 4,000; the named cases (k3's `*` → R1 illegal; revision 0's case; both insisted menus).
  - `m6s.py 1500`: Part A (C1's T2 trace, with and without retraction and the supported sets); Part B (stale copies a
    self-entry wins: shrinks 64 Lists, 192 Scores, 1 Concept for the observer's own reader under either answer;
    carve-outs 23 Lists and 134 Scores for other readers under (a), none under (b)); Part C (a retraction after a move
    replaces the moved List for a reader that takes the latest); Part D (the two readings of the remove rule, and the
    observer dropping the key); Part E (the gap: 94 false confirmations under revision 1's wording, 0 narrowing first).
  - `m2s.py 20000`: `P_uses_B` 8,480 of 8,480, `Q_uses_B` 7,759, `Q_uses_C_instead` 33; the named case.
- The skeptics' scripts in `s3sk/` are cited where they show a case (`resolution/k2_vn_wrong`, `k3_exact_fill`,
  `k4_case1_stale`, `k5_insisted_selfentry`; `sources/k_sources`; `check2/c1_lag`, `check2/c2_supported`).
- The scratchpad is not durable. If the scripts are gone, rebuild them from sub-decisions 2–9 and 13 on `r4/tm4.py`'s
  model, as ADR 0002's "How it was settled" describes it, with `s3/r1/sm2.py`'s two truth conditions and construction
  and `s3/r2/sm3.py`'s supported sets and relay rule.

## Out of scope

- **Story 4:**
  - A1-8, the Concept readings and the order of `39998` and `39999` in § 6, including ties between such self-entries
    (which claim nothing meanwhile) and what `39998:` and `39999:` mean;
  - A1-9, category `39998`, with finding 18;
  - A1-10, the profiles slot;
  - findings 12, 13, 15, 17, 19, 22, 23 and 24.

  `duty-menus.md`'s provisional readings stay until it lands.
- **Private duties** in a self-Map's `.content` (handoff Q4; § 13 question 8), beyond keeping them out of public tags.
- **Non-personalized keys** (Duty Menus § 14 question 3). Their self-Maps follow the same per-insight meaning. Whether a
  storefront row may speak for the key itself, and so count in Treasure Maps § 3's step 2, stays open.
- **Whose view the TA's own insights carry**, and what an instance's own requests to its TA would mean (BIBLE §31). The
  spec says only what AC7 asks, and that a mixed self-Map read as a point of view mixes two views.
- **NIP-40 on a Map with no self-entry.** This story neither allows nor forbids it.
- **Any code.** That includes the stopgap in ledger row `2026-10-10-external-assistant-relay-left-empty`, which this ADR
  annotates (question 3) but does not build or remove.
- **NosFabrica adoption** (Q6), beyond its tracking surface, and **Nous publishing the header**.
- **A BIBLE pointer**, which comes when code ships (handoff § 8).
- **The `canonical` uses already in `treasure-maps.md`**, and existing "root" text.
