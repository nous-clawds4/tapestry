/**
 * The Manage your Treasure Map page's words and the small rules it renders by (manage-treasure-map #1, ADR
 * manage-treasure-map/0001 sub-decision 4; the Assistants by category cards since #2, ADR 0002). Pure, with only a
 * `.js`-suffixed import, so a Node suite loads it as it is (test/manage-treasure-map-page.test.js,
 * test/manage-treasure-map-cards.test.js).
 *
 * The words are the story's § Copy: the blueprint's (engineering-team/audits/manage-treasure-map/blueprint/), plus the
 * loading, error, signed-out and placeholder lines the blueprint has no state for. Apostrophes are curly, as in the
 * blueprint and the other design-styled pages.
 */

// The one name rule both design pages use: display name, else name, else the shortened npub (ADR 0002 sub-decision 8).
import { cardFields } from '../assistants/myAssistants.js';

export const COPY = {
  kicker: 'Treasure Map',
  intro: 'Your Treasure Map tells other apps where to find the insights your Assistant gathers from your trusted community — who to trust, what’s worth your attention, and how your community organizes ideas. Brainstorm keeps it up to date for you.',
  faqButton: 'Frequently asked questions',
  rawShow: 'View the raw Treasure Map',
  rawHide: 'Hide the raw Treasure Map',
  rawChip: 'kind 10040',
  noneTitle: 'No Treasure Map found',
  noneLine: 'We couldn’t locate a kind 10040 event for your profile on your relays.',
  loading: 'Loading your Treasure Map…',
  error: 'Couldn’t read your Treasure Map.',
  retry: 'Try again',
  signedOut: 'Sign in to see your Treasure Map.',
  signInButton: 'Sign in with nostr',
  advancedPrompt: 'Need fine-grained control over every entry?',
  advancedLink: 'Advanced management',
  // The Assistants by category section (manage-treasure-map #2).
  categoriesHeading: 'Assistants by category',
  categories: {
    scores: { title: 'Scores', description: 'Trust scores for profiles and content, one at a time.' },
    lists: { title: 'Lists', description: 'Curated lists of profiles and content.' },
    concepts: { title: 'Concepts', description: 'Structured datasets your community organizes together.' },
  },
  assignedTo: 'Assigned to',
  mixed: 'Mixed',
  mixedCount: (n) => `· ${n} Assistants`,
  notAssigned: 'Not assigned yet',
  // The Mixed line, around its link to the Advanced page.
  mixedLineBefore: 'Mixed assignments can be reviewed on the ',
  mixedLineLink: 'Advanced page',
  mixedLineAfter: '.',
  rawBoxLabel: 'Raw Treasure Map',
  advanced: {
    back: 'Manage your Treasure Map',
    kicker: 'Treasure Map · Advanced',
    // The placeholder line, around its link to the TA Treasure Map page.
    placeholderBefore: 'This page is coming soon. It will list every entry on your Treasure Map, and which Assistant provides each one. Until then, the ',
    placeholderLink: 'TA Treasure Map',
    placeholderAfter: ' page shows every entry.',
  },
};

/** The FAQ, in the story's order. */
export const FAQS = [
  {
    q: 'What is a Treasure Map?',
    a: 'A public record that points other nostr apps to the insights your Assistant calculates for you, so every app you use can benefit from your trusted community.',
  },
  {
    q: 'Do I need to do anything?',
    a: 'Not usually. Brainstorm creates your Treasure Map during setup and keeps it current. You only need to sign again when something important changes.',
  },
  {
    q: 'Who can see it?',
    a: 'Anyone. It’s published to relays like any other nostr event, so any app can read it.',
  },
  {
    q: 'What’s on the Advanced page?',
    a: 'Every individual entry in your Treasure Map — scores, lists, and concepts — along with which Assistant provides each one. Most people never need it.',
  },
];

/** The Treasure Map as the raw viewer shows it: the event exactly as the hook returned it, indented; '' for none. */
export function rawMapText(event) {
  return event ? JSON.stringify(event, null, 2) : '';
}

/** The read's answers the panel shows as they are (useTreasureMap's statuses). */
const SETTLED = new Set(['found', 'none', 'error']);

/**
 * Which phase the raw Treasure Map panel is in: 'signed-out' | 'loading' | 'found' | 'none' | 'error'.
 * While sign-in is settling, or the read hasn't answered (or answered something unrecognised), it's loading, so the
 * page never says there's no Map before a read has said so (AC-4).
 * @param {{ authLoading: boolean, user: ?object, status: string }} input  useAuth's loading and user, useTreasureMap's status
 */
export function mapPanelPhase({ authLoading, user, status }) {
  if (authLoading) return 'loading';
  if (!user) return 'signed-out';
  return SETTLED.has(status) ? status : 'loading';
}

// ── The Assistants by category cards (manage-treasure-map #2, ADR manage-treasure-map/0002) ─────────────────────────

const CATEGORIES = ['scores', 'lists', 'concepts'];
const HEX64 = /^[0-9a-f]{64}$/i;
const KIND = /^\d{5}$/;

/**
 * One Map tag as the cards read it (sub-decision 1): its key, its delegate (lowercased), and its kind slot and the rest
 * of the key, split at the first colon. null when the tag can't count: no string key, or no valid 64-hex delegate.
 */
function entryOf(tag) {
  if (!Array.isArray(tag) || typeof tag[0] !== 'string' || typeof tag[1] !== 'string' || !HEX64.test(tag[1])) return null;
  const key = tag[0];
  const colon = key.indexOf(':');
  const slot = colon < 0 ? key : key.slice(0, colon);
  const rest = colon < 0 ? '' : key.slice(colon + 1);
  return { key, slot, rest, pubkey: tag[1].toLowerCase() };
}

/** Does this entry apply to the category? Own kinds, the family wildcard, or everything (`*:…` never a Concept). */
function appliesTo(category, { slot, rest }) {
  if (KIND.test(slot)) {
    const kind = Number(slot);
    if (category === 'scores') return kind >= 30380 && kind <= 30389;
    if (category === 'lists') return kind >= 30390 && kind <= 30399;
    return kind === 39998 || kind === 39999;
  }
  if (slot === '3038x') return category === 'scores';
  if (slot === '3039x') return category === 'lists';
  if (slot === '*') return category !== 'concepts' || rest === '';
  return false;
}

/**
 * Does a more specific entry cover this `*` entry completely for the category, so no insight there would reach it?
 * `keys` holds every key that has a valid delegate.
 */
function shadowed(category, { slot, rest }, keys) {
  if (slot !== '*') return false;
  const family = category === 'scores' ? '3038x' : category === 'lists' ? '3039x' : null;
  if (rest === '') {
    if (family) return keys.has(family);
    return keys.has('39998') || keys.has('39998:dlist-header');
  }
  return family !== null && (keys.has(family) || keys.has(`${family}:${rest}`));
}

/**
 * Which Assistants the Map gives each category (AC-2): every Assistant it would ask for some insight there. Per entry
 * key, the first valid delegate counts (later ones are alternates); a `*` entry that a more specific entry covers
 * completely doesn't count. Each list is in the order the Map first names its Assistants, without repeats. Never
 * throws: no event, no tags, or garbage give three empty lists.
 * @returns {{ scores: string[], lists: string[], concepts: string[] }}
 */
export function categoryAssistants(event) {
  const tags = event && typeof event === 'object' && Array.isArray(event.tags) ? event.tags : [];
  const entries = tags.map(entryOf).filter(Boolean);
  const keys = new Set(entries.map((e) => e.key));
  const out = { scores: [], lists: [], concepts: [] };
  for (const category of CATEGORIES) {
    const seenKeys = new Set();
    for (const entry of entries) {
      if (seenKeys.has(entry.key) || !appliesTo(category, entry) || shadowed(category, entry, keys)) continue;
      seenKeys.add(entry.key);
      if (!out[category].includes(entry.pubkey)) out[category].push(entry.pubkey);
    }
  }
  return out;
}

/**
 * The three cards, Scores, Lists, Concepts (sub-decision 3): each with its words, its state ('none' | 'single' |
 * 'mixed'), every counted Assistant as a person (name and avatar letter by the shared name rule, and whether it is
 * the viewer's own Assistant here), the first three as avatars, and the count.
 * @param {{ assistants: object, profiles: object, localPubkey: ?string }} input
 *   categoryAssistants' answer; fetchProfilesChunked's answer; the viewer's own Assistant here, or null
 */
export function categoryCards({ assistants, profiles, localPubkey }) {
  const found = profiles && typeof profiles === 'object' ? profiles : {};
  return CATEGORIES.map((key) => {
    const list = assistants && Array.isArray(assistants[key]) ? assistants[key] : [];
    const people = list.map((pubkey) => {
      const { name, initial } = cardFields(pubkey, found[pubkey]);
      return { pubkey, name, initial, local: Boolean(localPubkey) && pubkey === localPubkey };
    });
    return {
      key,
      title: COPY.categories[key].title,
      description: COPY.categories[key].description,
      state: people.length === 0 ? 'none' : people.length === 1 ? 'single' : 'mixed',
      people,
      avatars: people.slice(0, 3),
      count: people.length,
    };
  });
}
