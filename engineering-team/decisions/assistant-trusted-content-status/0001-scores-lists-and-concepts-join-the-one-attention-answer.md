# ADR 0001: Scores, Lists and Concepts join the one attention answer — the viewer's Treasure Map, read on the server through the Treasure Map page's own category rule

**Status:** Accepted (approved 2026-10-08)
**Date:** 2026-10-08
**Story:** `engineering-team/stories/assistant-trusted-content-status/1-scores-lists-and-concepts-on-the-hub.md`

## Context

The story renames the hub's first three *Publication of Trusted Content* cards to **Scores**, **Lists** and
**Concepts**, and gives each a real answer. In short:

- **AC-1.** New titles; descriptions, NIP links and addresses unchanged; each card's page shows the new title, the
  rule as its *Alert criteria*, and one link, **Manage your Treasure Map →**, to `/treasure-map`.
- **AC-2.** One answer about the session viewer's own newest kind 10040 and their own Assistant here, read-only, in
  the hub's existing single request; nothing for visitors or viewers without an Assistant.
- **AC-3.** Done when the viewer's Assistant here is among the Assistants the Map gives the category to, read
  exactly as `/treasure-map`'s cards read it; otherwise needs attention, reason `no Map` / `not assigned` /
  `other Assistants only`.
- **AC-4.** `/setup`'s "finished": the Map was found, or the local relay held none and at least one outside relay
  answered. Unfinished is neither done nor needing attention.
- **AC-5.** The hub's two readings: the page marks unless done; the pill counts only a finished needs-attention.
  Done cards get the hub's Done look (assistant-profile-checklist #1 AC-6), Identification Tags included.
- **AC-6.** After a Map save in this app, the hub and the pill catch up without a reload; no polling.

No concept-graph node is involved. The Treasure Map is a kind 10040 event, and the person and their Assistant are
`39998:<TA>:nostr-user` instances, resolved from the session, not the graph. The local graph holds 9 concepts (the
empty-graph dev state), so the AGENTS.md §2 fallback applies; no handle is cited beyond the story's.

### Codebase facts

- **The one attention answer.** `src/api/assistant/attention.js` `handleAssistantAttention` (`:207`) resolves the
  session viewer and `getAssistantPubkeyFor(viewer)`, then awaits one check, `checkIdentificationTags` (`:219`), and
  answers `actions: { 'identification-tags': … }`. ADR assistant-identification-tags/0001 chose this shape for
  growth: "the next action adds a key to the map and its check to the module".
- **The Map is already read on the server, for `/setup`.** `src/api/setup/status.js` `lookupNewest({ kind, pubkey,
  relays }, deps)` (`:132`) scans this instance's relay first (strict: a failed scan rejects, never "none"), then
  only on a miss asks the outside relays in parallel, each within `RELAY_BUDGET_MS`. It returns `{ finished: true,
  event, source }` or `{ finished: false, reason: 'local-unreadable' | 'no-outside-relays' | 'outside-unreachable'
  }`. That is AC-4 to the letter. `treasureMapRelays(deps)` (`:243`) is the server's Map list (the NIP-85 home relay,
  Relay Settings' Trusted Assertion and popular general-purpose relays: `currentMap.defaultRelays()`), minus this
  instance's own. Step 3, "Activate your Brainstorm account", reads the viewer's Map exactly this way.
- **The category rule.** `ui/src/pages/treasure-map/manageTreasureMap.js:164-280`: `CATEGORIES`, `entryOf`,
  `appliesTo`, the private `shadowed`, `categoryEntries` and `categoryAssistants`. They depend on nothing but two
  regexes. `categoryAssistants(event)` returns `{ scores, lists, concepts }`, each the lowercased pubkeys of each
  counted key's *first* delegate (backups don't count). `localPubkey` in `categoryCards` is how the page marks the
  viewer's own Assistant. The rule has changed four times in three weeks (treasure-map-edit #1 and #2,
  treasure-map-card-details #2, the `*:…` scopes fix), and nine Node suites import `manageTreasureMap.js` as it is
  (`test/manage-treasure-map-*.test.js`, `test/treasure-map-*.test.js`).
- **The server cannot `require` a UI module.** `ui/package.json` is `"type": "module"`; `src/utils/assistantPages.js`
  keeps a second home for a UI constant for that reason. The shared-library pattern is CommonJS in `src/lib/` plus a
  Vite alias (`@tapestry/identification-tags`). A module that imports through an alias cannot be loaded by the Node
  runner, which is why `actions.js` "keeps its one import" (test/assistant-attention.test.js D4). Node, though, can
  `import()` an ES module from CommonJS (`test/manage-treasure-map-cards.test.js` does it with `pathToFileURL`), and
  the container runs Node v22.22.2. The image ships the whole tree (`Dockerfile:92` `COPY .`; `.dockerignore`
  excludes neither `src/lib` nor `ui/src`). Vite's dev server already allows reading outside `ui/`
  (`ui/vite.config.js` `server.fs.allow: ['..']`).
- **The hub's two readings.** `ui/src/pages/assistant/actions.js` `CHECKED_ACTIONS = ['identification-tags']`
  (`:218`) and `assistantAttention(user, attention)` (`:235`). The three cards are entries `trusted-assertions`
  (`:65`), `trusted-lists` and `dlists` (`:91`). Their keys are also their address segments.
- **The placeholder page.** `ui/src/pages/assistant/ActionPage.jsx` renders `action.title` as its heading,
  `action.alertCriteria || notYetDefined`, and an optional `action.editLink` (`{ text, to }`). The profile entry uses
  it today. `MANAGE_TREASURE_MAP_PATH = '/treasure-map'` is in `ui/src/config/avatarMenuLinks.js:60`, the module
  `actions.js` already imports from.
- **The catch-up hook.** `ui/src/context/AssistantAttentionContext.jsx:71-77` refreshes the answer when
  `onEventPublished` announces a kind 39999 tagging by the viewer or their Assistant. The Map save
  (`ui/src/pages/treasure-map/useMapSave.js:79`) publishes through `publishEverywhere`, which announces the signed
  event once the local write succeeds (`ui/src/utils/nostrPublish.js:223-233`). A re-check therefore finds the new
  Map on this instance's relay.
- **Parallel books on the same lines** (book § Shared lines). ADR assistant-profile-checklist/0001 sub-decisions 6–7
  and ADR assistant-outbox-relays/0001 both: isolate each new check with `Promise.allSettled` (a rejected check
  becomes `{ finished: false, done: false, pending: false, reason: 'check-failed' }`); add `done: string[]` to
  `assistantAttention`; give `ActionCard` a `done` prop drawing class `is-done`, a ✓ marker,
  `bs-setup-step-badge is-done` with **Done** and the screen-reader prefix **Done: **; add `ASSISTANT_COPY.done` and
  `doneSrPrefix`; and add one CSS rule. Whichever story is built first introduces these; the others reuse them.

### Constraints

- **Principle 1 (POV).** Whose Map and which Assistant come from the session only; no request parameter.
- **Principle 3.** Re-derived per request; nothing stored, no memo, no polling.
- **Principle 4.** Read-only: strfry is scanned, outside relays are read, nothing is written.
- **The TA pubkey is resolved at runtime** (`getAssistantPubkeyFor`), never a literal.
- **House stack:** JS without build; no new tooling; `actions.js` keeps its one import; the nine Node suites keep
  loading `manageTreasureMap.js` as it is.

## Options considered

### Option A — The server computes the answer from the page's own rule, moved into one shared ES module (chosen)

Move the pure category rule out of `manageTreasureMap.js` into `src/lib/treasureMapCategories.mjs`, an ES module
with no imports. `manageTreasureMap.js` imports it by relative path and re-exports the same names, so its consumers
and the nine suites don't change. A new `src/api/assistant/trustedContent.js` reads the viewer's Map with
`/setup`'s `lookupNewest` and `treasureMapRelays`, loads the rule with a memoized dynamic `import()`, and answers
the three actions. `handleAssistantAttention` runs it beside the other checks.

**Pros**
- **One rule.** `/treasure-map`'s cards and the hub run the same code, so they cannot disagree, whatever the rule
  becomes next.
- **One Map read.** `/setup`'s read already says "finished" the way AC-4 does, so `/setup` and `/assistant` agree
  about the same viewer's Map.
- The answer arrives in the request the hub already makes (AC-2). The provider, both readings and the pill work
  unchanged.
- No build change. Vite bundles a relative ES-module import natively, with no CommonJS transform and no alias; Node
  loads it from both sides.

**Cons**
- **Two firsts:** a `.mjs` in `src/lib/`, and a server `import()` of it. A test must pin that the module stays
  import-free, since an import it can't resolve on the server would fail the check (as `check-failed`, isolated).
- **A cross-boundary relative import** from `ui/src` into `src/lib`. The aliases exist for CommonJS. For an ES module
  the relative path is the simpler form, and `server.fs.allow: ['..']` already permits it in dev.
- The answer waits for the Map read: on a local miss, up to `RELAY_BUDGET_MS` (8 s) for the outside relays, run in
  parallel with the other checks. `/setup` already pays this on the same page loads.

### Option B — A CommonJS mirror of the rule on the server, held equal by a parity suite

Copy `entryOf` / `appliesTo` / `shadowed` / `categoryAssistants` into `src/lib/treasureMapCategories.js` (CJS). A
suite runs both copies over a shared fixture corpus. Precedents: `src/lib/dtag.js` ↔ `ui/src/utils/dtag.js`,
`bValueForms` ↔ `bDisposition`.

**Pros:** no new module kind and no dynamic import; every piece is a known pattern.
**Cons:** two copies of a rule that changed four times in three weeks. The parity suite catches only the drift its
fixtures exercise; an edge it doesn't cover makes the hub and `/treasure-map` disagree silently, the failure the
epic's guardrail names. Every future rule change must be made twice.

### Option C — Move the rule into a CommonJS library behind a Vite alias (the identification-tags pattern)

**Pros:** the house's established sharing pattern.
**Cons:** `manageTreasureMap.js` would import through `@tapestry/…`, which the Node runner can't resolve. All nine
suites that load it as it is would break, and the module would have to give up its "loads in Node as it is"
contract, or the suites would need a loader. Cross-boundary CommonJS also needs the `commonjsOptions.include`
treatment and is the known weak spot of Vite's dev mode. That's more churn than Option A, for the same single rule.

### Option D — The browser computes it: the hub and the pill read the Map themselves

`AssistantAttentionProvider` runs `useTreasureMap(pubkey, { strict: true })` and `categoryAssistants`, and merges
three client-side answers into `actions`.

**Pros:** no server change; the rule is used where it lives.
**Cons:** breaks AC-2's "in the same single request". The pill, mounted on every page, would make every page load a
concept-graph Cypher read plus a relay read for the Map. One answer would come from two sources with two "finished"
rules (the hook's `strict` contract is not `/setup`'s). ADR assistant-identification-tags/0001 decided against
browser-side checks for exactly this.

## Decision

We chose **Option A**. It is the only option with exactly one category rule *and* exactly one "finished" rule, and
it adds the three actions the way the attention answer was designed to grow. Its cost is a new module kind (`.mjs`
in `src/lib/`), which a test pins import-free, and a worst-case wait that `/setup` already pays.

### Sub-decisions

**1. The rule's one home: `src/lib/treasureMapCategories.mjs`.** It holds, unchanged in behaviour, `CATEGORIES`
(exported as `TREASURE_MAP_CATEGORIES`), `entryOf`, `appliesTo`, `shadowed` (still private), `categoryEntries` and
`categoryAssistants`, with their doc comments. It has no `import` statements and touches no globals, so both the
server and the browser can load it. `manageTreasureMap.js` imports these by relative path
(`../../../../src/lib/treasureMapCategories.mjs`) and re-exports `entryOf`, `appliesTo`, `categoryEntries` and
`categoryAssistants` under the same names. `categoryCards` and everything else stay where they are.

**2. Done means the viewer's Assistant is among `categoryAssistants(map)[category]`.** Read as the cards read it:
each key's first delegate counts and backups don't; a `*` hidden by a bare family entry doesn't count; a `*:…` never
counts. Pubkeys compare lowercased; `entryOf` already lowercases.

**3. Which Map: `/setup`'s read.** `lookupNewest({ kind: 10040, pubkey: viewer, relays: treasureMapRelays(deps) },
deps)`, imported from `src/api/setup/status.js`. Its relays are the NIP-85 home relay, Relay Settings' Trusted
Assertion relays and the popular general-purpose relays, minus this instance's own. That includes the
general-purpose relays the story names, plus the two places a Map is published to. `/treasure-map`'s browser hook
reads the concept graph's general-purpose set, which can differ from Relay Settings on a given instance. The hub
follows `/setup`, so the two server answers about the same Map agree. When the lists differ, the outcome is at most
"unfinished" or "no Map" on one page and a Map on the other, never a wrong Done.

**4. The answer's shape.** Three keys, the actions' existing keys (their address segments, which the story keeps):

| key | category |
|---|---|
| `trusted-assertions` | `scores` |
| `trusted-lists` | `lists` |
| `dlists` | `concepts` |

Each value is `{ category, finished, done, pending, reason, source }`:

| lookup | category assigned to… | finished | done | pending | reason |
|---|---|---|---|---|---|
| unfinished | — | false | false | false | the lookup's (`local-unreadable` · `no-outside-relays` · `outside-unreachable`) |
| finished, no Map | — | true | false | true | `no-map` |
| finished, Map | the viewer's Assistant (alone or among others) | true | true | false | `null` |
| finished, Map | nobody | true | false | true | `not-assigned` |
| finished, Map | only others | true | false | true | `other-assistants-only` |

`source` is the lookup's (`local` · `relay` · `null`). As in the other actions' answers, no pubkey is included.

**5. The check: `src/api/assistant/trustedContent.js`.**
- `evaluateTrustedContent({ lookup, assistantPubkey, assignments })`: pure; returns the three keyed values of
  sub-decision 4. `assignments` is `categoryAssistants(lookup.event)`, or `null` when there is no Map.
- `checkTrustedContent({ viewer, assistantPubkey }, deps)`: one `lookupNewest`, then (only for a found Map)
  `(await deps.loadCategoryRule()).categoryAssistants(event)`, then `evaluateTrustedContent`.
- `loadCategoryRule()`: memoizes `import(pathToFileURL(path.join(__dirname, '../../lib/treasureMapCategories.mjs')).href)`.
  If it rejects, the memo is cleared so a later request retries.
- Exports `checkTrustedContent`, `evaluateTrustedContent`, `loadCategoryRule`, and `TRUSTED_CONTENT_ACTIONS` (the
  table above, as `{ 'trusted-assertions': 'scores', … }`).

**6. Isolation: `Promise.allSettled`.** `handleAssistantAttention` runs `checkIdentificationTags` and
`d.checkTrustedContent(...)` together. An identification-tags rejection is rethrown (today's 500, unchanged). A
trusted-content rejection gives all three keys `{ category, finished: false, done: false, pending: false, reason:
'check-failed', source: null }` and is logged. This is the parallel ADRs' sub-decision; whichever lands first
introduces `allSettled` and the others add their check to it.

**7. The hub's readings and Done look.** `CHECKED_ACTIONS` gains `'trusted-assertions'`, `'trusted-lists'`, `'dlists'`,
kept in `ASSISTANT_ACTIONS` order. The `done: string[]` field, the `ActionCard` `done` prop and marks, the copy keys
and the CSS rule are ADR assistant-profile-checklist/0001 sub-decision 7 exactly. If that story has landed, reuse
them; if not, build them to that text. `needsAttention`, `count` and `alertCount` keep their rules, which already
give AC-5's two readings for a checked action.

**8. The entries' words.** The three entries' `title`s become `Scores`, `Lists` and `Concepts`; their
`alertCriteria` become the story's § Copy sentences; each gains `editLink: { text: 'Manage your Treasure Map →', to:
MANAGE_TREASURE_MAP_PATH }`, added to `actions.js`'s existing import from `avatarMenuLinks.js`, so the file still
has one import. Keys, paths, descriptions and NIP links are untouched. `ActionPage.jsx` needs no change: it already
renders `title`, `alertCriteria` and `editLink`.

**9. Catch-up after a Map save.** The provider's `onEventPublished` listener also calls `refresh()` for an event with
`kind === 10040` and `pubkey === ` the viewer's pubkey. Nothing else changes: no polling, and a Map published
elsewhere shows on the next full load.

**What we trade away**
- On a page load for a viewer with an Assistant, the answer (and so the pill) waits for the Map read: instant on a
  local hit, up to about 8 s when the local relay has no Map and outside relays are slow.
- The hub's Map relays are the server's list, not the concept graph's (sub-decision 3).
- A Map that names the viewer's Assistant only as a *backup* reads as needing attention, as the card shows only the
  first delegate.

## Consequences

- **Enables:** a later page behind each card can draw its status and reason from `actions[key]` and call
  `refresh()`. Any future server need for the category rule loads the same module.
- **The pill moves.** For viewers whose Map already names their Assistant here for a category, the pill drops by one
  per category on the first deploy; for viewers with no Map, it stays as today (placeholder → finished
  `no-map`, both counted). Unfinished reads stop counting.
- **The rule's contract widens.** `treasureMapCategories.mjs` now has a server consumer, so it must stay import-free
  and browser-API-free. Its header says so, and a test pins it.
- **Debt:** the Map's relay list differs between the browser hook and the server (sub-decision 3). OPEN.md row 249
  (move the TA Treasure Map page onto the hook) is the nearest existing thread; this ADR doesn't widen the gap, but
  it adds a second server reader of it.
- **Firmware reinstall required?** No. No concept definitions change.

## Implementation notes

### 1. `src/lib/treasureMapCategories.mjs` (new)
- The block at `manageTreasureMap.js:158-280` (the "Assistants by category cards" comment banner through
  `categoryAssistants`), moved with its doc comments and no behaviour change. `export const TREASURE_MAP_CATEGORIES =
  ['scores', 'lists', 'concepts'];`. `HEX64`, `KIND` and `shadowed` stay module-private.
- Header: what it is; its two consumers (the Treasure Map page, `src/api/assistant/trustedContent.js`); the
  contract "no imports, no browser or Node APIs, so both sides load it as it is".

### 2. `ui/src/pages/treasure-map/manageTreasureMap.js` (edit)
- `import { TREASURE_MAP_CATEGORIES, entryOf, appliesTo, categoryEntries, categoryAssistants } from
  '../../../../src/lib/treasureMapCategories.mjs';` then `export { entryOf, appliesTo, categoryEntries,
  categoryAssistants };`. `categoryCards` iterates `TREASURE_MAP_CATEGORIES`. The header's "only a `.js`-suffixed
  import" line names the new import too.

### 3. `src/api/assistant/trustedContent.js` (new)
- As sub-decision 5. Requires `lookupNewest` and `treasureMapRelays` from `../setup/status`. Uses the `deps` object
  `handleAssistantAttention` builds (`scanLocal`, `readRelay`, `getConfigFromFile`), plus `mapDefaultRelays` and
  `loadCategoryRule`, added to `attention.js`'s `defaultDeps()` (the former as `status.js` defines it).

### 4. `src/api/assistant/attention.js` (edit)
- `defaultDeps()` gains `mapDefaultRelays`, `loadCategoryRule` and `checkTrustedContent: (input, d) =>
  require('./trustedContent').checkTrustedContent(input, d)`. Tests inject `checkTrustedContent` to keep the
  identification-tags suites off the network.
- The assistant branch per sub-decision 6. `actions` gains the three keys.
- Header comment: the "Today one action is checked" paragraph gains Scores, Lists and Concepts, and the reasons.

### 5. UI
- `ui/src/pages/assistant/actions.js`: sub-decisions 7–8. The header's "which actions are checked" note gains the
  three.
- `ui/src/pages/assistant/Index.jsx`, `ui/src/styles.css`: the Done marks of sub-decision 7, unless already landed.
- `ui/src/context/AssistantAttentionContext.jsx`: sub-decision 9; its header's refresh paragraph names the Map
  save.

### 6. Documents
- `src/api/openapi.yaml` (`:291`): the three keys' shape.
- BIBLE §11's `/api/assistant/attention` row (`BIBLE.md:527`): "Today it checks `identification-tags` …" gains "and
  Scores, Lists and Concepts (`trusted-assertions`, `trusted-lists`, `dlists`): whether the viewer's newest
  Treasure Map gives each category to their own assistant, read local-first as `/setup` reads it, through the
  Treasure Map page's category rule (assistant-trusted-content-status ADR 0001)". Bump the "Last updated" line.
- The story's § Copy is the source of the words. assistant-management #1's § Copy gets a dated note that these
  three titles and criteria moved here.

### 7. For the Tester (Phase 3, not implementation)
- Pins to re-aim: the three titles wherever a suite reads them (`test/assistant-management-page.test.js`); C2's
  `CHECKED_ACTIONS` (`test/assistant-attention.test.js`); pill counts in unit and Playwright suites whose mocked
  answer lacks the three keys. A mock that wants a card unmarked supplies `actions[key]` with `done: true`.
- Any suite that pins `manageTreasureMap.js`'s *source* text (rather than its exports) for the moved functions.
- New: the rule module has no `import`; `manageTreasureMap.js`'s re-exports are the same functions as the module's
  (identity, not just equal output); the server check over sub-decision 4's table, including `*`, Mixed, backup-only
  and a hidden `*`; `check-failed` isolation; the 10040 refresh.

## Out of scope

- The pages behind the three cards beyond title, criteria and link: status, reasons, and fixes.
- Unifying the Map relay list between the browser hook and the server.
- The `/treasure-map` pill's rule, the FAQ's words, and renaming the actions' keys or addresses.
- Whether the Assistant actually publishes Scores, Lists or Concepts events.
- A memo, polling, or a server-sent refresh.
