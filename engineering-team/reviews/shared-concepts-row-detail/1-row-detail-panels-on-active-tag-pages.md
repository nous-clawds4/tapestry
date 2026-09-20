# Review: Story 1 — Row detail panels on the Active …-tags pages

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-20
**Diff:** `git diff 9cc36697..b9efca93` (implementation commit `b9efca93`)

## Quality gates (run by reviewer, not trusted)

- [x] **Story suite** — `test/shared-concepts-row-detail.test.js`, re-run by the reviewer:
      **21 passed, 0 failed.**
- [x] **Playwright** — `tests/brainstorm/shared-concepts-row-detail.spec.js` (chromium), re-run by
      the reviewer: **12 passed (3.5s).** Requires the build deployed into the container; it was.
- [x] **Targeted regression** — every suite in `test/` that references any changed file
      (`DataTable`, `ActiveBTags`, `ActiveZTags`, `text-muted`, `styles.css`): **20 suites,
      464 passed, 0 failed.** Suite list in the test plan's coverage notes; it includes
      `b-coverage-audit-and-disposition` (the pre-existing sentinel guard on this page),
      `profile-follows-list` and `profile-followers-list` (the `DataTable` callers with the
      largest column surface), and `login-failure-and-tag-collapse`.
- [ ] **Full `npm test` — NOT COMPLETED, and this review does not claim otherwise.** A full run
      is 208 suites. The reviewer started one and it reached `[7/208]` with zero failures before
      this review was written; an earlier run reached 18/208 in ~40 minutes before being stopped.
      At that rate a full pass is multiple hours on this machine. **No `gate:status` line is quoted
      because no run reached a verdict** — the template asks for one and there is none to give.
      Cause is known and pre-existing: `OPEN.md` row 191 — three `trusted-lists` suites hard-FAIL
      unless the container is in local-only publish mode, which this operator deliberately does not
      use. This is a standing gap in this repo's local verifiability, not a property of this diff.
      **Whoever promotes this change should let CI run the full gate.**
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] UI build: `npm --prefix ui run build` succeeded (11.21s); `dist/` is gitignored and correctly
      absent from the commit.

## Spec adherence

All ten acceptance criteria are covered by a passing test. Spot-checked the mapping rather than
trusting the plan's table:

| AC | Covered by | Verified |
|---|---|---|
| 1 closed by default, tag column gone | `E1`, `E10` | pass |
| 2 toggle opens/closes; rows independent | `E2`, `E3` | pass |
| 3 full value to clipboard + ack | `E4` (+ `S13` guard) | pass |
| 4 absent description says so | `E5` | pass |
| 5 tag still filterable | `E6`, `E11` | pass |
| 6 description filterable, panel closed | `E7`, `E11` | pass |
| 7 row click still navigates | `E8` (+ `S5` guard) | pass |
| 8 description is the LOCAL event's | `E2` | pass |
| 9 sentinel reaches no row/panel | `E9`, `R2` | pass |
| 10 muted text renders muted | `E12` (+ `S14`, `S15`) | pass |

- [x] No criterion silently dropped.
- [x] No behavior added beyond the story. The diff is four modified files and one new component,
      every one named in the ADR's Implementation notes.
- [x] **Phase-4 `test/` diff is empty** (`git diff 9cc36697 HEAD -- test/ tests/` → no output). This
      is not a test-deliverable story, so the standing rule applies and is satisfied: the Implementer
      did not touch the suites judging them. Two tests (`S4`, `S14`) initially failed against the
      first implementation and the *code* was moved to satisfy them, which is the correct direction.

## ADR adherence

- [x] Every Implementation-note item is present: the two opt-in props and their defaults
      (`DataTable.jsx:34`), the single `rowKey` helper (`:88`) used at all three sites
      (`:138`, `:140`, `:158`), the extended filter predicate and its dependency (`:43–50`),
      the guarded header cell (`:130`), the guarded disclosure cell with its `stopPropagation`
      (`:158`), the panel row at `colSpan={columns.length + 1}` (`:171`), the widened empty-state
      colSpan (`:135`), and the docblock's stable-`uuid` precondition (`:29–32`).
- [x] The shared panel is one component used by both pages (`ui/src/components/TagDetailPanel.jsx`),
      not duplicated markup — the specific thing ADR §Implementation notes called for.
- [x] The `.text-muted` fix is **one CSS rule and nothing else** (`ui/src/styles.css:31`). No `.jsx`
      call site was edited (`ui/src/styles.css:32`), which is what the ADR demanded and what
      `S15` pins.
- [x] No new dependencies.
- [x] Layering respected: no page reaches into `DataTable` internals; the panel takes plain props.

**Verified the opt-in claim rather than accepting it.** The ADR's central risk is the other 23
`DataTable` callers. Checked in a browser on `/tapestry/concepts` (63 rows, 15 columns): **0 blank
header cells, 0 disclosure buttons, every row's cell count equal to the header's, console clean.**

## Concept-graph integrity

- [x] No concept definitions changed. **Firmware reinstall not required.**
- [x] No hardcoded pubkey anywhere in the diff — grepped all four source files for `[0-9a-f]{64}`:
      none. Both pages continue to resolve the TA at runtime via `useConfig()`, per CLAUDE.md
      § "Per-deployment TA pubkey".
- [x] The `description` tag this story surfaces was confirmed against the live graph
      (`/api/concept-graph/node/39998:<TA>:concept-header` carries `{"type":"description", …}`),
      not inferred from BIBLE.md.

## Things tests can't catch

- [x] No secrets; no leftover `console.log`/debug; no commented-out code; no TODO/FIXME.
- [x] `dist/` not committed.
- [x] **Cross-feature interaction the test suites do not cover, checked by hand:** opening a panel
      on Active z-tags and then flipping the "Show self-filed z-tags" toggle — which changes the row
      set from 18 to 43 rows — leaves the panel attached to the same row (`nostr user tag`), because
      identity is the coordinate, not the position. This is the failure mode the ADR's
      "row identity becomes load-bearing" consequence warned about, and it holds.
- [x] Panel row cannot navigate: it carries no `onClick` and no `clickable` class, so clicking
      inside a panel does not fire `onRowClick`.
- [x] Panel row geometry checked live: `colSpan="4"` against 4 header cells, inner div fills the
      cell (padding 0, border 0), so the `.data-table tbody tr:hover` rule cannot show through.
- [x] Concurrency: no new async paths. Both pages' existing scans are untouched — `R3` pins the
      call counts (1 for b-tags, 2 for z-tags) so a future edit cannot quietly add a fetch.

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint/typecheck/build tooling.
- [x] Local stack verification done through the `cycle-local` mechanism (`docker cp` into the
      container), not by assuming a bind mount.

## Findings

### Blocking

None.

### Non-blocking

1. **`ui/src/styles.css:32` — eight `.text-muted` call sites carry error or failure text, and this
   change makes them dimmer.** `HeaderEvent.jsx:49` renders an actual `{error}` string muted;
   `DatabaseSettings.jsx:163,185` render "Unable to load stats"; `Detail.jsx:156` renders
   "Shared concept not found."; `SelfDeclaredDetail.jsx:84` renders "Cannot locate the event on the
   community relay." Until now all of these rendered at full body colour by accident. Their authors
   chose the muted class, so the new rendering is what was *written* — but "written" and "wanted"
   may differ for a failure message, and nobody has looked at these strings since the class started
   working. Not a defect in this diff and explicitly owner-directed scope; flagged so someone
   decides whether those specific strings want `.error` instead.
   **Ledger row `2026-09-20-muted-class-dims-failure-messages`.**
2. **`ui/src/components/DataTable.jsx:34,50` — `filterKeys = []` is a fresh array each render and
   sits in the `filtered` dependency list**, so that memo no longer memoizes for a caller whose
   `columns` is stable. Exactly one caller qualifies (`BrainstormFollows.jsx:148`, which memoizes
   its columns); every other caller builds `columns` inline and was already recomputing. Impact is
   near-zero — `filtered` early-returns `data` whenever the filter box is empty, and is an O(n)
   substring scan otherwise. Not worth a `useMemo` on the caller side; recorded so a future reader
   does not mistake it for an oversight.
3. **`ui/src/components/DataTable.jsx:41,90–96` — the `expanded` Set is never pruned when
   `data` changes.** Deliberate, and the code says so. The visible consequence is that a row which
   disappears from the set and later returns comes back already expanded. Defensible; noted because
   the comment explains the *intent* but not this consequence.
4. **`ui/src/components/DataTable.jsx:154` — no `aria-controls`** linking the disclosure button
   to its panel row. `aria-expanded` is present and correct, so the state is announced; the
   relationship is not. Minor accessibility polish, not a blocker.

### Harness friction

1. **CLAUDE.md § House rules is wrong about local deployment, and it cost real time this story.**
   It states the repo is bind-mounted to `/usr/local/lib/node_modules/brainstorm` so "source edits
   are live." The running `tapestry` container has **no bind mount of the repo at all** —
   `docker inspect` shows four volumes (logs, neo4j, strfry, data) and nothing else — and was
   serving a baked image dated Sep 17 while the host `dist/` held a fresh build. The browser kept
   showing pre-change code with no error anywhere. The correct mechanism is the `docker cp` step
   that `.claude/skills/cycle-local/SKILL.md` documents accurately.
   **Ledger row `2026-09-20-claude-md-overstates-bind-mount`.**
2. **A full `npm test` is not completable on this machine**, so the Reviewer role's instruction to
   run the gate and quote a `gate:status` verdict cannot be satisfied here. Covered by the existing
   `OPEN.md` row 191; noted rather than re-filed.

## Verdict

**PASS**

The diff does what the story asks, matches the ADR point for point, and adds nothing beyond it.
Every acceptance criterion has a test, and the reviewer re-ran both suites rather than taking the
Implementer's word. The one genuinely risky part — extending a component with 25 callers — is
guarded structurally (`S1`, `S6`–`S9`) and was verified in a browser on a real non-opting page.
The four non-blocking findings are observations, not defects: none changes behaviour the story
specifies, and two of them (the muted error strings, the CLAUDE.md drift) are filed to the ledger
so they outlive this session (`2026-09-20-muted-class-dims-failure-messages`,
`2026-09-20-claude-md-overstates-bind-mount`).

The full 208-suite gate was not completed, for a documented pre-existing reason. That is the one
soft spot in this review and is stated rather than papered over: CI should run it before promotion.
