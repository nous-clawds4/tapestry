'use strict';
/**
 * The approved words, constants and answer shapes of assistant-self-map #1, the hub's Your Assistant's Treasure Map
 * page and its check, as its story and ADR state them. One copy, shared by the Node suites
 * (test/assistant-self-map-check.test.js, test/assistant-self-map-page.test.js), the browser suite
 * (tests/brainstorm/assistant-self-map.spec.js), and the hub fixtures and specs this story re-aims, so they cannot
 * disagree about what the owner approved.
 *
 * Source of truth: engineering-team/stories/assistant-self-map/1-the-self-map-page-and-its-check.md (approved
 * 2026-10-12; § Copy and § Deviations as amended at Architecture) and
 * engineering-team/decisions/assistant-self-map/0001-a-self-map-check-from-what-has-landed.md (accepted 2026-10-12,
 * open questions 1–4 answered as recommended), following protocols/drafts/treasure-maps.md §§ 5, 6, 8, 9 and 9.2.
 * Change a word there first, then here.
 *
 * Standalone on purpose (it requires no other fixture), so the hub fixtures can read the card's new criteria line from
 * here without a require cycle.
 */

// ─── The wire facts ──────────────────────────────────────────────────────────────────────────────────────────────────
const SELF_MAP_KIND = 10040;
const TREASURE_MAP_KIND = 10040;
const RELAY_LIST_KIND = 10002;
const SCORE_KIND = 30382;
const LIST_KINDS = [30392, 30393, 30394];
const CONCEPT_KINDS = [39998, 39999];
/** § 9.2's filter for one key's self-Map. */
const selfMapFilter = (author) => ({ kinds: [SELF_MAP_KIND], authors: [author] });

/**
 * The metric tags both Score publishers write (src/algos/nip85/publish_kind30382.js and its customers' twin), which
 * ADR 0001 sub-decision 3 reads as the observer's supported Scores (owner's answer to open question 1). Written from the
 * publishers' event shape, not from the library under test.
 */
const PUBLISHED_SCORE_METRICS = [
  'rank', 'followers', 'hops',
  'personalizedGrapeRank_influence', 'personalizedGrapeRank_average', 'personalizedGrapeRank_confidence',
  'personalizedGrapeRank_input', 'personalizedPageRank',
  'verifiedFollowerCount', 'verifiedMuterCount', 'verifiedReporterCount',
];
/** The near-miss 47 Maps on staging's relay name, which no publisher here writes (ADR 0001 § Context). */
const UNPUBLISHED_METRIC = 'verifiedFollowersCount';

// ─── The schedule (ADR 0001 sub-decision 6) ──────────────────────────────────────────────────────────────────────────
const HOUR_MS = 60 * 60 * 1000;
/** The tasks whose runs re-sign the Owner's Scores, and a customer's (with args.customer = the customer's main key). */
const OWNER_SCORE_TASKS = ['processAllTasks', 'updateAllScoresForOwner', 'exportOwnerKind30382'];
const ALL_CUSTOMER_SCORE_TASKS = ['processAllTasks', 'processAllActiveCustomers'];
const ONE_CUSTOMER_SCORE_TASKS = ['processCustomer', 'updateAllScoresForSingleCustomer', 'exportCustomerKind30382'];
const SYSTEMD_TIMER = '/etc/systemd/system/processAllTasks.timer';
/** One schedule entry in the shape of /var/lib/brainstorm/scheduled-tasks.json (src/api/scheduled-tasks/index.js). */
function scheduleEntry(taskId, { hours = 0, days = 0, minutes = 0, cron = '', enabled = true, args = {}, id } = {}) {
  return {
    id: id || `fixture:${taskId}:${Object.keys(args).length ? JSON.stringify(args) : 'all'}`,
    taskId, label: taskId, args, enabled,
    intervalDays: days, intervalHours: hours, intervalMinutes: minutes, cron,
  };
}

// ─── The action (story AC-5, ADR 0001 sub-decisions 7 and 9) ────────────────────────────────────────────────────────
const KEY = 'treasure-map';
const PATH = '/assistant/treasure-map';
const TITLE = "Your Assistant's Treasure Map";
const ALERT_CRITERIA = "If your Assistant's self-Map is missing, or says anything other than the duties that are live now.";
const PLANNING_NOTES = null;
/** The action it follows in CHECKED_ACTIONS (ASSISTANT_ACTIONS order; ADR 0001 sub-decision 9). */
const CHECKED_AFTER = 'duty-menu';
/** The answer's fields (ADR 0001 sub-decision 7), exactly. */
const ANSWER_FIELDS = ['current', 'done', 'duties', 'finished', 'instanceMap', 'mapFound', 'pending', 'published', 'reason', 'shouldSay'];
const LINE_FIELDS = ['category', 'falseClaim', 'key', 'lastLandedAt', 'reason', 'relay', 'status'];
const STATUSES = ['active', 'offered', 'not-offered', 'elsewhere'];
/** sub-decision 3's reasons, plus `live-unclaimed` (sub-decision 7). */
const REASONS = ['live-unclaimed', 'not-published-here', 'older-form', 'nothing-to-publish', 'not-landed', 'not-scheduled', 'upkeep-stopped', 'unchecked'];
const CHECK_REASONS = ['no-relay-answered', 'instance-unanswered', 'check-failed'];

// ─── The count line (story AC-5, owner's answer to open question 2) ─────────────────────────────────────────────────
const COUNT_ZERO = 'Nothing needs attention';

// ─── The page's words (story § Copy, with the three reasons added at Architecture) ───────────────────────────────────
const CATEGORY_NAMES = { scores: 'Scores', lists: 'Lists', concepts: 'Concepts' };
const PAGE = {
  signedOutLine: "Sign in to see your Assistant's Treasure Map.",
  dutiesHeading: "Your Assistant's duties",
  dutiesExplainer: 'The duties your Treasure Map gives your Assistant, and which of them are live now.',
  statusWords: { active: 'Active', offered: 'Offered but not active', 'not-offered': 'Not offered' },
  reasons: {
    'live-unclaimed': "Live, but your Assistant's self-Map doesn't say so yet.",
    'not-published-here': "This instance doesn't publish these for your Assistant yet.",
    'nothing-to-publish': 'Nothing to publish yet.',
    'not-landed': 'Not published yet.',
    'upkeep-stopped': 'Not kept up to date: last landed <date>.',
    'older-form': "This instance publishes these in an older form that Treasure Map readers can't find yet.",
    'not-scheduled': 'Not kept up to date: no upkeep is scheduled on this instance.',
    unchecked: "This instance can't check this key yet, so it isn't claimed.",
  },
  /** The upkeep-stopped line without its date, for "is it there" checks. */
  upkeepStoppedLead: 'Not kept up to date: last landed',
  elsewhere: 'Your Treasure Map gives this to another Assistant.',
  falseClaim: "Your Assistant's self-Map claims this, but it isn't live.",
  noDuties: 'Your Treasure Map gives your Assistant no duties.',
  yourTreasureMap: 'your Treasure Map',
  shouldHeading: "What your Assistant's self-Map should say",
  shouldExplainer: 'Only the duties that are live now, each at the relay where it is published.',
  shouldEmpty: 'Nothing to claim yet.',
  publishedHeading: "Your Assistant's published self-Map",
  checking: 'Checking…',
  none: 'No self-Map was found for your Assistant.',
  couldNotCheck: {
    'no-relay-answered': "No relay answered, so your Assistant's self-Map could not be checked.",
    'request-failed': 'Could not check: this instance did not answer.',
  },
  status: {
    upToDate: "Your Assistant's self-Map is up to date.",
    notPublished: 'Your Assistant has not published a self-Map yet.',
    outOfDate: "Your Assistant's self-Map is out of date: it differs from the duties that are live now.",
  },
  links: {
    dutyMenuLead: 'What your Assistant offers:',
    dutyMenu: 'Duty Menu',
    treasureMapLead: 'The duties you give your Assistants:',
    treasureMap: 'your Treasure Map',
  },
  ownerLine: (n) => `Your Assistant's Treasure Map is also this instance's own Treasure Map. Its ${n} other entries are this instance's choices, not part of the self-Map, and this page never changes them.`,
  ownerLineLead: "Your Assistant's Treasure Map is also this instance's own Treasure Map.",
  publicLine: "Your Assistant's self-Map is public. Anyone can read which duties it reports as live.",
};
/** Every fixed sentence § Copy gives this page (not the hub's shared words), for "is it there" and "is it retyped" checks. */
const PAGE_SENTENCES = [
  PAGE.signedOutLine, PAGE.dutiesHeading, PAGE.dutiesExplainer,
  ...Object.values(PAGE.statusWords),
  ...Object.entries(PAGE.reasons).filter(([k]) => k !== 'upkeep-stopped').map(([, v]) => v),
  PAGE.upkeepStoppedLead, PAGE.elsewhere, PAGE.falseClaim, PAGE.noDuties,
  PAGE.shouldHeading, PAGE.shouldExplainer, PAGE.shouldEmpty, PAGE.publishedHeading, PAGE.none,
  PAGE.couldNotCheck['no-relay-answered'], PAGE.couldNotCheck['request-failed'],
  PAGE.status.upToDate, PAGE.status.notPublished, PAGE.status.outOfDate,
  PAGE.links.dutyMenuLead, PAGE.links.treasureMapLead, PAGE.ownerLineLead, PAGE.publicLine,
];

// ─── Staging's Owner Map, verbatim in shape (book § Facts found at intake; fixture keys stand in for live ones) ────
/** Fixture keys: the instance TA, the Owner, the other Assistant the Owner's Map names (600f4551… on staging). */
const TA = 'a1'.repeat(32);
const OWNER = '0b'.repeat(32);
const OTHER_ASSISTANT = 'f6'.repeat(32);
/** This instance's relay as Docker configures it, and its public address (duty-menu-public-relay #1). */
const DOCKER_RELAY_URL = 'ws://localhost:7777';
const DOMAIN = 'staging.brainstorm.world';
const OWN = 'wss://staging.brainstorm.world/relay';
const DOCKER_CONFIG = {
  BRAINSTORM_RELAY_URL: DOCKER_RELAY_URL,
  STRFRY_DOMAIN: DOMAIN,
  BRAINSTORM_OWNER_PUBKEY: OWNER,
  BRAINSTORM_PUBLISH_LOCAL_ONLY: 'false',
  TASK_QUEUE_ENABLED: 'true',
  BRAINSTORM_PROCESS_ALL_TASKS_INTERVAL: '12hours',
};
/** The Owner's Map on staging's relay, 2026-10-12, in Map order; `ta` and `other` are the two Assistants it names. */
function stagingOwnerMapTags(ta = TA, other = OTHER_ASSISTANT) {
  return [
    ['30392', other, 'wss://scores.brainstorm.world'],
    ['30393', other, 'wss://scores.brainstorm.world'],
    ['30394', other, 'wss://scores.brainstorm.world'],
    ['39998', ta, 'wss://dcosl.brainstorm.world'],
    ['3038x', ta, 'wss://nip85.brainstorm.world'],
    ['39999', ta, 'wss://dcosl.brainstorm.world'],
    ['30382:rank', other, 'wss://scores.brainstorm.world'],
    ['30382:followers', other, 'wss://scores.brainstorm.world'],
    ['client', 'Brainstorm'],
  ];
}

// ─── Canned answers of GET /api/assistant/attention for this action (ADR 0001 sub-decision 7) ───────────────────────
const line = (over) => ({ key: null, category: null, relay: null, status: 'offered', reason: null, lastLandedAt: null, falseClaim: false, ...over });
/** The staging Owner's duties with Scores and Concepts live, as the self-Map should say them (ADR sub-decision 2). */
function stagingDuties({ scores = 'active', concepts = 'active', scoresReason = null, conceptsReason = null, lastLandedAt = null } = {}) {
  const status = (s) => (s === 'active' ? 'active' : 'offered');
  return [
    { key: '39998', lines: [line({ key: '39998', category: 'concepts', relay: OWN, status: status(concepts), reason: conceptsReason })] },
    {
      key: '3038x',
      lines: [
        line({ key: '30382', category: 'scores', relay: OWN, status: status(scores), reason: scoresReason, lastLandedAt }),
        line({ key: '3038x', category: 'scores', relay: null, status: 'not-offered' }),
        line({ key: '30382:rank', category: 'scores', relay: null, status: 'elsewhere' }),
        line({ key: '30382:followers', category: 'scores', relay: null, status: 'elsewhere' }),
      ],
    },
    { key: '39999', lines: [line({ key: '39999', category: 'concepts', relay: OWN, status: 'offered', reason: 'not-published-here' })] },
  ];
}
const SHOULD_LIVE = [{ key: '30382', relay: OWN }, { key: '39998', relay: OWN }];
const published = (selfEntries, over = {}) => ({ selfEntries, otherEntries: 4, createdAt: 1_760_000_000, source: 'local', eventId: 'd'.repeat(64), ...over });

/** The treasure-map action, with every field the answer carries; `over` adjusts it. */
function action(over = {}) {
  return {
    finished: true, done: true, pending: false, reason: null,
    mapFound: true,
    duties: stagingDuties(),
    shouldSay: SHOULD_LIVE.slice(),
    published: published(SHOULD_LIVE.slice().reverse()),
    current: true,
    instanceMap: true,
    ...over,
  };
}
const ANSWERS = {
  /** Up to date: Scores and Concepts live and claimed; the Owner's TA (instanceMap). */
  DONE: action(),
  /** Not published yet: everything live, nothing claimed. */
  NOT_PUBLISHED: action({
    done: false, pending: true, current: false, published: null,
    duties: stagingDuties({ scores: 'offered', concepts: 'offered', scoresReason: 'live-unclaimed', conceptsReason: 'live-unclaimed' }),
  }),
  /** Staging today: no Score schedule; Concepts claimed and live, plus a stale 30382 self-entry: out of date. */
  STALE: action({
    done: false, pending: true, current: false,
    duties: (() => {
      const d = stagingDuties({ scores: 'offered', scoresReason: 'not-scheduled', lastLandedAt: 1_780_870_800 });
      d[1].lines[0].falseClaim = true;
      return d;
    })(),
    shouldSay: [{ key: '39998', relay: OWN }],
    published: published([{ key: '30382', relay: OWN }, { key: '39998', relay: OWN }]),
  }),
  /** A customer whose Map gives their Assistant Lists only: not published here, nothing to claim, nothing claimed. */
  CUSTOMER_NOTHING: action({
    instanceMap: false,
    duties: [{ key: '30392', lines: [line({ key: '30392', category: 'lists', relay: OWN, status: 'offered', reason: 'not-published-here' })] }],
    shouldSay: [],
    published: null,
  }),
  /** No duties at all: done, with nothing to claim. */
  NO_DUTIES: action({ mapFound: true, duties: [], shouldSay: [], published: null, instanceMap: false }),
  UNFINISHED: action({ finished: false, done: false, pending: false, reason: 'no-relay-answered', published: null, current: null }),
  CHECK_FAILED: { finished: false, done: false, pending: false, reason: 'check-failed', mapFound: false, duties: [], shouldSay: [], published: null, current: null, instanceMap: false },
};

/**
 * An attention answer with a treasure-map action added, unless it already has one (the withDutyMenu pattern). The
 * default, a finished check that found the self-Map not published, is pending: it marks AND counts the card, as the
 * placeholder did, so a suite that pins counts about another action keeps them.
 */
function withSelfMap(answer, selfMap = ANSWERS.NOT_PUBLISHED) {
  if (!answer || typeof answer !== 'object' || !answer.actions || typeof answer.actions !== 'object') return answer;
  if (Object.prototype.hasOwnProperty.call(answer.actions, KEY)) return answer;
  return { ...answer, actions: { ...answer.actions, [KEY]: selfMap } };
}

module.exports = {
  SELF_MAP_KIND, TREASURE_MAP_KIND, RELAY_LIST_KIND, SCORE_KIND, LIST_KINDS, CONCEPT_KINDS, selfMapFilter,
  PUBLISHED_SCORE_METRICS, UNPUBLISHED_METRIC,
  HOUR_MS, OWNER_SCORE_TASKS, ALL_CUSTOMER_SCORE_TASKS, ONE_CUSTOMER_SCORE_TASKS, SYSTEMD_TIMER, scheduleEntry,
  KEY, PATH, TITLE, ALERT_CRITERIA, PLANNING_NOTES, CHECKED_AFTER, ANSWER_FIELDS, LINE_FIELDS, STATUSES, REASONS, CHECK_REASONS,
  COUNT_ZERO,
  CATEGORY_NAMES, PAGE, PAGE_SENTENCES,
  TA, OWNER, OTHER_ASSISTANT, DOCKER_RELAY_URL, DOMAIN, OWN, DOCKER_CONFIG, stagingOwnerMapTags,
  line, stagingDuties, SHOULD_LIVE, published, action, ANSWERS, withSelfMap,
};
