/**
 * Read-side classifier for the event-tagging core (the complement to the
 * discovery-filter builders). Pure and dependency-free: given already-fetched
 * candidate assertions + resolved tagging headers + the authority set the reader
 * honors + a trust predicate, it groups the taggings that COUNT and surfaces the
 * ones it cannot verify. No I/O — the caller does the scanning/trust scoring.
 *
 * Sovereignty: `honoredAuthorities` is the reader's parameter. A candidate is
 * counted only if its descriptor header joins a `tagging-with-specific-tag`
 * namespace the reader honors; the candidate scan that produced `candidates`
 * keys on the target and is namespace-agnostic, so a divergent publisher's
 * taggings are always *present* — only whether they *count* depends on the set.
 */

const DESCRIPTOR_RE = /^39999:[0-9a-f]{64}:tagging:.+-tagging$/;
const HONORED_Z_RE = /^39998:([0-9a-f]{64}):tagging-with-specific-tag$/;
const TAG_A_RE = /^39999:([0-9a-f]{64}):(.+)$/;

function tagVal(event, name) {
  const t = (event.tags || []).find((x) => x[0] === name);
  return t ? t[1] : null;
}

// polarity: from the ['polarity', ...] tag; absent defaults to 1 (applied).
function readPolarity(event) {
  const t = (event.tags || []).find((x) => x[0] === 'polarity');
  if (!t || t[1] == null) return 1;
  const n = Number(t[1]);
  return Number.isFinite(n) ? n : 1;
}

// >= 0.5 → apply, <= -0.5 → dispute, between → neutral (dropped).
function bucketize(polarity) {
  if (polarity >= 0.5) return 'apply';
  if (polarity <= -0.5) return 'dispute';
  return 'neutral';
}

/**
 * @param {object} args
 * @param {object[]} args.candidates         kind-39999 events that #e/#a the target (deduped scan).
 * @param {object[]} args.headers            resolved per-tag tagging header events (whatever the caller fetched).
 * @param {string[]} args.honoredAuthorities TA pubkeys whose tagging-with-specific-tag namespace is honored.
 * @param {(pubkey:string)=>boolean} args.isAsserterTrusted  POV trust predicate (default: trust all).
 * @param {string} [args.viewerPubkey]  the logged-in viewer. When set, their OWN
 *   legitimate stance is surfaced in `mine` regardless of trust (the counted `tags`
 *   are unaffected) — see ADR event-tagging/0007. Absent → `mine: []`.
 * @returns {{ tags: Array<{tag:{authorPubkey:string,slug:string}, applications:object[], disputes:object[]}>,
 *             unverifiable: Array<{eventId,authorPubkey,descriptor,createdAt}>,
 *             mine: Array<{tag:{authorPubkey:string,slug:string}, stance:'apply'|'dispute', eventId:string, createdAt:number}> }}
 *
 * NOTE on latest-wins: `mine` reflects the single (deduped) latest candidate per
 * (tag, target, viewer). The apply↔dispute collapse is done UPSTREAM by the caller's
 * dedupe (an assertion's d-tag is deterministic per (slug, target, asserter)); this
 * function reflects whichever single candidate survives.
 */
function classifyEventTaggings({ candidates = [], headers = [], honoredAuthorities = [], isAsserterTrusted, viewerPubkey } = {}) {
  const trusted = typeof isAsserterTrusted === 'function' ? isAsserterTrusted : () => true;
  const honored = new Set(honoredAuthorities);

  // Index headers by their addressable coordinate: 39999:<pubkey>:<d-tag>.
  const headerByCoord = new Map();
  for (const h of headers) {
    const d = tagVal(h, 'd');
    if (d) headerByCoord.set(`39999:${h.pubkey}:${d}`, h);
  }

  const tagsMap = new Map(); // `${tagAuthor}|${slug}` -> { tag, applications, disputes }
  const mineMap = new Map(); // `${tagAuthor}|${slug}` -> { tag, stance, eventId, createdAt }  (viewer's own, latest)
  const unverifiable = [];

  for (const c of candidates) {
    const descTag = (c.tags || []).find((t) => t[0] === 'z' && DESCRIPTOR_RE.test(t[1] || ''));
    if (!descTag) continue; // no descriptor z → not an event-tagging
    const descriptor = descTag[1];
    const base = { eventId: c.id, authorPubkey: c.pubkey, createdAt: c.created_at };

    const header = headerByCoord.get(descriptor);
    if (!header) {
      unverifiable.push({ ...base, descriptor }); // header not resolvable → unverifiable (NOT dropped)
      continue;
    }

    // Legitimate only if the header joins a tagging-with-specific-tag namespace the reader honors.
    const legit = (header.tags || []).some((t) => {
      if (t[0] !== 'z') return false;
      const m = HONORED_Z_RE.exec(t[1] || '');
      return m && honored.has(m[1]);
    });
    if (!legit) continue; // illegitimate → excluded (distinct from unverifiable)

    // The tag this header is for: its a-tag coordinate 39999:<tagAuthor>:<slug>.
    const aTag = (header.tags || []).find((t) => t[0] === 'a');
    const am = aTag && TAG_A_RE.exec(aTag[1] || '');
    if (!am) continue; // header can't name its tag → not countable
    const tagAuthor = am[1];
    const slug = am[2];

    // Polarity bucket is computed BEFORE the trust filter so it gates both the
    // counted set and the viewer's-own `mine` channel (a neutral assertion is
    // neither apply nor dispute for either).
    const bucket = bucketize(readPolarity(c));
    if (bucket === 'neutral') continue;
    const key = `${tagAuthor}|${slug}`;

    // `mine` — the viewer's OWN legitimate stance, surfaced regardless of trust
    // (so a just-applied tag never appears to vanish when the POV doesn't count
    // them). Legitimacy-gated (we are past the header/honored/tag-identity gates);
    // trust-unfiltered. Keep the latest by createdAt (defensive; upstream dedupes).
    if (viewerPubkey && c.pubkey === viewerPubkey) {
      const existing = mineMap.get(key);
      if (!existing || c.created_at > existing.createdAt) {
        mineMap.set(key, { tag: { authorPubkey: tagAuthor, slug }, stance: bucket, eventId: c.id, createdAt: c.created_at });
      }
    }

    if (!trusted(c.pubkey)) continue; // POV trust filter — counted set only

    if (!tagsMap.has(key)) tagsMap.set(key, { tag: { authorPubkey: tagAuthor, slug }, applications: [], disputes: [] });
    const grp = tagsMap.get(key);
    const entry = { ...base, polarity: readPolarity(c) };
    if (bucket === 'apply') grp.applications.push(entry);
    else grp.disputes.push(entry);
  }

  return { tags: Array.from(tagsMap.values()), unverifiable, mine: Array.from(mineMap.values()) };
}

module.exports = { classifyEventTaggings };
