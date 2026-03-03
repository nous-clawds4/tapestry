# Canonical Concept Audit

**Date:** 2026-03-02  
**Status:** 1/11 complete

## Scoring

Each concept is checked for 6 requirements:
1. ✅ **ListHeader** — kind 39998 event exists
2. ✅/❌ **Superset** — a superset item exists with IS_THE_CONCEPT_FOR relationship
3. ✅/❌ **Schema item** — a JSON Schema item exists with IS_THE_JSON_SCHEMA_FOR relationship
4. ✅/❌ **Schema JSON** — the schema item has a `json` tag with actual JSON Schema content
5. ✅/❌ **Properties** — at least one property exists with IS_A_PROPERTY_OF relationship to the schema
6. ✅/❌ **Elements** — at least one element exists (item with z-tag pointing to this concept)

## Results

| Concept | Header | Superset | Schema | JSON | Props | Elements | Score |
|---------|--------|----------|--------|------|-------|----------|-------|
| **graph** | ✅ | ✅ | ✅ | ✅ | ✅ (4) | ✅ (1) | 🟢 6/6 |
| property | ✅ | ✅ | ✅ | ❌ | ✅ (1) | ✅ (104) | 🟡 5/6 |
| relationship | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ (243) | 🟠 4/6 |
| relationship type | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ (9) | 🟠 4/6 |
| superset | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ (75) | 🔴 3/6 |
| set | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ (10) | 🔴 3/6 |
| JSON schema | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ (8) | 🔴 3/6 |
| node type | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ (10) | 🔴 3/6 |
| JSON data type | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ (7) | 🔴 3/6 |
| graph type | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ (4) | 🔴 2/6 |
| list | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | 🔴 2/6 |

## Gap Analysis

### Most common gap: Schema JSON (10/11 missing or incomplete)
Only `graph` has a fully populated JSON schema with actual content. All others either lack a schema item entirely or have a schema item without the `json` tag content.

### Missing schemas entirely (no schema item + IS_THE_JSON_SCHEMA_FOR relationship):
- superset
- set
- JSON schema (meta!)
- node type
- JSON data type
- graph type
- list

### Have schema item but missing JSON content:
- property (has "JSON schema for properties" but no json tag)
- relationship (has "JSON schema for relationships" but no json tag)
- relationship type (has "JSON schema for relationship types" but no json tag)

### Missing properties:
- All except `graph` (4 props) and `property` (1 prop: "type")
- `relationship` and `relationship type` have schema items but no properties linked

### Missing superset:
- graph type — needs "the superset of all graph types" in the superset concept

### Missing elements:
- list — has no items yet

## Relationship Types ✅
All 6 canonical relationship types exist:
- IS_THE_CONCEPT_FOR (class thread initiation)
- IS_A_SUPERSET_OF (class thread propagation)
- HAS_ELEMENT (class thread termination)
- IS_A_PROPERTY_OF
- IS_THE_JSON_SCHEMA_FOR
- ENUMERATES

## Graph Types
4 graph types defined (elements of "graph type"):
- concept graph graph (the master bootstrap)
- concept core nodes graph
- concept class threads graph
- property tree graph

Only 1 graph instance exists so far: "graph for the dog concept"

## Priority Order for Completion

1. **property** — only needs schema JSON content (closest to done)
2. **relationship** — needs schema JSON + properties
3. **relationship type** — needs schema JSON + properties
4. **graph type** — needs superset + schema + properties
5. **superset** — needs schema + properties
6. **set** — needs schema + properties
7. **JSON schema** — needs schema + properties (meta-circular!)
8. **node type** — needs schema + properties
9. **JSON data type** — needs schema + properties
10. **list** — needs schema + properties + elements
