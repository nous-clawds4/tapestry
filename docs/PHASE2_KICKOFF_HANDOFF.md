# Handoff: Communities Phase 2 kickoff (continuity log)

**Status:** 🔴 OPEN — pick this up in a fresh chat. The communities **MVP book is closed**; the next job is to **plan Phase 2 through the PRODUCT harness**.
**Date:** 2026-06-05
**Branch:** `feat/communities` (auto-deploys to communities.brainstorm.world). As of writing, local == origin, working tree clean, HEAD = `2abf3486` (book-close) + this doc.

---

## 0. First actions for the new chat (do these in order)
1. Read `~/.claude/.../memory/MEMORY.md` (you likely already have it) — confirm you're in the **Brainstorm Communities** workstream (`~/Documents/Tapestry/communities`, repo `nous-clawds4/tapestry`, branch `feat/communities`). NOT Unbnd.
2. Read the closed book's **return-edge artifacts** — these are your grounding for Phase 2:
   - `engineering-team/audits/communities/audit.md` (as-built record + deviations + carry-forward)
   - `engineering-team/audits/communities/prd-addendum.md` (product-facing deltas, deferrals, **5 open questions for product**)
   - `engineering-team/audits/communities/book.md` (manifest, Status: Closed)
3. Read `product-team/prd/communities.md` (the v1 PRD — immutable) and `product-team/README.md` (product harness layout).
4. Then **enter Product Team Mode** and run the Phase-2 planning (see §3 below). Do **not** start engineering — this is a *product /discover* for Phase 2, grounded in the addendum.

**Standing constraints (unchanged):** commit/push **only when the user asks**; no AI-slop copy (peer-not-owner voice, no "approve/admit", no em-dash joins/superlatives); no hand-rolled crypto (Applesauce/nostr-tools/@noble only); quality bar = no shortcuts, no tech/product debt, fix-don't-defer-when-cheap. Every code change runs the PO→Architect→Tester→Implementer→Reviewer harness with independent (separate-context) reviews. The test runner is `node test/test.js` (CommonJS, source-regex + pure-fn eval; each suite `module.exports = { run }`, registered in `test/test.js`).

---

## 1. What shipped in the MVP (closed book)
Full detail in `audits/communities/audit.md`. In brief — all live on `feat/communities`:
- **Declaration circles** (kind-39998): found, view (no account), discover, **fork** (`b`/§25) with **§26 live resolved-definition inheritance**.
- **Conversation**: post via **NIP-22 kind-1111** (anchored to the CD; no kind-1 leakage).
- **Trust-based membership** (the novel hard part): a circle `claims` a kind-39999 **tag-element**; belonging is asserted via signed kind-39999 nostr-user-tags (self-tag / vouch / dispute), born hybrid (`e`+`a`). The roster is **derived per viewer**, never stored: count of trusted asserters, gated `applications ≥ threshold AND applications > disputes` (two-part, valence-naive — mirrors brainstorm.world's `applyDisputesFunction`).
- **UI**: People-tab live roster + **Trust Signal** ("N people you trust are inside" / "N established members"), "I'm in" + Vouch actions, founder auto-self-tags on founding, **trust-gated posting**.
- **Architecture**: app-as-consumer — the app **reads** trust/membership from brainstorm.world's tag engine cross-origin (ADR 0031), it does not recompute trust.
- **ADRs**: 0027 (`b`), 0028 (§26), 0029 (CD + strangler), 0030 (membership model), 0031 (roster-read topology). Vinney's ADR-0022 (hybrid `e`+`a`) lives on the carve branch.

## 2. Live state TODAY — works vs dark (read this carefully)
**Works on communities.brainstorm.world now:** discover → read → **found** → **fork**. (Founding publishes the CD + tag-element + a founder self-tag.)

**Built but DARK** (deployed, shows nothing): the whole membership/trust surface — People-tab roster, Trust Signal, vouch — because the roster reads from brainstorm.world's tag engine, which is **not yet reachable in production**:
- The tag core (PR #246) is on **staging.brainstorm.world**, not yet promoted to prod `brainstorm.world`.
- Live data is gated on ops/config: `VITE_PROFILE_API_BASE` (→ a host that has the tag core), **`VITE_TAG_RELAY`** (dual-publish target so the engine's strfry sees our assertions), **CORS** for `/api/profile-tags/*`, and a house-PoV **`minRank`** (else trust filtering is OFF — everyone counts).

⚠️ **KNOWN GOTCHA / quick fix pending a decision:** Story 47 made posting in **declaration** circles require roster membership. Since the roster reads empty until the above lands, **conversation in new circles is currently locked — even for the founder.** The user was offered a one-line graceful fallback (if the roster is `degraded`/unreachable, fall back to the interim `signedIn && joined` gate so conversation isn't dead) and **has not yet decided**. Resolve this early in Phase 2 (either do the fallback, or it self-heals when ops config lands). Code: `ui-communities/src/pages/CommunityDetail.jsx` → `canCompose`.

## 3. THE PHASE 2 MISSION (what the new chat is here to do)
**Plan Phase 2 through the product harness** (Product Team Mode — `/discover` → user modeling → scope → … → PRD → stories), grounded in `prd-addendum.md`. The product flow opens *warm*: "here's what shipped (audit), here's where it drifted and what's deferred (addendum) — now scope v2." End by emitting an updated `stories-queue.md` / `prd/communities-v2.md` for engineering to pick up.

**Phase 2 scope = three things the user named:**
1. **All the deferred work** from the MVP close (the carry-forward register in §4).
2. **Make communities "fully alive"** — the everyday social texture that turns scaffolding into a living community: replies/threads, reactions, live updates, notifications, onboarding/invites, member profiles/directory, richer discovery/search, moderation/dispute-resolution. (Brainstorm these in product discovery; the list in §4 "fully alive" is a seed, not the spec.)
3. **Remove the three legacy test communities** — see §5.

Treat the addendum's **§5 "Open questions for product"** (cold-start mechanism, default threshold, founder-auto-belong ratification, house-vs-personal framing for launch, bespoke→CD migration) as decisions Phase 2 discovery must resolve.

## 4. Carry-forward register (deferred work — verbatim from the audit)
**Immediate (turn the lights on):**
- [ ] Ops config to make membership data-live: `VITE_PROFILE_API_BASE`, `VITE_TAG_RELAY`, CORS for `/api/profile-tags/*`, house-PoV `minRank`. **Also: promote the tag core (PR #246) from staging → prod brainstorm.world.**
- [ ] The posting-lock fallback (§2 gotcha).
**Deferred v1 product gaps (have homes):**
- [ ] **Applicant role** — needs a per-row `selfApplied` flag on `profiles-tagged` (a **Vinney ask**).
- [ ] **Discovery-grid Trust Signal** — needs a batched per-circle roster fetch (N cards = N fetches today).
- [ ] **Cold-start (story 46)** — a true outsider's first vouch; mechanism is ADR 0030 Q#3 (founder-grant / provisional standing / invite-carries-a-vouch). The sharpest Newcomer gap.
- [ ] **Per-viewer PoV** provisioning → flip `TrustSignal personalPov` to true (today everyone sees the *house* view).
- [ ] **Bespoke → CD migration** (the two models coexist via strangler; no auto-convert).
- [ ] **ADR refolder execution** (ratified with Vinney, not executed) + fold ADR-0022.
- [ ] **Multi-parent fork diamond fence** in `resolveDefinition.js` before multi-parent claims inheritance.
- [ ] `influence_cutoff` CD field is inert in v1 (server `minRank` is PoV-driven) — decide whether the endpoint should accept a per-call `minRank` override.
**"Fully alive" seeds (not yet built, brainstorm in discovery):**
- [ ] Conversation: replies/threads, reactions, real-time/live updates (posts refresh on action, not live).
- [ ] Notifications ("you were vouched", "new posts").
- [ ] Onboarding + invites (invite could carry the cold-start vouch).
- [ ] Member profiles / directory; richer discovery (search, topics, activity, sorting).
- [ ] Moderation / dispute-resolution beyond raw vouch/dispute counts.

## 5. Remove the three legacy test communities
The user confirms there are **three legacy communities on the live site that are just tests and can go.** These are **real events on the communities relay** (created during MVP testing — e.g., one by Avi, one by David), **NOT** the 8 mock seeds in `ui-communities/src/data/mockData.js` (mock-mode only). Phase 2 should:
1. **Enumerate them** — hit the live discover path / relay to list the actual circles and identify the 3 test ones (their slugs + author pubkeys + kind, 39998 CD vs 39999 bespoke).
2. **Plan removal** — nostr events aren't trivially deleted; options to scope: NIP-09 kind-5 deletion requests (only the author can sign), or strfry-side removal on the communities relay (`docker exec tapestry … strfry delete …` — see OPERATIONS.md / house rules: stack runs in Docker). Decide which, and whether it's a one-off cleanup or a reusable "retire a circle" capability (the latter is a real product feature — "archive/delete a circle").
3. This is a good **discovery + small eng** item; route the cleanup through the engineering harness once scoped.

## 6. Outstanding cross-team asks (relay to David/Vinney)
- **Vinney:** add a per-row `selfApplied` flag to `profiles-tagged` (unlocks the applicant role); promote the tag core to prod when ready; confirm the dual-publish relay URL (or set up a relay mirror, ADR 0031 A1/A2).
- **David/ops:** set `VITE_PROFILE_API_BASE` + `VITE_TAG_RELAY` on the communities deploy; confirm CORS for `/api/profile-tags/*`; set house-PoV `filters.rank.min` (`minRank`).
- Integration contract detail: `docs/COMMUNITIES_TAG_CORE_INTEGRATION_HANDOFF.md` (🟡 LIVE ON STAGING).

## 7. Key files & pointers
- **Roster/membership code:** `ui-communities/src/lib/roster.js` (getRoster, resolveTagElement, two-part gate via `membership.js#isMember`), `ui-communities/src/lib/membership.js` (deriveRoster oracle), `ui-communities/src/events/assertion.js` (writer), `ui-communities/src/events/declaration.js` (CD builder), `ui-communities/src/events/publish.js` (`MEMBERSHIP_WRITE_RELAYS`).
- **UI:** `ui-communities/src/pages/CommunityDetail.jsx` (People tab + gate), `ui-communities/src/components/TrustSignal.jsx`, `ui-communities/src/pages/Found.jsx` (founding publishes CD + tag-element + founder self-tag).
- **Product artifacts (your inputs):** `product-team/prd/communities.md`, `product-team/guides/communities-design-guide.md` (Trust Signal spec + copy), `product-team/stories-queue.md`.
- **Engineering record:** `engineering-team/epics/communities-*.md`, `engineering-team/stories/communities-*/`, `engineering-team/decisions/communities-*/`, `engineering-team/reviews/communities-membership/`.
- **Local env:** `docker-compose.override.yml` + `.env` (gitignored; 8080→80; Neo4j pw `tapestry-local-2026-dev`). Stack is Docker (`docker exec tapestry …`).

## 8. Git / state
- All MVP + close work is committed and pushed to `origin/feat/communities` (verified even). Nothing unpushed at handoff time (except this doc — commit it).
- Book folder `engineering-team/audits/communities/` is **live** (not yet retired to `audits/done/` — that happens after the product team ingests the close, i.e., after Phase 2 discovery reads it).
