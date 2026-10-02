# The normalize API and the brain find concepts by their singular name, so renaming or duplicating a concept's name breaks what looks it up

**Id:** 2026-10-02-normalize-lookups-by-concept-name
**Type:** bug
**Opened:** 2026-10-02 (Dictionary: Edit a concept; its review S1)
**Status:** OPEN
**Done:** —

**What was seen.** Twelve Cypher lookups in `src/api/normalize/index.js` resolve a concept by
`h.name = $concept … LIMIT 1`. They are at lines 1772, 1917, 2032, 2180, 2447, 2744, 3071, 3415, 3582, 4720, 5135
and 5268 at the edit-concept branch.

Their callers pass names:
- the brain's `*_CONCEPT_NAME` constants: `tapestry owner goal`, `tapestry external resource`, `tapestry work
  record`, `tapestry proposal`, `tapestry priority signal`, and others;
- literal `concept:` names from the UI: `shared concept` and `goal set`;
- the audit's core concepts: `superset`, `set`, `property`, `relationship`.

A concept's name is a label, but here it works as its identity. Renaming one of these concepts, even just changing
its case, makes every lookup fail with "Concept … not found". The `ensure*` paths can then re-provision the header
at the same d-tag and silently undo the rename. Two concepts with the same name make `LIMIT 1` pick either one.

**What is already closed.** Edit a concept (`POST /api/dictionaries/concepts/edit`) refuses:
- a singular-name change for the names in `NAME_KEYED_CONCEPTS` (`src/lib/conceptHeaderEdit.js`, kept in step with
  the code's literal names by `test/dictionary-edit-concept.test.js` L10);
- any rename onto another of the Assistant's concepts' names.

**Still open:**
- **Every other path that can rename a graph concept:** Normalize JSON, a firmware reinstall, and a hand-published
  header.
- **The lookups themselves.**

**Fix shape.** Resolve concepts by their header's address, `39998:<TA>:<slug>`, through the runtime TA pubkey (the
brain's `src/api/brain/index.js` already does this with `*_CONCEPT_SLUG`). Pass slugs, not names, from the UI and
the audit. Then the rename guard can go, apart from the duplicate-name rule, if names stay unique for display.

**Pointer:** the review of the Edit a concept change, S1; `docs/DICTIONARY_PAGE_HANDOFF.md` § "Edit a concept".
