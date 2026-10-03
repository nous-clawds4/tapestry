# The Dictionary's Edit page shows no `field-type` tags: it can't add one, and removing a property leaves its `field-type` behind

**Id:** 2026-10-02-edit-concept-field-type
**Type:** feature
**Opened:** 2026-10-02 (Dictionary: Edit a concept, #811; seen fixing staging's GitHub Account)
**Status:** OPEN
**Done:** —

**What was seen.** Some shared headers pair an Item Property Tag with a type: `["required","github-username"]`
and `["field-type","github-username","text"]`. On the community relay, 10 of 384 headers carry `field-type`.

The Edit page (`ui/src/pages/dictionary/EditConcept.jsx`, rule `src/lib/conceptHeaderEdit.js`) edits only
`required` / `optional` / `recommended`. It keeps every other tag untouched, so:
- a `field-type` can't be added: the owner could add the GitHub Account's `required`, but not its
  `field-type`, until Re-Sync (#815) did it;
- removing a property leaves its `field-type` orphaned.

**Fix shape:**
- Show each property's `field-type` beside it on the Edit page. Let the person set or change it when adding a
  property, and remove it with the property.
- Teach `composeEdit` the pairing, with tests.
- Decide whether an orphaned `field-type` (no matching property) is shown or dropped.

**Pointer:** `docs/DICTIONARY_PAGE_HANDOFF.md` § "Edit a concept".
