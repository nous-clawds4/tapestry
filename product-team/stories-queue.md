# Stories Queue: Verified Reporters

**Slug:** verified-reporters
**Date:** 2026-06-07
**Source PRD:** `product-team/prd/verified-reporters.md`
**Companion guides:** `product-team/guides/verified-reporters-design-guide.md`, `product-team/guides/verified-reporters-style-guide.md` (+ `verified-reporters-wireframes.html`)

3 stories across 1 block, in dependency order. Engineering should be able to demo the count after Story 1, and the full investigation path after Story 3.

**Handoff note (for the engineering Product Owner):** create one epic umbrella `engineering-team/epics/verified-reporters.md` and a folder `engineering-team/stories/verified-reporters/`, then promote each story below via `/plan-feature`, referencing the PRD and guides. The queue order is the pickup order. User-facing copy must use the style guide's canonical copy table verbatim.

---

## Block 1 — Verified Reporters
*Suggested epic-slug: `verified-reporters`*

The credible negative trust signal: a point-of-view-filtered count of verified users who reported the observed account, and a list of exactly who they are.

---

## Story 1: Verified Reporters count on the profile

**PRD section(s):** §5.1, §5.3
**Persona(s):** The Vetting Observer (primary); The Cautious Newcomer (House fallback behavior)
**Block:** Verified Reporters
**Suggested epic-slug:** `verified-reporters`

**Description:** Surface the point-of-view-filtered Verified Reporters count in the profile's counts row, parallel to Following / Verified Followers, as a negative-signal entry point to the reporters list.

**Acceptance criteria:**
- [ ] On a profile with one or more verified reporters under the active point of view, the counts row shows a value labelled "Verified Reporters", placed parallel to Following and Verified Followers.
- [ ] When the count is greater than zero, the value reads as a negative signal (visually distinct from the positive/neutral counts) and the whole count links to `/user/:pubkey/reporters`.
- [ ] When the count is zero, the value is shown neutrally (not as a warning) and is not a link.
- [ ] When the count is unavailable / not yet computed, a placeholder ("—") is shown, not a link, and is visually distinct from a real zero.
- [ ] While the count is loading, a dimmed/placeholder value is shown (no bare spinner).
- [ ] The count's accessible name states the number and that it opens the list (for example, "3 verified reporters. View list.").
- [ ] The count is computed under the viewer's effective point of view (personal if available, else House), the same point of view used by the other counts on the page.

**Dependencies:** None — uses the verified-reporter count that already exists in the data layer. (The link target page is delivered in Story 3; until then the link may resolve to an unbuilt/empty page. Acceptable within the epic sequence.)

**Notes for engineering:** The per-point-of-view count already exists (it is read today as `verifiedReporterCount`, point-of-view-namespaced, and already rendered as a trust card in `ui/src/pages/BrainstormProfile.jsx`). This story *elevates* it to a count-link in the existing `.bsp-counts` row, mirroring the Following count-link pattern. Negative signal = the existing `--red` token (the app already encodes "report" as red, e.g. the Report action button). Place it to match Verified Followers' treatment **as it exists at build time** (PRD §11 decision 1: match the staging reference, a count-link). No per-count point-of-view marker — that is deferred (PRD §8.3 / §11 decision 5). Route target is `/user/:pubkey/reporters` (PRD §11 decision 2).

---

## Story 2: Verified reporters membership data

**PRD section(s):** §5.2, §6, §7
**Persona(s):** The Vetting Observer
**Block:** Verified Reporters
**Suggested epic-slug:** `verified-reporters`

**Description:** Provide the set of verified users who reported a given account, resolved under the viewer's point of view, so the list and count agree.

**Acceptance criteria:**
- [ ] Given an account and a point of view, the capability returns the set of users who filed a NIP-56 report against that account and are verified within that point of view.
- [ ] Reporters who are not verified within the point of view are excluded (unverified / sybil reporters do not appear).
- [ ] Each returned reporter includes enough identity to display and weigh them: an identifier and the credibility (Rank) metric.
- [ ] The size of the returned set equals the verified-reporter count shown for that account under the same point of view.
- [ ] When the viewer has no calculated point of view, the set is resolved under the House (default) point of view.
- [ ] When the account has no verified reporters under the point of view, an empty set is returned (not an error).

**Dependencies:** None strictly (it is the data capability), but it must ship before Story 3, which consumes it.

**Notes for engineering:** This is the net-new data need identified in PRD §7 — the *count* exists already, but the *membership* (the identities behind it) does not yet. It must use the **same** verified / point-of-view definition that produces the existing count, so count equals list length (AC4 and PRD success metric 1). Mirror how the follows / verified data is computed and exposed (see `src/api/grapevineInteractions/` and the `useGrapevineFollows` hook the follows list uses). All NIP-56 report types are counted together (single pot — no type filtering this release). Reporter identities are public NIP-56 events; no privacy special-casing (PRD §7).

---

## Story 3: Verified Reporters list page

**PRD section(s):** §5.2, §5.3
**Persona(s):** The Vetting Observer (primary); The Cautious Newcomer (point-of-view attribution)
**Block:** Verified Reporters
**Suggested epic-slug:** `verified-reporters`

**Description:** A dedicated page at `/user/:pubkey/reporters` listing which verified users reported the account, ordered by credibility, with explicit point-of-view attribution.

**Acceptance criteria:**
- [ ] Navigating to `/user/:pubkey/reporters` shows a page titled "Verified Reporters", with a back link to the profile and the description "Verified users who have reported this account."
- [ ] The page lists the verified reporters for that account under the viewer's point of view, with default columns picture, name, and Rank, sorted by Rank descending.
- [ ] Selecting a reporter navigates to that reporter's profile.
- [ ] The list length equals the count shown on the profile for the same account and point of view.
- [ ] The page always states whose point of view is in effect — "Relative to your web of trust." (personal) or the House line (fallback) — and an "About this data" control explains the data is computed locally and that counts are personal, with no single global number.
- [ ] When there are no verified reporters, the page shows the designed empty state ("No verified reporters. No one in this web of trust has reported this account."), not a blank and not an error.
- [ ] While loading, a skeleton of the table is shown; on failure, a helpful message with a retry control is shown (never "Something went wrong").

**Dependencies:** Story 2 must ship first — the page renders the membership data that Story 2 provides. Pairs with Story 1 (the count links here), but does not require Story 1 to function.

**Notes for engineering:** Mirror `ui/src/pages/BrainstormFollows.jsx` (the `DataTable`, the search field, the Columns toggle, the `InfoPopover`). Register the route in `ui/src/App.jsx` parallel to `/user/:pubkey/follows` (PRD §11 decision 2: `/reporters`). **Default sort is Rank descending** — deliberately different from the follows list's sort — so the most credible reporters surface first. Search by name / npub. Optional hidden-by-default columns may include npub and Hops. Use the "Rank" label (PRD §11 decision 4). All user-facing strings come **verbatim** from the style guide's canonical copy table. The flag / information / lock glyphs are inherited UI iconography, not copy (PRD §11 decision 3). Extend the "About this data" popover with the no-global-view sentence. *Stretch (PRD §8.2):* a reporter's report timestamp as an optional, hidden-by-default column — only if cheap; not required.

---

## Sequence summary
1. **Story 1 — Verified Reporters count** (independent; demoable immediately on existing data).
2. **Story 2 — Membership data** (the net-new data capability; unblocks Story 3).
3. **Story 3 — List page** (consumes Story 2; completes the investigation path and the count's link target).

**Deferred to later phases (not in this queue):** report-type breakdown (Phase 2); pile-on resistance (Phase 3); self-view privacy controls, web-of-trust education, and the shared counts-row point-of-view indicator (Phase 4); moderator / transaction-vetting surfaces (Phase 5).
