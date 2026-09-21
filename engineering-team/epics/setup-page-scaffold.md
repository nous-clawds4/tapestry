# Epic: setup-page-scaffold

**Created:** 2026-09-20
**Status:** Active
**Book:** `engineering-team/audits/setup-page-scaffold/book.md` (no PRD — acceptance frame)
**Provenance:** Owner request 2026-09-20 (in-session): give Tapestry a `/setup` page like
Brainstorm's, built as a scaffold for now — the page and three placeholder action pages, with nothing
checked and no Setup Alert.

## Goal

**The setup flow has a shape before any step of it is built.** Anyone can open `/setup` and see, in
one place, the three things that make a working Brainstorm account on a Tapestry instance, each
leading to a page of its own. The next session then fills in the real status checks, the Setup
Alert, and the steps themselves against a page that already exists.

## What Brainstorm has

Upstream `NosFabrica/Brainstorm-UI` at `741be6b6` (read 2026-09-20):

- **`client/src/pages/FinishSetupPage.tsx`** — `/setup`, sign-in required. A kicker ("Finish
  setting up"), the heading "Finish setting up *your account*.", an "N of 3 complete" line over a
  progress bar, then three rows. A done row is a green check, the label and a "Done" chip. A pending
  row is a clickable card: icon, label, amber badge, one-line description, chevron. When all three
  are done, a "You're all set!" card links on to the dashboard (or to a `?next=` path).
  - *Create your account* — always done: the page needs a sign-in, so "You're signed in as …".
  - *Create your follow list* — badge "Required for scoring"; opens `/welcome?next=/setup`.
  - *Activate your Brainstorm account* — badge "Required for other apps"; opens `/setup/activate`.
- **`client/src/hooks/useFinishSetup.ts`** — the three-step model shared by every setup surface.
  Two kinds of "not done": an optimistic `*Done` for the page itself, and a relay-verified `*Pending`
  for the nagging surfaces, so nobody is told "2 steps left" while their kind 3 or kind 10040 is
  still loading. A kind 10040 that names another provider counts as not activated, but only when
  this browser has no local "activated" flag: `activateDone` (line 60) lets that flag win, although
  the comment beneath it (lines 61–63) says a declared other provider should still count as pending.
- **`client/src/components/FinishSetupBanner.tsx`** — the header pill, "Finish setting up your
  account · N steps left". Hidden when signed out, when nothing is left, and on `/setup*`.

Only the first is in this epic. The model and the pill are the next session's work.

## Stories

`stories/setup-page-scaffold/`:

1. `1-setup-page-and-placeholders.md` — the `/setup` page with all three steps shown as not done,
   and the placeholder pages `/setup/create-account`, `/setup/follow`, `/setup/activate`.

## Key facts / guardrails

- **The three actions, in Tapestry's terms** (the owner's definitions, book § Intent anchor):
  1. *Create your account* — set up your Tapestry Assistant.
  2. *Create your follow list* — your kind 3 follow list, with at least one follow who is not you.
  3. *Activate your Brainstorm account* — set up your Treasure Map (kind 10040) so that your rank
     and followers scores are managed by your Tapestry Assistant on this instance.
- **No data on these pages.** They read nothing about the viewer and write nothing. So this epic
  asks no POV question. The future checks will: every one of them is about the *viewer's own*
  follow list, Treasure Map and assistant (`user.assistantPubkey`), never the instance TA's —
  see the POV guardrail in `epics/assistant-profile.md`.
- **The server needs no change.** `/setup` and its sub-paths fall through to the SPA catch-all
  (`bin/control-panel.js`, `app.get('*')`). They also pass the honest-404 rule, which blocks only
  dot-segments and probe extensions (`src/utils/siteTrust.js`, `isBlockedProbePath`). nginx sends
  `/` to the app (`docker/nginx.conf`, `location /`).
- **Other "setup" surfaces already exist.** This epic leaves all of them alone:
  - the `/tapestry` Dashboard's Getting-Started checklist — instance setup for the Owner and
    Admins (constraints, the assistant's profile, firmware);
  - `/tapestry/trusted-agents/setup` — a placeholder for pairing a Sponsor with an Agent
    (navigation-scaffolding #3);
  - the `assistant-profile` book's truthful "does my assistant need setting up?" check (#1, Done)
    and its planned My Assistant page (#4, Approved), which step 1 will probably build on;
  - the 🍇 TA Treasure Map page (`/tapestry/grapevine/treasure-map`), which already finds the
    viewer's kind 10040 and which step 3 will probably build on.
