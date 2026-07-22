# Book of Work: Relationship Primitives (Neo4j-only add/delete)

**Slug:** relationship-primitives
**Status:** Open
**Opened:** 2026-07-18
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD)** — the operator's ask, restated and confirmed in the conversation of 2026-07-18. Completion is *judged* against the bullets below.

Source request: the intake entry **"2026-07-18 — Feature: primitive relationship add/delete endpoints (Neo4j-only, strfry-free)"** in `engineering-team/stories/_intake.md`. That entry's verified architectural background, open Planning questions, and out-of-scope list are part of this anchor.

**Governing premise (operator, verbatim):** *"The information in neo4j should be considered the reference; it is 'me', the second brain of the tapestry owner / operator, or perhaps the brain of the tapestry assistant -- or perhaps both. Strfry is simply one format by which information can be communicated between one tapestry instance and another."* This is why strfry-free primitives are correct here, not a shortcut: the endpoints edit the reference directly.

### Acceptance frame

- [ ] Two operations exist — **add** and **delete** a relationship between two nodes that already exist in Neo4j, each identified by uuid, with the relationship type supplied by the caller and validated against a whitelist. Reachable by plain `curl` from the local/Docker host, consistent with the existing `/api/normalize` calling convention. *(Post-security-work note, 2026-07-21: unauthenticated mutations on this surface are now default-deny — ADRs `security-auth-exposure/0001`/`0002` — and local reachability holds via `req.localTrusted`, loopback with no proxy header.)*
- [ ] **Each operation carries an explicit owner gate** — route-level `requireOwner`, or the in-handler `isOwner(req) || req.localTrusted → 403` pattern templated in `src/api/strfry/wipe.js` — and does not rely on the `/api/normalize` mount alone: default-deny blocks only *unauthenticated* callers, so the mount by itself would leave the authenticated-non-owner gap scoped in `_intake.md` (2026-07-21).
- [ ] **Neither operation touches strfry, re-signs or publishes any nostr event, regenerates any `json` tag, or triggers derivation.** An automated test asserts no event is written for either operation.
- [ ] **Add is idempotent** (`MERGE` semantics): calling it twice leaves exactly one relationship, and the response distinguishes *created* from *already-existed*. **Delete is targeted** (removes only the named relationship between the named pair, never a bulk sweep) and its response distinguishes *deleted* from *not-found*.
- [ ] Both operations **fail loudly, never silently no-op**, on: a `fromUuid` or `toUuid` that does not exist in Neo4j, and a `relType` absent from the whitelist. Error responses name which precondition failed.
- [ ] Relationship-type names resolve through the **firmware alias layer** (`REL.CLASS_THREAD_TERMINATION` → `HAS_ELEMENT`, etc.; `src/api/normalize/firmware.js:71-80`) rather than hardcoded string literals, so an alias change does not silently orphan the whitelist.
- [ ] Automated tests cover, at minimum: add-new, add-idempotent, delete-existing, delete-missing, nonexistent endpoint node, rejected `relType`, and an authenticated **non-owner** receiving 403 from both operations (the owner-gate case) — plus the no-strfry-write assertion above.
- [ ] The **firmware-install overwrite hazard is documented** where an operator using these endpoints will encounter it: install pass 1d re-derives `HAS_ELEMENT` from `z` tags across *every* ConceptHeader with no already-explicit guard (`src/firmware/install.js:594-634`), while the redundancy prune runs only for concepts carrying a firmware `manifest.json` (`:758`, `:764`) — so an install can re-add a deleted edge and delete an added one. **Documentation only in this book; changing install's behavior is explicitly out of scope** (operator decision, 2026-07-18).
- [ ] Live on `staging.brainstorm.world` with the staging smoke test passing. Evidence: (a) journaled proof the routes are **deployed** on staging — a response distinguishable from a missing route (these endpoints are auth-gated for non-local callers by the post-security-work default-deny plus the explicit owner gate in `src/middleware/auth.js` / the route handlers, so a 401/403-class answer proves deployment where a 404 would disprove it); (b) full functional evidence — every test case in the bullet above — captured against the **local** stack, since the localhost auth bypass cannot be exercised remotely and droplet SSH is outside the ceiling; (c) journaled output of the deploy-safety `safe-to-merge` check run against staging before this book's merge.

## Epics in this book

- `relationship-primitives` — the add/delete relationship operations and their documentation. (Epic file to be created at Planning.)

## Direction mode — pre-registered

This book runs under the Director harness — [`/direct-feature`](../../../.claude/skills/direct-feature/SKILL.md) + [`engineering-team/roles/director.md`](../../roles/director.md): Claude answers the per-story phase gates under blinded gate-judge rubrics and supervises the deploy chain through staging. This section is the run's **pre-registration**.

*Pre-arming refresh (2026-07-21, operator-ratified):* the acceptance frame and delegated decisions were updated **before arming** for the post-`security-auth-exposure` surface — explicit per-endpoint owner gate added to the frame; the mount point fixed at `/api/normalize/*` (naming only remains delegated); the whitelist limited to firmware-aliased relationship types, with net-new custom types (e.g. `HAS_SUBGOAL` for the upcoming `second-brain` work) excluded from this run. The hypothesis (~80%), deadline arithmetic, story cap, ceiling, and rollback plan are unchanged. Once armed, nothing in it may be weakened mid-run; proposed changes go to the journal for the post-mortem. **An operator goalpost amendment mid-run voids the run** (it does not rescue it).

**Hypothesis being tested:** the harness can carry a small, well-mapped, single-subsystem feature end-to-end without a human at the gates. Estimated at pre-registration: **~80% chance of full success** — the subsystem is fully mapped (see the intake entry), the surface is two endpoints in one file, and there is no UI and no wire-format work. Residual risk concentrates in Gate-3 test design (asserting a *negative* — that no strfry write occurs) and in the staging-evidence constraint of bullet 8. Failure-and-rollback is an acceptable, informative outcome — the decision journal is the primary artifact either way.

### Arming (operator only — the Director may not arm)

Arming is **one commit on the `staging` branch whose diff touches only this subsection**, filling in:

- **Armed:** Yes — 2026-07-21T08:09:50Z
- **Deadline:** 2026-07-23T08:09:50Z
- **Baseline:** 270049818842af7c52db2efe5f90a31ec226e59f
- **Pinned governing versions:** `engineering-team/roles/director.md` @ bdbc8cf65f56067ccf8626eff27dc9bb7a387ec0 · `.claude/skills/direct-feature/SKILL.md` @ 1d9f9b864bfa085c50b2a4d115e6f8cd407b55b3 · `.claude/agents/gate-judge.md` @ 3a2657b28427658a0774a7ffdba5f642a2f968ec

A missing or ambiguous Armed/Deadline line means the book is not armed; the Director must refuse to run.

### Autonomy ceiling — staging

Forbidden, no exceptions: `/cycle-prod`; `/cycle-full`; any PR based on `main` or push/merge to `main` (including reverts); push/merge to the sandbox long-lived branches (`feature-magic-carpet`, `feat/pubkey-tagging-target`, `feat/communities`, `feat/curate`) and to `feat/tags`; any prod mutation, droplet SSH, deployed-droplet config edit, or BullBoard mutating action on a deployed droplet; triggering, as verification, any task whose `taskRegistry.json` entry carries `resourceClass: "neo4j-heavy"`, plus `reconcileAll`. **Any breach is an automatic experiment failure**, regardless of feature state.

Clarifications fixed at pre-registration (not mid-run inventions):

- **Local graph mutation is permitted verification.** These endpoints exist to mutate the local Neo4j reference graph; exercising them against the **local** stack is the point, and is not a ceiling concern. Tests must leave the graph as they found it (create and clean up their own fixture nodes; never mutate firmware or `shared-concept` structure as a test side effect).
- **No mutation of any deployed instance's graph.** Staging verification is read-only — bullet 8(a) is a deployment probe, not a functional call. The Director never invokes add/delete against `staging.brainstorm.world`.
- **Safe-window discipline applies to this book's own merge:** before the staging merge, run the deploy-safety `safe-to-merge` check against staging (shipped by the `deploy-safety-gate` book) and journal the output — this doubles as acceptance-frame evidence 8(c).

### Reserved for the real operator (never the Director's)

Arming this run; ratifying completion (the "yes" to `/close-book`); instructing the rollback after a failure; anything past staging; ratifying proposed goalpost amendments (which take effect only for a future run).

**Operator takeover** = the operator performing any phase work, gate answer, artifact or code edit, or deploy action for this book mid-run — and it counts as experiment failure (the feature may still ship by hand; the autonomy hypothesis is recorded as unsupported). Explicitly **not** takeover: arming; answering a question the Director surfaced at a halt; post-halt decisions; ratification decisions.

### Budgets / stopping rules

Full definitions: role file → "Stopping rules." The numbers: the deadline (48h); 3 consecutive kick-backs at the same gate of the same story (judge KICK_BACKs; at Gate 5, Reviewer CHANGES_REQUESTED counts); more than 2 ADR amendments on one story after its Gate-2 APPROVE; the book's **total** story count (fix-forward stories included) exceeding **3**; ceiling breach (auto-fail); external interference. Tripping any rule halts the run loudly.

**Story-count rationale (operator-ratified):** the two operations are expected to ship as **one story** — they share a whitelist, a validation path, and a test harness, so splitting them doubles gate overhead for a single contract. The cap of 3 leaves room for fix-forward without inviting scope growth.

### Open design decisions delegated to the Director

Resolved at Planning per the role file → "Answering as the user": simplest option that satisfies the frame, journaled with rationale.

1. Route **naming only** — the mount point is fixed by the handoff (2026-07-20/21): under `/api/normalize/*`, with the explicit per-endpoint owner gate the acceptance frame now requires (the mount alone is insufficient).
2. Initial `relType` whitelist membership — `HAS_ELEMENT` + `IS_A_SUPERSET_OF` only, or the core-node wiring types as well. Membership is limited to relationship types already present in the firmware alias layer; net-new custom types (e.g. `HAS_SUBGOAL`) are out of scope for this run and arrive as a post-book whitelist extension.
3. Whether add and delete are two routes or one route with an action discriminator.
4. Endpoint-level validation strictness — whether parent-label constraints are enforced (`Set`/`Superset` only) or any existing node pair is permitted.
5. Response shape and HTTP status codes, including for the idempotent cases (*already-existed*, *not-found*).
6. Test strategy for operations whose contract is a Neo4j side effect — including how the no-strfry-write assertion is made.

**This list is exhaustive** — any other question the frame does not decide in quotable terms is frame-changing and halts the run. The firmware-install hazard is **not** delegated: the operator fixed it at documentation-only (2026-07-18); treating it as anything else is frame-changing.

### Success

A completion report with bullet-by-bullet staging evidence — audited by the final gate-judge per the skill's Stage 3 — is journaled and committed, and the completion offer is made, **before the deadline**; and the operator subsequently ratifies it. Ratification *latency* after a timely offer does not fail the run; operator **rejection** of the offer does.

### Failure and outcome classification

- Offer not made by the deadline → **failure** (the usual case).
- Operator rejects the completion offer → **failure**.
- Ceiling breach → **failure**, immediate, regardless of feature state.
- Operator takeover mid-run → **failure** (autonomy hypothesis unsupported).
- Deadline passes during a halt caused by Stopping rules 2–4 (harness thrash, design churn, scope overgrowth) → **failure**.
- Deadline passes during a Stopping-rule-6 halt (external interference: staging broken by others, origin moved, colliding sessions) → **run void** — not informative, not a failure.
- Deadline passes while the run is blocked in a **journaled safe-deploy-window wait** — holding a staging merge because a scheduled task is running or imminent on the target instance (checked via the deploy-safety gate endpoint) → **run void** — not informative, attributable to environment scheduling. Each wait must be journaled at its start to qualify. *(Clause inherited from the `deploy-safety-gate` book, operator-ratified 2026-07-18.)*
- Armed but never started → **run void**, attributable to the operator.
- Frame bullet 8 is scored at evidence time: staging breakage by external cause *after* the evidence is journaled does not retroactively fail the bullet.

### Rollback (on failure)

Executed **only on the operator's explicit instruction** after reviewing the HALT/failure journal entry — the same instruction authorizes the failure-mode `/close-book`. The Director halts and waits; it never auto-reverts (skill → "Halt semantics"). Steps, executable by either party:

1. Identify the book's staging merge PR(s) from `journal.md` (cross-check: `gh pr list --repo nous-clawds4/tapestry --base staging --search relationship-primitives --state merged`).
2. Create a revert branch off `origin/staging`; `git revert -m 1 <merge-sha>` for each merge, newest first; open a normal revert PR to `staging` per [`/cycle-staging`](../../../.claude/skills/cycle-staging/SKILL.md) (plain merge; every `gh` command carries `--repo nous-clawds4/tapestry`; never force-push — staging is shared); watch `deploy-staging.yml`.
3. Verify: Tier 1–2 smoke on `staging.brainstorm.world` **plus** one named assertion that the added routes no longer resolve (404).
4. Keep all harness artifacts — stories, ADRs, reviews, journal — they are the learning, not the mess.
5. Close the book via `/close-book` with the audit recording the failure honestly and the `prd-seed.md` capturing what was learned.

**Decision journal:** `engineering-team/audits/relationship-primitives/journal.md` — append-only, committed at every phase boundary.
