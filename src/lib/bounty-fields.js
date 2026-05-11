const COORDINATE_RE = /^(\d+):([0-9a-f]{64}):(.+)$/;

class BountyValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BountyValidationError';
    this.statusCode = 400;
  }
}

function readField(body, camelName, snakeName = camelName) {
  return body[camelName] ?? body[snakeName];
}

function requiredPositiveInteger(value, fieldName) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new BountyValidationError(`${fieldName} must be a positive integer`);
  }
  return n;
}

function optionalPositiveInteger(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  return requiredPositiveInteger(value, fieldName);
}

function optionalUnixTimestamp(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new BountyValidationError('expiration must be a unix timestamp');
  }
  return n;
}

function optionalBoolean(value, fieldName, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (value === true || value === false) return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  throw new BountyValidationError(`${fieldName} must be a boolean`);
}

function normalizeBountyCreatePayload(body = {}) {
  const listCoordinate = readField(body, 'listCoordinate', 'list_coordinate');
  if (!listCoordinate || !COORDINATE_RE.test(listCoordinate)) {
    throw new BountyValidationError('listCoordinate must be <kind>:<pubkey>:<dtag>');
  }

  const amountSats = requiredPositiveInteger(
    readField(body, 'amountSats', 'amount_sats'),
    'amountSats'
  );
  const bountyCapSats = requiredPositiveInteger(
    readField(body, 'bountyCapSats', 'bounty_cap_sats'),
    'bountyCapSats'
  );
  if (bountyCapSats < amountSats) {
    throw new BountyValidationError('bountyCapSats must be greater than or equal to amountSats');
  }

  const rewardPerItem = optionalBoolean(
    readField(body, 'rewardPerItem', 'reward_per_item'),
    'rewardPerItem',
    false
  );
  const rawMaxRewards = readField(body, 'maxRewardsPerNpub', 'max_rewards_per_npub');
  const maxRewardsPerNpub = optionalPositiveInteger(rawMaxRewards, 'maxRewardsPerNpub');
  if (!rewardPerItem && maxRewardsPerNpub !== null) {
    throw new BountyValidationError('maxRewardsPerNpub only applies when rewardPerItem is true');
  }

  const criteria = body.criteria;
  if (typeof criteria !== 'string' || !criteria.trim()) {
    throw new BountyValidationError('criteria is required');
  }

  return {
    listCoordinate,
    amountSats,
    bountyCapSats,
    rewardPerItem,
    maxRewardsPerNpub,
    criteria: criteria.trim(),
    expiration: optionalUnixTimestamp(body.expiration),
  };
}

module.exports = {
  BountyValidationError,
  normalizeBountyCreatePayload,
};
