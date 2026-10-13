# Story 3: One name for your Assistant's Treasure Map

**Status:** Approved
**Created:** 2026-10-13
**Type:** Feature (wording only; no behaviour changes)

## Background

The owner signed in on staging after story 2 shipped and used Your Assistant's Treasure Map. The page calls one
thing by two names: "your Assistant's Treasure Map" (the page's title, the hub card's title) and "your Assistant's
self-Map" (nearly every line under them, the buttons, and the press's messages). They are the same event, your
Assistant's kind 10040. "Self-Map" is the protocol draft's name for that event when it is read only for the entries
where the Assistant names itself (`protocols/drafts/treasure-maps.md` § 9.2).

The owner's ask (2026-10-13): **call it your Assistant's Treasure Map everywhere a person reads it, and self-Map
nowhere.** Change only the words people see; the names under the hood stay, with no churn. Two words for one thing
confuses the customer.

A straight word swap would make some lines false, because your Assistant's Treasure Map can hold more than the
Assistant's own duties: for the Owner it is also this instance's own Treasure Map, with entries naming other
Assistants. So the lines say what the map *lists* for your Assistant, not that the map itself is on, off, found or
missing:
- "Turn off your Assistant's Treasure Map" would sound like removing the map, but the press only removes the duties
  the Assistant lists for itself;
- "No Treasure Map was found for your Assistant" would be false when the map exists but lists none of its duties.

One verb goes with it: what the map holds for your Assistant is *listed*, never "claimed" or "said".

This story is numbered 3 because it is the epic's next story. The upkeep story the book and epic called "story 3" is
now story 4 (the epic's first cut, revised here), and production still waits for it.

## User-facing description

As a person managing my Assistant, I want the page, the hub and the press to call my Assistant's kind 10040 by one
name, its Treasure Map, so that I don't wonder whether "self-Map" and "Treasure Map" are two different things.

## Acceptance criteria

- [ ] **AC-1. The page says § Copy's words.** Given Your Assistant's Treasure Map page, when it shows any of the lines
  in § Copy's page table (signed out, checking, could not check, finished, on or off, the Owner or anyone else), then
  each line reads word for word as that table's "New" column. No text a person can see on the page contains
  "self-Map" or "self-entries", in any state.
- [ ] **AC-2. The press says § Copy's words.** Given a press (Turn on, Update now or Turn off), when the server answers
  (a publish report, a local failure, "nothing was published", or a refusal), then its message reads as § Copy's press
  table. No message the press returns contains "self-Map".
- [ ] **AC-3. The hub says § Copy's words.** Given the Assistant Management hub, when the Your Assistant's Treasure Map
  card shows its alert criteria, then they read as § Copy's hub table. Nothing on the hub contains "self-Map".
- [ ] **AC-4. Only words change.** Given any state the page, the hub card or the press could be in before this story,
  when the same state arises after it, then:
  - the same lines and buttons show, in the same places, enabled in the same situations;
  - the hub card's mark is the same;
  - a press sends the same request and changes the same things;
  - the route and its answer's fields are unchanged.

## Copy

Each line, now and after this story. Where a line is built from parts (the publish report), only the part shown
changes. Lines not listed here are unchanged.

**The page** (Your Assistant's Treasure Map):

| Where | Now | New |
|---|---|---|
| A duty line, live but not listed | Live, but your Assistant's self-Map doesn't say so yet. | Live, but your Assistant's Treasure Map doesn't list it yet. |
| A duty line, a key this instance can't check | This instance can't check this key yet, so it isn't claimed. | This instance can't check this key yet, so it isn't listed. |
| A duty line, listed but not live | Your Assistant's self-Map claims this, but it isn't live. | Your Assistant's Treasure Map lists this, but it isn't live. |
| The "should" heading | What your Assistant's self-Map should say | What your Assistant's Treasure Map should list |
| The "should" panel, empty | Nothing to claim yet. | Nothing to list yet. |
| The published heading | Your Assistant's published self-Map | Your Assistant's published Treasure Map |
| The published panel, none listed | No self-Map was found for your Assistant. | Your Assistant's Treasure Map lists none of its duties. |
| Could not check | No relay answered, so your Assistant's self-Map could not be checked. | No relay answered, so your Assistant's Treasure Map could not be checked. |
| Status, up to date | Your Assistant's self-Map is up to date. | Your Assistant's Treasure Map is up to date. |
| Status, nothing listed yet | Your Assistant has not published a self-Map yet. | Your Assistant's Treasure Map doesn't list its live duties yet. |
| Status, out of date | Your Assistant's self-Map is out of date: it differs from the duties that are live now. | Your Assistant's Treasure Map is out of date: it differs from the duties that are live now. |
| The Owner's line (`n` other entries) | Your Assistant's Treasure Map is also this instance's own Treasure Map. Its `n` other entries are this instance's choices, not part of the self-Map, and this page never changes them. | Your Assistant's Treasure Map is also this instance's own Treasure Map. Its `n` other entries are this instance's choices, not your Assistant's own duties, and this page never changes them. |
| The public line | Your Assistant's self-Map is public. Anyone can read which duties it reports as live. | Your Assistant's Treasure Map is public. Anyone can read which duties it lists as live. |
| Button, Turn on | Turn on your Assistant's self-Map | List your Assistant's live duties in its Treasure Map |
| Button, Update now | Update your Assistant's self-Map now | Update your Assistant's Treasure Map now |
| Button, Turn off | Turn off your Assistant's self-Map | Remove your Assistant's duties from its Treasure Map |
| State, on | Your Assistant's self-Map is on. | Your Assistant's Treasure Map is set to list its live duties. |
| State, off | Your Assistant's self-Map is off. | Your Assistant's Treasure Map is set to list none of its duties. |
| State, off but still listing | Your Assistant's self-Map is off, but the version found still claims duties. | Your Assistant's Treasure Map is set to list none of its duties, but the version found still lists some. |
| After a Turn off's report | Your Assistant's self-Map now claims no duties. | Your Assistant's Treasure Map now lists none of its duties. |
| The Owner's note, by the buttons | Turning your Assistant's self-Map on or off changes only its self-entries in this instance's own Treasure Map. Its other entries stay as they are. | Listing or removing your Assistant's duties changes only those entries in this instance's own Treasure Map. Its other entries stay as they are. |

**The press** (the server's messages, shown on the page):

| Where | Now | New |
|---|---|---|
| The subject of every publish report and local-failure line | Your Assistant's self-Map (e.g. "Your Assistant's self-Map was saved on this instance's relay. There was no other relay to send it to.") | Your Assistant's Treasure Map (e.g. "Your Assistant's Treasure Map was saved on this instance's relay. There was no other relay to send it to.") |
| Refusal, not signed in | Sign in to change your Assistant's self-Map. | Sign in to change your Assistant's Treasure Map. |
| Nothing published, on with nothing live | Your Assistant's self-Map is on. Nothing is live to claim yet, so nothing was published. | Your Assistant's Treasure Map is set to list its live duties. None is live yet, so nothing was published. |
| Nothing published, on and already current | Your Assistant's self-Map is on, and it already says what is live now, so nothing was published. | Your Assistant's Treasure Map is set to list its live duties, and it already lists what is live now, so nothing was published. |
| Nothing published, off with nothing listed | Your Assistant's self-Map is off. It claimed nothing, so nothing was published. | Your Assistant's Treasure Map is set to list none of its duties. It listed none, so nothing was published. |

**The hub** (the Your Assistant's Treasure Map card):

| Where | Now | New |
|---|---|---|
| Alert criteria | If your Assistant's self-Map is missing, or says anything other than the duties that are live now. | If your Assistant's Treasure Map doesn't list exactly the duties that are live now. |

These replace the matching lines of story 1's and story 2's § Copy, which stay as they were approved (history).

## Concepts touched

- Treasure Map (kind 10040): your Assistant's own. Words only; no concept, event shape or tag changes.

## Out of scope

- **Names under the hood:** code identifiers, file names, the route `/api/assistant/self-map`, the answer's
  `selfMapOn` field, log lines, and the developer records (`openapi.yaml`, BIBLE).
- **The protocol draft:** "self-Map" stays the defined term in `protocols/drafts/treasure-maps.md` § 9.2. Renaming it
  there would be a protocol decision, made separately.
- **History:** stories 1 and 2, their ADRs, test plans and reviews, and the ledger stay as written.
- **What on and off mean.** The owner asked what they mean (2026-10-13), and may change them next. This story only
  makes their lines true under the new name. It doesn't change what a press does.
- **The person's own Treasure Map.** The page also names "your Treasure Map" (the person's own, at `/treasure-map`).
  The possessive keeps the two apart, and those lines don't change.

## Open questions

None. The path, confirmed by the owner at the Planning gate (2026-10-13), is Planning (these words), then Test Design,
Implementation and Review. Architecture is skipped because no design choice is left: every line is named above, and
nothing under the hood moves.

## Linked artifacts

- ADR: none (see Open questions)
- Test plan: `engineering-team/stories/assistant-self-map/3-one-name-for-your-assistants-treasure-map.test-plan.md`
- Review: (filled in after Review phase)
