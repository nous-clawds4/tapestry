/**
 * Save on the Manage your Treasure Map page (treasure-map-edit #5, ADR treasure-map-edit/0005 sub-decision 1): the
 * whole decision sequence, with every effect passed in, so a Node suite drives each branch with fakes
 * (test/treasure-map-save.test.js). Pure apart from what it's given, with only `.js`-suffixed imports.
 *
 * In order: the Map is the viewer's; the signer is there and on the viewer's account; no newer Map has appeared since
 * the page read it (book decision 17); sign exactly the draft, stamped to replace the published Map; publish. The
 * outcome is "saved" only when this instance's relay and every outside relay tried accepted it; "partial" when it went
 * somewhere; "failed" when nowhere. useMapSave wires in the real effects.
 */

import { COPY } from './manageTreasureMap.js';
import { describeTaggingPublish, relayLine } from '../../utils/taggingPublishReport.js';

const KIND_TREASURE_MAP = 10040;
const SIGNER_MISMATCH = 'SIGNER_MISMATCH';

/**
 * Is `latest` a newer Map than the one the edit is based on? Any Map is newer than none; a different Map at the same
 * second or later is newer (an equal time counts, to be safe); the same Map, or an older one, is not.
 * @param {?object} latest  the newest Map a fresh read found
 * @param {?object} base  the Map the page read
 */
export function isNewer(latest, base) {
  if (!latest || typeof latest !== 'object') return false;
  if (!base || typeof base !== 'object') return true;
  return latest.id !== base.id && (latest.created_at || 0) >= (base.created_at || 0);
}

/** A created_at that replaces the published Map: now, unless that Map is as new or newer, then one second after it. */
export function stampFor(base, now) {
  return Math.max(now, ((base && base.created_at) || 0) + 1);
}

/**
 * Was the Map accepted everywhere (story 5 AC-6)? This instance's relay took it, the publish policy didn't keep it
 * local, at least one outside relay was tried, and every one tried accepted it.
 * @param {?{ local: ?object, external: ?object }} result  publishEverywhere's
 */
export function cleanSave(result) {
  if (!result || !result.local || result.local.success !== true) return false;
  const external = result.external || {};
  if (external.skippedByGate === true) return false;
  const details = external.details && typeof external.details === 'object' ? Object.values(external.details) : [];
  const failures = Array.isArray(external.failures) ? external.failures.length : 0;
  const successes = Array.isArray(external.successes) ? external.successes.length : 0;
  if (successes + failures === 0) return false;
  return failures === 0 && details.every((d) => d && d.status === 'accepted');
}

/** A save report's relay lines, in the app's words: "wss://relay: accepted", "wss://relay: rejected: …". */
export function reportLines(report) {
  return (report && Array.isArray(report.rows) ? report.rows : []).map((row) => `${row.relay}: ${relayLine(row)}`);
}

const notSent = (reason, message) => ({ outcome: 'not-sent', reason, ...(message ? { message } : {}) });
const isMismatch = (err) => Boolean(err) && err.code === SIGNER_MISMATCH;

/**
 * Save the edited Map (story 5 AC-2 to AC-8). Never throws: every case answers with an outcome.
 * @param {{ viewer: ?string, base: ?object, draft: ?object, relays: string[],
 *           deps: { readLatest: Function, activeSigner: Function, sign: Function, publish: Function, now: Function } }} input
 *   `base` the Map the page read (null when none was found); `draft` planEdit's; `relays` the outside relays the
 *   publish is given, for the report.
 * @returns {Promise<{ outcome: 'not-sent', reason: 'viewer'|'no-signer'|'mismatch'|'changed'|'declined', message?: string }
 *                  | { outcome: 'saved'|'partial'|'failed', signed: object, report: object }>}
 */
export async function saveTreasureMap({ viewer, base, draft, relays, deps }) {
  // 1. Only the viewer's own Map, read for the viewer (story 3 review, non-blocking 9).
  if (!viewer || !draft || draft.pubkey !== viewer || (base && base.pubkey !== viewer)) return notSent('viewer');

  // 2. The signer is there, on the signed-in account.
  try {
    await deps.activeSigner(viewer);
  } catch (err) {
    return isMismatch(err) ? notSent('mismatch', err.message) : notSent('no-signer', COPY.edit.noSigner);
  }

  // 3. No newer Map since the page read it (book decision 17). A read that answers nothing doesn't block.
  let latest = null;
  try { latest = await deps.readLatest(); } catch { latest = null; }
  if (isNewer(latest, base)) return notSent('changed', COPY.edit.changedSince);

  // 4. Sign exactly the draft, stamped to replace the published Map.
  const unsigned = {
    kind: KIND_TREASURE_MAP,
    pubkey: viewer,
    created_at: stampFor(base, deps.now()),
    content: typeof draft.content === 'string' ? draft.content : '',
    tags: draft.tags,
  };
  let signed;
  try {
    signed = await deps.sign(unsigned);
  } catch (err) {
    return isMismatch(err) ? notSent('mismatch', err.message) : notSent('declined', COPY.edit.declined);
  }

  // 5. Publish, and say where it went.
  let result;
  try {
    result = await deps.publish(signed);
  } catch (err) {
    result = { local: { success: false, error: (err && err.message) || String(err) }, external: {} };
  }
  const report = describeTaggingPublish({
    name: '', subject: COPY.edit.reportSubject, local: result && result.local, external: result && result.external, relays,
  });
  const outcome = cleanSave(result) ? 'saved' : report.ok ? 'partial' : 'failed';
  return { outcome, signed, report };
}
