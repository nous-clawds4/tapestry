# Build Audit: Sandbox security parity

**Book:** `engineering-team/audits/sandbox-security/book.md`
**Date:** 2026-09-12
**Branch / commit range:** record on `staging` (PR #655, story/ADR/test-plan/review); code on the sandbox branches — `feature-magic-carpet` (PR #653, impl `f0dc38ce` + sweep `b6d74a81` + tests `9b7dc355`) and `feat/tags` (PR #654, impl `12db387b` + tests `b495654d`).
**Provenance:** Acceptance-frame (no PRD; frame confirmed in conversation 2026-09-12)
**Confidence:** high

> As-built record. What the two in-use sandboxes *are* now, source-linked. Does not propose changes — that's the seed's job.

## 1. What shipped

- **magic-carpet.brainstorm.world now enforces production's July + September security behavior** — `stories/sandbox-security/1-magic-carpet-security-parity.md`. Live-verified.
- **tags.brainstorm.world now enforces production's September security behavior** (it already had the July set) — `stories/sandbox-security/2-tags-security-parity.md`. Live-verified.
- Both hosts' published `security.txt` estate lists were trimmed to live hosts (the two decommissioned sandboxes dropped).

## 2. Epics & stories rolled up

### Epic: `sandbox-security`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 magic-carpet-security-parity | Ported run-query removal, honest-local (proxied=remote), default-deny mutations, write-Cypher gate, wipe owner-gate, login #3, publish-signature verification, nsec-page retirement, ESTATE trim | Done | `reviews/sandbox-security/1-magic-carpet-security-parity.md` (PASS) |
| #2 tags-security-parity | Ported login #3, publish-signature verification, nsec-page retirement, ESTATE trim (July fixes already present) | Done | `reviews/sandbox-security/2-tags-security-parity.md` (PASS) |

ADR: `decisions/sandbox-security/0001-port-production-security-fixes-to-sandboxes.md` (one ADR covers both stories: port the ratified prod fixes onto each lagging branch, tests-first; record on a staging-based branch, code on per-sandbox fix branches).

## 3. As-built inventory

**magic-carpet (`feature-magic-carpet`)** — 12 source files, +225/−538:
- `src/middleware/auth.js` (byte-identical to staging), `src/api/neo4j/queryPost.js`, `src/api/strfry/wipe.js` — wholesale from staging (had diverged only by the security gate).
- `src/api/strfry/commands/publishEvent.js` — resilient nostr-tools require + assistant-gate (`!isOwner && !localTrusted` → 403) + client-event `verifyEvent` before `strfry import`; no brain-write (branch lacks `tapestryBrainWrite`); MC's relay fan-out preserved.
- `src/api/index.js` + deleted `src/api/neo4j/runQuery.js` + `src/api/openapi.yaml` (block removed) — legacy `GET /api/neo4j/run-query` gone.
- `ui/src/pages/users/Index.jsx` — Users page POSTs `/api/neo4j/query`.
- `src/firmware/install.js` — internal bridge no longer forges `x-forwarded-for`; stale run-query comments reworded.
- `src/api/profiles/fetchProfiles.js` — requires made resilient (deviation, §4).
- `src/utils/siteTrust.js` — ESTATE trim; deleted `public/pages/sign-in-with-nsec.html`.
- Tests: `test/{close-unauth-write-surface,default-deny-mutations,login-signature-verification,publish-event-signature-verification,strfry-wipe-owner-gate,users-page-neo4j-endpoint}.test.js` ported + `site-trust-signals.test.js` U6c; wired into this branch's minimal `test/test.js`.

**tags (`feat/tags`)** — 4 source files, +134/−311:
- `src/middleware/auth.js` (byte-identical to staging — diverged only in the login region), `src/api/strfry/commands/publishEvent.js` (resilient require + client `verifyEvent`; assistant-gate already present), `src/utils/siteTrust.js` (ESTATE trim), deleted `public/pages/sign-in-with-nsec.html`.
- Tests: `test/{login-signature-verification,publish-event-signature-verification}.test.js` ported + `site-trust-signals.test.js` U6c; wired into the live half of the 134-suite runner's gating chain (before the OPEN.md-#43/#55 severed terminator).

- **Domain:** none — this book touches the instance auth/authorization/publish boundary, not the Concept Graph. No firmware reinstall.
- **Data & contracts:** no new event kinds, routes, or stored shapes; `GET /api/neo4j/run-query` removed on magic-carpet (tags removed it in July).

## 4. Deviations from intent

| # | Specified (frame) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | "port the ratified prod fixes" | magic-carpet's `publishEvent` uses a **resilient** nostr-tools require and keeps the branch's own relay fan-out; no brain-write | constraint-discovered | story 1 `## Deviations`; the branch is 2,439 commits behind and structurally older (no `tapestryBrainWrite`, absolute-only `getNostrTools`) | none (same authenticity behavior) | — |
| 2 | (implicit) fixes only on the auth/publish boundary | `src/api/profiles/fetchProfiles.js` requires made resilient (load-only) | added-beyond-scope (minimal) | story 1 `## Deviations`; MC's `publishEvent` imports it, and the ported suites couldn't load it off-container otherwise | none | — |
| 3 | "sandbox features still work" (frame) | verified **indirectly** — sites healthy (200) + Review suites no-regression; a real authed bounty (MC) / tag/pin (tags) flow was **not** driven at close | interpretation | operator elected to test the authed flows later (2026-09-12) | none observed | §6 — operator to confirm authed flows |
| 4 | (review non-blocking) full staging parity of removed-endpoint docs | magic-carpet `openapi.yaml` block + `install.js` comments (stale run-query) removed | intentional-change | reviews §Non-blocking; fixed in sweep `b6d74a81` | none | closed |

**Undocumented work:** none — every diff hunk traces to the ADR's implementation notes or a logged deviation.

## 5. Quality state at close

- **Test gate:** magic-carpet `node test/test.js` → **Overall: PASS** (7 security suites + bounty unit tests), re-run by the Reviewer stack-free. tags: the two new suites + the four July suites green stack-free (full 134-suite runner deferred to in-container/CI). The record branch (this close) carries no source change, so its stack-free suite is staging-equivalent.
- **Live verification (both hosts):** magic-carpet — run-query 404, write-gate 403, unauth mutation 401, ESTATE trimmed, nsec page retired, Neo4j read OK post-password-rotation (count 2847). tags — same class + July regression holds.
- **Known open / accepted:** the authed-feature-flow bullet is verified only indirectly (§4 #3). The authenticated-non-owner admin-mutation gap is deliberately out of scope (production has it too — `_intake.md` 2026-07-21).
- **Debt:** none new beyond the resilient-require deviations (§4), which are net hardening.

## 6. Carry-forward register

- [ ] **Operator: confirm authed feature flows** on both hardened sandboxes — a real bounty on magic-carpet, a tag/pin on tags (the one acceptance bullet verified only indirectly — §4 #3).
- [ ] **Operator: delete the `DEPLOY_*_COMMUNITIES` / `DEPLOY_*_CURATE` repo secrets** (decommission pass; noted in OPERATIONS §2).
- [ ] **Operator: add `feat/tags` to the live `restrict-deletions` ruleset** (GitHub settings — OPEN.md row 14).
- [ ] **`feat/tags` is far behind `staging`** (cherry-picks accumulating) — a real sync eventually conflicts (OPEN.md row 195; not this book's to fix).
- [ ] **Out of scope (production has them too):** F3–F5 + the private advisory (OPEN.md row 276 — now records sandbox-propagation DONE); the authenticated-non-owner admin-mutation gap.

## 7. Process findings (harness)

| Finding | Source | Terminal state |
|---|---|---|
| No deploy skill for the sandbox branches (`feat/tags`, `feature-magic-carpet`) — the merge + deploy-watch + smoke + (for tags) safe-to-merge check were all hand-rolled | this book (no `/cycle-sandbox`; SAFE_TO_MERGE.md documents the manual tags flow but no skill) | OPEN.md row (new — enhancement) |
| Security fix to a **public** deploy branch discloses the live vuln the moment the PR opens; the book relied on ad-hoc push-discipline + per-decision operator calls, with no documented sequencing rule | this book (the magic-carpet RCE disclosure window discussion) | OPEN.md row (new — meta) |
| `git push` over HTTPS stalled in the osxkeychain helper; fixed by `gh auth setup-git` (gh as credential helper) | this session | declined (environmental; already in agent memory `git-push-keychain-hang` — updated with the `gh auth setup-git` fix; not a harness-definition change) |
| zsh `:t` modifier mangles an unbraced `$b:path` in `git show origin/$b:file` | this session | existing OPEN.md row 237 (no new row) |
| `scripts/check-safe-to-merge.sh` buffers its journal when backgrounded (output redirected), hiding per-attempt progress until exit; read the endpoint directly for the live verdict | this session | declined (the script functioned correctly and exited on the safe verdict; buffering is cosmetic) |

Measurement: `scripts/harness-stats.sh` at close shows `sandbox-security` with 4 record-branch phase commits (impl commits live on the sandbox branches, so are not epic-name-matched); the per-story cycle ran clean (2 stories, both PASS first pass).
