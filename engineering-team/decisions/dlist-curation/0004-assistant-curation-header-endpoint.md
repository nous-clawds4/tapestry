# ADR 0004: The assistant curation-header endpoint — a dependency-injected server module that fetches, composes, signs, and publishes without touching the graph

**Status:** Accepted
**Date:** 2026-09-10
**Story:** `engineering-team/stories/dlist-curation/4-assistant-curation-header-endpoint.md`

## Context

The story's acceptance criteria, in short: **AC-1** signature-verified session; the caller's own
assistant signs, never the owner's TA; no assistant → 4xx. **AC-2** input is a community header
a-tag; malformed → 400; kind ≠ 39998 → 400; target authored by the caller or their assistant → 400.
**AC-3** the server fetches the target from the community relay group and local strfry and accepts
only a self-declared shared concept; not found → 404; the body never supplies content. **AC-4** the
header: kind 39998, signed by the caller's assistant, same `d`, `names`/`slug`/`json` verbatim,
exactly one `b` `["b", <target>, "inherit-items"]`, nothing that points into the community author's
namespace, empty content, fresh `created_at`. **AC-5** idempotent / never-clobber: exact `b` →
existing; different target or type → 409 with the existing `b`; no `b` → append and re-sign.
**AC-6** local strfry, then each `aDListRelays` relay under the publish-policy gate, per-destination
outcomes reported truthfully. **AC-7** no Neo4j write, no brain-writing publish path. **AC-8** the
response carries the signed header, `existing`, and the outcomes. **AC-9** local failure stops
everything; relay failure after local success is success-with-failures.

**The seams that exist** (all read this session):

- **Session guard.** `requireAuth(req, res)` in `src/api/trustedList/index.js:186-199` — returns
  the pubkey or sends 401; requires `session.authenticated === true` (only the signed challenge
  sets it, `auth.js:157`) and a 64-hex `session.pubkey`. Exported (`:487`).
- **Per-user assistant keys.** `getAssistantKeys(pubkey)` in `src/utils/assistantKeys.js:20-26` —
  owner → `getOwnerAssistantKeys()`, anyone else → `getCustomerRelayKeys(pubkey)`, which returns
  `null` when no keys exist (`customerRelayKeys.js:179`). Returns `{privkey, pubkey, npub, nsec}`.
- **Signing with an arbitrary key.** `src/api/normalize/helpers.js` `signAndFinalize` is bound to
  the owner's TA key at module level (`loadTAKey`, `:27-49`); it cannot sign as a customer's
  assistant. The primitive underneath is nostr-tools' `finalizeEvent(template, privBytes)`, required
  at the container path `/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools`
  (`helpers.js:12`, `fetchEvents.js:10`).
- **Fetching from relays server-side.** `src/api/relay/fetchEvents.js` installs `ws` as
  `globalThis.WebSocket` and uses `SimplePool.querySync(relays, filter)` (`:14-49`) — inside an HTTP
  handler, not exported as a function.
- **Local strfry.** Read: `src/api/strfry/queries/scan.js` spawns `strfry scan <filter>` and
  streams stdout (`:42-70`) — handler-only, not exported as a function. Write: `publishToStrfry(event)`
  in `src/api/trustedList/index.js:73-105` — `strfry import --no-verify` over stdin, 5 s timeout,
  settled-once (ADR tag-stack-merge-hardening/0001 B4b) — **not exported** today.
- **The brain-write hook** lives only in the HTTP handler `POST /api/strfry/publish`
  (`src/api/strfry/commands/publishEvent.js:95`, `maybeBrainWriteTapestry`); a direct `strfry import`
  never reaches it, and the hook fires only for tapestry letters anyway.
- **Publish policy.** `src/api/publish-policy/index.js` — `process.env.BRAINSTORM_PUBLISH_LOCAL_ONLY`
  first, else `getConfigFromFile('BRAINSTORM_PUBLISH_LOCAL_ONLY', 'false')`; only the exact string
  `'true'` engages local-only. Handler-only; the rule is four lines.
- **Relay group.** `getSettings().aRelays.aDListRelays` (`src/config/settings.js`;
  `src/api/relays/index.js:15-16`); default `["wss://dcosl.brainstorm.world"]`.
- **Self-declaration.** `src/lib/bValueForms.js` `dispositionOf(bValues, selfCoord)` returns
  `{selfDeclared}` when a `b` value equals the header's own coordinate; `A_TAG_RE` validates a-tags.
  Zero-require, pure.
- **Body parsing.** `express.json({ limit: '100mb' })` is global (`bin/control-panel.js:121`).
- **Route registration pattern.** A module exports `register(app)`; `src/api/index.js` calls it
  (`:564-565` for trustedList).
- **The router.** `setup/router-presets.json` `dcosl`: kinds 9998/9999/39998/39999, `dir: both`, to
  `wss://dcosl.brainstorm.world` and `wss://dcosl.brainstorm.social/relay` — when the stream is
  enabled, a locally-imported header propagates anyway; the direct send is what makes the outcome
  reportable.
- **Community headers on the wire** (fetched this session): tags `d`, `names` (singular, plural),
  `slug`, `concept-graph` (the author's own `39999:<author>:<d>-concept-graph`), `json`
  (`{word:{…}, conceptHeader:{description,…}}`), and `["b", <own coordinate>, "pointer"]`; empty
  content. BIBLE §5's `concept-graph` rule: tag-if-present, else compute the same a-tag — so a header
  without the tag still resolves to its author's own coordinate.

**The two rules that shape everything:** the hosting instance's Neo4j is never written for another
user's header (epic § "Settled at kickoff"; the owner treated the same in v1), and the
`inherit-items` `b` is the only pointer the header carries (ADR 0003; a `pointer` `b` for affiliation
is the later curation feature's call).

**Concept orientation.** `39998:<TA>:shared-concept` and `39998:<TA>:tapestry-assistant` carry the
standard scaffolding; no definition changes.

## Options considered

### Option A — A new dependency-injected module; direct relay send with per-relay settlement; strfry import for local (chosen)

`src/api/dlist-curation/index.js`: a factory `createAuthorCurationHeaderHandler(deps)` returning
the Express handler, with every side effect injected (auth, keys, relay fetch, local scan, local
import, relay publish, publish policy, relay group, signer, clock); `register(app)` mounts it at
`POST /api/dlist-curation/header` with the real deps.

- **Pros.** The handler's branch logic (AC-1..AC-9) is testable in Node with fake `req`/`res` and
  stubbed deps — the pattern `refreshPinnedTags.js` already uses (`deps.publishTL`, `:319`).
  Local write via `strfry import` bypasses the HTTP publish handler and therefore the brain-write
  hook by construction (AC-7). Direct `SimplePool.publish` with `Promise.allSettled` over the
  per-relay promises gives an honest per-destination verdict (AC-6) — the exact fix row 200
  prescribes for the client-side primitive, applied here from the start. No new dependency:
  nostr-tools and `ws` are already required at the same container paths.
- **Cons.** One shipped module gains one export (`publishToStrfry`); two small helpers
  (`scanLocal`, `publishToRelays`) are new code rather than reuse, because the existing ones are
  handler-bound.

### Option B — Compose server-side, then publish through `POST /api/strfry/publish` internally

- **Pros.** Reuses the existing publish handler's validation and logging.
- **Cons.** An HTTP self-call from inside the server; the handler's `signAs` semantics are built
  for the owner/client cases; and it is the one path that carries the brain-write hook — AC-7 would
  rest on the hook's filter rather than on construction. Rejected.

### Option C — Local import only; let the router's `dcosl` stream carry the header

- **Pros.** Least code; the router already mirrors kind 39998 both ways.
- **Cons.** AC-6 asks for each destination's actual outcome, and the router reports nothing to the
  caller; the stream may be disabled on a given instance; and the story-5 panel needs to know
  whether the relay named in the Map's hint actually holds the header. Rejected as the *only*
  mechanism; kept as belt-and-braces.

### Option D — Client composes the header; the server only signs

- **Pros.** Thin server.
- **Cons.** AC-3 requires the server to fetch and verify the target itself (never trust
  client-supplied content), and AC-5's never-clobber needs the local scan — both server-side
  anyway. Rejected.

### Sub-decisions

1. **Fetch order:** the community relay group first (the source the panel offers; newest
   `created_at` wins across relays), local strfry second (a mirrored copy is as good). Same filter
   both places: `{kinds:[39998], authors:[<pk>], '#d':[<d>]}`.
2. **What is copied:** `names`, `slug`, `json` verbatim (`slug` synthesized as `['slug', d]` when
   absent). **Omitted:** `concept-graph` (readers compute the assistant's own coordinate when the tag
   is absent, BIBLE §5 — copying would name the community author's graph), every `b` of the
   community header, and any other tag. `content` empty.
3. **`created_at`:** `now`, except case (c) where it is `max(now, existing.created_at + 1)` (the
   replaceable-event skew rule ADR tl-treasure-map/0001 applied).
4. **409 payload:** `{ success:false, error, existing: { b: [<all b tags>], event } }` — the panel
   surfaces the pointer(s) verbatim.
5. **Publish policy:** the same four-line rule as `publish-policy/index.js`, injected as
   `isLocalOnly()`; when local-only every relay row is `{url, status:'skipped', reason:'local-only'}`.

## Decision

We chose **Option A** with the sub-decisions above. Normative behavior of
`POST /api/dlist-curation/header`, body `{ "target": "39998:<pubkey>:<d-tag>" }`:

1. `requireAuth` (401) → `getAssistantKeys(sessionPubkey)`; `null` → 400
   `"no Tapestry Assistant is provisioned for this account"`. The owner's TA is reached only when
   the session *is* the owner — `getAssistantKeys` already encodes that; the module never calls
   `getOwnerAssistantKeys` itself.
2. Parse `target` with `A_TAG_RE`; malformed → 400; kind ≠ 39998 → 400
   `"only kind-39998 community headers are supported (39999-declared headers: not yet)"`; target
   pubkey ∈ {session pubkey, assistant pubkey} → 400 `"cannot curate your own header"`.
3. Fetch the target (sub-decision 1); none → 404. `dispositionOf(bValues, target).selfDeclared`
   must be true → else 400 `"not a self-declared shared concept"`.
4. Scan local strfry for `{kinds:[39998], authors:[assistant], '#d':[d]}`:
   (a) exists and carries `["b", target, "inherit-items"]` → 200 `{success:true, existing:true,
   header:<existing>, published:null}`; (b) exists and carries any other `b` (different target, or
   same target with a different type) → 409 (sub-decision 4); (c) exists with no `b` → template =
   existing tags + the contract `b`, `content` preserved, `created_at` per sub-decision 3;
   (d) absent → template per AC-4 and sub-decision 2.
5. Sign with `finalizeEvent(template, hexToBytes(keys.privkey))`.
6. `publishToStrfry(signed)` — failure → 500 `{success:false, error, stage:'local'}`, nothing else
   attempted.
7. Relays: `getSettings().aRelays.aDListRelays` filtered to `wss://`/`ws://`; if `isLocalOnly()`
   every row is `skipped`; else `SimplePool.publish([url], signed)` per relay, each raced against a
   5 s timeout, settled with `Promise.allSettled` → rows `{url, status:'ok'|'failed', error?}`.
8. Respond 200 `{success:true, existing:false, header:<signed>, published:{local:'ok', relays:[…]}}`
   — `success` is true whenever local succeeded (AC-9); relay failures are in the rows.

The module requires nothing from `src/api/neo4j/`, `src/lib/neo4j-driver`, or the firmware
installer; it cannot write the graph (AC-7 by construction, pinned by a source sentinel).

## Consequences

- **Enables** story 5: the panel calls this, reads `header.pubkey` (the assistant), composes
  `["39998:<d>", <assistant>, aDListRelays[0]]`, and has the user sign the Map; on 409 it shows
  `existing.b`.
- **Constrains.** The response shape is a contract the panel and its tests pin. The endpoint publishes
  to the community relay under a user's assistant key — the same posture as the TL publisher, gated
  by the same policy.
- **One shipped module touched:** `src/api/trustedList/index.js` gains `publishToStrfry` in its
  exports (one line; no behavior change).
- **Debt / follow-ups.** `scanLocal` and `publishToRelays` are the second implementations of things
  the HTTP handlers do inline; a later chore may lift both to `src/lib/`. The router-only fallback
  when all direct sends fail is honest (rows say `failed`) but the panel should say "the router may
  still carry it".
- **Firmware reinstall required?** **No.**

## Implementation notes

1. **`src/api/dlist-curation/index.js`** (new):
   - `const NOSTR_TOOLS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools'`,
     `WS_PATH` as in `fetchEvents.js:10-16` (lazy-required; install `globalThis.WebSocket` once).
   - `parseATag(s)` → `{kind, pubkey, d}` or null (via `A_TAG_RE` from `src/lib/bValueForms.js`; split
     at the first two colons only — the d-tag may contain colons).
   - `composeCurationHeader(community, target, existing)` — **pure**, exported: returns the unsigned
     template per Decision §4(c)/(d) and sub-decisions 2–3; `existing` null or an event.
   - `classifyExisting(existing, target)` — **pure**, exported: `'none' | 'exact' | 'conflict' |
     'unpointed'` from the existing event's `b` tags (`exact` = a `b` with value `target` and type
     `inherit-items`; `conflict` = any other `b`; `unpointed` = no `b`).
   - `scanLocal(filter)` — spawn `strfry scan JSON.stringify(filter)`, parse stdout lines, 10 s
     timeout, resolve `[]` on empty; `fetchFromRelays(filter, urls)` — `SimplePool.querySync` with an
     8 s race, newest `created_at` first; `publishToRelays(event, urls)` — per-relay
     `Promise.race([pool.publish([url], event)[0], timeout(5000)])` inside `Promise.allSettled`.
   - `createAuthorCurationHeaderHandler(deps)` with defaults wired to the real helpers; deps:
     `{requireAuth, getAssistantKeys, fetchFromRelays, scanLocal, publishLocal, publishToRelays,
     isLocalOnly, getDListRelays, sign, now}`.
   - `register(app)` → `app.post('/api/dlist-curation/header', handler)`.
2. **`src/api/trustedList/index.js:483-489`** — add `publishToStrfry` to `module.exports`.
3. **`src/api/index.js`** — next to the trustedList registration (`:564-565`):
   `require('./dlist-curation').register(app)`.
4. **No UI, no Neo4j, no firmware, no docs beyond the story's Linked artifacts.**
5. **Phase 3 guidance (the Tester's lane).** House three-class pattern, suite e.g.
   `test/dlist-curation-header-endpoint.test.js`: **U** — `composeCurationHeader` (copies `names`,
   `slug`, `json`; synthesizes `slug`; omits `concept-graph` and every community `b`; exactly one
   `b` of type `inherit-items`; empty content; case (c) preserves tags and bumps `created_at`) and
   `classifyExisting` (all four outcomes, including same-target-different-type = conflict);
   handler-level tests via the factory with fake `req`/`res`: 401 path; no-keys → 400; malformed /
   kind 39999 / own-header → 400; fetch miss → 404; not self-declared → 400; cases (a)/(b)/(c)/(d)
   with the exact response shapes; local failure → 500 with nothing else called; local-only →
   every relay row skipped and `publishToRelays` never called; relay rejection → `failed` row with
   the message and `success:true`. **S** — the module requires nothing from `src/api/neo4j`,
   `src/lib/neo4j-driver`, or `src/firmware`; the route is registered; trustedList's export line;
   no 64-hex literal. **R** — trustedList's other exports and `/api/strfry/publish`'s handler
   untouched. A live suite against the stack is optional; if written it must SKIP with a reason
   (not FAIL) unless the deployment is local-only — the posture OPEN.md row 191 asks for — since it
   would publish a real header under the dev assistant's key.

## Out of scope

- The Map update, revocation, the panel, Map Entries (stories 5–6).
- Importing the header into any graph; the `inherit-items` derivation/resolver (intake 2026-09-10).
- A pointer `b` for affiliation; 39999-declared headers; header deletion or re-pointing.
- Lifting `scanLocal` / `publishToRelays` into shared libraries (a later chore).
