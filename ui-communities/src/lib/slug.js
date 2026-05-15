/*
 * Community slug derivation.
 *
 * Pure function. Takes the wizard's name field, returns a URL-safe slug
 * for use as the kind-39999 community-record's `d` tag.
 *
 * No uniqueness check — PLAN.md §6 Q4 commits to "no hard dedup": d-tags
 * are scoped per (kind, pubkey) at the protocol level, so two curators
 * with the same slug coexist without collision.
 *
 * Examples:
 *   slugify("Sunset Hikers")             → "sunset-hikers"
 *   slugify("Code & Coffee")             → "code-coffee"
 *   slugify("  The Listening Room!  ")   → "the-listening-room"
 *   slugify("!!!")                       → ""   (caller surfaces inline error)
 */

export function slugify(name) {
  if (typeof name !== 'string') return ''
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
