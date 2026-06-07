# Scope: Verified Reporters

**Slug:** verified-reporters
**Date:** 2026-06-07
**Manager phase:** Scope & Prioritization (Phase 3)

## Features extracted
Every feature implied by the journeys, listed flat.

- A Verified Reporters count shown on the profile, in the trust-signals row alongside Following and Verified Followers.
- The count is filtered to the observer's web of trust (only *verified* reporters count).
- The count is computed against the observer's **effective PoV** — their personal WoT if available, else the House PoV fallback.
- The count is visually legible as a *negative* / warning signal, distinct from the positive counts.
- The count links to a dedicated Verified Reporters list page.
- The list shows *which* verified users reported the observed user, with enough identity to judge credibility.
- The count and the list agree (same PoV and filter → count equals list length).
- Whose PoV is in effect (personal vs House) is attributed, so the number is never mistaken for a global truth.
- A House PoV fallback for viewers with no calculated WoT, labeled as the default view.
- First-visit / logged-out value (no account wall before the signal is visible).
- Zero-state: "no verified reporters" renders explicitly, distinguishable from "not computed."
- Self-view behavior (viewing one's own profile).
- All NIP-56 report types counted together in a single pot.
- Split / breakdown by NIP-56 report type.
- Pile-on resistance: detect and tag pile-on-prone verified reporters and discount/ignore their reports.
- Inheritor surfaces: moderator triage and transaction-vetting consumers of the same signal.

## MVP boundary
The minimum feature set that delivers core value to the primary persona (the Vetting Observer): *a credible, PoV-filtered count of who-I-trust has flagged this account, with a way to see who.*

### In scope (must ship)
- [ ] A **Verified Reporters count** on the profile, placed parallel to Following / Verified Followers.
- [ ] Count is **PoV-filtered** — only verified reporters (inside the observer's WoT) are counted.
- [ ] Count is computed against the observer's **effective PoV**: personal WoT if available, else **House PoV fallback** (the platform's standard fallback — reused, not reinvented).
- [ ] **Whose PoV is in effect is attributed on the list page** (personal vs House) — so the number is never read as a global truth. (Count-level / counts-row PoV indication is deferred; see below.)
- [ ] Count is **clickable → a dedicated Verified Reporters list page** (the primary persona will not tolerate a number with no way to see who is behind it — the list is core, not optional).
- [ ] The list shows the **verified users who reported** the observed user, with enough identity to judge credibility.
- [ ] **Count = list length** under the same PoV/filter (internal consistency).
- [ ] **Zero-state** renders as an explicit "no verified reporters," distinguishable from an uncomputed/error state.
- [ ] **All NIP-56 report types counted together** (single pot).
- [ ] **Self-view shows the same count/list** as any observer using that PoV — no special-casing (reports are public NIP-56 events; reporter identity is already discoverable network-wide).

### Out of scope (deferred)
Each deferred item names its phase. No item is deferred without a phase.

- Split / breakdown by NIP-56 report type → **Phase 2**
- Pile-on resistance: tag pile-on-prone verified reporters and discount/ignore their reports → **Phase 3**
- Self-view retaliation mitigation and reporter-identity visibility controls → **Phase 4**
- Inheritor surfaces (moderator bulk triage, transaction-vetting consumers) → **Phase 5**
- Richer fallback education/onboarding beyond the minimal PoV label → **Phase 4**
- Counts-row PoV indicator shared across Following / Verified Followers / Verified Reporters (a single, tap-friendly indicator for the whole row) → **Phase 4** (cross-cutting session; the House fallback applies to all three counts at once, so it is solved once for the shared row, not three times here)

## Phase roadmap
Each phase has a theme.

- **MVP:** Credible negative signal — the PoV-filtered Verified Reporters count and its inspectable list.
- **Phase 2:** Report-type granularity — break the single pot into NIP-56 types (filter/breakdown).
- **Phase 3:** Reporter quality weighting — pile-on resistance: detect, tag, and discount pile-on-prone reporters.
- **Phase 4:** Abuse & privacy controls — self-view retaliation mitigation, reporter-identity visibility, fallback education.
- **Phase 5:** Inheritor surfaces — moderator triage and transaction-vetting consumers of the signal.

## Success metrics
Concrete and observable without instrumentation that doesn't yet exist (verifiable by inspection of the live page).

- For **20 sampled profiles** known to have reporters, the displayed count equals the number of verified reporters under the observer's PoV **and** equals the list length, in **100%** of cases.
- A **logged-out / no-WoT viewer** sees a House-PoV-labeled count on every sampled profile (fallback never blank, never unlabeled) — **100%** of sampled profiles.
- The Verified Reporters count appears in the **same trust-signals row** as Following / Verified Followers and links out, matching their placement and PoV/fallback semantics — verified by inspection on **100%** of sampled profiles.
- **No load-time regression:** the profile page renders the new count within the same latency envelope as the existing counts (no perceptible added delay on sampled profiles).
- Zero-state renders as explicit "no verified reporters" (not a blank, not an error) on **100%** of sampled zero-report profiles.

> Engagement metrics (click-through on the count, behavior change after viewing) require click instrumentation not yet present and are therefore deferred, not MVP success criteria.

## Tradeoffs
What we gain by cutting what we cut.

- **Lumping all report types** → we ship the credible signal and prove the pattern now; we lose granularity (a "5" doesn't say 5-spam vs 5-impersonation), but the primary persona can still inspect the list. Gain: speed and the core trust judgment.
- **Deferring pile-on resistance** → we accept that even verified users can pile on, but the worst case (bad-actor sybil pile-ons) is *already* invisible because only verified reporters count. Gain: ship without building reputation-weighting machinery.
- **Minimal PoV label instead of a fallback-education flow** → we keep the no-global-view ethos legible without building onboarding. Gain: the principle holds; the teaching is deferred.
- **No self-view special-casing** → we ship one consistent model and accept bounded retaliation risk now, because NIP-56 reports are already public events (the information isn't secret). Gain: simplicity; deferral is safe, not reckless.
