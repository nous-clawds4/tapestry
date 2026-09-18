# Story 7: A `github-account` firmware concept pointing at the community list

**Status:** Draft
**Created:** 2026-09-17
**Type:** Feature *(Light lane — workflows/light-profile.md. **Irreversibility trigger named:** this
is a **firmware/schema change** (a new manifest concept + a `communityReference` seed that
republishes a TA-signed kind-39998 header). The book is Light as of 2026-09-17, so the story stays
in the Light lane and the **Design note carries ADR-grade detail** — the same treatment story 5 gave
its trigger before it was written up as `decisions/dlist-item-tagging/0003-item-trusted-lists-implementation.md`.
Gate A ratifies or escalates.)*

## Background

The book's frame ends at a downstream search indexer (Vespa, other repo) consuming item taggings.
Today the only thing that indexer could subscribe to is a **bare coordinate** —
`39998:b83a28b7e4e5d20bd960c5faeb6625f95529166b8bdb045d42634a2f35919450:github-accounts`, the curate
client's community list (live on local strfry: `["d","github-accounts"]`,
`["names","GitHub Account","GitHub Accounts"]`, `["required","github-username"]`,
`["field-type","github-username","text"]`; 7 items per
`GET /api/dlists/page-counts?coords=…github-accounts`). A bare coordinate is not a concept: it has no
local twin in the concept graph, no class thread, and nothing the deployment can reason about
per-POV.

Firmware already has the primitive for exactly this. A manifest concept may carry a
`communityReference` `{ headerATag, relayHints[], knownGoodEventId? }`
(`firmware/versions/v1.0.0/manifest.json:218-231` for the `nostr-relay` pilot). At install,
`pass_communityReferences` (`src/firmware/install.js:1001-1061`) scans the **local TA-authored**
header (`{kinds:[39998], authors:[<runtime TA>], '#d':[<slug>]}`), and — never-clobber, only if no
`b` of any type is present — appends `["b", "<headerATag>", "pointer"]`, re-signs with the TA key
and republishes; `buildImportCypher` then derives `(localHeader)-[:REFERENCES {source:'b-tag'}]->(target)`.
Six concepts carry one today (`b-tag-primitive.test.js:356-366`). Semantics and the
pointer-carries-zero-consensus-weight rule: **BIBLE.md:1555-1579**; federation mechanism:
`protocols/drafts/event-taggings.md:264-274`.

The second reason is **semantic field types**. Story 1 ships only the generic vocabulary
(`field-type` → `text|url`, `ui/src/utils/dlistFields.js:9-15`); the name-based "render
`github-username` as a GitHub link" rule was deliberately **stripped at Gate B** because semantic
types belong in the concept graph, not in code. Worksheet **W17** (`protocols/worksheet.md:170-176`)
tracks `field-type` itself; **W18** (`:178-238`) proposes that a type definition declare a portable
*affordance* — a `url-template` such as `https://github.com/{github-username}` — and names *this
story* as "the first place a type definition could live." A firmware concept can carry those
declarations on its own header today: `headerTags` in a concept-header emits literal tags onto the
TA-signed 39998 header (`src/api/normalize/index.js:1267-1273`; precedent
`firmware/versions/v1.0.0/concepts/trusted-list-for-tag/concept-header.json:20-23`).

**On the foreign pubkey literal.** CLAUDE.md forbids hardcoding *the TA pubkey* — the per-deployment
identity that the signer resolves at runtime. `b83a28b7…` is **not any deployment's TA**; it is a
third-party curator's pubkey, and naming an external curator is precisely what `communityReference`
is for — the BIBLE calls it "the boundary-rule-sanctioned home for hardcoded handle literals"
(BIBLE.md:1555). It lives as **manifest data**, alongside the five existing literals, never in code;
the local twin's identity still comes from `firmware.getTAPubkey()` at install time
(`src/firmware/install.js:1004`). See also OPEN #223 on the stale-literal confusion this exact
distinction caused.

## User-facing description

As the operator of a Tapestry deployment, I want `github-account` to be a first-class concept in my
concept graph that is affiliated with the community's GitHub-accounts list, so that a downstream
search indexer can subscribe to a **concept** (and learn how to turn a `github-username` into a
visitable link) instead of hardcoding a coordinate and a rendering rule.

## Acceptance criteria

- [ ] AC-1: Given a fresh firmware install, when it completes, then a `github-account` concept
      exists in the graph — returned by `GET /api/concept-graph/summaries` with its name,
      description and a class thread, like every other manifest concept.
- [ ] AC-2: Given the concept's manifest entry, then it carries a `communityReference` whose
      `headerATag` is the community list coordinate
      `39998:b83a28b7…:github-accounts` plus relay hints, as manifest **data**; no pubkey literal is
      introduced in any `.js` file.
- [ ] AC-3: Given install runs against a local TA header with no `b` tag, when
      `pass_communityReferences` completes, then the local `github-account` header carries exactly
      one `["b","39998:b83a28b7…:github-accounts","pointer"]`, TA-signed at runtime, and the graph
      shows `(localHeader)-[:REFERENCES {source:'b-tag'}]->(…)`. Re-running install leaves exactly
      one `b` and one edge (idempotent in outcome).
- [ ] AC-4: Given the community header is unreachable or pin-verify fails, when install runs, then
      the local pointer-`b` is still seeded and install does not throw (graceful — BIBLE.md:1559).
- [ ] AC-5: Given the concept's own header, then it declares the field semantics agreed at Gate A
      (at minimum `required github-username` and its `field-type`), readable from the published
      header by an outside consumer with no app code.
- [ ] AC-6: Given the existing communityReference scope guards
      (`test/b-tag-primitive.test.js:356`, `test/b-tag-seeds.test.js:200`), then they are widened to
      the sanctioned 7-concept set and pass — a *deliberate* widening, not a loosening (they still
      fail on an eighth, unreviewed concept).
- [ ] AC-7: Every existing concept, its `communityReference`, and every existing published header is
      unchanged (regression sentinel).

## Concepts touched

- **New:** `39998:<runtime TA>:github-account` — the local twin.
- **Referenced (foreign, manifest data):** `39998:b83a28b7…:github-accounts` — the community list.
- Existing, untouched: `39998:<TA>:nostr-relay`, `…:tag`, `…:nostr-user-tag`, `…:tag-pinning`,
  `…:nostr-event-tag`, `…:tagging-with-specific-tag` (the six that carry a `communityReference`),
  and `…:trusted-list` / `…:trusted-list-for-tag` (story 5, which deliberately carry none).

## Out of scope

- **The downstream indexer.** No Vespa work, no subscription code, no export endpoint.
- **A field-type registry.** W18's "types as a DList", POV-resolved type definitions, multi-parameter
  templates, resolver affordances beyond URL, and template-safety rules (scheme allowlist,
  percent-encoding, `javascript:`/`data:` ban) all stay in the worksheet. This story may **declare**
  one concrete affordance on one concept's header; it defines no vocabulary others must follow and
  changes no spec.
- **Ratifying `field-type` into the NIP** (W17) — unchanged by this story.
- **Migrating existing concepts** to new declarations; any change to the six existing
  `communityReference` entries.
- **Rendering** — pending OQ-4; if deferred there, no change to story 1's table or any UI file.
- Item-level import of the community list's 7 items (pending OQ-2).

## Open questions *(for Gate A — each with a recommendation)*

1. **What field declarations does the concept's header carry?**
   *Recommendation:* mirror the community header's declaration (`["required","github-username"]`) and
   **upgrade the type to `url`** rather than copying `text`, plus one affordance tag carrying
   `https://github.com/{github-username}`. Rationale: `text` is the curate client's floor; the point
   of the concept is to say something the bare list does not. Decide at Gate A whether the affordance
   ships now or the header carries only `required` + `field-type url` (the smaller, fully-reversible
   option). The affordance **tag name** is a wire-visible choice — if it ships, name it at Gate A and
   log it under W18.
2. **Does the local twin get seeded items, or only the pointer?**
   *Recommendation:* **pointer only.** The firmware primitive seeds an affiliation, not membership
   (BIBLE.md:1557); copying seven items into a TA-authored twin manufactures data the curator never
   published under our key and would need its own sync story. Items stay where they are; the `b`
   pointer is how a consumer finds them.
3. **What does the indexer subscribe to?**
   *Recommendation:* **the concept coordinate, and follow the pointer.** It scans
   `39998:<TA>:github-account`, reads the `b` pointer to reach the community coordinate, and collects
   items from there — one subscription that survives re-pointing, plus per-POV taggings keyed on the
   item `a` coordinates. Documenting this path is in scope; implementing it is not. (Note: a
   reinstall re-seeds the firmware default, so an operator re-point does not survive — OPEN #8.)
4. **Does story 1's table render the GitHub link from the concept's field type now?**
   *Recommendation:* **follow-on story.** This story puts the semantics on the wire; making the table
   resolve a concept for a list it is viewing is a read path with its own caching and trust questions
   (which POV's definition?). Keeping it out preserves the "no UI files touched" blast radius. If
   Gate A wants the visible payoff now, it should be story 9, not an AC here.
5. **Scoped gate.**
   *Recommendation:* `npm test -- test/github-account-firmware-concept.test.js test/b-tag-primitive.test.js
   test/b-tag-seeds.test.js test/item-trusted-list.test.js` — the new suite plus the three guard
   suites that assert the sanctioned `communityReference` set and the story-5 concepts' manifest
   shape. Run in the foreground with the exit code captured by brace-redirect, never piped.
6. **`relayHints` and `knownGoodEventId`.**
   *Recommendation:* `relayHints: ["wss://dcosl.brainstorm.world"]` to match all six existing entries
   and the BIBLE's relay invariant (BIBLE.md:1572) — **verify at design time** that the community
   header is actually reachable there (it is present on local strfry;
   id `db25cec521257c27c8693a47a79ab62387f8736421e19568c309244947929674`). **Omit
   `knownGoodEventId`**: the list is actively curated by a third party, so pinning an id makes the
   fetch fail on the curator's next edit; the seed is graceful either way (AC-4).

## Linked artifacts
- Design note: (in this file, after Gate A)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
