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
3. *(planned)* Self-Maps in `treasure-maps.md`, and the narrowed sentence in `assistant-designation.md`. Depends on 2, because its relay fallback cites the Duty Menu spec. Carried forward from story 2's review round 1:
   - the read-time relay fallback (§ 3) must cover `duty-menus.md` § 6.2's "partly offered" case, where a client writes a scope entry and leaves per-insight relays to read-time resolution;
   - the new § 9.2 (Self-Maps) is what `duty-menus.md` § 10's pointer to Treasure Maps § 9 means;
   - `39999:duty-menu` as a Concept key (§ 4.5, § 5.3) must never read as a menu. Do not reserve `duty-menu` as a general Concept `d` (ADR 0002, Consequences).

## Not on this epic's path

Any code: publishing menus and self-Maps, `/treasure-map`, the empty-relay fix (OPEN.md row `2026-10-10-external-assistant-relay-left-empty`). Those come in a later book. Also not here: the handoff's open questions Q4–Q7, unless a story's gate settles one.
