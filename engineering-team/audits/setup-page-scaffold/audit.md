# Build Audit: The /setup page — Brainstorm's setup checklist, as a scaffold

**Book:** `engineering-team/audits/setup-page-scaffold/book.md`
**Date:** 2026-09-21
**Branch / commit range:** `6fd8759d..e4fb2c8b` on `feat/setup-page-scaffold` → staging PR #720
(`e8d15892`) → main PR #721 (`82771a44`)
**Provenance:** Acceptance-frame *(no PRD; frame written at intake and confirmed at story approval,
never amended)*
**Confidence:** high — the anchor was captured at intake with the owner's ask quoted verbatim from
the transcript, the book had one story, and everything it asked for is observable in production.

> The Build Audit is the as-built record. It does not propose changes — that is `prd-seed.md`'s job.

## 1. What shipped

- **A `/setup` page** in the Brainstorm Search shell, modelled on Brainstorm's "Finish setting up
  your account" checklist: a kicker, the heading, "0 of 3 complete" over an empty progress bar, and
  the three steps in order — Create your account, Create your follow list, Activate your Brainstorm
  account — each shown as not done, with a badge and one sentence — `stories/done/setup-page-scaffold/1-setup-page-and-placeholders.md`
- **Three placeholder pages**, one per step, at `/setup/create-account`, `/setup/follow` and
  `/setup/activate`. Each names its step, says "Placeholder page.", says in one sentence what the page
  will do in the owner's terms, and links back to `/setup` — story #1
- **The same page for everyone.** Nothing on the four pages reads or writes the viewer's data, and
  the body is identical signed in or out — story #1 (AC-6)
- **The owner's deferred list, written down where the next session will find it** — the
  `_intake.md` entry dated 2026-09-20, which `/whats-open` lists — story #1 Out of scope

## 2. Epics & stories rolled up

### Epic: `setup-page-scaffold`

| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 setup-page-and-placeholders | `/setup` checklist (all steps not done), three placeholder pages, four top-level routes | Done | `reviews/done/setup-page-scaffold/1-setup-page-and-placeholders.md` — PASS |

One story, one review, PASS on the first pass with no blocking findings. Its four non-blocking
findings: the back link's hover hue became a ledger row, because the same behaviour is app-wide
(§6 #7); two small record fixes landed in `e4fb2c8b` (the walkers read only `.js`/`.jsx`, and the
ledger row the story cites is now filed); and the strings the page renders beyond § Copy are
recorded in §4 #8. A draft-stage finding — the epic's summary of upstream's activation rule — was
corrected in `6acc64e9` before the review finalized.

## 3. As-built inventory

**User-facing — routes added** (top level, beside `/settings` and `/about`; not under the
`/tapestry` `Layout`):

| Route | Component | Shell |
|---|---|---|
| `/setup` | `SetupIndex` (`ui/src/pages/setup/Index.jsx`) | `bsp-page` + `TopBar` |
| `/setup/create-account` | `SetupCreateAccount` (`ui/src/pages/setup/Placeholders.jsx`) | same |
| `/setup/follow` | `SetupFollow` | same |
| `/setup/activate` | `SetupActivate` | same |

**New modules:** `ui/src/pages/setup/steps.js` — the three steps (path, label, badge, sentence,
placeholder sentence) as one list that feeds both the checklist and the placeholder headings;
`Index.jsx`; `Placeholders.jsx`. Each step on `/setup` is a real `<Link>`, so it opens in a new tab
and works from the keyboard. The progress bar is a labelled `role="progressbar"` (0 of 3). A
screen-reader-only "Not done:" (the existing global `.bs-sr-only`) leads each step's link text.

**CSS:** an additions-only `bs-setup-*` block at the end of `ui/src/styles.css` (kicker, title,
progress, step cards, badge, marker, placeholder box, back link, one ≤480 px rule). The step card
pins `color: inherit` on hover because the global `a:hover` colour would otherwise turn its text blue.

**Domain:** none. No concept, handle, schema, firmware seed or relationship was created or changed.
The concepts the story names (`tapestry assistant`, `nostr user`, `web of trust`) are for orientation
and wired to nothing.

**Data & contracts:** none. No API route, event kind, stored shape, session or auth change. The
server needed no change: `/setup/*` falls through to the SPA catch-all (`bin/control-panel.js`) and
passes the honest-404 rule (`src/utils/siteTrust.js`, `isBlockedProbePath`). No forced sign-out on
promotion.

**Records filed during the book** (harness, not product): the book, epic, story and review; the
`_intake.md` entry; ledger rows `2026-09-21-abbreviated-path-names-no-gate`,
`2026-09-21-gate-status-current-lags-one` and `2026-09-21-bs-link-hover-turns-sky-blue`; dated notes
on OPEN.md rows 27, 196 and 213.

## 4. Deviations from intent

The anchor is the acceptance frame plus the owner's ask it quotes. Harvested from the story's
§ "Where Tapestry departs from Brainstorm, on purpose", its Open questions (all resolved at
approval) and § Deviations, and the review; reconciled against the diff.

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame 1: a setup page "modelled on Brainstorm's" | Brainstorm's structure and words, in Tapestry's dark Brainstorm Search styling; numbered markers where Brainstorm shows icons; badges and kicker in sentence case where Brainstorm uses capitals; no done-row variant | interpretation | Story § "Where Tapestry departs" ("The look is Tapestry's"); § Deviations — `ui/` has no icon library, and sentence case keeps the page identical to the approved § Copy | None negative | A done state has not been designed (§6 #8) |
| 2 | The ask: the follow list is "your kind 1 nostr event" | The copy says **kind 3** | interpretation | Follow lists are kind 3 (NIP-02). Raised at intake, resolved at approval (story Open questions #3); the owner's typing survives in the book's verbatim quote | Accurate copy | — |
| 3 | Frame 2: all three shown not done "for every viewer" | Signed-out visitors see the page too; Brainstorm's `/setup` requires a sign-in | interpretation | Nothing on the page is per-viewer yet, so there is nothing to sign in for (story Open questions #1, approved) | Anyone with the URL can see the checklist | Revisit when real checks exist (§6 #3) |
| 4 | The ask: "a Setup Alert … that will direct the user to the /setup page" | No entry point of any kind; `/setup` is reached by typing its address | deferred | The owner's "not yet" list, plus story Open questions #2 (no interim link, approved) | Nobody finds `/setup` unless told | §6 #1, #6 |
| 5 | The ask: check each action's real state, and build the action pages' UX | Neither built; three placeholder pages | deferred | The owner's "not yet" list, quoted verbatim in `_intake.md` 2026-09-20 | The page cannot yet help anyone set up | §6 #1 |
| 6 | Brainstorm's step 1 is always done (you are signed in) | Step 1 shows not done and links to `/setup/create-account` | intentional-change | The owner's ask: display as if none of the three is done; for Tapestry, step 1 means setting up your Tapestry Assistant | Step 1 has a page of its own | What step 1 means per visitor (§6 #2) |
| 7 | Brainstorm's URLs: follow → `/welcome?next=/setup`, account → none | `/setup/create-account`, `/setup/follow`, `/setup/activate` | intentional-change | The owner's ask named the three URLs | — | — |
| 8 | § Copy (the approved words) | Also renders a screen-reader-only "Not done:", the step numbers 1–3 and a `›` chevron, none of them in § Copy | added-beyond-scope | Accessibility and visual affordance (story § Deviations; review non-blocking 4) | Screen readers announce each step's state | — |

**Undocumented work** — none. Every product file in the diff traces to story #1. The two later
commits are records: `6acc64e9` corrects the story's Deviations wording and the epic's and intake
entry's summary of upstream's activation rule (the review's draft-stage findings), and `e4fb2c8b`
files the review's harness findings (§7) and fixes its non-blocking 2–3. The promotion also carried PR #719, a docs-only ledger row from another
session; it is not part of this book. The close itself changes one code file: the comment in
`ui/src/pages/setup/steps.js` that points editors at § Copy now names the story's `done/` path.
Rebuilding after that edit gives the same bundle, `index-_zLoQMny.js`, so it is inert at runtime.

## 5. Quality state at close

- **`npm test` at close** — run after the book flip and the epic close-out, over the tree this close
  leaves behind (uncommitted at the time, hence `+dirty`):
  `20260921T051946Z-96058-27a5 [book-close-setup-page-scaffold] started 2026-09-21T05:19:46.601Z on
  e8d15892+dirty — FAIL, exit 1, 3542 passed, 5 failed, 59 skipped, 214/214 suites; failed:
  tl-membership-method-selector, tl-weighted-sum-method, tl-certainty-method,
  summaries-element-count`. The same four suites as at review (rows 191 and 285). `harness-lint`
  passed 76/0, so L2 (a Closed book ⇒ its epics Done) holds on the closed tree, and the three
  `ui/src` walkers passed. The ten extra skips are `tag-index-publish`, which skipped because the
  local Meilisearch task queue was busy ("task queue busy — re-run when the stream-consumer ETL
  settles"); it passed 9/0 at review and reads nothing this book changed.
- **At review:** full run `20260921T033649Z-59242-3315 [review-setup-page-scaffold-1]` on `e923eec3`
  — FAIL, exit 1, 3551 passed, 5 failed, 49 skipped, 214/214 suites; failed
  `tl-membership-method-selector`, `tl-weighted-sum-method`, `tl-certainty-method` (OPEN.md row
  191, the local-only publish guard) and `summaries-element-count` (row 285, a live element count on
  this machine's graph). Every suite that reads the diff passed, including the three that walk
  `ui/src`. The Implementer's scoped run, `20260921T033512Z-57231-7977 [setup-scoped-ui]`, was PASS,
  746 passed, 36/36 suites.
- **CI:** `stack-free` green on PR #720 (1m38s), and `stack-free` plus `main-source-guard` green on
  PR #721.
- **Deploys:** staging run [35561942267](https://github.com/nous-clawds4/tapestry/actions/runs/35561942267)
  green in about 93 s; production run [35563659855](https://github.com/nous-clawds4/tapestry/actions/runs/35563659855)
  green in about 95 s. The same bundle, `index-_zLoQMny.js`, from the reviewed local build through
  staging to production (production's is byte-identical to staging's). Five-tier smoke clean on
  both. On production the safe-to-merge check held the merge for three minutes while a scheduled
  `refreshSearchIndex` was due and then running, and went safe when it finished.
- **Known open issues:** none introduced. Pre-existing and unreachable by this diff: OPEN.md rows
  191 and 285. The back link's hover hue is app-wide and filed as a cleanup (§6 #7).
- **Debt logged:** none by ADR — the book ran the abbreviated path and wrote no ADR.

## 6. Carry-forward register

- [ ] **1. The owner's deferred list.** Real per-step status on `/setup`, the Setup Alert, and the
      UX and function of the three action pages — verbatim, with Brainstorm's model and what exists
      to build on, in `stories/_intake.md` "2026-09-20 — The /setup page, the rest of the way".
      (§4 #4, #5)
- [ ] **2. What "Create your account" means for each kind of visitor** — a signed-out visitor, a
      signed-in guest with no assistant, a customer, an admin, the owner. The `assistant-profile`
      book's truthful setup check (#1) and planned My Assistant page (#4) are the likely foundations.
      (§4 #6)
- [ ] **3. Whether signed-out visitors keep seeing `/setup`** once the page checks real state.
      (§4 #3)
- [ ] **4. When a follow list or a Treasure Map counts as done.** Which relays are read, and whether
      a kind 10040 naming another provider counts. Brainstorm's own rule is inconsistent:
      `useFinishSetup.ts` line 60 lets a local "activated" flag win, against the comment at lines
      61–63. (epic § "What Brainstorm has"; the review's draft-stage finding)
- [ ] **5. "Setup" now names three surfaces** — `/setup`, the `/tapestry` Dashboard's
      Getting-Started checklist (instance setup for Owner and Admins), and
      `/tapestry/trusted-agents/setup` (Sponsor/Agent pairing). The same family of problem as
      `navigation-scaffolding` §6 #6's four pairs of same-named surfaces. (epic § Key facts)
- [ ] **6. No way in until the Setup Alert.** Whether an avatar-menu or dashboard link is also
      wanted, and where the alert appears (Brainstorm Search pages, the `/tapestry` control panel, or
      both). (§4 #4)
- [ ] **7. Links on the Brainstorm Search pages turn sky blue on hover** because the global `a:hover`
      colour outranks their class colour — `/setup`'s back link and `/tags`' links alike. Filed as
      OPEN.md row `2026-09-21-bs-link-hover-turns-sky-blue`. (review non-blocking 1)
- [ ] **8. The done state is undesigned.** The numbered markers stand in for Brainstorm's icons; what
      a done step looks like (a check, a "Done" chip, a collapsed row) is decided when steps can be
      done. (§4 #1)

## 7. Process findings (harness)

Retro run on measurement: `scripts/harness-stats.sh` at close — 230 reviews parsed, 228 final PASS
and 2 final CHANGES_REQUESTED (0% kick-back rate); 43 reviews carry a kick-back somewhere in their
history; 58 books closed, cycle-time median 0d. This book: one review, first-pass PASS; its story went
story → review in 0d, and the book was open 1d.

| Finding | Source | Terminal state |
|---|---|---|
| **The abbreviated path names no Implementer test gate, and scoping one by filename grep misses the suites that walk `ui/src`.** The Implementer ran 36 suites found by grep; the Reviewer found three more that read every `.js`/`.jsx` file under `ui/src`. The full run covered them, so nothing escaped. | review harness 1; story § Deviations | **OPEN.md row `2026-09-21-abbreviated-path-names-no-gate`** (`meta`) |
| **`gate:status` names the last finished suite as "current",** so a long suite still running looks hung — seen twice in this book and misread once by the Reviewer. | review harness 2; this session | **OPEN.md row `2026-09-21-gate-status-current-lags-one`** (`meta`) |
| **The abbreviated path's commit cadence.** This book applied row 212's proposed fix shape — commit the story before implementing — and it worked: spec, code, review follow-ups, review and records landed in five separate commits (`db1d60fe` → `e4fb2c8b`), and the Reviewer could diff spec against code by commit. | book § Path; commit history | **OPEN.md row 212** (`meta`, stays open) — this is its first applied data point; writing the one line into `workflows/0-intake.md` step 3 is a harness change for the operator to ratify. |
| **The local container's server code has drifted from the branch** (12 of 565 tracked `src/ bin/ lib/` files differ from HEAD, 2 absent), so live suites test older code whatever the checkout holds. | review harness 3; verified independently | **Declined (no new row)** — OPEN.md row 27 already carries the stale local stack; the measurement is appended to it (`e4fb2c8b`). |
| **Row 196 says the browser pane delivers no key events; in this book `Tab` and `Enter` did arrive**, and only `Return` — the name row 196 measured with — did nothing. | review harness 4; implementation pass | **Declined (no new row)** — the observation is appended to row 196 (`e4fb2c8b`), which stays open until someone reruns its measurement. |
| **Row 213 looks stale:** the pinned headless shell is now installed on the Mac Studio and a default launch works. | review harness 5 | **Declined (no new row)** — appended to row 213 (`e4fb2c8b`); it closes once the laptop is checked. |
| **`npm test` is red by default here and now takes about 53 minutes** (41 at the `navigation-scaffolding` close on 2026-09-08). The Implementer therefore scoped its gate, and the review ran the full suite once, launched by the orchestrator under the review's label. | this book's gate runs; rows 191, 204 | **Declined (no new row)** — rows 191 (red by default) and 204 (run time) carry both causes; this book adds a data point to each. |
| **A review file written while a gate run is in flight can fail that run's `harness-lint` suite** (a PASS review beside a not-yet-Done story trips L1), so the Reviewer drafted outside the tree until the run ended. | this book's review | **Declined** — a one-line workaround that is now in agent memory, and moot for any run that finishes before the review is written; not worth a row while 133 `meta` rows are open. |

**Does it port to the other flow (Direction ↔ human-gated)?** The two new rows port: a Direction-mode
book on the abbreviated path would scope its gate the same way, and the Director reads `gate:status`
too. The in-flight-review hazard ports as well, which is one more reason the workaround belongs in
memory rather than only in this book.
