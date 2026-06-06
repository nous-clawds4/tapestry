# Story 34: Followers list on the primary profile page

**Status:** Approved
**Created:** 2026-06-06
**Type:** Feature
**Epic:** profile

## Background
Story #33 added a **"Verified Followers"** count to the primary profile (`/user/<pubkey>`), shipped as a plain (non-link) number *pending this follow-up*. This story makes that count actionable: clicking it opens a dedicated page to see and evaluate the accounts that follow this user — ranked by local trust signals — **mirroring the existing Follows page (#29)**. It is the inbound counterpart to Follows: Follows lists who a user *follows* (outbound); this lists who *follows* the user (inbound).

Because a prominent account can have millions of raw followers, **v1 lists the *verified* followers** — those whose web-of-trust standing clears the instance's verification cutoff (the same set the count reflects). An "all followers" view is deferred. Affected: anyone viewing a profile (logged-in or logged-out).

## User-facing description
As someone viewing a profile, I want to open that person's verified followers as a list ranked by trust signals, so that I can explore and judge who follows them — without leaving the primary UI.

## Acceptance criteria
Testable from the outside. Each criterion gets at least one test.

**Navigation & URL**
- [ ] **Entry point.** Given a profile at `/user/<pubkey>`, when it renders, then the "Verified Followers" count is a link that navigates **in the same tab** to `/user/<pubkey>/followers`. *(This replaces the plain number shipped in #33.)*
- [ ] **Return.** Given the followers page, when the user activates a "← Back to profile" control (and likewise the browser back button), then they return to `/user/<pubkey>`.
- [ ] **Direct load.** Given `/user/<pubkey>/followers`, when loaded directly, then the page shows `<pubkey>`'s verified followers computed from the **instance owner's (House)** point of view.
- [ ] **Row navigation.** Given a row (an account that follows `<pubkey>`), when the viewer activates it, then they navigate **in the same tab** to that account's own `/user/<that-pubkey>` profile.

**The list**
- [ ] **Listing.** Given the profile user has N verified followers, when the page loads, then each verified follower appears as one row. If N = 0, an empty-state message is shown.
- [ ] **Verified scope.** The list contains **only** followers whose trust standing clears the instance's verification cutoff (the same definition behind the "Verified Followers" count); unverified / bot followers are excluded. *(An "all followers" view is deferred — see Out of scope.)*
- [ ] **Default sort.** When the page loads, all N rows are ordered by **verified-followers count, descending**, across the whole list (not just a visible page).
- [ ] **Re-sort.** Given the list, when the user sorts by any visible column, then the rows reorder accordingly; the default remains verified-followers descending.
- [ ] **Search.** Given the list, when the user types in an in-page search, then rows are filtered by name / display name or npub.
- [ ] **Pagination.** Given more rows than fit one page, then results are paginated; moving between pages preserves the current sort, search text, and column visibility.

**Columns**
- [ ] **Default visibility.** On first load with no saved preferences, the visible columns are **picture, name, rank**; the hidden columns are **npub, hops, verified followers, verified muters, verified reporters**.
- [ ] **Toggle.** Every column can be shown or hidden by the user.
- [ ] **Persistence.** A user's column show/hide choices persist across reloads and sessions; a "reset to defaults" control restores the default visibility above.
- [ ] **Name fallback.** Each row's name column shows the display name; if absent, the name; if both absent, a shortened npub.
- [ ] **Rank.** The rank column shows an integer **0–100**, equal to `round(influence × 100)` from the owner's point of view (not a raw decimal).

**Point of view (v1: owner / House only)**
- [ ] **Owner point of view.** All metrics (rank, hops, verified counts) are computed from the **instance owner's (House)** point of view, for every viewer (including logged-in customers and logged-out visitors). *(The point-of-view selector, customer-relative metrics, and `?observer=`/`?pov=` support are deferred — mirroring Follows #29.)*

**Disclosure**
- [ ] **Local-data disclosure.** The page provides a **tappable** ⓘ affordance revealing a note that all data here is computed **locally by this Tapestry instance and is not imported via NIP-85**; it works by tap on touch devices (not hover-only).

**Parity**
- [ ] **Follows-page parity.** The page matches the Follows page (`/user/<pubkey>/follows`) in layout, columns, controls, and behavior — differing only in direction (followers, inbound) and the verified-only scope.

## Deferred to a follow-up
- **All-followers view** (unverified included) — v1 is verified-only ("verified now, all later," per the planning decision).
- **Customer-observer / personalized point of view** — the PoV selector, customer-relative metrics, and `?observer=`/`?pov=` support. (Note: the #33 *count* honors `?pov=`; this table does not yet — a known minor inconsistency to reconcile when personalized support lands.) Same deferral as Follows #29: customer metrics live on a different node type / query path (ADR 0026).

## Concepts touched
*(Concept Graph API at `:8877` unreachable during planning — named in plain language; the Architect should resolve handles via `/api/concept-graph/summaries`.)*
- **Follower (inbound follows)** — an account that follows the profile user (the kind:3 relationship, inbound direction); distinct from "follows / following" (outbound).
- **Verified follower** — a follower whose influence clears the instance's verification cutoff (the set this page lists).
- **GrapeRank influence / rank** — per-account trust score (0–1), shown scaled to an integer 0–100 ("rank").
- **Hops** — graph distance from the observer.
- **Verified followers / muters / reporters** — per-row counts of accounts that follow / mute / report the row's account above the cutoff, from the owner's point of view.
- **Observer / point of view (House / owner)** — the pubkey all scores are computed relative to (v1: owner).
- **Profile** — picture / name / display_name for the picture and name columns.

## Out of scope
- **All-followers (unverified) view** — deferred.
- **Personalized / customer point of view** for this table — deferred.
- **Other interaction types** — mutes / muters / reports / reporters tables (in `_intake.md`); the duplicate "Verified Followers" rows in the profile trust-metrics grid; the verification-cutoff inconsistency. All untouched.
- Changing the Follows page (#29) or the legacy pages.
- Serving / importing these metrics over NIP-85 (local-only; the disclosure says so).

## Open questions
Resolved during planning:
- **Table scope?** → **Verified followers only for v1**; all-followers deferred ("verified now, all later").
- **Point of view?** → **Owner / House only for v1**, mirroring Follows #29; personalized deferred.
- **Link target?** → `/user/<pubkey>/followers`.

None open.

## Notes for the Architect
- **Mirror the Follows feature (#29 / ADR 0026).** Follows is `/user/:pubkey/follows` backed by an owner-PoV list endpoint that traverses the follow edge *outbound* from the profile user and returns, per row, rank (from influence) / hops / the three verified counts, read from the owner node. **Followers is the reverse direction** (the follow edge inbound), additionally **filtered to verified** (influence above the cutoff).
- **Generalize-vs-mirror is your call:** extend the existing follows list endpoint/page to also serve followers (a direction/type parameter) vs. a parallel followers endpoint/page. Note: a *generic* interaction endpoint already supports a `verifiedFollowers` type but returns only pubkey/hops/influence — **not** the three verified counts this table's columns + default sort require, so it isn't sufficient as-is.
- The default sort is **verified-followers descending across the entire set**, so those counts must be available to rank the whole list (not fetched lazily per visible row) — same constraint as #29.
- Reuse the shared table component + #29's persistence / search / pagination patterns; the deltas are direction (inbound) + the verified-only filter. This is a **large story** (parity with #29's ~16 criteria); you may propose phasing the implementation (data path before UI) within one ADR.

## Linked artifacts
- ADR: `engineering-team/decisions/profile/0030-profile-followers-list.md` (Accepted 2026-06-06)
- Test plan: `engineering-team/stories/profile/34-profile-followers-list.test-plan.md` (27 tests — 23 failing T + 4 regression sentinels; confirmed failing 2026-06-06; also inverts #33's T5 plain→link)
- Review: (filled in after Review phase)
