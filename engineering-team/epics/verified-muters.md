# Epic: Verified Muters

**Status:** Active
**Book:** `engineering-team/audits/verified-muters/book.md` (acceptance-frame, Direction mode)

## What this is
A fifth point-of-view-filtered profile metric — **Verified Muters** — mirroring Verified Followers: the count of *verified* users (those clearing the same GrapeRank verification bar the sibling metrics use) who have muted the observed account, plus a read path that lists exactly who they are. It is the negative-signal counterpart to Verified Followers, swapping the follow relationship for the mute relationship, and it carries the **same row shape as the Verified Followers list** (no report-specific columns). Owner/House point-of-view only in v1, the same known limitation the sibling metrics already carry.

This epic has two stories: **(1)** the backend read API — surfacing the verified-muter count through the same profile-counts endpoint that already serves verified-follower and verified-reporter counts, plus a verified-muters list read path parallel to the existing follower/reporter list endpoints; and **(2, later)** the frontend surface — the profile counts-row badge (neutral styling, positioned after Hops and before Verified Reporters), the list page, and the visual line break separating the good indicators from the bad ones.

## Stories
`stories/verified-muters/` — dependency-ordered:

1. **verified-muters-read-api** — the backend: the verified-muter count on the profile-counts endpoint and the verified-muters list read path. *(this story)*
2. **verified-muters-profile-surface** — the frontend badge, list page, and line break. *(later)*

## Related
- The `verified-reporters` epic (and the `profile` epic's follows-list story) established the count / list / `DataTable` pattern this epic mirrors. Verified Muters mirrors Verified **Followers** specifically (no per-edge sub-type or timestamp), not Verified Reporters.
