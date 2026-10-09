/**
 * Negentropy Sync Command
 * Handles bulk synchronization of data using Negentropy protocol
 *
 * strfry runs with an argument list, never through a shell, and only after the relay is a ws:// or wss:// address and
 * the filter is a JSON object: nothing from the request reaches a command line as text to interpret.
 */

const childProcess = require('child_process');

const DEFAULT_RELAY = 'wss://relay.hasenpfeffr.com';
const DEFAULT_FILTER = '{"kinds":[3, 1984, 10000]}';

/** The relay as a ws(s) URL string, or null. */
function relayArg(input) {
    if (typeof input !== 'string') return null;
    const s = input.trim();
    if (!s || s.length > 512) return null;
    let url;
    try { url = new URL(s); } catch { return null; }
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') return null;
    if (!url.hostname || url.username || url.password) return null;
    return url.href;
}

/** The filter re-serialized from a JSON object, or null. */
function filterArg(input) {
    if (typeof input !== 'string' || input.length > 4096) return null;
    let parsed;
    try { parsed = JSON.parse(input); } catch { return null; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return JSON.stringify(parsed);
}

/**
 * Handler for Negentropy synchronization
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function handleNegentropySync(req, res) {
    console.log('Syncing with Negentropy...');

    // Set the response header to ensure it's always JSON
    res.setHeader('Content-Type', 'application/json');

    // Get relay and filter parameters from request body
    const body = (req && req.body) || {};
    const relay = relayArg(body.relay === undefined || body.relay === '' ? DEFAULT_RELAY : body.relay);
    const filter = filterArg(body.filter === undefined || body.filter === '' ? DEFAULT_FILTER : body.filter);
    if (!relay) return res.status(400).json({ success: false, output: '', error: 'The relay must be a ws:// or wss:// address.' });
    if (!filter) return res.status(400).json({ success: false, output: '', error: 'The filter must be a JSON object.' });

    console.log(`Using relay: ${relay}, filter: ${filter}`);

    // Set a timeout to ensure the response doesn't hang
    const timeoutId = setTimeout(() => {
        console.log('Negentropy sync is taking longer than expected, sending initial response...');
        res.json({
            success: true,
            continueInBackground: true,
            output: `Negentropy sync with ${relay} started.\nThis process will continue in the background. You can check Strfry Event statistics to track progress.\n`,
            error: null
        });
    }, 120000); // 2 minutes timeout

    const args = ['sync', relay, '--filter', filter, '--dir', 'down'];
    console.log(`Executing: strfry ${args.join(' ')}`);

    childProcess.execFile('strfry', args, (error, stdout, stderr) => {
        // Clear the timeout if the command completes before the timeout
        clearTimeout(timeoutId);

        // Check if the response has already been sent
        if (res.headersSent) {
            console.log('Response already sent, negentropy sync continuing in background');
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
    handleNegentropySync
};
