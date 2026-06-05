# Story 42: A Community Declaration claims its membership tag(s)

**Status:** Design-ahead (blocked on the nostr-user-tag core + Open Q#1)
**Type:** Feature · **Epic:** `communities-membership` · **ADR:** 0030.

## Background
Membership is "people carrying the tag(s) this community claims." So a Community Declaration must declare **which label(s)** count, plus a **threshold** and an **influence cutoff**. This is the definition side — no roster yet.

## User-facing description
As a **Convener**, I want to say which trust signal makes someone a member of my circle, so that belonging is defined by a rule, not a list I maintain.

## Acceptance criteria
- [ ] The CD carries a `claims` declaration: one or more tag-label references the community consumes as membership.
- [ ] The CD carries a membership **threshold** and an **influence cutoff** preset.
- [ ] The `claims`/threshold/cutoff resolve through `b`-inheritance (§26) — a fork inherits them unless it overrides.
- [ ] Founding + fork flows let the convener set/inherit these (plain-language UI, not jargon).

## Out of scope
Roster derivation (Story 44). Writing tags (Story 43). The exact label encoding — Open Q#5 in ADR 0030.

## Linked artifacts
ADR 0030; depends on Open Q#1 (what a label references) + Q#5 (encoding).
