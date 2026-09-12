/**
 * POST /api/strfry/wipe
 * Deletes all events from the local strfry relay.
 */
const { exec } = require('child_process');
const { isOwner } = require('../../middleware/auth');

async function handleWipeStrfry(req, res) {
  // Wiping the local relay is a destructive, owner-grade operation. Require the
  // owner OR a genuinely-local operator (req.localTrusted = loopback + no proxy
  // header), mirroring the neo4j/query write-gate and strfry/publish assistant-gate
  // (ADR security-auth-exposure 0001/0002). Default-deny already blocks the
  // unauthenticated case; this also blocks an authenticated non-owner.
  if (!isOwner(req) && !req.localTrusted) {
    return res.status(403).json({ success: false, error: 'Wiping strfry requires owner authentication' });
  }
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
