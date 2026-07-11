# Epic: tag-stack-merge-hardening

**Created:** 2026-06-12
**Status:** Active

## Goal

Close the blockers an expert multi-agent review found in the tag stack on
`feat/pubkey-tagging-target`, so the branch can merge to staging (then main)
without shipping security holes or data-loss bugs. The review verdict: clean
merge mechanically, well-built bulk of 22 stories, but four blockers plus an
Accepted-ADR/impl mismatch must close first.

Scope is **pre-merge hardening only** — the headline tag features already
work. None of the blockers are in the search-api-result-controls work (that
reviewed clean); all are in the pre-existing trusted-list / pin-publish code.

## Stories (planned)

1. **Trusted-list + pin-publish blockers** (Bug) — the four verified blockers:
   - Auth bypass: `requireAuth` must check `session.authenticated`
     (`src/api/trustedList/index.js:162`).
   - Empty Follow Set on first pin: await-then-export in
     `ui/src/pages/Tag.jsx:122`.
   - Open `refresh-all-pinned-tags`: enforce loopback/owner-auth
     (`src/api/trustedList/index.js:171`).
   - TL self-wipe: return computed `dTag` on the error path
     (`refreshPinnedTags.js:216`) **and** move TL publish off the 128 KiB
     shell arg (`index.js:73`).
   Bundle the Tier-4 scheduler-entry + don't-enable-retraction-before-fix-#4
   concern here, since they interlock.

2. **ADR-0022 hybrid e+a writer** (Feature) — the writer is e-only
   (`ui/src/utils/publishProfileTag.js:56`); ADR-0022 is Accepted and ships in
   this PR, so every e-only event grows the un-backfillable legacy set. Add the
   `a` tag (`39999:<tagAuthor>:<slug>`) to the writer and union the read path.
   Architect to reconcile with ADR-0015's legacy-pubkey pinning.

## Out of scope (→ fast-follows, post-merge)

`publishOrThrow` dead-code / silent publish failures; d-tag/slug wire edge
cases; Story-9 search-URL regressions; prod-scale search perf; Pins UX
papercuts. Captured in `engineering-team/stories/_intake.md` (2026-06-12 entry)
and to be filed in `follow-ups.md` / a post-merge cleanup epic.

## Notes

- Full review triage + per-finding file:line evidence: `_intake.md`
  2026-06-12 entry.
- Tag UI ships visible to prod on the main promotion (confirmed intended) —
  only the search API is gated (search-api-result-controls ADR 0001).
- Merge order stays `feat → staging → verify → main` (OPERATIONS §1).
