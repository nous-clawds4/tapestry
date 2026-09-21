# Review: an Account Setup + Assistant Management section in every avatar menu

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-21
**Lane:** Doc / one-liner (intake §3 strictness table — Implementer + Reviewer, no story file; this
review is the lane's record). By the table's own definitions this is a small *Feature* (new
navigation), which Standard would run through all phases. The operator chose this lane because the
owner framed it as "a very quick navigation change". The live browser pass below stands in for the
missing Tester phase.
**Diff:** `git diff 6fd8759d...3938a16f`: one commit, `3938a16f`, on
`feat/avatar-menu-account-section` (base `origin/staging` at `6fd8759d`). Five files, all under
`ui/src/`, +34 / −7.
**Provenance:** the owner's ask, verbatim, 2026-09-21:

> This is a very quick navigation change. We will edit the dropdown menus under the avatar (the
> dropdown menu that shows up on the main page and several other pages; also the dropdown menu that
> shows up on the /tapestry pages) by adding a section with two links:
> * "Account Setup" which goes to /setup
> * "Assistant Management" which goes to /assistant
>
> In both dropdowns, this section will be located below the section that contains links to the
> Brainstorm Landing Page, Tapestry Dashboard, and legacy Dashboard.
> We will not concern ourselves in this session with building either the /setup page or the
> /assistant page. Just add the links to the dropdown menus.

**Filed under** `reviews/done/navigation-scaffolding/` on the operator's direction. The retired
navigation-scaffolding epic built these menus, and 0-intake §3's doc-lane form
(`reviews/<epic>/<slug>.md`) assumes the epic's folder is still live.

## What changed

| File | Change |
|---|---|
| `ui/src/config/avatarMenuLinks.js:81–88` | New exported `accountLinks`: `🛠️ Account Setup → /setup`, `🎛️ Assistant Management → /assistant`. No `external` flag. |
| `ui/src/components/Header.jsx:163–166` | Tapestry menu: renders `accountLinks` through the existing `MenuItem`, between the destinations block and About / Sign Out, with a new `<hr className="dropdown-divider" />` after it. Import (`:5`) and the `MenuItem` doc comment (`:23`) updated. |
| `ui/src/components/BrainstormUserMenu.jsx:178–182` | Main menu on most Brainstorm pages: a third `bs-usermenu-section bs-usermenu-links` block after destinations, before the footer. Import (`:3`) and header comment (`:9–11`) updated. |
| `ui/src/pages/BrainstormSearch.jsx:573–578` | The landing/results page's own `UserMenu`: the same block in the same position. Import (`:9`) updated. |
| `ui/src/components/AvatarMenuLink.jsx:2` | Doc comment only. |

No server, test, firmware, config or dependency file changed.

## The owner's ask, clause by clause

| # | Clause | Evidence | Result |
|---|---|---|---|
| 1 | Section added to "the dropdown menu that shows up on the main page and several other pages" | Two render sites carry that menu, and both got the section. See "Two dropdowns, three render sites" below. | ✅ |
| 2 | ...and to "the dropdown menu that shows up on the /tapestry pages" | `Header.jsx:163–165`. `Header` is mounted by `Layout.jsx:212`, the shell for every `/tapestry/*` route. | ✅ |
| 3 | "Account Setup" goes to `/setup` | `avatarMenuLinks.js:86`. Browser: rendered `href="/setup"` in both Brainstorm menus, and a Tapestry-menu click lands on `/setup`. | ✅ |
| 4 | "Assistant Management" goes to `/assistant` | `avatarMenuLinks.js:87`. Browser: `href="/assistant"`, and clicks from all three menus land on `/assistant`. | ✅ |
| 5 | Placed below the Landing / Tapestry Dashboard / Legacy Dashboard section, in both dropdowns | Source order: `Header.jsx` destinations `:159–161` → hr `:162` → account `:163–165` → hr `:166` → About / Sign Out `:167–172`. `BrainstormUserMenu.jsx` destinations `:172–176` → account `:178–182` → footer `:184`. `BrainstormSearch.jsx` destinations `:567–571` → account `:573–578` → footer `:580`. Measured DOM order matches in all four renders (below). | ✅ |
| 6 | "adding a section": its own visually separate group | Tapestry: `<hr class="dropdown-divider">` directly above and below. Brainstorm: its own `.bs-usermenu-section`, and each section carries `border-bottom: 1px solid` (`styles.css:2804–2807`), measured as `1px solid` on both the destinations and the account section. Screenshots checked: it reads as a third group. | ✅ |
| 7 | Don't build `/setup` or `/assistant` | No route added. `App.jsx` has no top-level `setup`/`assistant` path (the only such segments are nested: `/tapestry/trusted-agents/setup` `:429`, `/tapestry/settings/assistant` `:457`). Both links land on the SPA's `NotFound` (below). | ✅ |

**Two dropdowns, three render sites.** The owner said "two dropdowns", but there are three render
sites. The Implementer's reading is right:

- "The main page" is `/`. `App.jsx:125–126` routes it to `BrainstormSearch`, which does **not**
  use `BrainstormUserMenu`. It defines its own `UserMenu` (`BrainstormSearch.jsx:100`) and hands it
  to `TopBar` via `authMenu` (`:1098–1100`), and renders it again in the results view (`:1445`).
- "Several other pages" is `BrainstormUserMenu`, mounted directly by 14 pages and as `TopBar`'s
  default auth slot (`TopBar.jsx:49–53`) on `BrainstormProfile`, `Pins`, `Tag`, `Tags` and
  `PinRedirect`.
- To the user these two are one menu: same `bs-usermenu*` classes, same look. Updating only one
  would have left the landing page and the rest disagreeing, which is exactly the drift the
  navigation-scaffolding epic built `avatarMenuLinks.js` to prevent. All three render sites read
  the one `accountLinks` list, and they are its only consumers (`grep avatarMenuLinks ui/src`), so
  the three menus can't disagree on this section.

## The Implementer's evidence, re-verified

| Claim | My check | Result |
|---|---|---|
| 1. The in-container build `dist/assets/index-D1iTwLMI.js` contains the four strings once each | `curl http://localhost:7778/` references exactly that bundle. Each of `Account Setup`, `Assistant Management`, `"/setup"`, `"/assistant"`, `account-setup`, `assistant-management` occurs once. The minified literal is the committed data byte-for-byte, icons included, directly after `destinationLinks`. | ✅ |
| 2. ESLint before vs after: an identical set of 29 pre-existing problems, none on a touched line | Re-run with Node 22 on HEAD, and on the base through `git show 6fd8759d:<file> \| eslint --stdin --stdin-filename <file>` (no tree change). Identical rule+message sets on all five files. The only textual delta is one `react-hooks/purity` code frame whose line moved 691→698 because 7 lines were inserted above it. No flagged line (BrainstormSearch 119…1027, BrainstormUserMenu 42/59/81/212/230) falls in a touched range. | ✅ parity. The count is 27, not 29 (non-blocking 6). |
| 3. Browser: each menu renders the section below the destinations and visually separated. Tapestry clicks navigate in-app to `NotFound`. | Reproduced with my own headless pass and extended: the results-view render, click-through from the Brainstorm menus, and short viewports. Details below. | ✅ |
| 4. No server route claims `/setup` or `/assistant`, so both menu mechanisms reach the same `NotFound` | No `app.get/use` for either path in `bin/` or `src/` (the only matches are API routes: `/api/assistant/*` and `/api/neo4j-setup-constraints-and-indexes`). No such entry in `dist/` or `public/`. `isBlockedProbePath` (`src/utils/siteTrust.js:166–203`) blocks only dot segments and listed extensions, so the SPA catch-all (`bin/control-panel.js:346–350`) serves them. Live: `GET /setup`, `/assistant`, `/setup/`, `/assistant/` → `200 text/html`, byte-identical (sha256) to `GET /` and to `dist/index.html`. In-container nginx sends every path but `/relay`, `/neo4j/`, `/browser/`, `/bolt` to :7778 (`docker/nginx.conf:40–43`), and the documented droplet host-nginx block proxies `location /` wholesale (OPERATIONS.md:244–245), so deployed hosts behave the same. | ✅ |

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` on Node 22.23.2 x64, committed clean tree, label
      `avatar-menu-account-section-review`. Result: FAIL, environmental, not caused by this diff.
      The `npm run gate:status` line:

      ```
      20260921T041722Z-59978-66e1 [avatar-menu-account-section-review] started 2026-09-21T04:17:22.249Z on 3938a16f — FAIL, exit 1, 3424 passed, 57 failed, 139 skipped, 214/214 suites; failed: tag-detail, capture-a-goal-and-see-it, structures-the-brain-can-trust, break-a-goal-into-pieces, attach-the-world, sessions-read-the-brain, the-proposal-loop, teach-it-what-matters, the-brain-survives, return-the-four-on-every-read-surface, show-the-four-on-the-goal-screens-that-already-exist, recognizable-published-ta-profile, profile-lookup-bounds, not-yet-shared-filter, concept-count-canonical, summaries-element-count, author-scoped-inspection-roster
      ```

  - 15 of the 17 red suites are this host's standing live-suite reds (OPEN row 289). Their
    per-suite failure counts are identical to the last full run here,
    `20260920T213101Z-40953-3bbe` (51 failures in total).
  - The other two suites were added after that run. They are red only because the live control
    panel predates the code they test (Harness friction 1):
    - `author-scoped-inspection-roster` H1–H5: live `GET /api/assistant/roster` answers
      `404 Cannot GET`, although the checkout registers it (`src/api/index.js:543`, from
      `a33dc5c7`, 2026-09-20).
    - `profile-lookup-bounds` E2: the live refusal for 51 pubkeys is
      `{"success":false,"error":"max 50 pubkeys per request"}`, without the `limit`/`hint` fields
      that `src/api/profiles/fetchProfiles.js:156–163` returns (from `56ea6cf9`, 2026-09-20).
    - This diff touches neither of those files, nor any server file.
  - The sentinel suites that read the touched menu files are all green, with zero skips, so the
    greens are real: `pov-state-unification` 5/5, `live-feed-feed-page` 27/27,
    `login-failure-and-tag-collapse` 18/18, `note-surfaces-ui` 19/19,
    `admin-tools-dashboard-panel` 9/9.
- [x] `npm run test:playwright`: not run.
  - No spec under `tests/` references either menu (grep for
    `user-dropdown|bs-usermenu|Legacy Dashboard|Account Setup` finds nothing), so the suite can't
    exercise this diff.
  - The host has no Playwright browser cache, so the suite can't launch without a download.
  - The targeted pass below replaces it.
- [x] ESLint parity: see claim 2.
- [x] Build: not run by me (no `dev-refresh.sh`, no host vite, per the brief). I checked the served
      bundle instead (claim 1).
- [x] `bash scripts/harness-lint.sh` on the tree with this file added: exit 0.
- [x] The working tree was clean before and after the gate, and no repo file was edited while it
      ran.

### Browser pass (reviewer's own)

**Method.**

- playwright-core 1.56.1 drives the system Google Chrome, headless, against
  `http://localhost:7778`.
- `/api/auth/status` and `/api/auth/user-classification` are fulfilled in-page with an obviously
  fake owner (pubkey `'a'×64`, assistant `'b'×64`).
- Every non-GET request is aborted. The only one any page attempted was `POST /api/neo4j/query`.
- The script lives in the session scratchpad and is not committed.

**Section order, 1440×1400.** The account section sits directly below destinations everywhere:

| Render | Sections, top to bottom |
|---|---|
| `/` landing (`BrainstormSearch` `UserMenu`) | welcome · POV indicator · personal (5) · destinations (3) · **account: Account Setup `/setup`, Assistant Management `/assistant`** · footer (Settings, Sign out) |
| `/?q=test` results view (same component, `:1445`) | identical to landing |
| `/about` (`BrainstormUserMenu`) | welcome · POV switch · personal (5) · destinations (3) · **account** · footer (Your pins, Settings, Sign out) |
| `/tapestry/` (`Header`) | pubkey · hr · personal (5) + Settings · hr · destinations (3) · hr · **account (2)** · hr · About · Sign Out |

**Click-through.** Every click ended on `<h1>Page not found</h1>`:

| From | Item | Landed on | Same document? |
|---|---|---|---|
| Tapestry | Account Setup | `/setup` | yes (`navigate()`) |
| Tapestry | Assistant Management | `/assistant` | yes |
| `/about` | Account Setup | `/setup` | no (anchor, full load) |
| `/about` | Assistant Management | `/assistant` | no |
| `/` | Assistant Management | `/assistant` | no |

`external` semantics are right. The new entries carry no `external`, so `Header.jsx:99–106` uses
`navigate()`. That is correct because neither path is served by Express. The Brainstorm anchors'
full load reaches the same `NotFound`.

## Concept-graph integrity

- [x] No concept definitions, handles or firmware touched, so no reinstall is needed and none was
      claimed.
- [x] No `/summaries` or BIBLE re-derivation: no API call was added.

## Things tests can't catch

- [x] Secrets and the TA pubkey: the added lines contain no 40+ hex run, `nsec`, `npub1` or
      `LEGACY_`. No `LEGACY_*` constant was touched, so ADR 0015's named exception is intact.
- [x] Debug code: no `console.`, `debugger`, `TODO` or `FIXME` in the added lines.
- [x] Comments: no commented-out code. The edited comments are accurate
      (`AvatarMenuLink.jsx:2`, `Header.jsx:23`, `BrainstormUserMenu.jsx:9–11`,
      `BrainstormSearch.jsx:573`, `avatarMenuLinks.js:81–84`), and none is time-bound. "Neither
      page exists yet" appears only in the commit message, which is the right place for a dated
      statement. One comment the diff *didn't* update is now stale (non-blocking 2).
- [x] React keys are unique within each mapped list, and across lists too.
- [x] Race conditions: none. The new rows use the same `go()` / `onNavigate` paths as the existing
      rows.
- [x] Security: static same-origin hrefs, no input, no new request. `NotFound` echoes the pathname
      as React text, so it is escaped.
- [x] Scope creep: none. Five files, each needed for the ask.
- [ ] Viewport-height edge case: see non-blocking 1.

## House rules and architecture invariants

- [x] Concept Graph API authority: nothing here is domain-modelled.
- [x] No new lint, typecheck or build tooling, and no dependency change.
- [x] Per-deployment TA pubkey: not referenced.
- [x] §1–§4: these are static navigation links. No POV-dependent value, no write-time gate, no
      stored derivation, no storage touched. The new links show for every signed-in user,
      consistent with `avatarMenuLinks.js:16`.

## Findings

### Blocking

None.

### Non-blocking

1. **On short viewports the Tapestry menu's last rows are now cut off, and they can't be scrolled
   into view.**
   - **Cause.** `.app-header` is `position: fixed` (`ui/src/styles.css:650`), and `.user-dropdown`
     (`:751–762`) has no `max-height` and no `overflow-y`. Anything below the viewport edge is
     unreachable.
   - **Measured** position of the last row ("Sign Out"); "before" is derived by subtracting the
     measured height of the added rows:

     | Viewer, viewport | Before this commit | After | Rows added |
     |---|---|---|---|
     | owner/admin, 1366×657 | 586 | 675 | 89px |
     | owner/admin, 390×664 | 586 | 691 | 105px ("Assistant Management" wraps at phone width) |
     | guest/customer (no Settings row), 1366×657 | 542 | 631 | 89px |
     | guest/customer, 390×664 | 542 | 647 | 105px |

   - **Effect.** For an owner, Sign Out was fully visible down to a 586px-tall viewport. It is now
     half-clipped at 1366×768-laptop heights (657), hidden at 620 and below, and about 9px visible
     on a 390×664 phone. The Brainstorm menus don't have the problem: their bar isn't fixed, so the
     page scrolls, and Sign out was reachable at every tested height (560–720, and 390 wide).
   - **Suggested fix** (two declarations on `.user-dropdown`):
     `max-height: calc(100vh - 60px); max-height: calc(100dvh - 60px); overflow-y: auto;`
   - **Why this doesn't block.**
     - The owner asked for exactly these rows in exactly this place, and the diff executes that
       correctly. The growth comes with the ask.
     - The defect belongs to the container and predates this commit. An owner's Sign Out was
       already cut off below 586px.
     - Workarounds exist. Sign out is also in the Brainstorm menus, and "Brainstorm Landing Page"
       sits near the top of the Tapestry menu.
     - Whether a "very quick" change should also touch the container's CSS is the owner's call.
   - **Recommendation.** Take the fix on this branch before merge. Otherwise it needs a ledger row:
     no existing row covers it (row 216 is a different `.dropdown-item` rule), and a review file
     is not a tracking surface (`/whats-open` doesn't read `reviews/`).
2. **`ui/src/styles.css:2874–2876` is a comment this diff made stale.** It still reads "Personal +
   destination link sections … eight of those would make the dropdown taller than most
   viewports". `.bs-usermenu-links` now also styles the account section, and the rows number ten.
   The Implementer updated the three analogous JSX comments but missed this one. **Suggested
   wording:** "Personal, destination and account link sections … a full-width box per link would
   make the dropdown taller than most viewports." Dropping the count keeps it from going stale
   again.
3. **Merging deploys two links that lead nowhere yet.** A merge into staging deploys to
   staging.brainstorm.world, and promotion ships to production. Every signed-in user on those
   hosts will get two menu items that land on "Page not found" until the pages exist. That is what
   the owner asked for ("Just add the links"). This is flagged only so that the promotion is a
   deliberate choice. If it isn't wanted yet, hold the promotion to `main` until at least
   placeholder routes exist.
4. **For whoever builds `/setup` and `/assistant`.**
   - If either page ends up served by Express rather than being a React route, give its
     `accountLinks` entry `external: true`. The Tapestry menu `navigate()`s non-external links
     (`Header.jsx:99–106`) and would render `NotFound`, while the Brainstorm menus' plain anchors
     (`AvatarMenuLink.jsx:24–29`) would reach the page. The menus would then disagree. React
     routes need no change.
   - Two existing pages overlap these names and should be reconciled: "Assistant Profile" at
     `/tapestry/settings/assistant` (`App.jsx:457`), and the Trusted Agents "Set Up" page at
     `/tapestry/trusted-agents/setup` (`App.jsx:429`, navigation-scaffolding #3).
5. **🛠️ already means "Admin tools".** Account Setup shares its icon with the Tapestry
   Dashboard's "🛠️ Admin tools" panel (`ui/src/pages/Dashboard.jsx:393`) and the "🛠️ Manage" page
   (`ui/src/pages/manage/Index.jsx:12`). On `/tapestry/` the panel and the open menu are visible
   together. The owner didn't specify icons, and the Implementer's collision check covered only
   the menu itself. The owner can keep or swap it; this is not a defect.
6. **Record accuracy: the Implementer's lint count.** The Implementer reported 29 pre-existing
   problems. ESLint's JSON reports 27: 22 errors and 5 warnings (`BrainstormUserMenu.jsx` has 5,
   `BrainstormSearch.jsx` has 17 + 5), plus 3 inline-suppressed in `BrainstormSearch.jsx` (30 with
   those). The parity claim holds. This note only puts the right number on record.

### Harness friction

1. **The local control panel is running 2026-09-12 code, 19 server commits behind the checkout it
   is supposed to serve.**
   - **Evidence.** `docker exec tapestry supervisorctl status` shows
     `brainstorm RUNNING … uptime 8 days, 10:46:23`. The process is
     `node …/bin/control-panel.js`, started `Sat Sep 12 17:37:30 2026`.
     `git log --since=2026-09-12T17:40Z -- src/ bin/` counts 19 commits since then.
   - **Why nothing restarted it.** `scripts/dev-refresh.sh --ui` never restarts the backend
     (`:25`, `:50` `DO_SERVER=0`). That is what this change's Implementer ran, correctly for a
     UI-only diff.
   - **Consequences.**
     - Two suites are red here for this reason alone (see Quality gates).
     - OPEN row 289's triage premise, "the control panel runs the checkout's code (started
       2026-09-12 17:40 UTC at `cde8b282` …)", was true on 2026-09-13 and no longer is.
     - So the "same live reds on every branch" baseline can now contain reds caused by the stale
       server, and every gate run on this host since then has run its live half against that
       2026-09-12 process.
   - I was told not to restart the stack, so I didn't.
   - **This needs a `meta` ledger row.** None exists: I searched OPEN.md and `ledger/`, and
     `origin/staging` differs from this branch in neither.
   - **Options for the row.** Restart the backend (`scripts/dev-refresh.sh --server`) before any
     gate whose live suites matter. Or have the gate record the control panel's start time next to
     the checkout's commit, so a stale server shows in the run record.

## Close-out

There is no story file to flip, and no book (0-intake step 4: doc/one-liner requests don't need
one), so no completion detection applies.

## Verdict

**PASS**

The diff does what the owner asked, and nothing else. There is one new list in the shared config
module that all three avatar-menu render sites already read, rendered in each as its own divided
section directly below the destinations. The labels and targets are verbatim, and I verified them
in source, in the served bundle and in a live browser, including the landing page's separate menu
copy that "two dropdowns" would have missed. Both targets reach the SPA's Page-not-found on every
path a request can take, as the owner expects while the pages don't exist. No server, concept or
dependency change, no TA pubkey, lint parity holds, and the gate's reds are the host's standing set
plus two suites a stale control-panel process explains. The Tapestry menu's viewport overflow is
the one thing worth fixing before promotion, but its cause predates this commit and the fix is the
owner's call.
