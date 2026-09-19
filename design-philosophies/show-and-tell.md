# Show and Tell

> **Status:** living document — advisory (see the [README](./README.md))
> **Opened:** 2026-09-19 · **Last reviewed by the owner:** 2026-09-19
> **The question:** when the community curates something for you, should the evidence be what trusted people *do*, or what they *say*?
> **Sources:** the owner's statement of the idea (2026-09-19, quoted below); *To get Web of Trust right, we must Show AND Tell* (straycat, 2024-08-22 — [bibliography](./bibliography.md#show-and-tell)); GitHub issue #150, *Pinning (aka Tracked tags)*.

## The idea

> The central purpose of Tapestry (Brainstorm) is for your community to help you curate data. I submit that there are two opposing Curation Methods: the first is for the community to "show" that a piece of data is worthy of curation (e.g., that a DList belongs in the dictionary) via actual usage by trusted community members; the second is to "tell", via explicit statements by community members.
>
> — the owner, 2026-09-19. *(First wording. This document says "curation signals" where the quote says "Curation Methods" — see Terms for why.)*

**Show** and **Tell** are the two poles of a spectrum, not a pair of boxes. Real mechanisms sit between them, and the best designs usually use both — the 2024 article's position was "we don't have to pick".

The owner's analogy is to how law gets made. **Show is common law**: something becomes law through precedent — because of what courts, case by case, actually did. **Tell is legislation**: something becomes law because a governing body said so, explicitly.

## Terms

**Datum.** The thing being curated: a Tag, an item on a DList, an edge in a graph, whether a Tag applies to a profile. *Always name the datum.* A position on the axis is relative to it, and one action can sit at different places for different data. Someone who tags a profile as `podcaster` means to say something about the profile — and says nothing, on purpose, about whether `podcaster` is a Tag worth having. Yet their use of it is exactly the evidence that ranks the Tag. (A court ruling is the same: a statement about one case, and precedent for the principle.)

**Curation signal.** One piece of evidence, from one community member, bearing on a datum. Signals are the *inputs* to curation.

> Not to be confused with a **curation method**, which is already a shipped term: "a scoring method, a point of view and a cutoff" (Curated DLists, the pin dialog, and the `curation-method` tag on pin events — see `protocols/drafts/tags.md` § Pins). A curation method is how one point of view turns signals into a list. Signals go in; a method decides what comes out.

**Show signal.** Evidence produced as a by-product of a trusted member doing something for their own reasons: using a Tag, following someone, adding an item. They were not trying to tell anyone anything. The 2024 article calls these *proxy indicators* — "SHOW ME data".

**Tell signal.** A statement made in order to communicate a judgment about the datum: a five-star review, "Baseball is a child category of Sports". The 2024 article calls these *explicit attestations* — "TELL ME data".

**What places a signal on the axis is motivation.**

> The distinction between these two poles lies in the motivation for the user to take the action; and sometimes, the motivation can be mixed.
>
> — the owner, 2026-09-19

So the *form* of an action does not settle where it sits. An action can be as explicit in form as you like — a deliberate, signed event that names the datum — and still sit toward the Show end, because of why people take it. Pinning a Tag is the type specimen:

> The idea of Pinning a Tag might best be considered a hybrid: we expect users to Pin something because they are using the Pinning feature, not because they are making a public statement.
>
> — the owner, 2026-09-19

**Mixed.** Two different things get called hybrid, and it helps to keep them apart:

- a **mixed signal** — a single action whose motivation is mixed (the Pin);
- a **mixed mechanism** — a feature that combines signals of both kinds (tag applicability: the author's hint *plus* observed usage).

**Both kinds pass the same trust filter.** A signal counts only when its author is trusted from the active point of view, and it is counted when the view is computed, not when the signal is published. Show and Tell differ in what the evidence *is*, never in who is allowed to give it. See "Relation to the architecture invariants" below.

## What is new since the 2024 article

The article was about one datum — a person's standing in your web of trust — and asked which raw data should feed the trust score: follows, mutes and zaps (Show), or explicit attestations of trust (Tell). Its answer was both.

This document widens the question to *any* datum the community curates. The trust score is no longer the output; it is the filter applied to both kinds of evidence about everything else. The article's in-between cases (a five-star rating for a couchsurfing host, a "superfollow") are why this is a spectrum.

## The ledger

What each pole is good and bad at. Append at the end of a table; never renumber.

### Show

| ID | Advantage | Provenance |
|---|---|---|
| S+1 | **More honest.** People act for their own reasons, not for an audience. | owner, 2026-09-19 (the gloss was added in drafting) |
| S+2 | **Changes organically.** Nobody has to decide that the consensus has moved. | owner, 2026-09-19 |
| S+3 | **Changes quickly.** | owner, 2026-09-19 |
| S+4 | **Abundant and free.** "Users issue them freely and easily, the result being that we are awash in a sea of data." It costs the user nothing extra. | 2024 article |

| ID | Disadvantage | Provenance |
|---|---|---|
| S−1 | **Ambiguous.** "They often don't mean what we want them to mean. If Alice follows Bob, does that mean she trusts him? Maybe. Or maybe not." Context is usually missing too. | 2024 article |
| S−2 | **Gets gamed once it matters.** The article predicts that as scores built on Show data become useful, "people will learn to game the scores by changing their behavior", and the data becomes less reliable. In tension with S+1 — see Q2. | 2024 article |
| S−3 | **Needs a precedent first.** A brand-new datum has no usage, so Show has nothing to say about it (the cold start). | mirror of T+2; tag applicability (E5) was designed around it |
| S−4 | **Coarse.** Usage says "this gets used", not "this is right in this narrow sense". | mirror of T+1 |
| S−5 | **The reuse hazard.** The person never agreed to be counted. See the section of that name. | owner, 2026-09-19 |

### Tell

| ID | Advantage | Provenance |
|---|---|---|
| T+1 | **More precise, in a fine-grained way.** | owner, 2026-09-19 |
| T+2 | **No need to wait for a precedent to be set.** | owner, 2026-09-19 |
| T+3 | **Says what it means.** "You say what you mean, and you mean what you say, leaving as little room for interpretation as possible" — and it can carry its context with it. | 2024 article |
| T+4 | **Harder to game.** The article expects authors who want to be heard to move toward explicit statements "in ways that are harder to game". | 2024 article |

| ID | Disadvantage | Provenance |
|---|---|---|
| T−1 | **Laborious.** It is work for users to record their preferences. | owner, 2026-09-19 |
| T−2 | **Scarce.** Most users will not do it without a clear reason of their own, and "the community will benefit" is almost never reason enough. See the next section. | owner, 2026-09-19; the 2024 article: "of course they're not going to do that without a reason" |
| T−3 | **Nobody wants to put a number on it, and nobody updates it.** The two objections raised against explicit trust attestations at the Nostriga panel; the article grants that they "have some merit". | 2024 article |

## Getting Tell-grade signals: give people a reason of their own

> Product Managers need to appreciate that most users simply will not take the time to curate their preferences without a clear motivation to do so. "The community will benefit from your curation" is almost never a sufficient motivation. "You need to reveal your preference so you can personalize your user experience in a very specific manner, and you'll see the benefit immediately" is a much more effective motivator. Example: if a user has a special interest in some niche category that is not widely popular, and wants to see relevant Tags show up on the user profile page, the user will be prompted to Pin the relevant Tags to the list of Tags that will take priority when viewing user profile pages. The user is motivated to do so because of a clear reason and can see the effects of the Pinning action immediately. The user's motivation is primarily selfish, not altruistic; and yet the community can benefit tremendously from this revealed preference.
>
> — the owner, 2026-09-19. *(The profile-page behaviour in the example is proposed, not built — see P3.)*

This is the practical answer to T−1 and T−2: design the explicit action so that the person who takes it gets something, immediately and visibly. Issue #150 frames pinning exactly this way — its "Primary Motivation for Pinning" is the pinner's own Trusted List, and the curation of popular Tags is listed as a secondary effect.

Two consequences follow, and both matter:

1. **What you get is a mixed signal, not a pure Tell.** The action is explicit in form, but the motive is personal — which, by the definition above, moves it toward the Show end. That is why the Pin is classed as a hybrid.
2. **The moment you count it for other people, the reuse hazard applies.**

## The reuse hazard

> If a user is taking an action (Pinning) motivated purely to personalize their experience (on the Show end of the axis), and we are using the user's Pin to curate Tags for other users, and the user does not know or has no control over whether the Pin is private, or we interpret the act of Pinning in a manner that the user does not endorse, then the user might understandably get pissed off. This is a subtle user experience issue to understand, and it will behoove us to understand it in great detail.
>
> — the owner, 2026-09-19

Every Show signal is a reuse: someone did a thing for their own reasons, and we are reading it as evidence about something else. The owner's statement names three separate ways that can go wrong. Ask all three of any design that counts a personal action for other people:

1. **Do they know?** Does the person know the action is public, and that it is counted for others?
2. **Can they control it?** Is there a way to take the action privately, or to opt out of being counted, and still get the personal benefit?
3. **Would they endorse our reading of it?** We say "Alice pinned `bitcoin-maxi`, so Alice vouches for that Tag." Alice may have pinned it to keep an eye on people she distrusts.

Where the Pin stands today, as a worked case (2026-09-19): every pin is a published, signed event; there is no private pin. The pin dialog explains that pinning publishes a Trusted List under the pinner's point of view, which other Nostr apps can read. It does not mention that pins are also counted, per Tag, in the Tags directory's "Most pinned" sort — which is the reuse (E3). Whether that needs to change is Q3.

This document will grow here. Cases where the hazard was handled well, or badly, belong in the examples table with a note.

## When to lean which way

Heuristics, not rules. Each says where it came from.

| ID | Heuristic | Provenance |
|---|---|---|
| H1 | **Curating a graph probably wants Tell.** Whether Baseball is a child category of Sports is not something usage reveals well; someone has to say it. *(A hypothesis — marked "probably" by the owner.)* | owner, 2026-09-19 |
| H2 | **Start with Show, because it is the data you already have.** Add Tell where ambiguity or gaming makes Show unreliable. | 2024 article ("The future", steps 1 and 5–7) |
| H3 | **Use Tell to cover Show's cold start — as a hint, never as a gate — and let usage take over.** | shipped: tag applicability (E5), whose spec says "hint, never gate" |
| H4 | **If you need explicit signals from many people, give each of them a reason of their own** — then treat what you get as a mixed signal, and check it against the reuse hazard. | owner, 2026-09-19 |
| H5 | **Use both where you can.** "We don't have to pick." Put both on the same surface and let the viewer compare (E1 beside E3). | 2024 article; the shipped Tags directory |

## Examples

Name the datum. State the status honestly. Proposed ideas are tracked in `engineering-team/stories/_intake.md`; this table is not their only home.

| ID | Example | Datum being curated | Where on the axis, and why | Status | Where to look |
|---|---|---|---|---|---|
| E1 | Tags directory, "Most used" sort (the default) | The Tag — is it part of the community's working vocabulary? | **Show.** Counts taggings (applications and disputes) by accounts the active point of view trusts. Nobody who tags a profile is commenting on the Tag. | shipped | `src/api/event-tags/index.js` (`SORTERS.used`); `ui/src/pages/Tags.jsx` |
| E2 | Pinning a Tag | The Tag | **Mixed signal, leaning Show** (owner, 2026-09-19). Explicit in form — a signed event naming the Tag — but the motive is personal: the pin commissions a Trusted List under the pinner's own point of view, a search filter, and cross-client list exports. The spec itself calls pinning "a personal pinning layer". | shipped. The daily Trusted List refresh is enabled in production; a fresh install seeds it disabled (publishing on first pin and manual refresh still work). | `protocols/drafts/tags.md` § Pins; `ui/src/utils/publishTagPin.js`; `src/api/trustedList/refreshPinnedTags.js`; issue #150 |
| E3 | Tags directory, "Most pinned" sort and per-Tag pin count | The Tag | **The public reuse of E2.** Counts distinct trusted pinners per Tag and shows the count to everyone. This is where the reuse hazard bites. Issue #150 names it: "a secondary method for curation of the list of popular Tags (first method: frequently used Tags, second method: frequently Pinned Tags)". | shipped | `aggregateTagPins` in `src/api/profile-tags/index.js`; `ui/src/pages/Tags.jsx`; `ui/src/components/CurationMethodDialog.jsx` (what the pinner is told) |
| E4 | Tagging a profile or a note (apply / dispute) | Two at once: (a) does this Tag apply to this target? (b) is this Tag worth having? | **Toward Tell for (a), Show for (b).** The tagger means to say something about the target, and a dispute is the explicit counter-statement. They are not commenting on the Tag, yet their use of it is what E1 counts. The worked case for "name the datum". | shipped | `protocols/drafts/tags.md` § Taggings, § Polarity; `src/api/profile-tags/index.js` |
| E5 | Tag applicability — which Tags are offered for profiles, which for notes | A Tag's fitness for a kind of target | **Mixed mechanism: HINT ∪ USAGE.** The Tag author's optional hint is a Tell; observed trusted usage is a Show. The hint covers a new Tag's cold start and is "hint, never gate"; usage is the operative source. | shipped | `protocols/drafts/tags.md` § Applicability hints; `engineering-team/epics/tag-applicability.md` |
| E6 | Scoring items on a DList | An item's place on a list | **Mixed mechanism, mostly Tell.** Trust-weighted up and down votes (kind-7 reactions) are explicit statements about the item. The author's implicit upvote treats the act of contributing the item as evidence — a small Show component. | shipped | `ui/src/utils/dlistScore.js` |
| E7 | GrapeRank's inputs: follows and mutes | A person's standing in your web of trust | **Show.** Nobody follows or mutes with a trust score in mind — the 2024 article's original case. Reports are harder to place: Q1. | shipped | `BIBLE.md` (GrapeRank); `src/algos/customers/personalizedGrapeRank/interpretRatings.js` |
| E8 | Shared concepts: pointing at a definition vs inheriting from it | Which definition of a concept a community converges on | **A Tell built to cost something.** A pointer is cheap and carries zero weight — "a bookmark is not agreement". Only inheriting counts, because it subscribes the author to the parent's future edits: "explicit, signed, revocable, and costly". An answer to cheap talk from inside the Tell pole. | partly shipped: the pointer seed is implemented; deference aggregation is specified, not built | `protocols/drafts/shared-concepts.md` (header, § Aggregated deference) |
| E9 | A five-star product review | The product | **Tell.** "Users leave reviews because they are making a statement; there need be no other motivation." | illustrative (owner, 2026-09-19) | — |
| E10 | Building an ontology: "Baseball is a child category of Sports" | An edge in a graph | **Tell**, when Alice says it "for no other reason than to communicate this idea explicitly". The case behind H1. | illustrative (owner, 2026-09-19) | — |
| P1 | When the same Tag has been defined twice, nudge people toward the more used one, while "still allowing them to find the alternatives if they do just a little digging" | Which of several duplicate Tags becomes the shared one | **Show.** "In this way, consensus can be achieved naturally." Nearest shipped behaviour: the tag picker lists candidates by trusted usage and offers same-slug matches under "Show other results"; there is no explicit nudge. | proposed (owner, 2026-09-19) | intake entry 2026-09-19; `engineering-team/epics/tag-applicability.md` (story 3, superseded) |
| P2 | Categories of pins — one category commissions the Tag's Trusted List, another gives the Tag priority on profile pages | The Tag, separately for each purpose | **Mixed signal.** Splitting the pin by purpose is also a way to answer the reuse hazard's third question: the pinner says which reading they endorse. | proposed (owner, 2026-09-19) | intake entry 2026-09-19 |
| P3 | Pinned Tags shown first on profile pages, under a default maximum number of Tags | Which Tags a viewer sees on a profile | **Mixed signal**, and the owner's example of a reason of one's own (H4): the pinner sees the effect at once. Today profile Tags are listed alphabetically, uncapped, and pins are not consulted. | proposed (owner, 2026-09-19) | intake entry 2026-09-19; `ui/src/components/ProfileTagsSection.jsx` |

## Relation to the architecture invariants

Show and Tell is a choice made *inside* the four invariants in [CLAUDE.md](../CLAUDE.md). Neither pole is exempt from any of them.

- **POV-first.** "Most used" and "most pinned" are both true *for a point of view*. There is no global usage count and no global pin count.
- **Decentralized-first.** Anyone may publish either kind of signal. A Tell is not more official than a Show, and nobody's Tell is binding on anyone else — the legislative analogy stops there. There is no legislature; there is only whose statements your point of view trusts.
- **Filter at view time.** Count signals when the view is computed. A stored "popular Tags" list is wrong the moment the point of view changes or a new signal arrives. The shipped examples above all derive their counts on read.
- **Local-first.** A Tell does not have to be an event. Alice's "Baseball is a child category of Sports" may live only in her own graph; whether and when it becomes a public signal is her call — which is the reuse hazard's second question again.

## Open questions

| ID | Question | Raised |
|---|---|---|
| Q1 | **Where do reports (NIP-56, kind 1984) sit?** In form they are explicit, typed statements; GrapeRank consumes them alongside follows and mutes. By the motivation test: is a reporter making a statement for others, or cleaning up their own experience? | drafting, 2026-09-19 |
| Q2 | **"More honest" (S+1) against "gets gamed" (S−2).** Is Show honest only while people do not know, or do not care, that they are being counted? Answering the reuse hazard means telling them. Does disclosure move a signal toward Tell — and is that a cost, or the point? | drafting, 2026-09-19 |
| Q3 | **What should a pinner be told, and should there be a private pin?** Today every pin is a published event, and the dialog does not mention that pins are counted in "Most pinned". | drafting, 2026-09-19, from the owner's statement of the reuse hazard |
| Q4 | **What is a pin category, structurally?** A new field in the pin's curation parameters, a separate concept per category, or pins on other kinds of target? (ADR 0009 left the unqualified "pinning" slug free for the last of these.) | drafting, 2026-09-19 |
| Q5 | **Has the article's predicted drift — from Show toward Tell, as Show gets gamed — begun anywhere in our data?** | drafting, 2026-09-19 |

## How to extend this document

See the [README](./README.md) § "How to extend a philosophy". In short: append, keep the IDs, give every entry a provenance, name the datum, state the status, leave the owner's quoted words alone.
