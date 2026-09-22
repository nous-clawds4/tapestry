/**
 * Ask this instance to have the viewer's own Assistant sign and publish its identification taggings of them
 * (assistant-identification-tags #3, ADR 0003 sub-decision 7). One request per press; the server decides whose
 * Assistant from the session and answers one report per requested tagging, in the profile publish's words
 * (ui/src/utils/taggingPublishReport.js describeServerPublish turns each into what the cards draw).
 *
 * The one place the Identification Tags page touches the network for the second card, so the page itself never
 * fetches (its S1 sentinel). Throws when the instance did not answer with JSON.
 *
 * @param {string[]} keys - the required taggings' keys whose signer is the Assistant (e.g. 'my-human')
 * @returns {Promise<{ status: number, success: boolean, results?: Object[], code?: string, error?: string }>}
 */
export async function publishAssistantIdentificationTaggings(keys) {
  const res = await fetch('/api/assistant/identification-tags/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keys }),
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!data || typeof data !== 'object') throw new Error('This instance did not answer');
  return { status: res.status, ...data };
}
