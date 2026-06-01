/**
 * NIP-07 signer detection.
 *
 * Browser signer extensions (the things that provide window.nostr) inject it
 * *asynchronously* during page load. An immediate `!window.nostr` check fires
 * a false "no signer" when a user clicks sign-in before injection completes.
 * waitForNostr polls for up to timeoutMs before giving up.
 *
 * @param {number} timeoutMs how long to wait for window.nostr to appear
 * @param {number} stepMs    polling interval
 * @returns {Promise<object|null>} the window.nostr signer, or null if none
 *          appeared within the timeout.
 */
export function waitForNostr(timeoutMs = 1000, stepMs = 50) {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.nostr) {
      resolve(window.nostr);
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      if (typeof window !== 'undefined' && window.nostr) {
        clearInterval(timer);
        resolve(window.nostr);
      } else if (Date.now() - start >= timeoutMs) {
        clearInterval(timer);
        resolve(null);
      }
    }, stepMs);
  });
}
