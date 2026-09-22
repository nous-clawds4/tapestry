# PRD Seed: Site trust signals — saying who runs a deployment, and answering honestly

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/site-trust-signals/audit.md`
**Anchor:** the acceptance frame in `book.md`, written at intake on 2026-08-11 from the owner's
report and a probe of all 18 live hosts
**Confidence:** high on §3 and §6, which were checked against the diff and the live hosts during this
close. **Low on §1, §2 and §5**: this book answered a reputation incident, not a product question,
so the product framing below is inferred and should be read as a strawman.
**Date:** 2026-09-22

> A reverse-engineered baseline in PRD shape, built from what shipped. Every section is tagged
> `[FROM FRAME]`, `[INFERRED]`, or `[UNKNOWN — product input needed]`. **Read the confidence line
> above before adopting any of it.**

## 1. Product vision

`[FROM FRAME]` Every deployment should state, in the formats automated systems read, who operates it
and how to reach them. It should also answer honestly when asked for something that isn't there.
Then a reputation system or a security researcher can tell a deliberately operated family of sibling
sites from a bulk-generated clone farm. The trigger was concrete: safescan.io listed most of the
estate as unsafe, and a home-network filter blocked three hostnames (OPEN.md row 170).

`[INFERRED]` For a project whose value proposition is *trust*, looking untrustworthy to automated
infrastructure is a product problem, not only an ops one. The epic's "Why it matters" argues exactly
this.

`[UNKNOWN — product input needed]` Was the goal getting off specific lists (delisting, which is the
owner's act and whose status is unrecorded)? Or was it a standing trust posture for every deployment,
third-party forks included? The answer decides whether this work is finished.

## 2. Personas

`[INFERRED]` from the story's "As a…" line and from who reads these files. Behavior-based, and all
four are guesses:

- **The security researcher.** Has found something and needs a documented private channel. Before
  this book there was none.
- **The automated classifier.** Safe Browsing, SmartScreen, corporate proxies, home-router filters,
  list aggregators. Not a person. It reads `robots.txt` and `security.txt`, and watches how a site
  answers nonsense paths. The incident was about this persona.
- **The operator.** Keeps the claims true: sets `DOMAIN_NAME` and `ALLOW_INDEXING` per deployment,
  renews `Expires`, and updates the host list when a host is added or retired. This book created new
  obligations for this persona.
- **Developers' AI agents** (inferred from the queued llms.txt intake). The next likely reader of
  root-level documents on these hosts.

## 3. Scope (as-built)

`[FROM FRAME]`: shipped, and verified on all four live tapestry hosts:

- `security.txt` with contact, expiry, policy, a per-deployment `Canonical`, and an estate ownership
  attestation.
- `robots.txt`: production indexable; everything else not, by default.
- Genuine 404s for probe- and asset-shaped paths; deep links unchanged.
- `SECURITY.md` as the policy target.

`[FROM FRAME]`: explicitly **out**:

- the Product UI, relay and API fleets (other repositories);
- NIP-11 enrichment;
- crawlable content (SSR);
- PGP signing;
- the delisting request itself.

## 4. Domain model

`[INFERRED]` No Tapestry domain model was touched: no concept, no event kind, no POV. What the book
*did* introduce is a small operational model. It is worth naming because it now carries maintenance
obligations:

- **Deployment:** hostname, role (reference / pre-production / sandbox), and indexable (yes / no).
- **Estate inventory:** the list of official hostnames.
  - The canonical copy is `ECOSYSTEM.md` in NosFabrica/protocols.
  - Hand-maintained copies are this repo's `SECURITY.md` and `ESTATE_ATTESTATION`, the Brainstorm-UI
    attestation, and the relay configs.
  - Copies drift from the canonical list, and this close found live drift.
- **Root document:** a fixed-path file for machines (`security.txt` and `robots.txt`; `llms.txt`
  proposed), rendered per deployment from configuration.

## 5. Design rules (as-built)

`[INFERRED]` None of these were ever recorded as rules. They are read off ADR 0036, the review, and
row 175, and are candidates for ratification:

1. **Per-deployment facts come from configuration.** Never from a hostname comparison in shared
   code, and never from the request's `Host` header.
2. **Fail closed where the failure is public.** A new deployment is not indexable until someone opts
   it in.
3. **For a trust claim, absent beats wrong.** Omit `Canonical` rather than guess it. Claim "a current
   inventory" rather than completeness.
4. **Published factual claims must be true, not merely present.** The book learned this rule by
   shipping a false claim (row 175).
5. **Classify by shape, never by a copy of another system's inventory.** There is no server-side
   copy of the SPA route table.
6. **An expiry is a renewal alarm.** A date that turns the suite red is the reminder working, not a
   bug.

## 6. Carry-forward & open questions

Promoted from build audit §6:

- **The relay fleet** still answers `200` for every path and has no `security.txt`. **The API hosts**
  have no `security.txt`. No tracking was found for either, and these are the unfinished part of the
  original incident.
- **Estate host lists outside this repo** still name two retired hosts. One of them is the live
  attestation on `brainstorm.world`.
- **`security.txt` expires on 2027-08-11** on every fleet that copied it.
- **llms.txt** is the queued next document on the same plumbing.
- **The contentless SPA shell** is the largest reputation signal left.

## 7. What product must validate

- [ ] **Delisting, or a standing posture?** (§1) Has the delisting request been sent, and did it
      work? This decides whether the work is done from the owner's point of view, or only from the
      harness's.
- [ ] **Is the relay and API remainder in scope for the next phase?** It is the unfinished half of
      the original incident, but it lives in other repositories.
- [ ] **Who owns the estate inventory?** `ECOSYSTEM.md` is canonical, but hosts are added and retired
      from this repo. This close found the canonical copy wrong and a local copy right. It needs an
      owner and a trigger.
- [ ] **Should non-production hosts be visible to AI agents?** `robots.txt` `Disallow: /` hides them
      from crawlers by design. The llms.txt story must decide whether it also hides them from agents.
- [ ] **Is crawlable content worth building?** Server-side rendering or a pre-rendered landing page
      would be a much larger piece of work.
- [ ] **Are the personas in §2 real?** They are inferred from the incident and the story, not from
      research.
