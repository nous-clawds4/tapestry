# Defining .text-muted made it real for 132 call sites, eight of which are error or failure messages nobody has re-read since

**Id:** 2026-09-20-muted-class-dims-failure-messages
**Type:** docs
**Opened:** 2026-09-20 (review of story `shared-concepts-row-detail` #1, non-blocking finding 1)
**Status:** OPEN
**Done:** —

Story `shared-concepts-row-detail` #1 added the missing rule
`.text-muted { color: var(--text-muted); }` (`ui/src/styles.css:32`). The class had been referenced
as a `className` in 43 files and defined in no stylesheet, so every "muted" string in the app had
always rendered at full body colour (`#e6edf3`). Verified before the fix on the running instance:
computed `color` was `rgb(230, 237, 243)`, identical to ordinary text, and no loaded `CSSStyleSheet`
contained a matching `selectorText`. After the fix all such elements resolve to `rgb(139, 148, 158)`.

That is the intended outcome and was owner-directed at the Architecture gate. The loose end is that
**eight of the 132 call sites carry error or failure text**, and they are now *less* prominent than
they were yesterday:

| Site | String |
|---|---|
| `ui/src/pages/shared-concepts/HeaderEvent.jsx:49` | renders the caught `{error}` itself |
| `ui/src/pages/settings/DatabaseSettings.jsx:163,185` | "Unable to load stats" |
| `ui/src/pages/shared-concepts/Detail.jsx:156` | "Shared concept not found." |
| `ui/src/pages/shared-concepts/SelfDeclaredDetail.jsx:84` | "Cannot locate the event on the community relay." |
| `ui/src/pages/shared-concepts/ActiveBTags.jsx:174,175` | "cannot locate event" / "cannot locate name" |
| `ui/src/pages/shared-concepts/BTagDetail.jsx:57` | "cannot locate name" |

Each author chose the muted class, so the new rendering is what was *written*. But it was written
against a class that did nothing, so nobody has ever seen these strings muted, and "written" and
"wanted" can differ for a failure message — `HeaderEvent.jsx:49` in particular dims a real error
string rather than a placeholder.

**Fix shape:** read the eight in a browser and decide per string. The "cannot locate …" table cells
are placeholders and are almost certainly right as muted; the two genuine error paths
(`HeaderEvent.jsx:49`, `DatabaseSettings.jsx:163,185`) are the candidates for `.error` or an
unmuted class. Small, and purely a judgement call about prominence — no mechanism to change.

**Pointer:** `ui/src/styles.css:32`; review
`engineering-team/reviews/shared-concepts-row-detail/1-row-detail-panels-on-active-tag-pages.md`,
non-blocking finding 1; ADR `shared-concepts-row-detail/0001` § Decision, "Scope amendment".
