# The firmware's relationship-type concept registers AUTHORS, REFERENCES and HAS_TAG but none of the NostrUser-to-NostrUser types: FOLLOWS, MUTES, REPORTS and the new TAGS

**Id:** 2026-09-27-register-social-relationship-types
**Type:** cleanup
**Opened:** 2026-09-27 (tagging-edges #1, ADR 0001 sub-decision on registering `TAGS`)
**Status:** OPEN
**Done:** —

**What was seen.** `firmware/versions/v1.0.0/concepts/relationship-type/elements/` holds 14 element files (class-thread,
core-node wiring, property and nostr types). The concept's own `manifest.json:43-62` puts five of them in the `nostr`
set: `authors`, `references`, `has-tag`, `class-thread-propagation` and `class-thread-termination`. The local graph
agrees (2026-09-27): `/api/concept-graph/node/39999:<TA>:the-set-of-relationship-types-for-nostr/neighbors` lists
exactly those five elements. FOLLOWS, MUTES and REPORTS have no element anywhere under `firmware/`
(`git grep -w -E 'FOLLOWS|MUTES|REPORTS|TAGS' -- firmware/` finds nothing), although the stream consumer, the batch
transfer and the reconciliation scripts all write them, and BIBLE §6 now lists them beside `TAGS`. ADR
`tagging-edges/0001` deferred `TAGS` for that reason: registering one of the four alone would be inconsistent.

Nothing checks a write against this concept. Writers use literal type names, and `relAlias`
(`src/api/normalize/firmware.js:71`) reads only the top-level `relationshipTypes` list
(`firmware/versions/v1.0.0/manifest.json:623`), which does not hold AUTHORS, REFERENCES or HAS_TAG either. The gap is
in the graph's description of itself, not in any behaviour, so there is no ordering constraint with the tagging-edges
stories.

A handle note: the set's node is `39999:<TA>:the-set-of-relationship-types-for-nostr` (its `word.slug`). The ADR's
orientation call names `39999:<TA>:relationship-types-for-nostr` (its `set.slug`), which answers with no neighbours.

**Fix shape.** Four element files beside `authors.json`: `follows.json`, `mutes.json`, `reports.json` and `tags.json`.
Each has `nodeFromType` and `nodeToType` `nostrUser`, `category` `nostr`, and its source kind in the description (3,
10000, 1984, and 39999 with the `nostr-user-tag` stamp). Add four `HAS_ELEMENT` entries from `nostr` in the concept
manifest, then reinstall firmware (AGENTS.md §6). The three nostr types already registered are not in the top-level
`relationshipTypes` list, so deciding whether the four join that list belongs to the same change.

**Pointer:** ADR `engineering-team/decisions/tagging-edges/0001-tagging-edge-contract.md` § "Sub-decision —
registering `TAGS` in the relationship-type concept" and § Consequences, "New debt / follow-ups" item 2;
`firmware/versions/v1.0.0/concepts/relationship-type/`.
