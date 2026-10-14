/**
 * The Scores page's two requests (assistant-scores #1, ADR assistant-scores/0001): the one place the page touches the
 * network, so the page itself never fetches. Neither request names anyone: the server answers for the session.
 */

/**
 * GET /api/assistant/scores: when the viewer's own Assistant last published Trusted Assertions, how many, which
 * pipeline is theirs, and whether a run of theirs is queued or running. Throws when the instance did not answer JSON.
 * @returns {Promise<Object>}
 */
export async function fetchAssistantScores() {
  const res = await fetch('/api/assistant/scores');
  const data = await res.json();
  if (!data || typeof data !== 'object') throw new Error('This instance did not answer');
  return data;
}

/**
 * POST /api/assistant/scores/recalculate, with no body: one request per press. A refusal is answered with its status
 * and code, not thrown. Throws when the instance did not answer JSON.
 * @returns {Promise<{ status: number, success: boolean, run?: string, code?: string, error?: string }>}
 */
export async function recalculateAssistantScores() {
  const res = await fetch('/api/assistant/scores/recalculate', { method: 'POST' });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!data || typeof data !== 'object') throw new Error('This instance did not answer');
  return { status: res.status, ...data };
}
