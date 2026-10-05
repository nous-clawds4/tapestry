# The V4V Songs intake entry said a new session could reach staging; this session couldn't

**Id:** 2026-10-04-intake-claimed-staging-reachable
**Type:** meta
**Opened:** 2026-10-04 (the V4V Songs views session)
**Status:** OPEN
**Done:** —

**What was seen.** The 2026-10-03 V4V Songs entry in `engineering-team/stories/_intake.md` says, under **Environment**,
that the owner had allowed `staging.brainstorm.world` and `dcosl.brainstorm.world` in the Default Cloud Environment, "so
a new session can smoke-test on staging". The next session's first check (the owner asked for it) got 403 from the
egress proxy for staging, dcosl and tapestry.brainstorm.world. It worked once the owner added `*.brainstorm.world` to
that session's environment, mid-session, with no restart.

**Fix shape.** An intake or handoff that depends on egress names the environment and says to check reachability
first (one `curl` to the host), rather than asserting it. A session that finds a host blocked says so and carries on
with the work that doesn't need it.

**Pointer:** `engineering-team/stories/_intake.md` (the 2026-10-03 V4V Songs entry, **Environment**).
