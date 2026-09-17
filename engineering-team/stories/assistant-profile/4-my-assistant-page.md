# Story 4: One place — the My Assistant page

**Status:** Approved
**Created:** 2026-09-11
**Type:** Feature
**Epic:** `assistant-profile`
**Book:** `engineering-team/audits/assistant-profile/book.md`

## Background

An assistant's profile can be edited in two places that render the same editor: Tapestry Settings →
🤖 Assistant Profile (Owner and Admin only), and a card on the Brainstorm `/settings` page (any
signed-in user — the only route in for Customers). Other surfaces point elsewhere:

- the dashboard's prompt and checklist item link to the Owner/Admin-only tab — a dead end for
  Customers;
- the "This is your Tapestry Assistant — Edit Assistant profile" banner on the assistant's profile
  page links there too;
- "My Assistant's Profile" in both avatar menus opens a read-only profile view (`/user/‹assistant›` or
  `/tapestry/users/‹assistant›`, per navigation-scaffolding #2).

The editor also offers things that cannot work for everyone: the badged-avatar generator is refused
for Customers but tells them they "have no profile picture to stamp", and for Admins it stamps the
Owner's face; an Owner whose assistant key is missing is shown Customer wording.

The owner chose a single dedicated page at planning (2026-09-11).

## User-facing description

As a signed-in Owner, Admin or Customer, I want one "My Assistant" page where I see my assistant, edit
its profile and publish it — reachable from every place that mentions my assistant — so that I never
have to wonder which of several screens is the real one.

## Acceptance criteria

- [ ] Given a signed-in Owner, Admin or Customer with an assistant, then there is one My Assistant page
      where they see their assistant's pubkey, whether its profile is published (story 1's answer),
      its NIP-05 (on a public instance) and a link to its public profile, and where they edit and
      publish its profile and see the per-relay result (story 2). The Owner's page manages the
      instance's Tapestry Assistant.
- [ ] Given each existing entry point — "My Assistant's Profile" in both avatar menus, the dashboard
      prompt and its checklist item, the "Edit Assistant profile" banner on the assistant's profile
      page, the Tapestry Settings "Assistant Profile" tab and the Brainstorm `/settings` card — then
      each leads to that page, and neither Settings area offers an editor of its own.
- [ ] Given a signed-in user without an assistant who is allowed to create one, then they can reach the
      page from the avatar menu and create their assistant there; given one who is not allowed to, the
      menu item stays disabled with its explanation, and the page, if opened directly, explains rather
      than failing.
- [ ] Given any role, then the page offers only actions that can succeed for that role (today,
      generating a badged avatar works only for the Owner), and any failure says what actually
      happened — never, for example, "you have no profile picture" for a refused request.
- [ ] Given a visitor who is not signed in opens the page's address, then they are asked to sign in and
      see no one's assistant controls.

## Concepts touched

None expected — navigation and presentation. `39998:<TA>:nostr-user` is the nearest concept.

## Out of scope

- A visual redesign beyond what the current editor shows — a design pass may follow.
- Badged-avatar generation for Admins and Customers (ta-avatar carry-forward: the generator stamps the
  *Owner's* face). This story only withholds it where it cannot work.
- Removing the other writers — story 5.
- `.dropdown-item:last-child` matching the wrapped disabled menu button — OPEN.md #216; fold it in if
  the menu item's markup is touched.

## Open questions

None. Resolved at approval (2026-09-11): "My Assistant's Profile" in both avatar menus opens the My
Assistant page, which links on to the public profile view. This supersedes navigation-scaffolding #2's
destination for that item (a read-only profile view).

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
