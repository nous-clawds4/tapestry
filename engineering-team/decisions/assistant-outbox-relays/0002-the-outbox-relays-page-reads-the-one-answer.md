# ADR 0002: The Outbox Relays page reads the one answer — an on-screen draft, suggestions from the server, the rules in the shared library

**Status:** Accepted
**Date:** 2026-10-09
**Story:** `engineering-team/stories/assistant-outbox-relays/2-the-outbox-relays-page.md`

## Context

Story 2 replaces the placeholder at `/assistant/outbox-relays` with the page. In short:

- **AC-1.** Back link, title, description; signed-out and no-assistant lines; a panel **Your
  Assistant's outbox relays** drawn from story 1's answer (Checking…, could-not-check reasons, the list or
  none yet) with the hub's mark; the inbox-only line.
- **AC-2.** An on-screen draft, rebuilt from each new answer; nothing stored; an unpublished-changes line;
  an unfinished check starts an empty, editable list.
- **AC-3.** Add by hand: `ws(s)://` with a host, trimmed; same relay up to host case and one trailing
  slash; refusals for not-a-relay and already-listed.
- **AC-4.** **Suggested relays**: this instance's own relay at its public address, then Relay Settings'
  General Purpose, Trusted Assertion, Trusted List, DList and Outbox lists, each once, minus the draft;
  per-row **Add**, **Add all**; two empty states; follows Relay Settings with no code change.
- **AC-5.** **Remove** per relay; a removed suggestion returns; screen-reader names on Add and Remove.

### Concept-graph orientation

Stack absent (AGENTS.md §2 fallback), as in ADR 0001. The suggestions come from Relay Settings
(`aRelays`), the store the Relays settings page writes and the profile publish reads (ADR
assistant-profile/0002), not from the `nostr-relay` concept's relay sets. **No concept changes. No
firmware reinstall.**

### Codebase facts this design rests on

- **The pattern page.** `ui/src/pages/assistant/IdentificationTags.jsx` reads the shared answer through
  `useAssistantAttention()` and never fetches for its state (its suite's S1 sentinel); it keeps
  component state rebuilt from each new answer (`useEffect(…, [answer])`, `:178-181`); words and pure
  rules live in `identificationTagsCopy.js` (no imports, Node-loadable; named apart from the page because
  the dev bind mount is case-insensitive, ADR assistant-identification-tags/0002 Amendment 1).
- **Styles to match.** The hub's `bs-setup-*` page frame and the Identification Tags cards:
  `bs-idtags-card`, `-marker`, `-head`, `-title`, `is-marked` / `is-done`, `bs-setup-step-badge`
  (`is-done`), `bs-idtags-publish`, `bs-idtags-result*` (`ui/src/styles.css:8950-9021`).
- **Routes.** `ACTION_PAGES` in `ui/src/App.jsx:146-149` maps an action key to its built page.
- **This instance's relay.** `BRAINSTORM_RELAY_URL` (`config/brainstorm.conf.template:66`) is the relay
  address the instance advertises (the NIP-85 kind 10040 uses it as its relay hint,
  `src/api/export/nip85/currentMap.js:20`); on staging, `wss://staging.brainstorm.world/relay`. On a dev
  box it is a loopback address. `isPublicHost(host)` (`src/api/assistant/profileDefaults.js`, exported)
  tells the two apart syntactically, with no DNS (ADR assistant-profile/0003 sub-decision 1).
- **Relay Settings.** `readConfiguredRelays(categories)` (`profilePublish.js:70-98`): the named lists in
  order, each relay once, read at call time. The five keys: `aPopularGeneralPurposeRelays`,
  `aTrustedAssertionRelays`, `aTrustedListRelays`, `aDListRelays`, `aOutboxRelays`
  (`src/config/defaults.json`; the default Outbox list is empty).

## Options considered

### Option A — The page reads the one answer; the server adds `suggestions` to it (chosen)

`actions['outbox-relays'].suggestions` is computed by the server with the check. The page reads
everything from `useAssistantAttention()`, holds the draft in component state, and calls pure draft rules
from `@tapestry/relay-list`.

**Pros:** the page's list and mark come from the same answer as the hub card and the pill, so they cannot
disagree; no new route; the suggestions follow Relay Settings because the server reads them per request.
**Cons:** every attention answer for a viewer with an Assistant carries the suggestion list (about nine
URLs with today's defaults), used only on this page.

### Option B — The page fetches its own `GET /api/assistant/outbox-relays` (list and suggestions)

**Pros:** the attention answer stays about attention only.
**Cons:** a second answer for the same list, which can disagree with the hub's mark while one is fresh
and the other not; a second request. Rejected, as the Identification Tags page rejected its own fetch.

### Option C — Suggestions computed in the browser from the settings the app already loads

Relay Settings already reach every browser (`useConfig().aRelays`, from the public `GET /api/relays`,
`ui/src/context/ConfigContext.jsx:42-45`).

**Pros:** no server change for the five lists.
**Cons:** the browser does not hold `BRAINSTORM_RELAY_URL` or the public-host rule, so this instance's own
relay — the first suggestion — would still need the server; the list would come from two sources with two
normalizers. Rejected.

## Decision

We chose **Option A**.

### Sub-decisions

**1. The suggestions, on the server.** `outboxSuggestions(deps)` in `src/api/assistant/outboxRelays.js`:

1. This instance's relay: `normalizeRelayUrl(getConfigFromFile('BRAINSTORM_RELAY_URL', ''))`, kept only
   when its hostname passes `isPublicHost` (story AC-4: "at its public address, when the instance has
   one").
2. Then `readConfiguredRelays(['aPopularGeneralPurposeRelays', 'aTrustedAssertionRelays',
   'aTrustedListRelays', 'aDListRelays', 'aOutboxRelays'])`, each through `normalizeRelayUrl`.
3. In that order, each relay once by its normalized form, at most `MAX_RELAYS`.

`checkOutboxRelays` adds `suggestions` to the action; it is computed before the lookup, so an unfinished
check still carries it. The `check-failed` action (ADR 0001 sub-decision 5) carries `suggestions: []`.
The draft is the browser's, so the server never filters the suggestions by it.

**2. The draft rules, in the shared library (`src/lib/relay-list/`).** Pure, so Node suites test them
directly:

- `addRelay(draft, input)` → `{ draft, error }`: `error` is `'not-a-relay'` (does not normalize),
  `'already-listed'` (its normalized form is in the draft) or `'too-many'` (the draft already holds
  `MAX_RELAYS`), else `null` with the normalized relay appended.
- `removeRelay(draft, url)` → the draft without it (by normalized form).
- `visibleSuggestions(suggestions, draft)` → the suggestions not in the draft, in order.
- `addAll(draft, suggestions)` → the draft with every visible suggestion appended, in order, stopping
  at `MAX_RELAYS`.
- `sameRelayList(a, b)` → same length and the same normalized relay at each position.

The draft always holds normalized spellings, so what the page shows is what story 3 publishes.

**3. The page: `ui/src/pages/assistant/OutboxRelays.jsx`, words in `outboxRelaysCopy.js`.**

- `outboxRelaysCopy.js`: `OUTBOX_RELAYS_COPY` (story § Copy) and two pure helpers, `checkLine(phase,
  answer)` (Checking…, a reason's words, or `null`) and `inboxLine(n)` (the 1 / n wording). No imports.
  The reason words are the identification-tags ones re-worded for a relay list, keyed by the same reason
  codes plus `check-failed` → the request-failed line.
- The frame is the Identification Tags page's: `TopBar`, `bs-setup-main`, `bs-setup-back`,
  `bs-setup-title`, `bs-idtags-description` with `ActionText` over the action's description.
- **Panel 1, Your Assistant's outbox relays** — a `bs-idtags-card` with its marker and badge from the
  hub's reading, `assistantAttention(user, attention)`: marked while `needsAttention` includes
  `outbox-relays`, done while `done` does (ADR 0001 sub-decision 6). Under the heading: the check line;
  the draft as a list, each row `<code>{relay}</code>` and a **Remove** button with
  `aria-label="Remove {relay}"`; the none-yet line when the draft is empty and the check finished; the
  inbox line when `inboxOnlyCount > 0`; the unpublished line while `!sameRelayList(draft, published)`;
  then the **Add a relay** field (a labelled `<input type="text">`, placeholder `wss://relay.example.com`)
  and its **Add** button in a `<form>`, so Enter adds; a refusal line under the field, cleared by the
  next edit. Story 3's button and report close the panel (ADR 0003).
- **Panel 2, Suggested relays** — a `bs-idtags-card` with no mark: the explainer line, then each visible
  suggestion as a row with an **Add** button (`aria-label="Add {relay}"`), and **Add all** when at least
  one is visible; otherwise the all-on-the-list line (`suggestions.length > 0`) or the none-at-all line.
- `published` = `answer.outbox` when the action's answer is `finished`, else `[]`. The draft is rebuilt
  from it on each new answer: `useEffect(() => setDraft(published), [answer])`, the Identification Tags
  idiom. Signed out and no assistant: only the frame and the hub's lines (AC-1), no panels.
- New CSS only where the Identification Tags cards have no class: the relay rows (`bs-outbox-relays`,
  `bs-outbox-relay`, `bs-outbox-relay-remove`), the field row (`bs-outbox-add`), and the note lines
  (`bs-outbox-note`), in the same tokens; the mobile rule mirrors `.bs-idtags-row`'s.

**4. The route.** `ACTION_PAGES['outbox-relays'] = <OutboxRelaysPage />` in `App.jsx`; the placeholder
stops serving it.

**What we trade away**
- The attention answer carries page-only data (the suggestions).
- A refresh of the answer while the person is editing (it happens only after a publish, or on
  `onEventPublished` for a tagging) discards the draft, as the Identification Tags checkboxes are rebuilt.

## Consequences

- **Enables:** story 3 adds its button and report to panel 1 and sends `draft` as is.
- **New copy, not in the story:** the `'too-many'` refusal — "A relay list here holds at most 50
  relays." — because story 3 AC-2 caps the request at 50 and the page should not offer a list the server
  refuses. With today's defaults the suggestions are nine relays, so a person meets it only by typing 41
  more. *(Confirm at this gate.)*
- **Debt:** the page reuses `bs-idtags-*` card classes outside the Identification Tags page. If a third
  page wants them, renaming them to a neutral `bs-action-card` is a candidate ledger row.
- **Firmware reinstall required?** No.

## Implementation notes

- `src/lib/relay-list/index.js`: add `addRelay`, `removeRelay`, `visibleSuggestions`, `addAll`,
  `sameRelayList`.
- `src/api/assistant/outboxRelays.js`: add `outboxSuggestions(deps)`, exported; `defaultDeps()` gains
  `getConfigFromFile`, `readConfiguredRelays` and `isPublicHost` (lazy requires); `checkOutboxRelays`
  returns `{ ...evaluateOutboxRelays({ lookup }), suggestions }`. Export `SUGGESTION_RELAY_CATEGORIES`.
- `ui/src/pages/assistant/outboxRelaysCopy.js` (new, no imports), `ui/src/pages/assistant/OutboxRelays.jsx`
  (new), `ui/src/App.jsx` (`ACTION_PAGES`), `ui/src/styles.css` (the `bs-outbox-*` rules).
- `src/api/openapi.yaml`: `suggestions` in the `outbox-relays` action.

## Out of scope

- Publishing and the report (ADR 0003).
- Reordering; reachability tests; inbox relays; a draft that survives a reload.
