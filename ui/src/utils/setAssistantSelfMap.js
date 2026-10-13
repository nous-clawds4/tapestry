/**
 * Ask this instance to turn the viewer's own Assistant's self-Map on or off (assistant-self-map #2, ADR 0002
 * sub-decision 7). One request per press, carrying one bit, `{ on }`: Turn on and Update now send `true`, Turn off
 * `false`. The server decides whose Assistant from the session and builds the self-entries from its own check, then
 * answers one report in the profile publish's words (ui/src/utils/taggingPublishReport.js describeServerPublish turns
 * it into what the page draws), or a refusal with its words.
 *
 * The one place the Your Assistant's Treasure Map page touches the network, so the page itself never fetches. Throws
 * when the instance did not answer with JSON.
 *
 * @param {boolean} on
 * @returns {Promise<{ status: number, success: boolean, result?: Object, code?: string, error?: string }>}
 */
export async function setAssistantSelfMap(on) {
  const res = await fetch('/api/assistant/self-map', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ on: on === true }),
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!data || typeof data !== 'object') throw new Error('This instance did not answer');
  return { status: res.status, ...data };
}
