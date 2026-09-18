import { useState, useEffect, useCallback, useMemo } from 'react';
import { queryRelay } from '../api/relay';
import { splitTLTags } from '../utils/trustedListView';
import { fetchListHeaders, listCoordOf, groupItemsByList } from '../utils/dlistHeaders';

/** Stable empty array so a disabled hook does not churn its consumers' memos. */
const EMPTY = [];

/**
 * dlist-item-tagging #5 — the Pinned tab's Items sub-view.
 *
 * Reads the **published kind-30394 item Trusted List** (not the live aggregation the tag
 * page's Items view shows). That difference is the point: this tab answers "what did the
 * refresh actually sign and publish under my POV", which is what a downstream indexer
 * consumes, and it will lag the live view between refreshes.
 *
 * Members of a 30394 are `a` coordinates (`splitTLTags` reads the member letter from the
 * kind, so the list's `z` discovery tags and `p` observer are never mistaken for items).
 * Each coordinate is then resolved to its item event, grouped under its parent list, and
 * the parents' headers fetched so the rows render by the list's own field declarations.
 *
 * Degradation: a coordinate whose event is on no reachable relay still yields a row
 * (address + synthesized `d`), and a list whose header is missing renders with empty
 * field declarations. Nothing here throws into the panel.
 */
export default function usePinnedItems(itemDTag, taPubkey) {
  const [list, setList] = useState(null);
  const [itemEvents, setItemEvents] = useState([]);
  const [headers, setHeaders] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  const enabled = !!itemDTag && !!taPubkey;

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      let tl = null;
      try {
        const evts = await queryRelay({
          kinds: [30394], authors: [taPubkey], '#d': [itemDTag], limit: 5,
        });
        if (evts && evts.length) {
          evts.sort((a, b) => b.created_at - a.created_at);
          tl = evts[0];
        }
      } catch { /* no list yet, or the relay is unreachable */ }
      if (cancelled) return;
      setList(tl);

      const addresses = splitTLTags(tl).members.map((m) => m.value).filter(Boolean);
      if (addresses.length === 0) {
        setItemEvents([]); setHeaders(new Map()); setLoading(false);
        return;
      }

      // Resolve the member coordinates to their item events — batched per (kind, author).
      const byAuthor = new Map();
      for (const addr of addresses) {
        const [kind, pubkey, ...rest] = addr.split(':');
        if (!kind || !pubkey || rest.length === 0) continue;
        const key = `${kind}|${pubkey.toLowerCase()}`;
        if (!byAuthor.has(key)) byAuthor.set(key, []);
        byAuthor.get(key).push(rest.join(':'));
      }
      const found = [];
      for (const [key, ds] of byAuthor) {
        const [kind, pubkey] = key.split('|');
        try {
          found.push(...await queryRelay({
            kinds: [Number(kind)], authors: [pubkey], '#d': Array.from(new Set(ds)), limit: 500,
          }));
        } catch { /* that batch degrades to address-only rows */ }
      }
      if (cancelled) return;

      // Keep the published order, newest event per coordinate.
      const byAddress = new Map();
      for (const ev of found) {
        const d = (ev.tags || []).find((t) => t[0] === 'd');
        if (!d || !d[1]) continue;
        const addr = `${ev.kind}:${String(ev.pubkey).toLowerCase()}:${d[1]}`;
        if (!byAddress.has(addr) || ev.created_at > byAddress.get(addr).created_at) {
          byAddress.set(addr, ev);
        }
      }
      const rows = addresses.map((address) => {
        const ev = byAddress.get(address) || null;
        return {
          address,
          id: ev ? ev.id : address,
          kind: ev ? ev.kind : (Number(address.split(':')[0]) || null),
          pubkey: ev ? ev.pubkey : (address.split(':')[1] || null),
          created_at: ev ? ev.created_at : null,
          tags: ev ? (ev.tags || []) : [],
          content: ev ? (ev.content || '') : '',
          listCoord: listCoordOf(ev),
        };
      });
      setItemEvents(rows);

      const coords = Array.from(new Set(rows.map((r) => r.listCoord).filter(Boolean)));
      const hdrs = await fetchListHeaders(coords, queryRelay);
      if (cancelled) return;
      setHeaders(hdrs);
      setLoading(false);
    })().catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [itemDTag, taPubkey, enabled, nonce]);

  // With no d-tag or no TA pubkey there is nothing addressable to read, so the hook
  // reports an empty list rather than holding a previous pin's items.
  const visibleItems = enabled ? itemEvents : EMPTY;
  const groups = useMemo(() => groupItemsByList(visibleItems), [visibleItems]);

  return {
    list: enabled ? list : null,
    items: visibleItems,
    groups,
    headers,
    loading: enabled && loading,
    refetch,
  };
}
