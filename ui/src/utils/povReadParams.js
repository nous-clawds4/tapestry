/**
 * Shared selected-POV → read-params resolver (pov-selectable-tag-surfaces, ADR 0001).
 *
 * The single home of the rule search and every tag surface use to turn the
 * selected POV label ('user' | 'nosfabrica' | 'house') into the `wotPov`
 * (+ `userPubkey`) read parameters the backend already accepts.
 *
 * Faithful copy of search's inline rule (BrainstormSearch `buildSearchUrl`):
 *   - own POV ('user') with a valid viewer key → { wotPov: 'user', userPubkey }
 *   - everything else (named / house / no-or-invalid key) → { wotPov: 'house' }
 *
 * Dependency-free ESM so it can be unit-tested in isolation (the ADR test seam).
 */
export function resolvePovReadParams({ pov, userPubkey } = {}) {
  if (pov === 'user' && typeof userPubkey === 'string' && /^[0-9a-f]{64}$/.test(userPubkey)) {
    return { wotPov: 'user', userPubkey };
  }
  return { wotPov: 'house' };
}

export default resolvePovReadParams;
