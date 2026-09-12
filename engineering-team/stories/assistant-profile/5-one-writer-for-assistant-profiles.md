# Story 5: One writer — nothing else can change an assistant's profile

**Status:** Approved
**Created:** 2026-09-11
**Type:** Feature
**Epic:** `assistant-profile`
**Book:** `engineering-team/audits/assistant-profile/book.md`

## Background

Besides the editor, three things write an assistant's kind 0 today:

- **The dashboard's "🎲 Surprise me" button** (Owner and Admin). It builds a profile in the browser
  with its own defaults (a robohash picture, no NIP-05, no website) and has the server sign it as the
  instance TA — to the local relay only, so afterwards the local relay and the network disagree about
  the TA's profile. It is also the one route by which an Admin can change the TA's profile, which the
  regular publish action refuses them: the generic sign-as-assistant endpoint gates on `isOwner`, and
  `isOwner` is owner-*or*-admin (`src/middleware/auth.js:276-293`).
- **The legacy NIP-85 page** (`/legacy/nip85.html`) **and customer page** (`/legacy/customer.html`),
  still served though no longer linked from the React UI. Their assistant panels publish with no
  content, so the server's defaults overwrite whatever the user last published.
- **The generic "publish as the assistant" endpoint itself**, which signs any kind — kind 0 included —
  for an Owner or Admin session.

Each one bypasses part of stories 1–3: the one default definition, the configured relay set, the
per-relay report, the NIP-05 and the client tag.

## User-facing description

As an Owner, Admin or Customer, I want my assistant's profile to change only when I publish it from
the My Assistant page, so that nothing — an old page, a stray button, a script — can quietly replace
it with something else.

## Acceptance criteria

- [ ] Given the dashboard, then it offers no way to write the assistant's profile; its only assistant
      action is the link to the My Assistant page.
- [ ] Given the legacy NIP-85 and customer pages, then they no longer publish an assistant profile;
      where they showed the assistant panel, they show at most its read-only status and a link to the
      My Assistant page.
- [ ] Given any request to sign an assistant kind 0 other than the My Assistant page's publish action —
      including through the generic sign-as-assistant endpoint — then it is refused with an
      explanation, and no event is written anywhere.
- [ ] Given an Admin, then no route lets them change the instance Tapestry Assistant's profile, and
      they can still manage their own assistant's.
- [ ] Given this story ships, then no existing published profile changes.

## Concepts touched

None.

## Out of scope

- Whether Admins should be able to sign *other* kinds as the instance TA through the generic endpoint
  (its comment and ADR security-auth-exposure/0002 say owner-only; the code admits Admins) → OPEN.md
  #269.
- How in-container operator tooling publishes an assistant profile, if it needs to at all —
  Architecture decides; any such route must still apply stories 2 and 3.
- Removing the legacy pages altogether.

## Open questions

None.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
