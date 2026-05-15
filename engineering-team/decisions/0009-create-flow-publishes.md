# ADR 0009: Create wizard publish path + slug derivation

**Status:** Accepted
**Date:** 2026-05-14
**Story:** `engineering-team/stories/11-create-flow-publishes.md`

## Context

Story #11 wires the Create wizard's final-step button to publish two real events:

1. The viewer's kind-39998 `brainstorm-communities` DList header.
2. The kind-39999 community-record for the new community.

Slice 4 landed the entire publish infrastructure (`publishEvent` wrapper, NIP-07 sign-in, both event builders). Slice 5 is the smallest possible change to make Create's final action use that infrastructure.

Relevant facts:

- **`Create.jsx` is a 5-step wizard.** Step 4 (Review) renders `<ViewCallout>` plus a primary CTA whose `onClick` currently just navigates to `/my-circles`. State accumulated at the App-shell level via `useOutletContext`: `viewer`, `signedIn`, `onJoin`, `onSignIn`, `navigate`. Wizard-local state: `name`, `description`, `selectedTags`, `seedMembers`.
- **`buildCommunityRecord` already exists** at `src/events/build.js:64-119`. It accepts `{ viewerPubkey, community }` where `community` has the API/mock-projection shape (slug, name, description, tags, image, language, founder, relays, seedMembers, weightingModel, endorsementThreshold, nip72Wrapping).
- **`buildCommunitiesDListHeader` already exists** at `src/events/build.js:34-58`. Accepts `{ viewerPubkey }`. Returns a kind-39998 event with the canonical `d: "brainstorm-communities"`. No caller invokes it yet — Slice 4's Join button skipped it. Slice 5 is the first time we publish it.
- **`publishEvent` already exists** at `src/events/publish.js:36`. Mocks via `console.log('[publish/mock]', signed)` in dev; publishes to `wss://communities.brainstorm.world` in production. Returns typed `{ ok: true, ... }` or `{ ok: false, error, message }`.
- **The wizard doesn't have a slug field** — name → slug is auto-derived. PLAN.md §6 Q4 commits to "no hard dedup" — duplicate slugs across curators coexist at the protocol level because d-tags are scoped per `(kind, pubkey)`. No uniqueness check needed.
- **`viewer` from outlet context** is the hex pubkey or `null`. `signedIn` is `viewer !== null`. The Review CTA must be gated on `signedIn`.
- **The community-record's `relay` tags default to `DEFAULT_RELAYS`** = `['wss://communities.brainstorm.world']` from `src/events/publish.js`. The wizard doesn't collect relay URLs — PLAN.md §6 Q5.3 defers founder-controlled mirror tooling to v1.1.

Constraints:

- **No new dependencies.** `nostr-tools` is the only runtime dep; Slice 5 doesn't need anything more.
- **The wizard's discovery surface (Similar circles + Founding voices) stays on mock data** per Slice 3 NB-2's documented intentional retention. Slice 5 only touches the Review step's CTA.
- **Mock-mode parity.** Dev publish still mocks via console.log; the navigation + optimistic state-update should fire in dev exactly as in prod so the visual flow is reviewable without an extension.

## Options considered

### Option A — Inline handler in `Create.jsx` + new `src/lib/slug.js` (chosen)

1. **`src/lib/slug.js`** — exports `slugify(name) → string` as a pure function. One line of regex, fully testable in isolation. Co-locates with the existing `src/lib/format.js` + `src/lib/glossary.js`.
2. **`Create.jsx` Review step gains a publish handler** (`handleCreate`) that:
   - Validates `name.trim().length > 0` and derives slug via `slugify(name)`; if empty, sets an inline error and returns.
   - Builds the community payload from the wizard state. Founder = viewer; seed list = `[viewer, ...seedMembers]` deduplicated.
   - Calls `publishEvent(buildCommunitiesDListHeader({ viewerPubkey: viewer }))`. On failure: inline error + return.
   - Calls `publishEvent(buildCommunityRecord({ viewerPubkey: viewer, community: builtCommunity }))`. On failure: inline error + return.
   - On both success: `onJoin(slug)` (optimistic joinedSet update) + `navigate(\`/community/${slug}\`)`.
3. **Sign-in inline gate.** Replace the existing "Create your circle" primary button on Review with conditional render:
   - `signedIn === false`: show a small panel "Sign in to publish your circle" + a Sign-in button that calls `onSignIn` from outlet context. The error handling on sign-in mirrors Header's pattern (`signInState` local to the wizard with `idle | pending | error`).
   - `signedIn === true`: show the "Create your circle" / "Publishing…" button.
4. **Publishing state.** A single `publishing: boolean` state in the wizard during the two-event sequence disables the button + Back + Cancel actions; the button label flips to "Publishing…".
5. **Inline error display.** A single `publishError: string | null` state below the action row in the Review step. Auto-clears after 5 seconds (matches the pattern from CommunityDetail / MemberDrawerContent in Slice 4).
6. **No new files for the publish glue.** All of it lives in `Create.jsx`'s Review render branch + a `handleCreate` async function. Total new code in Create.jsx: ~60 lines.

**Pros:**
- Minimal new surface. One small helper module + a handler in the existing wizard.
- Slug derivation is pure-function and unit-testable in isolation.
- Re-uses every Slice 4 building block exactly as designed.
- Inline sign-in preserves wizard state — user doesn't lose their typed input.

**Cons:**
- `handleCreate` lives inline in `Create.jsx` rather than being extracted. At ~30 lines of orchestration it's fine; extracting prematurely would add an indirection without saving meaningful code.

### Option B — Extract a `useCreateCommunity` hook

Pull the publish orchestration into a hook (`useCreateCommunity({ viewer })` returns `{ create, publishing, error }`).

**Pros:**
- Cleaner separation of concerns.
- Reusable if a future story adds a second create surface.

**Cons (why rejected):**
- Premature. We have one call site. The hook would just re-package three lines of state + a 25-line handler that's already easy to read in place.
- Adds a layer that doesn't pay off until there's a second consumer. ADR-0007 (Slice 3) explicitly deferred hook factoring "until there are 6+ call sites and a real reason." Slice 5 doesn't change that count.

### Option C — Publish the DList header lazily (on first Join / Create) via a shared module

A module `src/events/ensureHeader.js` exports `ensureCommunitiesHeaderPublished({ viewer })` that publishes the kind-39998 header only if it hasn't been published in this session (tracked via `sessionStorage`). Both Join (Slice 4 retroactively) and Create (Slice 5) call it.

**Pros:**
- DRYs the header-publish concern.
- Avoids the wasted-signature problem on repeated Creates by the same user in a session.

**Cons (why rejected):**
- Retroactively touches Slice 4's Join handler — out of scope for Slice 5. Slice 5's job is to add the Create publish, not to retrofit Join's missing header-publish.
- Session-tracking is incomplete: a user who refreshes the page loses the session flag and re-publishes the header. Real "is the header already on the relay?" check requires a REQ query against the relay before publishing — significant new code path.
- Idempotent re-publishing of the kind-39998 header is **harmless** — same d-tag means the new event replaces the old one on the relay, with identical content. The wasted-signature cost is one extra NIP-07 prompt per Create, which extensions handle quickly.
- If header-publish optimization becomes a real concern (Slice 5 + Slice 4 both publishing it), a future story can introduce `ensureHeader` cleanly. Right now it's premature.

## Decision

We chose **Option A**.

The minimum-new-surface path. One tiny lib helper + an inline orchestrator in the wizard. The hook factoring (Option B) and header-deduplication (Option C) are both viable future stories — neither pays off at v1's scale.

We trade away: ~5 ms of redundant work on repeat Creates (re-publishing the same kind-39998 header). Acceptable; matches PLAN.md's "no hard dedup" philosophy at the curator scale.

## Consequences

- **Enables:** brainstorm.world operator can sign in and create the 3-5 seed communities through the normal Create flow (PLAN.md §6 Q5). No special seed-mode code.
- **Constrains:** Repeat Creates in the same session re-publish the header. Cheap to fix later if it matters.
- **New debt:** None significant. The `ensureHeader` optimization (Option C) is a clean future story.
- **Firmware reinstall?** No — Slice 1's v1.1.0 already activated the schemas this slice writes against.

## Implementation notes

The Implementer reads this section.

### Files & layout (new)

```
src/lib/
└── slug.js              — pure-function slugify

test/
└── create-flow-publishes.test.js   — new Node-runner suite
```

### `src/lib/slug.js`

```js
export function slugify(name) {
  if (typeof name !== 'string') return ''
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
```

Exports just the one function. No default export. Test plan asserts the four canonical examples + the empty-result edge case.

### `Create.jsx` changes

**New imports:**
```js
import { buildCommunitiesDListHeader, buildCommunityRecord } from '../events/build.js'
import { publishEvent } from '../events/publish.js'
import { slugify } from '../lib/slug.js'
```

**New outlet-context destructuring:**
```js
const { viewer, signedIn, navigate, onJoin, onSignIn } = useOutletContext()
```

**New wizard state:**
```js
const [publishing, setPublishing] = useState(false)
const [publishError, setPublishError] = useState(null)
const [signInState, setSignInState] = useState({ status: 'idle', error: null })
```

**`handleCreate` orchestrator (inside `Create()`, before the return):**

```js
async function handleCreate() {
  if (!signedIn || !viewer || publishing) return
  const slug = slugify(name)
  if (!slug) {
    setPublishError('Please choose a name with at least one letter or number.')
    return
  }
  setPublishing(true)
  setPublishError(null)

  // 1. Publish the brainstorm-communities DList header (idempotent).
  const headerResult = await publishEvent(buildCommunitiesDListHeader({ viewerPubkey: viewer }))
  if (!headerResult.ok) {
    setPublishing(false)
    setPublishError(publishErrorCopy(headerResult))
    return
  }

  // 2. Publish the community-record.
  const seeds = Array.from(new Set([viewer, ...seedMembers]))
  const community = {
    slug,
    name: name.trim(),
    description: description.trim(),
    topics: selectedTags,
    seedMembers: seeds,
    founder: viewer,
    weightingModel: 'gr-community-default-v1',
    endorsementThreshold: 0.5,
  }
  const recordResult = await publishEvent(buildCommunityRecord({ viewerPubkey: viewer, community }))
  if (!recordResult.ok) {
    setPublishing(false)
    setPublishError(publishErrorCopy(recordResult))
    return
  }

  // 3. Optimistic joinedSet update + navigate.
  onJoin(slug)
  navigate(`/community/${slug}`)
}
```

The `publishErrorCopy` helper is duplicated already across CommunityDetail and MemberDrawerContent (Slice 4 NB-4). Slice 5 adds a third copy in Create. NB-4 still flagged; cleanup is a separate trivial story.

### Review-step render changes

Replace the existing primary action row in the `step === 4` block:

```jsx
<div className={s.actions}>
  <Button variant="ghost" onClick={() => setStep(3)} disabled={publishing}>Back</Button>
  {signedIn ? (
    <Button
      variant="primary"
      size="lg"
      onClick={handleCreate}
      disabled={publishing || !name.trim()}
    >
      {publishing ? 'Publishing…' : 'Create your circle'}
    </Button>
  ) : (
    <SignInToPublish onSignIn={onSignIn} signInState={signInState} setSignInState={setSignInState} />
  )}
</div>
{publishError && (
  <p className={s.publishError} role="alert">{publishError}</p>
)}
```

Where `SignInToPublish` is a small in-file helper component (or inline JSX) that:
- Renders "Sign in to publish your circle" copy
- A "Sign in" button that calls `onSignIn()` and surfaces error/pending via `signInState`
- Lives in the same file because it's tiny + Create-specific

### CSS

Add `.publishError` to `Create.module.css` matching the styling already used in CommunityDetail.module.css + MemberDrawerContent.module.css (background `bg-elevated`, left border `--danger`, copy in `text-secondary`). Copy-paste the existing rule with the class renamed if needed.

### Relay-default note in Review step

Add a small inline note in the Review step's review card (above the actions):

> Your circle will live on `communities.brainstorm.world` for now. You can host your own mirror later.

Styled as `s.relayNote` — small, `text-faint`, italics.

### Tests

Tester writes `test/create-flow-publishes.test.js` with these assertions:

**Pure-function (T1–T5):**
- T1: `slugify("Sunset Hikers")` returns `"sunset-hikers"`.
- T2: `slugify("Code & Coffee")` returns `"code-coffee"`.
- T3: `slugify("  The Listening Room!  ")` returns `"the-listening-room"`.
- T4: `slugify("!!!")` returns `""` (empty-result case).
- T5: `slugify(null)` and `slugify(undefined)` return `""` without throwing.

**Source-regex (T6–T13):**
- T6: `Create.jsx` imports `slugify` from `'../lib/slug.js'`.
- T7: `Create.jsx` imports `buildCommunityRecord` + `buildCommunitiesDListHeader` from `'../events/build.js'`.
- T8: `Create.jsx` imports `publishEvent` from `'../events/publish.js'`.
- T9: `Create.jsx`'s handleCreate publishes the header before the record (order verified by source position — header `publishEvent` call appears before record `publishEvent` call).
- T10: `Create.jsx`'s Review step has a `viewer`-gated branch — un-signed renders sign-in CTA, signed renders the publish button.
- T11: `Create.jsx` includes the relay-default note string `"communities.brainstorm.world"` in the Review step.
- T12: `Create.jsx` adds the viewer to the seeds before building the community-record (Set union pattern).
- T13: `Create.jsx` calls `onJoin(slug)` + `navigate(\`/community/${slug}\`)` on the success path.

**Mock-mode parity:** verified by manual preview (Slice 5 doesn't break Slice 3's mock-mode visual review).

### Manual staging smoke (post-deploy)

```bash
# Visit https://communities.brainstorm.world with Alby / nos2x.
# Sign in. Click "Start a Circle". Step through the wizard.
# Click "Create your circle" on Review.
# DevTools console should NOT show [publish/mock] in prod build —
# events should fly over wss://communities.brainstorm.world.
# Verify via:
websocat wss://communities.brainstorm.world \
  <<<'["REQ","x",{"kinds":[39998,39999],"authors":["<viewer-hex>"],"#d":["brainstorm-communities","<derived-slug>"]}]'
# Expect: two events come back, kind 39998 + kind 39999.
```

## Out of scope

- **`ensureCommunitiesHeaderPublished` deduplication** (Option C, deferred).
- **`useCreateCommunity` hook factoring** (Option B, deferred).
- **Avatar / banner upload.** Schema accepts but wizard doesn't collect.
- **Edit-screen publishing.** Stays local-state-only per Slice 4 deferral.
- **Founder-controlled relay set / mirror tooling.** v1.1.
- **Slug-uniqueness warning.** PLAN.md §6 Q4: no hard dedup.
