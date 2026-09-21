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

---

## Addendum 2026-09-21: the three commits after the verdict

**Diff:** `git log --first-parent 01c7f03b..78a09be5`, three commits:

- `c90986ad`: the review follow-ups (N1, N2, N5).
- `30f2f19b`: merges `origin/staging` at `e8d15892`, which is PR #720, the `/setup` scaffold.
- `78a09be5`: a ledger update.

I re-derived every changed statement below from a command, including the wording I suggested
myself (reviewer.md step 10).

### Quality gates (re-run by reviewer)

- [x] `npm test` on Node 22.23.2 x64, committed clean tree at `78a09be5`, label
      `avatar-menu-account-section-addendum`. FAIL, with the same environmental set as the first
      run:

      ```
      20260921T044814Z-41349-9c0d [avatar-menu-account-section-addendum] started 2026-09-21T04:48:14.364Z on 78a09be5 — FAIL, exit 1, 3424 passed, 57 failed, 139 skipped, 214/214 suites; failed: tag-detail, capture-a-goal-and-see-it, structures-the-brain-can-trust, break-a-goal-into-pieces, attach-the-world, sessions-read-the-brain, the-proposal-loop, teach-it-what-matters, the-brain-survives, return-the-four-on-every-read-surface, show-the-four-on-the-goal-screens-that-already-exist, recognizable-published-ta-profile, profile-lookup-bounds, not-yet-shared-filter, concept-count-canonical, summaries-element-count, author-scoped-inspection-roster
      ```

      Compared suite by suite with the first run (`20260921T041722Z-59978-66e1`, on `3938a16f`):
      214 suites, no difference in any verdict or in any pass/fail/skip count. The five menu
      sentinel suites are green with zero skips. #720 added no test files.
- [x] ESLint on `avatarMenuLinks.js` at HEAD: E0 W0. It is the only JS file `c90986ad` touches;
      CSS isn't linted.
- [x] Served build:
  - `index-CabXuA_B.js` carries `{key:"account-setup",icon:"🧭",…,to:"/setup"}` and the
    `/setup/*` route strings.
  - `index-CVNf5oh8.css` serves
    `.user-dropdown{…max-height:calc(100vh - 60px);max-height:calc(100dvh - 60px);overflow-y:auto}`.
    The fallback pair survived minification, in source order.
- [x] `bash scripts/harness-lint.sh`: exit 0 with this addendum committed.

### 1. `c90986ad`: the follow-ups

**N1, the Tapestry menu's scroll containment: fixed.** `ui/src/styles.css:762–766`.

**Method.** The same headless browser setup as before, with a fake owner and a fake guest and every
non-GET request aborted. At each size I opened the menu, scrolled it to its end, and hit-tested the
centre of Sign Out:

| Viewer, viewport | Menu top → bottom | max-height | scrollHeight / clientHeight | Sign Out bottom: at open → after scroll | Element at Sign Out's centre |
|---|---|---|---|---|---|
| owner, 1366×600 | 50 → 590 | 540px | 624 / 538 | 675 → 589 | Sign Out |
| owner, 1366×657 | 50 → 647 | 597px | 624 / 595 | 675 → 646 | Sign Out |
| owner, 1366×400 | 50 → 390 | 340px | 624 / 338 | 675 → 389 | Sign Out |
| owner, 375×667 | 50 → 657 | 607px | 640 / 605 | 691 → 656 | Sign Out |
| owner, 375×540 | 50 → 530 | 480px | 640 / 478 | 691 → 529 | Sign Out |
| owner, 320×480 | 50 → 470 | 420px | 640 / 418 | 691 → 469 | Sign Out |
| guest, 1366×600 | 50 → 590 | 540px | 580 / 538 | 631 → 589 | Sign Out |
| guest, 375×540 | 50 → 530 | 480px | 596 / 478 | 647 → 529 | Sign Out |

- **No horizontal overflow** at any size (`scrollWidth == clientWidth`), even though
  `overflow-y: auto` makes `overflow-x` compute to `auto`.
- **Windows-style scrollbars.** I forced a real 17px scrollbar (`::-webkit-scrollbar`, in a
  headless run without `--hide-scrollbars`):
  - The menu keeps its width. A few long labels wrap (their rows go from 44px to 60px), but nothing
    overflows or clips, and Sign Out stays reachable.
  - Dragging the scrollbar thumb keeps the menu open and scrolls it to the end (102 of 102px). The
    click-outside handler treats the scrollbar as inside `menuRef`. A real outside click still
    closes the menu.
- **The 60px offset holds at every width.** `.app-header` ends at y=55, and the menu starts at
  y=50, at 1366, 375 and 320 wide, so the menu stops 10px above the bottom of the window. The
  header can't grow: `.user-name` is `nowrap` with an ellipsis at 150px, and is hidden on mobile
  (`styles.css:726–732`, `:2508`).
- The new comment (`styles.css:762–763`) is accurate and not time-bound.
- **The coordinator's measurements.** Every number that doesn't depend on the signed-in user
  matches mine exactly: top 50, bottom 590, max-height 540px, clientHeight 538, and 589 and 529
  after scrolling. Their scrollHeight of 565, and their "the whole menu fits at 375×667", come from
  their stub user. That is probably a guest with a wider avatar button, so "Brainstorm Landing
  Page" doesn't wrap. For an owner at 375×667 the menu does need scrolling (Sign Out 691 → 656).
  Sign Out is reachable either way.

**N2, the stale `.bs-usermenu-links` comment: fixed, using my wording verbatim, and my wording
overstates.** `styles.css:2879–2881`.

- The count is gone and all three sections are named.
- But I measured the `/about` menu:
  - a compact row is 32.5px plus a 1.6px gap;
  - a footer box is 37.2px plus a 6.4px gap;
  - so full-width boxes would add about 95px across the ten links;
  - and the compact menu already ends at y=751, below the bottom of the 657px window I used above
    for a 1366×768 laptop.
- So "a full-width box per link would make the dropdown taller than most viewports" is literally
  true, but the contrast it implies (that compact rows keep the menu within most viewports) is
  not.
- Non-blocking (A1). If anyone edits this comment again, a more accurate version is:
  "Compact rows rather than the full-width boxes the footer uses, so a long list of links stays as
  short as it can."

**N5, the icon: changed to 🧭 (U+1F9ED).**

- In `ui/src` it appears only at `avatarMenuLinks.js:86` and on the Concepts list page:
  - `ConceptList.jsx:271` is a column-header icon;
  - `ConceptList.jsx:332` is a filter `<label>` ("🧭 Coverage"), not a column header as the
    coordinator's note said.
- Neither use is navigation, and the icon doesn't appear in the `public/` pages. Fine.

### 2. `30f2f19b`: merging #720 (the `/setup` scaffold)

**A clean merge that hides nothing.** `git merge-tree --write-tree c90986ad e8d15892` produces tree
`8f9e52e1`, byte-identical to `30f2f19b^{tree}`.

**No conflict with this change:**

- **Menu files.** The five menu files, `TopBar.jsx` and `Layout.jsx` are blob-identical before and
  after the merge.
- **Routes.**
  - `/setup`, `/setup/create-account`, `/setup/follow` and `/setup/activate` are top-level React
    routes (`App.jsx:231–243`), registered before the top-level `*` at `:483`.
  - No server file changed: `git diff --stat c90986ad 30f2f19b` lists only `ui/src` and docs. So
    `/setup` is purely client-side, and its `accountLinks` entry needs no `external` flag.
  - The Tapestry menu's `navigate()` and the Brainstorm menus' full page load reach the same page.
- **Styles.** All 159 added lines are appended at the end of the file (`styles.css:8464` onward).
  Every selector is under `.bs-setup-*`, plus one `@media (max-width: 480px)` block that holds two
  of them. None reaches `.user-dropdown`, `.bs-usermenu-*` or `.dropdown-*`.
- **Page shell.** `SetupIndex` and the placeholder pages mount `<TopBar />` with the default auth
  slot, which is `BrainstormUserMenu`. So `/setup` shows the account section too. Measured: the
  same six sections in the same order.

**Behaviour at HEAD:**

| From | Item | Lands on | Heading |
|---|---|---|---|
| Tapestry | Account Setup | `/setup` (same document) | "Finish setting up your account." |
| Tapestry | Assistant Management | `/assistant` (same document) | "Page not found" |
| `/about` and `/` | Account Setup | `/setup` (full page load) | "Finish setting up your account." |
| `/about` and `/setup` | Assistant Management | `/assistant` (full page load) | "Page not found" |

**#720's story scope.** The story is
`engineering-team/stories/setup-page-scaffold/1-setup-page-and-placeholders.md`.

- It lists "Any link to `/setup` from a menu or another page" as out of scope (`:119`).
- It records Open Question 2 as resolved: "No way in yet: `/setup` is reached only by its address
  until the Setup Alert is built" (`:130`).
- Both describe that story's end state, which the owner approved on 2026-09-20. The owner's
  2026-09-21 ask explicitly adds the menu link, so this change supersedes them.
- Nothing in #720's code or acceptance criteria depends on `/setup` being unlinked. AC-1 is about
  any visitor opening `/setup`.
- The Setup Alert is a separate item and is still queued.
- See non-blocking A2.

### 3. `78a09be5`: the ledger update

**Placement: right.**

- `ledger/2026-09-20-live-tier-fails-on-stale-stack.md` asks exactly the question this case
  answers: "is the stack running the code in this working tree?" (`:11–12`).
- Its fix shape 2, a build-identity probe, covers both ways in. A second row would split one fix
  across two files.
- The update uses the same form as the other ledger update on the branch
  (`2026-09-20-claude-md-overstates-bind-mount.md:51–53`): a `---` separator, then a bold dated
  lead after the Pointer. The row's `**Status:**` stays OPEN (`:6`).
- The row predates my review; see correction 1.

**The update's claims, re-checked:**

| Claim | Check | Result |
|---|---|---|
| `ps` shows the control panel started `Sat Sep 12 17:37:30 2026` | Re-ran the quoted command | ✅ identical |
| 19 commits changed `src/` or `bin/` since then | The quoted `--since='2026-09-12T17:37:30Z'` gives 19, and so does my 17:40:00Z bound | ✅ as a committer-date count, but it is a lower bound (A3) |
| `/api/assistant/roster` answers 404, though `src/api/index.js:543` registers it | 404 live. The file on disk inside the container has the route (`grep -c` → 1) | ✅ |
| The branch's code is on disk inside the container, and only the process is old | `docker exec tapestry grep -c MAX_PUBKEYS_PER_REQUEST …/fetchProfiles.js` → 7. The original row measured 0 | ✅ |
| `--ui` never restarts the backend (`DO_SERVER=0`, `:50`) | `scripts/dev-refresh.sh:25`, `:50` | ✅ |
| Two suites are red "for this reason alone" in `…041722Z…` | Both reproduce identically in `…044814Z…`. Where their code actually runs they pass: the roster suite 15/15 (`reviews/done/author-scoped-inspection/1-4-author-scoped-inspection.md:33`), `profile-lookup-bounds` 27/27 against staging (the row's own measurement). Here, exactly the assertions on new code fail | ✅ strongly supported; only a restart would prove it |
| `MAX_PUBKEYS_PER_REQUEST` arrived on 2026-09-20 in `56ea6cf9` | `git log -S` on `fetchProfiles.js` | ✅ |
| Row 289's premise held on 2026-09-13 and doesn't now | Attributed to row 289's own text. "fifteen" matches the 15-suite re-run the row records | ✅ |
| "nine days earlier" | 8 days 11 hours, i.e. nine calendar days (the 12th to the 21st) | ✅ read as calendar days |
| "Restarting this instance needs `--deps`, because `package.json` has changed" | Since the process started, root `package.json` gained only the `gate:status` script (`072da83a`). `dependencies`, `devDependencies` and `engines` are unchanged. `package-lock.json` is blob-identical between `cde8b282` and HEAD. Every root dependency is present in the container's `node_modules` | ❌ `--server` is enough (A4) |

### Corrections to the review above

1. **Harness friction 1 said "None exists: I searched OPEN.md and `ledger/`". That was false.**
   - `ledger/2026-09-20-live-tier-fails-on-stale-stack.md` was already on the branch when I wrote
     that. It was added in `13fdcc71` on 2026-09-20, and `git cat-file -e 01c7f03b:<path>`
     succeeds.
   - My patterns searched for a stale "server", "process" or "control panel", and missed "stale
     stack".
   - The coordinator's dedup is right, and the existing row is the correct home.
2. **"Both links land on 'Page not found'" held at `3938a16f`, but not at HEAD.**
   - Since the #720 merge, Account Setup reaches the `/setup` scaffold. Only Assistant Management
     still reaches "Page not found".
   - Non-blocking 3 now concerns only that one link.
   - Non-blocking 4's `external` caveat now applies only to `/assistant`.
3. **"19 server commits behind"** (Harness friction 1) is a committer-date count and a lower bound;
   see A3.
4. **Lint count.** The coordinator confirmed that the 29 they reported counted output lines. 27 is
   the right number.

### Findings (addendum)

#### Blocking

None.

#### Non-blocking

- **A1. My N2 comment wording overstates.** The optional rewording is under N2 above.
- **A2. Record the new way in to `/setup` in the open `setup-page-scaffold` book.**
  - The book (`engineering-team/audits/setup-page-scaffold/book.md`, still Open) and its story say
    `/setup` has no way in.
  - This review is filed under `navigation-scaffolding`, where that book's close won't look.
  - A one-line pointer in that `book.md` keeps its as-built audit honest. For example:
    "2026-09-21: the avatar menus now link to `/setup` as Account Setup (doc lane,
    `reviews/done/navigation-scaffolding/avatar-menu-account-section.md`)".
- **A3. "19" is a lower bound, in the ledger update and in my review.**
  - `--since` filters by committer date. It can't see a commit dated before the process started
    that reached the branch afterwards.
  - Row 289 names `cde8b282` as the commit the process booted from.
    `git rev-list --count cde8b282..HEAD -- src bin` gives 20. The extra one is `22fe7f28`, a
    merge dated 16:43Z on 09-12.
  - Suggested wording: "at least 19 commits (20 by ancestry from `cde8b282`)". The conclusion
    doesn't change.
- **A4. The ledger update's `--deps` claim is wrong.**
  - The exact fix is to replace the update's last sentence with: "Restarting this instance does not
    need `--deps`: since the process started, root `package.json` gained only the `gate:status`
    script (`072da83a`), `package-lock.json` is unchanged, and every root dependency is already
    installed in the container. `scripts/dev-refresh.sh --server` is enough."
  - Optional: broaden the row's title (not its id) to "…when the local stack isn't running the
    working tree's code".

#### Harness friction

None new.

### Verdict (addendum)

**PASS**

All three commits are sound. The scroll fix does what non-blocking 1 asked, at every size and for
both roles, including Windows-style scrollbars, with no horizontal overflow. The comment and icon
follow-ups landed. The #720 merge is exactly git's automatic merge and conflicts with nothing in
this change: its routes, page shell and styles are separate, and it gives Account Setup a real
destination. The ledger update sits in the right row, and its load-bearing claims reproduce. What
remains is record accuracy: my own comment wording (A1), a pointer for the setup book (A2), a
lower-bound count (A3) and one wrong restart instruction (A4). None of them affects the code.
