# Book of Work: Search-index selection

**Slug:** search-index-selection
**Status:** Closing (Gate B ratified 2026-09-23)
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

- [x] **Tag a list header.** A signed-in curator can tag a Decentralized List *itself* from
      the app; the assertion targets the header's coordinate; the tagged header renders with
      its name wherever tagged targets are listed (not as a bare coordinate).
- [x] **"Only me" curation.** A pin can curate on the viewer's own assertions alone
      (`author == observer`), surfaced as a trust scope in the curation dialog, yielding a
      Trusted List whose membership is certain because only the viewer can sign as the viewer.
- [x] **Per-pin curation** *(story 3 Done; story 4 confirm-step Done; the variant key is story 5)*. The membership method and the new constraint live on the pin,
      not the instance-wide dial; a viewer can hold more than one pin of a tag, each with its
      own curation and its own list, without the pin having to be about a community.
- [x] **The published list is the contract** *(story 5 Done; the end-to-end is the operator's Gate B test)*. Pinning `worth-indexing-for-search` (or its
      final name) with "Only me" on a curator who has tagged the `github-accounts` header
      yields a TA-signed kind-30394 whose sole `a` member is that header's coordinate — the
      event the search backend subscribes to.
- [x] **Deferred by design (2026-09-18):** the `author ∈ <list>` value and its filter-list
      picker; self-attested curator sets with GrapeRank; extrinsic per-list config joined by
      `b`; field types as a DList with url-templates. Tracked in the design doc, not here.
- [x] **Publish discipline.** Taggings publish to local strfry only during the build; the
      feature ships to `feat/tags` → tags.brainstorm.world as its staging.

## Epics in this book
- `search-index-selection` — header tagging → "Only me" curation → per-pin curation & variants.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/search-index-selection/audit.md`
- Product feedback: `engineering-team/audits/search-index-selection/prd-seed.md`

## Decision log
- **2026-09-18 — Gate B (stories 1–2): HOLD.** Operator: "no reason to deploy yet, let's get this
  whole epic done; then feat/tags will be dlist item tagging, header tagging and the TL updates
  that include the author-constraint." The epic branch merges to `feat/tags` once, at the end.
- **2026-09-18 — Gate A (story 3): approved as proposed.** Split into Part A (per-pin membership
  method, story 3) and Part B (explicit pin variant key, story 5); field `membershipMethod` on the
  pin blob, absent ⇒ the instance dial; the published profile list records the method that ran
  (the one non-additive wire change — restores a tag Story 4 stripped); the instance dial stays
  as the default for pins that don't choose, with its misleading page copy fixed.
- **2026-09-18 — Uniqueness invariant** (operator: "we're not going to accidentally overwrite
  stuff by stomping out d-tags, right?"): binding on story 5 — variant in both pin and list
  addresses by construction; client refuses a used slug before signing; runner logs + skips a
  detected collision. Recorded in story 3's draft, carried into story 5.
- **2026-09-18 — New story 4 (operator):** a confirm step on first pin, so the default curation
  that quietly publishes a list becomes visible and editable; sequenced with/before story 5.
- **2026-09-22 — Gate B (epic): MERGE.** Operator: "let's merge, push and run." Fast-forwarded
  `feat/tags` after absorbing two unrelated upstream commits; deploy green; firmware reinstalled
  on the droplet; a full refresh cycle republished all 2,437 profile lists with the new tags; 0
  collisions, 0 author mismatches on tags.b.w.
- **2026-09-23 — Gate B verification: PASS.** The three live TL suites cannot complete anywhere as
  written (each waits on a ~30-min `refresh-all`; OPEN 315) and skip on the droplet for want of
  `nak` (OPEN 314); the wire claims were verified instead by the hermetic suites plus reading the
  tags off every live list, and by the operator's five-step UI walkthrough on tags.b.w (method
  recorded; per-pin override; weighted-sum fallback; "Only me" × certainty; settings gate) —
  "all seem to pass." Found and filed during verification: OPEN 315 (nightly refresh has hit its
  300 s cap for two months, server completes anyway), OPEN 316 (context stamps are instance-TA
  scoped; mirrored contextual pins now collide-and-freeze instead of stomping).
