# Specs outside inherit-from still say "self-declared canonical" and point at the amendments proposal for the self-pointing `b`

**Id:** 2026-10-10-self-declared-canonical-wording
**Type:** docs
**Opened:** 2026-10-10 (`duty-menus-and-self-maps` #1, review PASS; ADR 0001 § Consequences)
**Status:** OPEN
**Done:** —

`duty-menus-and-self-maps` #1 made the self-pointing `b` normative in `protocols/drafts/inherit-from.md` § "The `b` tag"
(Self-declaration), worded under the D2 vocabulary policy (`docs/NIP_REORG_DESIGN_HANDOFF.md`: no "canonical" in
normative text). The story's scope guard (AC5) kept every other `protocols/` file untouched, so these remain:

- **D2 slips, "self-declared canonical":**
  - `protocols/drafts/dlist-header-declaration.md` § 4, "The community version";
  - `protocols/drafts/trust-determination-methods.md` § 2, two table rows;
  - the `amendments-2026-09.md` § 1 table (a proposal file, so the lowest priority).
- **Stale source pointers.** These cite "Protocol amendments § 3" for the self-pointing `b`; they should point to
  `inherit-from.md` § "The `b` tag" instead:
  - `dlist-header-declaration.md` § 4;
  - `trust-determination-methods.md` (its metadata);
  - `content-categories.md` (the seeded-concepts sentence).

  The amendments pointer still resolves (§ 3 now forwards), so nothing is broken.

Non-blocking wording notes from the same review and its accuracy audit, worth folding into the same doc-lane pass:
- `inherit-from.md` metadata, the Implementation clause, names only `composeSelfDeclare`. Concept Headers' Submit
  (`src/api/concept/selfDeclare.js`) and Create New Concept with no target (`src/api/adoption/newConcept.js`) write the
  same tag inline.
- The Self-declaration paragraph says "a pointer-typed `b`, or one with no type". The same section also reads an
  *unknown* element 3 as pointer, so "or one whose type reads as pointer" would be exact.
- "nothing defers to itself" reads as a wire fact, but `["b", <self>, "inherit"]` is expressible. ADR 0001 left that case
  out of scope; "a self-declaration asserts no deference" says what is meant.
- `shared-concepts.md` § Declared affiliation: "the third state beside *wired*" reads as exclusive, but `dispositionOf`
  can report wired and self-declared together.

Fix shape: one doc-lane pass (Implementer + Reviewer, non-numbered review). It can run after the
`duty-menus-and-self-maps` book, or ride its story 2 or 3 if one of them touches these files anyway.

**Pointer:** `engineering-team/reviews/duty-menus-and-self-maps/1-ratify-self-pointing-b.md` § Findings;
`engineering-team/decisions/duty-menus-and-self-maps/0001-self-declaration-in-the-b-tag-section.md` § Consequences.
