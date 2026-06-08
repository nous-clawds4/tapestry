import React, { useState } from 'react';
import useVerificationInfo from '../hooks/useVerificationInfo';

/**
 * Shared "What does verification mean?" info popover — an ⓘ trigger + a tap-to-open popover
 * (mobile-friendly). Explains that "verified" means a rank score above the cutoff (out of 100)
 * calculated from the point of view of this Tapestry instance's owner, showing the owner's
 * name + avatar. Used on the profile and the /reporters page (ADR 0032). Reuses the existing
 * bsp-info-btn / bsp-confirm-overlay / bsp-confirm-box patterns.
 */
export default function VerificationInfo() {
  const [open, setOpen] = useState(false);
  const { ownerName, ownerAvatar, cutoffOutOf100 } = useVerificationInfo();

  return (
    <>
      <button
        type="button"
        className="bsp-info-btn"
        aria-label={'What does "verification" mean?'}
        title={'What does "verification" mean?'}
        onClick={() => setOpen(true)}
      >ⓘ</button>
      {open && (
        <div className="bsp-confirm-overlay" onClick={() => setOpen(false)}>
          <div className="bsp-confirm-box bsp-follows-info" onClick={e => e.stopPropagation()}>
            <h3 className="bsp-confirm-title">What does "verification" mean?</h3>
            <p className="bsp-confirm-message">
              "Verified" means a rank score above {cutoffOutOf100 == null ? 'the cutoff' : cutoffOutOf100} out of 100,
              calculated from the point of view of the owner of this Tapestry instance:
            </p>
            <div className="bsp-verification-owner">
              {ownerAvatar
                ? <img src={ownerAvatar} alt="" className="bsp-follows-avatar" onError={e => { e.target.style.display = 'none'; }} />
                : <div className="bsp-follows-avatar bsp-follows-avatar-ph">{(ownerName || '?')[0].toUpperCase()}</div>}
              <span>{ownerName || 'the owner'}</span>
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
