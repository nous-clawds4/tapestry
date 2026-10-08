# A song's page visited directly says twice that the Items read failed, and D43 doesn't check the lede stays

**Id:** 2026-10-04-song-page-items-failure-notices
**Type:** cleanup
**Opened:** 2026-10-04 (the V4V Songs views, review 2 non-blocking; commit deb7f11 on `staging`)
**Status:** DONE
**Done:** 2026-10-04 (V4V Songs follow-up on `staging`)

**What was seen.** Review 2 passed the V4V Songs views and left two small points:
- **Two notices.** On a direct visit to a song (not opened from a row), a failed Items read shows the page's
  `readError` ("Couldn't read the entry's Items (…), so this page can't say where the item stands in them.") and the
  lists' `songListsError` ("… so this page can't list the release's other songs or more by the artist."). Each is
  true; together they repeat the same opening.
- **An untested claim.** Commit deb7f11 says the lede stands when the read fails on a page opened from a row; D43
  checks the row's number and the lists' notice there, not the lede.

**Fix shape.** In `ui/src/pages/dictionary/Item.jsx`, drop `songListsError` when `readError` is set and widen
`readError` on a song's page to name the lists too. In D43 (`tests/brainstorm/dictionary-concepts.spec.js`), assert
the lede ("… is one of the …") after the failed read.

**Pointer:** `ui/src/pages/dictionary/Item.jsx` (`readError`, `songListsError`); D43.

**Resolution.** A failed read now gets one notice: the lists' when the page was opened from a row (the Items table's or the page's lists'), else one sentence for both what the page can't say and what it can't list (D43 checks there is exactly one). The lede half no longer applies: the "is one of the" sentence is gone (ledger row `2026-10-04-generic-item-lede-lowercases-plural`).
