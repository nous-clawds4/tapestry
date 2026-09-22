# The strict local-then-outside relay lookup has three copies, and the attention module reads each relay three times on a miss

**Id:** 2026-09-22-strict-lookup-third-copy
**Type:** cleanup
**Opened:** 2026-09-22 (assistant-identification-tags #1, review non-blocking 1–2; ADR 0001 § Consequences)
**Status:** OPEN
**Done:** —

**What was seen.** ADR setup-status-and-alert/0001 wrote the strict "this instance's relay first, outside relays
only on a miss, finished only when a relay proved reachable" lookup in `src/api/setup/status.js` and noted that
`src/api/relay/fetchEvents.js:34` (`readStrict`) repeats its per-relay loop: "Unify them if a third caller
appears." The third caller is `src/api/assistant/attention.js` (`lookupByAddresses`, `readWithinBudget`,
`newest`, `dTagOf`), written as its own copy on purpose so as not to edit the setup book's module while that
book was in flight (ADR assistant-identification-tags/0001 sub-decision 3). Two smaller duplicates came with it:
`readPolarity`/`polarityBucket` now live in `src/lib/identification-tags` and in `src/api/profile-tags/index.js`,
and the tagging `d`-tag rule in `ui/src/utils/publishProfileTag.js` and the library's `taggingDTag` (pinned
equal by `test/assistant-attention.test.js` R1).

The attention module also runs three lookups in parallel (the viewer's, the assistant's, the canonical
author's), each reading every tag-federation relay once on a local miss: up to three sockets per relay per
signed-in page load.

**Fix shape.** One shared strict lookup under `src/api/_shared/` with a filter parameter, called by all three;
`profile-tags` importing the library's polarity reader; the publisher importing `taggingDTag`; and the attention
module batching its outside reads into one filter per relay. Do it in a quiet moment outside the two parallel
books (setup-status-and-alert, assistant-identification-tags), with the six suites that pin these modules.

**Pointer:** review `engineering-team/reviews/done/assistant-identification-tags/1-the-one-answer-and-the-hubs-first-real-mark.md`
§ Non-blocking 1–2; ADR `engineering-team/decisions/done/assistant-identification-tags/0001-one-assistant-attention-answer.md`
§ Consequences.

**2026-09-22, identification-tags-authorship #1.** The definitions are now looked up per author (two authors, one slug
each), so on a local miss the attention module reads each tag-federation relay up to four times per signed-in page
load, not three; the batching fix above covers it.
