# ADR 0001: One assistant-attention answer — the four identification taggings checked on the server for the viewer's own Assistant, shared by the hub, the pill and the page

**Status:** Accepted (approved 2026-09-22)
**Date:** 2026-09-22
**Story:** `engineering-team/stories/assistant-identification-tags/1-the-one-answer-and-the-hubs-first-real-mark.md`

## Context

Story 1 gives the Identification Tags action its real "needs attention" answer and makes the hub's
card, its count line and the Assistant Alert read it, while the other nine actions still count. In
short:

- **AC-1.** One required list, the same everywhere, shipped with the app: My Tapestry Assistant and My
  Agent (you on your Assistant), My Tapestry Owner and My Human (your Assistant on you). Each entry
  names the tag (name, slug, canonical address), the direction and the signer.
- **AC-2.** The answer is about the session's own Assistant. No parameter changes whose it is.
- **AC-3.** Present = the required signer's latest live tagging of a tag with the required name, on the
  required target, applies it; whoever authored the tag definition; others' disputes change nothing;
  the signer's own dispute or retraction makes it missing. This instance's relay first; the outside
  relays this instance reads tags from only on a local miss.
- **AC-4.** Finished, as `/setup` means it, with a reason when not.
- **AC-5.** The hub's card is marked unless the check finished and all four are present; the count line
  counts it the same way; the pill counts it only when the check finished and a tagging is missing;
  the other nine are unchanged.
- **AC-6.** Each tagging's canonical definition is reported found or not; that never gates "present".
- **AC-7.** Read-only; one request per full page load for a signed-in viewer, plus on-demand refresh.

**Settled before this ADR** (Discovery 2026-09-22; story approval 2026-09-22): the canonical author is
the owner's own key, BIBLE §20's npub for wds4/straycat,
`e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f`; the slugs are
`my-tapestry-assistant`, `my-agent`, `my-tapestry-owner`, `my-human`; "present" needs no outside relay
(local suffices).

### Concept-graph orientation (local stack, TA `8387ec0e…`, 2026-09-22)

- `/summaries` lists 56 concepts. `tag` has 0 elements in 2 sets; `nostr-user-tag` 0 in 2;
  `nostr-user` 0 in 1. Nothing models an assistant.
- `/node/39998:<TA>:tag/neighbors` and `…:nostr-user-tag/neighbors` show class-thread wiring only
  (schema, superset, properties, graphs) and a `REFERENCES` edge to the legacy handle
  `39998:82b75e47…:<slug>`: the deployed z-stamps are the ADR 0015 literal plus the runtime local z.
- **No concept changes. No firmware reinstall.**

### Codebase facts this design rests on (verified on `4ff93dd4`, origin/staging after PR #746)

- **The hub's answer today.** `assistantAttention(user)` (`ui/src/pages/assistant/actions.js:220-224`)
  is pure and synchronous: every action for a viewer with `user.assistantPubkey`, none otherwise.
  `Index.jsx:49` and `TopBarAlert.jsx:36` both call it; the pill's count is the page's count.
  `actions.js` has one import (`avatarMenuLinks.js`) so `test/assistant-management-page.test.js`
  and `test/assistant-alert.test.js` load it as ESM in Node.
- **The one-answer pattern, shipped.** `src/api/setup/status.js` (ADR setup-status-and-alert/0001):
  a session-shaped handler with injectable deps; `scanLocalStrict` (rejects on a failed scan);
  `lookupNewest` (local first, outside only on a miss, `finished` only when the local relay held it
  or at least one outside relay answered; `RELAY_BUDGET_MS = 8000`); `outsideOnly` (drops this
  instance's own relay). Its module exports all of these. ADR 0001 § Consequences already noted:
  "This module's parallel per-relay loop repeats `readStrict` … Unify them if a third caller
  appears." This ADR is that third caller.
- **The provider pattern, shipped.** `ui/src/context/SetupStatusContext.jsx`: phases
  `idle | checking | answered | failed`, a request key `${pubkey}#${assistantPubkey}#${attempt}`,
  `want()` from the hook's effect, `refresh()`, and since PR #746 an `onEventPublished` listener
  (`ui/src/utils/nostrPublish.js:26`) that re-checks after the app publishes the viewer's own kind 3 or
  10040 (ADR setup-status-and-alert/0003 Amendment 1: `publishEverywhere` announces once, straight
  after its local write). `ui/src/utils/setupStatus.js` is the pure ESM summarizer. `pickTopBarPill`
  (`ui/src/utils/topBarAlert.js`) is pure; setup first; it takes `assistantCount`.
- **The tagging's wire shape** (`ui/src/utils/publishProfileTag.js:61-90`, spec
  `protocols/drafts/tags.md` § Taggings): kind 39999 with
  `["d", "profile-tag-<slug>-<target[0:8]>-<signer[0:8]>"]`, `["p", target]`, `["a", "39999:<tagAuthor>:<slug>"]`,
  `["e", tagEventId]`, two `z` stamps (the ADR 0015 literal, the runtime local), `["polarity", "1"|"-1"]`.
  **The `d` tag is deterministic per (signer, slug, target) and embeds the slug, not the tag's
  author.** So a signer has one replaceable address per stance on a slug and a target, whichever
  same-named tag they pointed at. A `#d` lookup is therefore author-agnostic, which is exactly AC-3's
  "whoever authored the tag definition". Polarity: absent means apply; `>= 0.5` applies, `<= -0.5`
  disputes (`src/api/profile-tags/index.js:141-152`).
- **Retraction.** `useProfileTags.revoke` publishes a kind 5 naming the assertion. The local relay
  drops it: probed on the dev stack on 2026-09-22 with a throwaway key (one kind 39999 imported;
  a same-author kind 5 imported; the scan then returns 0 and keeps the kind 5). Outside relays vary,
  which is why the local answer stands when it has one.
- **Why the existing tag reads do not answer the question.**
  `GET /api/profile-tags/tags-for-profile` applies the POV's WoT rank filter
  (`profile-tags/index.js:259-285`), so a viewer below the house threshold would read their own
  claim as absent. `federatedScan`'s remote leg is `SimplePool.querySync`, which resolves empty for a
  relay it could not reach (`index.js:103-128`; OPEN.md row 314), so it cannot say "finished".
- **Where taggings are read from outside:** `aRelays.aTagFederationRelays`, opt-in and empty by
  default (`src/config/defaults.json`); `wss://dcosl.brainstorm.world` on staging and production
  (`GET /api/relays`, 2026-09-22); none on this dev stack. `readConfiguredRelays(categories)`
  (`src/api/assistant/profilePublish.js:70`) reads any category list.
- **The strict per-relay reader:** `readRelayEvents(url, filter)` (`src/api/_shared/relaySource.js`),
  `ok` only from a relay proven reachable that sent EOSE, kind and author re-checked, signatures
  verified.
- **Shared CommonJS libraries reach the UI** through Vite aliases: `@tapestry/event-tagging` →
  `src/lib/event-tagging`, `@tapestry/broadcast-outcome` → `src/lib/broadcastOutcome.js`
  (`ui/vite.config.js:12-33`, with `build.commonjsOptions.include`). The Node runner cannot execute
  `ui/src`, so anything both sides need lives under `src/lib/`.
- **What exists on the network.** No tag element on this dev stack (`available-tags` → 0). On staging
  and production, 3,332 tags, among them one "My Agent" (`39999:6db8a13f…:my-agent`, "Reserved for
  npubs operated by your AI agent") by a community member, applied to one agent. None of the other
  three, and none by the owner's key. A tagging pointing at that "My Agent" has
  `d = profile-tag-my-agent-…`, so it counts as present under AC-3.
- **Tests that pin today's answer** (the method of ledger `2026-09-21-adr-reaim-list-misses-outcome-asserts`,
  by grep for `assistantAttention`, `10 actions`, `count: 10`):
  - `test/assistant-management-page.test.js` D7 (`:244-264`): `assistantAttention(user)` answers all
    ten keys and `count: 10` for a viewer with an assistant, reshaped to `{hasAssistant, needsAttention, count}`;
    W4 (`:379-385`): `Index.jsx` calls `assistantAttention(`.
  - `test/assistant-alert.test.js` (`:107-182`): the pure picker with `assistantCount: 10` gives
    `{pill:'assistant', count:10}`; a W sentinel (`:228`) wants `assistantAttention(` in `TopBarAlert.jsx`.
  - `tests/brainstorm/assistant-alert.spec.js` and `assistant-management-page.spec.js`: the signed-in
    fixture mocks `/api/auth/*` and `/api/setup/status` and expects "10 actions need attention" on the
    pill and the hub. A request to a route the fixture does not mock fails, which this design reads
    as `failed`.

### Constraints

- **Principle 1 (POV).** The viewer's own Assistant: `getAssistantPubkeyFor(session.pubkey)`, the one
  mapping. For the Owner it is the instance TA (as `/setup` decided). No pubkey parameter.
- **Principle 2.** Reads gate nothing: any author's same-named tag counts; the WoT filter is not
  applied to a person's own claims. The canonical author is a *convention for publishing*, not a
  filter for reading.
- **Principle 3.** No stored answer, no memo, no polling. Re-derived per request.
- **Principle 4.** Read-only; nothing in Neo4j, LMDB or strfry is written.
- **The TA pubkey is never hardcoded.** The canonical author's key *is* a literal, and it is not the
  TA's: it is the owner's personal key naming four well-known tag definitions, a protocol constant of
  the same class as the ADR 0015 legacy z pubkey. It is never used as an author filter for
  TA-signed events, as a signer, or in a concept handle. Sub-decision 2 keeps it in one place.
- **House stack:** JS without build, no new tooling; `actions.js` stays loadable in Node with its one
  import; the shared list lives where both the server and the UI can load it.
- **A parallel book owns `/setup`.** `src/api/setup/status.js` merged its third story minutes before
  this design (PR #746). This ADR reuses its exports and edits nothing in it (sub-decision 3).

## Options considered

### Option A — One session-shaped server answer for every checked action, `GET /api/assistant/attention`, held by one app-level provider (chosen)

A new server module answers, for the session's viewer, a map of the actions that have a real check,
today only `identification-tags`, each with `finished`, `done`, `pending` and its detail (the four
taggings and their definitions). One provider fetches it once per page load; `assistantAttention`
merges it with the placeholder actions; the page (story 2) reads the same answer's detail.

**Pros**
- One definition of present, finished and pending, in one Node module a dependency-injected suite
  drives branch by branch, as `setup-status.test.js` does.
- One request per page load, however many actions gain checks: the pill is on every page.
- POV-safe by construction: no pubkey parameter.
- The server holds everything the rule needs: the strict reader, the relay settings, the assistant
  mapping, the local scan that reports its own failure.
- The shape scales: the next action adds a key to the map and its check to the module, and the hub
  and the pill read it with no change.

**Cons**
- A new route, so a server change: `/cycle-local` locally, the normal deploy on staging.
- One request may grow heavy as actions gain checks. Today it is up to three local scans and, on
  local misses, one read per tag-federation relay under the 8 s budget. Measure before splitting
  (principle 3).

### Option B — One endpoint per action, and the hub composes them

`GET /api/assistant/identification-tags` for this action; later actions add their own; the hub
fetches each.

**Pros:** each action's module is separate from the start.
**Cons:** N requests per page load for the pill, one per checked action; N provider-or-state slots
to keep coherent; the "one answer the pill counts" property of assistant-management #2 becomes a
composition the client must get right. Rejected: Option A keeps per-action modules on the server
(one function per action) without the client cost.

### Option C — Compute it in the browser from the existing tag endpoints

`/api/profile-tags/tags-for-profile` for the Assistant (the viewer's taggings) and for the viewer
(the Assistant's), plus `/api/profile-tags/available-tags` for the definitions.

**Rejected:** the WoT filter can hide the viewer's own claim; the remote leg cannot say "finished";
four to six requests per page load; and the relay policy would move into the browser, the same
objections ADR setup-status-and-alert/0001 raised against its Option B.

## Decision

We chose **Option A.** "Finished" is a property of how relays were read, and only the server can read
them honestly; one answer keeps the hub, the pill and the page from disagreeing; and one request per
page load is the budget the pill already set.

### Sub-decisions

**1. The required list is a shared CommonJS library, `src/lib/identification-tags/`.**

- Pure, dependency-free, loadable by the Node runner, the server and (through a Vite alias
  `@tapestry/identification-tags`) the UI, like `src/lib/event-tagging`.
- It exports the list, the canonical author, the address and `d`-tag composers, and the polarity
  reader. Story 2's page renders its rows from the list; the server checks from it.

**2. The canonical author is one constant, `CANONICAL_TAG_AUTHOR`, in that library.**

- Its comment says what it is: the owner's personal key (BIBLE §20), naming four well-known tag
  definitions the owner publishes once; a publishing convention, never a read filter, never a signer,
  never a TA. The four canonical addresses are `39999:<that key>:<slug>`.
- Anyone reading the code who sees a 64-hex literal finds this comment and the epic's guardrail.
  The protocols directory records the convention (§ Consequences).

**3. Each tagging is looked up by its replaceable address, local first, as `/setup` looks up a kind.**

- Filter: `{ kinds: [39999], authors: [signer], '#d': [profile-tag-<slug>-<target[0:8]>-<signer[0:8]>] }`.
  The `d` is the spec's deterministic address of that signer's stance on that slug and target, so
  the newest event at it *is* the latest stance, whichever same-named tag it points at (AC-3).
- This instance's relay first (`scanLocalStrict`); on a miss, the outside tag relays
  (`outsideOnly(readConfiguredRelays(['aTagFederationRelays']))`), each through `readRelayEvents`
  under `RELAY_BUDGET_MS`; `finished` exactly as `lookupNewest` defines it, with the same three
  reasons. The local answer stands when it has one, so a retraction the local relay honoured is a
  miss here even if an outside relay still holds the old apply.
- The new module imports `scanLocalStrict`, `outsideOnly` and `RELAY_BUDGET_MS` from
  `src/api/setup/status.js` and writes its own multi-address lookup. It does not edit that file
  (a parallel book's module, merged minutes ago). The third strict lookup is named as debt.
- Present = the newest event at that address exists and its polarity is `>= 0.5`. Missing = none, or
  polarity `<= -0.5`, or a neutral polarity (not counted, as the reads do today).

**4. The four canonical definitions are looked up the same way and reported, never gating.**

- Filter: `{ kinds: [39999], authors: [CANONICAL_TAG_AUTHOR], '#d': [slug] }`, local first, outside
  on a miss. Each tagging's answer carries `definition: { found, finished, reason?, source, eventId,
  address }`, which story 2 needs to build a tagging (`a` = address, `e` = eventId) and to say "tag
  not found".

**5. The action's three flags, from its four taggings.**

- `finished` = every tagging's check finished.
- `done` = finished and every tagging present.
- `pending` = at least one tagging's check finished and found it missing. (Confident that something
  is missing, even while another tagging's check is unfinished.)

**6. Two readings of one answer, in `assistantAttention(user, attention)`.**

- The page reading, `needsAttention` and `count`: a checked action is marked unless its answer says
  `done`. So it is marked while checking, when the fetch failed, and when the check did not finish,
  as `/setup` shows a step as not done until it knows.
- The pill reading, `alertCount`: a checked action counts only when its answer says `pending`.
- A placeholder action (no check yet) is marked and counted in both, as today. Which actions have a
  check is a static list in `actions.js`, `CHECKED_ACTIONS = ['identification-tags']`, so a failed
  fetch cannot make the pill count a checked action as a placeholder.
- The signature keeps its first argument and its three fields, so `assistantAttention(user)` still
  answers all ten for a viewer with an assistant (the page reading; test D7). `alertCount` is added.

**7. One provider, `AssistantAttentionProvider`, shaped like `SetupStatusProvider`.**

- Fetches `GET /api/assistant/attention` only once wanted, only for a signed-in viewer whose
  `user.assistantPubkey` is set (nothing to check otherwise), again when the account or its assistant
  changes, and on `refresh()`.
- Re-checks after the app publishes a tagging by the viewer or their Assistant: an
  `onEventPublished` listener for a kind 39999 whose `pubkey` is the viewer's or their assistant's and
  whose `d` starts with `profile-tag-`. Story 2's publish goes through `publishEverywhere`, so the
  hub and the pill catch up on their own; story 3's server publish calls `refresh()` itself.
- Mounted in `App.jsx` inside `SetupStatusProvider`, around the router.

**8. The pill waits for the answer.** `pickTopBarPill` gains `assistantPhase` (default `'answered'`,
so every existing caller and test is unchanged): after the setup branches, `'checking'` draws no
pill. So the count never changes under the viewer from 9 to 10; setup still comes first and is not
delayed by this fetch.

**9. The route, its document, and BIBLE.** `app.get('/api/assistant/attention', …)` beside
`/api/setup/status` in `src/api/index.js`; an entry in `src/api/openapi.yaml` next to
`/api/setup/status`'s; one row in BIBLE §11's API table and a bump of its "Last updated" line.

**What we trade away**
- A server change and a new route.
- A page reading and a pill reading that differ while a check is unfinished or failed (the page
  marks, the pill does not count). They agree once the check finishes, which the story accepts.
- A third copy of the strict local-then-outside lookup, until the three are unified.
- One 64-hex literal in a shared library, explained where it lives.

## Consequences

- **Enables:** story 2's page reads the same answer's `taggings` rows and refreshes it after a
  publish; story 3's card calls `refresh()`; the next action with a real check adds one key to the
  map and one function to the module.
- **Constrains:** "finished" needs an outside tag relay to answer on a local miss. On this dev stack,
  with no tag-federation relay, a missing tagging never finishes: the hub marks the card, the pill
  does not count it. On staging (dcosl) it finishes. That is the `/setup` rule, and deliberate.
- **Latency:** all four present locally: three local scans, no relay traffic. Any local miss: one
  read per tag-federation relay, capped at 8 s, per page load for a signed-in viewer with an
  assistant. No memo (principle 3): measure before adding one.
- **Load:** one request per full page load for a signed-in viewer with an assistant, on every page,
  because the pill is on every page. One more per publish of a tagging by the viewer or their
  Assistant.
- **The convention outside the code.** The four well-known tags (name, slug, canonical author) are a
  reading convention for outside clients. The Implementer adds nothing to `protocols/`; the book
  proposes a docs-lane note in `protocols/drafts/tags.md` ("Well-known tags: Assistant
  identification"), which changes no wire format, for the owner to approve at the book's end.
- **Debt this ADR notices and does not fix** (the Reviewer decides whether they become ledger rows):
  - the strict local-then-outside lookup now has three copies (`src/api/setup/status.js`,
    `src/api/relay/fetchEvents.js:34`, this module). ADR setup-status-and-alert/0001 asked for the
    unification at the third caller; this ADR defers it to a quiet moment outside the two parallel
    books, so as not to edit the setup module mid-flight;
  - `readPolarity`/`bucketize` exist in `src/api/profile-tags/index.js` and now in the shared library;
    the profile-tags module could import the library's copy later;
  - the tagging `d`-tag rule now has two homes: `publishProfileTag.js` (the publisher) and the
    library's composer. A source sentinel keeps them equal until the publisher imports the library.
- **Firmware reinstall required?** No. No concept definitions change.

## Implementation notes

### 1. Shared library: `src/lib/identification-tags/index.js` (new, CommonJS, no imports)

```js
const CANONICAL_TAG_AUTHOR = 'e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f';
const TAGGING_D_PREFIX = 'profile-tag-';
const REQUIRED_TAGGINGS = [
  { key: 'my-tapestry-assistant', name: 'My Tapestry Assistant', slug: 'my-tapestry-assistant', signer: 'person',    target: 'assistant' },
  { key: 'my-agent',              name: 'My Agent',              slug: 'my-agent',              signer: 'person',    target: 'assistant' },
  { key: 'my-tapestry-owner',     name: 'My Tapestry Owner',     slug: 'my-tapestry-owner',     signer: 'assistant', target: 'person' },
  { key: 'my-human',              name: 'My Human',              slug: 'my-human',              signer: 'assistant', target: 'person' },
];
```

- Each entry also carries `address: canonicalTagAddress(slug)` (`39999:<CANONICAL_TAG_AUTHOR>:<slug>`),
  computed once at module load.
- `canonicalTagAddress(slug)`; `taggingDTag({ slug, targetPubkey, signerPubkey })` →
  `${TAGGING_D_PREFIX}${slug}-${targetPubkey.slice(0, 8)}-${signerPubkey.slice(0, 8)}` (the
  publisher's rule, `publishProfileTag.js:61`, verbatim); `readPolarity(event)` (absent → 1, a
  non-number → 1); `polarityBucket(n)` → `'apply' | 'dispute' | 'neutral'`; `isTagging(event)`
  (kind 39999 and a `d` starting with the prefix).
- `signerAndTarget(entry, { personPubkey, assistantPubkey })` → `{ signerPubkey, targetPubkey }`.
- The header comment states what `CANONICAL_TAG_AUTHOR` is and is not (sub-decision 2), and points at
  the discovery brief and this ADR.
- `ui/vite.config.js`: alias `'@tapestry/identification-tags'` → `src/lib/identification-tags`, and
  `/src\/lib\/identification-tags/` in `build.commonjsOptions.include`, beside the event-tagging
  entries. Story 2 is its first UI importer; story 1 adds the alias so story 2 touches no build config.

### 2. Server: `src/api/assistant/attention.js` (new, CommonJS, dependency-injected)

Plain CommonJS in the `handleSetupStatus(req, res, deps = {})` idiom. Heavy requires stay lazy inside
`defaultDeps()` so the module loads in a bare checkout.

**Exports:** `handleAssistantAttention(req, res, deps = {})`; the pieces suites drive:
`lookupByAddresses({ kind, author, ds, relays }, deps)`, `checkIdentificationTags({ viewer, assistantPubkey }, deps)`,
`evaluateIdentificationTags({ entries })` (pure), `tagRelays(deps)`; the constant
`TAG_RELAY_CATEGORIES = ['aTagFederationRelays']`.

**Default dependencies:** `getAssistantPubkeyFor` (`../../utils/assistantKeys`);
`scanLocal: (filter) => scanLocalStrict(filter)` and `outsideOnly`, `RELAY_BUDGET_MS` from
`../setup/status`; `readRelay: readRelayEvents` (`../_shared/relaySource`); `readConfiguredRelays`
(`./profilePublish`); `getConfigFromFile` (`../../utils/config`).

**The viewer:** `req.session.pubkey`, lowercased, when `req.session.authenticated === true` and it is
64-hex; else `null`. **No query parameter is read.**

**`lookupByAddresses({ kind, author, ds, relays }, deps)`** → `{ [d]: lookup }`, one entry per `d`,
each shaped as `lookupNewest`'s result: `{ finished: true, event, source: 'local' | 'relay' | null }`
or `{ finished: false, reason: 'local-unreadable' | 'no-outside-relays' | 'outside-unreachable' }`.

1. One local scan, `{ kinds: [kind], authors: [author], '#d': ds }`. A rejection makes every `d`
   `local-unreadable`. Keep events whose `kind`, `pubkey` (case-blind) and `d` match; per `d` the
   newest (created_at, then the lexically lowest id) is `{ finished: true, event, source: 'local' }`.
2. The `d`s not found locally: none left → done. No relays → each is `no-outside-relays`.
3. Otherwise one read per relay, all at once, with only the missing `d`s in the filter, each raced
   against `RELAY_BUDGET_MS` (a throw or a lost race is `unreachable`; clear every timer). No relay
   `ok` → each missing `d` is `outside-unreachable`. Else, per missing `d`, the newest event across
   the `ok` reads (`source: 'relay'`), or `{ finished: true, event: null, source: null }`.

**`tagRelays(deps)`** = `outsideOnly(deps.readConfiguredRelays(TAG_RELAY_CATEGORIES), deps)`.

**`checkIdentificationTags({ viewer, assistantPubkey }, deps)`:**
1. For each `REQUIRED_TAGGINGS` entry, `signerAndTarget(entry, { personPubkey: viewer, assistantPubkey })`
   and its `d`. Group by signer: one `lookupByAddresses({ kind: 39999, author: signer, ds, relays })`
   per signer (two calls), plus one for the definitions:
   `lookupByAddresses({ kind: 39999, author: CANONICAL_TAG_AUTHOR, ds: slugs, relays })`. The three
   run in parallel; `relays = tagRelays(deps)` is computed once.
2. `evaluateIdentificationTags({ entries })`, where each entry is `{ required, lookup, definition }`.

**`evaluateIdentificationTags({ entries })`** is pure. Per entry, `tagging = { key, name, slug, signer,
target, present, finished, source, reason?, definition }`:
- an unfinished lookup → `present: false, finished: false, reason, source: null`;
- a finished lookup → `finished: true, source`, `present = !!event && polarityBucket(readPolarity(event)) === 'apply'`;
- `definition`: `{ finished, found, source, reason?, eventId, address }` from its lookup:
  `found = !!event` when finished, `null` when not; `eventId = event ? event.id : null`.
- The action: `finished = every tagging finished`; `done = finished && every present`;
  `pending = some (finished && !present)`. Invariants the suites pin: `done ⇒ finished`,
  `done ⇒ !pending`, `pending ⇒ !done`.

**Responses:**

```json
{ "success": true, "signedIn": false }
{ "success": true, "signedIn": true, "hasAssistant": false, "actions": {} }
{
  "success": true, "signedIn": true, "hasAssistant": true,
  "actions": {
    "identification-tags": {
      "finished": true, "done": false, "pending": true,
      "taggings": [
        { "key": "my-tapestry-assistant", "name": "My Tapestry Assistant", "slug": "my-tapestry-assistant",
          "signer": "person", "target": "assistant", "present": true, "finished": true, "source": "local",
          "definition": { "finished": true, "found": true, "source": "local", "eventId": "…", "address": "39999:e5272de9…:my-tapestry-assistant" } },
        { "key": "my-agent", "…": "…", "present": false, "finished": false, "reason": "no-outside-relays", "source": null,
          "definition": { "finished": false, "found": null, "reason": "no-outside-relays", "source": null, "eventId": null, "address": "…" } }
      ]
    }
  }
}
```

- The answer carries no viewer or assistant pubkey, as `/api/setup/status` carries none. The
  definition's `address` names the canonical author, a public constant, and its `eventId` a public
  event.
- An unexpected throw → `500 { "success": false, "error": "Could not check assistant attention" }`.

**Read-only.** The module requires no importer, signer or publish helper and writes nothing.

**Registration:** `src/api/index.js`, beside `setupStatus` (`:554-555`):
`app.get('/api/assistant/attention', assistantAttention.handleAssistantAttention)`. No middleware
change: GET is public, and the handler checks the session itself. **OpenAPI:** a `/api/assistant/attention`
entry beside `/api/setup/status`'s (`src/api/openapi.yaml:227`), read-only, no parameters, the three
answer shapes.

### 3. UI util: `ui/src/utils/assistantAttention.js` (new, ESM, pure, no React, relative imports with `.js`)

`summarizeAttention(answer)` → `{ answered, hasAssistant, actions }`:
- `answered` = `answer` is a `success: true, signedIn: true` object with an `actions` object;
- `hasAssistant` = `answered && answer.hasAssistant === true`;
- `actions` = `answered ? answer.actions : {}`.
Nothing else is derived here; the merge is `assistantAttention`'s (sub-decision 6).

### 4. UI provider: `ui/src/context/AssistantAttentionContext.jsx` (new)

`AssistantAttentionProvider` and `useAssistantAttention()`, shaped line for line like
`SetupStatusContext.jsx`:
- request key `${pubkey}#${assistantPubkey}#${attempt}`, set only when wanted, auth is not loading,
  `user.pubkey` and `user.assistantPubkey` are both set; `null` resets to `idle`;
- fetch `/api/assistant/attention`; `answered` on `success: true, signedIn: true`; else `failed`;
  stale answers dropped by the request key;
- `onEventPublished` listener: `ev.kind === 39999`, `ev.pubkey` is `user.pubkey` or
  `user.assistantPubkey`, and its `d` tag starts with `profile-tag-` → `refresh()`;
- `useAssistantAttention()` returns `{ phase, refresh, ...summarizeAttention(phase === 'answered' ? answer : null) }`.

**Mounting** (`ui/src/App.jsx:516-520`):

```jsx
<AssistantRosterProvider>
  <SetupStatusProvider>
    <AssistantAttentionProvider>
      <RouterProvider router={router} />
    </AssistantAttentionProvider>
  </SetupStatusProvider>
</AssistantRosterProvider>
```

### 5. The merge: `ui/src/pages/assistant/actions.js`

- Add `export const CHECKED_ACTIONS = ['identification-tags'];` with a comment: the actions whose
  answer comes from `/api/assistant/attention`; the rest are placeholders that count everywhere.
- Replace `assistantAttention` with the two-reading version of sub-decision 6, signature
  `assistantAttention(user, attention = null)`, `attention` being what `useAssistantAttention()`
  returns (or anything with `answered` and `actions`). Return `{ hasAssistant, needsAttention, count, alertCount }`.
- Keep the file's one import. Update the header comment and the function's doc comment.

### 6. Readers

- `ui/src/pages/assistant/Index.jsx`: `const attention = useAssistantAttention();` and
  `assistantAttention(user, attention)`. The page's four states are unchanged. Update the header
  comment ("it asks the server nothing" is no longer true: one answer, shared).
- `ui/src/components/TopBarAlert.jsx`: the same hook; pass `assistantCount: alertCount` and
  `assistantPhase: attention.phase` to `pickTopBarPill`.
- `ui/src/utils/topBarAlert.js`: `pickTopBarPill({ …, assistantPhase = 'answered' })`; after the
  `'setup'` branch: `if (assistantPhase === 'checking') return none;`. Update its header comment.

### 7. Unchanged

`src/api/setup/status.js`, `SetupStatusContext.jsx`, `SetupAlert.jsx`, the placeholder pages and
`ActionPage.jsx`, the profile-tags API, `publishProfileTag.js`, the relay settings and their defaults.

### Notes for Test Design (Phase 3; the Tester owns every test change)

- **Seams:** `handleAssistantAttention`'s `deps`; `lookupByAddresses` (`scanLocal`, `readRelay`);
  `tagRelays` (`readConfiguredRelays`, `getConfigFromFile`); `evaluateIdentificationTags` (pure);
  the shared library (pure CJS); `summarizeAttention` and `assistantAttention` (pure ESM);
  `pickTopBarPill` (pure ESM).
- **Branches worth pinning:** no session; a session with no assistant; a local hit per `d` with no
  relay read; a partial local hit (two of four found locally, only the two missing `d`s in the
  outside filter); a local rejection; no relays; every relay unreachable, including a read that
  outlives the budget; own-relay exclusion; the newest-wins tie rule; polarity apply, dispute,
  neutral, absent, non-numeric; a tagging pointing at another author's same-named tag (present);
  a definition found, not found, unfinished; the three action flags and their invariants; the
  Owner (assistant = the TA) and a Customer; no query parameter changes the answer; a 500 on a
  throw; `assistantAttention` with no answer (all ten marked, `alertCount` 9), with `done`
  (nine marked, 9), with `pending` (ten, 10), with an unfinished check (ten, 9); the picker with
  `assistantPhase` `'checking'`, and its default.
- **The `d`-tag rule:** a sentinel that the library's `taggingDTag` and `publishProfileTag.js:61`
  compose the same string (the publisher cannot be imported in Node: it imports the browser pool).
- **Re-aims this ADR requires** (the Tester's lane): the browser fixtures of
  `tests/brainstorm/assistant-alert.spec.js` and `tests/brainstorm/assistant-management-page.spec.js`
  must also answer `GET /api/assistant/attention`, or the pill waits and then reads `failed`
  (nine, not ten). With a canned `pending: true` answer the pill still says ten; with an unfinished
  one the hub says ten and the pill nine. `test/assistant-management-page.test.js` D7 and
  `test/assistant-alert.test.js`'s picker tests hold as they are (sub-decisions 6 and 8 keep the
  old signatures' answers); D7's reshaping ignores `alertCount`. `tests/brainstorm/setup-alert*.spec.js`
  should be run whole after the change, not only their re-aimed tests (ledger
  `2026-09-22-parallel-books-no-shared-line-recheck`, "What the fix round adds").
- **Live checks:** the fetch-stub technique reaches the signed-in render paths only with a canned
  `/api/assistant/attention`; a genuine server read needs a real session (a throwaway guest key has
  no assistant, so it reaches only the `hasAssistant: false` branch). On this dev stack a real
  Owner session with no tag-federation relay answers every tagging `no-outside-relays` unless the
  four taggings exist locally.
- **The gate:** the suites a filename grep finds for `actions.js`, `App.jsx`, `topBarAlert.js`,
  `TopBarAlert.jsx`, `src/api/index.js`, `openapi.yaml`, `vite.config.js`, plus `setup-status`,
  `setup-alert`, `setup-alert-polish`, `assistant-management-page`, `assistant-alert`.

## Out of scope

- The page (story 2) and any publish (stories 2 and 3), including which relays the Assistant's
  taggings go to.
- Unifying the three strict lookups, or the two polarity readers.
- A memo, a cache, polling, or a server-sent refresh.
- The other nine actions' checks; only the map's shape is ready for them.
- The protocols note on well-known tags (a docs-lane item for the owner's approval).
