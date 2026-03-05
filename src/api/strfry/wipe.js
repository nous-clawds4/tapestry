/**
 * POST /api/strfry/wipe
 * Deletes all events from the local strfry relay.
 */
const { exec } = require('child_process');

async function handleWipeStrfry(req, res) {
  try {
    // First get the count
    const countResult = await new Promise((resolve, reject) => {
      exec(`strfry scan '{}' | wc -l`, { timeout: 30000 }, (err, stdout) => {
        if (err) reject(err);
        else resolve(parseInt(stdout.trim()) || 0);
      });
    });

    // Use strfry delete with a permissive filter to remove all events
    const result = await new Promise((resolve, reject) => {
      exec(`strfry delete --filter='{}'`, { timeout: 60000 }, (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve(stdout.trim());
      });
    });

    res.json({ success: true, deleted: countResult, detail: result });
  } catch (err) {
    console.error('handleWipeStrfry error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { handleWipeStrfry };
