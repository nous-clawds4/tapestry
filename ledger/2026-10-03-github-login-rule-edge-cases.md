# The GitHub Account entry row and item page can still disagree on an oddly built item's login

**Id:** 2026-10-03-github-login-rule-edge-cases
**Type:** cleanup
**Opened:** 2026-10-03 (GitHub Dictionary pages, review 2 non-blocking; branch `feat/dictionary-github-account-item`)
**Status:** OPEN
**Done:** —

**What was seen.** The entry page reads an item's login from the Items read's `properties` (`itemProperties` in
`src/lib/trustedDictionary.js`: the first non-blank value of each tag name, at most 20 names). The item page reads it
with `githubLogin` (`ui/src/pages/dictionary/github.js`: the first `github-username` tag, blank or not). Two odd events
still split them; each side then shows the plain page, nothing worse:
- a blank `github-username` first and a valid one second: the entry row has the login, the item page doesn't;
- `github-username` after 20 other property tags: the item page has the login, the entry row doesn't.

Also cosmetic: once the Items read is truncated (over 1,000 filings), "No items match … among the first N" counts
merged rows, not filings (`ui/src/pages/dictionaries/ConceptEntry.jsx`, the Items' empty-search message).

**Fix shape.** `githubLogin` skips blank and non-string values as `itemProperties` does; read `github-username`
outside the 20-property cap (or raise the cap for names a header's Item Property Tags declare). Count filings in the
truncated empty-search sentence.

**Pointer:** `docs/DICTIONARY_PAGE_HANDOFF.md` (the 2026-10-03 GitHub Accounts bullet); `test/dictionary-github-account.test.js` G3, G10.
