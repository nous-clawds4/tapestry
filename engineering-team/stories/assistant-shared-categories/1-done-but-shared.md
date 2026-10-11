# Story 1: Done, but shared — Scores, Lists and Concepts held by another Assistant

**Status:** Draft
**Created:** 2026-10-11
**Type:** Feature *(Light lane — workflows/light-profile.md; Gate A pending; scoped gate (proposed for Gate A):
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

## Gate A *(Light profile — the owner approves scope, approach, classification and the scoped gate in one exchange)*

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

## Linked artifacts

- ADR: — (Light: Design note in this file, at J1)
- Test plan: (this file's Edge cases and AC→handle lines, at J2)
- Review: (filled in at Gate B)
