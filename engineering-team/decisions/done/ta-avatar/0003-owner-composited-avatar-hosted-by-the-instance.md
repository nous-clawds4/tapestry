# ADR 0003: The stamped composite — built in the owner's browser, hosted by the instance

**Status:** Proposed
**Date:** 2026-08-07
**Story:** `engineering-team/stories/ta-avatar/3-stamped-composite-avatar-on-nostr.md`

## Context

Stories 1 and 2 built the two layers underneath this one: a render-time badge in our own UI
(ADR 0001), and a branded picture in the assistant's published defaults (ADR 0002). This story is the
ask's actual end state — **the owner's own avatar with the mark baked into it**, published as the
assistant's `picture` so that every nostr client shows it.

Six criteria, and two of them are in tension (see D3): a preview before anything is published;
instance-hosted and publicly fetchable; **surviving redeploy**; **regenerable, with re-publish
pointing at the new one**; a fallback when the owner has no usable picture; and refused to anyone but
the owner.

### Concept-graph orientation (AGENTS.md §1–3)

The stack was briefly unreachable and then recovered; orientation ran against the live graph.
`39998:<TA>:image` exists but resolves to a bare node — no description, and `…:image-schema` returns
`No node found`. It models images *as knowledge-graph nodes*; a generated brand composite written to
a volume is not a graph assertion and nobody publishes a competing version of it. Same conclusion as
ADR 0002: **not applicable, no concept change, no firmware reinstall.** (Handles cited from a live
read during a window when the stack was up; re-verify if that becomes load-bearing.)

### Verified facts this design rests on

- **`multer` is already a dependency** (`package.json`, `^1.4.5-lts.1`) — used by
  `src/api/customers/commands/restore-upload.js`, which is also the precedent for writing to
  `/var/lib/brainstorm` (`:20-30`: `mkdirSync` recursive with a home-dir fallback, plus filename
  sanitisation at `:44`).
- **The volume genuinely persists.** `tapestry-data:/var/lib/brainstorm` is a named volume
  (`docker-compose.yml:23`, declared `:84`), and **no deploy path destroys it** — I grepped the
  workflows, `docker/`, `setup/`, `bin/` and `scripts/` for `down -v` / `--volumes` / `volume rm` /
  `volume prune` and found nothing. `deploy-staging.yml:27` runs `docker compose up -d --build`,
  which recreates the container and keeps the volume. **AC3 rests on this, so it was checked rather
  than assumed.**
- **Nothing under `/var/lib/brainstorm` is web-served today.** The static mounts are
  `bin/control-panel.js:124` (`dist/`), `:132` (`public/`), `:145` (`/control`), `:149` (`/legacy`) —
  all container-ephemeral. This story creates the repo's first directory that is **both persisted and
  served**.
- **Owner gating has an established idiom**: `isOwner(req)` (`src/middleware/auth.js:265`), used as
  `if (!isOwner(req) && !req.localTrusted) → 403` in `src/api/strfry/commands/publishEvent.js:34-38`.
- **Assistant routes are flat registrations** at `src/api/index.js:528-532`.
- **The editor already has the field this story fills.** `picture` is a plain text input
  (`ui/src/components/AssistantProfileEditor.jsx:11`) and publishing posts to
  `/api/assistant/publish-profile` (`:104`). Nothing about the signing path needs to change.
- **Story 1's badge asset is canvas-safe**: `ui/public/ta-badge.svg` carries explicit `width="375"
  height="375"` alongside its `viewBox`. An SVG without intrinsic dimensions can fail to draw into a
  canvas; this one won't.
- **CORS on real avatar hosts is permissive — but only the ones I could test.** With an `Origin:
  https://staging.brainstorm.world` header, `pbs.twimg.com` and `image.nostr.build` both reflect the
  origin and `m.primal.net` returns `*`. So a direct `crossOrigin="anonymous"` load would *often*
  work. It is not guaranteed: a nostr avatar can be hosted anywhere, and the failure mode is a
  tainted canvas that throws `SecurityError` at `toBlob()` — at the very end of the flow.

## Options considered

### Option A — Composite in the owner's browser; proxy the source image; host the result on the volume

Canvas draws the proxied owner image plus `/ta-badge.svg`, `toBlob()` produces a PNG, an owner-gated
endpoint stores it under `/var/lib/brainstorm/generated/`, and a new static mount serves it.

- **Pros.** The preview AC1 requires is *the same canvas* that produces the blob — no extra
  round-trip and no risk of preview and result diverging. No new dependency. The composite is hosted
  by the instance, so its availability matches the instance's, as the story requires.
- **Cons.** Adds a server endpoint that fetches a remote URL (bounded — see D2), and creates the
  first persisted-and-served directory.

### Option B — Composite server-side with an image library (`sharp` / `@resvg/resvg-js`)

- **Rejected.** A native dependency compiled into a hand-rolled Ubuntu image, for arithmetic the
  browser already does. It also makes AC1's preview a second round-trip against a
  not-yet-persisted image, which is exactly the kind of seam where preview and published artefact
  drift apart. ADR 0002 rejected the same dependency for a static asset; the reasoning holds here.

### Option C — Skip the proxy; rely on `crossOrigin="anonymous"`

- **Rejected on the evidence above.** It would work for the hosts I tested and fail, late and
  confusingly, for others. One deterministic path beats two where the fallback is discovered only
  when `toBlob()` throws.

### Option D — Host the composite on an external media host (Blossom, nostr.build)

- **Rejected** by the story's own out-of-scope list, and because it makes the assistant's identity
  depend on a third party the owner did not choose.

## Decision

We chose **Option A**, with four decisions that depart from or sharpen the original sketch.

**D1 — Compositing happens in the browser.** As above: the preview falls out of the same canvas, and
no native dependency enters the image.

**D2 — The proxy takes no URL parameter.** `GET /api/assistant/owner-avatar` is owner-gated and reads
the URL from the **owner's own kind-0**, server-side. An endpoint that accepted a URL would be a
general-purpose arbitrary-fetch primitive; this one's reachable set is "whatever the owner published
about themselves". Guards, following the shape of `src/api/nip05.js:126-147`: `http(s)` only, 5s
`AbortController` timeout, `content-type: image/*` allow-list, a ~5 MB cap enforced on both
`content-length` *and* the streamed body, at most one redirect, and no credentials or cookies
forwarded. It fails closed — any refusal is AC5's fallback path, not an error the owner has to
decode.

**D3 — Regenerating does NOT delete the previous composite.** This is where AC3 and AC4 pull against
each other, and the original sketch got it wrong by deleting older files. Filenames are
content-hashed (`ta-avatar-<hash8>.png`), so a regenerate yields a *new* URL — which is what makes
AC4's "re-publishing points at the new one" work without cache staleness. But the previously
published kind-0 still names the *old* URL, and it stays published until the owner re-publishes.
Deleting on regenerate would kill the picture of the currently-published profile in the window
between generating and publishing — precisely AC3's "a published picture never silently dies". So
**old composites are kept.** They are tens of kilobytes and regeneration is a deliberate manual act;
a retention policy is a follow-up, not a launch requirement.

**D4 — The publishable URL obeys story 2's routability rule.** The upload response returns the
absolute URL built from `getInstanceWebsite()` and gated on `isPubliclyReachable()` (ADR 0002), so a
non-public instance gets no publishable URL — the same rule, in one place, rather than a second
notion of "is this instance reachable". Generation and local preview still work everywhere; only the
*publishable* URL is withheld. **Note:** OPEN.md #148 records that `isPubliclyReachable` currently
admits RFC1918 addresses. This story inherits that gap rather than forking a second predicate —
fixing it in one place fixes it for both stories.

## Consequences

- **Enables:** the epic's actual goal — a stranger's nostr client shows the owner's face wearing the
  mark. Story 2's asset becomes the fallback it was designed to be.
- **Creates the first persisted-and-served directory.** `/generated` is world-readable by design (a
  published avatar must be fetchable without auth). Only the owner-gated upload writes there, and
  filenames are server-generated from a content hash, so a caller cannot choose a path.
- **Stale composites are possible and accepted.** If the owner changes their own avatar, the
  published composite keeps the old face until they regenerate and re-publish. Automatic
  regeneration is out of scope by the story's own list.
- **Old composites accumulate.** By D3, deliberately. Bounded by how often an owner regenerates.
- **Customer assistants stay out of scope.** The proxy is defined in terms of *the owner's* kind-0;
  generalising means a different auth model and a per-customer storage path, which is not "zero extra
  behavior".
- **Firmware reinstall required?** **No.**

## Implementation notes

**New — `src/api/assistant/avatar.js`** (kept out of `index.js`, which is already ~540 lines):

- `handleOwnerAvatar(req, res)` — `GET /api/assistant/owner-avatar`. Gate with
  `if (!isOwner(req) && !req.localTrusted) → 403`. Read the owner pubkey via
  `getConfigFromFile('BRAINSTORM_OWNER_PUBKEY')`, get their kind-0 `picture` (the same strfry scan
  `getKind0DisplayName` already performs — extract or mirror it rather than re-inventing), apply the
  D2 guards, stream the bytes back with the upstream `content-type`. **404 with a JSON body when the
  owner has no picture** — that is AC5's trigger, not an error.
- `handleUploadAvatar(req, res)` — `POST /api/assistant/avatar`, same gate, `multer` memory storage
  with a 2 MB limit. Validate **PNG magic bytes** (not the declared mime), hash the buffer, write
  `ta-avatar-<hash8>.png` into `/var/lib/brainstorm/generated/` via the `ensureDir` +
  home-dir-fallback pattern from `restore-upload.js:20-30`. Return
  `{ success, path: '/generated/<file>', url: <absolute or ''> }`, where `url` is empty unless
  `isPubliclyReachable(getInstanceWebsite())` (D4). **Never delete an existing file** (D3).

**Changed — `src/api/index.js`** (beside `:528-532`): register the two routes.

**Changed — `bin/control-panel.js`** (beside the mounts at `:124-149`): add
`app.use('/generated', express.static('/var/lib/brainstorm/generated'))`. Mount it *after* the
existing ones so it cannot shadow app assets, and scope it to that directory only.

**Changed — `ui/src/components/AssistantProfileEditor.jsx`:** a "Generate badged avatar" action next
to the existing `picture` field (`:11`). It fetches `/api/assistant/owner-avatar` into an `Image`,
draws it into a 512×512 canvas (cover-fit), draws `/ta-badge.svg` at ~30% of the canvas in the
bottom-right with a small inset and a ring in the page background colour so it reads against any
photo — the same geometry ADR 0001 established for the in-app badge — then `toBlob('image/png')`.
The canvas *is* the preview (AC1). On accept, POST the blob, put the returned `url` into
`form.picture`, and let the existing publish flow (`:104`) do the rest unchanged. When the proxy
404s, offer story 2's `/ta-avatar.png` instead (AC5) and say why in one line.

**Not changed:** `handlePublishProfile`, the signing path, the relay fan-out, NIP-05 derivation, and
`buildDefaultProfileContent`. This story only supplies a different value for a field that already
exists.

**Testability note for Phase 3 (not a test plan).** The pure, high-value unit is the store-and-name
step: given a PNG buffer, it writes exactly one content-addressed file, is idempotent for identical
input, and yields a different name for different input. The routability-gated `url` is the same
predicate story 2 already tests. The browser half (canvas geometry, preview) is where a Playwright
class earns its place, as in story 1 — the proxy can be route-mocked so no live avatar host is
touched.

## Out of scope

Automatic regeneration when the owner's avatar changes; a retention/cleanup policy for old
composites; customer-assistant composites; external media hosts; fixing OPEN.md #148's RFC1918 gap
(inherited, one shared predicate); and any change to how the assistant profile is signed or fanned
out.
