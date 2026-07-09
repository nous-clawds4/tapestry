import React from 'react';
import { povNoticeText } from '../utils/povNoticeText';

/**
 * Shared POV-honesty disclosure (pov-selectable-tag-surfaces Story 2 / ADR 0002).
 *
 * Renders a single, consistent notice when the active POV can't actually filter —
 * counts are unfiltered (no delegate, or a delegate with no threshold set), an
 * "own" request silently fell back to house, or the selected POV has no computed
 * scores here. The wording matrix lives in the pure `povNoticeText` util (one
 * wording source, AC-6); this component is presentation only.
 *
 * Renders NOTHING for a healthy, provisioned POV or when there is no status — so
 * provisioned surfaces look exactly as before (AC-5).
 *
 * Props:
 *   - status:  the read's `povResolution` object (or null)
 *   - variant: 'banner' (page-level) | 'compact' (inline/in-card)
 */
export default function PovStatusNotice({ status, variant = 'banner' }) {
  const text = povNoticeText(status);
  if (!text) return null;

  if (variant === 'compact') {
    return (
      <span className="bs-pov-notice bs-pov-notice--compact" title={text.full}>
        {text.short}
      </span>
    );
  }
  return (
    <div className="bs-pov-notice" role="status">
      {text.full}
    </div>
  );
}
