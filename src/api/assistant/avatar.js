/**
 * Tapestry Assistant composite avatar — proxy, store, serve.
 *
 * A person's browser composites their own avatar with the brand mark and posts
 * the result here; we store it on the persisted volume and hand back a URL the
 * instance serves. See ADR ta-avatar/0003, and assistant-profile-checklist ADR
 * 0003, which made it every person's: anyone signed in with an Assistant on this
 * instance — the Owner, an Admin, a Customer — stamps their OWN picture for their
 * OWN Assistant.
 *
 * Four things about this module are deliberate and easy to "fix" wrongly:
 *
 *   - The proxy takes NO url and no person from the caller (D2). It reads the
 *     picture URL out of the signed-in person's own kind 0, server-side. An
 *     endpoint that accepted a URL would be a general-purpose arbitrary-fetch
 *     primitive wearing an assistant-shaped hat.
 *   - Every hop of that fetch goes through the SSRF guard (guardedFetch): https
 *     only, to a host that is and resolves to a public address, redirects
 *     re-checked one by one. Once anyone with an Assistant can choose the picture,
 *     a plain fetch would let them aim this instance at its own internals.
 *   - Storing a new composite NEVER deletes an older one (D3). The previously
 *     stored file is the one named by the currently published kind 0, and it
 *     stays published until its person re-publishes. Deleting on regenerate kills
 *     the live profile's picture in the window between generating and
 *     publishing. Old composites are tens of kilobytes; keeping them is the
 *     cheap side of that trade.
 *   - Names carry 32 hex characters of the content's SHA-256. With 8, a person who
 *     could predict another's composite bytes could claim its name first and have
 *     it serve their picture; 128 bits closes that.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { getConfigFromFile } = require('../../utils/config');
const { getInstanceWebsite, isPubliclyReachable } = require('./index');
const { COMPOSITE_AVATAR_FILE_RE } = require('../../lib/assistant-profile-items');

// Composites live on the tapestry-data volume (docker-compose.yml), which
// survives container recreation — a published picture must not die on redeploy.
const GENERATED_DIR = '/var/lib/brainstorm/generated';
const PUBLIC_PREFIX = '/generated';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;   // what we will pull from a remote host
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;   // what we will store
const FETCH_TIMEOUT_MS = 5000;
// Redirects are the one part of this fetch where a THIRD PARTY picks the
// destination, so we follow at most one hop and send it through the same guard
// as the URL the person published (ADR ta-avatar/0003 D2).
const MAX_REDIRECTS = 1;
// The content hash in a stored composite's name (assistant-profile-checklist ADR 0003 sub-decision 5).
const NAME_HASH_HEX = 32;
// New composites one person may store in a rolling day (assistant-profile-checklist ADR 0003 sub-decision 6).
const MAX_NEW_AVATARS_PER_DAY = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

const HEX64 = /^[0-9a-f]{64}$/i;

// The composite source is drawn into a canvas, so raster formats are all we need.
// SVG is excluded deliberately: it can carry script, and this response is served
// from our own origin — echoing `image/svg+xml` back would turn this endpoint into
// a same-origin script-execution vector for anyone who opened it directly.
const ALLOWED_SOURCE_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/avif', 'image/bmp',
]);

// The gate's refusals: a visitor, and someone with no Assistant here.
const NOT_SIGNED_IN = 'Sign in to make a personalized avatar.';
const NO_ASSISTANT = "You don't have a Tapestry Assistant on this instance yet.";

function ensureDir(p) {
  try { fs.mkdirSync(p, { recursive: true }); } catch (_) { /* fall through to the caller's check */ }
}

/**
 * Where composites are written. Falls back to the home directory when the volume
 * path is not available (a dev host, or CI), mirroring
 * src/api/customers/commands/restore-upload.js.
 */
function defaultGeneratedDir() {
  try {
    ensureDir(GENERATED_DIR);
    fs.accessSync(GENERATED_DIR, fs.constants.W_OK);
    return GENERATED_DIR;
  } catch (e) {
    const homeBase = path.join(os.homedir(), 'brainstorm-generated');
    ensureDir(homeBase);
    return homeBase;
  }
}

/**
 * Store a composite PNG under a content-addressed name and return where it lives.
 *
 * Content addressing does two jobs: regenerating produces a genuinely new URL
 * (so no client shows a stale cached avatar), and re-storing identical bytes is
 * a no-op rather than a duplicate.
 *
 * @param {Buffer} buffer  the PNG bytes
 * @param {{ baseDir?: string, allowNew?: () => boolean }} [opts]  directory override, for tests; `allowNew` is asked
 *   only when the name is new, before anything is written — answering false refuses the store (code 'too-many')
 * @returns {{ filename: string, path: string, url: string }}
 * @throws if the bytes are not a PNG, are too large, or `allowNew` refused
 */
function storeCompositeAvatar(buffer, opts = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length < PNG_SIGNATURE.length
      || !buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    // Checked on the bytes, never on a caller-declared mime type: whatever lands
    // in this directory is served publicly.
    throw new Error('composite avatar must be a PNG (magic bytes did not match)');
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error(`composite avatar is ${buffer.length} bytes; the limit is ${MAX_UPLOAD_BYTES}`);
  }

  const dir = opts.baseDir || defaultGeneratedDir();
  ensureDir(dir);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, NAME_HASH_HEX);
  const filename = `ta-avatar-${hash}.png`;
  const target = path.join(dir, filename);

  // Identical bytes → identical name, so an existing file is already correct.
  // Nothing here removes a previously stored composite (D3).
  if (!fs.existsSync(target)) {
    if (typeof opts.allowNew === 'function' && !opts.allowNew()) {
      const err = new Error('Too many new avatars today. Try again tomorrow.');
      err.code = 'too-many';
      throw err;
    }
    fs.writeFileSync(target, buffer);
  }

  const website = getInstanceWebsite();
  return {
    filename,
    path: `${PUBLIC_PREFIX}/${filename}`,
    // Only offer a publishable absolute URL when a stranger could actually fetch
    // it — the same rule story 2 applies to the branded default (ADR 0003 D4).
    url: isPubliclyReachable(website) ? `${website}${PUBLIC_PREFIX}/${filename}` : '',
  };
}

/**
 * Does this instance still hold the composite named `file`? Only a bare composite file name is ever looked up — a path,
 * or any other name, is false (assistant-profile-checklist ADR 0001 sub-decision 5).
 * @param {string} file
 * @param {{ baseDir?: string }} [opts]  directory override, for tests
 */
function hasStoredAvatar(file, opts = {}) {
  if (typeof file !== 'string' || !COMPOSITE_AVATAR_FILE_RE.test(file)) return false;
  try {
    return fs.statSync(path.join(opts.baseDir || defaultGeneratedDir(), file)).isFile();
  } catch {
    return false;
  }
}

// ─── Whose avatar: the gate ─────────────────────────────────────────────────────

/**
 * The gate both routes share (assistant-profile-checklist ADR 0003 sub-decision 1): a signed-in person (a 64-hex
 * session pubkey) with an Assistant on this instance, named on the request as req.avatarPerson; the in-container
 * operator (req.localTrusted, no session) acts as the Owner. Anyone else is refused before anything is fetched,
 * parsed or stored — which is why it runs ahead of the upload's multer.
 *
 * @param {{ getAssistantPubkeyFor?: Function, getOwnerPubkey?: Function }} [deps]
 */
function createRequireOwnAssistant(deps = {}) {
  const d = {
    getAssistantPubkeyFor: (pubkey) => require('../../utils/assistantKeys').getAssistantPubkeyFor(pubkey),
    getOwnerPubkey: () => getConfigFromFile('BRAINSTORM_OWNER_PUBKEY'),
    ...deps,
  };
  return async function requireOwnAssistant(req, res, next) {
    const session = req && req.session;
    let person = session && session.authenticated === true && typeof session.pubkey === 'string' && HEX64.test(session.pubkey)
      ? session.pubkey.toLowerCase()
      : null;
    if (!person && req && req.localTrusted === true) {
      const owner = d.getOwnerPubkey();
      if (typeof owner === 'string' && HEX64.test(owner)) person = owner.toLowerCase();
    }
    if (!person) return res.status(401).json({ success: false, code: 'not-signed-in', error: NOT_SIGNED_IN });

    let assistant;
    try {
      assistant = await d.getAssistantPubkeyFor(person);
    } catch (err) {
      console.error('[assistant/avatar] could not look up the assistant:', err && err.message ? err.message : err);
      return res.status(500).json({ success: false, error: 'Could not look up your Tapestry Assistant.' });
    }
    if (typeof assistant !== 'string' || !HEX64.test(assistant)) {
      return res.status(403).json({ success: false, code: 'no-assistant', error: NO_ASSISTANT });
    }
    req.avatarPerson = person;
    return next();
  };
}

const requireOwnAssistant = createRequireOwnAssistant();

// ─── The picture proxy ──────────────────────────────────────────────────────────

const lower = (s) => String(s || '').toLowerCase();

function newestKind0(events, pubkey) {
  let best = null;
  for (const e of Array.isArray(events) ? events : []) {
    if (!e || e.kind !== 0 || lower(e.pubkey) !== lower(pubkey)) continue;
    if (!best || (e.created_at || 0) > (best.created_at || 0)) best = e;
  }
  return best;
}

/**
 * The `picture` on `pubkey`'s own newest kind 0: this instance's relay first; only when it holds no kind 0 by them,
 * the relays this instance reads profiles from. Nothing is copied home — the person's profile is their letter, not
 * this instance's (resolvePersonName's rule). No caller input but the pubkey the gate named.
 * @returns {Promise<string|null>}
 */
async function getPersonPictureUrl(pubkey, deps = {}) {
  const d = {
    scanLocalKind0: (pk) => require('./profileState').scanLocalKind0(pk),
    queryRelaysKind0: (relays, pk, options) => require('./profileState').queryRelaysKind0(relays, pk, options),
    getProfileRelays: () => require('./profilePublish').readConfiguredRelays(['aProfileRelays']),
    ...deps,
  };
  let local = null;
  try { local = await d.scanLocalKind0(pubkey); } catch { local = null; }
  let event = newestKind0(local ? [local] : [], pubkey);
  if (!event) {
    const { RELAY_BUDGET_MS, BACKSTOP_MS, withinBudget } = require('./profileState');
    let found = [];
    try {
      found = await withinBudget(
        Promise.resolve().then(() => d.queryRelaysKind0(d.getProfileRelays(), pubkey, { maxWait: RELAY_BUDGET_MS })),
        BACKSTOP_MS,
        [],
      );
    } catch {
      found = [];
    }
    event = newestKind0(found, pubkey);
  }
  if (!event) return null;
  try {
    const content = JSON.parse(event.content);
    const picture = content && typeof content.picture === 'string' ? content.picture.trim() : '';
    return picture || null;
  } catch {
    return null;
  }
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
function isRedirect(status) { return REDIRECT_STATUSES.has(status); }

/**
 * Read at most `limit` bytes from a fetch response.
 * A chunked response declares no content-length, so the body itself is bounded
 * rather than trusting the header.
 */
async function readBounded(resp, limit) {
  const declared = Number(resp.headers.get('content-length') || 0);
  if (declared && declared > limit) return null;
  const chunks = [];
  let total = 0;
  if (!resp.body) return Buffer.alloc(0);
  for await (const chunk of resp.body) {
    total += chunk.length;
    if (total > limit) return null;
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * GET /api/assistant/my-picture  (behind requireOwnAssistant)
 *
 * Streams the signed-in person's own profile picture back same-origin, so their
 * browser can draw it into a canvas without tainting it. It was the Owner's
 * /api/assistant/owner-avatar (ADR ta-avatar/0003); every person's since
 * assistant-profile-checklist ADR 0003. Failures carry a code the page words:
 * no-picture, unfetchable, not-stampable.
 *
 * @param {Object} [deps]  injectable: getPersonPictureUrl, guardedFetch (Express's `next` is ignored)
 */
async function handleMyPicture(req, res, deps = {}) {
  const d = {
    getPersonPictureUrl: (pubkey) => getPersonPictureUrl(pubkey),
    guardedFetch: (url, options) => require('../../utils/ssrfGuard').guardedFetch(url, options),
    ...(deps && typeof deps === 'object' ? deps : {}),
  };
  const fail = (status, code, error) => res.status(status).json({ success: false, code, error });
  const person = req && req.avatarPerson;
  if (!person) return fail(401, 'not-signed-in', NOT_SIGNED_IN);

  try {
    // Provenance matters here: the URL comes from the person's own kind 0, never
    // from the request (D2).
    const pictureUrl = await d.getPersonPictureUrl(person);
    if (!pictureUrl) {
      // Not an error: the branded-fallback path the editor offers.
      return fail(404, 'no-picture', 'Your nostr profile has no picture');
    }

    // At most one redirect, and the hop goes through the guard exactly as the first
    // URL does — otherwise the far-end host, not the person, chooses what we fetch.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let upstream = null;
    let current = pictureUrl;
    try {
      for (let hop = 0; ; hop += 1) {
        let resp;
        try {
          resp = await d.guardedFetch(current, { signal: controller.signal, headers: { accept: 'image/*' } });
        } catch (err) {
          return fail(404, 'unfetchable', `The picture host could not be reached: ${err && err.message ? err.message : err}`);
        }
        if (!resp) return fail(404, 'unfetchable', 'The picture is not at an https address on the public internet');
        if (!isRedirect(resp.status)) { upstream = resp; break; }
        if (hop >= MAX_REDIRECTS) return fail(404, 'unfetchable', 'The picture host redirected too many times');
        try {
          current = new URL(resp.headers.get('location') || '', current).toString();
        } catch {
          return fail(404, 'unfetchable', 'The picture host redirected somewhere unfetchable');
        }
      }
    } finally {
      clearTimeout(timer);
    }
    if (!upstream.ok) return fail(404, 'unfetchable', `The picture host answered ${upstream.status}`);

    const type = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_SOURCE_TYPES.has(type)) {
      return fail(404, 'not-stampable', `The picture is ${type || 'untyped'}, which cannot be stamped`);
    }

    const body = await readBounded(upstream, MAX_SOURCE_BYTES);
    if (!body) return fail(404, 'not-stampable', 'The picture is too large to stamp');

    res.set('Content-Type', type);
    res.set('Cache-Control', 'no-store');
    return res.send(body);
  } catch (err) {
    return fail(404, 'unfetchable', `Could not retrieve the picture: ${err && err.message ? err.message : err}`);
  }
}

// ─── The store ──────────────────────────────────────────────────────────────────

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
}).single('avatar');

// person → the times of their recent new composites (in memory; it resets on a restart, ADR 0003 sub-decision 6).
const newAvatarTimes = new Map();

/** May `person` store one more new composite at `now`? Records it when yes. */
function admitNewAvatar(person, now) {
  const recent = (newAvatarTimes.get(person) || []).filter((t) => now - t < DAY_MS);
  if (recent.length >= MAX_NEW_AVATARS_PER_DAY) {
    newAvatarTimes.set(person, recent);
    return false;
  }
  recent.push(now);
  newAvatarTimes.set(person, recent);
  return true;
}

/**
 * POST /api/assistant/avatar  (multipart, field `avatar`; behind requireOwnAssistant, then multer)
 *
 * Stores the composite the person's browser produced. At most MAX_NEW_AVATARS_PER_DAY new files per person; storing
 * bytes already there writes nothing and is not counted.
 *
 * @param {Object} [deps]  for tests: { baseDir, now } (Express's `next` is ignored)
 */
async function handleUploadAvatar(req, res, deps = {}) {
  const d = deps && typeof deps === 'object' ? deps : {};
  const person = req && req.avatarPerson;
  if (!person) return res.status(401).json({ success: false, code: 'not-signed-in', error: NOT_SIGNED_IN });
  try {
    const buffer = req.file && req.file.buffer;
    if (!buffer) {
      return res.status(400).json({ success: false, error: 'No avatar file was uploaded' });
    }
    const now = typeof d.now === 'function' ? d.now() : Date.now();
    const stored = storeCompositeAvatar(buffer, { baseDir: d.baseDir, allowNew: () => admitNewAvatar(person, now) });
    return res.json({ success: true, ...stored });
  } catch (err) {
    if (err && err.code === 'too-many') {
      return res.status(429).json({ success: false, code: 'too-many', error: err.message });
    }
    return res.status(400).json({ success: false, error: err.message });
  }
}

module.exports = {
  storeCompositeAvatar,
  hasStoredAvatar,
  createRequireOwnAssistant,
  requireOwnAssistant,
  getPersonPictureUrl,
  handleMyPicture,
  handleUploadAvatar,
  uploadMiddleware,
  GENERATED_DIR,
  PUBLIC_PREFIX,
  MAX_NEW_AVATARS_PER_DAY,
};
