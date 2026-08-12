# ADR 0036: security.txt, robots.txt, and honest 404s

**Status:** Accepted
**Date:** 2026-08-11
**Story:** `engineering-team/stories/site-trust-signals/1-security-txt-and-honest-404s.md`

## Context

The SPA catch-all at `bin/control-panel.js:309` serves `dist/index.html` for every unmatched path
that isn't under `/api/`. As a result no path on any of the six tapestry hosts ever 404s:
`/robots.txt`, `/.well-known/security.txt`, `/.env`, and arbitrary nonsense all return
`200 text/html`. Combined with a contentless SPA shell and no published ownership information, this
matches the automated fingerprint for a bulk-generated clone farm — the estate is being flagged as
unsafe by reputation scanners.

Constraints that bind the design:

- **RFC 9116 §2.5.2** — if the URL a `security.txt` was retrieved from does not match one of its
  `Canonical` fields, the contents SHOULD NOT be trusted. A single static file naming one host would
  therefore be *invalid* on the other five and on every third-party fork.
- **RFC 9116 §2.5.5** — exactly one `Expires`, no more than a year out. An expired file is invalid,
  so a stale file is worse than no file.
- **House rule (CLAUDE.md)** — per-deployment values are never hardcoded in shared code. This
  applies to the site's own domain exactly as it applies to the TA pubkey.
- **`express.static` ignores dotfile paths by default**, so `public/.well-known/security.txt` would
  not be served even if it existed on disk.
- **`process.env.DOMAIN_NAME` is available to the Node process.** Verified empirically in the running
  container (`/proc/<pid>/environ` → `DOMAIN_NAME=localhost`); it is set by `docker-compose.yml:19`
  and inherited through supervisord. Note it is *not* present in `/etc/brainstorm.conf` — the
  template at `config/brainstorm.conf.template` only derives `STRFRY_DOMAIN` and
  `BRAINSTORM_NEO4J_BROWSER_URL` from it — so `getConfigFromFile('DOMAIN_NAME')` would fail.
- **Route params may contain dots.** `/pin/:dTag` and `/tag/:slug/:tagId` carry user-authored values,
  so no rule may treat "contains a dot" as "not an SPA route."

No concepts are touched. This story sits at the HTTP layer and is deliberately outside the four
architecture invariants: the response is identical for every viewer because it asserts something
about *the operator of the server*, not about any POV's view of the graph.

## Options considered

### Option A — Allow-list the SPA routes server-side
Mirror the React Router table in Express; 404 anything not in it.

Pros: strictest possible behavior; every nonexistent path 404s, which is the cleanest signal.
Cons: `ui/src/App.jsx` has 100+ route entries including deep nesting, and it grows most sprints. The
server copy would drift from the client copy silently, and the failure mode is **404ing a live
page** — a user-visible outage caused by a reputation fix. Rejected: the blast radius of drift is far
worse than the marginal signal gained.

### Option B — Shape-based deny rule ahead of the catch-all
Explicit routes for `/.well-known/security.txt` and `/robots.txt`; then, immediately before the
catch-all, return a genuine 404 for paths whose final segment carries a known probe/asset extension,
and for any unhandled path under `/.well-known/`. Everything else falls through to the SPA unchanged.

Pros: small, stable, and it cannot drift — it encodes *path shape*, not route inventory. Every SPA
route is extensionless, so client-side routing is untouched. Sits after all static middleware, so
real assets are already served by the time the rule is reached.
Cons: extensionless nonsense (`/foobar`) still returns the SPA shell.

### Option C — Handle it in nginx
Put the rules in `docker/nginx.conf`.

Pros: no application change.
Cons: the container nginx proxies `/` wholesale to `:7778`, so the rules would have to duplicate
knowledge of what the app serves. The droplets *also* have a separate host nginx doing TLS, so
there'd be two layers to keep in sync, and neither is exercised by local dev or the test suite.
Rejected.

## Decision

We chose **Option B**.

On the accepted cost: `/foobar` continuing to return the SPA shell is standard SPA behavior that a
large fraction of legitimate single-page applications exhibit, and it is not by itself a phishing
signal. The signals that *are* diagnostic — `/robots.txt` answering with HTML, `/.env` answering
200, a site with no `security.txt` at a well-known path — are all fixed by this rule. Buying the
remainder would cost the drift risk of Option A, which is not a trade worth making.

`Canonical` is rendered from `process.env.DOMAIN_NAME`. When that is unset or `localhost`, the field
is **omitted entirely** rather than guessed. RFC 9116 makes `Canonical` optional, so an absent field
leaves the document valid, whereas a wrong one invalidates it.

**The `Host` header is deliberately not used.** It would handle host aliases automatically, but it is
attacker-controllable: a request with a spoofed `Host` would yield a document appearing to vouch for
a domain we do not operate. Configuration is the trustworthy source.

`robots.txt` **defaults to `Disallow: /`** and opts in to indexing via `ALLOW_INDEXING=true`. Keying
off `DOMAIN_NAME === 'tapestry.brainstorm.world'` would hardcode a per-deployment value into shared
code, which the house rule forbids; defaulting closed also means a new sandbox can never accidentally
compete with production in search results before anyone remembers to configure it.

## Consequences

- Enables a researcher to report a vulnerability through a documented channel — today there is none.
- Enables the estate to present a machine-readable ownership attestation, which is the substantive
  answer to "these six domains look like clones of each other."
- Constrains production deploys: `tapestry.brainstorm.world` must set `ALLOW_INDEXING=true` in its
  `.env`, or production silently stops being indexable. This is a **deploy step, not a code change**,
  and must be carried out before or with the promotion to `main`.
- Creates a **renewal obligation**: `Expires` is 2027-08-11. A follow-up must exist to refresh it, or
  the file becomes invalid and actively counts against us. An `OPEN.md` row is required at close.
- Adds a small, permanent maintenance surface: the estate list embedded in the document must be
  updated whenever a host is added or retired. Five hostnames referenced in this repo are already
  dead DNS, which is evidence this drift is real.
- **Firmware reinstall required?** No — no concept definitions change.

## Implementation notes

- **File: `src/utils/siteTrust.js`** (new) — the document builders, kept out of `control-panel.js` so
  they are unit-testable without booting Express.
  - `buildSecurityTxt({ domain })` → string. Emits the estate-attestation comment block, then
    `Contact`, `Expires`, `Preferred-Languages`, `Policy`, and `Canonical` (the last only when
    `domain` is truthy and not `localhost`).
  - `buildRobotsTxt({ allowIndexing })` → string.
  - `isBlockedProbePath(pathname)` → boolean. Explicit extension list — `php`, `env`, `asp`, `aspx`,
    `jsp`, `cgi`, `sql`, `bak`, `ini`, `conf`, `sh`, `yml`, `yaml`, `xml`, `json`, `txt`, `ico`,
    `map` — matched only against the final path segment, plus `true` for any path starting
    `/.well-known/`. Must not match extensionless paths.
- **File: `bin/control-panel.js`** — register `GET /.well-known/security.txt` and `GET /robots.txt`
  near the other explicit routes, both responding `text/plain; charset=utf-8`. Then, immediately
  before the catch-all at line 309, add the deny rule: if `isBlockedProbePath(req.path)` and the
  path is not under `/api/`, `res.status(404).type('text/plain').send('Not found')`. Placement after
  all `express.static` middleware is load-bearing — real assets must be served before the rule runs.
- **File: `SECURITY.md`** (new, repo root) — the `Policy` target. Carries the same estate inventory
  plus reporting instructions.
- The estate list is drafted at
  `/private/tmp/claude-501/-Users-wds4-repos-nous-clawds4-tapestry/dd64d387-7e23-4c0a-9d30-50702e83e1e7/scratchpad/estate-header.txt`
  and is shared verbatim with the Brainstorm-UI and relay fleets.

## Out of scope

- Server-side rendering or any other change making the SPA's content crawlable. Real, and the largest
  remaining signal, but a separate epic.
- PGP-signing the document (`Encryption`).
- 404ing extensionless unmatched paths — see the Decision.
- The `NosFabrica/Brainstorm-UI` fleet, the five strfry relays, and NIP-11 `contact`/`pubkey`
  enrichment. Same defect class, different repositories.
