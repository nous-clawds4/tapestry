/**
 * Where an assistant's kind 0 goes, and what each relay did with it — assistant-profile #2, ADR 0002.
 *
 * The publish set is the instance's own relay settings: the general-purpose, profile and WoT lists,
 * read through getSettings() at publish time, so editing them on the Relays settings page changes the
 * next publish with no code change and no restart. It is also the list /api/assistant/status hands the
 * setup check (ADR 0001), which is why local-only publish mode empties it for both.
 *
 * Every relay is asked on its own socket, and all of them share one deadline, so a relay that never
 * answers costs its own answer and nothing else. Each one comes back as it behaved:
 * accepted | refused | unreachable | timeout — the browser chokepoint's vocabulary (ADR
 * honest-publish-reporting/0001) — or skipped, when local-only mode kept everything here.
 *
 * Dependencies are injectable the feedReadPath way (`options.deps?.X ?? options.X ?? realX`), and the
 * real helpers are required lazily inside their functions, so this module loads in a bare checkout.
 */

/** One deadline for the whole fan-out, measured from its start. */
const PUBLISH_BUDGET_MS = 8000;

/** The relay-settings lists an assistant profile is published to, in this order. */
const PUBLISH_RELAY_CATEGORIES = ['aPopularGeneralPurposeRelays', 'aProfileRelays', 'aWotRelays'];

/** What each status is called in a sentence. */
const RELAY_STATUS = {
  ACCEPTED: 'accepted',
  REFUSED: 'refused',
  UNREACHABLE: 'unreachable',
  TIMEOUT: 'timeout',
  SKIPPED: 'skipped',
};

// ─── Real helpers (used when no deps are injected) ──────────────────────────────

function realGetSettings() {
  return require('../../config/settings').getSettings();
}

function realIsLocalOnly() {
  return require('../publish-policy').isPublishLocalOnly();
}

function realWebSocket() {
  return require('ws');
}

// ─── The publish set ────────────────────────────────────────────────────────────

/** Compare two relay URLs the way an operator means them: case-blind, one trailing slash apart. */
function relayKey(url) {
  return url.toLowerCase().replace(/\/+$/, '');
}

/**
 * The relays this instance is configured to publish assistant profiles to: the general-purpose,
 * profile and WoT lists, in that order, each relay once, in the spelling it was first given.
 * @returns {string[]} possibly empty
 */
function getConfiguredPublishRelays(options = {}) {
  const getSettings = options.deps?.getSettings ?? options.getSettings ?? realGetSettings;
  let settings;
  try {
    settings = getSettings();
  } catch (err) {
    console.warn(`[assistant] could not read the relay settings: ${err.message}`);
    return [];
  }
  const aRelays = (settings && settings.aRelays) || {};
  const seen = new Set();
  const relays = [];
  for (const category of PUBLISH_RELAY_CATEGORIES) {
    const configured = aRelays[category];
    if (!Array.isArray(configured)) continue;
    for (const entry of configured) {
      if (typeof entry !== 'string') continue;
      const url = entry.trim();
      // The settings API refuses anything else (settingsApi.js validateRelayUrls); this guards a
      // hand-edited file.
      if (!/^wss?:\/\/.+/i.test(url)) continue;
      const key = relayKey(url);
      if (seen.has(key)) continue;
      seen.add(key);
      relays.push(url);
    }
  }
  return relays;
}

/**
 * Where an assistant profile actually goes — the configured set, or nothing at all while local-only
 * publish mode is on. The status endpoint hands this same function to the setup check, so the check
 * can never consult a relay the publisher skips.
 */
function getAssistantPublishRelays(options = {}) {
  const isLocalOnly = options.deps?.isLocalOnly ?? options.isLocalOnly ?? realIsLocalOnly;
  const localOnly = typeof options.localOnly === 'boolean' ? options.localOnly : Boolean(isLocalOnly());
  if (localOnly) return [];
  return getConfiguredPublishRelays(options);
}

// ─── The per-relay publish ──────────────────────────────────────────────────────

/**
 * Send `event` to one relay and report what that relay did, settling by `deadline` whatever happens.
 * Never rejects.
 */
function publishToOneRelay(relay, event, WebSocketImpl, deadline) {
  return new Promise((resolve) => {
    let settled = false;
    let opened = false;
    let notice = '';
    let socket = null;
    let timer = null;

    const finish = (status, reason) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try {
        if (socket && typeof socket.terminate === 'function') socket.terminate();
        else if (socket && typeof socket.close === 'function') socket.close();
      } catch { /* the socket is going away either way */ }
      resolve({ relay, status, reason: reason || '' });
    };

    try {
      socket = new WebSocketImpl(relay);
    } catch (err) {
      finish(RELAY_STATUS.UNREACHABLE, (err && err.message) || String(err));
      return;
    }

    timer = setTimeout(
      () => finish(opened ? RELAY_STATUS.TIMEOUT : RELAY_STATUS.UNREACHABLE, opened ? notice : 'connection timed out'),
      Math.max(0, deadline - Date.now()),
    );

    socket.on('open', () => {
      opened = true;
      try {
        socket.send(JSON.stringify(['EVENT', event]));
      } catch (err) {
        finish(RELAY_STATUS.UNREACHABLE, (err && err.message) || 'the event could not be sent');
      }
    });

    socket.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data.toString()); } catch { return; }
      if (!Array.isArray(msg)) return;
      if (msg[0] === 'NOTICE') {
        if (typeof msg[1] === 'string' && msg[1]) notice = msg[1];
        return;
      }
      // An OK naming another event is not an answer to ours.
      if (msg[0] !== 'OK' || msg[1] !== event.id) return;
      if (msg[2] === false) {
        finish(RELAY_STATUS.REFUSED, (typeof msg[3] === 'string' && msg[3]) || 'refused without a reason');
      } else {
        finish(RELAY_STATUS.ACCEPTED, typeof msg[3] === 'string' ? msg[3] : '');
      }
    });

    socket.on('error', (err) => finish(RELAY_STATUS.UNREACHABLE, (err && err.message) || 'connection error'));

    socket.on('close', () => {
      if (!opened) { finish(RELAY_STATUS.UNREACHABLE, 'connection closed'); return; }
      // It took the event and hung up. A NOTICE is the only thing it said about why.
      if (notice) finish(RELAY_STATUS.REFUSED, notice);
      else finish(RELAY_STATUS.UNREACHABLE, 'closed the connection without answering');
    });
  });
}

/**
 * Send `event` to every relay in parallel, under one shared deadline.
 * @returns {Promise<Array<{relay: string, status: string, reason: string}>>} one row per relay, in input order
 */
function publishToRelays(event, relays, options = {}) {
  const list = Array.isArray(relays) ? relays : [];
  if (list.length === 0) return Promise.resolve([]);
  const WebSocketImpl = options.deps?.WebSocket ?? options.WebSocket ?? realWebSocket();
  const budgetMs = typeof options.budgetMs === 'number' ? options.budgetMs : PUBLISH_BUDGET_MS;
  const deadline = Date.now() + budgetMs;
  return Promise.all(list.map((relay) => publishToOneRelay(relay, event, WebSocketImpl, deadline)));
}

// ─── The words ──────────────────────────────────────────────────────────────────

/** Which assistant this result is about, named so no reader can take it for another one. */
function publishSubject({ isOwnerTarget, isSelf, targetPubkey } = {}) {
  if (isOwnerTarget) return "The Tapestry Assistant's profile";
  if (isSelf) return "Your Tapestry Assistant's profile";
  let npub = '';
  try { npub = require('nostr-tools').nip19.npubEncode(targetPubkey); } catch { npub = ''; }
  const who = npub ? `npub…${npub.slice(-6)}` : 'another user';
  return `The profile of the Tapestry Assistant for ${who}`;
}

/** What to tell the user when the local relay itself refused the profile. */
function localFailureMessage(subject, reason) {
  return `${subject} could not be saved on this instance's relay (${reason}), so it was not sent to any other relay.`;
}

/**
 * The whole result in one line, and the outcome vocabulary the rest of the app already uses
 * (src/lib/broadcastOutcome.js): published, kept-local, not-delivered. A relay counts as reached
 * only when it accepted the event.
 */
function summarizePublish({ subject, rows, localOnly } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const acceptedRelays = list.filter((row) => row && row.status === RELAY_STATUS.ACCEPTED).map((row) => row.relay);
  const attempted = list.filter((row) => row && row.status !== RELAY_STATUS.SKIPPED).length;
  const accepted = acceptedRelays.length;
  const { classifyBroadcast } = require('../../lib/broadcastOutcome');
  const outcome = classifyBroadcast({
    successes: acceptedRelays,
    skippedByGate: Boolean(localOnly) || attempted === 0,
  });

  let message;
  if (outcome === 'kept-local') {
    message = localOnly
      ? `${subject} was saved on this instance's relay only: local-only publish mode is on, so it was not sent to any other relay.`
      : `${subject} was saved on this instance's relay only: no general-purpose, profile or WoT relays are configured.`;
  } else if (outcome === 'published') {
    message = `${subject} was saved on this instance's relay and accepted by ${accepted} of ${attempted} relays.`;
    if (accepted < attempted) message += ` ${attempted - accepted} did not accept it; see below.`;
  } else {
    message = `${subject} was saved on this instance's relay, but none of the ${attempted} relays accepted it; see below.`;
  }
  return { outcome, message, accepted };
}

module.exports = {
  PUBLISH_BUDGET_MS,
  PUBLISH_RELAY_CATEGORIES,
  RELAY_STATUS,
  getConfiguredPublishRelays,
  getAssistantPublishRelays,
  publishToRelays,
  publishSubject,
  summarizePublish,
  localFailureMessage,
};
