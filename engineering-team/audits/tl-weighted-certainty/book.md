# Book of Work: Weighted Member Certainty for Trusted Lists

**Slug:** tl-weighted-certainty
**Status:** Open
**Opened:** 2026-08-27 — eagerly, at intake, before any story exists.

## Intent anchor

**Acceptance frame (no PRD).** The ask arrived as a cross-session handoff from the
brainstorm_server engineering harness (ADR `engineering-team/decisions/trusted-lists/0001`,
Amendment D12, 2026-08-27), redirected by the operator to be implemented **in tapestry first**.
The self-contained spec is `/home/vcavallo/tl-weighted-certainty-spec-for-tapestry.md`; the
operator confirmed the working branch (`feat/tl-weighted-certainty`, cut from `origin/staging`
at `106c5de0` because `main` does not yet contain the Trusted-List stack).

The book is complete when:

- [ ] Trusted-List membership is decided by GrapeRank single-hop **weighting** of live taggings
      (weight = asserter's influence in the active POV), not by counting asserters — such that
      a few highly-trusted taggers outweigh many barely-trusted ones.
- [ ] Each published TL member carries an **integer 0–100 certainty score** on the wire, in the
      already-reserved position, reproducible by a consumer from the published parameters
      (including the new `rigor` metadata tag) with no shape change to the TL event.
- [ ] The existing WoT floor (`minRank`, inclusive at 3) still gates who may assert at all —
      weighting supplements the gate, it does not replace it — and the existing raw counts,
      cutoff semantics, polarity thresholds, replaceable-dedupe, retraction, d-tag, and signing
      behavior are unchanged.
- [x] Wire details are confirmed final with the operator before anything is published beyond the
      local dev relay (the source decision record was **Proposed** at handoff time; operator
      confirmed it **Approved** on 2026-08-27, at the Planning gate).

## Epics in this book

- `trusted-lists` (`epics/trusted-lists.md`) — new epic opened for this book; story path
  `stories/trusted-lists/<n>-<slug>.md`.
