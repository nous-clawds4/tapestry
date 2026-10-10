/**
 * NIP-85 Kind 10040 Commands
 * Handles creation and management of Kind 10040 events
 */

const path = require('path');
const { execFile } = require('child_process');
const { spawn } = require('child_process');
const fs = require('fs');
const { getConfigFromFile } = require('../../../../utils/config');

/**
 * Create Kind 10040 events
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function handleCreateAndPublishKind10040(req, res) {
    // Check if user is authenticated
    if (!req.session.authenticated) {
        return res.status(401).json({ 
            success: false, 
            message: 'Authentication required.' 
        });
    }

    // Get the customer pubkey from the request
    const customerPubkey = req.body.pubkey;
    if (customerPubkey && (typeof customerPubkey !== 'string' || !/^[0-9a-f]{64}$/i.test(customerPubkey))) {
        return res.status(400).json({ success: false, message: 'Invalid pubkey' });
    }
    
    console.log('Creating kind 10040 events...');
    
    // Set the response header to ensure it's always JSON
    res.setHeader('Content-Type', 'application/json');
    
    // Get the base directory from config with fallback
    const baseDir = getConfigFromFile('BRAINSTORM_MODULE_BASE_DIR', '/usr/local/lib/node_modules/brainstorm');
    
    // Get the full path to the script
    // The script runs with an argument list, never a shell string; customerPubkey, if given, is its one argument.
    const scriptPath = path.join(baseDir, 'bin', 'brainstorm-create-and-publish-kind10040.js');
    const scriptArgs = customerPubkey ? [scriptPath, customerPubkey] : [scriptPath];
    console.log('Using script path:', scriptPath);
    
    // Set a timeout to ensure the response doesn't hang
    const timeoutId = setTimeout(() => {
        console.log('Kind 10040 creation is taking longer than expected, sending initial response...');
        res.json({
            success: true,
            output: 'Kind 10040 creation started. This process will continue in the background.\n',
            error: null
        });
    }, 30000); // 30 seconds timeout
    
    execFile('node', scriptArgs, (error, stdout, stderr) => {
        // Clear the timeout if the command completes before the timeout
        clearTimeout(timeoutId);
        
        // Check if the response has already been sent
        if (res.headersSent) {
            console.log('Response already sent, kind 10040 creation continuing in background');
            return;
        }
        
        return res.json({
            success: !error,
            output: stdout || stderr,
            error: error ? error.message : null
        });
    });
}

module.exports = {
    handleCreateAndPublishKind10040
};
