# Story 2: Rename to Class Thread Relationships

**Status:** Approved
**Created:** 2026-07-12
**Type:** Doc

## Background

Handoff D4 ([`docs/NIP_REORG_DESIGN_HANDOFF.md`](../../../docs/NIP_REORG_DESIGN_HANDOFF.md), PR #344): the `n`/`s` NIP's current name — "Class-Thread Membership Tags" — collides with the Tags/Taggings feature vocabulary, and the document's payoff was always the *derived relationships* (`HAS_ELEMENT`, `IS_A_SUPERSET_OF`), the tags being their wire encoding. S1 (shipped, PR #345) deliberately cited the old filename pending this story. Substance is ratified and does not change.

## User-facing description

As a reader of the protocol corpus, I want the `n`/`s` spec named for what it defines — class-thread *relationships* — so that "tags" in a spec title unambiguously means the Tags/Taggings feature, and links across the corpus keep resolving.

## Acceptance criteria

- [ ] **AC1 — rename, history preserved.** `protocols/drafts/class-thread-tags.md` no longer exists; `protocols/drafts/class-thread-relationships.md` exists; the rename is a git move (`git log --follow` shows the file's prior history).
- [ ] **AC2 — retitle + guard.** The document title is "Class Thread Relationships"; the intro states crisply that these relationships are *derived from single-char tags on the child's own events, never from explicit relationship events* (the derived-vs-explicit principle).
- [ ] **AC3 — substance unchanged.** Beyond the title, the intro guard sentence, and self-referential naming, the body is byte-identical: the `n`/`s` tables, value format, multi-parent semantics, retrieval, security rules, and direction-principle sections are untouched.
- [ ] **AC4 — living links fixed, history untouched.** Every reference to the old filename in **living documents** — `protocols/README.md`, `protocols/drafts/inherit-from.md`, `protocols/drafts/shared-concepts.md`, `protocols/worksheet.md`, `BIBLE.md`, `docs/NIP_REORG_DESIGN_HANDOFF.md`, `engineering-team/epics/nip-reorg.md`, `engineering-team/audits/nip-reorg/book.md` — is updated and resolves on disk; zero references to `class-thread-tags.md` remain in those files. **Historical records** (ADRs, reviews, done stories, closed audits/handoffs) are not modified.
- [ ] **AC5 — index row.** The `protocols/README.md` row shows the new display name ("Class Thread Relationships (`n`, `s`)") and new path.
- [ ] **AC6 — gates.** `npm test` stack-free portion green (the 11 stale-local-stack suite failures remain the known pre-existing caveat); harness-lint clean; the diff contains nothing beyond the rename and the AC4 link fixes.

## Concepts touched

None mutated (docs-mode). The spec's subject matter (`n`/`s` tags, `HAS_ELEMENT`, `IS_A_SUPERSET_OF`) is unchanged by definition of AC3.

## Out of scope

- No redirect stub at the old path (pre-publication drafts; git history is the record).
- Semantic re-pointers (W1/W11 worksheet aims, `tags.md`/`communities.md` referencing Stamping, BIBLE §22 audit) — S4. This story fixes only *mechanical* filename references so nothing dangles between S2 and S4.
- Any change to `n`/`s` semantics, letters, or the uppercase-reservation policy.

## Open questions

- None blocking. The living-vs-historical boundary in AC4 was ratified at the planning gate (2026-07-12): historical records cite the path as it existed when written — supersede in living docs, don't rewrite history.

## Linked artifacts

- ADR: [`engineering-team/decisions/nip-reorg/0002-class-thread-relationships-rename.md`](../../decisions/nip-reorg/0002-class-thread-relationships-rename.md) (AC4 refined: zero link-targets; the 3 rename-subject prose mentions stay)
- Test plan: skipped — docs-mode
- Review: (filled in after Review phase)
