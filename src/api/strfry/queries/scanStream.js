/**
 * Streaming strfry scan endpoint.
 * GET /api/strfry/scan/stream?filter=<json>
 *
 * Streams JSONL (one event per line) directly from `strfry scan` stdout,
 * with no buffering in Node memory. Works with millions of events.
 */
const { spawn } = require('child_process');

function handleStrfryScanStream(req, res) {
  const filterParam = req.query.filter || '{}';

  try {
    JSON.parse(filterParam);
  } catch (e) {
    return res.status(400).json({ success: false, error: 'Invalid filter JSON' });
  }

  const safeFilter = filterParam.replace(/'/g, "'\\''");

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Transfer-Encoding', 'chunked');

  const proc = spawn('strfry', ['scan', safeFilter], {
    stdio: ['ignore', 'pipe', 'ignore'], // ignore stderr (verbose logs)
  });

  proc.stdout.pipe(res);

  proc.on('error', (err) => {
    console.error('[scan-stream] spawn error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.end();
    }
  });

  proc.on('close', (code) => {
    if (code !== 0) {
      console.error(`[scan-stream] strfry scan exited with code ${code}`);
    }
    res.end();
  });

  // If client disconnects, kill the process
  req.on('close', () => {
    proc.kill('SIGTERM');
  });
}

module.exports = { handleStrfryScanStream };
