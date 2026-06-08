/**
 * Receiving-method setup API (Magic Carpet v2) — LNURL-only.
 *
 *   GET  /api/receiving/options        public  → the wallet catalog (WALLET_OPTIONS)
 *   POST /api/receiving/probe   (auth)         → verify a lud16 / LNURL is reachable
 *                                                and allows Nostr zaps, behind the SSRF guard
 *   POST /api/receiving/build   (auth)         → merge the chosen method into the SESSION
 *                                                user's own kind-0 (REPLACE semantics) and
 *                                                return the unsigned content to sign + publish
 *
 * The browser signs the returned `content` with window.nostr and publishes it
 * via the existing POST /api/strfry/publish (signAs: client) — the same path the
 * old Bolt12Setup widget used, so kind-0 relay fan-out + profile-cache busting
 * already work. The build endpoint never trusts a client-supplied pubkey: it
 * resolves and merges the session user's own profile.
 */

const { WALLET_OPTIONS, getOption } = require('../../lib/receiving/walletOptions');
const { buildReceivingContent } = require('../../lib/receiving/mergeKind0');
const { probeReceiving, trackedVerdict } = require('../../lib/receiving/probe');
const { resolveProfile } = require('../../lib/receiving/resolveProfile');
const { checkReceivingTarget } = require('./ssrfGuard');

function requireAuthed(req, res, next) {
  if (!req.session?.authenticated || !req.session?.pubkey) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  next();
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
    probe: {
      ok: !!probe.ok,
      reachable: !!probe.reachable,
      allowsNostr: probe.allowsNostr ?? null,
      minSendable: probe.minSendable ?? null,
      maxSendable: probe.maxSendable ?? null,
      error: probe.error ?? null,
    },
    verdict,
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
}

module.exports = { register, handleGetOptions, handleProbe, handleBuild };
