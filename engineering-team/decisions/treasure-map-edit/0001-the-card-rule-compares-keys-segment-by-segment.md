# ADR 0001: The card rule compares keys segment by segment, after folding each key's spellings into one

**Status:** Accepted
**Date:** 2026-10-07
**Story:** `engineering-team/stories/treasure-map-edit/1-the-card-rule-edge-cases.md`
**Supersedes in part:** ADR manage-treasure-map/0002 sub-decisions 1 (key parsing) and 2 (applies, shadowed, per key)

## Context

The **Assistants by category** cards on `/treasure-map` count, for Scores, Lists and Concepts, every Assistant the
person's Treasure Map would ask for some insight there (manage-treasure-map book decision 9). Story 1 fixes three
cases where that rule disagrees with the draft Treasure Maps grammar (`protocols/drafts/treasure-maps.md`). Its
acceptance criteria, in short:

- **AC-1:** a `*:…` entry doesn't count for Scores when a `3038x…` entry reaches every Score it could reach: every
  segment the `3038x` entry names is named the same in the `*` entry, and an empty or left-off segment means "any"
  (§ 4.4). Likewise for Lists with `3039x…`. A single kind never hides a `*` entry.
- **AC-2:** the word after `*:` decides its families: `tag`, `pin`, `dlist` → Scores and Lists; `contexts` → Lists;
  any other word is a metric → Scores (§ 4.3, § 4.7). `*:…` never counts for Concepts; bare `*` counts for all three.
- **AC-3:** two spellings of one key count as one key, whose first-listed Assistant is its only one on the cards:
  `39998` and `39998:dlist-header` (§ 4.5); and, for every key but a Concept's, the key with or without empty segments
  at the end (`*` and `*:`, `3038x:tag` and `3038x:tag:`). A Concept key keeps its `d` tag exactly as written.
- **AC-4:** everything else is unchanged, including every example of manage-treasure-map #2 AC-2.

**Out of scope (story):** canonical naddr and nevent spellings, percent-encoding, keys the grammar doesn't allow (an
empty system slot such as `*::rank`, a metric on a List kind such as `3039x:rank`), and the app's other Map readers.

**Concept Graph:** the stack wasn't running (AGENTS.md § 2 fallback). The story reads kind 10040 and changes no
concept. **Firmware reinstall: not required.**

Facts from the code this decision rests on:

- **The rule is three module-private helpers and one export** in `ui/src/pages/treasure-map/manageTreasureMap.js`
  (ADR manage-treasure-map/0002 sub-decisions 1–2):
  - `entryOf(tag)` (line 107) splits the key at its first colon into `slot` and `rest`;
  - `appliesTo(category, entry)` (line 117) decides which categories an entry can reach, and lets any `*:…` reach
    Scores and Lists (case 2);
  - `shadowed(category, entry, keys)` (line 134) hides a `*` entry only behind an exact `3038x:<rest>` /
    `3039x:<rest>` string in a `Set` of raw keys (case 1), and checks `39998` and `39998:dlist-header` by hand;
  - `categoryAssistants(event)` (line 151) groups by the raw `tag[0]` (case 3).
- **Only the page calls it.** `categoryAssistants` is imported by `ui/src/pages/treasure-map/Index.jsx:9` and nowhere
  else. Edit mode, later in this book, is to reuse it for its preview.
- **No existing test pins the wrong behaviour.** `test/manage-treasure-map-cards.test.js` K1–K20 and the browser
  spec's fixtures (`tests/brainstorm/manage-treasure-map-cards.spec.js:57–59`) all give the same answer under the new
  rule. Checked by running them, with every row of the story's tables and the Tester cases below, through a
  throwaway prototype of sub-decisions 1–4 (not committed); the Tester re-checks against the real change.
- **The draft's precedence (§ 6)** compares keys segment by segment, left to right: the kind slot first (exact kind,
  then family wildcard, then `*`), then any later segment (a value beats empty or omitted). A family entry beats a `*`
  entry on every insight both match, because the kind slot differs first.

## Options considered

### Option A — keep the rule where it is; parse each key into segments, fold its spellings, and test coverage segment by segment (chosen)

`entryOf` also returns the key's trailing-trimmed `segments` and a folded `norm` key. `appliesTo` reads the system word
for `*:…`. `shadowed` asks whether a family entry *covers* the `*` entry, one segment at a time. `categoryAssistants`
groups by `norm`.

- **Pros:** the smallest change that meets every AC; one module, one suite; the export's signature and answer shape
  don't change, so the page and Edit mode's later preview call it as they do today. It keeps ADR 0002's boundary:
  the cards' own parser, separate from the app's classifier, until the draft grammar is ratified.
- **Cons:** the segment parser stays private to the page's view-model. Edit mode will need the same comparison to
  find a category's "individually assigned duties", so its ADR will have to export it or move it.

### Option B — move the key grammar into a shared module now (`ui/src/utils/treasureMapKeys.js`)

A pure module with `parseKey`, `normalizeKey`, `familiesOf` and `covers`, imported by the card rule now and by Edit
mode later.

- **Pros:** Edit mode gets a ready, separately tested key module; it's a step toward the single parser ADR 0002's
  Consequences expects.
- **Cons:** it designs Edit mode's needs before Edit mode's story exists. A module in `ui/src/utils/` reads as the
  app's grammar, but the draft isn't ratified and `classifyEntry` (`ui/src/utils/treasureMap.js:31`) stays the app's
  classifier, so the app would have two shared parsers instead of one shared and one page-local one. Bigger diff for
  a bug fix.

### Option C — compute § 6's winner for every insight in the category

Enumerate the insights each category could hold, find each one's winning key, and count those keys' Preferred
Assistants.

- **Pros:** § 6, literally.
- **Cons:** it can't be built. Categories, Tags, DLists and metrics are open-ended, so the insights can't be
  enumerated. Option A's coverage test is its closed form. Every segment value an entry doesn't name is open-ended, so
  a set of entries that each name a value the `*` entry leaves open never covers it together. One covering entry is
  the only way a `*` entry loses every insight in a category, short of naming all ten kinds of a family one by one,
  which the story leaves alone ("a single kind never hides a `*` entry").

## Decision

We chose **Option A**. It fixes the three cases in the module that owns the rule, changes nothing the page sees but
the counting, and leaves the question of sharing the parser to Edit mode's ADR, which will know what Edit needs.

Sub-decisions:

1. **Parsing** (`entryOf`; supersedes ADR 0002 sub-decision 1 in part). Validity is unchanged: a string key and a
   64-hex delegate, lowercased; split at the **first** colon into `slot` and `rest`. Each entry also gets:
   - **`concept`**: `slot` is `39998` or `39999`;
   - **`segments`** (not for Concepts): `rest === '' ? [] : rest.split(':')`, with trailing empty strings removed, so
     `*`, `*:` and `*::` all give `[]`, and `3038x:tag:` gives `['tag']`. Empty segments in the middle stay
     (`3038x:tag::T` gives `['tag', '', 'T']`);
   - **`norm`**, the key it's grouped and compared by:
     - for a Concept, the key as written, except `39998:dlist-header`, whose `norm` is `39998`;
     - for every other key, `slot` and `segments` joined with `:`. So `*:` is `*`, `3038x:tag:` is `3038x:tag`, and
       `30396:tag::` is `30396:tag`.

2. **Which categories an entry reaches** (`appliesTo`; supersedes the "applies" bullet of ADR 0002 sub-decision 2).
   Five-digit kinds, `3038x` and `3038x…`, and `3039x` and `3039x…` are unchanged. For `*`:
   - `segments` empty (`*`, `*:`, `*::`): Scores, Lists and Concepts;
   - otherwise never Concepts, and the first segment decides:
     - `tag`, `pin` or `dlist`: Scores and Lists;
     - `contexts`: Lists only;
     - `''` (an empty system slot, which the grammar doesn't allow): Scores and Lists, as today (story § Out of
       scope);
     - any other word, a metric: Scores only.

   A word is matched exactly, case and all, as the grammar spells it.

3. **When a `*` entry is hidden** (`shadowed`; supersedes the "shadowed" bullet of ADR 0002 sub-decision 2). Only `*`
   entries are ever hidden, and only by entries with a valid delegate:
   - **Scores:** hidden when some `3038x` entry **covers** it;
   - **Lists:** hidden when some `3039x` entry covers it;
   - **Concepts** (only bare `*` reaches them): hidden when some Concept entry's `norm` is `39998`, that is, `39998`
     or `39998:dlist-header`, as today.

   A family entry `F` covers a `*` entry `S` when every segment `F` names is named the same in `S`:

   ```js
   const covers = (F, S) => F.segments.every((seg, i) => seg === '' || S.segments[i] === seg);
   ```

   With trailing empties trimmed, `F`'s last segment is never empty, so an `F` longer than `S` never covers it. Bare
   `3038x` (`[]`) covers every `*` entry for Scores, as today, and `3038x:tag` doesn't cover bare `*` (story 2's K5
   still reads Mixed). Exact kinds never cover a `*` entry.

   `categoryAssistants` builds the family entries (slot `3038x` or `3039x`, valid delegate) and the set of Concept
   `norm`s once per call, in place of today's `keys` set of raw strings.

4. **Per key** (`categoryAssistants`; supersedes the "per key" bullet of ADR 0002 sub-decision 2). Group by `norm`,
   not by the raw `tag[0]`: among an applicable, unhidden key's entries, the first in Map order with a valid delegate
   is the key's Assistant. So `39998:dlist-header` → B followed by `39998` → A gives B. Everything else is unchanged:
   the result lists those Assistants in the order the Map first names them, without repeats; no event, no tags, or
   garbage give three empty lists; it never throws.

5. **ADR manage-treasure-map/0002** gets a Status parenthetical and a one-line "Superseded in part" note pointing
   here, as `curated-dlist-update` ADR 0003 did for its predecessors. It's written with this ADR's commit, so a
   reader of either finds the other.

## Consequences

- **Enables:** Edit mode's preview counts these cases right, and its "individually assigned duties" can be found
  with the same coverage test.
- **Constrains:** `segments`, `norm` and `covers` are module-private. Edit mode's ADR decides whether to export them
  from `manageTreasureMap.js` or move them to a shared module (Option B, then with Edit's needs in hand).
- **Debt, unchanged:** two parsers read 10040 keys (`classifyEntry` and this one) until the draft grammar is ratified
  (ADR 0002 Consequences). This one now also skips canonical naddr spellings and percent-encoding (story § Out of
  scope); both belong to that single parser.
- **Not a coverage hole:** a key the grammar doesn't allow counts as today. `*::rank` reaches Scores and Lists, and
  `3039x:rank` reaches Lists.
- **Firmware reinstall required?** No.

## Implementation notes

- **`ui/src/pages/treasure-map/manageTreasureMap.js`**, the only source file that changes:
  - `entryOf`: add `concept`, `segments` and `norm` (sub-decision 1);
  - `appliesTo`: the `*` branch reads `segments` (sub-decision 2);
  - `shadowed`: rewritten over `covers`, taking the family entries and the Concept `norm`s (sub-decision 3);
  - `categoryAssistants`: group and look up by `norm` (sub-decision 4);
  - update the JSDoc above `categoryAssistants` and the "The Assistants by category cards" comment to cite this ADR;
  - keep the module free of React, `fetch`, signing and storage, and Node-loadable (manage-treasure-map story 1's V7).
- **`engineering-team/decisions/done/manage-treasure-map/0002-the-cards-count-with-their-own-rule-over-the-same-read.md`:**
  the Status parenthetical and "Superseded in part" line (sub-decision 5), with this ADR's commit.
- **`ledger/2026-10-07-treasure-map-card-rule-edge-cases.md`:** flipped to DONE when the review passes, pointing at
  the review.
- **For the Tester (Phase 3):** Node cases in `test/manage-treasure-map-cards.test.js`, or a new suite registered in
  `test/registry.js`:
  - every row of the story's three tables, each named by its AC;
  - `3038x:` covers bare `*` for Scores, like `3038x` (a fold, AC-3);
  - `*::` reaches all three categories, like `*` (AC-3);
  - `*::rank` reaches Scores and Lists, and `3039x:rank` reaches Lists, as today (story § Out of scope);
  - a family entry with no valid delegate covers nothing (`3038x:tag` → `'nope'`, `*:tag:X` → D gives D);
  - only kind 39998's `dlist-header` folds: `39999` and `39999:dlist-header` are two keys;
  - a Concept `d` tag with colons stays whole: `39998:a:b` and `39998:a` are two keys;
  - `*:Tag` (capital T) is a metric, so it reaches Scores only.

  **Must stay green unchanged:** K1–K20 and C1 onward in `test/manage-treasure-map-cards.test.js`;
  `test/manage-treasure-map-page.test.js`; `tests/brainstorm/manage-treasure-map.spec.js` and
  `manage-treasure-map-cards.spec.js` (AC-4). The page's wiring doesn't change, so no new browser spec is needed.

## Out of scope

- Exporting or moving the key parser (Edit mode's ADR).
- Canonical naddr and nevent spellings, percent-encoding, and keys the grammar doesn't allow (the story's § Out of
  scope).
- `classifyEntry` and every other reader of Map keys.
