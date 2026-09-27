# The nostr-user-tag schema still requires a string `tagEventId`, but 99 real taggings name their tag by address only and carry `tagEventId: null`

**Id:** 2026-09-27-user-tag-schema-requires-event-id
**Type:** docs
**Opened:** 2026-09-27 (tagging-edges #1, the story's first named departure from the concept schema; ADR 0001 § New debt item 3)
**Status:** OPEN
**Done:** —

**What was seen.** The nostr user tag concept's JSON schema (`39999:<TA>:nostr-user-tag-schema`, installed from
`firmware/versions/v1.0.0/concepts/nostr-user-tag/json-schema.json`) requires `taggedPubkey` and `tagEventId` (:30).
It types `tagEventId` as a string that mirrors the event's `e` tag (:39-45). It calls `tagAddress` optional and
absent on legacy e-only assertions (:46-52). The protocol has since become a-primary. `a` is the tag's stable
identity and `e` is provenance only (`protocols/drafts/tags.md:75-86`).

The census of 2026-09-26 found 99 taggings on production that name their tag by address only. They have no `e` tag,
and their content is `{"nostrUserTag":{"taggedPubkey":…,"tagEventId":null,"tagAddress":…}}`. All 99 are real (no
fixture slugs), by 18 authors, dated 2026-07-25 to 2026-09-26. All carry tags.brainstorm.world's own stamp, so they
were published there. Under the schema they are invalid. The key is present, so `required` passes, but `null` fails
`"type": "string"`. Dropping `tagEventId` from `required` alone would not make them valid. How these 99 came to carry
no `e` was not traced; the current publisher always writes one (`ui/src/utils/publishProfileTag.js:100,106`).

Nothing validates taggings against this schema today. The audit and the concept pages validate a node's `json` tag
in Neo4j (`src/api/audit/index.js:622` onward, `ui/src/pages/concepts/ConceptElements.jsx:141-187`). Taggings keep
their JSON in `content` and are not in Neo4j. So the cost falls on readers: the schema is the documented contract,
and tagging-edges #1 had to name "address-only taggings are accepted" as a departure from it.

**Fix shape.** In the firmware file:
- drop `tagEventId` from `required` and type it `["string", "null"]`;
- rewrite the two descriptions: `tagAddress` is the tag's identity, mirrored from `a`; `tagEventId` is optional
  provenance from `e`, null or absent when the tagging names no version.

Then reinstall firmware on each deployment (AGENTS.md §6). `tag-pinning`'s schema has the same `tagEventId`-required
rule (`firmware/versions/v1.0.0/concepts/tag-pinning/json-schema.json:27`); whether any pin is address-only was not
checked.

**Pointer:** story `engineering-team/stories/tagging-edges/1-tagging-edge-contract.md` § Acceptance criteria
(departure 1); ADR `engineering-team/decisions/tagging-edges/0001-tagging-edge-contract.md` § New debt / follow-ups
item 3; census in `engineering-team/epics/tagging-edges.md` § Key facts.
