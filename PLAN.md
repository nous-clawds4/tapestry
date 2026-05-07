# Brainstorm Communities — Feature Plan

**Status:** Pre-implementation, in active design phase.
**Branch:** `feat/communities` (this branch).
**Deploy target:** `communities.brainstorm.world` (DigitalOcean droplet + CI/CD to be set up).
**Companion docs:** [BIBLE.md](./BIBLE.md), [ROADMAP.md](./ROADMAP.md), [OPERATIONS.md](./OPERATIONS.md).

This file is the working planning artifact for the Brainstorm Communities feature. It captures decisions made to date and tracks open questions. The Design prompt for Claude Design lives in [DESIGN_PROMPT.md](./DESIGN_PROMPT.md) — that's the artifact this planning phase produced.

---

## 1. Strategic Position

Brainstorm Communities is the third major UI surface in the brainstorm ecosystem, after:

- **brainstorm.world** — consumer search engine (read-only)
- **Tapestry dashboard** — admin/curation interface (raw DList management)

Communities is the first surface that is fundamentally **social**. It introduces a new community primitive that interoperates with — but is structurally distinct from — NIP-72.

### Relationship to NIP-72 (kind 34550)

A Brainstorm Community is **not** a NIP-72 community.

- **NIP-72:** A community is owned by its creator's pubkey. The d-tag is bound to that pubkey. Moderators are tagged on the event. If the creator's key is lost or hostile, the community definition cannot be updated.
- **Brainstorm Community:** A community is a *convergent membership set* with no owner. Membership emerges algorithmically from member-issued endorsements/vetoes, computed independently by any number of mirror relays. The community survives any individual leaving or going hostile.

These are different primitives. The Brainstorm Community schema includes an optional `external_ref` field for wrapping/referencing existing NIP-72 communities (good for cold-start curation), but a wrapped NIP-72 community and a native Brainstorm Community remain distinct things in the firmware.

---

## 2. The Differentiator: Leaderless Self-Curation

> Suppose Alice starts a community of Meshtadelians at `communities.brainstorm.world/create`. She gives it a name, a description, picks some options, and clicks a button. She gets a relay with read/write access restricted by default to community members. She handpicks a few seed members. From there, membership is determined dynamically: members can endorse other npubs as members, others can veto. A membership algorithm interprets these signals to produce a whitelist that gates the relay.
>
> Bob can run a "mirror" relay using his own seed users and (optionally) tweaked algorithm parameters. Tapestry theory predicts his whitelist will closely match Alice's. If 10 members run mirror relays, it almost doesn't matter who the "leader" is. There may be no leader. The community exists in a real sense, and curates itself in a real and meaningful way.

No other system has this property:

- **NIP-72:** single-key ownership; can be rug-pulled
- **X / Twitter:** centralized moderator
- **Reddit:** platform admins + appointed mods
- **Discord, Slack:** owner controls everything
- **Matrix:** federated, but rooms have removable moderators
- **DAOs:** capital-weighted, prone to oligarchic capture

The lineage: same convergence trick Bitcoin pulls with the longest chain — independent computation from different starting points, converging on the same answer because the protocol is well-shaped. It's GrapeRank applied to membership instead of search ranking.

### Why it's robust

- Multiple member-run mirror relays — no single operator can rug-pull
- Multiple seed users producing convergent whitelists — no single point of seed failure
- Member-gated input — non-member endorsements are ignored, blunting Sybil flooding from outside
- Threshold-based admission — requires social consensus, not single-actor authority
- Founder has no special algorithmic privilege once the community has substance

### Failure modes to design for

1. **Seed divergence on sparse graphs.** Convergence is empirical, not guaranteed. In small communities (~<20 members) or those bridging two sub-cliques, different seeds can produce meaningfully different whitelists. Strong at scale; fragile at edges.
2. **Algorithm divergence vs. relay divergence.** If mirror relays can tweak the algorithm, they're computing different communities under the same name. Sometimes a feature (legitimate forks: Catholicism / Protestantism); sometimes accidental confusion. Design must decide whether "the community" pins the algorithm or only the endorsement event stream.
3. **Sybil via endorsement.** Coordinated minorities can endorse each other and gradually flip a community. Defense: GrapeRank-weighted endorsements (see §4).
4. **Veto calibration.** Too strong → heckler's veto. Too weak → bad actors can't be removed. Empirical tuning needed per community.
5. **Founder-as-only-seed staleness.** If the founder's seed set is the only anchor and they go inactive, the algorithm drifts. Cure: any current member can be a seed for any mirror.
6. **Zero-friction creation → community sprawl.** 10,000 communities called "Bitcoin" on day one. Discovery problem more than robustness problem, but real. (See open question Q4.)

---

## 3. Data Model

### Personal-Projection Pattern

There is no canonical Community-X record anywhere. There are N personal records of Community X — one per user who participates — and the community **is** the convergent overlap of those personal records.

This recurses the convergence pattern up one level: not just *membership* converges across mirror relays; each user's *projection of the community itself* (metadata + engine config) converges across users via the same trust dynamics.

When Alice joins Community X, her first step is to create her own community-record event. She typically copies it from whoever introduced her, then may edit it over time (add a relay, tweak seed members, change thresholds). Tweaks have material consequence only when she actually **uses** her version — runs her own mirror, or filters content with her own derived whitelist.

### DList Structure

**Per user:**

- 1× `brainstorm-communities` DList — index of communities the user participates in.

**Per (user, community) pair:**

- 1× community record — a ListItem on the index, with metadata + engine config in its `json` tag. This item IS Alice's "community record event."
- 1× signals DList — Alice's endorsements and vetoes for that community, with the parent z-tag pointing at the community record's a-tag.

```
Alice's brainstorm-communities DList   (kind 39998, d-tag: "brainstorm-communities")
  │  • header tags: names, schema declarations (required / allowed / ...)
  │
  ├── ListItem: Alice's record of Community X   (kind 39999)
  │     • event tags = community metadata + engine config (DList layer — primary)
  │     • optional word-wrapper json tag (Concept layer — see §5)
  │     ↑ z-tag
  │     └── Signals DList for Community X   (kind 39998, d-tag: "signals/<community-slug>")
  │           │  • header tags: names, schema declarations (required: p, type; allowed: comments)
  │           │
  │           └── ListItems (kind 39999): one per (target pubkey, signal)
  │                 • event tags: p, type, comments (DList layer)
  │                 • optional word-wrapper json (Concept layer)
  │
  ├── ListItem: Alice's record of Community Y
  │     ...
```

Endorsements and vetoes share one DList. Each signal item carries a `["type", "endorse"|"veto"]` tag — same kind of signal, opposite sign. One subscription pattern for any mirror relay computing whitelists.

### Two Representation Layers

Each event below carries data in two layers simultaneously:

- **DList layer** (primary) — fields live as native nostr event tags. Any DList-aware client can read/write these directly without needing the Tapestry Concept Graph machinery.
- **Concept layer** (additional) — the same fields, also expressed as a word-wrapper JSON tag conforming to a firmware Concept's schema. This makes the events compatible with Tapestry's normalization, audit, and graph-query pipeline. See §5 for the firmware Concepts.

Both layers carry the same information and are kept in sync at write time. The tables below describe the **DList layer**; the Concept-layer JSON is a transcription of the same data into the firmware's word-wrapper format.

The `content` field on every event is left empty — reserved for future use (encrypted data).

### `brainstorm-communities` DList header (kind 39998)

| Tag | Status | Notes |
|---|---|---|
| `["d", "brainstorm-communities"]` | required | deterministic |
| `["names", "brainstorm community", "brainstorm communities"]` | required (per DList NIP) | singular, plural |
| `["titles", "Brainstorm Community", "Brainstorm Communities"]` | optional | display |
| `["description", "Communities I curate"]` | optional | per-list description |
| `["required", "t"]` | schema decl | every item declares with `t` (community slug) |
| `["required", "name"]`, `["required", "description"]` | schema decl | display name + description |
| `["required", "relay"]`, `["required", "seed"]` | schema decl | relay set, seed members |
| `["required", "weighting_model"]`, `["required", "endorsement_threshold"]` | schema decl | scoring config |
| `["allowed", "image"]`, `["allowed", "topic"]`, `["allowed", "language"]`, `["allowed", "founder"]`, `["allowed", "external_ref"]` | schema decl | optional metadata items may include |

### Community record (kind 39999 ListItem on the `brainstorm-communities` DList)

| Tag | Required | Notes |
|---|---|---|
| `["d", "<community-slug>"]` | ✅ | replaceable address |
| `["z", "39998:<user-pubkey>:brainstorm-communities"]` | ✅ | parent pointer (DList NIP) |
| `["t", "<community-slug>"]` | ✅ | item declaration (DList NIP) — string-named entity |
| `["name", "<display-name>"]` | ✅ | display name (DList NIP optional metadata) |
| `["description", "<text>"]` | ✅ | what the community is about |
| `["image", "<url>"]` | — | banner |
| `["topic", "<topic>"]` (multi) | — | topical tags (custom; not `t` to avoid overloading the DList NIP item-declaration semantics) |
| `["language", "<code>"]` | — | ISO 639-1 |
| `["founder", "<pubkey>"]` | — | informational |
| `["external_ref", "nip72", "<a-tag>"]` | — | for NIP-72 wrapping |
| `["relay", "<url>"]` (multi) | ✅ | relay set |
| `["seed", "<pubkey>"]` (multi) | ✅ | seed members |
| `["weighting_model", "<id>"]` | ✅ | scoring system identifier; default `"gr-community-default-v1"` |
| `["endorsement_threshold", "<num>"]` | ✅ | default `"0.5"` |

### Per-community signals DList header (kind 39998)

| Tag | Status | Notes |
|---|---|---|
| `["d", "signals/<community-slug>"]` | required | deterministic |
| `["names", "membership signal", "membership signals"]` | required (per DList NIP) | |
| `["description", "Endorsements and vetoes for <community>"]` | optional | |
| `["required", "p"]` | schema decl | every signal targets a pubkey |
| `["required", "type"]` | schema decl | endorse or veto |
| `["allowed", "comments"]` | schema decl | optional reason |

### Signal item (kind 39999 ListItem on the signals DList)

| Tag | Required | Notes |
|---|---|---|
| `["d", "signal/<community-slug>/<short-hash>"]` | ✅ | unique per (user, community, target) |
| `["z", "39998:<user-pubkey>:signals/<community-slug>"]` | ✅ | parent pointer |
| `["p", "<target-pubkey>"]` | ✅ | item declaration — target of the signal |
| `["type", "endorse"\|"veto"]` | ✅ | signal type |
| `["comments", "<text>"]` | — | reason — uses DList NIP `comments` tag rather than a custom name |

---

## 4. GR Community Scoring (Default System)

A new GrapeRank scoring system tailored for community membership. Output: a single number ∈ [0, 1], where 0 means "not a member" and 1 means "member with 100% certainty."

Endorsements and vetoes are interpreted as ratings (analogous to follows/mutes/reports in baseline GR), with magnitudes ±1 by default.

### Two-Gate Confidence Weighting

Each rating's confidence weight is the **product** of two factors:

1. **Rater's baseline GR influence** — filters out bots and unestablished accounts.
2. **Rater's GR Community influence (for this community)** — filters out outsiders, including high-reputation outsiders.

Multiplicative gating means BOTH must be non-trivial for a rating to count. Defense properties:

- Bots: gate 1 fails → weight ≈ 0
- Famous outsider: gate 2 fails → weight ≈ 0
- Sybil-via-endorsement attack: requires building (a) legitimate baseline reputation AND (b) community endorsement. Both individually hard; doing both at scale is exponentially harder.

Philosophy: communities, by definition, decide who belongs and who doesn't; outsiders don't get to decide.

### Bootstrap & Convergence

Seed members start with `community_GR = 1` by definition. All other accounts iterate from 0. Standard fixed-point GrapeRank dynamics; converges as long as the underlying graph is well-formed.

### Calibration Items (Defaults, Tunable Per-Community)

- **Veto magnitude vs. endorsement** — symmetric ±1 default
- **Membership threshold (T)** — 0.5 default; the value used to decide member-vs-not from the score
- **Self-endorsement** — excluded (per standard GR practice)
- **Convergence behavior under heavy-veto regimes** — to validate empirically once we have test data

### Identifier

This default scoring system is referenced by ID `gr-community-default-v1` in the community record's `weighting_model` field. The eventual GrapeRank Scoring Systems registry (BIBLE §18 Medium-Term, also see §7 below) will resolve this identifier to a concrete spec.

---

## 5. Firmware Additions

Two new firmware Concepts to add in the next firmware version after v1.0.0 (likely v1.1.0). These provide the **Concept layer** for the same events whose DList-layer tag schemas are described in §3.

1. **`brainstorm-community`** — full concept treatment (all 8 core nodes, JSON schema enforced). Schema mirrors the community-record tag set in §3, expressed as a word-wrapper JSON tag on the same kind 39999 ListItem.

2. **`brainstorm-community-signal`** — concept with schema for endorsement/veto items. Schema mirrors the signal-item tag set in §3.

### Both-layer policy

Each event carries data in BOTH representations from v1:

- **DList layer:** native nostr event tags (described in §3). Any DList-aware nostr client can read these without Tapestry-specific tooling.
- **Concept layer:** word-wrapper JSON tag matching the firmware Concept's schema. Tapestry-aware tooling uses this for normalization, audit, and graph queries.

Both layers will be populated and kept in sync at write time. The DList layer is the primary user-facing representation; the Concept layer is the integration layer with the rest of Tapestry's machinery.

The user's `brainstorm-communities` index DList does **not** need its own firmware concept — it's just "a DList of items conforming to the `brainstorm-community` concept."

The `brainstorm-communities` DList will be created locally (deterministic d-tag) when each user first loads the firmware.

### Skeleton status

A skeleton of v1.1.0 lives at `firmware/versions/v1.1.0/`:

- `manifest.json` — v1.1.0 manifest with the two new concept entries; explicitly marked "SKELETON — not yet deployable" (the v1.0.0 concepts and the relationshipTypes / enumerations / elements / sets / changelog top-level entries must be merged in before the active symlink is switched).
- `concepts/brainstorm-community/` — `concept-header.json` + `json-schema.json` + `manifest.json`, with the field set from §3 fully encoded as JSON Schema. Marked SKELETON in description fields.
- `concepts/brainstorm-community-signal/` — same trio, encoding the signal-item field set.

The `firmware/active` symlink is **not** changed; it still points at `versions/v1.0.0`. v1.1.0 is staged for future activation, not live.

---

## 6. Open Design Questions

These must be resolved before the Design prompt is drafted.

### Q3 — Lock down the field sets ✅ CLOSED
Resolved on 2026-05-07. Final tag schema is in §3. Sub-question resolutions:
- `weight?` on signal items — **deferred** (v1 uses unweighted endorse/veto)
- `veto_policy` field — **dropped** (veto handling is a property of the scoring system, not the community record; tunable by changing `weighting_model`)
- `created_at` field — **not added** (rely on event timestamp)
- `parent_community` (sub-communities) — **deferred** (can be added as an optional field later without migration)
- DList NIP confirms schema-declaration tags accept arbitrary tag names; no application-only conventions remain except `topic` (used to avoid overloading `t`)

### Q4 — Creation and dedup ✅ CLOSED
Resolved on 2026-05-07. Approach: **embrace + soft-canonicalize, no hard dedup.**

Key insights:
- Slugs aren't globally namespaced — d-tags are scoped per (kind, pubkey), so 10,000 "Bitcoin" community records coexist at the protocol level without collision.
- Two natural anti-fragmentation forces: **(1)** convergence-from-copy — when a user joins, they copy the introducer's record, so chains of joiners share the same record. **(2)** trust-ranked discovery — a viewer only sees communities someone in their trust network has curated.
- Forking is a feature: legitimate disagreements should be able to fork a community. The system makes *accidental* forking unlikely but never prevents *intentional* forking.

v1 mechanisms:
- **Soft canonicalization at create time:** when a user attempts to create, surface 3-5 communities with similar names/topics that are also curated by the user's trust network. Three explicit choices: join one of these, fork one with tweaks, or start fresh.
- **Strict similarity matching for the create-time check:** match on name + topic overlap + trust-graph relevance. Only show similar communities the user's network already curates. Showing 50 random matches at create time is noise.
- **Discovery-time clustering:** records sharing a `founder_pubkey` are grouped as forks of the same root community in the UI. Records with different founder_pubkeys are surfaced as independent attempts.
- **No hard dedup:** refusing creation by name match fights the architecture and creates first-mover lock-in (whoever grabs "Bitcoin" first owns the namespace forever).

### Q5 — v1 UX scope ✅ CLOSED
Resolved on 2026-05-07. v1 ships with **four user journeys**, scoped per journey:

1. **Discover (no account, full v1).** Land → browse trust-ranked communities → search by name/topic → view a community detail page. Default trust root for unsigned visitors is brainstorm.world's pubkey.
2. **Join / curate (NIP-07 signed in, full v1).** Sign in → find a community → click "Join" (publishes the user's community record + adds it to their `brainstorm-communities` DList) → see "My Communities" → endorse/veto specific members → see how that affects the membership-score map.
3. **Found (NIP-07 signed in, partial v1).** Create flow with the soft-canonicalization gate from Q4 → configure metadata + engine config → pick from a default relay set hosted by brainstorm.world → invite seed members. **Run-your-own-mirror tooling deferred to v1.1** — founders configure relay URLs but actual relay hosting is brainstorm.world-managed for v1.
4. **Participate (basic v1).** Members can post kind-1 notes to community relays; non-members are read-only. Notes appear as a feed on the community detail page. Exercises the membership-whitelist mechanism (only members can write) — proof-point of the differentiator. No threads, reactions, or long-form in v1.

**v1 explicit defers:**
- Run-your-own-mirror tooling and relay-provisioning UX
- Custom community-scoring systems (everyone uses `gr-community-default-v1`)
- Sub-communities, long-form content, polls, structured posts, reactions, threads
- Cross-community feeds
- Forking flow as a distinct UX (forking still works; no special UI)

**Sub-decisions:**
- **Default trust root for unsigned visitors:** brainstorm.world's pubkey for v1; document openly; evolve later (potentially to a council or published seed list)
- **Seeded communities at launch:** 3-5 hand-picked example communities (e.g., Brainstorm, Nostr, NosFabrica, Bitcoin, etc.) so the first visitor has something to interact with — not enough to feel astroturfed
- **Content type for v1:** kind-1 only; richer kinds (long-form, polls) come later

### Q6 — Visual identity ✅ CLOSED
Resolved on 2026-05-07. Approach: **sibling visual identity, with differentiated layouts where the UX requires it.**

- **Same vocabulary:** dark theme, same color palette (`--bg-primary`, `--text`, `--accent`), same typography, same button/form styles, same iconography as brainstorm.world.
- **Different layouts:** community detail page, feed view, member browser, create flow — different page types than search-results, need their own layouts.
- **Sub-brand mark:** "Brainstorm Communities" within the Brainstorm family. Typographic-only differentiation for v1; dedicated logo mark deferred.
- **Cross-product navigation:** header link in both directions ("← Brainstorm Search" / "→ Brainstorm Communities"). Not a unified switcher.
- **Mobile-first.** Social products live and die by mobile. Desktop responsive but secondary.

### Newly surfaced UX questions — embedded in the Design prompt
The earlier list of "newly surfaced UX questions" (what does "join" look like, how to visualize convergence, member-status display, algorithm transparency, etc.) became tactical enough during the design conversation that they're now content of [DESIGN_PROMPT.md](./DESIGN_PROMPT.md) — instructions for Claude Design to make calls on, not standalone strategic decisions for us. Resolutions to v1.1 deferrals (e.g., mirror tooling) are also reflected there.

---

## 7. Future / Out of Scope for v1

Flagged here so they're not forgotten. None of these block v1.

- [ ] **`brainstorm-community-content` DList** per (user, community) — content curation as a layer above pure membership
- [ ] **Sub-communities** via a `parent_community` field on the record
- [ ] **Relay attestations** — members vouching for relay liveness
- [ ] **GrapeRank Scoring Systems registry** — formalize multiple GR systems as first-class addressable resources (also tracked in BIBLE §18 Medium-Term)
- [ ] **Custom scoring systems per community** — lets a community deviate from `gr-community-default-v1`
- [ ] **Forking flow** — graceful UX for legitimate community forks (the Catholicism / Protestantism scenario)
- [ ] **DList NIP spec edit** — clarify that `["disallowed", "..."]` accepts arbitrary tag names. The spec is explicit about this for `required`/`allowed`/`recommended` (examples include `["required", "foo"]`, `["required", "names"]`) but does not say so for `disallowed`. Small upstream PR.

---

## 8. Operational Plan

1. **Branch:** `feat/communities` (this branch). Long-lived feature branch in the style of `feature-magic-carpet`.
2. **Deploy:** new DigitalOcean droplet with CI/CD on push to `feat/communities`, deploying to `communities.brainstorm.world`. Workflow file to be added under `.github/workflows/deploy-communities.yml` following the established pattern (see [OPERATIONS.md](./OPERATIONS.md)).
3. **Implementation order (tentative, subject to revision):**
   - Lock down field sets (resolve Q3)
   - Resolve UX scope (Q4–Q6)
   - Write Design prompt and run Claude Design
   - Implement firmware additions (`brainstorm-community`, `brainstorm-community-signal`)
   - Implement GR Community scoring as a server-side computation
   - Build UI (consumer-facing first, then curator/joiner, then founder)
   - Wire up community relay infrastructure (whitelist generation, mirror tooling)

### Pre-launch concerns to address (not blocking design, but real)

These don't block design or implementation but need a plan before public launch:

- **Hosting cost.** v1 has brainstorm.world hosting relays for any community a founder creates. Storage scales with content; bandwidth scales with usage. For a free product, what are the limits, and at what scale does this become uneconomic? May need rate-limits, per-community quotas, or a "your community needs to fund itself once it crosses X" model.
- **Moderation / legal exposure.** Community relays we host can be used for harmful content (CSAM, threats, etc.). The architecture says moderation is community-driven, but the legal entity hosting the relay still bears risk. Need a takedown / safe-harbor policy and probably a `nostr.json` abuse-reporting endpoint before public launch.

---

## 9. Decisions Status

| Item | Status |
|------|--------|
| Q1 — NIP-72 wrapping vs separate primitive | ✅ Decided: optional `external_ref` field, but Brainstorm and NIP-72 are distinct primitives in the firmware |
| Q2 — What does a Community DO | ✅ Decided: self-curating set of members + relay substrate; content is a downstream emergent layer |
| Data model (DList structure) | ✅ Decided: 1 index DList per user + 2 DLists per community (record as ListItem on index; signals DList) |
| Endorsements vs vetoes structure | ✅ Decided: one signals DList per community, with polarity field |
| Firmware additions | ✅ Decided: `brainstorm-community` + `brainstorm-community-signal` concepts |
| GR Community scoring model | ✅ Decided: two-gate (baseline_GR × community_GR) confidence weighting |
| GR scoring system identifier | ✅ Decided: `gr-community-default-v1` referenced via `weighting_model` field |
| Q3 — Full field set | ✅ Decided: full DList NIP-aware tag schema in §3; `content` field reserved |
| DList NIP-aware tag schema | ✅ Decided: formal `["required", ...]` declarations for required tags; custom `topic` avoids `t` overloading |
| Both-layer representation (DList tags + Concept JSON) | ✅ Decided: both layers populated from v1, kept in sync at write time |
| Q4 — Creation & dedup | ✅ Decided: embrace + soft canonicalization at create time (strict matching); no hard dedup; founder_pubkey clustering at discovery time |
| Q5 — v1 UX scope | ✅ Decided: 4 journeys (Discover/Join/Found/Participate); Found defers mirror tooling; Participate is kind-1 only |
| Default trust root (unsigned visitors) | ✅ Decided: brainstorm.world's pubkey for v1; evolve later |
| Seeded communities at launch | ✅ Decided: 3-5 hand-picked example communities |
| v1 content type | ✅ Decided: kind-1 notes only |
| Q6 — Visual identity | ✅ Decided: sibling visual identity, differentiated layouts; mobile-first; typographic-only sub-brand; header-link cross-navigation |
| Newly surfaced UX questions | ✅ Embedded in [DESIGN_PROMPT.md](./DESIGN_PROMPT.md) for Claude Design to make tactical calls on |
| Design prompt | ✅ Drafted in [DESIGN_PROMPT.md](./DESIGN_PROMPT.md) — pending CEO review |
| DigitalOcean droplet + CI/CD | 🔴 Not started |
| Firmware v1.1.0 (with new concepts) | 🟡 Skeleton drafted at `firmware/versions/v1.1.0/`; v1.0.0 concepts and relationshipTypes/enumerations/elements/sets must be merged in before the active symlink is switched |
