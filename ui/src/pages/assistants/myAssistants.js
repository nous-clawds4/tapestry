/**
 * The My Assistants page, as data (my-assistants #1, ADR my-assistants/0001 sub-decision 5): its words, the two links
 * it reads from their owners, and how the server's rows become what a row shows and in what order.
 *
 * No React, and only `.js`-suffixed imports plus nostr-tools, so the Node runner loads it as it is
 * (test/my-assistants-page.test.js C-class).
 *
 * The words are story § Copy; change them there first:
 * engineering-team/stories/my-assistants/1-the-my-assistants-page.md § Copy.
 */

import { nip19 } from 'nostr-tools';
import { PROFILE_LOOKUP_FAILED } from '../../utils/profileBatch.js';
import { personalLinks } from '../../config/avatarMenuLinks.js';
import { ASSISTANT_ACTIONS } from '../assistant/actions.js';

export const COPY = {
  kicker: 'My Assistants',
  fieldUrl: 'URL',
  fieldNip05: 'NIP-05',
  localBadge: 'Local',
  localTooltip: 'The Assistant hosted on the instance you’re using right now',
  notTagged: 'Not tagged',
  notTaggedTooltip: 'You haven’t tagged this Assistant as yours yet',
  tagPrompt: 'This is your Assistant on this instance, but you haven’t tagged it as yours.',
  tagPromptLink: 'Tag it as My Tapestry Assistant →',
  empty: 'You haven’t tagged any Assistants yet. Search above to find one.',
  signedOut: 'Sign in to see your Assistants.',
  signInButton: 'Sign in with nostr',
  loading: 'Loading your Assistants…',
  error: 'Couldn’t load your Assistants.',
  retry: 'Try again',
};

/** The accessible name of the list of rows. */
export const LIST_LABEL = 'Your Assistants';

/** Where the introduction's "Treasure Map" goes: wherever the avatar menus' My Treasure Map goes. */
export const TREASURE_MAP_PATH = personalLinks({ pubkey: '', assistantPubkey: null, classification: null, profileBase: '' })
  .find((link) => link.key === 'my-treasure-map').to;

/** Where the untagged Local row's prompt goes: the Identification Tags action's own page. */
export const IDENTIFICATION_TAGS_PATH = ASSISTANT_ACTIONS.find((action) => action.key === 'identification-tags').path;

/** A pubkey's npub, shortened: the first 12 characters, an ellipsis, the last 6. */
export function npubShort(pubkey) {
  const npub = nip19.npubEncode(pubkey);
  return `${npub.slice(0, 12)}…${npub.slice(-6)}`;
}

/**
 * A profile field as text: trimmed, or null when it is missing, blank or not a string. A kind 0 is arbitrary JSON, so a
 * name can arrive as a number or an array; such a field is skipped rather than shown, and never throws (review 1 of
 * my-assistants #1).
 */
function textOf(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** "0 Assistants", "1 Assistant", "N Assistants". */
export function countText(n) {
  return `${n} ${n === 1 ? 'Assistant' : 'Assistants'}`;
}

/**
 * The rows as the page shows them: the Local row first, then alphabetically by the name shown (case and accents
 * aside), the pubkey breaking a tie.
 * @param {{rows: Array<{pubkey, local, tags}>, profiles: Object}} input  profiles as fetchProfilesChunked answers:
 *   a profile, null (none published) or PROFILE_LOOKUP_FAILED, per pubkey
 */
export function buildRows({ rows, profiles }) {
  const built = (Array.isArray(rows) ? rows : []).map((row) => {
    const found = profiles ? profiles[row.pubkey] : null;
    const profile = found && found !== PROFILE_LOOKUP_FAILED ? found : {};
    const short = npubShort(row.pubkey);
    const name = textOf(profile.display_name) || textOf(profile.name) || short;
    const tags = Array.isArray(row.tags) ? row.tags : [];
    const local = row.local === true;
    return {
      pubkey: row.pubkey,
      name,
      initial: Array.from(name)[0], // a whole character, so a name that starts with an emoji keeps it whole
      npubShort: short,
      url: textOf(profile.website) || '—',
      nip05: textOf(profile.nip05) || '—',
      local,
      untagged: local && tags.length === 0,
      tags,
    };
  });
  return built.sort((a, b) => (Number(b.local) - Number(a.local))
    || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    || (a.pubkey < b.pubkey ? -1 : a.pubkey > b.pubkey ? 1 : 0));
}
