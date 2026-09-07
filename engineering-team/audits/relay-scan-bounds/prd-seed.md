# PRD Seed: Relay-backed list surfaces at scale

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/relay-scan-bounds/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** medium — the *engineering* facts are high-confidence (measured on four deployments), but the **product** framing below is largely inferred. This book was a bug fix; nobody has ever written down what the Simple Lists pages are *for*, and §1–§2 are the reconstruction most likely to be wrong.
**Date:** 2026-09-07

> A reverse-engineered baseline in PRD shape, built from what shipped. A strawman for the product team, not a ratified spec. Sections are tagged `[FROM FRAME]`, `[INFERRED]`, or `[UNKNOWN — product input needed]`.

## 1. Product vision

`[INFERRED]` The Simple Lists pages are an **operator inspection surface** over the relay's list primitives — kind 9998/39998 headers and their kind 9999/39999 items. They answer "what lists exist here, who authored them, how big are they, and are they in Neo4j?" A "Neo4j" column exists specifically to show where relay state and graph state *diverge*, which is the strongest signal that these pages are diagnostic rather than end-user surfaces.

`[UNKNOWN — product input needed]` Whether that is the intended role. No PRD, no discovery, no persona work has ever covered these pages; they date to the original UI commit and no epic claimed them until this book. The question the next phase should settle: **are these operator diagnostics, or the beginnings of a user-facing list browser?** Almost every carry-forward below resolves differently depending on the answer.

## 2. Personas

`[INFERRED]` One, from the story's "As a…" line: **the operator inspecting the Tapestry control panel** — someone who reads these pages to understand relay state, not to accomplish a task in the product. Evidence: the pages live under `/tapestry/`, expose raw event kinds and pubkeys, and offer no create/curate affordances beyond a "+ New DList" button.

`[UNKNOWN]` Whether any non-operator ever reaches these pages, and whether the ~450,000-item deployments (staging, tags) represent real usage or accumulated test/sync debris. §3's numbers suggest the latter: **356,357 of 451,914 items on tags belong to no list at all.**

## 3. Scope (as-built)

`[FROM FRAME]` The pages load and show their content on every deployment, at any relay size.

`[FROM FRAME]` Where a page cannot show everything, it says so on screen — a bounded set with its total stated, never a silently truncated one. As built this holds even when the total is *unknowable*: the response reports `total: null, truncated: true` rather than claiming completeness.

`[FROM FRAME]` The shared relay-scan path cannot be tripped into a buffer failure by an unbounded request.

`[INFERRED]` **Two counting rules, deliberately not additive** — the substantive product decision this book made, ratified by the operator mid-flight:
- *Per-list count* is set membership: an item in two lists counts in **both**.
- *Page total* is the union: that item counts **once**.
- So two lists of 10 sharing 5 items read 10, 10, and a total of 15.

`[INFERRED]` Out of scope as shipped: pagination past the 500 most recent items; any cleanup of the accumulated items; surfacing "unattached" items; changing what other relay-backed pages show.

## 4. Domain model

`[INFERRED]` from the concepts read (none were changed):

- **List** (`39998:<TA>:list` — "A list header with associated list items"). Has a name (singular and plural), an author, an age, and a member count. Exists in two forms on the wire: addressable (kind 39998, referenced by coordinate) and plain (kind 9998, referenced by event id). Both are live — staging carries 318 and 4 respectively.
- **List item** (kinds 9999/39999). Names the list(s) it belongs to via `z` tags (coordinate) or `e` tags (event id). **An item may belong to many lists**, and 4.5% of them do — the fact that drove this book's counting change.
- **Concept header** (`39998:<TA>:concept-header`). Kind-39998 events carry both `ListHeader` and `ConceptHeader` labels, so every concept header is also a list header and appears on these pages.
- **Unattached item** `[INFERRED — no product name exists]`: an item whose `z`/`e` tags name no header present on this relay, or which carries neither tag. Currently counted nowhere and shown nowhere. **356,357 on tags, 374,092 on staging, 133 on prod.**

## 5. Design rules (as-built)

`[INFERRED]` — no design guide has ever covered these pages.

- A truncated view always states its bound and its total in the same breath: "showing the 500 most recent of 473,229 on the relay".
- A number the page cannot determine is reported as unknown, never guessed or defaulted to zero.
- Counts are exact, never capped or approximated, however large the underlying set.
- Tables paginate at 50 rows.

`[UNKNOWN]` Whether "showing the N most recent of M" is the right phrasing for a non-operator reader, and whether 500 is the right bound. Both were engineering choices with no design input.

## 6. Carry-forward & open questions

Promoted from build audit §6:

- **Cold-load latency at scale.** The counts pass takes ~39 s on the 450k-item deployments (0.6 s on production). The page works but shows a spinner for that whole time. Is that acceptable for an operator diagnostic? It would not be for a user-facing page.
- **Pagination past 500 items** — currently unreachable.
- **The ~356,000 unattached items.** They are now correctly excluded from the total, which means they are invisible. Previously the subtitle counted them by accident. Is "this relay holds 356,357 list items attached to nothing" a fact an operator wants surfaced, or noise?
- **Truncation is signalled but only one page shows it.** Every other relay-backed page inherits the bound and will silently present a capped set. Which of them need the same treatment?
- **The scan API's error contract** — a failed scan currently looks like a successful one at the transport layer.
- **`useProfiles` fails on author-heavy pages** (400/414), so names degrade to truncated pubkeys. Already spun off; product should know the visible symptom.

## 7. What product must validate

- [ ] **Are the Simple Lists pages operator diagnostics or a user-facing surface?** Everything else in this seed depends on it. (§1)
- [ ] **Is the new counting model right?** Per-list membership plus a union total is defensible and was operator-ratified mid-build, but it was decided in an engineering gate under time pressure, not in discovery. Specifically: should an item in two lists really count in both? (§3)
- [ ] **Do unattached items deserve a name and a surface?** They are the majority of what these relays hold. (§4, §6)
- [ ] **Is a ~39-second cold load acceptable on the large deployments?** (§6)
- [ ] **Is 500 the right bound, and is "showing the N most recent of M" the right phrasing?** Both were engineering choices. (§5)
- [ ] **What is the intended lifecycle of the 450k accumulated items on staging and tags?** If they are debris, the scaling problem this book solved may partly be a data-hygiene problem wearing an engineering costume. (§2)
