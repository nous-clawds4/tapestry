/**
 * Simple Lists' scoring rule, shared (curated-dlist-update ADR 0004 §1).
 *
 * Moved verbatim from Simple Lists' items page, `ui/src/pages/lists/DListItems.jsx` — its first consumer:
 * the vote classifier (`isUpvote` / `isDownvote`), the reactions-per-item map, the trust-weighted score
 * with its breakdown (the `trustScores` memo's body), and the Generate Trusted List panel's qualifying
 * test. The curation page's util (`treasureMap.js`) calls the same functions, so a candidate is decided
 * exactly as Simple Lists decides it.
 *
 * Zero-import, so Node suites load it directly. Pure, and nothing here throws — it runs during render.
 * The guards that promise needs change no well-formed input's result, with one intended exception: a
 * reaction whose first `e` tag names an inherited property (`constructor`, `__proto__`) used to crash
 * Simple Lists' page; it is now ignored (the story's Open questions, 5).
 */

function isUpvote(content) {
  const c = (typeof content === 'string' ? content : '').trim();
  return c === '+' || c === '👍' || c === '🤙';
}

function isDownvote(content) {
  const c = (typeof content === 'string' ? content : '').trim();
  return c === '-' || c === '👎';
}

/** A kind-7 reaction's vote, by its trimmed content: "+", 👍 and 🤙 up; "-" and 👎 down; anything else "other". */
export function classifyReaction(content) {
  let type = 'other';
  if (isUpvote(content)) type = 'upvote';
  else if (isDownvote(content)) type = 'downvote';
  return type;
}

/**
 * The reactions credited to each item: `{ [itemId]: [{ pubkey, type, id, content }] }`, one key per given
 * id. A reaction counts for its FIRST `e` tag only, and only when that names one of the given ids; order is
 * kept. De-duplicating the reactions is the caller's (Simple Lists: by event id).
 */
export function reactionsByItem(reactionEvents, itemIds) {
  const map = {};
  for (const id of Array.isArray(itemIds) ? itemIds : []) map[id] = [];
  for (const ev of Array.isArray(reactionEvents) ? reactionEvents : []) {
    const eTag = Array.isArray(ev?.tags) ? ev.tags.find(t => Array.isArray(t) && t[0] === 'e') : undefined;
    const targetId = eTag?.[1];
    // Own keys only: an `e` naming an inherited property is none of the given ids.
    if (targetId && Object.prototype.hasOwnProperty.call(map, targetId)) {
      map[targetId].push({ pubkey: ev.pubkey, type: classifyReaction(ev.content), id: ev.id, content: ev.content });
    }
  }
  return map;
}

/**
 * One item's trust-weighted score and its breakdown — `scoreItem(authorPubkey, itemReactions, weights)`, the
 * reactions as `reactionsByItem` credits them. The author's implicit upvote counts at the author's weight,
 * cancelled to 0 (never below) when the author's first reaction is a downvote; every other reactor adds
 * their weight up and subtracts it down, and an "other" reaction adds 0. A null or missing weight counts
 * for nothing, and its entry says so.
 *
 * @returns {{ score: number, breakdown: Array<{ pubkey, role, type, weight, contribution, note }> }}
 */
export function scoreItem(authorPubkey, reactions, weights) {
  const itemAuthor = authorPubkey;
  const itemReactions = Array.isArray(reactions) ? reactions.filter(r => r && typeof r === 'object') : [];
  const trustWeights = weights && typeof weights === 'object' ? weights : {};
  const authorTW = trustWeights[itemAuthor];

  // Check if the item author has any kind 7 reaction on this item
  const authorReaction = itemReactions.find(r => r.pubkey === itemAuthor);
  const authorSelfDownvoted = authorReaction?.type === 'downvote';
  const authorHasExplicitUpvote = authorReaction?.type === 'upvote';

  // Build the breakdown
  const breakdown = [];
  let score = 0;

  // 1. Implicit author upvote
  if (authorTW != null) {
    if (authorSelfDownvoted) {
      // Author downvoted their own item → cancels implicit upvote → net 0
      breakdown.push({
        pubkey: itemAuthor,
        role: 'author',
        type: 'implicit-upvote-cancelled',
        weight: authorTW,
        contribution: 0,
        note: 'Implicit upvote cancelled by author\'s kind 7 downvote',
      });
    } else {
      // Normal implicit upvote
      breakdown.push({
        pubkey: itemAuthor,
        role: 'author',
        type: 'implicit-upvote',
        weight: authorTW,
        contribution: authorTW,
        note: authorHasExplicitUpvote
          ? 'Implicit upvote (explicit kind 7 + ignored as duplicate)'
          : 'Implicit upvote (authored the item)',
      });
      score += authorTW;
    }
  } else {
    breakdown.push({
      pubkey: itemAuthor,
      role: 'author',
      type: 'implicit-upvote',
      weight: null,
      contribution: null,
      note: 'Trust weight unknown',
    });
  }

  // 2. Process each reaction from OTHER authors
  for (const r of itemReactions) {
    if (r.pubkey === itemAuthor) {
      // Already handled above — skip explicit reactions from item author
      if (authorSelfDownvoted) {
        breakdown.push({
          pubkey: r.pubkey,
          role: 'author',
          type: 'explicit-downvote',
          weight: authorTW,
          contribution: 0,
          note: 'Author\'s explicit downvote (cancels implicit upvote)',
        });
      }
      // If author has explicit upvote, it was already noted above
      continue;
    }

    const tw = trustWeights[r.pubkey];
    if (tw != null) {
      const contrib = r.type === 'upvote' ? tw : r.type === 'downvote' ? -tw : 0;
      score += contrib;
      breakdown.push({
        pubkey: r.pubkey,
        role: 'reactor',
        type: r.type,
        weight: tw,
        contribution: contrib,
        note: null,
      });
    } else {
      breakdown.push({
        pubkey: r.pubkey,
        role: 'reactor',
        type: r.type,
        weight: null,
        contribution: null,
        note: 'Trust weight unknown',
      });
    }
  }

  return { score, breakdown };
}

/** Whether a score reaches the cutoff (inclusive) — the Generate Trusted List panel's filter. A null score never does. */
export function qualifies(score, cutoff) {
  return score != null && score >= cutoff;
}
