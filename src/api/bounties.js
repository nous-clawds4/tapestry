const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const {
  createBounty,
  listOpenBounties,
  listAllBounties,
  getBounty,
  bountiesByIssuer,
  bountiesByListCoordinates,
  markFulfilled,
} = require('../db/bounties');
const { rank } = require('../lib/trust-rank');
const { normalizeBountyCreatePayload } = require('../lib/bounty-fields');

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
  let payload;
  try {
    payload = normalizeBountyCreatePayload(req.body || {});
  } catch (err) {
    return res.status(err.statusCode || 400).json({ success: false, error: err.message });
  }

  const row = createBounty({
    issuerPubkey: req.session.pubkey,
    ...payload,
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

async function handlePaymentsToMe(req, res) {
  const me = req.session.pubkey.toLowerCase();
  const empty = { success: true, pastDue: [], pending: [], paid: [], closed: [] };

  const allBounties = listAllBounties({ limit: 500 });
  if (!allBounties.length) return res.json(empty);

  const coords = [...new Set(allBounties.map(b => b.list_coordinate))];
  const sinceTs = Math.min(...allBounties.map(b => b.created_at));

  const myClaims = await scanStrfry({
    kinds: [39999],
    authors: [me],
    '#z': coords,
    since: sinceTs,
  });
  if (!myClaims.length) return res.json(empty);

  const claimsByCoord = new Map();
  for (const ev of myClaims) {
    const z = getTag(ev, 'z');
    if (!z) continue;
    let bucket = claimsByCoord.get(z);
    if (!bucket) {
      bucket = [];
      claimsByCoord.set(z, bucket);
    }
    bucket.push(ev);
  }
  if (!claimsByCoord.size) return res.json(empty);

  const candidatePairs = [];
  for (const bounty of allBounties) {
    if (bounty.issuer_pubkey.toLowerCase() === me) continue;
    const claims = claimsByCoord.get(bounty.list_coordinate);
    if (!claims) continue;
    for (const claim of claims) {
      if (claim.created_at < bounty.created_at) continue;
      candidatePairs.push({ bounty, claim });
    }
  }
  if (!candidatePairs.length) return res.json(empty);

  const ranks = await Promise.all(
    candidatePairs.map(p => rank(p.bounty.issuer_pubkey, me))
  );
  const trustedPairs = candidatePairs.filter((_, i) => ranks[i] >= 2);
  if (!trustedPairs.length) return res.json(empty);

  // Per-claim receipt scans + per-bounty fulfilled checks. We need both: the
  // per-claim receipt tells us if THIS user got paid; isBountyFulfilled tells
  // us if SOME OTHER claim was paid (so the bounty is closed, not pending).
  const uniqueBountiesById = new Map();
  for (const p of trustedPairs) uniqueBountiesById.set(p.bounty.id, p.bounty);
  const uniqueBounties = [...uniqueBountiesById.values()];

  const [receiptResults, fulfilledChecks] = await Promise.all([
    Promise.all(trustedPairs.map(p => scanStrfry({ kinds: [9735], '#e': [p.claim.id] }))),
    Promise.all(uniqueBounties.map(b => isBountyFulfilled(b))),
  ]);
  const fulfilledByBountyId = new Map(uniqueBounties.map((b, i) => [b.id, fulfilledChecks[i]]));

  const now = Math.floor(Date.now() / 1000);
  const pastDue = [];
  const pending = [];
  const paid = [];
  const closed = [];

  for (let i = 0; i < trustedPairs.length; i++) {
    const { bounty, claim } = trustedPairs[i];
    const receipts = receiptResults[i];
    const zap = receipts.find(r => parseZapRequestPubkey(r) === bounty.issuer_pubkey) ?? null;
    const ds = deriveStatus(bounty, { fulfilled: fulfilledByBountyId.get(bounty.id), now });
    const row = { bounty, claim: { event: claim, zapReceipt: zap } };

    if (zap) paid.push(row);
    else if (ds === 'fulfilled') closed.push(row);
    else if (ds === 'expired') pastDue.push(row);
    else pending.push(row);
  }

  const byClaimAgeDesc = (a, b) => b.claim.event.created_at - a.claim.event.created_at;
  pastDue.sort(byClaimAgeDesc);
  pending.sort(byClaimAgeDesc);
  paid.sort(byClaimAgeDesc);
  closed.sort(byClaimAgeDesc);

  res.json({ success: true, pastDue, pending, paid, closed });
}

function register(app) {
  // Eligible route MUST be registered before GET /:id so Express doesn't treat
  // "eligible" and "mine" as bounty ids.
  app.get('/api/bounties/eligible', requireAuthed, handleEligibleBounties);
  app.get('/api/bounties/mine/payments-due', requireAuthed, handlePaymentsDue);
  app.get('/api/bounties/mine/payments-to-me', requireAuthed, handlePaymentsToMe);
  app.post('/api/bounties', requireAuthed, handleCreateBounty);
  app.get('/api/bounties', handleListBounties);
  app.get('/api/bounties/:id', handleGetBounty);
}

module.exports = { register };
