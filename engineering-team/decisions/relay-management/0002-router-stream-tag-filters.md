# ADR 0002: Single-letter tag filters on Router Management streams

**Status:** Accepted
**Date:** 2026-07-15
**Story:** `engineering-team/stories/relay-management/2-router-stream-tag-filters.md`

## Context

Story #2 extends the tag-filter capability shipped in story #1 (ADR relay-management/0001) from the one-shot Negentropy Sync panel to the **persistent** Router Management streams. Acceptance criteria, quoted back:

- **AC-1** — entry and validation at parity with story #1: single-ASCII-letter tag names, one-at-a-time entry (letter + comma-separated values), merge-with-dedupe on duplicate letters, `p`/`e`/`a` (and uppercase) format-checked with bech32 (`npub`/`nprofile`/`note`/`nevent`/`naddr`) decode and normalized display, other letters free-form, invalid values block the add with an inline error naming the value.
- **AC-2** — saved into the deployed config per stream: each `"#<letter>": ["v1","v2"]` entry lands in that stream's filter in the deployed router config, **composed with** (never replacing) the stream's other filter parts, scoped to that stream alone; streams saved without tag filters produce **exactly** the config they produce today.
- **AC-3** — survives save → router restart via the panel's **existing** save/apply → restart flow; no new steps or confirmation UX; durable config, not session state.
- **AC-4** — round-trips into the editor: saved tag filters display (letter + values, normalized display) and are individually removable; removing one and saving deletes exactly that `"#<letter>"` key, leaving the stream's other tag filters and non-tag filter parts untouched.
- **AC-5** — the motivating case (OPEN.md #25) is expressible from the UI alone: a stream whose deployed filter carries `{"kinds":[39999],"#z":["<canonical handle>", …]}`, whether newly created or started from a preset; presets stay kinds-only starting points; no new preset ships.

Product decisions settled at Planning (binding, not reopened here): per-stream scoping; presets remain kinds-only starting points with tag filters editable on any stream; save/restart semantics unchanged.

### Existing pipeline (from source)

- **Server — `src/api/strfry/routerConfig.js`.** State lives at `/var/lib/brainstorm/router-state.json` (authoritative stream list; each stream `{ name, description, dir, filter, urls, pluginDown, pluginUp, enabled, preset }`). `POST /api/strfry/router-config` (`handleUpdateRouterConfig`, lines 145–182) takes `{ streams }` as a **full replacement**, validates `name` (`/^\w+$/`), `dir` (`both|up|down`), `urls` (array) — but passes `stream.filter` through **opaquely** into state and config. `applyConfig` (126–136) calls `generateConfig` (85–121), which emits `filter = ${JSON.stringify(stream.filter)}` as inline JSON in `/etc/strfry-router-tapestry.config`, then `supervisorctl restart strfry-router`. `initRouter` (314–324, called from `src/api/index.js` ~563) regenerates the config from state at control-panel boot. `GET /api/strfry/router-status` (`src/api/strfry/routerStatus.js`) returns the state's streams verbatim — the round-trip read path already exists.
- **UI — `ui/src/pages/settings/RelaySettings.jsx`.** `RouterStatus` (line 232) owns the tab; `StreamEditor` (39–196) is the add/edit form with a generic `updateFilter(key, val)` (49–51) and per-field blocks (Name, Direction, Event Kinds 113–132, Limit 134–139, Relay URLs, Plugins). `emptyStream()` (33–35) seeds `filter: { kinds: [], limit: 5 }`. Saves flow through `saveStreams` (288–308) → the POST above. The read card renders `Filter: kinds … (limit: n)` at 605–610.
- **Reusable pieces from story #1 (mandated reuse).** `ui/src/utils/tagFilterValidation.js` — pure ESM: `validateTagLetter` (line 29), `normalizeTagValue` (38), `parseTagValues` (84), `mergeTagFilter` (103). `TagFilterEditor` (RelaySettings.jsx 778–868) — a fully controlled component `{ tagFilters, onChange, disabled }` over `[{ letter, values }]`, module-scope in the same file as `StreamEditor`. Server-side twin guard: `TAG_FILTER_KEY_RE = /^#[a-zA-Z]$/` + shape check in `buildFilterObj` (`src/api/strfry/negentropySync.js` 26–41).

### Verified evidence: the deployed strfry-router accepts `#<letter>` stream-filter keys

Mandated verification, run 2026-07-16 against the local Docker container `tapestry` (binary `strfry 1.1.0-4-ge53d8de`; the image has no strfry source or docs, so the binary itself was tested). Reconciling the three surfaces:

**(a) What the repo's config-writer produces.** `generateConfig` emits the stream's filter as raw inline JSON (`filter = {"kinds":[0]}` style). Any `"#z"` key present in `stream.filter` is emitted as a quoted JSON key — `JSON.stringify` escaping makes tag *values* injection-safe in the config text.

**(b) What the running router loaded.** `docker exec tapestry cat /etc/strfry-router-tapestry.config` → `connectionTimeout = 20` + one enabled stream (`userProfiles`, `filter = {"kinds":[0]}`) — byte-wise `generateConfig` output. `router-state.json` carries 4 streams whose filters use only `kinds` (+ `limit`). Caveat recorded: the local `strfry-router` *process* has been FATAL since 2026-05-13 (boot-ordering artifact: supervisord gave up before the control panel first wrote the config file; the file exists now). This does not affect the parser/engine evidence below, which ran the binary directly.

**(c) What the binary's parser/filter engine accepts.** Live tests (config files written to container `/tmp`, `strfry router <file>` run directly; all test artifacts removed afterwards):

1. **Parse + connect:** `filter = {"kinds":[39999],"#z":["…"],"#p":["<64-hex>"]}` → `New stream group`, `Connected to ws://127.0.0.1:7777`, no errors.
2. **Down direction (REQ semantics):** live WebSocket REQ `{"kinds":[39999],"#z":["39998:82b75e…3833:tag-pinning"],"limit":3}` against the in-container relay returned exactly 3 matching events (each carrying that z tag) + EOSE — the relay-side filter engine a down-stream's REQ lands on honors `#z`.
3. **Up direction (router-local matching) — decisive:** an up-stream with `filter = {"kinds":[1],"#t":["adr0002match"]}` pointed at an instrumented fake WS remote; two fresh kind-1 events published locally (tags `t=adr0002match` / `t=adr0002nomatch`); the fake remote received **only** the matching event. The router itself enforces single-letter tag filters on up-bound events.
4. **Unknown filter keys hard-fail the whole config:** `{"bogusfield":["x"],"kinds":[1]}` → `ERR| Failed to parse router config: unrecognised filter item: bogusfield`.
5. **Malformed value types hard-fail:** `{"kinds":["notanumber"]}` → `error parsing kinds: std::get: wrong index for variant`.
6. **Multi-char tag keys hard-fail:** `{"kinds":[1],"#zz":["x"]}` → `error parsing #zz: unindexed tag filter` — the epic's single-letter guardrail is enforced by the parser itself.
7. **Full legal vocabulary parses:** `{"ids":[…64-hex…],"authors":[…64-hex…],"kinds":[1],"since":…,"until":…,"limit":5,"#t":["x"]}` → parses + connects. The router's filter language is the closed set `ids, authors, kinds, since, until, limit, #<single-letter>`.
8. **Empty `kinds` tolerated:** `{"kinds":[],"limit":5}` (what a brand-new UI stream saves today) → parses + connects.

**Design-shaping implication of 4–6:** under today's opaque pass-through, one bad filter key POSTed by any client is *persisted* and crash-loops the router at the next restart — taking down **every** stream, durably (supervisord gives up, exactly as the stale May FATAL shows). On this persistent surface, the epic's "server reconstructs filters, never passes client JSON through opaquely" guardrail is an availability requirement, not just hygiene.

### Constraints

JS-without-build, no new dependencies (`nostr-tools` and everything else needed already present; the `ws` module used in evidence tests ships nothing). Binding reuse of `tagFilterValidation.js` — extend, never fork. strfry indexes single-character tag names only (now proven parser-enforced). Epic guardrail: generic tooling — a `#z` value is an opaque operator string; no concept-graph semantics. Concept graph orientation done before source reading (`/api/concept-graph/summaries` → `nostr-relay` neighbors): `39998:<TA>:nostr-relay` is a standard class thread; router streams reference relay URLs as plain strings — **no concept definitions change**. No TA-pubkey involvement anywhere in this design (tag values are opaque operator input; the legacy-pubkey handle in evidence test 2 is data in the DB, not code).

## Options considered

### Option A — Reuse `TagFilterEditor` inside `StreamEditor`, `form.filter` as single source of truth, server-side filter reconstruction against the router's proven vocabulary (chosen)

Three pieces, each extending a story-#1 pattern:

1. **UI:** render the existing `TagFilterEditor` as a new field block in `StreamEditor`. No parallel state — the stream's `filter` object itself carries the `#x` keys; the editor's `[{letter, values}]` rows are *derived* from `form.filter` each render and written back into it on change. AC-4 round-trip falls out because `stream.filter` (from `router-status`) seeds the form.
2. **Validation module extension** (`tagFilterValidation.js`): two new pure conversion functions, `tagFiltersFromFilter(filter)` and `applyTagFilters(filter, tagFilters)`, mapping between the wire-format filter object and the editor's row model.
3. **Server:** `handleUpdateRouterConfig` stops passing `stream.filter` through opaquely. A new pure `sanitizeStreamFilter(filter)` reconstructs each stream's filter as an **insertion-order-preserving whitelist copy** of the router's proven-closed vocabulary (`ids`, `authors`, `kinds`, `since`, `until`, `limit`, `#[a-zA-Z]`) with per-key shape checks. Everything else — the keys evidence tests 4–6 prove would brick the router — is dropped.

Pros: AC-1 parity is *by construction* (same component, same validation functions); minimal new surface; round-trip needs no schema change (the `filter` object legitimately grows keys); the sanitizer guarantees the API can never persist a filter the deployed parser rejects, closing the crash-loop hole; insertion-order copying keeps the emitted config **byte-identical** for every existing stream (AC-2 regression guard), including hand-edited state carrying legal keys the UI doesn't render.
Cons: the router whitelist is broader than the UI's capabilities (`ids`/`authors`/`since`/`until` are preserved but not editable in the UI) — accepted, see sub-decision below; two whitelists now exist (sync panel's `buildFilterObj`, router's `sanitizeStreamFilter`), deliberately scoped per surface.

**Sub-decision — whitelist boundary = "what the deployed parser accepts", not "what the UI offers".** The POST is a full replacement: saving *any* stream round-trips *every* stream's filter through the server. A strict UI-capability whitelist (`kinds`/`limit`/`#x` only) would silently strip legal hand-edited keys (e.g. `authors`) from *untouched* streams on an unrelated save — violating AC-2's "every other stream's filter is unchanged" for exactly the population that hand-edits router config today (the OPEN.md #25 interim workaround; AC-4 explicitly covers streams "whose saved filter already contains tag filters" however they got there). The full legal vocabulary (evidence test 7) is a closed set, so "reconstruct + exclude garbage" and "round-trip fidelity for anything the router can parse" are simultaneously achievable. Unknown keys are still excluded — the guardrail's letter and spirit.

**Sub-decision — sanitize only at the client-JSON ingress** (`handleUpdateRouterConfig`). `handleToggleStream`, `handleRestoreDefaults`, `ensureState`, and `initRouter` consume server-local inputs (the presets file, already-persisted state) and stay untouched — no drive-by rewriting of an operator's hand-edited state file at boot or toggle.

**Sub-decision — server-side guard stays a CJS twin, not a cross-import.** The server needs only the key regex + shape checks (a few lines), not nip19 format validation (ADR 0001: server enforces *shape*, not value *format*). Follow ADR 0001's deliberate ESM/CJS duplication (`TAG_FILTER_KEY_RE` twin in `negentropySync.js` 26) rather than introducing `require(esm)` of a `ui/` module into the server tree.

### Option B — Store tag filters as a separate per-stream `tagFilters` field, composed into `#x` keys at `generateConfig` time

State schema grows `tagFilters: [{letter, values}]` beside `filter`; `generateConfig` merges them when emitting.

Pros: state mirrors the UI's row model; tag filters distinguishable from other filter parts.
Cons: two representations of one thing — `state.filter`'s `#x` keys (hand-edited) vs `state.tagFilters` can disagree, and the merge must define precedence; **breaks AC-4 for the motivating population**: a stream whose `#z` filter was already hand-edited into `router-state.json` (the current OPEN.md #25 workaround) would re-open in the editor showing *no* tag filters; state-file schema change and a migration question for zero expressive gain. Rejected.

### Option C — Freeform "filter JSON" textarea in `StreamEditor`

Pros: tiny diff; expresses everything at once.
Cons: fails AC-1's core UX (no one-at-a-time entry, no p/e/a validation, no bech32 normalization, no per-letter remove); and on a *persistent* surface a typo'd key doesn't just mis-match — evidence tests 4–6 show it crash-loops the router durably. The exact failure story #1 exists to prevent, with a worse blast radius. Rejected (same verdict as ADR 0001's Option C).

## Decision

We chose **Option A** — reuse `TagFilterEditor` inside `StreamEditor` with `form.filter` as the single source of truth, extend `tagFilterValidation.js` with two pure filter-object conversion helpers, and replace the server's opaque filter pass-through with an insertion-order-preserving whitelist reconstruction (`sanitizeStreamFilter`) over the router's proven filter vocabulary.

## Consequences

- The OPEN.md #25 dcosl tags-federation stream (`{"kinds":[39999],"#z":[<canonical handles>],"limit":5}`) becomes point-and-click; the ops follow-up (actually rolling it out) stays out of scope per the story.
- The router-config API can no longer persist a filter the deployed router cannot parse — the "one bad POST crash-loops every stream" hole is closed as a side effect of honoring the epic guardrail. (Restart failures from *non-filter* causes remain possible, as today.)
- Round-trip is lossless for every legal filter, including keys the UI doesn't render (`authors` etc. survive saves untouched, invisible in the editor). Editing them from the UI is future work, not promised here.
- Two per-surface whitelists exist (sync panel: `kinds/authors/since/until/#x`; router: `ids/authors/kinds/since/until/limit/#x`). Each documents its surface's vocabulary; a future shared module is possible but not warranted at this size.
- Tag-filter validation remains client-side for *format*, server-side for *shape* — unchanged posture from ADR 0001. POST body transport removes story #1's GET query-string length limitation on this surface; the comma-bearing-values limitation carries over (same entry UI).
- `tagFilterValidation.js`'s charter broadens from "the Negentropy Sync panel's tag filters" to both relay-management surfaces (header comment updated; ADR 0001 is **extended, not superseded** — its decision and the sync panel's behavior are untouched).
- Pre-existing, out-of-scope weakness observed while reading `generateConfig`: `urls` and `pluginDown`/`pluginUp` are interpolated into quoted config strings **without escaping** (`"${url}"`) — a malformed value can corrupt the config text. Unchanged by this story (tag filters ride `JSON.stringify`, which escapes); flagged for the ledger as a hardening candidate.
- **Firmware reinstall required?** No — no concept definitions change.

## Implementation notes

**1. `ui/src/utils/tagFilterValidation.js`** — extend (do not fork); update the header comment to name both panels and this ADR:

- `tagFiltersFromFilter(filter)` → `[{ letter, values }]`. Tolerates `null`/`undefined`/non-object → `[]`. For each own key matching `/^#[a-zA-Z]$/` whose value is an array: `values = filter[key].filter(v => typeof v === 'string' && v.length > 0)`; include `{ letter: key.slice(1), values }` when `values.length > 0`. Preserve key insertion order. Displayed values are whatever is stored (already normalized when added via the editor; hand-edited values display verbatim — the module never silently rewrites persisted config on load).
- `applyTagFilters(filter, tagFilters)` → new object: copy all non-`#<letter>` keys of `filter` (insertion order, `{}` when filter is nullish), then append `['#' + letter]: [...values]` per entry in list order. Pure, no mutation. Removing a letter from the list therefore deletes exactly that key (AC-4).

**2. `ui/src/pages/settings/RelaySettings.jsx`** — `StreamEditor` (39–196):

- Import the two new helpers alongside the existing line-3 imports.
- New field block **between Event Kinds (ends 132) and Limit (134)**, label `Tag Filters` with an `(optional — single-letter tag names, e.g. #z)` hint, rendering the existing `TagFilterEditor`:
  ```jsx
  <TagFilterEditor
    tagFilters={tagFiltersFromFilter(form.filter)}
    onChange={(next) => setForm(f => ({ ...f, filter: applyTagFilters(f.filter, next) }))}
    disabled={false}
  />
  ```
  (No new state hook; `TagFilterEditor` is already module-scope in this file and fully controlled. Its inline error styling and Enter-to-add come along for free — AC-1 parity by construction.)
- Read card (605–610): extend the existing Filter line to also render tag entries, e.g. append `` + tag filters `#z: v1, v2` `` after the kinds/limit text — one-line change so saved filters are visible without opening the editor. When a stream has tag filters but no kinds, the card must still show the tag filters (adjust the render condition from `stream.filter.kinds?.length > 0` to "has kinds or tag entries").
- `emptyStream()` (33–35) unchanged — new streams start with no tag filters.
- The Presets popup (517–521) stays kinds-only — presets are untouched (settled decision 2).

**3. `src/api/strfry/routerConfig.js`:**

- Top-level, mirroring `negentropySync.js:26`:
  ```js
  const TAG_FILTER_KEY_RE = /^#[a-zA-Z]$/;
  const SCALAR_INT_FILTER_KEYS = ['since', 'until', 'limit'];
  const STRING_ARRAY_FILTER_KEYS = ['ids', 'authors'];
  ```
- New pure `sanitizeStreamFilter(filter)` → object | `undefined`:
  - Non-object (incl. `null`, arrays, strings) → `undefined` (stream persists with no filter; `generateConfig`'s existing `if (stream.filter)` then omits the line).
  - Otherwise iterate `Object.keys(filter)` **in insertion order**, copying:
    - `kinds`: if `Array.isArray` → keep `filter.kinds.filter(Number.isInteger)`, **including when empty** (evidence test 8: today's UI emits `{"kinds":[],"limit":5}` and the parser accepts it — byte-compat requires preserving it);
    - `ids` / `authors`: if `Array.isArray` → keep entries `typeof v === 'string' && v.length > 0`; drop the key when the result is empty;
    - `since` / `until` / `limit`: keep when `Number.isInteger(filter[key])`;
    - keys matching `TAG_FILTER_KEY_RE`: keep `filter[key].filter(v => typeof v === 'string' && v.length > 0)` when non-empty (exact `buildFilterObj` posture, negentropySync.js 34–40);
    - everything else: dropped (evidence tests 4–6: anything else hard-fails the deployed parser).
- In `handleUpdateRouterConfig` (145–182), after the existing per-stream validation loop and before `saveState`: rebuild `streams` as `streams.map(s => ({ ...s, filter: sanitizeStreamFilter(s.filter) }))` (deleting the key when `undefined`, to keep state JSON clean).
- Extend `module.exports` (326–335) with `sanitizeStreamFilter` so the suite executes it directly (`generateConfig` is already exported).
- No changes to `generateConfig`, `applyConfig`, `initRouter`, `handleToggleStream`, `handleRestoreDefaults` — AC-3's save/apply → restart mechanics are untouched.

**4. Tests** (Tester's phase; levels fixed here per house precedent — the `sync-panel-tag-filters.test.js` pattern): new `test/router-stream-tag-filters.test.js` registered in `test/test.js`. The two new ESM helpers **executed** via dynamic `import(pathToFileURL(...))`; `sanitizeStreamFilter` + `generateConfig` **executed** via `require` (composition: sanitized stream → `generateConfig` output contains `"#z"` keys composed with kinds/limit; byte-identity for kinds/limit-only streams; garbage keys `bogusfield`, `#zz`, non-integer kinds entries dropped); the `StreamEditor`/card JSX surface asserted at **source level** (TagFilterEditor rendered inside StreamEditor wired to `form.filter` via the two helpers; card line extended). Round-trip AC-4 is exercised executably at the helper level (`applyTagFilters` → `tagFiltersFromFilter` inverse; remove-one-letter deletes exactly that key).

## Out of scope

- Concept-handle autocomplete or any concept-graph awareness on `#z` values; a tags-federation *preset*; multi-character tag names (parser-rejected, evidence test 6); in-place value editing; comma-bearing values; saved/named filter presets — all per the story.
- UI editing of `ids`/`authors`/`since`/`until` on streams (the sanitizer *preserves* them; surfacing them in the editor is a future story).
- Escaping/validation hardening of `urls` and `pluginDown`/`pluginUp` interpolation in `generateConfig` (pre-existing; flagged in Consequences for the ledger).
- Executing the OPEN.md #25 dcosl backfill/stream rollout (ops follow-up once this ships).
- Any change to the Negentropy Sync panel or its whitelist (`buildFilterObj` untouched).
- Auth posture of the `/api/strfry/router-*` endpoints (unchanged, whatever it is today).

## Architecture-invariant reflex checks (CLAUDE.md)

Operator-local instance configuration, not a trust surface: (1) *Who is this true for?* — this instance's operator; a router stream is inherently per-instance config, no global-truth claim. (2) *Where does this trust come from?* — no trust decision is made; the filter selects which events this instance chooses to move, which is the operator's prerogative ("aggregation is opinionated"). (3) *Could anyone else publish their own version?* — not a publish surface; no nostr event is gated at write time (a `#z`-filtered stream shapes this instance's aggregation, not anyone's ability to publish). (4) *What changes when the POV changes?* — nothing; router config is not POV-scoped data. No TA-pubkey coupling: all tag values are opaque operator-entered strings resolved by no code path.
