# ADR 0003: Your Assistant signs its two taggings through one narrow, session-bound route, local relay first, each relay reported, and the second card reads the same report

**Status:** Accepted (approved 2026-09-22)
**Date:** 2026-09-22
**Story:** `engineering-team/stories/assistant-identification-tags/3-your-assistants-two-taggings.md`

## Context

Story 3 gives the second card its publish. In short:

- **AC-1.** On the press, this instance signs one tagging per checked row with the viewer's own Assistant's key: an
  ordinary tagging of the row's canonical tag, tagging the viewer, as an apply, in the shape the first card's taggings
  have.
- **AC-2.** Whose Assistant comes from the session (the Owner's is the instance TA; an Admin's or Customer's their
  own); the request cannot name another person or Assistant; no session, or no Assistant here, is refused with a
  reason before anything is signed.
- **AC-3.** Only the required taggings whose signer is the Assistant, by their entries; anything else refused; no
  other kind, no other tag; the generic sign-as-assistant route unchanged.
- **AC-4.** Local-first: this instance's relay first; a failed write sends that tagging nowhere and says so; then the
  outside relays this instance publishes to, including the relays it reads tags from, each reported (accepted,
  refused, unreachable, timeout, with reasons; published / kept local / not delivered); local-only mode keeps
  everything local and reports each relay skipped.
- **AC-5.** The card shows each tagging's summary and per-relay lines in story 2's words, re-checks its rows, and the
  hub's answer refreshes without a reload.
- **AC-6.** A checked row whose canonical definition was not found is refused for that tagging with story 2's "tag not
  found" reason; the other checked rows still publish.
- **AC-7.** Creating an Assistant, on any path, publishes no tagging.

**Settled before this ADR:** the button reads "Have your Assistant publish" (story approval); the Assistant's taggings
are published only on the button (Discovery decision 3); the words are story 2's (§ Copy and ADR 0002 sub-decisions
4–5) with the tagging's name as the subject.

### Concept-graph orientation

As ADR 0001's. No concept changes; **no firmware reinstall.**

### Codebase facts this design rests on (verified on `7180ce6c`)

- **The only general sign-as-assistant path** is `POST /api/strfry/publish` with `signAs: 'assistant'`
  (`src/api/strfry/commands/publishEvent.js:35-60`): owner-or-admin only (`isOwner` is `isOwnerOrAdmin`, OPEN.md row
  269), always the instance TA's key (`getOwnerAssistantKeys()`), local relay only, any kind but 0. A Customer's
  Assistant cannot publish anything but its profile.
- **The narrow precedent** is `POST /api/assistant/publish-profile` (`src/api/assistant/index.js:189-340`, ADRs
  assistant-profile/0002 and 0005): a factory `createPublishProfileHandler(deps)` with every side effect behind a seam
  (`getAssistantKeys`, `importEvent`, `publishToRelays`, `isLocalOnly`, `getSettings`, `now`, …); whose-checks first
  (`req.session.authenticated`, `session.pubkey === customerPubkey`) before any key is read; `getAssistantKeys(pubkey)`
  routes the Owner to the TA key and anyone else to their relay key, answering `{ privkey (hex or nsec), pubkey, … }`;
  the sign with `nostrTools.finalizeEvent`; `importToLocalRelay` first (`profileState.js:59-68`), and on failure a
  500 with `stage: 'local'` and no outside send; then `publishToRelays(signed, relays)` from `profilePublish.js`
  (one shared 8 s deadline, rows `{ relay, status, reason }` with `accepted | refused | unreachable | timeout`, or
  `skipped` in local-only mode) and `summarizePublish({ subject, rows, localOnly })` for the words — which are the
  story's words exactly, with the subject in front (`"My Human" was saved on this instance's relay and accepted by
  …`), and `localFailureMessage(subject, reason)` for the failed local write, whose "so it was not sent to any other
  relay" is true here because the server is local-first.
- **The relay lists.** `readConfiguredRelays(categories)` (`profilePublish.js:70`) reads any Relay Settings lists,
  each relay once; `getConfiguredPublishRelays()` is the general-purpose, profile and WoT lists; the tag-federation
  list is `aTagFederationRelays` (ADR 0001 reads it as `TAG_RELAY_CATEGORIES`). `isPublishLocalOnly()`
  (`src/api/publish-policy`) is the one local-only reader.
- **The definitions and the lookups already exist in story 1's module:** `lookupByAddresses({ kind, author, ds,
  relays }, deps)` and `tagRelays(deps)` in `src/api/assistant/attention.js`, with the same dependency names this
  handler needs (`scanLocal`, `readRelay`, `readConfiguredRelays`, `getConfigFromFile`). The canonical definitions
  are `39999:<CANONICAL_TAG_AUTHOR>:<slug>` with `d = slug`; a found definition's `id` is the tagging's `e`.
- **The tagging's wire shape** has one browser home, `ui/src/utils/publishProfileTag.js:64-112`: `d`
  (`taggingDTag`), `p` (the target), `a` (`39999:<tagAuthor>:<slug>`), `e` (the definition's id), the canonical z
  (`NOSTR_USER_TAG_HANDLE`, the ADR 0015 literal), the local z (`39998:<runtime TA>:nostr-user-tag`), `polarity`,
  and the content `{ nostrUserTag: { taggedPubkey, tagEventId, tagAddress } }`. The server side already composes the
  same canonical z as `NOSTR_USER_TAG_Z_TAG` in `src/api/profile-tags/index.js:60`, from its `LEGACY_Z_TAG_PUBKEY`
  (the ADR 0015 exception); the runtime TA is `getOwnerAssistantPubkey()` (`src/utils/assistantKeys.js`).
- **The shared library** `src/lib/identification-tags` has `REQUIRED_TAGGINGS` (with `signer`), `CANONICAL_TAG_AUTHOR`,
  `taggingDTag`, `signerAndTarget`.
- **The page** (`ui/src/pages/assistant/IdentificationTags.jsx`, story 2) renders the second card with rows, states and
  live checkboxes and no button (`onPublish={null}`); its `Card` renders the button when given `onPublish`; results
  render per row from `results[key]`, each `{ report }` or `{ refusal }`, with `Result` drawing `report.message` and
  `report.rows` through `relayLine`/`publishTone` (`ui/src/utils/taggingPublishReport.js`). Story 2's S1 sentinel
  forbids `fetch(` and `/api/` literals in the page, so the server call belongs in a util.
- **The hub's answer refreshes** through `useAssistantAttention().refresh()`; the browser chokepoint's announcement
  does not fire for a server publish, so the page must call it (ADR 0001 sub-decision 7).
- **Where Assistants are created** — `setup/create_nostr_identity.sh` (first boot), `POST /api/assistant/provision-key`
  (`src/api/assistant/index.js:483`), and customer sign-up (`src/utils/customerManager.js:1080`) — none publishes
  anything today.
- **nostr-tools on the server** is required at module load in `src/api/assistant/index.js:23` and lazily, container
  path first, in `publishEvent.js:16-24`. A new module follows the lazy idiom so it loads in a bare checkout.
- **Tests that pin today's code:** `test/assistant-publish-relays.test.js` (the profile handler's seam and
  `profilePublish.js`'s exports; unchanged here), `test/default-deny-mutations.test.js` (the generic signer's gates;
  unchanged), `test/assistant-identification-tags-page.test.js` S1/S6 (no `fetch(` in the page; the card's button only
  with `onPublish`), `test/assistant-attention.test.js` S3 (`setup/status.js` untouched).

### Constraints

- **Principle 1.** Whose Assistant is the session's, through the one mapping; the server never takes a pubkey.
- **Principle 2.** The server limits what it *signs with keys it holds* (two taggings of two well-known tags), not
  what it accepts; the client path of the generic signer stays permissionless.
- **Principle 4.** Local relay first; a failed local write sends nothing outward.
- **No new general signing power.** The route signs exactly the required Assistant-signed taggings and nothing else;
  the generic signer is untouched (OPEN.md row 269 stays as it is).
- **One home for the wire shape on each side:** the browser's in `publishProfileTag.js`; the server's, new here, kept
  equal by a test that compares the two builders' tag layouts.
- House stack; no new dependencies; the DI seam so the suite runs stack-free.

## Options considered

### Option A — One narrow route, `POST /api/assistant/identification-tags/publish`, session-bound, built the way the profile publish is (chosen)

A new server module builds, signs and publishes the checked Assistant-signed taggings for the session's own
Assistant, local relay first, and answers one report per tagging in the profile publish's words. A small client util
calls it; the second card wires its button and draws the same result blocks as the first through a server-shaped
adapter in the report util.

**Pros:** the smallest new signing surface, shaped like the one that exists; every rule behind a seam; the words and
the report come from modules already tested; story 2's page changes by one prop and one handler.
**Cons:** a second server builder of the tagging shape (mirrored, pinned equal by a test); a new route to deploy.

### Option B — Widen the generic signer

Let `POST /api/strfry/publish` with `signAs: 'assistant'` sign for any signed-in person's own Assistant, restricted
to kind 39999 taggings.

**Rejected.** It is owner-or-admin, TA-only and local-only today, with an open question about what it may mint at
all (OPEN.md row 269); widening it to Customers, to their own keys and to outside relays is a bigger change with a
bigger blast radius than one purpose-built route, and it would still need the report.

### Option C — The browser builds, the server only signs

`POST /api/assistant/sign` takes an unsigned event and returns it signed with the viewer's Assistant's key; the page
then publishes through the browser chokepoint.

**Rejected.** A general sign-as-your-Assistant power, even kind-restricted, is exactly what AC-3 forbids; the server
would sign content it did not compose; and the browser's parallel sends would lose local-first (AC-4).

## Decision

We chose **Option A.**

### Sub-decisions

**1. The route and its body.** `POST /api/assistant/identification-tags/publish`, body `{ keys: string[] }`: the
`REQUIRED_TAGGINGS` keys to publish, each of which must have `signer: 'assistant'`. Registered beside
`/api/assistant/attention` in `src/api/index.js`; documented in `src/api/openapi.yaml`.

**2. Refusals, in this order, before any key is read** (AC-2, AC-3):

| Check | Refused when | Answer |
|---|---|---|
| Signed in | no `req.session.authenticated === true` with a 64-hex `pubkey` | **401** `{ success: false, code: 'not-signed-in', error }` |
| The body | `keys` is not a non-empty array of strings, or any key is not a required tagging whose signer is the Assistant | **400** `{ success: false, code: 'not-an-assistant-tagging', error }` |
| An Assistant here | `getAssistantKeys(viewer)` answers nothing, or no private key | **403** `{ success: false, code: 'no-assistant', error }` |

The words are story 3 § Copy's. Keys are de-duplicated; order is `REQUIRED_TAGGINGS`'s.

**3. Whose.** The viewer is `req.session.pubkey` (lowercased); the Assistant is `getAssistantKeys(viewer)` — the
Owner's is the TA, anyone else's their own relay key — and its pubkey is derived from the private key
(`getPublicKey`), never taken from the request. The target of every tagging is the viewer.

**4. The definitions, from story 1's lookup** (AC-6). One `lookupByAddresses({ kind: 39999, author:
CANONICAL_TAG_AUTHOR, ds: <the slugs>, relays: tagRelays(deps) }, deps)`, imported from `./attention`. A key whose
definition did not finish or was not found gets the result `{ key, name, ok: false, code: 'tag-not-found', message }`
with story 2's sentence (`Tag not found: the tag "…" has not been published yet, so this tagging can't be made
here.`), and nothing is signed for it; the others proceed.

**5. The event, built on the server in the browser's shape.** In the new module, `buildAssistantTagging({
signerPubkey, targetPubkey, tag: { eventId, slug, authorPubkey }, localTaPubkey })` composes exactly what
`publishProfileTagAssertionWithReport` composes: `d` via the library's `taggingDTag`, `p`, `a`, `e`, the canonical z
(`NOSTR_USER_TAG_Z_TAG`, exported from `src/api/profile-tags/index.js` — one new name in its `module.exports`, no new
literal), the local z from the runtime TA (`getOwnerAssistantPubkey()`, omitted with a warning when unresolved, as
the browser does), `['polarity', '1']`, and the content object. `created_at` from `deps.now()`. Signed with
`finalizeEvent` and the Assistant's key (hex or nsec, as the profile handler decodes it). A test pins the two builders'
tag names, order and content keys equal.

**6. Local first, then the outside relays, each reported** (AC-4). Per tagging, in order:
1. `deps.importEvent(signed)`. A throw gives `{ ok: false, stage: 'local', outcome: 'not-delivered', message:
   localFailureMessage(subject, reason), localOnly, relays: { total: 0, success: 0, results: [] } }` and no outside
   send for that tagging.
2. The outside relays: `localOnly ? [] : readConfiguredRelays(TAGGING_PUBLISH_CATEGORIES)` with
   `TAGGING_PUBLISH_CATEGORIES = ['aPopularGeneralPurposeRelays', 'aProfileRelays', 'aWotRelays', 'aTagFederationRelays']`
   — the profile publish's three lists plus the relays this instance reads tags from, each relay once. In local-only
   mode the rows are the configured relays, each `skipped` with reason `local-only publish mode`; otherwise
   `deps.publishToRelays(signed, relays)`.
3. `summarizePublish({ subject: '"<name>"', rows, localOnly })` → `outcome`, `message`, `accepted`.
4. The row: `{ key, name, ok: true, outcome, message, localOnly, relays: { total, success: accepted, results: rows } }`.
   The signed event is not returned (the answer stays small; the page needs the report only).

The answer is **200** `{ success: true, results: [ …one per requested key, in `REQUIRED_TAGGINGS` order… ] }` whenever
the request itself was well-formed, whatever each tagging's fate; a throw outside the per-tagging loop is **500**
`{ success: false, error: 'Could not publish your Assistant\'s taggings' }`.

**7. The client.** `ui/src/utils/publishAssistantTaggings.js` (ESM): `publishAssistantIdentificationTaggings(keys)`
POSTs the route and returns its JSON, or throws on a network failure / a non-JSON answer. The page's S1 sentinel
stays true: the page never `fetch`es.

**8. The report, through the same util.** `taggingPublishReport.js` gains `describeServerPublish({ name, row })`:
- an `ok: true` row → `{ ok: true, outcome: row.outcome, message: row.message, rows: row.relays.results }` (the server's
  statuses are the util's vocabulary already);
- a `stage: 'local'` row → `{ ok: false, outcome: 'not-delivered', message: row.message, rows: [] }`;
- a `code` row (tag-not-found) → `{ ok: false, outcome: 'not-delivered', message: row.message, rows: [] }`;
- a whole-request refusal (`success: false` with `code`) → every requested key gets `{ ok: false, …, message:
  data.error }`.
So `Result` and `publishTone` draw the second card's blocks exactly as the first's.

**9. The page** (`IdentificationTags.jsx`): the second card gets `onPublish={hasAssistant ? publishAssistantTaggings
: null}` and the button reads `COPY.buttons.assistant`. The handler snapshots the checked, publishable assistant
rows, calls the util once with their keys (one request, the button reading "Publishing…" and its checkboxes
disabled), maps each result row into `results[key] = { report: describeServerPublish(...) }`, then calls
`attention.refresh()` (nothing announced this publish in the browser). A thrown request (network, non-JSON) shows the
card notice `This instance did not answer; nothing was published.` (one new sentence in the copy module). Publishing
state becomes per card so a press on one card never disables the other.

**10. Never at creation** (AC-7). The module has one caller, the route. A source sentinel greps `src/`, `bin/` and
`setup/` for the module's name outside `src/api/index.js` and finds none; the three creation paths are unchanged.

**11. BIBLE and the document.** § Assistant Keys gains one bullet: what an Assistant's key signs on the person's
request — its profile (`publish-profile`) and its two identification taggings (this route), and nothing else outside
the generic signer's owner-only path. §11 gains the route's row, beside `/api/assistant/attention`'s. OpenAPI gains
the entry.

**What we trade away**
- A second builder of the tagging shape, server-side, mirrored from the browser's (pinned equal by a test; the
  library could own one template for both later — the ledger row on the strict lookup's copies is the place to fold
  it in).
- No signed event in the answer; a caller wanting the event id reads the relay.
- One more route to deploy; the local container needs a backend restart.

## Consequences

- **Enables:** the book's frame bullet "Your Assistant's two taggings"; the Owner's TA and a Customer's Assistant
  publish the same way; later, publishing at creation can call `publishAssistantTaggingsFor(viewer, keys, deps)`
  (the handler's inner function, exported) from a creation path with its own decision.
- **Constrains:** the route signs two well-known taggings and nothing else; adding a required tagging with
  `signer: 'assistant'` to the library makes it publishable here with no server change, which is Discovery decision 7.
- **Latency:** per press, one local scan for the definitions (plus outside reads on a miss, under the 8 s budget),
  then per tagging one local write and one fan-out under the shared 8 s deadline; two taggings, so at most about 16 s
  in the worst case, in one request.
- **Load:** one request per press; no polling.
- **Debt this ADR notices:** the mirrored builder (above); `readPolarity`/the z literal now referenced from three
  modules; the per-card publishing state duplicates a small piece of story 2's handler (a shared `publishRows`
  helper if a third card ever appears).
- **Firmware reinstall required?** No.

## Implementation notes

### 1. `src/api/profile-tags/index.js`

Add `NOSTR_USER_TAG_Z_TAG` to `module.exports`. Nothing else changes.

### 2. `src/api/assistant/identificationTaggings.js` (new, CommonJS, dependency-injected)

Exports: `createPublishIdentificationTaggingsHandler(deps = {})` → `handlePublishIdentificationTaggings(req, res)`;
`handlePublishIdentificationTaggings` (the default-deps instance); `publishAssistantTaggingsFor({ viewer, keys }, deps)`
(the whole flow after the session check, for a later creation-time caller); `buildAssistantTagging(...)`;
`TAGGING_PUBLISH_CATEGORIES`; the three refusal codes.

Default deps (lazy requires): `getAssistantKeys` (`../../utils/assistantKeys`), `getOwnerAssistantPubkey` (same),
`scanLocal`/`readRelay`/`readConfiguredRelays`/`getConfigFromFile` as `./attention` names them, `importEvent`
(`./profileState` `importToLocalRelay`), `isLocalOnly` (`../publish-policy`), `publishToRelays` and `summarizePublish`
and `localFailureMessage` (`./profilePublish`), `finalizeEvent`/`getPublicKey` (nostr-tools, container path first, as
`publishEvent.js`), `now`.

The handler: the three refusals of sub-decision 2 (the body check reads `req.body.keys` only); then
`publishAssistantTaggingsFor`. Log one line per tagging's outcome and one per relay that did not accept, as the
profile handler does.

### 3. `src/api/index.js`, `src/api/openapi.yaml`, `BIBLE.md`

`app.post('/api/assistant/identification-tags/publish', identificationTaggings.handlePublishIdentificationTaggings)`
beside the attention route. The OpenAPI entry: the body, the three refusals, the 200 shape. BIBLE: the § Assistant
Keys bullet and the §11 row; bump "Last updated".

### 4. `ui/src/utils/publishAssistantTaggings.js` (new, ESM)

`export async function publishAssistantIdentificationTaggings(keys)`: `fetch('/api/assistant/identification-tags/publish',
{ method: 'POST', headers, body: JSON.stringify({ keys }) })`, returning the parsed JSON; throws on a network error or
a non-JSON body.

### 5. `ui/src/utils/taggingPublishReport.js`

Add `describeServerPublish({ name, row })` per sub-decision 8, and export it. `relayLine` and `publishTone` serve
both.

### 6. `ui/src/pages/assistant/identificationTagsCopy.js`

Add `requestFailed: 'This instance did not answer; nothing was published.'` to `IDENTIFICATION_TAGS_COPY`. The
refusal words of story 3 § Copy live on the server (they are the answers' `error`); the page shows them as received.

### 7. `ui/src/pages/assistant/IdentificationTags.jsx`

Sub-decision 9: `publishing` becomes `publishingCard` (`'person' | 'assistant' | null`); a second handler
`publishAssistantTaggings`; the second `Card` gets `onPublish` and the assistant-card notice; results keyed by row
as today. The `Card` component is unchanged except that `publishing` is a boolean derived per card by the page.

### 8. Unchanged

`publishEvent.js` (the generic signer), `attention.js` (imported, not edited), `profilePublish.js`, `profileState.js`,
`setup/status.js`, the creation paths, `actions.js`, the library.

### Notes for Test Design (Phase 3; the Tester owns every test change)

- **Seams:** the handler's `deps` (as `test/assistant-publish-relays.test.js`'s E-class drives the profile handler:
  recording fakes for keys, import, publish, settings, local-only, now); `buildAssistantTagging` (pure given its
  inputs); `describeServerPublish` (pure ESM); the copy addition.
- **Branches worth pinning:** the three refusals in order, and that a refusal reads no key (`getAssistantKeys` not
  called for 401/400); a Customer's own key vs the Owner's TA; the target is the viewer; a definition not found →
  that row `tag-not-found`, the other still published; a definition unfinished → the same; the local write failing →
  `stage: 'local'`, no `publishToRelays` call for that tagging, the next tagging still tried; local-only → every
  relay `skipped`, no socket; the outside set is the four lists, each relay once, own relay excluded is not applied
  here (publishing to one's own relay URL would be a duplicate of the local write — the Tester may pin that the local
  relay's URL is not in the outside set, or leave it: `readConfiguredRelays` does not exclude it, and the profile
  publish does not either); the summary words match `summarizePublish`'s; the event's tags equal the browser
  builder's layout (a source-and-value comparison: build with the same inputs and compare tag names, order and
  content keys against the browser builder's literal layout read from `publishProfileTag.js`); `created_at` from
  `now`; the answer carries no private key and no pubkey but the tagging's `p`; a 500 on a throw outside the loop.
- **Source sentinels:** the route registered and documented; the generic signer's file unchanged (`git diff` empty
  for it, or its owner gate still present); no creation path names the new module; the page never `fetch`es (story
  2's S1 still holds) and wires the second card through the util; the second card's button reads the approved words.
- **Browser:** mock the route with per-row results (published / kept local / local failed / tag-not-found / a
  whole-request refusal); the press disables only the second card's controls; the results render with the same tone
  rule; the attention mock's next answer flips the rows; a network failure shows the request-failed notice; nothing is
  posted before the press.
- **Live:** a signed-in read of the route on this dev stack would refuse `tag-not-found` for both (no definitions
  reachable); the anonymous POST answers 401. The scratchpad sign-in script from story 1 can be adapted if the Tester
  wants a live H-class; it publishes to the local relay only in local-only mode — still a write, so a throwaway key,
  never the owner's, or skip it.
- **Re-aims:** story 2's S6 (`onPublish &&`) holds; its browser B5 asserts "no button on the second card" — that
  case must be re-aimed (the button now exists and is enabled when a row is checked).

## Out of scope

- Publishing at creation (the exported inner function is the hook; the decision is Discovery's 3).
- Retracting or disputing as the Assistant.
- Folding the two tagging builders into the library.
- A general per-user sign-as-assistant route; OPEN.md row 269.
