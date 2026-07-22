# Book of Work: About Brainstorm Search

**Slug:** about-brainstorm-search
**Status:** Closed
**Opened:** 2026-07-21 *(reconstructed — see Provenance)*
**Closed:** 2026-07-22

## Provenance — read this first

**This manifest was written at close, not at intake.** No `book.md` was opened when the work started, which is a departure from the eager-anchor rule in [`CLAUDE.md`](../../../CLAUDE.md) → "Books of work and the return edge". The miss is recorded as a process finding in [`audit.md`](./audit.md) §7.

**Confidence: medium** — not the "low" the workflow assigns a cold reconstruction, and the reason is specific: the operator supplied a **verbatim written specification** in-session, and both stories encoded it into acceptance criteria **before** implementation, with the operator approving each. So intent is well-evidenced and pre-dates the build. What is genuinely reconstructed is only the *framing* — the frame below was assembled at close from that spec, not ratified as a frame at kickoff. There is no `_intake.md` entry for this work.

## Intent anchor

**Acceptance frame (no PRD)** — reconstructed at close from the operator's verbatim in-session specification (2026-07-21). Quoted source:

> The main page at `https://staging.brainstorm.world/` currently has a link at the bottom: `How search works`. I would like to replace this link with the link to the page: `About Brainstorm Search`, which will link to this new page: `https://staging.brainstorm.world/about-brainstorm-search`
>
> The `About Brainstorm Search` page should have two sections. The first section: `How Search Works` will be a brief paragraph that links out to this preexisting page: `https://staging.brainstorm.world/how-search-works`. The second section will be called `How to Use Brainstorm Search` and will list these ways to use it:
> 1. Directly, through the search bar
> 2. Using your agent. This will link to another page: `https://staging.brainstorm.world/brainstorm-skill`. For now, this page will be a placeholder.
> 3. Via other nostr clients. This section will include a link to the `https://staging.brainstorm.world/developers` page.
>
> The developers page currently has two panels. I would like to expand it to 4 panels:
> 1. NIP-50 (already exists) 2. Open Ranking (already exists) 3. Trusted Assertions (add a placeholder page) 4. Relay Tools (add a placeholder page)

### Acceptance frame

- [x] A new page at **`/about-brainstorm-search`** with exactly two sections.
- [x] Section 1, **"How Search Works"** — a brief paragraph linking out to the pre-existing `/how-search-works`, which is itself left unchanged.
- [x] Section 2, **"How to Use Brainstorm Search"** — lists three ways: directly through the search bar; using your agent (linking to `/brainstorm-skill`); via other nostr clients (linking to `/developers`).
- [x] The **search home footer** links to `About Brainstorm Search` in place of `How search works`.
- [x] **`/brainstorm-skill`** exists as a placeholder carrying the operator's supplied agentic-search copy.
- [x] The **`/developers` hub shows four panels** — the two existing (NIP-50, Open Ranking) plus placeholder pages for **Trusted Assertions** and **Relay Tools**.
- [x] Live and verified on `staging.brainstorm.world`.

### Operator decisions folded into the frame during planning

Three concerns were raised at planning and explicitly ruled on by the operator (recorded in both stories' `Open questions`):

1. **The agent placeholder must not dead-end** → operator supplied vision copy, so the page carries a thesis rather than a bare "coming soon".
2. **`/about` vs `/about-brainstorm-search` naming overlap** → acknowledged and **deliberately deferred**; explicitly out of scope.
3. **Footer swap pushes the GrapeRank/verification explanation one click deeper** → accepted tradeoff; the new page is the intended front door.

## Epics in this book

- `about-brainstorm-search` — story 1 (the About page, footer swap, `/brainstorm-skill`). Epic created 2026-07-21; **retired to `epics/done/` at this close** (its only story is Done).
- `developers-pages` — story 2 only (hub 2 → 4 cards + the two placeholder pages). This book does **not** cover that epic's story 1, which shipped 2026-06-19 under separate work and was never book-closed. **The epic stays Active** after this book closes, because future feature pages continue to slot into the same hub — so L2 (closed book ⇒ every listed epic Done) is knowingly waived for it, exactly as it is for `tag-event-inspector` under OPEN.md row 47.

## Strictness

**Lightweight docs-UI treatment**, operator-approved 2026-07-21: no ADR, no failing tests, browser-verified. This matches the precedent recorded in `stories/developers-pages/1-multipage-developers.md` ("built lightweight (no ADR/failing-tests; browser-verified)"). Phase 5 (Review) was likewise not run per-story — **this book close is the only review either story received**, which is noted as a finding in `audit.md` §7.

## Close artifacts

- Build audit: [`audit.md`](./audit.md)
- Product feedback: [`prd-seed.md`](./prd-seed.md) *(no prior PRD)*
