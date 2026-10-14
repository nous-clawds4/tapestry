# Build Audit: About this Brainstorm Instance — Owner, Admins, and Customer count on /about

**Book:** `engineering-team/audits/about-this-instance/book.md`
**Date:** 2026-10-14
**Branch / commit range:** `staging`, the book's commits `b6195500`..`072c4274` (ten commits, listed by `git log --grep="about-this-instance"`). Other books' commits interleave on `staging` and are not this book's.
**Provenance:** Acceptance-frame
**Confidence:** high. The frame was written at kickoff from the operator's own words, quoted verbatim in `book.md`, and confirmed before any code. Every later change to intent is an operator decision recorded in the book.

> The Build Audit is the **as-built record**: what the product *is* now, factual and source-linked. It does not propose changes; that is `prd-seed.md`'s job.

## 1. What shipped

- **A section, "About this Brainstorm Instance", at the bottom of `/about`**, for every visitor, signed in or not.
  - The subtitle reads "Who runs this instance, and how many customers it serves."
  - It shows the instance's Owner, its Admins with their count, and the number of Customers.
  - Each person is a card with their profile name, NIP-05 address and picture, falling back to a shortened npub. The card opens their profile at `/user/<pubkey>`.
  - Delivered by `stories/done/about-this-instance/1-owner-admins-customer-count.md`.
- **A public read, `GET /api/about-this-instance`.** It answers only the Owner's pubkey, the Admins' pubkeys and the customer count. Same story.
- **A customer count by the operator's rule:** every account this instance holds an Assistant key for, minus the Owner, the Admins, and any Assistant this instance holds the key for. Active and inactive customers count alike. The count never decrypts a private key. Same story.
- **A link, "About this Brainstorm Instance", on `/about-brainstorm-search`**, landing on the section (`/about#this-instance`). Same story.

It is live on `staging.brainstorm.world`. On 2026-10-14 staging showed its real owner, 5 admins and "5 customers"; the review's live checks have the detail. It has **not** been promoted to production.

## 2. Epics & stories rolled up

### Epic: `about-this-instance`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 owner-admins-customer-count | the `/about` section, its public read, the customer count, the link | Done | `reviews/done/about-this-instance/1-owner-admins-customer-count.md` (round 1 CHANGES_REQUESTED, round 2 PASS) |

ADR: `decisions/done/about-this-instance/0001-public-instance-roles-read.md` (accepted 2026-10-13; Amendment 1 at Implementation).

## 3. As-built inventory

Derived from the files the book's commits touched (22, every one covered by the story or the ADR).

### User-facing
- `/about` gains the section (`ui/src/components/AboutThisInstance.jsx`, rendered at the end of `ui/src/pages/BrainstormAbout.jsx`).
  - The anchor is `#this-instance`, and the section scrolls itself into view when the address carries it.
  - States: loading ("Loading…"), loaded, failed ("Couldn't load this instance's details.").
  - Within the loaded state: no Owner configured ("No owner configured"), zero Admins ("No admins"), and a count that could not be taken ("Customer count unavailable").
- `/about-brainstorm-search` gains the link (`ui/src/pages/BrainstormAboutSearch.jsx`).

### Domain
- No concepts, handles, event kinds or firmware were touched. No firmware reinstall.
- The roles Owner, Admin, Customer and Assistant are read from config and the key store, never changed.

### Data & contracts
- **Route:** `GET /api/about-this-instance` (`src/api/owner/aboutThisInstance.js`, registered in `src/api/index.js` beside `owner-info`).
  - Public read in the route table (`src/middleware/routeAccess.js`).
  - Documented in `src/api/openapi.yaml`.
  - Shape: `{ success, ownerPubkey, adminPubkeys, customerCount }`. `customerCount` is null when the key store cannot be read.
- **Key store:** `SecureKeyStorage.listStoredAccounts()` and `getStoredPubkey(accountPubkey)` (`src/utils/secureKeyStorage.js`). They are implemented for the `encrypted-file` backend only; the placeholder backends throw.
- **The count:** `countInstanceCustomers(deps)` (`src/utils/assistantKeys.js`).
- **Tests:**
  - `test/about-this-instance.test.js`: 29 tests, registered in `test/registry.js`.
  - `tests/brainstorm/about-this-instance.spec.js`: 13 browser tests.
  - `test/helpers/aboutThisInstanceFixtures.js`: the shared words and fixture people.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | The original ask: "a new page … `/about-this-instance`" | A section on the existing `/about` | intentional-change | The operator noticed `/about` already existed and changed the plan before Planning (book decision 1) | One page fewer; the link now targets `/about#this-instance` | — |
| 2 | Planning: customer identities stay private (story Background, epic, book decision 2, as first written) | Customer pubkeys and names were **already public**, through `GET /api/get-customers`, `GET /api/assistant/roster`, and the app shell's roster fetch on every page. This book adds none. | constraint-discovered | An earlier deliberate decision (ADR `author-scoped-inspection/0001`), found at Architecture (ADR Context) and Implementation (ADR Amendment 1). The operator approved correcting the docs and queuing the question. | None for this feature; the wider question is open | §6 item 1 |
| 3 | AC-4 "nothing the **page** displays or loads reveals a customer's identity" | "nothing the **section** …" | constraint-discovered | The app shell reads the roster on every page, so the page-wide wording could never hold. The operator approved (ADR Amendment 1; test-plan Amendment 1). | None: the section itself never loads customer identities (S7, B5) | §6 item 1 |
| 4 | Frame decision 3: Customer = holds an Assistant key, minus Owner, Admins and Assistants | As specified. This differs from the customer list the admin pages and sign-in use: inactive customers and unlisted key holders count, listed customers without a key do not. | interpretation (by design) | Book decision 3; ADR Decision 2 and Consequences | The public number can differ from the admin pages' customer list | — |
| 5 | "Any account that is itself an Assistant" | Only Assistants this instance holds the key for: the TA, or any key holder's Assistant | interpretation | An Assistant run by another instance can't be recognised from here (ADR Decision 5; book decision 7) | Such an account holding a key here would count as a customer | §6 item 10 |
| 6 | The design's light palette | The design's layout in `/about`'s dark styling | intentional-change | Book decision 5 | — | — |
| 7 | The design's subtitle "how many people use it" | "how many customers it serves." | intentional-change | Book decision 6 | — | — |
| 8 | — | "No owner configured", the "Loading…" line, and the route-table entry in alphabetical order | added-beyond-scope (small) | Story `## Deviations` | — | — |
| 9 | AC-2: each card shows the profile name | A name is taken only from a field that is non-empty text, else the shortened npub | constraint-discovered | Review round 1, Blocking 1: a non-string Owner or Admin profile name took down all of `/about`. Fixed in round 2 and pinned by B11. | A malformed profile can no longer break the page | — |

**Undocumented work.** None. Every file the book's ten commits touched is named by the story, the ADR or the test plan.

## 5. Quality state at close

- **Test gate over the close's own tree (after the book flip and the epic close-out):**
  > `20261014T002831Z-7922-1ae2 started 2026-10-14T00:28:31.711Z on 072c4274+dirty — FAIL, exit 1, 6021 passed, 41 failed, 582 skipped, 311/311 suites; failed: assistant-scores-route, assistant-scores-page`

  "+dirty" is this close's uncommitted edits. Everything this book owns passes: `about-this-instance` 29/29 and `harness-lint` 85/85. The two failing suites are **another book's intentionally failing tests**: book `assistant-scores`, commit `11d5c626` ("test: failing tests for the-scores-page … Intentionally failing, awaiting the owner's approval"). They reached `staging` after this book's last code commit and entered this tree when the review commit was rebased onto `origin/staging`. Their 41 failures (29 + 12) are the count that book's own commit message gives.
  - `11d5c626` is **not** an ancestor of `efd1b1d3`, this book's last code commit. The gate on that commit was clean: `20261014T000151Z-24101-40bd … on efd1b1d3 — PASS, exit 0, 6020 passed, 0 failed, 582 skipped, 309/309 suites` (review round 2).
  - A first run over the close (`20261014T002233Z-28776-d8fa`) also failed `harness-lint`, on this close's own ledger id: a slug of seven words, one over the limit. It was renamed to `2026-10-14-self-review-needs-independent-check`, and lint now passes.
  - This is the friction recorded in §7 row 1, seen from the other side: a red `staging` blocks a clean close-time gate for every book that lands after it.
- **Browser spec:** 13/13 (review round 2).
- **Live on staging:** deploy run 716 (`efd1b1d3`). The review's headless checks pass.
- **Known open issues:** none that breaks the story. The review's non-blocking notes are rolled into §6.
- **Debt the ADR logged (Consequences):**
  - No cache on the public read (a deliberate choice).
  - The placeholder key-store backends must implement `listStoredAccounts` if they are ever built.
  - The roster's practice of hiding Admins from non-owners no longer protects anything, and was left as is.

## 6. Carry-forward register

- [ ] **Should customer identities stay public?** `GET /api/get-customers` and `GET /api/assistant/roster` serve them to visitors, and the app shell fetches the roster on every page. This is a product and security decision, queued as `_intake.md` 2026-10-13, "Should customer identities stay public?" (§4 #2, #3).
- [x] **Promote to production.** Done 2026-10-14: a selective promotion of this book alone (PR #863, merge `b38378ad`, deploy run 157). It passed the safe-to-merge check before the merge and all five smoke-test tiers after it. On production, `/about` shows the owner, 7 admins and "4 customers"; the count agrees with the public roster.
- [x] **Verify profile pictures on the live cards** (the operator confirmed them on staging in a browser, 2026-10-14) in an ordinary browser. The build container could not reach any image host, so only the fallback was seen (review round 1, Quality gates).
- [ ] **Per-visit cost and log volume on the public read.**
  - About 9 log lines per anonymous GET: `getConfigFromFile` logs on every read, and the key store logs "Loaded master key from".
  - The count's I/O is synchronous, about 12 ms with 300 key holders.
  - Option: pass the Owner and Admins into the count instead of re-reading them, or memoise briefly. (Review non-blocking 3.)
- [ ] **The public GET can create the key-store directory** through the store's constructor, on an instance with a master key but no directory (review non-blocking 4).
- [ ] **A wrong or rotated master key is not detected.** Every file then fails to decrypt, and accounts that are themselves Assistants would count as customers (review non-blocking 5).
- [ ] **A throwing config read inside the count answers 500, not a null count.** Latent, since the real readers catch internally (review non-blocking 6).
- [ ] **Accessibility.**
  - The Owner / Admins / Customers labels are not headings.
  - "Loading…" has no live region.
  - Multi-code-point emoji initials (flags, ZWJ sequences) show only their first code point.
  - (Review non-blocking 7; round 2.)
- [ ] **No test exercises the handler's real default deps end to end.** The independent check did it by hand (review non-blocking 8).
- [ ] **Recognising Assistants run by other instances** (§4 #5; ADR Decision 5).
- [ ] **`/about` vs `/about-brainstorm-search` overlap.** Still two pages. Carried, not resolved, from `audits/about-brainstorm-search/audit.md` §6. This book linked them rather than merging them.

## 7. Process findings (harness)

Inputs harvested:
- the round-1 and round-2 "Harness friction" sections of the review;
- the book's ledger rows;
- the session's own record of process friction. This is a human-gated book: there is no `journal.md`, and no process-shaped `## Deviations`.

`scripts/harness-stats.sh` at retro time reported:
- this book: open, 1 day; 9 phase commits matched to its epic;
- the story: 0 days from story to review (same day);
- repo-wide: 299 reviews decided, 0% kick-back rate, 84 closed books, 214 open meta lessons before this close.

This story's own round-1 CHANGES_REQUESTED is one of the 299.

| Finding | Source | Terminal state |
|---|---|---|
| **A cloud session pinned to `staging` can't commit failing tests the repo's way without turning every open PR's CI red.** Here the test commit was held back and pushed with the code, so the implementation reached staging before Review. The same day, book `assistant-scores` pushed its failing tests to `staging` (deploy run 717). Ports to Direction mode as well: same branch rule. | review round 1 and round 2 § Harness friction | OPEN.md row `2026-10-13-staging-pinned-session-vs-failing-tests` |
| **The session started on a clone 495 commits behind `origin/staging`, and the network-free SessionStart digest couldn't tell.** The first answers to the operator were researched on 8-day-old code; Planning's drift preflight caught it. Ports to both flows. | session record (Planning step 0) | OPEN.md row `2026-10-14-session-start-stale-clone-unflagged` |
| **A browser test saying "this page never requests X" fails on requests the app shell makes on every page.** It cost a kick-back to the Tester and an AC change. Ports to both flows. | test-plan Amendment 1; ADR Amendment 1 | OPEN.md row `2026-10-14-negative-request-assertions-need-shell-baseline` |
| **When one session plays every role, its own review passed a page-breaking defect that an independent checker found.** The workflow's check is optional, and was applied here anyway. Ports to both flows. In Direction mode the blinded gate judge already provides independence. | review round 1 (Independent check applied; Blocking 1) | OPEN.md row `2026-10-14-self-review-needs-independent-check` |
| **A first answer to the operator was wrong: it said customers were private.** It came from reading the old auth middleware's lists rather than the route table. | session record; ADR Context | declined: caught by the Architecture phase's required code reading, which is the harness working as designed. `src/middleware/routeAccess.js`'s header already names itself the source of truth, and the stale clone is covered by the row above. |
| **A `vite preview` background server was stopped by the tool's background time limit mid-phase.** | session record | declined: an environment limit, not a harness defect. Restarted with the longest allowed timeout; ledger row `2026-10-13-vite-preview-pid-orphans` already covers stopping it cleanly. |
