# Test Plan: Story 1 — Live-feed read path: hermetic tests, legible degrade

**Story:** `engineering-team/stories/test-hermeticity-ci/1-feed-hermeticity.md`
**ADR:** — (Architecture skipped per the ratified book plan; design record = story Background + book frame bullet 1)
**Date:** 2026-07-05

## Coverage map

All tests live in the existing suite `test/live-feed-read-path.test.js` (the module's behavioral suite), matching its house style (local `test()`/`run()` registry, injected fakes, no new frameworks). The new **H-block** pins the fifth injectable dependency **`getTaPubkey`** (read like its four peers: `options.deps?.getTaPubkey ?? options.getTaPubkey ?? <real runtime-resolved helper>`) and the legible-degrade rule. `makeDeps()` now carries a default `getTaPubkey` fake, so *every* behavioral test runs fully injected once the seam exists.

| Criterion | Test | Level | Fails now because |
|---|---|---|---|
| AC-1 (bare-copy hermeticity) | **Procedural check** (below) + `H4` as the deterministic in-suite proxy for the bare-checkout failure class; fixture-dep tests (M1/M2/M4/M5/E2) now **skip visibly** when `nostr-tools` is absent instead of failing | procedure + unit | bare copy: B9 + H1–H4 fail |
| AC-2 (doubles observably exercised) | `H1` (set path: query built from the *injected* TA pubkey; runCypher double runs), `H2` (empty-set path: both doubles invoked) | unit | seam ignores `getTaPubkey`; today the handle comes from the real helper |
| AC-3 (legible degrade) | `H3` (runCypher throws → fallback + cause + "fallback" in log), `H4` (TA-read throws `MODULE_NOT_FOUND` class → fallback + cause logged), `H6` (edge: TA resolves to `null` → clean fallback, no nonsense-handle "set") | unit | the catch is silent; injected fake ignored |
| AC-4 (unchanged results; no host-config reads) | `H5` (fully-injected run emits no `brainstorm.conf` / `BRAINSTORM_RELAY_PUBKEY` noise) + the 30 pre-existing tests staying green (regression) | unit | noise prints today (captured in H5's failure message) |
| AC-5 (no TA literal; runtime resolution) | `H7` — standing guard: no 64-hex literal in `feedReadPath.js` (**passes pre- and post-** by design) + Reviewer diff audit of the default helper chain | structural + review | guard-type criterion; the runtime-resolution *default* is inherently review-verified |

## Edge cases

- [x] `getTaPubkey` returns `null` (TA identity absent on a misconfigured droplet) → `H6`: fallback, no crash. *Implementer latitude:* whether null logs is not pinned; the two **error** paths (H3/H4) must log.
- [x] `MODULE_NOT_FOUND`-class failure — deterministic simulation via an injected throwing fake (`H4`), so the bare-checkout class is exercised in **every** environment, not just bare ones.
- [x] Fixture deps vs module deps: five tests need `nostr-tools` *as a fixture* (nip19 encoding). They now skip visibly when it's absent (`requireNip19OrSkip`). The module under test must need **no** npm packages at feed-assembly time.
- [x] Vacuous green: H1/H2's invocation counters make a bypassed double a *failure*, not a silent pass.

## Test infrastructure

- Framework: existing Node runner (`node test/test.js`); no new frameworks. Suite-local additions: `requireFixtureDep`/`skip`/`requireNip19OrSkip` (fixture-dep skips), `withCapturedConsole` (log assertions), skip support in the suite's `run()` (returns `skipped` only when nonzero — the aggregator line is unchanged in installed environments; *surfacing skips in the summary is story 2's scope*).
- Concept Graph API / stack: **not required.** No firmware state, no fixtures beyond in-file fakes.
- The `39999:<ta>:the-set-of-general-purpose-relays` handle format is asserted as reached-by-query (substring over `cypher + params`), not via any parameter-name detail.

## How to run

```
node -e "require('./test/live-feed-read-path.test.js').run().then(r=>console.log(JSON.stringify(r)))"   # this suite alone
npm test                                                                                                  # full aggregate
```

**AC-1 procedural verification (bare copy — run at Implementation and again at Review):**

```
BARE=$(mktemp -d)   # MUST be outside the repo tree — .claude/worktrees/ inherits the parent's node_modules
git archive HEAD | tar -x -C "$BARE"
cd "$BARE" && node -e "require('./test/live-feed-read-path.test.js').run().then(r=>console.log(JSON.stringify(r)))"
```

Expected **post-implementation**: `{"pass":32,"fail":0,"skipped":5}` — zero failures; exactly the 5 fixture-dep skips (M1/M2/M4/M5/E2), each printing its reason; B9 **passes** (does not skip). Expected in installed environments post-implementation: `{"pass":37,"fail":0}`.

## Verification

The new tests fail with the current code, for the right reasons (assertion messages, not import errors). Confirmed 2026-07-05 at commit `e265d772`:

**Installed checkout** — `{"pass":31,"fail":6}` (H1–H6 fail; H7 guard + all 30 pre-existing pass):

```
✗ H1 … got: MATCH (s:Set {uuid:$h})… (query built from the real helper's pubkey, not the injected one)
✗ H2 … the injected getTaPubkey double must be invoked — the TA-pubkey read is part of the injectable seam, not a hidden require
✗ H3 … expected "neo4j unavailable (H3 sentinel)" in console output — today the catch is silent;
       captured: "Config file /etc/brainstorm.conf not found\nUsing default value for BRAINSTORM_RELAY_PUBKEY: null"
✗ H4 … a TA-read failure must degrade to 'fallback'; got "set" (the injected throwing fake was ignored)
✗ H5 … captured: "Config file /etc/brainstorm.conf not found\n…" (the host-config read happening live)
✗ H6 … relaySource must be 'fallback' (not a 'set' resolved from a 39999:null:… handle); got "set"
```

**Bare copy** (git archive → scratchpad, outside the repo tree) — `{"pass":27,"fail":5,"skipped":5}`: B9 still fails misleadingly (the bug), H1–H4 fail, M1/M2/M4/M5/E2 skip visibly. H5/H6 pass vacuously in the bare environment pre-fix (the require throws before the noise/set path) — the installed run above is the authoritative pre-implementation red.
