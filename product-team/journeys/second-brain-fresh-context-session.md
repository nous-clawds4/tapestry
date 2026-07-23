# Journey: The Fresh-Context Session

**Slug:** second-brain-fresh-context-session
**Persona:** `product-team/personas/second-brain-fresh-context-session.md`
**Date:** 2026-07-21

The machine journey. Its "first visit" is orientation from an empty context window; its "account" is the owner-gated access it inherits from running where it runs. Per the traceability guard, every step here exists to serve a step in the owner's journey (cited inline).

## Steps

### 1. Orientation (the first visit)
- **Trigger:** the session starts — cron tick, heartbeat, or the owner's hand — with empty context.
- **Action:** a bounded read of the brain's summary surface, then one-hop reads of what today's work touches.
- **Expected experience:** within a fixed, corpus-independent budget (on the order of a few thousand tokens), the session knows what exists, what matters now, and where its goal sits. It never rereads the whole brain. *(Serves owner steps 3–4: cheap orientation is what makes many small sessions affordable.)*
- **Emotional state:** n/a — but the design stance is: the session should never need to guess.

### 2. Goal receipt
- **Trigger:** the session is pointed at (or selects) one viable goal.
- **Action:** it reads the goal's deliverable and scope, stated verbatim, as fixed at claim time.
- **Expected experience:** an unambiguous job with a boundary — what "done" produces, what it may not touch. If the goal is bigger than its budget, the correct move (propose decomposition, don't attempt) is obvious from the structure itself. *(Serves owner step 2: decomposition; owner step 6: scope is what makes trust safe to extend.)*

### 3. Working through pointers
- **Trigger:** the work needs knowledge that lives outside the graph.
- **Action:** crawl from the goal to its linked resources; dereference each pointer in its native store (file, vault note, event, repo, URL).
- **Expected experience:** pointers carry enough identity and freshness to be trusted or verified cheaply; content stays external; nothing requires copying volume into the brain. *(Serves owner step 5: what the session maintains here is what the owner later retrieves in anger.)*

### 4. Write-back
- **Trigger:** progress happened — an outcome, a discovery, a dead end, a new idea.
- **Action:** record it as durable, addressable facts attached to the goal: what was done, what was produced (as pointers), what was decided and why. New goal ideas are proposed, never launched, from inside a session.
- **Expected experience:** writes are safe (schema is contract, not convention), attributable, and append-shaped — recording activity never rewrites the goal's identity. *(Serves owner step 4: the morning review is assembled from exactly these facts.)*

### 5. Hand-off
- **Trigger:** the deliverable is produced, the budget is spent, or the scope boundary is reached.
- **Action:** the session states where things stand against the deliverable, surfaces at most a question or two for the owner, and ends.
- **Expected experience:** the next session's step 1 is cheaper because this session ran — the graph, not the context window, carries the continuity. *(Serves owner steps 4 and 6: legible endings are what reviews and trust are built from.)*

## Friction points

- **Orientation cost creeping upward with corpus size** — the summary surface must stay bounded or step 1 silently eats the budget that step 3 needed.
- **A stale pointer mid-task** — the session either wastes budget verifying everything or produces a deliverable built on a 404. Freshness metadata is load-bearing.
- **Two sessions colliding on one goal** — claim/lease semantics must make "who is working on this" unambiguous.
- **Schema ambiguity at write-back** — the moment a session hesitates about *how* to record a fact, it will record it inconsistently, and the brain accumulates dialects.
- **The session redesigning the harness** — scope leakage from "achieve the goal" into "improve the system" must route through proposals, never direct edits.
