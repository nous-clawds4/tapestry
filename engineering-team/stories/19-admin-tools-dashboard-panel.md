# Story 19: Admin tools panel on the dashboard + fix Neo4j-Browser link bug

**Status:** Approved
**Created:** 2026-05-21
**Type:** Feature (UI surface + bug fix bundled)

## Background

Stories #13 + #15 + #17 + #18 collectively shipped the BullMQ task queue + BullBoard UI at `/admin/queues` (owner-or-admin gated). Today there is **no link to BullBoard from anywhere in the Tapestry UI** — operators have to know the URL by hand and type it directly. Same gap for the Neo4j Browser at `http://${DOMAIN_NAME}:7474/browser/preview/` — there *is* a link button, but it's broken: hardcoded to `http://localhost:8080/browser/preview/` (wrong port; wrong host). The button has presumably worked for local dev but never on staging or prod.

The operator's day-to-day pattern includes occasional dives into BullBoard (queue triage) and Neo4j Browser (graph inspection). Both are operator-tier tools — non-admin users have no business reaching either. They warrant a discoverable, environment-aware home in the dashboard's UI, gated to the operator audience.

A small companion piece: BullBoard's UI has a built-in `miscLinks` slot for cross-tool navigation. Today it's empty. Adding a "Tapestry Dashboard" link there closes the navigation loop — operators inside BullBoard can return to Tapestry without typing the URL.

## User-facing description

**As the owner or an admin** of a Tapestry node, **I want** a discoverable "Admin tools" panel on the dashboard with working links to BullBoard and Neo4j Browser, **and** a way back from BullBoard to the dashboard, **so that** I can navigate the operator-tier UI cluster (Tapestry + BullBoard + Neo4j Browser) without memorizing URLs — and so that the existing Neo4j Browser link button works on staging and prod, not just localhost.

**As a non-owner non-admin user** (signed in or signed out), **I want** the Admin tools panel to be invisible to me, **so that** I don't see UI affordances I can't use.

## Acceptance criteria

### Panel visibility (gating)

- [ ] Given a signed-in **owner** session, when the dashboard loads, then the "Admin tools" panel is visible.
- [ ] Given a signed-in pubkey that is in `BRAINSTORM_ADMIN_PUBKEYS`, when the dashboard loads, then the "Admin tools" panel is visible.
- [ ] Given a signed-in pubkey that is **neither** the owner nor in `BRAINSTORM_ADMIN_PUBKEYS`, when the dashboard loads, then the "Admin tools" panel is **NOT** visible.
- [ ] Given an **unauthenticated** visitor, when the dashboard loads, then the "Admin tools" panel is **NOT** visible.

### Panel contents

- [ ] The panel is labeled "Admin tools" with a recognizable icon/emoji at the operator's discretion (e.g., 🛠️).
- [ ] The panel contains a card/link to **BullBoard** at `/admin/queues/` (same-origin; relative URL is sufficient).
- [ ] The panel contains a card/link to **Neo4j Browser** at the environment-aware URL (e.g., `http://staging.brainstorm.world:7474/browser/preview/` on staging; `http://brainstorm.world:7474/browser/preview/` on prod; `http://localhost:7474/browser/preview/` on local). The URL value flows from the existing backend-provided `neo4jBrowserUrl` field (already in `/api/status`).
- [ ] Both cards/links open in a new tab/window (so the operator doesn't lose their place in Tapestry).

### Bug fix: existing Neo4j Browser button

- [ ] The "Open Neo4j Browser" button on the Neo4j Overview page (currently at `/tapestry/databases/neo4j`) no longer hardcodes `http://localhost:8080/browser/preview/`. It uses the same environment-aware `neo4jBrowserUrl` source as the new Admin tools panel.
- [ ] Verified on staging: clicking the button from `https://staging.brainstorm.world/tapestry/databases/neo4j` opens `http://staging.brainstorm.world:7474/browser/preview/` (not `localhost`).
- [ ] Verified on prod: same with `brainstorm.world`.

### BullBoard cross-link (companion)

- [ ] BullBoard's UI displays a "Tapestry Dashboard" link (or similar wording) in its `miscLinks` area.
- [ ] Clicking the link navigates the operator from BullBoard back to the Tapestry dashboard (`/` or `/tapestry/dashboard`, whichever is the canonical dashboard route).

### Placement on the dashboard

- [ ] The "Admin tools" panel appears in a visually coherent location on the dashboard — Architect's call exactly where, but the panel must be discoverable above the fold for most viewport sizes, NOT buried at the bottom.

### Quality

- [ ] No regression in any of the 15 npm test suites.
- [ ] No new lint/typecheck/build tooling.

## Concepts touched

- Tapestry dashboard UI (page at `/`)
- Neo4j Overview UI page (`/tapestry/databases/neo4j`)
- BullBoard mount + its `miscLinks` config
- Existing `/api/status` payload (already provides `neo4jBrowserUrl`)
- The session-auth surface that the UI consults to know whether the current user is owner-or-admin (Architect resolves which API/helper)

## Out of scope

- **A strfry landing-page link.** The strfry HTTP face is NIP-11 JSON for clients, not operator-facing. Skipped per the prior chat discussion. (A separate issue with the `/relay` browser landing page being unhelpful plaintext + the NIP-11 merge being incomplete has been captured in `_intake.md` for a future story.)
- **Sidebar / nav-menu entries for these tools.** Dashboard-only for now. If operators want left-nav entries later, that's a future refinement.
- **An "Admin tools" page** (separate route). The panel lives on the dashboard; no new page.
- **Read-only-for-admins or other tier distinctions** for BullBoard access. Story #18 already settled "owner-or-admin full parity"; this story is about discoverability + visibility, not access control.
- **Audit log of who clicked what link.** Logs are external-tool concerns, not Tapestry's.
- **Neo4j Browser bookmarks or queries** preconfigured by Tapestry. Out of scope — we just link to the tool's landing page.
- **Conditionally hiding the BullBoard card if `TASK_QUEUE_ENABLED=false`.** Per story #17 / ADR 0015, the default is now `=true` — the flag-off case is rare and not worth a special UI branch. If someone has it off, they'll click the BullBoard card and get a 404 from Express; that's an acceptable degradation for an admin-tier surface in the rollback state.
- **The "back to Tapestry" link in BullBoard's `miscLinks` being session-context-aware** (e.g., taking the operator to the page they came from). Just sends them to the dashboard root — simpler, sufficient.
- **Story-#18 follow-up auth-state work** (e.g., a `req.session.role` field) beyond what this story strictly needs. If the auth-state-for-UI mechanism turns out to want broader cleanup, that's a separate story.

## Open questions

Resolved at planning (2026-05-21):

- **Panel name** → **"Admin tools"** with operator's choice of icon.
- **Visibility for non-owner non-admin users** → **hidden entirely** (not greyed out or 403-on-click).
- **Visibility for unauthenticated visitors** → **hidden entirely**.
- **Scope of bug fix** → fix the existing Neo4j Browser button at `/tapestry/databases/neo4j` as part of this story (consumes the same environment-aware URL as the new panel).
- **strfry inclusion** → no.
- **Cross-link from BullBoard back to Tapestry** → yes, via BullBoard's existing `miscLinks` config.

Deferred to Architect:

- **Which API endpoint(s) tell the UI the user is owner-or-admin.** Today there's `/api/auth/status` and `/api/status` (and an existing `/api/owner/pubkey`). One of these likely already gives the UI enough info, or needs a small extension. Architect picks; if the existing surface is sufficient (e.g., compare session pubkey to the owner pubkey + run a `BRAINSTORM_ADMIN_PUBKEYS` membership check on the client), great — if a new endpoint or field is cleaner, that's a small addition.
- **Exact placement on the dashboard** — between which existing rows. The PO's preference (from the prior chat): between HealthRow and any below-the-fold sections. Architect confirms or proposes better.
- **Card visual style** — a separate small-card row, or inline with existing stat cards but visually distinct. Architect chooses to match existing dashboard idioms.
- **Whether to fold this into one ADR** or split. Three coordinated changes (panel, miscLinks, Neo4j bug fix) — PO sees them as one coherent feature; Architect's call whether the design space warrants an ADR.

## Linked artifacts

- ADR: [0017-admin-tools-dashboard-panel.md](../decisions/0017-admin-tools-dashboard-panel.md)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
