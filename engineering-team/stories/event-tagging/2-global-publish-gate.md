# Story 2: Global publish gate — external publishing is opt-in

**Status:** Draft
**Created:** 2026-06-26
**Type:** Feature
**Epic:** event-tagging

## Background

During development, an event signed with the operator's dev pubkey must **never** reach a public relay. The leak is irreversible: live users can pick the event up and depend on it (it becomes part of their concept graph / WoT inputs), and the dev pubkey ends up on the open network as something others rely on permanently. The worst case is automated tests blasting thousands of test events onto live relays.

Today the opposite is true: every client publish path funnels through `publishEverywhere` (`ui/src/utils/nostrPublish.js`), which **unconditionally** fans out to 5 hardcoded production relays in parallel with the local write. Four live callers do this — pubkey tag assertions (the `nostr-user-tag` feature), tag pins, profile actions, and concept publish — and the event-tagging write path (Story 5) would inherit the same hazard.

The operator's decision (2026-06-25): make external publishing a **single global, opt-in gate**. The dev environment should feel safe to write anything, knowing it stays local; reaching public relays should require an explicit, per-deployment opt-in. This story builds that gate. It is the dev-time face of the epic's "local dev relay only" build invariant and **must land before any write-path testing** (Story 5).

This is intentionally broader than event-tagging: the gate is global, so it also covers the existing publishing features and the test suite.

## User-facing description

As the operator/developer, I want all Nostr publishing to stay on my local relay by default and reach public relays only when a deployment has explicitly opted in, so that dev-key-signed events — from automated tests or my manual testing — can never leak onto the live network, while production deployments still publish normally.

## Acceptance criteria

Testable from the outside (publish behavior under each gate state).

- [ ] **Default is local-only.** Given a deployment with the external-publish opt-in NOT set (the default, e.g. local dev), when any client publish path runs, then the signed event is written to the **local relay only** and is sent to **no** external/public relay.
- [ ] **Opt-in restores fan-out.** Given a deployment that has explicitly enabled external publishing, when a client publish path runs, then the event is published to both the local relay and the configured external relays — i.e. today's behavior is preserved exactly when the flag is on.
- [ ] **Global coverage.** The gate applies to **every** client publish path, not just event-tagging: pubkey tag assertions, tag pins, profile actions, and concept publish all honor it. No publish path can reach an external relay while the gate is off.
- [ ] **Local-only is success, not failure.** When the gate is off, a publish that writes only to the local relay still completes successfully — the user's action (tag, follow, pin, etc.) is not surfaced as an error for lack of external delivery.
- [ ] **Tests cannot leak.** Given the default (gate off) in the test environment, when the automated suite runs, then no test causes a publish to an external relay.
- [ ] **Opt-in is per-deployment config, not code.** Enabling external publishing is a per-deployment setting (in the same spirit as the per-deployment TA identity), not a source edit and not a per-call argument. The default-off state requires no configuration at all.
- [ ] **Gate state is observable.** When the gate keeps a publish local-only, that outcome is discoverable (logged and/or reflected in the publish result) so it is clear external relays were **intentionally skipped**, not failed.

## Concepts touched

None — this is publish-infrastructure / deployment configuration, not a concept-graph change. (Architect: no firmware concept work expected.)

## Out of scope

- **Relay-level redistribution by the strfry router.** Whether the local strfry itself forwards events to upstream relays is governed by deployment relay/router config (OPERATIONS.md), a separate mechanism from app-level publishing. This story gates what the *app* sends; the operator is responsible for ensuring a dev deployment's router is not independently forwarding externally. Flag for the Architect to note the boundary, not to solve here.
- **Server-side read paths.** The `SimplePool` usages in `src/api/**` are fetches (reads), not publishes — unaffected.
- **Which external relays are used when enabled.** The existing `PUBLISH_RELAYS` set (and per-call relay overrides like the concept/DList relay sets) stays as-is; this story only gates *whether* external publishing happens, not *where*.
- **A user-facing UI toggle.** The opt-in is deployment config, not an end-user setting.
- **The event-tagging write path itself** (Story 5) — this story only provides the gate it will rely on.

## Open questions

1. **Rollout hazard — existing external-publishing deployments must opt in (resolve before deploy).** staging.brainstorm.world / brainstorm.world / tags.brainstorm.world currently publish externally. Shipping a default-OFF global gate will **silently stop** their external publishing unless each sets the opt-in flag as part of this rollout. The migration must set the flag on every deployment that should keep publishing externally, in lockstep with the change reaching it. *(Operator + Architect: confirm the rollout sequence; this is the main risk.)*
2. **Enforcement layer (Architect).** Should the gate be enforced client-side (the client reads config and skips the external fan-out) or routed through the server so a browser cannot bypass it when off? The robust option is server-side enforcement; PO requires only the *guarantee* — with the gate off, normal operation performs no external publish — and leaves the mechanism to the Architect. **Operator steer (2026-06-26):** leans **client-side** for simplicity, stated before reviewing the trade-offs — treat as a tie-breaker, not a mandate. If the Architect finds a materially stronger case for server-side enforcement (e.g. the build invariant demands a browser cannot bypass it), surface that rather than defaulting to the steer.
3. **Test-environment default.** Confirm the gate reads as "off" in the `node test/test.js` environment with zero setup, so the suite is leak-proof by default rather than by per-test opt-out.

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
