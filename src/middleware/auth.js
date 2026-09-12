/**
 * Brainstorm authentication API endpoints
 * Provides handlers for user authentication and session management
 */

const crypto = require('crypto');
const fs = require('fs');
const { getConfigFromFile, getAdminPubkeys } = require('../utils/config');
const CustomerManager = require('../utils/customerManager');

// ── Signed-challenge verification (ADR security-auth-exposure/0003) ──
// Resilient require, mirroring src/api/event/eventReadPath.js:38-40.
let _verifyEvent = null;
try { _verifyEvent = require('/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools').verifyEvent; }
catch { try { _verifyEvent = require('nostr-tools').verifyEvent; } catch { _verifyEvent = null; } }

// Auth-handshake event kinds accepted at login. The React app signs kind 22242; the legacy
// static sign-in pages sign kind 27235. Both are accepted; any other kind is rejected.
const AUTH_EVENT_KINDS = new Set([22242, 27235]);
// Freshness bound on the signed event's created_at — secondary to the single-use, session-
// bound challenge; it only rejects absurdly old / future timestamps.
const AUTH_EVENT_MAX_AGE_S = 600; // ±10 min

/**
 * Verify a signed login challenge. Returns { ok, reason }.
 * The security property is the conjunction of (a) event.pubkey === the pubkey the challenge was
 * issued for and (b) a valid signature for event.pubkey — together they prove the caller controls
 * the key the challenge was addressed to. verifyEvent runs on a JSON round-trip so a client-attached
 * `verifiedSymbol` cache / getters cannot be trusted.
 */
function verifyLoginEvent(event, { challenge, expectedPubkey }) {
    if (!_verifyEvent) return { ok: false, reason: 'verifier unavailable' };
    if (!event || typeof event !== 'object') return { ok: false, reason: 'no event' };
    if (!AUTH_EVENT_KINDS.has(event.kind)) return { ok: false, reason: 'bad kind' };
    if (event.pubkey !== expectedPubkey) return { ok: false, reason: 'pubkey mismatch' };
    const tag = Array.isArray(event.tags) && event.tags.find(t => t[0] === 'challenge');
    if (!tag || tag[1] !== challenge) return { ok: false, reason: 'bad challenge' };
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(event.created_at)) > AUTH_EVENT_MAX_AGE_S) return { ok: false, reason: 'stale' };
    let verified = false;
    try { verified = _verifyEvent(JSON.parse(JSON.stringify(event))) === true; } catch { verified = false; }
    return verified ? { ok: true } : { ok: false, reason: 'bad signature' };
}

/**
 * On a verified login, regenerate the session (defeat fixation), then set the minimal
 * authenticated shape. Identity (session.pubkey) is established ONLY here.
 */
function finalizeAuthenticatedSession(req, pubkey) {
    return new Promise((resolve, reject) => {
        req.session.regenerate(err => {
            if (err) return reject(err);
            req.session.authenticated = true;
            req.session.pubkey = pubkey;
            req.session.save(saveErr => (saveErr ? reject(saveErr) : resolve()));
        });
    });
}

/**
 * Verify if a pubkey belongs to the system owner
 */
function handleAuthVerify(req, res) {
    try {
        const { pubkey } = req.body;
        
        if (!pubkey) {
            return res.status(400).json({ error: 'Missing pubkey parameter' });
        }
        
        console.log(`Received authentication request from pubkey: ${pubkey}`);
        
        // Debug: Inspect the config file directly
        const confFile = '/etc/brainstorm.conf';
        let configContents = 'File not found';
        let configExists = false;
        
        try {
            if (fs.existsSync(confFile)) {
                configExists = true;
                configContents = fs.readFileSync(confFile, 'utf8');
                console.log('Config file exists. First 100 chars:', configContents.substring(0, 100) + '...');
            } else {
                console.error(`Config file does not exist at path: ${confFile}`);
            }
        } catch (configError) {
            console.error('Error accessing config file:', configError);
        }
        
        // Get owner pubkey from config
        const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY');
        
        console.log(`Owner pubkey from config: '${ownerPubkey}'`);
        
        // Create detailed debug info
        const debugInfo = {
            configExists,
            configPath: confFile,
            providedKey: pubkey,
            expectedKey: ownerPubkey || 'NOT_FOUND'
        };
        
        console.log('Auth debug info:', JSON.stringify(debugInfo, null, 2));
        
        if (!ownerPubkey) {
            console.error('BRAINSTORM_OWNER_PUBKEY not set in configuration');
            return res.json({ 
                authorized: false,
                message: 'The BRAINSTORM_OWNER_PUBKEY is not set in the server configuration',
                details: {
                    providedKey: pubkey,
                    expectedKey: 'NOT_CONFIGURED',
                    configExists,
                    configPath: confFile
                }
            });
        }
        
        // Check if the pubkey matches the owner pubkey
        const authorized = pubkey === ownerPubkey;
        console.log(`Authorization result: ${authorized} (${pubkey} === ${ownerPubkey})`);
        
        if (authorized) {
            // Generate a random challenge for the client to sign. Stash a PENDING claim —
            // never establish session identity (session.pubkey) before a verified login.
            const challenge = crypto.randomBytes(32).toString('hex');
            req.session.pendingAuth = { pubkey, challenge };

            return res.json({ authorized, challenge });
        } else {
            // Return detailed info about why auth failed
            const responseData = { 
                authorized: false, 
                message: `Only the owner can access the control panel`, 
                details: {
                    providedKey: pubkey,
                    expectedKey: ownerPubkey,
                    keyComparison: `${pubkey.substring(0, 8)}... !== ${ownerPubkey.substring(0, 8)}...`
                }
            };
            
            console.log('Sending unauthorized response:', JSON.stringify(responseData, null, 2));
            return res.json(responseData);
        }
    } catch (error) {
        console.error('Error verifying authentication:', error);
        return res.status(500).json({ 
            error: error.message,
            stack: error.stack
        });
    }
}

/**
 * Process login request with signed challenge
 */
async function handleAuthLogin(req, res) {
    try {
        const { event } = req.body;

        if (!event) {
            return res.status(400).json({ error: 'Missing event parameter' });
        }

        // A challenge must have been issued for this session. The claimed pubkey lives on the
        // PENDING claim — never as session identity, which is established only on a verified login.
        const pending = req.session.pendingAuth;
        if (!pending || !pending.pubkey || !pending.challenge) {
            return res.status(400).json({
                success: false,
                message: 'No active authentication session'
            });
        }

        // Single-use: consume the challenge on EVERY path (success or failure), so a replay of
        // the same challenge finds nothing pending.
        delete req.session.pendingAuth;
        delete req.session.challenge; // legacy field, if any

        const result = verifyLoginEvent(event, { challenge: pending.challenge, expectedPubkey: pending.pubkey });
        if (!result.ok) {
            return res.json({
                success: false,
                message: 'Challenge verification failed'
            });
        }

        // Verified. Regenerate the session (fixation defense), then set identity.
        await finalizeAuthenticatedSession(req, pending.pubkey);

        return res.json({
            success: true,
            message: 'Authentication successful'
        });
    } catch (error) {
        console.error('Error during login:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

/**
 * Handle user logout by destroying session
 */
function handleAuthLogout(req, res) {
    // Destroy the session
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({ error: 'Error logging out' });
        }
        
        res.json({ success: true, message: 'Logged out successfully' });
    });
}

/**
 * Get current authentication status
 */
function handleAuthStatus(req, res) {
    const isAuthenticated = req.session && req.session.authenticated === true;
    return res.json({
        authenticated: isAuthenticated,
        pubkey: isAuthenticated ? req.session.pubkey : null
    });
}

/**
 * Simple test endpoint to debug configuration access
 * Returns the owner public key directly
 */
function handleAuthTest(req, res) {
    try {
        // Direct config file inspection
        const confFile = '/etc/brainstorm.conf';
        let fileExists = false;
        let fileContents = '';
        
        try {
            if (fs.existsSync(confFile)) {
                fileExists = true;
                fileContents = fs.readFileSync(confFile, 'utf8').substring(0, 100) + '...'; // Just the first 100 chars
            }
        } catch (e) {
            console.error('Error reading config file directly:', e);
        }
        
        // Try to get owner key using our function
        const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY');
        
        return res.json({
            success: true,
            timestamp: Math.floor(Date.now() / 1000),
            ownerPubkey: ownerPubkey || 'NOT_FOUND',
            configFileExists: fileExists,
            configFilePath: confFile,
            configFilePreview: fileContents
        });
    } catch (error) {
        console.error('Error in auth test endpoint:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
}

/**
 * Check if a user is authenticated as the owner or an admin
 * @param {Object} req - Express request object
 * @returns {boolean} True if the user is the owner or admin, false otherwise
 */
function isOwnerOrAdmin(req) {
    if (!req.session || !req.session.authenticated || !req.session.pubkey) {
        return false;
    }
    const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY', '');
    if (req.session.pubkey === ownerPubkey) return true;
    const adminPubkeys = getAdminPubkeys();
    return adminPubkeys.includes(req.session.pubkey);
}

/**
 * Backward-compat alias for isOwnerOrAdmin
 * @param {Object} req - Express request object
 * @returns {boolean}
 */
function isOwner(req) {
    return isOwnerOrAdmin(req);
}


/**
 * Check if a user is authenticated as a customer
 * @param {Object} req - Express request object
 * @returns {Promise<boolean>} True if the user is a customer, false otherwise
 */
async function isCustomer(req) {
    // Check basic authentication first
    if (!req.session || !req.session.authenticated || !req.session.pubkey) {
        return false;
    }

    // Check if user is a customer using CustomerManager
    try {
        const customerManager = new CustomerManager();
        await customerManager.initialize();
        
        // Get customer by pubkey
        const customer = await customerManager.getCustomer(req.session.pubkey);
        
        return customer && customer.status === 'active';
    } catch (error) {
        console.error('Error checking customer status:', error);
        return false;
    }
}


/**
 * Authentication middleware
 * Handles three levels of access:
 * 1. Public access - No authentication required (read-only endpoints)
 * 2. User authentication - Any authenticated user (some write endpoints)
 * 3. Owner authentication - Only the system owner (administrative endpoints)
 */
async function authMiddleware(req, res, next) {
    // Skip auth for static resources, sign-in page and auth-related endpoints
    if (req.path === '/sign-in.html' || 
        req.path === '/index.html' ||
        req.path.startsWith('/api/auth/') ||
        req.path === '/' || 
        req.path === '/control-panel.html' ||
        req.path === '/nip85.html' ||
        req.path === '/nip85-control-panel.html' ||
        !req.path.startsWith('/api/')) {
        return next();
    }
    
    // Allow GENUINELY-DIRECT local access to normalize/neo4j (the trusted local
    // operator and the in-process firmware-install bridge). "Local" means the socket
    // peer is loopback AND the request carries no proxy-forwarding header: every nginx
    // hop in front of the app sets X-Forwarded-For ($proxy_add_x_forwarded_for), so a
    // proxied/external request always has one — a spoofed `X-Forwarded-For: 127.0.0.1`
    // is still a *present* header and is therefore treated as remote. `trust proxy`
    // stays OFF so req.ip is the real socket peer. (ADR security-auth-exposure/0001.)
    let remoteAddr = '';
    try { remoteAddr = req.ip || req.connection?.remoteAddress || ''; } catch { }
    const isLoopbackPeer = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remoteAddr);
    const viaProxy = !!(req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip']));
    const isDirectLocal = isLoopbackPeer && !viaProxy;
    // Broadened to all /api paths (ADR security-auth-exposure/0002): a genuinely-
    // direct-local call (loopback + no proxy header) is the operator, the
    // in-process firmware-install bridge, or a server-side loopback cron (e.g. the
    // trusted-list refreshers, which curl 127.0.0.1 directly) — all trusted. The
    // signal is externally unspoofable (nginx always sets X-Forwarded-For; a direct
    // hit to the app port has a non-loopback peer), so this never trusts remote traffic.
    if (isDirectLocal && req.path.startsWith('/api/')) {
        req.localTrusted = true;
        return next();
    }

    // Check if user is authenticated for API calls
    if (req.session && req.session.authenticated) {
        // TODO: differentiate between owner and customer endpoints
        // Endpoints accessible by any authenticated user (owner, customer, or guest)
        const authenticatedEndpoints = [
            '/negentropy-sync-wot',
            '/negentropy-sync-profiles',
            '/negentropy-sync-personal',
            '/negentropy-sync',
        ];
        const isAuthenticatedEndpoint = authenticatedEndpoints.some(endpoint =>
            req.path.includes(endpoint)
        );
        if (isAuthenticatedEndpoint) {
            return next(); // Already verified authenticated above
        }

        const customerOrOwnerEndpoints = [
            '/get-customer',
            '/neo4j/query',
        ]
        // Define owner-only endpoints (administrative actions)
        const ownerOnlyEndpoints = [
            '/brainstorm-control',
            '/post-graperank-config',
            '/api/post-blacklist-config',
            '/post-whitelist-config',
            '/generate-blacklist',
            '/export-whitelist',
            '/generate-graperank',
            '/generate-pagerank',
            '/personalized-pagerank',
            '/generate-verified-followers',
            '/generate-reports',
            '/generate-nip85',
            '/systemd-services',
            '/toggle-strfry-filteredContent',
            '/delete-all-relationships',
            '/batch-transfer',
            '/reconciliation',
            '/calculate-hops',
            '/neo4j-setup-constraints-and-indexes',
            '/run-script',
            '/process-all-active-customers',
            '/create-all-customer-relays',
            '/sign-up-new-customer',
            '/delete-customer',
            '/change-customer-status',
            '/service-management/control',
            '/add-new-customer',
            '/update-customer-display-name',
            '/backup-customers',
            '/backups',
            '/backups/download',
            '/restore/upload',
            '/restore/sets',
            '/restore/customer',
            '/api/normalize'
        ];

        // Check if this endpoint is for customer or owner only
        const isCustomerOrOwnerEndpoint = customerOrOwnerEndpoints.some(endpoint => 
            req.path.includes(endpoint)
        );

        // If this endpoint is for customer or owner AND if the user is authenticated, AND if the user is the owner or a customer allow it
        if (isCustomerOrOwnerEndpoint) {
            if (req.session && req.session.authenticated && (isOwner(req) || await isCustomer(req))) {
                return next();
            } else {
                return res.status(403).json({ 
                    error: 'Proper authentication required. Only the system owner or a customer can perform this action.'
                });
            }
        }
        
        // Check if this endpoint requires owner authentication
        const isOwnerPostEndpoint = ownerOnlyEndpoints.some(endpoint => 
            req.path.includes(endpoint) && req.method === 'POST'
        );

        // Owner-only GET endpoints (sensitive reads)
        const ownerOnlyGetEndpoints = [
            '/backups',
            '/backups/download',
            '/restore/sets',
            '/get-customer-relay-keys'
        ];
        const isOwnerGetEndpoint = ownerOnlyGetEndpoints.some(endpoint => 
            req.path.includes(endpoint) && req.method === 'GET'
        );
        
        // If this is an owner-only endpoint, verify owner status
        if ((isOwnerPostEndpoint || isOwnerGetEndpoint) && !isOwner(req)) {
            return res.status(403).json({ 
                error: 'Admin authentication required. Only the system owner can perform this action.'
            });
        }
        
        // User is authenticated and has appropriate permissions
        return next();
    } else {
        // Default-DENY for mutations (ADR security-auth-exposure/0002): any
        // state-changing request from an unauthenticated caller is rejected unless
        // its path is explicitly public. This replaces the old hand-maintained
        // `writeEndpoints` allowlist, which was POST-only (so PUT/PATCH/DELETE
        // mutations like `DELETE .../meili/wipe` slipped through) and left every
        // unlisted mutation — e.g. `/api/firmware/install` — reachable by anyone.
        const MUTATING = ['POST', 'PUT', 'PATCH', 'DELETE'];
        // Mutations that must stay reachable without a session. Each defers its own
        // finer gate to the handler: `/api/neo4j/query` gates write-Cypher (ADR 0001);
        // `/api/strfry/publish` gates signAs:'assistant' (ADR 0002); client-signed
        // publishing is permissionless by design. Exact-match — an allowlist must
        // never over-match a private path.
        const PUBLIC_MUTATIONS = ['/api/neo4j/query', '/api/strfry/publish'];
        if (MUTATING.includes(req.method) && !PUBLIC_MUTATIONS.includes(req.path)) {
            return res.status(401).json({ error: 'Authentication required for this action' });
        }

        // Sensitive GET reads that also require authentication.
        const protectedGetEndpoints = [
            '/backups',
            '/backups/download',
            '/restore/sets',
            '/get-customer-relay-keys'
        ];
        const isProtectedGetEndpoint = protectedGetEndpoints.some(endpoint =>
            req.path.includes(endpoint) && req.method === 'GET'
        );
        if (isProtectedGetEndpoint) {
            return res.status(401).json({ error: 'Authentication required for this action' });
        }

        // Public read-only API access.
        return next();
    }
}

/**
 * Verify any valid Nostr user (not just owner)
 * This endpoint allows any user with a valid pubkey to authenticate
 */
function handleAuthVerifyUser(req, res) {
    try {
        const { pubkey } = req.body;
        
        if (!pubkey) {
            return res.status(400).json({ error: 'Missing pubkey parameter' });
        }
        
        console.log(`Received user authentication request from pubkey: ${pubkey}`);
        
        // Basic validation - check if pubkey looks like a valid hex string
        if (!/^[0-9a-fA-F]{64}$/.test(pubkey)) {
            return res.json({
                authorized: false,
                message: 'Invalid pubkey format. Must be 64-character hex string.'
            });
        }
        
        // For general user authentication, we accept any valid pubkey.
        // Generate a random challenge for the client to sign, and stash a PENDING claim —
        // identity (session.pubkey) is never established before a verified login.
        const challenge = crypto.randomBytes(32).toString('hex');
        req.session.pendingAuth = { pubkey, challenge };
        
        // Check if this user is the owner or admin for role information
        const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY');
        const isOwnerUser = pubkey === ownerPubkey;
        const adminPubkeys = getAdminPubkeys();
        const isAdminUser = adminPubkeys.includes(pubkey);
        
        return res.json({ 
            authorized: true, 
            challenge,
            isOwner: isOwnerUser || isAdminUser,
            message: isOwnerUser ? 'Owner authentication successful' : isAdminUser ? 'Admin authentication successful' : 'User authentication successful'
        });
        
    } catch (error) {
        console.error('Error in handleAuthVerifyUser:', error);
        return res.status(500).json({ error: 'Internal server error during authentication' });
    }
}

/**
 * Login endpoint for general users (not just owner)
 * Processes the signed challenge from any authenticated user
 */
async function handleAuthLoginUser(req, res) {
    try {
        const { event } = req.body;

        if (!event) {
            return res.status(400).json({ success: false, message: 'Missing signed event' });
        }

        const pending = req.session.pendingAuth;
        if (!pending || !pending.pubkey || !pending.challenge) {
            return res.status(400).json({ success: false, message: 'No active authentication session' });
        }

        // Single-use: consume the challenge on EVERY path (success or failure).
        delete req.session.pendingAuth;
        delete req.session.challenge; // legacy field, if any

        const result = verifyLoginEvent(event, { challenge: pending.challenge, expectedPubkey: pending.pubkey });
        if (!result.ok) {
            return res.status(400).json({ success: false, message: 'Invalid signed event' });
        }

        const pubkey = pending.pubkey;

        // Role for the response body only (config-derived; not stored on the session).
        const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY');
        const adminPubkeys = getAdminPubkeys();
        const isOwnerUser = pubkey === ownerPubkey || adminPubkeys.includes(pubkey);
        const isCustomerUser = false;

        // Verified. Regenerate the session (fixation defense), then set identity.
        await finalizeAuthenticatedSession(req, pubkey);

        console.log(`User authentication successful for pubkey: ${pubkey} (owner: ${isOwnerUser})`);

        return res.json({
            success: true,
            message: 'Authentication successful',
            isOwner: isOwnerUser,
            isCustomer: isCustomerUser,
            pubkey
        });

    } catch (error) {
        console.error('Error in handleAuthLoginUser:', error);
        return res.status(500).json({ success: false, message: 'Internal server error during login' });
    }
}

module.exports = {
    handleAuthVerify,
    handleAuthLogin,
    handleAuthLogout,
    handleAuthStatus,
    handleAuthTest,
    handleAuthVerifyUser,
    handleAuthLoginUser,
    authMiddleware,
    isOwner,
    isOwnerOrAdmin
};
