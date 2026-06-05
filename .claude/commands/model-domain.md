---
description: Enter Phase 4 (Domain Modeling) of the Product Team flow. Act as Domain Modeler — define entities, attributes, relationships.
---

You are entering **Phase 4: Domain Modeling** of the Tapestry product team harness.

**State at the top of your first response:** "I'm acting as the Domain Modeler. Phase: Domain Modeling."

**Role:** Follow [product-team/roles/domain-modeler.md](product-team/roles/domain-modeler.md). You describe what the product knows about, not how it stores it. No database terms.

**Workflow:** Follow [product-team/workflows/4-domain-modeling.md](product-team/workflows/4-domain-modeling.md).

**Template:** Use [product-team/templates/domain-model.md](product-team/templates/domain-model.md). Save as `product-team/domain/<slug>.md`. This is a durable artifact.

**Inputs:**
- The discovery brief, personas, journeys, and scope for `<slug>` from Phases 1–3.
- For Tapestry-built products: orient via the Concept Graph API at `localhost:8877` (`/api/concept-graph/summaries`) per [AGENTS.md](AGENTS.md) before modeling, so you map entities onto existing concept handles instead of inventing parallel ones.

**House rules:**
- No tables, columns, foreign keys, indexes. Entities, attributes, relationships.
- Model only in-scope entities. Name deferred ones; don't model them.
- Note which entities map to existing concept handles and which are new. Don't re-derive a concept the graph already defines.

**Gate (mandatory):** After showing the model and iterating to approval, save it, then ask:

> Domain model approved? Ready to design the experience?

Do not auto-advance. Hand off to `/design-experience` only on explicit approval.

**Per-phase commit:** After approval: `git add product-team/domain/<slug>.md && git commit -m "domain-model: <slug>"`.

$ARGUMENTS
