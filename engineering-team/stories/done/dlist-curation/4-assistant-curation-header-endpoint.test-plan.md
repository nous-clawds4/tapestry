# Test Plan: Story 4 — Author the assistant's curation header for a chosen community DList

**Story:** `engineering-team/stories/dlist-curation/4-assistant-curation-header-endpoint.md`
**ADR:** `engineering-team/decisions/dlist-curation/0004-assistant-curation-header-endpoint.md`
**Date:** 2026-09-10

## Coverage map

Suite: `test/dlist-curation-header-endpoint.test.js` — stack-free. The handler is built through the
ADR's factory `createAuthorCurationHeaderHandler(deps)` with every side effect stubbed and recorded
(auth, keys, relay fetch, local scan, local import, relay publish, publish policy, relay group,
signer, clock) and driven with a fake req/res (precedent: `test/global-publish-gate.test.js`,
`test/default-deny-mutations.test.js`). Registered in `test/test.js` (require, run, results line,
overall verdict, skip aggregate).

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 who may call | H1 no verified session → 401, nothing consulted · H2 no assistant → 400, owner TA not a fallback · H8 signed with the caller's assistant key | `test/dlist-curation-header-endpoint.test.js` | unit (handler) |
| AC-2 input | U2 parseATag · H3 malformed / kind 39999 / own header / own assistant → 400 before any fetch | same | unit |
| AC-3 server fetch, self-declared only | H4 not found → 404 (relays asked, local fallback consulted) · H5 not self-declared → 400 · H12 fetch order and newest-wins | same | unit (handler) |
| AC-4 the header | U4 verbatim copies, one `inherit-items` b, no community-namespace tag, empty content, fresh created_at, unsigned template · U5 slug synthesized, unknown tags not copied · H8 the signed template is the composed header | same | unit |
| AC-5 idempotent / never-clobber | U3 classifyExisting (none / exact / conflict ×4 / unpointed) · H6 case (a) · H7 case (b) 409 with the existing b · H13 case (c) · U6 case (c) template | same | unit |
| AC-6 publication reported honestly | H8 local then relays, per-destination rows · H9 local-only → skipped rows, no external call · H11 relay failure row with message · H14 ws/wss filtering · S4 per-relay settlement in source | same | unit + structure |
| AC-7 no graph write | S1 the module requires nothing that can write the graph and no brain-writing publish path · R2 the hook on /api/strfry/publish untouched | same | structure |
| AC-8 what the panel needs | H6/H8 response shape (`success`, `existing`, `header`, `published`) · H7 409 payload | same | unit |
| AC-9 failure order | H10 local failure → 500 stage:local, nothing else · H11 relay failure after local success → success:true | same | unit |
| Wiring | S2 route registered in `src/api/index.js` and the path string · S3 trustedList exports `publishToStrfry` · U1 exports | same | structure |

**AC→handle lines:** AC-1 → H1, H2, H8 · AC-2 → U2, H3 · AC-3 → H4, H5, H12 · AC-4 → U4, U5, H8 ·
AC-5 → U3, U6, H6, H7, H13 · AC-6 → H8, H9, H11, H14, S4 · AC-7 → S1, R2 · AC-8 → H6, H7, H8 ·
AC-9 → H10, H11 · wiring → U1, S2, S3 · sentinels R1, R3, R4.

## Edge cases

Not derivable from any single criterion:

- [x] **E1 — same target, different type is a conflict** (U3, H7): an existing `["b", <target>, "pointer"]`
      (e.g. a firmware-seeded header on the owner's own instance) must not be silently upgraded to
      `inherit-items`; and an untyped b reads as pointer (the registry's fail-safe) → conflict.
- [x] **E2 — exact plus another b is still a conflict** (U3): never-clobber means *any* other pointer
      blocks, even when the contract b is present.
- [x] **E3 — d-tags with colons** (U2): the a-tag is split at the first two colons only.
- [x] **E4 — future-dated existing header** (U6, H13): case (c)'s re-sign stamps
      `max(now, existing+1)` so a skewed original can never outrank the replacement.
- [x] **E5 — newest copy across relays** (H12): two copies of the community header with different
      `created_at` → the newer one's tags are copied.
- [x] **E6 — the local mirror is as good** (H12b): relays empty, local strfry holds the header → proceeds.
- [x] **E7 — relay-group hygiene** (H14): non-ws entries, numbers, empty strings are dropped before sending.
- [x] **E8 — the existing-header scan always targets the assistant** (H12): never the session pubkey.
- [ ] **Not covered — a live run.** Would publish a real header under the dev assistant's key to local
      strfry and, unless local-only, to `wss://dcosl.brainstorm.world`. Per OPEN.md row 191 a live suite
      must SKIP with a reason rather than FAIL when the deployment is not local-only; none is written here.
      The Reviewer may exercise the endpoint live against a local-only posture at their discretion.
- [ ] **Not covered — real seams:** `strfry import`/`strfry scan` process handling and SimplePool socket
      behaviour are the injected seams' own lanes (the local-import helper is the Trusted-List module's
      shipped code; the relay-fetch pattern is `src/api/relay/fetchEvents.js`'s).
- [ ] **Not applicable — Concept Graph API:** no concept behaviour changes.

## Test infrastructure
- Test framework: Node's built-in runner (`node test/test.js`); no Playwright half.
- Concept Graph API / Neo4j / strfry / relays: not exercised — every side effect is injected.
- Firmware state: none required.
- Fixtures: inline — synthetic pubkeys (`'b'.repeat(64)` user, `'c'.repeat(64)` assistant, a hex
  pattern for the community author), a synthetic self-declared community header shaped like the
  real ones on `wss://dcosl.brainstorm.world` (`d`, `names`, `slug`, `concept-graph`, `json`,
  self-pointer `b`), a fake req with a verified session, a fake res.
- Requiring server modules: the R/S tests require `src/api/trustedList/index.js`,
  `src/lib/bValueForms.js`, `src/utils/assistantKeys.js` — all load in the test environment today
  (the Trusted-List pin-publish-blockers suite does the same).

## How to run

Full suite:
```
npm test
```

Story-scoped gate (this suite plus the five guards that pin the two shipped files the change touches
and the default-deny middleware the new POST route sits behind):
```
node -e "Promise.all(['./test/dlist-curation-header-endpoint.test.js','./test/default-deny-mutations.test.js','./test/brain-first-tapestry-authoring.test.js','./test/trusted-list-pin-publish-blockers.test.js','./test/tag-applicability.test.js','./test/global-publish-gate.test.js'].map(p=>require(p).run())).then(rs=>{const f=rs.reduce((s,r)=>s+r.fail,0);console.log('TOTAL_FAIL='+f);process.exit(f?1:0)})"
```

## Verification
The new tests fail with the current code — the U and H classes because the module does not exist
(the factory cannot be loaded; the three pure helpers are not exported), the S class on the missing
wiring (no module, no route, no `publishToStrfry` export, no per-relay settlement). The four
sentinels pass. Confirmed on 2026-09-10 at commit b00b46fa (working tree = that commit plus this
suite and its runner registration):

```
=== NEW SUITE (expect U/H/S failing, R passing) ===
  ✗ U1: the module exports the factory, register, and the three pure helpers
      src/api/dlist-curation/index.js must load: Cannot find module (src/api/dlist-curation/index.js)
  ✗ U2: parseATag — kind/pubkey/d, colons inside the d-tag preserved, garbage → null
      src/api/dlist-curation/index.js must load: Cannot find module (src/api/dlist-curation/index.js)
  ✗ U3: classifyExisting — none / exact / conflict (other target, other type, untyped) / unpointed
      src/api/dlist-curation/index.js must load: Cannot find module (src/api/dlist-curation/index.js)
  ✗ U4: composeCurationHeader — copies names/slug/json verbatim, one inherit-items b, nothing from the community namespace
      src/api/dlist-curation/index.js must load: Cannot find module (src/api/dlist-curation/index.js)
  ✗ U5: composeCurationHeader — slug synthesized when the community header lacks one; unknown tags not copied
      src/api/dlist-curation/index.js must load: Cannot find module (src/api/dlist-curation/index.js)
  ✗ U6: composeCurationHeader — case (c): existing tags preserved, b appended, content kept, created_at skew-proof
      src/api/dlist-curation/index.js must load: Cannot find module (src/api/dlist-curation/index.js)
  ✗ H1: no verified session → 401 from the guard, nothing else consulted
      src/api/dlist-curation/index.js must load: Cannot find module (src/api/dlist-curation/index.js)
  ✗ H2: no provisioned assistant → 400 naming the Assistant; the owner TA is not a fallback
      src/api/dlist-curation/index.js must load: Cannot find module (src/api/dlist-curation/index.js)
  ✗ H3: malformed, kind-39999, own-header, and own-assistant targets → 400 before any fetch
      src/api/dlist-curation/index.js must load: Cannot find module (src/api/dlist-curation/index.js)
  ✗ H4: target not on the community relays nor local → 404
      src/api/dlist-curation/index.js must load: Cannot find module (src/api/dlist-curation/index.js)
  ✗ H5: a fetched header that is not self-declared → 400
      src/api/dlist-curation/index.js must load: Cannot find module (src/api/dlist-curation/index.js)
  ✗ H6: case (a) — the exact contract b already exists → existing:true, nothing signed or published
      src/api/dlist-curation/index.js must load: Cannot find module (src/api/dlist-curation/index.js)
  ✗ H7: case (b) — an existing header with a different b → 409 with the existing pointer, nothing published
      src/api/dlist-curation/index.js must load: Cannot find module (src/api/dlist-curation/index.js)
  ✗ H8: case (d) — absent → composed, signed with the caller's assistant key, imported locally, sent to the DList relays, reported
      src/api/dlist-curation/index.js must load: Cannot find module (src/api/dlist-curation/index.js)
  ✗ H9: local-only publish policy → relays skipped (and reported so), publishToRelays never called
      src/api/dlist-curation/index.js must load: Cannot find module (src/api/dlist-curation/index.js)
  ✗ H10: local import fails → 500 with stage "local", nothing sent to relays
      src/api/dlist-curation/index.js must load: Cannot find module (src/api/dlist-curation/index.js)
  ✗ H11: a relay rejects → success:true with a failed row carrying the message (never a blanket success)
      src/api/dlist-curation/index.js must load: Cannot find module (src/api/dlist-curation/index.js)
  ✗ H12: fetch order — community relays first (newest copy wins), local strfry only as the fallback
      src/api/dlist-curation/index.js must load: Cannot find module (src/api/dlist-curation/index.js)
  ✗ H13: case (c) — an existing header with no b is re-signed with the contract b appended and republished
      src/api/dlist-curation/index.js must load: Cannot find module (src/api/dlist-curation/index.js)
  ✗ H14: only ws:// and wss:// relays from the DList group are used
      src/api/dlist-curation/index.js must load: Cannot find module (src/api/dlist-curation/index.js)
  ✗ S1: the module exists and requires nothing that can write the graph
      ADR §Implementation 1: src/api/dlist-curation/index.js must exist
  ✗ S2: the route is registered in src/api/index.js next to the other modules
      ADR §Implementation 3: src/api/index.js requires ./dlist-curation
  ✗ S3: trustedList now exports publishToStrfry (the one-line change to a shipped module)
      ADR §Implementation 2: publishToStrfry exported from src/api/trustedList/index.js
  ✗ S4: relay sends settle per relay, and the module carries no pubkey literal
      ADR Option A / OPEN.md row 200: per-relay Promise.allSettled, never an unconditional success
  ✓ R1: trustedList's existing exports are intact
  ✓ R2: /api/strfry/publish still carries (and awaits) the brain-write hook — untouched
  ✓ R3: the b-value forms module still exports A_TAG_RE and dispositionOf
  ✓ R4: getAssistantKeys is still the per-user key seam
RESULT {"pass":4,"fail":24,"skipped":0}
=== GUARDS ===
default-deny-mutations → {"pass":14,"fail":0,"failures":[],"skipped":0}
brain-first-tapestry-authoring → {"pass":19,"fail":0,"skipped":0,"failures":[]}
trusted-list-pin-publish-blockers → {"pass":11,"fail":0,"skipped":0,"failures":[]}
  ✓ B1: buildAndPublishTL handles an `a`-coordinate member item (else-if a → ["a", value])
  ✓ LIB3: deriveApplicabilityMembers({usageRows,hintEls,context}) = HINT ∪ USAGE (context→byType, enriched, deduped)
tag-applicability → {"pass":19,"fail":0}
  PASS  handler: BRAINSTORM_PUBLISH_LOCAL_ONLY='true' → allowExternalPublish:false (guard engages)
  PASS  handler: only the exact string 'true' engages the guard ('false'/'1'/'yes'/'TRUE' → external allowed)
  PASS  endpoint: /api/publish-policy registered in src/api/index.js → handleGetPublishPolicy
  PASS  guard: isExternalPublishAllowed fetches /api/publish-policy and FAILS OPEN (error → external allowed)
global-publish-gate → {"pass":8,"fail":0,"failures":[]}
GUARD_TOTAL_FAIL=0
```
