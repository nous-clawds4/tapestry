/**
 * Two-layer settings system.
 *
 * Layer 1: defaults.json  — shipped with code, git-tracked, read-only at runtime
 * Layer 2: settings.json  — user overrides, lives on persistent volume (/var/lib/brainstorm/settings.json)
 *
 * At runtime: deepMerge(defaults, userSettings)
 *
 * The settings page reads the merged config and writes only to the override file.
 */

const fs = require('fs');
const path = require('path');

const DEFAULTS_PATH = path.join(__dirname, 'defaults.json');
const SETTINGS_PATH = process.env.TAPESTRY_SETTINGS_PATH
  || path.join(process.env.BRAINSTORM_BASE_DIR || '/var/lib/brainstorm', 'settings.json');

/**
 * Deep merge: target ← source. Arrays are replaced, not concatenated.
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])
      && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

/**
 * Load defaults (shipped with code).
 */
function loadDefaults() {
  try {
    return JSON.parse(fs.readFileSync(DEFAULTS_PATH, 'utf-8'));
  } catch (err) {
    console.error('settings: failed to read defaults.json:', err.message);
    return {};
  }
}

/**
 * Load user overrides (persistent volume).
 */
function loadOverrides() {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) return {};
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
  } catch (err) {
    console.warn('settings: failed to read settings.json:', err.message);
    return {};
  }
}

/**
 * Save user overrides to persistent volume.
 */
function saveOverrides(overrides) {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(overrides, null, 2) + '\n', 'utf-8');
}

/**
 * Get merged settings (defaults + overrides).
 */
function getSettings() {
  return deepMerge(loadDefaults(), loadOverrides());
}

/**
 * Get just the user overrides (for the settings page to show what's been customized).
 */
function getOverrides() {
  return loadOverrides();
}

/**
 * Get just the defaults (for the settings page to show original values).
 */
function getDefaults() {
  return loadDefaults();
}

/**
 * Update user overrides. Accepts a partial object — deep-merged with existing overrides.
 */
function updateOverrides(patch) {
  const current = loadOverrides();
  const updated = deepMerge(current, patch);
  saveOverrides(updated);
  return updated;
}

/**
 * Reset a specific key path back to default (remove from overrides).
 * keyPath is dot-separated, e.g. "aRelays.aProfileRelays"
 */
function resetOverride(keyPath) {
  const overrides = loadOverrides();
  const parts = keyPath.split('.');
  let obj = overrides;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') return overrides;
    obj = obj[parts[i]];
  }
  delete obj[parts[parts.length - 1]];
  // Clean up empty parent objects
  saveOverrides(overrides);
  return overrides;
}

/**
 * Path to the settings override file.
 */
function getSettingsPath() {
  return SETTINGS_PATH;
}

module.exports = {
  getSettings,
  getDefaults,
  getOverrides,
  updateOverrides,
  resetOverride,
  getSettingsPath,
  SETTINGS_PATH,
};
