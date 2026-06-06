# PRD Addendum: communities — Brainstorm Communities (MVP)

**Reconciles:** `product-team/prd/communities.md` *(immutable — never edited)*
**Build audit:** `engineering-team/audits/communities/audit.md`
**Date:** 2026-06-05
**Authored by:** engineering (Reviewer at book scope)

> Stands beside the PRD; records where the build diverged, why, and what the next product cycle should pick up. Recommendations here are *input* — the product team owns the re-scope and issues any superseding `prd/communities-v2.md`.

## 1. Summary
The communities MVP shipped end-to-end: found/fork circles as Community Declarations, post via NIP-22, and — the headline — **trust-weighted, per-viewer membership** with a Trust Signal and trust-gated posting. The build is **code-complete and reviewed, but not yet data-live**: the membership roster reads from brainstorm.world's tag-scoring engine cross-origin, which needs deployment config (env + CORS + a web-of-trust threshold) before real rosters appear. Three product behaviors were consciously deferred: per-viewer (vs house) trust view, the applicant role, and the cold-start path for a true outsider.

## 2. Deviations from the PRD

### 2.1 Intentional changes
- **Two community models coexist.** The frozen original ("bespoke", kind-39999) and the new Community Declaration (kind-39998) run side by side (strangler migration). Existing circles keep working; they do **not** auto-convert to the new trust-membership model.
- **Conversation posts are NIP-22 (kind-1111), not kind-1.** This keeps circle conversation from leaking into general nostr clients (Damus/Primal) — a privacy/scoping improvement over the naive approach.
- **Membership is a count of trusted vouchers, not a weighted score.** "Threshold" is an integer number of trusted vouches (e.g. 1, or ≥2 for a stricter circle), and a member needs more vouches than disputes. This matches the underlying trust engine, which is deliberately valence-naive for now.

### 2.2 Deferred (cut to a later phase)
- **Per-viewer trust view** → *next phase.* v1 shows the **house** point-of-view to everyone (signed-in included). "N people *you* trust are inside" becomes truly personal once each viewer's web-of-trust is provisioned on the read host.
- **Applicant role** → *next phase.* The People tab shows **members only**; "applicant" (someone who said "I'm in" but hasn't cleared the bar) needs a small addition to the trust engine's read API.
- **Trust Signal on the Discovery grid** → *next phase.* It ships on the circle **detail** page; putting it on every discovery card needs a batched data path to stay fast.
- **Cold-start for a true outsider (the newcomer with no connections)** → *next phase.* In v1, anyone already in the broad web of trust bootstraps by saying "I'm in"; a deliberate path for the fully-unconnected newcomer (and which mechanism — founder grant / provisional standing / invite-carries-a-vouch) is an open product decision.

### 2.3 Added beyond the PRD
- **Founder auto-belongs.** Founding a circle now auto-asserts the founder's membership, so a new circle isn't empty. Worth ratifying as expected product behavior.
- **"App-as-consumer" trust architecture.** Communities reads trust/membership from brainstorm.world's engine rather than re-computing it. This is an architectural choice with a product consequence (below).

### 2.4 Constraints discovered
- **The feature needs deployment config to show real data.** Because membership is read cross-origin from brainstorm.world's trust engine, the live roster stays empty until env vars, CORS, and a house web-of-trust threshold are set. **Product implication:** "shipped to the branch" ≠ "members see rosters" — there's an ops gate between code-complete and user-visible. The trust threshold being unset also means trust filtering is *off* until configured (everyone counts), which would make the trust signal meaningless in a demo.

## 3. Impact on the product model
- **Personas / journeys:** the **Newcomer** journey is partially served — discovery + "I'm in" work, but the cold-start foothold (§2.2) is the persona's sharpest need and is deferred. The **Convener** journey gains founder-auto-belong.
- **Scope / roadmap:** four items reslotted to a "membership v2" phase (per-viewer PoV, applicant role, discovery trust signal, cold-start).
- **Domain model:** membership is **derived per viewer from tags**, never a stored roster; a community **claims** a tag, the tag never points at the community (many-to-many). The PRD's membership language should adopt this.
- **Design rules:** the design guide's "personal on sign-in" trust signal is a *v2* behavior; v1 is house-only — the guide should mark that.

## 4. Recommended scope for the next phase
- Wire the **ops config** and verify a real roster on staging — this is the gap between "built" and "usable" (audit carry-forward #1).
- Ask Vinney for the **`selfApplied` flag** to unlock the **applicant role** (#2/#4).
- Decide and build **cold-start** (the Newcomer foothold) — the highest-leverage product gap (#4 / ADR 0030 Q#3).
- Provision **per-viewer PoV** to make the trust signal personal (#3).
- Plan the eventual **bespoke→CD migration** (#7).

## 5. Open questions for product
1. **Cold-start mechanism** — founder-granted initial vouch / time-bounded provisional standing / invite-link-carries-a-vouch? (ADR 0030 Q#3.)
2. **Default membership threshold** — 1 vouch (open) vs ≥2 (safer space) as the product default? (ADR 0030 Q#4.)
3. **Founder auto-belong** — ratify as intended, or should founding stay a separate act from belonging?
4. **House-vs-personal framing** — is showing the house view to signed-in users acceptable for launch, or is per-viewer a launch blocker?
5. **Bespoke circles** — leave frozen indefinitely, or commit to a migration path to the trust model?
