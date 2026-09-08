# ADR 0002: Per-relay Treasure Map sync

**Status:** Accepted
**Date:** 2026-09-07
**Story:** `engineering-team/stories/treasure-map-relay-presence/2-per-relay-map-sync.md`

## Context

Story 2 adds a per-row action that converges local strfry and one relay on the more recent
kind-10040. The five criteria that constrain the design:

1. The action appears only where the two sides differ, and its label states the direction.
2. Sending publishes the existing signed event — **no signer prompt** — then re-checks that row.
3. Pulling stores the relay's newer version locally **and the page re-reads the Map**.
4. **No deletion is published on any path.**
5. The deployment's publish policy is honored: on a local-only instance the outward direction is
   unavailable and says why; pulling stays available.

### What already exists

Almost all of it. This story is mostly composition:

- `ui/src/utils/nostrPublish.js:92` — `publishToRelays(signedEvent, relays)` already takes an
  arbitrary relay list, already consults the local-only gate, and already returns
  `{successes, failures, skippedByGate}`. Criterion 5 is *already implemented* inside the function
  this story needs; the panel's job is to reflect it, not re-derive it.
- `ui/src/utils/nostrPublish.js:45` — `publishToLocalStrfry(signedEvent)` → `POST /api/strfry/publish`
  with `signAs: 'client'`.
- `ui/src/utils/nostrPublish.js:70` — `isExternalPublishAllowed()`, backed by `GET /api/publish-policy`.
  Note two properties the panel inherits: it is **module-cached** (read once per page load) and
  **fail-open** (a policy-read failure resolves to "allowed").
- Story 1's `probeRelayForEvent` (`src/api/_shared/relaySource.js:126`) already fetches a relay's
  copy **and signature-verifies it** (`:189-196`), discarding anything off-filter or forged.
- Story 1's `compareMapVersions` (`ui/src/utils/treasureMap.js`) already classifies
  same / older / newer / divergent.

### Signature verification on the pull path — where it actually happens

Pulling writes a *relay-supplied* event into local strfry, so this is the security hinge.

`src/api/strfry/commands/publishEvent.js:58-62` checks only that `id`, `sig` and `pubkey` are
**present** — it does not verify them. The real gate is one line down: `:70` shells out to
`strfry import` with **no `--no-verify` flag**, and `strfry import --help` (checked in-container,
2026-09-07) shows `--no-verify` as an *opt-out*, so verification is strfry's default. A forged
event would be rejected by strfry.

That is a good backstop but a poor sole defense: it is invisible at the call site, and adding
`--no-verify` for unrelated performance reasons would silently open the hole. This ADR therefore
routes the pull fetch through story 1's probe, which verifies **before** anything is handed to the
import path — belt and braces, at no extra cost, using code that already has tests (`P6`, `P7`).

### The constraint that shapes the fetch

Story 1's endpoint deliberately returns only `{id, created_at}`, and `A6` in
`test/treasure-map-relay-presence.test.js` **pins that** ("return ONLY id + created_at"). But
pulling needs the whole signed event. Widening the default response would break `A6` — correctly,
because it is a real narrowing decision, not an accident.

### Constraints

- Architecture invariant 3 — nothing about relay state is stored; every check is re-derived.
- No new outbound-write capability on the server (see Option B).
- No new dependencies; no lint/build tooling (CLAUDE.md).

## Options considered

### Option A — Compose the existing primitives; `full=1` opts into the whole event

Direction is decided client-side by a new pure helper; **push** is `publishToRelays(event, [url])`;
**pull** fetches the verified event via an opt-in `full=1` on `GET /api/relay/presence`, then calls
`publishToLocalStrfry`. Each row owns its own action state and re-probes itself afterwards.

- **Pros.** Criterion 5 comes for free and correct, because the gate lives inside the publish
  function already. Pull inherits story 1's verification. The only new server surface is one
  opt-in query parameter. Direction logic becomes a pure function, testable without a browser or a
  relay — matching story 1's testing shape.
- **Cons.** `full=1` makes one endpoint serve two response shapes. Push runs from the browser, so
  it depends on the viewer's own network reaching the relay — a relay the *server* can reach but
  the browser cannot will fail confusingly.

### Option B — A server-side `POST /api/relay/sync` that converges both sides

One call: the server reads both sides, decides, and publishes in whichever direction is needed.

- **Pros.** One round trip; symmetric with the presence probe; independent of the browser's
  network; server-side tests could drive the whole convergence.
- **Cons.** **It requires a new capability: server-side publishing to external relays.** Every
  external publish in this codebase today is browser-side via `SimplePool` in `nostrPublish.js`,
  deliberately behind `isExternalPublishAllowed()`. Adding an outbound server write means
  re-implementing that gate server-side and creating a path by which the *instance* — not a signed-in
  user's browser — sprays events at public relays. That is a materially larger security surface
  than this story needs, and it is the surface the local-only policy exists to constrain.

### Option C — Use strfry's native negentropy sync (`strfry sync <relay> --dir both`)

The literal thing the story asks for, and the codebase already has operator tooling around it
(the retired `relay-management` epic's sync panel, `docs/TAG_FEDERATION_OPS.md`).

- **Pros.** One command converges both sides with a filter as narrow as
  `{"kinds":[10040],"authors":[<pk>]}`. It is the purpose-built primitive.
- **Cons.** **Negentropy (NIP-77) is not universally supported.** The three Tapestry instances run
  strfry and would work; general-purpose relays like `relay.damus.io`, `relay.primal.net` and
  `nos.lol` would need verification and most likely do not — so the mechanism would fail on much of
  the very relay set story 1 established. It is also a server-side outbound write, inheriting all
  of Option B's gate problem, and `--dir both` moves data in both directions at once rather than
  the single, labeled, user-chosen direction criterion 1 requires.

## Decision

We chose **Option A**.

The decisive argument is criterion 5. `publishToRelays` already implements the local-only gate
correctly and returns `skippedByGate` so "kept local" stays distinguishable from "failed"; Option A
reuses that, while B and C would both require re-implementing the gate on a brand-new server-side
outbound path. A feature this small should not introduce the instance's first server-initiated
publish to public relays.

Option C is the better *mechanism* wherever it works and is worth revisiting for the
Brainstorm-ecosystem relays specifically — recorded below as a follow-up rather than dismissed.

Sub-decisions:

- **`full=1` is opt-in and additive.** The default response keeps its narrow `{id, created_at}`
  shape so story 1's `A6` continues to pass unchanged. Any implementation that widens the default
  instead of adding the flag is wrong.
- **Direction is decided against *local's* copy, not the displayed one.** These coincide only when
  the Map was found locally. When `inLocal` is false the displayed event came from an external
  relay and local holds **nothing**, so the local side is `inLocal ? event : null`.
- **A divergent pair gets no action.** When two versions share a `created_at` but differ in `id`,
  neither is "more recent", so no honest direction label exists. NIP-01 resolves such a tie by
  lowest `id`, which means a push might silently no-op — an outcome the user could not predict from
  the button. The row reports the divergence and offers nothing; forcing a side is a separate
  feature with its own consent question.

## Consequences

- **Enables.** The panel stops being read-only: a missing or stale relay becomes a one-click fix.
- **No new server capability.** The server still never publishes outward on its own behalf; the
  only new server surface is one opt-in read parameter.
- **Verification is explicit, not inherited.** The pull path verifies through story 1's probe
  before the event reaches `strfry import`, so the feature no longer depends on the absence of a
  `--no-verify` flag two layers down.
- **Constrains.** Push depends on the *viewer's* browser reaching the relay, while the presence
  row was computed from the *server's* reachability. A relay the server can reach but the browser
  cannot will show "has it / missing" correctly and then fail on push. The failure is legible
  (criterion 2), but the asymmetry is real and should be named in the failure copy.
- **The local-only gate is read once per page load** (`isExternalPublishAllowed` caches at module
  scope) and **fails open**. An operator who flips the policy mid-session sees the change after a
  reload. Inherited behavior, not introduced here.
- **Follow-ups.**
  1. Negentropy sync (Option C) for relays that support NIP-77 — most valuably the Tapestry
     instances, which run strfry. Would need the Option B gate work first.
  2. If push-from-browser proves unreliable in practice, revisit Option B *with* a server-side
     gate as a deliberate, separately-reviewed capability.
- **Firmware reinstall required?** **No.** No concept definitions change.

## Implementation notes

**1. `ui/src/utils/treasureMap.js` — add `planRelaySync(localEvent, relayEvent)`**

Pure; the whole of criterion 1 in one testable function.

```
→ { direction: 'push' | 'pull' | null, reason: 'in-sync' | 'divergent' | 'nothing-to-sync' | null }
```

- `localEvent` null, `relayEvent` present → `pull`
- `localEvent` present, `relayEvent` null → `push`
- both null → `{ direction: null, reason: 'nothing-to-sync' }`
- both present, same `id` → `{ null, 'in-sync' }`
- both present, relay `created_at` older → `push`; newer → `pull`
- both present, equal `created_at`, different `id` → `{ null, 'divergent' }`

Reuse `compareMapVersions` for the ordering rather than re-deriving it.

**2. `src/api/relay/presence.js` — opt-in `full` parameter**

`GET /api/relay/presence?relay=…&pubkey=…&kind=…&full=1`. When `full` is truthy **and** the status
is `present`, return the complete verified event as `event` instead of the `{id, created_at}`
projection. Default (absent/falsy) behavior is **unchanged** — story 1's `A6` must keep passing.
The event returned is the one `probeRelayForEvent` already verified; do not add a second fetch.

**3. `ui/src/pages/grapevine/TreasureMapRelayPresence.jsx`**

- Extract the existing per-relay fetch from the fan-out worker into a `probeOne(url)` helper so the
  initial pass and the post-sync re-check share one path. The fan-out shape from ADR 0001
  (bounded workers, per-row state, no settled batch) is unchanged.
- Compute the local side once: `const localEvent = inLocal ? event : null;`
- Per row, call `planRelaySync(localEvent, row.event)`. Render a button only when `direction` is
  non-null, labeled by direction (e.g. *Send my version* / *Get the newer version*). For
  `reason: 'divergent'`, render no button and say the two cannot be ordered.
- **Push:** `publishToRelays(fullEvent, [url])`. `skippedByGate: true` in the result means the
  local-only policy suppressed it — surface that wording, not a failure. Gate the button's
  availability on `isExternalPublishAllowed()` so criterion 5 is visible *before* the click, not
  only after.
- **Pull:** fetch via `probeOne(url, { full: true })`, then `publishToLocalStrfry(fetched)`, then
  call a new `onMapReplaced` prop.
- Push needs the full local event — that is the `event` prop the page already passes; no fetch.
- Re-probe only the affected row after either direction. Per-row action state (`idle` / `syncing` /
  `failed`) lives beside the existing per-row presence state; a failure on one row must not touch
  another (criterion 2).

**4. `ui/src/pages/grapevine/TrustedAssertions.jsx`**

Pass `onMapReplaced={search}` to the panel. `search()` is the page's existing Map lookup and is
already used this way for `TlOptInCard`/`TreasureMapManualEdit` (`onPublished={search}`), so
criterion 3's "the page re-reads the Map" is one prop, not new machinery.

**5. No deletions — criterion 4**

Nothing in the above emits a deletion, and none should be added. A negative test pinning the
absence of kind-5 anywhere in this feature's paths belongs to Phase 3.

## Out of scope

- Bulk / "sync all" (story-level defer).
- Server-side outbound publishing (Option B) and negentropy sync (Option C) — both recorded as
  follow-ups.
- Forcing a direction on a divergent pair.
- Any change to the default `/api/relay/presence` response shape.
- Any change to the existing local-row **Import to local strfry** button. It stays as story 1 left
  it; `planRelaySync` governs only the relay rows.
