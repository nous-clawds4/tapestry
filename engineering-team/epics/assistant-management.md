# Epic: assistant-management — the Assistant Management page, as a scaffold, with its alert

**Status:** Open
**Created:** 2026-09-21
**Book:** `engineering-team/audits/assistant-management/book.md` (no PRD — acceptance frame)
**Provenance:** the owner's ask of 2026-09-21, quoted verbatim in the book. It follows two patterns:
`setup-page-scaffold` (a checklist hub with placeholder pages; closed) and `setup-status-and-alert`
(the Setup Alert; open).

## Goal

**`/assistant` becomes the one place to manage everything a Tapestry Assistant does for its
person.** That covers its public persona, the trusted content it publishes, and how it keeps in
touch. The page has ten action cards under three headings, a FAQ and a placeholder page per action.
A pill in the top bar sends people there. For now every action shows as needing attention. Nothing
is checked, and no action is built.

## Stories

`stories/assistant-management/`. Both are features, so both take all five phases (Standard). They
travel through each phase together.

1. `1-the-assistant-management-page.md`: the hub at `/assistant`, its FAQ and the ten placeholder
   action pages. The profile editor that `/assistant` holds today moves to `/assistant/profile/edit`,
   and every link to the editor moves with it.
2. `2-the-assistant-alert.md`: the Assistant Alert pill. It gives way to the Setup Alert (one pill
   at a time, setup first) and counts what #1 marks as needing attention. Depends on #1.

## Key facts / guardrails

- **"Whose assistant?" is this epic's POV question.**
  - "Needs attention" is about the *viewer's own* assistant, and so is the pill. That is the
    assistant this instance holds for them: `user.assistantPubkey`, the same answer that marks
    `/setup`'s first step done. For the Owner it is the instance TA; for anyone else it never is.
  - A signed-out visitor, or someone with no assistant here, has nothing to attend to. They see the
    page with no marks and no pill.
  - The TA pubkey is resolved at runtime, never hardcoded (CLAUDE.md house rule).
- **Read-only.** Nothing in this epic checks, publishes, signs or stores anything. The hub and the
  action pages read only the sign-in state the app already holds. The profile editor keeps its
  current behaviour, only at a new address.
- **The editor's address changes on production.** ADR assistant-profile/0004 put the editor at
  `/assistant`, settled with the owner on 2026-09-21. It went live on production in PR #731. The owner
  re-decided the same day: the hub takes `/assistant` and the editor moves to
  `/assistant/profile/edit`. An old bookmark of `/assistant` lands on the hub. From there the profile
  card, then the profile page's link, reach the editor.
- **Open work this epic touches:**
  - **assistant-profile #5** (one writer) merged to staging on 2026-09-21 (PR #733), while this
    book was at Architecture. It pointed the surfaces it retired at "the My Assistant page
    (/assistant)": two legacy panels, three refusal messages and a BIBLE sentence. Some of those are
    written out by hand rather than through the constant, so story 1 moves them to
    `/assistant/profile/edit` (ADR 0001 sub-decision 6).
  - **setup-status-and-alert #2** (the Setup Alert). It is Approved and not yet designed. It takes
    the same spot in the top bar as story 2's pill. Whichever story lands second fits in beside the
    other. The rule between them is the owner's: setup first.
- **Ten actions, not "8 or 9".** The ask lists two, six and two under the three headings. The owner
  expects the list to grow ("8 or 9 (and growing)").

## Deferred / out of scope

Saved for later by the owner, and recorded in `stories/_intake.md` (entry dated 2026-09-21):

- deciding which actions really need attention: each action's alert criteria, checked for real, so
  the marks, the count and the pill tell the truth;
- building each action page. The owner's words: "Each individual Management Action page will
  likewise have its own list of Action Cards, each of which will be in one of two states: needs
  attention (or not)";
- the profile checklist at `/assistant/profile` (avatar, working NIP-05, client tag, URL, …), which
  "may direct to the Edit Assistant Profile page";
- the assistant's DMs (the FAQ's "Coming soon").

## ADRs

`decisions/assistant-management/`, created per story at Architecture.
