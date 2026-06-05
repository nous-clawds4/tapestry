# Story 32: Define the Resolved Definition primitive (read-side of the `b` tag)

**Status:** In Progress
**Created:** 2026-06-05
**Type:** Doc (protocol-definition — runs Planning → Architecture → Implementation → Review; **not** fast-tracked; carries a ratifiable design decision = an ADR. Sibling/continuation of `community-reference` #31 / ADR 0027.)

## Background

Story #31 / ADR 0027 / BIBLE §25 established the **`b` tag** — the *write* primitive for definitional inheritance ("I defer to X"). It deliberately left two loose ends: it **deferred the multi-parent resolution order** ("resolution order is a consumer concern"), and §25 **forward-references a resolver, `effectiveCD`, that nothing yet defines** (flagged as the one non-blocking follow-up in story #31's review).

The missing companion is the **read side**: *what does a node's definition actually resolve to, after following its `b` deferences?* That design is now settled (written up in `docs/COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md` §2): the **Resolved Definition** primitive. It is **general** — Alice's resolved definition of `dogs` versus Bob's is the same mechanism as a community — so it belongs in BIBLE core next to §25, with the Communities Protocol (and any future consumer) reading *through* it. Capturing it now fills ADR 0027's deferred resolution order and closes the §25 `effectiveCD` thread.

## User-facing description

**As an implementer or reviewer** reading the BIBLE, **I want** the read-side of the `b` tag — how a node's definition resolves after following its deferences — defined once and generally, **so that** I can compute a resolved definition without inferring it from a forward-reference.

**As a protocol designer**, **I want** the multi-parent conflict-resolution rule (the thing ADR 0027 deferred) recorded in an ADR, **so that** consumers build on a settled, deterministic rule rather than guessing.

## Acceptance criteria

Externally checkable assertions on `BIBLE.md` and the ADR (exact placement is the Implementer's call).

- [ ] The BIBLE defines **Resolved Definition** as the **general read-side of the `b` tag** (§25): a node's resolved definition = the merge of its `b`/`INHERITS_FROM` **closure**; explicitly general (any concept, e.g. `dogs`), **not** community-specific.
- [ ] The BIBLE states the **resolution rule**: (1) the node's own stated fields win; (2) for unstated conflicts among multiple `b` parents, **first-listed `b` wins** (deterministic, author-controlled); (3) a **visited-set bounds cycles** (the closure is not guaranteed acyclic). It always terminates and yields an answer.
- [ ] The BIBLE records that this **fills the multi-parent resolution order ADR 0027 deferred** and **defines the general resolver §25 forward-referenced as `effectiveCD`** — and §25's "multi-parent resolution deferred" note is updated to point to the new section.
- [ ] An ADR (in the `community-reference` 0027 lineage) records the decision — closure-merge + the override → first-listed → visited-set rule — with first-listed-wins flagged as a good-enough heuristic and **WoT-weighted field resolution explicitly rejected for v1**.
- [ ] Quality: no regression in the npm test suites (no source touched); no new lint/typecheck/build tooling.

## Concepts touched

Concept Graph API unreachable at planning — Architect to resolve any handles via `/api/concept-graph/summaries`.

- **The `b` tag / `INHERITS_FROM`** — §25 / ADR 0027 (the write primitive this completes).
- **Resolved Definition** — *new*; this story defines it.
- *(Consumer)* the Communities Protocol's `effectiveCD` — becomes a named instance of the general Resolved Definition.

## Out of scope

- **Any code** — an actual resolver/merge-walk implementation, Neo4j/query work. Docs + decision only; implementation is a future story.
- **WoT-weighted field-level resolution** — explicitly rejected for v1 (first-listed-wins is the rule).
- **Set-valued override algebra** (add/remove/replace over an inherited element *set*) — remains deferred per ADR 0027 (the first consumer that needs it defines it); not this story.
- **The Communities-specific resolution/consumer layer** — separate, and gated on the three-branch reconciliation (handoff doc §7).

## Open questions

**Resolved at planning (2026-06-05):**
1. **Scope** → the general Resolved Definition primitive only: BIBLE §26 (next section after §25) + an ADR (0027 lineage) + a small §25 cross-reference amendment. Docs-only.
2. **Phase path** → Planning → Architecture → Implementation → Review, with **Test Design skipped** (no executable behavior; doc-content sentinels covered in Review, per the #20 / #31 precedent).
3. **Save location** → `engineering-team/stories/community-reference/` per the epic-folder convention on staging+main (confirmed 2026-06-05); branched off `staging`. Note: `feat/communities` and `feat/pubkey-tagging-target` have not adopted epic-folders — convention alignment is part of the three-branch reconciliation (handoff §7).

**Forwarded to the Architect:**
4. Exact ADR number (expected **0028**, `decisions/community-reference/`); whether the §25 amendment is specified in that ADR or folded into Implementation notes; confirm §26 is the right section slot.

## Linked artifacts
- ADR: [../../decisions/community-reference/0028-resolved-definition.md](../../decisions/community-reference/0028-resolved-definition.md) — **Accepted** (2026-06-05).
- Test plan: _n/a — Test Design skipped (docs-only)._
- Review: [../../reviews/community-reference/32-resolved-definition-primitive.md](../../reviews/community-reference/32-resolved-definition-primitive.md) — **PASS** (2026-06-06): 5/5 ACs, ADR 0028-conformant, BIBLE-only diff, story #31's `effectiveCD` ref now closed; 24/24 unaffected suites green (2 pre-existing #236-reorg failures separately tracked in `task_00e94771`).
