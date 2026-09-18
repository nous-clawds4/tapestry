# Story 1: The curation copy convention — how an assistant copies, points back, and removes

**Status:** Done
**Created:** 2026-09-11
**Type:** Doc *(wire-format irreversibility trigger → full ADR + Standard docs-mode phases; Test
Design skipped per workflows/protocol-spec-workflow.md)*

## Background
The DList curation spec (`protocols/drafts/assistant-designation.md` § "Per-DList curation entries",
ratified in the `dlist-curation` book) says the assistant's curated header carries
`["b", <community header>, "inherit-items"]` — live, additive item inheritance: the curated list's
items are the community list's items plus the assistant's own, re-resolved on every read, with no way
to remove an inherited item (worksheet W6). The operator's model is different (OPEN.md row 259): the
assistant **copies** the community items its curation method accepts, and some candidates are never
copied — for example, an item with more downvotes than upvotes. Under the ratified facet, any reader
that implements its resolver sees every community item in the curated list, including the ones the
method rejected, so the method would have nothing to decide. The DList Curation panel's shipped
description ("inheriting the community's items, never duplicating them") says the same thing.

The `my-curated-dlists` book shipped the page this serves, with Update list as a placeholder; its
items table already decides "already copied" by a back-reference in any tag, and its story-3 review
noted that a copy carrying the shared list's `z` would be listed twice. The operator settled the copy
convention in `/discuss` on 2026-09-11, together with row 267 (one Treasure Map, one assistant per
list across instances); the settled points are in the epic (§ "Settled at kickoff"). This story
ratifies them in the protocol, so that stories 2–5 build against a written contract.

## User-facing description
As a user whose Tapestry Assistant curates a community DList for me, I want the protocol to say how my
assistant copies an item into my list, how the copy points back at its original, and how a copy is
removed — and that my list is exactly the items filed under it — so that my curation method's choices
are what readers see, any reader can tell a copy from its original, and my list survives changes to
the originals.

## Acceptance criteria
- [ ] **AC-1 (the header's link).** `assistant-designation.md` § "Per-DList curation entries": the
      header contract says the assistant's header carries `["b", "<shared header a-tag>", "pointer"]`
      — a declared affiliation (Shared Concepts) — and that the curated list's items are exactly the
      items filed under the header by `z`; nothing is inherited live. A header still carrying the
      older `inherit-items` link is upgraded in place by its assistant (same target, new type), shown
      to the user before signing — the rule against re-pointing silently is kept. The worked example
      matches.
- [ ] **AC-2 (what a copy is).** A "Curation copies" part of the same spec defines a copy: a
      kind-39999 event authored by the curating assistant, whatever the original's kind; exactly one
      `z` — the curated header; a `d` derived from (curated list, original), so copying the same
      original into the same list again replaces the copy instead of adding a second; published where
      the header is published. It carries what the original's author wrote — `name`, `title`, `slug`,
      `description`, `comments`, and the original's item tag(s) (`p`, `e`, `t`, `a`) — and none of
      `json`, `n`, `s`, `b`, nor the original's own `d`, `z` or `q`.
- [ ] **AC-3 (pointing back).** A copy names its original with NIP-18 `q` tags: the original's address
      (`39999:<author>:<d>`, with a relay hint) when the original is a kind-39999 event, and the exact
      version copied (event id, relay hint, author) always. The spec defines "already copied" by these
      `q` tags alone, and says that a reader merging items across related lists treats a copy and its
      original as one item.
- [ ] **AC-4 (removal, and when the original changes).** Removing a copy is a NIP-09 deletion request
      by the assistant naming the copy by address and by event id, with its kind (`a`, `e`, `k`); the
      original becomes a candidate again, and no rejection is recorded anywhere. The spec states what
      happens when the original is edited (the copy is unchanged; it may be refreshed at the same
      address), is downvoted or disputed (the curation method decides again), or cannot be found (the
      copy stays). Which originals are copied is the curation method's decision; the spec does not
      define the method.
- [ ] **AC-5 (never stamped into the source list).** `stamping.md` states that a copy carries only its
      curated list's `z`: it is never stamped with the handles of the list its original came from.
- [ ] **AC-6 (one curating assistant per list).** `assistant-designation.md` states that, because the
      Treasure Map is one replaceable event read by every instance, a list has at most one curating
      assistant across all instances (the existing one-entry-per-list rule, unchanged); an instance
      whose own assistant is not the one named MAY show that curation read-only and MAY offer to
      replace the entry.
- [ ] **AC-7 (the `inherit-items` facet and the record).** `inherit-items` stays in the `b` type
      registry, unchanged. `inherit-from.md` says the reference deployment no longer emits it (curated
      headers link with `pointer` and hold copies), and its editorial-relationship family table gains
      a row for the curated copy. The earlier decisions this changes say so — `dlist-curation` ADR 0002
      §3 (the header's link type) and ADR 0003's consequence "Enables story 4" — and the pointers
      follow: BIBLE's glossary `b tag` row (`:1546`) and §25 pointer (`:1630`); a D11 in
      `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md` (status unchanged); worksheet W6 (its first consumer
      withdrew; removal and replacement stay open for the facet); the `protocols/README.md` rows whose
      scope phrases change; and the 2026-09-10 intake entry for the `inherit-items` resolver, marked
      with a closing line.
- [ ] **AC-8 (the ledger).** OPEN.md rows 259 and 267 flip to DONE, pointing at this story's ADR.
- [ ] **AC-9 (ADR).** A full ADR, Accepted, at `engineering-team/decisions/done/curated-dlist-update/`,
      recording at least: the header's link type (`pointer` vs keeping `inherit-items` vs a new type);
      the back-reference (`q` vs `e`/`a` vs an item-level `b` vs a named tag); removal (deletion vs
      republishing without the `z`); what a copy carries and drops; one assistant per list vs one entry
      per (list, assistant); keeping vs withdrawing the facet; and how the `d` is derived.

## Concepts touched
None — protocol prose, an ADR, and pointers. No concept-graph change, no firmware reinstall.
Orientation only: `39998:<TA>:list`, `39998:<TA>:shared-concept`, `39998:<TA>:tapestry-assistant`.

## Out of scope
- All code: the header endpoint's link type and its handling of the older form, the page's type
  check, the "copy" wording, and "already copied" by `q` (story 2); the read-only view (story 3); the
  curation method panel (story 4); Update and its preview (story 5).
- The curation method itself — which items qualify is instance behavior (stories 4–5), not protocol.
- The Trust Determination Methods concept the header will later point at (a future session).
- A schedule for Update.
- Removal and replacement algebra for `inherit-items` (W6 stays open for that facet); the item-set
  resolver and the `INHERITS_ITEMS_FROM` derivation (parked with the intake entry).
- Checking that relays accept and honor kind-5 deletions — story 5, before it relies on them.
- Proposing the convention upstream (NIP-18, NIP-09, the Decentralized Lists NIP).

## Open questions
None the PO holds — the settled points are in the epic. Decision points reserved for the ADR: how the
copy's `d` is derived (AC-2); where the "Curation copies" part lives if not inside § "Per-DList
curation entries" (AC-2); how the superseded parts of `dlist-curation` ADRs 0002 and 0003 are recorded
(AC-7); and whether the family-table row extends `IMPORT`'s or stands on its own (AC-7).

## Deviations
- **One clause beyond the ADR's edit list, found by the consistency sweep.** `inherit-from.md`
  § "Scope (v1)" named `dlist-curation` ADR 0003 "the first consumer" of the additive algebra, as if
  that consumer still existed; it now says the curated header has since moved to copying
  (`curated-dlist-update` ADR 0001). Every other `inherit-items` mention in the protocol drafts, BIBLE,
  worksheet and handoff was checked and is either updated, generic registry text, or dated history.
- **Shape.** § "Curation copies" opens with a two-sentence lead — what curating by copying means, and
  that the method is outside the spec (Decision §6's last sentence, moved there) — before Decision
  §§2–7; §6 is rendered as two paragraphs ("Removal", "When the original changes"). Handoff D11 opens
  with one context sentence before its four bullets and the rejected options.
- **Regression scope.** Docs-mode; no code or test change. The 13 suites that read the changed
  documents pass through their `run()` exports (243 tests, 0 failures); harness-lint clean after the
  commit. The full `npm test` was not run (rows 191 and 261). Harness friction: six of the 13 suites —
  and 91 of the repo's 198 — have no `require.main` block, so `node test/<suite>.test.js` exits 0
  without running anything; OPEN.md row 310 (filed as 271, renumbered at the origin/staging merge).
- **Round 2 (review round 1, Blocking 1; ADR 0001 Amendment 1).** The emitter's timing: every
  sentence that said the reference deployment "no longer emits" `inherit-items`, or that curated lists
  hold copies as a current fact, now says the header endpoint stops emitting it with story 2 —
  `inherit-from.md:4`, BIBLE `:8`, `:1079`, `:1546` and `:1630`, the intake closing line, the ADR 0003
  annotation and handoff D11 (the review's list), plus OPEN.md row 259's note and the epic's settled
  bullet (the same claim, beyond the list). AC-7's "no longer emits" is met by the timed wording
  (Amendment 1). Also the operator's four optional fixes: the "edited" case scoped to kind-39999
  originals, "the way an empowered assistant does" in `inherit-from.md:32`, BIBLE `:1079`'s endpoint
  note, and the `copy-` reservation.

## Linked artifacts
- ADR: `engineering-team/decisions/done/curated-dlist-update/0001-curation-copy-convention.md`
- Test plan: — (docs-mode; Test Design skipped per the protocol-spec variant)
- Review: `engineering-team/reviews/done/curated-dlist-update/1-curation-copy-convention.md`

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
