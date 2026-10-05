# Book of Work: Information for agents

**Slug:** information-for-agents
**Status:** Open
**Opened:** 2026-10-05
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD).** Operator request 2026-10-05: a page titled "The Technology Behind Brainstorm" at `/information-for-agents` that invites a nostr builder to describe their project and paste a prompt into their own AI agent; the prompt points the agent at a markdown briefing about Brainstorm's reputation metrics and protocols. Agreed in-session: build it in this repo (staging first, then `tapestry.brainstorm.world`); the prompt names whichever host serves the page; `brainstorm.world` can mirror or redirect once it has proven itself.

### Acceptance frame

- [ ] `/information-for-agents` shows the agreed copy, a "what are you building?" box that fills the prompt as you type, and a copy button.
- [ ] The prompt names the briefing on the same host the page is served from.
- [ ] `/information-for-agents.md` serves the briefing as plain text on every tapestry-fleet host, including the non-production ones whose `robots.txt` otherwise disallows everything.
- [ ] The briefing covers what Brainstorm is, the no-global-score idea, each integration point with its maturity and spec link, and a "where to start" table — and every link in it resolves.
- [ ] `llms.txt`, the `/developers` hub, and the "Using Your Agent" page link to it.
- [ ] Verified live on staging, then on `tapestry.brainstorm.world` after the operator promotes it.

## Epics in this book
- `information-for-agents` — the briefing, its route, the page, and the links into them.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/information-for-agents/audit.md`
- Product feedback: `engineering-team/audits/information-for-agents/prd-seed.md`
