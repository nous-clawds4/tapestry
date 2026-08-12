# Epic: site-trust-signals

**Created:** 2026-08-11
**Status:** Open

## Goal

**Make every Brainstorm host state, in machine-readable form, who operates it — and answer honestly
when asked for something that isn't there.** The estate is being classified as unsafe by reputation
scanners. The cause is not cosmetic: every host returns `200 text/html` for every path, serves ~400
bytes of contentless SPA boilerplate, and publishes no ownership or contact information anywhere.
Six sibling domains with that profile match the standard automated fingerprint for a bulk-generated
clone farm.

This epic realizes the acceptance frame of book
`engineering-team/audits/site-trust-signals/book.md`, for the six hosts served from this repo.

## Why it matters

The immediate trigger is safescan.io, which is a minor aggregator — its own site returns HTTP 521 and
it has essentially no public presence, so being on its list is probably not costing real traffic
today. The signals it reacts to are the same ones consumed by the reputation systems that *do*
matter (Safe Browsing, SmartScreen, corporate proxies, mail filters). A protocol project whose entire
value proposition is *trust* cannot afford to look untrustworthy to automated infrastructure.

Publishing `security.txt` is also plainly correct on its own merits: today a researcher who finds a
vulnerability in any Brainstorm deployment has no documented way to report it.

## Stories

1. `stories/site-trust-signals/1-security-txt-and-honest-404s.md` — RFC 9116 `security.txt` with
   per-host `Canonical` and the full-estate ownership attestation; a real `robots.txt` (production
   indexable, sandboxes `Disallow: /`); and a shape-based 404 rule ahead of the SPA catch-all so
   probe and asset paths stop returning 200. **Draft**.

## Key facts / guardrails

- **`Canonical` must be rendered per-host, never hardcoded.** RFC 9116 §2.5.2: if the retrieval URL
  doesn't match a `Canonical` entry, the file SHOULD NOT be trusted. One static file naming
  `tapestry.brainstorm.world` would be *invalid* on the other five hosts and on every third-party
  fork. Render it from `DOMAIN_NAME`, already wired through `docker-compose.yml:19` →
  `docker/entrypoint.sh:8`.
- **The 404 rule must be shape-based, not an allow-list of SPA routes.** The route tree in
  `ui/src/App.jsx` has 100+ entries and grows every sprint; an allow-list would drift and start
  404ing live pages. Deny by path shape (known probe/asset extensions, unhandled `/.well-known/*`)
  and let everything else fall through to the SPA.
- **Route params may legitimately contain dots.** `/pin/:dTag` and `/tag/:slug/:tagId` take
  user-authored values. The extension deny-list must be explicit and conservative, never a blanket
  "contains a dot" test.
- **`express.static` will not serve `.well-known`.** Dotfile paths are ignored by default, so the
  file cannot simply be dropped in `public/`. This is a second, independent reason the route must be
  explicit rather than static.
- **`Expires` is a renewal obligation.** RFC 9116 requires exactly one, ≤1 year out, and an expired
  file is treated as invalid — a stale `security.txt` is worse than none. Whatever ships must leave a
  durable reminder behind it.
- **Out of scope for every story here:** the `NosFabrica/Brainstorm-UI` fleet, the five strfry
  relays, NIP-11 enrichment, SSR/crawlable content, and the delisting request itself.
