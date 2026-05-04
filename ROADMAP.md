# Roadmap

The strategic product roadmap for Brainstorm Search. For protocol-level vision and the technical feature backlog, see [BIBLE.md](./BIBLE.md). For deployment specifics, see [OPERATIONS.md](./OPERATIONS.md).

---

## Vision

Brainstorm Search will become **a generalized search engine for all the information on the planet** — an alternative to Google.

The path there mirrors Amazon's. Amazon started selling books, then added one new category at a time (music, electronics, clothing…) until it sold everything. Brainstorm Search starts as the best place on nostr to search for **nostr profiles**, and will expand one searchable category at a time until it can answer any query.

---

## Product Principles

- **Easy, fast, free, effective.** Non-negotiable.
- **No nostr account required to use.** A user lands on Brainstorm Search and gets useful results immediately, with no signup friction.
- **Accounts are optional, in two tiers:**
  1. A **nostr account** (NIP-07 / external signer) — unlocks personalized, trust-aware results.
  2. A **Brainstorm account** — additionally enables server-side calculation of trust scores tailored to that user.
- **Don't push accounts.** Users are invited to sign up only when they have a specific, compelling reason — e.g. they want results personalized to their own web of trust, or they want to curate.
- **Primary goal: drive (free) traffic.** No paywalls, no signup walls. The growth strategy is to be so effective at search that users come on their own.

---

## Strategy

Be the most effective search engine in existence — for whatever category we currently cover.

Search quality is powered by **trust-weighted curation**: the user's web of trust (and the extended communities they trust) determines what is surfaced and how it is ranked. As coverage expands beyond nostr-native content, curation comes from the **Decentralized List (DList) NIPs** — trusted lists assembled by the user's extended community.

A consequence: searchable content does **not** need to live primarily on nostr. Anything that someone in a user's extended trust network has curated into a list becomes searchable. The end state is a search engine that, for any query, returns what your trusted community would recommend.

---

## Current State

Brainstorm Search today: **nostr profile search.** Live at [brainstorm.world](https://brainstorm.world). Backed by Meilisearch + GrapeRank trust scoring + the NIP-50 relay proxy. See [BIBLE.md §13 "Brainstorm Search Features"](./BIBLE.md) and [BIBLE.md §11 "Search"](./BIBLE.md) for technical details.

---

## What Comes Next — The Central Question

**What order do we add new searchable content and features?**

This is the most important strategic question on the roadmap. Each addition should be one we can do better than anyone else, and that meaningfully expands the addressable user base. Sequencing considerations include:

- Which category demonstrates the trust-engine value most clearly to a new user?
- Which has the most underserved existing demand?
- Which builds shared infrastructure (e.g. DList tooling, indexers) that later categories can reuse?

### Candidate next categories and features (unordered)

- **Tags** — search nostr by hashtag, trust-weighted.
- **Communities** — search NIP-72 / kind-34550 communities.
- **Kind 1 search** — short-form notes, trust-weighted full-text.
- **Long-form content search** — kind 30023 articles.
- **Music search (TrustWave)** — discover music via trusted curators.
- **Nostr relay search** — find relays by reputation and policy.
- **Nostr app search** — directory of nostr clients and apps.
- **Cashu mints search** — discover and evaluate Cashu mints.
- **Physicians search** — NosFabrica's healthcare angle.
- **Bounties for information (Magic Carpet)** — pay trusted curators to add items to lists.

This list is unranked on purpose. Picking the order is itself a roadmap exercise.

---

## Long-Term

Beyond nostr-native content: anything curated by a trusted extended community is searchable, regardless of where the underlying content actually lives. The DList NIPs are the mechanism — a curator anywhere on nostr can publish a list pointing at content anywhere on the web, and that list becomes part of the trust graph that powers search.

That is the path from "best nostr profile search" to "alternative to Google."
