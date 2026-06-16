import React, { useState } from 'react';

/**
 * Copy-to-clipboard button — copies the full `value` via navigator.clipboard and shows a brief
 * 📋 → ✓ confirmation. Extracted from BrainstormProfile (ADR profile/0033) so the IdentityDetails
 * drawer (and future copyable fields) can reuse it. Behavior unchanged from the original.
 */
export default function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="bsp-copy-btn"
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      title="Copy to clipboard"
    >
      {copied ? '✓' : '📋'}
    </button>
  );
}
