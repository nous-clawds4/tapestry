/**
 * The Assistant Management page, as data (assistant-management #1, ADR 0001 sub-decision 1): its three
 * sections, its ten actions, its FAQ and its words — and the one answer to "which of the viewer's actions
 * need attention", which the page's marks, its count line and the Assistant Alert (story 2) all read.
 *
 * One definition feeds the page (Index.jsx), the placeholder page behind each action (ActionPage.jsx) and
 * their routes (App.jsx), so a card, its page and its address cannot drift apart. Adding an action is one
 * entry in ASSISTANT_ACTIONS.
 *
 * Pure, with one import (and its `.js`), so Node suites can load it as it is
 * (test/assistant-management-page.test.js, test/assistant-alert.test.js).
 *
 * The words were approved with the stories; change them there first:
 * engineering-team/stories/done/assistant-management/1-the-assistant-management-page.md § Copy, and
 * engineering-team/stories/done/assistant-management/2-the-assistant-alert.md § Copy.
 */

import { ASSISTANT_MANAGEMENT_PATH, MY_ASSISTANT_PATH } from '../../config/avatarMenuLinks.js';

/** The profile action's page — the checklist to come, and the editor's parent. */
export const ASSISTANT_PROFILE_PATH = `${ASSISTANT_MANAGEMENT_PATH}/profile`;

/** The three NIPs the action descriptions link to (story 1 § Copy). */
export const NIP_LINKS = {
  trustedAssertions: 'https://github.com/nostr-protocol/nips/blob/master/85.md',
  trustedLists: 'https://nostrhub.io/naddr1qvzqqqrcvypzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qqxhgun4wd6x2epdd35hxarn9c5yqp',
  decentralizedLists: 'https://nostrhub.io/naddr1qvzqqqrcvypzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qqfkgetrv4h8gunpd35h5ety94kxjum5wvzg04gg',
};

/** The page's sections, in order. */
export const ASSISTANT_SECTIONS = [
  { key: 'persona', heading: "Your Assistant's Public Persona" },
  { key: 'trusted-content', heading: 'Publication of Trusted Content' },
  { key: 'notifications', heading: 'Notifications, Alerts, and Preferences' },
];

/**
 * The actions, in order. A description is a list of parts: a string, or { text, href } for a link, which
 * opens in a new tab. alertCriteria and planningNotes are the owner's words for the page that will be built,
 * or null where the owner gave none.
 */
export const ASSISTANT_ACTIONS = [
  {
    key: 'profile',
    section: 'persona',
    path: ASSISTANT_PROFILE_PATH,
    title: "Your Tapestry Assistant's Profile",
    description: ['Customize the profile of your Assistant including its name and avatar.'],
    alertCriteria: 'If any of the Tapestry Assistant profile criteria are not met (create avatar, working NIP-05, client tag, URL, etc.).',
    planningNotes: 'This page will not be the same as the Edit Assistant Profile page. It will be effectively a checklist of features that need to be done correctly. If any are done incorrectly, it may direct to the Edit Assistant Profile page, depending on which thing is done incorrectly.',
    editLink: { text: "Edit your Assistant's profile →", to: MY_ASSISTANT_PATH },
  },
  {
    key: 'identification-tags',
    section: 'persona',
    path: `${ASSISTANT_MANAGEMENT_PATH}/identification-tags`,
    title: 'Identification Tags',
    description: ["Part of the Assistant's identity is its relationship to you. A handful of Tags will be used to broadcast this relationship between you and your Tapestry Assistant to outside clients, applications and services."],
    alertCriteria: 'If any of the required Taggings are missing. Taggings that you will use on your Assistant include: "My Tapestry Assistant", "My Agent"; Taggings that your Assistant will use on you: "My Tapestry Owner" and "My Owner". More may be added later when we flesh this out in detail.',
    planningNotes: null,
  },
  {
    key: 'trusted-assertions',
    section: 'trusted-content',
    path: `${ASSISTANT_MANAGEMENT_PATH}/trusted-assertions`,
    title: 'Trusted Assertions',
    description: [
      'Enable Tapestry to broadcast trust scores using ',
      { text: 'NIP-85 Trusted Assertions', href: NIP_LINKS.trustedAssertions },
      ', curated by your trusted and extended community. This includes trust scores for pubkeys as well as for other categories of content. From a technical standpoint, this means your Assistant will publish kinds 3038x events on your behalf.',
    ],
    alertCriteria: null,
    planningNotes: null,
  },
  {
    key: 'trusted-lists',
    section: 'trusted-content',
    path: `${ASSISTANT_MANAGEMENT_PATH}/trusted-lists`,
    title: 'Trusted Lists',
    description: [
      'Enable Tapestry to broadcast lists, curated by your trusted and extended community. This includes Trusted Lists of pubkeys as well as Trusted Lists of other categories of content. From a technical standpoint, this means your Assistant will publish kinds 3039x events on your behalf, according to the ',
      { text: 'Trusted Lists NIP', href: NIP_LINKS.trustedLists },
      '.',
    ],
    alertCriteria: null,
    planningNotes: null,
  },
  {
    key: 'dlists',
    section: 'trusted-content',
    path: `${ASSISTANT_MANAGEMENT_PATH}/dlists`,
    title: 'Decentralized Lists',
    description: [
      'Enable your Tapestry Assistant to manage Decentralized Lists in a way that is more detailed than Trusted Lists. From a technical standpoint, this means your Assistant will publish kinds 39998 and 39999 events on your behalf according to the ',
      { text: 'Decentralized Lists NIP', href: NIP_LINKS.decentralizedLists },
      '.',
    ],
    alertCriteria: null,
    planningNotes: null,
  },
  {
    key: 'bounties',
    section: 'trusted-content',
    path: `${ASSISTANT_MANAGEMENT_PATH}/bounties`,
    title: 'Bounties',
    description: ['Incentivise your trusted community with a sats reward to answer questions, to research topics, and to submit information that is of special interest to you.'],
    alertCriteria: null,
    planningNotes: null,
  },
  {
    key: 'pins',
    section: 'trusted-content',
    path: `${ASSISTANT_MANAGEMENT_PATH}/pins`,
    title: 'Pins',
    description: ['Manage your preferences via the Pin system. This means your Assistant will process data from your trusted community and publish Pins on your behalf.'],
    alertCriteria: null,
    planningNotes: null,
  },
  {
    key: 'tags',
    section: 'trusted-content',
    path: `${ASSISTANT_MANAGEMENT_PATH}/tags`,
    title: 'Tags',
    description: ['Manage Tags on your behalf. This means your Assistant will process data from your trusted community and publish Tags on your behalf.'],
    alertCriteria: null,
    planningNotes: 'Unclear at the moment how this feature might work. Might require an LLM.',
  },
  {
    key: 'notifications-and-alerts',
    section: 'notifications',
    path: `${ASSISTANT_MANAGEMENT_PATH}/notifications-and-alerts`,
    title: 'Notifications and Alerts',
    description: ['Enable your Assistant to send you notifications and alert you with updated findings and discoveries from your trusted community.'],
    alertCriteria: null,
    planningNotes: null,
  },
  {
    key: 'preferences',
    section: 'notifications',
    path: `${ASSISTANT_MANAGEMENT_PATH}/preferences`,
    title: 'Preferences',
    description: ['Manage various preferences, such as Trust Determination Methods for Trusted Lists and Decentralized Lists management. These preferences are stored as nostr events, which may be signed by you but in some cases will be signed by your Assistant.'],
    alertCriteria: null,
    planningNotes: "Why would your Assistant sign a Preferences event rather than you personally? Because you might wish to update your preferences based on advice from your trusted community, and you may want your Assistant to do this for you even when you're offline.",
  },
];

/** The FAQ, in order: the owner's words (follows are kind 3, as approved). */
export const ASSISTANT_FAQ = [
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

/** The page's own words (story 1 § Copy). */
export const ASSISTANT_COPY = {
  kicker: 'Assistant Management',
  // The heading, in two parts: the second is accented, as /setup accents "your account".
  headingLead: 'Manage the Profile and Capabilities of ',
  headingAccent: 'your Tapestry Assistant',
  signedOutLine: 'Sign in to manage your Tapestry Assistant.',
  signInButton: 'Sign in with nostr',
  noAssistantLine: "You don't have a Tapestry Assistant on this instance yet. Setting one up is the first step of Account Setup.",
  noAssistantLink: 'Go to Account Setup →',
  needsAttention: 'Needs attention',
  needsAttentionSrPrefix: 'Needs attention: ',
  faqToggle: 'Frequently asked questions',
  placeholder: 'Placeholder page.',
  alertCriteriaHeading: 'Alert criteria',
  planningNotesHeading: 'Planning notes',
  notYetDefined: 'Not yet defined.',
  backToHub: '← Back to Assistant Management',
  editorHeading: 'Edit Assistant Profile',
  editorBack: "← Back to Your Tapestry Assistant's Profile",
};

/** The Assistant Alert's words (story 2 § Copy; ADR 0002 sub-decision 3). */
export const ASSISTANT_ALERT_COPY = {
  name: 'Manage your Tapestry Assistant',
  sentence: 'Manage your Tapestry Assistant',
  button: 'Manage Assistant →',
};

/** The count line on the page, and the pill's count. */
export function attentionCountText(n) {
  return n === 1 ? '1 action needs attention' : `${n} actions need attention`;
}

/** A description's words as a reader sees them: its strings, and its links' words. */
export function plainText(parts) {
  return (parts || []).map((part) => (typeof part === 'string' ? part : part.text)).join('');
}

/**
 * Which of the viewer's actions need attention (story 1 AC-2; the pill counts the same answer, story 2
 * AC-5). A scaffold: every action, for a viewer who has an assistant on this instance — sign-in's
 * user.assistantPubkey, the getAssistantPubkeyFor answer that also marks /setup's first step done — and
 * none for anyone else. When the real per-action checks come, this answer (or what replaces it) stays the
 * one source for both the page and the pill.
 * @param {?{ assistantPubkey?: ?string }} user
 * @returns {{ hasAssistant: boolean, needsAttention: string[], count: number }}
 */
export function assistantAttention(user) {
  const hasAssistant = Boolean(user && user.assistantPubkey);
  const needsAttention = hasAssistant ? ASSISTANT_ACTIONS.map((action) => action.key) : [];
  return { hasAssistant, needsAttention, count: needsAttention.length };
}
