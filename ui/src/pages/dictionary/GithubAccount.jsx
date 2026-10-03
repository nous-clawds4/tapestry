import { useState } from 'react';
import { Link } from 'react-router-dom';
import { avatarUrl, compactCount, joinedLabel, languageColor, profileUrl, updatedLabel } from './github';

/**
 * The GitHub Accounts DList's item page, in GitHub's own idiom: the avatar, name and login, a View on
 * GitHub button, the public profile (bio, where, links, counts) and the recently active repositories.
 *
 * The profile and repositories come from useGithubAccount (the reader's browser reads GitHub's public
 * API). The avatar is github.com/<login>.png, which costs no API read, so it shows even when the
 * profile can't be read.
 */

/** The GitHub mark (Primer Octicons mark-github-24, MIT). Decorative: the text beside it names GitHub. */
export function GithubMark({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M10.226 17.284c-2.965-.36-5.054-2.493-5.054-5.256 0-1.123.404-2.336 1.078-3.144-.292-.741-.247-2.314.09-2.965.898-.112 2.111.36 2.83 1.01.853-.269 1.752-.404 2.853-.404 1.1 0 1.999.135 2.807.382.696-.629 1.932-1.1 2.83-.988.315.606.36 2.179.067 2.942.72.854 1.101 2 1.101 3.167 0 2.763-2.089 4.852-5.098 5.234.763.494 1.28 1.572 1.28 2.807v2.336c0 .674.561 1.056 1.235.786 4.066-1.55 7.255-5.615 7.255-10.646C23.5 6.188 18.334 1 11.978 1 5.62 1 .5 6.188.5 12.545c0 4.986 3.167 9.12 7.435 10.669.606.225 1.19-.18 1.19-.786V20.63a2.9 2.9 0 0 1-1.078.224c-1.483 0-2.359-.808-2.987-2.313-.247-.607-.517-.966-1.034-1.033-.27-.023-.359-.135-.359-.27 0-.27.45-.471.898-.471.652 0 1.213.404 1.797 1.235.45.651.921.943 1.483.943.561 0 .92-.202 1.437-.719.382-.381.674-.718.944-.943" />
    </svg>
  );
}

// Primer Octicons, 16px (MIT), as GitHub's profile page shows them; X's mark for the X account.
const GLYPHS = {
  location: 'm12.596 11.596-3.535 3.536a1.5 1.5 0 0 1-2.122 0l-3.535-3.536a6.5 6.5 0 1 1 9.192-9.193 6.5 6.5 0 0 1 0 9.193Zm-1.06-8.132v-.001a5 5 0 1 0-7.072 7.072L8 14.07l3.536-3.534a5 5 0 0 0 0-7.072ZM8 9a2 2 0 1 1-.001-3.999A2 2 0 0 1 8 9Z',
  link: 'm7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a1.998 1.998 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 0 2.83Z',
  organization: 'M1.75 16A1.75 1.75 0 0 1 0 14.25V1.75C0 .784.784 0 1.75 0h8.5C11.216 0 12 .784 12 1.75v12.5c0 .085-.006.168-.018.25h2.268a.25.25 0 0 0 .25-.25V8.285a.25.25 0 0 0-.111-.208l-1.055-.703a.749.749 0 1 1 .832-1.248l1.055.703c.487.325.779.871.779 1.456v5.965A1.75 1.75 0 0 1 14.25 16h-3.5a.766.766 0 0 1-.197-.026c-.099.017-.2.026-.303.026h-3a.75.75 0 0 1-.75-.75V14h-1v1.25a.75.75 0 0 1-.75.75Zm-.25-1.75c0 .138.112.25.25.25H4v-1.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 .75.75v1.25h2.25a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25ZM3.75 6h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1 0-1.5ZM3 3.75A.75.75 0 0 1 3.75 3h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 3 3.75Zm4 3A.75.75 0 0 1 7.75 6h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 7 6.75ZM7.75 3h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1 0-1.5ZM3 9.75A.75.75 0 0 1 3.75 9h.5a.75.75 0 0 1 0 1.5h-.5A.75.75 0 0 1 3 9.75ZM7.75 9h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1 0-1.5Z',
  calendar: 'M4.75 0a.75.75 0 0 1 .75.75V2h5V.75a.75.75 0 0 1 1.5 0V2h1.25c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 13.25 16H2.75A1.75 1.75 0 0 1 1 14.25V3.75C1 2.784 1.784 2 2.75 2H4V.75A.75.75 0 0 1 4.75 0ZM2.5 7.5v6.75c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V7.5Zm10.75-4H2.75a.25.25 0 0 0-.25.25V6h11V3.75a.25.25 0 0 0-.25-.25Z',
  star: 'M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Zm0 2.445L6.615 5.5a.75.75 0 0 1-.564.41l-3.097.45 2.24 2.184a.75.75 0 0 1 .216.664l-.528 3.084 2.769-1.456a.75.75 0 0 1 .698 0l2.77 1.456-.53-3.084a.75.75 0 0 1 .216-.664l2.24-2.183-3.096-.45a.75.75 0 0 1-.564-.41L8 2.694Z',
  repo: 'M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z',
  people: 'M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 0 1 1-1.482.235 4 4 0 0 0-7.9 0 .75.75 0 0 1-1.482-.236A5.507 5.507 0 0 1 3.102 8.05 3.493 3.493 0 0 1 2 5.5ZM11 4a3.001 3.001 0 0 1 2.22 5.018 5.01 5.01 0 0 1 2.56 3.012.749.749 0 0 1-.885.954.752.752 0 0 1-.549-.514 3.507 3.507 0 0 0-2.522-2.372.75.75 0 0 1-.574-.73v-.352a.75.75 0 0 1 .416-.672A1.5 1.5 0 0 0 11 5.5.75.75 0 0 1 11 4Zm-5.5-.5a2 2 0 1 0-.001 3.999A2 2 0 0 0 5.5 3.5Z',
};
const X_MARK = 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z';

function Glyph({ name }) {
  const x = name === 'x';
  return (
    <svg className="dict-gh-glyph" width="16" height="16" viewBox={x ? '0 0 24 24' : '0 0 16 16'} fill="currentColor" aria-hidden="true" focusable="false">
      <path d={x ? X_MARK : GLYPHS[name]} />
    </svg>
  );
}

const out = { target: '_blank', rel: 'noopener noreferrer' };

/** The avatar from github.com; the login's initial when it can't be loaded. `small` is an Items row's. */
function GithubAvatar({ login, small = false }) {
  const [failed, setFailed] = useState(false);
  const cls = `dict-gh-avatar${small ? ' dict-gh-avatar--sm' : ''}`;
  if (failed) return <span className={`${cls} dict-gh-avatar--none`} aria-hidden="true">{login.slice(0, 1).toUpperCase()}</span>;
  const px = small ? 32 : 88;
  return (
    <img
      className={cls} src={avatarUrl(login, px * 2)} alt="" width={px} height={px}
      referrerPolicy="no-referrer" onError={() => setFailed(true)}
    />
  );
}

/** An Items row's account (githubRows): its avatar, its login (the link to its item page), and the filer's description. */
export function GithubItemCell({ row, to, state }) {
  return (
    <span className="dict-gh-item">
      <GithubAvatar key={row.login} login={row.login} small />
      <span className="dict-gh-item-text">
        <Link to={to} state={state} className="dict-items-item-link">{row.login}</Link>
        {row.description && <span className="dict-gh-item-desc">{row.description}</span>}
      </span>
    </span>
  );
}

/**
 * The page's head: the avatar with GitHub's mark on it, the account's name with its login beneath (or the
 * login alone, when the account has no name), the item's place, and View on GitHub.
 */
export function GithubAccountHead({ login, gh, subtitle }) {
  const name = gh.status === 'ok' ? gh.user.name : null;
  return (
    <header className="dict-gh-head">
      <span className="dict-gh-avatar-wrap">
        <GithubAvatar key={login} login={login} />
        <span className="dict-gh-badge" aria-hidden="true"><GithubMark size={16} /></span>
      </span>
      <div className="dict-gh-head-text">
        <h1 className="dict-entry-title">{name || login}</h1>
        {name && name !== login && <a href={profileUrl(login)} {...out} className="dict-gh-login">{login}</a>}
        {subtitle && <p className="dict-entry-sub text-muted">{subtitle}</p>}
      </div>
      <a href={profileUrl(login)} {...out} className="dict-gh-btn"><GithubMark size={16} /> View on GitHub</a>
    </header>
  );
}

function failureText(login, failure) {
  if (failure.kind === 'missing') return `GitHub has no account named ${login}. It may have been renamed or deleted.`;
  if (failure.kind === 'limited') {
    const when = failure.resetAt
      ? ` at ${new Date(failure.resetAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ' within the hour';
    return `GitHub allows a browser sixty profile reads an hour, and this one has used them up. They come back${when}; the profile will show then.`;
  }
  return `Couldn’t read ${login}’s profile from GitHub (${failure.message}).`;
}

/** The public profile: bio, where and how to reach them, when they joined, and their counts. */
export function GithubProfile({ login, gh }) {
  if (gh.status === 'idle') return null;
  if (gh.status === 'loading') return <p className="dict-gh-reading text-muted">Reading the profile from GitHub…</p>;
  if (gh.status === 'failed') return <p className="dict-notice">{failureText(login, gh.failure)}</p>;
  const u = gh.user;
  const joined = joinedLabel(u.createdAt);
  const meta = [
    u.organization && <li key="org"><Glyph name="organization" /> Organization</li>,
    u.company && <li key="company"><Glyph name="organization" /> {u.company}</li>,
    u.location && <li key="location"><Glyph name="location" /> {u.location}</li>,
    u.blog && <li key="blog"><Glyph name="link" /> <a href={u.blog} {...out}>{u.blog.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a></li>,
    u.twitter && <li key="x"><Glyph name="x" /> <a href={`https://x.com/${u.twitter}`} {...out}>@{u.twitter}</a></li>,
    joined && <li key="joined"><Glyph name="calendar" /> Joined {joined}</li>,
  ].filter(Boolean);
  const stat = (n, label, tab) => n !== null && (
    <a href={profileUrl(login, tab)} {...out} className="dict-gh-stat"><strong>{compactCount(n)}</strong> {label}</a>
  );
  return (
    <section className="dict-card dict-entry-card dict-gh-profile" aria-label="GitHub profile">
      {u.bio && <p className="dict-gh-bio">{u.bio}</p>}
      {meta.length > 0 && <ul className="dict-gh-meta">{meta}</ul>}
      <div className="dict-gh-stats">
        <Glyph name="people" />
        {stat(u.followers, u.followers === 1 ? 'follower' : 'followers', 'followers')}
        {stat(u.following, 'following', 'following')}
        {stat(u.publicRepos, u.publicRepos === 1 ? 'public repository' : 'public repositories', 'repositories')}
      </div>
      <p className="dict-gh-source">From GitHub’s public profile, read by your browser.</p>
    </section>
  );
}

/** The account's most recently pushed repositories (forks aside), each linking to GitHub. */
export function GithubRepos({ login, gh }) {
  if (gh.status !== 'ok' || !gh.repos || gh.repos.length === 0) return null;
  const all = gh.user.publicRepos;
  return (
    <section className="dict-gh-repos" aria-labelledby="dict-gh-repos-title">
      <div className="dict-gh-section-head">
        <span id="dict-gh-repos-title" className="dict-field-label">Recently active repositories</span>
        <a href={profileUrl(login, 'repositories')} {...out} className="dict-gh-all">
          {all ? `All ${all.toLocaleString()} on GitHub` : 'All on GitHub'}
        </a>
      </div>
      <ul className="dict-gh-repo-grid">
        {gh.repos.map((r) => {
          const updated = updatedLabel(r.pushedAt);
          return (
            <li key={r.url} className="dict-card dict-gh-repo">
              <div className="dict-gh-repo-top">
                <Glyph name="repo" />
                <a href={r.url} {...out} className="dict-gh-repo-name">{r.name}</a>
                {r.archived && <span className="dict-gh-tag">Archived</span>}
              </div>
              {r.description && <p className="dict-gh-repo-desc">{r.description}</p>}
              <div className="dict-gh-repo-foot">
                {r.language && (
                  <span><span className="dict-gh-lang" style={{ background: languageColor(r.language) }} aria-hidden="true" />{r.language}</span>
                )}
                {r.stars > 0 && <span><Glyph name="star" /> {compactCount(r.stars)}</span>}
                {updated && <span>Updated {updated}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
