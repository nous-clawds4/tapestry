/**
 * Reset a customer's config file to the default template.
 * Copies from customers/default/preferences/<configType>.conf
 *
 * POST /api/algos/config/reset?pubkey=<hex>&configType=<graperank|whitelist|blacklist>
 */

const fs = require('fs');
const path = require('path');
const CustomerManager = require('../../../../utils/customerManager');
const { getConfigFromFile } = require('../../../../utils/config');

const VALID_CONFIG_TYPES = ['graperank', 'whitelist', 'blacklist'];

async function handleResetConfig(req, res) {
  try {
    const { pubkey, configType } = req.query;

    if (!pubkey || !/^[0-9a-f]{64}$/.test(pubkey)) {
      return res.status(400).json({ success: false, error: 'Valid pubkey is required' });
    }
    if (!configType || !VALID_CONFIG_TYPES.includes(configType)) {
      return res.status(400).json({ success: false, error: `configType must be one of: ${VALID_CONFIG_TYPES.join(', ')}` });
    }

    // Verify caller is owner or the customer themselves
    const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY');
    if (req.session?.pubkey !== pubkey && req.session?.pubkey !== ownerPubkey) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    // Find the customer
    const customerManager = new CustomerManager();
    await customerManager.initialize();
    const customer = await customerManager.getCustomer(pubkey);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // Find the default preferences file
    const baseDir = getConfigFromFile('BRAINSTORM_MODULE_BASE_DIR', '/usr/local/lib/node_modules/brainstorm/');
    const defaultFile = path.join(baseDir, 'customers', 'default', 'preferences', `${configType}.conf`);
    if (!fs.existsSync(defaultFile)) {
      return res.status(404).json({ success: false, error: `Default ${configType}.conf not found` });
    }

    // Copy to customer's preferences directory
    const customersDir = customerManager.customersDir || '/var/lib/brainstorm/customers';
    const destDir = path.join(customersDir, customer.directory, 'preferences');
    const destFile = path.join(destDir, `${configType}.conf`);

    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(defaultFile, destFile);
    fs.chmodSync(destFile, '644');

    console.log(`[config-reset] Reset ${configType}.conf to default for customer ${customer.directory}`);

    return res.json({
      success: true,
      message: `${configType} configuration reset to default`,
      configType,
      customer: customer.directory,
    });
  } catch (err) {
    console.error('[config-reset] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { handleResetConfig };
