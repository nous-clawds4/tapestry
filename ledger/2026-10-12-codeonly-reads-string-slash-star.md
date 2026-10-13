# The suites' `codeOnly` helper reads a `/*` inside a string as a comment opener

**Id:** 2026-10-12-codeonly-reads-string-slash-star
**Type:** meta
**Opened:** 2026-10-12 (`assistant-duties-settings` book close, retro P3; review round 1 note 5)
**Status:** OPEN
**Done:** —

**What happened.** Many suites copy one `codeOnly(src)` helper (38 test files mention it) to strip comments before
source sentinels. It blanks `/\*[\s\S]*?\*\//` without regard to strings. In `src/api/index.js` the route string
`'/api/settings/*'` opens a "comment" that runs to the next `*/`, and blanks 188 code lines, including any route
registered after it.

`assistant-duties-settings` A2 failed on correct code for that reason, and was switched to the raw source
(`9a7735a04`). The same blanking can make a negative sentinel pass vacuously ("X is never called" over blanked lines).

**Fix shape.**
- A string- and regex-aware stripper in one shared helper (e.g. `test/helpers/codeOnly.js`), adopted by the suites
  that read `src/api/index.js` and other route files first.
- Or, cheaper: a guard suite asserting that `codeOnly` keeps every `app.<verb>(` line of `src/api/index.js`.

**Pointer:** `test/assistant-duties-settings.test.js` (A2); `engineering-team/reviews/assistant-duties-settings/1-the-assistant-duties-tab.md`
(round 1 note 5).
