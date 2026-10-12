# Epic: duty-menus-and-self-maps

**Created:** 2026-10-10
**Status:** Active
**Book:** `engineering-team/audits/duty-menus-and-self-maps/book.md`

## Goal

Ratify the design in [`docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md`](../../docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md) into `protocols/`:
- a **Duty Menu**, one DList item per Assistant key under a shared header published by Nous, says what that key offers and the relay for each duty;
- an Assistant's **own Treasure Map** (a self-Map) says which duties it is actively publishing;
- the **self-pointing `b`** that the Duty Menu header relies on becomes normative;
- Treasure Maps settles the key-grammar questions the Duty Menu spec reads provisionally (story 4; owner, 2026-10-11);
- the rules that keep a self-Map true are settled (story 5; owner, 2026-10-12).

This is docs-mode work (`engineering-team/workflows/protocol-spec-workflow.md` § 3). The deliverables are `protocols/` prose and pointer edits, with no code, and Test Design is skipped for each story. The D2 vocabulary policy applies throughout (`docs/NIP_REORG_DESIGN_HANDOFF.md`).

## Stories

1. `stories/duty-menus-and-self-maps/1-ratify-self-pointing-b.md` — the self-pointing `b` (self-declared Shared Concepts) in `inherit-from.md`, with a pointer in `shared-concepts.md`.
2. `stories/duty-menus-and-self-maps/2-duty-menus-pre-nip.md` — the Duty Menus pre-NIP: `protocols/drafts/duty-menus.md`, its README row, and the worksheet W1 note. Depends on 1.
3. `stories/duty-menus-and-self-maps/3-self-maps.md` — Self-Maps in `treasure-maps.md` (self-entries create no duty, a new § 9.2, the relay as a hint with a read-time fallback, `duty-menu` and the Concept key, the counting rule), the narrowed sentence in `assistant-designation.md`, and the handoff flip. Depends on 2, because its relay fallback cites the Duty Menu spec. Carried forward from story 2's review rounds 1 and 3 and ADR 0002 Amendment A1:
   - Treasure Maps § 3's read-time relay fallback must cover:
     - an insight in a differing row's part (`duty-menus.md` § 6.2 step 4; A1-3). The Map entry that wins it carries a relay that is reachable but wrong for it, so the fallback must not fire only when element 3 is "empty or unreachable" (handoff § 5). When an insight is not found at element 3, a reader re-resolves it against A's current self-Map and Duty Menu;
     - an insisted key whose entry carries the empty string (A1-4);
     - a key whose Assistant has no menu found, which A1 leaves to the handoff's § 6 steps 3–4;
     - A's kind 10002 write relays, D3's fallback locator, as a last resort at read time;
     - its order against § 7's fallback to the next Alternate, which fires on the same "can't be found";
     - and `duty-menus.md` § 6.2 step 5 ("What the entry guarantees") and § 14 question 4 stop saying that Treasure Maps has no read-time resolution;
   - the new § 9.2 (Self-Maps) is what `duty-menus.md` § 10's pointer to Treasure Maps § 9 means, and § 9.2 points back at the Duty Menus spec (ADR 0002, Consequences). A self-entry for a key that A publishes at more than one relay needs an answer;
   - `39999:duty-menu` as a Concept key (§ 4.5, § 5.3) must never read as a menu. `duty-menus.md` § 4 already reserves `duty-menu` as the `d` of a kind-39999 menu (ADR 0002 sub-decision 2). Do not reserve it as a general Concept `d` (ADR 0002, Consequences). With it, `duty-menus.md` § 6.1: whether its conditions are sufficient, and what a reader does with an event that declares itself a header (ledger row `2026-10-11-duty-menus-spec-fold-forwards`, finding 16). The frame's "§ 4.6: `duty-menu` is reserved" is the story's open question 1;
   - the handoff's § 6 fill order keeps A's self-entry first (ADR 0002, Consequences of A1). Say how a self-entry composes with `duty-menus.md` § 6.2 step 5's insisted-key relay (finding 26). With it, findings 14 ("insight under K" means in principle, so the insisted-key relay does not move with supported sets) and 20 (the level of step 5's obligations, the no-guess rule included);
   - define "the observer's own Assistant" in `duty-menus.md` (§ 7's exception; finding 21);
   - the handoff's stale Status line, which the frame's flip replaces (finding 27). Handoff Q6 and the code plan in its §§ 6–8 get an open tracking surface first, since the flip takes the handoff off the open roll-up.
4. `stories/duty-menus-and-self-maps/4-treasure-map-key-grammar.md` — the Treasure Maps key grammar, and the Duty Menus spec's remaining wording. Not from the handoff: carried from ADR 0002 Amendment A1 and story 2's review round 3. Each grammar question is an owner decision. Follows 3, since both edit `duty-menus.md` § 6.2. The owner accepted the split at story 3's approval (2026-10-11): every "story 3" in ADR 0002's A1-8, A1-9 and A1-10, and in the lines that speak of them, means this story (recorded in ADR 0003), and `duty-menus.md`'s provisional readings (§ 6.2 step 1, § 14 questions 5–7) hold until it lands. The acceptance frame carries its bullet.
   - settle A1-8's two Concept readings (`39998:` and `39999:`; what a bare `39998` and a bare `39999` cover) and the order of `39998` and `39999` keys in Treasure Maps § 6, and say how `duty-menus.md` § 5.3 and § 6.2 follow. This is the owner's decision in ledger row `2026-10-09-draft-grammar-bare-39999` (provisionally answered by A1-8 for the Duty Menus spec, 2026-10-11). With it, finding 19: what is settled for a Map key `39998:` or `39999:` either way;
   - settle which List and Score kinds take the *DList headers* category (`39998`) in Treasure Maps § 4.3, in line with Content Categories § 1.3 and § 2, and say how `duty-menus.md` § 6.2 step 1 follows (A1-9; the spec reads `30393`, `30394` and `30397` meanwhile). With it, finding 18: whether replaceable kinds (0, 3, 10000–19999, referenced by `a` per NIP-01) count as "addressable" for `30394`;
   - restate Treasure Maps § 4.4's profiles bullet in the light of § 13 question 3: whether an empty category in a `30392` or `30382` key is the Profiles category, whether `30392:tag::` equals `30392:tag`, whether a profile kind gets a key for a Tag in every category, and whether an empty category in a family or `*` key reaches a profile kind's DList categories (per key, as the spec reads it meanwhile, or per insight); and say how `duty-menus.md` § 6.2 follows (A1-10);
   - the remaining wording items in `duty-menus.md` from ledger row `2026-10-11-duty-menus-spec-fold-forwards`, each with the change asked in story 2's review round 3: findings 12 and 13 (§ 6.2 steps 5 and 2), 15 (§ 8.1), 17 (§ 5.1, § 5.3), 22 (§ 5.1), 23 (§ 2, § 6.2 step 3, § 13.3) and 24 (§ 8.2);
   - so that each wire fact stays in one place (frame bullet 4): the sentences in `assistant-designation.md` and `trusted-lists.md` that say how a Concept key reads agree with Treasure Maps' answers or point at them;
   - the items that sit on the same text: items 3 (NB3), 8 and 15 of ledger row `2026-10-12-self-maps-spec-fold-forwards`, row `2026-10-12-self-maps-record-loose-ends`, and the spec and handoff texts of item 1 of row `2026-10-12-duty-menu-code-cross-book-notes`. Where the Self-Maps row's other items go is the story's open question 5, recorded here at its approval.
5. `stories/duty-menus-and-self-maps/5-self-map-upkeep.md` — the rules that keep a self-Map true. Items 5, 9, 10, 12, 13, 19 and 20 of ledger row `2026-10-12-self-maps-spec-fold-forwards`, and the § 5.4 Enumerate question (ADR 0003 A2's Consequences), each with the change asked in story 3's reviews. Among them: what happens to curation copies when an Assistant stops (item 10; ADR 0003 A2 had placed it with story 4's ADR, and the owner moved it here at story 4's approval), and whether a List that is still maintained but has no members carries the retraction marker (item 19). The row closes with this story. Owner, 2026-10-12 (story 4, answer 5 (a)). With item 19, the story asks whether Treasure Maps § 7 keeps ADR 0003 A2-1's reading of a retraction that a self-Map still claims. The story proposes taking two more sets of items: the two that story 4 added to that row, and ledger row `2026-10-12-key-grammar-review-fold-forwards`. It places ADR 0004's two `protocol` rows in a later docs pass after the book. The owner decides at approval, and this entry then records the answers to the story's open questions 2, 4 and 5.

## Not on this epic's path

Any code: publishing menus and self-Maps, `/treasure-map`, the empty-relay fix (OPEN.md row `2026-10-10-external-assistant-relay-left-empty`). Those come in a later book. Also not here: the handoff's open questions Q4–Q7, unless a story's gate settles one.
