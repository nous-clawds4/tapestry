/**
 * The three steps of the /setup checklist, in Tapestry's terms (setup-page-scaffold #1), the
 * words /setup shows once it knows each step's state (setup-status-and-alert #1), and the Setup
 * Alert's words (setup-status-and-alert #2).
 *
 * One definition feeds both the /setup page and the placeholder page behind each step, so a
 * step's name on the checklist and its page's heading cannot drift apart.
 *
 * The words were approved with the stories; change them there first:
 * engineering-team/stories/done/setup-page-scaffold/1-setup-page-and-placeholders.md § Copy,
 * engineering-team/stories/setup-status-and-alert/1-setup-shows-where-you-stand.md § Copy, and
 * engineering-team/stories/setup-status-and-alert/2-the-setup-alert.md § Copy.
 */

export const CREATE_ACCOUNT_STEP = {
  path: '/setup/create-account',
  label: 'Create your account',
  badge: 'Start here',
  text: 'Your account comes with your own Tapestry Assistant: a nostr identity this instance holds for you, which signs and publishes on your behalf.',
  placeholder: 'This page will set up your account on this Tapestry instance — which means setting up your Tapestry Assistant, the nostr identity this instance holds for you, which signs and publishes on your behalf.',
  doneText: 'This instance holds your Tapestry Assistant.',
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
  doneText: 'Your Treasure Map names your Tapestry Assistant for your rank and followers scores.',
  // Replaces `text` while the step is not done because the Map names another provider.
  otherProviderText: 'Your Treasure Map names another provider for your scores.',
};

export const SETUP_STEPS = [CREATE_ACCOUNT_STEP, FOLLOW_STEP, ACTIVATE_STEP];

/** Step 2's done sentence. `n` counts the accounts followed other than yourself. */
export function followDoneText(n) {
  return n === 1 ? '1 account followed.' : `${n} accounts followed.`;
}

/** The page's own words (setup-status-and-alert #1 § Copy). */
export const SETUP_COPY = {
  signedOutLine: "Sign in to see which steps you've done.",
  signInButton: 'Sign in with nostr',
  doneBadge: 'Done',
  doneSrPrefix: 'Done: ',
  notDoneSrPrefix: 'Not done: ',
  allDone: "You're all set!",
};

/**
 * The Setup Alert's words (setup-status-and-alert #2 § Copy, Brainstorm's). The button reads
 * "Finish setup →"; the arrow is its own piece because it is decorative, and the pill has no fixed
 * name: it is announced as it reads (setup-status-and-alert #3, ADR 0003).
 */
export const SETUP_ALERT_COPY = {
  sentence: 'Finish setting up your account',
  button: 'Finish setup',
  arrow: '→',
};

/** The Setup Alert's count. `n` counts the steps it is confident are not done. */
export function alertCountText(n) {
  return n === 1 ? '· 1 step left' : `· ${n} steps left`;
}
