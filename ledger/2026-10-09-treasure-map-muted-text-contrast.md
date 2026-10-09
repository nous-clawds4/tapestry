# Muted text and label chips on /treasure-map read under 4.5:1

**Id:** 2026-10-09-treasure-map-muted-text-contrast
**Type:** cleanup
**Opened:** 2026-10-08 (treasure-map-card-details #2, Gate B review, non-blocking 2)
**Status:** OPEN
**Done:** —

Two text styles on the Manage your Treasure Map page sit under the 4.5:1 contrast AA asks for normal-size text:

- the uppercase label chips: `--text-muted` on `#f0f1ee`, **4.18:1** at 10 px bold. Edit mode's picker badges
  (`.bsd-tm-edit-badge`, "Local"/"Current") use this style, and so do the details panel's "Backup", "Individually
  assigned" and "Everything else" (`.bsd-tm-cat-details-tag`);
- the faint lines: `--bsd-faint` on white, **3.12:1**: "Not assigned yet" (`.bsd-tm-cat-none`) and the panel's
  "No entries yet." (`.bsd-tm-cat-details-none`).

The new panel copied the page's existing styles on purpose, so it stays consistent. The Needs attention pill was held
to 4.5:1 (4.84:1). **Fix shape:** darken the chip text, or lighten its background, and darken `--bsd-faint` where it
carries words, page-wide in one pass. Check the other Brainstorm-design pages that share the tokens before changing
them globally.

**Pointer:** `engineering-team/reviews/done/treasure-map-card-details/2-show-details-panel.md` (non-blocking 2);
`ui/src/styles.css` `.bsd-tm-edit-badge`, `.bsd-tm-cat-details-tag`, `.bsd-tm-cat-none`, `.bsd-tm-cat-details-none`.
