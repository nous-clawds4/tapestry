import React, { useState } from 'react';

/**
 * "Where do these scores come from?" info popover for the Reputation section — an ⓘ trigger
 * + a tap-to-open popover (mobile-friendly). Explains that the reputation scores reflect a
 * Web-of-Trust point of view: either the House point of view (this Tapestry instance's
 * default) or the viewer's Personalized point of view, depending on which is currently
 * selected. Static copy, no data fetch (ADR 0034 Option A: prop-free, hook-free). Clones the
 * established bsp-info-btn / bsp-confirm-overlay / bsp-confirm-box pattern from VerificationInfo.
 */
export default function ReputationInfo() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="bsp-info-btn"
        aria-label="Where do these reputation scores come from?"
        title="Where do these reputation scores come from?"
        onClick={() => setOpen(true)}
      >ⓘ</button>
      {open && (
        <div className="bsp-confirm-overlay" onClick={() => setOpen(false)}>
          <div className="bsp-confirm-box bsp-follows-info" onClick={e => e.stopPropagation()}>
            <h3 className="bsp-confirm-title">Where do these scores come from?</h3>
            <p className="bsp-confirm-message">
              These reputation scores reflect a Web of Trust — a point of view on who is
              trustworthy. The numbers show either the House point of view (this Tapestry
              instance's default) or your Personalized point of view, depending on which is
              currently selected.
            </p>
            <div className="bsp-confirm-buttons">
              <button className="bsp-confirm-ok" onClick={() => setOpen(false)}>Got it</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
