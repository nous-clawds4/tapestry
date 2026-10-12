# Build Audit: Duty Menu — the hub's Duty Menu page, built

**Book:** `assistant-duty-menu`
**Mode:** Acceptance-frame (no PRD)
**Anchor:** `engineering-team/audits/assistant-duty-menu/book.md` § Acceptance frame (confirmed at story 1's approval,
2026-10-11)
**Confidence:** high, with one gap: no signed-in viewer has seen the page on staging (see the paragraph under §5).
**Dates:** opened 2026-10-11, closed 2026-10-12 (about 14 hours)
**Book commits:** `186d4327` (story 1) … `a431ed6d` (story 2's review), on `staging`; listed in §2

## 1. What shipped

Every bullet of the acceptance frame is met. Each traces to a story that passed review.

- [x] **A real Duty Menu page** (story 1). `/assistant/duty-menu` stopped being a placeholder. It shows two panels side
      by side:
  - **What your Assistant offers:** each duty and its relay, as this instance would publish them;
  - **Your Assistant's published Duty Menu:** what is found for the Assistant now, or a line saying none was found.

  A status line says up to date, not published yet, or out of date, and one line says the menu is public.
- [x] **Honest rows** (story 1, owner answers). The offer lists:
  - **Scores** (`30382`), for the Owner and active customers;
  - **Lists** (`30392`, `30393`, `30394`) and **Concepts** (`39998`, `39999`), for every Assistant.

  Customers' Lists are offered as a commitment (`_intake.md`, 2026-10-11), and every row names this instance's own
  public relay (relay rule R1). Nothing else is listed.
- [x] **One-click publish** (story 2). **Have your Assistant publish its Duty Menu** signs the menu as the
      session's own Assistant, built on the server from the offer, and conforming to `duty-menus.md` §§ 4–6.1. It
      goes to this instance's relay first, then to § 8.1's four places (event-named relays only at public addresses,
      at most 50), and the page shows a per-relay report.
- [x] **A real mark** (story 1). The hub card, the count line and the Assistant Alert show **Done** only when a valid,
      current menu is found.
- [x] **On staging.** Deploy run 641 (`6ac4aa87`) succeeded, followed by the review commit's run. The signed-out smoke
      test on staging.brainstorm.world, 2026-10-11:
  - `/assistant/duty-menu` → 200;
  - `POST /api/assistant/duty-menu/publish` → 401;
  - `/api/assistant/attention` → `{"signedIn":false}`;
  - the live bundle carries the page's new sentences.
- [x] **Nothing else changes.** Your Assistant's Treasure Map is still an always-marked placeholder. `/treasure-map`
      and the other hub actions are unchanged, and `protocols/` is untouched by this book.

## 2. Epics & stories rolled up

### Epic: `assistant-duty-menu`

| Story | Commits | Verdict | Rounds |
|---|---|---|---|
| #1 The Duty Menu page and its check | story `186d4327` · ADR `0592560f`, A1 `81cc2988`, A2 `2a4e63ab` · tests `2d67d055`, `d8cdb0fe` · impl `b2477a93`, `b5c732ed` | PASS `1b9fcd5c` | 1 |
| #2 Your Assistant publishes its Duty Menu | story `692cac1b` · ADR `fc485945`, A1 `ee7f4074`, A2 `8d3b4957` · tests `f6f976c7`, `5dd50e29` · impl `6ac4aa87` | PASS `a431ed6d` | 1 |

Both stories passed review in round 1 with no blocking findings: 14 non-blocking for story 1, 7 for story 2. Each
ADR took two amendments. The first came out of Test Design (points the Tester flagged). The second came out of
Implementation:
- story 1: the spec's fifth § 6.1 condition, accepted mid-book by another session, a 50-relay cap, and a repeated
  sentence;
- story 2: the route-table entry, the signing helper, and the no-other-relay sentence.

The owner approved every amendment at a gate.

## 3. As-built inventory

- **Server**
  - `src/lib/nous.js`: the one definition of Nous' key.
  - `src/lib/duty-menu/index.js`: pure. `isDutyMenu` (§ 6.1, five conditions), `readMenuRows`, `normalizeMenuKey`,
    `sameRows`, `buildOffer` (K1) and `buildMenuTags`.
  - `src/api/assistant/dutyMenu.js`: the check.
    - **The offer:** R1, a customer's status, and the DList fallback when there is no public address.
    - **The read:** local-first; otherwise § 8.1's two rounds, with the DNS guard and a 50-relay cap.
    - **The cache:** Nous' relay list, for one hour.
    - **The answer:** `{ offer, published, current, finished, done, pending, reason }`.
  - `src/api/assistant/dutyMenuPublish.js`: `POST /api/assistant/duty-menu/publish`, session-bound. It never reads
    the body; it checks the signer and § 6.1 before any write, writes here first, then sends to the configured relays
    and the guarded event-named relays.
  - `src/utils/relayHostGuard.js`: the DNS guard, moved unchanged out of `relayListPublish.js`, which re-exports it.
  - `src/api/assistant/attention.js`: a fifth isolated check, `duty-menu`.
  - `src/middleware/routeAccess.js`: the route opens as `signed-in`.
  - `src/api/index.js`: the route is registered.
- **UI**
  - `ui/src/pages/assistant/DutyMenu.jsx` and `dutyMenuCopy.js`: the page.
  - `ui/src/utils/publishAssistantDutyMenu.js`: the client helper.
  - `actions.js`: `duty-menu` is in `CHECKED_ACTIONS`.
  - `App.jsx`: an `ACTION_PAGES` entry.
  - `styles.css`: the row classes.
- **Docs:** `src/api/openapi.yaml` (the attention action and the route) and BIBLE §11 (both rows).
- **Tests**
  - New: `test/assistant-duty-menu-check.test.js` (61), `test/assistant-duty-menu-page.test.js` (15),
    `test/assistant-duty-menu-publish.test.js` (33), `test/helpers/dutyMenuFixtures.js`,
    `tests/brainstorm/assistant-duty-menu.spec.js` (17, browser).
  - Re-aimed with reasons in the plans: `assistant-duty-cards`, `assistant-management-page`, `assistant-attention`,
    `assistant-outbox-check`, `assistant-profile-check`, `assistant-trusted-content`,
    `assistant-identification-tags-page`, `assistant-relay-list-publish` (S3 strict again, A10), and
    `assistant-taggings-publish`; plus five browser specs.
- **Undocumented work in the diff:** none. Every changed file traces to an ADR sub-decision or amendment.

## 4. Deviations from intent

| # | Specified | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame: "only duties this instance actually publishes" | Lists offered for every Assistant, though customers' Assistants don't sign Lists yet | Owner decision | Story 1 open question 2, the owner's own answer | A reader following a customer's Lists row finds nothing signed by that Assistant until support is built | `_intake.md` 2026-10-11, "Customers' Assistants publish Lists" |
| 2 | Story 1 AC-2: turning an outside copy on or off changes the offer | The router's copies never change the offer; the instance's relay address, customer status and DList relays do | Amended (R1) | ADR 0001 gate; story 1 § Deviations | The menu names the relay that always holds the insights, not the community relay | Ledger `2026-10-11-nip85-home-relay-without-copy` |
| 3 | Story 1 AC-3: the latest version across every answer | Local-first: a local version counts and no outside relay is asked (story 2 AC-5) | Planned follow-up | Story 1 review NB1, NB2; ADR 0002 R-A | Hub loads stop waiting on outside relays once a menu is published | — |
| 4 | Spec § 6.1 as written at intake: four conditions | Five conditions, ahead of the spec text, then matched by `bc37a62c` | Spec moved mid-book | ADR 0001 Amendment 2 item 1, following accepted ADR `duty-menus-and-self-maps/0003` | None for this instance's own menus | — |
| 5 | § Copy: a "none" panel line identical to the status line | Panel says "No Duty Menu was found for your Assistant." | Amended copy | ADR 0001 Amendment 2 item 3 | No repeated sentence | — |
| 6 | Story 2 § Copy: profile-publish summaries | Its own sentence when no relay outside this instance is named | Amended copy | ADR 0002 Amendment 2 item 3 | A fresh instance's publish reads truthfully | The all-refused case: ledger `2026-10-11-all-refused-summary-says-unconfigured` |

## 5. Quality state at close

- **Gate after the flip and the epic close-out:** `20261012T000114Z-17132-bf9d [book-close] started 2026-10-12T00:01:14.677Z on bc37a62c+dirty — PASS, exit 0, 5729 passed, 0 failed, 582 skipped, 303/303 suites`.
  The tree was uncommitted at the time: this audit, the seed, `book.md`, the epic's Done flip, the `done/` moves and the intake marker.
- **Story gates at PASS:**
  - story 1: `20261011T210326Z-20170-8287` (5665/0, 301 suites);
  - story 2: `20261011T231005Z-5819-2ddf` (5729/0, 303 suites).
- **Browser:** the Duty Menu spec passed 17/17 against a Vite build with Chromium, mocking sign-in and the answer. The
  neighbouring hub specs passed 75–84, with 4 skipped by their own guards.
- **`harness-lint`:** clean.
- **Verified later, 2026-10-12:** the owner published from the page on staging while signed in, which surfaced the bug
  fixed by book `duty-menu-public-relay`, and then republished: a valid menu with all six rows at the instance's relay.
- **Not verified at close:** no signed-in viewer had used the page on staging. The browser specs mock sign-in, and this
  container has no nostr login. **The owner's first press of the button on staging is the real end-to-end check.**

## 6. Carry-forward register

- [ ] **Your Assistant's Treasure Map page** (self-Maps). Its spec landed with book `duty-menus-and-self-maps` story 3
      (`05225a6b`, `bc37a62c`). This is the next page for the hub's persona section, and a new book.
      *Picked up 2026-10-12 → book `assistant-self-map` (open).*
- [ ] **Customers' Assistants publish Lists.** This is the commitment behind deviation #1 (`_intake.md`, 2026-10-11).
- [ ] **Map vs menu relay for Scores.** The 10040 template names `wss://nip85.brainstorm.world`, but nothing copies
      Scores there by default (ledger `2026-10-11-nip85-home-relay-without-copy`).
- [ ] **When every named relay is refused by the guard,** the publish summary says relays aren't configured. This
      affects both publish routes (ledger `2026-10-11-all-refused-summary-says-unconfigured`).
- [ ] **Security posture**, both tracked in ledger rows:
  - CSRF for the two Assistant signing routes joins OPEN.md row 326 (ledger
    `2026-10-11-assistant-signing-routes-csrf-scope`);
  - the DNS-rebinding gap now covers three relay-guard paths (ledger
    `2026-09-20-nip05-guard-leaves-dns-rebinding-open`, scope note).
- [ ] **No auto-publish.** When Relay Settings or a customer's status changes the offer, the card returns to **Needs
      attention** until the person presses again. That is a product question (seed §7).
- [ ] **Menu extras.** Rows only today; a `name`, a `description` and per-duty details are deferred (story 2 open
      question 1).
- [ ] **Nous publishes the Duty Menu header** (outside the repo). It's needed for § 8.2's "all menus" query and for
      adding Duty Menu to a dictionary.
- [ ] **Small code notes from the reviews**, none blocking:
  - a load failure of `dutyMenu.js` turns the hub answer into a 500 (story 1 NB3; the same pattern as trusted
    content);
  - `getCustomer` can create `customers.json` (NB6);
  - duplicate Map and relay-list reads (story 1 NB14, story 2 NB7);
  - `attention.js:51`'s "nothing is stored anywhere" line (story 2 NB2);
  - test D6's near-vacuous alternative (story 2 NB6);
  - ADR 0002's latency figure (story 2 NB3).
- [x] **Promote to production.** Done 2026-10-12: PR #851, merge `df457d65`, deploy run 149, smoke clean. This book and `assistant-shared-categories`, whose production promotion waits on
      this book (`e5e04aea`), ride `staging` together.
- [ ] **The FAQ** still doesn't mention the Duty Menu. This item is carried from book `assistant-duty-cards` §6.

## 7. Process findings (harness)

**Measured with `bash scripts/harness-stats.sh` at retro time:**
- 289 reviews decided, kick-back rate 0%, churn 3;
- books: 9 open, 79 closed;
- cycle-time median 0d.

This book fits that profile: two stories, both PASS in round 1, opened and closed the same day. The cost showed up in
amendments instead: four ADR amendments, each followed by a Tester and an Implementer round.

| Finding | Source | Ports to the other flow? | Terminal state |
|---|---|---|---|
| 1. A session told to develop on `staging` pushed Phase-3 failing tests to the shared line. The parallel book's red tests reddened the tip for this book's reviewer too. When `staging` moved mid-phase, this session pushed its finished commits from a scratch worktree instead (cherry-pick onto `origin/staging`), so the agents' working tree was never disturbed. | story 1 review, Harness friction 2; this close | Yes. Direction supervises the same chain. | OPEN.md row `2026-10-07-staging-sessions-push-red-tests` (recurrence appended at story 1's review; already OPEN) |
| 2. Phase documents cited commit hashes that a later rebase onto shared `staging` orphaned. | story 1 review NB13, Harness friction 1 | Yes | OPEN.md row `2026-10-11-phase-docs-cite-rebased-hashes` (new, `meta`) |
| 3. The ADR template doesn't prompt for a new route's entry in the fail-closed route table. The Implementer found the gap, and it cost an amendment and a Tester round. | story 2 review, Harness friction | Yes | OPEN.md row `2026-10-11-adr-template-misses-route-table` (new, `meta`) |
| 4. A protocol the code reads was edited by another session mid-book (ADR `duty-menus-and-self-maps/0003`, then `05225a6b` and `bc37a62c`). The book's shared-lines rechecks (before Implementation, at Review, at close) caught each change in time, and none needed rework. | book.md § Shared lines; this close | Yes | **Declined:** the existing rule (ledger `2026-09-22-parallel-books-no-shared-line-recheck`, applied through the book's § Shared lines) worked as designed. No change is needed. |
| 5. Each ADR needed a Test Design amendment for points the Tester flagged: a status line when the check is unfinished, the spelling of the DList relay, one local scan, A10's re-aim. Those are small decisions the Architect could have named. | ADR 0001 A1, ADR 0002 A1 | Yes | **Declined:** the Tester-flags, Architect-amends loop is the harness working as intended. Each amendment cost minutes and was owner-approved at the next gate. A checklist for every such corner would cost more than the loop. |
| 6. The cloud container had no `node_modules`, and no Docker daemon, so there was no local stack. Browser specs ran against a Vite build with Chromium and mocks. Installing `ui/node_modules` turned two `honest-publish-reporting` suites from skip to pass, so the gate's counts vary with the environment. | this close | Yes, equally | **Declined:** the environment's setup script is the owner's, not the repo's. The skip-to-pass shift is the suites' own guard working, and both runs were recorded. The browser-without-stack recipe is already covered by ledger `2026-09-20-live-tier-fails-on-stale-stack`. |
| 7. The worker process restarted three times mid-session. | this close | — | **Declined:** an environment event with no harness surface. Every restart resumed cleanly from git state. |

## 8. Epic close-out

`assistant-duty-menu`: both stories are Done and on `staging`. The epic flips to **Done**, and its story, ADR and
review folders move under `done/`.
