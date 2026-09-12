# ADR 0001: Verify client-published event signatures at the publish boundary

**Status:** Proposed
**Date:** 2026-09-11
**Story:** `engineering-team/stories/event-authenticity/1-verify-client-published-event-signatures.md`
**Relates to:** `security-auth-exposure/0002` (default-deny) — that ADR deliberately keeps `/api/strfry/publish` public for permissionless client-signed publishing and gates only `signAs:'assistant'`. This ADR adds the missing **authenticity** check on the client path without changing that posture.

## Context

`POST /api/strfry/publish` (`src/api/strfry/commands/publishEvent.js`) has two branches:
- `signAs:'assistant'` (`:32-56`) — owner/`localTrusted`-gated, signs with the TA key. Unchanged by this ADR.
- `signAs:'client'` / unset (`:58-63`) — takes the caller's event, checks only that `sig`/`id`/`pubkey` are **present** (not valid), sets `signedEvent = event`, and proceeds.

The client path then (`:68-95`): (1) `exec('strfry import')` piping the event; the callback rejects **only** on a non-zero exit; (2) on resolve, `await maybeBrainWriteTapestry(signedEvent)` — which, for an event that looks like one of the instance's own tapestry letters (`isOwnedTapestryEvent`: kind 39999, `z`=`39998:<taPubkey>:tapestry`, `pubkey`∈{TA, owner}), calls `importEventDirect(signedEvent, uuid)` (`tapestryBrainWrite.js:64`) to write the event + tag nodes into **Neo4j** from the event object, MERGE by `uuid = 39999:<pubkey>:<dTag>` (refreshing `HAS_TAG`), then derive an **LMDB** doc.

**Empirical premise (confirmed this phase, in-container 2026-09-12 UTC):** `strfry import` of a bad-signature event logs `1 rejected` but **exits 0** — identical exit to a valid import. So the exec callback does **not** reject; the flow resolves and reaches `maybeBrainWriteTapestry`, which writes the forged node into Neo4j **from the event object** (independent of whether the relay stored it). Net: a remote, unauthenticated caller can present a kind-39999 event claiming `pubkey = <TA>` with the tapestry `z`-tag and an invalid signature, and have its nodes forged into the definitive graph; reusing an existing element's `d`-tag overwrites the genuine element's tags via the MERGE-by-`uuid`. This is finding **F1** (Critical, live).

**Acceptance criteria (quoted):** forged client event → rejected, nothing written to relay/Neo4j/LMDB; validly-signed event from any pubkey → still publishes (permissionless preserved); forged `d`-tag reuse → genuine element not deleted; `signAs:'assistant'` gate unchanged; verification is app-level, not reliant on the relay's import behavior.

Constraints:
1. **Authenticity, not authorization** (CLAUDE.md invariant 2). The check must confirm the *claimed author signed the event* — never reject by *which* author. A valid self-signed event from any pubkey must still publish.
2. **`nostr-tools` is already loaded in this file** — `getNostrTools()` (`:14-20`) returns the module via the in-container absolute path; `verifyEvent` is available with no new dependency and no new require pattern.
3. **Don't disturb the shipped auth surface** — `PUBLIC_MUTATIONS`, `localTrusted`, and the `signAs:'assistant'` gate stay exactly as ADR `security-auth-exposure/0001`,`/0002` left them.
4. **No concept-graph concepts change** — this protects a write boundary; no firmware reinstall.

## Options considered

### Option A — `verifyEvent` at the client-branch boundary, before publish *(chosen)*

In the `signAs:'client'` branch, after the presence check and before `signedEvent = event`, verify the signature; reject on failure. This sits **upstream of both** the `strfry import` and `maybeBrainWriteTapestry`, so a forged event reaches neither the relay nor Neo4j/LMDB.

- **Pros:** single, minimal insertion at the exact boundary; gates every downstream sink at once; satisfies "not written to relay *or* graph *or* store" and "app-level, not relay-reliant"; protects any future consumer of this endpoint; reuses the file's existing nostr-tools loader.
- **Cons:** none material. (Verification cost is one schnorr check per publish — negligible.)

### Option B — verify inside `maybeBrainWriteTapestry`

Check the signature in the brain-write hook instead.

- **Pros:** protects the graph/LMDB write.
- **Cons:** leaves the relay-publish un-gated — a forged event is still piped to `strfry import` (rejected by the relay, but the handler would still return `success:true`, a false-success), and other/future consumers of the publish boundary stay unprotected. Only covers part of AC-1. **Rejected.**

### Option C — treat a `strfry import` rejection as a publish failure (parse output / "0 added")

Make the exec path detect rejections rather than trusting exit 0.

- **Pros:** fixes the misleading exit-0-on-rejection at the relay layer.
- **Cons:** fragile and relay-specific (conflates legitimate dups / `writePolicy` rejections with bad sigs), and **does not** stop the graph forgery — `maybeBrainWriteTapestry` writes from the event object, not from what the relay stored. Wrong layer for an authenticity guarantee. **Rejected** as the primary fix (the false-success-on-rejection reporting is noted as a separate, out-of-scope honesty issue).

### Sub-decision — verify all client events, or only owned-tapestry-shaped ones

Verify **every** client-path event unconditionally (any kind, any author). Rationale: authenticity is a property of the whole endpoint; a valid event of any kind still passes, so it costs nothing legitimate, and it avoids leaving non-tapestry forgeries possible or coupling the guard to the tapestry shape.

## Decision

**Option A**, verifying all client-path events. One change, in `src/api/strfry/commands/publishEvent.js`, inside the `signAs:'client' || !signAs` branch, after the `id`/`sig`/`pubkey` presence check (`:60-62`) and before `signedEvent = event` (`:63`):

```
// Authenticity, not authorization: the signature must be valid for the CLAIMED
// pubkey. Any validly-signed event from any author still publishes (permissionless,
// ADR security-auth-exposure/0002); a forged one is rejected here — before the relay
// import AND before maybeBrainWriteTapestry, so it reaches neither the relay, Neo4j,
// nor LMDB. Verify a JSON round-trip so a client-attached verifiedSymbol cache can't
// be trusted (strfry import cannot be relied on: it exits 0 even when it rejects a
// bad-sig event — confirmed 2026-09-12).
const nt = getNostrTools();
let verified = false;
try { verified = nt.verifyEvent(JSON.parse(JSON.stringify(event))) === true; } catch { verified = false; }
if (!verified) {
  return res.status(400).json({ success: false, error: 'Event signature verification failed' });
}
```

`signedEvent = event` then proceeds only for a verified event. No other lines change.

**How the cases resolve:**

| Caller | Result |
|---|---|
| Forged kind-39999 (claims TA pubkey, tapestry z-tag, bad sig), `signAs:'client'` | **400** — rejected before import + brain-write; no relay/Neo4j/LMDB write; genuine element untouched |
| Valid self-signed event, any pubkey/kind, `signAs:'client'` | publishes as before (permissionless preserved) |
| Forged event reusing a real element's `d`-tag | rejected before `importEventDirect` → no overwrite/delete |
| `signAs:'assistant'` (owner/localTrusted) | unchanged |

## Consequences

- **Closes F1**: forged events can no longer be published or written into the graph/LMDB; the destructive `d`-tag-reuse overwrite is closed by rejecting before any write.
- **Permissionless publishing preserved**: the gate is signature validity, not author identity.
- **Residual / out of scope (noted, not fixed here):** the handler still returns `success:true` when `strfry import` exits 0 having *rejected* the event for a non-signature reason (dup, `writePolicy`) — a false-success reporting issue that predates this ADR and belongs to publish-reporting, not authenticity. With this fix, a bad **signature** no longer reaches import, so it is not the F1 vector.
- **Firmware reinstall required?** No — one middleware-adjacent handler change; no concept definitions change.

## Implementation notes

- `src/api/strfry/commands/publishEvent.js` — insert the verification block described above inside the `signAs:'client' || !signAs` branch (between `:62` and `:63`). Use the existing `getNostrTools()` (`:14-20`); do **not** add a new require. No change to the `assistant` branch, the `strfry import` exec, or `maybeBrainWriteTapestry`.
- **Test-file changes are Phase 3 (Tester's lane).** Coverage the ADR implies: (1) a bad-sig client event → `400` `signature verification failed`, and **neither** `strfry import` (child_process.exec) **nor** `maybeBrainWriteTapestry` is invoked; (2) a validly-signed event (mint with nostr-tools `finalizeEvent`, throwaway key) → passes verification and reaches the publish path; (3) the `assistant` branch still requires owner/`localTrusted` (unregressed). The handler shells out (`exec('strfry import')`) and calls the brain-write, so the unit test must stub both (require-cache stub of `child_process` / of `../tapestryBrainWrite`, mirroring the driver-stub pattern in `test/close-unauth-write-surface.test.js`), and assert they are not reached for a forged event. A kind-39999 forged-TA fixture exercises the destructive path specifically.

## Out of scope

- **F3** (io-import `--no-verify` + Cypher-injection), **F4** (`trusted-list/publish` gate), **F5** (POST-only owner gate) — separate findings/stories.
- The `success:true`-on-relay-rejection reporting issue (publish-reporting concern).
- Rate-limiting / spam control on the publish endpoint (relay write-policy layer).
