# Story 1: Trusted-list & pin-publish security and data-loss blockers

**Epic:** tag-stack-merge-hardening
**Status:** Done
**Created:** 2026-06-12
**Type:** Bug

## Background

An expert multi-agent review of the tag stack on `feat/pubkey-tagging-target`
found four blockers that must close before the branch merges to a shared
line. All four are in the pre-existing trusted-list / pin-publish code
(Stories 11/19), all re-verified against current code (full evidence:
`engineering-team/stories/_intake.md`, 2026-06-12 entry). Two are security
holes (impersonation, an open prod-scale endpoint); two interlock into a
data-loss bug where a moderately popular tag wipes its own Trusted List.
Until they close, merging exposes them on staging and then production.

## User-facing description

As an **instance operator and as a user who pins tags**, I want the
trusted-list and pin-publish paths to reject forged identities, refuse
anonymous prod-scale triggers, and never destroy a healthy Trusted List on a
transient error, so that pinned-tag curation is safe to run on a shared
deployment.

## Acceptance criteria

- [ ] **AC-1 (no impersonation):** Given a session that has supplied a pubkey
  but has NOT completed the signed-challenge step, when it calls any
  authenticated trusted-list endpoint (`refresh-pinned-tag`,
  `refresh-pinned-tags-for-viewer`, `prepare-nip51-export`), then the request
  is rejected as unauthenticated and no event is published.
- [ ] **AC-2 (auth still works):** Given a session that HAS completed the
  signed challenge, when it calls those same endpoints for its own pubkey,
  then the request is authorized and behaves as before.
- [ ] **AC-3 (no empty Follow Set on first pin):** Given a user pins a tag for
  the first time (no prior kind-30392 exists), when the pin flow runs, then
  any NIP-51 follow-set export the user publishes reflects the
  freshly-computed list membership — never an empty member set derived from a
  not-yet-existing list. If the membership cannot be determined in time, no
  empty list is published under the user's key.
- [ ] **AC-4 (cron endpoint is not publicly triggerable):** Given a request to
  `refresh-all-pinned-tags` that does not originate from the local host, when
  it arrives (including proxied through nginx from the internet), then it is
  rejected and no recompute or publish occurs. The local scheduled task /
  orchestrator path still succeeds.
- [ ] **AC-5 (transient failure does not wipe a TL):** Given a pin whose
  Trusted List refresh fails after the list has been validated/identified,
  when the refresh batch finishes, then the pin's existing Trusted List is
  left intact — no empty-membership replacement is published for it.
- [ ] **AC-6 (large TLs publish):** Given a Trusted List whose signed event
  exceeds the previous shell-argument size limit (~600–700+ members), when it
  is published, then it is stored successfully (no size-related publish
  failure).
- [ ] **AC-7 (refresh schedulable, default off):** Given a fresh deployment,
  when an operator views the scheduled tasks, then a pinned-TL refresh entry
  is present and **disabled by default** (matching existing scheduled tasks);
  enabling it runs the refresh — and only then can stale-TL retraction run.

## Concepts touched

- `tag-pinning` / `tag` (legacy-pinned handles per ADR-0015) — read context
  for TL computation; no concept-definition changes, no firmware reinstall.
- No concept-graph schema changes.

## Out of scope

- The ADR-0022 hybrid e+a writer (Story 2 of this epic).
- All Tier-3 fast-follows: `publishOrThrow` dead-code, d-tag/slug wire edge
  cases, Story-9 search-URL regressions, search perf, Pins UX papercuts
  (`_intake.md` 2026-06-12; to be filed in follow-ups).
- Deleting `deploy-tags.yml` and the doc-hygiene pass (separate cleanup).
- Any change to *who* a TL includes (curation logic) — this story only stops
  destruction and forgery, it doesn't alter membership computation.

## Open questions

1. **Resolved (PO, 2026-06-12):** cron endpoint → **loopback/cron only**; no
   owner-auth path. (AC-4.)
2. **Resolved (PO, 2026-06-12):** fresh-deploy refresh entry → **present but
   disabled**. (AC-7.)
3. For the Architect: blocker 4 has two roots — the error-path missing `dTag`
   and the shell-argument size cap that *causes* the failures. AC-5 and AC-6
   are written so both must be addressed; confirm the publish-path change
   (off the shell arg) doesn't regress the existing strfry-import behavior.

## Linked artifacts

- ADR: `engineering-team/decisions/tag-stack-merge-hardening/0001-trusted-list-and-pin-publish-blockers.md`
- Test plan: `engineering-team/stories/tag-stack-merge-hardening/1-trusted-list-and-pin-publish-blockers.test-plan.md`
- Review: `engineering-team/reviews/tag-stack-merge-hardening/1-trusted-list-and-pin-publish-blockers.md` (PASS)
