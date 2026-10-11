'use strict';
/**
 * Route walker — run as a CHILD PROCESS (`node test/helpers/routeWalk.js <result.json>`), never required in-process.
 * Story security-auth-exposure #8, ADR security-auth-exposure/0005 "Implementation notes → For the Tester".
 *
 * It loads the real API registration (`register(app)` in src/api/index.js) into a bare Express app and writes every
 * route Express will dispatch to <result.json>:
 *
 *   { routes: [{ method, path, names, guard, first }], mounts: [{ path, names }], registerError, routerWrites, ms }
 *
 *   names  the route's own handler stack, by function name
 *   guard  the recognised owner's-side guard the stack STARTS with, matched by function identity, or null:
 *          requireOwner (settings), requireOwnerOnly / requireOwnerOrAdmin (admin), requireSyncManager (sync access)
 *   first  the name of the first handler when the stack has more than one (requireSyncManagerOrPovSync,
 *          requireOwnAssistant, …), else null
 *
 * The registration has side effects a test must contain (the gate loads suites in-process, hence the child):
 *   - the in-container module prefix /usr/local/lib/node_modules/brainstorm/ is mapped to this checkout;
 *   - the owner-assistant key loader is stubbed (some routes load the key while registering);
 *   - router initialisation is stubbed, and writes to the strfry router config and its state file are swallowed and
 *     counted (routerWrites), so nothing under /etc or /var/lib is touched;
 *   - TAPESTRY_SETTINGS_PATH / BRAINSTORM_BASE_DIR / BRAINSTORM_CONF_PATH are expected to point at a temp dir (the
 *     parent sets them); TASK_QUEUE_ENABLED reads as unset, so the task-queue dashboard is not mounted here (the
 *     test adds that mount from a static scan, as it does the entrypoint's own routes).
 *
 * Console output from the loaded modules is silenced; the result goes to the file only.
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.resolve(__dirname, '..', '..');
// Resolve before chdir(ROOT) below, so a relative out-path is written against the launching cwd.
const OUT = process.argv[2] ? path.resolve(process.argv[2]) : null;
const CONTAINER_PREFIX = '/usr/local/lib/node_modules/brainstorm/';
const ROUTER_FILES = ['/etc/strfry-router-tapestry.config', '/var/lib/brainstorm/router-state.json'];

const started = Date.now();
const result = { routes: [], mounts: [], registerError: null, routerWrites: 0, ms: 0 };

function finish(code) {
  result.ms = Date.now() - started;
  try { fs.writeFileSync(OUT, JSON.stringify(result)); } catch (e) { process.stderr.write(`routeWalk: cannot write ${OUT}: ${e.message}\n`); code = 2; }
  process.exit(code);
}

if (!OUT) { process.stderr.write('usage: node test/helpers/routeWalk.js <result.json>\n'); process.exit(2); }

for (const k of ['log', 'info', 'warn', 'error', 'debug']) console[k] = () => {};

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (typeof request === 'string' && request.startsWith(CONTAINER_PREFIX)) request = path.join(ROOT, request.slice(CONTAINER_PREFIX.length));
  return origResolve.call(this, request, ...rest);
};

// feature-magic-carpet: the bounties store (src/db/bounties.js), which the bounties routes load while registering,
// opens a SQLite file through better-sqlite3 at load and also loads uuid. The walk needs the routes, not the store, so
// both are replaced by inert stand-ins (no file is opened, whether or not the modules are installed; without them,
// register(app) stopped at the bounties routes and nothing after them was walked), and BOUNTIES_DB_PATH points
// outside the checkout so the store never creates <repo>/data.
function InertDatabase() {
  const stmt = { run: () => ({ changes: 0 }), get: () => undefined, all: () => [], iterate: () => [].values() };
  return { pragma: () => [], exec() { return this; }, prepare: () => stmt, transaction: (fn) => fn, close() {} };
}
const STORE_STAND_INS = { 'better-sqlite3': InertDatabase, uuid: { v4: () => require('crypto').randomUUID() } };
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (Object.prototype.hasOwnProperty.call(STORE_STAND_INS, request)) return STORE_STAND_INS[request];
  return origLoad.call(this, request, ...rest);
};
process.env.BOUNTIES_DB_PATH = path.join(require('os').tmpdir(), 'routeWalk-bounties.db');

// Swallow (and count) writes to the router's two files, whatever path reaches them.
for (const fn of ['writeFileSync', 'writeFile', 'appendFileSync']) {
  const real = fs[fn];
  fs[fn] = function (p, ...rest) {
    if (ROUTER_FILES.includes(String(p))) {
      result.routerWrites++;
      const cb = rest.find((x) => typeof x === 'function');
      if (cb) process.nextTick(cb, null);
      return undefined;
    }
    return real.call(fs, p, ...rest);
  };
}

delete process.env.TASK_QUEUE_ENABLED;
process.chdir(ROOT);

const timer = setTimeout(() => { result.registerError = 'register(app) did not finish within 60 s'; finish(1); }, 60000);

(async () => {
  const express = require(path.join(ROOT, 'node_modules/express'));

  const keys = require(path.join(ROOT, 'src/utils/assistantKeys'));
  keys.getOwnerAssistantKeys = async () => ({ privkey: '11'.repeat(32), pubkey: '22'.repeat(32) });
  process.env.TA_PUBKEY = process.env.TA_PUBKEY || '22'.repeat(32);

  const router = require(path.join(ROOT, 'src/api/strfry/routerConfig'));
  router.initRouter = async () => {};

  const brainstormConfig = require(path.join(ROOT, 'src/utils/brainstormConfig'));
  if (brainstormConfig && typeof brainstormConfig.get === 'function') {
    const realGet = brainstormConfig.get.bind(brainstormConfig);
    brainstormConfig.get = (name) => (name === 'TASK_QUEUE_ENABLED' ? undefined : realGet(name));
  }

  const GUARDS = new Map();
  const settingsApi = require(path.join(ROOT, 'src/api/settings/settingsApi.js'));
  const adminApi = require(path.join(ROOT, 'src/api/admin'));
  const syncAccess = require(path.join(ROOT, 'src/api/strfry/negentropyAccess.js'));
  if (settingsApi.requireOwner) GUARDS.set(settingsApi.requireOwner, 'requireOwner');
  if (adminApi.requireOwnerOnly) GUARDS.set(adminApi.requireOwnerOnly, 'requireOwnerOnly');
  if (adminApi.requireOwnerOrAdmin) GUARDS.set(adminApi.requireOwnerOrAdmin, 'requireOwnerOrAdmin');
  if (syncAccess.requireSyncManager) GUARDS.set(syncAccess.requireSyncManager, 'requireSyncManager');

  const app = express();
  try {
    await require(path.join(ROOT, 'src/api')).register(app);
  } catch (e) {
    result.registerError = String((e && e.message) || e);
  }

  const mountPath = (layer) => {
    const re = layer.regexp;
    if (!re || re.fast_slash) return '/';
    return String(re.source).replace(/^\^/, '').replace(/\\\/\?\(\?=\\\/\|\$\)$/, '').replace(/\\\//g, '/');
  };
  const walk = (stack, prefix) => {
    for (const layer of stack) {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).filter((m) => layer.route.methods[m] && m !== '_all');
        if (layer.route.methods._all) methods.push('all');
        const hs = layer.route.stack.map((l) => l.handle);
        for (const m of methods) {
          result.routes.push({
            method: m.toUpperCase(),
            path: prefix + layer.route.path,
            names: layer.route.stack.map((l) => l.name || '<anonymous>'),
            guard: GUARDS.get(hs[0]) || null,
            first: hs.length > 1 ? (hs[0].name || '<anonymous>') : null,
          });
        }
      } else if (layer.handle && Array.isArray(layer.handle.stack)) {
        const p = mountPath(layer);
        walk(layer.handle.stack, p === '/' ? prefix : prefix + p);
      } else if (layer.handle && layer.handle.length !== 4) {
        const p = mountPath(layer);
        if (p !== '/') result.mounts.push({ path: prefix + p, names: [layer.name || '<anonymous>'] });
      }
    }
  };
  walk((app._router && app._router.stack) || [], '');
  clearTimeout(timer);
  finish(0);
})().catch((e) => { result.registerError = `walker failed: ${String((e && e.stack) || e)}`; finish(1); });
