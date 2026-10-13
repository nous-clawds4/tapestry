# Check staging's saved Assistant Duties list for keys round 1 accepted and round 2 drops

**Id:** 2026-10-12-staging-duty-list-round1-keys
**Type:** cleanup
**Opened:** 2026-10-12 (`assistant-duties-settings` book close; review round 2 note 5)
**Status:** OPEN
**Done:** —

Round 1 of `assistant-duties-settings` #1 (`273d44410`) was live on `staging` from about 22:30 to 23:30 UTC on
2026-10-12. It accepted any key readers keep. Round 2 accepts only whole kinds and drops anything else on read
(logged, no migration).

If anyone saved a narrower or family key in the tab during that hour, staging's
`/var/lib/brainstorm/settings.json` still holds it, and staging's log shows `[assistant/duty-menu] ignored N
assistantDuties entries` on every check.

**To do:** look once. On the droplet:

```bash
docker exec tapestry sh -c "grep -A20 assistantDuties /var/lib/brainstorm/settings.json"
```

If a bad entry is there, remove it from the tab (it won't be shown, so Reset to defaults or a re-save of the shown
list replaces the file's list), or edit the file. Production never ran round 1.

**Pointer:** `engineering-team/audits/assistant-duties-settings/audit.md` §5.
