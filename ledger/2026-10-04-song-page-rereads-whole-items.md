# A song's page reads the entry's whole Items again, even when opened from the table that just read them

**Id:** 2026-10-04-song-page-rereads-whole-items
**Type:** cleanup
**Opened:** 2026-10-04 (the V4V Songs views, review 1 non-blocking; pushed to `staging`)
**Status:** OPEN
**Done:** —

**What was seen.** The V4V Songs item page lists the release's other songs and more by the artist from the entry's
Items, so `Item.jsx` turns the Items read on for a song's page however it was opened (`enabled: (!passed || v4vPage)`).
On staging that read is a server scan of 22,556 events, answering about 620 KB in about 1.9 s, and the table the page was
opened from has just made the same read: `useConceptItems` (`ui/src/pages/dictionaries/conceptsDictionary.js`) keeps no
copy between pages. Moving from song to song within the page doesn't repeat it (the hook's inputs don't change), but
every visit from the table does.

**Fix shape.** Keep the last Items answer per (coord, shared, authors, point of view) for a short while in
`useConceptItems`, as `useGithubAccount` keeps GitHub's, so the table and the page share one read. Or pass the
table's answer in router state when it is small enough; history state is cloned on every entry, so not 620 KB.

**Pointer:** `ui/src/pages/dictionary/Item.jsx` (`useConceptItems`, `enabled`); `docs/DICTIONARY_PAGE_HANDOFF.md` (the 2026-10-04 bullet).
