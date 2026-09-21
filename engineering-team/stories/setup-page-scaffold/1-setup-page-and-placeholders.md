# Story 1: The /setup page and its three placeholder action pages

**Status:** Done
**Created:** 2026-09-20
**Type:** Feature

## Background

Brainstorm (`NosFabrica/Brainstorm-UI`) has a `/setup` page, "Finish setting up your account": a
checklist of the three steps that make a working Brainstorm account, with a progress line and one
card per step. A pill in its header sends people there until they are done. The owner wants
Tapestry to have the same feature, and in the end to support the same three actions, defined in
Tapestry's terms:

1. **Create your account** — set up your Tapestry Assistant.
2. **Create your follow list** — your kind 3 follow list, with at least one follow who is not you.
3. **Activate your Brainstorm account** — set up your Treasure Map (kind 10040) so that your rank
   and followers scores are managed by your Tapestry Assistant.

This story builds only the shape: the `/setup` page, showing all three steps as not done, and one
placeholder page per step. Checking each step's real state, the Setup Alert, and the steps
themselves are saved for a future session (see Out of scope). Brainstorm's page is summarized in
`epics/setup-page-scaffold.md` § "What Brainstorm has"; the owner's ask is quoted verbatim in the
book.

## User-facing description

As someone using Brainstorm Search on a Tapestry instance, I want one page that lists the three
steps to a working account, each leading to a page of its own, so that I can see what setting up
involves and where each step will happen. (For now the page does not know which steps I have
taken.)

## Acceptance criteria

- [ ] **AC-1 — the page.** Given any visitor, signed in or not, when they open `/setup`, then a page
      renders under the Brainstorm Search top bar (the Brainstorm logo, and the avatar menu or the
      sign-in button, as on `/tags`). It has the heading **Finish setting up your account.** and the
      progress line **0 of 3 complete** above an empty progress bar. No "all set" message appears.
- [ ] **AC-2 — three steps, none done.** Given `/setup`, then exactly three steps are listed, in this
      order: **Create your account**, **Create your follow list**, **Activate your Brainstorm
      account**. Each is marked not done and carries its badge and its one-sentence description
      from § Copy.
- [ ] **AC-3 — each step is a link.** Given a step on `/setup`, when it is clicked, or reached with
      Tab and opened with Enter, then its page opens: `/setup/create-account`, `/setup/follow` and
      `/setup/activate` respectively. Each step is a real link, so it can also be opened in a new
      tab.
- [ ] **AC-4 — three placeholder pages.** Given any of the three action URLs, when it renders, then
      it shows the same top bar; the step's name as its heading; the words **Placeholder page.**;
      its sentence from § Copy saying what the page will do; and a link back to `/setup`.
- [ ] **AC-5 — direct loads work.** Given any of the four URLs typed into the address bar or
      refreshed, not only reached by clicking, then the page renders and never "Page not found".
      This holds on staging as well as locally.
- [ ] **AC-6 — nothing is checked or written.** Given any of the four pages, when it loads, then the
      page makes no request of its own: the only network traffic is what the shared top bar makes
      on every Brainstorm Search page. Nothing is published or saved. The page body is the same
      whether or not the viewer is signed in.
- [ ] **AC-7 — phone width.** Given a 375 px wide viewport, then all four pages read without
      horizontal scrolling.

## Copy

Approved with the story (2026-09-20). "Brainstorm" means taken from `FinishSetupPage.tsx` at
upstream `741be6b6`.

**`/setup`**

| Element | Text | Source |
|---|---|---|
| Kicker | Finish setting up | Brainstorm |
| Heading | Finish setting up your account. | Brainstorm |
| Progress | 0 of 3 complete | Brainstorm ("{doneCount} of 3 complete") |
| Step 1 | Create your account | Brainstorm |
| Step 1 badge | Start here | **new**: Brainstorm never shows this step as not done, so it has no badge for it |
| Step 1 text | Your account comes with your own Tapestry Assistant: a nostr identity this instance holds for you, which signs and publishes on your behalf. | **new** |
| Step 2 | Create your follow list | Brainstorm |
| Step 2 badge | Required for scoring | Brainstorm |
| Step 2 text | Your trust scores are built from who you follow — without at least one follow, there's nothing to calculate. | Brainstorm, verbatim |
| Step 3 | Activate your Brainstorm account | Brainstorm |
| Step 3 badge | Required for other apps | Brainstorm |
| Step 3 text | One signature publishes your Treasure Map, which tells other apps that your Tapestry Assistant manages your rank and followers scores. | **adapted** from Brainstorm's "One signature publishes your Treasure Map so other apps know where to find your scores. Takes a few seconds." |

**The three placeholder pages** — each shows its heading, **Placeholder page.**, its sentence, and
the back link **← Back to setup**.

| URL | Heading | Sentence (all **new**) |
|---|---|---|
| `/setup/create-account` | Create your account | This page will set up your account on this Tapestry instance — which means setting up your Tapestry Assistant, the nostr identity this instance holds for you, which signs and publishes on your behalf. |
| `/setup/follow` | Create your follow list | This page will help you publish your follow list — a kind 3 nostr event — with at least one follow who is not you. Your trust scores are calculated from it. |
| `/setup/activate` | Activate your Brainstorm account | This page will set up your Treasure Map — a kind 10040 nostr event — so that your rank and followers scores are managed by your Tapestry Assistant on this instance. |

## Where Tapestry departs from Brainstorm, on purpose

- **The URLs** are the owner's: Brainstorm's follow step opens `/welcome?next=/setup`, and its
  account step has no page at all.
- **Step 1 is not done, and is a link.** Brainstorm's `/setup` requires a sign-in, so "Create your
  account" is always done there.
- **Signed-out visitors see the page.** Brainstorm sends them to its login page first. Here the page
  checks nothing, so there is nothing to sign in for yet.
- **No "You're all set!" card and no `?next=` hand-off.** Both matter only once a step can be done.
- **The look is Tapestry's.** Same structure and words, in Tapestry's own dark Brainstorm Search
  styling. It is not a copy of Brainstorm's light-theme cards.

## Concepts touched

None wired. Named for orientation only (`<TA>` is this instance's TA pubkey, AGENTS.md §1):

- `39998:<TA>:tapestry-assistant` — what step 1 sets up
- `39998:<TA>:nostr-user` — whose follow list step 2 is about
- `39998:<TA>:web-of-trust` — what the follow list feeds, and what the Treasure Map points other
  apps at

## Out of scope

- **Saved for a future session by the owner**, and recorded in `stories/_intake.md` (entry dated
  2026-09-20) so it is not lost:
  - checking whether each step has really been taken, and prompting accordingly on `/setup`;
  - the Setup Alert that sends people to `/setup`;
  - any UX or function on the three action pages.
- **Any link to `/setup` from a menu or another page.** Until the Setup Alert exists, people reach
  `/setup` by typing its address.
- Changing any existing setup surface: the Dashboard's Getting-Started checklist, the Trusted
  Agents Set Up page, the assistant profile pages, the Treasure Map page.
- Server or nginx changes. None are needed (epic § Key facts).

## Open questions

None open. Resolved when the owner approved this story (2026-09-20), all as proposed:

1. **Signed-out visitors** see the same page (AC-1, AC-6). Brainstorm makes them sign in first.
2. **No way in yet**: `/setup` is reached only by its address until the Setup Alert is built.
3. **The new copy** stands as written in § Copy: step 1's badge and sentence, step 3's adapted
   sentence, and the three placeholder sentences. The follow page says kind 3. The owner's ask said
   "kind 1", but kind 3 is the follow-list kind (NIP-02).

## Deviations

Small judgment calls made during implementation (Implementer role, step 9):

- **Numbered markers.** Each step's not-done marker shows its number (1–3) where Brainstorm shows
  an icon. The repo has no icon library, and the number also carries the order. A
  screen-reader-only "Not done:" leads each step's link text, because the marker itself is hidden
  from assistive technology.
- **Sentence case kept.** Brainstorm sets its badges and kicker in capitals. Here they keep sentence
  case, so the page shows the approved copy exactly as written in § Copy.
- **The Implementer's gate was scoped, not the full suite.** The diff touches only `ui/src/`, and a
  full `npm test` takes about 53 minutes on this machine and is red by default on suites this diff
  cannot reach (OPEN.md row 191, and `summaries-element-count`). The Implementer ran the 36 suites
  that name the touched files (found by grep of `test/`), plus the UI build, eslint, and a live
  browser pass. That selection missed three suites that walk `ui/src` and read every `.js`/`.jsx`
  file in it (so the three new files, though not `styles.css`): `collapse-into-export-concept`,
  `publish-export-a-concept` and `users-page-neo4j-endpoint`. The Reviewer found them, and the full
  run at review covers them (OPEN.md row `2026-09-21-abbreviated-path-names-no-gate`).

## Linked artifacts
- ADR: none (abbreviated path — the only design choices, routes and copy, are recorded above)
- Test plan: none (abbreviated path)
- Review: `engineering-team/reviews/setup-page-scaffold/1-setup-page-and-placeholders.md`
