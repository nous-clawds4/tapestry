# Story 1: The setup prompt tells the truth

**Status:** In Progress
**Created:** 2026-09-11
**Type:** Bug
**Epic:** `assistant-profile`
**Book:** `engineering-team/audits/assistant-profile/book.md`

## Background

The dashboard tells people the assistant "doesn't have a face yet" and offers to set up its profile —
even when the profile exists. On 2026-09-11 a logged-out hard load of `/tapestry/` on both staging and
prod showed the "Set up my Assistant's profile" card and an unchecked "Give your Assistant a profile"
checklist item, while each instance's TA profile was live on five relays including its own. The
network log shows why: the dashboard asked the server for the profile of `pubkeys=null`. It runs its
check before it knows the assistant's pubkey, and never checks again.

The check has four more problems:

- **Wrong assistant.** It always checks the instance TA, whoever is looking — logged-out visitors
  included. An Admin's "Set up" button opens the editor for *their own* assistant, so publishing there
  can never clear a prompt about the TA. A Customer's button leads to an Owner/Admin-only page.
- **Different rules on different surfaces.** The dashboard counts a profile only if it has a name or a
  picture, and reads two external "profile relays" first. The editor's "Currently published" line
  counts any kind 0 and reads only the local relay. They can disagree about the same assistant.
- **A slow relay erases a local profile.** If the external query times out (6 s), the local relay is
  never consulted and the answer is "no profile".
- **Stale after publishing.** A "no profile" answer is cached for five minutes, so the prompt can
  outlive the publish that should have cleared it.

Evidence: `ui/src/pages/Dashboard.jsx:25,63,722-728`; `src/api/profiles/fetchProfiles.js:66-126`;
`src/api/assistant/index.js:411-442`. Full survey: `engineering-team/epics/assistant-profile.md`.

## User-facing description

As a signed-in Owner, Admin or Customer, I want the prompt to set up my assistant's profile to appear
only when my assistant really has no profile — and to take me somewhere I can fix that — so that I can
trust it when it appears and am never nagged about something already done.

## Acceptance criteria

**The rule** (ratified at planning): an assistant *has a profile* when a kind 0 signed by that
assistant's key exists on the instance's local relay, or — if the local relay has none — on any relay
the instance publishes assistant profiles to. A profile found only on a publish relay is copied to the
local relay. The prompt appears only when neither has one; if the publish relays cannot be reached,
the local relay's answer stands.

- [ ] Given the viewer's assistant has a kind 0 on the local relay, when any page showing setup state
      is loaded — including a hard load or refresh of the dashboard — then no setup prompt and no
      unchecked "Give your Assistant a profile" item appears, whatever the external relays do (slow,
      down, or empty).
- [ ] Given the local relay has no kind 0 for the viewer's assistant but a publish relay does, when
      setup state is checked, then no prompt appears, and afterwards the local relay holds that same
      event.
- [ ] Given the viewer's assistant has no kind 0 on the local relay or on any publish relay, then the
      prompt appears, and its button leads to a page where this viewer can publish **their own**
      assistant's profile — for an Owner, an Admin or a Customer alike.
- [ ] Given a visitor who is not signed in, or a signed-in user with no assistant, then no assistant
      setup prompt and no "Give your Assistant a profile" item appears; given an Admin or a Customer,
      any prompt concerns their own assistant, never the instance TA.
- [ ] Every surface that shows setup state (the dashboard card, the dashboard checklist, the editor's
      "Currently published" line) gives the same answer for the same assistant at the same moment —
      including immediately after a publish, when all of them show it as set up without waiting for a
      cache to expire.

## Concepts touched

- `39998:<TA>:nostr-relay` — Nostr relays: the local relay and the publish relays the check consults.
- `39998:<TA>:nostr-user` — Nostr users: the assistant is one, and its kind 0 is what is checked.

No concept change is expected. The local concept graph is empty on the planning machine (OPEN.md
#69), so these handles come from `firmware/`; confirm against a populated graph at Architecture.

## Out of scope

- **What counts as a *good* profile.** Existence is the test: a published profile with an old name, no
  picture, or a NIP-05 on a domain that no longer serves it counts as set up. A "needs attention" state
  is a candidate follow-up (epic, Deferred).
- **Which relays the profile is published to** — story 2. Until it ships, "the relays the instance
  publishes assistant profiles to" means today's publish list.
- **Creating an assistant for a user who has none** — key lifecycle (`stories/_intake.md`, 2026-08-10).
- **Where the prompt's button lands for good** — story 4 makes it the My Assistant page. This story
  only requires that it lands somewhere the viewer can publish their own assistant's profile.

## Open questions

None. Resolved at approval (2026-09-11): with an empty local relay and unreachable publish relays, the
local relay's answer stands and the prompt appears — a fresh instance that is offline must still be
told to set up, and a wiped *and* offline instance is rare. Recorded in the rule above.

## Linked artifacts

- ADR: `engineering-team/decisions/assistant-profile/0001-one-setup-state-answer-local-first.md`
- Test plan: `engineering-team/stories/assistant-profile/1-setup-prompt-tells-the-truth.test-plan.md`
  (tests: `test/assistant-setup-state.test.js`, `tests/brainstorm/assistant-setup-prompt.spec.js`)
- Review: (filled in after Review phase)
