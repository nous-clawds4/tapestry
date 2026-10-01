# An ADR chose a mechanism that an open ledger row already showed to be broken, and nothing in the ADR phase looks there

**Id:** 2026-09-30-adr-misses-open-ledger-rows
**Type:** meta
**Opened:** 2026-09-30 (my-assistants #2, review 1's Harness friction)
**Status:** OPEN
**Done:** —

ADR my-assistants/0002 chose a NIP-09 kind 5 as its withdrawal, and said in § Consequences that the withdrawn
tagging would stop showing "on the profile pages' Tagging Activity" and everywhere the read looks.

OPEN.md row `2026-09-27-revokes-do-not-travel`, open since 2026-09-27, already showed that a kind 5 never leaves its
instance:
- the router's tag streams are `#z`-filtered, and a deletion has no `z`;
- no stream carries kind 5.

Review 1 caught it, and the owner then had to re-decide book decision 7 (Amendment 1). The miss cost a full round:
Architecture, Test Design, Implementation and Review again.

Neither `engineering-team/workflows/2-architecture.md` nor `templates/adr.md` asks the Architect to search `OPEN.md`
or `ledger/` for the mechanisms a design relies on. The orientation ladder (concept graph, then source) never
reaches the ledger.

**Fix shape:** add a step to workflow 2, with a matching line in the ADR template's Context section:
- `git grep -il '<mechanism>' ledger/ OPEN.md` for each mechanism the decision depends on (here: "kind 5", "revoke",
  "router stream");
- cite every open row found, or say that none was found.

**Pointer:** `engineering-team/reviews/my-assistants/2-tag-and-untag-from-the-page.md` § Harness friction;
`engineering-team/decisions/my-assistants/0002-tag-and-withdraw-from-the-browser-the-read-carries-what-they-need.md`
§ Amendment 1.
