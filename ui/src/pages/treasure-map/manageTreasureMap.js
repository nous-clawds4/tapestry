/**
 * The Manage your Treasure Map page's words and the small rules it renders by (manage-treasure-map #1, ADR
 * manage-treasure-map/0001 sub-decision 4). Pure, with no imports, so a Node suite loads it as it is
 * (test/manage-treasure-map-page.test.js).
 *
 * The words are the story's § Copy: the blueprint's (engineering-team/audits/manage-treasure-map/blueprint/), plus the
 * loading, error, signed-out and placeholder lines the blueprint has no state for. Apostrophes are curly, as in the
 * blueprint and the other design-styled pages.
 */

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
