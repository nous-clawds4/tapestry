# ADR 0002: Global publish gate — external publishing on by default, local-only is an opt-in guard

**Status:** Proposed
**Date:** 2026-06-26
**Story:** `engineering-team/stories/event-tagging/2-global-publish-gate.md`

## Context

Every client publish path funnels through `publishEverywhere` (`ui/src/utils/nostrPublish.js:96`), which calls `publishToRelays` (`:62`) — the browser-side `SimplePool` fan-out to 5 **hardcoded production relays** (`PUBLISH_RELAYS`, `:13`) — **unconditionally**, in parallel with the local write (`publishToLocalStrfry`, `:46`, via `/api/strfry/publish`). Four live callers do this:

- `ui/src/utils/publishProfileTag.js:24` — pubkey tag assertions (`nostr-user-tag`).
- `ui/src/utils/publishTagPin.js:276` — tag pins.
- `ui/src/hooks/useProfileActions.js:84` — profile actions (follow/mute/etc.).
- `ui/src/pages/concepts/ConceptDetail.jsx:61` — concept publish.

Server-side `SimplePool` usage (`src/api/**`) is all **reads** (fetches) — no server external publish exists. So the entire external-publish surface is one browser chokepoint.

**The threat model.** The risk is the **operator's own dev/test environment accidentally leaking dev-key-signed events** onto public relays (irreversible: live users depend on them; the dev pubkey is exposed permanently). It is **not** defense against a hostile client — Nostr publishing is permissionless, so any client can already publish to public relays. This decides the enforcement layer (client-side is sufficient).

**Default direction (operator decision, 2026-06-26 — reverses the first draft of this ADR).** The gate is a **local-only guard that is opt-in**, not a default-on safety net:

- **Unset (the default) → external publishing happens, exactly as today.** Production, staging, tags, and any other dev who does nothing are **completely unaffected — zero required config change**. This eliminates the rollout hazard the default-off design carried (a default-off gate would have silently stopped external publishing on every existing deployment).
- **`BRAINSTORM_PUBLISH_LOCAL_ONLY=true` → local-only.** The operator sets this on their dev box to honor the epic's build invariant; other devs are free to leave it unset.

The accepted tradeoff: this is **not** safe-by-default. The build invariant (local-only during this work) is now opt-in per machine. It is low-risk because (a) the CJS test suite never exercises the browser publish path, so **tests cannot leak under either default**, and (b) the flag is set once in a dev's local `brainstorm.conf` and persists.

**Fail direction (operator decision, 2026-06-26): fail-open.** When the client cannot read the policy (fetch fails / not yet returned), it falls back to **external** — consistent with the unset default, so a transient server hiccup never pauses production publishing. Dev safety relies on the reliable same-origin read of the local flag.

Config plumbing to mirror:
- Per-deployment values live in `brainstorm.conf` / env, read via `getConfigFromFile(varName, default)` (`src/utils/config.js:16`) and/or `process.env.BRAINSTORM_*` (e.g. `src/utils/structuredEvents.js:82`).
- They reach the browser through small public endpoints (`/api/relays` → `src/api/relays/index.js`) consumed in `useConfig` (`ui/src/context/ConfigContext.jsx`).

Constraint — **CJS/ESM split (testability).** The gate logic lives in `ui/` (ESM, imports `nostr-tools`); the test runner is CJS (`node test/test.js`) and cannot import it. The server handler is CJS-testable. This shapes the test seam (server unit test + client source-contract).

No concept definitions change → **no firmware reinstall**.

## Options considered

### Enforcement layer

**Option A — Client-side guard at the publish chokepoint (recommended).** A cached, fail-open policy check (`isExternalPublishAllowed()`) inside `nostrPublish.js`; `publishToRelays` skips the external fan-out when the guard is on (`localOnly`). Config delivered via a tiny endpoint.
- **Pros:** Smallest change; fan-out stays where it is. Fully addresses the actual threat (the operator's own browser/tests). Enforced at the one function all four callers (+ the future event-tagging caller) use, so a caller **cannot forget** it.
- **Cons:** A determined client could still publish externally by other means — already true of Nostr, *out of threat scope*.

**Option B — Server-side routing of external publish.** Move the fan-out off the browser; server publishes (or refuses).
- **Pros:** A browser cannot bypass the gate.
- **Cons:** Materially larger change (new endpoint, server-side `SimplePool` publish, re-plumb all four callers) for protection against a threat we don't have. **Rejected** per the story's open-Q2 test (operator also leaned client-side).

**Option C — Per-caller flag threading.** Pass `localOnly` from `useConfig` into each call site. Forgettable — a new caller that omits it bypasses the guard. **Rejected.**

### Config delivery

**Option D — Dedicated `/api/publish-policy` endpoint (recommended).** Returns `{ success, allowExternalPublish }`. Consumed by the util (enforcement) and `useConfig` (display). Self-documenting, cheap, cacheable.

**Option E — Extend `/api/relays`.** Fewer routes, but couples an enforcement flag to a relay-list endpoint. Acceptable fallback; **not chosen** for separation of concerns.

## Decision

**Option A + Option D.** A client-side, opt-in `local-only` guard enforced at the `nostrPublish.js` chokepoint, **fail-open**, reading a per-deployment boolean delivered by `/api/publish-policy`, backed by a `BRAINSTORM_PUBLISH_LOCAL_ONLY` flag that **defaults to external publishing** (unset = publish as today).

Rationale: simplest design that delivers the operator's revised intent — production and all existing deployments are untouched with no config change, while a dev opts into local-only for this build. Enforcement at the single shared chokepoint makes coverage structural, not per-caller discipline. Client-side suffices because the threat is accidental dev leakage, not hostile bypass.

## Consequences

- **Zero change for existing deployments.** prod/staging/tags and any other dev keep publishing externally with no config edit. The rollout hazard is gone.
- **Build invariant is now opt-in.** Local-only during this work depends on the operator setting `BRAINSTORM_PUBLISH_LOCAL_ONLY=true` in their dev `brainstorm.conf`. Documented in OPERATIONS.md, the epic invariant section, and project memory. **Not safe-by-default** — accepted.
- **Tests don't leak** because no test exercises the browser fan-out; the source-contract test proves the guard suppresses external publishing when on. (A CI that wants belt-and-suspenders may set the flag, but it is not required.)
- **Observability:** the external result carries `skippedByGate` + a one-line log, so "kept local" is distinguishable from "external failed."
- **Local-only is success:** `publishOrThrow` (`publishProfileTag.js:23`) already throws only when *both* local and external fail; with external intentionally empty and local OK, user actions still succeed — no caller edits for this AC.
- **Fail-open** keeps prod robust to a transient policy-read failure; the residual dev leak window on a flaky same-origin read is accepted (operator decision).
- **Firmware reinstall required?** **No.**

### Operating the guard (replaces the old rollout migration)

- **Production / staging / tags / other devs:** do nothing. Unset flag = external publishing, unchanged.
- **This build (feat/tags local dev):** set `BRAINSTORM_PUBLISH_LOCAL_ONLY=true` in the local `brainstorm.conf` and restart the container, to honor the epic's local-dev-relay-only invariant. Set once, persists.
- If a deployment ever *wants* a hard local-only posture, it sets the same flag — no code change.

## Implementation notes

- **Config flag:** `BRAINSTORM_PUBLISH_LOCAL_ONLY`. Read order mirrors existing flags: `process.env.BRAINSTORM_PUBLISH_LOCAL_ONLY` → `getConfigFromFile('BRAINSTORM_PUBLISH_LOCAL_ONLY', 'false')` → default `'false'`. `localOnly` is true **only** when the string is exactly `'true'`; `allowExternalPublish = !localOnly` (so unset/anything-else ⇒ external allowed).
- **Endpoint:** `src/api/publish-policy/index.js` → `handleGetPublishPolicy(req,res)` returning `{ success: true, allowExternalPublish: <bool> }`; wire in `src/api/index.js` as `app.get('/api/publish-policy', …)`. Public, no auth.
- **Enforcement (`ui/src/utils/nostrPublish.js`):**
  - Add `isExternalPublishAllowed()` — fetches `/api/publish-policy` **once**, caches the resolved promise at module scope; returns **`true` on any error/non-200 (fail-open)**.
  - `publishToRelays`: if `!(await isExternalPublishAllowed())`, **do not open `SimplePool`**; return `{ successes: [], failures: [], skippedByGate: true }` and `console.info('[publish] local-only guard on — external publishing skipped')`. Guarding the primitive covers `publishEverywhere` and any future direct caller.
  - `publishEverywhere`'s shape (`{ local, external }`) is unchanged; `external.skippedByGate` appears when the guard is on.
- **Client display (optional):** add `allowExternalPublish` to `ConfigContext` from the same endpoint, so UI can surface "external publishing off" when the guard is on.
- **Testing seam:**
  - **Server (CJS, strong):** unit-test `handleGetPublishPolicy` — `BRAINSTORM_PUBLISH_LOCAL_ONLY='true'` → `allowExternalPublish:false`; unset / `'false'` / `'1'` / `'yes'` → `allowExternalPublish:true` (only `'true'` engages the guard).
  - **Client (source-contract):** assert over `nostrPublish.js` source that `publishToRelays` consults `isExternalPublishAllowed()` before any `SimplePool`/`pool.publish`, and that the helper's error path returns `true` (fail-open). Mirrors Story 1 / `b-tag-primitive` source-contract style.
  - **Default posture:** with no flag, the suite (no browser path) cannot externally publish; the source-contract test pins that the guard, when on, suppresses the fan-out.

## Out of scope

- **strfry router-level redistribution** — deployment relay config (OPERATIONS.md), a separate mechanism.
- **Server-side read paths** (`SimplePool` fetches) — unaffected.
- **Which relays are used when on** — `PUBLISH_RELAYS` and per-call relay sets stay as-is.
- **A user-facing toggle** — opt-in is deployment config.
- **The event-tagging write path** (Story 5) — consumes this gate; not built here.
