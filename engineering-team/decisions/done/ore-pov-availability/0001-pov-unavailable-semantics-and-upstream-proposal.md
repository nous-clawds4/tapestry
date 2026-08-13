# ADR 0001: POV-unavailable semantics — informative 422, never-substitute pin, and the ORE-01 upstream proposal

**Status:** Accepted
**Date:** 2026-08-12
**Story:** `engineering-team/stories/ore-pov-availability/1-pov-unavailable-error-and-upstream-proposal.md`

## Context

[Open-Ranking/protocol#8](https://github.com/Open-Ranking/protocol/issues/8) settled *direction*: when a provider cannot serve a personalized algorithm for the supplied `pov`, it should **return an error** (maintainer-endorsed "Solution 1") rather than silently substitute the global view. The ORE spec today has **no language for this case** — ORE-01's "Point of View (Pov)" section covers only *missing* pov (`422`) and pov-on-global (ignore); the endpoint OREs (02/03/05) each defer with "pov validation … follow[s] the rules defined in ORE-01". That one-home delegation is the key structural fact: a single ORE-01 edit binds every endpoint.

On our side, the behavior already exists (POV invariant, worksheet W12): `buildStats` returns `errorTriple(422, 'pov not provisioned')` for an unprovisioned pov ([stats.js:93–97](../../../src/api/open-ranking/stats.js)), and the hermetic suite already pins pieces of it — **B5** (unprovisioned → 422 + X-Reason present + scores never fetched), **G1–G3** (ADR `open-ranking/0005` anti-oracle gate), **B4/B12** (provisioned → 200). What the story adds is: (a) the *informative* reason (AC1 — the maintainer's "it can inform" rationale), (b) the error-body shape pin (no stats fields), (c) the upstream proposal artifact (AC4), (d) docs + W12 tracking (AC5).

Constraints:

- **ADR `open-ranking/0005` is inviolate here:** the gate default stays OFF; gate-closed responses must remain byte-for-byte identical for provisioned vs unprovisioned povs (G2). Our new reason string runs only on the gate-OPEN path, so it cannot touch the oracle posture.
- **ORE-01's registry rule** (`capabilities.js`): the default algorithm is the endpoint's first array element. Any client guidance naming an alternative must derive from the registry, not a literal, or the two drift.
- The exact string `pov not provisioned` is quoted in [BIBLE.md:1726](../../../BIBLE.md) (as-built doc — must follow the change) and in historical ADRs/reviews/worksheet (history — must NOT be edited).
- No concept-graph nodes are touched; no firmware change (story § Concepts touched).

## Options considered

### Option A — Minimal alignment + ORE-01-only proposal, artifact under `protocols/upstream/` *(chosen)*

One code line changes: compose an informative reason at the existing 422 site, deriving the alternative from the registry default. Pin reason-content + body shape in the existing suite. Docs page + BIBLE line + worksheet W12 updated. The upstream deliverable is a new self-contained artifact `protocols/upstream/ore-01-pov-unavailable.md` (proposed spec text verbatim + ready-to-paste PR title/description), and `protocols/README.md`'s layout gains an `upstream/` line — protocol-normative text belongs in `protocols/` per its boundary rule, and `drafts/` (our own pre-NIPs) is semantically wrong for a proposal to an external spec.

- **Pros:** smallest possible diff on a security-sensitive public surface; single-home spec edit mirrors the spec's own delegation structure; registry-derived guidance can't drift; artifact is durable, reviewable, and exactly what wds4 pastes upstream.
- **Cons:** introduces a new (one-line) `protocols/upstream/` convention; our X-Reason may need a trivial re-phrase if upstream bikesheds the merged wording.

### Option B — Richer conformance: machine-readable reason codes + 202 scaffolding

Also add a structured `code` field to the error body (e.g. `{error, code: 'pov_not_provisioned'}`), teach the provider a `202`/`Retry-After` path, and expand capability-doc descriptions.

- **Pros:** clients could automate per-reason recovery (the issue thread's four-reason taxonomy).
- **Cons:** adds *unratified* protocol surface — exactly the field-bloat the maintainer rejected in issue #8; our provider has no backing state for `202` (provisioning is operator-driven; nothing is ever "still computing" from ORE's perspective), so the scaffolding would be dead code; violates the story's out-of-scope line. Rejected.

### Option C — Park the PR draft in `docs/` or the story folder

- **Cons:** `docs/` carries HANDOFF-status semantics; the story folder buries a durable, protocol-shaped artifact in process records; both split protocol content away from `protocols/`, whose README exists to index exactly this kind of thing. Rejected.

## Decision

**Option A.** The spec proposal edits only ORE-01 § "Point of View (Pov)"; tapestry alignment is one composed string plus pins, docs, and tracking.

**The proposed upstream text** (appended to ORE-01 § Point of View (Pov), as a `### Unavailable pov` subsection — the Implementer copies this verbatim into the artifact):

> ### Unavailable pov
>
> A provider MAY be unable to serve a personalized algorithm for a particular `pov` — for example, a pubkey whose follow list the provider cannot locate, a brand-new user with an empty graph, or a provider that only computes personalized scores for registered points of view.
>
> If the provider cannot serve the requested algorithm for the supplied `pov`, it MUST respond with `422 Unprocessable Content`. The provider MUST NOT fall back to a different point of view (such as a global or provider-default view) and return its results as if they were personalized to the requested `pov`.
>
> Providers SHOULD explain the refusal in the `X-Reason` response header, including what the client can do instead — for example requesting the endpoint's default algorithm, or how to get the `pov` supported by this provider. Clients SHOULD surface this reason to their users and MAY fall back explicitly, e.g. by re-requesting with a global algorithm.
>
> If the provider supports the `pov` but its results are not yet available (for example, scores are still being computed), the provider SHOULD respond with `202` and a `Retry-After` header instead, as defined by the endpoint OREs.

**The new reason string** (gate-OPEN unprovisioned path only), composed from the registry:

```js
const defaultAlgo = resolveAlgorithm('/stats/pubkey'); // first/default element: 'graperank'
return errorTriple(422,
  `pov not provisioned: personalized scores are not available for this pov on this instance; ` +
  `request the default global algorithm '${defaultAlgo.id}' instead`);
```

The `pov not provisioned` prefix is kept for log/operator continuity; the guidance clause satisfies AC1; `errorTriple` already mirrors the reason into `body.error`, giving the error-object body with no stats fields.

## Consequences

- Public deployments are behaviorally unchanged (gate OFF); the new reason is observable only where the operator opens the gate (local/staging demo). **The gate flip on staging is a demo-time operator action and should be flipped back after** — ADR 0005's footgun note stands: an open gate on a public deployment re-opens the enumeration oracle.
- If upstream merges edited wording, our X-Reason may deserve a cosmetic re-phrase — a trivial follow-up, not a blocker; the *contract* (422, never substitute, informative reason) is what we pin.
- New one-line `protocols/upstream/` convention (indexed in protocols/README.md).
- The worksheet W12 question graduates from "should we propose upstream?" to "proposal drafted, awaiting submission/merge" — W12's *auth* half (the oracle) remains open and untouched.
- **Firmware reinstall required?** No.

## Implementation notes

1. **[src/api/open-ranking/stats.js:96](../../../src/api/open-ranking/stats.js)** — replace `errorTriple(422, 'pov not provisioned')` with the composed reason above (`resolveAlgorithm` is already imported). No other code change; `search.js`/`capabilities.js`/`index.js` untouched.
2. **[BIBLE.md:1726](../../../BIBLE.md)** — update the quoted X-Reason: the 422's reason now *explains unavailability and names the default global algorithm*; keep the never-silent-fallback sentence as-is.
3. **[ui/src/pages/developers/OpenRanking.jsx](../../../ui/src/pages/developers/OpenRanking.jsx)** — three edits: (a) §2 stats paragraph: expand the parenthetical — unprovisioned `pov` → `422` whose `X-Reason` says what to do instead; note the personalized algorithm appears in the capability document only when this instance serves it (check there first). (b) § Conventions: add the contract sentence — *a personalized request for an unavailable POV is refused; results are never silently computed from another point of view; on that 422, re-request the default global algorithm explicitly.* (c) § Reference: add a list item linking issue #8 and the in-repo proposal artifact.
4. **`protocols/upstream/ore-01-pov-unavailable.md`** *(new)* — self-contained proposal artifact: header (Target: `Open-Ranking/protocol` `01.md` § Point of View (Pov); Status: awaiting submission by the author (wds4); Issue: #8; Date), the verbatim proposed text (block above), suggested PR title `ORE-01: define provider behavior when the requested pov cannot be served`, and a ready-to-paste PR description that (i) states the problem, (ii) summarizes the rule (422 / MUST NOT substitute / X-Reason SHOULD inform / 202-vs-422 split), (iii) notes ORE-01 is the single home because the endpoint OREs delegate pov validation to it, (iv) records the deliberately-deferred open question (machine-readable reason codes — future ORE if client automation needs it) and the privacy note (providers with registration/provisioning models may keep `X-Reason` vague or require ORE-A auth to avoid membership disclosure), and (v) ends with `Closes #8`.
5. **[protocols/README.md](../../../protocols/README.md)** — layout block gains: `upstream/  # proposals to external protocols (e.g. ORE) — drafted here, submitted by the author`.
6. **[protocols/worksheet.md](../../../protocols/worksheet.md) W12** — append a dated update: proposal drafted per issue #8 solution 1; artifact path; awaiting wds4 submission; local alignment via `ore-pov-availability` #1. Do not edit W12's existing history or its auth question.

**Required test coverage** (Phase 3 lane — `test/open-ranking-stats.test.js`, already registered in `test/test.js`): a new gate-OPEN test pinning AC1's *content* — X-Reason matches both the unavailability statement and the default algorithm id (`graperank`), and the body is exactly the error object (has `error`; lacks `rank`/`hops`/`followers`/`pagerank`). Existing B5 (no-fetch), G1–G2 (gate-closed indistinguishability), B4/G3/B12 (provisioned 200) already pin AC2/AC3 and must keep passing unmodified.

## Out of scope

- W12 auth proper (ORE-A/NWT or self-only) and any prod gate flip.
- Implementing `202`/`Retry-After` on our provider (no backing "computing" state exists).
- A reason-code taxonomy (floated as an open question in the PR description only).
- Submitting the PR (wds4's manual act); any post-submission spec negotiation.
- NosFabrica codebase changes and les-femmes-orange client handling.
