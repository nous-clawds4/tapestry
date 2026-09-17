# ADR 0003: Create-a-Tapestry — members-only authoring, owner-gated, with a signing selector

**Status:** Proposed
**Date:** 2026-07-24
**Story:** `engineering-team/stories/tapestries/3-create-tapestry.md`

## Context

Story `tapestries` #3 turns the inert `NewTapestry.jsx` placeholder (route `/tapestry/tapestries/new`)
into a working authoring page. It is a **members-only** slice: the owner sets title + description and
picks member concepts; we publish a real, explorable **kind-39999** tapestry element. Authoring the
cross-concept integrations *between* members is deferred (fast-follow). The approved ACs (quoted):

- **Owner-gated** — non-owner/admin visitors get no working create affordance on the directory or
  `/new`; the owner/admin does.
- **Compose** — Title (required) + Description (optional) + select **≥1** existing concept by name.
- **Publish shape** — submit publishes a kind-39999 element **z-tagged** `39998:<TA>:tapestry` whose
  `json` tag holds the `tapestry` block + a `graph` block with **one concept-header node and one
  `*-concept-graph` import per selected concept**.
- **Signing selector, owner-enforced** — "my own key" → NIP-07-signed (author = owner); "Tapestry
  Assistant" → server-signed as TA; a **TA-sign request from a non-owner session is server-refused**.
- **Round-trips** — on success the owner reaches the new Tapestry; it appears in the directory and
  renders on the Exploration page with members listed.
- **Validation & failure are visible** — no title / zero concepts blocks submit (nothing published);
  a signer/relay failure shows a clear error, no partial/duplicate tapestry.

**Environment.** The local Docker stack is **down** and its Neo4j/strfry graph is **empty**; the live
concept graph can't be exercised locally. v1 must be verifiable via the stack-free Node test runner +
`vite build` + mocked Playwright. `<TA>` is the runtime-resolved owner-assistant pubkey — **never
hardcoded** (CLAUDE.md); client reads it via `useConfig().taPubkey`.

**Verified facts (planning + this phase):**

- **Wire shape (ground truth):** the seed element `39999:<TA>:tapestry-for-dog-ca3b675e`
  (`tests/brainstorm/tapestry-exploration.spec.js` `ELEMENT_JSON`; directory z-tag in
  `tests/brainstorm/tapestries-nav-and-directory.spec.js:49`) is:
  `tags: [['d',dTag],['name',…],['z','39998:<TA>:tapestry'],['json', JSON.stringify({tapestry:{slug,title,description}, graph:{graphType:'tapestry', nodes:[{slug,uuid,name}], relationshipTypes, relationships, imports:[{slug,uuid}]}})]]`, `content:''`.
- **Concept-header shape** (`firmware/active/concepts/dog/concept-header.json`): a concept header
  carries `word.slug` = the **descriptive** slug (`concept-header-for-the-concept-of-dogs`) and
  `conceptHeader.oNames.singular` = the **display** name (`dog`). Its addressable event's **d-tag is
  the short slug** (`dog`), so its coordinate is `39998:<TA>:dog`. This is exactly the shape a seed
  tapestry node uses: `{slug:'concept-header-for-the-concept-of-dogs', uuid:'39998:<TA>:dog', name:'dog'}`.
- **Import convention:** the seed's imports are `39999:<TA>:<short-slug>-concept-graph` — runtime-
  *derived* addressable events (not static firmware). Resolution is by **uuid only**
  (`useTapestryGraph.js:19-24`); the import entry's `slug` is cosmetic.
- **Read-time composition** (`tapestryGraphModel.js`): `inferNodeType` types a node as `conceptHeader`
  purely by `uuid.startsWith('39998:')` (:33); `composeGraph` **dedups nodes by `slug`** (:56-68). So
  a node deduplicates with the same concept coming from a resolved import **iff their `slug`s match**.
- **Publish endpoint** (`src/api/strfry/commands/publishEvent.js`): `POST /api/strfry/publish {event,
  signAs}`. `signAs:'client'` = client already NIP-07-signed, permissionless; `signAs:'assistant'` =
  server re-signs `{kind,created_at,tags,content}` with the TA key, **gated to `isOwner(req) ||
  req.localTrusted`** (403 otherwise).
- **Client helpers:** `queryRelay` (`ui/src/api/relay.js`) → `/api/strfry/scan`; `publishEverywhere`
  (`nostrPublish.js:134`) and `publishOrThrow` (`publishProfileTag.js:24`) for local+external publish;
  `hasAdminAccess(user)` (`ui/src/utils/auth.js:6`); `useAuth()` (`user.classification`), `useConfig()`
  (`taPubkey`); `getActiveSignerOrThrow` (`signerGuard.js`).

## Options considered

### Decision 1 — Concept-picker data source

**Option A (chosen) — strfry scan of concept headers.** `queryRelay({kinds:[39998],
authors:[taPubkey]})`; per event derive `{ handle: 39998:<pubkey>:<d-tag>, shortSlug: <d-tag>,
descriptiveSlug: json.word.slug, name: json.conceptHeader.oNames.singular }`.
- Pros: one canonical read path (same strfry-first stance ADR `tapestries/0002` Decision 2 took —
  "never depend on Neo4j for tapestry data"); returns the `word.slug` we need for clean read-time
  dedup (Decision 2); no new backend.
- Cons: must parse the header's `json` tag; returns every kind-39998 (incl. meta-concepts like
  `tapestry` itself) — acceptable for a picker.

**Option B (rejected) — Neo4j `GET /api/concept-graph/summaries`.** Returns clean `{handle,name}`.
- Rejected: reintroduces the exact Neo4j dependency ADR `tapestries/0002` §F2 warns against (Neo4j has
  drifted from the signed events); and `summaries` does **not** expose `word.slug`, which Decision 2
  needs. A convenience endpoint isn't worth contradicting the epic's strfry-canonical precedent.

### Decision 2 — How a picked concept becomes graph `nodes` + `imports`

**Option A (chosen) — author the header node with its *descriptive* slug + a convention import; no
per-concept graph read.** For each selected concept:
- `nodes += { slug: descriptiveSlug (word.slug), uuid: handle, name }`
- `imports += { slug: 'concept-graph-for-' + shortSlug (cosmetic), uuid: '39999:<TA>:'+shortSlug+'-concept-graph' }`
- `relationshipTypes: []`, `relationships: []` (no cross-concept edges in v1).

Because the authored node's `slug` is the concept-header's `word.slug` — the **same** slug the derived
`*-concept-graph` uses for its header node — `composeGraph` dedups them at read time: each member
renders **exactly once**, and when the import resolves it contributes the superset + `IS_THE_CONCEPT_FOR`
spine (seed-shaped). When an import can't resolve (empty local graph / a concept with no derived graph),
the authored node still lists the member. Zero author-time graph reads.
- Pros: deterministic; robust to absent imports; no extra reads; produces seed-identical structure;
  fully unit-testable from the picker data alone.
- Cons: assumes a concept-graph's header-node slug equals its concept-header `word.slug` (a firmware-
  level invariant — both derive from the same concept-header). **Live-verification item** (below), since
  the local graph can't confirm it. If it ever diverged, that member would render twice.

**Option B (rejected) — read each concept's `*-concept-graph` at author time and copy its header +
superset nodes verbatim.** Immune to any slug divergence (copies the real slug).
- Rejected for v1: N author-time strfry reads for a benefit (immunity to a firmware-level invariant
  holding) that Option A already gets for free; locally every read falls back anyway (empty graph), so
  it buys nothing we can test. Keep as the fallback design if the invariant is ever shown to break.

**Option C (rejected) — nodes only, no imports.** No dedup risk at all.
- Rejected: contradicts AC "one `*-concept-graph` import per selected concept" and yields no spine.

### Decision 3 — Publish + signing selector

Only real path: reuse `POST /api/strfry/publish` (no new endpoint).
- **"My own key"** — build the unsigned event with `pubkey = user.pubkey`, `window.nostr.signEvent`,
  then `publishOrThrow(signed)` (local strfry + external co-publish, per the story). Guard the active
  signer with `getActiveSignerOrThrow(user.pubkey)` (issue #335 pattern).
- **"Tapestry Assistant"** (default) — build the unsigned **template** (`{kind,created_at,tags,content}`,
  no pubkey/sig) and `POST /api/strfry/publish {event, signAs:'assistant'}`. The server signs as TA and
  publishes to local strfry; the owner gate is enforced there (403 for non-owner). External co-publish
  for TA-signed events is **out of scope v1** (the directory reads local strfry).

### Decision 4 — Owner gating

- **UI (affordance):** gate the directory's "+ Create New Tapestry" button (`Index.jsx:90-92`) and the
  `/new` form behind `hasAdminAccess(user)` from `useAuth()`. Non-owners see an owner-only notice on
  `/new`, no working form.
- **Server (TA-sign):** already 403-gated in `publishEvent.js` — covered, not re-implemented.
- **Honest note:** client-signed publishing is **permissionless by design** (decentralized-first);
  there is no server "create-tapestry" write to gate for the own-key path. v1 gates the *curator
  affordance* in the UI; whether the *directory view* should be POV/WoT-filtered is a separate,
  already-deferred concern (epic `tapestries.md`). This is intentional, not a gap.

## Decision

Build the page on **Decision 1-A** (picker = strfry kind-39998 scan), **Decision 2-A** (author header
node with its descriptive slug + a convention import, no per-concept read), **Decision 3** (reuse
`/api/strfry/publish`, `signAs` selector, TA default), **Decision 4** (`hasAdminAccess` UI gate; server
TA-gate already present). No new backend, no new dependency, no firmware change, no change to the
shipped read-path model (`tapestryGraphModel.js` / `useTapestryGraph.js`).

## Consequences

- **Enables** the full create → publish → directory → explore loop, owner-curated, signable as the
  owner or the TA — producing tapestries structurally identical to the seed.
- **Constrains:** correctness of clean member rendering rests on the concept-header `word.slug` ==
  derived concept-graph header slug invariant (Decision 2-A). **Live-verification item for staging:**
  create a tapestry from real concepts and confirm each member appears once (no duplicate node) on the
  Exploration page. If it ever duplicates, switch that member to Option 2-B (read-and-copy) — a
  contained change to one builder function.
- **Debt / follow-ups (out of scope, noted):** cross-concept integration authoring; edit/delete;
  external co-publish for TA-signed tapestries; POV/WoT directory filtering; a uuid-based node identity
  in `composeGraph` (would make Decision 2 slug-agnostic) — only if the invariant proves insufficient.
- **Firmware reinstall required?** **No** — no concept definitions change.

## Implementation notes

Concrete module map (the Implementer builds these; **no test files** — those are Phase 3):

- **NEW `ui/src/pages/tapestries/tapestryDraft.mjs`** — pure, React-free (`.mjs` so the stack-free Node
  runner can `await import()` it and `vite` still bundles it):
  - `slugifyTitle(title)` → kebab slug (lowercase, non-alnum→`-`, trim).
  - `buildTapestryDraft({ title, description = '', members, taPubkey, dTagSuffix })` where
    `members = [{ handle, shortSlug, descriptiveSlug, name }]` → returns
    `{ dTag, uuid, tapestry, graph, unsignedEvent }`:
    - `dTag = 'tapestry-' + slugifyTitle(title) + '-' + dTagSuffix` (suffix injected for determinism in
      tests; the hook supplies a short random hex).
    - `uuid = '39999:' + taPubkey + ':' + dTag`.
    - `tapestry = { slug: slugifyTitle(title), title, description }`.
    - `graph = { graphType:'tapestry', nodes: members.map(m => ({ slug:m.descriptiveSlug, uuid:m.handle, name:m.name })), relationshipTypes:[], relationships:[], imports: members.map(m => ({ slug:'concept-graph-for-'+m.shortSlug, uuid:'39999:'+taPubkey+':'+m.shortSlug+'-concept-graph' })) }`.
    - `unsignedEvent = { kind:39999, created_at:<now>, content:'', tags:[['d',dTag],['name',title],['z','39998:'+taPubkey+':tapestry'],['json', JSON.stringify({ tapestry, graph })]] }` (created_at injectable for tests).
    - Throws on empty title or empty members (guards the wire shape independent of the UI).
- **NEW `ui/src/pages/tapestries/useCreateTapestry.js`** — React hook:
  - Loads picker options: `queryRelay({ kinds:[39998], authors:[taPubkey] })`, parse each event's
    `json` tag → `{ handle, shortSlug, descriptiveSlug: word.slug, name: conceptHeader.oNames.singular }`
    (fall back name→shortSlug, descriptiveSlug→'concept-header-for-'+shortSlug if a field is missing).
    Sort by name. Returns `{ concepts, conceptsLoading, conceptsError }`.
  - `create({ title, description, selectedHandles, signAs })`: map selected handles → member objects
    (from the loaded concepts), `buildTapestryDraft(...)`. If `signAs==='client'`: set
    `unsignedEvent.pubkey = user.pubkey`, `getActiveSignerOrThrow(user.pubkey)`,
    `signed = await window.nostr.signEvent(unsignedEvent)`, `await publishOrThrow(signed)`. If
    `signAs==='assistant'`: `POST /api/strfry/publish { event: unsignedEvent, signAs:'assistant' }`,
    throw on `!ok || !json.success` (surfacing the 403). Return `{ uuid }`.
- **REWRITE `ui/src/pages/tapestries/NewTapestry.jsx`** — container:
  - `const { user } = useAuth();` → if `!hasAdminAccess(user)`, render `<Breadcrumbs/>` + a clear
    owner-only notice (no form). Else the form: Title (required), Description (optional textarea), a
    **searchable multi-select** of `concepts` (text filter + checkbox list; selected chips), and a
    **signing selector** (radio: "Tapestry Assistant" [default] | "My own key"). Reuse `useConfig()`
    `taPubkey`, `useCreateTapestry`, `useNavigate`.
  - Submit: block if no title or zero selected (inline messages; nothing published). On success
    (`{ uuid }`) `navigate('/tapestry/tapestries/' + encodeURIComponent(uuid))`. On throw, show the
    error string; no navigation. Disable submit while creating.
  - The concept list is client-side filtered; empty `concepts` → an empty-state ("No concepts found on
    this instance") so the page never looks broken on an empty graph.
- **EDIT `ui/src/pages/tapestries/Index.jsx`** — wrap the "+ Create New Tapestry" button (`:90-92`) in
  `hasAdminAccess(user)` (add `useAuth`); non-owners simply don't see it.
- **Reuse, no new deps:** `Breadcrumbs`, `queryRelay`, `publishOrThrow`/`publishEverywhere`,
  `getActiveSignerOrThrow`, `hasAdminAccess`, `useAuth`, `useConfig`, `react-router` `useNavigate`.
  No vis-network/new packages; the picker is plain React.

**Testability guidance for Phase 3 (Tester decides mechanics).** The binding CI gate is the stack-free
`node test/test.js` runner (Playwright specs are `BRAINSTORM_SERVER_ACCESSIBLE`-gated and skipped in
stack-free CI). Recommended coverage:
- **Node unit suite** `test/create-tapestry.test.js` (registered in `test/test.js`, `async run()`): a
  dynamic `await import('../ui/src/pages/tapestries/tapestryDraft.mjs')`, asserting for both signing
  modes — kind 39999; z-tag `39998:<TA>:tapestry`; `d`-tag pattern `tapestry-<slug>-<suffix>`;
  `json.tapestry.{title,description}`; **one node and one import per member**; each node's `uuid` is the
  concept handle and `slug` is the descriptive slug (dedup-clean); `relationshipTypes`/`relationships`
  empty; empty-title / empty-members throw. Plus source-assertions on `NewTapestry.jsx` (owner gate via
  `hasAdminAccess`, both `signAs` branches, validation) and `Index.jsx` (gated button) — mirroring
  `test/admin-tools-dashboard-panel.test.js`.
- **Playwright** `tests/brainstorm/tapestry-create.spec.js` (mock `/api/strfry/scan`, `/api/strfry/
  publish`, `/api/assistant/pubkey`, `/api/auth/*`, `window.nostr`): owner sees the form / non-owner
  doesn't; validation blocks; submit posts the expected `signAs` + event; success navigates to the new
  uuid; a non-owner TA-sign attempt surfaces the 403 — mirroring `tapestry-exploration.spec.js`.

## Out of scope
- Cross-concept integration authoring (subsets/elements/enumerations between members); auto-derivation.
- Editing / deleting a tapestry; external co-publish for TA-signed tapestries.
- POV/WoT filtering of the directory; letting non-owners publish; transitive import expansion.
- Changing `composeGraph` to uuid-based node identity (future, only if Decision 2-A's invariant breaks).
