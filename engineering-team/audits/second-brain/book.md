# Book of Work: Second Brain (MVP — Capture, Decompose, Propose)

**Slug:** second-brain
**Status:** Closed
**Opened:** 2026-07-22
**Closed:** 2026-07-25

## Intent anchor

**PRD-backed** — `product-team/prd/second-brain.md` §8.1 (In Scope / MVP), decomposed as the 8-story block "Second Brain MVP: Capture, Decompose, Propose" in `product-team/stories-queue.md` (2026-07-21). Completion is *computed*: every story tracing to §8.1 is `Done` and the `second-brain` epic is closed.

The feature: the owner's concept graph as the durable substrate for goals, knowledge pointers, and judgment — goal capture in conversation, decomposition into session-sized viable pieces, resource pointers, bounded session orientation with append-only work records, a propose-only "what next?" loop with approve/skip-with-reason, recorded pairwise priority signals, export + one restore drill, hygiene validation, and the three owner-gated views (Goals, Goal detail, Proposal queue) inside the existing control panel. The PRD's §7 Policy Constitution binds every story; §8.2 is deliberately empty (no stretch list) — anything beyond §8.1 waits for its named phase (§8.3/§9).

Companion guides, binding at engineering review: `product-team/guides/second-brain-design-guide.md`, `second-brain-style-guide.md` (+ `second-brain-wireframes.html`). Owner-facing copy comes verbatim from the style guide.

**Referenced, never re-specified (PRD §7.9):** the `relationship-primitives` book (closed 2026-07-22; its `audit.md` + `prd-seed.md` are this book's inbound return edge — the add/delete primitives are live, `HAS_SUBGOAL` arrives only via that book's documented whitelist-extension path) and the future firmware clobber-protection work (story 8's export is the interim protection). Stories declare these dependencies and wait.

## Epics in this book

- `second-brain` — all 8 MVP stories: capture/view, hygiene, decomposition, pointers + goal detail, session read loop, proposal loop, priority signals, export/restore.

## Provenance

- **Mode:** PRD-backed
- **Confidence at close:** **high** — the anchor was eager (opened 2026-07-22 with the PRD §8.1 decomposition); completion computed: all 8 queue stories Done with PASS reviews (story 8's an independent row-80(b) audit), the epic closed, the §10 drill row journaled `matched` and verified live.

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/second-brain/audit.md` *(written 2026-07-25)*
- Product feedback: `engineering-team/audits/second-brain/prd-addendum.md` *(written 2026-07-25 — carries the guide back-fill bundle: ADR 0006 d16 + 0007 d5 + 0008 d12 strings, the export-affordance placement, and two pattern rulings)*
