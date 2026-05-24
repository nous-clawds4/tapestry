/**
 * Failing tests for story #4: scheduled task to refresh Meilisearch profiles + House PoV WoT scores.
 * See engineering-team/stories/4-scheduled-search-and-house-scores-refresh.test-plan.md
 *
 * Each test maps to one or more acceptance criteria. Tests fail on the pre-implementation
 * tree and pass once the Implementer lands the changes described in ADR 0003 (Option A).
 *
 * Approach: file-grep + module-require for source assertions. Behavioral / live-state
 * assertions (cross-restart persistence, real setInterval firing) are intentionally not
 * automated — see test-plan.md "Not covered" for the rationale.
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const SCHEDULER_PATH = path.join(REPO, 'src/api/scheduled-tasks/index.js');
const ORCHESTRATOR_PATH = path.join(REPO, 'src/algos/refreshSearchIndex.sh');
const REGISTRY_PATH = path.join(REPO, 'src/manage/taskQueue/taskRegistry.json');
const LOADER_JS_PATH = path.join(REPO, 'src/algos/nip85/loadScoresIntoMeilisearch.js');
const LOADER_SH_PATH = path.join(REPO, 'src/algos/nip85/loadScoresIntoMeilisearch.sh');
const RELAY_SETTINGS_PATH = path.join(REPO, 'ui/src/pages/settings/RelaySettings.jsx');
const BIBLE_PATH = path.join(REPO, 'BIBLE.md');
const CONFIG_DOC_PATH = path.join(REPO, 'docs/CONFIGURATION.md');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

// ── AC-2, AC-6 — RE-BASELINED for ADR 0019 (supersedes ADR 0003's hardcoded DEFAULTS) ──
// ADR 0019 retired the hardcoded DEFAULTS task set: ANY registered task is schedulable,
// validated against the task registry. The intent (refreshSearchIndex + updateAllScoresForOwner
// remain schedulable) survives — now via the registry rather than a DEFAULTS literal.
test('refreshSearchIndex + updateAllScoresForOwner are schedulable via the task registry (ADR 0019)', () => {
  const src = fs.readFileSync(SCHEDULER_PATH, 'utf8');
  assert(
    /taskRegistry|loadRegistry|isRegisteredTask/.test(src),
    'scheduled-tasks/index.js must validate schedulable tasks against the task registry (ADR 0019), not a hardcoded DEFAULTS set.'
  );
  const reg = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  assert(reg.tasks && reg.tasks.refreshSearchIndex,
    'taskRegistry.json must contain refreshSearchIndex (registry is the schedulable-task source of truth post-ADR-0019).');
  assert(reg.tasks && reg.tasks.updateAllScoresForOwner,
    'taskRegistry.json must contain updateAllScoresForOwner (no regression — still schedulable).');
});

// ── ADR constraint: handlers route by taskId ─────────────────
test('scheduler handlers read entryId from req (query/body) — per-entry routing per ADR 0021 (was taskId per ADR 0003/0019)', () => {
  // ADR 0021 (story #24) explicitly changes the handler key from taskId to
  // entryId. The operator approved the API-shape break at the architecture
  // gate ("OK to break this; no need for a backward-compat shim").
  // This sentinel is updated to reflect the new contract — the underlying
  // intent (handlers must require an ID and return 400 when missing)
  // remains the regression target.
  const src = fs.readFileSync(SCHEDULER_PATH, 'utf8');
  assert(
    /req\.(query|body|params)\.entryId/.test(src),
    'scheduler handlers must read entryId from req (e.g. req.query.entryId / req.body.entryId) so /api/scheduled-tasks/* can route per scheduled entry — per ADR 0021'
  );
  assert(
    /(status\(400\)|res\.status\(400\))[\s\S]{0,400}entryId|entryId[\s\S]{0,400}(status\(400\)|res\.status\(400\))/.test(src),
    'handlers must return HTTP 400 when entryId is missing (ADR 0021: required, no implicit default)'
  );
});

// ── AC-3 — RE-BASELINED (inverted) for ADR 0019: the 1-hour floor is REMOVED ──
// ADR 0019 supersedes ADR 0003 AC-3 — sub-hour cadence is required (reconcileRecent ~10 min),
// so the old floor must be gone.
test('handleUpdate no longer enforces a 1-hour minimum interval (ADR 0019 — sub-hour allowed)', () => {
  const src = fs.readFileSync(SCHEDULER_PATH, 'utf8');
  assert(
    !/Minimum interval is 1 hour/i.test(src) && !/totalHours\s*<\s*1/.test(src),
    'scheduled-tasks/index.js must NOT enforce the old 1-hour floor (ADR 0019 supersedes ADR 0003 AC-3).'
  );
});

// ── AC-6 — RE-BASELINED for ADR 0019: boot reconcile replaces setInterval initScheduler ──
// The cold-start-restoration intent survives: a boot reconcile upserts a durable BullMQ Job
// Scheduler per enabled task (so each restores independently after restart) — now via Redis,
// not an in-process setInterval.
test('boot reconcile restores enabled schedules per task after restart (ADR 0019)', () => {
  const src = fs.readFileSync(SCHEDULER_PATH, 'utf8');
  assert(
    /reconcileSchedulesFromConfig/.test(src) && /readConfig\(\)/.test(src),
    'scheduled-tasks/index.js must expose a boot reconcile (reconcileSchedulesFromConfig) that reads the per-task config and restores enabled schedules — replacing ADR 0003 initScheduler (AC-6 intent preserved).'
  );
});

// ── AC-7: orchestrator script exists with required calls ─────
test('src/algos/refreshSearchIndex.sh exists, is executable, and orchestrates the required sequence', () => {
  assert(fs.existsSync(ORCHESTRATOR_PATH),
    'src/algos/refreshSearchIndex.sh must exist (new orchestrator script per ADR 0003)');
  const stat = fs.statSync(ORCHESTRATOR_PATH);
  assert((stat.mode & 0o111) !== 0,
    'src/algos/refreshSearchIndex.sh must be executable (chmod +x) — task runner spawns it as a shell script');

  const src = fs.readFileSync(ORCHESTRATOR_PATH, 'utf8');
  assert(/grapevine\/preferences/.test(src),
    'refreshSearchIndex.sh must fetch /api/grapevine/preferences to read the House PoV (povPubkey, delegatedPubkey, nip85Relay)');
  assert(/meili\/resync/.test(src),
    'refreshSearchIndex.sh must POST /api/search/profiles/meili/resync to trigger profile bulk-ingest (AC-7 profile half)');
  assert(/strfry\s+sync[\s\S]{0,200}10040/.test(src),
    'refreshSearchIndex.sh must sync House kind 10040 via strfry (defensive, in case the treasureMaps router preset is disabled)');
  assert(/strfry\s+sync[\s\S]{0,200}30382/.test(src),
    'refreshSearchIndex.sh must sync House kind 30382 via strfry before loading scores into Meilisearch');
  assert(/loadScoresIntoMeilisearch\.js[\s\S]{0,200}--povPubkey/.test(src),
    'refreshSearchIndex.sh must invoke loadScoresIntoMeilisearch.js with --povPubkey to load House (not Owner) scores');
  assert(/loadScoresIntoMeilisearch\.js[\s\S]{0,200}--delegatedPubkey/.test(src),
    'refreshSearchIndex.sh must invoke loadScoresIntoMeilisearch.js with --delegatedPubkey for House');
});

// ── AC-8: graceful skip when House PoV is unset ──────────────
test('refreshSearchIndex.sh handles unset House PoV with a WARN event and does not fail the run', () => {
  const src = fs.readFileSync(ORCHESTRATOR_PATH, 'utf8');
  assert(/houseUnconfigured/.test(src),
    'refreshSearchIndex.sh must emit a structured event with houseUnconfigured:true when povPubkey is unset (AC-8 — surfaced in run history)');
  assert(/else[\s\S]+?fi/.test(src),
    'refreshSearchIndex.sh must have an else-branch handling the unset-PoV case');
  // The orchestrator must not propagate a non-zero exit from the unset path.
  // Either explicit `exit 0` at the end, or no `exit 1` on the unset path.
  const hasExplicitSuccess = /exit\s+0\s*$/m.test(src) || /TASK_END[\s\S]*?exit\s+0/.test(src);
  const noFailureOnUnsetPath = !/houseUnconfigured[\s\S]{0,300}exit\s+1/.test(src);
  assert(hasExplicitSuccess || noFailureOnUnsetPath,
    'refreshSearchIndex.sh unset-PoV path must exit 0 (success — profile sync still happened). AC-8: task must not fail the entire run.');
});

// ── AC-7: task registry entry ────────────────────────────────
test('taskRegistry.json contains a refreshSearchIndex entry pointing at src/algos/refreshSearchIndex.sh', () => {
  const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const entry = registry.tasks?.refreshSearchIndex;
  assert(entry, 'taskRegistry.json tasks.refreshSearchIndex must exist (per ADR 0003 implementation notes) — required for POST /api/run-task?taskName=refreshSearchIndex to resolve');
  const scriptPath = entry.script || entry.script_relative_path || (Array.isArray(entry.scripts) && entry.scripts[0]) || '';
  assert(/refreshSearchIndex\.sh/.test(scriptPath),
    `refreshSearchIndex entry must point at refreshSearchIndex.sh — got "${scriptPath}"`);
});

// ── AC-7 + AC-11: loader parameterization ────────────────────
test('loadScoresIntoMeilisearch.js exports parseArgs, accepts --povPubkey + --delegatedPubkey, and is safely require()-able', () => {
  const src = fs.readFileSync(LOADER_JS_PATH, 'utf8');
  assert(
    /module\.exports\s*=\s*\{[^}]*parseArgs|exports\.parseArgs\s*=/.test(src),
    'loadScoresIntoMeilisearch.js must export `parseArgs(argv)` for unit testability — the parameterization per ADR 0003'
  );
  assert(/--povPubkey/.test(src),
    'loadScoresIntoMeilisearch.js must handle the --povPubkey CLI arg to support House (non-owner) score loading');
  assert(/--delegatedPubkey/.test(src),
    'loadScoresIntoMeilisearch.js must handle the --delegatedPubkey CLI arg');
  assert(/require\.main\s*===\s*module/.test(src),
    'loadScoresIntoMeilisearch.js must guard main() with `if (require.main === module)` so it is safely require()-able for tests without executing main()');
});

// ── AC-11: owner script unchanged ────────────────────────────
test('loadScoresIntoMeilisearch.sh still invokes the .js with no --povPubkey/--delegatedPubkey args (owner default path preserved)', () => {
  const src = fs.readFileSync(LOADER_SH_PATH, 'utf8');
  const callMatch = src.match(/node\s+[^\n]*loadScoresIntoMeilisearch\.js([^\n]*)/);
  assert(callMatch, 'loadScoresIntoMeilisearch.sh must still invoke loadScoresIntoMeilisearch.js');
  const argsPart = callMatch[1].trim();
  assert(!/--povPubkey|--delegatedPubkey/.test(argsPart),
    `Owner-side loadScoresIntoMeilisearch.sh must NOT pass --povPubkey/--delegatedPubkey (would break the owner default path — AC-11 no regression). Current args after the .js path: "${argsPart}"`);
});

// ── AC-1, AC-2 — RE-BASELINED for ADR 0019: panel is generalized over registered tasks ──
// The panel now renders any registered task dynamically from /api/scheduled-tasks/list, so
// card titles come from the registry `name` rather than hardcoded JSX literals. The
// refreshSearchIndex title is preserved as its registry name (verified below).
test('Scheduled Tasks panel is generalized over registered tasks; refreshSearchIndex title comes from the registry (ADR 0019)', () => {
  const src = fs.readFileSync(RELAY_SETTINGS_PATH, 'utf8');
  assert(/ScheduledTasksPanel/.test(src),
    'ScheduledTasksPanel must remain the host panel.');
  assert(/scheduled-tasks\/list/.test(src),
    'The panel must fetch /api/scheduled-tasks/list to render any registered task (ADR 0019 generalization).');
  const reg = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  assert(reg.tasks.refreshSearchIndex && /Refresh Meilisearch profiles\s*&\s*House PoV scores/.test(reg.tasks.refreshSearchIndex.name || ''),
    'taskRegistry.json refreshSearchIndex.name must carry the user-facing title (now the source of the card title).');
});

// ── AC-9: pre-run banner ─────────────────────────────────────
test('RelaySettings.jsx has a House-PoV-unconfigured banner that depends on povPubkey and links to Search Preferences', () => {
  const src = fs.readFileSync(RELAY_SETTINGS_PATH, 'utf8');
  assert(/House PoV is not configured/i.test(src),
    'Banner text must include "House PoV is not configured" so operators see the dependency (AC-9)');
  assert(/povPubkey/.test(src),
    'Banner must reference povPubkey (the settings field it checks for absence)');
  assert(/Search Preferences/.test(src),
    'Banner must include the "Search Preferences" link copy');
  // Strict route check — must match the actual SearchPreferences route per ui/src/App.jsx
  // ({ path: 'search-preferences' } nested under { path: 'grapevine' } under the 'tapestry' parent).
  // Previously this regex permitted any string containing "search-preferences", which let a wrong
  // route like "/home/my-grapevine/search-preferences" pass undetected — see review 4 Blocking #1.
  assert(/\/tapestry\/grapevine\/search-preferences/.test(src),
    'Banner href must point to the actual Search Preferences route (/tapestry/grapevine/search-preferences) so clicking it lands on the configuration page, not a 404');
});

// ── AC-12: docs ──────────────────────────────────────────────
test('BIBLE.md or docs/CONFIGURATION.md mentions the new task title and its dependencies on House PoV + treasureMaps preset', () => {
  const bible = fs.existsSync(BIBLE_PATH) ? fs.readFileSync(BIBLE_PATH, 'utf8') : '';
  const config = fs.existsSync(CONFIG_DOC_PATH) ? fs.readFileSync(CONFIG_DOC_PATH, 'utf8') : '';
  const combined = bible + '\n' + config;
  assert(/Refresh Meilisearch profiles\s*&(?:amp;|amp;|)?\s*House PoV scores/.test(combined),
    'docs must mention the new task by its UI title');
  assert(/House PoV/.test(combined),
    'docs must reference the House PoV dependency (operator must configure it for the score half to run)');
  assert(/treasureMaps/.test(combined),
    'docs must mention the treasureMaps router preset as a complementary dependency for kind 10040 freshness');
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
