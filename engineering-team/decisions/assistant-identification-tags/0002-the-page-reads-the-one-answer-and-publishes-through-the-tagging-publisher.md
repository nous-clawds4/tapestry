# ADR 0002: The Identification Tags page reads the one answer, and publishes your two taggings through the existing tagging publisher with a per-tagging, per-relay report

**Status:** Proposed
**Date:** 2026-09-22
**Story:** `engineering-team/stories/assistant-identification-tags/2-the-page-and-your-two-taggings.md`

## Context

Story 2 replaces the placeholder at `/assistant/identification-tags` with the real page and wires the first
card's publish. In short:

- **AC-1.** The page: back link, the owner's heading and description, the Treasure Map sentence, two cards in
  order — "Taggings you put on your Assistant" (My Tapestry Assistant, My Agent) and "Taggings your Assistant
  puts on you" (My Tapestry Owner, My Human) — each tagging a row. Signed out: rows without state, a sign-in
  line and button. No Assistant here: rows without state, the hub's line and link. Sign-in resolving: neither.
- **AC-2.** Each row's state from story 1's answer: Present, Missing, Tag not found, Checking…, or a
  could-not-check sentence with the reason. A card is marked Needs attention while any row is Missing, Tag
  not found or not finished, and carries Done when both rows are Present. Its mark agrees with the hub's card
  once the check has finished.
- **AC-3.** A checkbox per Missing row, checked by default; none on a Present row; disabled and unchecked on a
  Tag not found row; the card's button disabled while nothing is checked; unchecking stores nothing.
- **AC-4.** The first card's publish: one tagging per checked row, signed with the viewer's extension in turn,
  as an ordinary tagging of the canonical tag on the viewer's own Assistant, published to this instance's relay
  and the outside relays every tagging goes to today; per tagging, the summary and each relay's answer in the
  story's words; a missing, refusing or failing extension is said per tagging and publishes nothing for it;
  taggings already published in the same press keep their results; afterwards the rows re-check and the
  hub's answer refreshes without a reload.
- **AC-5.** The second card shows its rows, states and checkboxes exactly as the first; its button is story 3's.
- **AC-6.** Direct loads and a refresh render the page; no sideways scroll at 375 px; the hub's card still leads
  here; the other nine placeholder pages are unchanged.
- **AC-7.** No request beyond story 1's answer and the top bar's; nothing signed, published or stored until a
  publish button is pressed.

**Settled before this ADR** (Discovery 2026-09-22; story approval 2026-09-22): two cards by signer; a
checkbox per tagging, checked by default, opt-out not stored; the buttons name the signer ("Publish with your
nostr extension"; story 3's "Have your Assistant publish"); the Treasure Map sentence in the owner's final
words; the canonical author is the owner's key (`CANONICAL_TAG_AUTHOR`, story 1).

### Concept-graph orientation

As ADR 0001's (2026-09-22, local stack): `tag`, `nostr-user-tag` and `nostr-user` are present with class-thread
wiring only. This story reads and changes no concept. **No firmware reinstall.**

### Codebase facts this design rests on (verified on `bab6a215`)

- **The route.** `ui/src/App.jsx:264` maps every `ASSISTANT_ACTIONS` entry to `<AssistantActionPage action={…}>`.
  The action's `path` in `ui/src/pages/assistant/actions.js` is the one source of the address (the hub's card
  links to it); `actions.js` holds data only and must stay loadable in Node with its one import (story 1 D4).
- **The one answer (story 1).** `useAssistantAttention()` (`ui/src/context/AssistantAttentionContext.jsx`)
  returns `{ phase: idle|checking|answered|failed, refresh, answered, hasAssistant, actions }`;
  `actions['identification-tags']` is `{ finished, done, pending, taggings[] }`, each row
  `{ key, name, slug, signer, target, present, finished, source, reason?, definition: { finished, found, source,
  reason?, eventId, address } }`. The provider fetches only for a signed-in viewer with an assistant, and
  re-checks on `onEventPublished` for a kind 39999 by the viewer or their assistant whose `d` starts with
  `profile-tag-`, so a tagging published through the browser chokepoint refreshes the hub, the pill and this
  page on its own.
- **The static list.** `REQUIRED_TAGGINGS` and `CANONICAL_TAG_AUTHOR` in `src/lib/identification-tags`, reachable
  from the UI as `@tapestry/identification-tags` (the alias and CommonJS include landed with story 1; this page
  is the first importer, which ADR 0001 § Implementation notes 1 anticipated).
- **The tagging publisher.** `publishProfileTagAssertion({ tag: { eventId, slug, authorPubkey }, targetPubkey,
  polarity, localTaPubkey })` (`ui/src/utils/publishProfileTag.js:47-93`): refuses without `window.nostr`;
  checks the extension's active account against the session (`getActiveSignerOrThrow`, issue #335); builds the
  deployed shape (d, p, a, e, the ADR 0015 z and the runtime local z, polarity); signs; then
  `publishOrThrow(signed)`, which calls `publishEverywhere` and throws only when the local write and every
  outside relay failed; returns the signed event. Its header names it "the single source of truth for the
  nostr-user-tag wire shape". Its two callers ignore the return value (`useProfileTags.js:77`,
  `Tag.jsx:109,115`); `publishOrThrow` has nine other callers.
- **The per-relay answers already exist in the browser.** `publishToRelays` (`ui/src/utils/nostrPublish.js:166`)
  returns `{ successes, failures, details: { [relay]: { status: accepted|refused|unreachable|timeout, reason } },
  skippedByGate? }` (ADR honest-publish-reporting/0001), and `publishEverywhere` (`:222`) returns
  `{ local: { success, error? }, external }`. No UI renders `details` yet; the profile editor renders the
  *server's* rows with the words accepted, rejected, unreachable, timed out, skipped and a tone rule that never
  shows a partial result as a clean success (`ui/src/components/AssistantProfileEditor.jsx:27-46`).
- **The browser publish is parallel, not local-first.** `publishEverywhere` starts the local write and the
  outside sends together (`nostrPublish.js:226-227`). A failed local write does not stop the outside sends. The
  server's profile publish is local-first (ADR assistant-profile/0002); the story's copy line for a failed local
  write ("so it was not sent to any other relay") describes that server path, not this one.
- **Local-only publish mode** (`BRAINSTORM_PUBLISH_LOCAL_ONLY=true`, on this dev stack): `publishToRelays`
  returns `skippedByGate: true` with no `details`, and opens no socket.
- **Where the outside relays come from.** `PUBLISH_RELAYS`, five literals in `nostrPublish.js:44-50`, the
  default for every tagging today. Out of scope to change (story § Out of scope).
- **The viewer and the instance.** `useAuth()` gives `user.pubkey`, `user.assistantPubkey`, `loading`, `login()`;
  `useConfig().taPubkey` (`ui/src/context/ConfigContext.jsx:10-27`) is the runtime instance TA for the local z.
- **Styles.** The hub and `/setup` share `.bs-setup-main`, `.bs-setup-back`, `.bs-setup-title`, `.bs-setup-signin`,
  `.bs-setup-step-badge` (+ `is-done`), the hub's `.bs-assistant-hub-*`, and a `@media (max-width: 480px)`
  block each (`ui/src/styles.css:8475-8660, 8750-8870`). `.bs-setup-step` carries link hover rules.
- **Browser specs stub the signer** with `page.addInitScript(() => { window.nostr = { getPublicKey, signEvent } })`
  (`tests/brainstorm/login-failure-and-tag-collapse.spec.js:61-65`) and mock `/api/publish-policy`; with
  `allowExternalPublish: false` the browser opens no relay socket.
- **Tests that pin today's placeholder** (grep for `identification-tags`, `Placeholder page`, the twelve
  addresses): `tests/brainstorm/assistant-management-page.spec.js` B8 renders each of the ten placeholder pages,
  the identification-tags one included; B11 loads the twelve addresses directly; B12 measures 375 px on "a
  placeholder". `test/assistant-management-page.test.js` W1 checks `App.jsx`'s imports and the `ASSISTANT_ACTIONS`
  route mapping by source; D-class checks the ten entries. The identification-tags cases of B8 (and B12 if it
  picks this address) are the re-aims.

### Constraints

- **Principle 1.** The page is about the viewer's own Assistant: the first card tags `user.assistantPubkey`,
  the answer is the session's. Nothing here can name another person or another assistant.
- **Principle 2.** The page gates nothing at read time (story 1's answer already counts any author's
  same-named tag). It applies the canonical tag when it publishes (Discovery decision 5).
- **Principle 3.** Nothing derived is stored: the checkboxes are component state, reset whenever the answer
  changes; the results live until the next press or navigation.
- **Read-only until a press;** then the browser chokepoint publishes, as every tagging does today.
- **The wire shape has one home.** The page never builds a tagging itself.
- **House stack:** JS without build; pure modules in ESM with `.js` imports so Node suites load them; no
  component harness for `ui/`.
- **No protocol change.** Four ordinary `nostr-user-tag` assertions.

## Options considered

### Option A — A dedicated page reading the shared answer, a pure copy-and-state module, a report-returning variant of the existing publisher, and a pure report util (chosen)

- `ui/src/pages/assistant/IdentificationTags.jsx` renders the two cards from `REQUIRED_TAGGINGS` and the
  answer's rows; `App.jsx` routes this one action to it and the other nine to the placeholder.
- The words and the row and card rules live in a pure ESM module the suites load.
- `publishProfileTag.js` gains `publishProfileTagAssertionWithReport`, the same build and sign that also
  returns `publishEverywhere`'s result; the existing function becomes a wrapper with its old contract.
- A pure util turns that result into the summary and the per-relay lines in the story's words; story 3 feeds
  the server's rows through the same util.

**Pros:** one source of the wire shape (the publisher), one source of the answer (story 1), the report
derived from the settled results the chokepoint already keeps; every rule testable in Node; the other nine
pages untouched; story 3 adds a button and a call.
**Cons:** the page is the first browser-side per-relay renderer, so its markup is page-local until a second
page needs it; three lines of the broadcast-outcome rule are repeated in the util (the CommonJS
`classifyBroadcast` is reachable from the UI only through the Vite alias, which Node cannot resolve).

### Option B — Generalize the placeholder page with a card schema in `actions.js`

Give each action entry a `cards` description and let `ActionPage.jsx` render cards, states and buttons
generically.

**Rejected.** `actions.js` is data with no JSX and must stay Node-loadable; the cards need hooks, signers and
publish flows that differ per action (story 3's is a server call); one page is not a pattern yet. The other
nine pages will each get their own story, as the book's frame says.

### Option C — Build and publish the tagging in the page itself

Compose the kind 39999 in the page and call `/api/strfry/publish` and `publishToRelays` directly.

**Rejected.** A second copy of the wire shape, the very thing `publishProfileTag.js`'s header exists to
prevent; the signer drift guard would be re-implemented; the announcement that refreshes the hub would have to
be re-wired.

## Decision

We chose **Option A.** The page is a reader of story 1's answer and a caller of the publisher that every
tagging already goes through; what is new is the report, derived from results the chokepoint already
returns, and the words.

### Sub-decisions

**1. A dedicated page, routed by an override map.** `App.jsx` gains
`const ACTION_PAGES = { 'identification-tags': <IdentificationTagsPage /> };` and the route list becomes
`...ASSISTANT_ACTIONS.map((action) => ({ path: action.path, element: ACTION_PAGES[action.key] ?? <AssistantActionPage action={action} /> }))`.
The address stays in `actions.js`; the hub's card is unchanged.

**2. The words and the rules are a pure ESM module, `ui/src/pages/assistant/identificationTags.js`,** with
no imports, so Node loads it: `IDENTIFICATION_TAGS_COPY`, `rowState(entry, answerRow, phase)`,
`cardState(rowStates)`. The page takes the owner's description from the action's entry in `ASSISTANT_ACTIONS`
(no second copy) and the hub's shared words from `ASSISTANT_COPY`.

- `rowState` answers `{ state, reason, definitionKnown }`:
  - `phase` `idle` → `unknown` (no state shown: signed out, or no assistant); `checking` → `checking`;
    `failed` → `could-not-check`, reason `request-failed`;
  - `answered`: `definition.finished && definition.found === false` → `tag-not-found` (whatever the check
    found, AC-2); else `finished && present` → `present`; `finished && !present` → `missing`; `!finished` →
    `could-not-check` with the tagging's `reason`;
  - `definitionKnown = definition.found === true` (there is an `eventId` to point at).
- `cardState` answers `done` (every row present), `marked` (any row missing, tag-not-found, could-not-check or
  checking: the page reading, marked until proven), or `unknown` (rows unknown: no mark, no badge).
- **The checkbox** exists on a `missing` row only (AC-3), checked by default, enabled when
  `definitionKnown`; a `tag-not-found` row shows a disabled, unchecked one; `present`, `checking`,
  `could-not-check` and `unknown` rows show none. A `missing` row whose definition is unknown (its definition
  check did not finish) shows its checkbox disabled with the definition-unknown sentence.

**3. The publisher gains a report-returning variant.** In `ui/src/utils/publishProfileTag.js`:
- `publishProfileTagAssertionWithReport(args)`: the same guards, build and sign as today, then
  `const result = await publishEverywhere(signed, relays)` (`relays` optional, defaulting inside
  `publishEverywhere` to `PUBLISH_RELAYS`), returning `{ signed, result }` and never throwing on delivery.
- `assertPublished(result)`: `publishOrThrow`'s throw rule, extracted (throws when the local write and every
  outside relay failed).
- `publishProfileTagAssertion(args)` becomes `const { signed, result } = await …WithReport(args);
  assertPublished(result); return signed;` — the contract its callers have.
- `publishOrThrow(signed)` keeps its signature (nine callers) and calls `assertPublished`.
- The header comment names the new entry point and this ADR.

**4. A pure report util, `ui/src/utils/taggingPublishReport.js`** (ESM, no imports):
`describeTaggingPublish({ name, local, external, relays })` → `{ ok, outcome, message, rows }`.
- `rows`: one per relay in `relays` order, `{ relay, status, reason }` from `external.details`; with
  `skippedByGate`, every relay `skipped` with reason `local-only publish mode`; a relay missing from
  `details` is `unreachable` with reason `no publish result` (the chokepoint's own fail-toward-honesty rule).
- `outcome`: `kept-local` when `skippedByGate`; `published` when at least one row is `accepted`; else
  `not-delivered`.
- `ok`: the local write succeeded, or at least one relay accepted.
- `message`: sub-decision 5's words, with the tagging's name in quotes as the subject.
- Story 3 will add `describeServerPublish({ name, data })` here for the server's rows, so both cards speak
  the same words.

**5. The words for a failed local write say what the browser publish does.** Because the outside sends run
in parallel, the story's line "so it was not sent to any other relay" cannot be true here. The util says:
- local failed, some accepted: `"{name}" could not be saved on this instance's relay ({reason}), but {a} of
  {n} relays accepted it.`
- local failed, none: `"{name}" could not be saved on this instance's relay ({reason}), and none of the {n}
  relays accepted it.`
- local failed, kept local: `"{name}" could not be saved on this instance's relay ({reason}), and local-only
  publish mode kept it from any other relay.`

The story's other lines stand (published; partly; none; kept local). This amends story 2 § Copy's "Local
write failed" row; the Implementer records it in the story's § Deviations, and the Tester's fixture carries
the amended lines.

**6. The first card's publish flow** (`IdentificationTags.jsx`):
1. Pre-flight: no `window.nostr` → the card shows the no-extension line; nothing is signed.
2. For each checked, publishable row, in card order: `publishProfileTagAssertionWithReport({ tag: { eventId:
   definition.eventId, slug, authorPubkey: CANONICAL_TAG_AUTHOR }, targetPubkey: user.assistantPubkey,
   polarity: 1, localTaPubkey: taPubkey })`, then `describeTaggingPublish({ name, ...result, relays: PUBLISH_RELAYS })`.
   A throw before publishing (the extension declined, `SignerMismatchError`, a build refusal) becomes that
   row's signature-refused line with the error's message; the loop continues with the next row (AC-4).
3. The button reads "Publishing…" and is disabled during the loop, with the checkboxes; the results render
   under the card in an `aria-live="polite"` region, one block per tagging: the summary, then one line per
   relay in the editor's words and tone rule (never a clean success for a partial or empty result).
4. After the loop, `refresh()` once. The chokepoint's announcement has already re-checked after each local
   write; the explicit refresh covers a press whose local writes all failed but a relay accepted.
5. Checkbox state is keyed by row key and reset when the answer changes, so a fresh answer checks every
   missing row again (AC-3).

**7. Markup and classes.** Under the hub's `bs-setup-main`: the back link, the heading, the description (as
`ActionText`), the Treasure Map sentence, then the cards. Each card is a `<section class="bs-idtags-card
[is-marked|is-done]" aria-labelledby>`: a marker (the hub's `!` when marked, `/setup`'s `✓` when done), a
head (the title, a screen-reader prefix "Needs attention: " or "Done: ", and the badge — `.bs-setup-step-badge`,
`is-done` when done), a `<ul class="bs-idtags-rows">` of rows (checkbox + `<label>`, the name, the state
text), the button, and the results region. `.bs-idtags-card` borrows the box look of `.bs-setup-step` (border,
radius, background, padding) as its own class, so `/setup`'s link hover rules do not apply. The block goes in
`ui/src/styles.css` after the hub's, with its own `@media (max-width: 480px)` rules; nothing may widen the page
at 375 px.

**8. The three pre-answer states** read `useAuth()`: sign-in loading → rows without state and neither line;
signed out → rows without state, the story's signed-out line and the hub's sign-in button (`login()`); signed
in without an assistant → rows without state, the hub's no-assistant line and link. The page never fetches:
`useAssistantAttention()` mounting is what asks for the answer, once per page load.

**What we trade away**
- The page cannot publish a row it could not check (no checkbox on a `could-not-check` row): on an instance
  with no tag-federation relay and nothing on its local relay — this dev stack — the page shows four
  could-not-check rows and offers nothing. That is the story's AC-3 as approved; § Consequences names the
  follow-up.
- A second, tiny copy of the broadcast-outcome rule in the util.
- One more entry point in the publisher (the variant), instead of changing a contract nine callers hold.

## Consequences

- **Enables:** story 3 adds the second card's button, one server call and `describeServerPublish`; the
  hub, the pill and this page all catch up on their own after a publish.
- **Constrains:** a `could-not-check` row has no publish; the owner may later want a "publish anyway"
  checkbox or a hint to configure a tag-federation relay (a follow-up for the book's carry-forward, not this
  story).
- **Latency:** each tagging is one extension signature and one `publishEverywhere` (the local write plus the
  five outside relays, bounded by the library's ~7.4 s worst case); two taggings in turn, so at most two
  signer prompts.
- **Copy amendment:** story 2 § Copy's "Local write failed" row is superseded by sub-decision 5.
- **Re-aims for the Tester:** `assistant-management-page.spec.js` B8's identification-tags placeholder case
  (and B12 if it picks this address); `test/assistant-management-page.test.js` W1's reading of the route
  mapping, if its regex expects every action to map to `AssistantActionPage`.
- **Debt this ADR notices:** the page-local per-relay renderer (lift to `components/` when a second page
  needs it); the outcome rule's small duplicate; `PUBLISH_RELAYS` is still a literal list in the browser
  (out of scope; the relay list unification is a known open item).
- **Firmware reinstall required?** No.

## Implementation notes

### 1. `ui/src/pages/assistant/identificationTags.js` (new, pure ESM, no imports)

```js
export const IDENTIFICATION_TAGS_COPY = {
  treasureMap: 'Your Treasure Map tells apps what your Assistant publishes for you; these tags are simply an additional mechanism to associate you and your Assistant.',
  cards: { person: 'Taggings you put on your Assistant', assistant: 'Taggings your Assistant puts on you' },
  states: { present: 'Present', missing: 'Missing', checking: 'Checking…' },
  tagNotFound: (name) => `Tag not found: the tag "${name}" has not been published yet, so this tagging can't be made here.`,
  couldNotCheck: {
    'local-unreadable': "Could not read this instance's relay.",
    'no-outside-relays': "Not found on this instance's relay, and no outside relay is configured to check.",
    'outside-unreachable': "Not found on this instance's relay, and no outside relay answered.",
    'request-failed': 'Could not check: this instance did not answer.',
  },
  definitionUnknown: "Its tag definition could not be checked, so it can't be published yet.",
  buttons: { person: 'Publish with your nostr extension', assistant: 'Have your Assistant publish' },
  publishing: 'Publishing…',
  signedOutLine: 'Sign in to see your identification tags.',
  noExtension: 'No nostr extension was found. Install one to publish taggings.',
  signatureRefused: (name, reason) => `"${name}" was not published: your nostr extension did not sign it (${reason}).`,
  doneBadge: 'Done',
  doneSrPrefix: 'Done: ',
};
export function rowState(entry, answerRow, phase) { /* sub-decision 2 */ }
export function cardState(rowStates) { /* sub-decision 2 */ }
```
The heading, the description, "Needs attention", its screen-reader prefix, the sign-in button and the
no-assistant line and link come from `actions.js` (`ASSISTANT_ACTIONS`, `ASSISTANT_COPY`), imported by the
page, not by this module.

### 2. `ui/src/utils/taggingPublishReport.js` (new, pure ESM, no imports)

`describeTaggingPublish({ name, local, external, relays })` per sub-decisions 4 and 5. Relay words for the
lines: `accepted`, `rejected: {reason}`, `unreachable: {reason}`, `timed out`, `skipped (local-only publish
mode)` — the editor's `RELAY_WORDS` and `relayOutcomeText` rule, restated here for the browser's row shape.
Also export `publishTone(report)` (the editor's rule: `error` when not ok; `info` when kept local; `success`
only when every tried relay accepted; else `warning`).

### 3. `ui/src/utils/publishProfileTag.js`

Add `assertPublished(result)` and `publishProfileTagAssertionWithReport(...)`; re-express
`publishProfileTagAssertion` and `publishOrThrow` through them (sub-decision 3). No caller changes; the
`localTaPubkey` warning and the ADR 0015 z stay exactly as they are.

### 4. `ui/src/pages/assistant/IdentificationTags.jsx` (new)

- Imports: `TopBar`, `Link`, `useAuth`, `useConfig`, `useAssistantAttention`, `ActionText`,
  `ASSISTANT_ACTIONS`/`ASSISTANT_COPY`, `ASSISTANT_MANAGEMENT_PATH`, the copy module, the report util,
  `publishProfileTagAssertionWithReport`, `PUBLISH_RELAYS`, and `REQUIRED_TAGGINGS`/`CANONICAL_TAG_AUTHOR`
  from `@tapestry/identification-tags`.
- `const action = ASSISTANT_ACTIONS.find((a) => a.key === 'identification-tags')` for the heading and
  description.
- Rows: `REQUIRED_TAGGINGS.map((entry) => ({ entry, answerRow: answer?.taggings?.find((r) => r.key === entry.key) ?? null, ...rowState(...) }))`;
  cards: the person's rows, the assistant's rows.
- A `Card` component with props `{ signer, title, rows, checked, onToggle, onPublish, publishing, results }`;
  the second card gets no `onPublish` in this story (no button rendered).
- State: `checked` (a `Set` of row keys, rebuilt from the answer with an effect keyed on the answer object),
  `publishing`, `results` (keyed by row key).
- The results block per tagging: the summary with the tone icon, then `<code>{relay}</code> — {line}` rows.

### 5. `ui/src/App.jsx`

Import the page; `ACTION_PAGES` and the mapping of sub-decision 1; update the comment on the route list.

### 6. `ui/src/styles.css`

A `.bs-idtags-*` block after the hub's: the card box (from `.bs-setup-step`'s look), `is-marked`/`is-done`
markers (the hub's and `/setup`'s colours), rows (checkbox, label, name, state text with the muted opacity
`/setup` uses), the button (`bs-link-btn`-like, disabled state), the results region (the editor's small
lines), and the 480 px rules.

### 7. Unchanged

`actions.js`, `ActionPage.jsx`, `ActionText.jsx`, `Index.jsx`, the provider, the server, `nostrPublish.js`,
`PUBLISH_RELAYS`, the relay settings.

### Notes for Test Design (Phase 3; the Tester owns every test change)

- **Pure seams:** `rowState` and `cardState` (every state, the definition-unknown branch, the phases);
  `describeTaggingPublish` and `publishTone` (accepted/partial/none/kept-local/local-failed combinations, a
  relay missing from `details`, empty relays); the copy words against the story's § Copy and sub-decision 5.
- **The publisher's variant** imports `nostrPublish.js`, which imports `nostr-tools/pool`; whether Node can
  load it is the version-gated question `test/honest-publish-reporting.test.js` already answers — a source
  sentinel (the variant exists, the wrapper calls it, `publishOrThrow` keeps its export) is the safe floor.
- **Source sentinels on the page and `App.jsx`:** the override map routes exactly this key; the other nine
  still route to `AssistantActionPage`; the page reads `useAssistantAttention()` and never `fetch`es; the
  checkbox defaults to checked; the button is disabled while nothing is checked; `aria-live` on the results;
  `REQUIRED_TAGGINGS` via the alias; the second card renders no button.
- **Browser:** the mocked attention answers of story 1's fixture plus a tag-not-found variant; the signer
  stubbed with `addInitScript`; `/api/publish-policy` → `allowExternalPublish: false` (no socket, every relay
  `skipped`), `/api/strfry/publish` mocked (and a failing variant for the local-failed lines); after a press
  the mocked attention route answers `DONE` so the rows flip and the hub's count follows; a declining
  `signEvent` for the signature-refused line; 375 px; a direct load; the hub's card leading here.
- **Re-aims:** B8's identification-tags case (no longer a placeholder) and any B11/B12 use of this address;
  `test/assistant-management-page.test.js` W1 if it pins the whole route mapping.
- **The gate:** the story-1 recipe's pattern plus `IdentificationTags|identificationTags|taggingPublishReport|publishProfileTag`.

## Out of scope

- The second card's publish and the server report (story 3, ADR 0003).
- Disputing or retracting from this page; a stored opt-out; publishing a row the check could not settle.
- Changing where taggings are published (`PUBLISH_RELAYS`) or read from.
- Lifting the per-relay renderer into a shared component.
