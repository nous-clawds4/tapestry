# PRD Seed: Choosing what a search engine indexes, in protocol

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/search-index-selection/audit.md`
**Anchor:** acceptance frame in `engineering-team/audits/search-index-selection/book.md`
(settled at the 2026-09-18 design debate; the long form is `docs/SEARCH_INDEX_DLIST_SELECTION.md` rev 3)
**Confidence:** medium-high on §§1–5 (a real frame, a live deployment, five reviewed stories);
low on §6–7's product judgements, which no one has yet made.
**Date:** 2026-09-23

> This is a **reverse-engineered baseline** in the product-team PRD shape, built from what shipped.
> It is a *strawman for the product team*, not a ratified spec. Sections are tagged `[FROM FRAME]`
> (grounded in the kickoff acceptance frame), `[INFERRED]` (read off the as-built system), or
> `[UNKNOWN — product input needed]`. Adopt it as the starting point for `/discover` on the next
> phase and validate each section.

---

## 1. Product vision

`[FROM FRAME]` **A curator says, in protocol, which collections are worth putting in front of
people — and a search engine obeys, without anyone editing the engine.**

The thing that makes this worth building is a single decision: **the consumer reads exactly one
list, forever.** A search backend subscribes to one address and never changes. Everything about
*how* that list was decided — one person's picks, a committee's, a trust score's — sits behind that
interface and can be replaced at will. The backend is written once; every later loosening of who
gets a say is a change to the pipeline, not to the thing reading it.

`[INFERRED]` The underlying problem, never stated in one place but implied everywhere: today the
only ways to decide what an engine indexes are a config file (one operator's opinion, frozen, needs
a deploy to change) or an allowlist (a permission check wearing a trust costume). Both make the
operator the bottleneck and neither survives being opened up to more than one curator.

`[FROM FRAME]` Day one is deliberately the smallest possible version: **one curator, one collection,
one guarantee** — "these are the ones *I* said, and only I can say things as me."

## 2. Personas

`[INFERRED]` — from the stories' "As a…" lines and the shipped surfaces. All behaviour-based; none
validated with a real person.

- **The curator** (the story protagonist in 4 of 5 stories). Signed in, already uses tags and pins,
  is willing to make a public claim under their own key. Wants: to nominate a collection; to be sure
  the resulting list contains *exactly* what they nominated and nothing a stranger slipped in; to run
  one strict list beside their ordinary, looser ones without re-tuning everything.
- **The search-backend integrator** (a different repo, possibly a different team). Wants one address
  and a stable shape. Never wants to know how the set was produced. **Has not been observed using the
  system** — the integration has not happened yet (see §6).
- **The instance operator.** Owns the deployment-wide defaults. After this book their dial is the
  *fallback for pins that don't choose* rather than the only control — a demotion the UI now states
  honestly.
- `[UNKNOWN]` **The end user of the search engine.** Nobody in this book represents them. Every
  risk the design *accepted* rather than solved — two hundred tabs, a legitimate ten-million-item
  collection — lands on this persona, and no one has modelled them.

## 3. Scope (as-built)

`[FROM FRAME]` / `[INFERRED]` What is live on tags.brainstorm.world as of 2026-09-22:

1. **Nominate a collection.** A signed-in curator can tag a Decentralized List *itself* (not its
   items) from its page. The nomination points at the list's stable address, so editing the list
   does not orphan it. Tagged collections render by name and description, grouped under "Lists".
   *Limit:* only modern (addressable) lists — 32 legacy ones on the local corpus show no affordance
   at all, by design, because a nomination of them could not be resolved.
2. **"Only me" curation.** In the curation dialog, a **Trust scope** choice: *My web of trust*
   (today's behaviour) or *Only me*. Under "Only me" the published list contains exactly what the
   curator nominated — certain, because only they can sign as themselves. The published list *says*
   it is self-curated, so a consumer can tell without fetching anything else.
3. **Per-pin curation.** Each pin carries its own membership method instead of inheriting one
   deployment-wide dial, so a strict list can live beside ordinary ones. Every published list now
   names the method that actually ran.
4. **A confirm step before the first pin.** Pinning used to sign and publish four events in one
   click, with the curation visible only afterwards. Now the settings appear first, editable, in the
   same single gesture — cancel publishes nothing. (The one-gesture training value was explicitly
   protected: there is never a "now also create a list" second step.)
5. **Recipes — several curations of one tag.** A curator can hold more than one pin of the same tag,
   distinguished by a name they choose ("search-index") rather than by pretending the pin is about a
   community. Recipes appear in a separate band ("Your curations") with their own glyph; communities
   keep theirs. A name already in use is refused **before anything is signed**, because two pins at
   one address would silently replace each other.
6. **Protections that are not user-visible until they matter.** A pin claiming to speak for someone
   else's point of view is refused and any list it previously published is withdrawn with a visible
   "retracted" status. Two of a curator's own pins colliding on one address freeze rather than
   overwrite.

**Explicitly out of scope in this phase** `[FROM FRAME]`: widening who counts beyond "me"; a picker
for a curator list; self-attested curator sets scored by trust; per-engine configuration; treating
field types as data. All are staged in the design doc, not lost.

## 4. Domain model

`[INFERRED]` from the concepts and stored shapes the build touched.

| Entity | Identity | Attributes that matter | Relationships |
|---|---|---|---|
| **Collection (Decentralized List)** | a stable address (`39998:<author>:<name>`) | name, description, item schema | has items; **can itself be nominated** — the key modelling move of this phase: "header" and "item" are *roles*, not types |
| **Nomination (tagging)** | who signed it + what it points at | the tag applied; a stance that can be retracted or disputed | points at a collection *or* an item *or* a note *or* a person |
| **Pin (a curation)** | tag × curator × **variant** | trust scope (`me` / `my web of trust`), membership method, cutoff, which kinds of thing to include | produces the published list(s); a *variant* is either a **place** (a community) or a **recipe** (a name the curator chose) |
| **Published list (Trusted List)** | a permanent address derived from the pin | its members; and, new in this phase, **self-description**: which trust scope and which method produced it | the single thing a consumer subscribes to |
| **Instance default** | the deployment | the fallback membership method | applies only to pins that don't choose |

The load-bearing distinction the phase introduced: **identity vs scoring.** A variant decides *which
list this is* (and therefore its permanent address); the curation decides *what goes in it*. They
were conflated before — the only way to hold a second curation was to claim it was about a
community. `[INFERRED]` This split is what makes everything downstream possible, and it is also the
source of the unfinished UX (§6): a place and a recipe are different *kinds of thing* now shown in
one row.

## 5. Design rules (as-built)

`[INFERRED]` — read off the shipped UI and the review record; flagged where no rule was recorded.

- **Nothing is published on the user's behalf without being shown first.** The book's newest rule,
  and a reversal of an earlier decision (ADR 0016 removed this same interstitial as friction). The
  premise that justified removing it — the defaults matched what you were already looking at —
  expired once the curation grew fields you cannot see.
- **One gesture, not two.** The confirm step is an *interstitial*, never a second step. Cancel
  publishes nothing at all.
- **Refuse before signing, never after.** Anything that would collide on an address is refused in
  the dialog with a message naming the conflict, because a signed collision destroys the earlier
  thing rather than duplicating it.
- **Absent means today.** Every new setting is additive: a curation that omits it behaves exactly as
  before, byte for byte. Editing an old pin never silently adds a setting to it.
- **A published list is self-describing.** A consumer must be able to tell how a list was made by
  reading the list — not by fetching the curator's settings, which may not even be on their relay.
- **A recipe is never rendered as a place.** Separate band, separate glyph, separate creation path
  (recipes come from the curation dialog; communities from the community picker). `[INFERRED]` This
  is the *minimum* honouring of a warning the design doc raised; the real rule has not been written.
- `[UNKNOWN]` No recorded rule for: how a recipe is *labelled* (its human name is accepted and then
  discarded — the switcher shows the slug); what a curator sees while a list is being recomputed
  (switching to "Only me" changes nothing visible until the next refresh, which a reviewer flagged
  as readable-as-broken); or how many recipes is too many.

## 6. Carry-forward & open questions

Promoted from build audit §6. The first is different in kind from the rest — it is the one act that
converts everything built into something a user experiences.

1. **Nobody has published the actual list yet.** All five mechanisms are live; the day-one
   deliverable — the "worth indexing" tag exists, the GitHub Accounts collection is nominated, the
   resulting list is at a known address — has not been demonstrated end to end. It needs no code.
   It needs a **naming decision** (§7).
2. **The places-vs-recipes information architecture.** Shipped: one divider and one glyph, with the
   ordering hard-coded in two screens. Owed: a deliberate round covering the tag page, the pins page
   and the pinned panel together. The design doc's own words: *"a community context is a place, an
   arbitrary curation variant is a saved recipe; putting recipes in the same chip row as places is
   what would make it incomprehensible."*
3. **Rung 2 — "what my curators nominated."** Deliberately staged as a *wider value on the field
   rung 1 introduced*, not a new mechanism. Needs a picker for choosing the curator list, and it
   needs the search engine to be able to render collections it has never seen.
4. **Rung 3 — "what the trusted crowd nominated."** Needs generic presentation *and* budgets. The
   design doc accepts two unsolved risks here rather than designing around them: a trusted curator
   can point at a legitimate ten-million-item collection, and forty curators produce a search UI with
   two hundred tabs. Both are presentation/ranking problems that no trust filter answers.
5. **Read the tab label and schema off the nominated collection** (design doc "Part 1b", marked
   *now*, not built). It is the prerequisite that lets the engine handle a collection it has not been
   taught about — i.e. it is what actually unlocks 3 and 4.
6. **Per-engine configuration** (design doc Part 2) — priority, refresh cadence, ranking boost:
   things the *engine operator* believes about a collection, as opposed to what the collection's
   curator declares. Deliberately deferred until a second engine exists.
7. **Field types as data** (design doc Part 3) — portable actions rather than portable rendering.
   Waits on separate spec work.
8. **A cross-instance hazard that is product-visible** (OPEN 316). A pin scoped to a community is
   stamped with *the instance's* key. Mirror that pin onto another instance and it stops being
   recognisable as a community pin there — and, since this phase made collisions explicit, it now
   **collides with and freezes the curator's ordinary list on the mirroring instance**. Before this
   phase the two silently overwrote each other every cycle, so the change is an improvement in
   honesty, not a regression — but the user-visible symptom ("my list stopped updating, on an
   instance I don't control") is new and has no product answer yet. Three fix shapes exist; all are
   protocol decisions, not UI ones.
9. Smaller, tracked: legacy collections cannot be nominated at all (OPEN 308); a curator's
   human-readable recipe name is discarded; an assistant cannot yet pin on its principal's behalf
   (OPEN 312); the test tier that would prove the live behaviour cannot run at production corpus
   size (OPEN 314/315).

## 7. What product must validate

- [ ] **Name the tag, and decide who owns it.** `worth-indexing-for-search` is the working name.
      Two product judgements, both `[UNKNOWN]`: (a) the design doc argues the narrower name will age
      badly — an archiver or a mirror wants the same signal — so something like **`worth-indexing`**
      with the nuance carried in the human-readable name may be right; (b) **whoever authors the tag
      owns the namespace every participant's nominations land in**, so if this is meant to be a
      shared convention it should be authored under a well-known key and published as a concept.
      Re-parenting it later is an epic. *This decision is the only thing blocking §6 item 1.*
- [ ] **Decide whether the search-backend integrator is a real customer now or a hypothesis.** The
      entire architecture is justified by "the consumer is written once and never changes" — a claim
      no consumer has yet tested. Validate the contract with the other repo before building rung 2 on
      top of it.
- [ ] **Own the places-vs-recipes IA round** (§6 item 2) as a design task, not an engineering one.
      The engineering side has deliberately stopped at the minimum and flagged it twice.
- [ ] **Decide what a curator is promised about recipes.** How many? Named how? Discoverable by
      anyone else, or private working state? Today a recipe is labelled by its slug and its friendly
      name is thrown away — nobody decided that; it fell out of the wire format.
- [ ] **Decide the relaxation trigger.** Rung 1 is a *capability-matched guard*: it is strict because
      the engine can only render one collection today. The rule that says when to move to rung 2 is
      therefore a statement about the engine's presentation capability, not about trust. Nobody owns
      that statement yet.
- [ ] **Decide who represents the end user.** §2 flags the gap: the two risks the design explicitly
      accepted (resource bounds, tab proliferation) are entirely theirs, and the accepted-risk note
      predicts tab proliferation "is likely to gate relaxation harder than spam does."
- [ ] **Rule on the cross-instance stamp** (§6 item 8) — whether a community pin is meant to be
      portable across instances at all. That answer decides which of the three fix shapes is right.
