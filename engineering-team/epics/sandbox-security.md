# Epic: sandbox-security

**Created:** 2026-09-12
**Status:** Active

## Goal

**Every sandbox droplet still in use enforces the same security protections as production.** A sandbox is a teammate's live, internet-facing instance running the same code paths as production. When it lags production's security fixes, it is an open door into its own graph, keys and relay — whatever the fix history of `staging` and `main` says.

## Why it matters

Production's July 2026 (`security-auth-exposure` #1–#2) and September 2026 (`security-auth-exposure` #3, `event-authenticity` #1) fixes reached `staging` and `main`, and — the July set only — `feat/tags`. `feature-magic-carpet` forked from `staging` on 2026-04-23 and has taken none of them (Matthias independently closed forged-signature login there on 2026-06-24). `feat/tags` lacks the September pair. Each sandbox deploys its own branch head, so the gap is live on both hosts.

## Stories

1. `stories/sandbox-security/1-magic-carpet-security-parity.md` — magic-carpet gets production's July and September hardening. **Draft.**
2. `stories/sandbox-security/2-tags-security-parity.md` — tags gets production's September hardening. **Draft.**

## Key facts / guardrails

- **Parity, not new behavior.** Every behavior here is already specified and reviewed in `security-auth-exposure` #1–#3 and `event-authenticity` #1. Both epics are Done with Closed books, so this work opens its own epic rather than reopening them (harness-lint L2, OPEN.md row 268).
- **Targeted port, not a staging merge** (operator, 2026-09-12). A full sync of either sandbox is separate, later work.
- **Don't disturb the sandboxes' own features** — Matthias's bounty and receiving flows on magic-carpet; context-scoped pins and the other tags-only work on tags.
- **Public-repo discipline.** The repo is public. Text that describes an exposure — story background, PR bodies, commit messages — is not pushed until that host's fix is deployed.
- **Out of this epic:** the retired `feat/communities` / `feat/curate` sandboxes (droplets deleted early September 2026; doc-lane pass); F3–F5 and the private advisory (OPEN.md row 276); the authenticated-non-owner admin-mutation gap (`_intake.md` 2026-07-21 — production has it too); the backend-port firewall (OPEN.md row 66).

## Decisions
- (none yet)
