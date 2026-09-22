# ADR 0001: The Assistant Management page takes `/assistant`, one data module feeds it and its ten placeholder pages, and the profile editor moves to `/assistant/profile/edit`

**Status:** Accepted
**Date:** 2026-09-21
**Story:** `engineering-team/stories/done/assistant-management/1-the-assistant-management-page.md`
**Supersedes in part:** ADR assistant-profile/0004, only its route and what points there. That
ADR's sub-decision 1 put the page at `/assistant` under the heading "🤖 My Assistant". Sub-decision 3
sent "Assistant Management", the old Settings address and the `/settings` card there. Everything
else in 0004 stands: the one predicate, the editor's behaviour, and "`AssistantProfileEditor` is
imported only by the page". The same goes for ADR assistant-profile/0005: only the address and name
it gives the one writer's page change (sub-decision 6). Its rules stand.

## Context

Story 1, in short:

- **AC-1:** `/assistant` is a `/setup`-style page. It has a kicker and a heading, three section
  headings, and ten action cards in the order given in the story.
- **AC-2:**
  - A signed-in viewer with an assistant sees every card marked "Needs attention" and the line "10
    actions need attention".
  - A signed-out visitor sees no marks and a sign-in line.
  - A signed-in viewer with no assistant sees no marks and a line linking to `/setup`.
  - While sign-in resolves, neither line shows.
- **AC-3:** Every card is a real link. Three cards carry NIP links that open in a new tab without
  also opening the card.
- **AC-4:** A "Frequently asked questions" section sits above the first section. It is closed on
  every load, and it toggles by click, Enter and Space, announcing its state.
- **AC-5:** There are ten placeholder pages. Each has the heading, "Placeholder page.", the
  description, the alert criteria ("Not yet defined." where none), planning notes where given, and
  a back link. The profile page also links to the editor.
- **AC-6:** The editor moves to `/assistant/profile/edit`:
  - its heading becomes "Edit Assistant Profile", and it gets a back link to `/assistant/profile`;
  - every editor entry point follows it;
  - "Assistant Management" stays on `/assistant`.
- **AC-7:** All twelve addresses load directly with no "Page not found", on staging too. None
  scrolls sideways at 375 px. The hub and the action pages make no request of their own and write
  nothing.

### Concept-graph orientation

The local graph (TA `8387ec0e…`) answers `/summaries` with `nostr-user`, `tag`, `nostr-user-tag`,
`tag-pinning` and `list`, the handles the story names for orientation.
`/node/39998:<TA>:nostr-user/neighbors` shows only class-thread wiring: superset, JSON schema,
primary property, properties set, and the concept, core-nodes and property-tree graphs. No
property models an assistant or its actions. As the story expects, this is navigation and
presentation. **No concept changes, and no firmware reinstall.**

### Codebase facts this design rests on (verified on `383f99e5`, `origin/staging` after assistant-profile #5 merged)

- **The editor page today** is `ui/src/pages/assistant/Index.jsx` (68 lines, `MyAssistantPage`):
  - it renders `<TopBar />` and a `main.bs-assistant-main`, with an `h1` "🤖 My Assistant";
  - it has four states from `useAuth()`, gated by `hasMyAssistantPage` and `mayCreateAssistant`,
    both from `ui/src/config/avatarMenuLinks.js`;
  - it is routed at `path: '/assistant'` (`ui/src/App.jsx:249-252`).
- **One constant already names the editor's address:** `MY_ASSISTANT_PATH = '/assistant'`
  (`avatarMenuLinks.js:30`). Its consumers:

  | Consumer | Where | What it is |
  |---|---|---|
  | `personalLinks` → "My Assistant's Profile" | `avatarMenuLinks.js:74` | both avatar menus, since both render this list |
  | `accountLinks` → "Assistant Management" | `avatarMenuLinks.js:118` | both avatar menus |
  | the Dashboard | `ui/src/pages/Dashboard.jsx:735`, `:750` | the setup prompt and the checklist item |
  | the banner | `ui/src/pages/users/UserDetail.jsx:105` | "✏️ Edit Assistant profile →" |
  | the Settings tab | `ui/src/pages/settings/Index.jsx:19` | "🤖 Assistant Profile" |
  | the `/settings` card | `ui/src/pages/BrainstormSettings.jsx:481` | "🤖 Open My Assistant" |

  Inside the React app, the one editor link that does not use the constant is the old-address
  redirect `{ path: 'settings/assistant', element: <Navigate to="/assistant" replace /> }`
  (`App.jsx:467`), which is a literal.
- **Outside the React app, the editor's address is written out by hand in six places:** three
  server messages, two legacy-page links and one BIBLE sentence. Two more sentences name the page
  without its address. assistant-profile #5 (one writer; ADR assistant-profile/0005) merged to
  staging as PR #733 while this ADR was being drafted, and added all of them. None of them can
  import the UI constant:

  | Where | What it says today | Seen by |
  |---|---|---|
  | `src/api/assistant/index.js:48-49` (`NOT_YOUR_ASSISTANT`) | "…signed in, on the My Assistant page (/assistant)." | anyone whose publish is refused, as a 403 `error` |
  | `src/api/assistant/index.js:50-52` (`NO_CONTENT`) | "…Edit and publish your assistant's profile on the My Assistant page (/assistant). …" | a 400 `error` |
  | `src/api/strfry/commands/publishEvent.js:14-15` (`ASSISTANT_PROFILE_REFUSAL`) | "…published only on the My Assistant page (/assistant)." | a 403 `error` from the generic endpoint |
  | `public/pages/nip85.html:75`, `:107` | a sentence, and `<a href="/assistant">🤖 Edit and publish its profile on the My Assistant page →</a>` | the legacy NIP-85 page's read-only assistant panel |
  | `public/pages/customers/customer.html:132`, `:167` | the same sentence and link | the legacy customer page's panel |
  | `BIBLE.md:1072` | "…which the My Assistant page (`/assistant`) calls." | readers of the spec |

  Code comments in those files and in `ui/src/` also say "the My Assistant page". Find them with
  `git grep -n "My Assistant page"`.
- **The `/setup` pattern this copies**, `ui/src/pages/setup/`:
  - `steps.js` holds the data and the copy. It has no imports, so Node suites load it as ESM:
    `ui/package.json` has `"type": "module"`, and the suites `import(pathToFileURL(…))`, as
    `test/setup-status.test.js:188` does.
  - `Index.jsx` is the hub, and `Placeholders.jsx` holds one component per step.
  - The styles are the `bs-setup-*` block (`ui/src/styles.css:8465-8652`): kicker, title with
    accent, cards (`.bs-setup-step`, whose whole card is one `<Link>`), the amber
    `.bs-setup-step-badge`, `.bs-setup-signin`, `.bs-setup-back`, and the dashed
    `.bs-setup-placeholder`.
- **Deep links need no server change:**
  - The SPA catch-all (`bin/control-panel.js:346-350`) serves `dist/index.html` for every path
    that is not under `/api/`.
  - The probe filter before it (`isBlockedProbePath`, `src/utils/siteTrust.js:166`) refuses only
    dot segments and listed file extensions. None of the twelve addresses contains a dot.
  - No Express route or static directory claims `/assistant` (`ui/public/` holds four files; only
    `/api/assistant/*` routes exist).
  - `/setup/create-account` already proves the nested case on staging.
- **Nested links are invalid HTML.** An `<a>` inside an `<a>` is not allowed, and React warns
  about it (`validateDOMNesting`). The `/setup` card is a single `<Link>`, so that shape cannot
  hold the NIP links AC-3 asks for.

## Options considered

### Option A: one data module; flat routes generated from it; the editor keeps its constant's name at a new value (chosen)

- **`ui/src/pages/assistant/actions.js` is the single source.** It holds the three sections, the
  ten actions (address, title, description, alert criteria, notes), the FAQ, the page copy, and
  `assistantAttention(user)`, the one answer to "which actions need attention for this viewer".
  The hub renders it, `App.jsx` generates the ten placeholder routes from it, and the pill (ADR
  0002) counts it.
- **`MY_ASSISTANT_PATH` keeps its name.** Its value becomes `'/assistant/profile/edit'`. A new
  `ASSISTANT_MANAGEMENT_PATH = '/assistant'` names the hub, and "Assistant Management" switches to
  it.
- **Pros:**
  - Inside the app, the six editor entry points follow the editor with no edit, because each
    already imports the constant. AC-6's "every link … leads to `/assistant/profile/edit`" then holds
    by construction there. The hand-written addresses outside the app still need their own edits
    (sub-decision 6).
  - A card, its page and its route cannot drift apart.
  - assistant-profile #5's React code (`Dashboard.jsx`) already uses the constant, and keeps working
    unchanged.
- **Cons:** the constant's name, `MY_ASSISTANT_PATH`, now names a page headed "Edit Assistant
  Profile". The avatar item it serves is still "My Assistant's Profile", and the doc comment says
  what it points at.

### Option B: rename the constant

As A, but `MY_ASSISTANT_PATH` becomes `ASSISTANT_PROFILE_EDIT_PATH` at all its call sites.

- **Pros:** the name matches the new heading.
- **Cons:**
  - Twelve more source edits across five files, including code assistant-profile #5 just shipped.
    Every test regex that names the constant changes too, across three books' suites.
  - A missing export breaks the Vite build, not a unit test. So any branch still open against the
    old name breaks the staging deploy build at merge.
  - It buys a name, and nothing a user sees.

### Option C: a nested route tree under `/assistant`

One layout route with `<Outlet />` for the hub, the placeholders and the editor, which share the
top bar and the column.

- **Pros:** the chrome is written once.
- **Cons:**
  - No Brainstorm-side page uses a layout route. They are all flat entries, `/setup` included.
  - The hub, the placeholders and the editor need different columns: the editor keeps
    `.bs-assistant-main`, the others take `.bs-setup-main`.
  - It adds a routing pattern to save about ten lines of repeated chrome.

## Decision

We chose **Option A**. The data module makes the ten actions a list rather than ten hand-written
pages, which is what "8 or 9 (and growing)" will need. Keeping the constant's name turns the
editor's move into a value change at a single definition inside the app, instead of a rename
across five files and the story that just shipped. The cost is one name that says "my assistant" where the heading now says "edit
assistant profile", which the doc comment covers.

### Sub-decisions

**1. The data module, `ui/src/pages/assistant/actions.js`.** It is pure, and imports only
`../../config/avatarMenuLinks.js` (with the `.js`, so Node can load it; that module has no imports).
It exports:

| Export | Shape |
|---|---|
| `ASSISTANT_SECTIONS` | `[{ key, heading }]` × 3, in story order: `persona`, `trusted-content`, `notifications` |
| `ASSISTANT_ACTIONS` | `[{ key, section, path, title, description, alertCriteria, planningNotes, editLink? }]` × 10, in story order |
| `ASSISTANT_PROFILE_PATH` | `` `${ASSISTANT_MANAGEMENT_PATH}/profile` `` |
| `NIP_LINKS` | `{ trustedAssertions, trustedLists, decentralizedLists }`: the three URLs in story § Copy |
| `ASSISTANT_FAQ` | `[{ question, answer }]` × 5, answers as plain strings |
| `ASSISTANT_COPY` | every other string of story § Copy: kicker, heading (in two parts, see 3), lines, labels, headings |
| `ASSISTANT_ALERT_COPY` | the pill's words (ADR 0002), kept with the rest of this book's copy, as `steps.js` does for `/setup` |
| `attentionCountText(n)` | `'1 action needs attention'`, or `` `${n} actions need attention` `` |
| `assistantAttention(user)` | `{ hasAssistant, needsAttention: string[], count }` |
| `plainText(parts)` | a description's words as one string, for tests and any plain-text use |

**What the data holds:**

- **Paths** are built from `ASSISTANT_MANAGEMENT_PATH`: `/assistant/profile`,
  `/assistant/identification-tags`, `/assistant/trusted-assertions`, `/assistant/trusted-lists`,
  `/assistant/dlists`, `/assistant/bounties`, `/assistant/pins`, `/assistant/tags`,
  `/assistant/notifications-and-alerts`, `/assistant/preferences`.
- **A description** is an array of parts. A part is either a string or
  `{ text, href }`. For example, trusted-assertions is
  `['Enable Tapestry to broadcast trust scores using ', { text: 'NIP-85 Trusted Assertions', href: NIP_LINKS.trustedAssertions }, ', curated by …']`.
- **`alertCriteria` and `planningNotes`** are strings, or `null` where the owner gave none. The
  placeholder page shows `ASSISTANT_COPY.notYetDefined` for a `null` criteria, and leaves out the
  notes section for `null` notes.
- **Only the profile action has an `editLink`:**
  `{ text: "Edit your Assistant's profile →", to: MY_ASSISTANT_PATH }`.
- **All words are the story's § Copy verbatim**, with its display fixes applied (straight
  apostrophes, "follows (kind 3)").

**The attention answer:**

```js
// The one answer to "which of the viewer's actions need attention" (story 1 AC-2; the pill, ADR 0002,
// counts it). A scaffold: every action, for a viewer who has an assistant on this instance — sign-in's
// user.assistantPubkey, the getAssistantPubkeyFor answer that also marks /setup's first step done.
export function assistantAttention(user) {
  const hasAssistant = Boolean(user && user.assistantPubkey);
  const needsAttention = hasAssistant ? ASSISTANT_ACTIONS.map((a) => a.key) : [];
  return { hasAssistant, needsAttention, count: needsAttention.length };
}
```

When a later session makes these answers real, this function, or whatever replaces it, stays the
one source for both the hub and the pill.

**2. The routes, in `ui/src/App.jsx`.** These replace today's `/assistant` entry at `:249-252`, in
the same place:

```jsx
{ path: ASSISTANT_MANAGEMENT_PATH, element: <AssistantManagementPage /> },
{ path: MY_ASSISTANT_PATH, element: <EditAssistantProfilePage /> },
...ASSISTANT_ACTIONS.map((action) => ({ path: action.path, element: <AssistantActionPage action={action} /> })),
```

The `/tapestry` child redirect at `:467` becomes `<Navigate to={MY_ASSISTANT_PATH} replace />`, and
its comment names the new page. Every route is a static path. React Router ranks
`/assistant/profile` and `/assistant/profile/edit` independently, so neither shadows the other.

**3. The hub: `ui/src/pages/assistant/Index.jsx`, `AssistantManagementPage`.** This is a new file.
The editor's code leaves it (sub-decision 6).

**Structure.** It renders `<TopBar />`, then `main.bsp-content.bs-setup-main`:

1. `p.bs-setup-kicker` "Assistant Management".
2. `h1.bs-setup-title`: "Manage the Profile and Capabilities of " followed by
   `<span class="bs-setup-title-accent">your Tapestry Assistant</span>`. The accent sits where
   `/setup` accents "your account". The heading's text is the owner's sentence, unchanged.
3. **The status line.** It comes from `useAuth()` (`user`, `loading`, `login`) and
   `assistantAttention(user)`, and nothing else:
   - `loading`: nothing.
   - Signed out: `div.bs-setup-signin` with the signed-out line and a "Sign in with nostr" button
     calling `login().catch(() => {})`, as `/setup` does.
   - Signed in, `!hasAssistant`: `div.bs-setup-signin` with the no-assistant line and
     `<Link to="/setup">Go to Account Setup →</Link>`.
   - Signed in, `hasAssistant`: `p.bs-assistant-hub-count` with `attentionCountText(count)`.
4. **The FAQ** (sub-decision 5).
5. **One `<section aria-labelledby>` per `ASSISTANT_SECTIONS` entry.** Each has an `h2` and a
   `ul.bs-assistant-hub-cards` of that section's actions, in array order.

**The hub makes no request.** It reads only the sign-in state `AuthProvider` already holds (AC-7).

**4. A card is a stretched link.** A single-`<Link>` card cannot contain the three NIP links
(nested `<a>`). Instead each card is:

```jsx
<div className={`bs-assistant-hub-card${marked ? ' needs-attention' : ''}`}>
  <span className="bs-assistant-hub-card-marker" aria-hidden="true">{marked ? '!' : ''}</span>
  <div className="bs-assistant-hub-card-body">
    <div className="bs-assistant-hub-card-head">
      <Link to={action.path} className="bs-assistant-hub-card-link">
        {marked && <span className="bs-sr-only">Needs attention: </span>}{action.title}
      </Link>
      {marked && <span className="bs-setup-step-badge" aria-hidden="true">Needs attention</span>}
    </div>
    <p className="bs-assistant-hub-card-text"><ActionText parts={action.description} /></p>
  </div>
  <span className="bs-assistant-hub-card-chevron" aria-hidden="true">›</span>
</div>
```

**How it behaves:**

- **The whole card opens the page.** The link's `::after` covers the card
  (`position: absolute; inset: 0`, with the card `position: relative`). A click anywhere on the
  card, including a middle-click or a modified click, is a click on the real `<a href>`, so the card
  opens in a new tab like any link (AC-3).
- **The NIP links sit above the overlay.** They take `position: relative; z-index: 1`, so a click
  on one follows only that link. `ActionText` renders them with `target="_blank"` and
  `rel="noopener noreferrer"`.
- **Keyboard:** Tab reaches the card's link, then any NIP links inside it. Enter on the card's link
  opens its page.
- **Focus:** the link draws no outline of its own. Its `::after` takes the ring
  (`outline: 2px solid #a5b4fc; outline-offset: 2px`, as `.bs-setup-step:focus-visible` does), so
  the whole card shows focus.
- **The visible badge is `aria-hidden`.** Its words are already in the link's name, so a screen
  reader hears "Needs attention: Trusted Assertions" once.
- **The marker shows "!" when marked,** in the amber of the badge, and is an empty indigo ring when
  unmarked. It shows no step number (story § "Where this departs from /setup").

`ActionText` is `ui/src/pages/assistant/ActionText.jsx`. It maps each part to its text, or to the
anchor above. The hub and the placeholder page share it.

**5. The FAQ is a native `<details>`:**

```jsx
<details className="bs-assistant-hub-faq">
  <summary>Frequently asked questions</summary>
  <dl>{ASSISTANT_FAQ.map((q) => <Fragment key={q.question}><dt>{q.question}</dt><dd>{q.answer}</dd></Fragment>)}</dl>
</details>
```

It has no `open` attribute and no state, so it is closed on every load, and on every return to
`/assistant` in the app, because the page remounts.

The browser supplies the rest of AC-4:

- `<summary>` is focusable;
- Enter and Space toggle it;
- the platform accessibility tree exposes it as expanded or collapsed.

**6. The editor moves.** `git mv ui/src/pages/assistant/Index.jsx
ui/src/pages/assistant/EditProfile.jsx`. The component is renamed `EditAssistantProfilePage`.

What changes in it:

- The `h1` reads **Edit Assistant Profile**, with no emoji.
- Above it goes `<Link to={ASSISTANT_PROFILE_PATH} className="bs-setup-back">← Back to Your
  Tapestry Assistant's Profile</Link>`.
- The doc comment names the new address and this ADR.

Its four states, its `AssistantProfileEditor` mount and its two predicates are unchanged. It stays
the only importer of `AssistantProfileEditor` (ADR assistant-profile/0004 sub-decision 3).

The entry points need no code change, only the constant's new value, except:

- `ui/src/config/avatarMenuLinks.js`:
  - `MY_ASSISTANT_PATH` becomes `` `${ASSISTANT_MANAGEMENT_PATH}/profile/edit` ``, with its doc
    comment saying it names the Edit Assistant Profile page;
  - it gains `export const ASSISTANT_MANAGEMENT_PATH = '/assistant'`;
  - `accountLinks`' "Assistant Management" takes `to: ASSISTANT_MANAGEMENT_PATH`;
  - the module's header comment is updated. The module must keep having no imports.
- `ui/src/pages/BrainstormSettings.jsx:475-482`: the card sentence becomes "See your assistant,
  and edit and publish its profile, on the Edit Assistant Profile page." and the button reads
  "🤖 Edit Assistant Profile" (story § Copy). The `href` stays `MY_ASSISTANT_PATH`.
- Comments in `ui/src/` that say "the My Assistant page" are re-worded where they would now
  mislead. Find them with `grep -rn "My Assistant page" ui/src`. The code around them does not
  change.

**Outside the React app**, the six hand-written addresses and two page names in § Context follow the
editor. That is what makes AC-6's "every link that leads to the editor" true beyond the app:

- **One server definition.** A new `src/utils/assistantPages.js` (CommonJS, no requires) exports
  `EDIT_ASSISTANT_PROFILE_PATH = '/assistant/profile/edit'` and
  `` EDIT_ASSISTANT_PROFILE_PAGE = `the Edit Assistant Profile page (${EDIT_ASSISTANT_PROFILE_PATH})` ``.
  The server cannot import the UI's ESM constant, so this is a second home, and each home's comment
  names the other. A guard test keeps the two equal (Implementation notes).
- **The three messages are built from it,** with their words otherwise unchanged:
  - `NOT_YOUR_ASSISTANT`: "An assistant's profile can be published only by the person it belongs
    to, signed in, on the Edit Assistant Profile page (/assistant/profile/edit)."
  - `NO_CONTENT`: "Nothing was published: the request carried no profile. Edit and publish your
    assistant's profile on the Edit Assistant Profile page (/assistant/profile/edit). Its "Reset to
    defaults" fills in the default profile."
  - `ASSISTANT_PROFILE_REFUSAL`: "This endpoint does not sign kind 0 profiles. An assistant's
    profile is published only on the Edit Assistant Profile page (/assistant/profile/edit)."

  Their HTTP statuses and `code`s (`not-your-assistant`, `no-content`, `one-writer`) do not change.
- **The two legacy panels.** They are static HTML, so the address is written out:
  - the link becomes `<a href="/assistant/profile/edit">🤖 Edit and publish its profile on the
    Edit Assistant Profile page →</a>`;
  - the sentence becomes "Its profile is edited and published on the Edit Assistant Profile page.";
  - their comments follow.
- **`BIBLE.md:1072`** reads "…which the Edit Assistant Profile page (`/assistant/profile/edit`)
  calls." This is a factual update to one sentence, so there is no docs-mode cycle. The `Last
  updated` header line gains this change.

**7. The placeholder pages: `ui/src/pages/assistant/ActionPage.jsx`, `AssistantActionPage({ action })`.**
It uses the `/setup` placeholder chrome, `<TopBar />` and `main.bsp-content.bs-setup-main`, and
contains, in order:

1. `<Link to={ASSISTANT_MANAGEMENT_PATH} className="bs-setup-back">← Back to Assistant Management</Link>`.
2. `h1.bs-setup-title` with the action's title.
3. `div.bs-setup-placeholder` containing:
   - `<p><strong>Placeholder page.</strong></p>`;
   - `<p><ActionText parts={action.description} /></p>`;
   - `h2.bs-assistant-hub-notes-heading` "Alert criteria" and a `<p>` with the criteria, or "Not
     yet defined.";
   - where there are notes, `h2` "Planning notes" and a `<p>`;
   - for the profile action, its `editLink` as a `<Link>`.

One component serves all ten actions; `App.jsx` passes each its entry. It reads nothing and asks
nothing (AC-7).

**8. Styles, in `ui/src/styles.css`.** Add one block after the "My Assistant" block (`:8654-8681`),
headed for this book.

- **Shared with `/setup`:** the hub and the placeholders reuse the classes for kicker, title,
  accent, sign-in box, back link, placeholder box and amber badge, so the two pages look alike by
  construction.
- **New, prefixed `bs-assistant-hub-`:** the count line, sections and their `h2`s, the card list,
  the card with its marker, body, head, link (`::after`), text and chevron, the FAQ, and the notes
  headings.
- **Card metrics** match `.bs-setup-step`: padding, border, radius, hover, and the text colour
  that `.bs-setup-step:hover` holds against the global `a:hover`.
- **Section headings** are small, sentence-case labels above each card list, so they do not compete
  with the `h1`.
- **Mobile:** extend the existing `@media (max-width: 480px)` rules if the new blocks need it. AC-7's
  375 px check covers all twelve pages.

The editor's `.bs-assistant-main`, `.bs-assistant-title` and `.bs-assistant-note` stay as they are.

## Consequences

- **What this enables:**
  - **Building one action later means building one page.** It gets its own component, and its
    route entry points there instead of `AssistantActionPage`. Adding an action means adding one
    entry to `ASSISTANT_ACTIONS`.
  - **Real attention answers replace one function.** Swapping `assistantAttention` updates the
    hub's marks, its count line and the pill together. The later session may turn it into a
    context over a status endpoint, as `/setup` did (ADR setup-status-and-alert/0001).
- **Production addresses change.** `/assistant` served the editor on production from PR #731. After
  promotion, a saved `/assistant` opens the hub, and the editor is two clicks away: the profile
  card, then "Edit your Assistant's profile →". The avatar item "My Assistant's Profile" still opens
  the editor directly.
- **A gap until `/setup/create-account` is built.** An Admin or Customer who may create an
  assistant but has none follows "Assistant Management" to the hub. The hub's no-assistant line
  sends them to `/setup`, whose step 1 is still a placeholder. The working "Create my Tapestry
  Assistant key" button remains on the editor, reached through "My Assistant's Profile" (unchanged,
  `hasMyAssistantPage`). The gap closes when the step pages are built (`stories/_intake.md`, entry
  2026-09-20, item 3).
- **assistant-profile #5 landed during this design** (one writer; PR #733). Its React code already
  follows the constant (`Dashboard.jsx:735`, `:750`). Its server messages, legacy panels and BIBLE
  sentence wrote `/assistant` out by hand, so this story moves them (sub-decision 6). Its story and
  ADR 0005 keep saying "the My Assistant page". ADR 0005's status line gains a note pointing here.
- **A second home for the address.** The editor's address now lives in the UI constant and in
  `src/utils/assistantPages.js`, and it is written out in two static pages. A guard test keeps all
  four equal, so the next move of the editor cannot miss one of them.
- **`/assistant`'s look is tied to `/setup`'s classes.** A change to `.bs-setup-*` changes both
  pages. That is intended ("styled similarly"), and it is a coupling to know about.
- **Records to update at implementation:**
  - the `assistant-profile` book gains a "Changes from outside this book" entry, giving the new
    address and heading and pointing here;
  - the status lines of ADRs assistant-profile/0004 and /0005 name this ADR as superseding the
    address (done with this ADR).
- **Firmware reinstall required?** No. No concept changes.

## Implementation notes

**New files:**

- `ui/src/pages/assistant/actions.js`: sub-decision 1. It stays pure, with one `.js` import.
- `ui/src/pages/assistant/Index.jsx`: the hub, sub-decisions 3–5.
- `ui/src/pages/assistant/ActionText.jsx`: the description renderer, sub-decision 4.
- `ui/src/pages/assistant/ActionPage.jsx`: the placeholder page, sub-decision 7.

**Moved:** `ui/src/pages/assistant/Index.jsx` → `ui/src/pages/assistant/EditProfile.jsx` (sub-decision 6).
Do this `git mv` first, so history follows the editor; then create the new `Index.jsx`.

**Changed:**

- `ui/src/App.jsx`: the imports and the three changes of sub-decision 2.
- `ui/src/config/avatarMenuLinks.js`: sub-decision 6.
- `ui/src/pages/BrainstormSettings.jsx`: the card's copy, sub-decision 6.
- `ui/src/styles.css`: sub-decision 8.
- Comments naming "the My Assistant page", where they now mislead (sub-decision 6).
- Outside the React app (sub-decision 6):
  - `src/utils/assistantPages.js`, new;
  - `src/api/assistant/index.js` (`NOT_YOUR_ASSISTANT`, `NO_CONTENT`);
  - `src/api/strfry/commands/publishEvent.js` (`ASSISTANT_PROFILE_REFUSAL`);
  - `public/pages/nip85.html`, `public/pages/customers/customer.html`;
  - `BIBLE.md:1072`.
- `engineering-team/audits/assistant-profile/book.md`: its "Changes from outside this book" entry.

**Unchanged, on purpose:** `Dashboard.jsx`, `UserDetail.jsx`, `settings/Index.jsx` and
`AssistantProfileEditor.jsx`. They already follow `MY_ASSISTANT_PATH`, and changing any of them
would widen the diff for no behaviour.

**Test-file changes this ADR requires (Phase 3, Tester).** These suites pin `/assistant` as the
editor, and must be re-aimed at `MY_ASSISTANT_PATH`'s new value and the hub:

- `test/my-assistant-page.test.js`:
  - `PAGE` becomes `ui/src/pages/assistant/EditProfile.jsx`;
  - M5: the constant's value, and "Assistant Management" leading to `ASSISTANT_MANAGEMENT_PATH`;
  - W1: the editor's route is `MY_ASSISTANT_PATH`, rendering `EditProfile`;
  - the `settings/assistant` redirect's target.
- `tests/brainstorm/my-assistant-page.spec.js`:
  - `MY_ASSISTANT`;
  - B4 and B5: the two menu items now lead to different pages;
  - the heading assertion (`/My Assistant/` becomes "Edit Assistant Profile");
  - B10 (the `/settings` card);
  - B11: a guest's "Assistant Management" now lands on the hub's no-assistant line.
- `tests/brainstorm/assistant-setup-prompt.spec.js`: the expected pathnames.
- `tests/brainstorm/assistant-default-profile.spec.js`, `assistant-publish-result.spec.js` and
  `ta-composite-avatar.spec.js`: `page.goto('/assistant')` becomes the editor's address.
- `test/assistant-setup-state.test.js:471-476`: its regex already accepts `MY_ASSISTANT_PATH`; only
  its message names `/assistant`.
- The suites assistant-profile #5 added or changed, which pin the address in messages and in the
  legacy panels:
  - `test/one-writer-assistant-profile.test.js`: `MY_ASSISTANT` at `:69`, `pointsToThePage` at
    `:222` and `:378`, and the panel links at `:619`;
  - `test/one-default-assistant-profile.test.js` R1 (`:920-926`): the legacy pages' link;
  - `tests/brainstorm/one-writer.spec.js`: `MY_ASSISTANT` at `:52`.
- **A guard: every home of the editor's address agrees.** It checks that all of these are equal:
  - `MY_ASSISTANT_PATH` (UI);
  - `EDIT_ASSISTANT_PROFILE_PATH` (server);
  - the `href` of each legacy panel's link;
  - the address inside each of the three messages.

  It also checks that no file outside `engineering-team/`, `ledger/` and the tests writes
  `/assistant` as the editor's address, except the hub's own constant.
- New suites for this story, registered in `test/registry.js`:
  - a Node suite over `actions.js`: the ten actions, three sections, five FAQ entries, the copy and
    `assistantAttention`;
  - source-shape checks: routes, the redirect, the constant values and the editor's heading;
  - a browser suite for AC-1–AC-7.
- The gate for this story adds, to the suites that name a touched file, the suites that walk
  `ui/src` and read every file (found with `grep -rl readdirSync test/` together with `ui/src`, as
  in book `setup-status-and-alert` § Test gate). The Tester names the command in the test plan.

**Checks at implementation:**

- **Deep links.** `curl -s -o /dev/null -w '%{http_code}'` returns 200 for each of the twelve
  addresses, locally, and on staging after deploy, with the response being `index.html`.
- **Phone width.** At 375 px, `document.documentElement.scrollWidth <= clientWidth` on the hub
  (signed out, and signed in with an assistant, FAQ open), on one placeholder with notes
  (`/assistant/preferences`) and on the editor.

## Out of scope

- **The Assistant Alert:** where it mounts, when it shows, and its look. That is ADR 0002.
- Real "needs attention" answers, the action pages themselves, and the profile checklist
  (`stories/_intake.md`, entry 2026-09-21).
- **Any change to the editor's behaviour.** assistant-profile #5 retires the other writers in its
  own book.
- **Server routing, nginx or firmware changes.** None are needed (§ Context). The server change
  here is wording only: three messages name the editor's new address (sub-decision 6).
