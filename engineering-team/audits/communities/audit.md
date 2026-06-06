# Build Audit: Brainstorm Communities (MVP)

**Book:** `engineering-team/audits/communities/book.md`
**Date:** 2026-06-05
**Branch / commit range:** `feat/communities` (membership arc `4c1c19e3..6c4a7e37`; full communities work from the `feat/communities` lineage)
**Provenance:** Reconstructed manifest, PRD-backed anchor (`product-team/prd/communities.md`)
**Confidence:** medium

> As-built record of the communities MVP. Factual + source-linked; proposes nothing (that's the addendum).

## 1. What shipped
- **Found a circle** as a Community Declaration (kind-39998) — `stories/communities-declaration/33-found-a-circle.md`
- **View a circle** (read-only, no account) — `34-view-a-circle.md`
- **Discover circles** (grid, unions CDs + frozen bespoke) — `35-discover-circles.md`
- **Resolved definition** (§26): a circle inherits its parent's definition live — `36-resolved-definition-resolver.md`
- **Fork a circle** (`b`/§25 inherit-from; omit-unchanged-to-inherit) — `37-fork-a-circle.md` + inherited-field display `38-inherited-field-display.md`
- **Post to a circle** via NIP-22 **kind-1111** (anchored to the CD; avoids kind-1 leakage to Damus/Primal) — `communities-participation/41-post-to-a-cd-circle.md`
- **Membership rule on the CD**: a circle `claims` tag-element(s) + threshold/cutoff, inherited via §26 — `communities-membership/42-cd-claims-membership-tags.md`
- **Assertion writer**: self-tag / vouch / dispute as kind-39999 nostr-user-tags (born hybrid `e`+`a`) — `43-membership-assertion-and-vouch.md`
- **Per-viewer roster engine** (count-based, two-part gate; offline oracle) — `44-per-pov-roster-engine.md`
- **Live roster + Trust Signal UI** on the People tab; "I'm in" + Vouch actions; founder auto-self-tag on founding — `45-trust-signal-and-roles.md`
- **Trust-based posting gate** (declaration circles gate on real membership) — `47-retire-interim-posting-gate.md`

## 2. Epics & stories rolled up

### Epic: `communities-declaration`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #33 found-a-circle | Publish a CD (kind-39998) | Done | (per-story) |
| #34 view-a-circle | Read-only detail | Done | (per-story) |
| #35 discover-circles | CD+bespoke discovery grid | Done | (per-story) |
| #36 resolved-definition-resolver | §26 live inheritance | Done | (per-story) |
| #37 fork-a-circle | `b`/§25 fork | Done | (per-story) |
| #38 inherited-field-display | "(inherited)" markers | Done | (per-story) |

### Epic: `communities-participation`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #41 post-to-a-cd-circle | kind-1111 post + CD anchor | Done | `reviews/communities-participation/41-post-to-a-cd-circle.md` |

### Epic: `communities-membership`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #42 cd-claims-membership-tags | `claims`/threshold/cutoff + §26 inheritance | Done | `reviews/communities-membership/42-44-zero-dependency-batch.md` |
| #43 membership-assertion-and-vouch | kind-39999 writer (born hybrid) | Done | `reviews/communities-membership/43-membership-assertion-writer.md` |
| #44 per-pov-roster-engine | `deriveRoster` (count + two-part gate) | Done | `reviews/communities-membership/42-44-zero-dependency-batch.md` |
| #45 trust-signal-and-roles | roster client + People-tab UI | Done (largely; 2 follow-ups) | `reviews/communities-membership/45-roster-client-data-layer.md`, `45-people-tab-ui.md` |
| #46 cold-start-first-vouch | — | **Deferred (MVP)** | — |
| #47 retire-interim-posting-gate | trust-based composer gate | Done | (per-story; covered by `posting-gate` suite) |

## 3. As-built inventory
- **User-facing:** `/found` (found + fork); circle detail with People / Conversation / How-this-works tabs; the **Trust Signal** component (`components/TrustSignal.jsx`); People-tab live roster + "I'm in"/Vouch; trust-based composer gate.
- **Domain / firmware:** consumes (does not define) brainstorm's `tag` / `nostr-user-tag` / `tag-pinning` concepts (carved onto staging, PR #246; z-tags use the legacy pubkey `82b75e47…3833`, ADR-0015). Community Declaration = kind-39998 with `t=brainstorm-community`.
- **Data & contracts:**
  - Events written: kind-39998 CD (`d`,`t`,`founder`,`name`/`description`/`belonging`,`topic`,`b`,`claims`,`membership_threshold`,`influence_cutoff`); kind-39999 tag-element (`d`=bare slug, `z`=`…:tag`); kind-39999 assertion (`p`,`e`,`a`,`z`=`…:nostr-user-tag`,`polarity`,`d`=`profile-tag-<slug>-<target8>-<asserter8>`); kind-1111 post.
  - Read: `GET ${VITE_PROFILE_API_BASE}/api/profile-tags/profiles-tagged?tagEventId&wotPov=house` (cross-origin, app-as-consumer).
  - Membership writes dual-publish to `MEMBERSHIP_WRITE_RELAYS` (communities relay + env `VITE_TAG_RELAY`).
- **ADRs:** 0027 (`b` tag), 0028 (§26 resolved definition), 0029 (CD shape + strangler), 0030 (membership = claimed tags, count + two-part gate), 0031 (roster-read topology).

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | PRD: membership via a tagging primitive | Community **claims a kind-39999 tag-element** coord (not the 39998 type-concept) | interpretation/constraint | Vinney's wire shape (ADR-0022); 39998 in `z` is the shared type header (ADR 0030 §Resolved-1) | none (internal) | — |
| 2 | PRD: trust-weighted membership | **Count of trusted asserters, two-part gate** (`apps≥threshold AND apps>disputes`), not a weighted sum | constraint-discovered | the server is valence-naive (ADR 0030 §6, Vinney) | "threshold" = integer vouch count, not a score | — |
| 3 | PRD/design: "people **you** trust are inside" on sign-in | **House PoV for v1** (signed-in shows house view) | deferred | per-viewer PoV needs WoT provisioning on the read host (ADR 0031) | personal trust signal not yet per-viewer | per-viewer PoV provisioning |
| 4 | PRD: applicant→member roles on People tab | **Members-only**; applicant role not surfaced | deferred | count endpoint collapses self-application (ADR 0030; story 45) | no "applicant" state yet | `selfApplied` flag on `profiles-tagged` (Vinney) |
| 5 | design: trust signal on **discovery** + detail | **Detail only** | deferred | per-card roster = N fetches; needs batching (story 45) | discover grid has no trust signal | batched discovery trust signal |
| 6 | PRD: a newcomer's first foothold | **Cold-start (46) deferred** | deferred | house-PoV self-tag bootstraps the common case; Q#3 unq (story 46) | true-outsider bootstrap absent | story 46 + ADR 0030 Q#3 |
| 7 | (implicit) one community model | **Two models coexist** — frozen bespoke kind-39999 + new declaration kind-39998 | intentional-change | strangler migration (ADR 0029) | bespoke circles keep old paths; no auto-convert | eventual bespoke→CD migration |
| 8 | conversation posts | **kind-1111 (NIP-22)**, not kind-1 | intentional-change | kind-1 leaks to Damus/Primal (story 41) | posts stay scoped to the circle | — |
| 9 | (deployment) feature works on deploy | **Code-complete, not data-live** until ops config set | constraint-discovered | cross-origin consume needs env + CORS + house-PoV `minRank` (ADR 0031; staging smoke) | roster reads empty until ops lands | ops config (below) |

**Undocumented work:** none found — the diff traces to stories/ADRs. (The founder auto-self-tag shipped under story 47's umbrella in `Found.jsx`, noted in that story.)

## 5. Quality state at close
- **Test gate:** `node test/test.js` → **PASS** (47 story suites + config; membership suites: roster-engine 10, cd-claims-field 11, membership-assertion 10, roster-client 11, founding-publishes-tag-element 5, ui-people-roster 4, posting-gate 6). `vite build` clean; eslint clean.
- **Independent reviews:** every membership story passed an independent (separate-context) adversarial review — no blocking issues at any gate.
- **Known accepted limitations:** the v1 deferrals in §4 (#3–#6); live data gated on ops config (#9).
- **Debt logged (ADR Consequences):** single-parent `b` / shared-`visited` diamond fence in `resolveDefinition.js` must clear before multi-parent claims inheritance (ADR 0028/0030); `influence_cutoff` CD field is inert in v1 (server `minRank` is PoV-driven, ADR 0030 §6/§7).

## 6. Carry-forward register
- [ ] **Ops config to make membership data-live:** `VITE_PROFILE_API_BASE`, `VITE_TAG_RELAY`, CORS for `/api/profile-tags/*`, house-PoV `minRank` (§4 #9).
- [ ] **Applicant role** — needs a `selfApplied` per-row flag on `profiles-tagged` (Vinney ask) (§4 #4).
- [ ] **Discovery-grid trust signal** — batched per-circle roster (§4 #5).
- [ ] **Cold-start (story 46)** + ADR 0030 Q#3 mechanism (§4 #6).
- [ ] **Per-viewer PoV** provisioning → flip `TrustSignal personalPov` to true (§4 #3).
- [ ] **Bespoke → CD migration** (no auto-convert today) (§4 #7).
- [ ] **ADR refolder execution** (ratified with Vinney, not yet executed) + fold ADR-0022.
- [ ] **Multi-parent fork diamond fence** before multi-parent claims inheritance.
