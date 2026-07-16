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
function handleGetPublishPolicy(req, res) {
  try {
    // env first (per-deployment, also how tests drive it), then brainstorm.conf,
    // then default 'false' (guard off → external publishing). `!== undefined`
    // (not truthiness): an explicitly-set empty string counts as "present" and
    // resolves to guard-off — only the exact string 'true' engages the guard.
    const raw = process.env.BRAINSTORM_PUBLISH_LOCAL_ONLY !== undefined
      ? process.env.BRAINSTORM_PUBLISH_LOCAL_ONLY
      : getConfigFromFile('BRAINSTORM_PUBLISH_LOCAL_ONLY', 'false');
    const localOnly = raw === 'true';
    return res.json({ success: true, allowExternalPublish: !localOnly });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { handleGetPublishPolicy };
