# ADR 0003: Your Assistant signs its relay list through one narrow route — the server builds the kind 10002 from the draft and the newest list, local first, each relay reported

**Status:** Accepted
**Date:** 2026-10-09
**Story:** `engineering-team/stories/assistant-outbox-relays/3-your-assistant-publishes-its-relay-list.md`

## Context

Story 3 publishes the page's draft. In short:

- **AC-1.** One button, **Have your Assistant publish**, enabled while the draft differs from the
  published list (or, when the check did not finish, while the draft is non-empty); **Publishing…**; a
  summary and one line per relay in the Identification Tags page's words; a whole-request refusal is one
  line; then the answer is asked for again.
- **AC-2.** The request names relays only; whose Assistant comes from the session. Refusals before any
  key is read: not signed in; not a list of relay addresses (story 2's rule, ≤ 50, no relay twice); no
  Assistant here. Only a kind 10002; no other route gains signing power; nothing at Assistant creation.
- **AC-3.** The event: the draft in order, each keeping its marker from the newest list (none stays none,
  `write` stays `write`), others `write`; then the newest list's inbox-only entries, unless the draft
  names the same relay, which then appears once with no marker; a removed relay is not in the event at
  all (book Decision 6). "The newest list" is story 1's lookup at publish time; none found, nothing kept.
- **AC-4.** This instance's relay first; a failed write sends nothing out and says so. Then each relay
  once: the new list's, the previous list's, and the profile publish set. Local-only mode keeps it here.
  Only an accepting relay counts; bounded time.
- **AC-5.** An empty outbox may be published (book Decision 7); the report says so.

### Concept-graph orientation

Stack absent (AGENTS.md §2 fallback). `39998:<TA>:nostr-user` (whose Assistant signs) and
`39998:<TA>:nostr-relay` (where the list goes) are named, not changed. **No concept changes. No firmware
reinstall.**

### Codebase facts this design rests on

- **The pattern route.** `src/api/assistant/identificationTaggings.js`:
  `createPublishIdentificationTaggingsHandler(deps)` reads the session (401), checks the body (400),
  then `publishAssistantTaggingsFor` gets `getAssistantKeys(viewer)` (403 when no private key), derives
  the pubkey with `getPublicKey`, builds, `finalizeEvent`s, writes locally with `importToLocalRelay`
  (`profileState.js`) — a failure is a `stage: 'local'` row with `localFailureMessage` and nothing sent —
  then `publishToRelays(signed, relays)` or `skipped` rows in local-only mode, and `summarizePublish`
  (`profilePublish.js:209-235`). Its private helpers `privkeyBytesOf` and `getNostrTools` are not
  exported. It is registered at `src/api/index.js:594-595`, with no middleware: the handler reads the
  session itself.
- **The report.** `summarizePublish({ subject, rows, localOnly })` gives the outcome
  (`published | kept-local | not-delivered`) and the sentence shapes story 3 § Copy quotes.
  `publishToRelays` fans out on one 8 s deadline (`PUBLISH_BUDGET_MS`), one socket per relay.
- **The browser side.** `publishAssistantIdentificationTaggings(keys)` (`ui/src/utils/publishAssistantTaggings.js`)
  is the page's one fetch for its publish; `describeServerPublish({ name, row, answer })`, `publishTone`
  and `relayLine` (`ui/src/utils/taggingPublishReport.js`) turn a server row into the drawn report.
- **The generic signer** (`src/api/strfry/commands/publishEvent.js`) stays owner-or-admin and TA-only
  (OPEN.md row 269).
- **Replaceable events.** A relay keeps the kind 10002 with the greatest `created_at` (NIP-01). Two
  publishes within one second need the second to carry a greater `created_at`, or a relay may keep the
  first.

## Options considered

### Option A — A narrow, session-bound route that builds the event on the server (chosen)

`POST /api/assistant/outbox-relays/publish` with `{ relays: string[] }`, in a new
`src/api/assistant/relayListPublish.js` shaped like `identificationTaggings.js`. The server reads the
newest list, applies AC-3, signs, writes locally, fans out and reports.

**Pros:** the markers and the kept inbox entries come from the list the server just read, not from what
a browser saw minutes ago; the power added is exactly "sign this person's own Assistant's kind 10002",
nothing broader; the report reuses the profile publish's words and the page's report utilities.
**Cons:** a second narrow route of this shape (after `identification-tags/publish`); the signing helpers
are shared by export rather than by a common module.

### Option B — The browser builds the event; a route signs a given kind 10002 template

**Pros:** the server is a thin signer.
**Cons:** the server would have to re-check every tag of a given template anyway (that it is a valid
NIP-65 list, that the inbox entries were kept); the browser's view of the newest list can be stale; and
"sign a template" is the generic signer's broader power, which OPEN.md row 269 is narrowing, not
widening. Rejected.

### Option C — Extend the generic signer to sign kind 10002 as a Customer's assistant

**Cons:** the generic signer is owner-or-admin and TA-only by design; opening it to Customers for one
kind is the widening ADR assistant-identification-tags/0003 already rejected. Rejected.

## Decision

We chose **Option A**.

### Sub-decisions

**1. The request and its refusals, in order, before any key is read.**

- No authenticated session with a 64-hex pubkey → 401 `not-signed-in`.
- `body.relays` is not an array; has more than `MAX_RELAYS`; has an entry that does not normalize
  (`normalizeRelayUrl`); or names a relay twice by normalized form → 400 `not-a-relay-list`. An empty
  array is valid (AC-5).
- `getAssistantKeys(viewer)` gives no private key → 403 `no-assistant`.

**2. The event: `buildRelayListTags({ draft, previous })` in `src/lib/relay-list/`.** Pure. `draft` is the
request's relays, normalized; `previous` is `parseRelayList(newest).entries`, or `[]`. Output, in order:

1. for each draft relay: previous marker `null` → `['r', url]`; `'write'` → `['r', url, 'write']`;
   `'read'` → `['r', url]` (the person made an inbox-only relay an outbox too: both); absent →
   `['r', url, 'write']`;
2. for each previous entry with marker `'read'` not in the draft → `['r', url, 'read']`;
3. nothing else: a previous outbox entry (`null` or `'write'`) not in the draft is dropped, inbox role
   included (book Decision 6).

The template: `{ kind: 10002, content: '', tags, created_at: max(nowSeconds, newest.created_at + 1) }` —
the second term only when a newest list was found, so the new list always replaces it.

**3. The newest list, at publish time.** `lookupNewestReplaceable({ kind: 10002, author: assistantPubkey,
relays: outsideOnly(getConfiguredPublishRelays(), deps) }, deps)` (ADR 0001 sub-decision 2). An
unfinished lookup counts as "none found" (AC-3): this instance writes every list it publishes to its own
relay first, so the local scan is where a list lives, and an unreadable local relay also fails the local
write that follows, which then sends nothing.

**4. Where it goes.** After the local write: `outsideOnly([...newEntries, ...previousEntries,
...getConfiguredPublishRelays()], deps)` — this instance's own relay is left out because it was just
written directly. In local-only mode, one `skipped` row per relay of that set and no send. Otherwise
`publishToRelays(signed, set)`. The report: `summarizePublish({ subject: "Your Assistant's relay list",
rows, localOnly })`.

**5. The answer.** `200 { success: true, result: { ok, outcome, message, localOnly, outbox,
relays: { total, success, results } } }`; a local failure is `ok: false, stage: 'local',
outcome: 'not-delivered'` with `localFailureMessage`. `outbox` is the signed event's outbox relays
(`parseRelayList(signed).outbox`), so the page can say the empty-outbox line. Refusals:
`{ success: false, code, error }` with story 3 § Copy's words. A throw: 500 with "Could not publish your
Assistant's relay list". Each non-accepting relay is logged, as the tagging route logs.

**6. The signing helpers, shared by export.** `identificationTaggings.js` exports `privkeyBytesOf` (no
behavior change). `relayListPublish.js` takes `finalizeEvent` and `getPublicKey` as dependencies, as the
tagging route does.

**7. The page's button and report.**

- `ui/src/utils/publishAssistantRelayList.js`: `publishAssistantRelayList(relays)` — one `POST`, the
  `publishAssistantTaggings.js` shape; throws when the instance does not answer with JSON.
- In `OutboxRelays.jsx`, panel 1 ends with the button (`bs-idtags-publish`) and a results area
  (`aria-live="polite"`). Enabled when the viewer has an Assistant, nothing is publishing, and either the
  check finished and `!sameRelayList(draft, published)`, or it did not finish and `draft.length > 0`.
- On press: clear the last report; `publishAssistantRelayList(draft)`; a `success: false` answer → one
  error line with its `error`; a throw → "This instance did not answer; nothing was published."; else
  `report = describeServerPublish({ name: "Your Assistant's relay list", row: data.result })`, drawn with
  `publishTone`'s class and `relayLine` per relay, as the Identification Tags page's `Result` draws it,
  plus the empty-outbox line when `data.result.ok && data.result.outbox.length === 0`. Then
  `attention.refresh()`.

**What we trade away**
- **Last write wins.** Two tabs editing the list: the later publish's draft is the list, and a relay the
  earlier tab added is dropped if the later draft lacks it. The server reads the newest list, so markers
  and inbox entries are never stale; the outbox choice is the latest person's.
- A second narrow route in the shape of `publish-profile`; a common "assistant-signed publish" module is
  a candidate refactor once a third arrives.

## Consequences

- **Enables:** the hub card turns **Done** after the first publish with an outbox relay (via
  `refresh()`).
- **What the list promises:** a relay the person adds by hand is named as an outbox though the
  Assistant's other publishers do not send there yet (epic § Deferred). The suggestions are where it
  already publishes, which is why they are offered.
- **Security:** the route signs only with the session's own Assistant key, only kind 10002, only
  `r` tags built from normalized `ws(s)://` URLs; the request cannot name a pubkey, a kind or a tag.
- **Firmware reinstall required?** No.

## Implementation notes

- `src/lib/relay-list/index.js`: add `buildRelayListTags`, `validateRelayListRequest(relays)` →
  `{ ok, relays }` (normalized) or `{ ok: false }`.
- `src/api/assistant/relayListPublish.js` (new): `createPublishRelayListHandler(deps)`,
  `handlePublishRelayList`, `publishAssistantRelayListFor({ viewer, relays }, deps)`, `CODES`, `WORDS`,
  `RELAY_LIST_SUBJECT`. `defaultDeps()` mirrors the tagging route's, plus `lookupNewestReplaceable`,
  `getConfiguredPublishRelays` and `outsideOnly`.
- `src/api/assistant/identificationTaggings.js`: add `privkeyBytesOf` to `module.exports`.
- `src/api/index.js`: `app.post('/api/assistant/outbox-relays/publish', …handlePublishRelayList)` beside
  the identification-tags route, with a comment in its style.
- `ui/src/utils/publishAssistantRelayList.js` (new); `OutboxRelays.jsx` and `outboxRelaysCopy.js`: the
  button, the report, the empty-outbox and refusal words.
- Documents: `src/api/openapi.yaml` (the route); BIBLE §11 (a row for the route) and §14 Assistant Keys
  (one sentence: an assistant's key also signs its kind 10002 relay list through this narrow route);
  bump the "Last updated" line.

## Out of scope

- Publishing at Assistant creation; republishing on Relay Settings changes; retries.
- Making the other publishers follow the list.
- A common module for assistant-signed publishes.
