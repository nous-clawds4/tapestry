# Review: Story 1 — Show which relays hold the Treasure Map

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-07
**Diff:** `git diff fe98d507...HEAD` (implementation commit `070ade67`)

## Quality gates (run by reviewer, not trusted)

- [x] **Story suite** — `test/treasure-map-relay-presence.test.js`: **35 passed, 0 failed**. Re-run
      by the reviewer after the Phase-4 loading-state fix, not taken on report.
- [x] `npm test` (full gate) — **`Overall: FAIL`**, and the reviewer does **not** wave it through:
      3 suites red (`tl-membership-method-selector` 11/1, `tl-weighted-sum-method` 6/1,
      `tl-certainty-method` 4/3), 45 skipped. **This story's suite is
      `PASS (35 passed, 0 failed)`.** The three failures are the pre-existing condition in
      **OPEN.md row 191** — their `L0 GUARD` refuses to run unless the deployment is in local-only
      publish mode, and this machine deliberately allows external publishing:
      `refusing to run: BRAINSTORM_PUBLIC_LOCAL_ONLY must be active (got {"success":true,"allowExternalPublish":true})`.
      Row 191 was filed 2026-09-07 at the *previous* book's close, before this story began.
      See **Baseline** below — pre-existence is proven, not asserted.
- [x] `node --check` on `test/test.js` and the new suite — both clean.
- [x] **Live end-to-end** (local stack, `:7778`) — the endpoint reproduces the pre-implementation
      baseline exactly and correctly reclassifies all four unreachable modes. Evidence below.
- [ ] `npm run test:playwright` — not applicable; no Playwright spec touches this surface.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] **Build** — `npm --prefix ui run build` succeeds (the page is bundled; no import errors).

### Baseline — the three red suites are not this diff's

Three independent lines of evidence, in ascending strength:

1. **Blast radius.** None of the three suites references anything this diff touches —
   `grep -c 'relaySource|relay/presence|treasureMap|TrustedAssertions|RelaySettings|aTapestryInstanceRelays'`
   returns **0** for each.
2. **Mechanism.** Every failure descends from one `L0 GUARD` that reads a *live server setting*
   (`allowExternalPublish`), not from any code. `src/config/defaults.json` — the only config file
   in the diff — carries no publish-policy key, so the diff cannot move that guard.
3. **Direct measurement.** `tl-certainty-method` run from the **unmodified main checkout**, which
   sits at this branch's base commit `fe98d507`, gives **4 passed, 3 failed** — identical to the
   result inside the full gate. The failure exists without this diff.

The gate is therefore red on a known, ledgered, environment-posture condition that this story
neither caused nor can fix (row 191 explicitly warns *against* "fixing" it by flipping the
machine's posture, which the operator wants as-is). Every suite that could plausibly be affected
by this diff is green, including all five sentinels.

### Live evidence

The story's baseline (measured in Phase 1, before any of this code existed) was: owner's Map
`27a0ee92…` present at 5 external locations + local, absent from 8. The shipped endpoint
reproduces that set exactly — `6 of 12 hold a copy` in the rendered panel.

The four failure modes that motivated the ADR, re-checked through the new endpoint:

| Case | `/api/relay/external` (old) | `/api/relay/presence` (new) |
|---|---|---|
| DNS does not resolve | `success:true, events:[]` → *absent* | `unreachable` |
| TCP refused | `success:true, events:[]` → *absent* | `unreachable` |
| HTTPS host, not a relay | `success:true, events:[]` → *absent* | `unreachable` |
| Blackholed IP | `success:true, events:[]` → *absent* | `unreachable` |

Two *real* relays also moved category: `nip85.nostr.band` and `relay.nostr.band` report
`unreachable` from this instance rather than `absent`. That is the feature working — the old path
had been asserting "does not have it" about relays it could not reach.

Validation branches rejected as specified (400 each): `http://` scheme, comma-separated relay
list, malformed pubkey, negative kind.

## Spec adherence

- [x] Every acceptance criterion has a passing test.
- [x] No criterion is silently dropped.
- [ ] No behavior added that isn't in the story — **three additions**, all judged in-scope; see
      *Additions beyond the ADR*.

| AC | Tests | Verdict |
|---|---|---|
| 1 — coverage from configuration, not code | `C1`, `T1`, `T2`, `S2`, `S4`, `S5` | met |
| 2 — a relay holding this version says so | `P1`, `T3` | met |
| 3 — a relay holding a different version says which | `T4`, `T5`, `P8` | met |
| 4 — absent ≠ unreachable | `P2`, `P3`, `A7` | met, and confirmed live |
| 5 — the check never degrades the page | `S3`, `S6`, `R1`, `R2` | met; observed live (9 rows
  rendered while 2 were still resolving) |

AC-1's "without a code change" is genuinely true: `aTapestryInstanceRelays` is a
`RELAY_GROUPS` row (`ui/src/pages/settings/RelaySettings.jsx:12`) over a `defaults.json` group,
and `src/config/settings.js` deep-merges defaults under stored overrides, so existing deployments
inherit the group without operator action.

## ADR adherence

- [x] Files changed match the ADR's implementation notes — all seven items present, none extra.
- [x] Layering respected: the probe sits in `_shared/relaySource.js` beside its siblings; the
      handler is a thin validating shell; comparison is client-side, as the ADR specified.
- [x] No new dependencies. `nostr-tools` and `ws` were already in use, reached through the
      module's existing absolute-path convention.
- [x] Built on `Relay.connect()` + `subscribe()`, **not** `SimplePool` — the ADR's central
      decision (`src/api/_shared/relaySource.js:118, 174-178`).
- [x] The three ADR measurements are each honored in code: the bare-string throw is normalized
      (`:99-104`), connect is retried exactly once and bounded (`:157-165`), and returned events
      are signature-verified before counting (`:189-196`).
- [x] `/api/relay/external` untouched — verified by sentinel `R5` and by reading the file.
- [x] **Firmware reinstall: not required**, correctly — no concept definitions changed.

## Concept-graph integrity

- [x] No handles introduced or altered; the story touches relay *configuration*, not the graph.
- [x] No firmware change, so no reinstall step to call out.
- [x] Orientation for this story was done via `/api/concept-graph/summaries` (56 concepts) and a
      Cypher read of the relay sets — not by reading BIBLE.md.
- [x] No 64-hex pubkey literal in any new or changed UI file (`R4`), per CLAUDE.md's
      per-deployment TA pubkey rule.

## Things tests can't catch

- [x] No secrets committed.
- [x] No leftover debug logging, `console.log`, `TODO`, or commented-out code in the new files.
- [x] The untracked root `node_modules` symlink (a worktree build workaround) is **not** in the
      commit — verified against `git show --stat`.
- [x] **Concurrency:** the fan-out's shared `cursor` is safe on JS's single thread; each effect run
      owns its own cursor and `cancelled` flag, and every `setRows` is guarded by `!cancelled`, so
      a re-run cannot interleave stale rows into fresh state.
- [x] **Security / outbound reach:** the endpoint takes a client-named relay URL, matching the
      posture `/api/relay/external` already has. Scheme is validated, exactly one relay per
      request, pubkey is `^[0-9a-fA-F]{64}$`, kind is `^\d+$`. Repeated or object-shaped query
      params degrade to a 400 rather than reaching the connector. The response returns only
      `id` + `created_at` (`A6`), so nothing extra leaks.
- [x] **A malicious relay cannot fake a divergence** — unverified or off-filter events are
      discarded and the relay reads `absent` (`P6`, `P7`). This is the finding that most deserved
      a test and has one.
- [ ] **Error paths:** two gaps, both non-blocking — findings 1 and 2.

## House rules check

- [x] Concept Graph API authority respected (not applicable to this change; not bypassed).
- [x] No new lint/typecheck/build tooling.
- [x] Per-deployment TA pubkey rule honored — no literal, and no TA pubkey needed here.

## Additions beyond the ADR

Recorded because the Reviewer must notice them, not because any is objectionable:

1. **`configLoaded` loading state** (`TreasureMapRelayPresence.jsx:76, 170-175`) — added in Phase 4
   after self-review found the panel briefly asserting *"No relays configured to check"* while
   `ConfigContext` was still fetching. A false statement about the operator's configuration; the
   fix is correct and in the spirit of AC-5. Justified.
2. **Summary line and all-missing warning** (`:133-140, 202-206`) — "N of M hold a copy" and a
   caution when nothing is serving the Map. Within the story's intent.
3. **`CONNECT_TIMEOUT_MS` / `QUERY_TIMEOUT_MS` exported** — harmless; makes the budgets legible.

## Findings

### Blocking

None.

### Non-blocking

1. **`ui/src/pages/grapevine/TreasureMapRelayPresence.jsx:172-174`** — a *failed* `/api/relays`
   leaves the panel spinning forever. `ConfigContext.jsx:42-45` swallows the error
   (`.catch(() => {})`) and never sets `aRelays`, so `configLoaded` stays false and the panel reads
   "⏳ Loading the relay list…" indefinitely. The Phase-4 fix improved the common case (the load
   window, which is the normal path) and slightly worsened this rare one: the previous copy was
   also wrong but at least terminal. *Optional improvement:* bound the loading state, or have
   `ConfigContext` distinguish "not yet" from "failed" and surface that here.

2. **`src/api/_shared/relaySource.js:157-165`** — connect-timeout race can orphan a socket. If
   `withTimeout` rejects but the underlying `connect()` later *resolves*, that relay is never
   closed, and the ADR's standard is "the connection must not leak on any path". The live run
   shows the timeout does fire (the blackholed-IP probe returned this module's own
   `connection timed out`), so the path is reachable — but a leak additionally requires the
   connect to *succeed* after losing the race, i.e. a working relay slower than the 5s budget,
   which is why this is not blocking. `P9` cannot see it (it tests the paths that terminate).
   *Optional improvement:* attach `.then(r => { try { r.close(); } catch {} }).catch(() => {})` to
   the losing promise.

3. **Test coverage gap — the empty/loading branch has no test.** Addition 1 landed in Phase 4,
   where the Implementer is correctly barred from touching `test/`. `T2` covers the input half
   (null config → zero targets); the rendered branch itself is unverified, and the Implementer
   disclosed that they could not stage the pre-config window live because `ConfigContext` fetches
   before any injectable script runs. *Tester-lane follow-up on the next touch of this suite.*

4. **`ui/src/utils/treasureMap.js:buildPresenceTargets`** — dedupes by exact string, so
   `wss://a.example` and `wss://a.example/` would render as two rows. Plausible in practice given
   the Tapestry instance relays carry a `/relay` path and an operator may paste either form.
   *Optional improvement:* normalize a trailing slash before keying.

5. **`TreasureMapRelayPresence.jsx:137`** — "N of M hold a copy" counts a *divergent* version as a
   copy. Defensible (it is a copy, and the rows disambiguate), but a reader skimming only the
   header could take it as "N hold this version". Wording call, not a defect.

6. **`src/api/relay/presence.js:16`** — scheme check is case-insensitive (`/^wss?:\/\/.+/i`) where
   the sibling `src/api/relay/fetchEvents.js:39` is case-sensitive `startsWith`. No security
   difference — both reach arbitrary hosts by design — but the two endpoints now disagree on
   whether `WSS://…` is a valid relay URL. Note only.

### Harness friction

Both already filed by the Implementer; the Reviewer confirms each independently:

1. **OPEN.md row 192** — CLAUDE.md § House rules claims the repo is bind-mounted into the
   `tapestry` container ("source edits are live"). Confirmed false: `HostConfig.Binds` carries no
   repo path and `docker-compose.yml:30-34` declares only named volumes. The real deploy is
   `docker cp` + `supervisorctl restart`, per the cycle-local skill.
2. **OPEN.md row 193** — `/cycle-local` step 1 fails in a fresh worktree (`vite: command not
   found`); the skill's comment claims the flow works "in any checkout or worktree". Row 193 also
   records the non-obvious trap that root `.gitignore:41` uses `node_modules/` (directory-only),
   so the symlink workaround leaves an entry a `git add -A` would commit — verified via
   `git check-ignore`.

## Verdict

**PASS**

The diff implements exactly what the ADR specified, and the ADR's three empirical findings are
each visible in the code with a test pinning them. The design's central claim — that
`SimplePool` cannot distinguish absent from unreachable and `Relay.connect()` can — is confirmed
end-to-end against real relays, including two production relays that were being mislabeled by the
old path. Every acceptance criterion has a passing test, no shipped behavior was disturbed
(sentinels `R1`–`R5` green), and no concept-graph or firmware surface is touched.

The six non-blocking findings are genuine but none blocks a merge: two are rare-path polish, one
is a Tester-lane coverage gap created by a Phase-4 bug fix that was itself the right call, and
three are notes. Finding 1 is the one worth taking soonest, since it is a permanently wrong
message in a reachable (if uncommon) state.

**On the red gate.** `Overall: FAIL` would normally be disqualifying, and PASS here is a
deliberate, evidenced judgement rather than a shrug: the three red suites are the ledgered row-191
condition, they touch nothing in this diff, their guard reads a live server setting no file in the
diff can move, and the same failure reproduces at the base commit in an unmodified checkout. The
standing risk this creates — that a red-by-default gate trains reviewers to stop reading it — is
row 191's own argument for converting that guard from FAIL to SKIP, and is why the evidence is
recorded here in full rather than summarized as "known failure".

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; result reported in chat, not recorded here.
