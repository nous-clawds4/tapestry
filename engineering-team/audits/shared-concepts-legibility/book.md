# Book of Work: Shared Concepts legibility — can a user tell what they have already shared?

**Slug:** shared-concepts-legibility
**Status:** Closed
**Opened:** 2026-08-09
**Closed:** 2026-08-10

## Intent anchor

**Acceptance frame (no PRD)** — restated from the owner's cat-breed walkthrough and confirmed in-session 2026-08-09.

### The driving user story

Four Tapestry instances. **Stacie** (staging) is a veterinarian and the only one whose graph holds a cat-breed concept. **Nous** (local), **Tom** (production), and **Ark** (a fourth local instance) want to benefit from her expertise. Stacie wants to offer her concept to the community so the other three can help build and maintain the list of breeds.

The walkthrough stalled on the first question: *how does she tell whether she has already done that?* The owner — who built the feature — could not answer it from the UI. That is this book's problem.

Live state at kickoff, verified: staging's `cat-breed` header carries no b-tag (never submitted), while its `bengal-cat` header *is* self-declared and live on the community relay. So the instance had shared exactly one thing, and it was not the one the owner meant — and nothing on screen said so.

### Acceptance frame

- [x] From the concept page she lands on, Stacie can tell whether she has already shared that concept — **without clicking anything**.
- [x] She can see, in one place, **every concept her own instance has offered** to the community.
- [x] Where "offered locally" and "reached the community" can differ, the surfaces **say which one they are showing**.
- [x] The words on these surfaces **distinguish offering, adopting, and cataloguing**.

### Scope notes

- The owner is using the user story as the prioritization instrument and **expects walking it further to surface more work**. The frame is deliberately outcome-shaped rather than a story list, so additions that serve these four bullets belong in this book rather than forcing a successor.
- **`seeding-path` is not in the frame yet.** **Correction 2026-08-10 (owner `/discuss`):** an earlier draft of this line said there was *no way* to offer a concept nobody else uses. **That was wrong** — the capability has always existed in two places: the concept page's `Submit as a Shared Concept` button, and the same button inside the Concepts-list disposition panel. Both run `declareAndBroadcast` → `POST /api/concept/:handle/self-declare`, which appends the self-pointing b, publishes to local strfry and imports to Neo4j (`selfDeclare.js:97,105`), after which the browser broadcasts to `wss://dcosl.brainstorm.world`. What is demand-gated is only the Adoption Queue's *nomination* view — so nothing ever **suggests** an unused concept. The gap is discovery, not capability, and the two must not be conflated again.

  The demand gate itself: "Mine to publish" is gated on cross-author demand, which the expert-seeding case by definition lacks (`publishCandidates: 0` on staging while `cat-breed` sat undispositioned). Its fix shape depends on a product decision — is the concept page the seeding entry point, or does the Adoption Queue get a third view? — that wants a `/discuss`. It joins this book if that discussion says the concept page carries it; otherwise it brackets separately.
- **Out of scope, parked:** the TA ↔ owner two-way handshake (`_intake.md` 2026-08-09). Related — every Author column in this area shows a robot the viewer cannot attribute — but it is a wire-format question and the owner explicitly deferred it.
- **Independent of** the registry's Neo4j-read / materialization arc (`registry-reads-graph` → `materialization-writers` → `registry-sets-and-provenance`), which is queued behind this book. The one adjacency: `disposition-filter-on-concepts` and `registry-reads-graph` touch neighbouring queries.

## Epics in this book
- `shared-concepts-legibility` — the surfaces that answer "what have I already shared?"

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** high

## Close artifacts
- Build audit: `engineering-team/audits/shared-concepts-legibility/audit.md`
- Product feedback: `engineering-team/audits/shared-concepts-legibility/prd-seed.md`
