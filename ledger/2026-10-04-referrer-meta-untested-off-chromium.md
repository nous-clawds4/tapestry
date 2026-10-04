# The V4V players' no-referrer policy is verified in Chromium only

**Id:** 2026-10-04-referrer-meta-untested-off-chromium
**Type:** cleanup
**Opened:** 2026-10-04 (the V4V Songs views, built from opinionated-views Appendix B; pushed to `staging`)
**Status:** OPEN
**Done:** —

**What was seen.** An `<audio>` element has no `referrerpolicy` of its own, so while a V4V player is shown,
`useNoReferrer` (`ui/src/pages/dictionary/V4vSong.jsx`) appends `<meta name="referrer" content="no-referrer">`, and when
the last player goes it appends and removes one carrying the page's own policy (removing a referrer meta doesn't undo
it, per the HTML spec). Playwright D43 shows Chromium honouring both: no `Referer` to the audio host or a probe while
a player is shown, the origin again after. The cloud container has no Firefox or WebKit build, so neither was run.

**Fix shape.** Run D43 (`tests/brainstorm/dictionary-concepts.spec.js`) under `--project=firefox` and a WebKit
project on a machine that has them. If one doesn't apply a dynamically inserted referrer meta to media requests,
the fallback Appendix B names is an app-wide `no-referrer` in `ui/index.html`.

**Pointer:** `ui/src/pages/dictionary/V4vSong.jsx` (`useNoReferrer`); `protocols/drafts/opinionated-views.md` Appendix B § Privacy and safety.
