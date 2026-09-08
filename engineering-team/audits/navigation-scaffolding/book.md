# Book of Work: Navigation scaffolding — Dictionaries, Trusted Agents, unified avatar menus

**Slug:** navigation-scaffolding
**Status:** Open
**Opened:** 2026-09-08
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD).** The operator's ask, restated and confirmed at intake 2026-09-08.
Two halves, in order: first the new placeholder surfaces, then the avatar-menu rework.

The raw ask, verbatim in its shape:

> On the left hand Tapestry menu, under Shared Concepts, I would like to see two new top-level
> menu items, each of which toggles open or closed to show sub-menu items, similar to most of the
> other items on the menu: **1. Dictionaries** — Dictionaries, Tags, DLists, Concepts;
> **2. Trusted Agents** — Mine, All. For now, just indicate that each of the new pages is a
> placeholder page.
>
> I would like to update both avatar menus so that I have easy access to the following pages:
> My Profile, My Assistant's Profile, My Treasure Map, My Trusted Agents, Dictionaries. And in a
> separate section on the avatar menu: a link to the Brainstorm Landing Page, a link to the
> Tapestry Dashboard, a link to the Legacy Dashboard.

### Acceptance frame

- [ ] The left Tapestry sidebar shows two new collapsible top-level groups **below** Shared
      Concepts: **Dictionaries** (children: Dictionaries, Tags, DLists, Concepts) and
      **Trusted Agents** (children: Mine, All). They toggle open/closed like the existing groups.
- [ ] Each of the six new pages renders and says, in plain words, that it is a placeholder.
- [ ] Both avatar menus — the **Main** one on the landing/search pages
      (`BrainstormUserMenu`) and the **Tapestry** one in the control-panel header (`Header`) —
      offer every one of: My Profile, My Assistant's Profile, My Treasure Map,
      My Trusted Agents, Dictionaries.
- [ ] Both avatar menus carry a **separate section** with: Brainstorm Landing Page,
      Tapestry Dashboard, Legacy Dashboard.
- [ ] Every one of those links is visible to **every logged-in user**, not just owner/admin.
      Exception confirmed at intake: My Assistant's Profile renders for everyone but is
      *disabled with an explanatory tooltip* when the caller has no provisioned assistant key.
- [ ] From the **Main** avatar menu, My Profile / My Assistant's Profile go to the `/user/<pubkey>`
      pages (the same profile page search results link to). From the **Tapestry** avatar menu they
      keep going to `/tapestry/users/<pubkey>`.
- [ ] Navigation on the Legacy pages is untouched.

## Epics in this book
- `navigation-scaffolding` — the two new nav sections with their placeholder pages, and the
  unification of the two avatar menus.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** high

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/navigation-scaffolding/audit.md`
- Product feedback: `engineering-team/audits/navigation-scaffolding/prd-seed.md`
