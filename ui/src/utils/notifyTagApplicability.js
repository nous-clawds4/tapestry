/**
 * Fire-and-forget: after a tag is created or applied, nudge the server to republish the applicability
 * Trusted Lists (kind-30394). The server side is debounced + diff-guarded, so calling this liberally
 * is cheap — a burst collapses to one republish, and an unchanged membership publishes nothing.
 *
 * Best-effort by design: never awaited, never throws. If it fails (offline, unauthenticated session,
 * server busy), the slow backstop reconciles the list later. ADR tag-applicability/0003.
 */
export default function notifyTagApplicability() {
  try {
    // Same-origin → the session cookie rides along (requireAuth server-side).
    fetch('/api/trusted-list/notify-applicability', { method: 'POST' }).catch(() => {});
  } catch {
    /* ignore — fire-and-forget */
  }
}
