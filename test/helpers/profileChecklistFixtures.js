'use strict';
/**
 * The approved words and shapes of book assistant-profile-checklist, as its stories and ADRs state them. One copy,
 * shared by the Node suites (test/assistant-profile-check.test.js, test/assistant-profile-checklist-page.test.js,
 * test/assistant-stamped-avatar-for-everyone.test.js) and the browser suites
 * (tests/brainstorm/assistant-profile-check.spec.js, tests/brainstorm/assistant-profile-checklist-page.spec.js), so
 * they cannot disagree about what the owner approved.
 *
 * Source of truth (approved 2026-10-09):
 *   engineering-team/stories/assistant-profile-checklist/1-the-profile-check-and-the-hubs-done-mark.md (§ Copy, AC-4)
 *   engineering-team/stories/assistant-profile-checklist/2-the-checklist-page-and-its-one-click-fixes.md § Copy
 *   engineering-team/stories/assistant-profile-checklist/3-a-personalized-avatar-for-every-assistant.md § Copy
 *   engineering-team/decisions/assistant-profile-checklist/0001…0003 (the answer's shape, the reasons, the fixes)
 * Change a word there first, then here.
 */

// ─── The seven items, in order (story 1 AC-1; ADR 0001 sub-decision 1) ────────────────────────────────────────────
const ITEMS = [
  { key: 'avatar', counts: true },
  { key: 'banner', counts: false },
  { key: 'nip05', counts: true },
  { key: 'website', counts: true },
  { key: 'name-and-about', counts: true },
  { key: 'client-tag', counts: true },
  { key: 'visible', counts: true },
];
const COUNTED = ITEMS.filter((i) => i.counts).map((i) => i.key);

/** The seven kind-0 fields the one writer keeps (src/api/assistant/index.js PROFILE_FIELDS; ADR 0001 sub-decision 1). */
const PROFILE_CONTENT_FIELDS = ['name', 'display_name', 'about', 'picture', 'banner', 'website', 'lud16'];

/** The checked action's key in the attention answer and in CHECKED_ACTIONS (ADR 0001 sub-decision 7). */
const ACTION = 'profile';

/** The reference deployment's branded image (src/api/assistant/profileDefaults.js REFERENCE_TA_AVATAR_URL). */
const REFERENCE_TA_AVATAR_URL = 'https://tapestry.brainstorm.world/ta-avatar.png';

// ─── Fixture instances (describeInstance's shape) ─────────────────────────────────────────────────────────────────
const PUBLIC_INSTANCE = {
  domain: 'tapestry.example',
  isPublic: true,
  website: 'https://tapestry.example',
  avatarUrl: 'https://tapestry.example/ta-avatar.png',
};
const DEV_INSTANCE = {
  domain: 'localhost:7777',
  isPublic: false,
  website: '',
  avatarUrl: REFERENCE_TA_AVATAR_URL,
};
/** The instance block the answer carries (ADR 0001 sub-decision 8). */
const instanceBlock = (i) => ({ domain: i.domain, website: i.website, isPublic: i.isPublic });

// ─── Hub words (story 1 § Copy) ───────────────────────────────────────────────────────────────────────────────────
const HUB_COPY = { done: 'Done', doneSrPrefix: 'Done: ' };

// ─── The page's words (story 2 § Copy) ────────────────────────────────────────────────────────────────────────────
const PAGE = '/assistant/profile';
const EDITOR = '/assistant/profile/edit';
const PAGE_COPY = {
  backLink: '← Back to Assistant Management',
  title: "Your Tapestry Assistant's Profile",
  description: 'Customize the profile of your Assistant including its name and avatar.',
  summaryDone: "Your Assistant's profile is complete.",
  summaryCount: (n) => (n === 1 ? '1 item needs attention' : `${n} items need attention`),
  noProfileNotice: 'Your Assistant has no profile yet.',
  noProfileFix: 'Publish the default profile',
  editorLink: "Edit your Assistant's profile →",
  signedOut: "Sign in to see your Assistant's profile.",
  noPublicAddress: "This instance has no public web address, so this can't be done here.",
  checking: 'Checking…',
  publishing: 'Publishing…',
  comingSoon: 'Coming soon',
  // Existing words the ADRs point at, for the cases story 2 § Copy has no line of its own:
  // ADR 0002 sub-decision 6 — a press whose status read failed (the Identification Tags page's REQUEST_FAILED);
  requestFailed: 'This instance did not answer; nothing was published.',
  // ADR 0002 sub-decision 2 — a panel with no row, a failed fetch, or a check that failed (the Identification Tags
  // page's couldNotCheck['request-failed']);
  couldNotCheck: 'Could not check: this instance did not answer.',
  // and the profile could not be read from this instance's relay (its couldNotCheck['local-unreadable']).
  profileUnreadable: "Could not read this instance's relay.",
  needsAttention: 'Needs attention',
  done: 'Done',
};

/**
 * Each panel's words (story 2 § Copy, the Panels table). `lines` is keyed by the reason ADR 0001 sub-decision 3 gives;
 * functions take the row's fields and the instance block.
 */
const PANELS = {
  avatar: {
    title: 'A personalized avatar',
    description: 'Your own picture, stamped with the Tapestry mark and hosted by this instance, so every nostr app shows whose Assistant this is.',
    done: ({ domain }) => `Your Assistant's picture is your personalized avatar, hosted by ${domain}.`,
    lines: {
      'standard-image': () => 'Your Assistant is using the standard Tapestry image, not a personalized one.',
      'not-personalized': ({ domain }) => `Your Assistant's picture is not a personalized avatar from ${domain}.`,
      'no-picture': () => 'Your Assistant has no picture.',
      'missing-file': ({ domain }) => `Your Assistant's picture points at an avatar ${domain} no longer has.`,
    },
  },
  banner: {
    title: 'A personalized background image',
    description: "A banner for your Assistant's profile, branded to this instance.",
    line: "Not checked yet; it doesn't count toward your profile being complete.",
  },
  nip05: {
    title: 'A working NIP-05',
    description: ({ domain }) => `A NIP-05 address on this instance's domain lets nostr apps verify your Assistant. ${domain} hosts it.`,
    done: ({ domain, address }) => `${address} is verified: ${domain} lists it for your Assistant.`,
    lines: {
      none: () => "Your Assistant's profile has no NIP-05 address.",
      'other-domain': ({ domain, address }) => `${address} is not on this instance's domain, ${domain}.`,
      'not-listed': ({ domain, address }) => `${domain} does not list ${address} for your Assistant.`,
      unreachable: ({ domain }) => `Could not check: ${domain} did not answer.`,
    },
    fix: () => 'Republish to register my NIP-05',
  },
  website: {
    title: 'Website',
    description: "Your Assistant's website is this instance's address, so people can see where it lives.",
    done: ({ url }) => `Your Assistant's website is ${url}.`,
    lines: {
      none: () => "Your Assistant's profile has no website.",
      other: ({ url, value }) => `Your Assistant's website is ${value}, not ${url}.`,
    },
    fix: ({ url }) => `Set website to ${url}`,
  },
  'name-and-about': {
    title: 'Name and About',
    description: 'A name and an About text tell people whose Assistant this is and what it does.',
    done: () => 'Your Assistant has a name and an About text.',
    lines: {
      'no-name': () => "Your Assistant's profile has no name.",
      'no-about': () => "Your Assistant's profile has no About text.",
      'no-name-no-about': () => "Your Assistant's profile has no name and no About text.",
    },
    fixByReason: {
      'no-name': 'Fill in the default name',
      'no-about': 'Fill in the default About text',
      'no-name-no-about': 'Fill in the default name and About text',
    },
  },
  'client-tag': {
    title: 'Client tag',
    description: "Your Assistant's profile carries this instance's client tag, so apps can see where it was published from.",
    done: ({ domain }) => `Your Assistant's profile carries the client tag ${domain}.`,
    lines: { none: ({ domain }) => `Your Assistant's profile has no client tag for ${domain}.` },
    fix: ({ domain }) => `Republish from ${domain}`,
  },
  visible: {
    title: 'Visible to other nostr apps',
    description: "Your Assistant's latest profile is on the relays this instance publishes to, so other nostr apps can find it.",
    done: ({ n, m }) => `Your Assistant's latest profile is on ${n} of ${m} outside relays.`,
    lines: {
      'only-here': () => "Your Assistant's latest profile is only on this instance's relay.",
      'local-only-mode': () => "This instance is set to publish locally only, so your Assistant's profile is not sent to outside relays.",
      'no-relays': () => 'This instance has no outside relays to publish to.',
      unreachable: () => 'Could not check: no outside relay answered.',
    },
    fix: () => 'Publish to outside relays',
  },
};

// ─── The avatar panel's words (story 3 § Copy) ────────────────────────────────────────────────────────────────────
const AVATAR_COPY = {
  fix: 'Make my personalized avatar',
  accept: 'Publish this avatar',
  discard: 'Not now',
  making: 'Stamping your picture…',
  'no-picture': 'Your nostr profile has no picture to stamp yet. Add one in your nostr app, then come back.',
  unfetchable: "Your nostr profile's picture could not be fetched, so it can't be stamped.",
  'not-stampable': "Your nostr profile's picture isn't an image this instance can stamp.",
};

/** The stamped avatar's routes (ADR 0003 sub-decisions 1–2). */
const MY_PICTURE_ROUTE = '/api/assistant/my-picture';
const AVATAR_ROUTE = '/api/assistant/avatar';
const OLD_PROXY_ROUTE = '/api/assistant/owner-avatar';
const MAX_NEW_AVATARS_PER_DAY = 20;

// ─── Canned answers of GET /api/assistant/attention's `profile` action (ADR 0001 § Implementation notes 2) ─────────

/** One row, done unless `over` says otherwise, with the detail fields its key carries. */
function row(key, over = {}, instance = PUBLIC_INSTANCE) {
  const counts = key !== 'banner';
  const base = { key, counts, finished: true, done: true, reason: null };
  const detail = {
    avatar: { picture: `${instance.website}/generated/ta-avatar-${'ab'.repeat(16)}.png` },
    banner: {},
    nip05: { address: `alice-tapestry-assistant-a2a2a2@${instance.domain}` },
    website: { value: instance.website, expected: instance.website },
    'name-and-about': { hasName: true, hasAbout: true },
    'client-tag': { expected: instance.domain },
    visible: { relaysTotal: 3, relaysAnswered: 3, relaysHolding: 2 },
  }[key];
  if (key === 'banner') return { key, counts: false, finished: false, done: false, reason: 'not-checked', ...over };
  return { ...base, ...detail, ...over };
}

/** The action from its rows: the flags follow ADR 0001 sub-decision 4 unless given. */
function profileAction(rows, { instance = PUBLIC_INSTANCE, hasProfile = true, ...flags } = {}) {
  const counted = rows.filter((r) => r.counts);
  const finished = counted.every((r) => r.finished);
  const done = finished && counted.every((r) => r.done);
  const pending = counted.some((r) => r.finished && !r.done);
  return { finished, done, pending, hasProfile, instance: instanceBlock(instance), items: rows, ...flags };
}
const allRows = (over = {}, instance = PUBLIC_INSTANCE) => ITEMS.map((i) => row(i.key, over[i.key] || {}, instance));

/** A signed-in answer with the given profile action, and the identification-tags action as given (default: done). */
function withProfile(profile, identificationTags) {
  const idTags = identificationTags === undefined
    ? { finished: true, done: true, pending: false, taggings: [] }
    : identificationTags;
  const actions = {};
  if (idTags) actions['identification-tags'] = idTags;
  if (profile) actions.profile = profile;
  return { success: true, signedIn: true, hasAssistant: true, actions };
}

/** Every counted item done. */
const PROFILE_DONE = profileAction(allRows());

/** Two counted items need attention (finished): the standard image, and a website elsewhere. */
const PROFILE_PENDING = profileAction(allRows({
  avatar: { done: false, reason: 'standard-image', picture: PUBLIC_INSTANCE.avatarUrl },
  website: { done: false, reason: 'other', value: 'https://alice.example' },
}));

/** Everything done except the visibility check, which did not finish: unfinished, not pending. */
const PROFILE_UNFINISHED = profileAction(allRows({
  visible: { finished: false, done: false, reason: 'unreachable', relaysTotal: 3, relaysAnswered: 0, relaysHolding: 0 },
}));

/** One of each fixable state, for the page: every panel but the banner needs attention, each with a fix. */
const PROFILE_ALL_FIXABLE = profileAction(allRows({
  avatar: { done: false, reason: 'standard-image', picture: PUBLIC_INSTANCE.avatarUrl },
  nip05: { done: false, reason: 'not-listed' },
  website: { done: false, reason: 'none', value: null },
  'name-and-about': { done: false, reason: 'no-about', hasAbout: false },
  'client-tag': { done: false, reason: 'none' },
  visible: { done: false, reason: 'only-here', relaysTotal: 3, relaysAnswered: 3, relaysHolding: 0 },
}));

/** No profile anywhere: every counted item needs attention with reason no-profile (story 1 AC-3). */
const PROFILE_NONE = profileAction(
  ITEMS.map((i) => (i.key === 'banner' ? row('banner') : { key: i.key, counts: true, finished: true, done: false, reason: 'no-profile' })),
  { hasProfile: false },
);

/** A dev box: the four instance-bound items say no-public-address (story 1 AC-4, settled at approval). */
const PROFILE_DEV = profileAction(allRows({
  avatar: { done: false, reason: 'no-public-address', picture: REFERENCE_TA_AVATAR_URL },
  nip05: { done: false, reason: 'no-public-address', address: null },
  website: { done: false, reason: 'no-public-address', value: null, expected: '' },
  'client-tag': { done: false, reason: 'no-public-address', expected: DEV_INSTANCE.domain },
}, DEV_INSTANCE), { instance: DEV_INSTANCE });

/** The profile check threw (ADR 0001 sub-decision 6). */
const PROFILE_CHECK_FAILED = { finished: false, done: false, pending: false, reason: 'check-failed', items: [] };

// ─── /api/assistant/status and the one writer's answers (ADR 0002 § Codebase facts) ──────────────────────────────
const DEFAULTS = {
  name: "Alice's Tapestry Assistant",
  display_name: "Alice's Tapestry Assistant",
  about: 'I am the Tapestry Assistant for Alice (npub1alice). You can find my pubkey in my owner\'s kind 10040 event.',
  picture: PUBLIC_INSTANCE.avatarUrl,
  banner: '',
  website: PUBLIC_INSTANCE.website,
  nip05: '',
  lud16: '',
};
const PUBLISHED = {
  name: 'Alice Bot',
  display_name: '',
  about: '',
  picture: PUBLIC_INSTANCE.avatarUrl,
  banner: 'https://img.example/banner.png',
  website: '',
  lud16: 'alice@pay.example',
  nip05: 'old@elsewhere.example',
  custom: 'kept by nobody',
};
function statusAnswer({ hasProfile = true, profile = PUBLISHED, defaults = DEFAULTS } = {}) {
  return {
    success: true, hasRelayKey: true, assistantPubkey: 'a2'.repeat(32), assistantNpub: 'npub1fixture',
    hasProfile, profile: hasProfile ? profile : null, profileSource: hasProfile ? 'local' : null,
    isOwner: false, isPublicInstance: true, defaults,
  };
}
function publishAnswer({ relays = ['wss://a.example', 'wss://b.example'], accepted = relays.length } = {}) {
  const results = relays.map((relay, i) => ({ relay, status: i < accepted ? 'accepted' : 'refused', reason: i < accepted ? '' : 'blocked' }));
  const outcome = accepted === relays.length ? 'published' : accepted > 0 ? 'partly-published' : 'not-delivered';
  return {
    success: true, outcome, localOnly: false,
    message: `Your Tapestry Assistant's profile was saved on this instance's relay and accepted by ${accepted} of ${relays.length} relays.`,
    relays: { total: relays.length, success: accepted, results },
  };
}
const PUBLISH_LOCAL_FAILED = {
  success: false, stage: 'local', localOnly: false,
  error: "Your Tapestry Assistant's profile could not be saved on this instance's relay (strfry import failed), so it was not sent to any other relay.",
  relays: { total: 0, success: 0, results: [] },
};

module.exports = {
  ITEMS, COUNTED, PROFILE_CONTENT_FIELDS, ACTION, REFERENCE_TA_AVATAR_URL,
  PUBLIC_INSTANCE, DEV_INSTANCE, instanceBlock,
  HUB_COPY, PAGE, EDITOR, PAGE_COPY, PANELS, AVATAR_COPY,
  MY_PICTURE_ROUTE, AVATAR_ROUTE, OLD_PROXY_ROUTE, MAX_NEW_AVATARS_PER_DAY,
  row, profileAction, allRows, withProfile,
  PROFILE_DONE, PROFILE_PENDING, PROFILE_UNFINISHED, PROFILE_ALL_FIXABLE, PROFILE_NONE, PROFILE_DEV, PROFILE_CHECK_FAILED,
  DEFAULTS, PUBLISHED, statusAnswer, publishAnswer, PUBLISH_LOCAL_FAILED,
};
