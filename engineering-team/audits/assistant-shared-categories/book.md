# Book of Work: Scores, Lists and Concepts — Done, but shared

**Slug:** assistant-shared-categories
**Status:** Open
**Opened:** 2026-10-11
**Closed:** —
**Strictness:** Light (trial) — workflows/light-profile.md *(chosen by the owner at intake, 2026-10-11; one
Feature-lane story)*

## Intent anchor

**Acceptance frame (no PRD)**: the owner's ask, restated at intake (2026-10-11) and settled through three
questions there. Completion is *judged* against the bullets below.

The ask, verbatim (copied from the session transcript, not retyped):

> It sounds like the check is working as written, but it is stricter than what I want. I am thinking that for Scores, Lists, and Concepts, we currently have two states: needs attention and complete; but we need a third state: complete, but at least one non-local Assistant is assigned to one or more duties in that category. This third state should show the green checkmark and it should count as complete; however, there should be a (perhaps subtle) prompt or indicator that the local Assistant is not in full control of this category, thus being a subtle prompt for the user to change it. This state should not count towards the "Manage your Tapestry Assistant: X actions need attention" count at the top of some pages. So that needs to be changed. For this state, on the Assistant Management page, let's show the green checkmark, and let's show the green Done pill; but let's add some sort of additional indicator to alert the user that the local Assistant does not manage this category in full, and prompt the user to put this category of duties under the control of the local Assistant. But it needs to be less wordy than that. Can you help me to make this change?

It came out of a question the same session answered first. On staging, straycat's hub showed Lists as **Needs
attention** although `/treasure-map` showed Lists assigned. The Map gave `30392`–`30394` only to `600f45510…` (another
Assistant), not to their Tapestry Assistant on staging (`8e901369…`). That is the rule
`assistant-trusted-content-status` book Decision 1 chose on 2026-10-08. This book replaces that decision.

### Decisions taken at intake (2026-10-11)

1. **Split counts as shared.** A category is *shared* when the Map gives it to at least one Assistant other than the
   viewer's Tapestry Assistant on this instance: alone, or beside it. *(Chosen from: split counts too / only when no
   local Assistant.)* So a Map that splits Scores between both Assistants, which is Done today, gets the indicator
   too.
2. **The indicator: a pill and a line.** The card keeps its green ✓ and green **Done** pill, gains a muted **Shared**
   pill beside it, and gains one muted line under its description with a link to move the duties. *(Chosen from: one
   muted line with a link / a second "Shared" pill / both.)* The preview the owner picked:

   ```
   ✓  Lists          [Done] [Shared]
      Enable Tapestry to broadcast lists,
      curated by your trusted and extended…
      ◐ Handled by another Assistant · Move it here →
   ```
3. **Path: the Light profile trial.** *(Chosen from: Standard, all five phases / the Light profile trial.)*

### Acceptance frame

*Proposed from the intake decisions; confirmed at story 1's Gate A.*

- [ ] **Three states.** For a signed-in person with an Assistant here, each of Scores, Lists and Concepts is **Needs
      attention** when no Map is found or the Map gives the category to no Assistant; **Done** when the Map gives it
      only to their Tapestry Assistant on this instance; and **Done, shared** when the Map gives it to any other
      Assistant, alone or beside theirs. The Map is read the way `/treasure-map`'s cards read it.
- [ ] **Shared looks done, plus a nudge.** A shared card shows the green ✓, the green **Done** pill, a muted **Shared**
      pill, and one short muted line with a link to `/treasure-map` to move the duties to their Tapestry Assistant.
- [ ] **Shared is not counted.** The hub's "N actions need attention" line and the top-bar "Manage your Tapestry
      Assistant" pill count a shared category as done.
- [ ] **The rule is written down where it's read.** The three cards' pages state the new rule in their *Alert
      criteria*. The BIBLE and the API description say the same.
- [ ] **Nothing else moves.** Other actions, `/treasure-map`, and the hub's behaviour while the check runs or fails
      are as before.

## Epics in this book

- `assistant-shared-categories`: one story. Done, but shared: the third state for Scores, Lists and Concepts on the
  hub (#1).

## Path

**Light (trial), Feature lane:** Gate A (human) → J1 design → J2 test plan → J3 post-implementation → Gate B (human
review). See `workflows/light-profile.md`.

## Shared lines

Book `assistant-duty-menu` (open) is building its story 1 on `staging` now. It touches the same hub lines: the
attention answer (`src/api/assistant/attention.js`), the hub's actions and their one answer
(`ui/src/pages/assistant/actions.js`: `CHECKED_ACTIONS`, `assistantAttention`), the API description
(`src/api/openapi.yaml`, `/api/assistant/attention`) and BIBLE §11's row for that route. This book also touches
`src/api/assistant/trustedContent.js`, `ui/src/pages/assistant/Index.jsx` and `ui/src/styles.css`. Before
Implementation and again before Gate B: `git fetch` and `git merge-tree --write-tree HEAD origin/staging` (ledger
`2026-09-22-parallel-books-no-shared-line-recheck`).

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/assistant-shared-categories/audit.md`
- Product feedback: `engineering-team/audits/assistant-shared-categories/prd-seed.md`
