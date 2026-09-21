# ADR 0002: Publish assistant profiles to the configured relays, and report what each relay did

**Status:** Accepted
**Date:** 2026-09-12
**Story:** `engineering-team/stories/done/assistant-profile/2-publish-to-the-right-relays.md`

## Context

Publishing an assistant's profile writes it to the local relay, then to five relays named in code, and
reports success whatever they answer. The story asks for three things:

- send it to the relays the instance is configured for — general-purpose, profile and WoT — which is
  also the set the setup check reads (AC1, AC2);
- keep it local when local-only publish mode is on, and say so (AC3);
- report each relay truthfully within a bounded time, and send nothing outward if the local write
  fails (AC4, AC5).

### Codebase facts this design rests on (verified on `cde8b282`)

- **The publish path** — `handlePublishProfile` (`src/api/assistant/index.js:272-380`) does this:
  1. signs the kind 0;
  2. writes it locally with `importToLocalRelay` (`:341`, defined at `src/api/assistant/profileState.js:59-68`);
  3. updates the NIP-05 map (`:348-353`);
  4. publishes to `getAssistantPublishRelays()` in parallel (`:356-359`);
  5. answers `success: true` with "Tapestry Assistant profile published to strfry + N/5 external
     relays" (`:366-374`) — to Customers too.
- **The one list.** `getAssistantPublishRelays()` (`:34-42`) returns five literals. Story 1 made it the
  only list: the publisher calls it, and `handleAssistantStatus` passes it to the setup-check resolver
  (`:431-435`). ADR 0001 calls it "the seam story 2 replaces with configured relays".
- **The per-relay helper.** `publishToRelay` (`:48-80`, raw `ws`) has four faults:
  - it counts any `OK` whose flag isn't `false` as success;
  - it accepts an `OK` for any event id;
  - it reports a relay that never connects and one that connects but stays silent the same way, as
    `'timeout'`;
  - it waits out its full 10 s timer when a relay closes without answering.
- **A local write failure** throws to the outer `catch` (`:376-379`), which returns a 500 with the raw
  error. Nothing is sent outward, which is already correct, but the user isn't told that.
- **Relay settings.**
  - `aRelays` lives in `src/config/defaults.json:3-39`. `getSettings()` merges it with the overrides
    file (`src/config/settings.js:76-78`) and re-reads both files on every call.
  - The Relays settings page saves through `PUT /api/settings` (owner-only, `src/api/index.js:342`),
    which runs `validateRelayUrls` and then `updateOverrides` (`src/api/settings/settingsApi.js:97-113`).
    `GET /api/relays` serves the same object (`src/api/relays/index.js:13-17`).
  - The story's three categories are `aPopularGeneralPurposeRelays`, `aProfileRelays` and `aWotRelays`
    (`ui/src/pages/settings/RelaySettings.jsx:7-10`).
  - On local, staging and production today (`GET /api/relays`, 2026-09-12), they hold:
    - general-purpose: relay.damus.io, relay.primal.net, nos.lol;
    - profile: purplepag.es, profiles.nostr1.com;
    - WoT: wot.grapevine.network.

    These are the six the story lists.
- **Local-only mode** is `BRAINSTORM_PUBLISH_LOCAL_ONLY`. It is read from the environment first, then
  from `getConfigFromFile(…, 'false')`, and only the exact string `'true'` turns it on (ADR
  event-tagging/0002). The server reads it in two places with identical logic: inline in
  `handleGetPublishPolicy` (`src/api/publish-policy/index.js:28-31`), and in `isLocalOnly()` in
  `src/api/dlist-curation/index.js:198-204`.
- **The words already used for publish results:**
  - The browser's publish function (ADR honest-publish-reporting/0001) classifies each relay as
    `accepted | refused | unreachable | timeout`, with the reason the relay or the library gave.
  - `classifyBroadcast` (`src/lib/broadcastOutcome.js:33-39`) labels a whole result `published` (at
    least one relay accepted), `kept-local` (a deliberate setting, not a failure) or `not-delivered`
    (tried, and nothing accepted).
  - The dlist-curation server publish (ADR dlist-curation/0004, `src/api/dlist-curation/index.js:280-293`)
    writes locally first. If that fails, it answers 500 with `stage: 'local'` and does nothing else.
    In local-only mode it lists every relay as `skipped`.
- **Who reads the response.**
  - The editor (`ui/src/components/AssistantProfileEditor.jsx:170-190, 370-383`) reads `success`,
    `message`, `error`, `relays.success` and `relays.total`.
  - The legacy pages (`public/pages/nip85.html:214-227`, `public/pages/customers/customer.html:926-940`)
    read only `success`, `message` and `error`.
  - Nothing reads `relays.results`.
- **Tests that pin today's code:**
  - `test/assistant-setup-state.test.js` U11 (`:293-299`): `index.js` exports a non-empty
    `getAssistantPublishRelays()`.
  - The same file's S3 (`:389-394`): there is no `EXTERNAL_RELAYS`, and the body of
    `handlePublishProfile` calls `getAssistantPublishRelays(`.
  - `test/global-publish-gate.test.js:97-102` pins the exact source strings of the local-only read
    inside `src/api/publish-policy/index.js`.

### Concept-graph orientation

The local graph is empty (`{"count":0}`), so I oriented against staging:

- `/summaries` lists `39998:8e901369…:nostr-relay` ("nostr relay", with 12 elements and 13 sets).
- Its `/neighbors` returns the schema, the superset and the properties.
- The superset's own `/neighbors` answered HTTP 500, so the set names come from `firmware/` instead
  (AGENTS.md §2). Among them are `the-set-of-general-purpose-relays` (read today by
  `src/api/_shared/relaySource.js:23, 66-87`), `the-set-of-profile-relays` and
  `the-set-of-web-of-trust-relays`. **Re-verify those set handles against a populated graph** before
  relying on them.

This design reads and changes no concept, so **no firmware reinstall** is needed.

### Constraints

- No new dependencies or tooling (CLAUDE.md).
- Local-first (BIBLE §30): the local relay is written first, and nothing is sent outward if that fails.
- The publish set is where this instance sends its own events. That is deployment configuration, the
  same for every viewer, not a per-POV view.
- AC2 means the publisher and the setup check must never be given different relay lists.

## Options considered

### Option A — Read the publish set from relay settings

The set is the union of the three `aRelays` lists, read through `getSettings()` at publish time. One new
module owns the set, the per-relay publish and the summary. `getAssistantPublishRelays()` stays the only
list the publisher and the setup check share.

- **Pros.**
  - Meets AC1 as written. The operator changes the lists on the Relays settings page and the next
    publish follows, with no code change and no restart, because `getSettings()` has no cache.
  - Meets AC2 by construction, as story 1 set it up.
  - Adds no dependency: `getSettings()` is a file read.
- **Cons.** The codebase keeps two definitions of "general-purpose relays": these settings (used by
  this path and the story-1 check) and the concept set (used by the feed, notes and event read paths).
  That split already exists; this doesn't widen it.

### Option B — Read the publish set from the concept graph's relay sets

Resolve `the-set-of-general-purpose-relays`, `the-set-of-profile-relays` and
`the-set-of-web-of-trust-relays` with Cypher, the way `relaySource.js` does.

- **Pros.** It uses the graph, and the feed and the publish would share one source.
- **Rejected.**
  - It fails AC1 as written, because the Relays settings page edits `aRelays`, not these sets.
  - Every publish, and every signed-in dashboard load that falls back to the relays, would depend on
    Neo4j.
  - An empty graph (a fresh instance, or the local stack) would fall back to a list in code, which is
    the defect this story removes.
  - The check would stop matching what `/api/relays` shows the operator.

## Decision

We chose **Option A**.

The story defines the publish set as the relay categories an operator edits on the Relays settings
page, and those lists are what `getSettings()` returns. Option B would move the source of truth to a
place the settings page doesn't edit, and would make publishing depend on the graph.

### Sub-decisions

1. **In local-only mode the publish set is empty, for publishing and for the setup check.**
   - `getAssistantPublishRelays()` returns `[]` while local-only mode is on.
   - The status handler passes that same function to the resolver, so the check then asks no outside
     relay either. AC2 holds literally — every relay the check consults is in the publish set, even
     when that set is empty — and a local-only box's dashboard never waits on relays.
   - The publish result lists the configured relays as `skipped`, as dlist-curation does, so the user
     sees where the profile would have gone.
2. **Use raw `ws` with one shared deadline, not nostr-tools.** Keep the existing `ws` helper and fix it,
   rather than switching to `Relay.connect` + `relay.publish` or to `SimplePool.publish`.
   - Every outcome stays visible in our own code: a TLS or DNS error before the socket opens, a close
     without an answer, a `NOTICE`, and an `OK` for our event id.
   - The library's result shapes have hidden an unreachable relay before (ADR
     honest-publish-reporting/0001, constraint 2).
   - Its per-relay timers (4.4 s to connect, then 4.4 s for the answer) would let one relay hold the
     request for about 9 s.
   - Instead, one deadline bounds the whole fan-out: **8 s**, measured from its start.
3. **Keep one reader for local-only mode.** Export `isPublishLocalOnly()` from
   `src/api/publish-policy/index.js`, where the flag already lives, and have `handleGetPublishPolicy`
   use it. The strings that `global-publish-gate.test.js:97-102` pins stay in that file. dlist-curation
   keeps its own copy for now.
4. **The response keeps its shape and stops overclaiming.**
   - `success`, `message`, `error`, `relays.total` and `relays.success` stay, so the legacy pages keep
     working.
   - `relays.success` now counts only relays that accepted the event.
   - The rows become `{ relay, status, reason }`; nothing reads the old rows.
   - New fields: `outcome` and `localOnly`, plus `stage: 'local'` when the local write fails.
5. **Use the browser's words for each relay.** Each relay's status is `accepted`, `refused`,
   `unreachable` or `timeout`, or `skipped` in local-only mode. The whole result is `published`,
   `kept-local` or `not-delivered`, from `classifyBroadcast`. The editor shows `refused` as "rejected",
   the story's word.

**What we trade away.** `success: true` now means "saved on this instance's relay", not "published".
A client that took it to mean "reached nostr" must read `outcome` instead. The only clients are the
editor, updated here, and the legacy pages, which show the message — and the message now says what
happened.

## Consequences

- **Enables:**
  - the operator decides where assistant profiles go from the Relays settings page;
  - profiles.nostr1.com starts receiving them (if it refuses writes, the report says so and gives its
    reason);
  - story 4's page can show the same per-relay result;
  - the setup check follows the settings and local-only mode without any change of its own.
- **Changes story 1's check, as AC2 requires.** Its relay fallback now asks the six configured relays
  instead of five, within the same 4 s budget. In local-only mode it asks none, so a local-only box
  whose local relay was wiped shows the setup prompt. That matches the "local answer stands" rule in
  epic decision 6.
- **A relay that doesn't answer delays the result by at most 8 s** after the local write. The local
  write keeps its own 10 s limit (`profileState.js:61`).
- **Debt and follow-ups:**
  - dlist-curation still has its own local-only reader and its own publisher. Moving both into shared
    code is the "later chore" its ADR 0004 names; this ADR adds nothing to that work.
  - ADR event-tagging/0002 says "no server external publish exists". That is out of date, since both
    this path and dlist-curation publish from the server. Worth a note when that ADR is next touched.
  - The legacy pages show only the summary line until story 5 retires them.
- **Firmware reinstall required?** **No.** No concept definitions change.

## Implementation notes

**New — `src/api/assistant/profilePublish.js`.** Dependencies are injectable the way `profileState.js`
does it (`options.deps?.X ?? options.X ?? realX`). Real helpers are loaded lazily inside their
functions, so the module loads in a bare checkout.

- `PUBLISH_BUDGET_MS = 8000`.
- `getConfiguredPublishRelays(options)` → `string[]`, with a `getSettings` dependency.
  - Reads `aRelays.aPopularGeneralPurposeRelays`, `aRelays.aProfileRelays` and `aRelays.aWotRelays`, in
    that order.
  - Skips a missing or non-array list and any entry that isn't a string, and trims each entry.
  - Keeps only `ws://` and `wss://` URLs (case-insensitive). The settings API already refuses anything
    else (`settingsApi.js:97-103`), so this only guards a hand-edited file.
  - Drops duplicates (compared lowercased, with one trailing `/` removed), keeping the first spelling.
  - May return `[]`.
- `getAssistantPublishRelays(options)` → `string[]`. It uses `options.localOnly` (a boolean the caller
  already read), or else the `isLocalOnly` dependency (default `isPublishLocalOnly`). In local-only mode
  it returns `[]`; otherwise it returns `getConfiguredPublishRelays(options)`.
- `publishToRelays(event, relays, options)` → `Promise<Row[]>`.
  - Returns one row per relay, in input order, and never rejects.
  - Takes `options.budgetMs` (default `PUBLISH_BUDGET_MS`) and a `WebSocket` dependency (default
    `require('ws')`).
  - One deadline, `now() + budgetMs`, is taken once and shared by every relay; all relays run in
    parallel.
  - For each relay, the first of these events settles it:

  | What happened | `status` | `reason` |
  |---|---|---|
  | `["OK", event.id, true, msg]` | `accepted` | `msg` (e.g. `duplicate: …`), or `''` |
  | `["OK", event.id, false, msg]` | `refused` | `msg`, or `'refused without a reason'` |
  | the constructor throws, or `error` or `close` fires before the socket opens | `unreachable` | the error's message (e.g. `certificate has expired`, `getaddrinfo ENOTFOUND …`), or `'connection closed'` |
  | the deadline passes before the socket opens | `unreachable` | `'connection timed out'` |
  | `close` after the socket opened, with no `OK` | `refused` if a `NOTICE` arrived, else `unreachable` | the `NOTICE` text, else `'closed the connection without answering'` |
  | the deadline passes after the socket opened, with no `OK` | `timeout` | the last `NOTICE` text if one arrived, else `''` |

  - An `OK` naming a different event id is ignored.
  - Once a relay settles: clear its timer, `terminate()` the socket (or `close()` it if `terminate` is
    missing), and ignore anything that arrives later.
- `publishSubject({ isOwnerTarget, isSelf, targetPubkey })` returns the words that name the assistant:
  - the owner's assistant (the instance TA) → `The Tapestry Assistant's profile`;
  - the caller's own assistant → `Your Tapestry Assistant's profile`;
  - someone else's (the owner publishing for a customer, possible only through the API) →
    `The profile of the Tapestry Assistant for npub…‹last 6 characters of their npub›`.
- `summarizePublish({ subject, rows, localOnly })` → `{ outcome, message, accepted }`.
  - `outcome = classifyBroadcast({ successes: <accepted relays>, skippedByGate: localOnly || <no relay attempted> })`.
  - The messages, where `n` is the number of relays tried and `a` the number that accepted:
    - `published`: "‹subject› was saved on this instance's relay and accepted by ‹a› of ‹n› relays."
      When `a < n`, add " ‹n − a› did not accept it; see below."
    - `not-delivered`: "‹subject› was saved on this instance's relay, but none of the ‹n› relays
      accepted it; see below."
    - `kept-local` in local-only mode: "‹subject› was saved on this instance's relay only: local-only
      publish mode is on, so it was not sent to any other relay."
    - `kept-local` with no relays configured: "‹subject› was saved on this instance's relay only: no
      general-purpose, profile or WoT relays are configured."
    - The local write failed (the handler returns this as `error`): "‹subject› could not be saved on
      this instance's relay (‹reason›), so it was not sent to any other relay."

**Changed — `src/api/publish-policy/index.js`.** Add and export `isPublishLocalOnly()`, containing
today's read (`:28-31`). `handleGetPublishPolicy` then answers
`allowExternalPublish: !isPublishLocalOnly()`.

**Changed — `src/api/assistant/index.js`.**

- Delete the literal list (`:34-42`), `publishToRelay` (`:44-80`) and the now-unused `ws` require
  (`:25`). Import the new module's functions, and keep exporting `getAssistantPublishRelays` (U11 and
  `profileState.js`'s lazy `require('./index')` both need it).
- Give the handler a dependency seam, the way dlist-curation does.
  - `createPublishProfileHandler(deps = {})` returns `async function handlePublishProfile(req, res)`.
  - The module exports `handlePublishProfile = createPublishProfileHandler()`, so the route
    (`src/api/index.js:536`) doesn't change.
  - The dependencies, each defaulting to today's call: `getAssistantKeys`, `getOwnerPubkey`,
    `getKind0DisplayName`, `buildDefaultProfileContent`, `importEvent` (`importToLocalRelay`),
    `updateNip05Mapping`, `isLocalOnly`, `getSettings`, `publishToRelays` and `now`.
- The handler's first steps (validate, authorize, keys, content, NIP-05, sign) don't change. After
  them:
  5. `await d.importEvent(signed)`. If it fails, answer **500** with
     `{ success: false, stage: 'local', error: <the local-failure message>, localOnly, relays: { total: 0, success: 0, results: [] } }`.
     Do not update NIP-05 and do not open any socket.
  6. Update the NIP-05 mapping, as today.
  7. Read `const localOnly = d.isLocalOnly()` and
     `const publishRelays = getAssistantPublishRelays({ localOnly, … })`. Keep that literal call in the
     handler's body, because S3 looks for it.
     - In local-only mode, the rows are the configured relays, each
       `{ relay, status: 'skipped', reason: 'local-only publish mode' }`, and no socket opens.
     - Otherwise, `rows = await d.publishToRelays(signed, publishRelays)`.
  8. Answer **200** with every existing field, plus `localOnly`, `outcome`,
     `relays: { total: rows.length, success: <accepted>, results: rows }` and the summary `message`.
     Log one line for the result, and one for each relay that did not accept.

**Changed — `ui/src/components/AssistantProfileEditor.jsx`** (`:170-190`, `:370-383`).

- `publish()` keeps `data.outcome`, `data.message` and `data.relays.results`. When `data.success` is
  false it shows `data.error` as it does today; that is now the local-failure message.
- The result block shows the summary, then one line per relay:
  - `‹relay› — accepted`;
  - `— rejected: ‹reason›`;
  - `— unreachable: ‹reason›`;
  - `— timed out` (plus the reason, if there is one);
  - `— skipped (local-only publish mode)`.
- Use the success style only when every relay tried accepted. Otherwise use a warning style that isn't
  an error, or an info style for `kept-local` — never plain success for a partial or empty result.
- Remove "Pushed to local strfry + X/Y external relays."

**Unchanged, deliberately:**

- `profileState.js`: the status handler already passes `getAssistantPublishRelays`, so the check
  follows the new list;
- the legacy pages: their `success` / `message` / `error` contract still holds;
- dlist-curation;
- `ui/src/utils/nostrPublish.js`.

**Testability note for Phase 3 (not a test plan).**

- **The relay lists** are pure once `getSettings` and `isLocalOnly` are injected. Tests can cover order,
  de-duplication (by case and by trailing slash), dropping non-URL entries, empty lists, and local-only
  returning `[]`.
- **"No code change, no restart"** can be pinned for real:
  1. point `TAPESTRY_SETTINGS_PATH` at a temp file before loading `src/config/settings.js`, which reads
     the variable when it loads (`:16-17`);
  2. rewrite the file between two calls.
- **`publishToRelays`** runs stack-free against local `ws` servers on 127.0.0.1, port 0, as story 1's
  U12 does.
  - Server behaviours to cover: accept; refuse with a reason; never answer; close without answering;
    send a `NOTICE`, then close; send an `OK` for another id; a dead port.
  - A `WebSocket` double that emits a TLS error before opening covers the expired certificate.
  - For AC5: one silent relay beside an accepting one must settle within the budget plus some slack,
    with the accepting one `accepted`.
- **The handler**, through its seam:
  - a failing `importEvent` → 500 with `stage: 'local'`, and `publishToRelays` is never called;
  - local-only → `publishToRelays` is never called, and every configured relay is `skipped`;
  - the subject is right for the owner, for a customer publishing their own, and for the owner
    publishing for a customer;
  - `relays.success` equals the number of `accepted` rows.
- **Existing tests:**
  - S3 keeps passing. Its `functionBody` helper (`test/assistant-setup-state.test.js:117-123`) finds the
    first `function handlePublishProfile(` anywhere in the source, then reads up to the next declaration
    that starts at column 0. So the check holds as long as the inner function stays a named
    `function handlePublishProfile` that calls `getAssistantPublishRelays(`, and a top-level declaration
    follows the factory.
  - U11 must not depend on the caller's environment. With `BRAINSTORM_PUBLISH_LOCAL_ONLY=true` exported
    in a shell it would get `[]`, so Phase 3 should give it an injected setting or clear the variable.

## Out of scope

- Which relays belong in the default lists, and replacing dead or broken ones — OPEN.md #270.
- A kind 10002 relay list for assistants (epic, Deferred), and retrying failed relays later.
- The browser-side publish function (honest-publish-reporting).
- "Surprise me", the generic sign-as-assistant path for kind 0, and what the legacy pages display —
  story 5.
- The default profile (story 3) and the My Assistant page (story 4).
- Moving dlist-curation onto the shared reader or a shared publisher.
