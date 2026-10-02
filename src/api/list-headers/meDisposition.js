/**
 * list-headers-disposition #5 — Disposition on Me rows (ADR list-headers-disposition/0005).
 *
 *   POST /api/list-headers/me/:handle/<self-declare|b-defer|b-append>/prepare   { target } for Wire
 *   POST /api/list-headers/me/:handle/<self-declare|b-defer|b-append>/commit    { event, target? }
 *
 * The headers here were written with the signed-in account's own key, so the person's browser signer (NIP-07)
 * signs the new version. This instance never looks up, receives or holds a private key on this path.
 *
 * prepare runs every check that can fail without the signer — the same host, a verified session, the account as
 * the header's author, Wire's target, the latest version, that version's verification — then the shared tag
 * rules, and answers the unsigned template (or "already", or a domain refusal). So a doomed request never asks
 * the person to sign, and an "already" one needs no signature at all.
 *
 * commit runs the same checks again from a fresh lookup, re-derives the change itself, and takes the signed event
 * only if it is exactly that change, by the session account, and verifies. Then the Assistant handler's tail:
 * local strfry, the read-back by id (strfry import exits 0 even when it rejects an event), and only then the graph.
 *
 * The checks and rules are the Assistant handler's own building blocks, reused unchanged
 * (./myAssistantDisposition.js). Every side effect is injected through createMeDispositionHandler(action, phase,
 * deps), so the branch logic is testable without the stack (test/list-headers-me-disposition.test.js).
 */

'use strict';

const { sameHost, firstD, HANDLE_RE, HEADER_KIND, ACTIONS, defaultDeps } = require('./myAssistantDisposition');
const { nextCreatedAt } = require('../../lib/headerDispositionCompose');

const PHASES = ['prepare', 'commit'];
// A signed version may be at most this far ahead of the server's clock (ADR 0005); the relay refuses events
// more than 900 s ahead, so this stays inside what it will keep.
const MAX_AHEAD_SECONDS = 600;

const NOT_THE_ACCOUNT = "That version wasn't signed by the account you're signed in with, so nothing was saved";
const NOT_THE_CHANGE = "The signed version isn't exactly this action's change to the current header, so nothing was saved";
const DOES_NOT_VERIFY = "The signed version doesn't verify, so nothing was saved";

function routeFor(action, phase) {
  return `/api/list-headers/me/:handle/${action}/${phase}`;
}

function createMeDispositionHandler(action, phase, deps = {}) {
  const spec = ACTIONS[action];
  if (!spec || !PHASES.includes(phase)) throw new Error(`unknown disposition route: ${action}/${phase}`);
  // Only requireAuth, scanLatest, verify, publishLocal, isStored, importToGraph and now are used here.
  const d = { ...defaultDeps(), ...deps };

  return async function handleMeDisposition(req, res) {
    try {
      if (!sameHost(req)) return res.status(403).json({ success: false, error: 'a request from another site is refused' });

      const sessionPubkey = d.requireAuth(req, res);
      if (!sessionPubkey) return; // requireAuth has answered 401

      // Express has already decoded req.params; decoding again would turn a d-tag of "a%41" into "aA".
      const m = String((req.params && req.params.handle) || '').match(HANDLE_RE);
      if (!m) return res.status(400).json({ success: false, error: 'handle must be kind:pubkey:d-tag' });
      if (Number(m[1]) !== HEADER_KIND) {
        return res.status(400).json({ success: false, error: 'only kind-39998 list headers can be dispositioned' });
      }
      if (m[2] !== sessionPubkey) {
        return res.status(403).json({ success: false, error: 'You can only disposition headers you wrote' });
      }

      const dTag = m[3];
      const selfCoord = `${HEADER_KIND}:${sessionPubkey}:${dTag}`;
      const prep = spec.prepare ? spec.prepare(req, selfCoord, { pubkey: sessionPubkey }, dTag) : {};
      if (prep.error) return res.status(400).json({ success: false, error: prep.error });

      const header = await d.scanLatest({ kinds: [HEADER_KIND], authors: [sessionPubkey], '#d': [dTag] });
      if (!header) return res.status(404).json({ success: false, error: `No header ${selfCoord} on this instance` });

      // The relay can hold unverified events (io.js imports with --no-verify): the same four checks as the
      // Assistant handler, with the session account as the author.
      const failed = header.pubkey !== sessionPubkey ? 'author'
        : header.kind !== HEADER_KIND ? 'kind'
          : firstD(header) !== dTag ? 'd-tag'
            : !d.verify(header) ? 'signature'
              : null;
      if (failed) {
        console.error(`list-headers/me/${action}/${phase}: stored header failed the ${failed} check; nothing prepared or saved`);
        return res.status(409).json({ success: false, error: "The stored header couldn't be verified as your Assistant's, so nothing was signed" });
      }

      const composed = spec.compose(header, selfCoord, prep);

      if (phase === 'prepare') {
        // Domain refusal: HTTP 200 { success: false }, the house contract (bDisposition.js handleBDefer).
        if (composed.refused) return res.json({ success: false, error: composed.refused });
        if (composed.already) return res.json({ success: true, result: spec.already, event: header });
        return res.json({
          success: true,
          result: 'sign',
          template: {
            kind: HEADER_KIND,
            content: header.content || '',
            tags: composed.tags,
            created_at: nextCreatedAt(header.created_at, d.now()),
            pubkey: sessionPubkey,
          },
        });
      }

      // commit
      const ev = req.body && req.body.event;
      if (!ev || typeof ev !== 'object' || ev.pubkey !== sessionPubkey) {
        return res.status(403).json({ success: false, error: NOT_THE_ACCOUNT });
      }
      // "already" or a refusal now means the header changed since prepare: what the person signed is no longer
      // this action's change, so it is not used.
      if (composed.refused || composed.already) return res.status(409).json({ success: false, error: NOT_THE_CHANGE });
      const exact = ev.kind === HEADER_KIND
        && ev.content === (header.content || '')
        && JSON.stringify(ev.tags) === JSON.stringify(composed.tags)
        && Number.isInteger(ev.created_at)
        && ev.created_at > header.created_at
        && ev.created_at <= d.now() + MAX_AHEAD_SECONDS;
      if (!exact) return res.status(409).json({ success: false, error: NOT_THE_CHANGE });
      if (!d.verify(ev)) return res.status(400).json({ success: false, error: DOES_NOT_VERIFY });

      await d.publishLocal(ev);
      // strfry import exits 0 even when it rejects an event, so read the new version back before the graph
      // follows it; a read that fails claims nothing (ADR list-headers-disposition/0004 Amendment 1 §4).
      let stored;
      try {
        stored = await d.isStored(ev.id);
      } catch {
        return res.status(502).json({ success: false, error: "Sent to the relay, but couldn't confirm it was kept — the graph wasn't changed" });
      }
      if (!stored) return res.status(502).json({ success: false, error: "The relay didn't keep the new version, so nothing was saved" });
      await d.importToGraph(ev, selfCoord);
      return res.json({ success: true, result: spec.done, event: ev });
    } catch (error) {
      console.error(`list-headers/me/${action}/${phase} error:`, error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  };
}

function register(app) {
  for (const action of Object.keys(ACTIONS)) {
    for (const phase of PHASES) app.post(routeFor(action, phase), createMeDispositionHandler(action, phase));
  }
}

module.exports = { createMeDispositionHandler, register };
