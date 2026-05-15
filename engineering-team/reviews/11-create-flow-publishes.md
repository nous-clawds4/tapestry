# Review: Story 11 — Create flow publishes a new community

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-14
**Branch:** `feat/communities`
**Diff:** four commits in the slice:

- `1b654bd5` story: create-flow-publishes (#11)
- `17d8fa8b` adr: 0009 — Create wizard publish path + slug derivation
- `124b83e3` test-plan: create-flow-publishes (#11) — failing tests
- `bee0b2d4` impl: create wizard publishes new community (#11)

**Classification:** Feature / Standard / all five phases applied.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test` — PASS.** Ten suites + Configuration Loading all green:
  - Configuration Loading: PASS
  - treasure-maps-router-preset: 5/5 PASS
  - scheduled-search-and-house-scores-refresh: 12/12 PASS
  - strfry-router-first-boot-config: 3/3 PASS
  - per-query-neo4j-timeout-safety-net: 8/8 PASS
  - communities-ui-scaffold: 26/26 PASS
  - firmware-v1.1.0-finalization: 14/14 PASS
  - gr-community-scoring-and-api: 25/25 PASS
  - discover-swaps-mock-data-for-api: 22/22 PASS
  - nip07-signin-and-writes: 17/17 PASS
  - **create-flow-publishes: 13/13 PASS** (new in this slice)
  - **Overall: 145/145.** No regressions.
- [x] **`cd ui-communities && npm run lint` — PASS.** No new warnings or errors. The existing per-line disables from Slices 3/4 carry forward unchanged.
- [x] **`cd ui-communities && npm run build` — PASS.** Vite 7.3.3, 118 modules, ~652 ms. Bundle: 448.24 kB JS (147.13 kB gzip), 51.39 kB CSS (9.36 kB gzip). ~3 kB JS / ~1 kB gzip growth from Slice 4 — tiny, expected (just the handler + the slugify helper).
- [x] **Browser preview at 1280×900** — Confirmed the wizard's step-0 view renders correctly in the un-signed state. The wizard's wider visual flow + the Review-step gating is verified by source tests (T10) + the documented manual mock-mode walkthrough in the test plan.
- [ ] **`npm run test:playwright`** — N/A. The wizard's publish flow requires a real NIP-07 extension; live verification is staging smoke.
- [x] _Typecheck not configured._

## Spec adherence (vs. story #11 acceptance criteria)

### Publish behavior

- [x] **AC: Two events in sequence on Create button click.** [Create.jsx:42-64](ui-communities/src/pages/Create.jsx#L42) `handleCreate` publishes `buildCommunitiesDListHeader` first ([:48](ui-communities/src/pages/Create.jsx#L48)) then `buildCommunityRecord` ([:62](ui-communities/src/pages/Create.jsx#L62)). T9 verifies source-order.
- [x] **AC: Both events through `publishEvent`.** Confirmed by source.
- [x] **AC: Record only publishes if header `ok: true`.** [Create.jsx:49-53](ui-communities/src/pages/Create.jsx#L49) — header-failure branch returns before the record publish runs.
- [x] **AC: Optimistic join + navigate on both-success.** [Create.jsx:73-74](ui-communities/src/pages/Create.jsx#L73) `onJoin(slug)` then `navigate(\`/community/${slug}\`)`. T13 verifies.
- [x] **AC: Inline error on record failure with header succeeded.** [Create.jsx:67-71](ui-communities/src/pages/Create.jsx#L67) sets `publishError`; the Review-step render below the Footer surfaces it via `<p className={s.publishError} role="alert">`.

### Slug derivation

- [x] **AC: 4 canonical examples + empty-result + null/undefined.** All five tests (T1-T5) pass against [slug.js:18-25](ui-communities/src/lib/slug.js#L18). One-liner regex chain: trim → lowercase → `[^a-z0-9]+` → trim hyphens.
- [x] **AC: Empty slug → inline error before record publish.** [Create.jsx:36-39](ui-communities/src/pages/Create.jsx#L36) — `slugify(name)` empty branch sets `publishError` and returns before the publish path.
- [x] **AC: Pure function exported from `src/lib/`.** Confirmed.

### Wizard wiring

- [x] **AC: Review step shows decisions + relay-default note.** [Create.jsx:282-289](ui-communities/src/pages/Create.jsx#L282) review card has name + description + tags + founding-voices count + the new `.relayNote` paragraph with the inline `<code>communities.brainstorm.world</code>` token. T11 verifies the string.
- [x] **AC: Un-signed Review CTA prompts sign-in inline (not redirect).** [Create.jsx:316-333](ui-communities/src/pages/Create.jsx#L316) — the un-signed branch renders a `.signInPanel` with a Sign-in button calling `handleSignInInline` (which calls `onSignIn`). T10 verifies. The wizard's typed state stays because `Create` doesn't unmount.
- [x] **AC: Publishing state.** Button label flips to "Publishing…" via `disabled || !name.trim()` guard. Back button also disabled during publish ([:301](ui-communities/src/pages/Create.jsx#L301)).
- [x] **AC: Success navigation to `/community/<slug>`.** T13 confirms the navigate call.

### Seed members → record fields

- [x] **AC: Viewer auto-added to seeds.** [Create.jsx:55](ui-communities/src/pages/Create.jsx#L55) `const seeds = Array.from(new Set([viewer, ...seedMembers]))`. T12 verifies. `Set` dedupes if the viewer is already in seedMembers (rare but possible if a developer added themselves via Founding voices).
- [x] **AC: Founder = viewer.** [Create.jsx:62](ui-communities/src/pages/Create.jsx#L62). Confirmed.
- [x] **AC: Topics from `selectedTags`.** [Create.jsx:60](ui-communities/src/pages/Create.jsx#L60). Empty selection → empty topics array; `buildCommunityRecord` skips empty-array topics per Slice 4's optional-tag handling.
- [x] **AC: weightingModel = 'gr-community-default-v1', endorsementThreshold = 0.5.** [Create.jsx:63-64](ui-communities/src/pages/Create.jsx#L63). Hardcoded inline (acceptable per ADR §"Implementation notes"); matches the constants from `src/algos/grCommunity/`.
- [x] **AC: `relay` tags from `DEFAULT_RELAYS`.** Indirectly — `buildCommunityRecord` ([build.js:97-99](ui-communities/src/events/build.js#L97)) falls back to `['wss://communities.brainstorm.world']` when `community.relays` is empty. The Create payload omits `relays`, so the builder's default kicks in. Documented at the buildCommunityRecord layer; Slice 5 doesn't override.

### Edge cases & guards

- [x] **Sign-out partway through.** [Create.jsx:284-334](ui-communities/src/pages/Create.jsx#L284) re-renders on every `signedIn` change. The wizard's local state (`name`, `description`, `selectedTags`, `seedMembers`) survives because Create doesn't unmount; only the Review CTA reflows.
- [x] **Defensive `name.trim().length > 0` check.** [Create.jsx:36-39](ui-communities/src/pages/Create.jsx#L36) handles the empty-slug case. Step 0's Continue is already gated on `name.trim()` so Review without a name is hard to reach; the slug-empty branch is the belt-and-suspenders.
- [x] **`seedMembers.length === 0` at Review.** Step 3's Continue is gated on `seedMembers.length > 0` so the viewer can't reach Review with empty seeds. Even if they could, `seeds = [viewer, ...seedMembers]` would still produce at least one seed (the viewer themselves). Matches PLAN.md §3's "at least one seed" requirement.
- [x] **Slug collision (same viewer, same slug).** [build.js:73](ui-communities/src/events/build.js#L73) emits `["d", slug]` — nostr's replaceable-event semantics replace the prior event with the same `(kind, pubkey, d-tag)` tuple. No client-side detection. PLAN.md §6 Q4 "no hard dedup" honored.

### Hygiene & mock-mode

- [x] **Mock-data imports intact in the wizard's discovery steps.** [Create.jsx:10-17](ui-communities/src/pages/Create.jsx#L10) the prior inline comment from Slice 3 referencing story #9 is preserved verbatim. T14 (from #9) still passes.
- [x] **No mock community names in the published payload.** [Create.jsx:58-65](ui-communities/src/pages/Create.jsx#L58) — `community` payload is constructed from wizard state (`name`, `description`, `selectedTags`, `seedMembers`), never from `communities[].name`. Confirmed by inspection.

### Regression

- [x] **132/132 pre-existing tests pass.** Confirmed.
- [x] **Build + lint clean.** Confirmed.
- [x] **Dev-mode visual review.** Wizard's step-0 renders identically to Slice 0–4; preview screenshot confirms.

No criterion is silently dropped.

## ADR adherence (vs. ADR-0009)

- [x] **Option A — inline handler + `src/lib/slug.js`.** Implemented exactly.
- [x] **No useCreateCommunity hook** (Option B deferred). Confirmed — the handler lives in `Create.jsx` as an async function.
- [x] **No `ensureCommunitiesHeaderPublished` dedup** (Option C deferred). Confirmed — every Create re-publishes the header.
- [x] **`src/lib/slug.js` is one-line slugify.** Matches the ADR's sketch.
- [x] **Two-event serial publish.** Confirmed.
- [x] **Sign-in inline CTA preserves state.** Confirmed.
- [x] **Optimistic state then navigate.** Confirmed.
- [x] **No new dependencies.** `package.json` untouched.

**No ADR deviations.**

## Concept-graph integrity

- [x] **No firmware reinstall required.** Slice 5 produces events that validate against Slice 1's already-installed schemas.
- [x] **`brainstorm-community` schema match.** Required fields (slug, name, description, relays, seedMembers, weightingModel, endorsementThreshold) all present in the payload Create builds. Optional fields (topics, founder) populated when relevant. `nip72Wrapping` not surfaced by the wizard (out of scope; matches PLAN.md §6 Q5.3 — no NIP-72 wrapping UX in v1).
- [x] **`weightingModel` slug matches Slice 2's `WEIGHTING_MODEL_ID`.** Hardcoded `'gr-community-default-v1'`. If a future story introduces other models, this hardcode becomes the place to update.

## Things tests can't catch

- [x] **No secrets.**
- [x] **No leftover debug logging.** Two intentional `console.error`-equivalent paths (the `setPublishError` calls). One `console.log` indirectly via `publishEvent`'s `[publish/mock]` (mock mode only — intended).
- [x] **No commented-out code.**
- [x] **Error paths handled.** Six explicit error codes from `publishEvent` map to friendly inline copy via `publishErrorCopy`. Sign-in errors mapped via `signInErrorCopy`. Both helpers are local to Create.jsx — see Finding NB-1.
- [x] **Concurrency.** `publishing` state guards the button. Double-click while busy is a no-op.
- [x] **Security.** Slug is `lowercase + a-z0-9 + hyphen` only — no XSS / Cypher / SQL surface. Comments-field is in MemberDrawerContent (Slice 4), not this slice. The publish payload is JSON — React's escape pipeline keeps user-input safe in the UI.
- [x] **Race on slug-collision between sequential Creates.** No race — the second publish replaces the first on the relay per nostr replaceable-event semantics. The optimistic `onJoin` is idempotent (`Set.add` is a no-op for existing values).

## House rules check

- [x] **Concept Graph API authority respected.**
- [x] **No new lint/typecheck/build tooling.**
- [x] **Firmware reinstall not required.**

## Story #11 scope items verified untouched

- [x] **`ensureCommunitiesHeaderPublished` dedup** — not added.
- [x] **`useCreateCommunity` hook factoring** — not added.
- [x] **Avatar / banner upload** — wizard doesn't collect; payload omits the `image` tag.
- [x] **Edit publishing** — Edit.jsx Save handler still navigates without writing.
- [x] **Founder-controlled relay set / mirror tooling** — not added; uses DEFAULT_RELAYS.
- [x] **Slug-uniqueness warning** — not added; matches PLAN.md §6 Q4.

The Implementer correctly stayed in scope.

## Findings

### Blocking

_None._

### Non-blocking

1. **NB-1 — `publishErrorCopy` + `signInErrorCopy` duplicated for the third time.** [Create.jsx:357-389](ui-communities/src/pages/Create.jsx#L357) adds another copy of the same `publishErrorCopy` helper that already lives in CommunityDetail.jsx and MemberDrawerContent.jsx (Slice 4 NB-4). `signInErrorCopy` similarly duplicated with Header.jsx's `errorCopyFor`. Total: ~3 places × ~10 lines each. **Trivial cleanup story** — extract both to `src/lib/errors.js` (or merge into `src/lib/glossary.js`). Was non-blocking after Slice 4 review; now it's just more aggressively non-blocking. Worth picking up before Slice 6.

2. **NB-2 — Repeat Create in the same session re-publishes the header.** ADR §"Options considered" / Option C documents this as the accepted cost of not implementing `ensureCommunitiesHeaderPublished`. Idempotent on the relay, but the user sees a NIP-07 prompt for the header every time they create. **Action item for staging smoke / v1.1:** if seed-launching multiple communities at once is painful (3-5 NIP-07 prompts × 2 events each = up to 30 prompt approvals), Option C becomes a real near-term story.

3. **NB-3 — No "create another" path after success.** [Create.jsx:73-74](ui-communities/src/pages/Create.jsx#L73) navigates straight to `/community/<slug>` on success. The brainstorm.world operator seeding 3-5 communities at launch would need to manually navigate back to `/create` each time. Acceptable for v1 — the operator can use the navigation history (back button → MyCircles → "+ Start a circle") to chain creates. **Future polish:** post-success toast with "Create another" affordance.

4. **NB-4 — Round-trip verification still gated on Slice 2 NB-4.** The published community-record lands on `wss://communities.brainstorm.world` but won't surface in `GET /api/communities` until the data sources are wired. So a creator sees their new community on the detail page (because the navigation goes there directly) but reloading Discover may show an empty list until live data flows. **Operationally:** flag this in the staging-smoke checklist. Not a Slice 5 regression; it's the inherited NB-4 from Slice 2.

5. **NB-5 — No edit-the-slug affordance.** Auto-derive only. If a user types "Sunset Hikers" and prefers "sunset-hikers-pdx", they have to change the name. Per ADR (and PLAN.md §6 Q4's no-hard-dedup policy), this is acceptable for v1. Future enhancement: a small "Edit slug" link on the Review step's review card. Not blocking.

6. **NB-6 — The wizard's `setSelectedTags`/`setSeedMembers` arrays are never reset after publish.** If a user creates a community, navigates back to `/create` via the back button (without unmounting `Create`), the prior wizard state is still there. In practice, React Router 7 will unmount the `Create` route on navigation away (which clears state on the next mount), so this is more theoretical than practical. **Worth verifying** in the manual staging-smoke walkthrough: create one community, navigate to `/create` from MyCircles, confirm the wizard starts fresh.

## Verdict

**PASS.**

Slice 5 lands the smallest possible change to make Create's final button do something real: a 25-line `handleCreate` orchestrator that publishes two events in sequence, an 8-line pure-function slugify, and a Review-step CTA that gates on `signedIn` with an inline sign-in fallback that preserves wizard state. 13 new tests + 145/145 overall.

Six non-blocking notes. **NB-1** (third copy of the error-copy helpers) is the most aggressive — worth a cleanup before Slice 6 introduces a fourth surface that needs publish-error mapping. **NB-2** (header re-publish per Create) becomes a real story if the operator's seed-launching flow gets painful.

The PR opened earlier ([nous-clawds4/tapestry#142](https://github.com/nous-clawds4/tapestry/pull/142)) covers Slices 0–4. Slice 5 lands on top of that; the PR needs a fresh push to surface these commits.

Ready for the deploy chain. **Slice 6 (Participate — kind-1 reads + writes gated on membership)** is the last v1 slice and ships the Conversation tab.
