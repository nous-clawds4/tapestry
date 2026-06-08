/**
 * Failing tests for story #2: treasureMaps router preset + 10040 to Negentropy Sync.
 * See engineering-team/stories/search-and-router/2-treasure-maps-router-preset.test-plan.md
 *
 * Each test maps to one or more acceptance criteria. Tests are designed to fail
 * on the pre-implementation tree and pass once the Implementer lands the changes
 * described in ADR 0002 (Option D).
 */

const fs = require('fs');
const path = require('path');

const PRESETS_PATH = path.resolve(__dirname, '../setup/router-presets.json');
const RELAY_SETTINGS_PATH = path.resolve(__dirname, '../ui/src/pages/settings/RelaySettings.jsx');
const BIBLE_PATH = path.resolve(__dirname, '../BIBLE.md');
const CONFIG_DOC_PATH = path.resolve(__dirname, '../docs/CONFIGURATION.md');

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

// ── AC-1, AC-2, AC-4 ─────────────────────────────────────────
test('treasureMaps preset exists in setup/router-presets.json with correct shape', () => {
  const presets = JSON.parse(fs.readFileSync(PRESETS_PATH, 'utf8'));
  const tm = presets.find(p => p.name === 'treasureMaps');
  assert(tm, 'treasureMaps preset not found in setup/router-presets.json');

  assert(tm.dir === 'both', `expected dir="both", got "${tm.dir}"`);
  assert(tm.filter && Array.isArray(tm.filter.kinds), 'filter.kinds must be an array');
  assert(
    tm.filter.kinds.length === 1 && tm.filter.kinds[0] === 10040,
    `expected filter.kinds=[10040], got ${JSON.stringify(tm.filter.kinds)}`
  );
  assert(tm.defaultEnabled === false, `expected defaultEnabled=false, got ${tm.defaultEnabled}`);

  const expectedUrls = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];
  assert(Array.isArray(tm.urls), 'urls must be an array');
  assert(tm.urls.length === expectedUrls.length, `expected ${expectedUrls.length} urls, got ${tm.urls.length}`);
  for (const url of expectedUrls) {
    assert(tm.urls.includes(url), `expected urls to include ${url}; got ${JSON.stringify(tm.urls)}`);
  }
});

// ── AC-3 ─────────────────────────────────────────────────────
test('generateConfig with treasureMaps enabled emits a bidirectional kind-10040 stream block', () => {
  const routerConfig = require('../src/api/strfry/routerConfig');
  assert(
    typeof routerConfig.generateConfig === 'function',
    'generateConfig must be exported from src/api/strfry/routerConfig.js so this behavior is unit-testable'
  );

  const streams = [{
    name: 'treasureMaps',
    dir: 'both',
    filter: { kinds: [10040] },
    urls: ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'],
    enabled: true,
  }];
  const config = routerConfig.generateConfig(streams);

  assert(config.includes('treasureMaps {'), 'config must contain a treasureMaps stream block');
  assert(config.includes('dir = "both"'), 'config must specify dir = "both"');
  assert(config.includes('"kinds":[10040]'), 'config must include filter with kinds:[10040]');
  for (const url of streams[0].urls) {
    assert(config.includes(url), `config must include url ${url}`);
  }
});

// ── AC-5 ─────────────────────────────────────────────────────
test('generateConfig with treasureMaps disabled omits its stream block', () => {
  const { generateConfig } = require('../src/api/strfry/routerConfig');
  assert(typeof generateConfig === 'function', 'generateConfig must be exported');

  const streams = [{
    name: 'treasureMaps',
    dir: 'both',
    filter: { kinds: [10040] },
    urls: ['wss://relay.damus.io'],
    enabled: false,
  }];
  const config = generateConfig(streams);
  assert(!config.includes('treasureMaps {'), 'disabled preset must not appear in generated config');
});

// ── AC-7 ─────────────────────────────────────────────────────
test('RelaySettings.jsx KIND_PRESETS contains the Treasure Maps (10040) option', () => {
  const src = fs.readFileSync(RELAY_SETTINGS_PATH, 'utf8');
  const re = /label:\s*['"`]Treasure Maps \(10040\)['"`]\s*,\s*kinds:\s*\[\s*10040\s*\]/;
  assert(
    re.test(src),
    'RelaySettings.jsx KIND_PRESETS must include { label: "Treasure Maps (10040)", kinds: [10040] }'
  );
});

// ── AC-8 ─────────────────────────────────────────────────────
test('BIBLE.md or docs/CONFIGURATION.md documents the router preset system and the planned Negentropy preset system', () => {
  const bible = fs.existsSync(BIBLE_PATH) ? fs.readFileSync(BIBLE_PATH, 'utf8') : '';
  const config = fs.existsSync(CONFIG_DOC_PATH) ? fs.readFileSync(CONFIG_DOC_PATH, 'utf8') : '';
  const combined = bible + '\n' + config;

  assert(/router preset/i.test(combined), 'docs must contain a router preset section');
  assert(
    /negentropy preset/i.test(combined),
    'docs must contain a forward-looking note about the planned Negentropy preset system'
  );
});

// ── Runner ───────────────────────────────────────────────────
async function run() {
  let pass = 0;
  let fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
      pass++;
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
      fail++;
    }
  }
  return { pass, fail };
}

module.exports = { run };
