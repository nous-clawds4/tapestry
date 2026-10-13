# PRD Seed: Duty Menus and Self-Maps — what an Assistant offers, and what it is doing

**Mode:** reconstructed from as-built *(no prior PRD)*; a docs-mode book whose as-built is protocol specs
**Build audit:** `engineering-team/audits/duty-menus-and-self-maps/audit.md`
**Anchor:** the acceptance frame in `book.md` (confirmed at kickoff, 2026-10-10; bullets 5 and 6 added by the owner),
with its scoping capture `docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md` (decisions D1–D10)
**Confidence:** high for scope (every frame bullet traces to a passing story, and the owner approved every gate; the
questions the book leaves open are in § 6); medium for personas and the problem statement (read off the stories' "As an implementer" lines and
the handoff, never stated as product); low for adoption outside this repo (no one else has read the drafts yet)
**Date:** 2026-10-13

> This is a **reverse-engineered baseline** in the product-team PRD shape, built from what shipped. It is a strawman for
> the product team, not a ratified spec. Sections are tagged `[FROM FRAME]`, `[INFERRED]` or `[UNKNOWN — product input
> needed]`. Recommendations below are input, not decisions.

## 1. Product vision

`[FROM FRAME]` A person picks Assistants to publish insights for them (scores, lists, concept curation) in their
Treasure Map. For that to work across instances, two things must be public and readable by anyone:
- **What an Assistant offers, and where** (its **Duty Menu**): the duties it is willing to take on, each at the relay
  where it would publish them.
- **What an Assistant is actually doing** (its **self-Map**): the duties it is publishing now.

With both, any instance or client can fill in the relay for an Assistant it doesn't run, show what each Assistant
offers, list the providers a community trusts, and tell whether a backup Assistant is live.

`[INFERRED]` The problem it answers: the `/treasure-map` page writes an empty relay for any Assistant it doesn't
run, which breaks readers (ledger row `2026-10-10-external-assistant-relay-left-empty`, still open: § 6), and before
these specs nothing said whether a listed backup was actually publishing.

`[UNKNOWN — product input needed]` Whether the long-term goal is a marketplace of Assistant providers across
communities, or mainly correct plumbing between instances that already know each other.

## 2. Personas

- `[FROM FRAME]` **Implementers.** Every story is written for an implementer: of a Tapestry or Brainstorm instance, of
  another NIP-85 provider, of an Assistant service, or of a Treasure Map, Duty Menu or Trusted List reader. They need
  one rule per question, so that independent clients agree.
- `[INFERRED]` **The person choosing Assistants** (the observer). They write a Treasure Map, pick a Preferred
  Assistant and Alternates for each kind of insight, and want to know which Assistants offer what, and whether a backup
  is ready.
- `[INFERRED]` **An Assistant provider.** Runs one or more Assistant keys: a Tapestry instance's TA and per-customer
  keys, or an outside service such as a web-of-trust scorer. Publishes a storefront menu (and per-customer menus) and
  keeps a self-Map true.
- `[FROM FRAME]` **Nous.** Publishes the one shared Duty Menu header that every menu points at. `[UNKNOWN]` who
  operates Nous' key, and when the header goes live (it is not yet published).
- `[INFERRED]` **A community** whose members' choices form a provider directory, read per point of view.

## 3. Scope (as-built)

All of it is protocol text in `protocols/drafts/`; none of it is code. `[FROM FRAME]` unless marked.
- **The self-pointing `b`** (Inherit-From § "The `b` tag"; Shared Concepts § Declared affiliation). A header whose `b`
  names itself offers itself as a shared concept for others to affiliate with. It is not deference and carries no
  aggregation weight. Nous' Duty Menu header uses it.
- **Duty Menus** (`duty-menus.md`, new, pre-NIP):
  - one kind-39999 menu item per Assistant key, under Nous' shared header, signed by that key;
  - rows: `duty` (offered, with its relay) and `not-offered` (exceptions); no price or tier;
  - a `storefront` marker for the provider's main menu; per-customer menus may link to it;
  - how a reader finds a key's menu (three places), what counts as a menu, and how any Treasure Map key resolves
    against it;
  - a menu is a hint, never a gate, and never says a duty is *active*;
  - a provider directory, read per point of view (non-normative).
- **Self-Maps** (Treasure Maps § 9.2): an Assistant's own Treasure Map entries report what it is publishing now. They
  create no duty, never count as anyone's choice, and tell a reader whether an Alternate is a ready standby.
- **Finding an insight** (Treasure Maps § 3). The relay in a Map is a hint. When the insight is not there, a reader
  looks at the Assistant's self-Map, then its Duty Menu, then its kind 10002 write relays.
- **One key grammar** (Treasure Maps §§ 4.3–4.6, 6). It says what every Concept, category-`39998` and profile key
  matches, and which key wins.
- **Keeping a self-Map true** (Treasure Maps § 9.2; Assistant Designation § Curation copies; Trusted Lists). When an
  Assistant stops, its curation copies stay. Removing a self-entry is not by itself a stop. A List still maintained is
  never marked retracted, and a marked List is never read as a copy.
- `[FROM FRAME]` **Out of scope:** code. Publishing menus and self-Maps, the `/treasure-map` changes and the
  empty-relay fix are a separate book.

## 4. Domain model

`[INFERRED]` from the specs and ADRs `duty-menus-and-self-maps/0001`–`0005`:
- **Assistant key.** A pubkey that publishes insights for observers. It may be a provider's main key (a
  **storefront**) or a per-customer key.
- **Duty Menu header.** `39998:<Nous>:duty-menu`, a self-declared shared Concept header.
- **Duty Menu.** A kind-39999 item at `d` `duty-menu`, signed by the Assistant key, with one `p` naming itself and Nous'
  `z`. It holds `duty` rows (Treasure Map key, relay) and `not-offered` rows (key), and a `storefront` marker when it is
  the main menu.
- **Treasure Map.** A person's kind 10040: entries of (key, provider, relay hint), with a Preferred provider and
  Alternates per key.
- **Self-entry and self-Map.** An entry whose provider is the Map's own author, and the Map that holds them.
- **Insight.** A score, list or concept item an Assistant publishes, matched to Map keys by the key grammar.
- **List retraction marker.** On a List no longer maintained at its `d`. Never on a maintained List.
- **Curation copy.** A copy an Assistant makes to curate a list. It stays when curation stops.
- **Observer / point of view.** Every reading (which provider counts, the directory) is per observer.
- `[INFERRED]` **Concept-graph impact:** none. No concept or firmware definition changed.

## 5. Design rules (as-built)

`[INFERRED]` from the specs' principles and the reviews:
- **Offered is not active.** A menu says what an Assistant would do; only its self-Map says what it is doing.
- **A hint, never a gate.** A menu or a relay hint never stops a reader or a writer; anyone may publish (decentralized,
  filter at read time).
- **Never guess a relay.** An entry with no answering menu row carries no relay, rather than a made-up one.
- **Per point of view.** The directory, counting and trust are read per observer; no global list.
- **One rule in one place.** Each wire fact is normative in exactly one spec, and the others point at it.
- **No "canonical" or "consensus"** in text the book wrote (handoff D2 of the NIP reorg).
- `[UNKNOWN — product input needed]` No user-facing design rules: the book shipped no screen. The pages that show menus
  and self-Maps come from the code books.

## 6. Carry-forward & open questions

Promoted from the build audit §6.

**The next book: the code the frame named.** Its intake entry is "2026-10-11 — Duty Menus and Self-Maps in code"
(`engineering-team/stories/_intake.md`). Parts are built or underway:
- book `assistant-duty-menu` (closed) publishes and reads Duty Menus, with a hub page;
- book `assistant-duties-settings` (closed) lets the Owner set the duties;
- book `assistant-self-map` (open) builds self-Maps and Your Assistant's Treasure Map.

Still open:
- the `/treasure-map` element-3 fill and the "Make preferred" swap;
- the read-time fallback in readers;
- the relay reconciliation;
- the empty-relay bug;
- shipped readers that take Concept keys otherwise than the settled grammar;
- NosFabrica adoption (handoff Q6);
- Nous publishing the header.

**A docs pass after this book** (the owner's choice):
- whether a bare `39998` entry names a person's TA, and whether it asks for curation of a list;
- Treasure Maps § 13 question 13 (does an Alternate entry for a list ask that Assistant to curate it?), which stays on
  ledger row `2026-10-12-bare-39998-ta-discovery`;
- "addressable" in Spawning and Content Categories;
- five wording items from story 5's review.

**Open protocol questions:**
- private duties, in menus and in self-Maps (handoff Q4);
- whether a per-customer key whose offers match its storefront may skip its own menu;
- how a non-personalized provider's single key fits the storefront rules;
- a key for one Tag in every category.

**Never tracked** (decide whether to pursue):
- an upstream NIP-85 proposal;
- a worked example of the provider directory, once one exists;
- whose view an instance's own Assistant carries;
- expiry (NIP-40) on a Map with no self-entry;
- how long a self-Map may lag;
- people who serve as their own Assistant.

## 7. What product must validate

- [ ] **Who the providers are.** Is the target an open market of outside Assistant services, or this network's own
      instances? It decides how much the storefront and directory matter.
- [ ] **Whether people should see "offered" vs "active".** If so, how: a badge on each Assistant, a "Standby ready"
      mark on backups, or only the Treasure Map page.
- [ ] **The provider directory.** Is a per-community list of trusted providers wanted, and where would it live?
- [ ] **Private duties.** Should a person be able to give an Assistant a duty no one else can see (handoff Q4)?
- [ ] **Who runs Nous' key, and when it publishes the shared header and its kind 10002.** Until the kind 10002 is
      published, readers do not know the relays where menus gather (Duty Menus § 8.1 step 3, § 8.2). Until the
      header is, there is no header for a person's dictionary to copy (Duty Menus § 3).
- [ ] **Order of the code work.** Which of the open items comes first: the relay fill on `/treasure-map`, the readers'
      fallback, or the empty-relay fix.
