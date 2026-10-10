# A timing check (RW7) fails under load and has no ledger row

**Id:** 2026-10-10-rw7-timing-flake
**Type:** meta
**Opened:** 2026-10-10 (story security-auth-exposure #8 review, harness note 2)
**Status:** OPEN
**Done:** —

The RW7 check fails when the machine is busy (0.77 s against a 0.8 s floor in story 8's review, while another job ran),
and four reviews in the `security-auth-exposure` epic mention it. Give it a floor that holds under load, or measure
something that doesn't depend on wall-clock time.

**Pointer:** review `engineering-team/reviews/security-auth-exposure/8-admin-action-sweep.md`, harness notes.
