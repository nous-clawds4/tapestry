# ADR 0017: Admin tools panel on the dashboard via `useAuth`/`useConfig`; consume `/api/status:neo4jBrowserUrl` everywhere

**Status:** Accepted
**Date:** 2026-05-21
**Story:** `engineering-team/stories/19-admin-tools-dashboard-panel.md`

## Context

Story #19 bundles three coordinated changes:
1. A new "Admin tools" panel on the Tapestry dashboard, visible only to owner-or-admin sessions, containing cards/links to BullBoard and Neo4j Browser.
2. A bug fix to the existing "Open Neo4j Browser" button at `/tapestry/databases/neo4j` (hardcoded `http://localhost:8080/browser/preview/`) so it uses the environment-aware URL the backend already exposes.
3. A `miscLinks` entry in BullBoard's mount config so operators can navigate back from BullBoard to the Tapestry dashboard.

### Grounded facts after reading source

- **UI auth state is fully available**: [`ui/src/context/AuthContext.jsx`](../../ui/src/context/AuthContext.jsx) exposes `useAuth()` which returns `{ user: { pubkey, classification, profile } }`. The `classification` field is one of `'owner' | 'admin' | 'guest' | …` (resolved via `/api/auth/user-classification`).
- **Established idiom for "is operator-tier"**: three current sites use the same shape ([`Layout.jsx:137`](../../ui/src/components/Layout.jsx#L137), [`BrainstormUserMenu.jsx:80`](../../ui/src/components/BrainstormUserMenu.jsx#L80), [`Dashboard.jsx:58`](../../ui/src/pages/Dashboard.jsx#L58)):
  ```js
  user?.classification === 'owner' || user?.classification === 'admin'
  ```
  No new API endpoint needed. The story #18 backend gate (`requireOwnerOrAdmin`) and this UI gate consult the same underlying `BRAINSTORM_ADMIN_PUBKEYS` source-of-truth via different paths (server middleware vs `/api/auth/user-classification`).
- **`neo4jBrowserUrl` is in `/api/status`** at [`src/api/status/queries/system.js:19`](../../src/api/status/queries/system.js#L19), computed from `BRAINSTORM_NEO4J_BROWSER_URL` in `/etc/brainstorm.conf` (template-rendered per story #16 as `http://${DOMAIN_NAME}:7474`). The UI does not currently consume this field; both the new panel and the existing Neo4j Overview button need it.
- **`useConfig()`** at [`ConfigContext.jsx`](../../ui/src/context/ConfigContext.jsx) is the existing UI surface for app-wide config. Currently fetches three endpoints in parallel at mount (`/api/assistant/pubkey`, `/api/owner/pubkey`, `/api/relays`). Natural place to add a fourth small fetch for `/api/status`.
- **Dashboard layout** at [`Dashboard.jsx`](../../ui/src/pages/Dashboard.jsx) is a top-to-bottom sequence: `WelcomeCard`, `OnboardingChecklist`, `StatsRow`, `HealthRow`, `ConstraintsCheck`, `RecentActivity`. The story's preferred placement (between HealthRow and below-the-fold sections) maps to "after HealthRow, before ConstraintsCheck."
- **BullBoard mount** at [`bullBoardMount.js:42-49`](../../src/manage/taskQueue/queue/bullBoardMount.js#L42) already has `miscLinks: []` as the customization slot — empty today. BullBoard renders entries as clickable links in its header.
- **Tapestry Dashboard URL** is `/tapestry` (index route under the Layout at [`App.jsx:104-108`](../../ui/src/App.jsx#L104)). The miscLinks back-pointer goes there.

### Concept-graph impact

None. No new concepts, no schema, no firmware reinstall.

## Options considered

### Option A — `useConfig` consumes `/api/status` + new `AdminToolsPanel` component (chosen)

**Architecture:**
- Extend [`ConfigContext.jsx`](../../ui/src/context/ConfigContext.jsx) to fetch `/api/status` in parallel with the existing three endpoints. Expose `neo4jBrowserUrl` (plucked from the response) alongside the current `taPubkey`/`ownerPubkey`/`aRelays`.
- New component `<AdminToolsPanel />` in [`Dashboard.jsx`](../../ui/src/pages/Dashboard.jsx) (same file; matches existing pattern of component-per-section). Renders only when `(user?.classification === 'owner' || user?.classification === 'admin')` AND `neo4jBrowserUrl` is available from useConfig.
- Inserted in `Dashboard.jsx`'s top-level JSX between HealthRow and ConstraintsCheck.
- Visual style: one `.dashboard-card` wrapper with a heading `🛠️ Admin tools`, containing two link-buttons (BullBoard → `/admin/queues/`, Neo4j Browser → `useConfig().neo4jBrowserUrl + '/browser/preview/'`). Both `target="_blank"` with `rel="noopener noreferrer"`.
- Edit `Neo4jOverview.jsx` lines 84-104 to consume `useConfig().neo4jBrowserUrl` and append `/browser/preview/`, instead of hardcoding.
- Edit `bullBoardMount.js:42-49`'s `miscLinks` to `[{ text: '← Tapestry Dashboard', url: '/tapestry' }]`.

**Pros**
- **Reuses every existing idiom.** Auth check matches three other sites; useConfig matches the existing "app-wide config from small fetches" pattern; one component-per-section matches Dashboard.jsx's structure.
- **No new API endpoints.** `/api/status` and `/api/auth/user-classification` already exist.
- **Both Neo4j-URL consumers (new panel + existing button) flow through the same useConfig source.** Future Neo4j-URL changes happen in one place; no drift risk.
- **Auth check is purely client-side.** No round-trip on render. The classification was resolved at sign-in.
- **Panel visibility decision is component-internal.** No conditional Routes/routing logic; React renders `null` when the gate doesn't pass.
- **BullBoard miscLinks change is a one-line config diff.**

**Cons**
- ConfigContext gains a 4th fetch. Trivially small; same shape as the existing three.
- Client-side auth gate means the panel briefly doesn't render until `/api/auth/status` completes. Acceptable — same loading-flash exists today for `Layout.jsx`'s `isOwner` check; matches the established pattern.
- Useful URL state is split between AuthContext (`user`) and ConfigContext (`neo4jBrowserUrl`). The Architect could unify these but that's a larger refactor; not warranted here.

### Option B — Server-side rendered `<AdminTools />` (rejected)

Have the backend render the panel HTML (or its visibility decision) into the SPA shell before serving. Removes the brief loading-flash.

**Cons**
- Tapestry's UI is a Vite-built SPA served as static assets. Server-rendered HTML insertion would require a new templating step in the Express layer — significant complexity for a tiny UX improvement.
- Doesn't match any existing pattern in the codebase.
- Rejected.

### Option C — New dedicated `/api/dashboard/admin-tools` endpoint (rejected)

Backend computes the URL list + visibility flag together; UI consumes one tailored endpoint.

**Cons**
- Splits the source-of-truth for `neo4jBrowserUrl` between `/api/status` and the new endpoint. Drift hazard.
- The existing `useAuth()` + `useConfig()` already give us what we need. No need for new endpoints.
- Rejected.

### Option D — Inline fetch in `<AdminToolsPanel />` and `<Neo4jOverview />` (rejected)

Skip the ConfigContext extension; have each consumer fetch `/api/status` directly.

**Cons**
- Two fetches for the same value; duplicated wiring.
- The existing ConfigContext exists precisely to centralize this kind of "small config fetched once at app start" — bypassing it forks the pattern.
- Rejected.

## Decision

**Chosen: Option A.** Extend `useConfig` to consume `/api/status:neo4jBrowserUrl`; add `<AdminToolsPanel />` to Dashboard.jsx; fix Neo4j Overview button to read from `useConfig`; add `miscLinks` entry in `bullBoardMount.js`.

The decision is heavily constrained by precedent — every part of the design has an existing in-codebase template. The "design" is mostly choosing which slots to extend.

What we trade away: a small amount of "one less fetch at app start." Acceptable — the existing useConfig already does three parallel fetches; one more is unnoticeable.

## Consequences

**Enabled**
- Discoverable BullBoard + Neo4j Browser links on the dashboard for operator-tier users.
- Neo4j Browser button at `/tapestry/databases/neo4j` now works on staging/prod (consumed from environment-aware `neo4jBrowserUrl`, not hardcoded localhost).
- BullBoard operators can navigate back to Tapestry without typing the URL.
- `useConfig()` becomes the canonical UI source for `neo4jBrowserUrl` (and any future cross-tool URL fields from `/api/status`).

**Constrained / made harder**
- Adding a new external-tool card requires touching `<AdminToolsPanel />` + (if it needs a new URL field) extending `useConfig`. Slightly more ceremony than hardcoding, but the point of this story.
- The brief "panel doesn't render until auth resolves" flash on initial page load is the same UX pattern as Layout.jsx's owner-gated nav items. Operators are used to it.

**Follow-up debt (out of scope here)**
- Sidebar / nav-menu entries for admin tools (deferred).
- Audit-log / activity-tracking on these links (not in scope).
- Unifying `useAuth` and `useConfig` into a single context (large refactor; not warranted by story #19 alone).
- The `/relay` browser landing page UX bug captured in `_intake.md` — separate future story.

**Firmware reinstall required?** No.

## Implementation notes

The Implementer reads this section verbatim. Total diff: **3 modified files, 0 new files, ~50-70 lines net.**

### 1. `ui/src/context/ConfigContext.jsx`

Extend the existing context to fetch `/api/status` in parallel with the current three endpoints, plucking `neo4jBrowserUrl`:

```js
export function ConfigProvider({ children }) {
  const [taPubkey, setTaPubkey] = useState(null);
  const [ownerPubkey, setOwnerPubkey] = useState(null);
  const [aRelays, setARelays] = useState(null);
  const [neo4jBrowserUrl, setNeo4jBrowserUrl] = useState(null);

  useEffect(() => {
    fetch('/api/assistant/pubkey')
      .then(r => r.json())
      .then(d => { if (d.success) setTaPubkey(d.pubkey); })
      .catch(() => {});

    fetch('/api/owner/pubkey')
      .then(r => r.json())
      .then(d => { if (d.success) setOwnerPubkey(d.pubkey); })
      .catch(() => {});

    fetch('/api/relays')
      .then(r => r.json())
      .then(d => { if (d.success) setARelays(d.aRelays); })
      .catch(() => {});

    fetch('/api/status')
      .then(r => r.json())
      .then(d => { if (d.neo4jBrowserUrl) setNeo4jBrowserUrl(d.neo4jBrowserUrl); })
      .catch(() => {});
  }, []);

  return (
    <ConfigContext.Provider value={{ taPubkey, ownerPubkey, aRelays, neo4jBrowserUrl }}>
      {children}
    </ConfigContext.Provider>
  );
}
```

### 2. `ui/src/pages/Dashboard.jsx`

Add a new component `AdminToolsPanel` adjacent to the existing section components (next to `HealthRow`, `ConstraintsCheck`, etc.):

```jsx
function AdminToolsPanel() {
  const { user } = useAuth();
  const { neo4jBrowserUrl } = useConfig();

  const isOperator = user?.classification === 'owner' || user?.classification === 'admin';
  if (!isOperator) return null;
  if (!neo4jBrowserUrl) return null; // wait for config to load

  const tools = [
    {
      label: 'Task Queue (BullBoard)',
      description: 'View, retry, pause, or remove queued tasks.',
      href: '/admin/queues/',
      emoji: '⚙️',
    },
    {
      label: 'Neo4j Browser',
      description: 'Direct access to the knowledge graph database.',
      href: `${neo4jBrowserUrl}/browser/preview/`,
      emoji: '🗄️',
    },
  ];

  return (
    <div className="dashboard-card">
      <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>🛠️ Admin tools</h3>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {tools.map(t => (
          <a
            key={t.label}
            href={t.href}
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            title={t.description}
          >
            <span style={{ fontSize: '1.1rem' }}>{t.emoji}</span>
            <span>{t.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
```

Then insert `<AdminToolsPanel />` in the Dashboard's main return JSX, **between `<HealthRow />` and `<ConstraintsCheck />`**.

### 3. `ui/src/pages/databases/Neo4jOverview.jsx` (lines 84-104)

Replace the hardcoded URL with a reference to `useConfig().neo4jBrowserUrl`:

```jsx
import { useConfig } from '../../context/ConfigContext';

// inside the component:
const { neo4jBrowserUrl } = useConfig();
const browserHref = neo4jBrowserUrl ? `${neo4jBrowserUrl}/browser/preview/` : null;

// In the JSX, replace href="http://localhost:8080/browser/preview/" with:
<a
  href={browserHref || '#'}
  target="_blank"
  rel="noopener noreferrer"
  style={{ /* …existing styles… */ opacity: browserHref ? 1 : 0.5 }}
  onClick={browserHref ? undefined : e => e.preventDefault()}
>
  🔗 Open Neo4j Browser
</a>
```

(The disabled-during-loading fallback is belt-and-suspenders; the button is non-blocking anyway.)

### 4. `src/manage/taskQueue/queue/bullBoardMount.js`

Change `miscLinks` from `[]` to a single entry:

```js
options: {
  uiConfig: {
    boardTitle: 'Tapestry Task Queue — Owner + Admin',
    boardLogo: { path: '' },
    miscLinks: [
      { text: '← Tapestry Dashboard', url: '/tapestry' }
    ]
  }
}
```

The arrow glyph (`←`) gives it visual hierarchy as a navigation control. URL is `/tapestry` (the canonical dashboard route).

### 5. No backend changes beyond miscLinks

`/api/status` already exposes `neo4jBrowserUrl`. `/api/auth/user-classification` already exposes the role. Nothing else needed.

### Tests (Tester drives in Phase 3)

The Tester writes source-sentinel tests at `test/admin-tools-dashboard-panel.test.js`. Coverage:

- **T1**: `ui/src/pages/Dashboard.jsx` contains a function declaration matching `function AdminToolsPanel` (component exists).
- **T2**: `AdminToolsPanel` references `useAuth` AND the owner-or-admin classification check (regex over the component body, similar to story #18's T2 isAdminPubkey check).
- **T3**: `AdminToolsPanel` references `useConfig` and `neo4jBrowserUrl` (proves env-aware URL plumbing).
- **T4**: `AdminToolsPanel` references both `/admin/queues/` (BullBoard) AND `browser/preview` (Neo4j Browser) — the two cards' URLs.
- **T5**: `ui/src/context/ConfigContext.jsx` fetches `/api/status` and exposes `neo4jBrowserUrl` from the context provider value.
- **T6**: `ui/src/pages/databases/Neo4jOverview.jsx` no longer hardcodes `localhost:8080` AND references `useConfig` (proves the bug fix).
- **T7**: `src/manage/taskQueue/queue/bullBoardMount.js` `miscLinks` array contains an entry referencing `/tapestry` (proves the back-link).
- **R1** (regression): `ui/src/context/ConfigContext.jsx` still exposes `taPubkey`, `ownerPubkey`, `aRelays` — the existing three fields are NOT dropped during the extension.
- **R2** (regression): Story #18's `requireOwnerOrAdmin` middleware still exists at `src/api/admin/index.js` (the underlying server gate). Privilege-escalation guardrail T7 in `test/bullboard-admin-access.test.js` also passes (admin-management endpoints still owner-only).

The auth-on-the-client check (`user.classification === 'owner' || === 'admin'`) is a defense-in-depth UI affordance, NOT the actual access control. Real access control still happens at the server middleware (story #18). The Tester does NOT need to write a test exercising "non-admin user sees the panel anyway" because (a) the source sentinel verifies the client-side gate, and (b) the server-side gate (story #18 T7) still bounces them at `/admin/queues`.

### Smoke

Cycle-local (Reviewer):
- Restart brainstorm via supervisorctl + load Tapestry in browser as the owner pubkey. Verify the "Admin tools" panel appears between HealthRow and ConstraintsCheck (or wherever ConstraintsCheck would be if it weren't hidden by "all good" status).
- Click BullBoard card → opens new tab → BullBoard UI loads (this was already working post-#18; the test is that the link works).
- Click Neo4j Browser card → opens `http://localhost:7474/browser/preview/` in a new tab (locally).
- Visit `/admin/queues/` directly; verify the "← Tapestry Dashboard" link appears in BullBoard's header. Click → lands on `/tapestry` (the dashboard).
- (Auth-gate spot check) Sign out → reload dashboard → panel is absent. Sign in as a non-owner non-admin pubkey (if available) → panel still absent.

Cycle-staging (Operator):
- Sign in as the owner pubkey at `https://staging.brainstorm.world/tapestry`. Confirm the panel appears with both cards.
- Click Neo4j Browser → opens `http://staging.brainstorm.world:7474/browser/preview/` (NOT localhost — this is the bug-fix's acid test).
- (Optional) Sign in as a non-owner admin pubkey if a test account is available → panel still visible.

### Concept handle

None.

## Out of scope

- **Strfry landing page link.** Deferred per story #19; captured in `_intake.md`.
- **Hide BullBoard card when `TASK_QUEUE_ENABLED=false`.** Per story #19 §Out of scope, the card linking to a 404 in the rare rollback state is acceptable.
- **Sidebar / nav-menu entries.** Dashboard-only for now.
- **Multi-tool admin sub-page** at `/tapestry/admin-tools` (separate route). The story is a dashboard panel; no new route.
- **`useAuth` ↔ `useConfig` unification.** Larger refactor; not warranted by this story.
- **Audit log of who clicked what.** Out of scope.
