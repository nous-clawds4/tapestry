/**
 * Owner Information API handler
 * Provides information about the relay owner
 */

const { getConfigFromFile } = require('../../utils/config');

/**
 * Handle request for owner information
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function handleGetOwnerInfo(req, res) {
    try {
        // Get owner pubkey and npub from configuration
        const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY');
        const ownerNpub = getConfigFromFile('BRAINSTORM_OWNER_NPUB');
        const domainName = getConfigFromFile('STRFRY_DOMAIN');

        // Verified cutoffs (Owner PoV) — surfaced for the "what does verification mean?"
        // explainer popover (ADR 0032). The UI shows these ×100 (0.05 → 5 out of 100).
        const verifiedFollowersCutoff = parseFloat(getConfigFromFile('VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF', 0.05));
        const verifiedReportersCutoff = parseFloat(getConfigFromFile('VERIFIED_REPORTERS_INFLUENCE_CUTOFF', 0.05));

        // Return owner information
        res.json({
            success: true,
            ownerPubkey,
            ownerNpub,
            domainName,
            verifiedFollowersCutoff,
            verifiedReportersCutoff
        });
    } catch (error) {
        console.error('Error getting owner information:', error);
        res.status(500).json({
            success: false,
            error: 'Error retrieving owner information'
        });
    }
}

module.exports = {
    handleGetOwnerInfo
};
