# Story 1: ORE-03 /rank/pubkeys (global)

**Status:** Approved
**Created:** 2026-08-15
**Type:** Feature

## Background
npub.world's provider validation fails against both R&D instances (staging.brainstorm.world,
tapestry.brainstorm.world) with `no algorithms registered in the mandatory /rank/pubkeys` — the
exact throw from the official `open-ranking` JS SDK's `validateCapabilities()`, which npub.world
runs on the capability document. The upstream spec marks ORE-01, ORE-02, and ORE-03 `mandatory`;
the retired `open-ranking` epic shipped 01/02/05 and scoped ORE-03 out, so our document has never
registered `/rank/pubkeys`. The NosFabrica instances register it and validate green.

This story implements **ORE-03 `POST /rank/pubkeys`** — the batch counterpart of ORE-02: accept a
set of pubkeys, return them ranked by the instance's global web-of-trust — and registers it in the
capability document. Affected: anyone selecting an R&D instance as their ORE provider in npub.world
(or any SDK-based client), which today hard-fails at validation.

## User-facing description
As a nostr client using an R&D Brainstorm instance as my Open-Ranking provider, I want the
provider to rank a batch of pubkeys in one call, so that provider validation succeeds and the
client can rank arbitrary pubkey sets without one stats call per pubkey.

## Acceptance criteria
Testable from outside (anonymous HTTP; routes off the `/api/` prefix, same as existing ORE routes).

- [ ] **Capability doc extended.** `GET /.well-known/open-ranking.json` → 200; the body now also
      maps `/rank/pubkeys` to a non-empty array whose first (default) element is the global
      algorithm (`id: "graperank"`, `pov: false`). `/stats/pubkey` and `/search/pubkeys` entries
      unchanged. The document passes the official `open-ranking` JS SDK `validateCapabilities()`
      (npub.world's Validate path) with no mandatory-endpoint throw.
- [ ] **Batch rank happy path.** `POST /rank/pubkeys` with `{ "pubkeys": [<valid pubkeys>] }` and
      no `algorithm` → 200 with `{ results: [{ pubkey, rank }, …] }` (no `ttl` — amended at the
      Architecture gate per ADR open-ranking/0004's "No `ttl` anywhere"; `ttl` is optional in
      ORE-03), `results` sorted by `rank` descending, containing each requested pubkey exactly
      once (when `limit` ≥ count).
- [ ] **Rank semantics.** `rank` has the same scale and meaning as ORE-02 `/stats/pubkey`'s `rank`
      under the instance's global POV (`round(influence × 100)`) — the two endpoints agree for the
      same pubkey. Pubkeys unknown to the instance still appear, with floor rank 0 (ORE-03: a rank
      for every requested pubkey, including unknown ones).
- [ ] **`limit`.** Optional positive integer. Omitted → defaults to the number of requested
      pubkeys; greater than that number → silently clamped to it (per ORE-03). Response contains
      exactly `limit` entries (the top-ranked). Zero, negative, or non-integer `limit` → `422`.
- [ ] **Request-size cap.** More pubkeys than the provider maximum (Architect sets the value; spec
      guidance ≤1000) → `413`.
- [ ] **ORE-00/01 conventions.** Missing or empty `pubkeys` → `422` + `X-Reason`; any entry that is
      not a valid pubkey per ORE-00 → `422`; unsupported `algorithm` → `422`; malformed JSON body
      → `400`; a `pov` supplied to the global algorithm is ignored (200). Every response (success
      and error) carries `Content-Type: application/json` + `Access-Control-Allow-Origin: *`;
      `OPTIONS` preflight behaves like the existing ORE routes.
- [ ] **Additive / isolated.** Read-only; no new infrastructure, no firmware/schema/pipeline
      change, no nginx change, no writes. Existing ORE endpoints byte-identical apart from the
      capability-doc growth. With the ORE module unregistered, the app behaves as before.

## Concepts touched
No new concept-graph concepts. Existing concepts referenced, not modified: `graperank`,
`web-of-trust` (local handles `39998:<TA-pubkey>:graperank` / `…:web-of-trust`; TA pubkey is
per-deployment). Existing machinery (reference, do not re-define):
- **ORE capability registry** — `src/api/open-ranking/capabilities.js` (single source of truth for
  the served doc AND per-request algorithm resolution; the ORE-01 no-drift rule).
- **ORE-00 conventions** — `src/api/open-ranking/shared.js` (hex validation, headers, error triples).
- **Global-POV score source** — `fetchProfileScores({ pubkey, observerPubkey })`
  (`src/api/export/users/queries/get-profile-scores.js`), the per-pubkey source ORE-02 already
  uses; batching strategy is the Architect's call.

## Out of scope
- `pov: true` personalized ranking on this or any endpoint — gated behind W12 auth (ADR
  open-ranking/0005, enumeration oracle); advertising it would reopen the oracle.
- ORE-06 `/followers` / ORE-07 `/muters` — story 2 of this epic.
- ORE-04 `/recommend/pubkeys`, ORE-08 `/compromised/pubkeys`, ORE-A/NWT auth, and the
  `202`/`Retry-After` async pattern (we answer synchronously or error).
- Any UI; any change to the NosFabrica codebase; BIBLE write-up beyond what review requires.

## Open questions
All resolved at the Architecture gate (ADR ore-parity/0001, operator-approved 2026-08-15):
- **Provider max `pubkeys`** — resolved: 1000 (the spec's SHOULD-NOT ceiling), enforced pre-dedup
  → `413` (ADR decision 4).
- **`ttl` value** — resolved: omitted entirely, honoring ADR open-ranking/0004's "No `ttl`
  anywhere" (`ttl` is optional in ORE-03); AC 2 amended accordingly (ADR decision 1).
- **Invalid-entry handling** — resolved: whole-request `422` — ORE-00 makes 64-char lowercase hex
  a MUST for all requests; unknown-but-valid pubkeys stay rank 0 (ADR decision 5).

## Linked artifacts
- ADR: `engineering-team/decisions/ore-parity/0001-rank-pubkeys.md` (Accepted)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
