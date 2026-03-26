/**
 * Check if a user has admin-level access (owner or admin classification).
 * @param {Object} user - User object from AuthContext
 * @returns {boolean}
 */
export function hasAdminAccess(user) {
  return user?.classification === 'owner' || user?.classification === 'admin';
}
