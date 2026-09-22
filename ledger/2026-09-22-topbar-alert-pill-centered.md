# The top bar's alert pills sat beside the avatar, off to the right, where Brainstorm centers its pill

**Id:** 2026-09-22-topbar-alert-pill-centered
**Type:** bug
**Opened:** 2026-09-22 (operator-present hotfix, session "center the top-bar alert pills")
**Status:** DONE
**Done:** 2026-09-22 — commit `5106672f` on `fix/center-topbar-alert-pill`

**What was seen.** The owner reported that the Setup Alert ("Finish setting up your account") and the Assistant Alert
("Manage your Tapestry Assistant") both "should be centered, but they are instead off to the right." The cause was a
design choice, not a stray value: ADR setup-status-and-alert/0002 and ADR assistant-management/0002 mounted both pills
beside each avatar menu. Brainstorm, their model, centers the pill: `client/src/components/AppHeader.tsx` uses a
`1fr auto 1fr` grid, and `client/src/pages/landing.tsx` centers it absolutely.

**What shipped.** This is the hotfix lane (intake § 3), and this row is its trace. One CSS rule in `ui/src/styles.css`,
after the Assistant pill's block, takes either pill out of its row and centers it on the bar:
- from 640 px in `.bsp-top-bar` and `.bss-top-bar`;
- from 1200 px in `.app-header`, the control panel, where a 150 px user name and a role badge need the room.

Narrower bars keep the pill beside the avatar. So does the search results header (`.bs-results-header`) at every
width, because its search box fills the middle. No mount moved. The rule, the widths and the measurements are in
ADR setup-status-and-alert/0002 Amendment 2. ADR assistant-management/0002 Amendment 2 points there.

**Verified.** The local stack was synced to `staging` (23 server files and the UI build had fallen behind) and runs
this build. Signed in through a fetch stub, the pill measured centered to the pixel at every page and width sampled
(640–1280 px on the Brainstorm bars, 1200–1280 px in the control panel). It was never closer than 14 px to anything
else in the bar. No bar scrolled sideways, and it fell back beside the avatar at 639 px, 375 px and 1199 px. The pills'
three Playwright suites (`setup-alert`, `assistant-alert`, `setup-alert-polish`) pass unchanged against the built UI:
83 of 83.

**Residuals, left on purpose.**
- **No test pins the centering.** Both B1s check only where the pill is mounted, which did not move. The owner chose
  the hotfix lane over the Standard bug cycle, which would have added one. If the centering ever drifts, the fix is a
  B-class width sweep asserting the pill's midpoint equals the bar's at 640/1024/1280 px (1200/1280 px on
  `/tapestry/`), plus the fallback below each cutoff.
- The cutoffs are fixed widths, set by the widest content each bar can hold today. Wider content at a bar's
  sides (a second nav link in `TopBar`, say) would need them re-measured.

**Pointer:** commit `5106672f`; ADR setup-status-and-alert/0002 Amendment 2; ADR assistant-management/0002 Amendment 2.
