# Brainstorm Communities — Feature Plan

**Status:** Pre-implementation, in active design phase.
**Branch:** `feat/communities` (this branch).
**Deploy target:** `communities.brainstorm.world` (DigitalOcean droplet + CI/CD to be set up).
**Companion docs:** [BIBLE.md](./BIBLE.md), [ROADMAP.md](./ROADMAP.md), [OPERATIONS.md](./OPERATIONS.md).

This file is the working planning artifact for the Brainstorm Communities feature. It captures decisions made to date and tracks open questions. The Design prompt for Claude Design will be drafted here (or in a sibling `DESIGN_PROMPT.md`) once the open questions in §6 are resolved.

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
  │
  ├── ListItem: Alice's record of Community X   (kind 39999)
  │     • json tag = metadata + engine config (her personal projection)
  │     ↑ z-tag
  │     └── Signals DList for Community X   (kind 39998, d-tag: "comm-{slug}-signals")
  │           └── ListItems (kind 39999): one per (target pubkey, polarity)
  │                 • json: { target, polarity: "endorse"|"veto", reason?, weight? }
  │
  ├── ListItem: Alice's record of Community Y
  │     ...
```

Endorsements and vetoes share one DList with a polarity field — same kind of signal, opposite sign. One subscription pattern for any mirror relay computing whitelists.

### Field Sets (preliminary — subject to refinement under Q3)

**Community record** (the ListItem's `json`):

- `name` (req) — display name
- `description` (req) — what the community is about
- `banner_url?` — image URL
- `topics?[]` — tags
- `language?` — primary language
- `founder_pubkey?` — informational
- `external_ref?` — for NIP-72 wrapping: `{ type: "nip72", a_tag: "..." }`
- `relay_set[]` — relay URLs that serve this community
- `seed_members[]` — pubkeys used to seed the membership algo
- `weighting_model` — defaults to `"gr-community-default-v1"` (a GR Scoring System identifier)
- `endorsement_threshold` — number ∈ [0, 1] (default 0.5)
- `veto_policy` — how vetoes count (TBD: enum or small object)

~12 fields, most optional.

**Signal item:**

- `target_pubkey` (req)
- `polarity` (req): `"endorse" | "veto"`
- `reason?` — free-text justification
- `weight?` — for graded endorsements ("strong endorse" vs "weak endorse"); v1-vs-later TBD

4 fields.

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

Two new concepts to add. These will go in the next firmware version after v1.0.0 (likely v1.1.0):

1. **`brainstorm-community`** — full concept treatment (all 8 core nodes, JSON schema enforced). Schema covers the community-record field set above. This is the heavyweight one because it must be evolvable and validated.

2. **`brainstorm-community-signal`** — concept with schema for endorsement/veto items. Lighter but worth normalizing so mirror relays can validate signals before counting them.

The user's `brainstorm-communities` index DList does **not** need its own firmware concept — it's just "a DList of items conforming to the `brainstorm-community` concept."

The `brainstorm-communities` DList will be created locally (deterministic d-tag) when each user first loads the firmware.

---

## 6. Open Design Questions

These must be resolved before the Design prompt is drafted.

### Q3 — Lock down the field sets
Sketched in §3. Sub-questions:
- Is `weight?` on signal items v1 or later?
- What's the shape of `veto_policy`?
- Does the record carry a `created_at` field, or rely on event timestamp?
- Is `parent_community` an v1 field (sub-communities) or deferred?

### Q4 — Creation and dedup
What stops "10,000 communities called Bitcoin" on day one? Options:
- (a) Embrace it: trust-ranked discovery sorts duplicates naturally
- (b) Soft canonicalization: surface "are you sure? these existing communities look similar" at create time
- (c) Hard dedup: prevent identical names entirely

Probably some combination; needs a call.

### Q5 — v1 UX scope
Three flavors of user, all valid v1 candidates:
- **Consumer** — browse trust-ranked communities, view details, no account needed
- **Curator/joiner** — sign in with NIP-07, join communities (publish endorsements), curate personal community list
- **Founder** — create a community, set up initial members, optionally run a mirror relay

Which of these does v1 ship with? My instinct: all three at a basic level, but "run a mirror" is operationally complex and may need to be deferred.

### Q6 — Visual identity
Sibling to brainstorm.world (same dark theme, same vibe), or differentiated to signal a different surface?

### New questions surfaced from the deep design conversation
- What does "join a community" actually DO in the UI? (Technically: creates Alice's community record event + adds it to her index. But what's the user-facing affordance — a button labeled "Join"? "Add to my list"? "Curate"?)
- How — if at all — do we visualize the membership-convergence story to non-technical users? It's the killer feature; we have to make it tangible.
- How is "run your own mirror relay" surfaced — first-class call-to-action, or buried in advanced settings?
- What does a no-account first-load show — featured communities, default trust root rankings, prominent search bar, all of the above?
- Where does the user see WHY someone is or isn't a member of a community (algorithm transparency)?

---

## 7. Future / Out of Scope for v1

Flagged here so they're not forgotten. None of these block v1.

- [ ] **`brainstorm-community-content` DList** per (user, community) — content curation as a layer above pure membership
- [ ] **Sub-communities** via a `parent_community` field on the record
- [ ] **Relay attestations** — members vouching for relay liveness
- [ ] **GrapeRank Scoring Systems registry** — formalize multiple GR systems as first-class addressable resources (also tracked in BIBLE §18 Medium-Term)
- [ ] **Custom scoring systems per community** — lets a community deviate from `gr-community-default-v1`
- [ ] **Forking flow** — graceful UX for legitimate community forks (the Catholicism / Protestantism scenario)

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
| Q3 — Full field set | 🟡 Sketched, needs lockdown |
| Q4 — Creation & dedup | 🔴 Open |
| Q5 — v1 UX scope | 🔴 Open |
| Q6 — Visual identity | 🔴 Open |
| Newly surfaced UX questions | 🔴 Open |
| Design prompt | 🔴 Pending Q3–Q6 + new questions |
| DigitalOcean droplet + CI/CD | 🔴 Not started |
| Firmware v1.1.0 (with new concepts) | 🔴 Not started |
