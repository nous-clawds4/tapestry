# A suite held back for disclosure can't be seen passing before Implementation

**Id:** 2026-10-10-held-suites-run-green-before-implementation
**Type:** meta
**Opened:** 2026-10-10 (story security-auth-exposure #8 review, harness note 1)
**Status:** OPEN
**Done:** —

Story 8's Tester held one suite out of the repo because it names still-open routes. Nobody ran it until the
Implementer did, who then had to fix a defect in it (a HEAD probe that expected a body). Proposal: when a suite is held,
the Tester runs it against a scratch candidate fix (or a stub of the expected behaviour) before handing over, so its own
defects surface in Test Design.

**Pointer:** review `engineering-team/reviews/security-auth-exposure/8-admin-action-sweep.md`, harness notes.
