# Show and Tell

> **Status:** living document — advisory (see the [README](./README.md))
> **Opened:** 2026-09-19 · **Last reviewed by the owner:** not yet — drafted 2026-09-19 from the owner's two statements of that date; the owner has not read this text
> **The question:** when the community curates something for you, should the evidence be what trusted people *do* for their own reasons, or what they *say* because they mean to say it?
> **Sources:** the owner's statement of the idea (2026-09-19, quoted below, with a refinement later the same day); *To get Web of Trust right, we must Show AND Tell* (the owner's 2024 article, published as straycat, 2024-08-22 — [bibliography](./bibliography.md#show-and-tell)); GitHub issue [nous-clawds4/tapestry#150](https://github.com/nous-clawds4/tapestry/issues/150), *Pinning (aka Tracked tags)*.

## The idea

> The central purpose of Tapestry (Brainstorm) is for your community to help you curate data. I submit that there are two opposing Curation Methods: the first is for the community to "show" that a piece of data is worthy of curation (e.g., that a DList belongs in the dictionary) via actual usage by trusted community members; the second is to "tell", via explicit statements by community members.
>
> — the owner, 2026-09-19, first statement. *(This document says "curation signals" where the quote says "Curation Methods" — see Terms for why. "The dictionary" is one of the planned Dictionaries — Tags, DLists, Concepts — whose entries are meant to be earned by usage and acceptance by the community. The owner's model is stated on the Dictionaries index page, `ui/src/pages/dictionaries/Placeholders.jsx`; that page is a placeholder and the model is not built. E14 is the nearest thing that ships.)*

> I agree: Show and Tell are two poles, and hybrids exist.
>
> — the owner, 2026-09-19, refinement (later the same day). Where the two statements differ, the refinement wins. It supersedes "two opposing Curation Methods" read as a strict either-or, and it supersedes the first statement's use of the Pin as its example of Tell (see Terms).

**Show** and **Tell** are the two poles of a spectrum, not a pair of boxes. Real mechanisms sit between them, and the best designs usually use both. The owner's 2024 article ([bibliography](./bibliography.md#show-and-tell)) took the same position: "we don't have to pick". In this document "the 2024 article" always means that piece — the same author as the 2026-09-19 statements, two years earlier.

The owner's analogy is to how law gets made. **Show is common law**: something becomes law through precedent — because of what courts, case by case, actually did. **Tell is legislation**: something becomes law because a governing body said so, explicitly.

**Using this in a design.** (1) Name the datum — the thing being curated. (2) List the signals you could count for it, and place each on the axis by asking *why* people take that action. (3) Read the ledger for what each pole will cost you. (4) If any signal is something people do for themselves, answer the reuse hazard's three questions. (5) Say in your own artifact which way you went and why — and afterwards, add a row to Examples.

## Terms

Project words used below are defined elsewhere. **DList**, **GrapeRank** and **point of view**: [BIBLE.md](../BIBLE.md) §21 (Glossary). **Tag**, **tagging** and **pin**: [protocols/drafts/tags.md](../protocols/drafts/tags.md). **Trusted List**: a published, signed list of members computed from one point of view — a pin's Trusted List is the accounts (or notes) that trusted people have tagged with the pinned Tag. See [protocols/drafts/trusted-lists.md](../protocols/drafts/trusted-lists.md).

**Datum.** The thing being curated: a Tag, an item on a DList, an edge in a graph, whether a Tag applies to a profile. *Always name the datum.* A position on the axis is relative to it, and one action can sit at different places for different data. Someone who tags a profile as `podcaster` means to say something about the profile — and says nothing, on purpose, about whether `podcaster` is a Tag worth having. Yet their use of it is exactly the evidence that ranks the Tag. (A court ruling is the same: a statement about one case, and precedent for the principle.)

**Curation signal.** One piece of evidence, from one community member, bearing on a datum. Signals are the *inputs* to curation.

> Not to be confused with a **curation method**, which is already a shipped term: "a scoring method, a point of view and a cutoff" (`engineering-team/audits/curated-dlist-update/prd-seed.md` § 4, Domain model). It ships as the "Curation method" panel on Curated DLists, as the pin's Edit-curation dialog, and as the `curation-method` tag on pin events (`protocols/drafts/tags.md` § Pins). A curation method is how one point of view turns signals into a list. Signals go in; a method decides what comes out.

**Show signal.** Evidence produced as a by-product of a trusted member doing something for their own reasons: using a Tag, following someone, adding an item. They were not trying to tell anyone anything. The 2024 article calls these *proxy indicators* — "SHOW ME data".

**Tell signal.** A statement made in order to communicate a judgment about the datum: a five-star product review, "Baseball is a child category of Sports". The 2024 article calls these *explicit trust attestations* — "TELL ME data".

**What places a signal on the axis is motivation.**

> The distinction between these two poles lies in the motivation for the user to take the action; and sometimes, the motivation can be mixed.
>
> — the owner, 2026-09-19, refinement

So the *form* of an action does not settle where it sits. An action can be as explicit in form as you like — a deliberate, signed event that names the datum — and still sit toward the Show end, because of why people take it. Pinning a Tag is the clearest case. The owner calls it a hybrid, and gives the motive as the reason:

> The idea of Pinning a Tag might best be considered a hybrid: we expect users to Pin something because they are using the Pinning feature, not because they are making a public statement.
>
> — the owner, 2026-09-19, refinement

This supersedes the first statement, which offered the Pin as its example of Tell: "According to the second method, we allow users to Pin individual Tags. We incentivize users to use Pinning system because it is how they tell us of their interest in individual Tags." The refinement suggests a five-star product review as perhaps "a better example" of something closer to the Tell end (E9) and adds the ontology edge (E10).

**Mixed.** Two different things get called hybrid, and it helps to keep them apart (the two names were added in drafting):

- a **mixed signal** — a single action whose motivation is mixed (the Pin);
- a **mixed mechanism** — a feature that combines signals of both kinds (tag applicability: the author's hint *plus* observed usage).

**Both kinds pass the same trust filter.** A signal counts only when its author is trusted from the active point of view, and it is counted when the view is computed, not when the signal is published. Show and Tell differ in what the evidence *is*, never in who is allowed to give it. See "Relation to the architecture invariants" below.

## What is new since the 2024 article

The article was about one datum — a person's standing in your web of trust — and asked which raw data should feed the trust score: follows, mutes, zaps and reactions (Show), or explicit attestations of trust (Tell). Its answer was both.

This document widens the question to *any* datum the community curates. The trust score is no longer the output; it is the filter applied to both kinds of evidence about everything else.

The article already treated this as a spectrum: a five-star rating "for a host on a couchsurfing platform or a vendor on an ecommerce site", and a "superfollow", "lie somewhere on the spectrum" between its poles. That does not conflict with E9, because the datum differs. In the article the datum is the host's or vendor's standing in your web of trust, and its Tell pole is a full attestation with "a context, a score, and a confidence"; a star rating for one stay or one sale falls short of that. In E9 the datum is the product, and the review is a statement about exactly that. Reactions move the same way: the article lists them among its proxy indicators — a reaction to someone's note, read as trust in its author — while an up or down vote on a DList item is the same kind-7 event used as an explicit statement about that item (E6). Name the datum. *(This reconciliation was added in drafting, 2026-09-19; the article does not say why its in-between cases sit where they do.)*

## The ledger

What each pole is good and bad at. Append at the end of a table; never renumber. In any table below, "owner, 2026-09-19" means the owner's first statement unless the cell says "refinement".

### Show

| ID | Advantage | Provenance |
|---|---|---|
| S+1 | **More honest.** People act for their own reasons, not for an audience. | owner, 2026-09-19 (the gloss was added in drafting) |
| S+2 | **Changes organically.** Nobody has to decide that the consensus has moved. | owner, 2026-09-19 (the gloss was added in drafting) |
| S+3 | **Changes quickly.** | owner, 2026-09-19 |
| S+4 | **Abundant and free.** "Users issue them freely and easily, the result being that we are awash in a sea of data." It costs the user nothing extra. | 2024 article (the last sentence was added in drafting) |

| ID | Disadvantage | Provenance |
|---|---|---|
| S-1 | **Ambiguous.** "They often don't mean what we want them to mean. If Alice follows Bob, does that mean she trusts him? Maybe. Or maybe not." Context is usually missing too. | 2024 article (the last sentence paraphrases it) |
| S-2 | **Gets gamed once it matters.** The article predicts that as scores built on Show data become useful, "people will learn to game the scores by changing their behavior", and the data becomes less reliable. In tension with S+1 — see Q2. | 2024 article |
| S-3 | **Needs a precedent first.** A brand-new datum has no usage, so Show has nothing to say about it (the cold start). | converse of T+2 (drafting, 2026-09-19); tag applicability (E5) was designed around it |
| S-4 | **Coarse.** Usage says "this gets used", not "this is right in this narrow sense". | converse of T+1 (drafting, 2026-09-19) |
| S-5 | **The reuse hazard.** The action was taken for the person's own reasons. Counting it for other people can anger them if they do not know it is public, cannot keep it private, or would not endorse how we read it. See the section of that name. | owner, 2026-09-19, refinement — said of the Pin; applied to every Show signal, and named, in drafting |

### Tell

| ID | Advantage | Provenance |
|---|---|---|
| T+1 | **More precise, in a fine-grained way.** | owner, 2026-09-19 |
| T+2 | **No need to wait for a precedent to be set.** | owner, 2026-09-19 |
| T+3 | **Says what it means.** "You say what you mean, and you mean what you say, leaving as little room for interpretation as possible" — and it can carry its context with it. | 2024 article |
| T+4 | **Harder to game.** The article expects authors who want to be heard to move toward explicit statements "in ways that are harder to game". | 2024 article |

| ID | Disadvantage | Provenance |
|---|---|---|
| T-1 | **Laborious.** It is work for users to record their preferences. | owner, 2026-09-19 |
| T-2 | **Scarce.** Most users will not do it without a clear reason of their own, and "the community will benefit" is almost never reason enough. See "Getting explicit signals" below. | owner, 2026-09-19; the 2024 article: "of course they're not going to do that without a reason" |
| T-3 | **Nobody wants to put a number on it, and nobody updates it.** The two objections raised against explicit trust attestations at the Nostriga panel; the article grants that they "have some merit". | 2024 article |

## Getting explicit signals: give people a reason of their own

> Product Managers need to appreciate that most users simply will not take the time to curate their preferences without a clear motivation to do so. "The community will benefit from your curation" is almost never a sufficient motivation. "You need to reveal your preference so you can personalize your user experience in a very specific manner, and you'll see the benefit immediately" is a much more effective motivator. Example: if a user has a special interest in some niche category that is not widely popular, and wants to see relevant Tags show up on the user profile page, the user will be prompted to Pin the relevant Tags to the list of Tags that will take priority when viewing user profile pages. The user is motivated to do so because of a clear reason and can see the effects of the Pinning action immediately. The user's motivation is primarily selfish, not altruistic; and yet the community can benefit tremendously from this revealed preference.
>
> — the owner, 2026-09-19, first statement, where this passage sat under the label "How to use the Tell Me method effectively". The refinement says the Pin it describes "might best be considered a hybrid" (see Terms, and consequence 1 below). *(The profile-page behaviour in the example is proposed, not built — see E13.)*

This is the practical answer to T-1 and T-2: design the explicit action so that the person who takes it gets something, immediately and visibly. Issue #150 frames pinning exactly this way — its "Primary Motivation for Pinning" is the pinner's own Trusted List, and the curation of popular Tags appears only under "Fringe benefits to the community".

Two consequences follow, and both matter:

1. **What you get is a mixed signal, not a pure Tell.** The action is explicit in form, but the motive is personal — which, by the definition above, moves it toward the Show end. That is why the Pin is classed as a hybrid.
2. **The moment you count it for other people, the reuse hazard applies.**

## The reuse hazard

> If a user is taking an action (Pinning) motivated purely to personalize their experience (on the Show end of the axis), and we are using the user's Pin to curate Tags for other users, and the user does not know or has no control over whether the Pin is private, or we interpret the act of Pinning in a manner that the user does not endorse, then the user might understandably get pissed off. This is a subtle user experience issue to understand, and it will behoove us to understand it in great detail.
>
> — the owner, 2026-09-19, refinement

The Pin is one case of a general pattern. Every Show signal is a reuse: someone did a thing for their own reasons, and we are reading it as evidence about something else. The owner's statement, made about the Pin, names three separate ways that can go wrong. Ask all three of any design that counts a personal action for other people (the wording of the questions, and the illustration in the third, were added in drafting):

1. **Do they know?** Does the person know the action is public, and that it is counted for others?
2. **Can they control it?** Is there a way to take the action privately, or to opt out of being counted, and still get the personal benefit?
3. **Would they endorse our reading of it?** We say "Alice pinned `bitcoin-maxi`, so Alice vouches for that Tag." Alice may have pinned it to keep an eye on people she distrusts.

Where the Pin stands today, as a worked case (2026-09-19): every pin is a published, signed event; there is no private pin. Pinning is one click, with no dialog. All the pinner is told beforehand is the Pin button's tooltip: "Pin this tag to publish a Trusted List (kind-30392) curated to your preferences. Other Nostr apps can read it for content discovery and trust-weighted ranking." The tooltip shows on hover or keyboard focus and is switched off on touch screens, so on a phone the pinner is told nothing before the click. A fuller explanation — that the instance will periodically publish the list under the pinner's point of view, and that other Nostr apps can read it — opens the /pins page and the Edit-curation dialog; the dialog can be reached only from the Pinned tab of the Tag's page, once the pin exists. The same click also signs, with the pinner's own key, up to two NIP-51 lists — a follow set (kind 30000) of the listed accounts and a bookmark set (kind 30003) of the Tag's curated notes — and sends them to the pinner's write relays plus a set of well-known public relays. Each is skipped when it would be empty. The tooltip mentions neither. None of this copy says that pins are also counted, per Tag, in the Tags directory's "Most pinned" sort — which is the reuse (E3). The only words about that are shown to viewers, not pinners: the count's tooltip, "Pins by people in your POV's WoT". Whether any of this needs to change is Q3.

Cases where the hazard was handled well, or badly, belong in the examples table with a note.

## When to lean which way

Heuristics, not rules. Each says where it came from.

| ID | Heuristic | Provenance |
|---|---|---|
| H1 | **Decentralized curation of a graph probably wants Tell.** The owner's hunch, in the owner's words: "Probably better when it comes to decentralized curation of a graph." The owner gave no reason. A possible reason, added in drafting: usage seldom reveals an edge such as "Baseball is a child category of Sports" (E10). | owner, 2026-09-19 (the possible reason was added in drafting) |
| H2 | **Start with Show, because it is the data you already have.** Add Tell where ambiguity or gaming makes Show unreliable. | 2024 article, "The future": scores will rely at first on Show data "because that's the data that's available to us in large quantities", and authors will move toward explicit statements as Show data gets gamed |
| H3 | **Use Tell to cover Show's cold start — as a hint, never as a gate — and let usage take over the ordering.** | shipped: tag applicability (E5), whose spec says "hint, never gate" |
| H4 | **If you need explicit signals from many people, give each of them a reason of their own** — then treat what you get as a mixed signal, and check it against the reuse hazard. | owner, 2026-09-19 (the second half was added in drafting, from the refinement) |
| H5 | **Use both where you can.** "We don't have to pick." Put both on the same surface and let the viewer compare (E1 beside E3). | 2024 article; the shipped Tags directory (the second sentence was added in drafting) |

## Examples

Name the datum. State the status honestly. Append at the end of the table; never renumber. A proposed idea is an ordinary `E` row whose Status says so; it is also tracked in `engineering-team/stories/_intake.md` — this table is not its only home. Placements on the axis were made in drafting unless the cell credits the owner.

| ID | Example | Datum being curated | Where on the axis, and why | Status | Where to look |
|---|---|---|---|---|---|
| E1 | Tags directory, "Most used" sort (the default) | The Tag — is it part of the community's working vocabulary? | **Show.** Counts taggings (applications and disputes) by accounts the active point of view trusts. Nobody who tags a profile is commenting on the Tag. This is the owner's "first method" (first statement). | shipped | `src/api/event-tags/index.js` (`SORTERS.used`); `ui/src/pages/Tags.jsx` |
| E2 | Pinning a Tag | The Tag | **Mixed signal, leaning Show.** The owner says the Pin "might best be considered a hybrid" (2026-09-19, refinement); "leaning Show" was added in drafting, because the owner expects people to pin "because they are using the Pinning feature, not because they are making a public statement". Explicit in form — a signed event naming the Tag — but the motive is personal: the pin commissions a Trusted List under the pinner's own point of view, a search filter, and cross-client list exports. The spec itself calls pinning "a personal pinning layer". | shipped. The daily Trusted List refresh is enabled in production; a fresh install seeds it disabled, and publishing on first pin and manual refresh still work (as of 2026-09-19; per-deployment state: OPEN.md row 334). | `protocols/drafts/tags.md` § Pins; `ui/src/utils/publishTagPin.js`; `src/api/trustedList/refreshPinnedTags.js`; issue #150 |
| E3 | Tags directory, "Most pinned" sort and per-Tag pin count | The Tag | **The public reuse of E2.** Counts distinct trusted pinners per Tag and shows the count to everyone. This is where the reuse hazard bites. Issue #150 names it: "a secondary method for curation of the list of popular Tags (first method: frequently used Tags, second method: frequently Pinned Tags)". | shipped | `aggregateTagPins` in `src/api/profile-tags/index.js`; `ui/src/pages/Tags.jsx`; `ui/src/components/TagPinAffordance.jsx` (the tooltip — all the pinner is told at pin time); `ui/src/pages/Pins.jsx` (`PinsIntro`) and `ui/src/components/CurationMethodDialog.jsx` (the fuller explanation, seen only after pinning); `publishNip51ExportForPin` and `publishNoteBookmarkSetForPin` in `ui/src/utils/publishTagPin.js` (what else the click publishes) |
| E4 | Tagging a profile or a note (apply / dispute) | Two at once: (a) does this Tag apply to this target? (b) is this Tag worth having? | **Toward Tell for (a), Show for (b).** The tagger means to say something about the target, and a dispute is the explicit counter-statement. They are not commenting on the Tag, yet their use of it is what E1 counts. The worked case for "name the datum". | shipped | `protocols/drafts/tags.md` § Taggings, § Polarity; `src/api/profile-tags/index.js` |
| E5 | Tag applicability — which Tags are offered for profiles, which for notes | A Tag's fitness for a kind of target | **Mixed mechanism: HINT ∪ USAGE.** The Tag author's optional hint is a Tell; observed trusted usage is a Show. The hint covers a new Tag's cold start and is "hint, never gate". The operative source is the derived union, not the hint alone and not usage alone: a hinted Tag with no usage is still offered, listed last, and usage orders the rest. | shipped | `protocols/drafts/tags.md` § Applicability hints; `engineering-team/epics/tag-applicability.md` |
| E6 | Scoring items on a DList | An item's place on a list | **Mixed mechanism, mostly Tell.** Trust-weighted up and down votes (kind-7 reactions) are explicit statements about the item. The author's implicit upvote treats the act of contributing the item as evidence — a small Show component. | shipped | `ui/src/utils/dlistScore.js` |
| E7 | GrapeRank's inputs: follows and mutes | A person's standing in your web of trust | **Show.** Nobody follows or mutes with a trust score in mind — the 2024 article's original case. Reports are harder to place: Q1. | shipped | `BIBLE.md` (GrapeRank); `src/algos/customers/personalizedGrapeRank/interpretRatings.js` |
| E8 | Shared concepts: pointing at a definition vs inheriting from it | Which definition of a concept a community converges on | **Mixed signal — placement open (Q6).** Explicit in form: the spec calls deference "explicit, signed, revocable, and costly", because inheriting subscribes the author to the parent's future edits. But the likely motive is the author's own — they inherit to give their own concept a working definition, which is usage, the same shape as the Pin (E2). A pointer is cheap and carries zero weight: "a bookmark is not agreement". So the spec counts the action that costs its author something and ignores the one that costs nothing. Counting who defers, for other people, would then be a reuse. *(The spec does not use the words Show or Tell.)* | partly shipped: the pointer seed is implemented; deference aggregation is specified, not built | `protocols/drafts/shared-concepts.md` (header, § Terminology, § Aggregated deference) |
| E9 | A five-star product review | The product | **Near the Tell end** (the owner's placing, 2026-09-19, refinement). "Users leave reviews because they are making a statement; there need be no other motivation." Not the same datum as the article's five-star rating for a host or vendor — see "What is new since the 2024 article". | illustrative (owner, 2026-09-19, refinement) | — |
| E10 | Building an ontology: "Baseball is a child category of Sports" | An edge in a graph | **Tell** (the owner's placing, 2026-09-19, refinement), when Alice says it for no other reason than "to communicate this idea explicitly". Used in drafting to illustrate H1; the owner did not link the two. | illustrative (owner, 2026-09-19, refinement) | — |
| E11 | When the same Tag has been defined twice, nudge people toward the more used one, while still letting them "find the alternatives if they do just a little digging" | Which of several duplicate Tags becomes the shared one | **Show** (the owner's "first method"). "In this way, consensus can be achieved naturally." Nearest shipped behaviour: with nothing typed, the Add-a-tag picker lists the current target type's Tags by trusted usage; once a name is typed, matches are not ordered by usage. Its "Show other results" expander covers a different case: it lists matching Tags that are outside the current target type's list — typically a Tag from the *other* target type (a profile Tag while tagging a note), but also a Tag with no hint and no trusted usage for either type — exact-slug first, so people adopt an existing Tag instead of minting a copy. Duplicates within one target type are not handled as such: two same-slug Tags by different authors that are both on the current type's list appear side by side, and nothing nudges toward the more used one. | proposed (owner, 2026-09-19) | `engineering-team/stories/_intake.md` § "2026-09-19 — Nudge people toward the more-used of two duplicate Tags"; `ui/src/components/AddTagDialog.jsx`; `engineering-team/epics/tag-applicability.md` (story 3, superseded) |
| E12 | Categories of pins — one category commissions the Tag's Trusted List, another gives the Tag priority on profile pages | The Tag, separately for each purpose | **Mixed signal.** Splitting the pin by purpose is also a way to answer the reuse hazard's third question: the pinner says which reading they endorse. | proposed (owner, 2026-09-19) | `engineering-team/stories/_intake.md` § "2026-09-19 — Categories of pins" |
| E13 | Pinned Tags shown first on profile pages, under a default maximum number of Tags | Which Tags a viewer sees on a profile | **Mixed signal**, and the owner's example of a reason of one's own (H4): the pinner sees the effect at once. Today profile Tags are listed alphabetically, uncapped, and pins are not consulted. | proposed (owner, 2026-09-19) | `engineering-team/stories/_intake.md` § "2026-09-19 — Pinned Tags first on profile pages, under a default maximum"; `ui/src/components/ProfileTagsSection.jsx` |
| E14 | The Trusted Dictionary | Which concepts belong in a point of view's dictionary | **Show.** Lists the concepts that at least N distinct trusted authors actually use; its ADR's hard boundary is "usage-derived only", and membership is computed at read time, per point of view. The nearest shipped thing to the owner's defining example — "that a DList belongs in the dictionary" — and the usage-derived counterpart to E8: its ADR rules the inherit signal out ("never the W1 inherit-consensus signal"). The owner's planned Dictionaries model would mix signals: for Tags, "criteria may be based on direct usage, on b-tags, and/or on pins". | shipped (the Trusted Dictionary); the wider Dictionaries model is a placeholder page | `ui/src/pages/shared-concepts/TrustedDictionary.jsx`; `engineering-team/decisions/done/shared-concepts-adoption/0005-trusted-dictionary.md`; `ui/src/pages/dictionaries/Placeholders.jsx` |

## Relation to the architecture invariants

Show and Tell is a choice made *inside* the four invariants in [CLAUDE.md](../CLAUDE.md). Neither pole is exempt from any of them.

- **POV-first.** "Most used" and "most pinned" are both true *for a point of view*. There is no global usage count and no global pin count.
- **Decentralized-first.** Anyone may publish either kind of signal. A Tell is not more official than a Show, and nobody's Tell is binding on anyone else — the legislative analogy stops there. There is no legislature; there is only whose statements your point of view trusts. The owner's dictionaries model (`ui/src/pages/dictionaries/Placeholders.jsx`) lets a steward add an entry by hand, overriding the community criteria. That is one point of view deciding what its own dictionary holds, not a Tell that binds anyone else. `engineering-team/audits/navigation-scaffolding/prd-seed.md` § 4 says how to model it: as an assertion anyone may publish, which the house point of view happens to weigh heavily.
- **Filter at view time.** Count signals when the view is computed. A stored "popular Tags" list is wrong the moment the point of view changes or a new signal arrives. The counts the app itself shows — E1, E3, E4, E6, the Trusted Dictionary's live view (E14), and the in-app Tag picker in E5 — are derived on read. Other things in the table are stored, each computed under one named point of view: the Trusted Lists a pin commissions (E2 — kind 30392, built on pin, rebuilt on later refreshes, and daily where whoever runs the instance has enabled that task; and kind 30393, the note list, which is not built on pin — only the /pins page's "Refresh all" and that daily task build it); the NIP-51 lists the pin click exports under the pinner's own key (E2 — kinds 30000 and 30003; the /pins page reports a follow set that has drifted as "N changes since last export"); the applicability lists published for other clients (E5 — kind 30394, house point of view, republished when their membership changes); GrapeRank scores (E7 — the `wot_rank_<suffix>` columns that E1 and E3 filter by); and the Trusted Dictionary's optional snapshot (E14 — dated, signed by the instance's assistant, published only when the instance owner presses "Publish snapshot"). Each is a snapshot that can lag its signals. Invariant 3 in [CLAUDE.md](../CLAUDE.md) says when storing a per-point-of-view result is justified: only when the read-time cost has been measured and is too high.
- **Local-first.** A statement does not have to be an event. Alice's "Baseball is a child category of Sports" may live only in her own graph, kept for her own use; while it stays there it is not a signal to anyone else. Whether and when she publishes it is her call — local-first is the private option that the reuse hazard's second question asks for. Why she publishes is what places it on the axis: to say it to others, it is a Tell (E10); for her own reasons, it is a mixed signal like the Pin (E2), and the reuse hazard applies.

*(This section was written in drafting; the owner has not stated how the philosophy relates to the invariants.)*

## Open questions

| ID | Question | Raised |
|---|---|---|
| Q1 | **Where do reports (NIP-56, kind 1984) sit?** In form they are explicit, typed statements; GrapeRank consumes them alongside follows and mutes. By the motivation test: is a reporter making a statement for others, or cleaning up their own experience? | drafting, 2026-09-19 |
| Q2 | **"More honest" (S+1) against "gets gamed" (S-2).** Is Show honest only while people do not know, or do not care, that they are being counted? Answering the reuse hazard means telling them. Does disclosure move a signal toward Tell — and is that a cost, or the point? | drafting, 2026-09-19 |
| Q3 | **What should a pinner be told, and should there be a private pin?** Today every pin is a published event; pinning is one click, and the only notice beforehand is a tooltip that touch screens never show. No copy in the pin flow — the tooltip, the Pinned tab, the Edit-curation dialog, the /pins page — says that pins are counted in "Most pinned". Nothing shown before the click says that it also publishes NIP-51 lists under the pinner's own key to public relays; the pinner meets those lists only afterwards — the Pinned tab's "Last exported" line and its Export dialog ("signed by you", with the relays listed), the Edit-curation dialog's Include checkboxes ("follow set (kind-30000)", "bookmark set (kind-30003)"), and the /pins rows ("Exported … · in sync"). Issue #150 anticipated the private-pin half. The only NIP-51 list it mentions is an alternative it considers for keeping a user's list of Pinned Tags; its separate "Encryption" section then says "Users may have the option to encrypt the NIP-51 list or not". That is the list of pins, not the follow-set and bookmark-set exports above. | drafting, 2026-09-19, from the owner's statement of the reuse hazard |
| Q4 | **What is a pin category, structurally?** A new field in the pin's curation parameters, a separate concept per category, or pins on other kinds of target? (`engineering-team/decisions/0009-pin-a-tag.md`, Option A, "Concept slug", left the unqualified "pinning" slug free for the last of these.) | drafting, 2026-09-19 |
| Q5 | **Has the article's predicted drift — from Show toward Tell, as Show gets gamed — begun anywhere in our data?** | drafting, 2026-09-19 |
| Q6 | **Where does deference sit (E8)?** An inherit edge is explicit and signed, and the spec calls it a "claim". But an author most likely inherits to get a definition for their own concept, which is usage. Is it a Tell made costly, or a Show that happens to be signed? If it is a Show, counting who defers is a reuse, and the reuse hazard's three questions apply — worth settling before deference aggregation is built. | drafting, 2026-09-19 |

## How to extend this document

See the [README](./README.md) § "How to extend a philosophy". In short: append, keep the IDs, give every entry a provenance, name the datum, state the status, leave the owner's quoted words alone.
