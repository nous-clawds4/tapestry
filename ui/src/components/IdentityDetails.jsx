import React, { useState } from 'react';
import CopyButton from './CopyButton';

/**
 * Account "details drawer" — a neutral ⋯ trigger placed to the right of the profile name that
 * opens a tap-to-open popover listing the account's identifiers (hex pubkey + npub), each copyable
 * via the full value. Presentational: the values arrive as props (no fetch). Reuses the
 * bsp-info-btn / bsp-confirm-* / bsp-id-* patterns (ADR profile/0033, sibling of VerificationInfo /
 * ReputationInfo). Designed to grow — future account details render as more rows here.
 */
export default function IdentityDetails({ pubkey, npub }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="bsp-info-btn"
        aria-label="Show account identifiers"
        title="Show account identifiers"
        onClick={() => setOpen(true)}
      >⋯</button>
      {open && (
        <div className="bsp-confirm-overlay" onClick={() => setOpen(false)}>
          <div className="bsp-confirm-box" onClick={e => e.stopPropagation()}>
            <h3 className="bsp-confirm-title">Identifiers</h3>
            <div className="bsp-id-grid">
              <div className="bsp-id-row">
                <span className="bsp-id-label">Pubkey (hex)</span>
                <code className="bsp-id-value">{pubkey.slice(0, 12)}…{pubkey.slice(-8)}</code>
                <CopyButton value={pubkey} />
              </div>
              {npub && (
                <div className="bsp-id-row">
                  <span className="bsp-id-label">npub</span>
                  <code className="bsp-id-value">{npub.slice(0, 20)}…{npub.slice(-8)}</code>
                  <CopyButton value={npub} />
                </div>
              )}
            </div>
            <div className="bsp-confirm-buttons">
              <button className="bsp-confirm-ok" onClick={() => setOpen(false)}>Got it</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
