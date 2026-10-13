# Book of Work: Duty Menus and Self-Maps — ratify the specs

**Slug:** duty-menus-and-self-maps
**Status:** Closed
**Opened:** 2026-10-10
**Closed:** 2026-10-13

## Intent anchor

**Acceptance frame (no PRD).** The scoping capture is [`docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md`](../../../docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md) (decisions D1–D10, the § 4–§ 5 shapes, the § 8 ratification plan). This book realizes its ratification: docs-mode under the Protocol-Spec workflow, Test Design skipped for every story.

### Acceptance frame

Confirmed by the owner at kickoff, 2026-10-10.

- [x] The self-pointing `b` is normative in `inherit-from.md`, with a one-line pointer in `shared-concepts.md`, and `amendments-2026-09.md` § 3 is marked applied.
  *Met (story 1):* `inherit-from.md`:38, `shared-concepts.md`:39, `amendments-2026-09.md`:35–37 (audit §1).
- [x] `protocols/drafts/duty-menus.md` exists and is indexed in `protocols/README.md`. It covers the handoff's D4, D5 and D7–D10 and its § 4 shapes.
  *Met (story 2, ADR 0002 with A1):* `protocols/README.md`:73; three shapes changed by ADR 0002 (audit §4 #1).
- [x] `treasure-maps.md` covers Self-Maps:
  - § 9: self-entries create no duty;
  - a new § 9.2;
  - § 3: the relay in a Map is a hint, with a read-time fallback;
  - § 4.6: `duty-menu` is reserved;
  - § 7: a confirmed Backup is a ready standby;
  - § 13 Q5: an Assistant skips Maps it wrote itself;
  - the counting rule.

  `assistant-designation.md`'s "A TA cannot designate itself" is narrowed.

  *Met (story 3, ADR 0003 with A1 and A2):* `treasure-maps.md`:78, :84–90, :202–204, :322, :346, :361, :439, :649;
  `assistant-designation.md`:52. "Reserved" is read as the owner's answer 1(a) (audit §4 #4).
- [x] Each wire fact is normative in exactly one place, links resolve, the worksheet W1 note is in, and the handoff flips to ✅ SUPERSEDED.
  *Met:* reviews 4 and 5 (one place per fact); 235 relative links, none broken (audit §1); `protocols/worksheet.md`:21;
  the handoff's Status line.
- [x] *(Added by the owner, 2026-10-11, at story 3's approval.)* `treasure-maps.md` settles the three key-grammar questions `duty-menus.md` reads provisionally (ADR `duty-menus-and-self-maps/0002` A1-8, A1-9, A1-10: the bare Concept kinds and their order, category `39998`, the profiles category slot), `duty-menus.md` follows, and ledger row `2026-10-11-duty-menus-spec-fold-forwards` is closed (story 4).
  *Met (story 4, ADR 0004):* `treasure-maps.md` §§ 4.3–4.5 and 6; `duty-menus.md` § 14 questions 5–7 resolved; the row
  is DONE.
- [x] *(Added by the owner, 2026-10-12, at story 4's approval.)* The rules that keep a self-Map true are settled: items 5, 9, 10, 12, 13, 19 and 20 of ledger row `2026-10-12-self-maps-spec-fold-forwards` (among them what happens to curation copies when an Assistant stops, and whether a List that is still maintained but has no members carries the retraction marker) and the § 5.4 Enumerate question, and that row is closed (story 5).
  *Met (story 5, ADR 0005):* the row is DONE, and its closing note gives each item's landing (audit §1).

Throughout: no "canonical" or "consensus" in normative text (`docs/NIP_REORG_DESIGN_HANDOFF.md` D2). *(The owner
confirmed at story 5's approval, 2026-10-12, that this covers only text the book adds or changes. Met for that text;
the older uses are on ledger row `2026-10-12-treasure-maps-canonical-uses`.)*

**Done looks like:** every story passes review and is on `staging`, and the handoff is ✅ SUPERSEDED.

**Not in this book (owner, 2026-10-10):** code. Publishing menus and self-Maps, the `/treasure-map` changes and the fix for OPEN.md row `2026-10-10-external-assistant-relay-left-empty` are a separate book, opened after this one.

## Epics in this book
- `duty-menus-and-self-maps` — ratify Duty Menus and Self-Maps into `protocols/` (stories 1–5).

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** high for the record. Limits: the specs are pre-NIP drafts no one outside this repo has
  read; code follows them only in part; `d234c066` and the close ride the close push (audit header).

## Close artifacts *(filled by `/close-book`)*

- Build audit: [`audit.md`](./audit.md)
- Product feedback: [`prd-seed.md`](./prd-seed.md)
- Epic `duty-menus-and-self-maps`: Done; its story, ADR and review folders are under `done/` (audit §8).
