/**
 * Public publish-policy endpoint — no auth.
 *
 * Surfaces the deployment's external-publishing posture to the client (Story 2 /
 * event-tagging ADR 0002). The client's publish path (ui/src/utils/nostrPublish.js)
 * consults this before fanning out to external relays.
 *
 * Posture is the per-deployment, opt-in LOCAL-ONLY guard:
 *   BRAINSTORM_PUBLISH_LOCAL_ONLY === 'true'  -> guard ON  -> allowExternalPublish:false
 *   unset / anything else (the default)        -> guard OFF -> allowExternalPublish:true
 *
 * Only the exact string 'true' engages the guard; the default is external
 * publishing, so existing deployments are unaffected with no config change.
 */

const { getConfigFromFile } = require('../../utils/config');

/**
 * GET /api/publish-policy
 * Returns { success, allowExternalPublish }. Public — not sensitive.
 */
/**
 * The deployment's posture, read in one place. The endpoint below answers from it, and so does the
 * server-side assistant publish path (ADR assistant-profile/0002), so the browser and the server can
 * never read this flag differently.
 *
 * env first (per-deployment, also how tests drive it), then brainstorm.conf, then default 'false'
 * (guard off → external publishing). `!== undefined` (not truthiness): an explicitly-set empty string
 * counts as "present" and resolves to guard-off — only the exact string 'true' engages the guard.
 */
function isPublishLocalOnly() {
  const raw = process.env.BRAINSTORM_PUBLISH_LOCAL_ONLY !== undefined
    ? process.env.BRAINSTORM_PUBLISH_LOCAL_ONLY
    : getConfigFromFile('BRAINSTORM_PUBLISH_LOCAL_ONLY', 'false');
  return raw === 'true';
}

function handleGetPublishPolicy(req, res) {
  try {
    return res.json({ success: true, allowExternalPublish: !isPublishLocalOnly() });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { handleGetPublishPolicy, isPublishLocalOnly };
