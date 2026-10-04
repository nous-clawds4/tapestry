# The Dictionary item page's generated sentence lower-cases the concept's plural ("one of the v4v songs")

**Id:** 2026-10-04-generic-item-lede-lowercases-plural
**Type:** cleanup
**Opened:** 2026-10-04 (the V4V Songs views, built from opinionated-views Appendix B; pushed to `staging`)
**Status:** DONE
**Done:** 2026-10-04 (the owner: drop the sentence; V4V Songs follow-up on `staging`)

**What was seen.** When an item carries no `description` tag, `ui/src/pages/dictionary/Item.jsx` writes one: "⟨name⟩ is one of
the ⟨plural⟩ the owner's trusted community has filed under ⟨concept⟩". The plural is lower-cased
(`plural = (entry?.plural || …).toLowerCase()`), so "V4V Songs" reads "v4v songs" and "GitHub Accounts" "github accounts".
V4V Song items never carry a description, so since 2026-10-04 every song page shows it, under the song's head.

**Fix shape.** Keep the plural as its header writes it (or lower-case only a first letter that the rest of the word
doesn't capitalise). The sentence is the generic tier's, so the GitHub page changes too; `test/dictionary-entry.test.js`
E9 pins the sentences' shape.

**Pointer:** `ui/src/pages/dictionary/Item.jsx` (`plural`, the `description` fallbacks); `docs/DICTIONARY_PAGE_HANDOFF.md` (the 2026-10-04 bullet).

**Resolution.** The owner saw no need for the sentence, so the item page no longer writes "⟨name⟩ is one of the ⟨plural⟩ … filed under ⟨concept⟩" for any item in the Items: the head's "Item N in ⟨concept⟩" and the footer's "Filed by" say it. The sentences for an item *not* in the Items (not filed here, filer not trusted, beyond the read's first N) stay. Pins: `test/dictionary-entry.test.js` E9, Playwright D20.
