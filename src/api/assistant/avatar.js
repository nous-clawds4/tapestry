/**
 * Tapestry Assistant composite avatar — proxy, store, serve.
 *
 * The owner's browser composites their own avatar with the brand mark and posts
 * the result here; we store it on the persisted volume and hand back a URL the
 * instance serves. See ADR ta-avatar/0003.
 *
 * Two things about this module are deliberate and easy to "fix" wrongly:
 *
 *   - The proxy takes NO url from the caller (D2). It reads the picture URL out
 *     of the owner's own kind 0, server-side. An endpoint that accepted a URL
 *     would be a general-purpose arbitrary-fetch primitive wearing an
 *     assistant-shaped hat.
 *   - Storing a new composite NEVER deletes an older one (D3). The previously
 *     stored file is the one named by the currently published kind 0, and it
 *     stays published until the owner re-publishes. Deleting on regenerate kills
 *     the live profile's picture in the window between generating and
 *     publishing. Old composites are tens of kilobytes; keeping them is the
 *     cheap side of that trade.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const multer = require('multer');
const { isOwner } = require('../../middleware/auth');
const { getConfigFromFile } = require('../../utils/config');
const { getInstanceWebsite, isPubliclyReachable } = require('./index');

// Composites live on the tapestry-data volume (docker-compose.yml), which
// survives container recreation — a published picture must not die on redeploy.
const GENERATED_DIR = '/var/lib/brainstorm/generated';
const PUBLIC_PREFIX = '/generated';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_SOURCE_BYTES = 5 * 1024 * 1024;   // what we will pull from a remote host
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;   // what we will store
const FETCH_TIMEOUT_MS = 5000;
// Redirects are the one part of this fetch where a THIRD PARTY picks the
// destination, so we follow at most one hop and validate where it lands exactly
// as we validate the URL the owner published (ADR ta-avatar/0003 D2).
const MAX_REDIRECTS = 1;

// The composite source is drawn into a canvas, so raster formats are all we need.
// SVG is excluded deliberately: it can carry script, and this response is served
// from our own origin — echoing `image/svg+xml` back would turn this endpoint into
// a same-origin script-execution vector for anyone who opened it directly.
const ALLOWED_SOURCE_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/avif', 'image/bmp',
]);

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
 * @param {{ baseDir?: string }} [opts]  directory override, for tests
 * @returns {{ filename: string, path: string, url: string }}
 * @throws if the bytes are not a PNG
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
  const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 8);
  const filename = `ta-avatar-${hash}.png`;
  const target = path.join(dir, filename);

  // Identical bytes → identical name, so an existing file is already correct.
  // Nothing here removes a previously stored composite (D3).
  if (!fs.existsSync(target)) {
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

/** The owner's own kind 0 `picture`, read from local strfry. No caller input. */
function getOwnerKind0PictureUrl(pubkey) {
  return new Promise((resolve) => {
    const filter = JSON.stringify({ kinds: [0], authors: [pubkey], limit: 1 });
    exec(`strfry scan '${filter.replace(/'/g, "'\\''")}' 2>/dev/null`, {
      encoding: 'utf8',
      timeout: 10000,
    }, (error, stdout) => {
      if (error || !stdout.trim()) { resolve(null); return; }
      try {
        const event = JSON.parse(stdout.trim().split('\n')[0]);
        const content = JSON.parse(event.content);
        resolve(typeof content.picture === 'string' && content.picture ? content.picture : null);
      } catch {
        resolve(null);
      }
    });
  });
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
function isRedirect(status) { return REDIRECT_STATUSES.has(status); }

/**
 * Parse a candidate URL and accept it only if it is something we are willing to
 * fetch. Used for the owner's published URL and, unchanged, for a redirect hop —
 * a redirect must clear the same bar as the original, or following one would be a
 * hole straight through the check.
 *
 * @param {string} candidate
 * @param {URL} [relativeTo]  base for a relative Location header
 * @returns {URL|null}
 */
function parseFetchableUrl(candidate, relativeTo) {
  let parsed;
  try { parsed = relativeTo ? new URL(candidate, relativeTo) : new URL(candidate); } catch { return null; }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  return parsed;
}

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
  for await (const chunk of resp.body) {
    total += chunk.length;
    if (total > limit) return null;
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * GET /api/assistant/owner-avatar
 *
 * Streams the owner's own profile picture back same-origin, so the browser can
 * draw it into a canvas without tainting it. Owner-only.
 */
async function handleOwnerAvatar(req, res) {
  if (!isOwner(req) && !req.localTrusted) {
    return res.status(403).json({ success: false, error: 'Owner authentication required' });
  }
  try {
    const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY');
    if (!ownerPubkey) {
      return res.status(404).json({ success: false, error: 'No owner pubkey configured' });
    }
    // Provenance matters here: the URL comes from the owner's own kind 0, never
    // from the request (D2).
    const pictureUrl = await getOwnerKind0PictureUrl(ownerPubkey);
    if (!pictureUrl) {
      // Not an error: this is the branded-fallback path the editor offers (AC5).
      return res.status(404).json({ success: false, error: 'The owner has no profile picture' });
    }

    let parsed = parseFetchableUrl(pictureUrl);
    if (!parsed) {
      return res.status(404).json({ success: false, error: 'The owner picture URL is not a fetchable http(s) URL' });
    }

    // At most one redirect, and the hop is validated the same way the original
    // URL is — otherwise the far-end host, not the owner, chooses what we fetch.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let upstream;
    try {
      for (let hop = 0; ; hop += 1) {
        upstream = await fetch(parsed.toString(), {
          signal: controller.signal,
          redirect: 'manual',
          headers: { accept: 'image/*' },
        });
        if (!isRedirect(upstream.status)) break;
        if (hop >= MAX_REDIRECTS) {
          return res.status(404).json({ success: false, error: 'The owner picture host redirected too many times' });
        }
        const next = parseFetchableUrl(upstream.headers.get('location') || '', parsed);
        if (!next) {
          return res.status(404).json({ success: false, error: 'The owner picture host redirected somewhere unfetchable' });
        }
        parsed = next;
      }
    } finally {
      clearTimeout(timer);
    }
    if (!upstream.ok) {
      return res.status(404).json({ success: false, error: `The owner picture host answered ${upstream.status}` });
    }

    const type = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_SOURCE_TYPES.has(type)) {
      return res.status(404).json({
        success: false,
        error: `The owner picture is ${type || 'untyped'}, which cannot be used as a composite source`,
      });
    }

    const body = await readBounded(upstream, MAX_SOURCE_BYTES);
    if (!body) {
      return res.status(404).json({ success: false, error: 'The owner picture is too large to composite' });
    }

    res.set('Content-Type', type);
    res.set('Cache-Control', 'no-store');
    return res.send(body);
  } catch (err) {
    return res.status(404).json({ success: false, error: `Could not retrieve the owner picture: ${err.message}` });
  }
}

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
}).single('avatar');

/**
 * POST /api/assistant/avatar  (multipart, field `avatar`)
 *
 * Stores the composite the owner's browser produced. Owner-only: this writes
 * into a directory the world can read.
 */
async function handleUploadAvatar(req, res) {
  if (!isOwner(req) && !req.localTrusted) {
    return res.status(403).json({ success: false, error: 'Owner authentication required' });
  }
  try {
    const buffer = req.file && req.file.buffer;
    if (!buffer) {
      return res.status(400).json({ success: false, error: 'No avatar file was uploaded' });
    }
    const stored = storeCompositeAvatar(buffer);
    return res.json({ success: true, ...stored });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
}

module.exports = {
  storeCompositeAvatar,
  handleOwnerAvatar,
  handleUploadAvatar,
  uploadMiddleware,
  GENERATED_DIR,
  PUBLIC_PREFIX,
};
