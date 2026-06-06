# Story 33: Verified-followers count on the profile page

**Status:** Approved
**Created:** 2026-06-06
**Type:** Feature
**Epic:** profile

## Background
The main user profile page shows a prominent **"Following"** count — how many accounts a user follows — beside the identity and action buttons. There is no equivalent count for *followers*.

For followers, a raw total is actively misleading: a prominent account may be followed by large numbers of bots and spam accounts, so the raw number says little about real standing. What's meaningful is the count of **verified** followers — accounts whose standing in the web of trust clears the system's existing verification threshold. The system already computes this count; this story surfaces it on the profile page.

Affected: anyone viewing a profile (logged-in or anonymous). This is **sub-feature 1** of two; the followers *table* (a browsable list of those followers) is sub-feature 2 and is deferred.

## User-facing description
As a visitor to a user's profile page, I want to see how many *verified* followers that user has — shown prominently alongside the existing "Following" count — so that I can gauge their real standing in the trust network without being misled by bot or spam followers.

## Acceptance criteria
Testable from the outside.

- [ ] Given any user's profile page, when it finishes loading, then a count labeled **"Verified Followers"** appears in the same prominent counter area as the existing "Following" count.
- [ ] Given the displayed count, then it reflects only *verified* followers (followers whose web-of-trust standing clears the system's existing verification threshold) — not the user's raw/total follower count.
- [ ] Given no point-of-view is specified, when the profile loads, then the count is computed from the default (**House**) point of view.
- [ ] Given a personalized point-of-view is selected (e.g., via the page address) and verified-follower data for it is available, when the profile loads, then the count reflects that point of view; if it is unavailable, then it falls back to the House point of view.
- [ ] Given a user for whom no verified-follower data exists (e.g., a profile not yet scored), when the profile loads, then a neutral placeholder is shown (consistent with how the "Following" count handles missing data) — not an error and not a misleading "0".
- [ ] Given a user with zero verified followers, when the profile loads, then the count shows "0".
- [ ] Given the "Verified Followers" count, then it is displayed as a plain (non-interactive) number — not a link — in this story. (It is intended to become a link to the followers list once sub-feature 2 ships.)

## Concepts touched
*(Concept Graph API at `:8877` was unreachable during planning — named in plain language; Architect to resolve handles via `/api/concept-graph/summaries`.)*

- **Verified follower** — a follower whose influence / web-of-trust score clears the verification threshold. The displayed metric.
- **Influence / GrapeRank score** — the per-account web-of-trust score the verification threshold is applied to.
- **Verified-followers influence cutoff** — the existing, configurable threshold parameter that defines "verified." This story *reuses* it; it does not define a new one.
- **Point of view (PoV) / House PoV** — whose web of trust the score is computed from. Default is the House PoV; a personalized PoV may be selected.
- **Follower (inbound follows)** — an account that follows this user (the inbound direction of the follows relationship).

## Out of scope
- The followers **table/list page** (a browsable list of the verified followers) — sub-feature 2, deferred. The count is a plain number until that ships.
- Generalizing the followers view to other relationship types (mutes / muters / reports / reporters).
- Changing, reconciling, or re-defining the verification threshold value or the meaning of "verified" — this story consumes the existing parameter as-is. *(The cross-tree inconsistency between the configured value, the code fallback, and the UI's "Verification Score > 2" description is logged separately in intake as a cleanup.)*
- The duplicate "Verified Followers" entries already present in the profile's trust-metrics grid — reconciliation logged separately in intake.
- Computing or recomputing verified-follower counts for personalized PoVs — the story consumes whatever the system already produces; it does not build the per-PoV computation pipeline.
- Any change to the existing "Following" count's behavior.

## Open questions
None outstanding. Resolved during planning:
- **Link target** → the count is a **plain (non-link) number** for now; it becomes a link when the followers table (sub-feature 2) ships.
- **Label** → **"Verified Followers"** (not bare "Followers"), so the deliberately verified-only figure is not misread as a raw follower total.

## Linked artifacts
- ADR: `engineering-team/decisions/profile/0029-profile-verified-followers-count.md` (Accepted 2026-06-06)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
