'use strict';
/**
 * The two tags that make a profile one of your Assistants (my-assistants #1, ADR my-assistants/0001 sub-decision 3):
 *
 *   My Brainstorm Assistant — an Assistant held for you by a Brainstorm service, such as brainstorm.world
 *   My Tapestry Assistant   — an Assistant held for you by a Tapestry instance
 *
 * One list, in the order the My Assistants page shows a row's tags, read by the server's rule
 * (src/api/assistant/myAssistants.js); the page takes each tag's name from the server's answer.
 *
 * The Tapestry slug is read from the identification-tags list, which already owns it, so the two cannot drift. The
 * Brainstorm slug is fixed here: Nous publishes that definition in story 2, at this slug (book decision 4). A tag of
 * that name counts whoever authored its definition (ADR identification-tags-authorship/0001), so no author is needed
 * to read; story 2 adds the one a new tagging points at.
 *
 * Pure, dependency-free CommonJS apart from the identification-tags list, so the Node runner loads it as it is.
 */

const { REQUIRED_TAGGINGS } = require('../identification-tags');

const TAPESTRY_SLUG = REQUIRED_TAGGINGS.find((entry) => entry.key === 'my-tapestry-assistant').slug;

/** The two tags, in the order a row shows them. */
const MY_ASSISTANT_TAGS = Object.freeze([
  Object.freeze({ key: 'brainstorm', name: 'My Brainstorm Assistant', slug: 'my-brainstorm-assistant' }),
  Object.freeze({ key: 'tapestry', name: 'My Tapestry Assistant', slug: TAPESTRY_SLUG }),
]);

/** The key of the tag with this slug: 'brainstorm', 'tapestry', or null for any other slug. */
function slugKey(slug) {
  const tag = MY_ASSISTANT_TAGS.find((t) => t.slug === slug);
  return tag ? tag.key : null;
}

module.exports = { MY_ASSISTANT_TAGS, slugKey };
