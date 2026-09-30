# ADR 0004: The tagging pipeline panel: a plain-JS view model over the public reads, and one gated count

**Status:** Accepted
**Date:** 2026-09-30
**Story:** `engineering-team/stories/tagging-edges/4-tagging-pipeline-panel.md`

## Context

Story 4 adds a read-only panel for the tagging pipeline: a Settings › Relays sub-tab, "Tagging pipeline", directly
after ⚡ Streaming ETL, seen by the owner and admins. Its six criteria:
- **AC-1:** the placement, and that the panel changes nothing.
- **AC-2:** the pass: judged running by liveness, the latest and earlier passes, the held list, the confirmation's
  state, the backstop schedule.
- **AC-3:** the path: liveness first, its warnings, its counts and gauges, its last catch-up, its problems.
- **AC-4:** drift between the relay and the graph, explained against the newest finished pass. It is counted on
  opening and on request, only for a signed-in owner or admin; past 10 s a count reads "unknown", never 0; counting
  reads only.
- **AC-5:** a refresh within 10 s, a text for every state, colours from tokens only, and copy with no emoji.
- **AC-6:** nothing else moves.

The story also carries story 3's open carry-forwards. C5 and C7 are the Architect's. This ADR also does the ADR 0003
parts of C1 and C3 (with C2's ADR half), so every change to ADR 0003's text is made in one place (§ Amendments to
ADR 0003).

**The concepts.** The panel counts the elements of `nostr-user-tag` (canonical
`39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user-tag`, and this deployment's
`39998:<TA>:nostr-user-tag`; oriented by `/api/concept-graph/node/…/neighbors` on the local graph) and the graph's
`TAGS` relationships. It changes no concept, schema or firmware.

**What exists** (read at `66d60cb5`; line numbers there).

- **The reads the panel needs are public GETs.** `GET /api/tagging-edges/status` and `/held`
  (`src/api/index.js:521-522`), `GET /api/tagging-edges/realtime/status` (`:530`) and `GET /api/scheduled-tasks/list`
  (`:486`).
  - Two of them answer with no `success` key. The status route answers `{reportVersion, running, latest, previous,
    confirmationPending}` (`src/api/tagging-edges/index.js:104-118`, `:177`), and the realtime route the answer from
    `computeRealtimeStatus` (`realtime.js:85-108`, `:160`).
  - So Streaming ETL's `if (data.success)` pattern (`ui/src/pages/settings/RelaySettings.jsx:1323-1325`) would read
    every good answer as a failure.
- **What the status carries while a pass runs.**
  - The status's `latest` is the pass's pessimistic first record: outcome `failed`, reason code `stopped`, every count
    0 (`src/pipeline/tagging-edges/reconcileTaggingEdges.js:126-150`). The previous latest moves to `previous[0]`
    (`:219-228`).
  - `running` comes from liveness only (`index.js:101-118`), and `/held` then serves an empty list (`:210-213`).
- **What the realtime status carries.**
  - Its `state` is forced to `off` when the switch is off. When the switch is on, the stored state passes through
    whether or not the process lives, so a path killed with no final write reads `running: false, state: 'live'`
    (`realtime.js:89-100`).
  - `stale` is computed only while the path runs (`:106`; 60 s, `:26`).
  - Before the first start every pass-through field is `null` (`:101`).
  - `counts` are cumulative since the first start, or since `countsReset` (`realtime/index.js:2248-2250`). `parked`
    and `pending` are gauges outside `counts` (`:578-581`).
- **There is no strict relay count.**
  - `GET /api/strfry/scan/count` (`src/api/strfry/queries/scanCount.js:17-28`) has no time-out, answers 200 on an
    error, and reads unparseable output as 0. The sibling helpers (`scan.js:28-42`, `dlists/itemCounts.js:103-116`)
    share at least one of those flaws.
  - `scanStrict` (`src/lib/strfryScanStrict.js:111`) spawns `strfry scan <filter>` with a SIGKILL timer and strict
    exit checks, but has no count mode, and demands an event on every line.
  - `strfry scan --count` prints one number and exits 0; its stderr is never empty (loguru lines, the Redis connect),
    so stderr is no failure signal. A Redis that accepts no connection stalls every strfry command until killed
    (OPERATIONS §12.9).
- **There is no `TAGS` count.**
  - `graph.js`'s statements (`src/pipeline/tagging-edges/graph.js:29-52`) have none.
  - The shared `runCypher(cypher, params, txConfig)` (`src/lib/neo4j-driver.js:55-70`) passes a server-side
    `{ timeout }`. Connection acquisition still waits up to 30 s, so a hard 10 s bound needs a client-side timer too.
  - `TAGS` has no writer outside the tagging-edges code (`git grep -nw TAGS -- src bin setup`), so the count is the
    tagging relationships.
- **The gates.**
  - `adminApi.requireOwnerOrAdmin` (`src/api/admin/index.js:122-135`) gives 401 with no `session.pubkey`, 403
    otherwise, and ignores `session.authenticated` and `localTrusted`. Its one user is BullBoard (`src/api/index.js:546`).
  - The tagging owner routes add a handler re-check (`index.js:234-244`), including `authenticated === true` and
    `sameHost` (`:147-155`).
  - The auth middleware lets every signed-out GET through unless its path holds one of five substrings
    (`src/middleware/auth.js:497-512`), so any gate on a new GET is the route's own.
- **The UI.**
  - `RELAY_TABS` (`RelaySettings.jsx:2058-2064`) sets the sub-tabs, which live in local state (`:2071`).
  - Settings mounts only for classification `owner` or `admin` (`ui/src/pages/settings/Index.jsx:35`, `:121-133`).
  - The status tokens are `--green`, `--orange`, `--red`, `--text`, `--text-muted`, `--border`, `--bg-secondary` and
    `--bg-tertiary` (`ui/src/styles.css:6-26`). No success, warning or danger token exists. The neighbouring panels
    use hex literals and emoji throughout.
  - The house pattern for view logic the Node gate can test is a plain ESM `.js` under `ui/src/utils/`, loaded by
    `import()` (`ui/src/utils/nextTaskCountdown.js`; `test/next-task-countdown.test.js:49-66`).

**The architecture invariants.**
- **Principles 1–3.** The panel shows one instance's pipeline figures. A `TAGS` relationship exists for every tagging
  the definition accepts, whoever wrote it, and which taggings count for a point of view stays a read-time question.
  The panel stores nothing, ranks nothing and filters by no trust.
- **Principle 4.** The panel only reads, so it destroys nothing.

## Options considered

### Option A: a plain-JS view model in the browser over the public reads, plus one gated count route (chosen)

- **The logic.** Every derivation the criteria name lives in one plain ESM module under `ui/src/utils/`:
  - liveness first;
  - the newest finished pass;
  - the drift arithmetic;
  - the schedule's verdict;
  - "not yet available" against 0;
  - the code-to-sentence table and its "not recognised" fallback.
- **The panel** is a thin React file that fetches the public reads and renders what that module returns.
- **The server** gains one route: the drift count, gated to a signed-in owner or admin, with a strict relay count and a
  bounded graph count.

**For:**
- It follows the house pattern for testable UI logic.
- It changes no existing route.
- It keeps the public reads public, as the story requires.
- It adds the least server surface.

**Against:**
- The code lists the panel explains are duplicated in the UI. A guard test must keep them in step with their
  producers (§ Implementation notes).

### Option B: a server-side panel route that assembles and explains everything

A new owner-or-admin `GET` reads the report, the realtime status, the schedule list and the counts, and returns the
panel's finished view model, sentences included. The panel only renders it.

**For:**
- One request.
- The code lists sit beside their producers.
- The whole view model is testable with the house route-test fakes.

**Against:**
- It duplicates three public reads behind a gate.
- It either counts on every poll (the story counts drift only on opening and on request) or splits into two routes
  anyway.
- It puts user-facing copy in the server, where the language guardrails have no reviewer.
- It makes the panel all-or-nothing: AC-5 wants each section to fail on its own, and a single route fails whole.

### Option C: browser only, over existing routes

The panel counts drift with the public `GET /api/strfry/scan/count` and a read-only Cypher through
`POST /api/neo4j/query`, and adds no route.

**Rejected:**
- `scan/count` reads an unparseable answer as 0 and has no time-out, which breaks "unknown, never 0" and the 10 s
  bound.
- Both routes are public, so the owner's decision that only an owner or admin may ask for a count could not hold.

### Sub-decisions inside Option A

- **The relay count.**
  - (a) A `countStrict` beside `scanStrict` in `src/lib/strfryScanStrict.js` (chosen). It reuses the module-level
    pieces and repeats `scanStrict`'s closure rules, leaving `scanStrict` itself unchanged (§ Implementation notes).
  - (b) Reuse `scan/count` or `itemCounts`: rejected, for the flaws above.
  - (c) A full `scanStrict` and a count of the lines: rejected. It reads about 8 MB where one number will do, and it
    shares the pass's byte cap (ledger `2026-09-28-pass-relay-read-byte-cap`).
- **The graph count.**
  - (a) `runCypher` with `{ timeout: 10000 }`, raced against a 10 s client timer (chosen). The control panel already
    holds the shared driver, so this adds no config read.
  - (b) A new statement and driver through `openGraph`: rejected. It builds a driver per request or caches a second
    one, and `graph.js` is the pass's port, audited by SWR12–SWR19 for the pass's needs.
- **The gate.**
  - `adminApi.requireOwnerOrAdmin` at registration, and the handler's own re-check in the tagging routes' style. The
    re-check requires `authenticated === true`, an owner or admin pubkey, and `sameHost` (chosen).
  - The middleware alone would take `session.pubkey` without `authenticated` and leave no seam for tests. The re-check
    alone would break the house's two-layer pattern.
- **Where the panel's code lives.** A new folder `ui/src/pages/settings/taggingPipeline/` (the `scheduledTasks/`
  precedent), not more lines in the 2,216-line `RelaySettings.jsx`. Only there can AC-5's "no colour literal in the
  panel's source" be checked by scanning whole files.
- **Who owns the lists of codes.**
  - (a) The view module owns its sentence table, and a guard test cross-checks it against every code the producers can
    emit (chosen).
  - (b) Refactor the pass and the engine to export frozen code lists: rejected. It touches two shipped writers for a
    read-only panel. The engine's exports are deliberately three (`realtime/index.js:2489`), and the pass's reason
    codes are literals in about fifteen places.

## Decision

We chose **Option A**.
- It meets every criterion with one new server route and no change to an existing one.
- It keeps the public reads public.
- It puts every derivation the criteria name where the Node gate can test it without a React runner.

What we trade away: the code lists exist twice, which a guard test holds together.

## Consequences

- **What it enables.** Story 5's ADR can attach its controls to this panel, and reuse this ADR's owner-or-admin gate
  helper for them.
- **What it constrains.** A new outcome, reason code, path state, error stage or setup problem added to the pass or
  the path needs a sentence in the panel's table. The guard test fails until it has one. Until then the panel shows
  the code with "not recognised".
- **New surface.** One gated read route, and `countStrict` in the strict reader.
- **Debt.**
  - The panel's copy and colours follow the guardrails, and its neighbours do not. The difference is visible and was
    accepted at Planning.
  - A stalled Neo4j can hold a lost-race graph count's session for up to 30 s (§ Server, "Single flight").
- **Firmware reinstall required? No.** No concept, schema or firmware changes.

## Implementation notes

### Server

**`src/lib/strfryScanStrict.js`: `countStrict(filter, { timeoutMs = 10000, spawnImpl } = {})`**, exported beside the
existing four.
- **What it spawns.** `strfry scan --count <escapeFilterArgv(filter)>`.
- **Reuse.** It reuses the module-level pieces as they are: `filterArgvBytes` / `LIMITS`, `escapeFilterArgv`,
  `ScanError` and `summarizeStderr`.
- **Its own body.** It repeats `scanStrict`'s closure rules there: the SIGKILL timer, settle-once, and the `error`,
  signal and non-zero-exit checks.
- **`scanStrict` is not changed**, so the pass's reader and its suites are untouched.
- **Rejects with a `ScanError`**, with no other code; each passes `allowErrorCode`, `src/lib/tagging-edges/realtime.js:887-894`:
  - `filter-too-large`, before spawn, from the argv size check;
  - `spawn`, when spawn throws or the filter is not JSON;
  - `process-error`;
  - `timeout`, with SIGKILL at `timeoutMs`;
  - `exit`, on a non-zero exit;
  - `signal`;
  - `unparseable`, unless stdout is exactly `/^\d+\n$/` and the number is a safe integer.
- **Stderr** is summarised as `scanStrict` does, and is never a failure signal on its own: strfry always writes log
  lines and the Redis connect there.
- **Resolves** with a JS number.

**`src/api/tagging-edges/drift.js`** (new, the shape of `realtime.js`): `handleDriftCounts(req, res, deps)`, with the
pure halves `gateOwnerOrAdmin(req, d)` and `countFilter(identities)`.

- **Dependencies.** `defaultDeps()` loads everything lazily. `withDeps` merges test overrides, and a non-object third
  argument (Express's `next`) is ignored, as RR23 pins for the other routes.
  - **The owner** is read as `src/api/tagging-edges/index.js:45` reads it
    (`getConfigFromFile('BRAINSTORM_OWNER_PUBKEY')`).
  - **The admins** come from `getAdminPubkeys` (`src/utils/config.js:99-112`), compared as `isAdminPubkey` compares
    (`includes`, case-sensitive).
  - **The identities** come from `resolveIdentities` in the runner's nested shape (`identities.js:16-44`;
    `reconcileTaggingEdges.js:53-58`):
    `resolveIdentities({ identities: { canonicalZ: () => require('../profile-tags').NOSTR_USER_TAG_Z_TAG,
    getOwnerAssistantPubkey: () => require('../../utils/assistantKeys').getOwnerAssistantPubkey() }, env:
    process.env })`.
  - **The rest:** `countStrict`, `runCypher` (`src/lib/neo4j-driver.js`), `now`, `limitMs` (10000), and
    `setTimer`/`clearTimer` (setTimeout/clearTimeout).
  - `allowErrorCode` comes from `require('../../lib/tagging-edges/realtime')` and is never copied (SWR71).
- **The gate**, in order, before anything is counted:
  1. **No `session.pubkey`:** 401 `{ success: false, error: 'Not authenticated' }`. A loopback call gets the same;
     `localTrusted` is not admitted.
  2. **Not the owner or an admin:** 403 `{ success: false, error: 'Owner or admin access required' }`. That is when
     `session.authenticated !== true`, or when the pubkey is neither the owner's (lowercase 64-hex) nor in
     `getAdminPubkeys()`.
  3. **`!sameHost(req)`:** 403 `cross-site request refused`. On this GET, `sameHost` does these things:
     - It refuses a cross-origin CORS fetch. That fetch carries `Origin`, and the app's origin-reflecting CORS
       (`bin/control-panel.js:114-119`) would otherwise let a foreign page read the answer with the viewer's cookie.
     - It passes the panel's own same-origin GET, which carries no `Origin`, and a same-host `Origin`.
     - It also passes a no-cors cross-site GET, which carries no `Origin`. That GET can start at most one count
       (single flight), only reads, and cannot read the answer.

  A refused request spawns nothing, runs no Cypher and never joins a count.
- **The relay count.**
  - The filter is `{ kinds: [39999], '#z': [...new Set([stamp(canonical, 'nostr-user-tag'), stamp(local,
    'nostr-user-tag')])] }`, with `stamp` from `src/lib/tagging-edges/contract.js:72-74`. It is one count over both
    stamps, never two counts added.
  - The count is `countStrict(filter, { timeoutMs: d.limitMs })`.
  - An identity refusal answers `relay: { known: false, code: 'identity', identity: 'canonical' | 'local', takenAt,
    ms: 0 }`, with nothing spawned.
- **The graph count.**
  - The count is `runCypher('MATCH ()-[r:TAGS]->() RETURN count(r) AS n', {}, { timeout: d.limitMs })`.
  - An answer that is not exactly one row whose `n` is a non-negative safe integer is `unparseable`.
- **Both counts.**
  - They run in parallel, each raced against `d.limitMs` through `d.setTimer`, and each timer is cleared when its
    count settles.
  - A lost race is `timeout`. Every other failure is `allowErrorCode(err && err.code)`.
- **The answer** is 200, and a failed count is a known shape, never a 500:

  ```json
  { "success": true, "limitMs": 10000,
    "relay": { "known": true,  "count": 7027, "takenAt": "…", "ms": 212 },
    "graph": { "known": false, "code": "timeout", "takenAt": "…", "ms": 10000 },
    "stamps": { "canonical": "82b75e47", "local": "8e901369" } }
  ```

  - `count` is present only when `known` is true.
  - `takenAt` is the ISO time the count started, and `ms` how long it took to settle: at most `limitMs` for a lost
    race.
  - `stamps` holds each identity's 8-character prefix, or `null` for one that did not resolve. The pass report already
    shows these prefixes publicly.
  - All text is fixed. No host, path, message or credential is ever in the answer.
- **Single flight.** drift.js keeps one module-level `inflight` promise for the combined answer.
  - A request that passes the gate while that promise is pending joins it and gets the same answer, `takenAt`
    included.
  - The promise always resolves to the answer shape, since every failure inside becomes an unknown count. `inflight`
    is cleared in a `finally`.
  - Strfry processes never pile up, because a timed-out count is SIGKILLed at 10 s.
  - A Cypher whose race was lost keeps its session until the server's 10 s timeout, or for up to 30 s of connection
    acquisition. A later recount may then open another session from the pool of 20. This is accepted.
- **Registration** (`src/api/index.js`, beside `:521-522`):

  ```js
  const taggingEdgesDrift = require('./tagging-edges/drift');
  app.get('/api/tagging-edges/drift-counts', adminApi.requireOwnerOrAdmin, taggingEdgesDrift.handleDriftCounts);
  ```

  - The path holds none of the auth middleware's substrings (`auth.js:370-512`): `authenticatedEndpoints`,
    `customerOrOwnerEndpoints`, `ownerOnlyEndpoints`, `ownerOnlyGetEndpoints`, `protectedGetEndpoints`.
  - SWR11 and SWR67 stay green, because they match the existing literals exactly.
- **Reads only.**
  - `strfry scan` only connects to Redis and writes nothing: the patched `main.cpp.tt:103` only connects, and the only
    `RPUSH` is in the writer pipeline (`src/WriterPipeline.h:171`, used by `import`, `stream`, `sync` and `router`),
    which `scan` does not include.
  - The Cypher is `MATCH … RETURN`.

### UI

**`ui/src/utils/taggingPipelineView.js`** (new).
- **Form.** Plain ESM, with `.js`-suffixed relative imports, no JSX, no React and no alias, following
  `nextTaskCountdown.js`. It uses only Node 16 syntax and built-ins, so the host gate can import it: no `findLast`,
  no `toSorted`.
- **Clock.** Its derivations never read a clock.
- **Tones.** It returns tones as `ok` | `warn` | `bad` | `neutral`, never colour words.

Its named exports:

- **`POLL_MS`** (5000) and **`SCHEDULE_POLL_MS`** (60000). The JSX uses them by name.
- **`EXPLANATIONS`**, a frozen map `{ [kind]: { [code]: sentence } }`, looked up by own property only
  (`Object.prototype.hasOwnProperty.call`). It has one kind per list:
  - `passOutcome`, `passReason`, `failureStage`, `failureRead`;
  - `refusedReason`, `heldReason`, `leftInPlaceReason`, `changeKind`;
  - `confirmationWhy`;
  - `pathState`, `setupProblem`, `lastErrorStage`, `catchUpOutcome`, `catchUpStage`, `notEstablishedReason`;
  - `countCode`, `fetchCode`.
- **`FAMILIES`**, a frozen list of `{ kind, test: RegExp, sentence }` for the open code families, checked after the
  exact map:
  - `^http-\d{3}$` (fetchCode);
  - `^E[A-Z0-9_]+$` and `^Neo\.(ClientError|TransientError|DatabaseError)\.[A-Za-z]+\.[A-Za-z]+$`, plus
    `ServiceUnavailable` and `SessionExpired` (countCode, and a `lastError`'s code);
  - `^held-file-unreadable ` and `^claim failed: ` (confirmationWhy, with the rest shown as the code).

  The Implementer writes one sentence per code the guard test lists, from each code's producer (§ Seams), following
  `product-team/guardrails/language.md`:
  - a sentence never repeats its code;
  - it never says "an error occurred" without saying what to do;
  - it has no `!` and no emoji.
- **`explain(kind, code)`** returns `{ code, text, recognised }`, with `code` exactly as given. An unknown code gives
  `recognised: false` and the text `not recognised`.
- **`passView(statusBody)`** returns `{ running, current, latest, earlier[], empty, confirmation }`.
  - `running` is `statusBody.running` and nothing else.
  - While running, `latest` is `null`, and `current` is `{ runId, startedAt, phases, finishing }`, where `finishing` is
    true when the record already has an `endedAt`. The stored pessimistic record is never shown as a result.
  - `earlier` is the report's other entries, newest first.
  - `empty` is true only when `statusBody.latest` is null and `previous` is empty, so a running first pass is not
    empty. The pass section then says that no pass has run yet, and names the two ways one starts: an enabled
    Scheduled Tasks entry ("Reconcile tagging relationships"), or the Task Explorer (until story 5).
  - `confirmation` is checked in this order:
    1. `{ state: 'none' }` when `confirmationPending` is null;
    2. `{ state: 'unreadable', code }` when it has `unreadable`;
    3. `{ state: 'expired', runId, expiresAt }` when `expired === true`. It stays until the next pass, which does not
       honour it;
    4. `{ state: 'unknown-expiry', runId }` when `expiresAt` does not parse;
    5. else `{ state: 'pending', runId, expiresAt }`.

    It never reads the client clock (`src/api/tagging-edges/index.js:104-110`, `:178`).
  - **The pass's figures:** `taggingsRead`, `relationships.{added, changed, removed, unchanged, leftInPlace}`,
    `refused.total`, `held.total`, `peopleAdded`, and `startedAt` / `endedAt` / `durationMs`.
- **`newestFinishedPass(statusBody)`** returns the first record whose outcome is `done` or `done-removals-held`,
  taken from `latest` (only when not running) and then `...previous`, or `null` if none.
- **`pathView(rtBody)`**:
  - **Running.** `onButNotRunning` is `on && !running`, and in that case the stored `state` is not shown as current.
  - **Warnings** come from `stale`, `statusUnreadable` and `switchUnreadable`, as the server reports them.
  - **Counts and gauges are separate.**
    - The counts are `counts.{added, changed, removed, unchanged, peopleAdded}`, and `counts.refused.total`,
      labelled "refused taggings, counted at each look".
    - Failed reads are `counts.failedReads.{relay, graph, element, catchUp}`, each shown, with their sum.
    - Database refusals are `counts.dbRefused.total`.
    - Left to the next pass are `counts.removalsNotPrompted` and `counts.droppedOverBacklog`.
    - The gauges are `parked` and `pending`.
    - The times are `firstStartedAt` and `lastReflectedAt`, and the last catch-up is
      `catchUp.last.{outcome, startedAt, durationMs}`.
  - **`countsSince`** is `{ from: 'first-start', at: firstStartedAt }`, or `{ from: 'reset', at: null }` when
    `counts.countsReset === true`. The status records no reset time (`realtime/index.js:226`, `:2250`), so the panel
    says the counts were reset because the path's status was lost, runs them from that reset, and gives no time for
    it.
  - **Nulls.**
    - Before the first start (`firstStartedAt` null and no `counts`), every figure reads "not yet available".
    - After it, `lastError`, `setupProblem`, `catchUp.current` and `preimageFile` read "none" when null.
    - `onSince` and `runningSince` are shown only when `on` and `running` are true.
    - `lastFigures` is set, with `updatedAt`, when `on` is false and figures exist.
  - **A setup problem** is keyed `identity:<problem>` or `schema:<rule>:<problem>` (for example
    `schema:tags_address:not-online`). Its `identity` and `source`, or its `rule`, are shown as they are.
- **`scheduleView(listBody)`** counts the entries whose `taskId` is `reconcileTaggingEdges`, split by
  `enabled === true`, and returns `disabledCount` in every case. The panel mentions disabled entries whenever there
  are any. It returns one of:
  - `none`. The warning says the path has no backstop, and also that a disabled entry exists when `disabledCount >
    0`.
  - `one`, with its interval text and `timer.nextRunAt`, or `unscheduled` when that is null (the scheduler has no
    next run, or could not be asked, `scheduled-tasks/index.js:231-234`). It also carries `weakerThanDaily`.
  - `several`, with a count.

  **Weaker than daily** is this ADR's reading of AC-2, with no cron parser. As in the scheduler, a non-blank `cron`
  wins and the interval fields are then ignored (`scheduler.js:50-62`).
  - **For a cron,** trim it and split it on whitespace.
    - `@hourly` and `@daily` are not weaker; `@weekly`, `@monthly` and `@yearly` are.
    - With 5 or 6 fields, it is weaker unless each of the last three is `*`, `?`, `*/1` or its field's full range
      (`1-31`, `1-12`, `0-6`, `0-7`, `1-7`).
    - Any other shape warns.
    - The interval text is then the cron itself.
  - **Otherwise,** the interval is weaker when `(Number(intervalDays) || 0)·1440 + (Number(intervalHours) || 0)·60 +
    (Number(intervalMinutes) || 0)` is over 1,440, reading a missing field as 0 as the scheduler does
    (`scheduler.js:58-61`).
  - **Accepted false positives,** such as a cron list naming every day.
- **`driftView(counts, statusBody, rtBody)`** returns the explained drift.
  - **Unknown counts.** `known` is false when either count is unknown, and then no difference is computed.
  - **The arithmetic:**
    - `difference = relay − graph`;
    - the explained part comes from the newest finished pass: `explained = refused.total − held.total −
      relationships.leftInPlace`;
    - `unexplained = difference − explained`.
  - **What it also returns:**
    - `leftToNextPass`, the sum of that pass's `relationships.lostRace.*` and `anomalies.*`;
    - `explainedBy: { runId, endedAt, usedInsteadOfLatest }`;
    - `passRunning` when `statusBody.running`: the panel then says the graph count moves while the pass writes;
    - `newerUnfinished` when a record newer than the explaining pass is not finished and has a `plan` phase: the
      panel says it may have written after the explaining pass.
  - **When no part can be explained.** A null `statusBody` gives `explained: null` with `explainedReason:
    'report-unavailable'`. No finished pass gives `explainedReason: 'no-finished-pass'`. In both, `unexplained =
    difference`.
  - **The path.**
    - When the path is on, it returns `pathRefusedLooks` (`counts.refused.total`, labelled as in `pathView`, never
      subtracted) and `parked`.
    - When the path is off, it returns `waitsForPass: true`.
    - A null `rtBody` gives `pathUnknown: true` instead.

**`ui/src/utils/taggingPipelineFetch.js`** (new, plain ESM, Node 16 syntax):
`readSection(url, { fetchImpl = globalThis.fetch, timeoutMs = 15000 })`.
- It calls `fetchImpl(url, { method: 'GET', signal })`, reads `await res.text()` and parses it as JSON. `fetch` is
  referenced only when it is called.
- It returns `{ ok: true, body }` only for a 2xx whose JSON is a plain object. It never reads `data.success`.
- Otherwise it returns `{ ok: false, code, httpStatus, body }`, where:
  - the code is `http-<status>`, `network`, `timeout` or `bad-json`;
  - `body` is the parsed JSON of a non-2xx answer when it parses. It is used only for `/held`'s `latestRunId`, and is
    never rendered raw.
- `timeout` is decided by its own timer racing the fetch, so a `fetchImpl` that ignores `signal` still ends as
  `timeout`. The 15 s bound leaves the server's 10 s count its margin.

**`ui/src/pages/settings/taggingPipeline/TaggingPipelinePanel.jsx`** (new): `export default function
TaggingPipelinePanel({ onOpenTab })`.

- **Sections.** Each has a `data-testid` and a `data-state` (`loading` | `ready` | `empty` | `error`):
  - the pass, `tp-pass`;
  - the held removals, `tp-held`;
  - the schedule, `tp-schedule`;
  - the path, `tp-path`;
  - the drift, `tp-drift`.
- **When a section is `empty`:**
  - `tp-pass` when the report holds no pass;
  - `tp-held` when the latest pass is running or holds nothing;
  - `tp-path` before the first start.

  `tp-schedule` with no enabled entry is `ready`, because it shows a warning.
- **Loading.** Each section loads, fails and retries on its own. Loading is a sentence naming what loads, above a
  static skeleton: two or three placeholder bars, drawn as blocks with `background: var(--bg-tertiary)`, with no
  animation. That meets `guardrails/design.md:10`'s "at minimum a skeleton or shimmer" with no colour literal and
  nothing added to `styles.css`.
- **Failure.**
  - A failure names its read (the pass report, the held list, the path status, the schedule list, or the relay and
    graph counts), shows its code through `explain('fetchCode', …)`, and offers Retry.
  - A re-poll that fails after a good read sets `error`, and keeps the last good figures under the error line,
    labelled with the time they were read.
  - A failed drift-counts read makes both counts unknown.
- **Polling.**
  - A timer of `POLL_MS` re-reads the status and the realtime status with `Promise.allSettled`, and is cleared on
    unmount (the `StreamingETLPanel` precedent, `:1358-1363`).
  - A tick is skipped while the previous one is in flight. Each section keeps only the newest answer, and an answer to
    an older request is dropped.
  - 5 s leaves the request's own time inside AC-5's "within 10 seconds of the status routes showing it".
  - The schedule list is read on mount, on its Retry, and every `SCHEDULE_POLL_MS`. Its handler reads the task log
    synchronously for each entry (`scheduled-tasks/index.js:218-224`), so it is not polled every 5 s.
- **The held list.**
  - It is read 50 at a time through `/held?runId=<latest.runId>&offset=<n>&limit=50`, whenever the latest pass (not
    running) holds removals and its `runId` changes. The offset then returns to 0.
  - An answer whose `runId` differs, or a 404 carrying `latestRunId`, makes the panel re-read the status and restart
    the list, instead of showing a failure.
  - While a pass runs, the section says that the list returns when the pass ends.
  - It has Previous and Next, and shows each entry's reason and the report's `held.total`, beside
    `passView().confirmation`. It offers no way to confirm.
- **Drift** is counted once on mount, and again on a Recount button, through `GET /api/tagging-edges/drift-counts`.
  Nothing recounts on a timer.
- **The schedule warning** has a button that calls `onOpenTab('schedule')`.
- **Colours** come only from these tokens: `var(--green)`, `var(--orange)`, `var(--red)`, `var(--text)`,
  `var(--text-muted)`, `var(--border)`, `var(--bg-secondary)` and `var(--bg-tertiary)`.
  - They are used in inline styles, or through existing token-only classes (`settings-group`, `settings-hint`,
    `btn-small`, `text-muted`, and `settings-section` for its heading rules).
  - Buttons use `btn-small`, whose hover takes `--accent`: the one accent `design.md:7` allows.
  - There are no fallbacks (`var(--x, #888)` is a literal) and no `transparent`. Excluding `transparent` is this
    ADR's rule, stricter than AC-5.
  - A state colour goes on text and borders over a neutral background, the precedent at `styles.css:8341-8342`.
  - Nothing is added to `styles.css`.
- **Spacing** (`design.md:17`).
  - Spacing, sizes and radii come only from those classes and from the browser's defaults (for example a `<dl>`).
  - Inline styles set colour tokens and layout keywords only (`display`, `flex-direction`, `flex-wrap`), never a
    length.
  - If a layout needs a length no class gives, that is a `design.md:17` deviation the owner must accept, recorded
    under Debt. It is not the Implementer's choice.
- **Copy.** No emoji and no exclamation marks. Every code is shown through `explain`. Every request the panel sends is
  a `GET`.

**`ui/src/pages/settings/RelaySettings.jsx`** gets three edits and nothing else:
1. the import;
2. `{ key: 'tagging', label: 'Tagging pipeline' }` in `RELAY_TABS`, between `etl` and `schedule`;
3. `{activeTab === 'tagging' && <TaggingPipelinePanel onOpenTab={setActiveTab} />}` beside the `etl` line (`:2113`).

The other five sub-tabs are untouched. The Reviewer confirms that `git diff 66d60cb5 --
ui/src/pages/settings/RelaySettings.jsx` shows only the three additions.

### Seams for Test Design

- **The two view modules** are loaded by `import()` from Node suites (`test/next-task-countdown.test.js:49-66`).
- **The guard test** reads each producer with its comments stripped (a `codeOnly` helper, as in
  `test/assistant-identification-tags-page.test.js`). It extracts, per kind:
  - **passOutcome:** `finish('…'`, and `outcome: 'failed'` in the pessimistic record.
  - **passReason:** the first argument of `refuse('…'` / `fail('…'`, and `reasonCode: '…'`. It excludes the
    not-started family (`lock-busy`, `not-started-under-the-lock`), which is never written to the report.
  - **failureStage:** `stage: '…'` and `fsFailure('…'`.
  - **failureRead:** `read: '…'`, plus `'graph-verify'`, which the port sets on its error
    (`src/pipeline/tagging-edges/graph.js:325`) and the runner copies (`reconcileTaggingEdges.js:488`).
  - **refusedReason, heldReason, leftInPlaceReason, changeKind:** the exported `REFUSAL` (`contract.js:20-31`),
    `REMOVAL_REASON`, `LEFT_REASON` and `CHANGE_KIND` (`sweep.js:24-26`).
  - **confirmationWhy:** `why: '…'`, plus the two template prefixes.
  - **pathState:** every string literal a `return` inside `function currentState()` can yield, ternary branches
    included (`realtime/index.js:540-549`; `off` and `waiting-relay` appear only in ternaries). With the route's forced
    `'off'` (`src/api/tagging-edges/realtime.js:100`), these are the eight states AC-3 names.
  - **lastErrorStage:** the keys of the `STAGE_TEXT = Object.freeze({…})` block.
  - **catchUpOutcome:** the second argument of `endCatchUp(`, plus `'not-established'`.
  - **catchUpStage:** the second argument of `failCatchUp(`.
  - **notEstablishedReason:** the `LOST_REASONS` array.
  - **setupProblem:** the product of the schema rules and problems (`realtime/index.js:929-931`), and of
    `checkIdentity`'s returns (`sweep.js:61-67`), `missing` among them.
  - **countCode:** `SCAN_ERROR_CODES` (`src/lib/tagging-edges/realtime.js:68-71`), which is **not exported**, so it
    is read by a source scan of its `Object.freeze([...])` array. The test asserts at least 12 codes, each satisfying
    `allowErrorCode(c) === c`. `countCode` also takes `identity`, `timeout`, `unparseable` and `error`
    (`allowErrorCode`'s fallback, `src/lib/tagging-edges/realtime.js:888`, `:893`), which a `lastError`'s code can also
    be.

  Each extraction asserts a floor at today's count, so a moved literal fails loudly. Each code must satisfy
  `explain(kind, c).recognised`.
- **Static checks on the panel's source.** The panel folder's files and the two `ui/src/utils/taggingPipeline*.js`
  modules hold:
  - **No colour literal**, scanned with every `var(--…)` removed first:
    - hex `#[0-9a-fA-F]{3,8}\b`;
    - `rgb(`, `rgba(`, `hsl(` or `hsla(`;
    - a CSS named colour as a quoted style value, or after a colour property;
    - `transparent`.
  - **No emoji** (`\p{Extended_Pictographic}`).
  - **No length** in an inline style.
  - **No `!` in copy.** JSX text and string literals hold no `!` followed by whitespace, a quote or the end. At run
    time every `EXPLANATIONS` sentence is non-empty, and has no `!`, no emoji and not its own code.

  Sentinels also pin `RELAY_TABS`'s new entry in place, `POLL_MS` used by name, and the `data-testid` hooks.
- **The route** takes `(req, res, deps)`, with fakes for `countStrict`, `runCypher`, `now`, `setTimer`, the owner and
  admin readers, and the real `resolveIdentities` over fake `identities`.
  - The session matrix is adapted from `test/tagging-edges-realtime-routes.test.js:1440-1450`, with admins passing.
    It includes admin case-sensitivity, and the Origin rows: none (passes), same-host (passes), foreign (403) and
    `null` (403).
  - Joining is pinned with a deferred fake `countStrict` that is called once for two concurrent requests.
  - Tests load drift.js fresh. `FORGET` names `src/api/tagging-edges/drift.js`, `src/api/tagging-edges/index.js`,
    `src/lib/strfryScanStrict.js` and `src/lib/tagging-edges/realtime.js`.
- **`countStrict`** is tested through a fake `strfry` placed first on `PATH` (`test/strfry-scan-strict.test.js:117-190`),
  extended to record `$3`.
- **The browser spec.**
  - It follows `tests/brainstorm/scheduled-tasks-panel-countdown.spec.js:66-96` for the Settings stubs, and
    `tests/brainstorm/assistant-identification-tags-page.spec.js:78-100, 144-195` for the request log, the catch-all
    and the B0 bundle guard.
  - **The catch-all** is registered first and answers a non-2xx status (for example 599 `{ success: false }`), because
    `readSection` treats any 2xx JSON as good. Then it stubs a signed-in owner, and then an admin.
  - **Time** is driven with `page.clock.install()` and `page.clock.runFor(…)`:
    - a stubbed status change shows after `runFor(POLL_MS)`;
    - a minute open with two Recounts sends only GETs, and exactly three drift-counts requests.
  - **The build** runs under Node 22 into a scratch folder, so it does not replace the `dist/` the local stack serves:
    `cd ui && npx vite build --outDir <scratch>/dist && npx vite preview --outDir <scratch>/dist --port 4173
    --strictPort`.
  - **AC-6.** The spec records the API requests each existing sub-tab sends under the catch-all, and compares them
    with the same spec run on `66d60cb5`, recorded as the Tester's baseline.
  - **Against a baseline.** The browser class is already red on staging (ledger
    `2026-09-22-staging-browser-class-83-red`).
- **AC-1's "no pass is queued".**
  - In the browser spec every route is stubbed, so it holds by fixture.
  - For live evidence, the Tester checks BullBoard (`/admin/queues`, owner or admin). It records that the
    `reconcileTaggingEdges` queue has no waiting, delayed or active job before and after the check.
- **C6, C9 and C4's test-plan wording** are the Tester's (story 4 § Test tasks).

### Docs (the Implementer)

- **Story 4's docs tasks:**
  - OPERATIONS §12.8–§12.9: where the panel is, and that the JSON routes stay the reference;
  - BIBLE §11: the new route, and a §16 entry;
  - the handoff's § 0 and §2.3.
- **The carry-forwards' non-ADR places** (`epics/tagging-edges.md` item 4), worded as § Amendments to ADR 0003 below:
  - **C1:** the ledger row's "Who misses" bullet and § Impact, OPERATIONS §12.9's safety-diff bullet, and story 3
    § Evidence.
  - **C3:**
    - the ledger row's debounce bullet: every subscription on the woken thread, not every live subscription, and all
      three other wakes, the closed connection included;
    - OPERATIONS §12.9's safety-diff bullet ("within 100 ms");
    - story 3 § Evidence.
  - **C4:** OPERATIONS §12.9, and story 3 § Evidence.
  - **C5:**
    - OPERATIONS §12.9's refusal-park bullet, with the corrected bound;
    - the engine comment beside `bringsNew`'s use (`realtime/index.js:1074-1080`). Only the comment is edited, and no
      code changes.
  - **C7:** OPERATIONS §12.9's off paragraph, "What a deploy does", "What waits for a pass", the lost-notice-removal
    bullet and the journal bullet, plus an amendment note in story 3.

## Amendments to ADR 0003 (story 3's review, round 3: C1, C2's ADR half, C3, C5, C7)

This ADR's commit makes these changes in ADR 0003's text.
- **Notes.** Each changed passage carries a note like *(… at story 4's Architecture, 2026-09-30, from story 3's
  review, round 3, carry-forward Cn.)*. The notes name "story 3's review" because ADR 0003 already uses "C1–C20" for
  ADR 0002's clarifications.
- **Sources.** Each claim was re-derived from strfry 1.1.0 (`f31a1b9`, in the container) and from the engine at
  `66d60cb5`.

- **C1: clarification 24's "Who misses".**
  - strfry keeps its skip marks per filter and index-key value, not per subscription alone (`src/ActiveMonitors.h:25-35`,
    `:93-98`, `:119-148`, `:167-195`).
  - A thread visits a re-used-id write only when it wakes after the delete and before the write.
  - A subscription skips a write at or below the last event sent to it, the relay's newest event when it subscribed,
    or the last event visited that carries the write's own index-key value.
  - For the path, a stamped tagging is also hidden by the last event carrying its stamp, and a kind-5 only by the
    other two.
- **C3 with C2's ADR half: clarification 24's debounce bullet.**
  - A thread lowers its cursor at every wake, but only to the largest id present then.
  - A database change wakes all three threads about 100 ms after the first change, which may precede the delete.
  - A REQ (at its EOSE), a CLOSE and a closed connection each wake only their own thread.
  - A re-used-id write stored before its thread next wakes is missed by every subscription on that thread.
  - The ledger row's debounce bullet is brought into line with it under C3 (§ Docs).
- **C5: clarification 26.**
  - "Does not already hold" is read by effect, as `mergePrompt` would merge it (`bringsNew`,
    `realtime/index.js:244-262`; story 3 § Deviations).
  - "The same refused version, found again, costs no write" is replaced by the true bound:
    - one write attempt per park, when the address is refused with the park's own code outside T29's systemic case
      (the re-park at `:1965-1970`, one level higher, not counted again, `:2041-2048`). A row landing in the same round
      lifts it at once (`:1983`), as every successful write does;
    - a refusal with another code is retried after 5 s and parks, counted, on the second;
    - T29's systemic case (two or more addresses, one code, no row landed, `:1891-1893`) backs off 5→60 s until it no
      longer holds.
  - The story's C5 line read "bounded to one write attempt per park episode". That holds except in those two cases.
    Making it hold in both would be a code change, which the owner's docs-only placement rules out.
- **C7: the widening the owner accepted on 2026-09-30.**
  - **§ Failure handling's journal bullet** is rewritten. A crash, a switch-off or a SIGTERM during a spell of failing
    appends loses every line not yet written, and a returned baseline version whose `b` line was lost, at an address
    the graph does not hold, counts as held again and waits for the pass. `lastError` names `journal`, `record` or
    `status` only while `status.json` can still be written; after that the status goes `stale`, then `running` false.
  - **The crash bullet's** "never opens that window" becomes "while journal appends succeed".
  - **The off steps and the storage table** note that the flush may fail while the volume is full.
  - **Decision 5** now names the spell in its second and third corners and its marker, and **A1-16's second corner**
    names it too.
  - **§ Replay and decision 11's journal trigger** add the spell's unwritten lines: occasions, not a new kind of
    removal. **Clarification 16** notes that the spell is outside the property suite's model.
  - **The code is unchanged:** `flushJournal` (`realtime/index.js:441-452`), the all-or-none append
    (`store.js:401-419`), `stopStep` (`:2193-2213`), and the status write (`:604-608`).

## Clarifications (Test Design, 2026-09-30)

Test Design fixes the shapes the suites call where the sections above name a field but not its exact form. They are
for the owner to ratify at the Test Design gate. Times are ISO strings as the routes give them. "Absent" means the
field is `null`.

**T1 — `passView(statusBody)`.** It returns `{ running, current, latest, earlier, empty, confirmation }`.
- `running` is `statusBody.running === true`.
- `current` is `null` unless running. While running it is `{ runId, startedAt, phases, finishing }`, taken from
  `statusBody.latest`.
- `latest` is `statusBody.latest` when not running, else `null`.
- `earlier` is `statusBody.previous` in its order (newest first), or `[]`.
- `empty` is true only when `statusBody.latest` is null and `earlier` is empty.
- `confirmation` has the five states of § UI, checked in that order.
- A null or non-object `statusBody` gives `null`.

**T2 — `newestFinishedPass(statusBody)`** returns the record itself (the same object), or `null`.

**T3 — `pathView(rtBody)`.** It returns:

```
{ on, running, onButNotRunning, started, state, warnings, countsSince, lastFigures,
  counts, gauges, lastCatchUp, setupProblemKey, lastError }
```

- `started` is false when `firstStartedAt` is absent and `counts` is absent.
- `state` is `null` when `onButNotRunning`. Otherwise it is `rtBody.state`, which is `'off'` whenever `on` is false.
- `warnings` is an array, in this order, of those of `'stale'`, `'statusUnreadable'` and `'switchUnreadable'` whose
  field is `true`.
- `countsSince` is `null` when not started. Otherwise it is `{ from: 'first-start', at: firstStartedAt }`, or
  `{ from: 'reset', at: null }` when `counts.countsReset === true`.
- `lastFigures` is `{ updatedAt }` when `on` is false and `started`, else `null`.
- `counts` is `null` when not started. Otherwise it is `{ added, changed, removed, unchanged, peopleAdded,
  refusedLooks, failedReads: { relay, graph, element, catchUp, total }, dbRefused, removalsNotPrompted,
  droppedOverBacklog }`, with each number as the status gives it (`refusedLooks` is `counts.refused.total`,
  `dbRefused` is `counts.dbRefused.total`).
- `gauges` is `{ parked, pending }`, or `null` when not started.
- `lastCatchUp` is `catchUp.last`, or `null`.
- `setupProblemKey` is `'identity:<problem>'`, `'schema:<rule>:<problem>'`, or `null`.
- `lastError` is the status's `lastError`, or `null`.
- A null or non-object `rtBody` gives `null`.

**T4 — `scheduleView(listBody)`.** It returns:

```
{ verdict, enabledCount, disabledCount, intervalText, nextRunAt, unscheduled, weakerThanDaily }
```

- `verdict` is `'none'`, `'one'` or `'several'`.
- `intervalText`, `nextRunAt`, `unscheduled` and `weakerThanDaily` describe the one enabled entry, and are `null`,
  `null`, `false` and `false` otherwise.
- `intervalText` is the trimmed cron when one wins. Otherwise it is the sum in the largest whole unit, one of `every
  N day(s)`, `every N hour(s)` or `every N minute(s)`, or `every D days H hours M minutes` when no single unit
  fits.
- A null or non-object `listBody`, or one whose `entries` is not an array, gives `null`.

**T5 — `driftView(counts, statusBody, rtBody)`.** `counts` is the drift-counts answer's body, or `null` when that read
failed. It returns:

```
{ known, relay, graph, difference, explained, unexplained, explainedReason, explainedBy, leftToNextPass,
  passRunning, newerUnfinished, pathRefusedLooks, parked, waitsForPass, pathUnknown }
```

- `relay` and `graph` are the answer's two count objects, or `{ known: false, code: null }` when `counts` is `null`.
- `known` is true only when both are known.
- `difference`, `explained` and `unexplained` are numbers or `null`. When not known, all three are `null`, and so
  are `explainedBy` and `explainedReason`.
- `explainedReason` is `null` when a finished pass explains, `'report-unavailable'` when `statusBody` is null, or
  `'no-finished-pass'`.
- `explainedBy` is `{ runId, endedAt, usedInsteadOfLatest }`. `usedInsteadOfLatest` is true when the explaining
  pass is not the report's `latest`.
- `leftToNextPass` is a number, or `null` without an explaining pass.
- `passRunning`, `newerUnfinished`, `waitsForPass` and `pathUnknown` are booleans.
- `pathRefusedLooks` and `parked` are numbers when the path is on, else `null`.

**T6 — `explain(kind, code)`.** An unknown `kind` answers as an unknown code. `code` is returned as given, a
non-string included. The text for an unknown code is exactly `not recognised`.

**T7 — `readSection`.**
- A 2xx whose body parses to anything but a plain object (an array, `null` or a string) is
  `{ ok: false, code: 'bad-json', httpStatus, body }`.
- `httpStatus` and `body` are `null` for `network` and `timeout`.
- The time-out covers the whole read, the body included: a response whose `text()` never settles ends as `timeout`.
- A `text()` that rejects ends as `network`, and `readSection` itself never rejects.
- `fetchImpl` is called exactly once per read, and a failure is never retried.

**T8 — The drift route's times.** `takenAt` is `new Date(d.now()).toISOString()` at the count's start. `ms` is
`d.now()` at settle minus `d.now()` at start (so 0 with a fixed fake clock), and `limitMs` exactly for a lost race.
`stamps` values are the first 8 characters of each resolved pubkey.

**T9 — The panel's fixed words**, which the browser spec reads:
- the sub-tab's accessible name is `Tagging pipeline`;
- a figure the path has never produced reads `not yet available`;
- an unknown count reads `unknown`;
- an unrecognised code reads `not recognised`;
- the Recount button's accessible name is `Recount`;
- a section's retry button's accessible name is `Retry`.

The section `data-testid`s and `data-state` values are as in § UI.

**T11 — The drift route's seams.**
- **`countFilter`** takes `resolveIdentities`' success shape, `{ canonicalPubkey, localPubkey }`, and keeps the
  canonical stamp first.
- **What `handleDriftCounts`' third argument may override:** `ownerPubkey` or `getOwnerPubkey`, `getAdminPubkeys`,
  `identities` (the runner's nested shape), `env`, `countStrict`, `runCypher`, `now`, `limitMs`, `setTimer` and
  `clearTimer`.
- **A refused request resolves no identity**, as well as spawning nothing and running no Cypher.
- **On an identity refusal,** the `stamps` value of the identity that did not resolve is `null`. The other one is
  still given when it resolved.

**T10 — AC-6's baseline.** The requests each existing Relays sub-tab sends under the browser spec's catch-all are
recorded before the change, at `88af7df3` (its UI is `66d60cb5`'s), in
`tests/brainstorm/fixtures/relay-subtab-requests.json`. The spec compares against that file.

## Out of scope

- **Story 5's controls** and their confirm prompts. The widening of the switch to admins, and the run and stop
  controls, are for story 5's ADR.
- **A cron parser.** A cron entry's frequency is judged only by the rule in `scheduleView`.
- **A panel read that shows a queued pass,** and any change to the gate on the scheduled-tasks routes. The latter is
  the 2026-07-21 intake entry's.
- **New design tokens, an animated shimmer, and light or dark theming.** A static, token-only skeleton is in scope
  (§ UI).
