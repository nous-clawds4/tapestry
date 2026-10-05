# Story 1: Information for agents — the page and the briefing

**Status:** Draft
**Created:** 2026-10-05
**Type:** Feature

## Background

Builders on nostr increasingly work through a coding agent. Today an agent asked "how do I use Brainstorm in my project?" has nowhere good to start: every page URL on a tapestry host returns an empty SPA shell to a client that doesn't run JavaScript, `llms.txt` is a list of links with no integration guidance, and the `/developers` pages are themselves SPA routes, two of them placeholders.

The operator asked (2026-10-05) for a page, "The Technology Behind Brainstorm," that hands a builder a prompt to paste into their own agent. The prompt sends the agent to a markdown briefing. The page is the wrapper; the briefing is the deliverable.

Plumbing precedent: `llms-txt` #1 (`src/utils/siteTrust.js`, registered in `bin/control-panel.js` ahead of the session middleware and the honest-404 rule) already serves an agent-facing root document and carves it out of non-production `robots.txt`. The page follows the `/developers` pages (`ui/src/pages/developers/`), whose URLs and examples are host-derived so one build works on every host.

## User-facing description

As a developer building on nostr, I want to describe my project and get a prompt I can paste into my AI agent, so that the agent reads an accurate briefing on Brainstorm's scores and protocols and tells me which pieces fit and where to start.

As an AI agent handed that prompt, I want a plain-markdown briefing at a stable URL, so that I can read it without running JavaScript and follow its links to the specs that matter.

## Acceptance criteria

### The briefing

- [ ] Given any tapestry-fleet host, when `GET /information-for-agents.md`, then the response is `200` with `Content-Type: text/plain; charset=utf-8` and the body is the briefing. (Plain text, like `llms.txt` and `raw.githubusercontent.com`: every browser displays it inline, while some download `text/markdown`; agents read both the same.)
- [ ] The briefing has one source file in the repo, `docs/information-for-agents.md`, and the response body is that file's content. Editing the briefing means editing that file.
- [ ] Given the briefing, then it contains: what Brainstorm is (production and R&D sides); the no-global-score idea and its consequences for an integration; one section per integration point (NIP-85 Trusted Assertions, the Open Ranking API, relay whitelists, NIP-50 search, Decentralized Lists, Trusted Lists, GrapeRank, other R&D drafts), each stating its maturity and linking its normative spec; a "where to start" table by project type.
- [ ] Given every link in the briefing, when fetched, then each resolves with a `2xx`.
- [ ] The briefing points rather than duplicates: a wire format's normative text stays in its spec, and the briefing summarizes only what an agent needs to choose. The NIP-50 search-extension grammar is the one exception (its only other home is the SPA page `/developers/nip-50`).
- [ ] The briefing sends builders to production endpoints (`api.brainstorm.world`) and labels R&D-only pieces as such, whichever host serves it.

### Reachability

- [ ] Given a non-production host, when `GET /robots.txt`, then `/information-for-agents.md` is allowed (an `Allow:` line ahead of `Disallow: /`), alongside the existing `/llms.txt` exemption; every other path stays disallowed.
- [ ] Given the production host, when `GET /robots.txt`, then the response is byte-unchanged.
- [ ] Given a host with a configured domain, when `GET /llms.txt`, then it links to `https://<that domain>/information-for-agents.md` with a one-line note on what it is. Given no configured domain (local dev), the link is omitted rather than guessed. Every other `llms.txt` link is unchanged.

### The page

- [ ] Given a browser at `/information-for-agents` (including a direct deep link), then the page renders in the `/developers` pages' style with this copy:

  > **The Technology Behind Brainstorm**
  >
  > Building something on nostr? Brainstorm's web-of-trust scores and the protocols behind them are open, and you can use them in your own project. The fastest way to find out how is to ask your AI agent.
  >
  > Describe your project below, copy the prompt, and paste it into any agent that can read web pages.

- [ ] The page has a text box labeled "What are you building?" Typing in it fills the project slot of the prompt live. With the box empty, the slot reads `<describe your project>`.
- [ ] The prompt reads (host-derived URL):

  > I'm building **{project}**. I'd like to use Brainstorm's web-of-trust technology in it: reputation scores, NIP-85 Trusted Assertions, Decentralized Lists, Trusted Lists, and the other protocols behind them. Read https://{host}/information-for-agents.md and follow its links to the specs that apply to my project. Then tell me which pieces fit, how I'd integrate them, and what to build first. Point out anything that is still a draft. If you can't open web pages, tell me and I'll paste the file in.

- [ ] A "Copy prompt" button copies the prompt exactly as shown and confirms the copy visibly.
- [ ] The page links to the briefing ("Read the briefing yourself") and to `/developers`.

### Links in

- [ ] The `/developers` hub links to `/information-for-agents`.
- [ ] The "Using Your Agent" page (`/brainstorm-skill`) links to `/information-for-agents` for builders.

### Unchanged

- [ ] `security.txt`, the honest-404 rule, and every existing SPA route behave as before. No console errors on the new page.

## Concepts touched

None. Like `llms-txt` #1, this sits at the HTTP and page layer: the briefing and page are identical for every viewer because they describe the protocols and public endpoints, not any POV's view of the graph. The briefing *teaches* the POV-first invariant to outside builders; it doesn't compute anything per POV.

## Out of scope

- Serving the page or briefing on `brainstorm.world` (Product UI fleet, `NosFabrica/Brainstorm-UI`). It can mirror or redirect later.
- Rendering the briefing as formatted HTML inside the page. The link opens the plain-text file.
- Real documentation for the `/developers/trusted-assertions` and `/developers/relay-tools` placeholders.
- Any change to the specs the briefing links to, or to the production API.
- A "copy the whole briefing" button for agents that can't browse. The prompt asks the agent to say so, and the person can paste the file.

## Open questions

1. **Naming the whitelist endpoint.** The briefing names `GET https://api.brainstorm.world/whitelisted/<observer>` as the relay-whitelist API. `developers-pages` #2 (open question 2) held the Relay Tools page back from naming any host "without operator confirmation of the host." The endpoint is in the production API's public OpenAPI document and answered live on 2026-10-05. Needs the operator's yes before ship.
2. **Briefing content review.** The draft at `docs/information-for-agents.md` was written from the specs and the live API on 2026-10-05. Two facts were checked live: the API's ORE `rank` is a 0–1 decimal (NIP-85's `rank` tag is an integer 0–100), and `wss://tapestry.brainstorm.world/relay` answers a WebSocket upgrade. Operator to review.

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
