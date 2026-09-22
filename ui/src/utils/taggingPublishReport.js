/**
 * What a browser-side tagging publish did, in the words a person reads (assistant-identification-tags #2, ADR 0002
 * sub-decisions 4 and 5).
 *
 * Pure, no imports, so Node suites can load it. It reads the result the publish chokepoint already returns
 * (ui/src/utils/nostrPublish.js publishEverywhere: { local: { success, error? }, external: { successes, failures,
 * details, skippedByGate? } }) and derives one summary line and one row per relay, in the relay order it was given.
 * The outcome vocabulary is the app's (src/lib/broadcastOutcome.js): published, kept-local, not-delivered; the rule is
 * restated here in three lines because that CommonJS module reaches the UI only through the Vite alias, which Node
 * cannot resolve.
 *
 * The browser publish sends locally and to the outside relays in parallel, so a failed local write does not stop the
 * sends: the failed-local lines say what the relays did (sub-decision 5). The server's profile publish is local-first
 * and says "so it was not sent"; story 3's server report will say that through describeServerPublish, here.
 */

const LOCAL_ONLY_REASON = 'local-only publish mode';
const NO_RESULT_REASON = 'no publish result';
const NO_LOCAL_REASON = "no answer from this instance's relay";

/** One relay's line, in the editor's words (AssistantProfileEditor.jsx RELAY_WORDS): the chokepoint's `refused` reads "rejected". */
export function relayLine(row) {
  const reason = row && row.reason ? String(row.reason) : '';
  switch (row && row.status) {
    case 'accepted': return 'accepted';
    case 'refused': return reason ? `rejected: ${reason}` : 'rejected';
    case 'unreachable': return reason ? `unreachable: ${reason}` : 'unreachable';
    case 'timeout': return reason ? `timed out: ${reason}` : 'timed out';
    case 'skipped': return `skipped (${LOCAL_ONLY_REASON})`;
    default: return String(row && row.status);
  }
}

/**
 * @param {{ name: string, local: ?{ success?: boolean, error?: string }, external: ?Object, relays: string[] }} input
 *   `name` the tagging's name (the summary's subject, in quotes); `local` and `external` from publishEverywhere;
 *   `relays` the outside relays the publish was given, in order.
 * @returns {{ ok: boolean, outcome: 'published'|'kept-local'|'not-delivered', message: string,
 *             rows: Array<{ relay: string, status: string, reason: string }>, accepted: number, tried: number }}
 *   `ok`: the local write succeeded or at least one relay accepted (the tagging exists somewhere).
 */
export function describeTaggingPublish({ name, local, external, relays }) {
  const list = Array.isArray(relays) ? relays : [];
  const ext = external && typeof external === 'object' ? external : {};
  const skipped = ext.skippedByGate === true;
  const details = ext.details && typeof ext.details === 'object' ? ext.details : {};
  const rows = list.map((relay) => {
    if (skipped) return { relay, status: 'skipped', reason: LOCAL_ONLY_REASON };
    const d = details[relay];
    if (d && typeof d === 'object' && d.status) return { relay, status: String(d.status), reason: d.reason ? String(d.reason) : '' };
    return { relay, status: 'unreachable', reason: NO_RESULT_REASON };
  });
  const tried = rows.filter((r) => r.status !== 'skipped');
  const accepted = tried.filter((r) => r.status === 'accepted').length;
  const n = tried.length;
  const localOk = !!local && local.success === true;
  const localReason = (local && local.error) ? String(local.error) : NO_LOCAL_REASON;
  const outcome = skipped || n === 0 ? 'kept-local' : accepted > 0 ? 'published' : 'not-delivered';
  const ok = localOk || accepted > 0;
  const subject = `"${name}"`;

  let message;
  if (localOk) {
    if (skipped) message = `${subject} was saved on this instance's relay only: ${LOCAL_ONLY_REASON} is on, so it was not sent to any other relay.`;
    else if (n === 0) message = `${subject} was saved on this instance's relay only: no outside relay was given.`;
    else if (accepted > 0) {
      message = `${subject} was saved on this instance's relay and accepted by ${accepted} of ${n} relays.`;
      if (accepted < n) message += ` ${n - accepted} did not accept it; see below.`;
    } else message = `${subject} was saved on this instance's relay, but none of the ${n} relays accepted it; see below.`;
  } else if (skipped || n === 0) {
    message = `${subject} could not be saved on this instance's relay (${localReason}), and ${LOCAL_ONLY_REASON} kept it from any other relay.`;
  } else if (accepted > 0) {
    message = `${subject} could not be saved on this instance's relay (${localReason}), but ${accepted} of ${n} relays accepted it.`;
  } else {
    message = `${subject} could not be saved on this instance's relay (${localReason}), and none of the ${n} relays accepted it.`;
  }
  return { ok, outcome, message, rows, accepted, tried: n };
}

/** The editor's tone rule: a partial or empty result never reads as a clean success. */
export function publishTone(report) {
  if (!report || !report.ok) return 'error';
  if (report.outcome === 'kept-local') return 'info';
  const tried = (report.rows || []).filter((r) => r.status !== 'skipped');
  return tried.length > 0 && tried.every((r) => r.status === 'accepted') ? 'success' : 'warning';
}
