# Build Audit: Event authenticity — verify client-published event signatures (F1)

**Book:** `engineering-team/audits/event-authenticity/book.md`
**Date:** 2026-09-11
**Branch / commit range:** `security/event-authenticity` (`1f3c1ac8`..`6c605780`) — merged to `staging` via #646 (`f8fe02e7`), to `main` via #647 (`d826557b`)
**Provenance:** Acceptance-frame (no PRD)
**Confidence:** high — shipped to staging + prod and verified end-to-end on both (live publish round-trip: forged rejected, valid published).

> As-built record for the book that closed audit finding F1 — the client-signed publish path writing forged events into the definitive graph without app-level signature verification. One story realized the whole frame.

## 1. What shipped

- **`POST /api/strfry/publish` (client path) now verifies the event signature** before publishing or learning it — a forged event (signature not valid for its claimed pubkey) is rejected with 400, reaching neither the relay, Neo4j, nor the LMDB tapestry store. — `stories/event-authenticity/1-verify-client-published-event-signatures.md`
- **The destructive `d`-tag-reuse overwrite is closed** — rejection happens before `maybeBrainWriteTapestry` → `importEventDirect`, so a forged event can't MERGE-overwrite a genuine element.
- **Permissionless publishing preserved** — the gate is signature authenticity, not author authorization; a validly-signed event from any pubkey still publishes.

## 2. Epics & stories rolled up

### Epic: `event-authenticity`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 verify-client-published-event-signatures | `verifyEvent` at the client publish boundary (before import + brain-write); resilient nostr-tools require | Done | `reviews/event-authenticity/1-verify-client-published-event-signatures.md` (PASS) |

**Epic close-out:** the `event-authenticity` epic is marked **Done** (its only story shipped, branch merged to `main`). Its folders are **left in place**, not moved under `done/` — lint-neutral (L2 checks Status, satisfied), and consistent with the prior book's close. **F3/F4/F5 will be a *separate* future epic/book, not a reopening of this Done epic** — reopening a Done epic under a Closed book trips harness-lint L2 (OPEN.md row 268, learned last book). The epic file was edited at close to say so.

## 3. As-built inventory

- **User-facing / API:** `POST /api/strfry/publish` `signAs:'client'` path rejects a signature-invalid event with `400 {success:false, error:'Event signature verification failed'}`; valid events unchanged. No UI change.
- **Server:** `src/api/strfry/commands/publishEvent.js` — one verification block in the client branch (`verifyEvent` on a JSON round-trip via the file's `getNostrTools()`); `getNostrTools()` made resilient (absolute in-container path → bare `require('nostr-tools')` fallback).
- **Domain:** no concepts touched; no firmware reinstall.
- **Data & contracts:** no new event kinds/routes; publish response shape unchanged for valid events.

## 4. Deviations from intent

| # | Specified (frame) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | "verification is app-level, not relay-reliant" | Confirmed: `strfry import` exits 0 even when it rejects a bad-sig event, so the app-level check is load-bearing | constraint-confirmed | ADR 0001 §Context (empirical probe) | none (the fix is exactly app-level) | — |
| 2 | (implicit) the nostr-tools loader | `getNostrTools()` was absolute-path-only (container); made resilient so CI/other envs work too | added-beyond-minimal (necessary) | CI stack-free failure at the staging PR (review addendum) | none in prod; fixes CI + latent assistant-path fragility | — |
| 3 | "sandboxes to follow" was NOT in this frame | prod + staging only | — | frame scoped to F1 fix; sandbox propagation was deferred separately by the operator | sandboxes still run the vulnerable publish path | propagate `staging` → sandbox branches |

**Undocumented work:** none — the diff maps to story 1 (+ the CI-compat follow-up `6c605780`, recorded in the review addendum).

## 5. Quality state at close

- **Test gate:** story suite `publish-event-signature-verification` 5/0; siblings `close-unauth` 14/0, `default-deny` 14/0, `login-signature-verification` 13/0; harness-lint clean. CI `stack-free` green on the promotion (#647) after the resilient-require fix.
- **Live verification:** staging + prod smoke — forged client publish rejected (`400`, "Event signature verification failed"); validly-signed throwaway event published (`200`); sanity + regression green (one Neo4j warm-up 500 on `concept-graph/summaries`, 200 on retry — unrelated to the diff).
- **Accepted / deferred:** the `success:true`-on-relay-rejection reporting (non-signature rejects: dup/writePolicy) is a pre-existing publish-reporting issue, explicitly out of scope (ADR 0001 §Consequences).
- **Debt:** none new (the resilient require removed a latent fragility).

## 6. Carry-forward register

- [ ] **F3:** io-import path ingesting events with `--no-verify` (+ its Cypher injection). — its own future epic/book.
- [ ] **F4:** `trusted-list/publish` missing an auth gate; **F5:** the POST-only owner-gate class. — authorization track (relates to the 2026-07-21 authenticated-non-owner intake), not this authenticity epic.
- [ ] **Sandbox propagation:** merge `staging` → `feat/tags`, `feat/communities`, `feature-magic-carpet`, `feat/curate` (still expose the pre-fix publish path).
- [ ] Update the private security advisory: **F1 can now be marked fixed** (shipped to prod 2026-09-11); F2 substantially closed; F3–F5 open.
- [ ] (Deferred, ADR 0001 §Out of scope) the publish-reporting `success:true`-on-relay-rejection honesty issue.

## 7. Process findings (harness)

| Finding | Source | Terminal state |
|---|---|---|
| The Reviewer ran the suite **only in-container**, which masked a container-only absolute-path assumption in `getNostrTools()`; the CI `stack-free` job caught it at the *staging PR* (not the prod gate). Lesson: the Reviewer must run the **stack-free** gate (`npm test` with Docker down, or the CI job), not only the in-container suite, or container-only path assumptions slip past Review. | This book (review addendum; #646 CI failure) | **OPEN.md row 271** (meta) |
| The row 256/268 "wait for required checks CLEAN before merging" fix **worked**: the `stack-free` failure was caught and fixed *before* any merge to staging — the previous book only caught the analogous issue at the prod gate. | This book (staging PR #646) | **no action — positive confirmation** recorded here (the fix is doing its job) |
| `git push` stalled in the osxkeychain helper again; the **reset** form (`git -c credential.helper= -c credential.helper='!gh auth git-credential' push`) works where the memory note's *append* form lets osxkeychain hang first. | This book (two stalled pushes) | **declined as a harness change** — it's a local credential-helper quirk, not a harness-flow defect; refined in agent memory `git-push-keychain-hang` instead. |

*(`scripts/harness-stats.sh` at retro: this book adds one story with full 5-phase cycle-time coverage — story/adr/test/impl/review commits all carry the `(event-authenticity #1)` reference the stats matcher keys on, plus the `fix:` CI-compat follow-up.)*
