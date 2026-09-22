# PRD Seed: Account setup you can see — `/setup`'s real status, and the Setup Alert

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/setup-status-and-alert/audit.md`
**Anchor:** the acceptance frame in `book.md` (the owner's ask, quoted verbatim, and nine planning decisions)
**Confidence:** **high** for what shipped. **Medium** for what comes next. The three step pages, where people
actually complete setup, are still placeholders. So the flow from "you have steps left" to "done" has not been
tried by anyone.
**Date:** 2026-09-22

> This is a reverse-engineered baseline in the product-team PRD shape. It is a **strawman for the product team**,
> not a ratified spec. Sections are tagged `[FROM FRAME]`, `[INFERRED]`, or `[UNKNOWN — product input needed]`.

## 1. Product vision

`[FROM FRAME]` A signed-in person can see, at a glance, whether their account is ready for Brainstorm's trust
scoring and for other apps. `/setup` shows each of three steps as done or not done. A persistent pill in the top
bar sends them there while a step is confidently left. The model is Brainstorm's "Finish setting up your account"
flow, with its two kinds of "not done":
- the page may show a step as not done while things are still loading;
- the reminder nags only on a confident, relay-verified "not done".

`[FROM FRAME]` The three steps, in the owner's definitions:
1. **Create your account:** this instance holds a Tapestry Assistant for you.
2. **Create your follow list:** your kind 3 follows at least one account other than you.
3. **Activate your Brainstorm account:** your Treasure Map (kind 10040) names your assistant on this instance for
   rank and followers.

`[INFERRED]` The steps are the preconditions for the product's core promise. Your assistant computes and publishes
your scores; your follows are what the scores are built from; your Treasure Map tells other apps where to find
them. The feature turns those preconditions from hidden state into a checklist.

## 2. Personas

`[INFERRED]` from the planning decisions and the per-visitor table in `book.md`:

- **A signed-out visitor:** sees the three steps unmarked and a prompt to sign in. Never sees the pill.
- **A signed-in guest with no assistant**, which is most guests: sees steps 1 and 3 not done, and usually step 2.
  The pill counts all three. `[UNKNOWN — product input needed]` They cannot complete step 1 from `/setup` yet,
  because creating an assistant is the future create-account page's job.
- **A Customer, or an Admin with a key:** step 1 done; steps 2 and 3 checked against their own assistant.
- **The Owner:** step 1 done, because the instance's Tapestry Assistant is the Owner's own. Step 3 is checked
  against it.
- **Someone on several instances,** whose Treasure Map names another provider: step 3 is not done here, the page
  says so, and the pill does not count it (Decision 3). `[UNKNOWN — product input needed]` whether that serves
  people who deliberately use another provider.

## 3. Scope (as-built)

`[FROM FRAME]` Shipped. Stories 1 and 2 are in production (promotions #735 and #739). Story 3 follows in the
promotion the owner asked for after this close:

- **`/setup` with real status:**
  - each step done or not done;
  - "N of 3 complete" and "You're all set!";
  - done steps show a ✓ and their done sentence;
  - a Map naming another provider is named as such;
  - every step shows as not done while the answer is unknown.
- **The Setup Alert:** "⚠ Finish setting up your account · N steps left", with "Finish setup →".
  - **Where:** every top bar on both halves of the app. It hides on `/setup` and its step pages, in any letter case,
    and for visitors.
  - **What it counts:** only confidently open steps.
  - **Behaviour:** persistent, not dismissible. It drops the count, then the sentence, as the bar narrows.
  - **Readable:** dark text on amber.
  - **Announced exactly as it reads** at each width.
- **Catching up in the same tab.** After the app publishes the viewer's own follow list or Treasure Map, both the
  pill and `/setup` re-check without a reload. Neither shows the old answer while the re-check runs.
- **Out, by the owner's choice:**
  - the step pages, which stay placeholders;
  - `/assistant`;
  - the Dashboard's Getting-Started checklist, unchanged;
  - noticing steps completed in another app or tab before the next full page load.

## 4. Domain model

`[INFERRED]` from ADR 0001 and the endpoint's contract:

- **The setup answer,** always for the session's own viewer:
  - **Step:** `account` / `follow` / `activate`, each with:
    - `done`;
    - `pending`: counted by the pill;
    - `finished`: the check reached a verdict;
    - where relevant, `followCount`, `otherProvider` and `source` (`local` or an outside relay).
  - **The viewer's assistant:** the key this instance holds for them.
  - **Follow list:** their newest kind 3.
  - **Treasure Map:** their newest kind 10040. Its rank and followers entries name a provider's key.
- **Where each is read.** This instance's relay comes first. On a miss, the outside relays configured for that kind
  in Relay Settings are read, and the newest event found counts. A check "finishes" only when it finds the event,
  or when at least one outside relay answered with nothing.
- **Nothing is written.** The checks only read. Publishes happen elsewhere in the app, and the setup answer listens
  to them.

## 5. Design rules (as-built)

`[INFERRED]` from the ADRs and reviews. These rules were set by the owner or by review:
- **Two kinds of not done.** The page may show "not done" while loading. The pill counts only confident answers.
- **One answer.** `/setup` and the pill read the same answer, so they cannot disagree.
- **Never the old answer.** While a re-check runs, nothing shows the previous answer as current.
- **Setup first.** When this pill counts a step, the Assistant Alert (book `assistant-management`) gives way.
- **Accessible by construction:**
  - text at 4.5:1 or better;
  - the accessible name is the visible text;
  - decorative marks are hidden from screen readers.
  
  `[UNKNOWN]` No accessibility rule exists for no-PRD books generally (ledger row
  `2026-09-21-no-accessibility-baseline-without-prd`).
- **The bar never scrolls sideways,** and the control panel's header never grows. On phones, while a pill shows,
  bars give up their wordmark or badge.

## 6. Carry-forward & open questions

Promoted from the build audit's §6:
- **The three step pages:** what each one does, and how a person completes each step there. This is the obvious next
  phase (intake 2026-09-20, item 3).
- **Getting an assistant:** becoming a customer, or an Admin being given a key. Until then, a guest's step 1 cannot be
  done from `/setup`.
- **Catching up on changes made in another app or tab,** without a full page load.
- **Brainstorm's "Go to your dashboard" hand-off** (`?next=`).
- **The two top-bar pills name themselves differently.** The Setup Alert is announced as it reads; the Assistant
  Alert still uses a fixed name.
- **Deployments with no outside relays** never finish steps 2 and 3, so the pill never counts them.
- **An accessibility pass** beyond the pill.
- **Not verified:** screen readers and voice control, Firefox and Safari, and a live same-tab catch-up.

## 7. What product must validate

- [ ] **The step pages' flows,** step by step. What does "done" feel like from the step page itself: an immediate
      re-check, a success state, a return to `/setup`?
- [ ] **Whether the pill should stay persistent** once the step pages exist, or become dismissible or snoozable.
      Today it cannot be dismissed, by the owner's choice at planning.
- [ ] **Guests:** should a guest be able to complete step 1 from `/setup`, and what does that mean on each instance?
- [ ] **People on several instances:** is "another provider" rightly not done here? Should the page offer to add
      this instance's assistant to their Map instead?
- [ ] **The Dashboard's Getting-Started item** "Give your Assistant a profile" asks a different question from step 1
      (Decision 6). Should the two converge?
- [ ] **One naming rule for both pills** (announced as it reads, or a fixed sentence), so the top bar speaks
      consistently.
- [ ] **Deployments without outside relays:** is a silent pill acceptable there, or should the check finish on the
      local relay alone?
- [ ] **Other-tab and other-app changes:** is the next full page load good enough, or does the product need a
      re-check on focus?
