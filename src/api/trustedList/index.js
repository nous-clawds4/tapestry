/**
 * Trusted List API — sign and publish kind 30392-30395 Trusted List events.
 *
 * POST /api/trusted-list/publish
 *   Body: {
 *     kind: 30392 | 30393 | 30394 | 30395,  // p / e / a / i members (protocols/drafts/trusted-lists.md)
 *     dTag: string,
 *     title: string,
 *     metric?: string,
 *     items: [{ tag, value, relay?, author?, score? }]
 *   }
 *
 * Signs with the Tapestry Assistant key and publishes to local strfry.
 */

const { getOwnerAssistantKeys } = require('../../utils/assistantKeys');

let _nt = null;
function nt() {
  if (!_nt) _nt = require('/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools');
  return _nt;
}

/**
 * Story 19 / ADR 0017: kind-30000 export's "via Brainstorm" description.
 * Per ADR Q5: title is purely user-chosen (defaults to bare tag name);
 * description is the instance-managed hint so other-client readers know
 * what this list is.
 */
const BRAINSTORM_EXPORT_DESCRIPTION =
  "A Pinned-tag list from Brainstorm — members are trusted in this tag under the exporter's web-of-trust point of view. Re-publish from your Brainstorm instance to update.";

/**
 * Story 22 / ADR 0020: kind-39089 Follow Pack ("starter pack") description.
 * A pack is meant to be handed to other people, so it gets sharing-
 * appropriate copy — the kind-30000 line ("Re-publish from your Brainstorm
 * instance…") is meaningless to a stranger who receives the pack.
 */
const FOLLOW_PACK_DESCRIPTION =
  "A starter pack from Brainstorm — a set of profiles trusted in this tag under the sharer's web-of-trust point of view. Follow them all at once.";

// ── TA private key cache (same pattern as normalize) ──────────
let _cachedPrivkey = null;

async function loadTAKey() {
  const keys = await getOwnerAssistantKeys();
  if (keys && keys.privkey) {
    _cachedPrivkey = Uint8Array.from(Buffer.from(keys.privkey, 'hex'));
    console.log(`[trusted-list] TA key loaded from secure storage`);
    return;
  }
  throw new Error('TA key not configured — store it in SecureKeyStorage');
}

function getPrivkey() {
  if (!_cachedPrivkey) throw new Error('TA key not loaded yet');
  return _cachedPrivkey;
}

function signAndFinalize(template) {
  const privBytes = getPrivkey();
  const pubkey = Buffer.from(nt().getPublicKey(privBytes)).toString('hex');
  const event = {
    kind: template.kind,
    created_at: Math.floor(Date.now() / 1000),
    tags: template.tags,
    content: template.content || '',
    pubkey,
  };
  return nt().finalizeEvent(event, privBytes);
}

async function publishToStrfry(event) {
  // ADR tag-stack-merge-hardening/0001 (B4b): feed the signed event to
  // `strfry import` via STDIN, not as a shell argument. The old
  // `echo '<json>' | strfry import` form put the whole event JSON on the
  // command line, so any event over the 128 KiB MAX_ARG_STRLEN cap (TLs
  // above ~600–700 members) always failed to publish — which in turn
  // triggered the empty-membership retraction (B4a). stdin has no such cap.
  const { spawn } = require('child_process');
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/local/bin/strfry', ['import', '--no-verify']);
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (fn, arg) => { if (!settled) { settled = true; fn(arg); } };

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(reject, new Error('strfry import timed out after 5000ms'));
    }, 5000);

    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => { clearTimeout(timer); finish(reject, err); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) finish(resolve, stdout);
      else finish(reject, new Error(`strfry import exited ${code}: ${stderr.trim()}`));
    });

    child.stdin.on('error', (err) => { clearTimeout(timer); finish(reject, err); });
    child.stdin.write(JSON.stringify(event) + '\n');
    child.stdin.end();
  });
}

/**
 * ADR 0010: extracted pure builder/publisher. Both the HTTP handler and
 * Story-11's pinned-tag refresh module call this. `extraTags` is an array
 * of pre-built tag arrays appended to the event before signing (used by
 * Story 11 for ['observer'], ['source-tag'], ['cutoff'], ['min-rank'],
 * and the optional ['status','retracted'] marker). `content` is the JSON
 * body string (used by Story 11 for per-member endorsement/dispute counts).
 */
async function buildAndPublishTL({ kind, dTag, title, metric, items, extraTags = [], content = '' }) {
  if (!_cachedPrivkey) await loadTAKey();

  if (!kind || ![30392, 30393, 30394, 30395].includes(kind)) {
    throw new Error('kind must be 30392-30395');
  }
  if (!dTag) throw new Error('dTag is required');
  // items can be an empty array — Story 11's retraction publishes an
  // empty-membership replacement. Only reject non-array inputs.
  if (!Array.isArray(items)) throw new Error('items must be an array');

  const tags = [['d', dTag]];
  if (title) tags.push(['title', title]);
  if (metric) tags.push(['metric', metric]);
  for (const t of extraTags) {
    if (Array.isArray(t) && t.length > 0) tags.push(t);
  }

  for (const item of items) {
    if (item.tag === 'p') {
      const pTag = ['p', item.value];
      if (item.relay) pTag.push(item.relay);
      else if (item.score != null) pTag.push('');
      if (item.score != null) pTag.push(String(item.score));
      tags.push(pTag);
    } else if (item.tag === 'e') {
      const eTag = ['e', item.value];
      if (item.relay) eTag.push(item.relay);
      else if (item.author || item.score != null) eTag.push('');
      if (item.author) eTag.push(item.author);
      else if (item.score != null) eTag.push('');
      if (item.score != null) eTag.push(String(item.score));
      tags.push(eTag);
    } else if (item.tag === 'a') {
      // a-coordinate member (39999:<author>:<slug>) — the applicability lists
      // reference tags by stable a-coordinate (tag-applicability/0001).
      tags.push(['a', item.value]);
    }
  }

  const event = signAndFinalize({ kind, tags, content });
  await publishToStrfry(event);
  const uuid = `${kind}:${event.pubkey}:${dTag}`;
  return { event, uuid };
}

async function handlePublishTrustedList(req, res) {
  try {
    const { kind, dTag, title, metric, items } = req.body || {};
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, error: 'items array is required and must not be empty' });
    }
    const { event, uuid } = await buildAndPublishTL({ kind, dTag, title, metric, items });
    return res.json({
      success: true,
      event,
      uuid,
      message: `Trusted List published with ${items.length} items`,
    });
  } catch (err) {
    console.error('trusted-list/publish error:', err);
    // Validation errors from buildAndPublishTL surface as 400; anything
    // else (key loading, strfry publish) bubbles to 500.
    const isValidationErr = /^(kind must|dTag is required|items must)/.test(err.message || '');
    return res.status(isValidationErr ? 400 : 500).json({ success: false, error: err.message });
  }
}

/* ── Story 11: refresh-pinned-tag endpoints (ADR 0010) ─────────────────── */

function requireAuth(req, res) {
  // ADR tag-stack-merge-hardening/0001 (B1): require a signature-verified
  // session, not merely a supplied pubkey. `POST /api/auth/verify-user`
  // sets session.pubkey for any pubkey with no signature; only the signed
  // challenge sets session.authenticated (auth.js:157). Without this check
  // anyone could impersonate any pubkey against the refresh/export endpoints.
  const pubkey = req.session?.pubkey;
  if (req.session?.authenticated !== true || !pubkey || !/^[0-9a-f]{64}$/.test(pubkey)) {
    res.status(401).json({ success: false, error: 'authentication required' });
    return null;
  }
  return pubkey;
}

/**
 * ADR tag-stack-merge-hardening/0001 (B3): a request is loopback-trusted iff
 * it arrived on a loopback socket AND carries no reverse-proxy headers. The
 * cron caller curls http://127.0.0.1:$PORT directly (no proxy headers); an
 * internet request reaches Express via nginx, which always appends
 * X-Forwarded-For. Both conditions must hold.
 */
function isLoopbackRequest(req) {
  const addr = req.socket?.remoteAddress || '';
  const isLoopback = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
  const headers = req.headers || {};
  const hasProxyHeader = !!(headers['x-forwarded-for'] || headers['x-real-ip']);
  return isLoopback && !hasProxyHeader;
}

async function handleRefreshAllPinnedTags(req, res) {
  // Loopback-only: this triggers a prod-scale recompute + TA-signed
  // publishes. The cron script calls it from 127.0.0.1; nginx-proxied
  // internet requests carry X-Forwarded-For and are rejected before any work.
  if (!isLoopbackRequest(req)) {
    return res.status(403).json({ success: false, error: 'loopback only' });
  }
  try {
    const { refreshAllPinnedTags } = require('./refreshPinnedTags');
    const result = await refreshAllPinnedTags();
    return res.json({ success: true, pins: result.pins });
  } catch (err) {
    console.error('trusted-list/refresh-all-pinned-tags error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function handleRefreshOnePinnedTag(req, res) {
  const sessionPubkey = requireAuth(req, res);
  if (!sessionPubkey) return;
  const { pinEventId } = req.body || {};
  if (!pinEventId || !/^[0-9a-f]{64}$/.test(pinEventId)) {
    return res.status(400).json({ success: false, error: 'pinEventId is required (64-char lowercase hex)' });
  }
  try {
    const { refreshOnePinnedTagById } = require('./refreshPinnedTags');
    const result = await refreshOnePinnedTagById({ pinEventId, sessionPubkey });
    if (result.error === 'not-found') {
      return res.status(404).json({ success: false, error: 'pin event not found' });
    }
    if (result.error === 'forbidden') {
      return res.status(403).json({ success: false, error: 'pin event author does not match session pubkey' });
    }
    return res.json({ success: true, status: result.status, tlEventId: result.tlEventId || null, error: result.errorReason || null });
  } catch (err) {
    console.error('trusted-list/refresh-pinned-tag error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/* ── tag-applicability/0001: derive + publish the two applicability lists ── */
async function handleRefreshApplicabilityLists(req, res) {
  // Loopback-only: triggers a TA-signed publish (same posture as refresh-all-pinned-tags).
  // Story 1 exposes the manual trigger; the schedule is Story 2.
  if (!isLoopbackRequest(req)) {
    return res.status(403).json({ success: false, error: 'loopback only' });
  }
  try {
    const { refreshApplicabilityLists } = require('./refreshApplicabilityLists');
    const result = await refreshApplicabilityLists();
    return res.json({ success: true, lists: result.lists });
  } catch (err) {
    console.error('trusted-list/refresh-applicability-lists error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// The debounced applicability-refresh scheduler singleton (ADR tag-applicability/0003). The client
// fires notify-applicability on every tag mutation; this coalesces the bursts into one diff-guarded
// republish. Lazy require of refreshApplicabilityLists avoids a load-time cycle.
const { createApplicabilityScheduler } = require('./applicabilityScheduler');
const applicabilityScheduler = createApplicabilityScheduler({
  refresh: () => require('./refreshApplicabilityLists').refreshApplicabilityLists(),
});

// User-authed (like refresh-pinned-tag): a logged-in client notifies after creating/applying a tag.
// Fire-and-forget on the client; here we just schedule the debounced refresh and return 202.
async function handleNotifyApplicability(req, res) {
  const sessionPubkey = requireAuth(req, res);
  if (!sessionPubkey) return;
  applicabilityScheduler.schedule();
  return res.status(202).json({ success: true, scheduled: true });
}

async function handleRefreshForViewer(req, res) {
  const sessionPubkey = requireAuth(req, res);
  if (!sessionPubkey) return;
  const { viewerPubkey } = req.query || {};
  if (!viewerPubkey || !/^[0-9a-f]{64}$/.test(viewerPubkey)) {
    return res.status(400).json({ success: false, error: 'viewerPubkey is required (64-char lowercase hex)' });
  }
  if (viewerPubkey !== sessionPubkey) {
    return res.status(403).json({ success: false, error: 'viewerPubkey must match session pubkey' });
  }
  try {
    const { refreshPinnedTagsForViewer } = require('./refreshPinnedTags');
    const result = await refreshPinnedTagsForViewer(viewerPubkey);
    return res.json({ success: true, pins: result.pins });
  } catch (err) {
    console.error('trusted-list/refresh-pinned-tags-for-viewer error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

/* ── Story 19 / ADR 0017: prepare-nip51-export ───────────────────────── */

function strfryScan(filter) {
  const { exec } = require('child_process');
  return new Promise((resolve, reject) => {
    const safe = JSON.stringify(filter).replace(/'/g, "'\\''");
    exec(`strfry scan '${safe}'`, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err);
      const events = [];
      for (const line of stdout.split('\n')) {
        if (!line) continue;
        try { events.push(JSON.parse(line)); } catch {}
      }
      resolve(events);
    });
  });
}

/**
 * Story 19 / ADR 0017: prepare an unsigned kind-30000 NIP-51 follow-set
 * export for the session user. Returns the unsigned template (client
 * signs via NIP-07 and publishes via publishEverywhere) plus the pre-
 * encoded naddr and the user's NIP-65 write relays so the UI's pre-
 * publish relay-preview popover can render without an extra fetch.
 *
 * Auth: session pubkey required; the template's pubkey field is set to
 * it. The client cannot sign as someone else (the second NIP-07 prompt
 * will use the user's own key regardless of what's in the template).
 *
 * Input:  { pinEventId, title? }
 *   - title: if provided, used as the title tag; else defaults to
 *     tag.name (bare). (ADR Q5: "title is purely the user's choice.")
 *
 * Output: { success, unsigned, dTag, memberCount }
 *
 * ADR 0017 Amendment II: this endpoint no longer returns writeRelays
 * or a pre-composed naddr — the user's NIP-65 write-relay list is
 * client-side identity data sourced from window.nostr.getRelays().
 * The client composes the naddr itself after signing.
 */
async function handlePrepareNip51Export(req, res) {
  const sessionPubkey = requireAuth(req, res);
  if (!sessionPubkey) return;

  const { pinEventId, title: providedTitle, kind: providedKind } = req.body || {};
  if (!pinEventId || !/^[0-9a-f]{64}$/.test(pinEventId)) {
    return res.status(400).json({ success: false, error: 'pinEventId is required (64-char lowercase hex)' });
  }
  // Export kind: kind-30000 Follow Set (default) or kind-39089 Follow Pack
  // (NIP-51 "starter pack"). Both carry the same pubkey membership; only
  // the event kind differs, so the rest of this handler is kind-agnostic.
  const exportKind = providedKind === undefined ? 30000 : providedKind;
  if (exportKind !== 30000 && exportKind !== 39089) {
    return res.status(400).json({ success: false, error: 'kind must be 30000 (Follow Set) or 39089 (Follow Pack)' });
  }

  try {
    const profileTags = require('../profile-tags');

    // 1. Look up the pin event.
    const pinEvents = await strfryScan({ kinds: [39999], ids: [pinEventId] });
    if (pinEvents.length === 0) {
      return res.status(404).json({ success: false, error: 'pin event not found' });
    }
    const pinEvent = pinEvents[0];

    // 2. Validate ownership: session must equal pin author.
    if (pinEvent.pubkey !== sessionPubkey) {
      return res.status(403).json({ success: false, error: 'pin event author does not match session pubkey' });
    }

    // 3. Parse curation method (only nip85:rank supported in v1).
    const curation = profileTags.parseCurationMethod(pinEvent);
    if (!curation || curation.method !== 'nip85:rank') {
      return res.status(400).json({ success: false, error: 'curation method not supported in v1 (nip85:rank only)' });
    }
    const observer = curation.observer;
    if (!observer || !/^[0-9a-f]{64}$/.test(observer)) {
      return res.status(400).json({ success: false, error: 'pin observer pubkey missing or malformed' });
    }

    // 4. Look up the referenced tag event.
    const tagEventId = profileTags.parsePinTagEventId(pinEvent);
    if (!tagEventId) {
      return res.status(400).json({ success: false, error: 'pin event has no referenced tag' });
    }
    const tagEvents = await strfryScan({ kinds: [39999], ids: [tagEventId] });
    if (tagEvents.length === 0) {
      return res.status(404).json({ success: false, error: 'referenced tag event missing from local strfry' });
    }
    const tagEv = tagEvents[0];
    const tagPayload = profileTags.parseTagPayload(tagEv);
    if (!tagPayload || !tagPayload.slug) {
      return res.status(400).json({ success: false, error: 'tag event payload malformed' });
    }

    // 5. Compute the d-tag (per ADR AC-6: identical to the kind-30392's
    //    d-tag composition for the same pin).
    const dTag = `tl-pin-${observer.slice(0, 8)}-${tagEv.pubkey.slice(0, 8)}-${tagPayload.slug}`;

    // 6. Read the current kind-30392 to source membership (per ADR Q7:
    //    "read current kind-30392, don't trigger a fresh WoT-scan").
    const taPubkey = profileTags.TA_PUBKEY;
    let memberPubkeys = [];
    if (taPubkey) {
      const tls = await strfryScan({ kinds: [30392], authors: [taPubkey], '#d': [dTag] });
      if (tls.length > 0) {
        tls.sort((a, b) => b.created_at - a.created_at);
        const latest = tls[0];
        const retracted = (latest.tags || []).some((t) => t[0] === 'status' && t[1] === 'retracted');
        if (!retracted) {
          memberPubkeys = (latest.tags || []).filter((t) => t[0] === 'p').map((t) => t[1]);
        }
      }
    }

    // 7. Resolve title (per ADR Q4/Q5: default to bare tag.name).
    const title = (typeof providedTitle === 'string' && providedTitle.trim().length > 0)
      ? providedTitle.trim()
      : (tagPayload.name || tagPayload.slug);

    // 8. Build unsigned kind-30000 / kind-39089 template.
    //    - z-tag reuses the existing tag-pinning concept handle (per
    //      ADR Q2: LEGACY pubkey, no new concept, no firmware reinstall).
    //    - Per Amendment II: naddr is composed client-side from the
    //      NIP-07 getRelays() lookup; not assembled here.
    //    - kind-30000 (Follow Set) and kind-39089 (Follow Pack) share the
    //      same d-tag, title, description, and `p` membership; only the
    //      kind differs, so the two are addressable in parallel.
    const zTagHandle = profileTags.TAG_PINNING_Z_TAG;
    const unsigned = {
      kind: exportKind,
      pubkey: sessionPubkey,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['d', dTag],
        ['z', zTagHandle],
        ['title', title],
        ['description', exportKind === 39089 ? FOLLOW_PACK_DESCRIPTION : BRAINSTORM_EXPORT_DESCRIPTION],
        ...memberPubkeys.map((pk) => ['p', pk]),
      ],
      content: '',
    };

    return res.json({
      success: true,
      unsigned,
      dTag,
      memberCount: memberPubkeys.length,
    });
  } catch (err) {
    console.error('trusted-list/prepare-nip51-export error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

function register(app) {
  app.post('/api/trusted-list/publish', handlePublishTrustedList);
  app.post('/api/trusted-list/refresh-all-pinned-tags', handleRefreshAllPinnedTags);
  app.post('/api/trusted-list/refresh-pinned-tag', handleRefreshOnePinnedTag);
  app.post('/api/trusted-list/refresh-pinned-tags-for-viewer', handleRefreshForViewer);
  app.post('/api/trusted-list/refresh-applicability-lists', handleRefreshApplicabilityLists);
  app.post('/api/trusted-list/notify-applicability', handleNotifyApplicability);
  app.post('/api/trusted-list/prepare-nip51-export', handlePrepareNip51Export);
}

module.exports = {
  register,
  buildAndPublishTL,
  // Exported for tests (ADR tag-stack-merge-hardening/0001 testability):
  requireAuth,
  isLoopbackRequest,
};
