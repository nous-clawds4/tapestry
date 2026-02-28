/**
 * System Status Query Handler
 * Returns the status of the strfry service and domain information
 */

const { exec } = require('child_process');
const { getConfigFromFile } = require('../../../utils/config');

/**
 * Handler for getting system status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function handleStatus(req, res) {
    console.log('Checking status...');
    
    // Get the STRFRY_DOMAIN and NEO4J_BROWSER_URL from config
    const strfryDomain = getConfigFromFile('STRFRY_DOMAIN', 'localhost');
    const neo4jBrowserUrl = getConfigFromFile('BRAINSTORM_NEO4J_BROWSER_URL', 'http://localhost:7474');
    
    exec('supervisorctl status strfry 2>/dev/null || systemctl status strfry 2>/dev/null', (error, stdout, stderr) => {
        return res.json({
            output: stdout || stderr,
            strfryDomain: strfryDomain,
            neo4jBrowserUrl: neo4jBrowserUrl
        });
    });
}

module.exports = {
    handleStatus
};
