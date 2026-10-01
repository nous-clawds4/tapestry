# The Treasure Map hook's Try again never re-reads the general-purpose relay list, so one failed list read sticks until reload

**Id:** 2026-10-01-treasure-map-retry-skips-relay-list
**Type:** bug
**Opened:** 2026-10-01 (my-assistants #3 review 1, non-blocking 2)
**Status:** OPEN
**Done:** —

**What was seen.** `useTreasureMap`'s `refresh` (`ui/src/hooks/useTreasureMap.js`) bumps a nonce that re-runs only the
local strfry scan. The general-purpose relay list comes from `useCypher`, which reads once, and the hook never calls
its `refetch`. So after one failed `POST /api/neo4j/query`, the hook stays `error` with "the general-purpose relay list
could not be read" however often Try again is pressed, until the page reloads. The review's probe P3 asked Cypher once
and local strfry twice, and the error stayed.

The My Assistants page (`/assistants`, my-assistants #3) is the first caller to offer Try again on that error; the
hook's other callers (`MyCuratedDLists.jsx`, `CuratedDListDetail.jsx`) offer none. The owner chose at review 1's gate
(2026-10-01) not to fix it in that pass.

**Fix shape.** Have `refresh` also refetch the relay list when it errored (additive, harmless to the other callers),
with a browser case: the Cypher read fails once, then Try again finds the Treasure Map.

**Pointer:** `engineering-team/reviews/my-assistants/3-the-treasure-map-on-the-page.md` § Findings, non-blocking 2 and
probe P3.
