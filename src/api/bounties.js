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
const { normalizeBountyCreatePayload } = require('../lib/bounty-fields');
const {
  annotateClaimsWithPaymentState,
  calculateBountyPaymentState,
  canAcceptNewClaimFrom,
  publicPaymentState,
} = require('../lib/bounty-policy');

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

function deriveStatus(bounty, { paymentState = null, now = Math.floor(Date.now() / 1000) } = {}) {
  if (paymentState?.fulfilled) return 'fulfilled';
  if (bounty.expiration && bounty.expiration < now) return 'expired';
  return bounty.status;
}

function bountyForClient(bounty, paymentState, { now = Math.floor(Date.now() / 1000), extra = {} } = {}) {
  const derivedStatus = deriveStatus(bounty, { paymentState, now });
  return {
    ...bounty,
    ...extra,
    derivedStatus,
    paymentState: publicPaymentState(paymentState),
  };
}

async function paymentStateForBounty(bounty, options = {}) {
  const claims = await listClaimsFor(bounty, options);
  return {
    claims,
    paymentState: calculateBountyPaymentState(bounty, claims),
  };
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
    const zapReceipt = receipts.find(r => parseZapRequestPubkey(r) === bounty.issuer_pubkey) ?? null;
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
    const { paymentState } = await paymentStateForBounty(b, { trustFilter: true });
    const derivedStatus = deriveStatus(b, { paymentState, now });
    if (derivedStatus === 'fulfilled' && b.status !== 'fulfilled') markFulfilled(b.id);
    return bountyForClient(b, paymentState, { now });
  }));
  const filtered = statusFilter === 'open'
    ? enriched.filter(b => b.derivedStatus === 'open')
    : enriched;
  res.json({ success: true, bounties: filtered });
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
  const now = Math.floor(Date.now() / 1000);
  const checked = await Promise.all(open.map(async b => {
    const issuerRank = await rank(b.issuer_pubkey, viewer);
    if (issuerRank < 2) return null;
    const { paymentState } = await paymentStateForBounty(b, { trustFilter: true });
    const bounty = bountyForClient(b, paymentState, { now, extra: { issuerRank } });
    if (bounty.derivedStatus === 'fulfilled' && b.status !== 'fulfilled') markFulfilled(b.id);
    return {
      bounty,
      canClaim: bounty.derivedStatus === 'open' && canAcceptNewClaimFrom(paymentState, viewer),
    };
  }));
  const eligible = checked
    .filter(result => result?.canClaim)
    .map(({ bounty }) => bounty);
  res.json({ success: true, bounties: eligible });
}

async function handleGetBounty(req, res) {
  const b = getBounty(req.params.id);
  if (!b) return res.status(404).json({ success: false, error: 'bounty not found' });

  const { claims, paymentState } = await paymentStateForBounty(b, { trustFilter: true });
  const derivedStatus = deriveStatus(b, { paymentState });
  if (derivedStatus === 'fulfilled' && b.status !== 'fulfilled') markFulfilled(b.id);
  res.json({
    success: true,
    bounty: bountyForClient(b, paymentState),
    claims: annotateClaimsWithPaymentState(claims, paymentState),
  });
}

async function handlePaymentsDue(req, res) {
  const mine = bountiesByIssuer(req.session.pubkey);
  const now = Math.floor(Date.now() / 1000);
  const result = [];
  for (const b of mine) {
    const { paymentState } = await paymentStateForBounty(b, { trustFilter: true });
    const derivedStatus = deriveStatus(b, { paymentState, now });
    if (derivedStatus === 'fulfilled' && b.status !== 'fulfilled') markFulfilled(b.id);
    if (derivedStatus !== 'open') continue;
    const pending = paymentState.payableClaims;
    if (pending.length > 0) {
      result.push({ bounty: bountyForClient(b, paymentState, { now }), pendingClaims: pending });
    }
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

  const uniqueBountiesById = new Map();
  for (const p of trustedPairs) uniqueBountiesById.set(p.bounty.id, p.bounty);
  const uniqueBounties = [...uniqueBountiesById.values()];

  const now = Math.floor(Date.now() / 1000);
  const bountyStateEntries = await Promise.all(uniqueBounties.map(async bounty => {
    const { claims, paymentState } = await paymentStateForBounty(bounty, { trustFilter: true });
    const derivedStatus = deriveStatus(bounty, { paymentState, now });
    if (derivedStatus === 'fulfilled' && bounty.status !== 'fulfilled') markFulfilled(bounty.id);
    const annotatedClaims = annotateClaimsWithPaymentState(claims, paymentState);
    return [bounty.id, {
      bounty: bountyForClient(bounty, paymentState, { now }),
      claimsById: new Map(annotatedClaims.map(claim => [claim.event.id, claim])),
    }];
  }));
  const bountyStates = new Map(bountyStateEntries);

  const pastDue = [];
  const pending = [];
  const paid = [];
  const closed = [];

  for (const { bounty, claim } of trustedPairs) {
    const state = bountyStates.get(bounty.id);
    if (!state) continue;
    const annotatedClaim = state.claimsById.get(claim.id) ?? {
      event: claim,
      zapReceipt: null,
      paymentStatus: 'closed',
      closedReason: 'cap',
    };
    const row = { bounty: state.bounty, claim: annotatedClaim };

    if (annotatedClaim.zapReceipt || annotatedClaim.paymentStatus === 'paid') paid.push(row);
    else if (state.bounty.derivedStatus === 'expired') pastDue.push(row);
    else if (annotatedClaim.paymentStatus === 'payable') pending.push(row);
    else closed.push(row);
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
