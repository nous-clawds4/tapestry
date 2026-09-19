# Design philosophies

A design philosophy names a choice that keeps coming back — a choice between legitimate alternatives, where neither is simply right. Each philosophy keeps a ledger of what the alternatives are good and bad at, and a growing list of worked examples: where we went one way, where we went the other, and why. The point is that our understanding accumulates instead of being re-derived feature by feature.

**Standing: advisory** (owner decision, 2026-09-19). Nothing in this folder is a rule, and no gate checks it. When a design runs into one of these questions, read the philosophy, then say in your own artifact — scope doc, domain model, ADR — which way you went and why. Going against the grain of a philosophy is allowed. Never noticing the question is what this folder exists to prevent.

## Index

| Philosophy | The question it helps with | Read it when |
|---|---|---|
| [Show and Tell](./show-and-tell.md) | When the community curates something for you, should the evidence be what trusted people *do*, or what they *say*? | Designing anything where other people's activity decides what a user sees: ordering or suggesting Tags, list membership, graph edges, ratings, pins, "popular" or "recommended" anything. Also whenever an action a user takes for their own benefit is about to be counted for other people. |

Sources the philosophies cite — the owner's articles, with working links — are in the [bibliography](./bibliography.md).

## What belongs here

| If it is… | it lives in… |
|---|---|
| a rule every design must honor | the architecture invariants in [CLAUDE.md](../CLAUDE.md); full standards in [BIBLE.md](../BIBLE.md) |
| a wire format an independent implementation must parse or produce | [protocols/](../protocols/README.md) |
| how our stack stores, computes, ranks or displays something | [BIBLE.md](../BIBLE.md) |
| what to build, and in what order | [ROADMAP.md](../ROADMAP.md) and `product-team/` |
| one decision, made once, for one story | an ADR under `engineering-team/decisions/` |
| **a recurring choice between legitimate alternatives, with tradeoffs and accumulating examples** | **here** |

Philosophies operate *inside* the four architecture invariants, never against them. If a philosophy seems to recommend something the invariants forbid, the invariants win and the philosophy has a bug — file it.

This folder belongs to neither team. Product roles and engineering roles both read it; the owner's words in it are the owner's.

## How to extend a philosophy

The documents are built to be appended to.

- **Ledger entries, heuristics, examples and open questions carry IDs** (`S+1`, `T−2`, `H3`, `E7`, `P1`, `Q4`). Add a new one at the end of its table with the next number. Never renumber — other documents cite these IDs.
- **Every entry says where it came from**: the owner (with a date), a cited article, or a piece of shipped work (a book, story, ADR or spec). An entry with no provenance is an opinion; put it under Open questions instead.
- **Examples name the datum being curated and carry a status** — `shipped`, `partly shipped`, `designed` (specified, not built), `proposed` (an idea with an intake entry) or `illustrative` (a teaching example that is not ours). When a proposed example ships, change its status and point at the code; don't delete the row.
- **Point at files and named sections, not line numbers.** Line numbers rot.
- **Quoted owner's words are not edited.** If the owner's view changes, add the new statement with its date and say what it supersedes.
- **Good moments to add an example**: a book close, a product retro, or any design discussion where the question was argued and settled.

Changes ride the doc lane (Implementer + Reviewer — [`engineering-team/workflows/0-intake.md`](../engineering-team/workflows/0-intake.md) step 3). A role whose write scope does not reach this folder proposes an entry with an [`OPEN.md`](../OPEN.md) row instead.

This folder is deliberately **not** listed in `scripts/harness-def-paths.txt`: it advises, it does not define harness behavior, so adding an example owes no CHANGELOG row.

## How to add a philosophy

Copy [`_template.md`](./_template.md), fill it in, and add a row to the index above. One file per philosophy.
