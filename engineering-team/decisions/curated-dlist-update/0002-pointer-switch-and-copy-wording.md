# ADR 0002: The pointer switch — the endpoint writes `pointer` and accepts the older link as existing; one link-type rule for the UI; "already copied" by `q`; "copy" in the words

**Status:** Accepted
**Date:** 2026-09-12
**Story:** `engineering-team/stories/curated-dlist-update/2-pointer-header-and-copy-wording.md`
**Supersedes in part:** `dlist-curation` ADR 0004 (the contract `b` type and its "exact" rule),
`dlist-curation` ADR 0006 (the "inherits from" line), `my-curated-dlists` ADR 0002 (the `wrong-type`
rule) and `my-curated-dlists` ADR 0003 (sub-decision 2's any-tag "already copied" rule, and Amendment 1's
sentence wording) — Decision §8.

## Context

The story's acceptance criteria, in short:
- **AC-1** a new curated header carries exactly one `b`, `["b", <community header>, "pointer"]`;
- **AC-2** an existing header is never re-pointed — the same target with `pointer` **or** the older
  `inherit-items` is "already existing" and untouched; no `b` gains `pointer`; any other `b` is refused;
- **AC-3** the detail page: no warning for `pointer`; a plain note, not a warning, for the older link
  ("Update will upgrade it"); a warning naming `pointer` for any other type;
- **AC-4** "copy" in every user-facing string on the curation screens — the panel's exact new
  description, the "candidates to copy" option, the method panel, the empty-view sentence, the Treasure
  Map entry line; no user-facing text says "inherit" (raw event JSON excepted);
- **AC-5** "already copied" means a `q` names the item (address for 39999, else id); a mention in any
  other tag no longer counts;
- **AC-6** the docs' "still writes `inherit-items`" sentences say what the code now does, still tying
  copies to story 5; BIBLE's glossary cites `curated-dlist-update` ADR 0001 by name;
- **AC-7** nothing else moves.

The contract is ADR 0001 (with Amendment 1) and `protocols/drafts/assistant-designation.md`
§ "Per-DList curation entries" / "Curation copies". The operator chose option A at the Planning gate:
the two older-link headers are recognized here and upgraded in story 5's Update preview.

**Facts from the code (read this session).**
- **The endpoint** (`src/api/dlist-curation/index.js`). The header's `b` type is one literal:
  `INHERIT_ITEMS` (`:24`), used by `classifyExisting` (`:66–72`) and `composeCurationHeader` (`:82`).
  - `classifyExisting` returns `none | exact | conflict | unpointed`; `exact` means exactly one `b`, equal
    to `["b", target, "inherit-items"]`; anything else with a `b` is `conflict`, *including* `pointer` and
    an untyped `b` to the same target.
  - The handler (`:264–275`) answers `exact` with `200 {success:true, existing:true, header, published:null}`
    and `conflict` with a 409. `unpointed` appends the contract `b` to the existing tags (`:83–91`).
  - Comments at `:12`, `:62–63` and `:74–79` describe the old contract.
- **The UI helpers** (`ui/src/utils/treasureMap.js`) are pure functions, and all four of story 2's rules
  live in them:
  - `communityPointerOf` (`:243–249`) follows the first a-tag `b` whatever its type, reporting `type`
    (absent → `pointer`); its comment says "inherits from".
  - `describeCurationHeader` (`:426–444`) pushes `wrong-type` whenever `pointer.type !== 'inherit-items'`
    (`:436`).
  - `curatedItemRows` (`:540–573`) builds its "referenced" set from every string at index ≥ 1 of every
    tag on the assistant's items (`:558–563`).
  - `itemsEmptySentence` (`:593–600`) ends with " The shared list offers no candidates to inherit."
- **The two places that display the raw type.** `CuratedDListHeaders.jsx:148` ("Points to `<coord>`
  (`<type>`)") and `TreasureMapTagsPanel.jsx:221–223` ("inherits from `<coord>` (`<type>`)"). The problem
  sentences are the `PROBLEM_SENTENCES` map (`CuratedDListHeaders.jsx:33–38`), rendered with the ⚠️ `warn`
  style (`:151–153`).
- **The strings:**
  - `DListCurationPanel.jsx:15` (`COPY`, "Operator-approved copy (story 5 gate, 2026-09-10)");
  - `CuratedDListItems.jsx:47` (method panel) and `:158` (the "Also show" label).
  - The panel already reports `existing: true` as "Header … already existed" (`DListCurationPanel.jsx:274`).
- **The house `b`-value owners** — `src/lib/bValueForms.js` and `ui/src/utils/bDisposition.js` (OPEN.md
  row 262) — export no type constants. `bValueForms.js:78` uses the literal `'pointer'`.
- **Pins** (the Tester's re-aims, Phase 3):
  - `test/dlist-curation-header-endpoint.test.js`: `CONTRACT_B` `:62`, U3 `:146–154`, U4 `:158–167`;
  - `test/dlist-curation-map-entries.test.js`: `:113`, `:154` "inherits from";
  - `test/dlist-curation-panel.test.js`: `:39`, the old `COPY`;
  - `test/my-curated-dlists-headers.test.js`: U2 `:95–99`, `:110–142`;
  - `test/my-curated-dlists-items.test.js`: `:94`, U6 `:203–207`, `:245`, `:252`, `:280`.
- **Live data.** Two headers on the community relay carry the older link (`8e901369…`, `253d40c4…`, both
  `dog-breed`, 2026-09-11); a third hit, `11f23fe4…`, is the community header's own self-declaration
  (`pointer` to itself), not a curation.

**A tension inside the story.** AC-3 asks for a note that the header "uses the older link"; AC-4 says no
user-facing text says "inherit". The note therefore describes the link without naming its type; the raw
event JSON (behind its toggle) still shows the tag. A warning about an *unexpected* type quotes that
value as data, the same way the raw JSON does. This is how the ADR reads AC-4.

**Concepts.** None change. Orientation only: `39998:<TA>:list`, `39998:<TA>:shared-concept`,
`39998:<TA>:tapestry-assistant`.

**POV reflex checks.**
- *Who is this true for?* The header is its curator's own statement; the link type describes that
  curation, not a global view.
- *Where does trust come from?* Nowhere here: nothing is scored or filtered.
- *Could anyone else publish their own version?* Yes; other curators' headers are untouched.
- *What changes when the POV changes?* Nothing is stored per point of view.

Principle 4: no graph write; the endpoint's header stays a letter in the relay.

## Options considered

### Option A — Change the existing seams in place; one shared label rule for the two type displays (chosen)
**The server** (`src/api/dlist-curation/index.js`):
- Two named types replace the literal.
- `classifyExisting` gains an `older` state: same target, `inherit-items`. `exact` becomes same target with
  `pointer` or no type (an absent type *is* `pointer` in the registry).
- The handler answers `older` exactly as it answers `exact`.
- `composeCurationHeader` writes `pointer`.

**The UI** (`ui/src/utils/treasureMap.js`):
- `describeCurationHeader` returns a new `notes` list beside `problems` (`older-link`); `wrong-type` then
  means neither `pointer` nor the older link.
- A new pure `linkTypeLabel(type)` feeds both raw-type displays.
- `curatedItemRows` reads `q` tags only.
- Strings change in place.

- **Pros.** Every rule stays in a pure, already-tested function. The response shape the panel reads is
  unchanged. One label rule serves both displays, so they cannot drift. The diff is small and local.
- **Cons.** The two type strings live in two modules — server and UI — as the codebase already does
  with no shared module system; a comment on each side points at the other and at the registry.

### Option B — Type constants in the house `b`-value owners
Add `B_TYPES = { POINTER, INHERIT, INHERIT_ITEMS }` to `src/lib/bValueForms.js` and
`ui/src/utils/bDisposition.js`, and import them in the endpoint and `treasureMap.js`.
- **Pros.** One owner per side, which is row 262's lesson.
- **Cons.** It touches two shared modules that stamping and the coverage audit consume (`bValueForms.js:78`
  would move off its literal too), and `bDisposition.js` is zero-import and pinned. That refactor is beyond
  this story. Recorded as a row-262 follow-up.

### Option C — Upgrade the older link on a second Add
- **Cons.** The endpoint signs without a preview, so this would be a silent re-point — which the header
  contract forbids — and the operator put the visible upgrade in story 5 (option A). Rejected.

### Option D — Keep the any-tag "already copied" rule and deduplicate on the page
- **Cons.** ADR 0001 defines "already copied" by `q`; story 3's review showed any-tag matching retires
  candidates on replies and disputes. Rejected (AC-5).

### Option E — Name the older type in the note ("uses `inherit-items`")
- **Cons.** It breaks AC-4. The note says "the older link type", and the raw JSON shows the tag. Rejected.

## Decision

We chose **Option A**.

1. **The endpoint.**
   - `CONTRACT_TYPE = 'pointer'` and `OLDER_TYPE = 'inherit-items'` replace `INHERIT_ITEMS`.
   - `classifyExisting(existing, target)` returns `'none' | 'exact' | 'older' | 'conflict' | 'unpointed'`:
     - `exact` — exactly one `b`, value `target`, type `pointer` or absent (`undefined` or `''`, read as
       `pointer` per the registry);
     - `older` — exactly one `b`, value `target`, type `inherit-items`;
     - `unpointed` — no `b`;
     - `conflict` — anything else: another target, any other type string (including `inherit` and unknown
       values), or more than one `b` (the sentinel counts as a `b`, unchanged).
   - The handler answers `older` exactly like `exact`: `200 {success:true, existing:true, header:
     existing, published:null}`. Nothing is signed or published, and the header is left untouched.
   - `composeCurationHeader` writes `['b', target, CONTRACT_TYPE]` in both its fresh and `unpointed`
     paths.
   - The response shape does not change.
2. **The header check.**
   - `describeCurationHeader` returns `{ authoredByAssistant, pointer, deferred, problems, notes }`.
   - `wrong-type` is pushed only when the followed pointer's type is neither `pointer` nor `inherit-items`.
   - `notes` is `['older-link']` when it is `inherit-items`, else `[]`.
   - Problems keep their order (`no-b · not-a-coordinate · wrong-type · multiple`).
3. **One label rule.** `linkTypeLabel(type)` — pure, exported from `treasureMap.js`:
   - `'pointer'` (or empty/absent) → `null`, so nothing is shown;
   - `'inherit-items'` → `'older link'`;
   - any other string → the value in curly quotes (`“inherit”`);
   - non-string → `null`.
   - It is used by both raw-type displays.
4. **"Already copied" by `q`.** `curatedItemRows` builds the referenced set from index 1 of `q` tags only.
   Those are tags where `t[0] === 'q'` and `t[1]` is a string, on the assistant's items filed under the
   list. Matching is unchanged: the shared item's id, or its `39999:<pubkey>:<d>` coordinate.
5. **The strings (exact):**
   - `DListCurationPanel.jsx` `COPY`: "Empower your Tapestry Assistant to curate a community DList on your
     behalf. Your assistant authors its own version of the list and copies in the community items its
     curation method accepts, adding and removing them each time you press Update list. Your Treasure
     Map records that you empowered it." Its comment: "Operator-approved copy (`curated-dlist-update`
     /discuss, 2026-09-11)".
   - `CuratedDListItems.jsx:47`: "It will set how your assistant decides which candidates to copy — for
     example, skipping an item that has more downvotes than upvotes."
   - `CuratedDListItems.jsx:158`: "Also show candidates to copy".
   - `itemsEmptySentence`: " The shared list offers no candidates to copy."
   - `PROBLEM_SENTENCES['wrong-type']`: `⚠️ Its link to the shared header is typed “${type}”, not “pointer”.`
   - `NOTE_SENTENCES['older-link']` (new): "It uses the older link type; Update list will upgrade it to
     “pointer”." — rendered in the plain `line` style, no ⚠️.
   - The "Points to" line (`CuratedDListHeaders.jsx:148`): "Points to `<coord>`" plus ` (<label>)` when
     `linkTypeLabel` returns one.
   - The Treasure Map entry line (`TreasureMapTagsPanel.jsx:221–223`): "copies from `<coord>`" plus
     ` (<label>)` when there is one.
6. **Comments follow the code.**
   - The endpoint's module comment (`:12`) and the `classifyExisting` and `composeCurationHeader` comments
     describe the new states and contract.
   - `communityPointerOf`'s comment says "links to".
   - `curatedItemRows`' comment says "a `q` tag".
7. **The docs (AC-6)** — each "still writes `inherit-items`" sentence becomes "since story 2 the endpoint
   writes `pointer`; older headers keep `inherit-items` until Update upgrades them (story 5); copies arrive
   with story 5" (exact edits in the Implementation notes). BIBLE's `Last updated` gains a chained note.
8. **Superseded in part.** Each gets a Status parenthetical and a one-line note, the house form used in
   story 1:
   - `dlist-curation` ADR 0004 — AC-4/AC-5's contract `b` and the "exact" rule;
   - `dlist-curation` ADR 0006 — the "inherits from" line;
   - `my-curated-dlists` ADR 0002 — `wrong-type`'s `inherit-items` expectation;
   - `my-curated-dlists` ADR 0003 — sub-decision 2 and Amendment 1's wording.

   The notes cite `curated-dlist-update` ADR 0002 by that short name, not by path, so they survive this
   epic's retirement (the lesson of story 1's review, now OPEN.md's done/-path row).

## Consequences
- **Enables** stories 3–5:
  - story 3 reads headers through the same `describeCurationHeader`;
  - story 5's Update upgrades exactly the headers `classifyExisting` and `describeCurationHeader` mark
    as `older`.
- **The two live older headers** stay `inherit-items` until their owners use Update (story 5). Meanwhile
  the panel reports them as existing and the detail page shows the plain note.
- **The panel text promises Update list**, which works from story 5 — fine while the branch ships as one
  book (story § Open questions).
- **Constrains.** The server and the UI each carry the two type names, with cross-pointing comments.
  `classifyExisting`'s five states and `describeCurationHeader`'s `notes` field become contracts that
  stories 3 and 5 and the suites pin.
- **Debt, recorded:**
  - consolidating the `b` type names in the house owners (Option B) belongs with OPEN.md row 262;
  - `bValueForms.js:78`'s literal is unchanged.
- **Firmware reinstall required?** No — no concept definitions change.

## Implementation notes

1. **`src/api/dlist-curation/index.js`**
   - `:24`: replace `INHERIT_ITEMS` with `CONTRACT_TYPE = 'pointer'` and `OLDER_TYPE = 'inherit-items'`,
     each commented with its registry meaning. Mirror them in `treasureMap.js`, with a comment pointing
     at each other.
   - `classifyExisting` (`:59–72`): Decision §1's five states. Update the doc comment.
   - The handler (`:265–268`): `if (state === 'exact' || state === 'older')` → the existing `200`
     response.
   - `composeCurationHeader` (`:82`): `const contractB = ['b', target, CONTRACT_TYPE];`.
   - Comments `:12`, `:62–64`, `:74–79` updated. Export list unchanged.
2. **`ui/src/utils/treasureMap.js`**
   - Constants `CURATION_LINK_TYPE = 'pointer'` and `OLDER_LINK_TYPE = 'inherit-items'` (exported).
   - `describeCurationHeader` (`:426–444`): the `wrong-type` rule and `notes` per Decision §2. Update its
     JSDoc `@returns`.
   - New `export function linkTypeLabel(type)` per Decision §3.
   - `curatedItemRows` (`:557–563`): the referenced set from `q` tags only; update its JSDoc (`:534`).
   - `itemsEmptySentence` (`:598`): "copy".
   - `communityPointerOf`'s comment (`:239`).
3. **`ui/src/pages/grapevine/CuratedDListHeaders.jsx`**
   - `PROBLEM_SENTENCES['wrong-type']` (`:36`) per Decision §5.
   - Add `NOTE_SENTENCES` beside it.
   - Render `(info?.notes || [])` in the plain `line` style after the "Points to" and deferred lines,
     before the problems.
   - `:148` uses `linkTypeLabel`.
4. **`ui/src/pages/grapevine/TreasureMapTagsPanel.jsx`** — `DListRowDetails` (`:221–223`): "copies from"
   and `linkTypeLabel`.
5. **`ui/src/pages/grapevine/CuratedDListItems.jsx`** — `:47` and `:158` per Decision §5.
6. **`ui/src/pages/grapevine/DListCurationPanel.jsx`** — `:14–15`: the comment and `COPY` per
   Decision §5.
7. **Docs (AC-6), exact:**
   - `protocols/drafts/inherit-from.md:4`: replace "loses its emitter … still writes it." with "has no
     emitter in the reference deployment since `curated-dlist-update` story 2: new curated headers link
     with `pointer` (`curated-dlist-update` ADR 0001); headers written earlier keep `inherit-items` until
     their assistant upgrades them in Update's preview, and curated lists hold curation copies from
     story 5." The rest of the block is unchanged.
   - `BIBLE.md:1546`: replace "the reference deployment stops emitting it … still writes it." with "no
     emitter in the reference deployment since `curated-dlist-update` story 2 — new curated headers link
     with `"pointer"`; older ones are upgraded by Update, and items are copied from story 5
     (`curated-dlist-update` ADR 0001)."
   - `BIBLE.md:1079`: replace "; that endpoint still writes the earlier `inherit-items` link until
     `curated-dlist-update` story 2, and nothing copies items yet." with "; since `curated-dlist-update`
     story 2 that endpoint writes the `"pointer"` link (headers written earlier keep `inherit-items` until
     Update upgrades them), and nothing copies items until story 5."
   - `BIBLE.md:1630`: the "**Status today for the facet:**" sentence becomes "no emitter since
     `curated-dlist-update` story 2 — the header endpoint (`POST /api/dlist-curation/header`) writes
     `pointer` (`curated-dlist-update` ADR 0001); headers written earlier keep `inherit-items` until Update
     upgrades them, and curated lists hold curation copies from story 5." The following sentence (the
     derivation, parked) is unchanged.
   - `BIBLE.md:8`: a chained `Last updated` note ("the header endpoint writes `"pointer"` since
     curated-dlist-update story 2 — curated-dlist-update #2; prior: …"), in the same commit (L9).
   - `protocols/drafts/assistant-designation.md` Deployment status (`:173`): replace its last sentence with
     "Curation copies (`curated-dlist-update` ADR 0001) are partly wired: since `curated-dlist-update`
     story 2 the header endpoint writes the `pointer` link and treats a header with the earlier
     `inherit-items` link as existing (Update upgrades it, story 5); nothing copies items yet
     (stories 3–5)."
8. **ADR annotations:**
   - `engineering-team/decisions/done/dlist-curation/0004-assistant-curation-header-endpoint.md`: Status
     "Accepted (the contract `b` type and the exact rule superseded by `curated-dlist-update` ADR 0002)",
     plus a one-line note under the Story line.
   - `engineering-team/decisions/done/dlist-curation/0006-map-entries-dlist-class.md`: "(the "inherits
     from" line superseded by …)".
   - `engineering-team/decisions/done/my-curated-dlists/0002-the-two-headers.md`: "(`wrong-type`'s
     expected type superseded by …)".
   - `engineering-team/decisions/done/my-curated-dlists/0003-items-method-and-update.md`: "(sub-decision 2
     and Amendment 1's wording superseded by …)".
9. **Local check (cycle-local).** Bring the stack up and verify on the live pages:
   - the panel's description and a second Add of an older-link header ("already existed");
   - the detail page's note and label;
   - the Treasure Map line;
   - the "candidates to copy" label.

   Signed-in surfaces use the fetch-stub technique (no NIP-07 in the automated browser). Staging's two
   older headers are the real older-link case.

**Testable seams (the Tester's call, Phase 3):**
- `classifyExisting`'s five states, including untyped → `exact`, `inherit` → `conflict`, and the sentinel
  beside a pointer → `conflict`.
- The handler: `older` → 200 `existing:true` with no sign and no publish.
- `composeCurationHeader`: one `pointer` `b` on both paths.
- `describeCurationHeader`'s `problems` and `notes` for `pointer`, `inherit-items`, `inherit`, an unknown
  value, and no type.
- `linkTypeLabel`'s table.
- `curatedItemRows`: copied by `q` (address, and id), *not* by `e`/`a`/`b`/`p`.
- `itemsEmptySentence`.
- Structural pins: the five strings; no "inherit" in user-facing string literals of the five UI files
  (comments excepted); the two raw-type displays use `linkTypeLabel`.
- Re-aims of the five suites listed in Context.
- Doc assertions for AC-6 if the Tester wants them.

Regression is the full `npm test` (known reds: OPEN.md rows 191 and 261; locally, `BRAINSTORM_PUBLISH_LOCAL_ONLY`
per row 191). Single suites run through `require('./test/<name>.test.js').run()`, never `node` on the file.

## Out of scope
- Upgrading the older-link headers (story 5's preview); Update and copying (story 5); the method's
  controls (story 4); another assistant's curation (story 3).
- Moving the type names into `bValueForms.js` / `bDisposition.js` (Option B; row 262).
- The `inherit-items` resolver and derivation (parked).
- Any change to the Map entry, the import action, or the Simple Lists pages.
