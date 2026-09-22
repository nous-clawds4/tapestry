# Discovery Brief: Identification Tags for your Tapestry Assistant

**Slug:** assistant-identification-tags
**Date:** 2026-09-22
**Strategist phase:** Discovery (Phase 1)
**Grounded in:** the return edge from book `assistant-management` (its build audit and PRD seed, 2026-09-22). That book shipped the Assistant Management hub, ten placeholder action pages and the Assistant Alert, with every action marked "needs attention". This brief covers one of those ten actions: the Identification Tags page, the first to get a real answer.

## Problem statement

A person's Tapestry Assistant is a second nostr account that publishes on their behalf. Nothing on the network says, in a form other apps can read and verify, that this account belongs to that person, or that the person acknowledges it. The Assistant's profile text says "I am the Tapestry Assistant for X", but that is the agent's own unsigned claim. The person's Treasure Map names the Assistant as the provider of their scores, but says nothing about ownership and is read only by apps that understand it. So a person and their Assistant are easy to confuse, an outside app cannot map an agent to its owner, and the person has no way to see whether the relationship is declared, let alone declare it.

The owner's words for this page: "Part of the Assistant's identity is its relationship to you. A handful of Tags will be used to broadcast this relationship between you and your Tapestry Assistant to outside clients, applications and services." The page needs attention "if any of the required Taggings are missing": two the person puts on their Assistant ("My Tapestry Assistant", "My Agent") and two the Assistant puts on the person ("My Tapestry Owner" and, renamed at Discovery, "My Human"). This is the two-way handshake the owner parked in August 2026 ("so it will always be easy to map a TA to its owner"), now in tagging form in both directions.

## User landscape

- **A person with an Assistant on this instance** (the instance owner, an admin or a customer). Today the relationship lives only in the Assistant's profile text and, for scores, in the Treasure Map. The pain: no view of whether the relationship is declared, and no way to declare it. An admin's or customer's Assistant cannot publish anything but its own profile today, so half of the handshake is impossible for them.
- **Someone who meets the Assistant on nostr** (a person, a client, an app that lists agents). Today they read the profile's "about" text and guess. A profile can say anything; nothing carries the person's signature.
- **Apps that treat agents differently** (hide them from people-search, show "agent of X", route trust through the owner). Today the profile's `bot` flag says "automated", not "whose"; the Treasure Map says "provides my scores", not "is my agent".
- **The instance operator.** Wants every Assistant on the instance to carry the same declaration, so the instance's agents are legible as a class and the hub's count tells the truth.

## Competitive landscape

- **Profile text.** Free text in the Assistant's own profile. Structural failure: the agent's unsigned self-description, unqueryable, with no counter-signature from the person.
- **The `bot` profile flag (NIP-24).** A boolean meaning "content is automated". Structural failure: it names no owner.
- **Delegated event signing (NIP-26).** Marked "unrecommended" upstream. Structural failure: a delegation token proves signing authority for events, not a public relationship, and clients do not check it.
- **The Treasure Map (NIP-85, kind 10040).** Person-signed, and already in use here. Structural failure for this problem: it is scoped to "which provider publishes which data for me", one entry per data type; it is not an identity claim, the Assistant says nothing back, and only NIP-85 readers see it.
- **A community-made "My Agent" tag.** On staging and production today, one person made a tag "My Agent" ("Reserved for npubs operated by your AI agent") and applied it to their agent. It shows the need is felt. Structural failure: one direction only, one author's private convention, no answer from the agent, and nothing tells anyone it is missing.
- **Tapestry's own Tags and Taggings.** Person-signed assertions that a pubkey belongs to a tag, queryable by tag and by target, one live stance per asserter with latest-wins, disputable by anyone. Both directions are already possible because anyone may tag any pubkey. The only gaps are that no convention names which tags mean "my assistant" and "my owner", and that an Assistant has no way to sign a tagging of its own.

## Opportunity

The tagging system already provides both halves of the handshake. A person can tag any pubkey. An Assistant is a pubkey whose key this instance holds, so it can tag back. Four taggings, two signers, and any nostr reader can verify the relationship from signatures alone, in either direction, without knowing anything about Tapestry: "Alice says this pubkey is her Tapestry Assistant; that pubkey says Alice is its owner."

Why now: the hub exists and marks all ten actions. This is the simplest action to make real (four events, two signers, one page) and the first to prove the pattern the other nine will follow: one shared answer for the page, the hub's card and the alert. It also establishes the one thing every later action needs, a narrow way for the signed-in person's own Assistant to sign something other than its profile.

Why this team: only the instance holds the Assistant's key, runs the tagging protocol, and computes who the viewer's Assistant is.

## Constraints

- **Budget:** one book of work, scoped to this page and the shared answer it feeds.
- **Timeline:** not specified. Other sessions are working on the setup pages and on other Assistant surfaces in parallel, so the shared lines are re-checked before implementation and before review.
- **Team:** Tapestry engineering, downstream of this brief.
- **Technical:** built on Tapestry and nostr. The four taggings use the existing Tags and Taggings convention unchanged; a change to the tagging protocol is out of scope (a convention naming the four tags may still be recorded in the protocols directory, since it changes no wire format). The person signs with their browser extension, as every tagging is signed today. The Assistant's two taggings need its own key, which lives on this instance, so they need a narrow server action that signs for the signed-in person's own Assistant only, in the mould of the profile publish. Today the only general sign-as-assistant path serves the instance owner alone and always signs as the instance's own Assistant. Whatever the page reports is the viewer's own Assistant's state, computed from the assertions as they are, filtered at read time; nothing is gated at write time. Publishing reports what each relay did, as the profile publish does.
- **Regulatory:** none identified. Privacy: the handshake publicly links a person to their agent. That is its purpose, and it must be the person's explicit act, never a silent side effect.

## Decisions taken at Discovery

Settled with the owner on 2026-09-22, in answer to the open questions below.

1. **Two cards, one per signer.** "Taggings you put on your Assistant" and "Taggings your Assistant puts on you". Each lists its two taggings with their state and has one publish button.
2. **A checkbox per tagging on each card, checked by default,** so the person can leave one out when they press publish. Leaving one out is "not this time": the tagging still counts as missing afterwards, and nothing is stored about the choice.
3. **The Assistant's taggings are published only on the button,** not when an Assistant is created. Creation-time publishing may come later on top of the same server action.
4. **The hub switches now.** The Identification Tags card, the hub's count line and the Assistant Alert use this action's real answer while the other nine actions still count.
5. **The owner publishes the four canonical tag definitions with their own key,** once, so every instance and every outside reader looks for the same four tags. The check stays permissionless: a tagging of a same-named tag by another author still counts. The publish button applies the canonical tag.
6. **"My Owner" becomes "My Human".** The four required taggings are: you on your Assistant, "My Tapestry Assistant" and "My Agent"; your Assistant on you, "My Tapestry Owner" and "My Human".
7. **One required list, the same on every instance, shipped with the app.** Each entry names the tag, the direction and the signer. Adding a tagging is one entry and, if needed, its canonical tag.
8. **One sentence about the Treasure Map, no check:** "Your Treasure Map tells apps what your Assistant publishes for you; these tags are simply an additional mechanism to associate you and your Assistant."
9. **What counts as present** stands as stated in open question 7.

## Open questions

*Numbered; each carried the Strategist's recommendation. All were answered on 2026-09-22 (see Decisions); the record of what was asked stays below.*

1. **This page's own cards: one per tagging, or two groups?** Recommendation: two cards, one per signer. "You → your Assistant" lists the two taggings you sign; "Your Assistant → you" lists the two it signs. Each card shows the state of each tagging inside it and has one button that publishes whatever is missing in that group. The grouping matches who signs, so one press on the first card is one extension flow, and one press on the second is one server request.
2. **When are the Assistant's taggings published: when an Assistant is created, or only on a button press?** Recommendation: only on the button, for now. The claim is public and should be the person's act; Assistants are created on several paths (first boot, admin provisioning, customer signup) that would each need the same hook; and the hub already prompts anyone whose taggings are missing. Publishing at creation can be added later on top of the same server action.
3. **Should the hub's card and the pill switch to the real answer for this action now, while the other nine still count?** Recommendation: yes. The count becomes "nine placeholders plus this one's real answer". That is what "the first one to get a real answer" means, and it exercises the replacement path the other nine will take.
4. **Who authors the four tag definitions, and which tag do outside clients look for?** *(Answered with two additions: "My Owner" is renamed "My Human", and each card gets a checkbox per tagging, checked by default.)* None of the four exists on this instance; on staging and production only "My Agent" exists, made by a community member. Tags by different authors with the same name are different tags, so this decides what "the" tag is. Recommendation: one canonical definition per tag, published once by the project owner's own key, so every Tapestry instance and every outside reader looks for the same four addresses; the convention is recorded in the protocols directory. The page's check stays permissionless: a tagging with the right name, signer and target counts even if it points at someone else's copy of the tag, and the publish button applies the canonical one. Alternatives: each instance's Assistant publishes its own copies (addresses differ per instance, so outside readers must first learn the instance), or adopt the community's "My Agent" as canonical (a third party's key then defines a protocol-level meaning).
5. **"More may be added later": how the list grows.** Recommendation: the required set is one list, the same on every instance and shipped with the app, not an operator setting; each entry names the tag, the direction and the signer. Adding a tagging is adding an entry and, if needed, publishing its canonical tag. A per-instance list would defeat the purpose, since the tags exist for readers outside the instance.
6. **Should this page mention the Treasure Map (kind 10040)?** Recommendation: one sentence of cross-reference, no check. Changing the Map stays with the setup page's third step. *(The owner kept the sentence but changed its second half; Decision 8 has the final words.)*
7. **What counts as present.** Stated as the working assumption, not a question for the owner unless they disagree: a tagging is present when the required signer's latest stance on that tag and target is "apply", found on this instance's relay or on the outside relays the instance reads tags from. A dispute by anyone else does not make it missing, because the claim is the signer's own. A flip to "dispute" or a retraction by the signer does. The check is about the viewer's own Assistant only; visitors and people without an Assistant here see the page unmarked, as the hub does.
