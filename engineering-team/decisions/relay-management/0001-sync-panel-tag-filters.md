# ADR 0001: Single-letter tag filters in the Negentropy Sync panel

**Status:** Accepted
**Date:** 2026-07-15
**Story:** `engineering-team/stories/relay-management/1-sync-panel-tag-filters.md`

## Context

The Negentropy Sync panel is `NegentropySync()` in `ui/src/pages/settings/RelaySettings.jsx:779–1179`. Every sub-panel (Relay, Direction, Event Kinds, Authors, Time Range) is a `useState` hook (lines 789–804) whose derived value feeds a single composition point, `filterObj` (lines 832–836); that object drives the Command Preview string (lines 837–841), the SSE **Start** call (line 857), and the **Count** call (line 925). Adding a filter capability = one more state hook + one more `settings-group` block + one more contribution to `filterObj`.

The server side is `src/api/strfry/negentropySync.js`. It deliberately does **not** pass client JSON through to the spawned process: every handler re-derives the filter via `buildFilterObj()` (lines 23–30), which whitelists exactly `kinds`, `authors`, `since`, `until`. All four consumers route through it: `buildCommand` (line 33 → `spawn('strfry', ['sync', relay, '--filter', JSON.stringify(filterObj)…])`, lines 73/161), `buildPreviewCommand` (line 42), and `handleNegentropySyncCount` (line 317 → both `strfry scan --count` and the NIP-45 remote `COUNT`). So a `"#x"` key sent by the UI today is silently dropped — the story's AC-8 requires extending this whitelist, not bypassing it. Values reach the process as an argv array (no shell), so tag values are injection-safe by construction; only the *display* preview string wraps the JSON in single quotes.

Validation building blocks already exist: `ui/src/utils/eventParam.js` (ADR event-page/0002) establishes the house pattern of a **pure, React-free ESM util** with `HEX64 = /^[0-9a-f]{64}$/i` and `nip19.decode()` (nostr-tools is a dependency of both `ui/` and the server). Its exports are /event-page-specific (they return page-target objects like `{mode:'naddrUnsupported'}`), so they are not directly reusable — but the pattern and the test level are: `test/event-page-ui.test.js` **executes** the pure util in the Node runner via `import(pathToFileURL(...))` and asserts the React surface at **source level** (no JSX transpile in the harness). Backend pure helpers are executed via `require` — which requires them to be exported (`negentropySync.js` currently exports only `registerNegentropySyncRoutes`, line 349).

Constraints: JS-without-build (no new tooling); strfry indexes only single-character tag names, so the letter constraint `[a-zA-Z]` is a real protocol boundary, not a UI nicety; tag letters are case-sensitive on the wire (`#x` ≠ `#X`); the epic guardrail says the panel bakes in no concept-graph semantics (a `#z` value is just a string). No TA-pubkey involvement anywhere in this change. Concept touched: `nostr-relay` (`39998:<TA>:nostr-relay`) as the sync counterparty — no schema change.

## Options considered

### Option A — Structured editor + pure validation core + explicit whitelist extension (chosen)

Three small pieces, each following an existing house pattern:

1. **`ui/src/utils/tagFilterValidation.js`** (new, pure ESM — the eventParam.js pattern): letter check, per-letter value validation/normalization (p/e/a formats, bech32 → hex), comma-list parsing, and pure merge-with-dedupe of the added-filters list. Unit-executable in the Node runner.
2. **`TagFilterEditor`** — a module-scope component inside `RelaySettings.jsx` (the `TimestampPicker` precedent, line 656): letter input + values input + Add, a row list with per-row Remove, inline error display. Parent owns the canonical `tagFilters` state.
3. **Backend**: extend `buildFilterObj()` with one guarded loop copying `/^#[a-zA-Z]$/` keys whose value is a non-empty array of non-empty strings; export the pure helpers for tests.

Pros: minimal surface, symmetrical with every existing sub-panel, testable at the established levels, keeps the server's reconstruct-don't-trust posture (AC-8 regression guard falls out of the regex). Cons: the whitelist stays something future filter fields must consciously extend (accepted — that's the epic's stated posture).

### Option B — Opaque filter pass-through on the server

Replace `buildFilterObj()` with "accept whatever JSON the client sent" (shape-check it's an object). Pros: never touch the server again for new filter fields. Cons: violates the epic guardrail and AC-8's regression guard (unknown non-tag keys must stay excluded); any client bug or hand-crafted request ships arbitrary JSON into a spawned command's argv; loses the one server-side choke point where filter shape is enforced. Rejected.

### Option C — Freeform "extra filter JSON" textarea in the UI

Merge a raw JSON textarea into `filterObj`. Pros: tiny diff, maximal expressiveness. Cons: fails the story's core UX — one-at-a-time entry with p/e/a validation and bech32 normalization (AC-5/6 unmet); typo'd pubkeys sail through to a live relay sync, which is exactly what the story exists to prevent. Rejected; could coexist later as an escape hatch if operators ask.

**Sub-decision — where validation lives:** extending `eventParam.js` was rejected: its contract is pinned by ADR event-page/0002 to the /event page's six params and target shapes; tag-value validation has different inputs (letter context) and outputs (normalized wire strings). Inline-in-component was rejected as untestable in this harness (no JSX transpile).

## Decision

We chose **Option A** — a pure validation module, a structured `TagFilterEditor` sub-panel owned by `NegentropySync`, and a one-loop, regex-guarded extension of the server's filter whitelist, with the backend's pure helpers exported for direct test execution.

## Consequences

- Enables precise tag-scoped syncs from the UI — the motivating case `{"kinds":[39999],"#z":["<canonical handle>"]}` becomes a point-and-click operation instead of a shell session in the container.
- The server whitelist grows by exactly one key class (`#` + single ASCII letter). Unknown non-tag keys are still dropped; future filter fields (`ids`, `limit`, …) still require deliberate whitelist additions — by design.
- Validation is client-side only (matches Authors, which passes unvalidated strings today). The server enforces *shape* (key regex, non-empty string arrays), not value *format* — strfry treats values as opaque match strings, and argv-array spawning means malformed values can mismatch but never injure.
- Accepted limitations, documented: values containing commas are inexpressible in the comma-separated field; very large value lists are bounded by GET query-string practicality (same as Authors today; EventSource forces GET for Start); a value containing a single quote renders a confusing *display* preview while the executed argv stays correct.
- New debt: none structural. `test/test.js` gains one suite registration (house convention).
- **Firmware reinstall required?** No — no concept definitions change.

## Implementation notes

**1. New file `ui/src/utils/tagFilterValidation.js`** (pure ESM, imports `nip19` from `nostr-tools`; header comment naming this ADR):

- `validateTagLetter(raw)` → `{ ok: true, letter }` | `{ ok: false, error }`. Accepts exactly one ASCII letter (`/^[a-zA-Z]$/`) after trimming; letters are case-sensitive (`x` ≠ `X`). Errors name the rule ("tag name must be a single letter a–z or A–Z").
- `normalizeTagValue(letter, raw)` → `{ ok: true, value }` | `{ ok: false, error }`. Per letter class:
  - `p`/`P`: 64-hex (case-insensitive in, lowercased out) **or** `npub…`/`nprofile…` via `nip19.decode` → hex pubkey. Wrong bech32 type (e.g. `note…`) is an error naming the value and expected forms.
  - `e`/`E`: 64-hex (lowercased) **or** `note…`/`nevent…` → hex event id.
  - `a`/`A`: coordinate `/^(\d+):([0-9a-fA-F]{64}):(.*)$/s` → normalized `${parseInt(kind,10)}:${hex.toLowerCase()}:${identifier}` (identifier may be empty or contain colons) **or** `naddr…` → `${kind}:${pubkey}:${identifier}`.
  - any other letter: any non-empty trimmed string, verbatim.
- `parseTagValues(letter, rawInput)` → `{ ok: true, values }` | `{ ok: false, error }`. Splits on commas, trims, drops empties; requires ≥1 value; runs `normalizeTagValue` on each; first failure aborts with its error (identifying the offending value); dedupes the result.
- `mergeTagFilter(tagFilters, letter, values)` → new array. `tagFilters` is `[{ letter, values }]`; exact-letter match merges (existing order kept, new values appended, deduped); otherwise appends a new entry. Pure — no mutation.

**2. `ui/src/pages/settings/RelaySettings.jsx`:**

- Module-scope `function TagFilterEditor({ tagFilters, onChange, disabled })` near `TimestampPicker` (line 656 area): one-letter input + comma-separated values input + **Add** button (Enter in the values field also adds); on add, `validateTagLetter` → `parseTagValues` → error goes to a local inline-error line (styled like the panel's existing error box, line 954 area), success calls `onChange(mergeTagFilter(...))` and clears inputs. Below, one row per added filter: `#x` in mono + its values + a ✕ Remove button → `onChange` minus that letter. All inputs take `disabled` (the `running` flag).
- In `NegentropySync`: add `const [tagFilters, setTagFilters] = useState([])` beside the other filter state (line 795 area); render `<TagFilterEditor …/>` as a new `settings-group` block titled **Tag Filters** *(optional)* between Authors (ends line 1060) and Time Range (line 1062); contribute to the composition point after line 836: `for (const { letter, values } of tagFilters) filterObj['#' + letter] = values;`. `handleStart`/`handleCount`/preview need no changes — they already serialize `filterObj`.

**3. `src/api/strfry/negentropySync.js`:**

- Top-level `const TAG_FILTER_KEY_RE = /^#[a-zA-Z]$/;`
- In `buildFilterObj()` after the `until` line (28): iterate `Object.keys(filter)`; for keys matching the regex, keep `filter[key].filter(v => typeof v === 'string' && v.length > 0)` when the result is non-empty. Everything else stays dropped.
- Extend exports (line 349) to `{ registerNegentropySyncRoutes, buildFilterObj, buildCommand, buildPreviewCommand }` so the test suite executes the pure helpers directly.

**4. Tests** (Tester's phase; levels fixed here per house precedent): new `test/sync-panel-tag-filters.test.js` registered in `test/test.js` — `tagFilterValidation.js` and the backend helpers **executed** (dynamic `import` / `require`), the JSX surface asserted at **source level** (component exists, state wired, group rendered between Authors and Time Range, composition loop present).

## Out of scope

- Saved presets/persistence, in-place value editing, multi-character tag names, concept-handle autocomplete, comma-bearing values (all per the story's Out of scope).
- Server-side p/e/a *format* validation (shape-only by decision above; revisit only if a non-UI client starts driving these endpoints).
- Any change to the `/api/negentropy-sync*` shell-script pipeline handlers in `src/api/index.js:279–289` — a different, older surface that this panel does not use.
