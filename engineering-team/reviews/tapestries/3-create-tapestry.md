# Review: Story 3 — Create a Tapestry (members-only authoring)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-07-24
**Diff:** `git diff origin/staging..HEAD` (commits 8f588562 tests, 9a0998e5 impl)
**Method:** reviewer-run gates + 4 independent, fresh-context adversarial reviewers (each tasked to
*refute* a claim), each permitted to probe the live graph at `localhost:7778`.

## Quality gates (run by reviewer, not trusted)

- [x] `node test/create-tapestry.test.js` (create-tapestry suite) — **18/18 pass** (P1–P9, S1–S6, R1–R3).
- [~] `npm test` (full runner) — not run to completion: hangs environmentally on live-stack suites
  (known; the stack-free differential is the binding CI gate). The create-tapestry suite is registered
  in the **live** `overallOk` chain (`test/test.js:1024`, before the severed terminator — OPEN.md #43),
  verified by the scope/arch reviewer.
- [~] `npm run test:playwright` — spec authored (`tests/brainstorm/tapestry-create.spec.js`), server-gated
  (runs in the cycle-staging smoke). **Gap:** E6 (own-key) asserts the publish payload but NOT the
  post-create navigation, so it does not catch the blocking bug below.
- [x] `vite build` — compiles; bundle provably contains the worktree source.
- [x] Read-path integrity — `tapestryGraphModel.js` / `useTapestryGraph.js` / `TapestryDetail.jsx` /
  `TapestryIntegrationGraph.jsx` absent from the diff; directory query unchanged.
- _Lint / typecheck — not configured; skipped per house rules._

## Spec adherence
- [x] Owner-gated (AC) — **stands.** Form is truly absent for non-owners (`NewTapestry.jsx:36-46`
  early-returns before any form JSX); directory button gated (`Index.jsx:94-98`); server refuses
  non-owner TA-signing (`publishEvent.js:36-38`, 403).
- [x] Compose / Publish shape (AC) — kind-39999, z-tag `39998:<TA>:tapestry`, one node + one import per
  member, members-only (`relationshipTypes`/`relationships` empty). Pinned by P1–P6.
- [x] Signing selector, owner-enforced (AC) — TA default + own-key; server 403 is the real TA gate;
  client-sign is permissionless (honest, decentralized-first).
- [ ] **Round-trips (AC) — FAILS for the own-key path** (blocking finding 1): a successful own-key
  publish navigates to a non-existent coordinate → "Tapestry not found."
- [x] Validation & failure visible (AC) — empty title / zero concepts block before any publish
  (`NewTapestry.jsx:57-58`, `buildTapestryDraft` throws); signer-absent / signer-mismatch / 403 all
  surface via the catch. (One edge: retry-after-false-error — non-blocking finding 3.)

## ADR adherence
- [x] Files, layering, and module boundaries match ADR 0003 §Implementation (pure `.mjs` builder, hook,
  page rewrite, gated button). No new dependencies. No firmware change (correct — no concept defs
  changed). Picker sourced from strfry kind-39998 (Decision 1-A), not Neo4j.
- [x] Decision 2-A dedup **mechanism** verified live: for all 41 TA concept headers, `word.slug` equals
  the concept-graph header-node slug (0 mismatches) — no member renders as a slug-duplicate. *But* the
  import-uuid derivation has a naming bug (non-blocking finding 2).

## Concept-graph integrity
- [x] Handles are `kind:pubkey:slug`; TA pubkey runtime-resolved (`useConfig().taPubkey`), never hardcoded.
- [x] No concept definitions changed → no firmware reinstall needed. New code reads via strfry
  (`queryRelay`), consistent with ADR tapestries/0002.

## Things tests can't catch
- [x] No secrets, no `console.log`/debug, no commented-out code, no TODOs in the impl files.
- [x] No XSS — title/description render only through React text interpolation (`TapestryDetail.jsx:124-125`,
  `JsonView`, `DataTable`); no `dangerouslySetInnerHTML`.
- [x] POV-first / decentralized-first honored — no global trusted-set precompute; publication ungated
  (only TA-impersonation is gated).

## Findings

### Blocking
1. **`ui/src/pages/tapestries/useCreateTapestry.js:97` + `tapestryDraft.mjs:39`** — the own-key
   (`signAs === 'client'`) path returns a **TA-namespaced** uuid for an event actually authored by the
   **owner's** key, so the post-create redirect 404s. The event is signed with `pubkey: authorPk`
   (`useCreateTapestry.js:82`) → real coordinate `39999:<ownerKey>:<dTag>`, but `create()` returns
   `draft.uuid` = `39999:<taPubkey>:<dTag>` (`tapestryDraft.mjs:39`); `NewTapestry.jsx:62` navigates
   there; `useTapestryGraph.js:19-24` queries `authors:[taPubkey]` and finds nothing →
   `TapestryDetail.jsx:105-107` "Tapestry not found." (The TA path works only because there author ==
   taPubkey. The tapestry *is* reachable via the directory, which recomputes the uuid from `ev.pubkey`
   — so this is a broken *redirect*, not a lost tapestry.) Found independently by the publish-paths and
   owner-gating reviewers; confirmed by trace. **Fails the Round-trips AC for the own-key option.**
   **Asked change:** return the uuid keyed to the *actual signer* — client → `39999:<authorPk>:<dTag>`,
   assistant → `39999:<taPubkey>:<dTag>`. Keep the z-tag `39998:<taPubkey>:tapestry` (concept handle,
   always TA). Add coverage: a unit assertion that the returned uuid's author segment matches the
   signing identity per `signAs`, and/or extend Playwright E6 to assert navigation to the owner-keyed
   coordinate (closes the test gap that let this through).

### Non-blocking (please address in the same fix pass where cheap)
1. **`ui/src/pages/tapestries/tapestryDraft.mjs:55` + `useCreateTapestry.js:30`** — the `*-concept-graph`
   import uuid is built from the header's **d-tag** (`shortSlug`), but derived concept-graphs are named
   from `conceptHeader.oSlugs.singular`. These match for 40/41 live concepts but **diverge for
   `nostr-event-tag`** (d-tag `nostr-event-tag`, `oSlugs.singular` `nostr-event-tagging`): the built
   import `39999:<TA>:nostr-event-tag-concept-graph` does not exist (actual:
   `nostr-event-tagging-concept-graph`), so that member's import never resolves and it renders isolated
   (no superset/spine). Degrades gracefully (renders once, no crash), but is a latent correctness bug.
   **Suggested:** capture `conceptHeader.oSlugs.singular` in `toConcept` and build the import uuid from
   it (the header *handle* stays d-tag-based).
2. **`ui/src/pages/tapestries/NewTapestry.jsx:52-68`** — `onSubmit` has no `if (submitting) return`
   re-entry guard (only the button's `disabled`), and each `create()` mints a fresh random d-tag, so a
   false-negative publish error (e.g. `strfry import` timeout that actually landed, `publishEvent.js:70`)
   followed by a retry yields a *second* distinct tapestry. Low-likelihood; **suggested:** add the
   re-entry guard. (True idempotency across retries is out of scope for v1 — note it.)
3. **`test/create-tapestry.test.js` P5** — asserts the dedup invariant but is tautological w.r.t. it: it
   only re-echoes the fixture inputs `buildTapestryDraft` copies, never cross-checking a real
   concept-graph header slug or import resolvability; its `dog`/`golden-retriever` fixtures
   (`shortSlug == oSlugs.singular`) structurally cannot exercise the divergence in non-blocking #1.
   **Suggested (Tester):** add a fixture where `shortSlug != oSlugs.singular` and assert the import uuid
   is built from `oSlugs.singular`.
4. **`useCreateTapestry.js` / `Index.jsx` comments** — "owner-only" wording, but `hasAdminAccess` admits
   `owner || admin` (client and server agree, so no bypass — wording nit only).

### Harness friction (→ OPEN.md, type `meta`)
1. A worktree's `ui/node_modules` symlinked to main's causes a worktree `vite dev` server to serve the
   **main** checkout (my new files 404 → blank app), making a dev-server browser smoke useless from a
   worktree. Verify worktree UI via the Node suite + `vite build` + code reading instead. (Confirmed
   this session; matches the "shared-checkout" caution in session notes.)

## Verdict
**CHANGES_REQUESTED** — one blocking defect (own-key redirect 404, a Round-trips AC failure). The
architecture, security, scope, and read-path integrity are all sound; the fix is small and localized to
the uuid the hook returns, plus the two cheap non-blocking correctness items and a test to close the gap.

## On PASS (same commit)
- [ ] *(Not applicable — CHANGES_REQUESTED. Story stays Draft; kick back to `/implement-feature`.)*
