# PRD Seed: Live Feed

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/live-feed/audit.md`
**Anchor:** acceptance frame in `book.md` (operator's confirmed kickoff frame)
**Confidence:** medium — the *as-built* and *scope* are high-confidence (frame-grounded, verified on staging); the *problem/vision* and *personas* are inferred and need product validation.
**Date:** 2026-06-15

> Reverse-engineered baseline in PRD shape, built from what shipped. A **strawman for the product team**, not a ratified spec. Sections tagged `[FROM FRAME]` / `[INFERRED]` / `[UNKNOWN — product input needed]`. Adopt as the `/discover` starting point for the next phase and validate each section.

## 1. Product vision
`[FROM FRAME]` Give any visitor a plain, public view of recent kind-1 (note) activity from a single source identity's follows — the logged-in user's follows, or the instance's House point-of-view when logged out.
`[FROM FRAME]` Its stated purpose is to be a **host surface**: the operator built it "relatively basic, nothing fancy" explicitly so that a later capability — **tagging any feed item with any existing Tag** — can hang off it.
`[INFERRED]` The opportunity: a web-of-trust search instance already holds follow graphs (strfry) and profiles (Meili/strfry); a feed surfaces that data as live content and creates a place to apply trust/tagging actions to real notes.
`[UNKNOWN — product input needed]` Who the feed is *for* as a primary audience (curious visitors? logged-in members? the tagging workflow's operators?) and what success looks like beyond "it renders."

## 2. Personas
`[INFERRED — flag as guesses]`
- **Anonymous visitor** — lands on `/feed` with no account; sees the instance's House-PoV feed (a curated default view of the community the instance represents).
- **Logged-in member** — sees their *own* follows' recent notes; the feed is personalized to their kind-3 list.
- `[UNKNOWN]` **Tagger / curator** (the *reason* for the feed) — will act on feed items in the later tagging book; their needs are not yet modeled.

## 3. Scope (as-built)
`[FROM FRAME]` In scope and shipped:
- Public, bookmarkable `/feed`, no login required (anonymous 200).
- Single resolved source identity: logged-in user, else House PoV. **No source selector.**
- Kind-3 follows read from **local strfry**; kind-1 notes from the **general-purpose relay set** (Concept Graph, slug-from-TA, hardcoded fallback); author name/avatar from **local kind-0**.
- Newest-first, fixed **50-note** recent window, kind-1 only (reposts/reactions excluded).
- Three empty/edge states with clear on-page messages; additive & read-only (no writes; existing app unaffected).

`[FROM FRAME]` Explicitly **out of scope** (deferred): tagging feed items (separate later book), a source/PoV picker, reposts/reactions/threading, pagination/infinite scroll/full history, and any write/publish or change to search/profile/ranking/firmware.

## 4. Domain model
`[INFERRED]` from concepts touched (by handle) and the shipped contract:
- **Source identity** — a `nostr-user` (pubkey); resolved, not chosen. House identity = `searchPreferences.povPubkey`.
- **Follow list** — kind-3, read from local strfry; presence/absence drives two distinct outcomes.
- **Note** — kind-1 from the **general-purpose relay set** (`39999:<TA>:the-set-of-general-purpose-relays`); rendered fields: id, author pubkey, timestamp, text.
- **Author profile** — kind-0 (local), supplying display name + avatar.
- **Feed outcome** — a discriminated state: `OK` / `EMPTY` / `NO_SOURCE` / `FOLLOW_LIST_UNAVAILABLE`, plus a `relaySource` (`set`/`fallback`) marker.

## 5. Design rules (as-built)
`[INFERRED]` from the shipped UI + review notes:
- Plain public-page shell (modeled on the existing About page): top bar + single capped-width centered column; no horizontal overflow at 1280px (wrapping/capped CSS).
- Heading "Live Feed"; recent-window indicator "Showing the most recent 50 notes."; one card per note (avatar + display name + local-formatted timestamp + text).
- Empty/edge states render a single clear message, never a blank page or raw error; a defensive "couldn't load" branch covers transport failure.
- `[INFERRED]` Untrusted relay content is rendered as React-escaped text (no `dangerouslySetInnerHTML`); avatar is a plain size-locked `<img>`.
- `[UNKNOWN]` No visual/brand guide was authored for the feed beyond reuse of existing `bsp-*` tokens — product/design may want to specify density, media handling (images/embeds in notes are currently shown as raw URLs), and empty-state visuals.

## 6. Carry-forward & open questions
Promoted from `audit.md` §6:
- [ ] **Tagging feed items** — the next book; depends on the `nostr-event-tag` wire spec.
- [ ] Graceful relay-timeout handling (degrade to `EMPTY`/`OK`, not 500).
- [ ] Whether to surface a source / fallback-relay indicator on the page (deliberately unshown today).
- [ ] Media-in-notes treatment (image/URL rendering) — currently raw URLs.
- [ ] Minor hygiene: strfry quote-escape, avatar `onError` (engineering cleanups).

## 7. What product must validate
- [ ] **The problem & audience** (§1/§2) — who is the feed primarily for, and what is the underlying user need beyond enabling tagging?
- [ ] **Success metrics** — none were defined; the frame is purely behavioral. What outcome makes this feed "working" (engagement? a step toward tagging adoption?)?
- [ ] **Personalization depth** — logged-in users see their own follows; is a richer personalized/curated feed (ranking, web-of-trust weighting) a future goal, or is "raw newest-first from follows" the intended product?
- [ ] **Media & richness** — should notes render images/embeds/links, replies/threads, reposts — or stay deliberately plain?
- [ ] **Source choice** — the frame forbade a source selector; is that permanent, or a v1 simplification?
