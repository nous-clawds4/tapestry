/**
 * Negentropy-sync presets (story relay-stream-gaps #3, ADR relay-stream-gaps/0003).
 *
 * A preset is a saved one-shot sync: a relay, a direction and a filter (kinds, authors,
 * #<letter> tags). The "Sync Negentropy Presets" scheduled task
 * (src/manage/negentropySync/syncPresets.sh) calls POST …/run over loopback; the run syncs
 * every switched-on preset, one at a time and in name order, through the one-shot's command
 * builder and its single slot (negentropySync.js), and records each preset's result where the
 * Negentropy Sync tab reads it. Each run covers events since the preset's last successful run,
 * less an hour; a first run covers the last 7 days.
 *
 * GET  /api/strfry/negentropy-presets         → { success, presets, running }
 * POST /api/strfry/negentropy-presets         { name, relay, dir, filter, enabled? }: save; the
 *                                             preset with the same name (any case) is replaced
 * POST /api/strfry/negentropy-presets/toggle  { id, enabled }
 * POST /api/strfry/negentropy-presets/delete  { id }
 * POST /api/strfry/negentropy-presets/run     → { success, results, failed }; 409 { alreadyRunning }
 *
 * Presets are persistent, scheduled and may upload, so every POST is owner or local only
 * (routerConfig's requireOwnerOrLocal).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { isSyncActive, runStrfrySync, relayMessageOf } = require('./negentropySync');
const { relayUrlProblem, requireOwnerOrLocal } = require('./routerConfig');

// On the data volume, so presets survive restarts and deploys. Env override for the stack-free suite.
const PRESETS_PATH = process.env.NEGENTROPY_PRESETS_PATH || '/var/lib/brainstorm/negentropy-presets.json';

const FLOOR_MESSAGE = 'A preset must narrow what it syncs: add event kinds, authors or a tag filter.';
const DIRS = ['down', 'up', 'both'];
const TAG_FILTER_KEY_RE = /^#[a-zA-Z]$/;
const HEX_TAG_KEYS = ['#p', '#P', '#e', '#E']; // strfry refuses anything but 64-hex for these
const HEX64_RE = /^[0-9a-fA-F]{64}$/;
const LOWER_HEX64_RE = /^[0-9a-f]{64}$/;
const MAX_NAME_LENGTH = 80;
const MAX_TAG_VALUE_LENGTH = 512;

const OVERLAP_SECONDS = 3600;
const FIRST_RUN_SECONDS = 7 * 86400;
const SLOT_POLL_MS = 5000;
const SLOT_WAIT_MS = 10 * 60 * 1000;
const SYNC_TIMEOUT_MS = 10 * 60 * 1000;
const RELAY_STALL_MS = 60 * 1000; // a relay notice, then this long with no other line, stops strfry (Amendment 2)
const MANUAL_SYNC_SKIP = 'a manual sync was running';

const nowSec = () => Math.floor(Date.now() / 1000);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sameTarget = (a, b) => a.relay === b.relay && a.dir === b.dir && JSON.stringify(a.filter) === JSON.stringify(b.filter);

// ── Pure helpers ─────────────────────────────────────────────

/**
 * Check a preset body and return what would be saved: the trimmed name, the relay, the
 * direction (default down) and the filter's kinds, authors and #<letter> keys. since, until,
 * limit, ids and unknown keys are dropped, since the schedule's window sets since.
 * A preset must have kinds, authors or a tag filter (AC-2).
 * → { ok, preset?, errors[] }
 */
function validatePreset(input) {
  const body = input && typeof input === 'object' ? input : {};
  const errors = [];

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > MAX_NAME_LENGTH) errors.push(`The preset name must be 1 to ${MAX_NAME_LENGTH} characters.`);

  if (body.relay == null) {
    errors.push('A relay URL is required.');
  } else {
    const why = relayUrlProblem(body.relay);
    if (why) errors.push(`The relay URL ${why}.`);
  }

  const dir = body.dir == null || body.dir === '' ? 'down' : body.dir;
  if (!DIRS.includes(dir)) errors.push('The direction must be down, up or both.');

  const raw = body.filter && typeof body.filter === 'object' && !Array.isArray(body.filter) ? body.filter : {};
  const filter = {};
  let filterErrors = 0;
  if (raw.kinds != null) {
    if (!Array.isArray(raw.kinds) || !raw.kinds.every((k) => Number.isInteger(k) && k >= 0 && k <= 65535)) {
      errors.push('Event kinds must be whole numbers from 0 to 65535.');
      filterErrors++;
    } else if (raw.kinds.length > 0) {
      filter.kinds = [...new Set(raw.kinds)];
    }
  }
  if (raw.authors != null) {
    if (!Array.isArray(raw.authors) || !raw.authors.every((a) => typeof a === 'string' && LOWER_HEX64_RE.test(a))) {
      errors.push('Authors must be 64-character lowercase hex pubkeys.');
      filterErrors++;
    } else if (raw.authors.length > 0) {
      filter.authors = [...raw.authors];
    }
  }
  for (const key of Object.keys(raw)) {
    if (!TAG_FILTER_KEY_RE.test(key)) continue;
    const hex = HEX_TAG_KEYS.includes(key);
    const valid = (v) => typeof v === 'string' && (hex ? HEX64_RE.test(v) : v.length > 0 && v.length <= MAX_TAG_VALUE_LENGTH);
    if (!Array.isArray(raw[key]) || !raw[key].every(valid)) {
      errors.push(hex
        ? `${key} values must be 64-character hex.`
        : `${key} values must be non-empty text of at most ${MAX_TAG_VALUE_LENGTH} characters.`);
      filterErrors++;
    } else if (raw[key].length > 0) {
      filter[key] = [...raw[key]];
    }
  }
  if (filterErrors === 0 && Object.keys(filter).length === 0) errors.push(FLOOR_MESSAGE);

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, preset: { name, relay: body.relay, dir, filter }, errors: [] };
}

/** Where a preset's next run starts (unix seconds): its last success less an hour, else 7 days ago. */
function windowSince(preset, nowSecs) {
  const last = preset && preset.lastSuccessAt;
  return Math.max(0, Math.floor(last ? last - OVERLAP_SECONDS : nowSecs - FIRST_RUN_SECONDS));
}

// loguru's prefix on each strfry line, e.g. "2026-10-09 03:12:45.823 (   0.036s) [main thread     ]INFO| "
const LOG_PREFIX_RE = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d+ \([^)]*\) \[[^\]]*\][^|]*\| ?/;

/**
 * Read `strfry sync`'s output (all on stderr): "Set reconcile complete. Have H need N",
 * "UP: n events (r remaining)", "DOWN: n events (r remaining)" and "Writer: added: a …"
 * (batch lines are summed). ok needs exit 0 and the reconcile line; otherwise error is the
 * cause, the last of: a line containing "error" or "ERR|", without the log prefix, or a relay
 * NOTICE/CLOSED, as `relay said "<text>"`. With no cause, the exit code. stop ('stalled' or
 * 'timeout', Amendment 2) says runStrfrySync stopped strfry, and joins why to the cause.
 * → { ok, have, need, up, down, added, error }
 */
function parseSyncOutput(text, exitCode, stop) {
  const result = { ok: false, have: null, need: null, up: 0, down: 0, added: 0, error: null };
  let reconciled = false;
  let lastError = null;
  for (const line of String(text || '').split('\n')) {
    if (!line.trim()) continue;
    const msg = line.replace(LOG_PREFIX_RE, '').trim();
    let m;
    if ((m = /Set reconcile complete\. Have (\d+) need (\d+)/.exec(msg))) {
      reconciled = true;
      result.have = Number(m[1]);
      result.need = Number(m[2]);
    } else if ((m = /\bUP: (\d+) events/.exec(msg))) {
      result.up += Number(m[1]);
    } else if ((m = /\bDOWN: (\d+) events/.exec(msg))) {
      result.down += Number(m[1]);
    } else if ((m = /Writer: added: (\d+)/.exec(msg))) {
      result.added += Number(m[1]);
    }
    const said = relayMessageOf(line);
    if (said !== null) lastError = `relay said "${said}"`;
    else if (/error/.test(line) || line.includes('ERR|')) lastError = msg;
  }
  result.ok = exitCode === 0 && reconciled;
  if (!result.ok) {
    if (stop === 'stalled') {
      result.error = lastError
        ? `${lastError}; nothing followed for 60 s, so strfry sync was stopped`
        : 'strfry sync made no progress for 60 s and was stopped';
    } else if (stop === 'timeout') {
      result.error = lastError
        ? `${lastError}; strfry sync did not finish within 10 minutes and was stopped`
        : 'strfry sync did not finish within 10 minutes and was stopped';
    } else {
      result.error = lastError || (exitCode === 0
        ? 'strfry sync exited with code 0 without completing the reconcile'
        : `strfry sync exited with code ${exitCode}`);
    }
  }
  return result;
}

// ── Storage ──────────────────────────────────────────────────

/** The presets file, or no presets when it doesn't exist yet. Throws on an unreadable file, so it is never overwritten. */
function loadStore() {
  let text;
  try {
    text = fs.readFileSync(PRESETS_PATH, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return { version: 1, presets: [] };
    throw err;
  }
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.presets)) throw new Error(`${PRESETS_PATH} does not hold { version, presets: [...] }`);
  return { version: 1, presets: parsed.presets };
}

/** Write a temp file and rename it into place, so a reader never sees half a file. */
function saveStore(store) {
  fs.mkdirSync(path.dirname(PRESETS_PATH), { recursive: true });
  const tmp = `${PRESETS_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, PRESETS_PATH);
}

// One read-modify-write at a time, in arrival order (as routerConfig's withRouterLock).
// Never held across a strfry sync, so saves, toggles and deletes answer during a run.
let presetsLock = Promise.resolve();
function withPresetsLock(fn) {
  const run = presetsLock.then(fn, fn);
  presetsLock = run.catch(() => {});
  return run;
}

// ── Runner ───────────────────────────────────────────────────

let runInProgress = false;
const WITHDRAWN = Symbol('withdrawn');

/**
 * The preset as stored now, or null when it was deleted or switched off. Read without the
 * lock: saves rename a whole file into place. Throws when the presets can't be read, so the
 * preset fails closed (an upload isn't run when the owner's switch can't be confirmed).
 */
function storedSwitchedOn(id) {
  let store;
  try {
    store = loadStore();
  } catch (err) {
    throw new Error(`Could not read the presets: ${err.message}`);
  }
  const stored = store.presets.find((p) => p && p.id === id);
  return stored && stored.enabled === true ? stored : null;
}

/**
 * Wait (polling) for the one-shot's slot, then start(<the preset as stored now>) in it. The
 * preset is re-read at every check, and the re-read, the check and the start happen in one
 * synchronous step (Amendment 2). → start's result; WITHDRAWN when the preset was switched off
 * or deleted meanwhile; or null when a manual sync still held the slot after 10 minutes.
 */
async function syncInSlot(id, start) {
  const deadline = Date.now() + SLOT_WAIT_MS;
  for (;;) {
    const current = storedSwitchedOn(id);
    if (!current) return WITHDRAWN;
    if (!isSyncActive()) return start(current);
    if (Date.now() >= deadline) return null;
    await sleep(SLOT_POLL_MS);
  }
}

/** Sync one preset and record its lastRun. → its entry in the run's results, or null when it was withdrawn */
async function runPreset(preset) {
  const startedAt = nowSec();
  let ran = preset; // the record that ran: the one re-read as it took the slot, so a re-save before its turn runs as saved
  let since = windowSince(preset, startedAt);
  let outcome;
  try {
    const synced = await syncInSlot(preset.id, (current) => {
      ran = current;
      since = windowSince(current, startedAt);
      return runStrfrySync(current.relay, current.dir, { ...current.filter, since }, { timeoutMs: SYNC_TIMEOUT_MS, stallMs: RELAY_STALL_MS, presetName: current.name });
    });
    if (synced === WITHDRAWN) {
      console.log(`[negentropy-presets] ${JSON.stringify(preset.name)}: not run, switched off or deleted since the run began`);
      return null;
    }
    if (!synced) {
      outcome = { ok: false, skipped: MANUAL_SYNC_SKIP };
    } else {
      outcome = parseSyncOutput(synced.output, synced.exitCode, synced.stalled ? 'stalled' : synced.timedOut ? 'timeout' : undefined);
    }
  } catch (err) {
    outcome = { ok: false, error: (err && err.message) || String(err) };
  }

  const lastRun = { startedAt, finishedAt: nowSec(), since, ok: outcome.ok === true, added: outcome.added ?? null, sent: outcome.up ?? null };
  if (outcome.error) lastRun.error = outcome.error;
  if (outcome.skipped) lastRun.skipped = outcome.skipped;
  console.log(`[negentropy-presets] ${JSON.stringify(ran.name)}: ${lastRun.ok ? `${lastRun.added} in, ${lastRun.sent} out` : lastRun.skipped ? `skipped: ${lastRun.skipped}` : `failed: ${lastRun.error}`}`);

  try {
    await withPresetsLock(() => {
      const store = loadStore();
      const stored = store.presets.find((p) => p && p.id === preset.id);
      if (!stored) return; // deleted while it ran
      stored.lastRun = lastRun;
      // The run's start, so events published during the sync fall inside the next window.
      // Not when the preset was re-saved with another relay, direction or filter meanwhile.
      if (lastRun.ok && sameTarget(stored, ran)) stored.lastSuccessAt = startedAt;
      saveStore(store);
    });
  } catch (err) {
    console.error(`[negentropy-presets] Could not record the run of ${JSON.stringify(ran.name)}: ${err.message}`);
  }

  return { id: preset.id, name: ran.name, ok: lastRun.ok, added: lastRun.added, sent: lastRun.sent, error: lastRun.error || null, skipped: lastRun.skipped || null };
}

/**
 * Sync every switched-on preset, one at a time, in name order. A second call while one runs
 * returns { alreadyRunning: true }. A failed preset doesn't stop the others; failed counts the
 * presets that ran and failed (a skipped preset is reported as skipped, not failed). A preset
 * switched off or deleted before its turn is left out (Amendment 2).
 */
async function runEnabledPresets() {
  if (runInProgress) return { alreadyRunning: true };
  runInProgress = true;
  try {
    const enabled = loadStore().presets
      .filter((p) => p && p.enabled === true)
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const results = [];
    for (const preset of enabled) {
      const result = await runPreset(preset);
      if (result) results.push(result);
    }
    return { success: true, results, failed: results.filter((r) => !r.ok && !r.skipped).length };
  } finally {
    runInProgress = false;
  }
}

// ── API Handlers ─────────────────────────────────────────────

function handleListPresets(req, res) {
  try {
    res.json({ success: true, presets: loadStore().presets, running: runInProgress });
  } catch (err) {
    res.status(500).json({ success: false, error: `Could not read the presets: ${err.message}` });
  }
}

/** Create a preset (switched off unless enabled: true), or replace the one with the same name. */
function handleSavePreset(req, res) {
  if (!requireOwnerOrLocal(req, res)) return;
  const body = req.body || {};
  const checked = validatePreset(body);
  if (!checked.ok) return res.status(400).json({ success: false, error: checked.errors.join(' ') });
  const { name, relay, dir, filter } = checked.preset;
  return withPresetsLock(() => {
    const store = loadStore();
    const now = nowSec();
    const existing = store.presets.find((p) => p && typeof p.name === 'string' && p.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      // Replacing keeps id, switch and lastRun; a new relay, direction or filter starts its window over.
      if (!sameTarget(existing, checked.preset)) delete existing.lastSuccessAt;
      Object.assign(existing, { name, relay, dir, filter, updatedAt: now });
    } else {
      store.presets.push({ id: crypto.randomUUID(), name, relay, dir, filter, enabled: body.enabled === true, createdAt: now, updatedAt: now });
    }
    saveStore(store);
    res.json({ success: true, replaced: !!existing, preset: existing || store.presets[store.presets.length - 1] });
  }).catch((err) => {
    if (!res.headersSent) res.status(500).json({ success: false, error: `Could not save the preset: ${err.message}` });
  });
}

function handleTogglePreset(req, res) {
  if (!requireOwnerOrLocal(req, res)) return;
  const { id, enabled } = req.body || {};
  if (typeof enabled !== 'boolean') return res.status(400).json({ success: false, error: 'enabled must be true or false' });
  return withPresetsLock(() => {
    const store = loadStore();
    const preset = store.presets.find((p) => p && p.id === id);
    if (!preset) return res.status(404).json({ success: false, error: 'No preset has that id' });
    preset.enabled = enabled;
    saveStore(store);
    res.json({ success: true, preset });
  }).catch((err) => {
    if (!res.headersSent) res.status(500).json({ success: false, error: `Could not switch the preset: ${err.message}` });
  });
}

function handleDeletePreset(req, res) {
  if (!requireOwnerOrLocal(req, res)) return;
  const { id } = req.body || {};
  return withPresetsLock(() => {
    const store = loadStore();
    const presets = store.presets.filter((p) => !(p && p.id === id));
    if (presets.length === store.presets.length) return res.status(404).json({ success: false, error: 'No preset has that id' });
    saveStore({ ...store, presets });
    res.json({ success: true });
  }).catch((err) => {
    if (!res.headersSent) res.status(500).json({ success: false, error: `Could not delete the preset: ${err.message}` });
  });
}

/** The scheduled task's entry point (loopback). 200 even when presets failed; 409 when a run is already going. */
async function handleRunPresets(req, res) {
  if (!requireOwnerOrLocal(req, res)) return;
  try {
    const result = await runEnabledPresets();
    if (result.alreadyRunning) {
      return res.status(409).json({ success: false, alreadyRunning: true, error: 'A presets run is already going' });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: `The presets run failed: ${err.message}` });
  }
}

function registerNegentropyPresetRoutes(app) {
  app.get('/api/strfry/negentropy-presets', handleListPresets);
  app.post('/api/strfry/negentropy-presets', handleSavePreset);
  app.post('/api/strfry/negentropy-presets/toggle', handleTogglePreset);
  app.post('/api/strfry/negentropy-presets/delete', handleDeletePreset);
  app.post('/api/strfry/negentropy-presets/run', handleRunPresets);
}

module.exports = { registerNegentropyPresetRoutes, validatePreset, windowSince, parseSyncOutput, runEnabledPresets };
