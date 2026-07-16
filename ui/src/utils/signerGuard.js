/**
 * NIP-07 "active account" guard.
 *
 * The signed-in session identity (`user.pubkey`, established at login via a
 * signed challenge and shown in the app corner) can drift from the signer's
 * CURRENTLY ACTIVE account: the user switches accounts in their extension, and
 * every subsequent signed write goes out under the live account — silently, and
 * effectively as a different person. NIP-07 has no reliable account-change
 * event, so the portable defense is a pre-sign check: fetch the active pubkey
 * and refuse the write when it doesn't match the session identity.
 *
 * Call `assertSignerMatches(active, expected)` right after obtaining the active
 * signer pubkey and before signing/publishing. No-op when `expected` is falsy
 * (anonymous — no session identity to contradict).
 */

export function shortPk(pk) {
  return pk ? `…${String(pk).slice(-6)}` : '(unknown)';
}

export class SignerMismatchError extends Error {
  constructor(active, expected) {
    super(
      `Your signer is on a different account (${shortPk(active)}) than you’re signed in as ` +
      `(${shortPk(expected)}). Switch your extension back to ${shortPk(expected)}, or sign out ` +
      `and back in as ${shortPk(active)} — otherwise this would be published as ${shortPk(active)}.`
    );
    this.name = 'SignerMismatchError';
    this.code = 'SIGNER_MISMATCH';
    this.active = active;
    this.expected = expected;
  }
}

export function assertSignerMatches(activePubkey, expectedPubkey) {
  if (expectedPubkey && activePubkey && activePubkey !== expectedPubkey) {
    throw new SignerMismatchError(activePubkey, expectedPubkey);
  }
}

// Module-level mirror of the signed-in session pubkey, published by AuthContext
// (setSessionPubkey on login/status/logout). Lets the plain-util write paths
// (profile tags, pins, NIP-51 exports) self-guard without threading the session
// pubkey through every function + caller. Null when logged out → guard is a
// no-op (anonymous has no session identity to contradict). Issue #335.
let _sessionPubkey = null;
export function setSessionPubkey(pk) { _sessionPubkey = pk || null; }
export function getSessionPubkey() { return _sessionPubkey; }

/**
 * Fetch the extension's active signer pubkey and assert it matches the signed-in
 * session (getSessionPubkey). Use at the top of any user-initiated signed write.
 * Throws SignerMismatchError on drift; returns the active pubkey otherwise.
 */
export async function getActiveSignerOrThrow(expected = getSessionPubkey()) {
  if (!window.nostr) throw new Error('No NIP-07 extension detected.');
  const active = await window.nostr.getPublicKey();
  assertSignerMatches(active, expected);
  return active;
}
