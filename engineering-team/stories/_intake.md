# Intake Log

Append-only log of incoming requests, raw, with classification and chosen phase path.

---

## 2026-05-14 — Feature: Brainstorm Communities — Slice 0 (UI scaffold)

**Raw request (verbatim):**

> build out brainstorm communities. […] feat/communities branch is my playground that the repo owner (David Strayhorn) has created for me. Anything I push to that branch will show up on communities.brainstorm.world (he said there's a CI/CD pipeline that handles the deployment automatically). I have some handoff files - basically wireframes from claude design I can share with you to use as a starting point […] the look and feel of the UI needs to be top notch and modern - not a whiff of vibe coded app should be in there, so in that sense, use the wireframes as a starting point in the visual design.

**Pre-intake context captured:**

- Feature is sliced into 7 phases — see [`PLAN.md`](../../PLAN.md) §6/§8 and the locked decisions in user memory (`project_communities_v1_decisions.md`):
  - **Slice 0** — `ui-communities/` scaffold + Neon-grounded brand palette + mock-data parity with handoff + `deploy-communities.yml` + Express mount **(this story)**
  - Slice 1 — Firmware v1.1.0 activation (`brainstorm-community`, `brainstorm-community-signal`)
  - Slice 2 — GR-Community scoring + REST API
  - Slice 3 — Discover (read-only)
  - Slice 4 — Detail + Join + Vouch (first write surface)
  - Slice 5 — Found (5-step wizard)
  - Slice 6 — Participate (kind-1 read/write gated on membership)
- Design handoff at `design-handoff/project/` (HTML prototype + JSX components). Brand kit at `design-handoff/Brainstorm Logo/` (SVG/PNG, MuseoModerno variable fonts).
- Locked palette (sampled from official PNGs, not the prototype's generic lavender): brand `#662d91`, accent `#ba20ba`, highlight `#fbb03b`. See `project_communities_brand.md` in user memory.
- Code placement decision: new parallel `ui-communities/` Vite app, sibling to the existing `ui/`. Builds to its own dist; Express serves it for the `communities.brainstorm.world` subdomain.
- Engineering-team harness applies per slice. User has granted blanket inter-phase approval for Slice 0 ("just get going on the plan and keep going").

**Classification:** Feature
**Strictness:** Standard
**Phase path:** Planning → Architecture → Test Design → Implementation → Review (all five phases apply per Standard / Feature). Slice 0 stops short of any protocol writes; Slice 1+ pick those up.

---

## 2026-05-14 — Feature: Brainstorm Communities — Slice 1 (firmware v1.1.0 finalization)

**Raw request (verbatim):**

> great. on to slice 1 then

**Pre-intake context:**

- Slice 1 finalizes the firmware v1.1.0 skeleton at `firmware/versions/v1.1.0/` so it becomes deployable. Skeleton currently has only the 2 new concepts (`brainstorm-community`, `brainstorm-community-signal`); the manifest is missing the 34 v1.0.0 concepts plus the `enumerations`, `elements`, `sets`, `changelog`, and `relationshipTypes` top-level entries. See [PLAN.md §5](../../PLAN.md#5-firmware-additions) and the SKELETON note in [v1.1.0/manifest.json](../../firmware/versions/v1.1.0/manifest.json).
- The two new concept-header.json and json-schema.json files are already well-shaped against PLAN.md §3 (DList layer ↔ Concept layer mapping). Minor schema gap: the brainstorm-community JSON Schema does not yet expose the optional NIP-72-wrapping `a` tag per PLAN.md §3 / DECENTRALIZED_LISTS_COMPAT.md Method 2.
- `firmware/active` symlink currently points at `versions/v1.0.0`. PLAN.md says v1.1.0 stays staged until the active symlink is flipped; this story decides whether the flip happens here or in a separate operator-driven step.
- No running Tapestry instance in this branch, so live `POST /api/firmware/install` verification is deferred to staging smoke (matches the pattern from story #5).

**Classification:** Feature
**Strictness:** Standard
**Phase path:** Planning → Architecture → Test Design → Implementation → Review (all five phases apply). Live install verification deferred to staging smoke.

---

## 2026-05-14 — Feature: Brainstorm Communities — Slice 2 (GR-Community scoring + REST API)

**Raw request (verbatim):**

> keep going

**Pre-intake context:**

- Slice 2 implements the **server-side GR-Community scoring system** (PLAN.md §4) and the **REST API contract** that Slice 3 (Discover) will consume. Scoring is a two-gate confidence-weighted GrapeRank variant: `weight(rater) = baseline_gr(rater) * community_gr(rater)`.
- Existing GrapeRank at `src/algos/personalizedGrapeRank/` is heavyweight (file-based, scorecards.json, /var/lib persistence). Per-community scoring is bounded (~hundreds of members per community), so an in-memory implementation with deterministic input → output is sufficient. The existing global GR stays unchanged.
- Live behavior against real strfry/Neo4j is deferred to staging smoke (same pattern as #4/#5/#7). Slice 2 ships the **math** (unit-tested against synthetic graphs) and the **REST contract** (correctly-shaped JSON, empty-when-empty), so Slice 3 can swap mock-data imports for `fetch('/api/communities')` calls.

**Classification:** Feature
**Strictness:** Standard
**Phase path:** Planning → Architecture → Test Design → Implementation → Review. Live behavior deferred to staging smoke.

---

## 2026-05-14 — Feature: Brainstorm Communities — Slice 3 (Discover swaps mock data for API)

**Raw request (verbatim):**

> slice 3

**Pre-intake context:**

- Slice 3 swaps the `ui-communities/` read path from `src/data/mockData.js` to the REST endpoints landed in Slice 2 (`GET /api/communities`, `/:slug`, `/:slug/members`). Discover is the first surface that reads from the network; CommunityDetail and Edit follow.
- Slice 2's data-source layer is stubbed, so a fresh deploy answers with `{ communities: [] }`. Local dev needs the mock data to stay populated; production needs to honestly show the empty state. Introduce an explicit `VITE_USE_MOCK_DATA` env toggle, default `true` in dev / `false` in build — never conditional on the API's actual response shape.
- Scoped to read-only surfaces. MyCircles + Create stay on mock data this slice because they depend on a viewer's joined-set (Slice 4 auth) and a member-search endpoint (no such endpoint exists yet). Write paths land in Slice 4.

**Classification:** Feature
**Strictness:** Standard
**Phase path:** Planning → Architecture → Test Design → Implementation → Review. Live behavior deferred to staging smoke.

---

## 2026-05-14 — Feature: Brainstorm Communities — Slice 4 (NIP-07 sign-in + Join / Vouch / Raise a concern writes)

**Raw request (verbatim):**

> yes, typo - brainstorm.world, not social. Push now, then move on to slice 4

**Locked decisions captured at intake:**

- Dev-mode publish behavior: **mock publish** — NIP-07 prompt fires, event gets signed, the signed event is `console.log`'d and local state updates optimistically. No relay round-trip in dev. Re-uses the existing `VITE_USE_MOCK_DATA` toggle so mock-data + mock-publish are paired states.
- Default production relay: **wss://communities.brainstorm.world** — self-hosted on the same droplet that serves the UI.
- "Raise a concern" UX: **one-click veto with optional comment** — confirmation dialog surfaces an optional `comments` textarea (matches the firmware schema's optional field per Slice 1).

**Pre-intake context:**

- Slice 4 is the first slice that writes. The Sign-in button stops being a no-op; Join / Vouch / Raise-a-concern start publishing real signed nostr events. The viewer pubkey starts threading through `getCommunities(viewer)` etc. so the API can personalize per-viewer.
- Event shapes follow Slice 1's firmware schemas (kind 39999, `a` tag for the community, `p` tag for the target on signal events, `type` and `role` tags with defaults).
- Leave semantics are intentionally Slice-4-light: local-state-only "leave" for v1 (real nostr "delete" via NIP-09 / DList header replacement is a follow-up story). Documented as out-of-scope.

**Classification:** Feature
**Strictness:** Standard
**Phase path:** Planning → Architecture → Test Design → Implementation → Review. Live publish-to-real-relay deferred to staging smoke.

---

## 2026-05-14 — Feature: Brainstorm Communities — Slice 5 (Create flow publishes a new community)

**Raw request (verbatim):**

> continue with slice 5

**Pre-intake context:**

- Slice 4 wired the publish path for **Join** (republishing an existing community-record on the viewer's DList) + **Vouch / Raise-a-concern** (endorsement signals). Slice 5 wires the **Found** path: publishing a brand-new community-record from scratch via the Create wizard's existing 5-step flow.
- The Create wizard already collects name, description, topics, and founding voices (Slice 0); the "Similar circles" step is the soft-canonicalization gate from PLAN.md §6 Q4. Slice 5 only adds the final-step **publish** — everything before the Review step stays the same.
- PLAN.md §6 Q5.3 explicitly defers founder-controlled mirror tooling to v1.1 — Slice 5 ships with the brainstorm.world-hosted default relay set (re-using `DEFAULT_RELAYS` from Slice 4's `publish.js`).
- Auto-derive the slug from the wizard's `name` field (lowercase, hyphenate, strip non-alphanumeric). PLAN.md §6 Q4 commits to "no hard dedup" — different curators can use the same slug; the d-tag is scoped per (kind, pubkey) so there's no collision at the protocol level.
- First-time creators may not yet have a kind-39998 `brainstorm-communities` DList header. Slice 5 publishes the header **before** the community-record event so a clean nostr client sees a well-formed DList with one item. Subsequent creates re-publish the header (idempotent: same d-tag, replaceable event) — small wasted signature, acceptable for v1; future optimization can check the relay first.

**Classification:** Feature
**Strictness:** Standard
**Phase path:** Planning → Architecture → Test Design → Implementation → Review. Live publish verification deferred to staging smoke.

---

## 2026-05-13 — Scheduled task: refresh Meilisearch profiles + House PoV WoT scores

**Raw request (verbatim):**

> In the tapestry repository, there is a new feature I would like to add in the Home > Settings > Relays page, Scheduled Tasks tab. Currently, there is a panel to Update All Scores for Owner that can be enabled / disabled and that can be set to run on a schedule. I would like to create a new panel that Meilisearch profiles and House PoV wot scores are kept updated. Like the existing panel, it should have an enable / disable toggle button (default: disabled) and the ability to set it to Run ever __ days, __ hours.
>
> We will code up the feature on a local branch, then push it to staging, then to main, as per our usual routine.
>
> Does this make sense? What questions or recommendations do you have?

**Follow-up (verbatim):**

> One question before we begin: Does your current plan include updating the House PoV Treasure Map (kind 10040 event) and all Trusted Assertions (kind 30382 events)? We will want to do that before loading WoT scores into Meilisearch.

**Clarifications captured in the pre-intake conversation:**

- House PoV is a *different* pubkey from Owner; configured by the admin at Home > My Grapevine > Search Preferences (persisted in `settings.json` under `grapevine.searchPreferences.povPubkey` / `delegatedPubkey` / `nip85Relay`).
- House is a remote pubkey on this node — we do **not** publish on its behalf; we sync its externally-published 10040 and 30382 events into local strfry.
- The latest Trusted Assertions (kind 30382) are the **single source of truth** for House's scores. Neo4j is not. Therefore the task does not recompute scores — it ensures the latest TAs are present locally, then loads them into Meilisearch.
- Task scope: profile sync + score reload only — no GrapeRank recompute. The full Owner-side score recompute remains the responsibility of the existing "Update All Scores for Owner" task.
- UI shape: one combined panel with one shared schedule (enable toggle + days/hours), matching the existing panel's UX. Default disabled.
- Process: user opted to run this feature through the project's Product Owner → Architect → Tester → Implementer → Reviewer harness.

**Classification:** Feature
**Strictness:** Standard
**Phase path:** Planning → Architecture → Test Design → Implementation → Review (all five phases apply per Standard / Feature)

---

## 2026-05-13 — Bug: strfry-router FATAL on first boot (missing config file)

**Raw request (verbatim):**

> In the tapestry repo at /Users/clawds4/repos/nous-clawds4/tapestry, fix a first-boot gap that leaves the strfry-router process in FATAL state.
>
> Problem observed (during story #4's local-stack bring-up, May 2026):
>
>     strfry-router  FATAL  Exited too quickly (process log may have details)
>
> strfry-router-error.log shows:
>
>     ERR| Failed to parse router config: Failed to load config file '/etc/strfry-router-tapestry.config':
>         filesystem error: open() failed: No such file or directory
>
> The file is generated by `src/api/strfry/routerConfig.js`'s `generateConfig` (used by the Router Management UI when operators toggle presets per ADR 0002 / story #2), but on a fresh container nothing has called it yet, so the file doesn't exist when supervisord tries to start strfry-router. Supervisor then crash-loops the process noisily.
>
> Two reasonable fixes (Architect's call which one to pick):
> 1. Entrypoint pre-generates an empty default config (minimal valid `streams { }`).
> 2. Make the strfry-router supervisord program autostart=false until the router state file is written, and have the routerConfig POST handlers do a one-shot `supervisorctl start strfry-router` after generating the file.
>
> Option 1 is simpler and matches existing entrypoint patterns. Option 2 avoids running an idle daemon.

**Architect's call (recorded):** Option 1. `/etc` is ephemeral in this image (only `/var/lib/{brainstorm,neo4j,strfry}` and `/var/log/brainstorm` are mounted as volumes), so the existing fallback in `docker/entrypoint.sh:288` — which copies the bundled template only when `router-state.json` is absent — leaves `/etc/strfry-router-tapestry.config` missing on container *restarts* with persistent state, not just fresh boots. An unconditional empty-config fallback fixes both cases and keeps the existing template-seed branch intact for true first-boot UX. Option 2 was rejected because tying the daemon lifecycle to UI POST handlers adds a new failure mode (e.g., `restore-defaults` partial failure leaves the daemon stopped).

**Scope confirmed with user:**

- Branch off `staging` (not the current feature branch — unrelated change).
- Implementer + Reviewer workflow only (no separate story file / test plan; Bug + obvious-fix per Standard rules).
- Single change to `docker/entrypoint.sh`. One unit test in `test/`, registered in `test/test.js`.

**Classification:** Bug
**Strictness:** Standard
**Phase path:** Implementation → Review (Architecture skipped — obvious fix per Standard / Bug rules; intake captures the Architect's call inline above)
