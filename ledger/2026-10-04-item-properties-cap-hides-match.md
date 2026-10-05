# The Items read's 20-property cap can hide a song's release or artist from `match`

**Id:** 2026-10-04-item-properties-cap-hides-match
**Type:** cleanup
**Opened:** 2026-10-04 (the V4V Songs follow-up, review of 8d87fb6, non-blocking)
**Status:** OPEN
**Done:** —

**What was seen.** `itemProperties` (`src/lib/trustedDictionary.js`) keeps at most 20 property names per item, in tag
order. `match` compares against those properties, so a song whose `feedGuid` or `artist` tag comes after 20 other
property tags isn't matched by its own release or artist. Its own trusted filing then doesn't come back, and on a direct
visit with a complete read the page says it is "filed under V4V Song, but not by anyone … community trusts". V4V items
carry seven properties (`t`, `artist`, `url`, `duration`, `feedId`, `feedGuid`, `artwork`), so no real item is near the cap; the same cap is behind the GitHub case in ledger row
`2026-10-03-github-login-rule-edge-cases`.

**Fix shape.** Keep the properties a header's Item Property Tags declare (or the names a `match` asks for) outside the
cap; or, for the trust verdict, look the song's own filing up by its key (id or address) as well as by `match`.

**Pointer:** `src/lib/trustedDictionary.js` (`MAX_ITEM_PROPERTIES`, `itemProperties`, `trustedItems` `match`); `ui/src/pages/dictionary/Item.jsx` (`songItems`).
