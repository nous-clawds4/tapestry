# Story 1: Multipage /developers (hub + NIP-50 + Open Ranking)

**Status:** Done
**Created:** 2026-06-19
**Type:** Feature (UI / docs)

## Background
`/developers` is currently one page documenting only NIP-50 relay search ([ui/src/pages/BrainstormDevelopers.jsx](../../../ui/src/pages/BrainstormDevelopers.jsx)). Open-Ranking (ORE) is now live and needs developer-facing docs. Split the page into a hub + per-feature pages so each protocol has its own page and new ones slot in cleanly. Operator-approved design (2026-06-19), built lightweight (no ADR/failing-tests; browser-verified).

## User-facing description
As a nostr-client developer, I want a `/developers` hub that links to per-feature integration docs (NIP-50 and Open Ranking) — each with worked examples — so I can find how to integrate the feature I care about, and get back to the hub easily.

## Acceptance criteria
Browser-testable on the rendered SPA.

- [x] **Hub (`/developers`)** renders: a short intro, a link to **NIP-50** (`/developers/nip-50`), a link to **Open Ranking** (`/developers/open-ranking`), and the existing **Open-source** GitHub links (Brainstorm Search repo + NosFabrica repos). No console errors.
- [x] **`/developers/nip-50`** renders the existing NIP-50 content — host-derived relay URL (`wss://<host>/relay`), minimal + WoT quick-start examples, the `observer`/`sort`/`filter` extensions table, auto-provisioning note — plus a "← Developers" back-link.
- [x] **`/developers/open-ranking`** renders: what-ORE-is intro; host-derived capability-doc URL (`https://<host>/.well-known/open-ranking.json`); the `POST /stats/pubkey` and `POST /search/pubkeys` endpoints with `graperank` (global, default) + `graperank-personalized` (requires a provisioned `pov`, else `422`); a worked POST body + **expected response** for each using the final field set (`rank, hops, followers/muters/reporters` verified, `follows/mutes/reporting` totals, `pagerank`; no `ttl`); a field-reference table; links to the ORE spec (`github.com/Open-Ranking/protocol`) + the repo; and a "← Developers" back-link.
- [x] **Deep-linking** to each sub-route loads the page directly (SPA catch-all serves it; no server change).
- [x] **Additive / isolated:** frontend only; existing `/developers` visitors land on the hub; no other page or any backend behavior changes.

## Out of scope
- Other protocol pages; any backend/API/data change; a `learn_more` docs page on the ORE endpoint itself (separate, later); linking to internal docs (BIBLE) from the public page.

## Deviations
- **AC-3, read against what the provider offered (noted 2026-09-18, when the criteria were checked).** The criterion lists both endpoints "with `graperank` … + `graperank-personalized`". The page documents both algorithms on `POST /stats/pubkey`, and describes `POST /search/pubkeys` as ranked by the global GrapeRank only — because that is what the provider did at ship time (`src/api/open-ranking/search.js` at `821b0b47`: "global only"; the personalized search algorithm was deferred). Ticked on that reading: both endpoints documented, each algorithm documented where it exists. A literal reading — both algorithms on each endpoint — would have had the page describe something the API did not do.

## Linked artifacts
- Review: none — lightweight docs-UI treatment (operator-approved 2026-06-19), and no book of work covers this story. It shipped in `821b0b47` (2026-06-20) and sat at `Approved` for three months. The five criteria were checked on 2026-09-18: statically against that commit, and live on `tapestry.brainstorm.world` with each route loaded directly and a clean console. The pages have grown since (story 2's two hub cards; later Open Ranking sections) without losing anything listed above. The operator ratified the flip the same day — OPEN.md row 321. A second, independent check of the five criteria is in `engineering-team/reviews/harness-self-improvement/session-closeout-2026-09-18.md`.
