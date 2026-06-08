/**
 * Bounty drop-in: build a Claude prompt + deep link from your lists, and parse
 * the TOML Claude hands back into the exact payloads `createBounty` already sends.
 *
 * The constraints here mirror `src/lib/bounty-fields.js` (normalizeBountyCreatePayload)
 * so paste-time errors are friendly, while the server stays the final gate. Keys
 * mirror the form's labels (snake_case) but the alias maps also accept the API
 * names, since Claude may emit either.
 */

import { parse as parseToml } from 'smol-toml';

const COORDINATE_RE = /^\d+:[0-9a-f]{64}:.+$/;
const CLAUDE_NEW_URL = 'https://claude.ai/new';

/** Most-recent lists embedded in the prompt; keeps the deep-link URL short. */
const MAX_PROMPT_LISTS = 40;

// Accepted TOML keys per field, in precedence order (first present wins).
const FIELD_ALIASES = {
  listCoordinate: ['list_coordinate', 'listCoordinate', 'coordinate', 'list'],
  amountSats: ['base_reward_sats', 'amount_sats', 'amountSats', 'base_reward', 'reward_sats'],
  bountyCapSats: ['bounty_cap_sats', 'bountyCapSats', 'cap_sats', 'cap'],
  rewardPerItem: ['reward_per_item', 'rewardPerItem', 'reward_each_item'],
  maxRewardsPerNpub: ['max_rewards_per_npub', 'maxRewardsPerNpub', 'max_rewards_per_contributor', 'max_rewards'],
  criteria: ['criteria', 'description'],
  expiration: ['expiration', 'expires', 'expires_at', 'expiry'],
};

function pick(table, field) {
  for (const key of FIELD_ALIASES[field]) {
    if (table[key] !== undefined && table[key] !== null && table[key] !== '') return table[key];
  }
  return undefined;
}

function asInteger(value) {
  if (typeof value === 'bigint') value = Number(value);
  const n = Number(value);
  return Number.isInteger(n) ? n : NaN;
}

function asBoolean(value) {
  if (value === true || value === false) return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return undefined;
}

/** ISO string, unix-seconds number, or a TOML datetime (Date) -> unix seconds. */
function toUnixSeconds(value) {
  if (value instanceof Date) {
    const s = Math.floor(value.getTime() / 1000);
    return Number.isFinite(s) ? s : NaN;
  }
  if (typeof value === 'number' || typeof value === 'bigint') return asInteger(value);
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? NaN : Math.floor(ms / 1000);
  }
  return NaN;
}

/**
 * Validate + normalize one raw TOML table into the createBounty payload shape.
 * Returns { bounty } or { error } (a single human-readable string).
 */
function normalizeOne(table) {
  const listCoordinate = pick(table, 'listCoordinate');
  if (typeof listCoordinate !== 'string' || !COORDINATE_RE.test(listCoordinate)) {
    return { error: 'list_coordinate must look like <kind>:<64-hex-pubkey>:<d-tag>' };
  }

  const amountSats = asInteger(pick(table, 'amountSats'));
  if (!Number.isInteger(amountSats) || amountSats <= 0) {
    return { error: 'base_reward_sats must be a positive integer' };
  }

  const rawCap = pick(table, 'bountyCapSats');
  let bountyCapSats;
  if (rawCap === undefined) {
    bountyCapSats = amountSats;
  } else {
    bountyCapSats = asInteger(rawCap);
    if (!Number.isInteger(bountyCapSats) || bountyCapSats <= 0) {
      return { error: 'bounty_cap_sats must be a positive integer' };
    }
    if (bountyCapSats < amountSats) {
      return { error: 'bounty_cap_sats must be greater than or equal to base_reward_sats' };
    }
  }

  const rawReward = pick(table, 'rewardPerItem');
  const rewardPerItem = rawReward === undefined ? false : asBoolean(rawReward);
  if (rewardPerItem === undefined) {
    return { error: 'reward_per_item must be true or false' };
  }

  const rawMax = pick(table, 'maxRewardsPerNpub');
  let maxRewardsPerNpub;
  if (rawMax !== undefined) {
    if (!rewardPerItem) {
      return { error: 'max_rewards_per_npub only applies when reward_per_item is true' };
    }
    maxRewardsPerNpub = asInteger(rawMax);
    if (!Number.isInteger(maxRewardsPerNpub) || maxRewardsPerNpub <= 0) {
      return { error: 'max_rewards_per_npub must be a positive integer' };
    }
  }

  const criteria = pick(table, 'criteria');
  if (typeof criteria !== 'string' || !criteria.trim()) {
    return { error: 'criteria is required' };
  }

  const rawExpiration = pick(table, 'expiration');
  let expiration;
  if (rawExpiration !== undefined) {
    expiration = toUnixSeconds(rawExpiration);
    if (!Number.isInteger(expiration) || expiration <= 0) {
      return { error: 'expiration must be an ISO-8601 datetime (e.g. 2026-07-01T00:00:00Z)' };
    }
  }

  return {
    bounty: {
      listCoordinate,
      amountSats,
      bountyCapSats,
      rewardPerItem,
      maxRewardsPerNpub,
      criteria: criteria.trim(),
      expiration,
    },
  };
}

/** Pull TOML out of a ```toml fenced block if the paste includes Claude's prose. */
function stripCodeFence(text) {
  const fenced = text.match(/```(?:toml)?\s*\n([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

/**
 * Parse pasted text into normalized bounty payloads.
 * @param {string} text raw paste (may include a ```toml fence and surrounding prose)
 * @returns {{ bounties: object[], errors: string[] }}
 *   `bounties` is non-empty and `errors` empty only when everything validated.
 */
export function parseBountyToml(text) {
  const src = stripCodeFence(text || '');
  if (!src) return { bounties: [], errors: ['Nothing to parse — paste the TOML Claude gave you.'] };

  let data;
  try {
    data = parseToml(src);
  } catch (err) {
    return { bounties: [], errors: [`TOML syntax error: ${err.message}`] };
  }

  // Accept [[bounty]] array, a single [bounty] table, or a bare top-level table.
  let tables;
  if (Array.isArray(data.bounty)) {
    tables = data.bounty;
  } else if (data.bounty && typeof data.bounty === 'object') {
    tables = [data.bounty];
  } else {
    tables = [data];
  }

  if (tables.length === 0) {
    return { bounties: [], errors: ['No [[bounty]] tables found.'] };
  }

  const bounties = [];
  const errors = [];
  const label = tables.length > 1 ? (i) => `Bounty ${i + 1}: ` : () => '';
  tables.forEach((table, i) => {
    const result = normalizeOne(table || {});
    if (result.error) errors.push(`${label(i)}${result.error}`);
    else bounties.push(result.bounty);
  });

  return { bounties, errors };
}

/**
 * Build the prompt Claude opens with: the TOML spec + your lists as a name→coordinate
 * lookup, then an instruction to converse and emit one ```toml block.
 * @param {{ coordinate: string, name: string }[]} lists your addressable (kind 39998) lists
 */
export function buildClaudePrompt(lists = []) {
  const shown = lists.slice(0, MAX_PROMPT_LISTS);
  const truncated = lists.length > shown.length;

  const listLines = shown.length
    ? shown.map((l) => `  - ${JSON.stringify(l.name || '(unnamed)')} -> ${l.coordinate}`).join('\n')
      + (truncated ? `\n  (… ${lists.length - shown.length} more not shown — paste a coordinate directly if you need one of them)` : '')
    : '  (none found — paste a coordinate of the form 39998:<pubkey>:<d-tag>)';

  return [
    'You are helping me configure Nostr "bounties" on Tapestry. A bounty attaches a sats',
    'reward to one of my lists; people I trust (web-of-trust rank >= 2) submit items to earn it.',
    '',
    'Here are my lists. Use the COORDINATE (not the name) in your output:',
    listLines,
    '',
    'Ask me what bounties I want (which list, how many sats, the rules), then output exactly ONE',
    '```toml code block I can paste back. Schema — one [[bounty]] table per bounty:',
    '',
    '```toml',
    '[[bounty]]',
    'list_coordinate     = "39998:<pubkey>:<d-tag>"  # required; one of my coordinates above',
    'base_reward_sats    = 1000                      # required; positive integer, sats per reward',
    'bounty_cap_sats     = 5000                      # total budget before it closes; >= base_reward_sats',
    'reward_per_item     = false                     # false = at most one reward per contributor',
    'max_rewards_per_npub = 3                        # optional; ONLY when reward_per_item = true',
    'criteria            = "What earns the reward."  # required',
    'expiration          = 2026-07-01T00:00:00Z      # optional ISO-8601 datetime, or omit',
    '```',
    '',
    'Rules: every sats value is a positive integer; bounty_cap_sats >= base_reward_sats;',
    'omit fields you do not need (do not invent coordinates — only use mine or ones I paste).',
  ].join('\n');
}

/** Build the claude.ai deep link that opens with `prompt` prefilled. */
export function buildClaudeDeepLink(prompt) {
  return `${CLAUDE_NEW_URL}?q=${encodeURIComponent(prompt)}`;
}
