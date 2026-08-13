# Story 1: POV-unavailable error — never substitute, propose upstream, document

**Status:** Approved
**Created:** 2026-08-12
**Type:** Feature

## Background

When a client asks an Open Ranking provider for scores personalized to a `pov` pubkey the provider cannot serve, some providers (today: the NosFabrica deployment of Brainstorm) silently fall back to global scores. The client has no way to know personalization did not happen — the results *lie about whose view they represent*. The operator raised this upstream as [Open-Ranking/protocol#8](https://github.com/Open-Ranking/protocol/issues/8); the protocol maintainer (pippellia) endorsed **Solution 1**: return an error, with the explanation in the `X-Reason` header, and never substitute another point of view. The operator has elected to pursue that solution.

Tapestry's ORE surface already behaves this way (the POV invariant — worksheet **W12**; ADRs `open-ranking/0001`, `/0005`): an unprovisioned `pov` gets `422` + `X-Reason`, and the personalized-stats algorithm is gated OFF publicly until W12 auth exists (anti-enumeration-oracle). But three gaps remain:

1. **The contract isn't normative upstream.** The ORE spec is silent on "pov supplied but unavailable" — the very gap that lets other providers fall back silently. ADR 0005 explicitly deferred "the upstream question"; this story picks it up.
2. **Our refusal is terse, not informative.** The maintainer's rationale for the error approach is that `X-Reason` can tell the caller what to do next; ours states only that the pov isn't provisioned.
3. **Never-substitute is implemented but not pinned.** No test asserts the invariant *as an invariant* (that no path serves another POV's scores under the caller's label), and the developer docs state the `422` without the guarantee or the client's recovery path.

## User-facing description

As a **client developer** integrating this Open Ranking provider, I want a personalized-scores request for an unavailable POV to fail with an explicit, explanatory error instead of silently receiving global scores, so that I always know whether personalization happened and can choose my own fallback (request the global algorithm explicitly, or guide my user toward getting provisioned).

As the **protocol contributor (wds4)**, I want a submission-ready upstream proposal capturing this behavior, so that the contract becomes normative for every Open Ranking provider, not just ours.

## Acceptance criteria

- [ ] **AC1 — informative refusal (gate ON).** Given the personalized-stats gate is enabled and the request names the personalized algorithm with a syntactically valid but unprovisioned `pov`, when the client POSTs `/stats/pubkey`, then the status is `422`, the `X-Reason` header states the POV is not available on this instance **and** points the caller at a usable alternative (at minimum, the global default algorithm), and the JSON body is an error object carrying no rank/stats fields.
- [ ] **AC2 — anti-oracle unchanged (gate OFF, shipped default).** Given the gate is off, when the client POSTs the same request, then the response is the existing `422` unsupported-algorithm refusal and no provisioning lookup occurs — provisioned and unprovisioned povs remain indistinguishable (ADR `open-ranking/0005` behavior preserved).
- [ ] **AC3 — provisioned POV regression guard (gate ON).** Given a provisioned `pov`, the personalized request still returns `200` with that POV's stats, exactly as today.
- [ ] **AC4 — upstream proposal artifact.** A durable in-repo artifact contains (i) the exact proposed ORE-01 "Point of View" spec text mandating the error + never-substitute rule (with `X-Reason` guidance and a cross-reference to the existing `202`/`Retry-After` mechanism for POVs that are still being computed) and (ii) a ready-to-paste PR title + description referencing issue #8 — such that the operator can open the upstream PR as wds4 without editing.
- [ ] **AC5 — docs + tracking.** The `/developers/open-ranking` page documents the POV-unavailability contract (error semantics, the never-substitute guarantee, and the client's recovery path), and worksheet **W12** records the upstream proposal and its status.

## Concepts touched

No concept-graph nodes are created or altered; no firmware change. Referenced (plain language, per the retired `open-ranking` epic's "Concepts / machinery" section — not re-defined here):

- **House point-of-view identity** — the global view a silent fallback would wrongly serve under the caller's label.
- **Provisioned POV** — the owner or a customer whose WoT metrics exist on this instance; the availability test behind the error.

## Out of scope

- The internal search proxy's `povResolution` disclosure (operator-confirmed out, 2026-08-12 — it is the right mechanism at that first-party layer).
- Enabling `openRanking.personalizedStats` in production, and W12 auth proper (ORE-A/NWT or self-only check).
- Personalized search (retired open-ranking epic Story 3 / worksheet W13).
- A machine-readable reason-code taxonomy as normative spec text (the PR description may float it as an open question only).
- Actually submitting the upstream PR (wds4's manual act) and any follow-up spec negotiation.
- The NosFabrica codebase and the les-femmes-orange client (adopt later, in their own effort, if we like the result here — client first, provider second).

## Open questions

None blocking. Two defaults ratified at this story's approval gate (strike either if the operator disagrees):

1. **Informative `X-Reason`** — the refusal carries recovery guidance, not just a terse "not provisioned" (per the maintainer's "it can inform" rationale).
2. **`202` cross-reference** — the upstream proposal explicitly maps "POV still being computed" to the spec's existing `202` + `Retry-After`, covering the "signed up 30 seconds ago" case from the issue thread.

## Linked artifacts
- ADR: `engineering-team/decisions/ore-pov-availability/0001-pov-unavailable-semantics-and-upstream-proposal.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
