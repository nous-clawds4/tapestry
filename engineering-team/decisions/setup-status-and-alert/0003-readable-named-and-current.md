# ADR 0003: The Setup Alert: dark text on its chip, named by what it shows, and re-checked when the viewer publishes

**Status:** Accepted
**Date:** 2026-09-21
**Story:** `engineering-team/stories/setup-status-and-alert/3-setup-alert-polish.md`
**Builds on:** ADR 0001 (the shared provider and its `refresh()`) and ADR 0002 (the pill), whose
parts listed under § Decision it supersedes.

## Context

Story 3 fixes the four non-blocking findings of story 2's review
(`engineering-team/reviews/setup-status-and-alert/2-the-setup-alert.md`, Non-blocking 1–4). For
three of them it follows the owner's planning calls (story 3 § "The owner's answers"):

| AC | What it asks | Where the code stands (on staging, PR #737) |
|---|---|---|
| AC-1 | "Finish setup →" at ≥ 4.5:1 on its chip, with dark text on amber | `ui/src/styles.css:8689–8695`: `color: #fff` on `background: #d29922`, measured at **2.52:1** |
| AC-2 | the pill's accessible name is its visible text at each width, with the ⚠ and the arrow not announced | `ui/src/components/SetupAlert.jsx:28`: `aria-label={SETUP_ALERT_COPY.name}` replaces the content at every width. The arrow is inside `SETUP_ALERT_COPY.button` (`'Finish setup →'`, `ui/src/pages/setup/steps.js:61–65`) |
| AC-3 | after the app publishes the viewer's kind 3 or kind 10040, the pill and `/setup` show the new answer within seconds, with no reload and no old answer shown as current | the provider asks again only when the account, the assistant or `attempt` changes (`ui/src/context/SetupStatusContext.jsx:32`). `refresh()` (`:60`) has no caller |
| AC-4 | no pill on `/setup*` in any letter case | `SetupAlert.jsx:25` compares the path case-sensitively, while React Router matches routes case-insensitively by default |

**Concepts touched:** none. The story's orientation handles are story 1's.

### How the app publishes a viewer's follow list or Treasure Map

Every kind 3 or kind 10040 that the viewer publishes from the browser is signed with NIP-07 and
sent through one of two routes.

**1. `ui/src/utils/nostrPublish.js`.**
- `publishToLocalStrfry` (`:45`) POSTs `{ event, signAs: 'client' }` to `/api/strfry/publish`.
- `publishToRelays` (`:128`) publishes from the browser through `SimplePool`.
- `publishEverywhere` (`:182–188`) runs both in parallel.

These carry:
- **Follow and unfollow on a profile page:** `useProfileActions.js` `signAndPublish` (`:77–86`) →
  `publishEverywhere`.
- **The Treasure Map editors:** `TreasureMapManualEdit.jsx:45–46`, `TlOptInCard.jsx:66–67` and
  `DListCurationPanel.jsx:197–198`, each through `publishOrThrow` (`ui/src/utils/publishProfileTag.js:24`)
  → `publishEverywhere`.
- **Copying an existing Map to a relay:** `TreasureMapRelayPresence.jsx:181` and `:197`
  (`publishToRelays`, then `publishToLocalStrfry`).

**2. A raw `fetch('/api/strfry/publish')` with the same body, `{ event, signAs: 'client' }`.** Three
pages use it to import the viewer's own existing event into the local relay:
- `TrustedAssertions.jsx:104`: the viewer's kind 10040;
- `UserDetail.jsx:310`: kinds 0, 3, 10000 or 10040 for the user on screen, which is the viewer's
  own when they view themselves;
- `BrainstormSettings.jsx:368`: `importLocal10040`.

**The other raw publishers never carry kind 3 or kind 10040:**
- `NewDList.jsx:101`, `NewDListItem.jsx:169`, `CuratedDListHeaders.jsx:86`: kinds 9998/39998 and
  9999/39999;
- `DListRatings.jsx:234`/`:258`, `DListItemRatings.jsx:153`/`:178`: kind 7;
- `useCreateTapestry.js:54`: kind 39998;
- `Add`/`RemoveConceptFromTapestry.jsx`: events the server signs as the assistant.

**A successful local publish is already on the relay when the call returns.**
`handlePublishEvent` (`src/api/strfry/commands/publishEvent.js:100–125`) awaits `strfry import`
before it answers `success: true`. ADR 0001's check scans the local relay first. So a re-check
started after a successful local publish finds the new event as a local hit, which story 1
measured at under a second live.

### What the accessible name becomes without `aria-label`

This was prototyped on the built UI (2026-09-21):
- `aria-label` removed;
- the arrow moved into its own `aria-hidden` span;
- the name read from Chrome's accessibility tree (CDP `Accessibility.getFullAXTree`) and from
  Playwright's `ariaSnapshot()` at 1280, 800 and 375 px.

| Width | Name (Chrome and Playwright agree) |
|---|---|
| 1280 | "Finish setting up your account · 2 steps left Finish setup" |
| 800 | "Finish setting up your account Finish setup" |
| 375 | "Finish setup" |

These are exactly AC-2's strings.
- The flex items are block-level, so both algorithms put a space between the parts without any
  whitespace in the markup (the prototype matched with and without explicit spaces).
- A `display: none` part drops out of the name.
- The ⚠ is already `aria-hidden` (`SetupAlert.jsx:29`).
- No top bar overflowed in the prototype.

## Options considered

### How the provider learns of a publish (AC-3)

#### Option A — a publish signal in `nostrPublish.js` that the provider listens to (chosen)
- `nostrPublish.js` keeps a small listener set and announces every signed event that reached a
  relay:
  - from `publishToLocalStrfry` when the server answers `success: true`;
  - from `publishToRelays` when at least one relay accepted.
- `publishEverywhere` inherits both.
- The provider subscribes. It calls `refresh()` when the announced event is the viewer's own kind 3
  or kind 10040, once per event id.
- The three raw import sites switch to `publishToLocalStrfry`. It sends the identical request, so
  they get the announcement too.

**Pros:**
- One place covers every current path, and any future one that uses the shared helpers.
- The re-check starts after the event is on a relay: after the local write, which is the one the
  check reads first.
- No page learns about setup.

**Cons:**
- `publishEverywhere` announces the same event up to twice, once per route, which the de-duplication
  absorbs.
- A future page that bypasses the helpers with a raw request is missed. The Tester can pin the list
  of raw callers so that a new one surfaces.

#### Option B — call `refresh()` at each publishing site
**Pros:** explicit.

**Cons:**
- About eight components and two plain utilities would need edits. `publishOrThrow` and
  `signAndPublish` are not components, so they cannot use the hook.
- Every future publishing page would have to remember to call it.
- It couples editors to the setup feature.

#### Option C — re-check on navigation, window focus or a timer
**Pros:** also catches changes made in other tabs.

**Cons:**
- AC-3 needs the update without a navigation.
- A timer is the polling ADR 0001 § 3 ruled out.
- Other tabs and apps are out of scope for story 3.

#### Option D — server push when the session's kind 3 or kind 10040 lands on the relay
**Pros:** it would cover other apps and tabs too.

**Cons:**
- It needs a new push channel on the server for a case story 3 scopes out.
- It is the natural path if that scope is ever widened. It is not needed now.

### The accessible name (AC-2)

#### Option E — drop `aria-label`, so the name comes from the visible parts (chosen)
The ⚠ and the arrow are `aria-hidden`. The prototype above shows Chrome computing AC-2's exact
strings at every width, with CSS alone deciding which parts show.

**Pros:**
- There is no second source of truth: the name cannot drift from what is shown.
- WCAG 2.5.3 (label in name) holds at every width.

#### Option F — an `aria-label` that JavaScript rewrites per width
**Cons:** it duplicates the CSS breakpoints in `matchMedia`, and it can drift from them. Rejected.

### The chip (AC-1)

The owner chose dark text on the amber chip. The text colour is `#0f0f1a`, the Brainstorm pages'
own dark background (`var(--bg-primary, #0f0f1a)`): **7.54:1** on `#d29922`, which also passes
AAA's 7:1.

A near-black warm tint would read much the same. Reusing the page colour keeps the palette closed.
No other option is weighed, because the owner decided the look.

## Decision

- **AC-3:** Option A.
- **AC-2:** Option E.
- **AC-1:** `#0f0f1a` text on the unchanged `#d29922` chip.
- **AC-4:** `SetupAlert` lower-cases the pathname before comparing it.

**This supersedes, in ADR 0002:**
- § 1's markup attribute `aria-label={SETUP_ALERT_COPY.name}`;
- § 3's `SETUP_ALERT_COPY.name` and `button: 'Finish setup →'`, which becomes `button: 'Finish setup'`
  plus a decorative arrow;
- § 4's "white bold text" on the chip;
- § 5's "No other trigger is added".

**In ADR 0001 § 3:** a successful publish of the viewer's own kind 3 or kind 10040 becomes a reason
to ask again. The same section's "a step completed in another app shows on the next full page load,
or after refresh()" still holds for other apps and other tabs.

Story 2's AC-5 clause "The pill's accessible name stays 'Finish setting up your account'" is
replaced by story 3's AC-2, as story 3 records.

## Consequences

**What this enables:**
- The pill is readable, at 7.5:1.
- It is announced as it reads.
- It catches up within about a second of the viewer's own save anywhere in the app. The `/setup`
  page, which reads the same answer, catches up with it.

**During the re-check:**
- `refresh()` changes the request key, so the phase is `checking` until the new answer lands (ADR
  0001 § 3).
- The pill hides, and `/setup` shows its "still checking" state. Neither shows the old answer as
  current, which is AC-3's second clause. Any flash lasts only the local check's duration.

**Load:**
- One extra status read per publish of the viewer's own kind 3 or kind 10040.
- None for any other kind, or for anyone else's events. The announced event's `pubkey` must be the
  signed-in viewer's.

**Constrains:**
- A new place in the app that publishes the viewer's kind 3 or 10040 must use the `nostrPublish.js`
  helpers, or it will not refresh the pill. The Tester's sentinel (Implementation notes 7) makes a
  new raw caller visible.

**Tests to update:** story 2's tests that pin the old name and copy need Tester changes in Phase 3
(Implementation notes 7).

**Firmware reinstall required?** No.

## Implementation notes

1. **`ui/src/utils/nostrPublish.js`: the publish signal.**
   - Add a module-level `Set` of listeners.
   - `export function onEventPublished(listener)` adds a listener and returns an unsubscribe
     function.
   - An internal `announcePublished(signedEvent)` calls each listener inside `try/catch`, so a
     listener that throws never breaks a publish.
   - Call it:
     - in `publishToLocalStrfry`, after `resp.json()`, when `data?.success === true`;
     - in `publishToRelays`, after the outcomes are classified, when `successes.length > 0`. It is
       never called on the `skippedByGate` return.
   - Return values are unchanged. `publishEverywhere` is unchanged.
2. **The three import sites** (`TrustedAssertions.jsx:104`, `UserDetail.jsx:310`,
   `BrainstormSettings.jsx:368`):
   - replace the inline `fetch('/api/strfry/publish', { … { event, signAs: 'client' } })` with
     `await publishToLocalStrfry(event)` from `utils/nostrPublish`;
   - keep each site's handling of `data.success` and `data.error`;
   - leave everything else in those files alone.
3. **`ui/src/context/SetupStatusContext.jsx`: the listener.** Add one `useEffect`, keyed on `pubkey`
   and `refresh`:
   - it subscribes through `onEventPublished`;
   - it calls `refresh()` when the event's `pubkey` equals the signed-in `pubkey`, its `kind` is `3`
     or `10040`, and its `id` has not been seen before (a `useRef(new Set())`);
   - it unsubscribes on cleanup.

   Update the header comment's "and again when…" sentence. Nothing else changes: the request key,
   the reset guard and the lazy start stay as they are.
4. **`ui/src/components/SetupAlert.jsx`.**
   - Remove `aria-label` from the `Link`.
   - Compare `pathname.toLowerCase()` for the `/setup` hide.
   - The button span becomes:

     ```jsx
     <span className="bs-setup-alert-button">
       {SETUP_ALERT_COPY.button}<span className="bs-setup-alert-arrow" aria-hidden="true"> {SETUP_ALERT_COPY.arrow}</span>
     </span>
     ```

   - The ⚠ span stays `aria-hidden`. Update the header comment: the name follows what the pill shows.
5. **`ui/src/pages/setup/steps.js`:**

   ```js
   SETUP_ALERT_COPY = { sentence: 'Finish setting up your account', button: 'Finish setup', arrow: '→' }
   ```

   `name` goes. The visible words are unchanged ("Finish setup →"). `alertCountText` is unchanged.
6. **`ui/src/styles.css`:** in `.bs-setup-alert-button`, `color: #fff` → `color: #0f0f1a`, with a
   one-line comment giving the ratio (7.5:1 on `#d29922`, story 3 AC-1). No other style changes.
7. **Notes for Test Design** (Phase 3; the Tester owns every test change).
   - **Story 2's tests that pin what changes:**
     - `test/setup-alert.test.js` C1 (`SETUP_ALERT_COPY.name` and `button`) and D1 (the
       `aria-label` sentinel);
     - in `tests/brainstorm/setup-alert.spec.js`, every locator by the old fixed name. At 375 px the
       name is now "Finish setup", so the helper `pill()` will miss it. That affects B7 at 375 px, the
       B11 "hides" tests and B12.
   - **New checks:**
     - the chip's computed colour and ratio at the three widths (AC-1);
     - the exact accessible name at 1280, 800 and 375 px, and that no `aria-label` is set (AC-2);
     - a B-class publish: a fake signer and a mocked `/api/strfry/publish` success on a real
       publishing surface. The profile page's Follow is one; mock `/api/publish-policy` →
       `allowExternalPublish: false` so no WebSocket leaves the test. The pill's count drops without
       a reload, and during the second read it shows no old count (AC-3);
     - a Node test of `onEventPublished`: announced on success, not on failure, not when skipped by
       the gate, and a throwing listener is harmless;
     - `/SETUP` and `/Setup/Follow` (AC-4);
     - optionally, a sentinel that lists the raw `'/api/strfry/publish'` callers under `ui/src`, so a
       new one is surfaced for review.
   - **The gate:** story 2's recipe, with the grep extended to `nostrPublish`, `TrustedAssertions`,
     `UserDetail`, `BrainstormSettings`, `publishToLocalStrfry` and `onEventPublished`. Re-run the
     walker triage after any merge of `origin/staging` (ledger row
     `2026-09-21-abbreviated-path-names-no-gate`).

## Out of scope

- **Publishes from other apps or other tabs.** Option D is the path if that scope is ever widened.
- **Any other change to the pill's look or behaviour.** Its tones, sizes, breakpoints and
  phone rules stay.
- **Routing the other raw publishers through the helpers.** They never carry kind 3 or 10040.
- **The `/setup` page's own copy.** It shows the same answer, and nothing about it changes.
