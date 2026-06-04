# Domain Model: <Product Name>

**Slug:** <slug>
**Date:** <DATE>
**Modeler phase:** Domain Modeling (Phase 4)

> Conceptual model only — what the product knows about, not how it stores it. No tables, columns, foreign keys, or indexes.

## Entities
Each entity, its one-sentence description, and (for Tapestry products) whether it maps to an existing concept handle or is new.

### <Entity>
- **Description:** one sentence.
- **Concept mapping:** `kind:pubkey:slug` (existing) | new
- **Attributes:**
  | Attribute | Type | Required | Notes |
  |---|---|---|---|
  | <name> | text / number / date / URL / ref:<Entity> | yes/no | |

## Relationships
Named and directional.

- <Entity A> **<verb>** <Entity B> (e.g., "User **rates** Book")

## States and lifecycle
Entities that move through states.

- **<Entity>:** <state> → <state> → <state>

## New vs. existing (Tapestry products)
- **Maps to existing concepts:** <entities>
- **Genuinely new:** <entities>
