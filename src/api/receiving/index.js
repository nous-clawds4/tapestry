/**
 * Receiving-method setup API (Magic Carpet v2) — LNURL-only.
 *
 *   GET  /api/receiving/options          public  → the wallet catalog (WALLET_OPTIONS)
 *   POST /api/receiving/probe     (auth)         → verify a lud16 / LNURL is reachable
 *                                                  and allows Nostr zaps, behind the SSRF guard
 *   POST /api/receiving/build     (auth)         → merge the chosen method into the SESSION
 *                                                  user's own kind-0 (REPLACE semantics) and
 *                                                  return the unsigned content to sign + publish
 *   GET  /api/receiving/show/:pubkey     public  → resolve the ACTIVE receiving method for any
 *                                                  pubkey (newest kind-0 across local strfry +
 *                                                  profile relays) — no LNURL fetch. HTTP twin of
 *                                                  `receiving show` (bin/receiving.js).
 *   GET  /api/receiving/resolve/:pubkey  (auth)  → run the issuer-side payout decision headlessly
 *                                                  (BOLT11-via-LNURL, tracked iff the LNURL allows
 *                                                  Nostr zaps), behind the SSRF guard. HTTP twin of
 *                                                  `receiving resolve` (bin/receiving.js). Optional
 *                                                  `?amount=<sats>` is informational only.
 *
 * The browser signs the returned `content` with window.nostr and publishes it
 * via the existing POST /api/strfry/publish (signAs: client) — the same path the
 * old Bolt12Setup widget used, so kind-0 relay fan-out + profile-cache busting
 * already work. The build endpoint never trusts a client-supplied pubkey: it
 * resolves and merges the session user's own profile.
 *
 * /show is public — a kind-0 profile is public relay data anyway, and it never
 * performs an LNURL fetch. /resolve requires auth because it does perform one
 * (SSRF surface, same reasoning as /probe) and goes through the same
 * checkReceivingTarget guard before probing.
 */

const { WALLET_OPTIONS, getOption } = require('../../lib/receiving/walletOptions');
const { buildReceivingContent } = require('../../lib/receiving/mergeKind0');
const { probeReceiving, trackedVerdict } = require('../../lib/receiving/probe');
const { resolveProfile } = require('../../lib/receiving/resolveProfile');
const { resolveReceivingMethod, resolvePayment } = require('../../lib/receiving/resolveMethod');
const { checkReceivingTarget } = require('./ssrfGuard');

const PUBKEY_RE = /^[0-9a-f]{64}$/i;

function requireAuthed(req, res, next) {
  if (!req.session?.authenticated || !req.session?.pubkey) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  next();
}

/** Lowercase + validate a :pubkey route param. Returns 64-char lowercase hex, or null. */
function normalizePubkeyParam(raw) {
  const s = String(raw || '');
  return PUBKEY_RE.test(s) ? s.toLowerCase() : null;
}

/** Shape a raw probe result into the whitelisted fields we ever return — never the raw LNURL body. */
function shapeProbe(probe) {
  return {
    ok: !!probe.ok,
    reachable: !!probe.reachable,
    allowsNostr: probe.allowsNostr ?? null,
    minSendable: probe.minSendable ?? null,
    maxSendable: probe.maxSendable ?? null,
    error: probe.error ?? null,
  };
}

/**
 * Pure shaping for GET /show: given a resolveProfile() result, build the
 * response body, or null if no kind-0 profile was found on any relay (→ 404).
 * Deliberately excludes the raw profile content — only receiving-relevant
 * fields (via resolveReceivingMethod) plus createdAt/source/sources.
 */
function shapeShowResponse(pubkeyHex, resolved) {
  if (!resolved || !resolved.profile) return null;
  const method = resolveReceivingMethod(resolved.profile);
  return {
    success: true,
    pubkey: pubkeyHex,
    method,
    source: resolved.source,
    createdAt: resolved.createdAt,
    sources: resolved.sources,
  };
}

/**
 * Pure shaping for GET /resolve: derive the payout decision from a
 * resolveProfile() result, and report whether an LNURL probe is needed
 * (bolt11-via-lud16/lnurl) plus the target to probe.
 */
function shapePayout(resolved) {
  const payment = resolvePayment(resolved ? resolved.profile : null);
  const payTarget = payment.lud16 || payment.source;
  const needsProbe = payment.type === 'bolt11' && !!payTarget;
  return { payment, payTarget, needsProbe };
}

/** Apply a probe's tracked verdict onto a payment decision (mutates + returns it). */
function applyProbeVerdict(payment, probe) {
  const verdict = trackedVerdict(probe);
  payment.tracked = verdict.tracked;
  payment.probeNote = verdict.note;
  if (verdict.tracked !== true) payment.payable = false;
  return payment;
}

function handleGetOptions(req, res) {
  res.json({ success: true, options: WALLET_OPTIONS });
}

async function handleProbe(req, res) {
  const value = typeof req.body?.value === 'string' ? req.body.value.trim() : '';
  if (!value) return res.status(400).json({ success: false, error: 'value is required' });

  const allowInsecureLocalhost = process.env.NODE_ENV !== 'production';

  const guard = await checkReceivingTarget(value);
  if (!guard.ok) {
    return res.status(guard.status || 400).json({ success: false, error: guard.error });
  }

  const probe = await probeReceiving(value, { allowInsecureLocalhost });
  const verdict = trackedVerdict(probe);

  // Return only parsed fields — never the raw LNURL response body.
  res.json({
    success: true,
    probe: shapeProbe(probe),
    verdict,
  });
}

/**
 * GET /api/receiving/show/:pubkey (public) — resolve the ACTIVE receiving
 * method for any pubkey, newest kind-0 across local strfry + profile relays.
 * No LNURL fetch (no SSRF surface) — HTTP twin of `receiving show`.
 */
async function handleShow(req, res) {
  const pubkeyHex = normalizePubkeyParam(req.params.pubkey);
  if (!pubkeyHex) {
    return res.status(400).json({ success: false, error: 'pubkey must be 64 hex characters' });
  }

  let resolved;
  try {
    resolved = await resolveProfile(pubkeyHex);
  } catch (err) {
    console.warn('[receiving] resolveProfile failed:', err.message);
    return res.status(502).json({ success: false, error: 'profile resolution failed' });
  }

  const body = shapeShowResponse(pubkeyHex, resolved);
  if (!body) return res.status(404).json({ success: false, error: 'profile not found' });
  res.json(body);
}

/**
 * GET /api/receiving/resolve/:pubkey (auth) — run the issuer-side payout
 * decision headlessly: BOLT11-via-LNURL, tracked iff the LNURL allows Nostr
 * zaps. Behind the SSRF guard, same as /probe — HTTP twin of `receiving
 * resolve`. Optional `?amount=<sats>` is informational only.
 */
async function handleResolve(req, res) {
  const pubkeyHex = normalizePubkeyParam(req.params.pubkey);
  if (!pubkeyHex) {
    return res.status(400).json({ success: false, error: 'pubkey must be 64 hex characters' });
  }

  let resolved;
  try {
    resolved = await resolveProfile(pubkeyHex);
  } catch (err) {
    console.warn('[receiving] resolveProfile failed:', err.message);
    return res.status(502).json({ success: false, error: 'profile resolution failed' });
  }

  let amount = null;
  if (req.query.amount !== undefined) {
    amount = Number(req.query.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ success: false, error: 'amount must be a non-negative number' });
    }
  }
  const { payment, payTarget, needsProbe } = shapePayout(resolved);

  let probeSummary = null;
  if (needsProbe) {
    const guard = await checkReceivingTarget(payTarget);
    if (!guard.ok) {
      return res.status(guard.status || 400).json({ success: false, error: guard.error });
    }

    const allowInsecureLocalhost = process.env.NODE_ENV !== 'production';
    const probe = await probeReceiving(payTarget, { allowInsecureLocalhost });
    applyProbeVerdict(payment, probe);
    probeSummary = shapeProbe(probe);
  }

  res.json({
    success: true,
    pubkey: pubkeyHex,
    amount,
    payment,
    probe: probeSummary,
    source: resolved.source,
  });
}

async function handleBuild(req, res) {
  const method = typeof req.body?.method === 'string' ? req.body.method : '';
  const value = typeof req.body?.value === 'string' ? req.body.value : undefined;
  if (!method) return res.status(400).json({ success: false, error: 'method is required' });
  if (!getOption(method)) {
    return res.status(400).json({ success: false, error: `Unknown receiving method: ${method}` });
  }

  const pubkeyHex = String(req.session.pubkey).toLowerCase();

  // Merge into the user's CURRENT profile (newest across local strfry + profile
  // relays) so we never drop name/about/picture and REPLACE semantics can clear
  // any stale receiving fields (incl. a legacy bolt12).
  let profile = null;
  try {
    const resolved = await resolveProfile(pubkeyHex);
    profile = resolved.profile;
  } catch (err) {
    // Non-fatal: first-time setup or a relay miss → merge into an empty profile.
    console.warn('[receiving] resolveProfile failed, merging into empty profile:', err.message);
  }

  let built;
  try {
    built = buildReceivingContent({ profile, method, value, pubkeyHex });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }

  res.json({
    success: true,
    content: built.content,
    field: built.field,
    value: built.value,
    cleared: built.cleared,
    replaced: built.replaced,
  });
}

function register(app) {
  app.get('/api/receiving/options', handleGetOptions);
  app.post('/api/receiving/probe', requireAuthed, handleProbe);
  app.post('/api/receiving/build', requireAuthed, handleBuild);
  app.get('/api/receiving/show/:pubkey', handleShow);
  app.get('/api/receiving/resolve/:pubkey', requireAuthed, handleResolve);
}

module.exports = {
  register,
  handleGetOptions,
  handleProbe,
  handleBuild,
  handleShow,
  handleResolve,
  normalizePubkeyParam,
  shapeProbe,
  shapeShowResponse,
  shapePayout,
  applyProbeVerdict,
};
