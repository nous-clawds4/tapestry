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

**Occurrence, 2026-10-13** (`assistant-self-map` #3's Implementation, a build of `1bf674c` plus story 3's word swap).
- **The combined run:** B8 failed once in the chromium run of the self-Map spec and the nine hub specs (120 passed, 1
  failed, 5 skipped), with the same reading: `Expected substring: "wss://typed.example"`, the row still showing "This
  instance's relay … Another relay Save Cancel".
- **Alone, the first time it failed alone:** across eight solo runs of the spec on the same build, it passed seven
  times (14/14) and failed B8 once, with the same reading. So it isn't only load.
- **Story 3 changed nothing under `ui/src/pages/settings`;** its throwaway prototype's combined run had passed 121/0.

**Occurrence, 2026-10-13** (`assistant-self-map` #3's Review, a build of `7d1f0fc`).
- The combined chromium run failed B8 again (120 passed, 1 failed, 5 skipped), with the same reading.
- That makes both combined runs on story 3's builds, while story 2's last three combined runs passed B8. Story 3
  changed nothing under `ui/src/pages/settings`. It did add N6 to the self-Map spec, a long test (eleven page loads),
  and the runner uses two workers in parallel (`fullyParallel: true`), so it plausibly adds load beside B8. The fix is
  still B8's own wait (Fix shape above).
