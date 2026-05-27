/**
 * Extract a WoT score from a Meili profile hit, trying the POV-namespaced
 * field first and falling back to the legacy flat field.
 *
 * Story 17 extracted this from BrainstormSearch.jsx so TagSomeoneModal
 * and any future surface can share one implementation.
 */
export function getWotScore(hit, metric, povSuffix) {
  if (povSuffix) {
    const val = hit[`wot_${metric}_${povSuffix}`];
    if (val != null) return val;
  }
  return hit[`wot_${metric}`] ?? null;
}
