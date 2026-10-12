# ADR 0001: Duty Menu and Your Assistant's Treasure Map are two more placeholder entries in the hub's one action list

**Status:** Accepted
**Date:** 2026-10-11
**Story:** `engineering-team/stories/assistant-duty-cards/1-duty-menu-and-treasure-map-placeholder-cards.md`

> **Note (2026-10-12):** Option B, a non-counting "coming soon" placeholder, was later adopted for five other cards (Bounties, Pins, Tags, Notifications and Alerts, and Preferences) by the owner's choice in assistant-coming-soon #1. It is a key list, `COMING_SOON_ACTIONS`, rather than a flag on each entry; see that story's Design note (`engineering-team/stories/done/assistant-coming-soon/1-coming-soon-cards.md`). This ADR's decision for its two cards stands: Your Assistant's Treasure Map is still marked and counted, and the Duty Menu is a checked action since assistant-duty-menu #1.

## Context

Story 1, in short:

- **AC-1:** "Your Assistant's Public Persona" ends with two more cards, after Outbox Relays and in this
  order: **Duty Menu** (`/assistant/duty-menu`) and **Your Assistant's Treasure Map**
  (`/assistant/treasure-map`), with the approved descriptions. The hub lists thirteen actions; the other
  eleven are unchanged.
- **AC-2:** each address shows the hub's placeholder page: heading, "Placeholder page.", description,
  "Not yet defined." alert criteria, the approved planning notes, the back link. Opening or reloading an
  address directly works.
- **AC-3:** for a signed-in viewer with an Assistant, both cards are always marked **Needs attention** and
  never **Done**, and the count line and the Assistant Alert each count them. Visitors and viewers with no
  Assistant see no marks, as today.
- **AC-4:** nothing is published, signed, checked or stored; nothing else on the hub, and nothing on
  `/treasure-map`, changes.

### Concept-graph orientation

The stack is absent in this session, so this follows the AGENTS.md §2 fallback. The story touches one
concept, `39998:<TA>:nostr-user`: the Assistant is the viewer's own. As with ADR assistant-management/0001,
this is navigation and presentation. No property models an Assistant's actions, so there are **no concept
changes and no firmware reinstall**. The Duty Menu header (`39998:<Nous>:duty-menu`, handoff D9–D10) is
neither published nor read here. *Re-verify the handle against a live graph if a later story reads it.*

### Codebase facts this design rests on (verified on `90ea8be3`, `origin/staging`)

- **One data module is the extension point.** `ui/src/pages/assistant/actions.js` holds the sections,
  `ASSISTANT_ACTIONS` (eleven entries, `:52-172`), the FAQ, the copy and `assistantAttention()`. Its header
  says "Adding an action is one entry in ASSISTANT_ACTIONS" (ADR assistant-management/0001 sub-decision 1).
  - The entries are grouped by section: the three `persona` entries are first, and `outbox-relays` (`:72-84`)
    is the last of them.
  - Every entry's `key` equals its path's last segment (`profile`, `identification-tags`, `outbox-relays`,
    `trusted-assertions`, `trusted-lists`, `dlists`, `bounties`, `pins`, `tags`, `notifications-and-alerts`,
    `preferences`).
- **The hub reads it as is.** `Index.jsx:107-122` renders each section's entries with
  `ASSISTANT_ACTIONS.filter((a) => a.section === section.key)`, in array order. Two new `persona` entries
  after `outbox-relays` therefore land fourth and fifth in the section with no change to the hub.
- **The routes are generated.** `App.jsx:337` maps every entry to `ACTION_PAGES[key] ?? <AssistantActionPage
  action={action} />`. `ACTION_PAGES` (`App.jsx:150-154`) holds only the three built pages, so a new entry
  gets its placeholder route with no App change.
- **The placeholder page is shared.** `ActionPage.jsx` renders the title, "Placeholder page.", the
  description, `alertCriteria || "Not yet defined."`, the planning notes when given, and `editLink` when
  given. That is AC-2 for any entry with `alertCriteria: null`, `planningNotes` set and no `editLink`.
- **The marks are automatic.** `assistantAttention()` (`actions.js:267-288`) treats every key not in
  `CHECKED_ACTIONS` (`:248`) as a placeholder. A placeholder is always in `needsAttention`, always adds 1
  to `alertCount`, and is never in `done`, whatever the server answers. It returns nothing for viewers
  without an Assistant. That is AC-3 for any entry left out of `CHECKED_ACTIONS`.
- **The server is not involved.** `GET /api/assistant/attention` (`src/api/assistant/attention.js`)
  answers only the checked actions; it never lists placeholders.
  - Deep links already work: the SPA catch-all (`bin/control-panel.js`) serves the app for any non-`/api/`
    path. `isBlockedProbePath` refuses only dot segments and listed extensions, and neither new address has
    a dot. No Express route claims `/assistant/*`.
  - `/treasure-map` (`MANAGE_TREASURE_MAP_PATH`, `avatarMenuLinks.js:60`) is a separate top-level route, so
    `/assistant/treasure-map` does not collide with it.
- **Stale counts in comments.**
  - `ActionPage.jsx:12` says "One component serves all ten actions".
  - `App.jsx:335` says "The ten action pages under /assistant".
  - The `actions.js` header says "its eleven actions".

  All three are already wrong, or become wrong with this change.
- **Where the tests pin the count.**
  - The shared fixture `test/helpers/assistantManagementFixtures.js` (`ACTIONS`, eleven entries) drives the
    Node suite `test/assistant-management-page.test.js` and the Playwright specs
    `tests/brainstorm/assistant-management-page.spec.js` and `assistant-alert.spec.js`, whose counts are
    `X.ACTIONS.length`.
  - Literal pins: `assistant-management-page.test.js` D2 (`length === 11`), D3 ("the other seven carry
    none") and H1's title ("thirteen addresses"); `assistant-outbox-check.test.js` C1 (`length === 11`, and
    the persona section exactly `['profile', 'identification-tags', 'outbox-relays']`).
  - The pill suites (`assistant-alert.test.js`, `assistant-attention.test.js`) pass literal counts into
    `pickTopBarPill` and are unaffected.

## Options considered

### Option A: two entries in `ASSISTANT_ACTIONS`, using the existing extension point (chosen)

Add two `persona` entries right after `outbox-relays`, with `alertCriteria: null`, the approved
`planningNotes`, no `editLink`, and neither key in `CHECKED_ACTIONS`.

- **Pros:**
  - One file changes in production code (plus count-free comment fixes). The card, its route, its
    placeholder page, its mark, the count line and the pill all follow from the one entry, as ADR
    assistant-management/0001 designed.
  - The later code book replaces each placeholder the way Outbox Relays was replaced: a page in
    `ACTION_PAGES`, and a key in `CHECKED_ACTIONS` once there is a real check.
- **Cons:** the two cards nag every viewer with an Assistant (+2 on the hub and in the pill) for something
  they cannot act on yet. The owner chose this (book Decision 2).

### Option B: a non-counting "coming soon" placeholder

A new flag on an entry (e.g. `counts: false`) that `assistantAttention()` skips, and an unmarked style on
the hub.

- **Pros:** no nag for an action nobody can take yet.
- **Cons:** it contradicts the approved story (AC-3) and the owner's Decision 2. It also adds a third card
  state to the hub, the pill's reading and their suites. Rejected.

### Option C: dedicated stub pages for the two actions

Write `DutyMenuPage.jsx` and `AssistantTreasureMapPage.jsx` now and register them in `ACTION_PAGES`, ready
for the protocol.

- **Pros:** the later book has a file to grow.
- **Cons:** it duplicates `ActionPage.jsx` for no visible difference, and it guesses the shape of pages
  whose protocol is still being ratified (book `duty-menus-and-self-maps`). Each such stub would need its
  own tests. Rejected as premature.

## Decision

We chose **Option A**. Five sub-decisions:

1. **Two entries, right after `outbox-relays`.** Both use `section: 'persona'`, in the order Duty Menu,
   then Your Assistant's Treasure Map. Every later entry keeps its position relative to the others.
2. **Keys follow the path-tail convention.** The keys are `duty-menu` and `treasure-map`, and the paths are
   `` `${ASSISTANT_MANAGEMENT_PATH}/duty-menu` `` and `` `${ASSISTANT_MANAGEMENT_PATH}/treasure-map` ``.
   Inside `actions['treasure-map']`, a later check is about the Assistant's own Map, because the attention
   answer is always about the viewer's Assistant. The person's own Map stays at `/treasure-map`, outside the
   hub. *(A key such as `self-map` was considered and rejected: it would be the only key that differs from
   its path.)*
3. **Placeholders, not checked.** Neither key joins `CHECKED_ACTIONS`. This gives AC-3 with no change to
   `assistantAttention()`.
4. **The placeholder pages' content.** `alertCriteria: null`, so the page shows "Not yet defined.";
   `planningNotes` are story § Copy's words. Neither entry has an `editLink`: per the story's Out of scope,
   the Assistant's Treasure Map does not link to the person's `/treasure-map`.
5. **Comments go count-free.** The `ActionPage.jsx` and `App.jsx` comments stop naming a number, so the
   next card does not make them stale again. The `actions.js` header names thirteen actions and adds this
   story's § Copy to its list of where the words were approved.

## Consequences

- **Every viewer with an Assistant sees two more "Needs attention" marks.** The count line and the
  Assistant Alert each read two higher on the first deploy, as book Decision 2 accepts.
- **The later code book has a clear path.** Build each page and add it to `ACTION_PAGES`. When a real
  answer exists, add the key to `CHECKED_ACTIONS` and teach `GET /api/assistant/attention` to answer it, as
  assistant-outbox-relays did. That book also decides what "done" means for each card.
- **Test pins move (Phase 3):** see Implementation notes § 3. The Playwright specs follow the fixture.
- **No server, API, BIBLE or OpenAPI change.** The hub's actions are not enumerated in BIBLE; §11 lists
  only the attention API, which this does not touch.
- **Firmware reinstall required?** No.

## Implementation notes

### 1. `ui/src/pages/assistant/actions.js` (the only behavioural change)

Insert after the `outbox-relays` entry, before `trusted-assertions`:

```js
{
  key: 'duty-menu',
  section: 'persona',
  path: `${ASSISTANT_MANAGEMENT_PATH}/duty-menu`,
  title: 'Duty Menu',
  description: ['Let other clients, apps and Assistants know which duties your Assistant can take on, and which relay each one is published to. Your Assistant\'s Duty Menu is one item on the shared list of Duty Menus.'],
  alertCriteria: null,
  planningNotes: 'Your Assistant will tell the world which duties it is capable of supporting by publishing a Duty Menu, which is an item on the DList of Duty Menus. The protocol is still being written; this page will be built once it is settled.',
},
{
  key: 'treasure-map',
  section: 'persona',
  path: `${ASSISTANT_MANAGEMENT_PATH}/treasure-map`,
  title: "Your Assistant's Treasure Map",
  description: ['Your Assistant keeps its own Treasure Map (kind 10040), naming itself as its own Assistant, to show which duties it is publishing right now. If you move a duty to this Assistant and it is already publishing it, the switch takes effect right away instead of waiting for a first computation.'],
  alertCriteria: null,
  planningNotes: 'Your Assistant will tell the world which duties it is actively managing by publishing its own Treasure Map, in which it acts as its own Assistant. The protocol is still being written; this page will be built once it is settled.',
},
```

The words are story § Copy, verbatim. `CHECKED_ACTIONS` and `assistantAttention()` are unchanged. The
file keeps its one import. Update the header comment as sub-decision 5 says.

### 2. Comments only

- `ui/src/pages/assistant/ActionPage.jsx:12`: "One component serves all ten actions" → "One component
  serves every action whose page is not built yet".
- `ui/src/App.jsx:335`: "The ten action pages under /assistant" → "The action pages under /assistant".

`Index.jsx`, `ActionPage.jsx`'s markup, `App.jsx`'s routes, `styles.css` and the server are unchanged.

### 3. For the Tester (Phase 3, not implementation)

- **`test/helpers/assistantManagementFixtures.js`:** `ACTIONS` gains the two entries in their place (path,
  title, text, `link: null`, `alertCriteria: null`, `planningNotes`, no `editLink`), and its comment says
  thirteen. The Node and Playwright hub suites follow from it.
- **Literal pins to re-aim:**
  - `assistant-management-page.test.js` D2 (11 → 13), D3 ("the other seven" → nine) and H1's title
    (thirteen → fifteen addresses);
  - `assistant-outbox-check.test.js` C1 (11 → 13; the persona section's first three are `profile`,
    `identification-tags`, `outbox-relays`, and Outbox Relays still directly follows Identification Tags).
- **A new suite for this story** (e.g. `test/assistant-duty-cards.test.js`), Node and ESM-loaded like the
  others:
  - the two entries' position, section, keys, paths and words;
  - `alertCriteria` null, the planning notes, and no `editLink`;
  - neither key in `CHECKED_ACTIONS`;
  - `assistantAttention()`: for a viewer with an Assistant, both keys are in `needsAttention` and each adds
    1 to `alertCount`, even when a (forged) answer says `done: true` for them. For a visitor or a viewer
    with no Assistant, they are absent.
  - `App.jsx` still generates the placeholder route for every entry not in `ACTION_PAGES`;
  - the two placeholder pages render per AC-2. The browser half can reuse the existing Playwright loops
    over `X.ACTIONS`, which pick the entries up from the fixture.
- **Run:** `npm test` (or the suites by name), and the Playwright hub specs when a stack is reachable.

### 4. Branches

Staging only. The change reaches `main` by the usual promotion; no sandbox branch carries the hub.

## Out of scope

- The real pages, any publishing or reading of Duty Menus and self-Maps, a real check, and what "done"
  means for either card. These belong to the later code book.
- Any change to the FAQ, the Assistant Alert's wording, the server's attention answer, BIBLE or
  `protocols/`.
