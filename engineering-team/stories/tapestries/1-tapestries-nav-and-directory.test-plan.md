# Test Plan: Story 1 — Tapestries navigation + View Tapestries directory + Create stub

**Story:** `engineering-team/stories/tapestries/1-tapestries-nav-and-directory.md`
**ADR:** `engineering-team/decisions/tapestries/0001-nav-directory-and-strfry-element-read.md`
**Date:** 2026-07-23

## Coverage map

All tests live in one Playwright spec: `tests/brainstorm/tapestries-nav-and-directory.spec.js`.

| Criterion | Test name | Level |
|---|---|---|
| AC-1 (nav group under Nostr Users; View + Create sublinks; visible to all) | `AC-1: a guest sees a "Tapestries" nav group under Nostr Users that expands to View + Create` | e2e (Playwright) |
| AC-2 (directory lists elements from strfry; title/description/author) | `AC-2: View Tapestries reads strfry (kinds 39999, #z tapestry) and lists title/description/author` | e2e |
| AC-3 (row → `/tapestry/tapestries/:uuid`) | `AC-3: clicking a tapestry row navigates to /tapestry/tapestries/<uuid>` | e2e |
| AC-4 (empty state) | `AC-4: View Tapestries shows an empty state when there are no tapestries` | e2e |
| AC-5 (Create = inert placeholder previewing planned fields) | `AC-5: Create New Tapestry is an inert placeholder previewing the planned fields` | e2e |

## Edge cases
- [x] **Empty directory** — explicit test (AC-4): `queryRelay` returns `[]` → empty-state copy, no error.
- [x] **Malformed element** — a tapestry event missing its `json` tag degrades to a d-tag fallback title and does not crash the page (`Edge:` test).
- [x] **Guest (logged-out) visibility** — AC-1 runs with mocked-unauthenticated auth, proving the group is not owner-gated.
- [x] **Data-source contract** — AC-2 captures the `/api/strfry/scan` filter and asserts `kinds:[39999]` + a `#z` entry matching `39998:<TA>:tapestry` (pins ADR 0001's strfry decision, and that the TA handle is built from the runtime pubkey, not hardcoded).
- Deferred to Story 2: the exploration page content behind `/tapestry/tapestries/:uuid` (this story's `TapestryDetail` is a placeholder).

## Test infrastructure
- **Framework:** Playwright (`playwright.config.js`, `testDir: ./tests`, `baseURL: http://localhost:7778`). Spec follows the `tests/brainstorm/*.spec.js` conventions (route-stubbing, `BRAINSTORM_SERVER_ACCESSIBLE` skip guard, mocked auth/profiles).
- **Network mocks:** `/api/strfry/scan` (directory data), `/api/assistant/pubkey` (TA handle), `/api/profiles` (author name), `/api/auth/*` (guest). Non-stubbed requests hit the live stack, so the stack must be up.
- **Preconditions:**
  - Local stack reachable at `:7778` — `tests/global-setup.js` probes it and sets `BRAINSTORM_SERVER_ACCESSIBLE=true`; otherwise the suite self-skips.
  - Playwright browser installed: `npx playwright install chromium` (done for build v1194 during this phase — the packaged version had drifted ahead of the cached browsers).
  - **The served UI is a built `dist/` bundle** (`bin/control-panel.js` serves `../dist` + SPA catch-all), not live HMR. So after implementation the Implementer must **rebuild the UI** (`vite build`, or `scripts/dev-refresh.sh`) for the served app to include the feature — only then do these tests pass. (This checkout was fast-forwarded 28 commits to `origin/staging`; a dev-stack refresh also ensures the served bundle matches current source.)
- **Firmware / graph state:** none required — the directory reads strfry and every data endpoint the assertions depend on is stubbed.

## How to run

```
npx playwright test tests/brainstorm/tapestries-nav-and-directory.spec.js --project=chromium
```

## Verification
The new tests fail against the current build (feature not implemented). Confirmed 2026-07-23 at commit `0ca36ca5` — all 6 fail because the feature elements are absent (not import/typo errors):

```
Locator: getByRole('button', { name: /Tapestries/i })          → element(s) not found   (AC-1: nav group absent)
Locator: getByText('Tapestry for Dog').first()                 → element(s) not found   (AC-2: directory absent)
Locator: getByText(/no tapestries/i).first()                   → element(s) not found   (AC-4: empty state absent)
Locator: getByText('Tapestry for Dog').first()                 → element(s) not found   (AC-3: directory absent)
Locator: getByText('Tapestry for Dog').first()                 → element(s) not found   (Edge: directory absent)
Locator: getByText(/create new tapestry/i).first()             → element(s) not found   (AC-5: create stub absent)

6 failed
```
