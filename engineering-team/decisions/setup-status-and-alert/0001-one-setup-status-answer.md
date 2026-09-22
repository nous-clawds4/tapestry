# ADR 0001: One setup-status answer for the signed-in viewer, computed on the server, shared by `/setup` and the pill

**Status:** Accepted (§ 3's triggers extended by `setup-status-and-alert` ADR 0002 Decision 5, the viewer's assistant in the request key, and ADR 0003, a re-check after the viewer's own kind 3 or kind 10040 publish)
**Date:** 2026-09-21
**Story:** `engineering-team/stories/setup-status-and-alert/1-setup-shows-where-you-stand.md`
(the model it designs is also what story 2, the Setup Alert, reads; story 2's own ADR decides only
where the pill goes)

## Context

Story 1 replaces `/setup`'s constant "0 of 3 complete" with each step's real state for the signed-in
viewer. The rules were ratified at planning (book § Decisions):

| Step | Done when |
|---|---|
| 1 · Create your account | this instance holds an assistant for you |
| 2 · Create your follow list | your follow list (kind 3) follows at least one account other than you |
| 3 · Activate your Brainstorm account | your Treasure Map (kind 10040) names your assistant in both its rank entry and its followers entry |

**Where steps 2 and 3 look:** this instance's relay first. Only when it has no such event of yours
are the outside relays this instance is configured to read asked, and then the newest event found
counts.

Story 2 counts the same answers, but only the confident ones. A step is counted only once its check
has *finished*:
- it found the event; or
- it found none on this instance's relay, and none on the outside relays after at least one of them
  answered.

A Map that names another provider is never counted. So the two surfaces need one model with two
readings: Brainstorm's `*Done` and `*Pending` (`useFinishSetup.ts` at upstream `cde8f438`; the epic
summarizes it).

**Constraints:**
- **Whose state (POV).** Every check is about the viewer: the session's pubkey, and the assistant
  this instance holds for them.
  - The one main→delegate mapping is `getAssistantPubkeyFor` (`src/utils/assistantKeys.js:99`, ADR
    author-scoped-inspection/0001). Sign-in already uses it (`src/api/auth/getUserClassification.js:26`).
  - For the Owner it answers the instance TA. BIBLE §31 (ADR self-ontology/0002) makes the TA the
    instance's own identity, and leaves any use of it for the Owner an explicit per-feature choice.
    **This ADR makes that choice for `/setup`:** the Owner's assistant is the TA, because that is
    what the mapping answers and what the owner ratified (book § Decisions, the visitor table).
  - For anyone else, a Map naming the TA names "another provider". No TA pubkey is hardcoded.
- **Two kinds of not done.**
  - The page may show "not done" while a check is running or has failed.
  - The pill may count a step only when its check has finished.
- **Read-only.** Nothing is published, signed or stored, not even on this instance's relay (book
  § Acceptance frame).
- **The house stack:** JS without build, no new tooling, Node suites that load `ui/src/utils/*.js` as
  ESM through `import(pathToFileURL(…))` (for example `test/curated-dlist-update-publish.test.js:119`),
  and no component test harness for `ui/`.

**What exists, and why none of it answers the question as asked:**
- **`useAssistantSetupState`** (`ui/src/hooks/useAssistantSetupState.js`) answers "does the
  assistant have a *profile*". Decision 1 says step 1 is "you *have* an assistant". Its endpoint can
  also copy a profile home into strfry, which is a write (ADR assistant-profile/0001).
- **`useTreasureMap`** (`ui/src/hooks/useTreasureMap.js:80`) reads outside relays through
  `/api/relay/external` without `strict`, and `SimplePool.querySync` answers `[]` for a relay it
  could not reach (OPEN.md row 314; it was row 280 before the 2026-09-17 renumbering). So its `none` can mean "nothing reached". It also
  reads the concept graph's relay set. My Curated DLists depends on it, so it stays as it is.
- **`fetchCurrentMap`** (`src/api/export/nip85/currentMap.js:33`) calls itself strict, but its
  outside read is `querySync` too (`src/api/dlist-curation/index.js:164`), which only rethrows the
  overall timeout. So its `where: 'none'` is not confident either. Its local scan
  (`dlist-curation/index.js:134`) resolves on `close` whatever strfry's exit code, so a failed scan
  reads as "none here".
- **The follow buttons' kind 3 read** (`useProfileActions.js:39` → `fetchFromRelays`,
  `ui/src/utils/nostrPublish.js:26`) returns `[]` on any failure and never reads the local relay.
  `useTrustWeights.js:45` reads only the local relay.
- **The confident primitive already exists:** `readRelayEvents(url, filter)`
  (`src/api/_shared/relaySource.js`, ADR curated-dlist-update/0005 §1).
  - It reads one relay.
  - It answers `ok` only from a relay proven reachable that sent EOSE.
  - It re-checks kind and author, and keeps only validly signed events.
  - It is what `/api/relay/external?strict=1` uses.
- **Relay configuration is operator-editable** in Relay Settings (`aRelays`, `src/config/defaults.json`).
  - `readConfiguredRelays(categories)` (`src/api/assistant/profilePublish.js:70`) is its one reader.
  - `currentMap.defaultRelays()` (`currentMap.js:19`) is the server's list of where a person's
    current Map is looked for: the NIP-85 home relay, the trusted-assertion relays and the
    general-purpose relays.
  - On staging and production today these are the shipped defaults.
- **The precedent for "one answer, every route":** `GET /api/assistant/roster` plus
  `AssistantRosterProvider` (`ui/src/context/AssistantRosterContext.jsx`, ADR
  author-scoped-inspection/0002). It is a session-shaped server read, held in a context mounted in
  `App.jsx` inside `AuthProvider` and outside the router.
- **The auth middleware lets every unauthenticated GET under `/api/` through**
  (`src/middleware/auth.js:330–508`). A session-shaped handler therefore checks the session itself,
  with the predicate `handleAuthStatus` uses (`auth.js:222`): `req.session.authenticated === true`.

**Concepts touched:** none changed. For orientation: `39998:<TA>:tapestry-assistant`,
`39998:<TA>:nostr-user`, `39998:<TA>:nostr-relay`. All three are present in the live graph
(`/api/concept-graph/summaries`, 2026-09-21).

## Options considered

### Option A — One session-shaped server read, `GET /api/setup/status`, held by one app-level provider (chosen)

- **A new server module** answers the three steps for the session's viewer:
  - step 1 from `getAssistantPubkeyFor`;
  - steps 2 and 3 from a local scan that reports its own failure, then, on a local miss, one
    `readRelayEvents` per configured relay under a fixed budget.
- It returns `done`, `pending` and `finished` for each step, plus the few details the page shows.
- **In the UI:**
  - a provider in `App.jsx`, beside `AssistantRosterProvider`, fetches it once per page load (and
    again when the signed-in account changes), only once some component has asked for it;
  - a pure util turns the answer into counts;
  - the page (story 1) and the pill (story 2) both read the provider.

**Pros:**
- **One definition of "done" and "finished"**, in one Node module whose every branch a
  dependency-injected suite can drive.
- **The server already holds everything the rule needs:** the strict reader, the relay settings, the
  assistant mapping and the instance's own relay URL.
- **POV-safe by construction.** There is no pubkey parameter, so the client cannot ask about anyone
  else or substitute the TA.
- **One request per page load.**

**Cons:**
- **A new API route**, so a server change: the local container needs its backend refreshed
  (`/cycle-local`), and staging and production need their normal deploy.
- **Outbound relay reads per signed-in page load when the local relay misses.** They are bounded by
  the budget below and rare in practice: the local relay holds about 2.37 million kind 3 events.

### Option B — A client-side model over existing endpoints (Brainstorm's shape)

- **Step 1** comes from `AuthContext` (`user.assistantPubkey`). That needs a new flag for whether
  `/api/auth/user-classification` answered: today a failed answer becomes `guest` with no assistant
  (`ui/src/context/AuthContext.jsx:68–69`), which the pill would count.
- **Steps 2 and 3** go `/api/strfry/scan` → `/api/relay/external?strict=1&relays=…`, with the lists
  taken from `ConfigContext.aRelays`.
- **Pure evaluators** live in `ui/src/utils`.

**Pros:**
- No server change, and every endpoint used is already shipped.
- It mirrors `useFinishSetup.ts` file for file.

**Cons:**
- **Four to six requests per page load**, where Option A needs one.
- **The relay policy moves into the browser,** including which relays count as outside. The client
  cannot see `BRAINSTORM_RELAY_URL`, and a relay that is this instance's own must never count as
  "an outside relay that answered".
- **A failed local read can't be told from a miss.** `/api/strfry/scan` also answers
  `success: true` from `close` whatever strfry's exit code (`src/api/strfry/queries/scan.js:129`).
- **A new race:** `aRelays` arrives asynchronously, the same shape as OPEN.md row 260.
- **Confidence would be composed in two layers,** server responses plus client rules.

### Option C — Compose the existing hooks (`useAssistantSetupState`, `useTreasureMap`, a new kind 3 hook)

**Pros:** the least new code.

**Cons:** all three answer a different question:
- a profile, not an assistant;
- a non-strict "none";
- a failure that reads as "none".

Fixing them changes shipped hooks that the Dashboard and My Curated DLists depend on, which this
book ruled out. **Rejected.**

## Decision

We chose **Option A.**

"Finished" is the whole point of story 2, and "finished" is a property of how relays were read.
Only the server can read them honestly:
- it has the per-relay strict reader;
- it knows the instance's own relay;
- it can tell a failed local scan from an empty one.

Keeping the rule in one server module means the page and the pill cannot disagree (story 2 AC-4).
It follows the shipped roster precedent, and it keeps the viewer's identity in the session, where
the client cannot change it.

**We trade away** a server change and a few outbound relay reads on local misses. We also give up
Brainstorm's file-for-file shape, but not its model: `done` and `pending` are its `*Done` and
`*Pending`.

## Consequences

- **What this enables:**
  - Story 2 reads `pendingCount` from the same provider and adds no fetch of its own.
  - When the step pages are built, they can call the provider's `refresh()` after a publish.
- **What this constrains:**
  - "Finished" requires at least one relay outside this instance to answer. A deployment whose
    Relay Settings list no outside relay for a kind never finishes that check, so the pill never
    counts that step. That is deliberate: silence is not evidence.
  - A step completed in another app shows on the next full page load. There is no polling and no
    cache (story 2 § Out of scope).
- **Latency:**
  - A local hit answers with two local scans and no relay traffic.
  - A local miss waits for the slowest configured relay, capped at the 8 s budget. So a brand-new
    account with no follow list anywhere sees "not done" for up to 8 s on each full page load before
    the answer settles.
  - Per principle 3 there is no server memo. Measure before adding one.
- **Follow-ups (debt this ADR notices and does not fix):**
  - `scanLocal` (`dlist-curation/index.js:134`) and `/api/strfry/scan` read a failed strfry as
    empty.
  - `fetchCurrentMap`'s "strict" read is `querySync`, so its `none` is not confident. It is the same
    family as OPEN.md row 314.
  - This module's parallel per-relay loop repeats `readStrict` in `src/api/relay/fetchEvents.js:34`.
    Unify them if a third caller appears.

  The Reviewer decides whether these become ledger rows.
- **Firmware reinstall required?** No. No concept changes.

## Implementation notes

### 1. Server: `src/api/setup/status.js` (new)

Plain CommonJS, dependency-injected in the `handleFetchExternalEvents(req, res, deps = {})` idiom
(`src/api/relay/fetchEvents.js:79`). Heavy requires stay lazy, as `relaySource.js` does, so the
module loads in a bare checkout.

**Exports:**
- the handler: `handleSetupStatus(req, res, deps = {})`;
- the pieces the suites drive: `lookupNewest({ kind, pubkey, relays }, deps)`,
  `evaluateSteps({ viewer, assistantPubkey, follow, map })`, `followListRelays(deps)`,
  `treasureMapRelays(deps)`, `outsideOnly(urls, deps)`, `scanLocalStrict(filter, opts)`;
- the constants `FOLLOW_LIST_RELAY_CATEGORIES`, `RELAY_BUDGET_MS`, `LOCAL_SCAN_TIMEOUT_MS`.

**Default dependencies:**
- `getAssistantPubkeyFor` (`../../utils/assistantKeys`);
- `scanLocal: scanLocalStrict`;
- `readRelay: readRelayEvents` (`../_shared/relaySource`);
- `readConfiguredRelays` (`../assistant/profilePublish`);
- `mapDefaultRelays: defaultRelays` (`../export/nip85/currentMap`);
- `getConfigFromFile` (`../../utils/config`).

**The viewer:**
- `viewer` is `req.session.pubkey` when `req.session.authenticated === true` and that pubkey is
  64-hex. Otherwise `null`.
- The handler reads **no** query parameter. There is no way to ask about another pubkey, and no way
  to name relays.

**Responses:**

```json
{ "success": true, "signedIn": false }
```

```json
{
  "success": true,
  "signedIn": true,
  "steps": {
    "account":  { "done": true,  "pending": false, "finished": true },
    "follow":   { "done": true,  "pending": false, "finished": true, "followCount": 27, "source": "local" },
    "activate": { "done": false, "pending": false, "finished": true, "otherProvider": true, "source": "local" }
  }
}
```

- An unfinished step carries `"finished": false` and a `"reason"`: `local-unreadable`,
  `no-outside-relays` or `outside-unreachable`. Its `done` and `pending` are both `false`, and
  `source` is `null`.
- An unexpected throw answers `500 { "success": false, "error": "Could not check setup status" }`.
- The response carries no pubkeys, not even the viewer's or the assistant's.

**`scanLocalStrict(filter, { timeoutMs = LOCAL_SCAN_TIMEOUT_MS })`**
- `spawn('strfry', ['scan', JSON.stringify(filter)])`, parsing JSONL the way `scanLocal` does.
- It **rejects** on a spawn error, a non-zero exit code, or the timeout (kill the process, clear the
  timer). `LOCAL_SCAN_TIMEOUT_MS = 5000`.

**`lookupNewest({ kind, pubkey, relays }, deps)`**, with `filter = { kinds: [kind], authors: [pubkey] }`:
1. **This instance's relay.** `events = await deps.scanLocal(filter)`.
   - A rejection gives `{ finished: false, reason: 'local-unreadable' }`.
   - Keep the events whose `kind` and `pubkey` match. If any remain, answer
     `{ finished: true, event: newest, source: 'local' }`. **No outside relay is read** (story 1 AC-3).
2. **No relays configured.** If `relays` is empty, answer `{ finished: false, reason: 'no-outside-relays' }`.
3. **The outside relays**, all at once. Each read is `deps.readRelay(url, filter)` raced against
   `RELAY_BUDGET_MS = 8000`, the `/api/relay/external` strict budget. A read that loses the race, or
   throws, is `unreachable`. Clear every timer.
4. **Nobody answered.** If no read came back `status: 'ok'`, answer
   `{ finished: false, reason: 'outside-unreachable' }`.
5. **At least one answered.** `newest` over the events of every `ok` read. Answer
   `{ finished: true, event: newest, source: 'relay' }`, or `{ finished: true, event: null, source: null }`
   when there is none.

**Newest** means the largest `created_at`. On a tie, the lexically lowest `id` wins (NIP-01's
replaceable rule).

**`evaluateSteps({ viewer, assistantPubkey, follow, map })`** is pure. Lowercase every pubkey before
comparing.
- **`account`**: `done = !!assistantPubkey`, `pending = !done`, `finished = true`. The mapping always
  answers (`getAssistantPubkeyFor` returns a string or `null`). "The instance could not answer" is the
  request itself failing, which the client counts as nothing.
- **`follow`**:
  - `followCount` is the number of distinct 64-hex `p` tag values other than `viewer`, or 0 when
    there is no event.
  - `done = finished && followCount >= 1`
  - `pending = finished && !done`
- **`activate`**:
  - The provider for a metric is the pubkey of the first tag named `30382:rank` (or
    `30382:followers`) whose second element is 64-hex. Rows without a valid delegate are skipped,
    the rule in `findGenericTlDelegation`, `ui/src/utils/treasureMap.js:56`.
  - `done = finished && !!assistantPubkey && rank === assistantPubkey && followers === assistantPubkey`
  - `otherProvider = finished && ((rank && rank !== assistantPubkey) || (followers && followers !== assistantPubkey))`.
    With no assistant, any valid provider is "another provider".
  - `pending = finished && !done && !otherProvider`
  - Invariants the suites can pin: `pending` implies `!done`; `otherProvider` implies `!pending`.

**The relay lists.** Each kind reads only relays that plausibly keep that kind: a relay that never
stores follow lists answering "none" is no evidence.
- `followListRelays(deps)` is
  `outsideOnly(deps.readConfiguredRelays(FOLLOW_LIST_RELAY_CATEGORIES))`, where
  `FOLLOW_LIST_RELAY_CATEGORIES = ['aPopularGeneralPurposeRelays', 'aWotRelays', 'aProfileRelays']`.
  `purplepag.es` and `wot.grapevine.network` index follow lists.
- `treasureMapRelays(deps)` is `outsideOnly(deps.mapDefaultRelays())`: the same list the server
  already uses for "this person's current Map", minus this instance's own relay.

**`outsideOnly(urls, deps)`**
- Keeps `ws://` and `wss://` URLs.
- Drops any whose hostname is `localhost`, `127.0.0.1` or `::1`, is the hostname of
  `BRAINSTORM_RELAY_URL`, or equals `STRFRY_DOMAIN`. Both are read with `getConfigFromFile`.
- De-duplicates, case-blind and one trailing slash apart.

**Why the exclusion is needed:** `defaultRelays()` falls back to `BRAINSTORM_RELAY_URL` when
`BRAINSTORM_NIP85_HOME_RELAY` is unset, and on this machine that is `ws://localhost:7777`, the local
strfry itself. If it counted as "an outside relay that answered", the pill could count a step with
every real outside relay down.

**The handler:**
1. `viewer`; no viewer answers `{ success: true, signedIn: false }`.
2. `assistantPubkey = await deps.getAssistantPubkeyFor(viewer)`.
3. `[follow, map] = await Promise.all([lookupNewest(3), lookupNewest(10040)])`, each with its own
   relay list.
4. Answer `{ success: true, signedIn: true, steps: evaluateSteps(…) }`, with the lookups' `source`
   and `reason` copied onto their steps.

**Read-only.** The module requires and calls only what is listed above. There is no
`strfry import`, no publish helper, no signer, and nothing is written to the settings or the key
store.

**Registration:**
- Add `app.get('/api/setup/status', setupStatus.handleSetupStatus)` in `src/api/index.js`, beside
  the assistant routes (`:538–543`).
- Add a `GET /api/setup/status` entry to `src/api/openapi.yaml` (served at `/docs`).
- No middleware change: GET is already public, and the handler checks the session itself.

### 2. UI util: `ui/src/utils/setupStatus.js` (new)

ESM, pure, no React, relative imports with `.js` extensions, so Node suites can
`import(pathToFileURL(…))` it.

`summarizeSetup(answer)` returns `{ answered, steps: { account, follow, activate }, doneCount, pendingCount }`.
- **Answered** means `answer` is a `success: true, signedIn: true` response. Its steps are passed
  through.
- **Any other input** (null, a failure, `signedIn: false`) gives `answered: false`, and every step
  `{ done: false, pending: false, finished: false }`.
- **The counts** are `doneCount` (steps with `done`) and `pendingCount` (steps with
  `pending && !done`, defensively). Nothing else is derived here.

### 3. UI provider: `ui/src/context/SetupStatusContext.jsx` (new)

`SetupStatusProvider` and `useSetupStatus()`, shaped like `AssistantRosterContext.jsx`.

**When it fetches:**
- **Only once asked.** `useSetupStatus()` calls the context's `want()` from an effect, so nothing is
  fetched until a consumer mounts. In story 1 that is only `/setup`; in story 2 it is every page with
  the pill.
- **Only once signed in.** When wanted, and `AuthContext` has finished loading, and `user?.pubkey` is
  set, it fetches `/api/setup/status`.
- **Again when the account changes.** A new `user?.pubkey` fetches again. `user` becoming `null`
  resets the state to `idle`. `refresh()` fetches again on demand.
- **Stale answers are dropped:** use a request counter or a `cancelled` flag, so a late answer for a
  previous account is ignored.

**What it holds:** `{ phase: 'idle' | 'checking' | 'answered' | 'failed', answer }`.
- `failed` covers a network error, a non-JSON answer, `success: false`, and `signedIn: false` from
  the server while `AuthContext` thinks you are signed in (an expired session).

**What `useSetupStatus()` returns:** `{ phase, refresh, ...summarizeSetup(phase === 'answered' ? answer : null) }`.

**Mounting:** in `ui/src/App.jsx`, inside `AssistantRosterProvider`, around `RouterProvider`:

```jsx
<AssistantRosterProvider>
  <SetupStatusProvider>
    <RouterProvider router={router} />
  </SetupStatusProvider>
</AssistantRosterProvider>
```

### 4. The page: `ui/src/pages/setup/Index.jsx`

It reads `useAuth()` for `{ user, loading, login }` and `useSetupStatus()`. Three modes:
- **Auth still loading:** the three steps with no marks, no progress line and no sign-in line. So a
  signed-in viewer never flashes the signed-out line (story 1 AC-1).
- **Signed out:**
  - the same unmarked steps, each still a `<Link>`;
  - no `Done:` or `Not done:` screen-reader prefix, and no progress line or bar;
  - then the signed-out line, and a button that calls `login().catch(() => {})`, exactly as
    `BrainstormUserMenu.jsx:86` does. Failures show in AuthContext's shared LoginErrorModal.
- **Signed in:**
  - the progress line and bar from `doneCount`, with the `aria-valuenow` it already carries;
  - a **done** step renders as a non-link `<div className="bs-setup-step is-done">`: a ✓ marker, the
    label, a "Done" badge, and its done sentence, with the screen-reader prefix "Done: ";
  - a **not-done** step renders exactly as today, as a `<Link>` with "Not done: ". Step 3 swaps its
    sentence for the another-provider sentence when `activate.otherProvider`;
  - when `doneCount === 3`, "You're all set!" after the list.
  - While the check runs, or when it has failed, every step is not done. That is the shipped look,
    with no extra state.
- Delete the `const doneCount = 0` constant and its comment, and update the file's header comment.

### 5. Copy: `ui/src/pages/setup/steps.js`

It stays the single home of `/setup` copy, as its header says. The approved existing strings stay
byte-identical. Add story 1 § Copy, verbatim:
- `CREATE_ACCOUNT_STEP.doneText` and `ACTIVATE_STEP.doneText`;
- `ACTIVATE_STEP.otherProviderText`;
- `followDoneText(n)`: "1 account followed." or "{n} accounts followed.";
- `SETUP_COPY`: the signed-out line, the "Sign in with nostr" button, the "Done" badge, the
  "Done: " and "Not done: " prefixes, and "You're all set!".

### 6. Styles: `ui/src/styles.css`, inside the existing `bs-setup-*` block

- **`.bs-setup-step.is-done`:** the card without the link affordances. Its hover leaves the border
  and background unchanged, and it has no chevron.
- **The done marker** is a filled green circle with a white ✓.
- **`.bs-setup-step-badge.is-done`** is the green counterpart of the amber badge.
- **`.bs-setup-signin`** holds the signed-out line and its button (the top bar's `bs-link-btn` look is
  fine), and **`.bs-setup-all-set`** holds the closing line.
- **Width:** nothing may widen the page at 375 px. The existing `@media (max-width: 480px)` block is
  the place for any adjustment.

### 7. Unchanged

The routes, the placeholder pages, `useAssistantSetupState`, `useTreasureMap`, the Dashboard, the
avatar menus, `relaySource.js`, `profilePublish.js`, `currentMap.js` and `fetchEvents.js`.

### Notes for Test Design (Phase 3; the Tester owns every test change)

- **The seams for dependency-injected suites:**
  - `handleSetupStatus`'s `deps`;
  - `lookupNewest`'s `deps` (`scanLocal`, `readRelay`);
  - `followListRelays` and `treasureMapRelays` (`readConfiguredRelays`, `mapDefaultRelays`,
    `getConfigFromFile`);
  - `evaluateSteps` (pure);
  - `summarizeSetup` (pure ESM).
- **Branches worth pinning:**
  - no session, and `authenticated` not `true`;
  - a local hit with no relay read;
  - a local miss with the newest across relays, including the tie rule;
  - a local scan rejection;
  - no relays configured;
  - every relay unreachable, including a read that outlives the budget;
  - own-relay exclusion (loopback, `BRAINSTORM_RELAY_URL`'s host, `STRFRY_DOMAIN`);
  - the follow count (self, duplicates, non-hex);
  - the Map rules: both entries, rank only, followers only, another provider in either, the first
    valid entry winning over an invalid one, no assistant, the Owner with the TA;
  - the pending invariants;
  - a 500 on an unexpected throw;
  - no query parameter changes the answer.
- **The page has no component harness.** Source-text assertions (the house pattern) plus a live
  browser pass cover it.
- **Live checks.** The endpoint is session-shaped, so the fetch-stub technique (memory
  `verifying-signed-in-ui`) must also answer `/api/setup/status` with a canned response to reach the
  signed-in render paths. Under the stub the server holds no real session and answers
  `signedIn: false`.
- **A genuine server read** needs a real session: for example a throwaway key signing the kind 22242
  challenge (a guest with no assistant). Whether to use one is the Tester's call.
- **The gate** is the one named in book § Test gate. This story also touches `App.jsx` and
  `styles.css`, whose suites a filename grep finds, and `src/api/index.js`.

## Out of scope

- **Where the pill goes, and its markup:** story 2's ADR.
- **A server memo or cache,** polling, or a server-sent refresh.
- **Fixing the other readers** this ADR notices: `useTreasureMap`, `fetchCurrentMap`, `scanLocal`,
  `/api/strfry/scan`, the follow buttons' read, and unifying the app's relay lists or its two strict
  loops.
- **Whether an assistant has a profile.** That stays with `useAssistantSetupState` and the Dashboard.
- **How someone gets an assistant, and the step pages.**
