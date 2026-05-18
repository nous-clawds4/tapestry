# Test Plan: Story 8 — Community-reference pointer (Nostr Relay stub)

**Story:** `engineering-team/stories/8-community-reference-nostr-relay-stub.md`
**ADR:** `engineering-team/decisions/0005-community-reference-nostr-relay-stub.md` (depends on ADR 0004)
**Date:** 2026-05-17

> **Revision (2026-05-18, ADR 0005 Rev 1):** `communityReference.relayHints` is now `["wss://dcosl.brainstorm.world"]` (matches the revised export target). TI1 unchanged and still valid (non-empty `ws(s)://` array). Smoke M1/M3 publish/seek the community Header on the dcosl DList relay.

## Approach

Precedent: stories #5 / #6. The behavioral core — a real community kind-39998 Header fetched off a relay, imported as a **distinct foreign node**, the Neo4j `IMPORT` placeholder edge created, graceful skip when no relay carries it, `knownGoodEventId` mismatch handling, and re-install idempotency — needs a live firmware install + relays + Neo4j and is **not reproducible in the hand-rolled Node runner**. The in-runner suite pins the **stable contract** (the manifest data shape + the install wiring/ordering/graceful contract ADR 0005 fixed); the behavioral proof is the **authoritative local/staging smoke** below.

**Deliberate limitation (read this).** Source sentinels prove the manifest field exists and that install.js *references* the fetch/publish/IMPORT/ordering contract — they cannot prove the edge is actually created against the right foreign node, that a relay miss truly degrades gracefully, or that re-install is idempotent. The authoritative gate for AC-1…AC-5 is the §"Not covered" smoke. **The Reviewer must treat that smoke evidence as required, not optional.**

## Coverage map

| Criterion | Test / mechanism | File | Level |
|---|---|---|---|
| AC-1 (fetch community Header → import as distinct node) | **TI1** (manifest `communityReference` well-formed) + **TI2** (install fetches via `/api/relay/external`, publishes via `/api/strfry/publish`); the node actually appearing distinct from the local TA header is **smoke M1** | test/community-reference-nostr-relay-stub.test.js | source + smoke |
| AC-2 (placeholder edge local→community Header) | **TI2** pins an `[:IMPORT]` MERGE in install; the edge actually present post-install is **smoke M1** | test/community-reference-nostr-relay-stub.test.js | source + smoke |
| AC-3 (Header unreachable ⇒ graceful, local concept unaffected) | **TI2** pins try/catch in the sub-pass region (never throws out of install); real graceful skip is **smoke M2** | test/community-reference-nostr-relay-stub.test.js | source + smoke |
| AC-4 (knownGoodEventId verified; mismatch = miss) | **TI1** pins the field is 64-hex when present; mismatch→miss behavior is **smoke M3** | test/community-reference-nostr-relay-stub.test.js | source + smoke |
| AC-5 (re-run idempotent) | MERGE semantics pinned by **TI2** (`[:IMPORT]` via MERGE); no-duplicate proof is **smoke M4** | test/community-reference-nostr-relay-stub.test.js | source + smoke |

TI1, TI2 = FAIL pre-implementation, PASS post. RI1, RI2 = PASS pre AND post (scope guards: RI1 flips if Implementer drifts to ADR Option B = a first-class IMPORT firmware relationship-type; RI2 flips if a "No source change" file gains community-reference logic).

## Edge cases

- [x] **Option-A vs Option-B enforced.** RI1 fails if `manifest.relationshipTypes` ≠ the known 11 or any entry references IMPORT — encodes "the IMPORT edge is Neo4j-only" (ADR 0005 Decision).
- [x] **Scope creep into reused files caught.** RI2 fails if `fetchEvents.js` / `publishEvent.js` / `tapestry-key/index.js` gains `communityReference` logic (ADR 0005 "No source change" — feature lives only in install.js + manifest).
- [x] **Ordering pinned.** TI2 asserts the `/api/relay/external` call precedes the Pass-3 `/api/tapestry-key/derive-all/` marker — the community Header must be published before derive so it becomes a node.
- [x] **No re-signing.** TI2's message states the foreign event is passed through `/api/strfry/publish` without re-signing (you cannot sign someone else's event); the actual passthrough param is the Implementer's to confirm (smoke M1 proves the node is the curator's pubkey, not the TA's).
- [ ] **Edge points at the right foreign node / true idempotency / true graceful skip.** Not catchable in source — smoke M1/M2/M4.

## Not covered (deferred to local/staging smoke — authoritative behavioral gate)

Run on the local docker stack (`cycle-local`, `http://localhost:8080`) or `staging.brainstorm.world`. **Precondition:** `POST /api/firmware/install` is the action under test; `communityReference` must be populated with a real curator pubkey + a relay that carries that Header.

**M1 — AC-1/AC-2 (import + placeholder edge):** publish a community `nostr-relay` Header (kind 39998, a curator pubkey ≠ local TA) to a relay in `relayHints` — strongest via Story #9 export from another instance; minimally via a hand-signed 39998. Run `POST /api/firmware/install`. Via `/api/concept-graph/node/39998:<localTA>:nostr-relay/neighbors`, expect an **`IMPORT`** edge to a **distinct** node whose handle is `39998:<curator>:nostr-relay` (different pubkey segment from the local TA header).

**M2 — AC-3 (graceful):** set `relayHints` to a relay that does NOT carry the Header (or unreachable). Run install. Expect install completes, logs the miss, **no `IMPORT` edge**, and the local `nostr-relay` concept is created/normalized exactly as before (no failure).

**M3 — AC-4 (knownGoodEventId):** set `knownGoodEventId` to a wrong id → expect miss (no edge), logged. Set it to the correct id → expect edge created.

**M4 — AC-5 (idempotent):** run `POST /api/firmware/install` twice. Expect exactly **one** community node and **one** `IMPORT` edge (MERGE — no duplicates).

## Test infrastructure

- **Framework:** existing hand-rolled Node runner (`npm test` → `test/test.js`). No new deps/framework (house rule). Registered: `communityReferenceStub` in `test/test.js`.
- **Files asserted against:** `firmware/active/manifest.json` (versioned `versions/v1.0.0`), `src/firmware/install.js`, and the three ADR-0005 "no source change" files for RI2.
- **No Playwright spec.** Firmware-install + relay + Neo4j round-trip is not deterministically reproducible in-runner; behavioral proof is the smoke above.
- **Smoke fixtures:** a community `nostr-relay` 39998 Header on a `relayHints` relay (Story #9 export or hand-signed); local docker stack or staging.

## How to run

```
npm test
```

Targeted:
```
node -e "require('./test/community-reference-nostr-relay-stub.test.js').run()"
```

## Verification

New tests fail on the pre-implementation tree (working tree atop story/ADR commit `b416c938`):

```
community-reference-nostr-relay-stub suite:
  ✗ TI1: firmware manifest carries a well-formed `communityReference` on the nostr-relay concept (AC-1, ADR 0005)
  ✗ TI2: install.js has a graceful community-reference sub-pass, wired before Pass-3 derive (AC-1/AC-3/AC-5, ADR 0005)
  ✓ RI1: no first-class IMPORT firmware relationship-type added (ADR 0005 chose Option A, rejected Option B)
  ✓ RI2: ADR-0005 "No source change" files stay free of community-reference logic
community-reference-nostr-relay-stub suite:      FAIL (2 passed, 2 failed)
Overall:                                         FAIL
```

- TI1, TI2 fail citing AC + ADR, describing the missing contract without prescribing the ADR-open function name — not a typo/import error (suite loaded and ran).
- RI1, RI2 pass (intentional scope guards; a flip to FAIL during Implementation = Option-B drift or edits to "No source change" files).
- All 6 pre-existing suites stay green — no collateral regression from registering the new suite.
