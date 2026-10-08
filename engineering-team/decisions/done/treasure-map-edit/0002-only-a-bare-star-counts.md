# ADR 0002: Only a bare `*` counts; the family-word rule and segment coverage come out

**Status:** Accepted
**Date:** 2026-10-07
**Story:** `engineering-team/stories/done/treasure-map-edit/2-the-cards-ignore-scoped-star-entries.md`
**Supersedes in part:** ADR treasure-map-edit/0001 sub-decisions 2 (the `*` branch of "which categories an entry
reaches") and 3 (when a `*` entry is hidden)

## Context

The owner decided that, for now, the page ignores an everything entry that goes beyond `*` (book decision 11). Story 2's
acceptance criteria, in short:

- **AC-1:** a `*:…` entry that names anything after the `*` (a system word, a category, a Tag, a metric, or an empty
  slot followed by more) counts on no card.
- **AC-2:** `*` followed only by empty slots (`*:`, `*::`) is still a plain `*`.
- **AC-3:** an ignored entry changes nothing else: it hides no entry and isn't a backup of a plain `*`.
- **AC-4:** everything without such an entry is unchanged; one example of manage-treasure-map #2 AC-2 changes (`*:tag`
  → D alone), and story 1's AC-1 and AC-2 rows that name a `*:…` entry are replaced.
- **AC-5:** the draft grammar's § 13 gains an open question about whether `*:<scope>` is needed, and says Brainstorm
  reads only a bare `*` for now.

**Concept Graph:** the stack wasn't running (AGENTS.md § 2 fallback). No concept changes. **Firmware reinstall: not
required.**

Facts from the code this decision rests on (`ui/src/pages/treasure-map/manageTreasureMap.js`, as story 1 left it):

- `entryOf` (line 115) gives every valid entry `segments` (non-Concept keys, empty trailing segments dropped) and a
  folded `norm`. Story 2 still needs both: the fold makes `*:` a plain `*` (AC-2), and grouping by `norm` keeps
  `*` and `*:` one key (story 1 AC-3).
- `appliesTo` (line 139) reads a `*` entry's first segment against `BOTH_FAMILIES` (line 106) and `contexts`. Under
  decision 11, every `*` entry with a segment reaches nothing, so that whole branch has one answer.
- `shadowed` (line 168) hides a `*` entry behind a family entry that `covers` it (line 158), segment by segment. Once
  only a bare `*` can count, the only covering family entry is a bare one: a family entry with any named segment never
  covers an entry with no segments. So `covers` reduces to "the family entry is bare".
- Nothing else in the app reads this rule: `categoryAssistants` is imported only by `ui/src/pages/treasure-map/
  Index.jsx:9`.
- **Prototype check:** a scratchpad copy of the module with sub-decisions 1–3 below (not committed):
  - passes every row of story 2's three tables;
  - changes exactly these existing tests, all on `*:…` entries:
    - `test/treasure-map-card-rule-edges.test.js`: H6, H7, H8, F1–F5, X3, X6, X7 and X10;
    - `test/manage-treasure-map-cards.test.js`: K9 and K16 (all four of its cases);
  - leaves every other test in both suites passing.

## Options considered

### Option A — a `*` entry with any segment reaches no category; remove what that makes dead (chosen)

`appliesTo` returns false for a `*` entry whose `segments` aren't empty. `BOTH_FAMILIES`, the word branch and `covers`
go. `shadowed` checks only a bare `*`, against one set of every valid entry's `norm`.

- **Pros:** the rule says what the owner decided, in the function that decides which categories an entry reaches. The
  rule gets smaller, which is the point of doing this before Edit mode builds on it. `entryOf` keeps meaning "a valid
  entry", so a `*:…` entry with a valid delegate is a valid entry the page doesn't support, not a broken one.
- **Cons:** if support for `*:…` comes back, its reading has to be rebuilt; story 1's commit (`c60a3ac`) keeps a worked
  version to start from.

### Option B — keep story 1's machinery and add a gate in front of it

Add the same early return to `appliesTo`, but leave `BOTH_FAMILIES`, the word branch and `covers` in place.

- **Pros:** the smallest diff; support could come back by deleting one line.
- **Cons:** dead code that reads as live behaviour. A reader, or Edit mode's Architect, would take the family-word rule
  and partial coverage as how the page counts. "Support may come later" doesn't say it will come back as story 1
  shaped it.

### Option C — drop `*:…` entries when parsing

`entryOf` returns null for a `*` key with segments, as it does for an invalid delegate.

- **Pros:** the shortest change; the rest of the rule never sees such entries.
- **Cons:** it merges "unsupported" into "invalid". The outputs are the same today. But Edit mode will need to tell a
  valid entry it should keep and not count from a broken one, for example when it counts "individually assigned
  duties" or explains what an override switch removes.

## Decision

We chose **Option A**. It puts decision 11 where categories are decided, removes the code the decision makes dead, and
keeps "valid" and "supported" apart for Edit mode.

Sub-decisions:

1. **Which categories an entry reaches** (`appliesTo`; supersedes ADR 0001 sub-decision 2's `*` branch). Five-digit
   kinds, `3038x…` and `3039x…` are unchanged. A `*` entry reaches Scores, Lists and Concepts when its `segments` are
   empty (`*`, `*:`, `*::`), and no category otherwise. `BOTH_FAMILIES` and the system-word branch are removed.
2. **When a `*` entry is hidden** (`shadowed`; supersedes ADR 0001 sub-decision 3). Only a bare `*` can count, so
   only it is ever hidden, and only by an entry with a valid delegate:
   - Scores, when some entry's `norm` is `3038x` (`3038x`, `3038x:`, `3038x::`);
   - Lists, when some entry's `norm` is `3039x`;
   - Concepts, when some entry's `norm` is `39998` (`39998` or `39998:dlist-header`), as before.

   `covers` is removed. `categoryAssistants` builds one `Set` of every valid entry's `norm` in place of `families` and
   `conceptNorms`.
3. **Unchanged:** `entryOf` (validity, `concept`, `segments`, `norm`), grouping by `norm`, first valid delegate per key,
   Map order without repeats, three empty lists for garbage, never throwing (ADR 0001 sub-decisions 1 and 4).
4. **The draft grammar's open question** (AC-5). Add item 12 to `protocols/drafts/treasure-maps.md` § 13, in the
   section's style. The Implementer may tighten the words but keeps the three points:

   > 12. **Is `*:<scope>` needed?** A `*:…` key never reaches a Concept (§ 4.5), so `*:<scope>` reaches exactly what
   > `3038x:<scope>` and `3039x:<scope>` reach together. Dropping it would leave a bare `*` as the only key for
   > everything, and remove the precedence cases between a family key and a `*` key with the same scope (§ 6). For
   > now, Brainstorm's Treasure Map page reads only a bare `*` (`*:` with nothing after it is the same key) and
   > ignores any other `*:…` entry.

   Nothing else in the draft changes. The boundary rule (`protocols/README.md`) keeps deployment history out of specs,
   so the item names the one implementation's current choice as context for the question and nothing more.
5. **Pointers, written with this ADR's commit on acceptance:**
   - ADR 0001 gets a Status parenthetical and a "Superseded in part" note naming sub-decisions 2–3 and this ADR;
   - ADR manage-treasure-map/0002's existing note gets one sentence: since this ADR, a `*:…` entry that names anything
     after the `*` counts for no category;
   - story 1 gets a one-line "Replaced in part" note naming its AC-1 and AC-2 rows that name a `*:…` entry, and
     story 2.

## Consequences

- **Enables:** Edit mode builds on a smaller rule. A bare family entry is the only thing that hides a bare `*`, and a
  `*:…` entry is never a duty, so it's never one an override switch removes (book decision 11).
- **Constrains:** supporting `*:…` again means designing its reading again (story 1's `c60a3ac` is a starting point,
  and finding 1's ledger row records the case it missed).
- **Settles:** ledger `2026-10-07-card-rule-star-metric-reaches-lists`: such entries are now ignored. Flipped to DONE
  when this story's review passes.
- **Debt, unchanged:** two parsers read 10040 keys until the draft grammar is ratified (ADR manage-treasure-map/0002).
- **Firmware reinstall required?** No.

## Implementation notes

- **`ui/src/pages/treasure-map/manageTreasureMap.js`**, the only source file that changes:
  - `appliesTo`: the `*` case returns `segments.length === 0` (sub-decision 1);
  - remove `BOTH_FAMILIES` and `covers`;
  - `shadowed(category, entry, norms)`: false unless `entry.norm === '*'`; then `norms.has('3038x' | '3039x' |
    '39998')` by category (sub-decision 2);
  - `categoryAssistants`: `const norms = new Set(entries.map((e) => e.norm))`, passed to `shadowed`;
  - update the section comment and the JSDoc of `appliesTo`, `shadowed` and `categoryAssistants` to cite this ADR and
    book decision 11. The module stays free of React, `fetch`, signing and storage, and Node-loadable.
- **`protocols/drafts/treasure-maps.md`** § 13: item 12 (sub-decision 4).
- **Docs** (sub-decision 5), with this ADR's commit on acceptance.
- **For the Tester (Phase 3):**
  - **New:** every row of story 2's three tables (AC-1 to AC-3), and a light check that the draft's § 13 carries the
    question (it names `*:<scope>`, `3038x:<scope>` and `3039x:<scope>`, and a bare `*`), for AC-5.
  - **Re-aim, and record the re-aims in the test plan:**
    - in `test/treasure-map-card-rule-edges.test.js`, H6, H7, H8, F1–F5, X3, X6, X7 and X10, whose `*:…` entries now
      count nowhere (rename the F class's intent too);
    - in `test/manage-treasure-map-cards.test.js`, K9 and K16. Those names describe the old rule, so rename or re-word
      them, citing story 2.
  - **Browser:** no new spec. Update the stale comment above `MAIN` (`tests/brainstorm/manage-treasure-map-cards.spec.js:55–56`,
    and the class note at line 19): `*:tag` → D is now ignored, not hidden. The cards it pins don't change.
  - **Must stay green unchanged:** every other test in both suites; `test/manage-treasure-map-page.test.js`; the four
    browser specs (manage-treasure-map ×2, my-assistants ×2).

## Out of scope

- Removing or rewriting `*:…` entries (Edit mode keeps them; story 2 § Out of scope).
- Showing ignored entries anywhere (a later book).
- Any change to the draft grammar's rules beyond the open question.
