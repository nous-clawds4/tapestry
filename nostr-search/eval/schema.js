'use strict';
/**
 * Gold-entry schema validation + v1 scoring-input extraction. See ADR 0004.
 *
 * The `layered` field is forward-looking (future Tag→DList search). v1 accepts
 * it and never rejects an entry for carrying it (AC-3); `scoringInputs` omits
 * it entirely so v1 profile-only scoring is provable.
 */

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function validateGoldEntry(entry) {
  const errors = [];
  if (!entry || typeof entry !== 'object') {
    return { valid: false, errors: ['entry must be an object'] };
  }
  if (!isNonEmptyString(entry.query)) {
    errors.push('query: required non-empty string');
  }
  if (!entry.observer || typeof entry.observer !== 'object' ||
      !isNonEmptyString(entry.observer.wotPov)) {
    errors.push('observer: required object with a non-empty wotPov');
  }
  if (!Array.isArray(entry.judgments)) {
    errors.push('judgments: required array');
  } else {
    entry.judgments.forEach((j, i) => {
      if (!j || typeof j !== 'object') {
        errors.push(`judgments[${i}]: must be an object`);
        return;
      }
      if (!isNonEmptyString(j.pubkey)) errors.push(`judgments[${i}].pubkey: required`);
      if (typeof j.relevant !== 'boolean') errors.push(`judgments[${i}].relevant: required boolean`);
    });
  }
  // AC-3: `layered` is OPTIONAL. Its presence MUST NEVER invalidate an entry.
  // We only sanity-check the type; a malformed type is the single tolerated
  // complaint and even that is advisory — v1 ignores the block regardless.
  if (entry.layered !== undefined &&
      (typeof entry.layered !== 'object' || entry.layered === null)) {
    errors.push('layered: if present should be an object (ignored in v1)');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * The exact inputs v1 scores on. Deliberately omits `layered` so that
 * "v1 ignores the layered block" is structurally provable (AC-3).
 */
function scoringInputs(entry) {
  return {
    query: entry.query,
    observer: entry.observer,
    judged: (entry.judgments || []).filter(j => j && j.relevant).map(j => j.pubkey),
  };
}

module.exports = { validateGoldEntry, scoringInputs };
