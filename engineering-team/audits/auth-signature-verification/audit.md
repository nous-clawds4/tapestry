# Build Audit: Login signature verification (auth-bypass fix)

**Book:** `engineering-team/audits/auth-signature-verification/book.md`
**Date:** 2026-09-11
**Branch / commit range:** `security/login-signature-verification` (`d4fa7aa3`..`aaba5d9f`) — merged to `staging` via #634 (`bd591bd3`) + L2 fix #636 (`31698082`), promoted to `main` via #635 (`5e699297`)
**Provenance:** Acceptance-frame (no PRD)
**Confidence:** high — shipped to staging + prod and verified end-to-end on both (live login round-trip: bogus-sig rejected, valid-sig authenticated with session rotation).

> As-built record for the book that closed the control-panel authentication bypass. One story (security-auth-exposure #3) realized the whole acceptance frame.

## 1. What shipped

- **Login now requires a cryptographically verified signed challenge** — knowledge of a public key no longer yields a session. — `stories/security-auth-exposure/3-login-signature-verification.md`
- **Identity is established only on a verified login** — the verify handlers stash a *pending* claim (`session.pendingAuth`), not `session.pubkey`; a bare challenge request grants nothing.
- **Challenge is single-use** — consumed on every login attempt (success or failure); replays are rejected.
- **Session regenerated on login** (session-fixation defense); reduced to a minimal `{authenticated, pubkey}` shape.
- **Client `nsec` is never stored server-side**; the paste-your-nsec sign-in page (`sign-in-with-nsec.html`) is retired.
- Bundled alongside (separate authorship): **#633** dev/config hotfix (`config.js` bash `source` fallback; `dev-refresh.sh` supervisor-program guard).

## 2. Epics & stories rolled up

### Epic: `security-auth-exposure`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #3 login-signature-verification | Verified signed challenge + reframe + single-use + regenerate + nsec removal + page retirement | Done | `reviews/security-auth-exposure/3-login-signature-verification.md` (PASS) |

*(Stories #1–#2 belong to the prior, Closed `security-auth-exposure` book; not re-audited here.)*

**Epic close-out:** the `security-auth-exposure` epic is `Done` (all three stories Done, branch merged to `main`). Its story/decision/review folders are **left in place, not moved under `done/`** — matching the state the prior (2026-07-20) close left stories #1–#2 in, and avoiding path churn immediately post-ship. Lint-neutral: L2 checks epic *Status* (Done ✓), not folder location. A future move to `done/` is a tidy-up, not a correctness gap.

## 3. As-built inventory

- **User-facing:** `POST /api/auth/login` and `POST /api/auth/login-user` now verify the signed event; `POST /api/auth/verify` and `verify-user` no longer set session identity; `sign-in-with-nsec.html` removed (404). No React/`ui/src` change (the app already sent real NIP-07 signatures).
- **Server:** `src/middleware/auth.js` — new `verifyLoginEvent()` (kind allowlist `{22242, 27235}`, pubkey-binding, `created_at` ±600 s, `verifyEvent` on a JSON round-trip) + `finalizeAuthenticatedSession()` (regenerate → set identity → save). No new dependency (`nostr-tools` already present).
- **Session shape:** added `session.pendingAuth = {pubkey, challenge}`; removed writes of `session.nsec`, `session.userPubkey`, `session.isOwner`, `session.isCustomer`.
- **Domain:** no concepts touched; no firmware reinstall.
- **Data & contracts:** kind 22242 / 27235 auth events; response shapes unchanged.

## 4. Deviations from intent

| # | Specified (frame) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | "reject … replayed challenges; challenges single-use" | Also **broke the NIP-85 kind-10040 publish page** (`nip85-control-panel.html`), which reused the login `session.challenge` | constraint-discovered | single-use is incompatible with challenge reuse (ADR 0003 Consequences) | Owner-only legacy publish page returns 400; CLI path unaffected | **F6** — give kind10040 its own challenge |
| 2 | frame bullet 1 (bypass closed) | Closed at login; reframe also **removes the pre-auth `session.pubkey`** the audit's F2 relied on | intentional-change (positive side effect) | ADR 0003 Consequences | F2's unauthenticated exposure substantially closed as a side effect | F2 per-consumer `authenticated` checks still a defense-in-depth follow-up |
| 3 | kind check (story implied 22242) | Accepts `{22242, 27235}` | interpretation | legacy pages sign 27235 (ADR 0003 sub-decision 1) | none | consolidate clients on 22242 (deferred) |
| 4 | "sandboxes to follow" | Prod + staging only | deferred | frame explicitly deferred sandboxes | `tags`/`communities`/`magic-carpet`/`curate` still run the vulnerable login | propagate `staging` → sandbox branches |

**Undocumented work:** none — the diff maps entirely to story #3 (+ the bundled #633, authored separately and traced in OPEN.md row 258).

## 5. Quality state at close

- **Test gate:** story suite `login-signature-verification` **13/0** in CI (`stack-free`); siblings `close-unauth` 14/0, `default-deny` 14/0; harness-lint **clean (0 violations)** after the L2 fix. CI `stack-free` green on the promotion (#635).
- **Live verification:** staging + prod smoke — bogus-sig login rejected (400, `authenticated:false`); valid signed login authenticated with session-cookie rotation; nsec page 404; sanity + regression 200.
- **Accepted / deferred issues:** kind10040 publish regression (§4 #1 → F6); deferred audit findings **F1** (strfry/publish forgery — **still live on prod**), **F2** (substantially mitigated), **F3–F5**, held in a private security advisory (not in public repo text while unpatched).
- **Debt:** async login handlers; kind allowlist rather than single kind; two dead session fields dropped.

## 6. Carry-forward register

- [ ] **F1 (Critical, live):** `POST /api/strfry/publish` writes forged events into Neo4j from a claimed pubkey without `verifyEvent`. (private advisory)
- [ ] **F2:** per-consumer `authenticated` checks (defense-in-depth; the exploitable path is closed by this book's reframe). (private advisory)
- [ ] **F3–F5:** io-import `--no-verify` + Cypher injection; `trusted-list/publish` missing `requireAuth`; POST-only owner gate. (private advisory)
- [ ] **F6:** decouple kind10040's challenge from login so the NIP-85 publish page works again (§4 #1).
- [ ] **Sandbox propagation:** merge `staging` → `feat/tags`, `feat/communities`, `feature-magic-carpet`, `feat/curate` (still expose the bypass).
- [ ] File the private GitHub Security Advisory (F1–F6) per SECURITY.md.
- [ ] (Deferred) consolidate auth clients on kind 22242; unify the two login endpoints; remove the dead `session.nsec` write in `kind10040.js`.

## 7. Process findings (harness)

| Finding | Source | Terminal state |
|---|---|---|
| Reusing a **Done epic under a Closed book** for new work trips harness-lint **L2** (closed book ⇒ listed epics Done). Reopening the epic Status was the wrong lever — active work is signalled by a new *open book*, not a reopened epic. Model: new open book (keep epic Done) or a new epic. Cost real: it failed the prod `stack-free` gate and required a fix PR (#636) mid-promotion. | This book (epic-reopen at Planning; caught at the #635 prod gate) | **OPEN.md row 268** (meta) |
| `/cycle-staging` merges on the **deploy-safety** check, not the PR's **CI** checks, so a genuinely *failing* `stack-free` (the L2 violation) rode onto `staging` via #634 and was only caught at the `main` branch-protection gate. Same skill-family gap as the already-filed cycle-prod timing issue. | This book (#634 merged CI-red; #635 BLOCKED at prod) | **OPEN.md row 256** extended (meta) — corroborated + staging-side facet added |
| Reviewer wrote the story review before the L2 issue surfaced (it emerged only at deploy, post-review); harness-lint isn't run at the Review gate. Minor — the prod gate caught it. | This book (review PASS preceded the L2 discovery) | **declined** — no change; running full harness-lint at every per-story Review gate is disproportionate, and the CI `stack-free` job + main branch protection already backstop it. Recorded for the pattern. |

*(`scripts/harness-stats.sh` at retro time: this book adds one story to the security-auth-exposure epic with full 5-phase cycle-time coverage — story/adr/test/impl/review commits all carry the `(<epic> #<n>)` reference the stats matcher keys on.)*
