# ADR 0005: ORE-02 stats — gate the personalized (pov:true) path behind a config flag (default OFF)

**Status:** Accepted
**Date:** 2026-07-10
**Story:** `engineering-team/stories/done/open-ranking/1-ore-provider-and-stats.md` (amends) — post-close security amendment. **Realizes carry-forward W12** (`audit.md` §6; `protocols/worksheet.md` W12). Prompted by the `main`→`tapestry.brainstorm.world` cutover (main promoted to a public URL for the first time since brainstorm.world moved to the NosFabrica codebase).

## Context

`POST /stats/pubkey` is a **public, unauthenticated** ORE surface. Its `graperank-personalized` algorithm (`pov:true`) takes a caller-supplied `pov` and, per the POV invariant (ADR 0001), serves a `200` only when that `pov` is **provisioned** (a `NostrUserWotMetricsCard` is keyed on it) and a `422 "pov not provisioned"` otherwise.

That `200`-vs-`422` split is an **unauthenticated provisioning-enumeration oracle**: any anonymous caller can probe an arbitrary pubkey and learn whether it is a provisioned customer of this instance. Worse than membership disclosure, a *provisioned* pov returns that customer's **personalized web-of-trust view of the target** — the customer's graph computation, served to anyone, under that customer's POV, without their consent or authentication.

The open-ranking book flagged this at review as an **accepted-for-staging** finding with a **hard pre-prod gate** (`reviews/done/open-ranking/1-…`, `audit.md` §6/§7-adjacent, worksheet **W12**). It was never a problem on staging; it becomes one the moment `main` serves a public URL.

The proper long-term fix — **ORE-A / NWT auth or a self-only (NIP-98) check** on the `pov:true` path — is real feature work that also gates the deferred personalized *search* (Story 3 / W13) and is out of scope for a cutover. We need a **minimal, safe, reversible** gate now.

## Options

- **A — Config flag, default OFF (omit personalized-stats from the served surface until enabled).** Mirrors how personalized *search* is already handled in `capabilities.js` (simply not advertised). A gated request resolves to `null` and is rejected as an *unsupported algorithm* **before** any pov/provisioning check, so it is indistinguishable from any other unknown algorithm — the oracle never runs. Re-enable is a settings flip, but re-enabling **without auth re-opens the oracle** (documented footgun; the flag must not be turned on publicly until W12 auth lands).
- **B — Keep advertising it, gate at execution with a uniform `401`/`403` for every personalized request.** Closes the oracle too, but advertises an algorithm that always errors — dishonest capability doc, and inconsistent with the personalized-search deferral (which omits rather than advertises-and-errors).
- **C — NIP-98 self-only auth now.** The feature-complete answer, but it introduces signature-verification code on a public endpoint right before a cutover — highest risk of a subtle auth-bypass bug, and it is the very W12 work we are deferring.

## Decision

**Option A.** Add `openRanking.personalizedStats` (default `false`) to `src/config/defaults.json`, read through the existing two-layer settings (`getSettings()`, per-request, no restart — same mechanism as `search.resultTypes`). The gate is threaded as an **option into the pure builders** (`resolveAlgorithm`, `buildCapabilityDocument`), read from config only in the Express wrappers — preserving the ADR 0001 injectable-builder testability seam. When the flag is off:

- the capability document advertises **only** the global `graperank` for `/stats/pubkey`;
- `graperank-personalized` resolves to `null` → `422 "unsupported algorithm"`, with **no pov check and no score fetch** — provisioned and unprovisioned povs get an **identical** response.

This closes the oracle, defers the feature (consistent with personalized search already being deferred), and is fully reversible once W12 auth exists.

## Consequences

- **Enumeration oracle closed** on any deployment shipping the default. `tapestry.brainstorm.world` can serve `main` publicly without exposing the provisioned-customer set.
- **Personalized stats unavailable** over ORE until the flag is turned on — which must happen **together with** ORE-A/self-only auth (W12), never before. The pov-handling code in `stats.js` is retained and still tested (gate-open tests B4–B6/B12) so re-enablement is a config + auth change, not a rewrite.
- **No consumer impact:** nothing outside the ORE module calls the personalized path (verified: no UI, script, or internal caller); `/api/get-profile-scores` and the UI are unaffected.
- **Confined** to `capabilities.js` (gate + `visibleAlgorithms`), `stats.js` (thread the flag), `index.js` (capability-doc handler), and `defaults.json`. Pure builders stay pure (settings are lazy-required).
- **Tests:** `open-ranking-stats` adds G1–G3 (anti-oracle: closed gate never consults provisioning, provisioned≡unprovisioned response, open gate restores 200); C1/C2 + `open-ranking-search` C1 updated to the gated default. `open-ranking-stats` 24/24, `open-ranking-search` 18/18.
- **Firmware reinstall?** No.

## Out of scope

- **W12 proper** — ORE-A / NWT auth or NIP-98 self-only on the `pov:true` path (the mechanism that would let the flag be turned on publicly).
- Personalized **search** (Story 3 / W13) and the main→delegated POV resolver it needs.
- The upstream question of proposing a standard POV-availability mechanism to ORE.
