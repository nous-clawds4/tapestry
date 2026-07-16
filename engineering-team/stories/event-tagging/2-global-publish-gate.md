# Story 2: Global publish gate — external publishing is opt-in

**Status:** Draft
**Created:** 2026-06-26
**Type:** Feature
**Epic:** event-tagging

## Background

During development, an event signed with the operator's dev pubkey must **never** reach a public relay. The leak is irreversible: live users can pick the event up and depend on it (it becomes part of their concept graph / WoT inputs), and the dev pubkey ends up on the open network as something others rely on permanently. The worst case is automated tests blasting thousands of test events onto live relays.

Today the opposite is true: every client publish path funnels through `publishEverywhere` (`ui/src/utils/nostrPublish.js`), which **unconditionally** fans out to 5 hardcoded production relays in parallel with the local write. Four live callers do this — pubkey tag assertions (the `nostr-user-tag` feature), tag pins, profile actions, and concept publish — and the event-tagging write path (Story 5) would inherit the same hazard.

The operator's decision (2026-06-26, revising the initial direction): make external publishing a **single global, opt-in local-only guard**. **Unset is the default and means publish externally exactly as today** — so production, staging, tags, and any other dev are untouched with no config change. A dev who wants the build invariant sets a flag to force **local-only**. This eliminates the rollout hazard a default-off gate would have carried (silently stopping external publishing on every existing deployment) and avoids forcing the guard on other devs who may want to publish externally from their local env.

The accepted tradeoff: this is **not safe-by-default**. Honoring the epic's "local dev relay only" invariant is now an explicit per-machine opt-in. It is low-risk because the automated test suite (Node/CJS) never exercises the browser publish path, so tests cannot leak under either default, and the flag is set once in a dev's local config and persists. This story is still the gate the event-tagging write path (Story 5) relies on, and **must land before any write-path testing**.

This is intentionally broader than event-tagging: the guard is global, so it also covers the existing publishing features.

## User-facing description

As the operator/developer, I want a single switch that forces all Nostr publishing to stay on my local relay — opted into on my dev box — so that dev-key-signed events from my manual testing can't leak onto the live network, while production and every other deployment keep publishing externally with no change at all.

## Acceptance criteria

Testable from the outside (publish behavior under each guard state).

- [ ] **Default (unset) publishes externally.** Given a deployment with the local-only guard NOT set (the default, e.g. production, or a dev who opts out), when any client publish path runs, then the event is published to both the local relay and the configured external relays — today's behavior, unchanged.
- [ ] **Guard forces local-only.** Given a deployment that has set the local-only guard, when any client publish path runs, then the signed event is written to the **local relay only** and is sent to **no** external/public relay.
- [ ] **Global coverage.** The guard applies to **every** client publish path, not just event-tagging: pubkey tag assertions, tag pins, profile actions, and concept publish all honor it. No publish path can reach an external relay while the guard is on.
- [ ] **Local-only is success, not failure.** When the guard is on, a publish that writes only to the local relay still completes successfully — the user's action (tag, follow, pin, etc.) is not surfaced as an error for lack of external delivery.
- [ ] **Guard is per-deployment config, not code.** Engaging the guard is a per-deployment setting (in the same spirit as the per-deployment TA identity), not a source edit and not a per-call argument. The default (unset) requires no configuration.
- [ ] **Fail-open on unknown state.** When the client cannot determine the guard state (policy unreadable / not yet loaded), it falls back to **external publishing** (the unset default) — a transient failure never silently pauses production publishing.
- [ ] **Guard state is observable.** When the guard keeps a publish local-only, that outcome is discoverable (logged and/or reflected in the publish result) so it is clear external relays were **intentionally skipped**, not failed.

## Concepts touched

None — this is publish-infrastructure / deployment configuration, not a concept-graph change. (Architect: no firmware concept work expected.)

## Out of scope

- **Relay-level redistribution by the strfry router.** Whether the local strfry itself forwards events to upstream relays is governed by deployment relay/router config (OPERATIONS.md), a separate mechanism from app-level publishing. This story gates what the *app* sends; the operator is responsible for ensuring a dev deployment's router is not independently forwarding externally. Flag for the Architect to note the boundary, not to solve here.
- **Server-side read paths.** The `SimplePool` usages in `src/api/**` are fetches (reads), not publishes — unaffected.
- **Which external relays are used when enabled.** The existing `PUBLISH_RELAYS` set (and per-call relay overrides like the concept/DList relay sets) stays as-is; this story only gates *whether* external publishing happens, not *where*.
- **A user-facing UI toggle.** The opt-in is deployment config, not an end-user setting.
- **The event-tagging write path itself** (Story 5) — this story only provides the gate it will rely on.

## Open questions (resolved in ADR 0002)

1. **Default direction** — *Resolved (operator, 2026-06-26):* **reversed** to default-external / opt-in guard. Removes the rollout hazard entirely — existing deployments need no change. Accepted tradeoff: not safe-by-default; the build invariant is a per-machine opt-in.
2. **Enforcement layer** — *Resolved:* **client-side** guard at the publish chokepoint (operator steer; client-side suffices for the actual threat — accidental dev leakage, not hostile bypass).
3. **Fail direction** — *Resolved (operator, 2026-06-26):* **fail-open** — an unreadable policy falls back to external (the unset default), so a transient failure never pauses production publishing.

## Linked artifacts
- ADR: `engineering-team/decisions/event-tagging/0002-global-publish-gate.md`
- Test plan: `engineering-team/stories/event-tagging/2-global-publish-gate.test-plan.md` (suite: `test/global-publish-gate.test.js`)
- Review: `engineering-team/reviews/event-tagging/2-global-publish-gate.md` — **PASS** (2 non-blocking doc nits)
