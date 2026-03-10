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

function buildFilterObj(filter) {
  const filterObj = {};
  if (filter.kinds && filter.kinds.length > 0) filterObj.kinds = filter.kinds;
  if (filter.authors && filter.authors.length > 0) filterObj.authors = filter.authors;
  if (filter.since != null) filterObj.since = filter.since;
  if (filter.until != null) filterObj.until = filter.until;
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

module.exports = { registerNegentropySyncRoutes };
