# The legacy Treasure Map generators rewrite the score rows an edit gave to another Assistant

**Id:** 2026-10-08-legacy-generators-overwrite-edited-scores
**Type:** bug
**Opened:** 2026-10-08 (treasure-map-edit, Edit mode planning; book decision 12)
**Status:** OPEN
**Done:** —

Edit mode on `/treasure-map` lets a person give their Scores to another Assistant. That rewrites the `30382:<metric>`
rows setup wrote (book decision 12). The two older generators, the API behind the legacy customer page
(`src/api/export/nip85/commands/create-unsigned-kind10040.js`) and the CLI behind the legacy NIP-85 control panel
(`bin/brainstorm-create-kind10040.js`), own those rows. When either regenerates, `src/lib/treasureMapMerge.js` replaces
every `30382:*` row as one block naming the provider it's given, which puts Scores back on the person's Assistant here.
The owner accepted this for now (decision 12) rather than change those Tapestry-side tools in the Edit mode book.

**Fix shape.** Either the generators keep a row whose provider isn't the one they'd write (regenerate only the rows
that name the provider they manage), or they ask before replacing rows that name another Assistant, or they retire
once Edit mode and the Advanced page cover what they do.

**Pointer:** `engineering-team/audits/treasure-map-edit/book.md`, decision 12.
