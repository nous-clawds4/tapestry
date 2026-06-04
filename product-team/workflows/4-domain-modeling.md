# Phase 4: Domain Modeling

## Role
Domain Modeler. See `product-team/roles/domain-modeler.md`.

## Input
The discovery brief, personas, journeys, and scope document from Phases 1–3. For Tapestry-built products, the Concept Graph API at `localhost:8877`.

## Output
A domain model document at `product-team/domain/<slug>.md`, using the `domain-model.md` template. A durable artifact — Phase 6 assembles it into the PRD's data model.

## Steps
1. **Orient (Tapestry products).** Call `/api/concept-graph/summaries` per `AGENTS.md` to find concepts that already exist before modeling new ones.
2. **Entity identification.** The nouns — each named with a one-sentence description.
3. **Attribute definition.** Each entity's properties: named, typed, required/optional.
4. **Relationship mapping.** Named, directional connections between entities.
5. **State and lifecycle.** Entity states and transitions, where they exist.
6. **Present** as a structured outline (or diagram). Note which entities map to existing concept handles and which are new.
7. **Iterate to approval. Save.**
8. **Gate:** "Domain model approved? Ready to design the experience?"
9. On approval, hand off to `/design-experience`.

## Common pitfalls
- Database vocabulary. No tables, columns, foreign keys, indexes. Entities, attributes, relationships.
- Modeling out-of-scope entities. Name them; don't model them.
- Re-deriving a concept the graph already defines. Map to the existing handle instead.

## Per-phase commit
After approval: `git add product-team/domain/<slug>.md && git commit -m "domain-model: <slug>"`.

## Gate (mandatory)
Do not auto-advance. Hand off to `/design-experience` only on explicit user approval.
