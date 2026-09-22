# ADR 0002: One alert slot beside every avatar menu shows one pill at a time — the Setup Alert's first, then the Assistant Alert

**Status:** Accepted (Amendment 1 appended 2026-09-21: the Setup Alert shipped first, as its own component; the
two pills stand side by side and read the one setup answer)
**Date:** 2026-09-21
**Story:** `engineering-team/stories/done/assistant-management/2-the-assistant-alert.md`
(the slot it designs is also where setup-status-and-alert #2, the Setup Alert, will render; see
§ Decision 5. *Amendment 1: it shipped as its own component, beside the slot.*)

## Context

Story 2, in short:

- **AC-1:** An indigo pill in the top bar, beside the avatar menu, on every page outside
  `/tapestry` (the landing page included) and on every `/tapestry` page. On the developer pages it
  sits where the menu would be. It reads "Manage your Tapestry Assistant · N actions need
  attention" with a "Manage Assistant →" button, and it opens `/assistant`.
- **AC-2:** It is only for a signed-in viewer with an assistant on this instance.
- **AC-3, setup first:**
  - It waits while the setup status is checked.
  - It stays hidden while the Setup Alert would count a step.
  - It shows when the setup answer counts none, or when the setup check has failed.
  - The two pills never show together.
- **AC-4:** It is hidden on `/assistant` and every page under it, and it cannot be dismissed.
- **AC-5:** N is exactly the hub's count, from the same answer.
- **AC-6:** It has three widths: full; without the count; and at 375 px, mark and button only. Its
  accessible name stays the sentence, and no top bar scrolls sideways.
- **AC-7:** It is read-only, and asks nothing beyond sign-in and the shared setup status.

**The Setup Alert is not built.** setup-status-and-alert #2 is Approved and has no ADR. That
book's ADR 0001 left its story 2's ADR "only where the pill goes". The owner has since decided
where both pills stand relative to each other (book assistant-management § Decisions 2: one at a
time, setup first). This ADR therefore decides the shared place, and the Setup Alert plugs into it.
*Amendment 1: no longer true. The Setup Alert shipped first, as its own component.*

### Concept-graph orientation

None beyond ADR 0001: `39998:<TA>:nostr-user` has no property for an assistant. **No concept
changes, and no firmware reinstall.**

### Codebase facts this design rests on (verified on `383f99e5`)

**The shared setup answer.** `useSetupStatus()` (`ui/src/context/SetupStatusContext.jsx:72-82`)
returns `{ phase, refresh, answered, steps, doneCount, pendingCount }`:

- **`phase`** is one of:
  - `'idle'`: nothing has asked yet, or the viewer is signed out;
  - `'checking'`;
  - `'answered'`;
  - `'failed'`: a network error, a failure answer, or an expired session.
- **`pendingCount`** counts the steps that are confidently not done. `summarizeSetup` documents it
  as "what the alert counts" (`ui/src/utils/setupStatus.js:16-18`).
- **Mounting the hook is what asks.** The provider sits outside the router (`App.jsx:503-507`). It
  sends `GET /api/setup/status` once per signed-in account per full page load, only after some
  component wants the answer. It never polls (ADR setup-status-and-alert/0001).

**Where the avatar menus render.** Every top bar outside `/tapestry` draws its avatar menu
through one of two components. The Tapestry side has one header:

| Menu | Rendered by | Parent container |
|---|---|---|
| `BrainstormUserMenu` (`ui/src/components/BrainstormUserMenu.jsx:13`; signed-in root `div.bs-usermenu` at `:106`) | `TopBar.jsx:49-53`, the default auth slot for `/user/:pubkey`, `/tag/*`, `/tags`, `/pins`, `/pin/:dTag`, `/setup*` and `/assistant*`; and 14 pages with their own top bar (`BrainstormAbout`, `…AboutSearch`, `…Event`, `…Feed`, `…Followers`, `…Follows`, `…FollowsHops`, `…HowSearchWorks`, `…Muters`, `…Personalization`, `…Reporters`, `…Settings`, `…Skill`, `…UserNotes`) | `div.bsp-auth` everywhere, except `BrainstormSettings`, which uses `div.bss-auth`. Both are flex rows with a 0.5rem gap. `BrainstormSettings`' signed-out branch puts the menu straight in `.bss-top-bar`, but a signed-out viewer never gets a pill. |
| `UserMenu` inside `ui/src/pages/BrainstormSearch.jsx` (`:100`; signed-in root `div.bs-usermenu` at `:514-515`) | the landing page (`TopBar authMenu`, `:1099-1101`) and the results view (`:1446`) | `.bsp-auth` on the landing page; `.bs-results-header-right` (flex) on the results view. At ≤ 600px the results view hides that whole right side (`styles.css:3635-3637`). |
| `Header` (`ui/src/components/Header.jsx`; signed-in `div.header-user` inside `div.header-auth`) | `Layout.jsx:212`, the shell of every `/tapestry/*` page | `.header-auth` has no CSS rule of its own today. |
| none: `DevPage` (`ui/src/pages/developers/DevPage.jsx:41-46`) draws an empty `div.bsp-auth` | all five developer pages | `.bsp-auth` (flex) |

Browser suites click `.bs-usermenu-avatar-btn`, never the `.bs-usermenu` container
(`grep -rho "bs-usermenu[a-z-]*" tests`), so a sibling placed beside the menu does not move any
click target those suites use.

**Phone widths.** At 375 px:

- **Brainstorm bars.** `.bsp-top-bar` pads 1rem on each side at ≤ 600px (`styles.css:4033`).
  `TopBar`'s logo carries the word "Brainstorm" next to its image. Its nav holds "About".
- **Tapestry header.** It pads 12px at ≤ 768px (`styles.css:2476-2478`), and its user button shows the
  avatar, name, role badge and ▾.

Rough widths suggest that neither bar fits a "⚠ Manage Assistant →" pill without shedding some
of its own text. So the design says what gives way. The Implementer measures instead of trusting
these estimates.

## Options considered

### Option A: one slot component beside every avatar menu, choosing one pill through a pure picker (chosen)

- **What it is.** `TopBarAlert` renders at most one pill. A pure function `pickTopBarPill(…)`
  decides which: `'setup'`, `'assistant'` or none. The slot is mounted beside the avatar menu in
  four places: `BrainstormUserMenu`, `BrainstormSearch`'s `UserMenu`, `Header` and `DevPage`.
  Those four cover every top bar the story names.
- **Pros:**
  - "The two pills never show together" holds by construction: one slot renders one element.
  - The precedence rule lives in one pure function that Node can test.
  - Every future page that uses `TopBar` or `BrainstormUserMenu` gets the slot for free.
  - The Setup Alert needs no new mounts. It renders in the slot's `'setup'` branch. *(Amendment 1:
    it has its own mounts, beside the slot.)*
- **Cons:**
  - The menu components now render something beside themselves: a fragment in the two Brainstorm
    menus.
  - Until the Setup Alert exists, the `'setup'` branch renders nothing. It is a deliberate seam, and
    it is documented. *(Amendment 1: it renders nothing for good; the Setup Alert draws itself beside
    the slot.)*

### Option B: two independent pills, each mounted beside the menus

The Assistant pill hides itself whenever the setup count is above zero, and the Setup pill later
mounts itself separately.

- **Pros:** each pill is self-contained.
- **Cons:**
  - "Never both" becomes a convention split across two components written in two books. The owner's
    decision would then rest on each author remembering the other.
  - The same four mounts are needed twice.

### Option C: one app-level pill, fixed to the top-right corner

Rendered once, beside `RouterProvider`.

- **Pros:** one mount.
- **Cons:**
  - It cannot sit "beside the avatar menu" across four different top bars. The Tapestry header is
    fixed at 48px and scrolls with nothing. The Brainstorm bars vary. The results view has its own
    header. A fixed pill would overlap the avatar or the POV selector on some of them.
  - Beside `RouterProvider` there is no `useLocation`, so hiding it on `/assistant*` would need a
    new root layout route over every route.

*(Also rejected without a full write-up: mounting in each top bar rather than beside each menu.
That means about nineteen edits: `TopBar`, fourteen own-bar pages, the results header, `Header` and
`DevPage`. Every new page would also have to remember it.)*

## Decision

We chose **Option A**, because it makes the owner's rule, one pill at a time with setup first, a
property of the code rather than a promise, at the smallest set of mounts that reaches every top
bar in the story.

### Sub-decisions

**1. The picker: `ui/src/utils/topBarAlert.js`.** It is pure. Its only import is
`ASSISTANT_MANAGEMENT_PATH` from `../config/avatarMenuLinks.js`, with the `.js`, so Node suites can
load it the way they load `setupStatus.js`.

```js
export function isAssistantPath(pathname) {
  return pathname === ASSISTANT_MANAGEMENT_PATH || String(pathname || '').startsWith(`${ASSISTANT_MANAGEMENT_PATH}/`);
}

// Which one pill the top bar shows (story 2 § When the pill shows). Setup first: the Assistant pill waits
// for the setup answer, and gives way whenever the Setup Alert would count a step. `failed` falls through —
// the Setup Alert shows nothing then, so there is nothing to give way to.
export function pickTopBarPill({ signedIn, setupPhase, setupPendingCount, assistantCount, pathname }) {
  const none = { pill: null, count: 0 };
  if (!signedIn) return none;
  if (setupPhase !== 'answered' && setupPhase !== 'failed') return none;             // idle / checking: wait
  if (setupPhase === 'answered' && setupPendingCount > 0) return { pill: 'setup', count: setupPendingCount };
  if (assistantCount > 0 && !isAssistantPath(pathname)) return { pill: 'assistant', count: assistantCount };
  return none;
}
```

- **`isAssistantPath` is exact.** `/assistant`, `/assistant/` and anything under `/assistant/`
  match. `/assistants` or `/assistant-x` would not.
- **The `'setup'` result does not depend on the page.** The Setup Alert's own rule, hidden on
  `/setup` and its step pages, is its story's to add (§ 5).

**2. The slot: `ui/src/components/TopBarAlert.jsx`, default export `TopBarAlert()`.**

```jsx
export default function TopBarAlert() {
  const { user, loading } = useAuth();
  const setup = useSetupStatus();
  const { pathname } = useLocation();
  const { count } = assistantAttention(user);           // ADR 0001 sub-decision 1 — the hub's own answer
  const { pill, count: n } = pickTopBarPill({
    signedIn: !loading && !!user, setupPhase: setup.phase, setupPendingCount: setup.pendingCount,
    assistantCount: count, pathname,
  });
  if (pill === 'assistant') return <AssistantPill count={n} />;
  return null; // 'setup': the Setup Alert (setup-status-and-alert #2) renders here once it is built
}
```

*Amendment 1: the `'setup'` comment above no longer holds. That result now means "give way", and the
Setup Alert renders beside the slot, not in it.*

- `AssistantPill` is internal to the file.
- The slot takes no props. It must render inside the router, for `useLocation`. All four mounts do.
- It calls `useSetupStatus()` unconditionally, as hooks require. The provider asks nothing for a
  signed-out visitor.

**3. The pill: one link.**

```jsx
<Link to={ASSISTANT_MANAGEMENT_PATH} className="bs-topbar-pill is-assistant" aria-label={ASSISTANT_ALERT_COPY.name}>
  <span className="bs-topbar-pill-mark" aria-hidden="true">⚠</span>
  <span className="bs-topbar-pill-text" aria-hidden="true">{ASSISTANT_ALERT_COPY.sentence}</span>
  <span className="bs-topbar-pill-count" aria-hidden="true">· {attentionCountText(n)}</span>
  <span className="bs-topbar-pill-button" aria-hidden="true">{ASSISTANT_ALERT_COPY.button}</span>
</Link>
```

- **The copy** lives in `ASSISTANT_ALERT_COPY` (`actions.js`, ADR 0001):
  - `name` and `sentence`: "Manage your Tapestry Assistant";
  - `button`: "Manage Assistant →".
- **The count text** comes from the same `attentionCountText` as the hub's count line, so the page
  and the pill cannot word the number differently (AC-5).
- **Why a link.** It is navigation, so it is an `<a href>`: click and Enter work (AC-1), and it can
  open in a new tab. The accessible name is the sentence alone, via `aria-label`, as with
  Brainstorm's pill.
- **It has no close control** (AC-4).

**4. Mounts, and what each file gains.**

- **`BrainstormUserMenu.jsx`:** the signed-in `return` becomes
  `<><TopBarAlert /><div className="bs-usermenu" ref={menuRef}>…</div></>`. The signed-out button is
  unchanged.
- **`BrainstormSearch.jsx`, `UserMenu`'s signed-in `return` (`:514`):** the same fragment. This
  covers the landing page and the results view in one edit.
- **`Header.jsx`:** in `.header-auth`'s signed-in branch, `<><TopBarAlert /><div className="header-user" …>…</div></>`.
  A new CSS rule makes it a row: `.header-auth { display: flex; align-items: center; gap: 8px; }`.
  Today it holds one child, so the row changes nothing else. *(Amendment 1: the Setup Alert brought
  the same rule; its copy is the one kept.)*
- **`DevPage.jsx`:** `<div className="bsp-auth"><TopBarAlert /></div>`. `DevPage` needs no
  `useAuth` of its own, because the slot reads it.

**5. Hand-off to setup-status-and-alert #2 (the Setup Alert).** *Superseded by Amendment 1.*

- **Where it renders.** The Setup pill renders in this slot's `'setup'` branch, with
  `count = setupPendingCount`, and adds its own rule that hides it on `/setup` and its step pages.
  Styling it takes one modifier on the shared base, `.bs-topbar-pill.is-setup`, in amber.
- **What its ADR may do.** It may reshape the slot. It must keep "one pill at a time, setup first",
  which is the owner's decision, not this ADR's.
- **Where this is written down.** The implementation adds a "Changes from outside this book" entry
  to `engineering-team/audits/setup-status-and-alert/book.md` saying so. That is where that book's
  next session will look.

**6. Look and widths, in `ui/src/styles.css`.** Add one block, "Top-bar alert pill
(assistant-management #2)". *Amendment 1 replaces the shape and the widths, and moves the nav
step below 360 px.*

- **Shape.** `.bs-topbar-pill` is an inline-flex, one-line (`white-space: nowrap`) rounded pill,
  about 30px tall, so it fits inside the Tapestry header's 48px and the Brainstorm bars.
  `.bs-topbar-pill-button` is a small filled chip at its end.
- **Colour.** `.is-assistant` takes Tapestry's indigo, a family already in use (`#6366f1`,
  `#a5b4fc`, `#c7d2fe`): a light border, a faint fill and a solid indigo button. The mark ⚠ inherits
  the text colour. The pill is never amber, because amber is the Setup Alert's.
- **Widths.**
  - Above 900px, every part shows.
  - At ≤ 900px, `.bs-topbar-pill-count` is hidden.
  - At ≤ 480px, `.bs-topbar-pill-text` is hidden too: mark and button only (AC-6).
- **What the bar sheds at ≤ 480px.** Only while a pill is present, scoped with `:has(.bs-topbar-pill)`
  so no other page changes, the top bar gives up text in this order until nothing scrolls:
  - Brainstorm bars: `TopBar`'s logo word ("Brainstorm"; the image stays), then `.bsp-top-nav`;
  - the Tapestry header: `.user-name` and `.user-badge`, then `.dropdown-arrow`, then the word
    "Tapestry" in the brand, which is wrapped in its own `<span>` so the 🧠 stays.

  The Implementer measures and records in the story's Deviations which steps were needed. The
  measurement is `document.documentElement.scrollWidth <= clientWidth` at 375 px, with the pill
  showing, on `/`, `/tags`, `/about`, `/settings`, `/developers` and `/tapestry/`.

## Consequences

- **A new request on every page.** For a signed-in viewer, every full page load now asks
  `/api/setup/status` once. Before, only `/setup` asked it. It is the request the Setup Alert will
  make anyway, not a new endpoint, and there is no polling. The cost is the server's setup check,
  which reads outside relays only when this instance's relay lacks the viewer's kind 3 or kind
  10040 (ADR setup-status-and-alert/0001). A signed-in viewer with no assistant makes it too, because
  the slot also decides the Setup pill. That keeps the slot simple, and the Setup Alert needs the
  answer for exactly those viewers.
- **Until the Setup Alert ships, viewers with setup steps left see no pill at all.** Story 2 records
  this as expected. *Superseded by Amendment 1: it has shipped.*
- **The pill is persistent.** With all ten actions counted, a signed-in viewer who has an assistant
  and no setup left sees it on every page except `/assistant*`. The owner accepted this for
  staging. Whether it goes to production before the real checks exist is a promotion call
  (story 2 § Out of scope).
- **Not on phone search results.** On the results view at ≤ 600px, the existing rule that hides the
  header's right side hides the avatar menu, and with it the pill. The same holds for the Setup
  Alert. It is not changed here.
- **Wider menus.** The menu components now render a sibling. Any future caller that places
  `BrainstormUserMenu` outside a flex row should give it one.
- **Shared names.** The pill's base class and the slot are shared with the other book. Renaming
  them later touches both. *(Amendment 1: no longer true. The Setup Alert has its own component and
  its own `.bs-setup-alert` class. What the two books share is the setup answer, and the dependency in
  Amendment 1 point 3.)*
- **Firmware reinstall required?** No.

## Implementation notes

**New files:**

- `ui/src/utils/topBarAlert.js`: `isAssistantPath`, `pickTopBarPill` (sub-decision 1).
- `ui/src/components/TopBarAlert.jsx`: the slot and `AssistantPill` (sub-decisions 2–3).

**Changed:**

- `ui/src/components/BrainstormUserMenu.jsx`, `ui/src/pages/BrainstormSearch.jsx` (`UserMenu`),
  `ui/src/components/Header.jsx`, `ui/src/pages/developers/DevPage.jsx`: one mount each
  (sub-decision 4). `Header.jsx` also wraps the brand's word in a `<span>` (sub-decision 6).
- `ui/src/styles.css`: the pill block, the `.header-auth` row, and the `:has()` shedding rules
  (sub-decisions 4 and 6).
- `engineering-team/audits/setup-status-and-alert/book.md`: its "Changes from outside this book"
  entry (sub-decision 5).

The copy (`ASSISTANT_ALERT_COPY`) and the count (`assistantAttention`, `attentionCountText`) come
from ADR 0001's `actions.js`. This story adds no copy module of its own.

**Test-file changes this ADR requires (Phase 3, Tester):**

- A Node suite over `pickTopBarPill` and `isAssistantPath`. The table of cases follows story 2
  § When the pill shows and AC-3:
  - signed out;
  - each setup phase;
  - `pendingCount` 0 and above 0;
  - `failed`;
  - `assistantCount` 0;
  - `/assistant`, `/assistant/`, `/assistant/profile/edit`, `/assistants`;
  - an ordinary page.
- Source-shape checks that each of the four mounts renders `TopBarAlert`, and that nothing else
  renders the pill.
- A browser suite for AC-1–AC-7:
  - the pill's words, link and accessible name;
  - hidden for signed-out viewers and for viewers with no assistant;
  - setup first, including hidden while the setup answer is pending, which needs a stubbed, delayed
    `/api/setup/status`;
  - hidden on `/assistant*`;
  - the three widths, and no horizontal scroll;
  - a signed-in load that publishes nothing.

  Stubbing sign-in and `/api/setup/status` follows the patterns in
  `tests/brainstorm/setup-status.spec.js`.

**Checks at implementation.** The 375 px measurement in sub-decision 6. A live pass with the owner's
session is not needed: stubbed sign-in covers the states (AGENTS.md; `/cycle-local`).

## Out of scope

- **The Setup pill itself.** It is setup-status-and-alert #2, which renders into this slot
  (sub-decision 5). *Amendment 1: beside this slot, not into it.*
- Real "needs attention" answers (ADR 0001 § Consequences; `stories/_intake.md`, entry 2026-09-21).
- Dismissing the pill, and noticing changes made elsewhere before the next full load.
- Pages without a top bar: the site-wide "Page not found", and `/legacy/`.

## Amendment 1: the Setup Alert shipped first, as its own component; the two pills stand side by side (2026-09-21)

**Raised by:** the Reviewer (review 2, Blocking 1 and 2). The owner approved the fix plan on 2026-09-21:
merge the shared line, keep both components side by side, and amend this ADR.

**What changed under this ADR.** setup-status-and-alert #2 merged to staging (PR #737, `6754a16a`) before
this story reached Review. Its ADR, setup-status-and-alert/0002, never saw this one. It shipped:
- `ui/src/components/SetupAlert.jsx`, a self-contained pill, mounted at the same four places as this slot;
- its own CSS: `.bs-setup-alert`, the same `.header-auth` row (`styles.css:672`), `:has(.bs-setup-alert)`
  shedding at ≤ 440 px, and its Amendment 1's rules that stop the control panel's brand wrapping.

So these no longer hold:
- § Context's "The Setup Alert is not built";
- Option A's "needs no new mounts", and its con that the `'setup'` branch renders nothing until the
  Setup Alert exists;
- sub-decision 2's comment that the Setup Alert "renders here once it is built";
- sub-decision 5;
- the § Consequences lines "Until the Setup Alert ships…" and "Shared names".

Each carries an italic pointer here. The branch merged `origin/staging` at
`fc7021f2`.

**Decision: side by side, the Setup Alert first.** This is Option B, which § Options rejected because
"never both" would rest on two components agreeing. It is chosen now because the Setup Alert is reviewed and
shipped. Moving it into this slot, review 2's choice (a), would reopen a Done story in another book, re-aim its
suites and restyle it. That would only buy a property the shared answer already gives (point 3).

1. **Mounts.** Each of the four hosts renders `<SetupAlert />` and then `<TopBarAlert />`, before its menu:
   - the two Brainstorm menus return `<><SetupAlert /><TopBarAlert />{menu}</>`;
   - the Tapestry header puts both first in `.header-auth`;
   - `DevPage` puts both in `.bsp-auth`.
2. **The picker is unchanged.** Its `'setup'` result now means "give way": the slot draws nothing, and the
   Setup Alert draws itself beside it.
3. **Why the two never show together.** Both read the one answer from `SetupStatusProvider`, in the same
   render:
   - the Setup Alert shows only when someone is signed in, `pendingCount` is at least 1, and the page is not
     `/setup` or under it (`SetupAlert.jsx:24-25`);
   - `pendingCount` is 0 unless the phase is `answered`: `useSetupStatus` summarizes `null` in every other
     phase (`SetupStatusContext.jsx:82`, `setupStatus.js:20-36`);
   - so whenever the Setup pill shows, `pickTopBarPill` returns `'setup'` and the slot draws nothing. On
     `/setup` with a step left, neither shows: the Setup pill by its own rule, the Assistant pill because setup
     comes first.

   This holds by the shared answer, not by one element, so it depends on the Setup Alert keeping its rule. If
   that pill ever showed on another condition, such as while the check runs or after it fails, the two could
   show together. The dependency is written into the Setup Alert's book, and browser B3 now observes both
   pills (§ Tests below).
4. **Widths, re-measured with both components in the build.** B9, a new width sweep, ran on the merged build
   before any fix: every `/api` route mocked, a Customer with a 29-character name.

   | Where | Found |
   |---|---|
   | `TopBar` pages (`/`, `/tags`) at 560 px | a 91 px sideways scroll: the count had gone (≤ 900 px), but the sentence stayed until 480 px |
   | the same at 656 px | 3 px |
   | the same at 320 px | 24 px (review 2, Non-blocking 1) |
   | `/tapestry/` at 560, 656, 700 and 800 px | the fixed header grew from 55 to 71 px: the brand rules of setup-status-and-alert/0002 Amendment 1 key on `.bs-setup-alert` only |
   | `/developers`, at every width | the bar grows 8 px (39 → 47 px on narrow screens, 47 → 55 px on wide ones): the pill's own height beside a small logo |

   Decision:
   - **The Setup Alert's shape and size.** `.bs-topbar-pill` takes `.bs-setup-alert`'s paddings, gap and line
     height, and its button takes the Setup Alert button's padding, instead of fixed 30 px and 22 px heights.
     Story 2 § Copy asked for this ("Its shape and size match the Setup Alert's"), and it removed the 3 px at
     656.
   - **The count hides at ≤ 1023 px,** the Setup Alert's breakpoint (Brainstorm's lg).
   - **The sentence hides at ≤ 679 px, not at the Setup Alert's 639.**
     - This pill's button, "Manage Assistant →", is longer than "Finish setup →": at 640 px the pills are
       379 px and 333 px wide.
     - With the sentence showing, the `TopBar` pages need 652 px. At 640 they scroll 12 px, measured in 2 px
       steps (the first fix, at 639, left this).
     - 679 leaves 28 px for fonts wider than the ones measured here.
     - The owner kept 679 (2026-09-21) over shortening the button's approved words.
   - **The control panel's brand rules fire for either pill:** `.app-header:has(.bs-setup-alert, .bs-topbar-pill)`.
     Sub-decision 6's ≤ 480 px rules for this pill stay.
   - **`TopBar`'s nav hides below 360 px** (`max-width: 359px`).
     - This is sub-decision 6's own second step. It is needed only below 352 px: 31 px at 320, 1 px at 350.
     - 360 px, a common phone width, keeps the About link.
     - Neither avatar menu links to About, so below 360 px the bar offers no way to it while the pill shows.
   - **One `.header-auth` rule:** the Setup Alert's, at `styles.css:672`. This block's copy goes.

   **Measured with it:** B9, now on both sides of every breakpoint (19 widths from 320 to 1280 px), on `/`,
   `/tags`, `/about`, `/settings`, `/developers` and `/tapestry/`:
   - nothing scrolls sideways;
   - the control panel header stays 55 px with the pill.

   A scratch probe at 25 widths near each edge agrees.
5. **The Setup Alert's own suite.** The editor moved (ADR 0001), so two tests in
   `tests/brainstorm/setup-alert.spec.js` open `/assistant/profile/edit` instead of `/assistant`: its host row,
   and B9, which creates an assistant there.

**Consequences, updated:**
- **"Never both"** comes from the shared answer plus the Setup Alert's rule. It is pinned by browser B3 with both
  pills in the build:
  - a step left shows the Setup pill and not this one;
  - late answers are checked both ways;
  - at most one pill shows at any sampled moment.

  Node P3 and P8 pin the picker's side.
- **The precedence still lives in one pure function.** The Setup Alert does not consult it, and does not need
  to.
- **The developer bar grows 8 px when either pill appears.** This is accepted, as setup-status-and-alert/0002
  Amendment 1 accepted it for its pill: it is the pill's own height, not a wrap, and that bar is not fixed.
- **Below 360 px, on `TopBar` pages,** the About link hides while the pill shows.
- **Between 640 and 679 px** the Setup pill shows its sentence and this one does not. The two never show
  together, so no bar mixes the two looks.
- **Firmware reinstall required?** No.

**Implementation notes:**
- `ui/src/styles.css`, in the pill block:
  - the shape;
  - the 1023 and 679 px breakpoints;
  - the `max-width: 359px` nav rule;
  - the brand selectors;
  - this block's `.header-auth` copy, removed.
- `ui/src/components/TopBarAlert.jsx`: its comments say the slot gives way to the Setup Alert, not that it
  hosts it.
- Records:
  - the "Changes from outside this book" note in `engineering-team/audits/setup-status-and-alert/book.md` says
    what the merged code does, and names point 3's dependency;
  - story 2 and its test plan get dated notes where they say the Setup Alert is unbuilt.
- The four mounts were resolved in the merge, `fc7021f2`.

**Tests (Tester):**
- B3 observes the real Setup pill.
- B9 is new (point 4).
- `setup-alert.spec.js` is re-aimed (point 5), and story 1's test plan lists it among the re-aimed suites.
