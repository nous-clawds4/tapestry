# Phase 7: Story Decomposition

## Role
Product Lead. See `product-team/roles/product-lead.md`.

## Input
The assembled PRD at `product-team/prd/<slug>.md`.

## Output
A stories queue at `product-team/stories-queue.md` — all story briefs in dependency order, grouped into **epic-aligned blocks**, each brief using the `story-brief.md` template.

## Natural language

Reached by continuing from PRD Assembly, or a user saying "let's start building" / "break it into tasks." **Do not announce the role or phase number** for a natural-language user. Avoid "story," "acceptance criteria," "epic" — say "buildable pieces," "what done looks like," "chunks of work."

**Plain-language entry:**
> Let me break the product into a sequence of buildable pieces — each one a small, self-contained chunk you can see working — ordered so the team can start with something they can show you early.

**Plain-language gate (engineering handoff):**
> I've broken it into [N] pieces across [M] chunks of work, in the order I'd build them. From here the engineering side takes over — that part is best run by someone comfortable with the build, or I can walk a technical teammate through it. Want me to hand this to the engineering team now, or pause here so you can review the plan first?

If the user is non-technical and there's no engineer in the loop, say so plainly: the product work and documents are done and ready; building from here needs a technical person (or a session where one drives the engineering flow). Don't start engineering phases on their behalf without that.

The formal announcement ("I'm acting as the Product Lead. Phase: Story Decomposition.") is the **slash-command register** — use it only when the user invoked `/decompose-stories` explicitly.

## Steps
1. **Identify story boundaries.** One screen, one feature, or one system capability per story — small enough for a single engineering cycle, large enough to deliver observable change.
2. **Order by dependency.** Unblocking stories first. The result is a sequenced backlog, not a list.
3. **Group into blocks that map onto engineering epics.** Each block = one future `engineering-team/epics/<epic-slug>.md`. Name the suggested `epic-slug` in each brief.
4. **Write story briefs** per the template: one-sentence description, PRD section(s), persona(s), testable acceptance criteria, dependencies, notes for engineering.
5. **Show the queue.** Iterate to approval. **Save.**
6. **Gate:** "Story queue complete. [N] stories across [M] blocks. Review the sequence. Ready to hand off to the engineering team?"

## Handoff to the engineering team

The seam is **deliberately one-directional and doc-driven** — the product flow does not write into `engineering-team/`. On approval:

1. The engineering team's Product Owner reads `product-team/stories-queue.md`.
2. For each block, the PO creates the matching `engineering-team/epics/<epic-slug>.md` umbrella and an `engineering-team/stories/<epic-slug>/` folder.
3. The PO promotes each story brief into a formal story via `/plan-feature`, referencing the PRD (`product-team/prd/<slug>.md`) and the guides for context. Story numbers are per-epic; the queue's order becomes the pickup order.
4. The PO does **not** dump briefs into `engineering-team/stories/_intake.md` — under the current engineering flow, `_intake.md` is optional scratch space, and the mechanistic path is to promote work straight into an epic folder.

## Common pitfalls
- Implementation in the criteria. "A user can add a book to their shelf," not "create a kind-39999 event."
- Untestable criteria. Each is input → expected behavior, verifiable from outside.
- Oversized stories. More than 7 acceptance criteria means split it.
- A first block that can't be demoed. The first story must prove the product works end-to-end, even minimally.

## Per-phase commit
After approval: `git add product-team/stories-queue.md && git commit -m "stories-queue: <slug>"`.

## Gate (mandatory)
Do not auto-advance into engineering. The handoff is the user's call.
