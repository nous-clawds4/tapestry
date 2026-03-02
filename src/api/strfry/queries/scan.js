/**
 * Strfry scan API endpoint.
 * Runs `strfry scan <filter>` and returns parsed JSON events.
 */
const { exec } = require('child_process');

/**
 * GET /api/strfry/scan?filter=<json-filter>
 * Returns { success: true, events: [...] }
 */
function handleStrfryScan(req, res) {
  const filterParam = req.query.filter || '{}';

  // Validate it's valid JSON
  try {
    JSON.parse(filterParam);
  } catch (e) {
    return res.json({ success: false, error: 'Invalid filter JSON' });
  }

  // Escape single quotes in filter for shell safety
  const safeFilter = filterParam.replace(/'/g, "'\\''");
  const cmd = `strfry scan '${safeFilter}'`;

  exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) {
      console.error('strfry scan error:', error.message);
      return res.json({ success: false, error: error.message });
    }

    const events = [];
    const lines = stdout.trim().split('\n');
    for (const line of lines) {
      if (!line) continue;
      try {
        events.push(JSON.parse(line));
      } catch (e) {
        // skip unparseable lines (e.g. strfry log output)
      }
    }

    res.json({ success: true, events, count: events.length });
  });
}

module.exports = { handleStrfryScan };
