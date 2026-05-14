# Intake Log

Append-only log of incoming requests, raw, with classification and chosen phase path.

---

## 2026-05-13 — Scheduled task: refresh Meilisearch profiles + House PoV WoT scores

**Raw request (verbatim):**

> In the tapestry repository, there is a new feature I would like to add in the Home > Settings > Relays page, Scheduled Tasks tab. Currently, there is a panel to Update All Scores for Owner that can be enabled / disabled and that can be set to run on a schedule. I would like to create a new panel that Meilisearch profiles and House PoV wot scores are kept updated. Like the existing panel, it should have an enable / disable toggle button (default: disabled) and the ability to set it to Run ever __ days, __ hours.
>
> We will code up the feature on a local branch, then push it to staging, then to main, as per our usual routine.
>
> Does this make sense? What questions or recommendations do you have?

**Follow-up (verbatim):**

> One question before we begin: Does your current plan include updating the House PoV Treasure Map (kind 10040 event) and all Trusted Assertions (kind 30382 events)? We will want to do that before loading WoT scores into Meilisearch.

**Clarifications captured in the pre-intake conversation:**

- House PoV is a *different* pubkey from Owner; configured by the admin at Home > My Grapevine > Search Preferences (persisted in `settings.json` under `grapevine.searchPreferences.povPubkey` / `delegatedPubkey` / `nip85Relay`).
- House is a remote pubkey on this node — we do **not** publish on its behalf; we sync its externally-published 10040 and 30382 events into local strfry.
- The latest Trusted Assertions (kind 30382) are the **single source of truth** for House's scores. Neo4j is not. Therefore the task does not recompute scores — it ensures the latest TAs are present locally, then loads them into Meilisearch.
- Task scope: profile sync + score reload only — no GrapeRank recompute. The full Owner-side score recompute remains the responsibility of the existing "Update All Scores for Owner" task.
- UI shape: one combined panel with one shared schedule (enable toggle + days/hours), matching the existing panel's UX. Default disabled.
- Process: user opted to run this feature through the project's Product Owner → Architect → Tester → Implementer → Reviewer harness.

**Classification:** Feature
**Strictness:** Standard
**Phase path:** Planning → Architecture → Test Design → Implementation → Review (all five phases apply per Standard / Feature)
