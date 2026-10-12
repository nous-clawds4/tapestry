# Story 1: Coming soon — five hub cards that aren't built yet stop asking for attention

**Status:** Approved
**Created:** 2026-10-12
**Type:** Feature *(Light lane — workflows/light-profile.md; Gate A approved 2026-10-12 by the owner ("approved, go ahead"); scoped gate (named at Gate A):
`node -e "const ps=['./test/assistant-coming-soon.test.js','./test/assistant-alert.test.js','./test/assistant-attention.test.js','./test/assistant-duty-cards.test.js','./test/assistant-duty-menu-check.test.js','./test/assistant-duty-menu-page.test.js','./test/assistant-identification-tags-page.test.js','./test/assistant-management-page.test.js','./test/assistant-outbox-check.test.js','./test/assistant-outbox-relays-page.test.js','./test/assistant-profile-check.test.js','./test/assistant-shared-categories.test.js','./test/assistant-trusted-content.test.js','./test/my-assistants-page.test.js'];(async()=>{let f=0;for(const p of ps){const r=await require(p).run();console.log(p,'pass='+r.pass,'fail='+r.fail);f+=r.fail}console.log('TOTAL_FAIL='+f);process.exit(f?1:0)})()"`
— the new suite and every suite that loads the hub's actions or its one answer. No guard suite: nothing here signs,
publishes or touches strfry.)*
**Epic:** `assistant-coming-soon`
**Book:** `engineering-team/audits/assistant-coming-soon/book.md`

## Background

The hub at `/assistant` lists thirteen actions. Seven have a real check (`CHECKED_ACTIONS` in
`ui/src/pages/assistant/actions.js`). The other six are placeholders, and `assistantAttention` marks a placeholder
**Needs attention** and counts it, always, in both readings: the hub's count line and the top-bar **Manage your
Tapestry Assistant** pill (ADR assistant-identification-tags/0001 sub-decision 6). So a person whose every real check
passes still reads "6 actions need attention", and the pill says 6.

Five of the six are features nobody can act on yet: Bounties, Pins, Tags, Notifications and Alerts, and Preferences.
The owner wants them to work like the background image panel on `/assistant/profile`: a muted **Coming soon** pill, no
"!" marker, no **Needs attention**, and not counted. The sixth, Your Assistant's Treasure Map, will be built soon, so
it stays a counted placeholder for now.

Who is affected: everyone who opens `/assistant`, and everyone with a Tapestry Assistant on this instance, whose count
line and top-bar pill drop by five.

## User-facing description

As someone managing my Tapestry Assistant, I want the hub to tell me which cards are not built yet instead of
marking them as needing my attention, so that its count and the top-bar reminder only point at things I can actually
do.

## Acceptance criteria

- [ ] **AC-1: the five cards say Coming soon.** On `/assistant`, Bounties, Pins, Tags, Notifications and Alerts, and
      Preferences each show a **Coming soon** pill beside the title, in the muted style of the background image
      panel's pill on `/assistant/profile`. They have no "!" marker, no **Needs attention** pill and no **Done** pill.
  - The pill shows for every viewer: signed in with an Assistant here, signed in without one, signed out, and while
    sign-in is still resolving. Whether a card is built is the same for everyone, as on `/assistant/profile`.
  - For a screen reader, the card's title reads with the prefix **Coming soon: **.
  - The card is still a link to its own page, as today.
- [ ] **AC-2: they are not counted.** For a viewer with an Assistant here, neither the hub's count line ("N actions
      need attention") nor the top-bar pill counts any of the five, in any state of the instance's answer: on its way,
      failed, or answered. An answer that says something about one of the five changes nothing.

      | The instance's answer | Count line, today → after | Top-bar pill, today → after |
      |---|---|---|
      | every check done | 6 → **1** | 6 → **1** |
      | not in yet, or failed | 13 → **8** | 6 → **1** |

      The 1 is Your Assistant's Treasure Map card. The 8 is the seven checked cards, marked until their answer says
      done, plus the Treasure Map card.
- [ ] **AC-3: their pages say Coming soon.** Each card still opens its page: `/assistant/bounties`,
      `/assistant/pins`, `/assistant/tags`, `/assistant/notifications-and-alerts` and `/assistant/preferences`. On
      each, the bold first line reads **Coming soon.** in place of **Placeholder page.**. The title, the description,
      the *Alert criteria* ("Not yet defined.") and the *Planning notes* are unchanged.
- [ ] **AC-4: nothing else moves.**
  - Your Assistant's Treasure Map card is still marked **Needs attention** and counted in both readings, and its page
    still says **Placeholder page.**.
  - The seven checked cards are marked, badged and counted exactly as before, Shared included.
  - Visitors and viewers with no Assistant here see no marks and no count line, as before. (They do see the five
    Coming soon pills, AC-1.)
  - Nothing is fetched, published, signed or stored that wasn't before. The server's answer
    (`GET /api/assistant/attention`) is unchanged.

## Copy

- The pill: **Coming soon** (the background image panel's words, `PROFILE_CHECKLIST_COPY.comingSoon`).
- Screen-reader prefix before the card's title: **Coming soon: **
- The bold first line on the five pages: **Coming soon.** It replaces **Placeholder page.** on those five pages only.
- Unchanged: **Needs attention**, **Done**, **Shared**, the count line, the top-bar pill's words, and **Placeholder
  page.** on Your Assistant's Treasure Map page.

## Concepts touched

None. The hub's actions are page data, not concept-graph nodes. No concept changes; no firmware reinstall.

## Out of scope

- Your Assistant's Treasure Map card, its page and its counting (the owner: "let's just not do anything to that card
  in this session").
- Building any of the five actions, or changing their titles, descriptions, *Alert criteria* or *Planning notes*.
- Hiding, reordering or regrouping the cards.
- A Coming soon pill on the five pages themselves (only their bold line changes).
- The server's attention answer, BIBLE §11 (it describes the server's answer, which names no placeholder), and the FAQ.

## Open questions

None open. Settled at intake: which cards (Decision 1), not counted in either reading (Decision 2), the page line
(Decision 3).

## Gate A *(Light profile — approved by the owner 2026-10-12: "approved, go ahead")*

- **Scope:** one subsystem, the hub's action list, its one answer, its card and its placeholder page. The four ACs
  above.
- **Approach (a sentence or two):** `actions.js` gains a list of the five keys, `COMING_SOON_ACTIONS`.
  `assistantAttention` skips them, so neither the hub's count nor the top-bar pill counts them, and no mark is drawn.
  The hub card draws the existing muted pill with "Coming soon" for them, and the placeholder page shows "Coming soon."
  for them. The top-bar pill needs no change of its own.
- **Classification: Design note, no ADR.** No irreversibility trigger fires: nothing on the wire (client-only; the
  server's answer is unchanged), no auth or trust default, no schema or firmware, no dependency, no cross-repo
  contract, no routing, middleware or headers.
- **Scoped gate:** the command in this file's header. Baseline on `origin/staging` `762d350` with dependencies
  installed: the thirteen existing suites, 368 passed, 0 failed. The new suite is written at J2.
- **Browser evidence (Gate B, not a judge gate):** the hub specs against this tree's built UI (`vite build`, then
  `vite preview --port 7799` from `ui/`), as assistant-shared-categories #1 did. J2 names the command.
- **Expected re-aims, not weakenings:** existing pins that encode "every action without a check is marked and
  counted" move with the owner's decision, to "every action without a check, except the five coming soon". A
  throwaway trial of the counting change at intake (reverted, never committed) failed exactly these 10 Node tests:
  - `test/assistant-attention.test.js` C3, R2
  - `test/assistant-duty-cards.test.js` C5, C7
  - `test/assistant-duty-menu-check.test.js` C3, C4, C5
  - `test/assistant-management-page.test.js` D7
  - `test/assistant-profile-check.test.js` C2
  - `test/assistant-trusted-content.test.js` C2

  In the browser, the specs that count every card or every unchecked card: `assistant-management-page` (B1, its
  sign-in-resolving check, and B8 for the five pages' bold line), `assistant-alert`, `assistant-attention`,
  `assistant-duty-menu`, `assistant-identification-tags-page`, `assistant-profile-check`,
  `assistant-shared-categories`, `assistant-taggings-publish` and `assistant-trusted-content`. J2 names each handle.

## Design note *(Light profile — provisional here, ratified at Gate B)*

- **The list and the words.** `ui/src/pages/assistant/actions.js` exports
  `COMING_SOON_ACTIONS = ['bounties', 'pins', 'tags', 'notifications-and-alerts', 'preferences']`, in
  `ASSISTANT_ACTIONS` order, next to `CHECKED_ACTIONS`. An action is then one of three kinds: checked, coming soon, or
  a counted placeholder (today only `treasure-map`). `ASSISTANT_COPY` gains `comingSoon: 'Coming soon'`,
  `comingSoonSrPrefix: 'Coming soon: '` and `comingSoonPage: 'Coming soon.'`. The module keeps its one import. Its
  header comment names this story's § Copy as the source of the new words.
- **The one answer.** In `assistantAttention`, an action in `COMING_SOON_ACTIONS` is skipped before anything else: it
  is never in `needsAttention`, `done` or `shared`, and never counted in `count` or `alertCount`, whatever the answer
  says for its key. The returned shape is unchanged. So the hub's count line (`Index.jsx`) and the top-bar pill
  (`TopBarAlert.jsx`, which reads `alertCount`) drop the five with no change of their own. The function's doc comment
  gains the third kind.
- **The card.** `ActionCard` in `ui/src/pages/assistant/Index.jsx` takes `comingSoon`, which the caller passes as
  `COMING_SOON_ACTIONS.includes(action.key)`, independent of sign-in.
  - When it is true, the card is neither marked nor done, whatever it is passed, so its marker is empty.
  - Inside the link, before the title, it draws a `bs-sr-only` `comingSoonSrPrefix`.
  - After the link it draws `<span className="bs-setup-step-badge is-neutral" aria-hidden="true">`, the muted pill the
    Shared pill and the background image panel already use. No new CSS.
  - The card keeps its link to its page. The header comment's list of states gains the pill.
- **The page.** `ui/src/pages/assistant/ActionPage.jsx` reads `COMING_SOON_ACTIONS`. Its bold first line is
  `comingSoonPage` for the five and `placeholder` ("Placeholder page.") for any other action it serves. Nothing else on
  the page changes.
- **Rejected alternatives.**
  - *Say it in the server's answer, as the background image panel's `counts: false` does.* The server has no check
    for these five and names none of them; the placeholders are the hub's own reading (ADR
    assistant-identification-tags/0001 sub-decision 6). Moving them into `GET /api/assistant/attention` would change
    the API for a fact that is fixed in the build. The pill would also wait on that request, and visitors would never
    see it, because they make no request.
  - *A `comingSoon: true` field on each of the five entries in `ASSISTANT_ACTIONS`.* It would work, but how an action
    counts is decided today by a key list (`CHECKED_ACTIONS`), and the suites reason over key lists. A second list
    keeps the three kinds readable in one place and pinnable as one value.
- **Blast radius.**
  - Code: `ui/src/pages/assistant/actions.js` (`COMING_SOON_ACTIONS`, three `ASSISTANT_COPY` words,
    `assistantAttention`, comments); `ui/src/pages/assistant/Index.jsx` (`ActionCard`, its caller, one import, the
    header comment); `ui/src/pages/assistant/ActionPage.jsx` (the bold line, one import, the header comment).
  - Not touched (grep-verified readers of `assistantAttention`): `ui/src/components/TopBarAlert.jsx` reads only
    `alertCount`; `ui/src/pages/assistant/DutyMenu.jsx` and `OutboxRelays.jsx` read only their own key. Also not
    touched: `src/api/assistant/attention.js`, which names no placeholder; BIBLE §11, which describes that answer;
    and `ui/src/styles.css`, which already has the muted pill.
  - Tests: a new Node suite `test/assistant-coming-soon.test.js` (+ `test/registry.js`), a new browser spec
    `tests/brainstorm/assistant-coming-soon.spec.js`, the hub fixture(s), and the re-aims listed at Gate A.

## Linked artifacts

- ADR: — (Light: the Design note above; no irreversibility trigger)
- Test plan: this file's *Edge cases & not-covered* and *AC→handle lines* (written at J2)
- Book: `engineering-team/audits/assistant-coming-soon/book.md`
