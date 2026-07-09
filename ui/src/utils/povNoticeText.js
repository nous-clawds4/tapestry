/**
 * Pure wording rule for the POV-honesty disclosure (pov-selectable-tag-surfaces
 * Story 2 + Amendment 2). Extracted from PovStatusNotice so the message matrix
 * is unit-testable (the Node harness can dynamic-import this plain .js; it can't
 * parse the .jsx). One function = one wording source (AC-6).
 *
 * Input: the read's `povResolution` object (or null). Output: `{ full, short }`
 * or `null` when there is nothing to disclose (no status, or a healthy filtered
 * POV — mode 'filtered' && !fellBackToHouse).
 *
 * The two `unfiltered` causes are split by `povSuffix`: a resolved delegate
 * (`povSuffix` present) means the point of view exists but has no trust
 * THRESHOLD set — it must NOT read as "no point of view configured" (that wording
 * is only honest when no delegate resolved). Same split for the fell-back variants.
 */
export function povNoticeText(status) {
  if (!status) return null;
  const { mode, fellBackToHouse, povSuffix } = status;
  if (mode === 'filtered' && !fellBackToHouse) return null;

  const hasDelegate = !!povSuffix;
  let full;
  let short;

  if (mode === 'unfiltered') {
    short = 'counts unfiltered';
    if (fellBackToHouse) {
      full = hasDelegate
        ? 'Your point of view isn’t available here — the house point of view it fell back to has no trust threshold set, so counts aren’t filtered.'
        : 'Your point of view isn’t available here, and no house point of view is configured — counts are not trust-filtered.';
    } else {
      full = hasDelegate
        ? 'Counts here aren’t trust-filtered — the selected point of view has no trust threshold set.'
        : 'Counts here are not trust-filtered — this instance has no point of view configured.';
    }
  } else if (mode === 'not-computed') {
    short = 'POV not computed here';
    full = fellBackToHouse
      ? 'Your point of view isn’t available; the house point of view it fell back to has no computed scores here.'
      : 'The selected point of view has no computed trust scores on this instance — nothing can be counted under it. An empty page here does not mean nothing is tagged.';
  } else if (fellBackToHouse) {
    // mode === 'filtered' + fellBackToHouse
    short = 'showing house POV';
    full = 'Your point of view isn’t available on this instance — showing the house point of view instead.';
  } else {
    return null;
  }

  return { full, short };
}

export default povNoticeText;
