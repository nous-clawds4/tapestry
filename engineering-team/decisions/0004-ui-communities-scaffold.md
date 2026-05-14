# ADR 0004: `ui-communities/` Vite app — scaffold, mount, and brand-token layer for Slice 0

**Status:** Accepted
**Date:** 2026-05-14
**Story:** `engineering-team/stories/6-communities-ui-scaffold.md`

## Context

Story #6 calls for a polished, on-brand surface at `communities.brainstorm.world` that demonstrates all four PLAN.md v1 user journeys against mock data, with the locked Brainstorm brand palette (royal `#662d91`, magenta `#ba20ba`, marigold `#fbb03b`) and the bundled MuseoModerno wordmark. The story locks the placement decision at the **what** level — "a parallel app, not nested under `ui/`" — and leaves the **how** to this ADR.

Relevant facts from the existing codebase:

- **`ui/`** is a React 19 + Vite 7 + React Router 7 SPA. Builds to `../dist` (`ui/vite.config.js:7-10`). Express serves it via `express.static(../dist)` plus an `app.get('*')` SPA fallback to `dist/index.html` (`bin/control-panel.js:124-129`, `:266-270`). Dev server runs on `:5173` and proxies `/api → http://localhost:8080` (`ui/vite.config.js:11-19`).
- **`public/`** is the legacy JS-without-build admin surface — guarded by the CLAUDE.md "intentionally JS-without-build" house rule, served under `/control` and `/legacy` (`bin/control-panel.js:144-149`). Not relevant to this slice.
- **Dockerfile** has a clear "UI dependencies cached, build runs every deploy" pattern at `Dockerfile:84-85` and `:98`. Mirroring for `ui-communities/` is the established shape.
- **Deploy workflows** in `.github/workflows/` (4 of them — see OPERATIONS.md §3) follow the same SSH-action pattern: pull, fix-up `docker-compose.yml` port binding, `docker compose up -d --build`. Secrets named `DEPLOY_{HOST,USER,SSH_KEY}_<NAME>`.
- **One Express, one Docker stack per droplet.** OPERATIONS.md §1 confirms one droplet per long-lived branch. The `communities.brainstorm.world` droplet will run the same `feat/communities` codebase but serve a different `/` page than `brainstorm.world` does. Host-aware routing in Express is therefore needed — same code, different visible app.
- **No firmware concepts touched.** This slice operates entirely on mock data; the Concept Graph API doesn't need to be queried for this ADR. Slice 1 introduces `brainstorm-community` and `brainstorm-community-signal` and will resolve concept handles via `/api/concept-graph/summaries` at that point. **No firmware reinstall required for Slice 0.**

Constraints we must honor:

- **No new lint / typecheck infrastructure** beyond what `ui/` already has (CLAUDE.md house rule). ESLint config mirrors `ui/`. No TypeScript.
- **No CDN-loaded fonts** — MuseoModerno is bundled per Story #6 AC.
- **The brainstorm.world deploy must not regress.** Adding `ui-communities/` cannot break the existing `dist/` mount or the `/tapestry/*` routes already served by `ui/`.
- **The mirror-count UI stat stays hidden** (locked-decision deferral to v1.1). The data field stays in the mock dataset.

## Options considered

### Option A — Parallel `ui-communities/` Vite app, host-based Express routing (chosen)

1. **App tree:** new `ui-communities/` at the repo root, sibling to `ui/`. Independent `package.json`, `vite.config.js`, `eslint.config.js`. React 19 + Vite 7 + React Router 7 — same versions as `ui/` to avoid two parallel toolchains. Vite dev server on `:5174` (different port from `ui/`'s `:5173`) so both can run concurrently in dev. Vite proxy `/api → http://localhost:8080` mirrors `ui/`.
2. **Build output:** `ui-communities/` builds to `../dist-communities/` (sibling to `../dist/`). New directory; no collision with the existing `ui/` build. `dist-communities/` added to `.gitignore`.
3. **Express mount (host-based):** in `bin/control-panel.js`, register an additional `express.static(path.join(__dirname, '../dist-communities'))` middleware **gated by hostname**. The SPA catch-all at `:266` becomes host-aware:
   ```js
   const isCommunitiesHost = (req) =>
     req.hostname === 'communities.brainstorm.world' ||
     req.hostname === 'communities.localhost' ||
     req.hostname.startsWith('communities.');
   app.get('*', (req, res, next) => {
     if (req.path.startsWith('/api/')) return next();
     const dir = isCommunitiesHost(req) ? '../dist-communities' : '../dist';
     res.sendFile(path.join(__dirname, dir, 'index.html'));
   });
   ```
   The `express.static` call for `dist-communities/` is registered alongside the `dist/` one with a `setHeaders` hook checking the hostname; assets in `dist-communities/` have unique file names (Vite content-hashes them), so even if both static dirs are served, the right hashed bundle wins. **No host check on the static middleware** — only on the SPA fallback — keeps static asset serving fast and host-independent.
4. **Dockerfile:** add a parallel build step after the existing `ui/` build at `Dockerfile:98`:
   ```dockerfile
   COPY ui-communities/package.json ui-communities/package-lock.json /usr/local/lib/node_modules/brainstorm/ui-communities/
   RUN cd /usr/local/lib/node_modules/brainstorm/ui-communities && npm ci
   # ... after `COPY . ...`
   RUN cd /usr/local/lib/node_modules/brainstorm/ui-communities && npm run build
   ```
   Both `dist/` and `dist-communities/` end up in every deployed image. Which one users see is decided at request time by host.
5. **Deploy workflow:** new `.github/workflows/deploy-communities.yml` triggers on push to `feat/communities`. SSH-action body identical to `deploy-staging.yml` shape; secret names `DEPLOY_{HOST,USER,SSH_KEY}_COMMUNITIES`.
6. **Styling:** plain CSS with **CSS Modules** for component-scoped styles (Vite has zero-config CSS Module support — `Foo.module.css` files just work). One root `src/styles/tokens.css` declares the brand palette + spacing scale + type scale + motion easings as CSS custom properties on `:root`. One `src/styles/reset.css` is a modern CSS reset. `src/styles/fonts.css` declares `@font-face` for MuseoModerno + DM Sans, sourced from `public/fonts/`. **No CSS-in-JS, no Tailwind, no shadcn.** Reasons in "Decision" below.
7. **Brand assets vendoring:** copy the lockup + mark SVGs from `design-handoff/Brainstorm Logo/SVG/` into `ui-communities/src/assets/brand/` (`brainstorm-mark.svg`, `brainstorm-lockup.svg`). Copy the MuseoModerno variable-font TTFs from `design-handoff/Brainstorm Logo/Typographies/Principal/` into `ui-communities/public/fonts/`. DM Sans is self-hosted from a permissively-licensed copy (Open Font License) bundled into `public/fonts/` — **no Google Fonts CDN link**.
8. **Routes:** `createBrowserRouter` with `/` (Discover), `/community/:slug` (CommunityDetail), `/my-circles` (MyCircles), `/create` (CreateFlow), `/edit/:slug` (Edit), `*` (NotFound). Browser routing (not hash) — the prototype's `#/` routes are converted because Express's SPA catch-all already handles refresh on any path.
9. **Mock data:** a single `src/data/mockData.js` module exports `communities`, `members`, `tags`, plus pure helper functions (`getCommunity(slug)`, `getMember(id)`, etc.). The shape is designed to match what the eventual REST API will return (Slice 2), so Slice 3 swaps `import { communities } from './data/mockData'` for `const communities = await fetch('/api/communities').then(r => r.json())` and the consumers don't move. **No JSX in this file** — the prototype's `communities-data.jsx` mixed data and presentation; we separate them.
10. **Member drawer state survives navigation** via a `useDrawer` hook backed by `useState` in `App.jsx` (one source of truth at the root) plus context for child reads — no portals to `document.body`, just CSS `position: fixed`.

**Pros:**
- Smallest possible surface to the existing `ui/` build chain — zero edits to `ui/vite.config.js` or `ui/src/App.jsx`. The brainstorm.world experience is byte-for-byte unchanged.
- Host-based routing is the actual production semantics — `communities.brainstorm.world` and `brainstorm.world` literally are different sites that happen to share one codebase. Encoding that at the Express layer matches reality.
- Dev parity: `ui-communities/` is a normal Vite dev experience independent of `ui/`. Hot reload, no full Docker stack required.
- Component file structure is symmetric with `ui/src/` — same idioms a developer already learned from one app transfer to the other.

**Cons:**
- Two Vite toolchains to keep in sync on major bumps (Vite 7 → 8, React 19 → 20). Mitigated by the symmetric structure — bumps are mechanical, not invention.
- Slight Docker image size growth from carrying `dist-communities/` even on droplets that never serve it. Empirically `dist/` is ~1.5 MB gzipped; the cost is negligible.

### Option B — Mount `/communities/*` inside the existing `ui/` app

Add Communities routes inside `ui/src/App.jsx` under a `/communities/*` prefix. Reuse the existing `AuthProvider` / `TrustProvider` / `ConfigProvider` directly. One build, one dist.

**Pros:**
- Auth context comes for free (relevant in Slice 4).
- Single build chain.

**Cons (why rejected):**
- Couples the consumer-mobile-first social UX to a routing tree that already serves `/tapestry/*` admin pages. Every future change to either has to consider both.
- The brand identity for Communities is *sibling*, not *same* (PLAN.md §6 Q6) — the header, the visual chrome, the motion vocabulary are distinct. Forcing them into one tree means either a top-level "is this a communities route?" branch in the layout, or the Communities pages quietly inherit dashboard chrome. Both bad.
- The PLAN.md §8 deploy model is one-droplet-per-subdomain. Mounting under `ui/` fights that model and creates a confusing situation where pushing to `feat/communities` deploys a build that ALSO contains every admin route at `/tapestry/*`. Either we strip those routes at build time (complex) or we ship them and pretend they're not there (bad).
- The `feat/communities` deploy would have to make hard decisions about which routes the communities droplet exposes. Cleaner to have a separate build.

### Option C — Parallel `ui-communities/` app, but use shadcn/ui + Tailwind for the design system

Same scaffold as Option A, but pull in Tailwind + shadcn/ui for components.

**Pros:**
- Faster initial component velocity (Button, Dialog, etc., come pre-built).
- Tailwind utility classes are well-known.

**Cons (why rejected):**
- Story #6 explicitly demands "not a whiff of vibe coded app" — shadcn defaults are one of the strongest "vibe-coded" signals in modern web work. Achieving brand-specific polish on top of shadcn is more work than building scoped CSS Modules from a clean token system.
- Adds three new toolchain pieces (Tailwind, PostCSS, shadcn's component sync flow) where one (plain Vite CSS Modules) would do. Each is a future-bump tax.
- The CLAUDE.md house rule pushes against adding new lint/typecheck infrastructure without an ADR — Tailwind's class-checking is adjacent enough to that rule that it deserves its own ADR if we go there, and we don't want to spend that ADR yet.
- The brand palette is small (3 brand colors + a dark surface ramp); a token-based plain-CSS approach renders this directly with no abstraction tax.

## Decision

We chose **Option A**.

The parallel-app + host-based-routing model matches what `communities.brainstorm.world` *actually is* — a sibling product that shares a codebase. The cost over Option B is one extra `npm ci` + `npm run build` in CI (~30 s on the droplet's vCPUs, per Dockerfile comments) and one extra `dist-communities/` in the image. The benefit is clean visual identity, clean deployment, and a clean substrate for Slices 1–6 to extend without re-arguing the placement decision. The cost over Option C is doing the design-system work ourselves, which is the *point* of the "not vibe coded" bar — we want signature components, not stock ones.

We trade away: shadcn's component-library velocity. We accept that velocity will be slower in the first slice and faster in every subsequent one once the token system and primitives exist.

## Consequences

- **Enables:** A clean substrate for slices 1–6. Slice 3 just swaps the mock-data import for a `fetch`. Slice 4 wires in a `useAuth` hook (whose interface can borrow from `ui/src/context/AuthContext.jsx` even if implemented separately). Slice 5 reuses the Drawer and FormInput primitives. Slice 6 reuses the PostCard.
- **Constrains:** Every Slice 0 component decision (Button variants, spacing scale, motion presets) is the substrate everything else is built on. Get the token system right.
- **New debt:** Some hand auth-helper logic in Slice 4 may shadow `ui/src/context/AuthContext.jsx`. If the duplication is real and tempting to factor out, a later ADR can introduce a shared `lib/auth/` module both apps import from. **Don't pre-factor** — the right abstraction will be obvious after Slice 4, not before.
- **Firmware reinstall required?** **No.** Slice 0 touches zero concept definitions.
- **OPERATIONS.md update:** a new row needs to be added to OPERATIONS.md §1 (deploy targets) and §5 (droplets and empirical measurements) once the droplet is provisioned. Out of scope for this ADR; flagged for the Implementer to add at workflow-file landing time.

## Implementation notes

The Implementer reads this section. Be concrete.

### Directory layout (new)

```
ui-communities/
├── package.json
├── package-lock.json            (generated; committed)
├── vite.config.js
├── eslint.config.js
├── index.html
├── public/
│   ├── fonts/
│   │   ├── MuseoModerno-VariableFont_wght.ttf
│   │   ├── MuseoModerno-Italic-VariableFont_wght.ttf
│   │   ├── DMSans-VariableFont.ttf            (vendored from a permissive source)
│   │   └── DMSans-Italic-VariableFont.ttf
│   └── favicon.svg
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── styles/
    │   ├── tokens.css          ← brand palette, spacing, type scale, motion easings on :root
    │   ├── reset.css
    │   ├── fonts.css           ← @font-face for MuseoModerno + DM Sans
    │   └── globals.css         ← imports the above; sets body defaults
    ├── assets/brand/
    │   ├── brainstorm-mark.svg       ← mark only (compact)
    │   └── brainstorm-lockup.svg     ← mark + wordmark horizontal lockup
    ├── data/
    │   └── mockData.js
    ├── lib/
    │   ├── glossary.js         ← UX-vocab translation (export const GLOSSARY = { vouch: 'endorse', ... })
    │   └── format.js           ← getInitials(), formatCount(), etc.
    ├── components/
    │   ├── Header.jsx + Header.module.css
    │   ├── Button.jsx + Button.module.css
    │   ├── Avatar.jsx + Avatar.module.css
    │   ├── StackedAvatars.jsx + StackedAvatars.module.css
    │   ├── TrustDot.jsx + TrustDot.module.css
    │   ├── TagPill.jsx + TagPill.module.css
    │   ├── SearchBar.jsx + SearchBar.module.css
    │   ├── CommunityCard.jsx + CommunityCard.module.css
    │   ├── MemberRow.jsx + MemberRow.module.css
    │   ├── PostCard.jsx + PostCard.module.css
    │   ├── StepProgress.jsx + StepProgress.module.css
    │   ├── Drawer.jsx + Drawer.module.css
    │   ├── FormInput.jsx + FormInput.module.css
    │   ├── BrainstormMark.jsx       ← inline SVG component (color via currentColor)
    │   └── ViewCallout.jsx + ViewCallout.module.css   ← reusable "your view" callout for projection-pattern framing
    └── pages/
        ├── Discover.jsx + Discover.module.css
        ├── CommunityDetail.jsx + CommunityDetail.module.css
        ├── MyCircles.jsx + MyCircles.module.css
        ├── Create.jsx + Create.module.css
        ├── Edit.jsx + Edit.module.css
        ├── NotFound.jsx + NotFound.module.css
        └── MemberDrawerContent.jsx + MemberDrawerContent.module.css
```

### `ui-communities/package.json`

Mirror `ui/package.json` deps with `name: "ui-communities"`, scripts identical: `dev`, `build`, `lint`, `preview`. No new top-level deps in Slice 0.

### `ui-communities/vite.config.js`

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: { outDir: '../dist-communities', emptyOutDir: true },
  server: {
    port: 5174,
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } },
  },
})
```

### Express mount — `bin/control-panel.js`

After the existing `app.use(express.static(path.join(__dirname, '../dist'), ...))` at `:124`, add an analogous block for `dist-communities/`:

```js
app.use(express.static(path.join(__dirname, '../dist-communities'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) res.set('Content-Type', 'text/css');
    else if (filePath.endsWith('.js')) res.set('Content-Type', 'text/javascript');
  },
}));
```

Replace the SPA catch-all at `:266-270` with the host-aware version shown in Option A §3.

The host check helper lives inline at the top of the catch-all; no separate module. Document the recognized hostnames (`communities.brainstorm.world`, `communities.localhost`, `communities.*`) in a comment above the helper.

### Dockerfile changes

Insert after `Dockerfile:85` (the `ui` ci step):

```dockerfile
# Communities UI dependencies (cached until ui-communities/package.json changes)
COPY ui-communities/package.json ui-communities/package-lock.json /usr/local/lib/node_modules/brainstorm/ui-communities/
RUN cd /usr/local/lib/node_modules/brainstorm/ui-communities && npm ci
```

Insert after `Dockerfile:98` (the `ui` build step):

```dockerfile
# Communities UI build (~30-60s on 2 vCPUs)
RUN cd /usr/local/lib/node_modules/brainstorm/ui-communities && npm run build
```

### `.gitignore`

Add `dist-communities/` to the `.gitignore` alongside the existing `dist/` (which is also gitignored). Confirm by inspection — if `dist/` is *not* gitignored, do the inspection before adding (we don't want to add something inconsistent with the existing pattern).

### `.github/workflows/deploy-communities.yml`

Mirror `deploy-staging.yml` exactly, swapping branch `staging → feat/communities` and secret prefix `STAGING → COMMUNITIES`:

```yaml
name: Deploy to Communities
on:
  push:
    branches: [feat/communities]
jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        timeout-minutes: 60
        with:
          host: ${{ secrets.DEPLOY_HOST_COMMUNITIES }}
          username: ${{ secrets.DEPLOY_USER_COMMUNITIES }}
          key: ${{ secrets.DEPLOY_SSH_KEY_COMMUNITIES }}
          command_timeout: 25m
          script: |
            cd /opt/tapestry
            git checkout -- docker-compose.yml 2>/dev/null
            git checkout feat/communities 2>/dev/null || git checkout -b feat/communities origin/feat/communities
            git pull origin feat/communities
            sed -i 's/"80:80"/"127.0.0.1:8080:80"/' docker-compose.yml
            docker compose up -d --build
            docker image prune -f
```

The first push after this lands will fail loudly with "secret not configured" — this is desired; it surfaces the droplet-provisioning dependency to David.

### Design tokens (`src/styles/tokens.css`)

Exact values are locked. The Implementer translates the palette in `project_communities_brand.md` user memory into a real CSS file. The token set includes (at minimum):

- Brand: `--brand`, `--brand-soft`, `--accent`, `--accent-hover`, `--accent-glow`, `--accent-muted`, `--highlight`
- Surfaces: `--bg`, `--bg-surface`, `--bg-elevated`, `--bg-hover`, `--border`, `--border-hover`
- Text: `--text`, `--text-secondary`, `--text-muted`, `--text-faint`
- Status: `--success`, `--warning`, `--danger`
- Spacing: `--space-1` (4px) through `--space-8` (64px) — 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64
- Type scale: `--text-xs` (12) through `--text-display` (48), with line-heights
- Radii: `--radius-sm` / `--radius-md` / `--radius-lg` / `--radius-xl` / `--radius-full`
- Motion: `--ease-out-cubic`, `--ease-overshoot`, `--dur-fast` (120ms), `--dur-medium` (250ms), `--dur-slow` (450ms)
- Z-layers: `--z-header`, `--z-drawer`, `--z-modal`, `--z-toast`

Inline styles in components are **disallowed except for** truly dynamic values (e.g. a calculated width on a trust-bar). Default to a `module.css` rule.

### Motion specifics

- Card grid entry: a single `@keyframes fadeUp` (translateY 8 → 0, opacity 0 → 1) with `animation-delay: calc(var(--i) * 35ms)` set inline on each card (this is one of the legitimate dynamic-value cases).
- Drawer: slide-in from right with `cubic-bezier(0.16, 1, 0.3, 1)` (overshoot-style ease-out) over 250ms; backdrop fades over 150ms.
- Step progress: `transition: background var(--dur-medium) var(--ease-out-cubic), border-color var(--dur-medium) var(--ease-out-cubic)`.
- Buttons & cards: hover lift via `transform: translateY(-1px)` plus a subtle shadow change, 120ms ease-out.

### Header — logo treatment

`<Header>` renders the lockup `<BrainstormMark variant="lockup" />` SVG inlined so the fill color animates via `currentColor` between `var(--brand)` (default) and `var(--accent)` (hover). The "Communities" sub-brand label sits to the right of the mark in MuseoModerno medium weight at `var(--text-sm)`, separated by a 1px divider in `var(--border)`.

### NotFound page

Use the brand mark at 40% opacity as a subtle hero, body copy "We can't find that circle.", and a button linking to `/`. Reuse the `Button` primitive so the styling is consistent.

### Tweaks panel removal

The prototype's `tweaks-panel.jsx` and `design-canvas.jsx` are **not** ported. The three direction themes (ember/neon/moss) collapse to one — the brand-grounded dark theme defined in `tokens.css`. No runtime theme switcher visible in the production build.

### Glossary surface

`src/lib/glossary.js` exports:

```js
export const GLOSSARY = {
  vouch: { protocolTerm: 'endorse', signalType: 'endorse' },
  concern: { protocolTerm: 'veto', signalType: 'veto' },
  foundingVoice: { protocolTerm: 'seed' },
  trustedHere: { protocolTerm: 'community-GR-counted members' },
};
```

This is a Slice 0 stub. Slice 4 wires `signalType` into the actual event-publish path. Living here from day one means the protocol↔UX mapping is documented in code, not in head-canon.

## Out of scope

- **Auth wiring.** Slice 4.
- **Any real backend API call.** Slices 2 and 3.
- **A shared `lib/auth/` module between `ui/` and `ui-communities/`.** Don't pre-factor; revisit after Slice 4.
- **Storybook or a component playground.** Not in this ADR; future ADR if and when it becomes obvious we need one.
- **nginx config for the communities droplet.** OPERATIONS.md §1 implies the droplet sets up its own host nginx + Certbot; we ship the Docker stack the same way the other droplets do, and the droplet config is operator-owned.
- **OpenGraph / Twitter card metadata.** Functional `<title>` is sufficient for Slice 0.
- **Internationalization.** Slice 0 ships en-US strings; the `language` field in community records is a Slice 5 (Create flow) concern.
