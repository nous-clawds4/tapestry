# Meeting: David Streyhorn — 2026-04-14

## Participants
- **Matthias** (md)
- **David Streyhorn**

## Key Decision

**Pivot from Dioxus/Rust to forking Tapestry.** The Dioxus-based Magic Carpet site (c.brainstorm.org) works but is too slow to compile and deploy for rapid prototyping. David proposed forking Tapestry (Vite-based, already has NIP-07 login and list creation working) and building the bounty system there instead. Matthias agreed.

> "Let's not do any technology that's cool, but not needed."

**Assumption: whatever we build now is going to get rebuilt.** This is a proof of concept.

## Source Branch

Fork from: `nous-clawds4/tapestry`, branch `refactor-paths`

David will text the exact branch name. (Update: he sent "refactor-paths".)

Create a PR back to Tapestry — David is okay with that.

## What Tapestry Already Has (no need to rebuild)

- **NIP-07 Nostr login** — sign in / sign out works across the whole site
- **List creation** — at `tapestry/lists/new` (title, description, items)
- **List publishing** — publishes to local relay (stir fry), good enough for now
- **Router** — works, just extend it
- **Legacy pages** — David moved old Brainstorm front page content to `/legacy` on the refactor-paths branch

## Tasks for Thursday (2026-04-17)

### 1. Bounty Creation
- Any logged-in user can attach a bounty (sats) to a list, incentivizing others to add items
- UI: button on a list like "Incentivize" or "Pay people to add"
- Could be on the list page itself or link to a Magic Carpet subpage

### 2. Eligibility Dashboard
- When logged in, show a dashboard of bounties you're eligible to claim
- Eligibility is based on **Trusted Assertions** (Nostr web of trust)
- Default trust cutoff: **rank 2** (make adjustable later)
- Ask Claude: "How did Alice find out if Bob trusts her in Tapestry using Trusted Assertions?"
- Display: issuer name, trust rank (0-100), bounty amount in sats
- Filter out untrusted issuers (likely spam)

### 3. Claiming Bounties
- From the eligibility view, user can choose to claim a bounty
- Claiming = submitting content (list items) to fulfill the request
- Example: Alice posts bounty for "dog breeds" list → Bob (trusted by Alice) submits entries

### 4. Payments / Zap Integration
- Issuer sees submissions and can zap (pay) contributors they like
- Anyone can zap, not just the issuer — if others are interested in the same list, they can zap contributors too
- Issuer needs a "Payments Due" page showing who submitted what
- Sort bounties by most-paid (highest signal of demand)

### 5. Broadcast / Advertising Bounties
- Ability to broadcast/advertise that a bounty exists
- For now, local relay is fine; broadcasting to wider network comes later

## Architecture Notes

- **Tapestry uses Vite** (not React, not Dioxus)
- Extend the existing router — ask Claude how it's implemented
- NIP-07 for login (browser extension wallets like Alby, nos2x)
- Trusted Assertions for web-of-trust eligibility checks
- Zaps for payment mechanism

## Future / Parking Lot

- **Dioxus Magic Carpet**: shelved, not abandoned. Good framework (one codebase for web + desktop + mobile), Rust type safety eliminates whole classes of bugs, fast by default. Worth revisiting when scaling.
- **Issuer trust track record**: show whether an issuer actually pays out bounties (not just rank score)
- **Adjustable trust cutoff**: let users set their own threshold beyond rank 2
- **Broadcast to wider relays**: currently local stir fry only
- **LLM Wiki**: David recommends creating one for Nostr Fabrica / Tapestry / decentralized lists concepts using Hermes agent's LLM Wiki skill. Knowledge graph of linked markdown files, better for agents than a single Bible file. Eventually expose as an API other agents can query. Goes on the to-do list, not this sprint.
- **Tapestry Bible**: exists at top level of Tapestry repo (`bible.md`), possibly also in Tapestry CLI repo. Use as reference for now.

## Workflow

1. Read Tapestry YouTube video transcript + Tapestry repo (especially the Bible)
2. Use the Sleepy Dwarfs example as canonical test vector
3. Fork `refactor-paths` branch
4. Implement bounty system in the router
5. PR back to Tapestry
6. Review with David on Thursday 2026-04-17

## Tooling Discussion

- David uses Claude Code with Max Plan, finds it effective
- Hermes (by Nous Research) is more capable as an agent harness (self-improving, mistake logging) but can't use Max Plan with it
- Rust's `cargo check`, `cargo clippy`, `machete`, `mutants`, prop tests give Claude "extra eyes" via static analysis — JS/TS lacks this
- For now, Claude Code is the primary tool
