# Story 2's review round 3 left non-blocking wording gaps in the Duty Menus spec

**Id:** 2026-10-11-duty-menus-spec-fold-forwards
**Type:** protocol
**Opened:** 2026-10-11 (`duty-menus-and-self-maps` #2, review round 3, non-blocking 12–24, 26 and 27)
**Status:** DONE
**Done:** 2026-10-12 (`duty-menus-and-self-maps` #4, ADR 0004): the last items landed in story 4.

Story 2 (the Duty Menus pre-NIP) passed review round 3. Its non-blocking findings target
`protocols/drafts/duty-menus.md`, which story 3 of the epic edits anyway (its carry-forwards say how § 5.3 and § 6.2
follow Treasure Maps). None changes a Map entry for a well-formed menu read as the spec intends, outside what open
question 5 already leaves to Treasure Maps (finding 19); each is a place where
two careful implementers could read the text differently, or where a sentence says more than holds. The epic's
story-3 list (`engineering-team/epics/duty-menus-and-self-maps.md`) does not yet carry them.

Fold into story 3 (or a doc-lane pass on the spec), each with the asked change in the review:
- § 6.2 lead or step 4: "insight under K" in steps 2–5 always means in principle (Treasure Maps § 8), never the
  observer's supported sets. Otherwise rows within K, and so the insisted key's relay, vary with supported sets
  (finding 14).
- § 6.2 step 2: "the same row answers for every insight under K" → "among the covering rows, the same one is the most
  specific for every insight under K" (finding 13).
- § 6.2 step 5, second "no substitute" example: "changes nothing" → "changes nothing under K"; the key may take
  insights outside K from other entries (finding 12).
- § 6.2 step 5: mark the level of its plain obligations (list every row within K; offer the meet; no guess for an
  empty relay) (finding 20).
- § 6.2: for a Map key `39998:` or `39999:`, the covering rows and the answering row are the same under either
  reading, so the entry is the same when the answering row is a `duty` row. The rows within K, and so an insisted
  key's relay and the differing-row listing, wait on Treasure Maps (open question 5) (finding 19).
- § 6.1: say whether its four conditions are sufficient, and what a reader does with an event that breaks § 4's MUST
  NOT on a header-declaring `z`. Since round 3, § 8.1 and § 8.2 decide "which version counts" by § 6.1 (finding 16).
  Pairs with the epic's `39999:duty-menu` bullet.
- § 5.1/§ 5.3: whether an ignored `duty` row takes part in the duplicate check; which `json` tag counts when there are
  several (finding 17).
- § 6.2 step 1 / Treasure Maps § 4.3: whether replaceable kinds (0, 3, 10000–19999, referenced by `a` per NIP-01) count
  as "addressable" for `30394`. Add it to the epic's A1-9 bullet (finding 18).
- § 8.1: "a relay, too, returns only the latest version" → SHOULD (NIP-01 `01.md:103`) (finding 15).
- § 7: define "the observer's own Assistant" (pairs with open question 3 and with Self-Maps) (finding 21).
- § 5.1: "still names a provider" → "still names an Assistant" (§ 2 defines Provider otherwise) (finding 22).
- § 2/§ 6.2: "Offered" vs "partly offered" for `3038x` in § 13.3 (finding 23).
- § 8.2: say where to send the `#z` query (finding 24).
- The handoff's § 6 fill order keeps A's self-entry first (ADR 0002, Consequences of A1). Say how a self-entry
  composes with § 6.2 step 5's insisted-key relay ("no relay is known") (finding 26).

Also (finding 27): `docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md`'s Status line still says "nothing landed in `protocols/` yet",
stale since story 1. The book's last frame bullet flips it to ✅ SUPERSEDED at the end; until then a reader of the
Status line is misinformed.

- *Added 2026-10-11 (story 3, ADR 0003 A1-2):* Duty Menus § 2's "the observer's own Assistant" says "its own key
  included". After ADR 0003 A1-2 no fill rule reaches a self-entry, so that clause applies nowhere. Harmless; story 4
  either drops it or says why it stays.

**Pointer:** `engineering-team/reviews/done/duty-menus-and-self-maps/2-duty-menus-pre-nip.md` § Round 3 → Findings
(round 3), non-blocking 12–24, 26 and 27; `engineering-team/epics/duty-menus-and-self-maps.md` (story 3's list).

**Note, 2026-10-11 (story 3, ADR `duty-menus-and-self-maps/0003`).** Story 3 handled findings 14, 16, 20, 21 and 26,
and 27 (the handoff's Status line). Findings 12, 13, 15, 17, 18 (with A1-9), 19 (with A1-8), 22, 23 and 24 went to
story 4 of the epic (owner, 2026-10-11, story 3's open question 2(a)). The row stays OPEN until story 4 lands.

**Note, 2026-10-12 (story 4, ADR `duty-menus-and-self-maps/0004`).** The items left for story 4 landed there:
- findings 12, 13, 15, 17, 22, 23 and 24 in Duty Menus, as story 4's AC5 asks: 12 in § 6.2 step 5; 13 in step 2; 15 in
  § 8.1; 17 in § 5.3, § 5.4 and § 4; 22 in § 5.1; 23 in § 2, steps 3 and 4, and § 13.3; 24 in § 8.2 and § 4;
- finding 18 in Treasure Maps § 4.3, where a replaceable kind counts as addressable, which Duty Menus § 6.2 step 1
  follows;
- finding 19 in Treasure Maps § 4.5, where a Map key `39998:` or `39999:` is not a key, and in Duty Menus § 6.2 step
  1's last bullet;
- the "its own key included" note in § 2, which drops the clause.

The title no longer names story 3 (story 3's review, CONF-4). DONE.
