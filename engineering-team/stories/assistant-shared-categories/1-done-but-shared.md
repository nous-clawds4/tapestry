# Story 1: Done, but shared — Scores, Lists and Concepts held by another Assistant

**Status:** Approved
**Created:** 2026-10-11
**Type:** Feature *(Light lane — workflows/light-profile.md; Gate A approved 2026-10-11 by the owner ("Approved, go ahead"); scoped gate (named at Gate A):
`node -e "Promise.all(['./test/assistant-shared-categories.test.js','./test/assistant-trusted-content.test.js','./test/assistant-attention.test.js','./test/assistant-management-page.test.js','./test/assistant-alert.test.js','./test/treasure-map-needs-attention.test.js','./test/assistant-duty-cards.test.js','./test/assistant-duty-menu-check.test.js'].map(p=>require(p).run())).then(rs=>{const f=rs.reduce((s,r)=>s+r.fail,0);console.log('TOTAL_FAIL='+f);process.exit(f?1:0)})"`
— the new suite, the five suites that pin the hub's answer, marks, counts and pill, and the Duty Menu check, which
shares `attention.js`. No guard suite: nothing here signs, publishes or touches strfry.)*
**Epic:** `assistant-shared-categories`
**Book:** `engineering-team/audits/assistant-shared-categories/book.md`

## Background

The hub at `/assistant` checks Scores, Lists and Concepts against the person's Treasure Map
(assistant-trusted-content-status #1). Today each is **Done** when the Map gives the category to their Tapestry
Assistant on this instance, alone or beside other Assistants, and **Needs attention** otherwise. That includes a
category the Map gives only to *other* Assistants, such as the person's Brainstorm Assistant.

On staging, straycat's Map gives Lists (`30392`–`30394`) only to `600f45510…`, so their hub marks Lists **Needs
attention** and counts it, while `/treasure-map` shows Lists as assigned. The owner finds that too strict. Giving a
category to another Assistant is a legitimate choice, so it should count as done. But the hub should still nudge,
quietly, toward having their Tapestry Assistant here take it over.

The owner settled at intake (book Decisions 1–2):
- **When it's shared.** A category is *shared* when the Map gives it to at least one Assistant other than the viewer's
  Tapestry Assistant here, whether alone or beside it. So straycat's Scores, which the Map splits between both
  Assistants, is shared too.
- **How it looks.** The card keeps the green ✓ and green **Done** pill, gains a muted **Shared** pill, and gains one
  short muted line with a link.

Who is affected: everyone with a Tapestry Assistant on this instance whose Treasure Map gives any of these three
categories to another Assistant.

## User-facing description

As someone whose Treasure Map gives some of my Scores, Lists or Concepts duties to another Assistant, I want the hub to
show those categories as done but shared, without counting them as needing attention, so that the hub's count and the
top-bar reminder only nag me about real gaps, while a quiet line still offers to bring those duties home to my
Tapestry Assistant.

## Acceptance criteria

- [ ] **AC-1: the rule's three states, in the instance's answer.** For a signed-in viewer with an Assistant here, the
      instance's answer for each of Scores, Lists and Concepts says **done** or **needs attention**, as today. When
      done, it also says whether the category is **shared**, and if so whether **partly** (the viewer's Assistant here
      is among the Assistants the Map gives it to) or **entirely** (it is not). "Gives it to" is read exactly as
      today, and as `/treasure-map`'s cards read it: per Map key, the first valid Assistant counts and the later ones
      are backups.

      | The Map gives Lists to… | Lists on `/assistant` |
      |---|---|
      | the viewer's Assistant here, only | Done |
      | everything (`*`) to the viewer's Assistant here, and nothing else | Done |
      | the viewer's Assistant here first, another Assistant as its backup | Done |
      | the viewer's Assistant here and another Assistant, on different keys | Done, shared (partly) |
      | only another Assistant | Done, shared (entirely) — **was Needs attention** |
      | another Assistant first, the viewer's Assistant here only as its backup | Done, shared (entirely) — **was Needs attention** |
      | everything (`*`) to another Assistant, and nothing else | Done, shared (entirely) — **was Needs attention** |
      | nobody | Needs attention: not assigned |
      | *(no Map found)* | Needs attention: no Map |

      For straycat's Map on staging: Scores is shared (partly), Lists is shared (entirely), and Concepts is Done.
      When the check did not finish, the answer is unfinished as today, and never shared.
- [ ] **AC-2: the shared card on the hub.** Given a category whose answer is done and shared, its card shows:
  - the green ✓ marker and the green **Done** pill, as for any done card;
  - beside the Done pill, a **Shared** pill: muted, quieter than the Needs attention pill, and not green;
  - under the description, one muted line: **Partly handled by another Assistant · Move it here →** when partly
    shared, or **Handled by another Assistant · Move it here →** when entirely shared;
  - **Move it here →** is a link to `/treasure-map`. Pressing it opens `/treasure-map`, not the card's own page. For a
    screen reader, the card's title reads with the prefix **Done, shared: ** in place of **Done: **.

  A done category that is not shared looks exactly as it does today, with no Shared pill and no line.
- [ ] **AC-3: shared is not counted.** The hub's count line ("N actions need attention") and the top-bar **Manage your
      Tapestry Assistant** pill count a shared category as done, so neither counts it. Needs attention still counts on
      both. An unfinished check still counts on the hub and not in the pill. Straycat's hub, with the Map above,
      counts none of the three.
- [ ] **AC-4: the rule's words.** On each of the three cards' pages (`/assistant/trusted-assertions`,
      `/assistant/trusted-lists`, `/assistant/dlists`), *Alert criteria* states the new rule (§ Copy). BIBLE §11's
      `GET /api/assistant/attention` row and the API description of that route say the same. Nothing else on those
      pages changes.
- [ ] **AC-5: nothing else moves.**
  - The other actions are marked and counted exactly as before.
  - Visitors and viewers without an Assistant see no marks, no pills and no line.
  - While the answer is on its way, or when it fails, the three cards are marked as today, with no Shared pill and
    no line.
  - After the person saves their Treasure Map on `/treasure-map`, the hub's marks, Shared pills, lines, count line and
    top-bar pill reflect the saved Map without a full page reload, as today.
  - `/treasure-map` is unchanged.
  - Nothing is published, signed or stored, and the answer still comes in the one request the hub makes.

## Copy

- The Shared pill: **Shared**.
- The line under the description:
  - partly shared: **Partly handled by another Assistant · Move it here →**
  - entirely shared: **Handled by another Assistant · Move it here →**
  - **Move it here →** links to `/treasure-map`. The **◐** mark in the intake preview is optional decoration, hidden
    from screen readers.
- Screen-reader prefix before a shared card's title: **Done, shared: **. Unshared done cards keep **Done: **.
- *Alert criteria*, on each card's page:
  - Scores: "Needs attention until your Treasure Map gives Scores to an Assistant. Shared while any of it goes to an
    Assistant other than your Tapestry Assistant on this instance."
  - Lists: "Needs attention until your Treasure Map gives Lists to an Assistant. Shared while any of it goes to an
    Assistant other than your Tapestry Assistant on this instance."
  - Concepts: "Needs attention until your Treasure Map gives Concepts to an Assistant. Shared while any of it goes to
    an Assistant other than your Tapestry Assistant on this instance."
- Unchanged: the **Done** pill, **Needs attention**, the count line, and the top-bar pill's words.

## Concepts touched

- `39998:<TA>:nostr-user`: nostr user. Whose Map and whose Assistant: the viewer's own.

The Treasure Map is a kind 10040 event, not a concept-graph node. No concept changes; no firmware reinstall.

## Out of scope

- Showing the state, the Shared pill or the line on the pages behind the three cards. Only their *Alert criteria*
  change.
- A one-click "move it to my Assistant" that edits and republishes the Map. The line only links to `/treasure-map`.
- Naming the other Assistant (who it is, or which keys it holds) on the hub. `/treasure-map`'s details panel does that.
- `/treasure-map`'s own Needs attention pill, which keeps its rule (a category with no Assistant).
- Whether any Assistant actually publishes the category's events. The check reads only where the Map points.
- Bounties, Pins, Tags and the other actions.

## Open questions

None open. Settled at intake: split counts as shared (Decision 1); a pill and a line (Decision 2).

## Gate A *(Light profile — approved by the owner 2026-10-11: "Approved, go ahead")*

- **Scope:** one subsystem, the hub's Scores/Lists/Concepts check and its display. The five ACs above.
- **Approach (a sentence or two):** the server's Scores/Lists/Concepts check (`src/api/assistant/trustedContent.js`)
  marks a category done whenever the Map gives it to any Assistant, and adds `shared` (`partly` / `entirely`) when any
  of those Assistants is not the viewer's here. The hub's one answer (`assistantAttention` in
  `ui/src/pages/assistant/actions.js`) passes a shared list on to the card, which draws the Shared pill and the line.
  The counts need no new logic: a shared category is done and not pending, so neither the count line nor the pill
  counts it.
- **Classification: Design note, no ADR.** No irreversibility trigger fires: no event shape or wire format (nothing
  signed or published; the internal JSON answer only gains a field, and the `other-assistants-only` reason goes
  away), no auth or trust default, no schema or firmware, no dependency, no cross-repo contract, no routing,
  middleware or headers.
- **Scoped gate:** the command in this file's header. Baseline on `origin/staging` `2a4e63a` with dependencies
  installed: the seven existing suites, 176 passed, 0 failed. The new suite is written at J2.
- **Expected re-aims, not weakenings:** existing pins that encode the old rule move with the owner's decision.
  These are `test/assistant-trusted-content.test.js` U1 (Concepts given only to another Assistant), U2 (Mixed), U4
  (a backup) and the "other Assistants only" case near line 359, `tests/brainstorm/assistant-trusted-content.spec.js`
  near line 138, and the three *Alert criteria* strings. Each re-aim is named in the Design note.

## Design note *(Light profile — provisional here, ratified at Gate B)*

- **Chosen approach, server.** `evaluateTrustedContent` in `src/api/assistant/trustedContent.js` keeps its walk and its
  one reading of the Map (`categoryAssistants` from `src/lib/treasureMapCategories.mjs`, unchanged). For a finished
  lookup with a Map, a category with no Assistant stays `pending` with reason `not-assigned`. Any other category is
  `done: true, pending: false, reason: null`, plus a new field `shared`:
  - `null` when every Assistant in `assignments[category]` is the viewer's here;
  - `'partly'` when the viewer's Assistant is among them, beside another;
  - `'entirely'` when it is not among them.

  Every other answer carries `shared: null`: no Map, unfinished, and `check-failed`, including the failure path in
  `trustedContentActions` in `src/api/assistant/attention.js`. So each of the three answers is exactly
  `{ category, finished, done, pending, reason, source, shared }`, and `shared` is non-null only when `done` is true.
  The reason `other-assistants-only` is retired. The Assistant compared is the one `handleAssistantAttention` already
  passes in (the session's own; lowercased as today), so whose Assistant it is cannot change.
- **Chosen approach, hub.** `assistantAttention(user, attention)` in `ui/src/pages/assistant/actions.js` gains one
  returned field, `shared`: an object from action key to `'partly'` or `'entirely'`. It holds only checked actions that
  are in `done` and whose answer's `shared` is one of those two values. It is empty for visitors, viewers with no
  Assistant, and while the answer is not in. `needsAttention`, `done`, `count` and `alertCount` are computed exactly as
  today. A shared action is in `done` and its answer is not `pending`, so the count line and the pill leave it out
  without any new counting logic (AC-3).
  - `ASSISTANT_COPY` gains `shared: 'Shared'`, `doneSharedSrPrefix: 'Done, shared: '`,
    `sharedLine: { partly: 'Partly handled by another Assistant', entirely: 'Handled by another Assistant' }` and
    `sharedMoveLink: 'Move it here →'`. The three actions' `alertCriteria` take § Copy's words.
  - `actions.js` keeps its one import. `MANAGE_TREASURE_MAP_PATH` is already imported there.
- **Chosen approach, card.** `ActionCard` in `ui/src/pages/assistant/Index.jsx` takes `shared` (`'partly'`,
  `'entirely'` or nothing). When the card is done and shared, it adds a muted pill after the Done badge and a line
  after the description; the marker stays ✓ and the card class stays `is-done`.
  - The pill reuses the existing neutral pill, `<span className="bs-setup-step-badge is-neutral" aria-hidden="true">`,
    with slate text `#cbd5e1`: not green, quieter than the amber Needs attention pill.
  - The line is `<p className="bs-assistant-hub-card-shared">`: an `aria-hidden` "◐ ", the `sharedLine` words, an
    `aria-hidden` " · ", and a router `<Link to={MANAGE_TREASURE_MAP_PATH} className="bs-assistant-hub-inline-link">`.
    That existing class lifts the link above the card-wide link (`position: relative; z-index: 1`), so a click opens
    `/treasure-map`, not the card's page.
  - The screen-reader prefix becomes `doneSharedSrPrefix` instead of `doneSrPrefix`.
  - New CSS, one rule, `.bs-assistant-hub-card-shared`: `margin: 0; font-size: 0.8rem; line-height: 1.5;` and
    `color: rgba(226,232,240,0.6)`. It is faded by colour, not opacity, for the reason the
    `.bs-assistant-hub-card-text` comment gives.
  - A done card that is not shared renders exactly as today.
- **Rejected alternatives.**
  - *Derive "shared" on the client from the existing `reason`.* A split Map answers plain `done` with `reason: null`,
    so the client can't know another Assistant holds part of it. And a rule on the client would break the one-answer
    design (ADR assistant-identification-tags/0001: the rules live on the server).
  - *Replace `done`/`pending` with one three-valued `state`.* Every reader of `done`/`pending` would change: the count
    line, the pill, the Done list, and the Duty Menu and Outbox Relays pages' own marks. An orthogonal `shared` field
    leaves them all untouched.
- **Blast radius.**
  - Code: `src/api/assistant/trustedContent.js` (`evaluateTrustedContent`, header comment);
    `src/api/assistant/attention.js` (the `trustedContentActions` failure shape, header comment);
    `ui/src/pages/assistant/actions.js` (`ASSISTANT_COPY`, three `alertCriteria`, `assistantAttention`);
    `ui/src/pages/assistant/Index.jsx` (`ActionCard` and its caller); `ui/src/styles.css` (one rule).
  - Docs: `src/api/openapi.yaml` (the `/api/assistant/attention` description); BIBLE.md §11's row for that route and
    the *Last updated* line.
  - Tests: new `test/assistant-shared-categories.test.js` (+ `test/registry.js`) and
    `tests/brainstorm/assistant-shared-categories.spec.js`. Re-aims, below.
  - **Not consumers** (grep-verified 2026-10-11):
    - `ui/src/components/TopBarAlert.jsx` reads only `alertCount`.
    - `ui/src/pages/assistant/DutyMenu.jsx` and `OutboxRelays.jsx` read only `needsAttention` and `done`.
    - `ui/src/utils/assistantAttention.js` passes `actions` through untouched.
    - `ui/src/context/AssistantAttentionContext.jsx` already refreshes after the viewer's kind 10040 save.
    - `src/lib/treasureMapCategories.mjs` and `ui/src/pages/treasure-map/` are read, not changed.
    - `assistant-attention`, `assistant-duty-menu-check`, `assistant-outbox-check` and `assistant-profile-check`
      stub `checkTrustedContent` as `async () => ({})`, so they don't see the answer's shape.
- **Re-aims (the rule changed by the owner's decision, book Decision 1; not weakenings).**
  - `test/helpers/trustedContentFixtures.js`:
    - the three answer builders gain `shared: null`;
    - a new `shared(category, extent)` builder;
    - `REASONS.finished` drops `other-assistants-only`;
    - `criteria()` takes § Copy's words.
  - `test/assistant-trusted-content.test.js`:
    - U1: Concepts given only to another Assistant becomes `done`, `shared: 'entirely'`;
    - U2: Mixed becomes `done`, `shared: 'partly'`;
    - U4: a backup becomes `done`, `shared: 'entirely'`;
    - U11: the table's "assigned" Lists row (`[OTHER, ASSISTANT]`) becomes shared `partly`, and its "others only"
      row becomes `done`, shared `entirely`;
    - U12: the exact shape gains `shared`.

    S2 (BIBLE and openapi name the three keys) stays as it is; the new suite pins the new words.
  - `tests/brainstorm/assistant-trusted-content.spec.js` TC3, and `tests/brainstorm/treasure-map-save.spec.js` SV17:
    their "pending, other Assistants only" stand-in answers become `not-assigned`, the finished pending reason that
    remains.
- **Wire fidelity:** none. Nothing is signed, published or stored; the Map is read exactly as before.

## Linked artifacts

- ADR: — (Light: the Design note above; no irreversibility trigger)
- Test plan: (this file's Edge cases and AC→handle lines, at J2)
- Review: (filled in at Gate B)
