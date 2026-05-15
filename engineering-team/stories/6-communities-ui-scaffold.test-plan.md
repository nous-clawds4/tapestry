# Test Plan: Story 6 — Brainstorm Communities UI scaffold

**Story:** `engineering-team/stories/6-communities-ui-scaffold.md`
**ADR:** `engineering-team/decisions/0004-ui-communities-scaffold.md`
**Date:** 2026-05-14

## Approach

Slice 0 is mostly a **substrate** — a new directory tree, a build wiring, a deploy workflow, a token system. The ADR pins specific files and shapes (tokens.css, the host-aware Express fallback, the Dockerfile delta, the deploy workflow secrets). For that surface, **source-regex / file-shape assertions** in the project's hand-rolled Node runner are the right test level — same approach used in story #5 and the strfry-router first-boot bug.

For user-visible behavior (route reachability, drawer open/close, step wizard navigation, mobile width holding) **Playwright** tests target `COMMUNITIES_BASE_URL` (defaults to `http://localhost:5174` — the new Vite dev server). These tests fail initially because the dev server can't be reached / the routes don't exist.

The genuinely subjective acceptance criteria — "not a whiff of vibe coded" polish bar, brand palette adherence, motion choreography — are not fully testable. The test plan captures **what is mechanically pinned** (no `#a855f7` lavender ships, no `tweaks-panel` ships, MuseoModerno is bundled and referenced, etc.) and flags the rest as **manual review-gate items** the Reviewer audits.

## Coverage map

| Criterion | Test name | File | Level |
|---|---|---|---|
| AC-1 (Brand mark in header, royal `#662d91` default → magenta on hover, no placeholder "B") | T1 `Header renders BrainstormMark SVG (no placeholder "B" tile)` + R1 `header CSS uses var(--brand) and var(--accent) for the mark, not a hex literal` | `test/communities-ui-scaffold.test.js`, `tests/brainstorm/communities-ui-scaffold.spec.js` | source-regex + Playwright |
| AC-2 (Brand palette tokens; no `#a855f7`, no ember/moss; no prototype theme switcher) | T2 `tokens.css declares the locked brand palette with exact hex values` + T3 `no #a855f7 (prototype lavender) appears anywhere in ui-communities/` + T4 `no tweaks-panel or design-canvas modules are present in ui-communities/` | `test/communities-ui-scaffold.test.js` | source-regex |
| AC-3 (MuseoModerno self-hosted, DM Sans self-hosted, font-display swap, no Google Fonts CDN) | T5 `fonts.css declares @font-face for MuseoModerno and DM Sans with font-display: swap and local()/url() pointing to public/fonts` + T6 `no fonts.googleapis.com link in ui-communities/index.html` | `test/communities-ui-scaffold.test.js` | source-regex |
| AC-4 (tweaks panel absent in prod build) | covered by T4 above | — | source-regex |
| AC-5 (`/` renders Discover with hero, search, tag filter, card grid, live filter) | P1 `Discover renders hero, search, tag pills, and a grid of community cards` + P2 `typing in the search input narrows the visible cards by name match` | `tests/brainstorm/communities-ui-scaffold.spec.js` | Playwright |
| AC-6 (`/community/:slug` renders detail with banner, header, 3 tabs, member rows + signed-in "Your view"/Leave) | P3 `community detail shows banner, header, People/Conversation/About tabs, and a Your view + Leave action pair when joined` | `tests/brainstorm/communities-ui-scaffold.spec.js` | Playwright |
| AC-7 (`/my-circles` renders joined circles + Start a circle CTA) | P4 `MyCircles shows the joined-set as a card grid plus a Start a circle CTA leading to /create` | `tests/brainstorm/communities-ui-scaffold.spec.js` | Playwright |
| AC-8 (`/create` 5-step wizard with Name→Similar→Topics→Founding voices→Review and validation on each step) | P5 `Create wizard surfaces five labelled steps and disables Continue when the current step is incomplete` | `tests/brainstorm/communities-ui-scaffold.spec.js` | Playwright |
| AC-9 (`/edit/:slug` shows "Your view" callout + per-field "(your view)" labels) | P6 `Edit page foregrounds the personal-projection callout and labels fields with "(your view)"` + T7 `ViewCallout module has the canonical projection-pattern copy` | `test/communities-ui-scaffold.test.js`, `tests/brainstorm/communities-ui-scaffold.spec.js` | source-regex + Playwright |
| AC-10 (member drawer opens/closes; survives navigation) | P7 `clicking a member row opens the drawer with name, trust, vouchers and Vouch + Raise-a-concern actions; overlay click closes` | `tests/brainstorm/communities-ui-scaffold.spec.js` | Playwright |
| AC-11 (cross-product link to brainstorm.world in header, target=_blank) | T8 `Header includes an anchor to brainstorm.world that opens in a new tab` | `test/communities-ui-scaffold.test.js` | source-regex |
| AC-12 (NotFound surface for unknown routes) | P8 `unknown /some-bogus-path route renders the styled NotFound with a Back to Discover CTA` | `tests/brainstorm/communities-ui-scaffold.spec.js` | Playwright |
| AC-13 (no Independent hosts / mirror count rendered) | T9 `no shipped component string-references "Independent hosts", "mirrors", or "{c.mirrors}"` | `test/communities-ui-scaffold.test.js` | source-regex |
| AC-14 (UX-vocab glossary honored: Vouch / Raise a concern / Founding voices / Trusted here; no Endorse/Veto) | T10 `shipped UI strings use Vouch + Raise a concern + Founding voices + Trusted here; no Endorse or Veto in user-facing components` | `test/communities-ui-scaffold.test.js` | source-regex |
| AC-15 (no lorem/TODO/FIXME/EDITMODE markers in shipped output) | T11 `no lorem/TODO/FIXME/EDITMODE-BEGIN/EDITMODE-END markers ship in ui-communities/src` | `test/communities-ui-scaffold.test.js` | source-regex |
| AC-16 (mobile 375×812, tablet 768×1024, desktop 1440×900 hold without horizontal scroll) | P9 `Discover and CommunityDetail hold layout at 375×812 and 1440×900 without horizontal scrollbars` (screenshot artifacts attached) | `tests/brainstorm/communities-ui-scaffold.spec.js` | Playwright |
| AC-17 (choreographed motion — staggered card entry, drawer overshoot ease, step-progress interpolation) | T12 `tokens.css declares ease-overshoot + ease-out-cubic and animation duration tokens used by CardGrid/Drawer/StepProgress` + visual inspection | `test/communities-ui-scaffold.test.js` | source-regex + Reviewer manual |
| AC-18 (color not the only state cue — checkmark on joined, "Trusted by N" text alongside dot, check on completed steps) | T13 `CommunityCard renders a checkmark glyph alongside the success color when joined` + T14 `StepProgress renders a check glyph at completed steps, not color alone` | `test/communities-ui-scaffold.test.js` | source-regex |
| AC-19 (WCAG AA contrast for body text on bg-card, accent CTA text on accent, text-muted on bg) | Reviewer manual + axe-core spot-check on staging | — | manual + reviewer |
| AC-20 (no inline-style soup — single source-of-truth for tokens) | T15 `no component sets background/color/border with literal palette hex codes inline; values resolve through CSS variables` | `test/communities-ui-scaffold.test.js` | source-regex |
| AC-21 (build succeeds, no ESLint errors, no missing-font warnings) | T16 `ui-communities/package.json declares build/lint scripts; ui-communities/eslint.config.js exists` + CI run | `test/communities-ui-scaffold.test.js` + CI | source-regex + CI |
| AC-22 (Express serves dist-communities/ on communities host without breaking the existing dist/ mount) | T17 `bin/control-panel.js registers express.static for dist-communities and the SPA fallback is host-aware (communities.* → dist-communities/index.html)` | `test/communities-ui-scaffold.test.js` | source-regex |
| AC-23 (`.github/workflows/deploy-communities.yml` exists, triggers on push to feat/communities, uses COMMUNITIES secret triad) | T18 `deploy-communities.yml triggers on push to feat/communities and references DEPLOY_HOST_COMMUNITIES, DEPLOY_USER_COMMUNITIES, DEPLOY_SSH_KEY_COMMUNITIES` | `test/communities-ui-scaffold.test.js` | source-regex |
| AC-24 (Dockerfile has parallel ui-communities build step) | T19 `Dockerfile copies ui-communities/package.json, runs npm ci, and runs npm run build for ui-communities` | `test/communities-ui-scaffold.test.js` | source-regex |
| AC-25 (existing ui/ build unregressed) | regression: `cd ui && npm run build` continues to pass — covered by the existing CI for the ui/ Vite build | — | CI regression |
| AC-26 (existing public/ control-panel pages still load) | manual smoke against `http://localhost:8080/legacy/control-panel.html` after deploy | — | manual smoke |

## Edge cases

- [x] **Empty community filter result on Discover.** P2 covers the narrowing case; an empty-state message ("No circles match your search.") is rendered when the filter eliminates all cards. The exact copy is pinned by inheriting the prototype's string ("No circles match your search. Try a different interest.") — T20 asserts the empty-state component is reachable from Discover.
- [x] **Drawer survives navigation.** P7 includes a step that navigates within the SPA while the drawer is open and asserts it stays open (verifies it isn't tied to a route).
- [x] **Step wizard guards.** P5 asserts Continue is disabled on step 0 (empty name), enabled after typing a name, disabled on step 3 (zero founding voices selected), enabled after selecting at least one.
- [x] **Cross-product link condenses on mobile but does not vanish.** P9 (mobile-width run) asserts the anchor still resolves but may render in a compact form.
- [x] **Host-aware fallback for `localhost.communities` and `communities.*` aliases.** T17 asserts the helper accepts multiple host shapes per ADR §3 — the `dist-communities/` SPA fallback is not narrowly bound to a single FQDN.
- [x] **`.gitignore` excludes `dist-communities/`.** T21 asserts the line is present (mirrors the existing `dist/` pattern in the gitignore).

## Not covered (intentional)

- **Subjective visual-polish bar** ("not a whiff of vibe coded"). Captured as Reviewer manual checklist items: header lockup, type hierarchy, spacing rhythm, motion feel, dark-surface depth, mobile-first feel. Not mechanically testable.
- **Pixel-perfect screenshots vs. design.** The handoff prototype is a wireframe, not a visual target. We aim *above* it; pixel comparison would lock us *to* it.
- **WCAG AA contrast across every text/surface pair.** T2 pins the token values, R-axe spot-check on staging confirms — but full audit is a manual review-gate item, not an automated regression.
- **Actual deploy success on push to `feat/communities`.** First runs are expected to fail with missing-secret messages until David provisions the droplet + secrets. The test asserts the workflow file is correctly shaped, not that a real deploy succeeds. Verified post-droplet-provisioning by checking that the workflow logs say "secret not configured" until they don't.
- **Performance budgets (LCP, INP).** Slice 0 ships with mock data and no images larger than the brand SVG; performance is intrinsically good. Performance budgets become relevant in Slice 3+ when real data arrives.
- **i18n / RTL.** Not in v1 scope per PLAN.md and story §"Out of scope".

## Test infrastructure

- **Node runner:** `test/test.js` registers `communities-ui-scaffold.test.js` alongside the existing suites. Same pattern as story #5.
- **Playwright:** `tests/brainstorm/communities-ui-scaffold.spec.js`. `playwright.config.js` already supports `BRAINSTORM_BASE_URL`; we add `COMMUNITIES_BASE_URL` (defaults to `http://localhost:5174`, the new Vite dev server) without modifying the config — the spec reads `process.env.COMMUNITIES_BASE_URL` directly via `test.use({ baseURL: ... })` at the spec level.
- **No new test dependencies.** Pure Node `fs`/`path` for the source-regex layer; existing `@playwright/test` for the browser layer.
- **Fixtures:** none. Source-regex tests `fs.readFileSync` against the new files; Playwright tests load the Vite dev server (or the Express-served `dist-communities/` when running against staging).

## How to run

```bash
# Node-runner source-regex tests
npm test

# Playwright browser tests (against local Vite dev server)
cd ui-communities && npm run dev &
COMMUNITIES_BASE_URL=http://localhost:5174 npm run test:playwright -- communities-ui-scaffold

# Playwright against staging post-deploy
COMMUNITIES_BASE_URL=https://communities.brainstorm.world npm run test:playwright -- communities-ui-scaffold
```

## Verification

Tests fail with the current code (Slice 0 not yet implemented). Confirmed on 2026-05-14 at commit `b36a7e75`:

```
$ npm test
...
communities-ui-scaffold suite:
  ✗ ui-communities/package.json exists with a name of "ui-communities" and the required scripts
      ENOENT: no such file or directory, open '.../ui-communities/package.json'
  ✗ ui-communities/src/styles/tokens.css declares the locked Brainstorm brand palette
      ENOENT: no such file or directory, open '.../ui-communities/src/styles/tokens.css'
  ✗ ui-communities/src/styles/fonts.css declares MuseoModerno self-hosted
      ENOENT: no such file or directory, open '.../ui-communities/src/styles/fonts.css'
  ✗ no #a855f7 (prototype lavender) anywhere in ui-communities/
      ENOENT: no such file or directory: ui-communities/
  ✗ Dockerfile builds ui-communities/ in parallel with ui/
      Dockerfile is missing the `cd /usr/local/lib/node_modules/brainstorm/ui-communities && npm run build` line
  ✗ .github/workflows/deploy-communities.yml triggers on push to feat/communities
      ENOENT: no such file or directory, open '.github/workflows/deploy-communities.yml'
  ✗ bin/control-panel.js registers dist-communities + host-aware SPA fallback
      control-panel.js does not register express.static for ../dist-communities
  ... (rest of the suite fails for the same "file doesn't exist yet" reason)
```

Failures are meaningful — they describe what the Implementer must produce, not "expected true to be false."
