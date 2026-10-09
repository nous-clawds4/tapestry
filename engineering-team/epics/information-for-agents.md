# Epic: information-for-agents

**Created:** 2026-10-05
**Status:** Active
**Book:** `engineering-team/audits/information-for-agents/book.md` (acceptance-frame)
**Provenance:** Operator request 2026-10-05 — a page builders can use to ask their own AI agent how to integrate Brainstorm, backed by an agent-readable briefing. Copy and plan agreed in-session the same day.

## Goal

Give a nostr developer a one-step way in: describe the project, copy a prompt, paste it into their own agent. The prompt sends the agent to a markdown briefing served on the same host, which explains what Brainstorm offers (NIP-85 Trusted Assertions, the Open Ranking API, relay whitelists, NIP-50 search, Decentralized Lists, Trusted Lists, GrapeRank), how mature each piece is, and where its normative spec lives.

## Stories

1. `stories/information-for-agents/1-information-for-agents-page-and-briefing.md` — the briefing document, serving it, the `/information-for-agents` page, and the links into it.

## Key facts / guardrails

- **The briefing is the product; the page is the wrapper.** Every tapestry page URL returns an empty SPA shell to a client that doesn't run JavaScript, so the agent reads the `.md`, never the page.
- **The briefing explains and points; it doesn't restate specs.** Each wire format stays normative in one place (NosFabrica/protocols, or `protocols/` here). The briefing summarizes enough to choose, then links. The one exception is the NIP-50 search-extension grammar, which has no markdown home outside the SPA page, so the briefing carries a short summary of it.
- **The briefing sends builders to production endpoints** (`api.brainstorm.world`), whichever host serves it. R&D hosts are labeled as R&D.
- **Same robots.txt carve-out as `llms.txt`.** Non-production hosts disallow everything; some AI fetchers honor that, so the briefing needs its own `Allow:` line or the prompt fails on staging.
- **Out of scope:** hosting on `brainstorm.world` (the Product UI fleet, `NosFabrica/Brainstorm-UI`). It can mirror or redirect later.
