# Upstream proposal: ORE-01 "Unavailable pov" — error, never substitute

**Target:** [`Open-Ranking/protocol`](https://github.com/Open-Ranking/protocol) → `01.md` § "Point of View (Pov)" (the normative subsection below), plus one restating row in the Error Codes table of each of `02.md`–`07.md`
**Issue:** [Open-Ranking/protocol#8](https://github.com/Open-Ranking/protocol/issues/8) — *confirm successful personalization of scores via optional param in the response*
**Status:** ⏳ submission-ready — awaiting the author's submission (**wds4**); repo work ends here, mirroring the protocols/README publishing rule
**Date drafted:** 2026-08-12
**Sources:** ADR `engineering-team/decisions/ore-pov-availability/0001-pov-unavailable-semantics-and-upstream-proposal.md`; worksheet W12; reference implementation `src/api/open-ranking/stats.js`

## How to submit

1. Fork `Open-Ranking/protocol` under **wds4**; branch, e.g. `pov-unavailable-error`.
2. In `01.md`, append everything in § "Proposed spec text (01.md)" at the end of § "Point of View (Pov)", after the "Clients MUST NOT send a `pov` …" paragraph.
3. In each of `02.md`, `03.md`, `04.md`, `05.md`, `06.md`, `07.md`, insert the row from § "Proposed spec text (endpoint error tables)" into the **Error Codes** table, directly beneath the existing row *"The requested algorithm requires a `pov` but none was provided."* (`08.md` stays untouched — see the aside in the PR description.)
4. Open a PR with the title and description below, verbatim.

## Proposed spec text (01.md — append to § Point of View (Pov))

```markdown
### Unavailable pov

A provider MAY be unable to serve a personalized algorithm for a particular `pov` — for example, a pubkey whose follow list the provider cannot locate, a brand-new user with an empty graph, or a provider that only computes personalized scores for registered points of view.

If the provider cannot serve the requested algorithm for the supplied `pov`, it MUST respond with `422 Unprocessable Content`. The provider MUST NOT fall back to a different point of view (such as a global or provider-default view) and return its results as if they were personalized to the requested `pov`.

Providers SHOULD explain the refusal in the `X-Reason` response header, including what the client can do instead — for example requesting the endpoint's default algorithm, or how to get the `pov` supported by this provider. Clients SHOULD surface this reason to their users and MAY fall back explicitly, e.g. by re-requesting with a global algorithm.

If the provider supports the `pov` but its results are not yet available (for example, scores are still being computed), the provider SHOULD respond with `202` and a `Retry-After` header instead, as defined by the endpoint OREs.
```

## Proposed spec text (endpoint error tables — `02.md`–`07.md`)

One row per file, inserted directly beneath the existing missing-`pov` row:

```markdown
| `422` | The requested algorithm cannot be served for the supplied `pov`. |
```

These rows are informative restatements — the normative rule lives in ORE-01, which every endpoint ORE already defers to for pov validation — exactly like the existing missing-`pov` rows they sit beside.

## PR title

```
ORE-01: define provider behavior when the requested pov cannot be served
```

## PR description (ready to paste)

```markdown
## Problem

ORE-01 defines what happens when a required `pov` is *missing* (`422`) and when a `pov` is sent to a *global* algorithm (ignore it) — but not what a provider should do when a personalized algorithm is requested for a `pov` it **cannot serve**: a follow list it can't locate, a brand-new user with an empty graph, or a provider that only computes scores for registered points of view.

Without normative language, the tempting implementation is to silently fall back to a global/default view. That response lies about whose view it represents: a client that requested personalization has no way to detect that it didn't happen, and no opportunity to inform its user. This is the scenario discussed in #8, where returning an error was the preferred resolution.

## What this adds

One subsection, `### Unavailable pov`, at the end of ORE-01 § Point of View (Pov):

- the provider **MUST** respond `422 Unprocessable Content` when it cannot serve the requested algorithm for the supplied `pov`;
- the provider **MUST NOT** substitute a different point of view and present the results as personalized — this sentence is the actual point of the change;
- the provider **SHOULD** explain the refusal in `X-Reason`, including what the client can do instead, so the client's fallback becomes an explicit, informed act;
- the "can serve it, just not yet" case (scores still being computed) is explicitly routed to the **existing** `202` + `Retry-After` mechanism the endpoint OREs already define, keeping the two situations distinct.

ORE-01 is the single normative home for this rule because the endpoint OREs already defer pov validation to it. In addition, each endpoint ORE's **Error Codes** table (`02.md`–`07.md`) gains one restating row, directly beneath the existing missing-`pov` row:

> | `422` | The requested algorithm cannot be served for the supplied `pov`. |

Those tables already restate ORE-01's pov rules (every one lists "requires a `pov` but none was provided"), and ORE-04's `topic` rows already pair *missing* with *cannot-be-served* ("The `topic` value is not recognised by the provider.") — this completes the same pairing for `pov`, so a reader implementing a single endpoint can't conclude the case doesn't exist.

## Deliberately left out

- **Machine-readable reason codes.** An unavailable `pov` can have distinguishable causes (never registered / still computing / data too stale / refused). `202` already covers "still computing"; the rest ride in the human-readable `X-Reason` for now. If client automation ever needs to branch on the cause, a small enumerated vocabulary could be a future ORE — left out here to keep the protocol lean.
- **Privacy posture.** For providers that only serve registered/provisioned `pov`s, a per-`pov` success-vs-error split can disclose who is registered. Such providers can keep `X-Reason` deliberately vague, or put personalized algorithms behind auth (ORE-A); nothing in this change requires disclosure.

**An aside on ORE-08:** its Error Codes table currently carries no `pov` rows at all — not even the missing-`pov` one — although its prose says probabilistic algorithms MAY require a `pov`. That looks like a pre-existing gap; I've left it untouched to keep this change focused, but happy to add both rows there too if you'd like.

Closes #8
```
