# ADR 0001: The profile check joins the one attention answer — seven items, checked on the server for the viewer's own Assistant, and a Done badge on the hub

**Status:** Accepted (approved 2026-10-09)
**Date:** 2026-10-09
**Story:** `engineering-team/stories/assistant-profile-checklist/1-the-profile-check-and-the-hubs-done-mark.md`

## Context

Story 1 gives the profile action its real "needs attention" answer and makes the hub's card, its count
line and the Assistant Alert read it. In short:

- **AC-1.** One list of seven profile items, in order: avatar, background image (listed, does not
  count), NIP-05, website, name and About, client tag, visible to other nostr apps. Adding one is one
  entry.
- **AC-2.** The answer is about the session's own Assistant. No parameter changes whose it is.
- **AC-3.** The profile is the Assistant's newest kind 0, found as every setup surface finds it (ADR
  assistant-profile/0001). No profile: every counted item needs attention, reason `no-profile`.
- **AC-4.** Each item's rule, with its reasons. On an instance with no public web address, the
  avatar, NIP-05, website and client tag need attention, reason `no-public-address` (settled at
  approval).
- **AC-5.** Finished, as `/setup` means it; an unfinished item is neither done nor needing attention.
- **AC-6.** The hub's card is marked unless finished and every counted item done; a **Done** badge
  for any checked action that is done; the pill counts only the confident reading.
- **AC-7.** Read-only, fetched with the Identification Tags answer, no polling.

Settled at approval (2026-10-09): a dev box's four instance-bound items stay needs-attention; one
outside relay is enough for "visible".

### Concept-graph orientation

The stack is absent in this session (`curl localhost:7778/api/concept-graph/summaries` does not
answer), so this follows the AGENTS.md §2 fallback. The story names one concept,
`39998:<TA>:nostr-user`, only as "whose Assistant". It is not read or written. A kind 0, a
`.well-known` listing and a file on the volume are not concept-graph nodes (as ADR ta-avatar/0003
confirmed against a live graph for the composite). **No concept changes. No firmware reinstall.**
Re-verify that claim against a live graph at Test Design if the stack is up.

### Codebase facts this design rests on (verified on `374a6ec`, origin/staging `a217d0c` plus this book's story commits)

- **The one answer, shipped.** `GET /api/assistant/attention` (`src/api/assistant/attention.js`)
  answers for the session's viewer with an `actions` map. Today the map has one key,
  `identification-tags`, each action with `finished`, `done` and `pending` (ADR
  assistant-identification-tags/0001 sub-decision 5). `handleAssistantAttention(req, res, deps = {})`
  resolves `getAssistantPubkeyFor(session.pubkey)` and returns 500 on a throw (`attention.js:207-224`).
- **The two readings.** `assistantAttention(user, attention)` (`ui/src/pages/assistant/actions.js:235-254`)
  marks a checked action unless its answer says `done` (the page reading), and counts it in the pill
  only when it says `pending`. `CHECKED_ACTIONS = ['identification-tags']` (`actions.js:218`) is
  static, so a failed fetch never turns a checked action into a placeholder. `Index.jsx:52` and
  `TopBarAlert.jsx:40` read it.
- **The provider.** `AssistantAttentionProvider` (`ui/src/context/AssistantAttentionContext.jsx`)
  fetches once per full page load for a viewer with `user.assistantPubkey`, and on `refresh()`.
- **The hub card has no done state.** `ActionCard` (`ui/src/pages/assistant/Index.jsx:30-47`) draws
  the `!` marker and the **Needs attention** badge, or nothing. The Identification Tags page's cards
  draw a ✓ marker and `bs-setup-step-badge is-done` with "Done" (`IdentificationTags.jsx:92-104`,
  `ui/src/styles.css:8611`).
- **Which profile.** `resolveAssistantProfileState({ assistantPubkey, allowRelayFallback, deps })`
  (`src/api/assistant/profileState.js:130-200`): the local relay first, then the publish relays,
  copying a relay-only profile home. It takes an injectable `scanLocalKind0`. The default one
  (`realScanLocalKind0`, `:38-56`) resolves `null` on a failed scan, so a broken local relay reads as
  "no profile". `/api/assistant/status` calls it with `getPublishRelays: getAssistantPublishRelays`
  (`index.js:418-422`).
- **The instance.** `describeInstance()` (`src/api/assistant/profileDefaults.js:91-100`) gives
  `{ domain, isPublic, website, avatarUrl }`: `website` is `https://<domain>` on a public instance
  and `''` otherwise; `avatarUrl` is `https://<domain>/ta-avatar.png` there, else
  `REFERENCE_TA_AVATAR_URL` (`:30`). On staging, `domain` is `staging.brainstorm.world`.
- **What a publish writes.** `finalizeAssistantProfile` (`profileDefaults.js:226-234`): on a public
  instance the content gets `nip05: <localPart>@<domain>` and the event the tag `["client", <domain>]`.
  The publish handler then writes `nip05.names[localPart] = assistantPubkey` to settings
  (`index.js:290-302`), which `/.well-known/nostr.json` serves (`src/api/nip05.js:87-115`, no CDN in
  front on staging: `Server: nginx`, `Cache-Control: public, max-age=300` from Express; a server-side
  fetch does not cache).
- **The NIP-05 lookup, shipped.** `lookupNip05(address)` (`src/api/nip05.js:135-155`) fetches
  `https://<domain>/.well-known/nostr.json?name=<name>` through `guardedFetch` with a 5 s timeout and
  answers `malformed | unreachable | answered` plus the listed pubkey. `/api/nip05/verify` already
  uses it against this instance's own domain (my-assistants #4).
- **The composite's address.** `storeCompositeAvatar` (`src/api/assistant/avatar.js:87-118`) writes
  `ta-avatar-<8 hex>.png` into `/var/lib/brainstorm/generated` (or a home-directory fallback) and
  returns `https://<domain>/generated/<file>` only on a public instance. `bin/control-panel.js:161`
  serves `/generated` from that directory. `defaultGeneratedDir()` is not exported.
- **The publish relays.** `getConfiguredPublishRelays()` (`profilePublish.js:56-58`): the
  general-purpose, profile and WoT lists. `getAssistantPublishRelays()` returns `[]` in local-only
  mode (`:95-100`). Neither drops this instance's own relay; `outsideOnly(urls, deps)`
  (`src/api/setup/status.js:214-236`) does. On staging today: damus, primal, nos.lol, purplepag.es,
  profiles.nostr1.com, wot.grapevine.network (six), and `allowExternalPublish: true`.
- **The strict relay read.** `readRelayEvents(url, filter)` (`src/api/_shared/relaySource.js`)
  answers `status: 'ok'` only from a relay that sent EOSE, with signatures verified. `attention.js`
  wraps it in `readWithinBudget` (`:75-89`) against setup's 8 s.
- **Shared CommonJS libraries reach the UI** through Vite aliases (`ui/vite.config.js:18-45`), as
  `@tapestry/identification-tags` does.
- **Tests that pin today's answer** (grep for `CHECKED_ACTIONS`, `alertCount`, `actions need
  attention`): `test/assistant-attention.test.js` C2 (`:590-595`, `CHECKED_ACTIONS` is exactly
  `['identification-tags']`) and its handler and two-readings tests; `test/assistant-alert.test.js`,
  `test/assistant-management-page.test.js` (D7 counts), `test/helpers/assistantManagementFixtures.js`,
  `test/helpers/identificationTagsFixtures.js`; and the Playwright specs
  `tests/brainstorm/assistant-attention.spec.js`, `assistant-alert.spec.js`,
  `assistant-management-page.spec.js`, which mock `/api/assistant/attention` with only
  `identification-tags`. Under this design a mocked answer without a `profile` key leaves the profile
  card marked (page reading) and **no longer counted in the pill** (it stops being a placeholder), so
  the pill's expected counts drop by one where the mock has no `profile`. Re-aiming them is the
  Tester's lane.

### Constraints

- **Principle 1 (POV).** The viewer's own Assistant, from the session only.
- **Principle 3.** No stored answer, no memo, no polling: re-derived per request. A memo is the first
  lever if latency is measured to be a problem (§ Consequences).
- **Principle 4.** Read-only, except the copy-home of a relay-only profile that
  `resolveAssistantProfileState` already does (story AC-7 accepts it).
- **The TA pubkey and the domain are resolved at runtime.** No deployment name in code.
- **House stack:** JS without build; `actions.js` stays loadable in Node with its one import.

## Options considered

### Option A — A `profile` key in the existing attention answer, computed by a new server module (chosen)

`checkProfile({ assistantPubkey }, deps)` in a new `src/api/assistant/profileChecklist.js`, called by
`handleAssistantAttention` in parallel with `checkIdentificationTags`. The answer's `actions.profile`
carries the action's three flags and one row per item. The UI adds `'profile'` to `CHECKED_ACTIONS`
and reads the same answer.

**Pros**
- One request per page load, as ADR assistant-identification-tags/0001 chose for exactly this growth
  ("the next action adds a key to the map and its check to the module").
- The two readings, the provider and the pill work unchanged.
- Every rule needs the server: the strict relay reads, the file on the volume, the settings, the
  instance's own NIP-05 lookup through the SSRF guard.

**Cons**
- The answer now waits for up to six profile-relay reads and one HTTPS round trip to the instance's
  own domain, on every full page load for a viewer with an Assistant. The pill waits too: `'checking'`
  draws no pill (ADR assistant-identification-tags/0001 sub-decision 8). Bounded at 4 s for the relays
  and 5 s for the NIP-05 (sub-decision 5).

### Option B — A separate `GET /api/assistant/profile-checklist`, which the hub and the pill also fetch

**Pros:** the identification-tags answer is never slowed by the profile's network reads.
**Cons:** two requests on every page, two answers the pill must combine. That is ADR
assistant-identification-tags/0001's rejected Option B. Rejected for the same reason; the latency
concern is answered by budgets, and a memo if measured.

### Option C — Compute it in the browser from `/api/assistant/status` and `/api/nip05/verify`

**Pros:** no change to the attention answer.
**Cons:** "visible to other apps" needs strict per-relay reads the browser cannot report as finished.
The avatar needs the volume. The hub and the pill would need three to eight requests per page.
Rejected, as setup-status-and-alert/0001 rejected its browser option.

## Decision

We chose **Option A**: the one answer gains a key, as it was designed to.

### Sub-decisions

**1. The item list is a shared CommonJS library, `src/lib/assistant-profile-items/`.**

- It is pure and dependency-free, loaded by the server and (through a Vite alias
  `@tapestry/assistant-profile-items`) by the UI, as `src/lib/identification-tags` is. Story 2's page
  draws its panels from it before any answer arrives (its signed-out state).
- It exports `PROFILE_ITEMS`, in order, each `{ key, counts }`:
  `avatar` (counts), `banner` (does not), `nip05`, `website`, `name-and-about`, `client-tag`,
  `visible` (all count).
- It exports `PROFILE_CONTENT_FIELDS`, the seven kind-0 fields the one writer keeps
  (`name, display_name, about, picture, banner, website, lud16`). This ADR leaves that unused; story 2
  uses it.
- It exports `COMPOSITE_AVATAR_FILE_RE = /^ta-avatar-[0-9a-f]{8,64}\.png$/`, the stored composite's
  file name. It accepts today's 8-hex names and the longer names ADR 0003 introduces.

**2. Which profile: `resolveAssistantProfileState`, with a strict local scan.**

- `checkProfile` calls it with `allowRelayFallback: true` (the session is the Assistant's own person,
  whom ADR assistant-profile/0001 already allows) and `getPublishRelays: getAssistantPublishRelays`,
  as `/api/assistant/status` does.
- It injects `deps.scanLocalKind0` as `scanLocalStrict({ kinds: [0], authors: [pk] })` reduced to its
  newest event (`src/api/setup/status.js:57`). A failed scan then rejects instead of reading as "no
  profile". The rejection makes every counted item unfinished with reason `profile-unreadable`.
- "No profile" stays the existing rule's answer. A local miss with the publish relays unreachable is
  "no profile", finished, as every setup surface reads it today (ADR assistant-profile/0001: "the local
  answer stands"). This ADR does not change that rule.

**3. One pure evaluator, one row per item.**

`evaluateProfileItems({ event, instance, assistantPubkey, avatarStored, nip05, visibility })` is pure
and returns the rows in `PROFILE_ITEMS` order. Each row is
`{ key, counts, finished, done, reason }` plus the item's detail fields (Implementation notes 2).
`reason` is `null` when done. The rules, in order of precedence:

| Item | Not checked / no profile / no public address | Done when | Otherwise (reason) |
|---|---|---|---|
| avatar | `no-profile` · `no-public-address` | the picture parses as a URL whose origin is `instance.website`'s, whose path is `/generated/<file>` with `<file>` matching `COMPOSITE_AVATAR_FILE_RE`, with no query or hash, and `avatarStored` is true | empty → `no-picture`; equal to `instance.avatarUrl` or `REFERENCE_TA_AVATAR_URL` → `standard-image`; the composite shape but no file → `missing-file`; else `not-personalized` |
| banner | always `{ counts: false, finished: false, done: false, reason: 'not-checked' }` | — | — |
| nip05 | `no-profile` · `no-public-address` | `nip05` is `<name>@<host>`, `<host>` equals `instance.domain` (letter case aside), and the lookup answered with the Assistant's pubkey | empty → `none`; another host, or not an identifier → `other-domain` (no fetch); answered otherwise → `not-listed`; unreachable → **unfinished**, `unreachable` |
| website | `no-profile` · `no-public-address` | `new URL(website)` has protocol `https:`, a hostname equal to `instance.website`'s, no port, user, query or hash, and path `/` | empty → `none`; else `other` |
| name-and-about | `no-profile` | a non-empty trimmed string in `name` or `display_name`, and in `about` | `no-name`, `no-about`, `no-name-no-about` |
| client-tag | `no-profile` · `no-public-address` | the event has a tag `["client", v]` with `v` equal to `instance.domain` (letter case aside) | `none` |
| visible | `no-profile` | at least one outside publish relay answered with a kind 0 by the Assistant whose `created_at` is at or after the profile's | local-only mode → `local-only-mode`; no outside relay configured → `no-relays`; answered, none holds it → `only-here`; none answered → **unfinished**, `unreachable` |

- Every row not marked unfinished above is `finished: true`. `no-profile` and `no-public-address` are
  finished, needs-attention answers (story AC-4, settled at approval).
- `profile-unreadable` (sub-decision 2) overrides every counted row: `finished: false`.

**4. The action's flags, from its counted rows only.** `finished` = every counted row finished;
`done` = finished and every counted row done; `pending` = at least one counted row finished and not
done. The banner never takes part. Invariants the suites pin: `done ⇒ finished`, `done ⇒ !pending`.

**5. The network reads, and their budgets.**

- **NIP-05:** `lookupNip05(nip05)` from `src/api/nip05.js`, only when the host is this instance's.
  This is the lookup any nostr client makes, through the SSRF guard, with its own 5 s timeout.
- **Visible:** the relays are `outsideOnly(getConfiguredPublishRelays(), deps)`, unless
  `isPublishLocalOnly()` is true (then no read, `local-only-mode`). Each relay is read once with
  `{ kinds: [0], authors: [assistantPubkey] }` through `readRelayEvents`, all at once, each raced
  against `PROFILE_RELAY_BUDGET_MS = 4000` (`profileState.js`'s `RELAY_BUDGET_MS`, the budget every
  profile surface uses). The row reports `relaysTotal` (configured outside relays), `relaysAnswered`
  and `relaysHolding`.
- **Avatar:** `hasStoredAvatar(file)` is a new export of `src/api/assistant/avatar.js`: does the
  generated directory (`defaultGeneratedDir()`) hold that file? The name is checked against
  `COMPOSITE_AVATAR_FILE_RE` first, so no request-derived path reaches the file system. Only the
  Assistant's own published picture is ever looked up.
- The NIP-05 lookup and the relay reads run in parallel after the profile is read. The
  identification-tags check runs in parallel with all of it.

**6. A profile check that throws does not take the other answer with it.** `handleAssistantAttention`
awaits both checks with `Promise.allSettled`. A rejected profile check becomes
`{ finished: false, done: false, pending: false, reason: 'check-failed', items: [] }` and is logged.
A rejected identification-tags check keeps today's behavior (500), so nothing about that action changes.

**7. The hub's Done badge, and the two readings.**

- `CHECKED_ACTIONS = ['profile', 'identification-tags']`, in `ASSISTANT_ACTIONS` order.
- `assistantAttention(user, attention)` gains a fourth field, `done: string[]`: the checked actions
  whose answer says `done === true`, for a viewer with an Assistant (`[]` otherwise). `needsAttention`,
  `count` and `alertCount` keep their rules. A placeholder is never in `done`.
- `ActionCard` takes `done` beside `marked`. When done, the card gains class `is-done`, the marker
  shows ✓, the badge is `bs-setup-step-badge is-done` with **Done**, and the link starts with the
  screen-reader prefix **Done: **. These are the Identification Tags page's marks, so the
  Identification Tags card shows them too.
- `ASSISTANT_COPY` gains `done: 'Done'` and `doneSrPrefix: 'Done: '`. `IDENTIFICATION_TAGS_COPY`
  keeps its own two, unchanged.
- One CSS rule pair: `.bs-assistant-hub-card.is-done .bs-assistant-hub-card-marker`, styled as
  `.bs-idtags-card.is-done`'s marker is.

**8. The answer carries what story 2's words need, and no pubkey.** The action carries `instance:
{ domain, website, isPublic }` and `hasProfile`. Rows carry their detail fields (`address`, `value`,
`relaysTotal`, …). As in the identification-tags answer, no viewer or Assistant pubkey is included.
Story 2's page has both from sign-in.

**What we trade away**
- On a page load, the attention answer waits for the profile's network reads, up to about 5 s in the
  worst case. Identification Tags and the pill wait with it.
- The NIP-05 item makes this instance fetch its own public address once per page load for a viewer
  with an Assistant.
- "No profile" when the publish relays are unreachable stays a finished answer (the existing rule),
  not an unfinished one.

## Consequences

- **Enables:** story 2 draws seven panels from `PROFILE_ITEMS` and their states from
  `actions.profile.items`, and calls `refresh()` after a fix. Story 3's avatar fix turns the avatar
  row done. The hub can say **Done** for any checked action.
- **The pill moves by one.** The profile stops being a placeholder. For a viewer whose profile check
  finishes with something missing, nothing changes: it still counts. For one whose profile is done,
  or whose check did not finish, the pill drops by one. That is story AC-6's confident reading.
- **Latency and load:** each full page load for a signed-in viewer with an Assistant makes up to six
  relay reads (4 s cap) and one HTTPS fetch to the instance's own domain (5 s cap). The answer
  usually arrives in about 1 s, because a responsive relay answers in a few hundred milliseconds. No
  memo (principle 3). If measured latency hurts the pill, the first lever is a short per-Assistant
  memo of the two network parts, with the same five-minute shape as `profileState.js`'s
  `NEGATIVE_MEMO_MS`. A follow-up ADR would record it.
- **The Edit Assistant Profile page does not refresh the answer.** A publish there shows on the hub
  after the next full page load (story 2 § Out of scope keeps the editor unchanged). A one-line
  `refresh()` there is a candidate ledger row for the close.
- **Debt noticed, not fixed:** the kind-0 field list now has three copies: `PROFILE_FIELDS` in
  `src/api/assistant/index.js:44`, the editor's labelled list, and `PROFILE_CONTENT_FIELDS`. The
  server could import the library's copy later. The strict local-then-outside lookup gains no new
  copy here: the visibility read is outside-only by design.
- **Firmware reinstall required?** No.

## Implementation notes

### 1. Shared library: `src/lib/assistant-profile-items/index.js` (new, CommonJS, no imports)

```js
const PROFILE_ITEMS = [
  { key: 'avatar', counts: true },
  { key: 'banner', counts: false },
  { key: 'nip05', counts: true },
  { key: 'website', counts: true },
  { key: 'name-and-about', counts: true },
  { key: 'client-tag', counts: true },
  { key: 'visible', counts: true },
];
const COUNTED_PROFILE_ITEM_KEYS = PROFILE_ITEMS.filter((i) => i.counts).map((i) => i.key);
const PROFILE_CONTENT_FIELDS = ['name', 'display_name', 'about', 'picture', 'banner', 'website', 'lud16'];
const COMPOSITE_AVATAR_FILE_RE = /^ta-avatar-[0-9a-f]{8,64}\.png$/;
module.exports = { PROFILE_ITEMS, COUNTED_PROFILE_ITEM_KEYS, PROFILE_CONTENT_FIELDS, COMPOSITE_AVATAR_FILE_RE };
```

- `ui/vite.config.js`: alias `'@tapestry/assistant-profile-items'` → `src/lib/assistant-profile-items`,
  and `/src\/lib\/assistant-profile-items/` in `build.commonjsOptions.include`, beside the
  identification-tags entries. Story 2 is the first UI importer; this story adds the alias so story 2
  touches no build config.

### 2. Server: `src/api/assistant/profileChecklist.js` (new, CommonJS, dependency-injected)

The `attention.js` idiom: `defaultDeps()` with lazy requires, so the module loads in a bare checkout.

**Exports:** `checkProfile({ assistantPubkey }, deps)`, `evaluateProfileItems(input)` (pure),
`readVisibility({ assistantPubkey, profileCreatedAt }, deps)`, `PROFILE_RELAY_BUDGET_MS`.

**Default dependencies:** `resolveAssistantProfileState` (`./profileState`);
`scanLocalStrict`, `outsideOnly` (`../setup/status`); `describeInstance`, `REFERENCE_TA_AVATAR_URL`
(`./profileDefaults`); `lookupNip05` (`../nip05`); `readRelay: readRelayEvents`
(`../_shared/relaySource`); `getConfiguredPublishRelays` (`./profilePublish`); `isLocalOnly:
isPublishLocalOnly` (`../publish-policy`); `hasStoredAvatar` (`./avatar`); `getConfigFromFile`
(`../../utils/config`, for `outsideOnly`).

**`checkProfile`:**
1. `instance = deps.describeInstance()`.
2. `state = await deps.resolveAssistantProfileState({ assistantPubkey, allowRelayFallback: true,
   getPublishRelays: <getAssistantPublishRelays>, deps: { scanLocalKind0: strictNewestKind0 } })`.
   A rejection → `evaluateProfileItems({ unreadable: true, instance })`.
3. With an event: parse its content (a bad JSON is an empty object). In parallel:
   - `nip05 = <host is instance.domain> ? await deps.lookupNip05(content.nip05) : null`;
   - `visibility = await readVisibility({ assistantPubkey, profileCreatedAt: event.created_at }, deps)`;
   - `avatarStored = <picture's file matches> ? deps.hasStoredAvatar(file) : false`.
4. `return evaluateProfileItems({ event, content, instance, assistantPubkey, nip05, visibility, avatarStored })`.

**`readVisibility`** → `{ mode: 'local-only-mode' | 'no-relays' | 'read', total, answered, holding }`.
For each relay, `holding` counts an `ok` answer with an event whose `kind === 0`, whose `pubkey`
matches (case-blind) and whose `created_at >= profileCreatedAt`. A throw or a lost race counts as not
answered; every timer is cleared.

**`evaluateProfileItems`** returns
`{ finished, done, pending, hasProfile, instance: { domain, website, isPublic }, items }`. The row
detail fields:
- avatar: `picture` (the published value, or `null`);
- nip05: `address` (the published value, or `null`);
- website: `value` (the published value, or `null`), `expected` (`instance.website`);
- name-and-about: `hasName`, `hasAbout`;
- client-tag: `expected` (`instance.domain`);
- visible: `relaysTotal`, `relaysAnswered`, `relaysHolding`.

### 3. Server: `src/api/assistant/attention.js` (edit)

- `defaultDeps()` gains `checkProfile: (input, d) => require('./profileChecklist').checkProfile(input, d)`.
  Tests inject `checkProfile` to keep the identification-tags suites independent of the network.
- The assistant branch: `Promise.allSettled([checkIdentificationTags(...), d.checkProfile({ assistantPubkey }, d)])`.
  An identification-tags rejection is rethrown (today's 500). A profile rejection becomes the
  `check-failed` action of sub-decision 6.
- `actions: { 'identification-tags': …, profile: … }`. Export a `PROFILE = 'profile'` constant beside
  `IDENTIFICATION_TAGS`.
- The header comment's "Today one action is checked" paragraph gains the profile.

### 4. Server: `src/api/assistant/avatar.js` (edit)

- New export `hasStoredAvatar(file, opts = {})`: `COMPOSITE_AVATAR_FILE_RE.test(file) &&
  fs.existsSync(path.join(opts.baseDir || defaultGeneratedDir(), file))`. It is pure apart from the
  `existsSync`, and `opts.baseDir` exists for tests, as `storeCompositeAvatar`'s does.

### 5. UI

- `ui/src/pages/assistant/actions.js`: `CHECKED_ACTIONS = ['profile', 'identification-tags']`;
  `assistantAttention` returns `done` too (sub-decision 7); `ASSISTANT_COPY.done`,
  `ASSISTANT_COPY.doneSrPrefix`. The file keeps its one import.
- `ui/src/pages/assistant/Index.jsx`: `const { hasAssistant, needsAttention, done, count } = …`;
  `ActionCard` gets `done={signedIn && done.includes(action.key)}` and draws the done marks. A card is
  never both: `marked` wins, which cannot happen because `done` implies not in `needsAttention`.
- `ui/src/styles.css`: the `.bs-assistant-hub-card.is-done .bs-assistant-hub-card-marker` rule.
- The placeholder page at `/assistant/profile` is unchanged in this story.

### 6. Documents

- `src/api/openapi.yaml` (`:291`, `/api/assistant/attention`): the `profile` action's shape.
- BIBLE §11's `/api/assistant/attention` row (`BIBLE.md:527`): "Today it checks `identification-tags`
  …" gains "and `profile`: seven items of the assistant's published profile (assistant-profile-checklist
  ADR 0001)". Bump the "Last updated" line.

### 7. For the Tester (Phase 3, not implementation)

The pins listed under § Codebase facts must be re-aimed: C2's `CHECKED_ACTIONS`, the pill counts in
the unit and Playwright suites whose mocked answer has no `profile` key, and any fixture that builds an
answer. A Playwright mock that wants the profile card unmarked must include `actions.profile` with
`done: true`.

## Out of scope

- The page and every fix (ADR 0002), and the avatar for every role (ADR 0003).
- Computing the background image's state.
- Changing ADR assistant-profile/0001's "no profile" rule for unreachable publish relays.
- A memo, polling, or a server-sent refresh.
