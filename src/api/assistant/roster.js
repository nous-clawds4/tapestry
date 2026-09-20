/**
 * GET /api/assistant/roster
 *
 * Which assistants this instance controls, and which account controls each one
 * (ADR author-scoped-inspection/0001).
 *
 * The response is SESSION-SHAPED, not a single public/private flag. The instance already
 * publishes its customers' account pubkeys (GET /api/get-customers, unguarded) and its own
 * assistant pubkey (GET /api/assistant/pubkey, unguarded), so joining the two discloses nothing
 * new. Its admin roster is a different matter: GET /api/admin/list is registered behind
 * requireOwnerOnly, and a blanket-public roster carrying admins would defeat that guard as a side
 * effect. So:
 *
 *   caller            owner  customers  admins  self
 *   unauthenticated     y        y        n      -
 *   customer / admin    y        y        n      y   (always, so "Mine" resolves)
 *   owner               y        y        y      y
 *
 * A caller therefore cannot assume the roster is complete, and must never read absence from it as
 * "not an assistant" — only as "not one we control". Assistants controlled elsewhere are the
 * tapestry-assistant concept's business, and are not built.
 *
 * This handler goes through the narrowed accessors only. It never touches the key object that
 * carries private material.
 */

const { listInstanceAssistants, getAssistantPubkeyFor } = require('../../utils/assistantKeys');
const { getConfigFromFile } = require('../../utils/config');

async function handleGetAssistantRoster(req, res) {
    try {
        const sessionPubkey = (req.session && req.session.pubkey) || null;
        const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY');
        const includeAdmins = Boolean(sessionPubkey && ownerPubkey && sessionPubkey === ownerPubkey);

        const assistants = await listInstanceAssistants({ includeAdmins });

        // The caller's own pair, always — an admin this response does not disclose still needs
        // "Mine" to resolve, and telling you about yourself discloses nothing. It rides in `viewer`
        // rather than as a synthesised roster row: the row would need a role, and the only role we
        // could infer for a caller the roster does not list is a guess.
        let viewer = null;
        if (sessionPubkey) {
            const own = assistants.find((a) => a.accountPubkey === sessionPubkey);
            viewer = {
                accountPubkey: sessionPubkey,
                assistantPubkey: own ? own.assistantPubkey : await getAssistantPubkeyFor(sessionPubkey),
            };
        }

        return res.json({ success: true, assistants, viewer });
    } catch (err) {
        console.error('Error in handleGetAssistantRoster:', err);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
}

module.exports = { handleGetAssistantRoster };
