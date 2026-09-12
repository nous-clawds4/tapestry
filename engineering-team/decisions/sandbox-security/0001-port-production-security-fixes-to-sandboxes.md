# ADR 0001: Port production security fixes to the in-use sandboxes

**Status:** Proposed
**Date:** 2026-09-12
**Story:** `engineering-team/stories/sandbox-security/1-magic-carpet-security-parity.md`, `engineering-team/stories/sandbox-security/2-tags-security-parity.md`

## Context

Two sandbox droplets are still in use — `magic-carpet.brainstorm.world` (branch `feature-magic-carpet`) and `tags.brainstorm.world` (branch `feat/tags`) — and both lag production's ratified security fixes. Each sandbox deploys its own branch head on push, so the gap is live on the hosts.

The fixes themselves are **already designed, reviewed, and shipped** on `staging` + `main`. This ADR does not re-derive them; it decides *how to bring them to two branches that diverged before they landed*. The source decisions are:

- `security-auth-exposure/0001` — honest-local bypass (proxied traffic is remote) + Neo4j write-Cypher gate; removal of the credential-leaking legacy query-by-URL endpoint.
- `security-auth-exposure/0002` — default-deny for unauthenticated mutations (an explicit public-mutation allowlist replaces a hand-maintained write-endpoint allowlist).
- `security-auth-exposure/0003` — login-challenge signature verification: identity is established only on a verified login, challenges are single-use and time-bounded, and pasted private keys are no longer accepted (the paste-your-key sign-in page is retired).
- `event-authenticity/0001` — client-published events are signature-verified for their claimed author before any relay/graph/store write.

**Constraints:**

- **The branches lag and diverge.** `feature-magic-carpet` forked on 2026-04-23 (2,439 commits behind `staging`); its auth middleware, login handlers, and publish path are all older than the fixes and diverge from them, so several fixes do **not** cherry-pick cleanly and must be ported by hand. `feat/tags` is 903 behind but already carries the July fixes (`0001`/`0002`); it needs only the September pair (`0003` + `event-authenticity/0001`), whose login handler is at the pre-fix shape.
- **`feature-magic-carpet` also carries an independent login-signature fix** (`63137ba5`, Matthias, 2026-06-24) that verifies the challenge signature. Production `0003` is a strict superset (it adds identity-only-after-login, single-use/freshness, no pasted keys), so porting `0003` subsumes it — but the port must land on top of Matthias's restructured handlers without regressing them or his bounty/receiving flows.
- **The code bases differ per sandbox**, so there is no single diff that fixes both.
- **Targeted port, not a staging merge** (operator, 2026-09-12): a full sync of either sandbox is separate, later work.
- **Public repo.** That the sandboxes lag is already public (OPEN.md row 276); the specific per-host attack mechanisms are not and stay out of committed text (book/story/ADR keep parity-level framing). See the book's push discipline.
- **No concepts.** Both stories touch the instance's auth/authorization/publish boundary, not the Concept Graph — no concept orientation, no firmware reinstall.

No gate history is recorded here.

## Options considered

### Option A — Port the ratified fixes onto each sandbox branch, tests-first (chosen)

Treat each sandbox as its own small fix effort. For each host, bring exactly the missing ratified behaviors to parity: where a reference commit applies cleanly, apply it; where the branch has diverged, port the *behavior* onto the branch's own code, using the source ADR + commit as the specification. Port the corresponding already-existing test suites from `staging` first (they fail against the unfixed branch), then make them pass.

- **Pros:** minimal blast radius — only the security surface changes; each fix is a known-good, already-reviewed behavior; the sandboxes' own features are untouched; the failing-tests-first contract is satisfied by reusing staging's suites as the oracle.
- **Cons:** the ports are hand-merges onto diverged code (for magic-carpet's default-deny and login), so they need genuine review rather than a rubber-stamp of a cherry-pick; each sandbox's `test/test.js` registry diverges from staging's and must be wired locally (a known future-sync conflict, OPEN.md row 195).

### Option B — Full `staging` → sandbox merge

Merge `staging` into each sandbox to inherit everything at once.

- **Pros:** the sandbox ends fully current; no per-fix porting.
- **Cons:** 2,439 / 903 commits with 13- and 8-file conflicts (including `auth.js`, `publishEvent.js`, `package.json`); drags five months of unrelated platform change into a teammate's live sandbox in one step; far larger review surface for a security-only goal. **Rejected** by operator decision (2026-09-12) and on blast-radius grounds.

### Option C — One shared fix branch for both sandboxes

Author the fix once and apply to both hosts.

- **Cons:** the two sandboxes' code bases differ (one already has the July fixes, the other has none, and both diverge from staging and each other), so no single diff applies to both. **Rejected** as infeasible.

## Decision

We chose **Option A**. Each sandbox is brought to security parity by porting the already-ratified behaviors, tests-first, on its own branch based on that sandbox; the harness record lives on a `staging`-based branch. Specifically:

**Branch strategy** (reconciling OPEN.md row 140 — never commit phase work on `staging`/`main` — and row 195 — sandbox `test/test.js` divergence):

1. **`feat/sandbox-security`** (off `staging`, already holds `d5f1cacc`) is the canonical **harness record**: the stories, epic, book, this ADR, both test plans, both reviews. It changes **no source** (staging already has every fix). It merges to `staging` via PR as the durable record that the port happened.
2. **`fix/mc-security-parity`** (off `feature-magic-carpet`) carries magic-carpet's **code + ported test suites + its wiring into magic-carpet's own `test/test.js`**. PR → `feature-magic-carpet` deploys the host. Kept **local until deploy-ready** (public-repo disclosure discipline).
3. **`fix/tags-security-parity`** (off `feat/tags`) carries tags' code + ported test suites + tags' registry wiring. PR → `feat/tags` deploys the host; run `scripts/check-safe-to-merge.sh https://tags.brainstorm.world` immediately before merge (docs/SAFE_TO_MERGE.md). tags has a deploy-safety endpoint; magic-carpet does not (its merge has no such gate).

The record branch and the code branches are deliberately separate because the fixes already exist on `staging` (nothing to author there) while the code must live on the lagging sandbox lines. The record reaches `staging` promptly via (1); the code reaches the hosts via (2)/(3); the two reconcile whenever a sandbox next syncs to `staging`.

## Consequences

- **Enables:** both in-use hosts reach the same auth/authorization/publish protections as production, verified on the live hosts.
- **Constrains / harder:** magic-carpet's default-deny and login ports are hand-merges onto diverged middleware — the Reviewer must audit them as real ports, not cherry-picks, and confirm no regression to Matthias's login-signature fix or his bounty/receiving flows. Default-deny changes the response for magic-carpet's whole unauthenticated-mutation surface (many routes there gate only through the middleware), so the regression check must cover that the owner's own flows still work.
- **Debt / follow-ups:** each sandbox's `test/test.js` diverges further from staging's (row 195) — a future `staging` sync will conflict there; resolve by taking staging's superset. The harness record (this ADR etc.) lives on `staging` while the code lives on the sandboxes until they sync. The security.txt ownership-list edit is also being made on `staging`/`main` by a separate doc-lane pass (decommissioning `feat/communities`/`feat/curate`); the ESTATE list must end identical everywhere. magic-carpet's Neo4j password rotation is an operator task after deploy (book companion). The authenticated-non-owner admin-mutation gap (intake 2026-07-21) is **not** closed here — production has it too.
- **Firmware reinstall required?** No — no concept definitions change.

## Implementation notes

The Implementer ports **behavior** to match the cited source ADRs/commits; where a branch has diverged, the source commit is the specification, not a `git cherry-pick` to force through. Verify each ported behavior against the source ADR's acceptance criteria.

**Test changes are the Tester's lane (Phase 3), not implementation.** The ratified test suites already exist on `staging` (`test/login-signature-verification.test.js`, `test/publish-event-signature-verification.test.js`, `test/strfry-wipe-owner-gate.test.js`, `test/users-page-neo4j-endpoint.test.js`, plus the `0001`/`0002` write-surface suites). The Tester ports the relevant ones onto each fix branch and wires them into that sandbox's `test/test.js`, confirming they FAIL before the port — then Phase 4 makes them pass.

**magic-carpet (`fix/mc-security-parity` off `feature-magic-carpet`):**
- **Remove the legacy query-by-URL endpoint** and repoint the Users page to the POST query endpoint (per `security-auth-exposure/0001` + the users-page follow-up). Applies cleanly.
- **Honest-local bypass** — proxied/forwarded-loopback traffic counts as remote (per `0001`). Applies cleanly onto `src/middleware/auth.js`.
- **Default-deny for mutations** (per `0002`) — replace the middleware's old write-endpoint allowlist branch with the default-deny branch (`MUTATING` methods → 401 unless the exact path is in `PUBLIC_MUTATIONS = ['/api/neo4j/query','/api/strfry/publish']`; keep the protected-GET list). This is a **hand-port** onto magic-carpet's diverged `auth.js`; keep magic-carpet's authenticated-branch owner checks as-is. Confirm no magic-carpet route is intentionally anonymous-mutating beyond the two public paths (bounty/receiving are session-gated and stay working; the owner's flows stay working).
- **Login parity** (per `0003`) — port the pending-claim model: the claimed pubkey lives on a pending claim, never as session identity; identity (`session.pubkey`/`authenticated`) is set only on a verified login; challenges are single-use and time-bounded; the paste-your-key page is retired and no pasted key is stored. Land this **on top of** magic-carpet's existing signature check (`63137ba5`) — `0003` subsumes it; do not regress it.
- **Publish authenticity** (per `event-authenticity/0001`) — verify the signature of client-published events before the relay/graph/store write, in `src/api/strfry/commands/publishEvent.js`, with the resilient verifier-resolution used on staging.
- **Ownership list** — remove the two decommissioned sandboxes from the ESTATE list in `src/utils/siteTrust.js` (and its test).

**tags (`fix/tags-security-parity` off `feat/tags`):**
- **Login parity** (per `0003`) — same pending-claim port; tags' login handler is at the pre-fix shape, so this is the main change. Retire the paste-your-key page; stop storing pasted keys.
- **Publish authenticity** (per `event-authenticity/0001`) — same `publishEvent.js` change; applies cleanly.
- **Ownership list** — same ESTATE-list edit in `src/utils/siteTrust.js`.
- tags already has `0001`/`0002` (default-deny present, `PUBLIC_MUTATIONS` matches prod), so no write-surface work.

## Out of scope

- A full `staging` sync of either sandbox.
- F3–F5 and the private security advisory (OPEN.md row 276).
- The authenticated-non-owner admin-mutation gap (intake 2026-07-21) — present on production too.
- The internet-exposed backend-port firewall (OPEN.md row 66).
- magic-carpet's Neo4j password rotation (operator task after deploy).
- The `staging`/`main`/`SECURITY.md`/OPERATIONS doc-lane decommissioning pass for `feat/communities`/`feat/curate` — a separate change; this ADR only touches the sandboxes' own served ESTATE list.
