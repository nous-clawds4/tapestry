/**
 * The GitHub Accounts DList's item page: what it reads off the item, and what it makes of GitHub's
 * public REST API. Pure (no React), so the node runner can import it (test/dictionary-github-account.test.js).
 *
 * The DList is recognised by its shared concept, GITHUB_ACCOUNTS below: an instance's own "GitHub Account"
 * header b-points to it, so the coordinate is the same on every deployment. It is the community header's
 * author, not this instance's Assistant, so the never-hardcode-the-TA rule doesn't apply. Each item names
 * its account in a `github-username` tag (the header's `required` field).
 */

export const GITHUB_ACCOUNTS = '39998:b83a28b7e4e5d20bd960c5faeb6625f95529166b8bdb045d42634a2f35919450:github-accounts';
export const GITHUB_USERNAME_TAG = 'github-username';

// GitHub's rule for a login: 1–39 letters, digits or single hyphens, neither first nor last a hyphen.
const LOGIN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const PROFILE_URL = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#\s]+)\/?(?:[?#]\S*)?$/i;

/** A github-username value as a login GitHub would accept, or null. "@name" and a github.com/name link count too. */
export function normalizeLogin(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw.trim().replace(/^@/, '');
  const m = PROFILE_URL.exec(s);
  if (m) s = m[1];
  return LOGIN.test(s) ? s : null;
}

/** The item's GitHub login: its first `github-username` tag that is one, else null. */
export function githubLogin(ev) {
  for (const t of Array.isArray(ev?.tags) ? ev.tags : []) {
    if (Array.isArray(t) && t[0] === GITHUB_USERNAME_TAG) {
      const login = normalizeLogin(t[1]);
      if (login) return login;
    }
  }
  return null;
}

/** Whether a page's concepts (its header, the shared concept it points to, its b targets) include the GitHub Accounts DList. */
export const isGithubAccounts = (concepts) => Array.isArray(concepts) && concepts.includes(GITHUB_ACCOUNTS);

const at = (login) => encodeURIComponent(login);
/** The profile on github.com, or one of its tabs (repositories, followers, following). */
export const profileUrl = (login, tab) => `https://github.com/${at(login)}${tab ? `?tab=${tab}` : ''}`;
/** The avatar, by login: github.com redirects it to the image, and it costs no API read. */
export const avatarUrl = (login, size = 192) => `https://github.com/${at(login)}.png?size=${size}`;
export const userApiUrl = (login) => `https://api.github.com/users/${at(login)}`;
/** The account's own repositories, most recently pushed first: twelve, so a few forks can be set aside. */
export const reposApiUrl = (login) => `${userApiUrl(login)}/repos?type=owner&sort=pushed&per_page=12`;

const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const count = (v) => (Number.isInteger(v) && v >= 0 ? v : null);

/** An http(s) link from a profile field, which may leave out the scheme; anything else is null. */
export function webUrl(raw) {
  const s = text(raw);
  if (!s) return null;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(s) ? s : `https://${s}`);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.includes('.') ? url.href : null;
  } catch {
    return null;
  }
}

/** A link GitHub's data gives for one of its own pages: kept only when it is https://github.com/… */
export function githubHref(raw) {
  const s = text(raw);
  if (!s) return null;
  try {
    const url = new URL(s);
    return url.protocol === 'https:' && url.hostname === 'github.com' ? url.href : null;
  } catch {
    return null;
  }
}

/** The parts of GET /users/:login this page shows, each checked. Null when the answer isn't an object. */
export function summarizeUser(json, login) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const twitter = text(json.twitter_username);
  return {
    login: normalizeLogin(json.login) || login,
    name: text(json.name),
    organization: json.type === 'Organization',
    bio: text(json.bio),
    company: text(json.company),
    location: text(json.location),
    blog: webUrl(json.blog),
    twitter: twitter && /^[A-Za-z0-9_]{1,15}$/.test(twitter) ? twitter : null,
    publicRepos: count(json.public_repos),
    followers: count(json.followers),
    following: count(json.following),
    createdAt: text(json.created_at),
  };
}

/** The most recently pushed of the account's own repositories, forks set aside. */
export function recentRepos(list, max = 6) {
  const pushed = (r) => Date.parse(r.pushed_at || '') || 0;
  return (Array.isArray(list) ? list : [])
    .filter((r) => r && typeof r === 'object' && !r.fork && text(r.name) && githubHref(r.html_url))
    .sort((a, b) => pushed(b) - pushed(a))
    .slice(0, max)
    .map((r) => ({
      name: text(r.name),
      url: githubHref(r.html_url),
      description: text(r.description),
      language: text(r.language),
      stars: count(r.stargazers_count),
      pushedAt: text(r.pushed_at),
      archived: r.archived === true,
    }));
}

/**
 * What a failed read of GET /users/:login means: no such account, GitHub's hourly limit on unsigned
 * reads from this browser (403 with none remaining, or 429), or anything else, named by its status.
 */
export function readFailure(status, headers) {
  if (status === 404) return { kind: 'missing' };
  const header = (name) => (headers && typeof headers.get === 'function' ? headers.get(name) : null);
  if (status === 429 || (status === 403 && header('x-ratelimit-remaining') === '0')) {
    const reset = Number(header('x-ratelimit-reset'));
    return { kind: 'limited', resetAt: Number.isFinite(reset) && reset > 0 ? reset * 1000 : null };
  }
  return { kind: 'error', message: `GitHub answered HTTP ${status}` };
}

/** "March 2015", for "Joined"; null for anything that isn't a date. */
export function joinedLabel(iso) {
  const t = Date.parse(iso || '');
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : null;
}

/** GitHub's own way of writing a count: 37, 1.2k, 15k. */
export function compactCount(n) {
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n).toLowerCase();
}

/** "today", "yesterday", "3 days ago", "2 months ago", "4 years ago"; null for anything that isn't a date. */
export function updatedLabel(iso, now = Date.now()) {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return null;
  const days = Math.max(0, Math.floor((now - t) / 86400000));
  if (days === 0) return 'today';
  const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
  if (days < 30) return rtf.format(-days, 'day');
  if (days < 365) return rtf.format(-Math.floor(days / 30), 'month');
  return rtf.format(-Math.floor(days / 365), 'year');
}

// GitHub's language colours (github-linguist) for the languages most likely here; the rest are grey.
const LANGUAGE_COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572a5', Rust: '#dea584', Go: '#00add8', Java: '#b07219',
  Kotlin: '#a97bff', Swift: '#f05138', C: '#555555', 'C++': '#f34b7d', 'C#': '#178600', Ruby: '#701516',
  PHP: '#4f5d95', Shell: '#89e051', HTML: '#e34c26', CSS: '#563d7c', Dart: '#00b4ab', Solidity: '#aa6746',
  'Jupyter Notebook': '#da5b0b', Vue: '#41b883', Svelte: '#ff3e00', Elixir: '#6e4a7e', Haskell: '#5e5086',
  Lua: '#000080', Nix: '#7e7eff', Zig: '#ec915c', Clojure: '#db5855', Scala: '#c22d40', Nim: '#ffc200',
};
export const languageColor = (language) => LANGUAGE_COLORS[language] || '#8c929e';
