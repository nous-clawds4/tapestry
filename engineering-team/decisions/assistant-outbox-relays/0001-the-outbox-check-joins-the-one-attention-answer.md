# ADR 0001: The outbox check joins the one attention answer — the Assistant's newest kind 10002, read local-first, and the hub's Outbox Relays card

**Status:** Accepted
**Date:** 2026-10-09
**Story:** `engineering-team/stories/assistant-outbox-relays/1-the-outbox-check-and-the-hubs-outbox-relays-card.md`

## Context

Story 1 adds an eleventh action, **Outbox Relays**, as the third card in the hub's "Your Assistant's
Public Persona" section, and gives it a real "needs attention" answer. In short:

- **AC-1.** The card, after Identification Tags, with its NIP-65 link, opening `/assistant/outbox-relays`.
- **AC-2.** The answer is about the session's own Assistant: its outbox relays in the list's order, how
  many inbox-only relays, finished, and a reason when not. No parameter changes whose it is.
- **AC-3.** The Assistant's newest kind 10002 (NIP-01's tie rule), this instance's relay first, then the
  relays this instance publishes Assistant profiles to. Finished as `/setup` means it. Duplicates count
  once; a non-`ws(s)://` value is ignored.
- **AC-4.** Done when finished with at least one outbox relay; marked otherwise; the hub's **Done**
  badge when done; the pill counts only the confident reading (finished, no outbox relay).
- **AC-5.** Read-only, in the one request the hub already makes, no polling.

An **outbox relay** is an `r` tag with no marker or `write`; **inbox-only** is `read` (NIP-65).

### Concept-graph orientation

The stack is absent in this session (`curl -sf -m 2 localhost:7778/api/concept-graph/summaries` does not
answer), so this follows the AGENTS.md §2 fallback. The story names `39998:<TA>:nostr-user` (whose
Assistant; not read or written) and `39998:<TA>:nostr-relay` (the relays named; the relay settings). A
kind 10002 is not a concept-graph node, and the relays to read come from Relay Settings (`aRelays`), as
the profile publish's do (ADR assistant-profile/0002). **No concept changes. No firmware reinstall.**

### Codebase facts this design rests on (verified on origin/staging `e391405` plus this book's story commit)

- **The one answer.** `GET /api/assistant/attention` → `handleAssistantAttention(req, res, deps = {})`
  (`src/api/assistant/attention.js:207-224`): the session's viewer, `getAssistantPubkeyFor`, then
  `actions: { 'identification-tags': … }`, each action with `finished`, `done`, `pending`. A throw is 500.
- **The local-first lookup, for addressable events only.** `lookupByAddresses({ kind, author, ds,
  relays }, deps)` (`attention.js:98-136`) scans strfry strictly (`scanLocalStrict`), then the outside
  relays through `readWithinBudget` (`:75-89`, the 8 s `RELAY_BUDGET_MS` of `src/api/setup/status.js`)
  and `newest` (`:62-72`). It filters by `#d`, so it cannot read a plain replaceable kind like 10002.
  `readWithinBudget` and `newest` are not exported.
- **The relays.** `getConfiguredPublishRelays()` (`src/api/assistant/profilePublish.js:56-58`): the
  General Purpose, Profile and WoT lists. `outsideOnly(urls, deps)` (`src/api/setup/status.js:214-236`)
  drops this instance's own relay (loopback, `BRAINSTORM_RELAY_URL`'s host, `STRFRY_DOMAIN`).
- **The two readings.** `assistantAttention(user, attention)` (`ui/src/pages/assistant/actions.js:235-254`)
  marks a checked action unless its answer says `done`, and counts it in the pill only when it says
  `pending`; a placeholder is always both. `CHECKED_ACTIONS = ['identification-tags']` (`:218`).
- **Routes.** `App.jsx:332` routes every `ASSISTANT_ACTIONS` entry to `ACTION_PAGES[key]` or the
  placeholder `ActionPage.jsx`, so a new entry gets its placeholder route with no App change.
- **A parallel design on the same lines.** ADR assistant-profile-checklist/0001 (Proposed, same day)
  adds a `profile` key to the same answer, isolates it with `Promise.allSettled` (its sub-decision 6),
  and gives the hub a **Done** badge for any checked action that is done (its sub-decision 7:
  `assistantAttention` returns `done: string[]`; `ActionCard` takes `done`; class `is-done`, ✓ marker,
  `bs-setup-step-badge is-done`, `ASSISTANT_COPY.done` and `doneSrPrefix`; one CSS rule).
- **Shared CommonJS libraries reach the UI** through Vite aliases (`ui/vite.config.js:18-45`), as
  `@tapestry/identification-tags` does; Node suites load the library by path.
- **Tests that pin today's hub** (Tester's lane, Phase 3): `test/assistant-management-page.test.js` D2
  (`actions.length === 10`), `test/assistant-attention.test.js` C2 (`CHECKED_ACTIONS`, "one of the ten
  actions"), `test/assistant-alert.test.js`, the fixtures `test/helpers/assistantManagementFixtures.js`
  and `identificationTagsFixtures.js`, and the Playwright specs that mock `/api/assistant/attention`
  (`tests/brainstorm/assistant-*.spec.js`, `manage-treasure-map*.spec.js`, `my-assistants*.spec.js`,
  `treasure-map-*.spec.js`, `list-headers-*.spec.js`).

### Constraints

- **Principle 1 (POV).** The viewer's own Assistant, from the session only.
- **Principle 3.** Re-derived per request; nothing stored.
- **Principle 4.** Read-only; this instance's relay is the first and usually the only source.
- **No hardcoded TA pubkey or deployment name.** **JS without build**; `actions.js` keeps its one import.

## Options considered

### Option A — An `outbox-relays` key in the existing attention answer, computed by a new server module (chosen)

`checkOutboxRelays({ assistantPubkey }, deps)` in a new `src/api/assistant/outboxRelays.js`, called by
`handleAssistantAttention` beside the other checks; a new `lookupNewestReplaceable` beside
`lookupByAddresses` in `attention.js`; the NIP-65 rules in a pure shared library.

**Pros:** one request per page load, as ADR assistant-identification-tags/0001 designed the answer to
grow; the provider, the two readings and the pill work unchanged; the strict local scan and the
"finished" rule are the server's.
**Cons:** the answer waits for the outside reads when this instance's relay holds no list — today, for
every Assistant, until its first publish — bounded by the 8 s relay budget. A responsive relay answers in
a few hundred milliseconds.

### Option B — A separate `GET /api/assistant/outbox-relays`, which the hub and the pill also fetch

**Pros:** the other actions' answers never wait on a relay-list read.
**Cons:** two answers the hub and the pill must combine, two requests per page: ADR
assistant-identification-tags/0001's rejected Option B. Rejected for the same reason.

### Option C — The browser reads the kind 10002 from relays itself

**Pros:** no server change for the check.
**Cons:** no strict "finished" (the browser pool does not report EOSE per relay), no local-first strfry
scan, and the pill would need its own relay reads on every page. Rejected, as setup-status-and-alert/0001
rejected its browser option.

## Decision

We chose **Option A**.

### Sub-decisions

**1. The NIP-65 rules are a shared CommonJS library, `src/lib/relay-list/`.** Pure, no imports (it uses
the global `URL`), loaded by the server and, through a Vite alias `@tapestry/relay-list`, by the UI
(stories 2 and 3 use it too). This ADR needs three of its exports:

- `normalizeRelayUrl(input)` → the relay's one spelling, or `null`. Trim; parse with `new URL`; accept
  only protocol `ws:` or `wss:`, a non-empty hostname, no username or password, no hash, at most 512
  characters. Return `url.href` with one trailing `/` removed. `URL` lower-cases the scheme and host and
  drops a default port, so two spellings that differ in the host's letter case or one trailing slash
  normalize alike (story 2 AC-3).
- `parseRelayList(event)` → `{ entries: [{ url, marker }], outbox: [url], inboxOnly: [url] }`. Reads at
  most the first `MAX_PARSED_R_TAGS = 100` tags whose name is `r`; ignores a value that does not
  normalize; `marker` is `'read'`, `'write'` or `null` (no marker, or any other value — NIP-65 defines
  only the two). A relay named twice is one entry, in its first position; if its markers disagree
  (`read` and `write`, or one entry with none) it becomes `null`. `outbox` = entries whose marker is
  `null` or `'write'`, in order; `inboxOnly` = marker `'read'`.
- `MAX_RELAYS = 50` (story 3 AC-2).

**2. The lookup: `lookupNewestReplaceable({ kind, author, relays }, deps)` in `attention.js`.** Beside
`lookupByAddresses`, sharing `readWithinBudget` and `newest`. One strict local scan `{ kinds: [kind],
authors: [author] }`; the newest event of that kind by that author (pubkey case-blind) wins. When the
local relay holds none, every given relay is read at once with the same filter, each within the relay
budget, and the newest from the relays that answered wins. Answers:

- `{ finished: true, event, source: 'local' | 'relay' }`, or `{ finished: true, event: null, source: null }`
  (local none, at least one relay answered, none holds one);
- `{ finished: false, reason: 'local-unreadable' | 'no-outside-relays' | 'outside-unreachable' }` — the
  identification-tags reasons, so story 2 can reuse their words.

Story 3 calls it too, at publish time (ADR 0003).

**3. Where outside: the configured profile publish set, whatever the publish mode.**
`outsideOnly(getConfiguredPublishRelays(), deps)`. Not `getAssistantPublishRelays()`, which is empty in
local-only mode: reading is not publishing, and a list published before local-only mode was turned on is
still the Assistant's. Story 3 always sends the list to this same set (its AC-4), so a list this
instance publishes is always findable by this check.

**4. One pure evaluator.** `evaluateOutboxRelays({ lookup })` →
`{ finished, done, pending, reason, source, createdAt, outbox, inboxOnlyCount }`:

- finished lookup: `parseRelayList(event)` (an empty list when `event` is null); `done = outbox.length > 0`;
  `pending = !done`; `reason = null`;
- unfinished lookup: `finished = done = pending = false`; `reason` from the lookup; `outbox = []`;
  `inboxOnlyCount = 0`; `source = createdAt = null`.

Invariants the suites pin: `done ⇒ finished`, `pending ⇒ finished`, `done ⇒ !pending`. No pubkey is in
the answer.

**5. A failing outbox check does not take the other answers with it.** `handleAssistantAttention` awaits
its checks with `Promise.allSettled`. A rejected outbox check becomes `{ finished: false, done: false,
pending: false, reason: 'check-failed', source: null, createdAt: null, outbox: [], inboxOnlyCount: 0 }`
(plus `suggestions: []`, ADR 0002) and is logged. A rejected identification-tags check keeps today's 500.
This is ADR assistant-profile-checklist/0001 sub-decision 6's shape; whichever lands first introduces
`allSettled`, and the other adds its key to it.

**6. The hub: one entry, one checked key, and the shared Done badge.**

- `ASSISTANT_ACTIONS` gains, right after `identification-tags`:
  `{ key: 'outbox-relays', section: 'persona', path: `${ASSISTANT_MANAGEMENT_PATH}/outbox-relays`,
  title: 'Outbox Relays', description: [<story § Copy>, { text: 'NIP-65', href: NIP_LINKS.relayList }, '.'],
  alertCriteria: <story § Copy>, planningNotes: null }`. `NIP_LINKS.relayList =
  'https://github.com/nostr-protocol/nips/blob/master/65.md'`.
- `CHECKED_ACTIONS` gains `'outbox-relays'`, kept in `ASSISTANT_ACTIONS` order.
- The **Done** badge is ADR assistant-profile-checklist/0001 sub-decision 7, word for word: the same
  `done: string[]` field on `assistantAttention`, the same `ActionCard` prop and marks, the same
  `ASSISTANT_COPY.done` / `doneSrPrefix`, the same CSS rule. If that implementation is on the base when
  this one starts, it is reused untouched; if not, this implementation writes it exactly as specified
  there, so the two diffs agree on those lines.
- `ActionPage.jsx` and the provider are unchanged. The placeholder route needs no App change until
  story 2 (ADR 0002).

**What we trade away**
- On a page load, until an Assistant has published its first list, the answer waits on the outside reads
  (up to 8 s when a relay hangs). The identification-tags answer and the pill wait with it.
- A list found only on an outside relay is not copied home. The profile check copies a relay-only kind 0
  home (ADR assistant-profile/0001); a relay list this instance never held was not published by it, and
  story 1 is read-only (AC-5).

## Consequences

- **Enables:** story 2's page reads `actions['outbox-relays']` for its list, mark and states; story 3
  reuses the lookup for "the newest relay list" and calls `refresh()` after a publish.
- **The pill grows by one for almost everyone, on the first deploy.** No Assistant has a kind 10002 today,
  so for every viewer whose check finishes, the new action is `pending` and counts. That is the story's
  intent (the card needs attention); it is not a regression in another action.
- **Latency:** after an Assistant's first publish, the local scan answers and nothing goes outside.
- **Debt noticed, not fixed:** `relayKey` in `profilePublish.js` and `outsideOnly`'s key compare relays by
  a looser rule (whole URL lower-cased, every trailing slash). `normalizeRelayUrl` is the stricter one the
  page needs; unifying them is a candidate ledger row, not this book's.
- **Firmware reinstall required?** No.

## Implementation notes

### 1. Shared library: `src/lib/relay-list/index.js` (new, CommonJS, no imports)

Exports for this ADR: `normalizeRelayUrl`, `parseRelayList`, `MAX_RELAYS`, `MAX_PARSED_R_TAGS`. ADRs 0002
and 0003 add the rest of its exports. `ui/vite.config.js`: alias `'@tapestry/relay-list'` →
`src/lib/relay-list`, and `/src\/lib\/relay-list/` in `build.commonjsOptions.include`, beside the
identification-tags entries.

### 2. Server: `src/api/assistant/attention.js` (edit)

- New `lookupNewestReplaceable({ kind, author, relays }, deps)` (sub-decision 2), exported.
- `defaultDeps()` gains `checkOutboxRelays: (input, d) => require('./outboxRelays').checkOutboxRelays(input, d)`
  and `getConfiguredPublishRelays: () => require('./profilePublish').getConfiguredPublishRelays()`. Tests
  inject `checkOutboxRelays` to keep the identification-tags suites off the network.
- The assistant branch: `Promise.allSettled` over the checks (sub-decision 5); `actions` gains
  `[OUTBOX_RELAYS]`. Export `OUTBOX_RELAYS = 'outbox-relays'` beside `IDENTIFICATION_TAGS`.
- The header comment's "Today one action is checked" paragraph gains the outbox check.

### 3. Server: `src/api/assistant/outboxRelays.js` (new, CommonJS, dependency-injected)

The `attention.js` idiom: `defaultDeps()` with lazy requires, so the module loads in a bare checkout.

- `checkOutboxRelays({ assistantPubkey }, deps)`: `relays = outsideOnly(deps.getConfiguredPublishRelays(), deps)`;
  `lookup = await lookupNewestReplaceable({ kind: 10002, author: assistantPubkey, relays }, deps)`;
  `return evaluateOutboxRelays({ lookup })` (plus `suggestions`, ADR 0002).
- `evaluateOutboxRelays({ lookup })` (pure, sub-decision 4).
- Exports: `checkOutboxRelays`, `evaluateOutboxRelays`, `RELAY_LIST_KIND = 10002`.

### 4. UI

- `ui/src/pages/assistant/actions.js`: the entry, `NIP_LINKS.relayList`, `CHECKED_ACTIONS`, and — unless
  already on the base — the Done badge's `done` field and copy (sub-decision 6). The file comment's "ten
  actions" becomes "eleven".
- `ui/src/pages/assistant/Index.jsx` and `ui/src/styles.css`: the Done badge, unless already on the base.

### 5. Documents

- `src/api/openapi.yaml` (`/api/assistant/attention`): the `outbox-relays` action's shape.
- BIBLE §11's `/api/assistant/attention` row (`BIBLE.md:527`): add "and `outbox-relays`: the outbox relays
  the assistant's newest kind 10002 names, local relay first (assistant-outbox-relays ADR 0001)". Bump
  the "Last updated" line.

### 6. For the Tester (Phase 3, not implementation)

Re-aim the pins listed under § Codebase facts: eleven actions; `CHECKED_ACTIONS`; the pill counts where a
mocked answer has no `outbox-relays` key (the action is now checked, so a missing answer marks the card
and no longer counts in the pill). A Playwright mock that wants the card unmarked includes
`actions['outbox-relays']` with `done: true`.

## Out of scope

- The page and its suggestions (ADR 0002); publishing (ADR 0003).
- Whether the named relays are reachable, or hold the Assistant's other events.
- Copying a relay-only list home; a memo; polling.
