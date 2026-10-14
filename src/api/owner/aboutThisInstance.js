/**
 * GET /api/about-this-instance — public.
 *
 * Who runs this instance and how many customers it has, for the "About this Brainstorm Instance" section on /about
 * (story about-this-instance #1, ADR about-this-instance/0001 Decision 1). The answer is exactly
 * { success, ownerPubkey, adminPubkeys, customerCount }: two kinds of pubkey and one number, so no customer identity
 * and no key material can reach the page however it is rendered.
 */

const HEX64 = /^[0-9a-f]{64}$/i;

/** The real dependencies, required lazily so the module loads in a bare checkout. */
function defaultDeps() {
    return {
        getOwnerPubkey: () => require('../../utils/config').getConfigFromFile('BRAINSTORM_OWNER_PUBKEY'),
        getAdminPubkeys: () => require('../../utils/config').getAdminPubkeys(),
        countInstanceCustomers: () => require('../../utils/assistantKeys').countInstanceCustomers(),
    };
}

/** Lower-cased 64-hex, or null. */
function hex(pk) {
    return typeof pk === 'string' && HEX64.test(pk) ? pk.toLowerCase() : null;
}

async function handleGetAboutThisInstance(req, res, deps = {}) {
    const d = { ...defaultDeps(), ...deps };
    try {
        const ownerPubkey = hex(d.getOwnerPubkey());

        // Configured order kept; duplicates and invalid entries dropped; the Owner is shown only as Owner.
        const adminPubkeys = [];
        for (const entry of d.getAdminPubkeys() || []) {
            const pk = hex(entry);
            if (pk && pk !== ownerPubkey && !adminPubkeys.includes(pk)) adminPubkeys.push(pk);
        }

        const customerCount = await d.countInstanceCustomers();

        return res.json({ success: true, ownerPubkey, adminPubkeys, customerCount });
    } catch (error) {
        console.error('Error in handleGetAboutThisInstance:', error);
        return res.status(500).json({ success: false, error: 'Error retrieving this instance\'s details' });
    }
}

module.exports = { handleGetAboutThisInstance };
