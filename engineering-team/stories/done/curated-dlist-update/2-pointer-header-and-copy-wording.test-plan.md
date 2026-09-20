# Test Plan: Story 2 — Curated headers link with `pointer`, and the curation screens say "copy"

**Story:** `engineering-team/stories/done/curated-dlist-update/2-pointer-header-and-copy-wording.md`
**ADR:** `engineering-team/decisions/done/curated-dlist-update/0002-pointer-switch-and-copy-wording.md`
**Date:** 2026-09-12

## Coverage map

**New suite:** `test/curated-dlist-update-pointer-switch.test.js` uses the house classes plus a doc class.
- **U (behavioral):** ESM import of `ui/src/utils/treasureMap.js`.
- **S (structure):** reads of the five curation files.
- **D (docs, AC-6):** reads of the protocol drafts and BIBLE.
- **R (sentinels):** pass before and after.

It is registered in `test/test.js` in five places: the require, the run, the results line, the overall verdict and the skip aggregate. It carries the `require.main` block (OPEN.md's silent-suite row).

**Re-aimed in place,** because story 2 changes what they pin:
- `test/dlist-curation-header-endpoint.test.js`:
  - `CONTRACT_B` is `pointer`, with `OLDER_B` for `inherit-items`;
  - U3 covers the five states;
  - U4's message;
  - H7's conflict fixture is now another type;
  - new H15: the older link is left untouched.
- `test/my-curated-dlists-headers.test.js`: U2 treats `pointer` as well-formed; U3's wrong-type cases; U4's ordering fixture uses `inherit`.
- `test/my-curated-dlists-items.test.js`: U6's fixtures and expectation (copied by `q` only); U9's sentence; S1's label.
- `test/dlist-curation-map-entries.test.js`: S3, "copies from".
- `test/dlist-curation-panel.test.js`: `COPY` is the operator's text of 2026-09-11.

| Criterion | Tests | Test file | Level |
|---|---|---|---|
| AC-1 a new header links with `pointer` | **U4:** exactly one `["b", <target>, "pointer"]`. **U5, U6:** the contract `b` on the fresh and unpointed paths. **H8:** absent → the signed template carries one `pointer` `b`. **H13:** unpointed → `pointer` appended. | endpoint suite | unit + handler (dependency-injected) |
| AC-2 an existing header is never re-pointed | **U3:** `classifyExisting` states — `exact` for `pointer`, untyped and empty type; `older` for `inherit-items`; `conflict` for another type, an unknown type, another target (either type), an extra `b`, or the sentinel beside the pointer; `unpointed`; `none`. **H6:** `pointer` exists → 200 `existing:true`, nothing signed. **H15 (new):** the older link → 200 `existing:true`, returned unchanged, nothing signed. **H7:** another type → 409. | endpoint suite | unit + handler |
| AC-3 the detail page reads both forms | **New U2:** the problems/notes table (`pointer`, untyped, empty → none; `inherit-items` → note `older-link`; `inherit`, `curates` → `wrong-type`; no `b` → `no-b`, notes `[]`; garbage → notes `[]`). **New S3:** `NOTE_SENTENCES['older-link']` is plain, no ⚠️, and says Update list will upgrade it; notes rendered; the wrong-type sentence stays ⚠️ and names "pointer". **Headers U2:** `pointer` well-formed. **Headers U3:** wrong-type only for other types. **Headers U4:** problem ordering. | new suite + headers suite | unit + structure |
| AC-4 the words say "copy" | **New S1:** no user-facing "inherit" in the five files (comments and bare type values excepted). **New S2:** both raw-type displays call `linkTypeLabel`, no raw `({…pointer.type})`, "copies from". **New S4:** "candidates to copy" in the method panel. **New U1:** the `linkTypeLabel` table. **Panel S4:** the exact description. **Items S1:** "Also show candidates to copy". **Items U9:** "no candidates to copy". **Map-entries S3:** "copies from". | new suite + panel, items, map-entries suites | unit + structure |
| AC-5 "already copied" means a `q` names it | **New U3:** a `q` with the address, a `q` with a 39999 version's id, and a `q` with a 9999 id count. Mentions in `e`/`a`/`b`/`p`, a `q` value past index 1, and someone else's `q` do not. **Items U6:** its fixtures now copy by `q`; `b`/`e`/`a`/made-up-tag mentions stay candidates. | new suite + items suite | unit |
| AC-6 the docs say what the code does | **D1:** `inherit-from.md`'s implementation note ("since `curated-dlist-update` story 2", story 5, no "still writes it"). **D2:** BIBLE — three stale phrases gone; the glossary names `curated-dlist-update` ADR 0001 and story 5; §25 status; `Last updated` records #2. **D3:** `assistant-designation.md` Deployment status. | new suite | doc structure |
| AC-7 nothing else moves | **R1:** `communityPointerOf`'s reporting. **R2:** the house `b`-value owners' exports. **H7/H15:** sentinels that pass before and after. Every other test in the five re-aimed suites is unchanged and passing. | all six | regression |

## Edge cases

- [x] **E1 — no type, or an empty type** reads as `pointer`: `exact` at the endpoint, no problem on the page (endpoint U3; new U2).
- [x] **E2 — the older link to another target** is a `conflict`, not `older` (endpoint U3).
- [x] **E3 — the sentinel beside the pointer** is a second `b`, so `conflict` (endpoint U3).
- [x] **E4 — an unknown type string** (`curates`) is a `conflict` at the endpoint and `wrong-type` on the page (endpoint U3; headers U3; new U2).
- [x] **E5 — `notes` is always an array**, even for garbage and for a header with no `b` (new U2).
- [x] **E6 — only index 1 of a `q` counts**, and only on my assistant's items (new U3; items U6).
- [x] **E7 — a 9999 original is copied by its id; a 39999 original by its address or a version's id** (new U3).
- [x] **E8 — `linkTypeLabel` on non-strings** returns `null` and never throws (new U1).
- [ ] **Relaxed by the satisfiability check.** Map-entries S3 checks "copies from" only. Its first re-aim also required no "inherits from" anywhere in the raw source, which failed a correct sketch. The absence of user-facing "inherit" is enforced once, by the new suite's S1 on comment-stripped source.
- [ ] **Not covered — rendering and a real Add.** Not exercised here:
  - the note, label and "copies from" line in a browser;
  - a real `POST /api/dlist-curation/header`.

  These are the reviewer's live check on the local stack; staging holds the two real older-link headers (`8e901369…`, `253d40c4…`).
- [ ] **Not applicable — the Concept Graph API:** no concept behavior changes.

## Test infrastructure
- **Framework:** Node's built-in runner (`node test/test.js`); no Playwright half.
- **How the code is reached:**
  - the UI util through ESM import;
  - the endpoint through its dependency-injected factory, with fakes;
  - the pages and docs by reading their source.
- **Not exercised:** the stack, relays and DOM.
- **Firmware state:** none required.
- **Fixtures:** inline — synthetic pubkeys (my assistant, someone else, the shared list's author), synthetic headers per `b` case, and synthetic items with `q` / `e` / `a` / `b` / `p` / made-up references.

## How to run

Full suite:
```
npm test
```

Story-scoped gate. Always go through `run()`; never `node test/<file>`, which exits 0 without running anything for suites with no `require.main` block (OPEN.md's silent-suite row):
```
node -e "Promise.all(['./test/curated-dlist-update-pointer-switch.test.js','./test/dlist-curation-header-endpoint.test.js','./test/my-curated-dlists-headers.test.js','./test/my-curated-dlists-items.test.js','./test/dlist-curation-map-entries.test.js','./test/dlist-curation-panel.test.js'].map(p=>require(p).run())).then(rs=>{const f=rs.reduce((s,r)=>s+(r.fail||0),0);console.log('TOTAL_FAIL='+f);process.exit(f?1:0)})"
```

## Verification

The new and re-aimed tests fail with the current code. Confirmed on 2026-09-12 at commit `36a3c0dc` with these tests applied, each suite through `run()`:

```
curated-dlist-update-pointer-switch: 2 passed, 10 failed — U1 U2 U3 S1 S2 S3 S4 D1 D2 D3 (R1 R2 pass)
dlist-curation-header-endpoint:     22 passed, 7 failed  — U3 U4 U5 U6 H6 H8 H13 (H7, H15 pass)
my-curated-dlists-headers:          14 passed, 2 failed  — U2 U3
my-curated-dlists-items:            20 passed, 3 failed  — U6 U9 S1
dlist-curation-map-entries:         13 passed, 1 failed  — S3
dlist-curation-panel:               17 passed, 1 failed  — S4
```

Each failure names what is missing. Samples:
- "ui/src/utils/treasureMap.js must export linkTypeLabel (ADR 0002 §Implementation 2)";
- `["b", …, "pointer"] → problems [], notes []; got {… "problems":["wrong-type"] …}`;
- "copied = a q by my assistant … got ["others q"]";
- S1 lists the six "inherit" strings: the panel description, the wrong-type sentence, the method panel, the checkbox label, "inherits from", and the empty-view sentence;
- D1 quotes the "until then the header endpoint … still writes it" wording.

`node --check` is clean on all seven edited test files, `test/test.js` included.

**Satisfiability check** (the practice OPEN.md row 264 proposes). I applied an ADR-faithful sketch of the implementation, never committed, in a throwaway `git worktree` holding these tests. The sketch followed ADR 0002's Decision and exact strings: the endpoint states, `linkTypeLabel` and `notes`, `q`-only matching, the strings, and the doc sentences.

Results against the sketch:
- the new suite 12/0, headers 16/0, items 23/0, panel 18/0;
- endpoint 26/3 — the three are S3, R1 and R4, which need `nostr-tools`, absent from a worktree without `node_modules`; they pass in the main tree;
- map-entries 13/1 — the over-constrained "no 'inherits from'" pin, relaxed as recorded under Edge cases.

The worktree was removed afterwards.
