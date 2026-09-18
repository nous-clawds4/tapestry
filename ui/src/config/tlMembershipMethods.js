// TL membership-method ladder (ADR trusted-lists/0001). Mirrors the server
// constant in src/api/trustedList/membershipMethods.js — keep in sync.
//
// search-index-selection ADR 0002 §3: the ONE hand-kept client mirror, shared by
// the instance-wide dial (pages/grapevine/TrustDetermination.jsx) and the per-pin
// selector (components/CurationMethodDialog.jsx).
export const TL_MEMBERSHIP_METHODS = [
  { id: 'count', label: 'Count — verified taggers (current)', available: true,
    blurb: 'A member joins when enough gate-passing taggers applied the tag and applies outnumber disputes. Every tagger counts as 1.' },
  { id: 'input', label: 'Weighted sum — trust-weighted applies − disputes', available: true,
    blurb: 'One score per member: each tagger counts by their trust weight (WoT rank ÷ 100), applies add, disputes subtract. An equal-weight split nets to 0; dispute-heavy goes negative. Membership and order still follow Count at this rung.' },
  { id: 'certainty', label: 'Certainty — saturating input × agreement (0–100)', available: true,
    blurb: 'The full formula, 0–100. Agreement = the trust-weighted balance of votes: applies (+1) vs disputes (−1), so all-applies → 1, an even split → 0, dispute-heavy → negative. Certainty = how much total trust weighed in, saturating toward 1. Score = agreement × certainty × 100: one rank-100 apply → 50; an equal-weight split → 0.' },
];

export default TL_MEMBERSHIP_METHODS;
