# Relationship Primitives — Build Handoff

**Status:** 🔴 OPEN — feature **not started**. The book is scaffolded (unarmed); no story, ADR, tests, or code exist yet. Flip to ✅ ADDRESSED once the endpoints ship to all three instances.

**Created:** 2026-07-20, at the end of a long session that scoped this feature, then pivoted to a security fix (below) before building it. Written so a fresh session can pick it up cold.
**Builds on:** [`engineering-team/audits/relationship-primitives/book.md`](../engineering-team/audits/relationship-primitives/book.md) (the book of work, unarmed Direction-mode pre-registration); the intake entry **"2026-07-18 — Feature: primitive relationship add/delete endpoints (Neo4j-only, strfry-free)"** in [`engineering-team/stories/_intake.md`](../engineering-team/stories/_intake.md) (~line 1659) — its verified architectural background and open Planning questions are the real spec.
**Audience:** the next engineering session (you), plus the operator (David).

> **Why this doc exists.** The operator asked for two small, strfry-free endpoints to add/delete a Neo4j relationship between two pre-existing nodes — the first of a family of "second brain" graph-editing primitives (Neo4j is the *reference*; strfry is just an interchange format). We got as far as filing the intake entry and scaffolding the book, then discovered a live security exposure on the exact surface these endpoints target and fixed that first. That work is now done and deployed; this feature is unblocked and ready to build.

---

## The ready-to-paste prompt

Paste this into a fresh session (in the `tapestry` repo):

> I want to build the **relationship-primitives** feature — two simple, **strfry-free** endpoints to **add** and **delete** a relationship in Neo4j between two nodes that already exist in Neo4j. This was scoped in a prior session but not built. Before doing anything, read, in order:
> 1. `docs/RELATIONSHIP_PRIMITIVES_HANDOFF.md` (this handoff)
> 2. `engineering-team/audits/relationship-primitives/book.md` (the book of work)
> 3. The intake entry "2026-07-18 — Feature: primitive relationship add/delete endpoints (Neo4j-only, strfry-free)" in `engineering-team/stories/_intake.md` (~line 1659) — the real spec, with verified file:line background and the open Planning questions.
>
> Key context that changed since the book was written: the `/api/normalize/*` and `/api/neo4j/*` surface is now **default-deny for unauthenticated mutations** (security-auth-exposure stories 1 & 2 — ADRs `security-auth-exposure/0001` and `0002`, merged to staging/prod/feat/tags). So these new **write** endpoints will land on a **secured** surface — mount them under `/api/normalize` to inherit that auth (Planning question #1, which previously had *no* auth to inherit, is now resolved in favor of mounting there). **But the mount is not sufficient on its own:** default-deny only blocks *unauthenticated* callers — an authenticated non-owner still reaches an ungated `/api/normalize/*` mutation. Since these endpoints write to the reference graph, give **each** an explicit owner gate — route-level `requireOwner`, or the in-handler `isOwner(req) || req.localTrusted → 403` pattern now templated in `src/api/strfry/wipe.js`. Do **not** rely on the mount alone, or you reintroduce the authenticated-non-owner gap scoped in `_intake.md` (2026-07-21).
>
> Run it **human-gated** through the engineering harness: `/plan-feature` → `/design-architecture` → `/design-tests` → `/implement-feature` → `/review-changes`, then ship `staging → prod → feat/tags` (surgical cherry-pick of the source commit for prod + tags, as the security stories did). Use the local Docker stack at `http://localhost:7778` to verify end-to-end.
>
> *(Alternative: the book carries an unarmed Direction-mode pre-registration; if you'd rather run it autonomously, I'll arm it first — but re-read the pre-registration, since it predates the security work.)*

---

## The feature, in one paragraph

Today the only way to add/remove a single Neo4j relationship between two existing nodes is raw Cypher (`POST /api/neo4j/query`) — no validation, no idempotency contract, no structured result. Every `/api/normalize/*` route is *composite* (bakes in node-type assumptions, side effects, and strfry emission). **No single-edge DELETE exists anywhere.** This feature adds two clean primitives:

- **Add** — `{fromUuid, toUuid, relType}`; both nodes must already exist; `relType` from a whitelist; idempotent `MERGE`; response distinguishes *created* vs *already-existed*.
- **Delete** — same body; targeted single-edge delete; response distinguishes *deleted* vs *not-found*.
- **No strfry, no JSON regeneration, no derivation** — pure reference-graph edits.

## Design shape (from the intake entry — Architecture will firm it up)

- Relationship-type names are firmware-aliased, not literals (`REL.CLASS_THREAD_TERMINATION` → `HAS_ELEMENT`, etc.; `src/api/normalize/firmware.js:71-80`). The whitelist should resolve through that alias layer.
- Start the whitelist with `HAS_ELEMENT` + `IS_A_SUPERSET_OF`; the core-node wiring types (`IS_THE_CONCEPT_FOR`, `IS_THE_JSON_SCHEMA_FOR`, `IS_A_PROPERTY_OF`, …) can join as needed.
- Mount under `/api/normalize/*` for default-deny-on-unauth, **and add an explicit owner gate to each endpoint** — route-level `requireOwner`, or in-handler `isOwner(req) || req.localTrusted → 403` (templated in `src/api/strfry/wipe.js`). The mount alone only blocks *unauthenticated* callers; these graph-mutating writes must be owner-grade (owner session **or** loopback-local operator/cron), else they reintroduce the authenticated-non-owner gap (`_intake.md` 2026-07-21). Two routes vs one route with an action discriminator is an open question.

## Delegated Planning questions (open — resolve with the operator at Planning)

1. Route naming/mount point — `/api/normalize/*` (recommended; inherits default-deny for unauth — but still add an explicit owner gate per Design shape) vs a new namespace.
2. Initial `relType` whitelist membership.
3. Two routes (add + delete) vs one route with an action discriminator.
4. Endpoint-level validation strictness — enforce `Set`/`Superset` parent-label constraints, or allow any existing node pair?
5. Response shape + status codes for the idempotent cases (*already-existed*, *not-found*).
6. Test strategy for endpoints whose contract is a Neo4j side effect.

## Do NOT re-scope these (operator decisions already made)

- **Firmware-install interaction is documentation-only** for this book. Install pass 1d re-derives `HAS_ELEMENT` from `z` tags across *every* ConceptHeader with no already-explicit guard (`src/firmware/install.js:594-634`), while the redundancy prune runs *only* for concepts with a firmware `manifest.json` (`:758`,`:764`). So a firmware install can silently re-add a deleted edge or delete an added one. **Document this hazard; do not change install's behavior** (operator decision, 2026-07-18). Changing install is a separate epic.
- **Out of scope:** any strfry emission; a reconciler; publication-intent modeling; curator-assertion wire format; UI affordances; fixing the crashing `/elements/add-node` route; fixing the `publishToStrfry` silent-drop bug (its own intake entry, 2026-07-18).

## Why it stopped here (context, not a blocker)

Mid-setup — right before arming the book — we found that `GET /api/neo4j/run-query` was an unauthenticated, internet-reachable **RCE + credential leak**, and the whole `/api/normalize` + `/api/neo4j` write surface was reachable unauthenticated (the "localhost bypass" treated all nginx-proxied traffic as local). Building new *write* endpoints onto that open surface would have widened the hole, so we fixed the surface first:

- `run-query` removed (leak + RCE) — shipped to all three instances.
- **security-auth-exposure #1** — honest-local bypass + `neo4j/query` write-gate (ADR 0001).
- **security-auth-exposure #2** — default-deny for all unauthenticated mutations (ADR 0002).
- Neo4j password rotated on all three; ports-firewall companion tracked as OPEN.md #66.

Net effect for *this* feature: the surface is now secured, so the primitives inherit real auth by construction — exactly the sequencing we wanted.

## Baseline pointers

- Local stack: `http://localhost:7778` (concept-graph API; per AGENTS.md §1–§3).
- The composite write surface to mirror the style of: `src/api/normalize/index.js` (`handleAddToSet` at ~2991, `handleLinkConcepts`, the `REL.*` alias usage).
- Auth after the security work: `src/middleware/auth.js` — unauth mutations default-deny unless the path is allowlisted; loopback+no-proxy-header → `req.localTrusted`; owner session → allowed. New normalize routes are private-by-default (good).
