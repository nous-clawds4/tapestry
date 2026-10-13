'use strict';
/**
 * The remembered self-Map choice: on or off, per Assistant (assistant-self-map #2, ADR assistant-self-map/0002
 * sub-decision 1).
 *
 * One small JSON file on the data volume, `assistant-self-map.json` under BRAINSTORM_BASE_DIR (the `tapestry-data`
 * volume at /var/lib/brainstorm), or wherever TAPESTRY_SELF_MAP_CHOICE_PATH points:
 *
 *   { "version": 1, "assistants": { "<assistant hex>": { "on": true, "changedAt": <unix seconds> } } }
 *
 * It is state this instance authors, with no event behind it (CLAUDE.md principle 4, BIBLE §30): nothing rebuilds it
 * from the relays, and no import, firmware reinstall or strfry rebuild touches it. Only the self-Map press (ADR 0002
 * sub-decisions 5 and 6) writes it; the hub's check reads it for the viewer's own Assistant.
 *
 * - readSelfMapChoice: false when the file or the Assistant's entry is missing (off until turned on), the entry's `on`
 *   otherwise, and null (unknown) when the file exists but cannot be read or is not the shape above.
 * - writeSelfMapChoice: one at a time (a module-level promise lock), and atomically (a temp file, fsync, rename, then
 *   the directory). It throws, and never overwrites, when the file exists but cannot be read or is not the shape.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SELF_MAP_CHOICE_PATH = process.env.TAPESTRY_SELF_MAP_CHOICE_PATH
  || path.join(process.env.BRAINSTORM_BASE_DIR || '/var/lib/brainstorm', 'assistant-self-map.json');

const HEX64 = /^[0-9a-f]{64}$/i;
const VERSION = 1;

const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The store as it stands: an empty one when the file is missing; throws when it is there but not the shape. */
function readStore() {
  let text;
  try {
    text = fs.readFileSync(SELF_MAP_CHOICE_PATH, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return { version: VERSION, assistants: {} };
    throw err;
  }
  const parsed = JSON.parse(text);
  if (!isPlainObject(parsed) || parsed.version !== VERSION || !isPlainObject(parsed.assistants)) {
    throw new Error(`${SELF_MAP_CHOICE_PATH} does not hold { version: 1, assistants: { … } }`);
  }
  return parsed;
}

/**
 * Is this Assistant's self-Map on? (story 2 AC-1)
 * @param {string} assistantPubkey - 64-hex
 * @returns {true|false|null} null when the file cannot be read
 */
function readSelfMapChoice(assistantPubkey) {
  let store;
  try {
    store = readStore();
  } catch (err) {
    console.warn(`[assistant/self-map] the choice file cannot be read: ${err && err.message ? err.message : err}`);
    return null;
  }
  const key = String(assistantPubkey || '').toLowerCase();
  const entry = Object.prototype.hasOwnProperty.call(store.assistants, key) ? store.assistants[key] : null;
  return Boolean(entry && entry.on === true);
}

/** Write `text` to `file` atomically: temp file, fsync, rename, directory fsync (tagging-edges/state.js writeAtomic). */
function writeAtomic(file, text) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  let fd = null;
  try {
    fd = fs.openSync(tmp, 'w', 0o600);
    fs.writeFileSync(fd, text);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(tmp, file);
  } catch (err) {
    if (fd !== null) { try { fs.closeSync(fd); } catch (_) { /* closed */ } }
    try { fs.unlinkSync(tmp); } catch (_) { /* never created */ }
    throw err;
  }
  let dirFd = null;
  try {
    dirFd = fs.openSync(dir, 'r');
    fs.fsyncSync(dirFd);
  } catch (_) {
    // Some filesystems refuse a directory fsync; the rename itself is still atomic.
  } finally {
    if (dirFd !== null) { try { fs.closeSync(dirFd); } catch (_) { /* closed */ } }
  }
}

// One read-modify-write at a time, in arrival order (as negentropyPresets' withPresetsLock).
let choiceLock = Promise.resolve();

/**
 * Remember this Assistant's choice (story 2 AC-1). Resolves once the file holds it; rejects on a key that is not an
 * Assistant key, on an unreadable file (left as it is), or on a failed write.
 * @param {string} assistantPubkey - 64-hex
 * @param {boolean} on
 * @param {number} nowSeconds
 * @returns {Promise<void>}
 */
function writeSelfMapChoice(assistantPubkey, on, nowSeconds) {
  const run = choiceLock.then(() => {
    if (typeof assistantPubkey !== 'string' || !HEX64.test(assistantPubkey)) throw new Error('not an Assistant key');
    const store = readStore();
    store.assistants[assistantPubkey.toLowerCase()] = { on: on === true, changedAt: nowSeconds };
    writeAtomic(SELF_MAP_CHOICE_PATH, `${JSON.stringify(store, null, 2)}\n`);
  });
  choiceLock = run.catch(() => {});
  return run;
}

module.exports = {
  readSelfMapChoice,
  writeSelfMapChoice,
  SELF_MAP_CHOICE_PATH,
};
