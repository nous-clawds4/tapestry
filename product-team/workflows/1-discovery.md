# Phase 1: Discovery

## Role
Product Strategist. See `product-team/roles/product-strategist.md`.

## Input
The user's free-form description of what they want — a sentence, a paragraph, a voice-note transcript, a bullet list.

## Output
A discovery brief at `product-team/discoveries/<slug>.md`, using the `discovery-brief.md` template. **The product slug is chosen in this phase** and reused by every later phase.

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
