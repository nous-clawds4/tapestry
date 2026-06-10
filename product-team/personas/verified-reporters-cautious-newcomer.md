# Persona: The Cautious Newcomer

**Slug:** verified-reporters-cautious-newcomer
**Priority:** Secondary
**Date:** 2026-06-07

## Who they are
New to Tapestry, or not logged in, with **no calculated web of trust yet**. They want to avoid bad actors but have no personal network to filter through. They are exploratory and a little wary, and they do not yet understand web-of-trust mechanics.

## What they want
Some credible signal about whether a stranger is widely flagged, despite having no network of their own to filter through.

## Their core loop
Land on a profile (often via a shared link, before having an account) → look for trust signals → hit the **House PoV fallback** for Verified Reporters → understand this is a shared default, not their own view → use it provisionally → build their own web of trust over time and graduate into the Vetting Observer's loop.

## What they won't tolerate
- Being silently shown a "global" number that contradicts the no-global-view principle.
- Confusion about why their number differs from what an established user sees.
- A dead end that requires an account before showing any value.

## Notes
This persona exists to force the design to handle the House PoV fallback explicitly and legibly (discovery open question #3). The first-visit / no-account experience lives here. Per discovery, the House PoV fallback should let even a no-WoT viewer see *something*, so first-visit value is achievable without an account — but the fallback must be labeled as a default, never passed off as a personal or global truth.
