/**
 * Story relay-management #2 (single-letter tag filters on Router Management
 * streams). ADR relay-management/0002. See the .test-plan.md alongside the
 * story.
 *
 * ADR 0002 chose Option A: reuse the story-#1 TagFilterEditor inside
 * StreamEditor with form.filter as the single source of truth; extend
 * ui/src/utils/tagFilterValidation.js with two pure conversion helpers
 * (tagFiltersFromFilter / applyTagFilters); replace the server's opaque
 * filter pass-through in src/api/strfry/routerConfig.js with a pure
 * insertion-order-preserving whitelist reconstruction (sanitizeStreamFilter,
 * newly exported) over the router's proven filter vocabulary
 * (ids/authors/kinds/since/until/limit/#[a-zA-Z]).
 *
 * TEST LEVEL (ADR §Implementation 4; sync-panel-tag-filters precedent): the
 * two new ESM helpers are EXECUTED via dynamic import in the Node runner; the
 * backend pure functions (sanitizeStreamFilter + the already-exported
 * generateConfig) are EXECUTED via require — composition tests build stream
 * objects and assert over the returned config TEXT (no file writes, no
 * process spawns, no supervisord/strfry/docker/network: stack-free, CI-safe).
 * The React surface is asserted at the SOURCE level (no JSX transpile in this
 * harness).
 *
 * The two helpers / sanitizeStreamFilter / the StreamEditor wiring do not
 * exist pre-implementation, so the U-, B- and S-tests FAIL now (each with a
 * message naming the missing export or wiring — the modules themselves load
 * fine, so there are no import crashes) and PASS once built. R* are
 * regression sentinels (additive change) — they PASS before AND after.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { generateSecretKey, getPublicKey } = require('nostr-tools');

const VALIDATION = path.resolve(__dirname, '../ui/src/utils/tagFilterValidation.js');
const RELAY_SETTINGS = path.resolve(__dirname, '../ui/src/pages/settings/RelaySettings.jsx');
const ROUTER_CONFIG = path.resolve(__dirname, '../src/api/strfry/routerConfig.js');
const PRESETS = path.resolve(__dirname, '../setup/router-presets.json');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
async function loadEsm(absPath) { try { return await import(pathToFileURL(absPath).href); } catch { return null; } }
function loadBackend() { try { return require(ROUTER_CONFIG); } catch { return null; } }
function eq(a, b, msg) {
  assert(JSON.stringify(a) === JSON.stringify(b), `${msg}\n      expected: ${JSON.stringify(b)}\n      actual:   ${JSON.stringify(a)}`);
}

/**
 * Slice a top-level section out of a source file: from startMarker to the
 * earliest of the endMarkers (or EOF). Used for the source-level tests so
 * assertions are scoped to the right component/function.
 */
function sliceSection(src, startMarker, endMarkers) {
  const start = src.indexOf(startMarker);
  if (start === -1) return '';
  let end = src.length;
  for (const m of endMarkers) {
    const i = src.indexOf(m, start + startMarker.length);
    if (i !== -1 && i < end) end = i;
  }
  return src.slice(start, end);
}

/** Match calls to sanitizeStreamFilter but not its declaration. */
function callsSanitize(body) {
  return /sanitizeStreamFilter\s*\(/.test(body.replace(/function\s+sanitizeStreamFilter\s*\(/g, ''));
}

/** Extract one named stream block from generateConfig output text. */
function streamBlock(configText, name) {
  const open = `\n    ${name} {\n`;
  const start = configText.indexOf(open);
  if (start === -1) return null;
  const close = '\n    }\n';
  const end = configText.indexOf(close, start);
  if (end === -1) return null;
  return configText.slice(start, end + close.length);
}

// nip19-minted, self-validating fixtures (house pattern) — no hardcoded TA
// pubkey anywhere; the #z values are canonical-handle-SHAPED opaque strings.
const HEX_PK = getPublicKey(generateSecretKey()).toLowerCase();
const HANDLE_A = `39998:${HEX_PK}:tag`;
const HANDLE_B = `39998:${HEX_PK}:tag-pinning`;
const EVENT_ID = 'b'.repeat(64);

const NOT_IMPL = (what) =>
  `${what} — feature not implemented yet (ADR relay-management/0002).`;

// ===========================================================================
// U: ui/src/utils/tagFilterValidation.js — the two new conversion helpers,
// EXECUTED (the bridge between the shared TagFilterEditor and stream.filter)
// ===========================================================================

test('U1: tagFiltersFromFilter turns a saved stream filter\'s "#<letter>" keys into editor rows — letter + values, tag-key insertion order kept, non-tag keys skipped (AC-1 seed, AC-4 display)', async () => {
  const mod = await loadEsm(VALIDATION);
  assert(mod, 'ui/src/utils/tagFilterValidation.js must load as ESM — unexpected.');
  assert(typeof mod.tagFiltersFromFilter === 'function',
    NOT_IMPL('ui/src/utils/tagFilterValidation.js must export tagFiltersFromFilter'));
  const rows = mod.tagFiltersFromFilter({ kinds: [39999], '#z': [HANDLE_A, HANDLE_B], limit: 5, '#t': ['topic'] });
  eq(rows, [{ letter: 'z', values: [HANDLE_A, HANDLE_B] }, { letter: 't', values: ['topic'] }],
    'AC-4: each saved #<letter> key becomes one displayable row; kinds/limit are not rows.');
  const flipped = mod.tagFiltersFromFilter({ '#t': ['topic'], kinds: [1], '#z': ['v'] });
  eq(flipped, [{ letter: 't', values: ['topic'] }, { letter: 'z', values: ['v'] }],
    'tag-key insertion order is preserved wherever the keys sit among other filter parts.');
});

test('U2: tagFiltersFromFilter tolerates nullish/non-object filters and hand-edited garbage — never rewrites stored values on load (AC-4 robustness)', async () => {
  const mod = await loadEsm(VALIDATION);
  assert(mod && typeof mod.tagFiltersFromFilter === 'function',
    NOT_IMPL('ui/src/utils/tagFilterValidation.js must export tagFiltersFromFilter'));
  for (const notObj of [null, undefined, 'a-string', 42, ['#z']]) {
    eq(mod.tagFiltersFromFilter(notObj), [],
      `tagFiltersFromFilter(${JSON.stringify(notObj)}) must be [] — a stream with no usable filter shows no rows.`);
  }
  eq(mod.tagFiltersFromFilter({ '#z': 'not-an-array' }), [], 'a non-array tag value is not a row.');
  eq(mod.tagFiltersFromFilter({ '#z': [] }), [], 'a letter with no values is not a row.');
  eq(mod.tagFiltersFromFilter({ '#z': ['', 42, null, 'ok'] }), [{ letter: 'z', values: ['ok'] }],
    'non-string / empty members of a hand-edited value array are skipped, the rest display.');
  eq(mod.tagFiltersFromFilter({ '#zz': ['x'], '#1': ['x'], z: ['x'] }), [],
    'only /^#[a-zA-Z]$/ keys are tag rows — #zz, #1 and bare letters are not.');
  eq(mod.tagFiltersFromFilter({ '#x': [' As-Stored '] }), [{ letter: 'x', values: [' As-Stored '] }],
    'stored values display verbatim — loading a stream never silently rewrites persisted config.');
});

test('U3: applyTagFilters writes editor rows back into the filter — non-tag keys copied first in insertion order, then one "#<letter>" key per row; pure; nullish filter starts from {} (AC-1 entry, AC-2 composition)', async () => {
  const mod = await loadEsm(VALIDATION);
  assert(mod && typeof mod.applyTagFilters === 'function',
    NOT_IMPL('ui/src/utils/tagFilterValidation.js must export applyTagFilters'));
  const base = { kinds: [1], limit: 5 };
  const frozen = JSON.stringify(base);
  const out = mod.applyTagFilters(base, [{ letter: 'z', values: ['v1', 'v2'] }, { letter: 't', values: ['x'] }]);
  assert(JSON.stringify(out) === JSON.stringify({ kinds: [1], limit: 5, '#z': ['v1', 'v2'], '#t': ['x'] }),
    `AC-2: tag filters compose with — never replace — the stream's other filter parts, non-tag keys first then rows in list order.\n      actual: ${JSON.stringify(out)}`);
  assert(JSON.stringify(base) === frozen, 'applyTagFilters must not mutate its input filter (pure).');
  const rows = [{ letter: 'z', values: ['v1'] }];
  const out2 = mod.applyTagFilters({}, rows);
  rows[0].values.push('mutated-later');
  eq(out2['#z'], ['v1'], 'value arrays are copied into the result, not aliased.');
  eq(mod.applyTagFilters(null, [{ letter: 'z', values: ['v'] }]), { '#z': ['v'] },
    'a nullish filter starts from {} — rows still land.');
  eq(mod.applyTagFilters({ '#q': ['stale'], kinds: [1] }, [{ letter: 'z', values: ['v'] }]), { kinds: [1], '#z': ['v'] },
    'the row list wholly replaces the filter\'s previous #-keys — rows are the single source of truth.');
});

test('U4: removing one row and applying deletes exactly that "#<letter>" key — other tag filters and non-tag parts (even ones the UI does not edit) untouched (AC-4 removal)', async () => {
  const mod = await loadEsm(VALIDATION);
  assert(mod && typeof mod.tagFiltersFromFilter === 'function' && typeof mod.applyTagFilters === 'function',
    NOT_IMPL('tagFiltersFromFilter and applyTagFilters must both be exported'));
  const filter = { kinds: [39999], '#z': [HANDLE_A], limit: 5, '#t': ['topic'], authors: [HEX_PK] };
  const rows = mod.tagFiltersFromFilter(filter);
  const withoutZ = rows.filter(r => r.letter !== 'z');
  const out = mod.applyTagFilters(filter, withoutZ);
  assert(!('#z' in out), 'AC-4: exactly the removed #z entry is gone from the filter.');
  eq(out['#t'], ['topic'], 'AC-4: the stream\'s remaining tag filters are untouched.');
  eq(out.kinds, [39999], 'AC-4: kinds untouched by a tag-filter removal.');
  eq(out.limit, 5, 'AC-4: limit untouched by a tag-filter removal.');
  eq(out.authors, [HEX_PK], 'AC-4: hand-edited non-tag parts the UI does not render survive the removal.');
});

test('U5: the two helpers are inverses — rows survive a write→read cycle, and re-opening then saving an untouched stream is a byte-identical no-op (AC-4 round-trip, AC-2 guard)', async () => {
  const mod = await loadEsm(VALIDATION);
  assert(mod && typeof mod.tagFiltersFromFilter === 'function' && typeof mod.applyTagFilters === 'function',
    NOT_IMPL('tagFiltersFromFilter and applyTagFilters must both be exported'));
  const rows = [{ letter: 'z', values: [HANDLE_A] }, { letter: 'X', values: ['big'] }];
  eq(mod.tagFiltersFromFilter(mod.applyTagFilters({ kinds: [1] }, rows)), rows,
    'AC-4: what the editor saves is exactly what it displays on re-open (case-sensitive letters included).');
  const saved = { kinds: [39999], limit: 5, '#z': [HANDLE_A, HANDLE_B] };
  assert(JSON.stringify(mod.applyTagFilters(saved, mod.tagFiltersFromFilter(saved))) === JSON.stringify(saved),
    'open → save with no edits must not change the stream\'s filter at all (key order included).');
});

// ===========================================================================
// B: src/api/strfry/routerConfig.js — sanitizeStreamFilter + generateConfig,
// EXECUTED via require (pure functions; config TEXT asserted, nothing spawned)
// ===========================================================================

test('B1: sanitizeStreamFilter is exported and keeps "#<letter>" entries composed with kinds/limit, insertion order preserved (AC-2)', () => {
  const be = loadBackend();
  assert(be, 'src/api/strfry/routerConfig.js must load.');
  assert(typeof be.sanitizeStreamFilter === 'function',
    NOT_IMPL('src/api/strfry/routerConfig.js must export sanitizeStreamFilter'));
  const input = { kinds: [39999], limit: 5, '#z': [HANDLE_A] };
  assert(JSON.stringify(be.sanitizeStreamFilter(input)) === JSON.stringify(input),
    'AC-2: a legal tag-filtered stream filter passes through unchanged, composed with — never replacing — kinds/limit.');
});

test('B2: sanitizeStreamFilter drops every key the deployed router parser would crash-loop on — bogusfield, #zz, #1, bare letters, non-integer kinds entries, non-string tag values (AC-2; ADR evidence tests 4–6)', () => {
  const be = loadBackend();
  assert(be && typeof be.sanitizeStreamFilter === 'function', NOT_IMPL('sanitizeStreamFilter must be exported'));
  const out = be.sanitizeStreamFilter({
    kinds: [39999, 'notanumber', 2.5, null],
    bogusfield: ['x'],
    '#zz': ['x'],
    '#1': ['x'],
    z: ['x'],
    '#z': ['ok', '', 42, null],
    '#y': [],
    '#x': 'not-an-array',
  });
  eq(out, { kinds: [39999], '#z': ['ok'] },
    'AC-2 guard: one bad POSTed key must never reach the persisted config — unknown keys, multi-char tag keys, non-integer kinds and non-string/empty tag values are all dropped.');
});

test('B3: sanitizeStreamFilter round-trips the full legal router vocabulary — hand-edited ids/authors/since/until survive an unrelated save, with per-key shape checks (AC-2, AC-4 for hand-edited streams)', () => {
  const be = loadBackend();
  assert(be && typeof be.sanitizeStreamFilter === 'function', NOT_IMPL('sanitizeStreamFilter must be exported'));
  const legal = { ids: [EVENT_ID], authors: [HEX_PK], kinds: [1], since: 100, until: 200, limit: 5, '#t': ['x'] };
  assert(JSON.stringify(be.sanitizeStreamFilter(legal)) === JSON.stringify(legal),
    'the POST is a full replacement: saving any stream round-trips every stream — legal keys the UI does not edit must survive byte-for-byte.');
  const out = be.sanitizeStreamFilter({ ids: ['', 42], authors: 'nope', since: 'soon', until: 1.5, limit: 5 });
  eq(out, { limit: 5 },
    'shape checks: ids/authors keep only non-empty strings (key dropped when none survive); since/until/limit must be integers.');
});

test('B4: sanitizeStreamFilter preserves empty kinds [] (today\'s new-stream default) and maps non-object filters to undefined (AC-2 byte-compat; ADR evidence test 8)', () => {
  const be = loadBackend();
  assert(be && typeof be.sanitizeStreamFilter === 'function', NOT_IMPL('sanitizeStreamFilter must be exported'));
  eq(be.sanitizeStreamFilter({ kinds: [], limit: 5 }), { kinds: [], limit: 5 },
    'the parser accepts {"kinds":[],"limit":5} and today\'s UI emits it — it must be preserved, empty array included.');
  for (const notObj of [null, undefined, 'str', 42, [1]]) {
    assert(be.sanitizeStreamFilter(notObj) === undefined,
      `sanitizeStreamFilter(${JSON.stringify(notObj)}) must be undefined so the stream persists with no filter line.`);
  }
});

test('B5: streams saved without tag filters produce BYTE-IDENTICAL generateConfig output after sanitization (AC-2 regression guard)', () => {
  const be = loadBackend();
  assert(be && typeof be.sanitizeStreamFilter === 'function', NOT_IMPL('sanitizeStreamFilter must be exported'));
  const streams = [
    { name: 'userProfiles', dir: 'down', filter: { kinds: [0], limit: 5 }, urls: ['wss://profiles.nostr1.com'], pluginDown: '', pluginUp: '', enabled: true },
    { name: 'dcosl', dir: 'both', filter: { kinds: [9998, 9999, 39998, 39999], limit: 5 }, urls: ['wss://dcosl.brainstorm.world', 'wss://dcosl.brainstorm.social/relay'], pluginDown: '/usr/local/lib/strfry/plugins/example.js', pluginUp: '', enabled: true },
    { name: 'fresh', dir: 'both', filter: { kinds: [], limit: 5 }, urls: ['wss://relay.example'], enabled: true },
  ];
  const before = be.generateConfig(streams);
  const after = be.generateConfig(streams.map(s => ({ ...s, filter: be.sanitizeStreamFilter(s.filter) })));
  assert(after === before,
    `AC-2: kinds/limit-only streams must produce exactly the config they produce today.\n      before: ${JSON.stringify(before)}\n      after:  ${JSON.stringify(after)}`);
});

test('B6: a sanitized tag-filtered stream lands in the deployed config text as inline JSON with "#z" next to kinds — scoped to that stream alone, the sibling stream\'s block byte-identical (AC-2)', () => {
  const be = loadBackend();
  assert(be && typeof be.sanitizeStreamFilter === 'function', NOT_IMPL('sanitizeStreamFilter must be exported'));
  const plain = { name: 'plain', dir: 'down', filter: { kinds: [0] }, urls: ['wss://a.example'], enabled: true };
  const tagged = {
    name: 'tagged', dir: 'both',
    filter: be.sanitizeStreamFilter({ kinds: [39999], '#z': [HANDLE_A, HANDLE_B], limit: 5 }),
    urls: ['wss://b.example'], enabled: true,
  };
  const cfg = be.generateConfig([plain, tagged]);
  const wantLine = `filter = {"kinds":[39999],"#z":${JSON.stringify([HANDLE_A, HANDLE_B])},"limit":5}`;
  assert(cfg.includes(wantLine),
    `AC-2: the tagged stream's config line must carry the #z entry composed with kinds/limit in insertion order.\n      wanted line: ${wantLine}\n      config: ${JSON.stringify(cfg)}`);
  const soloPlain = streamBlock(be.generateConfig([plain]), 'plain');
  const pairedPlain = streamBlock(cfg, 'plain');
  assert(soloPlain && pairedPlain && soloPlain === pairedPlain,
    'AC-2: every other stream\'s filter is unchanged — the plain stream\'s emitted block must be byte-identical whether or not a sibling carries tag filters.');
});

test('B7: the OPEN.md #25 dcosl tags-federation stream is expressible through the editor helpers alone — kinds-only preset filter + a #z row → sanitize → config text {"kinds":[39999],…,"#z":[handles]} (AC-5)', async () => {
  const mod = await loadEsm(VALIDATION);
  assert(mod && typeof mod.applyTagFilters === 'function',
    NOT_IMPL('applyTagFilters (the editor write-back) must be exported from tagFilterValidation.js'));
  const be = loadBackend();
  assert(be && typeof be.sanitizeStreamFilter === 'function', NOT_IMPL('sanitizeStreamFilter must be exported'));
  const presetFilter = { kinds: [39999], limit: 5 }; // a kinds-only starting point, exactly as presets ship
  const edited = mod.applyTagFilters(presetFilter, [{ letter: 'z', values: [HANDLE_A, HANDLE_B] }]);
  const stream = { name: 'dcoslTags', dir: 'both', filter: be.sanitizeStreamFilter(edited), urls: ['wss://dcosl.brainstorm.world'], enabled: true };
  const cfg = be.generateConfig([stream]);
  const wantLine = `filter = {"kinds":[39999],"limit":5,"#z":${JSON.stringify([HANDLE_A, HANDLE_B])}}`;
  assert(cfg.includes(wantLine),
    `AC-5: the motivating stream must reach the deployed config from UI-shaped inputs, no container shell.\n      wanted line: ${wantLine}\n      config: ${JSON.stringify(cfg)}`);
});

test('B8: sanitizeStreamFilter is idempotent and pure — re-saving already-persisted state never alters a stream\'s filter, so tag filters are durable across save → restart cycles (AC-3)', () => {
  const be = loadBackend();
  assert(be && typeof be.sanitizeStreamFilter === 'function', NOT_IMPL('sanitizeStreamFilter must be exported'));
  const mixed = { kinds: [39999], limit: 5, '#z': [HANDLE_A], authors: [HEX_PK] };
  const frozen = JSON.stringify(mixed);
  const once = be.sanitizeStreamFilter(mixed);
  const twice = be.sanitizeStreamFilter(once);
  assert(JSON.stringify(twice) === JSON.stringify(once),
    'AC-3: sanitize(sanitize(f)) must equal sanitize(f) — durable config, not session state.');
  assert(JSON.stringify(mixed) === frozen, 'sanitizeStreamFilter must not mutate its input.');
});

// ===========================================================================
// S: source level (no JSX transpile in this harness) — the editor/card/API
// wiring the ADR pins
// ===========================================================================

test('S1: StreamEditor renders the reused TagFilterEditor driven by form.filter through the two helpers — no parallel tag state (AC-1 parity by construction, AC-4 seed)', () => {
  const src = safeRead(RELAY_SETTINGS);
  assert(src.length > 0, 'ui/src/pages/settings/RelaySettings.jsx missing — unexpected.');
  const editor = sliceSection(src, 'function StreamEditor(', ['\nfunction ToggleSwitch', '/* ── Toggle Switch']);
  assert(editor.length > 0, 'StreamEditor must exist in RelaySettings.jsx — unexpected regression.');
  assert(/<TagFilterEditor[\s\S]*?\/>/.test(editor),
    NOT_IMPL('StreamEditor must render <TagFilterEditor …/> (the story-#1 component, reused not forked)'));
  assert(/tagFiltersFromFilter\s*\(/.test(editor),
    NOT_IMPL('the editor\'s rows must be derived from form.filter via tagFiltersFromFilter each render'));
  assert(/applyTagFilters\s*\(/.test(editor),
    NOT_IMPL('the editor\'s onChange must write rows back into form.filter via applyTagFilters'));
  assert(!/setTagFilters/.test(editor),
    'form.filter is the single source of truth — StreamEditor must not hold a parallel tagFilters state hook (ADR §Implementation 2).');
});

test('S2: RelaySettings imports tagFiltersFromFilter and applyTagFilters from the shared validation module — extended, never forked (AC-1)', () => {
  const src = safeRead(RELAY_SETTINGS);
  const m = src.match(/import\s*\{([\s\S]*?)\}\s*from\s*['"][./]*\.\.\/\.\.\/utils\/tagFilterValidation(\.js)?['"]/);
  assert(m, 'RelaySettings.jsx must import from ../../utils/tagFilterValidation — unexpected regression.');
  for (const name of ['tagFiltersFromFilter', 'applyTagFilters']) {
    assert(m[1].includes(name),
      NOT_IMPL(`RelaySettings.jsx must import ${name} from the shared tagFilterValidation module`));
  }
});

test('S3: the Tag Filters field block sits inside the stream editor between Event Kinds and Limit (AC-1; ADR placement)', () => {
  const src = safeRead(RELAY_SETTINGS);
  const editor = sliceSection(src, 'function StreamEditor(', ['\nfunction ToggleSwitch', '/* ── Toggle Switch']);
  assert(editor.length > 0, 'StreamEditor must exist — unexpected regression.');
  const kindsIdx = editor.indexOf('Event Kinds');
  const tagIdx = editor.indexOf('Tag Filters');
  const limitIdx = editor.indexOf('>Limit<');
  assert(kindsIdx !== -1 && limitIdx !== -1, 'Event Kinds / Limit blocks vanished from StreamEditor — unexpected regression.');
  assert(tagIdx !== -1, NOT_IMPL('StreamEditor must render a \'Tag Filters\' field block'));
  assert(kindsIdx < tagIdx && tagIdx < limitIdx,
    'The Tag Filters block must sit between Event Kinds and Limit (ADR §Implementation 2).');
});

test('S4: the stream read card displays saved tag filters (letter + values via tagFiltersFromFilter), so filters saved earlier are visible without opening the editor (AC-4 visibility)', () => {
  const src = safeRead(RELAY_SETTINGS);
  const card = sliceSection(src, 'function RouterStatus(', ['/* ── Negentropy Sync Panel', '\nfunction NegentropySync']);
  assert(card.length > 0, 'RouterStatus must exist — unexpected regression.');
  assert(/tagFiltersFromFilter\s*\(/.test(card),
    NOT_IMPL('the stream card must derive saved tag filters from stream.filter via tagFiltersFromFilter (shared module, not an inline fork) and render them on the Filter line'));
});

test('S5: the server reconstructs stream filters at the client-JSON ingress only — handleUpdateRouterConfig sanitizes before persisting; toggle/restore-defaults/init leave server-local state untouched (AC-2, AC-3)', () => {
  const src = safeRead(ROUTER_CONFIG);
  assert(src.length > 0, 'src/api/strfry/routerConfig.js missing — unexpected.');
  const updateBody = sliceSection(src, 'async function handleUpdateRouterConfig', ['\n/**', '\nmodule.exports']);
  assert(updateBody.length > 0, 'handleUpdateRouterConfig must exist — unexpected regression.');
  assert(callsSanitize(updateBody),
    NOT_IMPL('handleUpdateRouterConfig must rebuild each stream\'s filter via sanitizeStreamFilter before saveState/applyConfig — client JSON must never pass through opaquely'));
  for (const fn of ['async function handleToggleStream', 'async function handleRestoreDefaults', 'async function initRouter', 'function ensureState']) {
    const body = sliceSection(src, fn, ['\n/**', '\nmodule.exports', '\n// ──']);
    assert(body.length > 0, `${fn} must exist — unexpected regression.`);
    assert(!callsSanitize(body),
      `${fn.replace(/^.*function /, '')} consumes server-local inputs and must NOT rewrite an operator's hand-edited state (ADR sub-decision: sanitize only at the client-JSON ingress).`);
  }
});

// ===========================================================================
// R: regression sentinels — PASS before AND after (additive change)
// ===========================================================================

test('R1: routerConfig.js keeps its existing exports and the existing save/apply → supervisorctl-restart mechanics — no new steps or restart behavior (AC-3)', () => {
  const be = loadBackend();
  assert(be, 'src/api/strfry/routerConfig.js must load.');
  for (const name of ['generateConfig', 'handleUpdateRouterConfig', 'handleToggleStream', 'handleGetPresets', 'handleListPlugins', 'handleRestartRouter', 'handleRestoreDefaults', 'initRouter']) {
    assert(typeof be[name] === 'function', `routerConfig.js must keep exporting ${name} — AC-3 rides the existing flow.`);
  }
  const src = safeRead(ROUTER_CONFIG);
  assert(src.includes('supervisorctl restart strfry-router'),
    'applyConfig must still restart the router via supervisorctl — the panel\'s existing restart mechanics are the contract tag filters ride on.');
});

test('R2: generateConfig still emits today\'s exact text for a kinds/limit-only stream — the frozen baseline AC-2\'s byte-identity guard measures against', () => {
  const be = loadBackend();
  assert(be && typeof be.generateConfig === 'function', 'generateConfig must remain exported.');
  const stream = { name: 'userProfiles', dir: 'down', filter: { kinds: [0], limit: 5 }, urls: ['wss://profiles.nostr1.com'], pluginDown: '', pluginUp: '', enabled: true };
  const expected = [
    'connectionTimeout = 20',
    '',
    'streams {',
    '',
    '    userProfiles {',
    '        dir = "down"',
    '',
    '        filter = {"kinds":[0],"limit":5}',
    '',
    '        urls = [',
    '            "wss://profiles.nostr1.com",',
    '        ]',
    '    }',
    '}',
    '',
  ].join('\n');
  const actual = be.generateConfig([stream]);
  assert(actual === expected,
    `generateConfig's emitted shape changed — AC-2's "exactly the config they produce today" baseline moved.\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`);
});

test('R3: story-#1\'s surface and the presets stay untouched — TagFilterEditor + the sync panel\'s state remain, and every preset is still a kinds-only starting point (AC-5 guardrails)', () => {
  const src = safeRead(RELAY_SETTINGS);
  assert(/function\s+TagFilterEditor\s*\(/.test(src),
    'TagFilterEditor (story #1) must remain declared module-scope in RelaySettings.jsx.');
  assert(/\[\s*tagFilters\s*,\s*setTagFilters\s*\]\s*=\s*useState\(/.test(src),
    'the Negentropy Sync panel must keep its own tagFilters state — story #1\'s closed book is untouched.');
  const presets = JSON.parse(safeRead(PRESETS) || '[]');
  assert(Array.isArray(presets) && presets.length > 0, 'setup/router-presets.json must exist and parse.');
  for (const p of presets) {
    const tagKeys = Object.keys(p.filter || {}).filter(k => k.startsWith('#'));
    eq(tagKeys, [],
      `preset "${p.name}" must remain a kinds-only starting point — no tags-federation preset ships (story settled decision 2).`);
  }
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
    catch (err) { console.log(`  ✗ ${t.name}`); console.log(`      ${err.message}`); fail++; }
  }
  return { pass, fail };
}

module.exports = { run };
