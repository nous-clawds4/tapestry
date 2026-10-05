# With a domain set, llms.txt says "start here" twice: the new section and the Concepts entry

**Id:** 2026-10-05-llms-txt-start-here-said-twice
**Type:** docs
**Opened:** 2026-10-05 (information-for-agents #1 review)
**Status:** OPEN
**Done:** —

On a deployed host, `/llms.txt` now opens with a `## Start here` section linking the information-for-agents briefing.
The first entry of `## Protocols` (Concepts) still ends "Start here." (`src/utils/siteTrust.js`, the `LLMS_TXT`
constant). Both texts are as their ADRs prescribe (`llms-txt/0001`, `information-for-agents/0001`). An agent gets two
competing first stops. The intent is clear enough in context: the briefing for integration questions, Concepts for
the model. It's still worth one consistent wording.

**Fix shape.** Rename the new section, for example "## Building on Brainstorm" (update `test/information-for-agents.test.js`
U7 and H4, which pin the heading). Or reword the Concepts note to "the model behind every spec". Check first whether
other fleets' `llms.txt` copies carry the same Concepts text.

**Pointer:** `src/utils/siteTrust.js` (`LLMS_TXT`, `llmsTxtStartHere`); review
`engineering-team/reviews/information-for-agents/1-information-for-agents-page-and-briefing.md` (non-blocking finding 1).
