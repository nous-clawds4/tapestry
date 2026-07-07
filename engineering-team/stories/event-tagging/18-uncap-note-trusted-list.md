# Story 18: A published note Trusted List must be complete — uncap the durable list (not the UI reads)

**Status:** Approved
**Created:** 2026-07-07
**Type:** Feature (correctness / hardening)
**Provenance:** Operator, 2026-07-07 — "we can't have TLs that integrators will be relying on
artificially capped and silently failing to surface everything."

## Background
The TA-signed **note Trusted List** (kind-30393 `tl-pin-notes-…`, from `runOneNotePin`, event-tagging
#17 / issue #336) is a **durable, integrator-facing** artifact — external clients read it as "the
trusted notes for this tag." Its membership is computed by the shared note aggregation, which applies
a **fixed cap of 50** (`NOTES_CAP`, introduced for the *UI* read path in Story 8/15 to bound the
kind-1 note-body fetch and render). As a result the **published note TL silently drops every
trusted-tagged note past the 50 most-recent** — with no signal a consumer can detect. An integrator
building on it sees a list that looks complete but isn't.

The cap is defensible where it originated — a UI rendering a page of note *bodies* must bound the
fetch. But it has leaked onto the **write path that produces a durable list others consume**, and a
published list an integrator relies on must be **complete, or explicitly marked partial — never
silently truncated**. The list's membership is just note ids + counts; it does not require the
note-body resolution the cap was built to protect.

The deeper enabler: the taggings scan under the membership computation has **no explicit bound** — it
relies on a fixed process-buffer ceiling (~tens of thousands of events) that overflows **silently**.
Uncapping the list must not simply move the silent failure down to the scan.

Scope note: this story is about **durable-list correctness**, not UI rendering scale. UI pagination
("load more") and the per-note read fan-out are already tracked separately (`_intake.md`, 2026-06-30)
and stay deferred.

## User-facing description
As an integrator (or another instance) reading a tag's note Trusted List, I want it to contain **every**
trusted-tagged note for that tag — or to tell me clearly when it's partial — so I can build on it
without silently missing content.

## Acceptance criteria
Testable from the outside.

- [ ] **The published note TL is complete.** Given a tag with more than 50 trusted-tagged notes (under
  the pin's POV), when its note TL is (re)published, then the TL's members include **all** of them, not
  a fixed 50 — an integrator reading the TL sees the full trusted-tagged set.

- [ ] **Completeness is honest at scale (never a silent small cap).** Given a tag with an extreme number
  of trusted-tagged notes (beyond any single practical bound the implementation must impose), then the
  TL either contains all of them **or is explicitly marked partial** in a way a consumer can read — it
  **never** silently truncates to a small fixed number.

- [ ] **The membership scan is bounded safely, not silently.** Given the taggings scan that feeds the
  membership, then it must not **silently** lose data to a process/buffer ceiling — if a bound is
  necessary, it is explicit and observable (logged / signaled), not a silent overflow.

- [ ] **The durable-list contract holds everywhere.** Given any other TA-signed / durable Trusted List
  the instance publishes (pubkey pinned-tag TL, applicability lists), then it remains complete or
  explicitly-signaled — this story neither introduces nor leaves a silent small cap on any published
  list.

- [ ] **UI reads keep their contract.** The existing UI-facing reads (`for-tag`, notes-by-author) keep
  working and keep signalling boundedness where they already do (their `truncated`/`total` fields) —
  this story does not silently change their behavior. Full UI pagination remains the deferred scaling
  item, not this story.

## Concepts touched
- `39998:<TA>:nostr-event-tag` — the note taggings whose targets populate the list.
- `39998:<TA>:tag`, `39998:<TA>:tag-pinning` — the tag + the pin that drives the note TL.

## Out of scope
- **UI pagination / "load more"** for `for-tag`, and the **per-note read fan-out** (batch endpoint) —
  tracked in `_intake.md` (2026-06-30); this story is durable-list correctness, not UI render scale.
- Changing how membership is *computed* (HINT ∪ USAGE, POV trust) or *curated* (`noteMethod`) — only
  *how much* of the result the durable list carries.
- The kind-30003 client export; the applicability lists' derivation; search/ranking.

## Open questions (Architecture)
- **Is a practical upper bound on TL size needed** (a single replaceable event can't hold unbounded
  members), and if so, what's the principled ceiling + the explicit partial-signal shape? (AC-2.)
- **Separate "membership (ids + counts)" from "note-body resolution"** so the durable list carries the
  full membership while the UI read keeps its bounded body-fetch — the note TL needs only ids/counts.
- **How to bound the underlying scan** observably (limit + iterate / streaming / cursor) so completeness
  is real, not moved to a silent scan ceiling.

## Linked artifacts
- ADR: `engineering-team/decisions/event-tagging/0017-uncap-note-trusted-list.md`
- Test plan: (after Test Design)
- Review: (after Review)
