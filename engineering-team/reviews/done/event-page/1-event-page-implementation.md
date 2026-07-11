# Review: Epic event-page — /event view + by-id/by-author read path (stories #1–#3)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-18
**Diff:** `git diff origin/staging..feat/event-page` (base `da269ba8`, impl `efeca754`) — **7 files, +570 / −20** (additive). (NB: the local `staging` ref is stale at `d6e41193`; reviewed against `origin/staging`, the real fork point.)
**Stories:** `event-page/{1-event-read-path, 2-event-page-param-render, 3-event-page-search}.md`
**ADRs:** `event-page/{0001-event-read-path, 0002-event-page-ui}.md`
**Method:** Reviewer audit + a 3-lens adversarial sub-review (correctness / ADR-conformance / invariants-security), 10 agents, every finding independently verified (**7 raw → 7 confirmed real**: 2 non-blocking-correctness, 1 non-blocking-hygiene, 4 nits).

## Quality gates (run by the reviewer)
- [x] **`npm test` (new suites)** — `event-page-read-path` **21/21**, `event-page-ui` **12/12**.
- [x] **`npm test` (full)** — only the **same 12 pre-existing environmental** tag/pin publish-flow suites FAIL (`fetch failed`, need the live stack); `live-feed` (×2) + `note-surfaces` (×2) all PASS → **no regression**.
- [x] **Isolated `vite build`** — ✓ exit 0 (the reworked page + new util/hook compile).
- [ ] Playwright / rendered-UI — not run locally (parallel session owns the Docker stack); the rendered proof (reference `nevent`, author lookup, search submit, `naddr`, 1280px) is the **staging** capstone (ADR §Testability).
- [n/a] lint/typecheck — not configured.

## Spec & ADR adherence
- [x] **Option A honored:** `src/api/_shared/relaySource.js` extracted; `feedReadPath.js`, `userNotesReadPath.js`, `NoteCard.jsx` are **byte-unchanged** (confirmed: not in the diff name-list). No `App.jsx` change (route pre-existed). `enrichNotes` reused, not re-implemented.
- [x] Discriminated outcomes (`OK`/`UNSUPPORTED_KIND`/`INVALID_EVENT`/`NOT_FOUND`/`NO_AUTHOR_NOTE`/`INVALID`), handler `INVALID`→400; 6-param precedence; `naddr` client-side (no fetch); kind-gate; relay union assembled (hints + outbox + well-known/fallback).
- [~] **Deviation (finding #1):** the page drops the `nevent`-carried author, so the by-id **outbox** leg of the relay union is unreachable from the UI (the server supports it). See Findings.
- [~] **Spec-fidelity gap (finding #2):** with the real verifying `SimplePool`, `INVALID_EVENT` is unreachable in production (folds into `NOT_FOUND`). See Findings.

## Architecture invariants (CLAUDE.md)
- [x] **POV-first:** correct — `/event` resolves an event by id or an author's *own* latest note; nothing point-of-view-dependent, no per-POV truth computed.
- [x] **No hardcoded TA pubkey:** the well-known set resolves the TA at runtime via `getOwnerAssistantPubkey()` in `_shared/relaySource.js:75`. No literal pubkey anywhere.
- [x] **Security:** `HEX64` validated before any relay/Neo4j I/O (`buildEvent` `INVALID` short-circuit); the copied `strfry scan` is reached only with validated/local pubkeys; outbox r-tag parsing tolerates malformed tags; `verify()` only ever sees fresh relay JSON (no verified-Symbol caching trick). No secrets, no `console.log`/debug, no commented-out/dead code, no new dependency.

## Findings

### Required before merge (2)
1. **`ui/src/pages/BrainstormEvent.jsx:42–48` — `nevent` author dropped → by-id outbox leg never engaged (real, non-blocking).** `fetchArg` sets `author: target.mode === 'author' ? target.author : undefined`, so for an `nevent` (mode `'id'`, which carries `author`) the author hint is forced to `undefined`. `buildEvent` *does* consult the author's outbox for a by-id request when an author rides along (`eventReadPath.js:101-104`), but the UI never sends it — so the relay union for `nevent` links is only hints + well-known, missing the author-outbox the AC/ADR specify (the **most common** case: note `nostr:nevent` links carry the author). The event still resolves via well-known + the nevent's own hints, so non-blocking — but a direct spec miss. **Asked change:** forward the author regardless of mode — `author: target.author` (or pass the whole id/author target; `useEventResolve` reads only `{id,author,relays}`). *No test currently covers by-id+author union — add one.*

2. **`src/api/event/eventReadPath.js:106–111` — the distinct `INVALID_EVENT` ("does not validate") outcome is unreachable in production (real, non-blocking; operator-specified behavior).** The real `SimplePool` gates events through `verifyEvent` at relay-receive (`pool.js:393`), so a signature-failing event is dropped upstream → `events.find(e=>e.id===id)` is `undefined` → `NOT_FOUND`. `buildEvent`'s own `verify()` only ever sees already-verified events, so the `INVALID_EVENT` branch is dead with the real dep (the B3 test reaches it only via an injected fake). **Safety holds** (an unverified event is never shown as `OK` — it becomes `NOT_FOUND`). But the operator explicitly asked for a distinct "does not validate" indication, and Story #1's AC requires the four by-id outcomes to be *mutually distinct* — neither the story nor ADR documents this fold. **Decision needed (see gate):** either (a) make it reachable — the event path fetches with a **no-verify** `SimplePool` (`new SimplePool({ verifyEvent: () => true })`, confirmed supported) so `buildEvent`'s `verify()` is the sole gate; this stays in the event path's own `querySync` so `_shared`'s verifying `querySync` is untouched (the feed relies on it as its only gate); or (b) document the fold-into-`NOT_FOUND` as a known limitation in ADR 0001 + Story #1.

### Non-blocking (hygiene) — fix
3. **`engineering-team/follow-ups.md` (absent) — the deferred consolidation isn't actually logged** despite ADR 0001, `_shared/relaySource.js`, and this epic asserting it is. **Asked change:** add the entry ("re-point `feedReadPath`/`userNotesReadPath` to `_shared/relaySource.js`, delete their private copies — behavior-preserving, guarded by their read-path suites").

### Nits (optional)
4. **`src/api/_shared/relaySource.js:4–9,22` — "copied verbatim" overstates it:** `FALLBACK_RELAYS` order differs (here primal/nos.lol/damus; feed/user-notes damus/primal/nos.lol). Harmless (order-agnostic union), but soften the comment or align the order.
5. **`test/event-page-read-path.test.js` B6 — doesn't assert the by-author outcome carries exactly one item** (asserts the chosen note's content/pubkey only). Cheap to tighten.
6. **Story #2 1280px-no-overflow AC** has no automated test (deferred to the staging capstone, by design — `bsp-content` is width-capped + `bsp-note-card-text` wraps). Acceptable.
7. **Story #3 search "resolves like the URL param" loop** is verified at source level (classify is executed; the navigate→re-render→resolve loop is the staging capstone). Acceptable.

## Verdict (initial)
**CHANGES_REQUESTED** — two real (non-blocking) correctness items (#1 `nevent`-author/outbox; #2 unreachable does-not-validate) + log the deferred follow-up (#3). All other gates pass.

## Re-review (post-fix) — 2026-06-18, commit `f227fa22`
Operator chose "deliver the distinct outcome." The Implementer applied:
- **#1 resolved.** `BrainstormEvent.jsx` `fetchArg` now forwards `author: target.author` regardless of mode → an `nevent`'s embedded author reaches the read path, so `buildEvent` consults that author's **outbox** in the by-id relay union. Covered by new tests **B13** (by-id+author → outbox in union) and **U11** (page forwards the author).
- **#2 resolved (delivered).** The event path now fetches via a **no-verify `SimplePool`** (`new SimplePool({ verifyEvent: () => true })`) so `buildEvent`'s own `verify()` is the sole gate — a bad-sig event located by id now surfaces as the distinct **`INVALID_EVENT`** ("does not validate") instead of folding into `NOT_FOUND`. The by-id branch was hardened to pick the **verifying** match among id-collisions (new test **B14**). `_shared/relaySource.realQuerySync` stays verifying (the feed's only gate) — the two `querySync` variants are intentionally distinct (documented in code + the follow-up).
- **#3 resolved.** The consolidation follow-up is now logged in `engineering-team/follow-ups.md` ("Consolidate relay-sourcing into `_shared/relaySource.js`"), including the don't-unify-the-two-querySync caveat.
- Nits #4 (single-item assert) and #7 (comment) applied; #5/#6 (1280px + search e2e) remain the staging capstone, by design.

Re-verification: `event-page-read-path` **23/23**, `event-page-ui` **13/13** (the +3 new tests pass); all changed files compile (`node --check` + esbuild). The fix touches only event-page files (feed/note-surfaces read none of them) → no regression; their suites stay green.

## Verdict
**PASS** — all acceptance criteria covered by passing tests; ADR-conformant (Option A; `feedReadPath`/`userNotesReadPath`/`NoteCard` byte-unchanged); architecture invariants (POV-first, no TA hardcode) honored; the two real findings fixed and re-verified, the operator-specified does-not-validate outcome now delivered. Ready for the deploy chain (`cycle-staging`).
