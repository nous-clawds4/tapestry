# A Treasure Map entry that names the Map's own author counts as "another Assistant", so the hub shows it Done, Shared

**Id:** 2026-10-11-self-entry-reads-as-another-assistant
**Type:** feature
**Opened:** 2026-10-11 (`assistant-shared-categories` #1, Gate B review, non-blocking 2)
**Status:** OPEN
**Done:** —

**What was seen.** The category rule never compares a delegate with the Map's author:
- The rule is `categoryAssistants` in `src/lib/treasureMapCategories.mjs`, which both `/treasure-map`'s cards and the
  hub's check read.
- So a viewer whose Treasure Map gives a category to their own main key gets **Done** and **Shared** on `/assistant`,
  with "Handled by another Assistant · Move it here →".
- That comes from `evaluateTrustedContent`'s `shared` in `src/api/assistant/trustedContent.js`.
- Before `assistant-shared-categories` #1, the same Map read **Needs attention** (`other-assistants-only`).

This is the rule as both surfaces read it today, and that story's AC-1 asked for exactly that reading, so it is not
that story's defect. But the self-maps draft, which is not ratified, says such an entry "creates no duty and
designates no one" (`protocols/drafts/treasure-maps.md`, as of `05225a6`). Book `duty-menus-and-self-maps` #3 is
settling that.

**Fix shape.** When the self-maps rule reaches code, teach `categoryAssistants` (or its callers) about self-entries
once. Then `/treasure-map`'s cards and the hub's Scores/Lists/Concepts check change together, and the hub keeps one
reading of the Map. Re-aim `test/assistant-shared-categories.test.js` and `test/assistant-trusted-content.test.js` with
it.

**Pointer:** `engineering-team/reviews/done/assistant-shared-categories/1-done-but-shared.md` § Findings, non-blocking 2;
book `duty-menus-and-self-maps` (its `_intake.md` entry from `05225a6`).
