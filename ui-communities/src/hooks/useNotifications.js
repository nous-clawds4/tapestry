import { useCallback, useEffect, useState } from 'react'
import { getJoinedCommunitySummaries } from '../api/client.js'
import { circleATag } from '../lib/circle.js'
import { loadPreferences } from '../lib/notificationPrefs.js'
import {
  buildNotifications, hasNew, fetchNotificationSources, getLastSeen, markSeen as persistSeen,
} from '../lib/notifications.js'

/*
 * App-level notifications (ADR-0038). Fetches and derives the viewer's
 * notifications ONLY when signed in AND at least one preference is on — the
 * default opted-out state costs nothing (no fetch, no marker). Drives the nav
 * marker (hasNew) and feeds the inbox; markSeen clears the marker.
 */
export function useNotifications({ viewer, signedIn, joinedSlugs }) {
  const [items, setItems] = useState([])
  const [isNew, setIsNew] = useState(false)
  const [status, setStatus] = useState('idle')   // idle | ready | error
  const [nonce, setNonce] = useState(0)
  const joinedKey = (joinedSlugs || []).slice().sort().join(',')

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!signedIn || !viewer) return { items: [], isNew: false }
      const prefs = loadPreferences(viewer)
      if (!(prefs.vouched || prefs['new-posts'] || prefs.replies)) return { items: [], isNew: false }

      const slugs = joinedKey ? joinedKey.split(',') : []
      const joined = await getJoinedCommunitySummaries(slugs, viewer)
      const circleIndex = new Map()
      const joinedATags = []
      for (const c of joined || []) {
        const a = circleATag(c)
        if (a) { circleIndex.set(a, { slug: c.slug, name: c.name }); joinedATags.push(a) }
      }
      const sources = await fetchNotificationSources({ viewer, joinedATags })
      const built = buildNotifications({ ...sources, viewer, prefs, circleIndex })
      return { items: built, isNew: hasNew(built, getLastSeen(viewer)) }
    }
    // All setState happens in the async callbacks (never synchronously in the
    // effect body), so there is no set-state-in-render concern.
    load()
      .then(r => { if (!cancelled) { setItems(r.items); setIsNew(r.isNew); setStatus('ready') } })
      .catch(() => { if (!cancelled) { setItems([]); setIsNew(false); setStatus('error') } })
    return () => { cancelled = true }
  }, [viewer, signedIn, joinedKey, nonce])

  const markSeen = useCallback(() => {
    persistSeen(viewer)
    setIsNew(false)
  }, [viewer])

  const reload = useCallback(() => setNonce(n => n + 1), [])

  return { items, hasNew: isNew, status, markSeen, reload }
}
