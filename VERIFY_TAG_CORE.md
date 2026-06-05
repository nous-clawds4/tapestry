# Verify: nostr-user-tag read/score core (for Communities)

This branch (`chore/carve-nostr-user-tag-core`, off `staging`) lands **just the tag read + per-POV WoT-score core** so Communities can build membership rosters against it. It is **read-only** — there is no UI or publisher here. That matters for verification (see step 3).

**What's in scope:** `src/api/profile-tags/index.js` (read/score engine), `src/api/_shared/pov.js`, firmware concepts `tag` / `nostr-user-tag` / `tag-pinning`, route wiring. **Out of scope:** the pin→Trusted-List publisher, all writers, all UI.

## 1. Run it locally

Standard local stack (see OPERATIONS.md §"first bring-up" for detail):

```bash
git fetch && git checkout chore/carve-nostr-user-tag-core
sed -i 's/"80:80"/"127.0.0.1:8080:80"/' docker-compose.yml   # if not already remapped
docker compose up -d --build
docker compose ps                                            # tapestry, tapestry-redis, nostr-search-* up
```

## 2. Reinstall firmware — REQUIRED

This branch adds three concepts (`tag`, `nostr-user-tag`, `tag-pinning`). The install pipeline must register them or every read returns empty:

```bash
curl -X POST http://localhost:8080/api/firmware/install
```

Confirm the concepts registered (orient via the concept-graph API, per AGENTS.md):

```bash
curl -s http://localhost:8080/api/concept-graph/summaries | jq '.[].slug' | grep -E 'nostr-user-tag|^"tag"'
```

## 3. Seed sample events — REQUIRED (this core is read-only)

There is no UI to create tags here, and each instance's strfry is self-contained (OPERATIONS.md) — so a fresh local will have **zero** tag events and the endpoints will look empty. That's expected, not a bug. Two ways to get data:

- **(a) Pull from another instance:** enable the `dcosl` router preset in `/tapestry/settings/relays` to mirror existing tag events into local strfry.
- **(b) Seed directly with `nak` → strfry import.** Publish a tag-element + an assertion. **The `z`-tags below use the legacy literal pubkey** (`82b75e47…`) — that's intentional and deployment-independent (ADR-0015), and it's exactly what the read endpoints filter on (`TAG_Z_TAG` / `NOSTR_USER_TAG_Z_TAG` in `src/api/profile-tags/index.js`).

> Your Claude should read the exact z-tag constants and the tag/nostr-user-tag json-schemas on this branch and adapt the commands below, then confirm against `/available-tags`. This is a representative shape, not a guaranteed copy-paste.

```bash
LEG=82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833
SEC=$(nak key generate)                 # throwaway asserter key
TARGET=$(nak key generate | nak key public)   # a pubkey to "tag"

# (i) a tag-element "bird"  (z = 39998:<LEG>:tag)
TAGEL=$(nak event -k 39999 --sec "$SEC" -d tag-bird \
  -t z="39998:$LEG:tag" -c '{"tag":{"slug":"bird","name":"bird","description":"likes birds"}}')
echo "$TAGEL" | docker exec -i tapestry strfry import
TAGID=$(echo "$TAGEL" | jq -r .id)

# (ii) an assertion: asserter tags TARGET with "bird"  (z = 39998:<LEG>:nostr-user-tag)
nak event -k 39999 --sec "$SEC" -d "profile-tag-bird-${TARGET:0:8}-x" \
  -p "$TARGET" -e "$TAGID" -t z="39998:$LEG:nostr-user-tag" -t polarity=1 \
  -c '{"nostrUserTag":{"taggedPubkey":"'"$TARGET"'","tagEventId":"'"$TAGID"'"}}' \
  | docker exec -i tapestry strfry import
```

## 4. Hit the endpoints

```bash
# all tag-elements
curl -s 'http://localhost:8080/api/profile-tags/available-tags' | jq

# assertions on a target pubkey
curl -s "http://localhost:8080/api/profile-tags/tags-for-profile?pubkey=$TARGET" | jq

# per-target apply/dispute counts for a tag (the roster primitive Communities consumes)
curl -s "http://localhost:8080/api/profile-tags/profiles-tagged?tagEventId=$TAGID&wotPov=house" | jq

# tag index (all tags + counts)
curl -s 'http://localhost:8080/api/profile-tags/index' | jq
```

`profiles-tagged` is the one closest to your use case — `aggregateProfilesTagged()` is the "weight asserters by POV WoT → net polarity → per-target counts" math you'd reuse for a community roster.

## 5. Caveats to expect (not bugs)

- **WoT filter degrades to "all" without a POV.** With no house POV / no `wot_rank_<suffix>` Meili columns provisioned, the asserter gate is bypassed and every assertion counts. That's the documented graceful degradation — fine for a functional smoke test. To exercise real POV gating you need a configured house POV + indexed WoT columns.
- **Reads scan `#e`, not `#a` yet.** Per ADR-0022 we're moving to a hybrid `e`+`a` reference (consume by `#a`), but that's a follow-up touching this read path *and* the writer. Today seed/scan by `#e` (the assertion's `e` = tag-element id).
- **Empty results on a fresh instance are expected** until you seed (step 3).
