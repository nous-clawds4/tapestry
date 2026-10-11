/**
 * Ask this instance to have the viewer's own Assistant sign and publish its Duty Menu (assistant-duty-menu #2, ADR 0002
 * sub-decision 8). One request per press, with no body: the server decides whose Assistant from the session and builds
 * the menu from its own offer, then answers one report in the profile publish's words
 * (ui/src/utils/taggingPublishReport.js describeServerPublish turns it into what the page draws).
 *
 * The one place the Duty Menu page touches the network, so the page itself never fetches. Throws when the instance did
 * not answer with JSON.
 *
 * @returns {Promise<{ status: number, success: boolean, result?: Object, code?: string, error?: string }>}
 */
export async function publishAssistantDutyMenu() {
  const res = await fetch('/api/assistant/duty-menu/publish', { method: 'POST' });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!data || typeof data !== 'object') throw new Error('This instance did not answer');
  return { status: res.status, ...data };
}
