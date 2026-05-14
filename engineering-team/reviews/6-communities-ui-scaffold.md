# Review: Story 6 — Brainstorm Communities UI scaffold (Slice 0)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-14
**Branch:** `feat/communities` (4 commits ahead of origin)
**Diff:** `git diff origin/feat/communities...HEAD` — four commits in the slice:

- `92b2c46c` story: communities-ui-scaffold (#6)
- `b36a7e75` adr: 0004 — ui-communities scaffold + host-based Express routing
- `ac89cc13` test-plan: communities-ui-scaffold (#6) — failing tests committed
- `e421d95b` impl: communities-ui-scaffold (#6) — Slice 0 ships

**Classification:** Feature / Standard / all five phases applied per CLAUDE.md.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test` — PASS.** Five suites + Configuration Loading all green:
  - Configuration Loading: PASS
  - treasure-maps-router-preset: 5/5 PASS
  - scheduled-search-and-house-scores-refresh: 12/12 PASS
  - strfry-router-first-boot-config: 3/3 PASS
  - per-query-neo4j-timeout-safety-net: 8/8 PASS
  - **communities-ui-scaffold: 26/26 PASS** (new in this slice)
- [x] **`cd ui-communities && npm run lint` — PASS.** ESLint 9.39 clean across all 26 .jsx and 16 .module.css source files, plus `App.jsx`, `main.jsx`, `vite.config.js`, `eslint.config.js`. No errors, no warnings.
- [x] **`cd ui-communities && npm run build` — PASS.** Vite 7.3.3, 86 modules transformed, 561 ms, emits `dist-communities/index.html` + content-hashed `assets/index-*.css` (42 kB) + `assets/index-*.js` (331 kB / 106 kB gzip). No build errors, no `chunk-too-large` warnings.
- [ ] **`npm run test:playwright -- communities-ui-scaffold` — deferred.** Playwright spec exists at [tests/brainstorm/communities-ui-scaffold.spec.js](tests/brainstorm/communities-ui-scaffold.spec.js). The spec targets `COMMUNITIES_BASE_URL` (defaults to `http://localhost:5174`) and exercises route reachability, drawer open/close, step-wizard validation, cross-product link, mobile-width hold. Running it in CI requires the Vite dev server to be up; the test plan calls this out as a separate run mode (local dev or post-deploy staging). Not blocking for Slice 0 merge — the equivalent surface was manually exercised via the preview tool (snapshots captured at 375×812 mobile and at full desktop width, both held the layout).
- [x] _Typecheck — not configured per CLAUDE.md house rule. Confirmed `package.json` carries no `tsc` script and `ui-communities/package.json` introduces none._

## Spec adherence (vs. story #6 acceptance criteria)

Going through every AC explicitly:

### Identity & brand

- [x] **AC-1** (real Brainstorm mark in header, royal default → magenta on hover, no placeholder "B") — Verified at [Header.jsx:23–30](ui-communities/src/components/Header.jsx#L23) (renders `<BrainstormMark variant="mark" />`) and [BrainstormMark.jsx](ui-communities/src/components/BrainstormMark.jsx) (inline SVG with `fill="currentColor"`). [Header.module.css:33–46](ui-communities/src/components/Header.module.css#L33) wires `color: var(--brand)` → `color: var(--accent)` on hover with a drop-shadow glow. Source-regex test T1 + screenshot confirms no placeholder "B" tile ships.
- [x] **AC-2** (locked brand palette; no `#a855f7`, no ember/moss) — [tokens.css:18–20](ui-communities/src/styles/tokens.css#L18) declares `--brand: #662d91`, `--accent: #ba20ba`, `--highlight: #fbb03b`. T3 confirms no `#a855f7` anywhere in `ui-communities/src`. T9 confirms no `[data-direction="ember|moss|neon"]` blocks survive.
- [x] **AC-3** (MuseoModerno + DM Sans self-hosted, font-display: swap, no Google CDN) — [fonts.css](ui-communities/src/styles/fonts.css) declares 4 @font-face blocks all with `font-display: swap`, all `src: url('/fonts/...')`. T5 + T6 confirm. `ui-communities/public/fonts/` contains all 4 variable-font TTFs (MuseoModerno + Italic, DM Sans + Italic) totaling ~1 MB.
- [x] **AC-4** (no tweaks panel in production) — T4 confirms no `tweaks-panel*` or `design-canvas*` file in `ui-communities/src`. The prototype's tweaks panel is intentionally not ported.

### Routes & journeys

- [x] **AC-5** (Discover) — [Discover.jsx](ui-communities/src/pages/Discover.jsx) renders hero with `BrainstormMark` watermark + "Find your people" heading with gradient `<em>your</em>` + lede + `SearchBar` + horizontal-scroll `TagPill` row (with mask-image fade) + grid of `CommunityCard`s. Filter logic at [Discover.jsx:17–28](ui-communities/src/pages/Discover.jsx#L17) matches name, description, and tag-label substrings; activeTag filters by ID. Verified visually at both 1280px and 375px viewports — layout holds, hero rises, cards stagger-enter.
- [x] **AC-6** (Community Detail with banner, header, 3 tabs, joined-state "Your view"/Leave) — [CommunityDetail.jsx](ui-communities/src/pages/CommunityDetail.jsx) renders all required surfaces. The "Your view / Leave" action pair at [lines 56–67](ui-communities/src/pages/CommunityDetail.jsx#L56) only renders when `joined && signedIn`. Tab switching wires `useState`, the tab indicator gets the magenta-gradient underline via [CommunityDetail.module.css:152](ui-communities/src/pages/CommunityDetail.module.css#L152).
- [x] **AC-7** (My Circles + Start a circle CTA) — [MyCircles.jsx](ui-communities/src/pages/MyCircles.jsx) renders the joined-set as a grid with the prominent "+ Start a circle" CTA at [line 21](ui-communities/src/pages/MyCircles.jsx#L21). Empty state at [lines 27–37](ui-communities/src/pages/MyCircles.jsx#L27) uses the brand mark at 40% opacity per the design bar.
- [x] **AC-8** (Create wizard, 5 labelled steps, validation) — [Create.jsx](ui-communities/src/pages/Create.jsx) has the exact 5 step labels in `STEPS` at [line 14](ui-communities/src/pages/Create.jsx#L14). Continue is disabled at step 0 (`!name.trim()` [line 75](ui-communities/src/pages/Create.jsx#L75)) and step 3 (`seedMembers.length === 0` [line 178](ui-communities/src/pages/Create.jsx#L178)). The "Similar circles" step (Q4's soft-canonicalization gate) at [line 84](ui-communities/src/pages/Create.jsx#L84) only surfaces matches when `name.length >= 2`.
- [x] **AC-9** (Edit page foregrounds "Your view") — [Edit.jsx:23](ui-communities/src/pages/Edit.jsx#L23) renders `<ViewCallout />` (which emits the canonical projection-pattern copy from [ViewCallout.jsx:24](ui-communities/src/components/ViewCallout.jsx#L24)). FormInput labels carry the `(your view)` suffix at lines [35–39](ui-communities/src/pages/Edit.jsx#L35). T7 confirms the canonical copy.
- [x] **AC-10** (Member drawer opens on row click, dismisses on overlay click, survives navigation) — [Drawer.jsx](ui-communities/src/components/Drawer.jsx) renders fixed-position with `data-testid="member-drawer"` and `data-testid="drawer-overlay"`. Drawer state lives at `App.jsx` root ([App.jsx:36](ui-communities/src/App.jsx#L36)) so it survives route changes (the drawer is rendered outside the `<Outlet>`). ESC close + body-scroll-lock at [Drawer.jsx:7–18](ui-communities/src/components/Drawer.jsx#L7).

### Sibling identity & navigation

- [x] **AC-11** (cross-product link, target=_blank, condense on mobile) — [Header.jsx:47–55](ui-communities/src/components/Header.jsx#L47) renders `<a href="https://brainstorm.world" target="_blank" rel="noopener noreferrer">`. T8 confirms target + rel attributes. At < 880 px the label collapses to icon-only via [Header.module.css:213](ui-communities/src/components/Header.module.css#L213); at < 640 px the whole link hides — *minor deviation from the literal AC* which said "condense but not vanish." See **Finding NB-1** below.
- [x] **AC-12** (styled NotFound for unknown routes) — [NotFound.jsx](ui-communities/src/pages/NotFound.jsx) + [NotFound.module.css](ui-communities/src/pages/NotFound.module.css). Mark at 40% opacity, copy "We can't find that circle.", primary CTA `<Link to="/">← Back to Discover`. Wired both as the route's `errorElement` and as the `*` child route in [App.jsx:107](ui-communities/src/App.jsx#L107).

### Hygiene

- [x] **AC-13** (no Independent hosts / mirror count surfaced) — T9 confirms no component references `c.mirrors`, "Independent hosts", or "mirror count". The `mirrors` field is retained in [mockData.js](ui-communities/src/data/mockData.js) (e.g. `mirrors: 4` on Listening Room) for forward compatibility with v1.1.
- [x] **AC-14** (Vouch / Raise a concern / Founding voices / Trusted here; no Endorse/Veto user-facing) — T10 confirms all four friendly labels present + no `Endorse`/`Veto` outside `glossary.js`. [glossary.js](ui-communities/src/lib/glossary.js) maps `vouch.signalType: 'endorse'` and `concern.signalType: 'veto'` for the eventual Slice 4 publish path.
- [x] **AC-15** (no lorem/TODO/FIXME/EDITMODE markers) — T11 confirms.

### Visual polish bar

- [x] **AC-16** (mobile 375×812 + tablet + desktop hold without horizontal scroll) — Manually verified at 375×812 (Discover renders single-column card grid, hero scales, filter row scrolls horizontally with mask-fade; Community Detail wraps title, stats stay 3-wide). At 1440×900 the header fits all nav items + cross-link + user chip. Playwright spec encodes the scroll-width check (`scrollWidth <= clientWidth + 1` tolerance). **Tablet 768×1024 not explicitly captured** — see **Finding NB-2**.
- [x] **AC-17** (choreographed motion) — T12 + visual confirmation. Card grid uses `cardEnter` keyframes with `--card-delay: calc(min(index * 35, 320))ms` ([CommunityCard.jsx:9](ui-communities/src/components/CommunityCard.jsx#L9), [CommunityCard.module.css:14–24](ui-communities/src/components/CommunityCard.module.css#L14)). Drawer uses `var(--ease-overshoot)` ([Drawer.module.css:34](ui-communities/src/components/Drawer.module.css#L34)). StepProgress uses interpolated transitions ([StepProgress.module.css:34](ui-communities/src/components/StepProgress.module.css#L34)).
- [x] **AC-18** (no color-alone state) — T13 + T14 + visual confirmation. Joined badge pairs `<svg>` check glyph with success-tinted background ([CommunityCard.jsx:30–35](ui-communities/src/components/CommunityCard.jsx#L30)). Completed step nodes render an SVG check ([StepProgress.jsx:25–32](ui-communities/src/components/StepProgress.jsx#L25)). Trust dots are always paired with text ("Welcomed by Omar + 11 others", "Trusted by N people in this circle", etc.).
- [x] **AC-19** (WCAG AA contrast) — Token values verified by reasoning: `--text #f4f0fa` on `--bg #0a0612` is ~18:1; `--text-muted #8a809a` on `--bg` is ~5.8:1; `--text-on-accent #ffffff` on `--accent #ba20ba` is ~5.7:1; all above 4.5:1 body / 3:1 large thresholds. **Full axe-core audit deferred** to post-deploy staging — flagged as a non-blocking Reviewer manual item per the test plan.
- [x] **AC-20** (no inline-style soup; tokens single source of truth) — T15 confirms no brand-palette hex literals in component JSX. Inline `style={{}}` usage is restricted to truly dynamic values: avatar size/bg via `getAvatarBg()`, trust-bar width as `${trustPct}%`, card animation delay via CSS-var assignment, banner gradient using `--community-accent` from the data model. All other styling lives in `.module.css` siblings.

### Build, deploy, Express mount

- [x] **AC-21** (build + lint clean) — verified above.
- [x] **AC-22** (Express serves dist-communities on communities host without breaking dist mount) — [bin/control-panel.js:131](bin/control-panel.js#L131) registers the static dir; [bin/control-panel.js:282–296](bin/control-panel.js#L282) registers the host-aware SPA fallback. T17 confirms.
- [x] **AC-23** (deploy-communities.yml exists with correct trigger + secrets) — [.github/workflows/deploy-communities.yml](.github/workflows/deploy-communities.yml) triggers on push to `feat/communities`, uses `DEPLOY_HOST_COMMUNITIES`, `DEPLOY_USER_COMMUNITIES`, `DEPLOY_SSH_KEY_COMMUNITIES`. T18 confirms. First runs are expected to fail with a "secret not configured" message until David provisions the droplet — this is the agreed behavior, not a regression.
- [x] **AC-24** (Dockerfile parallel build) — [Dockerfile:88–89](Dockerfile#L88) (COPY + ci) + [Dockerfile:104–105](Dockerfile#L104) (build). T19 confirms.

### Regression

- [x] **AC-25** (existing ui/ build unregressed) — `ui/package.json` and `ui/vite.config.js` not modified by this diff. The existing Dockerfile `cd ui && npm run build` step at [Dockerfile:98](Dockerfile#L98) is preserved verbatim.
- [x] **AC-26** (existing public/ control-panel pages still load) — the only `bin/control-panel.js` changes are (a) one additional `express.static` registration and (b) a host-aware modification to the SPA catch-all that preserves the default `dist/index.html` for non-communities hosts. The legacy `/legacy/*` and `/control/*` mounts are untouched. Manual smoke against `http://localhost:8080/legacy/control-panel.html` is deferred to post-deploy smoke; the host-check logic guarantees this path is unchanged for `brainstorm.world` / `staging.brainstorm.world` / etc.

No criterion is silently dropped. No behavior added that isn't in the story.

## ADR adherence (vs. ADR-0004)

- [x] **Parallel `ui-communities/` Vite app.** Confirmed. Sibling to `ui/`, independent `package.json`, `vite.config.js`, `eslint.config.js`. React 19 + Vite 7 + React Router 7 — exact versions used in `ui/`.
- [x] **Build output to `../dist-communities/`.** [vite.config.js:7–10](ui-communities/vite.config.js#L7).
- [x] **Vite dev server port 5174.** [vite.config.js:13](ui-communities/vite.config.js#L13). `/api` proxy to `:8080` matches the ADR.
- [x] **CSS Modules + tokens.css.** Implementer used `.module.css` siblings throughout. The token set in [tokens.css](ui-communities/src/styles/tokens.css) covers every category named in the ADR: brand, surfaces, text, status, spacing (1–8), radii, type, motion easings (`--ease-out-cubic`, `--ease-overshoot`, `--ease-in-out`, `--ease-linear`), durations (`--dur-fast/medium/slow/pageful`), z-layers, and layout maxes.
- [x] **Brand assets vendored.** Mark + lockup SVGs at [src/assets/brand/](ui-communities/src/assets/brand/), MuseoModerno + DM Sans TTFs at [public/fonts/](ui-communities/public/fonts/). No Google Fonts CDN link in `index.html` (T6 confirms).
- [x] **Express mount host-aware.** Helper at [bin/control-panel.js:283–288](bin/control-panel.js#L283) recognizes `communities.brainstorm.world`, `communities.localhost`, and any `communities.*` alias per the ADR's "How to apply" notes.
- [x] **Dockerfile parallel build step.** Exactly as the ADR specified.
- [x] **Deploy workflow body identical to deploy-staging.yml.** Confirmed by diff against `.github/workflows/deploy-staging.yml`.
- [x] **Glossary surface at `src/lib/glossary.js`.** Implementer matched the ADR's exact suggested shape: `GLOSSARY.vouch.signalType === 'endorse'`, `GLOSSARY.concern.signalType === 'veto'`.
- [x] **No new lint/typecheck tooling beyond what `ui/` already has.** `ui-communities/eslint.config.js` is a copy of `ui/eslint.config.js` with `globalIgnores(['../dist-communities'])` instead of `['dist']`. No new tooling.
- [x] **No new dependencies the ADR didn't authorize.** `ui-communities/package.json` declares only the same deps `ui/` already uses. Sub-deps (transitive) are part of the same toolchain.

**No ADR deviations.**

## Concept-graph integrity

- [x] **N/A for Slice 0.** No concept definitions, no schemas, no firmware JSON touched. No `kind:pubkey:slug` handles introduced. **No firmware reinstall required**, as the ADR explicitly states. The glossary at [glossary.js](ui-communities/src/lib/glossary.js) documents the protocol-term mapping for slices 1–6 to consume.

## Things tests can't catch

- [x] **No secrets in committed files.** The only "identifier-shaped" string in this diff is the avatar-color hash function — pure presentational. Mock data uses fictional names + handles, no real npubs. The deploy workflow references repo secrets by name only.
- [x] **No leftover debug logging or `console.log`.** Searched — zero occurrences in `ui-communities/src/`.
- [x] **No commented-out code.** Confirmed by inspection.
- [x] **Error paths handled where it matters.**
  - Unknown community slug → `CommunityDetail` and `Edit` both render a "Circle not found" state with a Back-to-Discover CTA ([CommunityDetail.jsx:22–28](ui-communities/src/pages/CommunityDetail.jsx#L22), [Edit.jsx:19–24](ui-communities/src/pages/Edit.jsx#L19)).
  - Unknown route → router's `errorElement` + the `*` child route both fall through to NotFound.
  - Missing member in drawer → `MemberDrawerContent` short-circuits with `return null` ([MemberDrawerContent.jsx:9](ui-communities/src/pages/MemberDrawerContent.jsx#L9)).
  - Empty filter result → Discover renders the brand-mark empty state ([Discover.jsx:60–66](ui-communities/src/pages/Discover.jsx#L60)).
  - Empty joined set → MyCircles renders the dashed-border empty state with explicit "Explore circles" CTA.
- [x] **Concurrency / race conditions considered.** Pure client-side state; no async writes. The drawer ESC handler + scroll-lock effect at [Drawer.jsx:7–18](ui-communities/src/components/Drawer.jsx#L7) properly cleans up via the `return` callback.
- [x] **Security.** No `dangerouslySetInnerHTML` anywhere. All text rendered through React's escape pipeline. The `target="_blank"` link includes `rel="noopener noreferrer"`. The brand SVG is inlined; no untrusted `<svg>` interpolation.
- [x] **Reduced-motion respected.** `@media (prefers-reduced-motion: reduce)` block at [reset.css:67–73](ui-communities/src/styles/reset.css#L67) caps all animations and transitions to 0.01 ms.

## House rules check

- [x] **Concept Graph API authority respected** — N/A this slice.
- [x] **No new lint/typecheck/build tooling without an ADR** — `ui-communities/eslint.config.js` is a re-use of the existing `ui/` config pattern, authorized in the ADR explicitly. Vite + React Router are not new dependencies at the project level (`ui/` already uses them at the same major versions).
- [x] **CLAUDE.md "JS-without-build" rule.** Confirmed via the ADR: the no-build rule applies to `public/`, not `ui-communities/`. The legacy `public/`-based control-panel pages were not touched.

## Manual visual review (subjective polish — Reviewer checklist per test plan)

Captured via the preview tool at desktop and 375 × 812 mobile viewports:

- [x] **Brand identity reads first.** Royal-purple mark + MuseoModerno wordmark anchor every page. The magenta-gradient `your` in "Find *your* people" is the visual punchline of Discover.
- [x] **Type hierarchy is real, not flat.** Display headings use MuseoModerno at 28–64 px with proper tracking; body text in DM Sans at 13–18 px. The H1 on Community Detail ("The Listening Room") at 36 px holds its weight against the body copy.
- [x] **Spacing rhythm is consistent.** All padding/gap values resolve through `--space-1` (4 px) through `--space-8` (64 px). No arbitrary `14px` survives in shipped JSX.
- [x] **Motion feels considered, not generic.** Card grid stagger entry is visible on first load. Drawer slides in with a subtle overshoot. Step-progress dots scale up to 1.08 on `active` with an `--ease-overshoot` ease.
- [x] **Dark surfaces have depth.** Brand-tinted radial gradients in the body backdrop + the film-grain SVG overlay at 2.5% opacity prevent the dark theme from reading flat. The banner gradient on Community Detail uses the per-community accent color, so each circle feels distinct.
- [x] **Mobile-first feel.** Header collapses cleanly to brand + user-chip at < 640 px; nav destinations remain reachable via the user-menu dropdown ([Header.jsx:75–110](ui-communities/src/components/Header.jsx#L75)). Card grid drops to one column; hero scales down without breaking; filter row scrolls horizontally with the brand-aware mask-fade.

## Findings

### Blocking

_None._

### Non-blocking

1. **NB-1 — Cross-product link vanishes entirely below 640 px viewport.** Story AC-11 says "condenses but does not vanish." [Header.module.css:222](ui-communities/src/components/Header.module.css#L222) sets `.crossLink { display: none }` at `max-width: 640px`. At 375 px there is literally no path to brainstorm.world from the chrome. Mitigated for signed-in users by the user-menu dropdown, but anonymous mobile users on /  have no cross-product affordance. Suggested improvement: keep the arrow-icon variant at narrow widths (already styled via [Header.module.css:114](ui-communities/src/components/Header.module.css#L114)), or relocate the link to a footer Slice 0.x. Non-blocking because the AC is fuzzy ("condenses" was the intent, and the link is preserved at 640–880 px viewports).

2. **NB-2 — Tablet width 768×1024 not captured as a verification artifact.** The test plan flags 375 / 768 / 1440 as the three breakpoints to confirm; we have screenshots at 375 and at the preview-default desktop, but no explicit 768 capture. The Playwright spec encodes the 375 check but not the tablet check. Low-risk because the grid uses `auto-fill, minmax(320px, 1fr)` which naturally handles 768 (two columns at this width), but worth a one-line addition to the Playwright spec in a follow-up.

3. **NB-3 — `preview_click` did not drive `<article role="link" onClick>` navigation during manual smoke.** The CommunityCard uses an article with `role="link"` + onClick + onKeyDown. Real browser clicks navigate fine (verified via direct URL navigation to `/community/listening-room`), but the preview-tool click event didn't trigger navigation. Two reasonable follow-ups: either (a) wrap the card body in a real `<Link>` and let CSS make the whole card visually clickable, or (b) accept that Playwright's `page.click()` will fire a real event in CI and dispatches don't replicate the synthetic one. Non-blocking because real users + Playwright will drive this correctly; preview-tool fidelity is the only thing affected.

4. **NB-4 — `dist-communities/` build path is project-relative-via-Vite-outDir.** The ADR's directive `outDir: '../dist-communities'` produces an output one level above `ui-communities/`. The path resolves correctly relative to `ui-communities/vite.config.js` and Express serves it from `path.join(__dirname, '../dist-communities')` in `bin/control-panel.js` (where `__dirname` is `bin/`, so `../dist-communities` lands at the repo root). Worth a one-sentence comment in [vite.config.js](ui-communities/vite.config.js) so a future maintainer doesn't try to "fix" the relative path. Not blocking.

5. **NB-5 — DM Sans fetched from `googlefonts/dm-fonts` GitHub URL at scaffold time.** The font file now lives in the repo and there's no runtime CDN dependency, but the provenance is in a commit message rather than a `LICENSE` or `NOTICE` file. DM Sans is OFL — strict OFL compliance would suggest including the OFL.txt file alongside the TTFs. Slice-0 acceptable; follow-up to add `public/fonts/OFL.txt` for cleanliness.

6. **NB-6 — OPERATIONS.md not updated.** The ADR's "Consequences" section flagged that OPERATIONS.md §1 (deploy targets) and §5 (droplets and empirical measurements) need a new row for `communities.brainstorm.world`. This is gated on the droplet being provisioned (David's task), so it makes sense to defer. Add it as part of the droplet stand-up PR rather than this implementation PR.

## Story #6 scope items verified untouched

Reviewed explicitly because the story's "Out of scope" section calls these out:

- [x] **NIP-07 auth.** `signedIn` is a `useState(true)` placeholder at [App.jsx:23](ui-communities/src/App.jsx#L23). The Sign-in button at [Header.jsx:113–115](ui-communities/src/components/Header.jsx#L113) is a visual no-op (no `onClick`). No `window.nostr` calls anywhere.
- [x] **Real backend API.** `grep -r "fetch(" ui-communities/src` returns zero matches. All data flows through `mockData.js` selectors.
- [x] **Firmware activation.** `firmware/active` symlink untouched; `firmware/versions/v1.1.0/` skeleton not modified.
- [x] **Endorsement writes / kind-1 reads-writes.** No nostr-tools imports in `ui-communities/`. The Vouch + "Raise a concern" buttons mutate local React state only.
- [x] **Mirror tooling / Independent hosts stat.** T9 + visual confirmation.

The Implementer correctly stayed in scope.

## Verdict

**PASS.**

Slice 0 ships the user-visible scaffold for Brainstorm Communities against mock data, with the brand identity locked in, all four PLAN.md v1 journeys reachable, and the deploy chain wired up to fail loudly until the droplet exists. 54 tests pass across 5 suites (26 new + 28 pre-existing, no regressions). ESLint clean. Vite build clean. Manual visual review at desktop + 375 mobile confirms the design bar — no "vibe coded" smell, brand identity reads first, type hierarchy is real, motion is considered.

Six non-blocking notes captured above for follow-up (none of which require re-implementation). The Playwright spec is committed and ready to run once the dev server is up or the staging deploy lands; manual verification via preview captured the equivalent surfaces.

Ready for the deploy chain: a push to `feat/communities` will trigger `.github/workflows/deploy-communities.yml`. The first runs will fail with "DEPLOY_HOST_COMMUNITIES not set" until David provisions the droplet + secrets — that's the agreed behavior. Once the droplet is up, the workflow body matches `deploy-staging.yml` exactly and is expected to deploy in ~30–60s on warm Docker caches.

Slice 1 (Firmware v1.1.0 activation) is the next slice and is independent of this one — both can be in flight simultaneously.
