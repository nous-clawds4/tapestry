# Design philosophies

A design philosophy names a choice that keeps coming back — a choice between legitimate alternatives, where neither is simply right. Each philosophy keeps a ledger of what the alternatives are good and bad at, and a growing list of worked examples: where we went one way, where we went the other, and why. The point is that our understanding accumulates instead of being re-derived feature by feature.

**Standing: advisory** (owner decision, 2026-09-19). Nothing in this folder is a rule, and no gate checks it. When a design runs into one of these questions, read the philosophy, then say in your own artifact — scope doc, domain model, ADR — which way you went and why. Going against the grain of a philosophy is allowed. Never noticing the question is what this folder exists to prevent.

## Index

| Philosophy | The question it helps with | Read it when |
|---|---|---|
| [Show and Tell](./show-and-tell.md) | When the community curates something for you, should the evidence be what trusted people *do* for their own reasons, or what they *say* because they mean to say it? | Designing anything where other people's activity decides what a user sees: ordering or suggesting Tags, list membership, graph edges, ratings, pins, "popular" or "recommended" anything. Also whenever an action a user takes for their own benefit is about to be counted for other people. |

Sources the philosophies cite — the owner's articles, with working links — are in the [bibliography](./bibliography.md).

## What belongs here

| If it is… | it lives in… |
|---|---|
| a rule every design must honor | the architecture invariants in [CLAUDE.md](../CLAUDE.md), with full standards in [BIBLE.md](../BIBLE.md); the Product Principles in [ROADMAP.md](../ROADMAP.md); the design and language rules in [`product-team/guardrails/`](../product-team/guardrails/) |
| a wire format an independent implementation must parse or produce | [protocols/](../protocols/README.md) |
| how our stack stores, computes, ranks or displays something | [BIBLE.md](../BIBLE.md) |
| what to build, and in what order | [ROADMAP.md](../ROADMAP.md) and `product-team/` |
| one decision, made once, for one story | an ADR under `engineering-team/decisions/` |
| **a recurring choice between legitimate alternatives, with tradeoffs and accumulating examples** | **here** |

Philosophies operate *inside* the four architecture invariants, never against them. If a philosophy seems to recommend something the invariants forbid, the invariants win and the philosophy has a bug — file it.

This folder belongs to neither team. Product roles and engineering roles both read it; the owner's words in it are the owner's.

**"The owner"** in this folder means the person who owns this project: the creator of Brainstorm, listed in [BIBLE.md](../BIBLE.md) §20 (People) as wds4/straycat, who publishes on nostr as straycat. It does not mean the instance owner or the Owner point of view (BIBLE §27), which name whoever runs a given deployment. An article by straycat in the [bibliography](./bibliography.md) is the owner's earlier view, not a second authority. Only a statement the owner made counts as "owner" provenance; a collaborator's statement is attributed to the collaborator by name.

## How to extend a philosophy

The documents are built to be appended to.

- **Ledger entries, heuristics, examples and open questions carry IDs** (`S+1`, `T-2`, `H3`, `E7`, `Q4`). The plus and minus are the plain keyboard characters, so an ID can be typed and grepped. The prefix names the table, never the status: a proposed example is an `E` row like any other, and its Status column says `proposed`. Add a new entry as the last row of its table, numbered one past the highest number already there. Never renumber — other documents cite these IDs.
- **Every entry says where it came from**: the owner (with a date), a cited article, or a piece of shipped work (a book, story, ADR or spec). An entry worked out from another entry says so and names it — `converse of T+1 (drafting, 2026-09-19)`. A sentence added in drafting to an entry credited to a source is marked in its provenance cell — `(the gloss was added in drafting)`. An entry with no provenance is an opinion; put it under Open questions instead.
- **Examples name the datum being curated and carry a status** — `shipped`, `partly shipped`, `designed` (specified, not built), `proposed` (an idea with an intake entry) or `illustrative` (a teaching example that is not ours). When a proposed example ships, change its status and point at the code; don't delete the row.
- **Point at files and named sections, not line numbers.** Line numbers rot.
- **Quoted owner's words are not edited.** Tidying typography is fine: straight quotes for curly, a missing space, a capital where a lead-in clause is dropped. A changed word is not. If the owner's typing has a slip, keep the slip, or move the repaired word outside the quotation marks. If the owner's view changes, add the new statement with its date and say what it supersedes.
- **"Last reviewed by the owner" is the owner's to set.** Write a date there only when the owner has said they read the file itself. Stating the idea, approving a plan for it, or being quoted in it is not a review. Until then the field reads "not yet". Entries added after that date keep their own provenance and stay unreviewed until the owner moves the date.
- **Good moments to add an example**: a book close, a product retro, or any design discussion where the question was argued and settled.

Changes ride the doc lane (Implementer + Reviewer — [`engineering-team/workflows/0-intake.md`](../engineering-team/workflows/0-intake.md) step 3). A role whose write scope does not reach this folder proposes an entry with an [`OPEN.md`](../OPEN.md) row instead.

This folder is deliberately **not** listed in `scripts/harness-def-paths.txt`: it advises, it does not define harness behavior, so adding an example owes no CHANGELOG row.

## How to add a philosophy

Copy [`_template.md`](./_template.md), fill it in, and add a row to the index above. One file per philosophy.
