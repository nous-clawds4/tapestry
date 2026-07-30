# Communities ⇄ Tags — state handoff (2026-07-29)

**Audience:** the Claude instance resuming the Communities work (`feat/communities`, Avi's
branch), which has been paused since roughly early June 2026. This document bridges the gap:
what the tagging side promised then, what actually shipped since, what the current wire truth
is, and what is still open.

**Baseline:** the 2026-06-05 dependency response
(`reference/COMMUNITIES_TAG_DEPENDENCY_RESPONSE.md`) — the last synchronized state between the
two workstreams. This handoff is written against that baseline: every promise it made is
accounted for below.

**How to read this kit:** this file is the narrative. `protocol/` holds verbatim snapshots
(taken 2026-07-29) of the normative specs the Communities design consumes — read them for wire
detail; this file tells you which parts moved and which caveats in them are already stale.
`reference/` holds the June baseline docs and the two wire-shaping ADRs cited below, so the kit
stands alone without the Tapestry repo.

---

## 0. TL;DR — the gap, bridged

The June response made three commitments. **All three are delivered, on `staging`:**

| June commitment | Status today |
|---|---|
| Hybrid `e` + `a` assertion shape (ADR-0022) — consume by `#a` | ✅ **Shipped.** Publishers emit both tags; the a-primary correction is confirmed, no longer "pending the tags branch owner's confirmation." |
| Carve the tag core onto `staging` (not the full UI branch) | ✅ **Done.** `src/api/profile-tags/`, `src/api/_shared/pov.js` + `povStatus.js`, `src/api/trustedList/`, `src/lib/event-tagging/`, and the publish helpers are all on `staging`. |
| Read side generalized to scan by `#a` | ✅ **Done** (profile-tag-hardening story 1). All profile-tag reads — including `aggregateProfilesTagged`, the roster function Communities was pointed at — union the `#a` stable-identity scan with the legacy `#e` provenance scan. |

**Consequence: the Communities v1 delivery blocker is cleared.** The design handoff's §7 said
"Communities v1 membership is blocked on the nostr-user-tag core reaching staging." It has
reached staging. **Build against `staging`.** The three-branch reconciliation question has
collapsed to a smaller two-branch one (see §7).

Also new since June, none of it blocking but several parts relevant (§5): the whole
**event-tagging** family shipped (tagging notes and DList objects, not just pubkeys);
**applicability hints** and published applicability Trusted Lists; the **Trusted List kind
family** was formalized (kinds 30392/30393/30394, NIP-85-aligned); **POV degraded-state
disclosure** on tag reads; a **composite tags** design was proposed (its motivating example is
literally a community-scoped slice — `bitcoin+lfo`); and a dependency-free, portable **SDK**
now exists (built for a Jumble-fork integration) that implements the whole wire layer.

---

## 1. Where the truth lives now

Since June the Tapestry repo grew a `protocols/` directory — the single home for every wire
spec, with a status ladder (idea → pre-NIP → publish-ready → published). If a caveat in a
snapshot here contradicts the live repo, the live repo wins:

| Spec | Snapshot here | Live path in the Tapestry repo |
|---|---|---|
| Communities | `protocol/communities.md` | `protocols/drafts/communities.md` |
| Tags & Taggings (pubkey targets) | `protocol/tags.md` | `protocols/drafts/tags.md` |
| Event Taggings (event targets) | `protocol/event-taggings.md` | `protocols/drafts/event-taggings.md` |
| Trusted Lists (kinds 3039x) | `protocol/trusted-lists.md` | `protocols/drafts/trusted-lists.md` |
| Inherit-From & Resolved Definition (`b`) | `protocol/inherit-from.md` | `protocols/drafts/inherit-from.md` |
| Tapestry Concepts (DList extensions) | `protocol/tapestry-concepts.md` | `protocols/drafts/tapestry-concepts.md` |
| Stamping (multi-`z` selection) | `protocol/stamping.md` | `protocols/drafts/stamping.md` |
| Decentralized Lists (base NIP) | `protocol/decentralized-lists.md` | `protocols/nips/decentralized-lists.md` |

The Communities *design* itself (`protocol/communities.md`) was ratified from the June design
handoff (`docs/COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md` §1–§6) into a pre-NIP and is
**unchanged in substance**: no privileged center; community = concept; declaration = kind-39998
concept event; deference via inherit-typed `b`; membership = the pubkey-tagging primitive,
consumed; rosters derived on read, never stored. Nothing on the tagging side contradicted or
moved any of that.

---

## 2. The membership primitive today — normative wire shape

A membership assertion is a kind-39999 **nostr-user-tag** event. This is what the live
publishers on `staging` emit **today** (no longer aspirational — note that
`protocol/tags.md` § "Deployed variant" still describes the pre-hybrid publishers as current;
that paragraph is **stale** as of the staging carve-out and applies only to legacy events, per
the caveat below):

```
["d", "profile-tag-<tagSlug>-<targetPubkey[0:8]>-<asserterPubkey[0:8]>"]
["p", "<targetPubkey>"]                    the person being tagged
["a", "39999:<tagAuthorPubkey>:<slug>"]    the tag-element applied — STABLE IDENTITY (claim/scan this)
["e", "<tagEventId>"]                       the tag-element's version at apply-time — provenance only
["z", "39998:<zHandlePubkey>:nostr-user-tag"]   assertion-concept membership (see §3 for the pubkey)
["polarity", "1" | "-1"]                    apply / dispute
```

with a content payload mirroring the key tags
(`{"nostrUserTag":{"taggedPubkey":…,"tagEventId":…,"tagAddress":…}}`).

- **Replaceability — latest wins.** The deterministic `d` gives each asserter exactly one live
  stance per (target, tag slug); republishing replaces, including apply↔dispute flips. Dedupe
  replaceables (latest `created_at` per `(kind, pubkey, d)`) before counting anything.
- **Consume by `#a`.** `39999:<tagAuthor>:<slug>` is the tag-element's stable address; it
  survives the tag author editing the (replaceable) tag-element. Treat `e` as provenance. Both
  are single-char tags, so both are fully relay-filterable.
- **Drift detection** (recommended for membership, a trust context): compare the live
  `a`-resolved tag-element against the frozen `e` version to detect a tag author mutating a
  tag's meaning under existing assertions.
- **Polarity:** absent = apply; v1 buckets `≥ 0.5` applied, `≤ −0.5` disputed; the open
  interval between is reserved for a future graded arc.

**The legacy-events caveat (the one transition cost).** Assertions published before the hybrid
landed carry `e` only; a pure `#a` scan will not see them. There is **no server backfill and
there cannot be one** — assertions are signed by each individual asserter, and a replaceable can
only be replaced by its original author (ADR-0022,
`reference/0022-nostr-user-tag-hybrid-ea-reference.md`, walks through this). The paths:

- Every assertion published since the change is born with `#a`. Any tag created **after** the
  change — including all Communities tag-elements and their member assertions — is pure-`#a`
  with no legacy set at all. **This covers the Communities v1 case completely.**
- For pre-existing tags where you need instant completeness: union the `#a` scan with that
  tag's legacy `#e` event-ids during the transition. This is exactly what the reference reads
  on `staging` do.
- Lazy self-re-emit (each user's client re-signs their own old assertion with `a` added on next
  interaction) migrates the tail over time.

---

## 3. z-handle identity — the interop detail that will bite you if skipped

Every kind-39999 item declares what it *is* via a `z` tag naming a kind-39998 concept header,
`39998:<pubkey>:<slug>`. Which pubkey goes in that handle is subtle, and getting it wrong makes
events invisible to every other reader:

- **The three profile-tagging concepts — `tag`, `nostr-user-tag`, `tag-pinning` — compose their
  z-handles from a fixed legacy pubkey**, `82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833`,
  **on every deployment** (ADR-0015: preserving visibility of all historical user activity;
  constants `LEGACY_Z_TAG_PUBKEY` / `TA_PUBKEY` in the reference code). Do **not** compose these
  three from a deployment's runtime TA pubkey.
- **The event-tagging concepts** (`nostr-event-tag`, `tagging-with-specific-tag`, per-tag
  tagging headers) use **dual z-tags**: one composed from the canonical pubkey above and one
  from the deployment's local runtime TA, deduped (see `conceptZTags` in
  `src/lib/event-tagging/builders.js`). Readers honor an event if **any** of its z-handles
  matches an honored authority — never require both.
- **Every other TA use** — author filters, signing, Trusted List authorship — resolves the TA
  pubkey **at runtime** (it is generated per deployment at first container startup; server:
  `getOwnerAssistantPubkey()` in `src/utils/assistantKeys.js`; client: `useConfig().taPubkey`).
  A hardcoded runtime-TA literal is the reference incident behind ADR-0015.

For Communities this matters twice: (a) membership assertions you *read* carry the legacy-pubkey
`nostr-user-tag` handle; (b) any new community-specific concept headers (community declaration
type marker, foothold-invite/redemption concepts) will be seeded under each deployment's
**runtime** TA — so compose those handles at runtime, and expect them to differ per deployment.

---

## 4. What Communities consumes — confirmed, with updated code pointers

The June "meeting point" stands exactly as agreed: **the Community claims the Tag, not the
reverse.** A Community Declaration's `claims` field lists tag-element a-coordinates
(`39999:<tagAuthor>:<slug>`); many-to-many; nothing community-specific ever goes on the tag.
Self-tag vs. vouch = whether asserter == `p` target; disputes = `polarity: -1`; membership is
derived on read.

Updated pointers into the code that is now actually on `staging`:

- **POV resolution:** `resolvePov({ wotPov, userPubkey })` in `src/api/_shared/pov.js` →
  `{ delegatedPubkey, povSuffix, minRank }` — as described in June. **New:** prefer
  `resolvePovWithStatus(...)` in `src/api/_shared/povStatus.js`, which additionally returns a
  `povResolution` status object disclosing degraded states (requested POV missing/unprovisioned
  → fell back to house). Tag read surfaces now pass this through so a UI can tell "0 members"
  from "your POV isn't provisioned"; a Communities roster endpoint should do the same.
- **Trust score:** read `wot_rank_<povSuffix>` off the asserter's Meilisearch profile doc; gate
  `>= minRank`. Unchanged. The caveat also stands: a `wot_*_<suffix>` column only exists for a
  POV whose WoT has been computed — the house POV always exists; an arbitrary viewer's POV
  needs provisioning first.
- **The roster math you don't need to reimplement:**
  `aggregateProfilesTagged({ tagEventId, povSuffix, minRank })` in
  `src/api/profile-tags/index.js` — scans a tag-element's assertions (**now by `#a` unioned
  with legacy `#e`**, the generalization June promised), gates asserters by
  `wot_rank_<suffix> >= minRank`, nets polarity per target, dedupes replaceables.
  `applyDisputesFunction(byTarget, cutoff)` applies the membership gate. That is the
  "weight asserters from the observer's POV → net polarity → gate by cutoff" loop, per claimed
  tag-element.
- **Roster rule status (unchanged, still open as W9):** the deployed gate is count-based
  (`applications ≥ cutoff AND applications > disputes`, binary rank threshold, flat counting);
  the designed rule is trust-*weighted* (`Σ trust(observer, asserter) × polarity` above an
  influence cutoff). The specs keep both visible and unreconciled. Communities v1 can ship on
  the deployed rule; don't silently assume the weighted one is implemented anywhere.

---

## 5. New since June — capabilities Communities may want

None of these change the membership contract; all are additive.

1. **Event tagging shipped** (`protocol/event-taggings.md`; reference lib
   `src/lib/event-tagging/`, read API `src/api/event-tags/`). Tags now apply to **events** —
   kind-1 notes and kinds 39998/39999 (DList headers and items, i.e. tags themselves and
   concept headers) — not just pubkeys. The target stays in `e`/`a`; the descriptor is carried
   *indirectly* via a `z` pointing at a per-tag **tagging header** (this resolves the
   two-`a`-tags ambiguity; the spec walks the worked example). Relevant to Communities as
   content curation: "notes this community considers on-topic" is an event-tagging read over
   community-claimed tags — same trust gate, different target type. A `dlist-tag` subset is
   envisioned but unbuilt.
2. **Applicability hints + lists** (`protocol/tags.md` § applicability;
   `protocol/trusted-lists.md`). Tag-elements may carry pubkey-free hint z-values
   (`tag-for-nostr-pubkey` / `tag-for-nostr-event`) recording the context they were born in.
   Doctrine: *hint, never gate* — a context's applicable tags = HINT ∪ observed USAGE, and the
   reference deployment publishes that union as kind-30394 Trusted Lists. A community-tag
   picker should use these to lead with person-applicable tags without hiding the rest.
3. **Trusted Lists formalized** (kinds 30392/30393/30394 — the `+10` analog of NIP-85's
   30382/30383/30384: pubkey-members / event-members / addressable-members). TA-signed,
   POV-computed aggregate rosters. Today they carry pinned-tag membership, note-TL membership,
   and applicability. A **published community roster** would fit this family naturally
   (a 30392 whose members are the roster under the house POV) — not designed yet, but the kind
   family and publisher plumbing (`src/api/trustedList/`) now exist.
4. **Composite tags — proposed, NOT shipped**
   (`reference/0018-composite-tags.md`, status Proposed). A
   composite is a first-class tag-element with ≥2 constituent `a`-tags, slug =
   `sorted().join('+')` — e.g. **`bitcoin+lfo`: "the bitcoin content the LFO community cares
   about" as its own browsable, disputable surface**, plus a denormalized rollup channel so a
   constituent's global view can include composite usage in one query. The motivating use case
   is exactly a community-scoped slice, so the Communities side should read the ADR before
   inventing anything in that space — but do not build against it yet; it is a design, and
   wire-affecting details may still change.
5. **A portable SDK exists** (Tapestry repo: `integration-kits/jumble-tagging/sdk/` — built
   2026-07 for a Jumble-fork integration). Dependency-free ESM: event-builders (unsigned),
   relay-filter builders, replaceable-deduping classifiers with a pluggable
   `(pubkey) => boolean` trust predicate, and a NIP-85/30382-backed house-trust source. If the
   Communities client needs to read or write taggings from a browser without the Brainstorm
   REST API, port/copy from there rather than hand-rolling wire shapes. (Its
   `profile-tagging.js` mirrors `ui/src/utils/publishProfileTag.js`; keep in sync.)

---

## 6. Still open — the honest list

Design questions the specs deliberately keep open (worksheet numbers refer to
`protocols/worksheet.md` in the Tapestry repo):

- **W9 — roster-rule reconciliation.** Deployed count-based vs. designed trust-weighted, plus
  threshold mechanics (1 vouch vs. N ≥ 2 for safe spaces). The Communities side owns most of
  the stakes here.
- **W8 — engine-config carriage.** Where `seed` / `weighting_model` / threshold / influence
  cutoff live post-redesign (personal records? declaration `claims`? resolved definition?).
- **W1 — cross-deployment concept identity.** How independent deployments agree on canonical
  concept identities (partially mooted for the three legacy handles by ADR-0015, live for
  everything else, including community concepts).
- **CD field encodings.** The Community Declaration's field *set and semantics* are fixed
  (`protocol/communities.md`), but the byte-level tag spelling — including how `claims` is
  encoded — is **not yet formalized**. This is the biggest piece of genuinely unfinished
  protocol on the Communities side, and it is Communities' to propose.
- **Legacy `e`-only assertion tail** — the union-read guidance in §2 stands until the lazy
  self-re-emit migration finishes (indefinite; harmless).
- **W10 — taggings-family naming** (`nostr-user-tag` → `nostr-user-tagging`? `dlist-tag`?) —
  wire-impactful renames, treated as concept migrations, not documentation edits.

---

## 7. Branch and delivery state

- **`staging`** — has the complete tag core (§0 table). **This is the stable target to build
  against.** The tags subdomain deployments track their own branches; staging → main is the
  normal promotion path.
- **`feat/tags`** (Vinney; successor to `feat/pubkey-tagging-target`) — the full
  tagging/feed/POV UI branch, still unmerged; a full staging integration is planned but not
  started. Nothing Communities needs lives only there — the server core and wire shapes are
  already on staging.
- **`feat/communities`** (Avi) — resuming via this handoff. The June design handoff's warning
  stands: if the branch predates the 2026-06-05 redesign, read `protocol/communities.md`
  (§ "What changed from the original draft" in
  `reference/COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md`) before continuing — the founder-centric
  parts of the original draft are superseded.
- **ADR housekeeping:** the June reply's refolder ratifications went through; the tagging-side
  wire ADRs now live under epic folders (`engineering-team/decisions/profile/0022-…`,
  `…/event-tagging/…`) on staging.

## 8. Recommended posture for the resuming Communities Claude

1. **Rebase your mental model, not necessarily your branch, onto `staging`** — read the §0
   table's code paths there; they are the contract.
2. **Consume, don't fork, the membership primitive.** Scan `#a` (union legacy `#e` only for
   pre-existing claimed tags); call `aggregateProfilesTagged` / `applyDisputesFunction` rather
   than re-deriving roster math; resolve POV via `resolvePovWithStatus` and surface degraded
   states.
3. **Propose the CD field encoding** — it's the missing normative piece, and the tagging side
   will consume whatever Communities specifies (the reverse of the membership dependency).
4. **Honor the architecture invariants** that shaped everything above: every answer is
   per-POV (there is no global roster); publishing is permissionless (no write-time gating of
   who may assert or declare); filter at read time (membership is always derived, never
   stored).
