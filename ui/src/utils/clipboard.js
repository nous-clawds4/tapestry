/**
 * Copy text to the clipboard, with a fallback for non-secure contexts
 * (http:// on a LAN IP) and older browsers where navigator.clipboard is
 * unavailable. Resolves on success, rejects if every path fails.
 *
 * Mirrors the copyText helper that PinnedListPanel.jsx defines locally; extracted
 * here so other surfaces (e.g. the feed note-actions menu) can reuse the same
 * robust behavior instead of the bare navigator.clipboard call.
 */
export function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) resolve(); else reject(new Error('copy command rejected'));
    } catch (e) { reject(e); }
  });
}
