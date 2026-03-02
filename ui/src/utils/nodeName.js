/**
 * Resolve the best display name for a node.
 * Checks node.name first, then falls back through tag values.
 *
 * @param {Object} node - Node object with .name property
 * @param {Array} [tags] - Optional array of { type, value } tag objects
 * @returns {string|null}
 */
export function resolveName(node, tags = []) {
  if (node?.name) return node.name;

  const priority = ['name', 'names', 'title', 'alias', 'slug'];
  for (const field of priority) {
    const tag = tags.find(t => t.type === field);
    if (tag?.value) return tag.value;
  }

  return null;
}

/**
 * Get display name with fallback to truncated UUID.
 */
export function displayName(node, tags = []) {
  return resolveName(node, tags) || node?.uuid?.slice(0, 20) + '…' || 'Unnamed Node';
}
