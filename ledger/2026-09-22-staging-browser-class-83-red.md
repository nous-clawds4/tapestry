# 83 browser tests in 19 spec files fail on staging's own build, most of them checking UI that later stories changed

**Id:** 2026-09-22-staging-browser-class-83-red
**Type:** cleanup
**Opened:** 2026-09-22 (assistant-management #2 fix round, filed on the owner's word; local date 2026-09-21)
**Status:** OPEN
**Done:** —

**What was seen.**
- **The full run.** `tests/brainstorm/` on this book's branch (Chromium, Playwright 1.56.1, local stack at `:7778`)
  gave 407 tests: 319 passed, 85 failed, 3 skipped.
- **Separating the branch's failures from older ones.** The 20 failing spec files were run again against two host
  builds: `origin/staging` at `6754a16a`, and the branch at `fc411a0d`. Each was served on its own port, with
  `/api` passed through to the local stack.
- **83 tests fail the same way on both builds.** The other 2 were live-data flakes. `profile-website-link` then
  passed 9 of 9, and `auth.spec.js:73` passed on its rerun.
- **So 83 browser tests are red on the shared line itself.** No workflow runs Playwright:
  `grep -ri playwright .github/workflows/` finds nothing.

| Spec (tests failing) | What the failing tests look for |
|---|---|
| `customize-pin-curation` (15) | a button named "Pin" or "📌 Pin" (the tag page's is now "Pin this tag", `TagPinAffordance.jsx`); an "Edit" button on `/pins` |
| `shared-concepts-row-detail` (9) | a `table.data-table` row for "cat breed" |
| `tag-detail-write` (9) | "Apply" buttons, a "Viewer Only Target" row, the "find a profile to tag" field |
| `pin-a-tag` (8) | "Pin" and "Unpin" buttons; the `/pins` link |
| `nip51-list-export-from-pins` (7) | "Pin" or "Pin tag"; share and export buttons; the fixture tag's heading on `/pin/:dTag` |
| `profile-follows-list` (6) | the follows table and its Name and HOPS columns |
| `most-pinned-tag-index` (5) | the fixture rows, their pin-count badges and the own-pin marker on `/tags` |
| `tl-publication-from-pins` (4) | "Refresh now" buttons; a "pinned tag trusted list" panel; a "Pin" button |
| `scheduled-search-and-house-scores-refresh` (4) | a "Scheduled Tasks" button or tab |
| `api-health` (3) | fields in live API answers: Neo4j health, user classification, task watchdog |
| `auth` (3) | a `<header>` on the landing page; a response the test waits for |
| `tag-detail` (2) | a "Most applied" sort control |
| `treasure-maps-router-preset` (2) | "Presets" and "Negentropy Sync" controls |
| `profile-follows-hops` (1) | "the HOPS counter must be plain text, not a `<Link>`": it is a link now |
| `profile-verified-followers-count` (1) | the same, for the Verified Followers counter |
| `profile-verified-reporters-count` (1) | an attribute of the "Following" link |
| `profile-verified-reporters-list` (1) | the text "Relative to the House (default) web of trust." |
| `profile-followers-list` (1) | the followers table |
| `tapestries-nav-and-directory` (1) | "coming soon" or "placeholder" text |

**Why it matters.**
- **Most read as left behind.** Later stories changed the UI these specs check: renamed buttons, counters that
  became links, the tags directory redone.
- **Some depend on live data or live endpoints.**
- **None has been triaged.**
- **While they stay red, a full browser run cannot show a new regression.** It needs a baseline comparison like
  the one above.
- **Board packet `h-browser-gate`** (rows 113 and 114: make the browser class a gate a UI story must run) would
  be blocked by them.

**Fix shape.** Triage each file as one of:
- **stale:** re-aim it to today's UI, or retire it, citing the story whose behaviour replaced it;
- **live-data:** mock it like the hermetic specs, or mark it live and keep it out of the hermetic run;
- **a real regression:** file it as a bug.

Then record a green, or explicitly waived, baseline for the full browser class on staging.

**One more, a flake rather than a red test** (found at review 2, round 2):
- **Where.** `tests/brainstorm/author-scoped-inspection.spec.js:157`, E3.
- **The race.** It reads the table's headers (`allTextContents()` on `table.data-table thead th`) straight after
  `page.goto`, without waiting for the table.
- **How it shows.** It failed once under 4 workers, then passed 13 of 13 on its own.
- **Fix.** Wait for the headers first, for example `await expect(page.locator('table.data-table thead th').first()).toBeVisible()`.

**Reproducing the comparison** (what was done here):
1. `git worktree add --detach <dir> origin/staging`.
2. `cd <dir>/ui && npm ci && npx vite build`, under Node 22 x64. The build lands in `<dir>/dist`. It is
   byte-identical to the container's: a host build of `fc411a0d` produced the served bundle's hash,
   `index-DO6DL-ap.js`.
3. Serve `dist` on a spare port, with `/api` proxied to `:7778`.
4. Run the specs with `BRAINSTORM_BASE_URL` set to that port and `--reporter=json`.
5. Compare the outcomes test by test.

**Pointer:**
- OPEN.md row 114 (the browser class is not in any gate);
- the Loose Threads board's packet `h-browser-gate`;
- `tests/brainstorm/`.
