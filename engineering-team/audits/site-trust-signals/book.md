# Book of Work: Site trust signals

**Slug:** site-trust-signals
**Status:** Open
**Opened:** 2026-08-11
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD).** The owner reported that safescan.io has placed most of the
`*.brainstorm.world` estate on a list of unsafe URLs, and suspected the cause was that the
instances "look like clones of each other." Investigation on 2026-08-11 confirmed a concrete,
shared root cause across the whole estate rather than a cosmetic resemblance:

- Every host returns **200 + HTML for every path** — `/robots.txt`, `/.well-known/security.txt`,
  `/.env`, and arbitrary nonsense paths all yield the SPA shell. Nothing ever 404s.
- The served HTML is a contentless SPA boilerplate (~400 bytes), so crawlers see no distinguishing
  text on any host.
- `tapestry.brainstorm.world` and `staging.brainstorm.world` are byte-identical at the root.
- No host carries any machine-readable ownership or contact information.

That combination is close to the standard automated fingerprint for a bulk-generated clone/phishing
farm. This book covers the **tapestry fleet only** (the six droplets served from this repo). The
same defect exists in `NosFabrica/Brainstorm-UI` (`try_files … /index.html`) and on the five strfry
relays; those are tracked outside this harness because they live in other repositories — see
"Related work outside this book" below.

### Acceptance frame

- [ ] All six tapestry-fleet hosts serve a valid RFC 9116 `/.well-known/security.txt` as
      `text/plain; charset=utf-8`, with `Canonical` rendered for the requesting host.
- [ ] The file carries the full-estate ownership attestation, so a reviewer can see the six hosts
      are deliberately-operated siblings rather than anonymous clones.
- [ ] All six serve a real `robots.txt`: production indexable, the five non-production hosts
      `Disallow: /`.
- [ ] Probe and asset-shaped paths (`/.env`, `/wp-login.php`, unhandled `/.well-known/*`) return a
      genuine **404**, while every existing SPA deep link still resolves through client-side routing.
- [ ] `SECURITY.md` exists in the repo and is the target of the `Policy:` field.
- [ ] Verified live on all six hosts after deploy.

## Epics in this book
- `site-trust-signals` — security.txt, robots.txt, and honest 404s across the tapestry fleet.

## Related work outside this book
Tracked in the same session, but not governed by this harness (different repositories):

| Fleet | Hosts | Repo | Defect |
|---|---|---|---|
| Product UI | brainstorm.world, brainstorm.nosfabrica.com, brainstorm-staging.nosfabrica.com | `NosFabrica/Brainstorm-UI` | `nginx.conf:16` SPA fallback |
| Relays | scores., nip85., dcosl.brainstorm.world, nip85., nip85-staging.nosfabrica.com | `NosFabrica/brainstorm-k8s` + 2 standalone droplets | strfry landing page for every path; NIP-11 `contact`/`pubkey` unset |

Backend APIs (`api.brainstorm.world`, `search.brainstorm.world`, `brainstormserver*.nosfabrica.com`)
already return correct 404s and need only a `security.txt`.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/site-trust-signals/audit.md`
- Product feedback: `engineering-team/audits/site-trust-signals/prd-seed.md`
