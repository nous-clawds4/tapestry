/**
 * Story #16 / ADR 0014 — Entrypoint reads `/etc/brainstorm.conf` from
 * `config/brainstorm.conf.template` via a Node-based renderer; the heredoc
 * is eliminated; a sibling `/etc/brainstorm-task-queue.json` is installed
 * from a new template using the existing copy-if-absent pattern.
 *
 * Source/structural sentinels pin the template-as-source-of-truth contract
 * and the byte-equivalence guarantee between the new and old rendering of
 * `/etc/brainstorm.conf`. The behavioral round-trip — booting a fresh
 * container with no pre-existing /etc/brainstorm.conf, observing the
 * `[entrypoint] /etc/brainstorm.conf generated from ...template` line, and
 * confirming the rendered file is byte-equivalent to today's heredoc output
 * — is reproducible only against the live Docker stack and is the
 * authoritative cycle-local smoke (Reviewer-required).
 *
 * T1..T8 : FAIL pre-implementation, PASS post.
 * R1..R3 : PASS pre AND post — regression guards on the other-conf-files
 *          copy-if-absent loop, story #13's TASK_QUEUE_ENABLED contract,
 *          and the 664-mode chmod on /etc/brainstorm.conf.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const RENDERER            = path.join(ROOT, 'tools/render-conf-template.js');
const CONF_TEMPLATE       = path.join(ROOT, 'config/brainstorm.conf.template');
const TASK_QUEUE_TEMPLATE = path.join(ROOT, 'config/brainstorm-task-queue.json.template');
const ENTRYPOINT_SH       = path.join(ROOT, 'docker/entrypoint.sh');
const OPERATIONS_MD       = path.join(ROOT, 'OPERATIONS.md');

// 41 variables the current `docker/entrypoint.sh` heredoc writes to
// `/etc/brainstorm.conf` (extracted authoritatively from lines 40-122 at
// story #16 / ADR 0014 time). This list is the source of truth for what
// the backfilled template MUST contain — frozen here so the test survives
// Step 2's removal of the heredoc from entrypoint.sh.
const HEREDOC_VARIABLES = [
  'BRAINSTORM_30382_LIMIT',
  'BRAINSTORM_ACCESS',
  'BRAINSTORM_ADMIN_PUBKEYS',
  'BRAINSTORM_BASE_DIR',
  'BRAINSTORM_BATCH_SIZE',
  'BRAINSTORM_CREATED_CONSTRAINTS_AND_INDEXES',
  'BRAINSTORM_DEFAULT_NIP85_HOME_RELAY',
  'BRAINSTORM_DEFAULT_NIP85_RELAYS',
  'BRAINSTORM_DEFAULT_POPULAR_GENERAL_PURPOSE_RELAYS',
  'BRAINSTORM_DEFAULT_WOT_RELAYS',
  'BRAINSTORM_DELAY_BETWEEN_BATCHES',
  'BRAINSTORM_DELAY_BETWEEN_EVENTS',
  'BRAINSTORM_EXPORT_DIR',
  'BRAINSTORM_LOG_DIR',
  'BRAINSTORM_MANAGER_PUBKEYS',
  'BRAINSTORM_MAX_CONCURRENT_CONNECTIONS',
  'BRAINSTORM_MAX_RETRIES',
  'BRAINSTORM_MODULE_ALGOS_DIR',
  'BRAINSTORM_MODULE_BASE_DIR',
  'BRAINSTORM_MODULE_MANAGE_DIR',
  'BRAINSTORM_MODULE_PIPELINE_DIR',
  'BRAINSTORM_MODULE_SRC_DIR',
  'BRAINSTORM_NEO4J_BROWSER_URL',
  'BRAINSTORM_NIP85_DIR',
  'BRAINSTORM_NIP85_HOME_RELAY',
  'BRAINSTORM_NIP85_RELAYS',
  'BRAINSTORM_NODE_BIN',
  'BRAINSTORM_OWNER_NPUB',
  'BRAINSTORM_OWNER_PUBKEY',
  'BRAINSTORM_POPULAR_GENERAL_PURPOSE_RELAYS',
  'BRAINSTORM_PROCESS_ALL_TASKS_INTERVAL',
  'BRAINSTORM_RELAY_URL',
  'BRAINSTORM_SEND_EMAIL_UPDATES',
  'BRAINSTORM_WOT_RELAYS',
  'NEO4J_PASSWORD',
  'NEO4J_URI',
  'NEO4J_USER',
  'SESSION_SECRET',
  'STRFRY_DOMAIN',
  'STRFRY_PLUGINS_BASE',
  'STRFRY_PLUGINS_DATA'
];

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch (_e) { return null; }
}

function readJsonSafe(p) {
  const s = readSafe(p);
  if (s === null) return null;
  try { return JSON.parse(s); }
  catch (_e) { return null; }
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

// ---------------------------------------------------------------------------
// Failing tests — FAIL now, PASS once story #16 is implemented per ADR 0014.
// ---------------------------------------------------------------------------

test('T1: tools/render-conf-template.js exists, is parseable Node, performs ${VAR_NAME} substitution against process.env (ADR 0014 §Implementation Step 2)', () => {
  const src = readSafe(RENDERER);
  assert(
    src !== null,
    'Renderer does not exist at tools/render-conf-template.js (ADR 0014 §Implementation Step 2). Create ' +
      'the small Node script that performs ${VAR_NAME} regex substitution against process.env and writes ' +
      'the rendered output to stdout. The ADR pins the implementation; copy it verbatim.'
  );
  // Pin the substitution mechanism — the ADR chose plain regex against process.env precisely to avoid
  // shell-eval injection class. A future "let's just shell out" refactor would re-open that class.
  assert(
    /process\.env/.test(src),
    'Renderer does not consult process.env (ADR 0014 §Variable-substitution semantics). Substitution ' +
      'source must be process.env so the entrypoint passes config in via its already-prepared env state — ' +
      'not via argv, not via a separate config file, not via a shell-eval.'
  );
  assert(
    /\$\\\{|\$\{|\\\$\\\{/.test(src) || /VAR_REF/.test(src),
    'Renderer does not appear to match the ${VAR_NAME} pattern (ADR 0014 §Variable-substitution ' +
      'semantics). The canonical regex from the ADR is /\\$\\{([A-Z_][A-Z0-9_]*)\\}/g — replace via ' +
      'process.env, error on missing var, leave everything else as literal text.'
  );
  // Parseability check — must be syntactically valid JS or it can't run at boot time.
  try {
    // node --check parses but does not execute. Faster than spawning a render and safer than require().
    const probe = spawnSync('node', ['--check', RENDERER], { encoding: 'utf8' });
    assert(
      probe.status === 0,
      'tools/render-conf-template.js fails `node --check` parse (ADR 0014 §Implementation Step 2). ' +
        'stderr: ' + (probe.stderr || '<empty>') + '. A syntax error here means the entrypoint ' +
        'crashes at container boot — boot-time failures are the worst kind for an operator to debug.'
    );
  } catch (e) {
    assert(false, 'Could not invoke `node --check` on the renderer: ' + e.message);
  }
});

test('T2: config/brainstorm.conf.template contains every variable the heredoc writes (Step 1 byte-equivalence; ADR 0014 §Implementation Step 1)', () => {
  const src = readSafe(CONF_TEMPLATE);
  assert(
    src !== null,
    'config/brainstorm.conf.template does not exist (ADR 0014 §Implementation Step 1). Cannot be the ' +
      'source of truth if it isn\'t present.'
  );
  const missing = HEREDOC_VARIABLES.filter(v => !new RegExp('\\b' + v + '\\b').test(src));
  assert(
    missing.length === 0,
    'brainstorm.conf.template is missing ' + missing.length + ' of ' + HEREDOC_VARIABLES.length +
      ' variables the docker/entrypoint.sh heredoc currently writes:\n  ' + missing.join('\n  ') +
      '\n(ADR 0014 §Implementation Step 1). Step 1 backfills the template so byte-equivalence holds ' +
      'before Step 2 removes the heredoc. Without this, fresh Docker containers built from the template ' +
      'lose ~25 variables — control panel boot, owner auth, sessions, plugin loading, and filesystem ' +
      'paths all break. The byte-equivalence AC is the safety net; this sentinel is the proof.'
  );
});

test('T3: template replaces literal placeholder values with ${VAR} references for env-var-dependent variables (Step 1 byte-equivalence; ADR 0014 §Implementation Step 1)', () => {
  const src = readSafe(CONF_TEMPLATE);
  assert(src !== null, 'brainstorm.conf.template missing — T2 must pass first.');
  // The ADR explicitly calls out these substitutions. If the template still carries literal placeholder
  // values (STRFRY_DOMAIN="your.relay.com", NEO4J_PASSWORD="neo4j"), byte-equivalence fails — the
  // heredoc writes the env's actual value, not the placeholder string.
  const expected = [
    {
      pattern: /STRFRY_DOMAIN="\$\{DOMAIN_NAME\}"/,
      label: 'STRFRY_DOMAIN="${DOMAIN_NAME}" (currently the placeholder "your.relay.com")'
    },
    {
      pattern: /BRAINSTORM_RELAY_URL="\$\{RELAY_URL\}"/,
      label: 'BRAINSTORM_RELAY_URL="${RELAY_URL}" (currently the placeholder "wss://your.relay.com")'
    },
    {
      pattern: /NEO4J_PASSWORD="\$\{NEO4J_PASSWORD\}"/,
      label: 'NEO4J_PASSWORD="${NEO4J_PASSWORD}" (currently the placeholder "neo4j")'
    },
    {
      pattern: /BRAINSTORM_OWNER_PUBKEY="\$\{OWNER_PUBKEY\}"/,
      label: 'BRAINSTORM_OWNER_PUBKEY="${OWNER_PUBKEY}" (sourced from entrypoint env)'
    },
    {
      pattern: /BRAINSTORM_OWNER_NPUB="\$\{OWNER_NPUB\}"/,
      label: 'BRAINSTORM_OWNER_NPUB="${OWNER_NPUB}" (computed in entrypoint before rendering)'
    },
    {
      pattern: /BRAINSTORM_ADMIN_PUBKEYS="\$\{ADMIN_PUBKEYS\}"/,
      label: 'BRAINSTORM_ADMIN_PUBKEYS="${ADMIN_PUBKEYS}" (sourced from entrypoint env)'
    },
    {
      pattern: /SESSION_SECRET="\$\{SESSION_SECRET\}"/,
      label: 'SESSION_SECRET="${SESSION_SECRET}" (sourced from persisted file or generated)'
    },
    {
      pattern: /BRAINSTORM_NODE_BIN="\$\{BRAINSTORM_NODE_BIN\}"/,
      label: 'BRAINSTORM_NODE_BIN="${BRAINSTORM_NODE_BIN}" (sourced from `which node` in entrypoint)'
    }
  ];
  const missingPatterns = expected.filter(e => !e.pattern.test(src)).map(e => e.label);
  assert(
    missingPatterns.length === 0,
    'brainstorm.conf.template is missing required ${VAR} substitutions:\n  ' +
      missingPatterns.join('\n  ') + '\n(ADR 0014 §Implementation Step 1). The template currently carries ' +
      'literal placeholder values that need to become ${VAR} references so the Node renderer substitutes ' +
      'them at boot. Without this, byte-equivalence fails because the heredoc writes the actual env ' +
      'value, not the placeholder string.'
  );
});

test('T4: rendering the template via render-conf-template.js with a fixture env produces the expected VAR=VALUE pairs (Step 1 byte-equivalence; ADR 0014 §Byte-equivalence verification)', () => {
  assert(readSafe(RENDERER) !== null, 'renderer missing — T1 must pass first.');
  assert(readSafe(CONF_TEMPLATE) !== null, 'template missing — T2 must pass first.');

  const fixtureEnv = {
    PATH: process.env.PATH || '/usr/bin:/bin',
    BRAINSTORM_MODULE_BASE_DIR: '/usr/local/lib/node_modules/brainstorm/',
    BRAINSTORM_NODE_BIN: '/usr/bin/node',
    DOMAIN_NAME: 'test.example.com',
    RELAY_URL: 'wss://test.example.com',
    NEO4J_PASSWORD: 'test-neo4j-pw',
    OWNER_PUBKEY: 'a'.repeat(64),
    OWNER_NPUB: 'npub1testnpub',
    ADMIN_PUBKEYS: 'admin1,admin2',
    SESSION_SECRET: 'test-session-secret-32-bytes-xxx'
  };

  const result = spawnSync('node', [RENDERER, CONF_TEMPLATE], { env: fixtureEnv, encoding: 'utf8' });
  assert(
    result.status === 0,
    'render-conf-template.js exited with status ' + result.status + ' (stderr: ' +
      (result.stderr || '<empty>') + ') under the fixture env (ADR 0014 §Byte-equivalence verification). ' +
      'The renderer must successfully render the backfilled template against the 9 fixture variables ' +
      '(BRAINSTORM_MODULE_BASE_DIR, BRAINSTORM_NODE_BIN, DOMAIN_NAME, RELAY_URL, NEO4J_PASSWORD, ' +
      'OWNER_PUBKEY, OWNER_NPUB, ADMIN_PUBKEYS, SESSION_SECRET). Common failure modes: (a) template ' +
      'references a ${VAR} the fixture does not set — fix by listing it above or removing it from the ' +
      'template; (b) renderer file missing or unparseable — T1 must pass first.'
  );

  const rendered = result.stdout;

  // Extract VAR=VALUE pairs from rendered output. Lines look like:
  //   VAR="value"  |  VAR=value  |  export VAR="value"  |  export VAR='value'
  const pairs = {};
  const RE = /^[ \t]*(?:export[ \t]+)?([A-Z_][A-Z0-9_]*)[ \t]*=[ \t]*("[^"]*"|'[^']*'|[^\n]*?)[ \t]*$/gm;
  let m;
  while ((m = RE.exec(rendered)) !== null) {
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    pairs[m[1]] = val;
  }

  // Expected (var, value) pairs the OLD heredoc produces under the same fixtureEnv. The Implementer's
  // job is to make the template render this same set. Failure here is byte-equivalence violation.
  const expected = {
    BRAINSTORM_NODE_BIN: '/usr/bin/node',
    BRAINSTORM_MODULE_BASE_DIR: '/usr/local/lib/node_modules/brainstorm/',
    BRAINSTORM_MODULE_SRC_DIR: '/usr/local/lib/node_modules/brainstorm/src/',
    BRAINSTORM_MODULE_ALGOS_DIR: '/usr/local/lib/node_modules/brainstorm/src/algos',
    BRAINSTORM_EXPORT_DIR: '/usr/local/lib/node_modules/brainstorm/src/export',
    BRAINSTORM_MODULE_MANAGE_DIR: '/usr/local/lib/node_modules/brainstorm/src/manage',
    BRAINSTORM_NIP85_DIR: '/usr/local/lib/node_modules/brainstorm/src/algos/nip85',
    BRAINSTORM_MODULE_PIPELINE_DIR: '/usr/local/lib/node_modules/brainstorm/src/pipeline',
    STRFRY_PLUGINS_BASE: '/usr/local/lib/strfry/plugins/',
    STRFRY_PLUGINS_DATA: '/usr/local/lib/strfry/plugins/data/',
    BRAINSTORM_LOG_DIR: '/var/log/brainstorm',
    BRAINSTORM_BASE_DIR: '/var/lib/brainstorm',
    BRAINSTORM_30382_LIMIT: '250000',
    BRAINSTORM_BATCH_SIZE: '100',
    BRAINSTORM_DELAY_BETWEEN_BATCHES: '1000',
    BRAINSTORM_DELAY_BETWEEN_EVENTS: '50',
    BRAINSTORM_MAX_RETRIES: '3',
    BRAINSTORM_MAX_CONCURRENT_CONNECTIONS: '5',
    BRAINSTORM_RELAY_URL: 'wss://test.example.com',
    BRAINSTORM_NEO4J_BROWSER_URL: 'http://test.example.com:7474',
    NEO4J_URI: 'bolt://localhost:7687',
    NEO4J_USER: 'neo4j',
    NEO4J_PASSWORD: 'test-neo4j-pw',
    STRFRY_DOMAIN: 'test.example.com',
    BRAINSTORM_OWNER_PUBKEY: 'a'.repeat(64),
    BRAINSTORM_OWNER_NPUB: 'npub1testnpub',
    BRAINSTORM_MANAGER_PUBKEYS: '',
    BRAINSTORM_ADMIN_PUBKEYS: 'admin1,admin2',
    SESSION_SECRET: 'test-session-secret-32-bytes-xxx',
    BRAINSTORM_PROCESS_ALL_TASKS_INTERVAL: '12hours',
    BRAINSTORM_SEND_EMAIL_UPDATES: '0',
    BRAINSTORM_ACCESS: '0',
    BRAINSTORM_CREATED_CONSTRAINTS_AND_INDEXES: '0',
    // Story #13 addition that reached fresh containers via story #16. Default flipped from
    // 'false' to 'true' in story #17 / ADR 0015 — the queue + BullBoard + cross-task
    // neo4j-heavy serialization now come up automatically without an operator flip.
    TASK_QUEUE_ENABLED: 'true'
  };

  const mismatches = [];
  for (const [k, want] of Object.entries(expected)) {
    if (!(k in pairs)) {
      mismatches.push(k + ' is absent from rendered output');
    } else if (pairs[k] !== want) {
      mismatches.push(k + ' = ' + JSON.stringify(pairs[k]) + ' (expected ' + JSON.stringify(want) + ')');
    }
  }
  assert(
    mismatches.length === 0,
    'Rendered template diverges from heredoc output for ' + mismatches.length + ' variable(s):\n  ' +
      mismatches.join('\n  ') + '\n(ADR 0014 §Byte-equivalence verification). Each mismatch is a ' +
      'byte-equivalence break: under identical env state, the old entrypoint heredoc would have produced ' +
      'the "expected" value, and the new template+renderer path produced something else. Two common ' +
      'causes: (a) the template carries a literal placeholder value where the heredoc has ${VAR}; ' +
      '(b) composed substitutions like "${BRAINSTORM_MODULE_BASE_DIR}src/" need the inner ${} to ' +
      'substitute and then concatenate the trailing literal — make sure the template preserves the ' +
      'composition shape (e.g., BRAINSTORM_MODULE_SRC_DIR="${BRAINSTORM_MODULE_BASE_DIR}src/").'
  );
});

test('T5: config/brainstorm-task-queue.json.template exists, parses as JSON, has resourceClassCaps.neo4j-heavy=1 (AC; ADR 0014 §Implementation Step 2)', () => {
  const obj = readJsonSafe(TASK_QUEUE_TEMPLATE);
  assert(
    obj !== null,
    'config/brainstorm-task-queue.json.template is missing or not valid JSON (ADR 0014 §Implementation ' +
      'Step 2; AC "the template ships with deploy-safe defaults"). Create the file with: ' +
      '{"defaultConcurrency":1,"concurrencyByTask":{},"resourceClassCaps":{"neo4j-heavy":1}}. The ' +
      'entrypoint installs it to /etc/brainstorm-task-queue.json on fresh containers via the existing ' +
      'copy-if-absent pattern.'
  );
  assert(
    obj.resourceClassCaps && obj.resourceClassCaps['neo4j-heavy'] === 1,
    'brainstorm-task-queue.json.template does not pin resourceClassCaps[neo4j-heavy] === 1 (ADR 0014 ' +
      '§Implementation Step 2; AC quoted default). Story #15 default is 1 (one heavy task at a time) ' +
      '— the template default must match so fresh containers get story #15\'s protection. Found ' +
      'resourceClassCaps = ' + JSON.stringify(obj.resourceClassCaps || {}) + '.'
  );
  assert(
    obj.defaultConcurrency === 1,
    'brainstorm-task-queue.json.template does not pin defaultConcurrency = 1 (ADR 0014 §Implementation ' +
      'Step 2; AC quoted default). Story #13 default is 1 (phase-1 safe default). Found ' +
      'defaultConcurrency = ' + JSON.stringify(obj.defaultConcurrency) + '.'
  );
  assert(
    obj.concurrencyByTask && typeof obj.concurrencyByTask === 'object',
    'brainstorm-task-queue.json.template is missing concurrencyByTask: {} (ADR 0014 §Implementation ' +
      'Step 2; AC quoted default). Even when empty, the key must be present so queue/index.js\'s ' +
      'destructuring does not fall back to undefined.'
  );
});

test('T6: docker/entrypoint.sh invokes render-conf-template.js, installs brainstorm-task-queue.json from template, logs the rendering (AC; ADR 0014 §Implementation Step 2)', () => {
  const src = readSafe(ENTRYPOINT_SH);
  assert(src !== null, 'docker/entrypoint.sh missing — re-baseline this sentinel.');
  assert(
    /render-conf-template\.js/.test(src),
    'docker/entrypoint.sh does not reference render-conf-template.js (ADR 0014 §Implementation Step 2). ' +
      'The heredoc-to-renderer swap is the entire point of story #16 Step 2. Replace the `cat > ' +
      '/etc/brainstorm.conf << CONFEOF ... CONFEOF` block with `node ${BRAINSTORM_MODULE_BASE_DIR}' +
      '/tools/render-conf-template.js ${CONFIG_DIR}/brainstorm.conf.template > /etc/brainstorm.conf` ' +
      '— see the ADR for the exact replacement block.'
  );
  assert(
    /brainstorm-task-queue\.json\.template/.test(src),
    'docker/entrypoint.sh does not reference brainstorm-task-queue.json.template (ADR 0014 §Implementation ' +
      'Step 2; AC "extended to install /etc/brainstorm-task-queue.json"). Add a conditional install ' +
      'block after the existing for-loop that copies graperank/whitelist/blacklist/nip56 templates. ' +
      'Pattern: `if [ ! -f /etc/brainstorm-task-queue.json ] && [ -f ' +
      '"${CONFIG_DIR}/brainstorm-task-queue.json.template" ]; then cp ...; chmod 644 ...; echo ...; fi`.'
  );
  assert(
    /\/etc\/brainstorm-task-queue\.json\b/.test(src),
    'docker/entrypoint.sh does not write /etc/brainstorm-task-queue.json (ADR 0014 §Implementation Step ' +
      '2; AC quoted). The conditional install block must produce /etc/brainstorm-task-queue.json on ' +
      'first boot so the BullMQ queue config (story #13/#15) lands on fresh containers without operator ' +
      'ceremony.'
  );
  // AC: "The boot log makes the new behavior observable: a single line confirming '[entrypoint]
  // /etc/brainstorm.conf generated from config/brainstorm.conf.template'."
  assert(
    /\[entrypoint\][^\n]*brainstorm\.conf[^\n]*template/.test(src),
    'docker/entrypoint.sh does not emit the "[entrypoint] /etc/brainstorm.conf generated from ' +
      'config/brainstorm.conf.template" log line (AC §Boot log). Operators rely on this line to confirm ' +
      'the new code path actually ran (versus a stale image still using the heredoc). Add an `echo ' +
      '"[entrypoint] /etc/brainstorm.conf generated from config/brainstorm.conf.template"` immediately ' +
      'after the renderer invocation succeeds.'
  );
});

test('T7: docker/entrypoint.sh contains NO <<CONFEOF heredoc writing to /etc/brainstorm.conf (drift sentinel; ADR 0014 §Drift sentinel)', () => {
  const src = readSafe(ENTRYPOINT_SH);
  assert(src !== null, 'docker/entrypoint.sh missing — re-baseline this sentinel.');
  const heredocCount = (src.match(/<<\s*CONFEOF\b/g) || []).length;
  assert(
    heredocCount === 0,
    'docker/entrypoint.sh contains ' + heredocCount + ' <<CONFEOF heredoc(s) — drift sentinel tripped ' +
      '(ADR 0014 §Drift sentinel; AC "no longer contains a heredoc duplicating brainstorm.conf content"). ' +
      'Step 2 removes the heredoc; reintroducing one duplicates the source of truth and reopens the very ' +
      'drift class story #16 closes. Use render-conf-template.js to write /etc/brainstorm.conf, not a ' +
      'heredoc — even a "temporary one for a quick fix" causes silent regressions for fresh deploys.'
  );
});

test('T8: docker/entrypoint.sh contains EXACTLY ONE invocation of render-conf-template.js (drift sentinel; ADR 0014 §Drift sentinel)', () => {
  const src = readSafe(ENTRYPOINT_SH);
  assert(src !== null, 'docker/entrypoint.sh missing — re-baseline this sentinel.');
  const invocationCount = (src.match(/render-conf-template\.js/g) || []).length;
  assert(
    invocationCount === 1,
    'docker/entrypoint.sh has ' + invocationCount + ' invocations of render-conf-template.js — expected ' +
      'exactly 1 (drift sentinel; ADR 0014 §Drift sentinel). Multiple invocations suggest a second ' +
      'write-path that competes with the canonical one (or a half-finished refactor); zero invocations ' +
      'means the template-renderer integration was lost (T6 should also be failing). Keep the renderer ' +
      'invocation as the single source of truth for /etc/brainstorm.conf.'
  );
});

// ---------------------------------------------------------------------------
// Regression sentinels — PASS now AND post-implementation.
// ---------------------------------------------------------------------------

test('R1: docker/entrypoint.sh still installs the other conf templates (graperank/whitelist/blacklist/nip56) — Step 2 should not collateral-damage them (AC §No regression for the other five *.conf files)', () => {
  const src = readSafe(ENTRYPOINT_SH);
  assert(src !== null, 'docker/entrypoint.sh missing — re-baseline this sentinel.');
  assert(
    /for\s+conffile\s+in\s+graperank\s+whitelist\s+blacklist\s+nip56/.test(src),
    'R1: docker/entrypoint.sh no longer iterates [graperank, whitelist, blacklist, nip56] templates ' +
      '(regression; AC "No regression for the other five *.conf files"). Story #16 only changes the ' +
      'brainstorm.conf path; it must leave the existing conditional-copy loop for the other four conf ' +
      'files intact. If you have a strong reason to refactor that loop too — e.g., to share the renderer ' +
      'pattern — file a separate story; do not collateral-damage it here.'
  );
});

test('R2: config/brainstorm.conf.template carries TASK_QUEUE_ENABLED=true (story #17 / ADR 0015 default; story #13 contract preserved with the flag still present)', () => {
  const src = readSafe(CONF_TEMPLATE);
  assert(src !== null, 'brainstorm.conf.template missing — cannot check story #17 contract.');
  assert(
    /TASK_QUEUE_ENABLED\s*=\s*true/.test(src),
    'R2: config/brainstorm.conf.template no longer carries TASK_QUEUE_ENABLED=true (story #17 / ADR ' +
      '0015 regression). Story #17 flipped the default from `false` to `true` because the queue path ' +
      'matured in production over days and the manual-flip-after-every-deploy recipe was a chronic ' +
      'operator chore. Reverting to `=false` re-opens that chore on every fresh container. The flag ' +
      'itself stays — story #13\'s rollback branch is still wired up in runTask.js and control-panel.js ' +
      '— only the default changes. If you intentionally want the template to default to `=false` again ' +
      '(a real architectural change, not a test fix), also flip this sentinel back to its pre-story-#17 ' +
      'form (assert =false) so it tracks the new intended default.'
  );
});

test('R3: docker/entrypoint.sh still chmods /etc/brainstorm.conf to 664 after rendering (file-permissions preserved)', () => {
  const src = readSafe(ENTRYPOINT_SH);
  assert(src !== null, 'docker/entrypoint.sh missing — re-baseline this sentinel.');
  assert(
    /chmod\s+664\s+\/etc\/brainstorm\.conf/.test(src),
    'R3: docker/entrypoint.sh no longer chmods /etc/brainstorm.conf to 664 (regression). The old heredoc ' +
      'path explicitly set 664 (line 124); the new renderer path must preserve this permission. ' +
      '`source /etc/brainstorm.conf` works only when the file is group-readable (664), and ' +
      'start-brainstorm.sh sources it on every brainstorm process start. Without 664, the brainstorm ' +
      'system user can\'t read its own config.'
  );
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
