# ADR 0001: One answer to "does my assistant have a profile?" — local relay first, then the publish relays

**Status:** Accepted
**Date:** 2026-09-11
**Story:** `engineering-team/stories/assistant-profile/1-setup-prompt-tells-the-truth.md`

## Context

The dashboard tells people their assistant "doesn't have a face yet" when it does. Reproduced on
staging and production on 2026-09-11: a logged-out hard load of `/tapestry/` fired
`GET /api/profiles?pubkeys=null` and rendered the "Set up my Assistant's profile" card and an unchecked
"Give your Assistant a profile" item, while each TA's profile was live on its own relay and four
others. The story's rule (ratified at planning, open question resolved at approval): an assistant
*has a profile* when a kind 0 signed by its key is on the local relay, or — if not — on a relay the
instance publishes assistant profiles to; one found only there is copied to the local relay; if the
publish relays cannot be reached, the local answer stands.

### Concept-graph orientation

The local graph answers `{"count":0}` (empty — OPEN.md #69), so per AGENTS.md §2 the fallback is
`firmware/`: the relevant concepts are `39998:<TA>:nostr-relay` (with sets such as
`general-purpose-relays`) and `39998:<TA>:nostr-user`. **Re-verify both handles against a populated
graph** (e.g. staging) before relying on them. This story changes no concept and needs no firmware
reinstall: it is about *which stores are asked* for a nostr event, not about the knowledge graph.

### Codebase facts this design rests on (verified on `d886d98d`)

- **The dashboard check** — `ui/src/pages/Dashboard.jsx:721-728`. It runs in a `useEffect` with `[]`
  deps and reads `taPubkey` from `ConfigContext`, which starts `null` (`ui/src/context/ConfigContext.jsx:10`)
  and is fetched by the *parent* provider's effect — and React runs child effects before parent
  effects, so on a hard load the dashboard always asks about `null` and never re-asks. It then counts a
  profile only if it has `name || picture` (`:25`, `:63`), reading it through `/api/profiles`.
- **`/api/profiles`** (`src/api/profiles/fetchProfiles.js:66-126`) queries the *profile* relays
  (`aProfileRelays`: purplepag.es, profiles.nostr1.com) with a 6 s race; the local relay is consulted
  only for misses, and **not at all if the race times out** (the `catch` at `:123`). Misses are cached
  as `null` for 5 minutes (`:116-122`).
- **The editor's check** — `GET /api/assistant/status` (`src/api/assistant/index.js:385-451`): any
  kind 0 on the **local relay only** (`:411-428`, a `strfry scan` with `limit:1`). The editor
  (`ui/src/components/AssistantProfileEditor.jsx:62-79, 267-272`) and both legacy pages consume it.
- **The two checks target different keys.** The dashboard always checks the instance TA; the editor
  checks `getAssistantKeys(customerPubkey)` — the viewer's own assistant (`src/utils/assistantKeys.js:20-26`).
  The UI already knows the viewer's assistant: `useAuth().user.assistantPubkey`, resolved by the same
  `getAssistantKeys` (`src/api/auth/getUserClassification.js:10-18`); `AuthContext` exposes
  `{ user, loading }` (`ui/src/context/AuthContext.jsx:169`), and hooks already gate on it
  (`const { user, loading: authLoading } = useAuth()` — e.g. `ui/src/hooks/useTagIndex.js:18`).
- **The publish relays are a module constant** — `EXTERNAL_RELAYS` (`src/api/assistant/index.js:26-32`),
  used only by `handlePublishProfile` (`:353-355`). Story 2 will make them configuration-driven.
- **Copying home has a proven mechanism.** `handlePublishProfile` already writes a signed kind 0 to the
  local relay by piping it to `strfry import` (`:331-338`); `strfry import` verifies signatures.
- **Server-side relay reads** use nostr-tools `SimplePool` (v2.10.4 here) with a `ws` global injected
  (`fetchProfiles.js:10-18`); `querySync(relays, filter, { maxWait })` is available and the pool
  verifies each event's signature.
- **The hermetic seam pattern** for server modules that touch strfry and relays is established:
  `src/api/feed/feedReadPath.js:22-31, 228-238` resolves each dependency as
  `options.deps?.X ?? options.X ?? realX`, with real helpers loaded lazily (test-hermeticity-ci #1; the
  bare-checkout trap in `stories/_intake.md`, 2026-07-05).
- **Anonymous GETs are public reads** (`src/middleware/auth.js`: mutations need a session; GETs pass),
  and `/api/assistant/status` is unauthenticated today.

### Constraints

No new dependencies, no build or lint tooling (CLAUDE.md). Principle 4: the local relay is a cache of
this instance's own letters — the check may add to it (a repair), never remove from it. Principle 1:
the question is always "*the viewer's* assistant", never "the instance's". The prompt must never flash
while the answer is still loading, and an error must never read as "no profile".

## Options considered

### Option A — One server-side resolver behind `/api/assistant/status`; the dashboard asks it about the viewer's own assistant

A new resolver implements the story's rule (local → publish relays → copy home) and becomes the only
thing that decides `hasProfile`. `/api/assistant/status` uses it, so the editor and legacy pages get the
rule for free. The dashboard stops using `/api/profiles` and the TA pubkey: once auth has resolved, it
asks `/api/assistant/status` about the signed-in user and renders the prompt only for a definite
"no profile". The publish relays move behind one function that both the publisher and the resolver
call, so the check can never consult a relay the publisher skips.

- **Pros.** One answer for every surface (AC5) by construction, not by keeping two code paths in step.
  Fixes the race by waiting for auth — the prompt is keyed to data that exists before it runs. Targets
  the viewer's assistant (AC3, AC4). Local-first means a slow or dead relay can never erase a local
  profile (AC1), and the copy-home satisfies AC2. The editor needs no change. Story 2 changes one
  function to move both publishing and checking to configured relays.
- **Cons.** A GET that can write to the local relay (the copy-home) — mitigated below by restricting
  the fallback to an authenticated viewer asking about their own assistant (or the operator), and by
  the write being an idempotent restore of this instance's own signed event. A profile-less assistant
  costs a relay round-trip on the first check — bounded by a timeout and a short negative memo.

### Option B — Fix the dashboard in place

Give the effect the right dependencies, pass `user.assistantPubkey` to `/api/profiles`, and make
`fetchProfiles` consult the local relay first.

- **Pros.** Smallest diff; no server contract changes.
- **Rejected.** It leaves two rules for one question — the dashboard's (`name || picture`, via profile
  relays) and the editor's (any kind 0, local only) — so AC5 depends on two code paths staying in step.
  It reads the *profile* relays, not the *publish* relays, so a profile published only to damus or
  nos.lol is missed. It has no copy-home (AC2). And changing `fetchProfiles` alters every display
  surface that reads profiles, a wider blast radius than this story.

### Option C — A new dedicated endpoint for setup state

`GET /api/assistant/profile-state?customerPubkey=`, used by the dashboard, with the editor left on
`/status`.

- **Pros.** Keeps `/status` lean; a narrow contract to test.
- **Rejected.** Two endpoints must now agree (AC5) — they would share the resolver, so the second
  endpoint buys nothing but surface area. `/status` already carries exactly the needed fields and is
  already what the editor and legacy pages trust.

## Decision

We chose **Option A**.

The decisive fact is AC5: every surface must give the same answer at the same moment. Option A makes
that true structurally — one resolver, one endpoint, every surface a consumer — where B and C would
make it a discipline to maintain. Waiting for auth before asking fixes the race at its cause (the check
was keyed to data that did not exist yet) rather than papering over it, and asking about
`user.pubkey` answers the POV question — *whose* assistant — in the same move.

**What we trade away:** `/api/assistant/status` gains a side effect on one path (copy-home). We accept
it because it only ever restores this instance's own validly-signed event, it is idempotent (strfry
de-duplicates by event id), and it is unreachable to anonymous callers.

## Consequences

- **Enables:** one setup answer everywhere; story 2 changes where profiles are published *and* checked
  by editing one function; story 4's page consumes the same endpoint; a wiped or restored local relay
  heals itself the first time its owner looks.
- **Constrains:** `hasProfile` now means *existence on the local relay or a publish relay*, not "has a
  name or picture". A published profile with no name counts as set up (the story's stated scope).
- **Latency:** for an assistant with no profile anywhere, the first check waits up to the relay budget
  (below) before the prompt appears; later checks within the negative-memo window answer from the
  local relay alone. A profile that exists locally is answered with no relay traffic at all.
- **Follow-ups / debt:**
  - `/api/profiles` still skips its local fallback when its relay race times out (`fetchProfiles.js:123`).
    After this ADR no setup surface depends on it, but display surfaces (profile pages, avatars) do —
    a candidate OPEN.md row, not in this story.
  - The "Surprise me" button survives this story for the Owner only (see below); story 5 removes it.
  - The status early-return for a user with no key (`index.js:399-401`) still omits `isOwner` — story 4.
- **Firmware reinstall required?** **No.** No concept definitions change.

## Implementation notes

**New — `src/api/assistant/profileState.js`.** Exports `resolveAssistantProfileState(options)` →
`{ hasProfile, profile, event, source }`, where `source` is `'local' | 'relay' | null`.

- `options`: `{ assistantPubkey, allowRelayFallback }` plus injected deps, read the feedReadPath way
  (`options.deps?.X ?? options.X ?? realX`): `scanLocalKind0(pubkey) → event|null`,
  `queryRelaysKind0(relays, pubkey, { maxWait }) → event[]`, `importEvent(event) → Promise<void>`,
  `getPublishRelays() → string[]`, `now() → ms`, `memo` (a `Map`).
- Order, exactly:
  1. `scanLocalKind0` — the same `{"kinds":[0],"authors":[pk],"limit":1}` scan `/status` runs today.
     Found → `{ hasProfile: true, source: 'local' }`. **No relay traffic.**
  2. If `!allowRelayFallback` → `{ hasProfile: false, source: null }`.
  3. If `memo` holds a not-found entry younger than `NEGATIVE_MEMO_MS` (5 min) →
     `{ hasProfile: false, source: null }`.
  4. `queryRelaysKind0(getPublishRelays(), pk, { maxWait: RELAY_BUDGET_MS })` with
     `RELAY_BUDGET_MS = 4000`, also raced against an outer timeout of the same length so a hung socket
     cannot hold the request. Keep only events with `kind === 0 && pubkey === pk`; take the newest by
     `created_at`. Any error or timeout is **not found** (the local answer stands).
  5. Found → `await importEvent(newest)`; on import failure log it and still return
     `{ hasProfile: true, source: 'relay' }` (the profile exists; the next check retries the repair).
     Not found → record `memo.set(pk, now())` and return `{ hasProfile: false, source: null }`.
- Real helpers are **required lazily inside their functions**, never at module top level, so the module
  loads in a bare checkout: the local scan and the import shell out to `strfry` exactly as
  `index.js:411-428` and `:331-338` do (move that code here and have `index.js` call it — one copy);
  the relay query uses `SimplePool.querySync` with the `ws` global injection from `fetchProfiles.js:10-18`
  and closes the pool afterwards.

**Changed — `src/api/assistant/index.js`.**

- Add and export `getAssistantPublishRelays()`, returning today's list; delete the `EXTERNAL_RELAYS`
  constant; `handlePublishProfile` calls the function (no behaviour change). This is the seam story 2
  replaces with configured relays.
- `handleAssistantStatus`: replace the inline scan (`:411-428`) with
  `resolveAssistantProfileState({ assistantPubkey: relayKeys.pubkey, allowRelayFallback })`, where
  `allowRelayFallback` is true when the session is authenticated **and** its pubkey equals
  `customerPubkey`, or `isOwnerOrAdmin(req)`, or `req.localTrusted` (the in-container operator path).
  Anonymous callers keep today's local-only answer, so a public GET never writes. Response: keep every
  existing field; `hasProfile`/`profile` come from the resolver; add `profileSource`.

**New — `ui/src/hooks/useAssistantSetupState.js`.** Returns `{ status, refresh }`, with `status` one of
`'loading' | 'no-assistant' | 'set-up' | 'needs-setup' | 'unknown'`.

- `const { user, loading: authLoading } = useAuth()`; the effect's deps are
  `[authLoading, user?.pubkey, user?.assistantPubkey]`. While `authLoading` → `'loading'`. No `user` or
  no `user.assistantPubkey` → `'no-assistant'`, with no request. Otherwise fetch
  `/api/assistant/status?customerPubkey=${user.pubkey}` → `'set-up'` or `'needs-setup'` from
  `hasProfile`. Any fetch or parse failure → `'unknown'` (renders nothing — an error is never "no
  profile"). Guard against a late response after the user changed (ignore stale results).

**Changed — `ui/src/pages/Dashboard.jsx`.**

- Remove the `taProfile` state and the `/api/profiles?pubkeys=${TA_PUBKEY}` effect (`:721-728`).
- `WelcomeCard` renders only when `status === 'needs-setup'`; nothing renders for any other status.
- `OnboardingChecklist`: include the "Give your Assistant a profile" item only when `status` is
  `'set-up'` or `'needs-setup'`, with `done = status === 'set-up'`. The onboarding block renders once
  `status !== 'loading'`.
- The prompt's buttons go where *this viewer* can publish their own assistant's profile:
  `'/tapestry/settings/assistant'` for `owner` and `admin`, `'/settings'` for everyone else (story 4
  later points all of them at the My Assistant page).
- **"Surprise me" renders only for `user.classification === 'owner'`** — its write signs as the
  instance TA, which is the Owner's assistant and nobody else's (AC4). It takes the pubkey for its
  robohash URL from `user.assistantPubkey`, not `ConfigContext`, and calls `refresh()` on success
  instead of setting a local profile.

**Unchanged, deliberately:** `AssistantProfileEditor.jsx` (its "Currently published" line and its
post-publish reload already consume `/status`); the legacy pages (same); `fetchProfiles.js`.

**Testability note for Phase 3 (not a test plan).** The resolver is the heart and is stack-free with
injected deps: every branch — local hit with no relay call, relay hit with exactly one import of the
newest valid event, relay miss, relay timeout, fallback disallowed, memo within and beyond its window,
import failure — is a pure call. The dashboard's race fix and gating are visible in source (no
`/api/profiles?pubkeys=` fetch on the prompt path; the hook's deps include the auth user) and in a
browser (no `pubkeys=null` request and no card on a visitor's hard load). The live contract can be
driven through the in-container loopback (`docker exec tapestry curl 127.0.0.1:7778/...`), which is
`localTrusted` and therefore exercises the relay fallback; staging is where the reproduced bug must be
seen gone.

## Out of scope

- Which relays are in the publish set, and honest per-relay publish reporting — story 2.
- What the default profile contains — story 3.
- The single My Assistant page and repointing every entry point — story 4.
- Removing "Surprise me" and the other writers — story 5.
- Whether a published-but-stale profile should prompt ("needs attention") — epic, Deferred.
- The `/api/profiles` timeout gap on display surfaces — named above as a follow-up.
