# The strfry-router limit patch uses GNU `sed -i`, so its suite fails whenever the gate runs on macOS

**Id:** 2026-10-09-router-patch-sed-macos
**Type:** bug
**Opened:** 2026-10-09 (assistant-trusted-content-status #1, merge re-review)
**Status:** OPEN
**Done:** —

`patches/strfry-router/apply-patches.sh:25` runs `sed -i 's|…|…|' "$TARGET"`. GNU sed takes that; macOS's BSD sed
reads the expression as the backup suffix and fails. The Docker build runs on Linux, so the image is fine. But
`test/router-stream-limit-on-connect.test.js` P1–P3, which run the script against a fixture, fail on every macOS gate,
on any branch: a fresh `git archive` of staging fails them too. They read as a regression in each reviewer's
comparison.

Fix shape (relay-stream-gaps' lane): `sed -i.bak … && rm -f "$TARGET.bak"` (portable to both seds), or write through
a temp file. Keep the script's own verify step.

**Pointer:** `engineering-team/reviews/done/assistant-trusted-content-status/1-scores-lists-and-concepts-on-the-hub.md` § Addendum (merge of assistant-profile-checklist)
