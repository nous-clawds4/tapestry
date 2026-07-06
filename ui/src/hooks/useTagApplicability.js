import { useState, useEffect } from 'react';

/**
 * Hook: the type-aware picker's applicability data (tag-applicability #2 / ADR 0002, reshaped
 * 2026-07-06 for David's scoped-search direction). Fetches BOTH context lists
 * (`/api/tags/applicability?type=event` and `?type=pubkey`, viewer-inclusive, live HINT ∪ USAGE)
 * and returns:
 *   - `applicableKeys`  — the CURRENT `type`'s ordered `authorPubkey:slug` keys (browse + scoped search)
 *   - `contextsByKey`   — `key → { people, content }` over BOTH lists (per-row usage hint + the
 *                         cross-context "Show other results" detection)
 *
 * Both lists are needed: the current one scopes the picker; the other one tells us a tag also
 * exists cross-context (so the same-slug "Show other results" escape can surface it and the row
 * hint can say "· people & content").
 *
 * @param {'pubkey'|'event'} type
 * @param {string} [viewerPubkey]
 * @returns {{ applicableKeys: string[], contextsByKey: Object<string,{people:boolean,content:boolean}>, loading: boolean }}
 */
export default function useTagApplicability(type, viewerPubkey) {
  const [applicableKeys, setApplicableKeys] = useState([]);
  const [contextsByKey, setContextsByKey] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!type) { setLoading(false); return undefined; }
    const controller = new AbortController();
    setLoading(true);

    const url = (t) => {
      const params = new URLSearchParams({ type: t });
      if (viewerPubkey) params.set('viewerPubkey', viewerPubkey);
      return `/api/tags/applicability?${params}`;
    };
    const keysOf = (json) =>
      (json && json.success && Array.isArray(json.members))
        ? json.members.map((m) => `${m.authorPubkey}:${m.slug}`)
        : [];

    Promise.all([
      fetch(url('event'), { signal: controller.signal }).then((r) => r.json()).catch(() => null),
      fetch(url('pubkey'), { signal: controller.signal }).then((r) => r.json()).catch(() => null),
    ])
      .then(([eventJson, pubkeyJson]) => {
        const eventKeys = keysOf(eventJson);
        const pubkeyKeys = keysOf(pubkeyJson);
        const eventSet = new Set(eventKeys);
        const pubkeySet = new Set(pubkeyKeys);
        const ctx = {};
        for (const k of new Set([...eventKeys, ...pubkeyKeys])) {
          ctx[k] = { people: pubkeySet.has(k), content: eventSet.has(k) };
        }
        setContextsByKey(ctx);
        setApplicableKeys(type === 'pubkey' ? pubkeyKeys : eventKeys);
      })
      .catch(() => { setApplicableKeys([]); setContextsByKey({}); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();
  }, [type, viewerPubkey]);

  return { applicableKeys, contextsByKey, loading };
}
