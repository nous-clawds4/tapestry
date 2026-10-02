# The normalize API and the brain find concepts by their singular name, so renaming or duplicating a concept's name breaks what looks it up

**Id:** 2026-10-02-normalize-lookups-by-concept-name
**Type:** bug
**Opened:** 2026-10-02 (Dictionary: Edit a concept; its review S1)
**Status:** OPEN
**Done:** —

**What was seen.** About twenty Cypher lookups resolve a concept by its name (`h.name = $concept … LIMIT 1`, or the
same with `$name`): 19 in `src/api/normalize/index.js`, one in `src/api/property/index.js` and one in
`src/firmware/install.js`, at the edit-concept branch. Find them with `git grep -n 'h\.name = \$' -- src`.

Their callers pass names:
- the brain's `*_CONCEPT_NAME` constants: `tapestry owner goal`, `tapestry external resource`, `tapestry work
  record`, `tapestry proposal`, `tapestry priority signal`, and others;
- literal `concept:` names from the UI: `shared concept` and `goal set`;
- the audit's core concepts: `superset`, `set`, `property`, `relationship`.

A concept's name is a label, but here it works as its identity. Renaming one of these concepts, even just changing
its case, makes every lookup fail with "Concept … not found". The `ensure*` paths can then re-provision the header
at the same d-tag and silently undo the rename. Two concepts with the same name make `LIMIT 1` pick either one.

**What is already closed.** Edit a concept (`POST /api/dictionaries/concepts/edit`) refuses:
- a singular-name change for the names in `NAME_KEYED_CONCEPTS`, and a rename of any concept onto one of them (`src/lib/conceptHeaderEdit.js`, kept in step with
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
