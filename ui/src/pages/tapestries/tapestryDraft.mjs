/**
 * Pure, React-free builder for a "Create a Tapestry" draft (members-only v1).
 * See ADR tapestries/0003. No React/DOM imports so it is unit-testable in the
 * stack-free Node runner via dynamic import().
 */

/** kebab-case slug: lowercase, runs of non-alphanumerics → a single dash, trimmed. */
export function slugifyTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Build an unsigned kind-39999 tapestry element from a title + description + members.
 *
 * @param {object} args
 * @param {string} args.title                 required; a whitespace-only title throws.
 * @param {string} [args.description='']
 * @param {Array<{handle,shortSlug,descriptiveSlug,name}>} args.members  ≥1 required; empty throws.
 *        handle          = the concept-header coordinate `39998:<TA>:<shortSlug>`.
 *        descriptiveSlug = the concept-header `word.slug` — used as the node slug so it dedups
 *                          with the resolved `*-concept-graph` import at read time (ADR Decision 2-A).
 * @param {string} args.taPubkey              runtime-resolved TA pubkey (never hardcode).
 * @param {string} args.dTagSuffix            short unique suffix for the parameterized-replaceable d-tag.
 * @returns {{dTag, uuid, tapestry, graph, unsignedEvent}}
 */
export function buildTapestryDraft({ title, description = '', members, taPubkey, dTagSuffix }) {
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle) throw new Error('A tapestry needs a title.');
  if (!Array.isArray(members) || members.length === 0) {
    throw new Error('A tapestry needs at least one member concept.');
  }
  if (!taPubkey) throw new Error('A tapestry needs the instance TA pubkey.');

  const slug = slugifyTitle(cleanTitle);
  const dTag = `tapestry-${slug}-${dTagSuffix || ''}`;
  const uuid = `39999:${taPubkey}:${dTag}`;

  const tapestry = { slug, title: cleanTitle, description: String(description || '') };

  const graph = {
    graphType: 'tapestry',
    // Node slug = the concept-header's descriptive word.slug (NOT the short slug): this is the
    // slug its derived *-concept-graph uses for the same header node, so composeGraph dedups
    // them and each member renders exactly once on the Exploration page (ADR Decision 2-A).
    nodes: members.map((m) => ({ slug: m.descriptiveSlug, uuid: m.handle, name: m.name })),
    // Members-only v1: no cross-concept integrations are authored — those surface via import
    // resolution, and explicit authoring is a fast-follow.
    relationshipTypes: [],
    relationships: [],
    imports: members.map((m) => ({
      slug: `concept-graph-for-${m.shortSlug}`,
      uuid: `39999:${taPubkey}:${m.shortSlug}-concept-graph`,
    })),
  };

  const unsignedEvent = {
    kind: 39999,
    created_at: Math.floor(Date.now() / 1000),
    content: '',
    tags: [
      ['d', dTag],
      ['name', cleanTitle],
      // The z-tag to the tapestry concept handle is what the directory reads (queryRelay #z).
      ['z', `39998:${taPubkey}:tapestry`],
      ['json', JSON.stringify({ tapestry, graph })],
    ],
  };

  return { dTag, uuid, tapestry, graph, unsignedEvent };
}
