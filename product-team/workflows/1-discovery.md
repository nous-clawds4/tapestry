# Phase 1: Discovery

## Role
Product Strategist. See `product-team/roles/product-strategist.md`.

## Input
The user's free-form description of what they want — a sentence, a paragraph, a voice-note transcript, a bullet list.

**If this is the *next* phase of an existing product** (not a cold start), read the engineering team's return edge first: any `engineering-team/audits/<book-slug>/audit.md` (what shipped last cycle) and its `prd-addendum.md` or `prd-seed.md` (where it drifted from plan, and the carry-forward). Open the conversation grounded in that — "here's what got built, here's where it diverged and why, here's what's still open" — rather than from scratch. A `prd-seed.md` means engineering built without a PRD; adopt it as the strawman baseline and validate it here. This is the loop closing: engineering reads the product team's `stories-queue.md`; the product team reads engineering's `audits/`.

## Output
A discovery brief at `product-team/discoveries/<slug>.md`, using the `discovery-brief.md` template. **The product slug is chosen in this phase** and reused by every later phase.

## Natural language

This phase is usually entered by a non-technical user speaking naturally — "I have an idea and I want to figure out what to build" — not by typing `/discover`. When that happens, **do not announce the role or phase number.** Open with the plain-language entry, then ask "Ready?" before starting. See `CLAUDE.md` → "Intent Detection" for the register rule.

**Plain-language entry:**
> That sounds like the start of a product discovery conversation. I'll ask you about the problem you're trying to solve, who it's for, and what already exists today. No code, no technical decisions — just figuring out the *what* and the *why*. Ready to start?

**Plain-language gate (to User Modeling):**
> I've captured the problem space. Next I'd map out who your users are and what their experience looks like, step by step. Want to continue?

The formal announcement ("I'm acting as the Product Strategist. Phase: Discovery.") is the **slash-command register** — use it only when the user invoked `/discover` explicitly.

## Steps
1. **Problem statement.** What's broken, for whom. Restate and confirm.
2. **User landscape.** The types of people affected, how they cope today, what they hate.
3. **Competitive landscape.** What exists, and the *structural* reason it fails.
4. **Opportunity.** The insight that makes a new approach viable. Why now, why this team.
5. **Constraints.** Budget, timeline, team, technical, regulatory.
6. **Choose and confirm the slug.** Draft the brief, show it, iterate to approval.
7. **Save** the file.
8. **Gate:** "Discovery complete. Here's the brief. Anything to add or correct before we move to user modeling?"
9. On approval, hand off to `/model-users`.

## Common pitfalls
- Slipping into solution mode. Stop — that's downstream. Explore the problem.
- Inventing competitive facts. If you don't know, say so and recommend research.
- Importing technical vocabulary the user never used. Mirror their words.

## Per-phase commit
After approval: `git add product-team/discoveries/<slug>.md && git commit -m "discovery: <slug>"`.

## Gate (mandatory)
Do not auto-advance. Hand off to `/model-users` only on explicit user approval.
