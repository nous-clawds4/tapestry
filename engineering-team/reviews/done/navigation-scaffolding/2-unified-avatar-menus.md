# Review: Story 2 — Both avatar menus carry the same destinations, for every logged-in user

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-08
**Diff:** `git diff staging...0a4aad99` (commit `0a4aad99`, branch `feat/navigation-scaffolding`)
**Epic:** `engineering-team/epics/navigation-scaffolding.md`
**Book:** `engineering-team/audits/navigation-scaffolding/book.md`

> **Abbreviated path.** Story + Implementer + Reviewer, chosen by the operator at intake: no ADR
> and no test plan, by design (recorded under the story's *Linked artifacts*). Their absence is
> **not** a defect below. There is no React component test harness in this repo, so the ACs are
> verified by reading the code that produces the behaviour, plus build/lint gates and the
> Implementer's live-browser pass against `http://localhost:7778`.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`** — **FAIL (pre-existing, environmental; unrelated to this diff).**
      Three suites fail, all on one assertion:
      `tl-membership-method-selector` (11 passed / 1 failed), `tl-weighted-sum-method` (6/1),
      `tl-certainty-method` (4/2) —
      `L0 GUARD publish policy is local-only … refusing to run: BRAINSTORM_PUBLIC_LOCAL_ONLY must be
      active (got {"success":true,"allowExternalPublish":true})`. That is **OPEN.md row 191**
      exactly (red-by-default on the product-default publish posture; the row also warns that
      setting the env var on the test shell does *not* help — the guard reads
      `/api/publish-policy` from the container). Every other suite PASS; `Total skipped: 34`.
      **This diff touches `ui/src/**` only — zero server code** — so it cannot be the cause.
- [x] **Regression signal specific to this story:** the repo's grep-sentinel suites that read the
      three rewritten menu files all passed —
      `pov-state-unification` (**S4**: "`BrainstormUserMenu` must consume `usePov()` … must call
      `setSelectedPov` — it is a SWITCHER now, not a read-only indicator"),
      `login-failure-and-tag-collapse` (pins `ui/src/components/BrainstormUserMenu.jsx`),
      `admin-tools-dashboard-panel`, `note-surfaces-ui`, `pov-selectable-tag-surfaces`,
      `search-result-parity`, `tag-detail-curated-view-and-pin-polish`. I checked whether any
      sentinel pinned the removed `bs-usermenu-admin-panel` block — **none does**, so the passes
      are real, not vacuous.
- [x] **`npm run test:playwright`** — **not run** (out of gate for the per-story cycle here; the
      browser suite carries a documented permanent failure, OPEN rows 89/116). Browser evidence for
      this story is the Implementer's live pass.
- [x] **`cd ui && npm run build`** — **PASS.** `✓ built in 10.21s`.
- [x] **`npx eslint` on the touched files, with a staging baseline for parity** — **PASS.**
      Per-file counts, branch vs. `staging` (throwaway worktree at `7bebeea5`):

      | File | staging | branch |
      |---|---|---|
      | `ui/src/components/BrainstormUserMenu.jsx` | E5 W0 | E5 W0 |
      | `ui/src/components/Header.jsx` | E0 W0 | E0 W0 |
      | `ui/src/pages/BrainstormSearch.jsx` | E17 W5 | E17 W5 |
      | `ui/src/components/AvatarMenuLink.jsx` | *(new)* | **E0 W0** |
      | `ui/src/config/avatarMenuLinks.js` | *(new)* | **E0 W0** |

      Exact parity; the two new files are clean. The Implementer's claim verified independently.
- [x] **`bash scripts/harness-lint.sh`** — **PASS.** `harness-lint: clean (0 violations)`.
- [x] Working tree clean after the gates.

## Spec adherence

### Both menus

| # | Acceptance criterion | Verified by | Result |
|---|---|---|---|
| 1 | Personal section offers all five: My Profile, My Assistant's Profile, My Treasure Map, My Trusted Agents, Dictionaries | `ui/src/config/avatarMenuLinks.js:31–69` returns exactly those five, in that order. Rendered at `BrainstormUserMenu.jsx:165–169`, `BrainstormSearch.jsx:561–565`, `Header.jsx:143–145` | ✅ |
| 2 | A **visually separate** section offers Brainstorm Landing Page, Tapestry Dashboard, Legacy Dashboard | `avatarMenuLinks.js:78–82`. Main menus: a second `<div class="bs-usermenu-section bs-usermenu-links">`, and `.bs-usermenu-section` carries `border-bottom: 1px solid rgba(255,255,255,0.06)` (`styles.css:2751–2754`) so the two sections are visibly divided. Tapestry menu: `<hr class="dropdown-divider" />` immediately before **and** after the block (`Header.jsx:151,155`) | ✅ |
| 3 | `customer` / `guest` sees all eight — none owner/admin-gated | There is no classification test anywhere near either block. `Header.jsx:143–154` renders `myLinks` + `destinationLinks` unconditionally for any truthy `user`; the surviving gate at `:146` is **Settings**, which the story's *Out of scope* explicitly retains. The Main menus' only `isOwnerOrAdmin` use is now the badge | ✅ |
| 4 | No `assistantPubkey` → item still present, **disabled**, with an explanatory tooltip | `avatarMenuLinks.js:43` sets `to: null` and always attaches `disabledReason` (`:45`, const at `:22–23`). Main menus: `AvatarMenuLink.jsx:11–21` renders a `<span class="bs-usermenu-link is-disabled" aria-disabled="true" title={disabledReason}>`, styled at `styles.css:2846–2852`. Tapestry menu: `Header.jsx:30–37` renders `<button class="dropdown-item" disabled title={disabledReason}>`, styled at `styles.css:761–764`. The item is never conditionally removed | ✅ (see non-blocking #2) |
| 5 | Signed-out behaviour unchanged (Main "Sign in with nostr" / Tapestry "Sign in with Nostr") | Untouched by the diff: `BrainstormUserMenu.jsx:85`, `BrainstormSearch.jsx:497`, `Header.jsx:166–174`. Ordering is safe — both Main early-returns (`:85`, `:497`) precede the `personalLinks(...)` call (`:96`, `:506`), and `Header` guards with `user ? … : []` (`:82–88`). `personalLinks` is not a hook, so calling it after an early return is legal | ✅ |
| 6 | Legacy Dashboard performs a **full page load** of `/legacy/`, not an SPA navigation | **Verified in all three menus.** Main + Search menus: `AvatarMenuLink.jsx:24` renders a bare `<a href="/legacy/">` whose `onClick` only closes the menu — no `preventDefault`, no `navigate()` — so the browser follows the anchor. Tapestry menu: `avatarMenuLinks.js:82` marks the link `external: true` and `Header.jsx:92–99` branches to `window.location.href`. Destination confirmed server-side: `bin/control-panel.js:150` (`express.static('/legacy', …)`) and `:259–266` (`app.get('/legacy')` → `serveHtmlFile('index.html')`), both registered **before** the SPA catch-all at `:344`. `public/index.html` does not exist, so the static mount falls through to the explicit route. Express default non-strict routing makes `/legacy/` match `/legacy` | ✅ |

### Per-menu targets

| # | Acceptance criterion | Verified by | Result |
|---|---|---|---|
| 7 | **Main** menu: My Profile → `/user/<my pubkey>`, assistant → `/user/<assistant pubkey>` | `BrainstormUserMenu.jsx:95–100` and `BrainstormSearch.jsx:506–510` both pass `profileBase: '/user'`; `avatarMenuLinks.js:37,43` compose `${profileBase}/${pubkey}`. `/user/:pubkey` is the same route search results link to (`App.jsx` Brainstorm block), and `?pov=` is optional there | ✅ |
| 8 | **Tapestry** menu: `/tapestry/users/<pubkey>` for both — unchanged from today | `Header.jsx:86` passes `profileBase: '/tapestry/users'`; identical to the two literals the diff replaced | ✅ |
| 9 | Either menu: Treasure Map → `/tapestry/grapevine/trusted-assertions`, Trusted Agents → `/tapestry/trusted-agents/mine`, Dictionaries → `/tapestry/dictionaries` | `avatarMenuLinks.js:52,58,64` — one shared list, so the three menus cannot disagree. All three targets exist: the first at the Grapevine group (`Layout.jsx:49`), the latter two created by Story 1 (`App.jsx:398–417`) | ✅ |

### Preserved

| # | Acceptance criterion | Verified by | Result |
|---|---|---|---|
| 10 | Main menu keeps POV switch, Your pins, Settings, Sign out; POV switch behaves exactly as before | `BrainstormUserMenu.jsx:137–162` (POV switch — `setSelectedPov`, `hasDelegate` guard, house/My-WoT buttons) and `:175–192` (📌 Your pins → `/pins`, ⚙️ Settings → `/settings`, Sign out) are byte-identical to `staging`; the diff inserts only *between* them. Independently pinned by the passing `pov-state-unification` S4 sentinel | ✅ |
| 11 | Tapestry menu keeps About and Sign Out | `Header.jsx:156–161`, unchanged | ✅ |
| 12 | Legacy page navigation untouched | No file under `public/` is in the diff. `git diff --stat` shows 15 files: 4 harness docs + 11 under `ui/src/` | ✅ |

### The three call sites — did anything get lost?

Checked line by line, both directions:

- **`BrainstormUserMenu.jsx`** — removed: the `isOwnerOrAdmin` `bs-usermenu-admin-panel` block
  (amber panel: dot + role label + Tapestry Dashboard + Legacy Dashboard anchors). Everything in it
  is accounted for: the two anchors are now `destinationLinks` entries rendered for *everyone*
  (a deliberate widening, AC-3), and the **role label is preserved** as
  `<span class="bs-usermenu-role-badge">` beside the display name (`:124–131`), driven by the same
  `isOwnerOrAdmin` guard and the same `classification === 'owner' ? 'Owner' : 'Admin'` ternary.
  New CSS at `styles.css:2854–2866` keeps the amber palette (`#fcd34d` on
  `rgba(251,191,36,…)`), so the visual signal survives the panel. `isOwnerOrAdmin` therefore stays
  referenced — no orphaned binding.
- **`BrainstormSearch.jsx`'s local `UserMenu`** — same removal, same badge relocation
  (`:534–544`), same two new sections. Its footer (Settings + Sign out) and its compact POV
  *indicator* (`:547–556`) are untouched. Note this menu never had "Your pins" or the POV
  *switch* — that asymmetry is pre-existing on `staging`, not introduced here.
- **`Header.jsx`** — the two hand-rolled buttons (My Profile; My Assistant's Profile, previously
  hidden behind `user.assistantPubkey &&`) are replaced by the shared list. The conditional
  *hiding* is gone, replaced by the disabled-with-tooltip row the story mandates. Settings, About,
  Sign Out, the header-button classification badge (`:129–131`) and the click-outside handler all
  survive unchanged.

**Net information loss: none.** The only behavioural deltas are the two the story ordered
(un-gating, and show-disabled instead of hide).

### Did any other avatar-menu or navigation surface get missed?

Searched exhaustively; **no.** The app has exactly three avatar menus and all three were updated:

- `ui/src/components/BrainstormUserMenu.jsx` — the shared Main menu. Mounted directly by 15 call
  sites (`BrainstormAbout`, `BrainstormAboutSearch`, `BrainstormEvent`, `BrainstormFeed`,
  `BrainstormFollowers`, `BrainstormFollows`, `BrainstormFollowsHops`, `BrainstormHowSearchWorks`,
  `BrainstormMuters`, `BrainstormPersonalization`, `BrainstormReporters`, `BrainstormSettings` ×2,
  `BrainstormSkill`, `BrainstormUserNotes`) **and** as `TopBar`'s default auth slot
  (`TopBar.jsx:49–52`), which covers `BrainstormProfile`, `Pins` ×2, `Tag`, `Tags`, `PinRedirect`.
  One edit, ~21 surfaces. ✅
- `ui/src/pages/BrainstormSearch.jsx:100` — the search page's own `UserMenu`, passed into `TopBar`
  via `authMenu` (`TopBar.jsx:12–17` documents why). ✅
- `ui/src/components/Header.jsx` — the Tapestry control-panel header. ✅

Everything else that could plausibly qualify, and why it isn't a miss:
`Layout.jsx` (the Tapestry sidebar — Story 1's surface); `TopBar.jsx` (delegates, no menu of its
own); `Breadcrumbs.jsx` (trail, not a menu); `NoteActionsMenu.jsx` / `TagActionsMenu.jsx`
(per-item action menus, not identity menus); `public/**` legacy HTML (explicitly out of scope).
The one genuine gap is **pre-existing and out of scope**: `ui/src/pages/developers/DevPage.jsx:45`
renders an empty `<div className="bsp-auth" />` — the developer-docs shell has *no* avatar menu at
all, on `staging` as well as here. Nothing to unify; flagged below as an observation only.
`public/kg/assets/*` also matches `bs-usermenu`, but that is a committed April build artifact, not
source.

## ADR adherence

None to check — abbreviated path, no ADR by design. **No new dependency** was introduced
(`ui/package.json` untouched). The layering the diff chose — one config module
(`config/avatarMenuLinks.js`, data only) + one presentational component
(`components/AvatarMenuLink.jsx`) consumed by three call sites — matches the existing
`config/` + `components/` split and is the right shape for "they can't drift again."

## Concept-graph integrity

- [x] No concept definitions changed → no firmware reinstall required, and none claimed.
- [x] No concept handles in the diff — no `kind:pubkey:slug` strings, no `39998:` coordinates,
      no `naddrEncode`.
- [x] **No hardcoded TA pubkey.** This is the rule most at risk in a menu rewrite that links to an
      assistant profile, and the diff gets it right: the assistant target is
      `user.assistantPubkey`, resolved per-caller at runtime through
      `AuthContext.jsx:69` ← `/api/auth/user-classification` ←
      `src/api/auth/getUserClassification.js:39` (`resolveAssistantPubkey` → `getAssistantKeys`).
      That is the **caller's** assistant, not the instance TA — correct for a menu item named
      "My Assistant's Profile". Grepped every touched file for 40+ hex runs / `nsec` / `npub1`:
      clean. The pre-existing `const { taPubkey: TA_PUBKEY } = useConfig()` at `Header.jsx:42` is
      the runtime helper, unchanged by this diff (and already unused on `staging`).
- [x] No `/summaries` or BIBLE re-derivation — no API calls added.

## Things tests can't catch

- [x] **Secrets:** none. Swept with `/usr/bin/grep` (the shell `grep` is a ugrep shim that skips
      gitignored files).
- [x] **Debug code:** no `console.log`, no `debugger`, no `TODO`/`FIXME` in the touched files.
- [x] **Commented-out code:** none. The comments that remain are explanatory (why the badge moved,
      why `/legacy/` is external, why the Treasure Map needs no new route) and each is accurate —
      I verified the Treasure Map claim at `avatarMenuLinks.js:50`: `TrustedAssertions.jsx:54,70`
      really does filter `kinds:[10040], authors:[user.pubkey]`, so it *is* per-viewer.
- [x] **Race conditions:** none. `go()` sets `menuOpen:false` then navigates; `AvatarMenuLink`'s
      `onClick` only closes the menu before the browser follows the anchor. No async, no
      cross-component state.
- [x] **Security / authorization.** Worth stating plainly because this story *removes* gating:
      un-gating the two dashboard links changes **discoverability, not reachability**. `/tapestry/*`
      is not route-gated (`Layout.jsx` reads `isOwner` only to filter `ownerOnly` nav entries), and
      `/legacy/*.html` has no server-side auth check at all (`bin/control-panel.js:207–266`
      `serveHtmlFile` just resolves a path and `res.sendFile`s it) — both were already reachable by
      typing the URL, on `staging`. Authorization lives in the APIs those pages call, not in
      whether a menu shows a link. So this is not a new exposure. It *is* worth the operator
      knowing that legacy pages are unauthenticated by URL (pre-existing; see non-blocking #4).
- [x] **Scope creep:** none. 15 files, all either the four harness docs or the nav surfaces the two
      stories name. No drive-by refactors, no reformatting of untouched regions.

## House rules check

- [x] Concept Graph API authority respected (not consulted — nothing domain-modelled here).
- [x] **No new lint/typecheck/build tooling.** No config or dependency change.
- [x] **Per-deployment TA pubkey — NEVER hardcode:** honored, see above. No `LEGACY_*` constant
      was touched or removed, so ADR-0015's named exception is intact.
- [x] Architecture invariants (CLAUDE.md §1–4): **§1 POV-first** — every target is composed from
      the signed-in caller's own pubkey at render time; nothing is precomputed, denormalized, or
      shared across POVs, and switching identity re-derives the whole list on the next render.
      **§2 decentralized-first** — the diff *removes* an owner/admin gate rather than adding one.
      **§3 filter at view time** — no stored derivation. **§4 local-first** — no storage touched.
      Clean on all four.

## Findings

### Blocking

None.

### Non-blocking

1. **`ui/src/styles.css:2972–3016` — dead CSS created by this diff.** The five
   `.bs-usermenu-admin-panel` / `-label` / `-dot` / `-btn` / `-btn:hover` rules (~45 lines) are now
   referenced by nothing: after this commit removes the block from **both**
   `BrainstormUserMenu.jsx` and `BrainstormSearch.jsx`, a repo-wide `/usr/bin/grep` for
   `usermenu-admin` returns only these CSS rules, plus a stale committed build artifact
   (`public/kg/assets/index-tvYLNdTn.css`) and an unrelated checkout under `.claude/worktrees/`.
   Not a correctness problem and not worth blocking a merge over, but it is orphaned by *this*
   change and should be deleted on *this* branch while the provenance is obvious. **Ask:** delete
   those five rules before merge.
2. **`ui/src/components/Header.jsx:30–37` — the disabled-item tooltip is less reliable in the
   Tapestry menu than in the other two.** The Main menus render the no-assistant row as
   `<span aria-disabled title=…>` (`AvatarMenuLink.jsx:11–21`), where the native tooltip always
   appears. The Tapestry menu uses `<button disabled title=…>`, and browsers do not agree about
   `title` on disabled form controls — Firefox suppresses pointer events on them, so the tooltip
   can silently not appear. AC-4 says the item "carries a tooltip"; the attribute *is* carried and
   the Implementer confirmed it live, so this is not a spec failure — but it is the one place where
   the three menus behave differently, in exactly the case the AC was written for. **Suggested
   fix:** drop `disabled` and mirror the span idiom (`aria-disabled="true"` + no-op `onClick` +
   the existing `.dropdown-item:disabled` styling keyed off a class), or wrap the button in a
   `<span title=…>`.
3. **`ui/src/components/AvatarMenuLink.jsx:23` — every Main-menu link is a full document load,
   not an SPA navigation.** That is deliberate and documented (copyable, middle-clickable, and it
   makes `/legacy/` work with no special case), and it matches the pre-existing `/pins` and
   `/settings` anchors in the same footer and the anchors in the block that was removed. Worth
   naming anyway: clicking "My Profile" from a Brainstorm page now reloads the whole bundle where
   an in-router `<Link>` would not. Also note `destinationLinks[…].external` is consumed **only**
   by `Header.jsx`; `AvatarMenuLink` ignores the flag because anchors make it moot. Fine as built —
   just don't let a future refactor swap the anchor for `<Link>` without re-adding the `external`
   branch, or `/legacy/` will start 404-ing into `NotFound`.
4. **Pre-existing, surfaced by this story:** `/legacy/` and `/legacy/*.html` are served with **no
   authentication check** (`bin/control-panel.js:259–266`). The story rightly ordered the link
   un-gated, and hiding a link was never a security control — but the Legacy Dashboard is now one
   click away for every signed-in `guest`, so if anything on those pages was relying on obscurity,
   now is the moment to find out. Not this story's job to fix; worth an `_intake.md` line if the
   operator cares.
5. **`ui/src/pages/developers/DevPage.jsx:45`** — the developer-docs shell renders an empty
   `bsp-auth` slot and therefore has no avatar menu at all. Pre-existing on `staging`, outside both
   stories. Mentioned because the epic's goal is "one consistent way in," and this is the one
   Brainstorm-side shell with no way in.
6. **`ui/src/components/Header.jsx:42`** — `TA_PUBKEY` is destructured and never used. Verified
   pre-existing on `staging` (and eslint-legal: the config's `no-unused-vars` allows `/^[A-Z_]/`).
   Free cleanup next time this file is opened.

### Harness friction

1. Same as Story 1's review: the branch is a single commit carrying stories, epic, book **and**
   implementation, against the project's "commit at each phase boundary: yes". Noted, not
   escalated to an OPEN row — the abbreviated path defines no commit cadence of its own.
2. `npm test` remains red-by-default for the reason recorded in **OPEN.md row 191**, so the
   headline gate result is "FAIL" on a clean, correct diff and every reviewer has to re-derive that
   the three failures are environmental. Row 191 is already OPEN with the fix proposed
   (skip-with-reason instead of hard FAIL); this run is one more data point for it. No new row.

## Verdict

**PASS**

All twelve acceptance criteria are satisfied by code I read and cross-checked; nothing was lost in
the three-call-site rewrite (the Owner/Admin badge relocation preserves the information, and the
two dashboard links were widened rather than dropped); no fourth avatar-menu surface exists that
was missed; `/legacy/` is a genuine full page load in all three menus, confirmed against the
Express routes; and the diff is clean on all four architecture invariants with no TA-pubkey
hardcode. Build, eslint parity and harness-lint are green; the only `npm test` failures are the
documented OPEN-191 environmental guard on suites this diff cannot reach. The dead
`.bs-usermenu-admin-*` CSS and the disabled-button tooltip are worth fixing but neither is a
reason to hold the merge.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place (`engineering-team/stories/navigation-scaffolding/2-unified-avatar-menus.md`).
- [x] Completion detection performed; result reported in chat (not recorded here, per the template).
