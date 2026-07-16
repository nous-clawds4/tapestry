# Story 4: Unify POV selection state — one writer, no mount clobber, global switcher

**Status:** Done
**Created:** 2026-07-09
**Type:** Bug + Enhancement (Story-1 completeness)
**Provenance:** Live-found 2026-07-09. Operator set "My WoT" in Settings, hard-refreshed a tag page,
and still saw the *unfiltered / no-POV* disclosure — even though the prefs file correctly held
`pov:"user"`. Also: the POV can't be changed from the global user menu (only search page / settings).

## Background / root cause
Story 1 lifted the POV selection into `PovContext` and converged **the search page** onto it. But
**two other POV controls were never converged** and each keeps its own `pov` state + its own
persistence:
- `ui/src/pages/BrainstormSettings.jsx` (the "Point of View: House / My WoT" cards) — local
  `useState('nosfabrica')`, persists to `localStorage['bs_pov_<pk>']` + `PUT /api/user-prefs`.
- `ui/src/components/BrainstormUserMenu.jsx` (the global top-bar avatar menu, on ~15 pages via
  `TopBar`) — local `useState('nosfabrica')`, **read-only indicator** ("Searching as: …"), no switch.

On top of that, **`PovContext` clobbers the saved value on mount** (`PovContext.jsx:50-58`): the
*persist* effect runs when `user` loads with the **default `selectedPov='nosfabrica'`** — before the
*load* effect's async `GET /api/user-prefs` resolves — and writes `localStorage='nosfabrica'` +
`PUT {pov:'nosfabrica'}`, racing the load. So a fresh mount can persist the default over the saved
`pov:'user'` and the reads go out as `wotPov=house` → on an instance with no house delegate that
renders the *"no point of view configured"* disclosure. Non-deterministic, exactly matching the
report. (The Story-2 review flagged this as a "redundant mount-time PUT" — it is worse: a clobber.)

Net: **three uncoordinated writers + a mount-clobber race** make the selection unreliable and
un-changeable from the top bar.

## User-facing description
As someone choosing a point of view, I want **one** selection that I can set from the search page,
the settings page, **or the top-bar user menu**, that **survives a refresh**, and that every tag
surface and search honors — so switching POV is reliable and available everywhere, not silently
reset to the default.

## Acceptance criteria
- [ ] **The saved POV survives a fresh mount (the clobber fix).** Given the prefs hold `pov:"user"`,
  when any page loads fresh (hard refresh), then the tag reads go out under `wotPov=user` — the
  default is **never** persisted over the saved value on mount, and the honest-state banner reflects
  the *actual* selected POV (filtered when provisioned), not house.
- [ ] **One selection governs all three controls.** Setting the POV from the search page, the
  settings page, **or** the global user menu updates the **same** selection; every tag surface +
  search reflects it. Exactly **one** component persists `pov` (`PovContext`); the others delegate.
- [ ] **The global user menu can change the POV (not just show it).** `BrainstormUserMenu` offers a
  House ⇄ My WoT switch that writes through the shared selection; changing it there is reflected on
  the next surface load, from any page that shows the top bar.
- [ ] **My WoT is offered sensibly (option A).** The global-menu switch offers "My WoT" only when the
  viewer's WoT delegate is configured (a `rankAuthor` exists); otherwise it shows/【defaults to】House.
  A selected-but-unprovisioned POV still discloses honestly via the Story-2 banner (no silent lie).
- [ ] **Settings converged.** The Settings "Point of View" toggle writes through the shared selection
  (no private `pov` state, no separate `pov` persistence) — toggling it there reliably drives the tag
  reads after navigation/refresh.
- [ ] **No search regression.** `BrainstormSearch`'s POV behavior (auto-select-on-ready, the
  "Searching as" label, `povSwitching`) is unchanged; it already consumes `usePov()`.

## Approach (light architecture — captured here; no separate ADR)
- **`PovContext`:** add a hydration guard (`useRef(false)`) — the *persist* effect returns early until
  the value has been loaded (localStorage fast-path + server), so the **default is never written on
  mount**. After hydration, only user-initiated `setSelectedPov` changes persist. This is the single
  source + single writer.
- **`BrainstormSettings.jsx`:** replace its local `pov`/`setPov` + prefs persistence with `usePov()`.
- **`BrainstormUserMenu.jsx`:** replace its local `pov` state + prefs load with `usePov()`; turn the
  read-only indicator into a switch (House / My WoT buttons → `setSelectedPov`), gating "My WoT" on a
  configured delegate.

## Out of scope
- Extracting the full `myWotReady`/`checkMeiliScores` machinery into a shared hook (the menu uses a
  lightweight "delegate configured" proxy; the Story-2 banner covers the not-computed case).
- Changing what filtering does (Story 3 already fixed the threshold); this is selection-state only.
- The pin/notes POV-disclosure gap and the pin-not-landing-locally issue (separate follow-ups).

## Linked artifacts
- ADR: none (obvious state-unification bug; approach captured above).
- Test plan: `engineering-team/stories/pov-selectable-tag-surfaces/4-unify-pov-selection-state.test-plan.md`
- Tests: `test/pov-state-unification.test.js`
- Review: (after Review)
