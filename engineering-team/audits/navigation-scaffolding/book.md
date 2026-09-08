# Book of Work: Navigation scaffolding — Dictionaries, Trusted Agents, unified avatar menus

**Slug:** navigation-scaffolding
**Status:** Closed
**Opened:** 2026-09-08
**Closed:** 2026-09-08

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

- [x] The left Tapestry sidebar shows two new collapsible top-level groups **below** Shared
      Concepts: **Dictionaries** (children: Dictionaries, Tags, DLists, Concepts) and
      **Trusted Agents** (children: Mine, All). They toggle open/closed like the existing groups.
- [x] Each of the six new pages renders and says, in plain words, that it is a placeholder.
- [x] Both avatar menus — the **Main** one on the landing/search pages
      (`BrainstormUserMenu`) and the **Tapestry** one in the control-panel header (`Header`) —
      offer every one of: My Profile, My Assistant's Profile, My Treasure Map,
      My Trusted Agents, Dictionaries.
- [x] Both avatar menus carry a **separate section** with: Brainstorm Landing Page,
      Tapestry Dashboard, Legacy Dashboard.
- [x] Every one of those links is visible to **every logged-in user**, not just owner/admin.
      Exception confirmed at intake: My Assistant's Profile renders for everyone but is
      *disabled with an explanatory tooltip* when the caller has no provisioned assistant key.
- [x] From the **Main** avatar menu, My Profile / My Assistant's Profile go to the `/user/<pubkey>`
      pages (the same profile page search results link to). From the **Tapestry** avatar menu they
      keep going to `/tapestry/users/<pubkey>`.
- [x] Navigation on the Legacy pages is untouched.

### Amended 2026-09-08 (operator, after Stories 1–2 shipped)

Two additions raised in-session. Both are inside the book's intent — the same navigation
scaffolding — so they extend the frame rather than opening a second book.

- [x] Trusted Agents carries a third sub-item, **Set Up**, where a Sponsor is paired with an
      Agent. Placeholder like its siblings.
- [x] The Dictionaries index carries the operator's explainer **verbatim** — the first written
      statement of the dictionary model (dictionary = concept with entries as elements, or DList
      header with entries as items for users without neo4j; entry by community usage/acceptance,
      measured per-dictionary and evolving; hence a validity flag on the header for automatic
      removal, and an added-by-hand field so hand-curation survives the scripts).

## Epics in this book
- `navigation-scaffolding` — the two new nav sections with their placeholder pages, and the
  unification of the two avatar menus.

## Provenance
- **Mode:** Acceptance-frame — captured eagerly at intake before any story existed; amended once
  mid-book (see the dated block above) when the operator added the Set Up page and the Dictionaries
  explainer.
- **Confidence at close:** high. Every frame bullet is satisfied by code verified in production;
  the two amendments are recorded in the operator's own words. *(The `prd-seed.md` carries a
  deliberately lower confidence — what shipped is certain, what it implies about the product is not.)*

## Close artifacts
- Build audit: `engineering-team/audits/navigation-scaffolding/audit.md`
- Product feedback: `engineering-team/audits/navigation-scaffolding/prd-seed.md`
- Retro dispositions: `audit.md` §7 — two new OPEN.md `meta` rows (212, 213), one on-branch fix
  (`8bb3e9b0`), three recorded declines.
- Shipped: staging PR #610 (`450d433d`) 2026-09-08; production PR #611 (`b3b84505`) 2026-09-08.
