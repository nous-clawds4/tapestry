# Epic: duty-menus-and-self-maps

**Created:** 2026-10-10
**Status:** Active
**Book:** `engineering-team/audits/duty-menus-and-self-maps/book.md`

## Goal

Ratify the design in [`docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md`](../../docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md) into `protocols/`:
- a **Duty Menu**, one DList item per Assistant key under a shared header published by Nous, says what that key offers and the relay for each duty;
- an Assistant's **own Treasure Map** (a self-Map) says which duties it is actively publishing;
- the **self-pointing `b`** that the Duty Menu header relies on becomes normative.

This is docs-mode work (`engineering-team/workflows/protocol-spec-workflow.md` § 3). The deliverables are `protocols/` prose and pointer edits, with no code, and Test Design is skipped for each story. The D2 vocabulary policy applies throughout (`docs/NIP_REORG_DESIGN_HANDOFF.md`).

## Stories

1. `stories/duty-menus-and-self-maps/1-ratify-self-pointing-b.md` — the self-pointing `b` (self-declared Shared Concepts) in `inherit-from.md`, with a pointer in `shared-concepts.md`.
2. `stories/duty-menus-and-self-maps/2-duty-menus-pre-nip.md` — the Duty Menus pre-NIP: `protocols/drafts/duty-menus.md`, its README row, and the worksheet W1 note. Depends on 1.
3. *(planned)* Self-Maps in `treasure-maps.md`, and the narrowed sentence in `assistant-designation.md`. Depends on 2, because its relay fallback cites the Duty Menu spec. Carried forward from story 2's review round 1 and ADR 0002 Amendment A1:
   - Treasure Maps § 3's read-time relay fallback must cover:
     - an insight in a differing row's part (`duty-menus.md` § 6.2 step 4; A1-3). The Map entry that wins it carries a relay that is reachable but wrong for it, so the fallback must not fire only when element 3 is "empty or unreachable" (handoff § 5). When an insight is not found at element 3, a reader re-resolves it against A's current self-Map and Duty Menu;
     - an insisted key whose entry carries the empty string (A1-4);
     - a key whose Assistant has no menu found, which A1 leaves to the handoff's § 6 steps 3–4;
     - A's kind 10002 write relays, D3's fallback locator, as a last resort at read time;
   - the new § 9.2 (Self-Maps) is what `duty-menus.md` § 10's pointer to Treasure Maps § 9 means;
   - `39999:duty-menu` as a Concept key (§ 4.5, § 5.3) must never read as a menu. Do not reserve `duty-menu` as a general Concept `d` (ADR 0002, Consequences);
   - settle A1-8's two Concept readings (`39998:` and `39999:`; what a bare `39998` and a bare `39999` cover) and the order of `39998` and `39999` keys in Treasure Maps § 6, and say how `duty-menus.md` § 5.3 and § 6.2 follow. This is the owner's decision in ledger row `2026-10-09-draft-grammar-bare-39999`.
   - settle which List and Score kinds take the *DList headers* category (`39998`) in Treasure Maps § 4.3, in line with Content Categories § 1.3 and § 2, and say how `duty-menus.md` § 6.2 step 1 follows (A1-9; the spec reads `30393`, `30394` and `30397` meanwhile);
   - restate Treasure Maps § 4.4's profiles bullet in the light of § 13 question 3: whether an empty category in a `30392` or `30382` key is the Profiles category, whether `30392:tag::` equals `30392:tag`, whether a profile kind gets a key for a Tag in every category, and whether an empty category in a family or `*` key reaches a profile kind's DList categories (per key, as the spec reads it meanwhile, or per insight); and say how `duty-menus.md` § 6.2 follows (A1-10).

## Not on this epic's path

Any code: publishing menus and self-Maps, `/treasure-map`, the empty-relay fix (OPEN.md row `2026-10-10-external-assistant-relay-left-empty`). Those come in a later book. Also not here: the handoff's open questions Q4–Q7, unless a story's gate settles one.
