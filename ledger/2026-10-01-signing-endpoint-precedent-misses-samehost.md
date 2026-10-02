# A new endpoint that signs with the caller's own key copied the older precedent, which has no same-host check, and nothing pointed the design at row 326

**Id:** 2026-10-01-signing-endpoint-precedent-misses-samehost
**Type:** meta
**Opened:** 2026-10-01 (list-headers-disposition #3 review)
**Status:** OPEN
**Done:** —

**What was seen.** ADR list-headers-disposition/0003 designed two endpoints that sign with the signed-in person's
own Assistant. For "the caller's own Assistant" it cited the precedent `src/api/dlist-curation/index.js`, which
has no same-host check. The newer signing routes do have one:
- `src/api/dlist-curation/update.js:107-115`, used at `:356`;
- `src/api/tagging-edges/index.js:147`, used at `:243`.

OPEN.md row 326 already says to copy that check per endpoint until it's centralised. Nothing in the
Architect's path (role, workflow, AGENTS.md) points a designer of a signing endpoint at row 326. The gap was
found only by an independent adversarial reviewer.

The same story's Test Design proved its tests catch mistakes, using mutants. But every mutant was a change *to
the design*, never an attack the design hadn't thought of. Two security gaps went unnoticed until Review:
the missing same-host check, and an unverified header being re-signed.

**Fix shape.**
- Point the Architect role (or `workflows/2-architecture.md`) at a short "signing endpoint checklist". It
  would cover:
  - the same-host check (row 326);
  - verified session only, never loopback trust;
  - the caller's own keys;
  - re-verifying any event read back from the relay before re-signing it, since `io.js` imports with
    `--no-verify`;
  - no key material in answers or logs.
- In Test Design for a story that signs, run one adversarial pass, by a fresh agent or a written threat list,
  before the tests are approved.
- Retire this row when row 326 centralises the same-host check, or when the checklist lands.

**Pointer:** `engineering-team/reviews/list-headers-disposition/3-disposition-on-my-assistant-rows.md` § Harness
friction.
