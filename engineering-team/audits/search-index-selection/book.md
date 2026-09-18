# Book of Work: Search-index selection

**Slug:** search-index-selection
**Status:** Open
**Opened:** 2026-09-18
**Closed:** —
**Strictness:** Light — workflows/light-profile.md (a story escalates to Standard only on a
wire-format trigger; stories 2 and 3 each carry a wire-visible value and expect an ADR)
**Branch:** `feat/search-index-selection` off `feat/tags` → merges to `feat/tags`
(tags.brainstorm.world) first; `staging` / `main` later, if acceptable — operator's call.

## Intent anchor

**Acceptance frame (no PRD)** — the operator's ask, settled across the 2026-09-18 design
debate and captured in [`docs/SEARCH_INDEX_DLIST_SELECTION.md`](../../../docs/SEARCH_INDEX_DLIST_SELECTION.md)
(rev 3). Confirmed at the story-1 Gate A exchange.

A curator says, in protocol, which Decentralized Lists are worth indexing for search, and
that set is published as a Trusted List a search backend (Vespa, other repo) subscribes to.
**The consumer reads one Trusted List and never changes**; every later loosening of who
influences the set is a pipeline change behind it. Day one the set is one list
(`39998:b83a28b7…:github-accounts`) chosen by one curator, guarded by a single
`author == observer` curation constraint — not an allowlist, not a config file, and not a
point-of-view threshold.

### Acceptance frame

- [ ] **Tag a list header.** A signed-in curator can tag a Decentralized List *itself* from
      the app; the assertion targets the header's coordinate; the tagged header renders with
      its name wherever tagged targets are listed (not as a bare coordinate).
- [ ] **"Only me" curation.** A pin can curate on the viewer's own assertions alone
      (`author == observer`), surfaced as a trust scope in the curation dialog, yielding a
      Trusted List whose membership is certain because only the viewer can sign as the viewer.
- [ ] **Per-pin curation.** The membership method and the new constraint live on the pin,
      not the instance-wide dial; a viewer can hold more than one pin of a tag, each with its
      own curation and its own list, without the pin having to be about a community.
- [ ] **The published list is the contract.** Pinning `worth-indexing-for-search` (or its
      final name) with "Only me" on a curator who has tagged the `github-accounts` header
      yields a TA-signed kind-30394 whose sole `a` member is that header's coordinate — the
      event the search backend subscribes to.
- [x] **Deferred by design (2026-09-18):** the `author ∈ <list>` value and its filter-list
      picker; self-attested curator sets with GrapeRank; extrinsic per-list config joined by
      `b`; field types as a DList with url-templates. Tracked in the design doc, not here.
- [ ] **Publish discipline.** Taggings publish to local strfry only during the build; the
      feature ships to `feat/tags` → tags.brainstorm.world as its staging.

## Epics in this book
- `search-index-selection` — header tagging → "Only me" curation → per-pin curation & variants.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/search-index-selection/audit.md`
- Product feedback: `engineering-team/audits/search-index-selection/prd-seed.md`
