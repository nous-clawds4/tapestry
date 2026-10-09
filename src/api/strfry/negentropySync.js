/**
 * Negentropy Sync — one-shot sync with progress streaming via SSE.
 *
 * POST /api/strfry/negentropy-sync
 *   Body: { relay, dir, filter }
 *     relay  — wss:// URL (required)
 *     dir    — "up" | "down" | "both" (default "down")
 *     filter — { kinds?: number[], authors?: string[] }
 *
 * Returns JSON: { success, output, error }
 *
 * GET /api/strfry/negentropy-sync/stream
 *   Same query params (relay, dir, filter as JSON string)
 *   Returns SSE stream of progress lines, then a final JSON result event.
 */

const { spawn, execFile } = require('child_process');
const WebSocket = require('ws');

// Track active sync so we can report status
let activeSync = null;

// Single-letter tag filters, e.g. "#z": ["39998:<pubkey>:tag"] (ADR
// relay-management/0001). Only #<one ASCII letter> passes — strfry indexes
// single-character tag names only, and every other unknown key stays dropped.
const TAG_FILTER_KEY_RE = /^#[a-zA-Z]$/;

function buildFilterObj(filter) {
  const filterObj = {};
  if (filter.kinds && filter.kinds.length > 0) filterObj.kinds = filter.kinds;
  if (filter.authors && filter.authors.length > 0) filterObj.authors = filter.authors;
  if (filter.since != null) filterObj.since = filter.since;
  if (filter.until != null) filterObj.until = filter.until;
  for (const key of Object.keys(filter)) {
    if (!TAG_FILTER_KEY_RE.test(key)) continue;
    const values = Array.isArray(filter[key])
      ? filter[key].filter(v => typeof v === 'string' && v.length > 0)
      : [];
    if (values.length > 0) filterObj[key] = values;
  }
  return filterObj;
}

function buildCommand(relay, dir, filter) {
  const filterObj = buildFilterObj(filter);
  const args = ['sync', relay, '--filter', JSON.stringify(filterObj)];
  if (dir && dir !== 'both') {
    args.push('--dir', dir);
  }
  return { cmd: 'strfry', args };
}

function buildPreviewCommand(relay, dir, filter) {
  const filterObj = buildFilterObj(filter);
  let cmd = `strfry sync ${relay} --filter '${JSON.stringify(filterObj)}'`;
  if (dir && dir !== 'both') {
    cmd += ` --dir ${dir}`;
  }
  return cmd;
}

/**
 * POST /api/strfry/negentropy-sync
 * Non-streaming: waits for completion and returns full output.
 */
function handleNegentropySync(req, res) {
  const { relay, dir = 'down', filter = {} } = req.body || {};

  if (!relay || !/^wss?:\/\/.+/.test(relay)) {
    return res.json({ success: false, error: 'Invalid or missing relay URL' });
  }

  if (activeSync) {
    return res.json({ success: false, error: 'A sync is already in progress', active: true });
  }

  const { cmd, args } = buildCommand(relay, dir, filter);
  const preview = buildPreviewCommand(relay, dir, filter);

  console.log(`[negentropy-sync] Starting: ${preview}`);

  let stdout = '';
  let stderr = '';

  const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  activeSync = {
    relay, dir, filter, preview,
    startedAt: Date.now(),
    pid: proc.pid,
    lines: [],
  };

  proc.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    stdout += text;
    const lines = text.split('\n').filter(Boolean);
    activeSync.lines.push(...lines);
  });

  proc.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderr += text;
    const lines = text.split('\n').filter(Boolean);
    activeSync.lines.push(...lines);
  });

  // Timeout: 10 minutes
  const timeout = setTimeout(() => {
    proc.kill('SIGTERM');
  }, 10 * 60 * 1000);

  proc.on('close', (code) => {
    clearTimeout(timeout);
    activeSync = null;

    if (res.headersSent) return;

    res.json({
      success: code === 0,
      command: preview,
      output: (stdout + stderr).trim(),
      exitCode: code,
      error: code !== 0 ? `Process exited with code ${code}` : null,
    });
  });

  proc.on('error', (err) => {
    clearTimeout(timeout);
    activeSync = null;
    if (!res.headersSent) {
      res.json({ success: false, error: err.message });
    }
  });
}

/**
 * GET /api/strfry/negentropy-sync/stream
 * SSE streaming: sends progress lines as they come in.
 */
function handleNegentropySyncStream(req, res) {
  const relay = req.query.relay;
  const dir = req.query.dir || 'down';
  let filter = {};
  try {
    filter = req.query.filter ? JSON.parse(req.query.filter) : {};
  } catch { /* use empty */ }

  if (!relay || !/^wss?:\/\/.+/.test(relay)) {
    return res.status(400).json({ success: false, error: 'Invalid or missing relay URL' });
  }

  if (activeSync) {
    return res.status(409).json({ success: false, error: 'A sync is already in progress' });
  }

  const { cmd, args } = buildCommand(relay, dir, filter);
  const preview = buildPreviewCommand(relay, dir, filter);

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  function send(event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  send('start', { command: preview, startedAt: Date.now() });

  const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  activeSync = {
    relay, dir, filter, preview,
    startedAt: Date.now(),
    pid: proc.pid,
    lines: [],
  };

  function onData(chunk) {
    const lines = chunk.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      activeSync.lines.push(line);
      send('line', { text: line });
    }
  }

  proc.stdout.on('data', onData);
  proc.stderr.on('data', onData);

  const timeout = setTimeout(() => {
    proc.kill('SIGTERM');
  }, 10 * 60 * 1000);

  proc.on('close', (code) => {
    clearTimeout(timeout);
    activeSync = null;
    send('done', { success: code === 0, exitCode: code });
    res.end();
  });

  proc.on('error', (err) => {
    clearTimeout(timeout);
    activeSync = null;
    send('error', { message: err.message });
    res.end();
  });

  // Client disconnect
  req.on('close', () => {
    clearTimeout(timeout);
    // Don't kill the process — let it finish even if the client disconnects
  });
}

/**
 * GET /api/strfry/negentropy-sync/status
 * Returns current sync status (active or idle).
 */
function handleNegentropySyncStatus(req, res) {
  if (!activeSync) {
    return res.json({ success: true, active: false });
  }
  res.json({
    success: true,
    active: true,
    relay: activeSync.relay,
    dir: activeSync.dir,
    command: activeSync.preview,
    startedAt: activeSync.startedAt,
    elapsed: Date.now() - activeSync.startedAt,
    lineCount: activeSync.lines.length,
    recentLines: activeSync.lines.slice(-20),
    // A scheduled preset holding the slot (ADR relay-stream-gaps/0003), so the tab can name it.
    ...(activeSync.source ? { source: activeSync.source, presetName: activeSync.presetName } : {}),
  });
}

/** True while any sync (one-shot or scheduled preset) holds the single slot. */
function isSyncActive() {
  return activeSync !== null;
}

// strfry logs each relay message it doesn't handle, NOTICE and CLOSED included, as
// `WARN| Unexpected message from relay: <json>` and carries on waiting (ADR
// relay-stream-gaps/0003 Amendment 2, Verified evidence 9–10).
const RELAY_MESSAGE_MARK = 'Unexpected message from relay: ';
const RELAY_TEXT_MAX = 300; // the text is the relay's; the cap keeps a long notice out of the presets file

/**
 * The relay's words in one strfry output line (no newline): a NOTICE's text (element 1) or a
 * CLOSED's reason (element 2), else null. When the array doesn't parse or the text isn't a
 * string, the raw text after "relay: ". Cut to 300 characters plus "…".
 */
function relayMessageOf(line) {
  const at = String(line).indexOf(RELAY_MESSAGE_MARK);
  if (at === -1) return null;
  const raw = String(line).slice(at + RELAY_MESSAGE_MARK.length);
  let msg = null;
  try { msg = JSON.parse(raw); } catch { /* the raw text below */ }
  if (Array.isArray(msg) && msg[0] !== 'NOTICE' && msg[0] !== 'CLOSED') return null;
  const text = Array.isArray(msg) ? msg[msg[0] === 'NOTICE' ? 1 : 2] : undefined;
  const said = typeof text === 'string' ? text : raw;
  return said.length > RELAY_TEXT_MAX ? `${said.slice(0, RELAY_TEXT_MAX)}…` : said;
}

/**
 * Run one `strfry sync` in the same single slot as the one-shot handlers, for the
 * negentropy-sync presets runner (ADR relay-stream-gaps/0003). Rejects with
 * { code: 'BUSY' } while the slot is taken; otherwise takes it, spawns buildCommand's
 * argv, kills strfry after timeoutMs (the one-shot's 10 minutes), frees the slot and
 * resolves { exitCode, output, timedOut, stalled } once strfry exits. strfry logs to stderr.
 *
 * stallMs (opt-in, Amendment 2): a relay NOTICE or CLOSED line followed by stallMs with no
 * other line from strfry stops it, since strfry waits for an answer that never comes after a
 * relay refuses negentropy. Lines are read whole, per stream. A repeated notice doesn't push
 * the stop back; any other line is progress and cancels it. Only the first stop is reported.
 */
function runStrfrySync(relay, dir, filter, { timeoutMs = 600000, stallMs = null, presetName = null } = {}) {
  return new Promise((resolve, reject) => {
    if (activeSync) {
      const err = new Error('A sync is already in progress');
      err.code = 'BUSY';
      reject(err);
      return;
    }

    const { cmd, args } = buildCommand(relay, dir, filter);
    const preview = buildPreviewCommand(relay, dir, filter);
    console.log(`[negentropy-sync] Starting preset ${JSON.stringify(presetName)}: ${preview}`);

    let output = '';
    let timedOut = false;
    let stalled = false;
    let stallTimer = null;
    const partial = { stdout: '', stderr: '' }; // each stream's unfinished last line
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const slot = {
      relay, dir, filter, preview,
      startedAt: Date.now(),
      pid: proc.pid,
      lines: [],
      source: 'preset',
      presetName,
    };
    activeSync = slot;

    function onLine(line) {
      if (timedOut || stalled) return;
      if (relayMessageOf(line) === null) {
        clearTimeout(stallTimer);
        stallTimer = null;
      } else if (!stallTimer) {
        stallTimer = setTimeout(() => {
          stalled = true;
          clearTimeout(timeout);
          proc.kill('SIGTERM');
        }, stallMs);
      }
    }

    function onData(stream, chunk) {
      const text = chunk.toString();
      output += text;
      slot.lines.push(...text.split('\n').filter(Boolean));
      if (!stallMs) return;
      const lines = (partial[stream] + text).split('\n');
      partial[stream] = lines.pop();
      for (const line of lines) if (line) onLine(line);
    }
    proc.stdout.on('data', (chunk) => onData('stdout', chunk));
    proc.stderr.on('data', (chunk) => onData('stderr', chunk));

    const timeout = setTimeout(() => {
      timedOut = true;
      clearTimeout(stallTimer);
      proc.kill('SIGTERM');
    }, timeoutMs);

    function release() {
      clearTimeout(timeout);
      clearTimeout(stallTimer);
      if (activeSync === slot) activeSync = null;
    }

    proc.on('close', (code) => {
      release();
      resolve({ exitCode: code, output, timedOut, stalled });
    });

    proc.on('error', (err) => {
      release();
      reject(err);
    });
  });
}

/**
 * NIP-45 COUNT against a remote relay via WebSocket.
 * Returns a promise that resolves to the count (number) or rejects.
 */
function nip45Count(relayUrl, filter, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let ws;
    const timer = setTimeout(() => {
      if (ws) ws.close();
      reject(new Error('NIP-45 COUNT timed out'));
    }, timeoutMs);

    try {
      ws = new WebSocket(relayUrl);
    } catch (err) {
      clearTimeout(timer);
      return reject(err);
    }

    const subId = 'count_' + Math.random().toString(36).slice(2, 10);

    ws.on('open', () => {
      ws.send(JSON.stringify(['COUNT', subId, filter]));
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg[0] === 'COUNT' && msg[1] === subId) {
          clearTimeout(timer);
          ws.close();
          const count = typeof msg[2] === 'object' ? msg[2].count : msg[2];
          resolve(typeof count === 'number' ? count : parseInt(count) || 0);
        } else if (msg[0] === 'NOTICE') {
          // Relay doesn't support NIP-45
          clearTimeout(timer);
          ws.close();
          const notice = msg[1] || '';
          if (notice.toLowerCase().includes('unknown cmd') || notice.toLowerCase().includes('unknown command')) {
            reject(new Error('NIP-45 not supported by this relay (add maxFilterLimitCount to strfry.conf)'));
          } else {
            reject(new Error(`Relay NOTICE: ${notice}`));
          }
        }
      } catch {}
    });

    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    ws.on('close', () => {
      clearTimeout(timer);
    });
  });
}

/**
 * Local count via `strfry scan --count`.
 */
function localStrfryCount(filter) {
  return new Promise((resolve, reject) => {
    const filterStr = JSON.stringify(filter);
    execFile('strfry', ['scan', '--count', filterStr], { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) return reject(err);
      // strfry scan --count outputs a single number
      const count = parseInt(stdout.trim());
      resolve(isNaN(count) ? 0 : count);
    });
  });
}

/**
 * GET /api/strfry/negentropy-sync/count
 * Query params: relay, filter (JSON string)
 * Returns: { local, remote, relay }
 */
async function handleNegentropySyncCount(req, res) {
  const relay = req.query.relay;
  let filter = {};
  try {
    filter = req.query.filter ? JSON.parse(req.query.filter) : {};
  } catch { /* use empty */ }

  if (!relay || !/^wss?:\/\/.+/.test(relay)) {
    return res.json({ success: false, error: 'Invalid or missing relay URL' });
  }

  // Build clean filter object
  const filterObj = buildFilterObj(filter);

  const results = { success: true, relay, filter: filterObj, local: null, remote: null, localError: null, remoteError: null };

  // Run both in parallel
  const [localResult, remoteResult] = await Promise.allSettled([
    localStrfryCount(filterObj),
    nip45Count(relay, filterObj),
  ]);

  if (localResult.status === 'fulfilled') {
    results.local = localResult.value;
  } else {
    results.localError = localResult.reason?.message || 'Unknown error';
  }

  if (remoteResult.status === 'fulfilled') {
    results.remote = remoteResult.value;
  } else {
    results.remoteError = remoteResult.reason?.message || 'Unknown error';
  }

  res.json(results);
}

function registerNegentropySyncRoutes(app) {
  app.post('/api/strfry/negentropy-sync', handleNegentropySync);
  app.get('/api/strfry/negentropy-sync/stream', handleNegentropySyncStream);
  app.get('/api/strfry/negentropy-sync/status', handleNegentropySyncStatus);
  app.get('/api/strfry/negentropy-sync/count', handleNegentropySyncCount);
}

// Pure helpers exported for direct execution by the test runner
// (test/sync-panel-tag-filters.test.js, ADR relay-management/0001).
// isSyncActive/runStrfrySync: the presets runner's way into the one slot
// (negentropyPresets.js, ADR relay-stream-gaps/0003); relayMessageOf: its reading of
// a relay's NOTICE or CLOSED (Amendment 2).
module.exports = { registerNegentropySyncRoutes, buildFilterObj, buildCommand, buildPreviewCommand, isSyncActive, runStrfrySync, relayMessageOf };
