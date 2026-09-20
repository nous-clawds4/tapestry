# PRD Seed: Reading the Shared-Concepts wire surfaces

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/shared-concepts-row-detail/audit.md`
**Anchor:** acceptance frame in `book.md` (written at intake, confirmed in-session, amended twice by the owner at gates)
**Confidence:** **medium** — §3 and §5 are well grounded, because the frame was eager and every amendment was recorded as it happened. §1 and §2 are genuinely inferred: this book was a one-story UI ask with no discovery phase behind it, so the *problem* it addresses was never stated in product terms, only the *change*. Treat §1–§2 as a hypothesis to test, not a finding.
**Date:** 2026-09-20

> A reverse-engineered baseline in the PRD shape, built from what shipped. A strawman for the product team, not a ratified spec. Sections are tagged `[FROM FRAME]`, `[INFERRED]`, or `[UNKNOWN — product input needed]`.

## 1. Product vision

`[INFERRED]` The Shared Concepts area lets an instance operator see what their instance points at and what it borrows from others. Its surfaces are built on wire coordinates — `kind:pubkey:slug` — because that is what the protocol actually exchanges. This book asserts a principle the product had not stated: **a wire identifier must be available, but it should not be the thing a person reads.** The operator recognises rows by name and description; the coordinate is what they reach for when they need to take something elsewhere.

`[UNKNOWN — product input needed]` Why the operator visits these pages at all was never written down. The change was requested as a layout improvement, not as a response to a stated task failing. Without that, "is this page good now?" has no test. Candidate jobs, none validated: auditing what the instance has wired up; finding a coordinate to paste into a tool or a message; checking whether a concept this instance uses is one somebody else authored.

## 2. Personas

`[INFERRED]` One, and the story says so directly — *"anyone auditing what this instance has wired up or is using — today, the operator."* Behaviourally: reads these pages occasionally rather than daily; recognises concepts by name; needs the raw coordinate rarely but exactly when they need it, and in full.

`[UNKNOWN — product input needed]` Whether any non-operator ever reaches these pages. Both are reachable unauthenticated in production. If a visitor or a prospective federating instance is a real audience, the vocabulary ("b-tag", "z-tag", "DList Header") is unexamined for them.

## 3. Scope (as-built)

`[FROM FRAME]` Shipped and in production:

- Active b-tags: a per-row panel, closed by default, holding the **local** DList Header's description and the b-tag, copyable in one action. The b-tag column is gone; the value is still matched by the filter box. The row click keeps its existing destination, the b-tag pair page.
- Active z-tags: the same panel. Because a z-tag row *is* a foreign-authored header, its description is that header's own — there is no local event behind the row.
- Descriptions are matched by the filter box on both pages, so a row can be found by text that is only visible inside a closed panel.

`[INFERRED]` Also shipped, wider than the two pages:

- `.text-muted` is defined app-wide. 132 strings across 43 files now render muted as their authors intended. This was a correctness fix, not a design decision — but it is the book's largest production footprint and it touched surfaces no story reviewed.
- `DataTable` gained two reusable, strictly opt-in capabilities (`filterKeys`, `renderExpanded`). No other caller adopted them.

Explicitly out, per the story: the b-tag pair page; either page's scan, ordering, counts or point-of-view handling; any new fetch or endpoint; adoption by other tables.

## 4. Domain model

`[INFERRED]` No entity was added or changed. Two existing concepts are *read*:

- `39998:<TA>:concept-header` — the kind-39998 DList Header behind every row on both pages. Attributes surfaced here: `names` (singular), `description`, `d`. On Active z-tags this entity *is* the row.
- `39998:<TA>:shared-concept` — what a b-tag points at and a z-tag files under; the subject matter of both pages.

Two relationships the pages render, and the vocabulary the product uses for them:

- **b-tag** — a locally-authored header claims correspondence with a shared event elsewhere. Row identity is `<event id>:<b value>`.
- **z-tag** — a local event files itself under a concept header, possibly one this instance did not author. Row identity is the target coordinate.

`<TA>` is per-deployment and resolved at runtime; three distinct values were exercised in this book's verification.

## 5. Design rules (as-built)

`[INFERRED]` Rules this book established by doing, none previously written down:

1. **A wire coordinate is detail, not identity.** It lives behind a disclosure, never in a column.
2. **Removing a value from view must not remove it from search.** The filter matches what the panel holds, not only what the table shows — a row can match on text the reader cannot currently see.
3. **A disclosure control is additive.** It never takes over a row click that already has a destination.
4. **Absence is stated, not blank.** A header with no description says "No description." rather than rendering an empty region.
5. **A copyable value is copied whole.** Never a truncated or reflowed form of what is displayed.

`[UNKNOWN — product input needed]` Rule 2 is the interesting one and was never examined as a product question: a row matching on invisible text is *findable* but can look like a bug ("why did this match?"). No affordance explains it. Whether that needs one is a design call nobody has made.

## 6. Carry-forward & open questions

Promoted from audit §6:

- Decide whether the **eight muted failure-message strings** should be muted at all — `HeaderEvent.jsx:49` now dims a real caught error. Nobody has seen these muted before, because the class did nothing until this book. Ledger `2026-09-20-muted-class-dims-failure-messages`.
- Extract the **event-tag readers** (`singularName` / `bestName` / `descriptionOf`) — four files, three variants.
- Consider **offering `renderExpanded` / `filterKeys` to the other 23 `DataTable` callers**.
- **`aria-controls`** on the disclosure button.
- **The shared-name column has never been filterable** on either page — it is a virtual column with no row field, so `DataTable`'s column-derived filter has always missed it. Pre-existing; noticed while auditing the filter.

## 7. What product must validate

- [ ] **§1 — what job these pages serve.** The book's whole justification was "the coordinate is unreadable," which is a UI observation, not a user need. Without a stated job, there is no way to say whether the pages are now good or merely tidier.
- [ ] **§2 — whether anyone but the operator reads these pages.** Both are publicly reachable. If yes, the vocabulary needs examination.
- [ ] **§5 rule 2 — invisible-match filtering.** Should a row that matched on hidden text say so, or auto-open its panel? Shipped with no affordance either way.
- [ ] **The `.text-muted` blast radius.** 43 files changed appearance in production under an engineering correctness fix. Product should confirm the app-wide result reads as intended — this is the one place where a book's footprint clearly exceeded its subject.
- [ ] **Whether "b-tag" and "z-tag" are the right words on screen.** They are wire-format terms used as user-facing column and panel labels. Never examined; inherited from the protocol.
