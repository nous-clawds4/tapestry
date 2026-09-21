/**
 * The three steps of the /setup checklist, in Tapestry's terms (setup-page-scaffold #1).
 *
 * One definition feeds both the /setup page and the placeholder page behind each step, so a
 * step's name on the checklist and its page's heading cannot drift apart.
 *
 * The words were approved with the story; change them there first:
 * engineering-team/stories/setup-page-scaffold/1-setup-page-and-placeholders.md § Copy.
 */

export const CREATE_ACCOUNT_STEP = {
  path: '/setup/create-account',
  label: 'Create your account',
  badge: 'Start here',
  text: 'Your account comes with your own Tapestry Assistant: a nostr identity this instance holds for you, which signs and publishes on your behalf.',
  placeholder: 'This page will set up your account on this Tapestry instance — which means setting up your Tapestry Assistant, the nostr identity this instance holds for you, which signs and publishes on your behalf.',
};

export const FOLLOW_STEP = {
  path: '/setup/follow',
  label: 'Create your follow list',
  badge: 'Required for scoring',
  text: "Your trust scores are built from who you follow — without at least one follow, there's nothing to calculate.",
  placeholder: 'This page will help you publish your follow list — a kind 3 nostr event — with at least one follow who is not you. Your trust scores are calculated from it.',
};

export const ACTIVATE_STEP = {
  path: '/setup/activate',
  label: 'Activate your Brainstorm account',
  badge: 'Required for other apps',
  text: 'One signature publishes your Treasure Map, which tells other apps that your Tapestry Assistant manages your rank and followers scores.',
  placeholder: 'This page will set up your Treasure Map — a kind 10040 nostr event — so that your rank and followers scores are managed by your Tapestry Assistant on this instance.',
};

export const SETUP_STEPS = [CREATE_ACCOUNT_STEP, FOLLOW_STEP, ACTIVATE_STEP];
