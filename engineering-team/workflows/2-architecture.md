# Phase 2: Architecture

## Role
Architect. See `engineering-team/roles/architect.md`.

## Input
An approved user story.

## Output
An ADR at `engineering-team/decisions/<epic-slug>/<NNNN>-<slug>.md` (numbering: zero-padded sequential per epic, e.g., `0007-add-stripe-webhook-handler.md`), using the `adr.md` template.

ADRs are **enabled** for this project.

## Steps

0. **Origin-drift preflight.** `git fetch origin staging` (quietly; tolerate offline). If the working base is behind `origin/staging` (else `origin/main`), surface the behind-count and ask whether to rebase/re-branch before designing against stale code — **warn-and-surface**; the hard halt stays Direction-only. *Why: an ADR designed against a stale base collides with shipped decisions (story #24 / ADR 0019 incident, intake 2026-05-24).*
1. **Read the story.** Quote the acceptance criteria back.
2. **Orient via the Concept Graph.** For any concept named in the story, call `/api/concept-graph/summaries` then `/neighbors` for the relevant handles before reading source files.
3. **Read the relevant code.** Identify which modules will change.
4. **List options.** At least two — one chosen, one alternative.
5. **Pick and justify.** Note tradeoffs. Note which architecture rules apply:
   - Orient via the Concept Graph API before reading source files.
   - Use the three-call pattern; don't use `/subgraph` depth > 1.
   - Concept handles are `kind:pubkey:slug`; constructible from slugs.
   - Don't load `BIBLE.md` or firmware JSON when the concept is in the graph.
6. **Check for ADR conflicts.** Read existing ADRs in `engineering-team/decisions/`. If you're contradicting one, supersede it explicitly.
7. **Write the ADR** using the template.
8. **Show it.** Iterate to approval.
9. **Gate:** "ADR approved? Ready for Test Design?"
10. Hand off to `/design-tests`.

## Common pitfalls
- Re-litigating the story. If the story is wrong, kick back to PO; don't redesign the requirement under the guise of architecture.
- Single-option ADRs. Always name an alternative — that's where the value comes from.
- Vague ADRs. "Use the existing pattern" isn't enough — name the pattern, name the file, name the function.
- Schema/concept changes that don't call out the firmware reinstall step.
- Designing for `staging` alone when the change must reach other live branches. A security fix ships everywhere it is live in one round (ledger `2026-10-10-sandboxes-got-security-fixes`), and each long-lived sandbox serves its own routes and files, so a port is new work, not a copy. Name each branch's preparation in the ADR's Implementation notes (what it lacks, what it adds, how its tests run there), so the Tester and the Reviewer cover each port's branch-specific part. When the fix commit itself discloses an open hole, every port must be ready before the first push (audit `admin-action-owner-check` §7 #2).

## Per-phase commits
Yes. Commit the ADR before moving on (e.g., `adr: <NNNN> <slug> (<epic> #<n>)` — the slug/epic reference feeds `harness-stats.sh` cycle-time matching, per workflow 1).
