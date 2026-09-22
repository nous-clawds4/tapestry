'use strict';
/**
 * The approved words and addresses of book assistant-management, as its stories state them. One copy,
 * shared by the Node suites (test/assistant-management-page.test.js, test/assistant-alert.test.js) and the
 * browser suites (tests/brainstorm/assistant-management-page.spec.js, tests/brainstorm/assistant-alert.spec.js),
 * so the four cannot disagree about what the owner approved.
 *
 * Source of truth: engineering-team/stories/done/assistant-management/1-the-assistant-management-page.md § Copy and
 * engineering-team/stories/done/assistant-management/2-the-assistant-alert.md § Copy (approved 2026-09-21), with the
 * display fixes story 1 lists: straight apostrophes, first letters capitalized, "(link to …)" made into the link
 * it asks for, and "follows (kind 3)". Change a word there first, then here.
 */

// ─── Addresses (story 1 § Copy; ADR assistant-management/0001) ───────────────────────────────
const HUB = '/assistant';
const PROFILE_PAGE = '/assistant/profile';
const EDITOR = '/assistant/profile/edit';

// ─── The three NIP links (story 1 § Copy; decoded at planning) ────────────────────────────
const NIP_LINKS = {
  trustedAssertions: 'https://github.com/nostr-protocol/nips/blob/master/85.md',
  trustedLists: 'https://nostrhub.io/naddr1qvzqqqrcvypzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qqxhgun4wd6x2epdd35hxarn9c5yqp',
  decentralizedLists: 'https://nostrhub.io/naddr1qvzqqqrcvypzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qqfkgetrv4h8gunpd35h5ety94kxjum5wvzg04gg',
};

// ─── Sections, in order (story 1 AC-1; keys from ADR 0001 sub-decision 1) ──────────────────
const SECTIONS = [
  { key: 'persona', heading: "Your Assistant's Public Persona" },
  { key: 'trusted-content', heading: 'Publication of Trusted Content' },
  { key: 'notifications', heading: 'Notifications, Alerts, and Preferences' },
];

const NOT_YET_DEFINED = 'Not yet defined.';

/**
 * The ten actions, in order. `text` is the description as a reader sees it (links as their words); `link` is the
 * one NIP link inside it, or null; `alertCriteria` / `planningNotes` are null where the owner gave none.
 */
const ACTIONS = [
  {
    section: 'persona',
    path: '/assistant/profile',
    title: "Your Tapestry Assistant's Profile",
    text: 'Customize the profile of your Assistant including its name and avatar.',
    link: null,
    alertCriteria: 'If any of the Tapestry Assistant profile criteria are not met (create avatar, working NIP-05, client tag, URL, etc.).',
    planningNotes: 'This page will not be the same as the Edit Assistant Profile page. It will be effectively a checklist of features that need to be done correctly. If any are done incorrectly, it may direct to the Edit Assistant Profile page, depending on which thing is done incorrectly.',
    editLink: { text: "Edit your Assistant's profile →", to: EDITOR },
  },
  {
    section: 'persona',
    path: '/assistant/identification-tags',
    title: 'Identification Tags',
    text: "Part of the Assistant's identity is its relationship to you. A handful of Tags will be used to broadcast this relationship between you and your Tapestry Assistant to outside clients, applications and services.",
    link: null,
    alertCriteria: 'If any of the required Taggings are missing. Taggings that you will use on your Assistant include: "My Tapestry Assistant", "My Agent"; Taggings that your Assistant will use on you: "My Tapestry Owner" and "My Owner". More may be added later when we flesh this out in detail.',
    planningNotes: null,
  },
  {
    section: 'trusted-content',
    path: '/assistant/trusted-assertions',
    title: 'Trusted Assertions',
    text: 'Enable Tapestry to broadcast trust scores using NIP-85 Trusted Assertions, curated by your trusted and extended community. This includes trust scores for pubkeys as well as for other categories of content. From a technical standpoint, this means your Assistant will publish kinds 3038x events on your behalf.',
    link: { text: 'NIP-85 Trusted Assertions', href: NIP_LINKS.trustedAssertions },
    alertCriteria: null,
    planningNotes: null,
  },
  {
    section: 'trusted-content',
    path: '/assistant/trusted-lists',
    title: 'Trusted Lists',
    text: 'Enable Tapestry to broadcast lists, curated by your trusted and extended community. This includes Trusted Lists of pubkeys as well as Trusted Lists of other categories of content. From a technical standpoint, this means your Assistant will publish kinds 3039x events on your behalf, according to the Trusted Lists NIP.',
    link: { text: 'Trusted Lists NIP', href: NIP_LINKS.trustedLists },
    alertCriteria: null,
    planningNotes: null,
  },
  {
    section: 'trusted-content',
    path: '/assistant/dlists',
    title: 'Decentralized Lists',
    text: 'Enable your Tapestry Assistant to manage Decentralized Lists in a way that is more detailed than Trusted Lists. From a technical standpoint, this means your Assistant will publish kinds 39998 and 39999 events on your behalf according to the Decentralized Lists NIP.',
    link: { text: 'Decentralized Lists NIP', href: NIP_LINKS.decentralizedLists },
    alertCriteria: null,
    planningNotes: null,
  },
  {
    section: 'trusted-content',
    path: '/assistant/bounties',
    title: 'Bounties',
    text: 'Incentivise your trusted community with a sats reward to answer questions, to research topics, and to submit information that is of special interest to you.',
    link: null,
    alertCriteria: null,
    planningNotes: null,
  },
  {
    section: 'trusted-content',
    path: '/assistant/pins',
    title: 'Pins',
    text: 'Manage your preferences via the Pin system. This means your Assistant will process data from your trusted community and publish Pins on your behalf.',
    link: null,
    alertCriteria: null,
    planningNotes: null,
  },
  {
    section: 'trusted-content',
    path: '/assistant/tags',
    title: 'Tags',
    text: 'Manage Tags on your behalf. This means your Assistant will process data from your trusted community and publish Tags on your behalf.',
    link: null,
    alertCriteria: null,
    planningNotes: 'Unclear at the moment how this feature might work. Might require an LLM.',
  },
  {
    section: 'notifications',
    path: '/assistant/notifications-and-alerts',
    title: 'Notifications and Alerts',
    text: 'Enable your Assistant to send you notifications and alert you with updated findings and discoveries from your trusted community.',
    link: null,
    alertCriteria: null,
    planningNotes: null,
  },
  {
    section: 'notifications',
    path: '/assistant/preferences',
    title: 'Preferences',
    text: 'Manage various preferences, such as Trust Determination Methods for Trusted Lists and Decentralized Lists management. These preferences are stored as nostr events, which may be signed by you but in some cases will be signed by your Assistant.',
    link: null,
    alertCriteria: null,
    planningNotes: "Why would your Assistant sign a Preferences event rather than you personally? Because you might wish to update your preferences based on advice from your trusted community, and you may want your Assistant to do this for you even when you're offline.",
  },
];

// ─── The FAQ, in order (story 1 AC-4 and § Copy) ────────────────────────────────────────
const FAQ = [
  {
    question: 'What is a Tapestry Assistant?',
    answer: "A Tapestry Assistant is a personalized nostr account, designed to serve you, whose nsec lives on our servers. Your Assistant's account is created when you sign up to our service.",
  },
  {
    question: 'Why do I need an Assistant?',
    answer: "The purpose of our service is to enable your trusted community to curate information for you. Ratings, Tags, articles, and other categories of content and signals of social proof are processed to determine who is the most trustworthy, and in what context, to curate your content, facts and information. Scores that indicate user trustworthiness and identify content worthy of your attention are published as nostr events and made available to other clients. This needs to happen in real time. You can't be online 24/7, which means you can't be expected to publish these events with your personal account. Your Assistant exists primarily to publish these events on your behalf, in real time, so the data is always available, no matter which app or client you may be visiting at any given time.",
  },
  {
    question: 'What tasks can my Tapestry Assistant perform on my behalf?',
    answer: 'Your Assistant publishes Trusted Assertions (kind 3038x events), Trusted Lists (kind 3039x events), and maintains generic Decentralized Lists (kinds 39998 and 39999 events). Your Assistant also publishes its own profile (kind 0), follows (kind 3), and manages a handful of Tags (e.g. it will Tag itself as an Assistant and Tag you as its Owner). Coming soon: your Assistant will be able to communicate with you via DMs for alerts, notifications, to manage preferences, etc.',
  },
  {
    question: 'Can I have more than one Assistant?',
    answer: 'Yes you can, and you probably will! Any service that maintains an Assistant on your behalf is called a WoT Service Provider. Examples of WoT Service Providers include Brainstorm (brainstorm.world) and Tapestry (tapestry.brainstorm.world), Relatr, and more.',
  },
  {
    question: 'If I can have multiple Assistants spread across multiple WoT Service Providers, how do I keep track of which Assistant does what?',
    answer: 'This is the function of a kind 10040 event, what we call your Treasure Map. Its purpose is to let other clients and apps know how to find the trust metrics and other categories of content that are published by your Assistants. It can record, for example, that your Brainstorm Assistant publishes rank and followers scores for nostr accounts, your WoT SP2 Assistant publishes Trusted Lists for Tags, your Oxford Assistant publishes Trusted Lists relevant to your academic interests, and your Tapestry Assistant maintains Tapestry Firmware in the shape of Decentralized Lists.',
  },
];

// ─── Page copy (story 1 § Copy) ─────────────────────────────────────────────────────────
const COPY = {
  kicker: 'Assistant Management',
  heading: 'Manage the Profile and Capabilities of your Tapestry Assistant',
  signedOutLine: 'Sign in to manage your Tapestry Assistant.',
  signInButton: 'Sign in with nostr',
  noAssistantLine: "You don't have a Tapestry Assistant on this instance yet. Setting one up is the first step of Account Setup.",
  noAssistantLink: 'Go to Account Setup →',
  needsAttention: 'Needs attention',
  needsAttentionSrPrefix: 'Needs attention:',
  faqToggle: 'Frequently asked questions',
  placeholder: 'Placeholder page.',
  alertCriteriaHeading: 'Alert criteria',
  planningNotesHeading: 'Planning notes',
  notYetDefined: NOT_YET_DEFINED,
  backToHub: '← Back to Assistant Management',
  editorHeading: 'Edit Assistant Profile',
  editorBack: "← Back to Your Tapestry Assistant's Profile",
  settingsCardText: 'See your assistant, and edit and publish its profile, on the Edit Assistant Profile page.',
  settingsCardButton: '🤖 Edit Assistant Profile',
};

/** The count line on the hub, and inside the pill (story 1 § Copy; story 2 § Copy). */
function countText(n) {
  return n === 1 ? '1 action needs attention' : `${n} actions need attention`;
}

// ─── Outside the app (story 1 AC-6 as amended; ADR 0001 sub-decision 6) ───────────────────
const EDITOR_PAGE_PHRASE = `the Edit Assistant Profile page (${EDITOR})`;
const LEGACY_PANEL_SENTENCE = 'Its profile is edited and published on the Edit Assistant Profile page.';
const LEGACY_PANEL_LINK_TEXT = '🤖 Edit and publish its profile on the Edit Assistant Profile page →';

// ─── The Assistant Alert (story 2 § Copy) ───────────────────────────────────────────────
const ALERT = {
  name: 'Manage your Tapestry Assistant',
  sentence: 'Manage your Tapestry Assistant',
  button: 'Manage Assistant →',
  mark: '⚠',
};

module.exports = {
  HUB, PROFILE_PAGE, EDITOR, NIP_LINKS, SECTIONS, ACTIONS, FAQ, COPY, NOT_YET_DEFINED, countText,
  EDITOR_PAGE_PHRASE, LEGACY_PANEL_SENTENCE, LEGACY_PANEL_LINK_TEXT, ALERT,
};
