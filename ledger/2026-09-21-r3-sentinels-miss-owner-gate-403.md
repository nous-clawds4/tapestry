# Two R3 source sentinels on the generic signer now pass on the kind-0 refusal's 403, not the owner gate's

**Id:** 2026-09-21-r3-sentinels-miss-owner-gate-403
**Type:** cleanup
**Opened:** 2026-09-21 (assistant-profile #5 review, non-blocking 1)
**Status:** OPEN
**Done:** —

`test/create-tapestry.test.js` R3 (`:288-297`) and `test/add-a-concept-to-a-tapestry.test.js` R3 (`:417-425`) guard
the generic signer's owner gate (ADR security-auth-exposure/0002). Each slices 600 characters from the first
`signAs === 'assistant'` in `src/api/strfry/commands/publishEvent.js` and requires `isOwner(req)`, `localTrusted` and
`403` inside that window.

- **Since assistant-profile #5** that first match is the kind-0 refusal (`publishEvent.js:41`), which answers its own
  403 70 characters in. The gate's `403` (`:53`) falls outside the window.
- So a gate that answered 401, or a bare 200, would pass both R3s. The review planted both: they are caught by
  `default-deny-mutations` AC3 and story 5's G4. No behaviour is unpinned today; the two sentinels just no longer
  measure what their names say.

Fix shape (Tester's lane, any story that touches these suites): anchor each R3 at the gate itself — slice from
`isOwner(req)`, or assert that the gate's own `403` follows it — instead of a fixed window from the first
`signAs === 'assistant'`.

**Pointer:** `engineering-team/reviews/done/assistant-profile/5-one-writer-for-assistant-profiles.md`, non-blocking
finding 1; ledger `2026-09-21-adr-reaim-list-misses-outcome-asserts` (the process lesson).
