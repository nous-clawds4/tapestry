# ADR 0004: The My Assistant page — one page at `/assistant` hosts the one editor, and every entry point links to it

**Status:** Accepted. Its route is superseded in part by ADR assistant-management/0001 (2026-09-21): `/assistant`
becomes the Assistant Management page, and this page moves to `/assistant/profile/edit` under the heading "Edit
Assistant Profile". "Assistant Management", the old Settings address and the `/settings` card follow that ADR.
The rest of this ADR stands.
**Date:** 2026-09-21
**Story:** `engineering-team/stories/assistant-profile/4-my-assistant-page.md`

## Context

The story asks for one "My Assistant" page for every signed-in role. In short:

- **AC1.** On the page, a person sees their assistant's pubkey, whether its profile is published (story
  1's answer), its NIP-05 on a public instance, and a link to its public profile. They edit and publish the
  profile there and see what each relay did (story 2). The Owner's page manages the instance's Tapestry
  Assistant.
- **AC2.** Every existing entry point leads to the page:
  - "My Assistant's Profile" in both avatar menus;
  - the dashboard prompt and its checklist item;
  - the "Edit Assistant profile" banner on the assistant's profile page;
  - the Tapestry Settings "Assistant Profile" tab;
  - the Brainstorm `/settings` card.

  Neither Settings area keeps an editor of its own.
- **AC3.** A person with no assistant who may create one reaches the page from the avatar menu and creates
  it there. For a person who may not, the menu item stays disabled with its explanation, and the page,
  opened directly, explains instead of failing.
- **AC4.** The page offers only actions that can succeed for the viewer's role. Today only the Owner can
  generate a badged avatar. Every failure says what actually happened.
- **AC5.** A visitor who is not signed in is asked to sign in and sees no one's assistant controls.

**The route was settled with the owner on 2026-09-21: `/assistant`.**

- It is the path the "🎛️ Assistant Management" avatar-menu item already points at. PR #722 added that
  item after the story was written, and today it lands on "Page not found".
- Both that item and "My Assistant's Profile" lead to the page.
- The page wears the Brainstorm look (top bar and avatar menu, like `/setup`), because Customers live on
  that side of the app.
- "Assistant Management" stays clickable for everyone, and the page explains when there is no assistant.
  "My Assistant's Profile" keeps AC3's disabled-with-explanation rule.

### Concept-graph orientation

- The local graph (TA `e00ed090…`) answers `/summaries` with 9 concepts. `nostr-user` is not among them.
- Staging's `/summaries` lists `39998:8e901369…:nostr-user` with 0 elements. Its `/neighbors` shows only
  class-thread wiring: the superset, the JSON schema, the primary property, the properties set and the three
  graphs. No property models an assistant or its profile.
- As the story expected, this is navigation and presentation. **No concept changes, and no firmware
  reinstall.**

### Codebase facts this design rests on (verified on `aa4df2e3`)

**The editor already shows everything AC1 lists.** `ui/src/components/AssistantProfileEditor.jsx`:

- It loads `GET /api/assistant/status?customerPubkey=‹pubkey›` (`:94-111`). That is story 1's answer
  (`hasProfile`), and with it come the defaults and NIP-05 from story 3.
- It shows the assistant's shortened pubkey with a "View public profile →" link (`:305-315`), the NIP-05 or
  the reason there is none (`:316-326`), and "Currently published" (`:327-332`).
- It holds the seven editable fields (`:14-22`), publishes, and lists each relay's result (`:430-447`).
- For a person with no key, it offers "Create my Tapestry Assistant key" (`:258-284`), which posts to
  `/api/assistant/provision-key` (`:202-216`).

**It has two hosts today.**

- The Tapestry Settings tab: `ui/src/pages/settings/Index.jsx:10, :17, :211-213`. The whole Settings page is
  gated to Owner and Admin (`:33`, `:119-131`).
- The Brainstorm `/settings` card: `ui/src/pages/BrainstormSettings.jsx:6, :475-478`. Any signed-in user
  can reach it, and it is the only in-app route for Customers.

**The entry points.**

- **Avatar menus.** `ui/src/config/avatarMenuLinks.js` is the one list all three render sites read.
  - "My Assistant's Profile" goes to `‹profileBase›/‹assistantPubkey›`. With no assistant it has no target
    and renders disabled with `NO_ASSISTANT_REASON` (`:22-23`, `:39-45`).
  - "Assistant Management" goes to `/assistant` (`:85-88`).
  - The three render sites are the Tapestry `Header.jsx:89-95`, `BrainstormUserMenu.jsx:97-101` and the
    landing page's own menu, `BrainstormSearch.jsx:507-511`.
  - The Tapestry menu `navigate()`s (`Header.jsx:99-106`). The Brainstorm menus render plain anchors
    (`AvatarMenuLink.jsx:24-29`). Both reach a React route, so `/assistant` needs no `external` flag.
- **The dashboard.** The prompt's button and the checklist item go to `assistantSetupPath`
  (`ui/src/pages/Dashboard.jsx:731-733, :747-748, :784`). That is `/tapestry/settings/assistant` for Owner
  and Admin, and `/settings` for everyone else.
- **The banner.** "This is your Tapestry Assistant — ✏️ Edit Assistant profile →" on
  `/tapestry/users/‹assistant›` (`ui/src/pages/users/UserDetail.jsx:57, :84-110`) links to
  `/tapestry/settings/assistant` (`:103`) for every role. For a Customer that is a dead end.
- A repo-wide search finds no other link to the editor. The legacy pages are story 5's.

**`/assistant` today.**

- No route serves it. The SPA catch-all serves the shell, and React renders `NotFound`.
- Staging and production both answer `GET /assistant` with `200 text/html` (checked 2026-09-21).
- `/setup` (setup-page-scaffold #1) is the precedent: a top-level route (`ui/src/App.jsx:230-245`) whose page
  renders `<TopBar />` inside `.bsp-page` (`ui/src/pages/setup/Index.jsx:19-22`).

**Roles and keys.**

- `/api/auth/user-classification` (`src/api/auth/getUserClassification.js`) tells the caller about
  themselves only:
  - `classification` is `owner`, `admin`, `customer` (active customers only) or `guest`;
  - `assistantPubkey` is theirs, or `null`.
- `AuthContext` keeps that as `user` (`ui/src/context/AuthContext.jsx:66-71`), reads it once per sign-in
  check (`:43-81`), and exposes `{ user, loading, login, logout }` (`:169`).
- `provision-key` accepts the Owner, an Admin or an active Customer who has no key
  (`src/api/assistant/index.js:467-495`). It stores the new key under the caller's pubkey (`:500-504`).
  - `getAssistantKeys(owner)` reads only the instance TA's slot (`src/utils/assistantKeys.js:20-26`).
  - So for an Owner whose TA key is missing, provisioning "succeeds" with a key nothing ever reads. The
    epic assigns that slot to key lifecycle (Deferred) and gives story 4 only the copy.
- The status handler's no-key answer omits `isOwner` (`index.js:386-393`). So the editor shows an Owner
  with a missing key the Customer wording (`AssistantProfileEditor.jsx:262-266`), with a create button that
  cannot help them.

**The badged-avatar generator.**

- The editor offers "🎨 Generate badged avatar" to everyone (`:336-348`).
- Its two endpoints gate on `isOwner(req)` (`src/api/assistant/avatar.js:185, :268`), which is an alias of
  `isOwnerOrAdmin` (`src/middleware/auth.js:276-293`).
  - For an Admin, the proxy returns the *Owner's* picture, so the Admin's assistant would be stamped with
    the Owner's face.
  - For a Customer, the proxy answers 403.
- The editor treats every non-OK answer as "You have no profile picture to stamp yet" (`:133-139`).
  - That is false for a 403.
  - It is also false for the proxy's other 404s: an unfetchable URL, too many redirects, a host that
    answered 500, a type that isn't an image, a file too large (`avatar.js:201-252`).

**Route ranking** (React Router 7.13.1, `computeScore`, `react-router/dist/development/chunk-XOLAXE2Z.js:641-654`):

- a flat `settings/assistant` child of `/tapestry` scores 35;
- the Settings page's splat child `settings/*` (`App.jsx:477`) scores 23;
- the Settings page's own `assistant` child (`App.jsx:475`) also scores 35. If both existed, the tie would
  leave the match to array order.

### Constraints

- No new dependencies, no new tooling (CLAUDE.md).
- **Principle 1 — whose assistant?** The page always manages *the viewer's own* assistant: `user.pubkey`
  goes to `/status`, which resolves it through `getAssistantKeys`. The Owner's is the instance TA. The page
  never reads `taPubkey`.
- **No new endpoint and no new oracle.** `/api/assistant/status` answers anonymous callers about any
  pubkey. It must not start saying whether a pubkey belongs to an admin or a customer.
- **No visual redesign** (the story's Out of scope). The page shows what the current editor shows.
- **Verification is stack-free.** The local stack at `:7778` serves the main checkout, not this branch.
  The pure helpers and the handler seams are what CI can check. The browser checks run against a worktree
  build.

## Options considered

### Option A — A thin page at `/assistant` hosts the one editor; every entry point links to it

- A new page, `ui/src/pages/assistant/Index.jsx`, at `/assistant`. It has three states: checking sign-in, a
  sign-in prompt, and an explanation for a person with no assistant who may not create one. Otherwise it
  renders the existing `AssistantProfileEditor` for `user.pubkey`.
- Both Settings areas drop the editor and link to the page. The old URL `/tapestry/settings/assistant`
  redirects there. The menus, the dashboard and the banner point there.
- The editor learns the two role facts it lacks:
  - `status.isOwner`, which the status handler's no-key answer now carries too;
  - `canCreateAssistant`, a prop the page derives from the viewer's own classification.

**Pros**

- AC1 is already met by the editor, so the page adds no second rendering of the assistant's state.
- One component with one host makes AC2's "no editor of its own" structural: only the page imports it.
- The suites that pin the editor keep their target: story 1's R1, story 3's W3, and the
  three Playwright specs.
- No new endpoint.

**Cons**

- The editor's control-panel styling sits inside a Brainstorm page until a design pass.
- The role → offer mapping lives in the UI beside the server's enforcement.

### Option B — Build the page from new parts and retire `AssistantProfileEditor`

The page would fetch the status once and render its own panels: identity, the form, the badge tool and the
publish result, each aware of the role.

**Pros**

- A cleaner structure for the design pass the story expects to follow.

**Rejected, because**

- It rewrites about 450 lines that stories 1–3 have just pinned:
  - story 1's R1 (`test/assistant-setup-state.test.js:484-488`);
  - story 3's W3, the relative-URL check (`test/one-default-assistant-profile.test.js:849-856`);
  - the editor-driving specs under `tests/brainstorm/`.
- No acceptance criterion needs it.
- The story rules out a visual redesign.

### Option C — Let `/api/assistant/status` say what each role may do

The status reply would carry `canCreateAssistant` and `canGenerateBadge` for `customerPubkey`, and the
editor would render from them.

**Pros**

- One server-side answer to "what may this person do here".

**Rejected, because**

- **It would be a membership oracle.** Status answers anonymous callers about any pubkey, and its no-key
  branch is exactly the path an anonymous GET takes (ledger `2026-09-21-status-no-key-relay-gate-unpinned`).
  Reporting whether an arbitrary pubkey may create an assistant would tell anyone which pubkeys are this
  instance's admins and customers. That is the exposure the session-shaped roster avoids (ADR
  author-scoped-inspection/0001).
- **The menus never call status**, so they would still need the rule.
- **The session-scoped variant doesn't hold one rule either.** A `canCreateAssistant` field in
  `/api/auth/user-classification` would leak nothing. But `provision-key` admits the Owner, and the page
  must not offer the Owner creation, so the server would state the rule twice anyway.

## Decision

We chose **Option A.**

AC1 is already true of the editor. AC2 then comes down to one host and a set of links. Option A makes
"neither Settings area offers an editor" a fact of the import graph rather than a convention, and it
reaches AC3–AC5 with a page shell and two small role facts. It needs no new endpoint and no redesign.

### Sub-decisions

**1. The page: `/assistant`, the Brainstorm look, four states.**

It renders `<TopBar />` and a centred column, like `/setup`. Under an `h1` "🤖 My Assistant":

| State | What the page shows | Requests it makes |
|---|---|---|
| Sign-in is resolving (`loading`) | "Checking sign-in…" | none |
| Not signed in (AC5) | "Sign in to see and manage your Tapestry Assistant." and a "Sign in with nostr" button (`login()`) | none — no status call, no controls |
| Signed in, no page for them (AC3) | the explanation below | none |
| Otherwise | the editor for `user.pubkey`, in a `.bss-card` as on `/settings` today | the editor's own |

The explanation reads: "Your account has no Tapestry Assistant on this instance. An assistant is a nostr
identity this instance holds for you, to sign and publish on your behalf. This instance sets one up for its
owner, its admins and its customers."

**2. One predicate decides both the menu item and the page.**

`avatarMenuLinks.js` gains two pure functions:

- `mayCreateAssistant(user)` is true for `admin` and `customer`.
  - These are the roles `provision-key` accepts, less the Owner.
  - The Owner's assistant is the instance TA. It is created when the instance is set up, and provisioning
    cannot restore it.
  - The server still enforces its own rule. This function only decides what the page offers.
- `hasMyAssistantPage(user)` is true when the person has an assistant, is the Owner, or
  `mayCreateAssistant`.
  - The Owner counts even when the TA key is missing, because the page explains that case (sub-decision 4).

"My Assistant's Profile" is enabled exactly when `hasMyAssistantPage` is true, and the page shows its
controls exactly when it is true, so the two cannot disagree. A guest who has no assistant sees the item
disabled with the unchanged `NO_ASSISTANT_REASON`. A guest who kept a key from an earlier role still manages
it: the publish handler lets anyone publish their own assistant's profile.

**3. Every entry point links; nothing else edits.**

- **Both avatar menus:** "My Assistant's Profile" and "Assistant Management" go to `MY_ASSISTANT_PATH`
  (`'/assistant'`). "My Profile" keeps its `profileBase`.
- **The dashboard prompt and checklist item:** `MY_ASSISTANT_PATH` for every role. The role branch goes.
- **The banner** on `/tapestry/users/‹assistant›:** `MY_ASSISTANT_PATH`. The wording stays.
- **The Tapestry Settings tab** stays in the tab bar under its name, and clicking it opens the page. The old
  URL `/tapestry/settings/assistant` redirects (`replace`) to `/assistant` for every role, through a flat
  route beside `manage/audit`, not inside the Settings page. Inside the Settings page, a Customer's old link
  would stop at the Owner-only gate.
- **The Brainstorm `/settings` card** becomes a link card: "Your Tapestry Assistant", one sentence, and
  "🤖 Open My Assistant".
- **`AssistantProfileEditor` is imported only by the page.**

**4. The editor offers only what can succeed (AC3, AC4).**

- **The badged-avatar generator renders only when `status.isOwner`.** On this page that means the viewer is
  the Owner, managing the TA. Admins no longer get the Owner's face; Customers no longer get a refusal.
- **The no-key state has three cases:**
  - `status.isOwner`: "This instance's Tapestry Assistant key is missing. It is created when the instance is
    first set up and can't be created from this page; it has to be restored on the server before this
    assistant's profile can be managed here." No button.
  - `canCreateAssistant`: today's copy and the "Create my Tapestry Assistant key" button.
  - Otherwise: "You don't have a Tapestry Assistant on this instance, and your account can't create one
    here." No button. The page's own gate normally keeps this case away; it is defence in depth.
- **The status handler's no-key answer carries `isOwner`.** This is the Owner-copy fix. `isOwner` compares
  against the owner's pubkey, which is already public (`/api/owner/pubkey`).
- **Publish and "Reset to defaults"** stay for every role. Publishing one's own assistant's profile already
  succeeds for anyone signed in.

**5. A failure says what happened (AC4).**

- The proxy's "no picture" 404 gains a machine-readable `code: 'no-picture'` (`avatar.js:196-199`). Its
  other answers are unchanged.
- The editor keeps today's friendly copy for that answer alone ("You have no profile picture to stamp yet…").
- Any other non-OK answer reads "Could not get your profile picture to stamp: ‹the server's `error`, or 'the
  server answered ‹status›'›. You can use the branded Tapestry image instead." The branded-image fallback
  stays on offer.
- The other failure paths (loading the status, creating the key, saving the composite, publishing) already
  show the server's own error. They stay as they are.

**6. The public-profile link goes to `/user/‹assistant›`.**

- It was `/tapestry/users/‹assistant›` (`AssistantProfileEditor.jsx:310`).
- The page lives in the Brainstorm look. `/user/…` is the profile page search results link to, and the one
  the Main menu used for this item (navigation-scaffolding #2). So a Customer stays on their side of the
  app.
- The Tapestry user page keeps its banner, which now leads back to `/assistant`.

**7. After creating an assistant, the rest of the app knows at once.**

- `AuthContext` gains `refreshUser()`. It re-reads `/api/auth/user-classification` and updates
  `classification` and `assistantPubkey` on the current `user`.
- It never touches `loading`, so pages gated on sign-in don't unmount.
- The editor calls `onAssistantCreated()` after a successful provision, and the page passes `refreshUser`.
- The menus, the dashboard's setup check and the banner then see the new assistant without a reload. The
  setup hook's effect already depends on `user?.assistantPubkey` (`useAssistantSetupState.js:59`).

**8. The carry-forwards this ADR folds in.**

From ledger `2026-09-21-assistant-api-review-tidy-ups`:

- **(a) Folded, both halves.** An array-shaped `customerPubkey` answers 400, not 500:
  `typeof customerPubkey === 'string'` joins the 64-hex check in the status handler (`index.js:355`) and the
  publish handler (`:183`). This ADR edits the status handler. The publish half is the same one-token guard
  in the same file, and the ledger item names both.
- **(c) Folded.** The two comments that say NIP-05 is always published are reworded: `index.js:37-40` and
  `AssistantProfileEditor.jsx:11-13`. Both files change here.
- **(b) Not folded.** The name memo (`profileDefaults.js:151-177`): this ADR does not touch
  `profileDefaults.js`, and nothing on the page makes concurrent name lookups for one person. The row stays
  open for (b).

Ledger `2026-09-21-status-no-key-relay-gate-unpinned` is Phase 3's; see "Test-file changes".

OPEN.md row 216 (`.dropdown-item:last-child`) is **not folded**. The story folds it in only if the menu
item's markup changes, and it doesn't: only the data behind the item changes.

**What we trade away**

- The editor keeps its control-panel look inside a Brainstorm page until a design pass.
- A tab in Tapestry Settings now opens another page instead of a panel.
- Two items in one menu lead to one page. The owner chose both.
- "Who may create an assistant" is stated twice: by `provision-key`, which enforces it, and by
  `mayCreateAssistant`, which decides what the page offers. They differ on purpose about the Owner, and each
  one's comment names the other.

## Consequences

**Enables**

- One place for every role, reached from every entry point. "Assistant Management" stops leading to "Page
  not found" on staging and production.
- **Story 5** can point everything it retires at `/assistant`: the dashboard's last assistant action and the
  legacy pages' panels.
- **The `/setup` "Create your account" step** (placeholder today, `ui/src/pages/setup/steps.js`) can send
  people to `/assistant` when it is built (`stories/_intake.md`, 2026-09-20).

**What people see**

- **Owners and Admins:** Settings → "Assistant Profile" and every old bookmark open `/assistant`.
- **Customers:** the dashboard prompt and the banner stop leading to an Owner-only page.
- **Admins** no longer see the badge generator.
- **An Admin with no assistant** creates one from the menu → page path.
- **The Brainstorm `/settings` page** has a link card where the editor was.

**Known gaps, named on purpose**

- **The server gates are unchanged.**
  - The avatar proxy and upload still admit Admins (`isOwner` is owner-or-admin). The page no longer
    offers them to Admins; the wider Admin question is OPEN.md row 269.
  - `provision-key` still accepts an Owner whose TA key is missing and stores a key nothing reads. The page
    no longer offers it; the slot is key lifecycle (`stories/_intake.md`, 2026-08-10).
- **The pubkey is shown as today:** shortened hex, with the public-profile link. Showing the full npub is
  design-pass material.
- **The two ledger rows stay open until they are done.** `…-assistant-api-review-tidy-ups` keeps item (b).
  `…-status-no-key-relay-gate-unpinned` closes if Phase 3 covers both of its items.

**Firmware reinstall required?** **No.** No concept definitions change.

## Implementation notes

### New — `ui/src/pages/assistant/Index.jsx`

- The default export is `MyAssistantPage`.
- It reads `const { user, loading, login, refreshUser } = useAuth()`.
- It renders `<div className="bsp-page"><TopBar /><main className="bsp-content ‹column class›">`, where the
  column follows `.bs-setup-main` (`ui/src/styles.css:8472-8476`). A new `.bs-assistant-main` with the same
  rules is fine.
- The states and copy are sub-decision 1. Call `login().catch(() => {})`: failures are already reported by
  the shared login modal.
- Otherwise, render:
  ```jsx
  <div className="bss-card">
    <AssistantProfileEditor
      customerPubkey={user.pubkey}
      canCreateAssistant={mayCreateAssistant(user)}
      onAssistantCreated={refreshUser}
    />
  </div>
  ```
- The page never reads `taPubkey` or `ConfigContext`.

### Changed — `ui/src/App.jsx`

- **The page's route:** import `MyAssistantPage` and add `{ path: '/assistant', element: <MyAssistantPage /> }`
  after the `/setup/activate` route (`:242-245`).
- **The redirect:** in the `/tapestry` children, beside `manage/audit` (`:452-455`), add
  `{ path: 'settings/assistant', element: <Navigate to="/assistant" replace /> }`.
- **Remove** the Settings page's own `{ path: 'assistant', handle: { crumb: 'Assistant Profile' } }` child
  (`:475`). Otherwise the two routes tie at 35 and the match depends on array order.
- Say both of these in a comment that points here.

### Changed — `ui/src/config/avatarMenuLinks.js`

- **Add** `export const MY_ASSISTANT_PATH = '/assistant'`.
- **Add** `mayCreateAssistant(user)` and `hasMyAssistantPage(user)`, as sub-decision 2 defines them.
  - Both are pure and take `{ classification, assistantPubkey }`-shaped input.
  - `null` or `undefined` → `false`.
- **`personalLinks({ pubkey, assistantPubkey, classification, profileBase })`:**
  - the `my-assistant` entry's `to` is
    `hasMyAssistantPage({ assistantPubkey, classification }) ? MY_ASSISTANT_PATH : null`;
  - its label, icon and `disabledReason` stay.
- **`accountLinks`:** `assistant-management` uses `MY_ASSISTANT_PATH`.
- **The header comment** (`:1-20`) no longer says both profile links use `profileBase`. The disabled case
  becomes "no assistant, and no way to create one here".

### Changed — the three menu render sites

`Header.jsx:89-95`, `BrainstormUserMenu.jsx:97-101` and `BrainstormSearch.jsx:507-511` each pass
`classification: user.classification` to `personalLinks`. No markup changes.

### Changed — `ui/src/components/AssistantProfileEditor.jsx`

- **Signature:** `AssistantProfileEditor({ customerPubkey, canCreateAssistant = false, onAssistantCreated })`.
- **`provisionKey`** (`:202-216`): on success, `await loadStatus()` and then `onAssistantCreated?.()`.
- **The no-key branch** (`:258-284`): the three cases of sub-decision 4, in that order.
  - The heading is "🤖 Tapestry Assistant Profile" when `status.isOwner`, as today.
  - The button renders only in the `canCreateAssistant` case.
- **The generator block** (`:335-385`) renders only when `status.isOwner`. The composite preview, "Use this
  avatar" and the fallback offer live inside it, so they go with it.
- **`generateComposite`** (`:124-148`): on a non-OK answer, read the body defensively
  (`await res.json().catch(() => null)`).
  - Use the "no profile picture" copy only for `res.status === 404 && body?.code === 'no-picture'`.
  - Otherwise use sub-decision 5's message, with `setOfferFallback(true)` as today.
- **The public-profile link** (`:309-314`) goes to `/user/${status.assistantPubkey}`.
- **The `PROFILE_FIELDS` comment** (`:11-13`): the server writes NIP-05 and its `nostr.json` entry on a
  public instance only (ADR 0003).
- **Unchanged:** the status read (R1 pins it), the NIP-05 lines, `useComposite`, `useBrandedFallback`, the
  form, publish and the relay rows.

### Changed — `ui/src/context/AuthContext.jsx`

Add `refreshUser` to the provider value (`:169`). It must not set `loading`:

```js
const refreshUser = useCallback(async () => {
  try {
    const data = await (await fetch('/api/auth/user-classification')).json();
    setUser((prev) => (prev && data && data.pubkey === prev.pubkey
      ? { ...prev, classification: data.classification || prev.classification, assistantPubkey: data.assistantPubkey || null }
      : prev));
  } catch { /* the next sign-in check catches up */ }
}, []);
```

### Changed — `ui/src/pages/Dashboard.jsx`

- Delete `assistantSetupPath` and its comment (`:728-733`).
- `case 'ta-profile'` (`:747-748`) and the prompt's `onSetupProfile` (`:784`) navigate to
  `MY_ASSISTANT_PATH`.
- `WelcomeCard`, the checklist's words, "Use the default profile" (story 5) and the setup hook are
  unchanged.

### Changed — `ui/src/pages/users/UserDetail.jsx`

The banner's `<Link>` (`:102-108`) goes to `MY_ASSISTANT_PATH`. Its wording and its `isMyAssistant` gate
(`:57`) stay.

### Changed — `ui/src/pages/settings/Index.jsx`

- Remove the editor import (`:10`) and its branch (`:211-213`).
- The `TABS` entry becomes `{ key: 'assistant', to: MY_ASSISTANT_PATH, label: '🤖 Assistant Profile' }`,
  with no `path`, so it is never the active tab.
- `switchTab` (`:104-107`) navigates to `tab.to` when a tab has one, and to `tab.path` otherwise.

### Changed — `ui/src/pages/BrainstormSettings.jsx`

- Remove the editor import (`:6`).
- Replace the card at `:475-478` with the link card from sub-decision 3:
  - `.bss-card-header` "Your Tapestry Assistant";
  - one `.bss-card-body` sentence: "See your assistant, and edit and publish its profile, on the My
    Assistant page.";
  - `<a href={MY_ASSISTANT_PATH} className="bss-link-btn">🤖 Open My Assistant</a>`, as the pins card
    above it does.

### Changed — `src/api/assistant/index.js`

- **The status handler's validation** (`:355`):
  `if (typeof customerPubkey !== 'string' || !/^[0-9a-f]{64}$/.test(customerPubkey))`.
- **The publish handler's validation** (`:183`): the same guard.
- **The no-key answer** (`:387`) adds `isOwner` (computed at `:361`). The relay-gate argument passed on at
  `:389` stays `allowRelayFallback`.
- **The `PROFILE_FIELDS` comment** (`:37-40`): "the publish handler sets nip05 itself, on a public instance
  only (ADR 0003)".

### Changed — `src/api/assistant/avatar.js`

The "no picture" answer (`:196-199`) becomes
`{ success: false, code: 'no-picture', error: 'The owner has no profile picture' }`. Nothing else in the
module changes. Its gates stay as they are, and `test/stamped-composite-avatar.test.js` S1 still holds.

### Unchanged, deliberately

- **The server modules:** `profileDefaults.js`, `profileState.js`, `profilePublish.js` and `roster.js`, and
  the provision handler and the avatar gates.
- **`useAssistantSetupState.js`.**
- **`MenuItem` and `AvatarMenuLink`** — so OPEN.md row 216 stays open.
- **The dashboard's "Use the default profile"** and **the legacy pages** — story 5.
- **Express and nginx.** The SPA catch-all already serves `/assistant`.

### Test-file changes this ADR requires (Phase 3, the Tester's lane)

**Re-aim**

- `test/assistant-setup-state.test.js` **D6** (`:467-472`) pins the two old dashboard destinations. It
  should pin `/assistant` for every role, and that neither old path remains in `Dashboard.jsx`.
- **Three specs open `/tapestry/settings/assistant`:** `tests/brainstorm/ta-composite-avatar.spec.js:120`,
  `assistant-publish-result.spec.js:105` and `assistant-default-profile.spec.js:169`. They should open
  `/assistant`.
  - Their status mocks already carry `isOwner: true`, so the generator still shows.
  - Where a spec means "the owner has no picture", its `owner-avatar` 404 mock should carry
    `code: 'no-picture'`: `assistant-default-profile.spec.js:157-159` and the `ownerAvatar: 'missing'` branch
    of `ta-composite-avatar.spec.js:105`.

**Should pass unchanged — confirm, don't edit**

- `test/one-default-assistant-profile.test.js` **Q8** (`:676-686`). It checks fields, not the key set, so
  the added `isOwner` does not disturb it.
- Story 1's **R1**, **D3–D5** and **D7**.
- `test/stamped-composite-avatar.test.js` **S1** and **H1**.

**Carry-forward — ledger `2026-09-21-status-no-key-relay-gate-unpinned`**

- **Item 1.** A Q-case for the no-key branch: an anonymous caller and a stranger get
  `allowRelayLookup: false`, and the person themselves gets `true`.
  - Also one wiring test that drives the **real** `getPersonName` through `createAssistantStatusHandler`'s
    default dependencies, with the lookup helpers stubbed on the `profileState` module.
  - This is feasible without a stack. `profileDefaults.js:242-248` reads
    `require('./profileState').scanLocalKind0` and `.queryRelaysKind0` at call time, so assigning stubs to
    that module's exports reaches them.
  - The name memo is module-level, so each case needs its own pubkey.
- **Item 2** (a W-class source check for B7 and B3) **is recommended here too.** The editor changes in this
  story, and with it the row can close.

**A new suite** registers as one line in `test/registry.js`.

### Testability note (not a test plan)

**The pure predicates are the core.**

- `avatarMenuLinks.js` has no imports, and `ui/package.json` sets `"type": "module"`. So a Node suite can
  `import()` it and call `mayCreateAssistant`, `hasMyAssistantPage` and `personalLinks` directly, not through
  a source regex.
- The table to cover: `owner`, `admin`, `customer` and `guest`, each with and without an assistant; and
  `null`.
- Expect `/assistant` or `null`, and the unchanged reason.

**The status seam** (`createAssistantStatusHandler`):

- the no-key answer carries `isOwner`: true for the owner's pubkey, false for anyone else's;
- an array `customerPubkey` gets a 400 from both seams, and no dependency is called.

**Source checks (W-class, the CI backstop — CI runs no browser):**

- `/assistant` is routed to the page, and the flat redirect exists.
- The Settings page has no `assistant` child.
- Only the page imports `AssistantProfileEditor`.
- `Dashboard.jsx` and `UserDetail.jsx` link to `MY_ASSISTANT_PATH`, and neither old path remains.
- The generator block is gated on `status.isOwner`.
- `generateComposite` keys its "no picture" copy on `code === 'no-picture'`.
- The avatar proxy's "no picture" answer carries that `code`.

**The browser (Playwright, against the worktree build through `vite preview --outDir`):**

- **A visitor:** a sign-in prompt, no `.settings-group`, and no status request.
- **A guest with no assistant:** the explanation, and the menu item disabled.
- **An Admin with no key:** the menu item is enabled; creating the key flips the editor to the form; the
  menus then see the new assistant.
- **The generator:** it shows for the Owner and not for an Admin or a Customer.
- **A 403 and a "host answered 500"** from the proxy: neither says "no profile picture".
- **An Owner with a missing key:** the Owner's wording, and no create button.
- **Every entry point** lands on `/assistant`: both menus' two items, the prompt, the checklist item, the
  banner, the Tapestry Settings tab, the old URL for a Customer and for an Owner, and the `/settings` card.
  - Any spec that opens Tapestry Settings needs an explicit `/api/settings` mock.

**Live checks.** `:7778` serves the main checkout, so a live H-class there would verify another branch.
Point one at staging after deploy.

## Out of scope

- **A visual redesign,** including how the pubkey is shown. A design pass may follow.
- **Badged avatars** for Admins and Customers (the ta-avatar carry-forward). This story only withholds the
  generator where it cannot work.
- **Removing the other writers:** "Use the default profile", the legacy panels and the generic signer
  (story 5; OPEN.md row 269).
- **Server-side changes to who may provision, or to the Owner's key slot** — key lifecycle (Deferred).
- **Tightening the avatar endpoints' Admin gate** (OPEN.md row 269).
- **The name memo** (ledger item (b)) and **OPEN.md row 216**.
- **The `/setup` steps,** and anything `/setup` checks.
