/**
 * Create Unsigned Kind 10040 Event
 * 
 * /api/create-unsigned-kind10040
 * 
 * Creates an unsigned Kind 10040 event template for NIP-85 trusted assertions
 * that can be signed by the user using NIP-07 browser extension
 */

const { getConfigFromFile } = require('../../../../utils/config');
const { getAssistantKeys } = require('../../../../utils/assistantKeys');
const { trustAssertionRows, buildTreasureMapTemplate } = require('../../../../lib/treasureMapMerge');
const { fetchCurrentMap } = require('../currentMap');

/**
 * Create unsigned Kind 10040 event template
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handleCreateUnsignedKind10040(req, res) {
    try {
        // Check if user is authenticated
        if (!req.session.authenticated) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required.' 
            });
        }

        // Get pubkey from request body, query, or default to the authenticated session user (owner)
        const customerPubkey = req.body.pubkey || req.query.pubkey || req.session.pubkey;

        if (!customerPubkey) {
            return res.status(400).json({
                success: false,
                message: 'Pubkey is required (provide in body/query or sign in)'
            });
        }

        console.log(`Creating unsigned Kind 10040 event for: ${customerPubkey.substring(0, 8)}...`);
        
        // Get relay configuration
        // TODO: allow owner to specify whether to use BRAINSTORM_RELAY_URL or BRAINSTORM_NIP85_HOME_RELAY
        const relayUrl = getConfigFromFile('BRAINSTORM_RELAY_URL', '');
        const nip85HomeRelay = getConfigFromFile('BRAINSTORM_NIP85_HOME_RELAY', relayUrl);
        // const nip85HomeRelay = "wss://nip85.brainstorm.world"
        
        if (!relayUrl) {
            return res.status(500).json({
                success: false,
                message: 'Relay URL not configured'
            });
        }

        // Get assistant relay keys (unified: owner → TA key, customer → customer relay key)
        const relayKeys = await getAssistantKeys(customerPubkey);

        if (!relayKeys || !relayKeys.pubkey) {
            return res.status(404).json({
                success: false,
                message: 'Assistant relay keys not found. Please ensure the relay identity has been created.'
            });
        }

        const relayPubkey = relayKeys.pubkey;

        // dlist-curation #7: never regenerate blind. Read the user's CURRENT Map (local strfry,
        // then the relays) and preserve every tag this generator does not own — the 30392
        // Trusted-Lists delegation, per-DList curation entries, the assistant designation, and
        // anything another tool wrote. Only the 30382:* rows are regenerated.
        let current;
        try {
            current = await fetchCurrentMap(customerPubkey);
        } catch (err) {
            return res.status(503).json({
                success: false,
                message: `Not regenerating blind: ${err.message}`
            });
        }
        const freshRows = trustAssertionRows(relayPubkey, nip85HomeRelay);
        const { template: unsignedEvent, preserved, regenerated } = buildTreasureMapTemplate({
            pubkey: customerPubkey, // This will be the customer's pubkey (user who signs)
            existingEvent: current.event,
            freshRows,
        });

        res.json({
            success: true,
            data: {
                unsignedEvent: unsignedEvent,
                relayUrl: relayUrl,
                relayPubkey: relayPubkey,
                merge: { preserved, regenerated, currentMap: current.where },
                message: `Unsigned Kind 10040 event created (${preserved} existing tag(s) preserved, ${regenerated} Trust-Assertion row(s) regenerated; current Map: ${current.where}). Please sign with NIP-07 browser extension.`
            }
        });
    } catch (error) {
        console.error('Error creating unsigned Kind 10040 event:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while creating unsigned event'
        });
    }
}

module.exports = {
    handleCreateUnsignedKind10040
};
