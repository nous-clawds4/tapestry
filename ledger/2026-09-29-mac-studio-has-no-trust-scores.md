# The Mac Studio's stack holds no trust scores, so every trust-scored read comes back empty or zero there

**Id:** 2026-09-29-mac-studio-has-no-trust-scores
**Type:** meta
**Opened:** 2026-09-29 (Dictionary › Concepts rows fix, PR #782; the owner asked why the local Dictionary was empty)
**Status:** OPEN
**Done:** —

**What was seen.** On the Mac Studio's `tapestry` container, read-only Cypher through the loopback
`/api/neo4j/query`:
- 695,726 `NostrUser` nodes, and none has an `influence` property;
- no `NostrUserWotMetricsCard` rows for any observer.

**What it does.** Every read that gates on influence finds nobody trusted:
- `GET /api/trusted-dictionary` returns no entries, from the house point of view and from the owner's own. With no
  cards, the personalized branch falls back to house.
- Every Dictionary › Concepts row scores GUM₁ 0.

Usage is not the cause: the upstream `nostr user tag` has 5,034 items from 2,336 other authors on this relay, and on
staging, where scores exist, the same concepts are dictionary members. Before the 2026-09-29 fix the local Concepts
page was empty and said "no concept has enough trusted people filing items under it", which blamed usage.

**Why it matters.** A local check of any point-of-view feature runs against an empty trusted set here, so a wrong
filter and a correct one look the same. The live suites fixture their own scores (trusted-dictionary H1–H4 write
`NostrUser.influence` rows and remove them), so they pass anyway.

**Open question for the owner.** Should this stack compute house scores (GrapeRank)? It may have been paused on
purpose, since the Docker VM is tight on memory. If not, a trust-scored page could say when nobody has a score from
the active point of view, instead of implying low usage.

**Pointer:** `src/api/adoption/index.js` `resolveQualifying` (the house read is `NostrUser.influence > cutoff`);
`ui/src/pages/dictionaries/Concepts.jsx`.
