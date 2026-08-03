# Start — add decentralized tagging to Brainstorm-UI (NosFabrica)

You are working in **Brainstorm-UI** (the NosFabrica web client deployed at brainstorm.world), a
pure-browser React/TypeScript Nostr client. Your job is to add support for **decentralized tags**
(the Tapestry/Brainstorm tagging protocol) using the self-contained kit in this folder.
Everything protocol-shaped is already written for you; your work is **integration**: wiring the
kit's SDK into this app's existing relay pool, signer, query caching, routing, and UI idioms.

**Read order — do not deviate:**

1. This file, top to bottom, through §2 (the interview). **Stop at the end of §2 and run the
   interview with the operator before writing any code.**
2. `core/INTEGRATION.md` — the target-agnostic build instructions: ground rules, mental model,
   the service-layer contract, the capability ladder (C0–C7), the verify-on-wire checklist, and
   the known traps. **Everything in it is binding here**; this file only specializes it (seam
   map §3, build plan §4, host idioms §5). Where this file names a concrete host module for one
   of the core's abstract seams, use it.
3. Back here for §3 onward.

Definition of done: `core/ACCEPTANCE.md` for every capability rung you build, **plus**
`ACCEPTANCE.md` (in this folder) for the floor chosen in the interview.

---

## 1. What's in the kit

| Path | What it is |
|---|---|
| `Start.md` | This file — the NosFabrica-specific overlay. |
| `CONFIG.json` | Deployment identity, filled in for this integration (Tapestry reference deployment: dcosl tag hub + tags.brainstorm.world house trust). **Read its `_comment` keys.** |
| `ACCEPTANCE.md` | The UI-coupled acceptance script for this app, organized by the floors in §2. |
| `core/` | The target-agnostic core: `INTEGRATION.md`, the generic `ACCEPTANCE.md`, `sdk/` (dependency-free ESM protocol code), `protocol/` (normative specs), `CONFIG.template.json` (superseded by this folder's `CONFIG.json`). |

## 2. The interview (run this FIRST, before any code)

Ask the operator (the developer who invoked you) the questions below, one at a time, in plain
language, with the recommended default stated. **Record the answers in a `DECISIONS.md` file in
this folder** (question → answer → date) so a later session can resume without re-asking. If the
operator says "take the defaults," record that and proceed.

**Q1 — Scope floor.** Which floor is the target for this pass? (Each floor includes the ones
above it; `ACCEPTANCE.md` has a section per floor.)

- **A — Read-only**: tag chips render on public profiles (and optionally notes) from relay data;
  no publishing. (Core rungs C0–C2.)
- **B — Self-tagging** *(recommended default — the anchor flow)*: A logged-in user can apply
  tags to **their own profile** from their profile page — picker, apply, dispute-toggle,
  create-new — and the chips render for everyone including anonymous visitors. (Adds C3–C5,
  scoped to `target = self`.)
- **C — Tagging others**: the same affordances on any profile, plus disputes on others' tags.
  (C3–C4 unscoped.)
- **D — Full surface**: C plus event(note)-tagging where notes render, and tag pages
  (`/tags/…`) via C6.

**Q2 — The existing role chips** ("Developer" etc. — self-declared roles stored in a NIP-78
kind-30078 prefs event, rendered on the public profile; see §3.4). How should they relate to
protocol tags?

- **Coexist** *(recommended default)*: keep the role chips as-is; protocol tag chips render in
  the adjacent reserved slot (§3.4). No data migration. Revisit once tags have traction.
- **Bridge on write**: when the owner saves roles in the customizer, ALSO publish matching
  protocol profile-tag self-assertions (roles become real tags others can dispute/corroborate).
  Roles remain the source for the role row; tags accrue on the protocol.
- **Migrate**: one-time owner-prompted conversion of existing roles to protocol self-tags, then
  render only protocol chips. (Most work; only choose deliberately.)

**Q3 — Trust POV.** Whose trust filters the counts?

- **Tapestry house POV** *(recommended default — `CONFIG.json` as shipped)*: the reference
  instance's NIP-85 kind-30382 corpus, read from `trustRelays`.
- **NosFabrica's own POV**: brainstorm_server already publishes its own kind-30382 trust
  assertions (the app's `VITE_NIP85_RELAY_URL` points at that relay). Because the kit's trust
  seam is config-shaped, switching is a **config edit, not a code change**: set
  `CONFIG.trustRelays` to the NosFabrica NIP-85 relay and `CONFIG.nip85AuthorPubkeys` to the
  pubkeys NosFabrica signs 30382s with (ask the operator for them; they are server-held
  assistant keys). If the operator wants this, get the values now and edit `CONFIG.json`
  before C0.

**Q4 — Tag-relay configurability.** The core wants the tag-relay list user-editable "where the
host keeps settings." This app has no user-facing relay settings; its runtime config is the
`window.__ENV__` / `docker-entrypoint.sh` pattern (§3.6).

- **Env key** *(recommended default)*: add `VITE_TAG_RELAY_URLS` (comma-separated) through the
  four registration points (§3.6), falling back to `CONFIG.json`'s `tagRelays`. Operator-
  configurable per deployment; no new UI.
- **Also user-editable**: additionally persist a user override in `localStorage` with a small
  editor (only if the operator asks; note where it would live and move on).

**Q5 — Picker vocabulary.** When a user opens the tag picker, what leads?

- **Search-everything with curated suggestions** *(recommended default)*: full client-side
  search over all existing protocol tags (core C3 discovery), with a curated starter row
  sourced from `client/src/config/` (seed it from the existing `ROLES` labels so the two
  vocabularies rhyme). Create-new appears when nothing matches (floor B+).
- **Curated only**: just the starter list. (Simplest; limits the protocol's point — confirm
  deliberately.)

If an answer changes scope mid-build, update `DECISIONS.md` — never silently.

## 3. Seam map — where the core's abstractions live in THIS codebase

Survey of the repo as of 2026-08-03. Verify each anchor before relying on it (line numbers
drift); if a named export/file has moved, find its successor — the *pattern* is the contract.

### 3.1 Stack you must match

React 18 function components + hooks; TypeScript `strict`; Vite (root = `client/`); Tailwind +
shadcn/ui (generated primitives in `client/src/components/ui/` — use, don't edit); TanStack
React Query v5 for ALL server/relay state; `wouter` for routing (routes declared in
`client/src/App.tsx`); **no i18n** (plain English strings); Vitest + Testing Library, tests
colocated as `*.test.tsx`. Commands: `npm run dev` (:5000), `npm run check` (tsc), `npm test`,
`npm run build`.

### 3.2 Relay access (the core's `relays` module)

The app talks to relays **directly from the browser** via a module-level singleton:
`client/src/services/nostr.ts` exports `{ pool, eventStore }` (bottom of file) —
`applesauce-relay`'s `RelayPool` + `applesauce-core`'s `EventStore`. **Reuse this pool** (core
rule: no second websocket pool).

- Generic one-shot read already exists: `fetchEventsByFilter(filter, relays, timeoutMs)` in
  `services/nostr.ts` (~line 1099) — arbitrary filter, dedupes by id, timeout-bounded. Build
  the core's `fetchTagEvents` / `fetchTrustEvents` on top of it (add the `latestByCoord`
  replaceable dedupe — by-id dedupe is NOT enough, see core §1.5).
- Relay constants `PROFILE_RELAYS` / `CONTENT_RELAYS` are hardcoded consts in `nostr.ts`
  (~line 449) with **trailing slashes on every URL** — normalize before unioning relay sets or
  you'll get duplicate connections.
- User relay lists (outbox): `loadOutboxRelayListFromDb(pubkey, PROFILE_RELAYS)`
  (`nostr.ts` ~line 690) resolves NIP-65 write relays. Core lane rule §1.4 maps to:
  reads = `tagRelays ∪ PROFILE_RELAYS`; writes = `tagRelays ∪ outbox(user)`.

### 3.3 Signing + publishing (the core's `sign` / `publish` modules)

- **The single signing chokepoint**: `signEventLocally()` (`services/nostr.ts` ~line 306) —
  NIP-07 `window.nostr.signEvent` with a local encrypted-key fallback. Wrap it for the SDK's
  `deps.sign(unsigned)` contract; never touch keys directly.
- **Publish**: `publishToRelays(signedEvent, relays)` (~line 1503) — returns
  `{success, accepted, total}`; success = ≥1 accept, exactly the core's contract. There is a
  safer private `signAndPublish` helper with a kind-tamper check — it is **not exported**;
  either export it (small, reasonable PR) or mirror the `services/socialActions.ts` pattern,
  which is the house model for build→sign→publish flows.
- Signer-presence gate used app-wide before offering any publish affordance:
  `!window.nostr && !hasLocalSecretKey()` → don't render the action. Copy it.
- **Trap**: `window.nostr` is typed by a local `declare global` in `nostr.ts` with only
  `getPublicKey`/`signEvent`. Don't re-declare it in your modules (TS `strict` conflict);
  import nothing type-wise for it, just use the existing declaration.

### 3.4 The profile page — your primary surface

Two profile pages exist; **they are not interchangeable**:

- `/p/:id` → `client/src/pages/SharePage.tsx` — the PUBLIC profile (anon-viewable). **All
  public-facing tag UI goes here.**
- `/profile/:npub` → `client/src/pages/ProfilePage.tsx` — a members-only analytics view behind
  `RequireAuth`. Not your surface.

Inside `SharePage.tsx` (~1365 lines, ~25 useQuery calls — expect merge friction, keep your
additions as extracted components under `client/src/components/share/`):

- **The reserved chip slot** (~line 913): a literal TODO comment — *"Tags — the team's
  WoT-ranked attribute chips … will render here … Deferred until tag data ships; for now the
  owner-set role chips below stand in."* **This is your insertion point.** Render the protocol
  tag-chip row here, styled to match the existing role-chip `<span>`s beside it.
- **The existing role chips** (interview Q2): self-declared roles from a NIP-78 kind-30078
  event (`d` = `brainstorm.world/profile-prefs`), vocabulary in
  `client/src/config/personalization.ts` (`ROLES`), fetched by `fetchProfilePrefs()`
  (`nostr.ts` ~line 798), queried under key `["share-prefs", pubkey]`, written by
  `publishProfilePrefs()` via the owner-only `components/share/ProfileCustomizer.tsx` drawer.
  If Q2 = bridge-on-write, `saveCustomize()` in SharePage (~line 161) is where the parallel
  protocol publish hooks in.
- **"Posts about" chips**: `components/share/TopicChips.tsx` (rendered ~line 935) — hashtag
  chips derived client-side from note `t` tags. The best visual/structural template for your
  tag-chip row (single-line truncation trick, `data-testid` conventions: `share-topics` /
  `share-topic-chip` — yours: `share-tags` / `share-tag-chip`).
- **Owner detection** (~line 131): `isOwner = currentUser?.pubkey === pubkey && (session ∥
  local key ∥ window.nostr)`. Floor B's "tag yourself" affordance gates on this; floors C+
  invert it (any signed-in viewer, any profile) — drop the pubkey equality, keep the
  signer-presence check.
- Profile id decoding: `decodeShareId()` in `client/src/lib/shareId.ts` (hex / npub / nprofile).

### 3.5 Where the core's service layer + SDK go

Match the app's established layering exactly:

| Core artifact | Place here |
|---|---|
| `sdk/` copy | `client/src/lib/tagging-sdk/` — `lib/` is the framework-agnostic zone. The SDK is plain ESM **JavaScript** with JSDoc; the project is `strict` TS with `noEmit`. Enable `allowJs` in `tsconfig.json` or add a thin `.d.ts` next to the copy — do **not** rewrite the SDK in TS. |
| `config` module | `client/src/config/tagging.ts` — imports `CONFIG.json` (commit it under `client/src/config/`), layers the Q4 env override. Static vocabularies (Q5 curated suggestions) also live in `config/`. |
| `relays` + `publish` + `sign` + `trust` modules | one `client/src/services/tags.ts` (split only if it grows past taste) — importing `{ pool, eventStore, fetchEventsByFilter, signEventLocally, publishToRelays, loadOutboxRelayListFromDb, getCurrentUser }` from `./nostr`, mirroring `services/socialActions.ts`'s shape. |
| React bindings | `client/src/hooks/useTags.ts` — React Query wrappers over the service, modeled on `hooks/useSocialActions.ts` (mutations with optimistic `queryClient.setQueryData`; the `mine` overlay from core §4 maps naturally onto optimistic updates). Query keys: follow the `["share-prefs", pubkey]` convention — e.g. `["profile-tags", pubkey]`, `["tag-elements"]`. |
| UI components | `client/src/components/share/` for profile surfaces; shadcn primitives from `components/ui/` (Popover/Command/Sheet are already generated — the tag picker wants Command). |
| New route (floor D) | `client/src/pages/TagPage.tsx` + a static import and `<Route>` in `App.tsx`'s `<Switch>` — **no lazy loading anywhere in this app; order matters in wouter** (specific paths first — see how `/p/:id/hops` precedes `/p/:id`). |
| Tests | colocated `*.test.tsx`; note `client/src/test/setup.ts` stubs `window.__ENV__` — any test importing `services/*` needs that setup (it's global via `vitest.config.ts`). |

### 3.6 Runtime config (interview Q4)

The app is a static nginx image configured at container start: `client/src/lib/runtimeEnv.ts`
reads `window.__ENV__` (populated by `docker-entrypoint.sh` sed-ing placeholders in
`client/public/config.js`), falling back to Vite build-time env. Adding an env key touches
**four places**: the `EnvKey` union + `env` object in `runtimeEnv.ts`, `public/config.js`, and
the substitution loop in `docker-entrypoint.sh`. Q4's `VITE_TAG_RELAY_URLS` goes through all
four; unset → `CONFIG.json.tagRelays`.

### 3.7 The backend is NOT involved

brainstorm_server (FastAPI; auth, WoT/GrapeRank scoring, search) plays **no role in v1
tagging** — kind-1984 reports and the kind-30078 prefs are the precedent: fully client-signed,
client-published, client-read. Do not add tagging endpoints to `services/api.ts`, and NEVER
route anonymous-viewable reads through `authenticatedFetch` (a 401 there wipes storage and
hard-redirects — this is a recorded institutional rule in `.agents/memory/anon-public-data-fetch.md`;
read that folder's other notes too). The public `/p/:id` page must render tags for logged-out
visitors from relays alone. (Future, out of scope: server-side WoT-weighted tag ranking to
fulfill the "WoT-ranked, colored-per-POV" vision in the SharePage TODO — that's the
`submitFollowList` pattern, relays remain source of truth.)

## 4. Build plan — capability rungs → this app's surfaces

Follow the core's ladder (`core/INTEGRATION.md` §5), specialized. Verify each rung with its
`core/ACCEPTANCE.md` section before climbing. Floors from Q1 tell you where to stop.

1. **C0** — `config/tagging.ts` + `services/tags.ts` + the SDK copy; smoke-test per core C0
   from the browser console on `npm run dev`. Zero tags returned = stop, debug connectivity.
2. **C1** — profile tag chips (read-only): `useTags` query → chip row component in the §3.4
   reserved slot on SharePage. Anon window must show them. *(Floor A stops after C2 — or here
   if the operator only wants profiles.)*
3. **C2** — (floors A/D, optional for B/C) note tag chips wherever SharePage renders the
   profile's notes — batched per core rule, one query per rendered chunk.
4. **C3 scoped to self** — floor B's anchor: owner-gated "Tag yourself" affordance near the
   chip row (or inside `ProfileCustomizer` alongside roles, per Q2) → picker (Command
   popover; Q5 vocabulary; content/profile applicability split per core C3) →
   `applyProfileTagging` → optimistic chip via `mine`. Plus Q2's bridge hook if chosen.
5. **C4** — stance toggle on own chips (apply ↔ dispute replaces, never duplicates); floor C
   extends C3+C4 to any profile/viewer.
6. **C5** — create-new-tag from the picker's empty state (floor B for self, C for others).
7. **C6** — floor D: `TagPage.tsx` (`/tags/:author/:slug`, accept naddr too if trivial) —
   people + notes tagged; every chip links to it.
8. **C7** — trust hardening + degraded modes per core; then run both acceptance docs.

Commit in reviewable slices (per rung is natural). `npm run check` + `npm test` clean at every
slice; don't break existing SharePage tests.

## 5. NosFabrica-specific traps (beyond core §7)

- `replit.md` is a **stale, self-contradicting** architecture doc (claims an Express backend
  that doesn't exist). `package.json` is named `rest-express` — vestigial. Never trust either;
  trust `client/src` and `.agents/memory/`.
- `attached_assets/` (~200 files, aliased `@assets`) contains orphaned stale copies of real
  components. Never read or edit anything there thinking it's live code.
- Path aliases are declared in **three** files (`vite.config.ts`, `vitest.config.ts`,
  `tsconfig.json`) — touch all three or none.
- `services/api.ts` has module-load side effects (localStorage cleanup) — importing it in tests
  without the global setup stub breaks; prefer importing only what you need from
  `services/nostr.ts` in the tagging service.
- shadcn `components/ui/*` are generated — compose, don't modify.
- The kit's `CONFIG.json` relay URLs have no trailing slashes; the app's consts do — normalize
  (see §3.2) when merging lanes.

## 6. Done means

The floor chosen in Q1 is fully built; `core/ACCEPTANCE.md` passes for every rung you built;
this folder's `ACCEPTANCE.md` passes through your floor's section; `npm run check`,
`npm test`, and `npm run build` are clean; the chips read like native SharePage UI (the
TopicChips row is your fidelity bar). Summarize what you built, the interview decisions
(pointer to `DECISIONS.md`), any deviations with reasons, and anything left flagged.
