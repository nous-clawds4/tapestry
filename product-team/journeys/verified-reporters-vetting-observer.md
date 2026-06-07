# Journey: The Vetting Observer

**Slug:** verified-reporters-vetting-observer
**Persona:** `product-team/personas/verified-reporters-vetting-observer.md`
**Date:** 2026-06-07

From first encounter to engaged user. Includes the first-visit experience — the first time this user ever sees the Verified Reporters count.

## Steps

### 1. Encounter
- **Trigger:** a stranger appears — a mention, a feed item, a search result.
- **Action:** open the stranger's profile.
- **Expected experience:** the profile loads with the trust-signals row, including a Verified Reporters count filtered to the observer's PoV, parallel to Following and Verified Followers.
- **Emotional state:** routine, scanning.

### 2. Notice the signal
- **Trigger:** the Verified Reporters count is non-zero.
- **Action:** pause and read the number.
- **Expected experience:** the count is clearly attributed to their own PoV and is visually parallel to Verified Followers but legible as a *negative* signal — not blended into the positive ones.
- **Emotional state:** alert, cautious.

### 3. Investigate
- **Trigger:** the count is high enough to be consequential.
- **Action:** click the count to open the list of verified reporters.
- **Expected experience:** the list shows *which* verified users reported this account, so the observer can weigh credibility — do I respect these reporters?
- **Emotional state:** discerning.

### 4. Decide
- **Trigger:** enough information to judge.
- **Action:** follow, ignore, or avoid.
- **Expected experience:** a snap judgment supported by evidence rather than vibes.
- **Emotional state:** confident.

### 5. Recalibrate
- **Trigger:** repeated encounters over time.
- **Action:** continue vetting strangers with the signal in hand.
- **Expected experience:** the signal sharpens their instincts and proves reliable.
- **Emotional state:** trusts the system.

## First-visit experience
The first time this user ever sees the Verified Reporters count, it must be self-explanatory — a clear label plus PoV attribution — so it is never mistaken for a global number. No onboarding step should be required to make the signal legible.

## Friction points
- **Zero-state ambiguity:** is "0" a clean record, or simply not computed? The two must be distinguishable.
- **Unweighable singletons:** a "1" from a possible pile-on-er presented with no way to weigh the reporter (discounting is a future feature; for now the list must at least be inspectable).
- **Self-view retaliation:** seeing exactly who reported you enables retaliation; the self-view case needs deliberate handling.
- **Count-vs-list mismatch:** if the count and the list apply filters differently, the numbers won't agree and trust in the signal erodes.
