# PRD Seed: Outbound-request safety for user-supplied hostnames

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/nip05-ssrf-guard/audit.md`
**Anchor:** acceptance frame in `book.md` (itself from the verbatim 2026-05-17 `_intake.md` entry)
**Confidence:** high on §3 and §6 (checkable against the diff); **low on §1, §2 and §5** — this book
fixed a defect, it never asked a product question, so the product framing below is genuinely
inferred and should be treated as a strawman.
**Date:** 2026-09-20

> A reverse-engineered baseline in PRD shape, built from what shipped. Every section is tagged
> `[FROM FRAME]`, `[INFERRED]`, or `[UNKNOWN — product input needed]`. **Read the confidence line
> above before adopting any of it.** A security fix is the *least* PRD-shaped kind of work there is;
> §3 and §6 are solid and the rest is a hypothesis.

## 1. Product vision

`[INFERRED]` Brainstorm instances are operated by individuals, often self-hosted, and they accept
arbitrary input from strangers — anyone can type a NIP-05 identifier into a public search box. The
implicit product promise underneath this book: **an instance does not become a tool pointed at its
own operator's network by someone who simply typed into it.** The operator should not have to think
about that, and nothing in the UI should have to explain it.

`[UNKNOWN — product input needed]` Whether outbound-request safety is meant to be a *stated*
property of a Brainstorm instance — something an operator can point at when deciding to self-host —
or an invisible implementation quality. That choice decides whether any of this is ever surfaced.

## 2. Personas

`[INFERRED]` from the story's "As a…" line and the three call sites' reachability. Behaviour-based,
and all three are guesses about who is actually affected:

- **The self-hosting operator** — runs an instance on a home or office network where private
  addresses reach real devices. Never sees this feature; is the person it protects. The one whose
  exposure is highest and whose awareness is lowest.
- **The anonymous searcher** — unauthenticated, types identifiers into public search. Supplies the
  input. Should see no difference for any legitimate identifier.
- **The instance owner doing admin work** — resolves identifiers when adding admins; owner-gated,
  so lowest exposure, but was found to share the same code path.

## 3. Scope (as-built)

`[FROM FRAME]` — shipped and verified:

- Every NIP-05 verification path classifies its target before making a request, and refuses
  loopback, private, CGNAT, link-local, documentation, benchmarking, multicast and reserved
  destinations, plus names under private suffixes.
- One shared decision point, so the three call sites cannot drift apart.
- Fails closed: unresolvable, resolver error, empty answer and malformed input all refuse, and a
  refusal is indistinguishable to the caller from any other failed lookup.
- Redirects are not followed on these requests.
- Every contract visible to a user or client is unchanged.

`[FROM FRAME]` — explicitly **out**, each with a ledger row: rate limiting; DNS-rebinding;
consolidating the three duplicated verification functions.

## 4. Domain model

`[INFERRED]` **No domain model was touched, and that is the fact worth carrying forward.** No
concept handle, no event kind, no stored shape, no POV, no trust signal. This book sits entirely
below Tapestry's domain layer — which is why none of CLAUDE.md's four architecture invariants
applied to it. A future phase should not go looking for a concept here.

## 5. Design rules (as-built)

`[INFERRED]` — no design rule was ever recorded for this; these are read off the code and the gate
decisions, and are candidates for ratification, not established rules:

1. **Classify the destination, not the spelling.** Resolve using the same resolver the request will
   use, then judge the answer. This is what makes octal / hex / decimal / short-form / `nip.io`
   encodings non-issues rather than a list of cases to patch.
2. **Fail closed, and make refusal indistinguishable.** A refused lookup returns exactly what a
   failed lookup returns. No new error code, no new UI state, nothing for a caller to branch on —
   and nothing that tells a prober *why* it was refused.
3. **One decision point per question.** Three copies of a fetch are tolerable; three copies of a
   *security judgement* are not.
4. **When a safety choice trades against a legitimate use, surface the trade rather than absorbing
   it.** The redirect decision cost real functionality; it went to the operator with three options
   and the cost written down, and the accepted cost is now a ledger row instead of a surprise.

## 6. Carry-forward & open questions

Promoted from build audit §6:

- Redirects are no longer followed — a legitimate domain serving `/.well-known/nostr.json` behind a
  redirect stops verifying. **This is the one item here with a user-visible product consequence**,
  and the one most likely to generate a report that does not look like a redirect problem.
- No endpoint in the repo is rate-limited, and there is no pattern to follow. Needs its own story
  and ADR.
- DNS rebinding remains open; closing it means taking on `undici` as a direct dependency.
- OPEN.md row 148 (`assistant-profile` #3) can now reuse the shipped predicates.
- Production promotion is pending; this is live on staging only.

## 7. What product must validate

- [ ] **Is outbound-request safety a stated property or an invisible one?** (§1) Decides whether it
      is ever documented for operators or stays an implementation detail.
- [ ] **Is the redirect trade the right one?** (§6) It was ratified as an engineering gate decision
      by the operator, on a security argument. It has a product cost — some legitimate domains stop
      verifying, silently. Worth a deliberate product look, not because the decision was wrong but
      because it was made in a security frame and its cost lands in a product frame.
- [ ] **Should a refused lookup ever be distinguishable to the operator?** (§5 rule 2) Today an
      operator debugging "why won't my NIP-05 verify" sees the same `verified: false` for a refusal
      as for a typo. Indistinguishability is right for a *prober*; it may be wrong for the person
      who owns the instance. A server-side log line would split the difference — none exists today.
- [ ] **Are the three personas in §2 real?** They are inferred from code reachability, not research.
- [ ] **Does "no domain model touched" (§4) hold for the follow-ups?** Rate limiting in particular
      may need a POV-aware or WoT-derived notion of who is being limited, which *would* pull it into
      the domain layer and make it a genuinely different kind of work from this book.
