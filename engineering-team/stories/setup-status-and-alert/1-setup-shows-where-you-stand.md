# Story 1: /setup shows where you stand

**Status:** Done
**Created:** 2026-09-21
**Type:** Feature
**Epic:** `setup-status-and-alert`
**Book:** `engineering-team/audits/setup-status-and-alert/book.md`

## Background

`/setup` (setup-page-scaffold #1, in production) lists Tapestry's three setup steps, but it shows all
three as not done for everyone. "0 of 3 complete" is a constant, and the page reads nothing about the
viewer. The owner deferred the real checks to this book. This story replaces the constant with each
step's real state for the signed-in viewer, by the rules the owner ratified at planning (book
§ Decisions). Story 2, the Setup Alert, counts the same answers.

**This supersedes two of the shipped story's criteria:** setup-page-scaffold #1's AC-2 (every step
not done, for every viewer) and its AC-6 (the page makes no request of its own and looks the same
signed in or out). Its other criteria, and all of its approved copy, still hold.

## User-facing description

As someone signed in to a Tapestry instance, I want `/setup` to show which of the three setup steps I
have done, judged from my own assistant, my own follow list and my own Treasure Map, so that I can see
at a glance what is left.

## The rules (ratified at planning, 2026-09-21)

"You" is always the signed-in viewer: their pubkey, and the assistant this instance holds for them.
The instance's Tapestry Assistant (TA) counts only when the viewer is the Owner, because it is the
Owner's assistant.

| Step | Done when | Not done when |
|---|---|---|
| 1 · Create your account | this instance holds an assistant for you | it holds none |
| 2 · Create your follow list | your follow list (kind 3) follows at least one account other than you | it follows only you, or nobody; or you have no follow list |
| 3 · Activate your Brainstorm account | your Treasure Map (kind 10040) names your assistant in both its rank entry and its followers entry | you have no Map; or your Map lacks a rank or a followers entry naming your assistant; or you have no assistant |

- **Where steps 2 and 3 look.** This instance's relay first. Only when it has no such event of yours
  are the outside relays this instance is configured to read asked. Then the newest event found
  counts.
- **Not checked:**
  - which relay a Map entry points to;
  - the Map's other entries;
  - whether your assistant has a profile. That question stays on the Dashboard's Getting-Started
    checklist, unchanged.
- **A Map that names another provider.** If your Map has a rank or followers entry naming someone
  other than your assistant, step 3 is not done, and its card says your Map names another provider.

## Acceptance criteria

- [ ] **AC-1 — signed out.** Given a visitor who is not signed in, when they open `/setup`:
  - the three steps are listed with their names, badges and sentences as today, each still a link
    to its page;
  - no step is marked done or not done, and a screen reader hears neither "Done:" nor "Not done:";
  - no progress line or bar is shown;
  - a line reads "Sign in to see which steps you've done." with a button that starts the same
    sign-in as the top bar's.

  A signed-in viewer never sees that line.
- [ ] **AC-2 — each step follows the rules.** Given a signed-in viewer, each step shows done or not
      done by § The rules, from the viewer's own state. In particular:
  - an Owner whose Map names the instance TA for rank and followers sees step 3 done;
  - a Customer or an Admin whose Map names the instance TA sees step 3 not done, and the card
    says the Map names another provider. The TA is not their assistant;
  - a viewer with no assistant sees steps 1 and 3 not done, whatever their Map says;
  - a follow list whose only follow is the viewer leaves step 2 not done.
- [ ] **AC-3 — where it looks.**
  - Given a follow list or Map of the viewer's on this instance's relay, that event decides the
    step, and no outside relay is asked for it.
  - Given none there, the configured outside relays are asked, and the newest event found decides.
  - Given none on this instance's relay and none on any outside relay that answered, the step is
    not done.
- [ ] **AC-4 — how it shows.** Given a signed-in viewer:
  - a done step shows a check mark, a "Done" badge and its done sentence from § Copy, and is not a
    link;
  - a not-done step looks and links as it does today;
  - "N of 3 complete" and the progress bar count the done steps, and when all three are done,
    "You're all set!" appears below the steps;
  - while a step's check is still running, or when it has failed, the step shows as not done;
  - at 375 px wide, the page reads without horizontal scrolling.
- [ ] **AC-5 — read-only.** Given anyone opening `/setup`, nothing is published, signed or stored,
      whether on outside relays or on this instance's relay. Every request the page makes only
      reads.

## Copy

New strings, for approval with this story. The existing copy (setup-page-scaffold #1 § Copy) is
unchanged.

| Where | Text | Source |
|---|---|---|
| Signed-out line | Sign in to see which steps you've done. | new |
| Signed-out button | Sign in with nostr | the Brainstorm Search top bar's button, verbatim |
| Done badge | Done | Brainstorm |
| Screen-reader prefix of a done step | Done: | new; the counterpart of the existing "Not done:" |
| Step 1, done | This instance holds your Tapestry Assistant. | new |
| Step 2, done | {N} accounts followed. ("1 account followed.") N counts the accounts followed other than yourself. | Brainstorm's "{n} accounts followed", without its "Edit list" link, because the follow page is still a placeholder |
| Step 3, done | Your Treasure Map names your Tapestry Assistant for your rank and followers scores. | new. Brainstorm says "Other apps can now find your scores.", which claims the scores exist; this check doesn't look at them |
| Step 3, not done, another provider | Your Treasure Map names another provider for your scores. | new. Replaces step 3's usual sentence in that case; the badge stays |
| All done | You're all set! | Brainstorm |

## Concepts touched

None changed. Named for orientation (`<TA>` is this instance's TA pubkey, AGENTS.md §1):

- `39998:<TA>:tapestry-assistant`: what step 1 asks you to have, and what step 3's Map must name
- `39998:<TA>:nostr-user`: the viewer, whose follow list and Treasure Map are read
- `39998:<TA>:nostr-relay`: this instance's relay and the outside relays the checks read
- `39998:<TA>:web-of-trust`: what the follow list feeds, and what the Map points other apps to

## Out of scope

- **The Setup Alert** (story 2).
- **The three step pages**, which stay placeholders, and any link from a done card back to them,
  such as Brainstorm's "Edit list".
- **The assistant's profile.** Whether it exists stays the Dashboard's question (its Getting-Started
  item and its "I don't have a face yet" card). Where that item leads is assistant-profile #4's.
- **Beyond steps 2 and 3's rules:** which relay a Map entry points to, the Map's other entries, and
  Brainstorm's "Trusted Lists update" line.
- **Other lookups:** fixing the 🍇 TA Treasure Map page's own search (OPEN.md row 260), and unifying
  the app's several relay lists.
- **Brainstorm's "Go to your dashboard" button and its `?next=` hand-off.**
- **How someone gets an assistant:** becoming a customer, or an Admin being given a key. That is the
  create-account page's job.
- **`/assistant`.**

## Open questions

None. The owner answered them at planning (2026-09-21). The answers are recorded in book
§ Decisions 1–6 and in § The rules above.

## Deviations

Small judgment calls made during implementation (Implementer role, step 9):

- **Where the sign-in line sits.** For a signed-out visitor, the sign-in line and its button sit
  where a signed-in viewer's progress line sits: above the steps. The story did not place it. ADR 0001
  § 4 lists it after the steps ("then the signed-out line"), so this departs from the ADR's wording.
  The line goes where a signed-in viewer reads their progress, and it tells the visitor what signing
  in will show before they read the steps.
- **The done look.**
  - A done step's marker is a white ✓ in a filled green circle, and its "Done" badge is the green
    counterpart of the amber one.
  - "You're all set!" is one line of green bold text below the list, not Brainstorm's card, because
    the approved copy is one line.
  - A done card keeps the card's border and background on hover, since it is not a link.
- **The provider derives its phase instead of storing it.**
  - `SetupStatusContext.jsx` keys each answer to the request it answers (pubkey and attempt). It
    shows an answer only for the current request, and it calls `setState` only in the fetch's
    callbacks. So an answer for a previous account is never shown, and the file avoids eslint's
    `react-hooks/set-state-in-effect`.
  - ADR 0001 § 3 allows "a request counter or a `cancelled` flag"; this uses both.
  - **Review round 2.** When the request goes away — a sign-out, or sign-in re-resolving — the held
    answer is dropped during render (React's "adjusting state while rendering" pattern). The review's
    Blocking 1 found that a re-sign-in as the same account rebuilt the same request key, so the
    answer from before the sign-out showed as current while the new read ran. Now every new read
    starts from `checking`, as ADR § 3 requires ("`user` becoming `null` resets the state to `idle`").
    B10 pins it.
- **One eslint error, the house pattern.** `SetupStatusContext.jsx` carries
  `react-refresh/only-export-components`, because it exports `useSetupStatus` beside its provider.
  - `AuthContext.jsx`, `ConfigContext.jsx` and `AssistantRosterContext.jsx` carry the same error for
    the same reason.
  - ADR 0001 and tests D1/D3 place the hook there.
  - The other touched UI files lint clean.
- **The session pubkey is lower-cased before use.** `/api/auth/verify-user` accepts upper-case hex,
  and strfry filters need lower-case.
- **Local deploy: one more server file than the diff.** The local container's server tree has drifted
  from the checkout (OPEN.md row 27) and lacked `src/api/assistant/profilePublish.js`.
  - The new module reads Relay Settings through that file, so `/cycle-local` copied it along with the
    story's server files: `src/api/setup/status.js`, `src/api/index.js` and `src/api/openapi.yaml`.
  - That was checked first:
    - the container's `src/api/index.js` differed from the checkout only by the new route;
    - its npm dependencies matched;
    - every module `profilePublish.js` requires exists there.
  - None of the other drift was synced.

## Linked artifacts
- ADR: `engineering-team/decisions/setup-status-and-alert/0001-one-setup-status-answer.md`
- Test plan: `engineering-team/stories/setup-status-and-alert/1-setup-shows-where-you-stand.test-plan.md`
  (tests: `test/setup-status.test.js`, `tests/brainstorm/setup-status.spec.js`)
- Review: `engineering-team/reviews/setup-status-and-alert/1-setup-shows-where-you-stand.md`
