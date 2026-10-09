# Build Audit: Treasure Map — the cards say what needs attention, and show their details

**Book:** `engineering-team/audits/treasure-map-card-details/book.md`
**Date:** 2026-10-08
**Branch / commit range:** `feat/treasure-map-card-details`, `2447d98a..HEAD` (the book: intake `d15b478c` through the
close). The branch also carries the Concepts `39998`+`39999` hotfix (`b84484c8`, `2447d98a`), traced by ledger row
`2026-10-08-concepts-assignment-adds-39999`, which is not part of this book.
**Provenance:** Acceptance-frame
**Confidence:** high — every frame bullet maps to a PASS story with browser tests, and both stories were built and
reviewed in one session against a confirmed frame. The one thing not yet observed is the branch on staging, which the
close ships with.

## 1. What shipped

- A **"Needs attention" pill** on each `/treasure-map` category card (Scores, Lists, Concepts) that no Assistant
  covers. It uses `/assistant`'s words and shape in this page's light amber. In Edit mode it hides while a pick is
  pending for that card, and Undo brings it back. — `stories/done/treasure-map-card-details/1-needs-attention-pill.md`
- A **"Show details" toggle** on every card, opening a panel below the card's content. The panel lists each Map entry
  that counts for the category, in Map order and as written, with each Assistant's avatar, name and relay. Assistants
  after a key's first are marked "Backup", and labels mark individually assigned duties and the everything entry. In
  Edit mode the panel follows the draft. — `stories/done/treasure-map-card-details/2-show-details-panel.md`
- **One counting walk** behind the cards and the panels (`categoryEntries`), so a card's "Assigned to"/"Mixed" line
  and its panel can't disagree. — story 2

## 2. Epics & stories rolled up

### Epic: `treasure-map-card-details`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 needs-attention-pill | The pill on unassigned cards; hidden while a pick is pending | Done | `reviews/done/treasure-map-card-details/1-needs-attention-pill.md` |
| #2 show-details-panel | Per-card details panel; the shared `categoryEntries` walk | Done | `reviews/done/treasure-map-card-details/2-show-details-panel.md` |

Both stories ran the **Light (trial)** Feature lane: Gate A (owner, one exchange for both stories) → J1 → J2 → J3
(blinded gate-judges) → Gate B (a fresh Reviewer, then the owner's verdict: PASS after review findings 1 and 4, applied
in `c41782f7`). No ADR (a Design note each, ratified at Gate B).

## 3. As-built inventory

- **User-facing:** `/treasure-map` only (`ui/src/pages/treasure-map/Index.jsx`):
  - `CategoryCard` gained a title row holding the pill (`.bsd-tm-cat-attention`, `aria-hidden`), and a screen-reader
    prefix placed before the title span.
  - A "Show details"/"Hide details" disclosure button (`aria-expanded`; `aria-controls` while open;
    `aria-describedby` = the card's title), and the new `CategoryDetails` region named "<Title> details".
  - `ui/src/styles.css`: `.bsd-tm-cat-title-row`, `.bsd-tm-cat-attention` (`var(--orange)` = `#b45309` on
    `#fffbeb`, 4.84:1), `.bsd-tm-cat-details*`.
- **View-model:** `ui/src/pages/treasure-map/manageTreasureMap.js`:
  - New pure export `categoryEntries(event)`. `categoryAssistants` is now its projection, with the same answers:
    the Reviewer compared it with the staging version on 200,007 random Maps and found 0 differences.
  - `COPY` takes `needsAttention`/`needsAttentionSrPrefix` from `ASSISTANT_COPY` and adds eight panel words.
- **Name lookup:** the page now looks up every Assistant a panel lists, backups included (`wantedKey`).
- **Domain:** none. No concept, firmware, schema or event change. The page reads the same kind-10040 Map.
- **Data & contracts:** none. Nothing is signed, published or stored differently.
- **Tests:** two new Node suites, `test/treasure-map-needs-attention.test.js` (6) and
  `test/treasure-map-card-details.test.js` (17), registered in `test/registry.js`. Two new browser specs,
  `tests/brainstorm/treasure-map-needs-attention.spec.js` (14) and `tests/brainstorm/treasure-map-card-details.spec.js`
  (11). One step of `tests/brainstorm/treasure-map-edit.spec.js` E18 changed: the next control in tab order is now the
  card's own "Show details" button.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame: "a pill styled like the one on `/assistant`" | Same shape, words and weight; a darker amber (`#b45309`, not `#e3b341`) | interpretation | `/assistant`'s amber is 1.95:1 on white, under 4.5:1 (story 1 Design note; the owner approved it at Gate A) | None; it reads as the same pill on a light page | — |
| 2 | Frame: details "describe the edited draft" in Edit mode (owner's decision 4) | As specified. The session had recommended the published Map | — (owner's choice) | book decision 4 | The panel previews a pick before Save | — |
| 3 | Frame: details list "the assignments behind it" | Only entries that **count** for the card; `*:…`, a covered `*`, tags without a valid Assistant and unknown kinds are left out | interpretation | Story 2 AC-3: one rule with the card (AC-7) | A curious person can't see ignored entries here; the raw viewer still shows them | §6 (Advanced page, carried) |
| 4 | — | Backups are now looked up by name, so the cards also wait for backups' names before they first appear | constraint-discovered | Story 2 E1; review 2 non-blocking 3 | A rare reload of the cards, closing open panels | ledger `2026-10-09-unseen-backup-reloads-cards` |
| 5 | — | Keys are shown as written (`30382:rank`), not in plain words | deferred | Owner's decision 3 picked "the key as written"; story 2 Not covered | The panel reads as technical | §6 |

**Undocumented work:** none. Every file in `git diff --stat 2447d98a..HEAD` belongs to a story, its tests, the book,
or a ledger row. The one edit to an existing spec (E18) is named in story 2's Design note and was ratified at Gate B.

## 5. Quality state at close

- **Test gate:** `npm test` over the final tree (after the flip and the epic close-out): see the `gate:status` line
  below. Per story, the scoped Node gates (exit 0) and all 134 browser tests (both new specs and the seven existing
  Treasure Map and My Assistants specs) passed after the Gate B fixes. `eslint` on the touched UI files finds 1
  problem, the same `react-hooks/refs` error that `origin/staging` has.
  - `gate:status`: `20261009T031452Z-6708-d5b8 … on c4fc46a7+dirty — FAIL, exit 1, 5527 passed, 80 failed, 66 skipped,
    278/278 suites` ("dirty" means the uncommitted close edits this commit carries).
  - **Attribution:** all 33 failed suites are live-stack suites failing for environment reasons on this machine, and
    none touches `/treasure-map`. The local graph holds 9 concepts where they expect many; the stack answers 503/500
    or not at all; and two suites refuse to run unless the container is in local-only publish mode (OPEN.md row 191).
    The memory note on this machine records the same ~33 environmental suites. This run is also in a worktree, whose
    live tier talks to a stack serving the main checkout. Every suite this book touches passes in this run:
    `treasure-map-needs-attention`, `treasure-map-card-details`, `treasure-map-edit-mode`, `treasure-map-switches`,
    `treasure-map-save`, `manage-treasure-map-cards`, `manage-treasure-map-page`, `treasure-map-card-rule-edges`,
    `treasure-map-star-scopes-ignored` and `harness-lint`.
- **Known open issues (ledger):** `2026-10-09-treasure-map-muted-text-contrast` (the label chips at 4.18:1 and the faint
  lines at 3.12:1, page-wide); `2026-10-09-unseen-backup-reloads-cards`; the 320 px top bar,
  `2026-10-08-top-bar-scrolls-sideways-at-320` (existing; not this book's).
- **Debt:** none new from a Design note. The page's existing `react-hooks/refs` lint error is unchanged.

## 6. Carry-forward register

- [ ] Muted text and chips under 4.5:1 on `/treasure-map` (§5; ledger `2026-10-09-treasure-map-muted-text-contrast`).
- [ ] Open panels close when a newer Map adds an unseen backup (§4 #4; ledger `2026-10-09-unseen-backup-reloads-cards`).
- [ ] Plain-language names for keys in the details panel (`30382:rank` → "Rank") (§4 #5; story 2 Not covered).
- [ ] Ignored entries and unknown kinds have no home on this page (§4 #3). This is the full Advanced page, already
  carried by `audits/manage-treasure-map/audit.md` §6 and `audits/treasure-map-edit/audit.md` §6; not duplicated
  here.
- [ ] Whether a bare `39999` should be named in the draft Treasure Maps grammar, now that assigning Concepts writes it
  (the hotfix that rides this branch; ledger `2026-10-09-draft-grammar-bare-39999`).

## 7. Process findings (harness)

**Light trial record (light-profile.md § Trial protocol).**
- **Human stops:** 3. One intake exchange (four decisions), Gate A (both stories at once) and Gate B. The owner was
  also asked the close and ship question.
- **Judged interior:** 7 gate-judge spawns (J1 ×2, J2 ×3, J3 ×2), with 1 KICK_BACK (J2, story 1) and 0 HALT.
- **Gate B:** 2 and 3 non-blocking findings (corpus median 3), so the gates kept their teeth.
- **Escaped defects:** none yet.
- **Measurement:** `scripts/harness-stats.sh` at the close shows 267 reviews decided, 61 with a kick-back history
  (about 23%), and this book's 2 reviews with none.
- **Rules followed or bent:** the profile's rules were followed, except the two bends recorded as findings 5 and 6
  below.

| Finding | Source | Terminal state |
|---|---|---|
| 1. **Gate outcomes leaked to every judge through commit subjects.** This book's subjects said "j1: … design APPROVE", "J2 round 1 — story 1 kicked back" and "j3: … APPROVE", and every judge disclosed seeing them via `git log`. The outcome-free subject convention exists only for Direction mode (`roles/director.md`, ADR `harness-gate-integrity/0002`); the Light profile has no journal and no such rule. Ports: yes, Light should borrow Direction's rule. | J1/J2/J3 judges' blinding disclosures | OPEN.md row `2026-10-09-light-gate-outcomes-in-commit-subjects` |
| 2. **Parallel judges shared the session scratchpad, and one overwrote another's gate log.** Separately, judges and the Reviewer couldn't tell which build the :7799 preview served, so each rebuilt the UI. Ports: yes, to both flows. | J3 story 1 disclosure; the J2 re-judge, J3 and Reviewer reports | OPEN.md row `2026-10-09-judge-workspace-and-served-build` |
| 3. **A Light Gate B without the full suite has no `gate:status` line to quote.** The template doesn't say what to record instead. | Both reviews, § Harness friction | OPEN.md row `2026-10-09-light-gate-b-no-gate-status` |
| 4. **J2 kicked back story 1.** Two external error paths (the name lookup, a failed Save) had no handle, and one test with several legs (old N6) stopped at its second step before implementation, so its sentinel legs had never run. | J2 round 1 (story 1) | declined: the J2 rubric caught it as designed (items 2 and 4); fixed in `70b0709e`. A trial datum, not an amendment. |
| 5. **Bend: J2's advisories for story 2 were folded in after its APPROVE, without a re-judge.** The tests added were D2 monospace, D3 read error, D5 placement and Undo, and D10. | `70b0709e` | declined: additive tests that only strengthen the plan; J3 re-ran all of them and the fail-before record was re-run per test |
| 6. **Bend: the Gate B fixes were applied after the Reviewer's PASS and verified by the session, not re-reviewed.** | owner's Gate B verdict; `c41782f7` | declined: the owner's verdict named both fixes. The scoped gate, all 134 browser tests and lint were re-run green, and both reviews record it |
| 7. **Story 1's Gate-A scoped gate covered 2 of the 4 suites that import the touched module.** | J3 story 1, advisory b | declined: story 2's gate in this book runs all four; per-story gate naming is superseded by the queued honest-gates standing scoped runner (OPEN.md row 181) |
| 8. **Round history written into the story files**, against their own "never record verdicts or round history" line. | J2 re-judge advisory | declined: the existing rule was enforced at J2 and the history removed (`d53fd1ea`); no new rule needed |
