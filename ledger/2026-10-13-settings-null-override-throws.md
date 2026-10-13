# An override settings file holding JSON `null` makes every settings read throw

**Id:** 2026-10-13-settings-null-override-throws
**Type:** bug
**Opened:** 2026-10-13 (book `assistant-self-map`, story 2's review round 3, R3-N1; left out by ADR
`assistant-self-map/0002` Amendment 3 item 4)
**Status:** OPEN
**Done:** —

**What happens.**
- `getSettings()` (`src/config/settings.js:76–77`) returns `deepMerge(loadDefaults(), loadOverrides())`.
- `loadOverrides` returns whatever the override file parses to. For the JSON `null`, `deepMerge` calls
  `Object.keys(null)` and throws a TypeError.
- Every other bad file reads as the shipped defaults: missing, torn, a number, a string or an array.
- Readers differ in how they take the throw. `readConfiguredRelays` (`src/api/assistant/profilePublish.js:75–80`)
  swallows it into `[]`. `readAssistantDuties` (`src/api/assistant/dutyMenu.js:77`) lets it through.
- The app never writes `null` (`saveOverrides` is given an object), so only a hand edit reaches this.

The self-Map press refuses safely on it, with a 500 and nothing written, and a test pins that (ADR 0002 Amendment 3
item 4). Other pages may not.

**Fix shape.** Have `loadOverrides` treat a non-object parse as `{}`, with the same warning it gives a torn file. That is
shared settings code that every page reads, so it needs its own small story and a check of each reader.

**Pointer:** `engineering-team/reviews/assistant-self-map/2-turning-the-self-map-on-and-off.md`, Round 3, R3-N1.
