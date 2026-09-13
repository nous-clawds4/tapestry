# PRD Seed: Sandbox security parity

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/sandbox-security/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high
**Date:** 2026-09-12

> Reverse-engineered baseline in PRD shape. This book was **operational security**, not a user-facing product feature — the "product" is an *invariant about the fleet*, so this seed reads more like an ops policy than a user PRD. A strawman for the product/ops owner; each section tagged `[FROM FRAME]` / `[INFERRED]` / `[UNKNOWN]`.

## 1. Product vision
`[FROM FRAME]` Every sandbox deployment still in use must enforce the same security protections as production. A sandbox is a teammate's live, internet-facing instance running the same code paths as production; when it lags production's security fixes it is an open door into its own graph, keys, and relay. `[INFERRED]` The underlying opportunity: the fleet's security posture is only as strong as its weakest live host, and long-lived sandbox branches drift behind `staging`/`main` between rare syncs.

## 2. Personas
`[INFERRED]`
- **Fleet operator** (Virgil) — owns the estate; needs every live host at parity and needs the disclosure window minimized when fixing a public repo.
- **Sandbox owner** (Matthias / magic-carpet; the tagging work / tags) — runs a live instance for their feature work; must keep their own features working while inheriting security fixes.
- **External observer / attacker** — can read the public repo and probe the live hosts; a fix PR on a public repo is itself a disclosure signal.

## 3. Scope (as-built)
`[FROM FRAME]` / `[INFERRED]`
- **In scope (delivered):** port production's ratified security fixes (`security-auth-exposure` #1–#3, `event-authenticity` #1) onto the two in-use sandboxes; trim decommissioned hosts from the published estate lists; verify live.
- **Explicitly out (production carries them too):** F3–F5 auth-hardening + the private advisory; the authenticated-non-owner admin-mutation gap; the backend-port firewall.
- **Method:** targeted port (not a full `staging` merge); tests-first from the already-ratified suites; record on a staging-based branch, code on per-sandbox fix branches; nothing describing an unpatched exposure public before the fix deploys.

## 4. Domain model
`[INFERRED]` None in the Concept Graph sense. The domain here is the *deploy fleet*: long-lived branches ↔ droplets ↔ deploy workflows (OPERATIONS §1), and the instance auth/authorization/publish boundary (`src/middleware/auth.js`, `queryPost.js`, `strfry/commands/publishEvent.js`, `strfry/wipe.js`).

## 5. Design rules (as-built)
`[INFERRED]`
- Sandbox security fixes are **parity ports**, not re-derivations — the source ADR/commit is the spec; where a lagging branch has diverged, port the *behavior* by hand and verify against the ratified suite.
- **Public-repo disclosure discipline:** a security fix's PR diff reveals what the live host lacks. Keep the fix branch local until deploy-ready; when it must go public, sequence merge+deploy to minimize the window. `[UNKNOWN — product/ops input]` whether to formalize this as a documented rule (see §7).
- **No deploy skill for sandboxes today** — merge/deploy/smoke is manual (see §7).

## 6. Carry-forward & open questions
Promoted from audit §6:
- Operator to confirm authed feature flows on both hardened sandboxes.
- Operator to delete the `DEPLOY_*_COMMUNITIES`/`DEPLOY_*_CURATE` secrets and add `feat/tags` to `restrict-deletions` (GitHub settings).
- `feat/tags` drift vs `staging` (OPEN.md #195).
- The deferred auth track (F3–F5, advisory) and the authenticated-non-owner gap — fleet-wide, not sandbox-specific.

## 7. What product / ops must validate
- [ ] Should a **`/cycle-sandbox`** skill (or an extension of the cycle skills) exist for `feat/tags` + `feature-magic-carpet` deploys, incl. the tags safe-to-merge gate? (audit §7)
- [ ] Should the **public-repo security-fix disclosure sequencing** become a documented rule (SECURITY.md / a workflow note), rather than per-decision operator judgment? (audit §7)
- [ ] Is "sandbox features still work" acceptably covered by health + no-regression suites, or must an authed flow be part of every sandbox-parity close? (audit §4 #3)
- [ ] Cadence: should sandboxes be synced to `staging` on a schedule so security drift can't reopen this gap, rather than porting fix-by-fix? (the root cause behind this whole book)
