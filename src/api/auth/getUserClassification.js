const { getConfigFromFile, getAdminPubkeys } = require('../../utils/config');
const CustomerManager = require('../../utils/customerManager');
// One main->delegate mapping for the whole instance (ADR author-scoped-inspection/0001).
// This file used to carry its own narrowed copy of getAssistantKeys; it now calls the shared one.
const { getAssistantPubkeyFor } = require('../../utils/assistantKeys');

/**
 * Get user classification (owner/customer/regular user)
 * Returns the classification of the authenticated user, plus the caller's
 * server-side Assistant pubkey if one is provisioned.
 * to call: api/auth/user-classification
 */
async function handleGetUserClassification(req, res) {
    try {
        // Check if user is authenticated
        if (!req.session || !req.session.pubkey) {
            return res.json({
                success: true,
                classification: 'unauthenticated',
                pubkey: null,
                assistantPubkey: null,
            });
        }

        const userPubkey = req.session.pubkey;
        const assistantPubkey = await getAssistantPubkeyFor(userPubkey);

        // Get owner pubkey from brainstorm.conf
        let ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY');

        // Check if user is the owner
        if (ownerPubkey && userPubkey === ownerPubkey) {
            return res.json({
                success: true,
                classification: 'owner',
                pubkey: userPubkey,
                assistantPubkey,
            });
        }

        // Check if user is an admin
        const adminPubkeys = getAdminPubkeys();
        if (adminPubkeys.includes(userPubkey)) {
            return res.json({
                success: true,
                classification: 'admin',
                pubkey: userPubkey,
                assistantPubkey,
            });
        }

        // Check if user is a customer using CustomerManager
        try {
            const customerManager = new CustomerManager();
            await customerManager.initialize();

            // Get customer by pubkey
            const customer = await customerManager.getCustomer(userPubkey);

            if (customer && customer.status === 'active') {
                return res.json({
                    success: true,
                    classification: 'customer',
                    pubkey: userPubkey,
                    customerName: customer.name,
                    customerId: customer.id,
                    assistantPubkey,
                });
            }
        } catch (error) {
            console.error('Error checking customer status:', error);
        }

        // User is authenticated but not owner or customer
        return res.json({
            success: true,
            classification: 'guest',
            pubkey: userPubkey,
            assistantPubkey,
        });

    } catch (error) {
        console.error('Error in getUserClassification:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to determine user classification'
        });
    }
}

module.exports = { handleGetUserClassification };
