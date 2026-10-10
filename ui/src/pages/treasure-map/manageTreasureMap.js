/**
 * The Manage your Treasure Map page's words and the small rules it renders by (manage-treasure-map #1, ADR
 * manage-treasure-map/0001 sub-decision 4; the Assistants by category cards since #2, ADR 0002). Pure, with only
 * relative imports that name their file (`.js`, and the category rule's `.mjs` in src/lib), so a Node suite loads it as
 * it is (test/manage-treasure-map-page.test.js, test/manage-treasure-map-cards.test.js).
 *
 * The words are the story's § Copy: the blueprint's (engineering-team/audits/manage-treasure-map/blueprint/), plus the
 * loading, error, signed-out and placeholder lines the blueprint has no state for. Apostrophes are curly, as in the
 * blueprint and the other design-styled pages.
 */

// The one name rule both design pages use: display name, else name, else the shortened npub (ADR 0002 sub-decision 8).
import { cardFields } from '../assistants/myAssistants.js';
// /assistant's "Needs attention" words, shared so the two pages can't drift (treasure-map-card-details #1).
import { ASSISTANT_COPY } from '../assistant/actions.js';
// The category rule's one home, shared with the server (assistant-trusted-content-status ADR 0001 sub-decision 1).
import {
  TREASURE_MAP_CATEGORIES, entryOf, appliesTo, categoryEntries, categoryAssistants,
} from '../../../../src/lib/treasureMapCategories.mjs';

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
  // The pill on a card with no Assistant (treasure-map-card-details #1): /assistant's words.
  needsAttention: ASSISTANT_COPY.needsAttention,
  needsAttentionSrPrefix: ASSISTANT_COPY.needsAttentionSrPrefix,
  // Each card's details panel (treasure-map-card-details #2).
  showDetails: 'Show details',
  hideDetails: 'Hide details',
  detailsLabel: (title) => `${title} details`,
  backup: 'Backup',
  individual: 'Individually assigned',
  everythingElse: 'Everything else',
  noRelay: 'No relay',
  noEntries: 'No entries yet.',
  // The Mixed line, around its link to the Advanced page.
  mixedLineBefore: 'Mixed assignments can be reviewed on the ',
  mixedLineLink: 'Advanced page',
  mixedLineAfter: '.',
  rawBoxLabel: 'Raw Treasure Map',
  // Edit mode (treasure-map-edit #3, ADR treasure-map-edit/0003 sub-decision 1): the blueprint's words, the no-Map
  // warning (book decision 14), and the picker's states.
  edit: {
    button: 'Edit',
    buttonOn: 'Editing',
    noMap: 'We didn’t find a Treasure Map on your relays, so saving will publish a new one. If you already have one on a relay we couldn’t check, the new one will replace it.',
    allDuties: 'All duties',
    allDutiesLine: 'Assign one Assistant to Scores, Lists, Concepts, and everything else.',
    assignAll: 'Assign to all',
    choose: 'Choose an Assistant',
    change: 'Change',
    unsaved: 'Unsaved',
    assignedTo: (name) => `Will be assigned to ${name}`,
    undo: 'Undo',
    local: 'Local',
    current: 'Current',
    noChanges: 'No changes yet',
    allDutiesTo: (name) => `All duties → ${name}`,
    unsavedChanges: (n) => `${n} unsaved ${n === 1 ? 'change' : 'changes'}`,
    rawShow: 'View the raw Treasure Map — edited',
    rawHide: 'Hide the raw Treasure Map — edited',
    draftChip: 'Unsaved draft',
    draftBoxLabel: 'Raw Treasure Map — edited',
    loading: 'Loading your Assistants…',
    error: 'Couldn’t load your Assistants.',
    // The empty state, around its link to the My Assistants page.
    emptyBefore: 'You have no Assistants yet. Add one on the ',
    emptyLink: 'My Assistants',
    emptyAfter: ' page.',
    // Story 4's switches: the blueprint's override words, and the owner's backup words (book decision 13).
    override: (n) => `Override ${n} individually assigned ${n === 1 ? 'duty' : 'duties'}`,
    overrideAll: (n) => `Override ${n} individually assigned ${n === 1 ? 'duty' : 'duties'} across all categories`,
    overrideOff: 'Kept as they are; they take priority over this assignment.',
    overrideOn: 'These will be removed from your Treasure Map.',
    backups: (n) => `Remove ${n} backup ${n === 1 ? 'Assistant' : 'Assistants'}`,
    backupsOff: 'Kept as they are. Apps use a backup when an entry’s first Assistant can’t be reached.',
    backupsOn: 'Every entry keeps only its first Assistant, including entries not shown on this page.',
    // Story 5's Save: the blueprint's button and confirmation, and the owner-approved refusals (book decisions 3, 17).
    save: 'Save changes',
    saving: 'Saving…',
    saved: 'Treasure Map updated',
    reportSubject: 'Your Treasure Map',
    // Book decision 19: a newer Map found at Save is shown, with the changes kept on top of it.
    changedSince: 'Your Treasure Map changed since this page read it. The page now shows the new one, with your changes on top; check them and save again.',
    noSigner: 'Couldn’t save: no Nostr signer was found in this browser.',
    declined: 'Couldn’t save: the signature was declined.',
  },
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
// The category rule lives in src/lib/treasureMapCategories.mjs since assistant-trusted-content-status #1 (ADR
// assistant-trusted-content-status/0001 sub-decision 1), so the server's Scores/Lists/Concepts check reads a Map exactly
// as these cards do. Re-exported here under the names the page and its suites have always used.
export { entryOf, appliesTo, categoryEntries, categoryAssistants };

/**
 * The three cards, Scores, Lists, Concepts (sub-decision 3): each with its words, its state ('none' | 'single' |
 * 'mixed'), every counted Assistant as a person (name and avatar letter by the shared name rule, and whether it is
 * the viewer's own Assistant here), the first three as avatars, and the count.
 * @param {{ assistants: object, profiles: object, localPubkey: ?string }} input
 *   categoryAssistants' answer; fetchProfilesChunked's answer; the viewer's own Assistant here, or null
 */
export function categoryCards({ assistants, profiles, localPubkey }) {
  const found = profiles && typeof profiles === 'object' ? profiles : {};
  return TREASURE_MAP_CATEGORIES.map((key) => {
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
