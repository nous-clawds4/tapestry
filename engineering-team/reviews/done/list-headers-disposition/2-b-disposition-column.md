# Review: Story 2 — The 🧭 b-disposition column on List Headers

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-01
**Diff:** `git diff ded36dc1..921f7076` (story 2 since story 1's review; the branch is 0 behind `origin/staging`)

The same session wrote the ADR, the tests and the code. Every check below ran against a fresh
`git archive 921f7076` build, not the Implementer's build or working tree.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **the full run was not made on this machine**, for the reason recorded in story 1's review
      (live suites publish fixtures; OPEN.md row `2026-09-27-test-fixture-taggings-on-prod-relays`).
  - Each suite below was checked for publish markers (`strfry/publish`, `nak`, `loopbackPost`, `signAs`)
    *before* it ran. Every one had none:
    - `list-headers-disposition-column`: 12 passed, 0 failed;
    - `list-headers-author-options`: 9 passed, 0 failed;
    - `stack-free-npm-test`: 7 passed, 0 failed;
    - `relay-scan-bounds`: 28 passed, 0 failed;
    - `site-trust-signals`: 28 passed, 0 failed.
  - `b-coverage-audit-and-disposition` was **not** re-run: it publishes fixture headers through the
    container. The Implementer ran it once without checking first. See § Harness friction.
  - CI's stack-free gate runs the full registry on the PR.
- [x] Playwright: `list-headers-disposition-column.spec.js` plus story 1's `list-headers-author-options.spec.js`,
      against a `vite preview` of the fresh build. **Chromium: 90 passed with `--repeat-each=5`** (18 tests ×5).
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._ The Vite bundle built cleanly from `921f7076`.

## Spec adherence
- [x] **Every acceptance criterion has a passing test.**
  - AC 1: D8, and C1 signed out and signed in.
  - AC 2: D2, D3, D4, D9, D10, C2.
  - AC 3: D5, C3.
  - AC 4: D6, C4.
  - AC 5: D7, C5.
  - AC 6: C6.
- [x] **No criterion is silently dropped.** Both defaults the approval confirmed hold:
  - "not yet decided" is a muted ○, never "—" (`listHeaderDisposition.js:48`, `Index.jsx:206`);
  - the column sits right after the two name columns (`Index.jsx:199`).
- [x] **No behaviour beyond the story.** Sorting and searching by the 🧭 column come from DataTable for every
      column. ADR 0002 records that, and the story's out-of-scope line is about *new* controls, which there
      are none of.

## ADR adherence
- [x] **Files match § Implementation notes.**
  - `ui/src/utils/listHeaderDisposition.js` is pure ESM, importing `./bDisposition.js` *with* the extension.
    It exports `MARKS` (five frozen `{ glyph, title, state }`), `COLUMN_TITLE` and `listHeaderDisposition`,
    with the exact strings the ADR lists.
  - The page computes `disp` in the existing `rows` memo (`Index.jsx:121`), with its dependencies unchanged,
    and stores the state word under `disposition` (`:135`) and the marks under `_dispositionMarks` (`:136`).
  - One column is inserted after `plural` (`:199-211`), with no `onClick` and no button.
- [x] **The rule stays in its one home.** The module calls `dispositionOf` and doesn't re-derive the
      marker-vs-real or self-vs-wired logic. Kind 9998 is short-circuited before it (`:35`), per book
      decision 3.
- [x] **Concept Headers is untouched.** `git diff ded36dc1..921f7076 -- ui/src/pages/concepts` is empty.
      The chip words are copied, and D9 guards the copy.
- [x] **No new dependencies.**

## Concept-graph integrity
- [x] No concept, handle, schema or firmware change. No reinstall.
- [x] N/A: no new code reads concepts.

## Things tests can't catch
- [x] No secrets, no debug logging, no commented-out code.
- [x] **React keys.** Marks in one cell are distinct by construction (at most one each of wired,
      self-declared and private, or a single undecided or n/a), so `key={m.state}` is unique. The column key
      `disposition` is unique among the columns.
- [x] **Performance.** One `dispositionOf` call per row, inside the existing memo: 315 rows locally, 379 on
      staging (375 of kind 39998, 4 of kind 9998). Negligible.
- [x] **Real data, independently checked (local stack).**
  - The deployed page's 🧭 counts (7 🤝, 11 🔗, 1 🔒, 265 ○, 31 —) equal a count computed separately from
    the raw relay scan.
  - By exact address, 75 of 76 headers shared with Concept Headers agree. The one difference,
    `stamping-fixture-f4`, is a test fixture whose newer bare version is in the relay but not in Neo4j. So
    Concept Headers is the stale side. That's the lag ADR 0002 gave as its reason for reading the relay.
- [x] **Security.** Read-only rendering of public relay data. No input reaches the server.

## House rules check
- [x] Concept Graph API authority respected (not applicable).
- [x] No new lint/typecheck/build tooling.

## Product-guide adherence *(when the story traces to a PRD)*
- [x] N/A: the book has no PRD (acceptance frame).

## Findings

### Blocking
None.

### Non-blocking
1. **`listHeaderDisposition.js:40` vs `Index.jsx:107`: a 39998 with no `d` tag gets two different addresses.**
   - The page's existing link builds `39998:<pubkey>:null` (`getTag` returns `null`, interpolated). The new
     classifier uses `39998:<pubkey>:` (NIP-01's empty default), as ADR 0002 decided.
   - For such a header, a b-tag of `…:null` would read as wired here, though the page's own link treats
     `…:null` as the header's address.
   - No such header exists: 0 of 284 locally and 0 of 375 on staging lack a `d` tag. The classifier is the
     correct one. The `null` is a pre-existing quirk of the page's link.
   - Optional: fix the link the next time the row-building code is touched (story 3 or 4).
2. **Marks carry their meaning only in `title` tooltips.** Screen readers announce `title` inconsistently.
   That's the same as Concept Headers' column, so not a regression. Worth an `aria-label` when the shared
   chips are extracted with the Concept Headers fix.

### Harness friction
1. **A publishing suite was run during Implementation without checking first.**
   - The Implementer checked `b-coverage-audit-and-disposition` for publish calls in the same command that
     ran it. So the check couldn't stop it, and the suite re-published its two TA-signed kind-39998 fixture
     headers into the local relay.
   - Verified harmless:
     - no enabled router upload stream carries kind 39998;
     - a read-only query of `wss://dcosl.brainstorm.world` finds neither fixture d-tag;
     - the d-tags are stable, so the local copies were replaced, not added to.
   - The lesson (check *before* running, as a separate step; skip on any marker) is already the standing
     rule in the session's memory, and this review applied it. No new ledger row: OPEN.md row
     `2026-09-27-test-fixture-taggings-on-prod-relays` already owns the underlying hazard.

## Verdict
**PASS**

The diff is ADR 0002's implementation exactly. Every acceptance criterion is covered by a test that passes on
a fresh build. Story 1's page tests still pass beside the new column, and on real data the column agrees with
an independent count of the relay.

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed. The result is reported in the chat.
