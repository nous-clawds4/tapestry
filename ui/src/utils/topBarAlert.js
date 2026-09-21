/**
 * Which one pill the top bar shows (assistant-management #2, ADR 0002 sub-decision 1).
 *
 * Every top bar has one alert slot, beside its avatar menu (components/TopBarAlert.jsx). It shows at most one
 * pill, and setup comes first — the owner's rule (book assistant-management § Decisions 2):
 *   - no one signed in → no pill;
 *   - the setup status still being checked ('idle' or 'checking') → no pill yet: the Assistant pill waits, so
 *     it never shows only to be replaced;
 *   - the setup answer counts a step (the Setup Alert's count, useSetupStatus().pendingCount) → the Setup
 *     Alert's turn ('setup');
 *   - otherwise — nothing counted, or the setup check failed, so the Setup Alert shows nothing either — the
 *     Assistant pill, when an action needs attention and the page is not /assistant or under it.
 *
 * Pure, with one import (and its `.js`), so Node suites can load it (test/assistant-alert.test.js).
 */

import { ASSISTANT_MANAGEMENT_PATH } from '../config/avatarMenuLinks.js';

/** Is this /assistant, or a page under it? (Not /assistants or /assistant-x.) */
export function isAssistantPath(pathname) {
  return pathname === ASSISTANT_MANAGEMENT_PATH || String(pathname || '').startsWith(`${ASSISTANT_MANAGEMENT_PATH}/`);
}

/**
 * @param {{ signedIn: boolean, setupPhase: string, setupPendingCount: number, assistantCount: number,
 *           pathname: string }} state
 * @returns {{ pill: null | 'setup' | 'assistant', count: number }}
 */
export function pickTopBarPill({ signedIn, setupPhase, setupPendingCount, assistantCount, pathname }) {
  const none = { pill: null, count: 0 };
  if (!signedIn) return none;
  if (setupPhase !== 'answered' && setupPhase !== 'failed') return none;
  if (setupPhase === 'answered' && setupPendingCount > 0) return { pill: 'setup', count: setupPendingCount };
  if (assistantCount > 0 && !isAssistantPath(pathname)) return { pill: 'assistant', count: assistantCount };
  return none;
}
