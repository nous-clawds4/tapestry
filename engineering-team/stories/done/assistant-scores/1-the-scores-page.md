# Story 1: The Scores page

**Status:** Done
**Created:** 2026-10-13
**Type:** Feature (small: one page, one action)

## Background

Your Tapestry Assistant calculates your Grapevine and publishes the results as NIP-85 Trusted Assertions (kind
30382), one per scored pubkey, signed by the Assistant on your behalf. The Owner's Assistant is the instance's
Tapestry Assistant; a Customer's is their own Assistant key. Each run republishes every assertion, so the newest one
your Assistant signed tells you when your Grapevine was last calculated and published.

Today no page answers that for everyone, and only operators can start a run (book § "What exists today"). The hub's
Scores card at `/assistant/trusted-assertions` is a placeholder. The owner chose it as the home for both (book
§ Decisions 1).

## User-facing description

As a signed-in person with an Assistant here, I want to see when my Assistant last published my scores and, if I'm the
Owner or a Customer, start a fresh recalculation myself, so that I know how current my Grapevine is and can refresh it
without asking an operator.

## Acceptance criteria

- [ ] **AC-1, last published.** Given a signed-in viewer whose Assistant on this instance has published Trusted
      Assertions, when they open `/assistant/trusted-assertions`, then the page (no longer the placeholder) names
      their Assistant and shows when it last published, as a date and time plus how long ago, and how many Trusted
      Assertions it has published here. "Last published" is the newest kind 30382 signed by **their own** Assistant
      on this instance's relay, not anyone else's. When it has published none, the page says "not yet" instead of a
      time.
- [ ] **AC-2, recalculate.** Given the viewer is the Owner or an active Customer and no run of theirs is queued or
      running, when they press **Recalculate and republish**, then a full run of **their own** pipeline starts
      (calculate, publish as kind 30382 signed by their Assistant, load into search), and the page shows it as
      queued or running. The Owner's run is the owner pipeline; a Customer's is their own per-Customer pipeline.
      Reloading the page after the run ends shows a newer "last published" time and no run in progress.
- [ ] **AC-3, one at a time.** Given a run of the viewer's is already queued or running, then the page says which,
      the button is off, and a further request from the viewer (from the page or sent directly) starts no second run.
- [ ] **AC-4, only your own.** The request to recalculate carries no "whose": the server decides from the session
      alone. A request that names another person (in its query or body) still starts, at most, the caller's own
      run. A signed-out request is refused and starts nothing.
- [ ] **AC-5, no pipeline here.** Given the viewer is an Admin who is not an active Customer, or a guest, then the
      page still shows AC-1's status for their Assistant, shows no button, and says in one line why
      (§ Copy). A direct request from them is refused with that reason and starts nothing. Signed out, or with no
      Assistant here, the page says what the other hub pages say in those cases.
- [ ] **AC-6, nothing else changes.** The hub's Scores card keeps its current mark and meaning; `/settings`, the
      other hub pages, and the operator task tools behave as before.

## Copy

Proposed words; the Architect may adjust layout, not meaning.

- Heading: **Scores** (the hub card's title). Under it, the card's existing description.
- "Your Assistant: {name or short npub}"
- "Last published: {date, time} ({n} ago)" / "Last published: not yet"
- "Trusted Assertions published: {count}"
- Button: **Recalculate and republish**
- Under the button: "A recalculation takes a while, often 20–60 minutes. You can leave this page and reload it later
  to see the new time."
- In progress: "A recalculation is queued." / "A recalculation is running."
- Just started: "Recalculation started."
- Couldn't start: "Couldn't start a recalculation: {reason}"
- No pipeline (AC-5): "Your scores aren't calculated on this instance. That's done for the Owner and for Customers."

## Concepts touched

The stack is absent this session, so these are named in plain language; the Architect should resolve handles.

- Trusted Assertion (kind 30382, NIP-85): read, counted, and republished by the run.
- Tapestry Assistant: whose assertions count, and who signs the republished ones.
- Grapevine (the viewer's personalized trust scores): recalculated by the run.

## Out of scope

- **Admins without a Customer record getting a calculation** (book § Decisions 2): a separate story if wanted.
- **A cooldown** between runs (book § Decisions 3).
- **Live progress** while a run is going (percent, current step, logs): the page reports queued, running or neither.
- **Scheduling** recurring runs from this page; the operator's per-Customer schedules are unchanged.
- **Changing the hub's Scores mark**, e.g. flagging stale scores.
- **`/settings`'s Web of Trust Pipeline card**, the avatar menu, and the provider named in the viewer's Treasure Map.

## Open questions

None open. Resolved at intake: placement, Admins and guests, and the one-at-a-time guardrail (book § Decisions).

For the Architect, not the PO:

- Production and staging run with the task queue on. Say what the page shows if this instance can't tell whether a
  run is in progress; it must not claim one either way.
- The owner pipeline is the heaviest run (the registry gives it 4 hours). Confirm it's the right one for "the Owner's
  Grapevine", and that a run started from the page doesn't collide with an operator's scheduled one.

## Deviations

- While the page's one read is on its way it shows "Checking…" (`SCORES_COPY.checking`); § Copy named no loading word.
- "Your Assistant:" shows the shortened npub (`npubShort`, the My Assistants page's helper), linked to the Assistant's
  `/user/<pubkey>` profile; § Copy allows "name or short npub", and the npub needs no profile request.
- The page asks the read again after every press, accepted or refused, so a 409 shows the run that is already going.
- A read that failed shows "couldn't be read right now" and neither the button nor the no-pipeline line: whose
  pipeline it is isn't known then.
- `lastPublishedLine(published)` takes no `nowSeconds` (ADR § Implementation notes named one): `timeAgo` reads the clock
  itself.
- The server's refusals carry `error` words beside `code`, for API callers and the logs; the page uses its own
  `REASONS` by code. An enqueue that throws answers 500 with code `failed`.

## Linked artifacts

- ADR: `engineering-team/decisions/assistant-scores/0001-a-session-bound-scores-read-and-recalculate-route.md`
- Test plan: `engineering-team/stories/assistant-scores/1-the-scores-page.test-plan.md`
- Review: `engineering-team/reviews/assistant-scores/1-the-scores-page.md`

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal.
