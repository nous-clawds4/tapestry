# Epic: navigation-scaffolding

**Created:** 2026-09-08
**Status:** In progress
**Provenance:** Operator request 2026-09-08 (in-session). Two new collapsible sections on the
left Tapestry menu with placeholder pages behind them, then a rework of both avatar menus so the
same set of personal destinations is reachable from either one, by every logged-in user.

## Goal

**One consistent way in.** A signed-in user should be able to reach their own profile, their
assistant's profile, their Treasure Map, their Trusted Agents, and the Dictionaries — plus the
three top-level destinations (Brainstorm landing, Tapestry Dashboard, Legacy Dashboard) — from
whichever avatar menu happens to be in front of them, without knowing which half of the app they
are standing in.

## Why it matters

The app has two shells: the Brainstorm search side (`/`, `/user/…`, `/tags`, …) and the Tapestry
control panel (`/tapestry/…`). Each grew its own avatar dropdown, and they drifted:

| Destination | Main menu (`BrainstormUserMenu`) | Tapestry menu (`Header`) |
|---|---|---|
| My Profile | absent | present, owner and non-owner alike |
| My Assistant's Profile | absent | present *only when* `assistantPubkey` is non-null |
| My Treasure Map | absent | absent |
| Tapestry Dashboard | owner/admin only | n/a (you're already there) |
| Legacy Dashboard | owner/admin only | absent |

So the answer to "where do I click to see my own profile?" depends on which page you happen to be
on, and three of the links are gated to owner/admin for no reason the user can see. The
Dictionaries and Trusted Agents sections are new surfaces that will need a home in both menus from
the start rather than being retrofitted later.

## Stories

`stories/navigation-scaffolding/`:
1. `1-dictionaries-and-trusted-agents-nav.md` — the two collapsible sidebar groups, their routes,
   and the six placeholder pages.
2. `2-unified-avatar-menus.md` — both avatar menus carry the same personal section and the same
   destinations section, visible to every logged-in user.

## Key facts / guardrails

- **`/legacy/` is not in the SPA.** It is served by Express
  (`bin/control-panel.js:259`), so a Legacy Dashboard link must be a real anchor / full page
  load — `navigate('/legacy/')` would hand it to the React router and 404 into `NotFound`.
- **The Main avatar menu is one shared component.** `BrainstormUserMenu` is mounted by ~14 pages;
  edit it once, not per page.
- **`?pov=` is optional on `/user/:pubkey`.** `BrainstormProfile` reads it with
  `searchParams.get('pov')` and degrades cleanly when absent, so "My Profile" needs no POV suffix.
- **The Treasure Map page is already per-viewer.** `pages/grapevine/TrustedAssertions.jsx` filters
  `authors: [user.pubkey]`, so `/tapestry/grapevine/trusted-assertions` *is* "My Treasure Map" —
  no new route needed.
- **`assistantPubkey` is genuinely absent for some users.** `getUserClassification.js:39` resolves
  it through `getAssistantKeys`, which returns the owner's `tapestry-assistant` key for the owner
  and a *customer relay key* for everyone else — null when none is provisioned. Operator decision
  at intake: show the item to everyone, disabled with a tooltip, rather than hiding it or minting
  a new page.
- **Placeholder pages are placeholders.** No POV columns, no trust filtering, no data access. The
  domain questions behind "Dictionaries" (the S3b / trusted-dictionary thread in
  `stories/_intake.md`) and "Trusted Agents" are deliberately deferred; nothing here should
  pre-commit their model.
