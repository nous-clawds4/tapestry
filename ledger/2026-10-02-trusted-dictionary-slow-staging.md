# GET /api/trusted-dictionary takes 43–50 s on staging, against about 13 s on production

**Id:** 2026-10-02-trusted-dictionary-slow-staging
**Type:** bug
**Opened:** 2026-10-02 (Dictionary GUM₂, #808, staging smoke)
**Status:** OPEN
**Done:** —

**What was seen.** During #808's staging smoke test, `GET /api/trusted-dictionary` (the TrustedDictionary page's
read, not `/dictionary`) took 43–50 s on staging. Production, on older code, answered in 12.8 s.

It is most likely not #808:
- on the local stack, old and new code take the same time (about 0.5–1 s);
- the only change on that path adds `influence` to the trust read's RETURN.

Staging's graph is production-scale, though (`staging-graph-prod-scale`), so the difference is unexplained. No
timing from before the merge exists.

**Fix shape:**
- Time the endpoint on both hosts with the same code (production now has #808).
- Profile its reads: the strfry `#z` scan over every row's address, the trust Cypher, and the snapshot read.
- If it's the trust read, check the query plan on staging.

**Pointer:** this session's #808 smoke report; `src/api/adoption/index.js` `assembleTrustedDictionary`.
