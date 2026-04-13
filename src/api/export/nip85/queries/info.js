/**
 * NIP-85 Information Queries
 * Handlers for retrieving information about NIP-85 events
 * accepts parameter: pubkey
 * If no pubkey is provided, it will use the owner pubkey from config
 * /api/get-kind10040-info?pubkey=...
 * 
 * TODO: support looking for 10040 notes and/or 30382 notes in mirror nip85 relays, not local relay
 * param: nip85MirrorRelayUrl
 */

const { execSync } = require('child_process');
const { getConfigFromFile } = require('../../../../utils/config');
const { getAssistantKeys } = require('../../../../utils/assistantKeys');
/**
 * Get information about Kind 10040 events
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function handleGetKind10040Info(req, res) {
  try {
    // Get pubkey from request if available
    const requestPubkey = req.query.pubkey;
    // Get owner pubkey from config
    const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY', '');
    const relayUrl = getConfigFromFile('BRAINSTORM_RELAY_URL', '');
    
    if (!ownerPubkey) {
      return res.json({
        success: false,
        message: 'Owner pubkey not found in configuration'
      });
    }

    let pubkey = ownerPubkey;
    if (requestPubkey) {
      pubkey = requestPubkey;
    }
    
    // Get most recent kind 10040 event
    const strfryScanCmd = `strfry scan '{"kinds":[10040], "authors":["${pubkey}"], "limit": 1}'`;
    let latestEvent = null;
    let timestamp = null;
    let eventId = null;
    
    try {
      const output = execSync(strfryScanCmd).toString().trim();
      if (output) {
        latestEvent = JSON.parse(output);
        timestamp = latestEvent.created_at;
        eventId = latestEvent.id;
      }
    } catch (error) {
      console.error('Error getting latest event:', error);
    }
    
    return res.json({
      success: true,
      pubkey: pubkey,
      strfryScanCmd: strfryScanCmd,
      timestamp: timestamp,
      eventId: eventId,
      latestEvent: latestEvent,
      relayUrl: relayUrl
    });
  } catch (error) {
    return res.json({
      success: false,
      message: `Error getting kind 10040 info: ${error.message}`
    });
  }
}

/**
 * Get information about Kind 30382 events
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handleGetKind30382Info(req, res) {
  try {
    // Get pubkey from request, or default to session user (owner on nip85.html)
    const customerPubkey = req.query.pubkey || req.session?.pubkey;

    if (!customerPubkey) {
      return res.json({
        success: false,
        message: 'Pubkey is required (provide in query or sign in)'
      });
    }

    console.log(`Fetching relay keys for: ${customerPubkey.substring(0, 8)}...`);

    let relayPubkey = null;
    // Get assistant relay keys (unified: owner → TA key, customer → customer relay key)
    const relayKeys = await getAssistantKeys(customerPubkey);
    if (relayKeys) {
      relayPubkey = relayKeys.pubkey;
    }

    if (!relayPubkey) {
      return res.json({
        success: false,
        message: 'Relay pubkey not found in configuration'
      });
    }

    // Get relay url from config
    const relayUrl = getConfigFromFile('BRAINSTORM_RELAY_URL', '');
    
    // Get count of kind 30382 events
    const strfryScanCountCmd = `strfry scan --count '{"kinds":[30382], "authors":["${relayPubkey}"]}'`;
    let count = 0;
    try {
      count = parseInt(execSync(strfryScanCountCmd).toString().trim(), 10);
    } catch (error) {
      console.error('Error getting event count:', error);
    }
    
    // Get most recent kind 30382 event
    const strfryScanCmd = `strfry scan '{"kinds":[30382], "authors":["${relayPubkey}"], "limit": 1}'`;
    let latestEvent = null;
    let timestamp = null;
    
    try {
      const output = execSync(strfryScanCmd).toString().trim();
      if (output) {
        latestEvent = JSON.parse(output);
        timestamp = latestEvent.created_at;
      }
    } catch (error) {
      console.error('Error getting latest event:', error);
    }
    
    return res.json({
      success: true,
      strfryScanCountCmd: strfryScanCountCmd,
      strfryScanCmd: strfryScanCmd,
      count: count,
      timestamp: timestamp,
      latestEvent: latestEvent,
      relayUrl: relayUrl
    });
  } catch (error) {
    return res.json({
      success: false,
      message: `Error getting kind 30382 info: ${error.message}`
    });
  }
}

module.exports = {
  handleGetKind10040Info,
  handleGetKind30382Info
};
