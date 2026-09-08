# Build Audit: Navigation scaffolding — Dictionaries, Trusted Agents, unified avatar menus

**Book:** `engineering-team/audits/navigation-scaffolding/book.md`
**Date:** 2026-09-08
**Branch / commit range:** `7bebeea5..8bb3e9b0` on `feat/navigation-scaffolding` → staging PR #610 (`450d433d`) → main PR #611 (`b3b84505`)
**Provenance:** Acceptance-frame *(no PRD; frame written at intake, amended once mid-book — see §4 #6)*
**Confidence:** high — the anchor was captured eagerly at intake, before any story existed, and amended in the operator's own words when scope moved.

> The Build Audit is the as-built record. It does not propose changes — that is `prd-seed.md`'s job.

## 1. What shipped

- **Two new collapsible sections on the Tapestry sidebar**, below Shared Concepts, visible to every user (not owner-gated) — `stories/done/navigation-scaffolding/1-dictionaries-and-trusted-agents-nav.md`
- **Seven placeholder pages** behind them: four under Dictionaries, three under Trusted Agents — stories #1 and #3
- **A written statement of the dictionary data model**, on `/tapestry/dictionaries`, in the operator's own words — `stories/…/3-setup-page-and-dictionaries-explainer.md`
- **One shared destination list rendered by all three avatar menus**, replacing three independently-drifted ones — `stories/…/2-unified-avatar-menus.md`
- **Five personal destinations and three front doors available to every signed-in user** — three of them (Tapestry Dashboard, Legacy Dashboard, and the whole personal group on the Brainstorm side) were previously owner/admin-only or absent — story #2

## 2. Epics & stories rolled up

### Epic: `navigation-scaffolding`

| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 dictionaries-and-trusted-agents-nav | Two collapsible sidebar groups, six routes, six placeholder pages, bare-prefix redirect | Done | `reviews/done/navigation-scaffolding/1-dictionaries-and-trusted-agents-nav.md` — PASS |
| #2 unified-avatar-menus | One shared link list across three menus; all items un-gated to every signed-in user; per-menu `profileBase` | Done | `reviews/done/navigation-scaffolding/2-unified-avatar-menus.md` — PASS |
| #3 setup-page-and-dictionaries-explainer | Seventh placeholder (Set Up), the verbatim dictionary-model explainer, and both non-blocking findings from reviews #1–2 | Done | `reviews/done/navigation-scaffolding/3-setup-page-and-dictionaries-explainer.md` — PASS |

No story was kicked back. Three stories, three reviews, three PASS on first pass.

## 3. As-built inventory

**User-facing — routes added (all under the existing `/tapestry` `Layout`):**

| Route | Page | Crumb |
|---|---|---|
| `/tapestry/dictionaries` | `DictionariesIndex` — the explainer + placeholder box | Dictionaries |
| `/tapestry/dictionaries/tags` | `DictionaryTags` | Tags |
| `/tapestry/dictionaries/dlists` | `DictionaryDLists` | DLists |
| `/tapestry/dictionaries/concepts` | `DictionaryConcepts` | Concepts |
| `/tapestry/trusted-agents` | `<Navigate replace>` → `…/mine` | Trusted Agents |
| `/tapestry/trusted-agents/mine` | `MyTrustedAgents` | Mine |
| `/tapestry/trusted-agents/all` | `AllTrustedAgents` | All |
| `/tapestry/trusted-agents/setup` | `TrustedAgentSetup` | Set Up |

**User-facing — the three avatar menus.** All now render, from `ui/src/config/avatarMenuLinks.js`:
a personal section (My Profile · My Assistant's Profile · My Treasure Map · My Trusted Agents ·
Dictionaries) and a visually separate destinations section (Brainstorm Landing Page · Tapestry
Dashboard · Legacy Dashboard).

| Menu | File | Mounted by | Profile base | Navigation |
|---|---|---|---|---|
| Main (simple) | `components/BrainstormUserMenu.jsx` | ~14 pages + `TopBar` default slot | `/user` | `<a href>` — full load |
| Main (search) | `pages/BrainstormSearch.jsx` → inline `UserMenu` | the landing/results page only | `/user` | `<a href>` — full load |
| Tapestry | `components/Header.jsx` | the `/tapestry` `Layout` | `/tapestry/users` | `navigate()`, except `external` → `window.location` |

**New modules:** `config/avatarMenuLinks.js` (the shared list + `NO_ASSISTANT_REASON`),
`components/AvatarMenuLink.jsx` (anchor row, disabled variant), `components/PlaceholderPage.jsx`
(shared placeholder shell), `pages/dictionaries/Placeholders.jsx`,
`pages/trusted-agents/Placeholders.jsx`.

**CSS:** added `.bs-usermenu-links` / `-link` / `-link-icon` / `-role-badge`, `.page-prose`,
`.dropdown-item-wrap`, `.dropdown-item:disabled`; **removed** the five orphaned
`.bs-usermenu-admin-*` rules; narrowed `.dropdown-item:hover` to `:not(:disabled)`.

**Domain:** none. No concept, handle, schema, firmware seed, event kind, API route, or stored
shape was created or changed. `git diff --stat` touches no file under `src/`, `bin/`, `setup/`,
`firmware/`, or `test/`. The concepts named on the placeholder pages (`tag`, `list`,
`concept header`, `trusted dictionary snapshot`, `tapestry assistant`) are named for orientation
and wired to nothing.

**Data & contracts:** unchanged. No session, storage, or auth-shape change — hence no forced
sign-out on promotion.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame: "both avatar menus" — the operator described **two**, Main and Tapestry | **Three** menus updated: `BrainstormUserMenu`, `BrainstormSearch`'s inline `UserMenu`, and `Header` | constraint-discovered | The landing page does not use `BrainstormUserMenu`; it carries its own state-heavy copy (`TopBar.jsx:11–17`, ADR-0003). Updating two would have left the *landing page* — the operator's own example of "the Main menu" — unchanged. Found during implementation, recorded in `epics/navigation-scaffolding.md` | None negative: the operator's intent is fully met where they expected it | The two Brainstorm-side menus remain separate components sharing a list, not one component. §6 #4 |
| 2 | Frame: "these links … available to every logged in user" | All eight are, **except** My Assistant's Profile, which renders disabled with a tooltip when the caller has no provisioned assistant key | interpretation | Operator decision at intake, recorded in the frame's own exception clause. `getUserClassification.js:39` resolves `assistantPubkey` through `getAssistantKeys` → null for anyone without a provisioned customer relay key | A guest sees the item and learns *why* it is unavailable, instead of it silently not existing | Provisioning an assistant for non-owner users is unmodelled. §6 #1 |
| 3 | Frame: Trusted Agents sub-items are "Mine, All" | **Mine, All, Set Up** | intentional-change | Operator addition mid-book; frame amended in their words (`book.md` → "Amended 2026-09-08") | A third placeholder; the pairing flow has a home | Sponsor/Agent pairing is undefined. §6 #2 |
| 4 | Frame: "just indicate that each of the new pages is a placeholder" | Six pages do exactly that; the **Dictionaries index** additionally carries ~1,489 characters of operator prose stating the dictionary data model | intentional-change | Operator addition mid-book; frame amended. The prose is protected as verbatim by AC-3 of story #3 and by an explicit instruction in `epics/navigation-scaffolding.md:63–68` | The index is now a design document readable in the product, not a stub | This text is the de-facto spec for dictionary work. §6 #3, #5, #6 |
| 5 | Frame is silent on the owner/admin panel | The Brainstorm-side `.bs-usermenu-admin-panel` was **removed**; its two links moved into the shared destinations section and its role badge moved beside the display name as `.bs-usermenu-role-badge` | added-beyond-scope *(necessary consequence)* | Keeping the panel would have duplicated Tapestry Dashboard and Legacy Dashboard in one dropdown. Removing it wholesale would have dropped the Owner/Admin indicator, an unrequested regression — so the badge was relocated. Review #2 confirmed all three of the panel's contents are accounted for | Owner/admin users see the same badge information in a different place; everyone gains the two links | — |
| 6 | The frame itself | **Amended once, mid-book**, after stories #1–2 had shipped | interpretation | Deviations #3 and #4 arrived as an operator message during the book. Recorded as a dated `### Amended` block rather than a silent edit or a second book, on the judgement that both additions sit inside the same navigation-scaffolding intent | None | The frame's amendability is now precedent. §7 |
| 7 | Story #1 AC-7: "breadcrumbs resolve to readable names" | Met — but `/tapestry/dictionaries` breadcrumbs as `Home › Dictionaries`, where the Shared Concepts group it was modelled on gives `Home › Shared Concepts › Shared Concepts Registry` | interpretation | The index route carries no `handle.crumb` of its own (`App.jsx`). Review #1 finding 1 flags it as a choice to make deliberately, not an oversight | Trivially different trail on one page | §6 #7 |

**Undocumented work** — none. Every file in the diff traces to story #1, #2, or #3, or to a
review finding folded into #3. Reviews #1–3 each walked the diff independently and reported no
unattributed change; review #3 explicitly confirmed nothing outside `ui/` and the harness markdown
was touched.

## 5. Quality state at close

- **`harness-lint` at close: clean (0 violations)** — run *after* the book flip and the epic
  close-out, so it certifies the tree this close actually leaves behind. This is the check that
  matters here: L2 (a Closed book ⇒ every epic it lists is Done) is the one a close can break, and
  it is green.
- **`npm test` at close: `Overall: FAIL`, in ~41 minutes** (09:02 → 09:43). The failures are
  **exactly and only** the three OPEN.md row 191 suites — `tl-membership-method-selector` (11 pass /
  1 fail), `tl-weighted-sum-method` (6/1, 2 skipped), `tl-certainty-method` (4/3) — on the `L0 GUARD`
  that refuses to run unless the deployment is in local-only publish mode. **Every other suite
  passes**, including all nine that touch surfaces adjacent to this book. 55 skipped. This diff
  touches no file under `test/`, and CI's `stack-free` check ran the same tree green (next bullet),
  so the FAIL headline is the known environmental guard and not a property of this close.
  The ~41-minute wall time is itself a finding — see §7.
- **CI is the authoritative gate for this book.** The required `stack-free` check on PR #611 ran
  `npm test` **green** in 55s ([run 34220607325](https://github.com/nous-clawds4/tapestry/actions/runs/34220607325)),
  which independently confirms the local failures below are environmental.
- **Known open issues, all pre-existing and none reachable by this diff:**
  - **OPEN.md row 191** — three `trusted-lists` suites hard-FAIL on a legitimate default config
    (`L0 GUARD` requires local-only publish mode). Every one of this book's three reviews spent a
    full-suite run re-deriving that these are environmental. Row 191 already proposes the fix
    (skip-with-reason). Fourth consecutive data point; see §7.
  - Review #2 findings 5 and 6 — `pages/developers/DevPage.jsx:45` renders an empty `bsp-auth`
    slot and so has **no** avatar menu (the one Brainstorm shell with no way in), and
    `components/Header.jsx:42` destructures an unused `TA_PUBKEY`. Both verified pre-existing on
    `staging`.
- **New debt logged:** none by ADR — this book ran the abbreviated path and produced no ADRs. The
  debt it does create is documentary, not structural: see §6 #3.
- **Deploys:** staging [34220123455](https://github.com/nous-clawds4/tapestry/actions/runs/34220123455)
  green 94s; production [34220718500](https://github.com/nous-clawds4/tapestry/actions/runs/34220718500)
  green 1m41s. Identical bundle hash `index-Clik5ZwC.js` from local build through staging to
  production. Five-tier smoke clean on both; production showed one post-deploy 502 absorbed by the
  stability poll (streak 3 by attempt 4), the documented flicker.

## 6. Carry-forward register

- [ ] **1. Assistant provisioning for non-owner users is unmodelled.** The menu now advertises "My
      Assistant's Profile" to everyone and tells a guest one is not provisioned — but there is no
      path from that state to having one. (from §4 #2)
- [ ] **2. Sponsor/Agent pairing is undefined.** "Trusted Agent" has no concept in the graph; the
      nearest is `tapestry assistant`, which is not the same thing. Three placeholder pages now
      promise Mine / All / Set Up. (from §4 #3, story #3 Out of scope)
- [ ] **3. The dictionary model exists only as page prose.** It is not an ADR, a schema, a concept,
      or a protocol note — it is 1,489 characters of JSX with a durable baseline in story #3. Any
      real dictionary work should start by ratifying it into whatever form binds. (from §4 #4)
- [ ] **4. The two Brainstorm-side avatar menus are still separate components.** They share the
      link list but duplicate the dropdown shell. `BrainstormSearch`'s copy exists because of its
      POV/filter state (ADR-0003); worth revisiting only if a third divergence appears.
      (from §4 #1, review #2 finding 3)
- [ ] **5. Two phrases in the explainer sit where CLAUDE.md §1–§2 bite, *when the model is built*.**
      "usage and acceptance **by the community**" is POV-relative — there is no global "the
      community"; it resolves through the active POV's WoT columns. "the **steward** … typically the
      owner … will override community-based criteria" reads as an admin gate unless hand-curation is
      modelled as *anyone's* publishable assertion that a given POV may or may not weigh. Nothing is
      wrong today — nothing is implemented — but the reflex checks must be run in whatever ADR
      implements the validity flag and the added-by-hand field, not assumed settled by this page.
      (from review #3 finding 5)
- [ ] **6. The relationship between the new pages and their existing namesakes is unresolved.** The
      Dictionaries → Concepts page vs the 🧩 Concepts section; Dictionaries → Tags vs `/tags`;
      Dictionaries → DLists vs 📋 Simple Lists; and Dictionaries vs the existing Shared Concepts →
      Trusted Dictionary. Four pairs of same-named surfaces. (story #1 Out of scope)
- [ ] **7. Small nav items:** the `/tapestry/dictionaries` breadcrumb depth choice (§4 #7); the
      `/tapestry/trusted-agents` redirect must be *replaced*, not layered under, when that group
      gains a real index (review #1 finding 2); "TA Treasure Map" in the sidebar vs "My Treasure
      Map" in the menus — one destination, two names, which is the drift this epic exists to remove
      (review #1 finding 3). **Swept to OPEN.md rows 214 (two names, one destination), 215 (the
      redirect must be replaced not layered under) and 216 (`.dropdown-item:last-child` now matches
      the wrapped disabled button).**
- [ ] **8. `/legacy/*.html` has no server-side auth check.** Pre-existing and surfaced, not caused:
      `bin/control-panel.js:150` mounts the entire `public/` tree under `/legacy/`, above
      `app.use(authMiddleware)` at `:286`. Un-gating the link changed discoverability, not
      reachability. Filed to `stories/_intake.md` (2026-09-08) for a gate-or-retire decision.

## 7. Process findings (harness)

Retro run on measurement: `scripts/harness-stats.sh` at close — 193 reviews parsed, **191 final
PASS / 2 final CHANGES_REQUESTED, 1% kick-back rate**; books close in 0–2 days typically, and this
one closed same-day (0d). This book contributed 3 reviews, all first-pass PASS.

| Finding | Source | Terminal state |
|---|---|---|
| **The abbreviated path defines no commit cadence.** All of stories #1–2, the epic, the book *and* the implementation landed in one commit (`0a4aad99`), against project settings' "Commit at each phase boundary: yes" — costing the reviewer the ability to diff spec-vs-code by commit. Raised in **all three** reviews; the third noted that if the path is used routinely its cadence should be written down. | reviews #1, #2, #3 "Harness friction" 1 | **OPEN.md row 212** (`meta`) — third occurrence in one book is the threshold; escalated rather than noted a fourth time. |
| **`npm test` is red-by-default, so every reviewer re-derives that the failures are environmental.** Three consecutive full-suite runs in this book spent on it. Fourth book to hit it. | reviews #1–3 friction 2; row 191 | **Declined (no new row)** — OPEN.md row 191 already carries the finding *and* the proposed fix (skip-with-reason). This book adds a data point to its priority, recorded here and in §5, not a duplicate row. |
| **A "verbatim" requirement with no in-repo baseline is self-certifying.** Story #3's AC-3 demanded verbatim prose, but the only copy of the words was the JSX under test; the reviewer could verify it *only* because the operator's message was still in the session transcript, which is outside the repo and not durable. | review #3 non-blocking 1 | **Fixed on-branch, commit `8bb3e9b0`** — the operator's unbroken source is now a fenced block in story #3's Background, and the diff is reproducible from the repo alone. Operator-ratified by the close. |
| **The acceptance frame was amended mid-book rather than opening a second book.** Two operator additions arrived after stories #1–2 shipped; both sat inside the same intent, so the frame gained a dated `### Amended` block and the work became story #3. | §4 #6 (process-shaped deviation) | **Declined (no row)** — the workflow already calls the frame "the durable definition of done" without forbidding amendment, and a dated amendment block preserves what was agreed when. Recording the precedent here is sufficient; no harness change proposed. |
| **Playwright's pinned headless shell is not installed, so a reviewer's browser gate needs `channel: 'chrome'`.** `chromium_headless_shell-1194` absent from `~/Library/Caches/ms-playwright` (1187/1223/1228 present). Anyone reaching for a headless render in this repo hits it. | review #3 friction 3 | **OPEN.md row 213** (`meta`) — one-line fix (`npx playwright install`) but it costs each reviewer the same detour. |
| **No React component test harness exists**, so UI acceptance criteria are verified by build + eslint parity + live browser inspection, and (this book) a fetch-stub remount to reach signed-in surfaces without a NIP-07 signer. | this book's method; adjacent to rows 192/193 | **Declined (no new row)** — rows 192 and 193 already carry the UI-testability gap and the static-regex hazard from the same root cause. Adding a third row would fragment one problem across three. |
| **The local `npm test` now takes ~41 minutes** (09:02 → 09:43 at this close), against the **10–20 minutes** row 204 estimated when it was written on 2026-08-27. The fixture pile has roughly doubled the run in twelve days. At this rate step 10 stops being a gate anyone waits for, which is how gates quietly become unrun. | this close, step 10; row 204 | **Declined (no new row)** — row 204 already carries the cause (live TL suites republish a TL per live pin against hundreds of stale fixtures) and three candidate fixes. Recorded here as evidence its severity estimate is stale and its priority should rise; a second row would fragment one problem. |

**Does it port to the other flow (Direction ↔ human-gated)?** Row 212 (abbreviated-path cadence)
ports: a Direction-mode book on the abbreviated path would hit the same missing cadence with no
human present to notice. Row 213 is flow-neutral. The rest are human-gated-only or already-carried.
