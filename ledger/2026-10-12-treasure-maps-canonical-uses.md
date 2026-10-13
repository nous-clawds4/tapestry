# `treasure-maps.md` still uses "canonical" in text that book duty-menus-and-self-maps did not add or change

**Id:** 2026-10-12-treasure-maps-canonical-uses
**Type:** docs
**Opened:** 2026-10-12 (`duty-menus-and-self-maps` #5, ADR 0005 sub-decision 10; story 5, After this story)
**Status:** OPEN
**Done:** —

Book `duty-menus-and-self-maps` read its frame's "Throughout: no 'canonical' or 'consensus' in normative text" as
covering only the text the book adds or changes, and the owner confirmed that reading at story 5's approval. So the
`canonical` uses already in `protocols/drafts/treasure-maps.md` were left as they are:
- "canonical naddr" and "canonical nevent" in §§ 1, 2, 4.1, 4.3 and 11 (§ 4.1 also has "canonicalize");
- the metadata's "Canonical" field.

**Fix shape:** a later doc-lane pass decides, use by use, whether to reword. Whether "canonical naddr" falls under
handoff D2 (`docs/NIP_REORG_DESIGN_HANDOFF.md`) is that pass's call.

**Pointer:** story `engineering-team/stories/done/duty-menus-and-self-maps/5-self-map-upkeep.md` (After this story; AC5);
ADR `engineering-team/decisions/done/duty-menus-and-self-maps/0005-self-map-upkeep.md` sub-decision 10; related rows
`2026-10-10-self-declared-canonical-wording` and `2026-10-11-tapestry-concepts-namespace-wording`.

**Note, 2026-10-13 (book close `duty-menus-and-self-maps`).** ADR `duty-menus-and-self-maps/0003` (Out of scope) also
left out "existing 'root' text" in `treasure-maps.md`, and no row named it. The one use is § 8's "the root rule"
(Spawning § 3.3's name for the support-gate exemption), which names a rule, not a privileged concept. The same pass
can confirm that and close it.
