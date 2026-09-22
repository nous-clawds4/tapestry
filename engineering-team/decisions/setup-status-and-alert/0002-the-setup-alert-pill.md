# ADR 0002: The Setup Alert, one self-contained pill mounted beside each avatar menu and reading the shared setup answer

**Status:** Accepted (Amendment 1 appended 2026-09-21: the control panel's brand yields room instead of wrapping; § 1's `aria-label`, § 3's `name` and `button` copy, § 4's white chip text and § 5's "No other trigger is added" superseded by `setup-status-and-alert` ADR 0003)
**Date:** 2026-09-21
**Story:** `engineering-team/stories/setup-status-and-alert/2-the-setup-alert.md`
**Builds on:** ADR 0001, whose provider and `pendingCount` this reads. It extends one line of ADR 0001
§ 3; see Decision 5.

## Context

Story 2 asks for Brainstorm's "Finish setting up your account · N steps left" pill, in the top bar
beside the avatar menu, on every page outside `/tapestry` (the landing page included) and on every
`/tapestry` page.

**What it counts:** only steps that are *confidently* not done.
- Step 1 counts when sign-in says this instance holds no assistant for you.
- Steps 2 and 3 count when their check finished and the step is not done.
- A Map naming another provider is never counted.

**When it hides:**
- when the visitor is signed out;
- when nothing is counted;
- on `/setup` and its three step pages.

It cannot be dismissed.

**Its layout by width** (AC-5):
- wide screens: the sentence and the count;
- narrower screens: the count may drop;
- 375 px: only ⚠ and "Finish setup →";
- no top bar scrolls horizontally.

**Other ACs:** AC-4 says it never disagrees with `/setup`, and AC-6 says it only reads.

**What ADR 0001 already provides** (on staging since PR #732):
- **One answer.** `SetupStatusProvider` (`ui/src/context/SetupStatusContext.jsx`) is mounted once
  in `App.jsx`. It fetches `/api/setup/status` once, when a component first asks, and again when the
  account changes. It drops the held answer when the request goes away.
- **The count.** `useSetupStatus()` returns `pendingCount`: the steps that are `pending && !done`.
  The server sets `pending` only for a finished, not-done step and never for another provider.
- **So story 2 adds no fetch, no rule and no server change.** It is one presentational component,
  and where to put it.

### There is no single top bar

There are four hosts, each holding one of the app's avatar menus or its empty slot:

| Host | Where it renders |
|---|---|
| `BrainstormUserMenu` (`ui/src/components/BrainstormUserMenu.jsx:106`, the signed-in root `.bs-usermenu`) | `TopBar`'s default auth slot (`TopBar.jsx:49–53`): `/user/:pubkey`, `/tag`, `/tags`, `/pins`, `/pin`, `/setup*` and `/assistant`. It also renders directly in the own top bars of fourteen pages: About, AboutSearch, Event, Feed, Followers, Follows, FollowsHops, HowSearchWorks, Muters, Personalization, Reporters, Settings, Skill and UserNotes. |
| The landing page's own `UserMenu` (`ui/src/pages/BrainstormSearch.jsx:100`, root at `:515`) | the landing view, as `TopBar`'s `authMenu` (`:1100`), and the results view's `.bs-results-header-right` (`:1363`) |
| The control panel `Header` (`ui/src/components/Header.jsx:120`, `.header-auth`) | every `/tapestry` page, including its own "Page not found" |
| `DevPage` (`ui/src/pages/developers/DevPage.jsx:45`), an empty `<div className="bsp-auth" />` | the developer pages |

The site-wide "Page not found" has no top bar, and story 2 puts it out of scope.

### Room at small widths

Measured 2026-09-21 on the built UI:
- headless Playwright, every `/api` route mocked, signed in;
- a prototype pill inserted beside each menu.

The script is kept in the session scratchpad. A pill's forms and widths:

| Form | Width |
|---|---|
| ⚠ + "Finish setup →" (phone) | ~132 px |
| … + the sentence | ~330 px |
| … + the count (full) | ~404 px |

| Host | Phone form at 375 px | Sentence form | Full form |
|---|---|---|---|
| `TopBar` pages (the landing page included) | **overflows by 22 px** | fits from 640 px | fits from 768 px |
| Other Brainstorm bars (`/about`, `/user/…/follows`) | fits | fits from 440 px | fits from 640 px |
| `DevPage` | fits | fits | fits |
| Control panel `Header` (with `.header-auth` laid out as a flex row) | **overflows by 26 px** | fits from 640 px | fits from 768 px |

**The results view hides its whole right side below its small-screen breakpoint**
(`ui/src/styles.css:3636`): the point-of-view picker and the avatar menu. A pill beside that menu
hides with it.

### Freshness after creating an assistant

assistant-profile #4, the My Assistant page (on staging via PR #730), added `AuthContext.refreshUser()`
(`ui/src/context/AuthContext.jsx:163`). After the viewer creates an assistant on `/assistant`
(`onAssistantCreated={refreshUser}`, `ui/src/pages/assistant/Index.jsx:53`), it updates
`user.assistantPubkey` in place, and the pubkey stays the same.

ADR 0001's request key is `${pubkey}#${attempt}` (`SetupStatusContext.jsx:30`), so nothing asks
again. Right after the viewer creates their assistant in this very tab, the pill would still count
step 1 until a full page load. Story 2's out-of-scope line covers a step completed "in another app
or another tab", not this.

**Concepts touched:** none.

## Options considered

### Option A — A self-contained `<SetupAlert />`, mounted inside each avatar-menu host (chosen)

- **One component** holds every rule: signed in, a count above zero, and not on `/setup*`. Each host
  gains one line.
- **Four hosts, four edits:**
  - `BrainstormUserMenu` covers `TopBar` and the fourteen other bars;
  - the landing page's `UserMenu` covers the landing and results views;
  - `Header`;
  - `DevPage`.
- **Small screens are handled in CSS only,** scoped with `:has(.bs-setup-alert)` so that nothing
  changes for a viewer without a pill.

**Pros:**
- Fewest edits.
- A future page that uses `TopBar` or `BrainstormUserMenu` gets the pill without being told.
- It sits literally beside the avatar menu everywhere.

**Cons:**
- A page that builds a fourth kind of avatar menu must remember to mount it. There are three kinds
  today: `BrainstormUserMenu`, the landing page's `UserMenu` and `Header`.
- It needs two scoped CSS accommodations at ≤ 440 px.

### Option B — Mount it in each top bar

`TopBar`, the fourteen own bars, the results header, `DevPage` and `Header`: about 18 edits.

- **Pro:** each placement is explicit.
- **Con:** every new page must remember it, and the fourteen copies drift.

### Option C — One global pill at the app root, fixed in the top right

- **Pro:** a single mount.
- **Con:** it cannot sit in five differently shaped bars beside their menus. It overlaps content.
  And outside the router it needs its own location tracking.

## Decision

We chose **Option A.**

It honours "in the top bar, beside the avatar menu" in every layout with four one-line mounts. It
puts all the rules in one component, and it rides the shared provider, so the pill and `/setup` read
the same snapshot (story 2 AC-4). The small-screen accommodations touch two hosts, only below 441 px
and only while a pill is showing. That is the least visible change that meets AC-5's "only ⚠ and
Finish setup → at 375 px, and no top bar scrolls".

**We trade away:**
- a fourth avatar-menu kind gets no pill automatically;
- on phones, while the pill shows, the Brainstorm Search `TopBar` wordmark and the control panel's
  role badge give up their room.

## Consequences

- **What this enables:** the persistent reminder on both halves of the app, from one component and
  one answer.
- **Load.** Every page now asks for the answer.
  - A signed-in viewer's first full page load, and each later one, makes one `/api/setup/status`
    request. SPA navigation reuses the answer.
  - A local hit costs two local scans. A local miss reads the configured outside relays, bounded at
    8 s.
  - The pill appears only once the answer is in, which is the confident rule, so it can show a few
    seconds after the page.
- **Ledger row `2026-09-21-relay-reader-socket-leak` matters more now.** Every signed-in page load
  can reach the relay reader on a local miss. (Row `2026-09-21-failed-strfry-scan-reads-empty` does
  not gain callers: this path uses the strict scan.)
- **Phones:**
  - In the results view, the pill hides together with the avatar menu (the existing collapse).
  - On `TopBar` pages at ≤ 440 px, the "Brainstorm" wordmark hides while the pill shows; the icon
    stays, as on the other Brainstorm bars.
  - In the control panel at ≤ 440 px, the OWNER/ADMIN badge hides while the pill shows.
  - Below 375 px, which AC-5 does not require, the control panel header can still be 26 px too wide
    (measured at 320 px). *Superseded by Amendment 1: the header fits from 320 px.*
- **ADR 0001 § 3, extended:** a new assistant for the same account is now also a reason to ask again
  (Decision 5).
- **Firmware reinstall required?** No.

## Implementation notes

### 1. `ui/src/components/SetupAlert.jsx` (new)

- **What it reads:** `useAuth()` for `{ user, loading }`, `useSetupStatus()` for `pendingCount`, and
  `useLocation()` for `pathname`.
- **Always call `useSetupStatus()`** (the rules of hooks). Mounting it is what asks for the answer.
  Signed out, the provider has no request and makes none (ADR 0001 § 3).
- **When it renders nothing:** `loading`, or `!user`, or `pendingCount < 1`, or
  `pathname === '/setup'`, or `pathname.startsWith('/setup/')`.
- **Markup.** One link, and nothing interactive inside it:

  ```jsx
  <Link to="/setup" className="bs-setup-alert" aria-label={SETUP_ALERT_COPY.name}>
    <span className="bs-setup-alert-icon" aria-hidden="true">⚠</span>
    <span className="bs-setup-alert-sentence">{SETUP_ALERT_COPY.sentence}</span>
    <span className="bs-setup-alert-count">{alertCountText(pendingCount)}</span>
    <span className="bs-setup-alert-button">{SETUP_ALERT_COPY.button}</span>
  </Link>
  ```

- **No close button,** and no state of its own.

### 2. The four hosts (one line each)

- **`BrainstormUserMenu.jsx`:** the signed-in return becomes a fragment, `<SetupAlert />` followed
  by the existing `.bs-usermenu` div. `.bsp-auth` is already a flex row with a gap (`styles.css`,
  `.bsp-auth`). The signed-out branch is unchanged.
- **`BrainstormSearch.jsx` `UserMenu`:** the same at its signed-in return (`:515`).
- **`Header.jsx`:** `<SetupAlert />` first inside `.header-auth`, ahead of the
  loading / signed-in / sign-in conditional. `styles.css` gains `.header-auth { display: flex;
  align-items: center; gap: 8px; }`, which it has no rule for today. *Amendment 1 also puts the
  brand's word in its own span.*
- **`DevPage.jsx`:** `<div className="bsp-auth"><SetupAlert /></div>`.

### 3. Copy: `ui/src/pages/setup/steps.js`

Story 2 § Copy, verbatim:
- `SETUP_ALERT_COPY = { name: 'Finish setting up your account', sentence: 'Finish setting up your account', button: 'Finish setup →' }`;
- `alertCountText(n)`, which gives "· 1 step left" or "· N steps left".

### 4. Styles: `ui/src/styles.css`, next to the `bs-setup-*` block

- **`.bs-setup-alert`:**
  - `inline-flex`, `align-items: center`, `white-space: nowrap`, `flex-shrink: 0`;
  - a rounded amber pill in the step badge's tones: the `rgba(210,153,34,…)` border and background,
    and `#e3b341` text;
  - no underline, and a visible `:focus-visible` outline.
- **`.bs-setup-alert-button`:** a solid amber inner chip with white bold text.
- **By width:**
  - `.bs-setup-alert-count` is hidden below 1024 px (Brainstorm's `lg`);
  - `.bs-setup-alert-sentence` is hidden below 640 px (Brainstorm's `sm`).
- **Only while a pill is showing, at `max-width: 440px`:**
  - `.bsp-top-bar:has(.bs-setup-alert) .bsp-logo > span { display: none; }` (the wordmark,
    `TopBar.jsx:34`);
  - `.app-header:has(.bs-setup-alert) .user-badge { display: none; }` (the role badge,
    `Header.jsx:139`).

  With both rules the prototype fits every host at 375 and 440 px, and the Implementer re-measures
  with the real styles. *Amendment 1 adds a third rule, for the control panel's brand.*

### 5. Provider freshness: `ui/src/context/SetupStatusContext.jsx:30`

This extends ADR 0001 § 3. The request key becomes:

```
`${pubkey}#${user?.assistantPubkey || '-'}#${attempt}`
```

**What happens:**
1. When `refreshUser()` reports a new assistant for the same account, the key changes.
2. The held answer no longer matches, so the phase is `checking` and the pill hides.
3. The effect fetches again, and the new answer counts step 1 as done.

No other trigger is added. Changes made in another app or tab still show on the next full page
load (story 2 § Out of scope). ADR 0001 § 3 is otherwise unchanged:
- the reset when the request goes away;
- the lazy start;
- one read per page load.

### 6. Unchanged

- The server.
- The `/setup` page.
- The avatar menus' links and contents (`avatarMenuLinks.js`).
- `AuthContext`.
- The My Assistant page.
- The results header's small-screen collapse.

### Notes for Test Design (Phase 3; the Tester owns every test change)

- **The B-class** runs on the built UI with canned `/api/setup/status` answers and story 1's
  `mockSession` helper.
- **Hosts:** `/tags` (`TopBar`), `/` (the landing), `/about` (an own bar), `/developers` (`DevPage`),
  `/tapestry/` (`Header`) and `/assistant`.
- **States:**
  - 1, 2 and 3 steps counted (singular and plural);
  - 0 counted, and so no pill;
  - still checking (a hanging read), and so no pill;
  - failed, and so no pill;
  - only an "another provider" step 3 left, and so no pill;
  - signed out, and so no pill;
  - `/setup` and `/setup/follow`, and so no pill.
- **Actions:** a click, and Tab then Enter, both reach `/setup`. The accessible name is checked.
- **Widths:** 1280 (sentence and count), 800 (sentence only), 375 (⚠ and the button only, and no top
  bar wider than the viewport).
- **Requests:** none other than GET.
- **AC-4:** for the same answer, the pill's N equals the number of steps `/setup` shows as not done,
  minus an "another provider" step.
- **Freshness (Decision 5):**
  - Behavioural if feasible: the My Assistant page's create flow with its endpoint mocked, and
    `user-classification` answering with an assistant afterwards. The pill's count drops without a
    reload.
  - Otherwise a source sentinel on the key.
- **The gate:** story 1's recipe, with the grep extended to the files this story touches
  (`BrainstormUserMenu`, `BrainstormSearch`, `Header`, `DevPage`, `SetupAlert`,
  `SetupStatusContext`). Triage the walkers against the branch, not only the story's files (ledger
  row `2026-09-21-abbreviated-path-names-no-gate`).

## Out of scope

- **Pages with no top bar** (the site-wide "Page not found") and the legacy dashboard.
- **Noticing changes made in another app or tab** before the next full page load.
- **Dismissing the pill.**
- **Brainstorm's "Trusted Lists update" pill.**
- **The avatar menus' own entries,** and the Dashboard.
- **Below 375 px.**

## Amendment 1 — the control panel's brand yields room instead of wrapping (2026-09-21)

**Raised by:** the Implementer, re-measuring with the real styles as § 4 asks. The owner chose to fix
it in this story, during Implementation.

**What the re-measurement found.** With the real styles, the pill is 143 px wide on phones, 333 px
with the sentence and 412 px in full. § 4's rules hold: no top bar scrolls horizontally at 356 px
or wider (the `TopBar` pages at 320 px or wider), so AC-5 is met. But while a pill shows, the
control panel's brand, "🧠 Tapestry" (`Header.jsx`, `.header-brand-name`), wraps onto two lines
whenever the header runs short of room, and the header grows from 55 to 71 px.

Measured on the built UI with every `/api` route mocked:
- every width from 320 to 1280 px, in 2 px steps;
- signed in as each role;
- with a 14-character and a 44-character display name.

| Where | The brand wraps at |
|---|---|
| every role, on phones | 320–392 px |
| just above § 4's 440 px rule, where the role badge returns | 442–448 (Owner), 442 (Admin), 442–466 (Customer), 442–444 (Guest) |
| Customers, where the sentence appears | 640–656 px |
| long display names, where the name appears (769 px) | 770–772 (Admin) to 770–794 (Customer) |

Without a pill, the brand never wraps. The prototype behind § 4 measured only horizontal overflow,
so it did not see this, and no test catches it.

**Decision.** One more rule of the same kind as § 4. It applies only while a pill shows, and only in
the control panel:
- **The brand never wraps.** Where room runs short, it truncates with an ellipsis ("🧠 Tapes…").
- **At `max-width: 440px` its word "Tapestry" hides and the 🧠 stays,** just as § 4 hides the
  `TopBar` wordmark and keeps its icon.

For the second rule, the word needs an element of its own. `Header.jsx`'s brand becomes
`🧠 <span className="header-brand-word">Tapestry</span>` inside `.header-brand-name`, with its text
unchanged. The CSS goes next to § 4's rules:

```css
.app-header:has(.bs-setup-alert) .header-brand { min-width: 0; }
.app-header:has(.bs-setup-alert) .header-brand-name { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 440px) {
  .app-header:has(.bs-setup-alert) .header-brand-word { display: none; }
}
```

**Measured with it**, using the same sweep with the rule injected into the built page:
- the header keeps its 55 px at every width from 320 to 1280 px, for every role and both name lengths;
- it never scrolls horizontally;
- the brand truncates only inside the ranges above, for example "🧠 Tape…" for a Customer at 450 px
  and "🧠 Tapes…" at 650 px.

**Consequences, updated:**
- The control panel header now fits from 320 px. The "26 px too wide below 375 px" line in
  § Consequences no longer holds.
- **On phones, while the pill shows,** the control panel reads: ☰, 🧠, the pill, and the avatar
  button. The role badge hides, per § 4.
- **The developer pages' bar grows by about 7 px when the pill appears.** Its auth slot was empty,
  and the pill is taller than the logo. This is accepted: it is the pill's own height, not a wrap.
  No other host's bar changes height.
- **Tests:** the Tester adds a browser check that, at those widths, the control panel header is
  the same height with the pill as without it, and never scrolls.
