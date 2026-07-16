# Verified Reporters — Product Requirements Document

**Slug:** verified-reporters
**Date:** 2026-06-07
**Status:** Realized 2026-06-07 — built and shipped; see `engineering-team/audits/verified-reporters/` (audit + prd-addendum; story 4 followed post-close on 2026-06-15). *(Status backfilled 2026-07-02, harness sweep — no workflow step flipped it at approval.)*
**Companion guides:** `guides/verified-reporters-style-guide.md`, `guides/verified-reporters-design-guide.md`

> Self-contained. A reader understands the product without opening the phase artifacts.

## 1. Product Vision

A person's Tapestry profile already shows positive trust signals: who they follow, and who within the viewer's trusted network follows them back (Verified Followers). It shows no credible **negative** signal. NIP-56 report data exists on the network, but in raw form it is worthless: a bad actor can manufacture an unlimited number of reports, burying any honest flag in noise. So a meaningful warning that *does* exist in the data is effectively invisible.

**Verified Reporters** closes that gap. It is a count, shown on the profile parallel to Following and Verified Followers, of the verified users — people inside the viewer's own web of trust — who have filed a NIP-56 report against the account being viewed. The count links to a list of exactly who those reporters are, so the viewer can weigh them.

The web of trust is what makes the metric credible. Because only *verified* reporters count, a pile-on of manufactured accounts stays invisible no matter how many reports it files. The number is therefore **relative to who is looking** — there is deliberately no global "verified reporters" figure. When a viewer has no calculated web of trust yet, a House (default) view is shown as a clearly-labeled fallback.

## 2. Positioning & Competitive Context

- **Raw NIP-56 report counts (other Nostr clients).** Some clients tally reports against an account, but the count is global and unfiltered. Structural failure: with no identity cost and no trust filter, reports are infinitely sybil-able, so the number carries no information and is rightly ignored or hidden. The metric is broken at the root, not in its presentation.
- **Centralized trust-and-safety systems.** A platform aggregates reports and acts on them opaquely. Structural failure: the viewer never sees the signal and cannot apply their own standard of whose judgment to trust; the platform's single point of view is imposed as global truth. (General characterization of centralized moderation, not a verified claim about a specific competitor.)
- **Tapestry's own Verified Followers.** Proves the pattern works: a count filtered to the viewer's web of trust, linking to a list. Verified Reporters is its missing negative counterpart.

**Structural advantage:** only a system that already computes a personalized web of trust for each viewer can produce this metric at all. Tapestry already computes it (the per-viewer verified-reporter count exists in the data layer today); this feature surfaces it credibly.

## 3. User Personas

### The Vetting Observer (Primary)
- **Who:** An established user with a calculated web of trust who habitually checks a stranger's profile before following, replying, or amplifying. Reads trust signals fluently. Skeptical of raw counts; trusts only signals filtered through their own network.
- **Goal:** Know at a glance whether people *they* trust have flagged this stranger, before engaging.
- **Core loop:** Encounter a stranger → open profile → scan trust signals including Verified Reporters → if non-zero, open the list and weigh *who* reported → decide to engage, ignore, or avoid → sharper instincts next time.
- **Friction (won't tolerate):** A count they can't trust (global noise); a number with no way to see who is behind it; ambiguity about whose point of view the number reflects; latency that breaks the snap judgment.

### The Cautious Newcomer (Secondary)
- **Who:** New or logged-out, with no calculated web of trust yet. Wants to avoid bad actors but has no personal network to filter through. Exploratory and wary; does not yet understand web-of-trust mechanics.
- **Goal:** Get some credible signal about whether a stranger is widely flagged, despite having no network of their own.
- **Core loop:** Land on a profile (often via a shared link) → look for trust signals → see the House (default) view → understand it is a default, not a personal or global truth → use it provisionally → build a network over time and graduate into the Vetting Observer's loop.
- **Friction (won't tolerate):** A silent "global" number that contradicts the no-global-view principle; confusion about why their number differs from an established user's; a dead end that requires an account before showing any value.

*Moderators and transactors are deferred inheritors of the same signal (see §9). At this scope they would want exactly what the Vetting Observer wants, so they are not modeled separately.*

## 4. User Journeys

### Vetting Observer
1. **Encounter.** A stranger appears (mention, feed, search); the observer opens the profile. The trust-signals row loads, including a Verified Reporters count filtered to the observer's point of view. *Routine, scanning.*
2. **Notice the signal.** The count is non-zero. It reads clearly as a negative signal, attributed to the observer's own point of view. *Alert, cautious.*
3. **Investigate.** The observer opens the list and sees *which* verified users reported the account, ordered so the most credible reporters surface first. *Discerning.*
4. **Decide.** Follow, ignore, or avoid — a judgment supported by evidence. *Confident.*
5. **Recalibrate.** Over repeated encounters the signal sharpens the observer's instincts. *Trusts the system.*

*First-visit note:* the first time the count is seen it must be self-explanatory — a clear label plus point-of-view attribution — so it is never mistaken for a global number.

### Cautious Newcomer
1. **Arrive.** Follows a shared link with no account and no calculated web of trust. The Verified Reporters count shows via the House (default) view rather than failing or showing nothing. *Curious, wary.*
2. **Read with uncertainty.** The viewer sees a count but has no network of their own. The interface states this is the House (default) view, not a personal network. *Needs clarity.*
3. **Understand the model.** The viewer learns the real number is personal and earned by building a network; there is no single global truth. *Oriented, not misled.*
4. **Graduate.** Over time the viewer builds a web of trust, returns, and reads a count of their own. *Invested.*

## 5. Feature Specification

### 5.1 Profile — Verified Reporters count
- **Purpose:** Surface the point-of-view-filtered count of verified users who reported this account, parallel to Following and Verified Followers, as the entry point to the list.
- **Content:** A numeric value and the label "Verified Reporters", placed in the existing counts row next to Following and Verified Followers.
- **Behavior:**
  - When the count is greater than zero, the value is shown as a **negative signal** (distinct from the neutral/positive counts) and the whole item links to the Verified Reporters list for this account.
  - When the count is zero, the value is shown **neutrally** (not as a warning) and is **not** a link — there is nothing to inspect. This is the count's own empty state.
  - When the count is not available or not yet computed, a placeholder ("—") is shown, not a link, visually distinct from a real zero.
  - While loading, the value is shown in a dimmed/placeholder state, never a bare spinner.
  - **Point-of-view attribution:** the count carries no per-count point-of-view marker. Whose view produced the number is stated on the Verified Reporters list (§5.2), one tap away. A shared, counts-row-level indicator covering Following, Verified Followers, and Verified Reporters together is deferred to a cross-cutting session (§8.3): the House fallback applies to all three counts at once, so marking it three times would crowd the row. Accepted tradeoff: a glance-only viewer on the House fallback sees an unlabeled number at the count level; the list one tap away attributes it fully.
  - The accessible name of the count states the number and that it opens the list (for example, "{n} verified reporters. View list.").
- **Actions (logged-in users):** none beyond navigation; this is a read surface. (The existing Report action elsewhere on the profile is unchanged and out of this feature's scope.)

### 5.2 Verified Reporters list (`/user/:pubkey/reporters`)
- **Purpose:** Show *which* verified users reported the account, so the observer can weigh their credibility, and make the point of view explicit.
- **Content:**
  - A header with a back link to the profile, the title "Verified Reporters", and an information control.
  - A one-line description: "Verified users who have reported this account."
  - A **point-of-view line**, always present: under a personal view, "Relative to your web of trust."; under the House fallback, "Relative to the House (default) web of trust. Sign in and build your network to see your own view."
  - A table of reporters. Default columns: picture, name, and **Rank** (the reporter's trust/credibility score). Additional columns (point-of-view-relative metrics such as degrees of separation) are available through a column toggle, hidden by default.
  - A search field to filter the list by name or identifier.
  - An information popover ("About this data") explaining that the data is computed locally by this instance and that counts are personal to each viewer's web of trust, with no single global number.
- **Behavior:**
  - The list contains exactly the verified reporters counted on the profile, under the same point of view, so **the count equals the list length**.
  - Default sort is by **Rank, descending** — the most credible reporters first, so "is this flagged by people who matter?" is answerable at a glance.
  - Selecting a reporter opens that reporter's profile, so the observer can vet the reporter.
  - **Empty state** (zero verified reporters): "No verified reporters. No one in this web of trust has reported this account." Never blank, never an error.
  - **Loading state:** a skeleton of the table (placeholder rows), not a bare spinner.
  - **Error state:** a helpful message and a retry control — what went wrong and what to do — never "Something went wrong."
- **Actions (logged-in users):** search, toggle columns, open a reporter's profile.

### 5.3 Traceability
Every shippable element maps to a persona and a journey step.

| Element | Persona | Journey step |
|---|---|---|
| Count on profile, point-of-view-filtered | Vetting Observer | Encounter (1), Notice (2) |
| Negative-signal treatment of the count | Vetting Observer | Notice (2) |
| Count links to the list | Vetting Observer | Investigate (3) |
| List of *which* reporters, ordered by Rank | Vetting Observer | Investigate (3), Decide (4) |
| Reporter rows link to reporter profiles | Vetting Observer | Investigate (3) |
| Point-of-view line + "About this data" popover (on the list) | Cautious Newcomer | Arrive (1), Read with uncertainty (2), Understand (3) |
| Zero-state (neutral count / designed empty list) | Vetting Observer | Notice (2) |

## 6. Data Model

Conceptual only — what the product knows about, not how it is stored.

**Entities**
- **Nostr User** — an account identified by its public key. Plays three *roles* in this feature, not three entity types: the *observed user* (profile being viewed), the *observer* (viewer, whose point of view the count reflects), and the *reporter* (a user who filed a report). Attributes used here: public key (required), display name (optional).
- **NIP-56 Report** — a published flag in which one Nostr User formally reports another. Attributes: reporter (the author), subject (the user reported), report type (the NIP-56 category — captured but **not surfaced or split** in this release; all types are counted together), time created, and the underlying source event. A report is effectively immutable once published.
- **Point of View** — the trust lens through which "verified" is judged. Has a kind (personal or House) and, when personal, an owner (the observer). The House view is the platform's default lens, used only when the viewer has no calculated web of trust.
- **GrapeRank Score** — the personalized trust score of a Nostr User within a given point of view. Whether a reporter is "verified" derives from this score meeting the **same threshold already used by Verified Followers**; it is not redefined here.

**Relationships**
- A Nostr User (reporter) **files** a NIP-56 Report.
- A NIP-56 Report **targets** a Nostr User (subject).
- A Point of View **belongs to** a Nostr User (observer), or is the House view when none is available.
- A GrapeRank Score **scores** a Nostr User **within** a Point of View.
- A Nostr User **is verified within** a Point of View when their score meets the verification threshold.

**Derived view (the feature itself)** — *Verified Reporters of an observed user, relative to a point of view* = the set of Nostr Users who both **file** a report **targeting** that user and **are verified within** that point of view. The count is the size of that set; by construction, count equals list length under one point of view.

**Lifecycle that matters**
- **Point-of-view resolution:** personal web of trust if available, otherwise House fallback. This single branch is the Cautious Newcomer's experience and must be made legible.
- **Verified status is dynamic:** a reporter moves between verified and unverified as the observer's web of trust is recomputed. The count is a live function of (reports × web of trust), never a stored tally.

## 7. Trust Model & Concept Mapping

Architecturally significant points, stated at capability level (no implementation prescription).

- **Personalization is intrinsic.** The count and the membership of the list are both functions of the viewer's point of view. The same profile yields different numbers to different viewers. This is by design, not a bug, and is the core of the product's credibility.
- **Concept mapping (Tapestry).** Nostr User, Web of Trust, and GrapeRank Score map to existing concept handles (`nostr-user`, `web-of-trust`, `graperank`). A NIP-56 Report is a Nostr Event (`nostr-event`) of the report kind (`nostr-kind`, kind 1984). The Point of View lens and the derived Verified Reporters view are application-level notions, not concept-graph nodes.
- **Existing vs. new capability.** The per-viewer verified-reporter **count** already exists in the data layer (it is already shown elsewhere on the profile as a non-interactive figure). The genuinely new capability this release requires is the **membership** behind that count — the identities of the verified reporters, resolved under the viewer's point of view — surfaced as a list. The count surface is an elevation of existing data; the list is the net-new data need.
- **Abuse posture.** Manufactured pile-ons by non-verified accounts are already invisible because only verified reporters count. Pile-ons by *verified* users remain possible; discounting them is explicitly deferred (see §9). Reporter identities are already public NIP-56 events, so showing them creates no new disclosure.

## 8. Scope Boundaries

### 8.1 In Scope (must ship)
- Verified Reporters count on the profile, point-of-view-filtered, parallel to Following / Verified Followers.
- Count computed under the viewer's effective point of view: personal web of trust if available, else House fallback (reusing the platform's existing fallback, not a new one).
- Point-of-view attribution on the list: the list always states whose view is in effect (personal or House), via the point-of-view line and the "About this data" popover. The count carries no per-count marker (the shared counts-row indicator is deferred; see §8.3).
- Count links to a dedicated Verified Reporters list page; the list shows which verified users reported the account, with enough identity to weigh them.
- Count equals list length under the same point of view.
- Explicit zero-state (neutral count; designed empty list), distinct from "not computed".
- All NIP-56 report types counted together (single pot).
- Self-view shows the same count and list as any viewer using that point of view (no special-casing).
- Designed loading and error states for both surfaces.

### 8.2 Stretch
- A reporter's report timestamp as an optional, hidden-by-default column on the list.

### 8.3 Out of Scope (Phase 2+)
- Splitting or breaking down the count by NIP-56 report type (Phase 2).
- Pile-on resistance: detecting, tagging, and discounting pile-on-prone verified reporters (Phase 3).
- Self-view retaliation mitigation and reporter-identity visibility controls (Phase 4).
- Onboarding/education about the web of trust beyond the minimal point-of-view label and popover (Phase 4).
- Moderator and transaction-vetting surfaces that consume the same signal (Phase 5).
- A counts-row point-of-view indicator shared across Following, Verified Followers, and Verified Reporters (Phase 4). A single, tap-friendly (not hover-only, which fails on touch devices) indicator for the whole counts row. Deferred because the House fallback applies to all three counts together and is better solved once for the shared row than stamped three times by this feature.

## 9. Phase Roadmap
- **MVP — Credible negative signal.** The point-of-view-filtered Verified Reporters count and its inspectable list. *(This PRD.)*
- **Phase 2 — Report-type granularity.** Break the single pot into NIP-56 types (filter and breakdown).
- **Phase 3 — Reporter quality weighting.** Detect, tag, and discount pile-on-prone reporters.
- **Phase 4 — Abuse & privacy controls.** Self-view retaliation mitigation, reporter-identity visibility, web-of-trust education.
- **Phase 5 — Inheritor surfaces.** Moderator triage and transaction-vetting consumers of the signal.

## 10. Success Metrics
Observable by inspection of the live product; no instrumentation that does not yet exist.

1. For 20 sampled profiles known to have reporters, the displayed count equals the number of verified reporters under the viewer's point of view **and** equals the list length, in 100% of cases.
2. A logged-out / no-web-of-trust viewer who opens the Verified Reporters list sees the House point-of-view line on every sampled profile; the list never presents an unlabeled number, in 100% of sampled profiles. (Count-level point-of-view indication is deferred; see §8.3.)
3. The count appears in the same trust-signals row as Following / Verified Followers, links out, and shares their point-of-view and fallback behavior, verified by inspection on 100% of sampled profiles.
4. No load-time regression: the profile renders the count within the same latency envelope as the existing counts (no perceptible added delay on sampled profiles).
5. A zero-report profile renders the explicit zero-state (neutral count; designed empty list), not a blank or an error, in 100% of sampled cases.

*Engagement metrics (click-through, behavior change after viewing) require instrumentation not yet present and are deferred, not MVP criteria.*

## 11. Decisions & Open Questions
Each names a decision and its options. Items 1–5 are resolved (decisions recorded inline, 2026-06-07); they remain documented so engineering sees both the choice and the reasoning.

1. **Placement parity with Verified Followers.** The live staging profile shows Verified Followers as a count-link in the counts row; the current `feat/communities` branch renders it as a non-interactive trust card. Where does the Verified Reporters count sit?
   - (a) Place it as a count-link in the counts row regardless, matching the staging reference. *(Recommended — matches the approved design and the primary persona's expectation.)*
   - (b) Match the branch's current Verified Followers treatment (trust card).
   - (c) Elevate both Verified Followers and Verified Reporters to count-links (scope expansion beyond this feature).
   *Resolution owner: Architect, against the build-time state of the profile.*
   - **Decision: (a)** — match the staging reference (count-link in the counts row).

2. **List route name.** `/user/:pubkey/reporters` vs `/user/:pubkey/verified-reporters`.
   - (a) `/user/:pubkey/reporters` — short, parallel to the existing `/follows`. *(Recommended.)*
   - (b) `/user/:pubkey/verified-reporters` — explicit, matches the feature name.
   - **Decision: (a)** — `/user/:pubkey/reporters`, parallel to `/follows`.

3. **Unicode glyphs vs. language guardrail.** The approved design reuses the app's existing unicode glyphs (flag, information, lock) as iconography. The language guardrail bans "emoji in product copy."
   - (a) Treat these glyphs as inherited UI **iconography**, not copy, and permit them (they match the app's established icon language; the Report metric already uses the flag glyph). *(Recommended.)*
   - (b) Replace them with hand-crafted SVG to satisfy a strict reading.
   - (c) Drop them entirely.
   - **Decision: (a)** — treat the glyphs as inherited UI iconography (permitted); not copy.

4. **"Rank" label.** The reporter list shows the credibility score as "Rank" (matching the existing follows table), while the profile calls the same family of score "Verification Score." This naming inconsistency predates this feature.
   - (a) Use "Rank" on the list for consistency with the existing table. *(Recommended for this release; harmonizing the vocabulary is a separate cleanup.)*
   - (b) Use "Verification Score" on the list to match the profile.
   - **Decision: (a)** — use "Rank" for consistency with the existing table; harmonizing the vocabulary is a separate cleanup.

5. **Counts-row point-of-view indicator.** Whether to indicate the active point of view (personal vs House) at the counts-row level in this feature.
   - (a) Add a per-count "House" qualifier on Verified Reporters. *(Rejected — the fallback applies to all three counts at once; three qualifiers crowd the row.)*
   - (b) Add a single, tap-friendly row-level indicator for all three counts now. *(Rejected for this feature — it restyles the shared counts row that Following and Verified Followers occupy; cross-cutting, better designed once.)*
   - (c) Attribute point of view on the list page only, and defer a shared counts-row indicator to a cross-cutting session.
   - **Decision: (c)** — list-page attribution ships now; the shared counts-row indicator is deferred to Phase 4 (see §8.3). Accepted tradeoff: a glance-only viewer on the House fallback sees an unlabeled count, fully attributed one tap away on the list.
