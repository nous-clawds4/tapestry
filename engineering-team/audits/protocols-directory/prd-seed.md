# PRD Seed: The Tapestry Protocol Library (protocols/)

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/protocols-directory/audit.md`
**Anchor:** acceptance frame in `book.md` (eager — the design handoff predates story 1)
**Confidence:** high
**Date:** 2026-06-10

> A reverse-engineered baseline in PRD shape, built from what shipped — a strawman for the product team to validate, not a ratified spec. Tags: `[FROM FRAME]`, `[INFERRED]`, `[UNKNOWN — product input needed]`.

## 1. Product vision

`[FROM FRAME]` A single, status-tracked home for every protocol specification the project authors — published Custom NIPs, local pre-NIPs, and the worksheet of open protocol problems — so the protocol can be read, evolved, and published independently of how the reference deployment implements it. `[INFERRED]` The deeper product bet: Tapestry's wire formats are an *asset* in their own right (the DLists NIP is already published; Communities and Tags depend on independent implementability), and protocol-as-product needs different curation than implementation docs. `[UNKNOWN]` Whether `protocols/` should eventually have a public reading surface beyond the repo (rendered site, NostrHub mirror set, github NIP repo).

## 2. Personas

- `[FROM FRAME]` **The protocol author** (the project owner) — writes and publishes NIPs under their own keys; needs working copies, divergence-from-published deltas, and an honest record of what is settled vs. open.
- `[INFERRED]` **The independent implementer** — builds a compatible client/mirror/deployment from the specs alone; needs stranger-readable, deployment-neutral, self-contained documents (this persona drove every story's readability AC).
- `[INFERRED]` **The collaborating branch owners** (Avi, Vinney) — need the cross-branch reconciliations (supersessions, shape corrections) written down where their work will encounter them.
- `[INFERRED]` **Future protocol sessions** (human or agent) — need the worksheet as the durable queue of open problems and the index as orientation.

## 3. Scope (as-built)

`[FROM FRAME]` The directory + ladder + index + worksheet; seven specs migrated (one published-pending-republish, one publish-ready, five pre-NIPs); the boundary rule with BIBLE pointer-first rewrites (§5/§8/§9/§23/§25/§26); branch content copied never merged; the Protocol-Spec workflow now ratifies into `protocols/`. `[INFERRED]` Also in scope as shipped: the honest-gap convention (specs say "not yet formalized" rather than inventing), deployment-neutral handles everywhere, and the cross-spec dependency web (communities ⇄ tags ⇄ inherit-from ⇄ class-thread ⇄ concepts ⇄ DLists).

## 4. Domain model

`[INFERRED]` **Spec** (status: 💭 idea → 📝 pre-NIP → 🧪 publish-ready → 🚀 published[, update pending]; attributes: canonical URL, last-published, sources, in-flight note). **Worksheet entry** (W-id; status Open/Graduated/Closed; refs). **The protocol entities themselves** are modeled *in* the specs (concept, tag-element, Community Declaration, deference closure, …) — the seed defers to them rather than restating. No concept-graph handles were created or changed by this book.

## 5. Design rules (as-built)

`[INFERRED]` (1) The boundary rule — wire format → `protocols/`, stack behavior → BIBLE; each format normative in exactly one place. (2) Deployment neutrality — no pubkeys in specs; "the deployment's X concept address" + W1. (3) Honest gaps — unsourceable detail is marked open, never invented. (4) Traceability — every normative claim traces to a source; disagreements surfaced as findings. (5) Pending-marker pattern for cross-spec dependencies on unmigrated/unmerged work, repointed when the dependency lands. (6) Publishing is the author's act; repo work ends at "publish-ready."

## 6. Carry-forward & open questions

Promoted from audit §6: the NostrHub republish + companion publication; D4 closure (Vinney confirm + backfill); the three-branch reconciliation (gates Communities v1 membership); W1 (concept identity — highest leverage), W8, W9, W10; the publication pass over the pre-NIPs' marked gaps; the Avi endorsements-supersession conversation; glossary trim; editorial-relationship descriptor formats.

## 7. What product must validate

- [ ] **Publication strategy** — which pre-NIPs publish, in what order, to which venue (NostrHub vs. github NIPs), and what "published" should mean for in-flight features. `[UNKNOWN]`
- [ ] **The taggings family** (W10) — the rename's cost/benefit (wire migration) and the `nostr-event-tag`/`dlist-tag` rollout the owner actively wants. `[FROM FRAME — owner guidance recorded, decisions open]`
- [ ] **Roster rule** (W9) — count-based vs. trust-weighted has product stakes (the no-veto safe-space property only holds under the weighted rule). `[INFERRED]`
- [ ] **Three-branch reconciliation sequencing** (§7) — org decision with Avi + Vinney. `[FROM FRAME]`
- [ ] Whether a public reading surface for `protocols/` is wanted (§1's `[UNKNOWN]`).
