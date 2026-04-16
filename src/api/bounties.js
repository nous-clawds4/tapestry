const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const {
  createBounty,
  listOpenBounties,
  listAllBounties,
  getBounty,
  bountiesByIssuer,
  markFulfilled,
} = require('../db/bounties');
const { rank } = require('../lib/trust-rank');

const COORDINATE_RE = /^(\d+):([0-9a-f]{64}):(.+)$/;

function requireAuthed(req, res, next) {
  if (!req.session?.authenticated || !req.session?.pubkey) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  next();
}

async function scanStrfry(filter) {
  try {
    const safe = JSON.stringify(filter).replace(/'/g, "'\\''");
    const { stdout } = await execAsync(`strfry scan '${safe}'`, { maxBuffer: 32 * 1024 * 1024 });
    return stdout.trim().split('\n').filter(Boolean).flatMap(line => {
      try { return [JSON.parse(line)]; } catch { return []; }
    });
  } catch (err) {
    console.error('[bounties] strfry scan failed:', err.message);
    return [];
  }
}

function getTag(event, name, index = 1) {
  const tag = event.tags?.find(t => t[0] === name);
  return tag ? tag[index] : null;
}

function parseZapRequestPubkey(receipt) {
  const description = getTag(receipt, 'description');
  if (!description) return null;
  try { return JSON.parse(description).pubkey ?? null; } catch { return null; }
}

async function isBountyFulfilled(bounty) {
  const receipts = await scanStrfry({
    kinds: [9735],
    '#a': [bounty.list_coordinate],
  });
  return receipts.some(r => parseZapRequestPubkey(r) === bounty.issuer_pubkey);
}

function deriveStatus(bounty, { fulfilled = false, now = Math.floor(Date.now() / 1000) } = {}) {
  if (fulfilled) return 'fulfilled';
  if (bounty.expiration && bounty.expiration < now) return 'expired';
  return bounty.status;
}

async function listClaimsFor(bounty, { trustFilter = true } = {}) {
  const items = await scanStrfry({
    kinds: [39999],
    '#z': [bounty.list_coordinate],
    since: bounty.created_at,
  });

  const results = [];
  for (const item of items) {
    if (trustFilter) {
      const r = await rank(bounty.issuer_pubkey, item.pubkey);
      if (r < 2) continue;
    }
    const receipts = await scanStrfry({ kinds: [9735], '#e': [item.id] });
    const zapReceipt = receipts.find(r => parseZapRequestPubkey(r) === bounty.issuer_pubkey) ?? receipts[0] ?? null;
    results.push({ event: item, zapReceipt });
  }
  return results;
}

async function handleCreateBounty(req, res) {
  const { listCoordinate, amountSats, criteria, expiration } = req.body || {};

  if (!listCoordinate || !COORDINATE_RE.test(listCoordinate)) {
    return res.status(400).json({ success: false, error: 'listCoordinate must be <kind>:<pubkey>:<dtag>' });
  }
  const amt = Number(amountSats);
  if (!Number.isInteger(amt) || amt <= 0) {
    return res.status(400).json({ success: false, error: 'amountSats must be a positive integer' });
  }
  if (typeof criteria !== 'string' || !criteria.trim()) {
    return res.status(400).json({ success: false, error: 'criteria is required' });
  }
  let exp = null;
  if (expiration !== undefined && expiration !== null && expiration !== '') {
    exp = Number(expiration);
    if (!Number.isInteger(exp) || exp <= 0) {
      return res.status(400).json({ success: false, error: 'expiration must be a unix timestamp' });
    }
  }

  const row = createBounty({
    issuerPubkey: req.session.pubkey,
    listCoordinate,
    amountSats: amt,
    criteria: criteria.trim(),
    expiration: exp,
  });
  res.json({ success: true, bounty: row });
}

async function handleListBounties(req, res) {
  const statusFilter = (req.query.status || 'open').toLowerCase();
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const rows = statusFilter === 'all' ? listAllBounties({ limit }) : listOpenBounties({ limit });
  const now = Math.floor(Date.now() / 1000);

  const enriched = await Promise.all(rows.map(async b => {
    const fulfilled = await isBountyFulfilled(b);
    return { ...b, derivedStatus: deriveStatus(b, { fulfilled, now }) };
  }));
  res.json({ success: true, bounties: enriched });
}

async function handleEligibleBounties(req, res) {
  const viewer = (req.query.viewer || req.session.pubkey || '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(viewer)) {
    return res.status(400).json({ success: false, error: 'viewer must be a 64-char hex pubkey' });
  }
  if (viewer !== req.session.pubkey) {
    return res.status(403).json({ success: false, error: 'viewer must match session pubkey' });
  }

  const open = listOpenBounties({ limit: 500 });
  const checked = await Promise.all(open.map(async b => {
    const issuerRank = await rank(b.issuer_pubkey, viewer);
    return { bounty: b, issuerRank };
  }));
  const eligible = checked
    .filter(({ issuerRank }) => issuerRank >= 2)
    .map(({ bounty, issuerRank }) => ({ ...bounty, issuerRank }));
  res.json({ success: true, bounties: eligible });
}

async function handleGetBounty(req, res) {
  const b = getBounty(req.params.id);
  if (!b) return res.status(404).json({ success: false, error: 'bounty not found' });

  const fulfilled = await isBountyFulfilled(b);
  if (fulfilled && b.status !== 'fulfilled') markFulfilled(b.id);
  const claims = await listClaimsFor(b, { trustFilter: true });
  res.json({
    success: true,
    bounty: { ...b, derivedStatus: deriveStatus(b, { fulfilled }) },
    claims,
  });
}

async function handlePaymentsDue(req, res) {
  const mine = bountiesByIssuer(req.session.pubkey);
  const open = mine.filter(b => b.status !== 'expired');
  const result = [];
  for (const b of open) {
    const claims = await listClaimsFor(b, { trustFilter: true });
    const pending = claims.filter(c => !c.zapReceipt);
    if (pending.length > 0) result.push({ bounty: b, pendingClaims: pending });
  }
  res.json({ success: true, items: result });
}

function register(app) {
  // Eligible route MUST be registered before GET /:id so Express doesn't treat
  // "eligible" and "mine" as bounty ids.
  app.get('/api/bounties/eligible', requireAuthed, handleEligibleBounties);
  app.get('/api/bounties/mine/payments-due', requireAuthed, handlePaymentsDue);
  app.post('/api/bounties', requireAuthed, handleCreateBounty);
  app.get('/api/bounties', handleListBounties);
  app.get('/api/bounties/:id', handleGetBounty);
}

module.exports = { register };
