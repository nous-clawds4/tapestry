# ADR 0021: Login-failure surfacing and mobile tag-result collapse

**Status:** Accepted
**Date:** 2026-06-01
**Story:** _none — user elected to proceed without a Product Owner story (see "Story gap" below)._
Tracked from the two-bug request on the `bugfixes` branch:
(1) clicking sign-in with no NIP-07 signer does nothing visible;
(2) on mobile, a long tag-result list buries the profile results.

## Context

Two independent presentation-layer bugs, batched on the `bugfixes` branch.
Concept-graph orientation (`/api/concept-graph/summaries`, 39 concepts) found
**no auth/login or search-results-UI concept** — all domain concepts are
graph/WoT structures (class-thread, concept-header, graperank, …). So neither
fix touches a concept handle, the firmware, or any POV-namespaced data; both
are pure UI/UX. No architecture-invariant (POV-first, decentralized-first,
filter-at-view-time) is in play.

### Bug 1 — login failures are invisible

`login()` lives in `ui/src/context/AuthContext.jsx`. Today it is wired at
multiple entry points with inconsistent error handling:

| Entry point | File:line | Current handling |
|---|---|---|
| Tapestry dashboard header | `ui/src/components/Header.jsx:43` | `try/catch` → inline `.signin-error` span |
| Search user menu (logged-out) | `ui/src/components/BrainstormUserMenu.jsx:75` | `onClick={login}` — **no handling** |
| Search WoT panel fallback | `ui/src/pages/BrainstormSearch.jsx:497` | `onClick={login}` — **no handling** |
| Pins page | `ui/src/pages/Pins.jsx:157` | `.catch(() => {})` — **silent** |
| Tag page (sign-in-then-act) | `ui/src/pages/Tag.jsx:154` | `try { await login() } catch { return }` — silent, but must keep throwing to abort the follow-up action |

`runLogin()` can fail in three distinct ways (`AuthContext.jsx:61–109`):

1. **No signer** — `if (!window.nostr)` throws.
2. **Signer present but the user declines** — `window.nostr.getPublicKey()`
   or `window.nostr.signEvent()` rejects. The thrown message is whatever the
   extension supplies — often terse ("User rejected"), sometimes empty.
3. **Server rejects** — `verifyData.authorized === false` or
   `loginData.success === false`; message comes from the server
   (e.g. a not-in-WoT / unauthorized string) and *is* meaningful to show.

Most real users sign in from the **public search page**, where the button has
no handling — so the dominant path fails completely silently. That is the bug.

**Constraint discovered during re-derivation (not in the original report):**
NIP-07 browser extensions inject `window.nostr` *asynchronously* during page
load. A user who clicks "Sign in" before injection completes hits a **false**
`!window.nostr`. An immediate one-shot check (what exists today) therefore
mis-reports "no signer" for users who actually have one. Any correct fix must
tolerate this race.

**Constraint:** there is no toast/snackbar system in the codebase, and per the
user we will not build one. Existing modal precedent: the export dialog
(`ExportModal.jsx` → `.bs-tl-export-backdrop` / `.bs-tl-export-popover`,
`styles.css:6645`, z-index 1200). Highest existing z-index is 1200.

### Bug 2 — tag results crowd out profiles on mobile

Search results render tag hits above profile cards
(`BrainstormSearch.jsx:1467–1473`, Story 7 / ADR-0006). `resultsTagHits`
renders **in full, unbounded**, inside `.bs-results-taghits`. When a query
matches many tags, the tag block pushes the `ResultCard` profile list
(`.bs-results-list`) off-screen on a phone, and nothing signals that profiles
exist below — the user reads it as "tags only." Tag hits do **not** paginate
(`offset === 0` is the only branch that sets them — `BrainstormSearch.jsx:907`;
the load-more append branch leaves them untouched).

Decisions already taken with the user (recorded so the Tester/Implementer
inherit them): **collapse-only** (no section labels), **all viewports**,
**show the first 3** then a toggle.

### Story gap

No `engineering-team/stories/*` file covers either bug; the Architecture phase
normally consumes an approved story. This ADR is being written ahead of that at
the user's explicit direction. **Action:** Product Owner should backfill a
story (or two) capturing the two bug reports and the four UX decisions, then
link this ADR. Recorded in `_intake.md`.

## Options considered

### Decision 1 — where login failures are surfaced

#### Option 1A — Shared modal owned by `AuthProvider`, error in context state
`login()` records the failure in `AuthContext` state and re-throws; the
provider renders one `<LoginErrorModal>` for the whole app. Every entry point
is covered with zero per-callsite work; the bare `onClick={login}` sites only
need `.catch(() => {})` to avoid an unhandled-rejection console warning (the
modal is already shown by the time the rejection propagates).
- **Pros:** one surface, all five entry points fixed at once (incl. the silent
  Pins/Tag paths) without touching their logic; auth owns auth-failure UX
  (high cohesion); re-throw preserves the `Tag.jsx` abort contract.
- **Cons:** the context module now renders UI (mild separation-of-concerns
  smell — though `AuthContext.jsx` already trips `react-refresh` by exporting
  `useAuth`, so no new lint regression). A `loginError` state change re-renders
  consumers — but only on a login *attempt* (rare), so negligible.

#### Option 1B — Context exposes `loginError` + `dismiss`; modal rendered in `App`
Same state, but the modal mounts in a top-level UI component instead of the
provider.
- **Pros:** context stays logic-only (cleaner layering).
- **Cons:** more wiring; an extra consumer of the context purely to render;
  no functional gain. The cohesion argument (auth owns its failure UX) cuts the
  other way.

#### Option 1C — `useLogin()` hook returning `{ login, error, clear }`, inline per callsite
Each callsite renders its own inline message.
- **Pros:** no global state.
- **Cons:** re-duplicates the UI we're trying to consolidate; inline messages
  are exactly what's easy to miss on mobile (the original complaint); five
  callsites to touch and keep consistent. Rejected.

### Decision 2 — how failure reasons map to copy

#### Option 2A — Show `err.message` verbatim (the quick-fix behavior)
- **Pros:** trivial.
- **Cons:** leaks uncontrolled strings — terse/empty extension messages for
  user-declines, raw server text. Inconsistent voice; sometimes blank.

#### Option 2B — Categorize into typed reasons with controlled copy
`runLogin()` throws errors tagged with a `code`
(`NO_SIGNER` | `SIGNER_DECLINED` | `NOT_AUTHORIZED` | `UNKNOWN`). The modal maps
code → vendor-neutral copy. For `NOT_AUTHORIZED` we still surface the server's
message (it's the meaningful "why"); for `SIGNER_DECLINED` we show our own
friendly line instead of the extension's terse string; `NO_SIGNER` shows the
vendor-neutral install guidance.
- **Pros:** controlled, consistent, vendor-neutral voice; no blank modals;
  honors the "leave it vague, don't name software" instruction precisely.
- **Cons:** a little more code in `runLogin` (tagging) and the modal (mapping).

### Decision 3 — the `window.nostr` injection race

#### Option 3A — Immediate one-shot `if (!window.nostr)` (today's behavior)
- **Cons:** false "no signer" for users whose extension injects slightly late.

#### Option 3B — Bounded wait for injection before declaring no-signer
A small helper polls for `window.nostr` for up to ~1s (e.g. 50 ms × 20)
before throwing `NO_SIGNER`. If it appears, login proceeds normally.
- **Pros:** eliminates the most common false-negative; tiny, self-contained.
- **Cons:** up to ~1s delay in the genuine no-signer case (acceptable — that
  path ends in a modal anyway).

### Decision 4 — tag-result collapse mechanism (Bug 2)

#### Option 4A — JS state: render first N, toggle to expand
`tagsExpanded` state; render `slice(0, N)` (or all when expanded) + a
"Show N more tags" / "Show fewer tags" toggle button. Reset on each fresh
search (`offset === 0`).
- **Pros:** the toggle's "N more" count is itself the at-a-glance signal that
  results are a mix and there's more above the people below — directly answers
  the complaint. Resets correctly; pagination-safe (load-more doesn't touch
  tag hits).
- **Cons:** one new piece of component state.

#### Option 4B — CSS-only `max-height` + fade
- **Pros:** no JS.
- **Cons:** can't show an explicit "N more" count (the key signal); fragile
  across variable row heights; no clean reset hook. Rejected.

## Decision

- **Decision 1 → Option 1A.** Shared `<LoginErrorModal>` rendered by
  `AuthProvider`, error held in context state, `login()` re-throws. Best
  coverage-per-change; fixes the silent Pins/Tag paths for free; preserves the
  `Tag.jsx` abort contract.
- **Decision 2 → Option 2B.** Categorized failure codes with controlled,
  vendor-neutral copy; server message preserved only for `NOT_AUTHORIZED`.
- **Decision 3 → Option 3B.** Bounded wait (~1s) for `window.nostr` before
  declaring `NO_SIGNER`.
- **Decision 4 → Option 4A.** JS-state collapse, first 3, all viewports, reset
  on fresh search.

## Consequences

- **Enables:** every login entry point reports *why* it failed in one
  consistent, vendor-neutral surface; the late-injection false negative is
  eliminated; mobile search results read as a mix, with profiles reachable.
- **Constrains:** `AuthContext.jsx` renders a modal (acceptable cohesion
  trade-off, no new lint state). The `NO_SIGNER` path adds up to ~1s latency
  before the modal — by design.
- **Follow-ups / debt:**
  - Product Owner must backfill the missing story and link this ADR.
  - The orphaned `.signin-error` CSS rule (`styles.css:652`), unused once the
    Header inline span is removed, should be deleted by the Implementer (flag
    for the Reviewer so its removal isn't mistaken for scope creep).
  - `NewDListItem.jsx:157` / `NewDList.jsx:86` also guard on `window.nostr` for
    *publish* (not login) flows — explicitly out of scope here; a future ADR
    could route them through the same bounded-wait helper.
- **Firmware reinstall required?** No — no concept definitions change.

## Implementation notes

Concrete module boundaries the Implementer should honor:

**Bug 1 — login failure surfacing**

- `ui/src/utils/nip07.js` (new, small) — `waitForNostr(timeoutMs = 1000, stepMs = 50)`
  returning `window.nostr | null`. Pure helper, no React. Keeps the race logic
  testable and out of the context.
- `ui/src/context/AuthContext.jsx`:
  - Define a tagged error shape — a `LoginError extends Error` (or a plain
    `Error` with an `err.code` field) using codes
    `NO_SIGNER | SIGNER_DECLINED | NOT_AUTHORIZED | UNKNOWN`.
  - In `runLogin()`: replace the immediate `if (!window.nostr)` with
    `const nostr = await waitForNostr(); if (!nostr) throw new LoginError('NO_SIGNER')`.
    Wrap `getPublicKey()` / `signEvent()` rejections as `SIGNER_DECLINED`. Map
    the `!authorized` / `!success` server branches to `NOT_AUTHORIZED`
    (carry the server `message`). Anything else → `UNKNOWN`.
  - Keep the `login()` wrapper: `setLoginError({ code, message })` on catch,
    then re-throw (contract preserved). Store an object, not a bare string, so
    the modal can map code → copy.
  - Render `<LoginErrorModal error={loginError} onClose={() => setLoginError(null)} />`
    inside the provider.
- `ui/src/components/LoginErrorModal.jsx` (new) — maps `error.code` → controlled
  copy:
  - `NO_SIGNER` → the vendor-neutral install guidance (no brand names).
  - `SIGNER_DECLINED` → "Sign-in was cancelled in your signer. Try again when ready."
  - `NOT_AUTHORIZED` → server `message` (fallback: "You're not authorized to sign in here.").
  - `UNKNOWN` → generic retry copy.
  - Backdrop/popover styling mirrors `.bs-tl-export-*`; new classes
    `.bs-login-error-*`, z-index **1300** (above export's 1200). Mobile
    (`max-width: 600px`) bottom-sheet variant like the export modal.
- `ui/src/components/Header.jsx` — drop the local `loginError` state and the
  `.signin-error` span; keep `loggingIn`; `handleLogin` swallows the re-throw.
- `ui/src/components/BrainstormUserMenu.jsx:75`, `ui/src/pages/BrainstormSearch.jsx:497`
  — `onClick={() => login().catch(() => {})}` (modal shows; avoids unhandled
  rejection). `Pins.jsx` / `Tag.jsx` already catch — no change.
- Delete the now-dead `.signin-error` rule (`styles.css:652`).

**Bug 2 — tag-result collapse**

- `ui/src/pages/BrainstormSearch.jsx`:
  - Module constant `TAG_COLLAPSE_LIMIT = 3`.
  - State `tagsExpanded` (near `resultsTagHits`, `:800`); reset to `false` in the
    `offset === 0` branch where `setResultsTagHits` is called (`:907`) — **not**
    in the load-more branch.
  - In the tag-hits render (`:1467`): map `tagsExpanded ? resultsTagHits :
    resultsTagHits.slice(0, TAG_COLLAPSE_LIMIT)`; when
    `resultsTagHits.length > TAG_COLLAPSE_LIMIT`, render a toggle button
    ("▸ Show {N − limit} more tags" / "Show fewer tags") with `aria-expanded`.
- `ui/src/styles.css` — `.bs-taghits-toggle` (full-width, left-aligned, subtle).

## Out of scope

- Section labels ("Tags" / "People") — the user chose collapse-only.
- Per-breakpoint behavior — the user chose all-viewports; no media-query branch.
- Capping or restructuring the *profile* result list (it already paginates).
- Building a general toast/notification system.
- Routing the publish-flow `window.nostr` guards (`NewDList*.jsx`) through the
  new helper.
- Re-parenting any concept (no concepts involved).
