# Test Plan: Story 11 — Create flow publishes a new community

**Story:** `engineering-team/stories/11-create-flow-publishes.md`
**ADR:** `engineering-team/decisions/0009-create-flow-publishes.md`
**Date:** 2026-05-14

## Approach

Slice 5 has a tiny surface — one new pure-function module (`slug.js`) and orchestration changes inside `Create.jsx`'s Review step.

- **Pure-function tests** for `slugify` cover the four canonical normalizations + the empty-result edge + the null/undefined guards.
- **Source-regex tests** pin the orchestration shape: which modules `Create.jsx` imports, the two-event sequence (header before record), the viewer-gated Review CTA, the optimistic-join-then-navigate success path, the relay-default note.
- **Live publish-to-real-relay verification** stays at staging smoke (matches the pattern from #4 / #5 / #7 / #8 / #10).
- **Manual mock-mode visual review** stays at preview-tool level: dev-mode browser refresh → step through wizard → click Create → console shows two `[publish/mock]` log lines + page navigates.

## Coverage map

### `slug.js` pure function (T1–T5)

| Criterion | Test | Level |
|---|---|---|
| AC: standard slug derivation | T1 `slugify("Sunset Hikers") === "sunset-hikers"` | unit |
| AC: collapse punctuation runs | T2 `slugify("Code & Coffee") === "code-coffee"` | unit |
| AC: strip leading/trailing junk | T3 `slugify("  The Listening Room!  ") === "the-listening-room"` | unit |
| AC: empty-result on punctuation-only input | T4 `slugify("!!!") === ""` | unit |
| AC: null / undefined safety | T5 `slugify(null) === "" && slugify(undefined) === ""` | unit |

### `Create.jsx` orchestration (T6–T13, source-regex)

| Criterion | Test | Level |
|---|---|---|
| AC: imports slugify | T6 `Create.jsx imports slugify from '../lib/slug.js'` | source-regex |
| AC: imports both event builders | T7 `Create.jsx imports buildCommunityRecord + buildCommunitiesDListHeader from '../events/build.js'` | source-regex |
| AC: imports publishEvent | T8 `Create.jsx imports publishEvent from '../events/publish.js'` | source-regex |
| AC: header publishes before record (source order) | T9 `Create.jsx publishes buildCommunitiesDListHeader before buildCommunityRecord in the same handler` | source-regex |
| AC: viewer-gated Review CTA | T10 `Create.jsx Review step branches on signedIn — un-signed gets a Sign-in CTA, signed gets the publish button` | source-regex |
| AC: relay-default note in Review | T11 `Create.jsx Review step references "communities.brainstorm.world" in the rendered copy` | source-regex |
| AC: viewer added to seeds (Set union) | T12 `Create.jsx includes viewer in the seeds array before building the record` | source-regex |
| AC: optimistic join + navigate on success | T13 `Create.jsx calls onJoin(slug) and navigate('/community/' + slug) after both publishes succeed` | source-regex |

### Mock-mode parity (manual)

| Criterion | Test | Level |
|---|---|---|
| AC: dev-mode `[publish/mock]` log + navigation | preview-tool: complete the wizard, click Create, observe two console.log lines + URL navigates to /community/<slug> | manual |

### Regression

| Criterion | Test | Level |
|---|---|---|
| AC: all 132 pre-existing tests pass | full test run | regression |
| AC: build + lint clean | `cd ui-communities && npm run build && npm run lint` | CI |

## Edge cases

- [x] **Slug empty after derivation** (e.g. user types "!!!"). T4 covers the function; the orchestrator surfaces the inline error per AC §"Edge cases".
- [x] **Sign-out partway through the wizard.** The Review CTA flips to the inline Sign-in panel via the `signedIn` branch (T10 verifies the conditional). Typed state stays because the wizard is still mounted.
- [x] **Repeat Create in the same session.** Re-publishes the kind-39998 header — idempotent under nostr's replaceable-event semantics. ADR §"Options considered" / Option C rationale documented; no test for this — it's not a bug, it's the documented cost.
- [x] **Same slug as an existing community by the same viewer.** Replaces the prior community-record (same d-tag). No client-side warning. PLAN.md §6 Q4 commits to this "no hard dedup" policy.
- [x] **Same slug as an existing community by a different viewer.** Coexists at the protocol level (d-tags scoped per `(kind, pubkey)`). No collision.
- [x] **Header publish succeeds + record publish fails.** Header stays on the network harmlessly; UI shows the inline error on Review; user can retry. The second attempt re-publishes both (header again-idempotent, record from scratch). No "unpublish" needed.

## Not covered (intentional)

- **Live publish round-trip** to `wss://communities.brainstorm.world`. Staging smoke verifies post-deploy via `websocat` REQ to the relay.
- **Real strfry → API round-trip.** Until Slice 2 NB-4 wires the data sources, the published event exists on the relay but doesn't surface back through `GET /api/communities`. The Discover-after-Create visual will show the empty state.
- **Concurrent publish race.** `publishing` state guards the button; double-click is harmless.
- **Slug uniqueness check.** PLAN.md §6 Q4 — out.
- **Edit publishing.** Slice 5 ships Create only.
- **Avatar / banner image.** Schema accepts but wizard doesn't collect.

## Test infrastructure

- **Framework:** Node runner (`test/test.js`). New file `test/create-flow-publishes.test.js`. Same pattern as #5–#10.
- **No new deps.** Source-regex over `Create.jsx` + `slug.js` content; pure-function tests require + invoke `slug.js` directly (CommonJS-friendly because it's a small standalone file with no `import.meta` deps).
- **No Playwright** — wizard's full flow with NIP-07 needs a real extension. Manual preview verifies the dev-mode path.

## How to run

```bash
npm test
```

Manual visual verification:

```bash
cd ui-communities && npm run dev
# Open http://localhost:5174
# (NIP-07 extension installed) → click Sign in → approve
# Navigate to /create
# Step 0: type "Sunset Hikers Test" → Continue
# Step 1: Start fresh
# Step 2: select 1-2 topics → Continue
# Step 3: select 1-2 founding voices → Continue
# Step 4 (Review): click "Create your circle"
# DevTools console should show:
#   [publish/mock] {...kind: 39998 header...}
#   [publish/mock] {...kind: 39999 community-record...}
# URL navigates to /community/sunset-hikers-test
# The new community renders with "You belong here" badge.
```

Manual staging smoke (post-deploy):

```bash
# Visit https://communities.brainstorm.world with extension installed
# Sign in. Click Start a Circle. Complete the wizard.
# Click Create your circle. Should NOT see [publish/mock] in prod.
# Verify the two events landed on the relay:
websocat wss://communities.brainstorm.world \
  <<<'["REQ","x",{"kinds":[39998,39999],"authors":["<viewer-hex>"]}]'
# Expect two events: kind 39998 header + kind 39999 community-record
# with d-tag matching the derived slug.
```

## Verification

Tests fail with the current code (no `src/lib/slug.js`, `Create.jsx` still navigates without publishing). Confirmed-failing on the previous commit; the test file lands with this commit and confirms-failing for the right reasons before Implementation.
