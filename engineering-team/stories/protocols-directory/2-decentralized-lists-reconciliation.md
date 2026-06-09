# Story 2: Decentralized Lists reconciliation

**Status:** Done
**Created:** 2026-06-10
**Type:** Doc
**Epic:** protocols-directory — realizes `docs/PROTOCOLS_DIRECTORY_DESIGN_HANDOFF.md` (§5 findings, §8 story 2)

## Background

The Decentralized Lists Custom NIP — authored by the project owner — exists in two diverged copies: the version published on NostrHub (kind 30817, 2026-02-26) and a strictly newer local draft sitting at the root of the unmerged `feat/communities` branch (last edited 2026-05-10). The local draft adds the three-element description convention and a cross-reference to a companion NIP, but also carries an **unfinished** "Backwards Compatibility with Preexisting NIPs" section containing "to be completed" placeholders — material that was since spun off into the companion NIP (`DECENTRALIZED_LISTS_COMPAT.md`, complete on the same branch) and never cleaned out of the base draft.

Today, neither copy is the working copy: the repo's `protocols/` index (story 1) points at the branch as the interim source of truth, and the published version is behind. The owner wants to republish but can't until the reconciliation happens. This story produces the single authoritative working copy of both documents in `protocols/`, leaving the base NIP ready for the owner to republish.

## User-facing description

As the NIP's author, I want one reconciled, publication-ready working copy of the Decentralized Lists base NIP in the repo — with the half-finished compat material removed in favor of the completed companion NIP — so that I can republish to NostrHub with confidence that the text is current, complete, and consistent, and so future edits happen in exactly one place.

## Acceptance criteria

- [ ] Given a fresh clone of `staging`, when a reader opens `protocols/nips/decentralized-lists.md`, then it contains the newer local draft's content (`feat/communities:DECENTRALIZED_LISTS.md`) **minus** the entire "Backwards Compatibility with Preexisting NIPs" section, and **retaining** the three-element description convention and the cross-reference to the companion NIP.
- [ ] Given the reconciled base NIP, when searched for "to be completed" (or similar placeholder text), then no unfinished placeholders remain anywhere in the document.
- [ ] Given the base NIP's header block, when a reader consults it, then it records: status 🚀 published (update pending), the canonical NostrHub naddr, last-published date 2026-02-26, sources, and a short statement of exactly how the working copy diverges from the published version (the delta the owner will be republishing).
- [ ] Given `protocols/drafts/decentralized-lists-compat.md`, when compared with `feat/communities:DECENTRALIZED_LISTS_COMPAT.md`, then the content is faithful to the branch original, with a header block recording status 🧪 pre-NIP (publish-ready) and its sources.
- [ ] Given either new file, when any internal cross-reference is followed (base ↔ companion, links to other NIPs), then it resolves — no link still points at branch-root paths that don't exist on `staging`.
- [ ] Given `protocols/README.md`, when a reader consults the spec index, then the two Decentralized Lists rows link to the new in-repo files as the working copies, no longer name the `feat/communities` branch as the current location, and the base NIP's row still signals that the published NostrHub version is behind until the owner republishes.
- [ ] Given the full change, when `npm test` runs, then it passes unchanged; and `BIBLE.md` is byte-identical to before.
- [ ] Given the two source files on `feat/communities`, when this story completes, then that branch is untouched (content is copied via `git show`, never merged; branch-side cleanup stays deferred per handoff §8 logistics).

**Fidelity rule for the copy:** mechanical defects in the source (e.g. Example 7's malformed JSON quoting `["names", "dog, "dogs"]`) may be corrected where the intent is unambiguous; every such correction must be individually flagged for the Reviewer. No semantic rewording, restructuring, or "improvement" of the spec's prose — the author's voice is the spec.

## Concepts touched

None in the concept-graph sense (docs-only; no events published, no firmware). The documents *describe* kinds 9998/9999/39998/39999 and the `z`-tag pattern, which BIBLE §5 implements — no implementation text changes here.

## Out of scope

- The actual republication to NostrHub (the owner's act, requiring the author's keys; the relay requires AUTH). The follow-up status flip to 🚀 published + new last-published date is a one-line edit for whichever session follows the republication.
- Deleting `DECENTRALIZED_LISTS*.md` from the `feat/communities` branch root (deferred to that branch's next touch, per handoff).
- Any edit to BIBLE.md, the worksheet, or the other five specs in the index.
- Publishing the companion to NostrHub (separate decision; it stays 🧪 publish-ready).

## Open questions

- **Architecture phase?** Recommendation: skip, as in story 1 — handoff §5 *is* the edit plan; type Doc → Implementer + Reviewer. Confirm at the gate.
- Whether the companion should keep its original standalone title ("Decentralized Lists: Cross-NIP Compatibility") verbatim — assumed yes (author's voice); flag at review if the Implementer sees a reason otherwise.

## Linked artifacts

- Design record: `docs/PROTOCOLS_DIRECTORY_DESIGN_HANDOFF.md` §5 (reconciliation findings + plan)
- ADR: (recommended skipped — see open questions)
- Test plan: skipped (docs-mode)
- Review: `engineering-team/reviews/protocols-directory/2-decentralized-lists-reconciliation.md` — PASS
