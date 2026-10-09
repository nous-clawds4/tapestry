/**
 * Ask this instance to have the viewer's own Assistant sign and publish its relay list (assistant-outbox-relays #3, ADR
 * 0003 sub-decision 7). One request per press; the server decides whose Assistant from the session and answers one
 * report in the profile publish's words (ui/src/utils/taggingPublishReport.js describeServerPublish turns it into what
 * the page draws).
 *
 * The one place the Outbox Relays page touches the network, so the page itself never fetches. Throws when the instance
 * did not answer with JSON.
 *
 * @param {string[]} relays - the page's draft, in order
 * @returns {Promise<{ status: number, success: boolean, result?: Object, code?: string, error?: string }>}
 */
export async function publishAssistantRelayList(relays) {
  const res = await fetch('/api/assistant/outbox-relays/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ relays }),
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!data || typeof data !== 'object') throw new Error('This instance did not answer');
  return { status: res.status, ...data };
}
