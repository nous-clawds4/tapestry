# Story 4: Publish-time default stamping — parity, the resolver, and the central seam

**Status:** Approved
**Created:** 2026-08-06
**Type:** Feature
**Epic:** `shared-concepts-adoption`
**Book:** `shared-concepts-adoption` (F4)

## Background

The owner's taxonomy (intake 2026-08-05): *"This will help me select z-tags when I publish events:
my default behaviour should be to use the z-tag for my personal concept header + the z-tag for my
shared concept header of choice."* The stamping floor is **already ratified**
([stamping spec](../../../protocols/drafts/stamping.md), W11 graduated): a deliberately-published
item carries its **personal `z` (required)** plus shared handles from the author's **declared
affiliation** — in the spec's own words, *"reached via the author's own pointer-`b`."*

Scoped at `/discuss` (owner decisions, 2026-08-06):

- **The choice IS the pointer-b.** A concept's shared stamps come from the personal header's
  pointer-b targets — wire-visible, spec-verbatim, and managed by the surfaces F5/F1 shipped this
  week. The intake's registry-field sketch is deferred to a future where multi-affiliation
  *ordering* matters. A deferred (sentinel) header resolves to personal-only.
- **Staged reach.** This story finishes what has a fixed, known surface; a follow-up sweep covers
  the scattered client-built writers after the Architect maps them.

The writer inventory (recon 2026-08-06): profile tags and the event-tagging builders already
dual-stamp (tag-federation ADR 0003 — the pattern to finish); **pins and Trusted Lists carry only
the shared handle** (the gap stamping.md's own header names); the item-authoring paths carry only
the personal handle and have no way to learn the shared choice.

**Who is affected:** every consumer filtering by the owner's personal handles (today blind to pins/
TLs) or by community handles (today blind to the owner's items under wired concepts); the
community dictionary the suite feeds.

## User-facing description

As **the owner**, I want everything I publish to carry both of its addresses by default — mine and
my chosen community's — so that **my items are discoverable from either side without me thinking
about z-tags at publish time.**

## Acceptance criteria

- [ ] **Pin parity:** a newly published pin carries its personal (runtime-TA) tag-pinning handle
      beside the canonical shared handle it carries today — the same dual shape profile tags ship
      (tag-federation ADR 0003). The ADR-0015 legacy literal stays untouched.
- [ ] **Trusted List parity:** a newly published TL likewise carries its personal handle beside the
      existing one.
- [ ] **The resolver:** given one of this instance's concepts, the system answers "my stamps for
      items under this concept" — the personal handle alone when the header is unwired or deferred;
      the personal handle **plus the header's pointer-b targets** (bounded by the ratified ~cap)
      when wired. One owner of this rule; answers reflect the header's current state.
- [ ] **The central seam:** an item created through the standard creation path under a **wired**
      concept carries both addresses from birth; under an unwired concept, behavior is unchanged
      (personal only). Inherit-typed b targets do not add stamps beyond the pointer rule stated by
      the resolver's contract *(the Architect confirms the type handling)*.
- [ ] **No regressions:** the already-dual writers (profile tags, event-tagging builders) are
      unchanged; pre-existing published items are untouched (re-stamping stays lazy re-emit, out of
      scope).
- [ ] **Gates:** new tests pass; no suite regresses; `bash scripts/harness-lint.sh` clean.

## Concepts touched

No concept definitions change (no firmware reinstall). Named in plain language: the tag-pinning and
trusted-list concepts (the parity writers' subjects — legacy-literal handling per ADR 0015), and
any wired concept as the resolver's input. Stack is up; the Architect resolves handles as needed.

## Out of scope

- **The client-built-writer sweep** (NewElement / NewProperty / NewDListItem / tapestry drafts /
  any path bypassing the central seam) — the follow-up story; this story's Architect maps the
  candidates as input to it.
- **Clouds** (design-only, unchanged), **re-stamping/backfill** of existing items, **W14's
  optional extras**, **the registry ordering field**.
- **Any change to the ADR-0015 `LEGACY_*` literals.**

## Open questions

None blocking — both scoping questions were settled at `/discuss` (2026-08-06; recorded in
Background). For the Architect: the resolver's home and its consumers' seams; which client-built
writers bypass the central path (the sweep story's input list); confirm pointer-vs-inherit type
handling in the resolver against ADR 0029's semantics.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
