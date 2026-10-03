import { useEffect, useMemo, useState } from 'react';
import { readFailure, recentRepos, reposApiUrl, summarizeUser, userApiUrl } from './github';

/**
 * A GitHub account's public profile and recently active repositories, for the GitHub Accounts DList's
 * item page (GithubAccount.jsx): {status: idle | loading | ok | failed, user, repos, failure}.
 *
 * Read by the reader's browser from GitHub's public REST API, unsigned: no key, no cookies, no referrer.
 * GitHub allows sixty such reads an hour per address and this spends two, so a complete answer is kept
 * for half an hour, in memory and in the session (which may refuse; the memory copy still serves).
 */

const KEEP_MS = 30 * 60 * 1000;
const kept = new Map();
const keyOf = (login) => `dict-github:${login.toLowerCase()}`;
const IDLE = { status: 'idle' };
const LOADING = { status: 'loading' };

function recall(login) {
  let hit = kept.get(keyOf(login));
  if (!hit) {
    try { hit = JSON.parse(sessionStorage.getItem(keyOf(login)) || 'null'); } catch { hit = null; }
  }
  return hit && Date.now() - hit.at < KEEP_MS ? hit : null;
}

function keep(login, value) {
  const hit = { ...value, at: Date.now() };
  kept.set(keyOf(login), hit);
  try { sessionStorage.setItem(keyOf(login), JSON.stringify(hit)); } catch { /* the in-memory copy still serves */ }
}

export default function useGithubAccount(login) {
  const [read, setRead] = useState({ login: null });
  const hit = useMemo(() => (login ? recall(login) : null), [login]);
  useEffect(() => {
    if (!login || hit) return undefined;
    const ctrl = new AbortController();
    const get = (url) => fetch(url, {
      headers: { Accept: 'application/vnd.github+json' }, credentials: 'omit', referrerPolicy: 'no-referrer', signal: ctrl.signal,
    });
    (async () => {
      try {
        const [u, r] = await Promise.all([get(userApiUrl(login)), get(reposApiUrl(login)).catch(() => null)]);
        if (!u.ok) { setRead({ login, status: 'failed', failure: readFailure(u.status, u.headers) }); return; }
        const user = summarizeUser(await u.json(), login);
        if (!user) { setRead({ login, status: 'failed', failure: { kind: 'error', message: 'GitHub’s answer wasn’t a profile' } }); return; }
        const repos = r && r.ok ? recentRepos(await r.json().catch(() => null)) : null;
        if (repos) keep(login, { user, repos }); // a partial answer is shown, not kept
        setRead({ login, status: 'ok', user, repos });
      } catch (err) {
        if (err.name !== 'AbortError') setRead({ login, status: 'failed', failure: { kind: 'error', message: err.message } });
      }
    })();
    return () => ctrl.abort();
  }, [login, hit]);
  if (!login) return IDLE;
  if (hit) return { status: 'ok', user: hit.user, repos: hit.repos };
  return read.login === login ? read : LOADING;
}
