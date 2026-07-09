import React from 'react';

/**
 * Shared POV-honesty disclosure (pov-selectable-tag-surfaces Story 2 / ADR 0002).
 *
 * Renders a single, consistent notice when the active POV can't actually filter —
 * counts are unfiltered, an "own" request silently fell back to house, or the
 * selected POV has no computed scores here. One component = one wording source
 * (AC-6), keyed on the per-read `povResolution` signal the tag reads now return.
 *
 * Renders NOTHING for a healthy, provisioned POV (mode==='filtered' && !fellBack)
 * or when there is no status — so provisioned surfaces look exactly as before (AC-5).
 *
 * Props:
 *   - status:  the read's `povResolution` object (or null)
 *   - variant: 'banner' (page-level) | 'compact' (inline/in-card)
 */
export default function PovStatusNotice({ status, variant = 'banner' }) {
  if (!status || (status.mode === 'filtered' && !status.fellBackToHouse)) return null;

  const { mode, fellBackToHouse } = status;

  // Full sentence (banner text; also the compact `title`) + short compact label.
  let full;
  let short;
  if (mode === 'unfiltered' && fellBackToHouse) {
    full = 'Your point of view isn’t available here, and no house point of view is configured — counts are not trust-filtered.';
    short = 'counts unfiltered';
  } else if (mode === 'unfiltered') {
    full = 'Counts here are not trust-filtered — this instance has no point of view configured.';
    short = 'counts unfiltered';
  } else if (mode === 'not-computed' && fellBackToHouse) {
    full = 'Your point of view isn’t available; the house point of view it fell back to has no computed scores here.';
    short = 'POV not computed here';
  } else if (mode === 'not-computed') {
    full = 'The selected point of view has no computed trust scores on this instance — nothing can be counted under it. An empty page here does not mean nothing is tagged.';
    short = 'POV not computed here';
  } else if (fellBackToHouse) {
    // mode === 'filtered' + fellBackToHouse
    full = 'Your point of view isn’t available on this instance — showing the house point of view instead.';
    short = 'showing house POV';
  } else {
    return null;
  }

  if (variant === 'compact') {
    return (
      <span className="bs-pov-notice bs-pov-notice--compact" title={full}>
        {short}
      </span>
    );
  }
  return (
    <div className="bs-pov-notice" role="status">
      {full}
    </div>
  );
}
