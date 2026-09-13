import { useTrust, SCORING_METHODS } from '../../context/TrustContext';
import useProfiles from '../../hooks/useProfiles';

/*
 * Update list's preview (curated-dlist-update #5, ADR 0005 §8): what my assistant would do with my curated
 * list — the groups of `updatePlan`, which the items section computes from the reads and verdicts the Curation
 * method panel shows — under the Scoring Method, point of view and cutoff they were judged by. With any read
 * incomplete it proposes nothing and says what couldn't be checked. A ready plan with something to do offers the one
 * action that publishes it (curated-dlist-update ADR 0006 §7). The items section runs it: it re-reads everything and
 * sends the approved intents, and my assistant signs on the server. This shows what happened, per item and per place.
 * Nothing here signs or writes.
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

// What Publish did at one place (ADR 0006 §5, §7): this instance, or a relay by its URL.
const placeName = (key) => (key === 'local' ? 'this instance' : key);
function placeWords(key, place) {
  const where = placeName(key);
  const p = place && typeof place === 'object' ? place : {};
  let text;
  if (p.status === 'published') text = `${where}: published`;
  else if (p.status === 'failed') text = `${where}: failed: ${p.error || 'no reason given'}`;
  else if (p.status === 'not-stored') text = `sent, but ${where} didn’t keep it`;
  else if (p.status === 'skipped') text = `${where}: not sent: this instance publishes locally only`;
  else text = `${where}: ${p.status || 'no answer'}`;
  // A deletion request that was stored, where the copy is still there (AC-9).
  return p.copy === 'still-there' ? `${text}; ${where} still shows it` : text;
}
const ACTION_WORD = { copy: 'Copy', refresh: 'Refresh', delete: 'Delete', upgrade: 'Upgrade' };

/** What Publish did, per item and per place (ADR 0006 §7, step 3), and why it stopped, if it did. */
function PublishResults({ run }) {
  const results = list(run.results);
  const refusal = run.refusal && typeof run.refusal === 'object' ? run.refusal : null;
  return (
    <div>
      <div style={{ fontWeight: 600 }}>What was published</div>
      {results.length === 0 ? <div style={muted}>Nothing was published.</div> : (
        <ul style={{ margin: '0.2rem 0 0', paddingLeft: '1.2rem' }}>
          {results.map((r, i) => (
            <li key={`${r.action}:${r.ref}:${i}`}>
              {ACTION_WORD[r.action] || r.action} {r.name} — {Object.entries(r.places || {}).map(([k, v]) => placeWords(k, v)).join('; ')}
            </li>
          ))}
        </ul>
      )}
      {refusal && refusal.kind === 'stale' && <div style={warn}>The list changed since you pressed Publish; here is the new preview.</div>}
      {refusal && refusal.kind === 'couldnt-check' && <div style={warn}>⚠️ Publishing stopped — couldn’t check {list(refusal.reasons).join('; ')}.</div>}
      {refusal && refusal.kind === 'error' && <div style={warn}>⚠️ Publishing stopped: {refusal.message}</div>}
    </div>
  );
}

/**
 * The preview of `plan` (`updatePlan`'s answer) at `cutoff`: the method line first, then what it proposes, the one
 * action that publishes it (`onPublish`), and the publish `run`'s state and results. `askedBefore` lists the copies
 * whose deletion my assistant already requested (ADR 0006 §7).
 */
export default function UpdatePreview({ plan, cutoff, run, onPublish, askedBefore }) {
  const { povPubkey, scoringMethod, trustedListId } = useTrust();
  const profiles = useProfiles(povPubkey ? [povPubkey] : []);
  const methodLabel = SCORING_METHODS.find((m) => m.id === scoringMethod)?.label || scoringMethod;
  const povName = (povPubkey && (profiles[povPubkey]?.name || profiles[povPubkey]?.display_name)) || null;
  const p = plan && typeof plan === 'object' ? plan : { state: 'checking' };
  const r = run && typeof run === 'object' ? run : null;
  const asked = new Set(list(askedBefore));
  const scored = (e, sign) => `${e.name} · ${num(e.score)} ${sign} ${num(cutoff)}`;
  // The upgrade says first when it also drops the "deliberately unaffiliated" marker (Planning decision 2).
  const upgradeLine = `Your assistant’s header uses the older link; Update will switch it to “pointer”${p.upgrade && p.upgrade.dropsMarker ? ', and remove its “deliberately unaffiliated” marker' : ''}.`;
  // The groups, in this order, each with a count and its items (AC-3); an empty group isn't shown.
  const groups = [
    { key: 'copy', title: 'Copy', lines: list(p.copy).map((e) => [e.routeId, scored(e, '≥')]) },
    { key: 'refresh', title: 'Refresh', lines: list(p.refresh).map((e) => [e.copyRouteId, scored(e, '≥')]) },
    // A copy a place still shows after my assistant's deletion request is proposed again (ADR 0006 §7, AC-9).
    { key: 'delete', title: 'Delete', lines: list(p.delete).map((e) => [e.copyRouteId, `${scored(e, '<')}${asked.has(e.copyRouteId) ? ' (asked before)' : ''}`]) },
    {
      key: 'keep', title: 'Keep, flagged',
      lines: list(p.keepFlagged).map((e) => [e.copyRouteId,
        `${e.name} — ${KEPT_WHY[e.why] || e.why}${typeof e.score === 'number' ? ` · ${num(e.score)} < ${num(cutoff)}` : ''}`]),
    },
    { key: 'upgrade', title: 'Upgrade', lines: p.upgrade ? [['header', upgradeLine]] : [] },
    { key: 'skipped', title: 'Skipped', lines: list(p.skipped).map((e) => [e.routeId, scored(e, '<')]) },
  ].filter((g) => g.lines.length > 0);
  const busy = !!r && (r.phase === 'checking' || r.phase === 'sending');

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
      {r && r.phase === 'changed' && <div style={warn}>The list changed since you pressed Publish; here is the new preview.</div>}
      {p.state === 'ready' && !p.upToDate && (
        <div>
          <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={onPublish}>Publish these changes</button>
        </div>
      )}
      {r && r.phase === 'sending' && <div style={muted}>⏳ Publishing…</div>}
      {r && r.phase === 'done' && <PublishResults run={r} />}
    </div>
  );
}
