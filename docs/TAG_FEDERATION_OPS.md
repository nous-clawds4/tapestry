# Tag federation — ops runbook (the content step)

_Short, do-it-tonight instructions for David + Vinney. This is the **ops half** of tag-federation:
the code (Half 1 read-union) shipped; this gets the real tag **content** flowing so tags
actually show up on `staging.brainstorm.world`. Not code — droplet + router config._

## The situation (verified 2026-06-17)

- **`tags.brainstorm.world`** has the real tags (35+ tag elements + taggings).
- **`staging.brainstorm.world`** has the tag UI but an **empty** tag index — its local strfry never received the tag events.
- **`dcosl.brainstorm.world`** (the shared DList relay) is **clean** (2 tag events under the canonical `tag` z, **zero junk** — the old "dcosl is polluted" claim was wrong; the birb test-junk is local-dev only). But dcosl **does not yet have tags.bw's content** either.

So the chain to light up staging is two hops: **(1)** get tags.bw's tag content onto dcosl, **(2)** get staging to read dcosl.

Relevant kinds for all tag/list content: **9998, 9999, 39998, 39999**. Mechanism reference: `OPERATIONS.md` §"Empty tag lists" (lines ~369–377) and BIBLE §14 "Router Presets".

---

## Two read levers — pick per environment

Once content is on dcosl, an instance can consume it two ways. **They are different and the choice matters:**

| Lever | What it does | Browse surfaces (`/tags` index, profile chips) | Search (`/api/search/*` tags) |
|---|---|---|---|
| **A. Read-union** (Half 1 code) — set `aTagFederationRelays` to dcosl in the admin | Live remote read at query time, nothing stored locally | ✅ shows dcosl tags | ❌ stays empty — **search is always local by design** |
| **B. Hoard** (router/sync `--dir down`) — pull dcosl events into local strfry | Events land locally; normal indexing picks them up | ✅ | ✅ once indexed into Meili |

**Rule of thumb:** read-union = lightweight live *browse* visibility, no disk. Hoard = full local copy, makes *search* work too. If you want staging's tag **search** to work (you said you'll flip `search.resultTypes.tags` soon), you need **B (hoard)** there — read-union will not feed search.

---

## Step 1 — push tags.brainstorm.world's content up to dcosl

SSH to the **tags.brainstorm.world** droplet, then:

```bash
# One-shot push (fastest way to see it tonight):
docker compose exec tapestry strfry sync wss://dcosl.brainstorm.world \
  --filter '{"kinds":[9998,9999,39998,39999]}' --dir up
```

`--dir up` = send local events the remote lacks. This uploads tags.bw's tag/tagging events to dcosl.

**Durable version (keep it flowing):** enable the `dcosl` router preset in `/tapestry/settings/relays` on tags.bw, set to **both-direction** (or up), kinds 9998/9999/39998/39999. The preset already exists (`setup/router-presets.json`); the router runs under supervisor (`supervisorctl status strfry-router`).

**Verify dcosl received it** (from anywhere — local dev is fine):
```bash
# Should now report many more than 2 events under the canonical tag z:
docker exec tapestry node -e '
const {SimplePool}=require("/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools/lib/cjs/index.js");
(async()=>{const p=new SimplePool();
const e=await p.querySync(["wss://dcosl.brainstorm.world"],{kinds:[39999],"#z":["39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:tag"]},{maxWait:8000});
console.log("dcosl tag elements:",e.length); p.close(["wss://dcosl.brainstorm.world"]); process.exit(0);})();'
```

---

## Step 2 — get staging to read dcosl

SSH to the **staging.brainstorm.world** droplet. Choose the lever:

### Option B — hoard (recommended; makes browse AND search work)
```bash
# One-shot pull dcosl → staging local strfry:
docker compose exec tapestry strfry sync wss://dcosl.brainstorm.world \
  --filter '{"kinds":[9998,9999,39998,39999]}' --dir down
```
Durable version: enable the `dcosl` router preset on staging set to **down** (or both-direction). After events land, the normal pipeline indexes them; tag search works once you flip `search.resultTypes.tags=true` in the search admin.

### Option A — read-union only (browse visibility, no disk, no search)
In staging's admin UI → **Relay Settings → "Tag Federation Relays"**, add:
```
wss://dcosl.brainstorm.world
```
Save. This is the Half-1 opt-in lever (`aRelays.aTagFederationRelays`). Browse surfaces federate live; **search stays local/empty** until you also hoard (Option B).

> You can do **both**: hoard (B) for the full local copy + leave `aTagFederationRelays` empty, OR read-union (A) for live browse without disk. For staging where you want search too, just do **B**.

---

## Step 3 — verify on staging

```bash
# Tag index should now report a non-zero count (was 0):
curl -s https://staging.brainstorm.world/api/profile-tags/available-tags | head -c 400
```
Then load `https://staging.brainstorm.world/tapestry` (or the tags UI) and confirm tag chips/index are populated.

---

## Gotchas

- **dcosl is clean, not junk.** Don't expect to need a cleanup. (The ~138 `birb-test` events are only in **local-dev** strfry — purge those on dev boxes if they bug you; they never federated anywhere.)
- **Read-union does not feed search.** This is intentional and ratified (`tag-federation` ADR 0001): Meili can only rank locally-indexed content. Want federated tags searchable → hoard them (Option B).
- **Old tags stay canonical-z-only.** Half 2 (the dual-z writer) is not deployed yet; that's fine — visibility rides the canonical z, which every existing tag already carries. Nothing here depends on Half 2.
- **`feat/pubkey-tagging-target` auto-deploys to `tags.brainstorm.world` on push** (it's the sandbox). Don't `cycle-staging`/`cycle-prod` from that branch. (Per project memory.)
- **Pin the relay you trust.** For arbitrary operators the lesson stands: federate/hoard only relays you trust. For us, dcosl is the trusted hub.

---

_Owner: Vinney + David, 2026-06-17 evening. Code side (Half 1 read-union + search-is-local fix) is on `feat/b-tag-primitive`, unpushed at time of writing._
