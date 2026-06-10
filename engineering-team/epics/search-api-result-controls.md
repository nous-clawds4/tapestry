# Epic: search-api-result-controls

**Created:** 2026-06-10
**Status:** Active

## Goal

Let an instance operator control which result types the public search API
includes, with shipped defaults that exactly reproduce `main`'s current
response contract. This is the defensive mechanism that lets the tag-aware
search work on `feat/pubkey-tagging-target` merge to main with **zero
behavior change for existing API consumers** — tags become an opt-in
result type per instance.

## Origin

Discussed ~2026-06-05 during the nostr-user-tag carve-out for Communities
("we wanted to add an API setting to hide tags from search API results"),
but never captured as a repo artifact until now. The carve-out itself was
search-safe (tag-aware search was not carved), so the setting only becomes
load-bearing when the full tag-search integration heads to main — which is
now.

## Stories

1. `stories/search-api-result-controls/1-search-api-result-type-settings.md`
   — per-result-type admin setting on the search API, defaults = main's
   current behavior.

## Preconditions & ops notes

- **Branch catch-up first:** `feat/pubkey-tagging-target` (351 behind
  staging / 357 behind main, 125 ahead as of 2026-06-10) is merged up to
  date with staging/main *before* this epic's Architecture phase, so the
  design targets current code. Mechanical task, outside the stories.
  Caveat: pushing that branch auto-deploys tags.brainstorm.world.
- **tags.brainstorm.world opt-in:** after this epic ships there, an
  operator flips the tags result type ON so that instance keeps its
  tag-including search behavior.
- **brainstorm.world / staging:** defaults stay untouched — consumers see
  no change.
