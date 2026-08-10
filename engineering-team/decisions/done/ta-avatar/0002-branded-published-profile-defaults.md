# ADR 0002: A branded, owner-linked default profile for the published assistant

**Status:** Proposed
**Date:** 2026-08-07
**Story:** `engineering-team/stories/ta-avatar/2-recognizable-published-ta-profile.md`

## Context

Story 1 (ADR 0001, shipped to staging as PR #504) made the assistant recognizable **inside our own
UI**. Outside it, the assistant is still a blank: its kind-0 defaults carry `picture: ''` and the
generic name `'Tapestry Assistant'`, so any third-party nostr client shows an empty avatar attached
to a name that links to nothing and nobody.

This story fixes the **defaults** — what the owner is offered when they publish — and in doing so
provides the branded fallback that story 3's composite degrades to.

### Concept-graph orientation (done first, per AGENTS.md §1–3)

Stack reachable. `/api/concept-graph/summaries` → **48 concepts**; three-call pattern then run on
`39998:<TA>:image`.

**No concept models the assistant identity or its profile**, as in story 1. An `image` concept *does*
exist — "A node whose content is a binary image file", with a schema, a properties set, and a
property-tree graph — and an Architect could be tempted by it. **It does not apply here.** That
concept models images *as nodes in the knowledge graph*, something a POV can assert about; this story
ships a static brand asset over HTTP and references it by URL from a kind-0. Modelling a build-time
brand file as a graph node would invent a firmware dependency for something no one asserts about, and
would fail the "could anyone else publish their own version of this?" reflex — nobody publishes their
own version of *this instance's* brand mark. **No concept change → no firmware reinstall.**

### Codebase facts this design rests on (verified on `origin/staging` @ `2f13856d`)

- **One function owns the defaults.** `buildDefaultProfileContent(pubkey, isOwner)`
  (`src/api/assistant/index.js:178`) is the sole producer, consumed by both
  `handlePublishProfile` (`:230`) and `handleAssistantStatus` (`:353`). Changing it changes what the
  editor proposes *and* what a `content`-less publish emits, in one place.
- **The owner branch is the odd one out.** `:183-186` hardcodes `name`/`display_name` to
  `'Tapestry Assistant'` and `picture: ''`, while the customer branch at `:195-196` already uses the
  `"<name>'s Tapestry Assistant"` pattern this story wants. This is a convergence, not an invention.
- **The public address is already derived.** `getInstanceWebsite()` (`:123-126`) returns
  `https://<domain>` with **no trailing slash**, or `''` when the domain is unset or `localhost`. It
  is already in scope at `:179`.
- **AC4 is free.** `handlePublishProfile:281` deletes every empty-string key before signing, so a
  `picture` left `''` on a local instance is simply absent from the published event. This is the same
  mechanism that already keeps `website` out of localhost profiles.
- **AC6 is structural, not something to implement.** `AssistantProfileEditor.jsx:61` prefills from
  `data.hasProfile ? data.profile : data.defaults` — an instance with a published profile never sees
  the new defaults until the owner clicks reset (`:77`) or publishes afresh. Nothing in this ADR can
  retroactively alter a published profile.
- **`picture` is already user-editable** — it is in `PROFILE_FIELDS` (`:76`), so no allow-list change.
- **The asset-serving path is proven, not assumed.** Story 1's `ui/public/ta-badge.svg` is copied into
  `dist/` by the Vite build and served at the site root; I verified `https://staging.brainstorm.world/ta-badge.svg`
  returns **200 `image/svg+xml`, 4261 bytes** after the story-1 deploy. A PNG beside it takes the same
  path.

### Constraints

No new npm dependencies; no build-step or lint tooling (CLAUDE.md); the asset must be reachable by
arbitrary third-party clients on the public internet; and nothing may force-change an already-published
profile.

## Options considered

### Option A — Commit a 512×512 PNG of the mark; build its URL server-side from `getInstanceWebsite()`

`ui/public/ta-avatar.png`, derived from story 1's `ta-badge.svg` artwork, referenced as
`` `${website}/ta-avatar.png` `` in both branches of `buildDefaultProfileContent`.

- **Pros.** Renders in *every* nostr client, including native mobile ones. Self-hosted, so the
  instance's avatar has the same availability as the instance itself. No new dependencies, no runtime
  cost, one static file. Same artwork as the in-app badge, so the three layers of the epic read as one
  identity.
- **Cons.** A committed binary; regenerating it when the brand changes needs a recorded recipe (see
  Implementation notes, where one is given and has been validated).

### Option B — Reuse the already-published `/ta-badge.svg` as the picture URL

Zero new assets: story 1 already ships that file and staging already serves it publicly.

- **Pros.** Nothing to add at all. Guaranteed pixel-identical to the in-app badge.
- **Rejected — it would fail in exactly the clients this story exists to reach.** Native nostr clients
  load avatars through platform image pipelines that do not decode SVG without explicit opt-in (Coil
  needs `coil-svg`; Kingfisher needs a custom processor), and avatar proxies commonly refuse SVG
  outright because it can carry script. Web clients would render it; Damus, Amethyst and Primal
  users — the audience for "recognizable on nostr" — would keep seeing a blank. The whole point of the
  story is the clients where an SVG silently does nothing.

### Option C — Render the PNG at runtime, server-side

Add `sharp` or `@resvg/resvg-js` and generate the avatar on request.

- **Rejected.** A native dependency compiled into a hand-rolled Ubuntu image, plus a new binary
  endpoint, to produce a file that never changes between deploys. Runtime machinery for a constant.

### Option D — Host the avatar on an external media host (Blossom, nostr.build)

- **Rejected.** Introduces an external availability and auth dependency for the one asset that
  identifies the instance. The instance already serves its own `/.well-known/nostr.json` and its own
  static assets; its avatar belongs in the same place.

## Decision

We chose **Option A**.

The decision turns on one fact: this story's audience is *other people's nostr clients*, and a
meaningful share of them cannot render SVG. Option B is cheaper in every respect except the one that
matters — it would leave the assistant blank in Damus and Amethyst while looking correct in our own
tests. PNG is the format every client decodes.

**Full-bleed square, not the disc.** The badge asset is a circle because it is *overlaid* on an
avatar; a published avatar is displayed by clients that variously circle-crop it or show it square. A
disc on transparent corners looks broken in the square case. The avatar asset therefore uses the same
two paths on a **full-bleed square** field. I rendered both to check rather than reasoning about it:
the square variant is also the smaller file (**16.9 KB** vs 27.2 KB).

**What we trade away:** a committed binary that must be regenerated by hand if the mark ever changes.
The recipe below makes that reproducible, and the artwork has been stable since the project's logo was
drawn.

## Consequences

- **Enables:** every instance that publishes its assistant profile gets a recognizable, owner-linked
  identity on nostr with no owner effort beyond the publish they already perform. Story 3's composite
  gains the fallback its AC5 requires.
- **A brand refresh propagates for free — deliberately.** The URL is stable (`/ta-avatar.png`), so
  replacing the file later updates the avatar for every instance that ever published it, without
  re-signing anything. The alternative (a versioned filename) would strand already-published profiles
  on the old art until each owner re-published. For a *brand mark* the propagating behavior is the one
  we want. Recorded because it is a real, if intended, form of action-at-a-distance.
- **Constrains:** the picture is only as available as the instance. An instance that goes offline
  shows a broken avatar in third-party clients — the same coupling as its NIP-05.
- **Follow-ups / debt:**
  - **The customer branch's name fallback is grammatically wrong and stays that way.** `:193` falls
    back to `'a customer'`, so an unnamed customer's assistant publishes as *"a customer's Tapestry
    Assistant"*. AC1 speaks only to the owner, so fixing it here would be scope creep — but it is now
    visibly inconsistent with the owner branch's handling, and it is flagged so the Reviewer sees a
    known gap rather than an oversight. Worth an OPEN.md row at implementation.
  - Nothing versions or cache-busts the asset (see above — intended).
  - Instances that already published keep their current profile until they re-publish (AC6). No
    backfill is offered, by the story's own out-of-scope list.
- **Firmware reinstall required?** **No.** No concept definitions change.

## Implementation notes

**New — `ui/public/ta-avatar.png`, 512×512, ≤50 KB** (the validated render is 16.9 KB; a much larger
file means something went wrong in export, not a judgement call).

Generated once from the committed `ui/public/ta-badge.svg`, swapping the overlay disc for a full-bleed
square field. The recipe uses Playwright, which is **already a devDependency** — no new tooling, and
it is reproducible by anyone. This exact script was run during Architecture and produced the asset
described above; it is recorded so the next brand change is a re-run rather than a rediscovery:

```js
// throwaway script, run from the repo root; commit only the PNG it emits
const { chromium } = require('@playwright/test');
const fs = require('fs');
let svg = fs.readFileSync('ui/public/ta-badge.svg', 'utf8')
  .replace(/<circle[^>]*\/>/, '<rect x="0" y="0" width="375" height="375" fill="#9546ed"/>');
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 512, height: 512 } });
await page.setContent(
  `<style>html,body{margin:0;padding:0}svg{display:block;width:512px;height:512px}</style>${svg}`,
  { waitUntil: 'load' });
await page.locator('svg').screenshot({ path: 'ui/public/ta-avatar.png' });
await b.close();
```

**Changed — `src/api/assistant/index.js`, inside `buildDefaultProfileContent` (`:178-204`) only.**

- Owner branch (`:181-191`): fetch the name with an **empty** fallback —
  `const ownerName = await getKind0DisplayName(pubkey, '');` — then derive both fields from it:
  `name`/`display_name` become `` ownerName ? `${ownerName}'s Tapestry Assistant` : 'Tapestry Assistant' ``
  (AC1's two cases), and `about` keeps a readable subject via `ownerName || 'the owner'` so its prose
  does not regress. The empty fallback is load-bearing: the current `'the owner'` default cannot be
  distinguished from a real name, so AC1's "generic name otherwise" branch would be unreachable.
- Both branches: `` picture: website ? `${website}/ta-avatar.png` : '' `` — reusing the `website`
  already computed at `:179`. This satisfies AC2, AC3 and AC5; **AC4 needs no code**, because `:281`
  strips the empty string before signing.
- Nothing else in the module changes. `handlePublishProfile`'s signing, strfry import and relay
  fan-out are untouched, and NIP-05 derivation (`:273-276`) is explicitly out of scope.

**Unchanged, and deliberately so:** `ui/src/components/AssistantProfileEditor.jsx`. Its prefill (`:61`)
and reset (`:77`) already produce AC1's and AC6's behavior; the editor consumes `defaults` from the
server, so this story is server-side only.

**Testability note for Phase 3 (not a test plan).** The pure part — given an owner name and a website,
what name and picture come out — is exercisable by calling the status endpoint per instance state. The
live local instance is a *useful* fixture here rather than a limitation: its domain is `localhost`, so
it is the natural AC4 case (no picture published), while AC3's "resolves publicly" is a staging-only
observation. The owner's local kind-0 has a `name` (`"Brainstorm"`), which exercises AC1's first branch.

## Out of scope

The composite of the owner's own photo (story 3); NIP-05 derivation or display; backfilling or
auto-republishing existing instances; the customer branch's `'a customer'` name fallback (flagged
above); versioning or cache-busting the asset URL; and any change to the in-app badge from story 1.
