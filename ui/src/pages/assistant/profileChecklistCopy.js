/**
 * The checklist page's words and rules (assistant-profile-checklist #2, ADR 0002 sub-decisions 2–6; the avatar panel's
 * words from story 3, ADR 0003 sub-decision 9).
 *
 * Pure, no imports, so Node suites can load it (test/assistant-profile-checklist-page.test.js). Named apart from the page
 * (ProfileChecklist.jsx) by more than letter case: the dev container's bind mount is case-insensitive (ADR
 * assistant-identification-tags/0002 Amendment 1). The title, the description, the back link, "Needs attention", the
 * sign-in button and the no-assistant line are the hub's and the action entry's (ui/src/pages/assistant/actions.js).
 *
 * The words were approved with the stories; change them there first:
 * engineering-team/stories/assistant-profile-checklist/2-the-checklist-page-and-its-one-click-fixes.md § Copy and
 * engineering-team/stories/assistant-profile-checklist/3-a-personalized-avatar-for-every-assistant.md § Copy. The three
 * lines no story names are the Identification Tags page's existing words, as ADR 0002 points at: requestFailed,
 * couldNotCheck and profileUnreadable. {domain} and {url} are this instance's, read at runtime from the answer;
 * {address}, {value}, {n} and {m} come from the item's row.
 */

export const PROFILE_CHECKLIST_COPY = {
  summaryDone: "Your Assistant's profile is complete.",
  summaryOne: '1 item needs attention',
  summaryMany: '{n} items need attention',
  noProfileNotice: 'Your Assistant has no profile yet.',
  noProfileFix: 'Publish the default profile',
  signedOut: "Sign in to see your Assistant's profile.",
  noPublicAddress: "This instance has no public web address, so this can't be done here.",
  checking: 'Checking…',
  publishing: 'Publishing…',
  comingSoon: 'Coming soon',
  requestFailed: 'This instance did not answer; nothing was published.',
  couldNotCheck: 'Could not check: this instance did not answer.',
  profileUnreadable: "Could not read this instance's relay.",
  panels: {
    avatar: {
      title: 'A personalized avatar',
      description: 'Your own picture, stamped with the Tapestry mark and hosted by this instance, so every nostr app shows whose Assistant this is.',
      done: "Your Assistant's picture is your personalized avatar, hosted by {domain}.",
      lines: {
        'standard-image': 'Your Assistant is using the standard Tapestry image, not a personalized one.',
        'not-personalized': "Your Assistant's picture is not a personalized avatar from {domain}.",
        'no-picture': 'Your Assistant has no picture.',
        'missing-file': "Your Assistant's picture points at an avatar {domain} no longer has.",
      },
    },
    banner: {
      title: 'A personalized background image',
      description: "A banner for your Assistant's profile, branded to this instance.",
      line: "Not checked yet; it doesn't count toward your profile being complete.",
    },
    nip05: {
      title: 'A working NIP-05',
      description: "A NIP-05 address on this instance's domain lets nostr apps verify your Assistant. {domain} hosts it.",
      done: '{address} is verified: {domain} lists it for your Assistant.',
      lines: {
        none: "Your Assistant's profile has no NIP-05 address.",
        'other-domain': "{address} is not on this instance's domain, {domain}.",
        'not-listed': '{domain} does not list {address} for your Assistant.',
        unreachable: 'Could not check: {domain} did not answer.',
      },
      fix: 'Republish to register my NIP-05',
    },
    website: {
      title: 'Website',
      description: "Your Assistant's website is this instance's address, so people can see where it lives.",
      done: "Your Assistant's website is {url}.",
      lines: {
        none: "Your Assistant's profile has no website.",
        other: "Your Assistant's website is {value}, not {url}.",
      },
      fix: 'Set website to {url}',
    },
    'name-and-about': {
      title: 'Name and About',
      description: 'A name and an About text tell people whose Assistant this is and what it does.',
      done: 'Your Assistant has a name and an About text.',
      lines: {
        'no-name': "Your Assistant's profile has no name.",
        'no-about': "Your Assistant's profile has no About text.",
        'no-name-no-about': "Your Assistant's profile has no name and no About text.",
      },
      fixes: {
        'no-name': 'Fill in the default name',
        'no-about': 'Fill in the default About text',
        'no-name-no-about': 'Fill in the default name and About text',
      },
    },
    'client-tag': {
      title: 'Client tag',
      description: "Your Assistant's profile carries this instance's client tag, so apps can see where it was published from.",
      done: "Your Assistant's profile carries the client tag {domain}.",
      lines: { none: "Your Assistant's profile has no client tag for {domain}." },
      fix: 'Republish from {domain}',
    },
    visible: {
      title: 'Visible to other nostr apps',
      description: "Your Assistant's latest profile is on the relays this instance publishes to, so other nostr apps can find it.",
      done: "Your Assistant's latest profile is on {n} of {m} outside relays.",
      lines: {
        'only-here': "Your Assistant's latest profile is only on this instance's relay.",
        'local-only-mode': "This instance is set to publish locally only, so your Assistant's profile is not sent to outside relays.",
        'no-relays': 'This instance has no outside relays to publish to.',
        unreachable: 'Could not check: no outside relay answered.',
      },
      fix: 'Publish to outside relays',
    },
  },
  // The avatar panel's fix (story 3 § Copy), keyed by stampedAvatar.js's reasons for the three failures.
  avatar: {
    fix: 'Make my personalized avatar',
    accept: 'Publish this avatar',
    discard: 'Not now',
    making: 'Stamping your picture…',
    'no-picture': 'Your nostr profile has no picture to stamp yet. Add one in your nostr app, then come back.',
    unfetchable: "Your nostr profile's picture could not be fetched, so it can't be stamped.",
    'not-stampable': "Your nostr profile's picture isn't an image this instance can stamp.",
  },
};

const C = PROFILE_CHECKLIST_COPY;

/** `template` with each {name} replaced by vars[name] (left as is when the value is missing). */
export function fill(template, vars = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])));
}

function varsOf(row, action) {
  const instance = (action && action.instance) || {};
  const r = row || {};
  return { domain: instance.domain, url: instance.website, address: r.address, value: r.value, n: r.relaysHolding, m: r.relaysTotal };
}

/**
 * One panel's state, from its item, its row in the answer's profile action (or nothing), the provider's phase and the
 * action (ADR 0002 sub-decision 2). The page reading: marked until proven done.
 *   coming-soon      — an item that does not count (the background image), whatever else
 *   unknown          — nothing to show: signed out, or no Assistant here (phase idle)
 *   checking         — the answer is on its way
 *   could-not-check  — the fetch failed, the answer has no profile action, its check failed, no row, or the row's
 *                      check did not finish
 *   done, needs-attention — a finished row
 * @returns {'coming-soon'|'unknown'|'checking'|'could-not-check'|'done'|'needs-attention'}
 */
export function panelState(item, row, phase, action) {
  if (!item || item.counts === false) return 'coming-soon';
  if (phase === 'idle') return 'unknown';
  if (phase === 'checking') return 'checking';
  if (phase !== 'answered' || !action || typeof action !== 'object' || action.reason === 'check-failed') return 'could-not-check';
  if (!row || typeof row !== 'object' || row.finished !== true) return 'could-not-check';
  return row.done === true ? 'done' : 'needs-attention';
}

/** The line under a panel's description, in the approved words (ADR 0002 sub-decision 3); '' when there is none. */
export function panelLine(item, row, phase, action) {
  const words = (item && C.panels[item.key]) || {};
  const state = panelState(item, row, phase, action);
  if (state === 'coming-soon') return words.line || '';
  if (state === 'unknown') return '';
  if (state === 'checking') return C.checking;
  const vars = varsOf(row, action);
  if (state === 'could-not-check') {
    if (row && row.reason === 'profile-unreadable') return C.profileUnreadable;
    if (row && words.lines && words.lines[row.reason]) return fill(words.lines[row.reason], vars);
    return C.couldNotCheck;
  }
  if (state === 'done') return fill(words.done, vars);
  if (row.reason === 'no-public-address') return C.noPublicAddress;
  if (row.reason === 'no-profile') return '';
  const line = words.lines && words.lines[row.reason];
  return line ? fill(line, vars) : '';
}

/**
 * The summary line (story 2 AC-3): complete, or how many counted panels are not done. Checking… while the answer is not
 * in; when the fetch or the check failed, the could-not-check line.
 */
export function summaryText(action, phase) {
  if (phase === 'failed') return C.couldNotCheck;
  if (!action || typeof action !== 'object') return C.checking;
  if (action.done === true) return C.summaryDone;
  if (action.reason === 'check-failed' || !Array.isArray(action.items) || action.items.length === 0) return C.couldNotCheck;
  const n = action.items.filter((r) => r && r.counts !== false && r.done !== true).length;
  return n === 1 ? C.summaryOne : fill(C.summaryMany, { n });
}

/**
 * The fix a panel offers, or null where none fits (ADR 0002 sub-decision 4): only a finished row that needs attention,
 * never for no public address or no profile (the notice offers that), and never for the avatar (its own flow, ADR 0003)
 * or the background image.
 * @returns {{ fix: 'republish'|'set-website'|'fill-name-about', label: string } | null}
 */
export function fixFor(row, instance) {
  if (!row || typeof row !== 'object' || row.finished !== true || row.done === true) return null;
  if (row.reason === 'no-public-address' || row.reason === 'no-profile') return null;
  const vars = { domain: instance && instance.domain, url: instance && instance.website };
  const P = C.panels;
  switch (row.key) {
    case 'nip05': return { fix: 'republish', label: P.nip05.fix };
    case 'website': return { fix: 'set-website', label: fill(P.website.fix, vars) };
    case 'name-and-about': {
      const label = P['name-and-about'].fixes[row.reason];
      return label ? { fix: 'fill-name-about', label } : null;
    }
    case 'client-tag': return { fix: 'republish', label: fill(P['client-tag'].fix, vars) };
    case 'visible': return row.reason === 'only-here' ? { fix: 'republish', label: P.visible.fix } : null;
    default: return null;
  }
}

const NAME_AND_ABOUT = ['name', 'display_name', 'about'];

/**
 * The content one fix publishes (ADR 0002 sub-decision 5): exactly the kind-0 `fields`, each as published now except
 * what the fix is about. The base is the published profile, or the default when there is none.
 * @param {'republish'|'set-website'|'fill-name-about'|'publish-default'|'set-picture'} fix
 * @param {{ status: Object, instance: Object, fields: string[], url?: string }} input  `status` is /api/assistant/status's
 *   answer; `fields` the shared PROFILE_CONTENT_FIELDS; `url` the stored avatar's, for set-picture
 * @returns {Object<string, string>}
 */
export function applyProfileFix(fix, { status, instance, fields, url } = {}) {
  if (!Array.isArray(fields) || fields.length === 0) throw new Error('applyProfileFix needs the kind-0 content fields');
  const pick = (source) => fields.reduce((out, k) => {
    out[k] = source && typeof source[k] === 'string' ? source[k] : '';
    return out;
  }, {});
  const defaults = pick(status && status.defaults);
  const base = status && status.hasProfile ? pick(status.profile) : defaults;
  switch (fix) {
    case 'republish':
      return base;
    case 'set-website':
      return { ...base, website: instance && instance.website ? instance.website : base.website };
    case 'fill-name-about': {
      const out = { ...base };
      for (const k of NAME_AND_ABOUT) if (fields.includes(k) && !out[k].trim()) out[k] = defaults[k];
      return out;
    }
    case 'publish-default':
      return defaults;
    case 'set-picture':
      return { ...base, picture: typeof url === 'string' && url ? url : base.picture };
    default:
      throw new Error(`unknown fix: ${fix}`);
  }
}

/**
 * The one writer's answer (POST /api/assistant/publish-profile) as the page reports it, in the editor's terms
 * (ADR 0002 sub-decision 6): { ok, outcome, message, rows }. No readable answer is the request-failed line.
 */
export function describeProfilePublish(data) {
  if (!data || typeof data !== 'object') return { ok: false, outcome: 'not-delivered', message: C.requestFailed, rows: [] };
  if (data.success !== true) return { ok: false, outcome: 'not-delivered', message: data.error || C.requestFailed, rows: [] };
  const results = data.relays && Array.isArray(data.relays.results) ? data.relays.results : [];
  return {
    ok: true,
    outcome: data.outcome || 'not-delivered',
    message: data.message || '',
    rows: results.map((r) => ({ relay: r.relay, status: r.status, reason: r.reason || '' })),
  };
}
