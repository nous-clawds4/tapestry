# Story 2: tags runs production's September security hardening

**Status:** Done
**Created:** 2026-09-12
**Type:** Bug

## Background

tags.brainstorm.world is the live sandbox for the tagging feature work. Its branch, `feat/tags`, deploys its own head on every push. It took production's July 2026 hardening (`security-auth-exposure` #1 and #2 and the fixes shipped alongside them) as cherry-picks, but not the two September 2026 fixes that reached production on 2026-09-11:

- **Login authenticity** — `security-auth-exposure` #3: a login is accepted only with a fresh, single-use challenge signed by the claimed key; requesting a challenge confers no identity; the server never accepts or stores a pasted private key.
- **Publish authenticity** — `event-authenticity` #1: events published through the instance must carry a valid signature for the author they claim.

`feat/tags` is 903 commits behind `staging`. A full sync is overdue but separate work (OPEN.md rows 73 and 195); this story brings only the September fixes.

## User-facing description

As the operator of the Brainstorm fleet, I want tags to enforce production's login and publish protections, so that no one can sign in to it as another user or publish events in someone else's name.

## Acceptance criteria

Testable from outside — against the deployed host, and by the same checks in the branch's own test suite.

- [ ] **Login authenticity (parity with `security-auth-exposure` #3).** Given a login attempt with an invalid signature (including an all-zeros signature), a stale or far-future timestamp, an already-used challenge, or the wrong event kind, then the login fails. A caller who has only requested a challenge has no identity: status reports them signed out, and they can do nothing a signed-in user can. A validly signed, fresh login still works, including the app's normal sign-in.
- [ ] **No pasted private keys.** No login path accepts or stores a pasted private key, and the paste-your-key sign-in page is gone.
- [ ] **Published events are authentic (parity with `event-authenticity` #1).** Given an event whose signature is not valid for the author it claims, when it is published through the instance, then it is refused and reaches none of the relay, the graph, or the tapestry store. A validly signed event from any pubkey still publishes. A forged event reusing an existing element's identity cannot delete or overwrite the genuine element.
- [ ] **tags' own features still work.** A signed-in user can still tag, pin, and use the tags-only features (context-scoped pins, the bounded Simple Lists pages).
- [ ] **Ownership list is current.** The host's published ownership list (security.txt) names only hosts that are live, so the two decommissioned sandboxes no longer appear.
- [ ] **Shipped and verified.** The pre-merge safe-to-merge check against tags.brainstorm.world passes, or the operator records a decision to proceed (docs/SAFE_TO_MERGE.md). The fix deploys, and each criterion above is confirmed against the live host by non-destructive checks. Public-facing text stays minimal until the deploy is live.

## Concepts touched

None. This story concerns the instance's login and publish boundaries, not domain concepts in the Concept Graph.

## Out of scope

- A full `staging` → `feat/tags` sync (OPEN.md rows 73 and 195).
- The authenticated-non-owner admin-mutation gap (`_intake.md` 2026-07-21) — production has it too.
- F3–F5 and the private advisory (OPEN.md row 276).
- The backend-port firewall (OPEN.md row 66).

## Open questions

1. ~~Ownership list~~ — resolved 2026-09-12: yes, fold it in (now criterion 5).

## Linked artifacts
- ADR: `engineering-team/decisions/sandbox-security/0001-port-production-security-fixes-to-sandboxes.md`
- Test plan: `engineering-team/stories/sandbox-security/2-tags-security-parity.test-plan.md`
- Review: `engineering-team/reviews/sandbox-security/2-tags-security-parity.md`

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
