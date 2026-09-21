/**
 * The destinations both avatar menus offer (navigation-scaffolding #2).
 *
 * The app has two shells — the Brainstorm search side and the Tapestry control
 * panel — each with its own avatar dropdown. They drifted: which menu offered
 * your own profile, your assistant's, or the dashboards depended on which half
 * of the app you were standing in, and several links were owner-gated for no
 * reason a user could see. This module is the single list both menus render, so
 * they can't drift again.
 *
 * The one deliberate difference is where "My Profile" points: the Main menu
 * sends you to `/user/<pubkey>` (the same profile page search results link to),
 * the Tapestry menu to `/tapestry/users/<pubkey>`. That's the caller's
 * `profileBase`. "My Assistant's Profile" opens the one My Assistant page from
 * both (assistant-profile #4).
 *
 * Every link here is available to every signed-in user. The single exception is
 * "My Assistant's Profile", which has no target when the caller has no assistant
 * and cannot create one here — it stays visible and disabled rather than
 * disappearing, so the menu reads the same for everyone.
 *
 * This module has no imports, so the Node test suite can load it as it is
 * (test/my-assistant-page.test.js). Keep it that way.
 */

export const NO_ASSISTANT_REASON =
  'No assistant is provisioned for your account yet.';

/** The My Assistant page — the one place anyone manages their own assistant (ADR assistant-profile/0004). */
export const MY_ASSISTANT_PATH = '/assistant';

/**
 * May this signed-in user create an assistant of their own here? An Admin or an
 * active Customer may: they are the roles POST /api/assistant/provision-key
 * accepts, less the Owner, whose assistant is the instance's Tapestry Assistant,
 * created when the instance is set up — provisioning cannot restore it. The
 * server still enforces its own rule; this only decides what the page offers.
 * @param {?{ classification?: string }} user
 */
export function mayCreateAssistant(user) {
  return Boolean(user) && (user.classification === 'admin' || user.classification === 'customer');
}

/**
 * Does the My Assistant page have something for this user to manage? Their
 * assistant if they have one; the Owner's even when its key is missing (the page
 * says so); or one they may create there. "My Assistant's Profile" is enabled
 * exactly when this is true and the page shows its controls exactly when it is
 * true, so the two cannot disagree.
 * @param {?{ classification?: string, assistantPubkey?: ?string }} user
 */
export function hasMyAssistantPage(user) {
  return Boolean(user && (user.assistantPubkey || user.classification === 'owner' || mayCreateAssistant(user)));
}

/**
 * Personal destinations — "my things".
 * @param {{ pubkey: string, assistantPubkey: ?string, classification: ?string, profileBase: string }} opts
 *   `profileBase` is '/user' (Main menu) or '/tapestry/users' (Tapestry menu).
 * @returns {Array<{ key, icon, label, to: ?string, disabledReason?: string }>}
 */
export function personalLinks({ pubkey, assistantPubkey, classification, profileBase }) {
  return [
    {
      key: 'my-profile',
      icon: '👤',
      label: 'My Profile',
      to: `${profileBase}/${pubkey}`,
    },
    {
      key: 'my-assistant',
      icon: '🤖',
      label: "My Assistant's Profile",
      to: hasMyAssistantPage({ assistantPubkey, classification }) ? MY_ASSISTANT_PATH : null,
      disabledReason: NO_ASSISTANT_REASON,
    },
    {
      key: 'my-treasure-map',
      icon: '🗺️',
      label: 'My Treasure Map',
      // Already per-viewer: the page filters kind 10040 on the signed-in pubkey.
      to: '/tapestry/grapevine/treasure-map',
    },
    {
      key: 'my-trusted-agents',
      icon: '🕵️',
      label: 'My Trusted Agents',
      to: '/tapestry/trusted-agents/mine',
    },
    {
      key: 'dictionaries',
      icon: '📖',
      label: 'Dictionaries',
      to: '/tapestry/dictionaries',
    },
  ];
}

/**
 * Top-level destinations — the three front doors of the deployment.
 *
 * `external: true` means the target is NOT inside the React router and must be
 * reached by a full page load. `/legacy/` is served by Express
 * (bin/control-panel.js) — handing it to `navigate()` would 404 into NotFound.
 */
export const destinationLinks = [
  { key: 'brainstorm-landing', icon: '🔍', label: 'Brainstorm Landing Page', to: '/' },
  { key: 'tapestry-dashboard', icon: '📊', label: 'Tapestry Dashboard', to: '/tapestry/' },
  { key: 'legacy-dashboard', icon: '🗂️', label: 'Legacy Dashboard', to: '/legacy/', external: true },
];

/**
 * Account destinations — getting your account set up, and managing your
 * assistant. Rendered as its own section, below the front doors.
 */
export const accountLinks = [
  { key: 'account-setup', icon: '🧭', label: 'Account Setup', to: '/setup' },
  { key: 'assistant-management', icon: '🎛️', label: 'Assistant Management', to: MY_ASSISTANT_PATH },
];
