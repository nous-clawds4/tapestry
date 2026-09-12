# Story 1: magic-carpet runs production's security hardening

**Status:** Draft
**Created:** 2026-09-12
**Type:** Bug

## Background

magic-carpet.brainstorm.world is Matthias's live sandbox for the bounty system. Its branch, `feature-magic-carpet`, forked from `staging` on 2026-04-23 and deploys its own head on every push. Since then production closed two families of exposure, and neither reached this branch:

- **July 2026** — `security-auth-exposure` #1 and #2, plus the hardening shipped alongside them (OPERATIONS §9.10): a legacy query endpoint that could leak the database password and run server commands was removed; requests forwarded by the host's web server stopped counting as coming from the machine itself; unauthenticated state-changing requests became refused by default; wiping the relay store became owner-only.
- **September 2026** — `event-authenticity` #1: events published through the instance must carry a valid signature for the author they claim.

Matthias independently closed forged-signature login on this branch (2026-06-24). Production's September login fix (`security-auth-exposure` #3) goes further — see open question 1.

The operator chose a **targeted port**: bring these protections to magic-carpet without merging the rest of `staging` into it (2026-09-12).

## User-facing description

As the operator of the Brainstorm fleet, I want magic-carpet to enforce the same protections as production, so that a teammate's sandbox can't be used to read the database password, run commands, rewrite the graph, forge events, or act as another user.

## Acceptance criteria

Testable from outside — against the deployed host, and by the same checks in the branch's own test suite.

- [ ] **No credential-leaking query endpoint.** Given the deployed host, when the legacy query-by-URL endpoint is requested, then it is not found, and no response from the host contains the database password.
- [ ] **Write surface closed (parity with `security-auth-exposure` #1 and #2).** Given a caller without a signed-in session, when it sends any state-changing request whose path is not on a documented public allowlist, then it is refused (401/403) and nothing changes. Requests forwarded by the host's web server, or carrying a spoofed loopback forwarding header, count as remote. The owner's own flows, the public read endpoints, and firmware install keep working.
- [ ] **Relay wipe is owner-only.** Given a signed-in user who is not the owner, when they try to wipe the relay store, then it is refused, and the controls for it are not shown to them.
- [ ] **No owner powers without a verified login.** Given a caller without a completed, verified owner session, when they attempt an owner-only action such as adding an administrator, then it is refused. (Closed by the default-deny port and/or the login-parity change; see open question 1.)
- [ ] **Published events are authentic (parity with `event-authenticity` #1).** Given an event whose signature is not valid for the author it claims, when it is published through the instance, then it is refused and reaches none of the relay, the graph, or the tapestry store. A validly signed event from any pubkey still publishes. A forged event reusing an existing element's identity cannot delete or overwrite the genuine element.
- [ ] **Login stays authentic.** Given a login attempt whose signature is not valid for the claimed key, then it is refused — true today, and it must stay true. Further login criteria depend on open question 1.
- [ ] **magic-carpet's own features still work.** The Users page still lists users. A signed-in user can still create a bounty and use receiving setup. Unauthenticated bounty and receiving actions are still refused.
- [ ] **Ownership list is current.** The host's published ownership list (security.txt) names only hosts that are live, so the two decommissioned sandboxes no longer appear.
- [ ] **Shipped and verified.** Deployed to magic-carpet.brainstorm.world, with each criterion above confirmed against the live host by non-destructive checks. Public-facing text (commits, PR) stays minimal until the deploy is live.

## Concepts touched

None. This story concerns the instance's authentication, authorization and publish boundaries, not domain concepts in the Concept Graph.

## Out of scope

- Merging `staging` wholesale into `feature-magic-carpet` (operator decision, 2026-09-12). A full sync is later work, coordinated with Matthias.
- Any change to the bounty system's behavior.
- The authenticated-non-owner admin-mutation gap (`_intake.md` 2026-07-21) — production has it too.
- F3–F5 and the private advisory (OPEN.md row 276).
- The backend-port firewall (OPEN.md row 66).
- Rotating magic-carpet's database password — an operator companion task in book `sandbox-security`, done once this story is live.
- Any further production security fix the Architect finds missing from this branch: the ADR lists it, and the Architecture gate decides in or out.

## Open questions

1. **How far does magic-carpet's login go?** — resolved 2026-09-12: **full production parity.** Matthias's fix rejects forged signatures but guards only the login step itself; production's login fix (`security-auth-exposure` #3) also (a) confers no identity until a verified login completes, (b) makes each challenge single-use and time-bound, and (c) stops accepting or storing a pasted private key and retires the paste-your-key sign-in page. All of (a)–(c) are in scope; the Architect ports them onto this branch's diverged middleware (the exact call-site detail is in the planning-session analysis, kept out of committed text per the book's push discipline).
2. ~~Ownership list~~ — resolved 2026-09-12: yes, fold it in (now criterion 7).

## Linked artifacts
- ADR: `engineering-team/decisions/sandbox-security/0001-port-production-security-fixes-to-sandboxes.md`
- Test plan: `engineering-team/stories/sandbox-security/1-magic-carpet-security-parity.test-plan.md`
- Review: (filled in after Review phase)

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
