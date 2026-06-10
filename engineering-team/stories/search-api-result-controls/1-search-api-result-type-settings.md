# Story 1: Admin control over result types in the public search API

**Epic:** search-api-result-controls
**Status:** Approved
**Created:** 2026-06-10
**Type:** Feature

## Background

The `feat/pubkey-tagging-target` branch carries tag-aware search: the
public search API there returns tag results alongside profile results, and
profile results can match and be annotated via applied tags. `main`'s
search API (what brainstorm.world API consumers see today) has none of
this.

We want to merge the tags feature to main without changing what existing
API consumers receive. The defense is an admin-controlled, per-result-type
inclusion setting on the search API, **with shipped defaults that exactly
reproduce main's current behavior** (tags excluded). Instances that want
tag results (e.g. tags.brainstorm.world) opt in by flipping the setting.

This task was discussed around 2026-06-05 ("we wanted to add an API
setting to hide tags from search API results") but never captured as a
story — this story backfills it. **Precondition (tracked outside this
story):** `feat/pubkey-tagging-target` is first caught up with
staging/main, so Architecture designs against current code.

## User-facing description

As an **instance operator**, I want to control which result types my
instance's public search API includes, with defaults matching today's
production behavior, so that I can adopt new search capabilities (like
tags) on my own schedule without surprising existing API consumers.

## Acceptance criteria

- [ ] **AC-1 (safe default):** Given a deployment with shipped default
  settings, when any consumer queries the public search API, then the
  response is contract-identical to main's current behavior: no tag result
  entries, no tag-derived annotations on profile results, and no profiles
  included *solely* because a tag matched the query.
- [ ] **AC-2 (opt-in):** Given an admin has enabled tag results, when a
  consumer queries the search API, then tag results appear and tag-derived
  profile matching/annotations behave as they do on the feature branch
  today.
- [ ] **AC-3 (per-type control):** Given the admin settings surface, when
  the admin views it, then each known search result type (today: profiles,
  tags) is independently toggleable, and the displayed state reflects the
  active configuration. Disabling **profiles** is allowed but the surface
  shows a warning that it effectively empties search results.
- [ ] **AC-4 (no redeploy):** Given an admin changes a result-type
  setting, then subsequent search API requests reflect the change without
  a code deployment or rebuild.
- [ ] **AC-5 (authorization):** Given a non-admin/unauthenticated actor
  attempts to change the setting, then the change is rejected and the
  configuration is unaffected.
- [ ] **AC-6 (own UI coherence):** Given tags are disabled, when a user
  searches in the instance's own search UI, then no tag rows appear in the
  live popup or the results page (the UI honors the same setting as
  external consumers).

## Concepts touched

- `tag` / `nostr-user-tag` (legacy-pinned handles per ADR-0015) — the
  result type being gated; read-context only, no concept changes.
- No concept-graph or firmware changes. This is operator-level API
  contract control, not trust/POV logic — POV-first invariants govern
  *ranking within* enabled types and are unchanged.

## Out of scope

- The branch catch-up merge itself (precondition, separate mechanical
  task — see the epic file).
- `/api/profile-tags/*` endpoints — already on main (carve-out PR #246),
  dormant, not gated by this setting.
- Tag features elsewhere in the UI (profile chips, tag pages, pins) —
  untouched.
- Per-user / per-POV visibility of tags — this is an instance-level
  operator setting by design.
- Flipping the setting ON for tags.brainstorm.world — ops step after
  deployment, noted in the epic.

## Open questions

1. **Disabled-type contract:** when a type is disabled, are its response
   fields omitted entirely (= byte-match with main) or present-but-empty?
   PO lean: omitted, since AC-1 demands contract-identity. Architect
   verifies against main's actual response shape.
2. ~~**Profiles toggle footgun.**~~ **Resolved (PO, 2026-06-10):** allow
   disabling profiles, with a warning on the settings surface (folded into
   AC-3). Warning copy/placement is the Architect's call.
3. **Settings read freshness:** AC-4 assumes settings are read per-request
   (existing settings system seems to support this). Architect confirms;
   if a restart were required, AC-4 needs renegotiation.

## Linked artifacts

- ADR: `engineering-team/decisions/search-api-result-controls/0001-search-api-result-type-settings.md`
- Test plan: (after Test Design)
- Review: (after Review)
