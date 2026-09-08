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
 * The one deliberate difference is where the two profile links point: the Main
 * menu sends you to `/user/<pubkey>` (the same profile page search results link
 * to), the Tapestry menu to `/tapestry/users/<pubkey>`. That's the caller's
 * `profileBase`.
 *
 * Every link here is available to every signed-in user. The single exception is
 * the assistant profile, which has no target when the caller has no provisioned
 * assistant key — it stays visible and disabled rather than disappearing, so
 * the menu reads the same for everyone.
 */

export const NO_ASSISTANT_REASON =
  'No assistant is provisioned for your account yet.';

/**
 * Personal destinations — "my things".
 * @param {{ pubkey: string, assistantPubkey: ?string, profileBase: string }} opts
 *   `profileBase` is '/user' (Main menu) or '/tapestry/users' (Tapestry menu).
 * @returns {Array<{ key, icon, label, to: ?string, disabledReason?: string }>}
 */
export function personalLinks({ pubkey, assistantPubkey, profileBase }) {
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
      to: assistantPubkey ? `${profileBase}/${assistantPubkey}` : null,
      disabledReason: NO_ASSISTANT_REASON,
    },
    {
      key: 'my-treasure-map',
      icon: '🗺️',
      label: 'My Treasure Map',
      // Already per-viewer: the page filters kind 10040 on the signed-in pubkey.
      to: '/tapestry/grapevine/trusted-assertions',
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
