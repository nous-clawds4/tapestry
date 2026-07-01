# Concept Sharing Across Brainstorm Instances

## For a fresh agent: pre-reading

This plan builds on a just-merged Relay Discovery + GrapeRank Pipeline
branch. Before writing any code, **read these files in this order**.
They encode the patterns this plan expects you to extend, not replace.

1. **`relay-discovery-and-tags-plan.md`** (repo root) — the spec behind
   the previous PR. Read the "Concepts vs. Elements" section at the top.
   Non-negotiable conceptual vocabulary: *concept coordinate*, *z-tag*,
   *addressable 39999*.
2. **`tapestry/firmware/active/concepts/nostr-relay/concept-header.json`**
   and `json-schema.json` — canonical shape of a firmware concept.
   Anything you publish on behalf of our TA must match this structure;
   anything foreign you *import* will arrive in this shape.
3. **`tapestry/firmware/active/manifest.json`** — the root manifest.
   Note that `concepts[]`, `elements{}`, and `sets{}` live at the top;
   you won't be modifying this file in the import PR (imports are
   runtime, not firmware), but you need to recognize its schema to not
   confuse it with per-concept manifests.
4. **`tapestry/src/firmware/install.js`** — the 3-pass install pipeline.
   Pass 1 bootstraps + signs with TA. Pass 2 enriches + **re-signs**
   (this is the step you MUST NOT invoke on foreign events). Pass 3 is
   pure Neo4j derivation, safe for foreign events. You'll extract a
   narrower Pass 3 helper from here.
5. **`tapestry/src/api/normalize/firmware.js`** + `helpers.js` —
   `conceptUuid()`, `getConcept()`, and `signAndFinalize()`. The last
   one is what Pass 2 calls; make sure your import path doesn't.
6. **`tapestry/src/api/neo4j/eventSync.js`** — `buildImportCypher` is
   the function that turns a signed nostr event into the Cypher
   statements that wire up its NostrEvent + tag + REFERENCES nodes.
   This is the primary tool you use to land foreign events in Neo4j.
   Note: `handleEventUpdate` uses `executeCypher` (a `cypher-shell`
   pipe), which has a password-config bug that was fixed on the prior
   branch — it now reads from `getConfigFromFile`. If you need the
   Bolt driver instead, use `runCypher` / `writeCypher` from
   `tapestry/src/lib/neo4j-driver.js`.
7. **`tapestry/src/api/relay-discovery/index.js`** — the existing
   module you're extending for multi-TA awareness. Read it top to
   bottom; you'll touch `handleAvailableTags`, `handleTagsForRelay`,
   `handleAggregated`, and add a helper for resolving concept
   coordinates.
8. **`tapestry/src/api/relay/fetchEvents.js`** — the existing
   `/api/relay/external` handler using `SimplePool`. This is your
   template for the new external-fetch endpoints.
9. **`tapestry/ui/src/pages/relay-discovery/RelayDiscovery.jsx`** —
   look at `DemoPanel`, `PipelinePanel`, `EndorserStack`,
   `AggregatedTab`. Your `ConceptDiscovery.jsx` should mirror these
   patterns (panels for suggested-authors / search / results; avatar
   stacks if relevant; `useTrust()` wiring if relevant).
10. **`tapestry/ui/src/utils/nostrPublish.js`** — `fetchFromRelays`,
    `publishEverywhere`, `importAddressableToNeo4j`. Reuse these; do
    not reimplement NIP-07 signing or strfry publish from scratch.
11. **`tapestry/ui/src/components/TrustWidget.jsx`** — the floating
    widget from the prior branch. Useful as a pattern for small cards
    that wire into `TrustContext` (for future enhancements), but you
    likely don't touch it in this PR.
12. **`tapestry/test-data/mint-demo-relays.js`** — the pattern for
    `resolveApi()` (docker-port detection), `nak`-based signing,
    `/api/strfry/publish` + `/api/neo4j/event-update` imports, colored
    DiceBear avatars, and using the `dwarves-test-data.json`
    keypairs. Your `mint-foreign-concept.js` is a close sibling.
13. **`tapestry/test-data/dwarves-test-data.json`** — all 34 demo
    keypairs. You'll pick one as the "foreign TA" for the demo.

Optional but useful:
- `tapestry/src/middleware/auth.js` — the session/ownerEndpoint /
  localhost-bypass logic. Matters only if you hit 401s from curl;
  port 7778 bypasses some of it, port 8877 (nginx) does not.
- `tapestry/setup/install-control-panel.sh` — the ops script that
  seeds `/etc/graperank.conf` and sudoers on a real deploy. The dev
  install doesn't run this; if you need config files, copy from
  `tapestry/config/*.template` manually.

## Gotchas from the prior branch that will bite you again

- **`/etc/brainstorm.conf` uses `export FOO="bar"`**, not `FOO=bar`.
  Regexes that expect the bare form fail silently. Use
  `/^(?:export\s+)?KEY=\"?([^"]*)\"?/m`.
- **Docker maps three interesting ports**: `7778` (Express direct,
  bypasses session auth for most reads), `8877` (nginx → Express, full
  auth middleware), and something unrelated on your host's `8080` (was
  a red-herring 401 source in the prior branch). Always resolve the
  port via `docker inspect tapestry --format '{{(index (index .NetworkSettings.Ports "7778/tcp") 0).HostPort}}'` in scripts. UI tests target `7778` directly.
- **The container node_modules is a named volume, not a bind mount.**
  Installing a new dep via `npm install` inside the container writes to
  the volume but NOT to the host repo's `package.json`. For the prior
  branch this mattered because `yargs` was required-but-unlisted;
  `npm install --no-save yargs` in the container fixed it at runtime.
  If any new npm dep is needed for this PR, add it to `package.json`
  AND `docker exec tapestry npm install` inside the volume.
- **Reconciliation drops NostrUser nodes not reachable via the owner's
  follow graph.** The TA pubkey is not followed by the owner, so its
  `NostrUser` gets pruned and its AUTHORS edges cascade-delete. Every
  firmware concept then loses its author and eventually gets swept by a
  derive pass. Fix (if needed for this PR): exempt any pubkey that
  authored a `ConceptHeader` from pruning. Same will happen to any
  foreign TA you import from. This is a real behavior-affecting thing,
  not a cosmetic issue — it's in the "standing issues" section below.
- **Foreign events MUST NOT flow through Pass 2's `signAndFinalize`.**
  That function re-signs with our TA key and mutates event IDs. Any
  code path that "enriches" or "finalizes" a foreign event destroys
  federation. Use `strfry import --no-verify` (via `exec` — there's no
  API endpoint for it) to land foreign-signed events in local strfry,
  then call `buildImportCypher` and execute through the Bolt driver.
  There's a working pattern for this in
  `tapestry/src/api/relay-discovery/index.js` `handleImport` — study
  it before writing the concept-discovery import handler.
- **`SecureKeyStorage.getRelayKeys` is async** but under the
  `encrypted-file` backend the underlying work (`getFromEncryptedFile`
  + `decrypt`) is synchronous. In top-level-sync contexts (CLI
  scripts, legacy bin/* tools) you can call the sync methods directly.
  `tapestry/src/algos/nip85/brainstorm-publish-kind30382.js` has a
  working example of the sync-path shortcut. You probably don't need
  this for the concept-discovery PR (we're not signing anything as
  TA), but flagging for completeness.
- **`OWNER_PUBKEY` in `ui/src/config/pubkeys.js` is stale** (hardcoded
  to a value that doesn't match this install's actual owner). Don't
  trust it as a source of truth — query `/api/owner-info` or rely on
  `useAuth()` if you need the current owner's pubkey.
- **Windows git clones lose the executable bit.** If you add any
  `.sh` script to the repo, `chmod +x` it in your commit; otherwise
  Pass-3-type subprocess spawns fail with `command not found`.
- **Kind 10040 is replaceable, NOT parameterized-replaceable.** No
  d-tag. Don't try to use `addressableUuid` on kind-10040 events —
  that helper returns `null` and the wrapping import becomes a no-op
  silently.

## Nostr kind quick reference

Only the kinds touched by this branch and the one you're about to
start on:

- **0** — profile metadata. Kind-0 for a foreign TA helps the UI show
  a human-readable name in import suggestions.
- **3** — contact list (replaceable). Used by `follow-list` scoring in
  `useTrustWeights`.
- **7** — reaction (used by dwarves demo for votes; irrelevant here).
- **10002** — NIP-65 relay list. Consumed by `/api/relay-discovery/by-pubkey`.
- **10040** — NIP-85 Treasure Map. Replaceable, not parameterized.
- **30382** — NIP-85 assertion. Authored by the relay/TA pubkey; one
  event per ranked target pubkey. d-tag is the target pubkey.
- **39998** — ConceptHeader (addressable). d-tag = concept slug.
  **The central object this PR moves around.**
- **39999** — List item / DList element (addressable). d-tag is
  author-chosen; `z` tag points at the parent 39998 coordinate.

## Current install state (as of the last commit of the prior branch)

Run this as a sanity check before touching anything:

```bash
curl -s http://localhost:7778/api/relay-discovery/pipeline-state | jq
# Expected (roughly):
# { users: ~16, follows: ~20, hopsNodes: ~16, grScored: ~9,
#   kind3InStrfry: ~10, kind10040InStrfry: 1, kind30382InStrfry: 9,
#   relayPubkey: "82b75e..." }
```

If `conceptHeaders` ever reads 0, run the firmware re-install trick
from the prior branch (shell into the container, call
`handleFirmwareInstall` directly — the HTTP endpoint requires auth).
If Neo4j plugins / `/etc/graperank.conf` / yargs are missing, the prior
branch's README/commit will document the fixes.

---

## Context

The previous Relay Discovery branch baked in the assumption that every
Brainstorm install has the same `nostr-relay`, `tag`, and `nostr-relay-tag`
firmware — all authored by our local TA pubkey, installed from our repo's
`firmware/active/` directory.

That model doesn't hold up the moment a *second* instance exists. Different
communities will have different ideas about what a nostr relay "is" — what
fields it carries, which tag taxonomy to adopt, how strict the schema
should be. Hardcoding one schema turns decentralized discovery into a
protocol decision.

This PR lets a fresh Brainstorm instance **discover and ingest concept
definitions authored by a different instance's TA pubkey**, via public
nostr relays. Once imported, the foreign concept lives in local Neo4j
alongside any existing concepts, the relay-discovery aggregated view
honors kind-39999 events z-tagged to any known coordinate (not just our
own TA's), and the instance can "talk to" other instances that share the
imported schema.

The thesis the PR is meant to demonstrate:

> The protocol layer defines event kinds. *The meaning of what's inside
> those events is itself decentralized* — negotiated through schema
> import, not protocol versioning. Two instances are "interoperable for
> nostr-relays" iff they recognize the same ConceptHeader coordinate; and
> which coordinates they recognize is their own social/trust decision.

## Resolved design choices (from interactive Q&A)

- **Import scope: schema-only.** A concept import pulls the ConceptHeader
  + JSONSchema + Primary Property + Properties Set + Supersets + Graphs.
  It does **not** pull the foreign TA's elements (their curated opinions).
  Elements flow in passively via the global `#z` coordinate filter — once
  the schema is installed, every kind-39999 anyone ever published against
  that coordinate becomes visible to the aggregated view.

- **Publish target: informational panel, not a picker.** The
  `PublishRelayForm` and `RelayTagPanel` continue to publish to *our*
  TA's concept coordinate. A small read-only panel shows "other concepts
  we know about" so users see the plurality exists. A per-publish concept
  picker is out of scope for this PR.

- **Discovery UX: bootstrap list + free-form input, forward-compatible
  with a DCoSL-style `concept-author` DList.** The bootstrap list lives
  in a single config file (`config/suggested-concept-authors.json`),
  read by a single server endpoint. When/if we later migrate to option
  C (concept authors discovered via a DList), only that endpoint's
  implementation changes — the UI is unaffected.

## Verified state (from exploration)

- Concept install produces 11 nostr events per concept, all authored by
  the TA pubkey:
  - 1× kind-39998 (ConceptHeader, d-tag=`<slug>`)
  - 7× kind-39999 supporting events (JSONSchema, Primary Property,
    Properties Set, Superset, Core Nodes Graph, Concept Graph, Property
    Tree Graph — each with deterministic d-tags like `<slug>-schema`)
  - Plus 3 derive-only nodes wired via Neo4j in Pass 3.
- Neo4j labels: `ConceptHeader:ListHeader:NostrEvent`, with relationships
  `IS_THE_CONCEPT_FOR` → Superset, `IS_THE_JSON_SCHEMA_FOR` ← JSONSchema,
  etc. Authorship is already stored on every node's `pubkey` field — no
  new persistence needed.
- `src/firmware/install.js` Pass 2 re-signs events with our TA key; that
  step **must be skipped for foreign events** (it would mutate event IDs
  and break federation). Pass 3 (Neo4j derivation) is pure and safe for
  foreign events.
- `src/api/relay-discovery/index.js` lines 28–33 and 237 hardcode our
  TA pubkey in z-tag filters and author filters. These are the only
  blockers to multi-TA aggregation.
- `GET /api/relay/external` (SimplePool) can fetch arbitrary kinds from
  arbitrary relays for arbitrary authors — no changes needed.

---

## Implementation

### A. Backend — new module `src/api/concept-discovery/`

#### `GET /api/concept-discovery/suggested-authors`

Returns the bootstrap list:

```json
{
  "success": true,
  "authors": [
    { "pubkey": "<hex>", "npub": "npub1…", "name": "…", "description": "…", "relays": ["wss://…"] }
  ]
}
```

Today: reads `tapestry/config/suggested-concept-authors.json` at startup
(watched via `fs.watch` for dev reloading, optional).

Tomorrow (option C): same response shape, but the handler instead reads
a configured "concept-author DList coordinate" from `brainstorm.conf`
(e.g. `BRAINSTORM_CONCEPT_AUTHOR_DLIST`), queries Neo4j for its current
elements, and returns their resolved pubkey/name metadata. UI is
unaffected.

This endpoint's stability is the contract that makes the B→C migration
invisible to everything above it.

#### `GET /api/concept-discovery/concepts-by-pubkey?pubkey=<hex>&relays=<urls>`

SimplePool fetch of `{ kinds:[39998], authors:[pubkey] }` from `relays`
(comma-separated, optional — defaults to `PUBLISH_RELAYS`). Also scans
local strfry for the same filter so already-imported concepts still
show up.

Response shape:

```json
{
  "success": true,
  "pubkey": "…",
  "concepts": [
    { "coordinate": "39998:…:slug", "slug": "nostr-relay", "name": "Nostr Relay",
      "description": "…", "eventId": "…", "createdAt": 1776000000,
      "alreadyImported": true|false }
  ]
}
```

`alreadyImported` is computed by asking Neo4j whether a `ConceptHeader`
with that `uuid` already exists.

#### `GET /api/concept-discovery/concept-preview?pubkey=<hex>&slug=<slug>&relays=<urls>`

Fetch the ConceptHeader + every kind-39999 authored by `pubkey` whose
`d` tag starts with `<slug>-` (schema, primary-property, etc.). Parse
the JSON payloads and return a human-readable preview for the UI:

```json
{
  "success": true,
  "coordinate": "…",
  "header": { "name": "…", "description": "…", "oNames": {…}, "oKeys": {…} },
  "schema": { "required": ["slug","websocketUrl"],
              "properties": { "slug":"string", "websocketUrl":"string", "httpUrl":"string?" } },
  "sets":   [{ "slug":"paid-relays", "name":"Paid Relays", "description":"…" }, …],
  "elementCount": 42,
  "events": ["<header-id>","<schema-id>",…]
}
```

`elementCount` is cheap to compute: `strfry --count` local + a scan of
provided relays for `{ kinds:[39999], '#z':[coordinate] }`.

#### `POST /api/concept-discovery/import`

Body: `{ pubkey, slug, relays? }`. Server flow:

1. Fetch all events for this concept (header + every 39999 authored by
   `pubkey` whose d-tag starts with `<slug>-`) from both local strfry and
   the provided relays.
2. Import each event into local strfry via `strfry import` (no-verify
   flag — they're already signed by the foreign TA and valid).
3. For each event, build a Cypher import via the existing
   `buildImportCypher` (exported from `src/api/neo4j/eventSync.js`) and
   execute it through the Bolt driver (same pattern we already use for
   `POST /api/relay-discovery/import` of user-published 39999s).
4. Run the Pass 3 equivalent — derive ConceptHeader/ListItem/etc. label
   assignment + wire implicit relationships. Extract that Pass 3 code
   from `src/firmware/install.js` into a standalone helper (see
   §B below) so this handler can call it on a narrow bundle of events
   without touching filesystem firmware.
5. Return `{ success, coordinate, imported: [eventIds], skipped: [eventIds] }`.

**Crucially, Pass 2 re-sign logic from `install.js` is NOT invoked.**
Foreign events stay untouched.

### B. Backend — refactor `src/firmware/install.js`

Extract two helpers without changing existing behavior:

- `deriveNeo4jFromEvents(events, { source = 'firmware' | 'foreign-import' })`
  — runs the Pass 3 derivation steps (label assignment, class threads,
  core-node edges, etc.) over a provided array of events already in
  strfry/Neo4j. Today `install.js` does this across the whole firmware;
  this extraction just lets it run over a single foreign bundle.
- `conceptEventBundle(pubkey, slug)` — given a pubkey + slug, scans
  local strfry and returns the header + all supporting events. Reused
  by the import handler to confirm everything made it.

Existing firmware install continues to work unchanged; these helpers are
just a narrower entry point the import flow can use.

### C. Backend — multi-TA awareness in relay-discovery

`src/api/relay-discovery/index.js`: replace the hardcoded coordinates
(lines 28–33) and the hardcoded `authors: [TA_PUBKEY]` filter (line 237)
with runtime resolution:

```js
async function resolveConceptCoordinates(slug) {
  const rows = await runCypher(
    'MATCH (c:ConceptHeader) WHERE c.uuid ENDS WITH $suffix RETURN c.uuid AS uuid',
    { suffix: `:${slug}` }
  );
  return rows.map(r => r.uuid);
}
```

Then:

- `handleAvailableTags`: filter `{ kinds:[39999], '#z': await resolveConceptCoordinates('tag') }`. Drop the `authors: [TA_PUBKEY]` constraint (any TA with a `tag` concept contributes).
- `handleTagsForRelay`: coordinate set = `resolveConceptCoordinates('nostr-relay-tag')`.
- `handleAggregated`: the Cypher `WHERE zt.value = $zTag` becomes `WHERE zt.value IN $zTags`. Same for the nostr-relay-tag pass. `tagRows` query drops the `pubkey: $ta` filter.
- `handleUnsigned10040`: unchanged for this PR — the treasure map logic is GR-specific.

One caveat: different TAs may define slightly different tag slugs (e.g.
TA-X might have `commercial` instead of `paid`). The aggregated view's
tag columns would naturally merge these — any endorser applying
`commercial` to a relay shows up under that label, and `paid` elsewhere.
We don't need to reconcile taxonomies; the UI already groups by slug.

### D. UI — new page `/kg/concept-discovery`

`tapestry/ui/src/pages/concept-discovery/ConceptDiscovery.jsx`:

- Top section: **"Suggested concept authors"** — renders a card per item
  returned by `/api/concept-discovery/suggested-authors`. Each card shows
  name + description + short pubkey. Click a card → pre-fills the search
  input below and auto-searches.
- Middle section: search form. Text input (npub/nprofile/hex), optional
  relay URLs textarea, Search button. Decodes via `nostr-tools/nip19`.
- Results section: on successful search, list concepts with preview
  cards showing slug, name, description, "already imported" badge, and a
  "Preview" CTA that opens the detail view.

`ConceptPreview.jsx`:

- Renders schema shape (`required`, `properties` with types), sets
  structure, element count, and a brief footer explaining import
  semantics.
- "Import" button → `POST /api/concept-discovery/import`. On success,
  redirect to `/kg/concepts/<coordinate>` (the existing ConceptDetail
  page) to show the newly imported concept.
- If `alreadyImported === true`, button is disabled with "Already
  imported" label.

Route + nav:

- `App.jsx`: register `{ path: 'concept-discovery', element: <ConceptDiscovery /> }` under Layout.
- `Layout.jsx`: add `{ to: '/kg/concept-discovery', label: '🔭 Concept Discovery' }` under mainNavItems, near the existing Relay Discovery link.

### E. UI — informational "other concepts" panels

`PublishRelayForm.jsx`: above the submit buttons, render a small
collapsed card fed by a one-shot fetch to Neo4j (via a tiny new endpoint
`GET /api/concept-discovery/known-by-slug?slug=nostr-relay` that returns
all ConceptHeaders matching — piggybacks on the same Cypher helper we
already need for multi-TA resolution).

```
Publishing to: our `nostr-relay` concept (39998:82b75e…)

Other `nostr-relay` concepts we know about:
  39998:<TA-X>:nostr-relay  —  imported 2026-04-20
  39998:<TA-Y>:nostr-relay  —  imported 2026-04-22

Each defines "what a nostr relay is" slightly differently. This instance
publishes to its own concept for now.
```

Same pattern on `RelayTagPanel.jsx` with `slug=nostr-relay-tag`.

No behavior change; purely informational.

### F. Config — `tapestry/config/suggested-concept-authors.json`

```json
{
  "authors": [
    {
      "pubkey": "82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833",
      "name": "This instance (self)",
      "description": "Our own Tapestry Assistant — every firmware concept installed from our repo.",
      "relays": ["ws://localhost:7777"]
    }
  ]
}
```

The file ships with one self-referencing entry so a fresh install has at
least one clickable card. Comments in the file explain how to extend it
and a TODO notes the migration path to the `concept-author` DList.

### G. Test data — `test-data/mint-foreign-concept.js`

A sibling to `mint-demo-relays.js` that picks one dwarves keypair (e.g.
`Wise Owl` from the existing `dwarves-test-data.json`), publishes a
complete foreign `nostr-relay-v2` concept bundle (header + schema + ...),
with a deliberately different schema shape (adds `country: string,
optional`), and writes the foreign TA pubkey into
`test-data/demo-foreign-concept.json`.

This gives the demo narrative a concrete "other TA" to import from without
waiting on real external accounts — and exercises the full import path
end-to-end.

Also: extend `suggested-concept-authors.json` at seeding time (the
mint script offers to append a card so the demo works out of the box).

---

## Files map

### Create

```
tapestry/src/api/concept-discovery/index.js
tapestry/ui/src/pages/concept-discovery/ConceptDiscovery.jsx
tapestry/ui/src/pages/concept-discovery/ConceptPreview.jsx
tapestry/config/suggested-concept-authors.json
tapestry/test-data/mint-foreign-concept.js
tapestry/test-data/demo-foreign-concept.json   # written by the script
```

### Modify

```
tapestry/src/api/index.js                       # register the new route module
tapestry/src/api/relay-discovery/index.js       # multi-TA coordinate resolution
tapestry/src/firmware/install.js                # extract deriveNeo4jFromEvents helper
tapestry/ui/src/App.jsx                         # register /kg/concept-discovery route
tapestry/ui/src/components/Layout.jsx           # add nav link
tapestry/ui/src/pages/relay-discovery/PublishRelayForm.jsx  # informational panel
tapestry/ui/src/pages/relay-discovery/RelayTagPanel.jsx     # informational panel
tapestry/ui/src/styles.css                      # styles for new panels + pages
```

### Reuse (do not duplicate)

```
tapestry/src/api/relay/fetchEvents.js           # external relay SimplePool fetch
tapestry/src/api/neo4j/eventSync.js             # buildImportCypher (foreign event → Neo4j)
tapestry/src/api/strfry/queries/scan.js         # local strfry scan pattern
tapestry/src/lib/neo4j-driver.js                # runCypher via Bolt driver
tapestry/ui/src/utils/nostrPublish.js           # fetchFromRelays (for UI-side preview)
tapestry/ui/src/components/DataTable.jsx        # concept list
```

---

## Verification

### Unit-ish smoke tests (backend)

```bash
# 1. Bootstrap endpoint returns at least self
curl -s http://localhost:7778/api/concept-discovery/suggested-authors | jq '.authors | length'

# 2. Self-discovery: our own TA exposes our concepts
curl -s "http://localhost:7778/api/concept-discovery/concepts-by-pubkey?pubkey=82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833" | jq '.concepts | map(.slug)'
# expect ["tag","nostr-relay","nostr-relay-tag", …, ~36 firmware concepts]

# 3. Foreign import (after running mint-foreign-concept.js to produce a demo TA)
FOREIGN_PK=$(jq -r '.taPubkey' tapestry/test-data/demo-foreign-concept.json)
curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"pubkey\":\"$FOREIGN_PK\",\"slug\":\"nostr-relay-v2\"}" \
  http://localhost:7778/api/concept-discovery/import | jq '.success'

# 4. Verify Neo4j: foreign ConceptHeader landed
docker exec tapestry bash -c "cd /usr/local/lib/node_modules/brainstorm && node -e \"
  (async () => {
    const { runCypher } = require('./src/lib/neo4j-driver');
    const rows = await runCypher('MATCH (c:ConceptHeader) WHERE c.uuid ENDS WITH \\\":nostr-relay-v2\\\" RETURN c.uuid, c.pubkey');
    console.log(rows);
  })();
\""

# 5. Multi-TA aggregation: publish a user kind-39999 z-tagged to the foreign coordinate, confirm it shows up in /api/relay-discovery/aggregated.
```

### End-to-end (browser)

1. Navigate to `/kg/concept-discovery` → see the bootstrap cards
   (self + demo foreign TA after seeding).
2. Click a card → results populate with that TA's concepts.
3. Click "Preview" on a foreign concept → schema + sets render.
4. Click "Import" → redirect to `/kg/concepts/<new-uuid>` showing the
   imported concept in the existing Concepts UI.
5. Navigate to `/kg/relay-discovery` → aggregated view should now count
   relays z-tagged to either our `nostr-relay` *or* the foreign
   `nostr-relay-v2` coordinate when both exist. (Does require at least
   one user-published kind-39999 against the foreign coordinate to
   demonstrate; the mint script can seed one.)
6. Open `PublishRelayForm` → the "other concepts" panel lists the
   foreign concept below our own.

---

## Standing issues carried over / uncovered by this PR

1. **Reconciliation prunes non-followed NostrUsers**, including any
   foreign concept-author TAs. If a user imports TA-X's concepts and
   doesn't follow TA-X, the next reconciliation sweep drops TA-X's
   NostrUser and cascades-deletes their AUTHORS edges, eventually
   nuking the imported concept. Two candidate fixes outside this PR:
   (a) teach reconciliation to exempt any pubkey that authored a
   `ConceptHeader`, or (b) remove the cascade behavior. Either way,
   this PR should document the issue in the ConceptDiscovery page's
   help text so imports don't feel randomly flaky.

2. **No re-import / refresh flow.** Once a foreign concept is imported,
   changes the foreign TA makes later aren't pulled in automatically.
   For MVP this is fine (concept schemas change rarely) but eventually
   we'll want a "check for updates" action on imported concepts. Out of
   scope for this PR.

3. **No "uninstall" flow.** A user who changes their mind about an
   imported concept has no way to remove it short of direct Cypher. Out
   of scope; ties into the reconciliation cleanup question above.

4. **Publish-time concept picker deferred** (per resolved design
   choice). Not a bug; documenting it here so the future work is
   obvious.

5. **Taxonomy merging** in the aggregated view. If TA-X defines a tag
   slug `commercial` and we define `paid` for the same concept, our
   aggregated tag columns show them as distinct buckets. That's
   probably correct — merging taxonomies silently would hide real
   disagreement — but a future UX could let users alias slugs.
