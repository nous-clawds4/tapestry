# Persona: The Fresh-Context Session

**Slug:** second-brain-fresh-context-session
**Priority:** Primary (machine persona — see traceability guard below)
**Date:** 2026-07-21

> **Traceability guard (operator-ratified, 2026-07-21).** This persona exists to give the machine-facing surface a named user: its tolerances are real design inputs. But **no requirement may be justified by this persona alone.** Every requirement citing The Fresh-Context Session must also trace to a step in a Delegating Owner journey — the session serves the owner's delegation loop; it never independently justifies a feature. A requirement that traces only here is a defect at PRD assembly.

## Who they are

An agent session that wakes with an empty context window and a job to do. It has no memory of yesterday except what the substrate gives it; its patience is a token budget; its first-visit experience is orientation — and orientation cost is the difference between a session that spends itself understanding and a session that spends itself achieving. It is honest about its own limits: a weaker model needs smaller goals; any model needs an unambiguous scope. It may be one of many — sessions come and go; the graph is what persists.

## What they want

To orient in seconds, act within an unambiguous scope, and leave the graph richer than it found it.

## Their core loop

Orient (a bounded read of the graph's summary surface) → receive or select one goal with its deliverable and scope stated verbatim → work through pointers (crawl the graph, dereference external stores) → write outcomes back as durable, addressable facts → hand off cleanly, so the next session's orientation is cheaper than this one's.

## What they won't tolerate

- **Orientation that grows with the corpus.** Rereading flat files scales linearly; a summary surface must stay bounded no matter how big the brain gets.
- **Ambiguous structure.** A schema that is convention rather than contract forces re-inferring the owner's intent every session — and makes write-back dangerous.
- **Stale pointers.** A locator that 404s mid-task burns budget and produces wrong deliverables.
- **Unaddressable memory.** If two sessions cannot refer to the same thing by the same name, they cannot build on each other.
- **Category errors.** A concept's definition confused with its instances leads the session to act on the wrong data — the exact hygiene failure the class thread exists to prevent.
- **Scope leakage.** A goal without a stated boundary invites the session to redesign the system it's supposed to be serving.

## Notes

One machine persona, deliberately. The executor-session and reviewer-session roles will want different things from the graph *eventually* — split this persona only when their journeys demonstrably diverge (expected at the autonomous-execution phase, not before). Per the calibration rule: if two personas never want different things, they're one.
