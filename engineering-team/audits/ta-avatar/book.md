# Book of Work: A recognizable Tapestry Assistant avatar

**Slug:** ta-avatar
**Status:** Open
**Opened:** 2026-08-06
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD)** — the owner's ask, restated and confirmed at kickoff (2026-08-06):

> Make the Tapestry Assistant's avatar fun, interesting, and importantly, recognizable. Seeing it
> should tell you two things: who the corresponding nostr user associated with the TA is, and that
> it is a TA. The idea: take the user's (owner's) avatar and stamp it with something recognizable —
> the brain-with-a-lightning-bolt mark we already use — off to one side. Scope, chosen explicitly at
> kickoff: the **full composite, published** — the stamped image itself becomes the TA's published
> profile picture, so third-party nostr clients see it too, not only our own UI.

### Acceptance frame

- [ ] Anywhere the Tapestry UI shows the TA as an author, its avatar is instantly recognizable: the
      owner's avatar stamped with the brain-and-lightning mark — a glance tells you *whose*
      assistant it is and *that* it is the assistant.
- [ ] The TA's published nostr profile carries a real, recognizable picture and an owner-linked
      name — culminating in the stamped composite itself, so any third-party nostr client shows the
      owner's avatar wearing the badge.
- [ ] When an ingredient is missing (the owner has no avatar; the instance has no public address),
      what appears or gets published degrades to something branded and honest — never a blank disc,
      a broken image, or a dead link.

## Epics in this book

- `ta-avatar` — the badged/stamped TA avatar, in-app and on nostr (three ordered stories).

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/ta-avatar/audit.md`
- Product feedback: `engineering-team/audits/ta-avatar/prd-seed.md`
