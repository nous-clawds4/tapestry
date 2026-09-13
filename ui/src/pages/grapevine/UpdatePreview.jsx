import { useTrust, SCORING_METHODS } from '../../context/TrustContext';
import useProfiles from '../../hooks/useProfiles';

/*
 * Update list's preview (curated-dlist-update #5, ADR 0005 §8): what my assistant would do with my curated
 * list — the groups of `updatePlan`, which the items section computes from the reads and verdicts the Curation
 * method panel shows — under the Scoring Method, point of view and cutoff they were judged by. With any read
 * incomplete it proposes nothing and says what couldn't be checked. Nothing here signs, publishes or writes:
 * carrying the plan out is story 6.
 */

const short = (pk) => (typeof pk === 'string' && pk.length > 12 ? `${pk.slice(0, 8)}…${pk.slice(-4)}` : String(pk || ''));
const num = (n) => (typeof n === 'number' && Number.isFinite(n) ? String(Math.round(n * 1000) / 1000) : '—');
const list = (v) => (Array.isArray(v) ? v : []);
const muted = { fontSize: '0.85rem', opacity: 0.65 };
const warn = { fontSize: '0.85rem', color: '#f59e0b' };
const box = {
  marginTop: '0.6rem', padding: '0.7rem 0.8rem', border: '1px solid var(--border, #444)', borderRadius: '6px',
  fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.4rem',
};

// Why a copy stays as it is, flagged (ADR 0005 §7–§8).
const KEPT_WHY = {
  'not-found': 'its original can’t be found',
  'edited-not-qualifying': 'its original was edited; the new version doesn’t qualify yet',
};

/** The preview of `plan` (`updatePlan`'s answer) at `cutoff`: the method line first, then what it proposes. */
export default function UpdatePreview({ plan, cutoff }) {
  const { povPubkey, scoringMethod, trustedListId } = useTrust();
  const profiles = useProfiles(povPubkey ? [povPubkey] : []);
  const methodLabel = SCORING_METHODS.find((m) => m.id === scoringMethod)?.label || scoringMethod;
  const povName = (povPubkey && (profiles[povPubkey]?.name || profiles[povPubkey]?.display_name)) || null;
  const p = plan && typeof plan === 'object' ? plan : { state: 'checking' };
  const scored = (e, sign) => `${e.name} · ${num(e.score)} ${sign} ${num(cutoff)}`;
  // The groups, in this order, each with a count and its items (AC-3); an empty group isn't shown.
  const groups = [
    { key: 'copy', title: 'Copy', lines: list(p.copy).map((e) => [e.routeId, scored(e, '≥')]) },
    { key: 'refresh', title: 'Refresh', lines: list(p.refresh).map((e) => [e.copyRouteId, scored(e, '≥')]) },
    { key: 'delete', title: 'Delete', lines: list(p.delete).map((e) => [e.copyRouteId, scored(e, '<')]) },
    {
      key: 'keep', title: 'Keep, flagged',
      lines: list(p.keepFlagged).map((e) => [e.copyRouteId,
        `${e.name} — ${KEPT_WHY[e.why] || e.why}${typeof e.score === 'number' ? ` · ${num(e.score)} < ${num(cutoff)}` : ''}`]),
    },
    { key: 'upgrade', title: 'Upgrade', lines: p.upgrade ? [['header', 'Your assistant’s header uses the older link; Update will switch it to “pointer”.']] : [] },
    { key: 'skipped', title: 'Skipped', lines: list(p.skipped).map((e) => [e.routeId, scored(e, '<')]) },
  ].filter((g) => g.lines.length > 0);

  return (
    <div style={box}>
      <div>
        Scoring Method: <strong>{methodLabel}</strong>
        {scoringMethod === 'trusted-list' && <> · {trustedListId ? <code>{trustedListId}</code> : 'no list chosen'}</>}
      </div>
      <div>Point of view: {povPubkey ? <>{povName ? `${povName} · ` : ''}<code>{short(povPubkey)}</code></> : '—'}</div>
      <div>Cutoff (≥) {num(cutoff)}</div>
      <p style={{ ...muted, margin: 0 }}>These apply in this browser and are not written onto the list.</p>
      {p.state === 'checking' && <div style={muted}>⏳ Checking…</div>}
      {p.state === 'blocked' && <div style={warn}>⚠️ Nothing to propose — couldn’t check {list(p.reasons).join('; ')}.</div>}
      {p.state === 'ready' && p.upToDate && <div>Your list is up to date.</div>}
      {p.state === 'ready' && groups.map((g) => (
        <div key={g.key}>
          <div style={{ fontWeight: 600 }}>{g.title} ({g.lines.length})</div>
          <ul style={{ margin: '0.2rem 0 0', paddingLeft: '1.2rem' }}>
            {g.lines.map(([key, text]) => <li key={key || text}>{text}</li>)}
          </ul>
        </div>
      ))}
      <p style={{ ...muted, margin: 0 }}>Nothing is signed: publishing isn’t built yet.</p>
    </div>
  );
}
