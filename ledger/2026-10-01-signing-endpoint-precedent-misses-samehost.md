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

**Pointer:** `engineering-team/reviews/done/list-headers-disposition/3-disposition-on-my-assistant-rows.md` § Harness
friction.

**Update 2026-10-01 (list-headers-disposition #4 review).** One more item for the signing-endpoint checklist:
**bound every request-supplied value that becomes a tag.** Give it a type, a size within the relay's
`maxTagValSize`, and no control or format characters. `strfry import` exits 0 when it rejects an event, so an
oversize tag passes `publishToStrfry` as success, and the graph then disagrees with the relay. Story 4's Wire target
had no bound until its review.

**Update 2026-10-02 (list-headers-disposition #5 review, and the book close).** One more checklist item, this time on
the browser side: **a surface that acts as the signed-in person must handle the session changing while it is open.**
- Story 5's panel outlived an in-page sign-out. **Next** then opened other people's rows, and the panel's buttons
  threw. Nothing could be sent, but it broke the story's AC 1 and AC 5.
- It was found only in Review. The Test Design threat list covered the server and the signer, not the page's own
  lifecycle.
- Fixed by ADR list-headers-disposition/0005 Amendment 1 §1.
- A request already in flight at that moment is the remaining edge: ledger row
  `2026-10-01-me-disposition-inflight-signer-prompt`.
