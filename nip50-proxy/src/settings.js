/**
 * House preferences reader for the NIP-50 proxy.
 *
 * Reads the Tapestry settings (defaults.json + settings.json override)
 * to resolve the house-level delegated pubkey for WoT POV fallback.
 *
 * This mirrors the logic in src/config/settings.js but as a standalone
 * ESM module that doesn't depend on the brainstorm CJS codebase.
 */

import fs from 'fs';
import path from 'path';

// In the Docker container, brainstorm is installed at /usr/local/lib/node_modules/brainstorm
const BRAINSTORM_BASE = process.env.BRAINSTORM_BASE
  || '/usr/local/lib/node_modules/brainstorm';

const DEFAULTS_PATH = path.join(BRAINSTORM_BASE, 'src', 'config', 'defaults.json');
const SETTINGS_PATH = process.env.TAPESTRY_SETTINGS_PATH
  || path.join(process.env.BRAINSTORM_BASE_DIR || '/var/lib/brainstorm', 'settings.json');

const USER_PREFS_DIR = process.env.USER_PREFS_DIR
  || '/var/lib/brainstorm/user-prefs';

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
 * Load and merge settings (defaults + user overrides).
 */
function loadSettings() {
  let defaults = {};
  let overrides = {};

  try {
    defaults = JSON.parse(fs.readFileSync(DEFAULTS_PATH, 'utf-8'));
  } catch (err) {
    console.warn(`[settings] Failed to read defaults.json: ${err.message}`);
  }

  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      overrides = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
    }
  } catch (err) {
    console.warn(`[settings] Failed to read settings.json: ${err.message}`);
  }

  return deepMerge(defaults, overrides);
}

// Cache settings with a short TTL (re-read every 30 seconds)
let cachedSettings = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000;

function getSettings() {
  const now = Date.now();
  if (cachedSettings && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedSettings;
  }
  cachedSettings = loadSettings();
  cacheTimestamp = now;
  return cachedSettings;
}

/**
 * Get the house-level search preferences.
 * Returns { delegatedPubkey, filters, sort, ... }
 */
export function getHousePrefs() {
  const settings = getSettings();
  return settings.grapevine?.searchPreferences || {};
}

/**
 * Get the house-level delegated pubkey (for WoT POV fallback).
 */
export function getHouseDelegatedPubkey() {
  return getHousePrefs().delegatedPubkey || null;
}

/**
 * Get the house-level filter config.
 */
export function getHouseFilters() {
  return getHousePrefs().filters || null;
}

/**
 * Get the house-level sort config.
 */
export function getHouseSort() {
  return getHousePrefs().sort || null;
}

/**
 * Read a user's saved preferences by pubkey.
 * Returns {} if no prefs found.
 */
export function readUserPrefs(pubkey) {
  if (!pubkey || pubkey.length !== 64) return {};
  const safePubkey = pubkey.replace(/[^0-9a-f]/gi, '');
  const filePath = path.join(USER_PREFS_DIR, `${safePubkey}.json`);
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch { /* ignore */ }
  return {};
}
