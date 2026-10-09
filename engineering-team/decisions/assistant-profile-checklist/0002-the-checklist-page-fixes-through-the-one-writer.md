# ADR 0002: The checklist page reads the one answer, and each fix is a republish through the one writer, composed in the browser

**Status:** Proposed
**Date:** 2026-10-09
**Story:** `engineering-team/stories/assistant-profile-checklist/2-the-checklist-page-and-its-one-click-fixes.md`

## Context

Story 2 replaces the placeholder at `/assistant/profile` with the checklist. In short:

- **AC-1.** Back link, title, description, a summary line, the seven panels in order, and a link to the
  editor. Each panel carries the hub card's marks: `!` and **Needs attention**, or ✓ and **Done**.
- **AC-2.** A visitor and a viewer with no Assistant see the panels with no states and no fixes.
- **AC-3.** Each panel's state and words come from story 1's answer: Done, Needs attention,
  Checking…, Could not check, and **Coming soon** for the background image. The summary line counts
  only the counted items.
- **AC-4.** One-click fixes. Each republishes the Assistant's profile once through the one writer,
  changing only its own field: none for NIP-05, client tag and visibility; the website; the empty ones
  of name, display name and About from the default. **Publish the default profile** when there is no
  profile. No fix where it cannot work, and the panel says why.
- **AC-5.** Results in the editor's words, one line per relay. One fix at a time.
- **AC-6.** Re-checked after every fix, so the page, the hub and the pill update without a reload.

ADR 0001 (this epic) gives the answer: `actions.profile` with `finished`, `done`, `pending`,
`hasProfile`, `instance: { domain, website, isPublic }` and one row per item,
`{ key, counts, finished, done, reason, …detail }`, in `PROFILE_ITEMS` order
(`src/lib/assistant-profile-items`, alias `@tapestry/assistant-profile-items`).

### Concept-graph orientation

As in ADR 0001: the stack is absent (AGENTS.md §2 fallback). The story touches
`39998:<TA>:nostr-user` only as "whose Assistant". **No concept changes. No firmware reinstall.**

### Codebase facts this design rests on (verified on `374a6ec`)

- **The one writer.** `POST /api/assistant/publish-profile` with `{ customerPubkey, content }`
  (`src/api/assistant/index.js:151-338`, ADR assistant-profile/0005). It refuses anyone but the
  signed-in person for their own Assistant (403 `not-your-assistant`) and a request with no content
  object (400 `no-content`). It keeps only the seven `PROFILE_FIELDS` (`:44`), drops `nip05` and empty
  strings, and on a public instance sets the NIP-05, the client tag and the `nostr.json` entry
  (`:249-302`). It writes locally first; a local failure is a 500 with `stage: 'local'` and nothing
  goes outward. Then it publishes to the configured relays and answers
  `{ success, outcome, message, relays: { total, success, results: [{ relay, status, reason }] } }`.
- **The current profile and the default, in one read.** `GET /api/assistant/status?customerPubkey=<me>`
  (`index.js:340-452`) answers `hasProfile`, `profile` (the parsed content of the newest kind 0,
  local first) and `defaults` (the one default profile, ADR assistant-profile/0003). The editor loads
  its form from exactly this (`AssistantProfileEditor.jsx:105-122`).
- **The editor's report words** are `RELAY_WORDS` / `relayOutcomeText` / `publishResultTone`,
  private to `AssistantProfileEditor.jsx:27-48`. The same words and tone rule are exported from
  `ui/src/utils/taggingPublishReport.js` as `relayLine(row)` (`:22-32`) and `publishTone(report)`
  (`:105-110`): accepted; rejected; unreachable; timed out; skipped (local-only publish mode); and
  `kept-local` reads as info.
- **The action page precedent.** `IdentificationTags.jsx` routes through `ACTION_PAGES` in
  `ui/src/App.jsx:147-149`. It reads the provider's answer, never fetches it itself, and keeps its
  words and rules in a pure module with no imports, `identificationTagsCopy.js`. That module is named
  apart from the page because a module differing from the page only by letter case resolves to the
  wrong file on the dev container's case-insensitive mount (ADR assistant-identification-tags/0002
  Amendment 1). Its card is a non-link panel, `.bs-idtags-card` (`ui/src/styles.css:8952-9017`), with
  `is-marked` and `is-done`.
- **Tests that pin the placeholder** (Tester's lane): `tests/brainstorm/assistant-management-page.spec.js`
  B8 runs once per action and already skips `/assistant/identification-tags` (`:360`). The profile row
  needs the same skip; B12 and B13 use "a placeholder", so they must pick one that still is.
  `test/assistant-management-page.test.js` W1 accepts `ACTION_PAGES[a.key] ?? <ActionPage …>` (`:345`),
  so the route shape needs no change.

### Constraints

- **One writer** (ADR assistant-profile/0005): no second route signs an Assistant's kind 0.
- **Principle 1.** The page is about the viewer's own Assistant. The only pubkey it sends is
  `user.pubkey`, as `customerPubkey`, which the one writer checks against the session.
- **Principle 4.** Local first: the one writer already writes here before anywhere else.
- **House stack.** JS without build. The pure module stays loadable in Node (no imports, or only
  `.js` ones), as `identificationTagsCopy.js` is.

## Options considered

### Option A — The browser composes each fix from `/api/assistant/status` and posts it to the one writer (chosen)

At press time the page reads `/api/assistant/status` for the current fields and the default. A pure
function applies the fix to the current fields. The result goes to `POST /api/assistant/publish-profile`,
exactly as the editor's **Publish** does.

**Pros**
- The one writer stays the only writer, unchanged. ADR assistant-profile/0005 is honored as written,
  and every rule it enforces (whose, what, local first, NIP-05, client tag, per-relay report) applies to
  fixes for free.
- No new server route, so stories 1 and 3 own all of this book's server changes besides the avatar's.
- The fix rules are a pure function the Node runner can drive case by case.

**Cons**
- A read-modify-write across two requests, with a window in which the editor in another tab could
  publish. The later publish wins, as with any two editor tabs today. One fix at a time on this page
  (AC-5) closes the window within the page.
- Two requests per press instead of one.

### Option B — A server route, `POST /api/assistant/profile-fix { item }`, that reads, fixes and signs

**Pros:** one request; the read and the write happen together on the server.
**Cons:** a second route that signs an Assistant's kind 0, which ADR assistant-profile/0005 closed on
purpose ("the one writer"). It would have to supersede that ADR or share its handler's insides, and
duplicate its refusals. The race it closes is the editor-in-another-tab race the editor already has.
Rejected.

### Option C — Each panel links to the editor with the fix pre-filled in the form

**Pros:** no publishing on this page.
**Cons:** not one click; the owner chose fixes on the panel (book, Decision 2). Rejected.

## Decision

We chose **Option A**: one writer, one press, the fix as a pure function.

### Sub-decisions

**1. Two files, named apart.**

- The page is `ui/src/pages/assistant/ProfileChecklist.jsx`, the default export
  `ProfileChecklistPage`, routed through `ACTION_PAGES` as `profile: <ProfileChecklistPage />`.
- Its words and rules live in `ui/src/pages/assistant/profileChecklistCopy.js`: pure, no imports, so
  Node suites load it as it is. The names differ by more than letter case.

**2. Each panel's state, from the row and the provider's phase:** `panelState(item, row, phase, action)`
returns one of:

| State | When | Marker / badge | Fix |
|---|---|---|---|
| `coming-soon` | `item.key === 'banner'`, whatever else | none / **Coming soon** | no |
| `unknown` | `phase === 'idle'` (signed out, no Assistant) | none | no |
| `checking` | `phase === 'checking'` | `!` / **Needs attention** | no |
| `could-not-check` | `phase === 'failed'`, no `profile` action, the action's `reason === 'check-failed'`, no row, or `row.finished === false` | `!` / **Needs attention** | no |
| `done` | `row.finished && row.done` | ✓ / **Done** | no |
| `needs-attention` | `row.finished && !row.done` | `!` / **Needs attention** | if one fits (sub-decision 4) |

The page reading, as the hub's: marked until proven done. A `could-not-check` panel says why with
`row.reason` (`unreachable`, `profile-unreadable`), or "This instance did not answer." when there is no
row. That line is the Identification Tags page's existing words for a request that failed.

**3. Words.** Every line is story 2 § Copy, keyed by `(item, reason)` in
`PROFILE_CHECKLIST_COPY.panels[key].lines[reason]`, with `{domain}`, `{url}`, `{address}`, `{value}`,
`{n}` and `{m}` filled from the row and `action.instance`. `no-public-address` uses the page's shared
line; `no-profile` uses no panel line, because the notice above the panels says it. The summary line is
`summaryText(action)`: "Your Assistant's profile is complete." when `action.done`, else
`"{n} items need attention"` / `"1 item needs attention"`, with `n` the counted panels not `done`.
While the answer is not in, the summary line reads "Checking…".

**4. Which fix each panel offers:** `fixFor(row, instance)` → `{ fix, label }` or `null`.

| Item | Offered when | `fix` | Label |
|---|---|---|---|
| nip05 | `needs-attention`, reason not `no-public-address` / `no-profile` | `republish` | Republish to register my NIP-05 |
| website | the same | `set-website` | Set website to {url} |
| name-and-about | `needs-attention`, reason not `no-profile` | `fill-name-about` | Fill in the default name / About text / name and About text (by reason) |
| client-tag | as nip05 | `republish` | Republish from {domain} |
| visible | `needs-attention`, reason `only-here` | `republish` | Publish to outside relays |
| avatar | — this ADR: a link to the editor, **Edit your Assistant's profile →** (story 2 § Out of scope); ADR 0003 replaces it | — | — |
| banner | never | — | — |

When `action.hasProfile === false`, no panel offers a fix and the notice offers `publish-default`,
**Publish the default profile**.

**5. The fix is a pure function:** `applyProfileFix(fix, { status, instance })` → `content`, an object
with exactly the seven `PROFILE_CONTENT_FIELDS`. `base` is `status.profile` when `status.hasProfile`,
else `status.defaults`, with each field kept only if it is a string (else `''`). Then:

- `republish` → `base`;
- `set-website` → `{ ...base, website: instance.website }`;
- `fill-name-about` → `base`, with each of `name`, `display_name`, `about` that is empty once trimmed
  replaced by `status.defaults[field]`;
- `publish-default` → the defaults alone;
- `set-picture` (ADR 0003) → `{ ...base, picture: url }`.

Nothing else is touched. The one writer drops empty fields and sets the NIP-05 and the client tag.
`PROFILE_CONTENT_FIELDS` comes from the shared library. The pure module receives it as an argument
from the page, so it keeps no imports. Equivalently, the module may import the library by relative
`.js` path if the Node runner can load it. The Implementer picks; the suites pin the behavior.

**6. One press, in order** (`runFix(fix, extra)` in the page):
1. Set `fixing` (the item key, or `'notice'`). Every fix button on the page is disabled while it is
   set (AC-5).
2. `GET /api/assistant/status?customerPubkey=<user.pubkey>`. A failed or unsuccessful read stops
   here with the result "This instance did not answer; nothing was published." (the Identification
   Tags page's existing words).
3. `content = applyProfileFix(fix, { status, instance: action.instance, …extra })`.
4. `POST /api/assistant/publish-profile` with `{ customerPubkey: user.pubkey, content }`.
5. The result is `describeProfilePublish(data)`, pure, in the copy module:
   `{ ok, outcome, message, rows }` from the one writer's answer (`ok = data.success === true`;
   `message = data.message`, or `data.error` when not ok; `rows = data.relays.results` mapped to
   `{ relay, status, reason }`). A network failure → `{ ok: false, message: <the request-failed line>, rows: [] }`.
   It is drawn with `relayLine` and `publishTone` from `ui/src/utils/taggingPublishReport.js`, the
   editor's words, under the panel that was pressed (or the notice), with the tone icons the
   Identification Tags page uses.
6. Clear `fixing`, then `attention.refresh()`, whatever the result (AC-6). The provider's re-fetch
   updates the panels, the summary line, the hub and the pill.

A result stays until the next press or a navigation, as on the Identification Tags page.

**7. Look.** The panels reuse the Identification Tags page's non-link panel. Either generalize
`.bs-idtags-card*` under a shared name, or add `.bs-profile-check-card*` with the same values; the
Implementer picks the smaller diff. The badges are `bs-setup-step-badge` (`is-done` for Done) and a
neutral variant for **Coming soon**. The page keeps the hub's back link, the `bs-setup-title` heading
and the action's description. At 375 px wide, there is no horizontal scroll.

**What we trade away**
- Two requests per press, and a cross-tab read-modify-write race the editor already has.
- The page stays a publisher, so it carries the result rendering the editor has. It reuses the
  exported words rather than the editor's private copies, which stay where they are (the editor is out
  of scope).

## Consequences

- **Enables:** ADR 0003's avatar fix is one more `fix` (`set-picture`) through the same `runFix`.
- **The editor's private report helpers** (`RELAY_WORDS`, `relayOutcomeText`, `publishResultTone`)
  now duplicate `relayLine` and `publishTone`. That is noted as debt; making the editor import them is
  a one-file refactor for a later story.
- **The placeholder's alert criteria and planning notes** for the profile action stay in
  `ASSISTANT_ACTIONS` but are no longer shown. The Identification Tags entry set that precedent.
- **Firmware reinstall required?** No.

## Implementation notes

- `ui/src/pages/assistant/profileChecklistCopy.js` (new, pure): `PROFILE_CHECKLIST_COPY` (story 2 §
  Copy, verbatim; the header comment names the story as the place to change words first), `panelState`,
  `panelLine`, `fixFor`, `applyProfileFix`, `summaryText`, `describeProfilePublish`.
- `ui/src/pages/assistant/ProfileChecklist.jsx` (new): reads `useAuth()`, `useAssistantAttention()`,
  and `PROFILE_ITEMS` from `@tapestry/assistant-profile-items`. Draws the back link, title,
  description, summary line, the no-profile notice (when `action.hasProfile === false`), the seven
  panels, and the editor link (`ACTION.editLink`). Signed out: the sign-in line ("Sign in to see your
  Assistant's profile.") and `ASSISTANT_COPY.signInButton`. No Assistant: `ASSISTANT_COPY.noAssistantLine`
  and its link. Neither shows states or fixes.
- `ui/src/App.jsx`: `ACTION_PAGES` gains `profile: <ProfileChecklistPage />` and its import.
- `ui/src/styles.css`: the panel classes (sub-decision 7) and the neutral badge.
- Nothing in `src/` changes for this story.
- **For the Tester:** the B8/B12/B13 placeholder pins above. A Playwright fixture for this page mocks
  `/api/assistant/attention` with an `actions.profile`, `/api/assistant/status` and
  `/api/assistant/publish-profile`, and asserts the posted `content` (only the fixed field differs).

## Out of scope

- The avatar's fix (ADR 0003).
- Changing the editor, or the one writer.
- A "fix everything" button.
