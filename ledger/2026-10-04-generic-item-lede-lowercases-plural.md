# The Dictionary item page's generated sentence lower-cases the concept's plural ("one of the v4v songs")

**Id:** 2026-10-04-generic-item-lede-lowercases-plural
**Type:** cleanup
**Opened:** 2026-10-04 (the V4V Songs views, built from opinionated-views Appendix B; pushed to `staging`)
**Status:** OPEN
**Done:** —

**What was seen.** When an item carries no `description` tag, `ui/src/pages/dictionary/Item.jsx` writes one: "⟨name⟩ is one of
the ⟨plural⟩ the owner's trusted community has filed under ⟨concept⟩". The plural is lower-cased
(`plural = (entry?.plural || …).toLowerCase()`), so "V4V Songs" reads "v4v songs" and "GitHub Accounts" "github accounts".
V4V Song items never carry a description, so since 2026-10-04 every song page shows it, under the song's head.

**Fix shape.** Keep the plural as its header writes it (or lower-case only a first letter that the rest of the word
doesn't capitalise). The sentence is the generic tier's, so the GitHub page changes too; `test/dictionary-entry.test.js`
E9 pins the sentences' shape.

**Pointer:** `ui/src/pages/dictionary/Item.jsx` (`plural`, the `description` fallbacks); `docs/DICTIONARY_PAGE_HANDOFF.md` (the 2026-10-04 bullet).
