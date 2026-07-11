# Test Plan: Story 38 — the shared `b`-tag primitive (emitter + edge derivation + stub retirement)

**Story:** `engineering-team/stories/community-reference/38-b-tag-primitive-emitter-derivation.md`
**ADR:** `engineering-team/decisions/community-reference/0034-b-tag-primitive-emitter-derivation.md`
**Wire spec:** `protocols/drafts/inherit-from.md`
**Date:** 2026-06-17

## Test levels — why two

The story has two halves with very different testability:

- **DERIVATION** — `src/api/neo4j/eventSync.js` → `buildImportCypher(event)` is a **pure function** that takes a synthetic event and returns an array of Cypher strings. It does **no I/O**. So the derivation (AC-2, AC-3, AC-5-idempotency, the direction guard) is covered by **behavioral unit tests** that call the real function and assert on the generated Cypher text. This is true behavioral coverage, not a regex over source — the function is run.
- **EMITTER** — `src/firmware/install.js` → `pass_communityReferences` does a local-strfry scan, TA signing, and an `/api/strfry/publish` round-trip. None of that is available on the unit-test host (no strfry binary, no signer, no Neo4j). So the emitter ACs (AC-1, AC-4, AC-6, AC-7, OQ-1) are covered by **source-contract** regex assertions over `src/firmware/install.js`. AC-8 parses `firmware/active/manifest.json` directly (a true data assertion, not a regex).

This mirrors the most recent suite in the epic family (`test/tag-read-union.test.js`), which split behavioral-unit (`federatedScan`, callable without the strfry binary) from source-contract (the handler wiring it could not run).

## Coverage map

| Criterion | Test name | Test file | Level | Why this level |
|---|---|---|---|---|
| AC-1 (pointer-`b` seeded literal, pointer-only never inherit) | `AC-1: the emitter appends ["b", <headerATag>, "pointer"] to the local header` | `test/b-tag-primitive.test.js` | source-contract | emitter is inside `pass_communityReferences` (strfry I/O + signing); can't run on host |
| AC-1 (re-signs via existing TA signer, not a hardcoded key) | `AC-1: the emitter re-signs through the existing TA signer (signAndFinalize / TA key path), not a hardcoded key` | same | source-contract | signing path is I/O; assert the signer seam (`signAndFinalize`/`loadTAKey`/`republish-header`) is used and no `sk` literal is hardcoded |
| AC-2 (pointer → REFERENCES{source:'b-tag'}) | `AC-2: a pointer-typed b tag derives a header-level REFERENCES edge with source='b-tag'` | same | **behavioral-unit** | `buildImportCypher` is pure; call it with a synthetic pointer-`b` header and assert the Cypher |
| AC-2 (absent type → REFERENCES{source:'b-tag'}) | `AC-2: a b tag with the type element ABSENT also derives REFERENCES{source:'b-tag'} (absent reads as pointer)` | same | **behavioral-unit** | same; the fail-safe "absent reads as pointer" path |
| AC-2 (no firmware-community stub emitted in the Cypher) | `AC-2: the pointer b edge points child→target (no source-only stub; the published event is the sole producer)` | same | **behavioral-unit** | guard: `buildImportCypher` must never emit `source='firmware-community'` for a `b` header |
| AC-3 (inherit → INHERITS_FROM, no source) | `AC-3: an inherit-typed b tag derives INHERITS_FROM (no source property)` | same | **behavioral-unit** | pure function; assert `INHERITS_FROM` present and no `source='b-tag'` |
| AC-3 (gate is explicit `'inherit'`, never "not pointer") | `AC-3 (gate): pointer and absent types do NOT derive INHERITS_FROM (gate keys on explicit 'inherit')` | same | **behavioral-unit** | pure function; pointer and absent must NOT yield `INHERITS_FROM` |
| AC-4 (stub retired for `b`-carrying headers) | `AC-4: the firmware-community stub MERGE is gated on the absence of a seeded b (skipped when a b is present)` | same | source-contract | the gate lives in the install.js post-derive loop; assert a `seededB`/`hasB`/`continue` gate around the stub MERGE (and that the stub MERGE still exists for AC-7) |
| AC-5 (idempotent — derivation half) | `AC-5 (derivation idempotency): the b edge is built with MERGE, not CREATE (re-import yields one edge)` | same | **behavioral-unit** | pure function; assert the `b` edge uses `MERGE`, never `CREATE` |
| AC-5 (idempotent — emitter half) | `AC-5 (emitter idempotency): a second install is suppressed by the never-clobber b-presence check` | same | source-contract | the never-clobber `b`-presence check IS the idempotency mechanism; assert it exists in `pass_communityReferences` |
| AC-6 (never-clobber, any type/target) | `AC-1/AC-6 (never-clobber): an existing b of ANY type/target suppresses the seed (check is t[0]==='b', not type-specific)` | same | source-contract | assert the guard keys on `t[0] === 'b'` only, NOT on type (`t[2]`) or target |
| AC-7 (pre-existing legacy stubs not deleted) | `AC-7: no DELETE/DETACH of firmware-community REFERENCES edges is introduced (legacy stubs stay harmless)` | same | source-contract | assert no `DELETE`/`DETACH` touching `firmware-community` is introduced |
| AC-8 (no manifest change — real tag concepts) | `AC-8: tag / nostr-user-tag / tag-pinning carry NO communityReference (stub-trap guard)` | same | source-contract (data) | parse `manifest.json`; assert those three concepts carry no `communityReference` |
| AC-8 (no new communityReference anywhere) | `AC-8: nostr-relay remains the ONLY concept carrying a communityReference (no new ones added)` | same | source-contract (data) | parse `manifest.json`; assert exactly one (`nostr-relay`) carries a `communityReference` |
| Direction guard (wire spec :46) | `DIRECTION: the b edge is child→target and is NOT flipped to target→child` | same | **behavioral-unit** | pure function; assert the `REFERENCES`/`INHERITS_FROM` MERGE is a child→target directed edge (no `n`/`s`-style flip) |
| OQ-1 (seed independent of fetch failure) | `OQ-1: the local-header b seed is reachable even when the community fetch fails (not nested under the fetch-success guard)` | same | source-contract (structural) | assert the pointer-`b` seed literal is reachable on the not-found path (precedes the `if (!ev)` early `continue`, or the path was restructured) |

Every AC has at least one test; AC-1, AC-2, AC-3, AC-5, and AC-8 have multiple (positive + negative/guard pairs).

## ACs covered only at source-contract level — and why

- **AC-1, AC-4, AC-6, AC-7, AC-5-emitter-half** — these all live inside `pass_communityReferences` (or its post-derive edge loop), which performs a live local-strfry scan, TA signing, and an HTTP publish. None of that runs on the unit-test host (no strfry binary, no Neo4j, no TA key store). They are asserted by regex over `src/firmware/install.js`. Full behavioral verification of the emitter is the **reinstall-then-inspect** recipe in ADR OQ-4 (an integration/manual step, below).
- **OQ-1** — this is the weakest assertion. The robust, machine-checkable form the ADR mandates is "the pointer-`b` seed is reachable even when the community-header fetch fails." The test asserts this structurally: the pointer-`b` seed literal must precede the `if (!ev)` early-`continue` (or that early-`continue` must have been restructured away), so a fetch miss cannot bypass the seed. **Limitation:** this is a structural proxy, not a behavioral run of the failure path — an Implementer who hoists the seed via a different-but-valid control structure (e.g. a separate helper called before the fetch) may need this assertion updated. The test message says so. The authoritative behavioral check for OQ-1 is the integration recipe: install with an unreachable `relayHints`/mismatched pin and confirm the local header still gains the `b` and the `b-tag` edge.
- **AC-8** — source-contract only because it is fundamentally a "the diff did not change this file" guard (the stub trap). It parses the manifest JSON and asserts the data, which is as strong as it can be.

## Edge cases covered

- [x] `b` tag with the **type element absent** → must derive `REFERENCES{source:'b-tag'}` (fail-safe pointer reading), NOT `INHERITS_FROM`.
- [x] `pointer` and `inherit` produce **different** edge classes (`REFERENCES{source:'b-tag'}` vs bare `INHERITS_FROM`).
- [x] Gate is on **explicit `'inherit'`** — pointer and absent never derive `INHERITS_FROM` (no "not pointer" gate).
- [x] Never-clobber suppresses on **any** existing `b` (any type, any target) — not just a pointer match.
- [x] Direction is **child→target**, never flipped (wire spec :46) — distinct from `n`/`s`.
- [x] MERGE (not CREATE) for the derived edge → idempotent across re-imports.
- [x] Stub trap: real tag concepts gain **no** `communityReference`.

## Edge cases NOT covered here (out of scope / deferred to integration)

- [ ] Live Neo4j edge existence after a real install (`MATCH (c {uuid:…})-[r:REFERENCES]->(t) RETURN r.source` → `'b-tag'`) — requires the running stack; ADR OQ-4 recipe.
- [ ] Live published header carries exactly one `["b", …, "pointer"]` after install — requires strfry; ADR OQ-4 recipe.
- [ ] The community-superset `IS_A_SUPERSET_OF` link is untouched (OQ-3) — verified by the Reviewer via diff; no behavioral test added (this story does not touch that block).

## Test infrastructure

- **Test framework:** Node built-in runner (`node test/test.js`, entry registered at all 4 points). No new framework (JS-without-build).
- **Behavioral-unit tests** require only `require('../src/api/neo4j/eventSync.js')` — they run on the host with no services. (`eventSync.js` prints two "Config file /etc/brainstorm.conf not found" warnings on load; these are harmless module-init logs, not test failures.)
- **Source-contract tests** read `src/firmware/install.js` and `firmware/active/manifest.json` from disk — no services needed.
- **Concept Graph API / Neo4j / strfry:** NOT required for this suite. They ARE required for the ADR OQ-4 reinstall-then-inspect verification (manual/integration), which is the authoritative emitter check:
  - **Prerequisite for OQ-4 verification:** `POST /api/firmware/install` on an instance whose manifest carries the `nostr-relay` `communityReference`.

## How to run

```
node test/b-tag-primitive.test.js     # this suite alone
npm test                              # full aggregator (b-tag-primitive registered)
```

## Verification — red phase

The new tests fail with the current code (the `b` branch in `buildImportCypher` and the emitter in `pass_communityReferences` do not exist yet). Confirmed on 2026-06-17 on branch `feat/b-tag-primitive`.

`node --check test/b-tag-primitive.test.js` → clean (no syntax error).
`node test/b-tag-primitive.test.js` → **5 passed, 11 failed.**

The 11 failures are all **real assertion failures for the right reason** (feature absent), not load/import/syntax errors:

```
--- b-tag primitive tests (epic community-reference, Story 38) ---
  FAIL  AC-2: a pointer-typed b tag derives a header-level REFERENCES edge with source='b-tag'
        pointer b tag must derive a REFERENCES edge, but no REFERENCES appears in the Cypher.
  FAIL  AC-2: a b tag with the type element ABSENT also derives REFERENCES{source:'b-tag'} (absent reads as pointer)
        an untyped b tag (absent element 3) must derive REFERENCES{source:'b-tag'} — the fail-safe pointer reading (wire spec :41). Got no such edge.
  PASS  AC-2: the pointer b edge points child→target (no source-only stub; the published event is the sole producer)
  FAIL  AC-3: an inherit-typed b tag derives INHERITS_FROM (no source property)
        an inherit-typed b tag must derive an INHERITS_FROM edge, but none appears.
  PASS  AC-3 (gate): pointer and absent types do NOT derive INHERITS_FROM (gate keys on explicit 'inherit')
  FAIL  DIRECTION: the b edge is child→target and is NOT flipped to target→child
        could not find a child→target REFERENCES MERGE; the b edge derivation is missing or malformed.
  FAIL  AC-5 (derivation idempotency): the b edge is built with MERGE, not CREATE (re-import yields one edge)
        the b-tag REFERENCES edge must be created with MERGE (idempotent), not CREATE.
  FAIL  AC-5 (emitter idempotency): a second install is suppressed by the never-clobber b-presence check
        pass_communityReferences must contain a never-clobber b-presence check (e.g. tags.some(t => t[0] === 'b')) …
  FAIL  AC-1: the emitter appends ["b", <headerATag>, "pointer"] to the local header
        pass_communityReferences must append a pointer-typed b tag literal of the shape ['b', <headerATag>, 'pointer'] …
  FAIL  AC-1: the emitter re-signs through the existing TA signer (signAndFinalize / TA key path), not a hardcoded key
        the emitter must re-sign the republished local header through the existing TA signer …
  FAIL  AC-1/AC-6 (never-clobber): an existing b of ANY type/target suppresses the seed (check is t[0]==='b', not type-specific)
        the never-clobber check must be t[0] === 'b' (ANY existing b suppresses the seed …) …
  FAIL  AC-4: the firmware-community stub MERGE is gated on the absence of a seeded b (skipped when a b is present)
        the firmware-community stub MERGE must be gated so it is SKIPPED for a header that now carries a b …
  PASS  AC-7: no DELETE/DETACH of firmware-community REFERENCES edges is introduced (legacy stubs stay harmless)
  FAIL  OQ-1: the local-header b seed is reachable even when the community fetch fails (not nested under the fetch-success guard)
        OQ-1 cannot be evaluated: no pointer-b seed literal found in pass_communityReferences (AC-1 must land first).
  PASS  AC-8: tag / nostr-user-tag / tag-pinning carry NO communityReference (stub-trap guard)
  PASS  AC-8: nostr-relay remains the ONLY concept carrying a communityReference (no new ones added)

b-tag-primitive: 5 passed, 11 failed
```

### Why 5 tests already pass (intentional green-and-stay-green guards)

These are **invariant guards** paired with the red positive tests — they assert "the wrong thing must NOT appear," which is trivially true today but must REMAIN true after the Implementer adds the `b` branch:

- **`AC-2: …no source-only stub…`** — `buildImportCypher` must never emit `source='firmware-community'`. True now; must stay true.
- **`AC-3 (gate): pointer/absent do NOT derive INHERITS_FROM`** — true now (nothing derives it); the Implementer must keep pointer/absent off the `INHERITS_FROM` path while making the positive `AC-3` test go green.
- **`AC-7: no DELETE/DETACH of firmware-community`** — the diff must not introduce a sweep. True now; must stay true.
- **`AC-8 ×2`** — the stub-trap guard: the manifest must stay byte-equivalent for the real tag concepts. True now; must stay true (this is the whole point of AC-8).

A correct implementation flips all **11 reds to green** while keeping all **5 greens green**.

## Notes for the Implementer

1. **`buildImportCypher` for kind-39998 uses `uuid = <kind>:<pubkey>:<dTag>`** (the header's own a-tag) and MATCHes the event node by that `uuid`. The behavioral tests assert the `child` side is the header's a-tag (`39998:<TA>:nostr-relay`) and the `target` side is the `b` value. The existing `e`/`a` REFERENCES are **tag-level** (`NostrEventTag`→ref); your `b` edge is **header-level** (event node → target). Don't copy the `t${i}` MATCH — MATCH the event node `e` / a `child` bound to `uuid`. (ADR Impl §2.)
2. **Gate strictly on `tag[2] === 'inherit'`.** Absent/`'pointer'`/anything-else → `REFERENCES{source:'b-tag'}`. Never `tag[2] !== 'pointer'`. (Two behavioral tests pin this.)
3. **Use `MERGE` for the relationship, never `CREATE`** — idempotency (AC-5) is asserted behaviorally.
4. **Direction is child→target / child→parent — do NOT flip** (wire spec :46). The direction test looks for a `MERGE (…child…)-[…REFERENCES…]->(…target…)` shaped edge.
5. **Emitter never-clobber check must be `t[0] === 'b'`** (any type, any target). Do not narrow to `t[2] === 'pointer'` — an operator-set `inherit` must also suppress.
6. **Re-sign through the existing TA signer** (`signAndFinalize` / `loadTAKey` / a `republish-header` route) — never hardcode a signing key. The source-contract test looks for one of those seam names.
7. **OQ-1:** place the pointer-`b` seed so it is reachable even when the community fetch returns not-found / pin-mismatch — i.e. before the `if (!ev)` early `continue`, or hoist it out of the fetch-success guard. If you restructure the control flow in a different-but-valid way, update the OQ-1 assertion in the test and note it in the Implementation phase (its message flags this).
8. **AC-4 gate:** keep the existing `SET r.source = 'firmware-community'` MERGE in the source (AC-7 requires it to stay) but wrap it so it is **skipped** when the header carries a seeded `b` (e.g. `if (link.seededB) { /* derives from event */ } else { …stub MERGE… }`).
9. **Authoritative behavioral check for the emitter** is the ADR OQ-4 reinstall-then-inspect recipe (live strfry + Neo4j); the host suite covers it at source-contract only.
