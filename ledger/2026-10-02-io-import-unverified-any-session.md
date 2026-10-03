# Any signed-in session can import unverified events, signed as anyone, into this instance's relay and graph through /api/io/imports

**Id:** 2026-10-02-io-import-unverified-any-session
**Type:** bug
**Opened:** 2026-10-02 (Dictionary: Create New Concept from the finder, wired; its review round 2, R2-2)
**Status:** OPEN
**Done:** —

**What was seen.** Read from the code at `staging` 811c7666 plus the wired-create branch; not exercised against any
instance.
- `POST /api/io/imports/upload` and `POST /api/io/imports/:tempId/execute` (`src/api/io.js:640-642`) have no role
  check of their own.
- The auth middleware lets any authenticated session through to every POST outside its owner-only list
  (`src/middleware/auth.js`: "Endpoints accessible by any authenticated user (owner, customer, or guest)"), and
  `/api/io/imports` is not on that list.
- Execute pipes each uploaded raw event to `strfry import --no-verify` (`src/api/io.js:358-363`), then writes base
  Neo4j nodes and relationships for it (phases 1–3, `:427`).

So a signed-in guest can plant events whose `pubkey` is anyone's. The signatures are unchecked. For example, a
"header" claiming to be some Assistant's. These land in the relay and in the graph, which principle 4 treats as the
instance's definitive self.

The disposition endpoints and the new Create New Concept endpoint verify what they read before trusting it, for
exactly this reason. Readers that don't verify could act on a forged event.

**Fix shape (needs the owner's decision on who may import):**
- Gate both routes to the owner (add `/io/imports` to `ownerOnlyEndpoints`, or check in the handler); and/or
- verify every event before import: drop `--no-verify`, or run `verifyEvent` first and refuse or skip the failures,
  reporting them per item.
- Either way, add a stack-free test that an unsigned or forged event is refused.

**Pointer:** the review of the wired Create New Concept change, round 2, R2-2 (the PR to `staging` that adds
`src/api/adoption/newConcept.js`).
