# Book of Work: The /setup page, live — each step's real state, and the Setup Alert

**Slug:** setup-status-and-alert
**Status:** Closed
**Opened:** 2026-09-21
**Closed:** 2026-09-22 (stories 1 and 2 in production through promotions #735 and #739; story 3 on staging through PR #746, promoted after the close)

## Intent anchor

**Acceptance frame (no PRD)**: the owner's ask, restated at planning (2026-09-21). Completion is
*judged* against the bullets below. This book continues the closed book `setup-page-scaffold`: it
builds two of the three items the owner deferred there (`engineering-team/stories/_intake.md`, entry
"2026-09-20 — The /setup page, the rest of the way…"). The third item, the step pages, stays open
in that entry.

The ask, in part. It is copied from the session transcript, not retyped. "[…]" marks the reading
list, the planning questions and the process notes, which are left out here.

> I'd like to continue the /setup work. The page and its three placeholder step pages are live in production (book `setup-page-scaffold`, now closed). This session should build two of the three things I deferred:
>
> 1. Real per-step status on /setup. Replace the hard-coded "0 of 3 complete" with each step's actual state for the signed-in viewer.
> 2. The Setup Alert. A persistent prompt near the top of the page that sends signed-in users to /setup while any step is still open, like Brainstorm's "Finish setting up your account · N steps left" pill.
>
> Out of scope: the UX of the three step pages (they stay placeholders), and the /assistant page. The avatar menus link to /assistant on purpose, before it exists.
>
> […]
>
> My definitions of the three steps:
> - Create your account = set up your Tapestry Assistant.
> - Create your follow list = my kind 3 event, with at least one follow who is not me.
> - Activate your Brainstorm account = my Treasure Map (kind 10040) names my Tapestry Assistant on this instance for rank and followers.
>
> […]
>
> Guardrails:
> - Every check is about the viewer's own state: their assistant (`user.assistantPubkey`), their kind 3, their kind 10040. Never the instance TA's, and never a hardcoded TA pubkey.
> - Follow Brainstorm's "two kinds of not done". The page may show a step as not done while things are still loading, but the alert may nag only on a confident, relay-verified "not done".
> - The checks are read-only. Nothing publishes on my behalf.

### Decisions taken at planning (2026-09-21)

The owner answered nine multiple-choice questions in three rounds. The answers define "done" for
this book:

1. **Step 1, "Create your account", is done when this instance holds an assistant for the viewer.**
   Whether that assistant has a profile is not part of `/setup`. The owner chose this over "the
   assistant has a profile" and over Brainstorm's "you are signed in".
2. **Steps 2 and 3 are read from this instance's relay first.** Only when it has no such event of
   the viewer's are the outside relays this instance is configured to read asked, and then the
   newest event found counts. The alert counts a step only after an outside relay was actually
   reached and had nothing.
3. **A Treasure Map that names another provider leaves step 3 not done, and the alert does not
   count it.** The page says the Map names another provider. The rule for a done step 3 was
   proposed alongside this question: the viewer's Map names their assistant in both its rank entry
   and its followers entry, and the relay each entry points to is not checked. It stands as written
   in story 1 § The rules, which the owner approved.
4. **Signed-out visitors still see `/setup`:** the three steps with no done or not-done marks, no
   progress line, and a prompt to sign in. They never see the alert.
5. **A signed-in viewer with no assistant is treated like everyone else, alert included.** That
   covers most guests, and an Admin who has not yet been given a key.
6. **The Dashboard's Getting-Started checklist is unchanged.** Its "Give your Assistant a profile"
   now asks a different question from step 1.
7. **The alert appears on both halves of the app:** every page outside `/tapestry`, the landing page
   included, and every `/tapestry` page. The exceptions are `/setup` and its three step pages.
8. **Its form is Brainstorm's:** an amber pill in the top bar beside the avatar menu. Narrower
   screens drop the count, and phones show only the button.
9. **Its words are Brainstorm's:** "Finish setting up your account · N steps left" ("1 step left"
   when one is left), with a "Finish setup →" button that opens `/setup`. It is hidden when the
   viewer is signed out, when no step is confidently open (which includes while checks are loading
   or have failed), and on `/setup` and its step pages. It cannot be dismissed.

The per-visitor table shown in round 2 raised no objection:

| Visitor | 1 · You have an assistant | 2 · Follow list | 3 · Treasure Map |
|---|---|---|---|
| Signed out | no marks, prompt to sign in | no marks | no marks |
| Signed in, no assistant (most guests; an Admin not yet given a key) | not done | checked | not done: the Map has no assistant of theirs to name yet |
| Customer, or an Admin with a key | done | checked | checked against their own assistant |
| Owner | done (the instance TA is the Owner's own assistant) | checked | checked against the TA |

**One question was withdrawn:** whether step 1's shipped check (`/api/assistant/status`) may copy an
assistant's profile from an outside relay into the local relay. Decision 1 means step 1 needs no
relay lookup at all, so the question no longer arises.

### Acceptance frame

*Confirmed 2026-09-21, when the owner approved stories 1 and 2. The fifth bullet was added the same day, when the owner opened story 3 after story 2's review.*

- [x] `/setup` shows each of the three steps as done or not done for the signed-in viewer, by the
      rules in Decisions 1–3. Each check reads only the viewer's own assistant, kind 3 and kind
      10040. The instance TA counts only as the Owner's own assistant. "N of 3 complete" counts the
      done steps. A signed-out visitor sees the steps without marks and a prompt to sign in.
- [x] A persistent Setup Alert, modelled on Brainstorm's pill, sends signed-in viewers to `/setup`
      from every page outside `/tapestry` and every `/tapestry` page while at least one step is
      confidently not done. It never counts a step whose check is still loading or has failed, or
      whose Treasure Map names another provider. It is hidden when the viewer is signed out, and on
      `/setup` and its step pages.
- [x] Nothing is published, signed or stored on the viewer's behalf. The checks only read.
- [x] The three step pages stay placeholders. `/assistant` and the Dashboard's Getting-Started
      checklist are unchanged. The `_intake.md` entry stays open for the step pages.
- [x] The pill's "Finish setup →" text meets the 4.5:1 contrast guideline. The pill is announced
      exactly as it reads at each width. It catches up without a reload after the app publishes the
      viewer's follow list or Treasure Map. It hides on the setup pages whatever the letter case of
      the address.

## Epics in this book

- `setup-status-and-alert` has three stories: `/setup` shows where you stand (#1); the Setup
  Alert (#2), which counts #1's answers; and #3, which fixes #2's four review findings by the
  owner's calls.

## Path

Standard, all five phases for each story (both are features).

## Test gate (named at planning)

The full `npm test` is not this book's gate. It takes about 53 minutes on the Mac Studio and is red
by default on four suites that no change here can reach (OPEN.md rows 191 and 285). Each story's
gate is one gate-engine run under a `GATE_LABEL`, read back with `npm run gate:status`. It covers:

1. every registered suite that names a file the story touches, found with `grep -rl <path> test/`
   for each touched path;
2. the suites that walk `ui/src` and read every file in it, which a filename grep cannot find
   (ledger row `2026-09-21-abbreviated-path-names-no-gate`). A `grep -rl readdirSync test/` on
   2026-09-21 found six: `collapse-into-export-concept`, `publish-export-a-concept`,
   `users-page-neo4j-endpoint`, `in-app-badged-ta-avatar`, `note-tagging-raw-events-inspector-ui`,
   and `curated-dlist-update-publish`, which reads every file in `ui/src/hooks`. Re-run the grep at
   Test Design in case one has been added;
3. the story's own new suites.

Around the run:
- the UI build;
- eslint on the touched files, at parity with the base;
- `bash scripts/harness-lint.sh`;
- a live check on the local stack after `/cycle-local`, with signed-in states driven by the fetch
  stub. The `tapestry` container has no bind mount, and its server code has drifted from HEAD
  (OPEN.md row 27).

Each story's test plan pins the exact suite list, and the Reviewer quotes the `gate:status` line.

## Changes from outside this book

- **2026-09-21 — The Assistant Alert stands beside the Setup Alert, and gives way to it** (book
  `assistant-management`, story 2; ADR assistant-management/0002 and its Amendment 1). *Corrected
  2026-09-21, after that story's review. The first version of this note was written before this book's
  story 2 merged, and told it to render inside the other book's slot.*
  - **The mounts.** Each of the four hosts renders `<SetupAlert />` and then `<TopBarAlert />`:
    `BrainstormUserMenu`, the landing page's `UserMenu`, the Tapestry `Header`, and `DevPage`'s `.bsp-auth`.
    The Setup Alert itself is unchanged.
  - **The owner's rule is setup first** (book assistant-management § Decisions 2). The Assistant Alert shows
    only when the one setup answer counts no step, or when the setup check has failed. Whenever
    `pendingCount` is at least 1, `pickTopBarPill` (`ui/src/utils/topBarAlert.js`) returns `'setup'`, and
    the slot draws nothing.
  - **What this relies on here.**
    - The Setup Alert shows only when someone is signed in and `pendingCount` is at least 1
      (`SetupAlert.jsx:24`). That is why the two pills never show together.
    - A change here that shows it on any other condition, while the check runs or after a failed check,
      would put the Assistant Alert beside it. Such a change must update `pickTopBarPill` too.
    - Browser `tests/brainstorm/assistant-alert.spec.js` B3 would catch it.
  - **Shared CSS.** This book's ADR 0002 Amendment 1 rules for the control panel's brand now fire for
    either pill (`:has(.bs-setup-alert, .bs-topbar-pill)`). The `.header-auth` row is this book's rule;
    the other book's copy of it was removed.
  - **This book's suite, re-aimed in four places** (`tests/brainstorm/setup-alert.spec.js`, each marked with
    a comment):
    - the host row and B9 open the editor's new address, `/assistant/profile/edit` (ADR
      assistant-management/0001);
    - B11's two "no pill" tests sign in a viewer with no assistant, because the Assistant pill sheds the
      same text.
  - **One setup read.** Both alerts read the shared setup status, so `/api/setup/status` is asked once per
    full page load for any signed-in viewer.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** high. Every frame bullet traces to a story, and all three passed review. Each was
  smoke-tested on `staging.brainstorm.world` with a real throwaway guest session. The one exception is the same-tab
  catch-up after a live Follow, covered by the hermetic browser tests instead (audit §5).

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/setup-status-and-alert/audit.md`
- Product feedback: `engineering-team/audits/setup-status-and-alert/prd-seed.md`
