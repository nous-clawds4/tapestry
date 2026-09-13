# Book of Work: Sandbox security parity

**Slug:** sandbox-security
**Status:** Closed
**Opened:** 2026-09-12
**Closed:** 2026-09-12

## Intent anchor

**Acceptance frame (no PRD).** The operator's ask (2026-09-12, during a `/whats-open` triage): the two sandbox droplets still in use — `feature-magic-carpet` → magic-carpet.brainstorm.world and `feat/tags` → tags.brainstorm.world — must stop lagging production's security fixes. (The other two sandboxes, `feat/communities` and `feat/curate`, had their droplets deleted in early September 2026; recording that is a separate doc-lane pass, not this book.)

Operator decisions recorded at kickoff:

- **Targeted port, not a staging merge.** Each sandbox gets the security fixes only; a full `staging` sync is separate later work (coordinated with Matthias for magic-carpet).
- **No containment hotfix ahead of the stories** — every fix runs the full human-gated cycle.
- **Keep Matthias's own login-signature fix** on magic-carpet (`63137ba5`, 2026-06-24). How far magic-carpet's login goes beyond it is settled at Planning (story 1, open question 1).

### Acceptance frame

- [ ] magic-carpet.brainstorm.world enforces the security behavior production gained in July and September 2026 — `security-auth-exposure` #1 and #2 with the hardening shipped alongside them, and `event-authenticity` #1 — with login as scoped in story 1, confirmed against the live host.
- [ ] tags.brainstorm.world enforces the September 2026 behavior it lacks — `security-auth-exposure` #3 and `event-authenticity` #1 — confirmed against the live host.
- [ ] The sandboxes' own features still work: Matthias's bounty and receiving flows on magic-carpet; tagging and pinning on tags.
- [ ] magic-carpet's database password is changed once its fix is live (operator task, below).
- [ ] Nothing that describes an unpatched exposure is pushed to the public repo before that host's fix is deployed.

**Push discipline (magic-carpet).** The repo is public and magic-carpet carries live, unpatched exposure until story 1 deploys. That the sandboxes lag prod's fixes is already public (OPEN.md row 276); the *specific* magic-carpet attack mechanisms are not, and stay out of committed text. Story-1 phase commits stay on a local working branch — not pushed, no public PR — until the fix is ready to deploy, so the fix and its describing artifacts reach GitHub together. (feature-magic-carpet has no required PR checks, so there is no CI reason to push early.)

## Epics in this book
- `sandbox-security` — story 1 (magic-carpet), story 2 (tags).

## Companion operator-side tasks (NOT code)
- Rotate magic-carpet's Neo4j password after story 1 deploys, using the OPERATIONS §9.10 runbook (`docker exec tapestry cypher-shell …`, never the web Neo4j Browser). magic-carpet was not part of the July 2026 rotation.

## Provenance
- **Mode:** Acceptance-frame *(no PRD; frame confirmed in conversation 2026-09-12)*
- **Confidence at close:** high — every acceptance-frame bullet met and live-verified on both hosts (magic-carpet PR #653, tags PR #654); the password rotation confirmed durable. The one soft spot — "sandbox features still work" — was verified indirectly (host health + no-regression suites); the operator will exercise a real authed flow later (audit §4 #3).

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/sandbox-security/audit.md`
- Product feedback: `engineering-team/audits/sandbox-security/prd-seed.md`
