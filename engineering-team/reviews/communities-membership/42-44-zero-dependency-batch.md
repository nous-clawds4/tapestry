# Review: Stories 42 + 44 — Block 5 zero-dependency batch

**Reviewer:** independent agent (separate context, adversarial probes against the real modules)
**Date:** 2026-06-05
**Scope:** the two Block 5 stories that need only Vinney's *schema* (resolved: kind-39998 concept), not his *merge*: Story 44 (roster engine) and Story 42 (CD claims field + §26 inheritance).

## Quality gates
- `node test/test.js` — **PASS** (full suite; roster-engine 8/8, cd-claims-field 11/11, no regressions across the other 40 suites).
- `eslint` on all four touched source files — **clean**.
- Typecheck / build — not configured (JS-without-build, per house rules).

## Story 44 — `deriveRoster` (per-viewer roster engine)
**Verdict: PASS, no blocking issues.**

Verified by direct execution, beyond the tests:
- **"No veto" holds** — the cutoff gates `wotScore(asserter)`, not the candidate; an untrusted −1 contributes 0.
- **Member-vs-applicant precedence correct** — a candidate both vouched above threshold and self-tagged lands in `members`.
- **`0` cutoff/threshold preserved** (`== null` coalesce, no truthiness swallow).

Two pre-wire traps were hardened on review feedback (both silent-wrong-answer risks once real tags flow, both cheap):
1. **Duplicate-asserter double-counting** → now collapses to one assertion per `asserter|target|concept` (last-writer-wins), matching the addressable/replaceable nature of a nostr-user-tag. Test T7.
2. **Absent polarity silently treated as −1 (downvote)** → now a tag's presence is a vouch (+1); only an explicit negative is a dispute. Test T8.

## Story 42 — CD claims membership tags + 4-layer inheritance
**Verdict: PASS (definition side). UI criterion (AC#4) legitimately deferred to the Story 45 display batch.**

The default/inheritance design across all four layers was probed and could not be broken:
- **Builder** materializes defaults only when founding; a fork omits unset fields. `cutoff: 0` / `threshold: 0` survive on both paths.
- **Projection** reports absent threshold/cutoff as `null`, claims as `[]` — no default masquerades as a stated value.
- **Resolver** `mergeDefinition` correctly distinguishes empty-array claims (inherit) / scalar `null` (inherit) / `0` (present, overrides). Verified end-to-end: child `cutoff: 0` overrides parent `0.3` while `threshold: null` inherits `4`.
- **Consumer** applies the default exactly once, in `deriveRoster`.

The `0`-vs-absent distinction is the subtle bug this design category usually ships with; it is handled correctly at every layer.

## Fences / ADR consistency
The single-parent `b` FENCE (`projectDeclaration`) and the shared-`visited` diamond FENCE (`resolveDefinition`) are accurate and cross-reference each other. Code stays single-parent, consistent with ADR 0030. No new tech debt, no `console.log`, no TODO/FIXME, no dead code, no AI-slop comments.

## Non-blocking follow-ups (for the live wire-in, Story 43)
- Confirm the tag reader hands `deriveRoster` already-latest assertions (engine now defends against accidental dups regardless).
- The test harnesses for the builder/projection use regex extraction that terminates on the first column-0 `}`; sound today, but importing the real ESM modules would be more robust. The resolver harness (T10/T11) already Function-evals the whole module and genuinely catches regressions. Test-infra nit, not a product defect.

## Outcome
Both stories marked DONE for their in-scope (substrate) work. Block 5 cannot close — #43/#45/#46/#47 and the live wiring remain blocked on the `nostr-user-tag` core reaching `staging`. Book stays OPEN per the user's instruction.
