# ADR 0009: Pin a tag (foundational)

**Status:** Proposed
**Date:** 2026-05-18
**Story:** `engineering-team/stories/10-pin-a-tag.md`

## Context

Story 10 ships the foundational primitive of the **Pin a tag** epic
(`engineering-team/epics/pin-a-tag.md`): a NIP-07-authenticated user opts a
tag into their personal curated set, and can browse / unpin from a dedicated
`/pins` page. No Trusted List publication yet (Story 12), no curation
customization at pin time (Story 11), no aggregate "most pinned" sort
(Story 13).

### Concept-graph orientation

Via `/api/concept-graph/summaries` + targeted `neighbors`:

- `39998:<TA>:tag` — exists; ADR-0001 established. Element wire shape
  (`d=<slug>`, `z=<tag-handle>`, content `{tag:{slug,name,description}}`)
  unchanged.
- `39998:<TA>:nostr-user-tag` — exists; ADR-0001 established. Wire shape
  (`d=profile-tag-<slug>-<tgt8>-<auth8>`, `p`, `e`, `z`, `polarity`,
  content `{nostrUserTag:{taggedPubkey,tagEventId}}`) unchanged.
- `39998:<TA>:tag-pinning` — **NEW.** Does not exist in the graph. Must be
  added as a firmware concept; firmware reinstall required.

The epic doc fixes the wire shape for the Pin event (kind-39999 list-element
of `tag-pinning`):

> `z` → `39998:<TA>:tag-pinning`
> `a` and `e` → references to the tag being pinned
> `curation-method` → stringified JSON of the user's selected curation params

Story 10 publishes the default curation-method:
`{"observer":"<viewer pubkey>","method":"nip85:rank","cutoff":2,"includeScoreInTL":false}`.

### Existing primitives we reuse

- **Server** `src/api/profile-tags/index.js`:
  - `strfryScan` (line 37) — kid-glove wrapper around `strfry scan`.
  - `dedupeReplaceable` (line 74) — addressable-replaceable collapse.
  - `parseTagPayload` (line 405) — payload parser for kind-39999 tag elements
    (reused as-is to enrich Pin rows with tag metadata).
  - `meiliFetchProfilesByPubkey` (used by `handleTagById`) — enrich tag-author
    info if needed on `/pins`.
  - `registerProfileTagsRoutes` (line 1066) — where new pin routes wire in.
  - `handleTagById` (line 425) — extended additively (mirrors ADR-0004's
    extension of `handleProfilesTagged` with `viewerPubkey`).
- **Client publish path** `ui/src/utils/publishProfileTag.js`:
  - `publishOrThrow` (line 23) — exported helper, reused unchanged for Pin
    and Unpin publishes. Handles partial-relay-failure semantics.
- **Client kind-5 deletion pattern** `ui/src/hooks/useProfileTags.js:116–131`
  (`revoke`) — exact template for the unpin path.
- **Routing** `ui/src/App.jsx` — top-level Brainstorm routes (`/tags`,
  `/settings`, `/personalization`, etc.) are flat, peer to `/tag/:slug/:tagId`.
- **TopBar / user menu** `ui/src/components/BrainstormUserMenu.jsx:127` —
  where the "⚙️ Settings" link lives; the existing menu pattern accepts a
  new "📌 Your pins" peer.

### CLAUDE.md invariants — what this story must honor

- **POV-first.** Pin events are *personal data* keyed by the viewer's
  pubkey. They are NOT POV-derived; whether they are "trusted" or "in
  someone's WoT" does not affect whether they exist on the viewer's `/pins`
  page. Don't introduce per-POV columns on a per-user resource.
- **Decentralized-first.** Any logged-in user can pin any tag. No author
  gate, no admin curation. Accept all signed Pin events from the viewer.
- **Filter at view time.** The `/pins` page is a strfry scan
  `(kinds=[39999], authors=[viewer], '#z'=[tag-pinning-handle])` resolved
  at read time, joined to the live tag metadata. No denormalized "pinned
  set" table.

### Project rules

- No new lint/typecheck/build tooling.
- JS-without-build front end.
- New concept ⇒ firmware reinstall (`POST /api/firmware/install`).

### Open questions called out by the story (resolved below)

1. Slug for the new firmware concept (`tag-pinning` vs `pinning` vs
   `pinned-tag`).
2. Unpin mechanism (kind-5 delete vs replacement-with-status).
3. Visual placement of the Pin affordance on the tag detail page.
4. `/pins` URL convention.
5. Whether existing strfry subscriptions cover the new kind-39998
   ConceptHeader and its kind-39999 elements.

## Options considered

### Option A — New `tag-pinning` firmware concept; kind-5 delete for Unpin; extend `by-id` with `viewerPubkey` for per-page state; new `/api/profile-tags/pins` for the list page; `/pins` top-level route; in-header Pin affordance

**Concept slug.** Use `tag-pinning`.
- Already the slug the epic + story consistently use.
- "Pinning" alone is too generic — Story 14's Treasure Map work will eventually
  surface other pinnables (e.g., DLists); leaving the unqualified slug free
  keeps that door open.
- "Pinned-tag" reads like "a tag with type=pinned," collapsing the *action*
  into the *target*. The whole point of this concept is to record an
  *assertion of pinning* by a user against a tag, parallel to how
  `nostr-user-tag` records "user U is in tag-category T."

**Firmware definition** (new directory `firmware/active/concepts/tag-pinning/`):

`concept-header.json`:
```json
{
  "word": {
    "slug": "concept-header-for-the-concept-of-tag-pinnings",
    "name": "concept header for the concept of tag pinnings",
    "title": "Concept Header for the Concept of Tag Pinnings",
    "wordTypes": ["word", "conceptHeader"]
  },
  "conceptHeader": {
    "description": "A tag-pinning is an assertion by a nostr user that they personally pin a specific tag — i.e., they opt that tag into their personal curated set, to be used as the basis for downstream features such as periodic Trusted List publication (Story 12) and 'most pinned' aggregation (Story 13). Each element links the pinning user (event author) to a tag event id and carries a curation-method describing how the user wants the eventual Trusted List computed. Pinning is permissionless: any user may pin any tag; unpinning is performed by publishing a NIP-09 kind-5 deletion targeting the pin event.",
    "oNames": { "singular": "tag pinning", "plural": "tag pinnings" },
    "oSlugs": { "singular": "tag-pinning", "plural": "tag-pinnings" },
    "oKeys":  { "singular": "tagPinning", "plural": "tagPinnings" },
    "oTitles":{ "singular": "Tag Pinning", "plural": "Tag Pinnings" },
    "oLabels":{ "singular": "TagPinning", "plural": "TagPinnings" },
    "x-tapestry": { "neo4j": { "nodeLabelRequired": true } }
  }
}
```

`json-schema.json` (modeled on `firmware/active/concepts/nostr-user-tag/json-schema.json`):
```json
{
  "word": {
    "slug": "json-schema-for-the-concept-of-tag-pinnings",
    "name": "JSON schema for the concept of tag pinnings",
    "title": "JSON Schema for the Concept of Tag Pinnings",
    "description": "the json schema for the concept of tag pinnings",
    "wordTypes": ["word", "jsonSchema"],
    "coreMemberOf": [
      { "slug": "concept-header-for-the-concept-of-tag-pinnings", "uuid": "<uuid>" }
    ]
  },
  "jsonSchema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "name": "tag pinning",
    "title": "Tag Pinning",
    "description": "JSON Schema for the concept of tag pinnings",
    "required": ["tagPinning"],
    "definitions": {},
    "properties": {
      "tagPinning": {
        "type": "object",
        "name": "tag pinning",
        "title": "Tag Pinning",
        "slug": "tag-pinning",
        "description": "data about this tag-pinning assertion",
        "required": ["tagEventId"],
        "properties": {
          "tagEventId": {
            "type": "string",
            "name": "tagEventId",
            "title": "Tag Event ID",
            "slug": "tag-event-id",
            "description": "The event ID of the kind 39999 tag element being pinned. Mirrors the event's `e` tag."
          },
          "curationMethod": {
            "type": "object",
            "name": "curationMethod",
            "title": "Curation Method",
            "slug": "curation-method",
            "description": "Parameters describing how the eventual Trusted List for this pinned tag should be computed. Mirrors the event's `curation-method` event-tag (which carries the stringified form). v1 fields: observer (hex pubkey), method ('nip85:rank' | 'follows' | 'trust-everyone' | 'trusted-list'), trustedList (optional a-tag ref when method='trusted-list'), cutoff (integer), includeScoreInTL (boolean)."
          }
        }
      }
    }
  }
}
```

`manifest.json` (add to `firmware/active/manifest.json`'s `concepts` array):
```json
{
  "slug": "tag-pinning",
  "dir": "./concepts/tag-pinning/",
  "conceptHeader": "concept-header.json",
  "jsonSchema": "json-schema.json",
  "categories": []
}
```

**Pin-event wire shape** (published by the viewer via NIP-07):
```json
{
  "kind": 39999,
  "pubkey": "<viewer-pubkey>",
  "created_at": <unix>,
  "tags": [
    ["d", "tag-pin-<tagSlug>-<tagAuthorPub.slice(0,8)>-<viewerPub.slice(0,8)>"],
    ["e", "<tagEventId>"],
    ["a", "39999:<tagAuthorPubkey>:<tagSlug>"],
    ["z", "39998:<TA-pubkey>:tag-pinning"],
    ["curation-method", "{\"observer\":\"<viewerPubkey>\",\"method\":\"nip85:rank\",\"cutoff\":2,\"includeScoreInTL\":false}"]
  ],
  "content": "{\"tagPinning\":{\"tagEventId\":\"<tagEventId>\",\"curationMethod\":{...same object as the curation-method tag...}}}"
}
```

`d`-tag composition rationale: the tag's *identity* is `(tagAuthorPubkey,
tagSlug)` because two different users can publish tags with the same slug.
Including both the slug and the tag-author 8-char prefix prevents one viewer's
Pin records from colliding across distinct tags that happen to share a slug.
The viewer's 8-char prefix is included as defensive belt-and-suspenders so the
`d`-tag is reasonably unique even when read against the global addressable
namespace.

Carrying `curationMethod` in *both* the `curation-method` event-tag and the
JSON content is intentional: the event-tag is what Story 12's TA-side cron
will index against (NIP-style tag scanning is cheap); the content carries the
schema-validated form for reader UIs (Story 11's editor, the `/pins` page).

**Unpin mechanism: kind-5 deletion targeting the Pin event id.**
- Mirrors `useProfileTags.revoke` (`ui/src/hooks/useProfileTags.js:116–131`) —
  same code shape, same shared `publishOrThrow` path, same partial-failure
  semantics.
- Reader semantics is the simplest possible: "Pin event exists ⇒ pinned;
  doesn't exist ⇒ not pinned." All consumers (this story's `/pins`, Story
  12's cron, Story 13's "most pinned" aggregation) just scan kind-39999 with
  the tag-pinning `z` filter; deleted events drop out of strfry's index
  naturally.
- Re-pin after unpin: a fresh `signEvent` produces a new event id (different
  from the deleted one), so the prior kind-5 doesn't suppress it. The new
  event lands in the same (author, d-tag) replaceable slot, but that's
  unambiguous — strfry's addressable-replaceable index uses the latest
  `created_at` among non-deleted events.

Rejected alternative: replacement-with-status (`content.status='unpinned'`).
That keeps the event around as a tombstone and forces every reader to filter
`status === 'pinned'`. It buys nothing — addressable-replaceable kinds already
support in-place updates, so "edit curation-method" doesn't need a status
field. It adds friction for every downstream consumer.

**Server endpoints.**

(1) **Extend `GET /api/profile-tags/by-id`** (additive — mirrors ADR-0004's
extension of `handleProfilesTagged`):
- New optional query param: `viewerPubkey=<64-char hex>`. When malformed,
  treat as absent (don't 400 — preserves the read-only contract for clients
  that send junk).
- When present and valid, after the existing tag + author resolution, run:
  ```js
  const TAG_PINNING_Z_TAG = `39998:${TA_PUBKEY}:tag-pinning`;
  const pinEvents = await strfryScan({
    kinds: [39999],
    '#z': [TAG_PINNING_Z_TAG],
    authors: [viewerPubkey],
    '#e': [tagEventId],
  });
  const dedupedPins = dedupeReplaceable(pinEvents);
  // expect at most one survivor
  ```
- Parse `curation-method` event-tag (preferred) or `content.tagPinning.curationMethod`
  (fallback) into an object.
- Add `viewerPin: { pinEventId, curationMethod, createdAt } | null` to the
  response. Absent / null when no `viewerPubkey` or no Pin event found.

(2) **New `GET /api/profile-tags/pins?viewerPubkey=<hex>`**:
- 400 on missing/malformed `viewerPubkey`.
- Strfry scan: `{ kinds: [39999], '#z': [TAG_PINNING_Z_TAG], authors: [viewerPubkey] }`.
- `dedupeReplaceable` to collapse (author, d-tag) duplicates.
- Extract each pin's referenced tag event id (prefer the `e` tag; fallback to
  `content.tagPinning.tagEventId`). Bulk-fetch those tags in one extra strfry
  scan: `{ kinds: [39999], ids: [<deduped tag-event-ids>] }`.
- For each pin, run `parseTagPayload` on the referenced tag event to get
  `slug / name / description / authorPubkey`.
- Return:
  ```json
  {
    "success": true,
    "pins": [
      {
        "pinEventId": "<hex>",
        "createdAt": <unix>,
        "curationMethod": { ... },
        "tag": { "eventId", "slug", "name", "description", "authorPubkey", "createdAt" }
      }
    ]
  }
  ```
- Sort by `createdAt` desc (most-recently-pinned first). Pinned-tags whose
  referenced tag event has gone missing (404 from strfry) are filtered out
  silently — story doesn't require surfacing dangling pins, and Story 11
  (curation customization) is the natural home for that follow-up.
- Wired in `registerProfileTagsRoutes` (line 1066 of
  `src/api/profile-tags/index.js`):
  ```js
  app.get('/api/profile-tags/pins', handlePins);
  ```

(3) **No changes** to `handleProfilesTagged`, `handleTagIndex`, etc.
The `viewerPin` data is additive on the tag-detail page only.

**Strfry router / subscription scope.** Pinning is publication-only on the
write side (kind-39999 + kind-5 via `publishEverywhere`). On the read side, the
`/pins` page scans LOCAL strfry — the user's own publish hits local strfry
synchronously via `/api/strfry/publish` (see `nostrPublish.publishToLocalStrfry`),
so the user always sees their own pins immediately. External relay sync of pins
authored on other clients is out of scope for v1; if it becomes needed, the
existing strfry-router subscription model is the natural extension point (a
new router preset filtering on `(authors=[viewer], '#z'=[tag-pinning-handle])`).
**No router changes in this ADR.**

**Client primitives.**

(1) **New file `ui/src/utils/publishTagPin.js`** (mirrors
`publishProfileTag.js` exactly — single wire-shape source):
```js
import { publishOrThrow } from './publishProfileTag';

const TA_PUBKEY = '<TA pubkey>'; // same constant as publishProfileTag.js
export const TAG_PINNING_HANDLE = `39998:${TA_PUBKEY}:tag-pinning`;

export function defaultCurationMethod(viewerPubkey) {
  return {
    observer: viewerPubkey,
    method: 'nip85:rank',
    cutoff: 2,
    includeScoreInTL: false,
  };
}

export async function pinTag({ tag, viewerPubkey }) {
  if (!window.nostr) throw new Error('No NIP-07 extension detected. Install one to pin tags.');
  const authorPk = await window.nostr.getPublicKey();
  const curation = defaultCurationMethod(authorPk);
  const dTag = `tag-pin-${tag.slug}-${tag.authorPubkey.slice(0,8)}-${authorPk.slice(0,8)}`;
  const unsigned = {
    kind: 39999,
    pubkey: authorPk,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', dTag],
      ['e', tag.eventId],
      ['a', `39999:${tag.authorPubkey}:${tag.slug}`],
      ['z', TAG_PINNING_HANDLE],
      ['curation-method', JSON.stringify(curation)],
    ],
    content: JSON.stringify({
      tagPinning: { tagEventId: tag.eventId, curationMethod: curation },
    }),
  };
  const signed = await window.nostr.signEvent(unsigned);
  await publishOrThrow(signed);
  return signed;
}

export async function unpinTag({ pinEventId }) {
  if (!window.nostr) throw new Error('No NIP-07 extension detected.');
  const authorPk = await window.nostr.getPublicKey();
  const unsigned = {
    kind: 5,
    pubkey: authorPk,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['e', pinEventId]],
    content: 'unpinned',
  };
  const signed = await window.nostr.signEvent(unsigned);
  await publishOrThrow(signed);
  return signed;
}
```

The `viewerPubkey` argument to `pinTag` is informational — the actual author
is read off `window.nostr.getPublicKey()` for parity with
`publishProfileTagAssertion`. (The story's AC names "my pubkey" — that's
NIP-07's `getPublicKey()`. Keeping it self-derived prevents the caller from
accidentally signing a Pin as the wrong identity.)

(2) **Extend `ui/src/hooks/useTagDetail.js`**:
- Thread `viewerPubkey` (from `user?.pubkey`) into the `by-id` fetch URL.
- Expose `viewerPin: { pinEventId, curationMethod, createdAt } | null` from the
  response.
- Expose `refetchHeader()` (mirroring the existing `refetchRows()`) so the page
  can re-pull `by-id` after a pin/unpin without remounting.
- No change to the rows fetch — Pin state is header-scoped, not row-scoped.

(3) **New hook `ui/src/hooks/usePins.js`** (parallel to `useTagDetail`):
- Inputs: `viewerPubkey`.
- Outputs: `{ pins, loading, error, refetch }`.
- Fetches `/api/profile-tags/pins?viewerPubkey=...` when `viewerPubkey` is
  present; otherwise stays in an empty-state with `pins: []`.

**Client components.**

(1) **New `ui/src/components/TagPinAffordance.jsx`**:
- Props: `{ tag, viewerPin, onPin, onUnpin, loading, error }`.
- When `viewerPin == null`: renders `<button class="bs-tag-pin">📌 Pin</button>`.
- When `viewerPin != null`: renders `<button class="bs-tag-pin is-pinned">📌 Pinned · Unpin</button>`.
- Click handler is mutually-exclusive: pin when not pinned, unpin when pinned.
- Disabled when `loading` is true; surfaces `error` as a small `<p class="bs-tag-pin-error">⚠️ {error}</p>` below the button.
- Renders nothing when `user` (passed via prop or upstream) is not set —
  satisfies AC-7.

(2) **New `ui/src/pages/Pins.jsx`**:
- Uses `useAuth()` + the new `usePins(user?.pubkey)`.
- Logged-out empty state: AC-8 — renders the same "sign in" empty state the
  existing user menu uses ("Sign in with a NIP-07 extension to manage your
  pins."), with a Log-in CTA reusing `useAuth().login`.
- Logged-in loading: `<p>Loading your pins…</p>`.
- Logged-in error: `<p>⚠️ {error}</p>`.
- Logged-in empty: "You haven't pinned any tags yet." with a link to `/tags`.
- Logged-in populated: a `<ul>` of `<TagPinRow>` (small inline component or
  inlined `<li>`), each showing the tag's name + description + a link to the
  tag's detail page (`/tag/<slug>/<eventId>`).
- v1 does NOT include an "unpin from /pins" button — story AC only requires
  pin/unpin from the tag detail page. Story 11 is the natural home for
  per-row unpin and curation editing.

**Page edits.**

(1) **`ui/src/pages/Tag.jsx`**:
- Destructure `viewerPin, refetchHeader` from `useTagDetail`.
- Add `pinning` / `pinError` local state.
- Define `handlePin` / `handleUnpin`:
  ```js
  const handlePin = async () => {
    setPinning(true); setPinError(null);
    try {
      await pinTag({ tag });
      await refetchHeader();
    } catch (e) { setPinError(e.message); }
    finally { setPinning(false); }
  };
  const handleUnpin = async () => {
    setPinning(true); setPinError(null);
    try {
      await unpinTag({ pinEventId: viewerPin.pinEventId });
      await refetchHeader();
    } catch (e) { setPinError(e.message); }
    finally { setPinning(false); }
  };
  ```
- Mount `<TagPinAffordance>` inside the `<header class="bs-tag-header">`,
  after the author line, when `user && tag`. Beside it, render the small
  link `<Link to="/pins" class="bs-tag-pins-link">View all my pinned tags →</Link>`.
- Logged-out: omit both. Visual identical to ADR-0004's read+write tag page.

(2) **`ui/src/App.jsx`**:
- New route: `{ path: '/pins', element: <Pins /> }`, sibling of `/tags`,
  `/settings`, etc.
- Import `Pins` from `./pages/Pins`.

(3) **`ui/src/pages/BrainstormSettings.jsx`**:
- Add a "Your pinned tags" section with a `<Link to="/pins">` near the other
  navigation rows (placement: at the bottom of the existing settings list, or
  in a new section above the WoT-pipeline block — choice is Implementer's
  visual judgement; ADR doesn't pin pixel-level layout).

(4) **`ui/src/components/BrainstormUserMenu.jsx`** (line 125–136 area):
- Add `<a href="/pins" class="bs-usermenu-pins-btn">📌 Your pins</a>` between
  the welcome block and the Settings button. Gated on `user` (already
  guaranteed by the surrounding render block).

**`/pins` URL: `/pins`.**
- Matches the existing top-level flat convention for the Brainstorm-search-side
  surfaces (`/`, `/tags`, `/settings`, `/personalization`, `/about`,
  `/developers`).
- `/tapestry/grapevine/pins` was considered and rejected — that namespace is
  the admin/ConceptGraph dashboard layout, behind owner/admin gating in
  several spots. Pins are user-personal and should sit in the user's
  Brainstorm UX.
- Short, memorable, mirror-able into kind-10040 (Story 14 territory).

**CSS** (in `ui/src/styles.css`, under the existing `bs-tag-*` and `bs-` namespaces):
- `.bs-tag-pin` — base Pin/Unpin button. Sits inline in the header.
- `.bs-tag-pin.is-pinned` — pinned visual (filled / accent color).
- `.bs-tag-pin[disabled]` — publishing/disabled state.
- `.bs-tag-pin-error` — inline error line under the button.
- `.bs-tag-pins-link` — small "View all my pinned tags →" link styling.
- `.bs-pins-page` — `/pins` page wrapper.
- `.bs-pins-list`, `.bs-pins-row` — `/pins` list rows.
- `.bs-usermenu-pins-btn` — user menu pins link, modeled on
  `.bs-usermenu-settings-btn`.

**Pros**

- Honors all three CLAUDE.md invariants: pinning is personal (no POV
  involved), permissionless (any user pins any tag), and read at view time
  (one strfry scan + one join, no materialized view).
- Reuses the established wire-shape primitive layout from ADR-0001 / ADR-0004:
  kind-39999 + `d`/`z`/`e`/`a` + JSON content. New concept slots in cleanly
  alongside `tag` and `nostr-user-tag`.
- Reuses `publishOrThrow` and the `kind-5 delete` pattern already in
  `useProfileTags.revoke` — no new publish/delete primitive.
- Extends `handleTagById` additively (one optional param, one nullable field on
  the response) — exactly the pattern ADR-0004 set and has lived with for
  Stories 3+4.
- New `/api/profile-tags/pins` is the natural home for the list page and is
  exactly the surface Story 12 (TA cron) and Story 13 ("most pinned"
  aggregation across many users) will read from. Foundation laid.
- Kind-5 deletion makes downstream readers' lives trivial — "Pin event
  exists ⇔ pinned."
- Concept slug (`tag-pinning`) and `/pins` URL leave room for non-tag
  pinnables later without name collision.
- Single wire-shape source (`publishTagPin.js`) lives next to its sibling
  `publishProfileTag.js`; future surfaces (Story 11's curation editor, Story
  13's "Pin from row" button on the tag index) compose it without
  re-implementing.

**Cons**

- Adds a third firmware concept to the active manifest; firmware reinstall is
  mandatory before tests run green. Documented in the Implementer's task list
  and the test plan.
- `handleTagById` response grows one nullable field. Existing read-only
  callers (Story 2's `useTagDetail` consumers) ignore it harmlessly; tests
  for the existing path need a single `viewerPin: null` allowance.
- Kind-5 delete is not universally honored by all relays in the wild — but
  local strfry honors it, which is what the `/pins` page reads from. External
  publication is best-effort (same partial-failure shape Apply/Dispute already
  accepts via `publishOrThrow`).
- One race: the kind-5 unpin lands on local strfry synchronously, but
  `refetchHeader` re-fetches via the same path — by the time the fetch
  resolves, strfry's index has updated. Same shape ADR-0004 already accepts on
  the row-publish path.

### Option B — Reuse the existing `nostr-user-tag` concept; encode Pin as a "pin polarity" assertion

Treat a Pin as a kind-39999 nostr-user-tag with a new polarity value
(`polarity=2` or a new event-tag like `pin=true`).

**Pros**
- Zero schema/firmware change.
- Reuses `publishProfileTagAssertion` plumbing.

**Cons**
- Conflates two distinct domain assertions: "user T is in category C"
  (`nostr-user-tag`) and "user U has personally adopted category C as theirs"
  (the new Pin). The two have different targets — the first is `(viewer →
  taggedPubkey, tagEventId)`; the second is `(viewer → tagEventId)`. Forcing
  them onto the same wire shape requires either dropping the `p` tag (which
  breaks every existing nostr-user-tag reader's filter assumptions) or
  setting `p` to the viewer's own pubkey (which is misleading and would
  pollute "is X in category Y?" aggregations).
- Story 12 needs to scan "all pins authored by U with their `curation-method`."
  A dedicated z-handle (`tag-pinning`) makes that filter trivial; overloading
  `nostr-user-tag` forces every reader to add a `polarity === 2` clause and
  changes the meaning of existing scans.
- Concept-graph orientation matters here: ADR-0001's `nostr-user-tag`
  description is explicitly "an assertion that a specific nostr user (pubkey)
  belongs to a tag category." A Pin is not that assertion. The graph should
  reflect the domain — not the convenience of an existing event template.
- Naming alone (the epic and story consistently call this concept "Pin a
  tag") signals it deserves its own concept node.

### Option C — Store Pins in a single kind-30000-style list (NIP-51 follow-set-of-tags) instead of one event per pin

Use a single kind-30000 / 30003 / 30007-style list per viewer whose contents
are the set of tag references the viewer has pinned. One event per user,
mutated by replacing-with-a-new-version.

**Pros**
- One event per viewer instead of N — smaller strfry footprint.
- NIP-51 patterns are well-known.

**Cons**
- We lose per-pin attributes. The `curation-method` is per-pin, not
  per-viewer (Story 11 explicitly lets the user choose different curation
  parameters per pin). Stuffing N curation-methods into one event makes the
  event large, hard to edit atomically (race conditions on concurrent edits
  in different tabs), and forces a non-trivial diff format.
- "Unpin one tag" requires re-publishing the entire list with that entry
  removed — which is also the only way "edit curation-method" works under
  this option. Every edit competes with every other edit.
- The epic + story doc both specify the kind-39999 list-element shape with
  a per-pin `curation-method`. Adopting a list-event shape would be a
  cross-story redesign, not an architecture choice for this story.
- Story 13's "most pinned" aggregation across users would have to *parse a
  list* per author and pivot, rather than running `strfryScan({kinds:[39999],
  '#z':[tag-pinning-handle]})` and bucketing by `e` tag. Per-pin events are
  cheaper for the consuming queries.

### Option D — Replacement-with-status for Unpin (instead of kind-5)

Same on the new concept; differ only on Unpin: replace the existing
addressable-replaceable Pin event with `content.status = 'unpinned'` and
filter on read.

**Pros**
- No NIP-09 dependency; works on relays that ignore kind-5 deletions.

**Cons**
- Every reader (Story 12 cron, Story 13 aggregation, this story's `/pins`) has
  to filter `status === 'pinned'`. One extra correctness hazard per
  consumer.
- The data wire shape grows a `status` field whose only purpose is to
  encode a binary that the *absence* of the event already encodes more
  cleanly under Option A.
- The codebase already does kind-5 deletion for the analogous case
  (`useProfileTags.revoke`); adopting a different mechanism here would
  fragment the unpublish patterns without justification.

## Decision

**Option A.** New `tag-pinning` firmware concept; kind-5 delete for Unpin;
additive `viewerPubkey` extension to `handleTagById`; new `/api/profile-tags/pins`
endpoint; `/pins` top-level route; in-header Pin affordance on the tag detail
page.

Why: it honors POV-first / decentralized-first / view-time-filter cleanly;
reuses the established kind-39999 + `d`/`z`/`e`/`a` pattern and the
`publishOrThrow` + kind-5 deletion primitives the codebase already uses; lays
the foundation that Stories 11–13 will read from without rework; and treats
"Pin a tag" as a domain concept of its own in the graph (which the epic and
story have already named).

## Consequences

**Enables:**
- A NIP-07 user pins/unpins a tag from the tag detail page; the affordance
  toggles in place.
- `/pins` lists everything the user has pinned, sourced from one strfry scan +
  one tag-event lookup, no denormalization.
- Story 11 (curation customization at pin time) drops in as an edit-form
  surface on top of the same wire shape — the `curation-method` event-tag is
  already there in v1.
- Story 12 (periodic TL publication) scans
  `{ kinds:[39999], '#z':[tag-pinning-handle] }` to enumerate pinned-tag
  records and pulls each viewer's curation-method from a single event-tag.
- Story 13 ("most pinned" aggregation) buckets the same scan by `e` tag.
- Story 14 (Treasure Map integration) can mirror selected pinned-tag records
  into kind-10040 without re-modeling.
- One client primitive (`publishTagPin.js`) owns the wire shape; all future
  pin surfaces (curation editor, "pin from row" on the tag index) compose it.

**Constrains / makes harder:**
- A third firmware concept (`tag-pinning`) is now in the active manifest —
  firmware reinstall required, and the install-status check / firmware sync
  pipeline will track one more entry.
- `handleTagById` response shape grows one nullable field (`viewerPin`); ADR-0002
  / ADR-0004 read-side tests need a small "allow viewerPin in response" allowance
  (the Tester will pick this up).
- Re-pin after unpin produces a new pin event id — the `pinEventId` field on
  the response changes across the (pin → unpin → re-pin) cycle. Consumers
  that cache `pinEventId` across actions (none in v1) would need to refresh.
  Already the de-facto contract for kind-39999.
- Kind-5 deletion isn't honored by every relay in the wild — but our local
  strfry honors it, and the partial-failure pattern from `publishOrThrow`
  already handles the case where external relays drop the delete.

**Follow-ups / debt:**
- **Curation editing at pin time** — Story 11. The wire shape already
  supports it; this ADR's `publishTagPin` accepts a default-only
  `curationMethod`, and the v1 default is hard-coded. Story 11 will swap the
  default for a user-supplied object via a small dialog.
- **Per-row unpin / curation edit on `/pins`** — Story 11. Out of scope here.
- **Dangling pins** (Pin event whose referenced tag event was deleted or never
  reached strfry) — v1 filters them silently from `/pins`. Story 11 may want
  to surface "this tag is no longer available."
- **External-relay sync of pins authored elsewhere** — out of scope. If
  needed, a new strfry router preset filtered on `(authors=[viewer],
  '#z'=[tag-pinning-handle])` is the path.
- **Pin-state indicator on tag-index rows** — explicitly parked in Story 13.
  Foundation laid: the `viewerPubkey` extension pattern used here can be
  mirrored onto `handleTagIndex` when that story arrives.
- **Encryption (NIP-44) for Pin events** — Story 15. v1 is plain-content; this
  ADR doesn't preclude an encryption layer added later behind a user toggle.

**Firmware reinstall required?** **Yes.** A new `tag-pinning` concept is added
to `firmware/active/`. After the Implementer adds the directory + manifest
entry, run:
```bash
curl -X POST http://localhost:$TAPESTRY_PORT/api/firmware/install
```
The install-status check (`GET /api/firmware/install-status`) should
subsequently report the new slug.

## Implementation notes

### Firmware

- New directory `firmware/active/concepts/tag-pinning/` with
  `concept-header.json` and `json-schema.json` exactly as sketched above.
- Append the `tag-pinning` entry to `firmware/active/manifest.json`'s
  `concepts` array (Implementer's call on placement; alphabetical / by-domain
  grouping both acceptable).
- After file changes: `curl -X POST http://localhost:$TAPESTRY_PORT/api/firmware/install`,
  then verify with `curl http://localhost:$TAPESTRY_PORT/api/firmware/install-status`.

### Server — `src/api/profile-tags/index.js`

- Add constant near the existing z-tag constants:
  ```js
  const TAG_PINNING_Z_TAG = `39998:${TA_PUBKEY}:tag-pinning`;
  ```
- Helper `parseCurationMethod(ev)`:
  - Prefer `ev.tags.find(t => t[0] === 'curation-method')?.[1]`, JSON.parse.
  - Fallback to `JSON.parse(ev.content)?.tagPinning?.curationMethod`.
  - Return null on neither / parse error.
- Helper `parsePinTagEventId(ev)`:
  - Prefer `ev.tags.find(t => t[0] === 'e')?.[1]`.
  - Fallback to `JSON.parse(ev.content)?.tagPinning?.tagEventId`.
  - Return null on neither.
- **Extend `handleTagById`** (line 425+):
  - After the existing tag/author block, read `req.query.viewerPubkey`. If
    `!isHexPubkey(viewerPubkey)`, set `viewerPin = null` and skip.
  - Otherwise:
    ```js
    const pinEvents = await strfryScan({
      kinds: [39999],
      '#z': [TAG_PINNING_Z_TAG],
      authors: [viewerPubkey],
      '#e': [tagEventId],
    });
    const survivor = dedupeReplaceable(pinEvents)[0] || null;
    const viewerPin = survivor ? {
      pinEventId: survivor.id,
      createdAt: survivor.created_at,
      curationMethod: parseCurationMethod(survivor),
    } : null;
    ```
  - Add `viewerPin` to the response (existing fields unchanged).
- **New `handlePins`**:
  - Validate `viewerPubkey`; 400 on malformed.
  - Strfry scan: `{ kinds:[39999], '#z':[TAG_PINNING_Z_TAG], authors:[viewerPubkey] }`.
  - `dedupeReplaceable`. Extract pin-tag-event-ids via `parsePinTagEventId`.
    Drop pins with no resolvable tagEventId.
  - Bulk fetch tag events: `strfryScan({ kinds:[39999], ids: [...uniqueTagIds] })`.
  - Build the response array; per pin, look up the corresponding tag event and
    run `parseTagPayload`. Drop pins whose referenced tag is missing or has a
    malformed payload.
  - Sort by `createdAt` desc.
- Wire in `registerProfileTagsRoutes`:
  ```js
  app.get('/api/profile-tags/pins', handlePins);
  ```
- Export `handlePins`, `TAG_PINNING_Z_TAG`, `parseCurationMethod`,
  `parsePinTagEventId` so the Tester can unit-test the helpers.

### Client

- **New `ui/src/utils/publishTagPin.js`** — code as sketched in Option A.
- **Extend `ui/src/utils/publishProfileTag.js`** — none. The existing exports
  are sufficient (`publishOrThrow` re-imported by `publishTagPin.js`).
- **Extend `ui/src/hooks/useTagDetail.js`**:
  - Build the by-id URL with `viewerPubkey=user.pubkey` when user is signed in.
  - Read `viewerPin` from the response, expose in the hook's return value.
  - Add `refetchHeader` modeled on the existing `refetchRows` (separate state
    key so unpin/pin doesn't double-fetch the rows).
- **New hook `ui/src/hooks/usePins.js`** — straightforward fetch hook keyed on
  `viewerPubkey`, exposing `{ pins, loading, error, refetch }`.
- **New component `ui/src/components/TagPinAffordance.jsx`** — render Pin or
  Unpin button based on `viewerPin`, internal `loading` driven by parent prop,
  `error` displayed inline. Renders nothing when not provided a `user`.
- **New page `ui/src/pages/Pins.jsx`** — auth-gated empty state + list.
- **Modify `ui/src/pages/Tag.jsx`** — destructure `viewerPin`, `refetchHeader`;
  add `pinning`/`pinError`; define `handlePin` / `handleUnpin`; mount
  `<TagPinAffordance>` + "View all my pinned tags →" link in header (logged-in
  only).
- **Modify `ui/src/App.jsx`** — add `<Pins />` import and the `/pins` route.
- **Modify `ui/src/pages/BrainstormSettings.jsx`** — add a `<Link to="/pins">`
  in a sensible location (Implementer's choice; recommend near top, with a
  small "Your pinned tags" label).
- **Modify `ui/src/components/BrainstormUserMenu.jsx`** — add a `<a
  href="/pins">📌 Your pins</a>` entry above the existing Settings link in
  the dropdown footer.
- **CSS** — additions in `ui/src/styles.css` under existing `bs-tag-*`,
  `bs-pins-*`, and `bs-usermenu-*` namespaces (no new top-level naming
  scheme).

### Tests (Tester writes; surfaces listed so the Implementer knows the contract)

- **Firmware:** install-status reports `tag-pinning` after reinstall.
- **Server `by-id` with `viewerPubkey`:**
  - No `viewerPubkey` → response identical to existing shape (with `viewerPin: null` allowed).
  - `viewerPubkey` set, no Pin event exists → `viewerPin: null`.
  - `viewerPubkey` set, Pin event exists → `viewerPin: { pinEventId, createdAt, curationMethod }`.
  - `viewerPubkey` malformed → treated as absent (no 400).
- **Server `/api/profile-tags/pins`:**
  - 400 on missing/malformed `viewerPubkey`.
  - Returns pinned-tag rows joined to live tag metadata, sorted by createdAt desc.
  - Pins referencing missing tag events are filtered.
  - Kind-5-deleted Pin events do not appear (strfry honors deletions; consumer trusts the index).
- **Client wire-shape:**
  - `pinTag({tag})` publishes a kind-39999 event with the exact `d/e/a/z/curation-method` shape and stringified default curation-method content.
  - `unpinTag({pinEventId})` publishes a kind-5 with `['e', pinEventId]`.
- **UI:**
  - Logged-out tag detail page: no Pin affordance, no `/pins` link.
  - Logged-in unpinned: Pin button present; click publishes, then re-fetches and shows Unpin.
  - Logged-in pinned: Unpin button; click publishes kind-5, then re-fetches and shows Pin.
  - `/pins` logged-out: sign-in empty state.
  - `/pins` logged-in empty: "You haven't pinned any tags yet."
  - `/pins` logged-in populated: list rows with name + description + link.
  - Publish failure surfaces an error under the affordance.

## Out of scope

- Customizing the `curation-method` at pin time. → Story 11.
- Per-row unpin / curation edit on `/pins`. → Story 11.
- Periodic TL publication driven by pinned tags. → Story 12.
- Aggregating "most pinned" across users (and the pin-state indicator on the
  tag-index rows). → Story 13.
- Treasure Map (kind-10040) integration. → Story 14.
- NIP-44 encryption of Pin events. → Story 15.
- DM alerts on TL deltas (epic-rejected).
- Pinning non-tag entities (DLists, content, profiles directly) — not in this
  epic's scope.
- External-relay sync of pins authored on other clients (not needed for v1;
  strfry-router preset is the future seam).
- Caching layer on `/api/profile-tags/pins`. v1 is one scan + one ids-lookup;
  measure before optimizing.
