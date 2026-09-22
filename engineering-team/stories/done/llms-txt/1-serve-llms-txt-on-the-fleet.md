# Story 1: Serve llms.txt on the fleet

**Status:** Done
**Created:** 2026-09-22
**Type:** Feature

## Background

[llms.txt](https://llmstxt.org/) is a root-level, curated markdown map of key documents for visiting AI agents. `NosFabrica/protocols#6` tracks adding one to every host across the Brainstorm/Tapestry estate; this story covers the four tapestry-fleet hosts served from this repo (`tapestry.`, `staging.`, `tags.`, `magic-carpet.brainstorm.world`).

`site-trust-signals` (closed 2026-09-22) already built the plumbing this needs: `src/utils/siteTrust.js` renders `security.txt` and `robots.txt` as pure, unit-testable functions, registered ahead of a shape-based 404 rule that keeps the SPA catch-all from swallowing every root document. `llms.txt` is a third document through the same plumbing — same file, same registration pattern, same honest-404 guarantee for everything it doesn't cover.

Today, fetching `/llms.txt` on any tapestry host returns the SPA shell's ~470-byte contentless HTML (confirmed live, 2026-09-21), which tells a visiting agent nothing.

## User-facing description

As an AI agent (or a developer's coding assistant) visiting a tapestry-fleet host, I want a single well-known file that points me to the estate's normative specs and this repo's own orientation docs, so that I don't have to scrape a JavaScript single-page app's empty shell to find them.

## Acceptance criteria

- [ ] Given any tapestry-fleet host, when `GET /llms.txt`, then the response is `200` with `Content-Type: text/plain; charset=utf-8`.
- [ ] Given that response, then its content follows the llmstxt.org format in order: an H1 title, a blockquote summary, zero or more plain (non-heading) notes, then `##`-delimited sections each containing a markdown list of `[name](url): note` links.
- [ ] Given that response, then it contains exactly these links, organized into these sections (rationale in parentheses; not implementation detail — this is the deliverable's content):
  - **`## Protocols`** — `NosFabrica/protocols`, raw markdown:
    - `CONCEPTS.md` (the model behind every spec — start here)
    - `specs/trusted-assertions.md` (companion to NIP-85; how to find and read published trust scores)
    - `specs/graperank.md` (how personalized trust scores are computed)
    - `ECOSYSTEM.md` (canonical inventory of hosts and repos)
  - **`## Tapestry`** — this repo, raw markdown:
    - `README.md` (what Tapestry is, how to self-host)
    - `AGENTS.md` (orientation for coding agents)
    - `protocols/README.md` (this repo's pre-NIP drafting workshop)
    - `nous-clawds4/tapestry-cli`'s `README.md` (CLI for agents curating concepts)
  - **`## Optional`** (secondary — an agent may skip these for a shorter context):
    - this repo's `BIBLE.md` (full architecture/data-model/API reference; note its size and that its table of contents should be read first)
    - `nous-clawds4/brainstorm-cli`'s `README.md` (CLI for agents using the production backend)
    - the production OpenAPI document at `https://api.brainstorm.world/openapi.json`
    - this repo's `SECURITY.md` (vulnerability reporting; which hosts this codebase serves)
- [ ] Given that response's blockquote and notes, then they state: Tapestry is a personalized web-of-trust system for nostr computing GrapeRank scores from a chosen observer's point of view; the site is a JavaScript SPA whose page URLs return an empty shell to non-JS clients, so an agent should read the linked documents instead of scraping pages; there is no global trust score — every score is from a specific point of view.
- [ ] Given the production host, when `GET /robots.txt`, then behavior is unchanged from `site-trust-signals` (crawling permitted).
- [ ] Given any non-production host, when `GET /robots.txt`, then `/llms.txt` is explicitly exempted from the blanket `Disallow: /` (an `Allow: /llms.txt` line, or equivalent, ahead of the disallow), while every other path remains disallowed.
- [ ] Given every link in the shipped `llms.txt`, when fetched, then each resolves with a `2xx` status. Verified at ship time; the ongoing check is Test Design's to place in the renewal ritual that owns `security.txt`'s `Expires` field (OPEN.md row 172).
- [ ] Given any probe or asset-shaped path, or any existing SPA route, then `site-trust-signals`'s honest-404 and SPA-passthrough behavior is unaffected by this story's changes.

## Concepts touched

None. Like `site-trust-signals`, this story sits at the HTTP layer: the response is identical for every viewer because it states facts about the deployment and about publicly available documents, not about any POV's view of the graph. It is deliberately outside the four architecture invariants, not an exception to them.

## Out of scope

- Duplicating linked documents' text into `llms.txt` itself. The estate discrepancy rule applies: `llms.txt` only points, `ECOSYSTEM.md` (and each linked file) stays the one normative copy.
- An `llms-full.txt` variant (a full-text concatenation). Considered and rejected: it would create a second copy of every linked document that drifts independently of the first.
- The Product UI fleet (`NosFabrica/Brainstorm-UI`, nginx), the relay fleet, and the API-host fleet — same estate issue, different repositories, tracked in the book.
- Blanket-enabling `ALLOW_INDEXING` or otherwise changing what `robots.txt` says about indexing. This story only carves out one named path.
- The two hosts decommissioned 2026-09-12 (`communities.`, `curate.brainstorm.world`).

## Open questions

None outstanding. Resolved with the operator at Planning on 2026-09-22:

- **robots.txt interaction** → `/llms.txt` is exempted from non-production hosts' `Disallow: /`. It's a deliberate-agent affordance, not a search-indexing signal.
- **Content inventory** → the 12 links above, verified live and resolving on 2026-09-22 (session research, carried into this story rather than re-derived at Architecture).
- **Content-type** → `text/plain; charset=utf-8`, matching `security.txt` and `robots.txt` precedent in this repo.

## Linked artifacts
- ADR: `engineering-team/decisions/done/llms-txt/0001-serve-llms-txt-on-the-fleet.md`
- Test plan: `engineering-team/stories/done/llms-txt/1-serve-llms-txt-on-the-fleet.test-plan.md`
- Review: `engineering-team/reviews/done/llms-txt/1-serve-llms-txt-on-the-fleet.md`
