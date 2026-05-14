/**
 * Bug regression: strfry-router FATAL on first boot.
 *
 * `/etc/strfry-router-tapestry.config` is not on a persistent volume, so it must
 * be (re-)created by docker/entrypoint.sh on every container start. supervisord
 * starts strfry-router (priority 25) before brainstorm (priority 30), which is
 * where initRouter() in src/api/strfry/routerConfig.js writes the real config —
 * so without a guaranteed seed file the router crash-loops until supervisord
 * marks it FATAL.
 *
 * These tests pin the guarantee:
 *   1. entrypoint.sh has an unconditional fallback that creates the file when
 *      it's missing, regardless of whether the bundled template or the
 *      persistent router-state.json exist.
 *   2. The seeded content is a syntactically minimal strfry router config —
 *      a `streams { }` block with no enabled streams, so the daemon starts
 *      idle. initRouter() will overwrite it once the app boots.
 *   3. generateConfig([]) emits the same minimal shape, so both seed paths
 *      (entrypoint fallback, app-managed config) produce strfry-parseable
 *      output that won't trip the daemon.
 */

const fs = require('fs');
const path = require('path');

const ENTRYPOINT_PATH = path.resolve(__dirname, '../docker/entrypoint.sh');

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

test('docker/entrypoint.sh has an unconditional fallback that seeds /etc/strfry-router-tapestry.config when missing', () => {
  const src = fs.readFileSync(ENTRYPOINT_PATH, 'utf8');

  // The guard must check for absence of the actual /etc/ path (not the template under
  // ${BRAINSTORM_MODULE_BASE_DIR}), and the body must write to /etc/strfry-router-tapestry.config.
  const guardRe = /if\s+\[\s+!\s+-f\s+\/etc\/strfry-router-tapestry\.config\s+\]\s*;\s*then[\s\S]*?\/etc\/strfry-router-tapestry\.config/;
  assert(
    guardRe.test(src),
    'entrypoint.sh must contain `if [ ! -f /etc/strfry-router-tapestry.config ]; then ...` that writes to /etc/strfry-router-tapestry.config'
  );
});

test('docker/entrypoint.sh fallback heredoc is a minimal valid strfry router config (empty streams block)', () => {
  const src = fs.readFileSync(ENTRYPOINT_PATH, 'utf8');

  // Match the heredoc that follows the guard. The marker name is local to entrypoint.sh.
  const heredocRe = /if\s+\[\s+!\s+-f\s+\/etc\/strfry-router-tapestry\.config\s+\][\s\S]*?<<\s*'([A-Z_]+)'\s*\n([\s\S]*?)\n\1/;
  const m = src.match(heredocRe);
  assert(m, 'entrypoint.sh fallback must use a heredoc to write the seed config body');

  const body = m[2];

  // Must include connectionTimeout and an opening streams block.
  assert(/^connectionTimeout\s*=\s*\d+/m.test(body), 'seed config must set connectionTimeout');
  assert(/\bstreams\s*\{/.test(body), 'seed config must open a `streams {` block');

  // The streams block must be empty (no stream entries). Capture between `streams {` and the matching `}`.
  const streamsRe = /streams\s*\{([\s\S]*?)\}/;
  const sm = body.match(streamsRe);
  assert(sm, 'seed config must contain a closed `streams { ... }` block');
  assert(
    sm[1].trim() === '',
    `seed config's streams block must be empty so the daemon starts idle; got non-whitespace content: ${JSON.stringify(sm[1])}`
  );
});

test('generateConfig([]) emits the same minimal shape that the entrypoint seeds (empty streams block, with connectionTimeout)', () => {
  const { generateConfig } = require('../src/api/strfry/routerConfig');
  const cfg = generateConfig([]);

  assert(/^connectionTimeout\s*=\s*\d+/m.test(cfg), 'generateConfig must emit connectionTimeout');

  const sm = cfg.match(/streams\s*\{([\s\S]*?)\}/);
  assert(sm, 'generateConfig output must contain a closed `streams { ... }` block');
  assert(
    sm[1].trim() === '',
    `generateConfig([]) must emit an empty streams block; got: ${JSON.stringify(sm[1])}`
  );
});

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
