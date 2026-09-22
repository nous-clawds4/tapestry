# Book of Work: llms.txt on the tapestry fleet

**Slug:** llms-txt
**Status:** Open
**Opened:** 2026-09-22
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD).** Estate-wide tracking: [NosFabrica/protocols#6](https://github.com/NosFabrica/protocols/issues/6). An agent fetching `<host>/llms.txt` should be routed on the first hop to the normative specs, `CONCEPTS.md`, and `ECOSYSTEM.md` in `NosFabrica/protocols`, plus this repo's own top-level orientation docs. Honest caveat carried from the estate issue: no major crawler commits to consuming `llms.txt` — this is cheap insurance plus a deliberate-agent affordance, not SEO. This book covers the **tapestry fleet only** (the four hosts served from this repo); the Product UI, relay, and API fleets are tracked in the same estate issue but live in other repositories.

This book follows directly on `site-trust-signals` (Closed 2026-09-22): `llms.txt` is a third exact-match root document through the same `src/utils/siteTrust.js` plumbing that already serves `security.txt` and `robots.txt`. A fresh epic/book rather than reopening `site-trust-signals`, so that book's audit stays a closed, as-built record.

### Acceptance frame

- [ ] All four tapestry-fleet hosts serve `/llms.txt` as `text/plain; charset=utf-8`, following the [llmstxt.org](https://llmstxt.org/) format.
- [ ] Content is a pointer manifest only — links into `NosFabrica/protocols` and this repo's own top-level docs — never a duplicate of their text (the estate discrepancy rule: `ECOSYSTEM.md` is canonical, `llms.txt` only points).
- [ ] Every linked URL resolves (verified at ship time, and re-verified at the same renewal ritual that owns the `security.txt` `Expires` check, OPEN.md row 172).
- [ ] `/llms.txt` is reachable on the three non-production hosts despite their `robots.txt: Disallow: /` — a targeted `Allow: /llms.txt` exemption, not a blanket indexing change.
- [ ] Honest 404s and every other `site-trust-signals` behavior are unaffected.
- [ ] Verified live on all four hosts after deploy.

## Epics in this book
- `llms-txt` — serve `llms.txt` across the tapestry fleet.

## Related work outside this book
Tracked in [NosFabrica/protocols#6](https://github.com/NosFabrica/protocols/issues/6), not governed by this harness (different repositories):

| Fleet | Hosts | Repo |
|---|---|---|
| Product UI | brainstorm.world, brainstorm.nosfabrica.com, brainstorm-staging.nosfabrica.com | `NosFabrica/Brainstorm-UI` |
| Relays | scores., nip85., dcosl.brainstorm.world; nip85., nip85-staging.nosfabrica.com | `NosFabrica/brainstorm-k8s` + 2 standalone droplets |
| Backend APIs | api., search.brainstorm.world; brainstormserver(-staging).nosfabrica.com | `NosFabrica/brainstorm_server` |

No ordering dependency, but shipping all fleets near-together keeps the estate's root-document story consistent.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/llms-txt/audit.md`
- Product feedback: `engineering-team/audits/llms-txt/prd-seed.md`
