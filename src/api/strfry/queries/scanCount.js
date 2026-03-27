/**
 * GET /api/strfry/scan/count?filter=<json>
 * Returns just the event count, using `strfry scan --count`.
 * No memory issues regardless of dataset size.
 */
const { exec } = require('child_process');

function handleStrfryScanCount(req, res) {
  const filterParam = req.query.filter || '{}';

  try {
    JSON.parse(filterParam);
  } catch (e) {
    return res.status(400).json({ success: false, error: 'Invalid filter JSON' });
  }

  const safeFilter = filterParam.replace(/'/g, "'\\''");
  const cmd = `strfry scan --count '${safeFilter}' 2>/dev/null`;

  exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
    if (error) {
      console.error('[scan-count] error:', error.message);
      return res.json({ success: false, error: error.message });
    }

    const count = parseInt(stdout.trim(), 10);
    res.json({ success: true, count: isNaN(count) ? 0 : count });
  });
}

module.exports = { handleStrfryScanCount };
