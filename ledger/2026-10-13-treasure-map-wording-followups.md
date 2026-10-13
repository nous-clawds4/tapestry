# Your Assistant's Treasure Map page: wording follow-ups left by story 3's review

**Id:** 2026-10-13-treasure-map-wording-followups
**Type:** cleanup
**Opened:** 2026-10-13 (book `assistant-self-map`, story 3's review, S3-N1 to S3-N5)
**Status:** OPEN
**Done:** —

Story 3 renamed every line a person reads from "self-Map" to "Treasure Map", word for word as its § Copy, and passed
review. Its review left these non-blocking points. S3-N1 to S3-N3 are wording questions for the owner, likely to be
settled with the owner's next change on what on and off mean. S3-N4 and S3-N5 are small test and record fixes.

- **S3-N1, the "should" panel for the Owner.** Under the new heading "What your Assistant's Treasure Map should list",
  the unchanged explainer "Only the duties that are live now, each at the relay where it is published." reads as "the
  map should hold only live duties". For the Owner, the map also holds this instance's entries naming other
  Assistants, and keeps them. Under the old heading ("…self-Map should say") it was true. The published panel's
  heading has the same shape, but the Owner's line beneath it names the other entries.
- **S3-N2, "None is live yet" against a live line.** When the Assistant Duties list offers `39998` without `39999`, a
  bare `39998` duty is live but can't be listed (the key also covers `39999`). The page shows "Live, but your
  Assistant's Treasure Map doesn't list it yet.", and a Turn on answers "…None is live yet, so nothing was published."
  The old words ("Nothing is live to claim yet") held. Reproduced with `evaluateSelfMap`: offer `39998` only gives
  `shouldSay []` and that line, with `current` true. The line itself saying "yet" for a duty that can never be listed
  predates story 3.
- **S3-N3, the on/off lines.** While on, "Remove your Assistant's duties from its Treasure Map" shows even when nothing
  is listed or no map exists; pressed then, it only turns the setting off. "…is set to list its live duties" can read
  as automatic, which only story 4's upkeep makes true.
- **S3-N4, two lines no Node test pins word for word.** The Owner's line's new ending ("not your Assistant's own
  duties") is pinned only by browser B5; the page's own report subject (`press.subject`, used in the publish report's
  fallback lines) by none. Rewording either still passes the page suite (22/0). Pin them in P1 or Q1 with equality.
- **S3-N5, records.** `src/api/assistant/selfMapPublish.js:12` and `:133` still call the upkeep "story 3's automation"
  (now story 4). Story 3's test plan calls P1 "word for word" (it checks presence, and only the Owner's line's lead),
  and its "AC-1, on screen" row omits B5, B7, B9 and B11. Story 3's AC-3 speaks of the card showing its criteria; no
  screen shows them for this card.

**Pointer:** `engineering-team/reviews/assistant-self-map/3-one-name-for-your-assistants-treasure-map.md`, Findings.
