# Test plan — author-scoped-inspection #1: the instance assistant roster

**Story:** `engineering-team/stories/author-scoped-inspection/1-instance-assistant-roster.md`
**ADR:** `engineering-team/decisions/author-scoped-inspection/0001-instance-assistant-roster-and-delegate-resolver.md`
**Suite:** `test/author-scoped-inspection-roster.test.js`

## Levels and why

The roster's inputs are three files that exist only **inside the container** —
`/etc/brainstorm.conf`, `/var/lib/brainstorm/customers/customers.json`, and the secure-key store.
A host-run `npm test` sees none of them, so the roster cannot be exercised end-to-end stack-free.
The plan therefore splits three ways, matching `test/state-on-concept-page.test.js`:

- **U** — what *is* pure and host-safe: the narrowed resolver's contract. With no config present
  every lookup misses, and "misses cleanly" is precisely the behavior AC-3 and AC-4 depend on.
- **S** — source structure the ADR requires. **This is where the private-key boundary is pinned**;
  it is a property of the code, not of a response, so a passing response never proves it.
- **H** — live HTTP against `localhost:$TAPESTRY_PORT`, **SKIP** when the stack is unreachable.
  No fixtures are minted, so there is nothing to tear down.

## Coverage

| Test | Asserts | AC |
|---|---|---|
| U1 | `assistantKeys.js` exports `getAssistantPubkeyFor` and `listInstanceAssistants` | enabler |
| U2 | an unknown account resolves to `null` — not a throw, not `undefined` | AC-3 |
| U3 | the resolver's value is a hex string or `null`, **never an object** | AC-4 |
| U4 | `listInstanceAssistants` resolves to an array and never throws with no config present | AC-1 |
| S1 | the handler file exists and is registered as a `GET` under `/api/assistant/` | AC-1 |
| S2 | the registered path contains no `protectedGetEndpoints` substring | AC-1 |
| S3 | the handler never names `privkey`/`nsec` and never calls `getAssistantKeys` directly | AC-4 |
| S4 | admin inclusion is gated on the caller being the owner | AC-1 |
| S5 | `getUserClassification.js` stops defining its own resolver and imports the shared one | ADR §Decision |
| S6 | a row's field set is exactly the four the ADR names | AC-1 |
| H1 | `GET /api/assistant/roster` → 200, `{ success: true, assistants: [] }` | AC-1 |
| H2 | every row: 64-hex `accountPubkey`, `role` in the set, `assistantPubkey` 64-hex or `null` | AC-1, AC-2, AC-3 |
| H3 | unauthenticated, no row has `role: 'admin'` | AC-1 |
| H4 | the response body, as raw text, contains neither `privkey` nor `nsec` | AC-4 |
| H5 | the owner row's `assistantPubkey` equals `GET /api/assistant/pubkey` | AC-2, AC-5 |

**AC-5** (per-deployment values) is covered by H5's cross-check plus a manual staging read at
smoke time — a host-run suite can only reach one deployment, so the cross-deployment half is a
smoke step, recorded in the story, not an automated assertion.

## Expected before implementation

U1–U4, S1–S6 **FAIL** (neither export, handler, nor route exists). H1–H4 **FAIL** with 404.
H5 **FAIL** (no roster to compare). All H **SKIP** when the stack is down.

## Prerequisites

None. No firmware reinstall, no fixture minting, no graph state.
