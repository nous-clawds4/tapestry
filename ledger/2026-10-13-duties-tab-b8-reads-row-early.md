# The Assistant Duties tab's browser spec B8 can read the row before the Change relay panel closes, under load

**Id:** 2026-10-13-duties-tab-b8-reads-row-early
**Type:** bug
**Opened:** 2026-10-13 (book `assistant-self-map`, story 2's round 2 Implementation)
**Status:** OPEN
**Done:** —

**What was seen.** `tests/brainstorm/assistant-duties-settings.spec.js` B8 ("changing a relay") failed once in a
combined chromium run of ten hub specs, against a build of `0d0c848` + story 2 round 2. The failure:

```
expect(squash(await row().innerText())).toContain(TYPED)
Received: "⋮⋮ 30382 Scores This instance's relay Move up Move down Change relay Remove This instance's relay Another relay Save Cancel"
```

- The PUT had already been sent with the typed relay (`log.puts[0]` passed). The row still showed the open panel and
  the old relay, so the assertion read it before the re-render.
- Story 2 changed nothing under `ui/src/pages/settings`.
- The same build passed the spec alone three times (14/14 each).

**Fix shape.** Wait for the row to show the typed relay, with `expect(row()).toContainText(TYPED)` or
`expect.poll`, rather than reading `innerText()` once. That is the Tester's lane, in that spec.

**Pointer:** the combined run's log, as summarized in story 2's round 2 Implementation (book `assistant-self-map`).
